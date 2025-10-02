import { createResource as frappeCreateResource } from 'frappe-ui'
import { handleError } from './errorHandler'

/**
 * Enhanced createResource wrapper with global error handling
 * Replaces direct createResource usage throughout the app
 */
export function createResource(config) {
  const originalOnError = config.onError
  const originalTransform = config.transform
  
  return frappeCreateResource({
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

export default createResource
