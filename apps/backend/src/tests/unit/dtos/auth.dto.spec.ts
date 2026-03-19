import { describe, it, expect } from 'bun:test';
import { signUpSchema, signInSchema } from '../../../api/dtos/auth.dto';

/**
 * Unit tests for auth validation schemas
 */
describe('Auth DTOs', () => {
  describe('signUpSchema', () => {
    it('should accept valid sign-up data', () => {
      const result = signUpSchema.safeParse({
        email: 'test@example.com',
        password: 'Password123!',
        username: 'testuser',
      });

      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = signUpSchema.safeParse({
        email: 'not-an-email',
        password: 'Password123!',
        username: 'testuser',
      });

      expect(result.success).toBe(false);
    });

    it('should reject short password', () => {
      const result = signUpSchema.safeParse({
        email: 'test@example.com',
        password: 'short',
        username: 'testuser',
      });

      expect(result.success).toBe(false);
    });

    it('should reject short username', () => {
      const result = signUpSchema.safeParse({
        email: 'test@example.com',
        password: 'Password123!',
        username: 'ab',
      });

      expect(result.success).toBe(false);
    });

    it('should reject username with special characters', () => {
      const result = signUpSchema.safeParse({
        email: 'test@example.com',
        password: 'Password123!',
        username: 'user@name!',
      });

      expect(result.success).toBe(false);
    });

    it('should accept username with hyphens and underscores', () => {
      const result = signUpSchema.safeParse({
        email: 'test@example.com',
        password: 'Password123!',
        username: 'test-user_1',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('signInSchema', () => {
    it('should accept valid sign-in data', () => {
      const result = signInSchema.safeParse({
        email: 'test@example.com',
        password: 'Password123!',
      });

      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = signInSchema.safeParse({
        email: 'not-an-email',
        password: 'Password123!',
      });

      expect(result.success).toBe(false);
    });

    it('should reject empty password', () => {
      const result = signInSchema.safeParse({
        email: 'test@example.com',
        password: '',
      });

      expect(result.success).toBe(false);
    });
  });
});
