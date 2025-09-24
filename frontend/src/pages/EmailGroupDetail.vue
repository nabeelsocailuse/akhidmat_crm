<template>
  <AppStyling
    type="detail-background"
    class="min-h-screen"
    style="background: linear-gradient(to bottom right, #fef7ff, #f8faff); min-height: 100vh;"
  >
    <LayoutHeader>
      <!-- Left header: Breadcrumbs -->
      <template #left-header>
        <Breadcrumbs :items="breadcrumbs">
          <template #prefix="{ item }">
            <Icon v-if="item.icon" :icon="item.icon" class="mr-2 h-4" />
          </template>
        </Breadcrumbs>
      </template>

      <!-- Right header: Actions -->
      <template v-if="!errorTitle" #right-header>
        <CustomActions
          v-if="document._actions?.length"
          :actions="document._actions"
        />
        <CustomActions
          v-if="document.actions?.length"
          :actions="document.actions"
        />

        <Dropdown :options="actions" placement="bottom-end" class="ml-2">
          <Button variant="subtle">
            {{ __('Actions') }}
          </Button>
        </Dropdown>
        <AssignTo
          v-model="assignees.data"
          doctype="Email Group"
          :docname="emailGroupId"
        />
      </template>
    </LayoutHeader>

    <!-- Main Content -->
    <div
      v-if="doc.name"
      class="flex h-full overflow-hidden bg-gradient-to-br from-[#fef7ff] to-[#f8faff] min-h-screen"
    >
      <!-- Tabs -->
      <Tabs as="div" v-model="tabIndex" :tabs="tabs">
        <template #tab-panel>
          <Activities
            ref="activities"
            doctype="Email Group"
            :docname="emailGroupId"
            :tabs="tabs"
            v-model:reload="reload"
            v-model:tabIndex="tabIndex"
            @beforeSave="saveChanges"
            @afterSave="reloadAssignees"
          />
        </template>
      </Tabs>

      <!-- Side Panel -->
      <Resizer class="flex flex-col justify-between border-l" side="right">
        <!-- Header with copy -->
        <div
          class="flex h-10.5 cursor-copy items-center border-b px-5 py-2.5 text-lg font-medium text-ink-gray-9"
          @click="copyToClipboard(emailGroupId)"
        >
          {{ __(emailGroupId) }}
        </div>

        <!-- File uploader + Title + Actions -->
        <FileUploader
          @success="(file) => updateField('image', file.file_url)"
          :validateFile="validateIsImageFile"
        >
          <template #default="{ openFileSelector }">
            <div class="flex items-center justify-start gap-5 border-b p-5">
              <!-- Avatar -->
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

              <!-- Title + Buttons -->
              <div class="flex flex-col gap-2.5 truncate">
                <Tooltip :text="doc.title || __('Set title')">
                  <div class="truncate text-2xl font-medium text-ink-gray-9">
                    {{ title }}
                  </div>
                </Tooltip>

                <div class="flex gap-1.5">
                  <!-- Send Email -->
                  <Tooltip :text="__('Send Email')">
                    <Button @click="openEmailBox">
                      <template #icon>
                        <Email2Icon />
                      </template>
                    </Button>
                  </Tooltip>

                  <!-- Attach File -->
                  <Tooltip :text="__('Attach a file')">
                    <Button @click="showFilesUploader = true">
                      <template #icon>
                        <AttachmentIcon />
                      </template>
                    </Button>
                  </Tooltip>

                  <!-- Delete -->
                  <Tooltip :text="__('Delete')">
                    <Button
                      @click="deleteEmailGroup"
                      variant="subtle"
                      theme="red"
                      icon="trash-2"
                    />
                  </Tooltip>
                </div>

                <ErrorMessage :message="__(error)" />
              </div>
            </div>
          </template>
        </FileUploader>

        <!-- SLA -->
        <SLASection
          v-if="doc.sla_status"
          v-model="doc"
          @updateField="updateField"
        />

        <!-- Side Panel Layout -->
        <div
          v-if="sections.data"
          class="flex flex-1 flex-col justify-between overflow-hidden"
        >
          <SidePanelLayout
            :sections="sections.data"
            doctype="Email Group"
            :docname="emailGroupId"
            @reload="sections.reload"
            @afterFieldChange="reloadAssignees"
          />
        </div>
      </Resizer>
    </div>
  </AppStyling>

  <!-- Error Page -->
  <ErrorPage
    v-if="errorTitle"
    :errorTitle="errorTitle"
    :errorMessage="errorMessage"
  />

  <!-- Files Uploader -->
  <FilesUploader
    v-model="showFilesUploader"
    doctype="Email Group"
    :docname="emailGroupId"
    @after="
      () => {
        activities?.all_activities?.reload()
        changeTabTo('attachments')
      }
    "
  />

  <!-- Delete Modal -->
  <DeleteLinkedDocModal
    v-if="showDeleteLinkedDocModal"
    v-model="showDeleteLinkedDocModal"
    doctype="Email Group"
    :docname="emailGroupId"
    name="Email Groups"
  />

  <!-- Import Subscribers Dialog -->
  <Dialog v-model="showImportDialog">
    <template #body-title>
      <h3 class="text-2xl font-semibold text-blue-600">
        {{ __('Import Subscribers') }}
      </h3>
    </template>

    <template #body-content>
      <div class="p-2 flex justify-center w-full">
        <div class="w-full">
          <div class="mb-2 text-sm font-medium text-gray-700">
            {{ __('Import Email From') }}
          </div>
          <Select
            :options="importOptions"
            v-model="selectedImportType"
            :placeholder="__('Choose an option')"
          />
        </div>
      </div>
    </template>

    <template #actions="{ close }">
      <div class="flex justify-start flex-row-reverse gap-2">
        <Button
          variant="solid"
          @click="() => confirmImportSubscribers(close)"
        >
          {{ __('Import') }}
        </Button>
        <Button
          variant="outline"
          @click="() => { showImportDialog = false; close() }"
        >
          {{ __('Cancel') }}
        </Button>
      </div>
    </template>
  </Dialog>

  <!-- Add Subscribers Dialog -->
  <Dialog v-model="showAddDialog">
    <template #body-title>
      <h3 class="text-2xl font-semibold text-blue-600">
        {{ __('Add Subscribers') }}
      </h3>
    </template>

    <template #body-content>
      <div class="p-1 w-full">
        <div class="mb-2 text-sm text-gray-600">
          {{ __('Enter email addresses (one per line or comma separated)') }}
        </div>
        <Textarea
          variant="subtle"
          size="sm"
          :placeholder="__('Enter emails here...')"
          :label="__('Message')"
          v-model="subscribersText"
        />
      </div>
    </template>

    <template #actions="{ close }">
      <div class="flex justify-start flex-row-reverse gap-2">
        <Button
          variant="solid"
          @click="() => confirmAddSubscribers(close)"
        >
          {{ __('Add') }}
        </Button>
        <Button
          variant="outline"
          @click="() => { showAddDialog = false; close() }"
        >
          {{ __('Cancel') }}
        </Button>
      </div>
    </template>
  </Dialog>
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
import TaskIcon from '@/components/Icons/TaskIcon.vue'
import NoteIcon from '@/components/Icons/NoteIcon.vue'
import AttachmentIcon from '@/components/Icons/AttachmentIcon.vue'
import CameraIcon from '@/components/Icons/CameraIcon.vue'
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
  Dialog,
  Select,
  Textarea,
} from 'frappe-ui'
import { ref, computed, watch, nextTick, h } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useActiveTabManager } from '@/composables/useActiveTabManager'

