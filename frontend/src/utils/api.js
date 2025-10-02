import { call as frappeCall } from 'frappe-ui'
import { handleError } from './errorHandler'

/**
 * Enhanced call wrapper with global error handling
 * Replaces direct frappe.call usage throughout the app
 */
export async function call(method, args = {}, options = {}) {
  try {
    return await frappeCall(method, args, options)
  } catch (error) {
    const message = handleError(error, `API: ${method}`, options.showToast !== false)
    throw new Error(message)
  }
}

/**
 * Silent call wrapper (no toast notifications)
 * For internal API calls where errors should be handled manually
 */
export async function callSilent(method, args = {}, options = {}) {
  try {
    return await frappeCall(method, args, options)
  } catch (error) {
    const message = handleError(error, `API: ${method}`, false)
    throw new Error(message)
  }
}

export default call
