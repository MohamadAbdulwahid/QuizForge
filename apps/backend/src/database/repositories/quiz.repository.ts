import { and, desc, eq } from 'drizzle-orm';
import { db } from '../client';
import { QUESTION, QUIZ } from '../schema/quiz';

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
 * @returns Created quiz row.
 */
export async function create(data: {
  title: string;
  description?: string;
  creatorId: string;
  shareCode: string;
}): Promise<QUIZ> {
  const result = await db
    .insert(QUIZ)
    .values({
      title: data.title,
      description: data.description,
      creator_id: data.creatorId,
      share_code: data.shareCode,
    })
    .returning();

  return result[0];
}

/**
 * Updates quiz title/description.
 * @param id - Quiz id.
 * @param data - Partial update payload.
 * @param data.title - New title.
 * @param data.description - New description.
 * @returns Updated quiz or null when not found.
 */
export async function update(
  id: number,
  data: { title?: string; description?: string }
): Promise<QUIZ | null> {
  const fieldsToUpdate: Partial<Pick<QUIZ, 'title' | 'description'>> = {};

  if (data.title !== undefined) {
    fieldsToUpdate.title = data.title;
  }
  if (data.description !== undefined) {
    fieldsToUpdate.description = data.description;
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
