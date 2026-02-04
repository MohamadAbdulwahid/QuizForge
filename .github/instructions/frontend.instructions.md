---
applyTo: "apps/frontend/**/*.ts"
---

# QuizForge Frontend Instructions (Angular v21)

## Technology Stack
- **Framework**: Angular v21.1+ (latest stable, standalone components only)
- **Build Tool**: Vite (Angular CLI with Vite builder)
- **Styling**: Tailwind CSS v4.1+ + DaisyUI v5.5+
- **State Management**: Angular Signals (`resource()`, `rxResource()`) for data fetching and state. RxJS reserved strictly for asynchronous streams (API requests, countdown timers, WebSocket streams)
- **Change Detection**: Zoneless (Angular 19+) - no Zone.js for optimal performance on low-end devices
- **Testing**: Vitest + Angular Testing Library
- **E2E**: Playwright (single worker for 2GB RAM limit)
- **HTTP Client**: Angular HttpClient
- **WebSockets**: Socket.IO client v4.7+
- **Fonts**: DynaPuff (headings, display), Nunito (body, UI)
- **Icons**: Heroicons (rounded variants for bubbly consistency)
- **Rendering Strategy**: Hybrid Rendering (Angular 19+)
  - Marketing/Auth pages: **SSG** (Prerendered)
  - Public quiz pages: **SSR** (Server-Side Rendered)
  - Game engine: **CSR** (Client-Side Rendered for real-time interactivity)
- **Performance**: `@defer` blocks for non-critical UI, aggressive code splitting

## Rendering Strategy Details

### Hybrid Rendering Configuration

**Philosophy**: Offload heavy rendering from low-end devices to the Bun server. Prerender static content for instant load times.

**Route Configuration:**
```typescript
// apps/frontend/src/app/app.routes.ts
import { Routes } from '@angular/router';

export const routes: Routes = [
  // SSG (Prerendered) - Marketing & Auth
  {
    path: '',
    loadComponent: () => import('./features/landing/landing.component'),
    data: { prerender: true }, // Static generation
  },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes'),
    data: { prerender: true },
  },
  
  // SSR - Public quiz pages (dynamic data, SEO important)
  {
    path: 'quiz/:shareCode',
    loadComponent: () => import('./features/quiz-preview/quiz-preview.component'),
    // SSR by default, no prerender flag
  },
  {
    path: 'discover',
    loadComponent: () => import('./features/discover/discover.component'),
  },
  
  // CSR - Game engine (real-time, no SEO needed)
  {
    path: 'game/:pin',
    loadChildren: () => import('./features/game/game.routes'),
    data: { ssr: false }, // Client-side only
  },
];
```

**Zoneless Change Detection Setup:**
```typescript
// apps/frontend/src/main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { provideExperimentalZonelessChangeDetection } from '@angular/core';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

bootstrapApplication(AppComponent, {
  providers: [
    provideExperimentalZonelessChangeDetection(), // No Zone.js
    ...appConfig.providers,
  ],
}).catch((err) => console.error(err));
```

**Deferred Loading for Non-Critical UI:**
```html
<!-- Use @defer for everything below-the-fold or non-essential -->
<div class="quiz-card">
  <h2>{{ quiz.title }}</h2>
  
  @defer (on viewport) {
    <!-- Heavy chart/stats component -->
    <app-quiz-statistics [quizId]="quiz.id" />
  } @placeholder {
    <div class="skeleton h-32 rounded-2xl"></div>
  }
</div>

<!-- Defer images -->
@defer (on idle) {
  <img [src]="quiz.thumbnail" alt="Quiz thumbnail" />
} @placeholder {
  <div class="bg-secondary rounded-2xl w-full h-48"></div>
}
```

## Design System: Bubbly Minimalism Implementation

### Core Philosophy
Professional Playground aesthetic: clean/spacious for classrooms, energetic for engagement. NO sharp corners or corporate stiffness.

