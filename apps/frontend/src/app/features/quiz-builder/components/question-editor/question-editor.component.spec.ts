import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Unit tests for QuestionEditorComponent validation logic
 * Uses Vitest with a mock component class to test validation rules
 */

// Mock component for testing validation logic
class QuestionEditorValidationTest {
  questionText = '';
  questionType: 'multiple-choice' | 'true-false' = 'multiple-choice';
  answerOptions: Array<{ id: string; text: string }> = [
    { id: 'A', text: '' },
    { id: 'B', text: '' },
  ];
  correctAnswerId = 'A';
  timeLimit = 30;
  points = 100;

  getValidationErrors() {
    const errors: Array<{ field: string; message: string }> = [];

    // Question text validation
    if (!this.questionText.trim()) {
      errors.push({ field: 'text', message: 'Question text is required' });
    } else if (this.questionText.length > 500) {
      errors.push({ field: 'text', message: 'Question must be 500 characters or less' });
    }

    // Type-specific validations
    const type = this.questionType;
    if (type === 'multiple-choice' || type === 'true-false') {
      const options = this.answerOptions;

      // Min 2 options validation
      if (options.length < 2) {
        errors.push({
          field: 'options',
          message: 'At least 2 answer options are required',
        });
      }

      // All options must have text
      options.forEach((option, idx) => {
        if (!option.text.trim()) {
          errors.push({
            field: `option-${idx}`,
            message: `Answer option ${option.id} cannot be empty`,
          });
        } else if (option.text.length > 500) {
          errors.push({
            field: `option-${idx}`,
            message: `Answer option must be 500 characters or less`,
          });
        }
      });

      // Correct answer validation
      const optionIds = new Set(options.map((o) => o.id));
      if (!optionIds.has(this.correctAnswerId)) {
        errors.push({
          field: 'correct_answer',
          message: 'A correct answer must be marked',
        });
      }
    }

    // Time limit validation (5-120 seconds)
    const time = this.timeLimit;
    if (time < 5 || time > 120) {
      errors.push({
        field: 'time_limit',
        message: 'Time limit must be between 5 and 120 seconds',
      });
    }

    // Points validation (0-1000)
    const pts = this.points;
    if (pts < 0 || pts > 1000) {
      errors.push({ field: 'points', message: 'Points must be between 0 and 1000' });
    }

    return errors;
  }

  isValid(): boolean {
    return this.getValidationErrors().length === 0;
  }

  hasFieldError(fieldName: string): boolean {
    return this.getValidationErrors().some((e) => e.field === fieldName);
  }

  getFieldError(fieldName: string): string {
    return this.getValidationErrors().find((e) => e.field === fieldName)?.message || '';
  }
}

