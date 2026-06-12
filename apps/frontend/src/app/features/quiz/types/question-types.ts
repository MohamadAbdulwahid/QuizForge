import type { QuestionType } from '../../../core/services/quiz-api.service';

// Re-export the question type for convenience so feature code can import all
// question-type-related symbols from a single module.
export type { QuestionType };

/**
 * Per-type configuration metadata for the quiz builder. Drives the type
 * picker UI and gives the builder everything it needs to render the right
 * controls for a freshly-added question.
 */
export interface QuestionTypeConfig {
  readonly id: QuestionType;
  readonly label: string;
  readonly description: string;
  /** Single emoji used as the visual marker in the type picker. */
  readonly icon: string;
}

/**
 * Canonical, ordered list of supported question types. Order = display order
 * in the builder's "add question" picker (most common first).
 */
export const QUESTION_TYPES: readonly QuestionTypeConfig[] = [
  {
    id: 'multiple-choice',
    label: 'Multiple Choice',
    description: '2–6 options, one correct',
    icon: '🔘',
  },
  { id: 'true-false', label: 'True / False', description: 'Yes or no question', icon: '✓✗' },
  {
    id: 'ordering',
    label: 'Ordering',
    description: 'Arrange items in the correct order',
    icon: '↕️',
  },
  {
    id: 'matching',
    label: 'Matching',
    description: 'Pair items from two columns',
    icon: '🔗',
  },
  {
    id: 'fill-in-blank',
    label: 'Fill in Blank',
    description: 'Type the answer (one or more accepted)',
    icon: '✏️',
  },
];

/* ── Type guards ─────────────────────────────────────────────────────────── */
/* Accept `string` (not `QuestionType`) so they're safe to call on the      */
/* websocket payload's `type` field, which is typed as a permissive string. */

export function isMultipleChoice(type: string): boolean {
  return type === 'multiple-choice';
}

export function isTrueFalse(type: string): boolean {
  return type === 'true-false';
}

export function isOrdering(type: string): boolean {
  return type === 'ordering';
}

export function isMatching(type: string): boolean {
  return type === 'matching';
}

export function isFillInBlank(type: string): boolean {
  return type === 'fill-in-blank';
}

/* ── Answer serialization for the `submit-answer` websocket event ────────── */
/* The WS protocol expects `selectedAnswer: string`. For structured types    */
/* (ordering, matching) we JSON-encode the payload into that string. The     */
/* backend parses it back into the canonical shape for scoring.             */

/** MC / TF / FIB: returns the option id or raw text. */
export function serializeMcAnswer(optionId: string): string {
  return optionId;
}

/** Ordering: serialize the ordered id list as a JSON array string. */
export function serializeOrderingAnswer(orderedIds: string[]): string {
  return JSON.stringify(orderedIds);
}

/** Matching: serialize the `{leftId: rightId}` map as a JSON object string. */
export function serializeMatchingAnswer(pairs: Record<string, string>): string {
  return JSON.stringify(pairs);
}

/** Fill-in-blank: returns the raw text (trimmed, case-handled by the server). */
export function serializeFibAnswer(text: string): string {
  return text.trim();
}
