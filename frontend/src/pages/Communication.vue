<template>
  <AppStyling type="page-background" pageType="communication">
    <LayoutHeader>
      <template #left-header>
        <ViewBreadcrumbs v-model="viewControls" routeName="Communication" />
      </template>
      <template #right-header>
        <CustomActions
          v-if="communicationListView?.customListActions"
          :actions="communicationListView.customListActions"
        />
        <AppStyling 
          type="button"
          buttonType="create"
          buttonLabel="Create"
          @click="showCommunicationModal = true"
        >
          <template #prefix><FeatherIcon name="plus" class="h-4" /></template>
        </AppStyling>
      </template>
    </LayoutHeader>

    <ViewControls
      ref="viewControls"
      v-model="communications"
      v-model:loadMore="loadMore"
      v-model:resizeColumn="triggerResize"
      v-model:updatedPageCount="updatedPageCount"
      doctype="Communication"
      :filters="{}"
      :options="{ allowedViews: ['list'] }"
      @list-refreshed="handleListRefreshed"
    />

    <CommunicationListView
      ref="communicationListView"
      v-if="communications.data && rows.length > 0"
      v-model:list="communications"
      v-model:pageLengthCount="communications.data.page_length_count"
      :rows="rows"
      :columns="communications.data.columns"
      :options="{
        showTooltip: false,
        resizeColumn: true,
        rowCount: communications.data.row_count || 0,
        totalCount: communications.data.total_count || 0,
      }"
      @loadMore="() => loadMore++"
      @columnWidthUpdated="() => triggerResize++"
      @updatePageCount="(count) => (updatedPageCount = count)"
      @applyFilter="(data) => viewControls?.applyFilter?.(data)"
      @applyLikeFilter="(data) => viewControls?.applyLikeFilter?.(data)"
      @likeDoc="(data) => viewControls?.likeDoc?.(data)"
      @selectionsChanged="(selections) => viewControls?.updateSelections?.(selections)"
    />

    <div v-else-if="communications.data" class="flex h-full items-center justify-center">
      <div class="flex flex-col items-center gap-3 text-xl font-medium text-ink-gray-4">
        <span>{{ __('No {0} Found', [__('Communications')]) }}</span>
        <Button :label="__('Create Communication')" @click="showCommunicationModal = true">
          <template #prefix><FeatherIcon name="plus" customClass="h-4" /></template>
        </Button>
      </div>
    </div>

    <div v-else class="flex h-full items-center justify-center">
      <div class="flex flex-col items-center gap-3 text-xl font-medium text-ink-gray-4">
        <span>Loading Communications...</span>
      </div>
    </div>

    <CommunicationModal
      v-if="showCommunicationModal"
      v-model="showCommunicationModal"
      :defaults="defaults"
      :options="{ afterInsert: () => communications.reload() }"
      @communication-created="handleCommunicationCreated"
      @communication-deleted="handleCommunicationDeleted"
    />
  </AppStyling>
</template>

<script>
export default {
  name: "Communication"
}
</script>

<script setup>
import LayoutHeader from '@/components/LayoutHeader.vue'
import CommunicationListView from '@/components/ListViews/CommunicationListView.vue'
import CommunicationModal from '@/components/Modals/CommunicationModal.vue' 
import ViewControls from '@/components/ViewControls.vue'
import ViewBreadcrumbs from '@/components/ViewBreadcrumbs.vue'
import FeatherIcon from '@/components/Icons/FeatherIcon.vue'
import CustomActions from '@/components/CustomActions.vue'
import { ref, reactive, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppStyling from '@/components/AppStyling.vue'
import { Button } from 'frappe-ui'
import { formatDate, timeAgo } from '@/utils'
import { statusesStore } from '@/stores/statuses'

const showCommunicationModal = ref(false)
const loadMore = ref(1)
const triggerResize = ref(1)
const updatedPageCount = ref(20)
const defaults = reactive({})
const viewControls = ref(null)
const communicationListView = ref(null)
const communications = ref({})

function parseRows(list, columns = []) {
  if (!Array.isArray(list)) return []
  return list.map((doc, index) => {
    let _rows = {}
    // use backend-provided row keys for consistency when available
    const keys = communications.value?.data?.rows || []
    keys.forEach((rowKey) => {
      let value = doc[rowKey]
      if (['modified', 'creation'].includes(rowKey)) {
        value = {
          label: formatDate(doc[rowKey]),
          timeAgo: __(timeAgo(doc[rowKey])),
        }
      } else if (rowKey === 'status') {
        const { getCommunicationStatus } = statusesStore()
        const statusInfo = getCommunicationStatus(doc.status)
        value = {
          label: doc.status,
          color: statusInfo.color || 'text-gray-500',
        }
      } else if (rowKey === '_assign') {
        try {
          const assignees = JSON.parse(doc._assign || '[]')
          value = assignees.map((user) => ({
            name: user,
            image: (communications.value?.data?.users || {})[user]?.user_image,
            label: (communications.value?.data?.users || {})[user]?.full_name,
          }))
        } catch (e) {
          value = []
        }
      }
      _rows[rowKey] = value
    })
    // derive a reliable identifier for routing; keep synthetic key for rendering only
    const realIdentifier =
      doc.name ||
      doc.communication_name ||
      doc.communication_id ||
      doc.docname ||
      doc.document_name ||
      doc.id ||
      null

    _rows.name = doc.name || doc.id || `${doc.subject || 'comm'}-${index}`
    _rows.nameForRouting = realIdentifier
    return _rows
  })
}

const rows = computed(() => {
  if (!communications.value?.data?.data) return []
  return parseRows(communications.value.data.data, communications.value.data.columns)
})

const handleListRefreshed = () => communications.value?.reload?.()
const handleCommunicationCreated = () => communications.value?.reload?.()
const handleCommunicationDeleted = () => communications.value?.reload?.()
const refreshCommunicationsList = () => viewControls.value?.reload?.()

const route = useRoute()
const router = useRouter()

watch(() => route.query.refresh, (newRefresh) => {
  if (newRefresh) {
    refreshCommunicationsList()
    router.replace({ name: 'Communication', query: {} })
  }
}, { immediate: true })

const breadcrumbs = computed(() => {
  if (route.params.communicationId) {
    let communicationName = route.params.communicationId
    if (communications.value?.data?.data) {
      const found = communications.value.data.data.find(d => d.name === route.params.communicationId)
      if (found?.subject) communicationName = found.subject
    }
    return [
      { label: __('Communication'), route: { name: 'Communication' } },
      { label: communicationName, route: { name: 'CommunicationDetail', params: { communicationId: route.params.communicationId } } }
    ]
  }
  return [
    { label: __('Communication'), route: { name: 'Communication' } },
    { label: __('List'), route: { name: 'Communication' } }
  ]
})
</script>
