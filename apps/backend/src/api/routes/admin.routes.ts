import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { adminMiddleware } from '../middleware/admin';
import { AdminController } from '../controllers/admin.controller';

const adminRouter = Router();
const adminController = new AdminController();

// Lightweight admin check endpoint (returns 200 or 403)
adminRouter.get('/check', authMiddleware, adminMiddleware, (_req, res) => {
  res.status(200).json({ isAdmin: true });
});

// All admin routes require authentication + admin role
adminRouter.use(authMiddleware, adminMiddleware);

// Platform statistics
adminRouter.get('/stats', (req, res) => adminController.getStats(req, res));

// Recent sessions
adminRouter.get('/sessions', (req, res) => adminController.getRecentSessions(req, res));

// Stale sessions
adminRouter.get('/sessions/stale', (req, res) => adminController.getStaleSessions(req, res));

// Session analytics
adminRouter.get('/sessions/:sessionId/analytics', (req, res) =>
  adminController.getSessionAnalytics(req, res)
);

// Terminate session
adminRouter.post('/sessions/:sessionId/terminate', (req, res) =>
  adminController.terminateSession(req, res)
);

export { adminRouter };