### DaisyUI Theme Configuration
```css
/* apps/frontend/src/styles.css */
@import 'tailwindcss';

@layer base {
  :root {
    --background: #f9fafb; /* Light gray */
    --primary: #00a5e0;    /* Cyan-blue */
    --secondary: #93c1eb;  /* Light blue-gray */
    --accent: #cd2750;     /* Pink-red for CTAs */
    --text: #070f18;       /* Near-black */
  }
  
  [data-theme="dark"] {
    --background: #040506; /* Dark gray */
    --primary: #1fc3ff;    /* Bright cyan */
    --secondary: #14416c;  /* Dark blue */
    --accent: #d8315b;     /* Bright pink */
    --text: #e7eff8;       /* Light gray-blue */
  }

  body {
    background-color: var(--background);
    color: var(--text);
    font-family: 'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  h1, h2, h3, .font-display {
    font-family: 'DynaPuff', cursive;
  }
}
```

### Component Styling Rules
```html
<!-- Bubbly Button Component -->
<button 
  class="btn btn-primary px-6 py-3 rounded-2xl shadow-sm hover:shadow-md hover:scale-105 transition-all duration-150 font-semibold"
>
  Play Now
</button>

<!-- Bubbly Card Component -->
<div class="card bg-secondary rounded-3xl p-6 shadow-lg hover:shadow-xl transition-shadow">
  <div class="card-body">
    <h2 class="card-title font-display text-2xl text-primary">Quiz Title</h2>
    <p>Description text with Nunito font</p>
  </div>
</div>
```

### Responsive Design Rules
- **Mobile-first**: All styles default to mobile (`base`), enhance with `sm:`, `md:`, `lg:`
- **Touch targets**: Minimum 44px height/width for all interactive elements
- **Font scaling**: Use `text-base` (16px) minimum for body text, `text-lg` or larger for questions
- **Breakpoints**: 
  - `sm`: 640px (tablets)
  - `md`: 768px (small laptops)
  - `lg`: 1024px (desktops)

## Angular Architecture

### Project Structure
```
apps/frontend/src/app/
├── core/
│   ├── components/        # Singleton components (header, nav, footer)
│   │   ├── header.component.ts
│   │   └── footer.component.ts
│   ├── guards/            # Route guards (auth, game-state)
│   │   ├── auth.guard.ts
│   │   └── game-active.guard.ts
│   ├── interceptors/      # HTTP interceptors (auth, error)
│   │   ├── auth.interceptor.ts
│   │   └── error.interceptor.ts
│   ├── services/          # Core singleton services
│   │   ├── auth.service.ts
│   │   ├── websocket.service.ts
│   │   └── api.service.ts
│   └── models/            # Core interfaces/types
│       └── user.model.ts
├── features/
│   ├── auth/              # Login, register
│   │   ├── login.component.ts
│   │   ├── register.component.ts
│   │   └── auth.routes.ts
│   ├── dashboard/         # Main screen with tabs
│   │   ├── dashboard.component.ts
│   │   ├── discover/
│   │   ├── history/
│   │   ├── homework/
│   │   └── settings/
│   ├── game/
│   │   ├── lobby/         # Game lobby component
│   │   │   └── lobby.component.ts
│   │   ├── question/      # Question display with timer
│   │   │   └── question.component.ts
│   │   ├── scoring/       # Live scoreboard
│   │   │   └── scoring.component.ts
│   │   └── modes/         # Mode-specific UI components
│   │       └── hot-potato/
│   │           └── hot-potato-display.component.ts
│   ├── quiz-builder/      # Create/edit quizzes
│   │   └── builder.component.ts
│   └── quiz-preview/      # Public quiz preview (SSR)
│       └── quiz-preview.component.ts
├── shared/
│   ├── ui/                # Reusable UI components (Bubbly style)
│   │   ├── button/
│   │   │   └── button.component.ts
│   │   ├── card/
│   │   │   └── card.component.ts
│   │   ├── timer/
│   │   │   └── timer.component.ts
│   │   └── icon/
│   │       └── icon.component.ts
│   ├── pipes/             # Custom pipes
│   │   └── time-format.pipe.ts
│   ├── directives/        # Custom directives
│   │   └── auto-focus.directive.ts
│   └── utils/             # Helper functions
│       └── validators.ts
└── app.config.ts          # App-level providers
```

