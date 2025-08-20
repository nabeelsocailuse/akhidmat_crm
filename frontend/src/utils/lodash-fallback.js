// Lodash fallback for frappe-ui compatibility
if (typeof window !== 'undefined' && (!window.L || !window.L.extend)) {
  const fallbackL = {
    extend: function(target, ...sources) {
      if (!target) return target;
      sources.forEach(function(source) {
        if (source && typeof source === 'object') {
          Object.keys(source).forEach(function(key) {
            target[key] = source[key];
          });
        }
      });
      return target;
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
  };
  
  // Simple assignment without Object.defineProperty to avoid lexical scoping issues
  window.L = fallbackL;
  window._ = window.L;
}

export default window.L; 