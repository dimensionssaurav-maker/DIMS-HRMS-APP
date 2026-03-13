import React, { useState, useMemo } from 'react';
import { IndianRupee, Download, Building2, TrendingUp, Users, Filter, ChevronDown } from 'lucide-react';
import { Employee } from '../types';

interface PayrollEntry {
  employeeId: string;
  month: string;
  year: number;
  netPayable: number;
  serviceCharge: number;
  grossSalary: number;
  daysPresent: number;
}

interface Props {
  payroll: PayrollEntry[];
  employees: Employee[];
  year: number;
  month: string;
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const ServiceChargeReportSection: React.FC<Props> = ({ payroll, employees, year, month }) => {
  const [filterSource, setFilterSource] = useState('All');
  const [filterDept, setFilterDept] = useState('All');
  const [selectedMonth, setSelectedMonth] = useState(month);
  const [selectedYear, setSelectedYear] = useState(year);

  const departments = useMemo(() => {
    const depts = ['All', ...Array.from(new Set(employees.map(e => e.department).filter(Boolean)))];
    return depts;
  }, [employees]);

  const sources = useMemo(() => {
    const srcs = ['All', ...Array.from(new Set(employees.map(e => e.source).filter(Boolean) as string[]))];
    return srcs;
  }, [employees]);

  const reportData = useMemo(() => {
    return employees
      .filter(emp => {
        if (filterSource !== 'All' && emp.source !== filterSource) return false;
        if (filterDept !== 'All' && emp.department !== filterDept) return false;
        return true;
      })
      .map(emp => {
        const p = payroll.find(p => p.employeeId === emp.id);
        const rate = emp.serviceChargeRate ?? 0;
        const net = p?.netPayable ?? 0;
        const charge = p?.serviceCharge ?? Math.round(net * rate * 100) / 100;
        return {
          emp,
          net,
          charge,
          rate,
          source: emp.source || '—',
          daysPresent: p?.daysPresent ?? 0,
          gross: p?.grossSalary ?? 0,
        };
      })
      .filter(r => r.rate > 0 || r.charge > 0) // only employees with service charge
      .sort((a, b) => b.charge - a.charge);
  }, [employees, payroll, filterSource, filterDept]);

  const totals = useMemo(() => ({
    employees: reportData.length,
    totalNet: reportData.reduce((s, r) => s + r.net, 0),
    totalCharge: reportData.reduce((s, r) => s + r.charge, 0),
    totalGross: reportData.reduce((s, r) => s + r.gross, 0),
  }), [reportData]);

  // Group by source for summary
  const bySource = useMemo(() => {
    const map: Record<string, { count: number; charge: number; net: number }> = {};
    reportData.forEach(r => {
      const src = r.source || '—';
      if (!map[src]) map[src] = { count: 0, charge: 0, net: 0 };
      map[src].count++;
      map[src].charge += r.charge;
      map[src].net += r.net;
    });
    return Object.entries(map).sort((a, b) => b[1].charge - a[1].charge);
  }, [reportData]);

  const exportCSV = () => {
    const headers = ['Employee', 'ID', 'Department', 'Designation', 'Source', 'Rate (%)', 'Days Present', 'Gross Salary', 'Net Payable', 'Service Charge'];
    const rows = reportData.map(r => [
      r.emp.name,
      r.emp.employeeCode || r.emp.id,
      r.emp.department,
      r.emp.designation,
      r.source,
      (r.rate * 100).toFixed(2) + '%',
      r.daysPresent,
      r.gross.toFixed(2),
      r.net.toFixed(2),
      r.charge.toFixed(2),
    ]);
    rows.push(['', '', '', '', '', '', '', 'TOTAL', totals.totalNet.toFixed(2), totals.totalCharge.toFixed(2)]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `service_charge_${selectedYear}_${selectedMonth}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">

      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <IndianRupee size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800">Service Charge Report</h3>
              <p className="text-sm text-slate-500">Agency / recruitment service charges per employee for {selectedMonth} {selectedYear}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Month selector */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
                className="bg-transparent text-sm font-bold text-slate-700 outline-none">
                {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
                className="bg-transparent text-sm font-bold text-slate-700 outline-none">
                {[2023,2024,2025,2026].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <button onClick={exportCSV}
              className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-sm">
              <Download size={16} /> Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Employees', value: totals.employees, icon: Users, color: 'indigo', suffix: '' },
          { label: 'Total Gross Salary', value: `₹${totals.totalGross.toLocaleString('en-IN', {maximumFractionDigits:0})}`, icon: IndianRupee, color: 'blue', suffix: '' },
          { label: 'Total Net Payable', value: `₹${totals.totalNet.toLocaleString('en-IN', {maximumFractionDigits:0})}`, icon: TrendingUp, color: 'emerald', suffix: '' },
          { label: 'Total Service Charge', value: `₹${totals.totalCharge.toLocaleString('en-IN', {maximumFractionDigits:0})}`, icon: IndianRupee, color: 'amber', suffix: '' },
        ].map(card => {
          const Icon = card.icon;
          const colorMap: Record<string, string> = {
            indigo: 'bg-indigo-50 text-indigo-600',
            blue: 'bg-blue-50 text-blue-600',
            emerald: 'bg-emerald-50 text-emerald-700',
            amber: 'bg-amber-50 text-amber-700',
          };
          return (
            <div key={card.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${colorMap[card.color]}`}>
                <Icon size={20} />
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{card.label}</p>
              <p className="text-2xl font-black text-slate-800">{card.value}</p>
            </div>
          );
        })}
      </div>

      {/* By Source Breakdown */}
      {bySource.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h4 className="text-sm font-bold text-slate-700 uppercase tracking-widest mb-4">Charge Breakdown by Source</h4>
          <div className="space-y-3">
            {bySource.map(([src, data]) => {
              const pct = totals.totalCharge > 0 ? (data.charge / totals.totalCharge) * 100 : 0;
              return (
                <div key={src} className="flex items-center gap-4">
                  <div className="w-32 shrink-0">
                    <p className="text-sm font-bold text-slate-700 truncate">{src}</p>
                    <p className="text-xs text-slate-400">{data.count} employee{data.count !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}></div>
                  </div>
                  <div className="text-right w-28 shrink-0">
                    <p className="text-sm font-black text-slate-800">₹{data.charge.toLocaleString('en-IN', {maximumFractionDigits:0})}</p>
                    <p className="text-xs text-slate-400">{pct.toFixed(1)}%</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm items-center">
        <Filter size={16} className="text-slate-400" />
        <span className="text-xs font-bold text-slate-500 uppercase">Filter:</span>
        <select value={filterSource} onChange={e => setFilterSource(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 outline-none">
          {sources.map(s => <option key={s} value={s}>{s === 'All' ? 'All Sources' : s}</option>)}
        </select>
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 outline-none">
          {departments.map(d => <option key={d} value={d}>{d === 'All' ? 'All Departments' : d}</option>)}
        </select>
        {(filterSource !== 'All' || filterDept !== 'All') && (
          <button onClick={() => { setFilterSource('All'); setFilterDept('All'); }}
            className="text-xs font-bold text-red-500 hover:text-red-700 px-3 py-1.5 bg-red-50 rounded-xl transition-all">
            Clear Filters
          </button>
        )}
        <span className="ml-auto text-xs text-slate-400 font-medium">{reportData.length} records</span>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-800 text-white text-xs font-bold uppercase tracking-wider">
                <th className="px-5 py-4">Employee</th>
                <th className="px-5 py-4">Department</th>
                <th className="px-5 py-4">Source</th>
                <th className="px-5 py-4 text-center">Rate</th>
                <th className="px-5 py-4 text-center">Days</th>
                <th className="px-5 py-4 text-right">Gross Salary</th>
                <th className="px-5 py-4 text-right">Net Payable</th>
                <th className="px-5 py-4 text-right bg-amber-900/40">Service Charge</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {reportData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <IndianRupee size={32} className="text-slate-200" />
                      <p className="text-slate-400 font-medium text-sm">No service charge records found.</p>
                      <p className="text-slate-300 text-xs">Set a service charge rate on employees to see this report.</p>
                    </div>
                  </td>
                </tr>
              ) : reportData.map((r, i) => (
                <tr key={r.emp.id} className={`hover:bg-amber-50/30 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-black shrink-0">
                        {r.emp.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">{r.emp.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{r.emp.employeeCode || r.emp.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <Building2 size={13} className="text-slate-300" />
                      <span className="text-slate-600 font-medium">{r.emp.department}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{r.emp.designation}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    {r.source !== '—' ? (
                      <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-100">
                        {r.source}
                      </span>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs font-black border border-amber-100">
                      {(r.rate * 100).toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span className="font-bold text-slate-700">{r.daysPresent}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono font-semibold text-slate-600">
                    ₹{r.gross.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono font-semibold text-slate-700">
                    ₹{r.net.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-5 py-3.5 text-right bg-amber-50/50">
                    <p className="font-black text-amber-700 text-base">
                      ₹{r.charge.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Total Footer */}
            {reportData.length > 0 && (
              <tfoot>
                <tr className="bg-slate-800 text-white font-bold text-sm">
                  <td colSpan={5} className="px-5 py-4 font-black uppercase tracking-widest text-xs text-slate-300">
                    TOTAL — {reportData.length} Employees
                  </td>
                  <td className="px-5 py-4 text-right font-mono font-black">
                    ₹{totals.totalGross.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-5 py-4 text-right font-mono font-black">
                    ₹{totals.totalNet.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-5 py-4 text-right bg-amber-900/40">
                    <p className="font-black text-amber-300 text-lg">
                      ₹{totals.totalCharge.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </p>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default ServiceChargeReportSection;
