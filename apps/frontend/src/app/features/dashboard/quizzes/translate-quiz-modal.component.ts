import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AiTranslateRequest,
  AiTranslateResponse,
  QuizApiService,
} from '../../../core/services/quiz-api.service';
import { BubblyAlertComponent } from '../../../shared/ui/bubbly-alert.component';
import { BubblyButtonComponent } from '../../../shared/ui/bubbly-button.component';
import { BubblyModalComponent } from '../../../shared/ui/bubbly-modal.component';
import { BubblySelectComponent } from '../../../shared/ui/bubbly-select.component';
import {
  SupportedLanguage,
  TRANSLATABLE_LANGUAGES,
} from '../../../shared/i18n/supported-languages';
import { resolveAuthError } from '../../../shared/utils/auth-errors';

export interface TranslateQuizEvent {
  sourceQuizId: number;
  newQuizId: number;
  targetLanguage: string;
  shareCode: string;
  reused: boolean;
}

@Component({
  selector: 'app-translate-quiz-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    BubblyAlertComponent,
    BubblyButtonComponent,
    BubblyModalComponent,
    BubblySelectComponent,
  ],
  templateUrl: './translate-quiz-modal.component.html',
})
export class TranslateQuizModalComponent {
  private readonly quizApi = inject(QuizApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly visible = input(false);
  readonly sourceQuiz = input<{ id: number; title: string; language: string } | null>(null);

  readonly visibleChange = output<boolean>();
  readonly translateSuccess = output<TranslateQuizEvent>();

  /* ─── State ─── */
  protected readonly targetLanguage = signal<string>('');
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  protected readonly languageOptions = computed(() =>
    TRANSLATABLE_LANGUAGES.map((l) => ({
      value: l.code,
      label: `${l.flag}  ${l.name} (${l.nativeName})`,
    }))
  );

  protected readonly messageText = computed(() => {
    const source = this.sourceQuiz();
    if (!source) return '';
    return `Generate a culturally adapted version of "${source.title}" in another language. The original is left untouched.`;
  });

  protected readonly canSubmit = (): boolean =>
    !this.isLoading() && this.targetLanguage().trim().length > 0;

  protected onLanguageChange(value: string): void {
    this.targetLanguage.set(value);
    this.errorMessage.set(null);
  }

  protected generate(): void {
    const source = this.sourceQuiz();
    const lang = this.targetLanguage();
    if (!source || !lang) return;

    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.isLoading.set(true);

    const payload: AiTranslateRequest = { targetLanguage: lang };

    this.quizApi
      .aiTranslateQuiz(source.id, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: AiTranslateResponse) => {
          this.isLoading.set(false);
          const langName = this.langName(lang);
          this.successMessage.set(
            response.reused
              ? `Reusing your existing ${langName} version.`
              : `Translated to ${langName}! Opening…`
          );
          this.translateSuccess.emit({
            sourceQuizId: source.id,
            newQuizId: response.quiz.id,
            targetLanguage: lang,
            shareCode: response.shareCode,
            reused: response.reused,
          });
          setTimeout(() => this.dismiss(), 800);
        },
        error: (err: unknown) => {
          this.isLoading.set(false);
          this.errorMessage.set(this.formatError(err));
        },
      });
  }

  protected dismiss(): void {
    this.targetLanguage.set('');
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.isLoading.set(false);
    this.visibleChange.emit(false);
  }

  private langName(code: string): string {
    return TRANSLATABLE_LANGUAGES.find((l: SupportedLanguage) => l.code === code)?.name ?? code;
  }

  private formatError(err: unknown): string {
    const status = (err as { status?: number } | null)?.status;
    if (status === 429) {
      return 'AI service is rate limited. Please wait a moment and try again.';
    }
    if (status === 503) {
      return 'AI quiz translation is not configured on the server.';
    }
    if (status === 504) {
      return 'AI request timed out. Please try again.';
    }
    if (status === 403) {
      return 'You can only translate quizzes you own.';
    }
    if (status === 404) {
      return 'The source quiz was not found.';
    }
    if (status === 400) {
      return 'Unsupported target language. Please pick another from the list.';
    }
    return resolveAuthError(err, 'Failed to translate quiz. Please try again.');
  }
}
