<template>
  <AppStyling type="detail-background" class="min-h-screen" style="background: linear-gradient(to bottom right, #fef7ff, #f8faff); min-height: 100vh;">
    <LayoutHeader>
      <template #left-header>
        <Breadcrumbs :items="breadcrumbs">
          <template #prefix="{ item }">
            <Icon v-if="item.icon" :icon="item.icon" class="mr-2 h-4" />
          </template>
        </Breadcrumbs>
      </template>
      <template v-if="!errorTitle" #right-header>
        <CustomActions
          v-if="document._actions?.length"
          :actions="document._actions"
        />
        <CustomActions
          v-if="document.actions?.length"
          :actions="document.actions"
        />
        <AssignTo v-model="assignees.data" doctype="Email Campaign" :docname="emailCampaignId" />	
        <Dropdown
          v-if="doc"
          :options="
            statusOptions(
              'email_campaign',
              document.statuses?.length ? document.statuses : document._statuses,
              triggerStatusChange,
            )
          "
        >
          <template #default="{ open }">
            <Button v-if="doc.status" :label="doc.status">
              <template #prefix>
                <IndicatorIcon :class="getEmailCampaignStatus(doc.status).color" />
              </template>
              <template #suffix>
                <FeatherIcon
                  :name="open ? 'chevron-up' : 'chevron-down'"
                  class="h-4"
                />  
              </template>
            </Button>
          </template>
        </Dropdown>
      </template>
    </LayoutHeader>
    
    <div v-if="doc.name" class="flex h-full overflow-hidden !bg-gradient-to-br !from-[#fef7ff] !to-[#f8faff] min-h-screen" style="background: linear-gradient(to bottom right, #fef7ff, #f8faff); min-height: 100vh;">
      <Tabs as="div" v-model="tabIndex" :tabs="tabs">
        <template #tab-panel>
          <Activities
            ref="activities"
            doctype="Email Campaign"
            :docname="emailCampaignId"
            :tabs="tabs"
            v-model:reload="reload"
            v-model:tabIndex="tabIndex"
            @beforeSave="saveChanges"
            @afterSave="reloadAssignees"
          />
        </template>
      </Tabs>
    <Resizer class="flex flex-col justify-between border-l" side="right">
      <div
        class="flex h-10.5 cursor-copy items-center border-b px-5 py-2.5 text-lg font-medium text-ink-gray-9"
        @click="copyToClipboard(emailCampaignId)"
      >
        {{ __(emailCampaignId) }}
      </div>
      <FileUploader
        @success="(file) => updateField('image', file.file_url)"
        :validateFile="validateIsImageFile"
      >
        <template #default="{ openFileSelector, error }">
          <div class="flex items-center justify-start gap-5 border-b p-5">
            <div class="group relative size-12">
              <Avatar
                size="3xl"
                class="size-12"
                :label="title"
                :image="doc.image"
              />
              <component
                :is="doc.image ? Dropdown : 'div'"
                v-bind="
                  doc.image
                    ? {
                        options: [
                          {
                            icon: 'upload',
                            label: doc.image
                              ? __('Change image')
                              : __('Upload image'),
                            onClick: openFileSelector,
                          },
                          {
                            icon: 'trash-2',
                            label: __('Remove image'),
                            onClick: () => updateField('image', ''),
                          },
                        ],
                      }
                    : { onClick: openFileSelector }
                "
                class="!absolute bottom-0 left-0 right-0"
              >
                <div
                  class="z-1 absolute bottom-0.5 left-0 right-0.5 flex h-9 cursor-pointer items-center justify-center rounded-b-full bg-black bg-opacity-40 pt-3 opacity-0 duration-300 ease-in-out group-hover:opacity-100"
                  style="
                    -webkit-clip-path: inset(12px 0 0 0);
                    clip-path: inset(12px 0 0 0);
                  "
                >
                  <CameraIcon class="size-4 cursor-pointer text-white" />
                </div>
              </component>
            </div>
            <div class="flex flex-col gap-2.5 truncate">
              <Tooltip :text="doc.campaign_name || __('Set campaign name')">
                <div class="truncate text-2xl font-medium text-ink-gray-9">
                  {{ title }}
                </div>
              </Tooltip>
              <div class="flex gap-1.5">
                <Tooltip :text="__('Send Email')">
                  <div>
                    <Button
                      @click="openEmailBox"
                    >
                      <template #icon>
                        <Email2Icon />
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
                      @click="deleteEmailCampaign"
                      variant="subtle"
                      theme="red"
                      icon="trash-2"
                    />
                  </div>
                </Tooltip>
              </div>
              <ErrorMessage :message="__(error)" />
            </div>
          </div>
        </template>
      </FileUploader>
      <SLASection
        v-if="doc.sla_status"
        v-model="doc"
        @updateField="updateField"
      />
      <div
        v-if="sections.data"
        class="flex flex-1 flex-col justify-between overflow-hidden"
      >
        <SidePanelLayout
          :sections="sections.data"
          doctype="Email Campaign"
          :docname="emailCampaignId"
          @reload="sections.reload"
          @afterFieldChange="reloadAssignees"
        />
      </div>
    </Resizer>
    </div>
  </AppStyling>
  <ErrorPage
    v-if="errorTitle"
    :errorTitle="errorTitle"
    :errorMessage="errorMessage"
  />
  <FilesUploader
    v-model="showFilesUploader"
    doctype="Email Campaign"
    :docname="emailCampaignId"
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
    :doctype="'Email Campaign'"
    :docname="emailCampaignId"
    name="Email Campaigns"
  />
