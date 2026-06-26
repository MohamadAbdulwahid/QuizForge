import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrPlayerPageComponent } from './br-player-page.component';
import { AuthService } from '../../core/services/auth.service';
import { WebsocketService } from '../../core/services/websocket.service';
import { GameStateService } from './services/game-state.service';
import type { BrDuelState, BrPowerUp, BrCurseToken } from './services/game-state.service';
import { signal } from '@angular/core';

/**
 * Component tests for BrPlayerPageComponent.
 * Verifies signal reading, answer selection flow, and state transitions.
 */

// ── Mocks ──

const mockAuthService = {
  isReady: vi.fn().mockReturnValue(true),
  whenReady: vi.fn().mockResolvedValue(undefined),
  currentUser: vi.fn().mockReturnValue({ id: 'user-1', email: 'player@test.com' } as never),
  accessToken: vi.fn().mockReturnValue('fake-token'),
};

const mockWebsocketService = {
  connected: signal(true),
  reconnecting: signal(false),
  connect: vi.fn(),
  disconnect: vi.fn(),
  joinGame: vi.fn(),
  leaveGame: vi.fn(),
  submitDuelAnswer: vi.fn(),
  submitBubblePop: vi.fn(),
  usePowerUp: vi.fn(),
  castCurse: vi.fn(),
  // Observables for socket events — use Subjects for test control
  lobbyState$: {
    pipe: vi.fn().mockReturnValue({ subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }) }),
  },
  gameStarted$: {
    pipe: vi.fn().mockReturnValue({ subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }) }),
  },
  sessionClosed$: {
    pipe: vi.fn().mockReturnValue({ subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }) }),
  },
  duelQuestion$: {
    pipe: vi.fn().mockReturnValue({ subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }) }),
  },
  duelResult$: {
    pipe: vi.fn().mockReturnValue({ subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }) }),
  },
  duelPaired$: {
    pipe: vi.fn().mockReturnValue({ subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }) }),
  },
  roundTransition$: {
    pipe: vi.fn().mockReturnValue({ subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }) }),
  },
  powerUpAwarded$: {
    pipe: vi.fn().mockReturnValue({ subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }) }),
  },
  curseAwarded$: {
    pipe: vi.fn().mockReturnValue({ subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }) }),
  },
  lifeLost$: {
    pipe: vi.fn().mockReturnValue({ subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }) }),
  },
  playerEliminated$: {
    pipe: vi.fn().mockReturnValue({ subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }) }),
  },
};

/** Creates a fresh mock GameStateService with all required signals. */
function createMockGameState() {
  return {
    // Generic
    gameMode: signal('bubbly-royale'),
    players: signal<Array<{ userId: string; username: string; isHost: boolean }>>([]),
    currentUserId: signal('user-1'),
    hostUserId: signal('host-1'),
    errorMessage: signal<string | null>(null),
    ended: signal(false),
    // BR signals
    lives: signal(3),
    startingLives: signal(3),
    duelState: signal<BrDuelState | null>(null),
    currentPairing: signal<{
      duelId: string;
      player1Id: string;
      player1Name: string;
      player2Id: string;
      player2Name: string;
      player1Lives: number;
      player2Lives: number;
    } | null>(null),
    powerUps: signal<BrPowerUp[]>([]),
    curseTokens: signal<BrCurseToken[]>([]),
    isSpectator: signal(false),
    bubblePopState: signal<{
      bubbles: Array<{ number: number; x: number; y: number }>;
      timerMs: number;
      status: 'waiting' | 'active' | 'finished';
      rankings?: Array<{ playerId: string; timeMs: number | null; bubblesReached: number }>;
    } | null>(null),
    roundNumber: signal(0),
    roundType: signal<'bubble-pop' | 'duel' | null>(null),
    royaleWinner: signal<{ playerId: string; playerName: string; livesRemaining: number } | null>(
      null
    ),
    lifeLostRecently: signal<string | null>(null),
    lifeStealAnnouncement: signal<{ targetName: string; casterName: string } | null>(null),
    eliminatedPlayers: signal<string[]>([]),
    curseOpportunityTargets: signal<Array<{ id: string; name: string; lives: number }>>([]),
    // Methods
    setLobbyState: vi.fn(),
    setCurrentUserId: vi.fn(),
    setGameMode: vi.fn(),
    reset: vi.fn(),
    resetBrState: vi.fn(),
    hasPowerUp: vi.fn().mockReturnValue(false),
  };
}

