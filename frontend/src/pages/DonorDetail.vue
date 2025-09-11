<template>
  <LayoutHeader v-if="donor.data">
    <template #left-header>
      <Breadcrumbs :items="breadcrumbs" />
    </template>
    <template #right-header>
      <CustomActions
        v-if="donor.data.actions?.length"
        :actions="donor.data.actions"
      />
      <Dropdown
        v-if="donorDocument.doc"
        :options="donorStatusOptions"
      >
        <template #default="{ open }">  
          <Button :label="donorDocument.doc.status || 'Active'">
            <template #prefix>
              <IndicatorIcon :class="getDonorStatus(donorDocument.doc.status).color" />
            </template>
            <template #suffix>
              <FeatherIcon
                :name="open ? 'chevron-up' : 'chevron-down'"
                class="h-4"
              />
            </template>
          </Button>
        </template>
      </Dropdown>
      <AssignTo
        v-model="assignees.data"
        :data="donorDocument.doc"
        doctype="Donor"
      />
    </template>
  </LayoutHeader>
  <AppStyling type="detail-background">
    <div v-if="donor.data" class="flex h-full overflow-hidden">
      <Tabs as="div" v-model="tabIndex" :tabs="tabs">
        <template #tab-panel>
          <Activities
            v-if="donor.data && donor.data.name"
            ref="activities"
            doctype="Donor"
            :docname="donorId"
            :tabs="tabs"
            v-model:reload="reload"
            v-model:tabIndex="tabIndex"
            @beforeSave="saveChanges"
            @afterSave="reloadAssignees"
          />
        </template>
      </Tabs>
    <Resizer class="flex flex-col justify-between border-l" side="right">
      <div
        class="flex h-10.5 cursor-copy items-center border-b px-5 py-2.5 text-lg font-medium text-ink-gray-9"
        @click="copyToClipboard(donor.data.name)"
      >
        {{ __(donor.data.name) }}
      </div>
      <FileUploader
        @success="(file) => updateField('image', file.file_url)"
        :validateFile="validateIsImageFile"
      >
        <template #default="{ openFileSelector, error }">
          <div class="flex items-center justify-start gap-5 border-b p-5">
            <div class="group relative size-12">
              <Avatar
                size="3xl"
                class="size-12"
                :label="title"
                :image="donor.data.image"
              />
              <component
                :is="donor.data.image ? Dropdown : 'div'"
                v-bind="
                  donor.data.image
                    ? {
                        options: [
                          {
                            icon: 'upload',
                            label: donor.data.image
                              ? __('Change image')
                              : __('Upload image'),
                            onClick: openFileSelector,
                          },
                          {
                            icon: 'trash-2',
                            label: __('Remove image'),
                            onClick: () => updateField('image', ''),
                          },
                        ],
                      }
                    : { onClick: openFileSelector }
                "
                class="!absolute bottom-0 left-0 right-0"
              >
                <div
                  class="z-1 absolute bottom-0.5 left-0 right-0.5 flex h-9 cursor-pointer items-center justify-center rounded-b-full bg-black bg-opacity-40 pt-3 opacity-0 duration-300 ease-in-out group-hover:opacity-100"
                  style="
                    -webkit-clip-path: inset(12px 0 0 0);
                    clip-path: inset(12px 0 0 0);
                  "
                >
                  <CameraIcon class="size-4 cursor-pointer text-white" />
                </div>
              </component>
            </div>
            <div class="flex flex-col gap-2.5 truncate">
              <Tooltip :text="donor.data.donor_name || __('Set donor name')">
                <div class="truncate text-2xl font-medium text-ink-gray-9">
                  {{ title }}
                </div>
              </Tooltip>
              <div class="flex gap-1.5">
                <Tooltip v-if="callEnabled" :text="__('Make a call')">
                  <div>
                    <Button
                      class="h-7 w-7"
                      @click="
                        () =>
                          donor.data.mobile_no
                            ? makeCall(donor.data.mobile_no)
                            : toast.error(__('No phone number set'))
                      " 
                    >
                      <template #icon>c
                        <PhoneIcon />
                      </template>
                    </Button>
                  </div>
                </Tooltip>
                <Tooltip :text="__('Send an email')">
                  <div>
                    <Button
                      class="h-7 w-7"
                      @click="
                        donor.data.email
                          ? openEmailBox()
                          : toast.error(__('No email set'))
                      "
                    >
                      <template #icon>
                        <Email2Icon />
                      </template>
                    </Button>
                  </div>
                </Tooltip>
                <Tooltip :text="__('Go to website')">
                  <div>
                    <Button
                      class="h-7 w-7"
                      @click="
                        donor.data.website
                          ? openWebsite(donor.data.website)
                          : toast.error(__('No website set'))
                      "
                    >
                      <template #icon>
                        <LinkIcon />
                      </template>
                    </Button>
                  </div>
                </Tooltip>
                <Tooltip :text="__('Attach a file')">
                  <div>
                    <Button class="h-7 w-7" @click="showFilesUploader = true">
                      <template #icon>
                        <AttachmentIcon />
                      </template>
                    </Button>
                  </div>
                </Tooltip>
                <Tooltip :text="__('Delete')">
                  <div>
                    <Button
                      class="h-7 w-7"
                      @click="deleteDonorWithModal(donor.data.name)"
                      variant="subtle"
                      theme="red"
                    >
                      <template #icon>
                        <FeatherIcon name="trash-2" class="h-4 w-4" />
                      </template>
                    </Button>
                  </div>
                </Tooltip>
              </div>
              <ErrorMessage :message="__(error)" />
            </div>
          </div>
        </template>
      </FileUploader>
      <SLASection
        v-if="donor.data.sla_status"
        v-model="donor.data"
        @updateField="updateField"
      />
      <div
        v-if="sections.data"
        class="flex flex-1 flex-col justify-between overflow-hidden"
      >
        <SidePanelLayout
          :sections="sections.data"
          doctype="Donor"
          :docname="donor.data.name"
          @reload="sections.reload"
          @afterFieldChange="reloadAssignees"
          @open-create-modal="openCreateModal"
        />
        <template v-for="(modal, idx) in modalStack" :key="idx">
          <CreateDocumentModal
            v-model="modal.visible"
            :doctype="modal.doctype"
            :data="{ name: modal.initialValue }"
            @callback="(doc) => handleModalSuccess(idx, doc)"
            @close="() => handleModalClose(idx)"
            @open-create-modal="openCreateModal"
          />
        </template>
      </div>
    </Resizer>
    </div>
  </AppStyling>
  <ErrorPage
    v-if="errorTitle"
    :errorTitle="errorTitle"
    :errorMessage="errorMessage"
  />
  <FilesUploader
    v-if="donor.data?.name"
    v-model="showFilesUploader"
    doctype="Donor"
    :docname="donor.data.name"
    @after="() => { activities?.all_activities?.reload(); changeTabTo('attachments') }"
  />

  <!-- CNIC Exists Dialog -->
  <Dialog v-model="showCnicExistsDialog" :options="{ size: 'sm' }" :disableOutsideClickToClose="true" :disableEscToClose="true">
    <template #body>
      <div class="p-6 text-center">
        <div class="text-lg font-semibold text-red-600 mb-2">{{ cnicExistsMessage }}</div>
        <Button variant="solid" @click="showCnicExistsDialog = false">OK</Button>
      </div>
    </template>
  </Dialog>

  <!-- CNIC Validation Error Dialog -->
  <Dialog v-model="showCnicValidationDialog" :options="{ size: 'sm' }" :disableOutsideClickToClose="true" :disableEscToClose="true">
    <template #body>
      <div class="p-6 text-center">
        <div class="text-lg font-semibold text-red-600 mb-2">{{ cnicValidationMessage }}</div>
        <Button variant="solid" @click="showCnicValidationDialog = false">OK</Button>
      </div>
    </template>
  </Dialog>

