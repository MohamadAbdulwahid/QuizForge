import { createChildLogger } from '../../config/logger';
import * as questionRepository from '../../database/repositories/question.repository';
import * as quizRepository from '../../database/repositories/quiz.repository';
import type { QUESTION, QUIZ } from '../../database/schema/quiz';
import { ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors';
import { generateUniqueShareCode } from '../../shared/utils/share-code';
import type { CreateQuizRequest, UpdateQuizRequest } from '../dtos/quiz.dto';

const quizServiceLogger = createChildLogger('quiz-service');

export type PublicQuestion = Omit<QUESTION, 'correct_answer'>;
export type QuizWithPublicQuestions = Omit<QUIZ, 'creator_id'> & { questions: PublicQuestion[] };

/**
 * Creates a quiz and its questions.
 * @param creatorId - Creator id from JWT.
 * @param data - Create payload.
 * @returns Created quiz and share code.
 */
export async function createQuiz(
  creatorId: string,
  data: CreateQuizRequest
): Promise<{ quiz: QUIZ; shareCode: string }> {
  const shareCode = await generateUniqueShareCode();

  const quiz = await quizRepository.create({
    title: data.title,
    description: data.description,
    creatorId,
    shareCode,
  });

  await questionRepository.createMany(
    quiz.id,
    data.questions.map((question) => ({
      text: question.text,
      type: question.type,
      options: question.options ?? [],
      correct_answer: question.correct_answer,
      time_limit: question.time_limit,
      points: question.points,
      order_index: 0,
    }))
  );

  quizServiceLogger.info({ quizId: quiz.id, creatorId }, 'Quiz created');

  return {
    quiz,
    shareCode,
  };
}

/**
 * Updates quiz metadata and optionally replaces questions.
 * @param quizId - Quiz id.
 * @param userId - Authenticated user id.
 * @param data - Update payload.
 * @returns Updated quiz.
 */
export async function updateQuiz(
  quizId: number,
  userId: string,
  data: UpdateQuizRequest
): Promise<QUIZ> {
  const existingQuiz = await quizRepository.findById(quizId);

  if (!existingQuiz) {
    throw new NotFoundError('Quiz not found', 'QUIZ_NOT_FOUND');
  }

  if (existingQuiz.creator_id !== userId) {
    throw new ForbiddenError('You do not own this quiz', 'QUIZ_FORBIDDEN');
  }

  await quizRepository.update(quizId, {
    title: data.title,
    description: data.description,
  });

  if (data.questions) {
    await questionRepository.deleteByQuizId(quizId);
    await questionRepository.createMany(
      quizId,
      data.questions.map((question) => ({
        text: question.text,
        type: question.type,
        options: question.options ?? [],
        correct_answer: question.correct_answer,
        time_limit: question.time_limit,
        points: question.points,
        order_index: 0,
      }))
    );
  }

  const updatedQuiz = await quizRepository.findById(quizId);

  if (!updatedQuiz) {
    throw new NotFoundError('Quiz not found after update', 'QUIZ_NOT_FOUND');
  }

  return updatedQuiz;
}

/**
 * Deletes a quiz with ownership guard.
 * @param quizId - Quiz id.
 * @param userId - Authenticated user id.
 */
export async function deleteQuiz(quizId: number, userId: string): Promise<void> {
  const existingQuiz = await quizRepository.findById(quizId);

  if (!existingQuiz) {
    throw new NotFoundError('Quiz not found', 'QUIZ_NOT_FOUND');
  }

  if (existingQuiz.creator_id !== userId) {
    throw new ForbiddenError('You do not own this quiz', 'QUIZ_FORBIDDEN');
  }

  await quizRepository.deleteQuiz(quizId);
}

/**
 * Returns quiz details with questions for an owner.
 * @param quizId - Quiz id.
 * @param userId - Authenticated user id.
 * @returns Quiz and questions.
 */
export async function getQuizById(
  quizId: number,
  userId: string
): Promise<QUIZ & { questions: QUESTION[] }> {
  const quiz = await quizRepository.findByIdWithQuestions(quizId);

  if (!quiz) {
    throw new NotFoundError('Quiz not found', 'QUIZ_NOT_FOUND');
  }

  if (quiz.creator_id !== userId) {
    throw new ForbiddenError('You do not own this quiz', 'QUIZ_FORBIDDEN');
  }

  return quiz;
}

/**
 * Returns quizzes for creator with question count.
 * @param creatorId - Creator id.
 * @returns Quizzes with question count.
 */
export async function getQuizzesByCreator(
  creatorId: string
): Promise<Array<QUIZ & { questionCount: number }>> {
  const quizzes = await quizRepository.findByCreator(creatorId);

  const withQuestionCount = await Promise.all(
    quizzes.map(async (quiz) => {
      const questions = await questionRepository.findByQuizId(quiz.id);
      return {
        ...quiz,
        questionCount: questions.length,
      };
    })
  );

  return withQuestionCount;
}

/**
 * Returns a quiz by share code with answers stripped.
 * @param shareCode - Share code.
 * @returns Quiz for public preview.
 */
export async function getQuizByShareCode(shareCode: string): Promise<QuizWithPublicQuestions> {
  const quiz = await quizRepository.findByShareCode(shareCode);

  if (!quiz) {
    throw new NotFoundError('Quiz not found', 'QUIZ_NOT_FOUND');
  }

  return {
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    share_code: quiz.share_code,
    created_at: quiz.created_at,
    questions: quiz.questions.map(({ correct_answer: _correctAnswer, ...question }) => question),
  };
}

/**
 * Ensures an owner does not already have an active session for same quiz.
 * @param quizId - Quiz id.
 * @param userId - User id.
 */
export async function assertQuizOwnership(quizId: number, userId: string): Promise<void> {
  const quiz = await quizRepository.findById(quizId);

  if (!quiz) {
    throw new NotFoundError('Quiz not found', 'QUIZ_NOT_FOUND');
  }

  if (quiz.creator_id !== userId) {
    throw new ForbiddenError('You do not own this quiz', 'QUIZ_FORBIDDEN');
  }
}

/**
 * Creates quiz with collision-protected share code and maps collision to conflict.
 * @param creatorId - creator id.
 * @param data - payload.
 * @returns create result.
 */
export async function createQuizWithCollisionGuard(
  creatorId: string,
  data: CreateQuizRequest
): Promise<{ quiz: QUIZ; shareCode: string }> {
  try {
    return await createQuiz(creatorId, data);
  } catch (error) {
    if (error instanceof Error && error.message.includes('unique share code')) {
      throw new ConflictError('Unable to generate unique share code', 'SHARE_CODE_COLLISION');
    }
    throw error;
  }
}
