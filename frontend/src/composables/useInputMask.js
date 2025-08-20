import { ref, nextTick, onMounted, onUnmounted, watch } from 'vue'
import IMask from 'imask'

export function useInputMask() {
  const maskInstances = ref(new Map())
  const inputRefs = ref(new Map())
  
  // Default phone mask for Pakistan
  const defaultPhoneMask = {
    mask: '+92-000-0000000',
    lazy: false,
    placeholderChar: '0'
  }
  
  // Create mask instance for a specific input
  function createMask(inputElement, maskOptions, country = 'Pakistan') {
    if (!inputElement) return null
    
    // Remove existing mask if any
    removeMask(inputElement)
    
    let options = { ...maskOptions }
    
    // Country-specific masks
    if (country === 'Pakistan') {
      options = {
        ...defaultPhoneMask,
        ...options
      }
    } else if (country === 'Afghanistan') {
      options = {
        mask: '+93-000-0000000',
        lazy: false,
        placeholderChar: '0',
        ...options
      }
    } else {
      // For other countries, use a generic international format
      options = {
        mask: '+00-000-0000000',
        lazy: false,
        placeholderChar: '0',
        ...options
      }
    }
    
    try {
      const maskInstance = IMask(inputElement, options)
      maskInstances.value.set(inputElement, maskInstance)
      
      // Handle mask events
      maskInstance.on('accept', () => {
        // Emit change event
        const event = new CustomEvent('mask-change', {
          detail: { value: maskInstance.value }
        })
        inputElement.dispatchEvent(event)
      })
      
      return maskInstance
    } catch (error) {
      console.error('Error creating mask:', error)
      return null
    }
  }
  
  // Remove mask from input
  function removeMask(inputElement) {
    if (!inputElement) return
    
    const existingMask = maskInstances.value.get(inputElement)
    if (existingMask) {
      existingMask.destroy()
      maskInstances.value.delete(inputElement)
    }
  }
  
  // Apply mask to input with proper timing
  async function applyMaskToInput(inputRef, maskOptions = {}, country = 'Pakistan') {
    if (!inputRef) return
    
    await nextTick()
    
    // Wait for DOM to be ready
    await new Promise(resolve => setTimeout(resolve, 50))
    
    const inputElement = inputRef.$el?.querySelector('input') || inputRef.$el || inputRef
    
    if (!inputElement || inputElement.tagName !== 'INPUT') {
      console.warn('Input element not found for masking')
      return null
    }
    
    return createMask(inputElement, maskOptions, country)
  }
  
  // Apply mask to all inputs in a container
  async function applyMasksToContainer(containerRef, selector = 'input[type="text"]', maskOptions = {}, country = 'Pakistan') {
    if (!containerRef) return
    
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 100))
    
    const container = containerRef.$el || containerRef
    if (!container || typeof container.querySelectorAll !== 'function') {
      console.warn('Container not found or querySelectorAll not available')
      return
    }
    
    try {
      const inputs = container.querySelectorAll(selector)
      
      inputs.forEach(input => {
        if (input.dataset.masked !== 'true') {
          createMask(input, maskOptions, country)
          input.dataset.masked = 'true'
        }
      })
    } catch (error) {
      console.error('Error applying masks to container:', error)
    }
  }
  
  // Watch for new rows in child table and apply masks
  function watchChildTableRows(rows, containerRef, maskOptions = {}, country = 'Pakistan') {
    watch(rows, async (newRows, oldRows) => {
      if (newRows && newRows.length > (oldRows?.length || 0)) {
        // New row added, apply masks after DOM update
        await nextTick()
        await new Promise(resolve => setTimeout(resolve, 200))
        
        await applyMasksToContainer(containerRef, 'input[type="text"]', maskOptions, country)
      }
    }, { deep: true })
  }
  
  // Apply masks when modal opens
  async function applyMasksOnModalOpen(containerRef, maskOptions = {}, country = 'Pakistan') {
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 300))
    
    await applyMasksToContainer(containerRef, 'input[type="text"]', maskOptions, country)
  }
  
  // Clean up all masks
  function cleanupMasks() {
    maskInstances.value.forEach((maskInstance, inputElement) => {
      try {
        maskInstance.destroy()
      } catch (error) {
        console.error('Error destroying mask instance:', error)
      }
    })
    maskInstances.value.clear()
    inputRefs.value.clear()
  }
  
  // Get masked value from input
  function getMaskedValue(inputElement) {
    const maskInstance = maskInstances.value.get(inputElement)
    return maskInstance ? maskInstance.value : inputElement.value
  }
  
  // Set masked value to input
  function setMaskedValue(inputElement, value) {
    const maskInstance = maskInstances.value.get(inputElement)
    if (maskInstance) {
      maskInstance.value = value
    } else {
      inputElement.value = value
    }
  }
  
  // Validate masked input
  function validateMaskedInput(inputElement) {
    const maskInstance = maskInstances.value.get(inputElement)
    if (!maskInstance) return false
    
    return maskInstance.masked.isComplete
  }
  
  // Create a reactive mask manager for child tables
  function createChildTableMaskManager(containerRef, country = 'Pakistan') {
    const manager = {
      containerRef,
      country,
      masks: new Map(),
      
      async applyToNewRow(rowIndex) {
        await nextTick()
        await new Promise(resolve => setTimeout(resolve, 100))
        
        const container = containerRef.value?.$el || containerRef.value
        if (!container || typeof container.querySelectorAll !== 'function') {
          console.warn('Container not found for new row masking')
          return
        }
        
        try {
          const rowInputs = container.querySelectorAll(`[data-row="${rowIndex}"] input[type="text"]`)
          
          rowInputs.forEach(input => {
            if (input.dataset.masked !== 'true') {
              const maskInstance = createMask(input, {}, country)
              if (maskInstance) {
                this.masks.set(`${rowIndex}-${input.name}`, maskInstance)
                input.dataset.masked = 'true'
              }
            }
          })
        } catch (error) {
          console.error('Error applying masks to new row:', error)
        }
      },
      
      async applyToAllRows() {
        await nextTick()
        await new Promise(resolve => setTimeout(resolve, 200))
        
        const container = containerRef.value?.$el || containerRef.value
        if (!container || typeof container.querySelectorAll !== 'function') {
          console.warn('Container not found for all rows masking')
          return
        }
        
        try {
          const allInputs = container.querySelectorAll('input[type="text"]')
          
          allInputs.forEach(input => {
            if (input.dataset.masked !== 'true') {
              const maskInstance = createMask(input, {}, country)
              if (maskInstance) {
                const rowIndex = input.closest('[data-row]')?.dataset.row || 'unknown'
                this.masks.set(`${rowIndex}-${input.name}`, maskInstance)
                input.dataset.masked = 'true'
              }
            }
          })
        } catch (error) {
          console.error('Error applying masks to all rows:', error)
        }
      },
      
      cleanup() {
        this.masks.forEach(maskInstance => {
          try {
            maskInstance.destroy()
          } catch (error) {
            console.error('Error destroying mask instance:', error)
          }
        })
        this.masks.clear()
      }
    }
    
    return manager
  }
  
  onUnmounted(() => {
    cleanupMasks()
  })
  
  return {
    // Core functions
    createMask,
    removeMask,
    applyMaskToInput,
    applyMasksToContainer,
    getMaskedValue,
    setMaskedValue,
    validateMaskedInput,
    cleanupMasks,
    
    // Child table specific functions
    watchChildTableRows,
    applyMasksOnModalOpen,
    createChildTableMaskManager,
    
    // Reactive references
    maskInstances,
    inputRefs
  }
} 