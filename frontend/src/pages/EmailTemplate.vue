<template>
  <AppStyling type="detail-background">
    <LayoutHeader v-if="emailTemplate.data">
      <template #left-header>
        <Breadcrumbs :items="breadcrumbs">
          <template #prefix="{ item }">
            <Icon v-if="item.icon" :icon="item.icon" class="mr-2 h-4" />
          </template>
        </Breadcrumbs>
      </template>
      <template #right-header>
        <CustomActions
          v-if="emailTemplate.data._customActions?.length"
          :actions="emailTemplate.data._customActions"
        />
        <CustomActions
          v-if="document.actions?.length"
          :actions="document.actions"
        />
        <AssignTo
          v-model="assignees.data"
          :data="document.doc"
          doctype="Email Template"
        />
      </template> 
    </LayoutHeader>
    
    <div v-if="emailTemplate?.data" class="flex h-full overflow-hidden">
      <div class="flex-1 flex flex-col min-w-0">
        <Tabs as="div" v-model="tabIndex" :tabs="tabs">
          <template #tab-panel="{ tab }">
            <template v-if="tab.name === 'Data'">
              <div class="p-4 flex flex-col gap-4">
                <div class="flex items-center justify-end gap-2">
                  <AppStyling
                    type="button"
                    buttonType="create"
                    buttonLabel="Save"
                    :disabled="!document?.isDirty"
                    :loading="document?.save?.loading"
                    @click="saveNow"
                  />
                </div>
                <FieldLayout
                  v-if="detailTabs.data && detailTabs.data.length"
                  :tabs="detailTabs.data"
                  :data="doc"
                  :doctype="'Email Template'"
                  @field-change="handleFieldChange"
                />
                <div>
                  <div class="mb-2 text-base text-ink-gray-7">{{ __('Response') }}</div>
                  <div class="p-2">
                    <TextEditor
                      v-if="useHtml"
                      editor-class="prose-sm min-h-[16rem] border rounded-b-lg border-t-0 p-2"
                      :content="doc?.response_html || ''"
                      placeholder="Type something..."
                      @change="(val) => updateField('response_html', val)"
                      :bubbleMenu="true"
                      :fixed-menu="true"
                    />
                    <TextEditor
                      v-else
                      editor-class="prose-sm min-h-[16rem] border rounded-b-lg border-t-0 p-2"
                      :content="doc?.response || ''"
                      placeholder="Type something..."
                      @change="(val) => updateField('response', val)"
                      :bubbleMenu="true"
                      :fixed-menu="true"
                    />
                  </div>
                </div>
              </div>
            </template>
            <template v-else>
              <Activities
                ref="activities"
                doctype="Email Template"
                :tabs="tabs"
                v-model:reload="reload"
                v-model:tabIndex="tabIndex"
                v-model="emailTemplate"
                :docname="props.emailTemplateId"
                @beforeSave="saveChanges"
                @afterSave="reloadAssignees"
              />
            </template>
          </template>
        </Tabs>
      </div>
      <div class="w-80 flex flex-col justify-between border-l bg-white flex-shrink-0">
        <div
          class="flex h-10.5 cursor-copy items-center border-b px-5 py-2.5 text-lg font-medium text-ink-gray-9"
          @click="copyToClipboard(props.emailTemplateId)"
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
            <Tooltip :text="emailTemplate.data.name || __('Set template name')">
              <div class="truncate text-2xl font-medium text-ink-gray-9">
                {{ title }}
              </div>
            </Tooltip>
            <div class="flex gap-1.5">
              <Tooltip :text="__('Copy link')">
                <div>
                  <Button @click="copyToClipboard(emailTemplate.data.name)">
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
                    @click="deleteEmailTemplateWithModal(emailTemplate.data.name)"
                    variant="subtle"
                    theme="red"
                    icon="trash-2"
                  />
                </div>
              </Tooltip>
            </div>
          </div>
        </div>
        <div class="flex flex-1 flex-col justify-between overflow-hidden">
          <SidePanelLayout
            :sections="computedSections"
            doctype="Email Template"
            :docname="emailTemplate.data.name"
            @reload="sections.reload"
            @afterFieldChange="reloadAssignees"
          >
            <template #fields></template>
          </SidePanelLayout>
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
    v-if="emailTemplate.data?.name"
    v-model="showFilesUploader"
    doctype="Email Template"
    :docname="props.emailTemplateId"
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
    :doctype="'Email Template'"
    :docname="props.emailTemplateId"
    name="Email Templates"
  />
