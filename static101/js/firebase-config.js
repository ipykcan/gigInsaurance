import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getFirestore,
    collection,
    addDoc,
    serverTimestamp,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    getDocs,
    query,
    where,
    orderBy,
    limit
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInAnonymously,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// TODO: REPlACE THIS OBJECT WITH YOUR ACTUAL FIREBASE CONFIG FROM THE CONSOLE!
const firebaseConfig = {
    apiKey: "AIzaSyDEYshAjoSYF3VW5A4H5KK1PJ9dR-vAiwk",
    authDomain: "fraud-detection-bf47b.firebaseapp.com",
    projectId: "fraud-detection-bf47b",
    storageBucket: "fraud-detection-bf47b.firebasestorage.app",
    messagingSenderId: "799797851573",
    appId: "1:799797851573:web:872c1498e26c5af6b995fc",
    measurementId: "G-321FB5MZP4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Export instances to be used in other files
export {
    app,
    db,
    auth,
    collection,
    addDoc,
    serverTimestamp,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    getDocs,
    query,
    where,
    orderBy,
    limit,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInAnonymously,
    onAuthStateChanged,
    signOut
};
