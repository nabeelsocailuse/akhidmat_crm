import { toast } from 'frappe-ui'

/**
 * Global error handler for backend API errors
 * Extracts clean, user-friendly messages from Frappe errors
 */

/**
 * Converts HTML error messages to plain text
 * @param {string} input - HTML string
 * @returns {string} - Clean text
 */
function htmlToText(input) {
  if (!input) return ''
  
  let str = String(input)
  // Replace <br> variants with newlines
  str = str.replace(/<br\s*\/?\s*>/gi, '\n')
  // Remove HTML tags
  str = str.replace(/<[^>]+>/g, '')
  // Decode common HTML entities
  str = str
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
  // Collapse multiple blank lines
  str = str
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .join('\n')
  
  return str
}

/**
 * Extracts clean error message from Frappe error object
 * @param {Object} error - Error object from Frappe
 * @returns {string} - Clean error message
 */
function extractErrorMessage(error) {
  if (!error) return 'An unexpected error occurred'

  // Prefer messages array from frappe-ui call helper
  if (Array.isArray(error?.messages) && error.messages.length) {
    let text = htmlToText(error.messages.join('\n'))
    // Remove technical prefixes
    text = text.replace(/^frappe\.client\.(insert|save|submit|delete)\s*/i, '').trim()
    if (text) return text
  }

  // Handle _server_messages JSON
  const serverMessages = error?._server_messages || error?.response?._server_messages || error?.exc?._server_messages
  if (serverMessages && typeof serverMessages === 'string') {
    try {
      const list = JSON.parse(serverMessages)
      if (Array.isArray(list) && list.length > 0) {
        const first = typeof list[0] === 'string' ? JSON.parse(list[0]) || list[0] : list[0]
        if (first && typeof first === 'object') {
          const title = first.title ? String(first.title) : ''
          const message = first.message ? String(first.message) : ''
          const text = [title && htmlToText(title), htmlToText(message)]
            .filter(Boolean)
            .join('\n')
          if (text) return text
        } else if (typeof first === 'string') {
          return htmlToText(first)
        }
      }
    } catch (e) {
      // Fallback to raw server messages
      return htmlToText(serverMessages)
    }
  }

  // Handle specific error types
  if (error?.exc_type === 'MandatoryError') {
    return 'Please fill in all required fields'
  }
  if (error?.exc_type === 'ValidationError') {
    return error.messages?.[0] || 'Validation error occurred'
  }
  if (error?.exc_type === 'LinkError' || error?.exc_type === 'LinkValidationError') {
    return 'Invalid reference in one of the fields. Please check your selections.'
  }
  if (error?.exc_type === 'PermissionError') {
    return 'You do not have permission to perform this action'
  }
  if (error?.exc_type === 'DuplicateEntryError') {
    return 'A record with this information already exists'
  }
  if (error?.exc_type === 'DoesNotExistError') {
    return 'Record not found'
  }

  // Fallback to generic message fields
  const rawMessage = error?.message || error?.exc || error
  const cleanMessage = htmlToText(rawMessage)
  
  // If only row details are present, add context
  if (/^Row\s*#\d+/i.test(cleanMessage) && !/entries already exist/i.test(cleanMessage)) {
    return `Validation error:\n${cleanMessage}`
  }

  return cleanMessage || 'An unexpected error occurred'
}

/**
 * Global error handler that shows toast notification
 * @param {Object} error - Error object
 * @param {string} context - Optional context for logging
 * @param {boolean} showToast - Whether to show toast (default: true)
 * @returns {string} - Clean error message
 */
export function handleError(error, context = '', showToast = true) {
  const message = extractErrorMessage(error)
  
  // Log error for debugging
  if (context) {
    console.error(`[${context}]`, error)
  } else {
    console.error('Backend error:', error)
  }
  
  // Show toast notification
  if (showToast) {
    toast.error(message)
  }
  
  return message
}

/**
 * Wrapper for frappe.call that automatically handles errors
 * @param {string} method - API method
 * @param {Object} args - Arguments
 * @param {Object} options - Options
 * @returns {Promise} - Promise that resolves with result or rejects with clean error
 */
export async function safeCall(method, args = {}, options = {}) {
  try {
    const { call } = await import('frappe-ui')
    return await call(method, args, options)
  } catch (error) {
    const message = handleError(error, `API call: ${method}`, options.showToast !== false)
    throw new Error(message)
  }
}

/**
 * Wrapper for createResource that automatically handles errors
 * @param {Object} config - Resource configuration
 * @returns {Object} - Resource with error handling
 */
export function createSafeResource(config) {
  const { createResource } = require('frappe-ui')
  
  const originalOnError = config.onError
  const originalTransform = config.transform
  
  return createResource({
    ...config,
    onError: (error) => {
      const message = handleError(error, `Resource: ${config.url || 'unknown'}`, true)
      if (originalOnError) {
        originalOnError(error)
      }
    },
    transform: (data) => {
      try {
        return originalTransform ? originalTransform(data) : data
      } catch (error) {
        handleError(error, `Transform: ${config.url || 'unknown'}`, true)
        throw error
      }
    }
  })
}

/**
 * Higher-order function to wrap async functions with error handling
 * @param {Function} fn - Function to wrap
 * @param {string} context - Context for logging
 * @returns {Function} - Wrapped function
 */
export function withErrorHandling(fn, context = '') {
  return async (...args) => {
    try {
      return await fn(...args)
    } catch (error) {
      const message = handleError(error, context, true)
      throw new Error(message)
    }
  }
}

export default {
  handleError,
  safeCall,
  createSafeResource,
  withErrorHandling,
  extractErrorMessage
}
