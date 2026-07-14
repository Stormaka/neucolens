import { useEffect, useRef, useState, useCallback } from 'react'
import * as d3 from 'd3'

interface GraphNode {
  id: string
  name: string
  type: string
  complexity: string
  summary: string
  filePath?: string
  tags: string[]
  languageNotes?: string
}

interface GraphEdge {
  source: string
  target: string
  type: string
  direction: string
  weight: number
}

interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
  layers: any[]
  tour: any[]
  project: any
}

interface Props {
  data: GraphData
  onNodeSelect: (node: GraphNode | null) => void
  selectedNodeId?: string
}

const NODE_COLORS: Record<string, string> = {
  file: '#60a5fa',
  function: '#a78bfa',
  class: '#34d399',
  service: '#fb923c',
  config: '#94a3b8',
  table: '#f472b6',
  endpoint: '#fbbf24',
  module: '#22d3ee',
  concept: '#e879f9',
  schema: '#84cc16',
  resource: '#f97316',
  document: '#d1fae5',
}

const NODE_SIZES: Record<string, number> = {
  file: 10,
  function: 6,
  class: 12,
  service: 14,
  config: 7,
  table: 11,
  endpoint: 9,
  module: 13,
  concept: 8,
  schema: 8,
  resource: 9,
  document: 7,
}

