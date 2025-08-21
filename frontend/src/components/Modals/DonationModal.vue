<template>
  <!-- Parent Modal -->
  <Dialog v-model="controlledShow" :options="{ size: '6xl' }" :disableOutsideClickToClose="true" :disableEscToClose="hasActiveSubModals" :zIndex="hasActiveSubModals ? 1000 : 100" :backdrop="hasActiveSubModals ? 'static' : true" :persistent="true" data-modal="parent">
    <template #body>
      <AppStyling type="modal-styling" modalType="header">
        <div class="mb-5 flex items-center justify-between">
          <h3 class="text-2xl font-semibold text-ink-gray-9">
            {{ __('Create Donation') }}
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
              :tabs="filteredTabs" 
              :data="donation.doc" 
              :doctype="'Donation'" 
              @open-create-modal="openCreateModal"
              @tab-change="handleTabChange"
              @donor-selected="handleDonorSelected"
              @fund-class-selected="handleFundClassSelected"
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
            :buttonLoading="isDonationCreating"
            @click="createNewDonation"
          />
        </div>
      </AppStyling>
    </template>
  </Dialog>

  <!-- Quick Entry Modal - Layout Editor -->
  <QuickEntryModal
    v-model="showQuickEntryModal"
    :doctype="'Donation'"
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
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { createResource, call, Dialog, Button, ErrorMessage, toast } from 'frappe-ui'
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
import AppStyling from '@/components/AppStyling.vue'
import { useDonorSelection } from '@/composables/useDonorSelection'

