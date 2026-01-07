import type { FastifyPluginAsync } from "fastify";
import type Stripe from "stripe";
import type {
  BillingPortalLinkResponse,
  BillingPaymentLinkResponse,
  RelevxUserProfile,
  Plan,
} from "core";

// API key management routes: create/list/revoke. All routes rely on the auth
// plugin to populate req.userId and tenant authorization.
const routes: FastifyPluginAsync = async (app) => {
  const firebase = app.firebase;
  const db = firebase.db;
  const stripe = app.stripe as Stripe;

  app.get("/healthz", async (_req, rep) => {
    return rep.send({ ok: true });
  });

  app.get(
    "/payment-link",
    { preHandler: [app.rlPerRoute(10)] },
    async (req: any, rep) => {
      try {
        const userId = req.user?.uid;
        if (!userId) {
          return rep.status(401).send({ error: { message: "Unauthenticated" } });
        }
        const planId = (req.headers as any).planId;
        if (!planId) {
          return rep.status(400).send({ error: { message: "Plan ID is required" } });
        }
        const planDoc = await db.collection("plans").doc(planId).get();
        if (!planDoc.exists) {
          return rep.status(404).send({ error: { message: "Plan not found" } });
        }
        const planData = planDoc.data() as Plan;
        if (!planData) {
          return rep.status(404).send({ error: { message: "Plan not found" } });
        }

        // Create or update user document in Firestore
        const userRef = db.collection("users").doc(userId);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
          return rep.status(404).send({ error: { message: "User not found" } });
        }

        const userData = userDoc.data() as RelevxUserProfile;

        // Check if user has an active subscription -- if so, return error
        const active_subscriptions = await stripe.subscriptions.list({
          customer: userData.billing.stripeCustomerId,
          status: "active",
        });

        active_subscriptions.data = active_subscriptions.data.filter((s) => s.items.data.some((i) => i.price.id !== "price_1SdeOZ2HZ4FTsWfQlJwnnqM9"));

        const hasActiveSubscription = active_subscriptions.data.find((s) => s.id === planData.infoStripeSubscriptionId) !== undefined;
        if (hasActiveSubscription) {
          return rep.status(404).send({ errorCode: "plan_already_active", error: { message: "User already has an active subscription to this plan" } });
        }

        if (active_subscriptions.data.length > 0) {
          return rep.status(404).send({ errorCode: "plan_already_active", error: { message: "User already has an active subscription plan. Please unsubscribe to current to start a new plan." } });
        }

        let sessionUrl = null;
        if (planData.infoName === "Free Trial") {
          const session = await stripe.checkout.sessions.create({
            mode: "subscription",
            customer: userData.billing.stripeCustomerId,
            customer_update: { address: "auto" },
            payment_method_collection: "if_required",
            allow_promotion_codes: false,
            phone_number_collection: { enabled: false },
            tax_id_collection: { enabled: false },
            automatic_tax: { enabled: false },
            subscription_data: {
              trial_period_days: 7,
              trial_settings: {
                end_behavior: {
                  missing_payment_method: "cancel",
                },
              },
            },
            // payment_method_options: { card: { setup_future_usage: "on_session" } },
            line_items: [
              { price: planData.infoStripeSubscriptionId, quantity: 1 },
            ],
            metadata: {
              userId: userId,
              planId: planId,
            },
            // @TODO: Update this to use the actual success and cancel URLs
            success_url: "https://relevx.ai/pricing?success=true",
            cancel_url: "https://relevx.ai/pricing?success=false",
          });

          if (!session) {
            return rep
              .status(500)
              .send({ error: { message: "Failed to create checkout session" } });
          }
          sessionUrl = session.url;
        }
        else {
          const session = await stripe.checkout.sessions.create({
            mode: "subscription",
            customer: userData.billing.stripeCustomerId,
            customer_update: { address: "auto" },
            // payment_method_options: { card: { setup_future_usage: "on_session" } },
            line_items: [
              { price: planData.infoStripeSubscriptionId, quantity: 1 },
            ],
            metadata: {
              userId: userId,
              planId: planId,
            },
            // @TODO: Update this to use the actual success and cancel URLs
            success_url: "https://relevx.ai/pricing?success=true",
            cancel_url: "https://relevx.ai/pricing?success=false",
          });

          if (!session) {
            return rep
              .status(500)
              .send({ error: { message: "Failed to create checkout session" } });
          }
          sessionUrl = session.url;
        }

        return rep.status(200).send({
          ok: true,
          stripePaymentLink: sessionUrl,
        } as BillingPaymentLinkResponse);
      } catch (err: any) {
        const isDev = process.env.NODE_ENV !== "production";
        const detail = err instanceof Error ? err.message : String(err);
        req.log?.error({ detail }, "/billing/payment-link failed");
        return rep.status(500).send({
          error: {
            code: "internal_error",
            message: "Billing payment link failed",
            ...(isDev ? { detail } : {}),
          },
        });
      }
    }
  );

  app.get(
    "/portal",
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

        if (!userDoc.exists) {
          return rep.status(404).send({ error: { message: "User not found" } });
        }

        const userData = userDoc.data() as RelevxUserProfile;
        if (!userData.billing.stripeCustomerId) {
          return rep.status(400).send({ error: { message: "User is not a stripe customer" } });
        }

        const session = await stripe.billingPortal.sessions.create({
          customer: userData.billing.stripeCustomerId,
          return_url: "https://relevx.ai/projects",
        });

        if (!session) {
          return rep
            .status(500)
            .send({ error: { message: "Failed to create checkout session" } });
        }

        return rep.status(200).send({
          ok: true,
          stripeBillingPortalLink: session.url,
        } as BillingPortalLinkResponse);
      } catch (err: any) {
        const isDev = process.env.NODE_ENV !== "production";
        const detail = err instanceof Error ? err.message : String(err);
        req.log?.error({ detail }, "/billing/portal failed");
        return rep.status(500).send({
          error: {
            code: "internal_error",
            message: "Billing portal link failed",
            ...(isDev ? { detail } : {}),
          },
        });
      }
    }
  );
};

export default routes;