const { brand } = getSettings()
const { $socket, $dialog } = globalStore()
const { statusOptions } = statusesStore()
const { doctypeMeta } = getMeta('Email Group')

const route = useRoute()
const router = useRouter()

const props = defineProps({
  emailGroupId: {
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
  'Email Group',
  props.emailGroupId,
)

const doc = computed(() => document.doc || {})

// --- Error handling ---
watch(error, (err) => {
  if (err) {
    errorTitle.value =
      err.exc_type == 'DoesNotExistError'
        ? __('Document not found')
        : __('Error occurred')
    errorMessage.value = __(err.messages?.[0] || 'An error occurred')
  } else {
    errorTitle.value = ''
    errorMessage.value = ''
  }
})

// --- Document watcher ---
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
        deleteDoc: deleteEmailGroup,
        call,
      })
      document._actions = s.actions || []
      document._statuses = s.statuses || []
    }

    if (_doc?.name) {
      try {
        const res = await call('frappe.client.get', {
          doctype: 'Email Group',
          name: _doc.name,
        })
        const payload = res?.message ?? res
        if (payload?.__onload?.import_types) {
          if (!document.doc) document.doc = {}
          document.doc.__onload = { import_types: payload.__onload.import_types }
        }
      } catch (e) {
        // ignore — import types optional
      }
    }
  },
  { immediate: true },
)

// --- Breadcrumbs ---
const breadcrumbs = computed(() => {
  let items = [{ label: __('Email Groups'), route: { name: 'Email Group' } }]

  if (route.query.view || route.query.viewType) {
    let view = getView(route.query.view, route.query.viewType, 'Email Group')
    if (view) {
      items.push({
        label: __(view.label),
        icon: view.icon,
        route: {
          name: 'Email Group',
          params: { viewType: route.query.viewType },
          query: { view: route.query.view },
        },
      })
    }
  }

  items.push({
    label: title.value,
    route: {
      name: 'EmailGroupDetail',
      params: { emailGroupId: props.emailGroupId },
    },
  })
  return items
})

// --- Title ---
const title = computed(() => {
  let t = doctypeMeta['Email Group']?.title_field || 'name'
  return doc.value?.[t] || props.emailGroupId
})

usePageMeta(() => {
  return { title: title.value, icon: brand.favicon }
})

