
import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, IndianRupee } from 'lucide-react';
import { Expense } from '../types';

interface Props {
  expenses: Expense[];
  year: number;
}

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#6366f1'];

const YearlyExpenseReportSection: React.FC<Props> = ({ expenses, year }) => {
  // Filter and Aggregate expenses for the selected year
  const yearlyStats = useMemo(() => {
    const stats: Record<string, number> = {};
    expenses.forEach(exp => {
      const d = new Date(exp.date);
      if (d.getFullYear() === year) {
        stats[exp.category] = (stats[exp.category] || 0) + exp.amount;
      }
    });
    return Object.entries(stats)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [expenses, year]);

  const totalSpent = yearlyStats.reduce((acc, curr) => acc + curr.value, 0);

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm mb-8 animate-in slide-in-from-bottom-4 duration-500 delay-100">
       <div className="flex items-center gap-2 mb-6">
          <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <TrendingUp size={18} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">Yearly Expense Overview</h3>
            <p className="text-sm text-slate-500">Aggregate spending for <span className="font-semibold text-slate-700">{year}</span></p>
          </div>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         {/* Stats Column */}
         <div className="lg:col-span-1 space-y-6">
            <div className="bg-purple-600 p-6 rounded-2xl text-white shadow-lg shadow-purple-100">
                <p className="text-xs font-bold text-purple-200 uppercase tracking-widest mb-1">
                    Total Yearly Spending
                </p>
                <div className="flex items-center gap-2">
                    <IndianRupee size={24} className="text-purple-300" />
                    <span className="text-4xl font-black">{totalSpent.toLocaleString()}</span>
                </div>
            </div>
            
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Top Categories</h4>
                <div className="space-y-3">
                    {yearlyStats.slice(0, 5).map((item, index) => (
                        <div key={item.name} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-400 w-4">{index + 1}.</span>
                                <span className="font-medium text-slate-700">{item.name}</span>
                            </div>
                            <span className="font-bold text-slate-800">₹{item.value.toLocaleString()}</span>
                        </div>
                    ))}
                     {yearlyStats.length === 0 && <p className="text-slate-400 italic text-sm">No data available for {year}</p>}
                </div>
            </div>
         </div>

         {/* Bar Chart Visualization */}
         <div className="lg:col-span-2 h-[300px] bg-slate-50/50 rounded-2xl border border-slate-50 p-4 relative">
            {yearlyStats.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={yearlyStats} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
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
                            tickFormatter={(value) => `₹${value >= 1000 ? (value/1000).toFixed(0) + 'k' : value}`}
                        />
                        <Tooltip 
                            cursor={{fill: '#f1f5f9'}}
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                            formatter={(value: number) => [`₹${value.toLocaleString()}`, 'Amount']}
                        />
                        <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={50}>
                             {yearlyStats.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                             ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            ) : (
                <div className="h-full flex items-center justify-center text-slate-400">
                    No expense data found for {year}
                </div>
            )}
         </div>
       </div>
    </div>
  );
};

export default YearlyExpenseReportSection;
