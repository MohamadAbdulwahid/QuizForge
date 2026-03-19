/* eslint-disable @typescript-eslint/no-unused-vars */
import { QUIZ } from "../schema/quiz";
import { db } from "../client";
import { eq, asc } from "drizzle-orm";
import { QUESTION } from "../schema/quiz";

/**
 * Retrieves a single quiz by primary key.
 * @param quizId - The ID of the quiz to retrieve
 * @returns A single quiz object if found, otherwise null
 */
export async function findById(quizId: number): Promise<QUIZ | null> {
    const result = await db.select().from(QUIZ).where(eq(QUIZ.id, quizId));

    return result.length > 0 ? result[0] : null;
}

/**
 * Retrieves a quiz along with its associated questions ordered by order_index ASC.
 * @param quizId - The ID of the quiz to retrieve
 * @returns A quiz object with its questions if found, otherwise null
 */
export async function findByIdWithQuestions(quizId: number): Promise<(QUIZ & {questions:QUESTION[] })| null> {
    const quizResult = await db.select().from(QUIZ).where(eq(QUIZ.id, quizId));

    if (quizResult.length === 0) {
        return null;
    }

    const quiz = quizResult[0];

    const questions = await db
        .select()
        .from(QUESTION)
        .where(eq(QUESTION.quiz_id, quizId))
        .orderBy(asc(QUESTION.order_index));

    return{
        ...quiz,
        questions
    }
}

/**
 * Finds quizzes created by a specific creator.
 * @param creatorId - The ID of the creator
 * @returns An array of quizzes created by the specified creator
 */
async function findByCreator(creatorId: string): Promise<QUIZ[]> {
    const result = await db.select().from(QUIZ).orderBy(asc(QUIZ.created_at));

    if(result.length === 0){
        return null;
    }

    return result;
}

/**
 * Finds a quiz by its share code.
 * @param shareCode - The share code of the quiz
 * @returns A quiz object with its questions if found, otherwise null
 */
async function findByShareCode(shareCode: string): Promise<(QUIZ & { questions: QUESTION[] }) | null> {
    const quizResult = await db.select().from(QUIZ).where(eq(QUIZ.share_code, shareCode));

    if (quizResult.length === 0) {
        return null;
    }

    const quiz = quizResult[0];
    const questions = await db
        .select()
        .from(QUESTION)
        .where(eq(QUESTION.quiz_id, quiz.id))
        .orderBy(asc(QUESTION.order_index));

    return{
        ...quiz,
        questions
    }
}

/**
 * Updates a quiz by its ID.
 * @param id - The ID of the quiz to update
 * @param data - The fields to update (title and/or description)
 * @param data.title
 * @param data.description
 * @returns The updated quiz object if successful, otherwise null
 */
async function update(id: number, data: { title?: string; description?: string }): Promise<QUIZ | null> {
    const fieldsToUpdate: Partial<QUIZ> = {};

    if (data.title !== undefined) {
        fieldsToUpdate.title = data.title;
    }
    if (data.description !== undefined) {
        fieldsToUpdate.description = data.description;
    }

    const updatedQuiz = await db.update(QUIZ)
        .set(fieldsToUpdate)
        .where(eq(QUIZ.id, id))
        .returning();

    if (updatedQuiz.length === 0) {
        return null;
    }

    return updatedQuiz[0];
}

/**
 * Creates a new quiz in the database.
 * @param data - An object containing the title, optional description, creator ID, and share code of the quiz
 * @param data.title
 * @param data.description
 * @param data.creatorId
 * @param data.shareCode
 * @returns The created quiz object
 */
async function create(data: { title: string; description?: string; creatorId: string; shareCode: string }): Promise<QUIZ> {
    const createdQuiz = await db.insert(QUIZ).values({
        title: data.title,
        description: data.description,
        creator_id: data.creatorId,
        share_code: data.shareCode
    }).returning();

    return createdQuiz[0];
}

/**
 * Deletes a quiz by its ID.
 * @param quizId - The ID of the quiz to delete
 * @returns True if a row was deleted, otherwise false
 */
export async function deleteQuiz(quizId: number): Promise<boolean> {
    const deletedRows = await db.delete(QUIZ).where(eq(QUIZ.id, quizId)).returning();
    return deletedRows.length > 0;
}

/**
 * Checks if a quiz with the given share code exists.
 * @param shareCode - The share code to check
 * @returns True if a quiz with the share code exists, otherwise false
 */
async function shareCodeExists(shareCode: string): Promise<boolean>{
    const result = await db
        .select()
        .from(QUIZ)
        .where(eq(QUIZ.share_code, shareCode))
        .limit(1);
    return result.length > 0;
}
