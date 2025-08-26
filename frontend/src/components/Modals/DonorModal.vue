<template>
  <!-- Parent Modal -->
  <Dialog v-model="controlledShow" :options="{ size: '4xl' }" :disableOutsideClickToClose="true" :disableEscToClose="hasActiveSubModals" :zIndex="hasActiveSubModals ? 1000 : 100" :backdrop="hasActiveSubModals ? 'static' : true" :persistent="true" data-modal="parent">
    <template #body>
      <AppStyling type="donor-modal-background">
      <AppStyling type="modal-styling" modalType="header" >
        <div class="mb-5 flex items-center justify-between" >
          <h3 class="text-2xl font-semibold text-ink-gray-9">
            {{ __('Create Donor') }}
          </h3>
          <div class="flex items-center gap-1">
            <Button
              v-if="isManager() && !isMobileView"
              variant="ghost"
              class="w-7"
              @click="openQuickEntryModal"
            >
              <template #icon>
                <FeatherIcon name="edit" class="size-4" />
              </template>
            </Button>
            <Button variant="ghost" class="w-7" @click="handleCloseButton">
              <template #icon>
                <FeatherIcon name="x" class="size-4" /> 
              </template>
            </Button>
          </div>
        </div>
        <div>
          <div class="field-layout-wrapper">
            <FieldLayout 
              v-if="tabs.data" 
              :tabs="tabs.data" 
              :data="donor.doc" 
              :doctype="'Donor'" 
              @open-create-modal="openCreateModal"
              @tab-change="handleTabChange"
              @field-change="onFieldChange"
            />
          </div>
          <ErrorMessage class="mt-4" v-if="error" :message="__(error)" />
        </div>
      </AppStyling>
      <AppStyling type="modal-styling" modalType="footer">
        <div class="flex flex-row-reverse gap-2">
          <AppStyling
            type="button"
            buttonType="create"
            buttonLabel="Create"
            :buttonLoading="isDonorCreating"
            @click="createNewDonor"
          />
        </div>
      </AppStyling>
      </AppStyling>
    </template>
  </Dialog>

  <!-- Quick Entry Modal - Layout Editor -->
  <QuickEntryModal
    v-model="showQuickEntryModal"
    :doctype="'Donor'"
    @close="onQuickEntryClose"
    @reset="onQuickEntryReset"
    @saved="onQuickEntrySaved"
  />

  <template v-for="(modal, idx) in modalStack" :key="idx">
    <CreateDocumentModal
      v-model="modal.visible"
      :doctype="modal.doctype"
      :data="{ name: modal.initialValue }"
      @callback="(doc) => handleModalSuccess(idx, doc)"
      @close="() => handleModalClose(idx)"
      @open-create-modal="openCreateModal"
      @subModalActive="() => ensureParentModalVisible(idx)"
      @subModalInteraction="() => { handleSubModalInteraction(); manageParentModalState(); }"
      :isSubModal="true"
    />
  </template>

  <!-- CNIC Exists Dialog -->
  <Dialog v-model="showCnicExistsDialog" :options="{ size: 'sm' }" :disableOutsideClickToClose="true" :disableEscToClose="true">
    <template #body>
      <div class="p-6 text-center">
        <div class="text-lg font-semibold text-red-600 mb-2">{{ cnicExistsMessage }}</div>
        <Button variant="solid" @click="closeErrorDialog">OK</Button>
      </div>
    </template>
  </Dialog>

  <!-- CNIC Validation Error Dialog -->
  <Dialog v-model="showCnicValidationDialog" :options="{ size: 'sm' }" :disableOutsideClickToClose="true" :disableEscToClose="true">
    <template #body>
      <div class="p-6 text-center">
        <div class="text-lg font-semibold text-red-600 mb-2">{{ cnicValidationMessage }}</div>
        <Button variant="solid" @click="closeCnicValidationDialog">OK</Button>
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
import { useDonorFieldValidation } from '@/composables/useDonorFieldValidation'
import { useRouter } from 'vue-router'
import { createResource, createListResource, call, Dialog, Button, ErrorMessage, toast } from 'frappe-ui'
import FeatherIcon from '@/components/Icons/FeatherIcon.vue'
import QuickEntryModal from '@/components/Modals/QuickEntryModal.vue'
import FieldLayout from '@/components/FieldLayout/FieldLayout.vue'
import { usersStore } from '@/stores/users'
import { sessionStore } from '@/stores/session'
import CreateDocumentModal from '@/components/Modals/CreateDocumentModal.vue'
import { showQuickEntryModal, quickEntryProps } from '@/composables/modals'
import { nextTick } from 'vue'
import { isMobileView } from '@/composables/settings'
import { useDocument } from '@/data/document'
import { useInputMask } from '@/composables/useInputMask'
import AppStyling from '@/components/AppStyling.vue'

