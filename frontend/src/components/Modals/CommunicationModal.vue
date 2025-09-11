<template>
  <Dialog v-model="controlledShow" :options="{ size: '4xl' }" :disableOutsideClickToClose="true" :disableEscToClose="hasActiveSubModals" :zIndex="hasActiveSubModals ? 1000 : 100" :backdrop="hasActiveSubModals ? 'static' : true" :persistent="true" data-modal="parent">
    <template #body>
      <AppStyling type="donor-modal-background">
      <AppStyling type="modal-styling" modalType="header" >
        <div class="mb-5 flex items-center justify-between" >
          <div>
          <h3 class="text-2xl font-semibold text-ink-gray-9">
            {{ __('Create Communication') }}
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
              v-if="fieldLayout && fieldLayout.length > 0" 
              :tabs="fieldLayout" 
              :data="document.doc" 
              :doctype="'Communication'" 
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
            :buttonLoading="isCommunicationCreating"
            @click="createNewCommunication"
          />
        </div>
      </AppStyling>
      </AppStyling>
    </template>
  </Dialog>

  <QuickEntryModal
    v-model="showQuickEntryModal"
    :doctype="'Communication'"
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
  name: "CommunicationModal"
}
</script>

<script setup>

import { ref, reactive, computed, watch, nextTick, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { createResource, Dialog, Button, ErrorMessage, call } from 'frappe-ui'
import { getMeta } from '@/stores/meta'
import { globalStore } from '@/stores/global'
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

const emit = defineEmits(['update:modelValue', 'communication-created', 'communication-deleted'])

const route = useRoute()
const router = useRouter()
const { $dialog, $socket } = globalStore()
const { width } = useWindowSize()

const controlledShow = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const isMobileView = computed(() => width.value < 768)

const showQuickEntryModal = ref(false)
const isCommunicationCreating = ref(false)
const error = ref('')
const modalStack = ref([])
const hasActiveSubModals = computed(() => modalStack.value.some(modal => modal.visible))

const { doctypeMeta } = getMeta('Communication')

// Create document data object
const document = reactive({
  doc: { ...props.defaults }
})

// Create resource for communication creation
const createCommunication = createResource({
  url: 'frappe.client.insert',
})

// Ensure document is properly initialized
onMounted(() => {
  // Initialize document with defaults
  document.doc = { ...props.defaults }
})

const tabs = createResource({
  url: 'crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_fields_layout',
  cache: ['QuickEntry', 'Communication'],
  params: { doctype: 'Communication', type: 'Quick Entry' },
  auto: true,
  onSuccess(data) {
    // Field layout loaded successfully
  },
  transform: (_tabs) => {
    if (!_tabs || !Array.isArray(_tabs)) {
      return _tabs
    }
    
    // Process the tabs and return the transformed data
    _tabs.forEach((tab) => {
      if (tab.sections && Array.isArray(tab.sections)) {
        tab.sections.forEach((section) => {
          if (section.columns && Array.isArray(section.columns)) {
            section.columns.forEach((column) => {
              if (column.fields && Array.isArray(column.fields)) {
                column.fields.forEach((field) => {
                  // Ensure proper field configuration based on core Communication doctype
                  if (field.fieldtype === 'Link') {
                    if (field.fieldname === 'reference_doctype') {
                      field.options = 'DocType'
                      // Limit available doctypes to the three allowed ones
                      const _allowed = ['Donor', 'CRM Lead', 'Contact']
                      field.get_query = () => ({ doctype: 'DocType', filters: { name: ['in', _allowed] } })
                      field.link_filters = JSON.stringify({ name: ['in', _allowed] })
                      field.placeholder = field.placeholder || 'Select Reference DocType'
                    } else if (field.fieldname === 'email_account') {
                      field.options = 'Email Account'
                      field.placeholder = field.placeholder || 'Select Email Account'
                    } else if (field.fieldname === 'user') {
                      field.options = 'User'
                      field.placeholder = field.placeholder || 'Select User'
                    }
                  }
                  
                  // Ensure Data fields have proper placeholders
                  if (field.fieldtype === 'Data') {
                    if (field.fieldname === 'subject' && !field.placeholder) {
                      field.placeholder = 'Enter Communication Subject'
                    } else if (field.fieldname === 'sender' && !field.placeholder) {
                      field.placeholder = 'Enter Sender Email'
                    } else if (field.fieldname === 'sender_full_name' && !field.placeholder) {
                      field.placeholder = 'Enter Sender Full Name'
                    } else if (field.fieldname === 'phone_no' && !field.placeholder) {
                      field.placeholder = 'Enter Phone Number'
                    }
                  }
                  
                  // Ensure Code fields have proper options
                  if (field.fieldtype === 'Code') {
                    if (field.fieldname === 'recipients' && !field.options) {
                      field.options = 'Email'
                    } else if (field.fieldname === 'cc' && !field.options) {
                      field.options = 'Email'
                    } else if (field.fieldname === 'bcc' && !field.options) {
                      field.options = 'Email'
                    }
                  }
                  
                  // Ensure Select fields have proper options based on core doctype
                  if (field.fieldtype === 'Select') {
                    if (field.fieldname === 'communication_type') {
                      field.options = 'Communication\nComment\nChat\nNotification\nFeedback\nAutomated Message'
                      field.default = 'Communication'
                      field.read_only = 1
                    } else if (field.fieldname === 'communication_medium') {
                      field.options = '\nEmail\nChat\nPhone\nSMS\nEvent\nMeeting\nVisit\nOther'
                    } else if (field.fieldname === 'sent_or_received') {
                      field.options = 'Sent\nReceived'
                    } else if (field.fieldname === 'status') {
                      field.options = 'Open\nReplied\nClosed\nLinked'
                    } else if (field.fieldname === 'delivery_status') {
                      field.options = '\nSent\nBounced\nOpened\nMarked As Spam\nRejected\nDelayed\nSoft-Bounced\nClicked\nRecipient Unsubscribed\nError\nExpired\nSending\nRead\nScheduled'
                    }
                  }
                  
                  // Ensure Check fields have proper defaults
                  if (field.fieldtype === 'Check') {
                    if (field.fieldname === 'unread_notification_sent' && field.default === undefined) {
                      field.default = 0
                    } else if (field.fieldname === 'read_receipt' && field.default === undefined) {
                      field.default = 0
                    } else if (field.fieldname === 'read_by_recipient' && field.default === undefined) {
                      field.default = 0
                    } else if (field.fieldname === 'seen' && field.default === undefined) {
                      field.default = 0
                    } else if (field.fieldname === 'has_attachment' && field.default === undefined) {
                      field.default = 0
                    }
                  }
                  
                  // Ensure Datetime fields have proper defaults
                  if (field.fieldtype === 'Datetime') {
                    if (field.fieldname === 'communication_date' && field.default === undefined) {
                      field.default = 'Now'
                    }
                  }
                })
              }
            })
          }
        })
      }
    })
    
    // Return the transformed tabs
    return _tabs
  },
  onError(error) {
    console.error('Error loading field layout:', error)
    // Return fallback layout if API fails
    return {
      data: [{
        name: 'General',
        label: 'General',
        sections: [{
          columns: [{
            fields: [
              { fieldname: 'subject', label: 'Subject', fieldtype: 'Small Text', reqd: 1, placeholder: 'Enter Communication Subject' },
              { fieldname: 'communication_type', label: 'Communication Type', fieldtype: 'Select', options: 'Communication\nComment\nChat\nNotification\nFeedback\nAutomated Message', default: 'Communication', read_only: 1, reqd: 1 },
              { fieldname: 'communication_medium', label: 'Type', fieldtype: 'Select', options: '\nEmail\nChat\nPhone\nSMS\nEvent\nMeeting\nVisit\nOther' },
              { fieldname: 'sender', label: 'From', fieldtype: 'Data', placeholder: 'Enter Sender Email' },
              { fieldname: 'recipients', label: 'To', fieldtype: 'Code', options: 'Email' },
              { fieldname: 'content', label: 'Message', fieldtype: 'Text Editor' },
              { fieldname: 'status', label: 'Status', fieldtype: 'Select', options: 'Open\nReplied\nClosed\nLinked', default: 'Open' },
              { fieldname: 'sent_or_received', label: 'Sent or Received', fieldtype: 'Select', options: 'Sent\nReceived' },
              { fieldname: 'communication_date', label: 'Date', fieldtype: 'Datetime', default: 'Now' },
              { fieldname: 'reference_doctype', label: 'Reference Document Type', fieldtype: 'Link', options: 'DocType' },
              { fieldname: 'reference_name', label: 'Reference Name', fieldtype: 'Dynamic Link', options: 'reference_doctype' }
            ]
          }]
        }]
      }]
    }
  }
})

// Ensure field layout is always available
const fieldLayout = computed(() => {
  if (tabs.data && tabs.data.length > 0) {
    return tabs.data
  }
  
  // Return fallback layout if API fails
  const fallbackLayout = [{
    name: 'General',
    label: 'General',
    sections: [{
      columns: [{
        fields: [
          { fieldname: 'subject', label: 'Subject', fieldtype: 'Small Text', reqd: 1, placeholder: 'Enter Communication Subject' },
          { fieldname: 'communication_type', label: 'Communication Type', fieldtype: 'Select', options: 'Communication\nComment\nChat\nNotification\nFeedback\nAutomated Message', default: 'Communication', read_only: 1, reqd: 1 },
          { fieldname: 'communication_medium', label: 'Type', fieldtype: 'Select', options: '\nEmail\nChat\nPhone\nSMS\nEvent\nMeeting\nVisit\nOther' },
          { fieldname: 'sender', label: 'From', fieldtype: 'Data', placeholder: 'Enter Sender Email' },
          { fieldname: 'recipients', label: 'To', fieldtype: 'Code', options: 'Email' },
          { fieldname: 'content', label: 'Message', fieldtype: 'Text Editor' },
          { fieldname: 'status', label: 'Status', fieldtype: 'Select', options: 'Open\nReplied\nClosed\nLinked', default: 'Open' },
          { fieldname: 'sent_or_received', label: 'Sent or Received', fieldtype: 'Select', options: 'Sent\nReceived' },
          { fieldname: 'communication_date', label: 'Date', fieldtype: 'Datetime', default: 'Now' },
          { fieldname: 'reference_doctype', label: 'Reference Document Type', fieldtype: 'Link', options: 'DocType' },
          { fieldname: 'reference_name', label: 'Reference Name', fieldtype: 'Dynamic Link', options: 'reference_doctype' }
        ]
      }]
    }]
  }]
  
  return fallbackLayout
})

function isManager() {
  // Check if user is manager - implement based on your permission system
  return true
}

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
  emit('communication-created', document.doc)
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
  // Ensure the field value is properly set
  if (document && document.doc) {
    document.doc[fieldName] = value
    
    // Force reactivity update if needed
    if (document.doc[fieldName] !== value) {
      document.doc[fieldName] = value
    }
  }
}