</template>
<script setup>
import ErrorPage from '@/components/ErrorPage.vue'
import Icon from '@/components/Icon.vue'
import ActivityIcon from '@/components/Icons/ActivityIcon.vue'
import EmailIcon from '@/components/Icons/EmailIcon.vue'
import CommentIcon from '@/components/Icons/CommentIcon.vue'
import DetailsIcon from '@/components/Icons/DetailsIcon.vue'
import PhoneIcon from '@/components/Icons/PhoneIcon.vue'
import TaskIcon from '@/components/Icons/TaskIcon.vue'
import NoteIcon from '@/components/Icons/NoteIcon.vue'
import WhatsAppIcon from '@/components/Icons/WhatsAppIcon.vue'
import LinkIcon from '@/components/Icons/LinkIcon.vue'
import AttachmentIcon from '@/components/Icons/AttachmentIcon.vue'
import LayoutHeader from '@/components/LayoutHeader.vue'
import Activities from '@/components/Activities/Activities.vue'
import FieldLayout from '@/components/FieldLayout/FieldLayout.vue'
import AssignTo from '@/components/AssignTo.vue'
import FilesUploader from '@/components/FilesUploader/FilesUploader.vue'
import SidePanelLayout from '@/components/SidePanelLayout.vue'
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
  TextEditor,
  FormControl,
} from 'frappe-ui'
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { computed as vueComputed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useActiveTabManager } from '@/composables/useActiveTabManager'

const { brand } = getSettings()
const { $dialog, $socket, makeCall } = globalStore()
const { statusOptions } = statusesStore
const { doctypeMeta } = getMeta('Email Template')

const route = useRoute()
const router = useRouter()

const props = defineProps({
  emailTemplateId: {
    type: String,
    required: true,
  },
})

const errorTitle = ref('')
const errorMessage = ref('')
const showDeleteLinkedDocModal = ref(false)

const { triggerOnChange, assignees, document } = useDocument(
  'Email Template',
  props.emailTemplateId,
)

async function triggerStatusChange(value) {
  await triggerOnChange('status', value)
  document.save.submit()
}

const emailTemplate = createResource({
  url: 'frappe.client.get',
  params: { doctype: 'Email Template', name: props.emailTemplateId },
  cache: ['emailTemplate', props.emailTemplateId],
  onSuccess: (data) => {
    errorTitle.value = ''
    errorMessage.value = ''
    setupCustomizations(emailTemplate, {
      doc: data,
      $dialog,
      $socket,
      router,
      toast,
      updateField,
      createToast: toast.create,
      deleteDoc: deleteEmailTemplate,
      resource: { emailTemplate, sections },
      call,
    })
  },
  onError: (err) => {
    console.error('Error loading Email Template:', err)
    if (err.messages?.[0]) {
      errorTitle.value = __('Not permitted')
      errorMessage.value = __(err.messages?.[0])
    } else if (err.exc_type === 'DoesNotExistError') {
      errorTitle.value = __('Document Not Found')
      errorMessage.value = __('The Email Template might not be fully created yet. Please wait a moment and refresh the page.')
      
      setTimeout(() => {
        emailTemplate.fetch()
      }, 1000)
    } else {
      router.push({ name: 'EmailTemplates' })
    }
  },
})

onMounted(() => {
  if (emailTemplate.data) return
  emailTemplate.fetch()
})

const reload = ref(false)
const showFilesUploader = ref(false)

const doc = computed(() => document.doc || {})

const useHtml = computed(() => {
  const v = doc.value?.use_html
  return v === 1 || v === true || v === '1'
})