const props = defineProps({
  defaults: Object,
  options: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['donor-created', 'donor-deleted'])

const show = defineModel()

// Create a computed property to control the show value
const controlledShow = computed({
  get() {
    return show.value
  },
  set(value) {
    // Prevent closing when sub-modals are active
    if (!value && hasActiveSubModals.value) {
      return // Don't allow closing
    }
    show.value = value
  }
})
const router = useRouter()
const error = ref(null)
const isDonorCreating = ref(false)

// Initialize donor field validation composable
const {
  showCnicExistsDialog,
  cnicExistsMessage,
  showCnicValidationDialog,
  cnicValidationMessage,
  formatCnic,
  formatNtn,
  formatPassport,
  getMaskPattern,
  applyCnicMaskToInput,
  validateCnicFormat,
  getCountryPhoneMask,
  applyPhoneMaskToInput,
  applyPhoneMasksForCountry,
  validatePhoneNumber,
  showPhoneValidationFeedback,
  findInputField,
  reapplyAllMasks
} = useDonorFieldValidation()

const modalStack = ref([]) 

const hasActiveSubModals = computed(() => {
  return modalStack.value.length > 0 && modalStack.value.some(modal => modal.visible)
})



function openQuickEntryModal() {
  const currentDoctype = modalStack.value.length > 0 ? modalStack.value[modalStack.value.length - 1].doctype : 'Donor'
  showQuickEntryModal.value = true
  quickEntryProps.value = { doctype: currentDoctype }
  nextTick(() => {
    show.value = false
  })
}

const { document: donor, triggerOnBeforeCreate } = useDocument('Donor')

// Function to reset donor form data
function resetDonorForm() {
  // Reset to default values
  donor.doc = {
    status: 'Active',
    identification_type: 'CNIC',
    identification_value: '99999-9999999-9',
    donor_identity: 'Known',
    country: 'Pakistan',
    contact_numbers: [{
      phone: '',
      is_primary_phone: false,
      is_primary_mobile_no: false
    }],
    email_ids: [{
      email_id: '',
      is_primary: false
    }]
  }
  
  // Set owner_id if user is available
  if (user.value) {
    donor.doc.owner_id = user.value
  }
  
  // Clear donor desk resource data
  donorDeskResource.data = []
}



const donorDeskResource = createListResource({
  doctype: 'Donor Desk',
  filters: computed(() => {
    const department = donor.doc?.department
    return department ? { department } : {}
  }),
  fields: ['name', 'desk_name', 'department'],
  auto: false
})

const donorDeskOptions = computed(() => {
  if (!donor.doc?.department) {
    return []
  }
  
  if (!donorDeskResource.data) {
    return []
  }
  
  if (donorDeskResource.data.length === 0) {
    return []
  }
  
  return donorDeskResource.data.map(desk => ({
    label: desk.desk_name || desk.name,
    value: desk.name
  }))
})


const onFieldChange = (fieldname, value) => {
  if (fieldname === 'department') {
    donor.doc.donor_desk = ''
    if (value) {
      donorDeskResource.reload()
    }
  }
}





const { getUser, isManager } = usersStore()
const { user } = sessionStore()

const tabs = createResource({
  url: 'crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_fields_layout',
  cache: ['QuickEntryModal', 'Donor', false], 
  params: { doctype: 'Donor', type: 'Quick Entry' },
  auto: true,
  transform: (_tabs) => {
    return _tabs.forEach((tab) => {
      tab.sections.forEach((section) => {
        section.columns.forEach((column) => {
          column.fields.forEach((field) => {
            if (typeof field === 'object' && field !== null) {
            if (field.fieldtype === 'Table') {
              donor.doc[field.fieldname] = []
            }
            
            // Make owner_id field readonly
            if (field.fieldname === 'owner_id') {
              field.read_only = true
              if (!donor.doc.owner_id) {
                donor.doc.owner_id = user.value || ''
              }
            }
            
              // if (field.fieldname === 'status') {
              //   field.read_only = true
              //   field.tooltip = 'This field is read only and cannot be edited.'
              //   field.hidden = false
              // }
              
              field.hidden = false
              if (field.read_only !== true) {
                field.read_only = false
              }
            }
          })
        })
      })
    })
  },
  onSuccess(data) {
    if (!donor.doc.contact_numbers || donor.doc.contact_numbers.length === 0) {
      donor.doc.contact_numbers = [{
      phone: '',
      is_primary_phone: false,
      is_primary_mobile_no: false
    }]
  }
  
    if (!donor.doc.email_ids || donor.doc.email_ids.length === 0) {
      donor.doc.email_ids = [{
      email_id: '',
      is_primary: false
    }]
  }
  
    if (!donor.doc.country) {
      donor.doc.country = 'Pakistan'
    }
    
    // Ensure owner_id field is always present and visible
    if (data && data.length > 0) {
      let ownerIdFieldExists = false
      data.forEach(tab => {
        tab.sections.forEach(section => {
          section.columns.forEach(column => {
            column.fields.forEach(field => {
              if (typeof field === 'object' && field !== null) {
              if (field.fieldname === 'owner_id') {
                ownerIdFieldExists = true
              }
              
              if (field.fieldname === 'donor_desk') {
                  field.options = 'Donor Desk'
                field.get_query = () => {
                    donorDeskResource.reload()
                    return {
                      doctype: 'Donor Desk',
                      filters: donor.doc?.department ? { department: donor.doc.department } : {}
                    }
                  }
                  field.data = computed(() => donorDeskOptions.value)
                  // Keep fieldtype as Select but handle empty options gracefully
                  field.fieldtype = 'Select'
                  field.options = computed(() => {
                    if (!donor.doc?.department || (donorDeskResource.data && donorDeskResource.data.length === 0)) {
                      return []
                    }
                    return donorDeskOptions.value
                  })
                  field.placeholder = computed(() => {
                    if (!donor.doc?.department) {
                      return 'Please select a department first'
                    }
                    if (donorDeskResource.data && donorDeskResource.data.length === 0) {
                      return 'No donor desks available'
                    }
                    return 'Select Donor Desk'
                  })
                  field.description = computed(() => {
                    if (!donor.doc?.department) {
                      return 'Please select a department to see available donor desks'
                    }
                    if (donorDeskResource.data && donorDeskResource.data.length === 0) {
                      return 'No donor desks found for the selected department'
                    }
                    return ''
                  })
                  field.read_only = computed(() => {
                    if (!donor.doc?.department || (donorDeskResource.data && donorDeskResource.data.length === 0)) {
                      return true
                    }
                    return false
                  })
                  field.hidden = false
                  if (!donor.doc[field.fieldname]) {
                    donor.doc[field.fieldname] = ''
                  }
                }
                
                field.hidden = false
                if (field.read_only !== true) {
                field.read_only = false
                }
              }
            })
          })
        })
      })
    }
  }
})

defineExpose({
  donorDeskResource,
  onFieldChange,
  reloadDonorDeskData: () => donorDeskResource.reload()
})

watch(() => donor.doc.department, (newDepartment, oldDepartment) => {
  if (newDepartment !== oldDepartment) {
    donor.doc.donor_desk = ''
    if (newDepartment) {
      donorDeskResource.reload()
    }
  }
})

watch(() => donorDeskOptions.value, (newOptions) => {
  if (!newOptions || newOptions.length === 0) {
    donor.doc.donor_desk = ''
  }
})

watch(() => donorDeskResource.data, (newData) => {
  if (newData && tabs.data) {
    tabs.data.forEach(tab => {
      tab.sections.forEach(section => {
        section.columns.forEach(column => {
          column.fields.forEach(field => {
            if (field.fieldname === 'donor_desk') {
              field.fieldtype = 'Select'
              field.options = computed(() => {
                if (!donor.doc?.department || (donorDeskResource.data && donorDeskResource.data.length === 0)) {
                  return []
                }
                return donorDeskOptions.value
              })
              field.placeholder = computed(() => {
                if (!donor.doc?.department) {
                  return 'Please select a department first'
                }
                if (donorDeskResource.data && donorDeskResource.data.length === 0) {
                  return 'No donor desks available'
                }
                return 'Select Donor Desk'
              })
              field.description = computed(() => {
                if (!donor.doc?.department) {
                  return 'Please select a department to see available donor desks'
                }
                if (donorDeskResource.data && donorDeskResource.data.length === 0) {
                  return 'No donor desks found for the selected department'
                }
                return ''
              })
              field.read_only = computed(() => {
                if (!donor.doc?.department || (donorDeskResource.data && donorDeskResource.data.length === 0)) {
                  return true
                }
                return false
              })
              field.hidden = false
              if (!donor.doc[field.fieldname]) {
                donor.doc[field.fieldname] = ''
              }
            }
          })
        })
      })
    })
  }
}, { deep: true })

const createDonor = createResource({
  url: 'crm.fcrm.doctype.donor.api.create_donor',
  makeParams(values) {
    const { citytown, stateprovince, address_type, address_line_1, address_line_2, ...filteredValues } = values
    
    return {
      doc: {
        doctype: 'Donor',
        ...filteredValues,
      },
    }
  },
})

watch(show, async (val) => {
  if (val && user.value) {
    resetDonorForm()
    
    if (donor.doc.department) {
      donorDeskResource.reload()
    }
    
    setTimeout(() => {
      applyCnicMaskToInput('cnic', donor.doc.identification_type, setFieldValue)
    }, 500)
    
    setTimeout(async () => {
      await applyPhoneMasksForCountry(donor.doc.country, setFieldValue)
    }, 1000)
    
        setTimeout(() => {
          if (tabs.data) {
            tabs.data.forEach(tab => {
              tab.sections.forEach(section => {
                section.columns.forEach(column => {
                  column.fields.forEach(field => {
                    if (field.fieldname === 'donor_desk') {
                      field.options = 'Donor Desk'
                      field.get_query = () => {
                        donorDeskResource.reload()
                        return {
                          doctype: 'Donor Desk',
                          filters: donor.doc?.department ? { department: donor.doc.department } : {}
                        }
                      }
                      field.data = computed(() => donorDeskOptions.value)
                      field.fieldtype = 'Select'
                      // Use the computed options directly instead of converting to string
                      field.options = computed(() => {
                        if (!donor.doc?.department || (donorDeskResource.data && donorDeskResource.data.length === 0)) {
                          return []
                        }
                        return donorDeskOptions.value
                      })
                      // Keep fieldtype as Select but handle empty options gracefully
                      field.fieldtype = 'Select'
                      // Set placeholder based on department selection
                      field.placeholder = computed(() => {
                        if (!donor.doc?.department) {
                          return 'Please select a department first'
                        }
                        // If department is selected but no donor desks available, show appropriate message
                        if (donorDeskResource.data && donorDeskResource.data.length === 0) {
                          return 'No donor desks available'
                        }
                        return 'Select Donor Desk'
                      })
                      // Set description to show helper text when no department is selected
                      field.description = computed(() => {
                        if (!donor.doc?.department) {
                          return 'Please select a department to see available donor desks'
                        }
                        // Show "No records found" message in description when department has no donor desks
                        if (donorDeskResource.data && donorDeskResource.data.length === 0) {
                          return 'No donor desks found for the selected department'
                        }
                        return ''
                      })
                      // Set read_only based on availability of options
                      field.read_only = computed(() => {
                        if (!donor.doc?.department || (donorDeskResource.data && donorDeskResource.data.length === 0)) {
                          return true
                        }
                        return false
                      })
                      // Ensure field is always visible
                      field.hidden = false
                      // Ensure field always has a value to prevent hiding
                      if (!donor.doc[field.fieldname]) {
                        donor.doc[field.fieldname] = ''
                      }
                    }
                  })
                })
              })
            })
          }
        }, 1500)
  }
  
  // Prevent parent modal from closing when sub-modals are active
  if (!val && hasActiveSubModals.value) {
    show.value = true
  }
})

// Reset form when modal is closed
watch(() => show.value, (newVal, oldVal) => {
  if (oldVal === true && newVal === false) {
    // Modal was closed, reset form data
    resetDonorForm()
  }
})

// Add a more aggressive watcher to prevent modal from closing
watch(() => show.value, (newVal, oldVal) => {
  if (oldVal === true && newVal === false && hasActiveSubModals.value) {
    // Force the modal to stay open
    nextTick(() => {
      show.value = true
    })
  }
}, { immediate: true })



// Ensure parent modal stays visible when sub-modal becomes active
const ensureParentModalVisible = (modalIdx) => {
  if (!show.value) {
    show.value = true
  }
}

// Handle close button click
const handleCloseButton = () => {
  if (hasActiveSubModals.value) {
    // Don't allow closing when sub-modals are active
    return
  }
  show.value = false
  // Reset form data when modal is manually closed
  resetDonorForm()
}









// Watch for modal stack changes to ensure parent modal stays visible
watch(modalStack, (newStack) => {
  if (hasActiveSubModals.value && !show.value) {
    show.value = true
  }
}, { deep: true })

// Watch for individual modal visibility changes
watch(hasActiveSubModals, (hasActive) => {
  if (hasActive && !show.value) {
    show.value = true
  }
})

// Watch for any changes in modal stack to ensure parent stays visible
watch(() => modalStack.value.length, (newLength) => {
  if (newLength > 0 && !show.value) {
    show.value = true
  }
})

// Watch for any visible modal changes
watch(() => modalStack.value.filter(m => m.visible).length, (visibleCount) => {
  if (visibleCount > 0 && !show.value) {
    show.value = true
  }
})







watch(
  () => donor.doc.foa,
  async (newFoa) => {
    // Update CNIC field required status when foa changes
    setTimeout(() => {
      applyCnicMaskToInput('cnic', donor.doc.identification_type, setFieldValue)
    }, 100)
    
    // Apply phone masks when FOA changes (affects co_contact_no visibility)
    setTimeout(async () => {
      await applyPhoneMasksForCountry(donor.doc.country, setFieldValue)
    }, 400)
  }
)

// Helper function for phone field validation with debouncing
const validationTimeouts = new Map()

// Function to clear all phone field error messages
function clearAllPhoneFieldErrors() {
  const allErrorMessages = document.querySelectorAll('.phone-error-message')
  allErrorMessages?.forEach(msg => msg.remove())
  
  // Also clear error styling from all phone inputs
  const phoneFields = ['contact_no', 'co_contact_no', 'company_contact_number', 'organization_contact_person', 'org_representative_contact_number', 'org_contact', 'representative_mobile', 'mobile_no', 'phone_no']
  phoneFields.forEach(fieldName => {
    const inputElement = findInputField(fieldName)
    if (inputElement) {
      inputElement.classList.remove('border-red-500', 'border-red-300')
      inputElement.classList.add('border-gray-300')
    }
  })
}

// Function to clear error message for a specific field
function clearPhoneFieldError(fieldName) {
  const allErrorMessages = document.querySelectorAll('.phone-error-message')
  allErrorMessages?.forEach(msg => {
    if (msg.getAttribute('data-field') === fieldName) {
      msg.remove()
    }
  })
  
  // Also clear error styling for the specific field
  const inputElement = findInputField(fieldName)
  if (inputElement) {
    inputElement.classList.remove('border-red-500', 'border-red-300')
    inputElement.classList.add('border-gray-300')
  }
}

function createPhoneFieldWatcher(fieldName) {
  return async (newValue) => {
    // Clear any existing timeout for this field
    if (validationTimeouts.has(fieldName)) {
      clearTimeout(validationTimeouts.get(fieldName))
    }
    
        // Debounce validation to prevent multiple rapid calls
    const timeoutId = setTimeout(async () => {
      if (newValue && donor.doc.country) {
        const validation = await validatePhoneNumber(newValue, donor.doc.country)
        if (validation && validation.isValid !== undefined) {
          showPhoneValidationFeedback(fieldName, validation.isValid, validation.message)
        }
      } else if (donor.doc.country && donor.doc.country !== 'Pakistan' && donor.doc.country !== 'pakistan') {
        const validation = await validatePhoneNumber('', donor.doc.country)
        if (validation && validation.isValid !== undefined) {
          showPhoneValidationFeedback(fieldName, validation.isValid, validation.message)
        }
      } else {
        // Clear error message when field is empty or no country selected
        clearPhoneFieldError(fieldName)
      }
      
      // Remove the timeout reference
      validationTimeouts.delete(fieldName)
    }, 300) // 300ms debounce delay
    
    // Store the timeout reference
    validationTimeouts.set(fieldName, timeoutId)
  }
}

// Helper function to set field value based on field name
function setFieldValue(fieldName, value) {
  switch (fieldName) {
    case 'cnic':
      donor.doc.cnic = value
      break
    case 'contact_no':
      donor.doc.contact_no = value
      break
    case 'co_contact_no':
      donor.doc.co_contact_no = value
      break
    case 'company_contact_number':
      donor.doc.company_contact_number = value
      break
    case 'organization_contact_person':
      donor.doc.organization_contact_person = value
      break
    case 'org_representative_contact_number':
      donor.doc.org_representative_contact_number = value
      break
    case 'org_contact':
      donor.doc.org_contact = value
      break
    case 'representative_mobile':
      donor.doc.representative_mobile = value
      break
    case 'mobile_no':
      donor.doc.mobile_no = value
      break
    case 'phone_no':
      donor.doc.phone_no = value
      break
  }
}

// Watch for all phone field changes
const phoneFields = ['contact_no', 'co_contact_no', 'company_contact_number', 'organization_contact_person', 'org_representative_contact_number', 'org_contact', 'representative_mobile', 'mobile_no', 'phone_no']

phoneFields.forEach(fieldName => {
  watch(() => donor.doc[fieldName], createPhoneFieldWatcher(fieldName))
})

// Watch for donor_type changes to reapply phone masks when conditional fields become visible
watch(
  () => donor.doc.donor_type,
  async (newDonorType) => {
    if (newDonorType && donor.doc.country) {
      setTimeout(async () => {
        await applyPhoneMasksForCountry(donor.doc.country, setFieldValue)
      }, 300)
  }
  }
)

// Watch for tab changes and re-apply masks
let currentTabIndex = 0
watch(
  () => tabs.data,
  (newTabs) => {
    if (newTabs && newTabs.length > 0) {
      // Only reapply masks if they're actually missing, not on every tab change
      setTimeout(async () => {
        const cnicInput = findInputField('cnic')
        
        // Only reapply CNIC mask if it's missing
        if (cnicInput && !cnicInput._maskHandler && donor.doc.identification_type) {
          applyCnicMaskToInput('cnic', donor.doc.identification_type, setFieldValue)
        }
        
        // Only reapply phone masks if they're missing
        if (donor.doc.country) {
          await applyPhoneMasksForCountry(donor.doc.country, setFieldValue)
        }
      }, 300)
    }
  },
  { deep: true }
)

// Watch for FieldLayout component changes
watch(
  () => show.value,
  (isVisible) => {
    if (isVisible) {
      // When modal becomes visible, set up additional watchers
      setTimeout(() => {
        // Watch for any changes in the FieldLayout
        const fieldLayout = document.querySelector('.field-layout-wrapper')
        if (fieldLayout) {
          const fieldLayoutObserver = new MutationObserver(() => {
            // Only reapply masks if they're actually missing, not on every DOM change
            setTimeout(() => {
              const cnicInput = findInputField('cnic')
              
              // Only reapply CNIC mask if it's missing
              if (cnicInput && !cnicInput._maskHandler && donor.doc.identification_type) {
                applyCnicMaskToInput('cnic', donor.doc.identification_type, setFieldValue)
              }
              
              // Only reapply phone masks if they're missing
              if (donor.doc.country) {
                applyPhoneMasksForCountry(donor.doc.country, setFieldValue)
              }
            }, 200)
          })
          
          fieldLayoutObserver.observe(fieldLayout, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style']
          })
          
          // Store observer for cleanup
          window.fieldLayoutObserver = fieldLayoutObserver
        }
        
        // Also watch the entire modal content
        const modalContent = document.querySelector('[data-modal="parent"]')
        if (modalContent) {
          const modalObserver = new MutationObserver((mutations) => {
            let hasRelevantChanges = false
            
            mutations.forEach((mutation) => {
              if (mutation.type === 'childList') {
                mutation.addedNodes.forEach((node) => {
                  if (node.nodeType === Node.ELEMENT_NODE) {
                    const element = node
                    if (element.querySelector && (
                      element.querySelector('input') ||
                      element.querySelector('.field') ||
                      element.querySelector('.form-group')
                    )) {
                      hasRelevantChanges = true
                    }
                  }
                })
              }
            })
            
            if (hasRelevantChanges) {
              // Only reapply masks if they're actually missing, not on every DOM change
              setTimeout(() => {
                const cnicInput = findInputField('cnic')
                
                // Only reapply CNIC mask if it's missing
                if (cnicInput && !cnicInput._maskHandler && donor.doc.identification_type) {
                  applyCnicMaskToInput('cnic', donor.doc.identification_type, setFieldValue)
                }
                
                // Only reapply phone masks if they're missing
                if (donor.doc.country) {
                  applyPhoneMasksForCountry(donor.doc.country, setFieldValue)
                }
              }, 200)
            }
          })
          
          modalObserver.observe(modalContent, {
            childList: true,
            subtree: true
          })
          
          window.modalObserver = modalObserver
        }
        
        // Apply phone masks when modal becomes visible
        if (donor.doc.country) {
          setTimeout(async () => {
            await applyPhoneMasksForCountry(donor.doc.country, setFieldValue)
      }, 500)
        }
      }, 300)
    } else {
      // Clean up when modal closes
      if (window.fieldLayoutObserver) {
        window.fieldLayoutObserver.disconnect()
        window.fieldLayoutObserver = null
      }
      if (window.modalObserver) {
        window.modalObserver.disconnect()
        window.modalObserver = null
      }
    }
  }
)