### Module Structure
- **Standalone components only**: Angular v21 default, no NgModules
- **Lazy loading**: Each feature directory lazy-loaded via routing
- **Core services**: Use `providedIn: 'root'` for singleton services
- **Shared imports**: Create barrel exports in `shared/` for commonly used utilities

## Component Design Standards

### Component Anatomy
```typescript
// apps/frontend/src/app/features/game/question/question.component.ts
import { Component, input, output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import type { IQuestion } from '@quizforge/shared-types';

@Component({
  selector: 'app-question',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  templateUrl: './question.component.html',
  styleUrl: './question.component.css',
})
export class QuestionComponent {
  // Inputs (signal-based in Angular v21)
  question = input.required<IQuestion>();
  timeRemaining = input<number>(0);
  
  // Outputs
  answerSubmitted = output<string>();
  
  // Local state (signals)
  selectedAnswer = signal<string | null>(null);
  
  // Computed values
  isAnswerSelected = computed(() => this.selectedAnswer() !== null);
  
  submitAnswer(): void {
    const answer = this.selectedAnswer();
    if (answer) {
      this.answerSubmitted.emit(answer);
    }
  }
}
```

### Template Standards
```html
<!-- question.component.html -->
<div class="card bg-secondary rounded-3xl p-6 shadow-lg max-w-2xl mx-auto">
  <div class="card-body">
    <!-- Question text -->
    <h2 class="card-title font-display text-2xl text-primary mb-4">
      {{ question().text }}
    </h2>
    
    <!-- Timer with live update -->
    <div class="flex items-center justify-center mb-6">
      <span class="text-accent font-display text-3xl" aria-live="polite">
        {{ timeRemaining() }}
      </span>
    </div>
    
    <!-- Answer options -->
    <div class="grid gap-4 mb-6">
      @for (option of question().options; track option.id) {
        <button
          type="button"
          class="btn btn-secondary w-full justify-start px-4 py-3 rounded-2xl hover:bg-primary hover:text-white transition-colors"
          [class.bg-primary]="selectedAnswer() === option.id"
          [class.text-white]="selectedAnswer() === option.id"
          (click)="selectedAnswer.set(option.id)"
          [attr.aria-pressed]="selectedAnswer() === option.id"
        >
          {{ option.text }}
        </button>
      }
    </div>
    
    <!-- Submit button -->
    <div class="card-actions justify-center">
      <app-button
        [disabled]="!isAnswerSelected()"
        (clicked)="submitAnswer()"
        class="w-full"
      >
        Submit Answer
      </app-button>
    </div>
  </div>
</div>
```

### Styling Guidelines
```css
/* question.component.css */
/* Minimal CSS - use Tailwind classes in template */

/* Only add custom CSS for animations not covered by Tailwind */
@keyframes pulse-accent {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.timer-warning {
  animation: pulse-accent 1s ease-in-out infinite;
}

/* Respect reduced motion */
@media (prefers-reduced-motion: reduce) {
  .timer-warning {
    animation: none;
  }
}
```

### Template Best Practices
- **Use signal inputs**: `input()` and `input.required()` for component inputs
- **Signal outputs**: `output()` for event emitters
- **TrackBy function**: All `@for` loops must use `track` expression
- **Accessibility**: Use `aria-label`, `aria-live`, `role`, and semantic HTML
- **No logic in templates**: Move complex conditions to computed signals
- **Control flow**: Use new Angular control flow (`@if`, `@for`, `@defer`) instead of `*ngIf`, `*ngFor`

## State Management with Signals

### Data Fetching with `resource()`

**Philosophy**: Use Angular's new `resource()` API for data fetching. RxJS is only for streams (WebSockets, timers).

```typescript
// apps/frontend/src/app/features/discover/discover.component.ts
import { Component, resource, inject } from '@angular/core';
import { ApiService } from '../../core/services/api.service';
import type { IQuiz } from '@quizforge/shared-types';

@Component({
  selector: 'app-discover',
  standalone: true,
  templateUrl: './discover.component.html',
})
export class DiscoverComponent {
  private apiService = inject(ApiService);
  
  // Resource for data fetching (auto-handles loading/error states)
  quizzes = resource<IQuiz[], void>({
    loader: async () => {
      return this.apiService.getPublicQuizzes();
    },
  });
  
  // Access states in template:
  // quizzes.isLoading()
  // quizzes.value()
  // quizzes.error()
}
```

