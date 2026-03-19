import { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '../../config/logger';
import { StatusCodes } from 'http-status-codes';

const versionLogger = createChildLogger('api-version');

const SUPPORTED_VERSIONS = ['1.0'];
const DEFAULT_VERSION = '1.0';

/**
 * Validates the API-Version header
 * Defaults to latest stable version if header is missing
 * Returns 400 for unsupported versions
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export function apiVersionMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestedVersion = (req.headers['api-version'] as string) || DEFAULT_VERSION;

  if (!SUPPORTED_VERSIONS.includes(requestedVersion)) {
    versionLogger.warn({ requestedVersion }, 'Unsupported API version requested');
    res.status(400).json({
      error: 'Unsupported API version',
      code: 'INVALID_API_VERSION',
      statusCode: StatusCodes.BAD_REQUEST,
      supportedVersions: SUPPORTED_VERSIONS,
    });
    return;
  }

  res.setHeader('API-Version', requestedVersion);
  next();
}
