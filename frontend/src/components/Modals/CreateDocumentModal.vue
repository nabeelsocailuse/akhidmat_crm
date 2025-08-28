<template>
  <Dialog v-model="show" :options="dialogOptions" :disableOutsideClickToClose="isSubModal" :disableEscToClose="isSubModal" :zIndex="isSubModal ? 2000 : 100" :backdrop="isSubModal ? 'static' : true" :data-modal="isSubModal ? 'sub' : 'main'">
    <template #body>
      <div class="bg-surface-modal px-4 pb-6 pt-5 sm:px-6">
        <div class="mb-5 flex items-center justify-between">
          <div>
            <h3 class="text-2xl font-semibold leading-6 text-ink-gray-9">
              {{ __(dialogOptions.title) || __('Untitled') }}
            </h3>
          </div>
          <div class="flex items-center gap-1">
            <Button
              v-if="isManager() && !isMobileView"
              variant="ghost"
              class="w-7"
              @click="openQuickEntryModal"
            >
              <template #icon>
                <EditIcon />
              </template>
            </Button>
            <Button variant="ghost" class="w-7" @click="show = false">
              <template #icon>
                <FeatherIcon name="x" class="size-4" />
              </template>
            </Button>
          </div>
        </div>
        <div v-if="filteredTabs.length > 0">
          <FieldLayout 
            :tabs="filteredTabs" 
            :data="_data.doc" 
            :doctype="doctype" 
            :key="`${fieldLayoutKey}-${forceRefresh}`" 
            :donorFiltering="props.donorFiltering"
          />
          <ErrorMessage class="mt-2" :message="error" />
        </div>
      </div>
      <div class="px-4 pb-7 pt-4 sm:px-6">
        <div class="space-y-2">
          <Button
            class="w-full"
            v-for="action in dialogOptions.actions"
            :key="action.label"
            v-bind="action"
            :label="__(action.label)"
            :loading="loading"
          />
        </div>
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import FieldLayout from '@/components/FieldLayout/FieldLayout.vue'
import EditIcon from '@/components/Icons/EditIcon.vue'
import { usersStore } from '@/stores/users'
import { useDocument } from '@/data/document'
import { isMobileView } from '@/composables/settings'
import { showQuickEntryModal, quickEntryProps } from '@/composables/modals'
import { FeatherIcon, createResource, ErrorMessage, call } from 'frappe-ui'
import { ref, nextTick, watch, computed, onMounted } from 'vue'

