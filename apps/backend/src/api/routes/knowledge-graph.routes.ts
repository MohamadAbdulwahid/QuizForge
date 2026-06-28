import { Router, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import type { AuthenticatedRequest } from '../middleware/auth';
import { getGraphByUserId } from '../../database/repositories/knowledge.repository';
import { db } from '../../database/client';
import { KNOWLEDGE_NODE } from '../../database/schema/knowledge';
import { eq, and, lt } from 'drizzle-orm';
import { createChildLogger } from '../../config/logger';

const logger = createChildLogger('knowledge-graph');

export const knowledgeGraphRouter = Router();

/**
 * GET /api/knowledge-graph
 * Returns the full knowledge graph (nodes + edges) for the authenticated user.
 */
knowledgeGraphRouter.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;

  try {
    const graph = await getGraphByUserId(userId);
    res.status(StatusCodes.OK).json(graph);
  } catch (error) {
    logger.error({ err: error, userId }, 'Failed to fetch knowledge graph');
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      error: 'Failed to fetch knowledge graph',
      code: 'KNOWLEDGE_GRAPH_FETCH_FAILED',
    });
  }
});

/**
 * GET /api/knowledge-graph/recommendations
 * Returns AI-generated recommendations based on struggling concepts.
 * Focuses on nodes with mastery_score < 50 and returns suggested topics to review.
 */
knowledgeGraphRouter.get(
  '/recommendations',
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;

    try {
      // Fetch nodes with low mastery scores (struggling concepts)
      const strugglingNodes = await db
        .select()
        .from(KNOWLEDGE_NODE)
        .where(
          and(
            eq(KNOWLEDGE_NODE.user_id, userId),
            lt(KNOWLEDGE_NODE.mastery_score, 50)
          )
        );

      // Generate recommendations based on struggling concepts
      const recommendations = generateRecommendations(strugglingNodes);

      res.status(StatusCodes.OK).json({ recommendations });
    } catch (error) {
      logger.error({ err: error, userId }, 'Failed to generate recommendations');
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to generate recommendations',
        code: 'RECOMMENDATIONS_GENERATION_FAILED',
      });
    }
  }
);

/**
 * Generates personalized study recommendations based on struggling concepts.
 * @param strugglingNodes - Nodes with mastery_score < 50.
 * @returns Array of recommendation objects.
 */
function generateRecommendations(
  strugglingNodes: Array<{
    concept_label: string;
    mastery_score: number;
    total_attempts: number;
    correct_attempts: number;
  }>
): Array<{
  concept: string;
  priority: 'high' | 'medium' | 'low';
  suggestedAction: string;
  masteryScore: number;
}> {
  if (strugglingNodes.length === 0) {
    return [];
  }

  // Sort by mastery score (lowest first) and take top 5
  const sorted = [...strugglingNodes]
    .sort((a, b) => a.mastery_score - b.mastery_score)
    .slice(0, 5);

  return sorted.map((node) => {
    const priority = getPriority(node.mastery_score);
    const suggestedAction = getSuggestedAction(node);

    return {
      concept: node.concept_label,
      priority,
      suggestedAction,
      masteryScore: node.mastery_score,
    };
  });
}

/**
 * Determines recommendation priority based on mastery score.
 */
function getPriority(masteryScore: number): 'high' | 'medium' | 'low' {
  if (masteryScore < 25) return 'high';
  if (masteryScore < 40) return 'medium';
  return 'low';
}

/**
 * Generates a suggested action based on node performance.
 */
function getSuggestedAction(node: {
  mastery_score: number;
  total_attempts: number;
  correct_attempts: number;
}): string {
  const successRate = node.total_attempts > 0 
    ? (node.correct_attempts / node.total_attempts) * 100 
    : 0;

  if (node.mastery_score < 25) {
    return `Review fundamental concepts of "${node.concept_label}" from scratch. Consider watching tutorial videos or reading introductory materials.`;
  }

  if (successRate < 30) {
    return `Practice more questions on "${node.concept_label}". Focus on understanding the reasoning behind correct answers.`;
  }

  return `Revisit "${node.concept_label}" with targeted practice. Pay attention to common mistake patterns.`;
}
