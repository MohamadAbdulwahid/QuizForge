# Sprint 5 Effort Plan

**Sprint Duration:** 2 weeks (10 working days)  
**Target Velocity:** 30 Story Points  
**Team Size:** 4 developers

---

## Team Members & Roles

| Name | Role | Primary Focus | Hour worked |
|------|------|---------------|--------------|
| **Mohamad** | Product Owner, Developer | Game session orchestration, scoring engine | 16h |
| **David** | Scrum Master, Developer | Host flow, manual question control, event persistence | 16h |
| **Nishan** | Stakeholder, Developer | Question broadcast, validation, WebSocket sequencing | 14h |
| **Behrang** | Stakeholder, Developer | Player game state services, answer submission UI/state | 14h |

---

## Effort Distribution by Developer

### Mohamad - 6 SP

- **PB-46**: Start a game session so questions are broadcast to all players (3 SP) - Days 1-4
- **PB-50**: Forge Classic scoring algorithm (`Points = Correctness × Speed Factor`) (3 SP) - Days 5-8

**Responsibilities:**
- Build the backend flow that moves a session from lobby state into active play.
- Validate host permissions before starting a round and prevent double-starts.
- Compute scoring on the server using question metadata and the remaining-time multiplier.
- Keep the scoring path deterministic so later leaderboard and analytics work can trust it.

---

### David - 8 SP

- **PB-53**: Advance to next question manually (host controls flow) (2 SP) - Days 1-3
- **PB-52**: Game events table to log all answer submissions for analytics (2 SP) - Days 4-6
- **PB-51**: Real-time score updates broadcast (`score-update` event) so leaderboard is updated (2 SP) - Days 7-9
- **PB-43**: WebSocket rate limiting (100ms throttle) so the server isn't overloaded (2 SP) - Days 8-10

**Responsibilities:**
- Build the host-facing control path for moving through questions after each round resolves.
- Persist gameplay events in a consistent shape for replays, diagnostics, and later analytics.
- Shape leaderboard payloads so score updates are stable and easy for the frontend to consume.
- Ensure session progress only advances when scoring and logging have completed for the current question.
- Keep room broadcasts throttled so rapid question or score updates do not overwhelm the Socket.IO layer.

---

### Nishan - 7 SP

- **PB-47**: Questions broadcast via WebSocket (`question` event) with timer so all players receive simultaneously (3 SP) - Days 1-5
- **PB-49**: Server-side answer validation (correctness + timestamp) so cheating is prevented (4 SP) - Days 6-10

**Responsibilities:**
- Implement the authoritative WebSocket question payload and timer start for every active room.
- Ensure all connected players receive identical question data at the same logical start time.
- Validate answer submissions against the active question window, session state, and question answer set.
- Block duplicate or late submissions before they can affect scoring or persistence.

---

### Behrang - 9 SP

- **PB-48**: Submit answers within time limit so player responses are recorded (3 SP) - Days 1-5
- **PB-74**: WebSocketService and GameStateService with Signals (`players`, `currentQuestion`, `leaderboard`) (3 SP) - Days 6-10
- **PB-42**: Player disconnect/reconnect handling so sessions remain stable (3 SP) - Days 6-10

**Responsibilities:**
- Build the player-facing answer submission path with optimistic UI feedback and clean acknowledgements.
- Keep the frontend game state reactive using Signals for current question, player list, and leaderboard.
- Subscribe to live socket events and translate them into stable UI state updates.
- Make the game shell resilient to navigation changes, reconnects, and mid-question state refreshes.
- Restore game state cleanly when a player reconnects after a short disconnect or navigation interruption.
