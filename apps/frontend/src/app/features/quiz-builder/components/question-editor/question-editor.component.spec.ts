import { render } from '@testing-library/angular';
import { describe, expect, it } from 'vitest';
import {
  createDefaultQuestion,
  QuestionEditorComponent,
  validateQuestion,
} from './question-editor.component';

describe('QuestionEditorComponent', () => {
  it('detects missing correct answers', async () => {
    const question = {
      ...createDefaultQuestion(),
      text: 'What is 2 + 2?',
      options: [
        { id: 'A', text: '3' },
        { id: 'B', text: '4' },
      ],
      correct_answer: 'C',
    };

    const { fixture } = await render(QuestionEditorComponent, {
      componentProperties: {},
    });

    fixture.componentRef.setInput('question', question);
    fixture.detectChanges();

    const errors = validateQuestion(question);

    expect(errors.some((error) => error.field === 'correct_answer')).toBe(true);
    expect(fixture.componentInstance.isValid()).toBe(false);
    expect(fixture.componentInstance.getFieldError('correct_answer')).toContain('correct answer');
  });

  it('swaps the option preset when toggled to true-false', async () => {
    const { fixture } = await render(QuestionEditorComponent, {
      componentProperties: {},
    });

    fixture.componentInstance.updateQuestionType('true-false');
    fixture.detectChanges();

    expect(fixture.componentInstance.answerOptions()[0]?.text).toBe('True');
    expect(fixture.componentInstance.answerOptions()[1]?.text).toBe('False');
  });
});