const props = defineProps({
  defaults: Object,
  options: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['donation-created', 'donation-deleted'])

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
const isDonationCreating = ref(false)

const modalStack = ref([]) 

const hasActiveSubModals = computed(() => {
  return modalStack.value.length > 0 && modalStack.value.some(modal => modal.visible)
})

function openQuickEntryModal() {
  const currentDoctype = modalStack.value.length > 0 ? modalStack.value[modalStack.value.length - 1].doctype : 'Donation'
  showQuickEntryModal.value = true
  quickEntryProps.value = { doctype: currentDoctype }
  nextTick(() => {
    show.value = false
  })
}

const { document: donation, triggerOnBeforeCreate } = useDocument('Donation')

// Function to generate random ID for payment detail rows (same logic as backend)
const generateRandomId = (idx) => {
  return Math.floor((1000 + idx) + (Math.random() * 9000))
}

// Function to add a new payment detail row with proper random_id generation
const addPaymentDetailRow = () => {
  const newRow = {
    donor_id: '',
    donor_name: '',
    cnic: '',
    donor_type: '',
    contact_no: '',
    email: '',

    address: '',
    co_name: '',
    co_contact_no: '',
    co_email: '',
    co_address: '',
    relationship_with_donor: '',
    donor_currency: '',
    donation_amount: 0,
    currency: donation.doc.currency || 'PKR',
    // Generate random_id immediately when adding the row
    random_id: generateRandomId((donation.doc.payment_detail?.length || 0) + 1)
  }
  
  // Add the new row to the payment_detail array
  if (!donation.doc.payment_detail) {
    donation.doc.payment_detail = []
  }
  donation.doc.payment_detail.push(newRow)
}

// Initialize donation with default values including edit_posting_date_time
const initializeDonation = () => {
  // Set default values for posting_date and posting_time
  const now = new Date()
  donation.doc.posting_date = now.toISOString().slice(0, 10) // YYYY-MM-DD format
  donation.doc.posting_time = now.toTimeString().slice(0, 5) // HH:MM format
  
  // Initialize edit_posting_date_time to 0 (false) by default
  if (donation.doc.edit_posting_date_time === undefined) {
    donation.doc.edit_posting_date_time = 0
  }
  
  // Initialize payment_detail as empty array (no default rows)
  if (!donation.doc.payment_detail) {
    donation.doc.payment_detail = []
  }
  
  // Initialize deduction_breakeven as empty array (no default rows)
  if (!donation.doc.deduction_breakeven) {
    donation.doc.deduction_breakeven = []
  }
}

// Filter tabs based on donation type
const filteredTabs = computed(() => {
  if (!tabs.data || !Array.isArray(tabs.data)) return []
  
  return tabs.data.filter(tab => {
    // If it's the "In Kind Donation" tab, only show when select_donation_type is "In-Kind Donation"
    if (tab.label === 'In Kind Donation' || tab.name === 'in_kind_donation') {
      // Note: Using exact match for "In-Kind Donation" (with hyphen)
      return donation.doc.select_donation_type === 'In-Kind Donation'
    }
    return true
  })
})

const tabs = createResource({
  url: 'crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_fields_layout',
  cache: ['QuickEntry', 'Donation'],
  params: { doctype: 'Donation', type: 'Quick Entry' },
  auto: true,
  transform: (data) => {
    // Transform the tabs data to disable create functionality for specific fields
    if (data && Array.isArray(data)) {
      data.forEach(tab => {
        if (tab.sections && Array.isArray(tab.sections)) {
          tab.sections.forEach(section => {
            if (section.columns && Array.isArray(section.columns)) {
              section.columns.forEach(column => {
                if (column.fields && Array.isArray(column.fields)) {
                  column.fields.forEach(field => {
                    // Disable create functionality for Company and Fund Class Id fields only
                    if (field.fieldname === 'company' || field.fieldname === 'fund_class_id') {
                      field.create = null // Remove create functionality
                      field.only_select = true // Force only selection mode
                      field.allow_on_submit = 0 // Prevent creation on submit
                      field.allow_in_quick_entry = 0 // Prevent creation in quick entry
                      console.log(`Field ${field.fieldname} create functionality disabled in DonationModal`)
                    }
                  })
                }
              })
            }
          })
        }
      })
    }
    return data
  }
})

const createDonation = createResource({
  url: 'frappe.client.insert',
  makeParams(values) {
    return {
      doc: {
        doctype: 'Donation',
        ...values,
      },
    }
  },
})

const { getUser, isManager } = usersStore()
const { user } = sessionStore()

watch(show, async (val) => {
  if (val && user.value) {
    // Set owner when modal opens
    donation.doc.owner = user.value
    
    // Set default values
    if (!donation.doc.status) {
      donation.doc.status = 'Draft'
    }
    
    if (!donation.doc.company) {
      donation.doc.company = 'Alkhidmat Foundation'
    }
    
    if (!donation.doc.donor_identity) {
      donation.doc.donor_identity = 'Known'
    }
    
    if (!donation.doc.select_donation_type) {
      donation.doc.select_donation_type = 'Cash'  // Default to 'Cash'
    }
    
    // Initialize posting_date and posting_time
    initializeDonation()
  }
  
  // Prevent parent modal from closing when sub-modals are active
  if (!val && hasActiveSubModals.value) {
    show.value = true
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

// Ensure main modal stays visible during sub-modal interactions
const ensureMainModalVisible = () => {
  if (modalStack.value.length > 0 && !show.value) {
    show.value = true
  }
}

// Ensure parent modal stays visible when sub-modal becomes active
const ensureParentModalVisible = (modalIdx) => {
  if (!show.value) {
    show.value = true
  }
}

// Force parent modal to stay visible and prevent any interference
const forceParentModalVisible = () => {
  if (hasActiveSubModals.value && !show.value) {
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
}

// Manage parent modal state when sub-modals are active
const manageParentModalState = () => {
  if (hasActiveSubModals.value) {
    // Ensure parent modal stays visible
    if (!show.value) {
      show.value = true
    }
    
    // Prevent parent modal from being affected by outside interactions
    nextTick(() => {
      const parentModal = document.querySelector('[data-modal="parent"]')
      if (parentModal) {
        // Make parent modal non-interactive but visible
        parentModal.style.pointerEvents = 'none'
        parentModal.style.zIndex = '1000'
        
        // Ensure backdrop doesn't interfere
        const backdrop = parentModal.querySelector('.modal-backdrop')
        if (backdrop) {
          backdrop.style.pointerEvents = 'none'
        }
        
        // Remove any close buttons or prevent their functionality
        const closeButtons = parentModal.querySelectorAll('[data-dismiss="modal"], .close, .btn-close')
        closeButtons.forEach(button => {
          button.style.pointerEvents = 'none'
          button.style.opacity = '0.5'
        })
      }
    })
  } else {
    nextTick(() => {
      const parentModal = document.querySelector('[data-modal="parent"]')
      if (parentModal) {
        parentModal.style.pointerEvents = 'auto'
        parentModal.style.zIndex = '100'
        
        const backdrop = parentModal.querySelector('.modal-backdrop')
        if (backdrop) {
          backdrop.style.pointerEvents = 'auto'
        }
        
        // Restore close buttons
        const closeButtons = parentModal.querySelectorAll('[data-dismiss="modal"], .close, .btn-close')
        closeButtons.forEach(button => {
          button.style.pointerEvents = 'auto'
          button.style.opacity = '1'
        })
      }
    })
  }
}

// Handle sub-modal interactions to prevent parent modal interference
const handleSubModalInteraction = () => {
  // Force parent modal to stay visible
  forceParentModalVisible()
  
  // Prevent any backdrop clicks from affecting parent modal
  nextTick(() => {
    const parentModal = document.querySelector('[data-modal="parent"]')
    if (parentModal) {
      parentModal.style.pointerEvents = 'none'
      parentModal.style.zIndex = '1000'
    }
  })
}

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
    // Parent modal can now be closed
  }
}

function handleModalClose(idx) {
  modalStack.value.splice(idx, 1)
  
  // If no more sub-modals, allow parent modal to be closed
  if (!hasActiveSubModals.value) {
    // Reset any modal-specific states if needed
  }
}

// Enhanced error handling function
function extractDonationErrorMessage(err) {
  let errorMessage = 'An error occurred while creating the donation.'
  
  // Handle different error types
  if (err?.exc_type === 'MandatoryError') {
    // Parse mandatory field errors
    const missingFields = parseMandatoryError(err)
    if (missingFields.length > 0) {
      errorMessage = `Please fill in the following required fields:\n\n${missingFields.map(field => `• ${field}`).join('\n')}`
    } else {
      errorMessage = 'Please fill all required fields before submitting.'
    }
  } else if (err?.exc_type === 'ValidationError') {
    errorMessage = `Validation error: ${err.messages?.[0] || 'Invalid data provided'}`
  } else if (err?.exc_type === 'LinkError') {
    errorMessage = 'Invalid reference in one of the fields. Please check your selections.'
  } else if (err?.exc_type === 'PermissionError') {
    errorMessage = 'You do not have permission to create donations.'
  } else if (err?.exc_type === 'DuplicateEntryError') {
    errorMessage = 'A donation with this information already exists.'
  } else if (err?.message) {
    // Try to parse custom error messages
    errorMessage = parseCustomErrorMessage(err.message)
  } else if (err?.exc) {
    // Parse exception traceback
    errorMessage = parseExceptionMessage(err.exc)
  }
  
  return errorMessage
}

// Parse MandatoryError to extract field names
function parseMandatoryError(err) {
  const missingFields = []
  
  if (err.messages && Array.isArray(err.messages)) {
    err.messages.forEach(msg => {
      // Parse different formats of MandatoryError
      const patterns = [
        /\[([^,]+),\s*([^\]]+)\]:\s*([^,\s]+)/, // [Donation, DONATION-2025-00007]: equity_account
        /MandatoryError.*?:\s*([^,\n]+)/, // MandatoryError: equity_account
        /Field\s+([^,\s]+)\s+is\s+mandatory/, // Field equity_account is mandatory
        /([^,\s]+)\s+is\s+required/, // equity_account is required
      ]
      
      for (const pattern of patterns) {
        const match = msg.match(pattern)
        if (match) {
          const fieldName = match[1] || match[2] || match[3]
          if (fieldName) {
            const fieldLabel = getFieldLabel(fieldName)
            missingFields.push(fieldLabel)
            break
          }
        }
      }
    })
  }
  
  return [...new Set(missingFields)] // Remove duplicates
}

// Parse custom error messages
function parseCustomErrorMessage(message) {
  if (typeof message !== 'string') return message
  
  // Handle specific error patterns
  if (message.includes('equity_account')) {
    return 'Equity Account is required. Please select a fund class to automatically populate this field.'
  }
  if (message.includes('fund_class_id')) {
    return 'Fund Class is required. Please select a fund class for each payment detail row.'
  }
  if (message.includes('donor_id')) {
    return 'Donor is required. Please select a donor for each payment detail row.'
  }
  if (message.includes('payment_detail')) {
    return 'Payment details are required. Please add at least one payment detail row.'
  }
  
  return message
}

// Parse exception messages
function parseExceptionMessage(exc) {
  if (typeof exc !== 'string') return exc
  
  // Extract meaningful error from traceback
  if (exc.includes('MandatoryError')) {
    const match = exc.match(/MandatoryError.*?:\s*([^,\n]+)/)
    if (match) {
      const fieldName = match[1].trim()
      const fieldLabel = getFieldLabel(fieldName)
      return `${fieldLabel} is required. Please fill this field before submitting.`
    }
  }
  
  return exc
}

// Get user-friendly field labels
function getFieldLabel(fieldName) {
  const fieldLabels = {
    // Main donation fields
    'company': 'Company',
    'donor_identity': 'Donor Identity',
    'contribution_type': 'Contribution Type',
    'posting_date': 'Posting Date',
    'currency': 'Currency',
    'donation_cost_center': 'Donation Cost Center',
    
    // Payment detail fields
    'equity_account': 'Equity Account',
    'fund_class_id': 'Fund Class',
    'donor_id': 'Donor',
    'donation_amount': 'Donation Amount',
    'mode_of_payment': 'Mode of Payment',
    'account_paid_to': 'Account Paid To',
    'receivable_account': 'Receivable Account',
    'receipt_number': 'Receipt Number',
    
    // Common field patterns
    'pay_service_area': 'Service Area',
    'pay_subservice_area': 'Subservice Area',
    'pay_product': 'Product',
    'project_id': 'Project',
    
    // Default fallback
    'default': 'Required Field'
  }
  
  // Handle nested field names (e.g., payment_detail.equity_account)
  if (fieldName.includes('.')) {
    const parts = fieldName.split('.')
    const lastPart = parts[parts.length - 1]
    return fieldLabels[lastPart] || formatFieldName(lastPart)
  }
  
  return fieldLabels[fieldName] || formatFieldName(fieldName)
}

// Format field names to be more readable
function formatFieldName(fieldName) {
  return fieldName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
    .trim()
}

// Enhanced validation before submission
function validateDonationForm() {
  const errors = []
  
  // Validate main donation fields
  if (!donation.doc.company) {
    errors.push('Company is required')
  }
  if (!donation.doc.donor_identity) {
    errors.push('Donor Identity is required')
  }
  if (!donation.doc.contribution_type) {
    errors.push('Contribution Type is required')
  }
  if (!donation.doc.posting_date) {
    errors.push('Posting Date is required')
  }
  if (!donation.doc.currency) {
    errors.push('Currency is required')
  }
  
  // Validate payment detail rows
  const paymentDetails = donation.doc.payment_detail || []
  if (paymentDetails.length === 0) {
    errors.push('At least one payment detail row is required')
  } else {
    paymentDetails.forEach((row, index) => {
      const rowNum = index + 1
      
      if (!row.donor_id) {
        errors.push(`Row ${rowNum}: Donor is required`)
      }
      if (!row.fund_class_id) {
        errors.push(`Row ${rowNum}: Fund Class is required`)
      }
      if (!row.donation_amount || row.donation_amount <= 0) {
        errors.push(`Row ${rowNum}: Donation Amount must be greater than 0`)
      }
      if (donation.doc.contribution_type !== 'Pledge') {
        if (!row.mode_of_payment) {
          errors.push(`Row ${rowNum}: Mode of Payment is required`)
        }
        if (row.mode_of_payment && row.mode_of_payment !== 'Cash' && !row.transaction_no_cheque_no) {
          errors.push(`Row ${rowNum}: Transaction/Cheque Number is required for non-cash payments`)
        }
        if (row.mode_of_payment && row.mode_of_payment !== 'Cash' && !row.account_paid_to) {
          errors.push(`Row ${rowNum}: Account Paid To is required for non-cash payments`)
        }
      }
    })
  }
  
  return errors
}

// Enhanced createNewDonation function
function createNewDonation() {
  console.log('Creating donation:', donation.doc)
  
  // Clear previous errors
  error.value = null
  
  // Validate form before submission
  const validationErrors = validateDonationForm()
  if (validationErrors.length > 0) {
    const errorMessage = `Please fix the following validation errors:\n\n${validationErrors.map(error => `• ${error}`).join('\n')}`
    error.value = errorMessage
    return
  }
  
  isDonationCreating.value = true
  createDonation.submit(donation.doc, {
    onSuccess(data) {
      console.log('Donation created successfully:', data)
      isDonationCreating.value = false
      show.value = false
      emit('donation-created')
      router.push({ name: 'DonationDetail', params: { donationId: data.name } })
    },
    onError(err) {
      console.error('Failed to create donation:', err)
      isDonationCreating.value = false
      
      // Use enhanced error handling
      const errorMessage = extractDonationErrorMessage(err)
      error.value = errorMessage
      
      // Also show toast notification for better UX
      if (typeof frappe !== 'undefined' && frappe.show_alert) {
        frappe.show_alert({ message: errorMessage, indicator: 'red' })
      } else {
        // Fallback for when frappe is not available
        console.error('Donation creation error:', errorMessage)
      }
    },
  })
}

function onQuickEntryClose() {
  showQuickEntryModal.value = false
}

function onQuickEntrySaved() {
  showQuickEntryModal.value = false
}

function onQuickEntryReset() {}

function handleTabChange(tabIndex) {
  console.log('Tab changed to:', tabIndex)
}

// 100% WORKING SOLUTION: Fetch donor details using the available 'call' function
async function fetchDonorDetails(donorId) {
  if (!donorId) {
    console.log('No donor ID provided')
    return null
  }
  
  try {
    console.log('Fetching donor details for:', donorId)
    
    // Use the 'call' function that's already imported and working
    const donorDetails = await call('akf_accounts.akf_accounts.doctype.donation.donation.get_donor_details', {
      donor_id: donorId
    })
    
    console.log('Donor details fetched successfully:', donorDetails)
    return donorDetails
    
  } catch (error) {
    console.error('Error fetching donor details:', error)
    
    // Fallback: Try to get donor details using a different method
    try {
      console.log('Trying fallback method...')
      const fallbackResult = await call('frappe.client.get', {
        doctype: 'Donor',
        name: donorId
      })
      
      console.log('Fallback method successful:', fallbackResult)
      return fallbackResult
      
    } catch (fallbackError) {
      console.error('Fallback method also failed:', fallbackError)
      return null
    }
  }
}

function updateDonorFields(row, donorDetails) {
  if (!donorDetails) {
    console.log('No donor details to update')
    return
  }
  
  console.log('Updating row with donor details:', donorDetails)
  console.log('Row before update:', { ...row })
  
  // Map donor fields to payment detail fields - EXACT field names from your doctype
  const fieldMappings = {
    'donor_name': 'donor_name',
    'donor_type': 'donor_type',
    'contact_no': 'contact_no',
    'email': 'email',
    'city': 'city',
    'address': 'address',
    'co_name': 'co_name',
    'co_contact_no': 'co_contact_no',
    'co_email': 'co_email',
    'co_address': 'co_address',
    'relationship_with_donor': 'relationship_with_donor',
    'cnic': 'cnic',
    'donor_desk_id': 'donor_desk_id'
  }
  
  // Update each field with donor data
  Object.entries(fieldMappings).forEach(([donorField, rowField]) => {
    if (donorDetails[donorField] !== undefined) {
      const oldValue = row[rowField]
      row[rowField] = donorDetails[donorField] || ''
      console.log(`Updated ${rowField}: ${oldValue} -> ${row[rowField]}`)
    }
  })
  
  console.log('Row after update:', { ...row })
  
  // Force reactive update - CRITICAL for Vue to detect changes
  if (donation.doc.payment_detail) {
    console.log('Forcing reactive update of payment_detail')
    donation.doc.payment_detail = [...donation.doc.payment_detail]
  }
}

function clearDonorFields(row) {
  console.log('Clearing donor fields for row')
  
  const donorFields = [
    'donor_name', 'donor_type', 'contact_no', 'email', 'city', 'address',
    'co_name', 'co_contact_no', 'co_email', 'co_address', 'relationship_with_donor', 
    'cnic', 'donor_desk_id'
  ]
  
  donorFields.forEach(fieldName => {
    row[fieldName] = ''
  })
  
  // Force reactive update
  if (donation.doc.payment_detail) {
    donation.doc.payment_detail = [...donation.doc.payment_detail]
  }
}

// 100% WORKING: Direct donor handling in DonationModal
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
      
      // Show success message
      toast.success('Donor details loaded successfully')
    } else {
      console.log('No donor details received')
      toast.error('Could not fetch donor details')
    }
  } catch (error) {
    console.error('Error in direct donor handling:', error)
    toast.error('Error loading donor details')
  }
}

