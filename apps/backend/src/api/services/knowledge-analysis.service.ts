import { and, eq } from 'drizzle-orm';
import { config } from '../../config/config';
import { createChildLogger } from '../../config/logger';
import { db } from '../../database/client';
import { GAME_EVENT, SESSION, SESSION_PLAYER } from '../../database/schema/session';
import { KNOWLEDGE_NODE, KNOWLEDGE_EDGE } from '../../database/schema/knowledge';
import { QUESTION, QUIZ } from '../../database/schema/quiz';
import { AppError } from '../../shared/errors';

const logger = createChildLogger('knowledge-analysis');

// Knowledge analysis requires more time than quiz generation because it must
// process all player answers, group by concept, and generate nodes + edges.
const AI_TIMEOUT_MS = 180_000; // 3 minutes

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AnswerEvent {
  sessionPlayerId: number;
  userId: string;
  username: string;
  questionId: number;
  questionText: string;
  selectedAnswer: string;
  correct: boolean;
  elapsedMs: number;
  attemptNumber: number;
}

interface PlayerSummary {
  userId: string;
  username: string;
  answers: Array<{
    questionId: number;
    questionText: string;
    correct: boolean;
    attemptNumber: number;
    elapsedMs: number;
  }>;
}

interface AiKnowledgeResponse {
  nodes: Array<{
    user_id: string;
    concept_label: string;
    mastery_score: number;
    total_attempts: number;
    correct_attempts: number;
  }>;
  edges: Array<{
    user_id: string;
    source_concept: string;
    target_concept: string;
    relationship_type: 'prerequisite' | 'related' | 'part-of' | 'contradicts';
    strength: number;
    explanation: string;
  }>;
}

// ---------------------------------------------------------------------------
// System prompt for knowledge analysis
// ---------------------------------------------------------------------------

function buildSystemPrompt(): string {
  return `You are a knowledge analysis engine for the QuizForge platform. Your task is to analyze quiz session performance data and extract knowledge nodes (concepts) and edges (relationships) for each player.

## Input
You receive a JSON object with:
- "quiz_title": The quiz topic
- "players": Array of player performance data, each containing answers with question text, correctness, attempt numbers, and response times

## Output Format
Return a JSON object with "nodes" and "edges" arrays.

### Nodes
Each node represents a concept a player demonstrated knowledge (or lack thereof) of:
- "user_id" (string): The player's user ID
- "concept_label" (string): A concise concept name derived from the question topic (2-50 chars)
- "mastery_score" (integer): 0-100 mastery percentage based on performance
- "total_attempts" (integer): Total times the player encountered questions about this concept
- "correct_attempts" (integer): Times the player answered correctly for this concept

### Mastery Score Rules:
- First attempt correct, fast response (>50% time remaining): 85-100
- First attempt correct, moderate response: 70-84
- First attempt correct, slow response: 55-69
- Second attempt correct (repeated question): 40-54
- Multiple attempts, eventually correct: 25-39
- Never correct: 0-24
- Group related questions into the same concept when they test the same knowledge area

### Edges
Each edge represents a relationship between two concepts for the same user:
- "user_id" (string): The player's user ID
- "source_concept" (string): Must match a node's concept_label for this user
- "target_concept" (string): Must match a node's concept_label for this user
- "relationship_type" (string): One of "prerequisite", "related", "part-of", "contradicts"
- "strength" (number): 0.0-1.0 confidence in this relationship

### Edge Rules:
- "prerequisite": Understanding source is needed before target (e.g., "algebra" → "quadratic equations")
- "related": Concepts are in the same domain but neither requires the other
- "part-of": Source is a sub-topic of target
- "contradicts": Performance inconsistency suggests confusion between concepts
- Only create edges when there is evidence from the performance data
- Aim for 1-5 edges per player

## Rules
- Group similar questions into the same concept (e.g., multiple questions about "photosynthesis" → one node)
- Use the quiz title for context but derive specific concept labels from question text
- For repeated questions (attemptNumber > 1), factor the improvement into mastery_score
- Keep concept labels concise and specific (not generic like "Question 1")
- Output ONLY the JSON object — no markdown fences, no explanations`;
}

// ---------------------------------------------------------------------------
// Builds the user message from session data
// ---------------------------------------------------------------------------

