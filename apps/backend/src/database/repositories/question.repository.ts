import { and, eq } from 'drizzle-orm';
import { db } from '../client';
import { insertQuestion, QUESTION } from '../schema/quiz';

/**
 * Returns all questions for a quiz ordered by order_index ASC.
 * @param quizId - Quiz id.
 * @returns Ordered questions array.
 */
export async function findByQuizId(quizId: number): Promise<QUESTION[]> {
  return db
    .select()
    .from(QUESTION)
    .where(eq(QUESTION.quiz_id, quizId))
    .orderBy(QUESTION.order_index);
}

/**
 * Returns a question by id.
 * @param id - Question id.
 * @returns Question or null.
 */
export async function findById(id: number): Promise<QUESTION | null> {
  const result = await db.select().from(QUESTION).where(eq(QUESTION.id, id)).limit(1);
  return result[0] ?? null;
}

/**
 * Creates a single question.
 * @param data - Question insert payload.
 * @returns Created question row.
 */
export async function create(data: insertQuestion): Promise<QUESTION> {
  const result = await db.insert(QUESTION).values(data).returning();
  return result[0];
}

/**
 * Bulk creates questions for quiz in one transaction.
 * @param quizId - Quiz id.
 * @param questions - Question list without quiz_id.
 * @returns Created question rows.
 */
export async function createMany(
  quizId: number,
  questions: Omit<insertQuestion, 'quiz_id'>[]
): Promise<QUESTION[]> {
  if (questions.length === 0) {
    return [];
  }

  const valuesToInsert = questions.map((question, index) => ({
    ...question,
    quiz_id: quizId,
    order_index: index,
  }));

  return db.transaction(async (tx) => {
    return tx.insert(QUESTION).values(valuesToInsert).returning();
  });
}

/**
 * Updates question fields.
 * @param id - Question id.
 * @param data - Update payload.
 * @returns Updated question row or null.
 */
export async function update(
  id: number,
  data: Partial<
    Pick<QUESTION, 'text' | 'type' | 'options' | 'correct_answer' | 'time_limit' | 'points'>
  >
): Promise<QUESTION | null> {
  const result = await db.update(QUESTION).set(data).where(eq(QUESTION.id, id)).returning();
  return result[0] ?? null;
}

/**
 * Deletes question by id.
 * @param id - Question id.
 * @returns True when deleted.
 */
export async function deleteQuestion(id: number): Promise<boolean> {
  const result = await db.delete(QUESTION).where(eq(QUESTION.id, id)).returning();
  return result.length > 0;
}

/**
 * Deletes all questions for a quiz.
 * @param quizId - Quiz id.
 * @returns Number of deleted rows.
 */
export async function deleteByQuizId(quizId: number): Promise<number> {
  const result = await db.delete(QUESTION).where(eq(QUESTION.quiz_id, quizId)).returning();
  return result.length;
}

/**
 * Reorders quiz questions atomically.
 * @param quizId - Quiz id.
 * @param orderedIds - Ordered question ids.
 */
export async function reorder(quizId: number, orderedIds: number[]): Promise<void> {
  await db.transaction(async (tx) => {
    for (let index = 0; index < orderedIds.length; index += 1) {
      await tx
        .update(QUESTION)
        .set({ order_index: index })
        .where(and(eq(QUESTION.quiz_id, quizId), eq(QUESTION.id, orderedIds[index])));
    }
  });
}
