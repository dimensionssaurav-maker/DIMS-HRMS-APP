import React, { useState } from 'react';
import { 
  User, 
  Briefcase, 
  FileText, 
  IndianRupee, 
  CheckCircle, 
  ChevronRight, 
  ChevronLeft, 
  Upload, 
  X,
  Building2,
  Calendar as CalendarIcon,
  Hash,
  ToggleLeft,
  ToggleRight,
  Clock,
  Database,
  Wifi,
  ClipboardCopy,
  ArrowRight,
  Edit2
} from 'lucide-react';
import { Employee } from '../types';

interface Props {
  onComplete: (employee: Employee) => void;
  onCancel: () => void;
  departments: string[];
}

const steps = [
  { id: 'basic', title: 'Basic Info', icon: User },
  { id: 'documents', title: 'Documents', icon: FileText },
  { id: 'payroll', title: 'Payroll', icon: IndianRupee },
  { id: 'review', title: 'Review', icon: CheckCircle },
];

const EmployeeOnboarding: React.FC<Props> = ({ onComplete, onCancel, departments }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [showBioModal, setShowBioModal] = useState(false);
  const [bioRawText, setBioRawText] = useState('');
  const [isIdEditable, setIsIdEditable] = useState(false);

  const [formData, setFormData] = useState({
    id: `EMP-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
    name: '',
    designation: '',
    department: departments[1] || 'Operations',
    joiningDate: new Date().toISOString().split('T')[0],
    dailyWage: 500,
    isOtAllowed: true,
    documents: {
      idProof: false,
      addressProof: false,
      contract: false,
    }
  });

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(curr => curr + 1);
    } else {
      const newEmployee: Employee = {
        id: formData.id,
        name: formData.name,
        designation: formData.designation,
        department: formData.department,
        salaryType: 'Daily',
        dailyWage: formData.dailyWage,
        monthlySalary: formData.dailyWage * 30,
        monthlyBase: formData.dailyWage * 30,
        joiningDate: formData.joiningDate,
        isOtAllowed: formData.isOtAllowed,
        status: 'Active'
      };
      onComplete(newEmployee);
    }
  };

  const handleBack = () => setCurrentStep(curr => curr - 1);

  const handleBioParse = () => {
    if (!bioRawText) return;

    const lines = bioRawText.split(/\r\n|\n/);
    let found = false;

    // Loop through all lines to find the first valid data row
    for (const line of lines) {
        if (!line.trim()) continue;

        // Regex to capture ID (start of line digits) and potential Name
        // Example: "0012 MANOJ RANA (HSS) G 09:07..."
        // Matches ID at start, then Name until we hit parentheses OR a time pattern OR a single letter code
        const match = line.match(/^\s*(\d+)\s+([a-zA-Z\.\s]+?)(?:\s+\(.*\))?\s+(?:[A-Z0-9]{1,2}\s|\d{1,2}:\d{2})/);

        if (match) {
            const extractedId = match[1].trim();
            const extractedName = match[2].trim();

            setFormData(prev => ({
                ...prev,
                id: extractedId,
                name: extractedName
            }));
            
            setIsIdEditable(true); // Switch to manual mode so they see the imported ID clearly
            setShowBioModal(false);
            setBioRawText('');
            found = true;
            break; // Stop after first valid match
        }
    }

    if (!found) {
        alert("Could not detect ID and Name. Please ensure text contains a row like: '0012 Employee Name ...'");
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            {/* Biometric Import Button */}
            <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                        <Database size={20} />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-indigo-900">Biometric Integration</h4>
                        <p className="text-xs text-indigo-600">Import ID & Name directly from device report</p>
                    </div>
                </div>
                <button 
                    onClick={() => setShowBioModal(true)}
                    className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg shadow-md hover:bg-indigo-700 transition-all flex items-center gap-2"
                >
                    <Wifi size={14} /> Fetch Data
                </button>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-500 uppercase">Employee ID</label>
                  <button 
                    onClick={() => setIsIdEditable(!isIdEditable)}
                    className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-1"
                  >
                    <Edit2 size={10} /> {isIdEditable ? 'Auto-Generate' : 'Edit Manually'}
                  </button>
              </div>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text"
                  readOnly={!isIdEditable}
                  value={formData.id}
                  onChange={(e) => setFormData({...formData, id: e.target.value})}
                  className={`w-full border rounded-xl pl-10 pr-4 py-3 font-mono font-bold outline-none transition-colors ${
                      isIdEditable 
                      ? 'bg-white border-slate-300 text-slate-800 focus:ring-2 focus:ring-indigo-500' 
                      : 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed'
                  }`}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Department</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <select 
                    value={formData.department}
                    onChange={e => setFormData({...formData, department: e.target.value})}
                    className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
                  >
                    {departments.filter(d => d !== 'All Departments').map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Joining Date</label>
                <div className="relative">
                  <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="date"
                    value={formData.joiningDate}
                    onChange={e => setFormData({...formData, joiningDate: e.target.value})}
                    className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Designation</label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text"
                  placeholder="e.g. Senior Software Engineer"
                  value={formData.designation}
                  onChange={e => setFormData({...formData, designation: e.target.value})}
                  className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
            </div>
          </div>
        );
      case 1:
        return (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <p className="text-sm text-slate-500 leading-relaxed italic">
              Please check the boxes to simulate successful verification of required physical documents.
            </p>
            <div className="space-y-3">
              {[
                { key: 'idProof', label: 'Government ID Proof (Aadhar/PAN)' },
                { key: 'addressProof', label: 'Permanent Address Proof' },
                { key: 'contract', label: 'Signed Employment Contract' }
              ].map(doc => (
                <label key={doc.key} className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer ${formData.documents[doc.key as keyof typeof formData.documents] ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-100 bg-slate-50 hover:bg-slate-100'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${formData.documents[doc.key as keyof typeof formData.documents] ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                      <Upload size={16} />
                    </div>
                    <span className={`text-sm font-semibold ${formData.documents[doc.key as keyof typeof formData.documents] ? 'text-indigo-900' : 'text-slate-600'}`}>{doc.label}</span>
                  </div>
                  <input 
                    type="checkbox"
                    checked={formData.documents[doc.key as keyof typeof formData.documents]}
                    onChange={() => setFormData({
                      ...formData, 
                      documents: { ...formData.documents, [doc.key]: !formData.documents[doc.key as keyof typeof formData.documents] }
                    })}
                    className="w-5 h-5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </label>
              ))}
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <div className="bg-indigo-600 p-6 rounded-3xl text-white">
              <div className="flex items-center gap-3 mb-2">
                <IndianRupee size={20} className="text-indigo-200" />
                <h4 className="font-bold">Compensation Setup</h4>
              </div>
              <p className="text-xs text-indigo-100">Set the daily base remuneration. Monthly base will be calculated automatically.</p>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Daily Wage (₹)</label>
                <input 
                  type="number"
                  min="0"
                  value={formData.dailyWage}
                  onChange={e => setFormData({...formData, dailyWage: Number(e.target.value)})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-2xl font-black text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              {/* OT Allowed Toggle */}
              <div 
                onClick={() => setFormData({...formData, isOtAllowed: !formData.isOtAllowed})}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${formData.isOtAllowed ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-200'}`}
              >
                  <div className="flex items-center gap-3">
                     <div className={`p-2 rounded-lg ${formData.isOtAllowed ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                        <Clock size={18} />
                     </div>
                     <div>
                       <h5 className={`text-sm font-bold ${formData.isOtAllowed ? 'text-indigo-900' : 'text-slate-600'}`}>Overtime Eligibility</h5>
                       <p className="text-xs text-slate-400">Can this employee earn overtime pay?</p>
                     </div>
                  </div>
                  <div className={`text-3xl ${formData.isOtAllowed ? 'text-indigo-600' : 'text-slate-300'}`}>
                    {formData.isOtAllowed ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
                  </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center">
                <span className="text-sm font-semibold text-slate-500">Projected Monthly Base</span>
                <span className="text-xl font-black text-indigo-600">₹{(formData.dailyWage * 30).toLocaleString()}</span>
              </div>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <div className="text-center py-4">
              <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                <CheckCircle size={40} />
              </div>
              <h4 className="text-xl font-bold text-slate-800">Ready to Onboard</h4>
              <p className="text-sm text-slate-500">Please review the details before finishing.</p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-6 space-y-4 border border-slate-100">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Employee ID</span>
                <span className="font-bold text-slate-800 font-mono">{formData.id}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Employee Name</span>
                <span className="font-bold text-slate-800">{formData.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Department</span>
                <span className="font-bold text-indigo-600">{formData.department}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Compensation</span>
                <span className="font-bold text-slate-800">₹{formData.dailyWage}/day</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">OT Eligible</span>
                <span className={`font-bold px-2 py-0.5 rounded text-xs uppercase ${formData.isOtAllowed ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-500'}`}>
                  {formData.isOtAllowed ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200">
                <div className="flex items-center gap-2 text-[10px] font-bold text-green-600 uppercase">
                  <CheckCircle size={12} />
                  Documents Verified
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const isNextDisabled = () => {
    if (currentStep === 0) return !formData.name || !formData.designation || !formData.id;
    if (currentStep === 1) return !formData.documents.idProof || !formData.documents.addressProof;
    if (currentStep === 2) return formData.dailyWage <= 0;
    return false;
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[110] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="p-8 pb-4 flex justify-between items-center border-b border-slate-100">
          <div>
            <h2 className="text-2xl font-black text-slate-800">Employee Onboarding</h2>
            <p className="text-sm text-slate-400">Follow the steps to add a new team member.</p>
          </div>
          <button onClick={onCancel} className="p-2 bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition-all">
            <X size={20} />
          </button>
        </div>

        {/* Stepper */}
        <div className="px-8 py-6 bg-slate-50/50 flex justify-between border-b border-slate-100">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isActive = currentStep === idx;
            const isCompleted = currentStep > idx;
            return (
              <div key={step.id} className="flex flex-col items-center gap-2 w-full">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                  isActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 scale-110' : 
                  isCompleted ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-400'
                }`}>
                  {isCompleted ? <CheckCircle size={18} /> : <Icon size={18} />}
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}>
                  {step.title}
                </span>
              </div>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {renderStep()}
        </div>

        {/* Footer */}
        <div className="p-8 pt-4 border-t border-slate-100 bg-slate-50/30 flex justify-between items-center">
          <button 
            onClick={handleBack}
            disabled={currentStep === 0}
            className="flex items-center gap-2 text-slate-500 font-bold text-sm hover:text-slate-800 disabled:opacity-0 transition-all"
          >
            <ChevronLeft size={20} />
            Back
          </button>
          <button 
            onClick={handleNext}
            disabled={isNextDisabled()}
            className="bg-indigo-600 text-white px-8 py-3.5 rounded-2xl font-bold shadow-xl shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            {currentStep === steps.length - 1 ? 'Finish Onboarding' : 'Continue'}
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Mini Biometric Modal */}
      {showBioModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[120] flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-6 animate-in zoom-in-95">
              <div className="flex justify-between items-center mb-6">
                 <div className="flex items-center gap-2">
                    <Wifi size={20} className="text-indigo-600" />
                    <h3 className="text-lg font-bold text-slate-800">Fetch from Report</h3>
                 </div>
                 <button onClick={() => setShowBioModal(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400">
                   <X size={20} />
                 </button>
              </div>
              
              <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 mb-4">
                 <p className="text-xs text-indigo-800 leading-relaxed flex items-start gap-2">
                    <ClipboardCopy size={16} className="shrink-0 mt-0.5" />
                    <span>Copy a row from your biometric report and paste it below. <br/>Example: <strong>0012 MANOJ RANA (HSS) G 09:07...</strong></span>
                 </p>
              </div>

              <textarea 
                 value={bioRawText}
                 onChange={(e) => setBioRawText(e.target.value)}
                 className="w-full h-32 bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
                 placeholder="Paste text here..."
              ></textarea>

              <button 
                 onClick={handleBioParse}
                 disabled={!bioRawText.trim()}
                 className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                 <ArrowRight size={18} /> Extract ID & Name
              </button>
           </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeOnboarding;