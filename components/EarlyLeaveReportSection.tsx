
import React, { useMemo } from 'react';
import {
  LogOut,
  AlertTriangle,
  TrendingDown,
  UserX,
  Search,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Employee, AttendanceRecord, Shift } from '../types';

interface Props {
  employees: Employee[];
  attendance: AttendanceRecord[];
  shifts: Shift[];
  startDate: string;
  endDate: string;
}

const EarlyLeaveReportSection: React.FC<Props> = ({ employees, attendance, shifts, startDate, endDate }) => {
  const [searchTerm, setSearchTerm] = React.useState('');

  const earlyData = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Deduplicate: keep only one record per employeeId+date
    const deduped = new Map<string, AttendanceRecord>();
    for (const r of attendance) {
      deduped.set(`${r.employeeId}-${r.date}`, r);
    }

    const records = Array.from(deduped.values()).filter(r => {
      const d = new Date(r.date);
      return d >= start && d <= end && r.status === 'PRESENT' && r.checkOut;
    });

    const earlies: any[] = [];

    records.forEach(record => {
      const emp = employees.find(e => e.id === record.employeeId);
      if (!emp || !record.checkOut) return;

      // Determine Shift End Time
      let shiftEnd = '17:30';
      let shiftName = 'General (Default)';
      let graceMinutes = 0;

      if (emp.shiftId) {
        const shift = shifts.find(s => s.id === emp.shiftId);
        if (shift) {
          shiftEnd = shift.endTime;
          shiftName = shift.name;
          graceMinutes = shift.gracePeriodMinutes || 0;
        }
      }

      const [sH, sM] = shiftEnd.split(':').map(Number);
      const [cH, cM] = record.checkOut.split(':').map(Number);

      const shiftEndMins  = sH * 60 + sM;
      const checkOutMins  = cH * 60 + cM;

      // Early if checked out before shift end
      if (checkOutMins < shiftEndMins) {
        const earlyDuration = shiftEndMins - checkOutMins;
        earlies.push({
          ...record,
          employeeName: emp.name,
          department:   emp.department,
          designation:  emp.designation,
          shiftEnd,
          shiftName,
          graceMinutes,
          earlyDuration, // minutes left early
        });
      }
    });

    return earlies.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [employees, attendance, shifts, startDate, endDate]);

  const filteredEarlyData = useMemo(() => {
    return earlyData.filter(item =>
      item.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.department.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [earlyData, searchTerm]);

  // Stats
  const stats = useMemo(() => {
    const totalOccurrences = earlyData.length;
    const totalMinutes     = earlyData.reduce((sum, item) => sum + item.earlyDuration, 0);
    const uniqueEmployees  = new Set(earlyData.map(l => l.employeeId)).size;

    const counts: Record<string, number> = {};
    earlyData.forEach(l => { counts[l.employeeName] = (counts[l.employeeName] || 0) + 1; });
    const sorted     = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const topOffender = sorted.length > 0 ? sorted[0] : null;

    return { totalOccurrences, totalMinutes, uniqueEmployees, topOffender };
  }, [earlyData]);

  // Chart: Early count by Department
  const chartData = useMemo(() => {
    const deptMap: Record<string, number> = {};
    earlyData.forEach(l => {
      deptMap[l.department] = (deptMap[l.department] || 0) + 1;
    });
    return Object.entries(deptMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [earlyData]);

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
            <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
              <LogOut size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800">Early Leaving Analysis</h3>
              <p className="text-sm text-slate-500">
                Early exit report from <span className="font-semibold">{new Date(startDate).toLocaleDateString()}</span> to <span className="font-semibold">{new Date(endDate).toLocaleDateString()}</span>
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
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 outline-none w-64"
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100">
            <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-1">Total Early Instances</p>
            <p className="text-3xl font-black text-orange-700">{stats.totalOccurrences}</p>
          </div>
          <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
            <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-1">Total Time Lost</p>
            <p className="text-3xl font-black text-amber-700">{formatDuration(stats.totalMinutes)}</p>
          </div>
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Employees Left Early</p>
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
                <p className="text-xs text-orange-500 font-bold">{stats.topOffender[1]} times</p>
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">No data</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Chart */}
          <div className="lg:col-span-1 h-[300px] bg-white border border-slate-100 rounded-2xl p-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 text-center">Early Exit Count by Department</h4>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 10 }} />
                  <Tooltip cursor={{ fill: '#fff7ed' }} />
                  <Bar dataKey="value" fill="#f97316" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">No data to display</div>
            )}
          </div>

          {/* Detailed Table */}
          <div className="lg:col-span-2 bg-white border border-slate-100 rounded-2xl overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <h4 className="font-bold text-slate-700">Detailed Early Exit Register</h4>
              <span className="text-xs font-bold bg-white px-2 py-1 rounded border border-slate-200 text-slate-500">{filteredEarlyData.length} Records</span>
            </div>
            <div className="overflow-y-auto max-h-[300px]">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 sticky top-0 z-10">
                  <tr className="text-xs font-bold text-slate-500 uppercase">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Shift</th>
                    <th className="px-4 py-3 text-center">Out Time</th>
                    <th className="px-4 py-3 text-right">Left Early By</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {filteredEarlyData.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400 italic">No early exits found.</td>
                    </tr>
                  ) : filteredEarlyData.map((item, idx) => (
                    <tr key={idx} className="border-b border-slate-50 hover:bg-orange-50/30 transition-colors">
                      <td className="px-4 py-3 text-slate-500 font-mono text-xs">{item.date}</td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-700">{item.employeeName}</div>
                        <div className="text-[10px] text-slate-400">{item.department}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs font-medium text-slate-600">{item.shiftName}</div>
                        <div className="text-[10px] text-slate-400">Ends {item.shiftEnd}</div>
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-slate-700">
                        {item.checkOut}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-bold">
                          {formatDuration(item.earlyDuration)}
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

export default EarlyLeaveReportSection;
