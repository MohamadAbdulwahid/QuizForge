import { NgClass } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';

export interface MatchingItem {
  readonly id: string;
  readonly text: string;
}

export type MatchingPairs = Readonly<Record<string, string>>;

/**
 * Player-side panel for `matching` questions. Two columns: left (with
 * letter badges) and right (plain). The user pairs them by clicking a
 * left item then a right item. Existing pairs are highlighted in green
 * with a check mark; an unpaired item is neutral. The "Clear all" button
 * at the top wipes the current selection; a "X / N paired" counter shows
 * progress.
 *
 * Emits the new pairs map (leftId → rightId) via `valueChange`.
 */
@Component({
  selector: 'app-matching-answer-panel',
  standalone: true,
  imports: [NgClass],
  template: `
    <div class="flex w-full flex-col gap-4">
      <!-- Header: counter + clear button -->
      <div class="flex items-center justify-between gap-3 px-1">
        <span class="text-sm font-bold text-white/80 sm:text-base">
          <span class="text-white">{{ pairedCount() }}</span>
          <span class="text-white/60">/ {{ leftItems().length }} paired</span>
        </span>
        <button
          type="button"
          class="rounded-full bg-white/15 px-4 py-1.5 text-sm font-bold text-white/80 shadow-sm backdrop-blur-sm transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 sm:text-base"
          [disabled]="disabled() || pairedCount() === 0"
          (click)="clearAll()"
        >
          Clear all
        </button>
      </div>

      <!-- Two-column layout -->
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        <!-- LEFT column -->
        <div class="flex flex-col gap-3">
          @for (item of leftItems(); track item.id; let i = $index) {
            <button
              type="button"
              class="flex min-h-16 items-center gap-3 rounded-2xl p-3 text-left shadow-lg transition-transform active:scale-95 sm:min-h-20 sm:gap-4 sm:p-4"
              [ngClass]="leftClasses(item.id, i)"
              [disabled]="disabled() || isPairedLeft(item.id)"
              (click)="onLeftClick(item.id)"
            >
              <span
                class="font-display flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-xl font-black text-white shadow-md sm:h-12 sm:w-12 sm:text-2xl"
                [class.bg-white/30]="!isPairedLeft(item.id) && selectedLeftId() !== item.id"
                [class.bg-emerald-600/80]="isPairedLeft(item.id)"
                [class.ring-4]="selectedLeftId() === item.id"
                [class.ring-white]="selectedLeftId() === item.id"
              >
                @if (isPairedLeft(item.id)) {
                  ✓
                } @else {
                  {{ letterFor(i) }}
                }
              </span>
              <span
                class="flex-1 text-base font-bold text-white drop-shadow-md sm:text-lg lg:text-xl"
              >
                {{ item.text }}
              </span>
            </button>
          }
        </div>

        <!-- RIGHT column -->
        <div class="flex flex-col gap-3">
          @for (item of rightItems(); track item.id; let i = $index) {
            <button
              type="button"
              class="flex min-h-16 items-center gap-3 rounded-2xl p-3 text-left shadow-lg transition-transform active:scale-95 sm:min-h-20 sm:gap-4 sm:p-4"
              [ngClass]="rightClasses(item.id)"
              [disabled]="disabled()"
              (click)="onRightClick(item.id)"
            >
              <span
                class="font-display flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-xl font-black text-white shadow-md sm:h-12 sm:w-12 sm:text-2xl"
                [class.bg-white/30]="!isPairedRight(item.id)"
                [class.bg-emerald-600/80]="isPairedRight(item.id)"
              >
                @if (isPairedRight(item.id)) {
                  ✓
                } @else {
                  {{ i + 1 }}
                }
              </span>
              <span
                class="flex-1 text-base font-bold text-white drop-shadow-md sm:text-lg lg:text-xl"
              >
                {{ item.text }}
              </span>
            </button>
          }
        </div>
      </div>
    </div>
  `,
})
export class MatchingAnswerPanelComponent {
  readonly leftItems = input.required<readonly MatchingItem[]>();
  readonly rightItems = input.required<readonly MatchingItem[]>();
  /** Current pairs (leftId → rightId). Required — the parent always provides it. */
  readonly value = input.required<MatchingPairs>();
  readonly valueChange = output<Record<string, string>>();
  readonly disabled = input(false);

  /**
   * Currently selected left item (the one waiting to be paired with a right
   * click). Local panel state — not lifted to the parent.
   */
  private readonly selectedLeftIdState = signal<string | null>(null);

  protected readonly selectedLeftId = this.selectedLeftIdState.asReadonly();
  protected readonly pairedCount = computed(() => Object.keys(this.value() ?? {}).length);

  protected letterFor(i: number): string {
    return String.fromCharCode(65 + i);
  }

  protected isPairedLeft(id: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.value() ?? {}, id);
  }

  protected isPairedRight(id: string): boolean {
    const pairs = this.value() ?? {};
    return Object.values(pairs).includes(id);
  }

  protected leftClasses(id: string, _index: number): string {
    const paired = this.isPairedLeft(id);
    const selected = this.selectedLeftIdState() === id;
    const base = 'rounded-2xl';
    if (paired) {
      return `${base} bg-emerald-500/40 ring-2 ring-emerald-300/60`;
    }
    if (selected) {
      return `${base} bg-white/30 ring-4 ring-white`;
    }
    return `${base} bg-white/10 backdrop-blur-sm`;
  }

  protected rightClasses(id: string): string {
    if (this.isPairedRight(id)) {
      return 'rounded-2xl bg-emerald-500/40 ring-2 ring-emerald-300/60';
    }
    return 'rounded-2xl bg-white/10 backdrop-blur-sm';
  }

  protected onLeftClick(id: string): void {
    if (this.disabled() || this.isPairedLeft(id)) {
      return;
    }
    // Toggle: clicking the same selected left deselects it.
    if (this.selectedLeftIdState() === id) {
      this.selectedLeftIdState.set(null);
      return;
    }
    this.selectedLeftIdState.set(id);
  }

  protected onRightClick(rightId: string): void {
    if (this.disabled()) {
      return;
    }

    // If a left is selected, form/replace the pair.
    const leftId = this.selectedLeftIdState();
    if (leftId) {
      const next: Record<string, string> = { ...(this.value() ?? {}) };
      // Replace any existing pair for this left (defensive).
      next[leftId] = rightId;
      this.valueChange.emit(next);
      this.selectedLeftIdState.set(null);
      return;
    }

    // No left selected — if this right is paired, clicking again un-pairs it.
    if (this.isPairedRight(rightId)) {
      const next: Record<string, string> = { ...(this.value() ?? {}) };
      const leftToUnpair = Object.keys(next).find((k) => next[k] === rightId);
      if (leftToUnpair) {
        delete next[leftToUnpair];
      }
      this.valueChange.emit(next);
    }
  }

  protected clearAll(): void {
    if (this.disabled()) {
      return;
    }
    this.selectedLeftIdState.set(null);
    this.valueChange.emit({});
  }
}