const props = defineProps({
  doctype: {
    type: String,
    required: true,
  },
  data: {
    type: Object,
    default: () => ({}),
  },
  isSubModal: {
    type: Boolean,
    default: false,
  },
  // ADD: Accept donor filtering props
  donorFiltering: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['callback', 'close', 'subModalActive', 'subModalInteraction'])

const { isManager } = usersStore()

const show = defineModel()

const loading = ref(false)
const error = ref(null)

const { document: _data, triggerOnBeforeCreate } = useDocument(props.doctype)

const dialogOptions = computed(() => {
  let doctype = props.doctype

  if (doctype.startsWith('CRM ') || doctype.startsWith('FCRM ')) {
    doctype = doctype.replace(/^(CRM |FCRM )/, '')
  }

  let title = __('New {0}', [doctype])
  let size = 'xl'
  let actions = [
    {
      label: __('Create'),
      variant: 'solid',
      onClick: () => create(),
    },
  ]

  return { title, size, actions }
})

const tabs = createResource({
  url: 'crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_fields_layout',
  cache: ['QuickEntry', props.doctype],
  params: { doctype: props.doctype, type: 'Quick Entry' },
  auto: true,
})

// ADD: Watcher to monitor donorFiltering props changes
watch(() => props.donorFiltering, (newDonorFiltering, oldDonorFiltering) => {
  console.log('CreateDocumentModal: donorFiltering props changed:', {
    old: oldDonorFiltering,
    new: newDonorFiltering
  })
  
  // Force refresh of filtered tabs when donor filtering changes
  nextTick(() => {
    console.log('CreateDocumentModal: Forcing refresh of filtered tabs due to donor filtering change')
    // Force refresh the tabs resource to get fresh field configurations
    if (tabs.reload) {
      tabs.reload()
    }
    
    // Apply filtering to DOM elements after tabs are refreshed
    setTimeout(() => {
      applyDonorFilteringToDOM()
    }, 200)
  })
}, { deep: true, immediate: true })

// ADD: Watcher to monitor data changes and apply donor filtering
watch(() => props.data, (newData, oldData) => {
  console.log('CreateDocumentModal: Data changed:', { old: oldData, new: newData })
  
  // Apply donor filtering when data changes
  nextTick(() => {
    console.log('CreateDocumentModal: Applying donor filtering after data change:', props.donorFiltering)
    
    // Force refresh of tabs to ensure proper filtering
    if (tabs.reload) {
      tabs.reload()
    }
  })
}, { deep: true })

// ADD: Watcher for tabs data changes to apply donor filtering
watch(() => tabs.data, (newTabsData, oldTabsData) => {
  console.log('CreateDocumentModal: Tabs data changed:', { old: oldTabsData, new: newTabsData })
  
  if (newTabsData && Array.isArray(newTabsData)) {
    console.log('CreateDocumentModal: New tabs data received, applying donor filtering')
    
    // Apply donor filtering after tabs are loaded
    nextTick(() => {
      setTimeout(() => {
        applyDonorFilteringToDOM()
      }, 100)
    })
  }
}, { deep: true })

// ADD: onMounted hook to ensure donor filtering is applied when component is first loaded
onMounted(() => {
  console.log('CreateDocumentModal: Component mounted, applying initial donor filtering')
  console.log('CreateDocumentModal: Initial donorFiltering props:', props.donorFiltering)
  
  // Apply donor filtering after component is mounted
  nextTick(() => {
    setTimeout(() => {
      applyDonorFilteringToDOM()
    }, 200)
  })
})

// ADD: Function to directly apply donor filtering to DOM elements
function applyDonorFilteringToDOM() {
  console.log('CreateDocumentModal: Applying donor filtering directly to DOM elements')
  
  nextTick(() => {
    // Find all donor_id fields in the modal
    const donorFields = document.querySelectorAll('[data-modal="sub"] input[name="donor_id"], [data-modal="sub"] select[name="donor_id"]')
    console.log('CreateDocumentModal: Found donor fields in DOM:', donorFields.length)
    
    donorFields.forEach((field, index) => {
      console.log(`CreateDocumentModal: Configuring donor field ${index}:`, field)
      
      // Set data attributes for the filtering
      if (field && typeof field.setAttribute === 'function') {
        const filterData = {
          donor_identity: props.donorFiltering?.donor_identity,
          currency: props.donorFiltering?.currency,
          status: 'Active'
        }
        
        field.setAttribute('data-donor-filters', JSON.stringify(filterData))
        field.setAttribute('data-donor-query', JSON.stringify(getDonorQuery()))
        console.log(`CreateDocumentModal: Set filtering data on field ${index}:`, filterData)
      }
    })
    
    // Also find any Link components that might be rendering donor fields
    const linkComponents = document.querySelectorAll('[data-modal="sub"] .form-control[data-fieldname="donor_id"]')
    console.log('CreateDocumentModal: Found Link components:', linkComponents.length)
    
    linkComponents.forEach((component, index) => {
      console.log(`CreateDocumentModal: Configuring Link component ${index}:`, component)
      
      // Set data attributes on the component
      if (component && typeof component.setAttribute === 'function') {
        const filterData = {
          donor_identity: props.donorFiltering?.donor_identity,
          currency: props.donorFiltering?.currency,
          status: 'Active'
        }
        
        component.setAttribute('data-donor-filters', JSON.stringify(filterData))
        component.setAttribute('data-donor-query', JSON.stringify(getDonorQuery()))
        console.log(`CreateDocumentModal: Set filtering data on Link component ${index}:`, filterData)
      }
    })
    
    // ADD: Find any Autocomplete components (used by Link component)
    const autocompleteComponents = document.querySelectorAll('[data-modal="sub"] .autocomplete')
    console.log('CreateDocumentModal: Found Autocomplete components:', autocompleteComponents.length)
    
    autocompleteComponents.forEach((component, index) => {
      console.log(`CreateDocumentModal: Configuring Autocomplete component ${index}:`, component)
      
      // Set data attributes on the component
      if (component && typeof component.setAttribute === 'function') {
        const filterData = {
          donor_identity: props.donorFiltering?.donor_identity,
          currency: props.donorFiltering?.currency,
          status: 'Active'
        }
        
        component.setAttribute('data-donor-filters', JSON.stringify(filterData))
        component.setAttribute('data-donor-query', JSON.stringify(getDonorQuery()))
        console.log(`CreateDocumentModal: Set filtering data on Autocomplete component ${index}:`, filterData)
      }
    })
    
    // ADD: Force any existing Link components to reload with new filters
    const linkInstances = document.querySelectorAll('[data-modal="sub"] [data-fieldname="donor_id"]')
    console.log('CreateDocumentModal: Found Link instances to force reload:', linkInstances.length)
    
    linkInstances.forEach((instance, index) => {
      console.log(`CreateDocumentModal: Force reloading Link instance ${index}:`, instance)
      
      // Try to trigger a reload on the Link component
      if (instance && instance.reload && typeof instance.reload === 'function') {
        console.log(`CreateDocumentModal: Calling reload() on Link instance ${index}`)
        instance.reload()
      }
    })
  })
}

// ADD: Enhanced watcher to monitor when modal becomes visible and apply donor filtering
watch(() => show.value, (isVisible) => {
  if (isVisible && props.isSubModal) {
    // Emit an event to notify parent that this sub-modal is active
    emit('subModalActive')
    
    // Apply donor filtering immediately when modal becomes visible
    console.log('CreateDocumentModal: Modal became visible, applying donor filtering:', props.donorFiltering)
    
    // Force refresh of tabs to ensure proper filtering
    nextTick(() => {
      if (tabs.reload) {
        tabs.reload()
      }
      
      // Apply filtering to DOM elements after tabs are loaded
      setTimeout(() => {
        applyDonorFilteringToDOM()
      }, 100)
    })
  }
})

// ADD: Function to force refresh tabs
function refreshTabs() {
  console.log('CreateDocumentModal: Manually refreshing tabs')
  if (tabs.reload) {
    tabs.reload()
  }
}

// ADD: Computed key for FieldLayout to force re-rendering when filters change
const fieldLayoutKey = computed(() => {
  const key = `field-layout-${props.donorFiltering?.donor_identity || 'none'}-${props.donorFiltering?.currency || 'none'}-${Date.now()}`
  console.log('CreateDocumentModal: Generated fieldLayoutKey:', key)
  return key
})

// ADD: Force refresh mechanism
const forceRefresh = ref(0)

// ADD: Function to force complete modal refresh
function forceModalRefresh() {
  console.log('CreateDocumentModal: Forcing complete modal refresh')
  forceRefresh.value++
  
  // Force refresh tabs
  if (tabs.reload) {
    tabs.reload()
  }
  
  // Apply DOM filtering after refresh
  nextTick(() => {
    setTimeout(() => {
      applyDonorFilteringToDOM()
    }, 300)
  })
}

// ADD: Watcher that forces refresh when donor filtering changes
watch(() => props.donorFiltering, () => {
  console.log('CreateDocumentModal: Donor filtering changed, forcing modal refresh')
  forceModalRefresh()
}, { deep: true, immediate: true })

// ADD: Function to get filtered donor query based on donor identity
function getDonorQuery() {
  const filters = {
    status: 'Active'
  }
  
  // ADD: Debug logging to see what donor filtering data is received
  console.log('CreateDocumentModal: Received donorFiltering props:', props.donorFiltering)
  
  // Add donor identity filter based on the passed donor filtering
  if (props.donorFiltering?.donor_identity) {
    filters.donor_identity = props.donorFiltering.donor_identity
    console.log('CreateDocumentModal: Adding donor identity filter:', props.donorFiltering.donor_identity)
  } else {
    console.log('CreateDocumentModal: No donor_identity in donorFiltering props')
  }
  
  // Add currency filter if available
  if (props.donorFiltering?.currency) {
    filters.default_currency = props.donorFiltering.currency
  }
  
  console.log('CreateDocumentModal: Final donor query filters:', filters)
  
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

// ADD: Function to create a dynamic donor query function for each field
function createDonorQueryFunction() {
  return function() {
    return getDonorQuery()
  }
}

// ADD: Function to directly inject donor filtering into field configuration
function injectDonorFilteringIntoField(field) {
  console.log('CreateDocumentModal: Injecting donor filtering into field:', field.fieldname)
  
  // Create a new field object with injected filtering
  const injectedField = { ...field }
  
  // Inject the get_query function directly
  injectedField.get_query = () => {
    console.log('CreateDocumentModal: get_query function called for field:', field.fieldname)
    const query = getDonorQuery()
    console.log('CreateDocumentModal: Returning query:', query)
    return query
  }
  
  // Inject filters directly
  injectedField.filters = getDonorFilters()
  
  // Inject link_filters as fallback
  injectedField.link_filters = JSON.stringify(getDonorFilters())
  
  // Set depends_on
  injectedField.depends_on = 'donor_identity'
  
  // Set options and fieldtype
  injectedField.options = 'Donor'
  injectedField.fieldtype = 'Link'
  
  // ADD: Force the field to have the correct structure
  injectedField._forceDonorFiltering = true
  injectedField._donorIdentity = props.donorFiltering?.donor_identity
  injectedField._donorCurrency = props.donorFiltering?.currency
  
  console.log('CreateDocumentModal: Injected field configuration:', {
    fieldname: injectedField.fieldname,
    get_query: typeof injectedField.get_query,
    filters: injectedField.filters,
    link_filters: injectedField.link_filters,
    depends_on: injectedField.depends_on,
    options: injectedField.options,
    fieldtype: injectedField.fieldtype,
    _forceDonorFiltering: injectedField._forceDonorFiltering,
    _donorIdentity: injectedField._donorIdentity,
    _donorCurrency: injectedField._donorCurrency
  })
  
  return injectedField
}

// ADD: Enhanced function to configure donor fields with comprehensive filtering
function configureDonorField(field) {
  console.log('CreateDocumentModal: Configuring donor field:', field.fieldname)
  
  // First try the enhanced configuration
  const enhancedField = { ...field }
  
  // Set the get_query function - this is the key for filtering
  enhancedField.get_query = createDonorQueryFunction()
  
  // Set depends_on to ensure the field reacts to changes
  enhancedField.depends_on = 'donor_identity'
  
  // Set filters for immediate filtering - this should work with FieldLayout
  enhancedField.filters = getDonorFilters()
  
  // ADD: Set additional properties that might be needed
  enhancedField.options = 'Donor'
  enhancedField.fieldtype = 'Link'
  
  // ADD: Set a custom query function that can be called directly
  enhancedField.custom_query = getDonorQuery()
  
  // ADD: Set a unique key to force re-rendering when filters change
  enhancedField._filterKey = `${props.donorFiltering?.donor_identity || 'none'}-${props.donorFiltering?.currency || 'none'}`
  
  // ADD: Set additional filtering properties that might be needed by the FieldLayout
  enhancedField.query = getDonorQuery()
  enhancedField.query_filters = getDonorFilters()
  
  // ADD: Set link_filters as a fallback (some components use this)
  enhancedField.link_filters = JSON.stringify(getDonorFilters())
  
  // ADD: Set a custom onChange handler to ensure filtering is applied
  enhancedField.onChange = function(value) {
    console.log('CreateDocumentModal: Donor field onChange triggered:', value)
    // Force refresh of the field to apply new filtering
    this.$forceUpdate && this.$forceUpdate()
  }
  
  // ADD: Set a custom onFocus handler to apply filtering when field is focused
  enhancedField.onFocus = function() {
    console.log('CreateDocumentModal: Donor field onFocus triggered')
    // Apply filtering when field is focused
    applyDonorFilteringToDOM()
  }
  
  console.log('CreateDocumentModal: Enhanced donor field configuration:', {
    fieldname: enhancedField.fieldname,
    get_query: enhancedField.get_query,
    filters: enhancedField.filters,
    depends_on: enhancedField.depends_on,
    custom_query: enhancedField.custom_query,
    filter_key: enhancedField._filterKey,
    query: enhancedField.query,
    query_filters: enhancedField.query_filters,
    link_filters: enhancedField.link_filters
  })
  
  return enhancedField
}

// ADD: Enhanced tabs with donor filtering
const filteredTabs = computed(() => {
  console.log('CreateDocumentModal: filteredTabs computed property recalculating')
  console.log('CreateDocumentModal: tabs.data available:', !!tabs.data)
  console.log('CreateDocumentModal: donorFiltering props:', props.donorFiltering)
  
  if (!tabs.data || !Array.isArray(tabs.data)) {
    console.log('CreateDocumentModal: No tabs data available, returning empty array')
    return []
  }
  
  console.log('CreateDocumentModal: Processing', tabs.data.length, 'tabs')
  
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
            // Try both approaches to ensure filtering works
            enhancedField = configureDonorField(field)
            enhancedField = injectDonorFilteringIntoField(enhancedField)
            console.log('CreateDocumentModal: Configured donor_id field with comprehensive filtering')
            
            // ADD: Debug logging to show exactly what's being passed to FieldLayout
            console.log('CreateDocumentModal: Final donor_id field configuration for FieldLayout:', {
              fieldname: enhancedField.fieldname,
              fieldtype: enhancedField.fieldtype,
              options: enhancedField.options,
              get_query: typeof enhancedField.get_query,
              filters: enhancedField.filters,
              link_filters: enhancedField.link_filters,
              depends_on: enhancedField.depends_on
            })
          }
          
          // Configure donor fields in items table
          if (field.fieldname === 'donor') {
            // Try both approaches to ensure filtering works
            enhancedField = configureDonorField(field)
            enhancedField = injectDonorFilteringIntoField(enhancedField)
            console.log('CreateDocumentModal: Configured donor field with comprehensive filtering for items')
            
            // ADD: Debug logging to show exactly what's being passed to FieldLayout
            console.log('CreateDocumentModal: Final donor field configuration for FieldLayout:', {
              fieldname: enhancedField.fieldname,
              fieldtype: enhancedField.fieldtype,
              options: enhancedField.options,
              get_query: typeof enhancedField.get_query,
              filters: enhancedField.filters,
              link_filters: enhancedField.link_filters,
              depends_on: enhancedField.depends_on
            })
          }
          
          return enhancedField
        })
        
        return filteredColumn
      })
      
      return filteredSection
    })
    
    return filteredTab
  })
  
  console.log('CreateDocumentModal: Final processed tabs with donor filtering:', processedTabs)
  return processedTabs
})

