import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { ConfigService } from '../../../core/services/config.service';
import { QuizApiService } from '../../../core/services/quiz-api.service';
import { RemixQuizModalComponent } from './remix-quiz-modal.component';

// The component's `dismiss`, `generate`, `canSubmit` are `protected` for the
// template. The tests cast through `unknown` to call them — same pattern
// the existing quiz-builder tests use for protected signals.
type TestableModal = RemixQuizModalComponent & {
  dismiss: () => void;
  generate: () => void;
  canSubmit: () => boolean;
};

describe('RemixQuizModalComponent', () => {
  beforeEach(async () => {
    const quizApiMock = {
      aiRemixQuiz: vi.fn(() =>
        of({
          quiz: {
            id: 999,
            title: '[Remix] Demo',
            description: 'remixed',
            share_code: 'REMIXED1',
            created_at: '2026-01-01T00:00:00.000Z',
            questionCount: 5,
            visibility: 'unlisted',
            status: 'published',
            playCount: 0,
            parentQuizId: 1,
            transformationType: 'remix' as const,
            language: 'en',
          },
          shareCode: 'REMIXED1',
          transformationType: 'remix' as const,
          reused: false,
        })
      ),
    };

    await TestBed.configureTestingModule({
      imports: [RemixQuizModalComponent],
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
    const fixture = TestBed.createComponent(RemixQuizModalComponent);
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('sourceQuiz', { id: 1, title: 'Demo' });
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('AI Remix Quiz');
    expect(text).toContain('Demo');
  });

  it('does not render when visible is false', () => {
    const fixture = TestBed.createComponent(RemixQuizModalComponent);
    fixture.componentRef.setInput('visible', false);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent ?? '';
    expect(text).not.toContain('AI Remix Quiz');
  });

  it('emits visibleChange(false) when dismiss is called', () => {
    const fixture = TestBed.createComponent(RemixQuizModalComponent);
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('sourceQuiz', { id: 1, title: 'Demo' });
    const visibleChangeSpy = vi.fn();
    fixture.componentRef.instance.visibleChange.subscribe(visibleChangeSpy);
    (fixture.componentInstance as TestableModal).dismiss();
    expect(visibleChangeSpy).toHaveBeenCalledWith(false);
  });

  it('calls aiRemixQuiz on submit and emits remixSuccess', async () => {
    const fixture = TestBed.createComponent(RemixQuizModalComponent);
    const api = TestBed.inject(QuizApiService);
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('sourceQuiz', { id: 1, title: 'Demo' });
    const remixSpy = vi.fn();
    fixture.componentRef.instance.remixSuccess.subscribe(remixSpy);
    fixture.detectChanges();

    (fixture.componentInstance as TestableModal).generate();
    await Promise.resolve();
    expect(api.aiRemixQuiz).toHaveBeenCalledWith(1, {});
    expect(remixSpy).toHaveBeenCalled();
    const call = remixSpy.mock.calls[0]?.[0] as {
      sourceQuizId: number;
      newQuizId: number;
      shareCode: string;
      reused: boolean;
    };
    expect(call.sourceQuizId).toBe(1);
    expect(call.newQuizId).toBe(999);
    expect(call.reused).toBe(false);
  });

  it('shows an error message when the API call fails', async () => {
    const fixture = TestBed.createComponent(RemixQuizModalComponent);
    const api = TestBed.inject(QuizApiService);
    (api.aiRemixQuiz as ReturnType<typeof vi.fn>).mockReturnValue(
      throwError(() => ({ status: 503, error: { error: 'AI not configured' } }))
    );
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('sourceQuiz', { id: 1, title: 'Demo' });
    fixture.detectChanges();

    (fixture.componentInstance as TestableModal).generate();
    await Promise.resolve();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('not configured');
  });

  it('refuses to submit when sourceQuiz is null', async () => {
    const fixture = TestBed.createComponent(RemixQuizModalComponent);
    const api = TestBed.inject(QuizApiService);
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('sourceQuiz', null);
    const remixSpy = vi.fn();
    fixture.componentRef.instance.remixSuccess.subscribe(remixSpy);
    fixture.detectChanges();

    (fixture.componentInstance as TestableModal).generate();
    await Promise.resolve();

    // generate() returns early when sourceQuiz is null — API never called,
    // success event never emitted.
    expect(api.aiRemixQuiz).not.toHaveBeenCalled();
    expect(remixSpy).not.toHaveBeenCalled();
  });
});
