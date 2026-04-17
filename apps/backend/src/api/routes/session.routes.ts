import { Router } from 'express';
import { sessionController } from '../controllers/session.controller';
import {
  CreateSessionRequestSchema,
  PinParamSchema,
  UpdateSessionStatusSchema,
} from '../dtos/session.dto';
import { authMiddleware } from '../middleware/auth';
import { validateBody, validateParams } from '../middleware/validation';

export const sessionRouter = Router();

sessionRouter.post(
  '/',
  authMiddleware,
  validateBody(CreateSessionRequestSchema),
  sessionController.createSession
);
sessionRouter.get('/mine', authMiddleware, sessionController.getMySessions);
sessionRouter.get('/:pin', validateParams(PinParamSchema), sessionController.getSessionByPin);
sessionRouter.patch(
  '/:pin/status',
  authMiddleware,
  validateParams(PinParamSchema),
  validateBody(UpdateSessionStatusSchema),
  sessionController.updateSessionStatus
);
