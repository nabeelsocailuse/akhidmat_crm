<template>
  <div class="min-h-screen bg-gradient-to-b from-[#fef7ff] to-[#F5F9FF]">
  <LayoutHeader>
    <header class="relative flex h-10.5 items-center justify-between gap-2 py-2.5 pl-2">
      <Breadcrumbs :items="breadcrumbs">
        <template #prefix="{ item }">
          <Icon v-if="item.icon" :icon="item.icon" class="mr-2 h-4" />
        </template>
      </Breadcrumbs>

      <!-- Right header: Status + Actions + AssignTo -->
      <div class="absolute right-0 flex items-center gap-2">
        <Dropdown
          v-if="doc"
          :options="statusOptions('email_group', document.statuses?.length ? document.statuses : document._statuses, triggerStatusChange)"
        >
          <template #default="{ open }">
            <Button v-if="doc.status" :label="doc.status">
              <template #prefix>
                <IndicatorIcon :class="getEmailGroupStatus(doc.status).color" />
              </template>
              <template #suffix>
                <FeatherIcon :name="open ? 'chevron-up' : 'chevron-down'" class="h-4" />
              </template>
            </Button>
          </template>
        </Dropdown>

        <!-- Custom Actions -->
        <CustomActions v-if="document._actions?.length" :actions="document._actions" />
        <CustomActions v-if="document.actions?.length" :actions="document.actions" />

        <!-- Actions Dropdown -->
        <Dropdown :options="actions" placement="bottom-end">
          <Button variant="subtle">{{ __('Actions') }}</Button>
        </Dropdown>

        <!-- Assign To -->
        <AssignTo v-model="assignees.data" doctype="Email Group" :docname="emailGroupId" />
      </div>
    </header>
  </LayoutHeader>

  <div
    v-if="doc.name"
    class="flex h-full overflow-hidden"
  >
    <Tabs as="div" v-model="tabIndex" :tabs="tabs" class="overflow-auto">
      <TabList class="!px-3" />
      <TabPanel v-slot="{ tab }">
        <div v-if="tab.name == 'Details'">
          <SLASection v-if="doc.sla_status" v-model="doc" @updateField="updateField" />
          <div v-if="sections.data" class="flex flex-1 flex-col justify-between overflow-hidden">
            <SidePanelLayout
              :sections="sections.data"
              doctype="Email Group"
              :docname="emailGroupId"
              @reload="sections.reload"
              @afterFieldChange="reloadAssignees"
            />
          </div>
        </div>

        <Activities
          v-else
          ref="activities"
          doctype="Email Group"
          :docname="emailGroupId"
          :tabs="tabs"
          v-model:reload="reload"
          v-model:tabIndex="tabIndex"
          @beforeSave="saveChanges"
          @afterSave="reloadAssignees"
        />
      </TabPanel>
    </Tabs>
  </div>

  <ErrorPage v-else-if="errorTitle" :errorTitle="errorTitle" :errorMessage="errorMessage" />

  <!-- Modals -->
  <DeleteLinkedDocModal
    v-if="showDeleteLinkedDocModal"
    v-model="showDeleteLinkedDocModal"
    :doctype="'Email Group'"
    :docname="emailGroupId"
    name="Email Groups"
  />

  <Dialog v-model="showImportDialog">
    <template #body-title>
      <h3 class="text-2xl font-semibold text-blue-600">{{ __('Import Subscribers') }}</h3>
    </template>
    <template #body-content>
      <div class="p-2 flex justify-center w-full">
        <div class="w-full">
          <div class="mb-2 text-sm font-medium text-gray-700">{{ __('Import Email From') }}</div>
          <Select :options="importOptions" v-model="selectedImportType" :placeholder="__('Choose an option')" />
        </div>
      </div>
    </template>
    <template #actions="{ close }">
      <div class="flex justify-start flex-row-reverse gap-2">
        <Button variant="solid" @click="() => confirmImportSubscribers(close)">{{ __('Import') }}</Button>
        <Button variant="outline" @click="() => { showImportDialog = false; close() }">{{ __('Cancel') }}</Button>
      </div>
    </template>
  </Dialog>

  <Dialog v-model="showAddDialog">
    <template #body-title>
      <h3 class="text-2xl font-semibold text-blue-600">{{ __('Add Subscribers') }}</h3>
    </template>
    <template #body-content>
      <div class="p-1 w-full">
        <div class="mb-2 text-sm text-gray-600">{{ __('Enter email addresses (one per line or comma separated)') }}</div>
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
        <Button variant="solid" @click="() => confirmAddSubscribers(close)">{{ __('Add') }}</Button>
        <Button variant="outline" @click="() => { showAddDialog = false; close() }">{{ __('Cancel') }}</Button>
      </div>
    </template>
  </Dialog>
  </div>
