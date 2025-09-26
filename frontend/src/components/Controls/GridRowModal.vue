<template>
  <Dialog v-model="show" :options="{ size: '4xl' }" :disableOutsideClickToClose="true" :disableEscToClose="true" :persistent="true">
    <template #body>
      <div class="bg-surface-modal px-4 pb-6 pt-5 sm:px-6">
        <div class="mb-5 flex items-center justify-between">
          <div>
            <h3 class="text-2xl font-semibold leading-6 text-ink-gray-9">
              {{ __('Editing Row {0}', [index + 1]) }}
            </h3>
          </div>
          <div class="flex items-center gap-1">
            <Button
              v-if="isManager()"
              variant="ghost"
              class="w-7"
              @click="openGridRowFieldsModal"
            >
              <template #icon>
                <EditIcon />
              </template>
            </Button>
            <Button variant="ghost" class="w-7" @click="show = false">
              <template #icon>
                <FeatherIcon name="x" class="h-4 w-4" />
              </template>
            </Button>
          </div>
        </div>
        <div>
          <FieldLayout
            v-if="filteredTabs.data"
            :tabs="filteredTabs.data"
            :data="data"
            :doctype="doctype"
            :isGridRow="true"
            :parentFieldname="parentFieldname"
            :readOnly="readOnly"
            @field-change="handleFieldChange"
          />
        </div>
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import EditIcon from '@/components/Icons/EditIcon.vue'
import FieldLayout from '@/components/FieldLayout/FieldLayout.vue'
import { usersStore } from '@/stores/users'
import { createResource } from 'frappe-ui'
import { nextTick, computed, watch, onMounted, provide, inject } from 'vue'
import { call, toast } from 'frappe-ui'

const props = defineProps({
  index: Number,
  data: Object,
  doctype: String,
  parentDoctype: String,
  parentFieldname: String,
  // ADD: Accept donor filtering props from parent
  donorFiltering: {
    type: Object,
    default: () => ({})
  },
  readOnly: {
    type: Boolean,
    default: false
  }
})

const { isManager } = usersStore()

const show = defineModel()
const showGridRowFieldsModal = defineModel('showGridRowFieldsModal')

// ADD: Define emit for field changes
const emit = defineEmits(['field-change'])

const tabs = createResource({
  url: 'crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_fields_layout',
  cache: ['Grid Row', props.doctype, props.parentDoctype],
  params: {
    doctype: props.doctype,
    type: 'Grid Row',
    parent_doctype: props.parentDoctype,
  },
  auto: true,
})