// Watch for DOM changes that might indicate tab switching
let observer = null
let maskCheckInterval = null

// Set up observers and intervals for mask reapplication
const setupObservers = () => {
  observer = new MutationObserver((mutations) => {
    let shouldReapplyMasks = false
    
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node
            if (element.classList && (
              element.classList.contains('field') ||
              element.classList.contains('form-group') ||
              element.querySelector('.field') ||
              element.querySelector('input')
            )) {
              shouldReapplyMasks = true
            }
          }
        })
      }
    })
    
    if (shouldReapplyMasks) {
      setTimeout(async () => {
        // Only reapply masks if they're actually missing, not on every DOM change
        const cnicInput = findInputField('cnic')
        
        // Only reapply CNIC mask if it's missing
        if (cnicInput && !cnicInput._maskHandler && donor.doc.identification_type) {
          applyCnicMaskToInput('cnic', donor.doc.identification_type, setFieldValue)
        }
        
        // Only reapply phone masks if they're missing
        if (donor.doc.country) {
          await applyPhoneMasksForCountry(donor.doc.country, setFieldValue)
        }
      }, 200)
    }
  })
  
  const modalElement = document.querySelector('[data-modal="parent"]')
  if (modalElement) {
    observer.observe(modalElement, {
      childList: true,
      subtree: true
    })
  }
  
  // Set up periodic mask check
  maskCheckInterval = setInterval(() => {
    const cnicInput = findInputField('cnic')
    
    if (cnicInput && !cnicInput._maskHandler && donor.doc.identification_type) {
      applyCnicMaskToInput('cnic', donor.doc.identification_type, setFieldValue)
    }
    
    // Check all phone fields for missing masks
    phoneFields.forEach(fieldName => {
      const inputElement = findInputField(fieldName)
      if (inputElement && !inputElement._pakistanHandler && !inputElement._otherCountryHandler && donor.doc.country) {
        applyPhoneMaskToInput(fieldName, donor.doc.country, setFieldValue)
      }
    })
  }, 5000)
}

