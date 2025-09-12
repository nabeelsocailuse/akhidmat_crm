<template>
  <AppStyling type="detail-background">
    <LayoutHeader v-if="document.doc">
      <template #left-header>
        <Breadcrumbs :items="breadcrumbs" />
      </template>
      <template #right-header>
        <CustomActions
          v-if="document.doc.actions?.length"
          :actions="document.doc.actions"
        />
        <Dropdown
          v-if="document.doc"
          :options="donationStatusOptions"
        >
          <template #default="{ open }">  
            <Button :label="document.doc.status || 'Draft'">
              <template #prefix>
                <IndicatorIcon :class="getDonationStatus(document.doc.status).color" />
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
        <AssignTo
          v-model="assignees.data"
          :data="document.doc"
          doctype="Donation"
        />
      </template>
    </LayoutHeader>
    
    <div v-if="document.doc" class="flex h-full overflow-hidden">
      <Tabs as="div" v-model="tabIndex" :tabs="tabs">
        <template #tab-panel>
          <Activities
            v-if="document.doc && document.doc.name"
            ref="activities"
            doctype="Donation"
            :docname="document.doc.name"
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
          @click="handleCopyToClipboard(document.doc.name)"
        >
          {{ __(document.doc.name) }}
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
                  :image="document.doc.image"
                />
                <component
                  :is="document.doc.image ? Dropdown : 'div'"
                  v-bind="
                    document.doc.image
                      ? {
                          options: [
                            {
                              icon: 'upload',
                              label: document.doc.image
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
                    class="flex h-3 w-3 cursor-pointer items-center justify-center rounded-full bg-white shadow-sm"
                  >
                    <CameraIcon class="h-2 w-2 text-gray-600" />
                  </div>
                </component>
              </div>
              <div class="flex flex-col">
                <div class="text-base font-medium text-gray-900">
                  {{ title }}
                </div>
                <div class="text-sm text-gray-500">
                  {{ document.doc.donor_name || __('No donor name') }}
                </div>
              </div>
            </div>
          </template>
        </FileUploader>
        
        <SLASection
          v-if="document.doc.sla_status"
          v-model="document.doc"
          @updateField="updateField"
        />
        
        <div
          v-if="sections.data"
          class="flex flex-1 flex-col justify-between overflow-hidden"
        >
          <SidePanelLayout
            :sections="sections.data"
            doctype="Donation"
            :docname="document.doc.name"
            @reload="sections.reload"
            @afterFieldChange="reloadAssignees"
            @open-create-modal="openCreateModal"
          />
          <template v-for="(modal, idx) in modalStack" :key="idx">
            <CreateDocumentModal
              v-model="modal.visible"
              :doctype="modal.doctype"
              :data="{ name: modal.initialValue }"
              @callback="(doc) => handleModalSuccess(idx, doc)"
              @close="() => handleModalClose(idx)"
              @open-create-modal="openCreateModal"
            />
          </template>
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
    v-if="document.doc?.name"
    v-model="showFilesUploader"
    doctype="Donation"
    :docname="document.doc.name"
    @after="() => { activities?.all_activities?.reload(); changeTabTo('attachments') }"
  />
  
  <DeleteLinkedDocModal
    v-if="showDeleteLinkedDocModal"
    v-model="showDeleteLinkedDocModal"
    :doctype="'Donation'"
    :docname="props.donationId"
    name="Donations"
  />
</template>

<script setup>
import LayoutHeader from '@/components/LayoutHeader.vue'
import Breadcrumbs from '@/components/Breadcrumbs.vue'
import CustomActions from '@/components/CustomActions.vue'
import AssignTo from '@/components/AssignTo.vue'
import Activities from '@/components/Activities/Activities.vue'
import SidePanelLayout from '@/components/SidePanelLayout.vue'
import Resizer from '@/components/Resizer.vue'
import ErrorPage from '@/components/ErrorPage.vue'
import Icon from '@/components/Icon.vue'
import DataFields from '@/components/Activities/DataFields.vue'
import FilesUploader from '@/components/FilesUploader/FilesUploader.vue'
import FieldLayout from '@/components/FieldLayout/FieldLayout.vue'
import SLASection from '@/components/SLASection.vue'
import IndicatorIcon from '@/components/Icons/IndicatorIcon.vue'
import CameraIcon from '@/components/Icons/CameraIcon.vue'
import AppStyling from '@/components/AppStyling.vue'
import LinkIcon from '@/components/Icons/LinkIcon.vue'
import AttachmentIcon from '@/components/Icons/AttachmentIcon.vue'
import EditIcon from '@/components/Icons/EditIcon.vue'
import { getMeta } from '@/stores/meta'
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useActiveTabManager } from '@/composables/useActiveTabManager'
import { createResource } from 'frappe-ui'
import { getSettings } from '@/stores/settings'
import { sessionStore } from '@/stores/session'
import { usersStore } from '@/stores/users'
import { globalStore } from '@/stores/global'
import { statusesStore } from '@/stores/statuses'
import {
  whatsappEnabled,
  callEnabled,
  isMobileView,
} from '@/composables/settings'
import {
  openWebsite,
  setupCustomizations,
  copyToClipboard,
  validateIsImageFile,
} from '@/utils'
import { showQuickEntryModal, quickEntryProps } from '@/composables/modals'
import { getView } from '@/utils/view'
import { capture } from '@/telemetry'
import { useOnboarding } from 'frappe-ui/frappe'
import {
  FileUploader,
  Dropdown,
  Tooltip,
  Avatar,
  Tabs,
  Switch,
  call,
  usePageMeta,
  toast,
  FeatherIcon,
} from 'frappe-ui'
import { ref as vueRef, reactive, computed as vueComputed, onMounted as vueOnMounted, watch as vueWatch, nextTick, h } from 'vue'
import ActivityIcon from '@/components/Icons/ActivityIcon.vue'
import EmailIcon from '@/components/Icons/EmailIcon.vue'
import Email2Icon from '@/components/Icons/Email2Icon.vue'
import CommentIcon from '@/components/Icons/CommentIcon.vue'
import DetailsIcon from '@/components/Icons/DetailsIcon.vue'
import PhoneIcon from '@/components/Icons/PhoneIcon.vue'
import TaskIcon from '@/components/Icons/TaskIcon.vue'
import NoteIcon from '@/components/Icons/NoteIcon.vue'
import WhatsAppIcon from '@/components/Icons/WhatsAppIcon.vue'
import { useDocument } from '@/data/document'
import ViewBreadcrumbs from '@/components/ViewBreadcrumbs.vue'
import CreateDocumentModal from '@/components/Modals/CreateDocumentModal.vue'
import DeleteLinkedDocModal from '@/components/DeleteLinkedDocModal.vue'

const { brand } = getSettings()
const { user } = sessionStore()
const { isManager } = usersStore()
const { $dialog, $socket, makeCall } = globalStore()
const { statusOptions, getLeadStatus, getDealStatus } = statusesStore()
const { doctypeMeta } = getMeta('Donation')

const { updateOnboardingStep } = useOnboarding('frappecrm')

const route = useRoute()
const router = useRouter()

const props = defineProps({
  donationId: {
    type: String,
    required: true,
  },
})

const errorTitle = ref('')
const errorMessage = ref('')
const showDeleteLinkedDocModal = ref(false)

// Remove the problematic donation resource
// const donation = createResource({ ... })

const { document, assignees, triggerOnChange } = useDocument('Donation', props.donationId)

const reload = ref(false)
const showFilesUploader = ref(false)
const modalStack = ref([])

function openCreateModal({ doctype, initialValue, onSuccess }) {
  modalStack.value.push({
    doctype,
    initialValue,
    onSuccess,
    visible: true,
  })
}

function handleModalSuccess(idx, doc) {
  const modal = modalStack.value[idx]
  if (modal && modal.onSuccess) modal.onSuccess(doc)
  modalStack.value.splice(idx, 1)
}

function handleModalClose(idx) {
  modalStack.value.splice(idx, 1)
}

// Breadcrumbs
const breadcrumbs = computed(() => [
  { label: __('Donations'), route: { name: 'Donation' } },
  { label: document.doc?.name || props.donationId, route: { name: 'DonationDetail', params: { donationId: props.donationId } } }
])

// Title for display
const title = computed(() => {
  if (document.doc?.donor_name) {
    return document.doc.donor_name
  }
  if (document.doc?.name) {
    return document.doc.name
  }
  return __('Donation')
})

// Donation status options
const donationStatusOptions = computed(() => {
  return [
    { label: __('Draft'), value: 'Draft', color: 'text-gray-500' },
    { label: __('Submitted'), value: 'Submitted', color: 'text-blue-500' },
    { label: __('Approved'), value: 'Approved', color: 'text-green-500' },
    { label: __('Rejected'), value: 'Rejected', color: 'text-red-500' },
    { label: __('Cancelled'), value: 'Cancelled', color: 'text-gray-400' }
  ]
})

// Get donation status styling
function getDonationStatus(status) {
  const statusOption = donationStatusOptions.value.find(option => option.value === status)
  return statusOption || { color: 'text-gray-500' }
}

// Tabs configuration
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

const { tabIndex, changeTabTo } = useActiveTabManager(tabs, 'lastDonationTab')

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

// Side panel sections
const sections = createResource({
  url: 'crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_sidepanel_sections',
  cache: ['sidePanelSections', 'Donation'],
  params: { doctype: 'Donation' },
  auto: true,
})

// Update field function
async function updateField(name, value, callback) {
  // Validate required fields
  if (await validateRequired(name, value)) {
    return // Block the update if validation fails
  }
  
  await updateDonation(name, value, () => {
    document.data[name] = value
    callback?.()
  })
}

// Update donation API call
const updateDonation = createResource({
  url: 'frappe.client.set_value',
  makeParams(values) {
    return {
      doctype: 'Donation',
      name: props.donationId,
      fieldname: values.name,
      value: values.value,
    }
  },
  onSuccess: () => {
    document.reload() // Use document.reload() instead of donation.reload()
    toast.success(__('Donation updated successfully'))
  },
  onError: (err) => {
    const msg = err.messages?.[0] || err.message || __('Error updating donation')
    
    // Check if it's a timestamp mismatch error
    if (msg.includes('TimestampMismatchError') || 
        msg.includes('Document has been modified') ||
        msg.includes('Please refresh to get the latest document')) {
      
      toast.error(__('Document has been modified. Refreshing donation details...'))
      
      // Refresh only the donation data after a short delay
      setTimeout(() => {
        document.reload()
      }, 1000)
    } else {
      toast.error(msg)
    }
  },
})

// Validation function for required fields
async function validateRequired(fieldname, value) {
  let meta = document.fields_meta || {} // Use document.fields_meta
  if (meta[fieldname]?.reqd && !value) {
    toast.error(__('{0} is a required field', [meta[fieldname].label]))
    return true
  }
  return false
}

// Delete donation
async function deleteDonation(name) {
  await call('frappe.client.delete', {
    doctype: 'Donation',
    name,
  })
  router.push({ name: 'Donation' })
}

async function deleteDonationWithModal(name) {
  const confirmed = await $dialog.confirm({
    title: __('Delete Donation'),
    message: __('Are you sure you want to delete this donation? This action cannot be undone.'),
    confirmText: __('Delete'),
    cancelText: __('Cancel'),
    variant: 'danger'
  })
  
  if (confirmed) {
    await deleteDonation(name)
  }
}

// Reload assignees
function reloadAssignees(data) {
  if (data?.hasOwnProperty('donation_owner')) {
    assignees.reload()
  }
}

// Save changes
function saveChanges(data) {
  document.save.submit(null, {
    onSuccess: () => {
      toast.success(__('Donation saved successfully'))
      reloadAssignees(data)
    },
    onError: (err) => {
      toast.error(__('Error saving donation'))
      console.error('Save error:', err)
    },
  })
}

// Handle copy to clipboard (renamed to avoid conflict)
function handleCopyToClipboard(text) {
  copyToClipboard(text)
  toast.success(__('Copied to clipboard'))
}

// Open email box
function openEmailBox() {
  // Implementation for opening email box
  console.log('Opening email box for:', document.data.email)
}

// Activities reference
const activities = ref(null)

// Page meta
usePageMeta({
  title: computed(() => document.data?.donor_name || document.data?.name || __('Donation')),
  description: computed(() => `Donation details for ${document.data?.donor_name || document.data?.name}`),
  icon: brand.favicon,
})

// Watch for refresh parameter changes
watch(() => route.query.refresh, (newRefresh) => {
  if (newRefresh) {
    // Clear cache and force reload
    document.cache = ['donation', props.donationId, Date.now()]
    document.reload()
    // Clear the refresh parameter from URL
    router.replace({ 
      name: 'DonationDetail', 
      params: { donationId: props.donationId },
      query: {} 
    })
  }
}, { immediate: true })

onMounted(() => {
  // Handle refresh parameter for fresh donation creation
  if (route.query.refresh) {
    // Clear cache and force reload
    document.cache = ['donation', props.donationId, Date.now()]
    document.reload()
    // Clear the refresh parameter from URL
    router.replace({ 
      name: 'DonationDetail', 
      params: { donationId: props.donationId },
      query: {} 
    })
  }
})

// ADD: Method to refresh deduction breakeven using the minimal backend method
async function refreshDeductionBreakeven() {
  if (!document.doc?.name) {
    console.log('No document name available')
    return
  }
  
  try {
    console.log('Refreshing deduction breakeven for donation:', document.doc.name)
    
    // Call the minimal backend method
    const result = await call('akf_accounts.akf_accounts.doctype.donation.donation.refresh_deduction_breakeven', {
      name: document.doc.name
    })
    
    console.log('Backend method result:', result)
    
    if (result.status === 'success') {
      toast.success('Deduction breakeven table refreshed successfully')
      
      // Reload the document to show updated data
      document.reload()
    }
    
  } catch (error) {
    console.error('Error refreshing deduction breakeven:', error)
    toast.error('Failed to refresh deduction breakeven table')
  }
}

// ADD: Auto-refresh deduction breakeven when document loads
onMounted(async () => {
  // Wait for document to load
  await nextTick()
  
  // Check if we need to populate deduction breakeven
  if (shouldPopulateDeductionBreakeven()) {
    console.log('Auto-refreshing deduction breakeven on mount...')
    
    // Add delay to ensure document is fully loaded
    setTimeout(() => {
      refreshDeductionBreakeven()
    }, 2000)
  }
})

// ADD: Watch for document changes to auto-refresh when needed
watch(() => document.doc, (newDoc, oldDoc) => {
  if (shouldPopulateDeductionBreakeven()) {
    console.log('Auto-refreshing deduction breakeven on document change...')
    
    // Add delay to ensure document is fully loaded
    setTimeout(() => {
      refreshDeductionBreakeven()
    }, 1000)
  }
}, { immediate: false, deep: true })

// === ENRICHERS ===
async function safeFetchDonor(donorId) {
  try { return donorId ? await call('frappe.client.get', { doctype: 'Donor', name: donorId }) : null } catch { return null }
}
async function safeFetchFundClass(fcId) {
  try { return fcId ? await call('crm.fcrm.doctype.donation.api.get_fund_class_details', { fund_class_id: fcId, company: document.doc?.company || 'Alkhidmat Foundation Pakistan' }) : null } catch { return null }
}
async function safeFetchMOP(mopId) {
  try { return mopId ? await call('frappe.client.get', { doctype: 'Mode of Payment', name: mopId }) : null } catch { return null }
}

function mapDonor(row, donor) {
  if (!row || !donor) return
  const map = ['donor_name','donor_type','contact_no','email','city','address','cnic','co_name','co_contact_no','co_email','co_address','relationship_with_donor','area','co_city','co_country','co_designation']
  map.forEach(k => { if (donor[k] !== undefined) row[k] = donor[k] || '' })
}
function mapFundClass(row, fc) {
  if (!row || !fc) return
  const pairs = { service_area:'pay_service_area', subservice_area:'pay_subservice_area', product:'pay_product', equity_account:'equity_account', receivable_account:'receivable_account', cost_center:'cost_center' }
  Object.entries(pairs).forEach(([src,tgt]) => { if (fc[src] !== undefined) row[tgt] = fc[src] || '' })
}

async function enrichOnceAfterLoad() {
  if (didEnrichOnce || !document.doc) return
  didEnrichOnce = true
  try {
    // Payment Details
    if (Array.isArray(document.doc.payment_detail)) {
      for (let i = 0; i < document.doc.payment_detail.length; i++) {
        const row = document.doc.payment_detail[i]
        if (row && !row.random_id) row.random_id = Math.floor((1000 + i + 1) + (Math.random() * 9000))
        if (row?.donor_id) { const d = await safeFetchDonor(row.donor_id); mapDonor(row, d) }
        if (row?.fund_class_id) { const fc = await safeFetchFundClass(row.fund_class_id); mapFundClass(row, fc) }
        if (row?.mode_of_payment) {
          const mop = await safeFetchMOP(row.mode_of_payment)
          if (mop?.accounts && document.doc.company) {
            const comp = mop.accounts.find(a => a.company === document.doc.company)
            if (comp?.default_account) row.account_paid_to = comp.default_account
          }
        }
      }
      document.doc.payment_detail = [...document.doc.payment_detail]
    }

    // Deduction Breakeven
    if (Array.isArray(document.doc.deduction_breakeven)) {
      for (let i = 0; i < document.doc.deduction_breakeven.length; i++) {
        const r = document.doc.deduction_breakeven[i]
        if (r && !r.random_id) r.random_id = Math.floor((1000 + i + 1) + (Math.random() * 9000))
        const fcid = r.fund_class_id || r.fund_class
        if (fcid) { const fc = await safeFetchFundClass(fcid); if (fc) {
          const pairs = [ ['service_area','service_area'], ['subservice_area','subservice_area'], ['product','product'], ['service_area','pay_service_area'], ['subservice_area','pay_subservice_area'], ['product','pay_product'], ['cost_center','cost_center'] ]
          pairs.forEach(([src,tgt]) => { if (tgt in r && fc[src] !== undefined) r[tgt] = fc[src] || '' })
        } }
      }
      document.doc.deduction_breakeven = [...document.doc.deduction_breakeven]
    }
  } catch (e) {
    // Fail-safe: do not break page
    console.error('Enrichment error:', e)
  }
}

onMounted(async () => {
  await nextTick()
  // small delay to ensure doc rendered
  setTimeout(() => { enrichOnceAfterLoad() }, 300)
})

watch(() => document.doc?.name, () => { didEnrichOnce = false; setTimeout(() => { enrichOnceAfterLoad() }, 300) })
// === END ENRICHERS ===

// === LIVE EDIT FETCH (SAFE, GUARDED) ===
let pdProcessing = false
watch(() => document.doc?.payment_detail, async (rows) => {
  if (pdProcessing || !Array.isArray(rows)) return
  pdProcessing = true
  try {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      if (!row) continue
      // random id
      if (!row.random_id) row.random_id = Math.floor((1000 + i + 1) + (Math.random() * 9000))
      // donor
      if (row.donor_id && row.donor_id !== row._lastDonorId) {
        row._lastDonorId = row.donor_id
        const d = await safeFetchDonor(row.donor_id)
        mapDonor(row, d)
      }
      // fund class
      if (row.fund_class_id && row.fund_class_id !== row._lastFundClassId) {
        row._lastFundClassId = row.fund_class_id
        const fc = await safeFetchFundClass(row.fund_class_id)
        mapFundClass(row, fc)
      }
      // mode of payment
      if (row.mode_of_payment && row.mode_of_payment !== row._lastModeOfPayment) {
        row._lastModeOfPayment = row.mode_of_payment
        const mop = await safeFetchMOP(row.mode_of_payment)
        if (mop?.accounts && document.doc?.company) {
          const comp = mop.accounts.find(a => a.company === document.doc.company)
          if (comp?.default_account) row.account_paid_to = comp.default_account
        }
      }
    }
    // do not forcefully replace array; Vue deep binding should update
  } catch (e) {
    console.error('Payment detail live fetch error:', e)
  } finally {
    pdProcessing = false
  }
}, { deep: true })

let dbProcessing = false
watch(() => document.doc?.deduction_breakeven, async (rows) => {
  if (dbProcessing || !Array.isArray(rows)) return
  dbProcessing = true
  try {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      if (!r) continue
      if (!r.random_id) r.random_id = Math.floor((1000 + i + 1) + (Math.random() * 9000))
      const fcid = r.fund_class_id || r.fund_class
      if (fcid && fcid !== r._lastFC) {
        r._lastFC = fcid
        const fc = await safeFetchFundClass(fcid)
        if (fc) {
          const pairs = [ ['service_area','service_area'], ['subservice_area','subservice_area'], ['product','product'], ['service_area','pay_service_area'], ['subservice_area','pay_subservice_area'], ['product','pay_product'], ['cost_center','cost_center'] ]
          pairs.forEach(([src,tgt]) => { if (tgt in r && fc[src] !== undefined) r[tgt] = fc[src] || '' })
        }
      }
    }
  } catch (e) {
    console.error('Deduction breakeven live fetch error:', e)
  } finally {
    dbProcessing = false
  }
}, { deep: true })
// === END LIVE EDIT FETCH ===

