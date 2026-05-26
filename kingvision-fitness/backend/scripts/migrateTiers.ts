/**
 * One-shot migration: normalize subscriptionTier to UPPERCASE enum and rename
 * the legacy `coach_in_pocket` value to `ACTIVE_CLIENT`.
 *
 *   basic            -> BASIC
 *   specified        -> SPECIFIED
 *   coach_in_pocket  -> ACTIVE_CLIENT
 *
 * Also backfills `role` -> 'CLIENT' for any pre-RBAC documents.
 *
 * Idempotent: re-running after a successful migration is a no-op (matchedCount
 * will be zero for every step).
 *
 * Uses `updateMany` (bypasses schema validators on legacy values) and writes
 * directly via `User.collection` so the new strict enum on the model doesn't
 * reject the in-flight states.
 *
 * Run with:
 *   npm --prefix kingvision-fitness/backend run migrate:tiers
 */

import path from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

import User from '../src/models/User';

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/kingvision-fitness';

const TIER_MIGRATIONS: Array<{ from: string; to: 'BASIC' | 'SPECIFIED' | 'ACTIVE_CLIENT' }> = [
  { from: 'basic', to: 'BASIC' },
  { from: 'specified', to: 'SPECIFIED' },
  { from: 'coach_in_pocket', to: 'ACTIVE_CLIENT' },
];

async function run() {
  console.log('[migrate:tiers] Connecting to', MONGODB_URI);
  await mongoose.connect(MONGODB_URI);

  const collection = User.collection;
  let totalUpdated = 0;

  for (const { from, to } of TIER_MIGRATIONS) {
    const result = await collection.updateMany(
      { subscriptionTier: from },
      { $set: { subscriptionTier: to } }
    );
    console.log(
      `[migrate:tiers] ${from.padEnd(16)} -> ${to.padEnd(14)}  matched=${result.matchedCount} modified=${result.modifiedCount}`
    );
    totalUpdated += result.modifiedCount;
  }

  const missingTier = await collection.updateMany(
    { $or: [{ subscriptionTier: { $exists: false } }, { subscriptionTier: null }] },
    { $set: { subscriptionTier: 'BASIC' } }
  );
  console.log(
    `[migrate:tiers] (missing tier)    -> BASIC          matched=${missingTier.matchedCount} modified=${missingTier.modifiedCount}`
  );
  totalUpdated += missingTier.modifiedCount;

  const missingRole = await collection.updateMany(
    { $or: [{ role: { $exists: false } }, { role: null }] },
    { $set: { role: 'CLIENT' } }
  );
  console.log(
    `[migrate:tiers] (missing role)    -> CLIENT         matched=${missingRole.matchedCount} modified=${missingRole.modifiedCount}`
  );
  totalUpdated += missingRole.modifiedCount;

  const stragglers = await collection.countDocuments({
    subscriptionTier: { $nin: ['BASIC', 'SPECIFIED', 'ACTIVE_CLIENT'] },
  });
  if (stragglers > 0) {
    console.warn(
      `[migrate:tiers] WARNING: ${stragglers} user document(s) still have an unrecognized subscriptionTier — investigate manually.`
    );
  }

  console.log(`[migrate:tiers] Done. Total documents modified: ${totalUpdated}`);
}

run()
  .catch((err) => {
    console.error('[migrate:tiers] FAILED', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
