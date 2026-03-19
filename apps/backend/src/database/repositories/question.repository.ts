import { db } from "../client";
import { insertQuestion, QUESTION, QUIZ } from "../schema/quiz";
import { eq, asc } from "drizzle-orm";


/**
 * Retrieves a quiz along with its associated questions ordered by order_index ASC.
 * @param quizId - The ID of the quiz to retrieve
 * @returns A quiz object with its questions if found, otherwise null
 */
async function findByQuizId(quizId: number): Promise<QUESTION[]>{
    const quizResult = await db.select().from(QUIZ).where(eq(QUIZ.id, quizId));
    
    if (quizResult.length === 0) {
        return null; 
    }
    
    const questions = await db
        .select()
        .from(QUESTION)
        .where(eq(QUESTION.quiz_id, quizId))
        .orderBy(asc(QUESTION.order_index));

    return questions;
}

/**
 * Retrieves a question by its ID.
 * @param id - The ID of the question to retrieve
 * @returns The question object if found, otherwise null
 */
async function findById(id: number): Promise<QUESTION | null>{
    const result = await db.select().from(QUESTION).where(eq(QUESTION.id, id));

    if (result.length === 0) {
        return null; 
    }

    return result[0];
}

/**
 * Creates a new question.
 * @param data - The question data to insert
 * @returns The created question object
 */
async function create(data: insertQuestion): Promise<QUESTION>{
    const result = await db.insert(QUESTION).values(data).returning;

    return result[0];
}

/**
 * Bulk-inserts multiple questions within a transaction.
 * Auto-assigns order_index based on array position (0-based) and sets quiz_id on each.
 * @param quizId - The ID of the quiz to associate the questions with
 * @param questions - The array of questions to insert
 * @returns An array of created question objects
 */
async function createMany(quizId: number, questions: Omit<insertQuestion, 'quiz_id'>[]): Promise<QUESTION[]> {
    if (questions.length === 0) {
        return [];
    }

    const valuesToInsert = questions.map((q, index) => ({
        ...q,
        quiz_id: quizId,
        order_index: index,
    }));

    return await db.transaction(async (tx) => {
        return await tx.insert(QUESTION).values(valuesToInsert).returning();
    });
}

/**
 * Updates specific fields of a question.
 * @param id - The ID of the question to update
 * @param data - The fields to update
 * @returns The updated question object if found, otherwise null
 */
async function update(id: number, data: Partial<Pick<QUESTION, 'text' | 'type' | 'options' | 'correct_answer' | 'time_limit' | 'points'>>): Promise<QUESTION | null> {
    const result = await db.update(QUESTION)
        .set(data)
        .where(eq(QUESTION.id, id))
        .returning();

    if (result.length === 0) {
        return null;
    }

    return result[0];
}

/**
 * Deletes a question by its ID.
 * @param id - The ID of the question to delete
 * @returns True if the question was deleted, otherwise false
 */
async function deleteById(id: number): Promise<boolean> {
    const result = await db.delete(QUESTION)
        .where(eq(QUESTION.id, id))
        .returning();

    return result.length > 0;
}

/**
 * Deletes all questions associated with a specific quiz.
 * @param quizId - The ID of the quiz whose questions should be deleted
 * @returns The number of deleted questions
 */
async function deleteByQuizId(quizId: number): Promise<number> {
    const result = await db.delete(QUESTION)
        .where(eq(QUESTION.quiz_id, quizId))
        .returning();

    return result.length;
}

/**
 * Reorders questions for a quiz based on the provided order.
 * Updates the order_index for each question ID based on its position in the array.
 * @param quizId - The ID of the quiz whose questions should be reordered
 * @param orderedIds - The array of question IDs in the desired order
 */
async function reorder(quizId: number, orderedIds: number[]): Promise<void> {
    await db.transaction(async (tx) => {
        for (let i = 0; i < orderedIds.length; i++) {
            await tx.update(QUESTION)
                .set({ order_index: i })
                .where(eq(QUESTION.id, orderedIds[i]));
        }
    });
}