// ADD: Helper function to determine if deduction breakeven should be populated
function shouldPopulateDeductionBreakeven() {
  return (
    document.doc?.donation_type === 'Cash' && 
    document.doc?.payment_detail && 
    document.doc?.payment_detail.length > 0 &&
    (!document.doc?.deduction_breakeven || document.doc?.deduction_breakeven.length === 0)
  )
}

// ADD: Manual refresh button function
async function handleManualRefresh() {
  await refreshDeductionBreakeven()
}

// ADD: Frontend-only solution to populate deduction breakeven (FIXED VERSION)
async function populateDeductionBreakevenFrontend() {
  if (!document.doc || document.doc.donation_type !== 'Cash' || !document.doc.payment_detail) {
    return
  }
  
  try {
    console.log('Populating deduction breakeven table using frontend logic...')
    
    // Check if deduction breakeven already has data
    if (document.doc.deduction_breakeven && document.doc.deduction_breakeven.length > 0) {
      console.log('Deduction breakeven already has data, skipping population')
      return
    }
    
    const deductionBreakevenRows = []
    
    // Process each payment detail row
    for (const paymentRow of document.doc.payment_detail) {
      if (paymentRow.fund_class_id && paymentRow.donation_amount) {
        console.log('Processing payment row:', paymentRow)
        
        // Fetch deduction details from the database directly
        const deductionDetails = await call('frappe.client.get_list', {
          doctype: 'Deduction Details',
          filters: {
            parenttype: 'Fund Class',
            parent: paymentRow.fund_class_id,
            company: document.doc.company || 'Alkhidmat Foundation'
          },
          fields: ['company', 'income_type', 'project', 'account', 'percentage', 'min_percent', 'max_percent']
        })
        
        if (deductionDetails && deductionDetails.length > 0) {
          // Create deduction breakeven rows for each deduction detail
          for (const deductionDetail of deductionDetails) {
            const percentageAmount = paymentRow.donation_amount * (deductionDetail.percentage / 100)
            
            const deductionRow = {
              random_id: Math.floor((1000 + Math.random() * 9000)),
              fund_class: paymentRow.fund_class_id,
              percentage: deductionDetail.percentage || 0,
              min_percent: deductionDetail.min_percent || 0,
              max_percent: deductionDetail.max_percent || 0,
              amount: percentageAmount,
              company: deductionDetail.company || document.doc.company,
              income_type: deductionDetail.income_type || '',
              project: deductionDetail.project || '',
              account: deductionDetail.account || '',
              donor_id: paymentRow.donor_id,  // FIXED: Changed from 'donor' to 'donor_id'
              intention_id: paymentRow.intention_id,  // FIXED: Added missing intention_id
              service_area: paymentRow.pay_service_area || '',
              subservice_area: paymentRow.pay_subservice_area || '',
              product: paymentRow.pay_product || '',
              donation_amount: paymentRow.donation_amount,
              base_amount: percentageAmount,
              cost_center: document.doc.donation_cost_center || '',
              donor_desk_id: paymentRow.donor_desk_id || '',
              donor_type_id: paymentRow.donor_type || '',  // FIXED: Added missing donor_type_id
              transaction_type_id: paymentRow.transaction_type_id || '',  // FIXED: Added missing transaction_type_id
              donation_type_id: paymentRow.donation_type || document.doc.donation_type,
              __islocal: true,
              doctype: 'Deduction Breakeven',
              parentfield: 'deduction_breakeven',
              parenttype: 'Donation',
              idx: deductionBreakevenRows.length + 1
            }
            
            deductionBreakevenRows.push(deductionRow)
          }
        }
      }
    }
    
    if (deductionBreakevenRows.length > 0) {
      console.log('Created deduction breakeven rows:', deductionBreakevenRows)
      
      // Update the document with the new deduction breakeven data
      document.doc.deduction_breakeven = deductionBreakevenRows
      
      // Force reactive update
      document.doc = { ...document.doc }
      
      toast.success(`Successfully populated ${deductionBreakevenRows.length} deduction breakeven rows`)
    } else {
      console.log('No deduction breakeven rows to create')
      toast.info('No deduction details found for the selected fund classes')
    }
    
  } catch (error) {
    console.error('Error populating deduction breakeven:', error)
    toast.error('Failed to populate deduction breakeven table')
  }
}

