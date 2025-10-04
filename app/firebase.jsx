// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import {getFirestore} from "firebase/firestore"
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBjfPS9z-KBPCv-QQMZhU-Puf3461a2BFU",
  authDomain: "cashatabod.firebaseapp.com",
  projectId: "cashatabod",
  storageBucket: "cashatabod.firebasestorage.app",
  messagingSenderId: "422137345819",
  appId: "1:422137345819:web:df9513752c0722172545be"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app)