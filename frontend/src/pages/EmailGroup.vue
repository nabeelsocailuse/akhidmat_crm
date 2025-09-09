<template>
  <AppStyling type="page-background" pageType="email-group">
    <LayoutHeader>
      <template #left-header>
        <ViewBreadcrumbs
          v-model="viewControls"
          routeName="Email Group"
          :viewType="emailGroups?.data?.view_type || 'list'"
          :basePath="'/email-group'"
        />
      </template>
      <template #right-header>
        <CustomActions
          v-if="emailGroupListView?.customListActions"
          :actions="emailGroupListView.customListActions"
        />
        <AppStyling
          type="button"
          buttonType="create"
          buttonLabel="Create"
          @click="showEmailGroupModal = true"
        >
          <template #prefix><FeatherIcon name="plus" class="h-4 w-4 text-white" /></template>
        </AppStyling>
      </template>
    </LayoutHeader>

    <ViewControls
      ref="viewControls"
      v-model="emailGroups"
      v-model:loadMore="loadMore"
      v-model:resizeColumn="triggerResize"
      v-model:updatedPageCount="updatedPageCount"
      doctype="Email Group"
      :filters="{}"
      :options="{
        allowedViews: ['list', 'group_by', 'kanban'],
        basePath: '/email-group'
      }"
      @list-refreshed="handleListRefreshed"
    />
    
    <EmailGroupListView
      ref="emailGroupListView"
      v-if="emailGroups.data && rows.length > 0"
      v-model:list="emailGroups"
      v-model:pageLengthCount="emailGroups.data.page_length_count"
      :rows="rows"
      :columns="emailGroups.data.columns"
      :options="{
        showTooltip: false,
        resizeColumn: true,
        rowCount: emailGroups.data.row_count || 0,
        totalCount: emailGroups.data.total_count || 0,
        basePath: '/email-group'
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
    <div v-else-if="emailGroups.data" class="flex h-full items-center justify-center">
      <div
        class="flex flex-col items-center gap-3 text-xl font-medium text-ink-gray-4"
      >
        <span>{{ __('No {0} Found', [__('Email Groups')]) }}</span>
        <Button :label="__('Create Email Group')" @click="showEmailGroupModal = true">
          <template #prefix><FeatherIcon name="plus" customClass="h-4" /></template>
        </Button>
      </div>
    </div>
    <div v-else class="flex h-full items-center justify-center">
      <div
        class="flex flex-col items-center gap-3 text-xl font-medium text-ink-gray-4"
      >
        <span>Loading Email Groups...</span>
      </div>
    </div>
    <EmailGroupModal
      v-if="showEmailGroupModal"
      v-model="showEmailGroupModal"
      :defaults="defaults"
      :options="{ afterInsert: () => emailGroups.reload() }"
      @email-group-created="handleEmailGroupCreated"
      @email-group-deleted="handleEmailGroupDeleted"
    />
  </AppStyling>
</template>

<script>
export default {
  name: "EmailGroup"
}
</script>

<script setup>
import LayoutHeader from '@/components/LayoutHeader.vue'
import EmailGroupListView from '@/components/ListViews/EmailGroupListView.vue'
import EmailGroupModal from '@/components/Modals/EmailGroupModal.vue'
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
import { usersStore } from '@/stores/users'
import AppStyling from '@/components/AppStyling.vue'
import { Button } from 'frappe-ui'

const { getUser } = usersStore()

// Add missing functions
const handleListRefreshed = () => {
  // Refresh the email groups list
  if (emailGroups.reload) {
    emailGroups.reload()
  }
}

const handleEmailGroupCreated = () => {
  if (emailGroups.reload) {
    emailGroups.reload()
  }
}

const handleEmailGroupDeleted = () => {
  if (emailGroups.reload) {
    emailGroups.reload()
  }
}

// Function to refresh the email groups list - can be called from ViewControls
const refreshEmailGroupsList = () => {
  if (viewControls.value && viewControls.value.reload) {
    viewControls.value.reload()
  }
}

const showEmailGroupModal = ref(false)
const loadMore = ref(1)
const triggerResize = ref(1)
const updatedPageCount = ref(20)
const defaults = reactive({})
const viewControls = ref(null)
const emailGroupListView = ref(null)

// Use standard ViewControls data binding
const emailGroups = ref({})

const rows = computed(() => {
  if (!emailGroups.value?.data?.data) {
    return []
  }
  
  const parsedRows = parseRows(emailGroups.value.data.data, [])
  return parsedRows
})

function parseRows(rows, columns = []) {
  if (!rows || !Array.isArray(rows)) {
    return []
  }
  
  // Define the fields we want to display
  const displayFields = [
    'name',
    'title',
    'total_subscribers',
    'confirmation_email_template',
    'welcome_email_template',
    'welcome_url',
    'add_query_parameters',
    'modified',
    'creation',
    '_assign'
  ]
  
  return rows.map((emailGroup, index) => {
    let _rows = {}
    
    displayFields.forEach((field) => {
      if (emailGroup.hasOwnProperty(field)) {
        _rows[field] = emailGroup[field]

        if (field == 'title') {
          _rows[field] = {
            label: emailGroup.title,
            image_label: emailGroup.title,
          }
        } else if (field == 'total_subscribers') {
          _rows[field] = {
            label: emailGroup.total_subscribers || 0,
            color: emailGroup.total_subscribers > 0 ? 'green' : 'red',
          }
        } else if (field == '_assign') {
          try {
            let assignees = JSON.parse(emailGroup._assign || '[]')
            _rows[field] = assignees.map((user) => ({
              name: user,
              image: getUser(user).user_image,
              label: getUser(user).full_name,
            }))
          } catch (e) {
            _rows[field] = []
          }
        } else if (['modified', 'creation'].includes(field)) {
          _rows[field] = {
            label: formatDate(emailGroup[field]),
            timeAgo: __(timeAgo(emailGroup[field])),
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
    // Refresh the email groups list
    refreshEmailGroupsList()
    // Clear the refresh parameter from URL
    router.replace({ 
      name: 'EmailGroup',
      query: {} 
    })
  }
}, { immediate: true })

const breadcrumbs = computed(() => {
  // If on detail view, show EmailGroup/EmailGroup Name
  if (route.params.emailGroupId) {
    // Try to find the email group name from the email groups list
    let emailGroupName = route.params.emailGroupId
    if (emailGroups.value?.data?.data) {
      const found = emailGroups.value.data.data.find(d => d.name === route.params.emailGroupId)
      if (found && found.title) emailGroupName = found.title
    }
    return [
      { label: __('Email Group'), route: { name: 'EmailGroup' } },
      { label: emailGroupName, route: { name: 'EmailGroupDetail', params: { emailGroupId: route.params.emailGroupId } } }
    ]
  }
  // On list view, show EmailGroup/List
  return [
    { label: __('Email Group'), route: { name: 'EmailGroup' } },
    { label: __('List'), route: { name: 'EmailGroup' } }
  ]
})
</script>