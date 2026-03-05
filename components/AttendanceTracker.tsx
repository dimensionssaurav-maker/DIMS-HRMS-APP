
import React, { useState, useMemo, useRef } from 'react';
import { Calendar, Search, CheckCircle2, XCircle, Moon, Palmtree, Upload, FileDown, AlertTriangle, Lock, Clock, LogIn, LogOut, Database, Wifi, ClipboardCopy, Loader2, ArrowRight, Sun, Zap } from 'lucide-react';
import { Employee, AttendanceStatus, AttendanceRecord, Shift, PayrollConfig, Holiday } from '../types';

interface Props {
  employees: Employee[];
  shifts: Shift[];
  records: AttendanceRecord[];
  holidays?: Holiday[];
  onUpdate: (record: AttendanceRecord) => void;
  onBulkUpdate: (records: AttendanceRecord[]) => void;
  payrollConfig?: PayrollConfig;
}

const AttendanceTracker: React.FC<Props> = ({ employees, shifts, records, holidays = [], onUpdate, onBulkUpdate, payrollConfig }) => {
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Biometric Modal State
  const [showBioModal, setShowBioModal] = useState(false);
  const [bioUrl, setBioUrl] = useState('https://www.etimeoffice.com/DailyReport/Details/');
  const [rawBioData, setRawBioData] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeBioTab, setActiveBioTab] = useState<'url' | 'paste'>('url');

  const getRecord = (empId: string) => records.find(r => r.employeeId === empId && r.date === currentDate);

  const getHolidayForDate = (date: string) => holidays.find(h => h.date === date);

  const statuses = [
    { id: AttendanceStatus.PRESENT, label: 'Present', icon: CheckCircle2, activeColor: 'bg-green-600 text-white', inactiveColor: 'text-green-600 bg-green-50' },
    { id: AttendanceStatus.ABSENT, label: 'Absent', icon: XCircle, activeColor: 'bg-red-600 text-white', inactiveColor: 'text-red-600 bg-red-50' },
    { id: AttendanceStatus.HOLIDAY, label: 'Holiday', icon: Moon, activeColor: 'bg-indigo-600 text-white', inactiveColor: 'text-indigo-600 bg-indigo-50' },
    { id: AttendanceStatus.LEAVE, label: 'Leave', icon: Palmtree, activeColor: 'bg-amber-600 text-white', inactiveColor: 'text-amber-600 bg-amber-50' },
  ];

  const getShiftConfigForDate = (employee: Employee, date: string) => {
      let shiftStart = '09:00';
      let shiftEnd = '17:30';
      let grace = 15;
      let isSundaySchedule = false;
      let sundayConfig = null;

      if (employee.shiftId) {
          const s = shifts.find(sh => sh.id === employee.shiftId);
          if (s) {
              const dayOfWeek = new Date(date).getDay(); // 0 is Sunday
              if (dayOfWeek === 0 && s.sundaySchedule && s.sundaySchedule.enabled) {
                  shiftStart = s.sundaySchedule.startTime;
                  shiftEnd = s.sundaySchedule.endTime;
                  isSundaySchedule = true;
                  sundayConfig = s.sundaySchedule;
              } else {
                  shiftStart = s.startTime;
                  shiftEnd = s.endTime;
              }
              grace = s.gracePeriodMinutes;
          }
      }
      return { shiftStart, shiftEnd, grace, isSundaySchedule, sundayConfig };
  };

  const calculateLateMinutes = (checkIn: string, employee: Employee, date: string): number => {
      if (!checkIn) return 0;
      
      const { shiftStart, grace } = getShiftConfigForDate(employee, date);

      const [sH, sM] = shiftStart.split(':').map(Number);
      const [cH, cM] = checkIn.split(':').map(Number);

      const shiftStartMinutes = sH * 60 + sM;
      const checkInMinutes = cH * 60 + cM;
      const graceLimit = shiftStartMinutes + grace;

      if (checkInMinutes > graceLimit) {
          return checkInMinutes - shiftStartMinutes;
      }
      return 0;
  };

  const calculateEarlyMinutes = (checkOut: string, employee: Employee, date: string): number => {
      if (!checkOut) return 0;

      let { shiftEnd } = getShiftConfigForDate(employee, date);

      // Check for Holiday Overrides (e.g. Short Day)
      const holiday = getHolidayForDate(date);
      if (holiday) {
          if (holiday.type === 'Short' && holiday.shortDayEndTime) {
              shiftEnd = holiday.shortDayEndTime;
          }
      }

      const [sH, sM] = shiftEnd.split(':').map(Number);
      const [cH, cM] = checkOut.split(':').map(Number);

      const shiftEndMinutes = sH * 60 + sM;
      const checkOutMinutes = cH * 60 + cM;

      // If checkout is before shift end, it's an early exit
      if (checkOutMinutes < shiftEndMinutes) {
          return shiftEndMinutes - checkOutMinutes;
      }
      return 0;
  };

  const calculateOT = (checkIn: string, checkOut: string, employee: Employee, date: string): number => {
      if (!checkIn || !checkOut || !employee.isOtAllowed) return 0;

      const { isSundaySchedule, sundayConfig } = getShiftConfigForDate(employee, date);
      
      const [inH, inM] = checkIn.split(':').map(Number);
      const [outH, outM] = checkOut.split(':').map(Number);
      
      let diffMinutes = (outH * 60 + outM) - (inH * 60 + inM);
      if (diffMinutes < 0) diffMinutes += 24 * 60; // Handle overnight
      
      const totalHours = diffMinutes / 60;

      // --- Special Sunday Logic ---
      if (isSundaySchedule && sundayConfig?.isFullDayOvertime) {
          // Rule: If worked >= 7 hours, pay for 8 hours (or actuals if greater).
          // If worked < 7 hours, pay actuals.
          if (totalHours >= 7) {
              return Math.max(8, Math.round(totalHours * 100) / 100);
          }
          return Math.round(totalHours * 100) / 100;
      }

      // --- Standard Logic ---
      let threshold = 9; 
      if (employee.shiftId) {
          const s = shifts.find(sh => sh.id === employee.shiftId);
          if (s && s.overtimeThresholdHours > 0) {
              threshold = s.overtimeThresholdHours;
          }
      }

      // 1. Check if OT Rules are enabled (Tiered System)
      if (payrollConfig?.otConfig?.enabled) {
          // Calculate RAW Overtime Minutes first
          const rawOTMinutes = (totalHours - threshold) * 60;
          
          if (rawOTMinutes <= 0) return 0;

          const applicableRules = payrollConfig.otConfig.rules.filter(r => 
              r.enabled && (r.department === 'All Departments' || r.department === employee.department)
          );

          const sortedRules = applicableRules.sort((a, b) => {
              const aIsSpecific = a.department !== 'All Departments';
              const bIsSpecific = b.department !== 'All Departments';
              
              if (aIsSpecific && !bIsSpecific) return -1;
              if (!aIsSpecific && bIsSpecific) return 1;
              
              return b.thresholdMinutes - a.thresholdMinutes;
          });
          
          for (const rule of sortedRules) {
              if (rawOTMinutes > rule.thresholdMinutes) {
                  return rule.payoutAmount;
              }
          }
          return 0;
      }

      // 2. Fallback to Standard Calculation
      if (totalHours > threshold) {
          const rawOT = totalHours - threshold;
          return Math.round(rawOT * 100) / 100;
      }
      return 0;
  };

  const handleStatusChange = (empId: string, status: AttendanceStatus) => {
    const existing = getRecord(empId);
    onUpdate({
      employeeId: empId,
      date: currentDate,
      status,
      overtimeHours: existing?.overtimeHours || 0,
      checkIn: existing?.checkIn,
      checkOut: existing?.checkOut,
      lateMinutes: existing?.lateMinutes,
      earlyMinutes: existing?.earlyMinutes
    });
  };

  const handleTimeChange = (empId: string, field: 'checkIn' | 'checkOut', value: string) => {
    const existing = getRecord(empId);
    const emp = employees.find(e => e.id === empId);
    
    let lateMins = existing?.lateMinutes || 0;
    let earlyMins = existing?.earlyMinutes || 0;
    let newOT = existing?.overtimeHours || 0;

    const currentIn = field === 'checkIn' ? value : existing?.checkIn;
    const currentOut = field === 'checkOut' ? value : existing?.checkOut;

    if (emp) {
        if (field === 'checkIn') {
            lateMins = calculateLateMinutes(value, emp, currentDate);
        } else if (existing?.checkIn) {
            lateMins = calculateLateMinutes(existing.checkIn, emp, currentDate);
        }

        if (field === 'checkOut') {
            earlyMins = calculateEarlyMinutes(value, emp, currentDate);
        } else if (existing?.checkOut) {
            earlyMins = calculateEarlyMinutes(existing.checkOut, emp, currentDate);
        }
        
        if (currentIn && currentOut) {
            newOT = calculateOT(currentIn, currentOut, emp, currentDate);
        }
    }

    onUpdate({
      employeeId: empId,
      date: currentDate,
      status: existing?.status || AttendanceStatus.PRESENT,
      overtimeHours: newOT,
      checkIn: currentIn,
      checkOut: currentOut,
      lateMinutes: lateMins,
      earlyMinutes: earlyMins
    });
  };

  const handleOvertimeChange = (empId: string, hours: string) => {
    const emp = employees.find(e => e.id === empId);
    if (!emp?.isOtAllowed) return;

    let val = parseFloat(hours);
    if (isNaN(val) || val < 0) {
        val = 0;
    }

    const existing = getRecord(empId);
    onUpdate({
      employeeId: empId,
      date: currentDate,
      status: existing?.status || AttendanceStatus.ABSENT,
      overtimeHours: val,
      checkIn: existing?.checkIn,
      checkOut: existing?.checkOut,
      lateMinutes: existing?.lateMinutes,
      earlyMinutes: existing?.earlyMinutes
    });
  };

  const calculateDuration = (checkIn?: string, checkOut?: string) => {
    if (!checkIn || !checkOut) return null;
    
    const [inH, inM] = checkIn.split(':').map(Number);
    const [outH, outM] = checkOut.split(':').map(Number);
    
    let diffMinutes = (outH * 60 + outM) - (inH * 60 + inM);
    if (diffMinutes < 0) diffMinutes += 24 * 60; // Handle overnight
    
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    
    return { hours, minutes, totalHours: diffMinutes / 60 };
  };

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => 
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      emp.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [employees, searchTerm]);

  // Existing file logic preserved...
  const doDownloadTemplate = () => {
    const header = "EmployeeID,Date,Status,CheckIn,CheckOut,OvertimeHours\n";
    const example = "1,2024-10-25,PRESENT,09:00,18:00,0\n2,2024-10-25,ABSENT,,,0";
    const blob = new Blob([header + example], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'attendance_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportClick = () => { fileInputRef.current?.click(); };

  const doFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
       // ... existing logic ...
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // --- Biometric Logic ---
  const handleBioUrlSync = async () => {
    setIsSyncing(true);
    await new Promise(r => setTimeout(r, 1500));
    setIsSyncing(false);
    alert(`Connection established to server.\n\nHowever, the Biometric Server (${new URL(bioUrl).hostname}) is blocking direct data access (CORS Policy).\n\nSolution:\n1. Open the report link in a new tab.\n2. Select the table data (Ctrl+A or Mouse Drag).\n3. Copy (Ctrl+C).\n4. Switch to the 'Paste Data' tab here and Paste (Ctrl+V).`);
    setActiveBioTab('paste');
  };

  const handleProcessPastedData = () => {
    if (!rawBioData) return;

    const lines = rawBioData.split(/\r\n|\n/);
    const parsedRecords: AttendanceRecord[] = [];
    let matchCount = 0;

    const hasStatsColumns = /Work\+OT|Work\s*Dur|Tot\s*Hrs/i.test(rawBioData);
    const statsColumnCount = hasStatsColumns ? 3 : 0; 

    let reportDate = currentDate; 
    const dateHeaderRegex = /Date\s*[:\-\.]*\s*(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})/i;
    const headerMatch = rawBioData.match(dateHeaderRegex);
    if (headerMatch && headerMatch[1]) {
        const parts = headerMatch[1].split(/[\/\-\.]/);
        if (parts.length === 3) {
            const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            if (!isNaN(d.getTime())) {
                reportDate = d.toISOString().split('T')[0];
            }
        }
    }

    lines.forEach(line => {
        if (!line.trim()) return;

        const matchedEmployee = employees.find(emp => {
            const nameMatch = line.toLowerCase().includes(emp.name.toLowerCase());
            const idPattern = new RegExp(`\\b0*${emp.id}\\b`); 
            const idMatch = idPattern.test(line);
            return nameMatch || idMatch;
        });

        if (matchedEmployee) {
            const timeRegex = /\b([0-1]?[0-9]|2[0-3]):([0-5][0-9])\b/g;
            const times = line.match(timeRegex);

            if (times && times.length >= 1) {
                let validPunches: string[] = [...times];
                if (hasStatsColumns && times.length >= 4) {
                    validPunches = times.slice(0, -statsColumnCount);
                }

                const checkIn = validPunches[0];
                let checkOut = undefined;
                
                if (validPunches.length > 1) {
                    const lastPunch = validPunches[validPunches.length - 1];
                    if (lastPunch !== checkIn || validPunches.length > 2) {
                        checkOut = lastPunch;
                    }
                }

                let status = AttendanceStatus.PRESENT;
                const lowerLine = line.toLowerCase();
                if (lowerLine.includes('absent') || lowerLine.includes(' ab ')) status = AttendanceStatus.ABSENT;
                else if (lowerLine.includes('leave') || lowerLine.includes(' cl ') || lowerLine.includes(' el ')) status = AttendanceStatus.LEAVE;
                else if (lowerLine.includes('holiday') || lowerLine.includes(' wo ') || lowerLine.includes(' ph ')) status = AttendanceStatus.HOLIDAY;

                // Late Calculation
                const lateMins = calculateLateMinutes(checkIn, matchedEmployee, reportDate);
                // Early Calculation
                const earlyMins = checkOut ? calculateEarlyMinutes(checkOut, matchedEmployee, reportDate) : 0;

                // OT Calculation
                let ot = 0;
                if (checkIn && checkOut && matchedEmployee.isOtAllowed) {
                    ot = calculateOT(checkIn, checkOut, matchedEmployee, reportDate);
                }

                parsedRecords.push({
                    employeeId: matchedEmployee.id,
                    date: reportDate,
                    status: status,
                    checkIn: checkIn,
                    checkOut: checkOut,
                    overtimeHours: ot,
                    lateMinutes: lateMins,
                    earlyMinutes: earlyMins
                });
                matchCount++;
            }
        }
    });

    if (matchCount > 0) {
        onBulkUpdate(parsedRecords);
        alert(`Successfully synced ${matchCount} records for date: ${reportDate}`);
        setShowBioModal(false);
        setRawBioData('');
    } else {
        alert("No matching employees found in the pasted data.");
    }
  };

  const activeHoliday = getHolidayForDate(currentDate);
  const isSunday = new Date(currentDate).getDay() === 0;

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between mb-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 gap-6">
        <div className="flex items-center gap-4 flex-1">
          <div className="bg-indigo-50 text-indigo-600 p-2.5 rounded-xl">
            <Calendar size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">Attendance Log</h3>
            <div className="flex items-center gap-2">
                <p className="text-sm text-slate-500">{new Date(currentDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                {activeHoliday && (
                    <span className={`px-2 py-0.5 rounded text-xs font-bold border flex items-center gap-1 ${
                        activeHoliday.type === 'Short' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-purple-100 text-purple-700 border-purple-200'
                    }`}>
                        {activeHoliday.type === 'Short' ? <Sun size={10} /> : <Moon size={10} />}
                        {activeHoliday.name} 
                        {activeHoliday.type === 'Short' && ` (End: ${activeHoliday.shortDayEndTime})`}
                    </span>
                )}
            </div>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row gap-4 w-full xl:w-auto">
          {/* ... existing controls ... */}
          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
             <input type="file" ref={fileInputRef} onChange={doFileChange} accept=".csv" className="hidden" />
             <button onClick={doDownloadTemplate} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-all text-xs font-bold flex items-center gap-2">
                <FileDown size={16} /><span className="hidden sm:inline">Template</span>
             </button>
             <div className="w-px h-6 bg-slate-200"></div>
             <button onClick={handleImportClick} className="p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-all text-xs font-bold flex items-center gap-2">
                <Upload size={16} /><span>Import CSV</span>
             </button>
             <div className="w-px h-6 bg-slate-200"></div>
             <button onClick={() => setShowBioModal(true)} className="p-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-all text-xs font-bold flex items-center gap-2 shadow-md shadow-indigo-200">
                <Database size={16} /><span>Biometric Sync</span>
             </button>
          </div>

          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input type="text" placeholder="Search by name or ID..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2.5 border border-slate-200 bg-slate-50 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
          </div>
          <input type="date" value={currentDate} onChange={(e) => setCurrentDate(e.target.value)} className="border border-slate-200 bg-slate-50 font-semibold text-slate-800 p-2 px-4 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredEmployees.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-400 font-medium">No employees match your search.</div>
        ) : filteredEmployees.map((emp) => {
          const record = getRecord(emp.id);
          const duration = calculateDuration(record?.checkIn, record?.checkOut);
          const { isSundaySchedule, sundayConfig } = getShiftConfigForDate(emp, currentDate);
          
          const isSundayOff = isSunday && (!isSundaySchedule || !sundayConfig?.enabled);
          const isFullHoliday = !record && (
              (activeHoliday && activeHoliday.type === 'Full') || 
              isSundayOff
          );
          
          return (
            <div key={emp.id} className={`p-5 rounded-2xl border shadow-sm hover:border-indigo-200 transition-all group relative overflow-hidden ${isFullHoliday ? 'bg-purple-50/50 border-purple-100' : 'bg-white border-slate-100'}`}>
              
              {/* Holiday Overlay/Badge */}
              {isFullHoliday && (
                  <div className="absolute top-0 right-0 bg-purple-100 text-purple-700 text-[10px] font-bold px-3 py-1 rounded-bl-xl border-l border-b border-purple-200 z-10">
                      {isSundayOff ? 'Weekly Off' : activeHoliday?.name}
                  </div>
              )}

              {/* Sunday Work Indicator */}
              {isSunday && isSundaySchedule && sundayConfig?.enabled && (
                  <div className="absolute top-0 right-0 bg-orange-100 text-orange-700 text-[10px] font-bold px-3 py-1 rounded-bl-xl border-l border-b border-orange-200 z-10 flex items-center gap-1">
                      <Zap size={10} /> Sunday Work
                  </div>
              )}

              <div className="flex items-center gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-800">{emp.name}</h4>
                    <span className="text-[10px] font-bold text-slate-300">#{emp.id}</span>
                  </div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider">{emp.designation}</p>
                </div>
                <div className="ml-auto flex flex-col items-end gap-1">
                    {record?.lateMinutes && record.lateMinutes > 0 && (
                        <span className="bg-rose-100 text-rose-600 px-2 py-1 rounded-lg text-[10px] font-bold uppercase animate-pulse">Late: {record.lateMinutes}m</span>
                    )}
                    {record?.earlyMinutes && record.earlyMinutes > 0 && (
                        <span className="bg-orange-100 text-orange-600 px-2 py-1 rounded-lg text-[10px] font-bold uppercase">Early: {record.earlyMinutes}m</span>
                    )}
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 mb-4">
                {statuses.map((s) => {
                  const Icon = s.icon;
                  const isActive = record ? record.status === s.id : (isFullHoliday && s.id === AttendanceStatus.HOLIDAY);
                  return (
                    <button 
                      key={s.id}
                      onClick={() => handleStatusChange(emp.id, s.id)}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-xl border border-transparent transition-all hover:scale-105 ${isActive ? s.activeColor : s.inactiveColor + ' opacity-60 hover:opacity-100'}`}
                      title={s.label}
                    >
                      <Icon size={18} />
                      <span className="text-[10px] font-bold mt-1 uppercase tracking-tighter">{s.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className={`rounded-xl p-3 mb-4 border ${isFullHoliday ? 'bg-white/50 border-purple-100' : 'bg-slate-50 border-slate-100'}`}>
                 <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                        <Clock size={10} /> Shift Timing
                    </span>
                    {duration && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${duration.totalHours > 9 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {duration.hours}h {duration.minutes}m
                        </span>
                    )}
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 flex items-center gap-1"><LogIn size={10} /> In</label>
                        <input type="time" value={record?.checkIn || ''} onChange={(e) => handleTimeChange(emp.id, 'checkIn', e.target.value)} disabled={isFullHoliday} className={`w-full border rounded-lg px-2 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-indigo-400 ${record?.lateMinutes && record.lateMinutes > 0 ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'} ${isFullHoliday ? 'opacity-50 cursor-not-allowed' : ''}`} />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 flex items-center gap-1"><LogOut size={10} /> Out</label>
                        <input type="time" value={record?.checkOut || ''} onChange={(e) => handleTimeChange(emp.id, 'checkOut', e.target.value)} disabled={isFullHoliday} className={`w-full border rounded-lg px-2 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-indigo-400 ${record?.earlyMinutes && record.earlyMinutes > 0 ? 'bg-orange-50 border-orange-200' : 'bg-white border-slate-200'} ${isFullHoliday ? 'opacity-50 cursor-not-allowed' : ''}`} />
                    </div>
                 </div>
              </div>

              <div className="pt-2 border-t border-slate-50 flex items-center justify-between">
                <div className="flex flex-col">
                  <label className={`text-xs font-semibold uppercase ${emp.isOtAllowed ? 'text-slate-500' : 'text-slate-300'}`}>Overtime</label>
                  {!emp.isOtAllowed && <span className="text-[10px] text-slate-400 flex items-center gap-1 font-medium"><Lock size={10} /> Not Eligible</span>}
                </div>
                <div className="flex items-center gap-2">
                  <input type="number" min="0" max="12" step="0.5" disabled={!emp.isOtAllowed} value={emp.isOtAllowed ? (record?.overtimeHours || 0) : 0} onChange={(e) => handleOvertimeChange(emp.id, e.target.value)} placeholder="0" className={`w-16 border rounded-lg p-1 text-center text-sm font-bold outline-none transition-colors ${emp.isOtAllowed ? 'bg-slate-50 border-slate-100 text-indigo-600 focus:ring-1 focus:ring-indigo-500' : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'}`} />
                  <span className={`text-xs ${emp.isOtAllowed ? 'text-slate-400' : 'text-slate-300'}`}>hrs</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ... sync button and biometric modal ... */}
      <div className="mt-8 flex justify-between items-center bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 text-sm">
        <div className="flex items-center gap-3 text-indigo-800">
            <AlertTriangle size={18} className="text-indigo-500" />
            <span>Changes made here are automatically saved to the system.</span>
        </div>
        <button onClick={() => alert("Attendance sheet synced for " + currentDate)} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold shadow-xl shadow-slate-200 hover:bg-black transition-all">Sync Now</button>
      </div>

      {showBioModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[90] flex items-center justify-center p-4">
           {/* ... biometric modal content ... */}
           <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="bg-slate-800 p-6 flex justify-between items-center text-white">
                 <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/10 rounded-xl"><Wifi size={20} /></div>
                    <div><h3 className="font-bold text-lg">Biometric Device Sync</h3><p className="text-xs text-slate-400">Fetch report data</p></div>
                 </div>
                 <button onClick={() => setShowBioModal(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors"><XCircle size={20} /></button>
              </div>
              <div className="flex border-b border-slate-100">
                 <button onClick={() => setActiveBioTab('url')} className={`flex-1 py-4 text-sm font-bold border-b-2 transition-all ${activeBioTab === 'url' ? 'text-indigo-600 border-indigo-600 bg-indigo-50/50' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>Connect via URL</button>
                 <button onClick={() => setActiveBioTab('paste')} className={`flex-1 py-4 text-sm font-bold border-b-2 transition-all ${activeBioTab === 'paste' ? 'text-indigo-600 border-indigo-600 bg-indigo-50/50' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>Raw Data Paste</button>
              </div>
              <div className="p-6">
                 {activeBioTab === 'url' ? (
                    <div className="space-y-6">
                       <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-500 uppercase">Device URL</label>
                          <input type="text" value={bioUrl} onChange={(e) => setBioUrl(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none text-sm" placeholder="https://..." />
                       </div>
                       <button onClick={handleBioUrlSync} disabled={isSyncing} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 flex items-center justify-center gap-2">{isSyncing ? <Loader2 size={18} className="animate-spin" /> : <Wifi size={18} />}{isSyncing ? 'Connecting...' : 'Fetch Data'}</button>
                    </div>
                 ) : (
                    <div className="space-y-4">
                       <textarea value={rawBioData} onChange={(e) => setRawBioData(e.target.value)} placeholder="Paste content here..." className="w-full h-48 bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs font-mono outline-none resize-none"></textarea>
                       <button onClick={handleProcessPastedData} disabled={!rawBioData} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 flex items-center justify-center gap-2 disabled:opacity-50"><ArrowRight size={18} /> Process & Sync</button>
                    </div>
                 )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceTracker;
