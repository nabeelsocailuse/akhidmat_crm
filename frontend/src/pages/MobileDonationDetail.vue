<template>
  <div class="min-h-screen bg-gradient-to-b from-[#fef7ff] to-[#F5F9FF]">
    <LayoutHeader>
      <header
        class="relative flex h-10.5 items-center justify-between gap-2 py-2.5 pl-2"
      >
        <Breadcrumbs :items="breadcrumbs" />

      </header>
    </LayoutHeader>

    <div
      v-if="donation.data?.name"
      class="flex h-12 items-center justify-between gap-2 border-b px-3 py-2.5"
    >
      <AssignTo v-model="assignees.data" doctype="Donation" :docname="donationId" />
      <div class="flex items-center gap-2">
        <CustomActions v-if="donation.data.actions?.length" :actions="donation.data.actions" />
        <Button label="Print" @click="printDonation" />
        <Button label="PDF" @click="openDonationPDF" />
      </div>
    </div>

    <div v-if="donation.data?.name" class="flex h-full overflow-hidden">
      <Tabs as="div" v-model="tabIndex" :tabs="tabs" class="overflow-auto">
        <TabList class="!px-3" />
        <TabPanel v-slot="{ tab }">
          <div v-if="tab.name == 'Details'">
            <SLASection
              v-if="donationDocument.doc?.sla_status"
              v-model="donationDocument.doc"
              @updateField="updateField"
            />
            <div
              v-if="sections.data"
              class="flex flex-1 flex-col justify-between overflow-hidden"
            >
              <SidePanelLayout
                :sections="sections.data"
                doctype="Donation"
                :docname="donationId"
                @reload="sections.reload"
                @afterFieldChange="reloadAssignees"
              />  
            </div>
          </div>
          <Activities
            v-else
            doctype="Donation"
            :docname="donationId"
            :tabs="tabs"
            v-model:reload="reload"
            v-model:tabIndex="tabIndex"
            @beforeSave="saveChanges"
            @afterSave="reloadAssignees"
          />
        </TabPanel>
      </Tabs>
    </div>

    <ErrorPage v-else :errorTitle="errorTitle" :errorMessage="errorMessage" />
    
    <!-- Print Modal -->
    <div v-if="showPrintModal" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/50" @click="closePrintModal"></div>
      <div class="relative z-10 w-[420px] rounded-lg bg-white shadow-xl">
        <div class="flex items-center justify-between border-b px-4 py-3">
          <div class="text-base font-medium">{{ __('Select Print Format') }}</div>
          <button class="rounded px-2 py-1 text-sm text-gray-600 hover:bg-gray-100" @click="closePrintModal">{{ __('Close') }}</button>
        </div>
        <div class="space-y-2 px-4 py-4">
          <label class="block text-sm text-gray-700">{{ __('Print Format') }}</label>
          <select
            class="block w-full rounded border px-3 py-2 text-sm"
            v-model="selectedPrintFormat"
          >
            <option value="" disabled>{{ loadingFormats ? __('Loading...') : __('Select a format') }}</option>
            <option v-for="f in printFormats" :key="f.name" :value="f.name">{{ f.name }}</option>
          </select>
        </div>
        <div class="flex items-center justify-end gap-2 border-t px-4 py-3">
          <button class="rounded px-3 py-1.5 text-sm hover:bg-gray-100" @click="closePrintModal">{{ __('Cancel') }}</button>
          <button
            class="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="!selectedPrintFormat || loadingFormats"
            @click="confirmPrint"
          >
            {{ __('Print') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import ErrorPage from '@/components/ErrorPage.vue'
import LayoutHeader from '@/components/LayoutHeader.vue'
import Activities from '@/components/Activities/Activities.vue'
import AssignTo from '@/components/AssignTo.vue'
import SidePanelLayout from '@/components/SidePanelLayout.vue'
import SLASection from '@/components/SLASection.vue'
import CustomActions from '@/components/CustomActions.vue'
import Breadcrumbs from '@/components/Breadcrumbs.vue'
import IndicatorIcon from '@/components/Icons/IndicatorIcon.vue'
import ActivityIcon from '@/components/Icons/ActivityIcon.vue'
import EmailIcon from '@/components/Icons/EmailIcon.vue'
import CommentIcon from '@/components/Icons/CommentIcon.vue'
import DetailsIcon from '@/components/Icons/DetailsIcon.vue'
import PhoneIcon from '@/components/Icons/PhoneIcon.vue'
import TaskIcon from '@/components/Icons/TaskIcon.vue'
import NoteIcon from '@/components/Icons/NoteIcon.vue'
import AttachmentIcon from '@/components/Icons/AttachmentIcon.vue'
import WhatsAppIcon from '@/components/Icons/WhatsAppIcon.vue'
import { useDocument } from '@/data/document'
import { useActiveTabManager } from '@/composables/useActiveTabManager'
import { getMeta } from '@/stores/meta'
import { getSettings } from '@/stores/settings'
import { whatsappEnabled, callEnabled } from '@/composables/settings'
import {
  Tabs,
  TabList,
  TabPanel,
  Dropdown,
  call,
  usePageMeta,
  toast,
  Button,
  FeatherIcon,
  createResource,
} from 'frappe-ui'
import { ref, computed, watch, nextTick, h } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const route = useRoute()
const router = useRouter()

const props = defineProps({ donationId: { type: String, required: true } })

const { brand } = getSettings()
const { doctypeMeta } = getMeta('Donation')

const errorTitle = ref('')
const errorMessage = ref('')
const reload = ref(false)

// Print modal state
const showPrintModal = ref(false)
const printFormats = ref([])
const selectedPrintFormat = ref('')
const loadingFormats = ref(false)

const donation = createResource({
  url: 'crm.fcrm.doctype.donation.api.get_donation',
  params: { name: props.donationId },
  cache: ['donation', props.donationId],
  auto: true,
  onError: (err) => {
    errorTitle.value = __('Not permitted')
    errorMessage.value = __(err.messages?.[0] || 'Error loading donation')
  },
})

const { document: donationDocument, assignees } = useDocument('Donation', props.donationId)

const title = computed(() => {
  let t = doctypeMeta['Donation']?.title_field || 'name'
  return donation.data?.[t] || props.donationId
})

usePageMeta(() => ({ title: title.value, icon: brand.favicon }))

const breadcrumbs = computed(() => [
  { label: __('Donation'), route: { name: 'Donation' } },
  { label: title.value, route: { name: 'MobileDonationDetail', params: { donationId: props.donationId } } },
])

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

const { tabIndex, changeTabTo } = useActiveTabManager(tabs, 'lastDonationTab')

const sections = createResource({
  url: 'crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_sidepanel_sections',
  cache: ['sidePanelSections', 'Donation'],
  params: { doctype: 'Donation' },
  auto: true,
})

function updateField(name, value) {
  value = Array.isArray(name) ? '' : value
  let oldValues = Array.isArray(name) ? {} : donationDocument.doc?.[name]

  if (!donationDocument.doc) return

  if (Array.isArray(name)) {
    name.forEach((field) => (donationDocument.doc[field] = value))
  } else {
    donationDocument.doc[name] = value
  }

  donationDocument.save.submit(null, {
    onSuccess: () => (reload.value = true),
    onError: (err) => {
      if (Array.isArray(name)) {
        name.forEach((field) => (donationDocument.doc[field] = oldValues[field]))
      } else {
        donationDocument.doc[name] = oldValues
      }
      toast.error(err.messages?.[0] || __('Error updating field'))
    },
  })
}

function reloadAssignees(data) {
  if (data?.hasOwnProperty('donation_owner')) {
    assignees.reload()
  }
}

function saveChanges(data) {
  donationDocument.save.submit(null, {
    onSuccess: () => reloadAssignees(data),
  })
}

const donationStatusOptions = computed(() => [
  {
    label: __('Draft'),
    value: 'Draft',
    icon: () => h(IndicatorIcon, { class: 'text-gray-500' }),
    onClick: () => updateDonationStatus('Draft'),
  },
  {
    label: __('Submitted'),
    value: 'Submitted',
    icon: () => h(IndicatorIcon, { class: 'text-blue-500' }),
    onClick: () => updateDonationStatus('Submitted'),
  },
])

function getDonationStatus(status) {
  if (!status || status === 'Draft') return { name: 'Draft', color: 'text-gray-500' }
  return { name: status, color: 'text-blue-500' }
}

async function updateDonationStatus(newStatus) {
  if (!donation.data || !newStatus) return
  try {
    const result = await call('crm.fcrm.doctype.donation.api.update_donation_status', {
      name: donation.data.name,
      status: newStatus,
    })
    if (result.success) {
      if (donation.data) donation.data.status = newStatus
      if (donationDocument.doc) donationDocument.doc.status = newStatus
      toast.success(__('Status updated successfully'))
    } else {
      toast.error(result.message || __('Failed to update status'))
    }
  } catch (error) {
    toast.error(__('Failed to update status'))
  }
}

// Print functionality
function printDonation() {
  try {
    const doctype = 'Donation'
    const name = donation.data?.name
    if (!name) {
      toast?.error && toast.error(__('Document not loaded'))
      return
    }
    openPrintModal()
  } catch (e) {
    console.error('Error opening print view:', e)
  }
}

async function openPrintModal() {
  showPrintModal.value = true
  selectedPrintFormat.value = ''
  await fetchPrintFormats()
}

function closePrintModal() {
  showPrintModal.value = false
}

async function fetchPrintFormats() {
  loadingFormats.value = true
  try {
    const formats = await call('frappe.client.get_list', {
      doctype: 'Print Format',
      fields: ['name'],
      filters: { doc_type: 'Donation', disabled: 0 },
      order_by: 'name asc',
      limit_page_length: 1000,
    })
    printFormats.value = Array.isArray(formats) ? formats : []
    if (printFormats.value.length === 1) {
      selectedPrintFormat.value = printFormats.value[0].name
    }
  } catch (e) {
    console.error('Error fetching print formats:', e)
    toast.error(__('Failed to load print formats'))
  } finally {
    loadingFormats.value = false
  }
}

function confirmPrint() {
  const format = selectedPrintFormat.value
  if (!format) {
    toast.error(__('Please select a print format'))
    return
  }
  openPrintView(format)
  closePrintModal()
}

function openPrintView(format) {
  try {
    const doctype = 'Donation'
    const name = donation.data?.name
    if (!name) return
    const params = new URLSearchParams({
      doctype,
      name: encodeURIComponent(name),
      trigger_print: '1',
      format,
      no_letterhead: '1',
    })
    const url = `/printview?${params.toString()}`
    window.open(url, '_blank')
  } catch (e) {
    console.error('Error opening print view:', e)
  }
}

// PDF functionality
function openDonationPDF() {
  try {
    const doctype = 'Donation'
    const name = donation.data?.name
    if (!name) {
      toast?.error && toast.error(__('Document not loaded'))
      return
    }
    // Default to Standard print format; users can print via the modal for others
    const format = selectedPrintFormat.value || 'Standard'
    const params = new URLSearchParams({
      doctype,
      name: encodeURIComponent(name),
      format,
      no_letterhead: '0',
    })
    const url = `/api/method/frappe.utils.print_format.download_pdf?${params.toString()}`
    window.open(url, '_blank')
  } catch (e) {
    console.error('Error opening PDF:', e)
  }
}
</script>