import { supabaseClient, authAdminClient } from '../../config/supabase';
import { getUserByEmail } from '../../database/repositories/user.repository';
import { createChildLogger } from '../../config/logger';
import { StatusCodes } from 'http-status-codes';

const authLogger = createChildLogger('auth-service');

/**
 * Request shape for user sign-up
 */
export interface SignUpRequest {
  email: string;
  password: string;
  username: string;
}

/**
 * Request shape for user sign-in
 */
export interface SignInRequest {
  email: string;
  password: string;
}

/**
 * Successful auth response shape
 */
export interface AuthResponse {
  user: {
    id: string;
    email: string;
    username: string;
  };
  session: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  };
}

/**
 * Custom error class for auth service failures with HTTP status code
 */
export class AuthServiceError extends Error {
  /**
   * Creates an AuthServiceError instance.
   *
   * @param message - Human-readable error message
   * @param statusCode - HTTP status code to return
   * @param code - Machine-readable error code
   */
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string
  ) {
    super(message);
    this.name = 'AuthServiceError';
  }
}

/**
 * Creates a new user via Supabase Auth
 * Uses the admin client to bypass email confirmation
 *
 * @param request - Sign-up data (email, password, username)
 * @returns Auth response with user and session
 * @throws AuthServiceError on duplicate email or other failures
 */
export async function signUp(request: SignUpRequest): Promise<AuthResponse> {
  const { email, password, username } = request;

  // Check if email already exists
  const existingUser = await getUserByEmail(email);
  if (existingUser !== 'not found') {
    throw new AuthServiceError('Email already exists', StatusCodes.CONFLICT, 'DUPLICATE_EMAIL');
  }

  const { data, error } = await authAdminClient.auth.admin.createUser({
    email,
    password,
    user_metadata: { username },
    email_confirm: true,
  });

  if (error) {
    authLogger.error({ err: error }, 'Supabase sign-up failed');
    throw new AuthServiceError(error.message, StatusCodes.BAD_REQUEST, 'SIGNUP_FAILED');
  }

  // Sign in immediately to get a session
  const { data: signInData, error: signInError } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError || !signInData.session) {
    authLogger.error({ err: signInError }, 'Auto sign-in after sign-up failed');
    throw new AuthServiceError(
      'Account created but sign-in failed',
      StatusCodes.INTERNAL_SERVER_ERROR,
      'SIGNIN_AFTER_SIGNUP_FAILED'
    );
  }

  authLogger.info({ userId: data.user.id }, 'User signed up successfully');

  return {
    user: {
      id: data.user.id,
      email: data.user.email ?? email,
      username: data.user.user_metadata?.username ?? username,
    },
    session: {
      accessToken: signInData.session.access_token,
      refreshToken: signInData.session.refresh_token,
      expiresAt: signInData.session.expires_at ?? 0,
    },
  };
}

/**
 * Authenticates a user via Supabase Auth
 *
 * @param request - Sign-in data (email, password)
 * @returns Auth response with user and session
 * @throws AuthServiceError on invalid credentials
 */
export async function signIn(request: SignInRequest): Promise<AuthResponse> {
  const { email, password } = request;

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    authLogger.warn({ email }, 'Sign-in failed');
    throw new AuthServiceError(
      'Invalid credentials',
      StatusCodes.UNAUTHORIZED,
      'INVALID_CREDENTIALS'
    );
  }

  if (!data.session) {
    throw new AuthServiceError(
      'No session returned',
      StatusCodes.INTERNAL_SERVER_ERROR,
      'SESSION_ERROR'
    );
  }

  authLogger.info({ userId: data.user.id }, 'User signed in successfully');

  return {
    user: {
      id: data.user.id,
      email: data.user.email ?? email,
      username: data.user.user_metadata?.username ?? '',
    },
    session: {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at ?? 0,
    },
  };
}

/**
 * Verifies a JWT token and returns the associated user
 *
 * @param token - JWT access token
 * @returns User data from the token
 * @throws AuthServiceError if token is invalid or expired
 */
export async function verifyToken(token: string) {
  const { data, error } = await supabaseClient.auth.getUser(token);

  if (error || !data.user) {
    throw new AuthServiceError(
      'Invalid or expired token',
      StatusCodes.UNAUTHORIZED,
      'INVALID_TOKEN'
    );
  }

  return {
    id: data.user.id,
    email: data.user.email ?? '',
    username: data.user.user_metadata?.username ?? '',
  };
}
