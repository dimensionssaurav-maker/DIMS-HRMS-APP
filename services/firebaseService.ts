import { db } from "../firebase"
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, setDoc } from "firebase/firestore"

export const addData = async (collectionName: string, data: any) => {
  const docId = data.empCode || data.id || data.employeeCode
  if (docId) {
    const ref = doc(db, collectionName, String(docId))
    return await setDoc(ref, data, { merge: true })
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
