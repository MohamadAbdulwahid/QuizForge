import { faker } from '@faker-js/faker';
import { db } from '../client';
import { QUIZ, QUESTION } from '../schema/quiz';
import { createChildLogger } from '../../config/logger';
import { eq } from 'drizzle-orm';

const seedLogger = createChildLogger('seed-quizzes');

/**
 * Generates a unique share code for a quiz
 *
 * @returns 8-character alphanumeric share code
 */
function generateShareCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Generates realistic quiz questions using faker
 *
 * @param count - Number of questions to generate
 * @returns Array of question insert objects
 */
function generateQuestions(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const isMultipleChoice = i % 2 === 0;
    const questionText = faker.lorem.sentence() + '?';

    if (isMultipleChoice) {
      const correctIndex = Math.floor(Math.random() * 4);
      const options = Array.from({ length: 4 }, (_, j) => ({
        id: String.fromCharCode(65 + j), // A, B, C, D
        text: faker.lorem.words(3),
      }));

      return {
        text: questionText,
        type: 'multiple-choice' as const,
        options,
        correct_answer: options[correctIndex].id,
        time_limit: 30,
        points: 100,
        order_index: i,
      };
    }

    return {
      text: questionText,
      type: 'true-false' as const,
      options: [
        { id: 'T', text: 'True' },
        { id: 'F', text: 'False' },
      ],
      correct_answer: Math.random() > 0.5 ? 'T' : 'F',
      time_limit: 20,
      points: 50,
      order_index: i,
    };
  });
}

/**
 * Seeds quizzes and questions for given user IDs
 * Creates 2 quizzes per user with 5 questions each
 * Idempotent: skips quizzes if user already has quizzes
 *
 * @param userIds - Array of user IDs to create quizzes for
 */
export async function seedQuizzes(userIds: string[]): Promise<void> {
  for (const userId of userIds) {
    // Check if user already has quizzes (idempotency)
    const existing = await db.select().from(QUIZ).where(eq(QUIZ.creator_id, userId)).limit(1);

    if (existing.length > 0) {
      seedLogger.info({ userId }, 'Quizzes already exist for user, skipping');
      continue;
    }

    for (let q = 0; q < 2; q++) {
      const shareCode = generateShareCode();
      const title = `${faker.word.adjective()} ${faker.word.noun()} Quiz ${q + 1}`;

      const [quiz] = await db
        .insert(QUIZ)
        .values({
          title,
          description: faker.lorem.sentence(),
          creator_id: userId,
          share_code: shareCode,
        })
        .returning();

      const questions = generateQuestions(5);
      await db.insert(QUESTION).values(
        questions.map((question) => ({
          ...question,
          quiz_id: quiz.id,
        }))
      );

      seedLogger.info({ quizId: quiz.id, title, shareCode }, 'Quiz seeded');
    }
  }

  seedLogger.info('Quiz seeding complete');
}
