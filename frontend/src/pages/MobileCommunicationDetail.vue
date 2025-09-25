<template>
    <div class="min-h-screen bg-gradient-to-b from-[#fef7ff] to-[#F5F9FF]">
  <LayoutHeader>
    <header class="relative flex h-10.5 items-center justify-between gap-2 py-2.5 pl-2">
      <Breadcrumbs :items="breadcrumbs" />
    </header>
  </LayoutHeader>

  <div v-if="communication.data?.name" class="flex h-12 items-center justify-between gap-2 border-b px-3 py-2.5">
    <AssignTo v-model="assignees.data" doctype="Communication" :docname="props.communicationId" />
    <div class="flex items-center gap-2">
      <CustomActions v-if="communication.data._customActions?.length" :actions="communication.data._customActions" />
      <CustomActions v-if="document.actions?.length" :actions="document.actions" />
    </div>
  </div>

  <div v-if="communication?.data" class="flex h-full overflow-hidden">
    <Tabs as="div" v-model="tabIndex" :tabs="tabs" class="overflow-auto">
      <TabList class="!px-3" />
      <TabPanel v-slot="{ tab }">
        <div v-if="tab.name == 'Details'">
          <div v-if="(sections.data && sections.data.length) || (communicationSidebarSections?.length)" class="flex flex-1 flex-col justify-between overflow-hidden">
            <SidePanelLayout
              :sections="(sections.data && sections.data.length ? sections.data : communicationSidebarSections)"
              doctype="Communication"
              :docname="communication.data.name"
              @reload="sections.reload"
              @afterFieldChange="reloadAssignees"
            />
          </div>
        </div>
        <Activities
          v-else
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
      </TabPanel>
    </Tabs>
  </div>

  <ErrorPage v-else :errorTitle="errorTitle" :errorMessage="errorMessage" />

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
    doctype="Communication"
    :docname="props.communicationId"
    name="Communications"
  />
    </div>
</template>
  
<script setup>
import ErrorPage from '@/components/ErrorPage.vue'
import LayoutHeader from '@/components/LayoutHeader.vue'
import Activities from '@/components/Activities/Activities.vue'
import AssignTo from '@/components/AssignTo.vue'
import SidePanelLayout from '@/components/SidePanelLayout.vue'
import CustomActions from '@/components/CustomActions.vue'
import Breadcrumbs from '@/components/Breadcrumbs.vue'
import DeleteLinkedDocModal from '@/components/DeleteLinkedDocModal.vue'
import { useDocument } from '@/data/document'
import { getSettings } from '@/stores/settings'
import { getMeta } from '@/stores/meta'
import { useActiveTabManager } from '@/composables/useActiveTabManager'
import {
  createResource,
  Tabs,
  TabList,
  TabPanel,
  Breadcrumbs as FUBreadcrumbs,
  call,
  usePageMeta,
  toast,
  Button,
} from 'frappe-ui'
import ActivityIcon from '@/components/Icons/ActivityIcon.vue'
import EmailIcon from '@/components/Icons/EmailIcon.vue'
import CommentIcon from '@/components/Icons/CommentIcon.vue'
import DetailsIcon from '@/components/Icons/DetailsIcon.vue'
import PhoneIcon from '@/components/Icons/PhoneIcon.vue'
import TaskIcon from '@/components/Icons/TaskIcon.vue'
import NoteIcon from '@/components/Icons/NoteIcon.vue'
import AttachmentIcon from '@/components/Icons/AttachmentIcon.vue'
import WhatsAppIcon from '@/components/Icons/WhatsAppIcon.vue'
import FilesUploader from '@/components/FilesUploader/FilesUploader.vue'
import { whatsappEnabled, callEnabled } from '@/composables/settings'
import { getView } from '@/utils/view'
import { copyToClipboard } from '@/utils'
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
  
const { brand } = getSettings()
const { doctypeMeta } = getMeta('Communication')

const props = defineProps({ communicationId: { type: String, required: true } })

const router = useRouter()
const route = useRoute()