</template>

<script setup>
import { defineAsyncComponent } from 'vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import LayoutHeader from '@/components/LayoutHeader.vue'
import Breadcrumbs from '@/components/Breadcrumbs.vue'
import CustomActions from '@/components/CustomActions.vue'
import AssignTo from '@/components/AssignTo.vue'
const Activities = defineAsyncComponent({
  loader: () => import('@/components/Activities/Activities.vue'),
  loadingComponent: LoadingSpinner,
})
const SidePanelLayout = defineAsyncComponent({
  loader: () => import('@/components/SidePanelLayout.vue'),
  loadingComponent: LoadingSpinner,
})
import Resizer from '@/components/Resizer.vue'
import ErrorPage from '@/components/ErrorPage.vue'
import Icon from '@/components/Icon.vue'
import DataFields from '@/components/Activities/DataFields.vue'
const FilesUploader = defineAsyncComponent({
  loader: () => import('@/components/FilesUploader/FilesUploader.vue'),
  loadingComponent: LoadingSpinner,
})
import FieldLayout from '@/components/FieldLayout/FieldLayout.vue'
import SLASection from '@/components/SLASection.vue'
import IndicatorIcon from '@/components/Icons/IndicatorIcon.vue'
import CameraIcon from '@/components/Icons/CameraIcon.vue'
import LinkIcon from '@/components/Icons/LinkIcon.vue'
import AttachmentIcon from '@/components/Icons/AttachmentIcon.vue'
import EditIcon from '@/components/Icons/EditIcon.vue'
import AppStyling from '@/components/AppStyling.vue'
import { getMeta } from '@/stores/meta'
import { ref, computed, onMounted, onUnmounted, watch, nextTick, h, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useActiveTabManager } from '@/composables/useActiveTabManager'
import { createResource } from 'frappe-ui'
import { getSettings } from '@/stores/settings'
import { sessionStore } from '@/stores/session'
import { usersStore } from '@/stores/users'
import { globalStore } from '@/stores/global'
import { statusesStore } from '@/stores/statuses'
import {
  whatsappEnabled,
  callEnabled,
  isMobileView,
} from '@/composables/settings'
import {
  openWebsite,
  setupCustomizations,
  copyToClipboard,
  validateIsImageFile,
} from '@/utils'
import { showQuickEntryModal, quickEntryProps } from '@/composables/modals'
import { getView } from '@/utils/view'
import { capture } from '@/telemetry'
import { useOnboarding } from 'frappe-ui/frappe'
import {
  FileUploader,
  Dropdown,
  Tooltip,
  Avatar,
  Tabs,
  Switch,
  call,
  usePageMeta,
  toast,
  FeatherIcon,
} from 'frappe-ui'
import ActivityIcon from '@/components/Icons/ActivityIcon.vue'
import EmailIcon from '@/components/Icons/EmailIcon.vue'
import Email2Icon from '@/components/Icons/Email2Icon.vue'
import CommentIcon from '@/components/Icons/CommentIcon.vue'
import DetailsIcon from '@/components/Icons/DetailsIcon.vue'
import PhoneIcon from '@/components/Icons/PhoneIcon.vue'
import TaskIcon from '@/components/Icons/TaskIcon.vue'
import NoteIcon from '@/components/Icons/NoteIcon.vue'
import WhatsAppIcon from '@/components/Icons/WhatsAppIcon.vue'
import { useDocument } from '@/data/document'
import ViewBreadcrumbs from '@/components/ViewBreadcrumbs.vue'
const CreateDocumentModal = defineAsyncComponent({
  loader: () => import('@/components/Modals/CreateDocumentModal.vue'),
  loadingComponent: LoadingSpinner,
})

import { useInputMask } from '@/composables/useInputMask'
import { useDonorFieldValidation } from '@/composables/useDonorFieldValidation'

const { brand } = getSettings()
const { user } = sessionStore()
const { isManager } = usersStore()
const { $dialog, $socket, makeCall } = globalStore()
const { statusOptions, getLeadStatus, getDealStatus } = statusesStore()
const { doctypeMeta } = getMeta('Donor')

const { updateOnboardingStep } = useOnboarding('frappecrm')

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
  findInputField
} = useDonorFieldValidation()

const route = useRoute()
const router = useRouter()

const props = defineProps({
  donorId: {
    type: String,
    required: true,
  },
})

const errorTitle = ref('')
const errorMessage = ref('')

const donor = createResource({
  url: 'crm.fcrm.doctype.donor.api.get_donor',
  params: { name: props.donorId },
  cache: ['donor', props.donorId],
  auto: true,
  onSuccess: (data) => {
    errorTitle.value = ''
    errorMessage.value = ''
  },
  onError: (err) => {
    if (err.messages?.[0]) {
      errorTitle.value = __('Not permitted')
      errorMessage.value = __(err.messages?.[0])
    } else {
      router.push({ name: 'Donor' })
    }
  },
})



const { document: donorDocument, assignees, triggerOnchange } = useDocument('Donor', props.donorId)

// Override the document save method to include validation
const overrideDocumentSave = () => {
  if (donorDocument && donorDocument.save && donorDocument.save.submit) {
    // Only override if not already overridden
    if (!donorDocument.save._validationOverridden) {
      const originalSubmit = donorDocument.save.submit
      donorDocument.save.submit = async function(data, options) {
        // Validate before allowing save
        const isValid = await validateBeforeSave()
        if (!isValid) {
          return // Don't save if validation fails
        }
        
        // Call the original submit method
        return originalSubmit.call(this, data, options)
      }
      donorDocument.save._validationOverridden = true
      console.log('Document save method overridden with validation')
    }
  }
}

// Function to validate form immediately and show errors
async function validateFormNow() {
  const isValid = await validateBeforeSave()
  if (!isValid) {
    // Validation failed, errors are already shown by validateBeforeSave
    return false
  }
  return true
}

// Function to validate a specific field
async function validateField(fieldname, value) {
  // Check if it's a required field
  if (donor.fields_meta && donor.fields_meta[fieldname]?.reqd && (!value || value.trim() === '')) {
    const fieldLabel = donor.fields_meta[fieldname].label || fieldname
    toast.error(__('{0} is a required field', [fieldLabel]))
    return false
  }
  
  // CNIC validation
  if (fieldname === 'cnic' && donorDocument.doc?.identification_type && donorDocument.doc?.identification_type !== 'Others') {
    if (!value || value.trim() === '') {
      toast.error('CNIC is required when identification type is set')
      return false
    } else if (!validateCnicFormat(value, donorDocument.doc.identification_type)) {
      toast.error(`Invalid ${donorDocument.doc.identification_type} format. Please enter a valid ${donorDocument.doc.identification_type} number.`)
      return false
    }
  }
  
  // Contact number validation
  if (['contact_no', 'co_contact_no', 'company_contact_number', 'organization_contact_person'].includes(fieldname) && donorDocument.doc?.country) {
    if (value && value.trim() !== '') {
      const validation = await validatePhoneNumber(value, donorDocument.doc.country)
      if (!validation.isValid) {
        const fieldLabels = {
          'contact_no': 'Contact Number',
          'co_contact_no': 'C/O Contact Number',
          'company_contact_number': 'Company Contact Number',
          'organization_contact_person': 'Organization Contact Person'
        }
        toast.error(`${fieldLabels[fieldname]}: ${validation.message}`)
        return false
      }
    }
  }
  
  return true
}

