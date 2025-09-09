<template>
  <AppStyling type="detail-background">
    <LayoutHeader v-if="communication.data">
      <template #left-header>
        <Breadcrumbs :items="breadcrumbs">
          <template #prefix="{ item }">
            <Icon v-if="item.icon" :icon="item.icon" class="mr-2 h-4" />
          </template>
        </Breadcrumbs>
      </template>
      <template #right-header>
        <CustomActions
          v-if="communication.data._customActions?.length"
          :actions="communication.data._customActions"
        />
        <CustomActions
          v-if="document.actions?.length"
          :actions="document.actions"
        />
        <AssignTo
          v-model="assignees.data"
          :data="document.doc"
          doctype="Communication"
        />
      </template> 
    </LayoutHeader>
    
    <div v-if="communication?.data" class="flex h-full overflow-hidden">
      <div class="flex-1 flex flex-col min-w-0">
        <Tabs as="div" v-model="tabIndex" :tabs="tabs">
          <template #tab-panel>
            <Activities
                  ref="activities"
                  :doctype="activityDoctype"
                  :tabs="tabs"
                  v-model:reload="reload"
                  v-model:tabIndex="tabIndex"
                  v-model="communication"
                  :docname="activityDocname"
                  @beforeSave="saveChanges"
                  @afterSave="reloadAssignees"
                />
          </template>
        </Tabs>
      </div>
      <div class="w-80 flex flex-col justify-between border-l bg-white flex-shrink-0">
        <div
          class="flex h-10.5 cursor-copy items-center border-b px-5 py-2.5 text-lg font-medium text-ink-gray-9"
          @click="copyToClipboard(props.communicationId)"
        >
          {{ __(title) }}
        </div>
        <div class="flex items-center justify-start gap-5 border-b p-5">
          <div class="group relative size-12">
            <Avatar
              size="3xl"
              class="size-12"
              :label="title"
            />
          </div>
          <div class="flex flex-col gap-2.5 truncate">
            <Tooltip :text="communication.data.subject || __('Set communication subject')">
              <div class="truncate text-2xl font-medium text-ink-gray-9">
                {{ title }}
              </div>
            </Tooltip>
            <div class="flex gap-1.5">
              <Tooltip :text="__('Copy link')">
                <div>
                  <Button @click="copyToClipboard(communication.data.name)">
                    <template #icon>
                      <LinkIcon />
                    </template>
                  </Button>
                </div>
              </Tooltip>
              <Tooltip :text="__('Attach a file')">
                <div>
                  <Button @click="showFilesUploader = true">
                    <template #icon>
                      <AttachmentIcon />
                    </template>
                  </Button>
                </div>
              </Tooltip>
              <Tooltip :text="__('Delete')">
                <div>
                  <Button
                    @click="deleteCommunicationWithModal(communication.data.name)"
                    variant="subtle"
                    theme="red"
                    icon="trash-2"
                  />
                </div>
              </Tooltip>
            </div>
          </div>
        </div>
        <div
          v-if="sections.data && sections.data.length > 0"
          class="flex flex-1 flex-col justify-between overflow-hidden"
        >
          <SidePanelLayout
            :sections="sections.data"
            doctype="Communication"
            :docname="communication.data.name"
            @reload="sections.reload"
            @afterFieldChange="reloadAssignees"
          >
            <template #fields>
              <!-- Fields are handled by SidePanelLayout -->
            </template>
          </SidePanelLayout>
        </div>
        <!-- Fallback content if sections are not loaded or empty -->
        <div v-else-if="!sections.data || sections.data.length === 0" class="flex flex-1 flex-col justify-between overflow-hidden">
          <SidePanelLayout
            :sections="communicationSidebarSections"
            doctype="Communication"
            :docname="communication.data.name"
            @reload="sections.reload"
            @afterFieldChange="reloadAssignees"
          />
        </div>
      </div>
    </div>
  </AppStyling>
  <ErrorPage
    v-if="errorTitle"
    :errorTitle="errorTitle"
    :errorMessage="errorMessage"
  />
  <FilesUploader
    v-if="communication.data?.name"
    v-model="showFilesUploader"
    doctype="Communication"
    :docname="props.communicationId"
    @after="
      () => {
        activities?.all_activities?.reload()
        changeTabTo('attachments')
      }
    "
  />
  <DeleteLinkedDocModal
    v-if="showDeleteLinkedDocModal"
    v-model="showDeleteLinkedDocModal"
    :doctype="'Communication'"
    :docname="props.communicationId"
    name="Communications"
  />
