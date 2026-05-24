import { z } from 'zod';

/**
 * Zod schema for sign-up request body
 */
const signUpRequestSchema = z.object({
  email: z.email({ message: 'Invalid email format' }),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Username can only contain letters, numbers, hyphens, and underscores'
    ),
});

export type SignUpDto = z.infer<typeof signUpRequestSchema>;

/**
 * Zod schema for sign-in request body
 */
const signInRequestSchema = z.object({
  email: z.email({ message: 'Invalid email format' }),
  password: z.string().min(1, 'Password is required'),
});

export type SignInDto = z.infer<typeof signInRequestSchema>;

// PascalCase exports matching session.dto.ts and quiz.dto.ts pattern
export { signUpRequestSchema as SignUpRequestSchema };
export { signInRequestSchema as SignInRequestSchema };

// Backward-compatible aliases
export { signUpRequestSchema as signUpSchema };
export { signInRequestSchema as signInSchema };

export type SignUpRequest = z.infer<typeof signUpRequestSchema>;
export type SignInRequest = z.infer<typeof signInRequestSchema>;
