<template>
  <AppStyling type="detail-background" class="min-h-screen bg-gradient-to-br from-[#fef7ff] to-[#f8faff]">
    <LayoutHeader>
      <template #left-header>
        <Breadcrumbs :items="breadcrumbs">
          <template #prefix="{ item }">
            <Icon v-if="item.icon" :icon="item.icon" class="mr-2 h-4" />
          </template>
        </Breadcrumbs>
      </template>
      <template v-if="!errorTitle" #right-header>
        <AssignTo v-model="assignees.data" doctype="Tax Exemption Certificate" :docname="certificateId" />
        <Button label="Print" @click="printCertificate" />
      </template>
    </LayoutHeader>

    <!-- Print Modal -->
    <div v-if="showPrintModal" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/50" @click="closePrintModal"></div>
      <div class="relative z-10 w-[90%] max-w-sm rounded-lg bg-white shadow-xl">
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

    <!-- Data Content -->
    <div v-if="doc.name" class="p-4">
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
    </div>

    <ErrorPage
      v-if="errorTitle"
      :errorTitle="errorTitle"
      :errorMessage="errorMessage"
    />
  </AppStyling>
</template>

<script setup>
import ErrorPage from '@/components/ErrorPage.vue'
import Icon from '@/components/Icon.vue'
import LayoutHeader from '@/components/LayoutHeader.vue'
import Activities from '@/components/Activities/Activities.vue'
import AssignTo from '@/components/AssignTo.vue'
import CustomActions from '@/components/CustomActions.vue'
import AppStyling from '@/components/AppStyling.vue'
import {
  createResource,
  Tabs,
  Breadcrumbs,
  call,
  usePageMeta,
  toast,
  Button,
} from 'frappe-ui'
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useDocument } from '@/data/document'
import { getView } from '@/utils/view'
import { getSettings } from '@/stores/settings'
import { getMeta } from '@/stores/meta'
import { useActiveTabManager } from '@/composables/useActiveTabManager'

const { brand } = getSettings()
const { doctypeMeta } = getMeta('Tax Exemption Certificate')
const route = useRoute()

const props = defineProps({
  certificateId: { type: String, required: true },
})

const reload = ref(false)
const errorTitle = ref('')
const errorMessage = ref('')
const { assignees, document, error } = useDocument('Tax Exemption Certificate', props.certificateId)
const doc = computed(() => document.doc || {})

watch(error, (err) => {
  errorTitle.value = err ? (err.exc_type === 'DoesNotExistError' ? 'Document not found' : 'Error occurred') : ''
  errorMessage.value = err?.messages?.[0] || ''
})

const breadcrumbs = computed(() => {
  let items = [{ label: __('Tax Exemption Certificates'), route: { name: 'TaxExemptionCertificates' } }]
  if (route.query.view || route.query.viewType) {
    let view = getView(route.query.view, route.query.viewType, 'Tax Exemption Certificate')
    if (view) {
      items.push({ label: __(view.label), icon: view.icon, route: { name: 'TaxExemptionCertificates', params: { viewType: route.query.viewType }, query: { view: route.query.view } } })
    }
  }
  items.push({ label: title.value, route: { name: 'TaxExemptionCertificate', params: { certificateId: props.certificateId } } })
  return items
})

const title = computed(() => {
  let t = doctypeMeta['Tax Exemption Certificate']?.title_field || 'name'
  return doc?.[t] || props.certificateId
})

usePageMeta(() => ({ title: title.value, icon: brand.favicon }))

const tabs = computed(() => [{ name: 'Data', label: __('Data') }])
const { tabIndex } = useActiveTabManager(tabs, 'lastTaxExemptionCertificateTab')

function saveChanges(data) {
  document.save.submit(null, { onSuccess: () => reloadAssignees(data) })
}

function reloadAssignees(data) {
  if (data?.hasOwnProperty('owner')) assignees.reload()
}

// --- Print modal ---
const showPrintModal = ref(false)
const printFormats = ref([])
const selectedPrintFormat = ref('')
const loadingFormats = ref(false)

function printCertificate() {
  if (!document?.doc?.name) {
    toast.error(__('Document not loaded'))
    return
  }
  openPrintModal()
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
      filters: { doc_type: 'Tax Exemption Certificate', disabled: 0 },
      order_by: 'name asc',
    })
    printFormats.value = Array.isArray(formats) ? formats : []
    if (printFormats.value.length === 1) selectedPrintFormat.value = printFormats.value[0].name
  } catch {
    toast.error(__('Failed to load print formats'))
  } finally {
    loadingFormats.value = false
  }
}

function confirmPrint() {
  if (!selectedPrintFormat.value) {
    toast.error(__('Please select a print format'))
    return
  }
  openPrintView(selectedPrintFormat.value)
  closePrintModal()
}

function openPrintView(format) {
  const name = document?.doc?.name
  if (!name) return
  const params = new URLSearchParams({
    doctype: 'Tax Exemption Certificate',
    name: encodeURIComponent(name),
    trigger_print: '1',
    format,
    no_letterhead: '1',
  })
  window.open(`/printview?${params.toString()}`, '_blank')
}
</script>