</template>

<script setup>
import DeleteLinkedDocModal from '@/components/DeleteLinkedDocModal.vue'
import ErrorPage from '@/components/ErrorPage.vue'
import LayoutHeader from '@/components/LayoutHeader.vue'
import Activities from '@/components/Activities/Activities.vue'
import AssignTo from '@/components/AssignTo.vue'
import SidePanelLayout from '@/components/SidePanelLayout.vue'
import SLASection from '@/components/SLASection.vue'
import CustomActions from '@/components/CustomActions.vue'
import Breadcrumbs from '@/components/Breadcrumbs.vue'
import Icon from '@/components/Icon.vue'
import IndicatorIcon from '@/components/Icons/IndicatorIcon.vue'
import FeatherIcon from '@/components/Icons/FeatherIcon.vue'
import { useDocument } from '@/data/document'
import { setupCustomizations, openWebsite } from '@/utils'
import { getMeta } from '@/stores/meta'
import { statusesStore } from '@/stores/statuses'
import { useActiveTabManager } from '@/composables/useActiveTabManager'
import { ref, computed, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { call, Tabs, TabList, TabPanel, Button, Dropdown, Dialog, Select, Textarea, toast} from 'frappe-ui'
const props = defineProps({ emailGroupId: { type: String, required: true } })

const errorTitle = ref('')
const errorMessage = ref('')
const showDeleteLinkedDocModal = ref(false)
const isSending = ref(false)
const showImportDialog = ref(false)
const showAddDialog = ref(false)
const importOptions = ref([])
const selectedImportType = ref('')
const subscribersText = ref('')

const { triggerOnChange, assignees, document, scripts, error } = useDocument('Email Group', props.emailGroupId)
const doc = computed(() => document.doc || {})

watch(error, (err) => {
  if (err) {
    errorTitle.value = err.exc_type == 'DoesNotExistError' ? __('Document not found') : __('Error occurred')
    errorMessage.value = __(err.messages?.[0] || 'An error occurred')
  } else {
    errorTitle.value = ''
    errorMessage.value = ''
  }
})

watch(() => document.doc, async (_doc) => {
  if (scripts.data?.length) {
    const s = await setupCustomizations(scripts.data, { doc: _doc, updateField, deleteDoc: deleteEmailGroup })
    document._actions = s.actions || []
    document._statuses = s.statuses || []
  }
}, { once: true })

const { statusOptions, getEmailGroupStatus } = statusesStore()
const route = useRoute()
const router = useRouter()
const reload = ref(false)

const title = computed(() => {
  const t = getMeta('Email Group').doctypeMeta['Email Group']?.title_field || 'name'
  return doc.value?.[t] || props.emailGroupId
})

const breadcrumbs = computed(() => [
  { label: __('Email Groups'), route: { name: 'MobileEmailGroupDetail', params: { emailGroupId: props.emailGroupId } } },
  { label: title.value }
])

const tabs = computed(() => [
  { name: 'Activity', label: __('Activity') },
  { name: 'Emails', label: __('Emails') },
  { name: 'Comments', label: __('Comments') },
  { name: 'Data', label: __('Data') },
  { name: 'Tasks', label: __('Tasks') },
  { name: 'Notes', label: __('Notes') },
  { name: 'Attachments', label: __('Attachments') },
])

const { tabIndex, changeTabTo } = useActiveTabManager(tabs, 'lastEmailGroupTab')

// --- Actions functions ---
function updateField(name, value) {
  const oldValue = doc.value[name]
  doc.value[name] = value
  document.save.submit(null, {
    onError: (err) => { doc.value[name] = oldValue; toast.error(err?.messages?.[0] || __('Error updating field')) },
    onSuccess: () => (reload.value = true),
  })
}

function deleteEmailGroup() {
  showDeleteLinkedDocModal.value = true
}

async function triggerStatusChange(value) {
  await triggerOnChange('status', value)
  document.save.submit()
}

function saveChanges(data) { document.save.submit(null, { onSuccess: () => assignees.reload() }) }
function reloadAssignees(data) { if (data?.hasOwnProperty('owner')) assignees.reload() }

function setTotalSubscribers(count) { if (document.doc) document.doc.total_subscribers = count }

function splitEmails(input) { return (input || '').split(/[,\n]/).map(e => e.trim()).filter(Boolean) }
function isValidEmail(email) { return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email) }