</template>
<script setup>
import ErrorPage from '@/components/ErrorPage.vue'
import Icon from '@/components/Icon.vue'
import Resizer from '@/components/Resizer.vue'
import ActivityIcon from '@/components/Icons/ActivityIcon.vue'
import EmailIcon from '@/components/Icons/EmailIcon.vue'
import Email2Icon from '@/components/Icons/Email2Icon.vue'
import CommentIcon from '@/components/Icons/CommentIcon.vue'
import DetailsIcon from '@/components/Icons/DetailsIcon.vue'
import PhoneIcon from '@/components/Icons/PhoneIcon.vue'
import TaskIcon from '@/components/Icons/TaskIcon.vue'
import NoteIcon from '@/components/Icons/NoteIcon.vue'
import WhatsAppIcon from '@/components/Icons/WhatsAppIcon.vue'
import IndicatorIcon from '@/components/Icons/IndicatorIcon.vue'
import CameraIcon from '@/components/Icons/CameraIcon.vue'
import LinkIcon from '@/components/Icons/LinkIcon.vue'
import AttachmentIcon from '@/components/Icons/AttachmentIcon.vue'
import WebsiteIcon from '@/components/Icons/WebsiteIcon.vue'
import FeatherIcon from '@/components/Icons/FeatherIcon.vue'
import LayoutHeader from '@/components/LayoutHeader.vue'
import Activities from '@/components/Activities/Activities.vue'
import AssignTo from '@/components/AssignTo.vue'
import FilesUploader from '@/components/FilesUploader/FilesUploader.vue'
import SidePanelLayout from '@/components/SidePanelLayout.vue'
import SLASection from '@/components/SLASection.vue'
import CustomActions from '@/components/CustomActions.vue'
import AppStyling from '@/components/AppStyling.vue'
import DeleteLinkedDocModal from '@/components/DeleteLinkedDocModal.vue'
import {
  openWebsite,
  setupCustomizations,
  copyToClipboard,
  validateIsImageFile,
} from '@/utils'
import { getView } from '@/utils/view'
import { getSettings } from '@/stores/settings'
import { globalStore } from '@/stores/global'
import { statusesStore } from '@/stores/statuses'
import { getMeta } from '@/stores/meta'
import { useDocument } from '@/data/document'
import { whatsappEnabled, callEnabled } from '@/composables/settings'
import {
  createResource,
  FileUploader,
  Dropdown,
  Tooltip,
  Avatar,
  Tabs,
  Breadcrumbs,
  call,
  usePageMeta,
  toast,
  Button,
} from 'frappe-ui'
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useActiveTabManager } from '@/composables/useActiveTabManager'

const { brand } = getSettings()
const { $dialog, $socket, makeCall } = globalStore()
const { statusOptions } = statusesStore
const { doctypeMeta } = getMeta('Communication')

const route = useRoute()
const router = useRouter()

const props = defineProps({
  communicationId: {
    type: String,
    required: true,
  },
})

const errorTitle = ref('')
const errorMessage = ref('')
const showDeleteLinkedDocModal = ref(false)

const { triggerOnChange, assignees, document } = useDocument(
  'Communication',
  props.communicationId,
)

async function triggerStatusChange(value) {
  await triggerOnChange('status', value)
  document.save.submit()
}

const communication = createResource({
  url: 'frappe.client.get',
  params: { doctype: 'Communication', name: props.communicationId },
  cache: ['communication', props.communicationId],
  onSuccess: (data) => {
    errorTitle.value = ''
    errorMessage.value = ''
    setupCustomizations(communication, {
      doc: data,
      $dialog,
      $socket,
      router,
      toast,
      updateField,
      createToast: toast.create,
      deleteDoc: deleteCommunication,
      resource: { communication, sections },
      call,
    })
  },
  onError: (err) => {
    console.error('Error loading Communication:', err)
    if (err.messages?.[0]) {
      errorTitle.value = __('Not permitted')
      errorMessage.value = __(err.messages?.[0])
    } else if (err.exc_type === 'DoesNotExistError') {
      // Document doesn't exist yet, might be a timing issue
      errorTitle.value = __('Document Not Found')
      errorMessage.value = __('The Communication might not be fully created yet. Please wait a moment and refresh the page.')
      
      // Retry after a delay
      setTimeout(() => {
        communication.fetch()
      }, 1000)
    } else {
      // Only redirect if it's not a "not found" error
      router.push({ name: 'Communication' })
    }
  },
})

