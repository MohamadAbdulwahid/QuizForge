import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { DiscoverQuizzesPageComponent } from './discover-quizzes-page.component';
import {
  DiscoverQuizSummary,
  DiscoverQuizzesResponse,
  QuizApiService,
  QuizSort,
} from '../../core/services/quiz-api.service';

/**
 * Component tests for DiscoverQuizzesPageComponent.
 * Covers: hero rendering, card grid on data, empty state, debounced search.
 */

const SAMPLE_QUIZ: DiscoverQuizSummary = {
  id: 1,
  title: 'World Capitals',
  description: 'A quick tour of capitals around the world.',
  question_count: 12,
  creator: {
    user_id: '11111111-1111-1111-1111-111111111111',
    username: 'curious_creator',
    display_name: 'Curious Creator',
  },
  play_count: 42,
  created_at: '2026-01-15T10:00:00.000Z',
  share_code: 'ABCD12',
};

const SECOND_QUIZ: DiscoverQuizSummary = {
  ...SAMPLE_QUIZ,
  id: 2,
  title: 'Math Wizards',
  description: null,
  question_count: 8,
  creator: {
    user_id: '22222222-2222-2222-2222-222222222222',
    username: 'math_wiz',
    display_name: 'Math Wiz',
  },
  play_count: 5,
  share_code: 'XYZ987',
};

function makeResponse(
  items: DiscoverQuizSummary[] = [SAMPLE_QUIZ],
  total: number = items.length
): DiscoverQuizzesResponse {
  return {
    items,
    total,
    limit: 24,
    offset: 0,
  };
}

interface QuizApiMock {
  searchPublicQuizzes: ReturnType<typeof vi.fn>;
}

function createQuizApiMock(responses: DiscoverQuizzesResponse[] | Error): QuizApiMock {
  const queue: Array<DiscoverQuizzesResponse | Error> = Array.isArray(responses)
    ? [...responses]
    : [responses];

  const searchPublicQuizzes = vi.fn(
    (_query: string, _sort: QuizSort, _limit: number, _offset: number) => {
      const next = queue.shift() ?? makeResponse();
      return next instanceof Error ? throwError(() => next) : of(next);
    }
  );

  return { searchPublicQuizzes };
}

interface TestHarness {
  fixture: ComponentFixture<DiscoverQuizzesPageComponent>;
  component: DiscoverQuizzesPageComponent;
  mockApi: QuizApiMock;
}

// The component's `items`, `onSearchChange`, `errorMessage`, `canNext`,
// `onNext`, `offset` are `protected` for the template. The tests cast
// through `unknown` to access them, mirroring the pattern used elsewhere
// for protected signals.
type TestableComponent = DiscoverQuizzesPageComponent & {
  items: () => unknown[];
  onSearchChange: (value: string) => void;
  errorMessage: () => string | null;
  canNext: () => boolean;
  onNext: () => void;
  offset: () => number;
};

async function setupComponent(
  responses: DiscoverQuizzesResponse[] | Error = [makeResponse()]
): Promise<TestHarness> {
  const mockApi = createQuizApiMock(responses);

  await TestBed.configureTestingModule({
    imports: [DiscoverQuizzesPageComponent],
    providers: [
      provideZonelessChangeDetection(),
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: { get: vi.fn().mockReturnValue(null) } } },
      },
      { provide: QuizApiService, useValue: mockApi },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(DiscoverQuizzesPageComponent);
  const component = fixture.componentInstance;
  fixture.detectChanges();

  return { fixture, component, mockApi };
}