function buildUserMessage(
  quizTitle: string,
  playerSummaries: PlayerSummary[]
): string {
  const compactPlayers = playerSummaries.map((p) => ({
    user_id: p.userId,
    username: p.username,
    answers: p.answers.map((a) => ({
      q: a.questionText,
      correct: a.correct,
      attempt: a.attemptNumber,
      ms: a.elapsedMs,
    })),
  }));

  return JSON.stringify({
    quiz_title: quizTitle,
    players: compactPlayers,
  });
}

// ---------------------------------------------------------------------------
// Fetches and groups answer events for a session
// ---------------------------------------------------------------------------

async function fetchSessionAnswerEvents(sessionId: number): Promise<AnswerEvent[]> {
  // Fetch all answer-submitted events for this session
  const events = await db
    .select({
      sessionPlayerId: GAME_EVENT.session_player_id,
      eventType: GAME_EVENT.event_type,
      data: GAME_EVENT.data,
    })
    .from(GAME_EVENT)
    .where(
      and(
        eq(GAME_EVENT.session_id, sessionId),
        eq(GAME_EVENT.event_type, 'answer-submitted')
      )
    );

  // Fetch session players to map player IDs to user IDs and usernames
  const players = await db
    .select({
      id: SESSION_PLAYER.id,
      userId: SESSION_PLAYER.user_id,
      username: SESSION_PLAYER.username,
    })
    .from(SESSION_PLAYER)
    .where(eq(SESSION_PLAYER.session_id, sessionId));

  const playerMap = new Map(players.map((p) => [p.id, p]));

  // Fetch all questions for the quiz to get question text
  const session = await db
    .select({ quizId: SESSION.quiz_id })
    .from(SESSION)
    .where(eq(SESSION.id, sessionId))
    .limit(1);

  if (!session[0]) {
    throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');
  }

  const questions = await db
    .select({
      id: QUESTION.id,
      text: QUESTION.text,
    })
    .from(QUESTION)
    .where(eq(QUESTION.quiz_id, session[0].quizId));

  const questionMap = new Map(questions.map((q) => [q.id, q.text]));

  // Track attempt numbers per player per question
  const attemptTracker = new Map<string, number>();

  // Parse events into structured answer data
  const answers: AnswerEvent[] = [];

  for (const event of events) {
    if (!event.data) continue;

    const data = event.data as Record<string, unknown>;
    const questionId = data.questionId as number;
    const selectedAnswer = data.selectedAnswer as string;
    const correct = data.correct as boolean;
    const elapsedMs = (data.elapsedMs as number) ?? 0;
    const dataUserId = data.userId as string | undefined;

    // Map event to player — try session_player_id first, then fall back to data.userId
    let player: { id: number; userId: string; username: string } | undefined;
    if (event.sessionPlayerId) {
      player = playerMap.get(event.sessionPlayerId);
    }
    if (!player && dataUserId) {
      // Fall back: find player by user_id from the event data
      player = players.find((p) => p.userId === dataUserId);
    }
    if (!player) continue;

    const questionText = questionMap.get(questionId) ?? `Question ${questionId}`;

    // Track attempt number per player per question
    const attemptKey = `${player.id}-${questionId}`;
    const attemptNumber = (attemptTracker.get(attemptKey) ?? 0) + 1;
    attemptTracker.set(attemptKey, attemptNumber);

    answers.push({
      sessionPlayerId: player.id,
      userId: player.userId,
      username: player.username,
      questionId,
      questionText,
      selectedAnswer,
      correct,
      elapsedMs,
      attemptNumber,
    });
  }

  return answers;
}

// ---------------------------------------------------------------------------
// Groups answers by player into summaries
// ---------------------------------------------------------------------------

function groupByPlayer(answers: AnswerEvent[]): PlayerSummary[] {
  const grouped = new Map<
    number,
    { userId: string; username: string; answers: AnswerEvent[] }
  >();

  for (const answer of answers) {
    const existing = grouped.get(answer.sessionPlayerId);
    if (existing) {
      existing.answers.push(answer);
    } else {
      grouped.set(answer.sessionPlayerId, {
        userId: answer.userId,
        username: answer.username,
        answers: [answer],
      });
    }
  }

  return Array.from(grouped.values()).map((g) => ({
    userId: g.userId,
    username: g.username,
    answers: g.answers.map((a) => ({
      questionId: a.questionId,
      questionText: a.questionText,
      correct: a.correct,
      attemptNumber: a.attemptNumber,
      elapsedMs: a.elapsedMs,
    })),
  }));
}

