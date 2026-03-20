import { Router } from 'express';
import { sessionController } from '../controllers/session.controller';
import { CreateSessionRequestSchema } from '../dtos/session.dto';
import { validateBody } from '../middleware/validation';

export const sessionRouter = Router();

sessionRouter.post('/', validateBody(CreateSessionRequestSchema), sessionController.createSession);
