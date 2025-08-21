<template>
  <AppStyling type="page-background" pageType="donor">
    <LayoutHeader>
      <template #left-header>
        <ViewBreadcrumbs v-model="viewControls" routeName="Donation" />
      </template>
      <template #right-header>
        <CustomActions
          v-if="donationListView?.customListActions"
          :actions="donationListView.customListActions"
        />
        <AppStyling
          type="button"
          buttonType="create"
          buttonLabel="Create"
          @click="showDonationModal = true"
        >
          <template #prefix><FeatherIcon name="plus" class="h-4" /></template>
        </AppStyling>
      </template>
    </LayoutHeader>
  
  <!-- Debug info - remove this after fixing -->
  <div v-if="isDev" class="p-4 bg-yellow-100 border border-yellow-300 rounded m-4">
    <h3 class="font-bold">Debug Info:</h3>
    <p>Donations data: {{ JSON.stringify(donations, null, 2) }}</p>
    <p>Rows length: {{ rows.length }}</p>
    <p>Has data: {{ !!donations.data }}</p>
    <p>Columns: {{ donations.data?.columns?.length || 0 }}</p>
    <p>Data array: {{ donations.data?.data?.length || 0 }}</p>
  </div>
  
  <ViewControls
    ref="viewControls"
    v-model="donations"
    v-model:loadMore="loadMore"
    v-model:resizeColumn="triggerResize"
    v-model:updatedPageCount="updatedPageCount"
    doctype="Donation"
    :filters="currentFilters"
    :options="{ 
      allowedViews: ['list'],
      hideColumnsButton: false,
    }"
    @list-refreshed="handleListRefreshed"
    @filter-update="handleViewControlsFilterUpdate"
  />
  
  <DonationListView
    ref="donationListView"
    v-if="donations.data && rows.length > 0"
    v-model:list="donations"
    v-model:pageLengthCount="donations.data.page_length_count"
    :rows="rows"
    :columns="donations.data.columns"
    :options="{
      showTooltip: false,
      resizeColumn: true,
      rowCount: donations.data.row_count || 0,
      totalCount: donations.data.total_count || 0,
    }"
    @loadMore="() => loadMore++"
    @columnWidthUpdated="() => triggerResize++"
    @updatePageCount="(count) => (updatedPageCount = count)"
    @applyFilter="(data) => viewControls?.applyFilter?.(data)"
    @applyLikeFilter="(data) => viewControls?.applyLikeFilter?.(data)"
    @likeDoc="(data) => viewControls?.likeDoc?.(data)"
    @selectionsChanged="
      (selections) => viewControls?.updateSelections?.(selections)
    "
  />
  
  <div v-else-if="donations.data" class="flex h-full items-center justify-center">
    <div
      class="flex flex-col items-center gap-3 text-xl font-medium text-ink-gray-4"
    >
      <span>{{ __('No {0} Found', [__('Donations')]) }}</span>
      <Button :label="__('Create Donation')" @click="showDonationModal = true">
        <template #prefix><FeatherIcon name="plus" customClass="h-4" /></template>
      </Button>
    </div>
  </div>
  
  <DonationModal
    v-if="showDonationModal"
    v-model="showDonationModal"
    :defaults="defaults"
    :options="{ afterInsert: () => donations.reload() }"
    @donation-created="handleDonationCreated"
    @donation-deleted="handleDonationDeleted"
  />
  </AppStyling>
</template>

<script>
const __ = (text) => text
export default {
  name: "Donation"
}
</script>

