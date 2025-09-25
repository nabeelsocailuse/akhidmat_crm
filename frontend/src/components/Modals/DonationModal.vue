<template>
  <!-- Parent Modal -->
  <Dialog v-model="controlledShow" :options="{ size: '6xl' }" :disableOutsideClickToClose="true" :disableEscToClose="hasActiveSubModals" :zIndex="hasActiveSubModals ? 1000 : 100" :backdrop="hasActiveSubModals ? 'static' : true" :persistent="true" data-modal="parent">
    <template #body>
      <AppStyling type="modal-styling" modalType="header">
        <div class="mb-5 flex items-center justify-between">
          <h3 class="text-2xl font-semibold text-ink-gray-9">
            {{  __('Create Donation') }}
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
              :key="fieldLayoutKey"
              :tabs="filteredTabs" 
              :data="reactiveFieldLayoutData" 
              :doctype="'Donation'"
              :triggerOnRowRemove="customTriggerOnRowRemove"
              @open-create-modal="openCreateModal"
              @tab-change="handleTabChange"
              @donor-selected="handleDonorSelected"
              @fund-class-selected="handleFundClassSelected"
              @add-deduction-row="handleAddDeductionRow"
            />
          </div>
          
          <ErrorMessage class="mt-4" v-if="error" :message="__(error)" />
        </div>
      </AppStyling>
      
      <AppStyling type="modal-styling" modalType="footer">
        <div class="flex flex-row-reverse gap-2">
          <AppStyling
            
            type="button"
            buttonType="submit"
            :buttonLabel="isReturnMode ? 'Submit Return/Credit Note' : 'Submit Donation'"
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
import { ref, watch, onMounted, onUnmounted, computed, readonly, reactive } from 'vue'
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

// Add computed property for options
const options = computed(() => props.options || {})

// Add computed property to check if we're in return mode
const isReturnMode = computed(() => {
  return options.value.isReturn || donation.doc.is_return
})

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
    donor_desk_id: '',
    donor_desk: '',
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
  
  // Ensure all payment detail rows are managed by DonationModal
  // ensurePaymentDetailRowsManaged() // REMOVED
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

// Add a flag to prevent watchers from interfering during initialization
let isInitializingWithDefaults = false

// Add a reactive key to force component updates
const forceUpdateKey = ref(0)
const fieldLayoutKey = ref(0)

// Add timeout guards to prevent rapid successive calls
let lastUpdateTime = 0
const UPDATE_THROTTLE_MS = 100

// REMOVED: All problematic helper functions that were causing infinite loops
// We now handle defaults application directly in the show watcher

// REMOVED: Old initialization function - now handled directly in show watcher