// ADD: Enhanced tabs with proper field visibility and fetching for items table
const filteredTabs = computed(() => {
  console.log('GridRowModal: filteredTabs computed property recalculating')
  console.log('GridRowModal: tabs.data available:', !!tabs.data)
  console.log('GridRowModal: donorFiltering props:', props.donorFiltering)
  
  if (!tabs.data || !Array.isArray(tabs.data)) {
    console.log('GridRowModal: No tabs data available, returning empty array')
    return { data: [] }
  }
  
  console.log('GridRowModal: Processing', tabs.data.length, 'tabs')
  
  const processedTabs = tabs.data.map(tab => {
    // Clone the tab to avoid mutating the original data
    const filteredTab = { ...tab }
    
    // Filter sections
    filteredTab.sections = tab.sections.map(section => {
      const filteredSection = { ...section }
      
      // Filter columns within sections
      filteredSection.columns = section.columns.map((column, columnIndex) => {
        const filteredColumn = { ...column }
        
        // Filter fields within columns
        filteredColumn.fields = column.fields.filter(field => {
          // FIX: Don't filter out donor field for items table
          if (field.fieldname === 'donor' && props.parentFieldname !== 'items') {
            console.log('GridRowModal: Filtering out duplicate donor field from column', columnIndex)
            return false
          }
          return true
        }).map(field => {
          // Create a new field object to avoid mutating the original
          let enhancedField = { ...field }
          
          // Configure donor_id fields with comprehensive filtering
          if (field.fieldname === 'donor_id') {
            enhancedField = configureDonorField(field)
            console.log('GridRowModal: Configured donor_id field with comprehensive filtering')
          }
          
          // Configure donor field for items table
          if (field.fieldname === 'donor' && props.parentFieldname === 'items') {
            enhancedField = configureDonorField(field)
            console.log('GridRowModal: Configured donor field for items table')
          }
          
          // FIX: Configure field visibility and fetching for items table
          if (props.parentFieldname === 'items') {
            // Hide fund class dependent fields initially and make them read-only when visible
            if (['service_area', 'subservice_area', 'product'].includes(field.fieldname)) {
              enhancedField.depends_on = 'fund_class'
              enhancedField.read_only = 1 // Make read-only when visible (like backend)
              enhancedField.fetch_from = `fund_class.${field.fieldname}` // Add fetch_from
              console.log('GridRowModal: Configured fund class dependent field:', field.fieldname)
            }
            
            // Hide donor dependent fields initially and make them read-only when visible
            if (['donor_name', 'donor_type', 'donor_desk'].includes(field.fieldname)) {
              enhancedField.depends_on = 'donor'
              enhancedField.read_only = 1 // Make read-only when visible (like backend)
              enhancedField.fetch_from = `donor.${field.fieldname}` // Add fetch_from
              console.log('GridRowModal: Configured donor dependent field:', field.fieldname)
            }
          }
          // NEW: In payment_detail row modal, control visibility for donor/fund class details
          if (props.parentFieldname === 'payment_detail') {
            const donorFields = [
              'donor_name', 'donor_type', 'donor_desk', 'donor_desk_id',
              'contact_no', 'email', 'city', 'address', 'cnic',
              'co_name', 'co_contact_no', 'co_email', 'co_address',
              'relationship_with_donor', 'area', 'co_city', 'co_country', 'co_designation'
            ]
            // Hide donor detail fields if empty
            if (donorFields.includes(field.fieldname)) {
              const val = props.data ? props.data[field.fieldname] : undefined
              if (val === undefined || val === null || val === '') {
                enhancedField.hidden = true
              }
            }
            // Fund class detail fields should appear once a fund class is selected; make them read-only
            if (['pay_service_area', 'pay_subservice_area', 'pay_product', 'equity_account', 'receivable_account', 'cost_center'].includes(field.fieldname)) {
              enhancedField.depends_on = 'fund_class_id'
              enhancedField.read_only = 1
              enhancedField.hidden = false
              // Provide fetch_from so FieldLayout auto-populates when fund_class_id is set
              const fetchMap = {
                pay_service_area: 'fund_class_id.service_area',
                pay_subservice_area: 'fund_class_id.subservice_area',
                pay_product: 'fund_class_id.product',
                equity_account: 'fund_class_id.equity_account',
                receivable_account: 'fund_class_id.receivable_account',
                cost_center: 'fund_class_id.cost_center'
              }
              if (fetchMap[field.fieldname]) {
                enhancedField.fetch_from = fetchMap[field.fieldname]
              }
            }
          }
          
          return enhancedField
        })
        
        return filteredColumn
      })
      
      return filteredSection
    })
    
    return filteredTab
  })
  
  console.log('GridRowModal: Final processed tabs with field visibility:', processedTabs)
  return { data: processedTabs }
})

// ADD: Function to configure donor fields with comprehensive filtering
function configureDonorField(field) {
  console.log('GridRowModal: Configuring donor field:', field.fieldname)
  
  // Create a new field object with injected filtering
  const enhancedField = { ...field }
  
  // Inject the get_query function directly
  enhancedField.get_query = () => {
    console.log('GridRowModal: get_query function called for field:', field.fieldname)
    const query = getDonorQuery()
    console.log('GridRowModal: Returning query:', query)
    return query
  }
  
  // Inject filters directly
  enhancedField.filters = getDonorFilters()
  
  // Inject link_filters as fallback
  enhancedField.link_filters = JSON.stringify(getDonorFilters())
  
  // FIX: Don't set depends_on for GridRowModal context to ensure field is always visible
  // enhancedField.depends_on = 'donor_identity'
  
  // Set options and fieldtype
  enhancedField.options = 'Donor'
  enhancedField.fieldtype = 'Link'
  
  // ADD: Force the field to be visible
  enhancedField.hidden = false
  enhancedField.read_only = false
  
  // ADD: Force the field to have the correct structure
  enhancedField._forceDonorFiltering = true
  enhancedField._donorIdentity = props.donorFiltering?.donor_identity
  enhancedField._donorCurrency = props.donorFiltering?.currency
  
  console.log('GridRowModal: Injected field configuration:', {
    fieldname: enhancedField.fieldname,
    get_query: typeof enhancedField.get_query,
    filters: enhancedField.filters,
    link_filters: enhancedField.link_filters,
    depends_on: enhancedField.depends_on,
    options: enhancedField.options,
    fieldtype: enhancedField.fieldtype,
    hidden: enhancedField.hidden,
    read_only: enhancedField.read_only,
    _forceDonorFiltering: enhancedField._forceDonorFiltering,
    _donorIdentity: enhancedField._donorIdentity,
    _donorCurrency: enhancedField._donorCurrency
  })
  
  return enhancedField
}

