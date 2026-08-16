import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Kunci rahasia dari Google Cloud kamu
const firebaseConfig = {
  apiKey: "AIzaSyAt9qdF0qNPrlhk7YJVIewOADvtaOHi0bY",
  authDomain: "laporaman-81675.firebaseapp.com",
  projectId: "laporaman-81675",
  storageBucket: "laporaman-81675.firebasestorage.app",
  messagingSenderId: "375995093548",
  appId: "1:375995093548:web:5d518d48fbc77700033789"
};

// Nyalakan mesin Firebase
const app = initializeApp(firebaseConfig);

// Ekspor fungsi database biar bisa dipakai di halaman Lapor dan Dashboard
export const db = getFirestore(app);
export const auth = getAuth(app);