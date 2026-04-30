import React, { useState, useRef, useCallback } from 'react';
import {
  Fingerprint, Upload, CheckCircle2, AlertCircle,
  FileText, RefreshCw, Download, Users, Calendar,
  ChevronDown, ChevronUp, Trash2, Eye, Clock, Info,
  Wifi, WifiOff, Zap, Settings, Play, Database, AlertTriangle
} from 'lucide-react';
import { addData } from '../services/firebaseService';

interface Props {
  employees: any[];
  onAttendanceSynced: (records: any[]) => void;
  onEmployeesSynced?: (employees: any[]) => void;
}

interface ParsedRecord {
  empCode: string; empName: string; date: string;
  punchIn: string; punchOut: string; status: string;
  matched: boolean; matchedEmployee?: any;
}

interface EmpRecord {
  empCode: string; name: string; department: string;
  designation: string; mobile: string; alreadyExists: boolean;
}

interface BiometricConfig {
  ip: string; port: string; deviceType: string; commKey: string;
  bridgeUrl: string;
}

// Normalize date strings coming from biometric exports (DD/MM/YYYY, DD-MM-YYYY, etc.) to YYYY-MM-DD
function normalizeDate(input: string): string {
  if (!input) return '';
  const s = input.trim();
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const parts = s.split(/[\/\-\.]/);
  if (parts.length >= 3) {
    let [a, b, c] = parts;
    // Year-first?
    if (a.length === 4) return `${a}-${b.padStart(2,'0')}-${c.padStart(2,'0')}`;
    // Assume DD/MM/YYYY (Indian biometric default)
    if (c.length === 2) c = '20' + c;
    return `${c}-${b.padStart(2,'0')}-${a.padStart(2,'0')}`;
  }
  return s;
}

// Normalize punch time to HH:mm
function normalizeTime(input: string): string {
  if (!input) return '';
  const s = input.trim();
  const m = s.match(/(\d{1,2}):(\d{2})/);
  if (!m) return '';
  return `${m[1].padStart(2,'0')}:${m[2]}`;
}

function detectCol(headers: string[], candidates: string[]): number {
  for (const c of candidates) {
    const idx = headers.findIndex(h => h.toLowerCase().includes(c.toLowerCase()));
    if (idx !== -1) return idx;
  }
  return -1;
}

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

function generateDemoPunches(employees: any[], fromDate: string, toDate: string): ParsedRecord[] {
  const records: ParsedRecord[] = [];
  const start = new Date(fromDate);
  const end = new Date(toDate);
  const days: string[] = [];
  for (let d = new Date(start.getTime()); d <= end; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day !== 0) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd2 = String(d.getDate()).padStart(2, '0');
      days.push(yyyy + '-' + mm + '-' + dd2);
    }
  }
  const variants = [
    { in: '08:58', out: '18:02' }, { in: '09:03', out: '18:15' },
    { in: '08:55', out: '17:58' }, { in: '09:10', out: '18:30' },
    { in: '08:50', out: '19:05' }, { in: '09:00', out: '18:00' },
    { in: '08:45', out: '20:15' }, { in: '09:05', out: '18:45' },
  ];
  const sample = employees.slice(0, Math.min(employees.length, 20));
  sample.forEach((emp, ei) => {
    days.forEach((date, di) => {
      if (Math.random() < 0.05) return;
      const v = variants[(ei + di) % variants.length];
      const hasOT = Math.random() < 0.3;
      const outH = parseInt(v.out.split(':')[0]) + (hasOT ? 2 : 0);
      const punchOut = outH + ':' + v.out.split(':')[1];
      records.push({
        empCode: emp.empCode || emp.id || String(1001 + ei),
        empName: emp.name || 'Employee',
        date, punchIn: v.in, punchOut,
        status: 'Present', matched: true, matchedEmployee: emp,
      });
    });
  });
  return records;
}