// Initialize donation with defaults-aware logic (doesn't override existing values)
const initializeDonationWithDefaultsLogic = () => {
  const now = new Date()
  
  // Only set posting_date and posting_time if not already set
  if (!donation.doc.posting_date) {
    donation.doc.posting_date = now.toISOString().slice(0, 10)
  }
  if (!donation.doc.posting_time) {
    donation.doc.posting_time = now.toTimeString().slice(0, 5)
  }
  
  // Only set due_date if not already set
  if (!donation.doc.due_date) {
    donation.doc.due_date = now.toISOString().slice(0, 10)
  }
  
  // Only set currency and exchange_rate if not already set
  if (!donation.doc.currency) {
    donation.doc.currency = 'PKR'
  }
  if (!donation.doc.exchange_rate) {
    donation.doc.exchange_rate = 1
  }
  
  // Initialize edit_posting_date_time to 0 (false) by default if not set
  if (donation.doc.edit_posting_date_time === undefined) {
    donation.doc.edit_posting_date_time = 0
  }
  
  // Ensure payment_detail is an array
  if (!donation.doc.payment_detail) {
    donation.doc.payment_detail = []
  }
  
  // CRITICAL: Do NOT override is_return, return_against, or status fields
  // These are set from the defaults and must be preserved
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
    fields: ['name', 'donor_name', 'donor_type', 'donor_desk_id', 'donor_desk', 'contact_no', 'email', 'city', 'address', 'cnic']
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
      donation.doc.contribution_type = 'Donation'
    return ['Donation']
  }
  else {
        // If donor_identity is 'Known', allow both options
        return ['Donation', 'Pledge'] 
       }
  
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
          
          // Configure fund_class fields in items table
          if (field.fieldname === 'fund_class') {
            enhancedField.get_query = () => ({
              doctype: 'Fund Class',
              filters: {
                status: 'Active'
              }
            })
            console.log('Configured fund_class field for items table')
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
            
            // if (field.fieldname === 'company' && !donation.doc.company) {
            //   donation.doc.company = 'Alkhidmat Foundation'
            // }
            
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
// Replace the existing onSuccess with this async version
onSuccess: async (data) => {
  // Ensure required fields are set
  if (!donation.doc.status) {
    donation.doc.status = 'Draft'
  }

  // Only fetch & set default company if it's not already populated
  if (!donation.doc.company) {
    try {
      // Try the lightweight get_value first
      const res = await call('frappe.client.get_value', {
        doctype: 'Global Defaults',
        fieldname: 'default_company',
        filters: {} // explicit empty filters for safety
      })

      // call() results can differ depending on how `call` wrapper is implemented;
      // check common shapes and take first non-empty candidate
      let companyName =
        (res && res.default_company) ||
        (res && res.message && (res.message.default_company || res.message.value)) ||
        null

      // Fallback: fetch full Global Defaults doc (reliable)
      if (!companyName) {
        const g = await call('frappe.client.get', {
          doctype: 'Global Defaults',
          name: 'Global Defaults'
        })
        companyName = (g && (g.default_company || g.message?.default_company)) || null
      }

      if (companyName) {
        donation.doc.company = companyName
        console.log('Set default company from Global Defaults:', companyName)
      } else {
        console.warn('Global Defaults.default_company not found; leaving company blank.')
      }
    } catch (err) {
      console.error('Error fetching Global Defaults default_company:', err)
      // don't crash — simply continue with other defaults
    }
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
  // initializeDonationDocument()
  
  // Configure field queries for child tables
  // configureFieldQueries()
  
  // Apply donor filtering after form is rendered
  nextTick(() => {
    applyDonorFilteringToForm()
  })
})

// Cleanup on unmount
onUnmounted(() => {
  // Reset any flags
  isInitializingWithDefaults = false
})

// Function to apply defaults to donation document
const applyDefaultsToDonation = () => {
  console.log('applyDefaultsToDonation called')
  console.log('props.defaults:', props.defaults)
  console.log('donation.doc before:', donation.doc)
  
  if (props.defaults && Object.keys(props.defaults).length > 0) {
    console.log('Applying defaults to donation document')
    console.log('Key fields to set:')
    console.log('- donation_type:', props.defaults.donation_type)
    console.log('- donor_identity:', props.defaults.donor_identity)
    console.log('- company:', props.defaults.company)
    console.log('- currency:', props.defaults.currency)
    console.log('- payment_detail length:', props.defaults.payment_detail?.length)
    
    // Force reactivity by creating a new object and assigning it
    const updatedDoc = { ...donation.doc }
    
    // Apply defaults to the updated document
    Object.keys(props.defaults).forEach(key => {
      if (props.defaults[key] !== undefined && props.defaults[key] !== null) {
        console.log(`Setting ${key}:`, props.defaults[key])
        updatedDoc[key] = props.defaults[key]
      }
    })
    
    // Assign the updated document to trigger reactivity
    donation.doc = updatedDoc
    
    console.log('Defaults applied successfully')
    console.log('donation.doc after:', donation.doc)
    console.log('Key fields after applying:')
    console.log('- donation_type:', donation.doc.donation_type)
    console.log('- donor_identity:', donation.doc.donor_identity)
    console.log('- company:', donation.doc.company)
    console.log('- currency:', donation.doc.currency)
    console.log('- payment_detail length:', donation.doc.payment_detail?.length)
  } else {
    console.log('No defaults to apply')
  }
}

// Simple watcher for modal opening - COMPLETELY REWRITTEN to prevent infinite loops
watch(show, async (val) => {
  if (val && user.value) {
    refreshTabs()
    
    // CRITICAL: Wait for props to be fully available
    await nextTick()
    
    // Apply donor filtering
    nextTick(() => {
      applyDonorFilteringToForm()
    })
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

// Watch for donation document changes to ensure form fields are updated
watch(() => donation.doc, (newDoc, oldDoc) => {
  if (newDoc && show.value) {
    console.log('Donation document changed, ensuring form fields are updated')
    console.log('New doc keys:', Object.keys(newDoc))
    console.log('Critical fields:')
    console.log('- donation_type:', newDoc.donation_type)
    console.log('- donor_identity:', newDoc.donor_identity)
    console.log('- company:', newDoc.company)
    console.log('- total_donation:', newDoc.total_donation)
    console.log('- net_amount:', newDoc.net_amount)
    
    // Force FieldLayout re-render
    fieldLayoutKey.value++
    
    // Force DOM update to ensure form fields reflect the data
    nextTick(() => {
      console.log('Form fields should now reflect the updated data')
    })
  }
}, { deep: true })

// Watch for fieldLayoutKey changes to ensure FieldLayout re-renders
watch(fieldLayoutKey, (newKey) => {
  if (show.value) {
    console.log('FieldLayout key changed, forcing re-render:', newKey)
  }
})

// CRITICAL: Watch for donation.doc changes to force FieldLayout updates
// ADDED GUARDS TO PREVENT INFINITE LOOPS
watch(() => donation.doc, (newDoc, oldDoc) => {
  // Prevent infinite loops by checking if we're already updating
  if (isInitializingWithDefaults) return
  
  if (show.value && newDoc) {
    console.log('🔄 donation.doc changed, forcing FieldLayout update')
    console.log('New doc total_donation:', newDoc.total_donation)
    console.log('New doc net_amount:', newDoc.net_amount)
    
    // Only update if the values actually changed to prevent loops
    if (JSON.stringify(newDoc) !== JSON.stringify(oldDoc)) {
      // Force FieldLayout to re-render by updating the key
      fieldLayoutKey.value++
      
      // Force another update after a short delay
      setTimeout(() => {
        fieldLayoutKey.value++
        console.log('🔄 Second FieldLayout update triggered')
      }, 50)
    }
  }
}, { deep: true })

// CRITICAL: Watch for props.defaults changes to handle late updates
// ADDED GUARDS TO PREVENT INFINITE LOOPS
watch(() => props.defaults, (newDefaults, oldDefaults) => {
  // Prevent infinite loops by checking if we're already updating
  if (isInitializingWithDefaults) return
  
  if (newDefaults && Object.keys(newDefaults).length > 0 && show.value) {
    // Only update if the defaults actually changed to prevent loops
    if (JSON.stringify(newDefaults) !== JSON.stringify(oldDefaults)) {
      console.log('Props defaults changed, applying to modal...')
      console.log('New defaults:', newDefaults)
      console.log('Old defaults:', oldDefaults)
      
      // Set flag to prevent other operations
      isInitializingWithDefaults = true
      
      try {
        // Apply ALL defaults at once to prevent partial updates
        const updatedDoc = { ...donation.doc }
        
        // Apply all defaults
        Object.keys(newDefaults).forEach(key => {
          if (newDefaults[key] !== undefined && newDefaults[key] !== null) {
            console.log(`Setting ${key} from defaults:`, newDefaults[key])
            updatedDoc[key] = newDefaults[key]
          }
        })
        
        // Force reactivity by replacing the entire document
        donation.doc = updatedDoc
        
        console.log('All defaults applied successfully:', donation.doc)
        console.log('Key fields after applying defaults:')
        console.log('- donation_type:', donation.doc.donation_type)
        console.log('- donor_identity:', donation.doc.donor_identity)
        console.log('- company:', donation.doc.company)
        console.log('- currency:', donation.doc.currency)
        console.log('- total_donation:', donation.doc.total_donation)
        console.log('- net_amount:', donation.doc.net_amount)
        console.log('- is_return:', donation.doc.is_return)
        console.log('- return_against:', donation.doc.return_against)
        console.log('- payment_detail length:', donation.doc.payment_detail?.length)
        console.log('- items length:', donation.doc.items?.length)
        
        // Force field layout update
        fieldLayoutKey.value++
        
      } finally {
        // Reset flag after a delay
        setTimeout(() => {
          isInitializingWithDefaults = false
        }, 100)
      }
    }
  }
}, { deep: true, immediate: false })

// ADD: Special watcher for return mode to ensure proper initialization
watch(() => [show.value, props.defaults], async ([showVal, defaults]) => {
  if (showVal && defaults && Object.keys(defaults).length > 0 && defaults.is_return) {
    console.log('🔄 Return mode detected, ensuring proper initialization...')
    console.log('Return defaults:', defaults)
    
    // Wait for the modal to be fully rendered
    await nextTick()
    
    // Force apply all return data
    if (defaults.payment_detail && defaults.payment_detail.length > 0) {
      console.log('🔄 Applying return payment details:', defaults.payment_detail.length)
      donation.doc.payment_detail = [...defaults.payment_detail]
    }
    
    if (defaults.items && defaults.items.length > 0) {
      console.log('🔄 Applying return items:', defaults.items.length)
      donation.doc.items = [...defaults.items]
    }
    
    if (defaults.deduction_breakeven && defaults.deduction_breakeven.length > 0) {
      console.log('🔄 Applying return deduction breakeven:', defaults.deduction_breakeven.length)
      donation.doc.deduction_breakeven = [...defaults.deduction_breakeven]
    }
    
    // Force field layout update
    fieldLayoutKey.value++
    
    console.log('🔄 Return mode initialization completed')
  }
}, { deep: true })

// Function to force field updates in the form
const forceFieldUpdates = () => {
  console.log('Forcing field updates in form...')
  
  // Force reactivity by creating new references
  const currentDoc = { ...donation.doc }
  
  // Explicitly set each critical field to force reactivity
  if (currentDoc.donation_type) {
    donation.doc.donation_type = currentDoc.donation_type
  }
  if (currentDoc.donor_identity) {
    donation.doc.donor_identity = currentDoc.donor_identity
  }
  if (currentDoc.company) {
    donation.doc.company = currentDoc.company
  }
  if (currentDoc.currency) {
    donation.doc.currency = currentDoc.currency
  }
  if (currentDoc.total_donation) {
    donation.doc.total_donation = currentDoc.total_donation
  }
  if (currentDoc.net_amount) {
    donation.doc.net_amount = currentDoc.net_amount
  }
  if (currentDoc.total_deduction) {
    donation.doc.total_deduction = currentDoc.total_deduction
  }
  
  // Force component update by incrementing the key
  forceUpdateKey.value++
  fieldLayoutKey.value++
  
  console.log('Field updates forced, current state:', donation.doc)
  console.log('Force update key:', forceUpdateKey.value)
  console.log('Field layout key:', fieldLayoutKey.value)
}

// Function to force FieldLayout to completely re-render
// ADDED THROTTLING TO PREVENT INFINITE LOOPS
const forceFieldLayoutUpdate = () => {
  const now = Date.now()
  
  // Throttle updates to prevent infinite loops
  if (now - lastUpdateTime < UPDATE_THROTTLE_MS) {
    console.log('⏱️ Throttling FieldLayout update to prevent infinite loops')
    return
  }
  
  lastUpdateTime = now
  console.log('Forcing FieldLayout to re-render...')
  
  // Increment the key to force complete re-render
  fieldLayoutKey.value++
  
  // Force multiple updates to ensure the component re-renders
  nextTick(() => {
    console.log('FieldLayout re-render triggered')
    
    // Force another update after a short delay
    setTimeout(() => {
      fieldLayoutKey.value++
      console.log('FieldLayout second re-render triggered')
    }, 50)
  })
}

// AGGRESSIVE: Function to force form field values directly
const forceFormFieldValues = () => {
  console.log('🚀 AGGRESSIVE: Forcing form field values directly...')
  
  // Wait for DOM to be ready
  nextTick(() => {
    // Try to find and update form fields directly
    const totalDonationField = document.querySelector('input[name="total_donation"], [data-fieldname="total_donation"]')
    const netAmountField = document.querySelector('input[name="net_amount"], [data-fieldname="net_amount"]')
    const totalDeductionField = document.querySelector('input[name="total_deduction"], [data-fieldname="total_deduction"]')
    
    if (totalDonationField && donation.doc.total_donation) {
      totalDonationField.value = donation.doc.total_donation
      totalDonationField.dispatchEvent(new Event('input', { bubbles: true }))
      console.log('🚀 Set total_donation field directly:', donation.doc.total_donation)
    }
    
    if (netAmountField && donation.doc.net_amount) {
      netAmountField.value = donation.doc.net_amount
      netAmountField.dispatchEvent(new Event('input', { bubbles: true }))
      console.log('🚀 Set net_amount field directly:', donation.doc.net_amount)
    }
    
    if (totalDeductionField && donation.doc.total_deduction) {
      totalDeductionField.value = donation.doc.total_deduction
      totalDeductionField.dispatchEvent(new Event('input', { bubbles: true }))
      console.log('🚀 Set total_deduction field directly:', donation.doc.total_deduction)
    }
    
    // Force another update after DOM manipulation
    setTimeout(() => {
      fieldLayoutKey.value++
      console.log('🚀 Final FieldLayout update after DOM manipulation')
    }, 100)
  })
}

// ULTRA AGGRESSIVE: Function to force all form fields to update with correct values
const forceAllFormFields = () => {
  console.log('🚀 ULTRA AGGRESSIVE: Forcing ALL form fields to update...')
  
  // Wait for DOM to be ready
  nextTick(() => {
    // Force update all critical fields
    if (donation.doc.total_donation) {
      // Try multiple selectors to find the field
      const totalDonationFields = document.querySelectorAll('input[name="total_donation"], [data-fieldname="total_donation"], input[placeholder*="Total Donation"]')
      totalDonationFields.forEach(field => {
        field.value = donation.doc.total_donation
        field.dispatchEvent(new Event('input', { bubbles: true }))
        field.dispatchEvent(new Event('change', { bubbles: true }))
        console.log('🚀 Set total_donation field:', donation.doc.total_donation)
      })
    }
    
    if (donation.doc.net_amount) {
      const netAmountFields = document.querySelectorAll('input[name="net_amount"], [data-fieldname="net_amount"], input[placeholder*="Net Amount"]')
      netAmountFields.forEach(field => {
        field.value = donation.doc.net_amount
        field.dispatchEvent(new Event('input', { bubbles: true }))
        field.dispatchEvent(new Event('change', { bubbles: true }))
        console.log('🚀 Set net_amount field:', donation.doc.net_amount)
      })
    }
    
    if (donation.doc.total_deduction) {
      const totalDeductionFields = document.querySelectorAll('input[name="total_deduction"], [data-fieldname="total_deduction"], input[placeholder*="Total Deduction"]')
      totalDeductionFields.forEach(field => {
        field.value = donation.doc.total_deduction
        field.dispatchEvent(new Event('input', { bubbles: true }))
        field.dispatchEvent(new Event('change', { bubbles: true }))
        console.log('🚀 Set total_deduction field:', donation.doc.total_deduction)
      })
    }
    
    // Force is_return checkbox to be checked
    if (donation.doc.is_return) {
      const isReturnCheckboxes = document.querySelectorAll('input[name="is_return"], [data-fieldname="is_return"], input[type="checkbox"][value*="return"]')
      isReturnCheckboxes.forEach(checkbox => {
        checkbox.checked = true
        checkbox.dispatchEvent(new Event('change', { bubbles: true }))
        console.log('🚀 Set is_return checkbox to checked')
      })
    }
    
    // Force another update after DOM manipulation
    setTimeout(() => {
      fieldLayoutKey.value++
      console.log('🚀 ULTRA AGGRESSIVE: Final update completed')
    }, 100)
  })
}

// FINAL SOLUTION: Direct DOM manipulation to force field updates
const forceAllFieldsDirectly = () => {
  console.log('🔥 FINAL SOLUTION: Direct DOM manipulation...')
  
  // Wait for DOM to be ready
  nextTick(() => {
    // Find ALL input fields and update them directly
    const allInputs = document.querySelectorAll('input, textarea, select')
    
    allInputs.forEach(input => {
      const fieldName = input.name || input.getAttribute('data-fieldname') || input.id
      
      // Update total_donation field
      if (fieldName === 'total_donation' && donation.doc.total_donation) {
        input.value = donation.doc.total_donation
        input.dispatchEvent(new Event('input', { bubbles: true }))
        input.dispatchEvent(new Event('change', { bubbles: true }))
        console.log('🔥 DIRECT: Set total_donation =', donation.doc.total_donation)
      }
      
      // Update net_amount field
      if (fieldName === 'net_amount' && donation.doc.net_amount) {
        input.value = donation.doc.net_amount
        input.dispatchEvent(new Event('input', { bubbles: true }))
        input.dispatchEvent(new Event('change', { bubbles: true }))
        console.log('🔥 DIRECT: Set net_amount =', donation.doc.net_amount)
      }
      
      // Update total_deduction field
      if (fieldName === 'total_deduction' && donation.doc.total_deduction) {
        input.value = donation.doc.total_deduction
        input.dispatchEvent(new Event('input', { bubbles: true }))
        input.dispatchEvent(new Event('change', { bubbles: true }))
        console.log('🔥 DIRECT: Set total_deduction =', donation.doc.total_deduction)
      }
      
      // Update donation_type field
      if (fieldName === 'donation_type' && donation.doc.donation_type) {
        input.value = donation.doc.donation_type
        input.dispatchEvent(new Event('input', { bubbles: true }))
        input.dispatchEvent(new Event('change', { bubbles: true }))
        console.log('🔥 DIRECT: Set donation_type =', donation.doc.donation_type)
      }
      
      // Update donor_identity field
      if (fieldName === 'donor_identity' && donation.doc.donor_identity) {
        input.value = donation.doc.donor_identity
        input.dispatchEvent(new Event('input', { bubbles: true }))
        input.dispatchEvent(new Event('change', { bubbles: true }))
        console.log('🔥 DIRECT: Set donor_identity =', donation.doc.donor_identity)
      }
      
      // Update company field
      if (fieldName === 'company' && donation.doc.company) {
        input.value = donation.doc.company
        input.dispatchEvent(new Event('input', { bubbles: true }))
        input.dispatchEvent(new Event('change', { bubbles: true }))
        console.log('🔥 DIRECT: Set company =', donation.doc.company)
      }
      
      // Update currency field
      if (fieldName === 'currency' && donation.doc.currency) {
        input.value = donation.doc.currency
        input.dispatchEvent(new Event('input', { bubbles: true }))
        input.dispatchEvent(new Event('change', { bubbles: true }))
        console.log('🔥 DIRECT: Set currency =', donation.doc.currency)
      }
      
      // Update is_return checkbox
      if (fieldName === 'is_return' && donation.doc.is_return) {
        input.checked = true
        input.dispatchEvent(new Event('change', { bubbles: true }))
        console.log('🔥 DIRECT: Set is_return checkbox = checked')
      }
    })
    
    // Force multiple updates
    setTimeout(() => {
      fieldLayoutKey.value++
      console.log('🔥 FINAL SOLUTION: First update completed')
      
      // Second update
      setTimeout(() => {
        fieldLayoutKey.value++
        console.log('🔥 FINAL SOLUTION: Second update completed')
        
        // Third update
        setTimeout(() => {
          fieldLayoutKey.value++
          console.log('🔥 FINAL SOLUTION: Final update completed')
        }, 100)
      }, 100)
    }, 100)
  })
}

// Computed property to force reactivity on donation document
const reactiveDonationDoc = computed(() => {
  // This will trigger whenever donation.doc changes
  return { ...donation.doc, _key: forceUpdateKey.value }
})

// FINAL WATCHER: Force field updates when reactiveFieldLayoutData changes
watch(() => reactiveFieldLayoutData.value, (newData) => {
  if (show.value && newData) {
    console.log('🔥 FINAL WATCHER: reactiveFieldLayoutData changed, forcing field updates')
    console.log('New data:', newData)
    
    // Force immediate field updates
    nextTick(() => {
      forceAllFieldsDirectly()
    })
  }
}, { deep: true, immediate: false })

// ULTIMATE SOLUTION: Force FieldLayout to re-render with correct data
const forceFieldLayoutDataUpdate = () => {
  console.log('🚀 ULTIMATE: Forcing FieldLayout data update...')
  
  // Force multiple updates to ensure FieldLayout gets the data
  fieldLayoutKey.value++
  forceUpdateKey.value++
  
  // Wait for DOM to update
  nextTick(() => {
    // Force another update
    fieldLayoutKey.value++
    
    // Force direct field updates
    forceAllFieldsDirectly()
    
    console.log('🚀 ULTIMATE: FieldLayout data update completed')
  })
}

// FINAL SOLUTION: Force FieldLayout data to be completely reactive
const reactiveFieldLayoutData = computed(() => {
  console.log('🔥 FINAL: reactiveFieldLayoutData computed triggered')
  console.log('🔥 FINAL: donation.doc keys:', Object.keys(donation.doc))
  console.log('🔥 FINAL: props.defaults keys:', props.defaults ? Object.keys(props.defaults) : 'No defaults')
  
  // Create a completely new reactive object
  const newData = reactive({})
  
  // Copy ALL data from donation.doc
  Object.assign(newData, donation.doc)
  
  // CRITICAL: Force all critical fields from props.defaults
  if (props.defaults) {
    console.log('🔥 FINAL: Applying props.defaults to newData')
    
    // Force all critical fields
    newData.donation_type = props.defaults.donation_type || donation.doc.donation_type
    newData.donor_identity = props.defaults.donor_identity || donation.doc.donor_identity
    // Ensure contribution_type is preserved when opening Return/Credit modal
    newData.contribution_type = props.defaults.contribution_type || donation.doc.contribution_type
    newData.company = props.defaults.company || donation.doc.company
    newData.currency = props.defaults.currency || donation.doc.currency
    newData.total_donation = props.defaults.total_donation || donation.doc.total_donation
    newData.net_amount = props.defaults.net_amount || donation.doc.net_amount
    newData.total_deduction = props.defaults.total_deduction || donation.doc.total_deduction
    newData.is_return = props.defaults.is_return || donation.doc.is_return
    newData.return_against = props.defaults.return_against || donation.doc.return_against
    // Ensure donation_cost_center (Branch) is preserved when opening Return/Credit modal
    newData.donation_cost_center = props.defaults.donation_cost_center || donation.doc.donation_cost_center
    
    console.log('🔥 FINAL: Applied defaults - total_donation:', newData.total_donation)
    console.log('🔥 FINAL: Applied defaults - net_amount:', newData.net_amount)
    console.log('🔥 FINAL: Applied defaults - is_return:', newData.is_return)
  }
  
  // Add reactive keys
  newData._layoutKey = fieldLayoutKey.value
  newData._forceUpdateKey = forceUpdateKey.value
  newData._timestamp = Date.now()
  
  console.log(' FINAL: Final newData keys:', Object.keys(newData))
  console.log(' FINAL: Final newData values:', {
    total_donation: newData.total_donation,
    net_amount: newData.net_amount,
    is_return: newData.is_return
  })
  
  return newData
})

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
      row.donor_desk_id = ''
      row.donor_desk = ''
      row.contact_no = ''
      row.email = ''
      row.city = ''
      row.address = ''
      row.cnic = ''
      row.co_name = ''
      row.co_contact_no = ''
      row.co_email = ''
      row.co_address = ''
      row.relationship_with_donor = ''
      row.area = ''
      row.co_city = ''
      row.co_country = ''
      row.co_designation = ''
      
      row._lastDonorId = null
    })
    
    donation.doc.payment_detail = [...donation.doc.payment_detail]
  }
  
  if (donation.doc.items && Array.isArray(donation.doc.items)) {
    donation.doc.items.forEach((row, index) => {
      // Clear donor-related fields
      row.donor = ''
      row.donor_name = ''
      row.donor_type = ''
      row.donor_desk = ''
      
      // Clear fund class-related fields
      row.fund_class = ''
      row.service_area = ''
      row.subservice_area = ''
      row.product = ''
      
      // Clear the last ID trackers
      row._lastItemsDonorId = null
      row._lastItemsFundClassId = null
    })
    
    donation.doc.items = [...donation.doc.items]
  }
  
  nextTick(() => {
    console.log('Tabs re-rendered for new donor identity:', newDonorIdentity)
  })
  
  console.log('Donor queries updated for new donor identity:', newDonorIdentity)
})

