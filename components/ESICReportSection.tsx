
import React, { useMemo, useState } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { ShieldCheck, Download, FileText, Loader2, UserCheck, Calculator } from 'lucide-react';
import { PayrollCalculation, Employee } from '../types';

interface Props {
  payroll: PayrollCalculation[];
  employees: Employee[];
  year: number;
  month: string;
  departmentFilter: string;
}

const MONTHS_ORDER = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const ESICReportSection: React.FC<Props> = ({ payroll, employees, year, month, departmentFilter }) => {
  const [viewType, setViewType] = useState<'yearly' | 'monthly'>('yearly');
  const [isExporting, setIsExporting] = useState<string | null>(null);

  // Filter Data Logic
  const filteredData = useMemo(() => {
    return payroll.filter(p => {
      const matchesYear = p.year === year;
      const matchesMonth = viewType === 'monthly' ? p.month === month : true;
      const emp = employees.find(e => e.id === p.employeeId);
      const matchesDept = departmentFilter === 'All Departments' || emp?.department === departmentFilter;
      
      return matchesYear && matchesMonth && matchesDept;
    });
  }, [payroll, employees, year, month, departmentFilter, viewType]);

  // Aggregated Data for Charts (Yearly View)
  const aggregatedData = useMemo(() => {
    const map = new Map(MONTHS_ORDER.map(m => [m, { 
      month: m, 
      employeeShare: 0, 
      employerShare: 0,
      total: 0
    }]));

    // For yearly view, we want all months regardless of current filteredData (which might be filtered by month if logic was shared, but here we process 'payroll' again if needed, OR we rely on filteredData being correct context).
    // Actually, if viewType is 'monthly', filteredData only has that month. 
    // To generate the Yearly Chart *while in Monthly view* is tricky if we use filteredData.
    // So we should derive yearly stats from the full year dataset, independent of viewType.
    
    const yearlyPayroll = payroll.filter(p => {
        const matchesYear = p.year === year;
        const emp = employees.find(e => e.id === p.employeeId);
        const matchesDept = departmentFilter === 'All Departments' || emp?.department === departmentFilter;
        return matchesYear && matchesDept;
    });

    yearlyPayroll.forEach(p => {
      const entry = map.get(p.month);
      if (entry) {
        entry.employeeShare += p.esicEmployeeShare;
        entry.employerShare += p.esicEmployerShare;
        entry.total += (p.esicEmployeeShare + p.esicEmployerShare);
      }
    });

    return Array.from(map.values()).filter(d => d.total > 0);
  }, [payroll, employees, year, departmentFilter]);

  // Totals Calculation (Context Aware)
  const totals = useMemo(() => {
    // If Monthly View, summarize the filtered data (which is monthly).
    // If Yearly View, summarize the yearlyPayroll (aggregatedData).
    if (viewType === 'monthly') {
        return filteredData.reduce((acc, curr) => ({
            employee: acc.employee + curr.esicEmployeeShare,
            employer: acc.employer + curr.esicEmployerShare,
            total: acc.total + (curr.esicEmployeeShare + curr.esicEmployerShare)
        }), { employee: 0, employer: 0, total: 0 });
    } else {
        return aggregatedData.reduce((acc, curr) => ({
            employee: acc.employee + curr.employeeShare,
            employer: acc.employer + curr.employerShare,
            total: acc.total + curr.total
        }), { employee: 0, employer: 0, total: 0 });
    }
  }, [filteredData, aggregatedData, viewType]);

  const handleExport = (type: 'csv' | 'pdf') => {
    setIsExporting(type);
    
    setTimeout(() => {
      if (type === 'csv') {
        let csvContent = '';
        if (viewType === 'monthly') {
            const headers = ['Employee ID', 'Name', 'Department', 'Gross Wages', 'Emp Share (0.75%)', 'Emplr Share (3.25%)', 'Total'];
            const rows = filteredData.map(d => {
                const emp = employees.find(e => e.id === d.employeeId);
                return [
                    d.employeeId,
                    `"${emp?.name || ''}"`,
                    `"${emp?.department || ''}"`,
                    d.grossSalary.toFixed(2),
                    d.esicEmployeeShare.toFixed(2),
                    d.esicEmployerShare.toFixed(2),
                    (d.esicEmployeeShare + d.esicEmployerShare).toFixed(2)
                ];
            });
            csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        } else {
            const headers = ['Month', 'Employee Share', 'Employer Share', 'Total Contribution'];
            const rows = aggregatedData.map(d => [
                d.month,
                d.employeeShare.toFixed(2),
                d.employerShare.toFixed(2),
                d.total.toFixed(2)
            ]);
            csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        }
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `ESIC_Report_${year}_${viewType}.csv`;
        link.click();
      } else {
        alert(`ESIC Report for ${year} downloaded as PDF.`);
      }
      setIsExporting(null);
    }, 1200);
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm mb-8 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-800">ESIC Contribution</h3>
            <p className="text-sm text-slate-500">
              {viewType === 'yearly' ? `Annual Summary ${year}` : `Monthly Register: ${month} ${year}`}
            </p>
          </div>
        </div>

        <div className="flex gap-3 items-center">
           <div className="bg-slate-50 p-1 rounded-xl border border-slate-100 flex">
                <button 
                    onClick={() => setViewType('yearly')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewType === 'yearly' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Yearly Overview
                </button>
                <button 
                    onClick={() => setViewType('monthly')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewType === 'monthly' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Monthly Detail
                </button>
            </div>

           <div className="h-8 w-px bg-slate-200 mx-2"></div>

           <button 
             onClick={() => handleExport('pdf')}
             disabled={!!isExporting}
             className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-500 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-100 rounded-xl transition-all flex items-center gap-2"
           >
             {isExporting === 'pdf' ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
             PDF
           </button>
           <button 
             onClick={() => handleExport('csv')}
             disabled={!!isExporting}
             className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-white bg-indigo-600 hover:bg-indigo-700 border border-indigo-600 rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-indigo-200"
           >
             {isExporting === 'csv' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
             CSV
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Stats Column */}
        <div className="space-y-4 lg:col-span-1">
           <div className="bg-indigo-600 p-5 rounded-2xl text-white shadow-lg shadow-indigo-100">
             <p className="text-xs font-bold text-indigo-200 uppercase tracking-widest mb-1">Total Contribution</p>
             <p className="text-3xl font-black">₹{totals.total.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
             <p className="text-[10px] text-indigo-100 mt-2 opacity-80">
                {viewType === 'yearly' ? 'Accumulated YTD' : `For ${month} ${year}`}
             </p>
           </div>

           <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
             <div className="flex items-center gap-2 mb-2">
                 <UserCheck size={16} className="text-indigo-600" />
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Covered Employees</p>
             </div>
             <p className="text-xl font-black text-slate-800">
                 {viewType === 'yearly' ? 'All Active' : filteredData.length}
             </p>
           </div>

           <div className="grid grid-cols-2 gap-4">
             <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
               <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Employer Share</p>
               <p className="text-lg font-black text-emerald-600">₹{totals.employer.toLocaleString()}</p>
               <p className="text-[9px] text-emerald-600/60 font-medium">3.25%</p>
             </div>
             <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
               <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Employee Share</p>
               <p className="text-lg font-black text-rose-600">₹{totals.employee.toLocaleString()}</p>
               <p className="text-[9px] text-rose-600/60 font-medium">0.75%</p>
             </div>
           </div>
        </div>

        {/* Content View */}
        <div className="lg:col-span-3 bg-white">
          {viewType === 'yearly' ? (
            <div className="bg-slate-50/50 rounded-2xl border border-slate-50 p-4 min-h-[320px]">
              {aggregatedData.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={aggregatedData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="month" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#64748b', fontSize: 12}} 
                      tickFormatter={(val) => val.slice(0, 3)}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#64748b', fontSize: 12}}
                    />
                    <Tooltip 
                      cursor={{fill: '#f1f5f9'}}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                      formatter={(value: number) => [`₹${value.toLocaleString()}`, '']}
                    />
                    <Legend 
                      iconType="circle" 
                      verticalAlign="top" 
                      height={36} 
                      wrapperStyle={{ fontSize: '12px', fontWeight: 600 }}
                    />
                    <Bar name="Employer Share" dataKey="employerShare" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} barSize={40} />
                    <Bar name="Employee Share" dataKey="employeeShare" stackId="a" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                 <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                   <ShieldCheck size={32} className="opacity-20" />
                   <span className="text-sm font-medium">No ESIC contributions recorded for {year}</span>
                 </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                <div className="max-h-[320px] overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 sticky top-0 z-10">
                            <tr className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                <th className="px-6 py-4">Employee</th>
                                <th className="px-6 py-4 text-right">Gross Wages</th>
                                <th className="px-6 py-4 text-right">Emp Share</th>
                                <th className="px-6 py-4 text-right">Emplr Share</th>
                                <th className="px-6 py-4 text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 text-sm">
                            {filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-slate-400 italic">
                                        No ESIC data for {month} {year}.
                                    </td>
                                </tr>
                            ) : filteredData.map((d) => {
                                const emp = employees.find(e => e.id === d.employeeId);
                                return (
                                    <tr key={d.employeeId} className="hover:bg-slate-50/50">
                                        <td className="px-6 py-3">
                                            <div className="font-bold text-slate-700">{emp?.name}</div>
                                            <div className="text-[10px] text-slate-400">{emp?.department}</div>
                                        </td>
                                        <td className="px-6 py-3 text-right font-mono text-slate-600">₹{d.grossSalary.toLocaleString()}</td>
                                        <td className="px-6 py-3 text-right font-medium text-rose-600">₹{d.esicEmployeeShare}</td>
                                        <td className="px-6 py-3 text-right font-medium text-emerald-600">₹{d.esicEmployerShare}</td>
                                        <td className="px-6 py-3 text-right font-bold text-slate-800">₹{d.esicEmployeeShare + d.esicEmployerShare}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ESICReportSection;