**Template usage:**
```html
@if (quizzes.isLoading()) {
  <div class="grid gap-4">
    @for (_ of [1,2,3]; track $index) {
      <div class="skeleton h-32 rounded-3xl"></div>
    }
  </div>
} @else if (quizzes.error()) {
  <div class="alert alert-error rounded-2xl">
    <span>Failed to load quizzes. Please try again.</span>
  </div>
} @else {
  <div class="grid gap-4">
    @for (quiz of quizzes.value(); track quiz.id) {
      <app-quiz-card [quiz]="quiz" />
    }
  </div>
}
```

### Reactive Data with `rxResource()`

Use when you need to react to input changes (e.g., search, filters):

```typescript
// apps/frontend/src/app/features/discover/discover.component.ts
import { Component, rxResource, signal, inject } from '@angular/core';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-discover',
  standalone: true,
  templateUrl: './discover.component.html',
})
export class DiscoverComponent {
  private apiService = inject(ApiService);
  
  // Signal for reactive input
  searchQuery = signal<string>('');
  
  // rxResource that reloads when searchQuery changes
  quizzes = rxResource({
    request: () => ({ query: this.searchQuery() }),
    loader: async ({ request }) => {
      return this.apiService.searchQuizzes(request.query);
    },
  });
  
  onSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
    // rxResource automatically reloads
  }
}
```

### Global State Service

```typescript
// apps/frontend/src/app/core/services/game-state.service.ts
import { Injectable, signal, computed } from '@angular/core';
import type { GameState, Player } from '@quizforge/shared-types';

@Injectable({ providedIn: 'root' })
export class GameStateService {
  // Private writable signals
  private state = signal<GameState>({
    status: 'waiting',
    players: [],
    currentQuestionIndex: 0,
    currentQuestion: null,
  });
  
  // Public readonly signals
  readonly gameState = this.state.asReadonly();
  
  // Computed values
  readonly currentQuestion = computed(() => this.state().currentQuestion);
  readonly leaderboard = computed(() => 
    [...this.state().players].sort((a, b) => b.score - a.score)
  );
  readonly isGameActive = computed(() => 
    this.state().status === 'playing'
  );
  
  // Actions (mutations)
  updateScore(playerId: string, points: number): void {
    this.state.update(current => ({
      ...current,
      players: current.players.map(p => 
        p.id === playerId ? { ...p, score: p.score + points } : p
      ),
    }));
  }
  
  setCurrentQuestion(question: IQuestion): void {
    this.state.update(current => ({
      ...current,
      currentQuestion: question,
      currentQuestionIndex: current.currentQuestionIndex + 1,
    }));
  }
  
  addPlayer(player: Player): void {
    this.state.update(current => ({
      ...current,
      players: [...current.players, player],
    }));
  }
  
  reset(): void {
    this.state.set({
      status: 'waiting',
      players: [],
      currentQuestionIndex: 0,
      currentQuestion: null,
    });
  }
}
```

**Usage in components:**
```typescript
@Component({...})
export class GameComponent {
  gameState = inject(GameStateService);
  
  // Access in template:
  // {{ gameState.currentQuestion()?.text }}
  // {{ gameState.leaderboard().length }}
}
```

### RxJS: Only for Streams

**Use RxJS ONLY for:**
- WebSocket message streams
- Countdown timers
- HTTP requests (inside `rxResource` loader)
- Continuous data streams

