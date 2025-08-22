import { ref, nextTick } from 'vue'
import { call } from 'frappe-ui'

export function useDonorFieldValidation() {
  const showCnicExistsDialog = ref(false)
  const cnicExistsMessage = ref('')
  const showCnicValidationDialog = ref(false)
  const cnicValidationMessage = ref('')

  // CNIC masking functions based on backend implementation
  function formatCnic(value) {
    if (!value) return ''
    
    // Remove all non-digits
    const digits = value.replace(/\D/g, '')
    
    // CNIC format: xxxxx-xxxxxxx-x (same as backend mask: "99999-9999999-9")
    if (digits.length <= 5) {
      return digits
    } else if (digits.length <= 12) {
      return `${digits.slice(0, 5)}-${digits.slice(5)}`
    } else {
      return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12, 13)}`
    }
  }

  function formatNtn(value) {
    if (!value) return ''
    
    // Remove all non-digits
    const digits = value.replace(/\D/g, '')
    
    // NTN format: xxxxxx-x (same as backend mask: "999999-9")
    if (digits.length <= 6) {
      return digits
    } else {
      return `${digits.slice(0, 6)}-${digits.slice(6, 7)}`
    }
  }

  function formatPassport(value) {
    if (!value) return ''
    
    // Remove all non-digits and limit to 9 digits (same as backend mask: "999999999")
    const digits = value.replace(/\D/g, '').slice(0, 9)
    return digits
  }

  // Get mask pattern for placeholder display
  function getMaskPattern(identificationType) {
    switch (identificationType) {
      case 'CNIC':
        return '99999-9999999-9'
      case 'NTN':
        return '999999-9'
      case 'Passport':
        return '999999999'
      default:
        return ''
    }
  }

  // Get country phone mask from backend
  async function getCountryPhoneMask(country) {
    if (!country) return null
    
    try {
      const result = await call('frappe.client.get_value', {
        doctype: 'Country',
        fieldname: ['custom_dial_code', 'custom_phone_mask', 'custom_phone_regex'],
        filters: { name: country }
      })
      
      const data = result.message || result
      if (!data) return null
      
      return {
        dialCode: data.custom_dial_code || '',
        phoneMask: data.custom_phone_mask || '',
        phoneRegex: data.custom_phone_regex || ''
      }
    } catch (error) {
      console.error('Error fetching country phone mask:', error)
      return null
    }
  }

  // Find input field by various selectors
  function findInputField(fieldName) {
    // Try to find by exact field name in various attributes
    let inputElement = document.querySelector(`input[name="${fieldName}"]`)
    if (inputElement) return inputElement
    
    inputElement = document.querySelector(`[data-name="${fieldName}"] input`)
    if (inputElement) return inputElement
    
    inputElement = document.querySelector(`[data-fieldname="${fieldName}"] input`)
    if (inputElement) return inputElement
    
    // Try to find by field name in parent containers
    const fieldContainers = document.querySelectorAll('[data-fieldname], [data-name]')
    for (let container of fieldContainers) {
      const containerFieldName = container.getAttribute('data-fieldname') || container.getAttribute('data-name')
      if (containerFieldName === fieldName) {
        const input = container.querySelector('input')
        if (input) return input
      }
    }
    
    // Try to find by label text (for CNIC field)
    if (fieldName === 'cnic') {
      const labels = document.querySelectorAll('label, .text-sm')
      for (let label of labels) {
        if (label.textContent.includes('CNIC') || label.textContent.includes('Identification')) {
          const fieldContainer = label.closest('.field')
          if (fieldContainer) {
            inputElement = fieldContainer.querySelector('input')
            if (inputElement) break
          }
        }
      }
    }
    
    return inputElement
  }

  // Apply CNIC mask to input field
  function applyCnicMaskToInput(fieldName, identificationType, setFieldValue) {
    nextTick(() => {
      const inputElement = findInputField(fieldName)
      
      if (inputElement) {
        const maskPattern = getMaskPattern(identificationType)
        inputElement.placeholder = maskPattern
        
        // Set required attribute for CNIC field when it's mandatory
        const isCnicMandatory = identificationType && 
                                identificationType !== 'Others'
        
        if (fieldName === 'cnic' && isCnicMandatory) {
          inputElement.required = true
          inputElement.setAttribute('aria-required', 'true')
        }
        
        // Remove existing event listeners to avoid duplicates
        inputElement.removeEventListener('input', inputElement._maskHandler)
        
        // Add input event listener for real-time formatting
        inputElement._maskHandler = (e) => {
          let value = e.target.value
          let formattedValue = ''
          
          if (identificationType === 'CNIC') {
            formattedValue = formatCnic(value)
          } else if (identificationType === 'NTN') {
            formattedValue = formatNtn(value)
          } else if (identificationType === 'Passport') {
            formattedValue = formatPassport(value)
          }
          
          if (formattedValue !== value) {
            e.target.value = formattedValue
            if (setFieldValue) {
              setFieldValue(fieldName, formattedValue)
            }
          }
        }
        
        inputElement.addEventListener('input', inputElement._maskHandler)
        
        // Also apply formatting to existing value
        if (inputElement.value) {
          let formattedValue = ''
          if (identificationType === 'CNIC') {
            formattedValue = formatCnic(inputElement.value)
          } else if (identificationType === 'NTN') {
            formattedValue = formatNtn(inputElement.value)
          } else if (identificationType === 'Passport') {
            formattedValue = formatPassport(inputElement.value)
          }
          
          if (formattedValue !== inputElement.value) {
            inputElement.value = formattedValue
            if (setFieldValue) {
              setFieldValue(fieldName, formattedValue)
            }
          }
        }
      }
    })
  }

  // Apply phone mask to input field
  async function applyPhoneMaskToInput(fieldName, country, setFieldValue) {
    if (!country) return
    
    nextTick(async () => {
      await new Promise(resolve => setTimeout(resolve, 200))
      
      let inputElement = findInputField(fieldName)
      
      if (inputElement) {
        // Remove existing mask and event listeners
        if (inputElement._pakistanHandler) {
          inputElement.removeEventListener('input', inputElement._pakistanHandler)
          inputElement._pakistanHandler = null
        }
        if (inputElement._pakistanKeydownHandler) {
          inputElement.removeEventListener('keydown', inputElement._pakistanKeydownHandler)
          inputElement._pakistanKeydownHandler = null
        }
        if (inputElement._pakistanPasteHandler) {
          inputElement.removeEventListener('paste', inputElement._pakistanPasteHandler)
          inputElement._pakistanPasteHandler = null
        }
        if (inputElement._otherCountryHandler) {
          inputElement.removeEventListener('input', inputElement._otherCountryHandler)
          inputElement._otherCountryHandler = null
        }
        if (inputElement._otherCountryKeydownHandler) {
          inputElement.removeEventListener('keydown', inputElement._otherCountryKeydownHandler)
          inputElement._otherCountryKeydownHandler = null
        }
        
        // Remove existing country prefix with more thorough cleanup
        const existingPrefixes = inputElement.parentNode.querySelectorAll('.country-prefix, .pakistan-prefix')
        existingPrefixes.forEach(prefix => prefix.remove())
        
        // Reset input styling
        inputElement.style.paddingLeft = ''
        inputElement.style.position = ''
        
        // Also reset parent styling
        if (inputElement.parentNode) {
          inputElement.parentNode.style.position = ''
        }
        
        // Get country-specific mask
        const countryMask = await getCountryPhoneMask(country)
        
        if (countryMask) {
          if (country === 'Pakistan' || country === 'pakistan') {
            inputElement.placeholder = 'xxx-xxxxxxx'
            
            const existingPrefixes = inputElement.parentNode?.querySelectorAll('.pakistan-prefix')
            existingPrefixes?.forEach(prefix => prefix.remove())
            
            inputElement.style.paddingLeft = '28px'
            inputElement.style.position = 'relative'
            
            // Add Pakistan prefix - fixed 92
            const prefixElement = document.createElement('span')
            prefixElement.className = 'pakistan-prefix'
            prefixElement.style.cssText = 'position:absolute;left:10px;top:7px;color:#888;pointer-events:none;font-size:12px;z-index:10;user-select:none;'
            prefixElement.textContent = '92'
            inputElement.parentNode.style.position = 'relative'
            inputElement.parentNode.insertBefore(prefixElement, inputElement)
            
            // Handle existing value - show only part after 92
            if (inputElement.value && inputElement.value.startsWith('92')) {
              const after92 = inputElement.value.slice(2)
              const cleanValue = after92.replace(/\D/g, '')
              if (cleanValue.length >= 3) {
                inputElement.value = `${cleanValue.slice(0, 3)}-${cleanValue.slice(3)}`
              } else {
                inputElement.value = cleanValue
              }
            } else if (inputElement.value && inputElement.value.trim() !== '') {
              // If there's a value but it doesn't start with 92, preserve it
              // This prevents data loss when masking is reapplied
              const cleanValue = inputElement.value.replace(/\D/g, '')
              if (cleanValue.length >= 3) {
                inputElement.value = `${cleanValue.slice(0, 3)}-${cleanValue.slice(3)}`
              } else {
                inputElement.value = cleanValue
              }
            }
            // Don't clear the field if it has no value - let user enter data
            
            // Add input handler for Pakistan - with readonly 92 prefix
            inputElement._pakistanHandler = (e) => {
              // Don't interfere with backspace or delete operations
              if (e.inputType === 'deleteContentBackward' || e.inputType === 'deleteContentForward') {
                return
              }
              
              // Get the current value and clean it
              let val = e.target.value.replace(/\D/g, '').slice(0, 10) // Only 10 digits
              let displayValue = ''
              
              if (val.length > 0) {
                if (val.length <= 3) {
                  displayValue = val
                } else {
                  displayValue = `${val.slice(0, 3)}-${val.slice(3)}`
                }
              }
              
              // Only update if the value actually changed
              if (e.target.value !== displayValue) {
                e.target.value = displayValue
              }
              
              // Store the value in the correct format
              if (val.length === 10) {
                // Check if it starts with valid Pakistani mobile prefixes
                const validPrefixes = ['30', '31', '32', '33', '34', '35', '36', '37', '38', '39']
                const firstDigits = val.substring(0, 2)
                
                if (validPrefixes.includes(firstDigits)) {
                  // Store as international format (92XXXXXXXXXX)
                  const formattedValue = `92${val}`
                  if (setFieldValue) {
                    setFieldValue(fieldName, formattedValue)
                  }
                } else {
                  // Invalid prefix
                  if (setFieldValue) {
                    setFieldValue(fieldName, '')
                  }
                }
              } else {
                if (setFieldValue) {
                  setFieldValue(fieldName, '')
                }
              }
            }
            inputElement.addEventListener('input', inputElement._pakistanHandler)
            
            // Add a MutationObserver to prevent Vue from setting the input value to the stored value
            const observer = new MutationObserver((mutations) => {
              mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'value') {
                  const currentValue = inputElement.value
                  if (currentValue && currentValue.startsWith('92')) {
                    const after92 = currentValue.slice(2)
                    const cleanValue = after92.replace(/\D/g, '')
                    if (cleanValue.length >= 3) {
                      inputElement.value = `${cleanValue.slice(0, 3)}-${cleanValue.slice(3)}`
                    } else {
                      inputElement.value = cleanValue
                    }
                  }
                }
              })
            })
            
            observer.observe(inputElement, {
              attributes: true,
              attributeFilter: ['value']
            })
            
            // Add keydown handler to prevent typing when mask is complete and protect 92 prefix
            inputElement._pakistanKeydownHandler = (e) => {
              const currentValue = e.target.value.replace(/\D/g, '')
              
              // Allow navigation keys always
              if ([8, 9, 27, 37, 38, 39, 40, 46].includes(e.keyCode)) {
                return true
              }
              
              // Only block if we've exceeded the required digits (10 for Pakistan)
              if (currentValue.length > 10) {
                e.preventDefault()
                return false
              }
            }
            inputElement.addEventListener('keydown', inputElement._pakistanKeydownHandler)
            
            // Add paste handler like backend
            inputElement._pakistanPasteHandler = (e) => {
              let paste = (e.originalEvent || e).clipboardData.getData('text')
              paste = paste.replace(/\D/g, '')
              if (paste.startsWith('92')) {
                paste = paste.slice(2)
              }
              paste = paste.slice(0, 10)
              
              let displayValue = ''
              if (paste.length > 0) {
                if (paste.length <= 3) {
                  displayValue = paste
                } else {
                  displayValue = `${paste.slice(0, 3)}-${paste.slice(3)}`
                }
              }
              inputElement.value = displayValue
              
              if (paste && paste.length === 10) {
                // Check if it starts with valid Pakistani mobile prefixes
                const validPrefixes = ['30', '31', '32', '33', '34', '35', '36', '37', '38', '39']
                const firstDigits = paste.substring(0, 2)
                
                if (validPrefixes.includes(firstDigits)) {
                  // Store as international format (92XXXXXXXXXX)
                  const formattedValue = `92${paste}`
                  if (setFieldValue) {
                    setFieldValue(fieldName, formattedValue)
                  }
                } else {
                  // Invalid prefix
                  if (setFieldValue) {
                    setFieldValue(fieldName, '')
                  }
                }
              } else {
                if (setFieldValue) {
                  setFieldValue(fieldName, '')
                }
              }
              e.preventDefault()
            }
            inputElement.addEventListener('paste', inputElement._pakistanPasteHandler)
            
          } else {
            // Other countries - strict mask enforcement
            const dialCode = countryMask?.dialCode || ''
            const phoneMask = countryMask?.phoneMask || ''
            
            // Calculate required digits from mask
            const requiredDigits = phoneMask ? phoneMask.replace(/\D/g, '').length : 0
            
            // Set placeholder based on mask
            if (phoneMask) {
              inputElement.placeholder = phoneMask
            } else {
              inputElement.placeholder = 'Enter phone number'
            }
            
            // Handle existing value - remove 92 prefix if switching from Pakistan
            if (inputElement.value && inputElement.value.startsWith('92')) {
              inputElement.value = inputElement.value.slice(2)
            }
            
            // Add input handler for other countries with strict digit limit
            inputElement._otherCountryHandler = (e) => {
              let value = e.target.value
              const cleanValue = value.replace(/\D/g, '')
              
              // If we have a mask, enforce the exact digit count
              if (phoneMask && requiredDigits > 0) {
                // Limit to required digits
                if (cleanValue.length > requiredDigits) {
                  value = cleanValue.slice(0, requiredDigits)
                  e.target.value = value
                }
                
                // Format according to mask if we have the full number
                if (cleanValue.length === requiredDigits) {
                  // Apply mask formatting
                  let formattedValue = phoneMask
                  let digitIndex = 0
                  
                  for (let i = 0; i < phoneMask.length && digitIndex < cleanValue.length; i++) {
                    if (phoneMask[i] === '9' || phoneMask[i] === '0') {
                      formattedValue = formattedValue.slice(0, i) + cleanValue[digitIndex] + formattedValue.slice(i + 1)
                      digitIndex++
                    }
                  }
                  
                  e.target.value = formattedValue
                  value = formattedValue
                }
              }
              
              // Store the formatted value
              if (setFieldValue) {
                setFieldValue(fieldName, value)
              }
            }
            inputElement.addEventListener('input', inputElement._otherCountryHandler)
            
            // Add keydown handler with strict digit limit
            inputElement._otherCountryKeydownHandler = (e) => {
              const currentValue = e.target.value.replace(/\D/g, '')
              
              // Allow navigation keys always
              if ([8, 9, 27, 37, 38, 39, 40, 46].includes(e.keyCode)) {
                return true
              }
              
              // If we have a mask, enforce the exact digit count
              if (phoneMask && requiredDigits > 0) {
                if (currentValue.length >= requiredDigits) {
                  e.preventDefault()
                  return false
                }
              } else {
                // Fallback limit for countries without mask
                if (currentValue.length > 15) {
                  e.preventDefault()
                  return false
                }
              }
            }
            inputElement.addEventListener('keydown', inputElement._otherCountryKeydownHandler)
            
            // Add paste handler for other countries
            inputElement._otherCountryPasteHandler = (e) => {
              let paste = (e.originalEvent || e).clipboardData.getData('text')
              paste = paste.replace(/\D/g, '')
              
              // If we have a mask, limit to required digits
              if (phoneMask && requiredDigits > 0) {
                paste = paste.slice(0, requiredDigits)
              } else {
                paste = paste.slice(0, 15) // Fallback limit
              }
              
              e.target.value = paste
              
              // Store the value
              if (setFieldValue) {
                setFieldValue(fieldName, paste)
              }
              
              e.preventDefault()
            }
            inputElement.addEventListener('paste', inputElement._otherCountryPasteHandler)
          }
        }
      }
    })
  }

  // Apply phone masks when country changes
  async function applyPhoneMasksForCountry(country, setFieldValue) {
    if (!country) return
    
    // Wait for fields to be rendered
    await new Promise(resolve => setTimeout(resolve, 500))
    
    const fields = ['contact_no', 'co_contact_no', 'company_contact_number', 'organization_contact_person', 'representative_mobile', 'phone_no', 'mobile_no', 'org_representative_contact_number', 'org_contact']
    
    for (const fieldName of fields) {
      const inputElement = findInputField(fieldName)
      if (inputElement) {
        await applyPhoneMaskToInput(fieldName, country, setFieldValue)
      }
    }
  }

  // Validate phone number format based on country
  async function validatePhoneNumber(phoneNumber, country) {
    if (!country) {
      return { isValid: true, message: '' }
    }
    
    try {
      const countryMask = await getCountryPhoneMask(country)
      if (!countryMask) {
        return { isValid: true, message: '' }
      }
      
      if (country === 'Pakistan' || country === 'pakistan') {
        // Special validation for Pakistan
        if (!phoneNumber) {
          return { isValid: true, message: '' }
        }
        
        const cleanPhone = phoneNumber.replace(/\D/g, '')
        
        // Check if it's international format (starts with 92)
        if (cleanPhone.startsWith('92')) {
          const after92 = cleanPhone.substring(2)
          if (after92.length !== 10) {
            return {
              isValid: false,
              message: 'Pakistan phone number must be 10 digits after country code (92).'
            }
          }
          // Check if it starts with valid Pakistani mobile prefixes
          const validPrefixes = ['30', '31', '32', '33', '34', '35', '36', '37', '38', '39']
          const firstDigits = after92.substring(0, 2)
          if (!validPrefixes.includes(firstDigits)) {
            return {
              isValid: false,
              message: 'Pakistan phone number must start with valid mobile prefix (30-39).'
            }
          }
          return { isValid: true, message: '' }
        } 
        // Check if it's a raw number that should be treated as international (adds 92 automatically)
        else if (cleanPhone.length === 10) {
          // Check if it starts with valid Pakistani mobile prefixes
          const validPrefixes = ['30', '31', '32', '33', '34', '35', '36', '37', '38', '39']
          const firstDigits = cleanPhone.substring(0, 2)
          if (!validPrefixes.includes(firstDigits)) {
            return {
              isValid: false,
              message: 'Pakistan phone number must start with valid mobile prefix (30-39).'
            }
          }
          // This is valid - it will be treated as an international number
          return { isValid: true, message: '' }
        } else {
          return {
            isValid: false,
            message: 'Pakistan phone number must be 10 digits and start with valid mobile prefix (30-39).'
          }
        }
      } else if (country === 'Algeria') {
        // Special validation for Algeria
        const dialCode = countryMask.dialCode || '213'
        const phoneMask = countryMask.phoneMask || '11097'
        const requiredDigits = phoneMask ? phoneMask.replace(/\D/g, '').length : 5
        
        // If no phone number provided, show required message
        if (!phoneNumber) {
          return {
            isValid: false,
            message: `Algeria phone number is required. Expected format: ${dialCode}-${phoneMask}`
          }
        }
        
        // Remove + prefix if present
        let phoneToValidate = phoneNumber
        if (phoneNumber.startsWith('+')) {
          phoneToValidate = phoneNumber.slice(1)
        }
        
        // Check if number starts with country code
        if (!phoneToValidate.startsWith(dialCode)) {
          return {
            isValid: false,
            message: `Algeria phone number must start with country code ${dialCode}. Expected format: ${dialCode}-${phoneMask}`
          }
        }
        
        // Remove country code for validation
        const numberWithoutCode = phoneToValidate.slice(dialCode.length)
        const cleanNumber = numberWithoutCode.replace(/\D/g, '')
        
        // Strict validation: check exact digit count
        if (cleanNumber.length !== requiredDigits) {
          return {
            isValid: false,
            message: `Algeria phone number must be exactly ${requiredDigits} digits after country code. Expected format: ${dialCode}-${phoneMask}`
          }
        }
        
        // If we reach here, the number is valid
        return { isValid: true, message: '' }
      } else {
        // For other countries, use strict mask validation
        if (!phoneNumber) {
          // For countries with strict mask requirements, show required field message
          const phoneMask = countryMask.phoneMask || ''
          if (phoneMask) {
            return {
              isValid: false,
              message: `${country} phone number is required. Expected format: ${phoneMask}`
            }
          }
          return { isValid: true, message: '' } // Allow empty for countries without mask
        }
        
        const cleanNumber = phoneNumber.replace(/\D/g, '')
        const phoneMask = countryMask.phoneMask || ''
        const requiredDigits = phoneMask ? phoneMask.replace(/\D/g, '').length : 0
        
        // If we have a specific mask, validate against it strictly
        if (phoneMask && requiredDigits > 0) {
          if (cleanNumber.length !== requiredDigits) {
            return {
              isValid: false,
              message: `${country} phone number must be exactly ${requiredDigits} digits. Expected format: ${phoneMask}`
            }
          }
          
          // Check if the number matches the mask format
          let isValidFormat = true
          let digitIndex = 0
          
          for (let i = 0; i < phoneMask.length; i++) {
            if (phoneMask[i] === '9' || phoneMask[i] === '0') {
              if (digitIndex >= cleanNumber.length || !/^\d$/.test(cleanNumber[digitIndex])) {
                isValidFormat = false
                break
              }
              digitIndex++
            }
          }
          
          if (!isValidFormat) {
            return {
              isValid: false,
              message: `${country} phone number format is invalid. Expected format: ${phoneMask}`
            }
          }
          
          return { isValid: true, message: '' }
        } else {
          // Fallback validation for countries without specific mask
          if (cleanNumber.length < 7) {
            return {
              isValid: false,
              message: `${country} phone number must be at least 7 digits.`
            }
          }
          
          if (cleanNumber.length > 15) {
            return {
              isValid: false,
              message: `${country} phone number cannot exceed 15 digits.`
            }
          }
          
          return { isValid: true, message: '' }
        }
      }
    } catch (error) {
      console.error('Error validating phone number:', error)
      return { isValid: true, message: '' }
    }
  }

  // Show visual feedback for phone number validation
  function showPhoneValidationFeedback(fieldName, isValid, message) {
    nextTick(() => {
      let inputElement = null
      
      // Try multiple selectors to find the phone input field
      inputElement = document.querySelector(`input[name="${fieldName}"]`)
      
      if (!inputElement) {
        inputElement = document.querySelector(`[data-name="${fieldName}"] input`)
      }
      
      if (!inputElement) {
        inputElement = document.querySelector(`[data-fieldname="${fieldName}"] input`)
      }
      
      if (inputElement) {
        // Clear ALL existing validation messages for this field - search more broadly
        const fieldContainer = inputElement.closest('.field') || inputElement.parentNode
        if (fieldContainer) {
          // Remove all error messages within the field container
          const existingMessages = fieldContainer.querySelectorAll('.phone-error-message')
          existingMessages?.forEach(msg => msg.remove())
          
          // Also search in parent containers to catch any messages that might have been appended elsewhere
          const parentField = fieldContainer.parentNode
          if (parentField) {
            const parentMessages = parentField.querySelectorAll('.phone-error-message')
            parentMessages?.forEach(msg => msg.remove())
          }
          
          // Search in the entire form/document for any orphaned messages with this field name
          const allMessages = document.querySelectorAll('.phone-error-message')
          allMessages?.forEach(msg => {
            if (msg.textContent.includes(fieldName) || msg.textContent.includes(message)) {
              msg.remove()
            }
          })
        }
        
        // Remove error styling
        inputElement.classList.remove('border-red-500', 'border-red-300')
        inputElement.classList.add('border-gray-300')
        
        if (!isValid && message) {
          // Add error styling
          inputElement.classList.remove('border-gray-300')
          inputElement.classList.add('border-red-500')
          
          // Create and show error message
          const errorMessage = document.createElement('div')
          errorMessage.className = 'phone-error-message text-red-500 text-sm mt-1'
          errorMessage.textContent = message
          errorMessage.setAttribute('data-field', fieldName) // Add data attribute for easier identification
          
          // Insert after the input field
          const fieldContainer = inputElement.closest('.field') || inputElement.parentNode
          if (fieldContainer) {
            fieldContainer.appendChild(errorMessage)
          }
        }
      }
    })
  }

  // Validation functions matching backend implementation
  function validateCnicFormat(cnic, identificationType) {
    if (!cnic) return false
    
    // Use the same regex patterns as backend
    if (identificationType === 'CNIC') {
      return /^\d{5}-\d{7}-\d{1}$/.test(cnic)
    } else if (identificationType === 'NTN') {
      return /^\d{6}-\d{1}$/.test(cnic)
    } else if (identificationType === 'Passport') {
      return /^\d{9}$/.test(cnic)
    }
    
    return false
  }

  // Function to reapply all masks
  async function reapplyAllMasks(identificationType, country, setFieldValue) {
    setTimeout(() => {
      applyCnicMaskToInput('cnic', identificationType, setFieldValue)
    }, 100)
    
    setTimeout(async () => {
      await applyPhoneMasksForCountry(country, setFieldValue)
    }, 200)
  }

  return {
    // State
    showCnicExistsDialog,
    cnicExistsMessage,
    showCnicValidationDialog,
    cnicValidationMessage,
    
    // CNIC functions
    formatCnic,
    formatNtn,
    formatPassport,
    getMaskPattern,
    applyCnicMaskToInput,
    validateCnicFormat,
    
    // Phone functions
    getCountryPhoneMask,
    applyPhoneMaskToInput,
    applyPhoneMasksForCountry,
    validatePhoneNumber,
    showPhoneValidationFeedback,
    
    // Utility functions
    findInputField,
    reapplyAllMasks
  }
} 