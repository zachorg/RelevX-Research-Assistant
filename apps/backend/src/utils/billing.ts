import { RelevxUserProfile } from "core";
import Stripe from "stripe";

export const gFreePlanId = "7DZCFp1BMWuvtjroefNn";

export async function isUserSubscribed(
  user: RelevxUserProfile,
  stripe: Stripe
): Promise<boolean> {
  if (user.billing.stripeSubscriptionId !== "") {
    const subscription = await stripe.subscriptions.retrieve(
      user.billing.stripeSubscriptionId
    );
    if (
      subscription.status !== "active" &&
      subscription.status !== "trialing"
    ) {
      return false;
    }
    return true;
  }
  return false;
}