onMounted(() => {
  if (communication.data) return
  communication.fetch()
})

const reload = ref(false)
const showFilesUploader = ref(false)

function updateCommunication(fieldname, value, callback) {
  value = Array.isArray(fieldname) ? '' : value

  if (!Array.isArray(fieldname) && validateRequired(fieldname, value)) return

  createResource({
    url: 'frappe.client.set_value',
    params: {
      doctype: 'Communication',
      name: props.communicationId,
      fieldname,
      value,
    },
    auto: true,
    onSuccess: () => {
      communication.reload()
      reload.value = true
      toast.success(__('Communication updated successfully'))
      callback?.()
    },
    onError: (err) => {
      toast.error(err.messages?.[0] || __('Error updating communication'))
    },
  })
}

function validateRequired(fieldname, value) {
  let meta = communication.data.fields_meta || {}
  if (meta[fieldname]?.reqd && !value) {
    toast.error(__('{0} is a required field', [meta[fieldname].label]))
    return true
  }
  return false
}

const breadcrumbs = computed(() => {
  let items = [{ label: __('Communications'), route: { name: 'Communication' } }]

  if (route.query.view || route.query.viewType) {
    let view = getView(route.query.view, route.query.viewType, 'Communication')
    if (view) {
      items.push({
        label: __(view.label),
        icon: view.icon,
        route: {
          name: 'Communication',
          params: { viewType: route.query.viewType },
          query: { view: route.query.view },
        },
      })
    }
  }

  items.push({
    label: title.value,
    route: { name: 'CommunicationDetail', params: { communicationId: communication.data.name } },
  })
  return items
})

const title = computed(() => {
  // For Communication, use subject as the title field
  let t = 'subject'
  return communication.data?.[t] || props.communicationId
})

usePageMeta(() => {
  return {
    title: title.value,
    icon: brand.favicon,
  }
})

const tabs = computed(() => {
  let tabOptions = [
    {
      name: 'Activity',
      label: __('Activity'),
      icon: ActivityIcon,
    },
    {
      name: 'Emails',
      label: __('Emails'),
      icon: EmailIcon,
    },
    {
      name: 'Comments',
      label: __('Comments'),
      icon: CommentIcon,
    },
    {
      name: 'Data',
      label: __('Data'),
      icon: DetailsIcon,
    },
    {
      name: 'Calls',
      label: __('Calls'),
      icon: PhoneIcon,
    },
    {
      name: 'Tasks',
      label: __('Tasks'),
      icon: TaskIcon,
    },
    {
      name: 'Notes',
      label: __('Notes'),
      icon: NoteIcon,
    },
    {
      name: 'Attachments',
      label: __('Attachments'),
      icon: AttachmentIcon,
    },
    {
      name: 'WhatsApp',
      label: __('WhatsApp'),
      icon: WhatsAppIcon,
      condition: () => whatsappEnabled.value,
    },
  ]
  return tabOptions.filter((tab) => (tab.condition ? tab.condition() : true))
})

const { tabIndex, changeTabTo } = useActiveTabManager(tabs, 'lastCommunicationTab')

