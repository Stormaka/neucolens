// @ts-nocheck
/**
 * CodeGraph v3 — D3 force-directed knowledge graph
 * Dark-space aesthetic matching the NEU CodeLens KnowledgeGraph style
 * Parser is in codeParser.ts (kept separate for Vite Fast Refresh)
 */
import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import * as d3 from 'd3'
import { parseCodeToGraph } from './codeParser'

// ── Visual config ─────────────────────────────────────────────────────────────
const NODE_COLORS: Record<string, string> = {
  function:  '#4f9cf9',
  class:     '#a78bfa',
  variable:  '#34d399',
  structure: '#fbbf24',
  concept:   '#e74c3c',
  import:    '#64748b',
}
const NODE_GLOW: Record<string, string> = {
  function:  'rgba(79,156,249,0.4)',
  class:     'rgba(167,139,250,0.4)',
  variable:  'rgba(52,211,153,0.4)',
  structure: 'rgba(251,191,36,0.4)',
  concept:   'rgba(231,76,60,0.4)',
  import:    'rgba(100,116,139,0.25)',
}
const NODE_SIZES: Record<string, number> = {
  function: 24, class: 28, variable: 18, structure: 21, concept: 26, import: 14,
}
const NODE_ICON: Record<string, string> = {
  function: 'f', class: 'C', variable: 'v', structure: '⟳', concept: '★', import: '↗',
}
const TYPE_LABEL: Record<string, string> = {
  function: 'Hàm', class: 'Class', variable: 'Biến',
  structure: 'Cấu trúc', concept: 'Khái niệm', import: 'Import',
}
const ALL_TYPES = ['function', 'class', 'variable', 'structure', 'concept', 'import']

// ── Component ─────────────────────────────────────────────────────────────────
interface Props {
  code: string
  lang?: string
  concepts?: string[]
  height?: number
  title?: string
  studentName?: string
}

