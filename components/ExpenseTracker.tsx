
import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  FileText, 
  MoreHorizontal,
  Wallet,
  TrendingUp,
  AlertCircle,
  FileBarChart,
  Shield,
  Banknote,
  Trash2,
  X,
  Check
} from 'lucide-react';
import { ExpenseClaim, ClaimStatus, Employee } from '../types';

interface Props {
  claims: ExpenseClaim[];
  employees: Employee[];
  departments: string[];
  onAddClaim: (claim: ExpenseClaim) => void;
  onUpdateClaim: (claim: ExpenseClaim) => void;
}

const ExpenseTracker: React.FC<Props> = ({ claims, employees, departments, onAddClaim, onUpdateClaim }) => {
  const [activeTab, setActiveTab] = useState<'claims' | 'analytics' | 'policies'>('claims');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All Status');
  const [deptFilter, setDeptFilter] = useState<string>('All Departments');
  const [branchFilter, setBranchFilter] = useState<string>('All Branches');
  
  // Action Menu State
  const [openActionId, setOpenActionId] = useState<string | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [newClaim, setNewClaim] = useState<Partial<ExpenseClaim>>({
    title: '',
    amount: 0,
    employeeId: '',
    date: new Date().toISOString().split('T')[0],
    location: 'Mumbai HQ'
  });

  // Stats Calculation
  const stats = useMemo(() => {
    const totalClaims = claims.length;
    const totalAmount = claims.reduce((sum, c) => sum + c.amount, 0);
    const pending = claims.filter(c => c.status === 'Under Review');
    const approved = claims.filter(c => c.status === 'Approved');
    const reimbursed = claims.filter(c => c.status === 'Reimbursed');
    const rejected = claims.filter(c => c.status === 'Rejected');
    
    return {
      totalCount: totalClaims,
      totalAmount,
      pendingCount: pending.length,
      pendingAmount: pending.reduce((sum, c) => sum + c.amount, 0),
      approvedCount: approved.length,
      approvedAmount: approved.reduce((sum, c) => sum + c.amount, 0),
      reimbursedCount: reimbursed.length,
      reimbursedAmount: reimbursed.reduce((sum, c) => sum + c.amount, 0),
      rejectedCount: rejected.length,
      rejectedRate: totalClaims ? Math.round((rejected.length / totalClaims) * 100) : 0,
      avgClaimValue: totalClaims ? Math.round(totalAmount / totalClaims) : 0
    };
  }, [claims]);

  const getEmployee = (id: string) => employees.find(e => e.id === id);

  const filteredClaims = useMemo(() => {
    return claims.filter(claim => {
      const emp = getEmployee(claim.employeeId);
      const matchesSearch = 
        claim.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        claim.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp?.name.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'All Status' || claim.status === statusFilter;
      const matchesDept = deptFilter === 'All Departments' || emp?.department === deptFilter;
      const matchesBranch = branchFilter === 'All Branches' || claim.location.includes(branchFilter);

      return matchesSearch && matchesStatus && matchesDept && matchesBranch;
    });
  }, [claims, employees, searchTerm, statusFilter, deptFilter, branchFilter]);

  const getStatusColor = (status: ClaimStatus) => {
    switch (status) {
      case 'Approved': return 'bg-emerald-100 text-emerald-700';
      case 'Under Review': return 'bg-amber-100 text-amber-700';
      case 'Rejected': return 'bg-red-100 text-red-700';
      case 'Draft': return 'bg-slate-100 text-slate-600';
      case 'Reimbursed': return 'bg-blue-100 text-blue-700';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  const handleStatusChange = (claim: ExpenseClaim, newStatus: ClaimStatus) => {
    onUpdateClaim({ ...claim, status: newStatus });
    setOpenActionId(null);
  };

  const handleSubmitClaim = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClaim.title || !newClaim.amount || !newClaim.employeeId) return;

    onAddClaim({
      id: `EXP${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
      title: newClaim.title,
      amount: Number(newClaim.amount),
      employeeId: newClaim.employeeId,
      date: newClaim.date!,
      submittedDate: new Date().toISOString(),
      status: 'Under Review',
      itemsCount: 1,
      location: newClaim.location || 'Mumbai HQ'
    } as ExpenseClaim);

    setShowModal(false);
    setNewClaim({
      title: '',
      amount: 0,
      employeeId: '',
      date: new Date().toISOString().split('T')[0],
      location: 'Mumbai HQ'
    });
  };

  const branches = Array.from(new Set(claims.map(c => c.location.split(' ')[0])));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h2 className="text-2xl font-bold text-slate-800">Expense Management</h2>
           <p className="text-slate-500">Track, approve, and reimburse employee expense claims</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => alert("Simulating Export...")}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-slate-50 transition-colors"
          >
            <Download size={16} />
            Export
          </button>
          <button 
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-200"
          >
            <Plus size={16} />
            New Claim
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group">
           <div className="absolute top-4 right-4 p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <Wallet size={18} />
           </div>
           <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Claims</p>
           <p className="text-2xl font-black text-slate-800">{stats.totalCount}</p>
           <p className="text-xs text-slate-500 mt-1 font-medium">₹{stats.totalAmount.toLocaleString()}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group">
           <div className="absolute top-4 right-4 p-2 bg-amber-50 text-amber-600 rounded-lg">
              <Clock size={18} />
           </div>
           <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Pending Approval</p>
           <p className="text-2xl font-black text-slate-800">{stats.pendingCount}</p>
           <p className="text-xs text-slate-500 mt-1 font-medium">₹{stats.pendingAmount.toLocaleString()}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group">
           <div className="absolute top-4 right-4 p-2 bg-green-50 text-green-600 rounded-lg">
              <CheckCircle2 size={18} />
           </div>
           <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Approved (Awaiting)</p>
           <p className="text-2xl font-black text-slate-800">{stats.approvedCount}</p>
           <p className="text-xs text-slate-500 mt-1 font-medium">₹{stats.approvedAmount.toLocaleString()}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group">
           <div className="absolute top-4 right-4 p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Wallet size={18} />
           </div>
           <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Reimbursed</p>
           <p className="text-2xl font-black text-slate-800">{stats.reimbursedCount}</p>
           <p className="text-xs text-slate-500 mt-1 font-medium">₹{stats.reimbursedAmount.toLocaleString()}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group">
           <div className="absolute top-4 right-4 p-2 bg-red-50 text-red-600 rounded-lg">
              <XCircle size={18} />
           </div>
           <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Rejected</p>
           <p className="text-2xl font-black text-slate-800">{stats.rejectedCount}</p>
           <p className="text-xs text-slate-500 mt-1 font-medium">{stats.rejectedRate}% rate</p>
        </div>
        
         <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group">
           <div className="absolute top-4 right-4 p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <TrendingUp size={18} />
           </div>
           <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Avg. Claim Value</p>
           <p className="text-2xl font-black text-slate-800">₹{stats.avgClaimValue.toLocaleString()}</p>
           <p className="text-xs text-slate-500 mt-1 font-medium">Per claim</p>
        </div>
      </div>

      {/* Alert Banner */}
      {stats.pendingCount > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-center gap-4 animate-in slide-in-from-top-2">
           <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
             <AlertCircle size={24} />
           </div>
           <div>
             <h4 className="font-bold text-amber-800">Pending Approval: ₹{stats.pendingAmount.toLocaleString()}</h4>
             <p className="text-sm text-amber-600">{stats.pendingCount} claims awaiting review</p>
           </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-slate-200 pb-1">
        {[
          { id: 'claims', label: 'Claims', icon: Wallet },
          { id: 'analytics', label: 'Analytics', icon: FileBarChart },
          { id: 'policies', label: 'Policies', icon: Shield }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 pb-3 px-2 text-sm font-bold border-b-2 transition-all ${activeTab === tab.id ? 'text-slate-800 border-slate-800' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'claims' && (
        <div className="space-y-4">
           {/* Filters */}
           <div className="flex flex-col md:flex-row gap-4">
             <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Search by title, employee, or ID..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
             </div>
             
             <div className="flex gap-3 overflow-x-auto pb-1 md:pb-0">
               <select 
                 value={statusFilter} 
                 onChange={e => setStatusFilter(e.target.value)}
                 className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 outline-none cursor-pointer"
               >
                 <option>All Status</option>
                 {Object.values(ClaimStatus).map(s => <option key={s} value={s}>{s}</option>)}
               </select>

               <select 
                 value={deptFilter} 
                 onChange={e => setDeptFilter(e.target.value)}
                 className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 outline-none cursor-pointer"
               >
                 {departments.map(d => <option key={d} value={d}>{d}</option>)}
               </select>

               <select 
                 value={branchFilter} 
                 onChange={e => setBranchFilter(e.target.value)}
                 className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 outline-none cursor-pointer"
               >
                 <option>All Branches</option>
                 {branches.map(b => <option key={b} value={b}>{b}</option>)}
               </select>
             </div>
           </div>

           {/* Table */}
           <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm min-h-[400px]">
             <div className="overflow-x-auto">
               <table className="w-full text-left border-collapse">
                 <thead>
                   <tr className="bg-white border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider">
                     <th className="py-4 px-6">Claim ID</th>
                     <th className="py-4 px-6">Employee</th>
                     <th className="py-4 px-6">Title</th>
                     <th className="py-4 px-6">Amount</th>
                     <th className="py-4 px-6">Items</th>
                     <th className="py-4 px-6">Submitted</th>
                     <th className="py-4 px-6">Status</th>
                     <th className="py-4 px-6 text-center">Actions</th>
                   </tr>
                 </thead>
                 <tbody className="text-sm">
                    {filteredClaims.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">No claims found matching filters</td>
                      </tr>
                    ) : filteredClaims.map(claim => {
                      const emp = getEmployee(claim.employeeId);
                      return (
                        <tr key={claim.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors group">
                           <td className="py-4 px-6 font-mono text-xs font-bold text-slate-600">{claim.id}</td>
                           <td className="py-4 px-6">
                              <p className="font-bold text-slate-800">{emp?.name}</p>
                              <p className="text-xs text-slate-400">{emp?.department}</p>
                           </td>
                           <td className="py-4 px-6">
                              <p className="font-medium text-slate-800">{claim.title}</p>
                              <p className="text-xs text-slate-400">{claim.location}</p>
                           </td>
                           <td className="py-4 px-6 font-bold text-slate-800">
                             ₹{claim.amount.toLocaleString()}
                           </td>
                           <td className="py-4 px-6">
                             <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold">{claim.itemsCount} items</span>
                           </td>
                           <td className="py-4 px-6 text-slate-500 font-medium">
                             {new Date(claim.submittedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                           </td>
                           <td className="py-4 px-6">
                             <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${getStatusColor(claim.status)}`}>
                               {claim.status}
                             </span>
                           </td>
                           <td className="py-4 px-6 text-center relative">
                             <button 
                               onClick={(e) => {
                                 e.stopPropagation();
                                 setOpenActionId(openActionId === claim.id ? null : claim.id);
                               }}
                               className={`p-2 rounded-lg transition-colors ${openActionId === claim.id ? 'bg-slate-200 text-slate-800' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                             >
                               <MoreHorizontal size={18} />
                             </button>
                             
                             {/* Context Menu */}
                             {openActionId === claim.id && (
                               <>
                                 <div className="fixed inset-0 z-10" onClick={() => setOpenActionId(null)}></div>
                                 <div className="absolute right-12 top-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                                    {(claim.status === 'Under Review' || claim.status === 'Draft') && (
                                       <>
                                         <button 
                                           onClick={() => handleStatusChange(claim, 'Approved')}
                                           className="w-full text-left px-4 py-3 text-sm font-medium text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 flex items-center gap-2"
                                         >
                                           <Check size={16} /> Approve
                                         </button>
                                         <button 
                                           onClick={() => handleStatusChange(claim, 'Rejected')}
                                           className="w-full text-left px-4 py-3 text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 flex items-center gap-2"
                                         >
                                           <X size={16} /> Reject
                                         </button>
                                       </>
                                    )}

                                    {claim.status === 'Approved' && (
                                       <button 
                                         onClick={() => handleStatusChange(claim, 'Reimbursed')}
                                         className="w-full text-left px-4 py-3 text-sm font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
                                       >
                                         <Banknote size={16} /> Reimburse
                                       </button>
                                    )}
                                    
                                    {(claim.status === 'Draft' || claim.status === 'Rejected') && (
                                      <button 
                                        onClick={() => alert('Delete functionality would be here')}
                                        className="w-full text-left px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-red-500 flex items-center gap-2 border-t border-slate-50"
                                      >
                                        <Trash2 size={16} /> Delete
                                      </button>
                                    )}

                                    {claim.status === 'Reimbursed' && (
                                       <div className="px-4 py-3 text-xs text-slate-400 italic text-center">No actions available</div>
                                    )}
                                 </div>
                               </>
                             )}
                           </td>
                        </tr>
                      );
                    })}
                 </tbody>
               </table>
             </div>
           </div>
        </div>
      )}
      
      {activeTab !== 'claims' && (
        <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <p className="text-slate-400 font-medium">Module under development.</p>
        </div>
      )}

      {/* New Claim Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-6 animate-in zoom-in-95">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-xl font-bold text-slate-800">Submit New Claim</h3>
                 <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                   <X size={20} />
                 </button>
              </div>
              <form onSubmit={handleSubmitClaim} className="space-y-4">
                 <div>
                   <label className="text-xs font-bold text-slate-500 uppercase">Employee</label>
                   <select 
                     required
                     value={newClaim.employeeId}
                     onChange={e => setNewClaim({...newClaim, employeeId: e.target.value})}
                     className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none mt-1"
                   >
                     <option value="">Select Employee</option>
                     {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                   </select>
                 </div>
                 
                 <div>
                   <label className="text-xs font-bold text-slate-500 uppercase">Expense Title</label>
                   <input 
                     type="text" 
                     required
                     placeholder="e.g. Client Dinner"
                     value={newClaim.title}
                     onChange={e => setNewClaim({...newClaim, title: e.target.value})}
                     className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none mt-1"
                   />
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase">Amount (₹)</label>
                      <input 
                        type="number" 
                        required
                        min="1"
                        value={newClaim.amount}
                        onChange={e => setNewClaim({...newClaim, amount: Number(e.target.value)})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none mt-1 font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase">Date</label>
                      <input 
                        type="date" 
                        required
                        value={newClaim.date}
                        onChange={e => setNewClaim({...newClaim, date: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none mt-1"
                      />
                    </div>
                 </div>

                 <div>
                   <label className="text-xs font-bold text-slate-500 uppercase">Location</label>
                   <input 
                     type="text" 
                     value={newClaim.location}
                     onChange={e => setNewClaim({...newClaim, location: e.target.value})}
                     className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none mt-1"
                   />
                 </div>

                 <div className="pt-4 flex gap-3">
                    <button 
                      type="button" 
                      onClick={() => setShowModal(false)}
                      className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 hover:bg-emerald-700"
                    >
                      Submit Claim
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default ExpenseTracker;
