import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';

/**
 * Validates req.body against a Zod schema.
 * @param schema - Zod schema for request body.
 * @returns Express middleware.
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: parsed.error.issues,
      });
      return;
    }

    req.body = parsed.data;
    next();
  };
}

/**
 * Validates req.params against a Zod schema.
 * @param schema - Zod schema for route params.
 * @returns Express middleware.
 */
export function validateParams<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.params);

    if (!parsed.success) {
      res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: parsed.error.issues,
      });
      return;
    }

    req.params = parsed.data as Request['params'];
    next();
  };
}
