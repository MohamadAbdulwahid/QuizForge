import { Router } from 'express';
import { quizController } from '../controllers/quiz.controller';
import { AiGenerateRequestSchema } from '../dtos/ai-generate.dto';
import {
  DiscoverQuizzesQuerySchema,
  QuizIdParamSchema,
  ShareCodeParamSchema,
  CreateQuizRequestSchema,
  UpdateQuizRequestSchema,
} from '../dtos/quiz.dto';
import { validateBody, validateParams } from '../middleware/validation';

export const quizPublicRouter = Router();
export const quizRouter = Router();

quizPublicRouter.get(
  '/share/:shareCode',
  validateParams(ShareCodeParamSchema),
  quizController.getQuizByShareCode
);

quizPublicRouter.get(
  '/discover',
  (req, res, next) => {
    const parsed = DiscoverQuizzesQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: parsed.error.issues,
      });
      return;
    }
    next();
  },
  quizController.discoverQuizzes
);

quizRouter.post('/', validateBody(CreateQuizRequestSchema), quizController.createQuiz);
quizRouter.post(
  '/ai-generate',
  validateBody(AiGenerateRequestSchema),
  quizController.aiGenerateQuiz
);
quizRouter.get('/', quizController.getMyQuizzes);
quizRouter.get('/:id', validateParams(QuizIdParamSchema), quizController.getQuizById);
quizRouter.patch(
  '/:id',
  validateParams(QuizIdParamSchema),
  validateBody(UpdateQuizRequestSchema),
  quizController.updateQuiz
);
quizRouter.delete('/:id', validateParams(QuizIdParamSchema), quizController.deleteQuiz);