onUnmounted(() => {
  if (observer) {
    observer.disconnect()
    observer = null
  }
  
  if (maskCheckInterval) {
    clearInterval(maskCheckInterval)
    maskCheckInterval = null
  }
  
  // Clear all validation timeouts
  validationTimeouts.forEach(timeoutId => clearTimeout(timeoutId))
  validationTimeouts.clear()
})

const countryCurrencyMap = {
  "Afghanistan": "AFN",
  "Albania": "ALL",
  "Algeria": "DZD",
  "Andorra": "EUR",
  "Angola": "AOA",
  "Anguilla": "XCD",
  "Antarctica": "",
  "Antigua and Barbuda": "XCD",
  "Argentina": "ARS",
  "Armenia": "AMD",
  "Aruba": "AWG",
  "Australia": "AUD",
  "Austria": "EUR",
  "Azerbaijan": "AZN",
  "Bahamas": "BSD",
  "Bahrain": "BHD",
  "Bangladesh": "BDT",
  "Barbados": "BBD",
  "Belarus": "BYR",
  "Belgium": "EUR",
  "Belize": "BZD",
  "Benin": "XOF",
  "Bermuda": "BMD",
  "Bhutan": "BTN",
  "Bolivia": "BOB",
  "Bosnia and Herzegovina": "BAM",
  "Botswana": "BWP",
  "Bouvet Island": "NOK",
  "Brazil": "BRL",
  "British Indian Ocean Territory": "USD",
  "Brunei Darussalam": "BND",
  "Bulgaria": "BGN",
  "Burkina Faso": "XOF",
  "Burundi": "BIF",
  "Cambodia": "KHR",
  "Cameroon": "XAF",
  "Canada": "CAD",
  "Cape Verde": "CVE",
  "Cayman Islands": "KYD",
  "Central African Republic": "XAF",
  "Chad": "XAF",
  "Chile": "CLP",
  "China": "CNY",
  "Christmas Island": "AUD",
  "Cocos (Keeling) Islands": "AUD",
  "Colombia": "COP",
  "Comoros": "KMF",
  "Congo (Brazzaville)": "XAF",
  "Congo (Kinshasa)": "CDF",
  "Cook Islands": "NZD",
  "Costa Rica": "CRC",
  "Croatia": "HRK",
  "Cuba": "CUP",
  "Curaçao": "ANG",
  "Cyprus": "EUR",
  "Czech Republic": "CZK",
  "Denmark": "DKK",
  "Djibouti": "DJF",
  "Dominica": "XCD",
  "Dominican Republic": "DOP",
  "Ecuador": "USD",
  "Egypt": "EGP",
  "El Salvador": "USD",
  "Equatorial Guinea": "XAF",
  "Eritrea": "ERN",
  "Estonia": "EUR",
  "Eswatini": "SZL",
  "Ethiopia": "ETB",
  "Falkland Islands": "FKP",
  "Faroe Islands": "DKK",
  "Fiji": "FJD",
  "Finland": "EUR",
  "France": "EUR",
  "French Guiana": "EUR",
  "French Polynesia": "XPF",
  "French Southern Territories": "EUR",
  "Gabon": "XAF",
  "Gambia": "GMD",
  "Georgia": "GEL",
  "Germany": "EUR",
  "Ghana": "GHS",
  "Gibraltar": "GIP",
  "Greece": "EUR",
  "Greenland": "DKK",
  "Grenada": "XCD",
  "Guadeloupe": "EUR",
  "Guam": "USD",
  "Guatemala": "GTQ",
  "Guernsey": "GBP",
  "Guinea": "GNF",
  "Guinea-Bissau": "XOF",
  "Guyana": "GYD",
  "Haiti": "HTG",
  "Heard Island and McDonald Islands": "AUD",
  "Honduras": "HNL",
  "Hong Kong": "HKD",
  "Hungary": "HUF",
  "Iceland": "ISK",
  "India": "INR",
  "Indonesia": "IDR",
  "Iran": "IRR",
  "Iraq": "IQD",
  "Ireland": "EUR",
  "Isle of Man": "GBP",
  "Israel": "ILS",
  "Italy": "EUR",
  "Jamaica": "JMD",
  "Japan": "JPY",
  "Jersey": "GBP",
  "Jordan": "JOD",
  "Kazakhstan": "KZT",
  "Kenya": "KES",
  "Kiribati": "AUD",
  "Korea (North)": "KPW",
  "Korea (South)": "KRW",
  "Kosovo": "EUR",
  "Kuwait": "KWD",
  "Kyrgyzstan": "KGS",
  "Laos": "LAK",
  "Latvia": "EUR",
  "Lebanon": "LBP",
  "Lesotho": "LSL",
  "Liberia": "LRD",
  "Libya": "LYD",
  "Liechtenstein": "CHF",
  "Lithuania": "LTL",
  "Luxembourg": "EUR",
  "Macau": "MOP",
  "Madagascar": "MGA",
  "Malawi": "MWK",
  "Malaysia": "MYR",
  "Maldives": "MVR",
  "Mali": "XOF",
  "Malta": "EUR",
  "Marshall Islands": "USD",
  "Martinique": "EUR",
  "Mauritania": "MRO",
  "Mauritius": "MUR",
  "Mayotte": "EUR",
  "Mexico": "MXN",
  "Micronesia": "USD",
  "Moldova": "MDL",
  "Monaco": "EUR",
  "Mongolia": "MNT",
  "Montenegro": "EUR",
  "Montserrat": "XCD",
  "Morocco": "MAD",
  "Mozambique": "MZN",
  "Myanmar": "MMK",
  "Namibia": "NAD",
  "Nauru": "AUD",
  "Nepal": "NPR",
  "Netherlands": "EUR",
  "New Caledonia": "XPF",
  "New Zealand": "NZD",
  "Nicaragua": "NIO",
  "Niger": "XOF",
  "Nigeria": "NGN",
  "Niue": "NZD",
  "Norfolk Island": "AUD",
  "North Macedonia": "MKD",
  "Northern Mariana Islands": "USD",
  "Norway": "NOK",
  "Oman": "OMR",
  "Pakistan": "PKR",
  "Palau": "USD",
  "Palestine": "ILS",
  "Panama": "PAB",
  "Papua New Guinea": "PGK",
  "Paraguay": "PYG",
  "Peru": "PEN",
  "Philippines": "PHP",
  "Pitcairn Islands": "NZD",
  "Poland": "PLN",
  "Portugal": "EUR",
  "Puerto Rico": "USD",
  "Qatar": "QAR",
  "Réunion": "EUR",
  "Romania": "RON",
  "Russia": "RUB",
  "Rwanda": "RWF",
  "Saint Helena": "SHP",
  "Saint Kitts and Nevis": "XCD",
  "Saint Lucia": "XCD",
  "Saint Martin": "EUR",
  "Saint Pierre and Miquelon": "EUR",
  "Saint Vincent and the Grenadines": "XCD",
  "Samoa": "WST",
  "San Marino": "EUR",
  "Sao Tome and Principe": "STD",
  "Saudi Arabia": "SAR",
  "Senegal": "XOF",
  "Serbia": "RSD",
  "Seychelles": "SCR",
  "Sierra Leone": "SLL",
  "Singapore": "SGD",
  "Sint Maarten": "ANG",
  "Slovakia": "EUR",
  "Slovenia": "EUR",
  "Solomon Islands": "SBD",
  "Somalia": "SOS",
  "South Africa": "ZAR",
  "South Georgia and the South Sandwich Islands": "GBP",
  "South Sudan": "SSP",
  "Spain": "EUR",
  "Sri Lanka": "LKR",
  "Sudan": "SDG",
  "Suriname": "SRD",
  "Svalbard and Jan Mayen": "NOK",
  "Sweden": "SEK",
  "Switzerland": "CHF",
  "Syria": "SYP",
  "Taiwan": "TWD",
  "Tajikistan": "TJS",
  "Tanzania": "TZS",
  "Thailand": "THB",
  "Timor-Leste": "USD",
  "Togo": "XOF",
  "Tokelau": "NZD",
  "Tonga": "TOP",
  "Trinidad and Tobago": "TTD",
  "Tunisia": "TND",
  "Turkey": "TRY",
  "Turkmenistan": "TMT",
  "Turks and Caicos Islands": "USD",
  "Tuvalu": "AUD",
  "Uganda": "UGX",
  "Ukraine": "UAH",
  "United Arab Emirates": "AED",
  "United Kingdom": "GBP",
  "United States": "USD",
  "Uruguay": "UYU",
  "Uzbekistan": "UZS",
  "Vanuatu": "VUV",
  "Vatican City": "EUR",
  "Venezuela": "VEF",
  "Vietnam": "VND",
  "Western Sahara": "MAD",
  "Yemen": "YER",
  "Zambia": "ZMK",
  "Zimbabwe": "ZWL"
};