export default function CodeGraph({ code, lang = 'C++', concepts = [], height = 440, title, studentName }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const simRef = useRef<d3.Simulation<any, any> | null>(null)
  const [selected, setSelected] = useState<any>(null)
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set(ALL_TYPES))
  const [stats, setStats] = useState<Record<string, number>>({})
  const [nodeCount, setNodeCount] = useState(0)
  const [edgeCount, setEdgeCount] = useState(0)

  const graphData = useMemo(() =>
    parseCodeToGraph(code || '', lang, concepts),
    [code, lang, JSON.stringify(concepts)]
  )

  const buildGraph = useCallback(() => {
    if (!svgRef.current || !containerRef.current) return
    simRef.current?.stop()

    const W = containerRef.current.clientWidth || 640
    const H = height

    const visNodes = graphData.nodes.filter(n => typeFilter.has(n.type))
    const visNodeIds = new Set(visNodes.map(n => n.id))
    const visEdges = graphData.edges.filter(e => {
      const s = typeof e.source === 'object' ? e.source.id : e.source
      const t = typeof e.target === 'object' ? e.target.id : e.target
      return visNodeIds.has(s) && visNodeIds.has(t)
    })

    const st: Record<string, number> = {}
    graphData.nodes.forEach(n => { st[n.type] = (st[n.type] || 0) + 1 })
    setStats(st)
    setNodeCount(visNodes.length)
    setEdgeCount(visEdges.length)

    // ── D3 SVG ───────────────────────────────────────────────────────────────
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    svg.attr('width', W).attr('height', H)

    const defs = svg.append('defs')

    // Arrow marker
    defs.append('marker')
      .attr('id', 'cg-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 34).attr('refY', 0)
      .attr('markerWidth', 5).attr('markerHeight', 5)
      .attr('orient', 'auto')
      .append('path').attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', 'rgba(255,255,255,0.2)')

    // Glow filters
    Object.entries(NODE_COLORS).forEach(([type, color]) => {
      const f = defs.append('filter')
        .attr('id', `glow-cg-${type}`)
        .attr('x', '-60%').attr('y', '-60%')
        .attr('width', '220%').attr('height', '220%')
      f.append('feGaussianBlur').attr('stdDeviation', '4.5').attr('result', 'blur')
      const m = f.append('feMerge')
      m.append('feMergeNode').attr('in', 'blur')
      m.append('feMergeNode').attr('in', 'SourceGraphic')
    })

    // Star background pattern
    const pat = defs.append('pattern')
      .attr('id', 'cg-stars').attr('x', 0).attr('y', 0)
      .attr('width', 150).attr('height', 150)
      .attr('patternUnits', 'userSpaceOnUse')
    for (let i = 0; i < 30; i++) {
      pat.append('circle')
        .attr('cx', Math.random() * 150).attr('cy', Math.random() * 150)
        .attr('r', Math.random() * 1 + 0.3)
        .attr('fill', `rgba(255,255,255,${(Math.random() * 0.4 + 0.05).toFixed(2)})`)
    }

    // ── Background ──
    svg.append('rect').attr('width', W).attr('height', H).attr('fill', '#07090c')
    svg.append('rect').attr('width', W).attr('height', H).attr('fill', 'url(#cg-stars)')
      .on('click', () => setSelected(null))

    // ── Zoomable group ──
    const g = svg.append('g')
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.12, 6])
      .on('zoom', ev => g.attr('transform', ev.transform.toString()))
    svg.call(zoom as any)
    svg.call((zoom as any).transform, d3.zoomIdentity.translate(W / 2, H / 2).scale(0.82))

    // ── Nodes/Links for sim ──
    const nodes: any[] = visNodes.map(n => ({ ...n }))
    const nodeMap = new Map(nodes.map(n => [n.id, n]))
    const links = visEdges.map(e => ({
      ...e,
      source: nodeMap.get(typeof e.source === 'object' ? e.source.id : e.source),
      target: nodeMap.get(typeof e.target === 'object' ? e.target.id : e.target),
    })).filter(e => e.source && e.target)

    if (!nodes.length) return

    // ── Force simulation ──
    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(115).strength(0.42))
      .force('charge', d3.forceManyBody().strength((d: any) => -(NODE_SIZES[d.type] || 20) * 20))
      .force('center', d3.forceCenter(0, 0))
      .force('collide', d3.forceCollide().radius((d: any) => (NODE_SIZES[d.type] || 20) + 20))
    simRef.current = sim

    // ── Edges ──
    const edgeEl = g.append('g').selectAll('line').data(links).join('line')
      .attr('stroke', 'rgba(255,255,255,0.1)')
      .attr('stroke-width', 1.3)
      .attr('marker-end', 'url(#cg-arrow)')

    // ── Node groups ──
    const nodeEl = g.append('g').selectAll<SVGGElement, any>('g').data(nodes).join('g')
      .style('cursor', 'pointer')
      .on('click', (ev: any, d: any) => { ev.stopPropagation(); setSelected(s => s?.id === d.id ? null : d) })
      .call(d3.drag<any, any>()
        .on('start', (ev, d) => { if (!ev.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y })
        .on('drag', (ev, d) => { d.fx = ev.x; d.fy = ev.y })
        .on('end', (ev, d) => { if (!ev.active) sim.alphaTarget(0); d.fx = null; d.fy = null })
      )

    // Outer glow halo
    nodeEl.append('circle')
      .attr('r', (d: any) => (NODE_SIZES[d.type] || 20) + 11)
      .attr('fill', (d: any) => NODE_GLOW[d.type] || 'rgba(100,100,100,0.12)')
      .attr('opacity', 0.55)
      .style('pointer-events', 'none')

    // Main circle (filled, border matches type color)
    nodeEl.append('circle')
      .attr('class', 'cg-circle')
      .attr('r', (d: any) => NODE_SIZES[d.type] || 20)
      .attr('fill', (d: any) => NODE_COLORS[d.type] || '#94a3b8')
      .attr('fill-opacity', 0.16)
      .attr('stroke', (d: any) => NODE_COLORS[d.type] || '#94a3b8')
      .attr('stroke-width', 2.4)
      .style('filter', (d: any) => `url(#glow-cg-${d.type})`)
      .style('transition', 'fill-opacity .18s, stroke-width .18s')

    // Icon inside
    nodeEl.append('text')
      .text((d: any) => NODE_ICON[d.type] || '?')
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
      .attr('font-size', (d: any) => `${(NODE_SIZES[d.type] || 20) * 0.62}px`)
      .attr('font-weight', '900')
      .attr('fill', (d: any) => NODE_COLORS[d.type] || '#fff')
      .style('pointer-events', 'none')

    // Label below node
    nodeEl.append('text')
      .text((d: any) => d.label.length > 15 ? d.label.slice(0, 14) + '…' : d.label)
      .attr('text-anchor', 'middle')
      .attr('dy', (d: any) => (NODE_SIZES[d.type] || 20) + 15)
      .attr('font-size', '9.5px')
      .attr('fill', 'rgba(255,255,255,0.58)')
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .style('pointer-events', 'none')

    // Line number sub-label
    nodeEl.filter((d: any) => !!d.line).append('text')
      .text((d: any) => `L${d.line}`)
      .attr('text-anchor', 'middle')
      .attr('dy', (d: any) => (NODE_SIZES[d.type] || 20) + 27)
      .attr('font-size', '7.5px')
      .attr('fill', 'rgba(255,255,255,0.22)')
      .style('pointer-events', 'none')

    // ── Tick ──
    sim.on('tick', () => {
      edgeEl
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y)
      nodeEl.attr('transform', (d: any) => `translate(${d.x},${d.y})`)
    })

    sim.alpha(1).restart()
    // Cool down after 3.5s
    const cooling = setTimeout(() => sim.alphaTarget(0), 3500)
    return () => { clearTimeout(cooling); sim.stop() }
  }, [graphData, typeFilter, height])

  useEffect(() => {
    const cleanup = buildGraph()
    const ro = new ResizeObserver(() => buildGraph())
    if (containerRef.current) ro.observe(containerRef.current)
    return () => { cleanup?.(); ro.disconnect(); simRef.current?.stop() }
  }, [buildGraph])

  // Highlight selected node reactively
  useEffect(() => {
    if (!svgRef.current) return
    d3.select(svgRef.current).selectAll('.cg-circle')
      .attr('fill-opacity', (d: any) => d.id === selected?.id ? 0.42 : 0.16)
      .attr('stroke-width', (d: any) => d.id === selected?.id ? 4 : 2.4)
  }, [selected])

  const toggleType = (t: string) =>
    setTypeFilter(prev => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t); else next.add(t)
      return next
    })

  if (!code?.trim()) return (
    <div style={{ height, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#07090c', borderRadius: 14, border: '1px dashed rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.2)', gap: 10 }}>
      <div style={{ fontSize: '2.8rem' }}>🔬</div>
      <div style={{ fontSize: '.83rem' }}>Nhập code để xem Knowledge Graph</div>
    </div>
  )

  return (
    <div style={{ background: '#07090c', borderRadius: 14, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden', userSelect: 'none' }}>
      {/* ── Header bar ── */}
      <div style={{ padding: '9px 14px', background: 'rgba(255,255,255,0.025)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ fontSize: '.88rem', fontWeight: 700, color: '#fff' }}>
            🔬 {title || 'Code Knowledge Graph'}
          </span>
          {studentName && (
            <span style={{ fontSize: '.68rem', background: 'rgba(79,156,249,0.16)', color: '#4f9cf9', border: '1px solid rgba(79,156,249,0.28)', borderRadius: 99, padding: '1px 9px' }}>
              👤 {studentName}
            </span>
          )}
          <span style={{ fontSize: '.64rem', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.32)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 99, padding: '1px 8px' }}>{lang}</span>
          <span style={{ fontSize: '.64rem', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.32)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 99, padding: '1px 8px' }}>{nodeCount} nodes · {edgeCount} edges</span>
        </div>
        {/* Type filter pills */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {ALL_TYPES.map(t => (
            <button key={t} onClick={() => toggleType(t)} style={{
              padding: '2px 9px', fontSize: '.64rem', fontWeight: 700, borderRadius: 99, cursor: 'pointer', transition: 'all .15s', display: 'flex', alignItems: 'center', gap: 3,
              border: `1.5px solid ${NODE_COLORS[t]}55`,
              background: typeFilter.has(t) ? `${NODE_COLORS[t]}22` : 'transparent',
              color: typeFilter.has(t) ? NODE_COLORS[t] : 'rgba(255,255,255,0.2)',
            }}>
              <span style={{ fontSize: '.72rem' }}>{NODE_ICON[t]}</span>{stats[t] || 0}
            </button>
          ))}
          <button onClick={() => setTypeFilter(new Set(ALL_TYPES))} style={{
            padding: '2px 8px', fontSize: '.62rem', borderRadius: 99, cursor: 'pointer',
            border: '1.5px solid rgba(255,255,255,0.12)', background: 'transparent', color: 'rgba(255,255,255,0.3)',
          }}>↺ Reset</button>
        </div>
      </div>

      {/* ── Canvas + Side panel ── */}
      <div style={{ display: 'flex' }}>
        {/* SVG canvas */}
        <div ref={containerRef} style={{ flex: 1, position: 'relative', minWidth: 0 }}>
          <svg ref={svgRef} style={{ width: '100%', height, display: 'block' }} />
          <div style={{ position: 'absolute', bottom: 10, left: 14, fontSize: '8.5px', color: 'rgba(255,255,255,0.16)', pointerEvents: 'none' }}>
            {Math.round((nodeCount / Math.max(graphData.nodes.length, 1)) * 100)}% visible · Scroll=zoom · Kéo=pan
          </div>
        </div>

        {/* Info panel */}
        <div style={{ width: 192, flexShrink: 0, background: 'rgba(255,255,255,0.018)', borderLeft: '1px solid rgba(255,255,255,0.05)', padding: '14px 12px', overflowY: 'auto', maxHeight: height }}>
          {selected ? (
            <>
              <div style={{ fontSize: '.64rem', fontWeight: 700, color: 'rgba(255,255,255,0.28)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.07em' }}>Chi tiết Node</div>
              <div style={{ background: `${NODE_COLORS[selected.type] || '#fff'}10`, border: `1px solid ${NODE_COLORS[selected.type] || '#fff'}28`, borderRadius: 10, padding: 10, marginBottom: 10 }}>
                <div style={{ fontSize: '1.3rem', fontWeight: 900, color: NODE_COLORS[selected.type], marginBottom: 2 }}>{NODE_ICON[selected.type]}</div>
                <div style={{ fontSize: '.82rem', fontWeight: 700, color: '#fff', marginBottom: 4, wordBreak: 'break-all' }}>{selected.label}</div>
                <span style={{ fontSize: '.62rem', background: `${NODE_COLORS[selected.type] || '#fff'}1a`, color: NODE_COLORS[selected.type], borderRadius: 99, padding: '1px 7px' }}>
                  {TYPE_LABEL[selected.type] || selected.type}
                </span>
                {selected.line && <div style={{ fontSize: '.68rem', color: 'rgba(255,255,255,0.38)', marginTop: 6 }}>📍 Dòng {selected.line}</div>}
                {selected.detail && (
                  <div style={{ fontSize: '.64rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', background: 'rgba(0,0,0,0.35)', padding: '5px 7px', borderRadius: 6, marginTop: 8, lineHeight: 1.65, wordBreak: 'break-all' }}>
                    {selected.detail.slice(0, 90)}
                  </div>
                )}
              </div>
              <button onClick={() => setSelected(null)} style={{ width: '100%', padding: '5px', fontSize: '.68rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7, color: 'rgba(255,255,255,0.45)', cursor: 'pointer' }}>✕ Đóng</button>
            </>
          ) : (
            <>
              {/* Stats */}
              <div style={{ fontSize: '.64rem', fontWeight: 700, color: 'rgba(255,255,255,0.28)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.07em' }}>📊 Thống kê</div>
              {ALL_TYPES.map(t => stats[t] ? (
                <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                  <div style={{ width: 9, height: 9, borderRadius: '50%', background: NODE_COLORS[t], boxShadow: `0 0 6px ${NODE_COLORS[t]}90`, flexShrink: 0 }} />
                  <span style={{ fontSize: '.72rem', color: 'rgba(255,255,255,0.48)', flex: 1 }}>{TYPE_LABEL[t]}</span>
                  <span style={{ fontSize: '.78rem', fontWeight: 700, color: NODE_COLORS[t] }}>{stats[t]}</span>
                </div>
              ) : null)}

              {/* Concepts */}
              {concepts.length > 0 && (
                <>
                  <div style={{ margin: '12px 0 8px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 10, fontSize: '.64rem', fontWeight: 700, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '.07em' }}>Khái niệm BT</div>
                  {concepts.map(c => (
                    <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, fontSize: '.72rem' }}>
                      <span style={{ color: '#e74c3c', fontSize: '.78rem' }}>★</span>
                      <span style={{ color: 'rgba(255,255,255,0.52)' }}>{c}</span>
                    </div>
                  ))}
                </>
              )}

              {/* Guide */}
              <div style={{ margin: '12px 0 8px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 10, fontSize: '.64rem', fontWeight: 700, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '.07em' }}>Hướng dẫn</div>
              {[['👆 Click node', 'Xem chi tiết'], ['✋ Kéo node', 'Di chuyển'], ['🖱️ Kéo nền', 'Pan view'], ['⚙️ Scroll', 'Zoom in/out']].map(([a, b]) => (
                <div key={a} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: '.62rem', color: 'rgba(255,255,255,0.22)' }}>{a}</span>
                  <span style={{ fontSize: '.62rem', color: 'rgba(255,255,255,0.42)' }}>{b}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
