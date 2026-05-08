import { render } from '@testing-library/angular';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { QuizApiService } from '../../core/services/quiz-api.service';
import { QuizBuilderComponent } from './quiz-builder.component';

describe('QuizBuilderComponent', () => {
  it('saves a new quiz and routes to the dashboard', async () => {
    const createQuizMock = vi.fn().mockReturnValue(
      of({
        quiz: {
          id: 15,
          title: 'Sprint 4 demo quiz',
          description: 'Demo',
          creator_id: 'user-1',
          share_code: 'ABCD1234',
          created_at: new Date().toISOString(),
        },
        shareCode: 'ABCD1234',
      })
    );

    const quizApiServiceStub = {
      getQuizById: vi.fn(),
      createQuiz: createQuizMock,
      updateQuiz: vi.fn(),
    };

    const { fixture } = await render(QuizBuilderComponent, {
      providers: [{ provide: QuizApiService, useValue: quizApiServiceStub }, provideRouter([])],
    });

    const component = fixture.componentInstance;
    const router = fixture.debugElement.injector.get(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    component.updateTitle('Sprint 4 demo quiz');
    component.updateDescription('A demo quiz for the review.');
    component.updateQuestion(component.questions()[0].clientId, {
      text: 'What is 2 + 2?',
      type: 'multiple-choice',
      options: [
        { id: 'A', text: '3' },
        { id: 'B', text: '4' },
      ],
      correct_answer: 'B',
      time_limit: 30,
      points: 100,
    });

    await component.saveQuiz();

    expect(createQuizMock).toHaveBeenCalledTimes(1);
    expect(navigateSpy).toHaveBeenCalledWith('/dashboard');
  });
});