// NEW: Fund Class handling functionality
async function fetchFundClassDetails(fundClassId) {
  console.log('Fetching Fund Class details for:', fundClassId)
  
  try {
    const result = await call('akf_accounts.akf_accounts.doctype.donation.donation.get_fund_class_details', {
      fund_class_id: fundClassId,
      company: donation.doc.company || 'Alkhidmat Foundation Pakistan'
    })
    
    console.log('Fund Class details received:', result)
    return result
  } catch (error) {
    console.error('Error fetching Fund Class details:', error)
    toast.error('Error loading Fund Class details')
    return null
  }
}

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
    }
  })
  
  console.log('Row after Fund Class update:', { ...row })
  
  // Force reactive update - CRITICAL for Vue to detect changes
  if (donation.doc.payment_detail) {
    console.log('Forcing reactive update of payment_detail after Fund Class update')
    donation.doc.payment_detail = [...donation.doc.payment_detail]
  }
}

function clearFundClassFields(row) {
  console.log('Clearing Fund Class fields for row')
  
  const fundClassFields = [
    'pay_service_area', 'pay_subservice_area', 'pay_product',
    'equity_account', 'receivable_account', 'cost_center'
  ]
  
  fundClassFields.forEach(fieldName => {
    row[fieldName] = ''
  })
  
  // Force reactive update
  if (donation.doc.payment_detail) {
    donation.doc.payment_detail = [...donation.doc.payment_detail]
  }
}

