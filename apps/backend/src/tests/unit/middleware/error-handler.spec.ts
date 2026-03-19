import { describe, it, expect, mock, beforeEach } from 'bun:test';
import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

mock.module('../../../config/logger', () => ({
  logger: {
    info: mock(),
    warn: mock(),
    error: mock(),
    debug: mock(),
    child: () => ({
      info: mock(),
      warn: mock(),
      error: mock(),
      debug: mock(),
    }),
  },
  createChildLogger: () => ({
    info: mock(),
    warn: mock(),
    error: mock(),
    debug: mock(),
  }),
}));

const { errorHandler } = await import('../../../api/middleware/error-handler');

/**
 * Unit tests for global error handling middleware
 */
describe('errorHandler', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let statusMock: ReturnType<typeof mock>;
  let jsonMock: ReturnType<typeof mock>;

  beforeEach(() => {
    jsonMock = mock(() => mockRes);
    statusMock = mock(() => ({ json: jsonMock }));
    mockReq = {};
    mockRes = {
      status: statusMock,
      json: jsonMock,
    } as Partial<Response>;
    mockNext = mock(() => undefined);
  });

  it('should return 400 for ZodError', () => {
    const zodError = new ZodError([
      {
        code: 'invalid_type',
        expected: 'string',
        path: ['email'],
        message: 'Expected string, received number',
      },
    ]);

    errorHandler(zodError, mockReq as Request, mockRes as Response, mockNext);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      })
    );
  });

  it('should return 500 for unknown errors', () => {
    const unknownError = new Error('Something went wrong');

    errorHandler(unknownError, mockReq as Request, mockRes as Response, mockNext);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'INTERNAL_ERROR',
        statusCode: 500,
      })
    );
  });

  it('should return consistent JSON structure', () => {
    const error = new Error('test');

    errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.any(String),
        code: expect.any(String),
        statusCode: expect.any(Number),
      })
    );
  });
});
