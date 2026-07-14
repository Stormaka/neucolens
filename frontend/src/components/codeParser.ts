/**
 * codeParser.ts — Multi-language code-to-graph parser
 * Tách riêng để tránh Vite Fast Refresh incompatibility
 */

export interface CNode {
  id: string
  label: string
  type: string
  detail?: string
  line?: number
  x?: number
  y?: number
  vx?: number
  vy?: number
  fx?: number | null
  fy?: number | null
}
export interface CEdge { source: any; target: any; label?: string }
export interface GraphData { nodes: CNode[]; edges: CEdge[] }

export function parseCodeToGraph(code: string, lang: string, concepts: string[] = []): GraphData {
  if (!code?.trim()) return { nodes: [], edges: [] }

  const rawNodes: CNode[] = []
  const rawEdges: CEdge[] = []
  const lines = code.split('\n')
  const ids = new Set<string>()

  const addNode = (n: CNode): CNode | null => {
    if (ids.has(n.id)) return null
    ids.add(n.id)
    rawNodes.push(n)
    return n
  }
  const addEdge = (s: string, t: string, label?: string) => {
    if (s === t) return
    const exists = rawEdges.some(e => {
      const es = typeof e.source === 'string' ? e.source : e.source?.id
      const et = typeof e.target === 'string' ? e.target : e.target?.id
      return es === s && et === t
    })
    if (!exists) rawEdges.push({ source: s, target: t, label })
  }

  // Concept tag nodes (always shown)
  concepts.forEach(c => addNode({
    id: `concept_${c}`, label: c, type: 'concept', detail: 'Khái niệm bài tập'
  }))

  const fnIds: string[] = []

  if (lang === 'C++' || lang === 'C') {
    lines.forEach((line, i) => {
      // Functions
      const fnM = line.match(/^(\w[\w\s*:<>]+?)\s+(\w+)\s*\([^)]*\)\s*(?:const\s*)?\{?\s*$/)
      const kw = ['if','for','while','switch','else','do','return','class','struct','namespace','include','define','typedef']
      if (fnM && !kw.includes(fnM[2]) && !line.trim().startsWith('//') && !line.trim().startsWith('*')) {
        const name = fnM[2]
        addNode({ id: `fn_${name}`, label: name, type: 'function', detail: line.trim(), line: i + 1 })
        fnIds.push(name)
      }
      // Classes / Structs
      const clsM = line.match(/^\s*(class|struct)\s+(\w+)/)
      if (clsM) addNode({ id: `cls_${clsM[2]}`, label: clsM[2], type: 'class', detail: line.trim(), line: i + 1 })
      // Includes
      const incM = line.match(/#include\s*[<"]([\w./]+)[>"]/)
      if (incM) addNode({ id: `inc_${incM[1]}`, label: `<${incM[1]}>`, type: 'import', detail: line.trim(), line: i + 1 })
      // Variables (inside functions only - indent > 0)
      const varM = line.match(/^\s{1,}(int|double|float|long|bool|string|char|auto)\s+([a-zA-Z_]\w*)\s*[=;,\[({]/)
      if (varM && !['i','j','k','t','n','m','x','y','c'].includes(varM[2]))
        addNode({ id: `var_${varM[2]}_${i}`, label: varM[2], type: 'variable', detail: `${varM[1]} ${varM[2]}`, line: i + 1 })
      // Loops
      if (/^\s*(for|while)\s*\(/.test(line))
        addNode({ id: `loop_${i}`, label: line.includes('for') ? `for loop (L${i+1})` : `while (L${i+1})`, type: 'structure', detail: line.trim(), line: i + 1 })
      // If
      if (/^\s*if\s*\(/.test(line) && !/else\s*if/.test(lines[i-1]||''))
        addNode({ id: `if_${i}`, label: `if (L${i+1})`, type: 'structure', detail: line.trim(), line: i + 1 })
    })
  } else if (lang === 'Python') {
    lines.forEach((line, i) => {
      const fnM = line.match(/^def\s+(\w+)\s*\(/)
      if (fnM) { addNode({ id: `fn_${fnM[1]}`, label: fnM[1], type: 'function', detail: line.trim(), line: i + 1 }); fnIds.push(fnM[1]) }
      const clsM = line.match(/^class\s+(\w+)/)
      if (clsM) addNode({ id: `cls_${clsM[1]}`, label: clsM[1], type: 'class', detail: line.trim(), line: i + 1 })
      const impM = line.match(/^(?:import|from)\s+(\S+)/)
      if (impM) addNode({ id: `imp_${i}`, label: line.trim().slice(0, 28), type: 'import', detail: line.trim(), line: i + 1 })
      if (/^[ \t]+for\s+/.test(line)) addNode({ id: `loop_${i}`, label: `for (L${i+1})`, type: 'structure', detail: line.trim(), line: i + 1 })
      if (/^[ \t]+while\s+/.test(line)) addNode({ id: `loopw_${i}`, label: `while (L${i+1})`, type: 'structure', detail: line.trim(), line: i + 1 })
      if (/^[ \t]+if\s+/.test(line)) addNode({ id: `if_${i}`, label: `if (L${i+1})`, type: 'structure', detail: line.trim(), line: i + 1 })
      const varM = line.match(/^([a-zA-Z_]\w*)\s*=(?!=)/)
      const noKw = ['if','for','while','class','def','return','import','from','print','input','True','False','None','pass','break','continue']
      if (varM && !noKw.includes(varM[1])) addNode({ id: `var_${varM[1]}`, label: varM[1], type: 'variable', detail: line.trim(), line: i + 1 })
    })
  } else if (lang === 'JavaScript' || lang === 'TypeScript') {
    lines.forEach((line, i) => {
      const fnM = line.match(/(?:^function\s+(\w+)|(?:^const|^let)\s+(\w+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[\w]+)\s*=>|(?:^const|^let)\s+(\w+)\s*=\s*(?:async\s+)?function)/)
      if (fnM) {
        const name = fnM[1] || fnM[2] || fnM[3]
        if (name) { addNode({ id: `fn_${name}`, label: name, type: 'function', detail: line.trim(), line: i + 1 }); fnIds.push(name) }
      }
      // Method shorthand
      const methM = line.match(/^\s{2,}(\w+)\s*\([^)]*\)\s*\{/)
      if (methM && !['if','for','while','constructor'].includes(methM[1])) addNode({ id: `fn_${methM[1]}_${i}`, label: methM[1], type: 'function', detail: line.trim(), line: i + 1 })
      const clsM = line.match(/class\s+(\w+)/)
      if (clsM) addNode({ id: `cls_${clsM[1]}`, label: clsM[1], type: 'class', detail: line.trim(), line: i + 1 })
      const impM = line.match(/^import\s+/)
      if (impM) addNode({ id: `imp_${i}`, label: line.trim().slice(0, 30), type: 'import', detail: line.trim(), line: i + 1 })
      const varM = line.match(/^(?:const|let|var)\s+(\w+)/)
      if (varM && varM[1].length > 1) addNode({ id: `var_${varM[1]}_${i}`, label: varM[1], type: 'variable', detail: line.trim(), line: i + 1 })
      if (/^\s*for\s*[(\s]/.test(line)) addNode({ id: `loop_${i}`, label: `for (L${i+1})`, type: 'structure', detail: line.trim(), line: i + 1 })
      if (/^\s*if\s*\(/.test(line)) addNode({ id: `if_${i}`, label: `if (L${i+1})`, type: 'structure', detail: line.trim(), line: i + 1 })
    })
  } else if (lang === 'Java') {
    lines.forEach((line, i) => {
      const fnM = line.match(/(?:public|private|protected|static|void|int|String|boolean|double|List)\s+(\w+)\s*\([^)]*\)\s*(?:throws\s+\w+\s*)?\{?/)
      if (fnM && fnM[1] !== 'class') { addNode({ id: `fn_${fnM[1]}`, label: fnM[1], type: 'function', detail: line.trim(), line: i + 1 }); fnIds.push(fnM[1]) }
      const clsM = line.match(/class\s+(\w+)/)
      if (clsM) addNode({ id: `cls_${clsM[1]}`, label: clsM[1], type: 'class', detail: line.trim(), line: i + 1 })
      const impM = line.match(/^import\s+/)
      if (impM) addNode({ id: `imp_${i}`, label: line.trim().slice(0, 35), type: 'import', detail: line.trim(), line: i + 1 })
      if (/^\s*for\s*\(/.test(line)) addNode({ id: `loop_${i}`, label: `for (L${i+1})`, type: 'structure', detail: line.trim(), line: i + 1 })
      if (/^\s*if\s*\(/.test(line)) addNode({ id: `if_${i}`, label: `if (L${i+1})`, type: 'structure', detail: line.trim(), line: i + 1 })
    })
  }

  // ── Build edges ──────────────────────────────────────────────────────────────
  const fnNodes = rawNodes.filter(n => n.type === 'function')

  // Structure/variable → nearest enclosing function
  rawNodes.filter(n => ['structure', 'variable'].includes(n.type)).forEach(n => {
    if (!fnNodes.length) return
    const preceding = fnNodes.filter(f => (f.line || 0) <= (n.line || 0))
    const parent = preceding.length ? preceding[preceding.length - 1] : fnNodes[0]
    addEdge(parent.id, n.id, 'contains')
  })

  // Concept → nodes that match keywords
  concepts.forEach(c => {
    const keywords = c.toLowerCase().split(/[\s,&+/_-]+/).filter(k => k.length > 2)
    rawNodes.filter(n => !['concept', 'import'].includes(n.type)).forEach(n => {
      const text = `${n.label} ${n.detail || ''}`.toLowerCase()
      if (keywords.some(k => text.includes(k))) addEdge(n.id, `concept_${c}`, 'implements')
    })
  })

  // Function call detection
  fnIds.forEach(fn => {
    lines.forEach((line, i) => {
      if (!new RegExp(`\\b${fn}\\s*\\(`).test(line)) return
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) return
      // Find the function that contains this line
      const callerFn = fnNodes
        .filter(f => f.id !== `fn_${fn}` && (f.line || 0) < i)
        .sort((a, b) => (b.line || 0) - (a.line || 0))[0]
      if (callerFn) addEdge(callerFn.id, `fn_${fn}`, 'calls')
    })
  })

  return {
    nodes: rawNodes.slice(0, 50),
    edges: rawEdges.slice(0, 70),
  }
}
