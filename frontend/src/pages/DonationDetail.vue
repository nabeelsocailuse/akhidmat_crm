<template>
  <AppStyling type="detail-background">
    <LayoutHeader v-if="document.doc">
      <template #left-header>
        <Breadcrumbs :items="breadcrumbs" />
      </template>
      <template #right-header>
        <CustomActions
          v-if="document.doc.actions?.length"
          :actions="document.doc.actions"
        />
        <Dropdown
          v-if="document.doc"
          :options="donationStatusOptions"
        >
          <template #default="{ open }">  
            <Button :label="document.doc.status || 'Draft'">
              <template #prefix>
                <IndicatorIcon :class="getDonationStatus(document.doc.status).color" />
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
          :data="document.doc"
          doctype="Donation"
        />
        <Button label="Print" @click="printDonation" />
        <Button label="PDF" @click="openDonationPDF" />
        <Button 
          v-if="document.doc && document.doc.docstatus === 0 && document.doc.status === 'Draft'"
          label="Submit" 
          variant="solid"
          @click="submitDonation"
        />
        <Dropdown
          v-if="document.doc && document.doc.docstatus === 1"
          :options="createDropdownOptions"
        >
          <template #default="{ open }">
            <Button label="Create">
              <template #suffix>
                <FeatherIcon
                  :name="open ? 'chevron-up' : 'chevron-down'"
                  class="h-4"
                />
              </template>
            </Button>
          </template>
        </Dropdown>
      </template>
    </LayoutHeader>
    
    <div v-if="document.doc" class="flex h-full overflow-hidden">
      <Tabs as="div" v-model="tabIndex" :tabs="tabs">
        <template #tab-panel>
          <Activities
            v-if="document.doc && document.doc.name"
            ref="activities"
            doctype="Donation"
            :docname="document.doc.name"
            :tabs="tabs"
            :hideSaveButton="isReadOnly"
            :readOnly="isReadOnly"
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
          @click="handleCopyToClipboard(document.doc.name)"
        >
          {{ __(document.doc.name) }}
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
                  :image="document.doc.image"
                />
                <component
                  :is="document.doc.image ? Dropdown : 'div'"
                  v-bind="
                    document.doc.image
                      ? {
                          options: [
                            {
                              icon: 'upload',
                              label: document.doc.image
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
                    class="flex h-3 w-3 cursor-pointer items-center justify-center rounded-full bg-white shadow-sm"
                  >
                    <CameraIcon class="h-2 w-2 text-gray-600" />
                  </div>
                </component>
              </div>
              <div class="flex flex-col">
                <div class="text-base font-medium text-gray-900">
                  {{ title }}
                </div>
                <div class="text-sm text-gray-500">
                  {{ donorName || __('No donor name') }}
                </div>
              </div>
            </div>
          </template>
        </FileUploader>
        
        <SLASection
          v-if="document.doc.sla_status"
          v-model="document.doc"
          @updateField="updateField"
        />
        
        <div
          v-if="sections.data"
          class="flex flex-1 flex-col justify-between overflow-hidden"
        >
          <SidePanelLayout
            :sections="sections.data"
            doctype="Donation"
            :docname="document.doc.name"
            :readOnly="isReadOnly"
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
  
  <div v-if="showPrintModal" class="fixed inset-0 z-50 flex items-center justify-center">
    <div class="absolute inset-0 bg-black/50" @click="closePrintModal"></div>
    <div class="relative z-10 w-[420px] rounded-lg bg-white shadow-xl">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <div class="text-base font-medium">{{ __('Select Print Format') }}</div>
        <button class="rounded px-2 py-1 text-sm text-gray-600 hover:bg-gray-100" @click="closePrintModal">{{ __('Close') }}</button>
      </div>
      <div class="space-y-2 px-4 py-4">
        <label class="block text-sm text-gray-700">{{ __('Print Format') }}</label>
        <select
          class="block w-full rounded border px-3 py-2 text-sm"
          v-model="selectedPrintFormat"
        >
          <option value="" disabled>{{ loadingFormats ? __('Loading...') : __('Select a format') }}</option>
          <option v-for="f in printFormats" :key="f.name" :value="f.name">{{ f.name }}</option>
        </select>
      </div>
      <div class="flex items-center justify-end gap-2 border-t px-4 py-3">
        <button class="rounded px-3 py-1.5 text-sm hover:bg-gray-100" @click="closePrintModal">{{ __('Cancel') }}</button>
        <button
          class="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="!selectedPrintFormat || loadingFormats"
          @click="confirmPrint"
        >
          {{ __('Print') }}
        </button>
      </div>
    </div>
  </div>
  
  <FilesUploader
    v-if="document.doc?.name"
    v-model="showFilesUploader"
    doctype="Donation"p
    :docname="document.doc.name"
    @after="() => { activities?.all_activities?.reload(); changeTabTo('attachments') }"
  />
  
  <DeleteLinkedDocModal
    v-if="showDeleteLinkedDocModal"
    v-model="showDeleteLinkedDocModal"
    :doctype="'Donation'"
    :docname="props.donationId"
    name="Donations"
  />
  
  <!-- Make sure the custom triggerOnRowRemove is provided to child components -->
  <FieldLayout 
    v-if="tabs.data" 
    :tabs="filteredTabs" 
    :data="document.doc" 
    :doctype="'Donation'"
    :readOnly="isReadOnly"
    :triggerOnChange="customTriggerOnChange"
    :triggerOnRowRemove="customTriggerOnRowRemove"
    @open-create-modal="openCreateModal"
    @tab-change="handleTabChange"
    @donor-selected="handleDonorSelected"
    @fund-class-selected="handleFundClassSelected"
    @add-deduction-row="handleAddDeductionRow"
  />
</template>

<script setup>
import LayoutHeader from '@/components/LayoutHeader.vue'
import Breadcrumbs from '@/components/Breadcrumbs.vue'
import CustomActions from '@/components/CustomActions.vue'
import AssignTo from '@/components/AssignTo.vue'
import Activities from '@/components/Activities/Activities.vue'
import SidePanelLayout from '@/components/SidePanelLayout.vue'
import Resizer from '@/components/Resizer.vue'
import ErrorPage from '@/components/ErrorPage.vue'
import Icon from '@/components/Icon.vue'
import DataFields from '@/components/Activities/DataFields.vue'
import FilesUploader from '@/components/FilesUploader/FilesUploader.vue'
import FieldLayout from '@/components/FieldLayout/FieldLayout.vue'
import SLASection from '@/components/SLASection.vue'
import IndicatorIcon from '@/components/Icons/IndicatorIcon.vue'
import CameraIcon from '@/components/Icons/CameraIcon.vue'
import AppStyling from '@/components/AppStyling.vue'
import LinkIcon from '@/components/Icons/LinkIcon.vue'
import AttachmentIcon from '@/components/Icons/AttachmentIcon.vue'
import EditIcon from '@/components/Icons/EditIcon.vue'
import { getMeta } from '@/stores/meta'
import { ref, computed, onMounted, watch } from 'vue'
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
  FormControl,
  Link,
  DatePicker,
  DateTimePicker,
  Checkbox,
} from 'frappe-ui'
import { ref as vueRef, reactive, computed as vueComputed, onMounted as vueOnMounted, watch as vueWatch, nextTick, h } from 'vue'
import ActivityIcon from '@/components/Icons/ActivityIcon.vue'
import EmailIcon from '@/components/Icons/EmailIcon.vue'
import Email2Icon from '@/components/Icons/Email2Icon.vue'
import CommentIcon from '@/components/Icons/CommentIcon.vue'
// removed DonationModal import as return flow no longer uses modal
import DetailsIcon from '@/components/Icons/DetailsIcon.vue'
import PhoneIcon from '@/components/Icons/PhoneIcon.vue'
import TaskIcon from '@/components/Icons/TaskIcon.vue'
import NoteIcon from '@/components/Icons/NoteIcon.vue'
import WhatsAppIcon from '@/components/Icons/WhatsAppIcon.vue'
import { useDocument } from '@/data/document'
import ViewBreadcrumbs from '@/components/ViewBreadcrumbs.vue'
import CreateDocumentModal from '@/components/Modals/CreateDocumentModal.vue'
import DeleteLinkedDocModal from '@/components/DeleteLinkedDocModal.vue'

const { brand } = getSettings()
const { user } = sessionStore()
const { isManager } = usersStore()
const { $dialog, $socket, makeCall } = globalStore()
const { statusOptions, getLeadStatus, getDealStatus } = statusesStore()
const { doctypeMeta } = getMeta('Donation')

const { updateOnboardingStep } = useOnboarding('frappecrm')

const route = useRoute()
const router = useRouter()

const props = defineProps({
  donationId: {
    type: String,
    required: true,
  },
})

const errorTitle = ref('')
const errorMessage = ref('')
const showDeleteLinkedDocModal = ref(false)

const { document, assignees, triggerOnChange } = useDocument('Donation', props.donationId)

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

// Breadcrumbs
const breadcrumbs = computed(() => [
  { label: __('Donations'), route: { name: 'Donations' } },
  { label: document.doc?.name || props.donationId, route: { name: 'DonationDetail', params: { donationId: props.donationId } } }
])

// Get donor name from payment detail rows
const donorName = computed(() => {
  if (document.doc?.payment_detail && document.doc.payment_detail.length > 0) {
    // Get the first payment detail row that has a donor name
    const firstRowWithDonor = document.doc.payment_detail.find(row => row.donor_name)
    if (firstRowWithDonor) {
      return firstRowWithDonor.donor_name
    }
  }
  return null
})

// Title for display
const title = computed(() => {
  if (donorName.value) {
    return donorName.value
  }
  if (document.doc?.name) {
    return document.doc.name
  }
  return __('Donation')
})

// Donation status options
const donationStatusOptions = computed(() => {
  return [
    { label: __('Draft'), value: 'Draft', color: 'text-gray-500' },
    { label: __('Submitted'), value: 'Submitted', color: 'text-blue-500' },
    { label: __('Approved'), value: 'Approved', color: 'text-green-500' },
    { label: __('Rejected'), value: 'Rejected', color: 'text-red-500' },
    { label: __('Cancelled'), value: 'Cancelled', color: 'text-gray-400' }
  ]
})

// Get donation status styling
function getDonationStatus(status) {
  const statusOption = donationStatusOptions.value.find(option => option.value === status)
  return statusOption || { color: 'text-gray-500' }
}

// Tabs configuration
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

const { tabIndex, changeTabTo } = useActiveTabManager(tabs, 'lastDonationTab')

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

// Side panel sections
const sections = createResource({
  url: 'crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_sidepanel_sections',
  cache: ['sidePanelSections', 'Donation'],
  params: { doctype: 'Donation' },
  auto: true,
})

// BULLETPROOF FIX: Override the triggerOnChange to handle deduction_breakeven specially
const originalTriggerOnChange = triggerOnChange

// Create a custom triggerOnChange that preserves user modifications
const customTriggerOnChange = async (fieldname, value, row) => {
  console.log('Custom triggerOnChange called:', { fieldname, value, row })
  
  // CRITICAL: If this is a percentage change in deduction_breakeven, handle it specially
  if (fieldname === 'percentage' && row && document.doc.deduction_breakeven) {
    console.log('Percentage change in deduction_breakeven detected - using special handling')
    
    // Find the row in the deduction_breakeven table
    const deductionRow = document.doc.deduction_breakeven.find(r => r.random_id === row.random_id)
    if (deductionRow) {
      console.log('Found deduction row, updating percentage:', value)
      
      // Update the percentage
      deductionRow.percentage = value
      deductionRow._userModifiedPercentage = true
      deductionRow._lastPercentage = value
      
      // Calculate and update amount
      const calculatedAmount = calculateDeductionAmount(deductionRow)
      if (calculatedAmount !== null) {
        deductionRow.amount = calculatedAmount
        deductionRow.base_amount = calculatedAmount
        console.log(`Updated amount: ${calculatedAmount}`)
      }
      
      // Force reactive update without calling backend API
      document.doc = { ...document.doc }
      
      console.log('Percentage updated successfully without backend API call')
      return // Don't call the original triggerOnChange
    }
  }
  
  // For all other fields, use the original triggerOnChange
  return originalTriggerOnChange(fieldname, value, row)
}

// BULLETPROOF FIX: Enhanced updateField function to prevent reload for deduction_breakeven
async function updateField(name, value, callback) {
  // Validate required fields
  if (await validateRequired(name, value)) {
    return // Block the update if validation fails
  }
  
  // CRITICAL: If updating deduction_breakeven table, don't reload
  if (name === 'deduction_breakeven') {
    console.log('Updating deduction_breakeven table - skipping reload to preserve user modifications')
    
    // Update the document directly without calling backend API
    document.doc.deduction_breakeven = value
    document.data.deduction_breakeven = value
    
    // Trigger callback
    callback?.()
    
    toast.success(__('Deduction breakeven updated successfully'))
    return
  }
  
  // For all other fields, use normal update
  await updateDonation(name, value, () => {
    document.data[name] = value
    callback?.()
  })
}

// BULLETPROOF FIX: Enhanced updateDonation to prevent reload for deduction_breakeven changes
const updateDonation = createResource({
  url: 'frappe.client.set_value',
  makeParams(values) {
    return {
      doctype: 'Donation',
      name: props.donationId,
      fieldname: values.name,
      value: values.value,
    }
  },
  onSuccess: () => {
    // CRITICAL: Don't reload for deduction_breakeven changes - they're handled separately
    if (document.data.fieldname !== 'deduction_breakeven') {
      document.reload()
    }
    
    toast.success(__('Donation updated successfully'))
  },
  onError: (err) => {
    const msg = err.messages?.[0] || err.message || __('Error updating donation')
    
    // Check if it's a timestamp mismatch error
    if (msg.includes('TimestampMismatchError') || 
        msg.includes('Document has been modified') ||
        msg.includes('Please refresh to get the latest document')) {
      
      toast.error(__('Document has been modified. Refreshing donation details...'))
      
      // Refresh only the donation data after a short delay
      setTimeout(() => {
        document.reload()
      }, 1000)
    } else {
      toast.error(msg)
    }
  },
})

// Validation function for required fields
async function validateRequired(fieldname, value) {
  let meta = document.fields_meta || {}
  if (meta[fieldname]?.reqd && !value) {
    toast.error(__('{0} is a required field', [meta[fieldname].label]))
    return true
  }
  return false
}

// Delete donation
async function deleteDonation(name) {
  await call('frappe.client.delete', {
    doctype: 'Donation',
    name,
  })
  router.push({ name: 'Donation' })
}

async function deleteDonationWithModal(name) {
  const confirmed = await $dialog.confirm({
    title: __('Delete Donation'),
    message: __('Are you sure you want to delete this donation? This action cannot be undone.'),
    confirmText: __('Delete'),
    cancelText: __('Cancel'),
    variant: 'danger'
  })
  
  if (confirmed) {
    await deleteDonation(name)
  }
}

// Reload assignees
function reloadAssignees(data) {
  if (data?.hasOwnProperty('donation_owner')) {
    assignees.reload()
  }
}

// COMPREHENSIVE VALIDATION: Function to validate all mandatory fields
async function validateDonationForm() {
  const errors = []
  
  // Main donation mandatory fields (from JSON schema)
  const mainRequiredFields = [
    { field: 'company', label: 'Company' },
    { field: 'donation_type', label: 'Donation Type' },
    { field: 'due_date', label: 'Due Date' }
  ]

  // Check main donation fields
  mainRequiredFields.forEach(({ field, label }) => {
    if (!document.doc[field] || (typeof document.doc[field] === 'string' && document.doc[field].trim() === '')) {
      errors.push(`${label} is required`)
    }
  })

  // Additional business logic required fields
  if (!document.doc.donor_identity || document.doc.donor_identity.trim() === '') {
    errors.push('Donor Identity is required')
  }
  
  if (!document.doc.contribution_type || document.doc.contribution_type.trim() === '') {
    errors.push('Contribution Type is required')
  }
  
  if (!document.doc.posting_date) {
    errors.push('Posting Date is required')
  }
  
  if (!document.doc.currency || document.doc.currency.trim() === '') {
    errors.push('Currency is required')
  }
  
  if (!document.doc.donation_cost_center || document.doc.donation_cost_center.trim() === '') {
    errors.push('Donation Cost Center is required')
  }

  // Payment detail validation
  if (!document.doc.payment_detail || !Array.isArray(document.doc.payment_detail) || document.doc.payment_detail.length === 0) {
    errors.push('At least one payment detail is required')
  } else {
    document.doc.payment_detail.forEach((row, index) => {
      const rowNum = index + 1
      
      // Mandatory fields from JSON schema
      if (!row.donation_amount || row.donation_amount <= 0) {
        errors.push(`Donation Amount for payment detail row ${rowNum} is required and must be greater than 0`)
      }
      
      if (!row.equity_account || row.equity_account.trim() === '') {
        errors.push(`Equity Account for payment detail row ${rowNum} is required`)
      }
      
      if (!row.receivable_account || row.receivable_account.trim() === '') {
        errors.push(`Receivable Account for payment detail row ${rowNum} is required`)
      }
      
      // Business logic required fields
      if (!row.donor_id || row.donor_id.trim() === '') {
        errors.push(`Donor for payment detail row ${rowNum} is required`)
      }
      
      if (!row.fund_class_id || row.fund_class_id.trim() === '') {
        errors.push(`Fund Class for payment detail row ${rowNum} is required`)
      }
      
      if (!row.mode_of_payment || row.mode_of_payment.trim() === '') {
        errors.push(`Mode of Payment for payment detail row ${rowNum} is required`)
      }
      
      // Transaction Type ID is always mandatory
      if (!row.transaction_type_id || row.transaction_type_id.trim() === '') {
        errors.push(`Transaction Type ID for payment detail row ${rowNum} is required`)
      }
      
      // Conditional mandatory fields based on mode of payment
      if (row.mode_of_payment && ['bank', 'Cheque', 'Bank Draft'].includes(row.mode_of_payment)) {
        if (!row.account_paid_to || row.account_paid_to.trim() === '') {
          errors.push(`Account Paid To for payment detail row ${rowNum} is required when Mode of Payment is ${row.mode_of_payment}`)
        }
        
        if (!row.transaction_no_cheque_no || row.transaction_no_cheque_no.trim() === '') {
          errors.push(`Transaction No/ Cheque No for payment detail row ${rowNum} is required when Mode of Payment is ${row.mode_of_payment}`)
        }
        
        if (!row.reference_date) {
          errors.push(`Cheque / Reference Date for payment detail row ${rowNum} is required when Mode of Payment is ${row.mode_of_payment}`)
        }
      }
    })
  }

  // Deduction breakeven validation
  if (document.doc.deduction_breakeven && Array.isArray(document.doc.deduction_breakeven)) {
    for (let index = 0; index < document.doc.deduction_breakeven.length; index++) {
      const row = document.doc.deduction_breakeven[index]
      const rowNum = index + 1
      
      // Basic validation
      if (!row.percentage) {
        errors.push(`Percentage for deduction breakeven row ${rowNum} is required.`)
        continue
      }
      
      // Validate percentage is a valid number
      const percentage = parseFloat(row.percentage)
      if (isNaN(percentage)) {
        errors.push(`Percentage for deduction breakeven row ${rowNum} must be a valid number.`)
        continue
      }
      
      if (percentage < 0) {
        errors.push(`Percentage for deduction breakeven row ${rowNum} cannot be negative.`)
        continue
      }
      
      if (percentage > 100) {
        errors.push(`Percentage for deduction breakeven row ${rowNum} cannot exceed 100%.`)
        continue
      }
      
      // Min/Max validation using the min_percent and max_percent fields from the row
      if (row.min_percent !== null && row.min_percent !== undefined && 
          row.max_percent !== null && row.max_percent !== undefined) {
        
        const minPercentage = parseFloat(row.min_percent)
        const maxPercentage = parseFloat(row.max_percent)
        
        if (!isNaN(minPercentage) && !isNaN(maxPercentage)) {
          if (percentage < minPercentage || percentage > maxPercentage) {
            errors.push(`Percentage for deduction breakeven row ${rowNum} must be between ${minPercentage}% and ${maxPercentage}%. Current value: ${percentage}%.`)
          }
        } else if (!isNaN(minPercentage) && percentage < minPercentage) {
          errors.push(`Percentage for deduction breakeven row ${rowNum} must be at least ${minPercentage}%. Current value: ${percentage}%.`)
        } else if (!isNaN(maxPercentage) && percentage > maxPercentage) {
          errors.push(`Percentage for deduction breakeven row ${rowNum} must not exceed ${maxPercentage}%. Current value: ${percentage}%.`)
        }
      }
    }
  }

  return errors
}

// ENHANCED: Function to validate deduction breakeven percentage with min/max validation
async function validateDeductionBreakevenPercentages() {
  const errors = []
  
  if (document.doc.deduction_breakeven && Array.isArray(document.doc.deduction_breakeven)) {
    for (let index = 0; index < document.doc.deduction_breakeven.length; index++) {
      const row = document.doc.deduction_breakeven[index]
      const rowNum = index + 1
      
      // Basic validation
      if (!row.percentage) {
        errors.push(`Percentage for deduction breakeven row ${rowNum} is required.`)
        continue
      }
      
      // Validate percentage is a valid number
      const percentage = parseFloat(row.percentage)
      if (isNaN(percentage)) {
        errors.push(`Percentage for deduction breakeven row ${rowNum} must be a valid number.`)
        continue
      }
      
      if (percentage < 0) {
        errors.push(`Percentage for deduction breakeven row ${rowNum} cannot be negative.`)
        continue
      }
      
      if (percentage > 100) {
        errors.push(`Percentage for deduction breakeven row ${rowNum} cannot exceed 100%.`)
        continue
      }
      
      // Min/Max validation if fund_class and account are available
      if (row.fund_class && row.account) {
        try {
          const result = await call('crm.fcrm.doctype.donation.api.get_min_max_percentage', {
            fund_class: row.fund_class,
            account: row.account
          })
          
          if (result && result.length === 2) {
            const minPercentage = result[0]
            const maxPercentage = result[1]
            
            if (minPercentage !== null && maxPercentage !== null) {
              if (percentage < minPercentage || percentage > maxPercentage) {
                errors.push(`Percentage for deduction breakeven row ${rowNum} must be between ${minPercentage}% and ${maxPercentage}%. Current value: ${percentage}%.`)
              }
            } else if (minPercentage !== null && percentage < minPercentage) {
              errors.push(`Percentage for deduction breakeven row ${rowNum} must be at least ${minPercentage}%. Current value: ${percentage}%.`)
            } else if (maxPercentage !== null && percentage > maxPercentage) {
              errors.push(`Percentage for deduction breakeven row ${rowNum} must not exceed ${maxPercentage}%. Current value: ${percentage}%.`)
            }
          }
        } catch (error) {
          console.error('Error validating min/max percentage:', error)
          // Don't block submission if API call fails, just log the error
        }
      }
    }
  }
  
  return errors
}

// ENHANCED: Function to validate and show user-friendly error messages
async function validateAndShowErrors() {
  const errors = await validateDonationForm()
  
  // Add deduction breakeven percentage validation
  const deductionErrors = await validateDeductionBreakevenPercentages()
  errors.push(...deductionErrors)
  
  if (errors.length > 0) {
    // Show the first error as a toast
    toast.error(errors[0])
    
    // Log all errors for debugging
    console.error('Validation errors:', errors)
    
    return false
  }
  
  return true
}

async function saveChanges(data) {
  // Validate before saving
  if (!(await validateAndShowErrors())) {
    return // Don't save if validation fails
  }
  
  // BULLETPROOF FIX: Preserve user-modified percentage values before saving
  const preservedUserModifications = preserveUserModificationsBeforeSave()
  
  document.save.submit(null, {
    onSuccess: () => {
      // BULLETPROOF FIX: Restore user modifications after successful save
      setTimeout(() => {
        restoreUserModificationsAfterSave(preservedUserModifications)
      }, 1000) // Wait for save to complete
      
      toast.success(__('Donation saved successfully'))
      reloadAssignees(data)
    },
    onError: (err) => {
      toast.error(__('Error saving donation'))
      console.error('Save error:', err)
    },
  })
}

// BULLETPROOF FIX: Function to preserve user modifications before save
function preserveUserModificationsBeforeSave() {
  const userModifications = {}
  
  if (document.doc.deduction_breakeven && Array.isArray(document.doc.deduction_breakeven)) {
    document.doc.deduction_breakeven.forEach((row, index) => {
      if (row && (row._userModifiedPercentage || row._lastPercentage !== undefined)) {
        userModifications[`deduction_breakeven_${index}`] = {
          percentage: row.percentage,
          min_percent: row.min_percent,
          max_percent: row.max_percent,
          amount: row.amount,
          base_amount: row.base_amount,
          _userModifiedPercentage: row._userModifiedPercentage,
          _lastPercentage: row._lastPercentage,
          _userModifiedMinPercent: row._userModifiedMinPercent,
          _lastMinPercent: row._lastMinPercent,
          _userModifiedMaxPercent: row._userModifiedMaxPercent,
          _lastMaxPercent: row._lastMaxPercent
        }
        console.log(`Preserved user modification for deduction row ${index}:`, userModifications[`deduction_breakeven_${index}`])
      }
    })
  }
  
  // Store in sessionStorage to survive the save process
  sessionStorage.setItem('preservedUserModifications', JSON.stringify(userModifications))
  
  return userModifications
}

// BULLETPROOF FIX: Function to restore user modifications after save
function restoreUserModificationsAfterSave(preservedUserModifications) {
  if (!document.doc || !document.doc.deduction_breakeven) {
    console.log('Document not ready for restoration')
    return
  }
  
  // Try to get from parameter first, then from sessionStorage
  let modifications = preservedUserModifications
  if (!modifications || Object.keys(modifications).length === 0) {
    try {
      const stored = sessionStorage.getItem('preservedUserModifications')
      if (stored) {
        modifications = JSON.parse(stored)
        sessionStorage.removeItem('preservedUserModifications') // Clean up
      }
    } catch (error) {
      console.error('Error parsing stored modifications:', error)
      return
    }
  }
  
  if (!modifications || Object.keys(modifications).length === 0) {
    console.log('No user modifications to restore')
    return
  }
  
  console.log('Restoring user modifications after save:', modifications)
  
  // Restore deduction breakeven modifications
  if (document.doc.deduction_breakeven && Array.isArray(document.doc.deduction_breakeven)) {
    document.doc.deduction_breakeven.forEach((row, index) => {
      const key = `deduction_breakeven_${index}`
      if (row && modifications[key]) {
        const preserved = modifications[key]
        
        // Restore user-modified percentage
        if (preserved.percentage !== undefined) {
          row.percentage = preserved.percentage
          row._lastPercentage = preserved._lastPercentage
          row._userModifiedPercentage = preserved._userModifiedPercentage
          console.log(`Restored percentage for row ${index}: ${row.percentage}`)
        }
        
        // Restore user-modified min_percent
        if (preserved.min_percent !== undefined) {
          row.min_percent = preserved.min_percent
          row._lastMinPercent = preserved._lastMinPercent
          row._userModifiedMinPercent = preserved._userModifiedMinPercent
          console.log(`Restored min_percent for row ${index}: ${row.min_percent}`)
        }
        
        // Restore user-modified max_percent
        if (preserved.max_percent !== undefined) {
          row.max_percent = preserved.max_percent
          row._lastMaxPercent = preserved._lastMaxPercent
          row._userModifiedMaxPercent = preserved._userModifiedMaxPercent
          console.log(`Restored max_percent for row ${index}: ${row.max_percent}`)
        }
        
        // Restore calculated amount based on preserved percentage
        if (preserved.percentage !== undefined) {
          const calculatedAmount = calculateDeductionAmount(row)
          if (calculatedAmount !== null) {
            row.amount = calculatedAmount
            row.base_amount = calculatedAmount
            console.log(`Restored calculated amount for row ${index}: ${calculatedAmount}`)
          }
        }
      }
    })
    
    // Force reactive update to show restored values
    document.doc = { ...document.doc }
    
    console.log('User modifications restored successfully after save')
  }
}

// ADD: Function to calculate deduction amount (if not already exists)
function calculateDeductionAmount(row) {
  const percentage = parseFloat(row.percentage)
  const donationAmount = parseFloat(row.donation_amount)
  
  // Validate inputs
  if (isNaN(percentage) || isNaN(donationAmount)) {
    console.log('Cannot calculate amount: invalid percentage or donation amount')
    return null
  }
  
  if (donationAmount <= 0) {
    console.log('Cannot calculate amount: donation amount must be greater than 0')
    return null
  }
  
  // Calculate amount: (percentage / 100) * donation_amount
  const calculatedAmount = (percentage / 100) * donationAmount
  
  console.log(`Calculating amount: (${percentage}% / 100) * ${donationAmount} = ${calculatedAmount}`)
  
  return calculatedAmount
}

// Handle copy to clipboard (renamed to avoid conflict)
function handleCopyToClipboard(text) {
  copyToClipboard(text)
  toast.success(__('Copied to clipboard'))
}

// Open email box
function openEmailBox() {
  console.log('Opening email box for:', document.data.email)
}

function printDonation() {
  try {
    const doctype = 'Donation'
    const name = document?.doc?.name
    if (!name) {
      toast?.error && toast.error(__('Document not loaded'))
      return
    }
    openPrintModal()
  } catch (e) {
    console.error('Error opening print view:', e)
  }
}

// Print modal state and logic
const showPrintModal = ref(false)
const printFormats = ref([])
const selectedPrintFormat = ref('')
const loadingFormats = ref(false)

async function openPrintModal() {
  showPrintModal.value = true
  selectedPrintFormat.value = ''
  await fetchPrintFormats()
}

function closePrintModal() {
  showPrintModal.value = false
}

async function fetchPrintFormats() {
  loadingFormats.value = true
  try {
    const formats = await call('frappe.client.get_list', {
      doctype: 'Print Format',
      fields: ['name'],
      filters: { doc_type: 'Donation', disabled: 0 },
      order_by: 'name asc',
      limit_page_length: 1000,
    })
    printFormats.value = Array.isArray(formats) ? formats : []
    if (printFormats.value.length === 1) {
      selectedPrintFormat.value = printFormats.value[0].name
    }
  } catch (e) {
    console.error('Error fetching print formats:', e)
    toast.error(__('Failed to load print formats'))
  } finally {
    loadingFormats.value = false
  }
}

function confirmPrint() {
  const format = selectedPrintFormat.value
  if (!format) {
    toast.error(__('Please select a print format'))
    return
  }
  openPrintView(format)
  closePrintModal()
}

function openPrintView(format) {
  try {
    const doctype = 'Donation'
    const name = document?.doc?.name
    if (!name) return
    const params = new URLSearchParams({
      doctype,
      name: encodeURIComponent(name),
      trigger_print: '1',
      format,
      no_letterhead: '1',
    })
    const url = `/printview?${params.toString()}`
    window.open(url, '_blank')
  } catch (e) {
    console.error('Error opening print view:', e)
  }
}

// Open direct PDF using existing backend endpoint
function openDonationPDF() {
  try {
    const doctype = 'Donation'
    const name = document?.doc?.name
    if (!name) {
      toast?.error && toast.error(__('Document not loaded'))
      return
    }
    // Default to Standard print format; users can print via the modal for others
    const format = selectedPrintFormat.value || 'Standard'
    const params = new URLSearchParams({
      doctype,
      name: encodeURIComponent(name),
      format,
      no_letterhead: '0',
    })
    const url = `/api/method/frappe.utils.print_format.download_pdf?${params.toString()}`
    window.open(url, '_blank')
  } catch (e) {
    console.error('Error opening PDF:', e)
  }
}

// Activities reference
const activities = ref(null)

// Page meta
usePageMeta({
  title: computed(() => donorName.value || document.data?.name || __('Donation')),
  description: computed(() => `Donation details for ${donorName.value || document.data?.name}`),
  icon: brand.favicon,
})

// Watch for refresh parameter changes
watch(() => route.query.refresh, (newRefresh) => {
  if (newRefresh) {
    // Clear cache and force reload
    document.cache = ['donation', props.donationId, Date.now()]
    document.reload()
    // Clear the refresh parameter from URL
    router.replace({ 
      name: 'DonationDetail', 
      params: { donationId: props.donationId },
      query: {} 
    })
  }
}, { immediate: true })

onMounted(() => {
  // Handle refresh parameter for fresh donation creation
  if (route.query.refresh) {
    // Clear cache and force reload
    document.cache = ['donation', props.donationId, Date.now()]
    document.reload()
    // Clear the refresh parameter from URL
    router.replace({ 
      name: 'DonationDetail', 
      params: { donationId: props.donationId },
      query: {} 
    })
  }
})

// ADD: Method to refresh deduction breakeven using the minimal backend method
async function refreshDeductionBreakeven() {
  if (!document.doc?.name) {
    console.log('No document name available')
    return
  }
  
  try {
    console.log('Refreshing deduction breakeven for donation:', document.doc.name)
    
    // Call the minimal backend method
    const result = await call('akf_accounts.akf_accounts.doctype.donation.donation.refresh_deduction_breakeven', {
      name: document.doc.name
    })
    
    console.log('Backend method result:', result)
    
    if (result.status === 'success') {
      toast.success('Deduction breakeven table refreshed successfully')
      
      // Reload the document to show updated data
      document.reload()
    }
    
  } catch (error) {
    console.error('Error refreshing deduction breakeven:', error)
    // toast.error('Failed to refresh deduction breakeven table')
  }
}

function detectAndPreserveUserModifications() {
  isUpdatingFromAPI = true
  
  if (document.doc.deduction_breakeven && Array.isArray(document.doc.deduction_breakeven)) {
    document.doc.deduction_breakeven.forEach((row, index) => {
      if (row) {
        row._isUserModified = true
        row._userModifiedPercentage = true
        row._originalPercentage = row.percentage
        row._originalMinPercent = row.min_percent
        row._originalMaxPercent = row.max_percent
        row._originalAmount = row.amount
        row._originalBaseAmount = row.base_amount
        
        console.log(`CRITICAL: Preserved current values as user modifications for row ${index}:`, {
          percentage: row.percentage,
          min_percent: row.min_percent,
          max_percent: row.max_percent,
          amount: row.amount
        })
      }
    })
  }
  
  // Reset flag after initialization
  setTimeout(() => {
    isUpdatingFromAPI = false
  }, 100)
}

// CRITICAL FIX: Enhanced onMounted to detect user modifications
onMounted(async () => {
  await nextTick()
  
  // Wait for document to load
  setTimeout(() => {
    // CRITICAL: Always detect and preserve user modifications FIRST
    detectAndPreserveUserModifications()
    
    // CRITICAL: For existing donations, NEVER call any backend APIs
    if (document.doc?.name && document.doc.name !== '') {
      console.log('CRITICAL: Existing donation detected - skipping all auto-refresh APIs')
      return
    }
    
    // Only auto-refresh for new donations
    if (shouldPopulateDeductionBreakeven()) {
      console.log('Auto-refreshing deduction breakeven for new donation...')
      
      setTimeout(() => {
        refreshDeductionBreakeven()
      }, 2000)
    }
  }, 1000)
})

// CRITICAL FIX: Watch for document changes to auto-refresh when needed
watch(() => document.doc, (newDoc, oldDoc) => {
  // CRITICAL: For existing donations, NEVER call any backend APIs
  if (document.doc?.name && document.doc.name !== '') {
    console.log('CRITICAL: Existing donation detected - skipping document change auto-refresh')
    return
  }
  
  // Only auto-refresh for new donations
  if (shouldPopulateDeductionBreakeven()) {
    console.log('Auto-refreshing deduction breakeven for new donation on document change...')
    
    setTimeout(() => {
      refreshDeductionBreakeven()
    }, 1000)
  }
}, { immediate: false, deep: true })

// === ENRICHERS ===
async function safeFetchDonor(donorId) {
  try { return donorId ? await call('frappe.client.get', { doctype: 'Donor', name: donorId }) : null } catch { return null }
}
async function safeFetchFundClass(fcId) {
  try { return fcId ? await call('crm.fcrm.doctype.donation.api.get_fund_class_details', { fund_class_id: fcId, company: document.doc?.company || 'Alkhidmat Foundation Pakistan' }) : null } catch { return null }
}
async function safeFetchMOP(mopId) {
  try { return mopId ? await call('frappe.client.get', { doctype: 'Mode of Payment', name: mopId }) : null } catch { return null }
}

function mapDonor(row, donor) {
  if (!row || !donor) return
  const map = ['donor_name','donor_type','contact_no','email','city','address','cnic','co_name','co_contact_no','co_email','co_address','relationship_with_donor','area','co_city','co_country','co_designation']
  map.forEach(k => { if (donor[k] !== undefined) row[k] = donor[k] || '' })
}
function mapFundClass(row, fc) {
  if (!row || !fc) return
  const pairs = { service_area:'pay_service_area', subservice_area:'pay_subservice_area', product:'pay_product', equity_account:'equity_account', receivable_account:'receivable_account', cost_center:'cost_center' }
  Object.entries(pairs).forEach(([src,tgt]) => { if (fc[src] !== undefined) row[tgt] = fc[src] || '' })
}

async function enrichOnceAfterLoad() {
  if (didEnrichOnce || !document.doc) return
  didEnrichOnce = true
  
  // Set flag to prevent save state changes during enrichment
  isUpdatingFromAPI = true
  
  try {
    // Payment Details
    if (Array.isArray(document.doc.payment_detail)) {
      for (let i = 0; i < document.doc.payment_detail.length; i++) {
        const row = document.doc.payment_detail[i]
        if (row && !row.random_id) row.random_id = Math.floor((1000 + i + 1) + (Math.random() * 9000))
        if (row?.donor_id) { const d = await safeFetchDonor(row.donor_id); mapDonor(row, d) }
        if (row?.fund_class_id) { const fc = await safeFetchFundClass(row.fund_class_id); mapFundClass(row, fc) }
        if (row?.mode_of_payment) {
          const mop = await safeFetchMOP(row.mode_of_payment)
          if (mop?.accounts && document.doc.company) {
            const comp = mop.accounts.find(a => a.company === document.doc.company)
            if (comp?.default_account) row.account_paid_to = comp.default_account
          }
        }
      }
      document.doc.payment_detail = [...document.doc.payment_detail]
    }

    // Deduction Breakeven
    if (Array.isArray(document.doc.deduction_breakeven)) {
      for (let i = 0; i < document.doc.deduction_breakeven.length; i++) {
        const r = document.doc.deduction_breakeven[i]
        if (r && !r.random_id) r.random_id = Math.floor((1000 + i + 1) + (Math.random() * 9000))
        const fcid = r.fund_class_id || r.fund_class
        if (fcid) { const fc = await safeFetchFundClass(fcid); if (fc) {
          const pairs = [ ['service_area','service_area'], ['subservice_area','subservice_area'], ['product','product'], ['service_area','pay_service_area'], ['subservice_area','pay_subservice_area'], ['product','pay_product'], ['cost_center','cost_center'] ]
          pairs.forEach(([src,tgt]) => { if (tgt in r && fc[src] !== undefined) r[tgt] = fc[src] || '' })
        } }
      }
      document.doc.deduction_breakeven = [...document.doc.deduction_breakeven]
    }
  } catch (e) {
    // Fail-safe: do not break page
    console.error('Enrichment error:', e)
  } finally {
    // After enrichment, sync originalDoc to current doc so UI does not show Not Saved
    try {
      if (document && document.doc) {
        const snapshot = JSON.parse(JSON.stringify(document.doc))
        document.originalDoc = snapshot
        // also reset any explicit dirty flags if present
        if (typeof document.isDirty !== 'undefined') {
          document.isDirty = false
        }
      }
    } catch (syncErr) {
      console.warn('Failed to sync originalDoc after enrichment:', syncErr)
    }
    // Reset flag after enrichment is complete
    isUpdatingFromAPI = false
  }
}

onMounted(async () => {
  await nextTick()
  // small delay to ensure doc rendered
  setTimeout(() => { enrichOnceAfterLoad() }, 300)

  // Final stabilization: after all initial timers and watchers settle, sync baseline
  setTimeout(() => {
    try {
      if (document && document.doc) {
        const snapshot = JSON.parse(JSON.stringify(document.doc))
        document.originalDoc = snapshot
        if (typeof document.isDirty !== 'undefined') {
          document.isDirty = false
        }
      }
    } catch (e) {
      console.warn('Stabilization sync failed:', e)
    }
  }, 1500)
})

watch(() => document.doc?.name, () => { didEnrichOnce = false; setTimeout(() => { enrichOnceAfterLoad() }, 300) })
// === END ENRICHERS ===

// === EXACT BACKEND TRIGGER LOGIC (REPLACING EXISTING WATCHERS) ===

// Flags to prevent infinite loops
let isProcessingPaymentDetail = false
let isProcessingDeductionBreakeven = false
let isUpdatingFromAPI = false

// Debouncing timeouts
let paymentDetailTimeout = null
let deductionBreakevenTimeout = null

// Function to generate random ID for payment detail rows (same logic as backend)
const generateRandomId = (idx) => {
  return Math.floor((1000 + idx) + (Math.random() * 9000))
}

// CRITICAL FIX: Enhanced intention_id change handling to prevent infinite loops
watch(() => document.doc?.payment_detail, async (newPaymentDetail, oldPaymentDetail) => {
  // Skip if we're processing or updating from API
  if (isProcessingPaymentDetail || isUpdatingFromAPI) return
  
  // Clear existing timeout
  if (paymentDetailTimeout) {
    clearTimeout(paymentDetailTimeout)
  }
  
  // Debounce the processing
  paymentDetailTimeout = setTimeout(async () => {
    if (!newPaymentDetail || !Array.isArray(newPaymentDetail)) return
    
    isProcessingPaymentDetail = true
    
    try {
      let shouldTriggerSetDeductionBreakeven = false
      let hasChanges = false
      
      // Process each payment detail row for changes that trigger backend calls
      for (let index = 0; index < newPaymentDetail.length; index++) {
        const row = newPaymentDetail[index]
        
        // Ensure random_id is present (EXACT backend logic)
        if (row && !row.random_id) {
          row.random_id = generateRandomId(index + 1)
          hasChanges = true
        }
        
        // EXACT backend trigger: donor_id change
        if (row.donor_id && row.donor_id !== row._lastDonorId) {
          console.log(`Donor ID changed in row ${index}:`, row.donor_id)
          row._lastDonorId = row.donor_id
          row.donor = row.donor_id
          await handleDonorSelectionDirect(row.donor_id, row)
          hasChanges = true
        }
        
        // EXACT backend trigger: fund_class_id change
        if (row.fund_class_id && row.fund_class_id !== row._lastFundClassId) {
          console.log(`Fund Class ID changed in row ${index}:`, row.fund_class_id)
          row._lastFundClassId = row.fund_class_id
          row.fund_class = row.fund_class_id
          
          // FIX: For Pledge contribution type, populate fund class fields without deduction breakeven
          if (document.doc.contribution_type === 'Pledge') {
            await populateFundClassFieldsForPledge(row)
          } else {
            shouldTriggerSetDeductionBreakeven = true
          }
          
          hasChanges = true
        }
        
        // EXACT backend trigger: donation_amount change
        if (row.donation_amount !== row._lastDonationAmount) {
          console.log(`Donation amount changed in row ${index}:`, row.donation_amount)
          row._lastDonationAmount = row.donation_amount
          shouldTriggerSetDeductionBreakeven = true
          hasChanges = true
        }
        
        // EXACT backend trigger: intention_id change
        if (row.intention_id !== row._lastIntentionId) {
          console.log(`Intention ID changed in row ${index}:`, row.intention_id)
          row._lastIntentionId = row.intention_id
          
          // CRITICAL FIX: Handle Zakat intention by clearing only corresponding deduction breakeven rows
          if (row.intention_id === 'Zakat') {
            console.log(`Intention changed to Zakat for payment detail row ${index} with random_id ${row.random_id}`)
            
            // Clear only deduction breakeven rows that correspond to this specific payment detail row
            if (document.doc.deduction_breakeven && Array.isArray(document.doc.deduction_breakeven)) {
              const originalLength = document.doc.deduction_breakeven.length
              
              // Filter out deduction breakeven rows that correspond to this payment detail row
              document.doc.deduction_breakeven = document.doc.deduction_breakeven.filter(deductionRow => {
                const shouldKeep = deductionRow.random_id !== row.random_id
                if (!shouldKeep) {
                  console.log(`Removing deduction breakeven row with random_id ${deductionRow.random_id} due to Zakat intention`)
                }
                return shouldKeep
              })
              
              const removedCount = originalLength - document.doc.deduction_breakeven.length
              if (removedCount > 0) {
                console.log(`Removed ${removedCount} deduction breakeven row(s) for Zakat intention`)
                toast.success(`Cleared ${removedCount} deduction breakeven row(s) for Zakat intention`)
              }
            }
            
            hasChanges = true
          } else {
            // For non-Zakat intentions, trigger deduction breakeven population
            shouldTriggerSetDeductionBreakeven = true
            hasChanges = true
          }
        }
        
        // EXACT backend trigger: mode of payment - handle account_paid_to auto-fill
        if (row.mode_of_payment && row.mode_of_payment !== row._lastMOPId) {
          console.log('MODE OF PAYMENT CHANGED IN DONATION DETAIL', row.mode_of_payment)
          row._lastMOPId = row.mode_of_payment
          
          try {
            const company = document.doc?.company || 'Alkhidmat Foundation Pakistan'
            
            const result = await call('crm.fcrm.doctype.donation.api.get_payment_mode_account', {
              mode_of_payment: row.mode_of_payment,
              company: company
            })
            
            if (result && result.success && result.account) {
              console.log('Account fetched successfully:', result.account)
              row.account_paid_to = result.account
            } else {
              console.log('No account found')
              row.account_paid_to = ''
              
              if (result && result.message) {
                toast.warning(result.message)
              } else {
                toast.warning('No default account found for this mode of payment')
              }
            }
          } catch (error) {
            console.error('Error fetching payment mode account:', error)
            row.account_paid_to = ''
            toast.error(`Error loading account for mode of payment: ${error.message}`)
          }
          
          hasChanges = true
        }
      }
      
      // CRITICAL FIX: Only call set_deduction_breakeven for non-Zakat intentions
      if (shouldTriggerSetDeductionBreakeven) {
        // Check if any payment detail has Zakat intention
        const hasZakatIntention = newPaymentDetail.some(row => row.intention_id === 'Zakat')
        
        if (!hasZakatIntention) {
          console.log('Triggering set_deduction_breakeven due to payment detail changes...')
          await setDeductionBreakevenFromAPI()
        } else {
          console.log('Skipping set_deduction_breakeven due to Zakat intention - will handle row-specific clearing instead')
        }
      }
      
      // FIXED: Only trigger reactive update if we actually made changes and it's not from API
      if (hasChanges && !isUpdatingFromAPI) {
        // Use nextTick to avoid immediate re-triggering
        await nextTick()
        // Mark that we're updating to prevent watcher loops
        isUpdatingFromAPI = true
        
        // CRITICAL FIX: Don't replace the array - just trigger reactivity without breaking row references
        // This preserves the Grid component's selection state
        document.doc = { ...document.doc }
        
        // Reset flag after a short delay
        setTimeout(() => {
          isUpdatingFromAPI = false
        }, 100)
      }
    } finally {
      isProcessingPaymentDetail = false
    }
  }, 300) // 300ms debounce
}, { deep: true })

// CRITICAL FIX: Enhanced deduction breakeven watcher to prevent infinite loops
watch(() => document.doc?.deduction_breakeven, async (newDeductionBreakeven, oldDeductionBreakeven) => {
  // Skip if we're processing or updating from API
  if (isProcessingDeductionBreakeven || isUpdatingFromAPI) return
  
  // Clear existing timeout
  if (deductionBreakevenTimeout) {
    clearTimeout(deductionBreakevenTimeout)
  }
  
  // Debounce the processing
  deductionBreakevenTimeout = setTimeout(async () => {
    if (!newDeductionBreakeven || !Array.isArray(newDeductionBreakeven)) return
    
    isProcessingDeductionBreakeven = true
    
    try {
      let shouldTriggerSetDeductionBreakeven = false
      let hasChanges = false
      
      // Process each deduction breakeven row for changes
      newDeductionBreakeven.forEach((row, index) => {
        // EXACT backend trigger: percentage change
        if (row.percentage !== row._lastPercentage) {
          console.log(`Percentage changed in deduction row ${index}:`, row.percentage)
          
          // ADD: Validate percentage against min/max limits
          const validationResult = validatePercentageLimits(row, index)
          if (!validationResult.isValid) {
            // Show validation error and revert the change
            toast.error(validationResult.errorMessage)
            row.percentage = row._lastPercentage // Revert to previous value
            return // Skip processing this row
          }
          
          // ADD: Calculate and update amount based on percentage
          const calculatedAmount = calculateDeductionAmount(row)
          if (calculatedAmount !== null) {
            row.amount = calculatedAmount
            row.base_amount = calculatedAmount
            console.log(`Updated amount for row ${index}: ${calculatedAmount}`)
          }
          
          row._lastPercentage = row.percentage
          row._userModifiedPercentage = true // Mark as user modified
          // Backend DOES call set_deduction_breakeven on percentage change
          shouldTriggerSetDeductionBreakeven = true
          hasChanges = true
        }
        
        // ADD: Track min_percent and max_percent changes (but don't trigger backend API)
        if (row.min_percent !== row._lastMinPercent) {
          console.log(`Min percent changed in deduction row ${index}:`, row.min_percent)
          row._lastMinPercent = row.min_percent
          row._userModifiedMinPercent = true
          hasChanges = true
        }
        
        if (row.max_percent !== row._lastMaxPercent) {
          console.log(`Max percent changed in deduction row ${index}:`, row.max_percent)
          row._lastMaxPercent = row.max_percent
          row._userModifiedMaxPercent = true
          hasChanges = true
        }
        
        // ADD: Track donation_amount changes to recalculate amount
        if (row.donation_amount !== row._lastDonationAmount) {
          console.log(`Donation amount changed in deduction row ${index}:`, row.donation_amount)
          row._lastDonationAmount = row.donation_amount
          
          // Recalculate amount based on current percentage
          const calculatedAmount = calculateDeductionAmount(row)
          if (calculatedAmount !== null) {
            row.amount = calculatedAmount
            row.base_amount = calculatedAmount
            console.log(`Recalculated amount for row ${index}: ${calculatedAmount}`)
          }
          
          hasChanges = true
        }
      })
      
      // CRITICAL: Allow backend API calls for all cases (restore existing functionality)
      if (shouldTriggerSetDeductionBreakeven) {
        console.log('Triggering set_deduction_breakeven due to deduction_breakeven changes...')
        await setDeductionBreakevenFromAPI()
      }
      
      // CRITICAL FIX: Only trigger reactive update if we actually made changes and it's not from API
      if (hasChanges && !isUpdatingFromAPI) {
        // Use nextTick to avoid immediate re-triggering
        await nextTick()
        // Mark that we're updating to prevent watcher loops
        isUpdatingFromAPI = true
        
        // CRITICAL FIX: Use the original reactive update method to preserve existing functionality
        // This prevents infinite loops while maintaining all existing behavior
        document.doc.deduction_breakeven = [...document.doc.deduction_breakeven]
        
        // Reset flag after a short delay
        setTimeout(() => {
          isUpdatingFromAPI = false
        }, 100)
      }
    } finally {
      isProcessingDeductionBreakeven = false
    }
  }, 300) // 300ms debounce
}, { deep: true })

// ADD: Function to check if we're preserving user modifications
function isPreservingUserModifications() {
  if (document.doc.deduction_breakeven && Array.isArray(document.doc.deduction_breakeven)) {
    return document.doc.deduction_breakeven.some(row => row._isUserModified || row._userModifiedPercentage)
  }
  return false
}

// EXACT BACKEND TRIGGER LOGIC - Contribution Type Changes
watch(() => document.doc?.contribution_type, async (newContributionType, oldContributionType) => {
  console.log('Contribution type changed from', oldContributionType, 'to:', newContributionType)
  
  if (newContributionType === 'Pledge') {
    // Clear deduction_breakeven table when contribution type is Pledge (same as backend)
    if (document.doc.deduction_breakeven && document.doc.deduction_breakeven.length > 0) {
      isUpdatingFromAPI = true
      document.doc.deduction_breakeven = []
      console.log('Cleared deduction_breakeven table due to contribution_type being Pledge')
      setTimeout(() => {
        isUpdatingFromAPI = false
      }, 100)
    }
  } else if (newContributionType === 'Donation' && oldContributionType === 'Pledge') {
    // Populate deduction breakeven when switching from Pledge to Donation (same as backend)
    console.log('Switched from Pledge to Donation, populating deduction breakeven...')
    await setDeductionBreakevenFromAPI()
  }
})

// === HELPER FUNCTIONS FOR EXACT BACKEND BEHAVIOR ===

// Direct donor handling (same as DonationModal)
async function handleDonorSelectionDirect(donorId, row) {
  console.log('Handling donor selection directly:', { donorId, row })
  
  if (!donorId) {
    clearDonorFields(row)
    return
  }
  
  try {
    const donorDetails = await fetchDonorDetails(donorId)
    if (donorDetails) {
      updateDonorFields(row, donorDetails)
      console.log('Donor fields updated successfully')
    } else {
      console.log('No donor details received')
      toast.error('Could not fetch donor details')
    }
  } catch (error) {
    console.error('Error in direct donor handling:', error)
    toast.error('Error loading donor details')
  }
}

// Fetch donor details
async function fetchDonorDetails(donorId) {
  console.log('Fetching donor details for:', donorId)
  
  try {
    const result = await call('frappe.client.get', {
      doctype: 'Donor',
      name: donorId
    })
    
    console.log('Donor details received:', result)
    return result
  } catch (error) {
    console.error('Error fetching donor details:', error)
    toast.error('Error loading donor details')
    return null
  }
}

// Update donor fields
function updateDonorFields(row, donorDetails) {
  console.log('Updating row with donor details:', donorDetails)
  console.log('Row before update:', { ...row })
  
  // Map donor fields to payment detail fields - INCLUDING ALL CARE-OF DETAILS
  const fieldMappings = {
    'donor_name': 'donor_name',
    'donor_type': 'donor_type',
    'contact_no': 'contact_no',
    'email': 'email',
    'city': 'city',
    'address': 'address',
    'cnic': 'cnic',
    // ADD: Care-of details fields that were missing
    'co_name': 'co_name',
    'co_contact_no': 'co_contact_no',
    'co_email': 'co_email',
    'co_address': 'co_address',
    'relationship_with_donor': 'relationship_with_donor',
    'area': 'area',
    'co_city': 'co_city',
    'co_country': 'co_country',
    'co_designation': 'co_designation'
  }
  
  // Update each field with donor data
  Object.entries(fieldMappings).forEach(([donorField, rowField]) => {
    if (donorDetails[donorField] !== undefined) {
      const oldValue = row[rowField]
      row[rowField] = donorDetails[donorField] || ''
      console.log(`Updated ${rowField}: ${oldValue} -> ${row[rowField]}`)
    }
  })
  
  console.log('Row after donor update:', { ...row })
  
  // FIXED: Don't force reactive update here to prevent loops
  // The watcher will handle the reactive update if needed
}

// Clear donor fields
function clearDonorFields(row) {
  console.log('Clearing donor fields for row')
  
  const donorFields = [
    'donor_name', 'donor_type', 'contact_no', 'email', 'city', 'address', 'cnic',
    // ADD: Care-of details fields that were missing
    'co_name', 'co_contact_no', 'co_email', 'co_address', 'relationship_with_donor',
    'area', 'co_city', 'co_country', 'co_designation'
  ]
  
  donorFields.forEach(fieldName => {
    row[fieldName] = ''
  })
  
  // FIXED: Don't force reactive update here to prevent loops
  // The watcher will handle the reactive update if needed
}

// Fund Class handling for Pledge (without deduction breakeven)
async function populateFundClassFieldsForPledge(row) {
  console.log('Populating fund class fields for Pledge contribution type')
  
  if (!row.fund_class_id) {
    clearFundClassFields(row)
    return
  }
  
  try {
    const fundClassDetails = await fetchFundClassDetails(row.fund_class_id)
    if (fundClassDetails) {
      updateFundClassFields(row, fundClassDetails)
      console.log('Fund Class fields updated successfully for Pledge')
    } else {
      console.log('No Fund Class details received')
      toast.error('Could not fetch Fund Class details')
    }
  } catch (error) {
    console.error('Error in Fund Class handling for Pledge:', error)
    toast.error('Error loading Fund Class details')
  }
}

// Fetch Fund Class details
async function fetchFundClassDetails(fundClassId) {
  console.log('Fetching Fund Class details for:', fundClassId)
  
  try {
    const result = await call('crm.fcrm.doctype.donation.api.get_fund_class_details', {
      fund_class_id: fundClassId,
      company: document.doc.company || 'Alkhidmat Foundation Pakistan'
    })
    
    console.log('Fund Class details received:', result)
    return result
  } catch (error) {
    console.error('Error fetching Fund Class details:', error)
    toast.error('Error loading Fund Class details')
    return null
  }
}

// Update Fund Class fields
function updateFundClassFields(row, fundClassDetails) {
  console.log('Updating row with Fund Class details:', fundClassDetails)
  console.log('Row before update:', { ...row })
  
  // Map Fund Class fields to payment detail fields
  const fieldMappings = {
    'service_area': 'pay_service_area',
    'subservice_area': 'pay_subservice_area',
    'product': 'pay_product',
    'equity_account': 'equity_account',
    'receivable_account': 'receivable_account',
    'cost_center': 'cost_center'
  }
  
  // Update each field with Fund Class data
  Object.entries(fieldMappings).forEach(([fundClassField, rowField]) => {
    if (fundClassDetails[fundClassField] !== undefined) {
      const oldValue = row[rowField]
      row[rowField] = fundClassDetails[fundClassField] || ''
      console.log(`Updated ${rowField}: ${oldValue} -> ${row[rowField]}`)
      
      // CRITICAL: Ensure the field is properly set in the row
      if (fundClassDetails[fundClassField]) {
        row[rowField] = fundClassDetails[fundClassField]
        console.log(`Set ${rowField} to: ${row[rowField]}`)
      }
    }
  })
  
  // CRITICAL: Ensure equity_account and receivable_account are set
  if (fundClassDetails.equity_account) {
    row.equity_account = fundClassDetails.equity_account
    console.log('Set equity_account to:', row.equity_account)
  }
  
  if (fundClassDetails.receivable_account) {
    row.receivable_account = fundClassDetails.receivable_account
    console.log('Set receivable_account to:', row.receivable_account)
  }
  
  console.log('Row after Fund Class update:', { ...row })
  
  // FIXED: Don't force reactive update here to prevent loops
  // The watcher will handle the reactive update if needed
  
  // CRITICAL: Log the final state to verify fields are set
  console.log('Final row state after Fund Class update:', {
    equity_account: row.equity_account,
    receivable_account: row.receivable_account,
    service_area: row.pay_service_area,
    subservice_area: row.pay_subservice_area,
    product: row.pay_product
  })
}

// Clear Fund Class fields
function clearFundClassFields(row) {
  console.log('Clearing Fund Class fields for row')
  
  const fundClassFields = [
    'pay_service_area', 'pay_subservice_area', 'pay_product',
    'equity_account', 'receivable_account', 'cost_center'
  ]
  
  fundClassFields.forEach(fieldName => {
    row[fieldName] = ''
  })
  
  // FIXED: Don't force reactive update here to prevent loops
  // The watcher will handle the reactive update if needed
}

// === END EXACT BACKEND TRIGGER LOGIC ===

// CRITICAL FIX: Completely disable auto-refresh for existing donations
function shouldPopulateDeductionBreakeven() {
  // Only auto-populate for new donations (no name yet) or when deduction breakeven is completely empty
  if (document.doc?.name && document.doc.name !== '') {
    // For existing donations, only populate if deduction breakeven is completely empty
    if (document.doc?.deduction_breakeven && document.doc.deduction_breakeven.length > 0) {
      console.log('Skipping auto-populate for existing donation - deduction breakeven already has data')
      return false
    }
  }
  
  // Only populate if all conditions are met
  const shouldPopulate = (
    document.doc?.donation_type === 'Cash' && 
    document.doc?.payment_detail && 
    document.doc?.payment_detail.length > 0 &&
    (!document.doc?.deduction_breakeven || document.doc?.deduction_breakeven.length === 0)
  )
  
  console.log('Should populate deduction breakeven:', shouldPopulate)
  return shouldPopulate
}

// ADD: Manual refresh button function
async function handleManualRefresh() {
  await refreshDeductionBreakeven()
}

// ADD: Frontend-only solution to populate deduction breakeven (FIXED VERSION)
async function populateDeductionBreakevenFrontend() {
  if (!document.doc || document.doc.donation_type !== 'Cash' || !document.doc.payment_detail) {
    return
  }
  
  try {
    console.log('Populating deduction breakeven table using frontend logic...')
    
    // Check if deduction breakeven already has data
    if (document.doc.deduction_breakeven && document.doc.deduction_breakeven.length > 0) {
      console.log('Deduction breakeven already has data, skipping population')
      return
    }
    
    const deductionBreakevenRows = []
    
    // Process each payment detail row
    for (const paymentRow of document.doc.payment_detail) {
      if (paymentRow.fund_class_id && paymentRow.donation_amount) {
        console.log('Processing payment row:', paymentRow)
        
        // Fetch deduction details from the database directly
        const deductionDetails = await call('frappe.client.get_list', {
          doctype: 'Deduction Details',
          filters: {
            parenttype: 'Fund Class',
            parent: paymentRow.fund_class_id,
            company: document.doc.company || 'Alkhidmat Foundation'
          },
          fields: ['company', 'income_type', 'project', 'account', 'percentage', 'min_percent', 'max_percent']
        })
        
        if (deductionDetails && deductionDetails.length > 0) {
          // Create deduction breakeven rows for each deduction detail
          for (const deductionDetail of deductionDetails) {
            const percentageAmount = paymentRow.donation_amount * (deductionDetail.percentage / 100)
            
            const deductionRow = {
              random_id: Math.floor((1000 + Math.random() * 9000)),
              fund_class: paymentRow.fund_class_id,
              percentage: deductionDetail.percentage || 0,
              min_percent: deductionDetail.min_percent || 0,
              max_percent: deductionDetail.max_percent || 0,
              amount: percentageAmount,
              company: deductionDetail.company || document.doc.company,
              income_type: deductionDetail.income_type || '',
              project: deductionDetail.project || '',
              account: deductionDetail.account || '',
              donor_id: paymentRow.donor_id,  // FIXED: Changed from 'donor' to 'donor_id'
              intention_id: paymentRow.intention_id,  // FIXED: Added missing intention_id
              service_area: paymentRow.pay_service_area || '',
              subservice_area: paymentRow.pay_subservice_area || '',
              product: paymentRow.pay_product || '',
              donation_amount: paymentRow.donation_amount,
              base_amount: percentageAmount,
              cost_center: document.doc.donation_cost_center || '',
              donor_desk_id: paymentRow.donor_desk_id || '',
              donor_type_id: paymentRow.donor_type || '',  // FIXED: Added missing donor_type_id
              transaction_type_id: paymentRow.transaction_type_id || '',  // FIXED: Added missing transaction_type_id
              donation_type_id: paymentRow.donation_type || document.doc.donation_type,
              __islocal: true,
              doctype: 'Deduction Breakeven',
              parentfield: 'deduction_breakeven',
              parenttype: 'Donation',
              idx: deductionBreakevenRows.length + 1
            }
            
            deductionBreakevenRows.push(deductionRow)
          }
        }
      }
    }
    
    if (deductionBreakevenRows.length > 0) {
      console.log('Created deduction breakeven rows:', deductionBreakevenRows)
      
      // Update the document with the new deduction breakeven data
      document.doc.deduction_breakeven = deductionBreakevenRows
      
      // Force reactive update
      document.doc = { ...document.doc }
      
      // toast.success(`Successfully populated ${deductionBreakevenRows.length} deduction breakeven rows`)
    } else {
      console.log('No deduction breakeven rows to create')
      toast.info('No deduction details found for the selected fund classes')
    }
    
  } catch (error) {
    console.error('Error populating deduction breakeven:', error)
    toast.error('Failed to populate deduction breakeven table')
  }
}

// ADD: Use API-based solution instead of frontend-only solution
onMounted(async () => {
  await nextTick()
  
  if (shouldPopulateDeductionBreakeven()) {
    setTimeout(() => {
      populateDeductionBreakevenFromAPI()  // Changed from populateDeductionBreakevenFrontend()
    }, 2000)
  }
})

watch(() => document.doc, (newDoc) => {
  if (shouldPopulateDeductionBreakeven()) {
    setTimeout(() => {
      populateDeductionBreakevenFromAPI()  // Changed from populateDeductionBreakevenFrontend()
    }, 1000)
  }
}, { immediate: false, deep: true })

// NEW: Enhanced deduction breakeven functionality using API
async function populateDeductionBreakevenFromAPI() {
  console.log("Populating deduction breakeven using API on DonationDetail page...")
  
  if (!document.doc.payment_detail || document.doc.payment_detail.length === 0) {
    console.log("No payment details to process")
    return
  }
  
  if (document.doc.contribution_type === "Pledge") {
    console.log("Skipping deduction breakeven for Pledge contribution type")
    return
  }
  
  // CRITICAL FIX: Check for Zakat intention and clear only corresponding rows
  const zakatRowIds = new Set()
  document.doc.payment_detail.forEach(row => {
    if (row.intention_id === 'Zakat' && row.random_id) {
      zakatRowIds.add(row.random_id)
    }
  })
  
  if (zakatRowIds.size > 0) {
    console.log("Clearing deduction breakeven rows for Zakat payment detail rows:", Array.from(zakatRowIds))
    
    if (document.doc.deduction_breakeven && Array.isArray(document.doc.deduction_breakeven)) {
      const originalLength = document.doc.deduction_breakeven.length
      
      // Filter out deduction breakeven rows that correspond to Zakat payment detail rows
      document.doc.deduction_breakeven = document.doc.deduction_breakeven.filter(deductionRow => {
        const shouldKeep = !zakatRowIds.has(deductionRow.random_id)
        if (!shouldKeep) {
          console.log(`Removing deduction breakeven row with random_id ${deductionRow.random_id} due to Zakat intention`)
        }
        return shouldKeep
      })
      
      const removedCount = originalLength - document.doc.deduction_breakeven.length
      if (removedCount > 0) {
        console.log(`Removed ${removedCount} deduction breakeven rows for Zakat intention`)
        toast.success(`Cleared ${removedCount} deduction breakeven row(s) for Zakat intention`)
      }
    }
    
    // Don't proceed with API call if all payment detail rows are Zakat
    const nonZakatRows = document.doc.payment_detail.filter(row => row.intention_id !== 'Zakat')
    if (nonZakatRows.length === 0) {
      console.log("All payment detail rows have Zakat intention, skipping API call")
      return
    }
  }
  
  try {
    const result = await call("crm.fcrm.doctype.donation.api.populate_deduction_breakeven", {
      payment_details: document.doc.payment_detail,
      company: document.doc.company || "Alkhidmat Foundation",
      contribution_type: document.doc.contribution_type || "Donation",
      donation_cost_center: document.doc.donation_cost_center,
      currency: document.doc.currency,
      to_currency: document.doc.to_currency || document.doc.currency,
      posting_date: document.doc.posting_date,
      is_return: document.doc.is_return || false,
      existing_deduction_breakeven: document.doc.deduction_breakeven || []
    })
    
    if (result.success) {
      console.log("API populated deduction breakeven successfully:", result)
      
      // Update the document with the results
      document.doc.deduction_breakeven = result.deduction_breakeven
      document.doc.payment_detail = result.updated_payment_details
      
      // Force reactive update
      document.doc = { ...document.doc }
      
      // Show success message only if there are actual rows
      if (result.deduction_breakeven && result.deduction_breakeven.length > 0) {
        // toast.success(`Successfully populated ${result.deduction_breakeven.length} deduction breakeven rows`)
      } else {
        console.log('No deduction breakeven rows to populate')
      }
    } else {
      console.error("API failed to populate deduction breakeven:", result.message)
      toast.error(result.message || "Failed to populate deduction breakeven")
    }
  } catch (error) {
    console.error("Error calling deduction breakeven API:", error)
    toast.error("Error populating deduction breakeven")
  }
}

// NEW: Update deduction breakeven when payment details change
async function updateDeductionBreakevenFromAPI() {
  console.log('Updating deduction breakeven using API on DonationDetail page...')
  
  if (!document.doc.payment_detail || document.doc.payment_detail.length === 0) {
    console.log('No payment details to update')
    return
  }
  
  if (!document.doc.deduction_breakeven || document.doc.deduction_breakeven.length === 0) {
    console.log('No existing deduction breakeven to update')
    return
  }
  
  try {
    const result = await call('crm.fcrm.doctype.donation.api.update_deduction_breakeven', {
      payment_details: document.doc.payment_detail,
      deduction_breakeven: document.doc.deduction_breakeven,
      company: document.doc.company || 'Alkhidmat Foundation',
      contribution_type: document.doc.contribution_type || 'Donation',
      donation_cost_center: document.doc.donation_cost_center,
      currency: document.doc.currency,
      to_currency: document.doc.to_currency || document.doc.currency,
      posting_date: document.doc.posting_date,
      is_return: document.doc.is_return || false
    })
    
    if (result.success) {
      console.log('API updated deduction breakeven successfully:', result)  
      
      // Update the document with the results
      document.doc.deduction_breakeven = result.deduction_breakeven
      document.doc.payment_detail = result.updated_payment_details
      
      // Force reactive update
      document.doc = { ...document.doc }
    } else {
      console.error('API failed to update deduction breakeven:', result.message)
      toast.error(result.message || 'Failed to update deduction breakeven')
    }
  } catch (error) {
    console.error('Error calling update deduction breakeven API:', error)
    toast.error('Error updating deduction breakeven')
  }
}

// CRITICAL FIX: Enhanced set deduction breakeven when payment details change
async function setDeductionBreakevenFromAPI() {
  console.log('Setting deduction breakeven using backend API...')
  
  if (!document.doc.payment_detail || document.doc.payment_detail.length === 0) {
    console.log('No payment details to process')
    return
  }
  
  if (document.doc.contribution_type === "Pledge") {
    console.log("Skipping deduction breakeven for Pledge contribution type")
    return
  }
  
  // CRITICAL FIX: Check for Zakat intention and clear only corresponding rows
  const zakatRowIds = new Set()
  document.doc.payment_detail.forEach(row => {
    if (row.intention_id === 'Zakat' && row.random_id) {
      zakatRowIds.add(row.random_id)
    }
  })
  
  if (zakatRowIds.size > 0) {
    console.log('Clearing deduction breakeven rows for Zakat payment detail rows:', Array.from(zakatRowIds))
    
    if (document.doc.deduction_breakeven && Array.isArray(document.doc.deduction_breakeven)) {
      const originalLength = document.doc.deduction_breakeven.length
      
      // Filter out deduction breakeven rows that correspond to Zakat payment detail rows
      document.doc.deduction_breakeven = document.doc.deduction_breakeven.filter(deductionRow => {
        const shouldKeep = !zakatRowIds.has(deductionRow.random_id)
        if (!shouldKeep) {
          console.log(`Removing deduction breakeven row with random_id ${deductionRow.random_id} due to Zakat intention`)
        }
        return shouldKeep
      })
      
      const removedCount = originalLength - document.doc.deduction_breakeven.length
      if (removedCount > 0) {
        console.log(`Removed ${removedCount} deduction breakeven rows for Zakat intention`)
        toast.success(`Cleared ${removedCount} deduction breakeven row(s) for Zakat intention`)
      }
    }
    
    // Don't proceed with API call if all payment detail rows are Zakat
    const nonZakatRows = document.doc.payment_detail.filter(row => row.intention_id !== 'Zakat')
    if (nonZakatRows.length === 0) {
      console.log('All payment detail rows have Zakat intention, skipping API call')
      return
    }
  }
  
  // CRITICAL FIX: Prevent infinite loops by checking if we're already processing
  if (isUpdatingFromAPI) {
    console.log('Already updating from API, skipping to prevent infinite loop')
    return
  }
  
  try {
    // Mark that we're updating from API to prevent watcher loops
    isUpdatingFromAPI = true
    
    // ENHANCED: Preserve user-modified percentage values before backend API call
    const preservedUserModifications = {}
    if (document.doc.deduction_breakeven && Array.isArray(document.doc.deduction_breakeven)) {
      document.doc.deduction_breakeven.forEach((row, index) => {
        if (row && (row._userModifiedPercentage || row._lastPercentage !== undefined)) {
          preservedUserModifications[index] = {
            percentage: row.percentage,
            min_percent: row.min_percent,
            max_percent: row.max_percent,
            amount: row.amount,
            base_amount: row.base_amount
          }
          console.log(`Preserving user-modified values for row ${index}:`, preservedUserModifications[index])
        }
      })
    }
    
    // Use the exact backend set_deduction_breakeven API
    const result = await call('crm.fcrm.doctype.donation.api.set_deduction_breakeven', {
      payment_details: document.doc.payment_detail,
      company: document.doc.company || 'Alkhidmat Foundation',
      contribution_type: document.doc.contribution_type || 'Donation',
      donation_cost_center: document.doc.donation_cost_center,
      currency: document.doc.currency,
      to_currency: document.doc.to_currency || document.doc.currency,
      posting_date: document.doc.posting_date,
      is_return: document.doc.is_return || false
    })
    
    if (result.success) {
      console.log('Backend API set deduction breakeven successfully:', result)
      
      // Update the document with the results (rebuilds entire table like backend)
      document.doc.deduction_breakeven = result.deduction_breakeven
      document.doc.payment_detail = result.updated_payment_details
      
      // ENHANCED: Restore user-modified values after backend API rebuilds the table
      if (document.doc.deduction_breakeven && Array.isArray(document.doc.deduction_breakeven)) {
        document.doc.deduction_breakeven.forEach((row, index) => {
          if (row && preservedUserModifications[index]) {
            const preserved = preservedUserModifications[index]
            
            // Restore user-modified percentage
            row.percentage = preserved.percentage
            row._lastPercentage = preserved.percentage
            row._userModifiedPercentage = true
            
            // Restore user-modified min/max percent if they were modified
            if (preserved.min_percent !== undefined) {
              row.min_percent = preserved.min_percent
              row._lastMinPercent = preserved.min_percent
            }
            
            if (preserved.max_percent !== undefined) {
              row.max_percent = preserved.max_percent
              row._lastMaxPercent = preserved.max_percent
            }
            
            // Restore calculated amount based on preserved percentage
            const calculatedAmount = calculateDeductionAmount(row)
            if (calculatedAmount !== null) {
              row.amount = calculatedAmount
              row.base_amount = calculatedAmount
            }
            
            console.log(`Restored user-modified values for row ${index}:`, {
              percentage: row.percentage,
              min_percent: row.min_percent,
              max_percent: row.max_percent,
              amount: row.amount
            })
          }
        })
      }
      
      // FIXED: Use nextTick and delayed flag reset to prevent immediate re-triggering
      await nextTick()
      document.doc = { ...document.doc }
      
      // Show success message only if there are actual rows
      if (result.deduction_breakeven && result.deduction_breakeven.length > 0) {
        // toast.success(`Successfully populated ${result.deduction_breakeven.length} deduction breakeven rows`)
      } else {
        console.log('No deduction breakeven rows to populate')
      }
      
      console.log('Deduction breakeven table rebuilt successfully via backend API')
    } else {
      console.error('Backend API failed to set deduction breakeven:', result.message)
      // toast.error(result.message || 'Failed to set deduction breakeven')
    }
  } catch (error) {
    console.error('Error calling backend set deduction breakeven API:', error)
    toast.error('Error setting deduction breakeven')
  } finally {
    // Reset the flag after a delay to allow the update to complete
    setTimeout(() => {
      isUpdatingFromAPI = false
    }, 200)
  }
}

// ADD: Function to store original backend values when deduction breakeven is first populated
function storeOriginalDeductionValues() {
  if (document.doc.deduction_breakeven && Array.isArray(document.doc.deduction_breakeven)) {
    document.doc.deduction_breakeven.forEach((row, index) => {
      if (row) {
        // Store original values when first populated from backend
        if (row._originalPercentage === undefined) {
          row._originalPercentage = row.percentage
          row._originalMinPercent = row.min_percent
          row._originalMaxPercent = row.max_percent
          row._originalAmount = row.amount
          row._originalBaseAmount = row.base_amount
          console.log(`Stored original values for deduction row ${index}:`, {
            percentage: row._originalPercentage,
            min_percent: row._originalMinPercent,
            max_percent: row._originalMaxPercent,
            amount: row._originalAmount,
            base_amount: row._originalBaseAmount
          })
        }
      }
    })
  }
}

let populateDeductionTimeout = null
let updateDeductionTimeout = null


function debouncedPopulateDeductionBreakeven() {
  if (populateDeductionTimeout) {
    clearTimeout(populateDeductionTimeout)
  }
  
  populateDeductionTimeout = setTimeout(async () => {
    debouncedPopulateDeductionBreakeven()
  }, 500) 
}

function debouncedUpdateDeductionBreakeven() {
  if (updateDeductionTimeout) {
    clearTimeout(updateDeductionTimeout)
  }
  
  updateDeductionTimeout = setTimeout(async () => {
    await setDeductionBreakevenFromAPI()
  }, 300) 
}

// ADD: Field-level validation functions for real-time feedback
function validateField(fieldName, value, rowIndex = null) {
  const errors = []
  
  // Main donation fields validation
  if (fieldName === 'company' && (!value || value.trim() === '')) {
    errors.push('Company is required')
  }
  
  if (fieldName === 'donation_type' && (!value || value.trim() === '')) {
    errors.push('Donation Type is required')
  }
  
  if (fieldName === 'due_date' && !value) {
    errors.push('Due Date is required')
  }
  
  if (fieldName === 'donor_identity' && (!value || value.trim() === '')) {
    errors.push('Donor Identity is required')
  }
  
  if (fieldName === 'contribution_type' && (!value || value.trim() === '')) {
    errors.push('Contribution Type is required')
  }
  
  if (fieldName === 'posting_date' && !value) {
    errors.push('Posting Date is required')
  }
  
  if (fieldName === 'currency' && (!value || value.trim() === '')) {
    errors.push('Currency is required')
  }
  
  if (fieldName === 'donation_cost_center' && (!value || value.trim() === '')) {
    errors.push('Donation Cost Center is required')
  }
  
  // Payment detail fields validation
  if (rowIndex !== null && document.doc.payment_detail && document.doc.payment_detail[rowIndex]) {
    const row = document.doc.payment_detail[rowIndex]
    const rowNum = rowIndex + 1
    
    if (fieldName === 'donation_amount' && (!value || value <= 0)) {
      errors.push(`Donation Amount for payment detail row ${rowNum} is required and must be greater than 0`)
    }
    
    if (fieldName === 'equity_account' && (!value || value.trim() === '')) {
      errors.push(`Equity Account for payment detail row ${rowNum} is required`)
    }
    
    if (fieldName === 'receivable_account' && (!value || value.trim() === '')) {
      errors.push(`Receivable Account for payment detail row ${rowNum} is required`)
    }
    
    if (fieldName === 'donor_id' && (!value || value.trim() === '')) {
      errors.push(`Donor for payment detail row ${rowNum} is required`)
    }
    
    if (fieldName === 'fund_class_id' && (!value || value.trim() === '')) {
      errors.push(`Fund Class for payment detail row ${rowNum} is required`)
    }
    
    if (fieldName === 'mode_of_payment' && (!value || value.trim() === '')) {
      errors.push(`Mode of Payment for payment detail row ${rowNum} is required`)
    }
    
    // Transaction Type ID is always mandatory
    if (fieldName === 'transaction_type_id' && (!value || value.trim() === '')) {
      errors.push(`Transaction Type ID for payment detail row ${rowNum} is required`)
    }
    
    // Conditional validation for bank/cheque/bank draft fields
    if (row.mode_of_payment && ['bank', 'Cheque', 'Bank Draft'].includes(row.mode_of_payment)) {
      if (fieldName === 'account_paid_to' && (!value || value.trim() === '')) {
        errors.push(`Account Paid To for payment detail row ${rowNum} is required when Mode of Payment is ${row.mode_of_payment}`)
      }
      
      if (fieldName === 'transaction_no_cheque_no' && (!value || value.trim() === '')) {
        errors.push(`Transaction No/ Cheque No for payment detail row ${rowNum} is required when Mode of Payment is ${row.mode_of_payment}`)
      }
      
      if (fieldName === 'reference_date' && !value) {
        errors.push(`Cheque / Reference Date for payment detail row ${rowNum} is required when Mode of Payment is ${row.mode_of_payment}`)
      }
    }
  }
  
  return errors
}

// ADD: Function to show field validation errors
function showFieldValidationError(fieldName, value, rowIndex = null) {
  const errors = validateField(fieldName, value, rowIndex)
  
  if (errors.length > 0) {
    toast.error(errors[0])
    return false
  }
  
  return true
}

// ADD: Function to validate percentage against min/max limits
function validatePercentageLimits(row, rowIndex) {
  const rowNum = rowIndex + 1
  const percentage = parseFloat(row.percentage)
  
  // Check if percentage is a valid number
  if (isNaN(percentage)) {
    return {
      isValid: false,
      errorMessage: `Percentage for deduction breakeven row ${rowNum} must be a valid number.`
    }
  }
  
  // Check if percentage is negative
  if (percentage < 0) {
    return {
      isValid: false,
      errorMessage: `Percentage for deduction breakeven row ${rowNum} cannot be negative.`
    }
  }
  
  // Check if percentage exceeds 100%
  if (percentage > 100) {
    return {
      isValid: false,
      errorMessage: `Percentage for deduction breakeven row ${rowNum} cannot exceed 100%.`
    }
  }
  
  // Check min/max percentage limits if they exist
  if (row.min_percent !== null && row.min_percent !== undefined && 
      row.max_percent !== null && row.max_percent !== undefined) {
    
    const minPercentage = parseFloat(row.min_percent)
    const maxPercentage = parseFloat(row.max_percent)
    
    if (!isNaN(minPercentage) && !isNaN(maxPercentage)) {
      if (percentage < minPercentage || percentage > maxPercentage) {
        return {
          isValid: false,
          errorMessage: `Percentage for deduction breakeven row ${rowNum} must be between ${minPercentage}% and ${maxPercentage}%. Current value: ${percentage}%.`
        }
      }
    } else if (!isNaN(minPercentage) && percentage < minPercentage) {
      return {
        isValid: false,
        errorMessage: `Percentage for deduction breakeven row ${rowNum} must be at least ${minPercentage}%. Current value: ${percentage}%.`
      }
    } else if (!isNaN(maxPercentage) && percentage > maxPercentage) {
      return {
        isValid: false,
        errorMessage: `Percentage for deduction breakeven row ${rowNum} must not exceed ${maxPercentage}%. Current value: ${percentage}%.`
      }
    }
  }
  
  return { isValid: true }
}

// ADD: Function to preserve user modifications before reload
function preserveUserModificationsBeforeReload() {
  const userModifications = {}
  
  if (document.doc.deduction_breakeven && Array.isArray(document.doc.deduction_breakeven)) {
    document.doc.deduction_breakeven.forEach((row, index) => {
      if (row && (row._userModifiedPercentage || row._lastPercentage !== undefined)) {
        userModifications[`deduction_breakeven_${index}`] = {
          percentage: row.percentage,
          min_percent: row.min_percent,
          max_percent: row.max_percent,
          amount: row.amount,
          base_amount: row.base_amount,
          _userModifiedPercentage: row._userModifiedPercentage,
          _lastPercentage: row._lastPercentage,
          _userModifiedMinPercent: row._userModifiedMinPercent,
          _lastMinPercent: row._lastMinPercent,
          _userModifiedMaxPercent: row._userModifiedMaxPercent,
          _lastMaxPercent: row._lastMaxPercent
        }
        console.log(`Preserved user modification for deduction row ${index}:`, userModifications[`deduction_breakeven_${index}`])
      }
    })
  }
  
  // Store in sessionStorage to survive page reloads
  sessionStorage.setItem('preservedUserModifications', JSON.stringify(userModifications))
  
  return userModifications
}

// ADD: Function to restore user modifications after reload
function restoreUserModificationsAfterReload(preservedUserModifications) {
  if (!document.doc || !document.doc.deduction_breakeven) {
    console.log('Document not ready for restoration')
    return
  }
  
  // Try to get from parameter first, then from sessionStorage
  let modifications = preservedUserModifications
  if (!modifications || Object.keys(modifications).length === 0) {
    try {
      const stored = sessionStorage.getItem('preservedUserModifications')
      if (stored) {
        modifications = JSON.parse(stored)
        sessionStorage.removeItem('preservedUserModifications') // Clean up
      }
    } catch (error) {
      console.error('Error parsing stored modifications:', error)
      return
    }
  }
  
  if (!modifications || Object.keys(modifications).length === 0) {
    console.log('No user modifications to restore')
    return
  }
  
  console.log('Restoring user modifications:', modifications)
  
  // Restore deduction breakeven modifications
  if (document.doc.deduction_breakeven && Array.isArray(document.doc.deduction_breakeven)) {
    document.doc.deduction_breakeven.forEach((row, index) => {
      const key = `deduction_breakeven_${index}`
      if (row && modifications[key]) {
        const preserved = modifications[key]
        
        // Restore user-modified percentage
        if (preserved.percentage !== undefined) {
          row.percentage = preserved.percentage
          row._lastPercentage = preserved._lastPercentage
          row._userModifiedPercentage = preserved._userModifiedPercentage
          console.log(`Restored percentage for row ${index}: ${row.percentage}`)
        }
        
        // Restore user-modified min_percent
        if (preserved.min_percent !== undefined) {
          row.min_percent = preserved.min_percent
          row._lastMinPercent = preserved._lastMinPercent
          row._userModifiedMinPercent = preserved._userModifiedMinPercent
          console.log(`Restored min_percent for row ${index}: ${row.min_percent}`)
        }
        
        // Restore user-modified max_percent
        if (preserved.max_percent !== undefined) {
          row.max_percent = preserved.max_percent
          row._lastMaxPercent = preserved._lastMaxPercent
          row._userModifiedMaxPercent = preserved._userModifiedMaxPercent
          console.log(`Restored max_percent for row ${index}: ${row.max_percent}`)
        }
        
        // Restore calculated amount based on preserved percentage
        if (preserved.percentage !== undefined) {
          const calculatedAmount = calculateDeductionAmount(row)
          if (calculatedAmount !== null) {
            row.amount = calculatedAmount
            row.base_amount = calculatedAmount
            console.log(`Restored calculated amount for row ${index}: ${calculatedAmount}`)
          }
        }
      }
    })
    
    // Force reactive update to show restored values
    document.doc = { ...document.doc }
    
    console.log('User modifications restored successfully')
  }
}

// ADD: Watcher to detect document reload and restore user modifications
watch(() => document.doc, (newDoc, oldDoc) => {
  // Check if this is a reload (newDoc exists but oldDoc was null/undefined)
  if (newDoc && (!oldDoc || oldDoc.name !== newDoc.name)) {
    console.log('Document reloaded, checking for user modifications to restore...')
    
    // Restore user modifications after a short delay to ensure document is fully loaded
    setTimeout(() => {
      restoreUserModificationsAfterReload()
    }, 1000)
  }
}, { deep: true })

// BULLETPROOF FIX: Override the triggerOnChange in the document context
document.triggerOnChange = customTriggerOnChange

// BULLETPROOF FIX: Enhanced triggerOnRowRemove to sync deletion between payment_detail and deduction_breakeven
const originalTriggerOnRowRemove = document.triggerOnRowRemove

// Create custom triggerOnRowRemove that handles payment_detail to deduction_breakeven sync
const customTriggerOnRowRemove = (selectedRows, remainingRows) => {
  console.log('Custom triggerOnRowRemove called:', { selectedRows, remainingRows })
  
  // Check if this is a payment_detail table deletion
  if (document.doc.payment_detail && Array.isArray(document.doc.payment_detail)) {
    console.log('Payment detail table deletion detected')
    
    // Get the random_ids of deleted payment detail rows
    const deletedRandomIds = new Set()
    selectedRows.forEach(rowName => {
      // Find the deleted row in the original payment_detail array
      const deletedRow = document.doc.payment_detail.find(row => row.name === rowName)
      if (deletedRow && deletedRow.random_id) {
        deletedRandomIds.add(deletedRow.random_id)
        console.log(`Payment detail row with random_id ${deletedRow.random_id} was deleted`)
      }
    })
    
    // Delete corresponding rows in deduction_breakeven table
    if (deletedRandomIds.size > 0 && document.doc.deduction_breakeven && Array.isArray(document.doc.deduction_breakeven)) {
      const originalDeductionLength = document.doc.deduction_breakeven.length
      
      // Filter out deduction_breakeven rows that match the deleted payment_detail random_ids
      document.doc.deduction_breakeven = document.doc.deduction_breakeven.filter(deductionRow => {
        const shouldKeep = !deletedRandomIds.has(deductionRow.random_id)
        if (!shouldKeep) {
          console.log(`Deleting deduction_breakeven row with random_id ${deductionRow.random_id}`)
        }
        return shouldKeep
      })
      
      const deletedDeductionCount = originalDeductionLength - document.doc.deduction_breakeven.length
      if (deletedDeductionCount > 0) {
        console.log(`Deleted ${deletedDeductionCount} corresponding deduction_breakeven rows`)
        toast.success(`Deleted ${deletedDeductionCount} corresponding deduction breakeven row(s)`)
      }
    }
  }
  
  // Call the original triggerOnRowRemove for normal functionality
  if (originalTriggerOnRowRemove) {
    originalTriggerOnRowRemove(selectedRows, remainingRows)
  }
}

// Override the triggerOnRowRemove in the document context
document.triggerOnRowRemove = customTriggerOnRowRemove

// Add computed property for create dropdown options
const createDropdownOptions = computed(() => {
  const options = []
  
  // Only show Return / Credit Note option if not already a return document
  if (document.doc && !document.doc.is_return) {
    options.push({
      label: 'Return / Credit Note',
      
    })
  }
  
  return options
})



// Add function to handle donation submission
async function submitDonation() {
  try {
    console.log('Submitting donation:', document.doc.name)
    
    // Basic validation before submission
    if (!document.doc.company) {
      toast.error('Company is required before submitting')
      return
    }
    
    if (!document.doc.donation_type) {
      toast.error('Donation Type is required before submitting')
      return
    }
    
    if (!document.doc.due_date) {
      toast.error('Due Date is required before submitting')
      return
    }
    
    if (!document.doc.payment_detail || document.doc.payment_detail.length === 0) {
      toast.error('At least one payment detail is required before submitting')
      return
    }
    
    // Refresh the document to get the latest version before submission
    console.log('Refreshing document before submission...')
    await document.reload()
    
    // Try using the document's submit method first, fallback to frappe.client.submit
    let result
    try {
      // Use the document's submit method if available
      if (document.submit) {
        console.log('Using document.submit method...')
        result = await document.submit()
      } else {
        // Fallback to frappe.client.submit
        console.log('Using frappe.client.submit method...')
        result = await call('frappe.client.submit', {
          doc: document.doc
        })
      }
    } catch (submitError) {
      console.log('Document submit method failed, trying frappe.client.submit...')
      result = await call('frappe.client.submit', {
        doc: document.doc
      })
    }
    
    console.log('Donation submission result:', result)
    
    if (result) {
      // Reload the document to get updated status
      await document.reload()
      toast.success('Donation submitted successfully')
    } else {
      toast.error('Failed to submit donation')
    }
  } catch (error) {
    console.error('Error submitting donation:', error)
    
    // Handle specific timestamp mismatch error
    if (error.message && error.message.includes('TimestampMismatchError')) {
      toast.error('Document was modified by another user. Please refresh the page and try again.')
      // Optionally reload the document
      await document.reload()
    } else {
      toast.error(`Failed to submit donation: ${error.message || error}`)
    }
  }
}

// Return/Credit Note creation state (no modal)
const isReturnCreating = ref(false)



// Add a computed property to debug the read-only state
const isReadOnly = computed(() => {
  return document.doc && document.doc.docstatus === 1
})


// Modal create handler no longer needed
</script>

<style scoped>
</style>