// ---------------------------------------------------------------------------
// Calls the AI API with the given messages
// ---------------------------------------------------------------------------

async function callAiApi(
  messages: { role: string; content: string }[]
): Promise<AiKnowledgeResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  const endpoint = `${config.AI_API_URL}/chat/completions`;

  try {
    logger.info({ endpoint, model: config.AI_MODEL }, 'Calling AI API for knowledge analysis');

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: config.AI_MODEL,
        messages,
        response_format: { type: 'json_object' },
        temperature: 0,
        max_completion_tokens: 4096,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '<unreadable>');
      logger.error(
        { status: response.status, endpoint, errorBody: errorBody.slice(0, 500) },
        'AI API returned non-200 response'
      );

      if (response.status === 429) {
        throw new AppError(
          'AI service rate limited — please try again later',
          429,
          'AI_RATE_LIMITED'
        );
      }
      if (response.status === 401 || response.status === 403) {
        throw new AppError(
          'AI service authentication failed — check AI_API_KEY',
          500,
          'AI_AUTH_FAILED'
        );
      }

      throw new AppError(`AI API returned status ${response.status}`, 502, 'AI_SERVICE_ERROR');
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data?.choices?.[0]?.message?.content;
    if (!content || typeof content !== 'string') {
      logger.error({ data: JSON.stringify(data).slice(0, 500) }, 'AI response missing content');
      throw new AppError('AI returned an empty or unexpected response', 502, 'AI_EMPTY_RESPONSE');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      logger.error({ content: content.slice(0, 500) }, 'Failed to parse AI response as JSON');
      throw new AppError('AI returned invalid JSON', 502, 'AI_INVALID_JSON');
    }

    if (typeof parsed !== 'object' || parsed === null) {
      logger.error(
        { parsed: JSON.stringify(parsed).slice(0, 500) },
        'AI response is not an object'
      );
      throw new AppError('AI response is not a valid object', 502, 'AI_INVALID_RESPONSE');
    }

    const responseObj = parsed as AiKnowledgeResponse;

    if (!Array.isArray(responseObj.nodes) || !Array.isArray(responseObj.edges)) {
      logger.error(
        { parsed: JSON.stringify(parsed).slice(0, 500) },
        'AI response missing nodes or edges arrays'
      );
      throw new AppError(
        'AI response is missing the "nodes" or "edges" field',
        502,
        'AI_MISSING_FIELDS'
      );
    }

    return responseObj;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      logger.error({ timeoutMs: AI_TIMEOUT_MS }, 'AI API request timed out');
      throw new AppError('AI request timed out — please try again', 504, 'AI_TIMEOUT');
    }

    logger.error({ err: error }, 'Unexpected error calling AI API');
    throw new AppError('Failed to communicate with AI service', 502, 'AI_REQUEST_FAILED');
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---------------------------------------------------------------------------
// Persists knowledge nodes and edges to the database
// ---------------------------------------------------------------------------

