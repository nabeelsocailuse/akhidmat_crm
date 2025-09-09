<template>
  <AppStyling type="detail-background" class="min-h-screen" style="background: linear-gradient(to bottom right, #fef7ff, #f8faff); min-height: 100vh;">
    <LayoutHeader>
      <template #left-header>
        <Breadcrumbs :items="breadcrumbs" />
      </template>
      <template v-if="!errorTitle" #right-header>
        <CustomActions v-if="document._actions?.length" :actions="document._actions" />
        <CustomActions v-if="document.actions?.length" :actions="document.actions" />
        <AssignTo v-model="assignees.data" doctype="Email Group Member" :docname="memberId" />
      </template>
    </LayoutHeader>

    <div v-if="doc.name" class="flex h-full overflow-hidden !bg-gradient-to-br !from-[#fef7ff] !to-[#f8faff] min-h-screen" style="background: linear-gradient(to bottom right, #fef7ff, #f8faff); min-height: 100vh;">
      <Tabs as="div" v-model="tabIndex" :tabs="tabs">
        <template #tab-panel>
          <Activities
            ref="activities"
            doctype="Email Group Member"
            :docname="memberId"
            :tabs="tabs"
            v-model:reload="reload"
            v-model:tabIndex="tabIndex"
            @beforeSave="saveChanges"
            @afterSave="reloadAssignees"
          />
        </template>
      </Tabs>
      <Resizer class="flex flex-col justify-between border-l" side="right">
        <div class="flex h-10.5 items-center border-b px-5 py-2.5 text-lg font-medium text-ink-gray-9" @click="copyToClipboard(memberId)">
          {{ __(memberId) }}
        </div>
        <div v-if="sections.data" class="flex flex-1 flex-col justify-between overflow-hidden">
          <SidePanelLayout
            :sections="sections.data"
            doctype="Email Group Member"
            :docname="memberId"
            @reload="sections.reload"
            @afterFieldChange="reloadAssignees"
          />
        </div>
      </Resizer>
    </div>
  </AppStyling>
  <ErrorPage v-if="errorTitle" :errorTitle="errorTitle" :errorMessage="errorMessage" />
  <FilesUploader
    v-model="showFilesUploader"
    doctype="Email Group Member"
    :docname="memberId"
    @after="() => { activities?.all_activities?.reload(); changeTabTo('attachments') }"
  />
</template>

<script setup>
import ErrorPage from '@/components/ErrorPage.vue'
import LayoutHeader from '@/components/LayoutHeader.vue'
import SidePanelLayout from '@/components/SidePanelLayout.vue'
import Activities from '@/components/Activities/Activities.vue'
import AssignTo from '@/components/AssignTo.vue'
import Resizer from '@/components/Resizer.vue'
import CustomActions from '@/components/CustomActions.vue'
import FilesUploader from '@/components/FilesUploader/FilesUploader.vue'
import AppStyling from '@/components/AppStyling.vue'
import { Breadcrumbs, Tabs, createResource, usePageMeta, toast } from 'frappe-ui'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getMeta } from '@/stores/meta'
import { getView } from '@/utils/view'
import { copyToClipboard } from '@/utils'
import { useDocument } from '@/data/document'
import { useActiveTabManager } from '@/composables/useActiveTabManager'
import ActivityIcon from '@/components/Icons/ActivityIcon.vue'
import EmailIcon from '@/components/Icons/EmailIcon.vue'
import CommentIcon from '@/components/Icons/CommentIcon.vue'
import DetailsIcon from '@/components/Icons/DetailsIcon.vue'
import PhoneIcon from '@/components/Icons/PhoneIcon.vue'
import TaskIcon from '@/components/Icons/TaskIcon.vue'
import NoteIcon from '@/components/Icons/NoteIcon.vue'
import AttachmentIcon from '@/components/Icons/AttachmentIcon.vue'
import WhatsAppIcon from '@/components/Icons/WhatsAppIcon.vue'
import { whatsappEnabled } from '@/composables/settings'


const route = useRoute()
const router = useRouter()

const props = defineProps({
  memberId: { type: String, required: true },
})

const errorTitle = ref('')
const errorMessage = ref('')
const showFilesUploader = ref(false)

const { doctypeMeta } = getMeta('Email Group Member')

const { triggerOnChange, assignees, document, scripts, error } = useDocument(
  'Email Group Member',
  props.memberId,
)

const doc = computed(() => document.doc || {})

watch(error, (err) => {
  if (err) {
    errorTitle.value = __(
      err.exc_type == 'DoesNotExistError' ? 'Document not found' : 'Error occurred',
    )
    errorMessage.value = __(err.messages?.[0] || 'An error occurred')
  } else {
    errorTitle.value = ''
    errorMessage.value = ''
  }
})

const breadcrumbs = computed(() => {
  let items = [{ label: __('Email Group Members'), route: { name: 'Email Group Members' } }]
  if (route.query.view || route.query.viewType) {
    let view = getView(route.query.view, route.query.viewType, 'Email Group Member')
    if (view) {
      items.push({
        label: __(view.label),
        icon: view.icon,
        route: {
          name: 'Email Group Members',
          params: { viewType: route.query.viewType },
          query: { view: route.query.view },
        },
      })
    }
  }
  items.push({ label: title.value, route: { name: 'EmailGroupMember', params: { memberId: props.memberId } } })
  return items
})

const title = computed(() => {
  let t = doctypeMeta['Email Group Member']?.title_field || 'name'
  return doc?.[t] || props.memberId
})

usePageMeta(() => ({ title: title.value }))

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

const { tabIndex, changeTabTo } = useActiveTabManager(tabs, 'lastEmailGroupMemberTab')

const sections = createResource({
  url: 'crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_sidepanel_sections',
  cache: ['sidePanelSections', 'Email Group Member'],
  params: { doctype: 'Email Group Member' },
  auto: true,
})

function saveChanges() {
  document.save?.submit(null, { onSuccess: () => assignees.reload?.() })
}

function reloadAssignees() {
  assignees.reload?.()
}
</script>