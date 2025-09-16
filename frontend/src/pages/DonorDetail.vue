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
// import Icon from '@/components/Icon.vue'
// import DataFields from '@/components/Activities/DataFields.vue'
const FilesUploader = defineAsyncComponent({
  loader: () => import('@/components/FilesUploader/FilesUploader.vue'),
  loadingComponent: LoadingSpinner,
})
// import FieldLayout from '@/components/FieldLayout/FieldLayout.vue'
import SLASection from '@/components/SLASection.vue'
import IndicatorIcon from '@/components/Icons/IndicatorIcon.vue'
import CameraIcon from '@/components/Icons/CameraIcon.vue'
import LinkIcon from '@/components/Icons/LinkIcon.vue'
import AttachmentIcon from '@/components/Icons/AttachmentIcon.vue'
// import EditIcon from '@/components/Icons/EditIcon.vue'
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
  // setupCustomizations,
  copyToClipboard,
  validateIsImageFile,
} from '@/utils'
// import { showQuickEntryModal, quickEntryProps } from '@/composables/modals'
// import { getView } from '@/utils/view'
// import { capture } from '@/telemetry'
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
// import ViewBreadcrumbs from '@/components/ViewBreadcrumbs.vue'
const CreateDocumentModal = defineAsyncComponent({
  loader: () => import('@/components/Modals/CreateDocumentModal.vue'),
  loadingComponent: LoadingSpinner,
})

// import { useInputMask } from '@/composables/useInputMask'
import { useDonorFieldValidation } from '@/composables/useDonorFieldValidation'
import { countryCurrencyMap, getCurrencyForCountry } from '@/constants/countryCurrencyMap'

const { brand } = getSettings()
const { user } = sessionStore()
const { isManager } = usersStore()
const { $dialog, $socket, makeCall } = globalStore()
const { statusOptions, getLeadStatus, getDealStatus } = statusesStore()
const { doctypeMeta } = getMeta('Donor')

const { updateOnboardingStep } = useOnboarding('frappecrm')

