<template>
  <AppStyling type="detail-background">
    <LayoutHeader v-if="campaign.data">
      <template #left-header>
        <Breadcrumbs :items="breadcrumbs">
          <template #prefix="{ item }">
            <Icon v-if="item.icon" :icon="item.icon" class="mr-2 h-4" />
          </template>
        </Breadcrumbs>
      </template>
      <template #right-header>
        <CustomActions
          v-if="campaign.data._customActions?.length"
          :actions="campaign.data._customActions"
        />
        <CustomActions
          v-if="document.actions?.length"
          :actions="document.actions"
        />
        <AssignTo
          v-model="assignees.data"
          :data="document.doc"
          doctype="Campaign"
        />
      </template>
    </LayoutHeader>
    
    <div v-if="campaign?.data" class="flex h-full overflow-hidden">
      <div class="flex-1 flex flex-col min-w-0">
        <Tabs as="div" v-model="tabIndex" :tabs="tabs">
          <template #tab-panel>
            <Activities
              ref="activities"
              doctype="Campaign"
              :tabs="tabs"
              v-model:reload="reload"
              v-model:tabIndex="tabIndex"
              v-model="campaign"
              :docname="props.campaignId"
              @beforeSave="saveChanges"
              @afterSave="reloadAssignees"
            />
          </template>
        </Tabs>
      </div>
    <div class="w-80 flex flex-col justify-between border-l bg-white flex-shrink-0">
      <div
        class="flex h-10.5 cursor-copy items-center border-b px-5 py-2.5 text-lg font-medium text-ink-gray-9"
        @click="copyToClipboard(props.campaignId)"
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
          <Tooltip :text="campaign.data.campaign_name || __('Set campaign name')">
            <div class="truncate text-2xl font-medium text-ink-gray-9">
              {{ title }}
            </div>
          </Tooltip>
          <div class="flex gap-1.5">
            <Tooltip :text="__('Copy link')">
              <div>
                <Button @click="copyToClipboard(campaign.data.name)">
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
                  @click="deleteCampaignWithModal(campaign.data.name)"
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
          doctype="Campaign"
          :docname="campaign.data.name"
          @reload="sections.reload"
          @afterFieldChange="reloadAssignees"
        >
          <template #fields>
            <Field
              v-for="field in document.doc.fields"
              :key="field.fieldname"
              :field="field"
              @updateField="updateField"
            />
          </template>
        </SidePanelLayout>
      </div>
      <!-- Fallback content if sections are not loaded or empty -->
      <div v-else-if="!sections.data || sections.data.length === 0" class="flex flex-1 flex-col justify-between overflow-hidden">
        <SidePanelLayout
          :sections="campaignSidebarSections"
          doctype="Campaign"
          :docname="campaign.data.name"
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
    v-if="campaign.data?.name"
    v-model="showFilesUploader"
    doctype="Campaign"
    :docname="props.campaignId"
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
    :doctype="'Campaign'"
    :docname="props.campaignId"
    name="Campaigns"
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
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useActiveTabManager } from '@/composables/useActiveTabManager'

const { brand } = getSettings()
const { $dialog, $socket, makeCall } = globalStore()
const { statusOptions } = statusesStore
const { doctypeMeta } = getMeta('Campaign')

const route = useRoute()
const router = useRouter()

const props = defineProps({
  campaignId: {
    type: String,
    required: true,
  },
})

const errorTitle = ref('')
const errorMessage = ref('')
const showDeleteLinkedDocModal = ref(false)

const { triggerOnChange, assignees, document } = useDocument(
  'Campaign',
  props.campaignId,
)

async function triggerStatusChange(value) {
  await triggerOnChange('status', value)
  document.save.submit()
}

const campaign = createResource({
  url: 'frappe.client.get',
  params: { doctype: 'Campaign', name: props.campaignId },
  cache: ['campaign', props.campaignId],
  onSuccess: (data) => {
    errorTitle.value = ''
    errorMessage.value = ''
    console.log('Campaign data loaded for Activities:', data)
    setupCustomizations(campaign, {
      doc: data,
      $dialog,
      $socket,
      router,
      toast,
      updateField,
      createToast: toast.create,
      deleteDoc: deleteCampaign,
      resource: { campaign, sections },
      call,
    })
  },
  onError: (err) => {
    if (err.messages?.[0]) {
      errorTitle.value = __('Not permitted')
      errorMessage.value = __(err.messages?.[0])
    } else {
      router.push({ name: 'Campaigns' })
    }
  },
})

