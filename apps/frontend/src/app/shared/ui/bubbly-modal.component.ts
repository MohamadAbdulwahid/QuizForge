import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-bubbly-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (visible()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        (click)="dismiss.emit()"
        (keydown.escape)="dismiss.emit()"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="title()"
        tabindex="-1"
      >
        <div
          class="mx-4 w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
          (click)="$event.stopPropagation()"
          (keydown)="$event.stopPropagation()"
          tabindex="0"
        >
          @if (title(); as t) {
            <h2 class="font-display text-bubbly-primary text-2xl font-bold">
              {{ t }}
            </h2>
          }

          @if (message(); as m) {
            <p class="mt-3 text-sm font-semibold text-slate-600">
              {{ m }}
            </p>
          }

          <ng-content></ng-content>

          @if (customFooter()) {
            <div class="mt-6 flex justify-end gap-3">
              <ng-content select="[modal-footer]"></ng-content>
            </div>
          } @else {
            <div
              class="mt-6 flex justify-end gap-3"
              [class.justify-center]="!showCancel()"
            >
              @if (showCancel()) {
                <button
                  type="button"
                  class="qf-button-ghost qf-tactile rounded-2xl px-5 py-3 text-sm font-bold"
                  (click)="dismiss.emit()"
                >
                  Cancel
                </button>
              }

              <button
                type="button"
                class="qf-tactile inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold"
                [class.bg-rose-600]="danger()"
                [class.text-white]="danger()"
                [class.shadow-[0_5px_0_0_#dc2626]]="danger()"
                [class.bg-bubbly-primary]="!danger()"
                [class.text-white]="!danger()"
                [class.shadow-[0_5px_0_0_var(--bubbly-primary-deep)]]="!danger()"
                (click)="confirm.emit()"
              >
                {{ confirmLabel() }}
              </button>
            </div>
          }
        </div>
      </div>
    }
  `,
})
export class BubblyModalComponent {
  readonly visible = input(false);
  readonly title = input('');
  readonly message = input('');
  readonly confirmLabel = input('OK');
  readonly showCancel = input(false);
  readonly danger = input(false);
  /**
   * When true, the default Cancel/Confirm buttons are replaced by content
   * projected via `<ng-content select="[modal-footer]">`. Use this when the
   * modal hosts a form that needs its own footer (e.g. a Create flow).
   */
  readonly customFooter = input(false);

  readonly confirm = output<void>();
  readonly dismiss = output<void>();
}