async function create() {
  loading.value = true
  error.value = null

  await triggerOnBeforeCreate?.()

  let doc = await call(
    'frappe.client.insert',
    {
      doc: {
        doctype: props.doctype,
        ..._data.doc,
      },
    },
    {
      onError: (err) => {
        loading.value = false
        if (err.error) {
          error.value = err.error.messages?.[0]
        }
      },
    },
  )

  loading.value = false
  show.value = false
  emit('callback', doc)
}

watch(
  () => show.value,
  (value) => {
    if (!value) {
      emit('close')
      return
    }

    nextTick(() => {
      _data.doc = { ...props.data }
    })
  },
)

function openQuickEntryModal() {
  showQuickEntryModal.value = true
  quickEntryProps.value = { doctype: props.doctype }
  nextTick(() => (show.value = false))
}

// Ensure parent modal stays visible when this sub-modal is active
watch(show, (isVisible) => {
  if (isVisible && props.isSubModal) {
    // Emit an event to notify parent that this sub-modal is active
    emit('subModalActive')
  }
})

// Emit interaction events when sub-modal is interacted with
const handleSubModalInteraction = () => {
  if (props.isSubModal && show.value) {
    emit('subModalInteraction')
  }
}

// Add event listeners to the modal body to detect interactions
onMounted(() => {
  if (props.isSubModal) {
    nextTick(() => {
      const modalBody = document.querySelector('[data-modal="sub"]')
      if (modalBody) {
        modalBody.addEventListener('click', handleSubModalInteraction)
        modalBody.addEventListener('focus', handleSubModalInteraction)
        modalBody.addEventListener('input', handleSubModalInteraction)
      }
    })
  }
})

