import { NgClass } from '@angular/common';
import { Component, computed, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

type BubblyInputType = 'text' | 'email' | 'password' | 'number' | 'url' | 'tel';

let nextId = 0;

@Component({
  selector: 'app-bubbly-input',
  standalone: true,
  imports: [NgClass],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => BubblyInputComponent),
      multi: true,
    },
  ],
  template: `
    <div class="grid gap-2">
      @if (label()) {
        <label
          class="text-sm font-bold"
          [class.text-base-content]="!error()"
          [class.text-[var(--bubbly-error-text)]]="!!error() && touched()"
          [for]="uid"
        >
          {{ label() }}
        </label>
      }

      <input
        [id]="uid"
        [type]="type()"
        [placeholder]="placeholder()"
        [disabled]="disabled()"
        [value]="internalValue()"
        (input)="onInput($event)"
        (focus)="onFocus()"
        (blur)="onBlur()"
        class="qf-input w-full px-4 text-sm font-semibold placeholder:text-sm disabled:cursor-not-allowed disabled:opacity-60"
        [ngClass]="inputClasses()"
      />

      @if (error() && touched()) {
        <p class="text-xs font-semibold text-[var(--bubbly-error-text)]">
          {{ error() }}
        </p>
      }
    </div>
  `,
})
export class BubblyInputComponent implements ControlValueAccessor {
  readonly label = input<string>('');
  readonly type = input<BubblyInputType>('text');
  readonly placeholder = input<string>('');
  readonly error = input<string>('');
  readonly disabled = input(false);

  /** Auto-incrementing ID for label/input association */
  protected readonly uid = `bubbly-input-${++nextId}`;

  /* ---- ControlValueAccessor internals ---- */
  protected readonly internalValue = signal<string | number>('');
  protected readonly focused = signal(false);
  protected readonly touched = signal(false);

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private onChange: (value: string) => void = () => {};
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private onTouched: () => void = () => {};

  protected readonly inputClasses = computed(() => {
    const hasError = !!this.error() && this.touched();
    return {
      '!border-bubbly-primary': this.focused() && !hasError,
      '!border-[var(--bubbly-error-border)]': hasError,
    };
  });

  /* ---- CVA: writeValue ---- */
  writeValue(value: string | number | null): void {
    this.internalValue.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(_isDisabled: boolean): void {
    // Angular forms handle disabled via the directive, but we propagate it
  }

  /* ---- Internal handlers ---- */
  protected onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.internalValue.set(value);
    this.onChange(value);
  }

  protected onFocus(): void {
    this.focused.set(true);
  }

  protected onBlur(): void {
    this.focused.set(false);
    this.touched.set(true);
    this.onTouched();
  }
}
