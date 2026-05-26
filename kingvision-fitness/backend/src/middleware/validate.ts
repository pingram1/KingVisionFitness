import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

// Generic zod request validator. Use this as the new standard for body
// validation instead of ad-hoc express-validator chains or raw req.body
// access. Schemas live under src/schemas/<feature>.schemas.ts.
//
//   router.post('/groups/:id/check-in',
//     auth,
//     validateBody(checkInSchema),
//     handler);

type ZodAny = ZodSchema<any>;

function formatZodIssues(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

export function validateBody<T extends ZodAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request body',
        errors: formatZodIssues(result.error),
      });
    }
    req.body = result.data;
    return next();
  };
}

export function validateParams<T extends ZodAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request parameters',
        errors: formatZodIssues(result.error),
      });
    }
    return next();
  };
}

export function validateQuery<T extends ZodAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid query parameters',
        errors: formatZodIssues(result.error),
      });
    }
    return next();
  };
}