// ADD: Use API-based solution instead of frontend-only solution
onMounted(async () => {
  await nextTick()
  
  if (shouldPopulateDeductionBreakeven()) {
    setTimeout(() => {
      populateDeductionBreakevenFromAPI()  // Changed from populateDeductionBreakevenFrontend()
    }, 2000)
  }
})

watch(() => document.doc, (newDoc) => {
  if (shouldPopulateDeductionBreakeven()) {
    setTimeout(() => {
      populateDeductionBreakevenFromAPI()  // Changed from populateDeductionBreakevenFrontend()
    }, 1000)
  }
}, { immediate: false, deep: true })

// NEW: Enhanced deduction breakeven functionality using API
async function populateDeductionBreakevenFromAPI() {
  console.log("Populating deduction breakeven using API on DonationDetail page...")
  
  if (!document.doc.payment_detail || document.doc.payment_detail.length === 0) {
    console.log("No payment details to process")
    return
  }
  
  if (document.doc.contribution_type === "Pledge") {
    console.log("Skipping deduction breakeven for Pledge contribution type")
    return
  }
  
  try {
    const result = await call("crm.fcrm.doctype.donation.api.populate_deduction_breakeven", {
      payment_details: document.doc.payment_detail,
      company: document.doc.company || "Alkhidmat Foundation",
      contribution_type: document.doc.contribution_type || "Donation",
      donation_cost_center: document.doc.donation_cost_center,
      currency: document.doc.currency,
      to_currency: document.doc.to_currency || document.doc.currency,
      posting_date: document.doc.posting_date,
      is_return: document.doc.is_return || false,
      existing_deduction_breakeven: document.doc.deduction_breakeven || []
    })
    
    if (result.success) {
      console.log("API populated deduction breakeven successfully:", result)
      
      // Update the document with the results
      document.doc.deduction_breakeven = result.deduction_breakeven
      document.doc.payment_detail = result.updated_payment_details
      
      // Force reactive update
      document.doc = { ...document.doc }
      
      toast.success(`Successfully populated ${result.deduction_breakeven.length} deduction breakeven rows`)
    } else {
      console.error("API failed to populate deduction breakeven:", result.message)
      toast.error(result.message || "Failed to populate deduction breakeven")
    }
  } catch (error) {
    console.error("Error calling deduction breakeven API:", error)
    toast.error("Error populating deduction breakeven")
  }
}