// --- Tabs ---
const tabs = computed(() => [
  { name: 'Activity', label: __('Activity'), icon: ActivityIcon },
  { name: 'Emails', label: __('Emails'), icon: EmailIcon },
  { name: 'Comments', label: __('Comments'), icon: CommentIcon },
  { name: 'Data', label: __('Data'), icon: DetailsIcon },
  { name: 'Tasks', label: __('Tasks'), icon: TaskIcon },
  { name: 'Notes', label: __('Notes'), icon: NoteIcon },
  { name: 'Attachments', label: __('Attachments'), icon: AttachmentIcon },
])

const { tabIndex, changeTabTo } = useActiveTabManager(tabs, 'lastEmailGroupTab')

// --- Side Panel ---
const sections = createResource({
  url: 'crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_fields_layout',
  cache: ['SidePanel', 'Email Group'],
  params: { doctype: 'Email Group', type: 'Side Panel' },
  auto: true,
})

// --- Actions ---
function updateField(name, value) {
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
        name.forEach((field) => (doc.value[name] = oldValues[field]))
      } else {
        doc.value[name] = oldValues
      }
      toast.error(err.messages?.[0] || __('Error updating field'))
    },
  })
}

function deleteEmailGroup() {
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
  if (data?.hasOwnProperty('group_owner')) {
    assignees.reload()
  }
}

function setTotalSubscribers(count) {
  if (document.doc) {
    document.doc.total_subscribers = count
  }
}

async function importSubscribers() {
  try {
    const res = await call('frappe.desk.form.load.getdoc', {
      doctype: 'Email Group',
      name: props.emailGroupId,
    })

    const importTypes = res?.docs?.[0]?.__onload?.import_types || []
    console.log("Available import types:", importTypes)

    if (!importTypes.length) {
      toast.error(__('No import types available'))
      return
    }

    importOptions.value = importTypes.map((d) =>
      typeof d === 'string' ? { label: d, value: d } : { label: d.label, value: d.value }
    )
    selectedImportType.value = ''
    showImportDialog.value = true

  } catch (err) {
    console.error("Failed to fetch import types:", err)
    toast.error(__('Failed to fetch import types'))
  }
}


function addSubscribers() {
  subscribersText.value = ''
  showAddDialog.value = true
}

// function newNewsletter() {
//   openWebsite(`/app/newsletter/new?email_group=${props.emailGroupId}`)
// }

const actions = [
  { label: __('Import Subscribers'), onClick: importSubscribers },
  { label: __('Add Subscribers'), onClick: addSubscribers },
  // { label: __('New Newsletter'), onClick: newNewsletter },
]

const showImportDialog = ref(false)
const importOptions = ref([])
const selectedImportType = ref('')

const showAddDialog = ref(false)
const subscribersText = ref('')

function splitEmails(input) {
  if (!input) return []
  return input
    .split(/[,\n]/)
    .map((e) => e.trim())
    .filter((e) => e.length > 0)
}

function isValidEmail(email) {
  const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i
  return emailRegex.test(email)
}

async function confirmAddSubscribers(close) {
  const raw = (subscribersText.value || '').trim()
  if (!raw) {
    toast.error(__('Please enter at least one email address'))
    return
  }

  const candidates = splitEmails(raw)
  const valid = []
  const invalid = []
  for (const item of candidates) {
    if (isValidEmail(item)) valid.push(item)
    else invalid.push(item)
  }

  if (invalid.length) {
    invalid.forEach((e) => toast.error(__(`${e} is not a valid Email Address`)))
  }

  if (!valid.length) {
    toast.error(__('No valid email address found'))
    return
  }

  const previousTotal = Number(document.doc?.total_subscribers || 0)
  try {
    const res = await call('frappe.email.doctype.email_group.email_group.add_subscribers', {
      name: props.emailGroupId,
      email_list: valid.join('\n'),
    })
    const newTotal = res?.message ?? res
    setTotalSubscribers(newTotal)
    const added = Math.max(0, Number(newTotal) - previousTotal)
    toast.success(__(`${added} subscribers added`))
    close()
    showAddDialog.value = false
  } catch (err) {
    toast.error(err?.messages?.[0] || __('Failed to add subscribers'))
  }
}

async function confirmImportSubscribers(close) {
  if (!selectedImportType.value) {
    toast.error(__('Please select an option'))
    return
  }

  const previousTotal = Number(document.doc?.total_subscribers || 0)
  try {
    const r = await call('frappe.email.doctype.email_group.email_group.import_from', {
      name: props.emailGroupId,
      doctype: selectedImportType.value,
    })
    const newTotal = r?.message ?? r
    setTotalSubscribers(newTotal)
    const added = Math.max(0, Number(newTotal) - previousTotal)
    toast.success(__(`${added} subscribers added`))
    close()
    showImportDialog.value = false
  } catch (err) {
    console.error(err)
    toast.error(__('Failed to import subscribers'))
  }
}
</script>