function setCurrencyForCountry(country) {
  const code = countryCurrencyMap[country] || ''
  donor.doc.default_currency = code
  if (!code) {
    donor.doc._default_currency_readonly = false
  } else {
    donor.doc._default_currency_readonly = true
  }
}

watch(() => donor.doc.country, async (newCountry, oldCountry) => {
  if (newCountry) {
    setCurrencyForCountry(newCountry)
    
    // Only clear country-specific fields when user actually changes the country
    // Don't clear on component initialization or re-renders
    if (oldCountry && oldCountry !== newCountry && oldCountry !== undefined) {
      donor.doc.contact_no = ""
      donor.doc.co_contact_no = ""
      donor.doc.company_contact_number = ""
      donor.doc.organization_contact_person = ""
      donor.doc.state = ""
      donor.doc.area = ""

    }
    
          // Clean up any existing prefixes immediately when country changes
      if (oldCountry && oldCountry !== newCountry) {
        const contactInput = findInputField('contact_no')
        const coContactInput = findInputField('co_contact_no')
        const companyContactInput = findInputField('company_contact_number')
        const orgContactInput = findInputField('organization_contact_person')
        const orgRepContactInput = findInputField('org_representative_contact_number')
        const ContactInput = findInputField('org_contact')
        const representative_mobileInput = findInputField('representative_mobile')
        
        // Helper function to clear phone field styling and prefixes
        const clearPhoneField = (inputElement) => {
          if (inputElement) {
            const existingPrefixes = inputElement.parentNode?.querySelectorAll('.country-prefix')
          existingPrefixes?.forEach(prefix => prefix.remove())
            inputElement.style.paddingLeft = ''
            inputElement.style.position = ''
            if (inputElement.parentNode) {
              inputElement.parentNode.style.position = ''
          }
          
          // Clear validation messages
            const existingMessages = inputElement.parentNode?.querySelectorAll('.phone-error-message')
          existingMessages?.forEach(msg => msg.remove())
            inputElement.classList.remove('border-red-500', 'border-green-500')
          }
        }
        
        // Clear all phone fields
        clearPhoneField(contactInput)
        clearPhoneField(coContactInput)
        clearPhoneField(companyContactInput)
        clearPhoneField(orgContactInput)
        clearPhoneField(orgRepContactInput)
        clearPhoneField(ContactInput)
        clearPhoneField(representative_mobileInput)
      }
    
    // Clear all existing phone field errors when country changes
    clearAllPhoneFieldErrors()
    
    // Also clear any existing validation timeouts to prevent delayed validations
    validationTimeouts.forEach(timeoutId => clearTimeout(timeoutId))
    validationTimeouts.clear()
    
    // Apply phone masks for the new country
    setTimeout(async () => {
      await applyPhoneMasksForCountry(newCountry, setFieldValue)
      
          // Re-validate all phone fields with the new country
    const phoneFields = ['contact_no', 'co_contact_no', 'company_contact_number', 'organization_contact_person', 'org_representative_contact_number', 'org_contact', 'representative_mobile', 'mobile_no', 'phone_no']
    
    for (const fieldName of phoneFields) {
        if (donor.doc[fieldName] && donor.doc[fieldName].trim() !== '') {
          const validation = await validatePhoneNumber(donor.doc[fieldName], newCountry)
          if (!validation.isValid) {
            showPhoneValidationFeedback(fieldName, false, validation.message)
          } else {
            // Clear any existing error messages for valid fields
            showPhoneValidationFeedback(fieldName, true, '')
          }
        }
      }
    }, 500)
  }
})





