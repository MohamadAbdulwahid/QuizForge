import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  OnDestroy,
  OnInit,
  output,
  PLATFORM_ID,
  signal,
} from '@angular/core';

/**
 * Single bubble data: number 1–6 and its position as percentage 0–100.
 * Positions can be supplied by the parent or generated internally.
 */
export interface BubbleData {
  readonly number: number;
  readonly x: number;
  readonly y: number;
}

/** Phase of the bubble pop challenge. */
type ChallengePhase = 'countdown' | 'active' | 'complete' | 'waiting';

const WRONG_RESET_MS = 460;

/**
 * Bubble Pop arena — full-screen reflex challenge.
 *
 * Flow:
 *  1. 'waiting'    — bubbles rendered, timer idle, "Click bubble 1 to start"
 *  2. 'countdown'  — 3-2-1-GO overlay, bubbles not yet clickable
 *  3. 'active'     — timer running, clicks count, wrong = red shake + reset
 *  4. 'complete'   — timer stopped, big "Done!" with confetti
 *
 * Emits `bubbleClick(num)` for each correct pop, and `challengeComplete(ms)`
 * when the player pops all 6 in order.
 */
@Component({
  selector: 'app-bubble-pop',
  standalone: true,
  templateUrl: './bubble-pop.component.html',
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }
    `,
  ],
})
export class BubblePopComponent implements OnInit, OnDestroy {
  /**
   * Optional array of 6 bubbles with pre-computed positions.
   * When not provided, random positions are generated on mount.
   */
  readonly bubbles = input<readonly BubbleData[]>([]);

  /**
   * Whether to skip the 3-2-1 countdown. When true, the challenge
   * is interactive immediately on mount. Defaults to false (countdown enabled).
   */
  readonly skipCountdown = input<boolean>(false);

  /**
   * Read-only display mode for the host projector. When true:
   *  - Bubbles are non-interactive (no clicks, no hover effects)
   *  - No countdown overlay (host is just showing the game)
   *  - No completion overlay (host shows player results separately)
   *  - No "click 1 to start" instructions
   * Defaults to false (interactive player mode).
   */
  readonly displayOnly = input<boolean>(false);

  /**
   * Visual size of the arena. The host projector uses 'huge' so the
   * bubble board fills the projector screen. Defaults to 'normal'.
   *  - 'normal'  : 640px max, square
   *  - 'large'   : 900px max, 16:10
   *  - 'huge'    : full container width, 16:10
   */
  readonly size = input<'normal' | 'large' | 'huge'>('normal');

  /** Emits the bubble number (1–6) each time a correct bubble is clicked. */
  readonly bubbleClick = output<number>();

  /** Emits the elapsed time in milliseconds when all 6 bubbles are popped. */
  readonly challengeComplete = output<number>();

  // ── Internal state ──

  protected readonly nextExpectedNumber = signal(1);
  protected readonly poppedBubbles = signal(new Set<number>());
  protected readonly wrongBubbles = signal(new Set<number>());
  protected readonly isComplete = signal(false);
  protected readonly hasStarted = signal(false);
  protected readonly elapsedTimeMs = signal(0);
  protected readonly countdownValue = signal<3 | 2 | 1 | 'GO' | null>(null);

  private readonly internalBubbles = signal<readonly BubbleData[]>([]);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private startTimestamp: number | null = null;
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private wrongResetTimeout: ReturnType<typeof setTimeout> | null = null;
  private countdownTimeout: ReturnType<typeof setTimeout> | null = null;

  /** The bubbles to render: parent input, or internally generated. */
  protected readonly displayBubbles = computed(() => {
    const input = this.bubbles();
    return input.length === 6 ? input : this.internalBubbles();
  });

  protected readonly phase = computed<ChallengePhase>(() => {
    if (this.isComplete()) return 'complete';
    if (this.countdownValue() !== null) return 'countdown';
    if (this.hasStarted()) return 'active';
    return 'waiting';
  });

  protected readonly isResetting = computed(() => this.wrongBubbles().size > 0);

  protected readonly arenaClasses = computed(() => {
    const classes = ['br-arena'];
    if (this.size() === 'large') classes.push('br-arena-large');
    if (this.size() === 'huge') classes.push('br-arena-huge');
    if (this.phase() === 'countdown' && !this.displayOnly()) classes.push('countdown-active');
    if (this.phase() === 'complete' && !this.displayOnly()) classes.push('complete');
    return classes.join(' ');
  });

  protected readonly formattedTime = computed(() => {
    const ms = this.elapsedTimeMs();
    const secs = Math.floor(ms / 1000);
    const millis = ms % 1000;
    return `${secs}.${String(millis).padStart(3, '0')}s`;
  });

  /** Confetti pieces rendered on completion — generated once on complete. */
  protected readonly confettiPieces = computed(() => {
    if (this.phase() !== 'complete') return [];
    return Array.from({ length: 30 }, (_, i) => ({
      id: i,
      leftPct: Math.random() * 100,
      delayMs: Math.random() * 1200,
      colorIndex: i % 6,
    }));
  });

  /** Background-color cycle for confetti. */
  protected confettiColor(i: number): string {
    const palette = ['#00a5e0', '#cd2750', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899'];
    return palette[i % palette.length];
  }

  ngOnInit(): void {
    if (this.bubbles().length < 6) {
      this.internalBubbles.set(this.generateRandomBubbles());
    }
    // Skip the countdown when caller opts out, or in read-only display mode
    // (the host projector doesn't need the per-player 3-2-1-GO).
    if (this.isBrowser && !this.skipCountdown() && !this.displayOnly()) {
      this.startCountdown();
    }
  }

  ngOnDestroy(): void {
    this.clearTimer();
    this.clearWrongReset();
    this.clearCountdown();
  }

  // ── Click handler ──

  protected onBubbleClick(num: number): void {
    // Read-only display (host projector) — ignore all clicks
    if (this.displayOnly()) return;
    // Block clicks during countdown overlay, wrong-reset animation, and after completion
    if (this.phase() === 'countdown') return;
    if (this.isResetting()) return;
    if (this.isComplete()) return;
    if (this.isPopped(num)) return;

    // Start the timer on the very first click (allowed even when not yet started)
    if (!this.hasStarted()) {
      this.startTimer();
    }

    if (num === this.nextExpectedNumber()) {
      this.poppedBubbles.update((s) => {
        const next = new Set(s);
        next.add(num);
        return next;
      });
      this.nextExpectedNumber.update((n) => n + 1);
      this.bubbleClick.emit(num);

      if (num === 6) {
        this.completeChallenge();
      }
    } else {
      this.triggerWrongReset();
    }
  }

  // ── Countdown ──

  private startCountdown(): void {
    this.clearCountdown();
    this.countdownValue.set(3);
    let step = 3;
    const tick = (): void => {
      if (step <= 0) {
        this.countdownValue.set('GO');
        // After "GO" appears briefly, dismiss the overlay but wait
        // for the player to make their first click to actually start
        // the timer. This way they see "GO!" and the bubbles become
        // active immediately.
        this.countdownTimeout = setTimeout(() => {
          this.countdownValue.set(null);
        }, 700);
        return;
      }
      this.countdownValue.set(step as 3 | 2 | 1);
      step -= 1;
      this.countdownTimeout = setTimeout(tick, 900);
    };
    this.countdownTimeout = setTimeout(tick, 900);
  }

  private clearCountdown(): void {
    if (this.countdownTimeout !== null) {
      clearTimeout(this.countdownTimeout);
      this.countdownTimeout = null;
    }
  }

  // ── Timer ──

  private startTimer(): void {
    if (!this.isBrowser) return;
    this.clearTimer();
    this.hasStarted.set(true);
    this.startTimestamp = Date.now();
    this.timerInterval = setInterval(() => {
      if (this.startTimestamp !== null) {
        this.elapsedTimeMs.set(Date.now() - this.startTimestamp);
      }
    }, 30);
  }

  private clearTimer(): void {
    if (this.timerInterval !== null) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  // ── Wrong-reset logic ──

  private triggerWrongReset(): void {
    this.wrongBubbles.update(() => {
      const next = new Set<number>();
      for (const b of this.displayBubbles()) {
        if (!this.isPopped(b.number)) {
          next.add(b.number);
        }
      }
      return next;
    });

    this.clearWrongReset();
    this.wrongResetTimeout = setTimeout(() => {
      this.wrongBubbles.set(new Set());
      this.poppedBubbles.set(new Set());
      this.nextExpectedNumber.set(1);
    }, WRONG_RESET_MS);
  }

  private clearWrongReset(): void {
    if (this.wrongResetTimeout !== null) {
      clearTimeout(this.wrongResetTimeout);
      this.wrongResetTimeout = null;
    }
  }

  // ── Completion ──

  private completeChallenge(): void {
    this.clearTimer();
    this.isComplete.set(true);
    this.challengeComplete.emit(this.elapsedTimeMs());
  }

  // ── Template helpers ──

  protected isPopped(num: number): boolean {
    return this.poppedBubbles().has(num);
  }

  protected isShaking(num: number): boolean {
    return this.wrongBubbles().has(num);
  }

  // ── Internal position generation ──

  private generateRandomBubbles(): readonly BubbleData[] {
    // Place bubbles in zones to avoid tight clumping.
    const zones = [
      { cx: 25, cy: 25 },
      { cx: 65, cy: 20 },
      { cx: 45, cy: 55 },
      { cx: 75, cy: 60 },
      { cx: 20, cy: 70 },
      { cx: 55, cy: 80 },
    ];

    return zones.map((zone, i) => ({
      number: i + 1,
      x: zone.cx + (Math.random() - 0.5) * 20,
      y: zone.cy + (Math.random() - 0.5) * 20,
    }));
  }
}