// NEW: Update deduction breakeven when payment details change
async function updateDeductionBreakevenFromAPI() {
  console.log('Updating deduction breakeven using API on DonationDetail page...')
  
  if (!document.doc.payment_detail || document.doc.payment_detail.length === 0) {
    console.log('No payment details to update')
    return
  }
  
  if (!document.doc.deduction_breakeven || document.doc.deduction_breakeven.length === 0) {
    console.log('No existing deduction breakeven to update')
    return
  }
  
  try {
    const result = await call('crm.fcrm.doctype.donation.api.update_deduction_breakeven', {
      payment_details: document.doc.payment_detail,
      deduction_breakeven: document.doc.deduction_breakeven,
      company: document.doc.company || 'Alkhidmat Foundation',
      contribution_type: document.doc.contribution_type || 'Donation',
      donation_cost_center: document.doc.donation_cost_center,
      currency: document.doc.currency,
      to_currency: document.doc.to_currency || document.doc.currency,
      posting_date: document.doc.posting_date,
      is_return: document.doc.is_return || false
    })
    
    if (result.success) {
      console.log('API updated deduction breakeven successfully:', result)
      
      // Update the document with the results
      document.doc.deduction_breakeven = result.deduction_breakeven
      document.doc.payment_detail = result.updated_payment_details
      
      // Force reactive update
      document.doc = { ...document.doc }
    } else {
      console.error('API failed to update deduction breakeven:', result.message)
      toast.error(result.message || 'Failed to update deduction breakeven')
    }
  } catch (error) {
    console.error('Error calling update deduction breakeven API:', error)
    toast.error('Error updating deduction breakeven')
  }
}

