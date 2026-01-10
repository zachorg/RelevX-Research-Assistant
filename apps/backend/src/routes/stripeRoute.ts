import { Plan, RelevxUserProfile } from "core";
import type { FastifyPluginAsync } from "fastify";
import type Stripe from "stripe";
import { isUserSubscribed } from "../utils/billing.js";
import { getPlans } from "./products.js";

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
    "/checkout-completed",
    {
      config: {
        rawBody: true,
      },
    },
    async (request, rep) => {
      const sig = request.headers["stripe-signature"] as string;

      let event;
      try {
        if (!request.rawBody) {
          throw new Error("Missing raw body");
        }
        event = stripe.webhooks.constructEvent(
          request.rawBody,
          sig,
          process.env.STRIPE_WEBHOOK_SIGNING_SECRET!
        );
      } catch (err: any) {
        request.log.error(err);
        return rep.code(400).send(`Webhook Error: ${err.message}`);
      }

      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;

        const subscriptionId = session.subscription;
        const customerId = session.customer;
        const metadata = session.metadata;

        if (!metadata) {
          app.log.error("No Metadata found in Stripe Session Event");
        } else if (!metadata.userId) {
          app.log.error("No UserId in Metadata Stripe Session Event");
        } else if (!metadata.planId) {
          app.log.error("No Plan ID in Metadata Stripe Session Event");
        }

        if (metadata && metadata.planId && metadata.userId) {
          // Create or update user document in Firestore
          const userRef = db.collection("users").doc(metadata.userId);
          const userDoc = await userRef.get();

          const planData = (await getPlans(remoteConfig)).find(
            (plan) => plan.id === metadata.planId
          ) as Plan;
          if (!planData) {
            app.log.error(
              "Plan not found in Stripe Session Event or does not exist in firestore"
            );
          }

          if (!userDoc.exists) {
            app.log.error(
              "User not found in Stripe Session Event or does not exist in firestore"
            );
          } else {
            const userData = userDoc.data() as RelevxUserProfile;

            if (userData.billing.stripeCustomerId !== customerId) {
              app.log.error(
                "Users customer id does not match the stripe session customer id"
              );
            } else {
              const newUserData = {
                ...userData,
                planId: metadata.planId,
                freeTrailRedeemed:
                  userData.freeTrailRedeemed ||
                  planData.infoName === "Free Trial",
                updatedAt: new Date().toISOString(),
                billing: {
                  ...userData.billing,
                  stripeSubscriptionId: subscriptionId,
                },
              };

              // check to see if use has already subscribed to a different plan..
              if (await isUserSubscribed(userData, stripe)) {
              }

              if (
                !(await isUserSubscribed(
                  newUserData as RelevxUserProfile,
                  stripe
                ))
              ) {
                app.log.error("User is not subscribed");
              } else {
                // Update user document in Firestore
                await userRef.update(newUserData);
              }
            }

            app.log.info(
              `checkout.session.completed: ${JSON.stringify(session)}`
            );
          }
        }
      }

      return rep.send({ received: true });
    }
  );
};

export default routes;