onMounted(() => {

  
  // Set default values for donor.doc
  if (!donor.doc) {
    donor.doc = {}
  }
  
  // Set essential defaults if not already present
  if (!donor.doc.identification_type) {
    donor.doc.identification_type = 'CNIC'

  }
  
  if (!donor.doc.donor_identity) {
    donor.doc.donor_identity = 'Known'

  }
  

  
  if (!donor.doc.default_currency) {
    donor.doc.default_currency = 'PKR'

  }
  
  if (!donor.doc.naming_series) {
    donor.doc.naming_series = 'DONOR-.{branch_series}.-.YYYY.-'

  }
  
  if (!donor.doc.status) {
    donor.doc.status = 'Active'

  }
  
  if (!donor.doc.country) {
    donor.doc.country = 'Pakistan'

  }
  

  
  if (!donor.doc.contact_numbers || donor.doc.contact_numbers.length === 0) {
    donor.doc.contact_numbers = [{
      phone: '',
      is_primary_phone: false,
      is_primary_mobile_no: false
    }]

  }
  
  if (!donor.doc.email_ids || donor.doc.email_ids.length === 0) {
    donor.doc.email_ids = [{
      email_id: '',
      is_primary: false
    }]

  }
  
  // Apply any props defaults (this will override the above defaults if provided)
  if (props.defaults) {
    Object.assign(donor.doc, props.defaults)

  }
  
  // Set owner if not already set
  if (!donor.doc.owner_id) {
    donor.doc.owner_id = user.value
  
  }
  

  
  // Apply masking after component is mounted with delay
  setTimeout(() => {
    applyCnicMaskToInput('cnic', donor.doc.identification_type, setFieldValue)
  }, 500)
  
  // Apply phone masks if country is set
  if (donor.doc.country) {
    setTimeout(async () => {
      await applyPhoneMasksForCountry(donor.doc.country, setFieldValue)
    }, 800)
  }
  
  // Set up observers and intervals after defaults are set
  setupObservers()
})

// Watch for changes to key fields to debug default value issues
watch(
  () => donor.doc.identification_type,
  (newType, oldType) => {
    if (!newType) {
      donor.doc.identification_type = 'CNIC'
      return
    }
    

  if (oldType && oldType !== newType && oldType !== undefined) {
      donor.doc.cnic = ""
      donor.doc.others = ""
    }
    
    // Apply masking to CNIC field when identification type changes with delay
    setTimeout(() => {
      applyCnicMaskToInput('cnic', newType, setFieldValue)
    }, 100)
  },
  { immediate: true } 
)



function openCreateModal({ doctype, initialValue, onSuccess }) {
  // Ensure parent modal stays visible
  if (!show.value) {
    show.value = true
  }
  
  modalStack.value.push({
    doctype,
    initialValue,
    onSuccess,
    visible: true,
  })
  
  nextTick(() => {
    if (hasActiveSubModals.value && !show.value) {
      show.value = true
    }
  })
}

function handleModalSuccess(idx, doc) {
  const modal = modalStack.value[idx]
  if (modal && modal.onSuccess) modal.onSuccess(doc)
  modalStack.value.splice(idx, 1)
  
  if (!hasActiveSubModals.value) {
  }
}

function handleModalClose(idx) {
  modalStack.value.splice(idx, 1)
  
  // If no more sub-modals, allow parent modal to be closed
  if (!hasActiveSubModals.value) {
    // Reset any modal-specific states if needed
  }
}

function extractErrorMessage(err) {
  if (err?.message && typeof err.message === 'string' && err.message.length > 0) return err.message;
  if (err?._server_messages) {
    try {
      const msgs = JSON.parse(err._server_messages);
      if (Array.isArray(msgs) && msgs.length) {
        try {
          const inner = JSON.parse(msgs[0]);
          if (inner.message) return inner.message;
        } catch {
          return msgs[0];
        }
      }
    } catch {}
  }
  if (err?.exc) {
    const match = err.exc.match(/ValidationError: ([\s\S]+)/);
    if (match) return match[1];
    return err.exc;
  }
  if (err?.error) return err.error;
  return String(err);
}

