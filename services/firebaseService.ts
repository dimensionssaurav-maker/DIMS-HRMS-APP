import { db } from "../firebase"
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, setDoc } from "firebase/firestore"

export const addData = async (collectionName: string, data: any) => {
  let docId: string | null = null
  if (collectionName === 'attendance') {
    const code = data.empCode || data.employeeCode || data.employeeId
    const date = data.date
    if (code && date) docId = String(code) + '_' + String(date)
  } else if (collectionName === 'employees') {
    docId = data.empCode || data.employeeCode || data.id || null
    if (docId !== null) docId = String(docId)
  } else {
    const fallback = data.empCode || data.id || data.employeeCode
    if (fallback) docId = String(fallback)
  }

  if (docId) {
    const ref = doc(db, collectionName, docId)
    await setDoc(ref, data, { merge: true })
    return { id: docId }
  }
  return await addDoc(collection(db, collectionName), data)
}

export const getData = async (collectionName: string) => {
  const snapshot = await getDocs(collection(db, collectionName))
  return snapshot.docs.map(d => ({
    id: d.id,
    ...d.data()
  }))
}

export const updateData = async (collectionName: string, id: string, data: any) => {
  const ref = doc(db, collectionName, id)
  return await updateDoc(ref, data)
}

export const deleteData = async (collectionName: string, id: string) => {
  const ref = doc(db, collectionName, id)
  return await deleteDoc(ref)
}

import { storage } from "../firebase"
import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from "firebase/storage"

export const uploadEmployeeDoc = async (empCode: string, file: File): Promise<{name: string, url: string, size: number, type: string, uploadedAt: string}> => {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `employee-docs/${empCode}/${Date.now()}_${safeName}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  const meta = { name: file.name, url, size: file.size, type: file.type, uploadedAt: new Date().toISOString(), path };
  await addData('employeeDocs', { id: `${empCode}_${Date.now()}`, empCode, ...meta });
  return meta;
}

export const getEmployeeDocs = async (empCode: string): Promise<any[]> => {
  const all = await getData('employeeDocs') as any[];
  return all.filter(d => d.empCode === empCode);
}

export const deleteEmployeeDoc = async (docId: string, path: string): Promise<void> => {
  const { deleteData } = await import('./firebaseService');
  if (path) {
    try { await deleteObject(ref(storage, path)); } catch(e) { /* file may already be gone */ }
  }
  const { db } = await import('../firebase');
  const { doc, deleteDoc } = await import('firebase/firestore');
  await deleteDoc(doc(db, 'employeeDocs', docId));
}
