
import React, { useMemo, useState } from 'react';
import { 
  Banknote, 
  Download, 
  FileText, 
  Loader2, 
  Filter, 
  Search 
} from 'lucide-react';
import { Loan, Employee, LoanType } from '../types';

interface Props {
  loans: Loan[];
  employees: Employee[];
}

const LoanRecoveryReportSection: React.FC<Props> = ({ loans, employees }) => {
  const [filterEmployee, setFilterEmployee] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Active' | 'Recovered'>('All');
  const [isExporting, setIsExporting] = useState<string | null>(null);

  const getEmployeeName = (id: string) => employees.find(e => e.id === id)?.name || 'Unknown';

  const processedData = useMemo(() => {
    const today = new Date();
    
    return loans.map(loan => {
      const issueDate = new Date(loan.issueDate);
      const endDate = new Date(issueDate);
      endDate.setMonth(endDate.getMonth() + loan.tenureMonths);
      
      const monthsPassed = (today.getFullYear() - issueDate.getFullYear()) * 12 + (today.getMonth() - issueDate.getMonth());
      
      const effectiveMonthsPassed = Math.min(Math.max(monthsPassed, 0), loan.tenureMonths);
      const progress = (effectiveMonthsPassed / loan.tenureMonths) * 100;
      const recoveredAmount = (loan.amount / loan.tenureMonths) * effectiveMonthsPassed;
      
      const isRecovered = progress >= 99.9 || today > endDate;
      const remainingBalance = loan.amount - recoveredAmount;

      return {
        ...loan,
        employeeName: getEmployeeName(loan.employeeId),
        recoveredAmount,
        remainingBalance,
        endDate,
        isRecovered,
        status: isRecovered ? 'Recovered' : 'Active'
      };
    }).filter(item => {
      const matchEmployee = filterEmployee === 'All' || item.employeeId === filterEmployee;
      const matchStatus = filterStatus === 'All' || 
                          (filterStatus === 'Active' && !item.isRecovered) || 
                          (filterStatus === 'Recovered' && item.isRecovered);
      return matchEmployee && matchStatus;
    });
  }, [loans, employees, filterEmployee, filterStatus]);

  const handleExport = (type: 'csv' | 'pdf') => {
    setIsExporting(type);
    
    setTimeout(() => {
      if (type === 'csv') {
        const headers = ['Loan ID', 'Employee', 'Type', 'Issue Date', 'Amount', 'Recovered', 'Balance', 'End Date', 'Status'];
        const rows = processedData.map(d => [
            d.id,
            `"${d.employeeName}"`,
            d.type,
            d.issueDate,
            d.amount.toFixed(2),
            d.recoveredAmount.toFixed(2),
            d.remainingBalance.toFixed(2),
            d.endDate.toISOString().split('T')[0],
            d.status
        ]);
        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Loan_Recovery_Report_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
      } else {
        alert(`Loan Recovery Report downloaded as PDF.`);
      }
      setIsExporting(null);
    }, 1500);
  };

  const totalOutstanding = processedData.reduce((sum, item) => sum + item.remainingBalance, 0);
  const totalRecovered = processedData.reduce((sum, item) => sum + item.recoveredAmount, 0);

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm mb-8 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Banknote size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-800">Loan Recovery Report</h3>
            <p className="text-sm text-slate-500">Track advances and loan repayments</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
             <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-100">
                <Filter size={14} className="text-slate-400 ml-2" />
                <select 
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="bg-transparent text-xs font-bold text-slate-600 py-1.5 pr-2 outline-none cursor-pointer"
                >
                  <option value="All">All Status</option>
                  <option value="Active">Active</option>
                  <option value="Recovered">Recovered</option>
                </select>
             </div>

             <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-100">
                <Search size={14} className="text-slate-400 ml-2" />
                <select 
                  value={filterEmployee}
                  onChange={(e) => setFilterEmployee(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-600 py-1.5 pr-2 outline-none cursor-pointer max-w-[150px]"
                >
                  <option value="All">All Employees</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
             </div>

           <button 
             onClick={() => handleExport('pdf')}
             disabled={!!isExporting}
             className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-500 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-100 rounded-xl transition-all flex items-center gap-2"
           >
             {isExporting === 'pdf' ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
             PDF
           </button>
           <button 
             onClick={() => handleExport('csv')}
             disabled={!!isExporting}
             className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-white bg-indigo-600 hover:bg-indigo-700 border border-indigo-600 rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-indigo-200"
           >
             {isExporting === 'csv' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
             CSV
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
         <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Outstanding</p>
             <p className="text-xl font-black text-rose-600">₹{totalOutstanding.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
         </div>
         <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Recovered</p>
             <p className="text-xl font-black text-emerald-600">₹{totalRecovered.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
         </div>
         <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Records</p>
             <p className="text-xl font-black text-slate-800">{processedData.length}</p>
         </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-xs text-slate-400 uppercase border-b border-slate-100">
              <th className="py-3 px-2 font-bold">Employee</th>
              <th className="py-3 px-2 font-bold">Type</th>
              <th className="py-3 px-2 font-bold text-right">Original Amount</th>
              <th className="py-3 px-2 font-bold text-right">Recovered</th>
              <th className="py-3 px-2 font-bold text-right">Balance</th>
              <th className="py-3 px-2 font-bold text-center">End Date</th>
              <th className="py-3 px-2 font-bold text-center">Status</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {processedData.length === 0 ? (
               <tr>
                 <td colSpan={7} className="py-8 text-center text-slate-400 italic">No loan records found matching filters.</td>
               </tr>
            ) : processedData.map((item) => (
              <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                <td className="py-3 px-2">
                   <div className="font-bold text-slate-700">{item.employeeName}</div>
                   <div className="text-[10px] text-slate-400 font-mono">#{item.id.substring(0,6)}</div>
                </td>
                <td className="py-3 px-2">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider ${item.type === 'Advance' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                    {item.type}
                  </span>
                </td>
                <td className="py-3 px-2 text-right font-medium text-slate-600">₹{item.amount.toLocaleString()}</td>
                <td className="py-3 px-2 text-right font-medium text-emerald-600">₹{Math.round(item.recoveredAmount).toLocaleString()}</td>
                <td className="py-3 px-2 text-right font-bold text-rose-500">₹{Math.round(item.remainingBalance).toLocaleString()}</td>
                <td className="py-3 px-2 text-center text-slate-500 font-medium">{item.endDate.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</td>
                <td className="py-3 px-2 text-center">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${item.isRecovered ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {item.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LoanRecoveryReportSection;
