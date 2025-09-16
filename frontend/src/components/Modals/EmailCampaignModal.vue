<template>
  <!-- Parent Modal -->
  <Dialog v-model="controlledShow" :options="{ size: '4xl' }" :disableOutsideClickToClose="true" :disableEscToClose="hasActiveSubModals" :zIndex="hasActiveSubModals ? 1000 : 100" :backdrop="hasActiveSubModals ? 'static' : true" :persistent="true" data-modal="parent">
    <template #body>
      <AppStyling type="donor-modal-background">
      <AppStyling type="modal-styling" modalType="header" >
        <div class="mb-5 flex items-center justify-between" >
          <div>
          <h3 class="text-2xl font-semibold text-ink-gray-9">
            {{ __('Create Email Campaign') }}
          </h3>

          </div>
          <div class="flex items-center gap-1">
            <Button
              v-if="isManager() && !isMobileView"
              variant="ghost"
              class="w-7"
              @click="openQuickEntryModal"
            >
              <template #icon>
                <FeatherIcon name="edit" class="size-4" />
              </template>
            </Button>
            <Button variant="ghost" class="w-7" @click="handleCloseButton">
              <template #icon>
                <FeatherIcon name="x" class="size-4" /> 
              </template>
            </Button>
          </div>
        </div>
        <div>
          <div class="field-layout-wrapper">
            <FieldLayout 
              v-if="tabs.data" 
              :tabs="tabs.data" 
              :data="document.doc" 
              :doctype="'Email Campaign'" 
              @open-create-modal="openCreateModal"
              @tab-change="handleTabChange"
              @field-change="onFieldChange"
            />
          </div>
          <ErrorMessage class="mt-4" v-if="error" :message="__(error)" />
        </div>
      </AppStyling>
      <AppStyling type="modal-styling" modalType="footer">
        <div class="flex flex-row-reverse gap-2">
          <AppStyling
            type="button"
            buttonType="create"
            buttonLabel="Create"
            :buttonLoading="isEmailCampaignCreating"
            @click="createNewEmailCampaign"
          />
        </div>
      </AppStyling>
      </AppStyling>
    </template>
  </Dialog>

  <!-- Quick Entry Modal - Layout Editor -->
  <QuickEntryModal
    v-model="showQuickEntryModal"
    :doctype="'Email Campaign'"
    @close="onQuickEntryClose"
    @reset="onQuickEntryReset"
    @saved="onQuickEntrySaved"
  />

  <template v-for="(modal, idx) in modalStack" :key="idx">
    <CreateDocumentModal
      v-model="modal.visible"
      :doctype="modal.doctype"
      :data="{ name: modal.initialValue }"
      @callback="(doc) => handleModalSuccess(idx, doc)"
      @close="() => handleModalClose(idx)"
      @open-create-modal="openCreateModal"
      @subModalActive="() => ensureParentModalVisible(idx)"
      @subModalInteraction="() => { handleSubModalInteraction(); manageParentModalState(); }"
      :isSubModal="true"
    />
  </template>
</template>

<script>
export default {
  name: "EmailCampaignModal"
}
</script>

<script setup>
import { ref, reactive, computed, watch, nextTick, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { createResource, Dialog, Button, ErrorMessage, call } from 'frappe-ui'
import { useDocument } from '@/data/document'
import { getMeta } from '@/stores/meta'
import { globalStore } from '@/stores/global'
import { usersStore } from '@/stores/users'
import { sessionStore } from '@/stores/session'
import { quickEntryProps } from '@/composables/modals'
import FieldLayout from '@/components/FieldLayout/FieldLayout.vue'
import QuickEntryModal from '@/components/Modals/QuickEntryModal.vue'
import CreateDocumentModal from '@/components/Modals/CreateDocumentModal.vue'
import AppStyling from '@/components/AppStyling.vue'
import FeatherIcon from '@/components/Icons/FeatherIcon.vue'
import { useWindowSize } from '@vueuse/core'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  defaults: {
    type: Object,
    default: () => ({}),
  },
  options: {
    type: Object,
    default: () => ({}),
  },
})

const emit = defineEmits(['update:modelValue', 'email-campaign-created', 'email-campaign-deleted'])

