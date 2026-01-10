/**
 * Firebase initialization
 *
 * This file initializes Firebase and exports auth and firestore instances.
 *
 * Environment-aware implementation:
 * - Uses Firebase Admin SDK (with full permissions) when running in Node.js server
 * - Uses Firebase Client SDK (with user auth) when running in browser/mobile
 *
 * Configuration is loaded from environment variables.
 * See env.example for required variables.
 */

// Load environment variables from .env file (for test scripts)
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// Detect environment
// Check if running in Node.js (not browser)
const isNode =
  typeof process !== "undefined" &&
  process.versions != null &&
  process.versions.node != null;

let useAdminSDK = false;

// Type definitions for unified exports
type Auth = any; // Will be firebase/auth Auth or null for admin
type Firestore = any; // Will be firebase/firestore Firestore or firebase-admin Firestore

let auth: Auth = null;
let db: Firestore = null;
let fireBaseRemoteConfig: any = null;
let initialized = false;

/**
 * Initialize Firebase (lazy initialization)
 * This function is called automatically when auth or db is first accessed
 */
function initializeFirebase(): void {
  if (initialized) {
    return;
  }

  initialized = true;

  const hasAdminCredentials =
    process.env.FIREBASE_BACKEND_SERVICE_ACCOUNT_client_email;

  useAdminSDK = !!(isNode && hasAdminCredentials);

  if (useAdminSDK) {
    // ============================================================================
    // SERVER-SIDE: Use Firebase Admin SDK
    // ============================================================================
    console.log("Initializing Firebase Admin SDK for server-side use");

    // Dynamic import to avoid bundling issues
    const admin = require("firebase-admin");

    try {
      // Check if app is already initialized
      if (admin.apps.length === 0) {
        // Load from environment variables
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_BACKEND_SERVICE_ACCOUNT_project_id,
            privateKey:
              process.env.FIREBASE_BACKEND_SERVICE_ACCOUNT_private_key?.replace(
                /\\n/g,
                "\n"
              ),
            clientEmail:
              process.env.FIREBASE_BACKEND_SERVICE_ACCOUNT_client_email,
          }),
          projectId: process.env.FIREBASE_BACKEND_SERVICE_ACCOUNT_project_id,
        });
      }

      db = admin.firestore();

      // Configure Firestore settings
      db.settings({
        ignoreUndefinedProperties: true,
      });

      fireBaseRemoteConfig = admin.remoteConfig();

      console.log("Firestore Admin initialized successfully");
    } catch (error: any) {
      console.error("Failed to initialize Firebase Admin:", error.message);
      throw error;
    }

    // Auth is not available in Admin SDK context
    auth = null;
  } else {
    throw new Error("Firebase not initialized");
  }
}

// Use Proxy to provide lazy initialization
const authProxy = new Proxy(
  {},
  {
    get(target, prop) {
      if (!initialized) {
        initializeFirebase();
      }
      return auth ? (auth as any)[prop] : null;
    },
  }
) as Auth;

const dbProxy = new Proxy(
  {},
  {
    get(target, prop) {
      if (!initialized) {
        initializeFirebase();
      }
      if (!db) {
        throw new Error("Firestore not initialized");
      }
      return (db as any)[prop];
    },
    apply(target, thisArg, argumentsList) {
      if (!initialized) {
        initializeFirebase();
      }
      if (!db) {
        throw new Error("Firestore not initialized");
      }
      return (db as any).apply(thisArg, argumentsList);
    },
  }
) as Firestore;

const fireBaseRemoteConfigProxy = new Proxy(
  {},
  {
    get(target, prop) {
      if (!initialized) {
        initializeFirebase();
      }
      if (!fireBaseRemoteConfig) {
        throw new Error("Remote Config not initialized");
      }
      return (fireBaseRemoteConfig as any)[prop];
    },
    apply(target, thisArg, argumentsList) {
      if (!initialized) {
        initializeFirebase();
      }
      if (!fireBaseRemoteConfig) {
        throw new Error("Remote Config not initialized");
      }
      return (fireBaseRemoteConfig as any).apply(thisArg, argumentsList);
    },
  }
) as any;

// Export the proxied instances
export {
  authProxy as auth,
  dbProxy as db,
  fireBaseRemoteConfigProxy as fireBaseRemoteConfig,
};

// Export a flag to check which SDK is being used
export { useAdminSDK as isUsingAdminSDK };