export default function KnowledgeGraph({ data, onNodeSelect, selectedNodeId }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [search, setSearch] = useState('')
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set())
  const simulationRef = useRef<d3.Simulation<any, any> | null>(null)

  const initGraph = useCallback(() => {
    if (!svgRef.current || !containerRef.current) return

    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    // Clear previous
    d3.select(svgRef.current).selectAll('*').remove()

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)

    // Defs: arrow marker
    const defs = svg.append('defs')
    defs.append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -4 8 8')
      .attr('refX', 18).attr('refY', 0)
      .attr('markerWidth', 6).attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-4L8,0L0,4')
      .attr('fill', 'rgba(255,255,255,0.2)')

    // Background
    svg.append('rect')
      .attr('width', width).attr('height', height)
      .attr('fill', 'transparent')
      .on('click', () => onNodeSelect(null))

    // Zoom
    const g = svg.append('g').attr('class', 'main-group')
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => g.attr('transform', event.transform.toString()))

    svg.call(zoom)

    // Initial zoom to fit
    const initTransform = d3.zoomIdentity.translate(width / 2, height / 2).scale(0.8)
    svg.call(zoom.transform, initTransform)

    // Process nodes/edges for D3
    const nodes = data.nodes.map(n => ({ ...n, x: 0, y: 0, vx: 0, vy: 0, fx: null, fy: null }))
    const nodeMap = new Map(nodes.map(n => [n.id, n]))

    const links = data.edges
      .filter(e => nodeMap.has(e.source) && nodeMap.has(e.target))
      .map(e => ({
        ...e,
        source: nodeMap.get(e.source)!,
        target: nodeMap.get(e.target)!,
      }))

    // Force simulation
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links)
        .id((d: any) => d.id)
        .distance((d: any) => 80 + (1 - (d.weight || 0.5)) * 60)
        .strength(0.4)
      )
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(0, 0))
      .force('collision', d3.forceCollide().radius((d: any) => (NODE_SIZES[d.type] || 8) + 12))

    simulationRef.current = simulation

    // Draw edges
    const link = g.append('g').attr('class', 'links').selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', 'rgba(255,255,255,0.12)')
      .attr('stroke-width', (d: any) => Math.max(1, (d.weight || 0.5) * 2))
      .attr('marker-end', 'url(#arrow)')

    // Draw node groups
    const node = g.append('g').attr('class', 'nodes').selectAll('g')
      .data(nodes)
      .join('g')
      .attr('class', 'node-group')
      .style('cursor', 'pointer')
      .call(d3.drag<any, any>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart()
          d.fx = d.x; d.fy = d.y
        })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0)
          d.fx = null; d.fy = null
        })
      )
      .on('click', (event, d: any) => {
        event.stopPropagation()
        onNodeSelect(d)
      })

    // Glow circle
    node.append('circle')
      .attr('r', (d: any) => (NODE_SIZES[d.type] || 8) + 8)
      .attr('fill', (d: any) => NODE_COLORS[d.type] || '#94a3b8')
      .attr('opacity', 0.12)

    // Main circle
    node.append('circle')
      .attr('class', 'node-main')
      .attr('r', (d: any) => NODE_SIZES[d.type] || 8)
      .attr('fill', (d: any) => NODE_COLORS[d.type] || '#94a3b8')
      .attr('stroke', 'rgba(255,255,255,0.2)')
      .attr('stroke-width', 1.5)

    // Label
    node.append('text')
      .text((d: any) => d.name.length > 16 ? d.name.slice(0, 14) + '…' : d.name)
      .attr('dy', (d: any) => (NODE_SIZES[d.type] || 8) + 14)
      .attr('text-anchor', 'middle')
      .attr('fill', 'rgba(255,255,255,0.6)')
      .attr('font-size', '9px')
      .attr('font-family', 'Inter, sans-serif')

    // Tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y)

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`)
    })

    return () => simulation.stop()
  }, [data, onNodeSelect])

  // Highlight selected node + search results
  useEffect(() => {
    if (!svgRef.current) return
    const svg = d3.select(svgRef.current)

    // Main circle: stroke for selected, opacity for search
    svg.selectAll<Element, any>('.node-main')
      .attr('stroke', (d: any) => d.id === selectedNodeId ? '#fff' : 'rgba(255,255,255,0.2)')
      .attr('stroke-width', (d: any) => d.id === selectedNodeId ? 3 : 1.5)
      .attr('opacity', (d: any) => {
        if (highlightedIds.size === 0) return 1
        return highlightedIds.has(d.id) ? 1 : 0.15
      })

    // Label opacity
    svg.selectAll<Element, any>('.node-group text')
      .attr('opacity', (d: any) => {
        if (highlightedIds.size === 0) return 1
        return highlightedIds.has(d.id) ? 1 : 0.15
      })

    // Edge opacity
    svg.selectAll<Element, any>('.links line')
      .attr('opacity', (d: any) => {
        if (highlightedIds.size === 0) return 1
        const srcId = typeof d.source === 'object' ? d.source.id : d.source
        const tgtId = typeof d.target === 'object' ? d.target.id : d.target
        return (highlightedIds.has(srcId) || highlightedIds.has(tgtId)) ? 1 : 0.05
      })
  }, [selectedNodeId, highlightedIds])

  // Search highlight
  useEffect(() => {
    if (!search.trim()) {
      setHighlightedIds(new Set())
      return
    }
    const q = search.toLowerCase()
    const matched = new Set(
      data.nodes
        .filter(n => n.name.toLowerCase().includes(q) || n.summary?.toLowerCase().includes(q) || n.tags?.some(t => t.toLowerCase().includes(q)))
        .map(n => n.id)
    )
    setHighlightedIds(matched)
  }, [search, data.nodes])

  useEffect(() => {
    const cleanup = initGraph()
    const observer = new ResizeObserver(() => initGraph())
    if (containerRef.current) observer.observe(containerRef.current)
    return () => {
      cleanup?.()
      observer.disconnect()
      simulationRef.current?.stop()
    }
  }, [initGraph])

  const typeGroups = Object.entries(
    data.nodes.reduce((acc, n) => {
      acc[n.type] = (acc[n.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      {/* Search bar */}
      <div style={{
        position: 'absolute', top: '16px', left: '16px', zIndex: 10,
        display: 'flex', gap: '8px', alignItems: 'center',
      }}>
        <div style={{ position: 'relative' }}>
          <input
            className="input"
            style={{
              width: '240px',
              padding: '8px 36px 8px 14px',
              fontSize: '0.85rem',
              background: 'rgba(17,19,24,0.9)',
              backdropFilter: 'blur(10px)',
            }}
            placeholder="🔍 Tìm kiếm node..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{
                position: 'absolute', right: '8px', top: '50%',
                transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', fontSize: '14px',
                lineHeight: 1, padding: '2px 4px',
                borderRadius: '4px',
              }}
              title="Xóa tìm kiếm"
            >×</button>
          )}
        </div>
        {search && (
          <span style={{
            fontSize: '0.78rem', color: highlightedIds.size > 0 ? '#34d399' : '#f87171',
            background: 'var(--bg-surface)', padding: '4px 8px',
            borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)',
            whiteSpace: 'nowrap',
          }}>
            {highlightedIds.size > 0 ? `${highlightedIds.size} kết quả` : 'Không tìm thấy'}
          </span>
        )}
      </div>

      {/* Legend */}
      <div style={{
        position: 'absolute', top: '16px', right: '16px', zIndex: 10,
        background: 'rgba(17,19,24,0.92)',
        backdropFilter: 'blur(12px)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '12px',
        display: 'flex', flexDirection: 'column', gap: '5px',
        maxHeight: '280px',
        overflowY: 'auto',
      }}>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Loại Node
        </div>
        {typeGroups.map(([type, count]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem' }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: NODE_COLORS[type] || '#94a3b8',
              boxShadow: `0 0 6px ${NODE_COLORS[type] || '#94a3b8'}80`,
            }} />
            <span style={{ color: 'var(--text-secondary)', minWidth: '60px' }}>{type}</span>
            <span style={{ color: 'var(--text-muted)' }}>({count})</span>
          </div>
        ))}
      </div>

      {/* SVG */}
      <div ref={containerRef} style={{ flex: 1, width: '100%', minHeight: 0 }}>
        <svg ref={svgRef} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  )
}