```typescript
// apps/frontend/src/app/core/services/websocket.service.ts
import { Injectable, inject } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable, fromEvent } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { IQuestion, ScoreUpdate } from '@quizforge/shared-types';

@Injectable({ providedIn: 'root' })
export class WebsocketService {
  private socket: Socket;
  
  // RxJS for WebSocket streams
  readonly question$: Observable<IQuestion>;
  readonly scoreUpdate$: Observable<ScoreUpdate>;
  readonly playerJoined$: Observable<Player>;
  
  constructor() {
    this.socket = io(environment.wsUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 3,
      auth: (cb) => {
        const token = localStorage.getItem('supabase_token');
        cb({ token });
      },
    });
    
    // Convert Socket.IO events to RxJS observables
    this.question$ = fromEvent<IQuestion>(this.socket, 'question');
    this.scoreUpdate$ = fromEvent<ScoreUpdate>(this.socket, 'score-update');
    this.playerJoined$ = fromEvent<Player>(this.socket, 'player-joined');
    
    // Connection monitoring
    this.socket.on('connect', () => {
      console.log('WebSocket connected:', this.socket.id);
    });
    
    this.socket.on('disconnect', (reason) => {
      console.warn('WebSocket disconnected:', reason);
    });
  }
  
  // Actions
  joinGame(pin: string, username: string): void {
    this.socket.emit('join-game', { pin, username });
  }
  
  submitAnswer(answer: string, questionId: string): void {
    this.socket.emit('submit-answer', { answer, questionId });
  }
  
  disconnect(): void {
    this.socket.disconnect();
  }
}
```

**Consuming WebSocket streams in components:**
```typescript
@Component({...})
export class LobbyComponent {
  private wsService = inject(WebsocketService);
  private gameState = inject(GameStateService);
  
  constructor() {
    // Subscribe to WebSocket streams and update signals
    this.wsService.question$.subscribe(question => {
      this.gameState.setCurrentQuestion(question);
    });
    
    this.wsService.scoreUpdate$.subscribe(update => {
      this.gameState.updateScore(update.playerId, update.points);
    });
    
    this.wsService.playerJoined$.subscribe(player => {
      this.gameState.addPlayer(player);
    });
  }
}
```

## API Client with Supabase Auth

### HTTP Service
```typescript
// apps/frontend/src/app/core/services/api.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { CreateQuizRequest, CreateQuizResponse, IQuiz } from '@quizforge/shared-types';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;
  
  /**
   * Generic GET request with JWT auth
   */
  async get<T>(endpoint: string): Promise<T> {
    const headers = await this.getAuthHeaders();
    return firstValueFrom(
      this.http.get<T>(`${this.baseUrl}${endpoint}`, { headers })
    );
  }
  
  /**
   * Generic POST request with JWT auth
   */
  async post<T>(endpoint: string, body: unknown): Promise<T> {
    const headers = await this.getAuthHeaders();
    return firstValueFrom(
      this.http.post<T>(`${this.baseUrl}${endpoint}`, body, { headers })
    );
  }
  
  // Quiz-specific methods
  async getPublicQuizzes(): Promise<IQuiz[]> {
    return this.get<IQuiz[]>('/api/quizzes/public');
  }
  
  async createQuiz(data: CreateQuizRequest): Promise<CreateQuizResponse> {
    return this.post<CreateQuizResponse>('/api/quizzes', data);
  }
  
  async getQuizByShareCode(shareCode: string): Promise<IQuiz> {
    return this.get<IQuiz>(`/api/quizzes/share/${shareCode}`);
  }
  
  private async getAuthHeaders(): Promise<HttpHeaders> {
    const token = localStorage.getItem('supabase_token');
    let headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'API-Version': '1.0',
    });
    
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    
    return headers;
  }
}
```

### Supabase Auth Service
```typescript
// apps/frontend/src/app/core/services/auth.service.ts
import { Injectable, signal, computed } from '@angular/core';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private supabase: SupabaseClient;
  
  // State
  private user = signal<User | null>(null);
  
  // Public signals
  readonly currentUser = this.user.asReadonly();
  readonly isAuthenticated = computed(() => this.user() !== null);
  
  constructor() {
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseAnonKey
    );
    
    // Initialize user state
    this.supabase.auth.getSession().then(({ data: { session } }) => {
      this.user.set(session?.user ?? null);
      if (session?.access_token) {
        localStorage.setItem('supabase_token', session.access_token);
      }
    });
    
    // Listen for auth state changes
    this.supabase.auth.onAuthStateChange((event, session) => {
      this.user.set(session?.user ?? null);
      if (session?.access_token) {
        localStorage.setItem('supabase_token', session.access_token);
      } else {
        localStorage.removeItem('supabase_token');
      }
    });
  }
  
  async signInWithEmail(email: string, password: string): Promise<void> {
    const { error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) throw error;
  }
  
  async signUp(email: string, password: string, username: string): Promise<void> {
    const { error } = await this.supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
      },
    });
    
    if (error) throw error;
  }
  
  async signOut(): Promise<void> {
    const { error } = await this.supabase.auth.signOut();
    if (error) throw error;
  }
}
```