// ADD: Function to get donor filters for field configuration
function getDonorFilters() {
  const filters = {}
  
  // Add donor identity filter
  if (props.donorFiltering?.donor_identity) {
    filters.donor_identity = props.donorFiltering.donor_identity
  }
  
  // Add status filter
  filters.status = 'Active'
  
  // Add currency filter if available
  if (props.donorFiltering?.currency) {
    filters.default_currency = props.donorFiltering.currency
  }
  
  return filters
}

// ADD: Function to get filtered donor query based on donor identity
function getDonorQuery() {
  const filters = {
    status: 'Active'
  }
  
  // ADD: Debug logging to see what donor filtering data is received
  console.log('GridRowModal: Received donorFiltering props:', props.donorFiltering)
  
  // Add donor identity filter based on the passed donor filtering
  if (props.donorFiltering?.donor_identity) {
    filters.donor_identity = props.donorFiltering.donor_identity
    console.log('GridRowModal: Adding donor identity filter:', props.donorFiltering.donor_identity)
  } else {
    console.log('GridRowModal: No donor_identity in donorFiltering props')
  }
  
  // Add currency filter if available
  if (props.donorFiltering?.currency) {
    filters.default_currency = props.donorFiltering.currency
  }
  
  console.log('GridRowModal: Final donor query filters:', filters)
  
  return {
    doctype: 'Donor',
    filters: filters,
    fields: ['name', 'donor_name', 'donor_type', 'donor_desk', 'contact_no', 'email', 'city', 'address', 'cnic']
  }
}

// ADD: Watcher to monitor donorFiltering props changes
watch(() => props.donorFiltering, (newDonorFiltering, oldDonorFiltering) => {
  console.log('GridRowModal: donorFiltering props changed:', {
    old: oldDonorFiltering,
    new: newDonorFiltering
  })
  
  // Force refresh of filtered tabs when donor filtering changes
  nextTick(() => {
    console.log('GridRowModal: Forcing refresh of filtered tabs due to donor filtering change')
    // Force refresh the tabs resource to get fresh field configurations
    if (tabs.reload) {
      tabs.reload()
    }
  })
}, { deep: true, immediate: true })

// ADD: onMounted hook to ensure donor filtering is applied when component is first loaded
onMounted(() => {
  console.log('GridRowModal: Component mounted, applying initial donor filtering')
  console.log('GridRowModal: Initial donorFiltering props:', props.donorFiltering)
  
  // Force refresh of tabs to ensure proper filtering
  nextTick(() => {
    if (tabs.reload) {
      tabs.reload()
    }
  })
})

function openGridRowFieldsModal() {
  showGridRowFieldsModal.value = true
  nextTick(() => (show.value = false))
}

// Simple helper function to check if a field is a donor detail field
function isDonorDetailField(fieldname) {
  return [
    'donor_name', 'donor_type', 'donor_desk', 'donor_desk_id',
    'contact_no', 'email', 'city', 'address', 'cnic',
    'co_name', 'co_contact_no', 'co_email', 'co_address',
    'relationship_with_donor', 'area', 'co_city', 'co_country', 'co_designation'
  ].includes(fieldname)
}

