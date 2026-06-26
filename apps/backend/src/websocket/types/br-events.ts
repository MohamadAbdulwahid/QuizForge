/**
 * Bubbly Royale WebSocket event type definitions.
 *
 * Server→Client events are emitted by the game namespace during BR gameplay.
 * Client→Server events are sent by the frontend and validated via Zod schemas.
 */

import type { PowerUp, Curse } from '../../game/engine/bubbly-royale.engine';

/** A question option (id + text). */
export interface OptionItem {
  id: string;
  text: string;
}

// ---------------------------------------------------------------------------
// Server→Client Event Payloads
// ---------------------------------------------------------------------------

/** Emitted when two players are paired for a duel (spotlight announcement). */
export interface BrDuelPairedEvent {
  duelId: string;
  player1Id: string;
  player1Name: string;
  player2Id: string;
  player2Name: string;
  player1Lives: number;
  player2Lives: number;
}

/** Emitted to the room showing the duel question and per-player timer. */
export interface BrDuelQuestionEvent {
  duelId: string;
  question: {
    text: string;
    options: OptionItem[];
    timerMs: number;
  };
  /** Active power-ups/curses affecting this duel (visible to spectators). */
  activePowerUps?: { playerId: string; type: string }[];
}

/** Emitted when a duel concludes — shows outcome, lives lost, and consumed power-ups. */
export interface BrDuelResultEvent {
  duelId: string;
  winnerId: string | null;
  loserId: string | null;
  correctAnswer: string;
  player1TimeMs: number | null;
  player2TimeMs: number | null;
  player1Correct: boolean;
  player2Correct: boolean;
  tie: boolean;
  livesLost: { playerId: string; lives: number }[];
  powerUpConsumed?: { playerId: string; type: string };
}

/** Emitted when a player loses one or more lives. */
export interface BrLifeLostEvent {
  playerId: string;
  lives: number;
  reason: 'duel' | 'curse' | 'double-pop';
  cursedBy?: string;
}

/** Emitted when a player reaches 0 lives and is out of the game. */
export interface BrPlayerEliminatedEvent {
  playerId: string;
  playerName: string;
}

/** Emitted at the start of a Bubble Pop round — bubble positions and timer. */
export interface BrBubblePopStartEvent {
  round: number;
  bubbles: { number: number; x: number; y: number }[];
  timerMs: number;
}

/** Emitted after a Bubble Pop round — rankings of all participants. */
export interface BrBubblePopRankingEvent {
  round: number;
  rankings: { playerId: string; timeMs: number | null; bubblesReached: number }[];
}

/** Sent privately to a player when they earn a power-up. */
export interface BrPowerUpAwardedEvent {
  playerId: string;
  powerUp: PowerUp;
}

/** Sent privately to a player when they earn a curse. */
export interface BrCurseAwardedEvent {
  playerId: string;
  curse: Curse;
}

/** Emitted to the room when a curse is cast on a player. */
export interface BrCurseCastEvent {
  curseType: string;
  targetId: string;
  targetName: string;
  casterId: string;
  casterName: string;
  effect: string;
}

/** Sent privately to a player when they enter spectator mode (0 lives). */
export interface BrSpectatorModeEvent {
  playerId: string;
}

/** Emitted to the room when only one player remains — game over. */
export interface BrRoyaleWinnerEvent {
  playerId: string;
  playerName: string;
  livesRemaining: number;
}

/** Emitted to the room when transitioning between phases. */
export interface BrRoundTransitionEvent {
  round: number;
  type: 'bubble-pop' | 'duel';
}

/** Sent to all eliminated players with curse tokens, showing available targets. */
export interface BrCurseOpportunityEvent {
  targetPlayers: { id: string; name: string; lives: number }[];
}

/** Full-screen announcement when Life Steal is applied. */
export interface BrLifeStealAnnouncementEvent {
  targetName: string;
  casterName: string;
}

// ---------------------------------------------------------------------------
// Client→Server Event Payloads (validated by Zod schemas)
// ---------------------------------------------------------------------------

/** Player submits their Bubble Pop result. */
export interface SubmitBubblePopPayload {
  pin: string;
  bubblesReached: number;
  timeMs: number | null;
}

/** Player submits their answer in a duel. */
export interface SubmitDuelAnswerPayload {
  pin: string;
  duelId: string;
  answer: string;
}

/** Player uses a power-up or curse from their inventory. */
export interface UsePowerUpPayload {
  pin: string;
  powerUpType: string;
  /** Target player ID (required for curses). */
  targetId?: string;
}

/** Eliminated player casts a curse on an active player. */
export interface CastCursePayload {
  pin: string;
  curseType: string;
  targetPlayerId: string;
}
