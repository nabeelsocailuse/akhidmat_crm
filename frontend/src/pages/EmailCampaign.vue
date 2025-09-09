<template>
  <AppStyling type="page-background" pageType="email-campaign">
    <LayoutHeader>
      <template #left-header>
        <ViewBreadcrumbs v-model="viewControls" routeName="Email Campaign" :viewType="emailCampaigns?.data?.view_type || 'list'" />
      </template>
      <template #right-header>
        <CustomActions
          v-if="emailCampaignListView?.customListActions"
          :actions="emailCampaignListView.customListActions"
        />
        <AppStyling
          type="button"
          buttonType="create"
          buttonLabel="Create"
          @click="showEmailCampaignModal = true"
        >
          <template #prefix><FeatherIcon name="plus" class="h-4 w-4 text-white" /></template>
        </AppStyling>
      </template>
    </LayoutHeader>
    <ViewControls
      ref="viewControls"
      v-model="emailCampaigns"
      v-model:loadMore="loadMore"
      v-model:resizeColumn="triggerResize"
      v-model:updatedPageCount="updatedPageCount"
      doctype="Email Campaign"
      :filters="{}"
      :options="{
        allowedViews: ['list', 'group_by', 'kanban'],
        hideColumnsButton: false,
      }"
      @list-refreshed="handleListRefreshed"
    />
    <EmailCampaignListView
      ref="emailCampaignListView"
      v-if="emailCampaigns.data && rows.length > 0"
      v-model="emailCampaigns"
      v-model:pageLengthCount="emailCampaigns.data.page_length_count"
      :rows="rows"
      :columns="emailCampaigns.data.columns"
      :options="{
        showTooltip: false,
        resizeColumn: true,
        rowCount: emailCampaigns.data.row_count || 0,
        totalCount: emailCampaigns.data.total_count || 0,
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
    <div v-else-if="emailCampaigns.data" class="flex h-full items-center justify-center">
      <div
        class="flex flex-col items-center gap-3 text-xl font-medium text-ink-gray-4"
      >
        <span>{{ __('No {0} Found', [__('Email Campaigns')]) }}</span>
        <Button :label="__('Create Email Campaign')" @click="showEmailCampaignModal = true">
          <template #prefix><FeatherIcon name="plus" customClass="h-4" /></template>
        </Button>
      </div>
    </div>
    <EmailCampaignModal
      v-if="showEmailCampaignModal"
      v-model="showEmailCampaignModal"
      :defaults="defaults"
      :options="{ afterInsert: () => emailCampaigns.reload() }"
      @email-campaign-created="handleEmailCampaignCreated"
      @email-campaign-deleted="handleEmailCampaignDeleted"
    />
  </AppStyling>
</template>

<script>
export default {
  name: "Email Campaign"
}
</script>

<script setup>
import LayoutHeader from '@/components/LayoutHeader.vue'
import EmailCampaignListView from '@/components/ListViews/EmailCampaignListView.vue'
import EmailCampaignModal from '@/components/Modals/EmailCampaignModal.vue'
import ViewControls from '@/components/ViewControls.vue'
import ViewBreadcrumbs from '@/components/ViewBreadcrumbs.vue'
import FeatherIcon from '@/components/Icons/FeatherIcon.vue'
import CustomActions from '@/components/CustomActions.vue'
import { ref, reactive, computed, watch, nextTick, onMounted } from 'vue'
import { showQuickEntryModal, quickEntryProps } from '@/composables/modals'
import FieldLayoutEditor from '@/components/FieldLayoutEditor.vue'
import { useRoute, useRouter } from 'vue-router'
import { formatDate, timeAgo } from '@/utils'
import { getMeta } from '@/stores/meta'
import { statusesStore } from '@/stores/statuses'
import { Button } from 'frappe-ui'

const route = useRoute()
const router = useRouter()

const { getEmailCampaignStatus } = statusesStore()

const showEmailCampaignModal = ref(false)
const emailCampaignListView = ref(null)
const viewControls = ref(null)
const loadMore = ref(0)
const triggerResize = ref(0)
const updatedPageCount = ref(0)