// Function to reapply all masks
async function reapplyAllMasksNow() {
  console.log('Reapplying all masks...')
  
  // Reapply CNIC mask if identification type is set
  if (donorDocument.doc?.identification_type) {
    applyCnicMaskToInput('cnic', donorDocument.doc.identification_type, setFieldValue)
  }
  
  // Reapply phone masks if country is set
  if (donorDocument.doc?.country) {
    await applyPhoneMasksForCountry(donorDocument.doc.country, setFieldValue)
  }
  // Reapply orgs_country masks for organization-specific fields
  if (donorDocument.doc?.orgs_country) {
    await applyPhoneMasksForCountry(
      donorDocument.doc.orgs_country,
      setFieldValue,
      ['org_representative_contact_number','org_contact']
    )
  }
  
  console.log('All masks reapplied')
}



// Removed global reapply utilities



// Override any global save functions that might be used
const originalSave = window.save || window.Save
if (originalSave && typeof originalSave === 'function') {
  window.save = async function(...args) {
    // Check if this is a donor-related save
    if (donorDocument && donorDocument.doc && donorDocument.doc.doctype === 'Donor') {
      console.log('Global save function intercepted, validating...')
      const isValid = await validateBeforeSave()
      if (!isValid) {
        console.log('Global save validation failed')
        return false
      }
    }
    
    // Call the original save function
    return originalSave.apply(this, args)
  }
  window.Save = window.save // Also override capitalized version
}

// Try to override immediately
overrideDocumentSave()

// Watch for document changes to ensure save method is overridden
watch(() => donorDocument, () => {
  if (donorDocument && donorDocument.save) {
    setTimeout(overrideDocumentSave, 100)
  }
}, { deep: true })

watch(() => donorDocument.doc?.country, async (newCountry, oldCountry) => {
  if (donorDocument.doc && newCountry && oldCountry && newCountry !== oldCountry) {
    const fieldsToClear = [
      'contact_no',
      'co_contact_no', 

      'state',
      'area',
      'citytown',
      'stateprovince',
      'address_type',
      'address_line_1',
      'address_line_2'
    ]
    
    fieldsToClear.forEach(field => {
      if (donorDocument.doc && donorDocument.doc[field] !== undefined) {
        donorDocument.doc[field] = ""
      }
    })
    
    if (donor.data) {
      fieldsToClear.forEach(field => {
        if (donor.data[field] !== undefined) {
          donor.data[field] = ""
        }
      })
    }
  }
  

})

const reload = ref(false)
const showFilesUploader = ref(false)
const modalStack = ref([])
function openCreateModal({ doctype, initialValue, onSuccess }) {
  modalStack.value.push({
    doctype,
    initialValue,
    onSuccess,
    visible: true,
  })
}
function handleModalSuccess(idx, doc) {
  const modal = modalStack.value[idx]
  if (modal && modal.onSuccess) modal.onSuccess(doc)
  modalStack.value.splice(idx, 1)
}
function handleModalClose(idx) {
  modalStack.value.splice(idx, 1)
}

async function validateRequired(fieldname, value) {
  let meta = donor.fields_meta || {}
  
  if (fieldname === 'contact_no' && value && donor.data?.country) {
    const phoneValidationResult = await validatePhoneNumber(value, donor.data.country)
    if (!phoneValidationResult.isValid) {
      toast.error(`Invalid contact number for ${donor.data.country}. ${phoneValidationResult.message}`)
      return true
    }
  }
  
  // FOA field validation - check if FOA is enabled and validate required fields
  if (donor.data?.foa === 1 || donor.data?.foa === true || donor.data?.foa == 1 || !!donor.data?.foa) {
    const foaRequiredFields = ['co_name', 'co_contact_no', 'co_email', 'co_address', 'relationship_with_donor']
    if (foaRequiredFields.includes(fieldname) && (!value || value.toString().trim() === '')) {
      const fieldLabels = {
        'co_name': 'C/O Name',
        'co_contact_no': 'C/O Contact No',
        'co_email': 'C/O Email',
        'co_address': 'C/O Address',
        'relationship_with_donor': 'Relationship With Donor'
      }
      toast.error(__('{0} is required when FOA is enabled', [fieldLabels[fieldname] || fieldname]))
      return true
    }
    
    // Special validation for C/O Contact Number when FOA is enabled
    if (fieldname === 'co_contact_no' && value && donor.data?.country) {
      const phoneValidationResult = await validatePhoneNumber(value, donor.data.country)
      if (!phoneValidationResult.isValid) {
        if (donor.data.country === 'Pakistan') {
          toast.error('C/O Contact Number: Pakistan phone number must be 10 digits and start with valid mobile prefix (30-39). Example: 348-8903564')
        } else {
          toast.error(`C/O Contact Number: ${phoneValidationResult.message}`)
        }
        return true
      }
    }
    
    // Special validation for C/O Email when FOA is enabled
    if (fieldname === 'co_email' && value) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(value.toString().trim())) {
        toast.error('Invalid C/O Email format. Please enter a valid email address.')
        return true
      }
    }
  }
  
  if (meta[fieldname]?.reqd && !value) {
    toast.error(__('{0} is a required field', [meta[fieldname].label]))
    return true
  }
  
  return false
}

// Phone validation function removed


// Phone masking functions moved to useDonorFieldValidation composable

// Phone validation feedback functions moved to useDonorFieldValidation composable

function showEmailValidationFeedback(fieldName, isValid, message) {
  nextTick(() => {
    let inputElement = null
    
    inputElement = globalThis.document.querySelector(`input[name="${fieldName}"]`)
    
    if (!inputElement) {
      inputElement = globalThis.document.querySelector(`[data-name="${fieldName}"] input`)
    }
    
    if (!inputElement) {
      inputElement = globalThis.document.querySelector(`[data-fieldname="${fieldName}"] input`)
    }
    
    // If no input element found, return early
    if (!inputElement || !inputElement.parentNode) return
    
    // Clear existing validation messages first
    const existingMessages = inputElement.parentNode.querySelectorAll('.email-error-message')
    existingMessages?.forEach(msg => msg.remove())
    
    // Remove existing validation classes
    inputElement.classList.remove('border-red-500', 'border-green-500')
    
    if (!isValid) {
      inputElement.classList.add('border-red-500')
      // Show error message below the field
      let errorElement = inputElement.parentNode.querySelector('.email-error-message')
      if (!errorElement) {
        errorElement = globalThis.document.createElement('div')
        errorElement.className = 'email-error-message text-red-500 text-sm mt-1 block w-full'
        errorElement.style.cssText = 'color: #ef4444; font-size: 12px; margin-top: 4px; display: block; width: 100%;'
        inputElement.parentNode.appendChild(errorElement)
      }
      errorElement.textContent = message
    } else {
      inputElement.classList.add('border-green-500')
      // Remove error message
      const errorElement = inputElement.parentNode.querySelector('.email-error-message')
      if (errorElement) {
        errorElement.remove()
      }
    }
  })
}

// findInputField function moved to useDonorFieldValidation composable

// Phone mask application function removed

// Conditional field discovery function removed

// Phone field discovery function removed

