import fp from "fastify-plugin";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

export default fp(async (app: any) => {
  // Initialize Firebase Admin with service account credentials
  const firebaseApp = initializeApp(
    {
      credential: cert("apps/backend/relevx-service-account.json"),
    }
    //   {
    //   credential: cert({
    //     projectId: process.env.FIREBASE_BACKEND_SERVICE_ACCOUNT_project_id,
    //     privateKey: process.env.FIREBASE_BACKEND_SERVICE_ACCOUNT_private_key,
    //     clientEmail: process.env.FIREBASE_BACKEND_SERVICE_ACCOUNT_client_email,
    //   }),
    //   projectId: process.env.FIREBASE_BACKEND_SERVICE_ACCOUNT_project_id,
    // }
  );

  const auth = getAuth(firebaseApp);
  const db = getFirestore(firebaseApp);

  if (!auth || !db) {
    throw new Error("Failed to initialize Firebase Admin");
  } else {
    app.log.info("Firebase Admin initialized successfully");
  }

  app.decorate("firebase", { auth, db });

  app.decorate("introspectIdToken", async (token: string) => {
    try {
      const authToken = token.startsWith("Bearer ")
        ? token.slice(7).trim()
        : token;
      const decodedToken = await auth.verifyIdToken(authToken);
      const uid = decodedToken.uid;
      const email = decodedToken.email;
      const emailVerified = decodedToken.email_verified || false;

      // let user: any;
      let plan: any;
      try {
        // Get user document from Firestore
        const userDoc = await db.collection("users").doc(uid).get();
        if (userDoc.exists) {
          const userData = userDoc.data();

          // Get plan if user has one
          if (userData?.plan_id) {
            const planDoc = await db
              .collection("plans")
              .doc(userData.plan_id)
              .get();
            if (planDoc.exists) {
              const planData = planDoc.data();
              if (planData) {
                plan = planData;
              }
            }
          }
        }
      } catch (error) {
        // Log error but don't fail authentication
        app.log.warn(
          { error, uid },
          "Failed to fetch user data from Firestore"
        );
      }

      return {
        user: {
          uid,
          email,
          emailVerified,
          plan,
        },
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
