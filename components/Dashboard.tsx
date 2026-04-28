
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  TrendingUp, 
  Users, 
  Clock, 
  AlertCircle,
  Sparkles,
  ArrowRight,
  Filter,
  IndianRupee,
  Wallet,
  RefreshCw,
  Copy,
  Check
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { getHRInsights } from '../services/geminiService';


interface Props {
  data: any;
  selectedMonth: string;
  setSelectedMonth: (m: string) => void;
  selectedYear: number;
  setSelectedYear: (y: number) => void;
  months: string[];
  years: number[];
  cachedInsights: string;
  setCachedInsights: (insights: string) => void;
}

const Dashboard: React.FC<Props> = ({ 
  data, 
  selectedMonth, 
  setSelectedMonth, 
  selectedYear, 
  setSelectedYear,
  months,
  years,
  cachedInsights,
  setCachedInsights
}) => {
  const [isLoadingInsights, setIsLoadingInsights] = useState<boolean>(false);
  const [insightError, setInsightError] = useState<boolean>(false);
  const [copied, setCopied] = useState(false);

  const monthlyExpenses = useMemo(() => {
    return data.expenses.filter((exp: any) => {
      const expDate = new Date(exp.date);
      return expDate.getFullYear() === selectedYear && 
             expDate.toLocaleString('default', { month: 'long' }) === selectedMonth;
    }).reduce((sum: number, exp: any) => sum + exp.amount, 0);
  }, [data.expenses, selectedMonth, selectedYear]);

  const totalPayroll = useMemo(() => {
    return data.payroll.reduce((sum: number, pay: any) => sum + pay.netPayable, 0);
  }, [data.payroll]);

  const dailyAttendanceData = useMemo(() => {
    if (!data.attendance) return [];

    const monthIndex = months.indexOf(selectedMonth);
    const daysInMonth = new Date(selectedYear, monthIndex + 1, 0).getDate();
    
    // Initialize stats for each day
    const stats = new Map();
    for(let i = 1; i <= daysInMonth; i++) {
        stats.set(i, { name: String(i), Present: 0, Absent: 0, Holiday: 0 });
    }

    // Iterate through records and aggregate statuses
    data.attendance.forEach((record: any) => {
        const d = new Date(record.date);
        if (d.getFullYear() === selectedYear && d.getMonth() === monthIndex) {
            const day = d.getDate();
            const entry = stats.get(day);
            if (entry) {
                if (record.status === 'PRESENT') entry.Present++;
                else if (record.status === 'ABSENT') entry.Absent++;
                else if (record.status === 'HOLIDAY' || record.status === 'LEAVE') entry.Holiday++;
            }
        }
    });

    return Array.from(stats.values());
  }, [data.attendance, selectedMonth, selectedYear, months]);

  const fetchInsights = useCallback(async () => {
    setIsLoadingInsights(true);
    setInsightError(false);
    try {
      const res = await getHRInsights({ 
        ...data, 
        period: `${selectedMonth} ${selectedYear}`,
        monthlyTotalExpenses: monthlyExpenses,
        totalPayrollPayout: totalPayroll
      });
      
      setCachedInsights(res);
      
      if (res.includes("⚠️") || res.includes("Failed")) {
        setInsightError(true);
      }
    } catch (err) {
      setInsightError(true);
      setCachedInsights("Unable to generate insights at this moment.");
    } finally {
      setIsLoadingInsights(false);
    }
  }, [data, selectedMonth, selectedYear, monthlyExpenses, totalPayroll, setCachedInsights]);

  useEffect(() => {
    if (!cachedInsights) {
      fetchInsights();
    }
  }, [fetchInsights, cachedInsights]);

  const handleCopy = () => {
    if (!cachedInsights) return;
    navigator.clipboard.writeText(cachedInsights);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const stats = [
    { label: 'Total Workforce', value: data.employees.length, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Payroll Payout', value: `₹${totalPayroll.toLocaleString()}`, icon: IndianRupee, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Operational Expenses', value: `₹${monthlyExpenses.toLocaleString()}`, icon: Wallet, color: 'text-rose-600', bg: 'bg-rose-50' },
    { label: 'Avg Attendance', value: '92%', icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Global Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-slate-800 font-bold">
          <Filter size={18} className="text-indigo-600" />
          <span>Period Analysis:</span>
        </div>
        <div className="flex items-center gap-3">
          <select 
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-slate-50 border border-slate-100 text-sm font-semibold text-slate-700 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            {months.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select 
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-slate-50 border border-slate-100 text-sm font-semibold text-slate-700 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <div className="ml-2 pl-4 border-l border-slate-100 text-xs text-slate-400 font-medium">
            Showing trends for {selectedMonth} {selectedYear}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 transition-transform hover:scale-[1.02]">
            <div className="flex items-center justify-between mb-4">
              <div className={`${stat.bg} ${stat.color} p-3 rounded-xl`}>
                <stat.icon size={24} />
              </div>
              <span className="text-xs font-semibold text-green-500 bg-green-50 px-2 py-1 rounded-full">+4.2%</span>
            </div>
            <h3 className="text-slate-500 text-sm font-medium">{stat.label}</h3>
            <p className="text-xl font-bold text-slate-800 mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Dynamic Attendance Chart */}
        <div className="lg:col-span-2 bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold text-slate-800">Monthly Attendance Trends ({selectedMonth})</h3>
            <div className="flex gap-4">
               {/* Legend is handled by Recharts, but adding custom indicators if needed */}
            </div>
          </div>
          <div className="h-[300px] w-full">
            {Array.isArray(dailyAttendanceData) && dailyAttendanceData.length > 0 ? (
  <ResponsiveContainer width="100%" height="100%">
    <BarChart data={dailyAttendanceData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#94a3b8', fontSize: 10}} 
                    dy={10} 
                    label={{ value: 'Day of Month', position: 'insideBottom', offset: -5, fontSize: 10, fill: '#cbd5e1' }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#94a3b8', fontSize: 12}} 
                    allowDecimals={false}
                  />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 600 }} />
                  <Bar dataKey="Present" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} barSize={20} />
                  <Bar dataKey="Absent" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} barSize={20} />
                  <Bar dataKey="Holiday" stackId="a" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
               <div className="h-full flex items-center justify-center text-slate-400 text-sm font-medium">
                  No attendance data available for this period.
               </div>
            )}
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-8 rounded-2xl shadow-lg text-white relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Sparkles className="text-amber-300" size={24} />
                <h3 className="text-lg font-bold">Zen AI Insights</h3>
              </div>
              <div className="flex gap-2">
                {!isLoadingInsights && !insightError && cachedInsights && (
                  <>
                    <button 
                      onClick={handleCopy}
                      className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white"
                      title="Copy to clipboard"
                    >
                      {copied ? <Check size={18} /> : <Copy size={18} />}
                    </button>
                    <button 
                      onClick={fetchInsights}
                      className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white"
                      title="Regenerate insights"
                    >
                      <RefreshCw size={18} />
                    </button>
                  </>
                )}
                {isLoadingInsights && <RefreshCw size={18} className="animate-spin text-indigo-300" />}
              </div>
            </div>
            <div className="space-y-4">
              {isLoadingInsights ? (
                <div className="space-y-3">
                  <div className="h-4 bg-white/10 rounded w-full animate-pulse"></div>
                  <div className="h-4 bg-white/10 rounded w-5/6 animate-pulse"></div>
                  <div className="h-4 bg-white/10 rounded w-4/6 animate-pulse"></div>
                </div>
              ) : (
                <>
                  <p className="text-indigo-50 leading-relaxed text-sm italic">
                    "{cachedInsights}"
                  </p>
                  {insightError && (
                    <button 
                      onClick={fetchInsights}
                      className="flex items-center gap-2 text-xs font-bold text-amber-300 hover:text-white transition-colors bg-white/10 px-3 py-1.5 rounded-lg"
                    >
                      <RefreshCw size={14} /> Try Again
                    </button>
                  )}
                </>
              )}
              <div className="pt-4 border-t border-indigo-500/30">
                <button className="flex items-center gap-2 text-sm font-semibold hover:gap-3 transition-all">
                  View Full Analysis <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
          {/* Decorative background circle */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16"></div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
