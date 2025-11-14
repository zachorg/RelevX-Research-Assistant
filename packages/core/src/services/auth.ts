/**
 * Authentication service
 *
 * Handles Google Sign-In and sign-out.
 * Platform-specific implementations handled via conditional logic.
 */

import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  User,
  onAuthStateChanged,
} from "firebase/auth";
import { auth } from "./firebase";

/**
 * Sign in with Google (web version using popup)
 *
 * For mobile: You'll want to use expo-auth-session or similar
 * to handle native OAuth flows. This is a simplified version
 * that works on web.
 */
export async function signInWithGoogle(): Promise<User | null> {
  try {
    const provider = new GoogleAuthProvider();

    // On web, use popup
    // TODO: For mobile, implement native Google Sign-In using expo-auth-session
    // or @react-native-google-signin/google-signin
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error) {
    console.error("Error signing in with Google:", error);
    throw error;
  }
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<void> {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error("Error signing out:", error);
    throw error;
  }
}

/**
 * Subscribe to auth state changes
 * Returns an unsubscribe function
 */
export function subscribeToAuth(
  callback: (user: User | null) => void
): () => void {
  return onAuthStateChanged(auth, callback);
}
