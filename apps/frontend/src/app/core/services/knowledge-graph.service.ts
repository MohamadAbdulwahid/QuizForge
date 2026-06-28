import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';

// --- Types matching backend schema ---

export interface KnowledgeNode {
  id: number;
  user_id: string;
  quiz_id: number;
  concept_label: string;
  mastery_score: number;
  total_attempts: number;
  correct_attempts: number;
  last_analyzed_at: string | null;
  created_at: string;
}

export interface KnowledgeEdge {
  id: number;
  user_id: string;
  source_node_id: number;
  target_node_id: number;
  relationship_type: 'prerequisite' | 'related' | 'part-of' | 'contradicts';
  strength: number;
  ai_explanation: string | null;
  created_at: string;
}

export interface KnowledgeGraph {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
}

export interface Recommendation {
  concept: string;
  priority: 'high' | 'medium' | 'low';
  suggestedAction: string;
  masteryScore: number;
}

interface RecommendationsResponse {
  recommendations: Recommendation[];
}

// --- Service ---

@Injectable({ providedIn: 'root' })
export class KnowledgeGraphService {
  private readonly apiService = inject(ApiService);

  // Private writable signals
  private readonly _graph = signal<KnowledgeGraph | null>(null);
  private readonly _recommendations = signal<Recommendation[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  // Public readonly signals
  readonly graph = this._graph.asReadonly();
  readonly recommendations = this._recommendations.asReadonly();
  readonly isLoading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  // Computed signals
  readonly nodes = computed(() => this._graph()?.nodes ?? []);
  readonly edges = computed(() => this._graph()?.edges ?? []);
  readonly hasGraph = computed(() => this._graph() !== null);
  readonly hasRecommendations = computed(() => this._recommendations().length > 0);

  /**
   * Fetches the full knowledge graph (nodes + edges) for the authenticated user.
   */
  async loadGraph(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const graph = await firstValueFrom(
        this.apiService.get<KnowledgeGraph>('/api/knowledge-graph')
      );
      this._graph.set(graph);
    } catch (err) {
      console.error('KnowledgeGraphService: Failed to load graph', err);
      this._error.set('Failed to load knowledge graph. Please try again.');
    } finally {
      this._loading.set(false);
    }
  }

  /**
   * Fetches AI-generated recommendations based on struggling concepts.
   */
  async loadRecommendations(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const response = await firstValueFrom(
        this.apiService.get<RecommendationsResponse>('/api/knowledge-graph/recommendations')
      );
      this._recommendations.set(response.recommendations);
    } catch (err) {
      console.error('KnowledgeGraphService: Failed to load recommendations', err);
      this._error.set('Failed to load recommendations. Please try again.');
    } finally {
      this._loading.set(false);
    }
  }

  /**
   * Loads both graph and recommendations in parallel.
   */
  async loadAll(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const [graph, recommendationsResponse] = await Promise.all([
        firstValueFrom(this.apiService.get<KnowledgeGraph>('/api/knowledge-graph')),
        firstValueFrom(
          this.apiService.get<RecommendationsResponse>('/api/knowledge-graph/recommendations')
        ),
      ]);

      this._graph.set(graph);
      this._recommendations.set(recommendationsResponse.recommendations);
    } catch (err) {
      console.error('KnowledgeGraphService: Failed to load knowledge data', err);
      this._error.set('Failed to load knowledge data. Please try again.');
    } finally {
      this._loading.set(false);
    }
  }

  /**
   * Clears all cached data (e.g., on logout).
   */
  clear(): void {
    this._graph.set(null);
    this._recommendations.set([]);
    this._error.set(null);
  }
}