async function createNewDonor() {
  // Defaults are already set in onMounted, no need to set them again here

  if (!donor.doc.naming_series) {
    donor.doc.naming_series = 'DONOR-.{branch_abbreviation}.-.YYYY.-'
  }

  await triggerOnBeforeCreate?.()

  const validationErrors = []
  
  if (!donor.doc.identification_type) {
    validationErrors.push('Identification Type is required')
  }
  
  // CNIC is mandatory when identification_type is not "Others" and foa is 0
  const isCnicMandatory = donor.doc.identification_type && 
                          donor.doc.identification_type !== 'Others' && 
                          (!donor.doc.foa || donor.doc.foa === 0)
  
  if (isCnicMandatory) {
    if (!donor.doc.cnic || donor.doc.cnic.trim() === '') {
      validationErrors.push(`${donor.doc.identification_type} is required`)
    } else {
      if (donor.doc.identification_type === 'CNIC') {
        if (!validateCnicFormat(donor.doc.cnic, donor.doc.identification_type)) {
          validationErrors.push('Invalid CNIC format. Please enter CNIC in format: 12345-1234567-1')
        }
      } else if (donor.doc.identification_type === 'NTN') {
        if (!validateCnicFormat(donor.doc.cnic, donor.doc.identification_type)) {
          validationErrors.push('Invalid NTN format. Please enter NTN in format: 123456-1')
        }
      } else if (donor.doc.identification_type === 'Passport') {
        if (!validateCnicFormat(donor.doc.cnic, donor.doc.identification_type)) {
          validationErrors.push('Invalid Passport format. Please enter 9 digits.')
        }
      }
    }
  } 
  
  // Others field is mandatory when identification_type is "Others"
  if (donor.doc.identification_type === 'Others') {
    if (!donor.doc.others || donor.doc.others.trim() === '') {
      validationErrors.push('Others field is required when Identification Type is Others')
    }
  }
  
  if (!donor.doc.donor_name || donor.doc.donor_name.trim() === '') {
    validationErrors.push('Donor Name is required')
  }
  
  if (!donor.doc.donor_type || donor.doc.donor_type.trim() === '') {
    validationErrors.push('Donor Type is required')
  }
  
  // Email validation
  if (!donor.doc.email || donor.doc.email.trim() === '') {
    validationErrors.push('Donor Email is required')
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(donor.doc.email.trim())) {
      validationErrors.push('Invalid email format. Please enter a valid email address.')
    }
  }
  
  // Company email validation 
  if (donor.doc.donor_type === 'Corporate Donors' && donor.doc.company_email_address && donor.doc.company_email_address.trim() !== '') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(donor.doc.company_email_address.trim())) {
      validationErrors.push('Invalid Company Email Address format. Please enter a valid email address.')
    }
  }
  
  // Representative email validation 
  if ((donor.doc.donor_type === 'Corporate Donors' || donor.doc.donor_type === 'Organization') && 
      donor.doc.representative_email && donor.doc.representative_email.trim() !== '') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(donor.doc.representative_email.trim())) {
      validationErrors.push('Invalid Representative Email format. Please enter a valid email address.')
    }
  }

  
  if (!donor.doc.donor_identity || donor.doc.donor_identity.trim() === '') {
    validationErrors.push('Donor Identity is required')
  }
  
  if (!donor.doc.default_currency || donor.doc.default_currency.trim() === '') {
    validationErrors.push('Default Currency is required')
  }
  
  

  
  // Contact number validation
  if (donor.doc.country && (!donor.doc.contact_no || donor.doc.contact_no.trim() === '')) {
    validationErrors.push('Contact Number is required when Country is selected')
  } else if (donor.doc.contact_no && donor.doc.contact_no.trim() !== '' && donor.doc.country) {
    const phoneValidation = await validatePhoneNumber(donor.doc.contact_no.trim(), donor.doc.country)
    if (!phoneValidation.isValid) {
      if (donor.doc.country === 'Pakistan') {
        validationErrors.push('Contact Number: Pakistan phone number must be 10 digits and start with valid mobile prefix (30-39). Example: 348-8903564')
      } else {
        validationErrors.push(`Contact Number: ${phoneValidation.message}`)
      }
    }
  }

  
  // Organizational donor specific validations
  if (donor.doc.donor_type === 'Organizational') {
    if (!donor.doc.organization_contact_person || donor.doc.organization_contact_person.trim() === '') {
      validationErrors.push('Organization Contact Person is required for Organizational donors')
    }
    if (!donor.doc.representative_designation || donor.doc.representative_designation.trim() === '') {
      validationErrors.push('Representative Designation is required for Organizational donors')
    }
    if (!donor.doc.company_name || donor.doc.company_name.trim() === '') {
      validationErrors.push('Company Name is required for Organizational donors')
    }
  }
  
  // FOA (Friend of Association) validations
  if (donor.doc.foa === 1 || donor.doc.foa === true || donor.doc.foa == 1 || !!donor.doc.foa) {
    if (!donor.doc.co_name || donor.doc.co_name.trim() === '') {
      validationErrors.push('C/O Name is required when FOA is enabled')
    }
    if (!donor.doc.co_contact_no || donor.doc.co_contact_no.trim() === '') {
      validationErrors.push('C/O Contact No is required when FOA is enabled')
    } else if (donor.doc.co_contact_no && donor.doc.co_contact_no.trim() !== '' && donor.doc.country) {
      const coPhoneValidation = await validatePhoneNumber(donor.doc.co_contact_no.trim(), donor.doc.country)
      if (!coPhoneValidation.isValid) {
        if (donor.doc.country === 'Pakistan') {
          validationErrors.push('C/O Contact Number: Pakistan phone number must be 10 digits and start with valid mobile prefix (30-39). Example: 348-8903564')
        } else {
          validationErrors.push(`C/O Contact Number: ${coPhoneValidation.message}`)
        }
      }
      }
    if (!donor.doc.co_email || donor.doc.co_email.trim() === '') {
      validationErrors.push('C/O Email is required when FOA is enabled')
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(donor.doc.co_email.trim())) {
        validationErrors.push('Invalid C/O Email format. Please enter a valid email address.')
      }
    }
    if (!donor.doc.co_address || donor.doc.co_address.trim() === '') {
      validationErrors.push('C/O Address is required when FOA is enabled')
    }
    if (!donor.doc.relationship_with_donor || donor.doc.relationship_with_donor.trim() === '') {
      validationErrors.push('Relationship With Donor is required when FOA is enabled')
    }
  }
  


  // Helper function for phone validation
  const validatePhoneField = async (fieldName, fieldLabel) => {
    if (donor.doc[fieldName] && donor.doc[fieldName].trim() !== '' && donor.doc.country) {
      const validation = await validatePhoneNumber(donor.doc[fieldName].trim(), donor.doc.country)
      if (!validation.isValid) {
      if (donor.doc.country === 'Pakistan') {
          validationErrors.push(`${fieldLabel}: Pakistan phone number must be 10 digits and start with valid mobile prefix (30-39). Example: 348-8903564`)
      } else {
          validationErrors.push(`${fieldLabel}: ${validation.message}`)
        }
      }
    }
  }

  // Validate all phone fields
  await validatePhoneField('company_contact_number', 'Company Contact Number')
  await validatePhoneField('organization_contact_person', 'Organization Contact Person')
  await validatePhoneField('org_representative_contact_number', 'Organization Representative Contact Number')
  await validatePhoneField('org_contact', 'Organization Contact Number')
  await validatePhoneField('representative_mobile', 'Representative Mobile Number')
  await validatePhoneField('mobile_no', 'Mobile No')
  await validatePhoneField('phone_no', 'Phone No')

  if (donor.doc.identification_type && 
      donor.doc.identification_type !== 'Others' && 
      donor.doc.cnic && 
      donor.doc.cnic.trim() !== '') {
    
    try {
      const existingDonors = await call('frappe.client.get_list', {
        doctype: 'Donor',
        filters: { cnic: donor.doc.cnic },
        fields: ['name']
      })
      if (existingDonors && existingDonors.length > 0) {
        validationErrors.push(`This ${donor.doc.identification_type} already exists for another donor.`)
      }
    } catch (clientError) {
    }
  }

  if (validationErrors.length > 0) {
    const errorMessage = `Please fill in the following required fields:\n\n${validationErrors.map(error => `• ${error}`).join('\n')}`
    error.value = errorMessage
    if (typeof frappe !== 'undefined' && frappe.show_alert) {
      frappe.show_alert({ message: errorMessage, indicator: 'red' })
    } else if (typeof frappe !== 'undefined' && frappe.msgprint) {
      frappe.msgprint({
        title: 'Validation Error',
        message: errorMessage,
        indicator: 'red',
      })
    } else {
      alert(errorMessage)
    }
    return
  }
  
  isDonorCreating.value = true
  error.value = null
  cnicExistsMessage.value = ''

  createDonor.submit(donor.doc, {
    onSuccess(data) {
      isDonorCreating.value = false
      
      if (!data) {
        error.value = 'Donor creation failed. Please try again.'
        return
      }
      
      // Handle different response formats from the backend
      let donorName = null
      
      if (data.name) {
        donorName = data.name
      } else if (data.message && data.message.name) {
        donorName = data.message.name
      } else if (data.message && typeof data.message === 'string') {
        // Sometimes the backend returns the donor name directly in message
        donorName = data.message
      } else if (data.donor_name) {
        donorName = data.donor_name
      } else if (data.donor_id) {
        donorName = data.donor_id
      }
      
      if (!donorName) {
        console.error('Could not extract donor name from response:', data)
        error.value = 'Donor creation failed. Please try again. Response format unexpected.'
        return
      }
      
      show.value = false
      // Reset form data after successful creation
      resetDonorForm()
      emit('donor-created')
      toast.success(__('Donor created successfully'))
      
      const refreshTimestamp = Date.now()
      router.push({ 
        name: 'DonorDetail', 
        params: { donorId: donorName },
        query: { refresh: refreshTimestamp } 
      })
      
      if (props.options.afterInsert) {
        props.options.afterInsert(data)
      }

    },
    onError(err) {
      isDonorCreating.value = false;
      let msg = 'An error occurred while creating the donor.';
      let handled = false;
      const rawMsg = extractErrorMessage(err);
      
      if (/CNIC[\s\S]*already exists/i.test(rawMsg) ||
          (/ValidationError/i.test(rawMsg) && /CNIC/i.test(rawMsg))) {
        if (donor.doc.cnic && donor.doc.cnic.trim() !== '') {
          msg = 'CNIC already exists for another donor.';
          showCnicValidationError(msg);
          handled = true;
        } else {
          msg = 'Please enter a valid CNIC number.';
          showCnicValidationError(msg);
          handled = true;
        }
      }
      else if (/MandatoryError/i.test(rawMsg)) {
        const missingFieldsMatch = rawMsg.match(/MandatoryError.*?:\s*(.+)/i);
        if (missingFieldsMatch) {
          const missingFields = missingFieldsMatch[1].split(',').map(field => field.trim());
          msg = `Please fill in the following required fields: ${missingFields.join(', ')}`;
        } else {
          msg = 'Please fill all the mandatory fields (Donor Name, Donor Type, Email, etc.).';
        }
        handled = true;
      }
      else if (/invalid email address/i.test(rawMsg) || 
               /email.*invalid/i.test(rawMsg) ||
               /invalid.*email/i.test(rawMsg) ||
               /email.*format/i.test(rawMsg) ||
               /format.*email/i.test(rawMsg)) {
        msg = 'Invalid email address.';
        handled = true;
      }
      else if (/naming_series/i.test(rawMsg)) {
        msg = 'Naming series error. Please try again.';
        handled = true;
      }
      else if (/ValidationError/i.test(rawMsg)) {
        const validationMatch = rawMsg.match(/ValidationError:\s*(.+)/i);
        if (validationMatch) {
          msg = validationMatch[1].trim();
        } else {
          msg = 'Validation error: ' + rawMsg;
        }
        handled = true;
      }
      else if (/DuplicateEntryError/i.test(rawMsg)) {
        msg = 'A record with this information already exists.';
        handled = true;
      }
      else if (/PermissionError/i.test(rawMsg)) {
        msg = 'You do not have permission to create donors.';
        handled = true;
      }
      else if (/LinkError/i.test(rawMsg)) {
        msg = 'Invalid reference in one of the fields.';
        handled = true;
      }
      else if (/DataError/i.test(rawMsg)) {
        msg = 'Data format error. Please check your input.';
        handled = true;
      }
      else if (/IntegrityError/i.test(rawMsg)) {
        msg = 'Data integrity error. Please try again.';
        handled = true;
      }
      else if (/OperationalError/i.test(rawMsg)) {
        msg = 'Database operation failed. Please try again.';
        handled = true;
      }
      else if (/ProgrammingError/i.test(rawMsg)) {
        msg = 'System error. Please contact support.';
        handled = true;
      }
      else if (/email/i.test(rawMsg)) {
        msg = 'Email validation error. Please check the email format.';
        handled = true;
      }
      else if (/required/i.test(rawMsg) || /mandatory/i.test(rawMsg)) {
        msg = 'Please fill all required fields.';
        handled = true;
      }
      else if (/format/i.test(rawMsg)) {
        msg = 'Invalid format in one or more fields.';
        handled = true;
      }
      else if (/length/i.test(rawMsg)) {
        msg = 'One or more fields exceed the maximum length.';
        handled = true;
      }
      else if (/unique/i.test(rawMsg)) {
        msg = 'A record with this information already exists.';
        handled = true;
      }
      
      if (!handled) {
        if (rawMsg && rawMsg !== 'An error occurred while creating the donor.') {
          msg = rawMsg;
        }
      }
      
      error.value = msg;
    },
  })
}