const route = useRoute()
const router = useRouter()
const { $dialog, $socket } = globalStore()
const { width } = useWindowSize()
const { getUser, isManager } = usersStore()
const { user } = sessionStore()

const controlledShow = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const isMobileView = computed(() => width.value < 768)

const showQuickEntryModal = ref(false)
const isEmailCampaignCreating = ref(false)
const error = ref('')
const modalStack = ref([])
const hasActiveSubModals = computed(() => modalStack.value.some(modal => modal.visible))

const { doctypeMeta } = getMeta('Email Campaign')

async function getCurrentUserId() {
  if (user.value?.name) return user.value.name
  if (typeof frappe !== 'undefined' && frappe.session && frappe.session.user) return frappe.session.user
  try {
    const response = await call('frappe.auth.get_logged_user')
    if (response) return response
  } catch {}
  return ''
}

const emailCampaign = useDocument('Email Campaign', '', {
  defaults: props.defaults,
})

// Get the document object properly
const document = emailCampaign.document

// Create resource for creating email campaigns
const createEmailCampaign = createResource({
  url: 'frappe.client.insert',
})

const tabs = createResource({
  url: 'crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_fields_layout',
  cache: ['QuickEntry', 'Email Campaign'],
  params: { doctype: 'Email Campaign', type: 'Quick Entry' },
  auto: true,
  transform: (_tabs) => {
    if (!_tabs || !Array.isArray(_tabs)) {
      return _tabs
    }
    
    return _tabs.forEach((tab) => {
      if (tab.sections && Array.isArray(tab.sections)) {
        tab.sections.forEach((section) => {
          if (section.columns && Array.isArray(section.columns)) {
            section.columns.forEach((column) => {
              if (column.fields && Array.isArray(column.fields)) {
                column.fields.forEach((field) => {
                  if (field.fieldname == 'status') {
                    field.fieldtype = 'Select'
                    field.options = 'Scheduled\nIn Progress\nCompleted\nUnsubscribed'
                  }
                  // Ensure Link fields have proper options
                  if (field.fieldname === 'campaign_name' && field.fieldtype === 'Link') {
                    field.options = 'Campaign'
                  }
                  if (field.fieldname === 'sender' && field.fieldtype === 'Link') {
                    field.options = 'User'
                    field.read_only = true
                  }
                  // Ensure Dynamic Link fields have proper options
                  if (field.fieldname === 'recipient' && field.fieldtype === 'Dynamic Link') {
                    field.options = 'email_campaign_for'
                  }
                })
              }
            })
          }
        })
      }
    })
  },
  onError(error) {
    console.error('Error loading field layout:', error)
    // Fallback to simple layout if API fails
    return {
      data: [{
        name: 'General',
        label: 'General',
        sections: [{
          columns: [{
            fields: [
              { fieldname: 'campaign_name', label: 'Campaign', fieldtype: 'Link', options: 'Campaign', reqd: 1 },
              { fieldname: 'email_campaign_for', label: 'Email Campaign For', fieldtype: 'Select', options: 'Lead\nContact\nEmail Group', reqd: 1 },
              { fieldname: 'recipient', label: 'Recipient', fieldtype: 'Dynamic Link', options: 'email_campaign_for', reqd: 1 },
              { fieldname: 'sender', label: 'Sender', fieldtype: 'Link', options: 'User', default: '__user' },
              { fieldname: 'start_date', label: 'Start Date', fieldtype: 'Date', reqd: 1 },
              { fieldname: 'end_date', label: 'End Date', fieldtype: 'Date', read_only: 1 },
              { fieldname: 'status', label: 'Status', fieldtype: 'Select', options: 'Scheduled\nIn Progress\nCompleted\nUnsubscribed', read_only: 1 }
            ]
          }]
        }]
      }]
    }
  }
})


function handleCloseButton() {
  controlledShow.value = false
}

function openQuickEntryModal() {
  showQuickEntryModal.value = true
}

function onQuickEntryClose() {
  showQuickEntryModal.value = false
}

function onQuickEntryReset() {
  // Handle reset
}

function onQuickEntrySaved() {
  // Handle saved
  showQuickEntryModal.value = false
  controlledShow.value = false
  emit('email-campaign-created', document.doc)
}

