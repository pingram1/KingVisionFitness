import Stripe from 'stripe';
import { env } from '../config/env';
import { TIER_CATALOG, type SubscriptionCatalogTier } from '../config/tierCatalog';
import User, { type IUser, type SubscriptionTier } from '../models/User';

export type PaidCatalogTier = Exclude<SubscriptionCatalogTier, 'BASIC'>;

const PAID_TIERS: readonly PaidCatalogTier[] = ['SPECIFIED', 'ACTIVE_CLIENT'];

export function isPaidCatalogTier(value: unknown): value is PaidCatalogTier {
  return typeof value === 'string' && (PAID_TIERS as readonly string[]).includes(value);
}

function stripeMode(secretKey: string | undefined): 'test' | 'live' | 'disabled' {
  if (!secretKey) return 'disabled';
  if (secretKey.startsWith('sk_live_')) return 'live';
  return 'test';
}

export function getStripeClient(): Stripe | null {
  if (!env.STRIPE_SECRET_KEY) return null;
  return new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16' as Stripe.LatestApiVersion,
  });
}

export function isStripeConfigured(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET);
}

export function isStripeCheckoutReady(): boolean {
  return (
    isStripeConfigured() &&
    Boolean(env.STRIPE_PRICE_ID_SPECIFIED && env.STRIPE_PRICE_ID_ACTIVE_CLIENT)
  );
}

export function getStripeDashboardUrl(): string {
  const mode = stripeMode(env.STRIPE_SECRET_KEY);
  if (mode === 'live') return 'https://dashboard.stripe.com/dashboard';
  return 'https://dashboard.stripe.com/test/dashboard';
}

export function getStripeMode(): 'test' | 'live' | 'disabled' {
  return stripeMode(env.STRIPE_SECRET_KEY);
}

function priceIdForTier(tier: PaidCatalogTier): string | undefined {
  if (tier === 'SPECIFIED') return env.STRIPE_PRICE_ID_SPECIFIED;
  if (tier === 'ACTIVE_CLIENT') return env.STRIPE_PRICE_ID_ACTIVE_CLIENT;
  return undefined;
}

function legacySubscriptionTier(tier: SubscriptionTier): 'standard' | 'active-client' {
  return tier === 'ACTIVE_CLIENT' ? 'active-client' : 'standard';
}

export async function getOrCreateStripeCustomer(user: IUser): Promise<string> {
  const stripe = getStripeClient();
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  if (user.subscription?.stripeCustomerId) {
    return user.subscription.stripeCustomerId;
  }

  const customer = await stripe.customers.create({
    email: user.email,
    name: `${user.profile.firstName} ${user.profile.lastName}`.trim(),
    metadata: { userId: String(user._id) },
  });

  user.subscription = user.subscription ?? {
    tier: 'standard',
    status: 'trial',
  };
  user.subscription.stripeCustomerId = customer.id;
  await user.save();

  return customer.id;
}

export async function createCheckoutSession(
  user: IUser,
  tier: PaidCatalogTier
): Promise<{ checkoutUrl: string; sessionId: string }> {
  const stripe = getStripeClient();
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  const priceId = priceIdForTier(tier);
  if (!priceId) {
    throw new Error(`Stripe price ID is not configured for tier ${tier}`);
  }

  const customerId = await getOrCreateStripeCustomer(user);
  const catalogEntry = TIER_CATALOG[tier];

  const successUrl =
    env.STRIPE_SUCCESS_URL ?? 'kingvisionfitness://billing/success?session_id={CHECKOUT_SESSION_ID}';
  const cancelUrl = env.STRIPE_CANCEL_URL ?? 'kingvisionfitness://billing/cancel';

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
    client_reference_id: String(user._id),
    metadata: {
      userId: String(user._id),
      tier,
    },
    subscription_data: {
      metadata: {
        userId: String(user._id),
        tier,
      },
    },
  });

  if (!session.url) {
    throw new Error('Stripe did not return a checkout URL');
  }

  return { checkoutUrl: session.url, sessionId: session.id };
}

export async function createBillingPortalSession(
  user: IUser
): Promise<{ portalUrl: string }> {
  const stripe = getStripeClient();
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  const customerId = await getOrCreateStripeCustomer(user);
  const returnUrl = env.STRIPE_SUCCESS_URL ?? `${env.CLIENT_URL}/profile`;

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  if (!session.url) {
    throw new Error('Stripe did not return a billing portal URL');
  }

  return { portalUrl: session.url };
}

/** Map Stripe metadata / price to our product tier. */
export function resolveTierFromMetadata(
  metadata: Stripe.Metadata | null | undefined,
  priceId?: string | null
): SubscriptionTier | null {
  const metaTier = metadata?.tier;
  if (isPaidCatalogTier(metaTier)) return metaTier;
  if (metaTier === 'BASIC') return 'BASIC';

  if (priceId && env.STRIPE_PRICE_ID_SPECIFIED && priceId === env.STRIPE_PRICE_ID_SPECIFIED) {
    return 'SPECIFIED';
  }
  if (
    priceId &&
    env.STRIPE_PRICE_ID_ACTIVE_CLIENT &&
    priceId === env.STRIPE_PRICE_ID_ACTIVE_CLIENT
  ) {
    return 'ACTIVE_CLIENT';
  }

  return null;
}

export async function applySubscriptionTierToUser(
  userId: string,
  tier: SubscriptionTier,
  opts: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    status?: IUser['subscription']['status'];
    currentPeriodEnd?: Date;
  } = {}
): Promise<IUser | null> {
  const user = await User.findById(userId);
  if (!user) return null;

  user.subscriptionTier = tier;
  user.subscription = user.subscription ?? { tier: 'standard', status: 'trial' };
  user.subscription.tier = legacySubscriptionTier(tier);
  user.subscription.status = opts.status ?? (tier === 'BASIC' ? 'cancelled' : 'active');

  if (opts.stripeCustomerId) user.subscription.stripeCustomerId = opts.stripeCustomerId;
  if (opts.stripeSubscriptionId) user.subscription.stripeSubscriptionId = opts.stripeSubscriptionId;
  if (opts.currentPeriodEnd) user.subscription.currentPeriodEnd = opts.currentPeriodEnd;

  if (tier === 'BASIC') {
    user.subscription.stripeSubscriptionId = undefined;
  }

  await user.save();
  return user;
}

export async function syncUserFromStripeSubscription(
  subscription: Stripe.Subscription
): Promise<IUser | null> {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    console.warn('[stripe] subscription missing userId metadata:', subscription.id);
    return null;
  }

  const priceId = subscription.items.data[0]?.price?.id;
  const tier =
    resolveTierFromMetadata(subscription.metadata, priceId) ??
    (subscription.status === 'active' || subscription.status === 'trialing'
      ? 'ACTIVE_CLIENT'
      : null);

  if (!tier) {
    console.warn('[stripe] could not resolve tier for subscription:', subscription.id);
    return null;
  }

  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id;

  let status: IUser['subscription']['status'] = 'active';
  if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
    status = 'cancelled';
  } else if (subscription.status === 'past_due') {
    status = 'inactive';
  } else if (subscription.status === 'trialing') {
    status = 'trial';
  }

  if (subscription.status === 'canceled' || subscription.status === 'incomplete_expired') {
    return applySubscriptionTierToUser(userId, 'BASIC', {
      stripeCustomerId: customerId,
      status: 'cancelled',
    });
  }

  return applySubscriptionTierToUser(userId, tier, {
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    status,
    currentPeriodEnd: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000)
      : undefined,
  });
}