// Communication sidebar sections for when CRM Fields Layout is not available
const communicationSidebarSections = computed(() => [
  {
    label: __('Communication Details'),
    name: 'communication_details_section',
    opened: true,
    columns: [
      {
        name: 'column_communication_details',
        fields: [
          {
            fieldname: 'subject',
            label: __('Subject'),
            fieldtype: 'Data',
            value: communication.data?.subject || '',
            placeholder: __('Enter communication subject'),
            reqd: true
          },
          {
            fieldname: 'communication_type',
            label: __('Communication Type'),
            fieldtype: 'Select',
            value: communication.data?.communication_type || '',
            options: 'Communication\nComment\nChat\nNotification\nFeedback\nAutomated Message',
            read_only: true
          },
          {
            fieldname: 'sent_or_received',
            label: __('Sent or Received'),
            fieldtype: 'Select',
            value: communication.data?.sent_or_received || '',
            options: 'Sent\nReceived'
          },
          {
            fieldname: 'communication_medium',
            label: __('Type'),
            fieldtype: 'Select',
            value: communication.data?.communication_medium || '',
            options: '\nEmail\nChat\nPhone\nSMS\nEvent\nMeeting\nVisit\nOther'
          },
          {
            fieldname: 'status',
            label: __('Status'),
            fieldtype: 'Select',
            value: communication.data?.status || '',
            options: 'Open\nReplied\nClosed\nLinked'
          }
        ]
      }
    ]
  },
  {
    label: __('Reference Information'),
    name: 'reference_info_section',
    opened: true,
    columns: [
      {
        name: 'column_reference_info',
        fields: [
          {
            fieldname: 'reference_doctype',
            label: __('Reference DocType'),
            fieldtype: 'Link',
            value: communication.data?.reference_doctype || '',
            options: 'DocType'
          },
          {
            fieldname: 'reference_name',
            label: __('Reference Name'),
            fieldtype: 'Data',
            value: communication.data?.reference_name || '',
            placeholder: __('Enter reference name')
          }
        ]
      }
    ]
  },
  {
    label: __('Communication Content'),
    name: 'content_section',
    opened: true,
    columns: [
      {
        name: 'column_content',
        fields: [
          {
            fieldname: 'sender',
            label: __('Sender'),
            fieldtype: 'Data',
            value: communication.data?.sender || '',
            placeholder: __('Enter sender')
          },
          {
            fieldname: 'recipients',
            label: __('Recipients'),
            fieldtype: 'Data',
            value: communication.data?.recipients || '',
            placeholder: __('Enter recipients')
          },
          {
            fieldname: 'content',
            label: __('Content'),
            fieldtype: 'Text',
            value: communication.data?.content || '',
            placeholder: __('Enter communication content')
          }
        ]
      }
    ]
  },
  {
    label: __('System Information'),
    name: 'system_info_section',
    opened: true,
    columns: [
      {
        name: 'column_system_info',
        fields: [
          {
            fieldname: 'owner',
            label: __('Owner'),
            fieldtype: 'User',
            value: communication.data?.owner || '',
            placeholder: __('Select owner'),
            read_only: true
          },
          {
            fieldname: 'creation',
            label: __('Created'),
            fieldtype: 'Datetime',
            value: communication.data?.creation || '',
            read_only: true
          },
          {
            fieldname: 'modified',
            label: __('Modified'),
            fieldtype: 'Datetime',
            value: communication.data?.modified || '',
            read_only: true
          }
        ]
      }
    ]
  }
])

watch(tabs, (value) => {
  if (value && route.params.tabName) {
    let index = value.findIndex(
      (tab) => tab.name.toLowerCase() === route.params.tabName.toLowerCase(),
    )
    if (index !== -1) {
      tabIndex.value = index
    }
  }
})

const sections = createResource({
  url: 'crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_sidepanel_sections',
  cache: ['sidePanelSections', 'Communication'],
  params: { doctype: 'Communication' },
  auto: true,
  onSuccess: (data) => {
    // Sections loaded successfully
  },
  onError: (err) => {
    // Handle sections error silently
  },
})

function updateField(name, value, callback) {
  updateCommunication(name, value, () => {
    communication.data[name] = value
    callback?.()
  })
}

async function deleteCommunication(name) {
  await call('frappe.client.delete', {
    doctype: 'Communication',
    name,
  })
  router.push({ name: 'Communication' })
}

async function deleteCommunicationWithModal(name) {
  showDeleteLinkedDocModal.value = true
}

const activities = ref(null)

// Determine which document to load activities for: prefer referenced doc (e.g., Donor) when present
const activityDoctype = computed(() => {
  return communication.data?.reference_doctype || 'Communication'
})

const activityDocname = computed(() => {
  // communication may store reference_docname or reference_name in different places
  return (
    communication.data?.reference_docname ||
    communication.data?.reference_name ||
    props.communicationId
  )
})

function openEmailBox() {
  let currentTab = tabs.value[tabIndex.value]
  if (!['Emails', 'Comments', 'Activities'].includes(currentTab.name)) {
    activities.value.changeTabTo('emails')
  }
  nextTick(() => (activities.value.emailBox.show = true))
}

function saveChanges(data) {
  document.save.submit(null, {
    onSuccess: () => reloadAssignees(data),
  })
}

function reloadAssignees(data) {
  if (data?.hasOwnProperty('communication_owner')) {
    assignees.reload()
  }
}
</script>