// Helper function to set field value based on field name
function setFieldValue(fieldName, value) {
  if (!donorDocument.doc) return
  
  switch (fieldName) {
    case 'cnic':
      donorDocument.doc.cnic = value
      break
    case 'contact_no':
      donorDocument.doc.contact_no = value
      break
    case 'co_contact_no':
      donorDocument.doc.co_contact_no = value
      break
    case 'company_contact_number':
      donorDocument.doc.company_contact_number = value
      break
    case 'organization_contact_person':
      donorDocument.doc.organization_contact_person = value
      break
    case 'org_representative_contact_number':
      donorDocument.doc.org_representative_contact_number = value
      break
    case 'org_contact':
      donorDocument.doc.org_contact = value
      break
  }
}



async function validateBeforeSave() {
  const errors = []
  
  // CNIC validation - this is the field mentioned in the user's issue
  if (donorDocument.doc?.identification_type && donorDocument.doc?.identification_type !== 'Others') {
    if (!donorDocument.doc?.cnic || donorDocument.doc.cnic.trim() === '') {
      errors.push('CNIC is required when identification type is set')
    } else if (!validateCnicFormat(donorDocument.doc.cnic, donorDocument.doc.identification_type)) {
      errors.push(`Invalid ${donorDocument.doc.identification_type} format. Please enter a valid ${donorDocument.doc.identification_type} number.`)
    }
  }
  
  // Contact number validation - this is the field mentioned in the user's issue
  if (donorDocument.doc?.country) {
    const phoneFields = ['contact_no', 'co_contact_no', 'company_contact_number', 'organization_contact_person']
    
    for (const fieldName of phoneFields) {
      if (donorDocument.doc[fieldName] && donorDocument.doc[fieldName].trim() !== '') {
        const validation = await validatePhoneNumber(donorDocument.doc[fieldName], donorDocument.doc.country)
        if (!validation.isValid) {
          const fieldLabels = {
            'contact_no': 'Contact Number',
            'co_contact_no': 'C/O Contact Number',
            'company_contact_number': 'Company Contact Number',
            'organization_contact_person': 'Organization Contact Person'
          }
          errors.push(`${fieldLabels[fieldName]}: ${validation.message}`)
        }
      }
    }
  }
  

  
  // Check for required fields based on metadata - this ensures all required fields are validated
  if (donor.fields_meta) {
    for (const [fieldname, meta] of Object.entries(donor.fields_meta)) {
      if (meta.reqd && donorDocument.doc && (!donorDocument.doc[fieldname] || donorDocument.doc[fieldname].toString().trim() === '')) {
        errors.push(`${meta.label || fieldname} is a required field`)
      }
    }
  }
  
  // Additional validation for critical fields that should always be required
  const criticalFields = ['donor_name', 'email']
  for (const fieldname of criticalFields) {
    if (donorDocument.doc && (!donorDocument.doc[fieldname] || donorDocument.doc[fieldname].toString().trim() === '')) {
      const fieldLabel = donor.fields_meta?.[fieldname]?.label || fieldname
      errors.push(`${fieldLabel} is a required field`)
    }
  }
  
  // Department and Donor Desk validation - these are mandatory fields
  if (!donorDocument.doc?.department || donorDocument.doc.department.toString().trim() === '') {
    errors.push('Department is required')
  }
  
  if (!donorDocument.doc?.donor_desk || donorDocument.doc.donor_desk.toString().trim() === '') {
    errors.push('Donor Desk is required')
  }
  
  // FOA (Friend of Association) validations
  if (donorDocument.doc?.foa === 1 || donorDocument.doc?.foa === true || donorDocument.doc?.foa == 1 || !!donorDocument.doc?.foa) {
    if (!donorDocument.doc?.co_name || donorDocument.doc.co_name.toString().trim() === '') {
      errors.push('C/O Name is required when FOA is enabled')
    }
    if (!donorDocument.doc?.co_contact_no || donorDocument.doc.co_contact_no.toString().trim() === '') {
      errors.push('C/O Contact No is required when FOA is enabled')
    } else if (donorDocument.doc?.co_contact_no && donorDocument.doc.co_contact_no.toString().trim() !== '' && donorDocument.doc?.country) {
      const coPhoneValidation = await validatePhoneNumber(donorDocument.doc.co_contact_no.toString().trim(), donorDocument.doc.country)
      if (!coPhoneValidation.isValid) {
        if (donorDocument.doc.country === 'Pakistan') {
          errors.push('C/O Contact Number: Pakistan phone number must be 10 digits and start with valid mobile prefix (30-39). Example: 348-8903564')
        } else {
          errors.push(`C/O Contact Number: ${coPhoneValidation.message}`)
        }
      }
    }
    if (!donorDocument.doc?.co_email || donorDocument.doc.co_email.toString().trim() === '') {
      errors.push('C/O Email is required when FOA is enabled')
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(donorDocument.doc.co_email.toString().trim())) {
        errors.push('Invalid C/O Email format. Please enter a valid email address.')
      }
    }
    if (!donorDocument.doc?.co_address || donorDocument.doc.co_address.toString().trim() === '') {
      errors.push('C/O Address is required when FOA is enabled')
    }
    if (!donorDocument.doc?.relationship_with_donor || donorDocument.doc.relationship_with_donor.toString().trim() === '') {
      errors.push('Relationship With Donor is required when FOA is enabled')
    }
  }
  
  // Email format validation for various email fields
  const emailFields = ['email', 'co_email', 'representative_email', 'company_email_address', 'org_email', 'donor_email', 'org_representative_email_address']
  for (const fieldName of emailFields) {
    if (donorDocument.doc?.[fieldName] && donorDocument.doc[fieldName].toString().trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(donorDocument.doc[fieldName].toString().trim())) {
        const fieldLabels = {
          'email': 'Donor Email',
          'co_email': 'C/O Email',
          'representative_email': 'Representative Email',
          'company_email_address': 'Company Email Address',
          'org_email': 'Organization Email',
          'donor_email': 'Donor Email',
          'org_representative_email_address': 'Organization Representative Email Address'
        }
        errors.push(`Invalid ${fieldLabels[fieldName] || fieldName} format. Please enter a valid email address.`)
      }
    }
  }
  
  if (errors.length > 0) {
    const errorMessage = `\n\n${errors.map(error => `• ${error}`).join('\n')}`
    toast.error(errorMessage)
    return false
  }
  
  return true
}



// Override the updateDonor function
async function updateDonor(fieldname, value, callback) {
  value = Array.isArray(fieldname) ? '' : value

  // Validate before updating
  if (!Array.isArray(fieldname) && await validateRequired(fieldname, value)) return
  
  // Special validation for main contact number removed
  


  createResource({
    url: 'frappe.client.set_value',
    params: {
      doctype: 'Donor', 
      name: props.donorId,
      fieldname,
      value,
    },
    auto: true,
    onSuccess: () => {
      donor.reload()
      toast.success(__('Donor updated successfully'))
      callback?.()
    },
    onError: (err) => {
      const msg = err.messages?.[0] || err.message || __('Error updating donor')
      
      // Check if it's a timestamp mismatch error
      if (msg.includes('TimestampMismatchError') || 
          msg.includes('Document has been modified') ||
          msg.includes('Please refresh to get the latest document')) {
        
        toast.error(__('Document has been modified. Refreshing donor details...'))
        
        // Refresh only the donor data after a short delay
        setTimeout(() => {
          donor.cache = ['donor', props.donorId, Date.now()]
          donor.reload()
        }, 1000)
      } else if (/CNIC|cnic|valid CNIC|xxxxx-xxxxxxx-x/.test(msg)) {
        toast.error(msg)
      } else {
        toast.error(msg)
      }
    },
  })
}







