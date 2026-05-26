import { z } from 'zod';

// First zod schemas in the codebase. Use these as the template when adding
// validation to the remaining group / user / workout / message endpoints —
// see backend/src/middleware/validate.ts for usage.

export const checkInBodySchema = z.object({
  latitude: z.number().finite().gte(-90).lte(90),
  longitude: z.number().finite().gte(-180).lte(180),
});

export type CheckInBody = z.infer<typeof checkInBodySchema>;

// Bounded coordinate window so a forged coordinate can't reach over the
// whole planet. Real check-ins are validated against group.location too.
export const adminGeocodedBodySchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  groupType: z.enum(['public_community', 'private_community', 'bootcamp', 'athletic_team']),
  visibility: z.enum(['public', 'private']).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(120).optional(),
  state: z.string().max(120).optional(),
  country: z.string().max(120).optional(),
  radiusMeters: z.number().int().positive().lte(10_000).optional(),
});

export type AdminGeocodedBody = z.infer<typeof adminGeocodedBodySchema>;
