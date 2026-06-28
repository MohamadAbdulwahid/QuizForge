import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { KnowledgeGraphService } from '../../core/services/knowledge-graph.service';
import { SessionEventBus } from '../../core/services/session-event-bus.service';
import { KnowledgeGraphComponent } from './knowledge-graph/knowledge-graph.component';

@Component({
  selector: 'app-knowledge-graph-page',
  standalone: true,
  imports: [CommonModule, KnowledgeGraphComponent, RouterLink],
  template: `
    <!-- Page Header -->
    <div class="mb-8">
      <p class="qf-eyebrow">Your Learning Journey</p>
      <h1 class="qf-h1 mt-2">Knowledge Map</h1>
      <p class="mt-2 text-base font-semibold text-slate-500">
        Visualize how concepts connect based on your quiz performance
      </p>
    </div>

    <!-- Loading State -->
    @if (graphService.isLoading()) {
      <div class="qf-surface flex h-96 items-center justify-center rounded-3xl">
        <div class="flex flex-col items-center gap-3">
          <div
            class="border-bubbly-primary h-10 w-10 animate-spin rounded-full border-4 border-t-transparent"
          ></div>
          <p class="text-sm font-semibold text-slate-500">Loading your knowledge map...</p>
        </div>
      </div>
    }

    <!-- Generating State (after a game, waiting for AI analysis) -->
    @if (isGenerating()) {
      <div class="qf-surface mb-6 rounded-3xl p-6">
        <div class="flex items-center gap-4">
          <div
            class="border-bubbly-accent h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"
          ></div>
          <div>
            <p class="font-display text-bubbly-primary-deep text-lg font-bold">
              Generating Knowledge Nodes...
            </p>
            <p class="text-sm font-semibold text-slate-500">
              The AI is analyzing your recent game performance. This usually takes 1-2 minutes.
            </p>
          </div>
        </div>
      </div>
    }

    <!-- Error State -->
    @if (graphService.error(); as error) {
      <div class="qf-alert-error mb-6">
        {{ error }}
      </div>
    }

    <!-- Empty State -->
    @if (!graphService.isLoading() && !graphService.hasGraph()) {
      <div class="qf-surface rounded-3xl p-12 text-center">
        <div
          class="bg-bubbly-primary/15 mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl"
        >
          <svg
            class="text-bubbly-primary-deep h-12 w-12"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"
            />
          </svg>
        </div>

        <h2 class="font-display text-bubbly-primary-deep text-2xl font-bold">
          No Knowledge Data Yet
        </h2>
        <p class="mt-3 max-w-md mx-auto text-base font-semibold text-slate-500">
          Complete quiz sessions to build your knowledge map. The AI will analyze your answers and
          show how concepts connect.
        </p>

        <div class="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <a
            routerLink="/dashboard/create-session"
            class="qf-button-primary qf-tactile inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-base font-bold"
          >
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Start a Quiz
          </a>
          <a
            routerLink="/dashboard/groups/discover"
            class="qf-button-ghost qf-tactile inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-base font-bold"
          >
            Join a Group
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </a>
        </div>
      </div>
    }

    <!-- Knowledge Graph -->
    @if (graphService.hasGraph()) {
      <div class="space-y-8">
        <!-- Graph Visualization -->
        <div class="qf-surface overflow-hidden rounded-3xl p-6">
          <app-knowledge-graph
            [nodes]="graphNodes()"
            [edges]="graphEdges()"
            [isLoading]="graphService.isLoading()"
            [errorMessage]="graphService.error()"
          />
        </div>

        <!-- AI Recommendations -->
        @if (graphService.hasRecommendations()) {
          <div>
            <div class="mb-5">
              <p class="qf-eyebrow">AI Insights</p>
              <h2 class="qf-h2 mt-1">Study Recommendations</h2>
              <p class="mt-1 text-sm font-semibold text-slate-500">
                Personalized suggestions based on your performance
              </p>
            </div>

            <div class="grid gap-4 md:grid-cols-2">
              @for (rec of graphService.recommendations(); track rec.concept) {
                <div class="qf-surface qf-tactile rounded-3xl p-6">
                  <div class="flex items-start gap-4">
                    <div
                      class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
                      [class]="
                        rec.priority === 'high'
                          ? 'bg-red-100 text-red-700'
                          : rec.priority === 'medium'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-emerald-700'
                      "
                    >
                      @if (rec.priority === 'high') {
                        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                        </svg>
                      } @else if (rec.priority === 'medium') {
                        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                        </svg>
                      } @else {
                        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                        </svg>
                      }
                    </div>
                    <div class="min-w-0 flex-1">
                      <h3 class="font-display text-bubbly-primary-deep text-lg font-bold">
                        {{ rec.concept }}
                      </h3>
                      <p class="mt-1 text-sm font-semibold text-slate-600">
                        {{ rec.suggestedAction }}
                      </p>

                    </div>
                  </div>
                </div>
              }
            </div>
          </div>
        }

        <!-- Legend -->
        <div class="qf-surface rounded-3xl p-6">
          <h3 class="font-display text-bubbly-primary-deep mb-4 text-lg font-bold">Legend</h3>
          <div class="flex flex-wrap gap-6">
            <div class="flex items-center gap-3">
              <div class="h-4 w-4 rounded-full bg-emerald-500"></div>
              <span class="text-sm font-semibold text-slate-600">Mastered (≥80%)</span>
            </div>
            <div class="flex items-center gap-3">
              <div class="h-4 w-4 rounded-full bg-amber-500"></div>
              <span class="text-sm font-semibold text-slate-600">Learning (50-79%)</span>
            </div>
            <div class="flex items-center gap-3">
              <div class="h-4 w-4 rounded-full bg-red-500"></div>
              <span class="text-sm font-semibold text-slate-600">Struggling (&lt;50%)</span>
            </div>
            <div class="flex items-center gap-3">
              <div class="h-0.5 w-8 bg-amber-400"></div>
              <span class="text-sm font-semibold text-slate-600">Concept Connection</span>
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class KnowledgeGraphPageComponent implements OnInit, OnDestroy {
  protected readonly graphService = inject(KnowledgeGraphService);
  private readonly sessionEventBus = inject(SessionEventBus);
  private knowledgeAnalysisSub: Subscription | null = null;

  /** True when we detect a game just ended and AI analysis is likely running. */
  protected readonly isGenerating = signal(false);

  // Transform backend nodes to component format
  protected readonly graphNodes = computed(() => {
    const nodes = this.graphService.nodes();
    return nodes.map((node) => ({
      id: String(node.id),
      label: node.concept_label,
      mastery: node.mastery_score,
      totalQuestions: node.total_attempts,
      correctAnswers: node.correct_attempts,
      lastPracticed: node.last_analyzed_at ?? undefined,
    }));
  });

  // Transform backend edges to component format
  protected readonly graphEdges = computed(() => {
    const edges = this.graphService.edges();
    return edges.map((edge) => ({
      source: String(edge.source_node_id),
      target: String(edge.target_node_id),
      strength: edge.strength,
    }));
  });

  ngOnInit(): void {
    this.graphService.loadAll();

    // Listen for knowledge analysis completion events via SSE
    this.knowledgeAnalysisSub = this.sessionEventBus.knowledgeAnalysisCompleted$.subscribe(
      () => {
        // Analysis completed — refresh the graph and hide generating state
        this.isGenerating.set(false);
        void this.graphService.loadAll();
      }
    );

    // Also listen for session ended events to show generating state
    // (the session ended event fires when a game ends, before analysis completes)
    this.sessionEventBus.sessionChanges$.subscribe(() => {
      // Check if we have no graph data — likely a game just ended
      if (!this.graphService.hasGraph()) {
        this.isGenerating.set(true);
      }
    });
  }

  ngOnDestroy(): void {
    this.knowledgeAnalysisSub?.unsubscribe();
  }
}
