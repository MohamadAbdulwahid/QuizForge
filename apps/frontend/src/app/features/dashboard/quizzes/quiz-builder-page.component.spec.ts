import { provideZonelessChangeDetection, type WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import { QuizBuilderPageComponent } from './quiz-builder-page.component';
import {
  QuizApiService,
  QuizDetailDto,
  QuizSavePayload,
  QuizStatus,
  QuizVisibility,
} from '../../../core/services/quiz-api.service';

/**
 * Component tests for QuizBuilderPageComponent.
 *
 * Focus: Quiz Visibility & Discovery subtask 15 — verifies that the new
 * `visibility` and `status` signals propagate into the `QuizSavePayload`
 * sent to the API.
 */

/** Local stand-in for the (non-exported) `QuestionDraft` shape. */
interface TestQuestion {
  clientId: string;
  text: string;
  type: 'multiple-choice';
  options: Array<{ id: string; text: string }>;
  correctAnswerId: string;
  timeLimit: number;
  points: number;
}

/** Helper for accessing protected writable signals from outside the component. */
function access<T>(component: QuizBuilderPageComponent, key: string): WritableSignal<T> {
  return (component as unknown as Record<string, WritableSignal<T>>)[key];
}

describe('QuizBuilderPageComponent — visibility & status', () => {
  let component: QuizBuilderPageComponent;
  let fixture: ComponentFixture<QuizBuilderPageComponent>;
  let createQuizSpy: ReturnType<typeof vi.fn>;
  let updateQuizSpy: ReturnType<typeof vi.fn>;

  const validQuestion: TestQuestion = {
    clientId: 'q1',
    text: 'What is 2 + 2?',
    type: 'multiple-choice',
    options: [
      { id: 'a', text: '4' },
      { id: 'b', text: '5' },
    ],
    correctAnswerId: 'a',
    timeLimit: 30,
    points: 100,
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    createQuizSpy = vi.fn(() => of({}));
    updateQuizSpy = vi.fn(() => of({}));

    const quizApiMock = {
      createQuiz: createQuizSpy,
      updateQuiz: updateQuizSpy,
      getQuizById: vi.fn(),
      getMyQuizzes: vi.fn(),
      deleteQuiz: vi.fn(),
      aiGenerateQuiz: vi.fn(),
      searchPublicQuizzes: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [QuizBuilderPageComponent],
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: vi.fn().mockReturnValue(null) } },
          },
        },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: QuizApiService, useValue: quizApiMock as unknown as QuizApiService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(QuizBuilderPageComponent);
    component = fixture.componentInstance;

    // save() bails on empty title or invalid questions, so seed both.
    access<string>(component, 'title').set('Test Quiz');
    access<TestQuestion[]>(component, 'questions').set([validQuestion]);
  });

  describe('initial signal state', () => {
    it('defaults visibility to "unlisted"', () => {
      expect(access<QuizVisibility>(component, 'visibility')()).toBe('unlisted');
    });

    it('defaults status to "published"', () => {
      expect(access<QuizStatus>(component, 'status')()).toBe('published');
    });
  });

  describe('save payload propagation', () => {
    it('propagates the visibility signal into the save payload', () => {
      access<QuizVisibility>(component, 'visibility').set('public');

      (component as unknown as { save: () => void }).save();

      expect(createQuizSpy).toHaveBeenCalledTimes(1);
      const payload = createQuizSpy.mock.calls[0]?.[0] as QuizSavePayload;
      expect(payload.visibility).toBe('public');
    });

    it('propagates the status signal into the save payload', () => {
      access<QuizStatus>(component, 'status').set('draft');

      (component as unknown as { save: () => void }).save();

      expect(createQuizSpy).toHaveBeenCalledTimes(1);
      const payload = createQuizSpy.mock.calls[0]?.[0] as QuizSavePayload;
      expect(payload.status).toBe('draft');
    });

    it('sends the default visibility/status when untouched', () => {
      (component as unknown as { save: () => void }).save();

      const payload = createQuizSpy.mock.calls[0]?.[0] as QuizSavePayload;
      expect(payload.visibility).toBe('unlisted');
      expect(payload.status).toBe('published');
    });
  });

  describe('onStatusToggle handler', () => {
    it('flips status to "draft" when checked', () => {
      (component as unknown as { onStatusToggle: (checked: boolean) => void }).onStatusToggle(
        true
      );
      expect(access<QuizStatus>(component, 'status')()).toBe('draft');
    });

    it('flips status to "published" when unchecked', () => {
      // Start from a draft state, then uncheck.
      access<QuizStatus>(component, 'status').set('draft');
      (component as unknown as { onStatusToggle: (checked: boolean) => void }).onStatusToggle(
        false
      );
      expect(access<QuizStatus>(component, 'status')()).toBe('published');
    });

    it('routes the new status through to the save payload', () => {
      (component as unknown as { onStatusToggle: (checked: boolean) => void }).onStatusToggle(
        true
      );
      (component as unknown as { save: () => void }).save();

      const payload = createQuizSpy.mock.calls[0]?.[0] as QuizSavePayload;
      expect(payload.status).toBe('draft');
    });
  });

  describe('edit-mode hydration', () => {
    it('hydrates visibility and status from a loaded quiz', async () => {
      // Recreate the component with an :id route param so loadQuiz runs.
      TestBed.resetTestingModule();

      const loadedQuiz: Partial<QuizDetailDto> = {
        id: 7,
        title: 'Loaded Quiz',
        description: '',
        share_code: 'XYZ',
        created_at: '2024-01-01T00:00:00.000Z',
        questions: [],
        visibility: 'public',
        status: 'draft',
      };

      await TestBed.configureTestingModule({
        imports: [QuizBuilderPageComponent],
        providers: [
          provideZonelessChangeDetection(),
          {
            provide: ActivatedRoute,
            useValue: {
              snapshot: { paramMap: { get: vi.fn().mockReturnValue('7') } },
            },
          },
          { provide: Router, useValue: { navigate: vi.fn() } },
          {
            provide: QuizApiService,
            useValue: {
              createQuiz: vi.fn(),
              updateQuiz: vi.fn(),
              getQuizById: vi.fn(() => of(loadedQuiz as QuizDetailDto)),
              getMyQuizzes: vi.fn(),
              deleteQuiz: vi.fn(),
              aiGenerateQuiz: vi.fn(),
              searchPublicQuizzes: vi.fn(),
            } as unknown as QuizApiService,
          },
        ],
      }).compileComponents();

      const editFixture = TestBed.createComponent(QuizBuilderPageComponent);
      const editComponent = editFixture.componentInstance;

      // loadQuiz subscribes synchronously to the getQuizById observable.
      expect(access<QuizVisibility>(editComponent, 'visibility')()).toBe('public');
      expect(access<QuizStatus>(editComponent, 'status')()).toBe('draft');
    });
  });
});
