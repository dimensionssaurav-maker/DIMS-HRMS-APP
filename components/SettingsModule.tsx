
import React, { useState, useMemo } from 'react';
import { 
  User, 
  Settings, 
  Bell, 
  Shield, 
  Save, 
  Plus, 
  Trash2, 
  Building, 
  ToggleLeft, 
  ToggleRight, 
  IndianRupee, 
  Clock,
  Building2,
  CalendarClock,
  X,
  AlertCircle,
  Lock,
  Unlock,
  CheckCircle2,
  XCircle,
  Edit2
} from 'lucide-react';
import { PayrollConfig, Employee, DeductionRule, OTRule, SystemUser } from '../types';

type PermissionLevel = 'Full Access' | 'View Only' | 'View Self' | 'No Access';

interface ModulePermission {
  id: string;
  name: string;
  description: string;
  admin: PermissionLevel;
  hr: PermissionLevel;
  manager: PermissionLevel;
  employee: PermissionLevel;
}

interface Props {
  payrollConfig: PayrollConfig;
  onUpdatePayrollConfig: (config: PayrollConfig) => void;
  employees: Employee[];
  departments?: string[];
  onUpdateDepartments?: (depts: string[]) => void;
  users: SystemUser[];
  onUpdateUsers: (users: SystemUser[]) => void;
}