const defaults = reactive({})

// emailCampaigns data is loaded in the ViewControls component
const emailCampaigns = ref({})

// Rows computed property similar to Leads page
const rows = computed(() => {
  if (!emailCampaigns.value?.data?.data) return []
  if (emailCampaigns.value.data.view_type === 'group_by') {
    if (!emailCampaigns.value?.data.group_by_field?.fieldname) return []
    return getGroupedByRows(
      emailCampaigns.value?.data.data,
      emailCampaigns.value?.data.group_by_field,
      emailCampaigns.value.data.columns,
    )
  } else if (emailCampaigns.value.data.view_type === 'kanban') {
    return getKanbanRows(emailCampaigns.value.data.data, emailCampaigns.value.data.fields)
  } else {
    return parseRows(emailCampaigns.value?.data.data, emailCampaigns.value.data.columns)
  }
})

function getGroupedByRows(listRows, groupByField, columns) {
  let groupedRows = []

  groupByField.options?.forEach((option) => {
    let filteredRows = []

    if (!option) {
      filteredRows = listRows.filter((row) => !row[groupByField.fieldname])
    } else {
      filteredRows = listRows.filter(
        (row) => row[groupByField.fieldname] == option,
      )
    }

    let groupDetail = {
      label: groupByField.label,
      group: option || __(' '),
      collapsed: false,
      rows: parseRows(filteredRows, columns),
    }
    groupedRows.push(groupDetail)
  })

  return groupedRows || listRows
}

function getKanbanRows(data, columns) {
  let _rows = []
  data.forEach((column) => {
    column.data?.forEach((row) => {
      _rows.push(row)
    })
  })
  return parseRows(_rows, columns)
}

function parseRows(rows, columns = []) {
  let view_type = emailCampaigns.value.data.view_type
  let key = view_type === 'kanban' ? 'fieldname' : 'key'
  let type = view_type === 'kanban' ? 'fieldtype' : 'type'

  return rows.map((emailCampaign) => {
    let _rows = {}
    emailCampaigns.value?.data.rows.forEach((row) => {
      _rows[row] = emailCampaign[row]

      let fieldType = columns?.find((col) => (col[key] || col.value) == row)?.[
        type
      ]

      if (
        fieldType &&
        ['Date', 'Datetime'].includes(fieldType) &&
        !['modified', 'creation'].includes(row)
      ) {
        _rows[row] = formatDate(emailCampaign[row], '', true, fieldType == 'Datetime')
      }

      if (row == 'campaign_name') {
        _rows[row] = {
          label: emailCampaign.campaign_name,
          image: emailCampaign.image,
          image_label: emailCampaign.campaign_name,
        }
      } else if (row == 'status') {
        const statusInfo = getEmailCampaignStatus(emailCampaign.status)
        _rows[row] = {
          label: emailCampaign.status,
          color: statusInfo.color,
        }
      } else if (row == 'start_date' || row == 'end_date') {
        _rows[row] = {
          label: emailCampaign[row] ? formatDate(emailCampaign[row]) : '',
          timeAgo: emailCampaign[row] ? __(timeAgo(emailCampaign[row])) : '',
        }
      } else if (row == 'enabled') {
        _rows[row] = {
          label: emailCampaign.enabled ? 'Enable' : 'Disable',
        }
      } else if (['modified', 'creation'].includes(row)) {
        _rows[row] = {
          label: formatDate(emailCampaign[row]),
          timeAgo: __(timeAgo(emailCampaign[row])),
        }
      }
    })
    return _rows
  })
}


function handleListRefreshed() {
  // Handle list refresh if needed
}

function handleEmailCampaignCreated(emailCampaign) {
  // Handle email campaign creation
  // Note: The modal will handle redirection to detail page
  // We don't need to reload the list here since we're leaving the page
  console.log('Email campaign created:', emailCampaign)
}

function handleEmailCampaignDeleted(emailCampaign) {
  // Handle email campaign deletion
  emailCampaigns.reload()
}
</script>