// FOA validation watcher - monitor FOA field changes and validate required fields
watch(
  () => donor.data?.foa,
  (newFoa, oldFoa) => {
    if (newFoa === 1 || newFoa === true || newFoa == 1 || !!newFoa) {
      // FOA is enabled, validate that required fields are filled
      const foaRequiredFields = ['co_name', 'co_contact_no', 'co_email', 'co_address', 'relationship_with_donor']
      foaRequiredFields.forEach(fieldname => {
        const value = donor.data?.[fieldname]
        if (!value || value.toString().trim() === '') {
          const fieldLabels = {
            'co_name': 'C/O Name',
            'co_contact_no': 'C/O Contact No',
            'co_email': 'C/O Email',
            'co_address': 'C/O Address',
            'relationship_with_donor': 'Relationship With Donor'
          }
          toast.error(__('{0} is required when FOA is enabled', [fieldLabels[fieldname] || fieldname]))
        }
      })
    }
  },
  { immediate: true }
)

// Phone validation watchers removed

const breadcrumbs = computed(() => [
  { label: __('Donor'), route: { name: 'Donor' } },
  { label: title.value, route: { name: 'DonorDetail', params: { donorId: donor.data.name } } }
])

const title = computed(() => {
  let t = doctypeMeta['Donor']?.title_field || 'name'
  return donor.data?.[t] || props.donorId
})

usePageMeta(() => {
  return {
    title: title.value,
    icon: brand.favicon,
  }
})

const tabs = computed(() => {
  let tabOptions = [
    {
      name: 'Activity',
      label: __('Activity'),
      icon: ActivityIcon,
    },
    {
      name: 'Emails',
      label: __('Emails'),
      icon: EmailIcon,
    },
    {
      name: 'Comments',
      label: __('Comments'),
      icon: CommentIcon,
    },
    {
      name: 'Data',
      label: __('Data'),
      icon: DetailsIcon,
    },
    {
      name: 'Calls',
      label: __('Calls'),
      icon: PhoneIcon,
    },
    {
      name: 'Tasks',
      label: __('Tasks'),
      icon: TaskIcon,
    },
    {
      name: 'Notes',
      label: __('Notes'),
      icon: NoteIcon,
    },
    {
      name: 'Attachments',
      label: __('Attachments'),
      icon: AttachmentIcon,
    },
    {
      name: 'WhatsApp',
      label: __('WhatsApp'),
      icon: WhatsAppIcon,
      condition: () => whatsappEnabled.value,
    },
  ]
  return tabOptions.filter((tab) => (tab.condition ? tab.condition() : true))
})

const { tabIndex, changeTabTo } = useActiveTabManager(tabs, 'lastDonorTab')

// Watch for tab changes to reapply masks
watch(tabIndex, async (newTabIndex, oldTabIndex) => {
  if (newTabIndex !== oldTabIndex) {
    console.log('Tab changed, reapplying masks...')
    // Wait for the DOM to update with the new tab content
    await nextTick()
    
    // Dispatch custom event for other components to listen to
    document.dispatchEvent(new CustomEvent('tabChanged', { 
      detail: { 
        newTabIndex, 
        oldTabIndex,
        tabName: tabs.value[newTabIndex]?.name 
      } 
    }))
    
    // Try multiple times with increasing delays to ensure DOM is ready
    setTimeout(reapplyAllMasksNow, 100)
    setTimeout(reapplyAllMasksNow, 300)
    setTimeout(reapplyAllMasksNow, 500)
    setTimeout(reapplyAllMasksNow, 1000)
    
    // Also set up a MutationObserver to watch for field layout changes
    setTimeout(() => {
      const fieldLayout = document.querySelector('.field-layout-wrapper')
      if (fieldLayout) {
        // Create a new observer for this tab change
        const tabChangeObserver = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
              // New nodes were added, reapply masks
              setTimeout(reapplyAllMasksNow, 100)
            }
          })
        })
        
        tabChangeObserver.observe(fieldLayout, {
          childList: true,
          subtree: true
        })
        
        // Store the observer for cleanup
        if (!window.tabChangeObservers) {
          window.tabChangeObservers = []
        }
        window.tabChangeObservers.push(tabChangeObserver)
        
        // Clean up after 5 seconds
        setTimeout(() => {
          if (tabChangeObserver) {
            tabChangeObserver.disconnect()
            const index = window.tabChangeObservers.indexOf(tabChangeObserver)
            if (index > -1) {
              window.tabChangeObservers.splice(index, 1)
            }
          }
        }, 5000)
        
        // Also call the reapply function when mutations are detected
        const mutationHandler = (mutations) => {
          mutations.forEach((mutation) => {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
              // New nodes were added, reapply masks
              setTimeout(reapplyAllMasksNow, 100)
            }
          })
        }
        
        tabChangeObserver.observe(fieldLayout, {
          childList: true,
          subtree: true
        })
        
        // Store the observer for cleanup
        if (!window.tabChangeObservers) {
          window.tabChangeObservers = []
        }
        window.tabChangeObservers.push(tabChangeObserver)
        
        // Clean up after 5 seconds
        setTimeout(() => {
          if (tabChangeObserver) {
            tabChangeObserver.disconnect()
            const index = window.tabChangeObservers.indexOf(tabChangeObserver)
            if (index > -1) {
              window.tabChangeObservers.splice(index, 1)
            }
          }
        }, 5000)
      }
    }, 200)
  }
})

// Also watch for Activities component reload to reapply masks
watch(() => reload.value, async (newReload, oldReload) => {
  if (newReload !== oldReload && newReload) {
    console.log('Activities reloaded, reapplying masks...')
    // Wait for the DOM to update
    await nextTick()
    
    // Reapply masks after a short delay to ensure DOM is ready
    setTimeout(async () => {
      if (donorDocument.doc?.identification_type) {
        applyCnicMaskToInput('cnic', donorDocument.doc.identification_type, setFieldValue)
      }
      
      if (donorDocument.doc?.country) {
        await applyPhoneMasksForCountry(donorDocument.doc.country, setFieldValue)
      }
    }, 500)
  }
})

// Watch for Activities component changes more aggressively
watch(() => activities.value, async (newActivities, oldActivities) => {
  if (newActivities && newActivities !== oldActivities) {
    console.log('Activities component changed, reapplying masks...')
    // Wait for the DOM to update
    await nextTick()
    
    // Try multiple times with increasing delays
    setTimeout(reapplyAllMasksNow, 100)
    setTimeout(reapplyAllMasksNow, 300)
    setTimeout(reapplyAllMasksNow, 500)
    setTimeout(reapplyAllMasksNow, 1000)
  }
}, { deep: true })

// Donor status management
const donorStatusOptions = computed(() => [
  {
    label: __('Active'),
    value: 'Active',
    icon: () => h(IndicatorIcon, { class: 'text-green-500' }),
    onClick: async () => {
      await updateDonorStatus('Active')
    },
  },
  {
    label: __('Blocked'),
    value: 'Blocked',
    icon: () => h(IndicatorIcon, { class: 'text-red-500' }),
    onClick: async () => {
      await updateDonorStatus('Blocked')
    },
  },
])

function getDonorStatus(status) {
  if (!status || status === 'Active') {
    return {
      name: 'Active',
      color: 'text-green-500',
    }
  }
  return {
    name: status,
    color: 'text-red-500',
  }
}