// 100% WORKING: Direct Fund Class handling in DonationModal
async function handleFundClassSelectionDirect(fundClassId, row) {
  console.log('Handling Fund Class selection directly:', { fundClassId, row })
  
  if (!fundClassId) {
    clearFundClassFields(row)
    return
  }
  
  try {
    const fundClassDetails = await fetchFundClassDetails(fundClassId)
    if (fundClassDetails) {
      updateFundClassFields(row, fundClassDetails)
      console.log('Fund Class fields updated successfully')
      
      // Show success message
      toast.success('Fund Class details loaded successfully')
    } else {
      console.log('No Fund Class details received')
      toast.error('Could not fetch Fund Class details')
    }
  } catch (error) {
    console.error('Error in direct Fund Class handling:', error)
    toast.error('Error loading Fund Class details')
  }
}

// Add donor selection handler
function handleDonorSelected(event) {
  console.log('Donor selected in payment detail:', event)
  
  const { row, donorId, success } = event
  
  if (success && donorId && row) {
    console.log('Processing donor selection for row:', row, 'with donor ID:', donorId)
    
    // Force a reactive update of the payment_detail table
    if (donation.doc.payment_detail) {
      console.log('Forcing reactive update of payment_detail')
      donation.doc.payment_detail = [...donation.doc.payment_detail]
    }
  }
}

