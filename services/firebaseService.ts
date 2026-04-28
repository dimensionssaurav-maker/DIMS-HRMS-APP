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
