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
        <AssignTo v-model="assignees.data" doctype="CRM Lead" :docname="leadId" />
        <Dropdown
          v-if="doc"  
          :options="
            statusOptions(
              'lead',
              document.statuses?.length ? document.statuses : document._statuses,
              triggerStatusChange,
            )
          "
        >
          <template #default="{ open }">
            <Button v-if="doc.status" :label="doc.status">  
              <template #prefix>
                <IndicatorIcon :class="getLeadStatus(doc.status).color" />
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
        <Button
          :label="__('Convert to Donor')"
          variant="solid"
          @click="convertLeadToDonor"
        />
      </template>
    </LayoutHeader>
    
    <div v-if="doc.name" class="flex h-full overflow-hidden !bg-gradient-to-br !from-[#fef7ff] !to-[#f8faff] min-h-screen" style="background: linear-gradient(to bottom right, #fef7ff, #f8faff); min-height: 100vh;">
      <Tabs as="div" v-model="tabIndex" :tabs="tabs">
        <template #tab-panel>
          <Activities
            ref="activities"
            doctype="CRM Lead"
            :docname="leadId"
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
        @click="copyToClipboard(leadId)"
      >
        {{ __(leadId) }}
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
              <Tooltip :text="doc.lead_name || __('Set first name')">
                <div class="truncate text-2xl font-medium text-ink-gray-9">
                  {{ title }}
                </div>
              </Tooltip>
              <div class="flex gap-1.5">
                <Tooltip v-if="callEnabled" :text="__('Make a call')">
                  <div>
                    <Button
                      @click="
                        () =>
                          doc.mobile_no
                            ? makeCall(doc.mobile_no)
                            : toast.error(__('No phone number set'))
                      "
                    >
                      <template #icon>
                        <PhoneIcon />
                      </template>
                    </Button>
                  </div>
                </Tooltip>
                <Tooltip :text="__('Send an email')">
                  <div>
                    <Button
                      @click="
                        doc.email
                          ? openEmailBox()
                          : toast.error(__('No email set'))
                      "
                    >
                      <template #icon>
                        <Email2Icon />
                      </template>
                    </Button>
                  </div>
                </Tooltip>
                <Tooltip :text="__('Go to website')">
                  <div>
                    <Button
                      @click="
                        doc.website
                          ? openWebsite(doc.website)
                          : toast.error(__('No website set'))
                      "
                    >
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
                      @click="deleteLead"
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
          doctype="CRM Lead"
          :docname="leadId"
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
    doctype="CRM Lead"
    :docname="leadId"
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
    :doctype="'CRM Lead'"
    :docname="leadId"
    name="Leads"
  />
  <div
    v-if="isConverting"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm"
  >
    <span class="loader"></span>
  </div>
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
import { useDonorFieldValidation } from '@/composables/useDonorFieldValidation'
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
const { statusOptions, getLeadStatus } = statusesStore()
const { doctypeMeta } = getMeta('CRM Lead')

const route = useRoute()
const router = useRouter()

const props = defineProps({
  leadId: {
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
const isConverting = ref(false)

const { triggerOnChange, assignees, document, scripts, error } = useDocument(
  'CRM Lead',
  props.leadId,
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
        deleteDoc: deleteLead,
        call,
      })
      document._actions = s.actions || []
      document._statuses = s.statuses || []
    }
  },
  { once: true },
)

const breadcrumbs = computed(() => {
  let items = [{ label: __('Leads'), route: { name: 'Leads' } }]

  if (route.query.view || route.query.viewType) {
    let view = getView(route.query.view, route.query.viewType, 'CRM Lead')
    if (view) {
      items.push({
        label: __(view.label),
        icon: view.icon,
        route: {
          name: 'Leads',
          params: { viewType: route.query.viewType },
          query: { view: route.query.view },
        },
      })
    }
  }

  items.push({
    label: title.value,
    route: { name: 'Lead', params: { leadId: props.leadId } },
  })
  return items
})