async function enrichOnceAfterLoad() {
  if (didEnrichOnce.value || !document.doc?.name) return
  didEnrichOnce.value = true
  
  console.log("Enriching donation data using API...")
  
  try {
    // Enrich payment_detail rows
    if (document.doc.payment_detail && Array.isArray(document.doc.payment_detail)) {
      for (let i = 0; i < document.doc.payment_detail.length; i++) {
        const row = document.doc.payment_detail[i]
        
        // Generate random_id if missing
        if (!row.random_id) {
          row.random_id = Math.floor((1000 + i + 1) + (Math.random() * 9000))
        }
        
        // Fetch donor details
        if (row.donor_id) {
          const donor = await safeFetchDonor(row.donor_id)
          if (donor) {
            mapDonor(row, donor)
          }
        }
        
        // Fetch fund class details
        if (row.fund_class_id) {
          const fundClass = await safeFetchFundClass(row.fund_class_id)
          if (fundClass) {
            mapFundClass(row, fundClass)
          }
        }
        
        // Fetch MOP details
        if (row.mode_of_payment) {
          const mop = await safeFetchMOP(row.mode_of_payment)
          if (mop) {
            // Update MOP-related fields
            row.account_paid_to = mop.default_account || ""
          }
        }
      }
    }
    
    // Auto-populate deduction breakeven using API
    if (document.doc.contribution_type !== "Pledge" && 
        document.doc.payment_detail && 
        document.doc.payment_detail.length > 0 &&
        (!document.doc.deduction_breakeven || document.doc.deduction_breakeven.length === 0)) {
      
      console.log("Auto-populating deduction breakeven using API...")
      debouncedPopulateDeductionBreakeven()
    }
    
    // Force reactive update
    document.doc = { ...document.doc }
    
    console.log("Donation data enrichment completed successfully")
  } catch (error) {
    console.error("Error enriching donation data:", error)
  }
}


