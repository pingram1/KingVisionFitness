import express, { Request, Response, Router } from 'express';
import Stripe from 'stripe';
import { env } from '../config/env';

// Stripe webhook router.
//
// CRITICAL: this router MUST be mounted BEFORE express.json() in server.ts.
// Stripe's signature verification reads the raw bytes of the request body.
// If express.json() runs first, req.body is parsed and the signature check
// will always fail (an exploit vector — never trust a webhook that "works"
// after JSON parsing).
//
// The handler is intentionally a thin scaffold today: it verifies the
// signature, logs the event, and 200s back. Subscription state transitions
// (checkout.session.completed, invoice.paid, customer.subscription.updated,
// etc.) are TODOs to be wired in PR #2 of the billing track.

const router: Router = express.Router();

const stripeClient = env.STRIPE_SECRET_KEY
  ? new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' as Stripe.LatestApiVersion })
  : null;

router.post(
  '/stripe',
  // Raw body parser scoped to this route only — every other route still uses JSON.
  express.raw({ type: 'application/json', limit: '1mb' }),
  async (req: Request, res: Response) => {
    if (!stripeClient || !env.STRIPE_WEBHOOK_SECRET) {
      // Webhooks aren't provisioned in this environment. Return 503 so Stripe
      // marks the delivery for retry rather than dropping it as 200/4xx.
      return res.status(503).json({
        success: false,
        message: 'Stripe webhooks are not configured on this server',
      });
    }

    const signature = req.header('stripe-signature');
    if (!signature) {
      return res.status(400).json({ success: false, message: 'Missing stripe-signature header' });
    }

    let event: Stripe.Event;
    try {
      event = stripeClient.webhooks.constructEvent(
        req.body as Buffer,
        signature,
        env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err: any) {
      console.error('[stripe] webhook signature verification failed:', err?.message);
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    // TODO(billing-pr): implement state transitions
    //   case 'checkout.session.completed':    activate ACTIVE_CLIENT
    //   case 'customer.subscription.updated': sync status
    //   case 'customer.subscription.deleted': downgrade to BASIC
    //   case 'invoice.payment_failed':        mark past_due, alert user
    console.log('[stripe] received event:', event.type, event.id);

    return res.json({ received: true });
  }
);

export default router;
