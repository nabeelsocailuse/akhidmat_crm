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
              @add-deduction-row="handleAddDeductionRow"
            />
          </div>
          
          <!-- Use the same ErrorMessage component as DonorModal -->
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
      :donor-filtering="modal.donorFiltering"
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
import { ref, watch, onMounted, onUnmounted, computed, readonly } from 'vue'
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
// import { useDonorSelection } from '@/composables/useDonorSelection'

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
    area: '',
    co_city: '',
    co_country: '',
    co_designation: '',
    donor_currency: '',
    donation_amount: 0,
    currency: donation.doc.currency || 'PKR',
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
  
  // Set default values for due_date, currency, and exchange_rate (same as backend)
  donation.doc.due_date = now.toISOString().slice(0, 10) // YYYY-MM-DD format - same as today
  donation.doc.currency = 'PKR' // Default currency
  donation.doc.exchange_rate = 1 // Default exchange rate
  
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

// Add this function after initializeDonation()
const resetDonationData = () => {
  console.log('Resetting donation data to fresh state')
  
  // Reset to fresh document
  donation.doc = {
    doctype: 'Donation',
    status: 'Draft',
    company: 'Alkhidmat Foundation',
    donor_identity: 'Known',
    donation_type: 'Cash', // Default to Cash
    currency: 'PKR', // Default currency
    exchange_rate: 1, // Default exchange rate
    owner: user.value,
    payment_detail: [],
    deduction_breakeven: []
  }
  
  // Initialize fresh data
  initializeDonation()
  
  // Clear errors
  error.value = null
  
  console.log('Donation data reset successfully')
}

// ADD: Function to get filtered donor query based on donor identity
function getDonorQuery() {
  const filters = {
    status: 'Active'
  }
  
  // Add donor identity filter based on the selected donor identity
  if (donation.doc.donor_identity) {
    filters.donor_identity = donation.doc.donor_identity
    console.log('Adding donor identity filter:', donation.doc.donor_identity)
  }
  
  // Add currency filter if available
  if (donation.doc.currency) {
    filters.default_currency = donation.doc.currency
  }
  
  console.log('Donor query filters:', filters)
  
  return {
    doctype: 'Donor',
    filters: filters,
    fields: ['name', 'donor_name', 'donor_type', 'donor_desk', 'contact_no', 'email', 'city', 'address', 'cnic']
  }
}

// ADD: Function to get donor filters for field configuration
function getDonorFilters() {
  const filters = {}
  
  // Add donor identity filter
  if (donation.doc.donor_identity) {
    filters.donor_identity = donation.doc.donor_identity
  }
  
  // Add status filter
  filters.status = 'Active'
  
  // Add currency filter if available
  if (donation.doc.currency) {
    filters.default_currency = donation.doc.currency
  }
  
  return filters
}

// ADD: Function to create a dynamic donor query function for each field
function createDonorQueryFunction() {
  return function() {
    return getDonorQuery()
  }
}

// ADD: Function to get cost center filters for donation_cost_center field
function getCostCenterFilters() {
  const filters = {
    is_group: 0,
    disabled: 0
  }
  
  // Add company filter if available
  if (donation.doc.company) {
    filters.company = donation.doc.company
  }
  
  return filters
}

// ADD: Function to get contribution type options based on donor identity
function getContributionTypeOptions() {
  // If donor_identity is not 'Known', force contribution_type to 'Donation' and make it read-only elsewhere
  if (donation.doc.donor_identity !== 'Known') {
    // Auto-select "Donation" if not already set
    if (donation.doc.contribution_type !== 'Donation') {
      donation.doc.contribution_type = 'Donation'
      donation.doc.contribution_type.readonly = 1
    }
    return ['Donation']
  }
  // If donor_identity is 'Known', allow both options
  return ['Donation', 'Pledge']
}

// ADD: Function to create a dynamic contribution type query function
function createContributionTypeQueryFunction() {
  return function() {
    return {
      doctype: 'Contribution Type',
      filters: {
        name: ['in', getContributionTypeOptions()]
      }
    }
  }
}

// UPDATE: Enhanced field filtering to properly configure donor fields
const filteredTabs = computed(() => {
  if (!tabs.data || !Array.isArray(tabs.data)) return []
  
  return tabs.data.filter(tab => {
    // If it's the "In Kind Donation" tab, only show when donation_type is "In Kind Donation"
    if (tab.label === 'In Kind Donation' || tab.name === 'in_kind_donation') {
      // Use the correct field name: donation_type (not select_donation_type)
      return donation.doc.donation_type === 'In Kind Donation'
    }
    return true
  }).map(tab => {
    // Clone the tab to avoid mutating the original data
    const filteredTab = { ...tab }
    
    // Filter sections based on donation type
    filteredTab.sections = tab.sections.map(section => {
      const filteredSection = { ...section }
      
      // Filter columns within sections
      filteredSection.columns = section.columns.map(column => {
        const filteredColumn = { ...column }
        
        // Filter fields within columns
        filteredColumn.fields = column.fields.filter(field => {
          // Hide Payment Details and Deduction Breakeven sections when donation type is "In Kind Donation"
          if (donation.doc.donation_type === 'In Kind Donation') {
            // Hide Payment Details section
            if (field.fieldname === 'payment_detail' || 
                field.fieldname === 'payment_details_section' ||
                field.label === 'Payment Details') {
              return false
            }
            
            // Hide Deduction Breakeven section
            if (field.fieldname === 'deduction_breakeven' || 
                field.fieldname === 'section_break_otbq' ||
                field.label === 'Deduction Breakeven') {
              return false
            }
            
            // Hide any other fields that should be hidden for In Kind Donations
            if (field.fieldname === 'mode_of_payment' ||
                field.fieldname === 'account_paid_to' ||
                field.fieldname === 'transaction_no_cheque_no' ||
                field.fieldname === 'reference_date') {
              return false
            }
          }
          
          return true
        }).map(field => {
          // Create a new field object to avoid mutating the original
          const enhancedField = { ...field }
          
          // Configure donor_id fields with proper query filtering
          if (field.fieldname === 'donor_id') {
            enhancedField.get_query = createDonorQueryFunction()
            enhancedField.depends_on = 'donor_identity'
            enhancedField.filters = getDonorFilters()
            console.log('Configured donor_id field with query filtering and depends_on')
          }
          
          // Configure donor fields in items table
          if (field.fieldname === 'donor') {
            enhancedField.get_query = createDonorQueryFunction()
            enhancedField.depends_on = 'donor_identity'
            enhancedField.filters = getDonorFilters()
            console.log('Configured donor field with query filtering for items')
          }
          
          // Configure donation_cost_center (Branch) field with proper filtering
          if (field.fieldname === 'donation_cost_center') {
            enhancedField.get_query = () => ({
              doctype: 'Cost Center',
              filters: getCostCenterFilters()
            })
            // FIX: Change depends_on to use donation_type while keeping existing filters
            enhancedField.depends_on = "eval: doc.donation_type==\"Cash\";"
            enhancedField.filters = getCostCenterFilters()
            console.log('Configured donation_cost_center field with donation type dependency')
          }
          
          // Configure contribution_type field with donor identity filtering
          if (field.fieldname === 'contribution_type') {
            enhancedField.get_query = createContributionTypeQueryFunction()
            enhancedField.depends_on = 'donor_identity'
            enhancedField.options = getContributionTypeOptions()
            console.log('Configured contribution_type field with donor identity dependency')
          }
          
          return enhancedField
        })
        
        return filteredColumn
      })
      
      return filteredSection
    })
    
    return filteredTab
  })
})

