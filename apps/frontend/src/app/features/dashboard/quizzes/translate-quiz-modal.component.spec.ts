import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { ConfigService } from '../../../core/services/config.service';
import { QuizApiService } from '../../../core/services/quiz-api.service';
import { TranslateQuizModalComponent } from './translate-quiz-modal.component';

// Cast helper: the modal's helper methods are `protected` for the template.
// The tests need to call them directly — same pattern the existing
// quiz-builder tests use for protected signals.
type TestableModal = TranslateQuizModalComponent & {
  dismiss: () => void;
  generate: () => void;
  canSubmit: () => boolean;
  onLanguageChange: (value: string) => void;
};

describe('TranslateQuizModalComponent', () => {
  beforeEach(async () => {
    const quizApiMock = {
      aiTranslateQuiz: vi.fn(() =>
        of({
          quiz: {
            id: 1000,
            title: '[Spanish] Demo',
            description: 'translated',
            share_code: 'TRANSLT1',
            created_at: '2026-01-01T00:00:00.000Z',
            questionCount: 5,
            visibility: 'unlisted',
            status: 'published',
            playCount: 0,
            parentQuizId: 1,
            transformationType: 'translate' as const,
            language: 'es',
          },
          shareCode: 'TRANSLT1',
          transformationType: 'translate' as const,
          targetLanguage: 'es',
          reused: false,
        })
      ),
    };

    await TestBed.configureTestingModule({
      imports: [TranslateQuizModalComponent],
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: ConfigService,
          useValue: { getBackendUrl: vi.fn(() => 'http://localhost:3333') },
        },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: QuizApiService, useValue: quizApiMock as unknown as QuizApiService },
      ],
    }).compileComponents();
  });

  it('renders the modal title when visible', () => {
    const fixture = TestBed.createComponent(TranslateQuizModalComponent);
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('sourceQuiz', { id: 1, title: 'Demo', language: 'en' });
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('AI Translate Quiz');
    expect(text).toContain('Demo');
  });

  it('does not render when visible is false', () => {
    const fixture = TestBed.createComponent(TranslateQuizModalComponent);
    fixture.componentRef.setInput('visible', false);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent ?? '';
    expect(text).not.toContain('AI Translate Quiz');
  });

  it('emits visibleChange(false) when dismiss is called', () => {
    const fixture = TestBed.createComponent(TranslateQuizModalComponent);
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('sourceQuiz', { id: 1, title: 'Demo', language: 'en' });
    const visibleChangeSpy = vi.fn();
    fixture.componentRef.instance.visibleChange.subscribe(visibleChangeSpy);
    (fixture.componentInstance as TestableModal).dismiss();
    expect(visibleChangeSpy).toHaveBeenCalledWith(false);
  });

  it('requires a target language to enable submit', () => {
    const fixture = TestBed.createComponent(TranslateQuizModalComponent);
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('sourceQuiz', { id: 1, title: 'Demo', language: 'en' });
    const inst = fixture.componentInstance as TestableModal;
    expect(inst.canSubmit()).toBe(false);
    inst.onLanguageChange('es');
    expect(inst.canSubmit()).toBe(true);
  });

  it('calls aiTranslateQuiz and emits translateSuccess on submit', async () => {
    const fixture = TestBed.createComponent(TranslateQuizModalComponent);
    const api = TestBed.inject(QuizApiService);
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('sourceQuiz', { id: 1, title: 'Demo', language: 'en' });
    const successSpy = vi.fn();
    fixture.componentRef.instance.translateSuccess.subscribe(successSpy);
    fixture.detectChanges();

    const inst = fixture.componentInstance as TestableModal;
    inst.onLanguageChange('es');
    inst.generate();
    await Promise.resolve();

    expect(api.aiTranslateQuiz).toHaveBeenCalledWith(1, { targetLanguage: 'es' });
    expect(successSpy).toHaveBeenCalled();
    const call = successSpy.mock.calls[0]?.[0] as {
      sourceQuizId: number;
      newQuizId: number;
      targetLanguage: string;
    };
    expect(call.sourceQuizId).toBe(1);
    expect(call.newQuizId).toBe(1000);
    expect(call.targetLanguage).toBe('es');
  });

  it('shows an error message when the API call fails', async () => {
    const fixture = TestBed.createComponent(TranslateQuizModalComponent);
    const api = TestBed.inject(QuizApiService);
    (api.aiTranslateQuiz as ReturnType<typeof vi.fn>).mockReturnValue(
      throwError(() => ({ status: 400, error: { error: 'Unsupported language' } }))
    );
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('sourceQuiz', { id: 1, title: 'Demo', language: 'en' });
    fixture.detectChanges();

    const inst = fixture.componentInstance as TestableModal;
    inst.onLanguageChange('xx');
    inst.generate();
    await Promise.resolve();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('Unsupported target language');
  });
});