describe('BrPlayerPageComponent', () => {
  let component: BrPlayerPageComponent;
  let fixture: ComponentFixture<BrPlayerPageComponent>;
  let mockGameState: ReturnType<typeof createMockGameState>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockGameState = createMockGameState();

    await TestBed.configureTestingModule({
      imports: [BrPlayerPageComponent],
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: vi.fn().mockReturnValue('123456') } },
          },
        },
        { provide: Router, useValue: { navigate: vi.fn(), navigateByUrl: vi.fn() } },
        { provide: AuthService, useValue: mockAuthService },
        { provide: WebsocketService, useValue: mockWebsocketService },
        { provide: GameStateService, useValue: mockGameState },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BrPlayerPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // ────────────────────────────────────────────────────────────────
  // Test 1: Displays lives from GameStateService signals
  // ────────────────────────────────────────────────────────────────
  it('displays life hearts based on GameStateService lives signal', async () => {
    // Set up the component with a starting state
    mockGameState.gameMode.set('bubbly-royale');
    mockGameState.lives.set(2);
    mockGameState.startingLives.set(3);
    // Simulate game started so we can see the header
    (component as { gameStarted: ReturnType<typeof signal> }).gameStarted.set(true);
    mockGameState.roundType.set('duel');

    fixture.detectChanges();
    await fixture.whenStable();

    // Header should show 2 filled hearts and 1 empty
    const header = fixture.nativeElement.querySelector('header');
    expect(header).toBeTruthy();

    const hearts = header.querySelectorAll('.life-heart');
    expect(hearts.length).toBe(3); // 3 starting lives

    // Count lost hearts
    const lostHearts = header.querySelectorAll('.life-heart.lost');
    expect(lostHearts.length).toBe(1); // 3 - 2 = 1 lost
  });

  // ────────────────────────────────────────────────────────────────
  // Test 2: Answer selection flow in a duel
  // ────────────────────────────────────────────────────────────────
  it('selects an answer and submits via WebSocket during a duel', async () => {
    // Set up the duel state
    mockGameState.duelState.set({
      duelId: 'duel-1',
      opponentId: 'user-2',
      opponentName: 'Opponent',
      question: {
        text: 'What is the capital of France?',
        options: [
          { id: 'a', text: 'Paris' },
          { id: 'b', text: 'London' },
          { id: 'c', text: 'Berlin' },
          { id: 'd', text: 'Madrid' },
        ],
      },
      timerMs: 25000,
      myAnswer: null,
      opponentAnswered: false,
      result: null,
    });

    (component as { gameStarted: ReturnType<typeof signal> }).gameStarted.set(true);
    mockGameState.roundType.set('duel');
    (component as { duelTimerMs: ReturnType<typeof signal> }).duelTimerMs.set(25000);

    fixture.detectChanges();
    await fixture.whenStable();

    // Verify question is displayed
    const body = fixture.nativeElement.textContent;
    expect(body).toContain('What is the capital of France?');

    // Find answer buttons
    const buttons = fixture.nativeElement.querySelectorAll('.duel-answer-btn');
    expect(buttons.length).toBe(4);

    // Click the first answer (Paris)
    buttons[0].click();
    fixture.detectChanges();

    // Answer should be submitted
    expect(mockWebsocketService.submitDuelAnswer).toHaveBeenCalledWith('123456', 'duel-1', 'a');

    // Verify selected answer is set
    expect(component.selectedAnswer()).toBe('a');
    expect(component.answerSubmitted()).toBe(true);
  });

  // ────────────────────────────────────────────────────────────────
  // Test 3: Shows audience view when watching another duel
  // ────────────────────────────────────────────────────────────────
  it('shows current duel pairing when not participating in a duel', async () => {
    mockGameState.roundType.set('duel');
    mockGameState.duelState.set(null); // not in a duel
    mockGameState.currentPairing.set({
      duelId: 'duel-2',
      player1Id: 'user-2',
      player1Name: 'Alice',
      player2Id: 'user-3',
      player2Name: 'Bob',
      player1Lives: 3,
      player2Lives: 2,
    });

    (component as { gameStarted: ReturnType<typeof signal> }).gameStarted.set(true);

    fixture.detectChanges();
    await fixture.whenStable();

    const body = fixture.nativeElement.textContent;
    expect(body).toContain('Current Duel');
    expect(body).toContain('Alice');
    expect(body).toContain('Bob');
    expect(body).toContain('Watch the duel unfold');
  });

  // ────────────────────────────────────────────────────────────────
  // Test 4: Shows spectator curse footer when eliminated
  // ────────────────────────────────────────────────────────────────
  it('shows curse casting footer in spectator mode during duel rounds', async () => {
    mockGameState.isSpectator.set(true);
    mockGameState.roundType.set('duel');
    mockGameState.curseTokens.set([
      {
        id: 'c1',
        type: 'SlowMotion',
        name: 'Slow Motion',
        description: 'Reduces timer',
        cast: false,
      },
    ]);
    mockGameState.curseOpportunityTargets.set([{ id: 'user-2', name: 'Alice', lives: 2 }]);

    (component as { gameStarted: ReturnType<typeof signal> }).gameStarted.set(true);

    fixture.detectChanges();
    await fixture.whenStable();

    const footer = fixture.nativeElement.querySelector('footer');
    expect(footer).toBeTruthy();
    expect(footer.textContent).toContain('spectator');
    expect(footer.textContent).toContain('Cast Curse');
  });

  // ────────────────────────────────────────────────────────────────
  // Test 5: Shows waiting state before game starts
  // ────────────────────────────────────────────────────────────────
  it('shows waiting for host message before game starts', async () => {
    // gameStarted is false by default
    fixture.detectChanges();
    await fixture.whenStable();

    const body = fixture.nativeElement.textContent;
    expect(body).toContain('Waiting for host');
  });
});
