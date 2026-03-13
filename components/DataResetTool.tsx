import React, { useState } from 'react';
import { Trash2, AlertTriangle, CheckCircle2, Loader2, ShieldAlert, RefreshCw } from 'lucide-react';
import { db } from '../firebase';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

const COLLECTIONS = [
  { id: 'employees',   label: 'Employees',          icon: '👤' },
  { id: 'attendance',  label: 'Attendance Records',  icon: '📅' },
  { id: 'leaves',      label: 'Leave Requests',      icon: '🌴' },
  { id: 'shifts',      label: 'Shift Management',    icon: '⏰' },
  { id: 'loans',       label: 'Loans & Advances',    icon: '💰' },
  { id: 'claims',      label: 'Expense Claims',      icon: '🧾' },
  { id: 'holidays',    label: 'Holiday Calendar',    icon: '🎉' },
  { id: 'systemUsers', label: 'System Users',        icon: '👥' },
  { id: 'settings',    label: 'Payroll Config',      icon: '⚙️' },
  { id: 'departments', label: 'Departments',         icon: '🏢' },
  { id: 'security',    label: 'Security Settings',   icon: '🔐' },
];

interface Props {
  onResetComplete: () => void;
  onCancel: () => void;
}

const DataResetTool: React.FC<Props> = ({ onResetComplete, onCancel }) => {
  const [selected, setSelected] = useState<Set<string>>(new Set(COLLECTIONS.map(c => c.id)));
  const [confirmText, setConfirmText] = useState('');
  const [step, setStep] = useState<'select' | 'confirm' | 'wiping' | 'done'>('select');
  const [progress, setProgress] = useState<Record<string, 'pending' | 'wiping' | 'done' | 'error'>>({});
  const [counts, setCounts] = useState<Record<string, number>>({});

  const toggleAll = () => {
    if (selected.size === COLLECTIONS.length) setSelected(new Set());
    else setSelected(new Set(COLLECTIONS.map(c => c.id)));
  };

  const toggle = (id: string) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  const wipeCollection = async (collectionId: string) => {
    setProgress(p => ({ ...p, [collectionId]: 'wiping' }));
    try {
      const snap = await getDocs(collection(db, collectionId));
      const deletes = snap.docs.map(d => deleteDoc(doc(db, collectionId, d.id)));
      await Promise.all(deletes);
      setCounts(c => ({ ...c, [collectionId]: snap.docs.length }));
      setProgress(p => ({ ...p, [collectionId]: 'done' }));
    } catch (e) {
      console.error(`Error wiping ${collectionId}:`, e);
      setProgress(p => ({ ...p, [collectionId]: 'error' }));
    }
  };

  const handleWipe = async () => {
    setStep('wiping');
    const toWipe = COLLECTIONS.filter(c => selected.has(c.id));
    // Init all as pending
    const init: Record<string, 'pending'> = {};
    toWipe.forEach(c => { init[c.id] = 'pending'; });
    setProgress(init);

    // Wipe one by one
    for (const col of toWipe) {
      await wipeCollection(col.id);
    }

    setStep('done');
  };

  const totalWiped = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95">

        {/* Header */}
        <div className="bg-red-600 p-6 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <ShieldAlert size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black">Data Reset Tool</h2>
              <p className="text-red-100 text-sm">Permanently delete data from Firebase</p>
            </div>
          </div>
        </div>

        {/* Step: Select Collections */}
        {step === 'select' && (
          <div className="p-6 space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
              <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800 font-medium">
                This will <strong>permanently delete</strong> all selected data from Firebase. This action <strong>cannot be undone</strong>.
              </p>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-slate-700">Select collections to wipe:</p>
              <button onClick={toggleAll} className="text-xs font-bold text-indigo-600 hover:text-indigo-800">
                {selected.size === COLLECTIONS.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {COLLECTIONS.map(col => (
                <label key={col.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    selected.has(col.id) ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200 opacity-60'
                  }`}>
                  <input type="checkbox" checked={selected.has(col.id)} onChange={() => toggle(col.id)}
                    className="accent-red-600 w-4 h-4" />
                  <span className="text-lg">{col.icon}</span>
                  <span className="text-sm font-bold text-slate-700">{col.label}</span>
                  <span className="ml-auto text-[10px] font-mono text-slate-400">{col.id}</span>
                </label>
              ))}
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={onCancel}
                className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl border border-slate-200 transition-all">
                Cancel
              </button>
              <button onClick={() => setStep('confirm')} disabled={selected.size === 0}
                className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-red-200">
                <Trash2 size={16} /> Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step: Confirm */}
        {step === 'confirm' && (
          <div className="p-6 space-y-5">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Trash2 size={32} className="text-red-600" />
              </div>
              <p className="text-lg font-black text-slate-800">Are you absolutely sure?</p>
              <p className="text-sm text-slate-500 mt-1">
                You are about to wipe <strong className="text-red-600">{selected.size} collection{selected.size !== 1 ? 's' : ''}</strong> from Firebase permanently.
              </p>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-2">
                Type <span className="text-red-600 font-black">RESET</span> to confirm
              </label>
              <input type="text" value={confirmText} onChange={e => setConfirmText(e.target.value)}
                placeholder="Type RESET here..."
                className="w-full border-2 border-slate-200 focus:border-red-500 rounded-xl px-4 py-3 text-sm font-bold outline-none transition-colors text-center tracking-widest uppercase" />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep('select')}
                className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl border border-slate-200 transition-all">
                ← Back
              </button>
              <button onClick={handleWipe} disabled={confirmText !== 'RESET'}
                className="flex-1 py-3 bg-red-600 text-white font-black rounded-xl hover:bg-red-700 transition-all disabled:opacity-40 shadow-lg shadow-red-200 flex items-center justify-center gap-2">
                <Trash2 size={16} /> WIPE NOW
              </button>
            </div>
          </div>
        )}

        {/* Step: Wiping Progress */}
        {step === 'wiping' && (
          <div className="p-6 space-y-3">
            <p className="text-center font-black text-slate-800 text-lg mb-4">Wiping data...</p>
            {COLLECTIONS.filter(c => selected.has(c.id)).map(col => {
              const status = progress[col.id] || 'pending';
              return (
                <div key={col.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <span className="text-lg">{col.icon}</span>
                  <span className="text-sm font-bold text-slate-700 flex-1">{col.label}</span>
                  {status === 'pending' && <span className="text-xs text-slate-400 font-medium">Waiting...</span>}
                  {status === 'wiping' && <Loader2 size={16} className="text-indigo-500 animate-spin" />}
                  {status === 'done' && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-emerald-600 font-bold">{counts[col.id] || 0} deleted</span>
                      <CheckCircle2 size={16} className="text-emerald-500" />
                    </div>
                  )}
                  {status === 'error' && <span className="text-xs text-red-500 font-bold">Error!</span>}
                </div>
              );
            })}
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && (
          <div className="p-8 text-center space-y-4">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 size={40} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-800">Fresh Start Ready!</p>
              <p className="text-slate-500 text-sm mt-1">
                <strong className="text-emerald-600">{totalWiped} records</strong> deleted from Firebase.
              </p>
              <p className="text-slate-400 text-xs mt-2">Your app is now clean and ready for real data.</p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left space-y-1.5">
              {COLLECTIONS.filter(c => selected.has(c.id)).map(col => (
                <div key={col.id} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                  <span className="text-slate-600">{col.label}</span>
                  <span className="ml-auto text-xs font-bold text-slate-400">{counts[col.id] || 0} records</span>
                </div>
              ))}
            </div>

            <button onClick={() => { onResetComplete(); try { sessionStorage.clear(); } catch {} window.location.reload(); }}
              className="w-full py-4 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 text-lg">
              <RefreshCw size={20} /> Reload App — Fresh Start
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DataResetTool;
