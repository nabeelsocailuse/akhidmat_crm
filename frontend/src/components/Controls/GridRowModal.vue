<template>
  <Dialog v-model="show" :options="{ size: '4xl' }">
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
import { nextTick, computed, watch, onMounted } from 'vue'

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
  }
})

const { isManager } = usersStore()

const show = defineModel()
const showGridRowFieldsModal = defineModel('showGridRowFieldsModal')

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

// ADD: Enhanced tabs with donor filtering for grid row editing
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
      filteredSection.columns = section.columns.map(column => {
        const filteredColumn = { ...column }
        
        // Filter fields within columns
        filteredColumn.fields = column.fields.map(field => {
          // Create a new field object to avoid mutating the original
          let enhancedField = { ...field }
          
          // Configure donor_id fields with comprehensive filtering
          if (field.fieldname === 'donor_id') {
            enhancedField = configureDonorField(field)
            console.log('GridRowModal: Configured donor_id field with comprehensive filtering')
          }
          
          return enhancedField
        })
        
        return filteredColumn
      })
      
      return filteredSection
    })
    
    return filteredTab
  })
  
  console.log('GridRowModal: Final processed tabs with donor filtering:', processedTabs)
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
  
  // Set depends_on
  enhancedField.depends_on = 'donor_identity'
  
  // Set options and fieldtype
  enhancedField.options = 'Donor'
  enhancedField.fieldtype = 'Link'
  
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
</script>
