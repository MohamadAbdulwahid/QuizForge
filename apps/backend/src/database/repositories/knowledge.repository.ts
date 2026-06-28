import { and, eq } from 'drizzle-orm';
import { db } from '../client';
import {
  InsertKnowledgeNode,
  InsertKnowledgeEdge,
  KnowledgeNode,
  KnowledgeEdge,
  KNOWLEDGE_NODE,
  KNOWLEDGE_EDGE,
} from '../schema/knowledge';

/**
 * Returns the full knowledge graph (nodes + edges) for a user.
 * Both queries are scoped by user_id and leverage the
 * knowledge_node_user_idx / knowledge_edge_user_idx indexes.
 * @param userId - Auth user id.
 * @returns Object containing nodes and edges arrays.
 */
export async function getGraphByUserId(userId: string): Promise<{
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
}> {
  const [nodes, edges] = await Promise.all([
    db
      .select()
      .from(KNOWLEDGE_NODE)
      .where(eq(KNOWLEDGE_NODE.user_id, userId)),
    db
      .select()
      .from(KNOWLEDGE_EDGE)
      .where(eq(KNOWLEDGE_EDGE.user_id, userId)),
  ]);

  return { nodes, edges };
}

/**
 * Creates or updates knowledge nodes for a user.
 *
 * Upsert strategy: match on (user_id, quiz_id, concept_label).
 * When a matching row exists the mutable fields (mastery_score,
 * total_attempts, correct_attempts, last_analyzed_at) are updated;
 * otherwise a new row is inserted.
 *
 * Runs inside a transaction so either all nodes are written or none.
 * @param userId - Auth user id.
 * @param nodes - Array of node payloads (user_id is injected).
 * @returns Upserted node rows.
 */
export async function upsertNodes(
  userId: string,
  nodes: Array<Omit<InsertKnowledgeNode, 'user_id'>>
): Promise<KnowledgeNode[]> {
  if (nodes.length === 0) {
    return [];
  }

  return db.transaction(async (tx) => {
    const results: KnowledgeNode[] = [];

    for (const node of nodes) {
      const existing = await tx
        .select()
        .from(KNOWLEDGE_NODE)
        .where(
          and(
            eq(KNOWLEDGE_NODE.user_id, userId),
            eq(KNOWLEDGE_NODE.quiz_id, node.quiz_id),
            eq(KNOWLEDGE_NODE.concept_label, node.concept_label)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        const [updated] = await tx
          .update(KNOWLEDGE_NODE)
          .set({
            mastery_score: node.mastery_score,
            total_attempts: node.total_attempts,
            correct_attempts: node.correct_attempts,
            last_analyzed_at: node.last_analyzed_at,
          })
          .where(eq(KNOWLEDGE_NODE.id, existing[0].id))
          .returning();

        results.push(updated);
      } else {
        const [inserted] = await tx
          .insert(KNOWLEDGE_NODE)
          .values({ ...node, user_id: userId })
          .returning();

        results.push(inserted);
      }
    }

    return results;
  });
}

/**
 * Creates or updates knowledge edges for a user.
 *
 * Upsert strategy: match on (user_id, source_node_id, target_node_id).
 * When a matching row exists the mutable fields (relationship_type,
 * strength, ai_explanation) are updated; otherwise a new row is inserted.
 *
 * Runs inside a transaction so either all edges are written or none.
 * @param userId - Auth user id.
 * @param edges - Array of edge payloads (user_id is injected).
 * @returns Upserted edge rows.
 */
export async function upsertEdges(
  userId: string,
  edges: Array<Omit<InsertKnowledgeEdge, 'user_id'>>
): Promise<KnowledgeEdge[]> {
  if (edges.length === 0) {
    return [];
  }

  return db.transaction(async (tx) => {
    const results: KnowledgeEdge[] = [];

    for (const edge of edges) {
      const existing = await tx
        .select()
        .from(KNOWLEDGE_EDGE)
        .where(
          and(
            eq(KNOWLEDGE_EDGE.user_id, userId),
            eq(KNOWLEDGE_EDGE.source_node_id, edge.source_node_id),
            eq(KNOWLEDGE_EDGE.target_node_id, edge.target_node_id)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        const [updated] = await tx
          .update(KNOWLEDGE_EDGE)
          .set({
            relationship_type: edge.relationship_type,
            strength: edge.strength,
            ai_explanation: edge.ai_explanation,
          })
          .where(eq(KNOWLEDGE_EDGE.id, existing[0].id))
          .returning();

        results.push(updated);
      } else {
        const [inserted] = await tx
          .insert(KNOWLEDGE_EDGE)
          .values({ ...edge, user_id: userId })
          .returning();

        results.push(inserted);
      }
    }

    return results;
  });
}
