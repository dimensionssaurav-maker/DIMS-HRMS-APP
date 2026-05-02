import React, { useState, useMemo, useRef } from 'react';
import {
  IndianRupee,
  Plus,
  Trash2,
  FileText,
  Upload,
  Eye,
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Paperclip,
  X
} from 'lucide-react';
import { ContractorPayment, PayrollConfig } from '../types';
import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

interface Props {
  payments: ContractorPayment[];
  month: string;
  year: number;
  payrollConfig: PayrollConfig;
  onMonthChange: (m: string) => void;
  onYearChange: (y: number) => void;
  onAdd: (p: ContractorPayment) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const YEARS = [2023, 2024, 2025, 2026, 2027];

const fmt = (n: number) => '\u20B9' + Math.round(n).toLocaleString('en-IN');

const PieceRateContractors: React.FC<Props> = ({
  payments, month, year, payrollConfig,
  onMonthChange, onYearChange, onAdd, onDelete
}) => {
  const sources = payrollConfig.recruitmentConfig?.sources || [];
  const scRates = (payrollConfig.recruitmentConfig?.serviceChargeRates || [])
    .map((r: number) => r > 1 ? r : Math.round(r * 100 * 100) / 100);

  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const blankForm = () => ({
    contractorName: '',
    department: '',
    source: sources[0] || '',
    grossAmount: '',
    deduction: '',
    serviceChargeRate: scRates[0] ?? 10,
    pdfFile: null as File | null,
    pdfName: '',
  });
  const [form, setForm] = useState(blankForm());

  const fGross   = parseFloat(String(form.grossAmount)) || 0;
  const fDeduct  = parseFloat(String(form.deduction))   || 0;
  const fAmount  = fGross - fDeduct;
  const fSC      = Math.round(fAmount * form.serviceChargeRate / 100 * 100) / 100;
  const fNet     = fAmount - fSC;

  const filtered = useMemo(() =>
    payments.filter(p =>
      p.month === month && p.year === year &&
      (p.contractorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
       p.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
       p.source.toLowerCase().includes(searchTerm.toLowerCase()))
    ),
    [payments, month, year, searchTerm]
  );

  const totals = useMemo(() => filtered.reduce((acc, p) => ({
    gross: acc.gross + p.grossAmount,
    deduct: acc.deduct + p.deduction,
    amount: acc.amount + p.amount,
    sc: acc.sc + p.serviceCharge,
    net: acc.net + p.netPayable,
  }), { gross: 0, deduct: 0, amount: 0, sc: 0, net: 0 }), [filtered]);

  const handlePdfSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') { alert('Please select a PDF file only.'); return; }
    if (file.size > 10 * 1024 * 1024) { alert('PDF must be under 10 MB.'); return; }
    setForm(f => ({ ...f, pdfFile: file, pdfName: file.name }));
  };

