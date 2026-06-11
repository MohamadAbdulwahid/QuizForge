# Performance & Tuning Decisions

## Overview

QuizForge targets sub-second response times for game actions and smooth 60fps animations on mid-range mobile devices. This document records tuning decisions, performance targets, and operational guidelines.

## Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Main bundle size | < 200 KB (gzipped) | `bun run build:frontend` output |
| Time to Interactive (TTI) | < 3s on 3G | Lighthouse |
| First Contentful Paint (FCP) | < 1.8s | Lighthouse |
| Largest Contentful Paint (LCP) | < 2.5s | Lighthouse |
| Cumulative Layout Shift (CLS) | < 0.1 | Lighthouse |
| WebSocket round-trip | < 100ms | Server-side timing |
| API response time (p95) | < 200ms | Server logs |
| Database query time (p95) | < 50ms | Drizzle query logging |

## Tuning Decisions

### WebSocket Rate Limiting

**Decision:** 100ms throttle window for `score-update` and `leaderboard-update` broadcasts.

**Rationale:** With 20+ players answering simultaneously, raw score updates would flood clients with redundant data. 100ms batches updates while maintaining perceived real-time feel. Critical events (`game-ended`, `session-closed`) bypass the throttle.

**Location:** `apps/backend/src/websocket/rate-limit.ts`

### Session Cleanup Scheduler

**Decision:** Run cleanup every 5 minutes, deleting ended sessions and orphaned active sessions.

**Rationale:** Ended sessions accumulate over time. Orphaned sessions (host disconnected without ending) waste database rows and PIN slots. 5-minute interval balances freshness with database load. Immediate cleanup also happens on session end/disconnect as the primary mechanism.

**Location:** `apps/backend/src/websocket/namespaces/game.namespace.ts` (`startCleanupScheduler`)

### Database Indexes

**Decision:** Indexes on hot-path columns only (session PIN, session status, session host, player session/user, game event session, quiz creator/share code, question quiz, group creator/discoverable, group member user, join request group, invite user).

**Rationale:** These columns are used in WHERE clauses for the most frequent queries: session lookup by PIN, player list by session, event history by session, quiz list by creator. Composite or covering indexes were not added to avoid write amplification.

**Location:** `apps/backend/src/database/schema/*.ts`

### Frontend Cache Staleness

**Decision:** 5-minute staleness window for dashboard cache data.

**Rationale:** Dashboard data (groups, sessions, quiz count) changes infrequently. SSE push events trigger immediate cache invalidation for real-time updates. The 5-minute window prevents redundant API calls during normal navigation while SSE keeps data fresh.

**Location:** `apps/frontend/src/app/core/services/dashboard-cache.service.ts`

### Timer Resolution

**Decision:** 250ms interval for game timer updates.

**Rationale:** 250ms provides smooth countdown animation without excessive signal updates. Lower intervals (100ms, 16ms) waste CPU on changes that are imperceptible to users. The server-authoritative start time ensures all clients show the same remaining time regardless of local clock drift.

**Location:** `apps/frontend/src/app/features/game/services/game-state.service.ts`

### Reconnection Strategy

**Decision:** Exponential backoff starting at 1s, max 30s, up to 20 attempts.

**Rationale:** Short initial delay for quick recovery from transient disconnects. Exponential backoff prevents thundering herd when server restarts. 20 attempts (~5 minutes total) gives ample recovery time before requiring manual intervention.

**Location:** `apps/frontend/src/app/core/services/websocket.service.ts`

## Lighthouse Setup

### Install Lighthouse CI

```bash
npm install -g @lhci/cli
```

### Configuration

Create `lighthouserc.json` at project root:

```json
{
  "ci": {
    "collect": {
      "url": ["http://localhost:4200/"],
      "startServerCommand": "bun run dev:frontend",
      "numberOfRuns": 3
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9 }],
        "categories:accessibility": ["warn", { "minScore": 0.9 }],
        "first-contentful-paint": ["error", { "maxNumericValue": 1800 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }]
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    }
  }
}
```

### Run

```bash
npx lhci autorun
```

## Bundle Analysis

```bash
bun run build:frontend -- --stats-json
npx webpack-bundle-analyzer apps/frontend/dist/stats.json
```

## Monitoring

### Sentry Integration

Sentry is configured for both backend and frontend:

- **Backend:** `@sentry/node` initialized in `main.ts`, reports unhandled errors from the global error handler
- **Frontend:** `@sentry/angular` initialized in `app.config.ts`, captures unhandled exceptions and browser tracing

**Configuration:** Set `SENTRY_DSN` (backend) and `VITE_SENTRY_DSN` (frontend) environment variables. Leave unset to disable Sentry (development default).

### Error Reporting

All unhandled 500 errors are automatically reported to Sentry with request path and method context. Expected errors (validation, auth, business logic) are not reported since they represent normal application flow.
