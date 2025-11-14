/**
 * useAuth hook
 *
 * Provides the current authentication state across the app.
 * Subscribe to Firebase auth state and return user + loading status.
 */

import { useState, useEffect } from "react";
import type { User } from "firebase/auth";
import { subscribeToAuth } from "../services/auth";

interface UseAuthResult {
  user: User | null;
  loading: boolean;
}

export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToAuth((newUser) => {
      setUser(newUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return { user, loading };
}
