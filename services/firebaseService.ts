import { db } from "../firebase"
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, setDoc } from "firebase/firestore"

export const addData = async (collectionName: string, data: any) => {
  // Deterministic doc IDs are useful so re-running an import upserts instead of
  // creating duplicates. The right key depends on the collection though:
  //   * employees      -> one doc per empCode
  //   * attendance     -> one doc per (empCode, date) pair  (otherwise every day
  //                       of a given employee's punches collapses into a single
  //                       document and the last write wins)
  // For everything else we fall back to whatever id/empCode the caller supplied,
  // and finally to an auto-generated id.
  let docId: string | null = null
  if (collectionName === 'attendance') {
    const code = data.empCode || data.employeeCode || data.employeeId
    const date = data.date
    if (code && date) docId = String(cod