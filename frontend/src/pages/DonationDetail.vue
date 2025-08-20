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
              <Tooltip :text="document.doc.donor_name || __('Set donor name')">
                <div class="truncate text-2xl font-medium text-ink-gray-9">
                  {{ title }}
                </div>
              </Tooltip>
              
              <div class="flex gap-1.5">
                <Tooltip v-if="callEnabled" :text="__('Make a call')">
                  <div>
                    <Button
                      class="h-7 w-7"
                      @click="
                        () =>
                          document.doc.contact_no
                            ? makeCall(document.doc.contact_no)
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
                      class="h-7 w-7"
                      @click="
                        document.doc.email
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
                      class="h-7 w-7"
                      @click="
                        document.doc.website
                          ? openWebsite(document.doc.website)
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
                    <Button class="h-7 w-7" @click="showFilesUploader = true">
                      <template #icon>
                        <AttachmentIcon />
                      </template>
                    </Button>
                  </div>
                </Tooltip>
                
                <Tooltip :text="__('Delete')">
                  <div>
                    <Button
                      class="h-7 w-7"
                      @click="deleteDonationWithModal(document.doc.name)"
                      variant="subtle"
                      theme="red"
                    >
                      <template #icon>
                        <FeatherIcon name="trash-2" class="h-4 w-4" />
                      </template>
                    </Button>
                  </div>
                </Tooltip>
              </div>
              
              <ErrorMessage :message="__(error)" />
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
</script>

<style scoped>
/* Add any custom styles here */
</style>