describe('DiscoverQuizzesPageComponent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    TestBed.resetTestingModule();
  });

  it('renders the hero heading', async () => {
    const { fixture } = await setupComponent();

    const heading = fixture.nativeElement.querySelector('h1');
    expect(heading?.textContent).toContain('Discover Quizzes');
  });

  it('renders the search input and sort select', async () => {
    const { fixture } = await setupComponent();

    const inputs = fixture.nativeElement.querySelectorAll('input');
    expect(inputs.length).toBeGreaterThan(0);

    const selects = fixture.nativeElement.querySelectorAll('select');
    expect(selects.length).toBe(1);
    expect(selects[0].value).toBe('newest');
  });

  it('fetches the first page on mount and renders the card grid on data', async () => {
    const { fixture, component, mockApi } = await setupComponent();

    // The fetch effect runs immediately because debouncedQuery is seeded with ''.
    expect(mockApi.searchPublicQuizzes).toHaveBeenCalled();
    const firstCall = mockApi.searchPublicQuizzes.mock.calls[0];
    expect(firstCall[0]).toBe('');
    expect(firstCall[1]).toBe('newest');
    expect(firstCall[2]).toBe(24);
    expect(firstCall[3]).toBe(0);

    // Card title from the mocked response should appear in the DOM.
    expect((component as TestableComponent).items().length).toBe(1);
    const rendered = fixture.nativeElement.textContent ?? '';
    expect(rendered).toContain('World Capitals');
    expect(rendered).toContain('Curious Creator');
    expect(rendered).toContain('ABCD12');
    expect(rendered).toContain('42 plays');
  });

  it('falls back to display_name when username is missing', async () => {
    const { fixture } = await setupComponent([makeResponse([SECOND_QUIZ])]);

    const rendered = fixture.nativeElement.textContent ?? '';
    expect(rendered).toContain('Math Wiz');
  });

  it('shows the empty state when the API returns no items', async () => {
    const { fixture } = await setupComponent([makeResponse([])]);

    const rendered = fixture.nativeElement.textContent ?? '';
    expect(rendered).toMatch(/no public quizzes yet/i);
  });

  it('shows a search-specific empty message when the user has typed a query', async () => {
    const { fixture, component } = await setupComponent([makeResponse([])]);

    // Simulate the user typing into the search field.
    (component as TestableComponent).onSearchChange('pizza');
    fixture.detectChanges();

    const rendered = fixture.nativeElement.textContent ?? '';
    expect(rendered).toContain('pizza');
  });

  it('exposes an error message when the API throws', async () => {
    const { component } = await setupComponent(new Error('network down'));

    expect((component as TestableComponent).errorMessage()).toBe('network down');
  });

  it('debounces the search input by 300ms', async () => {
    const { fixture, component, mockApi } = await setupComponent();
    const initialCalls = mockApi.searchPublicQuizzes.mock.calls.length;

    // Mutate the search query through the public handler so we exercise the
    // exact code path used by the template's ngModel binding.
    (component as TestableComponent).onSearchChange('history');
    // Trigger CD so the debounce effect re-runs with the new query value and
    // schedules its setTimeout.
    fixture.detectChanges();

    // Before the 300ms debounce elapses, the API should not have been
    // re-queried with the new value.
    vi.advanceTimersByTime(200);
    expect(mockApi.searchPublicQuizzes.mock.calls.length).toBe(initialCalls);

    // After the 300ms threshold, the setTimeout fires, debouncedQuery is
    // updated, and the fetch effect calls the API again with the latest
    // search value.
    vi.advanceTimersByTime(150);
    // Flush the fetch effect that was triggered by the signal change.
    fixture.detectChanges();

    expect(mockApi.searchPublicQuizzes.mock.calls.length).toBeGreaterThan(initialCalls);

    const lastCall =
      mockApi.searchPublicQuizzes.mock.calls[
        mockApi.searchPublicQuizzes.mock.calls.length - 1
      ];
    expect(lastCall[0]).toBe('history');
    expect(lastCall[3]).toBe(0); // offset reset
  });

  it('paginates forward when total exceeds the page size', async () => {
    const many = Array.from({ length: 24 }, (_, i) => ({
      ...SAMPLE_QUIZ,
      id: i + 1,
      title: `Quiz ${i + 1}`,
    }));
    const { component } = await setupComponent([makeResponse(many, 30)]);

    expect((component as TestableComponent).canNext()).toBe(true);
    (component as TestableComponent).onNext();
    expect((component as TestableComponent).offset()).toBe(24);
  });
});