async function confirmAddSubscribers(close) {
  const raw = (subscribersText.value || '').trim()
  if (!raw) { toast.error(__('Please enter at least one email address')); return }
  const candidates = splitEmails(raw)
  const valid = []
  const invalid = []
  for (const item of candidates) {
    if (isValidEmail(item)) valid.push(item)
    else invalid.push(item)
  }
  if (invalid.length) invalid.forEach(e => toast.error(__(`${e} is not a valid Email Address`)))
  if (!valid.length) { toast.error(__('No valid email address found')); return }

  const previousTotal = Number(document.doc?.total_subscribers || 0)
  try {
    const res = await call('frappe.email.doctype.email_group.email_group.add_subscribers', {
      name: props.emailGroupId,
      email_list: valid.join('\n')
    })
    const newTotal = res?.message ?? res
    setTotalSubscribers(newTotal)
    const added = Math.max(0, Number(newTotal) - previousTotal)
    toast.success(__(`${added} subscribers added`))
    close()
    showAddDialog.value = false
  } catch (e) { toast.error(e?.messages?.[0] || __('Failed to add subscribers')) }
}

async function confirmImportSubscribers(close) {
  if (!selectedImportType.value) { toast.error(__('Please select an option')); return }
  const previousTotal = Number(document.doc?.total_subscribers || 0)
  try {
    const r = await call('frappe.email.doctype.email_group.email_group.import_from', {
      name: props.emailGroupId,
      doctype: selectedImportType.value
    })
    const newTotal = r?.message ?? r
    setTotalSubscribers(newTotal)
    const added = Math.max(0, Number(newTotal) - previousTotal)
    toast.success(__(`${added} subscribers added`))
    close()
    showImportDialog.value = false
  } catch (e) {
    console.error(e)
    toast.error(__('Failed to import subscribers'))
  }
}

async function importSubscribers() {
  try {
    const res = await call('frappe.desk.form.load.getdoc', {
      doctype: 'Email Group',
      name: props.emailGroupId,
    })
    const importTypes = res?.docs?.[0]?.__onload?.import_types || []
    if (!importTypes.length) { toast.error(__('No import types available')); return }
    importOptions.value = importTypes.map(d => typeof d === 'string' ? { label: d, value: d } : { label: d.label, value: d.value })
    selectedImportType.value = ''
    showImportDialog.value = true
  } catch (err) {
    console.error('Failed to fetch import types:', err)
    toast.error(__('Failed to fetch import types'))
  }
}

function addSubscribers() {
  subscribersText.value = ''
  showAddDialog.value = true
}

// Actions array
const actions = [
  { label: __('Import Subscribers'), onClick: importSubscribers },
  { label: __('Add Subscribers'), onClick: addSubscribers },
  // { label: __('New Newsletter'), onClick: () => openWebsite(`/app/newsletter/new?email_group=${props.emailGroupId}`) },
]
</script>
