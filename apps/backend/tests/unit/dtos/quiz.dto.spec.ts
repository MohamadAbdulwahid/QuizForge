import { describe, expect, it } from 'bun:test';
import {
  CreateQuizRequestSchema,
  QuizIdParamSchema,
  UpdateQuizRequestSchema,
} from '../../../src/api/dtos/quiz.dto';

describe('quiz dto schemas', () => {
  it('accepts valid create request', () => {
    const result = CreateQuizRequestSchema.safeParse({
      title: 'Demo quiz',
      questions: [
        {
          text: '2 + 2 = ?',
          type: 'multiple-choice',
          options: [
            { id: 'A', text: '3' },
            { id: 'B', text: '4' },
          ],
          correct_answer: 'B',
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('rejects missing title', () => {
    const result = CreateQuizRequestSchema.safeParse({
      title: '',
      questions: [],
    });

    expect(result.success).toBe(false);
  });

  it('rejects empty question array', () => {
    const result = CreateQuizRequestSchema.safeParse({
      title: 'Demo',
      questions: [],
    });

    expect(result.success).toBe(false);
  });

  it('rejects multiple choice without enough options', () => {
    const result = CreateQuizRequestSchema.safeParse({
      title: 'Demo',
      questions: [
        {
          text: 'Question',
          type: 'multiple-choice',
          options: [{ id: 'A', text: 'Only option' }],
          correct_answer: 'A',
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('rejects multiple choice answer not matching option id', () => {
    const result = CreateQuizRequestSchema.safeParse({
      title: 'Demo',
      questions: [
        {
          text: 'Question',
          type: 'multiple-choice',
          options: [
            { id: 'A', text: 'One' },
            { id: 'B', text: 'Two' },
          ],
          correct_answer: 'C',
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('accepts partial update payload', () => {
    const result = UpdateQuizRequestSchema.safeParse({
      title: 'Updated title',
    });

    expect(result.success).toBe(true);
  });

  it('rejects empty update payload', () => {
    const result = UpdateQuizRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('coerces and validates quiz id param', () => {
    const result = QuizIdParamSchema.safeParse({ id: '12' });
    expect(result.success).toBe(true);
  });

  it('rejects non-numeric quiz id param', () => {
    const result = QuizIdParamSchema.safeParse({ id: 'abc' });
    expect(result.success).toBe(false);
  });
});
