import express, { Request, Response, Router } from 'express';
import Stripe from 'stripe';
import { env } from '../config/env';
import { getStripeClient } from '../services/stripeBilling.service';
import { processStripeWebhookEvent } from '../services/stripeWebhook.service';

const router: Router = express.Router();

router.post(
  '/stripe',
  express.raw({ type: 'application/json', limit: '1mb' }),
  async (req: Request, res: Response) => {
    const stripeClient = getStripeClient();
    if (!stripeClient || !env.STRIPE_WEBHOOK_SECRET) {
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid signature';
      console.error('[stripe] webhook signature verification failed:', message);
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    try {
      await processStripeWebhookEvent(event);
      return res.json({ received: true });
    } catch (err) {
      console.error('[stripe] webhook handler failed:', event.type, event.id, err);
      return res.status(500).json({ success: false, message: 'Webhook handler failed' });
    }
  }
);

export default router;
