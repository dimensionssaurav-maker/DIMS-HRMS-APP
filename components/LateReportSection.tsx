
import React, { useMemo } from 'react';
import { 
  Clock, 
  AlertTriangle, 
  TrendingDown, 
  UserX,
  Search,
  Download,
  Calendar
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Employee, AttendanceRecord, Shift } from '../types';

interface Props {
  employees: Employee[];
  attendance: AttendanceRecord[];
  shifts: Shift[];
  startDate: string;
  endDate: string;
}

const LateReportSection: React.FC<Props> = ({ employees, attendance, shifts, startDate, endDate }) => {
  const [searchTerm, setSearchTerm] = React.useState('');

  const lateData = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const records = attendance.filter(r => {
      const d = new Date(r.date);
      return d >= start && d <= end && r.status === 'PRESENT' && r.checkIn;
    });

    const lates: any[] = [];

    records.forEach(record => {
        const emp = employees.find(e => e.id === record.employeeId);
        if (!emp || !record.checkIn) return;

        // Determine Shift Rules
        let shiftStart = '09:00';
        let graceMinutes = 15;
        let shiftName = 'General (Default)';

        if (emp.shiftId) {
            const shift = shifts.find(s => s.id === emp.shiftId);
            if (shift) {
                shiftStart = shift.startTime;
                graceMinutes = shift.gracePeriodMinutes;
                shiftName = shift.name;
            }
        }

        // Calculate Late
        const [sH, sM] = shiftStart.split(':').map(Number);
        const [cH, cM] = record.checkIn.split(':').map(Number);

        const shiftStartMins = sH * 60 + sM;
        const checkInMins = cH * 60 + cM;
        const graceLimit = shiftStartMins + graceMinutes;

        if (checkInMins > graceLimit) {
            const lateDuration = checkInMins - shiftStartMins;
            lates.push({
                ...record,
                employeeName: emp.name,
                department: emp.department,
                designation: emp.designation,
                shiftStart,
                shiftName,
                graceMinutes,
                lateDuration, // Minutes late relative to start time
                actualLate: checkInMins - graceLimit // Minutes past grace period (if needed for stricter calc)
            });
        }
    });

    return lates.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [employees, attendance, shifts, startDate, endDate]);

  const filteredLateData = useMemo(() => {
      return lateData.filter(item => 
        item.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.department.toLowerCase().includes(searchTerm.toLowerCase())
      );
  }, [lateData, searchTerm]);

  // Stats
  const stats = useMemo(() => {
      const totalOccurrences = lateData.length;
      const totalMinutes = lateData.reduce((sum, item) => sum + item.lateDuration, 0);
      const uniqueEmployees = new Set(lateData.map(l => l.employeeId)).size;
      
      // Top Offender
      const counts: Record<string, number> = {};
      lateData.forEach(l => { counts[l.employeeName] = (counts[l.employeeName] || 0) + 1; });
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      const topOffender = sorted.length > 0 ? sorted[0] : null;

      return { totalOccurrences, totalMinutes, uniqueEmployees, topOffender };
  }, [lateData]);

  // Chart Data: Late count by Department
  const chartData = useMemo(() => {
      const deptMap: Record<string, number> = {};
      lateData.forEach(l => {
          deptMap[l.department] = (deptMap[l.department] || 0) + 1;
      });
      return Object.entries(deptMap)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
  }, [lateData]);

  const formatDuration = (mins: number) => {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      if (h > 0) return `${h}h ${m}m`;
      return `${m}m`;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
       <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
             <div className="flex items-center gap-3">
                <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
                   <Clock size={24} />
                </div>
                <div>
                   <h3 className="text-xl font-bold text-slate-800">Late Arrival Analysis</h3>
                   <p className="text-sm text-slate-500">
                      Punctuality report from <span className="font-semibold">{new Date(startDate).toLocaleDateString()}</span> to <span className="font-semibold">{new Date(endDate).toLocaleDateString()}</span>
                   </p>
                </div>
             </div>
             
             <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                   type="text" 
                   placeholder="Search employee..."
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                   className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-rose-500 outline-none w-64"
                />
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
             <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100">
                <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-1">Total Late Instances</p>
                <p className="text-3xl font-black text-rose-700">{stats.totalOccurrences}</p>
             </div>
             <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100">
                <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-1">Total Time Lost</p>
                <p className="text-3xl font-black text-orange-700">{formatDuration(stats.totalMinutes)}</p>
             </div>
             <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Employees Late</p>
                <div className="flex items-center gap-2">
                   <UserX size={20} className="text-slate-600" />
                   <p className="text-3xl font-black text-slate-800">{stats.uniqueEmployees}</p>
                </div>
             </div>
             <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Most Frequent</p>
                {stats.topOffender ? (
                    <div>
                        <p className="text-lg font-bold text-slate-800 truncate">{stats.topOffender[0]}</p>
                        <p className="text-xs text-rose-500 font-bold">{stats.topOffender[1]} times</p>
                    </div>
                ) : (
                    <p className="text-sm text-slate-400 italic">No data</p>
                )}
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
             {/* Chart */}
             <div className="lg:col-span-1 h-[300px] bg-white border border-slate-100 rounded-2xl p-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 text-center">Late Count by Department</h4>
                {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="90%">
                        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                            <XAxis type="number" hide />
                            <YAxis type="category" dataKey="name" width={80} tick={{fontSize: 10}} />
                            <Tooltip cursor={{fill: '#fff1f2'}} />
                            <Bar dataKey="value" fill="#f43f5e" radius={[0, 4, 4, 0]} barSize={20} />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex items-center justify-center text-slate-400 text-xs">No data to display</div>
                )}
             </div>

             {/* Detailed Table */}
             <div className="lg:col-span-2 bg-white border border-slate-100 rounded-2xl overflow-hidden flex flex-col">
                <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                   <h4 className="font-bold text-slate-700">Detailed Late Register</h4>
                   <span className="text-xs font-bold bg-white px-2 py-1 rounded border border-slate-200 text-slate-500">{filteredLateData.length} Records</span>
                </div>
                <div className="overflow-y-auto max-h-[300px]">
                   <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50 sticky top-0 z-10">
                         <tr className="text-xs font-bold text-slate-500 uppercase">
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3">Employee</th>
                            <th className="px-4 py-3">Shift</th>
                            <th className="px-4 py-3 text-center">In Time</th>
                            <th className="px-4 py-3 text-right">Late By</th>
                         </tr>
                      </thead>
                      <tbody className="text-sm">
                         {filteredLateData.length === 0 ? (
                            <tr>
                               <td colSpan={5} className="px-4 py-8 text-center text-slate-400 italic">No late arrivals found.</td>
                            </tr>
                         ) : filteredLateData.map((item, idx) => (
                            <tr key={idx} className="border-b border-slate-50 hover:bg-rose-50/30 transition-colors">
                               <td className="px-4 py-3 text-slate-500 font-mono text-xs">{item.date}</td>
                               <td className="px-4 py-3">
                                  <div className="font-bold text-slate-700">{item.employeeName}</div>
                                  <div className="text-[10px] text-slate-400">{item.department}</div>
                               </td>
                               <td className="px-4 py-3">
                                  <div className="text-xs font-medium text-slate-600">{item.shiftName}</div>
                                  <div className="text-[10px] text-slate-400">{item.shiftStart} (+{item.graceMinutes}m grace)</div>
                               </td>
                               <td className="px-4 py-3 text-center font-bold text-slate-700">
                                  {item.checkIn}
                               </td>
                               <td className="px-4 py-3 text-right">
                                  <span className="bg-rose-100 text-rose-700 px-2 py-1 rounded text-xs font-bold">
                                     {formatDuration(item.lateDuration)}
                                  </span>
                               </td>
                            </tr>
                         ))}
                      </tbody>
                   </table>
                </div>
             </div>
          </div>
       </div>
    </div>
  );
};

export default LateReportSection;
