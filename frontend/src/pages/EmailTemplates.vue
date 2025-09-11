<template>
  <AppStyling type="detail-background">
    <LayoutHeader>
      <template #left-header>
        <ViewBreadcrumbs v-model="viewControls" routeName="EmailTemplates" />
      </template>
      <template #right-header>
        <CustomActions
          v-if="emailTemplatesListView?.customListActions?.length"
          :actions="emailTemplatesListView.customListActions"
        />
        <AppStyling
          type="button"
          buttonType="create"
          buttonLabel="Create"
          @click="showEmailTemplateModal = true"
        >
          <template #prefix><FeatherIcon name="plus" class="h-4 w-4 text-white" /></template>
        </AppStyling>
      </template>
    </LayoutHeader>

    <div class="flex h-full overflow-hidden">
      <div class="flex-1 flex flex-col min-w-0">
        <ViewControls
          ref="viewControls"
          v-model="emailTemplates"
          v-model:loadMore="loadMore"
          v-model:resizeColumn="triggerResize"
          v-model:updatedPageCount="updatedPageCount"
          doctype="Email Template"
          :filters="{}"
          :options="{
            allowedViews: ['list', 'group_by', 'kanban'],
          }"
        />

        
        <EmailTemplatesListView
          ref="emailTemplatesListView"
          v-if="emailTemplates.data && rows.length && route.params.viewType !== 'kanban'"
          v-model:pageLengthCount="emailTemplates.data.page_length_count"
          v-model:list="emailTemplates"
          :rows="rows"
          :columns="emailTemplates.data.columns"
          :selections="[]"
          :loading="false"
          :total-count="emailTemplates.data.total_count"
          :page-size="emailTemplates.data.page_length_count"
          :current-page="1"
          :show-selection="true"
          :options="{
            showTooltip: false,
            resizeColumn: true,
            rowCount: emailTemplates.data.row_count,
            totalCount: emailTemplates.data.total_count,
          }"
          @loadMore="() => loadMore++"
          @columnWidthUpdated="() => triggerResize++"
          @updatePageCount="(count) => (updatedPageCount = count)"
          @applyFilter="(data) => viewControls.applyFilter(data)"
          @applyLikeFilter="(data) => viewControls.applyLikeFilter(data)"
          @likeDoc="(data) => viewControls.likeDoc(data)"
          @selectionsChanged="
            (selections) => viewControls.updateSelections(selections)
          "
        />
        <div v-else-if="emailTemplates.data && route.params.viewType !== 'kanban'" class="flex h-full items-center justify-center">
          <div
            class="flex flex-col items-center gap-3 text-xl font-medium text-ink-gray-4"
          >
            <EmailIcon class="h-10 w-10" />
            <span>{{ __('No {0} Found', [__('Email Templates')]) }}</span>
            <Button :label="__('Create')" @click="showEmailTemplateModal = true">
              <template #prefix><FeatherIcon name="plus" class="h-4" /></template>
            </Button>
          </div>
        </div>
        <KanbanView
          v-if="route.params.viewType == 'kanban'"
          v-model="emailTemplates"
          :options="{
            getRoute: (row) => ({
              name: 'EmailTemplate',
              params: { emailTemplateId: row.name },
              query: { view: route.query.view, viewType: route.params.viewType },
            }),
            onNewClick: (column) => onNewClick(column),
          }"
          @update="(data) => viewControls.updateKanbanSettings(data)"
          @loadMore="(columnName) => viewControls.loadMoreKanban(columnName)"
        >
          <template #title="{ titleField, itemName }">
            <div class="flex items-center gap-2">
              <div v-if="titleField === 'name'">
                <div class="truncate text-base">
                  {{ getRow(itemName, titleField).label }}
                </div>
              </div>
              <div
                v-if="
                  [
                    'modified',
                    'creation',
                  ].includes(titleField)
                "
                class="truncate text-base"
              >
                <Tooltip :text="getRow(itemName, titleField).label">
                  <div>{{ getRow(itemName, titleField).timeAgo }}</div>
                </Tooltip>
              </div>
              <div
                v-else-if="getRow(itemName, titleField).label"
                class="truncate text-base"
              >
                {{ getRow(itemName, titleField).label }}
              </div>
              <div class="text-ink-gray-4" v-else>{{ __('No Title') }}</div>
            </div>
          </template>
          <template #fields="{ fieldName, itemName }">
            <div
              v-if="getRow(itemName, fieldName).label"
              class="truncate flex items-center gap-2"
            >
              <div v-if="fieldName === 'name'">
                <div class="truncate text-base">
                  {{ getRow(itemName, fieldName).label }}
                </div>
              </div>
              <div
                v-if="
                  [
                    'modified',
                    'creation',
                  ].includes(fieldName)
                "
                class="truncate text-base"
              >
                <Tooltip :text="getRow(itemName, fieldName).label">
                  <div>{{ getRow(itemName, fieldName).timeAgo }}</div>
                </Tooltip>
              </div>
              <div v-else-if="fieldName === '_assign'" class="flex items-center">
                <MultipleAvatar
                  :avatars="getRow(itemName, fieldName).label"
                  size="xs"
                />
              </div>
              <div v-else-if="fieldName === 'subject'" class="truncate text-base">
                <Tooltip :text="getRow(itemName, fieldName).label">
                  <div class="truncate">{{ getRow(itemName, fieldName).label }}</div>
                </Tooltip>
              </div>
              <div v-else class="truncate text-base">
                {{ getRow(itemName, fieldName).label }}
              </div>
            </div>
          </template>
          <template #actions="{ itemName }">
            <div class="flex gap-2 items-center justify-between">
              <div class="text-ink-gray-5 flex items-center gap-1.5">
                <EmailAtIcon class="h-4 w-4" />
                <span v-if="getRow(itemName, '_email_count').label">
                  {{ getRow(itemName, '_email_count').label }}
                </span>
                <span class="text-3xl leading-[0]"> &middot; </span>
                <NoteIcon class="h-4 w-4" />
                <span v-if="getRow(itemName, '_note_count').label">
                  {{ getRow(itemName, '_note_count').label }}
                </span>
                <span class="text-3xl leading-[0]"> &middot; </span>
                <TaskIcon class="h-4 w-4" />
                <span v-if="getRow(itemName, '_task_count').label">
                  {{ getRow(itemName, '_task_count').label }}
                </span>
              </div>
              <div class="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  icon="edit"
                  @click.stop="
                    () => {
                      showEditEmailTemplateModal = true
                      editEmailTemplate = getRow(itemName, 'name').label
                    }
                  "
                />
                <Button
                  variant="ghost"
                  size="sm"
                  icon="trash-2"
                  theme="red"
                  @click.stop="
                    () => {
                      showDeleteLinkedDocModal = true
                      docname = itemName
                    }
                  "
                />
              </div>
            </div>
          </template>
        </KanbanView>
      </div>
    </div>
  </AppStyling>

  <!-- Email Template Modal -->
  <EmailTemplateModal
    v-if="showEmailTemplateModal"
    v-model="showEmailTemplateModal"
    @success="
      () => {
        // Note: The modal will handle redirection to detail page
        // We don't need to reload the list since we're leaving the page
        showEmailTemplateModal = false
      }
    "
  />

  <!-- Edit Email Template Modal -->
  <EmailTemplateModal
    v-if="showEditEmailTemplateModal && editEmailTemplate"
    v-model="showEditEmailTemplateModal"
    :editMode="true"
    :templateData="editEmailTemplate"
    @success="
      () => {
        showEditEmailTemplateModal = false
        editEmailTemplate = null
        emailTemplates.reload()
      }
    "
  />

  <!-- Delete Modal -->
  <DeleteLinkedDocModal
    v-if="showDeleteLinkedDocModal"
    v-model="showDeleteLinkedDocModal"
    :doctype="'Email Template'"
    :docname="docname"
    name="Email Templates"
  />

  <!-- Note Modal -->
  <NoteModal
    v-if="showNoteModal"
    v-model="showNoteModal"
    :note="note"
    doctype="Email Template"
    :doc="docname"
  />
  <!-- Task Modal -->
  <TaskModal
    v-if="showTaskModal"
    v-model="showTaskModal"
    :task="task"
    doctype="Email Template"
    :doc="docname"
  />