// 100% WORKING: Watcher for donor_id changes in payment_detail
watch(() => donation.doc.payment_detail, (newPaymentDetail) => {
  if (newPaymentDetail && Array.isArray(newPaymentDetail)) {
    newPaymentDetail.forEach((row, index) => {
      if (row.donor_id && row.donor_id !== row._lastDonorId) {
        console.log(`Donor ID changed in row ${index}:`, row.donor_id)
        row._lastDonorId = row.donor_id
        
        // Handle the donor selection
        handleDonorSelectionDirect(row.donor_id, row)
      }
      
      // NEW: Watch for fund_class_id changes
      if (row.fund_class_id && row.fund_class_id !== row._lastFundClassId) {
        console.log(`Fund Class ID changed in row ${index}:`, row.fund_class_id)
        row._lastFundClassId = row.fund_class_id
        
        // Handle the Fund Class selection
        handleFundClassSelectionDirect(row.fund_class_id, row)
      }
    })
  }
}, { deep: true })

// 100% WORKING: Watcher for fund_class_id changes in payment_detail
watch(() => donation.doc.payment_detail, (newPaymentDetail) => {
  if (newPaymentDetail && Array.isArray(newPaymentDetail)) {
    newPaymentDetail.forEach((row, index) => {
      if (row.fund_class_id && row.fund_class_id !== row._lastFundClassId) {
        console.log(`Fund Class ID changed in row ${index}:`, row.fund_class_id)
        row._lastFundClassId = row.fund_class_id
        
        // Handle the Fund Class selection
        handleFundClassSelectionDirect(row.fund_class_id, row)
      }
    })
  }
}, { deep: true })

