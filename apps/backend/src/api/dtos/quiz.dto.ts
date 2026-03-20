import { z } from 'zod';

const questionOptionSchema = z.object({
  id: z.string().min(1, 'Option id is required').max(50),
  text: z.string().min(1, 'Option text is required').max(500),
});

const questionSchema = z
  .object({
    text: z.string().min(1, 'Question text is required').max(500),
    type: z.enum(['multiple-choice', 'true-false', 'open']),
    options: z.array(questionOptionSchema).optional(),
    correct_answer: z.string().min(1, 'Correct answer is required').max(200),
    time_limit: z.number().int().min(5).max(120).optional().default(30),
    points: z.number().int().min(0).max(1000).optional().default(100),
  })
  .superRefine((value, ctx) => {
    if (value.type === 'multiple-choice') {
      if (!value.options || value.options.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Multiple-choice questions require at least 2 options',
          path: ['options'],
        });
        return;
      }

      const validOptionIds = new Set(value.options.map((option) => option.id));
      if (!validOptionIds.has(value.correct_answer)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'correct_answer must match one of the option ids',
          path: ['correct_answer'],
        });
      }
    }
  });

const createQuizRequestSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional(),
  questions: z.array(questionSchema).min(1, 'At least one question is required').max(100),
});

const updateQuizRequestSchema = z
  .object({
    title: z.string().min(1, 'Title is required').max(200).optional(),
    description: z.string().max(2000).optional(),
    questions: z.array(questionSchema).min(1).max(100).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

const quizIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const shareCodeParamSchema = z.object({
  shareCode: z.string().min(1).max(16),
});

export {
  questionSchema as QuestionSchema,
  createQuizRequestSchema as CreateQuizRequestSchema,
  updateQuizRequestSchema as UpdateQuizRequestSchema,
  quizIdParamSchema as QuizIdParamSchema,
  shareCodeParamSchema as ShareCodeParamSchema,
};

export type CreateQuizRequest = z.infer<typeof createQuizRequestSchema>;
export type UpdateQuizRequest = z.infer<typeof updateQuizRequestSchema>;
export type QuestionInput = z.infer<typeof questionSchema>;
