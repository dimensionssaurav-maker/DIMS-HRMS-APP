
import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Filter, PieChart as PieChartIcon, IndianRupee, Wrench } from 'lucide-react';
import { Expense, ExpenseCategory } from '../types';

interface Props {
  expenses: Expense[];
  month: string;
  year: number;
}

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#6366f1'];

const ExpenseReportSection: React.FC<Props> = ({ expenses, month, year }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Filter expenses for the specific month/year first
  const monthlyExpenses = useMemo(() => {
    return expenses.filter(exp => {
      const d = new Date(exp.date);
      return (
        d.getFullYear() === year &&
        d.toLocaleString('default', { month: 'long' }) === month
      );
    });
  }, [expenses, month, year]);

  // Site Services specific report
  const siteServicesExpenses = useMemo(() => {
    return monthlyExpenses.filter(e => e.category === 'Site Services');
  }, [monthlyExpenses]);

  // Then aggregate by category
  const categoryStats = useMemo(() => {
    const stats: Record<string, number> = {};
    monthlyExpenses.forEach(exp => {
      stats[exp.category] = (stats[exp.category] || 0) + exp.amount;
    });
    return Object.entries(stats)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value); // Sort by value descending
  }, [monthlyExpenses]);

  // Apply category filter for display
  const displayData = useMemo(() => {
    if (selectedCategory === 'All') return categoryStats;
    return categoryStats.filter(s => s.name === selectedCategory);
  }, [categoryStats, selectedCategory]);

  const totalSpent = displayData.reduce((acc, curr) => acc + curr.value, 0);
  const totalSiteSpent = siteServicesExpenses.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="space-y-6">
      {/* Site Services Special Report */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 rounded-3xl shadow-lg text-white">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
             <div className="bg-white/20 p-2 rounded-xl">
               <Wrench size={24} />
             </div>
             <div>
               <h3 className="text-xl font-bold">Site Services Report</h3>
               <p className="text-indigo-200 text-sm">After-sales and on-site maintenance expenses</p>
             </div>
          </div>
          <div className="text-right">
             <p className="text-3xl font-black">₹{totalSiteSpent.toLocaleString()}</p>
             <p className="text-indigo-200 text-xs uppercase font-bold tracking-widest">{month} {year}</p>
          </div>
        </div>
        
        <div className="bg-white/10 rounded-2xl p-4 max-h-[200px] overflow-y-auto custom-scrollbar">
           {siteServicesExpenses.length === 0 ? (
             <p className="text-indigo-200 italic text-center text-sm">No site service expenses recorded for this month.</p>
           ) : (
             <table className="w-full text-left text-sm">
               <thead>
                 <tr className="text-indigo-200 text-xs border-b border-white/10">
                   <th className="pb-2">Date</th>
                   <th className="pb-2">Description</th>
                   <th className="pb-2 text-right">Amount</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-white/10">
                 {siteServicesExpenses.map(exp => (
                   <tr key={exp.id}>
                     <td className="py-2 text-indigo-100">{exp.date}</td>
                     <td className="py-2 font-medium">{exp.description}</td>
                     <td className="py-2 text-right font-bold">₹{exp.amount.toLocaleString()}</td>
                   </tr>
                 ))}
               </tbody>
             </table>
           )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
              <div className="flex items-center gap-2 mb-1">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                      <PieChartIcon size={18} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">Monthly Expense Analysis</h3>
              </div>
            <p className="text-sm text-slate-500 pl-11">Breakdown for <span className="font-semibold text-slate-700">{month} {year}</span></p>
          </div>
          
          <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-100">
            <Filter size={16} className="text-slate-400 ml-2" />
            <select 
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-transparent text-sm font-semibold text-slate-700 py-1.5 pr-8 pl-2 outline-none cursor-pointer"
            >
              <option value="All">All Categories</option>
              {Object.values(ExpenseCategory).map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          {/* Chart Section */}
          <div className="h-[280px] w-full bg-slate-50/50 rounded-2xl border border-slate-50 relative">
            {categoryStats.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryStats} 
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={4}
                  >
                    {categoryStats.map((entry, index) => (
                      <Cell 
                          key={`cell-${index}`} 
                          fill={COLORS[index % COLORS.length]} 
                          opacity={selectedCategory === 'All' || selectedCategory === entry.name ? 1 : 0.1}
                          stroke={selectedCategory === 'All' || selectedCategory === entry.name ? '#fff' : 'transparent'}
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                      formatter={(value: number) => `₹${value.toLocaleString()}`}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  />
                  <Legend 
                      verticalAlign="bottom" 
                      height={36} 
                      iconType="circle"
                      formatter={(value, entry: any) => (
                          <span className={selectedCategory !== 'All' && selectedCategory !== value ? 'text-slate-300' : 'text-slate-600 font-medium'}>
                              {value}
                          </span>
                      )}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                  <PieChartIcon size={32} className="mb-2 opacity-50" />
                  <span className="text-sm font-medium">No expenses recorded</span>
              </div>
            )}
          </div>

          {/* Stats Section */}
          <div className="space-y-6">
              <div className="bg-indigo-600 p-6 rounded-2xl text-white shadow-lg shadow-indigo-100">
                  <p className="text-xs font-bold text-indigo-200 uppercase tracking-widest mb-1">
                      {selectedCategory === 'All' ? 'Total Monthly Spending' : `${selectedCategory} Spending`}
                  </p>
                  <div className="flex items-center gap-2">
                      <IndianRupee size={24} className="text-indigo-300" />
                      <span className="text-4xl font-black">{totalSpent.toLocaleString()}</span>
                  </div>
              </div>

              <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Category Breakdown</h4>
                  <div className="max-h-[160px] overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                      {displayData.map((item, idx) => {
                          const originalIdx = categoryStats.findIndex(s => s.name === item.name);
                          return (
                              <div key={item.name} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 shadow-sm hover:border-indigo-100 transition-colors">
                                  <div className="flex items-center gap-3">
                                      <div 
                                          className="w-3 h-3 rounded-full ring-2 ring-white shadow-sm" 
                                          style={{ backgroundColor: COLORS[originalIdx % COLORS.length] }}
                                      ></div>
                                      <span className="text-sm font-bold text-slate-700">{item.name}</span>
                                  </div>
                                  <span className="text-sm font-mono font-bold text-slate-600">₹{item.value.toLocaleString()}</span>
                              </div>
                          );
                      })}
                      {displayData.length === 0 && (
                          <p className="text-sm text-slate-400 italic text-center py-4">No data for this category.</p>
                      )}
                  </div>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExpenseReportSection;
