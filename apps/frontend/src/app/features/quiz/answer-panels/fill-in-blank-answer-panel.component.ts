import { Component, ElementRef, input, output, viewChild } from '@angular/core';

/**
 * Player-side panel for `fill-in-blank` questions. A single big text
 * input where the player types their answer. Auto-focuses on mount and
 * fires `submitRequest` on Enter so the parent can trigger the SUBMIT
 * button handler. Live text changes are emitted via `valueChange`.
 */
@Component({
  selector: 'app-fill-in-blank-answer-panel',
  standalone: true,
  imports: [],
  template: `
    <div class="flex w-full flex-col gap-3">
      <input
        #input
        type="text"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
        spellcheck="false"
        [disabled]="disabled()"
        [value]="value()"
        (input)="onInput($event)"
        (keydown.enter)="onEnter($event)"
        [attr.placeholder]="placeholder()"
        class="w-full rounded-2xl bg-white/10 px-4 py-4 text-3xl font-bold text-white shadow-lg backdrop-blur-sm placeholder:text-white/50 sm:px-6 sm:py-5 sm:text-4xl"
      />
      <p class="px-1 text-xs font-semibold text-white/50 sm:text-sm">
        Press Enter or tap Submit to lock in your answer
      </p>
    </div>
  `,
})
export class FillInBlankAnswerPanelComponent {
  readonly value = input.required<string>();
  readonly valueChange = output<string>();
  readonly submitRequest = output<void>();
  readonly disabled = input(false);
  readonly placeholder = input<string>('Type your answer...');

  /** Reference to the input so the parent can focus it on demand. */
  private readonly inputRef = viewChild<ElementRef<HTMLInputElement>>('input');

  /** Public focus helper — the parent can call this to re-focus the input. */
  focus(): void {
    this.inputRef()?.nativeElement.focus();
  }

  protected onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.valueChange.emit(value);
  }

  /** Enter: emit submit request and prevent form-default to avoid double-fire. */
  protected onEnter(event: Event): void {
    event.preventDefault();
    if (this.disabled()) {
      return;
    }
    this.submitRequest.emit();
  }
}
