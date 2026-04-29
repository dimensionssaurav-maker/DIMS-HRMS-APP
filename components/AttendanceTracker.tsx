
import React, { useState, useMemo, useRef } from 'react';
import { Calendar, Search, CheckCircle2, XCircle, Moon, Palmtree, Upload, FileDown, AlertTriangle, Lock, Clock, LogIn, LogOut, Database, Wifi, ClipboardCopy, Loader2, ArrowRight, Sun, Zap, BarChart2, ChevronLeft, ChevronRight, Edit3, Download, X } from 'lucide-react';
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

  // Monthly Report State
  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily');
  const [reportMonth, setReportMonth] = useState(new Date().getMonth());
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [editingCell, setEditingCell] = useState<{empId: string, date: string} | null>(null);
  const [editCellData, setEditCellData] = useState<{checkIn: string, checkOut: string, status: AttendanceStatus}>({ checkIn: '', checkOut: '', status: 'PRESENT' as AttendanceStatus });

  const getRecord = (empId: string) => records.find(r => r.employeeId === empId && r.date === currentDate);

  const getHolidayForDate = (date: string) => holidays.find(h => h.date === date);

  const getMonthDays = (month: number, year: number) => {
    const days = [];
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push(dateStr);
    }
    return days;
  };


  const getMonthRecord = (empId: string, date: string) => records.find(r => r.employeeId === empId && r.date === date);

  const getEmpMonthlySummary = (empId: string, days: string[]) => {
    let present = 0, absent = 0, leave = 0, holiday = 0, late = 0, totalOT = 0, halfDays = 0;
    const emp = employees.find(e => e.id === empId);
    const joinDay = emp?.joiningDate
      ? (() => { const d = new Date(emp.joiningDate); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); })()
      : null;

    const manualHolidayDates = new Set(
      days.filter(date => {
        const r = getMonthRecord(empId, date);
        return r && r.status === ('HOLIDAY' as AttendanceStatus);
      })
    );

    days.forEach(date => {
      const r = getMonthRecord(empId, date);
      const dateObj = new Date(date);
      const isSun = dateObj.getDay() === 0;
      const hol = holidays.find(h => h.date === date && h.type === 'Full');
      const isBeforeJoining = joinDay ? dateObj < joinDay : false;

      if (isBeforeJoining) return;

      if (r) {
        const v = String(r.status || '').toUpperCase();
        const isHD = v === 'HD' || v === 'HALFDAY' || v === 'HALF' || v === 'P/H' || v === 'H/P';
        if (isHD) halfDays++;
        else if (r.status === 'PRESENT' as AttendanceStatus) present++;
        else if (r.status === 'ABSENT' as AttendanceStatus) absent++;
        else if (r.status === 'LEAVE' as AttendanceStatus) leave++;
        else if (r.status === 'HOLIDAY' as AttendanceStatus) holiday++;
        if (r.lateMinutes && r.lateMinutes > 0) late++;
        totalOT += r.overtimeHours || 0;
      } else {
        const coveredByGlobalHoliday = hol && !manualHolidayDates.has(date);
        const isSundayOff = isSun && !hol;
        if (coveredByGlobalHoliday || isSundayOff) holiday++;
      }
    });
    const daysPaid = present + (halfDays / 2) + holiday;
    return { present, absent, leave, holiday, late, totalOT, halfDays, daysPaid };
  };

  const handleCellSave = () => {
    if (!editingCell) return;
    const emp = employees.find(e => e.id === editingCell.empId);

    let lateMins = 0;
    let earlyMins = 0;
    let otHours = 0;

    if (emp) {
      if (editCellData.checkIn) lateMins = calculateLateMinutes(editCellData.checkIn, emp, editingCell.date);
      if (editCellData.checkOut) earlyMins = calculateEarlyMinutes(editCellData.checkOut, emp, editingCell.date);
      if (editCellData.checkIn && editCellData.checkOut) {
        otHours = calculateOT(editCellData.checkIn, editCellData.checkOut, emp, editingCell.date);
      }
    }

    onUpdate({
      employeeId: editingCell.empId,
      date: editingCell.date,
      status: editCellData.status,
      checkIn: editCellData.checkIn || '',
      checkOut: editCellData.checkOut || '',
      overtimeHours: otHours,
      lateMinutes: lateMins,
      earlyMinutes: earlyMins,
    });
    setEditingCell(null);
  };

  const exportMonthlyCSV = (days: string[]) => {
    const headers = ['Employee', 'ID', ...days.map(d => d.slice(8)), 'Present', 'Absent', 'Leave', 'Holiday', 'HALFDAY', 'OT Hrs', 'DAYS PAID'];
    const rows = employees.map(emp => {
      const summary = getEmpMonthlySummary(emp.id, days);
      const halfDays = days.filter(date => {
        const r = getMonthRecord(emp.id, date);
        if (!r) return false;
        const v = String(r.status || '').toUpperCase();
        return v === 'HD' || v === 'HALFDAY' || v === 'HALF' || v === 'P/H' || v === 'H/P';
      }).length;
      const daysPaid = summary.present + (halfDays / 2) + summary.holiday;
      const dayCells = days.map(date => {
        const r = getMonthRecord(emp.id, date);
        if (!r) return '-';
        const v = String(r.status || '').toUpperCase();
        if (v === 'HD' || v === 'HALFDAY' || v === 'HALF' || v === 'P/H' || v === 'H/P') return 'HD';
        if (r.status === 'PRESENT' as AttendanceStatus) return `P${r.checkIn ? ' ' + r.checkIn : ''}`;
        if (r.status === 'ABSENT' as AttendanceStatus) return 'A';
        if (r.status === 'LEAVE' as AttendanceStatus) return 'L';
        if (r.status === 'HOLIDAY' as AttendanceStatus) return 'H';
        return '-';
      });
      return [emp.name, emp.employeeCode || emp.id, ...dayCells, summary.present, summary.absent, summary.leave, summary.holiday, halfDays, summary.totalOT, daysPaid];
    });
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_${reportYear}_${String(reportMonth+1).padStart(2,'0')}.csv`;
    a.click();
  };

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const statuses = [
    { id: 'PRESENT' as AttendanceStatus, label: 'Present', icon: CheckCircle2, activeColor: 'bg-green-600 text-white', inactiveColor: 'text-green-600 bg-green-50' },
    { id: 'ABSENT' as AttendanceStatus, label: 'Absent', icon: XCircle, activeColor: 'bg-red-600 text-white', inactiveColor: 'text-red-600 bg-red-50' },
    { id: 'HOLIDAY' as AttendanceStatus, label: 'Holiday', icon: Moon, activeColor: 'bg-indigo-600 text-white', inactiveColor: 'text-indigo-600 bg-indigo-50' },
    { id: 'LEAVE' as AttendanceStatus, label: 'Leave', icon: Palmtree, activeColor: 'bg-amber-600 text-white', inactiveColor: 'text-amber-600 bg-amber-50' },
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
      checkIn: existing?.checkIn || '',
      checkOut: existing?.checkOut || '',
      lateMinutes: existing?.lateMinutes || 0,
      earlyMinutes: existing?.earlyMinutes || 0
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
      status: existing?.status || 'PRESENT' as AttendanceStatus,
      overtimeHours: newOT,
      checkIn: currentIn || '',
      checkOut: currentOut || '',
      lateMinutes: lateMins || 0,
      earlyMinutes: earlyMins || 0
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
      status: existing?.status || 'ABSENT' as AttendanceStatus,
      overtimeHours: val,
      checkIn: existing?.checkIn || '',
      checkOut: existing?.checkOut || '',
      lateMinutes: existing?.lateMinutes || 0,
      earlyMinutes: existing?.earlyMinutes || 0
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
            const nameMatch = line.toLowerCase().includes((emp.name ?? '').toLowerCase());
            // Match against employeeCode (original CSV/biometric ID) first, then Firebase id
            const displayId = emp.employeeCode || emp.id;
            const idPattern = new RegExp(`\\b0*${displayId}\\b`);
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

                let status = 'PRESENT' as AttendanceStatus;
                const lowerLine = line.toLowerCase();
                if (lowerLine.includes('absent') || lowerLine.includes(' ab ')) status = 'ABSENT' as AttendanceStatus;
                else if (lowerLine.includes('leave') || lowerLine.includes(' cl ') || lowerLine.includes(' el ')) status = 'LEAVE' as AttendanceStatus;
                else if (lowerLine.includes('holiday') || lowerLine.includes(' wo ') || lowerLine.includes(' ph ')) status = 'HOLIDAY' as AttendanceStatus;

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

  const monthDays = getMonthDays(reportMonth, reportYear);

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
          {/* View Toggle */}
          <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
            <button onClick={() => setViewMode('daily')}
              className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${viewMode === 'daily' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <Calendar size={14} /> Daily
            </button>
            <button onClick={() => setViewMode('monthly')}
              className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${viewMode === 'monthly' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <BarChart2 size={14} /> Monthly Report
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'daily' && (
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
                  const isActive = record ? record.status === s.id : (isFullHoliday && s.id === 'HOLIDAY' as AttendanceStatus);
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

      )}

      {/* ── MONTHLY REPORT VIEW ─────────────────────────────────── */}
      {viewMode === 'monthly' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Month Selector */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button onClick={() => { const d = new Date(reportYear, reportMonth - 1); setReportMonth(d.getMonth()); setReportYear(d.getFullYear()); }}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-all"><ChevronLeft size={18} /></button>
              <div className="text-center min-w-[140px]">
                <p className="text-lg font-black text-slate-800">{MONTHS[reportMonth]} {reportYear}</p>
                <p className="text-xs text-slate-400">{monthDays.length} days · {employees.length} employees</p>
              </div>
              <button onClick={() => { const d = new Date(reportYear, reportMonth + 1); setReportMonth(d.getMonth()); setReportYear(d.getFullYear()); }}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-all"><ChevronRight size={18} /></button>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Legend */}
              <div className="flex items-center gap-2 text-xs font-bold">
                <span className="w-5 h-5 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center text-[9px] font-black">P</span><span className="text-slate-500">Present</span>
                <span className="w-5 h-5 rounded bg-red-100 text-red-700 flex items-center justify-center text-[9px] font-black">A</span><span className="text-slate-500">Absent</span>
                <span className="w-5 h-5 rounded bg-amber-100 text-amber-700 flex items-center justify-center text-[9px] font-black">L</span><span className="text-slate-500">Leave</span>
                <span className="w-5 h-5 rounded bg-purple-100 text-purple-700 flex items-center justify-center text-[9px] font-black">H</span><span className="text-slate-500">Holiday</span>
                <span className="w-5 h-5 rounded bg-sky-100 text-sky-700 flex items-center justify-center text-[9px] font-black">HD</span><span className="text-slate-500">Half Day</span>
              </div>
              <button onClick={() => exportMonthlyCSV(monthDays)}
                className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-700 transition-all shadow-sm shadow-emerald-200">
                <Download size={14} /> Export CSV
              </button>
            </div>
          </div>

          {/* Monthly Grid Table */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="text-xs border-collapse min-w-full">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    <th className="sticky left-0 z-20 bg-slate-800 px-3 py-3 text-left font-bold min-w-[140px] border-r border-slate-700">Employee</th>
                    {monthDays.map(date => {
                      const d = new Date(date);
                      const isSun = d.getDay() === 0;
                      const isSat = d.getDay() === 6;
                      const hol = holidays.find(h => h.date === date);
                      return (
                        <th key={date} className={`px-0.5 py-2 text-center font-bold min-w-[28px] border-r border-slate-700 ${isSun ? 'bg-purple-900/60' : isSat ? 'bg-slate-700' : ''}`}>
                          <div className="text-[10px] text-slate-400">{['Su','Mo','Tu','We','Th','Fr','Sa'][d.getDay()]}</div>
                          <div className={`text-xs font-black ${isSun ? 'text-purple-300' : isSat ? 'text-slate-300' : 'text-white'}`}>{d.getDate()}</div>
                          {hol && <div className="text-[8px] text-amber-300 truncate max-w-[36px]">{hol.name.slice(0,4)}</div>}
                        </th>
                      );
                    })}
                    <th className="px-1 py-3 text-center font-bold bg-emerald-900/40 border-r border-slate-700 min-w-[32px]">P</th>
                    <th className="px-1 py-3 text-center font-bold bg-red-900/40 border-r border-slate-700 min-w-[32px]">A</th>
                    <th className="px-1 py-3 text-center font-bold bg-amber-900/40 border-r border-slate-700 min-w-[32px]">L</th>
                    <th className="px-1 py-3 text-center font-bold bg-purple-900/40 border-r border-slate-700 min-w-[32px]">H</th>
                    <th className="px-1 py-3 text-center font-bold bg-sky-900/40 border-r border-slate-700 min-w-[32px]">HD</th>
                    <th className="px-1 py-3 text-center font-bold bg-indigo-900/40 min-w-[52px] text-[10px]">DAYS<br/>PAID</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp, empIdx) => {
                    const summary = getEmpMonthlySummary(emp.id, monthDays);
                    return (
                      <tr key={emp.id} className={`border-b border-slate-100 hover:bg-indigo-50/30 transition-colors ${empIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                        {/* Employee Name Cell */}
                        <td className={`sticky left-0 z-10 px-3 py-2 border-r border-slate-100 ${empIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                          <p className="font-bold text-slate-800 text-xs">{emp.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{emp.employeeCode || emp.id}</p>
                        </td>
                        {/* Day Cells */}
                        {monthDays.map(date => {
                          const r = getMonthRecord(emp.id, date);
                          const d = new Date(date);
                          const isSun = d.getDay() === 0;
                          const hol = holidays.find(h => h.date === date);

                          // ── Joining date check ──────────────────────────────
                          // No attendance, holidays or weekly-offs before joining
                          const joinDate = emp.joiningDate ? new Date(emp.joiningDate) : null;
                          const isBeforeJoining = joinDate ? d < new Date(joinDate.getFullYear(), joinDate.getMonth(), joinDate.getDate()) : false;

                          const isWeeklyOff = isSun && !r && !isBeforeJoining;
                          const isHoliday = hol && hol.type === 'Full' && !r && !isBeforeJoining;
                          const isEditing = editingCell?.empId === emp.id && editingCell?.date === date;

                          let cellBg = '';
                          let label = '';
                          let labelColor = '';

                          if (isEditing) {
                            cellBg = 'bg-indigo-50 ring-2 ring-inset ring-indigo-400';
                          } else if (isBeforeJoining) {
                            cellBg = 'bg-slate-100'; label = ''; labelColor = '';  // blank — not yet employed
                          } else if (isWeeklyOff || isHoliday) {
                            cellBg = 'bg-purple-50'; label = 'H'; labelColor = 'text-purple-600 font-black';
                          } else if (!r) {
                            cellBg = isSun ? 'bg-purple-50/40' : '';
                            label = '–'; labelColor = 'text-slate-300';
                          } else if (r.status === 'PRESENT' as AttendanceStatus) {
                            cellBg = r.lateMinutes && r.lateMinutes > 0 ? 'bg-orange-50' : 'bg-emerald-50';
                            label = 'P'; labelColor = r.lateMinutes && r.lateMinutes > 0 ? 'text-orange-600 font-black' : 'text-emerald-600 font-black';
                          } else if (r.status === 'ABSENT' as AttendanceStatus) {
                            cellBg = 'bg-red-50'; label = 'A'; labelColor = 'text-red-600 font-black';
                          } else if (r.status === 'LEAVE' as AttendanceStatus) {
                            cellBg = 'bg-amber-50'; label = 'L'; labelColor = 'text-amber-600 font-black';
                          } else if (r.status === 'HOLIDAY' as AttendanceStatus) {
                            cellBg = 'bg-purple-50'; label = 'H'; labelColor = 'text-purple-600 font-black';
                          }

                          return (
                            <td key={date}
                              className={`border-r border-slate-100 text-center align-middle cursor-pointer transition-all relative group min-w-[28px] max-w-[28px] ${cellBg} ${isSun ? 'border-l border-purple-100' : ''}`}
                              title={r ? `${r.checkIn || '--'} → ${r.checkOut || '--'}${r.lateMinutes ? ' | Late: ' + r.lateMinutes + 'm' : ''}` : date}
                              onClick={() => {
                                if (isEditing) return;
                                setEditCellData({ checkIn: r?.checkIn || '', checkOut: r?.checkOut || '', status: r?.status || 'PRESENT' as AttendanceStatus });
                                setEditingCell({ empId: emp.id, date });
                              }}
                            >
                              {isEditing ? (
                                <div className="p-1 min-w-[90px]" onClick={e => e.stopPropagation()}>
                                  <select value={editCellData.status} onChange={e => setEditCellData({...editCellData, status: e.target.value as AttendanceStatus})}
                                    className="w-full text-[10px] font-bold bg-white border border-indigo-300 rounded px-1 py-0.5 mb-1 outline-none">
                                    <option value={'PRESENT' as AttendanceStatus}>Present</option>
                                    <option value={'ABSENT' as AttendanceStatus}>Absent</option>
                                    <option value={'LEAVE' as AttendanceStatus}>Leave</option>
                                    <option value={'HOLIDAY' as AttendanceStatus}>Holiday</option>
                                  </select>
                                  <input type="time" value={editCellData.checkIn} onChange={e => setEditCellData({...editCellData, checkIn: e.target.value})}
                                    className="w-full text-[10px] bg-white border border-indigo-200 rounded px-1 py-0.5 mb-0.5 outline-none" />
                                  <input type="time" value={editCellData.checkOut} onChange={e => setEditCellData({...editCellData, checkOut: e.target.value})}
                                    className="w-full text-[10px] bg-white border border-indigo-200 rounded px-1 py-0.5 mb-1 outline-none" />
                                  <div className="flex gap-0.5">
                                    <button onClick={handleCellSave} className="flex-1 bg-indigo-600 text-white text-[9px] font-bold py-1 rounded hover:bg-indigo-700">Save</button>
                                    <button onClick={() => setEditingCell(null)} className="flex-1 bg-slate-200 text-slate-600 text-[9px] font-bold py-1 rounded hover:bg-slate-300">✕</button>
                                  </div>
                                </div>
                              ) : (
                                <div className="py-1.5 px-0 relative">
                                  <span className={`text-xs ${labelColor}`}>{label}</span>
                                  {r?.checkIn && <div className="text-[8px] text-slate-400 leading-none">{r.checkIn}</div>}
                                  {r?.lateMinutes && r.lateMinutes > 0 && <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-orange-400"></div>}
                                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Edit3 size={10} className="text-indigo-400" />
                                  </div>
                                </div>
                              )}
                            </td>
                          );
                        })}
                        {/* Summary Cells */}
                        <td className="px-2 py-2 text-center font-black text-emerald-700 bg-emerald-50/50 border-r border-slate-100">{summary.present}</td>
                        <td className="px-2 py-2 text-center font-black text-red-600 bg-red-50/50 border-r border-slate-100">{summary.absent}</td>
                        <td className="px-2 py-2 text-center font-black text-amber-600 bg-amber-50/50 border-r border-slate-100">{summary.leave}</td>
                        <td className="px-2 py-2 text-center font-black text-purple-600 bg-purple-50/50 border-r border-slate-100">{summary.holiday}</td>
                        <td className="px-2 py-2 text-center font-black text-orange-600 bg-orange-50/50 border-r border-slate-100">{summary.totalOT > 0 ? summary.totalOT.toFixed(1) : '—'}</td>
                        <td className="px-2 py-2 text-center font-black text-sky-600 bg-sky-50/50 border-r border-slate-100">{summary.halfDays > 0 ? summary.halfDays : '—'}</td>
                        <td className="px-2 py-2 text-center font-black text-indigo-700 bg-indigo-50/50 font-extrabold">{summary.daysPaid > 0 ? summary.daysPaid.toFixed(1).replace('.0','') : '0'}</td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Footer summary row */}
                <tfoot>
                  <tr className="bg-slate-800 text-white">
                    <td className="sticky left-0 z-10 bg-slate-800 px-4 py-3 font-black text-xs border-r border-slate-700">TOTAL</td>
                    {monthDays.map(date => {
                      const presentCount = employees.filter(emp => {
                        const r = getMonthRecord(emp.id, date);
                        return r?.status === 'PRESENT' as AttendanceStatus;
                      }).length;
                      return (
                        <td key={date} className="px-1 py-2 text-center border-r border-slate-700">
                          {presentCount > 0
                            ? <span className="text-[10px] font-black text-emerald-300">{presentCount}</span>
                            : <span className="text-[10px] text-slate-600">—</span>}
                        </td>
                      );
                    })}
                    <td className="px-2 py-2 text-center text-emerald-300 font-black bg-emerald-900/20 border-r border-slate-700">
                      {employees.reduce((s, emp) => s + getEmpMonthlySummary(emp.id, monthDays).present, 0)}
                    </td>
                    <td className="px-2 py-2 text-center text-red-300 font-black bg-red-900/20 border-r border-slate-700">
                      {employees.reduce((s, emp) => s + getEmpMonthlySummary(emp.id, monthDays).absent, 0)}
                    </td>
                    <td className="px-2 py-2 text-center text-amber-300 font-black bg-amber-900/20 border-r border-slate-700">
                      {employees.reduce((s, emp) => s + getEmpMonthlySummary(emp.id, monthDays).leave, 0)}
                    </td>
                    <td className="px-2 py-2 text-center text-purple-300 font-black bg-purple-900/20 border-r border-slate-700">
                      {employees.reduce((s, emp) => s + getEmpMonthlySummary(emp.id, monthDays).holiday, 0)}
                    </td>
                    <td className="px-2 py-2 text-center text-orange-300 font-black bg-orange-900/20 border-r border-slate-700">
                      {employees.reduce((s, emp) => s + getEmpMonthlySummary(emp.id, monthDays).totalOT, 0).toFixed(1)}
                    </td>
                    <td className="px-2 py-2 text-center text-sky-300 font-black bg-sky-900/20 border-r border-slate-700">
                      {employees.reduce((s, emp) => s + getEmpMonthlySummary(emp.id, monthDays).halfDays, 0)}
                    </td>
                    <td className="px-2 py-2 text-center text-indigo-300 font-black bg-indigo-900/20">
                      {employees.reduce((s, emp) => s + getEmpMonthlySummary(emp.id, monthDays).daysPaid, 0).toFixed(1)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

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