onMounted(() => {
  if (campaign.data) return
  campaign.fetch()
})

const reload = ref(false)
const showFilesUploader = ref(false)

function updateCampaign(fieldname, value, callback) {
  value = Array.isArray(fieldname) ? '' : value

  if (!Array.isArray(fieldname) && validateRequired(fieldname, value)) return

  createResource({
    url: 'frappe.client.set_value',
    params: {
      doctype: 'Campaign',
      name: props.campaignId,
      fieldname,
      value,
    },
    auto: true,
    onSuccess: () => {
      campaign.reload()
      reload.value = true
      toast.success(__('Campaign updated successfully'))
      callback?.()
    },
    onError: (err) => {
      toast.error(err.messages?.[0] || __('Error updating campaign'))
    },
  })
}

function validateRequired(fieldname, value) {
  let meta = campaign.data.fields_meta || {}
  if (meta[fieldname]?.reqd && !value) {
    toast.error(__('{0} is a required field', [meta[fieldname].label]))
    return true
  }
  return false
}

const breadcrumbs = computed(() => {
  let items = [{ label: __('Campaigns'), route: { name: 'Campaigns' } }]

  if (route.query.view || route.query.viewType) {
            let view = getView(route.query.view, route.query.viewType, 'Campaign')
    if (view) {
      items.push({
        label: __(view.label),
        icon: view.icon,
        route: {
          name: 'Campaigns',
          params: { viewType: route.query.viewType },
          query: { view: route.query.view },
        },
      })
    }
  }

  items.push({
    label: title.value,
    route: { name: 'Campaign', params: { campaignId: campaign.data.name } },
  })
  return items
})

const title = computed(() => {
  // For standard Campaign, use campaign_name as the title field
  let t = 'campaign_name'
  return campaign.data?.[t] || props.campaignId
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

const { tabIndex, changeTabTo } = useActiveTabManager(tabs, 'lastCampaignTab')

// Campaign sidebar sections for when CRM Fields Layout is not available
const campaignSidebarSections = computed(() => [
  {
    label: __('Campaign Details'),
    name: 'campaign_details_section',
    opened: true,
    columns: [
      {
        name: 'column_campaign_details',
        fields: [
          {
            fieldname: 'campaign_name',
            label: __('Campaign Name'),
            fieldtype: 'Data',
            value: campaign.data?.campaign_name || '',
            placeholder: __('Enter campaign name'),
            reqd: true,
            create: () => {
              // Handle create new campaign name if needed
            }
          },
          {
            fieldname: 'description',
            label: __('Description'),
            fieldtype: 'Text',
            value: campaign.data?.description || '',
            placeholder: __('Enter description')
          },
          {
            fieldname: 'naming_series',
            label: __('Naming Series'),
            fieldtype: 'Select',
            value: campaign.data?.naming_series || 'SAL-CAM-.YYYY.-',
            options: ['SAL-CAM-.YYYY.-'],
            read_only: true
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
            value: campaign.data?.owner || '',
            placeholder: __('Select owner'),
            read_only: true
          },
          {
            fieldname: 'creation',
            label: __('Created'),
            fieldtype: 'Datetime',
            value: campaign.data?.creation || '',
            read_only: true
          },
          {
            fieldname: 'modified',
            label: __('Modified'),
            fieldtype: 'Datetime',
            value: campaign.data?.modified || '',
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
  cache: ['sidePanelSections', 'Campaign'],
  params: { doctype: 'Campaign' },
  auto: true,
  onSuccess: (data) => {
    console.log('Sections loaded:', data)
  },
  onError: (err) => {
    console.log('Sections error:', err)
  },
})

function updateField(name, value, callback) {
  updateCampaign(name, value, () => {
    campaign.data[name] = value
    callback?.()
  })
}

async function deleteCampaign(name) {
  await call('frappe.client.delete', {
    doctype: 'Campaign',
    name,
  })
  router.push({ name: 'Campaigns' })
}

async function deleteCampaignWithModal(name) {
  showDeleteLinkedDocModal.value = true
}

const activities = ref(null)

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
  if (data?.hasOwnProperty('lead_owner')) {
    assignees.reload()
  }
}
</script>
