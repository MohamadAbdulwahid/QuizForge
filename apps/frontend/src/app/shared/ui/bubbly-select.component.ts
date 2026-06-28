import { NgClass } from '@angular/common';
import { Component, computed, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface BubblySelectOption {
  value: string;
  label: string;
}

let nextId = 0;

@Component({
  selector: 'app-bubbly-select',
  standalone: true,
  imports: [NgClass],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => BubblySelectComponent),
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

      <select
        [id]="uid"
        [disabled]="disabled()"
        [value]="internalValue()"
        (change)="onSelect($event)"
        (focus)="onFocus()"
        (blur)="onBlur()"
        class="qf-input w-full appearance-none cursor-pointer px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
        [ngClass]="selectClasses()"
      >
        @if (placeholder()) {
          <option
            value=""
            disabled
            selected
          >
            {{ placeholder() }}
          </option>
        }
        @for (opt of options(); track opt.value) {
          <option
            [value]="opt.value"
            [selected]="opt.value === internalValue()"
          >
            {{ opt.label }}
          </option>
        }
      </select>

      @if (error() && touched()) {
        <p class="text-xs font-semibold text-[var(--bubbly-error-text)]">
          {{ error() }}
        </p>
      }
    </div>
  `,
})
export class BubblySelectComponent implements ControlValueAccessor {
  readonly label = input<string>('');
  readonly placeholder = input<string>('');
  readonly options = input<BubblySelectOption[]>([]);
  readonly error = input<string>('');
  readonly disabled = input(false);

  /** Auto-incrementing ID for label/select association */
  protected readonly uid = `bubbly-select-${++nextId}`;

  /* ---- ControlValueAccessor internals ---- */
  protected readonly internalValue = signal<string>('');
  protected readonly focused = signal(false);
  protected readonly touched = signal(false);

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private onChange: (value: string) => void = () => {};
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private onTouched: () => void = () => {};

  protected readonly selectClasses = computed(() => {
    const hasError = !!this.error() && this.touched();
    return {
      '!border-bubbly-primary': this.focused() && !hasError,
      '!border-[var(--bubbly-error-border)]': hasError,
    };
  });

  /* ---- CVA ---- */
  writeValue(value: string | null): void {
    this.internalValue.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  setDisabledState(_isDisabled: boolean): void {}

  /* ---- Internal handlers ---- */
  protected onSelect(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
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
