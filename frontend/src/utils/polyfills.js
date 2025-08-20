// Polyfills for frappe-ui compatibility
import { Buffer } from 'buffer'
import process from 'process'

// Ensure global objects are available
if (typeof window !== 'undefined') {
  window.global = window
  window.Buffer = Buffer
  window.process = process
  
  // Add crypto polyfill
  if (!window.crypto) {
    window.crypto = {
      getRandomValues: (arr) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Math.floor(Math.random() * 256)
        }
        return arr
      },
      subtle: {
        digest: async (algorithm, data) => {
          // Simple hash implementation for build process
          const encoder = new TextEncoder()
          const encoded = encoder.encode(data)
          let hash = 0
          for (let i = 0; i < encoded.length; i++) {
            hash = ((hash << 5) - hash) + encoded[i]
            hash = hash & hash // Convert to 32-bit integer
          }
          return new Uint8Array([hash & 0xFF, (hash >> 8) & 0xFF, (hash >> 16) & 0xFF, (hash >> 24) & 0xFF])
        }
      }
    }
  }
  
  // CRITICAL: Ensure Lodash is available as L (for frappe-ui compatibility)
  // Only create fallback if L is not already set by main.js
  if (!window.L || !window.L.extend) {
    console.warn('Lodash not found, creating fallback L object')
    // Fallback if lodash is not available
    const fallbackL = {
      extend: (target, ...sources) => {
        if (!target) return target
        sources.forEach(source => {
          if (source && typeof source === 'object') {
            Object.keys(source).forEach(key => {
              target[key] = source[key]
            })
          }
        })
        return target
      },
      // Add other commonly used lodash methods
      isObject: (value) => value !== null && typeof value === 'object',
      isFunction: (value) => typeof value === 'function',
      isString: (value) => typeof value === 'string',
      isNumber: (value) => typeof value === 'number',
      isBoolean: (value) => typeof value === 'boolean',
      isArray: Array.isArray,
      isEmpty: (value) => {
        if (value == null) return true
        if (Array.isArray(value) || typeof value === 'string') return value.length === 0
        if (value instanceof Map || value instanceof Set) return value.size === 0
        return Object.keys(value).length === 0
      }
    }
    
    window.L = fallbackL
    window._ = window.L
  }
}

// Export for module usage
export { Buffer, process } 