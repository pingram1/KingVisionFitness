/**
 * "Keys to the Castle" — promote (or demote) a user to a specific platform role.
 *
 * Usage:
 *   npm --prefix kingvision-fitness/backend run promote -- <email> <role>
 *
 *   role ∈ { SUPER_ADMIN | TRAINER | CLIENT }
 *
 * Examples:
 *   npm --prefix kingvision-fitness/backend run promote -- owner@kingvisionfitness.com SUPER_ADMIN
 *   npm --prefix kingvision-fitness/backend run promote -- coach@example.com TRAINER
 *   npm --prefix kingvision-fitness/backend run promote -- ex-coach@example.com CLIENT
 *
 * The script is idempotent and prints the user's role before/after.
 */

import path from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

import User, { USER_ROLES, type UserRole } from '../src/models/User';

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/kingvision-fitness';

function parseArgs(): { email: string; role: UserRole } {
  const [, , rawEmail, rawRole] = process.argv;

  if (!rawEmail || !rawRole) {
    console.error(
      'Usage: ts-node scripts/promoteUser.ts <email> <role>\n' +
        `  role ∈ { ${USER_ROLES.join(' | ')} }`
    );
    process.exit(1);
  }

  const email = rawEmail.trim().toLowerCase();
  const role = rawRole.trim().toUpperCase() as UserRole;

  if (!(USER_ROLES as readonly string[]).includes(role)) {
    console.error(
      `Invalid role "${rawRole}". Expected one of: ${USER_ROLES.join(', ')}`
    );
    process.exit(1);
  }

  return { email, role };
}

async function run() {
  const { email, role } = parseArgs();

  console.log(`[promote] Connecting to ${MONGODB_URI}`);
  await mongoose.connect(MONGODB_URI);

  const user = await User.findOne({ email });
  if (!user) {
    console.error(`[promote] No user found for email "${email}"`);
    process.exitCode = 1;
    return;
  }

  const previousRole = user.role;
  if (previousRole === role) {
    console.log(`[promote] User ${email} is already ${role}. No change.`);
    return;
  }

  user.role = role;
  await user.save();

  console.log(
    `[promote] ${email}: ${previousRole} -> ${role}  (userId=${user._id.toString()})`
  );
  console.log(
    '[promote] User must log out and log back in to refresh their JWT with the new role claim.'
  );
}

run()
  .catch((err) => {
    console.error('[promote] FAILED', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