async function updateDonorStatus(newStatus) {
  if (!donor.data || !newStatus) return
  
  try {
    // Use the custom API method to update status without validation issues
    const result = await call('crm.fcrm.doctype.donor.api.update_donor_status', {
      name: donor.data.name,
      status: newStatus
    })
    
    if (result.success) {
      donor.data.status = newStatus
      donorDocument.doc.status = newStatus
      toast.success(__('Status updated successfully'))
      
      // Refresh donor details after status update
      donor.cache = ['donor', props.donorId, Date.now()]
      donor.reload()
      
      // Also reload document object
      if (donorDocument && donorDocument.reload) {
        donorDocument.reload()
      }
    } else {
      toast.error(result.message || __('Failed to update status'))
    }
  } catch (error) {
    // Check if it's a timestamp mismatch error
    const errorMessage = error.message || error.toString()
    if (errorMessage.includes('TimestampMismatchError') || 
        errorMessage.includes('Document has been modified') ||
        errorMessage.includes('Please refresh to get the latest document')) {
      
      toast.error(__('Document has been modified. Refreshing donor details...'))
      
      // Refresh only the donor data after a short delay
      setTimeout(() => {
        donor.cache = ['donor', props.donorId, Date.now()]
        donor.reload()
      }, 1000)
    } else {
    toast.error(__('Failed to update status'))
    }
  }
}

watch(tabs, (value) => {
  if (value && route.params.tabName) {
    let index = value.findIndex(
      (tab) => tab.name.toLowerCase() === route.params.tabName.toLowerCase(),
    )
    if (index !== -1) {
      tabIndex.value = index
    }
  }
})

const sections = createResource({
  url: 'crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_sidepanel_sections',
  cache: ['sidePanelSections', 'Donor'],
  params: { doctype: 'Donor' },
  auto: true,
  onSuccess: (data) => {
    // Data loaded successfully
  },
  onError: (error) => {
    // Handle error silently
  }
})

async function updateField(name, value, callback) {
  // Validate through the validateRequired function
  const validationResult = await validateRequired(name, value)
  if (validationResult) {
    return // Block the update if validation fails
  }
  
  // Additional validation for required fields based on metadata
  if (donor.fields_meta && donor.fields_meta[name]?.reqd && (!value || value.trim() === '')) {
    toast.error(__('{0} is a required field', [donor.fields_meta[name].label]))
    return
  }
  
  await updateDonor(name, value, () => {
    donor.data[name] = value
    callback?.()
  })
}

async function deleteDonor(name) {
  try {
    await call('frappe.client.delete', {
      doctype: 'Donor',
      name,
    })
    
    // Show success message
    toast.success(__('Donor deleted successfully'))
    
    // Redirect to donor list
    router.push({ name: 'Donor' })
  } catch (error) {
    console.error('Error deleting donor:', error)
    
    // Show error message
    toast.error(__('Failed to delete donor. Please try again.'))
    
    // Extract error message if available
    let errorMessage = __('Failed to delete donor')
    if (error?.exc) {
      errorMessage = error.exc
    } else if (error?.message) {
      errorMessage = error.message
    } else if (typeof error === 'string') {
      errorMessage = error
    }
    
    toast.error(errorMessage)
  }
}

async function deleteDonorWithModal(name) {
  try {
    // Use browser's native confirm dialog as fallback
    const confirmed = window.confirm(__('Are you sure you want to delete this donor? This action cannot be undone.'))
    
    if (confirmed) {
      await deleteDonor(name)
    }
  } catch (error) {
    console.error('Error in delete confirmation:', error)
    // Fallback to direct deletion if confirmation fails
    if (window.confirm(__('Delete donor? This action cannot be undone.'))) {
      await deleteDonor(name)
    }
  }
}



function reloadAssignees(data) {
  if (data?.hasOwnProperty('donor_owner')) {
    assignees.reload()
  }
}



const activities = ref(null)

function openEmailBox() {
  let currentTab = tabs.value[tabIndex.value]
  if (!['Emails', 'Comments', 'Activities'].includes(currentTab.name)) {
    activities.value.changeTabTo('emails')
  }
  nextTick(() => (activities.value.emailBox.show = true))
}

async function saveChanges(data) {
  // Validate before saving
  const isValid = await validateBeforeSave()
  if (!isValid) {
    return // Don't save if validation fails
  }
  
  donorDocument.save.submit(null, {
    onSuccess: () => reloadAssignees(data),
  })
}

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
  donorDocument.doc.default_currency = code
  if (!code) {
    donorDocument.doc._default_currency_readonly = false
  } else {
    donorDocument.doc._default_currency_readonly = true
  }
}

watch(() => donorDocument.doc?.country, (newCountry) => {
  if (newCountry && donorDocument.doc) {
    setCurrencyForCountry(newCountry)
  }
})

// Watch for refresh parameter changes
watch(() => route.query.refresh, (newRefresh) => {
  if (newRefresh) {
    // Clear cache and force reload
    donor.cache = ['donor', props.donorId, Date.now()]
    donor.reload()
    // Clear the refresh parameter from URL
    router.replace({ 
      name: 'DonorDetail', 
      params: { donorId: props.donorId },
      query: {} 
    })
  }
}, { immediate: true })

// Reapply masks when orgs_country changes for org-specific fields
watch(() => donorDocument.doc?.orgs_country, async (newCountry, oldCountry) => {
  if (newCountry && oldCountry && newCountry !== oldCountry) {
    const clearPhoneField = (el) => {
      if (!el) return
      el.parentNode?.querySelectorAll('.country-prefix, .pakistan-prefix, .phone-error-message')?.forEach(n => n.remove())
      el.style.paddingLeft = ''
      el.style.position = ''
      if (el.parentNode) el.parentNode.style.position = ''
      el.classList.remove('border-red-500', 'border-green-500')
    }
    clearPhoneField(findInputField('org_representative_contact_number'))
    clearPhoneField(findInputField('org_contact'))

    setTimeout(async () => {
      await applyPhoneMasksForCountry(newCountry, setFieldValue, ['org_representative_contact_number','org_contact'])
    }, 200)
  }
}, { immediate: true })

// Apply org masks when donor type implies organization
watch(() => donorDocument.doc?.donor_type, async (newType) => {
  if (!newType) return
  if ((newType === 'Organizational' || newType === 'Organization' || newType === 'Corporate Donors') && donorDocument.doc?.orgs_country) {
    setTimeout(() => applyPhoneMasksForCountry(donorDocument.doc.orgs_country, setFieldValue, ['org_representative_contact_number','org_contact']), 200)
  }
})


watch(() => donorDocument.doc?.email, (newEmail) => {
  if (newEmail && newEmail.trim() !== '' && donorDocument.doc) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newEmail.trim())) {
      showEmailValidationFeedback('email', false, 'Invalid email format. Please enter a valid email address.')
    } else {
      showEmailValidationFeedback('email', true, '')
    }
  } else {
    showEmailValidationFeedback('email', true, '')
  }
})

watch(() => donorDocument.doc?.co_email, (newCoEmail) => {
  if (newCoEmail && newCoEmail.trim() !== '' && donorDocument.doc) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newCoEmail.trim())) {
      showEmailValidationFeedback('co_email', false, 'Invalid email format. Please enter a valid email address.')
    } else {
      showEmailValidationFeedback('co_email', true, '')
    }
  } else {
    showEmailValidationFeedback('co_email', true, '')
  }
})

watch(() => donorDocument.doc?.company_email_address, (newCompanyEmail) => {
  if (newCompanyEmail && newCompanyEmail.trim() !== '' && donorDocument.doc) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newCompanyEmail.trim())) {
      showEmailValidationFeedback('company_email_address', false, 'Invalid email format. Please enter a valid email address.')
    } else {
      showEmailValidationFeedback('company_email_address', true, '')
    }
  } else {
    showEmailValidationFeedback('company_email_address', true, '')
  }
})

