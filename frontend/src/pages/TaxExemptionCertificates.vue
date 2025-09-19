<template>
  <AppStyling type="list-background" class="min-h-screen">
    <LayoutHeader>
      <template #left-header>
        <ViewBreadcrumbs :items="breadcrumbs" />
      </template>
      <template #right-header>
        <CustomActions
          v-if="certificatesListView?.customListActions"
          :actions="certificatesListView.customListActions"
        />
        <AppStyling
          type="button"
          buttonType="create"
          buttonLabel="Create"
          @click="showCertificateModal = true"
        >
          <template #prefix><FeatherIcon name="plus" class="h-4 w-4 text-white" /></template>
        </AppStyling>
      </template>
    </LayoutHeader>

    <ViewControls
      ref="viewControls"
      v-model="certificates"
      v-model:loadMore="loadMore"
      v-model:resizeColumn="triggerResize"
      v-model:updatedPageCount="updatedPageCount"
      doctype="Tax Exemption Certificate"
    />

    <div v-if="certificates.data && rows.length" class="flex h-full overflow-hidden">
      <TaxExemptionCertificateListView
        ref="certificatesListView"
        v-model="certificates.data.page_length_count"
        v-model:list="certificates"
        :rows="rows"
        :columns="certificates.data.columns"
        :options="{
          showTooltip: false,
          resizeColumn: true,
          rowCount: certificates.data.row_count,
          totalCount: certificates.data.total_count,
        }"
        @loadMore="() => loadMore++"
        @columnWidthUpdated="() => triggerResize++"
        @updatePageCount="(count) => (updatedPageCount = count)"
        @applyFilter="(data) => viewControls.applyFilter(data)"
        @applyLikeFilter="(data) => viewControls.applyLikeFilter(data)"
        @likeDoc="(data) => viewControls.likeDoc(data)"
        @selectionsChanged="(selections) => viewControls.updateSelections(selections)"
      />
    </div>
    <div v-else-if="certificates.data" class="flex h-full items-center justify-center">
      <div
        class="flex flex-col items-center gap-3 text-xl font-medium text-ink-gray-4"
      >
        <NoteIcon class="h-10 w-10" />
        <span>{{ __('No {0} Found', [__('Tax Exemption Certificates')]) }}</span>
        <Button :label="__('Create')" @click="showCertificateModal = true">
          <template #prefix><FeatherIcon name="plus" class="h-4" /></template>
        </Button>
      </div>
    </div>
    <TaxExemptionCertificateModal
      v-if="showCertificateModal"
      v-model="showCertificateModal"
      :defaults="defaults"
    />
  </AppStyling>
</template>

<script setup>
import ViewBreadcrumbs from '@/components/ViewBreadcrumbs.vue'
import CustomActions from '@/components/CustomActions.vue'
import NoteIcon from '@/components/Icons/NoteIcon.vue'
import LayoutHeader from '@/components/LayoutHeader.vue'
import TaxExemptionCertificateListView from '@/components/ListViews/TaxExemptionCertificateListView.vue'
import TaxExemptionCertificateModal from '@/components/Modals/TaxExemptionCertificateModal.vue'
import ViewControls from '@/components/ViewControls.vue'
import { getMeta } from '@/stores/meta'
import { globalStore } from '@/stores/global'
import { usersStore } from '@/stores/users'
import { formatDate, timeAgo, website, formatTime } from '@/utils'
import { Avatar, Tooltip, Dropdown, Button, FeatherIcon } from 'frappe-ui'
import { useRoute } from 'vue-router'
import { ref, computed, reactive, h, onMounted, onUnmounted } from 'vue'
import AppStyling from '@/components/AppStyling.vue'

const { getFormattedPercent, getFormattedFloat, getFormattedCurrency } =
  getMeta('Tax Exemption Certificate')
const { makeCall } = globalStore()
const { getUser } = usersStore()

const route = useRoute()

const certificatesListView = ref(null)
const showCertificateModal = ref(false)

const defaults = reactive({})

// certificates data is loaded in the ViewControls component
const certificates = ref({})
const loadMore = ref(1)
const triggerResize = ref(1)
const updatedPageCount = ref(20)
const selections = ref([])
const viewControls = ref(null)

const breadcrumbs = computed(() => [
  { label: __('Tax Exemption Certificates'), route: { name: 'TaxExemptionCertificates' } },
])

const rows = computed(() => {
  if (!certificates.value?.data?.data) return []
  // Simple pass-through; columns come from server via ViewControls
  return certificates.value.data.data
})

onMounted(() => {
  // Initialize any required data
})

onUnmounted(() => {
  // Cleanup if needed
})
</script>

<style>
/* Add any specific styles here */
</style>
