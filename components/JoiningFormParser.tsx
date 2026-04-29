import React, { useRef, useState } from 'react';
import { Upload, FileText, Loader2, CheckCircle2, X, Save, AlertTriangle, RefreshCw } from 'lucide-react';
import { parseJoiningForm } from '../services/geminiService';
import { addData } from '../services/firebaseService';

interface Props {
  onClose: () => void;
  onSaved: (empCode: string, name: string) => void;
}

const FIELDS: { key: string; label: string; section: string; type?: string }[] = [
  // Employee Details
  { key: 'employeeCode',     label: 'Employee Code',         section: 'Employee Details' },
  { key: 'name',             label: 'Name',                  section: 'Employee Details' },
  { key: 'joiningDate',      label: 'Date of Joining',       section: 'Employee Details', type: 'date' },
  { key: 'source',           label: 'Source',                section: 'Employee Details' },
  { key: 'department',       label: 'Department',            section: 'Employee Details' },
  { key: 'designation',      label: 'Designation',           section: 'Employee Details' },
  { key: 'experienceYears',  label: 'Experience (Yrs)',       section: 'Employee Details' },
  { key: 'experienceMonths', label: 'Experience (Months)',    section: 'Employee Details' },
  // Personal Details
  { key: 'esicNo',           label: 'ESIC No',               section: 'Personal Details' },
  { key: 'epfNo',            label: 'EPF No',                section: 'Personal Details' },
  { key: 'aadharNo',         label: 'Aadhar No',             section: 'Personal Details' },
  { key: 'panNo',            label: 'PAN No',                section: 'Personal Details' },
  { key: 'fathersName',      label: "Father's Name",         section: 'Personal Details' },
  { key: 'dateOfBirth',      label: 'Date of Birth',         section: 'Personal Details', type: 'date' },
  { key: 'gender',           label: 'Gender',                section: 'Personal Details' },
  { key: 'maritalStatus',    label: 'Marital Status',        section: 'Personal Details' },
  { key: 'nomineeName',      label: 'Nominee Name',          section: 'Personal Details' },
  { key: 'nomineeRelation',  label: 'Nominee Relation',      section: 'Personal Details' },
  { key: 'qualification',    label: 'Technical Qualification',section: 'Personal Details' },
  { key: 'mobileNo',         label: 'Mobile No',             section: 'Personal Details' },
  { key: 'permanentAddress', label: 'Permanent Address',     section: 'Personal Details' },
  { key: 'presentAddress',   label: 'Present Address',       section: 'Personal Details' },
  // Bank Details
  { key: 'bankName',         label: 'Bank Name',             section: 'Bank Details' },
  { key: 'ifscCode',         label: 'IFSC Code',             section: 'Bank Details' },
  { key: 'accountNo',        label: 'Account No',            section: 'Bank Details' },
  // Office Use
  { key: 'salary',           label: 'Salary',                section: 'Office Use' },
];

const SECTION_COLORS: Record<string, string> = {
  'Employee Details': 'bg-indigo-50 border-indigo-200 text-indigo-700',
  'Personal Details': 'bg-emerald-50 border-emerald-200 text-emerald-700',
  'Bank Details':     'bg-amber-50 border-amber-200 text-amber-700',
  'Office Use':       'bg-purple-50 border-purple-200 text-purple-700',
};

type Step = 'upload' | 'extracting' | 'review' | 'saving' | 'done';