let dbProcessing = false
watch(() => document.doc?.deduction_breakeven, async (rows) => {
  if (dbProcessing || !Array.isArray(rows)) return
  dbProcessing = true
  try {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      if (!r) continue
      if (!r.random_id) r.random_id = Math.floor((1000 + i + 1) + (Math.random() * 9000))
      
      // Fetch fund class details
      const fcid = r.fund_class_id || r.fund_class
      if (fcid && fcid !== r._lastFC) {
        r._lastFC = fcid
        const fc = await safeFetchFundClass(fcid)
        if (fc) {
          const pairs = [
            ['service_area', 'service_area'], 
            ['subservice_area', 'subservice_area'], 
            ['product', 'product'], 
            ['service_area', 'pay_service_area'], 
            ['subservice_area', 'pay_subservice_area'], 
            ['product', 'pay_product'], 
            ['cost_center', 'cost_center']
          ]
          pairs.forEach(([src, tgt]) => { 
            if (tgt in r && fc[src] !== undefined) r[tgt] = fc[src] || '' 
          })
        }
      }
    }
    
    // Update deduction amounts when deduction breakeven changes
    if (rows.length > 0) {
      debouncedUpdateDeductionBreakeven()
    }
  } catch (e) {
    console.error('Deduction breakeven live fetch error:', e)
  } finally {
    dbProcessing = false
  }
}, { deep: true })