const errorTitle = ref('')
const errorMessage = ref('')
const reload = ref(false)
const showFilesUploader = ref(false)
const showDeleteLinkedDocModal = ref(false)

const { document, assignees } = useDocument('Communication', props.communicationId)

const communication = createResource({
  url: 'frappe.client.get',
  params: { doctype: 'Communication', name: props.communicationId },
  cache: ['communication', props.communicationId],
  auto: true,
  onError: (err) => {
    errorTitle.value = __('Not permitted')
    errorMessage.value = __(err.messages?.[0] || 'Error loading communication')
  },
})

onMounted(() => {
  if (!communication.data) communication.fetch()
})

const title = computed(() => communication.data?.subject || props.communicationId)

usePageMeta(() => ({ title: title.value, icon: brand.favicon }))

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
  items.push({ label: title.value, route: { name: 'MobileCommunicationDetail', params: { communicationId: props.communicationId } } })
  return items
})

const tabs = computed(() => {
  const tabOptions = [
    { name: 'Details', label: __('Details'), icon: DetailsIcon },
    { name: 'Activity', label: __('Activity'), icon: ActivityIcon },
    { name: 'Emails', label: __('Emails'), icon: EmailIcon },
    { name: 'Comments', label: __('Comments'), icon: CommentIcon },
    { name: 'Data', label: __('Data'), icon: DetailsIcon },
    { name: 'Calls', label: __('Calls'), icon: PhoneIcon, condition: () => callEnabled.value },
    { name: 'Tasks', label: __('Tasks'), icon: TaskIcon },
    { name: 'Notes', label: __('Notes'), icon: NoteIcon },
    { name: 'Attachments', label: __('Attachments'), icon: AttachmentIcon },
    { name: 'WhatsApp', label: __('WhatsApp'), icon: WhatsAppIcon, condition: () => whatsappEnabled.value },
  ]
  return tabOptions.filter((tab) => (tab.condition ? tab.condition() : true))
})

const { tabIndex, changeTabTo } = useActiveTabManager(tabs, 'lastCommunicationTab')

const sections = createResource({
  url: 'crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_sidepanel_sections',
  cache: ['sidePanelSections', 'Communication'],
  params: { doctype: 'Communication' },
  auto: true,
})

const communicationSidebarSections = computed(() => [
  {
    label: __('Communication Details'),
    name: 'communication_details_section',
    opened: true,
    columns: [
      {
        name: 'column_communication_details',
        fields: [
          { fieldname: 'subject', label: __('Subject'), fieldtype: 'Data', value: communication.data?.subject || '', placeholder: __('Enter communication subject'), reqd: true },
          { fieldname: 'communication_type', label: __('Communication Type'), fieldtype: 'Select', value: communication.data?.communication_type || '', options: 'Communication\nComment\nChat\nNotification\nFeedback\nAutomated Message', read_only: true },
          { fieldname: 'sent_or_received', label: __('Sent or Received'), fieldtype: 'Select', value: communication.data?.sent_or_received || '', options: 'Sent\nReceived' },
          { fieldname: 'communication_medium', label: __('Type'), fieldtype: 'Select', value: communication.data?.communication_medium || '', options: '\nEmail\nChat\nPhone\nSMS\nEvent\nMeeting\nVisit\nOther' },
          { fieldname: 'status', label: __('Status'), fieldtype: 'Select', value: communication.data?.status || '', options: 'Open\nReplied\nClosed\nLinked' },
        ],
      },
    ],
  },
])

const activities = ref(null)

const activityDoctype = computed(() => communication.data?.reference_doctype || 'Communication')
const activityDocname = computed(() => communication.data?.reference_docname || communication.data?.reference_name || props.communicationId)

function saveChanges(data) {
  document.save.submit(null, { onSuccess: () => reloadAssignees(data) })
}

function reloadAssignees(data) {
  if (data?.hasOwnProperty('communication_owner')) assignees.reload()
}

async function deleteCommunicationWithModal(name) { showDeleteLinkedDocModal.value = true }
  </script>
  