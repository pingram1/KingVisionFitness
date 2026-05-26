import dotenv from 'dotenv';
import { z } from 'zod';

// Single source of truth for environment configuration.
// Importing this module loads .env, validates required vars, and exports a
// typed `env` object. Boot fails fast (process.exit(1)) on missing or weak
// values so production cannot run with the legacy hardcoded JWT fallbacks.

dotenv.config();

const isProd = process.env.NODE_ENV === 'production';

// Secrets must be at least 32 chars in production; relaxed (16) in non-prod so
// local developers can keep shorter dev secrets without breaking the boot guard.
const secretMin = isProd ? 32 : 16;

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5001),

  MONGODB_URI: z
    .string()
    .min(1, 'MONGODB_URI is required')
    .refine((v) => v.startsWith('mongodb://') || v.startsWith('mongodb+srv://'), {
      message: 'MONGODB_URI must start with mongodb:// or mongodb+srv://',
    }),

  JWT_SECRET: z
    .string()
    .min(secretMin, `JWT_SECRET must be at least ${secretMin} characters`)
    .refine((v) => v !== 'your-secret-key', {
      message: 'JWT_SECRET cannot be the legacy placeholder value',
    }),
  JWT_REFRESH_SECRET: z
    .string()
    .min(secretMin, `JWT_REFRESH_SECRET must be at least ${secretMin} characters`)
    .refine((v) => v !== 'your-refresh-secret', {
      message: 'JWT_REFRESH_SECRET cannot be the legacy placeholder value',
    }),

  // Default access TTL dropped from 30d → 15m. Silent refresh on the client
  // exchanges the long-lived refresh token for a fresh access token.
  // TTL must match jsonwebtoken's parser: digits + s/m/h/d suffix (no spaces,
  // no compound durations). A typo like `30 days` or `30D` is rejected at
  // boot so we can't silently mint long-lived tokens.
  JWT_ACCESS_TTL: z
    .string()
    .regex(/^\d+(s|m|h|d)$/, 'JWT_ACCESS_TTL must match ms-style format e.g. "15m", "1h", "7d"')
    .default('15m'),
  JWT_REFRESH_TTL: z
    .string()
    .regex(/^\d+(s|m|h|d)$/, 'JWT_REFRESH_TTL must match ms-style format e.g. "30d"')
    .default('30d'),

  CLIENT_URL: z.string().url().default('http://localhost:3000'),
  APP_URL: z.string().url().default('http://localhost:5001'),

  // Stripe is stubbed today; webhook secret is only required once
  // STRIPE_SECRET_KEY is set. Both optional at this layer to keep the
  // billing scaffold runnable locally.
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // Required header secret for /api/billing/dev-upgrade. The previous guard
  // (NODE_ENV !== 'production') is preserved as an additional gate; this
  // header makes the route useless to a leaked dev build by default.
  DEV_BYPASS_SECRET: z.string().min(secretMin).optional(),

  SENDGRID_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().optional(),

  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error(
    '\n❌ Environment validation failed:\n' +
      parsed.error.issues
        .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('\n') +
      '\n\nSee backend/.env.example for required variables.\n'
  );
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;

// Cross-field assertion: if Stripe is configured for live use, webhook secret
// must also be set. Caught here rather than at first webhook delivery.
if (env.STRIPE_SECRET_KEY && !env.STRIPE_WEBHOOK_SECRET) {
  // eslint-disable-next-line no-console
  console.error(
    '\n❌ STRIPE_SECRET_KEY is set but STRIPE_WEBHOOK_SECRET is not.\n' +
      '   Webhooks cannot be verified without this — refusing to start.\n'
  );
  process.exit(1);
}
