/**
 * Language Registry
 * Modular architecture supporting C++, Python, JavaScript, and future programming languages
 */
import { cppAdapter } from './cppAdapter.js'
import { pythonAdapter } from './pythonAdapter.js'

const adapters = {
  'C++': cppAdapter,
  'CPP': cppAdapter,
  'PYTHON': pythonAdapter,
  'PY': pythonAdapter
}

/**
 * Get language adapter by name
 * @param {string} langName
 * @returns {Object} Language Adapter
 */
export function getLanguageAdapter(langName = 'C++') {
  const normalized = String(langName).toUpperCase().trim()
  return adapters[normalized] || cppAdapter
}

export function registerLanguageAdapter(langName, adapter) {
  adapters[String(langName).toUpperCase().trim()] = adapter
}
