import {
  Component,
  ElementRef,
  OnInit,
  OnDestroy,
  inject,
  input,
  output,
  signal,
  computed,
  effect,
  NgZone,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';

/** Represents a single concept/node in the knowledge graph. */
export interface KnowledgeNode {
  id: string;
  label: string;
  mastery: number; // 0-100
  category?: string;
  totalQuestions?: number;
  correctAnswers?: number;
  lastPracticed?: string;
}

/** Represents a connection between two concepts. */
export interface KnowledgeEdge {
  source: string;
  target: string;
  strength?: number; // 0-1, how strongly related
}

/** Data payload emitted when a node is clicked. */
export interface NodeClickEvent {
  node: KnowledgeNode;
  x: number;
  y: number;
}

/** Internal D3 simulation node with position data. */
interface D3Node extends KnowledgeNode {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

/** Internal D3 edge referencing node objects. */
interface D3Edge {
  source: D3Node | string;
  target: D3Node | string;
  strength?: number;
}

/**
 * Mastery color helper.
 * Green  >= 80%
 * Yellow  50-79%
 * Red    < 50%
 */
function masteryColor(mastery: number): string {
  if (mastery >= 80) return '#22c55e'; // green-500
  if (mastery >= 50) return '#eab308'; // yellow-500
  return '#ef4444'; // red-500
}

/** Returns a lighter fill for the node interior. */
function masteryFill(mastery: number): string {
  if (mastery >= 80) return '#dcfce7'; // green-100
  if (mastery >= 50) return '#fef9c3'; // yellow-100
  return '#fee2e2'; // red-100
}

@Component({
  selector: 'app-knowledge-graph',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './knowledge-graph.component.html',
  styles: [
    `
      :host {
        display: block;
        position: relative;
      }

      .kg-container {
        position: relative;
        width: 100%;
        height: 100%;
        min-height: 500px;
        border-radius: var(--bubbly-radius-xl);
        background: var(--bubbly-surface);
        border: 1px solid var(--bubbly-border);
        box-shadow: 0 6px 0 0 var(--bubbly-shadow);
        overflow: hidden;
      }

      .kg-svg {
        width: 100%;
        height: 100%;
        cursor: grab;
      }

      .kg-svg:active {
        cursor: grabbing;
      }

      /* Tooltip */
      .kg-tooltip {
        position: absolute;
        pointer-events: none;
        z-index: 20;
        padding: 0.75rem 1rem;
        border-radius: var(--bubbly-radius-md);
        background: var(--bubbly-surface);
        border: 1px solid var(--bubbly-border);
        box-shadow: 0 4px 12px rgba(7, 15, 24, 0.15);
        font-family: var(--bubbly-font-body);
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--bubbly-text);
        max-width: 220px;
        opacity: 0;
        transform: translateY(4px);
        transition: opacity 160ms ease, transform 160ms ease;
      }

      .kg-tooltip.visible {
        opacity: 1;
        transform: translateY(0);
      }

      .kg-tooltip-label {
        font-family: var(--bubbly-font-heading);
        font-weight: 700;
        color: var(--bubbly-primary-deep);
        margin-bottom: 0.25rem;
      }

      .kg-tooltip-mastery {
        display: flex;
        align-items: center;
        gap: 0.375rem;
        margin-top: 0.25rem;
      }

      .kg-tooltip-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      /* Legend */
      .kg-legend {
        position: absolute;
        bottom: 1rem;
        left: 1rem;
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        padding: 0.625rem 0.875rem;
        border-radius: var(--bubbly-radius-md);
        background: var(--bubbly-surface);
        border: 1px solid var(--bubbly-border);
        box-shadow: 0 2px 8px rgba(7, 15, 24, 0.1);
        font-size: 0.75rem;
        font-weight: 700;
        z-index: 10;
      }

      .kg-legend-item {
        display: flex;
        align-items: center;
        gap: 0.375rem;
      }

      .kg-legend-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
      }

      /* Detail panel */
      .kg-detail-panel {
        position: absolute;
        top: 1rem;
        right: 1rem;
        width: 260px;
        padding: 1.25rem;
        border-radius: var(--bubbly-radius-xl);
        background: var(--bubbly-surface);
        border: 1px solid var(--bubbly-border);
        box-shadow: 0 6px 0 0 var(--bubbly-shadow);
        z-index: 15;
        animation: kg-slide-in 200ms ease-out;
      }

      @keyframes kg-slide-in {
        from {
          opacity: 0;
          transform: translateX(12px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }

      .kg-detail-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.75rem;
      }

      .kg-detail-close {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: var(--bubbly-radius-sm);
        border: 1px solid var(--bubbly-border);
        background: var(--bubbly-surface-soft);
        color: var(--bubbly-muted);
        cursor: pointer;
        transition: background 160ms ease, color 160ms ease;
      }

      .kg-detail-close:hover {
        background: var(--bubbly-error-bg);
        color: var(--bubbly-error-text);
      }

      .kg-detail-bar {
        height: 6px;
        border-radius: 3px;
        background: var(--bubbly-surface-soft);
        overflow: hidden;
        margin-top: 0.375rem;
      }

      .kg-detail-bar-fill {
        height: 100%;
        border-radius: 3px;
        transition: width 300ms ease;
      }

      /* Loading state */
      .kg-loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        height: 100%;
        min-height: 400px;
      }

      .kg-spinner {
        width: 2.5rem;
        height: 2.5rem;
        border: 3px solid var(--bubbly-border);
        border-top-color: var(--bubbly-primary);
        border-radius: 50%;
        animation: kg-spin 800ms linear infinite;
      }

      @keyframes kg-spin {
        to {
          transform: rotate(360deg);
        }
      }

      /* Empty state */
      .kg-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        height: 100%;
        min-height: 400px;
        text-align: center;
        padding: 2rem;
      }

      .kg-empty-icon {
        width: 4rem;
        height: 4rem;
        border-radius: var(--bubbly-radius-lg);
        background: var(--bubbly-primary-15, rgba(0, 165, 224, 0.15));
        display: flex;
        align-items: center;
        justify-content: center;
      }

      /* Reduced motion */
      @media (prefers-reduced-motion: reduce) {
        .kg-tooltip,
        .kg-detail-panel,
        .kg-detail-bar-fill {
          transition: none;
        }

        .kg-spinner {
          animation: none;
          border-top-color: var(--bubbly-border);
        }

        @keyframes kg-slide-in {
          from {
            opacity: 1;
            transform: none;
          }
        }
      }
    `,
  ],
})
export class KnowledgeGraphComponent implements OnInit, OnDestroy {
  // ── Inputs ──
  /** Nodes representing concepts with mastery data. */
  nodes = input.required<KnowledgeNode[]>();

  /** Edges representing connections between concepts. */
  edges = input.required<KnowledgeEdge[]>();

  /** Whether data is currently loading. */
  isLoading = input<boolean>(false);

  /** Error message to display, if any. */
  errorMessage = input<string | null>(null);

  // ── Outputs ──
  /** Emitted when a node is clicked. */
  nodeClicked = output<NodeClickEvent>();

  // ── Internal state ──
  protected readonly selectedNode = signal<KnowledgeNode | null>(null);
  protected readonly tooltipVisible = signal(false);
  protected readonly tooltipX = signal(0);
  protected readonly tooltipY = signal(0);
  protected readonly tooltipNode = signal<KnowledgeNode | null>(null);

  protected readonly hasData = computed(
    () => this.nodes().length > 0 && !this.isLoading() && !this.errorMessage()
  );

  // ── Private ──
  private readonly platformId = inject(PLATFORM_ID);
  private readonly ngZone = inject(NgZone);
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  private svg: SVGSVGElement | null = null;
  private simulation: unknown = null; // d3.Simulation
  private resizeObserver: ResizeObserver | null = null;
  private destroy$ = false;
  private d3Module: typeof import('d3') | null = null;

  constructor() {
    // Re-render when inputs change
    effect(() => {
      const n = this.nodes();
      const e = this.edges();
      if (n.length > 0 && this.svg && this.d3Module) {
        this.renderGraph(n, e);
      }
    });
  }

  async ngOnInit(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    // Dynamic import D3 for code splitting
    try {
      this.d3Module = await import('d3');
    } catch {
      console.error('Failed to load D3.js');
      return;
    }

    this.svg = this.elementRef.nativeElement.querySelector('.kg-svg');
    if (!this.svg) return;

    // Observe container resize
    this.resizeObserver = new ResizeObserver(() => {
      if (this.nodes().length > 0 && this.svg && this.d3Module) {
        this.renderGraph(this.nodes(), this.edges());
      }
    });
    this.resizeObserver.observe(this.svg.parentElement!);

    // Initial render
    if (this.nodes().length > 0) {
      this.renderGraph(this.nodes(), this.edges());
    }
  }

  ngOnDestroy(): void {
    this.destroy$ = true;
    this.resizeObserver?.disconnect();
    if (this.simulation && typeof (this.simulation as { stop: () => void }).stop === 'function') {
      (this.simulation as { stop: () => void }).stop();
    }
  }

  /** Close the detail panel. */
  protected closeDetail(): void {
    this.selectedNode.set(null);
  }

  /** Get mastery level label. */
  protected masteryLabel(mastery: number): string {
    if (mastery >= 80) return 'Mastered';
    if (mastery >= 50) return 'Learning';
    return 'Needs Practice';
  }

  /** Get mastery color for inline styles. */
  protected getMasteryColor(mastery: number): string {
    return masteryColor(mastery);
  }

  /** Get mastery fill for inline styles. */
  protected getMasteryFill(mastery: number): string {
    return masteryFill(mastery);
  }

  // ── D3 Rendering ──

  private renderGraph(
    nodes: KnowledgeNode[],
    edges: KnowledgeEdge[]
  ): void {
    const d3 = this.d3Module;
    if (!d3 || !this.svg) return;

    const svg = d3.select(this.svg);
    const container = this.svg.parentElement!;
    const width = container.clientWidth;
    const height = container.clientHeight || 400;

    // Set viewBox for responsiveness
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    // Clear previous
    svg.selectAll('*').remove();

    // Check reduced motion preference
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Clone nodes for D3 mutation
    const d3Nodes: D3Node[] = nodes.map((n) => ({
      ...n,
      x: width / 2 + (Math.random() - 0.5) * 200,
      y: height / 2 + (Math.random() - 0.5) * 200,
    }));

    // Map edges to D3 format
    const nodeMap = new Map(d3Nodes.map((n) => [n.id, n]));
    const d3Edges: D3Edge[] = edges
      .filter((e) => nodeMap.has(e.source) && nodeMap.has(e.target))
      .map((e) => ({
        source: e.source,
        target: e.target,
        strength: e.strength ?? 0.5,
      }));

    // Create defs for glow filter
    const defs = svg.append('defs');

    // Glow filter for selected nodes
    const filter = defs
      .append('filter')
      .attr('id', 'kg-glow')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%');
    filter
      .append('feGaussianBlur')
      .attr('stdDeviation', '4')
      .attr('result', 'blur');
    filter
      .append('feMerge')
      .selectAll('feMergeNode')
      .data(['blur', 'SourceGraphic'])
      .join('feMergeNode')
      .attr('in', (d: string) => d);

    // Container group for zoom/pan
    const g = svg.append('g');

    // Zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        g.attr('transform', event.transform.toString());
      });

    svg.call(zoom);

    // Force simulation — closer nodes, stronger links
    const simulation = d3
      .forceSimulation<D3Node>(d3Nodes)
      .force(
        'link',
        d3
          .forceLink<D3Node, D3Edge>(d3Edges)
          .id((d: D3Node) => d.id)
          .distance(80)
          .strength((d: D3Edge) => (d.strength ?? 0.5) * 0.8)
      )
      .force('charge', d3.forceManyBody().strength(-150))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(55));

    this.simulation = simulation;

    // Draw edges
    const linkGroup = g
      .append('g')
      .attr('class', 'kg-links');

    const link = linkGroup
      .selectAll('line')
      .data(d3Edges)
      .join('line')
      .attr('stroke', '#eab308') // yellow-500
      .attr('stroke-opacity', 0.5)
      .attr('stroke-width', (d: D3Edge) => Math.max(1, (d.strength ?? 0.5) * 3));

    // Draw nodes
    const nodeGroup = g
      .append('g')
      .attr('class', 'kg-nodes');

    const dragBehavior = d3
      .drag<SVGGElement, D3Node>()
      .on('start', (event: d3.D3DragEvent<SVGGElement, D3Node, D3Node>) => {
        if (!event.active && !prefersReducedMotion) {
          simulation.alphaTarget(0.3).restart();
        }
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      })
      .on('drag', (event: d3.D3DragEvent<SVGGElement, D3Node, D3Node>) => {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      })
      .on('end', (event: d3.D3DragEvent<SVGGElement, D3Node, D3Node>) => {
        if (!event.active) {
          simulation.alphaTarget(0);
        }
        event.subject.fx = null;
        event.subject.fy = null;
      });

    const node = nodeGroup
      .selectAll('g')
      .data(d3Nodes)
      .join('g')
      .attr('cursor', 'pointer')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .call(dragBehavior as any);

    // Node circle (outer border)
    node
      .append('circle')
      .attr('r', 32)
      .attr('fill', (d: D3Node) => masteryFill(d.mastery))
      .attr('stroke', (d: D3Node) => masteryColor(d.mastery))
      .attr('stroke-width', 3);

    // Node inner glow circle
    node
      .append('circle')
      .attr('r', 22)
      .attr('fill', (d: D3Node) => masteryColor(d.mastery))
      .attr('opacity', 0.2);

    // Mastery percentage text
    node
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-family', 'var(--bubbly-font-heading)')
      .attr('font-weight', '700')
      .attr('font-size', '13px')
      .attr('fill', (d: D3Node) => masteryColor(d.mastery))
      .text((d: D3Node) => `${d.mastery}%`);

    // Label below node
    node
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '46px')
      .attr('font-family', 'var(--bubbly-font-body)')
      .attr('font-weight', '600')
      .attr('font-size', '12px')
      .attr('fill', 'var(--bubbly-text)')
      .text((d: D3Node) =>
        d.label.length > 16 ? d.label.slice(0, 14) + '...' : d.label
      );

    // Hover interactions
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    node
      .on('mouseenter', function (event: MouseEvent, d: D3Node) {
        if (self.destroy$) return;

        // Highlight node
        d3.select(this).select('circle:first-child').attr('stroke-width', 5);

        // Show tooltip
        const rect = self.svg!.getBoundingClientRect();
        self.ngZone.run(() => {
          self.tooltipNode.set(d);
          self.tooltipX.set(event.clientX - rect.left + 12);
          self.tooltipY.set(event.clientY - rect.top - 12);
          self.tooltipVisible.set(true);
        });
      })
      .on('mousemove', function (event: MouseEvent) {
        if (self.destroy$) return;
        const rect = self.svg!.getBoundingClientRect();
        self.ngZone.run(() => {
          self.tooltipX.set(event.clientX - rect.left + 12);
          self.tooltipY.set(event.clientY - rect.top - 12);
        });
      })
      .on('mouseleave', function () {
        if (self.destroy$) return;

        d3.select(this).select('circle:first-child').attr('stroke-width', 3);

        self.ngZone.run(() => {
          self.tooltipVisible.set(false);
          self.tooltipNode.set(null);
        });
      })
      .on('click', function (event: MouseEvent, d: D3Node) {
        if (self.destroy$) return;
        event.stopPropagation();

        // Update selected state visually
        node.select('circle:first-child').attr('filter', null);
        d3.select(this).select('circle:first-child').attr('filter', 'url(#kg-glow)');

        self.ngZone.run(() => {
          self.selectedNode.set(d);
          self.nodeClicked.emit({
            node: d,
            x: event.clientX,
            y: event.clientY,
          });
        });
      });

    // Click background to deselect
    svg.on('click', () => {
      node.select('circle:first-child').attr('filter', null);
      this.ngZone.run(() => {
        this.selectedNode.set(null);
      });
    });

    // Tick handler
    simulation.on('tick', () => {
      link
        .attr('x1', (d: D3Edge) => (d.source as D3Node).x!)
        .attr('y1', (d: D3Edge) => (d.source as D3Node).y!)
        .attr('x2', (d: D3Edge) => (d.target as D3Node).x!)
        .attr('y2', (d: D3Edge) => (d.target as D3Node).y!);

      node.attr('transform', (d: D3Node) => `translate(${d.x},${d.y})`);
    });

    // Auto-fit: zoom to show all nodes when simulation settles
    simulation.on('end', () => {
      this.fitGraphToView(d3Nodes, svg, g, zoom, width, height);
    });

    // Stop simulation early if reduced motion
    if (prefersReducedMotion) {
      simulation.alpha(0).stop();
      // Manually position nodes in a circle
      const radius = Math.min(width, height) * 0.3;
      d3Nodes.forEach((n, i) => {
        const angle = (2 * Math.PI * i) / d3Nodes.length;
        n.x = width / 2 + radius * Math.cos(angle);
        n.y = height / 2 + radius * Math.sin(angle);
      });

      link
        .attr('x1', (d: D3Edge) => (d.source as D3Node).x!)
        .attr('y1', (d: D3Edge) => (d.source as D3Node).y!)
        .attr('x2', (d: D3Edge) => (d.target as D3Node).x!)
        .attr('y2', (d: D3Edge) => (d.target as D3Node).y!);

      node.attr('transform', (d: D3Node) => `translate(${d.x},${d.y})`);

      // Fit to view after manual positioning
      this.fitGraphToView(d3Nodes, svg, g, zoom, width, height);
    }
  }

  /** Zooms/pans the SVG to fit all nodes within the viewport. */
  private fitGraphToView(
    d3Nodes: D3Node[],
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    zoom: d3.ZoomBehavior<SVGSVGElement, unknown>,
    width: number,
    height: number
  ): void {
    if (d3Nodes.length === 0) return;

    const d3 = this.d3Module;
    if (!d3) return;

    // Calculate bounding box of all nodes
    const padding = 60; // px padding around nodes
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    for (const n of d3Nodes) {
      if (n.x !== undefined && n.y !== undefined) {
        minX = Math.min(minX, n.x);
        maxX = Math.max(maxX, n.x);
        minY = Math.min(minY, n.y);
        maxY = Math.max(maxY, n.y);
      }
    }

    if (minX === Infinity) return;

    // Add padding
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    const graphWidth = maxX - minX;
    const graphHeight = maxY - minY;

    // Calculate scale to fit
    const scale = Math.min(
      width / graphWidth,
      height / graphHeight,
      1.5 // max zoom
    );

    // Calculate center offset
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // Apply transform
    const transform = d3.zoomIdentity
      .translate(width / 2, height / 2)
      .scale(scale)
      .translate(-centerX, -centerY);

    svg.transition().duration(500).call(zoom.transform, transform);
  }
}