// ADD: Function to force apply donor filtering
function forceApplyDonorFiltering() {
  console.log('CreateDocumentModal: Force applying donor filtering')
  
  // Force refresh of tabs
  if (tabs.reload) {
    tabs.reload()
  }
  
  // Force refresh of the modal
  forceRefresh.value++
  
  // Apply DOM filtering after refresh
  nextTick(() => {
    setTimeout(() => {
      applyDonorFilteringToDOM()
      
      // Also force the FieldLayout to re-render
      console.log('CreateDocumentModal: Forcing FieldLayout re-render')
      
      // ADD: Force any existing donor fields to reload
      forceReloadDonorFields()
    }, 300)
  })
}

// ADD: Function to force reload donor fields
function forceReloadDonorFields() {
  console.log('CreateDocumentModal: Force reloading donor fields')
  
  nextTick(() => {
    // Find all donor_id fields and force them to reload
    const donorFields = document.querySelectorAll('[data-modal="sub"] [data-fieldname="donor_id"]')
    console.log('CreateDocumentModal: Found donor fields to force reload:', donorFields.length)
    
    donorFields.forEach((field, index) => {
      console.log(`CreateDocumentModal: Force reloading donor field ${index}:`, field)
      
      // Try to trigger a reload on the field
      if (field && field.reload && typeof field.reload === 'function') {
        console.log(`CreateDocumentModal: Calling reload() on donor field ${index}`)
        field.reload()
      }
      
      // Also try to trigger a change event to force the field to update
      if (field && field.dispatchEvent) {
        const changeEvent = new Event('change', { bubbles: true })
        field.dispatchEvent(changeEvent)
        console.log(`CreateDocumentModal: Dispatched change event on donor field ${index}`)
      }
    })
  })
}

// ADD: Enhanced watcher that forces refresh when donor filtering changes
watch(() => props.donorFiltering, (newDonorFiltering, oldDonorFiltering) => {
  console.log('CreateDocumentModal: donorFiltering props changed:', {
    old: oldDonorFiltering,
    new: newDonorFiltering
  })
  
  // Force apply donor filtering when props change
  forceApplyDonorFiltering()
}, { deep: true, immediate: true })

</script>
