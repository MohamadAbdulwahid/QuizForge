/**
 * Base app error with HTTP status code and machine-readable code.
 */
export class AppError extends Error {
  /**
   * Creates a typed application error.
   * @param message - Human-readable message.
   * @param statusCode - HTTP status code.
   * @param code - Machine-readable error code.
   */
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * Not found error mapped to HTTP 404.
 */
export class NotFoundError extends AppError {
  /**
   * Creates a 404 not found error.
   * @param message - Human-readable message.
   * @param code - Machine-readable code.
   */
  constructor(message = 'Resource not found', code = 'NOT_FOUND') {
    super(message, 404, code);
  }
}

/**
 * Forbidden error mapped to HTTP 403.
 */
export class ForbiddenError extends AppError {
  /**
   * Creates a 403 forbidden error.
   * @param message - Human-readable message.
   * @param code - Machine-readable code.
   */
  constructor(message = 'Forbidden', code = 'FORBIDDEN') {
    super(message, 403, code);
  }
}

/**
 * Conflict error mapped to HTTP 409.
 */
export class ConflictError extends AppError {
  /**
   * Creates a 409 conflict error.
   * @param message - Human-readable message.
   * @param code - Machine-readable code.
   */
  constructor(message = 'Conflict', code = 'CONFLICT') {
    super(message, 409, code);
  }
}