const breadcrumbs = computed(() => {
  let items = [{ label: __('Email Templates'), route: { name: 'EmailTemplates' } }]

  if (route.query.view || route.query.viewType) {
            let view = getView(route.query.view, route.query.viewType, 'Email Template')
    if (view) {
      items.push({
        label: __(view.label),
        icon: view.icon,
        route: {
          name: 'EmailTemplates',
          params: { viewType: route.query.viewType },
          query: { view: route.query.view },
        },
      })
    }
  }

  items.push({
    label: title.value,
    route: { name: 'EmailTemplate', params: { emailTemplateId: emailTemplate.data.name } },
  })
  return items
})

const title = computed(() => {
  let t = 'name'
  return emailTemplate.data?.[t] || props.emailTemplateId
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

const { tabIndex, changeTabTo } = useActiveTabManager(tabs, 'lastEmailTemplateTab')

const detailTabs = createResource({
  url: 'crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_fields_layout',
  cache: ['Detail', 'Email Template'],
  params: { doctype: 'Email Template', type: 'Detail' },
  auto: true,
  transform: (_tabs) => {
    if (!_tabs || !Array.isArray(_tabs)) return []
    _tabs.forEach((tab) => {
      tab.sections?.forEach((section) => {
        section.columns?.forEach((column) => {
          if (Array.isArray(column.fields)) {
            column.fields = column.fields.filter(
              (f) => !['response', 'response_html'].includes(f.fieldname),
            )
            column.fields.forEach((f) => {
              if (f.fieldname === 'reference_doctype') {
                f.fieldtype = 'Link'
                f.options = 'DocType'
                f.get_query = () => ({ doctype: 'DocType', filters: { name: ['in', ['CRM Lead', 'Donor', 'Contact']] } })
                f.link_filters = JSON.stringify({ name: ['in', ['CRM Lead', 'Donor', 'Contact']] })
              }
            })
          }
        })
      })
    })
    return _tabs
  },
})

function handleFieldChange(fieldname, value) {
  if (fieldname === 'use_html') {
    const normalized = value === 1 || value === true || value === '1'
    updateField('use_html', normalized ? 1 : 0)
    if (normalized && !doc.value.response_html && doc.value.response) {
      updateField('response_html', doc.value.response)
    }
  } else {
    updateField(fieldname, value)
  }
}

const emailTemplateSidebarSections = computed(() => [
  {
    label: __('Template Details'),
    name: 'template_details_section',
    opened: true,
    columns: [
      {
        name: 'column_template_details',
        fields: [
          {
            fieldname: 'name',
            label: __('Template Name'),
            fieldtype: 'Data',
            value: emailTemplate.data?.name || '',
            placeholder: __('Enter template name'),
            reqd: true,
            read_only: true
          },
          {
            fieldname: 'subject',
            label: __('Subject'),
            fieldtype: 'Data',
            value: emailTemplate.data?.subject || '',
            placeholder: __('Enter email subject'),
            reqd: true
          },
          {
            fieldname: 'use_html',
            label: __('Use HTML'),
            fieldtype: 'Check',
            value: emailTemplate.data?.use_html || false
          }
        ]
      }
    ]
  },
  {
    label: __('Content'),
    name: 'content_section',
    opened: true,
    columns: [
      {
        name: 'column_content',
        fields: [
          // {
          //   fieldname: 'response',
          //   label: __('Response (Text)'),
          //   fieldtype: 'Text',
          //   value: emailTemplate.data?.response || '',
          //   placeholder: __('Enter text response'),
          //   condition: () => !emailTemplate.data?.use_html
          // },
          // {
          //   fieldname: 'response_html',
          //   label: __('Response (HTML)'),
          //   fieldtype: 'Code',
          //   value: emailTemplate.data?.response_html || '',
          //   placeholder: __('Enter HTML response'),
          //   condition: () => emailTemplate.data?.use_html
          // }
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
            value: emailTemplate.data?.owner || '',
            placeholder: __('Select owner'),
            read_only: true
          },
          {
            fieldname: 'creation',
            label: __('Created'),
            fieldtype: 'Datetime',
            value: emailTemplate.data?.creation || '',
            read_only: true
          },
          {
            fieldname: 'modified',
            label: __('Modified'),
            fieldtype: 'Datetime',
            value: emailTemplate.data?.modified || '',
            read_only: true
          }
        ]
      }
    ]
  }
])

const computedSections = vueComputed(() => {
  if (sections.data && Array.isArray(sections.data) && sections.data.length) {
    return sections.data
  }

  try {
    const fields = doctypeMeta?.fields || []
    if (fields.length) {
      const detailFields = fields
        .filter((f) => ['Data', 'Check', 'Text', 'Code', 'Datetime', 'Link', 'Select'].includes(f.fieldtype))
        .map((f) => ({
          fieldname: f.fieldname,
          label: f.label || f.fieldname,
          fieldtype: f.fieldtype === 'Small Text' ? 'Data' : f.fieldtype,
          placeholder: f.placeholder || f.label || f.fieldname,
          read_only: f.read_only || false,
          reqd: f.reqd || 0,
          options: f.options || undefined,
        }))

      if (detailFields.length) {
        return [
          {
            label: __('Template Details'),
            name: 'template_details_section',
            opened: true,
            columns: [
              { name: 'column_template_details', fields: detailFields },
            ],
          },
        ]
      }
    }
  } catch (e) {
  }

  return emailTemplateSidebarSections.value
})

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
  cache: ['sidePanelSections', 'Email Template'],
  params: { doctype: 'Email Template' },
  auto: true,
  onSuccess: (data) => {
  },
  transform: (data) => {
    if (!data || !Array.isArray(data)) return data
    const allowed = ['Donor', 'CRM Lead', 'Contact']
    data.forEach((section) => {
      if (section.columns && Array.isArray(section.columns)) {
        section.columns.forEach((column) => {
          if (column.fields && Array.isArray(column.fields)) {
            column.fields.forEach((field) => {
              if (field.fieldname === 'name') {
                field.read_only = false
                field.hidden = false
                field.reqd = field.reqd || 1
                field.placeholder = field.placeholder || 'Template Name'
              }

              if (field.fieldtype === 'Link' && field.fieldname === 'reference_doctype') {
                field.options = 'DocType'
                field.link_filters = JSON.stringify({ name: ['in', allowed] })
                field.get_query = () => ({ doctype: 'DocType', filters: { name: ['in', allowed] } })
              }
            })
          }
        })
      }
    })
    let hasName = false
    data.forEach((section) => {
      section.columns?.forEach((column) => {
        if (column.fields?.some((f) => f.fieldname === 'name')) hasName = true
      })
    })
    if (!hasName) {
      try {
        const firstSection = data[0]
        const firstColumn = firstSection?.columns?.[0]
        if (firstColumn && Array.isArray(firstColumn.fields)) {
          firstColumn.fields.unshift({
            fieldname: 'name',
            label: 'Template Name',
            fieldtype: 'Data',
            reqd: 1,
            placeholder: 'Template Name',
          })
        }
      } catch (e) {
      
      }
    }
    return data
  },
  onError: (err) => {
  },
})

function updateField(name, value) {
  value = Array.isArray(name) ? '' : value
  if (Array.isArray(name)) {
    name.forEach((field) => (doc.value[field] = value))
  } else {
    doc.value[name] = value
  }
}

async function deleteEmailTemplate(name) {
  await call('frappe.client.delete', {
    doctype: 'Email Template',
    name,
  })
  router.push({ name: 'EmailTemplates' })
}

async function deleteEmailTemplateWithModal(name) {
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

function saveNow() {
  try {
    document.save.submit(null, {
      onSuccess: () => {
        toast.success(__('Saved'))
      },
      onError: (err) => {
        toast.error(err?.messages?.[0] || __('Failed to save'))
      },
    })
  } catch (e) {
    toast.error(__('Failed to save'))
  }
}
</script>