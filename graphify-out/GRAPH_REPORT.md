# Graph Report - QuizForge  (2026-06-12)

## Corpus Check
- 290 files · ~263,896 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 15 nodes · 14 edges · 3 communities (2 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4ec8a451`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]

## God Nodes (most connected - your core abstractions)
1. `Sprint Backlog Items` - 8 edges
2. `Sprint 6 Backlog - End-to-End Gameplay, Stability & Admin Polish` - 4 edges
3. `Sprint 6 Test Plan` - 4 edges
4. `Prerequisites from Sprint 5` - 1 edges
5. `PB-39 + PB-40 + PB-44 + PB-76: Session Join Flow, Username Validation, and Live Lobby (Mohamad)` - 1 edges
6. `PB-79 + PB-80 + PB-54: Question Screen, Answer Submission, and Live Leaderboard (David)` - 1 edges
7. `PB-42 + PB-43 + PB-100 + PB-101 + PB-102: Stability, Performance, and Database Optimization (Nishan)` - 1 edges
8. `PB-104 + PB-105 + PB-63: Owner Admin Dashboard, Analytics, and Monitoring (Behrang)` - 1 edges
9. `PB-82 + PB-83 + PB-86: Chest Generation, Gold Economy & Validation (Backend)` - 1 edges
10. `PB-87 + PB-88: Steal & Swap Mechanics with WebSocket Broadcast (Backend)` - 1 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Import Cycles
- None detected.

## Communities (3 total, 1 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.25
Nodes (8): PB-104 + PB-105 + PB-63: Owner Admin Dashboard, Analytics, and Monitoring (Behrang), PB-39 + PB-40 + PB-44 + PB-76: Session Join Flow, Username Validation, and Live Lobby (Mohamad), PB-42 + PB-43 + PB-100 + PB-101 + PB-102: Stability, Performance, and Database Optimization (Nishan), PB-79 + PB-80 + PB-54: Question Screen, Answer Submission, and Live Leaderboard (David), PB-82 + PB-83 + PB-86: Chest Generation, Gold Economy & Validation (Backend), PB-84 + PB-85 + PB-89 + PB-90: Treasure Chest UI, Animations & Gold Display (Frontend), PB-87 + PB-88: Steal & Swap Mechanics with WebSocket Broadcast (Backend), Sprint Backlog Items

### Community 1 - "Community 1"
Cohesion: 0.50
Nodes (4): E2E Tests, Integration Tests, Sprint 6 Test Plan, Unit Tests

## Knowledge Gaps
- **11 isolated node(s):** `Prerequisites from Sprint 5`, `PB-39 + PB-40 + PB-44 + PB-76: Session Join Flow, Username Validation, and Live Lobby (Mohamad)`, `PB-79 + PB-80 + PB-54: Question Screen, Answer Submission, and Live Leaderboard (David)`, `PB-42 + PB-43 + PB-100 + PB-101 + PB-102: Stability, Performance, and Database Optimization (Nishan)`, `PB-104 + PB-105 + PB-63: Owner Admin Dashboard, Analytics, and Monitoring (Behrang)` (+6 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Sprint Backlog Items` connect `Community 0` to `Community 2`?**
  _High betweenness centrality (0.769) - this node is a cross-community bridge._
- **Why does `Sprint 6 Backlog - End-to-End Gameplay, Stability & Admin Polish` connect `Community 2` to `Community 0`, `Community 1`?**
  _High betweenness centrality (0.626) - this node is a cross-community bridge._
- **Why does `Sprint 6 Test Plan` connect `Community 1` to `Community 2`?**
  _High betweenness centrality (0.396) - this node is a cross-community bridge._
- **What connects `Prerequisites from Sprint 5`, `PB-39 + PB-40 + PB-44 + PB-76: Session Join Flow, Username Validation, and Live Lobby (Mohamad)`, `PB-79 + PB-80 + PB-54: Question Screen, Answer Submission, and Live Leaderboard (David)` to the rest of the system?**
  _11 weakly-connected nodes found - possible documentation gaps or missing edges._