const {
  showCnicExistsDialog,
  cnicExistsMessage,
  showCnicValidationDialog,
  cnicValidationMessage,
  validateCnicFormat,
  validatePhoneNumber
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

const overrideDocumentSave = () => {
  if (donorDocument?.save?.submit && !donorDocument.save._validationOverridden) {
    const originalSubmit = donorDocument.save.submit
    donorDocument.save.submit = async function(data, options) {
      const isValid = await validateBeforeSave()
      if (!isValid) return
      return originalSubmit.call(this, data, options)
    }
    donorDocument.save._validationOverridden = true
  }
}

async function validateFormNow() {
  return await validateBeforeSave()
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


const originalSave = window.save || window.Save
if (originalSave && typeof originalSave === 'function') {
  window.save = async function(...args) {
    if (donorDocument?.doc?.doctype === 'Donor') {
      const isValid = await validateBeforeSave()
      if (!isValid) return false
    }
    return originalSave.apply(this, args)
  }
  window.Save = window.save
}

overrideDocumentSave()

watch(() => donorDocument, () => {
  if (donorDocument?.save) {
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
    const foaRequiredFields = ['co_name', 'co_contact_no', 'co_email', 'co_address', 'relationship_with_donor', 'area', 'co_city', 'co_country']
    if (foaRequiredFields.includes(fieldname) && (!value || value.toString().trim() === '')) {
      const fieldLabels = {
        'co_name': 'C/O Name',
        'co_contact_no': 'C/O Contact No',
        'co_email': 'C/O Email',
        'co_address': 'C/O Address',
        'relationship_with_donor': 'Relationship With Donor',
        'area':  'C/O Area',
        'co_city': 'C/O City',
        'co_country': 'C/O Country'

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

function showEmailValidationFeedback(fieldName, isValid, message) {
  nextTick(() => {
    let inputElement = globalThis.document.querySelector(`input[name="${fieldName}"]`) ||
                     globalThis.document.querySelector(`[data-name="${fieldName}"] input`) ||
                     globalThis.document.querySelector(`[data-fieldname="${fieldName}"] input`)
    
    if (!inputElement?.parentNode) return
    
    const existingMessages = inputElement.parentNode.querySelectorAll('.email-error-message')
    existingMessages?.forEach(msg => msg.remove())
    
    inputElement.classList.remove('border-red-500', 'border-green-500')
    
    if (!isValid) {
      inputElement.classList.add('border-red-500')
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
      const errorElement = inputElement.parentNode.querySelector('.email-error-message')
      if (errorElement) errorElement.remove()
    }
  })
}



async function validateBeforeSave() {
  const errors = []
  
  if (donorDocument.doc?.identification_type && donorDocument.doc?.identification_type !== 'Others') {
    if (!donorDocument.doc?.cnic || donorDocument.doc.cnic.trim() === '') {
      errors.push('CNIC is required when identification type is set')
    } else if (!validateCnicFormat(donorDocument.doc.cnic, donorDocument.doc.identification_type)) {
      errors.push(`Invalid ${donorDocument.doc.identification_type} format. Please enter a valid ${donorDocument.doc.identification_type} number.`)
    }
  }
  
  if (donorDocument.doc?.country) {
    const generalPhoneFields = [
      'contact_no', 'company_contact_number', 'organization_contact_person',
      'representative_mobile', 'mobile_no', 'phone_no', 'company_ownerceo_conatct'
    ]

    for (const fieldName of generalPhoneFields) {
      const value = donorDocument.doc[fieldName]
      if (value && value.toString().trim() !== '') {
        const validation = await validatePhoneNumber(value.toString().trim(), donorDocument.doc.country)
        if (!validation.isValid) {
          const fieldLabels = {
            contact_no: 'Contact Number',
            company_contact_number: 'Company Contact Number',
            organization_contact_person: 'Organization Contact Person',
            representative_mobile: 'Representative Mobile Number',
            mobile_no: 'Mobile No',
            phone_no: 'Phone No',
            company_ownerceo_conatct: 'Company Owner/CEO Contact'
          }
          const message = donorDocument.doc.country === 'Pakistan' 
            ? 'Pakistan phone number must be 10 digits and start with valid mobile prefix (30-39). Example: 348-8903564'
            : validation.message
          errors.push(`${fieldLabels[fieldName] || fieldName}: ${message}`)
        }
      }
    }
  }

  if (donorDocument.doc?.orgs_country) {
    const orgPhoneFields = ['org_representative_contact_number', 'org_contact']
    for (const fieldName of orgPhoneFields) {
      const value = donorDocument.doc[fieldName]
      if (value && value.toString().trim() !== '') {
        const validation = await validatePhoneNumber(value.toString().trim(), donorDocument.doc.orgs_country)
        if (!validation.isValid) {
          const fieldLabels = {
            org_representative_contact_number: 'Organization Representative Contact Number',
            org_contact: 'Organization Contact Number'
          }
          errors.push(`${fieldLabels[fieldName] || fieldName}: ${validation.message}`)
        }
      }
    }
  }
  
  if (donor.fields_meta) {
    for (const [fieldname, meta] of Object.entries(donor.fields_meta)) {
      if (meta.reqd && donorDocument.doc && (!donorDocument.doc[fieldname] || donorDocument.doc[fieldname].toString().trim() === '')) {
        errors.push(`${meta.label || fieldname} is a required field`)
      }
    }
  }
  
  const criticalFields = ['donor_name', 'email']
  for (const fieldname of criticalFields) {
    if (donorDocument.doc && (!donorDocument.doc[fieldname] || donorDocument.doc[fieldname].toString().trim() === '')) {
      const fieldLabel = donor.fields_meta?.[fieldname]?.label || fieldname
      errors.push(`${fieldLabel} is a required field`)
    }
  }
  
  if (!donorDocument.doc?.department || donorDocument.doc.department.toString().trim() === '') {
    errors.push('Department is required')
  }
  
  if (!donorDocument.doc?.donor_desk || donorDocument.doc.donor_desk.toString().trim() === '') {
    errors.push('Donor Desk is required')
  }
  
  if (donorDocument.doc?.foa === 1 || donorDocument.doc?.foa === true || donorDocument.doc?.foa == 1 || !!donorDocument.doc?.foa) {
    const foaFields = [
      { field: 'co_name', label: 'C/O Name' },
      { field: 'co_contact_no', label: 'C/O Contact No' },
      { field: 'co_email', label: 'C/O Email' },
      { field: 'co_address', label: 'C/O Address' },
      { field: 'relationship_with_donor', label: 'Relationship With Donor' },
      { field: 'area', label: 'C/O Area' },
      { field: 'co_city', label: 'C/O City' },
      { field: 'co_country', label: 'C/O Country' }
    ]
    
    for (const { field, label } of foaFields) {
      if (!donorDocument.doc?.[field] || donorDocument.doc[field].toString().trim() === '') {
        errors.push(`${label} is required when FOA is enabled`)
      }
    }
    
    if (donorDocument.doc?.co_contact_no && donorDocument.doc.co_contact_no.toString().trim() !== '' && donorDocument.doc?.country) {
      const coPhoneValidation = await validatePhoneNumber(donorDocument.doc.co_contact_no.toString().trim(), donorDocument.doc.country)
      if (!coPhoneValidation.isValid) {
        const message = donorDocument.doc.country === 'Pakistan' 
          ? 'Pakistan phone number must be 10 digits and start with valid mobile prefix (30-39). Example: 348-8903564'
          : coPhoneValidation.message
        errors.push(`C/O Contact Number: ${message}`)
      }
    }
    
    if (donorDocument.doc?.co_email && donorDocument.doc.co_email.toString().trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(donorDocument.doc.co_email.toString().trim())) {
        errors.push('Invalid C/O Email format. Please enter a valid email address.')
      }
    }
  }
  
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



async function updateDonor(fieldname, value, callback) {
  value = Array.isArray(fieldname) ? '' : value

  if (!Array.isArray(fieldname) && await validateRequired(fieldname, value)) return
  
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
      
      if (msg.includes('TimestampMismatchError') || 
          msg.includes('Document has been modified') ||
          msg.includes('Please refresh to get the latest document')) {
        toast.error(__('Document has been modified. Refreshing donor details...'))
        setTimeout(() => {
          donor.cache = ['donor', props.donorId, Date.now()]
          donor.reload()
        }, 1000)
      } else {
        toast.error(msg)
      }
    },
  })
}







watch(
  () => donor.data?.foa,
  (newFoa) => {
    if (newFoa === 1 || newFoa === true || newFoa == 1 || !!newFoa) {
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

watch(tabIndex, async (newTabIndex, oldTabIndex) => {
  if (newTabIndex !== oldTabIndex) {
    await nextTick()
    document.dispatchEvent(new CustomEvent('tabChanged', { 
      detail: { 
        newTabIndex, 
        oldTabIndex,
        tabName: tabs.value[newTabIndex]?.name 
      } 
    }))
  }
})

watch(() => reload.value, async (newReload, oldReload) => {
  if (newReload !== oldReload && newReload) {
    await nextTick()
  }
})

watch(() => activities.value, async (newActivities, oldActivities) => {
  if (newActivities && newActivities !== oldActivities) {
    await nextTick()
  }
}, { deep: true })

const donorStatusOptions = computed(() => [
  {
    label: __('Active'),
    value: 'Active',
    icon: () => h(IndicatorIcon, { class: 'text-green-500' }),
    onClick: () => updateDonorStatus('Active')
  },
  {
    label: __('Blocked'),
    value: 'Blocked',
    icon: () => h(IndicatorIcon, { class: 'text-red-500' }),
    onClick: () => updateDonorStatus('Blocked')
  }
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
    const result = await call('crm.fcrm.doctype.donor.api.update_donor_status', {
      name: donor.data.name,
      status: newStatus
    })
    
    if (result.success) {
      donor.data.status = newStatus
      donorDocument.doc.status = newStatus
      toast.success(__('Status updated successfully'))
      
      donor.cache = ['donor', props.donorId, Date.now()]
      donor.reload()
      
      if (donorDocument?.reload) {
        donorDocument.reload()
      }
    } else {
      toast.error(result.message || __('Failed to update status'))
    }
  } catch (error) {
    const errorMessage = error.message || error.toString()
    if (errorMessage.includes('TimestampMismatchError') || 
        errorMessage.includes('Document has been modified') ||
        errorMessage.includes('Please refresh to get the latest document')) {
      
      toast.error(__('Document has been modified. Refreshing donor details...'))
      
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
  auto: true
})

async function updateField(name, value, callback) {
  const validationResult = await validateRequired(name, value)
  if (validationResult) return
  
  if (donor.fields_meta?.[name]?.reqd && (!value || value.trim() === '')) {
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
    
    toast.success(__('Donor deleted successfully'))
    router.push({ name: 'Donor' })
  } catch (error) {
    console.error('Error deleting donor:', error)

    const friendlyError = (() => {
      let raw = ''
      if (Array.isArray(error?.messages) && error.messages.length) {
        raw = error.messages.join('\n')
      } else if (typeof error?.exc === 'string') {
        raw = error.exc
      } else if (typeof error?.message === 'string') {
        raw = error.message
      } else if (typeof error === 'string') {
        raw = error
      }

      if (!raw) return __('Failed to delete donor. Please try again.')

      let cleaned = raw.replace(/<\/?[^>]+(>|$)/g, '')
      cleaned = cleaned.replace(/\s+/g, ' ').trim()

      if (/Cannot delete or cancel because/i.test(cleaned) || /LinkExistsError/i.test(cleaned) || /is linked with/i.test(cleaned)) {
        const match = cleaned.match(/linked with\s+(.+?)(?:\s+at\s+Row.*)?$/i)
        const linkedTarget = match && match[1] ? match[1].trim() : ''
        if (linkedTarget) {
          return __('This donor is linked to {0} and cannot be deleted.', [linkedTarget])
        }
        return __('This donor is linked to other records and cannot be deleted.')
      }

      return cleaned || __('Failed to delete donor. Please try again.')
    })()

    toast.error(friendlyError)
  }
}

async function deleteDonorWithModal(name) {
  try {
    const confirmed = window.confirm(__('Are you sure you want to delete this donor? This action cannot be undone.'))
    if (confirmed) {
      await deleteDonor(name)
    }
  } catch (error) {
    console.error('Error in delete confirmation:', error)
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
  const isValid = await validateBeforeSave()
  if (!isValid) return
  
  donorDocument.save.submit(null, {
    onSuccess: () => reloadAssignees(data),
  })
}


function setCurrencyForCountry(country) {
  const code = getCurrencyForCountry(country)
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

watch(() => route.query.refresh, (newRefresh) => {
  if (newRefresh) {
    donor.cache = ['donor', props.donorId, Date.now()]
    donor.reload()
    router.replace({ 
      name: 'DonorDetail', 
      params: { donorId: props.donorId },
      query: {} 
    })
  }
}, { immediate: true })


const emailFields = ['email', 'co_email', 'company_email_address', 'representative_email', 'org_email', 'donor_email']

emailFields.forEach(fieldName => {
  watch(() => donorDocument.doc?.[fieldName], (newEmail) => {
    if (newEmail && newEmail.trim() !== '' && donorDocument.doc) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      const isValid = emailRegex.test(newEmail.trim())
      showEmailValidationFeedback(fieldName, isValid, isValid ? '' : 'Invalid email format. Please enter a valid email address.')
    } else {
      showEmailValidationFeedback(fieldName, true, '')
    }
  })
})

watch(() => donorDocument.doc, (newDoc) => {
  if (newDoc) {
    // Document changed - masking handled by Field component
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
})

onUnmounted(() => {
  // Cleanup
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
    '[data-testid="submit-button"]'
  ]
  
  let saveButton = null
  for (const selector of saveSelectors) {
    saveButton = document.querySelector(selector)
    if (saveButton) break
  }
  
  if (saveButton) {
    const newSaveButton = saveButton.cloneNode(true)
    saveButton.parentNode.replaceChild(newSaveButton, saveButton)
    
    newSaveButton.addEventListener('click', async (e) => {
      e.preventDefault()
      e.stopPropagation()
      
      const isValid = await validateBeforeSave()
      if (!isValid) return
      
      const originalClickEvent = new Event('click', { bubbles: true })
      newSaveButton.dispatchEvent(originalClickEvent)
    })
    
    saveInterceptRetryCount = 0
  } else {
    saveInterceptRetryCount++
    
    if (saveInterceptRetryCount < MAX_SAVE_INTERCEPT_RETRIES) {
      setTimeout(interceptSave, 2000)
    }
  }
}

</script>