const tabs = createResource({
  url: 'crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_fields_layout',
  cache: ['DonationModal', 'Donation', 'quick-entry'], 
  params: { doctype: 'Donation', type: 'Quick Entry' },
  auto: true,
  transform: (_tabs) => {
    return _tabs.forEach((tab) => {
      tab.sections.forEach((section) => {
        section.columns.forEach((column) => {
          column.fields.forEach((field) => {
            if (field.fieldtype === 'Table') {
              // Initialize child tables with empty arrays (no default rows)
              if (!donation.doc[field.fieldname]) {
                donation.doc[field.fieldname] = []
              }
            }
            
            // Set default values for specific fields
            if (field.fieldname === 'status' && !donation.doc.status) {
              donation.doc.status = 'Draft'
            }
            
            if (field.fieldname === 'company' && !donation.doc.company) {
              donation.doc.company = 'Alkhidmat Foundation'
            }
            
            if (field.fieldname === 'donor_identity' && !donation.doc.donor_identity) {
              donation.doc.donor_identity = 'Known'
            }
            
            if (field.fieldname === 'donation_type' && !donation.doc.donation_type) {
              donation.doc.donation_type = 'Cash'  // Default to 'Cash'
            }
            
            // Set default values for due_date, currency, and exchange_rate
            if (field.fieldname === 'due_date' && !donation.doc.due_date) {
              donation.doc.due_date = new Date().toISOString().slice(0, 10)
            }
            
            if (field.fieldname === 'currency' && !donation.doc.currency) {
              donation.doc.currency = 'PKR'
            }
            
            if (field.fieldname === 'exchange_rate' && !donation.doc.exchange_rate) {
              donation.doc.exchange_rate = 1
            }
            
            // Handle posting_date and posting_time read-only state based on edit_posting_date_time
            if (field.fieldname === 'posting_date' || field.fieldname === 'posting_time') {
              field.read_only = !donation.doc.edit_posting_date_time
            }
            
            // Ensure posting_time is treated as a Time field, not Date
            if (field.fieldname === 'posting_time') {
              field.fieldtype = 'Time'
              field.default = 'Now'
            }
            
            // Ensure posting_date is treated as a Date field
            if (field.fieldname === 'posting_date') {
              field.fieldtype = 'Date'
              field.default = 'Today'
            }
            
            // Ensure edit_posting_date_time is treated as a Check field
            if (field.fieldname === 'edit_posting_date_time') {
              field.fieldtype = 'Check'
              field.default = 0
            }
          })
        })
      })
    })
  },
  onSuccess(data) {
    // Ensure required fields are set
    if (!donation.doc.status) {
      donation.doc.status = 'Draft'
    }
    
    if (!donation.doc.company) {
      donation.doc.company = 'Alkhidmat Foundation'
    }
    
    if (!donation.doc.donor_identity) {
      donation.doc.donor_identity = 'Known'
    }
    
    if (!donation.doc.donation_type) {
      donation.doc.donation_type = 'Cash'  // Default to 'Cash'
    }
    
    // Ensure due_date, currency, and exchange_rate are set
    if (!donation.doc.due_date) {
      donation.doc.due_date = new Date().toISOString().slice(0, 10)
    }
    
    if (!donation.doc.currency) {
      donation.doc.currency = 'PKR'
    }
    
    if (!donation.doc.exchange_rate) {
      donation.doc.exchange_rate = 1
    }
    
    // Initialize posting_date and posting_time
    initializeDonation()
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

// UPDATE: Enhanced initialization to include donor filtering setup
onMounted(() => {
  console.log('DonationModal mounted')
  console.log('DonationModal props defaults:', props.defaults)
  console.log('Tabs resource:', tabs)
  console.log('Show value:', show.value)
  
  // Initialize the donation document with required fields
  initializeDonationDocument()
  
  // Configure field queries for child tables
  configureFieldQueries()
  
  // Apply donor filtering after form is rendered
  nextTick(() => {
    applyDonorFilteringToForm()
  })
})

// UPDATE: Enhanced watcher for show value to apply filtering when modal opens
watch(show, async (val) => {
  if (val && user.value) {
    refreshTabs()
    resetDonationData() // Use the reset function
    
    // Apply donor filtering after form is rendered
    nextTick(() => {
      applyDonorFilteringToForm()
    })
  }
  
  // Prevent parent modal from closing when sub-modals are active
  if (!val && hasActiveSubModals.value) {
    show.value = true
  }
})

// Add this watcher to force refresh when modal opens
watch(show, async (val) => {
  if (val && user.value) {
    refreshTabs()
    resetDonationData() // Use the reset function
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

// UPDATE: Enhanced openCreateModal function to pass donor filtering data
function openCreateModal({ doctype, initialValue, onSuccess }) {
  // Ensure parent modal stays visible
  if (!show.value) {
    show.value = true
  }
  
  // ADD: Debug logging to see what's being passed
  console.log('openCreateModal called with:', { doctype, initialValue, onSuccess })
  console.log('Current donation.doc.donor_identity:', donation.doc.donor_identity)
  console.log('Current donation.doc.currency:', donation.doc.currency)
  console.log('Current donation.doc.company:', donation.doc.company)
  
  // Create modal data with donor filtering information
  const modalData = {
    doctype,
    initialValue,
    onSuccess,
    visible: true,
    // ADD: Pass donor filtering data to sub-modal
    donorFiltering: {
      donor_identity: donation.doc.donor_identity,
      currency: donation.doc.currency,
      company: donation.doc.company
    }
  }
  
  console.log('Modal data being created:', modalData)
  
  modalStack.value.push(modalData)
  
  nextTick(() => {
    if (hasActiveSubModals.value && !show.value) {
      show.value = true
    }
  })
}

// ADD: Function to update donor filtering in existing modals
function updateDonorFilteringInModals() {
  console.log('Updating donor filtering in existing modals')
  console.log('Current donor_identity:', donation.doc.donor_identity)
  
  modalStack.value.forEach((modal, index) => {
    if (modal.donorFiltering) {
      modal.donorFiltering.donor_identity = donation.doc.donor_identity
      modal.donorFiltering.currency = donation.doc.currency
      modal.donorFiltering.company = donation.doc.company
      console.log(`Updated modal ${index} donor filtering:`, modal.donorFiltering)
    }
  })
}

// ADD: Watcher to update donor filtering in modals when donor identity changes
watch(() => donation.doc.donor_identity, (newDonorIdentity, oldDonorIdentity) => {
  console.log('Donor Identity changed from', oldDonorIdentity, 'to:', newDonorIdentity)
  
  // Clear contribution_type when donor identity changes to force re-evaluation
  if (donation.doc.contribution_type) {
    donation.doc.contribution_type = ''
    console.log('Cleared contribution_type due to donor identity change')
  }
  
  // Update donor filtering in existing modals
  updateDonorFilteringInModals()
  
  // Clear existing donor selections in payment detail when donor identity changes
  if (donation.doc.payment_detail && Array.isArray(donation.doc.payment_detail)) {
    donation.doc.payment_detail.forEach((row, index) => {
      // Clear donor-related fields
      row.donor_id = ''
      row.donor_name = ''
      row.donor_type = ''
      row.donor_desk = ''
      row.contact_no = ''
      row.email = ''
      row.city = ''
      row.address = ''
      row.cnic = ''
      // ADD: Clear care-of details fields as well
      row.co_name = ''
      row.co_contact_no = ''
      row.co_email = ''
      row.co_address = ''
      row.relationship_with_donor = ''
      row.area = ''
      row.co_city = ''
      row.co_country = ''
      row.co_designation = ''
      
      // Clear the last donor ID tracker
      row._lastDonorId = null
    })
    
    // Force reactive update
    donation.doc.payment_detail = [...donation.doc.payment_detail]
  }
  
  // Clear existing donor selections in items table when donor identity changes
  if (donation.doc.items && Array.isArray(donation.doc.items)) {
    donation.doc.items.forEach((row, index) => {
      // Clear donor-related fields
      row.donor = ''
      row.donor_name = ''
      row.donor_type = ''
      row.donor_desk = ''
      // ADD: Clear care-of details fields for items table as well
      row.co_name = ''
      row.co_contact_no = ''
      row.co_email = ''
      row.co_address = ''
      row.relationship_with_donor = ''
      row.area = ''
      row.co_city = ''
      row.co_country = ''
      row.co_designation = ''
      
      // Clear the last donor ID tracker
      row._lastItemsDonorId = null
    })
    
    // Force reactive update
    donation.doc.items = [...donation.doc.items]
  }
  
  // Force re-render of tabs to apply new filtering
  nextTick(() => {
    // This will trigger the computed filteredTabs to update with new donor filters
    console.log('Tabs re-rendered for new donor identity:', newDonorIdentity)
  })
  
  console.log('Donor queries updated for new donor identity:', newDonorIdentity)
})

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
    const result = await call('crm.fcrm.doctype.donation.api.get_fund_class_details', {
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

// FIX: Update the updateFundClassFields function to ensure proper field mapping
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
  
  // Force reactive update - CRITICAL for Vue to detect changes
  if (donation.doc.payment_detail) {
    console.log('Forcing reactive update of payment_detail after Fund Class update')
    donation.doc.payment_detail = [...donation.doc.payment_detail]
  }
  
  // CRITICAL: Log the final state to verify fields are set
  console.log('Final row state after Fund Class update:', {
    equity_account: row.equity_account,
    receivable_account: row.receivable_account,
    service_area: row.pay_service_area,
    subservice_area: row.pay_subservice_area,
    product: row.pay_product
  })
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

// NEW: Track last selected Fund Class from payment details to sync with deduction_breakeven
const lastSelectedFundClassId = ref(null)
// REPLACE pending single value with a FIFO queue to keep order of selections
const pendingDeductionFundClassQueue = ref([]) // array of fund_class_id in order

// 100% WORKING: Direct Fund Class handling in DonationModal
async function handleFundClassSelectionDirect(fundClassId, row) {
  console.log('Handling Fund Class selection directly:', { fundClassId, row })
  
  if (!fundClassId) {
    clearFundClassFields(row)
    // Reset last selected when cleared
    lastSelectedFundClassId.value = null
    return
  }
  
  // Track latest selected (queueing is handled in the payment_detail watcher)
  lastSelectedFundClassId.value = fundClassId
  
  try {
    const fundClassDetails = await fetchFundClassDetails(fundClassId)
    if (fundClassDetails) {
      updateFundClassFields(row, fundClassDetails)
      console.log('Fund Class fields updated successfully')
      
      // Do not assign fund_class_id here; assignment is handled by the deduction row-length watcher to avoid race conditions
      
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

// ADD the missing fetchDonorDetails function:
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

// ADD the missing updateDonorFields function:
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
  
  // Force reactive update - CRITICAL for Vue to detect changes
  if (donation.doc.payment_detail) {
    console.log('Forcing reactive update of payment_detail after donor update')
    donation.doc.payment_detail = [...donation.doc.payment_detail]
  }
}

// ADD the missing clearDonorFields function:
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
  
  // Force reactive update
  if (donation.doc.payment_detail) {
    donation.doc.payment_detail = [...donation.doc.payment_detail]
  }
}

// ADD the missing mode of payment handling for account_paid_to:
async function handleModeOfPaymentChange(modeOfPaymentId, row) {
  console.log('Handling Mode of Payment change:', { modeOfPaymentId, row })
  
  if (!modeOfPaymentId) {
    // Clear fields if no mode of payment is selected
    row.account_paid_to = ''
    row.transaction_no_cheque_no = ''
    row.reference_date = null
    return
  }
  
  // Clear transaction details first
  row.transaction_no_cheque_no = ''
  row.reference_date = null
  
  try {
    // Get the mode of payment document to determine account type and default account
    const modeOfPayment = await call('frappe.client.get', {
      doctype: 'Mode of Payment',
      name: modeOfPaymentId
    })
    
    if (modeOfPayment) {
      console.log('Mode of Payment details:', modeOfPayment)
      
      // Try to get the default account from mode of payment
      if (modeOfPayment.accounts && modeOfPayment.accounts.length > 0) {
        // Find the account that matches the company
        const companyAccount = modeOfPayment.accounts.find(acc => acc.company === donation.doc.company)
        if (companyAccount && companyAccount.default_account) {
          row.account_paid_to = companyAccount.default_account
          console.log('Auto-filled account_paid_to:', row.account_paid_to)
        }
      }
      
      // Force reactive update
      if (donation.doc.payment_detail) {
        donation.doc.payment_detail = [...donation.doc.payment_detail]
      }
      
      console.log('Mode of Payment fields updated successfully')
      toast.success('Mode of Payment details loaded successfully')
    }
  } catch (error) {
    console.error('Error fetching Mode of Payment details:', error)
    toast.error('Error loading Mode of Payment details')
  }
}

// UPDATE the watcher to include mode_of_payment changes:
watch(() => donation.doc.payment_detail, (newPaymentDetail) => {
  if (newPaymentDetail && Array.isArray(newPaymentDetail)) {
    newPaymentDetail.forEach((row, index) => {
      if (row.donor_id && row.donor_id !== row._lastDonorId) {
        console.log(`Donor ID changed in row ${index}:`, row.donor_id)
        row._lastDonorId = row.donor_id
        
        // Handle the donor selection
        handleDonorSelectionDirect(row.donor_id, row)
      }
      
      // Watch for fund_class_id changes
      if (row.fund_class_id && row.fund_class_id !== row._lastFundClassId) {
        console.log(`Fund Class ID changed in row ${index}:`, row.fund_class_id)
        row._lastFundClassId = row.fund_class_id
        
        // Only enqueue fund class for deduction_breakeven if contribution_type is not "Pledge"
        if (donation.doc.contribution_type !== 'Pledge') {
          // Enqueue current fund class for the next deduction row
          pendingDeductionFundClassQueue.value.push(row.fund_class_id)
          console.log('Enqueued fund class for deduction_breakeven (not Pledge)')
        } else {
          console.log('Skipped enqueueing fund class for deduction_breakeven (contribution_type is Pledge)')
        }
        
        // Handle the Fund Class selection
        handleFundClassSelectionDirect(row.fund_class_id, row)
      }
      
      // NEW: Watch for mode_of_payment changes
      if (row.mode_of_payment && row.mode_of_payment !== row._lastModeOfPayment) {
        console.log(`Mode of Payment changed in row ${index}:`, row.mode_of_payment)
        row._lastModeOfPayment = row.mode_of_payment
        
        // Handle the Mode of Payment selection
        handleModeOfPaymentChange(row.mode_of_payment, row)
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

// ADD: Event handler for add-deduction-row event from Grid component
function handleAddDeductionRow(event) {
  console.log('Received add-deduction-row event:', event)
  
  const { fundClassId, deductionDetails, newRowData, sourceTable } = event
  
  // Check contribution_type before adding row
  if (donation.doc.contribution_type === 'Pledge') {
    console.log('Skipped adding deduction_breakeven row - contribution_type is Pledge')
    toast.warning('Deduction Breakeven rows cannot be added when Contribution Type is Pledge')
    return
  }
  
  // Proceed with normal row addition logic
  if (!donation.doc.deduction_breakeven) {
    donation.doc.deduction_breakeven = []
  }
  
  donation.doc.deduction_breakeven.push(newRowData)
  console.log('Deduction breakeven row added via event handler')
}

// ADD a function to ensure all required fields are set before submission:
// FIX: Update the prepareDonationForSubmission function to actively ensure account fields are set
async function prepareDonationForSubmission() {
  console.log('Preparing donation for submission...')
  
  // Ensure doctype is set
  if (!donation.doc.doctype) {
    donation.doc.doctype = 'Donation'
  }
  
  // Ensure company is set
  if (!donation.doc.company) {
    donation.doc.company = 'Alkhidmat Foundation Pakistan'
  }
  
  // Ensure posting_date is set
  if (!donation.doc.posting_date) {
    donation.doc.posting_date = new Date().toISOString().split('T')[0]
  }
  
  // Ensure posting_time is set
  if (!donation.doc.posting_time) {
    donation.doc.posting_time = '00:00:00'
  }
  
  // Ensure due_date is set (same as posting_date if not set)
  if (!donation.doc.due_date) {
    donation.doc.due_date = donation.doc.posting_date || new Date().toISOString().split('T')[0]
  }
  
  // Ensure currency is set
  if (!donation.doc.currency) {
    donation.doc.currency = 'PKR'
  }
  
  // Ensure to_currency is set
  if (!donation.doc.to_currency) {
    donation.doc.to_currency = 'PKR'
  }
  
  // Ensure exchange_rate is set
  if (!donation.doc.exchange_rate) {
    donation.doc.exchange_rate = 1
  }
  
  // For In Kind Donations, skip payment detail processing
  if (donation.doc.donation_type === 'In Kind Donation') {
    console.log('In Kind Donation - skipping payment detail processing')
    return donation.doc
  }
  
  // CRITICAL: Ensure payment_detail has required fields and account fields are properly set
  if (donation.doc.payment_detail && Array.isArray(donation.doc.payment_detail)) {
    for (let index = 0; index < donation.doc.payment_detail.length; index++) {
      const row = donation.doc.payment_detail[index]
      
      // Ensure each row has required fields
      if (!row.doctype) {
        row.doctype = 'Payment Detail'
      }
      if (!row.idx) {
        row.idx = index + 1
      }
      if (!row.random_id) {
        row.random_id = `row_${index + 1}_${Date.now()}`
      }
      
      // CRITICAL: If account fields are missing, fetch them from fund class
      if (!row.equity_account || !row.receivable_account) {
        if (row.fund_class_id) {
          console.log(`Row ${index + 1}: Fetching missing account fields from fund class:`, row.fund_class_id)
          
          try {
            const fundClassDetails = await fetchFundClassDetails(row.fund_class_id)
            if (fundClassDetails) {
              // Update the missing fields
              if (!row.equity_account && fundClassDetails.equity_account) {
                row.equity_account = fundClassDetails.equity_account
                console.log(`Row ${index + 1}: Set equity_account to:`, row.equity_account)
              }
              
              if (!row.receivable_account && fundClassDetails.receivable_account) {
                row.receivable_account = fundClassDetails.receivable_account
                console.log(`Row ${index + 1}: Set receivable_account to:`, row.receivable_account)
              }
              
              // Also update other fund class fields if missing
              if (!row.pay_service_area && fundClassDetails.service_area) {
                row.pay_service_area = fundClassDetails.service_area
              }
              if (!row.pay_subservice_area && fundClassDetails.subservice_area) {
                row.pay_subservice_area = fundClassDetails.subservice_area
              }
              if (!row.pay_product && fundClassDetails.product) {
                row.pay_product = fundClassDetails.product
              }
              if (!row.cost_center && fundClassDetails.cost_center) {
                row.cost_center = fundClassDetails.cost_center
              }
            }
          } catch (error) {
            console.error(`Error fetching fund class details for row ${index + 1}:`, error)
          }
        } else {
          console.error(`Row ${index + 1}: fund_class_id is missing, cannot fetch account fields`)
        }
      }
      
      // CRITICAL: Final validation - ensure account fields are set
      if (!row.equity_account) {
        throw new Error(`Row ${index + 1}: equity_account is still missing after attempting to fetch from fund class`)
      }
      
      if (!row.receivable_account) {
        throw new Error(`Row ${index + 1}: receivable_account is still missing after attempting to fetch from fund class`)
      }
      
      // Ensure donation_amount is set
      if (!row.donation_amount || row.donation_amount <= 0) {
        row.donation_amount = 0
      }
      
      // Ensure net_amount is set
      if (!row.net_amount) {
        row.net_amount = row.donation_amount || 0
      }
      
      // Ensure outstanding_amount is set
      if (!row.outstanding_amount) {
        row.outstanding_amount = row.donation_amount || 0
      }
      
      console.log(`Row ${index + 1} prepared:`, {
        equity_account: row.equity_account,
        receivable_account: row.receivable_account,
        fund_class_id: row.fund_class_id,
        donor_id: row.donor_id
      })
    }
  }
  
  console.log('Final prepared donation document:', donation.doc)
  return donation.doc
}

// RESTORE: Add proper validation function for the modal
function validateDonationForm() {
  const errors = []
  
  console.log('Starting form validation with donation data:', donation.doc)
  
  // Validate main donation fields
  if (!donation.doc.company) {
    errors.push('Company is required')
  }
  if (!donation.doc.donor_identity) {
    errors.push('Donor Identity is required')
  }
  
  // Contribution type is not required for In Kind Donations
  if (donation.doc.donation_type !== 'In Kind Donation' && !donation.doc.contribution_type) {
    errors.push('Contribution Type is required')
  }
  
  if (!donation.doc.posting_date) {
    errors.push('Posting Date is required')
  }
  if (donation.doc.donation_type === 'Cash' && !donation.doc.currency) {
    errors.push('Currency is required')
  }
  
  // Validate Due Date against Invoice Issuance Date
  if (donation.doc.due_date && donation.doc.posting_date) {
    const dueDate = new Date(donation.doc.due_date)
    const invoiceDate = new Date(donation.doc.posting_date)
    
    // Reset time to start of day for accurate comparison
    dueDate.setHours(0, 0, 0, 0)
    invoiceDate.setHours(0, 0, 0, 0)
    
    if (dueDate < invoiceDate) {
      errors.push('Due Date must be equal to or greater than Invoice Issuance Date (Posting Date)')
    }
  }
  
  // For In Kind Donations, validate required fields
  if (donation.doc.donation_type === 'In Kind Donation') {
    console.log('Validating In Kind Donation fields:', {
      stock_entry_type: donation.doc.stock_entry_type,
      warehouse: donation.doc.warehouse,
      items: donation.doc.items
    })
    
    // if (!donation.doc.stock_entry_type) {
    //   errors.push('Stock Entry Type is required')
    // }
    if (!donation.doc.warehouse) {
      errors.push('Warehouse is required')
    }
    
    // Validate items table
    const items = donation.doc.items || []
    if (items.length === 0) {
      errors.push('At least one item is required for In Kind Donation')
    } else {
      items.forEach((item, index) => {
        const itemNum = index + 1
        
        if (!item.donor) {
          errors.push(`Item ${itemNum}: Donor is required`)
        }
        if (!item.item_code) {
          errors.push(`Item ${itemNum}: Item Code is required`)
        }
        if (!item.qty || item.qty <= 0) {
          errors.push(`Item ${itemNum}: Quantity must be greater than 0`)
        }
        if (!item.basic_rate || item.basic_rate <= 0) {
          errors.push(`Item ${itemNum}: Basic Rate is required`)
        }
        // if (!item.project) {
        //   errors.push(`Item ${itemNum}: Project is required`)
        // }
        if (!item.asset_category) {
          errors.push(`Item ${itemNum}: Asset Category is required`)
        }
        if (!item.transaction_type) {
          errors.push(`Item ${itemNum}: Transaction Type is required`)
        }
      })
    }
    
    console.log('In Kind Donation validation completed with errors:', errors)
    // Only validate basic fields for In Kind Donations
    return errors
  }
  
  // Validate payment detail rows only for Cash donations
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
      if (!row.transaction_type_id) {
        errors.push(`Row ${rowNum}: Transaction Type Id is required`)
      }
      if (!row.intention_id) {  
        errors.push(`Row ${rowNum}: Intention Id is required`)
      }
      if (!row.donation_amount || row.donation_amount <= 0) {
        errors.push(`Row ${index + 1}: Donation Amount must be greater than 0`)
      }
      
      // CRITICAL: Validate required account fields
      if (!row.equity_account) {
        errors.push(`Row ${rowNum}: Equity Account is required. Please select a fund class to auto-populate this field.`)
      }
      if (!row.receivable_account) {
        errors.push(`Row ${rowNum}: Receivable Account is required. Please select a fund class to auto-populate this field.`)
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
  
  console.log('Form validation completed with errors:', errors)
  return errors
}

// UPDATE: Enhanced createNewDonation function to match DonorModal's error handling
async function createNewDonation() {
  console.log('Creating new donation...')
  
  try {
    // First validate the form
    const validationErrors = validateDonationForm()
    if (validationErrors.length > 0) {
      const errorMessage = `Please fill in the following required fields:\n\n${validationErrors.map(error => `• ${error}`).join('\n')}`
      error.value = errorMessage
      
      // Show error toast
      toast.error(`Please fix ${validationErrors.length} validation error(s)`)
      
      // Scroll to top to show errors
      nextTick(() => {
        const modalBody = document.querySelector('[data-modal="parent"] .modal-body')
        if (modalBody) {
          modalBody.scrollTop = 0
        }
      })
      
      return
    }
    
    // Prepare the donation document (now async)
    const preparedDoc = await prepareDonationForSubmission()
    
    // CRITICAL: Final validation of account fields before submission
    let hasMissingAccounts = false
    if (preparedDoc.payment_detail && Array.isArray(preparedDoc.payment_detail)) {
      preparedDoc.payment_detail.forEach((row, index) => {
        if (!row.equity_account || !row.receivable_account) {
          console.error(`Row ${index + 1} still has missing accounts:`, {
            equity_account: row.equity_account,
            receivable_account: row.receivable_account
          })
          hasMissingAccounts = true
        }
      })
    }
    
    if (hasMissingAccounts) {
      error.value = 'Some payment detail rows are missing required account fields. Please ensure fund classes are selected.'
      toast.error('Some payment detail rows are missing required account fields. Please ensure fund classes are selected.')
      return
    }
    
    // CRITICAL: Ensure the account fields are properly included in the document
    if (preparedDoc.payment_detail && Array.isArray(preparedDoc.payment_detail)) {
      preparedDoc.payment_detail.forEach((row, index) => {
        console.log(`Row ${index + 1} final check:`, {
          equity_account: row.equity_account,
          receivable_account: row.receivable_account,
          fund_class_id: row.fund_class_id
        })
        
        // Force the fields to be included
        if (row.equity_account) {
          row.equity_account = row.equity_account.toString()
        }
        if (row.receivable_account) {
          row.receivable_account = row.receivable_account.toString()
        }
      })
    }
    
    // Log the document being submitted
    console.log('Submitting prepared donation document:', preparedDoc)
  
    // Create the donation
    call('frappe.client.insert', {
      doc: preparedDoc
    }).then(result => {
      console.log('Donation created successfully:', result)
      toast.success('Donation created successfully!')
      
      // Clear errors on success
      error.value = null
      
      // Close modal and refresh
      show.value = false
      emit('donation-created', result)
    }).catch(error => {
      console.error('Error creating donation:', error)
      handleDonationError(error)
    })
    
  } catch (error) {
    console.error('Error preparing donation:', error)
    const errorMessage = `Error preparing donation document: ${error.message}`
    error.value = errorMessage
    toast.error(errorMessage)
  }
}

// ADD: Function to handle donation errors properly
function handleDonationError(error) {
  console.error('Donation creation error:', error)
  
  if (error._server_messages) {
    try {
      const serverMessages = JSON.parse(error._server_messages)
      if (serverMessages.length > 0) {
        const message = JSON.parse(serverMessages[0])
        toast.error(message.message || 'Error creating donation')
        return
      }
    } catch (parseError) {
      console.error('Error parsing server messages:', parseError)
    }
  }
  
  if (error.message) {
    toast.error(error.message)
  } else {
    toast.error('Error creating donation. Please check the console for details.')
  }
}

// CALL the initialization function when the modal is mounted:
onMounted(() => {
  console.log('DonationModal mounted')
  console.log('DonationModal props defaults:', props.defaults)
  console.log('Tabs resource:', tabs)
  console.log('Show value:', show.value)
  
  // Initialize the donation document with required fields
  initializeDonationDocument()
  
  // Configure field queries for child tables
  configureFieldQueries()
})

// Watch for changes in the show value
watch(show, (newVal, oldVal) => {
  console.log('Show value changed:', { old: oldVal, new: newVal })
})

// Watch for changes in donation_type
watch(() => donation.doc.donation_type, (newType) => {
  console.log('Donation type changed to:', newType)
  
  // Clear previous errors when donation type changes
  error.value = null
  
  // Clear payment_detail and deduction_breakeven when switching to In Kind Donation
  if (newType === 'In Kind Donation') {
    donation.doc.payment_detail = []
    donation.doc.deduction_breakeven = []
    console.log('Cleared payment_detail and deduction_breakeven for In Kind Donation')
  }
  
  // Clear items when switching to Cash donation
  if (newType === 'Cash') {
    donation.doc.items = []
    console.log('Cleared items for Cash donation')
  }
  
  // Force re-render of tabs when donation_type changes
  nextTick(() => {
    // This will trigger the computed filteredTabs to update
    console.log('Tabs re-rendered for donation type:', newType)
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

// NEW: Watcher to auto-fill fund_class_id on newly added deduction_breakeven row
watch(() => donation.doc.deduction_breakeven?.length, (newLen, oldLen) => {
  if (typeof newLen === 'number' && typeof oldLen === 'number' && newLen > oldLen) {
    const newIndex = newLen - 1
    const newRow = donation.doc.deduction_breakeven[newIndex]
    if (newRow) {
      // Only auto-fill fund_class_id if contribution_type is not "Pledge"
      if (donation.doc.contribution_type !== 'Pledge') {
        // Consume from queue to match this creation with the latest selection
        const fcToApply = pendingDeductionFundClassQueue.value.length > 0
          ? pendingDeductionFundClassQueue.value.shift()
          : lastSelectedFundClassId.value
        if (!newRow.fund_class_id && fcToApply) {
          newRow.fund_class_id = fcToApply
          newRow._fcAssigned = true
          console.log('Auto-filled fund_class_id on new deduction_breakeven row (queue):', { index: newIndex, fundClassId: fcToApply })
          donation.doc.deduction_breakeven = [...donation.doc.deduction_breakeven]
        }
        
        // Defer as a fallback to catch race conditions (still uses queue head if any)
        nextTick(() => {
          setTimeout(() => {
            if (!newRow.fund_class_id && !newRow._fcAssigned) {
              const fcFallback = pendingDeductionFundClassQueue.value.length > 0
                ? pendingDeductionFundClassQueue.value.shift()
                : lastSelectedFundClassId.value
              if (fcFallback) {
                newRow.fund_class_id = fcFallback
                newRow._fcAssigned = true
                console.log('Deferred auto-fill fund_class_id on new deduction_breakeven row (queue fallback):', { index: newIndex, fundClassId: fcFallback })
                donation.doc.deduction_breakeven = [...donation.doc.deduction_breakeven]
              }
            }
          }, 0)
        })
      } else {
        console.log('Skipped auto-filling fund_class_id for deduction_breakeven (contribution_type is Pledge)')
      }
    }
  }
})

// NEW: Deep watcher to handle rows inserted at arbitrary positions or async updates
watch(() => donation.doc.deduction_breakeven, (rows) => {
  if (rows && Array.isArray(rows)) {
    let changed = false
    rows.forEach((row, idx) => {
      // Only auto-fill fund_class_id if contribution_type is not "Pledge"
      if (donation.doc.contribution_type !== 'Pledge' && !row._fcAssigned && !row.fund_class_id) {
        const fcToApply = pendingDeductionFundClassQueue.value.length > 0
          ? pendingDeductionFundClassQueue.value.shift()
          : lastSelectedFundClassId.value
        if (fcToApply) {
          row.fund_class_id = fcToApply
          row._fcAssigned = true
          console.log('Filled fund_class_id via deep watcher on deduction_breakeven:', { index: idx, fundClassId: fcToApply })
          changed = true
        }
      }
    })
    if (changed) {
      donation.doc.deduction_breakeven = [...donation.doc.deduction_breakeven]
    }
  }
}, { deep: true })

// FIX: Listen for the specific QuickEntryModal save event
onMounted(() => {
  // Listen for custom events that indicate layout has been updated
  const handleLayoutUpdate = () => {
    console.log('Layout update event received - reloading tabs')
    refreshTabs()
  }
  
  const handleQuickEntrySave = (event) => {
    console.log('QuickEntryModal save event received:', event.detail)
    if (event.detail.doctype === 'Donation') {
      console.log('Donation layout updated - refreshing tabs')
      refreshTabs()
    }
  }
  
  // Add event listeners
  window.addEventListener('layout-updated', handleLayoutUpdate)
  window.addEventListener('quick-entry-layout-saved', handleQuickEntrySave)
  
  // Cleanup on unmount
  onUnmounted(() => {
    window.removeEventListener('layout-updated', handleLayoutUpdate)
    window.removeEventListener('quick-entry-layout-saved', handleQuickEntrySave)
  })
})


// Enhanced field configuration for account_paid_to
function configureAccountPaidToField(row) {
  // This function configures the account_paid_to field for a specific row
  // It should be called when a row is added or when mode_of_payment changes
  
  if (row.mode_of_payment) {
    // Get the mode of payment type to determine account types
    call('frappe.client.get', {
      doctype: 'Mode of Payment',
      name: row.mode_of_payment
    }).then(modeOfPayment => {
      if (modeOfPayment) {
        let accountTypes = ['Bank', 'Cash']
        if (modeOfPayment.type === 'Bank') {
          accountTypes = ['Bank']
        } else if (modeOfPayment.type === 'Cash') {
          accountTypes = ['Cash']
        }
        
        // Update the field's filtering
        updateAccountPaidToFieldFilters(row, accountTypes)
      }
    })
  }
}

function updateAccountPaidToFieldFilters(row, accountTypes) {
  // This function updates the filtering for the account_paid_to field
  // It should be implemented based on how your form fields are set up
  
  console.log(`Updating account_paid_to filters for row ${row.idx}:`, accountTypes)
  
  // The actual implementation depends on how your form fields are set up
  // You might need to update the field's get_query function or apply filters directly
}

// ADD: Function to handle donor selection in items child table
async function handleItemsDonorSelection(donorId, row) {
  console.log('Handling donor selection in items table:', { donorId, row })
  
  if (!donorId) {
    clearItemsDonorFields(row)
    return
  }
  
  try {
    const donorDetails = await fetchDonorDetails(donorId)
    if (donorDetails) {
      updateItemsDonorFields(row, donorDetails)
      console.log('Items donor fields updated successfully')
      
      // Show success message
      toast.success('Donor details loaded successfully')
    } else {
      console.log('No donor details received')
      toast.error('Could not fetch donor details')
    }
  } catch (error) {
    console.error('Error in items donor handling:', error)
    toast.error('Error loading donor details')
  }
}

// ADD: Function to update donor fields in items table
function updateItemsDonorFields(row, donorDetails) {
  console.log('Updating items row with donor details:', donorDetails)
  console.log('Items row before update:', { ...row })
  
  // Map donor fields to items table fields
  const fieldMappings = {
    'donor_name': 'donor_name',
    'donor_type': 'donor_type',
    'donor_desk': 'donor_desk'
  }
  
  // Update each field with donor data
  Object.entries(fieldMappings).forEach(([donorField, rowField]) => {
    if (donorDetails[donorField] !== undefined) {
      const oldValue = row[rowField]
      row[rowField] = donorDetails[donorField] || ''
      console.log(`Updated ${rowField}: ${oldValue} -> ${row[rowField]}`)
    }
  })
  
  console.log('Items row after donor update:', { ...row })
  
  // Force reactive update - CRITICAL for Vue to detect changes
  if (donation.doc.items) {
    console.log('Forcing reactive update of items table after donor update')
    donation.doc.items = [...donation.doc.items]
  }
}

// NEW: Function to update Fund Class fields in items table (service_area, subservice_area, product)
function updateItemsFundClassFields(row, fundClassDetails) {
  console.log('Updating items row with Fund Class details:', fundClassDetails)
  console.log('Items row before Fund Class update:', { ...row })

  const fieldMappings = {
    'service_area': 'service_area',
    'subservice_area': 'subservice_area',
    'product': 'product'
  }

  Object.entries(fieldMappings).forEach(([fcField, rowField]) => {
    if (fundClassDetails[fcField] !== undefined) {
      const oldValue = row[rowField]
      row[rowField] = fundClassDetails[fcField] || ''
      console.log(`Updated items ${rowField}: ${oldValue} -> ${row[rowField]}`)
    }
  })

  // Force reactive update for items table
  if (donation.doc.items) {
    console.log('Forcing reactive update of items after Fund Class update')
    donation.doc.items = [...donation.doc.items]
  }
}

// NEW: Clear Fund Class derived fields in items row
function clearItemsFundClassFields(row) {
  console.log('Clearing items Fund Class fields for row')
  const fields = ['service_area', 'subservice_area', 'product']
  fields.forEach(f => { row[f] = '' })

  if (donation.doc.items) {
    donation.doc.items = [...donation.doc.items]
  }
}

// NEW: Handle Fund Class selection in items table
async function handleItemsFundClassSelection(fundClassId, row) {
  console.log('Handling Fund Class selection in items table:', { fundClassId, row })
  if (!fundClassId) {
    clearItemsFundClassFields(row)
    return
  }

  try {
    const fundClassDetails = await fetchFundClassDetails(fundClassId)
    if (fundClassDetails) {
      updateItemsFundClassFields(row, fundClassDetails)
      console.log('Items Fund Class fields updated successfully')
      toast.success('Fund Class details loaded successfully')
    } else {
      console.log('No Fund Class details received for items')
      toast.error('Could not fetch Fund Class details')
    }
  } catch (error) {
    console.error('Error in items Fund Class handling:', error)
    toast.error('Error loading Fund Class details')
  }
}

// ADD: Enhanced watcher to handle items table donor selection
watch(() => donation.doc.items, (newItems) => {
  if (newItems && Array.isArray(newItems)) {
    newItems.forEach((row, index) => {
      if (row.donor && row.donor !== row._lastItemsDonorId) {
        console.log(`Donor ID changed in items row ${index}:`, row.donor)
        row._lastItemsDonorId = row.donor
        
        // Handle the donor selection in items table
        handleItemsDonorSelection(row.donor, row)
      }

      // UPDATED: Watch for fund_class changes on items (field name is fund_class)
      if (row.fund_class && row.fund_class !== row._lastItemsFundClass) {
        console.log(`Fund Class changed in items row ${index}:`, row.fund_class)
        row._lastItemsFundClass = row.fund_class
        
        // Handle the Fund Class selection in items table
        handleItemsFundClassSelection(row.fund_class, row)
      }

      // UPDATED: Clear fields if fund_class is cleared
      if (!row.fund_class && row._lastItemsFundClass) {
        console.log(`Fund Class cleared in items row ${index}`)
        row._lastItemsFundClass = null
        clearItemsFundClassFields(row)
      }
    })
  }
}, { deep: true })

// ADD: Function to clear donor fields in items table
function clearItemsDonorFields(row) {
  console.log('Clearing items donor fields for row')
  
  const donorFields = [
    'donor_name', 'donor_type', 'donor_desk',
    // ADD: Care-of details fields for items table as well
    'co_name', 'co_contact_no', 'co_email', 'co_address', 'relationship_with_donor',
    'area', 'co_city', 'co_country', 'co_designation'
  ]
  
  donorFields.forEach(fieldName => {
    row[fieldName] = ''
  })
  
  // Force reactive update
  if (donation.doc.items) {
    donation.doc.items = [...donation.doc.items]
  }
}

// ADD: Function to initialize donation document with required fields
function initializeDonationDocument() {
  console.log('Initializing donation document')
  
  // Ensure required fields are set
  if (!donation.doc.status) {
    donation.doc.status = 'Draft'
  }
  
  if (!donation.doc.company) {
    donation.doc.company = 'Alkhidmat Foundation'
  }
  
  if (!donation.doc.donor_identity) {
    donation.doc.donor_identity = 'Known'
  }
  
  if (!donation.doc.donation_type) {
    donation.doc.donation_type = 'Cash'
  }
  
  // Initialize posting_date and posting_time
  initializeDonation()
  
  console.log('Donation document initialized:', donation.doc)
}

// ADD: Function to configure field queries for child tables
function configureFieldQueries() {
  console.log('Configuring field queries for child tables')
  
  // This function will be called when the modal is mounted
  // The actual field query configuration is handled in the filteredTabs computed property
  // and in the watchers for donor_identity and currency changes
}

// ADD: Function to refresh tabs (used in event listeners)
function refreshTabs() {
  console.log('Refreshing tabs')
  if (tabs.reload) {
    tabs.reload()
  }
}

// ADD: Functionality for deduction_breakeven child table (mirror items table)
async function handleDeductionDonorSelection(donorId, row) {
  console.log('Handling donor selection in deduction_breakeven table:', { donorId, row })

  if (!donorId) {
    clearDeductionDonorFields(row)
    return
  }

  try {
    const donorDetails = await fetchDonorDetails(donorId)
    if (donorDetails) {
      updateDeductionDonorFields(row, donorDetails)
      console.log('Deduction breakeven donor fields updated successfully')
      toast.success('Donor details loaded successfully')
    } else {
      console.log('No donor details received for deduction breakeven')
      toast.error('Could not fetch donor details')
    }
  } catch (error) {
    console.error('Error in deduction breakeven donor handling:', error)
    toast.error('Error loading donor details')
  }
}

function updateDeductionDonorFields(row, donorDetails) {
  console.log('Updating deduction_breakeven row with donor details:', donorDetails)
  console.log('Deduction row before donor update:', { ...row })

  // Prefer *_id fields per UI; gracefully fallback to non-id sources if needed
  const sourceOptions = {
    donor_name: ['donor_name'],
    donor_type_id: ['donor_type_id', 'donor_type'],
    donor_desk_id: ['donor_desk_id', 'donor_desk'],
    // Optional care-of details if present in this table schema
    co_name: ['co_name'],
    co_contact_no: ['co_contact_no'],
    co_email: ['co_email'],
    co_address: ['co_address'],
    relationship_with_donor: ['relationship_with_donor'],
    area: ['area'],
    co_city: ['co_city'],
    co_country: ['co_country'],
    co_designation: ['co_designation']
  }

  Object.entries(sourceOptions).forEach(([rowField, donorFields]) => {
    let value
    for (const src of donorFields) {
      if (donorDetails[src] !== undefined && donorDetails[src] !== null) {
        value = donorDetails[src]
        break
      }
    }
    if (value !== undefined) {
      const oldValue = row[rowField]
      row[rowField] = value || ''
      console.log(`Updated deduction ${rowField}: ${oldValue} -> ${row[rowField]}`)
    }
  })

  if (donation.doc.deduction_breakeven) {
    donation.doc.deduction_breakeven = [...donation.doc.deduction_breakeven]
  }
}

function clearDeductionDonorFields(row) {
  console.log('Clearing deduction_breakeven donor fields for row')
  const fields = [
    'donor_name', 'donor_type_id', 'donor_desk_id',
    'co_name', 'co_contact_no', 'co_email', 'co_address', 'relationship_with_donor',
    'area', 'co_city', 'co_country', 'co_designation'
  ]
  fields.forEach(f => { if (f in row) row[f] = '' })

  if (donation.doc.deduction_breakeven) {
    donation.doc.deduction_breakeven = [...donation.doc.deduction_breakeven]
  }
}

function updateDeductionFundClassFields(row, fundClassDetails) {
  console.log('Updating deduction_breakeven row with Fund Class details:', fundClassDetails)
  console.log('Deduction row before Fund Class update:', { ...row })

  // Map to the exact *_id fields shown in UI; fallback to non-id names if API returns them
  const sourceOptions = [
    { target: 'service_area_id', sources: ['service_area_id', 'service_area'] },
    { target: 'subservice_area_id', sources: ['subservice_area_id', 'subservice_area'] },
    { target: 'product_id', sources: ['product_id', 'product'] },
    { target: 'pay_service_area_id', sources: ['service_area_id', 'service_area'] },
    { target: 'pay_subservice_area_id', sources: ['subservice_area_id', 'subservice_area'] },
    { target: 'pay_product_id', sources: ['product_id', 'product'] },
    { target: 'cost_center_id', sources: ['cost_center_id', 'cost_center'] }
  ]

  sourceOptions.forEach(({ target, sources }) => {
    let value
    for (const src of sources) {
      if (fundClassDetails[src] !== undefined && fundClassDetails[src] !== null) {
        value = fundClassDetails[src]
        break
      }
    }
    if (value !== undefined) {
      const oldValue = row[target]
      row[target] = value || ''
      console.log(`Updated deduction ${target}: ${oldValue} -> ${row[target]}`)
    }
  })

  if (donation.doc.deduction_breakeven) {
    console.log('Forcing reactive update of deduction_breakeven after Fund Class update')
    donation.doc.deduction_breakeven = [...donation.doc.deduction_breakeven]
  }
}

function clearDeductionFundClassFields(row) {
  console.log('Clearing deduction_breakeven Fund Class fields for row')
  const fields = ['service_area_id', 'subservice_area_id', 'product_id', 'pay_service_area_id', 'pay_subservice_area_id', 'pay_product_id', 'cost_center_id']
  fields.forEach(f => { if (f in row) row[f] = '' })

  // Also clear the selector fields if present
  if ('fund_class_id' in row) row.fund_class_id = ''
  if ('fund_class' in row) row.fund_class = ''

  if (donation.doc.deduction_breakeven) {
    donation.doc.deduction_breakeven = [...donation.doc.deduction_breakeven]
  }
}

async function handleDeductionFundClassSelection(fundClassId, row) {
  console.log('Handling Fund Class selection in deduction_breakeven table:', { fundClassId, row })
  if (!fundClassId) {
    // Clear id fields as well when cleared
    if ('fund_class_id' in row) row.fund_class_id = ''
    if ('fund_class' in row) row.fund_class = ''
    clearDeductionFundClassFields(row)
    return
  }

  // Ensure the selected Fund Class ID is reflected on the row immediately
  if ('fund_class_id' in row) row.fund_class_id = fundClassId
  if ('fund_class' in row) row.fund_class = fundClassId

  try {
    const fundClassDetails = await fetchFundClassDetails(fundClassId)
    if (fundClassDetails) {
      updateDeductionFundClassFields(row, fundClassDetails)
      console.log('Deduction breakeven Fund Class fields updated successfully')
      toast.success('Fund Class details loaded successfully')
    } else {
      console.log('No Fund Class details received for deduction breakeven')
      toast.error('Could not fetch Fund Class details')
    }
  } catch (error) {
    console.error('Error in deduction breakeven Fund Class handling:', error)
    toast.error('Error loading Fund Class details')
  }
}


// Watcher for deduction_breakeven child table (mirror items watcher)
watch(() => donation.doc.deduction_breakeven, (newRows) => {
  if (newRows && Array.isArray(newRows)) {
    newRows.forEach((row, index) => {
      // Support either 'donor' or 'donor_id' depending on schema
      const donorValue = row.donor !== undefined ? row.donor : row.donor_id
      if (donorValue && donorValue !== row._lastDeductionDonorId) {
        console.log(`Donor changed in deduction row ${index}:`, donorValue)
        row._lastDeductionDonorId = donorValue
        handleDeductionDonorSelection(donorValue, row)
      }

      // Support either 'fund_class' or 'fund_class_id'
      const fundClassValue = row.fund_class !== undefined ? row.fund_class : row.fund_class_id
      if (fundClassValue && fundClassValue !== row._lastDeductionFundClass) {
        console.log(`Fund Class changed in deduction row ${index}:`, fundClassValue)
        row._lastDeductionFundClass = fundClassValue
        handleDeductionFundClassSelection(fundClassValue, row)
      }

      // Clear when fund class cleared
      if (!row.fund_class && !row.fund_class_id && row._lastDeductionFundClass) {
        console.log(`Fund Class cleared in deduction row ${index}`)
        row._lastDeductionFundClass = null
        clearDeductionFundClassFields(row)
      }
    })
  }
}, { deep: true })

// ADD: Watcher to clear deduction_breakeven when contribution_type changes to "Pledge"
watch(() => donation.doc.contribution_type, (newContributionType, oldContributionType) => {
  console.log('Contribution type changed from', oldContributionType, 'to:', newContributionType)
  
  if (newContributionType === 'Pledge') {
    // Clear deduction_breakeven table when contribution type is Pledge
    if (donation.doc.deduction_breakeven && donation.doc.deduction_breakeven.length > 0) {
      donation.doc.deduction_breakeven = []
      console.log('Cleared deduction_breakeven table due to contribution_type being Pledge')
    }
    
    // Clear the pending queue
    pendingDeductionFundClassQueue.value = []
    console.log('Cleared pending deduction fund class queue due to Pledge contribution type')
  }
})

</script>

<style scoped>
:deep(.form-control.prefix select) {
  padding-left: 2rem;
}
</style>
