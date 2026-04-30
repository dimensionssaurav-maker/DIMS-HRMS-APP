import React, { useRef, useState, useEffect } from 'react';
import { X, Upload, FileText, Eye, Trash2, Loader2, AlertTriangle, File, FileBadge } from 'lucide-react';
import { storage, db } from '../firebase';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { collection, addDoc, getDocs, query, where, deleteDoc, doc } from 'firebase/firestore';

interface DocMeta {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
  uploadedAt: string;
  path: string;
  empCode: string;
}

interface Props {
  empCode: string;
  empName: string;
  onClose: () => void;
}

function formatBytes(b: number) {
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  return (b / (1024 * 1024)).toFixed(1) + ' MB';
}

function fileIcon(type: string) {
  if (type === 'application/pdf') return <FileBadge size={20} className="text-red-500" />;
  if (type.startsWith('image/')) return <File size={20} className="text-indigo-500" />;
  return <FileText size={20} className="text-slate-500" />;
}

const EmployeeDocuments: React.FC<Props> = ({ empCode, empName, onClose }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'employeeDocs'), where('empCode', '==', empCode));
      const snap = await getDocs(q);
      setDocs(snap.docs.map(d => ({ id: d.id, ...d.data() } as DocMeta)));
    } catch (e: any) {
      setError('Failed to load documents: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDocs(); }, [empCode]);

  const handleUpload = async (file: File) => {
    if (!file) return;
    setError('');
    setUploading(true);
    setProgress(0);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._\- ]/g, '_');
      const path = `employee-docs/${empCode}/${Date.now()}_${safeName}`;
      const storageRef = ref(storage, path);
      const task = uploadBytesResumable(storageRef, file);
      await new Promise<void>((resolve, reject) => {
        task.on('state_changed',
          snap => setProgress(Math.round(snap.bytesTransferred / snap.totalBytes * 100)),
          reject,
          resolve
        );
      });
      const url = await getDownloadURL(storageRef);
      const meta = { empCode, name: file.name, url, size: file.size, type: file.type, uploadedAt: new Date().toISOString(), path };
      const docRef = await addDoc(collection(db, 'employeeDocs'), meta);
      setDocs(prev => [...prev, { id: docRef.id, ...meta }]);
    } catch (e: any) {
      setError('Upload failed: ' + e.message);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleDelete = async (d: DocMeta) => {
    if (!window.confirm(`Delete "${d.name}"? This cannot be undone.`)) return;
    setDeletingId(d.id);
    try {
      if (d.path) {
        try { await deleteObject(ref(storage, d.path)); } catch {}
      }
      await deleteDoc(doc(db, 'employeeDocs', d.id));
      setDocs(prev => prev.filter(x => x.id !== d.id));
    } catch (e: any) {
      setError('Delete failed: ' + e.message);
    } finally {
      setDeletingId(null);
    }
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
              <p className="text-slate-300 text-xs">{empName} · {empCode}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors"><X size={20} /></button>
        </div>

        {/* Upload zone */}
        <div className="px-6 pt-5 pb-3 shrink-0">
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm mb-4">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {error}
            </div>
          )}
          <div
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${uploading ? 'border-indigo-300 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/40'}`}
            onClick={() => !uploading && fileRef.current?.click()}
            onDrop={e => { e.preventDefault(); if (!uploading && e.dataTransfer.files[0]) handleUpload(e.dataTransfer.files[0]); }}
            onDragOver={e => e.preventDefault()}
          >
            {uploading ? (
              <div className="space-y-2">
                <Loader2 size={28} className="animate-spin text-indigo-600 mx-auto" />
                <p className="text-sm font-bold text-indigo-700">Uploading… {progress}%</p>
                <div className="w-full bg-indigo-100 rounded-full h-2">
                  <div className="bg-indigo-600 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
            ) : (
              <>
                <Upload size={24} className="text-slate-400 mx-auto mb-2" />
                <p className="font-bold text-slate-600 text-sm">Drop a file here or click to browse</p>
                <p className="text-slate-400 text-xs mt-1">PDF, JPG, PNG, DOCX — max 10 MB</p>
              </>
            )}
          </div>
          <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.docx,.doc" className="hidden"
            onChange={e => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); e.target.value = ''; }} />
        </div>

        {/* Document list */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {loading ? (
            <div className="flex items-center justify-center py-10 gap-2 text-slate-400">
              <Loader2 size={20} className="animate-spin" /> Loading…
            </div>
          ) : docs.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <FileText size={36} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">No documents uploaded yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">{docs.length} Document{docs.length !== 1 ? 's' : ''}</p>
              {docs.map(d => (
                <div key={d.id} className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 hover:border-slate-200 transition-all">
                  <div className="shrink-0">{fileIcon(d.type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">{d.name}</p>
                    <p className="text-[10px] text-slate-400 font-medium">
                      {formatBytes(d.size)} · {new Date(d.uploadedAt).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a href={d.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
                      <Eye size={13} /> View
                    </a>
                    <button
                      onClick={() => handleDelete(d)}
                      disabled={deletingId === d.id}
                      className="flex items-center gap-1.5 bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50">
                      {deletingId === d.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Delete
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