</template>

<script setup>
import DeleteLinkedDocModal from '@/components/DeleteLinkedDocModal.vue'
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
import LayoutHeader from '@/components/LayoutHeader.vue'
import Activities from '@/components/Activities/Activities.vue'
import AssignTo from '@/components/AssignTo.vue'
import FilesUploader from '@/components/FilesUploader/FilesUploader.vue'
import SidePanelLayout from '@/components/SidePanelLayout.vue'
import SLASection from '@/components/SLASection.vue'
import CustomActions from '@/components/CustomActions.vue'
import AppStyling from '@/components/AppStyling.vue'
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
} from 'frappe-ui'
import { ref, computed, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useActiveTabManager } from '@/composables/useActiveTabManager'

const { brand } = getSettings()
const { $dialog, $socket, makeCall } = globalStore()
const { statusOptions, getEmailCampaignStatus } = statusesStore()
const { doctypeMeta } = getMeta('Email Campaign')

const route = useRoute()
const router = useRouter()

const props = defineProps({
  emailCampaignId: {
    type: String,
    required: true,
  },
})

const reload = ref(false)
const activities = ref(null)
const errorTitle = ref('')
const errorMessage = ref('')
const showDeleteLinkedDocModal = ref(false)
const showFilesUploader = ref(false)

const { triggerOnChange, assignees, document, scripts, error } = useDocument(
  'Email Campaign',
  props.emailCampaignId,
)

const doc = computed(() => document.doc || {})

watch(error, (err) => {
  if (err) {
    errorTitle.value = __(
      err.exc_type == 'DoesNotExistError'
        ? 'Document not found'
        : 'Error occurred',
    )
    errorMessage.value = __(err.messages?.[0] || 'An error occurred')
  } else {
    errorTitle.value = ''
    errorMessage.value = ''
  }
})

watch(
  () => document.doc,
  async (_doc) => {
    if (scripts.data?.length) {
      let s = await setupCustomizations(scripts.data, {
        doc: _doc,
        $dialog,
        $socket,
        router,
        toast,
        updateField,
        createToast: toast.create,
        deleteDoc: deleteEmailCampaign,
        call,
      })
      document._actions = s.actions || []
      document._statuses = s.statuses || []
    }
  },
  { once: true },
)

