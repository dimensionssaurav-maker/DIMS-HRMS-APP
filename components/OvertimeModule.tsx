import React, { useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { 
  Clock, Filter, Download, IndianRupee, TrendingUp, Search,
  Loader2, Calendar, AlertTriangle, User, AlertCircle,
  Layers, ChevronDown, ChevronUp, Moon, Sun, Zap
} from 'lucide-react';
import { Employee, AttendanceRecord, PayrollConfig, Shift } from '../types';

// ─── Inlined OT Slab Types ───────────────────────────────────────────────────
interface OTSlab {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  multiplier: number;
  crossesMidnight: boolean;
  enabled: boolean;
}
interface OTSlabResult {
  slabName: string;
  minutes: number;
  hours: number;
  multiplier: number;
  amount: number;
}

// ─── Inlined Calculator ──────────────────────────────────────────────────────
function toMins(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function distributeOTAcrossSlabs(overtimeHours: number, shiftEnd: string, slabs: OTSlab[], hourlyBase: number): OTSlabResult[] {
  if (!overtimeHours || overtimeHours <= 0 || !slabs?.length) return [];
  let remaining = overtimeHours * 60;
  let cursor = toMins(shiftEnd);
  const shiftEndMins = toMins(shiftEnd);
  const results: OTSlabResult[] = [];
  const sorted = [...slabs].filter(s => s.enabled).sort((a, b) => {
    let as2 = toMins(a.startTime); let bs2 = toMins(b.startTime);
    if (as2 < shiftEndMins) as2 += 1440;
    if (bs2 < shiftEndMins) bs2 += 1440;
    return as2 - bs2;
  });
  for (const slab of sorted) {
    if (remaining <= 0) break;
    let slabStart = toMins(slab.startTime);
    let slabEnd = toMins(slab.endTime);
    if (slab.crossesMidnight || slabEnd <= slabStart) slabEnd += 1440;
    if (slabStart < shiftEndMins) slabStart += 1440;
    const slabAvail = Math.max(0, slabEnd - Math.max(cursor, slabStart));
    const used = Math.min(remaining, slabAvail);
    if (used <= 0) continue;
    cursor = Math.max(cursor, slabStart) + used;
    remaining -= used;
    const hours = Math.round((used / 60) * 100) / 100;
    const amount = Math.round(hours * hourlyBase * slab.multiplier);
    results.push({ slabName: slab.name, minutes: used, hours, multiplier: slab.multiplier, amount });
  }
  if (remaining > 0) {
    const lastSlab = sorted[sorted.length - 1];
    const multiplier = lastSlab?.multiplier ?? 1;
    const hours = Math.round((remaining / 60) * 100) / 100;
    const amount = Math.round(hours * hourlyBase * multiplier);
    results.push({ slabName: lastSlab ? `${lastSlab.name} (ext.)` : 'OT', minutes: remaining, hours, multiplier, amount });
  }
  return results;
}
function totalOTPayFromSlabs(slabResults: OTSlabResult[]): number {
  return slabResults.reduce((sum, s) => sum + s.amount, 0);
}

// ─── Colour helpers ──────────────────────────────────────────────────────────
const SLAB_COLOURS: Record<string, { bg: string; text: string }> = {
  'Normal OT':     { bg: 'bg-emerald-100', text: 'text-emerald-800' },
  'Half Night OT': { bg: 'bg-amber-100',   text: 'text-amber-800'   },
  'Full Night OT': { bg: 'bg-rose-100',    text: 'text-rose-800'    },
};
function slabColour(name: string) { return SLAB_COLOURS[name] ?? { bg: 'bg-indigo-100', text: 'text-indigo-800' }; }
function slabIcon(name: string) {
  if (name.toLowerCase().includes('full night'))  return <Moon size={10} className="inline mr-0.5" />;
  if (name.toLowerCase().includes('half night'))  return <Moon size={10} className="inline mr-0.5 opacity-60" />;
  if (name.toLowerCase().includes('normal'))      return <Zap  size={10} className="inline mr-0.5" />;
  return <Sun size={10} className="inline mr-0.5" />;
}

// ─── Props ───────────────────────────────────────────────────────────────────
interface Props {
  employees: Employee[];
  attendanceRecords: AttendanceRecord[];
  departments: string[];
  shifts: Shift[];
  startDate: string;
  endDate: string;
  onDateChange: (start: string, end: string) => void;
  payrollConfig: PayrollConfig;
}

// ─── Component ───────────────────────────────────────────────────────────────
const OvertimeModule: React.FC<Props> = ({
  employees, attendanceRecords, departments, shifts,
  startDate, endDate, onDateChange, payrollConfig,
}) => {
  const [departmentFilter, setDepartmentFilter] = useState('All Departments');
  const [employeeSearch,   setEmployeeSearch]   = useState('');
  const [isExporting,      setIsExporting]      = useState<string | null>(null);
  const [expandedRow,      setExpandedRow]      = useState<string | null>(null);

  const getShift = (emp: Employee): Shift | undefined => shifts?.find(s => s.id === emp.shiftId);

  const filteredData = useMemo(() => {
    const start = new Date(startDate); const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return [];
    const deduped = new Map<string, typeof attendanceRecords[0]>();
    for (const r of attendanceRecords) deduped.set(`${r.employeeId}-${r.date}`, r);
    const recordsInPeriod = Array.from(deduped.values()).filter(r => {
      const d = new Date(r.date); return d >= start && d <= end && r.overtimeHours > 0;
    });
    const joined = recordsInPeriod.map(r => {
      const emp = employees.find(e => e.id === r.employeeId);
      if (!emp) return null;
      const shift = getShift(emp);
      const hourlyRate = emp.dailyWage / (shift?.workingHours ?? 8);
      const multiplier = payrollConfig.designationOverrides[emp.designation] ?? payrollConfig.globalOtMultiplier;
      let slabBreakdown: OTSlabResult[] = [];
      let otAmount = 0; let isTieredApplied = false; let payableHours = r.overtimeHours;
      const otSlabs = (shift as any)?.otSlabs as OTSlab[] | undefined;
      if (otSlabs && otSlabs.length > 0) {
        slabBreakdown = distributeOTAcrossSlabs(r.overtimeHours, shift!.endTime, otSlabs, hourlyRate);
        otAmount = emp.isOtAllowed ? totalOTPayFromSlabs(slabBreakdown) : 0;
        payableHours = Math.round(slabBreakdown.reduce((s, b) => s + b.hours, 0) * 100) / 100;
        isTieredApplied = true;
      } else if (payrollConfig.otConfig?.enabled && payrollConfig.otConfig.rules?.length > 0) {
        const otMins = r.overtimeHours * 60;
        const rules = payrollConfig.otConfig.rules
          .filter(rule => rule.enabled && (rule.department === 'All Departments' || rule.department === emp.department))
          .sort((a, b) => b.thresholdMinutes - a.thresholdMinutes);
        const matched = rules.find(rule => otMins >= rule.thresholdMinutes);
        if (matched) { payableHours = matched.payoutAmount; isTieredApplied = true; }
        otAmount = emp.isOtAllowed ? Math.round(payableHours * hourlyRate * multiplier) : 0;
      } else {
        otAmount = emp.isOtAllowed ? Math.round(r.overtimeHours * hourlyRate * multiplier) : 0;
      }
      let foodingAmount = 0;
      if (emp.isOtAllowed && payrollConfig.foodingConfig.enabled) {
        const dr = payrollConfig.foodingConfig.departmentOverrides?.[emp.department];
        const minHours = dr ? dr.minHours : payrollConfig.foodingConfig.minHours;
        const allowance = dr ? dr.amount : payrollConfig.foodingConfig.amount;
        if (r.overtimeHours >= minHours) foodingAmount = allowance;
      }
      return {
        ...r, employeeName: emp.name, department: emp.department, designation: emp.designation,
        isOtAllowed: emp.isOtAllowed, multiplier, hourlyRate, payableHours,
        isTieredApplied, slabBreakdown, hasSlabs: slabBreakdown.length > 0,
        otAmount, foodingAmount, totalCost: otAmount + foodingAmount,
      };
    }).filter(Boolean) as any[];
    return joined.filter(item => {
      const matchDept = departmentFilter === 'All Departments' || item.department === departmentFilter;
      const matchSearch = (item.employeeName ?? '').toLowerCase().includes(employeeSearch.toLowerCase())
                       || (item.employeeId ?? '').toLowerCase().includes(employeeSearch.toLowerCase());
      return matchDept && matchSearch;
    });
  }, [attendanceRecords, employees, shifts, startDate, endDate, departmentFilter, employeeSearch, payrollConfig]);

  const stats = useMemo(() => filteredData.reduce((acc, curr) => ({
    totalHours: acc.totalHours + curr.overtimeHours,
    totalPayableHours: acc.totalPayableHours + curr.payableHours,
    totalOtCost: acc.totalOtCost + curr.otAmount,
    totalFoodingCost: acc.totalFoodingCost + curr.foodingAmount,
    totalCost: acc.totalCost + curr.totalCost,
    uniqueEmployees: new Set([...Array.from(acc.uniqueEmployees as Set<string>), curr.employeeId]).size,
  }), { totalHours: 0, totalPayableHours: 0, totalOtCost: 0, totalFoodingCost: 0, totalCost: 0, uniqueEmployees: new Set<string>() as any }), [filteredData]);

  const slabSummary = useMemo(() => {
    const map = new Map<string, { hours: number; amount: number; multiplier: number }>();
    filteredData.forEach(d => {
      (d.slabBreakdown as OTSlabResult[]).forEach(s => {
        const cur = map.get(s.slabName) ?? { hours: 0, amount: 0, multiplier: s.multiplier };
        map.set(s.slabName, { hours: cur.hours + s.hours, amount: cur.amount + s.amount, multiplier: s.multiplier });
      });
    });
    return Array.from(map.entries()).map(([name, v]) => ({ name, ...v }));
  }, [filteredData]);

  const employeeStats = useMemo(() => {
    const map = new Map<string, any>();
    filteredData.forEach(d => {
      if (!map.has(d.employeeId)) map.set(d.employeeId, { id: d.employeeId, name: d.employeeName, department: d.department, hours: 0, cost: 0, designation: d.designation });
      const e = map.get(d.employeeId)!; e.hours += d.overtimeHours; e.cost += d.totalCost;
    });
    return Array.from(map.values()).sort((a, b) => b.hours - a.hours);
  }, [filteredData]);

  const maxTotalHours = useMemo(() => Math.max(...employeeStats.map(e => e.hours), 1), [employeeStats]);
  const maxDailyHours = useMemo(() => Math.max(...filteredData.map(d => d.overtimeHours), 1), [filteredData]);
  const chartData = useMemo(() => {
    const m = new Map();
    filteredData.forEach(d => m.set(d.department, (m.get(d.department) || 0) + d.overtimeHours));
    return Array.from(m.entries()).map(([name, value]) => ({ name, value }));
  }, [filteredData]);

  const handleExport = (type: 'csv' | 'monthly') => {
    setIsExporting(type);
    setTimeout(() => {
      const allSlabNames = Array.from(new Set(filteredData.flatMap(d => d.slabBreakdown.map((s: OTSlabResult) => s.slabName))));
      if (type === 'csv') {
        const headers = ['Date','Emp ID','Name','Department','Actual OT Hrs','OT Pay','Fooding','Total',...allSlabNames.flatMap(s => [`${s} Hrs`,`${s} Pay`])];
        const rows = filteredData.map((d: any) => {
          const slabCols = allSlabNames.flatMap(sName => { const slab = d.slabBreakdown.find((s: OTSlabResult) => s.slabName === sName); return [slab?.hours ?? 0, slab?.amount ?? 0]; });
          return [d.date,d.employeeId,`"${d.employeeName}"`,`"${d.department}"`,d.overtimeHours,d.otAmount,d.foodingAmount,d.totalCost,...slabCols];
        });
        const csv = [headers.join(','),...rows.map(r => r.join(','))].join('\n');
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download=`OT_Detail_${startDate}_${endDate}.csv`; a.click();
      } else {
        const empMap = new Map<string, any>();
        filteredData.forEach((d: any) => {
          if (!empMap.has(d.employeeId)) empMap.set(d.employeeId,{id:d.employeeId,name:d.employeeName,dept:d.department,days:0,otHrs:0,otPay:0,fooding:0,total:0,slabs:{}});
          const e = empMap.get(d.employeeId)!; e.days++; e.otHrs+=d.overtimeHours; e.otPay+=d.otAmount; e.fooding+=d.foodingAmount; e.total+=d.totalCost;
          (d.slabBreakdown as OTSlabResult[]).forEach(s => { if(!e.slabs[s.slabName]) e.slabs[s.slabName]={hrs:0,amt:0}; e.slabs[s.slabName].hrs+=s.hours; e.slabs[s.slabName].amt+=s.amount; });
        });
        const headers = ['Emp ID','Name','Department','OT Days','Total OT Hrs','OT Pay','Fooding','Grand Total',...allSlabNames.flatMap(s=>[`${s} Hrs`,`${s} Pay`])];
        const dataRows = Array.from(empMap.values()).sort((a,b)=>b.total-a.total).map(e => {
          const slabCols = allSlabNames.flatMap(s=>[e.slabs[s]?.hrs?.toFixed(2)??0,e.slabs[s]?.amt??0]);
          return [e.id,`"${e.name}"`,`"${e.dept}"`,e.days,e.otHrs.toFixed(2),e.otPay,e.fooding,e.total,...slabCols];
        });
        const totalRow = ['','TOTAL','',Array.from(empMap.values()).reduce((s:number,e:any)=>s+e.days,0),Array.from(empMap.values()).reduce((s:number,e:any)=>s+e.otHrs,0).toFixed(2),stats.totalOtCost,stats.totalFoodingCost,stats.totalCost,...allSlabNames.flatMap(sName=>{const s=slabSummary.find(x=>x.name===sName);return[s?.hours.toFixed(2)??0,s?.amount??0];})];
        const csv = [headers.join(','),...dataRows.map(r=>r.join(',')),totalRow.join(',')].join('\n');
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download=`OT_Monthly_Summary_${startDate}_${endDate}.csv`; a.click();
      }
      setIsExporting(null);
    }, 600);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
          <div className="flex items-center px-2 gap-2 text-slate-500 border-r border-slate-200"><Calendar size={18} /></div>
          <input type="date" value={startDate} onChange={e=>onDateChange(e.target.value,endDate)} className="bg-white border border-slate-200 text-sm font-bold text-slate-700 py-1.5 px-3 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-sm min-w-[140px]" />
          <span className="text-slate-400 font-bold">-</span>
          <input type="date" value={endDate} onChange={e=>onDateChange(startDate,e.target.value)} className="bg-white border border-slate-200 text-sm font-bold text-slate-700 py-1.5 px-3 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-sm min-w-[140px]" />
        </div>
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input type="text" placeholder="Search employee..." value={employeeSearch} onChange={e=>setEmployeeSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none md:w-48" />
          </div>
          <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200">
            <Filter size={16} className="text-slate-400 ml-2" />
            <select value={departmentFilter} onChange={e=>setDepartmentFilter(e.target.value)} className="bg-transparent text-sm font-semibold text-slate-700 py-1.5 pr-4 pl-2 outline-none cursor-pointer">
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <button onClick={()=>handleExport('csv')} disabled={!!isExporting} className="px-4 py-2 bg-amber-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-amber-700 transition-colors shadow-lg shadow-amber-200 whitespace-nowrap">
            {isExporting==='csv'?<Loader2 size={16} className="animate-spin"/>:<Download size={16}/>} Detail CSV
          </button>
          <button onClick={()=>handleExport('monthly')} disabled={!!isExporting} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 whitespace-nowrap">
            {isExporting==='monthly'?<Loader2 size={16} className="animate-spin"/>:<Download size={16}/>} Monthly Summary
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100 col-span-2">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-1">Total OT + Fooding Cost</p>
              <div className="flex items-center gap-2"><IndianRupee size={28} className="text-amber-700"/><p className="text-4xl font-black text-slate-800">{stats.totalCost.toLocaleString()}</p></div>
            </div>
            <div className="text-right space-y-1">
              <div className="text-xs font-medium text-amber-700 bg-amber-100/50 px-2 py-1 rounded-lg">OT Pay: ₹{stats.totalOtCost.toLocaleString()}</div>
              <div className="text-xs font-medium text-orange-700 bg-orange-100/50 px-2 py-1 rounded-lg">Fooding: ₹{stats.totalFoodingCost.toLocaleString()}</div>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Hours Logged</p>
          <div className="flex items-center gap-2"><Clock size={24} className="text-indigo-600"/><p className="text-3xl font-black text-slate-800">{stats.totalHours.toFixed(1)}</p><span className="text-sm font-bold text-slate-400 self-end mb-1">hrs</span></div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Employees Contributing</p>
          <div className="flex items-center gap-2"><TrendingUp size={24} className="text-emerald-600"/><p className="text-3xl font-black text-slate-800">{stats.uniqueEmployees}</p></div>
        </div>
      </div>

      {/* Slab Summary */}
      {slabSummary.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3"><Layers size={16} className="text-indigo-600"/><h4 className="font-bold text-slate-700 text-sm uppercase tracking-wide">OT Slab Breakdown — Period Total</h4></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {slabSummary.map(s => {
              const c = slabColour(s.name);
              return (
                <div key={s.name} className={`p-4 rounded-2xl ${c.bg}`}>
                  <p className={`text-xs font-bold ${c.text} mb-2 uppercase tracking-wider flex items-center gap-1`}>{slabIcon(s.name)}{s.name}</p>
                  <div className="flex justify-between items-end">
                    <div><p className="text-xs text-slate-500">Hours</p><p className="text-xl font-black text-slate-800">{s.hours.toFixed(1)}</p></div>
                    <div className="text-right"><p className="text-xs text-slate-500">{s.multiplier}x</p><p className="text-xl font-black text-slate-800">₹{s.amount.toLocaleString()}</p></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm min-h-[300px]">
          <h4 className="font-bold text-slate-700 mb-6">OT Hours by Department</h4>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} tickFormatter={v=>v.split(' ')[0]}/><YAxis axisLine={false} tickLine={false} fontSize={12}/><Tooltip cursor={{fill:'#fef3c7'}} contentStyle={{borderRadius:'8px',border:'none'}}/><Bar dataKey="value" fill="#d97706" radius={[4,4,0,0]} barSize={40}/></BarChart>
            </ResponsiveContainer>
          ) : <div className="h-full flex items-center justify-center text-slate-400 text-sm">No data for range</div>}
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm min-h-[300px] flex flex-col">
          <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><User size={18} className="text-indigo-600"/> Top Contributors</h4>
          {employeeStats.length > 0 ? (
            <div className="space-y-4 overflow-y-auto flex-1 pr-2">
              {employeeStats.slice(0,6).map((emp,i) => (
                <div key={emp.id} className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 w-1/3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i<3?'bg-amber-100 text-amber-700':'bg-slate-100 text-slate-500'}`}>{i+1}</div>
                    <div className="truncate"><p className="text-xs font-bold text-slate-700 truncate">{emp.name}</p><p className="text-[9px] text-slate-400 uppercase">{emp.department}</p></div>
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between text-[10px] font-medium text-slate-500"><span>{emp.hours.toFixed(1)} hrs</span><span>₹{emp.cost.toLocaleString()}</span></div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="bg-indigo-500 h-full rounded-full" style={{width:`${(emp.hours/maxTotalHours)*100}%`}}/></div>
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="h-full flex items-center justify-center text-slate-400 text-sm">No data found</div>}
        </div>
      </div>

      {/* Detailed Register */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <h3 className="font-bold text-slate-700">Detailed OT Register</h3>
          <span className="text-xs font-bold text-slate-400 bg-white px-2 py-1 rounded border border-slate-200">{filteredData.length} records</span>
        </div>
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-left">
            <thead className="bg-white sticky top-0 z-10">
              <tr className="text-xs font-bold text-slate-500 uppercase border-b border-slate-100">
                <th className="px-6 py-4">Date</th><th className="px-6 py-4">Employee</th><th className="px-6 py-4">OT Hours</th><th className="px-6 py-4">Slab Split</th><th className="px-6 py-4 text-right">OT Pay</th><th className="px-6 py-4 text-right">Fooding</th><th className="px-6 py-4 text-right">Total</th><th className="px-6 py-4 text-center">Status</th><th className="px-3 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm">
              {filteredData.length === 0 ? (
                <tr><td colSpan={9} className="px-6 py-12 text-center text-slate-400 italic">No overtime records found for this period.</td></tr>
              ) : filteredData.map((item: any, idx: number) => {
                const rowKey = `${item.employeeId}-${item.date}`;
                const isExpanded = expandedRow === rowKey;
                return (
                  <React.Fragment key={idx}>
                    <tr className="hover:bg-amber-50/30 transition-colors cursor-pointer" onClick={()=>setExpandedRow(isExpanded?null:rowKey)}>
                      <td className="px-6 py-4 text-slate-500 font-mono text-xs">{item.date}</td>
                      <td className="px-6 py-4"><div className="font-bold text-slate-700">{item.employeeName}</div><div className="text-[10px] text-slate-400">{item.department}</div></td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-slate-700 w-8 text-right">{item.overtimeHours}</span>
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full w-20 overflow-hidden"><div className={`h-full rounded-full ${item.overtimeHours>4?'bg-rose-500':item.overtimeHours>2?'bg-amber-500':'bg-emerald-500'}`} style={{width:`${Math.min((item.overtimeHours/maxDailyHours)*100,100)}%`}}/></div>
                          {item.overtimeHours>4&&<AlertTriangle size={14} className="text-rose-500"/>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {item.hasSlabs?(
                          <div className="flex flex-wrap gap-1">{(item.slabBreakdown as OTSlabResult[]).map((s,si)=>{const c=slabColour(s.slabName);return(<span key={si} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>{slabIcon(s.slabName)}{s.hours}h</span>);})}</div>
                        ):<span className="text-xs text-slate-400">Flat rate</span>}
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-slate-600">{item.isOtAllowed?`₹${item.otAmount.toLocaleString()}`:<span className="text-slate-300">₹0</span>}</td>
                      <td className="px-6 py-4 text-right font-medium text-orange-600">{item.foodingAmount>0?`+₹${item.foodingAmount}`:<span className="text-slate-200">-</span>}</td>
                      <td className="px-6 py-4 text-right"><span className={`font-black ${item.totalCost>1000?'text-indigo-600':'text-slate-800'}`}>{item.isOtAllowed?`₹${item.totalCost.toLocaleString()}`:<span className="text-slate-300">₹0</span>}</span></td>
                      <td className="px-6 py-4 text-center">{item.isOtAllowed?<span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-[10px] font-bold uppercase">Approved</span>:<span className="px-2 py-1 bg-red-100 text-red-700 rounded text-[10px] font-bold uppercase flex items-center justify-center gap-1"><AlertCircle size={10}/> Disallowed</span>}</td>
                      <td className="px-3 py-4 text-slate-400">{item.hasSlabs&&(isExpanded?<ChevronUp size={14}/>:<ChevronDown size={14}/>)}</td>
                    </tr>
                    {isExpanded&&item.hasSlabs&&(
                      <tr className="bg-indigo-50/40">
                        <td colSpan={9} className="px-6 py-3">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            {(item.slabBreakdown as OTSlabResult[]).map((s,si)=>{const c=slabColour(s.slabName);return(<div key={si} className={`flex items-center justify-between p-3 rounded-xl ${c.bg}`}><div><p className={`text-[10px] font-black uppercase tracking-wider ${c.text} flex items-center gap-1`}>{slabIcon(s.slabName)}{s.slabName}</p><p className="text-xs text-slate-600 mt-0.5">{s.hours} hrs × {s.multiplier}x</p></div><p className="text-sm font-black text-slate-800">₹{s.amount.toLocaleString()}</p></div>);})}
                            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800 md:col-span-4 mt-1">
                              <p className="text-xs font-bold text-slate-300 uppercase tracking-wide">Day Total</p>
                              <p className="text-sm font-black text-white">{(item.slabBreakdown as OTSlabResult[]).reduce((s:number,b:OTSlabResult)=>s+b.hours,0).toFixed(2)} hrs → ₹{item.totalCost.toLocaleString()}</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default OvertimeModule;
