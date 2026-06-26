import { Router, Request, Response } from 'express';
import { config } from '../../config/config';

export const configRouter = Router();

configRouter.get('/', (_req: Request, res: Response) => {
  res.json({
    supabaseUrl: config.SUPABASE_URL,
    supabasePublishableKey: config.SUPABASE_PUBLISHABLE_KEY,
    sentryDsn: config.SENTRY_DSN ?? '',
  });
});