// Add field change handler for auto-fetching
async function handleFieldChange(fieldname, value) {
  console.log(' GridRowModal handleFieldChange called:', { 
    fieldname, 
    value, 
    parentFieldname: props.parentFieldname,
    data: props.data 
  })
  
  // Emit the field change to parent Grid component
  emit('field-change', fieldname, value)
  
  // Handle fund_class change in items table modal
  if (fieldname === 'fund_class' && value && props.parentFieldname === 'items') {
    console.log(' Fund class selected in items modal:', value)
    
    try {
      const fundClassDetails = await call('crm.fcrm.doctype.donation.api.get_fund_class_details', {
        fund_class_id: value,
        company: 'Alkhidmat Foundation'
      })
      
      console.log('📊 Fund class details received:', fundClassDetails)
      
      if (fundClassDetails && Object.keys(fundClassDetails).length > 0) {
        // Emit field changes to parent Grid component with a small delay to ensure proper order
        setTimeout(() => {
          if (fundClassDetails.service_area) {
            console.log('📝 Emitting service_area:', fundClassDetails.service_area)
            emit('field-change', 'service_area', fundClassDetails.service_area)
          }
          if (fundClassDetails.subservice_area) {
            console.log(' Emitting subservice_area:', fundClassDetails.subservice_area)
            emit('field-change', 'subservice_area', fundClassDetails.subservice_area)
          }
          if (fundClassDetails.product) {
            console.log(' Emitting product:', fundClassDetails.product)
            emit('field-change', 'product', fundClassDetails.product)
          }
          if (fundClassDetails.cost_center) {
            console.log('📝 Emitting cost_center:', fundClassDetails.cost_center)
            emit('field-change', 'cost_center', fundClassDetails.cost_center)
          }
        }, 100)
        
        toast.success('Fund class details loaded successfully')
      } else {
        console.log('⚠️ No fund class details found')
        toast.warning('No fund class details found')
      }
    } catch (error) {
      console.error('❌ Error fetching fund class details:', error)
      toast.error('Error loading fund class details')
    }
  }

  // Restore: When fund class is selected in payment_detail modal, also populate equity and receivable accounts
  if (fieldname === 'fund_class_id' && value && props.parentFieldname === 'payment_detail') {
    try {
      const fundClassDetails = await call('crm.fcrm.doctype.donation.api.get_fund_class_details', {
        fund_class_id: value,
        company: 'Alkhidmat Foundation'
      })
      if (fundClassDetails && Object.keys(fundClassDetails).length > 0) {
        setTimeout(() => {
          if (fundClassDetails.equity_account) {
            emit('field-change', 'equity_account', fundClassDetails.equity_account)
          }
          if (fundClassDetails.receivable_account) {
            emit('field-change', 'receivable_account', fundClassDetails.receivable_account)
          }
          if (fundClassDetails.cost_center) {
            emit('field-change', 'cost_center', fundClassDetails.cost_center)
          }
          if (fundClassDetails.service_area) {
            emit('field-change', 'pay_service_area', fundClassDetails.service_area)
            emit('field-change', 'service_area', fundClassDetails.service_area)
            if (props.data) props.data.pay_service_area = fundClassDetails.service_area
          }
          if (fundClassDetails.subservice_area) {
            emit('field-change', 'pay_subservice_area', fundClassDetails.subservice_area)
            emit('field-change', 'subservice_area', fundClassDetails.subservice_area)
            if (props.data) props.data.pay_subservice_area = fundClassDetails.subservice_area
          }
          if (fundClassDetails.product) {
            emit('field-change', 'pay_product', fundClassDetails.product)
            emit('field-change', 'product', fundClassDetails.product)
            if (props.data) props.data.pay_product = fundClassDetails.product
          }
        }, 100)
      }
    } catch (e) {
      console.error('Error restoring fund class account fetch:', e)
    }
  }
  
  // Handle donor change in items table modal
  if (fieldname === 'donor' && value && props.parentFieldname === 'items') {
    console.log(' Donor selected in items modal:', value)
    
    try {
      const donorDetails = await call('frappe.client.get', {
        doctype: 'Donor',
        name: value
      })
      
      console.log(' Donor details received:', donorDetails)
      
      if (donorDetails) {
        // Emit field changes to parent Grid component with a small delay
        setTimeout(() => {
          if (donorDetails.donor_name) {
            console.log('📝 Emitting donor_name:', donorDetails.donor_name)
            emit('field-change', 'donor_name', donorDetails.donor_name)
          }
          if (donorDetails.donor_type) {
            console.log('📝 Emitting donor_type:', donorDetails.donor_type)
            emit('field-change', 'donor_type', donorDetails.donor_type)
          }
          if (donorDetails.donor_desk) {
            console.log('📝 Emitting donor_desk:', donorDetails.donor_desk)
            emit('field-change', 'donor_desk', donorDetails.donor_desk)
          }
        }, 100)
        
        toast.success('Donor details loaded successfully')
      } else {
        console.log('⚠️ No donor details found')
        toast.warning('No donor details found')
      }
    } catch (error) {
      console.error('❌ Error fetching donor details:', error)
      toast.error('Error loading donor details')
    }
  }
  
  // Handle item_code change in items table modal
  if (fieldname === 'item_code' && value && props.parentFieldname === 'items') {
    console.log('🔥 Item code selected in items modal:', value)
    
    try {
      const itemDetails = await call('frappe.client.get', {
        doctype: 'Item',
        name: value
      })
      
      console.log('📦 Item details received:', itemDetails)
      
      if (itemDetails) {
        // Get the onFieldChange function from inject
        const onFieldChange = inject('onFieldChange')
        console.log('📝 onFieldChange function available:', !!onFieldChange)
        
        // Update fields with fetched data
        if (itemDetails.item_name) {
          console.log('📝 Updating item_name:', itemDetails.item_name)
          onFieldChange('item_name', itemDetails.item_name)
        }
        if (itemDetails.valuation_rate) {
          console.log(' Updating basic_rate:', itemDetails.valuation_rate)
          onFieldChange('basic_rate', itemDetails.valuation_rate)
        }
        
        toast.success('Item details loaded successfully')
      } else {
        console.log('⚠️ No item details found')
        toast.warning('No item details found')
      }
    } catch (error) {
      console.error('❌ Error fetching item details:', error)
      toast.error('Error loading item details')
    }
  }
}

// Provide the field change handler to child components
provide('onFieldChange', handleFieldChange)
</script>