watch(() => donorDocument.doc?.representative_email, (newRepresentativeEmail) => {
  if (newRepresentativeEmail && newRepresentativeEmail.trim() !== '' && donorDocument.doc) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newRepresentativeEmail.trim())) {
      showEmailValidationFeedback('representative_email', false, 'Invalid email format. Please enter a valid email address.')
    } else {
      showEmailValidationFeedback('representative_email', true, '')
    }
  } else {
    showEmailValidationFeedback('representative_email', true, '')
  }
})

watch(() => donorDocument.doc?.org_email, (newOrgEmail) => {
  if (newOrgEmail && newOrgEmail.trim() !== '' && donorDocument.doc) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newOrgEmail.trim())) {
      showEmailValidationFeedback('org_email', false, 'Invalid email format. Please enter a valid email address.')
    } else {
      showEmailValidationFeedback('org_email', true, '')
    }
  } else {
    showEmailValidationFeedback('org_email', true, '')
  }
})

watch(() => donorDocument.doc?.donor_email, (newDonorEmail) => {
  if (newDonorEmail && newDonorEmail.trim() !== '' && donorDocument.doc) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newDonorEmail.trim())) {
      showEmailValidationFeedback('donor_email', false, 'Invalid email format. Please enter a valid email address.')
    } else {
      showEmailValidationFeedback('donor_email', true, '')
    }
  } else {
    showEmailValidationFeedback('donor_email', true, '')
  }
})

// Watch for phone field changes to provide real-time validation
watch(() => donorDocument.doc?.contact_no, async (newContactNo) => {
  if (newContactNo && donorDocument.doc?.country && donorDocument.doc) {
    const validation = await validatePhoneNumber(newContactNo, donorDocument.doc.country)
    if (validation && validation.isValid !== undefined) {
      showPhoneValidationFeedback('contact_no', validation.isValid, validation.message)
    }
  } else if (donorDocument.doc?.country && donorDocument.doc.country !== 'Pakistan' && donorDocument.doc.country !== 'pakistan' && donorDocument.doc) {
    const validation = await validatePhoneNumber('', donorDocument.doc.country)
    if (validation && validation.isValid !== undefined) {
      showPhoneValidationFeedback('contact_no', validation.isValid, validation.message)
    }
  }
})

watch(() => donorDocument.doc?.co_contact_no, async (newCoContactNo) => {
  if (newCoContactNo && donorDocument.doc?.country && donorDocument.doc) {
    const validation = await validatePhoneNumber(newCoContactNo, donorDocument.doc.country)
    if (validation && validation.isValid !== undefined) {
      showPhoneValidationFeedback('co_contact_no', validation.isValid, validation.message)
    }
  } else if (donorDocument.doc?.country && donorDocument.doc.country !== 'Pakistan' && donorDocument.doc.country !== 'pakistan' && donorDocument.doc) {
    const validation = await validatePhoneNumber('', donorDocument.doc.country)
    if (validation && validation.isValid !== undefined) {
      showPhoneValidationFeedback('co_contact_no', validation.isValid, validation.message)
    }
  }
})

watch(() => donorDocument.doc?.company_contact_number, async (newCompanyContact) => {
  if (newCompanyContact && donorDocument.doc?.country && donorDocument.doc) {
    const validation = await validatePhoneNumber(newCompanyContact, donorDocument.doc.country)
    if (validation && validation.isValid !== undefined) {
      showPhoneValidationFeedback('company_contact_number', validation.isValid, validation.message)
    }
  } else if (donorDocument.doc?.country && donorDocument.doc.country !== 'Pakistan' && donorDocument.doc.country !== 'pakistan' && donorDocument.doc) {
    const validation = await validatePhoneNumber('', donorDocument.doc.country)
    if (validation && validation.isValid !== undefined) {
      showPhoneValidationFeedback('company_contact_number', validation.isValid, validation.message)
    }
  }
})

watch(() => donorDocument.doc?.organization_contact_person, async (newOrgContact) => {
  if (newOrgContact && donorDocument.doc?.country && donorDocument.doc) {
    const validation = await validatePhoneNumber(newOrgContact, donorDocument.doc.country)
    if (validation && validation.isValid !== undefined) {
      showPhoneValidationFeedback('organization_contact_person', validation.isValid, validation.message)
    }
  } else if (donorDocument.doc?.country && donorDocument.doc.country !== 'Pakistan' && donorDocument.doc.country !== 'pakistan' && donorDocument.doc) {
    const validation = await validatePhoneNumber('', donorDocument.doc.country)
    if (validation && validation.isValid !== undefined) {
      showPhoneValidationFeedback('organization_contact_person', validation.isValid, validation.message)
    }
  }
  
})

// Organization contacts: real-time validation based on orgs_country
watch(() => donorDocument.doc?.org_representative_contact_number, async (newVal) => {
  const country = donorDocument.doc?.orgs_country
  if (newVal && country && donorDocument.doc) {
    const validation = await validatePhoneNumber(newVal, country)
    if (validation && validation.isValid !== undefined) {
      showPhoneValidationFeedback('org_representative_contact_number', validation.isValid, validation.message)
    }
  }
})

watch(() => donorDocument.doc?.org_contact, async (newVal) => {
  const country = donorDocument.doc?.orgs_country
  if (newVal && country && donorDocument.doc) {
    const validation = await validatePhoneNumber(newVal, country)
    if (validation && validation.isValid !== undefined) {
      showPhoneValidationFeedback('org_contact', validation.isValid, validation.message)
    }
  }
})

watch(() => donorDocument.doc, (newDoc) => {
  if (newDoc) {
    setTimeout(async () => {
      if (newDoc.country) {
        await applyPhoneMasksForCountry(newDoc.country, setFieldValue)
      }
      if (newDoc.orgs_country) {
        await applyPhoneMasksForCountry(newDoc.orgs_country, setFieldValue, ['org_representative_contact_number','org_contact'])
      }
      if (newDoc.identification_type) {
        applyCnicMaskToInput('cnic', newDoc.identification_type, setFieldValue)
      }
    }, 300)
  }
}, { immediate: true })

// Watch for identification type changes to reapply CNIC masks
watch(() => donorDocument.doc?.identification_type, (newType, oldType) => {
  if (newType && oldType && newType !== oldType) {
    // Only clear CNIC field if user actually changed the identification type
    // Don't clear on component initialization or re-renders
    if (donorDocument.doc) {
      donorDocument.doc.cnic = ""
    }
    
    // Apply masking to CNIC field when identification type changes
    setTimeout(() => {
      applyCnicMaskToInput('cnic', newType, setFieldValue)
    }, 100)
  }
}, { immediate: true })

// Watch for country changes to reapply phone masks
watch(() => donorDocument.doc?.country, async (newCountry, oldCountry) => {
  if (newCountry && oldCountry && newCountry !== oldCountry) {
    // Only clear phone fields if user actually changed the country
    // Don't clear on component initialization or re-renders
    const phoneFields = ['contact_no', 'co_contact_no', 'company_contact_number', 'organization_contact_person']
    phoneFields.forEach(field => {
      if (donorDocument.doc && donorDocument.doc[field] !== undefined) {
        donorDocument.doc[field] = ""
      }
    })
    
    // Apply phone masks for the new country
    setTimeout(async () => {
      await applyPhoneMasksForCountry(newCountry, setFieldValue)
    }, 200)
  }
}, { immediate: true })