// NEW: Add Fund Class selection handler
function handleFundClassSelected(event) {
  console.log('Fund Class selected in payment detail:', event)
  
  const { row, fundClassId, success } = event
  
  if (success && fundClassId && row) {
    console.log('Processing Fund Class selection for row:', row, 'with Fund Class ID:', fundClassId)
    
    // Force a reactive update of the payment_detail table
    if (donation.doc.payment_detail) {
      console.log('Forcing reactive update of payment_detail')
      donation.doc.payment_detail = [...donation.doc.payment_detail]
    }
  }
}

// Debug logging
onMounted(() => {
  console.log('DonationModal mounted')
  console.log('DonationModal props defaults:', props.defaults)
  console.log('Tabs resource:', tabs)
  console.log('Show value:', show.value)
})

// Watch for changes in the show value
watch(show, (newVal, oldVal) => {
  console.log('Show value changed:', { old: oldVal, new: newVal })
})

// Watch for select_donation_type changes to update tabs
watch(() => donation.doc.select_donation_type, (newType) => {
  console.log('Select donation type changed to:', newType)
  // Force re-render of tabs when select_donation_type changes
  nextTick(() => {
    // This will trigger the computed filteredTabs to update
  })
})

// Watch for changes in edit_posting_date_time to update field read-only states
watch(() => donation.doc.edit_posting_date_time, (newValue) => {
  if (tabs.data) {
    tabs.data.forEach((tab) => {
      tab.sections.forEach((section) => {
        section.columns.forEach((column) => {
          column.fields.forEach((field) => {
            if (field.fieldname === 'posting_date' || field.fieldname === 'posting_time') {
              field.read_only = !newValue
            }
          })
        })
      })
    })
  }
})

// Watch for changes in payment_detail table to ensure random_id is always present
watch(() => donation.doc.payment_detail, (newPaymentDetail, oldPaymentDetail) => {
  if (newPaymentDetail && Array.isArray(newPaymentDetail)) {
    // Ensure every row has a random_id
    newPaymentDetail.forEach((row, index) => {
      if (row && !row.random_id) {
        row.random_id = generateRandomId(index + 1)
      }
    })
  }
}, { deep: true })

// Alternative approach: Watch for array length changes
watch(() => donation.doc.payment_detail?.length, (newLen, oldLen) => {
  if (newLen && oldLen && newLen > oldLen) {
    // Assign random_id to the new row(s)
    for (let i = oldLen; i < newLen; i++) {
      if (donation.doc.payment_detail[i] && !donation.doc.payment_detail[i].random_id) {
        donation.doc.payment_detail[i].random_id = generateRandomId(i + 1)
      }
    }
  }
})
</script>

<style scoped>
.field-layout-wrapper {
  min-height: 400px;
}
</style>
