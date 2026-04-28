import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDAwLYZtFeHUrHVVOM_VO01kjmtetBBCtQ",
  authDomain: "hrms-factory.firebaseapp.com",
  projectId: "hrms-factory",
  storageBucket: "hrms-factory.firebasestorage.app",
  messagingSenderId: "621141789787",
  appId: "1:621141789787:web:cb25f6cc62b7f43baa837e",
  measurementId: "G-TDNQEKPB50"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