</template>

<script setup>
import ViewBreadcrumbs from '@/components/ViewBreadcrumbs.vue'
import MultipleAvatar from '@/components/MultipleAvatar.vue'
import CustomActions from '@/components/CustomActions.vue'
import EmailAtIcon from '@/components/Icons/EmailAtIcon.vue'
import EmailIcon from '@/components/Icons/EmailIcon.vue'
import PhoneIcon from '@/components/Icons/PhoneIcon.vue'
import NoteIcon from '@/components/Icons/NoteIcon.vue'
import TaskIcon from '@/components/Icons/TaskIcon.vue'
import CommentIcon from '@/components/Icons/CommentIcon.vue'
import IndicatorIcon from '@/components/Icons/IndicatorIcon.vue'
import LeadsIcon from '@/components/Icons/LeadsIcon.vue'
import LayoutHeader from '@/components/LayoutHeader.vue'
import EmailTemplatesListView from '@/components/ListViews/EmailTemplatesListView.vue'
import KanbanView from '@/components/Kanban/KanbanView.vue'
import EmailTemplateModal from '@/components/Modals/EmailTemplateModal.vue'
import NoteModal from '@/components/Modals/NoteModal.vue'
import TaskModal from '@/components/Modals/TaskModal.vue'
import ViewControls from '@/components/ViewControls.vue'
import DeleteLinkedDocModal from '@/components/DeleteLinkedDocModal.vue'
import { getMeta } from '@/stores/meta'
import { globalStore } from '@/stores/global'
import { usersStore } from '@/stores/users'
import { callEnabled } from '@/composables/settings'
import { formatDate, timeAgo, website, formatTime } from '@/utils'
import { Avatar, Tooltip, Dropdown, Button } from 'frappe-ui'
import { FeatherIcon } from 'frappe-ui'
import { useRoute } from 'vue-router'
import { ref, computed, reactive, h } from 'vue'
import AppStyling from '@/components/AppStyling.vue'

