import type { FastifyPluginAsync } from "fastify";
import type Stripe from "stripe";
import type { RelevxUserProfile, CreateProfileResponse, Plan } from "core";
import { getPlans } from "./products.js";
import { gFreePlanId } from "../utils/billing.js";

// API key management routes: create/list/revoke. All routes rely on the auth
// plugin to populate req.userId and tenant authorization.
const routes: FastifyPluginAsync = async (app) => {
  const firebase = app.firebase;
  const db = firebase.db;
  const stripe = app.stripe as Stripe;
  const remoteConfig = firebase.remoteConfig;

  app.get("/healthz", async (_req, rep) => {
    return rep.send({ ok: true });
  });

  app.post(
    "/create-or-update",
    { preHandler: [app.rlPerRoute(10)] },
    async (req: any, rep) => {
      try {
        const userId = req.user?.uid;
        if (!userId) {
          return rep
            .status(401)
            .send({ error: { message: "Unauthenticated" } });
        }

        // Create or update user document in Firestore
        const userRef = db.collection("users").doc(userId);

        const userDoc = await userRef.get();
        const user = await firebase.auth.getUser(userId);
        let response: CreateProfileResponse;
        if (!userDoc.exists) {
          const customer = await stripe.customers.create({
            email: user.email,
            phone: user.phoneNumber,
            name: user.displayName,
          });

          const userData: RelevxUserProfile = {
            email: user.email || "",
            displayName: user.displayName || "",
            photoURL: user.photoURL || null,
            phoneNumber: user.phoneNumber || null,
            planId: gFreePlanId, // free plan
            freeTrailRedeemed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
            billing: {
              stripeSubscriptionId: "",
              stripeCustomerId: customer.id,
            },
          };

          // New user, create document
          await userRef.set(userData);

          const { billing, ...userResponse } = userData;
          response = {
            ...userResponse,
            ok: true,
          };
        } else {
          const userData = userDoc.data() as RelevxUserProfile;
          if (!userData) {
            return rep
              .status(404)
              .send({ error: { message: "User not found" } });
          }

          // Build update object with only the fields we want to change
          const updateFields: any = {
            updatedAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
          };

          // check to see if user has valid stripe customer id
          if (
            !userData.billing.stripeCustomerId ||
            (await stripe.customers.retrieve(userData.billing.stripeCustomerId))
              .lastResponse.statusCode !== 200
          ) {
            const customer = await stripe.customers.create({
              email: user.email,
              phone: user.phoneNumber,
              name: user.displayName,
            });
            updateFields["billing.stripeCustomerId"] = customer.id;
          }

          // check users subscriptions
          const active_subscriptions = await stripe.subscriptions.list({
            customer: userData.billing.stripeCustomerId,
            status: "active",
          });

          if (active_subscriptions.data.length > 0) {
            const plans: Plan[] = await getPlans(remoteConfig);
            plans.sort((a, b) => b.precedence - a.precedence);
            for (const plan of plans) {
              const subscription = active_subscriptions.data.find(
                (s) =>
                  s.items.data[0].price.id === plan.infoStripeSubscriptionId
              );
              if (subscription) {
                updateFields.planId = plan.id;
                updateFields["billing.stripeSubscriptionId"] = subscription.id;
                break;
              }
            }
          } else {
            updateFields.planId = gFreePlanId;
            updateFields["billing.stripeSubscriptionId"] = "";
          }

          // Update user document in Firestore
          await userRef.update(updateFields);

          const { billing, ...userResponse } = userData;
          response = {
            ...userResponse,
            ok: true,
          };
        }

        return rep.status(200).send(response);
      } catch (err: any) {
        const isDev = process.env.NODE_ENV !== "production";
        const detail = err instanceof Error ? err.message : String(err);
        req.log?.error({ detail }, "/user/auth/create-or-update failed");
        return rep.status(500).send({
          error: {
            code: "internal_error",
            message: "User create or update failed",
            ...(isDev ? { detail } : {}),
          },
        });
      }
    }
  );
};

export default routes;