## Testing Standards

### Vitest + Angular Testing Library

**Note**: Nx generates the Vitest configuration automatically. The following shows the expected setup:

**Unit Test Example:**
```typescript
// apps/frontend/src/app/features/game/question/question.component.spec.ts
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { QuestionComponent } from './question.component';
import type { IQuestion } from '@quizforge/shared-types';

describe('QuestionComponent', () => {
  const mockQuestion: IQuestion = {
    id: 'q1',
    text: 'What is 2+2?',
    type: 'multiple-choice',
    options: [
      { id: 'a', text: '3' },
      { id: 'b', text: '4' },
    ],
    correctAnswer: 'b',
    timeLimit: 30,
    points: 100,
  };

  it('should render question text', async () => {
    await render(QuestionComponent, {
      inputs: { question: mockQuestion },
    });

    expect(screen.getByText('What is 2+2?')).toBeDefined();
  });

  it('should emit answer when submitted', async () => {
    const user = userEvent.setup();
    const answerSpy = vi.fn();
    
    await render(QuestionComponent, {
      inputs: { question: mockQuestion },
      on: { answerSubmitted: answerSpy },
    });

    // Select answer
    const option = screen.getByText('4');
    await user.click(option);

    // Submit
    const submitBtn = screen.getByText('Submit Answer');
    await user.click(submitBtn);

    expect(answerSpy).toHaveBeenCalledWith('b');
  });

  it('should not allow submission without selection', async () => {
    const answerSpy = vi.fn();
    
    await render(QuestionComponent, {
      inputs: { question: mockQuestion },
      on: { answerSubmitted: answerSpy },
    });

    const submitBtn = screen.getByText('Submit Answer');
    expect(submitBtn).toHaveAttribute('disabled');
  });
});
```

### E2E Tests with Playwright

**Key Configuration** (Nx generates `playwright.config.ts` - customize with these settings):
- **workers: 1** - Single worker for 2GB RAM limit
- **timeout: 30000** - 30s timeout per test
- **retries: 2** - Retry flaky tests
- **Projects**: Test on both Desktop Chrome and mobile (iPhone 12)

**E2E Test Example:**
```typescript
// apps/frontend/tests/e2e/game-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Complete Game Flow', () => {
  test('should join game and answer questions', async ({ page }) => {
    // Navigate to join page
    await page.goto('/join');

    // Join game
    await page.fill('[data-testid="pin-input"]', 'ABC123');
    await page.fill('[data-testid="username-input"]', 'TestPlayer');
    await page.click('[data-testid="join-button"]');

    // Verify lobby
    await expect(page.locator('[data-testid="lobby-status"]')).toContainText('Waiting');

    // Wait for game start
    await expect(page.locator('[data-testid="question-card"]')).toBeVisible({
      timeout: 10000,
    });

    // Answer first question
    await page.click('[data-testid="answer-option"] >> nth=0');
    await page.click('[data-testid="submit-button"]');

    // Verify score update
    await expect(page.locator('[data-testid="score-display"]')).toContainText('100');
  });

  test('should handle disconnection gracefully', async ({ page, context }) => {
    await page.goto('/join');
    await page.fill('[data-testid="pin-input"]', 'ABC123');
    await page.fill('[data-testid="username-input"]', 'TestPlayer');
    await page.click('[data-testid="join-button"]');

    // Simulate offline
    await context.setOffline(true);

    // Should show reconnection UI
    await expect(page.locator('[data-testid="connection-status"]')).toContainText(
      'Disconnected'
    );

    // Reconnect
    await context.setOffline(false);
    await expect(page.locator('[data-testid="connection-status"]')).toContainText(
      'Connected'
    );
  });
});
```

