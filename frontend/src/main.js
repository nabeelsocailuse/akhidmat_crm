import './index.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createDialog } from './utils/dialogs'
import socket from './socket'
import router from './router'
import translationPlugin from './translation'
import { posthogPlugin } from './telemetry'
import App from './App.vue'

import {
  FrappeUI,
  Button,
  Input,
  TextInput,
  FormControl,
  ErrorMessage,
  Dialog,
  Alert,
  Badge,
  setConfig,
  frappeRequest,
  FeatherIcon,
} from 'frappe-ui'

let globalComponents = {
  Button,
  TextInput,
  Input,
  FormControl,
  ErrorMessage,
  Dialog,
  Alert,
  Badge,
  FeatherIcon,
}

// create a pinia instance
let pinia = createPinia()

let app = createApp(App)

setConfig('resourceFetcher', frappeRequest)
app.use(FrappeUI)
app.use(pinia)
app.use(router)
app.use(translationPlugin)
app.use(posthogPlugin)
for (let key in globalComponents) {
  app.component(key, globalComponents[key])
}

app.config.globalProperties.$dialog = createDialog

// Fix: Set error handler BEFORE mounting the app
app.config.errorHandler = (error, instance, info) => {
  console.error('Global error handler:', error)
  console.error('Component:', instance)
  console.error('Info:', info)
  
  // Handle specific null reference errors
  if (error.message && error.message.includes("Cannot read properties of null")) {
    console.warn('Null reference error caught - this may be a component lifecycle issue')
    return false // Prevent error from propagating
  }
  
  // Prevent Vue router errors from crashing the app
  if (error.message && error.message.includes('vue-router')) {
    console.warn('Vue router error caught and handled')
    return false
  }
}

// Fix: Set promise rejection handler BEFORE mounting
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason)
  
  // Prevent promise rejections from crashing the app
  if (event.reason && event.reason.message && event.reason.message.includes('vue-router')) {
    console.warn('Vue router promise rejection caught and handled')
    event.preventDefault()
    return false
  }
})

// Set socket globally
app.config.globalProperties.$socket = socket

if (import.meta.env.DEV) {
  frappeRequest({ url: '/api/method/crm.www.crm.get_context_for_dev' })
    .then((values) => {
      try {
        for (let key in values) {
          if (values.hasOwnProperty(key)) {
            window[key] = values[key]
          }
        }
      } catch (error) {
        console.error('Error setting up dev context:', error)
      }
    })
    .catch((error) => {
      console.error('Failed to get dev context:', error)
    })
    .finally(() => {
      // Mount app only once at the end
      app.mount('#app')
    })
} else {
  try {
    // Mount app only once
    app.mount('#app')
  } catch (error) {
    console.error('Error setting up app:', error)
    app.mount('#app')
  }
}

if (import.meta.env.DEV) {
  window.$dialog = createDialog
}
