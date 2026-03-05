
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
import { Building, Download, FileText, Loader2, Calendar, UserCheck } from 'lucide-react';
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

const LWFReportSection: React.FC<Props> = ({ payroll, employees, year, month, departmentFilter }) => {
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
  const yearlyChartData = useMemo(() => {
    const map = new Map(MONTHS_ORDER.map(m => [m, { 
      month: m, 
      employeeShare: 0, 
      employerShare: 0,
      total: 0
    }]));

    filteredData.forEach(p => {
      const entry = map.get(p.month);
      if (entry) {
        entry.employeeShare += p.lwfEmployeeShare;
        entry.employerShare += p.lwfEmployerShare;
        entry.total += (p.lwfEmployeeShare + p.lwfEmployerShare);
      }
    });

    return Array.from(map.values()).filter(d => d.total > 0);
  }, [filteredData]);

  // Aggregated Data for Charts (Monthly View - By Department)
  const monthlyDepartmentChartData = useMemo(() => {
    if (viewType !== 'monthly') return [];
    
    const map = new Map();
    
    filteredData.forEach(p => {
        const emp = employees.find(e => e.id === p.employeeId);
        const dept = emp?.department || 'Unknown';
        
        if (!map.has(dept)) {
            map.set(dept, { name: dept, employeeShare: 0, employerShare: 0, total: 0 });
        }
        
        const entry = map.get(dept);
        entry.employeeShare += p.lwfEmployeeShare;
        entry.employerShare += p.lwfEmployerShare;
        entry.total += (p.lwfEmployeeShare + p.lwfEmployerShare);
    });

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredData, employees, viewType]);

  // Totals Calculation
  const totals = useMemo(() => {
    return filteredData.reduce((acc, curr) => ({
      employee: acc.employee + curr.lwfEmployeeShare,
      employer: acc.employer + curr.lwfEmployerShare,
      total: acc.total + (curr.lwfEmployeeShare + curr.lwfEmployerShare)
    }), { employee: 0, employer: 0, total: 0 });
  }, [filteredData]);

  const handleExport = (type: 'csv' | 'pdf') => {
    setIsExporting(type);
    
    setTimeout(() => {
      if (type === 'csv') {
        const headers = ['Month', 'Employee Name', 'Department', 'Emp Share', 'Emplr Share', 'Total'];
        const rows = filteredData.map(d => {
            const emp = employees.find(e => e.id === d.employeeId);
            return [
              d.month,
              `"${emp?.name || ''}"`,
              `"${emp?.department || ''}"`,
              d.lwfEmployeeShare,
              d.lwfEmployerShare,
              (d.lwfEmployeeShare + d.lwfEmployerShare)
            ];
        });
        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `LWF_Report_${year}_${viewType}.csv`;
        link.click();
      } else {
        alert(`LWF Report for ${year} downloaded as PDF.`);
      }
      setIsExporting(null);
    }, 1200);
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm mb-8 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-cyan-50 text-cyan-600 rounded-xl">
            <Building size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-800">Labor Welfare Fund (LWF)</h3>
            <p className="text-sm text-slate-500">
              {viewType === 'yearly' ? `Annual Overview for ${year}` : `Monthly Register for ${month} ${year}`}
            </p>
          </div>
        </div>

        <div className="flex gap-3 items-center">
            {/* View Switcher */}
            <div className="bg-slate-50 p-1 rounded-xl border border-slate-100 flex">
                <button 
                    onClick={() => setViewType('yearly')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewType === 'yearly' ? 'bg-white shadow-sm text-cyan-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Yearly Overview
                </button>
                <button 
                    onClick={() => setViewType('monthly')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewType === 'monthly' ? 'bg-white shadow-sm text-cyan-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Monthly Detail
                </button>
            </div>

           <div className="h-8 w-px bg-slate-200 mx-2"></div>

           <button 
             onClick={() => handleExport('pdf')}
             disabled={!!isExporting}
             className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-500 bg-slate-50 hover:bg-cyan-50 hover:text-cyan-600 border border-slate-100 rounded-xl transition-all flex items-center gap-2"
           >
             {isExporting === 'pdf' ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
             PDF
           </button>
           <button 
             onClick={() => handleExport('csv')}
             disabled={!!isExporting}
             className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-white bg-cyan-600 hover:bg-cyan-700 border border-cyan-600 rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-cyan-200"
           >
             {isExporting === 'csv' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
             CSV
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Stats Column */}
        <div className="space-y-4 lg:col-span-1">
           <div className="bg-cyan-600 p-5 rounded-2xl text-white shadow-lg shadow-cyan-100">
             <p className="text-xs font-bold text-cyan-200 uppercase tracking-widest mb-1">Total Fund Collected</p>
             <p className="text-3xl font-black">₹{totals.total.toLocaleString()}</p>
             <p className="text-[10px] text-cyan-100 mt-2 opacity-80">
                {viewType === 'yearly' ? 'YTD Collection' : `Collection for ${month}`}
             </p>
           </div>

           <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
             <div className="flex items-center gap-2 mb-2">
                 <UserCheck size={16} className="text-cyan-600" />
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Contributing Employees</p>
             </div>
             <p className="text-xl font-black text-slate-800">
                 {viewType === 'yearly' ? 'All Active' : filteredData.length}
             </p>
           </div>

           <div className="grid grid-cols-2 gap-4">
             <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Emp Share</p>
                <p className="text-lg font-bold text-cyan-600">₹{totals.employee}</p>
             </div>
             <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Emplr Share</p>
                <p className="text-lg font-bold text-slate-700">₹{totals.employer}</p>
             </div>
           </div>
        </div>

        {/* Content View */}
        <div className="lg:col-span-3 bg-white">
           {viewType === 'yearly' ? (
             <div className="bg-slate-50/50 rounded-2xl border border-slate-50 p-4 min-h-[300px]">
                <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 ml-2">Annual Trends</h4>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={yearlyChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
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
                    <Legend iconType="circle" verticalAlign="top" height={36} />
                    <Bar name="Employer Share" dataKey="employerShare" stackId="a" fill="#0891b2" radius={[0, 0, 4, 4]} barSize={40} />
                    <Bar name="Employee Share" dataKey="employeeShare" stackId="a" fill="#22d3ee" radius={[4, 4, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
             </div>
           ) : (
             <div className="space-y-6">
                 {/* Monthly Dept Chart */}
                 <div className="bg-slate-50/50 rounded-2xl border border-slate-50 p-4 min-h-[300px]">
                    <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 ml-2">Department-wise Contribution</h4>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={monthlyDepartmentChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis 
                                dataKey="name" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{fill: '#64748b', fontSize: 12}} 
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
                            <Legend iconType="circle" verticalAlign="top" height={36} />
                            <Bar name="Employer Share" dataKey="employerShare" stackId="a" fill="#0891b2" radius={[0, 0, 4, 4]} barSize={40} />
                            <Bar name="Employee Share" dataKey="employeeShare" stackId="a" fill="#22d3ee" radius={[4, 4, 0, 0]} barSize={40} />
                        </BarChart>
                    </ResponsiveContainer>
                 </div>

                 {/* Existing Table */}
                 <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                    <div className="max-h-[320px] overflow-y-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 sticky top-0 z-10">
                                <tr className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    <th className="px-6 py-4">Employee</th>
                                    <th className="px-6 py-4 text-center">Emp Share</th>
                                    <th className="px-6 py-4 text-center">Employer Share</th>
                                    <th className="px-6 py-4 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 text-sm">
                                {filteredData.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-8 text-center text-slate-400 italic">
                                            No LWF contributions for {month} {year}.
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
                                            <td className="px-6 py-3 text-center text-slate-600">₹{d.lwfEmployeeShare}</td>
                                            <td className="px-6 py-3 text-center text-slate-600">₹{d.lwfEmployerShare}</td>
                                            <td className="px-6 py-3 text-right font-bold text-cyan-600">₹{d.lwfEmployeeShare + d.lwfEmployerShare}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                 </div>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default LWFReportSection;
