/**
 * User management for web app
 */

import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  type Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import type { User } from "firebase/auth";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
  lastLoginAt: Timestamp | string;
}

/**
 * Create or update a user document in Firestore
 * This should be called after successful authentication
 */
export async function createOrUpdateUser(user: User): Promise<void> {
  const userRef = doc(db, "users", user.uid);

  // Check if user document already exists
  const userDoc = await getDoc(userRef);

  if (userDoc.exists()) {
    // User exists, update last login time
    await setDoc(
      userRef,
      {
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        updatedAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      },
      { merge: true }
    );
  } else {
    // New user, create document
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    });
  }
}

/**
 * Get a user's profile from Firestore
 */
export async function getUserProfile(
  userId: string
): Promise<UserProfile | null> {
  const userRef = doc(db, "users", userId);
  const userDoc = await getDoc(userRef);

  if (!userDoc.exists()) {
    return null;
  }

  return userDoc.data() as UserProfile;
}