async function createNewCommunication() {
  try {
    isCommunicationCreating.value = true
    error.value = ''
    
    // Validate required fields based on core Communication doctype
    if (!document.doc.subject) {
      error.value = __('Subject is required')
      return
    }
    

    if (document.doc.communication_type === 'Communication') {
      if (!document.doc.status) {
        error.value = __('Status is required')
        return
      }
      if (!document.doc.sent_or_received) {
        error.value = __('Sent or Received is required')
        return
      }
    }
    
    const result = await call('frappe.client.insert', {
      doc: {
        doctype: 'Communication',
        ...document.doc,
      },
    })
    
    // Close the modal first
    controlledShow.value = false
    
    // Emit the created event
    emit('communication-created', result)
    
    // Navigate to the detail page after successful creation
    if (result && result.name) {
      setTimeout(() => {
        try {
          router.push({ 
            name: 'CommunicationDetail', 
            params: { communicationId: result.name } 
          })
        } catch (error) {
          console.error('Error redirecting to detail page:', error)
          // Fallback: try to navigate manually
          window.location.href = `/crm/communication/${result.name}`
        }
      }, 100)
    }
    
    if (props.options?.afterInsert) {
      props.options.afterInsert()
    }
  } catch (err) {
    console.error('Communication createNewCommunication: Error:', err)
    error.value = err.messages?.[0] || err.message || __('Error creating communication')
  } finally {
    isCommunicationCreating.value = false
  }
}

watch(controlledShow, (show) => {
  if (show) {
    // Reset form when modal opens
    document.doc = { ...props.defaults }
    error.value = ''
  }
})
</script>