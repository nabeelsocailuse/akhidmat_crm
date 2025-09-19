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
        <AssignTo v-model="assignees.data" doctype="Tax Exemption Certificate" :docname="certificateId" />
      </template>
    </LayoutHeader>
    
    <div v-if="doc.name" class="flex h-full overflow-hidden !bg-gradient-to-br !from-[#fef7ff] !to-[#f8faff] min-h-screen" style="background: linear-gradient(to bottom right, #fef7ff, #f8faff); min-height: 100vh;">
      <Tabs as="div" v-model="tabIndex" :tabs="tabs">
        <template #tab-panel>
          <Activities
            ref="activities"
            doctype="Tax Exemption Certificate"
            :docname="certificateId"
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
        @click="copyToClipboard(certificateId)"
      >
        {{ __(certificateId) }}
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
          <Tooltip :text="doc.certificate_number || __('Set certificate number')">
            <div class="truncate text-2xl font-medium text-ink-gray-9">
              {{ title }}
            </div>
          </Tooltip>
          <div class="flex gap-1.5">
            <Tooltip :text="__('Delete')">
              <div>
                <Button
                  @click="deleteCertificate"
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
      <div
        v-if="sections.data"
        class="flex flex-1 flex-col justify-between overflow-hidden"
      >
        <SidePanelLayout
          :sections="sections.data"
          doctype="Tax Exemption Certificate"
          :docname="certificateId"
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
  
  <DeleteLinkedDocModal
    v-if="showDeleteLinkedDocModal"
    v-model="showDeleteLinkedDocModal"
    :doctype="'Tax Exemption Certificate'"
    :docname="certificateId"
    name="Tax Exemption Certificates"
  />
</template>

<script setup>
import DeleteLinkedDocModal from '@/components/DeleteLinkedDocModal.vue'
import ErrorPage from '@/components/ErrorPage.vue'
import Icon from '@/components/Icon.vue'
import Resizer from '@/components/Resizer.vue'
import ActivityIcon from '@/components/Icons/ActivityIcon.vue'
import EmailIcon from '@/components/Icons/EmailIcon.vue'
import CommentIcon from '@/components/Icons/CommentIcon.vue'
import DetailsIcon from '@/components/Icons/DetailsIcon.vue'
import NoteIcon from '@/components/Icons/NoteIcon.vue'
import AttachmentIcon from '@/components/Icons/AttachmentIcon.vue'
import LayoutHeader from '@/components/LayoutHeader.vue'
import Activities from '@/components/Activities/Activities.vue'
import AssignTo from '@/components/AssignTo.vue'
import SidePanelLayout from '@/components/SidePanelLayout.vue'
import CustomActions from '@/components/CustomActions.vue'
import AppStyling from '@/components/AppStyling.vue'
import {
  copyToClipboard,
} from '@/utils'
import { getView } from '@/utils/view'
import { getSettings } from '@/stores/settings'
import { globalStore } from '@/stores/global'
import { getMeta } from '@/stores/meta'
import { useDocument } from '@/data/document'
import {
  createResource,
  Avatar,
  Tabs,
  Breadcrumbs,
  call,
  usePageMeta,
  toast,
  Button,
  Tooltip,
} from 'frappe-ui'
import { ref, computed, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useActiveTabManager } from '@/composables/useActiveTabManager'

const { brand } = getSettings()
const { $dialog, $socket, makeCall } = globalStore()
const { doctypeMeta } = getMeta('Tax Exemption Certificate')

const route = useRoute()
const router = useRouter()

const props = defineProps({
  certificateId: {
    type: String,
    required: true,
  },
})

const reload = ref(false)
const activities = ref(null)
const errorTitle = ref('')
const errorMessage = ref('')
const showDeleteLinkedDocModal = ref(false)

const { triggerOnChange, assignees, document, scripts, error } = useDocument(
  'Tax Exemption Certificate',
  props.certificateId,
)
const doc = computed(() => document.doc || {})

watch(error, (err) => {
  if (err) {
    errorTitle.value = err.exc_type === 'DoesNotExistError' ? 'Document not found' : 'Error occurred';
    errorMessage.value = err.messages?.[0] || 'An error occurred';
  } else {
    errorTitle.value = '';
    errorMessage.value = '';
  }
});

const breadcrumbs = computed(() => {
  let items = [{ label: __('Tax Exemption Certificates'), route: { name: 'TaxExemptionCertificates' } }]

  if (route.query.view || route.query.viewType) {
    let view = getView(route.query.view, route.query.viewType, 'Tax Exemption Certificate')
    if (view) {
      items.push({
        label: __(view.label),
        icon: view.icon,
        route: {
          name: 'TaxExemptionCertificates',
          params: { viewType: route.query.viewType },
          query: { view: route.query.view },
        },
      })
    }
  }

  items.push({
    label: title.value,
    route: { name: 'TaxExemptionCertificate', params: { certificateId: props.certificateId } },
  })
  return items
})

const title = computed(() => {
  let t = doctypeMeta['Tax Exemption Certificate']?.title_field || 'name'
  return doc?.[t] || props.certificateId
})

usePageMeta(() => {
  return { title: title.value, icon: brand.favicon }
})

const tabs = computed(() => {
  let tabOptions = [
    // {
    //   name: 'Activity',
    //   label: __('Activity'),
    //   icon: ActivityIcon,
    // },
    // {
    //   name: 'Emails',
    //   label: __('Emails'),
    //   icon: EmailIcon,
    // },
    // {
    //   name: 'Comments',
    //   label: __('Comments'),
    //   icon: CommentIcon,
    // },
    {
      name: 'Data',
      label: __('Data'),
      icon: DetailsIcon,
    },
    // {
    //   name: 'Notes',
    //   label: __('Notes'),
    //   icon: NoteIcon,
    // },
    // {
    //   name: 'Attachments',
    //   label: __('Attachments'),
    //   icon: AttachmentIcon,
    // },
  ]
  return tabOptions
})

const { tabIndex, changeTabTo } = useActiveTabManager(tabs, 'lastTaxExemptionCertificateTab')

const sections = createResource({
  url: 'crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_sidepanel_sections',
  cache: ['sidePanelSections', 'Tax Exemption Certificate'],
  params: { doctype: 'Tax Exemption Certificate' },
  auto: true,
})

function saveChanges(data) {
  document.save.submit(null, {
    onSuccess: () => reloadAssignees(data),
  })
}

function reloadAssignees(data) {
  if (data?.hasOwnProperty('owner')) {
    assignees.reload()
  }
}

function deleteCertificate() {
  showDeleteLinkedDocModal.value = true
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
</script>

<style>
</style>