const SettingsModule: React.FC<Props> = ({ payrollConfig, onUpdatePayrollConfig, employees, departments = [], onUpdateDepartments, users, onUpdateUsers }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'users' | 'security' | 'notifications' | 'payroll' | 'attendance'>('general');
  
  // Local state for payroll config editing
  const [localPayrollConfig, setLocalPayrollConfig] = useState<PayrollConfig>(payrollConfig);
  const [newDesignation, setNewDesignation] = useState('');
  const [newMultiplier, setNewMultiplier] = useState(1.5);

  // Local state for departments
  const [newDeptName, setNewDeptName] = useState('');

  // Local state for fooding overrides
  const [newFoodingDept, setNewFoodingDept] = useState('');
  const [newFoodingMinHours, setNewFoodingMinHours] = useState(4);
  const [newFoodingAmount, setNewFoodingAmount] = useState(50);

  // Local state for Recruitment
  const [newSource, setNewSource] = useState('');
  const [newServiceRate, setNewServiceRate] = useState<string>('');

  // Security Settings State
  const [securityConfig, setSecurityConfig] = useState({
    twoFactor: true,
    passwordExpiry: 90,
    sessionTimeout: '30',
    ipRestriction: false
  });

  // Permissions Matrix State
  const [permissions, setPermissions] = useState<ModulePermission[]>([
    { id: 'emp', name: 'Employee Management', description: 'Add, edit, or delete employee profiles', admin: 'Full Access', hr: 'Full Access', manager: 'View Only', employee: 'View Self' },
    { id: 'payroll', name: 'Payroll Processing', description: 'Calculate salaries, view payslips', admin: 'Full Access', hr: 'Full Access', manager: 'No Access', employee: 'No Access' },
    { id: 'att', name: 'Attendance & Shifts', description: 'Manage daily logs and shift timings', admin: 'Full Access', hr: 'Full Access', manager: 'Full Access', employee: 'View Self' },
    { id: 'exp', name: 'Expense Approvals', description: 'Review and approve reimbursement claims', admin: 'Full Access', hr: 'Full Access', manager: 'Full Access', employee: 'No Access' },
    { id: 'settings', name: 'System Settings', description: 'Configure global rules and users', admin: 'Full Access', hr: 'No Access', manager: 'No Access', employee: 'No Access' },
  ]);

  // User Management State
  const [showUserModal, setShowUserModal] = useState(false);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [userForm, setUserForm] = useState<Partial<SystemUser>>({
    name: '',
    email: '',
    role: 'HR',
    status: 'Active',
    isLocked: false
  });

  const [companySettings, setCompanySettings] = useState({
    companyName: 'ZenHR Solutions Pvt Ltd',
    contactEmail: 'contact@zenhr.com',
    phone: '+91 98765 43210',
    address: '123, Tech Park, Bangalore, India',
    currency: 'INR',
    timezone: 'IST (UTC+05:30)'
  });

  const uniqueDesignations = useMemo(() => {
    return Array.from(new Set(employees.map(e => e.designation))).sort();
  }, [employees]);

  const getDeptEmployeeCount = (dept: string) => {
    return employees.filter(e => e.department === dept).length;
  };

  const handleDeleteUser = (id: string) => {
    const user = users.find(u => u.id === id);
    if (user?.isLocked) {
        alert("This user is locked and cannot be deleted.");
        return;
    }
    if(window.confirm('Are you sure you want to remove this user?')) {
      onUpdateUsers(users.filter(u => u.id !== id));
    }
  };

  const handleEditUser = (user: SystemUser) => {
    if (user.isLocked) {
        alert("This user is locked. Unlock to make changes.");
        return;
    }
    setUserForm({ ...user });
    setIsEditingUser(true);
    setShowUserModal(true);
  };

  const toggleUserLock = (id: string) => {
      onUpdateUsers(users.map(u => u.id === id ? { ...u, isLocked: !u.isLocked } : u));
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm.name || !userForm.email) return;

    if (isEditingUser && userForm.id) {
        onUpdateUsers(users.map(u => u.id === userForm.id ? { ...u, ...userForm } as SystemUser : u));
    } else {
        const userToAdd: SystemUser = {
            id: `u${Date.now()}`,
            name: userForm.name!,
            email: userForm.email!,
            role: userForm.role as any,
            status: userForm.status as any,
            lastLogin: 'Never',
            isLocked: userForm.isLocked
        };
        onUpdateUsers([...users, userToAdd]);
    }
    setShowUserModal(false);
    setUserForm({ name: '', email: '', role: 'HR', status: 'Active', isLocked: false });
    setIsEditingUser(false);
  };

  const handleSavePayroll = () => {
    onUpdatePayrollConfig(localPayrollConfig);
    alert('Configuration updated successfully!');
  };

  const handlePermissionChange = (moduleId: string, role: keyof Omit<ModulePermission, 'id' | 'name' | 'description'>, value: PermissionLevel) => {
    setPermissions(prev => prev.map(p => 
      p.id === moduleId ? { ...p, [role]: value } : p
    ));
  };

  // --- Payroll Config Helpers ---

  const addDesignationOverride = () => {
    if (newDesignation && newMultiplier > 0) {
      setLocalPayrollConfig(prev => ({
        ...prev,
        designationOverrides: {
          ...prev.designationOverrides,
          [newDesignation]: newMultiplier
        }
      }));
      setNewDesignation('');
      setNewMultiplier(1.5);
    }
  };

  const removeDesignationOverride = (designation: string) => {
    const updatedOverrides = { ...localPayrollConfig.designationOverrides };
    delete updatedOverrides[designation];
    setLocalPayrollConfig({ ...localPayrollConfig, designationOverrides: updatedOverrides });
  };

  const addFoodingOverride = () => {
    if (newFoodingDept && newFoodingMinHours > 0 && newFoodingAmount >= 0) {
        setLocalPayrollConfig(prev => ({
            ...prev,
            foodingConfig: {
                ...prev.foodingConfig,
                departmentOverrides: {
                    ...prev.foodingConfig.departmentOverrides,
                    [newFoodingDept]: { minHours: newFoodingMinHours, amount: newFoodingAmount }
                }
            }
        }));
        setNewFoodingDept('');
        setNewFoodingMinHours(4);
        setNewFoodingAmount(50);
    }
  };

  const removeFoodingOverride = (dept: string) => {
      const updatedOverrides = { ...localPayrollConfig.foodingConfig.departmentOverrides };
      delete updatedOverrides[dept];
      setLocalPayrollConfig({
          ...localPayrollConfig,
          foodingConfig: {
              ...localPayrollConfig.foodingConfig,
              departmentOverrides: updatedOverrides
          }
      });
  };

  // --- Department Management ---
  const handleAddDepartment = () => {
      const trimmedName = newDeptName.trim();
      if (!trimmedName) return;
      if (departments.some(d => d.toLowerCase() === trimmedName.toLowerCase())) {
          alert('Department already exists!');
          return;
      }
      if (onUpdateDepartments) {
          onUpdateDepartments([...departments, trimmedName]);
          setNewDeptName('');
      }
  };

  const handleRemoveDepartment = (dept: string) => {
      if (dept === 'All Departments') return;
      if (getDeptEmployeeCount(dept) > 0) {
          alert('Cannot remove a department that has assigned employees.');
          return;
      }
      if (onUpdateDepartments) {
          onUpdateDepartments(departments.filter(d => d !== dept));
      }
  };

  // --- Attendance Rule Helpers ---
  const updateRule = (
      type: 'lateRules' | 'earlyExitRules', 
      index: number, 
      field: keyof DeductionRule, 
      value: any
  ) => {
      if (!localPayrollConfig.attendanceConfig) return;
      const newRules = [...localPayrollConfig.attendanceConfig[type]];
      newRules[index] = { ...newRules[index], [field]: value };
      setLocalPayrollConfig({
          ...localPayrollConfig,
          attendanceConfig: {
              ...localPayrollConfig.attendanceConfig,
              [type]: newRules
          }
      });
  };

  const addRule = (type: 'lateRules' | 'earlyExitRules') => {
      if (!localPayrollConfig.attendanceConfig) return;
      const newRule: DeductionRule = {
          id: `${type}-${Date.now()}`,
          department: 'All Departments',
          thresholdMinutes: type === 'lateRules' ? 15 : 30,
          deductionAmount: 0.5,
          exemptionsCount: 0,
          enabled: true
      };
      setLocalPayrollConfig({
          ...localPayrollConfig,
          attendanceConfig: {
              ...localPayrollConfig.attendanceConfig,
              [type]: [...localPayrollConfig.attendanceConfig[type], newRule]
          }
      });
  };

  const removeRule = (type: 'lateRules' | 'earlyExitRules', index: number) => {
      if (!localPayrollConfig.attendanceConfig) return;
      const newRules = [...localPayrollConfig.attendanceConfig[type]];
      newRules.splice(index, 1);
      setLocalPayrollConfig({
          ...localPayrollConfig,
          attendanceConfig: {
              ...localPayrollConfig.attendanceConfig,
              [type]: newRules
          }
      });
  };

  // --- OT Rule Helpers ---
  const toggleOTRules = () => {
      setLocalPayrollConfig(prev => ({
          ...prev,
          otConfig: {
              enabled: !(prev.otConfig?.enabled ?? false),
              rules: prev.otConfig?.rules || []
          }
      }));
  };

  const addOTRule = () => {
      const newRule: OTRule = {
          id: `ot-${Date.now()}`,
          department: 'All Departments',
          thresholdMinutes: 210, // 3.5 Hours default (stored as minutes)
          payoutAmount: 4,
          enabled: true
      };
      setLocalPayrollConfig(prev => ({
          ...prev,
          otConfig: {
              ...prev.otConfig!,
              enabled: true,
              rules: [...(prev.otConfig?.rules || []), newRule]
          }
      }));
  };

  const updateOTRule = (index: number, field: keyof OTRule, value: any) => {
      if (!localPayrollConfig.otConfig) return;
      const newRules = [...localPayrollConfig.otConfig.rules];
      newRules[index] = { ...newRules[index], [field]: value };
      setLocalPayrollConfig({
          ...localPayrollConfig,
          otConfig: {
              ...localPayrollConfig.otConfig,
              rules: newRules
          }
      });
  };

  const removeOTRule = (index: number) => {
      if (!localPayrollConfig.otConfig) return;
      const newRules = [...localPayrollConfig.otConfig.rules];
      newRules.splice(index, 1);
      setLocalPayrollConfig({
          ...localPayrollConfig,
          otConfig: {
              ...localPayrollConfig.otConfig,
              rules: newRules
          }
      });
  };

  // --- Recruitment Helpers ---
  const addSource = () => {
      if (newSource.trim() && localPayrollConfig.recruitmentConfig) {
          if (localPayrollConfig.recruitmentConfig.sources.includes(newSource.trim())) return;
          setLocalPayrollConfig({
              ...localPayrollConfig,
              recruitmentConfig: {
                  ...localPayrollConfig.recruitmentConfig,
                  sources: [...localPayrollConfig.recruitmentConfig.sources, newSource.trim()]
              }
          });
          setNewSource('');
      }
  };

  const removeSource = (source: string) => {
      if (localPayrollConfig.recruitmentConfig) {
          setLocalPayrollConfig({
              ...localPayrollConfig,
              recruitmentConfig: {
                  ...localPayrollConfig.recruitmentConfig,
                  sources: localPayrollConfig.recruitmentConfig.sources.filter(s => s !== source)
              }
          });
      }
  };

  const addServiceRate = () => {
      const rate = parseFloat(newServiceRate);
      if (!isNaN(rate) && rate >= 0 && localPayrollConfig.recruitmentConfig) {
          const decimalRate = rate > 1 ? rate / 100 : rate;
          if (localPayrollConfig.recruitmentConfig.serviceChargeRates.includes(decimalRate)) return;
          
          const newRates = [...localPayrollConfig.recruitmentConfig.serviceChargeRates, decimalRate].sort((a, b) => a - b);
          setLocalPayrollConfig({
              ...localPayrollConfig,
              recruitmentConfig: {
                  ...localPayrollConfig.recruitmentConfig,
                  serviceChargeRates: newRates
              }
          });
          setNewServiceRate('');
      }
  };

  const removeServiceRate = (rate: number) => {
      if (localPayrollConfig.recruitmentConfig) {
          setLocalPayrollConfig({
              ...localPayrollConfig,
              recruitmentConfig: {
                  ...localPayrollConfig.recruitmentConfig,
                  serviceChargeRates: localPayrollConfig.recruitmentConfig.serviceChargeRates.filter(r => r !== rate)
              }
          });
      }
  };

  // Helper for rendering permission select
  const PermissionSelect = ({ value, onChange, disabled = false }: { value: PermissionLevel, onChange: (v: PermissionLevel) => void, disabled?: boolean }) => {
    const getColor = (v: PermissionLevel) => {
      switch(v) {
        case 'Full Access': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        case 'View Only': return 'bg-blue-50 text-blue-700 border-blue-200';
        case 'View Self': return 'bg-amber-50 text-amber-700 border-amber-200';
        default: return 'bg-slate-50 text-slate-500 border-slate-200';
      }
    };

    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as PermissionLevel)}
        disabled={disabled}
        className={`w-full text-xs font-bold px-2 py-1.5 rounded-lg border outline-none cursor-pointer transition-all ${getColor(value)} ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-opacity-100'}`}
      >
        <option value="Full Access">Full Access</option>
        <option value="View Only">View Only</option>
        <option value="View Self">View Self</option>
        <option value="No Access">No Access</option>
      </select>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header and other tabs remain mostly the same, simplified for brevity */}
      <div className="flex items-center justify-between">
        <div>
           <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
             <Settings className="text-indigo-600" />
             Settings
           </h2>
           <p className="text-slate-500">Manage system configurations and user access.</p>
        </div>
        {activeTab === 'payroll' || activeTab === 'attendance' ? (
          <button 
             onClick={handleSavePayroll}
             className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
          >
            <Save size={18} />
            Update Config
          </button>
        ) : activeTab === 'security' ? (
          <button 
             onClick={() => alert('Security settings updated successfully!')}
             className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
          >
            <Save size={18} />
            Save Security
          </button>
        ) : (
          <button 
             onClick={() => alert('Settings saved successfully!')}
             className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
          >
            <Save size={18} />
            Save Changes
          </button>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="w-full lg:w-64 space-y-2">
          {[
            { id: 'general', label: 'General', icon: Building },
            { id: 'payroll', label: 'Payroll Config', icon: IndianRupee },
            { id: 'attendance', label: 'Attendance Rules', icon: CalendarClock },
            { id: 'users', label: 'User Management', icon: User },
            { id: 'security', label: 'Security & Permissions', icon: Shield },
            { id: 'notifications', label: 'Notifications', icon: Bell },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                activeTab === tab.id 
                  ? 'bg-white text-indigo-600 shadow-sm border border-slate-100' 
                  : 'text-slate-500 hover:bg-white/50'
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm min-h-[500px]">
           {activeTab === 'general' && (
             <div className="space-y-8 max-w-3xl">
                {/* Company Details */}
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-4 flex items-center gap-2">
                        <Building size={20} className="text-indigo-600" />
                        Company Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Company Name</label>
                            <input 
                                type="text" 
                                value={companySettings.companyName}
                                onChange={(e) => setCompanySettings({...companySettings, companyName: e.target.value})}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500 mt-1"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Contact Email</label>
                            <input 
                                type="email" 
                                value={companySettings.contactEmail}
                                onChange={(e) => setCompanySettings({...companySettings, contactEmail: e.target.value})}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500 mt-1"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Phone Number</label>
                            <input 
                                type="text" 
                                value={companySettings.phone}
                                onChange={(e) => setCompanySettings({...companySettings, phone: e.target.value})}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500 mt-1"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Currency</label>
                            <select 
                                value={companySettings.currency}
                                onChange={(e) => setCompanySettings({...companySettings, currency: e.target.value})}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500 mt-1"
                            >
                                <option value="INR">INR (₹)</option>
                                <option value="USD">USD ($)</option>
                                <option value="EUR">EUR (€)</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-4 flex items-center gap-2">
                        <Building2 size={20} className="text-indigo-600" />
                        Organization Structure
                    </h3>
                    
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                        <div className="flex gap-2 mb-4">
                            <input 
                                type="text" 
                                placeholder="New Department Name"
                                value={newDeptName}
                                onChange={(e) => setNewDeptName(e.target.value)}
                                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <button 
                                onClick={handleAddDepartment}
                                disabled={!newDeptName.trim()}
                                className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2 text-sm"
                            >
                                <Plus size={16} /> Add Dept
                            </button>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {departments.map(dept => (
                                <div key={dept} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl shadow-sm group hover:border-indigo-100 transition-all">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-slate-700 text-xs">{dept}</span>
                                        {dept !== 'All Departments' && (
                                            <span className="text-[10px] text-slate-400">{getDeptEmployeeCount(dept)} Staff</span>
                                        )}
                                    </div>
                                    {dept !== 'All Departments' && (
                                        <button 
                                            onClick={() => handleRemoveDepartment(dept)}
                                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                            title="Remove Department"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
             </div>
           )}

            {activeTab === 'payroll' && (
              <div className="space-y-8 max-w-4xl animate-in fade-in">
                <div className="border-b border-slate-100 pb-4">
                  <h3 className="text-lg font-bold text-slate-800">Payroll Configuration</h3>
                  <p className="text-xs text-slate-500">Global rules for salary calculations, overtime, and benefits.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Global OT Multiplier */}
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                    <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                      <Clock size={18} className="text-indigo-600" /> Overtime Multiplier
                    </h4>
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">Default Multiplier</label>
                        <div className="flex items-center gap-3 mt-1">
                          <input 
                            type="number" 
                            step="0.1"
                            value={localPayrollConfig.globalOtMultiplier}
                            onChange={(e) => setLocalPayrollConfig({...localPayrollConfig, globalOtMultiplier: parseFloat(e.target.value)})}
                            className="w-24 px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <span className="text-xs text-slate-400 font-medium">x Hourly Rate</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Fooding Config */}
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-bold text-slate-700 flex items-center gap-2">
                        <IndianRupee size={18} className="text-indigo-600" /> Fooding Allowance
                      </h4>
                      <button 
                        onClick={() => setLocalPayrollConfig({
                          ...localPayrollConfig, 
                          foodingConfig: { ...localPayrollConfig.foodingConfig, enabled: !localPayrollConfig.foodingConfig.enabled }
                        })}
                        className={`p-1 rounded-full transition-all ${localPayrollConfig.foodingConfig.enabled ? 'text-indigo-600' : 'text-slate-300'}`}
                      >
                        {localPayrollConfig.foodingConfig.enabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                      </button>
                    </div>
                    <div className={`space-y-4 transition-opacity ${localPayrollConfig.foodingConfig.enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase">Min Hours</label>
                          <input 
                            type="number" 
                            value={localPayrollConfig.foodingConfig.minHours}
                            onChange={(e) => setLocalPayrollConfig({
                              ...localPayrollConfig, 
                              foodingConfig: { ...localPayrollConfig.foodingConfig, minHours: parseInt(e.target.value) }
                            })}
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold outline-none mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase">Amount (₹)</label>
                          <input 
                            type="number" 
                            value={localPayrollConfig.foodingConfig.amount}
                            onChange={(e) => setLocalPayrollConfig({
                              ...localPayrollConfig, 
                              foodingConfig: { ...localPayrollConfig.foodingConfig, amount: parseInt(e.target.value) }
                            })}
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold outline-none mt-1"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Designation Overrides */}
                <div className="space-y-4">
                  <h4 className="font-bold text-slate-700 flex items-center gap-2">
                    <Building size={18} className="text-indigo-600" /> Designation Overrides
                  </h4>
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                    <div className="flex gap-3 mb-6">
                      <select 
                        value={newDesignation}
                        onChange={(e) => setNewDesignation(e.target.value)}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold outline-none"
                      >
                        <option value="">Select Designation</option>
                        {uniqueDesignations.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                      <input 
                        type="number" 
                        step="0.1"
                        placeholder="Multiplier"
                        value={newMultiplier}
                        onChange={(e) => setNewMultiplier(parseFloat(e.target.value))}
                        className="w-32 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold outline-none"
                      />
                      <button 
                        onClick={addDesignationOverride}
                        disabled={!newDesignation}
                        className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {Object.entries(localPayrollConfig.designationOverrides).map(([designation, multiplier]) => (
                        <div key={designation} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                          <div>
                            <p className="text-xs font-bold text-slate-700">{designation}</p>
                            <p className="text-[10px] text-indigo-600 font-bold">{multiplier}x Multiplier</p>
                          </div>
                          <button 
                            onClick={() => removeDesignationOverride(designation)}
                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Recruitment Config */}
                <div className="space-y-4">
                  <h4 className="font-bold text-slate-700 flex items-center gap-2">
                    <Building2 size={18} className="text-indigo-600" /> Recruitment & Service Charges
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                      <label className="text-xs font-bold text-slate-500 uppercase mb-3 block">Recruitment Sources</label>
                      <div className="flex gap-2 mb-4">
                        <input 
                          type="text" 
                          placeholder="e.g. LinkedIn"
                          value={newSource}
                          onChange={(e) => setNewSource(e.target.value)}
                          className="flex-1 px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold outline-none"
                        />
                        <button onClick={addSource} className="bg-indigo-600 text-white p-2 rounded-xl hover:bg-indigo-700"><Plus size={18}/></button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {localPayrollConfig.recruitmentConfig?.sources.map(source => (
                          <span key={source} className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-100 rounded-lg text-xs font-bold text-slate-600">
                            {source}
                            <button onClick={() => removeSource(source)} className="text-slate-300 hover:text-red-500"><X size={12}/></button>
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                      <label className="text-xs font-bold text-slate-500 uppercase mb-3 block">Service Charge Rates (%)</label>
                      <div className="flex gap-2 mb-4">
                        <input 
                          type="number" 
                          placeholder="e.g. 8.33"
                          value={newServiceRate}
                          onChange={(e) => setNewServiceRate(e.target.value)}
                          className="flex-1 px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold outline-none"
                        />
                        <button onClick={addServiceRate} className="bg-indigo-600 text-white p-2 rounded-xl hover:bg-indigo-700"><Plus size={18}/></button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {localPayrollConfig.recruitmentConfig?.serviceChargeRates.map(rate => (
                          <span key={rate} className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-100 rounded-lg text-xs font-bold text-slate-600">
                            {(rate * 100).toFixed(2)}%
                            <button onClick={() => removeServiceRate(rate)} className="text-slate-300 hover:text-red-500"><X size={12}/></button>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'attendance' && (
              <div className="space-y-8 max-w-4xl animate-in fade-in">
                <div className="border-b border-slate-100 pb-4">
                  <h3 className="text-lg font-bold text-slate-800">Attendance & Punctuality Rules</h3>
                  <p className="text-xs text-slate-500">Define penalties for late arrivals, early exits, and overtime eligibility.</p>
                </div>

                {/* Late Arrival Rules */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-slate-700 flex items-center gap-2">
                      <Clock size={18} className="text-amber-500" /> Late Arrival Penalties
                    </h4>
                    <button 
                      onClick={() => addRule('lateRules')}
                      className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 flex items-center gap-1"
                    >
                      <Plus size={14} /> Add Rule
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    {localPayrollConfig.attendanceConfig?.lateRules.map((rule, idx) => (
                      <div key={rule.id} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 flex flex-wrap items-center gap-6">
                        <div className="flex-1 min-w-[200px]">
                          <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Department</label>
                          <select 
                            value={rule.department}
                            onChange={(e) => updateRule('lateRules', idx, 'department', e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold outline-none"
                          >
                            <option value="All Departments">All Departments</option>
                            {departments.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </div>
                        <div className="w-24">
                          <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Grace (Min)</label>
                          <input 
                            type="number"
                            value={rule.thresholdMinutes}
                            onChange={(e) => updateRule('lateRules', idx, 'thresholdMinutes', parseInt(e.target.value))}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none"
                          />
                        </div>
                        <div className="w-24">
                          <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Deduction (Day)</label>
                          <input 
                            type="number"
                            step="0.1"
                            value={rule.deductionAmount}
                            onChange={(e) => updateRule('lateRules', idx, 'deductionAmount', parseFloat(e.target.value))}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none"
                          />
                        </div>
                        <div className="w-24">
                          <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Exemptions</label>
                          <input 
                            type="number"
                            value={rule.exemptionsCount}
                            onChange={(e) => updateRule('lateRules', idx, 'exemptionsCount', parseInt(e.target.value))}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none"
                          />
                        </div>
                        <button 
                          onClick={() => removeRule('lateRules', idx)}
                          className="mt-5 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* OT Eligibility Rules */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-slate-700 flex items-center gap-2">
                      <CalendarClock size={18} className="text-emerald-500" /> Overtime Eligibility
                    </h4>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={toggleOTRules}
                        className={`p-1 rounded-full transition-all ${localPayrollConfig.otConfig?.enabled ? 'text-indigo-600' : 'text-slate-300'}`}
                      >
                        {localPayrollConfig.otConfig?.enabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                      </button>
                      <button 
                        onClick={addOTRule}
                        disabled={!localPayrollConfig.otConfig?.enabled}
                        className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 flex items-center gap-1 disabled:opacity-50"
                      >
                        <Plus size={14} /> Add Rule
                      </button>
                    </div>
                  </div>
                  <div className={`grid grid-cols-1 gap-4 transition-opacity ${localPayrollConfig.otConfig?.enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                    {localPayrollConfig.otConfig?.rules.map((rule, idx) => (
                      <div key={rule.id} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 flex flex-wrap items-center gap-6">
                        <div className="flex-1 min-w-[200px]">
                          <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Department</label>
                          <select 
                            value={rule.department}
                            onChange={(e) => updateOTRule(idx, 'department', e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold outline-none"
                          >
                            <option value="All Departments">All Departments</option>
                            {departments.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </div>
                        <div className="w-32">
                          <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Min Duration (Hrs)</label>
                          <input 
                            type="number"
                            step="0.5"
                            value={rule.thresholdMinutes / 60}
                            onChange={(e) => updateOTRule(idx, 'thresholdMinutes', parseFloat(e.target.value) * 60)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none"
                          />
                        </div>
                        <div className="w-32">
                          <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Payout (₹/Hr)</label>
                          <input 
                            type="number"
                            value={rule.payoutAmount}
                            onChange={(e) => updateOTRule(idx, 'payoutAmount', parseInt(e.target.value))}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none"
                          />
                        </div>
                        <button 
                          onClick={() => removeOTRule(idx)}
                          className="mt-5 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="space-y-8 animate-in fade-in">
                <div className="border-b border-slate-100 pb-4">
                  <h3 className="text-lg font-bold text-slate-800">Notification Settings</h3>
                  <p className="text-xs text-slate-500">Configure how and when users receive system alerts.</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                    <h4 className="font-bold text-slate-700 flex items-center gap-2">
                      <Bell size={18} className="text-indigo-600" /> Email Notifications
                    </h4>
                    <div className="space-y-3">
                      {[
                        { label: 'Payroll Generation', desc: 'Notify when monthly payroll is processed' },
                        { label: 'Leave Requests', desc: 'Alert managers for new leave applications' },
                        { label: 'Expense Claims', desc: 'Notify finance team for reimbursement requests' },
                        { label: 'System Alerts', desc: 'Critical security and system updates' }
                      ].map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between py-2">
                          <div>
                            <p className="text-sm font-bold text-slate-700">{item.label}</p>
                            <p className="text-[10px] text-slate-400">{item.desc}</p>
                          </div>
                          <button className="text-indigo-600"><ToggleRight size={24}/></button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                    <h4 className="font-bold text-slate-700 flex items-center gap-2">
                      <AlertCircle size={18} className="text-amber-500" /> Push Notifications
                    </h4>
                    <div className="space-y-3">
                      {[
                        { label: 'Daily Attendance', desc: 'Reminders for clock-in/out' },
                        { label: 'Shift Changes', desc: 'Notify employees of schedule updates' },
                        { label: 'Holiday Reminders', desc: 'Alerts for upcoming public holidays' },
                        { label: 'Birthday Wishes', desc: 'Automated team birthday notifications' }
                      ].map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between py-2">
                          <div>
                            <p className="text-sm font-bold text-slate-700">{item.label}</p>
                            <p className="text-[10px] text-slate-400">{item.desc}</p>
                          </div>
                          <button className="text-slate-300"><ToggleLeft size={24}/></button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
           
           {activeTab === 'users' && (
             <div className="space-y-6">
               <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                 <h3 className="text-lg font-bold text-slate-800">System Users</h3>
                 <button 
                    onClick={() => {
                        setIsEditingUser(false);
                        setUserForm({ name: '', email: '', role: 'HR', status: 'Active', isLocked: false });
                        setShowUserModal(true);
                    }} 
                    className="text-sm font-bold text-indigo-600 bg-indigo-50 px-4 py-2 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-2"
                 >
                   <Plus size={16} /> Add User
                 </button>
               </div>
               <div className="overflow-x-auto">
                 <table className="w-full text-left border-collapse">
                   <thead>
                     <tr className="text-xs font-bold text-slate-500 uppercase border-b border-slate-100">
                       <th className="py-3 px-2">User</th>
                       <th className="py-3 px-2">Role</th>
                       <th className="py-3 px-2">Status</th>
                       <th className="py-3 px-2">Last Login</th>
                       <th className="py-3 px-2 text-right">Actions</th>
                     </tr>
                   </thead>
                   <tbody className="text-sm">
                     {users.map(user => (
                       <tr key={user.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                         <td className="py-3 px-2">
                           <div className="flex items-center gap-3">
                             <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">{user.name.charAt(0)}</div>
                             <div>
                                 <p className="font-bold text-slate-800 flex items-center gap-2">
                                     {user.name}
                                     {user.isLocked && <Lock size={12} className="text-amber-500" title="Locked" />}
                                 </p>
                                 <p className="text-xs text-slate-400">{user.email}</p>
                             </div>
                           </div>
                         </td>
                         <td className="py-3 px-2"><span className="px-2 py-1 bg-slate-100 rounded text-xs font-bold text-slate-600">{user.role}</span></td>
                         <td className="py-3 px-2"><span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${user.status === 'Active' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>{user.status}</span></td>
                         <td className="py-3 px-2 text-slate-500 text-xs">{user.lastLogin}</td>
                         <td className="py-3 px-2 text-right">
                           <div className="flex items-center justify-end gap-2">
                               <button 
                                    onClick={() => toggleUserLock(user.id)} 
                                    className={`p-2 rounded-lg transition-colors ${user.isLocked ? 'text-amber-500 hover:bg-amber-50' : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100'}`}
                                    title={user.isLocked ? 'Unlock User' : 'Lock User'}
                               >
                                   {user.isLocked ? <Lock size={16} /> : <Unlock size={16} />}
                               </button>
                               <button 
                                    onClick={() => handleEditUser(user)}
                                    className={`p-2 rounded-lg transition-colors ${user.isLocked ? 'text-slate-300 cursor-not-allowed' : 'text-indigo-600 hover:bg-indigo-50'}`}
                                    disabled={user.isLocked}
                                    title="Edit User"
                               >
                                   <Edit2 size={16} />
                               </button>
                               <button 
                                    onClick={() => handleDeleteUser(user.id)} 
                                    className={`p-2 rounded-lg transition-colors ${user.isLocked ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'}`}
                                    disabled={user.isLocked}
                                    title="Delete User"
                               >
                                   <Trash2 size={16} />
                               </button>
                           </div>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             </div>
           )}

           {/* Security Tab remains largely same, omitted deep nesting logic repetition */}
           {activeTab === 'security' && (
              <div className="space-y-8 animate-in fade-in">
                <div className="border-b border-slate-100 pb-4">
                  <h3 className="text-lg font-bold text-slate-800">Security & Permissions</h3>
                  <p className="text-xs text-slate-500">Configure access levels and system security protocols.</p>
                </div>
                
                {/* Permissions Matrix */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="p-4 bg-slate-50 border-b border-slate-100">
                    <h4 className="font-bold text-slate-700 flex items-center gap-2">
                      <Shield size={18} className="text-indigo-600"/> Role Permissions
                    </h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-xs font-bold text-slate-500 uppercase border-b border-slate-100 bg-slate-50/50">
                          <th className="px-6 py-4 w-1/3">Module Access</th>
                          <th className="px-4 py-4 text-center w-1/6">Admin</th>
                          <th className="px-4 py-4 text-center w-1/6">HR</th>
                          <th className="px-4 py-4 text-center w-1/6">Manager</th>
                          <th className="px-4 py-4 text-center w-1/6">Employee</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm divide-y divide-slate-50">
                        {permissions.map((row) => (
                          <tr key={row.id} className="hover:bg-slate-50/50">
                            <td className="px-6 py-4">
                                <p className="font-bold text-slate-700">{row.name}</p>
                                <p className="text-xs text-slate-400">{row.description}</p>
                            </td>
                            <td className="px-4 py-4 text-center">
                                <div className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-1 rounded border border-emerald-100 cursor-not-allowed opacity-80">
                                    <CheckCircle2 size={12} />
                                    <span className="text-xs font-bold">Full Access</span>
                                </div>
                            </td>
                            <td className="px-4 py-4 text-center">
                                <PermissionSelect 
                                    value={row.hr} 
                                    onChange={(v) => handlePermissionChange(row.id, 'hr', v)} 
                                />
                            </td>
                            <td className="px-4 py-4 text-center">
                                <PermissionSelect 
                                    value={row.manager} 
                                    onChange={(v) => handlePermissionChange(row.id, 'manager', v)} 
                                />
                            </td>
                            <td className="px-4 py-4 text-center">
                                <PermissionSelect 
                                    value={row.employee} 
                                    onChange={(v) => handlePermissionChange(row.id, 'employee', v)} 
                                />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                {/* ... other security grid items ... */}
              </div>
           )}
        </div>
      </div>

      {showUserModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 animate-in zoom-in-95">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-slate-800">{isEditingUser ? 'Edit System User' : 'Add System User'}</h3>
                    <button onClick={() => setShowUserModal(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X size={20} /></button>
                </div>
                
                <form onSubmit={handleSaveUser} className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">Full Name</label>
                        <input type="text" required value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none mt-1 text-sm font-semibold" placeholder="e.g. John Doe" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">Email Address</label>
                        <input type="email" required value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none mt-1 text-sm font-semibold" placeholder="e.g. john@zenhr.com" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Role</label>
                            <select value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value as any})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none mt-1 text-sm font-semibold">
                                <option value="Admin">Admin</option>
                                <option value="HR">HR</option>
                                <option value="Manager">Manager</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Status</label>
                            <select value={userForm.status} onChange={e => setUserForm({...userForm, status: e.target.value as any})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none mt-1 text-sm font-semibold">
                                <option value="Active">Active</option>
                                <option value="Inactive">Inactive</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                        <input 
                            type="checkbox" 
                            id="lockUser"
                            checked={userForm.isLocked}
                            onChange={(e) => setUserForm({...userForm, isLocked: e.target.checked})}
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label htmlFor="lockUser" className="text-xs font-bold text-slate-600">Lock Account (Prevent Editing/Deleting)</label>
                    </div>
                    <div className="pt-4 flex gap-3">
                        <button type="button" onClick={() => setShowUserModal(false)} className="flex-1 py-2.5 text-slate-500 font-bold hover:bg-slate-50 rounded-xl text-sm">Cancel</button>
                        <button type="submit" className="flex-1 py-2.5 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 text-sm">
                            {isEditingUser ? 'Save Changes' : 'Add User'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default SettingsModule;