onMounted(() => {
  if (donorDocument.doc?.country) {
    setCurrencyForCountry(donorDocument.doc.country)
  }
  
  if (route.query.refresh) {
    donor.cache = ['donor', props.donorId, Date.now()]
    donor.reload()
    router.replace({ 
      name: 'DonorDetail', 
      params: { donorId: props.donorId },
      query: {} 
    })
  }
  
  setTimeout(async () => {
    const startTime = performance.now()
    console.log('onMounted: Starting validation initialization')
    
    // Initialize CNIC and phone masking
    if (donorDocument.doc?.identification_type) {
      applyCnicMaskToInput('cnic', donorDocument.doc.identification_type, setFieldValue)
    }
    
    if (donorDocument.doc?.country) {
      await applyPhoneMasksForCountry(donorDocument.doc.country, setFieldValue)
    }
    if (donorDocument.doc?.orgs_country) {
      await applyPhoneMasksForCountry(donorDocument.doc.orgs_country, setFieldValue, ['org_representative_contact_number','org_contact'])
    }
    
    // removed save interception
    
    const fieldLayout = globalThis.document.querySelector('.field-layout-wrapper')
    if (fieldLayout) {
      const fieldLayoutObserver = new MutationObserver(() => {
        setTimeout(() => {
          const cnicInput = findInputField('cnic')
          const contactInput = findInputField('contact_no')

          if (cnicInput && !cnicInput._maskHandler && donorDocument.doc?.identification_type) {
            applyCnicMaskToInput('cnic', donorDocument.doc.identification_type, setFieldValue)
          }

          if (donorDocument.doc?.country) {
            applyPhoneMasksForCountry(donorDocument.doc.country, setFieldValue)
          }
          if (donorDocument.doc?.orgs_country) {
            applyPhoneMasksForCountry(donorDocument.doc.orgs_country, setFieldValue, ['org_representative_contact_number','org_contact'])
          }
        }, 200)
      })

      fieldLayoutObserver.observe(fieldLayout, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class','style']
      })

      window.fieldLayoutObserver = fieldLayoutObserver
    }
    
    const modalContent = globalThis.document.querySelector('[data-modal="parent"]')
    if (modalContent) {
      const modalObserver = new MutationObserver(() => {
        // Only reapply masks if they're actually missing, not on every DOM change
        setTimeout(() => {
          const cnicInput = findInputField('cnic')
          const contactInput = findInputField('contact_no')
          
          // Only reapply CNIC mask if it's missing
          if (cnicInput && !cnicInput._maskHandler && donorDocument.doc?.identification_type) {
            applyCnicMaskToInput('cnic', donorDocument.doc.identification_type, setFieldValue)
          }
          
          // Only reapply phone masks if they're missing
          if (contactInput && !contactInput._pakistanHandler && !contactInput._otherCountryHandler && donorDocument.doc?.country) {
            applyPhoneMasksForCountry(donorDocument.doc.country, setFieldValue)
          }
        }, 500) // Increased delay to reduce frequency
      })
      
      modalObserver.observe(modalContent, {
        childList: true,
        subtree: false, // Don't watch entire subtree
        attributes: false // Don't watch attribute changes
      })
      
      window.modalObserver = modalObserver
    }
    
    // Removed periodic/aggressive mask monitors
    
    // Set up a global event listener for field layout changes
    const handleFieldLayoutChange = () => {
      console.log('Field layout changed, reapplying masks...')
      setTimeout(reapplyAllMasksNow, 100)
    }
    
    // Listen for custom events that might indicate field layout changes
    document.addEventListener('fieldLayoutChanged', handleFieldLayoutChange)
    document.addEventListener('tabChanged', handleFieldLayoutChange)
    document.addEventListener('activitiesReloaded', handleFieldLayoutChange)
    
    // Store the event listeners for cleanup
    window.fieldLayoutEventListeners = [
      { event: 'fieldLayoutChanged', handler: handleFieldLayoutChange },
      { event: 'tabChanged', handler: handleFieldLayoutChange },
      { event: 'activitiesReloaded', handler: handleFieldLayoutChange }
    ]
    
    // removed save interception and global submit/keyboard overrides
    
    // Removed global window bindings
    
    // Add comprehensive mask reapplication functions
    window.forceReapplyAllMasks = async () => {
      console.log('Force reapplying all masks...')
      
      // Wait a bit for DOM to be ready
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Try to find and reapply masks to all relevant fields
      const cnicInput = findInputField('cnic')
      const contactInput = findInputField('contact_no')
      
      if (cnicInput && donorDocument.doc?.identification_type) {
        console.log('Reapplying CNIC mask...')
        applyCnicMaskToInput('cnic', donorDocument.doc.identification_type, setFieldValue)
      }
      
      if (contactInput && donorDocument.doc?.country) {
        console.log('Reapplying phone masks...')
        await applyPhoneMasksForCountry(donorDocument.doc.country, setFieldValue)
      }
      
      console.log('Force mask reapplication completed')
    }
    
    
  }, 500)
  
})

onUnmounted(() => {
  if (window.fieldLayoutObserver) {
    window.fieldLayoutObserver.disconnect()
    window.fieldLayoutObserver = null
  }
  
  if (window.modalObserver) {
    window.modalObserver.disconnect()
    window.modalObserver = null
  }
  
    if (window.tabChangeObservers) {
    window.tabChangeObservers.forEach(observer => {
      if (observer) {
        observer.disconnect()
      }
    })
    window.tabChangeObservers = []
  }
  
  // Clean up field layout event listeners
  if (window.fieldLayoutEventListeners) {
    window.fieldLayoutEventListeners.forEach(({ event, handler }) => {
      document.removeEventListener(event, handler)
    })
    window.fieldLayoutEventListeners = []
  }
})


let saveInterceptRetryCount = 0
const MAX_SAVE_INTERCEPT_RETRIES = 5

function interceptSave() {
  const saveSelectors = [
    'button[data-action="save"]',
    'button[data-action="Save"]',
    'button[data-action="submit"]',
    'button[data-action="Submit"]',
    'button[type="submit"]',
    '.btn-save',
    '.btn-submit',
    '[data-testid="save-button"]',
    '[data-testid="submit-button"]',
    'button:contains("Save")',
    'button:contains("save")'
  ]
  
  let saveButton = null
  for (const selector of saveSelectors) {
    saveButton = document.querySelector(selector)
    if (saveButton) break
  }
  
  if (saveButton) {
    console.log('interceptSave: Found save button, adding interceptor')
    
    // Remove existing listeners to prevent duplicates
    const newSaveButton = saveButton.cloneNode(true)
    saveButton.parentNode.replaceChild(newSaveButton, saveButton)
    
    newSaveButton.addEventListener('click', async (e) => {
      e.preventDefault()
      e.stopPropagation()
      
      console.log('interceptSave: Save button clicked, validating form')
      
      // Validate before allowing save
      const isValid = await validateBeforeSave()
      if (!isValid) {
        console.log('interceptSave: Validation failed, preventing save')
        return
      }
      
      console.log('interceptSave: Save allowed')
      
      const originalClickEvent = new Event('click', { bubbles: true })
      newSaveButton.dispatchEvent(originalClickEvent)
    })
    
    // Reset retry count on success
    saveInterceptRetryCount = 0
  } else {
    saveInterceptRetryCount++
    
    if (saveInterceptRetryCount < MAX_SAVE_INTERCEPT_RETRIES) {
      console.log(`interceptSave: Save button not found, retry ${saveInterceptRetryCount}/${MAX_SAVE_INTERCEPT_RETRIES}`)
      setTimeout(interceptSave, 2000) // Increase delay to 2 seconds
    } else {
      console.log('interceptSave: Max retries reached, giving up on save button interception')
    }
  }
}

</script>