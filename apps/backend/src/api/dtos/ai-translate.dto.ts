import { z } from 'zod';
import { SUPPORTED_LANGUAGE_CODES } from '../../shared/constants/supported-languages';

/**
 * Request body for `POST /api/quizzes/:id/ai-translate`.
 *
 * `targetLanguage` is a BCP-47 code from the supported list. We validate
 * the code is in the allowed set (rather than accepting any string) to
 * keep the AI prompt space tight and avoid surprising translations.
 */
const languageCodeSchema = z
  .string()
  .min(2)
  .max(10)
  .refine((code) => SUPPORTED_LANGUAGE_CODES.has(code), {
    message: 'Unsupported target language. Pick from the supported list.',
  });

const aiTranslateRequestSchema = z.object({
  targetLanguage: languageCodeSchema,
});

export { aiTranslateRequestSchema as AiTranslateRequestSchema };
export type AiTranslateRequest = z.infer<typeof aiTranslateRequestSchema>;
