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
        if (inputElement._afghanistanHandler) {
          inputElement.removeEventListener('input', inputElement._afghanistanHandler)
          inputElement._afghanistanHandler = null
        }
        if (inputElement._afghanistanKeydownHandler) {
          inputElement.removeEventListener('keydown', inputElement._afghanistanKeydownHandler)
          inputElement._afghanistanKeydownHandler = null
        }
        if (inputElement._afghanistanPasteHandler) {
          inputElement.removeEventListener('paste', inputElement._afghanistanPasteHandler)
          inputElement._afghanistanPasteHandler = null
        }
        if (inputElement._otherCountryHandler) {
          inputElement.removeEventListener('input', inputElement._otherCountryHandler)
          inputElement._otherCountryHandler = null
        }
        if (inputElement._otherCountryKeydownHandler) {
          inputElement.removeEventListener('keydown', inputElement._otherCountryKeydownHandler)
          inputElement._otherCountryKeydownHandler = null
        }
        if (inputElement._otherCountryPasteHandler) {
          inputElement.removeEventListener('paste', inputElement._otherCountryPasteHandler)
          inputElement._otherCountryPasteHandler = null
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
            
          } else if (country === 'Afghanistan' || country === 'afghanistan') {
            // Afghanistan - transform first 2 digits to 93 immediately when user starts typing
            const dialCode = countryMask?.dialCode || '93'
            const phoneMask = countryMask?.phoneMask || ''
            
            // Backend concatenates dialCode + phoneMask, so we do the same
            const fullMask = dialCode + phoneMask
            
            // Calculate required digits from the full mask
            const requiredDigits = fullMask ? fullMask.replace(/\D/g, '').length : 0
            
            // Set placeholder based on full mask (like backend)
            if (fullMask) {
              inputElement.placeholder = fullMask
          } else {
              inputElement.placeholder = '93-XXXXXXX'
            }

            // Also enforce a hard max length at the input element level for mobile keyboards
            const hardLimit = requiredDigits > 0 ? requiredDigits : 10
            inputElement.setAttribute('maxlength', String(hardLimit + Math.max(0, (fullMask.match(/[^0-9]/g) || []).length)))
            
            // Handle existing value - remove 92 prefix if switching from Pakistan
            if (inputElement.value && inputElement.value.startsWith('92')) {
              inputElement.value = inputElement.value.slice(2)
            }
            
            // Add input handler for Afghanistan - transform first 2 digits to 93 immediately
            inputElement._afghanistanHandler = (e) => {
              let value = e.target.value
              let cleanValue = value.replace(/\D/g, '')

              // Enforce length on input for mobile (keydown may not fire on soft keyboards)
              const limit = requiredDigits > 0 ? requiredDigits : 10
              if (cleanValue.length > limit) {
                cleanValue = cleanValue.slice(0, limit)
              }
              
              // Transform first 2 digits to 93 immediately when user starts typing
              if (cleanValue.length >= 2 && !cleanValue.startsWith('93')) {
                // Transform first 2 digits to 93 and keep the rest exactly as entered
                const remainingDigits = cleanValue.slice(2)
                const transformedValue = '93' + remainingDigits
                
                // Simple formatting: 93-XXXXXXX (no mask transformation)
                if (remainingDigits.length > 0) {
                  e.target.value = `93-${remainingDigits}`
                  value = `93-${remainingDigits}`
                } else {
                  e.target.value = '93'
                  value = '93'
                }
              } else if (cleanValue.startsWith('93')) {
                // Already starts with 93, format normally without mask transformation
                if (cleanValue.length > 2) {
                  e.target.value = `93-${cleanValue.slice(2)}`
                  value = e.target.value
                } else {
                  e.target.value = cleanValue
                  value = cleanValue
                }
              } else {
                // While typing, just format normally without transformation
                if (cleanValue.length > 2) {
                  e.target.value = `${cleanValue.slice(0, 2)}-${cleanValue.slice(2)}`
                  value = e.target.value
                } else {
                  e.target.value = cleanValue
                  value = cleanValue
                }
              }
              
              // Store the formatted value
              if (setFieldValue) {
                setFieldValue(fieldName, value)
              }
            }
            inputElement.addEventListener('input', inputElement._afghanistanHandler)
            
            // Add keydown handler with strict digit limit
            inputElement._afghanistanKeydownHandler = (e) => {
              const currentValue = e.target.value.replace(/\D/g, '')
              
              // Allow navigation keys always
              if ([8, 9, 27, 37, 38, 39, 40, 46].includes(e.keyCode)) {
                return true
              }
              
              // If we have a full mask, enforce the exact digit count
              if (fullMask && requiredDigits > 0) {
                if (currentValue.length >= requiredDigits) {
                  e.preventDefault()
                  return false
                }
              } else {
                // Fallback limit for Afghanistan
                if (currentValue.length > 10) {
                  e.preventDefault()
                  return false
                }
              }
            }
            inputElement.addEventListener('keydown', inputElement._afghanistanKeydownHandler)
            
            // Add paste handler for Afghanistan
            inputElement._afghanistanPasteHandler = (e) => {
              let paste = (e.originalEvent || e).clipboardData.getData('text')
              paste = paste.replace(/\D/g, '')
              
              // Transform first 2 digits to 93 immediately if not already
              if (paste.length >= 2 && !paste.startsWith('93')) {
                const remainingDigits = paste.slice(2)
                paste = '93' + remainingDigits
              }
              
              // Simple formatting without mask transformation - just limit length
              paste = paste.slice(0, 10) // Afghanistan limit
              
              // Format the pasted value
              if (paste.startsWith('93') && paste.length > 2) {
                e.target.value = `93-${paste.slice(2)}`
              } else {
                e.target.value = paste
              }
              
              // Store the value
              if (setFieldValue) {
                setFieldValue(fieldName, paste)
              }
              
              e.preventDefault()
            }
            inputElement.addEventListener('paste', inputElement._afghanistanPasteHandler)
          } else {
            // Other countries - use backend mask exactly as configured
            const dialCode = countryMask?.dialCode || ''
            const phoneMask = countryMask?.phoneMask || ''
            
            // Backend concatenates dialCode + phoneMask, so we do the same
            const fullMask = dialCode + phoneMask
            
            // Calculate required digits from the full mask
            const requiredDigits = fullMask ? fullMask.replace(/\D/g, '').length : 0
            
            // Set placeholder based on full mask (like backend)
            if (fullMask) {
              inputElement.placeholder = fullMask
            } else {
              inputElement.placeholder = 'Enter phone number'
            }
            
            if (inputElement.value && inputElement.value.startsWith('92')) {
              inputElement.value = inputElement.value.slice(2)
            }
            
            inputElement._otherCountryHandler = (e) => {
              let value = e.target.value
              const cleanValue = value.replace(/\D/g, '')
              
              if (fullMask && requiredDigits > 0) {
                if (cleanValue.length > requiredDigits) {
                  value = cleanValue.slice(0, requiredDigits)
                  e.target.value = value
                }
                
                if (cleanValue.length === requiredDigits) {
                  let formattedValue = fullMask
                  let digitIndex = 0
                  
                  for (let i = 0; i < fullMask.length && digitIndex < cleanValue.length; i++) {
                    if (fullMask[i] === '9' || fullMask[i] === '0') {
                      formattedValue = formattedValue.slice(0, i) + cleanValue[digitIndex] + formattedValue.slice(i + 1)
                      digitIndex++
                    }
                  }
                  
                  e.target.value = formattedValue
                  value = formattedValue
                }
              }
              
              if (setFieldValue) {
                setFieldValue(fieldName, value)
              }
            }
            inputElement.addEventListener('input', inputElement._otherCountryHandler)
            
            inputElement._otherCountryKeydownHandler = (e) => {
              const currentValue = e.target.value.replace(/\D/g, '')
              
              if ([8, 9, 27, 37, 38, 39, 40, 46].includes(e.keyCode)) {
                return true
              }
              
              if (fullMask && requiredDigits > 0) {
                if (currentValue.length >= requiredDigits) {
                e.preventDefault()
                return false
                }
              } else {
                if (currentValue.length > 15) {
                  e.preventDefault()
                  return false
                }
              }
            }
            inputElement.addEventListener('keydown', inputElement._otherCountryKeydownHandler)
            
            inputElement._otherCountryPasteHandler = (e) => {
              let paste = (e.originalEvent || e).clipboardData.getData('text')
              paste = paste.replace(/\D/g, '')
              
              if (fullMask && requiredDigits > 0) {
                paste = paste.slice(0, requiredDigits)
              } else {
                paste = paste.slice(0, 15) 
              }
              
              e.target.value = paste
              
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

  async function applyPhoneMasksForCountry(country, setFieldValue, fieldFilter = null) {
    if (!country) return
    
    await new Promise(resolve => setTimeout(resolve, 500))
    
    let fields = ['contact_no', 'co_contact_no', 'company_contact_number', 'organization_contact_person', 'representative_mobile', 'phone_no', 'mobile_no', 'org_representative_contact_number', 'org_contact', 'company_ownerceo_conatct', 'custom_company_ownerceo_conatct', 'custom_representative_mobile', 'custom_phone_no', 'custom_org_contact', 'custom_org_representative_contact_number']
    
    if (fieldFilter && Array.isArray(fieldFilter)) {
      fields = fields.filter(field => fieldFilter.includes(field))
    }
    
    for (const fieldName of fields) {
      const inputElement = findInputField(fieldName)
      if (inputElement) {
        await applyPhoneMaskToInput(fieldName, country, setFieldValue)
      }
    }
  }

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
        if (!phoneNumber) {
          return { isValid: true, message: '' }
        }
        
        const cleanPhone = phoneNumber.replace(/\D/g, '')
        
        if (cleanPhone.startsWith('92')) {
          const after92 = cleanPhone.substring(2)
          if (after92.length !== 10) {
            return {
              isValid: false,
              message: 'Pakistan phone number must be 10 digits after country code (92).'
            }
          }
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
          return { isValid: true, message: '' }
        } else {
          return {
            isValid: false,
            message: 'Pakistan phone number must be 10 digits and start with valid mobile prefix (30-39).'
          }
        }
      } else if (country === 'Algeria') {
        const dialCode = countryMask.dialCode || '213'
        const phoneMask = countryMask.phoneMask || '11097'
        
        const fullMask = dialCode + phoneMask
        
        const requiredDigits = phoneMask ? phoneMask.replace(/\D/g, '').length : 0
        
        if (!phoneNumber) {
          return {
            isValid: false,
            message: `Algeria phone number is required. Expected format: ${fullMask}`
          }
        }
        
        let phoneToValidate = phoneNumber
        if (phoneNumber.startsWith('+')) {
          phoneToValidate = phoneNumber.slice(1)
        }
        
        if (!phoneToValidate.startsWith(dialCode)) {
          return {
            isValid: false,
            message: `Algeria phone number must be correctly formatted. Expected format: ${fullMask}`
          }
        }
        
        const numberWithoutCode = phoneToValidate.slice(dialCode.length)
        const cleanNumber = numberWithoutCode.replace(/\D/g, '')
        
        if (cleanNumber.length !== requiredDigits) {
          return {
            isValid: false,
            message: `Algeria phone number must be exactly ${requiredDigits} digits after country code. Expected format: ${fullMask}`
          }
        }
        
        return { isValid: true, message: '' }
      } else {
        if (!phoneNumber) {
          return { isValid: true, message: '' } 
        }
        
        const cleanNumber = phoneNumber.replace(/\D/g, '')
        const dialCode = countryMask.dialCode || ''
        const phoneMask = countryMask.phoneMask || ''
        
        const fullMask = dialCode + phoneMask
        const requiredDigits = fullMask ? fullMask.replace(/\D/g, '').length : 0
        
        if (fullMask && requiredDigits > 0) {
          if (cleanNumber.length !== requiredDigits) {
            return {
              isValid: false,
              message: `${country} phone number must be exactly ${requiredDigits} digits. Expected format: ${fullMask}`
            }
          }
          
          let isValidFormat = true
          let digitIndex = 0
          
          for (let i = 0; i < fullMask.length; i++) {
            if (fullMask[i] === '9' || fullMask[i] === '0') {
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
              message: `${country} phone number format is invalid. Expected format: ${fullMask}`
            }
          }
          
          return { isValid: true, message: '' }
        } else {
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

  function showPhoneValidationFeedback(fieldName, isValid, message) {
    nextTick(() => {
      let inputElement = null
      
      inputElement = document.querySelector(`input[name="${fieldName}"]`)
      
      if (!inputElement) {
        inputElement = document.querySelector(`[data-name="${fieldName}"] input`)
      }
      
      if (!inputElement) {
        inputElement = document.querySelector(`[data-fieldname="${fieldName}"] input`)
      }
      
      if (!inputElement) {
        const labels = document.querySelectorAll('label, .text-sm')
        for (let label of labels) {
          if (label.textContent.includes('Contact No') || label.textContent.includes('Contact Number')) {
            const fieldContainer = label.closest('.field')
            if (fieldContainer) {
              inputElement = fieldContainer.querySelector('input')
              if (inputElement) break
            }
          }
        }
      }
      
      if (inputElement) {
        const fieldContainer = inputElement.closest('.field') || inputElement.parentNode
        if (fieldContainer) {
          const existingMessages = fieldContainer.querySelectorAll('.phone-error-message')
        existingMessages?.forEach(msg => msg.remove())
          
          const parentContainer = fieldContainer.parentNode
          if (parentContainer) {
            const parentMessages = parentContainer.querySelectorAll('.phone-error-message')
            parentMessages?.forEach(msg => msg.remove())
          }
        }
        
        inputElement.classList.remove('border-red-500', 'border-red-300')
        inputElement.classList.add('border-gray-300')
        
        if (isValid) {
          const allErrorMessages = document.querySelectorAll('.phone-error-message')
          allErrorMessages?.forEach(msg => {
            if (msg.getAttribute('data-field') === fieldName) {
              msg.remove()
            }
          })
        }
        
        if (!isValid && message) {
          const existingError = fieldContainer?.querySelector(`.phone-error-message[data-field="${fieldName}"]`)
          if (existingError) {
            existingError.textContent = message
          } else {
          inputElement.classList.remove('border-gray-300')
          inputElement.classList.add('border-red-500')
          
          const errorMessage = document.createElement('div')
          errorMessage.className = 'phone-error-message text-red-500 text-sm mt-1'
          errorMessage.textContent = message
            errorMessage.setAttribute('data-field', fieldName) 
          
          if (fieldContainer) {
            fieldContainer.appendChild(errorMessage)
          }
        }
        }
      } else {
        const allErrorMessages = document.querySelectorAll('.phone-error-message')
        allErrorMessages?.forEach(msg => {
          if (msg.getAttribute('data-field') === fieldName) {
            msg.remove()
          }
        })
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