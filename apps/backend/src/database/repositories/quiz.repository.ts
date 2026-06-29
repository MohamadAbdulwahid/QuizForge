import { and, asc, count, desc, eq, ilike, sql } from 'drizzle-orm';
import { db } from '../client';
import { PROFILE } from '../schema/profile';
import { QUESTION, QUIZ, quizStatus, quizVisibility } from '../schema/quiz';
import type { quizTransformationType } from '../schema/quiz';

/**
 * A discoverable quiz row joined with the creator profile (may be null
 * if the creator's profile has been deleted).
 */
export type DiscoverableQuizRow = QUIZ & {
  creator: { userId: string; username: string } | null;
};

/** Sort options accepted by the discover feed. */
export type QuizSearchSort = 'newest' | 'popular' | 'alpha';

/**
 * Retrieves a single quiz by primary key.
 * @param quizId - The ID of the quiz to retrieve.
 * @returns The quiz record if found, otherwise null.
 */
export async function findById(quizId: number): Promise<QUIZ | null> {
  const result = await db.select().from(QUIZ).where(eq(QUIZ.id, quizId)).limit(1);
  return result[0] ?? null;
}

/**
 * Retrieves a quiz and all related questions ordered by order_index ASC.
 * @param quizId - The quiz ID.
 * @returns Quiz with its questions or null if not found.
 */
export async function findByIdWithQuestions(
  quizId: number
): Promise<(QUIZ & { questions: QUESTION[] }) | null> {
  const quiz = await findById(quizId);

  if (!quiz) {
    return null;
  }

  const questions = await db
    .select()
    .from(QUESTION)
    .where(eq(QUESTION.quiz_id, quizId))
    .orderBy(QUESTION.order_index);

  return {
    ...quiz,
    questions,
  };
}

/**
 * Finds quizzes for a creator ordered by newest first.
 * @param creatorId - The quiz creator id.
 * @returns Array of quizzes.
 */
export async function findByCreator(creatorId: string): Promise<QUIZ[]> {
  return db
    .select()
    .from(QUIZ)
    .where(eq(QUIZ.creator_id, creatorId))
    .orderBy(desc(QUIZ.created_at));
}

/**
 * Finds a quiz by share code and includes questions.
 * @param shareCode - Share code.
 * @returns Quiz with questions if found; otherwise null.
 */
export async function findByShareCode(
  shareCode: string
): Promise<(QUIZ & { questions: QUESTION[] }) | null> {
  const result = await db.select().from(QUIZ).where(eq(QUIZ.share_code, shareCode)).limit(1);

  if (result.length === 0) {
    return null;
  }

  const quiz = result[0];
  const questions = await db
    .select()
    .from(QUESTION)
    .where(eq(QUESTION.quiz_id, quiz.id))
    .orderBy(QUESTION.order_index);

  return {
    ...quiz,
    questions,
  };
}

/**
 * Creates a quiz row.
 * @param data - Create payload.
 * @param data.title - Quiz title.
 * @param data.description - Optional quiz description.
 * @param data.creatorId - Creator user id.
 * @param data.shareCode - Unique quiz share code.
 * @param data.visibility - Optional visibility override (defaults to schema default 'unlisted' when undefined).
 * @param data.status - Optional status override (defaults to schema default 'published' when undefined).
 * @param data.parentQuizId - Optional source quiz id (for AI remixes/translations).
 * @param data.transformationType - Optional AI transformation type ('remix' | 'translate').
 * @param data.language - Optional BCP-47 language tag of the quiz content (defaults to schema default 'en').
 * @returns Created quiz row.
 */
export async function create(data: {
  title: string;
  description?: string;
  creatorId: string;
  shareCode: string;
  visibility?: quizVisibility;
  status?: quizStatus;
  parentQuizId?: number;
  transformationType?: quizTransformationType;
  language?: string;
}): Promise<QUIZ> {
  const values: {
    title: string;
    description: string | undefined;
    creator_id: string;
    share_code: string;
    visibility?: quizVisibility;
    status?: quizStatus;
    parent_quiz_id?: number;
    transformation_type?: quizTransformationType;
    language?: string;
  } = {
    title: data.title,
    description: data.description,
    creator_id: data.creatorId,
    share_code: data.shareCode,
  };

  if (data.visibility !== undefined) {
    values.visibility = data.visibility;
  }
  if (data.status !== undefined) {
    values.status = data.status;
  }
  if (data.parentQuizId !== undefined) {
    values.parent_quiz_id = data.parentQuizId;
  }
  if (data.transformationType !== undefined) {
    values.transformation_type = data.transformationType;
  }
  if (data.language !== undefined) {
    values.language = data.language;
  }

  const result = await db.insert(QUIZ).values(values).returning();

  return result[0];
}