const title = computed(() => {
  let t = doctypeMeta['CRM Lead']?.title_field || 'name'
  return doc?.[t] || props.leadId
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

const { tabIndex, changeTabTo } = useActiveTabManager(tabs, 'lastLeadTab')

const sections = createResource({
  url: 'crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_sidepanel_sections',
  cache: ['sidePanelSections', 'CRM Lead'],
  params: { doctype: 'CRM Lead' },
  auto: true,
})

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

function deleteLead() {
  showDeleteLinkedDocModal.value = true
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
  if (data?.hasOwnProperty('lead_owner')) {
    assignees.reload()
  }
}

async function convertLeadToDonor() {
  if (!doc.value?.name) return
  isConverting.value = true
  try {
    await call('crm.fcrm.doctype.crm_lead.crm_lead.convert_to_deal', {
      lead: doc.value.name,
    })
    toast.success(__('Lead converted to donor'))
    router.push({ name: 'Leads' })
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Error converting lead'))
  } finally {
    isConverting.value = false
  }
}

// Input masking and validation: CNIC and Phone on Lead detail (Data tab)
const {
  applyCnicMaskToInput,
  validateCnicFormat,
  applyPhoneMasksForCountry,
  validatePhoneNumber,
  showPhoneValidationFeedback,
} = useDonorFieldValidation()

function setFieldValue(fieldName, value) {
  if (document.doc) {
    if (document.doc[fieldName] !== value) {
      document.doc[fieldName] = value
    }
  }
}

watch(
  () => doc.value?.custom_identification_type,
  (newType, oldType) => {
    if (!newType) return
    // Skip clearing on initial load (oldType undefined) to preserve saved value
    if (oldType !== undefined && newType !== oldType) {
      if (document.doc) {
        document.doc.custom_identification_value = ''
      }
    }
    nextTick(() => {
      applyCnicMaskToInput(
        'custom_identification_value',
        newType,
        setFieldValue,
      )
    })
  },
)

watch(
  () => doc.value?.custom_identification_value,
  (newValue, oldValue) => {
    if (!doc.value?.custom_identification_type) return
    // Always re-apply mask, but avoid writing same value back
    nextTick(() => {
      applyCnicMaskToInput(
        'custom_identification_value',
        doc.value.custom_identification_type,
        setFieldValue,
      )
    })
  },
)

watch(
  () => doc.value?.country,
  (newCountry, oldCountry) => {
    if (!newCountry) return
    if (oldCountry && oldCountry !== newCountry && document.doc) {
      document.doc.mobile_no = ''
    }
    setTimeout(() => {
      applyPhoneMasksForCountry(newCountry, setFieldValue, ['mobile_no'])
    }, 300)
  },
)

watch(
  () => doc.value?.mobile_no,
  async (newValue) => {
    if (newValue && doc.value?.country) {
      const validation = await validatePhoneNumber(newValue, doc.value.country)
      if (!validation.isValid) {
        showPhoneValidationFeedback('mobile_no', false, validation.message)
      } else {
        showPhoneValidationFeedback('mobile_no', true, '')
      }
    }
  },
)

// Initialize masks when page loads
nextTick(() => {
  if (doc.value?.custom_identification_type) {
    setTimeout(() => {
      applyCnicMaskToInput(
        'custom_identification_value',
        doc.value.custom_identification_type,
        setFieldValue,
      )
    }, 500)
  }
  if (doc.value?.country) {
    setTimeout(() => {
      applyPhoneMasksForCountry(doc.value.country, setFieldValue, ['mobile_no'])
    }, 500)
  }
})
</script>

<style>
.spinner-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.loader {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: inline-block;
  position: relative;
  border-top: 4px solid #fff;
  border-right: 4px solid transparent;
  box-sizing: border-box;
  animation: rotation 1s linear infinite;
}
.loader::after {
  content: '';
  box-sizing: border-box;
  position: absolute;
  left: 0;
  top: 0;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border-left: 4px solid #FF3D00;
  border-bottom: 4px solid transparent;
  animation: rotation 0.5s linear infinite reverse;
}
@keyframes rotation {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>