function showCnicValidationError(message) {
  cnicValidationMessage.value = message
  showCnicValidationDialog.value = true
}

function closeCnicValidationDialog() {
  showCnicValidationDialog.value = false
  cnicValidationMessage.value = ''
}

function closeErrorDialog() {
  showCnicExistsDialog.value = false
  cnicExistsMessage.value = ''
}

watch(showCnicExistsDialog, (val) => {
  if (!val) {
    cnicExistsMessage.value = ''
  }
})

function deleteDonor() {
  call('frappe.client.delete', {
    doctype: 'Donor',
    name: donor.value.doc.name,
  }).then(() => {
    frappe.msgprint(__('Donor deleted successfully'));
    show.value = false;
    emit('donor-deleted');
  }).catch((err) => {
    frappe.msgprint(__('Failed to delete donor'));
  });
}

function onQuickEntryClose() {
  showQuickEntryModal.value = false
  show.value = true
}

function onQuickEntryReset() {
  showQuickEntryModal.value = false
  show.value = true
}

function onQuickEntrySaved() {
  showQuickEntryModal.value = false
  show.value = true
}



onUnmounted(() => {
  const inputs = document.querySelectorAll('input')
  inputs.forEach(input => {
    if (input._pakistanHandler) {
      input.removeEventListener('input', input._pakistanHandler)
      input._pakistanHandler = null
    }
    if (input._pakistanKeydownHandler) {
      input.removeEventListener('keydown', input._pakistanKeydownHandler)
      input._pakistanKeydownHandler = null
    }
    if (input._pakistanPasteHandler) {
      input.removeEventListener('paste', input._pakistanPasteHandler)
      input._pakistanPasteHandler = null
    }
    if (input._otherCountryHandler) {
      input.removeEventListener('input', input._otherCountryHandler)
      input._otherCountryHandler = null
    }
    if (input._otherCountryKeydownHandler) {
      input.removeEventListener('keydown', input._otherCountryKeydownHandler)
      input._otherCountryKeydownHandler = null
    }
  })
})



// Helper function for email validation
function createEmailWatcher(fieldName) {
  return (newEmail) => {
    if (newEmail && newEmail.trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(newEmail.trim())) {
        showEmailValidationFeedback(fieldName, false, 'Invalid email format. Please enter a valid email address.')
      } else {
        showEmailValidationFeedback(fieldName, true, '')
      }
    } else {
      showEmailValidationFeedback(fieldName, true, '')
    }
  }
}

// Watch for email field changes
watch(() => donor.doc.company_email_address, createEmailWatcher('company_email_address'))
watch(() => donor.doc.representative_email, createEmailWatcher('representative_email'))
watch(() => donor.doc.email, createEmailWatcher('email'))
watch(() => donor.doc.co_email, createEmailWatcher('co_email'))
watch(() => donor.doc.org_email, createEmailWatcher('org_email'))
watch(() => donor.doc.donor_email, createEmailWatcher('donor_email'))

function showEmailValidationFeedback(fieldName, isValid, message) {
  nextTick(() => {
    let inputElement = null
    
    inputElement = document.querySelector(`input[name="${fieldName}"]`)
    
    if (!inputElement) {
      inputElement = document.querySelector(`[data-name="${fieldName}"] input`)
    }
    
    if (!inputElement) {
      inputElement = document.querySelector(`[data-fieldname="${fieldName}"] input`)
    }
    
    const existingMessages = inputElement?.parentNode?.querySelectorAll('.email-error-message')
    existingMessages?.forEach(msg => msg.remove())
    
    if (inputElement) {
      inputElement.classList.remove('border-red-500', 'border-green-500')
      
      if (!isValid) {
        inputElement.classList.add('border-red-500')
        let errorElement = inputElement.parentNode.querySelector('.email-error-message')
        if (!errorElement) {
          errorElement = document.createElement('div')
          errorElement.className = 'email-error-message text-red-500 text-sm mt-1 block w-full'
          errorElement.style.cssText = 'color: #ef4444; font-size: 12px; margin-top: 4px; display: block; width: 100%;'
          inputElement.parentNode.appendChild(errorElement)
        }
        errorElement.textContent = message
      } else {
        inputElement.classList.add('border-green-500')
        const errorElement = inputElement.parentNode.querySelector('.email-error-message')
        if (errorElement) {
          errorElement.remove()
        }
      }
    }
  })
}


</script>