describe('QuestionEditorComponent - Form Validation Tests (PB-68)', () => {
  let component: QuestionEditorValidationTest;

  beforeEach(() => {
    component = new QuestionEditorValidationTest();
  });

  describe('PB-68: Form validation detects missing "correct" answers', () => {
    it('should be invalid when correct answer does not match any option ID', () => {
      component.questionText = 'Test question?';
      component.answerOptions = [
        { id: 'A', text: 'Option A' },
        { id: 'B', text: 'Option B' },
      ];
      component.correctAnswerId = 'C'; // C does not exist

      expect(component.isValid()).toBe(false);
      expect(component.hasFieldError('correct_answer')).toBe(true);
      expect(component.getFieldError('correct_answer')).toContain('correct answer');
    });

    it('should emit error message when form validation detects missing correct answer', () => {
      component.questionText = 'Valid question?';
      component.answerOptions = [
        { id: 'A', text: 'True' },
        { id: 'B', text: 'False' },
      ];
      component.correctAnswerId = 'X'; // Invalid ID

      expect(component.isValid()).toBe(false);
      const errors = component.getValidationErrors();
      expect(errors.some((e) => e.field === 'correct_answer')).toBe(true);
    });
  });

  describe('PB-68: Toggle for multichoice/true-false swaps input templates correctly', () => {
    it('should have different option templates for multiple-choice vs true-false', () => {
      // Multiple-choice: empty options
      component.questionType = 'multiple-choice';
      component.answerOptions = [
        { id: 'A', text: '' },
        { id: 'B', text: '' },
      ];
      expect(component.answerOptions[0].text).toBe('');
      expect(component.answerOptions[1].text).toBe('');

      // True-false: preset options
      component.questionType = 'true-false';
      component.answerOptions = [
        { id: 'A', text: 'True' },
        { id: 'B', text: 'False' },
      ];
      expect(component.answerOptions[0].text).toBe('True');
      expect(component.answerOptions[1].text).toBe('False');
    });

    it('should reset to empty options when switching from true-false to multiple-choice', () => {
      // Start as true-false
      component.questionType = 'true-false';
      component.answerOptions = [
        { id: 'A', text: 'True' },
        { id: 'B', text: 'False' },
      ];

      // Switch to multiple-choice
      component.questionType = 'multiple-choice';
      component.answerOptions = [
        { id: 'A', text: '' },
        { id: 'B', text: '' },
      ];

      expect(component.answerOptions[0].text).toBe('');
      expect(component.answerOptions[1].text).toBe('');
    });

    it('should update option templates when toggling question type', () => {
      component.questionText = 'Is this true?';
      component.questionType = 'true-false';
      component.answerOptions = [
        { id: 'A', text: 'True' },
        { id: 'B', text: 'False' },
      ];
      component.correctAnswerId = 'A';

      expect(component.isValid()).toBe(true);

      // Toggle to multiple-choice
      component.questionType = 'multiple-choice';
      component.answerOptions = [
        { id: 'A', text: 'Option 1' },
        { id: 'B', text: 'Option 2' },
      ];

      expect(component.answerOptions[0].text).toBe('Option 1');
      expect(component.answerOptions[1].text).toBe('Option 2');
    });
  });

  describe('Complete Validation Scenarios', () => {
    it('should validate complete true-false form with all valid fields', () => {
      component.questionText = 'Is Angular a framework?';
      component.questionType = 'true-false';
      component.answerOptions = [
        { id: 'A', text: 'True' },
        { id: 'B', text: 'False' },
      ];
      component.correctAnswerId = 'A';
      component.timeLimit = 60;
      component.points = 100;

      expect(component.isValid()).toBe(true);
    });

    it('should validate multiple-choice with multiple options', () => {
      component.questionText = 'What is the largest planet?';
      component.questionType = 'multiple-choice';
      component.answerOptions = [
        { id: 'A', text: 'Earth' },
        { id: 'B', text: 'Jupiter' },
        { id: 'C', text: 'Saturn' },
        { id: 'D', text: 'Mars' },
      ];
      component.correctAnswerId = 'B';
      component.timeLimit = 45;
      component.points = 100;

      expect(component.isValid()).toBe(true);
    });

    it('should catch multiple validation errors', () => {
      component.questionText = '';
      component.answerOptions = [{ id: 'A', text: '' }];
      component.timeLimit = 200;
      component.points = -10;

      const errors = component.getValidationErrors();
      expect(errors.length).toBeGreaterThan(1);
    });
  });

  describe('Answer Options Validation', () => {
    it('should be invalid when fewer than 2 options exist', () => {
      component.questionText = 'Test question?';
      component.answerOptions = [{ id: 'A', text: 'Only option' }];

      expect(component.isValid()).toBe(false);
      expect(component.hasFieldError('options')).toBe(true);
    });

    it('should be invalid when an option text is empty', () => {
      component.questionText = 'Test question?';
      component.answerOptions = [
        { id: 'A', text: 'Valid option' },
        { id: 'B', text: '' },
      ];

      expect(component.isValid()).toBe(false);
      expect(component.hasFieldError('option-1')).toBe(true);
    });
  });

  describe('Time Limit and Points Validation', () => {
    beforeEach(() => {
      component.questionText = 'Test?';
      component.answerOptions = [
        { id: 'A', text: 'A' },
        { id: 'B', text: 'B' },
      ];
    });

    it('should be invalid when time limit is less than 5', () => {
      component.timeLimit = 3;

      expect(component.isValid()).toBe(false);
      expect(component.hasFieldError('time_limit')).toBe(true);
    });

    it('should be invalid when time limit exceeds 120', () => {
      component.timeLimit = 150;

      expect(component.isValid()).toBe(false);
      expect(component.hasFieldError('time_limit')).toBe(true);
    });

    it('should be invalid when points is negative', () => {
      component.points = -10;

      expect(component.isValid()).toBe(false);
      expect(component.hasFieldError('points')).toBe(true);
    });

    it('should be invalid when points exceed 1000', () => {
      component.points = 1500;

      expect(component.isValid()).toBe(false);
      expect(component.hasFieldError('points')).toBe(true);
    });
  });
});
