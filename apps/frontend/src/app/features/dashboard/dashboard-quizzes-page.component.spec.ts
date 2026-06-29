import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import { ConfigService } from '../../core/services/config.service';
import { QuizApiService, QuizSummary } from '../../core/services/quiz-api.service';
import { DashboardQuizzesPageComponent } from './dashboard-quizzes-page.component';

const FIXTURE_QUIZZES: QuizSummary[] = [
  {
    id: 1,
    title: 'Biology Basics',
    description: 'Intro bio',
    share_code: 'ABCDEFGH',
    created_at: '2026-01-01T00:00:00.000Z',
    questionCount: 5,
    visibility: 'unlisted',
    status: 'published',
    playCount: 0,
    language: 'en',
  },
  {
    id: 2,
    title: 'World History',
    description: 'Major events',
    share_code: 'WXYZ1234',
    created_at: '2026-01-02T00:00:00.000Z',
    questionCount: 8,
    visibility: 'public',
    status: 'published',
    playCount: 3,
    language: 'en',
  },
];

describe('DashboardQuizzesPageComponent', () => {
  beforeEach(async () => {
    const quizApiMock = {
      getMyQuizzes: vi.fn(() => of(FIXTURE_QUIZZES)),
      aiRemixQuiz: vi.fn(),
      aiTranslateQuiz: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [DashboardQuizzesPageComponent],
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: ConfigService,
          useValue: { getBackendUrl: vi.fn(() => 'http://localhost:3333') },
        },
        { provide: Router, useValue: { navigate: vi.fn() } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: vi.fn().mockReturnValue(null) } } },
        },
        { provide: QuizApiService, useValue: quizApiMock as unknown as QuizApiService },
      ],
    }).compileComponents();
  });

  it('renders one AI Remix button per quiz card', async () => {
    const fixture = TestBed.createComponent(DashboardQuizzesPageComponent);
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll('[data-testid="remix-button"]');
    expect(buttons.length).toBe(2);
  });

  it('renders one AI Translate button per quiz card', async () => {
    const fixture = TestBed.createComponent(DashboardQuizzesPageComponent);
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll('[data-testid="translate-button"]');
    expect(buttons.length).toBe(2);
  });

  it('opens the remix modal when the AI Remix button is clicked', async () => {
    const fixture = TestBed.createComponent(DashboardQuizzesPageComponent);
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();
    const firstRemix = fixture.nativeElement.querySelector(
      '[data-testid="remix-button"]'
    ) as HTMLButtonElement;
    expect(firstRemix).toBeTruthy();
    firstRemix.click();
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('AI Remix Quiz');
  });

  it('opens the translate modal when the AI Translate button is clicked', async () => {
    const fixture = TestBed.createComponent(DashboardQuizzesPageComponent);
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();
    const firstTranslate = fixture.nativeElement.querySelector(
      '[data-testid="translate-button"]'
    ) as HTMLButtonElement;
    expect(firstTranslate).toBeTruthy();
    firstTranslate.click();
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('AI Translate Quiz');
  });
});
