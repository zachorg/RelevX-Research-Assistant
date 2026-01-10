import fp from "fastify-plugin";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getRemoteConfig } from "firebase-admin/remote-config";

export default fp(async (app: any) => {
  const certObject =
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON &&
    JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);

  if (!certObject) {
    throw new Error("Firebase service account JSON not found");
  }
  // Firebase Admin app instance
  const firebaseApp = initializeApp({
    credential: cert(certObject),
    projectId: certObject.project_id,
  });

  // Services
  const auth = getAuth(firebaseApp);
  const db = getFirestore(firebaseApp);
  const remoteConfig = getRemoteConfig(firebaseApp); // use ESM import, no require

  if (!auth || !db || !remoteConfig) {
    throw new Error(
      "Failed to initialize Firebase Admin Auth, DB, or Remote Config"
    );
  } else {
    app.log.info("Firebase Admin initialized successfully");
  }

  // Decorate Fastify instance
  app.decorate("firebase", { auth, db, remoteConfig });

  // ID token introspection
  app.decorate("introspectIdToken", async (token: string) => {
    if (!token) {
      app.log.error("Missing token");
      return null;
    }
    try {
      const authToken = token.startsWith("Bearer ")
        ? token.slice(7).trim()
        : token;
      const decodedToken = await auth.verifyIdToken(authToken);
      const uid = decodedToken.uid;
      const email = decodedToken.email;
      const emailVerified = decodedToken.email_verified || false;

      return {
        user: { uid, email, emailVerified },
      };
    } catch (error) {
      throw new Error(
        `Invalid Firebase ID token (${token}): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  });
});