function openCreateModal(doctype, initialValue = '') {
  modalStack.value.push({
    doctype,
    initialValue,
    visible: true,
  })
}

function handleModalSuccess(idx, doc) {
  // Handle sub-modal success
  handleModalClose(idx)
}

function handleModalClose(idx) {
  modalStack.value.splice(idx, 1)
}

function ensureParentModalVisible(idx) {
  // Ensure parent modal is visible when sub-modal is active
}

function handleSubModalInteraction() {
  // Handle sub-modal interaction
}

function manageParentModalState() {
  // Manage parent modal state
}

function handleTabChange(tabName) {
  // Handle tab change
}

function onFieldChange(fieldName, value) {
  
  if (document.doc) {
    document.doc[fieldName] = value
  } else {
    console.error('Document.doc is not available')
  }
}

async function createNewEmailCampaign() {
  // Validate required fields
  if (!document.doc.campaign_name) {
    error.value = __('Campaign is mandatory')
    return
  }
  
  if (!document.doc.email_campaign_for) {
    error.value = __('Email Campaign For is mandatory')
    return
  }
  
  if (!document.doc.recipient) {
    error.value = __('Recipient is mandatory')
    return
  }
  
  if (!document.doc.start_date) {
    error.value = __('Start Date is mandatory')
    return
  }
  
  // Trigger before create hooks if available
  await emailCampaign.triggerOnBeforeCreate?.()
  
  createEmailCampaign.submit(
    {
      doc: {
        doctype: 'Email Campaign',
        ...document.doc,
      },
    },
    {
      validate() {
        error.value = null
        
        // Additional validation can be added here
        if (!document.doc.campaign_name) {
          error.value = __('Campaign is mandatory')
          return error.value
        }
        
        if (!document.doc.email_campaign_for) {
          error.value = __('Email Campaign For is mandatory')
          return error.value
        }
        
        if (!document.doc.recipient) {
          error.value = __('Recipient is mandatory')
          return error.value
        }
        
        if (!document.doc.start_date) {
          error.value = __('Start Date is mandatory')
          return error.value
        }
        
        isEmailCampaignCreating.value = true
      },
      onSuccess(data) {
        console.log('Email Campaign created successfully:', data)
        isEmailCampaignCreating.value = false
        
        controlledShow.value = false
        
        emit('email-campaign-created', data)
        
        if (data && data.name) {
          setTimeout(() => {
            try {
              router.push({ name: 'EmailCampaignDetail', params: { emailCampaignId: data.name } })
            } catch (error) {
              console.error('Error redirecting to detail page:', error)
              window.location.href = `/crm/email-campaign/${data.name}`
            }
          }, 100)
        }
        
        if (props.options?.afterInsert) {
          props.options.afterInsert()
        }
      },
      onError(err) {
        console.error('Error creating email campaign:', err)
        isEmailCampaignCreating.value = false
        
        if (!err.messages) {
          error.value = err.message || __('Error creating email campaign')
          return
        }
        
        if (Array.isArray(err.messages)) {
          error.value = err.messages.join('\n')
        } else {
          error.value = err.messages
        }
      },
    },
  )
}

watch(controlledShow, async (show) => {
  if (show) {
    const currentUserId = user.value?.name || (frappe?.session?.user ?? '__user');
    
    // Ensure document.doc exists first
    if (!document.doc) {
      document.doc = {}
    }
    
    document.doc = {
      ...props.defaults,
      status: 'Scheduled',
      sender: currentUserId, // <-- assign logged-in user
    }

    error.value = ''
  }
})



watch(controlledShow, async (show) => {
  if (show) {
    const currentUserId = await getCurrentUserId()
    Object.assign(document.doc, {
      ...props.defaults,
      status: 'Scheduled',
      sender: currentUserId
    })
    error.value = ''
  }
})


watch(() => user.value, async () => { 
  if (controlledShow.value && document.doc) {
    document.doc.sender = await getCurrentUserId()
  }
})

watch(() => user.value?.name, (n) => { 
  if (n && controlledShow.value && document.doc) {
    document.doc.sender = n
  }
})

watch(() => tabs.data, (newTabs) => {
}, { deep: true })

watch(() => document.doc, (newDoc) => {
}, { deep: true })
</script> 