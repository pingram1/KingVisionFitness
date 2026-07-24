import mongoose, { Document, Schema } from 'mongoose';

export interface IStripeWebhookEvent extends Document {
  eventId: string;
  type: string;
  processedAt: Date;
}

const stripeWebhookEventSchema = new Schema<IStripeWebhookEvent>(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    type: { type: String, required: true },
    processedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

const StripeWebhookEvent = mongoose.model<IStripeWebhookEvent>(
  'StripeWebhookEvent',
  stripeWebhookEventSchema
);

export default StripeWebhookEvent;