/**
 * Updates quiz title/description/visibility/status (any subset).
 * @param id - Quiz id.
 * @param data - Partial update payload.
 * @param data.title - New title.
 * @param data.description - New description.
 * @param data.visibility - New visibility.
 * @param data.status - New status.
 * @returns Updated quiz or null when not found.
 */
export async function update(
  id: number,
  data: {
    title?: string;
    description?: string;
    visibility?: quizVisibility;
    status?: quizStatus;
  }
): Promise<QUIZ | null> {
  const fieldsToUpdate: Partial<
    Pick<QUIZ, 'title' | 'description' | 'visibility' | 'status'>
  > = {};

  if (data.title !== undefined) {
    fieldsToUpdate.title = data.title;
  }
  if (data.description !== undefined) {
    fieldsToUpdate.description = data.description;
  }
  if (data.visibility !== undefined) {
    fieldsToUpdate.visibility = data.visibility;
  }
  if (data.status !== undefined) {
    fieldsToUpdate.status = data.status;
  }

  if (Object.keys(fieldsToUpdate).length === 0) {
    return findById(id);
  }

  const result = await db.update(QUIZ).set(fieldsToUpdate).where(eq(QUIZ.id, id)).returning();
  return result[0] ?? null;
}

/**
 * Deletes a quiz by id.
 * @param quizId - Quiz id.
 * @returns True when row deleted.
 */
export async function deleteQuiz(quizId: number): Promise<boolean> {
  const result = await db.delete(QUIZ).where(eq(QUIZ.id, quizId)).returning();
  return result.length > 0;
}

/**
 * Retrieves questions for a given quiz ordered by their index.
 * Used by the host session view to display quiz questions alongside session data.
 * @param quizId - The quiz ID.
 * @returns Array of questions ordered by order_index.
 */
export async function getQuestionsByQuizId(quizId: number): Promise<QUESTION[]> {
  return db
    .select()
    .from(QUESTION)
    .where(eq(QUESTION.quiz_id, quizId))
    .orderBy(QUESTION.order_index);
}

/**
 * Checks whether share code exists.
 * @param shareCode - Share code.
 * @returns True when an existing quiz uses the code.
 */
export async function shareCodeExists(shareCode: string): Promise<boolean> {
  const result = await db.select().from(QUIZ).where(eq(QUIZ.share_code, shareCode)).limit(1);
  return result.length > 0;
}

/**
 * Verifies if a quiz belongs to a creator.
 * @param quizId - Quiz id.
 * @param creatorId - Creator id.
 * @returns True when quiz belongs to creator.
 */
export async function belongsToCreator(quizId: number, creatorId: string): Promise<boolean> {
  const result = await db
    .select({ id: QUIZ.id })
    .from(QUIZ)
    .where(and(eq(QUIZ.id, quizId), eq(QUIZ.creator_id, creatorId)))
    .limit(1);

  return result.length > 0;
}

/**
 * Finds an existing transformation of a source quiz owned by a specific
 * creator. Used by the AI translate flow to short-circuit re-requests
 * (saves AI tokens and prevents duplicate translated quizzes).
 *
 * For translations, also matches on `language` to ensure we dedup the
 * specific (source, target language) pair — translating to Spanish twice
 * returns the same quiz; translating to French creates a new one.
 *
 * @param params - Lookup parameters.
 * @param params.parentQuizId - Source quiz id.
 * @param params.creatorId - Owner (transformer) user id.
 * @param params.transformationType - 'remix' | 'translate'.
 * @param params.language - For 'translate', the target language tag. Ignored for 'remix'.
 * @returns The existing transformed quiz, or null.
 */
