import '../../../frappe/frappe/public/js/lib/posthog.js'
import { createResource } from 'frappe-ui'

declare global {
  interface Window {
    posthog: any
  }
}
type PosthogSettings = {
  posthog_project_id: string
  posthog_host: string
  enable_telemetry: boolean
  telemetry_site_age: number
}
interface CaptureOptions {
  data: {
    user: string
    [key: string]: string | number | boolean | object
  }
}

let posthog: typeof window.posthog = window.posthog

// Posthog Settings - Disabled to prevent validation errors
let posthogSettings = createResource({
  url: 'crm.api.get_posthog_settings',
  cache: 'posthog_settings',
  onSuccess: (ps: PosthogSettings) => {
    // Disable telemetry to prevent validation errors
    return
  },
  onError: () => {
    // Silently handle errors to prevent console spam
    return
  }
})

let isTelemetryEnabled = () => {
  // Always return false to disable telemetry
  return false
}

// Posthog Initialization - Disabled
function initPosthog(ps: PosthogSettings) {
  // Disable telemetry initialization
  return
}

// Posthog Functions - Disabled
function capture(
  event: string,
  options: CaptureOptions = { data: { user: '' } },
) {
  // Disable telemetry capture
  return
}

function startRecording() {
  // Disable recording
  return
}

function stopRecording() {
  // Disable recording
  return
}

// Posthog Plugin - Disabled
function posthogPlugin(app: any) {
  // Disable telemetry plugin
  return
}

export {
  posthog,
  posthogSettings,
  posthogPlugin,
  capture,
  startRecording,
  stopRecording,
}