const { getFormattedPercent, getFormattedFloat, getFormattedCurrency } =
  getMeta('Email Template')
const { makeCall } = globalStore()
const { getUser, users } = usersStore()
const caseofficerUsers = computed(() =>
  (users.data?.allUsers || []).filter(user => user.role === 'CaseOfficer')
)

const route = useRoute()

const emailTemplatesListView = ref(null)
const showEmailTemplateModal = ref(false)
const showEditEmailTemplateModal = ref(false)
const editEmailTemplate = ref(null)

const defaults = reactive({})

// email templates data is loaded in the ViewControls component
const emailTemplates = ref({})
const loadMore = ref(1)
const triggerResize = ref(1)
const updatedPageCount = ref(20)
const viewControls = ref(null)

// Utility: strip HTML tags from a string for safe list display
function stripHtmlTags(value) {
  if (!value || typeof value !== 'string') return value || ''
  try {
    return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  } catch {
    return value
  }
}

function getRow(name, field) {
  const row = rows.value?.find((row) => row.name == name)
  if (!row) return { label: '' }
  
  const value = row[field]
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value
  }
  return { label: value }
}

// Rows
const rows = computed(() => {
  if (!emailTemplates.value?.data?.data) {
    return []
  }
  
  if (emailTemplates.value.data.view_type === 'group_by') {
    if (!emailTemplates.value?.data.group_by_field?.fieldname) return []
    return getGroupedByRows(
      emailTemplates.value?.data.data,
      emailTemplates.value?.data.group_by_field,
      emailTemplates.value.data.columns,
    )
  } else if (emailTemplates.value.data.view_type === 'kanban') {
    return getKanbanRows(emailTemplates.value.data.data, emailTemplates.value.data.fields)
  } else {
    return parseRows(emailTemplates.value?.data.data, emailTemplates.value.data.columns)
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
  let view_type = emailTemplates.value.data.view_type
  let key = view_type === 'kanban' ? 'fieldname' : 'key'
  let type = view_type === 'kanban' ? 'fieldtype' : 'type'

  return rows.map((emailTemplate) => {
    let _rows = {}
    
    // Always process the enabled field regardless of whether it's in the rows array
    if (emailTemplate.hasOwnProperty('enabled')) {
      _rows['enabled'] = {
        label: emailTemplate.enabled ? 'Yes' : 'No',
      }
    }
    
    emailTemplates.value?.data.rows.forEach((row) => {
      _rows[row] = emailTemplate[row]

      let fieldType = columns?.find((col) => (col[key] || col.value) == row)?.[
        type
      ]

      if (
        fieldType &&
        ['Date', 'Datetime'].includes(fieldType) &&
        !['modified', 'creation'].includes(row)
      ) {
        _rows[row] = formatDate(emailTemplate[row], '', true, fieldType == 'Datetime')
      }

      if (fieldType && fieldType == 'Currency') {
        _rows[row] = getFormattedCurrency(row, emailTemplate)
      }

      if (fieldType && fieldType == 'Float') {
        _rows[row] = getFormattedFloat(row, emailTemplate)
      }

      if (fieldType && fieldType == 'Percent') {
        _rows[row] = getFormattedPercent(row, emailTemplate)
      }

      if (row == 'name') {
        _rows[row] = {
          label: emailTemplate.name,
        }
        // Preserve the actual name value for routing
        _rows.name = emailTemplate.name
      } else if (row == 'subject') {
        _rows[row] = {
          label: emailTemplate.subject,
        }
      } else if (row == 'response') {
        _rows[row] = {
          label: stripHtmlTags(emailTemplate.response || ''),
        }
      } else if (row == 'use_html') {
        _rows[row] = {
          label: emailTemplate.use_html ? 'Yes' : 'No',
        }
      } else if (row == 'enabled') {
        _rows[row] = {
          label: emailTemplate.enabled ? 'Yes' : 'No',
        }
      } else if (row == 'reference_doctype') {
        _rows[row] = emailTemplate.reference_doctype
      } else if (row == '_assign') {
        let assignees = JSON.parse(emailTemplate._assign || '[]')
        _rows[row] = assignees.map((user) => ({
          name: user,
          image: getUser(user).user_image,
          label: getUser(user).full_name,
        }))
      } else if (['modified', 'creation'].includes(row)) {
        _rows[row] = {
          label: formatDate(emailTemplate[row]),
          timeAgo: __(timeAgo(emailTemplate[row])),
        }
      }
    })
    _rows['_email_count'] = emailTemplate._email_count
    _rows['_note_count'] = emailTemplate._note_count
    _rows['_task_count'] = emailTemplate._task_count
    _rows['_comment_count'] = emailTemplate._comment_count
    
    // Ensure the original name is always available for routing
    _rows.name = emailTemplate.name
    return _rows
  })
}

function onNewClick(column) {
  showEmailTemplateModal.value = true
}

// Route generation
function getRoute(emailTemplate) {
  return {
    name: 'EmailTemplate',
    params: { emailTemplateId: emailTemplate.name },
  }
}

// Modal states
const showDeleteLinkedDocModal = ref(false)
const docname = ref('')
const showNoteModal = ref(false)
const note = ref('')
const showTaskModal = ref(false)
const task = ref('')

// Functions to show modals
function showNoteModalFn(doc) {
  note.value = doc
  showNoteModal.value = true
}

function showTaskModalFn(doc) {
  task.value = doc
  showTaskModal.value = true
}

// Expose functions for use in other components
defineExpose({
  showNoteModal: showNoteModalFn,
  showTaskModal: showTaskModalFn,
})
</script> 