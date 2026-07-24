import Stripe from 'stripe';
import StripeWebhookEvent from '../models/StripeWebhookEvent';
import {
  applySubscriptionTierToUser,
  getStripeClient,
  isPaidCatalogTier,
  syncUserFromStripeSubscription,
} from './stripeBilling.service';

let lastWebhookReceivedAt: Date | null = null;
let lastWebhookEventType: string | null = null;

export async function getLastWebhookInfo(): Promise<{
  receivedAt: string | null;
  eventType: string | null;
}> {
  if (lastWebhookReceivedAt) {
    return {
      receivedAt: lastWebhookReceivedAt.toISOString(),
      eventType: lastWebhookEventType,
    };
  }

  const latest = await StripeWebhookEvent.findOne()
    .sort({ processedAt: -1 })
    .select('type processedAt')
    .lean();

  if (!latest) {
    return { receivedAt: null, eventType: null };
  }

  return {
    receivedAt: latest.processedAt.toISOString(),
    eventType: latest.type,
  };
}

async function isEventAlreadyProcessed(eventId: string): Promise<boolean> {
  const existing = await StripeWebhookEvent.findOne({ eventId }).lean();
  return existing != null;
}

async function markEventProcessed(event: Stripe.Event): Promise<void> {
  await StripeWebhookEvent.create({ eventId: event.id, type: event.type });
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const userId = session.metadata?.userId ?? session.client_reference_id;
  if (!userId) {
    console.warn('[stripe] checkout.session.completed without userId');
    return;
  }

  const metaTier = session.metadata?.tier;
  const tier = isPaidCatalogTier(metaTier) ? metaTier : null;
  if (!tier) {
    console.warn('[stripe] checkout.session.completed without valid tier metadata');
    return;
  }

  const customerId =
    typeof session.customer === 'string' ? session.customer : session.customer?.id;
  const subscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id;

  await applySubscriptionTierToUser(userId, tier, {
    stripeCustomerId: customerId ?? undefined,
    stripeSubscriptionId: subscriptionId ?? undefined,
    status: 'active',
  });
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const subscriptionId =
    typeof invoice.subscription === 'string'
      ? invoice.subscription
      : invoice.subscription?.id;
  if (!subscriptionId) return;

  const stripe = getStripeClient();
  if (!stripe) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = subscription.metadata?.userId;
  if (!userId) return;

  await applySubscriptionTierToUser(userId, 'BASIC', { status: 'inactive' });
}

async function dispatchWebhookHandler(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
      break;

    case 'customer.subscription.updated':
    case 'customer.subscription.created':
      await syncUserFromStripeSubscription(event.data.object as Stripe.Subscription);
      break;

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.userId;
      if (userId) {
        await applySubscriptionTierToUser(userId, 'BASIC', { status: 'cancelled' });
      }
      break;
    }

    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
      break;

    default:
      break;
  }
}

export async function processStripeWebhookEvent(event: Stripe.Event): Promise<void> {
  if (await isEventAlreadyProcessed(event.id)) {
    console.log('[stripe] duplicate event skipped:', event.id);
    return;
  }

  lastWebhookReceivedAt = new Date();
  lastWebhookEventType = event.type;

  await dispatchWebhookHandler(event);

  try {
    await markEventProcessed(event);
  } catch (err: unknown) {
    const code = (err as { code?: number })?.code;
    if (code === 11000) {
      console.log('[stripe] duplicate event skipped on mark:', event.id);
      return;
    }
    throw err;
  }
}