// UPDATE: Enhanced existing watchers to use API
let pdProcessing = false
watch(() => document.doc?.payment_detail, async (rows) => {
  if (pdProcessing || !Array.isArray(rows)) return
  pdProcessing = true
  try {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      if (!r) continue
      if (!r.random_id) r.random_id = Math.floor((1000 + i + 1) + (Math.random() * 9000))
      
      // Fetch donor details
      if (r.donor_id && r.donor_id !== r._lastDonorId) {
        r._lastDonorId = r.donor_id
        const donor = await safeFetchDonor(r.donor_id)
        if (donor) mapDonor(r, donor)
      }
      
      // Fetch fund class details
      if (r.fund_class_id && r.fund_class_id !== r._lastFundClassId) {
        r._lastFundClassId = r.fund_class_id
        const fundClass = await safeFetchFundClass(r.fund_class_id)
        if (fundClass) mapFundClass(r, fundClass)
      }
      
      // Fetch MOP details
      if (r.mode_of_payment && r.mode_of_payment !== r._lastMOPId) {
        r._lastMOPId = r.mode_of_payment
        const mop = await safeFetchMOP(r.mode_of_payment)
        if (mop) {
          r.account_paid_to = mop.default_account || ''
        }
      }
    }
    
    // Update deduction breakeven when payment details change
    if (document.doc.contribution_type !== 'Pledge' && 
        document.doc.deduction_breakeven && 
        document.doc.deduction_breakeven.length > 0) {
      debouncedUpdateDeductionBreakeven()
    }
  } catch (e) {
    console.error('Payment detail live fetch error:', e)
  } finally {
    pdProcessing = false
  }
}, { deep: true })

