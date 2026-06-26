import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrHostPageComponent } from './br-host-page.component';
import { AuthService } from '../../core/services/auth.service';
import { WebsocketService } from '../../core/services/websocket.service';
import { GameStateService } from '../game/services/game-state.service';

/** Mock observables shared across tests. */
function createMockSubjects() {
  return {
    lobbyState$: new Subject(),
    sessionClosed$: new Subject(),
    socketError$: new Subject(),
    duelPaired$: new Subject(),
    duelQuestion$: new Subject(),
    duelResult$: new Subject(),
    lifeLost$: new Subject(),
    playerEliminated$: new Subject(),
    lifeStealAnnouncement$: new Subject(),
    royaleWinner$: new Subject(),
    powerUpAwarded$: new Subject(),
    curseAwarded$: new Subject(),
    bubblePopStart$: new Subject(),
    bubblePopRanking$: new Subject(),
  };
}

function createMockAuthService() {
  return {
    whenReady: vi.fn().mockResolvedValue(undefined),
    accessToken: vi.fn().mockReturnValue('test-jwt-token'),
    currentUser: vi.fn().mockReturnValue({ id: 'host-123', email: 'host@test.com' }),
  };
}

function createMockWebsocketService(subjects: ReturnType<typeof createMockSubjects>) {
  return {
    connected: vi.fn().mockReturnValue(true),
    reconnecting: vi.fn().mockReturnValue(false),
    connect: vi.fn(),
    disconnect: vi.fn(),
    joinGame: vi.fn(),
    leaveGame: vi.fn(),
    startGame: vi.fn(),
    endSession: vi.fn(),
    lobbyState$: subjects.lobbyState$.asObservable(),
    sessionClosed$: subjects.sessionClosed$.asObservable(),
    socketError$: subjects.socketError$.asObservable(),
    duelPaired$: subjects.duelPaired$.asObservable(),
    duelQuestion$: subjects.duelQuestion$.asObservable(),
    duelResult$: subjects.duelResult$.asObservable(),
    lifeLost$: subjects.lifeLost$.asObservable(),
    playerEliminated$: subjects.playerEliminated$.asObservable(),
    lifeStealAnnouncement$: subjects.lifeStealAnnouncement$.asObservable(),
    royaleWinner$: subjects.royaleWinner$.asObservable(),
    powerUpAwarded$: subjects.powerUpAwarded$.asObservable(),
    curseAwarded$: subjects.curseAwarded$.asObservable(),
    bubblePopStart$: subjects.bubblePopStart$.asObservable(),
    bubblePopRanking$: subjects.bubblePopRanking$.asObservable(),
  };
}

function createMockGameStateService() {
  return {
    setCurrentUserId: vi.fn(),
    setGameMode: vi.fn(),
    setLobbyState: vi.fn(),
    players: vi.fn().mockReturnValue([]),
    hostUserId: vi.fn().mockReturnValue('host-123'),
    eliminatedPlayers: vi.fn().mockReturnValue([]),
    roundType: vi.fn().mockReturnValue(null),
    roundNumber: vi.fn().mockReturnValue(0),
    royaleWinner: vi.fn().mockReturnValue(null),
    currentPairing: vi.fn().mockReturnValue(null),
    startingLives: vi.fn().mockReturnValue(3),
    bubblePopState: vi.fn().mockReturnValue(null),
  };
}

describe('BrHostPageComponent', () => {
  let component: BrHostPageComponent;
  let fixture: ComponentFixture<BrHostPageComponent>;
  let wsSubjects: ReturnType<typeof createMockSubjects>;
  let mockWs: ReturnType<typeof createMockWebsocketService>;
  let mockAuth: ReturnType<typeof createMockAuthService>;
  let mockGameState: ReturnType<typeof createMockGameStateService>;
  let mockRouter: { navigateByUrl: ReturnType<typeof vi.fn>; navigate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vi.clearAllMocks();
    wsSubjects = createMockSubjects();
    mockWs = createMockWebsocketService(wsSubjects);
    mockAuth = createMockAuthService();
    mockGameState = createMockGameStateService();
    mockRouter = { navigateByUrl: vi.fn(), navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [BrHostPageComponent],
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: vi.fn().mockReturnValue('123456') } },
          },
        },
        { provide: Router, useValue: mockRouter },
        { provide: AuthService, useValue: mockAuth },
        { provide: WebsocketService, useValue: mockWs },
        { provide: GameStateService, useValue: mockGameState },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BrHostPageComponent);
    component = fixture.componentInstance;
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should call connect and joinGame on init with valid PIN', async () => {
    await fixture.whenStable();

    expect(mockAuth.whenReady).toHaveBeenCalled();
    expect(mockWs.connect).toHaveBeenCalledWith('test-jwt-token');
    expect(mockWs.joinGame).toHaveBeenCalledWith('123456', 'host');
  });

  it('should set error on invalid PIN format', async () => {
    // Re-create TestBed with an invalid PIN
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [BrHostPageComponent],
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: vi.fn().mockReturnValue('abc') } },
          },
        },
        { provide: Router, useValue: mockRouter },
        { provide: AuthService, useValue: mockAuth },
        { provide: WebsocketService, useValue: mockWs },
        { provide: GameStateService, useValue: mockGameState },
      ],
    }).compileComponents();

    const invalidFixture = TestBed.createComponent(BrHostPageComponent);
    const invalidComponent = invalidFixture.componentInstance;
    await invalidFixture.whenStable();
    invalidFixture.detectChanges();

    // Check the DOM for the error message (protected signals accessible via cast)
    const errorMsg = (invalidComponent as unknown as { errorMessage: () => string }).errorMessage();
    expect(errorMsg).toContain('Invalid');
    expect(errorMsg).toContain('PIN');
  });

  it('should emit startGame when startGame() is called', () => {
    component.startGame();
    expect(mockWs.startGame).toHaveBeenCalled();
  });

  it('should call GameStateService setCurrentUserId and setGameMode on init', async () => {
    await fixture.whenStable();

    expect(mockGameState.setCurrentUserId).toHaveBeenCalledWith('host-123');
    expect(mockGameState.setGameMode).toHaveBeenCalledWith('bubbly-royale');
  });
});