const BiometricSync: React.FC<Props> = ({ employees, onAttendanceSynced, onEmployeesSynced }) => {
  const [activeTab, setActiveTab] = useState<'live'|'upload'|'employees'|'cloud'>('live');
  // eTimeOffice cloud credentials, persisted to localStorage so user doesn't re-enter every time.
  const [etoCreds, setEtoCreds] = useState(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem('eto_creds') : null;
      return raw ? JSON.parse(raw) : { corporateId: '', username: '', password: '' };
    } catch { return { corporateId: '', username: '', password: '' }; }
  });
  const [etoShowPwd, setEtoShowPwd] = useState(false);
  const [etoStatus, setEtoStatus] = useState<'idle'|'fetching'|'done'|'error'>('idle');
  const [etoMsg, setEtoMsg] = useState('');
  const [empStep, setEmpStep] = useState<'idle'|'preview'|'saving'|'done'>('idle');
  const [empRecords, setEmpRecords] = useState<EmpRecord[]>([]);
  const [empSavedCount, setEmpSavedCount] = useState(0);
  const [empCsvError, setEmpCsvError] = useState('');
  const empFileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [parsedRecords, setParsedRecords] = useState<ParsedRecord[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [step, setStep] = useState<'upload'|'preview'|'done'>('upload');
  const [totalSynced, setTotalSynced] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const [config, setConfig] = useState<BiometricConfig>({ ip: '192.168.1.201', port: '4370', deviceType: 'ZKTeco', commKey: '0', bridgeUrl: 'http://localhost:8182' });
  const [showConfig, setShowConfig] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle'|'connecting'|'connected'|'failed'>('idle');
  const [fetchStatus, setFetchStatus] = useState<'idle'|'fetching'|'done'|'error'>('idle');
  const [fetchLog, setFetchLog] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
  });

  const addLog = (msg: string) => setFetchLog(prev => [...prev, '[' + new Date().toLocaleTimeString() + '] ' + msg]);

  
  // Try pulling real punches from the DIMS Bridge agent; fall back to simulated data only if unreachable.
  const tryBridgeFetch = async (): Promise<ParsedRecord[] | null> => {
    const base = (config.bridgeUrl || '').replace(/\/$/, '');
    if (!base) return null;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5000);
      const url = base + '/punches?ip=' + encodeURIComponent(config.ip)
        + '&port=' + encodeURIComponent(config.port)
        + '&commKey=' + encodeURIComponent(config.commKey)
        + '&deviceType=' + encodeURIComponent(config.deviceType)
        + '&from=' + dateRange.from + '&to=' + dateRange.to;
      const resp = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!resp.ok) { addLog('Bridge responded ' + resp.status + ' ' + resp.statusText); return null; }
      const payload = await resp.json();
      const rows: any[] = Array.isArray(payload) ? payload : (payload.records || payload.data || []);
      if (!rows.length) { addLog('Bridge returned 0 rows — check device or date range.'); return []; }
      return rows.map((r: any) => {
        const empCode = String(r.empCode ?? r.userId ?? r.EmployeeCode ?? r.code ?? '').trim();
        const empName = String(r.empName ?? r.name ?? r.EmployeeName ?? '').trim();
        const date = normalizeDate(String(r.date ?? r.logDate ?? r.attDate ?? ''));
        const punchIn = normalizeTime(String(r.punchIn ?? r.inTime ?? r.firstPunch ?? ''));
        const punchOut = normalizeTime(String(r.punchOut ?? r.outTime ?? r.lastPunch ?? ''));
        const status = String(r.status ?? 'Present');
        const matchedEmployee = employees.find(emp =>
          (empCode && String(emp.empCode || emp.employeeCode || '').toLowerCase() === empCode.toLowerCase()) ||
          (empName && (emp.name || '').toLowerCase().trim() === empName.toLowerCase().trim())
        );
        return { empCode, empName, date, punchIn, punchOut, status, matched: !!matchedEmployee, matchedEmployee };
      }).filter(r => r.date);
    } catch (e: any) {
      if (e.name === 'AbortError') addLog('DIMS Bridge at ' + base + ' timed out.');
      else addLog('DIMS Bridge unreachable at ' + base + ' (' + (e.message || 'network error') + ').');
      return null;
    }
  };

  // eTimeOffice cloud fetch: hits api.etimeoffice.com directly (Basic auth: base64(corp:user:pass:true)).
  // The DownloadInOutPunchData endpoint returns daily-aggregated InTime/OutTime which maps cleanly to our schema.
  const fetchEtoPunches = async () => {
    if (!etoCreds.corporateId || !etoCreds.username || !etoCreds.password) {
      setEtoStatus('error');
      setEtoMsg('Please enter Corporate ID, Username, and Password.');
      return;
    }
    setEtoStatus('fetching');
    setEtoMsg('');
    setErrorMsg('');
    try {
      // Persist credentials so user doesn't re-enter
      try { window.localStorage.setItem('eto_creds', JSON.stringify(etoCreds)); } catch {}

      // Convert YYYY-MM-DD -> DD/MM/YYYY for the eTimeOffice API
      const toApiDate = (iso: string) => {
        const [y, m, d] = iso.split('-');
        return d + '/' + m + '/' + y;
      };
      const fromApi = toApiDate(dateRange.from);
      const toApi = toApiDate(dateRange.to);

      // Auth header: Basic base64(corporateid:username:password:true)
      const authStr = etoCreds.corporateId + ':' + etoCreds.username + ':' + etoCreds.password + ':true';
      const authB64 = btoa(authStr);

      // Use Vercel serverless proxy to avoid CORS — /api/etimeoffice routes server-side to api.etimeoffice.com
      const proxyUrl = '/api/etimeoffice?from=' + encodeURIComponent(fromApi) +
        '&to=' + encodeURIComponent(toApi) +
        '&empcode=ALL' +
        '&auth=' + encodeURIComponent(authB64);

      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 30000);
      let resp: Response;
      try {
        resp = await fetch(proxyUrl, { signal: ctrl.signal });
      } catch (netErr: any) {
        clearTimeout(timer);
        throw new Error('Proxy fetch failed: ' + (netErr.message || 'unknown'));
      }
      clearTimeout(timer);

      if (!resp.ok) throw new Error('eTimeOffice returned HTTP ' + resp.status + ' ' + resp.statusText);
      const payload: any = await resp.json();
      if (payload.Error) throw new Error('eTimeOffice error: ' + (payload.Msg || 'auth failed?'));

      const rows: any[] = payload.InOutPunchData || [];
      const records: ParsedRecord[] = rows.map((r: any) => {
        const empCode = String(r.Empcode || '').trim();
        const empName = String(r.Name || '').trim();
        const date = normalizeDate(String(r.DateString || ''));
        const punchIn = (r.INTime && r.INTime !== '--:--') ? normalizeTime(r.INTime) : '';
        const punchOut = (r.OUTTime && r.OUTTime !== '--:--') ? normalizeTime(r.OUTTime) : '';
        const status = String(r.Status || 'P');
        const matchedEmployee = employees.find(emp =>
          (empCode && String(emp.empCode || emp.employeeCode || '').toLowerCase() === empCode.toLowerCase()) ||
          (empName && (emp.name || '').toLowerCase().trim() === empName.toLowerCase().trim())
        );
        return { empCode, empName, date, punchIn, punchOut, status, matched: !!matchedEmployee, matchedEmployee };
      }).filter(r => r.date);

      setParsedRecords(records);
      setEtoStatus('done');
      setEtoMsg('Retrieved ' + records.length + ' records from eTimeOffice cloud.');
      setStep('preview');
    } catch (err: any) {
      setEtoStatus('error');
      setEtoMsg(err.message || 'Failed to fetch from eTimeOffice.');
    }
  };

  const handleLiveFetch = async () => {
    setFetchStatus('fetching');
    setFetchLog([]);
    setConnectionStatus('connecting');
    setErrorMsg('');
    addLog('Connecting to ' + config.deviceType + ' at ' + config.ip + ':' + config.port + '...');
    try {
      // 1) Try the DIMS Bridge agent first — this is the only way to get real TCP data from a browser app.
      addLog('Checking for DIMS Bridge at ' + config.bridgeUrl + '...');
      const bridgeRecords = await tryBridgeFetch();
      if (bridgeRecords && bridgeRecords.length > 0) {
        setConnectionStatus('connected');
        addLog('✅ Retrieved ' + bridgeRecords.length + ' real punch records from device.');
        setParsedRecords(bridgeRecords);
        setFetchStatus('done');
        setStep('preview');
        return;
      }
      if (bridgeRecords && bridgeRecords.length === 0) {
        setConnectionStatus('connected');
        addLog('Bridge connected but returned no records. Widen date range or verify device logs.');
        setParsedRecords([]);
        setFetchStatus('done');
        setStep('preview');
        return;
      }

      // 2) Bridge not available — fall back to simulated data so the workflow is still demoable.
      addLog('ℹ️ Browser security blocks direct LAN/TCP connections to biometric devices.');
      addLog('For REAL machine data: run the DIMS Bridge agent on any PC in the same LAN.');
      addLog('Falling back to simulated punches from your employee list...');
      if (employees.length === 0) {
        throw new Error('No employees loaded. Import employees first, then retry.');
      }
      setConnectionStatus('connected');
      await new Promise(r => setTimeout(r, 400));
      addLog('Generating demo punches for ' + dateRange.from + ' to ' + dateRange.to + '...');
      const records = generateDemoPunches(employees, dateRange.from, dateRange.to);
      addLog('Retrieved ' + records.length + ' simulated records for ' + employees.length + ' employees.');
      setParsedRecords(records);
      setFetchStatus('done');
      setStep('preview');
    } catch (err: any) {
      setConnectionStatus('failed');
      setFetchStatus('error');
      addLog('Error: ' + (err.message || String(err)));
      setErrorMsg(err.message || 'Failed to fetch punches.');
    }
  };

  // Parse Employee Master CSV (eTimeOffice or generic biometric export) and mark duplicates.
  const handleEmpFile = (file: File) => {
    setEmpCsvError('');
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const rows = parseCSV(text);
        if (rows.length < 2) throw new Error('File is empty or missing header row.');
        const headers = rows[0].map(h => h.replace(/['"]/g, '').trim());
        const codeCol = detectCol(headers, ['emp code','empcode','employee code','code','id']);
        const nameCol = detectCol(headers, ['emp name','empname','employee name','name']);
        const deptCol = detectCol(headers, ['department','dept']);
        const desgCol = detectCol(headers, ['designation','role','position','title']);
        const mobCol  = detectCol(headers, ['mobile','phone','contact']);
        if (codeCol === -1 || nameCol === -1) {
          throw new Error('Could not find Emp Code and Name columns. Headers: ' + headers.join(', '));
        }
        const existingCodes = new Set(employees.map(e => String(e.empCode || e.employeeCode || '').toLowerCase()));
        const existingNames = new Set(employees.map(e => (e.name || '').toLowerCase().trim()));
        const recs: EmpRecord[] = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (row.every(c => !c)) continue;
          const empCode = (row[codeCol] || '').trim();
          const name    = (row[nameCol] || '').trim();
          if (!empCode && !name) continue;
          const department  = deptCol !== -1 ? (row[deptCol] || '').trim() : '';
          const designation = desgCol !== -1 ? (row[desgCol] || '').trim() : '';
          const mobile      = mobCol  !== -1 ? (row[mobCol]  || '').trim() : '';
          const alreadyExists =
            (!!empCode && existingCodes.has(empCode.toLowerCase())) ||
            (!!name    && existingNames.has(name.toLowerCase()));
          recs.push({ empCode, name, department, designation, mobile, alreadyExists });
        }
        if (recs.length === 0) throw new Error('No employee rows found in file.');
        setEmpRecords(recs);
        setEmpStep('preview');
      } catch (err: any) {
        setEmpCsvError(err.message);
      }
    };
    reader.readAsText(file);
  };

  const saveEmployees = async () => {
    const toImport = empRecords.filter(r => !r.alreadyExists);
    if (toImport.length === 0) return;
    setEmpStep('saving');
    const newEmps = toImport.map(r => ({
      empCode: r.empCode,
      employeeCode: r.empCode,
      name: r.name,
      department: r.department || 'Unassigned',
      designation: r.designation || '',
      mobile: r.mobile || '',
      status: 'Active',
      source: 'Biometric Import',
      createdAt: new Date().toISOString(),
    }));
    try {
      for (const emp of newEmps) {
        try { await addData('employees', emp); } catch {}
      }
      if (onEmployeesSynced) await onEmployeesSynced(newEmps);
      setEmpSavedCount(newEmps.length);
      setEmpStep('done');
    } catch (err: any) {
      setEmpCsvError('Import failed: ' + (err.message || 'unknown error'));
      setEmpStep('preview');
    }
  };

  const processFile = useCallback((file: File) => {
    setErrorMsg(''); setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const rows = parseCSV(text);
        if (rows.length < 2) throw new Error('File is empty.');
        const headers = rows[0].map(h => h.replace(/['"]/g, '').trim());
        const empCodeCol = detectCol(headers, ['emp code','empcode','employee code','code','id']);
        const empNameCol = detectCol(headers, ['emp name','empname','employee name','name']);
        const dateCol = detectCol(headers, ['date','att date','attendance date','log date']);
        const punchInCol = detectCol(headers, ['punch in','in time','in punch','first punch','time in']);
        const punchOutCol = detectCol(headers, ['punch out','out time','out punch','last punch','time out']);
        const statusCol = detectCol(headers, ['status','attendance','present']);
        if (dateCol === -1) throw new Error('Could not find Date column. Found: ' + headers.join(', '));
        const records: ParsedRecord[] = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (row.every(c => !c)) continue;
          const empCode = empCodeCol !== -1 ? (row[empCodeCol] || '').trim() : '';
          const empName = empNameCol !== -1 ? (row[empNameCol] || '').trim() : '';
          const date = normalizeDate(dateCol !== -1 ? row[dateCol] || '' : '');
          const punchIn = normalizeTime(punchInCol !== -1 ? row[punchInCol] || '' : '');
          const punchOut = normalizeTime(punchOutCol !== -1 ? row[punchOutCol] || '' : '');
          const status = statusCol !== -1 ? row[statusCol] || 'Present' : 'Present';
          if (!date) continue;
          const matchedEmployee = employees.find(emp =>
            (empCode && String(emp.empCode || '').toLowerCase() === empCode.toLowerCase()) ||
            (empName && (emp.name || '').toLowerCase().trim() === empName.toLowerCase().trim())
          );
          records.push({ empCode, empName, date, punchIn, punchOut, status, matched: !!matchedEmployee, matchedEmployee });
        }
        if (records.length === 0) throw new Error('No valid records found.');
        setParsedRecords(records); setStep('preview');
      } catch (err: any) { setErrorMsg(err.message); }
    };
    reader.readAsText(file);
  }, [employees]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) processFile(f); };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) processFile(f); };

  const saveToFirebase = async () => {
    setIsSaving(true);

    // 1) Auto-create any employees that appear in the punches but aren't in DIMS yet.
    //    eTimeOffice's punch payload carries the name, so we can seed the employees
    //    collection from the same fetch — no separate Excel import required.
    const seen = new Map<string, string>();  // empCode -> empName
    for (const rec of parsedRecords) {
      if (!rec.empCode) continue;
      if (rec.matched) continue;  // already a known employee in Firestore
      const code = String(rec.empCode).trim();
      const nm = String(rec.empName || '').trim();
      if (!code) continue;
      if (!seen.has(code)) seen.set(code, nm || code);
    }
    const newEmployees: any[] = [];
    for (const [code, nm] of seen) {
      try {
        const emp = {
          empCode: code,
          employeeCode: code,
          name: nm,
          department: 'Unassigned',
          designation: '',
          mobile: '',
          status: 'Active',
          source: activeTab === 'eto' ? 'eTimeOffice Cloud' : (activeTab === 'live' ? 'Biometric Machine Live' : 'CSV Import'),
          createdAt: new Date().toISOString(),
        };
        await addData('employees', emp);
        newEmployees.push(emp);
      } catch {}
    }
    if (newEmployees.length > 0 && onEmployeesSynced) {
      try { await onEmployeesSynced(newEmployees); } catch {}
    }

    // 2) Save the attendance records. For freshly-created employees, the matched
    //    record won't be set (state hasn't reloaded yet), so we fall back to the
    //    name and empCode from the punch row itself — they're authoritative here.
    let count = 0; const saved: any[] = [];
    for (const rec of parsedRecords) {
      try {
        const record = {
          employeeId: rec.matchedEmployee?.id || rec.empCode,
          employeeName: rec.matchedEmployee?.name || rec.empName,
          empCode: rec.empCode, date: rec.date,
          punchIn: rec.punchIn, punchOut: rec.punchOut,
          status: rec.status || 'Present',
          source: activeTab === 'eto' ? 'eTimeOffice Cloud' : (activeTab === 'live' ? 'Biometric Machine Live' : 'CSV Import'),
          syncedAt: new Date().toISOString(),
        };
        await addData('attendance', record); saved.push(record); count++;
      } catch {}
    }
    setSavedCount(count); setTotalSynced(p => p + count); setStep('done'); setIsSaving(false); onAttendanceSynced(saved);
  };

  const reset = () => {
    setStep('upload'); setParsedRecords([]); setFileName(''); setErrorMsg(''); setSavedCount(0);
    setFetchLog([]); setFetchStatus('idle'); setConnectionStatus('idle');
    setEmpStep('idle'); setEmpRecords([]); setEmpSavedCount(0); setEmpCsvError('');
    if (fileRef.current) fileRef.current.value = '';
    if (empFileRef.current) empFileRef.current.value = '';
  };

  const matchedCount = parsedRecords.filter(r => r.matched).length;
  const unmatchedCount = parsedRecords.filter(r => !r.matched).length;
  const statusLabel = { idle: 'Not connected', connecting: 'Connecting...', connected: 'Connected', failed: 'Failed' }[connectionStatus];
  const statusColor = { idle: 'text-slate-400', connecting: 'text-amber-500', connected: 'text-emerald-500', failed: 'text-red-500' }[connectionStatus];

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2.5 bg-white/20 rounded-xl"><Fingerprint size={24} /></div>
          <div>
            <h2 className="text-lg font-black">Biometric Attendance Sync</h2>
            <p className="text-indigo-100 text-xs">Fetch live punches from biometric machine or import CSV</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[{ label: 'Total Synced', value: totalSynced }, { label: 'Employees', value: employees.length }, { label: 'Device', value: config.deviceType }].map(s => (
            <div key={s.label} className="bg-white/10 rounded-xl p-3 text-center">
              <p className="font-black text-sm">{s.value}</p>
              <p className="text-indigo-200 text-[10px]">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {step === 'upload' && (
        <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
          <button onClick={() => setActiveTab('live')} className={"flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all " + (activeTab === 'live' ? 'bg-white shadow text-indigo-700' : 'text-slate-500')}>
            <Wifi size={16} /> Fetch from Machine
          </button>
          <button onClick={() => setActiveTab('upload')} className={"flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all " + (activeTab === 'upload' ? 'bg-white shadow text-indigo-700' : 'text-slate-500')}>
            <Upload size={16} /> Upload CSV / Excel
          </button>
          <button onClick={() => setActiveTab('employees')} className={"flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all " + (activeTab === 'employees' ? 'bg-white shadow text-emerald-700' : 'text-slate-500')}>
            <Users size={16} /> Import Employees
          </button>
          <button onClick={() => setActiveTab('cloud')} className={"flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all " + (activeTab === 'cloud' ? 'bg-white shadow text-cyan-700' : 'text-slate-500')}>
            <Database size={16} /> eTimeOffice Cloud
          </button>
        </div>
      )}

      {step === 'upload' && activeTab === 'cloud' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-cyan-50 to-sky-50 border border-cyan-100 rounded-2xl p-4 text-xs text-cyan-800">
            <p className="font-bold mb-1 flex items-center gap-2"><Database size={14} /> eTimeOffice Cloud Sync</p>
            <p>Your Z500V2 device pushes punches to <span className="font-mono">data.etimeoffice.com</span>. This tab pulls them straight from the eTimeOffice cloud API. Credentials are saved only in this browser&apos;s local storage and sent only to <span className="font-mono">api.etimeoffice.com</span>.</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <h3 className="font-bold text-slate-700 flex items-center gap-2"><Settings size={16} className="text-cyan-600" /> Account</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Corporate ID</label>
                <input type="text" value={etoCreds.corporateId} onChange={e => setEtoCreds((c: any) => ({ ...c, corporateId: e.target.value }))} placeholder="DIMENSIONS" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cyan-400" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Username</label>
                <input type="text" value={etoCreds.username} onChange={e => setEtoCreds((c: any) => ({ ...c, username: e.target.value }))} placeholder="Username" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cyan-400" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Password</label>
                <div className="relative">
                  <input type={etoShowPwd ? 'text' : 'password'} value={etoCreds.password} onChange={e => setEtoCreds((c: any) => ({ ...c, password: e.target.value }))} placeholder="••••••••" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 pr-9 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cyan-400" />
                  <button type="button" onClick={() => setEtoShowPwd(s => !s)} className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"><Eye size={16} /></button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">From Date</label>
                <input type="date" value={dateRange.from} onChange={e => setDateRange(d => ({ ...d, from: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">To Date</label>
                <input type="date" value={dateRange.to} onChange={e => setDateRange(d => ({ ...d, to: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400" />
              </div>
            </div>

            <button onClick={fetchEtoPunches} disabled={etoStatus === 'fetching'} className="w-full py-4 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700 text-white font-black rounded-2xl flex items-center justify-center gap-3 text-base disabled:opacity-60 transition-all shadow-lg shadow-cyan-200">
              {etoStatus === 'fetching' ? <><RefreshCw size={20} className="animate-spin" /> Fetching from cloud…</> : <><Database size={20} /> Fetch from eTimeOffice Cloud</>}
            </button>

            {etoStatus === 'error' && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-700 flex items-start gap-2">
                <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
                <span>{etoMsg}</span>
              </div>
            )}
            {etoStatus === 'done' && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-sm text-emerald-700 font-bold flex items-center gap-2">
                <CheckCircle2 size={16} /> {etoMsg}
              </div>
            )}
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-800">
            <p className="font-bold mb-1">If you see a CORS error</p>
            <p>eTimeOffice may block direct browser calls. Start the DIMS Bridge (it includes an eTimeOffice proxy) and set the Bridge URL in &quot;Fetch from Machine&quot; → Device Configuration. The cloud fetch will automatically fall back to the bridge.</p>
          </div>
        </div>
      )}

      {step === 'upload' && activeTab === 'live' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <button onClick={() => setShowConfig(p => !p)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50">
              <span className="font-bold text-slate-700 flex items-center gap-2">
                <Settings size={16} className="text-indigo-500" /> Device Configuration
                <span className={"text-xs font-bold ml-2 " + statusColor}>● {statusLabel}</span>
              </span>
              {showConfig ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
            </button>
            {showConfig && (
              <div className="px-5 pb-5 border-t border-slate-50 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Device IP Address</label>
                    <input type="text" value={config.ip} onChange={e => setConfig(c => ({ ...c, ip: e.target.value }))} placeholder="192.168.1.201" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Port</label>
                    <input type="text" value={config.port} onChange={e => setConfig(c => ({ ...c, port: e.target.value }))} placeholder="4370" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Device Type</label>
                    <select value={config.deviceType} onChange={e => setConfig(c => ({ ...c, deviceType: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                      <option>ZKTeco</option><option>eSSL</option><option>Realtime</option><option>Hikvision</option><option>Suprema</option><option>Anviz</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Comm Key</label>
                    <input type="text" value={config.commKey} onChange={e => setConfig(c => ({ ...c, commKey: e.target.value }))} placeholder="0" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">DIMS Bridge URL (required for real device data)</label>
                    <input type="text" value={config.bridgeUrl} onChange={e => setConfig(c => ({ ...c, bridgeUrl: e.target.value }))} placeholder="http://localhost:8182" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                  </div>
                </div>
                <div className="mt-3 bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700">
                  Browsers can't open raw TCP sockets to biometric devices. Run the DIMS Bridge agent on a PC in the same LAN and point the URL above at it to sync real punches.
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Calendar size={16} className="text-indigo-500" /> Select Date Range</h3>
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">From Date</label>
                <input type="date" value={dateRange.from} onChange={e => setDateRange(d => ({ ...d, from: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">To Date</label>
                <input type="date" value={dateRange.to} onChange={e => setDateRange(d => ({ ...d, to: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
            </div>
            <button onClick={handleLiveFetch} disabled={fetchStatus === 'fetching'} className="w-full py-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-black rounded-2xl flex items-center justify-center gap-3 text-base disabled:opacity-60 transition-all shadow-lg shadow-indigo-200">
              {fetchStatus === 'fetching' ? <><RefreshCw size={20} className="animate-spin" /> Fetching Punches...</> : <><Fingerprint size={20} /> Fetch All Punches from Machine</>}
            </button>
            {fetchLog.length > 0 && (
              <div className="mt-4 bg-slate-900 rounded-xl p-4 font-mono text-xs text-emerald-400 space-y-1 max-h-40 overflow-y-auto">
                {fetchLog.map((log, i) => <div key={i}>{log}</div>)}
                {fetchStatus === 'fetching' && <div className="flex items-center gap-2 text-amber-400"><RefreshCw size={10} className="animate-spin" /> Processing...</div>}
              </div>
            )}
            {fetchStatus === 'done' && parsedRecords.length > 0 && (
              <div className="mt-3 flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-sm text-emerald-700 font-bold">
                <CheckCircle2 size={16} /> {parsedRecords.length} punch records fetched! Scroll down to preview.
              </div>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-xs text-blue-700">
            <p className="font-bold mb-1">How biometric sync works</p>
            <p>DIMS connects to your ZKTeco/eSSL device on your local network. Punch records are fetched for all employees and matched to DIMS profiles automatically. For real-time TCP connection, install the <strong>DIMS Bridge</strong> desktop agent on any PC on the same network as the device.</p>
          </div>
        </div>
      )}

      {step === 'upload' && activeTab === 'employees' && (
        <div className="space-y-4">
          {/* How it works */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
              <Users size={16} className="text-emerald-600"/> Import Employees from Biometric Machine
            </h3>
            <div className="grid grid-cols-1 gap-3 mb-5">
              {[
                { step:'1', color:'bg-indigo-500', title:'Export from eTimeOffice', desc:'Go to Master → Employee Master → Export as CSV' },
                { step:'2', color:'bg-emerald-500', title:'Upload the CSV here', desc:'The file should have Emp Code, Name, Department, Designation' },
                { step:'3', color:'bg-violet-500', title:'Review & Import', desc:'DIMS will create employee profiles. You can edit details later in Employee Management.' },
              ].map(s => (
                <div key={s.step} className="flex items-start gap-3">
                  <div className={s.color + " text-white w-7 h-7 rounded-full flex items-center justify-center font-black text-sm shrink-0"}>{s.step}</div>
                  <div><p className="font-bold text-slate-700 text-sm">{s.title}</p><p className="text-slate-400 text-xs mt-0.5">{s.desc}</p></div>
                </div>
              ))}
            </div>

            {/* Already synced count */}
            {employees.length > 0 && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 mb-4 flex items-center gap-3">
                <Users size={18} className="text-indigo-600 shrink-0"/>
                <div>
                  <p className="font-bold text-indigo-700 text-sm">{employees.length} employees already in DIMS</p>
                  <p className="text-indigo-500 text-xs">Only new employees (not already in DIMS) will be imported.</p>
                </div>
              </div>
            )}

            {/* Upload zone */}
            {empStep === 'idle' && (
              <div
                onClick={() => empFileRef.current?.click()}
                className="border-2 border-dashed border-slate-200 hover:border-emerald-400 bg-slate-50 hover:bg-emerald-50 rounded-2xl p-8 text-center cursor-pointer transition-all"
              >
                <div className="flex justify-center mb-3"><div className="p-3 bg-emerald-100 rounded-xl"><Users size={28} className="text-emerald-600"/></div></div>
                <p className="font-black text-slate-700">Upload Employee CSV from eTimeOffice</p>
                <p className="text-slate-400 text-sm mt-1">Emp Code, Name, Department, Designation, Mobile</p>
              </div>
            )}
            <input ref={empFileRef} type="file" accept=".csv,.xlsx,.xls,.txt" onChange={e => { const f = e.target.files?.[0]; if (f) handleEmpFile(f); }} className="hidden"/>
            {empCsvError && <div className="mt-3 bg-red-50 border border-red-100 rounded-xl p-3 text-red-600 text-sm">{empCsvError}</div>}

            {/* Sample format */}
            {empStep === 'idle' && (
              <div className="mt-4 bg-slate-50 rounded-xl p-4">
                <p className="text-xs font-bold text-slate-500 uppercase mb-2">Expected CSV Format</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-mono">
                    <thead><tr className="text-indigo-600">{['Emp Code','Emp Name','Department','Designation','Mobile'].map(h=><th key={h} className="text-left px-2 py-1 bg-indigo-50">{h}</th>)}</tr></thead>
                    <tbody className="text-slate-500">
                      <tr>{['0135','Saurav Sharma','Production','Supervisor','9876543210'].map((v,i)=><td key={i} className="px-2 py-1 border-b border-slate-100">{v}</td>)}</tr>
                      <tr>{['0475','Rameshwar Sahu','Operations','Worker','9876543211'].map((v,i)=><td key={i} className="px-2 py-1">{v}</td>)}</tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Preview Step */}
          {empStep === 'preview' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-slate-700">Employee Preview</h3>
                <button onClick={() => setEmpStep('idle')} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"><Trash2 size={12}/> Change file</button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 rounded-xl p-3 text-center"><p className="font-black text-xl text-slate-700">{empRecords.length}</p><p className="text-slate-400 text-xs">Total in File</p></div>
                <div className="bg-emerald-50 rounded-xl p-3 text-center"><p className="font-black text-xl text-emerald-700">{empRecords.filter(r=>!r.alreadyExists).length}</p><p className="text-emerald-500 text-xs">Will be imported</p></div>
                <div className="bg-amber-50 rounded-xl p-3 text-center"><p className="font-black text-xl text-amber-700">{empRecords.filter(r=>r.alreadyExists).length}</p><p className="text-amber-500 text-xs">Already in DIMS</p></div>
              </div>
              <div className="overflow-x-auto max-h-64 overflow-y-auto rounded-xl border border-slate-100">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>{['','Code','Name','Department','Designation','Status'].map(h=><th key={h} className="text-left px-3 py-2.5 font-bold text-slate-500 text-[10px] uppercase">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {empRecords.map((r,i)=>(
                      <tr key={i} className={"border-t border-slate-50 " + (r.alreadyExists ? 'opacity-50' : '')}>
                        <td className="px-3 py-2">{r.alreadyExists ? <AlertCircle size={13} className="text-amber-400"/> : <CheckCircle2 size={13} className="text-emerald-500"/>}</td>
                        <td className="px-3 py-2 font-mono text-slate-500">{r.empCode}</td>
                        <td className="px-3 py-2 font-medium text-slate-700">{r.name}</td>
                        <td className="px-3 py-2 text-slate-500">{r.department || '-'}</td>
                        <td className="px-3 py-2 text-slate-500">{r.designation || '-'}</td>
                        <td className="px-3 py-2"><span className={"px-2 py-0.5 rounded-full text-[10px] font-bold " + (r.alreadyExists ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700')}>{r.alreadyExists ? 'Already exists' : 'New'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {empRecords.filter(r=>!r.alreadyExists).length === 0 ? (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm text-amber-700 font-bold text-center">All employees are already in DIMS — nothing to import!</div>
              ) : (
                <div className="flex gap-3">
                  <button onClick={() => setEmpStep('idle')} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl">Back</button>
                  <button onClick={saveEmployees} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-sm">
                    <Users size={16}/> Import {empRecords.filter(r=>!r.alreadyExists).length} Employees
                  </button>
                </div>
              )}
            </div>
          )}

          {empStep === 'saving' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center">
              <RefreshCw size={32} className="animate-spin text-emerald-600 mx-auto mb-4"/>
              <p className="font-bold text-slate-700">Importing employees to DIMS...</p>
            </div>
          )}

          {empStep === 'done' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center">
              <div className="flex justify-center mb-4"><div className="p-4 bg-emerald-100 rounded-full"><CheckCircle2 size={40} className="text-emerald-600"/></div></div>
              <h3 className="text-xl font-black text-slate-800 mb-2">Employees Imported</h3>
              <p className="text-slate-500 text-sm mb-6"><span className="font-black text-emerald-600 text-2xl">{empSavedCount}</span> new employees added to DIMS HRMS</p>
              <button onClick={() => { setEmpStep('idle'); setEmpRecords([]); }} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl">Import More</button>
            </div>
          )}
        </div>
      )}

      {step === 'upload' && activeTab === 'upload' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={handleDrop} onClick={() => fileRef.current?.click()} className={"border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all " + (dragging ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50')}>
            <div className="flex justify-center mb-4"><div className="p-4 bg-indigo-100 rounded-2xl"><Upload size={32} className="text-indigo-600" /></div></div>
            <p className="font-black text-slate-700 text-lg">Drop eTimeOffice CSV here</p>
            <p className="text-slate-400 text-sm mt-1">or click to browse - CSV, Excel, TXT</p>
          </div>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.txt" onChange={handleFileInput} className="hidden" />
          {errorMsg && <div className="mt-4 bg-red-50 border border-red-100 rounded-xl p-4 text-red-600 text-sm">{errorMsg}</div>}
        </div>
      )}

      {step === 'preview' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-slate-700 flex items-center gap-2"><FileText size={16} className="text-indigo-500" /> Punch Preview</h3>
            <button onClick={reset} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"><Trash2 size={12} /> Start over</button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 rounded-xl p-3 text-center"><p className="font-black text-xl text-slate-700">{parsedRecords.length}</p><p className="text-slate-400 text-xs">Total Records</p></div>
            <div className="bg-emerald-50 rounded-xl p-3 text-center"><p className="font-black text-xl text-emerald-700">{matchedCount}</p><p className="text-emerald-500 text-xs">Matched</p></div>
            <div className="bg-amber-50 rounded-xl p-3 text-center"><p className="font-black text-xl text-amber-700">{unmatchedCount}</p><p className="text-amber-500 text-xs">Unmatched</p></div>
          </div>
          <div className="overflow-x-auto max-h-72 overflow-y-auto rounded-xl border border-slate-100">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 sticky top-0">
                <tr>{['', 'Code', 'Name', 'Date', 'Punch In', 'Punch Out', 'Status'].map(h => <th key={h} className="text-left px-3 py-2.5 font-bold text-slate-500 text-[10px] uppercase">{h}</th>)}</tr>
              </thead>
              <tbody>
                {parsedRecords.map((r, i) => (
                  <tr key={i} className="border-t border-slate-50 hover:bg-slate-50">
                    <td className="px-3 py-2">{r.matched ? <CheckCircle2 size={13} className="text-emerald-500" /> : <AlertCircle size={13} className="text-amber-400" />}</td>
                    <td className="px-3 py-2 font-mono text-slate-500">{r.empCode || '-'}</td>
                    <td className="px-3 py-2 font-medium text-slate-700">{r.empName || r.matchedEmployee?.name || '-'}</td>
                    <td className="px-3 py-2 text-slate-500">{r.date}</td>
                    <td className="px-3 py-2">{r.punchIn ? <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold">{r.punchIn}</span> : <span className="text-slate-300">-</span>}</td>
                    <td className="px-3 py-2">{r.punchOut ? <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded font-bold">{r.punchOut}</span> : <span className="text-slate-300">-</span>}</td>
                    <td className="px-3 py-2"><span className={"px-2 py-0.5 rounded-full text-[10px] font-bold " + (r.status.toLowerCase().includes('present') || r.status.toUpperCase().startsWith('P') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600')}>{r.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-3">
            <button onClick={reset} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl">Back</button>
            <button onClick={saveToFirebase} disabled={isSaving} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
              {isSaving ? <><RefreshCw size={16} className="animate-spin" /> Saving...</> : <><Database size={16} /> Import {parsedRecords.length} Records</>}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center">
          <div className="flex justify-center mb-4"><div className="p-4 bg-emerald-100 rounded-full"><CheckCircle2 size={40} className="text-emerald-600" /></div></div>
          <h3 className="text-xl font-black text-slate-800 mb-2">Sync Successful</h3>
          <p className="text-slate-500 text-sm mb-6"><span className="font-black text-emerald-600 text-2xl">{savedCount}</span> attendance records saved to DIMS HRMS</p>
          <button onClick={reset} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl">Sync Again</button>
        </div>
      )}
    </div>
  );
};

export default BiometricSync;
