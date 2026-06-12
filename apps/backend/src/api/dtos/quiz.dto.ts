import { z } from 'zod';

// ---------------------------------------------------------------------------
// Question type literal enum
// ---------------------------------------------------------------------------
const questionTypeSchema = z.enum([
  'multiple-choice',
  'true-false',
  'open',
  'ordering',
  'matching',
  'fill-in-blank',
]);

/** Maximum length for the `correct_answer` text field. Sized to fit JSON-encoded payloads for Ordering and Matching. */
const CORRECT_ANSWER_MAX = 5000;

// ---------------------------------------------------------------------------
// Option shape primitives
// ---------------------------------------------------------------------------
/** Standard MC / Ordering / TF option: `{id, text}`. */
const textOptionSchema = z.object({
  id: z.string().min(1, 'Option id is required').max(50),
  text: z.string().min(1, 'Option text is required').max(500),
});

/** Matching left side: includes the `matchId` pointer to the right side. */
const matchingLeftOptionSchema = z.object({
  id: z.string().min(1, 'Option id is required').max(50),
  text: z.string().min(1, 'Option text is required').max(500),
  matchId: z.string().min(1, 'matchId is required').max(50),
});

/** Matching right side: same shape as standard text option. */
const matchingRightOptionSchema = textOptionSchema;

/** Fill-in-blank accepted-answer option: uses `answer` text and per-answer case sensitivity. */
const fillInBlankOptionSchema = z.object({
  id: z.string().min(1, 'Option id is required').max(50),
  answer: z.string().min(1, 'Accepted answer is required').max(500),
  caseSensitive: z.boolean().optional().default(false),
});

// ---------------------------------------------------------------------------
// Base fields shared by every question variant
// ---------------------------------------------------------------------------
const baseFields = {
  text: z.string().min(1, 'Question text is required').max(500),
  time_limit: z.number().int().min(5).max(120).optional().default(30),
  points: z.number().int().min(0).max(1000).optional().default(100),
};

// ---------------------------------------------------------------------------
// Per-type schemas
// ---------------------------------------------------------------------------
const multipleChoiceSchema = z
  .object({
    ...baseFields,
    type: z.literal('multiple-choice'),
    options: z.array(textOptionSchema).min(2, 'At least 2 options required').max(6),
    correct_answer: z.string().min(1, 'Correct answer is required').max(CORRECT_ANSWER_MAX),
  })
  .superRefine((value, ctx) => {
    const validOptionIds = new Set(value.options.map((option) => option.id));
    if (!validOptionIds.has(value.correct_answer)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'correct_answer must match one of the option ids',
        path: ['correct_answer'],
      });
    }
  });

const trueFalseSchema = z
  .object({
    ...baseFields,
    type: z.literal('true-false'),
    options: z.array(textOptionSchema).length(2),
    correct_answer: z.enum(['true', 'false']),
  })
  .superRefine((value, ctx) => {
    const ids = new Set(value.options.map((option) => option.id));
    if (!ids.has('true') || !ids.has('false')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'True-false questions must have options with ids "true" and "false"',
        path: ['options'],
      });
    }
  });

const openSchema = z.object({
  ...baseFields,
  type: z.literal('open'),
  options: z.array(textOptionSchema).optional(),
  correct_answer: z.string().min(1, 'Correct answer is required').max(CORRECT_ANSWER_MAX),
});

const orderingSchema = z
  .object({
    ...baseFields,
    type: z.literal('ordering'),
    options: z
      .array(textOptionSchema)
      .min(2, 'Ordering requires at least 2 items')
      .max(8, 'Ordering supports at most 8 items'),
    correct_answer: z.string().min(1, 'Correct answer is required').max(CORRECT_ANSWER_MAX),
  })
  .superRefine((value, ctx) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(value.correct_answer);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'correct_answer must be a valid JSON array of option ids',
        path: ['correct_answer'],
      });
      return;
    }

    if (!Array.isArray(parsed)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'correct_answer must be a JSON array of option ids',
        path: ['correct_answer'],
      });
      return;
    }

    if (parsed.length !== value.options.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'correct_answer array length must match the number of options',
        path: ['correct_answer'],
      });
      return;
    }

    const validIds = new Set(value.options.map((option) => option.id));
    for (const id of parsed) {
      if (typeof id !== 'string' || !validIds.has(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'correct_answer array contains an invalid option id',
          path: ['correct_answer'],
        });
        return;
      }
    }
  });

const matchingSchema = z
  .object({
    ...baseFields,
    type: z.literal('matching'),
    options: z.object({
      left: z.array(matchingLeftOptionSchema).min(2).max(6),
      right: z.array(matchingRightOptionSchema).min(2).max(6),
    }),
    correct_answer: z.string().min(1, 'Correct answer is required').max(CORRECT_ANSWER_MAX),
  })
  .superRefine((value, ctx) => {
    const { left, right } = value.options;

    if (left.length !== right.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Matching left and right arrays must have the same length',
        path: ['options'],
      });
      return;
    }

    const rightIds = new Set(right.map((option) => option.id));
    for (const l of left) {
      if (!rightIds.has(l.matchId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Left option matchId "${l.matchId}" must reference a valid right option id`,
          path: ['options', 'left'],
        });
        return;
      }
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(value.correct_answer);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'correct_answer must be valid JSON of {leftId: rightId}',
        path: ['correct_answer'],
      });
      return;
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'correct_answer must be a JSON object mapping leftId to rightId',
        path: ['correct_answer'],
      });
      return;
    }

    const record = parsed as Record<string, unknown>;
    const leftIds = new Set(left.map((l) => l.id));
    for (const l of left) {
      const mapped = record[l.id];
      if (typeof mapped !== 'string' || !rightIds.has(mapped)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `correct_answer["${l.id}"] must be a valid right option id`,
          path: ['correct_answer'],
        });
        return;
      }
    }
    // Reject extra unknown keys so the canonical answer mirrors the left set exactly.
    for (const key of Object.keys(record)) {
      if (!leftIds.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `correct_answer contains unknown left id "${key}"`,
          path: ['correct_answer'],
        });
        return;
      }
    }
  });

const fillInBlankSchema = z.object({
  ...baseFields,
  type: z.literal('fill-in-blank'),
  options: z
    .array(fillInBlankOptionSchema)
    .min(1, 'Fill-in-the-blank requires at least one accepted answer'),
  correct_answer: z.string().min(1, 'Correct answer is required').max(CORRECT_ANSWER_MAX),
});

const questionSchema = z.discriminatedUnion('type', [
  multipleChoiceSchema,
  trueFalseSchema,
  openSchema,
  orderingSchema,
  matchingSchema,
  fillInBlankSchema,
]);

// ---------------------------------------------------------------------------
// Request wrappers
// ---------------------------------------------------------------------------
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

// Re-export the discriminated union type enum for runtime usage by callers
// that need to switch on the question type without re-importing from the schema.
export { questionTypeSchema as QuestionTypeSchema };

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
export type QuestionType = z.infer<typeof questionTypeSchema>;