## Performance Optimization

### Angular Performance Checklist
- ✅ **Zoneless change detection**: Enabled globally in `main.ts`
- ✅ **Signals everywhere**: All state uses signals, not observables (except streams)
- ✅ **Lazy loading**: All features lazy-loaded via routing
- ✅ **@defer blocks**: Non-critical UI deferred (below-fold, modals, charts)
- ✅ **TrackBy**: All `@for` loops use `track` expression
- ✅ **Bundle size**: Keep main bundle <200KB (analyze with `vite-bundle-visualizer`)
- ✅ **Image optimization**: WebP format, lazy loading, proper sizing
- ✅ **Code splitting**: Dynamic imports for heavy libraries

### Lighthouse Performance Targets
- **Performance**: >90
- **Accessibility**: 100
- **Best Practices**: >90
- **SEO**: >90
- **First Contentful Paint (FCP)**: <1.5s
- **Largest Contentful Paint (LCP)**: <2.5s
- **Time to Interactive (TTI)**: <3.5s

### Bundle Optimization

**Strategy** (configure in Nx-generated `vite.config.ts` if needed):
- Split vendor chunks: Angular core, third-party UI libraries
- Target: Main bundle <200KB, vendor chunks <500KB
- Use `vite-bundle-visualizer` to analyze bundle size

### WebSocket Performance
- **Throttle updates**: Use RxJS `throttleTime(100)` for high-frequency events
- **Binary frames**: Socket.IO supports binary for large payloads
- **Single connection**: Share WebSocket service singleton across components
- **Cleanup**: Unsubscribe in component destroy

```typescript
@Component({...})
export class GameComponent {
  private wsService = inject(WebsocketService);
  private destroy$ = new Subject<void>();
  
  constructor() {
    // Auto-unsubscribe on destroy
    this.wsService.scoreUpdate$
      .pipe(
        throttleTime(100), // Max 10 updates/second
        takeUntil(this.destroy$)
      )
      .subscribe(update => {
        this.gameState.updateScore(update.playerId, update.points);
      });
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
```

## Accessibility (WCAG 2.1 AA)

### Requirements
- **Keyboard navigation**: All interactive elements focusable, logical Tab order
- **Screen readers**: Use `aria-label`, `aria-live="polite"` for dynamic updates
- **Color contrast**: 4.5:1 ratio for normal text, 3:1 for large text (DaisyUI themes comply)
- **Focus indicators**: Visible focus rings (`focus:ring-2 focus:ring-primary`)
- **Motion**: Respect `prefers-reduced-motion` (disable animations)
- **Semantic HTML**: Use `<button>`, `<nav>`, `<main>`, not `<div>` everywhere

### Implementation Examples
```html
<!-- Accessible question card -->
<div class="card" role="region" aria-labelledby="question-heading">
  <h2 id="question-heading" class="font-display text-2xl text-primary">
    {{ question().text }}
  </h2>
  
  <!-- Live region for timer (screen reader announcement) -->
  <div aria-live="polite" aria-atomic="true" class="sr-only">
    Time remaining: {{ timeRemaining() }} seconds
  </div>
  
  <!-- Accessible button group -->
  <div role="group" aria-label="Answer options">
    @for (option of question().options; track option.id) {
      <button
        type="button"
        class="btn rounded-2xl"
        [attr.aria-pressed]="selectedAnswer() === option.id"
        (click)="selectedAnswer.set(option.id)"
      >
        {{ option.text }}
      </button>
    }
  </div>
</div>

<!-- Respect reduced motion -->
<style>
@media (prefers-reduced-motion: reduce) {
  .hover\:scale-105:hover {
    transform: none;
  }
  
  .transition-all {
    transition: none;
  }
}
</style>
```

## Fonts & Assets

