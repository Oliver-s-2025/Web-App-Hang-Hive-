/*
  ============================================================
  FIREBASE CONFIGURATION - firebase.js
  ============================================================
  This file initializes Firebase and Firestore for the app.
  Firestore is used to store all data in the cloud.
*/

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDItpOIhs7aOn2S_TNqttL0R3XiaYvY_Sw",
  authDomain: "hanghive-2ac23.firebaseapp.com",
  projectId: "hanghive-2ac23",
  storageBucket: "hanghive-2ac23.firebasestorage.app",
  messagingSenderId: "79057180950",
  appId: "1:79057180950:web:5a33ee53ee6fbdf5e39837",
  measurementId: "G-WRCD270F8L"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore (database)
const db = getFirestore(app);

// Export the database so other files can use it
export { db, app };
