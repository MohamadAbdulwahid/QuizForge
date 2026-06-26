import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  computed,
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

@Component({
  selector: 'app-bubble-pop',
  standalone: true,
  imports: [],
  templateUrl: './bubble-pop.component.html',
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }

      .bubble-area {
        position: relative;
        width: 100%;
        aspect-ratio: 1;
        max-width: 500px;
        margin: 0 auto;
        border-radius: var(--bubbly-radius-xl);
        background: var(--bubbly-surface-soft);
        border: 2px dashed var(--bubbly-border);
        overflow: hidden;
      }

      .bubble-area.celebrating {
        border-style: solid;
        border-color: var(--bubbly-warning-border);
        background: var(--bubbly-warning-bg);
        box-shadow: 0 0 48px 8px var(--bubbly-warning-border);
      }

      .bubble-btn {
        position: absolute;
        width: 5rem;
        height: 5rem;
        border-radius: var(--bubbly-radius-full);
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: var(--bubbly-font-heading);
        font-size: 2rem;
        font-weight: var(--bubbly-font-weight-bold);
        color: white;
        background: var(--bubbly-primary);
        box-shadow:
          0 6px 0 0 var(--bubbly-primary-deep),
          0 2px 12px var(--bubbly-shadow);
        transform: translate(-50%, -50%);
        transition:
          transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1),
          opacity 250ms ease,
          background-color 300ms ease;
        outline-offset: 3px;
      }

      .bubble-btn:focus-visible {
        outline: 3px solid var(--bubbly-focus);
      }

      .bubble-btn:hover:not(:disabled):not(.popped):not(.shaking) {
        transform: translate(-50%, -50%) scale(1.12);
      }

      .bubble-btn:active:not(:disabled):not(.popped):not(.shaking) {
        transform: translate(-50%, -50%) scale(0.94);
      }

      .bubble-btn.popped {
        transform: translate(-50%, -50%) scale(0) rotate(18deg);
        opacity: 0;
        pointer-events: none;
      }

      .bubble-btn.shaking {
        background: var(--bubbly-error-bg);
        color: var(--bubbly-error-text);
        box-shadow:
          0 6px 0 0 var(--bubbly-error-border),
          0 0 16px var(--bubbly-error-border);
        animation: bubble-shake 420ms cubic-bezier(0.34, 1.56, 0.64, 1);
      }

      @keyframes bubble-shake {
        0%,
        100% {
          transform: translate(-50%, -50%);
        }
        10%,
        50%,
        90% {
          transform: translate(calc(-50% - 8px), -50%);
        }
        30%,
        70% {
          transform: translate(calc(-50% + 8px), -50%);
        }
      }

      @keyframes bubble-celebrate {
        0%,
        100% {
          box-shadow: 0 0 48px 8px var(--bubbly-warning-border);
        }
        50% {
          box-shadow: 0 0 64px 16px var(--bubbly-warning-border);
        }
      }

      .bubble-area.celebrating {
        animation: bubble-celebrate 800ms ease-in-out infinite;
      }

      /* Reduced motion */
      @media (prefers-reduced-motion: reduce) {
        .bubble-btn {
          transition: none;
        }
        .bubble-btn.shaking {
          animation: none;
        }
        .bubble-area.celebrating {
          animation: none;
        }
      }

      /* Tablet+ */
      @media (min-width: 640px) {
        .bubble-btn {
          width: 6rem;
          height: 6rem;
          font-size: 2.5rem;
        }
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

  private readonly internalBubbles = signal<readonly BubbleData[]>([]);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private startTimestamp: number | null = null;
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private wrongResetTimeout: ReturnType<typeof setTimeout> | null = null;

  /** The bubbles to render: parent input, or internally generated. */
  protected readonly displayBubbles = computed(() => {
    const input = this.bubbles();
    return input.length === 6 ? input : this.internalBubbles();
  });

  ngOnInit(): void {
    if (this.bubbles().length < 6) {
      this.internalBubbles.set(this.generateRandomBubbles());
    }
  }

  ngOnDestroy(): void {
    this.clearTimer();
    this.clearWrongReset();
  }

  // ── Template helpers ──

  protected isPopped(num: number): boolean {
    return this.poppedBubbles().has(num);
  }

  protected isShaking(num: number): boolean {
    return this.wrongBubbles().has(num);
  }

  protected readonly isResetting = computed(() => this.wrongBubbles().size > 0);

  protected readonly formattedTime = computed(() => {
    const ms = this.elapsedTimeMs();
    const secs = Math.floor(ms / 1000);
    const millis = ms % 1000;
    return `${secs}.${String(millis).padStart(3, '0')}s`;
  });

  // ── Click handler ──

  protected onBubbleClick(num: number): void {
    // Ignore clicks during wrong-animation reset
    if (this.isResetting()) return;
    // Ignore clicks after completion
    if (this.isComplete()) return;
    // Ignore clicks on already-popped bubbles
    if (this.isPopped(num)) return;

    // Start the timer on the very first click
    if (!this.hasStarted()) {
      this.hasStarted.set(true);
      this.startTimestamp = Date.now();
      this.startTimer();
    }

    if (num === this.nextExpectedNumber()) {
      // Correct — pop this bubble
      this.poppedBubbles.update((s) => {
        const next = new Set(s);
        next.add(num);
        return next;
      });
      this.nextExpectedNumber.update((n) => n + 1);
      this.bubbleClick.emit(num);

      // All 6 popped? Complete the challenge.
      if (num === 6) {
        this.completeChallenge();
      }
    } else {
      // Wrong — shake all remaining bubbles, then reset
      this.triggerWrongReset();
    }
  }

  // ── Timer ──

  private startTimer(): void {
    if (!this.isBrowser) return;
    this.clearTimer();
    this.timerInterval = setInterval(() => {
      if (this.startTimestamp !== null) {
        this.elapsedTimeMs.set(Date.now() - this.startTimestamp);
      }
    }, 10);
  }

  private clearTimer(): void {
    if (this.timerInterval !== null) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  // ── Wrong-reset logic ──

  private triggerWrongReset(): void {
    // Mark all unpopped bubbles as shaking
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
      // After shake animation, reset all bubble state
      this.wrongBubbles.set(new Set());
      this.poppedBubbles.set(new Set());
      this.nextExpectedNumber.set(1);
    }, 450);
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

  // ── Internal position generation ──

  private generateRandomBubbles(): readonly BubbleData[] {
    // Use a seeded-ish approach to avoid tight clumping.
    // Divide the area into zones and pick positions within each.
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
      x: zone.cx + (Math.random() - 0.5) * 24,
      y: zone.cy + (Math.random() - 0.5) * 24,
    }));
  }
}
