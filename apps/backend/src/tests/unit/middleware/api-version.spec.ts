import { describe, it, expect, mock, beforeEach } from 'bun:test';
import type { Request, Response, NextFunction } from 'express';

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

const { apiVersionMiddleware } = await import('../../../api/middleware/api-version');

/**
 * Unit tests for API version middleware
 */
describe('apiVersionMiddleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let statusMock: ReturnType<typeof mock>;
  let jsonMock: ReturnType<typeof mock>;
  let setHeaderMock: ReturnType<typeof mock>;

  beforeEach(() => {
    jsonMock = mock(() => mockRes);
    statusMock = mock(() => ({ json: jsonMock }));
    setHeaderMock = mock(() => undefined);
    mockReq = { headers: {} };
    mockRes = {
      status: statusMock,
      json: jsonMock,
      setHeader: setHeaderMock,
    } as Partial<Response>;
    mockNext = mock(() => undefined);
  });

  it('should call next when API-Version 1.0 is provided', () => {
    mockReq.headers = { 'api-version': '1.0' };

    apiVersionMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(setHeaderMock).toHaveBeenCalledWith('API-Version', '1.0');
  });

  it('should default to version 1.0 when header is missing', () => {
    mockReq.headers = {};

    apiVersionMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(setHeaderMock).toHaveBeenCalledWith('API-Version', '1.0');
  });

  it('should return 400 for unsupported version', () => {
    mockReq.headers = { 'api-version': '99.0' };

    apiVersionMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_API_VERSION' }));
    expect(mockNext).not.toHaveBeenCalled();
  });
});
