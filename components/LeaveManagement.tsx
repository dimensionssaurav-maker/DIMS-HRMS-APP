
import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Check, 
  X, 
  Clock, 
  CalendarDays,
  Palmtree,
  Stethoscope,
  Briefcase,
  AlertCircle,
  MoreHorizontal,
  Calendar,
  Trash2,
  Moon,
  Sun
} from 'lucide-react';
import { Employee, LeaveRequest, LeaveType, LeaveStatus, Holiday } from '../types';

interface Props {
  employees: Employee[];
  leaveRequests: LeaveRequest[];
  holidays: Holiday[];
  onAddRequest: (request: LeaveRequest) => void;
  onUpdateRequest: (request: LeaveRequest) => void;
  onUpdateHolidays: (holidays: Holiday[]) => void;
}

const LeaveManagement: React.FC<Props> = ({ employees, leaveRequests, holidays, onAddRequest, onUpdateRequest, onUpdateHolidays }) => {
  const [activeTab, setActiveTab] = useState<'requests' | 'holidays'>('requests');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [openActionId, setOpenActionId] = useState<string | null>(null);

  // New Holiday State
  const [newHoliday, setNewHoliday] = useState<Partial<Holiday>>({ 
      date: '', 
      name: '',
      type: 'Full',
      shortDayEndTime: '16:00'
  });

  const [newRequest, setNewRequest] = useState<Partial<LeaveRequest>>({
    employeeId: '',
    startDate: '',
    endDate: '',
    type: LeaveType.CASUAL,
    reason: ''
  });

  // Calculate Balances (Mock Logic: Assuming standard entitlement per year)
  // Standard: Sick=10, Casual=12, Earned=15
  const entitlements = {
    [LeaveType.SICK]: 10,
    [LeaveType.CASUAL]: 12,
    [LeaveType.EARNED]: 15,
    [LeaveType.UNPAID]: 0 // Infinite really
  };

  const getBalances = (empId: string) => {
    const empRequests = leaveRequests.filter(r => 
      r.employeeId === empId && r.status === LeaveStatus.APPROVED
    );

    const consumed = {
      [LeaveType.SICK]: empRequests.filter(r => r.type === LeaveType.SICK).reduce((acc, curr) => acc + curr.days, 0),
      [LeaveType.CASUAL]: empRequests.filter(r => r.type === LeaveType.CASUAL).reduce((acc, curr) => acc + curr.days, 0),
      [LeaveType.EARNED]: empRequests.filter(r => r.type === LeaveType.EARNED).reduce((acc, curr) => acc + curr.days, 0),
    };

    return {
      sick: Math.max(0, entitlements[LeaveType.SICK] - consumed[LeaveType.SICK]),
      casual: Math.max(0, entitlements[LeaveType.CASUAL] - consumed[LeaveType.CASUAL]),
      earned: Math.max(0, entitlements[LeaveType.EARNED] - consumed[LeaveType.EARNED]),
    };
  };

  // If a specific employee is selected in filter, show their balances. 
  // Otherwise show "Average" or just disable balances view.
  const displayBalances = selectedEmployeeFilter ? getBalances(selectedEmployeeFilter) : null;

  const filteredRequests = useMemo(() => {
    return leaveRequests.filter(req => {
      const emp = employees.find(e => e.id === req.employeeId);
      const matchesSearch = emp?.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            req.type.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesEmpFilter = selectedEmployeeFilter ? req.employeeId === selectedEmployeeFilter : true;
      
      return matchesSearch && matchesEmpFilter;
    }).sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [leaveRequests, employees, searchTerm, selectedEmployeeFilter]);

  const sortedHolidays = useMemo(() => {
      return [...holidays].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [holidays]);

  const calculateDays = (start: string, end: string) => {
    if (!start || !end) return 0;
    const d1 = new Date(start);
    const d2 = new Date(end);
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; 
    return diffDays;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRequest.employeeId || !newRequest.startDate || !newRequest.endDate) return;

    const days = calculateDays(newRequest.startDate, newRequest.endDate);
    
    onAddRequest({
      id: `LR${Math.floor(Math.random() * 10000)}`,
      employeeId: newRequest.employeeId,
      startDate: newRequest.startDate,
      endDate: newRequest.endDate,
      days,
      type: newRequest.type as LeaveType,
      reason: newRequest.reason || 'No reason provided',
      status: LeaveStatus.PENDING,
      appliedOn: new Date().toISOString().split('T')[0]
    });

    setShowModal(false);
    setNewRequest({
      employeeId: '',
      startDate: '',
      endDate: '',
      type: LeaveType.CASUAL,
      reason: ''
    });
  };

  const handleAddHoliday = (e: React.FormEvent) => {
      e.preventDefault();
      if (!newHoliday.date || !newHoliday.name) return;
      
      const holidayToAdd: Holiday = {
          id: `HOL-${Date.now()}`,
          date: newHoliday.date!,
          name: newHoliday.name!,
          type: newHoliday.type as 'Full' | 'Short' || 'Full',
          shortDayEndTime: newHoliday.type === 'Short' ? newHoliday.shortDayEndTime : undefined,
      };

      onUpdateHolidays([...holidays, holidayToAdd]);
      setNewHoliday({ date: '', name: '', type: 'Full', shortDayEndTime: '16:00' });
  };

  const handleDeleteHoliday = (id: string) => {
      onUpdateHolidays(holidays.filter(h => h.id !== id));
  };

  const handleStatusChange = (req: LeaveRequest, status: LeaveStatus) => {
    onUpdateRequest({ ...req, status });
    setOpenActionId(null);
  };

  const getStatusColor = (status: LeaveStatus) => {
    switch (status) {
      case LeaveStatus.APPROVED: return 'bg-emerald-100 text-emerald-700';
      case LeaveStatus.REJECTED: return 'bg-red-100 text-red-700';
      default: return 'bg-amber-100 text-amber-700';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-slate-800">Leave Management</h2>
           <p className="text-slate-500">Track employee leaves, manage balances, and holidays.</p>
        </div>
        <div className="flex bg-white rounded-xl p-1 border border-slate-200">
            <button 
                onClick={() => setActiveTab('requests')}
                className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${activeTab === 'requests' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-800'}`}
            >
                <Briefcase size={16} /> Leave Requests
            </button>
            <button 
                onClick={() => setActiveTab('holidays')}
                className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${activeTab === 'holidays' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-800'}`}
            >
                <Moon size={16} /> Holiday Calendar
            </button>
        </div>
      </div>

      {activeTab === 'holidays' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <Plus size={18} className="text-indigo-600" />
                      Add Holiday
                  </h3>
                  <form onSubmit={handleAddHoliday} className="space-y-4">
                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase">Holiday Name</label>
                          <input 
                              type="text" 
                              required
                              placeholder="e.g. Independence Day"
                              value={newHoliday.name}
                              onChange={(e) => setNewHoliday({...newHoliday, name: e.target.value})}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none mt-1 text-sm font-semibold"
                          />
                      </div>
                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase">Date</label>
                          <input 
                              type="date" 
                              required
                              value={newHoliday.date}
                              onChange={(e) => setNewHoliday({...newHoliday, date: e.target.value})}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none mt-1 text-sm font-semibold"
                          />
                      </div>
                      
                      {/* Type Selection */}
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                          <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Holiday Type</label>
                          <div className="flex gap-2 mb-3">
                              <button
                                type="button"
                                onClick={() => setNewHoliday({...newHoliday, type: 'Full'})}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${newHoliday.type === 'Full' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}
                              >
                                Full Day
                              </button>
                              <button
                                type="button"
                                onClick={() => setNewHoliday({...newHoliday, type: 'Short'})}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${newHoliday.type === 'Short' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}
                              >
                                Short Day
                              </button>
                          </div>
                          
                          {newHoliday.type === 'Short' && (
                              <div className="animate-in fade-in slide-in-from-top-1">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1 mb-1">
                                      <Clock size={10} /> Shift Ends At
                                  </label>
                                  <input 
                                      type="time" 
                                      value={newHoliday.shortDayEndTime}
                                      onChange={(e) => setNewHoliday({...newHoliday, shortDayEndTime: e.target.value})}
                                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold outline-none"
                                  />
                                  <p className="text-[10px] text-slate-400 mt-1">Leaving after this time won't be marked Early.</p>
                              </div>
                          )}
                      </div>

                      <button 
                          type="submit"
                          className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                      >
                          Add to Calendar
                      </button>
                  </form>
                  
                  <div className="mt-6 bg-indigo-50 border border-indigo-100 p-4 rounded-xl">
                      <p className="text-xs text-indigo-800 leading-relaxed">
                          <strong>Note:</strong> 
                          <ul className="list-disc pl-3 mt-1 space-y-1">
                              <li><strong>Full Day:</strong> Automatically marked as Paid Holiday.</li>
                              <li><strong>Short Day:</strong> Working day with early shift end.</li>
                          </ul>
                      </p>
                  </div>
              </div>

              <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <h3 className="font-bold text-slate-700">Upcoming Holidays</h3>
                      <span className="bg-white border border-slate-200 px-3 py-1 rounded-full text-xs font-bold text-slate-500">
                          {holidays.length} Total
                      </span>
                  </div>
                  <div className="overflow-y-auto max-h-[500px]">
                      {sortedHolidays.length === 0 ? (
                          <div className="p-12 text-center text-slate-400">
                              <Moon size={40} className="mx-auto mb-3 opacity-20" />
                              <p className="text-sm font-medium">No holidays added yet.</p>
                          </div>
                      ) : (
                          <table className="w-full text-left">
                              <thead className="bg-white sticky top-0 z-10 text-xs font-bold text-slate-500 uppercase">
                                  <tr className="border-b border-slate-100">
                                      <th className="px-6 py-4">Date</th>
                                      <th className="px-6 py-4">Occasion</th>
                                      <th className="px-6 py-4">Type</th>
                                      <th className="px-6 py-4 text-right">Action</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50 text-sm">
                                  {sortedHolidays.map(h => (
                                      <tr key={h.id} className="hover:bg-slate-50 transition-colors">
                                          <td className="px-6 py-4 font-mono font-medium text-slate-600">
                                              {new Date(h.date).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                                          </td>
                                          <td className="px-6 py-4 font-bold text-slate-800">
                                              {h.name}
                                          </td>
                                          <td className="px-6 py-4">
                                              {h.type === 'Short' ? (
                                                  <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-bold border border-amber-200 flex items-center gap-1 w-fit">
                                                      <Sun size={10} /> Short Day ({h.shortDayEndTime})
                                                  </span>
                                              ) : (
                                                  <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-bold border border-purple-200 flex items-center gap-1 w-fit">
                                                      <Moon size={10} /> Full Day
                                                  </span>
                                              )}
                                          </td>
                                          <td className="px-6 py-4 text-right">
                                              <button 
                                                  onClick={() => handleDeleteHoliday(h.id)}
                                                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                              >
                                                  <Trash2 size={16} />
                                              </button>
                                          </td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      )}
                  </div>
              </div>
          </div>
      ) : (
        <>
            {/* Balance Cards (Context Aware) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className={`p-6 rounded-2xl border transition-all ${selectedEmployeeFilter ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-50 border-dashed border-slate-200 opacity-60'}`}>
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                        <Palmtree size={20} />
                    </div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Casual Leave</p>
                </div>
                <p className="text-3xl font-black text-slate-800">
                    {displayBalances ? displayBalances.casual : '--'}
                </p>
                <p className="text-xs text-slate-400 mt-1">Available Balance</p>
                </div>

                <div className={`p-6 rounded-2xl border transition-all ${selectedEmployeeFilter ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-50 border-dashed border-slate-200 opacity-60'}`}>
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
                        <Stethoscope size={20} />
                    </div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sick Leave</p>
                </div>
                <p className="text-3xl font-black text-slate-800">
                    {displayBalances ? displayBalances.sick : '--'}
                </p>
                <p className="text-xs text-slate-400 mt-1">Available Balance</p>
                </div>

                <div className={`p-6 rounded-2xl border transition-all ${selectedEmployeeFilter ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-50 border-dashed border-slate-200 opacity-60'}`}>
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                        <Briefcase size={20} />
                    </div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Earned Leave</p>
                </div>
                <p className="text-3xl font-black text-slate-800">
                    {displayBalances ? displayBalances.earned : '--'}
                </p>
                <p className="text-xs text-slate-400 mt-1">Available Balance</p>
                </div>
            </div>

            {/* Filters & Action */}
            <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm items-center">
                {/* ... existing filter/action code ... */}
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                    type="text" 
                    placeholder="Search by name or leave type..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <span className="text-xs font-bold text-slate-500 uppercase whitespace-nowrap">Filter Employee:</span>
                    <select 
                    value={selectedEmployeeFilter} 
                    onChange={(e) => setSelectedEmployeeFilter(e.target.value)}
                    className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none cursor-pointer"
                    >
                    <option value="">All Employees (Summary)</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                </div>
                <button 
                    onClick={() => setShowModal(true)}
                    className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 whitespace-nowrap"
                >
                    <Plus size={18} />
                    Apply Leave
                </button>
            </div>

            {/* Table */}
            <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left">
                    <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        <th className="px-6 py-4">Employee</th>
                        <th className="px-6 py-4">Duration</th>
                        <th className="px-6 py-4">Type</th>
                        <th className="px-6 py-4">Reason</th>
                        <th className="px-6 py-4">Applied On</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-center">Actions</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-sm">
                    {filteredRequests.length === 0 ? (
                        <tr>
                            <td colSpan={7} className="px-6 py-12 text-center text-slate-400 italic">No leave requests found.</td>
                        </tr>
                    ) : filteredRequests.map(req => {
                        const emp = employees.find(e => e.id === req.employeeId);
                        return (
                            <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4">
                                <p className="font-bold text-slate-800">{emp?.name}</p>
                                <p className="text-xs text-slate-400">ID: {emp?.id}</p>
                                </td>
                                <td className="px-6 py-4">
                                <div className="flex items-center gap-2 font-medium text-slate-700">
                                    <CalendarDays size={14} className="text-slate-400" />
                                    {req.startDate} <span className="text-slate-300">to</span> {req.endDate}
                                </div>
                                <p className="text-xs text-indigo-600 font-bold mt-1">{req.days} Days</p>
                                </td>
                                <td className="px-6 py-4">
                                <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-bold border border-slate-200">
                                    {req.type}
                                </span>
                                </td>
                                <td className="px-6 py-4 text-slate-600 max-w-xs truncate" title={req.reason}>
                                {req.reason}
                                </td>
                                <td className="px-6 py-4 text-slate-500">
                                {req.appliedOn}
                                </td>
                                <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${getStatusColor(req.status)}`}>
                                    {req.status}
                                </span>
                                </td>
                                <td className="px-6 py-4 text-center relative">
                                {req.status === LeaveStatus.PENDING ? (
                                    <>
                                        <button 
                                            onClick={() => setOpenActionId(openActionId === req.id ? null : req.id)}
                                            className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                                        >
                                            <MoreHorizontal size={18} />
                                        </button>
                                        {openActionId === req.id && (
                                            <>
                                            <div className="fixed inset-0 z-10" onClick={() => setOpenActionId(null)}></div>
                                            <div className="absolute right-8 top-8 w-32 bg-white rounded-xl shadow-xl border border-slate-100 z-20 overflow-hidden animate-in fade-in zoom-in-95">
                                                <button 
                                                    onClick={() => handleStatusChange(req, LeaveStatus.APPROVED)}
                                                    className="w-full text-left px-4 py-2.5 text-xs font-bold text-emerald-600 hover:bg-emerald-50 flex items-center gap-2"
                                                >
                                                    <Check size={14} /> Approve
                                                </button>
                                                <button 
                                                    onClick={() => handleStatusChange(req, LeaveStatus.REJECTED)}
                                                    className="w-full text-left px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2 border-t border-slate-50"
                                                >
                                                    <X size={14} /> Reject
                                                </button>
                                            </div>
                                            </>
                                        )}
                                    </>
                                ) : (
                                    <span className="text-slate-300 text-xs">-</span>
                                )}
                                </td>
                            </tr>
                        );
                    })}
                    </tbody>
                </table>
            </div>
        </>
      )}

      {/* Modal - same as before ... */}
      {showModal && (
         <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-6 animate-in zoom-in-95">
               <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-slate-800">Apply for Leave</h3>
                  <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400">
                     <X size={20} />
                  </button>
               </div>
               
               <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase">Employee</label>
                     <select 
                        required
                        value={newRequest.employeeId}
                        onChange={e => setNewRequest({...newRequest, employeeId: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none mt-1"
                     >
                        <option value="">Select Employee</option>
                        {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                     </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">Start Date</label>
                        <input 
                           type="date"
                           required
                           value={newRequest.startDate}
                           onChange={e => setNewRequest({...newRequest, startDate: e.target.value})}
                           className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none mt-1"
                        />
                     </div>
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">End Date</label>
                        <input 
                           type="date"
                           required
                           min={newRequest.startDate}
                           value={newRequest.endDate}
                           onChange={e => setNewRequest({...newRequest, endDate: e.target.value})}
                           className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none mt-1"
                        />
                     </div>
                  </div>

                  {newRequest.startDate && newRequest.endDate && (
                     <div className="p-3 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-bold flex items-center gap-2">
                        <Clock size={14} />
                        Total Duration: {calculateDays(newRequest.startDate!, newRequest.endDate!)} Days
                     </div>
                  )}

                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase">Leave Type</label>
                     <div className="grid grid-cols-2 gap-2 mt-1">
                        {Object.values(LeaveType).map(type => (
                           <button
                              key={type}
                              type="button"
                              onClick={() => setNewRequest({...newRequest, type})}
                              className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${newRequest.type === type ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                           >
                              {type}
                           </button>
                        ))}
                     </div>
                  </div>

                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase">Reason</label>
                     <textarea 
                        required
                        value={newRequest.reason}
                        onChange={e => setNewRequest({...newRequest, reason: e.target.value})}
                        placeholder="Please provide a brief reason..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none mt-1 h-24 resize-none"
                     ></textarea>
                  </div>

                  <div className="pt-2 flex gap-3">
                     <button 
                        type="button"
                        onClick={() => setShowModal(false)}
                        className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl"
                     >
                        Cancel
                     </button>
                     <button 
                        type="submit"
                        className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700"
                     >
                        Submit Request
                     </button>
                  </div>
               </form>
            </div>
         </div>
      )}
    </div>
  );
};

export default LeaveManagement;