  const handleSave = async () => {
    if (!form.contractorName.trim()) { alert('Please enter contractor name.'); return; }
    if (!form.source) { alert('Please select a source.'); return; }
    if (fGross <= 0) { alert('Please enter gross amount.'); return; }

    setSaving(true);
    try {
      let pdfUrl = '';
      let pdfName = '';

      if (form.pdfFile) {
        setUploadingPdf(true);
        const safeName = form.contractorName.replace(/[^a-zA-Z0-9]/g, '_');
        const path = `contractor-pdfs/${year}-${month}/${safeName}-${Date.now()}.pdf`;
        const storageRef = ref(storage, path);
        const snapshot = await uploadBytes(storageRef, form.pdfFile);
        pdfUrl = await getDownloadURL(snapshot.ref);
        pdfName = form.pdfFile.name;
        setUploadingPdf(false);
      }

      const gross  = fGross;
      const deduct = fDeduct;
      const amount = gross - deduct;
      const sc     = Math.round(amount * form.serviceChargeRate / 100 * 100) / 100;
      const net    = amount - sc;

      const newPayment: ContractorPayment = {
        id: `cp_${Date.now()}`,
        month,
        year,
        contractorName: form.contractorName.trim(),
        department: form.department.trim(),
        source: form.source,
        grossAmount: gross,
        deduction: deduct,
        amount,
        serviceChargeRate: form.serviceChargeRate,
        serviceCharge: sc,
        netPayable: net,
        pdfUrl: pdfUrl || undefined,
        pdfName: pdfName || undefined,
        createdAt: new Date().toISOString(),
      };

      await onAdd(newPayment);
      setForm(blankForm());
      setShowForm(false);
    } catch (err) {
      console.error('Save contractor payment error:', err);
      alert('Failed to save. Please try again.');
    } finally {
      setSaving(false);
      setUploadingPdf(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this contractor payment?')) return;
    setDeletingId(id);
    try { await onDelete(id); }
    catch (err) { console.error('Delete error:', err); alert('Failed to delete.'); }
    finally { setDeletingId(null); }
  };

  const exportCsv = () => {
    const headers = ['SNO','Contractor Name','Department','Source','Gross Amount','Deduction','Amount','Service Charge %','Service Charge','Net Payable','PDF Attached'];
    const rows = filtered.map((p, i) => [
      i + 1, `"${p.contractorName}"`, `"${p.department}"`, p.source,
      p.grossAmount, p.deduction, p.amount,
      p.serviceChargeRate + '%', p.serviceCharge, p.netPayable,
      p.pdfUrl ? 'Yes' : 'No'
    ].join(','));
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `Contractor_Payments_${month}_${year}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-in fade-in">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Contractor Payments</h2>
          <p className="text-slate-500 text-sm mt-0.5">Piece rate contractor payment register</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-3 py-2">
            <button onClick={() => {
              const idx = MONTHS.indexOf(month);
              if (idx === 0) { onMonthChange(MONTHS[11]); onYearChange(year - 1); }
              else onMonthChange(MONTHS[idx - 1]);
            }} className="text-slate-400 hover:text-slate-700"><ChevronLeft size={16} /></button>
            <select value={month} onChange={e => onMonthChange(e.target.value)}
              className="text-sm font-medium text-slate-700 border-none outline-none bg-transparent">
              {MONTHS.map(m => <option key={m}>{m}</option>)}
            </select>
            <select value={year} onChange={e => onYearChange(Number(e.target.value))}
              className="text-sm font-medium text-slate-700 border-none outline-none bg-transparent">
              {YEARS.map(y => <option key={y}>{y}</option>)}
            </select>
            <button onClick={() => {
              const idx = MONTHS.indexOf(month);
              if (idx === 11) { onMonthChange(MONTHS[0]); onYearChange(year + 1); }
              else onMonthChange(MONTHS[idx + 1]);
            }} className="text-slate-400 hover:text-slate-700"><ChevronRight size={16} /></button>
          </div>
          <button onClick={() => { setShowForm(v => !v); setForm(blankForm()); }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors">
            <Plus size={16} /> Add Contractor
          </button>
          <button onClick={exportCsv}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: 'Contractors', value: filtered.length.toString(), color: 'text-slate-800' },
          { label: 'Gross Total', value: fmt(totals.gross), color: 'text-slate-800' },
          { label: 'Deductions', value: fmt(totals.deduct), color: 'text-rose-600' },
          { label: 'Service Charge', value: fmt(totals.sc), color: 'text-amber-600' },
          { label: 'Net Payable', value: fmt(totals.net), color: 'text-emerald-600' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-1">{card.label}</p>
            <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Add Contractor Entry</h3>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Contractor name *</label>
              <input value={form.contractorName} onChange={e => setForm(f => ({ ...f, contractorName: e.target.value }))}
                placeholder="e.g. Ramesh Kumar"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Department</label>
              <input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                placeholder="e.g. Production"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Source *</label>
              <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
                <option value="">— select —</option>
                {sources.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Gross amount (\u20B9) *</label>
              <input type="number" value={form.grossAmount} onChange={e => setForm(f => ({ ...f, grossAmount: e.target.value }))}
                placeholder="0"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Deduction (\u20B9)</label>
              <input type="number" value={form.deduction} onChange={e => setForm(f => ({ ...f, deduction: e.target.value }))}
                placeholder="0"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Service charge rate *</label>
              <select value={form.serviceChargeRate} onChange={e => setForm(f => ({ ...f, serviceChargeRate: parseFloat(e.target.value) }))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
                {scRates.map(r => <option key={r} value={r}>{r}%</option>)}
              </select>
            </div>
          </div>

          {/* Live preview */}
          <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Amount</p>
              <p className="font-semibold text-slate-800">{fmt(fAmount)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Service charge ({form.serviceChargeRate}%)</p>
              <p className="font-semibold text-amber-600">{fmt(fSC)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Net payable</p>
              <p className="font-semibold text-emerald-600">{fmt(fNet)}</p>
            </div>
          </div>

          {/* PDF Attach */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-2">Signed copy (PDF)</label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`flex items-center gap-3 border-2 border-dashed rounded-xl px-4 py-3 cursor-pointer transition-colors ${
                form.pdfFile ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50'
              }`}>
              <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handlePdfSelect} />
              {form.pdfFile ? (
                <>
                  <FileText size={18} className="text-emerald-600 shrink-0" />
                  <span className="text-sm text-emerald-700 font-medium flex-1 truncate">{form.pdfName}</span>
                  <button onClick={e => { e.stopPropagation(); setForm(f => ({ ...f, pdfFile: null, pdfName: '' })); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                    className="text-slate-400 hover:text-rose-500 shrink-0"><X size={16} /></button>
                </>
              ) : (
                <>
                  <Paperclip size={18} className="text-slate-400 shrink-0" />
                  <span className="text-sm text-slate-500">Click to attach signed PDF (max 10 MB)</span>
                  <Upload size={16} className="text-slate-400 shrink-0" />
                </>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors">
              {saving ? <><Loader2 size={16} className="animate-spin" />{uploadingPdf ? 'Uploading PDF...' : 'Saving...'}</> : 'Save Entry'}
            </button>
            <button onClick={() => { setShowForm(false); setForm(blankForm()); }}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search contractor, department, source..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        </div>
        <p className="text-sm text-slate-500">{filtered.length} entries — {month} {year}</p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['SNO','Contractor Name','Department','Source','Gross Amt','Deduction','Amount','Svc Charge','Net Payable','PDF',''].map((h, i) => (
                  <th key={i} className={`px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide ${i === 0 ? 'text-center w-12' : i >= 4 && i <= 8 ? 'text-right' : i === 9 ? 'text-center' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={11} className="text-center py-12 text-slate-400">
                  <IndianRupee size={32} className="mx-auto mb-2 opacity-30" />
                  <p>No contractor payments for {month} {year}</p>
                  <p className="text-xs mt-1">Click "Add Contractor" to get started</p>
                </td></tr>
              ) : filtered.map((p, i) => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-center text-slate-400 font-medium">{i + 1}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{p.contractorName}</td>
                  <td className="px-4 py-3 text-slate-500">{p.department || '\u2014'}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block px-2.5 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-semibold">{p.source}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">{fmt(p.grossAmount)}</td>
                  <td className="px-4 py-3 text-right text-rose-600">{fmt(p.deduction)}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{fmt(p.amount)}</td>
                  <td className="px-4 py-3 text-right text-amber-600">
                    {fmt(p.serviceCharge)}
                    <span className="text-xs text-slate-400 ml-1">({p.serviceChargeRate}%)</span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-600">{fmt(p.netPayable)}</td>
                  <td className="px-4 py-3 text-center">
                    {p.pdfUrl ? (
                      <a href={p.pdfUrl} target="_blank" rel="noopener noreferrer"
                        title={p.pdfName || 'View PDF'}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors">
                        <Eye size={15} />
                      </a>
                    ) : (
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-50 text-slate-300" title="No PDF attached">
                        <FileText size={15} />
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => handleDelete(p.id)} disabled={deletingId === p.id}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-colors disabled:opacity-40">
                      {deletingId === p.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            {filtered.length > 0 && (
              <tfoot className="bg-slate-50 border-t border-slate-200">
                <tr className="font-semibold text-slate-700">
                  <td className="px-4 py-3 text-center text-slate-400">\u2014</td>
                  <td className="px-4 py-3" colSpan={3}>Total ({filtered.length} contractors)</td>
                  <td className="px-4 py-3 text-right">{fmt(totals.gross)}</td>
                  <td className="px-4 py-3 text-right text-rose-600">{fmt(totals.deduct)}</td>
                  <td className="px-4 py-3 text-right">{fmt(totals.amount)}</td>
                  <td className="px-4 py-3 text-right text-amber-600">{fmt(totals.sc)}</td>
                  <td className="px-4 py-3 text-right text-emerald-600">{fmt(totals.net)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default PieceRateContractors;
