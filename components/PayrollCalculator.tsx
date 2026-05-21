
import React, { useState, useMemo } from 'react';
import { 
  IndianRupee, 
  Search, 
  Eye, 
  Download, 
  Printer, 
  X, 
  ShieldCheck, 
  Wallet, 
  CreditCard, 
  FileText, 
  Loader2, 
  Building, 
  TrendingUp,
  Clock,
  Utensils,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Trash2
} from 'lucide-react';
import { Employee, PayrollCalculation, Loan, SiteExpense } from '../types';

interface Props {
  employees: Employee[];
  payroll: PayrollCalculation[];
  loans: Loan[];
  siteExpenses: SiteExpense[];
  onAddSiteExpense: (se: SiteExpense) => void;
  onDeleteSiteExpense: (id: string) => void;
  month: string;
  year: number;
  onMonthChange?: (month: string) => void;
  onYearChange?: (year: number) => void;
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const YEARS = [2023, 2024, 2025, 2026, 2027];

const PayrollCalculator: React.FC<Props> = ({
 employees, payroll, loans, siteExpenses, onAddSiteExpense, onDeleteSiteExpense, month, year, onMonthChange, onYearChange }) => {
  // ── Currency formatter: rounds to 2 dp, fixes float precision ──
  const fmt = (n: number): string => {
    const v = Math.round((n || 0) * 100) / 100;
    return v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const [searchTerm, setSearchTerm] = useState('');
  const [viewingPayslip, setViewingPayslip] = useState<PayrollCalculation | null>(null);
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [siteExpModal, setSiteExpModal] = useState<{empId: string; empName: string} | null>(null);
  const [siteForm, setSiteForm] = useState({ fromDate: '', toDate: '', foodingAmt: 0, travelAmt: 0, stayAmt: 0, miscAmt: 0, notes: '' });
  const [showSiteList, setShowSiteList] = useState<string | null>(null);

  const getEmployee = (id: string) => employees.find(e => e.id === id);

  const getSiteCash = (empId: string): number => {
    const mNum = MONTHS.indexOf(month) + 1;
    return (siteExpenses || []).filter(se => se.employeeId === empId && se.month === mNum && se.year === year)
      .reduce((sum, se) => sum + (se.foodingAmt||0) + (se.travelAmt||0) + (se.stayAmt||0) + (se.miscAmt||0), 0);
  };

  // Filter out LEAVERS and apply search
  const filteredPayroll = useMemo(() => {
    return payroll.filter(p => {
      const emp = getEmployee(p.employeeId);
      
      // Strict Check: Must exist and must be ACTIVE
      if (!emp || emp.status === 'Left') return false;

      return (
        emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.department.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  }, [payroll, employees, searchTerm]);

  // Calculate Column Totals for the Footer
  const columnTotals = useMemo(() => {
    return filteredPayroll.reduce((acc, curr) => ({
      gross: acc.gross + curr.grossSalary,
      overtimeHours: acc.overtimeHours + curr.totalOvertimeHours,
      overtime: acc.overtime + curr.overtimePay,
      fooding: acc.fooding + curr.foodingAllowance,
      expenseReimbursement: acc.expenseReimbursement + curr.expenseReimbursement,
      lateHours: acc.lateHours + (curr.lateHours || 0),
      lateDeduction: acc.lateDeduction + curr.lateDeduction,
      earlyHours: acc.earlyHours + (curr.earlyHours || 0),
      earlyDeduction: acc.earlyDeduction + curr.earlyDeduction,
      esicEmployee: acc.esicEmployee + curr.esicEmployeeShare,
      esicEmployer: acc.esicEmployer + curr.esicEmployerShare,
      lwfEmployee: acc.lwfEmployee + curr.lwfEmployeeShare,
      lwfEmployer: acc.lwfEmployer + curr.lwfEmployerShare,
      loanDeduction: acc.loanDeduction + curr.loanDeduction,
      serviceCharge: acc.serviceCharge + curr.serviceCharge,
      netPayable: acc.netPayable + curr.netPayable,
      siteCash: acc.siteCash + getSiteCash(curr.employeeId)
    }), { 
        gross: 0, 
        overtimeHours: 0, 
        overtime: 0, 
        fooding: 0,
        expenseReimbursement: 0, 
        lateHours: 0,
        lateDeduction: 0, 
        earlyHours: 0,
        earlyDeduction: 0,
        esicEmployee: 0, 
        esicEmployer: 0,
        lwfEmployee: 0, 
        lwfEmployer: 0,
        loanDeduction: 0, 
        serviceCharge: 0, 
        netPayable: 0,
        siteCash: 0
    });
  }, [filteredPayroll]);

  // Total Payout is based on filtered (Active) list only
  const totalPayout = filteredPayroll.reduce((sum, p) => sum + p.netPayable, 0);
  const totalEmployerESIC = filteredPayroll.reduce((sum, p) => sum + p.esicEmployerShare, 0);
  const totalEmployerLWF = filteredPayroll.reduce((sum, p) => sum + p.lwfEmployerShare, 0);
  const totalServiceCharge = filteredPayroll.reduce((sum, p) => sum + p.serviceCharge, 0);

  const handleExport = (type: 'csv' | 'pdf') => {
    setIsExporting(type);
    setTimeout(() => {
      if (type === 'csv') {
        const headers = [
          'Employee ID', 'Name', 'Department', 'Designation', 
          'Days Paid', 'Total Overtime Hours', 'Overtime Pay', 'Fooding Allow.', 'Expenses', 'Gross Salary', 
          'Late Pts', 'Late Deduction', 'Early Pts', 'Early Deduction', 'ESIC Employee', 'LWF Employee', 'Loan Deduct', 
          'Net Payable', 'Site Cash Paid', 'Bank Transfer', 'Service Charge', 'ESIC Employer', 'LWF Employer'
        ];
        const rows = filteredPayroll.map(p => {
          const emp = getEmployee(p.employeeId);
          return [
            emp?.employeeCode || p.employeeId,
            `"${emp?.name || ''}"`,
            `"${emp?.department || ''}"`,
            `"${emp?.designation || ''}"`,
            p.daysPresent + p.holidays,
            p.totalOvertimeHours,
            p.overtimePay,
            p.foodingAllowance,
            p.expenseReimbursement,
            p.grossSalary,
            p.lateCount || 0,
            p.lateDeduction,
            p.earlyCount || 0,
            p.earlyDeduction,
            p.esicEmployeeShare,
            p.lwfEmployeeShare,
            p.loanDeduction,
            p.netPayable,
            getSiteCash(p.employeeId),
            p.netPayable - getSiteCash(p.employeeId),
            p.serviceCharge,
            p.esicEmployerShare,
            p.lwfEmployerShare
          ].join(',');
        });
        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Payroll_${month}_${year}.csv`;
        link.click();
      } else {
        alert(`Payroll Report for ${month} ${year} exported as PDF.`);
      }
      setIsExporting(null);
    }, 1500);
  };

  const handlePrintPayslip = () => {
    window.print();
  };

  const handleDownloadPayslip = () => {
    if (viewingPayslip) {
       const emp = getEmployee(viewingPayslip.employeeId);
       alert(`Downloading Payslip PDF for ${emp?.name || 'Employee'}...`);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-indigo-600 p-6 rounded-2xl text-white shadow-lg shadow-indigo-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-white/20 p-2 rounded-xl">
              <Wallet size={20} />
            </div>
            <h3 className="font-bold text-indigo-100">Total Net Payout</h3>
          </div>
          <p className="text-3xl font-black">₹{totalPayout.toLocaleString()}</p>
          <p className="text-xs text-indigo-200 mt-1 font-medium">{month} {year}</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center transition-transform hover:scale-[1.02]">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-emerald-50 text-emerald-600 p-2 rounded-xl">
              <ShieldCheck size={20} />
            </div>
            <h3 className="font-bold text-slate-500 text-xs uppercase tracking-wider">Employer ESIC</h3>
          </div>
          <p className="text-2xl font-black text-slate-800">₹{totalEmployerESIC.toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-1 font-medium">3.25% Contribution</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center transition-transform hover:scale-[1.02]">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-cyan-50 text-cyan-600 p-2 rounded-xl">
              <Building size={20} />
            </div>
            <h3 className="font-bold text-slate-500 text-xs uppercase tracking-wider">Employer LWF</h3>
          </div>
          <p className="text-2xl font-black text-slate-800">₹{totalEmployerLWF.toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-1 font-medium">Welfare Fund</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center transition-transform hover:scale-[1.02]">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-amber-50 text-amber-600 p-2 rounded-xl">
              <CreditCard size={20} />
            </div>
            <h3 className="font-bold text-slate-500 text-xs uppercase tracking-wider">Service Charges</h3>
          </div>
          <p className="text-2xl font-black text-slate-800">₹{totalServiceCharge.toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-1 font-medium">Company Expense</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
         <div className="flex items-center gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Payroll Register</h3>
              <p className="text-sm text-slate-500">Process and manage salaries for {month} {year} (Active Employees Only)</p>
            </div>
         </div>

         <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto items-center">

            {/* ── Month / Year Switcher ── */}
            {onMonthChange && onYearChange && (
              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl p-1">
                <button
                  onClick={() => {
                    const idx = MONTHS.indexOf(month);
                    if (idx === 0) { onMonthChange(MONTHS[11]); onYearChange(year - 1); }
                    else onMonthChange(MONTHS[idx - 1]);
                  }}
                  className="p-1.5 hover:bg-white rounded-lg text-slate-500 hover:text-indigo-600 transition-all"
                ><ChevronLeft size={16} /></button>

                <select
                  value={month}
                  onChange={e => onMonthChange(e.target.value)}
                  className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer px-1"
                >
                  {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>

                <select
                  value={year}
                  onChange={e => onYearChange(Number(e.target.value))}
                  className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer px-1"
                >
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>

                <button
                  onClick={() => {
                    const idx = MONTHS.indexOf(month);
                    if (idx === 11) { onMonthChange(MONTHS[0]); onYearChange(year + 1); }
                    else onMonthChange(MONTHS[idx + 1]);
                  }}
                  className="p-1.5 hover:bg-white rounded-lg text-slate-500 hover:text-indigo-600 transition-all"
                ><ChevronRight size={16} /></button>
              </div>
            )}

            <div className="flex gap-2">
               <button 
                 onClick={() => handleExport('pdf')}
                 disabled={!!isExporting}
                 className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-500 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap"
               >
                 {isExporting === 'pdf' ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                 Export PDF
               </button>
               <button 
                 onClick={() => handleExport('csv')}
                 disabled={!!isExporting}
                 className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white bg-indigo-600 hover:bg-indigo-700 border border-indigo-600 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap shadow-lg shadow-indigo-200"
               >
                 {isExporting === 'csv' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                 Export CSV
               </button>
            </div>

            <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Search employee..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
             </div>
         </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Employee</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Days</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">OT Hrs</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">OT Pay</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Fooding</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Gross</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Expenses</th>
                <th className="px-4 py-4 text-xs font-bold text-rose-500 uppercase tracking-wider text-right">Late Pts</th>
                <th className="px-4 py-4 text-xs font-bold text-rose-500 uppercase tracking-wider text-right">Late Ded.</th>
                <th className="px-4 py-4 text-xs font-bold text-orange-500 uppercase tracking-wider text-right">Early Pts</th>
                <th className="px-4 py-4 text-xs font-bold text-orange-500 uppercase tracking-wider text-right">Early Ded.</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">ESIC (Emp)</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">LWF (Emp)</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Loans</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Net Pay</th>
                <th className="px-6 py-4 text-xs font-bold text-rose-600 uppercase tracking-wider text-right">Site Cash</th>
                <th className="px-6 py-4 text-xs font-bold text-emerald-600 uppercase tracking-wider text-right">Bank Transfer</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Svc Chg</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">ESIC (Emplr)</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">LWF (Emplr)</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredPayroll.length === 0 ? (
                  <tr>
                      <td colSpan={17} className="px-6 py-12 text-center text-slate-400 italic">
                          No payroll data available for active employees matching search.
                      </td>
                  </tr>
              ) : filteredPayroll.map((pay) => {
                const emp = getEmployee(pay.employeeId);
                if (!emp) return null;
                return (
                  <tr key={pay.employeeId} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">
                          {emp.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{emp.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{emp.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center text-sm font-medium text-slate-600">
                      {pay.daysPresent + pay.holidays}
                    </td>
                    <td className="px-6 py-4 text-center text-sm font-medium text-slate-600">
                      {pay.totalOvertimeHours}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-amber-600">
                      +₹{fmt(pay.overtimePay)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-orange-600">
                      {pay.foodingAllowance > 0 ? `+₹${pay.foodingAllowance.toLocaleString()}` : '-'}
                  </td>
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-slate-600">
                      ₹{fmt(pay.grossSalary)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-purple-600">
                      {pay.expenseReimbursement > 0 ? `+₹${pay.expenseReimbursement.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-4 py-4 text-right text-sm font-medium text-rose-500">
                      {pay.lateCount > 0 ? (
                        <span className="font-bold bg-rose-50 text-rose-600 px-2 py-0.5 rounded-lg">{pay.lateCount}</span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-4 text-right text-sm font-medium text-rose-500">
                      {pay.lateDeduction > 0 ? (
                        <span className="font-bold">-₹{fmt(pay.lateDeduction)}</span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-4 text-right text-sm font-medium text-orange-500">
                      {pay.earlyCount > 0 ? (
                        <span className="font-bold bg-orange-50 text-orange-600 px-2 py-0.5 rounded-lg">{pay.earlyCount}</span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-4 text-right text-sm font-medium text-orange-500">
                      {pay.earlyDeduction > 0 ? (
                        <span className="font-bold">-₹{fmt(pay.earlyDeduction)}</span>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-rose-500">
                      {pay.esicEmployeeShare > 0 ? `-₹${pay.esicEmployeeShare.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-rose-500">
                      {pay.lwfEmployeeShare > 0 ? `-₹${pay.lwfEmployeeShare.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-amber-500">
                      {pay.loanDeduction > 0 ? `-₹${pay.loanDeduction.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-black text-slate-800">
                      ₹{fmt(pay.netPayable)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-bold text-rose-600 relative">
                      <div className="flex items-center justify-end gap-1">
                        {getSiteCash(pay.employeeId) > 0 ? (
                          <button onClick={() => setShowSiteList(showSiteList === pay.employeeId ? null : pay.employeeId)}
                            className="text-rose-600 hover:underline text-sm font-bold">
                            -₹{fmt(getSiteCash(pay.employeeId))}
                          </button>
                        ) : <span className="text-slate-300">-</span>}
                        <button onClick={() => { setSiteExpModal({empId: pay.employeeId, empName: getEmployee(pay.employeeId)?.name || ""}); setSiteForm({fromDate:"",toDate:"",foodingAmt:0,travelAmt:0,stayAmt:0,miscAmt:0,notes:""}); }}
                          className="ml-1 p-1 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors" title="Add Site Expense">
                          <MapPin size={13} />
                        </button>
                      </div>
                      {showSiteList === pay.employeeId && (() => {
                        const mNum = MONTHS.indexOf(month)+1;
                        const list = (siteExpenses||[]).filter(se=>se.employeeId===pay.employeeId&&se.month===mNum&&se.year===year);
                        return list.length > 0 ? (
                          <div className="absolute z-10 bg-white border border-rose-100 rounded-xl shadow-xl p-3 mt-1 min-w-[260px] right-0">
                            {list.map(se => (
                              <div key={se.id} className="flex items-center justify-between text-xs py-1 border-b border-slate-50 last:border-0">
                                <div>
                                  <p className="font-bold text-slate-700">{se.fromDate} → {se.toDate}</p>
                                  <p className="text-slate-500">{[se.foodingAmt&&`F:₹${se.foodingAmt}`,se.travelAmt&&`T:₹${se.travelAmt}`,se.stayAmt&&`S:₹${se.stayAmt}`,se.miscAmt&&`M:₹${se.miscAmt}`].filter(Boolean).join(" | ")}</p>
                                  {se.notes && <p className="text-slate-400 italic">{se.notes}</p>}
                                </div>
                                <button onClick={()=>onDeleteSiteExpense(se.id)} className="text-slate-300 hover:text-red-500 ml-2"><Trash2 size={12}/></button>
                              </div>
                            ))}
                          </div>
                        ) : null;
                      })()}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-black text-emerald-700">
                      ₹{fmt(pay.netPayable - getSiteCash(pay.employeeId))}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-bold text-emerald-600">
                      ₹{fmt(pay.serviceCharge)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-bold text-slate-500">
                      ₹{fmt(pay.esicEmployerShare)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-bold text-slate-500">
                      ₹{fmt(pay.lwfEmployerShare)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => setViewingPayslip(pay)}
                        className="p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                        title="View Payslip"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-50 border-t-2 border-slate-100">
                <tr>
                  <td colSpan={2} className="px-6 py-4 text-sm font-bold text-slate-800 text-right uppercase tracking-wider">Totals:</td>
                  <td className="px-6 py-4 text-center text-sm font-bold text-slate-600">{columnTotals.overtimeHours}</td>
                  <td className="px-6 py-4 text-right text-sm font-bold text-amber-600">₹{columnTotals.overtime.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right text-sm font-bold text-orange-600">₹{columnTotals.fooding.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right text-sm font-bold text-slate-800">₹{columnTotals.gross.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right text-sm font-bold text-purple-600">+₹{columnTotals.expenseReimbursement.toLocaleString()}</td>
                  <td className="px-4 py-4 text-right text-sm font-bold text-rose-600">{filteredPayroll.reduce((s,p) => s + (p.lateCount||0), 0) > 0 ? filteredPayroll.reduce((s,p) => s + (p.lateCount||0), 0) : '-'}</td>
                  <td className="px-4 py-4 text-right text-sm font-bold text-rose-600">-₹{columnTotals.lateDeduction.toLocaleString()}</td>
                  <td className="px-4 py-4 text-right text-sm font-bold text-orange-600">{filteredPayroll.reduce((s,p) => s + (p.earlyCount||0), 0) > 0 ? filteredPayroll.reduce((s,p) => s + (p.earlyCount||0), 0) : '-'}</td>
                  <td className="px-4 py-4 text-right text-sm font-bold text-orange-600">-₹{columnTotals.earlyDeduction.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right text-sm font-bold text-rose-600">-₹{columnTotals.esicEmployee.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right text-sm font-bold text-rose-600">-₹{columnTotals.lwfEmployee.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right text-sm font-bold text-amber-600">-₹{columnTotals.loanDeduction.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right text-sm font-black text-slate-900">₹{columnTotals.netPayable.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right text-sm font-bold text-rose-600">-₹{fmt(columnTotals.siteCash)}</td>
                  <td className="px-6 py-4 text-right text-sm font-black text-emerald-700">₹{fmt(columnTotals.netPayable - columnTotals.siteCash)}</td>
                  <td className="px-6 py-4 text-right text-sm font-bold text-emerald-600">₹{columnTotals.serviceCharge.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right text-sm font-bold text-slate-600">₹{columnTotals.esicEmployer.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right text-sm font-bold text-slate-600">₹{columnTotals.lwfEmployer.toLocaleString()}</td>
                  <td></td>
                </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* LWF Contribution Summary Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-rose-50 p-5 rounded-2xl border border-rose-100 flex justify-between items-center group">
              <div className="flex items-center gap-4">
                  <div className="p-3 bg-rose-100 text-rose-600 rounded-xl group-hover:scale-110 transition-transform">
                      <TrendingUp size={20} />
                  </div>
                  <div>
                      <p className="text-xs font-bold text-rose-800 uppercase tracking-widest">Total Employee LWF</p>
                      <p className="text-sm text-rose-600/80 font-medium">Deducted from salaries</p>
                  </div>
              </div>
              <p className="text-2xl font-black text-rose-700">₹{columnTotals.lwfEmployee.toLocaleString()}</p>
          </div>

          <div className="bg-cyan-50 p-5 rounded-2xl border border-cyan-100 flex justify-between items-center group">
              <div className="flex items-center gap-4">
                  <div className="p-3 bg-cyan-100 text-cyan-600 rounded-xl group-hover:scale-110 transition-transform">
                      <Building size={20} />
                  </div>
                  <div>
                      <p className="text-xs font-bold text-cyan-800 uppercase tracking-widest">Total Employer LWF</p>
                      <p className="text-sm text-cyan-600/80 font-medium">Company Liability</p>
                  </div>
              </div>
              <p className="text-2xl font-black text-cyan-700">₹{columnTotals.lwfEmployer.toLocaleString()}</p>
          </div>
      </div>

      {/* Payslip Modal */}
      {viewingPayslip && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-slate-800 p-6 flex justify-between items-center text-white">
               <div className="flex items-center gap-3">
                 <div className="p-2 bg-white/10 rounded-xl">
                   <IndianRupee size={20} />
                 </div>
                 <div>
                   <h3 className="font-bold text-lg">Payslip</h3>
                   <p className="text-xs text-slate-400 font-mono uppercase tracking-widest">{month} {year}</p>
                 </div>
               </div>
               <div className="flex items-center gap-2">
                 <button 
                    onClick={handlePrintPayslip}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors" 
                    title="Print"
                 >
                   <Printer size={18} />
                 </button>
                 <button 
                    onClick={handleDownloadPayslip}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors" 
                    title="Download PDF"
                 >
                   <Download size={18} />
                 </button>
                 <button onClick={() => setViewingPayslip(null)} className="p-2 hover:bg-white/10 rounded-lg transition-colors ml-2">
                   <X size={20} />
                 </button>
               </div>
            </div>

            <div className="p-8 space-y-8">
              {/* Employee Details Header */}
              <div className="flex justify-between items-start pb-6 border-b border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-2xl font-black text-slate-300">
                    {getEmployee(viewingPayslip.employeeId)?.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold text-slate-800">{getEmployee(viewingPayslip.employeeId)?.name}</h2>
                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-bold font-mono border border-slate-200">
                            {viewingPayslip.employeeId}
                        </span>
                    </div>
                    <p className="text-sm text-slate-500 font-medium">{getEmployee(viewingPayslip.employeeId)?.designation}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] font-bold uppercase tracking-wider">
                          {getEmployee(viewingPayslip.employeeId)?.department}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Net Payable</p>
                  <p className="text-3xl font-black text-indigo-600">₹{viewingPayslip.netPayable.toLocaleString()}</p>
                  <p className="text-xs text-slate-400 mt-1">Paid Days: {viewingPayslip.daysPresent + viewingPayslip.holidays}</p>
                </div>
              </div>

              {/* Dedicated Overtime & Fooding Summary Section */}
              <div className="grid grid-cols-2 gap-4">
                 <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white text-amber-600 rounded-lg shadow-sm">
                           <Clock size={20} />
                        </div>
                        <div>
                           <h5 className="text-xs font-bold text-amber-600 uppercase tracking-widest">Overtime</h5>
                           <p className="text-sm font-medium text-slate-600">
                              Logged: <span className="font-bold text-slate-800">{viewingPayslip.totalOvertimeHours} hrs</span>
                           </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-lg font-black text-amber-600">+₹{viewingPayslip.overtimePay.toLocaleString()}</p>
                    </div>
                 </div>

                 <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white text-orange-600 rounded-lg shadow-sm">
                           <Utensils size={20} />
                        </div>
                        <div>
                           <h5 className="text-xs font-bold text-orange-600 uppercase tracking-widest">Fooding Allow.</h5>
                           <p className="text-sm font-medium text-slate-600">
                              Based on OT
                           </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-lg font-black text-orange-600">+₹{viewingPayslip.foodingAllowance.toLocaleString()}</p>
                    </div>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-12">
                {/* Earnings Breakdown */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Earnings</h5>
                    <div className="h-px flex-1 bg-slate-100 ml-4"></div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Basic & Allowances</span>
                      <span className="font-bold text-slate-700">₹{viewingPayslip.basicSalary.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Overtime Pay</span>
                      <span className="font-bold text-slate-700">₹{viewingPayslip.overtimePay.toLocaleString()}</span>
                    </div>
                    {viewingPayslip.foodingAllowance > 0 && (
                        <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Food Allowance</span>
                        <span className="font-bold text-slate-700">₹{viewingPayslip.foodingAllowance.toLocaleString()}</span>
                        </div>
                    )}
                    {viewingPayslip.expenseReimbursement > 0 && (
                        <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Expense Reimbursement</span>
                        <span className="font-bold text-purple-600">₹{viewingPayslip.expenseReimbursement.toLocaleString()}</span>
                        </div>
                    )}
                    <div className="flex justify-between text-sm pt-2 border-t border-slate-50">
                      <span className="font-bold text-slate-800">Gross Earnings</span>
                      <span className="font-bold text-slate-800">₹{viewingPayslip.grossSalary.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Deductions & Net */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Deductions</h5>
                    <div className="h-px flex-1 bg-slate-100 ml-4"></div>
                  </div>
                  <div className="space-y-2">
                    {viewingPayslip.lateDeduction > 0 && (
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500 flex items-center gap-2">
                              Late Deduction
                              <span className="text-[10px] bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded-full font-bold">
                                {viewingPayslip.lateCount} {viewingPayslip.lateCount === 1 ? 'instance' : 'instances'}
                              </span>
                            </span>
                            <span className="font-bold text-rose-600">-₹{viewingPayslip.lateDeduction.toLocaleString()}</span>
                        </div>
                    )}
                    {viewingPayslip.earlyDeduction > 0 && (
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500 flex items-center gap-2">
                              Early Exit Deduction
                              <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-bold">
                                {viewingPayslip.earlyCount} {viewingPayslip.earlyCount === 1 ? 'instance' : 'instances'}
                              </span>
                            </span>
                            <span className="font-bold text-rose-600">-₹{viewingPayslip.earlyDeduction.toLocaleString()}</span>
                        </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">ESIC Employee Share</span>
                      <span className="font-bold text-red-600">-₹{viewingPayslip.esicEmployeeShare.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Labor Welfare Fund</span>
                      <span className="font-bold text-red-600">-₹{viewingPayslip.lwfEmployeeShare.toLocaleString()}</span>
                    </div>
                    {viewingPayslip.loanDeduction > 0 && (
                       <div className="flex justify-between text-sm">
                         <span className="text-slate-500">Loan Repayment</span>
                         <span className="font-bold text-amber-600">-₹{viewingPayslip.loanDeduction.toLocaleString()}</span>
                       </div>
                    )}
                    <div className="flex justify-between text-sm pt-2 border-t border-slate-50">
                      <span className="font-bold text-slate-800">Total Deductions</span>
                      <span className="font-bold text-red-600">-₹{(viewingPayslip.esicEmployeeShare + viewingPayslip.loanDeduction + viewingPayslip.lwfEmployeeShare + viewingPayslip.lateDeduction + viewingPayslip.earlyDeduction).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Employer Contribution Section */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mt-4">
                 <div className="flex items-center gap-2 mb-3">
                    <ShieldCheck size={16} className="text-slate-400" />
                    <h5 className="text-xs font-bold text-slate-600 uppercase tracking-widest">Company Contributions & Fees</h5>
                 </div>
                 <div className="grid grid-cols-3 gap-4">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500 font-medium">ESIC Employer</span>
                        <span className="font-bold text-slate-800">₹{viewingPayslip.esicEmployerShare.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500 font-medium">LWF Employer</span>
                        <span className="font-bold text-slate-800">₹{viewingPayslip.lwfEmployerShare.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500 font-medium">Service Charge</span>
                        <span className="font-bold text-emerald-600">₹{viewingPayslip.serviceCharge.toLocaleString()}</span>
                    </div>
                 </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ── Site Expense Modal ── */}
      {siteExpModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-black text-slate-800">Site / Field Expense</h2>
                <p className="text-sm text-slate-500">{siteExpModal.empName} — {month} {year}</p>
              </div>
              <button onClick={() => setSiteExpModal(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors"><X size={18}/></button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">From Date</label>
                  <input type="date" value={siteForm.fromDate}
                    onChange={e => setSiteForm(p => ({...p, fromDate: e.target.value}))}
                    className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold outline-none focus:border-indigo-400" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">To Date</label>
                  <input type="date" value={siteForm.toDate}
                    onChange={e => setSiteForm(p => ({...p, toDate: e.target.value}))}
                    className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold outline-none focus:border-indigo-400" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Fooding ₹</label>
                  <input type="number" min="0" value={siteForm.foodingAmt || ''}
                    onChange={e => setSiteForm(p => ({...p, foodingAmt: parseFloat(e.target.value)||0}))}
                    className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold outline-none focus:border-indigo-400" placeholder="0" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Travel ₹</label>
                  <input type="number" min="0" value={siteForm.travelAmt || ''}
                    onChange={e => setSiteForm(p => ({...p, travelAmt: parseFloat(e.target.value)||0}))}
                    className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold outline-none focus:border-indigo-400" placeholder="0" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Stay ₹</label>
                  <input type="number" min="0" value={siteForm.stayAmt || ''}
                    onChange={e => setSiteForm(p => ({...p, stayAmt: parseFloat(e.target.value)||0}))}
                    className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold outline-none focus:border-indigo-400" placeholder="0" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Misc ₹</label>
                  <input type="number" min="0" value={siteForm.miscAmt || ''}
                    onChange={e => setSiteForm(p => ({...p, miscAmt: parseFloat(e.target.value)||0}))}
                    className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold outline-none focus:border-indigo-400" placeholder="0" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Notes</label>
                <input type="text" value={siteForm.notes}
                  onChange={e => setSiteForm(p => ({...p, notes: e.target.value}))}
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400" placeholder="e.g. Manesar site visit" />
              </div>

              <div className="bg-slate-50 rounded-xl px-4 py-3 flex justify-between items-center">
                <span className="text-sm font-bold text-slate-600">Total Cash Paid</span>
                <span className="text-xl font-black text-rose-600">
                  ₹{fmt((siteForm.foodingAmt||0)+(siteForm.travelAmt||0)+(siteForm.stayAmt||0)+(siteForm.miscAmt||0))}
                </span>
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => setSiteExpModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button
                disabled={!siteForm.fromDate || ((siteForm.foodingAmt||0)+(siteForm.travelAmt||0)+(siteForm.stayAmt||0)+(siteForm.miscAmt||0)) <= 0}
                onClick={() => {
                  const mNum = MONTHS.indexOf(month) + 1;
                  const se: SiteExpense = {
                    id: '',
                    employeeId: siteExpModal.empId,
                    month: mNum,
                    year,
                    fromDate: siteForm.fromDate,
                    toDate: siteForm.toDate || siteForm.fromDate,
                    foodingAmt: siteForm.foodingAmt,
                    travelAmt: siteForm.travelAmt,
                    stayAmt: siteForm.stayAmt,
                    miscAmt: siteForm.miscAmt,
                    notes: siteForm.notes,
                    createdAt: new Date().toISOString(),
                  };
                  onAddSiteExpense(se);
                  setSiteExpModal(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PayrollCalculator;