<script setup>
import LayoutHeader from '@/components/LayoutHeader.vue'
import DonationListView from '@/components/ListViews/DonationListView.vue'
import DonationModal from '@/components/Modals/DonationModal.vue'
import ViewControls from '@/components/ViewControls.vue'
import ViewBreadcrumbs from '@/components/ViewBreadcrumbs.vue'
import FeatherIcon from '@/components/Icons/FeatherIcon.vue'
import CustomActions from '@/components/CustomActions.vue'
import { ref, reactive, computed, watch, onMounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { formatDate, timeAgo } from '@/utils'
import { getMeta } from '@/stores/meta'
import { usersStore } from '@/stores/users'
import AppStyling from '@/components/AppStyling.vue'

const { getFormattedPercent, getFormattedFloat, getFormattedCurrency } =
  getMeta('Donation')

const { getUser } = usersStore()

const showDonationModal = ref(false)
const donations = ref({})
const loadMore = ref(1)
const triggerResize = ref(1)
const updatedPageCount = ref(20)
const defaults = reactive({})
const viewControls = ref(null)
const donationListView = ref(null)

// Create a computed property for development mode
const isDev = computed(() => import.meta.env.DEV)

// Add filter state tracking
const currentFilters = ref({})

// Set current date and time when opening the modal
watch(showDonationModal, (val) => {
  if (val) {
    const now = new Date()
    defaults.posting_date = now.toISOString().slice(0, 10) // YYYY-MM-DD
    defaults.posting_time = now.toTimeString().slice(0, 5) // HH:MM
  }
})

// Add watcher to debug data changes
watch(donations, (newVal) => {
  console.log('Donations data changed:', newVal)
  if (newVal?.data) {
    console.log('Data structure:', {
      hasData: !!newVal.data.data,
      dataLength: newVal.data.data?.length || 0,
      hasColumns: !!newVal.data.columns,
      columnsLength: newVal.data.columns?.length || 0,
      columns: newVal.data.columns
    })
  }
}, { deep: true })

// Add watcher for filters
watch(currentFilters, (newFilters) => {
  console.log('Filters changed:', newFilters)
}, { deep: true })

const rows = computed(() => {
  console.log('Computing rows, donations:', donations.value)
  
  if (!donations.value?.data?.data) {
    console.log('No donations data available')
    return []
  }
  
  console.log('Parsing rows with data:', donations.value.data.data)
  
  // Use the same simple approach as Donor - don't try to parse columns dynamically
  return parseRows(donations.value.data.data, [])
})

function parseRows(rows, columns = []) {
  if (!rows || !Array.isArray(rows)) {
    console.log('Invalid rows data:', rows)
    return []
  }
  
  console.log('Parsing rows:', rows.length)
  
  // Define the fields we want to display - matching the backend controller's default_list_data
  const displayFields = [
    'name',
    'donor_identity',
    'company',
    'contribution_type',
    'status',
    'amount',
    'posting_date',
    'modified',
    '_assign',
    'image'
  ]
  
  return rows.map((donation, index) => {
    let _rows = {}
    
    displayFields.forEach((field) => {
      if (donation.hasOwnProperty(field)) {
        _rows[field] = donation[field]

        if (field == 'donor_identity') {
          _rows[field] = {
            label: donation.donor_identity,
            image: donation.image,
            image_label: donation.donor_identity,
          }
        } else if (field == 'status') {
          _rows[field] = {
            label: donation.status,
            color: donation.status === 'Active' ? 'green' : 'red',
          }
        } else if (field == '_assign') {
          try {
            let assignees = JSON.parse(donation._assign || '[]')
            _rows[field] = assignees.map((user) => ({
              name: user,
              image: getUser(user).user_image,
              label: getUser(user).full_name,
            }))
          } catch (e) {
            console.warn('Failed to parse _assign for donation:', donation.name, e)
            _rows[field] = []
          }
        } else if (['modified', 'creation', 'posting_date'].includes(field)) {
          _rows[field] = {
            label: formatDate(donation[field]),
            timeAgo: __(timeAgo(donation[field])),
          }
        } else if (field == 'amount') {
          // Format amount as currency
          if (donation[field]) {
            _rows[field] = getFormattedCurrency(field, donation)
          }
        }
      }
    })
    
    console.log(`Parsed row ${index}:`, _rows)
    return _rows
  })
}

const handleListRefreshed = () => {
  console.log('List refreshed event received')
  // Refresh the donations list
  if (donations.value && donations.value.reload) {
    donations.value.reload()
  }
}

const handleDonationCreated = () => {
  // The afterInsert callback should handle the refresh automatically
}

const handleDonationDeleted = () => {
  // Refresh the donations list
  if (donations.value && donations.value.reload) {
    donations.value.reload()
  }
}

// Add filter handling function
const handleFilterUpdate = (filters) => {
  console.log('Filter update received:', filters)
  currentFilters.value = filters
  
  // Force a reload with new filters
  if (viewControls.value && viewControls.value.reload) {
    console.log('Forcing reload with new filters')
    viewControls.value.reload()
  }
}

// Add method to handle filter updates from ViewControls
const handleViewControlsFilterUpdate = (filters) => {
  console.log('ViewControls filter update:', filters)
  currentFilters.value = filters
}

// Add method to handle filter updates from Filter component
const handleFilterComponentUpdate = (filters) => {
  console.log('Filter component update:', filters)
  currentFilters.value = filters
  
  // Update the ViewControls filters
  if (viewControls.value) {
    // Force a reload to apply the new filters
    setTimeout(() => {
      if (viewControls.value.reload) {
        viewControls.value.reload()
      }
    }, 100)
  }
}

const route = useRoute()

const breadcrumbs = computed(() => {
  // If on detail view, show Donation/Donation Name (title if available)
  if (route.params.donationId) {
    let donationName = route.params.donationId
    if (donations.value?.data?.data) {
      const found = donations.value.data.data.find(d => d.name === route.params.donationId)
      if (found && found.title) donationName = found.title
    }
    return [
      { label: __('Donation'), route: { name: 'Donation' } },
      { label: donationName, route: { name: 'DonationDetail', params: { donationId: route.params.donationId } } }
    ]
  }
  // On list view, show Donation/Donation
  return [
    { label: __('Donation'), route: { name: 'Donation' } },
    { label: __('List'), route: { name: 'Donation' } }
  ]
})

// Add onMounted to check initial state
onMounted(async () => {
  console.log('Donation component mounted')
  console.log('Initial donations value:', donations.value)
  
  // Wait for the next tick to ensure ViewControls is mounted
  await nextTick()
  
  // Check if ViewControls is working
  setTimeout(() => {
    console.log('After timeout - donations:', donations.value)
    if (viewControls.value) {
      console.log('ViewControls ref available')
      
      // Force a reload to see if data comes through
      if (viewControls.value.reload) {
        console.log('Forcing reload...')
        viewControls.value.reload()
      }
    } else {
      console.log('ViewControls ref not available')
    }
  }, 1000)
})
</script>