async function persistKnowledgeGraph(
  sessionId: number,
  quizId: number,
  aiResponse: AiKnowledgeResponse
): Promise<{ nodeCount: number; edgeCount: number }> {
  // Build a map of concept_label → node id per user for edge resolution
  const nodeIdMap = new Map<string, number>();

  // Delete existing knowledge data for this session's quiz + users
  // This ensures idempotent re-analysis
  const userIds = [...new Set(aiResponse.nodes.map((n) => n.user_id))];

  for (const userId of userIds) {
    // Delete edges first (FK constraint)
    await db
      .delete(KNOWLEDGE_EDGE)
      .where(eq(KNOWLEDGE_EDGE.user_id, userId));

    // Delete existing nodes for this user + quiz
    await db
      .delete(KNOWLEDGE_NODE)
      .where(
        and(eq(KNOWLEDGE_NODE.user_id, userId), eq(KNOWLEDGE_NODE.quiz_id, quizId))
      );
  }

  // Insert nodes
  for (const node of aiResponse.nodes) {
    const [inserted] = await db
      .insert(KNOWLEDGE_NODE)
      .values({
        user_id: node.user_id,
        quiz_id: quizId,
        concept_label: node.concept_label,
        mastery_score: Math.max(0, Math.min(100, Math.round(node.mastery_score))),
        total_attempts: Math.max(0, node.total_attempts),
        correct_attempts: Math.max(0, Math.min(node.total_attempts, node.correct_attempts)),
        last_analyzed_at: new Date(),
      })
      .returning();

    // Store the mapping: user_id:concept_label → node id
    nodeIdMap.set(`${node.user_id}:${node.concept_label}`, inserted.id);
  }

  // Insert edges
  let edgeCount = 0;
  for (const edge of aiResponse.edges) {
    const sourceKey = `${edge.user_id}:${edge.source_concept}`;
    const targetKey = `${edge.user_id}:${edge.target_concept}`;
    const sourceNodeId = nodeIdMap.get(sourceKey);
    const targetNodeId = nodeIdMap.get(targetKey);

    if (!sourceNodeId || !targetNodeId) {
      logger.warn(
        { sourceKey, targetKey, sourceNodeId, targetNodeId },
        'Skipping edge — source or target node not found'
      );
      continue;
    }

    // Skip self-referencing edges
    if (sourceNodeId === targetNodeId) {
      continue;
    }

    await db.insert(KNOWLEDGE_EDGE).values({
      user_id: edge.user_id,
      source_node_id: sourceNodeId,
      target_node_id: targetNodeId,
      relationship_type: edge.relationship_type,
      strength: Math.max(0, Math.min(1, edge.strength)),
      ai_explanation: edge.explanation,
    });

    edgeCount += 1;
  }

  return { nodeCount: aiResponse.nodes.length, edgeCount };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Analyzes a completed game session and generates a knowledge graph for each
 * player. Fetches all answer events, groups by player and question (tracking
 * repeated attempts), sends a single batched AI call, and persists the
 * resulting knowledge nodes and edges.
 *
 * @param sessionId - The session ID to analyze (must be in 'ended' status).
 * @returns Summary of created nodes and edges.
 *
 * @throws {AppError} When session is not found, not ended, AI fails, or DB errors.
 */
export async function analyzeSession(sessionId: number): Promise<{
  nodeCount: number;
  edgeCount: number;
}> {
  // Validate session exists and is ended
  const session = await db
    .select({
      id: SESSION.id,
      quizId: SESSION.quiz_id,
      status: SESSION.status,
    })
    .from(SESSION)
    .where(eq(SESSION.id, sessionId))
    .limit(1);

  if (!session[0]) {
    throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');
  }

  if (session[0].status !== 'ended') {
    throw new AppError(
      'Session must be in ended status before knowledge analysis',
      400,
      'SESSION_NOT_ENDED'
    );
  }

  const { quizId } = session[0];

  // Check AI is configured
  if (!config.AI_API_URL || !config.AI_API_KEY) {
    throw new AppError(
      'Knowledge analysis requires AI configuration — set AI_API_URL and AI_API_KEY',
      503,
      'AI_NOT_CONFIGURED'
    );
  }

  logger.info({ sessionId, quizId }, 'Starting knowledge analysis');

  // Fetch and group answer events
  const answers = await fetchSessionAnswerEvents(sessionId);

  if (answers.length === 0) {
    logger.warn({ sessionId }, 'No answer events found for session — skipping analysis');
    return { nodeCount: 0, edgeCount: 0 };
  }

  const playerSummaries = groupByPlayer(answers);

  logger.info(
    {
      sessionId,
      playerCount: playerSummaries.length,
      totalAnswers: answers.length,
    },
    'Collected answer data for analysis'
  );

  // Get quiz title for context
  const quiz = await db
    .select({ title: QUIZ.title })
    .from(QUIZ)
    .where(eq(QUIZ.id, quizId))
    .limit(1);

  const quizTitle = quiz[0]?.title ?? 'Quiz';

  // Build AI prompt
  const systemPrompt = buildSystemPrompt();
  const userMessage = buildUserMessage(quizTitle, playerSummaries);

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  // Call AI
  const aiResponse = await callAiApi(messages);

  logger.info(
    {
      sessionId,
      nodeCount: aiResponse.nodes.length,
      edgeCount: aiResponse.edges.length,
    },
    'AI analysis complete'
  );

  // Persist results
  const result = await persistKnowledgeGraph(sessionId, quizId, aiResponse);

  logger.info(
    {
      sessionId,
      nodeCount: result.nodeCount,
      edgeCount: result.edgeCount,
    },
    'Knowledge graph persisted'
  );

  return result;
}