let dbProcessing = false
watch(() => document.doc?.deduction_breakeven, async (rows) => {
  if (dbProcessing || !Array.isArray(rows)) return
  dbProcessing = true
  try {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      if (!r) continue
      if (!r.random_id) r.random_id = Math.floor((1000 + i + 1) + (Math.random() * 9000))
      
      // Fetch fund class details
      const fcid = r.fund_class_id || r.fund_class
      if (fcid && fcid !== r._lastFC) {
        r._lastFC = fcid
        const fc = await safeFetchFundClass(fcid)
        if (fc) {
          const pairs = [
            ['service_area', 'service_area'], 
            ['subservice_area', 'subservice_area'], 
            ['product', 'product'], 
            ['service_area', 'pay_service_area'], 
            ['subservice_area', 'pay_subservice_area'], 
            ['product', 'pay_product'], 
            ['cost_center', 'cost_center']
          ]
          pairs.forEach(([src, tgt]) => { 
            if (tgt in r && fc[src] !== undefined) r[tgt] = fc[src] || '' 
          })
        }
      }
    }
    
    // Update deduction amounts when deduction breakeven changes
    if (rows.length > 0) {
      debouncedUpdateDeductionBreakeven()
    }
  } catch (e) {
    console.error('Deduction breakeven live fetch error:', e)
  } finally {
    dbProcessing = false
  }
}, { deep: true })


// NEW: Debounce mechanism for API calls
let populateDeductionTimeout = null
let updateDeductionTimeout = null

// NEW: Debounced populate function
function debouncedPopulateDeductionBreakeven() {
  if (populateDeductionTimeout) {
    clearTimeout(populateDeductionTimeout)
  }
  
  populateDeductionTimeout = setTimeout(async () => {
    debouncedPopulateDeductionBreakeven()
  }, 500) // 500ms debounce
}

// NEW: Debounced update function
function debouncedUpdateDeductionBreakeven() {
  if (updateDeductionTimeout) {
    clearTimeout(updateDeductionTimeout)
  }
  
  updateDeductionTimeout = setTimeout(async () => {
    debouncedUpdateDeductionBreakeven()
  }, 300) // 300ms debounce
}
</script>

<style scoped>
/* Add any custom styles here */
</style>

