<template>
  <AppStyling type="page-background" pageType="donor">
    <LayoutHeader>
      <template #left-header>
        <ViewBreadcrumbs v-model="viewControls" routeName="Donor" />
      </template>
      <template #right-header>
        <CustomActions
          v-if="donorListView?.customListActions"
          :actions="donorListView.customListActions"
        />
        <AppStyling
          type="button"
          buttonType="create"
          buttonLabel="Create"
          @click="showDonorModal = true"
        >
          <template #prefix><FeatherIcon name="plus" class="h-4" /></template>
        </AppStyling>
      </template>
    </LayoutHeader>

    <ViewControls
      ref="viewControls"
      v-model="donors"
      v-model:loadMore="loadMore"
      v-model:resizeColumn="triggerResize"
      v-model:updatedPageCount="updatedPageCount"
      doctype="Donor"
      :filters="{}"
      :options="{
        allowedViews: ['list', 'group_by', 'kanban'],
      }"
      @list-refreshed="handleListRefreshed"
    />
    
    <DonorListView
      ref="donorListView"
      v-if="donors.data && rows.length > 0"
      v-model:list="donors"
      v-model:pageLengthCount="donors.data.page_length_count"
      :rows="rows"
      :columns="donors.data.columns"
      :options="{
        showTooltip: false,
        resizeColumn: true,
        rowCount: donors.data.row_count || 0,
        totalCount: donors.data.total_count || 0,
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
    <div v-else-if="donors.data" class="flex h-full items-center justify-center">
      <div
        class="flex flex-col items-center gap-3 text-xl font-medium text-ink-gray-4"
      >
        <span>{{ __('No {0} Found', [__('Donors')]) }}</span>
        <Button :label="__('Create Donor')" @click="showDonorModal = true">
          <template #prefix><FeatherIcon name="plus" customClass="h-4" /></template>
        </Button>
      </div>
    </div>
    <DonorModal
      v-if="showDonorModal"
      v-model="showDonorModal"
      :defaults="defaults"
      :options="{ afterInsert: () => donors.reload() }"
      @donor-created="handleDonorCreated"
      @donor-deleted="handleDonorDeleted"
    />
  </AppStyling>
</template>

<script>
export default {
  name: "Donor"
}
</script>

<script setup>
import { defineAsyncComponent } from 'vue'
import { ref, reactive, computed, watch, nextTick, onMounted } from 'vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import LayoutHeader from '@/components/LayoutHeader.vue'
import ViewControls from '@/components/ViewControls.vue'
import ViewBreadcrumbs from '@/components/ViewBreadcrumbs.vue'
import FeatherIcon from '@/components/Icons/FeatherIcon.vue'
import CustomActions from '@/components/CustomActions.vue'
import { showQuickEntryModal, quickEntryProps } from '@/composables/modals'
import FieldLayoutEditor from '@/components/FieldLayoutEditor.vue'
import { useRoute, useRouter } from 'vue-router'
import { formatDate, timeAgo } from '@/utils'
import { statusesStore } from '@/stores/statuses'
import { getMeta } from '@/stores/meta'
import { usersStore } from '@/stores/users'
import AppStyling from '@/components/AppStyling.vue'
import { Button } from 'frappe-ui'

const DonorListView = defineAsyncComponent({
  loader: () => import('@/components/ListViews/DonorListView.vue'),
  loadingComponent: LoadingSpinner,
})
const DonorModal = defineAsyncComponent({
  loader: () => import('@/components/Modals/DonorModal.vue'),
  loadingComponent: LoadingSpinner,
})

const { getFormattedPercent, getFormattedFloat, getFormattedCurrency } =
  getMeta('Donor')

const { getUser } = usersStore()

// Add missing functions
const handleListRefreshed = () => {
  // Refresh the donors list
  if (donors.reload) {
    donors.reload()
  }
}

const handleDonorCreated = () => {
  if (donors.reload) {
    donors.reload()
  }
}

const handleDonorDeleted = () => {
  if (donors.reload) {
    donors.reload()
  }
}

// Function to refresh the donors list - can be called from ViewControls
const refreshDonorsList = () => {
  if (viewControls.value && viewControls.value.reload) {
    viewControls.value.reload()
  }
}

const showDonorModal = ref(false)
const loadMore = ref(1)
const triggerResize = ref(1)
const updatedPageCount = ref(20)
const defaults = reactive({})
const viewControls = ref(null)
const donorListView = ref(null)

// Use standard ViewControls data binding
const donors = ref({})

const rows = computed(() => {
  if (!donors.value?.data?.data) {
    return []
  }
  
  return parseRows(donors.value.data.data, [])
})

function parseRows(rows, columns = []) {
  if (!rows || !Array.isArray(rows)) {
    return []
  }
  
  // Define the fields we want to display - matching the backend controller's default_list_data
  const displayFields = [
    'name',
    'cnic',
    'contact_no',
    'donor_name', 
    'organization',
    'status',
    'email',
    'mobile_no',
    'donor_owner',
    'donor_type',
    'department',
    'first_name',
    'sla_status',
    'response_by',
    'first_response_time',
    'first_responded_on',
    'modified',
    '_assign',
    'image'
  ]
  
  return rows.map((donor, index) => {
    let _rows = {}
    
    displayFields.forEach((field) => {
      if (donor.hasOwnProperty(field)) {
        _rows[field] = donor[field]

        if (field == 'donor_name') {
          _rows[field] = {
            label: donor.donor_name,
            image: donor.image,
            image_label: donor.donor_name,
          }
        } else if (field == 'status') {
          const { getDonorStatus } = statusesStore()
          const statusInfo = getDonorStatus(donor.status)
          _rows[field] = {
            label: donor.status,
            color: statusInfo.color || (donor.status === 'Active' ? 'text-green-500' : 'text-red-500'),
          }
        } else if (field == '_assign') {
          try {
            let assignees = JSON.parse(donor._assign || '[]')
            _rows[field] = assignees.map((user) => ({
              name: user,
              image: getUser(user).user_image,
              label: getUser(user).full_name,
            }))
          } catch (e) {
            _rows[field] = []
          }
        } else if (['modified', 'creation', 'first_response_time', 'first_responded_on'].includes(field)) {
          _rows[field] = {
            label: formatDate(donor[field]),
            timeAgo: __(timeAgo(donor[field])),
          }
        }
      }
    })
    return _rows
  })
}

const route = useRoute()
const router = useRouter()

// Watch for refresh parameter and reload the list if present
watch(() => route.query.refresh, (newRefresh) => {
  if (newRefresh) {
    // Refresh the donors list
    refreshDonorsList()
    // Clear the refresh parameter from URL
    router.replace({ 
      name: 'Donor',
      query: {} 
    })
  }
}, { immediate: true })

const breadcrumbs = computed(() => {
  // If on detail view, show Donor/Donor Name
  if (route.params.donorId) {
    // Try to find the donor name from the donors list
    let donorName = route.params.donorId
    if (donors.value?.data?.data) {
      const found = donors.value.data.data.find(d => d.name === route.params.donorId)
      if (found && found.donor_name) donorName = found.donor_name
    }
    return [
      { label: __('Donor'), route: { name: 'Donor' } },
      { label: donorName, route: { name: 'DonorDetail', params: { donorId: route.params.donorId } } }
    ]
  }
  // On list view, show Donor/List
  return [
    { label: __('Donor'), route: { name: 'Donor' } },
    { label: __('List'), route: { name: 'Donor' } }
  ]
})
</script>