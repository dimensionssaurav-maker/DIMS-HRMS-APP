
import React, { useState, useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { 
  Clock, 
  Filter, 
  Download, 
  IndianRupee, 
  TrendingUp, 
  Search,
  Loader2,
  Calendar,
  AlertTriangle,
  User,
  AlertCircle
} from 'lucide-react';
import { Employee, AttendanceRecord, PayrollConfig } from '../types';

interface Props {
  employees: Employee[];
  attendanceRecords: AttendanceRecord[];
  departments: string[];
  startDate: string;
  endDate: string;
  onDateChange: (start: string, end: string) => void;
  payrollConfig: PayrollConfig;
}

const OvertimeModule: React.FC<Props> = ({ employees, attendanceRecords, departments, startDate, endDate, onDateChange, payrollConfig }) => {
  const [departmentFilter, setDepartmentFilter] = useState('All Departments');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [isExporting, setIsExporting] = useState<string | null>(null);

  // Filter Data
  const filteredData = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Safety check for invalid dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return [];

    // 1. Filter Records by Date Range
    const recordsInPeriod = attendanceRecords.filter(r => {
      const d = new Date(r.date);
      return d >= start && d <= end && r.overtimeHours > 0;
    });

    // 2. Join with Employee Data and Filter by Dept/Search
    const joinedData = recordsInPeriod.map(r => {
      const emp = employees.find(e => e.id === r.employeeId);
      if (!emp) return null;
      
      // Calculate Rate on the fly based on Config
      const hourlyRate = (emp.dailyWage / 8);
      // Use override if exists, else global
      const multiplier = payrollConfig.designationOverrides[emp.designation] ?? payrollConfig.globalOtMultiplier;
      
      const otRate = hourlyRate * multiplier;
      
      // Tiered OT Logic Implementation
      let payableHours = r.overtimeHours;
      let isTieredApplied = false;

      if (payrollConfig.otConfig?.enabled && payrollConfig.otConfig.rules && payrollConfig.otConfig.rules.length > 0) {
          const otMinutes = r.overtimeHours * 60;
          const applicableRules = payrollConfig.otConfig.rules.filter(rule => 
              rule.enabled && (rule.department === 'All Departments' || rule.department === emp.department)
          );
          
          // Sort by Threshold DESC
          const sortedRules = applicableRules.sort((a, b) => b.thresholdMinutes - a.thresholdMinutes);
          const matchedRule = sortedRules.find(rule => otMinutes >= rule.thresholdMinutes);
          
          if (matchedRule) {
              payableHours = matchedRule.payoutAmount;
              isTieredApplied = true;
          }
      }

      const otAmount = emp.isOtAllowed ? Math.round(payableHours * otRate) : 0;

      // Fooding Calculation
      let foodingAmount = 0;
      // Check if fooding is enabled and employee met the hour threshold (using actual hours usually)
      if (emp.isOtAllowed && payrollConfig.foodingConfig.enabled) {
          // Check for department override
          const deptRule = payrollConfig.foodingConfig.departmentOverrides?.[emp.department];
          const minHours = deptRule ? deptRule.minHours : payrollConfig.foodingConfig.minHours;
          const allowance = deptRule ? deptRule.amount : payrollConfig.foodingConfig.amount;

          if (r.overtimeHours >= minHours) {
              foodingAmount = allowance;
          }
      }

      return {
        ...r,
        employeeName: emp.name,
        department: emp.department,
        designation: emp.designation,
        isOtAllowed: emp.isOtAllowed,
        multiplier,
        otRate,
        payableHours,
        isTieredApplied,
        otAmount,
        foodingAmount,
        totalCost: otAmount + foodingAmount
      };
    }).filter(Boolean) as any[];

    // 3. Apply User Filters
    return joinedData.filter(item => {
      const matchDept = departmentFilter === 'All Departments' || item.department === departmentFilter;
      const matchSearch = (item.employeeName ?? '').toLowerCase().includes(employeeSearch.toLowerCase()) || 
                          (item.employeeId ?? '').toLowerCase().includes(employeeSearch.toLowerCase());
      return matchDept && matchSearch;
    });
  }, [attendanceRecords, employees, startDate, endDate, departmentFilter, employeeSearch, payrollConfig]);

  // Aggregates for KPI
  const stats = useMemo(() => {
    return filteredData.reduce((acc, curr) => ({
      totalHours: acc.totalHours + curr.overtimeHours,
      totalPayableHours: acc.totalPayableHours + curr.payableHours,
      totalOtCost: acc.totalOtCost + curr.otAmount,
      totalFoodingCost: acc.totalFoodingCost + curr.foodingAmount,
      totalCost: acc.totalCost + curr.totalCost,
      uniqueEmployees: new Set([...Array.from(acc.uniqueEmployees), curr.employeeId]).size
    }), { totalHours: 0, totalPayableHours: 0, totalOtCost: 0, totalFoodingCost: 0, totalCost: 0, uniqueEmployees: 0 as any });
  }, [filteredData]);

  // Employee Aggregates for Leaderboard
  const employeeStats = useMemo(() => {
    const map = new Map<string, { 
      id: string; 
      name: string; 
      department: string; 
      hours: number; 
      cost: number;
      designation: string;
    }>();

    filteredData.forEach(d => {
      if (!map.has(d.employeeId)) {
        map.set(d.employeeId, {
          id: d.employeeId,
          name: d.employeeName,
          department: d.department,
          hours: 0,
          cost: 0,
          designation: d.designation
        });
      }
      const entry = map.get(d.employeeId)!;
      entry.hours += d.overtimeHours; // Track Actual Hours for leaderboard activity
      entry.cost += d.totalCost;
    });

    return Array.from(map.values()).sort((a, b) => b.hours - a.hours);
  }, [filteredData]);

  const maxTotalHours = useMemo(() => Math.max(...employeeStats.map(e => e.hours), 1), [employeeStats]);
  const maxDailyHours = useMemo(() => Math.max(...filteredData.map(d => d.overtimeHours), 1), [filteredData]);

  // Chart Data: Hours by Department
  const chartData = useMemo(() => {
    const deptMap = new Map();
    filteredData.forEach(d => {
      deptMap.set(d.department, (deptMap.get(d.department) || 0) + d.overtimeHours);
    });
    return Array.from(deptMap.entries()).map(([name, value]) => ({ name, value }));
  }, [filteredData]);

  const handleExport = (type: 'csv' | 'pdf') => {
      setIsExporting(type);
      setTimeout(() => {
        if (type === 'csv') {
          const headers = ['Date', 'Employee ID', 'Name', 'Department', 'Actual OT Hours', 'Payable Hours', 'Multiplier', 'OT Pay', 'Fooding', 'Total Cost', 'Status'];
          const rows = filteredData.map(d => [
              d.date,
              d.employeeId,
              `"${d.employeeName}"`,
              `"${d.department}"`,
              d.overtimeHours,
              d.payableHours,
              d.multiplier + 'x',
              d.otAmount,
              d.foodingAmount,
              d.totalCost,
              d.isOtAllowed ? 'Approved' : 'Not Allowed'
          ]);
          const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
          const blob = new Blob([csvContent], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `OT_Report_${startDate}_${endDate}.csv`;
          link.click();
        } else {
          alert("Overtime Report exported as PDF");
        }
        setIsExporting(null);
      }, 1000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-2 w-full md:w-auto">
           <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200 w-full md:w-auto">
              <div className="flex items-center px-2 gap-2 text-slate-500 border-r border-slate-200">
                  <Calendar size={18} />
              </div>
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => onDateChange(e.target.value, endDate)}
                className="bg-white border border-slate-200 text-sm font-bold text-slate-700 py-1.5 px-3 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer shadow-sm min-w-[140px]"
              />
              <span className="text-slate-400 font-bold">-</span>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => onDateChange(startDate, e.target.value)}
                className="bg-white border border-slate-200 text-sm font-bold text-slate-700 py-1.5 px-3 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer shadow-sm min-w-[140px]"
              />
           </div>
        </div>
        
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
           <div className="relative flex-1 md:flex-none">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
             <input 
               type="text" 
               placeholder="Search employee..."
               value={employeeSearch}
               onChange={e => setEmployeeSearch(e.target.value)}
               className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none md:w-48"
             />
           </div>
           
           <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 flex-1 md:flex-none">
             <Filter size={16} className="text-slate-400 ml-2" />
             <select 
               value={departmentFilter}
               onChange={e => setDepartmentFilter(e.target.value)}
               className="bg-transparent text-sm font-semibold text-slate-700 py-1.5 pr-4 pl-2 outline-none cursor-pointer w-full md:w-auto"
             >
               {departments.map(d => <option key={d} value={d}>{d}</option>)}
             </select>
           </div>

           <button 
             onClick={() => handleExport('csv')}
             disabled={!!isExporting}
             className="px-4 py-2 bg-amber-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-amber-700 transition-colors shadow-lg shadow-amber-200 whitespace-nowrap"
           >
             {isExporting === 'csv' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
             Export CSV
           </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100 col-span-2">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-1">Total OT + Fooding Cost</p>
                    <div className="flex items-center gap-2">
                        <IndianRupee size={28} className="text-amber-700" />
                        <p className="text-4xl font-black text-slate-800">{stats.totalCost.toLocaleString()}</p>
                    </div>
                </div>
                <div className="text-right space-y-1">
                     <div className="text-xs font-medium text-amber-700 bg-amber-100/50 px-2 py-1 rounded-lg">
                        OT Pay: ₹{stats.totalOtCost.toLocaleString()}
                     </div>
                     <div className="text-xs font-medium text-orange-700 bg-orange-100/50 px-2 py-1 rounded-lg">
                        Fooding: ₹{stats.totalFoodingCost.toLocaleString()}
                     </div>
                </div>
            </div>
         </div>
         
         <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Hours Logged</p>
            <div className="flex items-center gap-2">
               <Clock size={24} className="text-indigo-600" />
               <p className="text-3xl font-black text-slate-800">{stats.totalHours}</p>
               <span className="text-sm font-bold text-slate-400 self-end mb-1">hrs</span>
            </div>
            {stats.totalPayableHours > stats.totalHours && (
                <p className="text-[10px] text-emerald-600 font-bold mt-1">
                    Paid for {stats.totalPayableHours} hrs (Tiered)
                </p>
            )}
         </div>

         <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Employees Contributing</p>
            <div className="flex items-center gap-2">
               <TrendingUp size={24} className="text-emerald-600" />
               <p className="text-3xl font-black text-slate-800">{stats.uniqueEmployees}</p>
            </div>
         </div>
      </div>

      {/* Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm min-h-[300px]">
            <h4 className="font-bold text-slate-700 mb-6">OT Hours by Department</h4>
            {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} tickFormatter={(val) => val.split(' ')[0]} />
                    <YAxis axisLine={false} tickLine={false} fontSize={12} />
                    <Tooltip cursor={{fill: '#fef3c7'}} contentStyle={{borderRadius: '8px', border: 'none'}} />
                    <Bar dataKey="value" fill="#d97706" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
                </ResponsiveContainer>
            ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">No data available for range</div>
            )}
         </div>

         {/* Top Employees Leaderboard */}
         <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm min-h-[300px] flex flex-col">
            <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
               <User size={18} className="text-indigo-600"/> Top Contributors
            </h4>
            {employeeStats.length > 0 ? (
               <div className="space-y-4 overflow-y-auto custom-scrollbar flex-1 pr-2">
                  {employeeStats.slice(0, 6).map((emp, index) => (
                     <div key={emp.id} className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 w-1/3">
                           <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${index < 3 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                              {index + 1}
                           </div>
                           <div className="truncate">
                              <p className="text-xs font-bold text-slate-700 truncate">{emp.name}</p>
                              <p className="text-[9px] text-slate-400 uppercase">{emp.department}</p>
                           </div>
                        </div>
                        <div className="flex-1 space-y-1">
                           <div className="flex justify-between text-[10px] font-medium text-slate-500">
                              <span>{emp.hours} hrs</span>
                              <span>₹{emp.cost.toLocaleString()}</span>
                           </div>
                           <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
                              <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${(emp.hours / maxTotalHours) * 100}%` }}></div>
                           </div>
                        </div>
                     </div>
                  ))}
               </div>
            ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">No employee data found</div>
            )}
         </div>
      </div>

      {/* Detailed Register Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
         <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <h3 className="font-bold text-slate-700">Detailed OT Register</h3>
            <span className="text-xs font-bold text-slate-400 bg-white px-2 py-1 rounded border border-slate-200">
               {filteredData.length} records
            </span>
         </div>
         <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left">
               <thead className="bg-white sticky top-0 z-10">
                  <tr className="text-xs font-bold text-slate-500 uppercase border-b border-slate-100">
                     <th className="px-6 py-4">Date</th>
                     <th className="px-6 py-4">Employee</th>
                     <th className="px-6 py-4 w-48">Hours Logged</th>
                     <th className="px-6 py-4 text-right">Payable Hrs</th>
                     <th className="px-6 py-4 text-right">Rate/Hr</th>
                     <th className="px-6 py-4 text-right">OT Pay</th>
                     <th className="px-6 py-4 text-right">Fooding</th>
                     <th className="px-6 py-4 text-right">Total Cost</th>
                     <th className="px-6 py-4 text-center">Status</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-50 text-sm">
                  {filteredData.length === 0 ? (
                     <tr>
                        <td colSpan={9} className="px-6 py-12 text-center text-slate-400 italic">No overtime records found for this period.</td>
                     </tr>
                  ) : filteredData.map((item, idx) => (
                     <tr key={idx} className="hover:bg-amber-50/30 transition-colors group">
                        <td className="px-6 py-4 text-slate-500 font-mono text-xs">{item.date}</td>
                        <td className="px-6 py-4">
                           <div className="font-bold text-slate-700">{item.employeeName}</div>
                           <div className="text-[10px] text-slate-400">{item.department}</div>
                        </td>
                        <td className="px-6 py-4">
                           <div className="flex items-center gap-3">
                              <span className="font-bold text-slate-700 w-8 text-right">{item.overtimeHours}</span>
                              <div className="flex-1 h-1.5 bg-slate-100 rounded-full w-20 overflow-hidden relative">
                                 <div 
                                    className={`h-full rounded-full ${
                                       item.overtimeHours > 4 ? 'bg-rose-500' : 
                                       item.overtimeHours > 2 ? 'bg-amber-500' : 'bg-emerald-500'
                                    }`}
                                    style={{ width: `${Math.min((item.overtimeHours / maxDailyHours) * 100, 100)}%` }}
                                 ></div>
                              </div>
                              {item.overtimeHours > 4 && (
                                 <div className="group/tooltip relative">
                                    <AlertTriangle size={14} className="text-rose-500 cursor-help" />
                                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tooltip:block bg-slate-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-20 shadow-lg">High OT Risk</span>
                                 </div>
                              )}
                           </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                            <span className={`font-bold ${item.isTieredApplied ? 'text-indigo-600' : 'text-slate-500'}`}>
                                {item.payableHours}
                            </span>
                            {item.isTieredApplied && <span className="text-[9px] text-white bg-indigo-500 px-1 rounded ml-1">Rule</span>}
                        </td>
                        <td className="px-6 py-4 text-right text-slate-500">
                           <div className="flex flex-col items-end">
                              <span>₹{item.otRate.toFixed(0)}</span>
                              <span className="text-[9px] text-slate-400 bg-slate-100 px-1 rounded">{item.multiplier}x</span>
                           </div>
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-slate-600">
                           {item.isOtAllowed ? `₹${item.otAmount}` : <span className="text-slate-300">₹0</span>}
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-orange-600">
                           {item.foodingAmount > 0 ? `+₹${item.foodingAmount}` : <span className="text-slate-200">-</span>}
                        </td>
                        <td className="px-6 py-4 text-right">
                           <span className={`font-black ${item.totalCost > 1000 ? 'text-indigo-600' : 'text-slate-800'}`}>
                              {item.isOtAllowed ? `₹${item.totalCost}` : <span className="text-slate-300">₹0</span>}
                           </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                           {item.isOtAllowed ? (
                              <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-[10px] font-bold uppercase tracking-wider">Approved</span>
                           ) : (
                              <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1">
                                 <AlertCircle size={10} /> Disallowed
                              </span>
                           )}
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
};

export default OvertimeModule;
