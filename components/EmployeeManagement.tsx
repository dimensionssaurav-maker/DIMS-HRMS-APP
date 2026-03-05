import { db } from "../firebase";
import { collection, addDoc } from "firebase/firestore";
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, UserPlus, Edit2, Trash2, Building2, ArrowUpDown, ArrowUp, ArrowDown, AlertCircle, X, Save, Clock, Users, Wifi, ClipboardCopy, ArrowRight, Briefcase, IndianRupee, MapPin, Share2, Percent, MoreHorizontal, UserX, UserCheck, Calendar, RotateCcw, User, Camera, Check, FileText, Download } from 'lucide-react';
import { Employee, Shift, PayrollConfig } from '../types';

interface Props {
  employees: Employee[];
  departments: string[];
  shifts?: Shift[];
  payrollConfig: PayrollConfig;
  onAdd: () => void;
  onBulkAdd: (employees: Employee[]) => void;
  onDelete: (ids: string[]) => void;
  onUpdate: (employees: Employee[]) => void;
}

type SortKey = 'name' | 'department' | 'joiningDate' | 'designation' | 'leavingDate';
type SortDirection = 'asc' | 'desc' | null;

const EmployeeManagement: React.FC<Props> = ({ employees, departments, shifts = [], payrollConfig, onAdd, onBulkAdd, onDelete, onUpdate }) => {
  const [activeTab, setActiveTab] = useState<'active' | 'left' | 'deleted'>('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'name',
    direction: null,
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  
  // Modals State
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Status Change Modals State
  const [showLeftModal, setShowLeftModal] = useState(false);
  const [showReactivateModal, setShowReactivateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  const [employeeToLeave, setEmployeeToLeave] = useState<Employee | null>(null);
  const [employeeToReactivate, setEmployeeToReactivate] = useState<Employee | null>(null);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null); 
  const [isBulkDelete, setIsBulkDelete] = useState(false);

  const [leavingDate, setLeavingDate] = useState(new Date().toISOString().split('T')[0]);

  // Bulk Edit Data
  const [bulkChanges, setBulkChanges] = useState({
    department: '',
    designation: '',
    dailyWage: '',
    isOtAllowed: '' 
  });

  // Import Data
  const [importText, setImportText] = useState('');
  const [parsedNewEmployees, setParsedNewEmployees] = useState<Partial<Employee>[]>([]);
  const [importStep, setImportStep] = useState<'input' | 'preview'>('input');
  const [defaultImportSettings, setDefaultImportSettings] = useState({
    department: departments[1] || 'Operations',
    designation: 'Staff',
    dailyWage: 500,
    isOtAllowed: true
  });

  const [editTab, setEditTab] = useState<'profile' | 'salary' | 'shift'>('profile');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (openActionId && !target.closest('.dropdown-menu') && !target.closest('.action-trigger')) {
        setOpenActionId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openActionId]);

  const handleSort = (key: SortKey) => {
    let direction: SortDirection = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    } else if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = null;
    }
    setSortConfig({ key, direction });
  };

  const sortedEmployees = useMemo(() => {
    let items = [...employees];
    if (activeTab === 'active') {
        items = items.filter(e => e.status === 'Active' || !e.status);
    } else if (activeTab === 'left') {
        items = items.filter(e => e.status === 'Left');
    } else {
        items = items.filter(e => e.status === 'Deleted');
    }
    if (searchTerm) {
      items = items.filter(emp => 
        emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.designation.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (sortConfig.key && sortConfig.direction) {
      items.sort((a, b) => {
        const aVal = a[sortConfig.key!] || '';
        const bVal = b[sortConfig.key!] || '';
        const aValue = String(aVal).toLowerCase();
        const bValue = String(bVal).toLowerCase();
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return items;
  }, [employees, searchTerm, sortConfig, activeTab]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) setSelectedIds(sortedEmployees.map(e => e.id));
    else setSelectedIds([]);
  };

  const handleSelect = (id: string) => {
    if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter(i => i !== id));
    else setSelectedIds([...selectedIds, id]);
  };

  const handleBulkEditClick = () => setShowBulkEdit(true);

  // Status Actions
  const initiateMarkAsLeft = (event: React.MouseEvent, emp: Employee) => {
      event.stopPropagation();
      setOpenActionId(null);
      setEmployeeToLeave(emp);
      setLeavingDate(new Date().toISOString().split('T')[0]);
      setShowLeftModal(true);
  };

  const confirmMarkAsLeft = () => {
      if (employeeToLeave) {
          onUpdate([{ ...employeeToLeave, status: 'Left', leavingDate: leavingDate }]);
          setShowLeftModal(false);
          setEmployeeToLeave(null);
      }
  };

  const initiateReactivate = (event: React.MouseEvent, emp: Employee) => {
      event.stopPropagation();
      setOpenActionId(null);
      setEmployeeToReactivate(emp);
      setShowReactivateModal(true);
  };

  const confirmReactivate = () => {
      if (employeeToReactivate) {
          onUpdate([{ ...employeeToReactivate, status: 'Active', leavingDate: undefined }]);
          setShowReactivateModal(false);
          setEmployeeToReactivate(null);
      }
  };

  const initiateDelete = (event: React.MouseEvent, emp: Employee) => {
      event.stopPropagation();
      setOpenActionId(null);
      setEmployeeToDelete(emp);
      setIsBulkDelete(false);
      setShowDeleteModal(true);
  };

  const initiateBulkDelete = () => {
      if (selectedIds.length === 0) return;
      setIsBulkDelete(true);
      setEmployeeToDelete(null);
      setShowDeleteModal(true);
  };

  const confirmDelete = () => {
      const isHardDelete = activeTab === 'deleted';
      const idsToProcess = isBulkDelete ? selectedIds : (employeeToDelete ? [employeeToDelete.id] : []);
      if (idsToProcess.length === 0) return;

      if (isHardDelete) onDelete(idsToProcess);
      else onUpdate(employees.filter(e => idsToProcess.includes(e.id)).map(e => ({ ...e, status: 'Deleted' } as Employee)));

      setShowDeleteModal(false);
      setEmployeeToDelete(null);
      setIsBulkDelete(false);
      setSelectedIds([]);
  };

  const handleRestore = (event: React.MouseEvent, emp: Employee) => {
      event.stopPropagation();
      onUpdate([{ ...emp, status: 'Active' }]);
  };

  const handleEditClick = (event: React.MouseEvent, emp: Employee) => {
    event.preventDefault();
    event.stopPropagation();
    setOpenActionId(null);
    setEditingEmployee({ ...emp, salaryType: emp.salaryType || 'Daily', monthlySalary: emp.monthlySalary || (emp.dailyWage * 30) });
    setEditTab('profile');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && editingEmployee) {
        const reader = new FileReader();
        reader.onloadend = () => setEditingEmployee({ ...editingEmployee, avatar: reader.result as string });
        reader.readAsDataURL(file);
    }
  };

  const removeAvatar = () => editingEmployee && setEditingEmployee({ ...editingEmployee, avatar: undefined });

  const applyBulkChanges = () => {
    const updatedEmployees = employees
      .filter(e => selectedIds.includes(e.id))
      .map(e => {
         const updates: any = {};
         if (bulkChanges.department) updates.department = bulkChanges.department;
         if (bulkChanges.designation) updates.designation = bulkChanges.designation;
         if (bulkChanges.dailyWage) {
            updates.dailyWage = Number(bulkChanges.dailyWage);
            updates.monthlyBase = Number(bulkChanges.dailyWage) * 30;
         }
         if (bulkChanges.isOtAllowed !== '') updates.isOtAllowed = bulkChanges.isOtAllowed === 'true';
         return { ...e, ...updates };
      });
    onUpdate(updatedEmployees);
    setShowBulkEdit(false);
    setBulkChanges({ department: '', designation: '', dailyWage: '', isOtAllowed: '' });
    setSelectedIds([]); 
  };

  const handleSaveEdit = () => {
    if (editingEmployee) {
      onUpdate([{ ...editingEmployee, monthlyBase: editingEmployee.salaryType === 'Monthly' ? editingEmployee.monthlySalary : editingEmployee.dailyWage * 30 }]);
      setEditingEmployee(null);
    }
  };

  const getSortIcon = (key: SortKey) => {
    if (sortConfig.key !== key || !sortConfig.direction) return <ArrowUpDown size={14} className="text-slate-300" />;
    return sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-indigo-600" /> : <ArrowDown size={14} className="text-indigo-600" />;
  };

  // --- Bulk Import Parser Logic ---
  const handleParseImport = () => {
    if (!importText.trim()) return;
    
    const lines = importText.split(/\r\n|\n/);
    const foundEmployees: Partial<Employee>[] = [];
    const seenIds = new Set(employees.map(e => e.id));
    const parsedIds = new Set();

    lines.forEach(line => {
       const trimmed = line.trim();
       if (!trimmed) return;
       
       // Priority 1: Generic CSV / Spreadsheet format (ID [separator] Name)
       // Separators: Comma, Semicolon, Tab, Pipe
       const parts = trimmed.split(/[,\t;|]/);
       if (parts.length >= 2) {
          const id = parts[0].trim().replace(/^0+/, ''); // Remove leading zeros for matching
          const name = parts[1].trim();
          if (id && name && !seenIds.has(id) && !parsedIds.has(id)) {
             foundEmployees.push({ id, name });
             parsedIds.add(id);
             return;
          }
       }

       // Priority 2: Biometric Log Format (ID at start, Name after whitespace)
       // Example: "0012 Manoj Rana ..."
       const bioMatch = trimmed.match(/^\s*(\d+)\s+([a-zA-Z\.\s]+)/);
       if (bioMatch) {
          const id = bioMatch[1].trim().replace(/^0+/, '');
          const name = bioMatch[2].trim();
          if (id && name && !seenIds.has(id) && !parsedIds.has(id)) {
              foundEmployees.push({ id, name });
              parsedIds.add(id);
          }
       }
    });

    if (foundEmployees.length === 0) {
        alert("No valid new employees detected. Ensure format is 'ID [separator] Name'. Example: 101, John Doe");
        return;
    }

    setParsedNewEmployees(foundEmployees);
    setImportStep('preview');
  };

  const handleConfirmImport = () => {
     if (parsedNewEmployees.length === 0) return;
     const newEmployees: Employee[] = parsedNewEmployees.map(p => ({
        id: p.id!,
        name: p.name!,
        department: defaultImportSettings.department,
        designation: defaultImportSettings.designation,
        dailyWage: defaultImportSettings.dailyWage,
        monthlySalary: defaultImportSettings.dailyWage * 30,
        salaryType: 'Daily',
        monthlyBase: defaultImportSettings.dailyWage * 30,
        isOtAllowed: defaultImportSettings.isOtAllowed,
        joiningDate: new Date().toISOString().split('T')[0],
        status: 'Active'
     }));
     onBulkAdd(newEmployees);
     setShowImportModal(false);
     setImportStep('input');
     setImportText('');
     setParsedNewEmployees([]);
  };

  const isAllSelected = sortedEmployees.length > 0 && selectedIds.length === sortedEmployees.length;
  const isIndeterminate = selectedIds.length > 0 && selectedIds.length < sortedEmployees.length;

  return (
    <div className="animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
            <h2 className="text-2xl font-bold text-slate-800">Employee Management</h2>
            <p className="text-slate-500 text-sm">Central hub for staff directory and status tracking.</p>
        </div>
        
        <div className="flex items-center gap-3">
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2 animate-in fade-in zoom-in-95">
              {activeTab !== 'deleted' && (
                  <button onClick={handleBulkEditClick} className="bg-indigo-50 text-indigo-600 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-100 transition-all">
                    <Edit2 size={18} /> Edit ({selectedIds.length})
                  </button>
              )}
              <button onClick={initiateBulkDelete} className="bg-red-50 text-red-600 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-red-100 transition-all">
                <Trash2 size={18} /> Delete ({selectedIds.length})
              </button>
              <div className="w-px h-8 bg-slate-200 mx-2"></div>
            </div>
          )}
          
          <button onClick={() => { setShowImportModal(true); setImportStep('input'); }} className="bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm">
            <Users size={18} /> Bulk Import
          </button>
          <button onClick={onAdd} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200">
            <UserPlus size={18} /> Add Employee
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 overflow-visible shadow-sm">
        <div className="flex border-b border-slate-100 px-6 pt-4 gap-6">
            {[
                { id: 'active', label: 'Active', icon: Users, count: employees.filter(e => e.status === 'Active' || !e.status).length, color: 'indigo' },
                { id: 'left', label: 'Ex-Employees', icon: UserX, count: employees.filter(e => e.status === 'Left').length, color: 'red' },
                { id: 'deleted', label: 'Deleted', icon: Trash2, count: employees.filter(e => e.status === 'Deleted').length, color: 'slate' }
            ].map(tab => (
                <button 
                    key={tab.id}
                    onClick={() => { setActiveTab(tab.id as any); setSelectedIds([]); }}
                    className={`pb-4 text-sm font-bold flex items-center gap-2 transition-all border-b-2 ${activeTab === tab.id ? `text-${tab.color}-600 border-${tab.color}-600` : 'text-slate-400 border-transparent hover:text-slate-600'}`}
                >
                    <tab.icon size={18} />
                    {tab.label}
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === tab.id ? `bg-${tab.color}-100 text-${tab.color}-600` : 'bg-slate-100'}`}>{tab.count}</span>
                </button>
            ))}
        </div>

        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <div className="relative max-w-md w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input type="text" placeholder="Filter by name, ID or role..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm" />
            </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 w-12">
                  <input type="checkbox" checked={isAllSelected} ref={i => { if (i) i.indeterminate = isIndeterminate; }} onChange={handleSelectAll} className="w-4 h-4 rounded border-slate-300 text-indigo-600 accent-indigo-600" />
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100" onClick={() => handleSort('name')}>
                  <div className="flex items-center gap-2">Employee {getSortIcon('name')}</div>
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Designation</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Department</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Details</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sortedEmployees.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-20 text-center text-slate-400 italic">No matching records found.</td></tr>
              ) : sortedEmployees.map((emp) => (
                <tr key={emp.id} className={`hover:bg-slate-50 transition-colors group ${selectedIds.includes(emp.id) ? 'bg-indigo-50/50' : ''}`}>
                  <td className="px-6 py-4"><input type="checkbox" checked={selectedIds.includes(emp.id)} onChange={() => handleSelect(emp.id)} className="w-4 h-4 rounded border-slate-300 text-indigo-600 accent-indigo-600" /></td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                          {emp.avatar ? <img src={emp.avatar} className="w-10 h-10 rounded-full object-cover border border-slate-200" alt="" /> : <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500"><User size={20} /></div>}
                          {emp.status === 'Left' && <div className="absolute -bottom-1 -right-1 bg-red-500 text-white p-0.5 rounded-full border border-white"><UserX size={10} /></div>}
                          {emp.status === 'Deleted' && <div className="absolute -bottom-1 -right-1 bg-slate-500 text-white p-0.5 rounded-full border border-white"><Trash2 size={10} /></div>}
                      </div>
                      <div><p className={`font-bold ${emp.status !== 'Active' ? 'text-slate-500' : 'text-slate-800'}`}>{emp.name}</p><p className="text-[10px] text-slate-400 font-mono font-bold uppercase">{emp.id}</p></div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-600">{emp.designation}</td>
                  <td className="px-6 py-4"><span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase ${emp.status !== 'Active' ? 'bg-slate-100 text-slate-500' : 'bg-indigo-50 text-indigo-600'}`}>{emp.department}</span></td>
                  <td className="px-6 py-4 text-right">
                    {activeTab === 'active' ? (
                        <p className="font-bold text-slate-800 text-sm">₹{emp.salaryType === 'Monthly' ? emp.monthlySalary.toLocaleString() : emp.dailyWage}/<span className="text-[10px] text-slate-400 font-medium uppercase">{emp.salaryType === 'Monthly' ? 'mo' : 'day'}</span></p>
                    ) : activeTab === 'left' ? (
                        <p className="text-xs font-bold text-red-500">Left: {emp.leavingDate}</p>
                    ) : <span className="text-xs text-slate-300 font-bold uppercase italic">In Bin</span>}
                  </td>
                  <td className="px-6 py-4 text-right relative">
                    <button onClick={() => setOpenActionId(openActionId === emp.id ? null : emp.id)} className={`p-2 rounded-lg transition-colors action-trigger ${openActionId === emp.id ? 'bg-slate-200 text-slate-800' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}><MoreHorizontal size={18} /></button>
                    {openActionId === emp.id && (
                      <div className="dropdown-menu absolute right-10 top-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-[100] overflow-hidden animate-in fade-in zoom-in-95 origin-top-right">
                           {activeTab !== 'deleted' ? (
                               <>
                                   <button onClick={(e) => handleEditClick(e, emp)} className="w-full text-left px-4 py-3 text-sm font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2"><Edit2 size={16} /> Edit Details</button>
                                   {emp.status === 'Active' ? <button onClick={(e) => initiateMarkAsLeft(e, emp)} className="w-full text-left px-4 py-3 text-sm font-bold text-amber-600 hover:bg-amber-50 flex items-center gap-2 border-t border-slate-50"><UserX size={16} /> Mark as Left</button> : <button onClick={(e) => initiateReactivate(e, emp)} className="w-full text-left px-4 py-3 text-sm font-bold text-emerald-600 hover:bg-emerald-50 flex items-center gap-2 border-t border-slate-50"><UserCheck size={16} /> Re-activate</button>}
                                   <button onClick={(e) => initiateDelete(e, emp)} className="w-full text-left px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-50 flex items-center gap-2 border-t border-slate-50"><Trash2 size={16} /> Delete</button>
                               </>
                           ) : (
                               <>
                                   <button onClick={(e) => handleRestore(e, emp)} className="w-full text-left px-4 py-3 text-sm font-bold text-emerald-600 hover:bg-emerald-50 flex items-center gap-2"><RotateCcw size={16} /> Restore</button>
                                   <button onClick={(e) => initiateDelete(e, emp)} className="w-full text-left px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-50 flex items-center gap-2 border-t border-slate-50"><Trash2 size={16} /> Delete Permanently</button>
                               </>
                           )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- MODALS --- */}

      {/* Bulk Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95">
              <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                 <div>
                   <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Users className="text-indigo-600" /> Employee Bulk Import</h3>
                   <p className="text-xs text-slate-500 mt-1">Easily add multiple staff members from spreadsheets or logs.</p>
                 </div>
                 <button onClick={() => setShowImportModal(false)} className="p-2 hover:bg-white rounded-full transition-colors text-slate-400"><X size={20} /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-8">
                 {importStep === 'input' ? (
                   <div className="space-y-6">
                      <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex items-start gap-4">
                         <div className="p-2 bg-blue-100 text-blue-600 rounded-xl shrink-0"><FileText size={20} /></div>
                         <div className="text-xs text-blue-800 leading-relaxed">
                            <p className="font-bold mb-1">How to use:</p>
                            <p>Paste data from Excel, Google Sheets, or Notepad. <br/>Format should be: <strong>ID, Name</strong> (one per line). <br/>Example:<br/><code className="bg-white px-1 font-bold">101, Manoj Rana</code><br/><code className="bg-white px-1 font-bold">102, Pooja Sharma</code></p>
                         </div>
                      </div>

                      <textarea 
                         value={importText}
                         onChange={e => setImportText(e.target.value)}
                         className="w-full h-64 bg-slate-50 border border-slate-200 rounded-2xl p-6 font-mono text-xs outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-inner"
                         placeholder="Paste data here..."
                      ></textarea>

                      <div className="flex justify-between items-center">
                         <button onClick={() => alert('Template download coming soon!')} className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1"><Download size={14} /> Download Sample CSV</button>
                         <button onClick={handleParseImport} disabled={!importText.trim()} className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2 disabled:opacity-50"><ClipboardCopy size={18} /> Process Text</button>
                      </div>
                   </div>
                 ) : (
                   <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                      <div className="grid grid-cols-2 gap-6 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                         <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Assign to Department</label>
                            <select value={defaultImportSettings.department} onChange={e => setDefaultImportSettings({...defaultImportSettings, department: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500">
                               {departments.filter(d => d !== 'All Departments').map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                         </div>
                         <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Default Designation</label>
                            <input type="text" value={defaultImportSettings.designation} onChange={e => setDefaultImportSettings({...defaultImportSettings, designation: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500" />
                         </div>
                         <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Daily Wage (₹)</label>
                            <input type="number" value={defaultImportSettings.dailyWage} onChange={e => setDefaultImportSettings({...defaultImportSettings, dailyWage: Number(e.target.value)})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500" />
                         </div>
                         <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">OT Eligibility</label>
                            <div className="flex gap-2 mt-1">
                               <button onClick={() => setDefaultImportSettings({...defaultImportSettings, isOtAllowed: true})} className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${defaultImportSettings.isOtAllowed ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-500 border-slate-200'}`}>Allow</button>
                               <button onClick={() => setDefaultImportSettings({...defaultImportSettings, isOtAllowed: false})} className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${!defaultImportSettings.isOtAllowed ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-500 border-slate-200'}`}>Deny</button>
                            </div>
                         </div>
                      </div>

                      <div className="space-y-3">
                         <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex justify-between">Detected Employees <span>{parsedNewEmployees.length} Found</span></h4>
                         <div className="max-h-60 overflow-y-auto pr-2 space-y-2">
                            {parsedNewEmployees.map((p, i) => (
                               <div key={i} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl shadow-sm hover:border-indigo-200 transition-colors">
                                  <div className="flex items-center gap-3">
                                     <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-xs">{p.id}</div>
                                     <span className="text-sm font-bold text-slate-700">{p.name}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                     <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-50 px-2 py-0.5 rounded border border-slate-100">Valid</span>
                                  </div>
                               </div>
                            ))}
                         </div>
                      </div>
                   </div>
                 )}
              </div>

              <div className="px-8 py-6 border-t border-slate-100 bg-slate-50 flex gap-4">
                 {importStep === 'input' ? (
                    <button onClick={() => setShowImportModal(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-200 rounded-xl text-sm transition-all">Cancel</button>
                 ) : (
                    <button onClick={() => setImportStep('input')} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-200 rounded-xl text-sm transition-all flex items-center justify-center gap-2"><ArrowRight size={18} className="rotate-180" /> Back to Editor</button>
                 )}
                 <button 
                    onClick={importStep === 'input' ? handleParseImport : handleConfirmImport}
                    className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                 >
                    {importStep === 'input' ? <><ArrowRight size={18} /> Parse Data</> : <><Check size={18} /> Finalize Import</>}
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {editingEmployee && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-0 animate-in zoom-in-95 overflow-hidden flex flex-col max-h-[90vh]">
             <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Edit2 size={18} className="text-indigo-600" /> Edit Employee Details</h3>
                <button onClick={() => setEditingEmployee(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X size={20} /></button>
             </div>
             <div className="flex px-6 pt-2 border-b border-slate-100 overflow-x-auto">
                {[
                    { id: 'profile', label: 'Profile', icon: Briefcase },
                    { id: 'salary', label: 'Salary & Wages', icon: IndianRupee },
                    { id: 'shift', label: 'Shift & Timing', icon: Clock }
                ].map(tab => (
                    <button key={tab.id} onClick={() => setEditTab(tab.id as any)} className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${editTab === tab.id ? 'text-indigo-600 border-indigo-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}><tab.icon size={16} /> {tab.label}</button>
                ))}
             </div>
             <div className="p-6 overflow-y-auto">
                {editTab === 'profile' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                        <div className="flex items-center justify-center mb-4">
                            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                <div className="w-24 h-24 rounded-full overflow-hidden bg-slate-100 border-2 border-slate-200">{editingEmployee.avatar ? <img src={editingEmployee.avatar} alt="Profile" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-400"><User size={40} /></div>}</div>
                                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Camera size={24} className="text-white" /></div>
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Full Name</label>
                            <input type="text" value={editingEmployee.name} onChange={e => setEditingEmployee({...editingEmployee, name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Department</label>
                                <select value={editingEmployee.department} onChange={e => setEditingEmployee({...editingEmployee, department: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold outline-none">
                                    {departments.filter(d => d !== 'All Departments').map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Designation</label>
                                <input type="text" value={editingEmployee.designation} onChange={e => setEditingEmployee({...editingEmployee, designation: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                            </div>
                        </div>
                    </div>
                )}
                {editTab === 'salary' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                        <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                            <label className="text-xs font-bold text-indigo-700 uppercase mb-2 block">Payment Type</label>
                            <div className="flex bg-white p-1 rounded-lg border border-indigo-200">
                                <button onClick={() => setEditingEmployee({...editingEmployee, salaryType: 'Daily'})} className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${editingEmployee.salaryType === 'Daily' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500'}`}>Daily Wage</button>
                                <button onClick={() => setEditingEmployee({...editingEmployee, salaryType: 'Monthly'})} className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${editingEmployee.salaryType === 'Monthly' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500'}`}>Monthly Salary</button>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">{editingEmployee.salaryType === 'Daily' ? 'Daily Wage' : 'Monthly Salary'} (₹)</label>
                            <input type="number" value={editingEmployee.salaryType === 'Daily' ? editingEmployee.dailyWage : editingEmployee.monthlySalary} onChange={e => setEditingEmployee({...editingEmployee, [editingEmployee.salaryType === 'Daily' ? 'dailyWage' : 'monthlySalary']: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xl font-black outline-none" />
                        </div>
                    </div>
                )}
                {editTab === 'shift' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Assigned Shift</label>
                            <select value={editingEmployee.shiftId || ''} onChange={(e) => setEditingEmployee({...editingEmployee, shiftId: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none">
                                <option value="">No Shift Assigned</option>
                                {shifts.map(s => <option key={s.id} value={s.id}>{s.name} ({s.startTime}-{s.endTime})</option>)}
                            </select>
                        </div>
                    </div>
                )}
             </div>
             <div className="p-6 border-t border-slate-100 flex gap-3 bg-slate-50">
                <button onClick={() => setEditingEmployee(null)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-200 rounded-xl text-sm">Cancel</button>
                <button onClick={handleSaveEdit} className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 text-sm flex items-center justify-center gap-2"><Save size={16} /> Save Changes</button>
             </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 animate-in zoom-in-95">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4"><Trash2 size={32} /></div>
                    <h3 className="text-xl font-bold text-slate-800">{activeTab === 'deleted' ? 'Permanent Delete?' : 'Move to Trash?'}</h3>
                    <p className="text-sm text-slate-500 mt-2">{isBulkDelete ? `Confirm deletion of ${selectedIds.length} employees.` : `Confirm deletion of ${employeeToDelete?.name}.`}</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => { setShowDeleteModal(false); setEmployeeToDelete(null); setIsBulkDelete(false); }} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl">Cancel</button>
                    <button onClick={confirmDelete} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl shadow-lg hover:bg-red-700">Confirm</button>
                </div>
            </div>
        </div>
      )}

      {/* Mark as Left Modal */}
      {showLeftModal && employeeToLeave && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 animate-in zoom-in-95">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4"><UserX size={32} /></div>
                    <h3 className="text-xl font-bold text-slate-800">Exit Employee</h3>
                    <p className="text-sm text-slate-500 mt-2">Moving <strong>{employeeToLeave.name}</strong> to inactive list.</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6">
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Leaving Date</label>
                    <input type="date" value={leavingDate} onChange={(e) => setLeavingDate(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 outline-none" />
                </div>
                <div className="flex gap-3">
                    <button onClick={() => { setShowLeftModal(false); setEmployeeToLeave(null); }} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl">Cancel</button>
                    <button onClick={confirmMarkAsLeft} className="flex-1 py-3 bg-amber-600 text-white font-bold rounded-xl shadow-lg hover:bg-amber-700">Confirm</button>
                </div>
            </div>
        </div>
      )}

      {/* Reactivate Modal */}
      {showReactivateModal && employeeToReactivate && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 animate-in zoom-in-95">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4"><UserCheck size={32} /></div>
                    <h3 className="text-xl font-bold text-slate-800">Restore Employee</h3>
                    <p className="text-sm text-slate-500 mt-2">Move <strong>{employeeToReactivate.name}</strong> back to active list?</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => { setShowReactivateModal(false); setEmployeeToReactivate(null); }} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl">Cancel</button>
                    <button onClick={confirmReactivate} className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl shadow-lg hover:bg-emerald-700">Confirm</button>
                </div>
            </div>
        </div>
      )}

      {/* Bulk Edit Modal */}
      {showBulkEdit && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 animate-in zoom-in-95">
             <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Edit2 size={18} className="text-indigo-600" /> Bulk Edit</h3>
                <button onClick={() => setShowBulkEdit(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X size={20} /></button>
             </div>
             <div className="space-y-4">
                <div>
                   <label className="text-xs font-bold text-slate-500 uppercase">Department</label>
                   <select value={bulkChanges.department} onChange={e => setBulkChanges({...bulkChanges, department: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold outline-none">
                     <option value="">No Change</option>
                     {departments.filter(d => d !== 'All Departments').map(d => <option key={d} value={d}>{d}</option>)}
                   </select>
                </div>
                <div>
                   <label className="text-xs font-bold text-slate-500 uppercase">Designation</label>
                   <input type="text" placeholder="No Change" value={bulkChanges.designation} onChange={e => setBulkChanges({...bulkChanges, designation: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold outline-none" />
                </div>
                <div>
                   <label className="text-xs font-bold text-slate-500 uppercase">Daily Wage (₹)</label>
                   <input type="number" placeholder="No Change" value={bulkChanges.dailyWage} onChange={e => setBulkChanges({...bulkChanges, dailyWage: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold outline-none" />
                </div>
             </div>
             <div className="pt-6 flex gap-3">
                <button onClick={() => setShowBulkEdit(false)} className="flex-1 py-2.5 text-slate-500 font-bold hover:bg-slate-50 rounded-xl">Cancel</button>
                <button onClick={applyBulkChanges} className="flex-1 py-2.5 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 flex items-center justify-center gap-2"><Save size={16} /> Update All</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeManagement;
