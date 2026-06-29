import { createChildLogger } from '../../config/logger';
import * as questionRepository from '../../database/repositories/question.repository';
import * as quizRepository from '../../database/repositories/quiz.repository';
import type { QUESTION, QUIZ } from '../../database/schema/quiz';
import { ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors';
import { generateUniqueShareCode } from '../../shared/utils/share-code';
import type {
  CreateQuizRequest,
  DiscoverQuizSummary,
  DiscoverQuizzesQuery,
  DiscoverQuizzesResponse,
  UpdateQuizRequest,
} from '../dtos/quiz.dto';

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
    visibility: data.visibility ?? 'unlisted',
    status: data.status ?? 'published',
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
    visibility: data.visibility,
    status: data.status,
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
 * Returns quiz details with questions for an owner, OR for any authenticated
 * user when the quiz is public+published (so they can host it from the
 * discover feed). Drafts, private, and unlisted quizzes return 404 to
 * non-owners — we do not leak the existence of hidden quizzes.
 *
 * For non-owners, `correct_answer` is stripped from each question so the
 * caller can't read the answer key.
 * @param quizId - Quiz id.
 * @param userId - Authenticated user id.
 * @returns Quiz and questions (with correct_answer stripped for non-owners).
 */
export async function getQuizById(
  quizId: number,
  userId: string
): Promise<QUIZ & { questions: QUESTION[] }> {
  const quiz = await quizRepository.findByIdWithQuestions(quizId);

  if (!quiz) {
    throw new NotFoundError('Quiz not found', 'QUIZ_NOT_FOUND');
  }

  const isOwner = quiz.creator_id === userId;
  const isPubliclyHostable = quiz.status === 'published' && quiz.visibility === 'public';

  if (!isOwner && !isPubliclyHostable) {
    throw new NotFoundError('Quiz not found', 'QUIZ_NOT_FOUND');
  }

  if (isOwner) {
    return quiz;
  }

  // Non-owner of a public+published quiz: strip `correct_answer` from each
  // question and strip the owner's `creator_id` from the quiz payload.
  const { creator_id: _ownerId, ...publicQuiz } = quiz;
  void _ownerId;
  const strippedQuestions = quiz.questions.map(
    ({ correct_answer: _correctAnswer, ...question }) => question
  );
  return { ...publicQuiz, questions: strippedQuestions };
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
 * Draft and private quizzes are invisible to non-owners — we 404 instead of 403
 * so the share code does not leak the existence of hidden quizzes.
 * @param shareCode - Share code.
 * @returns Quiz for public preview.
 */
export async function getQuizByShareCode(shareCode: string): Promise<QuizWithPublicQuestions> {
  const quiz = await quizRepository.findByShareCode(shareCode);

  if (!quiz) {
    throw new NotFoundError('Quiz not found', 'QUIZ_NOT_FOUND');
  }

  if (quiz.status === 'draft' || quiz.visibility === 'private') {
    throw new NotFoundError('Quiz not found', 'QUIZ_NOT_FOUND');
  }

  const publicQuiz = { ...quiz };
  delete (publicQuiz as { creator_id?: unknown }).creator_id;
  return {
    ...publicQuiz,
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
 * Loads a quiz for AI transformation (remix/translate). Unlike `getQuizById`,
 * this requires the caller to be the owner — non-owners cannot remix/translate
 * a quiz they don't own (per the current QuizForge product scope).
 *
 * Returns the full quiz (with correct_answer) so the AI has the answer key
 * to work with when generating replacements.
 *
 * @param quizId - Source quiz id.
 * @param userId - Authenticated user id.
 * @returns Quiz with questions.
 * @throws NotFoundError when the quiz doesn't exist.
 * @throws ForbiddenError when the user is not the owner.
 */
export async function getOwnedQuiz(
  quizId: number,
  userId: string
): Promise<QUIZ & { questions: QUESTION[] }> {
  const quiz = await quizRepository.findByIdWithQuestions(quizId);

  if (!quiz) {
    throw new NotFoundError('Quiz not found', 'QUIZ_NOT_FOUND');
  }

  if (quiz.creator_id !== userId) {
    throw new ForbiddenError('You can only transform your own quizzes', 'QUIZ_NOT_OWNED');
  }

  if (quiz.questions.length === 0) {
    throw new NotFoundError('Source quiz has no questions to transform', 'QUIZ_EMPTY');
  }

  return quiz;
}

/**
 * Computes the title prefix for an AI-transformed quiz.
 * - "remix"     → "[Remix] {original}"
 * - "translate" → "[{Language name}] {original}"
 *
 * Caps the result at 200 characters (the `quiz.title` Zod max).
 */
export function transformTitle(
  originalTitle: string,
  transformationType: 'remix' | 'translate',
  languageName?: string
): string {
  const prefix =
    transformationType === 'remix' ? '[Remix]' : languageName ? `[${languageName}]` : '[Translated]';
  const candidate = `${prefix} ${originalTitle}`;
  return candidate.length > 200 ? candidate.slice(0, 200) : candidate;
}

/**
 * Creates a new quiz as an AI transformation of a source quiz. The new quiz
 * inherits the source's visibility/status (defaulting to `unlisted` /
 * `published`) but is owned by the calling user. Lineage fields
 * (`parent_quiz_id`, `transformation_type`, `language`) are persisted.
 *
 * Used by both the AI remixer and translator endpoints.
 *
 * @param params - Transformation parameters.
 * @param params.creatorId - The user creating the new quiz (becomes the owner).
 * @param params.sourceQuiz - The quiz being remixed/translated (lineage parent).
 * @param params.questions - Validated QuestionInput list to persist on the new quiz.
 * @param params.transformationType - 'remix' or 'translate' — written to `transformation_type` column.
 * @param params.languageCode - BCP-47 code of the new quiz content (e.g. 'en', 'es').
 * @param params.languageName - Optional human-readable language name used in titles/descriptions.
 * @returns Created quiz and its freshly generated share code.
 */
export async function createTransformedQuiz(params: {
  creatorId: string;
  sourceQuiz: QUIZ;
  questions: ReadonlyArray<{
    text: string;
    type: import('../dtos/quiz.dto').QuestionType;
    options: unknown;
    correct_answer: string | null;
    time_limit: number | null;
    points: number;
  }>;
  transformationType: 'remix' | 'translate';
  languageCode: string;
  languageName?: string;
}): Promise<{ quiz: QUIZ; shareCode: string }> {
  const shareCode = await generateUniqueShareCode();

  const quiz = await quizRepository.create({
    title: transformTitle(
      params.sourceQuiz.title,
      params.transformationType,
      params.languageName
    ),
    description: params.sourceQuiz.description
      ? prependLineageDescription(
          params.sourceQuiz.description,
          params.transformationType,
          params.languageName ?? params.languageCode
        )
      : undefined,
    creatorId: params.creatorId,
    shareCode,
    visibility: params.sourceQuiz.visibility,
    status: params.sourceQuiz.status,
    parentQuizId: params.sourceQuiz.id,
    transformationType: params.transformationType,
    language: params.languageCode,
  });

  await import('../../database/repositories/question.repository').then(
    async ({ createMany }) => {
      await createMany(
        quiz.id,
        params.questions.map((question) => ({
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
  );

  quizServiceLogger.info(
    {
      newQuizId: quiz.id,
      sourceQuizId: params.sourceQuiz.id,
      creatorId: params.creatorId,
      transformationType: params.transformationType,
      language: params.languageCode,
    },
    'Transformed quiz created'
  );

  return { quiz, shareCode };
}

/**
 * Prepends a one-line lineage header to the description of a transformed
 * quiz so the user can see at a glance where it came from.
 */
function prependLineageDescription(
  original: string,
  transformationType: 'remix' | 'translate',
  target: string
): string {
  const header =
    transformationType === 'remix'
      ? `Remixed from the original quiz.`
      : `Translated to ${target} from the original quiz.`;
  const combined = `${header}\n\n${original}`;
  return combined.length > 2000 ? combined.slice(0, 2000) : combined;
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

/**
 * Returns a paginated feed of public, published quizzes for the discover page.
 * Joins the creator profile and counts questions per quiz in parallel.
 * @param query - Discover query (query string, sort, limit, offset).
 * @returns Paginated quiz summaries with creator info and question counts.
 */
export async function searchPublicQuizzes(
  query: DiscoverQuizzesQuery
): Promise<DiscoverQuizzesResponse> {
  const [rows, total] = await Promise.all([
    quizRepository.searchPublicQuizzes(query),
    quizRepository.countPublicQuizzes(query.query),
  ]);
  const ids = rows.map((r) => r.id);
  const counts = await Promise.all(ids.map((id) => questionRepository.findByQuizId(id)));
  const items: DiscoverQuizSummary[] = rows.map((row, i) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    question_count: counts[i].length,
    creator: row.creator
      ? {
          user_id: row.creator.userId,
          username: row.creator.username,
          display_name: row.creator.username,
        }
      : null,
    play_count: row.play_count,
    created_at: row.created_at.toISOString(),
    share_code: row.share_code ?? '',
  }));
  return { items, total, limit: query.limit, offset: query.offset };
}

/**
 * Atomically increments the play_count counter for a quiz.
 * Thin pass-through used by session creation; never throws to callers.
 * @param quizId - Quiz id to increment.
 */
export async function incrementQuizPlayCount(quizId: number): Promise<void> {
  await quizRepository.incrementPlayCount(quizId);
}
