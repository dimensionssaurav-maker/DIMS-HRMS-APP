
import React, { useState, useMemo } from 'react';
import { 
  Banknote, 
  Calendar, 
  User, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  Search,
  ArrowRight,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  Building2,
  Briefcase,
  Edit2
} from 'lucide-react';
import { Loan, Employee, LoanType } from '../types';

interface Props {
  loans: Loan[];
  employees: Employee[];
  onAdd: (loan: Loan) => void;
  onUpdate: (loan: Loan) => void;
  onDelete: (id: string) => void;
}

const LoanManagement: React.FC<Props> = ({ loans, employees, onAdd, onUpdate, onDelete }) => {
  const [activeTab, setActiveTab] = useState<'active' | 'recovered'>('active');
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedLoanId, setExpandedLoanId] = useState<string | null>(null);
  const [editingLoanId, setEditingLoanId] = useState<string | null>(null);

  const [newLoan, setNewLoan] = useState<Partial<Loan>>({
    type: LoanType.ADVANCE,
    amount: 0,
    tenureMonths: 1,
    issueDate: new Date().toISOString().split('T')[0]
  });

  const getEmployee = (id: string) => employees.find(e => e.id === id);

  const processedLoans = useMemo(() => {
    const today = new Date();
    
    return loans.map(loan => {
      const issueDate = new Date(loan.issueDate);
      const endDate = new Date(issueDate);
      endDate.setMonth(endDate.getMonth() + loan.tenureMonths);
      
      // Calculate progress based on full months passed (Payroll cycles)
      const monthsPassed = (today.getFullYear() - issueDate.getFullYear()) * 12 + (today.getMonth() - issueDate.getMonth());
      
      const effectiveMonthsPassed = Math.min(Math.max(monthsPassed, 0), loan.tenureMonths);
      const progress = (effectiveMonthsPassed / loan.tenureMonths) * 100;
      const recoveredAmount = (loan.amount / loan.tenureMonths) * effectiveMonthsPassed;
      
      // Consider recovered if 100% paid OR past end date
      const isRecovered = progress >= 99.9 || today > endDate;

      return { ...loan, isRecovered, progress, recoveredAmount, endDate };
    }).filter(l => {
       const emp = getEmployee(l.employeeId);
       return emp?.name.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [loans, employees, searchTerm]);

  const displayedLoans = processedLoans.filter(l => activeTab === 'recovered' ? l.isRecovered : !l.isRecovered);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLoan.employeeId || !newLoan.amount) return;
    
    if (editingLoanId) {
      onUpdate({
        id: editingLoanId,
        employeeId: newLoan.employeeId,
        amount: Number(newLoan.amount),
        type: newLoan.type as LoanType,
        issueDate: newLoan.issueDate!,
        tenureMonths: Number(newLoan.tenureMonths),
        description: newLoan.description
      });
    } else {
      onAdd({
        id: Math.random().toString(36).substr(2, 9),
        employeeId: newLoan.employeeId,
        amount: Number(newLoan.amount),
        type: newLoan.type as LoanType,
        issueDate: newLoan.issueDate!,
        tenureMonths: Number(newLoan.tenureMonths),
        description: newLoan.description
      });
    }
    
    setShowForm(false);
    setEditingLoanId(null);
    setNewLoan({ type: LoanType.ADVANCE, amount: 0, tenureMonths: 1, issueDate: new Date().toISOString().split('T')[0] });
  };

  const toggleExpand = (id: string) => {
    setExpandedLoanId(prev => prev === id ? null : id);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
             <Banknote className="text-indigo-600" />
             Loans & Advances
           </h2>
           <p className="text-slate-500">Manage employee advances and track recovery schedules.</p>
        </div>
        <button 
          onClick={() => {
            setEditingLoanId(null);
            setNewLoan({ type: LoanType.ADVANCE, amount: 0, tenureMonths: 1, issueDate: new Date().toISOString().split('T')[0] });
            setShowForm(true);
          }}
          className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
        >
          <Plus size={18} />
          Issue New
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
           <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Active</p>
           <p className="text-2xl font-black text-indigo-600 mt-1">
             ₹{processedLoans.filter(l => !l.isRecovered).reduce((sum, l) => sum + (l.amount - l.recoveredAmount), 0).toLocaleString()}
           </p>
           <p className="text-xs text-indigo-400 mt-1">Outstanding Balance</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
           <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Recovered (YTD)</p>
           <p className="text-2xl font-black text-emerald-600 mt-1">
             ₹{processedLoans.reduce((sum, l) => sum + l.recoveredAmount, 0).toLocaleString()}
           </p>
           <p className="text-xs text-emerald-500 mt-1">Total Collections</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
           <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Active Accounts</p>
           <p className="text-2xl font-black text-slate-800 mt-1">
             {processedLoans.filter(l => !l.isRecovered).length}
           </p>
           <p className="text-xs text-slate-400 mt-1">Employees with dues</p>
        </div>
      </div>

      {/* List Controls */}
      <div className="bg-white rounded-2xl border border-slate-100 p-1 flex flex-col md:flex-row gap-4">
        <div className="flex p-1 bg-slate-50 rounded-xl w-full md:w-auto">
          <button 
            onClick={() => setActiveTab('active')}
            className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'active' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Active / Pending
          </button>
          <button 
            onClick={() => setActiveTab('recovered')}
            className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'recovered' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Fully Recovered
          </button>
        </div>
        
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text" 
            placeholder="Search employee..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border-none rounded-xl pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
          />
        </div>
      </div>

      {/* Loan List */}
      <div className="grid grid-cols-1 gap-4">
        {displayedLoans.length === 0 ? (
           <div className="bg-slate-50 rounded-2xl p-12 text-center text-slate-400 border border-dashed border-slate-200">
             <CheckCircle2 size={48} className="mx-auto mb-3 opacity-20" />
             <p className="font-medium">No {activeTab} records found.</p>
           </div>
        ) : displayedLoans.map(loan => {
           const emp = getEmployee(loan.employeeId);
           const isExpanded = expandedLoanId === loan.id;
           const monthlyInstallment = Math.round(loan.amount / loan.tenureMonths);
           const remainingBalance = Math.round(loan.amount - loan.recoveredAmount);

           return (
             <div 
                key={loan.id} 
                onClick={() => toggleExpand(loan.id)}
                className={`bg-white p-6 rounded-2xl border shadow-sm transition-all cursor-pointer ${isExpanded ? 'border-indigo-200 ring-4 ring-indigo-50/50' : 'border-slate-100 hover:shadow-md'}`}
             >
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-4 w-full md:w-1/3">
                    <div className={`p-3 rounded-xl ${loan.type === LoanType.ADVANCE ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                       <Banknote size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800">{emp?.name}</h4>
                      <div className="flex items-center gap-2">
                         <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${loan.type === LoanType.ADVANCE ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{loan.type}</span>
                         <span className="text-xs text-slate-500 font-medium">#{loan.id.substring(0,6)}</span>
                         <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ml-1 ${loan.isRecovered ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                           {loan.isRecovered ? 'PAID' : 'ACTIVE'}
                         </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 w-full grid grid-cols-2 md:grid-cols-4 gap-4">
                     <div>
                       <p className="text-[10px] text-slate-400 font-bold uppercase">Amount</p>
                       <p className="font-black text-slate-800">₹{loan.amount.toLocaleString()}</p>
                     </div>
                     <div>
                       <p className="text-[10px] text-slate-400 font-bold uppercase">Monthly Deduct</p>
                       <p className="font-bold text-red-500">₹{monthlyInstallment.toLocaleString()}</p>
                     </div>
                     <div>
                       <p className="text-[10px] text-slate-400 font-bold uppercase">Recovered</p>
                       <p className="font-bold text-emerald-600">₹{Math.round(loan.recoveredAmount).toLocaleString()}</p>
                     </div>
                     <div>
                       <p className="text-[10px] text-slate-400 font-bold uppercase">Ends By</p>
                       <p className="font-bold text-slate-700">{loan.endDate.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</p>
                     </div>
                  </div>

                  <div className="w-full md:w-48 flex items-center gap-4">
                     <div className="flex-1 space-y-2">
                        <div className="flex justify-between text-xs font-bold text-slate-500">
                           <span>Recovery</span>
                           <span>{Math.round(loan.progress)}%</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                           <div 
                              className={`h-full rounded-full ${loan.isRecovered ? 'bg-emerald-500' : 'bg-indigo-500'}`} 
                              style={{ width: `${loan.progress}%` }}
                           ></div>
                        </div>
                     </div>
                     <div className="flex items-center gap-2">
                        <button
                           onClick={(e) => {
                             e.stopPropagation();
                             setEditingLoanId(loan.id);
                             setNewLoan({
                               employeeId: loan.employeeId,
                               type: loan.type,
                               amount: loan.amount,
                               tenureMonths: loan.tenureMonths,
                               issueDate: loan.issueDate,
                               description: loan.description
                             });
                             setShowForm(true);
                           }}
                           className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                           <Edit2 size={18} />
                        </button>
                        <div className="text-slate-300">
                            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </div>
                     </div>
                  </div>
                </div>

                {/* Expanded Details View */}
                {isExpanded && (
                  <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-top-2 duration-300">
                     <div className="bg-slate-50 rounded-xl p-5 space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                           <User size={16} className="text-indigo-600" />
                           <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Employee Details</h5>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <div>
                              <p className="text-[10px] text-slate-400 font-bold uppercase">Full Name</p>
                              <p className="text-sm font-bold text-slate-800">{emp?.name}</p>
                           </div>
                           <div>
                              <p className="text-[10px] text-slate-400 font-bold uppercase">Employee ID</p>
                              <p className="text-sm font-bold text-slate-800">{emp?.id}</p>
                           </div>
                           <div className="flex items-center gap-2">
                              <Building2 size={14} className="text-slate-400" />
                              <div>
                                 <p className="text-[10px] text-slate-400 font-bold uppercase">Department</p>
                                 <p className="text-sm font-bold text-slate-800">{emp?.department}</p>
                              </div>
                           </div>
                           <div className="flex items-center gap-2">
                              <Briefcase size={14} className="text-slate-400" />
                              <div>
                                 <p className="text-[10px] text-slate-400 font-bold uppercase">Designation</p>
                                 <p className="text-sm font-bold text-slate-800">{emp?.designation}</p>
                              </div>
                           </div>
                        </div>
                     </div>

                     <div className="bg-slate-50 rounded-xl p-5 space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                           <AlertCircle size={16} className="text-indigo-600" />
                           <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Repayment Breakdown</h5>
                        </div>
                        <div className="space-y-3">
                           <div className="flex justify-between items-center text-sm">
                              <span className="text-slate-500">Total Loan Amount</span>
                              <span className="font-bold text-slate-800">₹{loan.amount.toLocaleString()}</span>
                           </div>
                           <div className="flex justify-between items-center text-sm">
                              <span className="text-slate-500">Tenure</span>
                              <span className="font-bold text-slate-800">{loan.tenureMonths} Months</span>
                           </div>
                           <div className="flex justify-between items-center text-sm">
                              <span className="text-slate-500">Monthly Installment</span>
                              <span className="font-bold text-indigo-600">₹{monthlyInstallment.toLocaleString()} / month</span>
                           </div>
                           <div className="h-px bg-slate-200 my-2"></div>
                           <div className="flex justify-between items-center">
                              <span className="text-sm font-bold text-slate-600">Remaining Balance</span>
                              <span className="text-lg font-black text-rose-500">₹{remainingBalance.toLocaleString()}</span>
                           </div>
                        </div>
                     </div>
                     
                     {loan.description && (
                        <div className="md:col-span-2 bg-amber-50 rounded-xl p-4 border border-amber-100 flex items-start gap-3">
                           <div className="mt-0.5">
                              <AlertCircle size={16} className="text-amber-500" />
                           </div>
                           <div>
                              <p className="text-xs font-bold text-amber-500 uppercase tracking-wide">Note / Description</p>
                              <p className="text-sm text-amber-900 mt-1">{loan.description}</p>
                           </div>
                        </div>
                     )}
                  </div>
                )}
             </div>
           );
        })}
      </div>

      {/* New Loan Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-6 animate-in zoom-in-95">
              <h3 className="text-xl font-bold text-slate-800 mb-6">{editingLoanId ? 'Edit Loan Details' : 'Issue New Advance/Loan'}</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                   <label className="text-xs font-bold text-slate-500 uppercase">Employee</label>
                   <select 
                     required
                     className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none"
                     onChange={e => setNewLoan({...newLoan, employeeId: e.target.value})}
                     value={newLoan.employeeId || ''}
                     disabled={!!editingLoanId} // Disable employee selection during edit
                   >
                     <option value="">Select Employee</option>
                     {employees.map(e => (
                       <option key={e.id} value={e.id}>{e.name} ({e.department})</option>
                     ))}
                   </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div>
                      <label className="text-xs font-bold text-slate-500 uppercase">Type</label>
                      <div className="flex gap-2 mt-1">
                        <button 
                          type="button"
                          onClick={() => setNewLoan({...newLoan, type: LoanType.ADVANCE, tenureMonths: 1})}
                          className={`flex-1 py-2 rounded-lg text-sm font-bold border ${newLoan.type === LoanType.ADVANCE ? 'bg-blue-50 border-blue-200 text-blue-600' : 'border-slate-200 text-slate-500'}`}
                        >
                          Advance
                        </button>
                        <button 
                           type="button"
                           onClick={() => setNewLoan({...newLoan, type: LoanType.LOAN, tenureMonths: 3})}
                           className={`flex-1 py-2 rounded-lg text-sm font-bold border ${newLoan.type === LoanType.LOAN ? 'bg-purple-50 border-purple-200 text-purple-600' : 'border-slate-200 text-slate-500'}`}
                        >
                          Loan
                        </button>
                      </div>
                   </div>
                   <div>
                      <label className="text-xs font-bold text-slate-500 uppercase">Amount (₹)</label>
                      <input 
                        type="number"
                        required
                        min="1"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none font-bold"
                        onChange={e => setNewLoan({...newLoan, amount: Number(e.target.value)})}
                        value={newLoan.amount}
                      />
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div>
                      <label className="text-xs font-bold text-slate-500 uppercase">Issue Date</label>
                      <input 
                        type="date"
                        required
                        value={newLoan.issueDate}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none"
                        onChange={e => setNewLoan({...newLoan, issueDate: e.target.value})}
                      />
                   </div>
                   <div>
                      <label className="text-xs font-bold text-slate-500 uppercase">Recovery (Months)</label>
                      <input 
                        type="number"
                        required
                        min="1"
                        max="24"
                        value={newLoan.tenureMonths}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none"
                        onChange={e => setNewLoan({...newLoan, tenureMonths: Number(e.target.value)})}
                      />
                   </div>
                </div>

                <div>
                   <label className="text-xs font-bold text-slate-500 uppercase">Note / Description</label>
                   <input 
                     type="text"
                     placeholder="Reason for advance..."
                     className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none"
                     onChange={e => setNewLoan({...newLoan, description: e.target.value})}
                     value={newLoan.description || ''}
                   />
                </div>

                <div className="pt-4 flex gap-3">
                   <button 
                     type="button" 
                     onClick={() => {
                        setShowForm(false);
                        setEditingLoanId(null);
                     }}
                     className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl"
                   >
                     Cancel
                   </button>
                   <button 
                     type="submit" 
                     className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700"
                   >
                     {editingLoanId ? 'Save Changes' : 'Confirm Issue'}
                   </button>
                </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default LoanManagement;
