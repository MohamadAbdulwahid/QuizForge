/**
 * Server-side answer grading for every supported question type.
 *
 * The grading layer is the authoritative correctness check used by both
 * the synchronous WebSocket answer handler and the continuous Treasure
 * Forge handler. It must be tolerant to malformed client input — any
 * parse failure or shape mismatch is treated as an incorrect answer
 * (never an exception) so a malicious or buggy client cannot crash
 * the round.
 */

import type { QUESTION } from '../../database/schema/quiz';

/** Result of grading a single answer submission. */
export interface GradeAnswerResult {
  correct: boolean;
}

// ---------------------------------------------------------------------------
// Grading helpers
// ---------------------------------------------------------------------------
function gradeMultipleChoice(question: QUESTION, selectedAnswer: string): GradeAnswerResult {
  const expected = String(question.correct_answer ?? '');
  return { correct: selectedAnswer === expected };
}

function gradeTrueFalse(question: QUESTION, selectedAnswer: string): GradeAnswerResult {
  const expected = String(question.correct_answer ?? '');
  return { correct: selectedAnswer === expected };
}

function gradeOrdering(question: QUESTION, selectedAnswer: string): GradeAnswerResult {
  const expectedRaw = String(question.correct_answer ?? '');
  const submittedRaw = String(selectedAnswer ?? '');

  let expected: unknown;
  let submitted: unknown;
  try {
    expected = JSON.parse(expectedRaw);
  } catch {
    return { correct: false };
  }
  try {
    submitted = JSON.parse(submittedRaw);
  } catch {
    return { correct: false };
  }

  if (!Array.isArray(expected) || !Array.isArray(submitted)) {
    return { correct: false };
  }

  if (expected.length !== submitted.length) {
    return { correct: false };
  }

  for (let index = 0; index < expected.length; index += 1) {
    if (expected[index] !== submitted[index]) {
      return { correct: false };
    }
  }
  return { correct: true };
}

function gradeMatching(question: QUESTION, selectedAnswer: string): GradeAnswerResult {
  const expectedRaw = String(question.correct_answer ?? '');
  const submittedRaw = String(selectedAnswer ?? '');

  let expected: unknown;
  let submitted: unknown;
  try {
    expected = JSON.parse(expectedRaw);
  } catch {
    return { correct: false };
  }
  try {
    submitted = JSON.parse(submittedRaw);
  } catch {
    return { correct: false };
  }

  if (!isPlainObject(expected) || !isPlainObject(submitted)) {
    return { correct: false };
  }

  const expectedKeys = Object.keys(expected);
  const submittedKeys = Object.keys(submitted);
  if (expectedKeys.length !== submittedKeys.length) {
    return { correct: false };
  }

  for (const key of expectedKeys) {
    if (expected[key] !== submitted[key]) {
      return { correct: false };
    }
  }
  return { correct: true };
}

function gradeFillInBlank(question: QUESTION, selectedAnswer: string): GradeAnswerResult {
  const options = readOptions(question.options);
  if (options.length === 0) {
    return { correct: false };
  }

  const submitted = String(selectedAnswer ?? '').trim();
  if (submitted.length === 0) {
    return { correct: false };
  }

  for (const option of options) {
    const accepted = String(option.answer ?? '').trim();
    if (accepted.length === 0) {
      continue;
    }
    const caseSensitive = option.caseSensitive === true;
    if (
      caseSensitive ? submitted === accepted : submitted.toLowerCase() === accepted.toLowerCase()
    ) {
      return { correct: true };
    }
  }
  return { correct: false };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------
/**
 * Grades a single answer submission against the authoritative question row.
 * @param question - The full question row from the database.
 * @param selectedAnswer - The raw client-submitted answer string.
 * @returns `{ correct: boolean }` — never throws on malformed input.
 */
export function gradeAnswer(question: QUESTION, selectedAnswer: string): GradeAnswerResult {
  const type = question.type;

  switch (type) {
    case 'multiple-choice':
      return gradeMultipleChoice(question, selectedAnswer);
    case 'true-false':
      return gradeTrueFalse(question, selectedAnswer);
    case 'ordering':
      return gradeOrdering(question, selectedAnswer);
    case 'matching':
      return gradeMatching(question, selectedAnswer);
    case 'fill-in-blank':
      return gradeFillInBlank(question, selectedAnswer);
    case 'open':
      // 'open' questions have no objective grading — treated as incorrect
      // for now (host scoring flow lives elsewhere).
      return { correct: false };
    default:
      return { correct: false };
  }
}

// ---------------------------------------------------------------------------
// Internal type guards
// ---------------------------------------------------------------------------
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readOptions(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    return [];
  }
  const result: Array<Record<string, unknown>> = [];
  for (const item of value) {
    if (isPlainObject(item)) {
      result.push(item);
    }
  }
  return result;
}