const JoiningFormParser: React.FC<Props> = ({ onClose, onSaved }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [extracted, setExtracted] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const handleFile = async (file: File) => {
    if (!file) return;
    setFileName(file.name);
    setError('');
    setStep('extracting');

    try {
      // Convert to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]); // strip data:...;base64,
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const mimeType = file.type || 'application/pdf';
      const data = await parseJoiningForm(base64, mimeType);
      setExtracted(data);
      setStep('review');
    } catch (err: any) {
      setError(err.message || 'Extraction failed');
      setStep('upload');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleSave = async () => {
    if (!extracted.name && !extracted.employeeCode) {
      setError('At minimum, Name or Employee Code must be filled.');
      return;
    }
    setSaving(true);
    setStep('saving');
    try {
      const docId = extracted.employeeCode || extracted.name.replace(/\s+/g, '_').toUpperCase();
      await addData('joinForms', {
        ...extracted,
        id: docId,
        empCode: docId,
        savedAt: new Date().toISOString(),
        fileName,
      });
      // Also create/update basic employee record
      await addData('employees', {
        id: docId,
        empCode: docId,
        employeeCode: extracted.employeeCode || docId,
        name: extracted.name || '',
        department: extracted.department || '',
        designation: extracted.designation || '',
        joiningDate: extracted.joiningDate || '',
        source: extracted.source || '',
        mobileNo: extracted.mobileNo || '',
        status: 'Active',
        salaryType: 'Monthly',
        monthlySalary: Number(extracted.salary?.replace(/[^0-9]/g, '')) || 0,
        dailyWage: 0,
        monthlyBase: Number(extracted.salary?.replace(/[^0-9]/g, '')) || 0,
        isOtAllowed: false,
      });
      setStep('done');
      onSaved(extracted.employeeCode || docId, extracted.name || docId);
    } catch (err: any) {
      setError('Save failed: ' + err.message);
      setStep('review');
    } finally {
      setSaving(false);
    }
  };

  const sections = [...new Set(FIELDS.map(f => f.section))];

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-5 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="font-black text-lg">Upload Joining Form</h2>
              <p className="text-indigo-200 text-xs">AI extracts all fields automatically</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Progress steps */}
        <div className="flex items-center gap-0 bg-indigo-50 px-6 py-3 text-xs font-bold shrink-0">
          {(['upload','extracting','review','done'] as Step[]).map((s, i) => (
            <React.Fragment key={s}>
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${step === s ? 'bg-indigo-600 text-white' : ((['upload','extracting','review','done'].indexOf(step) > i) ? 'text-indigo-600' : 'text-slate-400')}`}>
                {s === 'upload' && '① Upload'}
                {s === 'extracting' && '② Extracting'}
                {s === 'review' && '③ Review'}
                {s === 'done' && '④ Saved'}
              </div>
              {i < 3 && <div className="w-6 h-px bg-indigo-200 mx-1" />}
            </React.Fragment>
          ))}
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6">

          {/* UPLOAD STEP */}
          {(step === 'upload') && (
            <div className="space-y-4">
              {error && (
                <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm font-medium">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />{error}
                </div>
              )}
              <div
                className="border-2 border-dashed border-indigo-300 rounded-2xl p-12 text-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50/50 transition-all"
                onClick={() => fileRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
              >
                <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Upload size={28} className="text-indigo-600" />
                </div>
                <p className="font-bold text-slate-700 text-lg mb-1">Drop the filled joining form here</p>
                <p className="text-slate-400 text-sm mb-4">Supports PDF or image (JPG, PNG)</p>
                <button className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all">
                  Browse File
                </button>
              </div>
              <input ref={fileRef} type="file" accept=".pdf,image/*" className="hidden"
                onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
              <p className="text-xs text-slate-400 text-center">
                The AI will read the handwritten/typed values and fill all fields automatically.
              </p>
            </div>
          )}

          {/* EXTRACTING STEP */}
          {step === 'extracting' && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center">
                <Loader2 size={36} className="text-indigo-600 animate-spin" />
              </div>
              <p className="font-bold text-slate-700 text-lg">Reading your form…</p>
              <p className="text-slate-400 text-sm">AI is extracting all fields from <span className="font-semibold text-slate-600">{fileName}</span></p>
            </div>
          )}

          {/* REVIEW STEP */}
          {(step === 'review' || step === 'saving') && (
            <div className="space-y-6">
              {error && (
                <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm font-medium">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />{error}
                </div>
              )}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-800">Review & Edit Extracted Data</p>
                  <p className="text-xs text-slate-400 mt-0.5">From: {fileName} — correct any mistakes before saving</p>
                </div>
                <button onClick={() => { setStep('upload'); setError(''); }}
                  className="flex items-center gap-1.5 text-xs text-indigo-600 font-bold hover:underline">
                  <RefreshCw size={13}/> Re-upload
                </button>
              </div>

              {sections.map(section => (
                <div key={section} className="rounded-2xl border border-slate-100 overflow-hidden">
                  <div className={`px-4 py-2.5 text-xs font-black uppercase tracking-wider border-b ${SECTION_COLORS[section]}`}>
                    {section}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
                    {FIELDS.filter(f => f.section === section).map((field, idx) => (
                      <div key={field.key} className={`p-3 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">{field.label}</label>
                        <input
                          type={field.type || 'text'}
                          value={extracted[field.key] || ''}
                          onChange={e => setExtracted(prev => ({ ...prev, [field.key]: e.target.value }))}
                          className="w-full text-xs font-semibold text-slate-800 bg-transparent border-b border-slate-200 pb-0.5 outline-none focus:border-indigo-400 transition-colors"
                          placeholder="—"
                          disabled={saving}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* DONE STEP */}
          {step === 'done' && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center">
                <CheckCircle2 size={36} className="text-emerald-600" />
              </div>
              <p className="font-black text-slate-800 text-xl">Saved Successfully!</p>
              <p className="text-slate-500 text-sm text-center">
                <span className="font-bold text-slate-700">{extracted.name}</span> has been added to the system.<br/>
                All joining form details are stored in Firebase.
              </p>
              <button onClick={onClose} className="mt-2 bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all">
                Done
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {(step === 'review' || step === 'saving') && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
            <p className="text-xs text-slate-400">Fields saved to both <code className="bg-slate-100 px-1 rounded">employees</code> and <code className="bg-slate-100 px-1 rounded">joinForms</code> collections</p>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all disabled:opacity-60 shadow-lg shadow-indigo-200">
              {saving ? <><Loader2 size={16} className="animate-spin"/> Saving…</> : <><Save size={16}/> Save to System</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default JoiningFormParser;
