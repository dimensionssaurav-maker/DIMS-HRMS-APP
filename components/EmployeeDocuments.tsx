import React, { useRef, useState, useEffect } from 'react';
import { X, Upload, FileText, Eye, Trash2, Loader2, AlertTriangle, FileBadge, File, FileImage } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, query, where, deleteDoc, doc } from 'firebase/firestore';

interface DocMeta {
  id: string;
  name: string;
  base64: string;
  size: number;
  type: string;
  uploadedAt: string;
  empCode: string;
}

interface Props {
  empCode: string;
  empName: string;
  onClose: () => void;
}

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB raw file limit

function formatBytes(b: number) {
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  return (b / (1024 * 1024)).toFixed(2) + ' MB';
}

function FileIcon({ type }: { type: string }) {
  if (type === 'application/pdf') return <FileBadge size={22} className="text-red-500 shrink-0" />;
  if (type.startsWith('image/')) return <FileImage size={22} className="text-indigo-500 shrink-0" />;
  return <File size={22} className="text-slate-500 shrink-0" />;
}

function openBase64(base64: string, type: string, name: string) {
  const byteCharacters = atob(base64);
  const byteNumbers = new Uint8Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
  const blob = new Blob([byteNumbers], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  // For PDFs open in new tab; for others download
  if (type === 'application/pdf' || type.startsWith('image/')) {
    window.open(url, '_blank');
  } else {
    a.download = name;
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

const EmployeeDocuments: React.FC<Props> = ({ empCode, empName, onClose }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'employeeDocs'), where('empCode', '==', empCode));
      const snap = await getDocs(q);
      setDocs(snap.docs.map(d => ({ id: d.id, ...d.data() } as DocMeta)));
    } catch (e: any) {
      setError('Failed to load: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDocs(); }, [empCode]);

  const handleUpload = async (file: File) => {
    setError('');
    if (file.size > MAX_BYTES) {
      setError(`File too large (${formatBytes(file.size)}). Maximum allowed is 2 MB.`);
      return;
    }
    setUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const meta = {
        empCode,
        name: file.name,
        base64,
        size: file.size,
        type: file.type || 'application/octet-stream',
        uploadedAt: new Date().toISOString(),
      };
      const ref2 = await addDoc(collection(db, 'employeeDocs'), meta);
      setDocs(prev => [...prev, { id: ref2.id, ...meta }]);
    } catch (e: any) {
      setError('Upload failed: ' + e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (d: DocMeta) => {
    if (!window.confirm(`Delete "${d.name}"? This cannot be undone.`)) return;
    setDeletingId(d.id);
    try {
      await deleteDoc(doc(db, 'employeeDocs', d.id));
      setDocs(prev => prev.filter(x => x.id !== d.id));
    } catch (e: any) {
      setError('Delete failed: ' + e.message);
    } finally {
      setDeletingId(null);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">

        {/* Header */}
        <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-6 py-5 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="font-black text-lg">Employee Documents</h2>
              <p className="text-slate-300 text-xs font-semibold">{empName} · <span className="font-mono">{empCode}</span></p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors"><X size={20} /></button>
        </div>

        {/* Upload zone */}
        <div className="px-6 pt-5 pb-3 shrink-0">
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm mb-4 font-medium">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {error}
            </div>
          )}
          <div
            className={`border-2 border-dashed rounded-2xl p-7 text-center cursor-pointer transition-all ${
              uploading ? 'border-indigo-300 bg-indigo-50/60 cursor-wait' :
              dragOver ? 'border-indigo-500 bg-indigo-50' :
              'border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/30'
            }`}
            onClick={() => !uploading && fileRef.current?.click()}
            onDrop={onDrop}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 size={30} className="animate-spin text-indigo-600" />
                <p className="text-sm font-bold text-indigo-700">Saving document…</p>
              </div>
            ) : (
              <>
                <Upload size={26} className={`mx-auto mb-2 ${dragOver ? 'text-indigo-600' : 'text-slate-400'}`} />
                <p className="font-bold text-slate-600 text-sm">Drop a file here or <span className="text-indigo-600">click to browse</span></p>
                <p className="text-slate-400 text-xs mt-1">PDF, JPG, PNG, DOCX — max 2 MB per file</p>
              </>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.docx,.doc"
            className="hidden"
            onChange={e => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); e.target.value = ''; }}
          />
        </div>

        {/* Document list */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-slate-400">
              <Loader2 size={20} className="animate-spin" /> <span className="text-sm">Loading documents…</span>
            </div>
          ) : docs.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <FileText size={38} className="mx-auto mb-2 opacity-20" />
              <p className="text-sm font-medium">No documents uploaded yet</p>
              <p className="text-xs mt-1 text-slate-300">Upload joining form, ID proof, or any other document</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                {docs.length} Document{docs.length !== 1 ? 's' : ''}
              </p>
              {docs.map(d => (
                <div key={d.id} className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 hover:border-slate-200 transition-all group">
                  <FileIcon type={d.type} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">{d.name}</p>
                    <p className="text-[10px] text-slate-400 font-medium">
                      {formatBytes(d.size)} · {new Date(d.uploadedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => openBase64(d.base64, d.type, d.name)}
                      className="flex items-center gap-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                    >
                      <Eye size={13} /> View
                    </button>
                    <button
                      onClick={() => handleDelete(d)}
                      disabled={deletingId === d.id}
                      className="flex items-center gap-1.5 bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                    >
                      {deletingId === d.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmployeeDocuments;
