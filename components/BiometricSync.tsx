import React, { useState, useRef, useCallback } from 'react';
import {
  Fingerprint, Upload, CheckCircle2, AlertCircle,
  FileText, RefreshCw, Download, Users, Calendar,
  ChevronDown, ChevronUp, Trash2, Eye, Clock, Info
} from 'lucide-react';
import { addData } from '../services/firebaseService';

interface Props {
  employees: any[];
  onAttendanceSynced: (records: any[]) => void;
}

interface ParsedRecord {
  empCode: string;
  empName: string;
  date: string;
  punchIn: string;
  punchOut: string;
  status: string;
  matched: boolean;
  matchedEmployee?: any;
}

// ── Try to detect column from common eTimeOffice export headers ───────────────
function detectCol(headers: string[], candidates: string[]): number {
  for (const c of candidates) {
    const idx = headers.findIndex(h => h.toLowerCase().includes(c.toLowerCase()));
    if (idx !== -1) return idx;
  }
  return -1;
}

// ── Parse CSV text into rows ──────────────────────────────────────────────────
function parseCSV(text: string): string[][] {
  return text.trim().split('\n').map(row => {
    const cells: string[] = [];
    let cur = '', inQuote = false;
    for (const ch of row) {
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === ',' && !inQuote) { cells.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    cells.push(cur.trim());
    return cells;
  });
}

const BiometricSync: React.FC<Props> = ({ employees, onAttendanceSynced }) => {
  const [dragging,      setDragging]      = useState(false);
  const [fileName,      setFileName]      = useState('');
  const [parsedRecords, setParsedRecords] = useState<ParsedRecord[]>([]);
  const [isSaving,      setIsSaving]      = useState(false);
  const [savedCount,    setSavedCount]    = useState(0);
  const [errorMsg,      setErrorMsg]      = useState('');
  const [step,          setStep]          = useState<'upload'|'preview'|'done'>('upload');
  const [showGuide,     setShowGuide]     = useState(true);
  const [totalSynced,   setTotalSynced]   = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Parse uploaded file ────────────────────────────────────────────────────
  const processFile = useCallback((file: File) => {
    setErrorMsg('');
    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const rows = parseCSV(text);
        if (rows.length < 2) throw new Error('File is empty or has no data rows.');

        const headers = rows[0].map(h => h.replace(/['"]/g, '').trim());

        // Auto-detect columns — covers common eTimeOffice export formats
        const empCodeCol  = detectCol(headers, ['emp code','empcode','employee code','emp_code','code','id','userid','user id']);
        const empNameCol  = detectCol(headers, ['emp name','empname','employee name','name','employee']);
        const dateCol     = detectCol(headers, ['date','att date','attendance date','log date','punch date']);
        const punchInCol  = detectCol(headers, ['punch in','in time','in punch','first punch','time in','checkin','check in','entry']);
        const punchOutCol = detectCol(headers, ['punch out','out time','out punch','last punch','time out','checkout','check out','exit']);
        const statusCol   = detectCol(headers, ['status','attendance','present','att status']);

        if (dateCol === -1) throw new Error(`Could not find a "Date" column. Found columns: ${headers.join(', ')}`);

        const records: ParsedRecord[] = [];

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (row.every(c => !c)) continue; // skip empty rows

          const empCode = empCodeCol !== -1 ? row[empCodeCol] || '' : '';
          const empName = empNameCol !== -1 ? row[empNameCol] || '' : '';
          const date    = dateCol    !== -1 ? row[dateCol]    || '' : '';
          const punchIn = punchInCol !== -1 ? row[punchInCol] || '' : '';
          const punchOut= punchOutCol!== -1 ? row[punchOutCol]|| '' : '';
          const status  = statusCol  !== -1 ? row[statusCol]  || 'Present' : 'Present';

          if (!date) continue;

          // Match employee in DIMS
          const matchedEmployee = employees.find(emp =>
            (empCode && String(emp.empCode || emp.employeeCode || '').toLowerCase() === empCode.toLowerCase()) ||
            (empName && (emp.name || '').toLowerCase().trim() === empName.toLowerCase().trim())
          );

          records.push({
            empCode, empName, date, punchIn, punchOut, status,
            matched: !!matchedEmployee,
            matchedEmployee
          });
        }

        if (records.length === 0) throw new Error('No valid attendance records found in file.');

        setParsedRecords(records);
        setStep('preview');
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to parse file. Please check the format.');
      }
    };

    reader.readAsText(file);
  }, [employees]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  // ── Save to Firebase ───────────────────────────────────────────────────────
  const saveToFirebase = async () => {
    setIsSaving(true);
    let count = 0;
    const saved: any[] = [];

    for (const rec of parsedRecords) {
      try {
        const record = {
          employeeId:   rec.matchedEmployee?.id || rec.empCode,
          employeeName: rec.matchedEmployee?.name || rec.empName,
          empCode:      rec.empCode,
          date:         rec.date,
          punchIn:      rec.punchIn,
          punchOut:     rec.punchOut,
          status:       rec.status || 'Present',
          source:       'eTimeOffice Import',
          syncedAt:     new Date().toISOString(),
        };
        await addData('attendance', record);
        saved.push(record);
        count++;
      } catch {}
    }

    setSavedCount(count);
    setTotalSynced(p => p + count);
    setStep('done');
    setIsSaving(false);
    onAttendanceSynced(saved);
  };

  const reset = () => {
    setStep('upload'); setParsedRecords([]); setFileName('');
    setErrorMsg(''); setSavedCount(0);
    if (fileRef.current) fileRef.current.value = '';
  };

  const matchedCount   = parsedRecords.filter(r => r.matched).length;
  const unmatchedCount = parsedRecords.filter(r => !r.matched).length;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto space-y-4">

      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2.5 bg-white/20 rounded-xl"><Fingerprint size={24} /></div>
          <div>
            <h2 className="text-lg font-black">Biometric Attendance Import</h2>
            <p className="text-indigo-100 text-xs">Import from eTimeOffice · CSV or Excel export</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Imported', value: totalSynced },
            { label: 'Employees',      value: employees.length },
            { label: 'Method',         value: 'CSV Upload' },
          ].map(s => (
            <div key={s.label} className="bg-white/10 rounded-xl p-3 text-center">
              <p className="font-black text-sm">{s.value}</p>
              <p className="text-indigo-200 text-[10px]">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Step Guide */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <button onClick={() => setShowGuide(p => !p)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50">
          <span className="font-bold text-slate-700 flex items-center gap-2">
            <Info size={16} className="text-indigo-500" /> How to Export from eTimeOffice
          </span>
          {showGuide ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </button>

        {showGuide && (
          <div className="px-5 pb-5 border-t border-slate-50">
            <div className="grid grid-cols-1 gap-3 mt-4">
              {[
                { step: '1', title: 'Login to eTimeOffice', desc: 'Go to www.etimeoffice.com and login with your account', color: 'bg-indigo-500' },
                { step: '2', title: 'Go to Reports', desc: 'Click on Reports → Daily Attendance Report or Monthly Attendance', color: 'bg-violet-500' },
                { step: '3', title: 'Select Date Range', desc: 'Choose the From Date and To Date you want to import', color: 'bg-purple-500' },
                { step: '4', title: 'Export as CSV / Excel', desc: 'Click the Download / Export button and save the file', color: 'bg-pink-500' },
                { step: '5', title: 'Upload Here', desc: 'Drag & drop or click to upload the downloaded file below', color: 'bg-emerald-500' },
              ].map(s => (
                <div key={s.step} className="flex items-start gap-3">
                  <div className={`${s.color} text-white w-7 h-7 rounded-full flex items-center justify-center font-black text-sm shrink-0`}>{s.step}</div>
                  <div>
                    <p className="font-bold text-slate-700 text-sm">{s.title}</p>
                    <p className="text-slate-400 text-xs mt-0.5">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* UPLOAD STEP */}
      {step === 'upload' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
              dragging ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
            }`}>
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-indigo-100 rounded-2xl">
                <Upload size={32} className="text-indigo-600" />
              </div>
            </div>
            <p className="font-black text-slate-700 text-lg">Drop your eTimeOffice file here</p>
            <p className="text-slate-400 text-sm mt-1">or click to browse</p>
            <p className="text-xs text-slate-300 mt-3">Supports: CSV, Excel (.xlsx), Text files</p>
          </div>

          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.txt" onChange={handleFileInput} className="hidden" />

          {errorMsg && (
            <div className="mt-4 flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl p-4">
              <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-red-700 text-sm">Could not read file</p>
                <p className="text-red-500 text-xs mt-1">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Sample format hint */}
          <div className="mt-4 bg-slate-50 rounded-xl p-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Expected CSV Format (auto-detected)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="text-indigo-600">
                    {['Emp Code','Emp Name','Date','Punch In','Punch Out','Status'].map(h => (
                      <th key={h} className="text-left px-2 py-1 bg-indigo-50 rounded">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-slate-500">
                  <tr>
                    {['1001','Rahul Kumar','01-03-2026','09:05','18:32','Present'].map((v,i) => (
                      <td key={i} className="px-2 py-1 border-b border-slate-100">{v}</td>
                    ))}
                  </tr>
                  <tr>
                    {['1002','Priya Singh','01-03-2026','09:15','18:45','Present'].map((v,i) => (
                      <td key={i} className="px-2 py-1">{v}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-slate-400 mt-2">* Column names don't need to match exactly — DIMS auto-detects them</p>
          </div>
        </div>
      )}

      {/* PREVIEW STEP */}
      {step === 'preview' && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-slate-700 flex items-center gap-2">
                <FileText size={16} className="text-indigo-500" /> File Preview
              </h3>
              <button onClick={reset} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
                <Trash2 size={12} /> Change file
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="font-black text-slate-700 text-xl">{parsedRecords.length}</p>
                <p className="text-slate-400 text-xs">Total Records</p>
              </div>
              <div className="bg-emerald-50 rounded-xl p-3 text-center">
                <p className="font-black text-emerald-700 text-xl">{matchedCount}</p>
                <p className="text-emerald-500 text-xs">✅ Matched to DIMS</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-3 text-center">
                <p className="font-black text-amber-700 text-xl">{unmatchedCount}</p>
                <p className="text-amber-500 text-xs">⚠️ Not matched</p>
              </div>
            </div>

            {unmatchedCount > 0 && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700 mb-4">
                <strong>⚠️ {unmatchedCount} records</strong> could not be matched to employees in DIMS. They will still be imported but won't link to existing profiles. Make sure employee codes in eTimeOffice match DIMS.
              </div>
            )}

            <p className="text-xs text-slate-400 mb-2 font-medium">File: {fileName}</p>

            {/* Preview table */}
            <div className="overflow-x-auto max-h-72 overflow-y-auto rounded-xl border border-slate-100">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    {['','Emp Code','Name','Date','In','Out','Status'].map(h => (
                      <th key={h} className="text-left px-3 py-2.5 font-bold text-slate-500 text-[10px] uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsedRecords.map((r, i) => (
                    <tr key={i} className="border-t border-slate-50 hover:bg-slate-50">
                      <td className="px-3 py-2">
                        {r.matched
                          ? <CheckCircle2 size={13} className="text-emerald-500" />
                          : <AlertCircle  size={13} className="text-amber-400" />}
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-500">{r.empCode || '—'}</td>
                      <td className="px-3 py-2 font-medium text-slate-700">{r.empName || r.matchedEmployee?.name || '—'}</td>
                      <td className="px-3 py-2 text-slate-500">{r.date}</td>
                      <td className="px-3 py-2">
                        {r.punchIn
                          ? <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-lg font-bold">{r.punchIn}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        {r.punchOut
                          ? <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded-lg font-bold">{r.punchOut}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          r.status.toLowerCase().includes('present') ? 'bg-emerald-50 text-emerald-700' :
                          r.status.toLowerCase().includes('absent')  ? 'bg-red-50 text-red-600' :
                          'bg-slate-100 text-slate-500'
                        }`}>{r.status || 'Present'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-3 mt-4">
              <button onClick={reset}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-all">
                ← Back
              </button>
              <button onClick={saveToFirebase} disabled={isSaving}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-sm shadow-indigo-100">
                {isSaving
                  ? <><RefreshCw size={16} className="animate-spin" /> Saving…</>
                  : <><Upload size={16} /> Import {parsedRecords.length} Records to DIMS</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DONE STEP */}
      {step === 'done' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-emerald-100 rounded-full">
              <CheckCircle2 size={40} className="text-emerald-600" />
            </div>
          </div>
          <h3 className="text-xl font-black text-slate-800 mb-2">Import Successful! 🎉</h3>
          <p className="text-slate-500 text-sm mb-6">
            <span className="font-black text-emerald-600 text-2xl">{savedCount}</span> attendance records<br/>
            have been saved to DIMS HRMS
          </p>

          <div className="bg-slate-50 rounded-xl p-4 mb-6 text-left space-y-2">
            <p className="text-xs font-bold text-slate-500 uppercase">What happens next</p>
            <p className="text-xs text-slate-600">✅ Records appear in the Attendance module</p>
            <p className="text-xs text-slate-600">✅ Payroll will use these records for salary calculation</p>
            <p className="text-xs text-slate-600">✅ Reports will include today's imported data</p>
          </div>

          <div className="flex gap-3">
            <button onClick={reset}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all">
              Import Another File
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BiometricSync;