function handleModalSuccess(idx, doc) {
  const modal = modalStack.value[idx]
  if (modal && modal.onSuccess) modal.onSuccess(doc)
  modalStack.value.splice(idx, 1)
  
  if (!hasActiveSubModals.value) {
  }
}

function handleModalClose(idx) {
  modalStack.value.splice(idx, 1)
  
  if (!hasActiveSubModals.value) {
  }
}

function extractDonationErrorMessage(err) {
  let errorMessage = 'An error occurred while creating the donation.'
  
  if (err?.exc_type === 'MandatoryError') {
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
    errorMessage = parseCustomErrorMessage(err.message)
  } else if (err?.exc) {
    errorMessage = parseExceptionMessage(err.exc)
  }
  
  return errorMessage
}

function parseMandatoryError(err) {
  const missingFields = []
  
  if (err.messages && Array.isArray(err.messages)) {
    err.messages.forEach(msg => {
      const patterns = [
        /\[([^,]+),\s*([^\]]+)\]:\s*([^,\s]+)/,
        /MandatoryError.*?:\s*([^,\n]+)/, 
        /Field\s+([^,\s]+)\s+is\s+mandatory/, 
        /([^,\s]+)\s+is\s+required/, 
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
    'donation_cost_center': ' Branch (Cost Center) ',
    
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
      
      // REMOVE: Don't show success message to prevent infinite loop
      // toast.success('Donor details loaded successfully')
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
      
    } else {
      console.log('No Fund Class details received')
      toast.error('Could not fetch Fund Class details')
    }
  } catch (error) {
    console.error('Error in direct Fund Class handling:', error)
    toast.error('Error loading Fund Class details')
  }
}

// NEW: Mode of Payment to Account handling functionality
async function fetchPaymentModeAccount(modeOfPayment, company) {
  console.log('Fetching payment mode account for:', { modeOfPayment, company })
  
  try { 
    const result = await call('crm.fcrm.doctype.donation.api.get_payment_mode_account', {
      mode_of_payment: modeOfPayment,
      company: company
    })
    
    console.log('Payment mode account result:', result)
    return result
  } catch (error) {
    console.error('Error fetching payment mode account:', error)
    toast.error('Error loading payment mode account')
    return null
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
    'donor_desk_id': 'donor_desk_id',
    'donor_desk': 'donor_desk',
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
    'donor_name', 'donor_type', 'donor_desk_id', 'contact_no', 'email', 'city', 'address', 'cnic',
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

// CORRECTED DonationModal.vue - Exact Backend Trigger Logic

// Flags to prevent infinite loops
let isProcessingPaymentDetail = false
let isProcessingDeductionBreakeven = false
let isUpdatingFromAPI = false

// Debouncing timeouts
let paymentDetailTimeout = null
let deductionBreakevenTimeout = null

// EXACT BACKEND TRIGGER LOGIC - Payment Detail Changes
watch(() => donation.doc.payment_detail, async (newPaymentDetail, oldPaymentDetail) => {
  if (isProcessingPaymentDetail || isInitializingWithDefaults) return
  
  if (newPaymentDetail && Array.isArray(newPaymentDetail)) {
    isProcessingPaymentDetail = true
    
    try {
      let shouldTriggerSetDeductionBreakeven = false
      let shouldDoReactiveUpdate = false
      
      // Process each payment detail row for changes that trigger backend calls
      for (let index = 0; index < newPaymentDetail.length; index++) {
        const row = newPaymentDetail[index]
        // Ensure random_id is present (EXACT backend logic)
        if (row && !row.random_id) {
          row.random_id = generateRandomId(index + 1)
        }
        
        // EXACT backend trigger: donor_id change
        if (row.donor_id && row.donor_id !== row._lastDonorId) {
          console.log(`Donor ID changed in row ${index}:`, row.donor_id)
          row._lastDonorId = row.donor_id
          row.donor = row.donor_id
          handleDonorSelectionDirect(row.donor_id, row)
          shouldDoReactiveUpdate = true
        }
        
        // EXACT backend trigger: fund_class_id change
        if (row.fund_class_id && row.fund_class_id !== row._lastFundClassId) {
          console.log(`Fund Class ID changed in row ${index}:`, row.fund_class_id)
          row._lastFundClassId = row.fund_class_id
          row.fund_class = row.fund_class_id
          
          // FIX: For Pledge contribution type, populate fund class fields without deduction breakeven
          if (donation.doc.contribution_type === 'Pledge') {
            await populateFundClassFieldsForPledge(row)
          } else {
            shouldTriggerSetDeductionBreakeven = true
          }
          
          shouldDoReactiveUpdate = true
        }
        
        // EXACT backend trigger: donation_amount change
        if (row.donation_amount !== row._lastDonationAmount) {
          console.log(`Donation amount changed in row ${index}:`, row.donation_amount)
          row._lastDonationAmount = row.donation_amount
          shouldTriggerSetDeductionBreakeven = true
          shouldDoReactiveUpdate = true
        }
        
        // EXACT backend trigger: intention_id change
        if (row.intention_id !== row._lastIntentionId) {
          console.log(`Intention ID changed in row ${index}:`, row.intention_id)
          row._lastIntentionId = row.intention_id
          shouldTriggerSetDeductionBreakeven = true
          shouldDoReactiveUpdate = true
        }
        
        // EXACT backend trigger: mode of payment - handle account_paid_to auto-fill (exact copy from DonationDetail)
        if (row.mode_of_payment && row.mode_of_payment !== row._lastMOPId) {
          console.log('🔥 MODE OF PAYMENT CHANGED IN DONATION MODAL 🔥', row.mode_of_payment)
          row._lastMOPId = row.mode_of_payment
          
          try {
            const company = donation.doc?.company || 'Alkhidmat Foundation'
            console.log('Company:', company)
            
            const result = await call('crm.fcrm.doctype.donation.api.get_payment_mode_account', {
              mode_of_payment: row.mode_of_payment,
              company: company
            })
            
            console.log('🔥 API RESULT IN DONATION MODAL 🔥', result)
            
            if (result && result.success && result.account) {
              console.log('✅ Account fetched successfully:', result.account)
              row.account_paid_to = result.account
              toast.success(`Account Paid To auto-filled: ${result.account}`)
            } else {
              console.log('❌ No account found')
              row.account_paid_to = ''
              
              if (result && result.message) {
                toast.warning(result.message)
              } else {
                toast.warning('No default account found for this mode of payment')
              }
            }
          } catch (error) {
            console.error('❌ Error fetching payment mode account:', error)
            row.account_paid_to = ''
            toast.error(`Error loading account for mode of payment: ${error.message}`)
          }
        }
      }
      
      // EXACT backend behavior: Call set_deduction_breakeven only when specific fields change
      if (shouldTriggerSetDeductionBreakeven) {
        console.log('Triggering set_deduction_breakeven due to payment detail changes...')
        await setDeductionBreakevenFromAPI()
      }
      
      // Only do reactive update if it's NOT a mode_of_payment change
      if (shouldDoReactiveUpdate) {
        // Force reactive update
        donation.doc.payment_detail = [...donation.doc.payment_detail]
      }
    } finally {
      isProcessingPaymentDetail = false
    }
  }
}, { deep: true })

// Add a second watcher for payment_detail (like DonationDetail has)
let pdProcessing2 = false
watch(() => donation.doc?.payment_detail, async (rows) => {
  if (pdProcessing2 || !Array.isArray(rows) || isInitializingWithDefaults) return
  pdProcessing2 = true
  try {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      if (!row) continue
      
      // mode of payment - handle account_paid_to auto-fill (second watcher like DonationDetail)
      if (row.mode_of_payment && row.mode_of_payment !== row._lastMOPId2) {
        console.log('🔥 MODE OF PAYMENT CHANGED IN DONATION MODAL (SECOND WATCHER) 🔥', row.mode_of_payment)
        row._lastMOPId2 = row.mode_of_payment
        
        try {
          const company = donation.doc?.company || 'Alkhidmat Foundation'
          console.log('Company:', company)
          
          const result = await call('crm.fcrm.doctype.donation.api.get_payment_mode_account', {
            mode_of_payment: row.mode_of_payment,
            company: company
          })
          
          console.log('🔥 API RESULT IN DONATION MODAL (SECOND WATCHER) 🔥', result)
          
          if (result && result.success && result.account) {
            console.log('✅ Account fetched successfully (second watcher):', result.account)
            row.account_paid_to = result.account
            toast.success(`Account Paid To auto-filled: ${result.account}`)
          } else {
            console.log('❌ No account found (second watcher)')
            row.account_paid_to = ''
            
            if (result && result.message) {
              toast.warning(result.message)
            } else {
              toast.warning('No default account found for this mode of payment')
            }
          }
        } catch (error) {
          console.error('❌ Error fetching payment mode account (second watcher):', error)
          row.account_paid_to = ''
          toast.error(`Error loading account for mode of payment: ${error.message}`)
        }
      }
    }
  } finally {
    pdProcessing2 = false
  }
}, { deep: true })

// EXACT BACKEND TRIGGER LOGIC - Items Changes (Donor Selection)
let isProcessingItems = false
watch(() => donation.doc.items, async (newItems, oldItems) => {
  if (isProcessingItems || isInitializingWithDefaults) return
  
  if (newItems && Array.isArray(newItems)) {
    isProcessingItems = true
    
    try {
      let shouldDoReactiveUpdate = false
      
      // Process each items row for changes that trigger donor and fund class fetch
      for (let index = 0; index < newItems.length; index++) {
        const row = newItems[index]
        
        // EXACT backend trigger: donor change
        if (row.donor && row.donor !== row._lastItemsDonorId) {
          console.log(`Donor changed in items row ${index}:`, row.donor)
          row._lastItemsDonorId = row.donor
          await handleItemsDonorSelection(row.donor, row)
          shouldDoReactiveUpdate = true
        }
        
        // EXACT backend trigger: fund_class change
        if (row.fund_class && row.fund_class !== row._lastItemsFundClassId) {
          console.log(`Fund Class changed in items row ${index}:`, row.fund_class)
          row._lastItemsFundClassId = row.fund_class
          await handleItemsFundClassSelection(row.fund_class, row)
          shouldDoReactiveUpdate = true
        }
      }
      
      // Force reactive update if needed
      if (shouldDoReactiveUpdate) {
        console.log('Forcing reactive update of items table')
        donation.doc.items = [...donation.doc.items]
      }
      
    } catch (error) {
      console.error('Error processing items changes:', error)
      toast.error('Error processing items changes')
    } finally {
      isProcessingItems = false
    }
  }
}, { deep: true })

// EXACT BACKEND TRIGGER LOGIC - Deduction Breakeven Changes
watch(() => donation.doc.deduction_breakeven, async (newDeductionBreakeven, oldDeductionBreakeven) => {
  // Skip if we're processing or updating from API
  if (isProcessingDeductionBreakeven || isUpdatingFromAPI || isInitializingWithDefaults) return
  
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
        donation.doc.deduction_breakeven = [...donation.doc.deduction_breakeven]
        
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

// FIXED: Set deduction breakeven when payment details change (like DonationDetail)
async function setDeductionBreakevenFromAPI() {
  console.log('Setting deduction breakeven using backend API (exact backend behavior)...')
  
  if (!donation.doc.payment_detail || donation.doc.payment_detail.length === 0) {
    console.log('No payment details to process')
    return
  }
  
  if (donation.doc.contribution_type === "Pledge") {
    console.log("Skipping deduction breakeven for Pledge contribution type")
    return
  }
  
  try {
    // Mark that we're updating from API to prevent watcher loops
    isUpdatingFromAPI = true
    
    // Use the exact backend set_deduction_breakeven API
    const result = await call('crm.fcrm.doctype.donation.api.set_deduction_breakeven', {
      payment_details: donation.doc.payment_detail,
      company: donation.doc.company || 'Alkhidmat Foundation',
      contribution_type: donation.doc.contribution_type || 'Donation',
      donation_cost_center: donation.doc.donation_cost_center,
      currency: donation.doc.currency,
      to_currency: donation.doc.to_currency || donation.doc.currency,
      posting_date: donation.doc.posting_date,
      is_return: donation.doc.is_return || false
    })
    
    if (result.success) {
      console.log('Backend API set deduction breakeven successfully:', result)
      
      // PRESERVE account_paid_to field before backend API replaces the array
      const preservedAccountPaidTo = {}
      if (donation.doc.payment_detail && Array.isArray(donation.doc.payment_detail)) {
        donation.doc.payment_detail.forEach((row, index) => {
          if (row && row.account_paid_to) {
            preservedAccountPaidTo[index] = row.account_paid_to
            console.log(`Preserving account_paid_to for row ${index}: ${row.account_paid_to}`)
          }
        })
      }
      
      // ENHANCED: Preserve ALL user-modified deduction values with better detection
      const preservedDeductionValues = {}
      if (donation.doc.deduction_breakeven && Array.isArray(donation.doc.deduction_breakeven)) {
        donation.doc.deduction_breakeven.forEach((row, index) => {
          if (row) {
            // Store all current values - we'll restore them if they were user-modified
            preservedDeductionValues[index] = {
              percentage: row.percentage,
              min_percent: row.min_percent,
              max_percent: row.max_percent,
              amount: row.amount,
              base_amount: row.base_amount,
              // Store tracking variables to detect user modifications
              _lastPercentage: row._lastPercentage,
              _lastMinPercent: row._lastMinPercent,
              _lastMaxPercent: row._lastMaxPercent,
              _lastDonationAmount: row._lastDonationAmount,
              // ENHANCED: Store original backend values and user modification flags
              _originalPercentage: row._originalPercentage,
              _originalMinPercent: row._originalMinPercent,
              _originalMaxPercent: row._originalMaxPercent,
              _originalAmount: row._originalAmount,
              _originalBaseAmount: row._originalBaseAmount,
              // ADD: Store user modification flags
              _userModifiedPercentage: row._userModifiedPercentage,
              _userModifiedMinPercent: row._userModifiedMinPercent,
              _userModifiedMaxPercent: row._userModifiedMaxPercent,
              _userModifiedAmount: row._userModifiedAmount,
              _userModifiedBaseAmount: row._userModifiedBaseAmount
            }
            console.log(`Preserving deduction values for row ${index}:`, preservedDeductionValues[index])
          }
        })
      }
      
      // Update the document with the results (rebuilds entire table like backend)
      donation.doc.deduction_breakeven = result.deduction_breakeven
      donation.doc.payment_detail = result.updated_payment_details
      
      // RESTORE account_paid_to field after backend API replaces the array
      if (donation.doc.payment_detail && Array.isArray(donation.doc.payment_detail)) {
        donation.doc.payment_detail.forEach((row, index) => {
          if (row && preservedAccountPaidTo[index]) {
            row.account_paid_to = preservedAccountPaidTo[index]
            console.log(`Restored account_paid_to for row ${index}: ${row.account_paid_to}`)
          }
        })
      }
      
      // ENHANCED: Restore user-modified values with improved detection logic
      if (donation.doc.deduction_breakeven && Array.isArray(donation.doc.deduction_breakeven)) {
        donation.doc.deduction_breakeven.forEach((row, index) => {
          if (row && preservedDeductionValues[index]) {
            const preserved = preservedDeductionValues[index]
            
            // ENHANCED: Restore percentage if it was user-modified
            const wasPercentageModified = preserved._userModifiedPercentage || 
                                        preserved._lastPercentage !== undefined || 
                                        (preserved._originalPercentage !== undefined && 
                                         preserved.percentage !== preserved._originalPercentage)
            
            if (wasPercentageModified) {
              row.percentage = preserved.percentage
              row._lastPercentage = preserved._lastPercentage
              row._userModifiedPercentage = preserved._userModifiedPercentage
              console.log(`Restored user-modified percentage for row ${index}: ${row.percentage}`)
            }
            
            // ENHANCED: Restore min_percent if it was user-modified
            const wasMinPercentModified = preserved._userModifiedMinPercent || 
                                        preserved._lastMinPercent !== undefined || 
                                        (preserved._originalMinPercent !== undefined && 
                                         preserved.min_percent !== preserved._originalMinPercent)
            
            if (wasMinPercentModified) {
              row.min_percent = preserved.min_percent
              row._lastMinPercent = preserved._lastMinPercent
              row._userModifiedMinPercent = preserved._userModifiedMinPercent
              console.log(`Restored user-modified min_percent for row ${index}: ${row.min_percent}`)
            }
            
            // ENHANCED: Restore max_percent if it was user-modified
            const wasMaxPercentModified = preserved._userModifiedMaxPercent || 
                                        preserved._lastMaxPercent !== undefined || 
                                        (preserved._originalMaxPercent !== undefined && 
                                         preserved.max_percent !== preserved._originalMaxPercent)
            
            if (wasMaxPercentModified) {
              row.max_percent = preserved.max_percent
              row._lastMaxPercent = preserved._lastMaxPercent
              row._userModifiedMaxPercent = preserved._userModifiedMaxPercent
              console.log(`Restored user-modified max_percent for row ${index}: ${row.max_percent}`)
            }
            
            // ENHANCED: Restore donation_amount if it was user-modified
            if (preserved._lastDonationAmount !== undefined) {
              row.donation_amount = preserved.donation_amount
              row._lastDonationAmount = preserved._lastDonationAmount
              console.log(`Restored donation_amount for row ${index}: ${row.donation_amount}`)
            }
            
            // ENHANCED: Restore calculated amount if it was user-modified
            const wasAmountModified = preserved._userModifiedAmount || 
                                    preserved._userModifiedBaseAmount ||
                                    (preserved._originalAmount !== undefined && 
                                     (preserved.amount !== preserved._originalAmount || 
                                      preserved.base_amount !== preserved._originalBaseAmount))
            
            if (wasAmountModified) {
              row.amount = preserved.amount
              row.base_amount = preserved.base_amount
              row._userModifiedAmount = preserved._userModifiedAmount
              row._userModifiedBaseAmount = preserved._userModifiedBaseAmount
              console.log(`Restored user-modified amount for row ${index}: ${row.amount}`)
            }
          }
        })
      }
      
      // FIXED: Use nextTick and delayed flag reset to prevent immediate re-triggering
      await nextTick()
      donation.doc = { ...donation.doc }
      
      console.log('Deduction breakeven table rebuilt successfully via backend API')
    } else {
      console.error('Backend API failed to set deduction breakeven:', result.message)
      // toast.error(result.message || 'Failed to set deduction breakeven')
    }
  } catch (error) {
    console.error('Error calling backend set deduction breakeven API:', error)
    // toast.error('Error setting deduction breakeven')
  } finally {
    // Reset the flag after a delay to allow the update to complete
    setTimeout(() => {
      isUpdatingFromAPI = false
    }, 200)
  }
}

// FIX: Correct contribution_type watcher (same as backend)
watch(() => donation.doc.contribution_type, async (newContributionType, oldContributionType) => {
  console.log('Contribution type changed from', oldContributionType, 'to:', newContributionType)
  
  if (newContributionType === 'Pledge') {
    // Clear deduction_breakeven table when contribution type is Pledge (same as backend)
    if (donation.doc.deduction_breakeven && donation.doc.deduction_breakeven.length > 0) {
      donation.doc.deduction_breakeven = []
      console.log('Cleared deduction_breakeven table due to contribution_type being Pledge')
    }
  } else if (newContributionType === 'Donation' && oldContributionType === 'Pledge') {
    // Populate deduction breakeven when switching from Pledge to Donation (same as backend)
    console.log('Switched from Pledge to Donation, populating deduction breakeven...')
    await setDeductionBreakevenFromAPI()
  }
})

// FIX: Correct donation_type watcher (same as backend)
watch(() => donation.doc.donation_type, (newType, oldType) => {
  console.log('Donation type changed from', oldType, 'to:', newType)
  
  if (newType === 'In Kind Donation') {
    // Clear deduction_breakeven table when donation type is In Kind Donation (same as backend)
    if (donation.doc.deduction_breakeven && donation.doc.deduction_breakeven.length > 0) {
      donation.doc.deduction_breakeven = []
      console.log('Cleared deduction_breakeven table due to donation_type being In Kind Donation')
    }
  } else if (newType === 'Cash' && oldType === 'In Kind Donation') {
    // Populate deduction breakeven when switching from In Kind to Cash (same as backend)
    console.log('Switched from In Kind to Cash, populating deduction breakeven...')
    setDeductionBreakevenFromAPI()
  }
})

// FIX: Enhanced createNewDonation function with correct submission logic
async function createNewDonation() {
  console.log("Creating new donation...")
  
  try {
    // First validate the form
    const validationErrors = validateDonationForm()
    if (validationErrors.length > 0) {
      const errorMessage = `Please fill in the following required fields:\n\n${validationErrors.map(error => `• ${error}`).join("\n")}`
      error.value = errorMessage
      
      // Show error toast
      toast.error(`Please fix ${validationErrors.length} validation error(s)`)
      
      // Scroll to top to show errors
      nextTick(() => {
        const modalBody = document.querySelector("[data-modal=\"parent\"] .modal-body")
        if (modalBody) {
          modalBody.scrollTop = 0
        }
      })
      
      return
    }
    
    // NEW: Validate deduction percentages using API (same as backend)
    if (donation.doc.deduction_breakeven && donation.doc.deduction_breakeven.length > 0) {
      const percentageValidation = await validateDeductionBreakevenBeforeSubmission()
      if (!percentageValidation.success) {
        error.value = percentageValidation.message || 'Deduction percentage validation failed'
        toast.error("Deduction percentage validation failed")
        return
      }
    }
    
    // CRITICAL: Preserve user-modified deduction breakeven values BEFORE any backend API calls
    const preservedUserModifications = preserveUserModificationsBeforeSubmission()
    
    // Prepare the donation document (now async)
    const preparedDoc = await prepareDonationForSubmission()
    
    // CRITICAL: Restore user modifications after preparation
    restoreUserModificationsAfterPreparation(preparedDoc, preservedUserModifications)
    
    // CRITICAL: Final validation of account fields before submission
    let hasMissingAccounts = false
    if (preparedDoc.payment_detail && Array.isArray(preparedDoc.payment_detail)) {
      preparedDoc.payment_detail.forEach((row, index) => {
        if (!row.equity_account || !row.receivable_account) {
          console.error(`Missing account fields in row ${index}:`, row)
          hasMissingAccounts = true
        }
      })
    }
    
    if (hasMissingAccounts) {
      toast.error('Please fill in all account fields before submitting')
      return
    }
    
    // Set loading state
    isDonationCreating.value = true
    error.value = null
    
    try {
      // FIX: Use direct call method like other modals
      const result = await call('frappe.client.insert', {
        doc: {
          doctype: 'Donation',
          ...preparedDoc,
        },
      })
      
      if (result && result.name) {
        console.log('Donation created successfully:', result)
        toast.success('Donation created successfully!')
        
        // Close the modal
        handleCloseButton()
        
        // Emit success event if needed
        emit('donation-created', result)
        
        // Redirect to the donation detail page
        const refreshTimestamp = Date.now()
        router.push({ 
          name: 'DonationDetail', 
          params: { donationId: result.name }, 
          query: { refresh: refreshTimestamp } 
        })
      } else {
        throw new Error('Donation creation failed - no name returned')
      }
    } catch (err) {
      console.error('Error creating donation:', err)
      error.value = err.message || 'Failed to create donation'
      toast.error('Failed to create donation')
    } finally {
      isDonationCreating.value = false
    }
  } catch (err) {
    console.error('Unexpected error in createNewDonation:', err)
    error.value = 'An unexpected error occurred'
    toast.error('An unexpected error occurred')
    isDonationCreating.value = false
  }
}

// ADD: Function to preserve user modifications before submission
function preserveUserModificationsBeforeSubmission() {
  const userModifications = {}
  
  if (donation.doc.deduction_breakeven && Array.isArray(donation.doc.deduction_breakeven)) {
    donation.doc.deduction_breakeven.forEach((row, index) => {
      if (row) {
        userModifications[index] = {
          percentage: row.percentage,
          min_percent: row.min_percent,
          max_percent: row.max_percent,
          amount: row.amount,
          base_amount: row.base_amount,
          // Mark these as user modifications
          _isUserModified: true
        }
        console.log(`Preserved user modification for row ${index}:`, userModifications[index])
      }
    })
  }
  
  return userModifications
}

// ADD: Function to restore user modifications after preparation
function restoreUserModificationsAfterPreparation(preparedDoc, userModifications) {
  if (preparedDoc.deduction_breakeven && Array.isArray(preparedDoc.deduction_breakeven)) {
    preparedDoc.deduction_breakeven.forEach((row, index) => {
      if (row && userModifications[index] && userModifications[index]._isUserModified) {
        const userMod = userModifications[index]
        
        // Restore user-modified values
        row.percentage = userMod.percentage
        row.min_percent = userMod.min_percent
        row.max_percent = userMod.max_percent
        row.amount = userMod.amount
        row.base_amount = userMod.base_amount
        
        console.log(`Restored user modification for row ${index}:`, {
          percentage: row.percentage,
          min_percent: row.min_percent,
          max_percent: row.max_percent,
          amount: row.amount,
          base_amount: row.base_amount
        })
      }
    })
  }
}

// COMPREHENSIVE VALIDATION: Function to validate all mandatory fields
function validateDonationForm() {
  const errors = []
  
  // Main donation mandatory fields (from JSON schema)
  const mainRequiredFields = [
    { field: 'company', label: 'Company' },
    { field: 'donation_type', label: 'Donation Type' },
    { field: 'due_date', label: 'Due Date' }
  ]

  // Check main donation fields
  mainRequiredFields.forEach(({ field, label }) => {
    if (!donation.doc[field] || (typeof donation.doc[field] === 'string' && donation.doc[field].trim() === '')) {
      errors.push(`${label} is required`)
    }
  })

  // Additional business logic required fields
  if (!donation.doc.donor_identity || donation.doc.donor_identity.trim() === '') {
    errors.push('Donor Identity is required')
  }
  
  if (!donation.doc.contribution_type || donation.doc.contribution_type.trim() === '') {
    errors.push('Contribution Type is required')
  }
  
  if (!donation.doc.posting_date) {
    errors.push('Posting Date is required')
  }
  
  if (!donation.doc.currency || donation.doc.currency.trim() === '') {
    errors.push('Currency is required')
  }
  
  if (!donation.doc.donation_cost_center || donation.doc.donation_cost_center.trim() === '') {
    errors.push('Donation Cost Center is required')
  }

  // Payment detail validation
  if ( !donation.doc.payment_detail || !Array.isArray(donation.doc.payment_detail) || donation.doc.payment_detail.length === 0) {
    errors.push('At least one payment detail is required')
  } else {
    donation.doc.payment_detail.forEach((row, index) => {
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
  if (donation.doc.deduction_breakeven && Array.isArray(donation.doc.deduction_breakeven)) {
    donation.doc.deduction_breakeven.forEach((row, index) => {
      const rowNum = index + 1
      
      if (!row.fund_class_id || row.fund_class_id.trim() === '') {
        errors.push(`Fund Class for deduction breakeven row ${rowNum} is required`)
      }
      
      if (!row.percentage || row.percentage <= 0) {
        errors.push(`Percentage for deduction breakeven row ${rowNum} is required and must be greater than 0`)
      }
    })
  }

  return errors
}

// ENHANCED: Function to validate and show user-friendly error messages
function validateAndShowErrors() {
  const errors = validateDonationForm()
  
  if (errors.length > 0) {
    // Show the first error as a toast
    toast.error(errors[0])
    
    // Log all errors for debugging
    console.error('Validation errors:', errors)
    
    // Set error message for display
    error.value = errors[0]
    
    return false
  }
  
  return true
}

// ENHANCED: Function to validate deduction percentages before submission with min/max validation
async function validateDeductionBreakevenBeforeSubmission() {
  const errors = []
  
  if (donation.doc.deduction_breakeven && Array.isArray(donation.doc.deduction_breakeven)) {
    for (let index = 0; index < donation.doc.deduction_breakeven.length; index++) {
      const row = donation.doc.deduction_breakeven[index]
      const rowNum = index + 1
      
      // Basic validation
      if (!row.percentage) {
        errors.push(`Percentage for deduction row ${rowNum} is required.`)
        continue
      }
      
      // Validate percentage is a valid number
      const percentage = parseFloat(row.percentage)
      if (isNaN(percentage)) {
        errors.push(`Percentage for deduction row ${rowNum} must be a valid number.`)
        continue
      }
      
      if (percentage < 0) {
        errors.push(`Percentage for deduction row ${rowNum} cannot be negative.`)
        continue
      }
      
      if (percentage > 100) {
        errors.push(`Percentage for deduction row ${rowNum} cannot exceed 100%.`)
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
                errors.push(`Percentage for deduction row ${rowNum} must be between ${minPercentage}% and ${maxPercentage}%. Current value: ${percentage}%.`)
              }
            } else if (minPercentage !== null && percentage < minPercentage) {
              errors.push(`Percentage for deduction row ${rowNum} must be at least ${minPercentage}%. Current value: ${percentage}%.`)
            } else if (maxPercentage !== null && percentage > maxPercentage) {
              errors.push(`Percentage for deduction row ${rowNum} must not exceed ${maxPercentage}%. Current value: ${percentage}%.`)
            }
          }
        } catch (error) {
          console.error('Error validating min/max percentage:', error)
          // Don't block submission if API call fails, just log the error
        }
      }
    }
  }
  
  return { success: errors.length === 0, message: errors.length === 0 ? null : errors.join('\n') }
}

// ADD: Function to prepare donation document for submission
async function prepareDonationForSubmission() {
  const doc = { ...donation.doc }
  
  // Ensure payment_detail has random_id for each row
  if (doc.payment_detail && Array.isArray(doc.payment_detail)) {
    doc.payment_detail.forEach(row => {
      if (!row.random_id) {
        row.random_id = generateRandomId(doc.payment_detail.indexOf(row) + 1)
      }
    })
  }
  
  // ENHANCED: Ensure deduction_breakeven has random_id and preserve user modifications
  if (doc.deduction_breakeven && Array.isArray(doc.deduction_breakeven)) {
    doc.deduction_breakeven.forEach(row => {
      if (!row.random_id) {
        row.random_id = generateRandomId(doc.deduction_breakeven.indexOf(row) + 1)
      }
      
      // CRITICAL: Preserve user-modified values by storing them as original values
      // This ensures that when the backend API is called during creation, 
      // our preservation logic will detect these as user modifications
      if (row.percentage !== undefined) {
        row._originalPercentage = row.percentage
        row._userModifiedPercentage = true
        console.log(`Marking percentage as user-modified for submission: ${row.percentage}`)
      }
      
      if (row.min_percent !== undefined) {
        row._originalMinPercent = row.min_percent
        row._userModifiedMinPercent = true
        console.log(`Marking min_percent as user-modified for submission: ${row.min_percent}`)
      }
      
      if (row.max_percent !== undefined) {
        row._originalMaxPercent = row.max_percent
        row._userModifiedMaxPercent = true
        console.log(`Marking max_percent as user-modified for submission: ${row.max_percent}`)
      }
      
      if (row.amount !== undefined) {
        row._originalAmount = row.amount
        row._userModifiedAmount = true
        console.log(`Marking amount as user-modified for submission: ${row.amount}`)
      }
      
      if (row.base_amount !== undefined) {
        row._originalBaseAmount = row.base_amount
        row._userModifiedBaseAmount = true
        console.log(`Marking base_amount as user-modified for submission: ${row.base_amount}`)
      }
    })
  }
  
  console.log('Prepared donation document for submission with user modifications preserved:', doc)
  return doc
}

// ADD: Function to refresh tabs after donor filtering
async function refreshTabs() {
  await tabs.reload()
}

// ADD: Function to apply donor filtering to the form fields
async function applyDonorFilteringToForm() {
  // This function is primarily for updating the FieldLayout's data and field dependencies
  // It doesn't directly trigger backend calls for filtering, but ensures the form reflects the current donor
  // and currency settings. The actual filtering happens via the FieldLayout's get_query and depends_on.
  // We need to ensure the FieldLayout's data is updated with the current donor and currency.
  
  // Update FieldLayout's data
  if (donation.doc.donor_identity) {
    // This will trigger the FieldLayout to re-fetch donors with the current donor_identity
    // The FieldLayout's get_query and depends_on will handle the actual filtering.
  }
  
  if (donation.doc.currency) {
    // This will trigger the FieldLayout to re-fetch currencies if currency is a field that depends on it.
    // The FieldLayout's get_query and depends_on will handle the actual filtering.
  }
  
  // Force FieldLayout to re-render to apply new filters
  nextTick(() => {
    // This will trigger the computed filteredTabs to update with new donor filters
    console.log('FieldLayout re-rendered for new donor identity:', donation.doc.donor_identity)
  })
}

// ADD: Function to handle tab change in FieldLayout
function handleTabChange(tabName) {
  console.log('Tab changed to:', tabName)
  // This function is primarily for logging, as the FieldLayout's tab-change event
  // will trigger the FieldLayout to re-fetch its data and dependencies.
  // We don't need to do anything here directly for donor/currency filtering
  // as the FieldLayout's get_query and depends_on will handle it.
}

// ADD: Function to handle adding a new deduction row
function handleAddDeductionRow() {
  console.log('Adding new deduction row')
  const newRow = {
    random_id: generateRandomId(donation.doc.deduction_breakeven.length + 1),
    fund_class_id: '',
    percentage: 0,
    deduction_amount: 0,
    currency: donation.doc.currency || 'PKR',
    to_currency: donation.doc.to_currency || donation.doc.currency,
    posting_date: donation.doc.posting_date,
    is_return: donation.doc.is_return || false
  }
  donation.doc.deduction_breakeven.push(newRow)
  // Force reactive update
  donation.doc.deduction_breakeven = [...donation.doc.deduction_breakeven]
}

// ADD: Function to handle fund class selection in FieldLayout
function handleFundClassSelected(event) {
  console.log('Fund Class selected in FieldLayout:', event)
  const { row, fundClassId, success } = event
  
  if (success && fundClassId && row) {
    console.log('Processing Fund Class selection for row:', row, 'with fundClassId:', fundClassId)
    // Force a reactive update of the payment_detail table
    if (donation.doc.payment_detail) {
      console.log('Forcing reactive update of payment_detail')
      donation.doc.payment_detail = [...donation.doc.payment_detail]
    }
  }
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
  if (rowIndex !== null && donation.doc.payment_detail && donation.doc.payment_detail[rowIndex]) {
    const row = donation.doc.payment_detail[rowIndex]
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

// NEW: Function to populate fund class fields for Pledge contribution type
async function populateFundClassFieldsForPledge(row) {
  console.log('Populating fund class fields for Pledge contribution type:', row.fund_class_id)
  
  try {
    // Call the same backend API that set_deduction_breakeven uses, but only for fund class field population
    const result = await call('crm.fcrm.doctype.donation.api.set_deduction_breakeven', {
      payment_details: [row], // Pass only the current row
      company: donation.doc.company || 'Alkhidmat Foundation',
      contribution_type: 'Pledge', // Explicitly set as Pledge
      donation_cost_center: donation.doc.donation_cost_center,
      currency: donation.doc.currency,
      to_currency: donation.doc.to_currency || donation.doc.currency,
      posting_date: donation.doc.posting_date,
      is_return: donation.doc.is_return || false
    })
    
    if (result.success && result.updated_payment_details && result.updated_payment_details.length > 0) {
      const updatedRow = result.updated_payment_details[0]
      
      // Update only the fund class related fields (equity_account, receivable_account, service areas, etc.)
      const fieldsToUpdate = [
        'equity_account', 'receivable_account', 'pay_service_area', 
        'pay_subservice_area', 'pay_product', 'cost_center'
      ]
      
      fieldsToUpdate.forEach(field => {
        if (updatedRow[field] !== undefined) {
          row[field] = updatedRow[field]
          console.log(`Updated ${field} for Pledge: ${row[field]}`)
        }
      })
      
      console.log('Fund class fields populated successfully for Pledge')
    } else {
      console.error('Failed to populate fund class fields for Pledge:', result.message)
    }
  } catch (error) {
    console.error('Error populating fund class fields for Pledge:', error)
  }
}

// ADD: Calculation computed properties
const totalDonation = computed(() => {
  if (!donation.doc.payment_detail || !Array.isArray(donation.doc.payment_detail)) {
    return 0
  }
  
  return donation.doc.payment_detail.reduce((total, row) => {
    return total + (parseFloat(row.donation_amount) || 0)
  }, 0)
})

const totalDeduction = computed(() => {
  if (!donation.doc.deduction_breakeven || !Array.isArray(donation.doc.deduction_breakeven)) {
    return 0
  }
  
  return donation.doc.deduction_breakeven.reduce((total, row) => {
    return total + (parseFloat(row.amount) || 0)
  }, 0)
})

const netAmount = computed(() => {
  return totalDonation.value - totalDeduction.value
})

const outstandingAmount = computed(() => {
  // For Pledge: Outstanding Amount = Total Donation
  // For Donation: Outstanding Amount = Net Amount
  if (donation.doc.contribution_type === 'Pledge') {
    return totalDonation.value
  } else {
    return netAmount.value
  }
})

// ADD: Function to update calculation fields in the document
function updateCalculationFields() {
  // Update the document with calculated values
  donation.doc.base_total_donation = totalDonation.value
  donation.doc.base_total_deduction = totalDeduction.value
  donation.doc.base_net_amount = netAmount.value
  donation.doc.base_outstanding_amount = outstandingAmount.value
  donation.doc.outstanding_amount = outstandingAmount.value
  
  // Also update the main fields that are displayed in the UI
  donation.doc.total_donation = totalDonation.value
  donation.doc.total_deduction = totalDeduction.value
  donation.doc.net_amount = netAmount.value
  
  console.log('Calculation fields updated:', {
    base_total_donation: donation.doc.base_total_donation,
    base_total_deduction: donation.doc.base_total_deduction,
    base_net_amount: donation.doc.base_net_amount,
    base_outstanding_amount: donation.doc.base_outstanding_amount,
    outstanding_amount: donation.doc.outstanding_amount,
    total_donation: donation.doc.total_donation,
    total_deduction: donation.doc.total_deduction,
    net_amount: donation.doc.net_amount
  })
}

// ADD: Watcher to update calculations when payment_detail changes
watch(() => donation.doc.payment_detail, () => {
  if (isInitializingWithDefaults) return
  updateCalculationFields()
}, { deep: true })

// ADD: Watcher to update calculations when deduction_breakeven changes
watch(() => donation.doc.deduction_breakeven, () => {
  if (isInitializingWithDefaults) return
  updateCalculationFields()
}, { deep: true })

// ADD: Watcher to update calculations when contribution_type changes
watch(() => donation.doc.contribution_type, () => {
  if (isInitializingWithDefaults) return
  updateCalculationFields()
})

// ADD: Function to handle donor selection for items table
async function handleItemsDonorSelection(donorId, row) {
  console.log('Handling donor selection for items:', { donorId, row })
  
  if (!donorId) {
    clearItemsDonorFields(row)
    return
  }
  
  try {
    const donorDetails = await fetchDonorDetails(donorId)
    if (donorDetails) {
      updateItemsDonorFields(row, donorDetails)
      console.log('Items donor fields updated successfully')
    } else {
      console.log('No donor details received for items')
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
  
  // Map donor fields to items fields based on fetch_from configuration
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
      console.log(`Updated items ${rowField}: ${oldValue} -> ${row[rowField]}`)
    }
  })
  
  console.log('Items row after donor update:', { ...row })
  
  // Force reactive update - CRITICAL for Vue to detect changes
  if (donation.doc.items) {
    console.log('Forcing reactive update of items after donor update')
    donation.doc.items = [...donation.doc.items]
  }
}

// ADD: Function to clear donor fields in items table
function clearItemsDonorFields(row) {
  console.log('Clearing donor fields for items row')
  
  const fieldsToClear = [
    'donor_name',
    'donor_type', 
    'donor_desk'
  ]
  
  fieldsToClear.forEach(field => {
    row[field] = ''
  })
  
  console.log('Items donor fields cleared')
}

// ADD: Function to handle fund class selection for items table
async function handleItemsFundClassSelection(fundClassId, row) {
  console.log('Handling fund class selection for items:', { fundClassId, row })
  
  if (!fundClassId) {
    clearItemsFundClassFields(row)
    return
  }
  
  try {
    const fundClassDetails = await fetchFundClassDetails(fundClassId)
    if (fundClassDetails) {
      updateItemsFundClassFields(row, fundClassDetails)
      console.log('Items fund class fields updated successfully')
    } else {
      console.log('No fund class details received for items')
      toast.error('Could not fetch fund class details')
    }
  } catch (error) {
    console.error('Error in items fund class handling:', error)
    toast.error('Error loading fund class details')
  }
}

// ADD: Function to update fund class fields in items table
function updateItemsFundClassFields(row, fundClassDetails) {
  console.log('Updating items row with fund class details:', fundClassDetails)
  console.log('Items row before fund class update:', { ...row })
  
  // Map fund class fields to items fields based on fetch_from configuration
  const fieldMappings = {
    'service_area': 'service_area',
    'subservice_area': 'subservice_area',
    'product': 'product'
  }
  
  // Update each field with fund class data
  Object.entries(fieldMappings).forEach(([fundClassField, rowField]) => {
    if (fundClassDetails[fundClassField] !== undefined) {
      const oldValue = row[rowField]
      row[rowField] = fundClassDetails[fundClassField] || ''
      console.log(`Updated items ${rowField}: ${oldValue} -> ${row[rowField]}`)
    }
  })
  
  console.log('Items row after fund class update:', { ...row })
  
  // Force reactive update - CRITICAL for Vue to detect changes
  if (donation.doc.items) {
    console.log('Forcing reactive update of items after fund class update')
    donation.doc.items = [...donation.doc.items]
  }
}

// ADD: Function to clear fund class fields in items table
function clearItemsFundClassFields(row) {
  console.log('Clearing fund class fields for items row')
  
  const fieldsToClear = [
    'service_area',
    'subservice_area',
    'product'
  ]
  
  fieldsToClear.forEach(field => {
    row[field] = ''
  })
  
  console.log('Items fund class fields cleared')
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

// ADD: Function to calculate deduction amount based on percentage and donation amount
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

// ADD: Function to store original backend values when deduction breakeven is first populated
function storeOriginalDeductionValues() {
  if (donation.doc.deduction_breakeven && Array.isArray(donation.doc.deduction_breakeven)) {
    donation.doc.deduction_breakeven.forEach((row, index) => {
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

// BULLETPROOF FIX: Enhanced triggerOnRowRemove to sync deletion between payment_detail and deduction_breakeven
const originalTriggerOnRowRemove = donation.triggerOnRowRemove

// Create custom triggerOnRowRemove that handles payment_detail to deduction_breakeven sync
const customTriggerOnRowRemove = (selectedRows, remainingRows) => {
  console.log('Custom triggerOnRowRemove called in DonationModal:', { selectedRows, remainingRows })
  
  // Check if this is a payment_detail table deletion
  if (donation.doc.payment_detail && Array.isArray(donation.doc.payment_detail)) {
    console.log('Payment detail table deletion detected in DonationModal')
    
    // Get the random_ids of deleted payment detail rows
    const deletedRandomIds = new Set()
    selectedRows.forEach(rowName => {
      // Find the deleted row in the original payment_detail array
      const deletedRow = donation.doc.payment_detail.find(row => row.name === rowName)
      if (deletedRow && deletedRow.random_id) {
        deletedRandomIds.add(deletedRow.random_id)
        console.log(`Payment detail row with random_id ${deletedRow.random_id} was deleted`)
      }
    })
    
    // Delete corresponding rows in deduction_breakeven table
    if (deletedRandomIds.size > 0 && donation.doc.deduction_breakeven && Array.isArray(donation.doc.deduction_breakeven)) {
      const originalDeductionLength = donation.doc.deduction_breakeven.length
      
      // Filter out deduction_breakeven rows that match the deleted payment_detail random_ids
      donation.doc.deduction_breakeven = donation.doc.deduction_breakeven.filter(deductionRow => {
        const shouldKeep = !deletedRandomIds.has(deductionRow.random_id)
        if (!shouldKeep) {
          console.log(`Deleting deduction_breakeven row with random_id ${deductionRow.random_id}`)
        }
        return shouldKeep
      })
      
      const deletedDeductionCount = originalDeductionLength - donation.doc.deduction_breakeven.length
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

// Override the triggerOnRowRemove in the donation context
donation.triggerOnRowRemove = customTriggerOnRowRemove

function getFieldFilters(field) {
  // Apply filter to link_doctype field in links/timeline_links child tables
  // Only allow Donor, CRM Lead, Contact doctypes
  if ((parentFieldname === 'links' || parentFieldname === 'timeline_links')
    && field.fieldname === 'link_doctype'
    && field.fieldtype === 'Link'
    && field.options === 'DocType') {
    return { name: ['in', ['Donor', 'CRM Lead', 'Contact']] }
  }
  
  // Apply warehouse-specific filters for donation form
  if (field.fieldname === 'warehouse' 
    && field.fieldtype === 'Link' 
    && field.options === 'Warehouse'
    && doctype === 'Donation') {
    return {
      is_group: 0,
      is_rejected_warehouse: 0,
      company: data.value?.company || 'Alkhidmat Foundation'
    }
  }
  
  // Return existing filters if available
  if (field.filters) {
    return field.filters
  }
  
  // Parse link_filters if available
  if (field.link_filters) {
    try {
      const parsedFilters = JSON.parse(field.link_filters)
      return parsedFilters
    } catch (e) {
      return {}
    }
  }
  
  return {}
}

</script>