### Google Fonts Import
```html
<!-- apps/frontend/src/index.html -->
<head>
  <meta charset="utf-8" />
  <title>QuizForge</title>
  <base href="/" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  
  <!-- Preconnect for performance -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  
  <!-- Fonts -->
  <link
    href="https://fonts.googleapis.com/css2?family=DynaPuff:wght@400;700&family=Nunito:wght@400;600;700&display=swap"
    rel="stylesheet"
  />
</head>
```

### Icon Component (Heroicons)
```typescript
// apps/frontend/src/app/shared/ui/icon/icon.component.ts
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-icon',
  standalone: true,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      [attr.class]="class()"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        [attr.d]="iconPath()"
      />
    </svg>
  `,
})
export class IconComponent {
  name = input.required<string>();
  size = input<number>(24);
  class = input<string>('');
  
  // Map of Heroicons paths (rounded variants)
  private readonly icons: Record<string, string> = {
    'play': 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z',
    'user': 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    // Add more as needed
  };
  
  iconPath = (): string => {
    return this.icons[this.name()] || '';
  };
}
```

## Common Pitfalls to Avoid

### Angular-Specific
- ❌ **Don't** use Zone.js (zoneless change detection is enabled)
- ❌ **Don't** use `@Input()` decorator (use signal-based `input()`)
- ❌ **Don't** use `*ngIf`, `*ngFor` (use `@if`, `@for`, `@defer`)
- ❌ **Don't** use BehaviorSubject for state (use `signal()`)
- ❌ **Don't** forget `track` in `@for` loops
- ❌ **Don't** put business logic in templates
- ❌ **Don't** use relative imports (use Nx path mapping)

### Performance
- ❌ **Don't** load all routes eagerly (lazy load features)
- ❌ **Don't** render heavy components above-the-fold without `@defer`
- ❌ **Don't** use large images (optimize to WebP, <100KB)
- ❌ **Don't** subscribe without cleanup (use `takeUntil` or async pipe)
- ✅ **Do** use `@defer` for non-critical UI
- ✅ **Do** test on actual low-end devices (2GB RAM)
- ✅ **Do** keep components small (<200 lines)
- ✅ **Do** use Angular DevTools for profiling

### Accessibility
- ❌ **Don't** use `<div>` for clickable elements (use `<button>`)
- ❌ **Don't** rely only on color to convey information
- ❌ **Don't** ignore keyboard navigation
- ✅ **Do** test with screen readers (NVDA, JAWS, VoiceOver)
- ✅ **Do** provide alt text for images
- ✅ **Do** use semantic HTML

## Architectural Decision Notes

**These topics require future decisions based on MVP progress:**

### Internationalization (i18n)
- **Decision Needed**: i18n approach
  - Options: Angular i18n (built-in), Transloco (third-party)
  - Languages: Start with English, plan for Spanish/French
  - **Current**: Deferred - MVP is English-only

### Progressive Web App (PWA)
- **Decision Needed**: PWA features
  - Service worker for offline support
  - App manifest for "Add to Home Screen"
  - Push notifications for game invites
  - **Current**: Deferred - focus on core gameplay first

### Error Handling & Monitoring
- **Decision Needed**: Error tracking service
  - Options: Sentry, LogRocket, custom logging
  - User-facing error messages (toast notifications)
  - **Current**: Console errors only, add Sentry for production

### Notification System
- **Decision Needed**: Toast/notification library
  - Options: Build custom with DaisyUI, use ngx-toastr
  - Use cases: Errors, success messages, game events
  - **Current**: Basic alerts, improve for MVP

### Modal/Dialog System
- **Decision Needed**: Modal approach
  - Options: Native `<dialog>`, DaisyUI modals, custom service
  - Use cases: Confirmations, quiz preview, settings
  - **Current**: Use DaisyUI modal component

### State Persistence
- **Decision Needed**: Local storage strategy
  - Use cases: Draft quizzes, user preferences, game reconnection
  - Options: LocalStorage, IndexedDB, session storage
  - **Current**: LocalStorage for auth token only

---

**MVP Philosophy**: Start with core features (game engine, quiz builder, real-time gameplay). Add polish (PWA, i18n, advanced monitoring) in later iterations. Prioritize performance on low-end devices above all else.