const breadcrumbs = computed(() => {
  let items = [{ label: __('Email Campaigns'), route: { name: 'Email Campaign' } }]

  if (route.query.view || route.query.viewType) {
    let view = getView(route.query.view, route.query.viewType, 'Email Campaign')
    if (view) {
      items.push({
        label: __(view.label),
        icon: view.icon,
        route: {
          name: 'Email Campaign',
          params: { viewType: route.query.viewType },
          query: { view: route.query.view },
        },
      })
    }
  }

  items.push({
    label: title.value,
    route: { name: 'EmailCampaignDetail', params: { emailCampaignId: props.emailCampaignId } },
  })
  return items
})

const title = computed(() => {
  let t = doctypeMeta['Email Campaign']?.title_field || 'name'
  return doc?.[t] || props.emailCampaignId
})

usePageMeta(() => {
  return { title: title.value, icon: brand.favicon }
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
  ]
  return tabOptions.filter((tab) => (tab.condition ? tab.condition() : true))
})

const { tabIndex, changeTabTo } = useActiveTabManager(tabs, 'lastEmailCampaignTab')

const sections = createResource({
  url: 'crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_fields_layout',
  cache: ['SidePanel', 'Email Campaign'],
  params: { doctype: 'Email Campaign', type: 'Side Panel' },
  auto: true,
  onError(error) {
    console.error('Error loading sections layout:', error)
    // simple layout if API fails
    return {
      data: [{
        name: 'General',
        label: 'General',
        sections: [{
          columns: [{
            fields: [
              { fieldname: 'campaign_name', label: 'Campaign', fieldtype: 'Link', options: 'Campaign' },
              { fieldname: 'email_campaign_for', label: 'Email Campaign For', fieldtype: 'Select', options: 'Lead\nContact\nEmail Group' },
              { fieldname: 'recipient', label: 'Recipient', fieldtype: 'Dynamic Link', options: 'email_campaign_for' },
              { fieldname: 'sender', label: 'Sender', fieldtype: 'Link', options: 'User' },
              { fieldname: 'start_date', label: 'Start Date', fieldtype: 'Date' },
              { fieldname: 'end_date', label: 'End Date', fieldtype: 'Date' },
              { fieldname: 'status', label: 'Status', fieldtype: 'Select', options: 'Scheduled\nIn Progress\nCompleted\nUnsubscribed' }
            ]
          }]
        }]
      }]
    }
  }
})

// Remove client-side mutation of end_date to avoid perpetual dirty state

async function triggerStatusChange(value) {
  await triggerOnChange('status', value)
  document.save.submit()
}

function updateField(name, value) {
  value = Array.isArray(name) ? '' : value
  let oldValues = Array.isArray(name) ? {} : doc.value[name]

  if (Array.isArray(name)) {
    name.forEach((field) => (doc.value[field] = value))
  } else {
    doc.value[name] = value
  }

  document.save.submit(null, {
    onSuccess: () => (reload.value = true),
    onError: (err) => {
      if (Array.isArray(name)) {
        name.forEach((field) => (doc.value[field] = oldValues[field]))
      } else {
        doc.value[name] = oldValues
      }
      toast.error(err.messages?.[0] || __('Error updating field'))
    },
  })
}

function deleteEmailCampaign() {
  const confirmed = window.confirm(__('Are you sure you want to delete this Email Campaign? This action cannot be undone.'))
  if (!confirmed) return
  call('frappe.client.delete', {
    doctype: 'Email Campaign',
    name: props.emailCampaignId,
  }).then(() => {
    toast.success(__('Email Campaign deleted successfully'))
    router.push({ name: 'Email Campaign' })
  }).catch((err) => {
    toast.error(err?.messages?.[0] || __('Failed to delete Email Campaign'))
  })
}

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
  if (data?.hasOwnProperty('campaign_owner')) {
    assignees.reload()
  }
}
</script> 