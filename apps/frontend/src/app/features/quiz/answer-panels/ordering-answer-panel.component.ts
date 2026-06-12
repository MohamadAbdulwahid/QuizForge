import { Component, computed, input, output } from '@angular/core';

export interface OrderingItem {
  readonly id: string;
  readonly text: string;
}

/**
 * Player-side panel for `ordering` questions. Lets the player arrange a
 * list of items into the correct order using up/down arrow buttons (CDK
 * drag-drop is intentionally not used — it's not in the project deps and
 * the button approach is fully accessible on touch + keyboard).
 *
 * Emits the new order as an array of item ids via `valueChange`.
 * Initial order is taken from `value` (falls back to `items` order when
 * the bound value is empty).
 */
@Component({
  selector: 'app-ordering-answer-panel',
  standalone: true,
  imports: [],
  template: `
    <div class="flex w-full flex-col gap-3">
      @for (id of resolvedOrder(); track id; let i = $index) {
        <div
          class="flex min-h-16 items-center gap-3 rounded-2xl bg-white/10 p-3 shadow-lg backdrop-blur-sm sm:min-h-20 sm:gap-4 sm:p-4"
          [class.opacity-60]="disabled()"
        >
          <span
            class="font-display flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-2xl font-black text-white shadow-md sm:h-14 sm:w-14 sm:text-3xl"
          >
            {{ i + 1 }}
          </span>
          <span class="flex-1 text-xl font-bold text-white drop-shadow-md sm:text-2xl lg:text-3xl">
            {{ textFor(id) }}
          </span>
          <div class="flex shrink-0 flex-col gap-1">
            <button
              type="button"
              class="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 text-lg font-bold text-white shadow-sm transition-transform active:scale-90 disabled:cursor-not-allowed disabled:opacity-40 sm:h-10 sm:w-10"
              [disabled]="disabled() || i === 0"
              (click)="moveUp(i)"
              aria-label="Move up"
            >
              ▲
            </button>
            <button
              type="button"
              class="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 text-lg font-bold text-white shadow-sm transition-transform active:scale-90 disabled:cursor-not-allowed disabled:opacity-40 sm:h-10 sm:w-10"
              [disabled]="disabled() || i === resolvedOrder().length - 1"
              (click)="moveDown(i)"
              aria-label="Move down"
            >
              ▼
            </button>
          </div>
        </div>
      }
    </div>
  `,
})
export class OrderingAnswerPanelComponent {
  readonly items = input.required<readonly OrderingItem[]>();
  /** Current order (array of item ids). When empty, falls back to `items` order. */
  readonly value = input.required<readonly string[]>();
  readonly valueChange = output<string[]>();
  readonly disabled = input(false);

  /**
   * Resolves the order to render: if `value` is non-empty, use it; otherwise
   * initialize from the `items` order. This keeps the panel "self-seeding"
   * so a parent doesn't have to pre-populate the draft.
   */
  protected readonly resolvedOrder = computed<readonly string[]>(() => {
    const v = this.value();
    if (v && v.length > 0) {
      return v;
    }
    return this.items().map((i) => i.id);
  });

  /** Returns the display text for an item id, or empty string if unknown. */
  protected textFor(id: string): string {
    return this.items().find((i) => i.id === id)?.text ?? '';
  }

  /** Emits a new order with the item at `index` moved up by one. */
  protected moveUp(index: number): void {
    if (this.disabled() || index <= 0) {
      return;
    }
    const next = [...this.resolvedOrder()];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    this.valueChange.emit(next);
  }

  /** Emits a new order with the item at `index` moved down by one. */
  protected moveDown(index: number): void {
    if (this.disabled()) {
      return;
    }
    const next = [...this.resolvedOrder()];
    if (index >= next.length - 1) {
      return;
    }
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    this.valueChange.emit(next);
  }
}
