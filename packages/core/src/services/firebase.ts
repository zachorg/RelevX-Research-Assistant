/**
 * Firebase initialization
 *
 * This file initializes the Firebase app and exports
 * the auth and firestore instances for use throughout the app.
 */

import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// TODO: Replace with your Firebase project configuration
// Get these values from Firebase Console > Project Settings > General
const firebaseConfig = {
  apiKey: "TODO-YOUR-API-KEY",
  authDomain: "TODO-YOUR-AUTH-DOMAIN",
  projectId: "TODO-YOUR-PROJECT-ID",
  storageBucket: "TODO-YOUR-STORAGE-BUCKET",
  messagingSenderId: "TODO-YOUR-MESSAGING-SENDER-ID",
  appId: "TODO-YOUR-APP-ID",
};

// Initialize Firebase (only once)
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

// Export auth and firestore instances
export const auth = getAuth(app);
export const db = getFirestore(app);