export async function findByParentAndType(params: {
  parentQuizId: number;
  creatorId: string;
  transformationType: quizTransformationType;
  language?: string;
}): Promise<QUIZ | null> {
  const conditions = [
    eq(QUIZ.parent_quiz_id, params.parentQuizId),
    eq(QUIZ.creator_id, params.creatorId),
    eq(QUIZ.transformation_type, params.transformationType),
  ];

  if (params.transformationType === 'translate' && params.language !== undefined) {
    conditions.push(eq(QUIZ.language, params.language));
  }

  const result = await db
    .select()
    .from(QUIZ)
    .where(and(...conditions))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Search the public discover feed for published + public quizzes.
 * Optionally filters by case-insensitive substring on title. Joins the creator
 * profile for display name and username.
 *
 * The `status='published' AND visibility='public'` filter is enforced
 * server-side and is the security boundary for the discover feed — drafts,
 * private, and unlisted quizzes are never returned.
 *
 * @param params - Search parameters.
 * @param params.query - Free-text search term (trimmed; empty = no ilike).
 * @param params.sort - 'newest' (desc created_at), 'popular' (desc play_count
 *   then desc created_at), or 'alpha' (asc title).
 * @param params.limit - Page size.
 * @param params.offset - Page offset.
 * @returns Discoverable quiz rows with creator profile joined.
 */
export async function searchPublicQuizzes(params: {
  query: string;
  sort: QuizSearchSort;
  limit: number;
  offset: number;
}): Promise<DiscoverableQuizRow[]> {
  const normalizedQuery = params.query.trim();

  const visibilityPredicate = and(
    eq(QUIZ.status, 'published' as quizStatus),
    eq(QUIZ.visibility, 'public' as quizVisibility)
  );

  const whereClause = normalizedQuery
    ? and(visibilityPredicate, ilike(QUIZ.title, `%${normalizedQuery}%`))
    : visibilityPredicate;

  const orderByClause =
    params.sort === 'popular'
      ? [desc(QUIZ.play_count), desc(QUIZ.created_at)]
      : params.sort === 'alpha'
        ? [asc(QUIZ.title)]
        : [desc(QUIZ.created_at)];

  const rows = await db
    .select({
      id: QUIZ.id,
      title: QUIZ.title,
      description: QUIZ.description,
      visibility: QUIZ.visibility,
      status: QUIZ.status,
      play_count: QUIZ.play_count,
      creator_id: QUIZ.creator_id,
      share_code: QUIZ.share_code,
      created_at: QUIZ.created_at,
      creator_user_id: PROFILE.user_id,
      creator_username: PROFILE.username,
    })
    .from(QUIZ)
    .leftJoin(PROFILE, eq(QUIZ.creator_id, PROFILE.user_id))
    .where(whereClause)
    .orderBy(...orderByClause)
    .limit(params.limit)
    .offset(params.offset);

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    visibility: row.visibility,
    status: row.status,
    play_count: row.play_count,
    creator_id: row.creator_id,
    share_code: row.share_code,
    created_at: row.created_at,
    creator:
      row.creator_user_id && row.creator_username
        ? { userId: row.creator_user_id, username: row.creator_username }
        : null,
  }));
}

/**
 * Counts public, published quizzes matching the same search predicate as
 * {@link searchPublicQuizzes} (sans pagination / sort / join) for the
 * `total` field of the discover response.
 *
 * @param query - Free-text search term (trimmed; empty = no ilike).
 * @returns Total matching row count.
 */
export async function countPublicQuizzes(query: string): Promise<number> {
  const normalizedQuery = query.trim();

  const whereClause = normalizedQuery
    ? and(
        eq(QUIZ.status, 'published' as quizStatus),
        eq(QUIZ.visibility, 'public' as quizVisibility),
        ilike(QUIZ.title, `%${normalizedQuery}%`)
      )
    : and(eq(QUIZ.status, 'published' as quizStatus), eq(QUIZ.visibility, 'public' as quizVisibility));

  const result = await db.select({ value: count() }).from(QUIZ).where(whereClause);
  return result[0]?.value ?? 0;
}

/**
 * Atomically increments the play_count counter for a quiz.
 * Used by the session-creation flow to record public plays.
 *
 * @param quizId - Quiz id to increment.
 * @returns The updated quiz's id and new play_count, or null when the
 *   quiz does not exist.
 */
export async function incrementPlayCount(
  quizId: number
): Promise<{ id: number; playCount: number } | null> {
  const result = await db
    .update(QUIZ)
    .set({ play_count: sql`${QUIZ.play_count} + 1` })
    .where(eq(QUIZ.id, quizId))
    .returning({ id: QUIZ.id, playCount: QUIZ.play_count });

  return result[0] ?? null;
}
