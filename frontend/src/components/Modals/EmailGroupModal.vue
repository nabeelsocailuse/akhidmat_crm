<template>

  <Dialog v-model="controlledShow" :options="{ size: '4xl' }" :disableOutsideClickToClose="true" :disableEscToClose="hasActiveSubModals" :zIndex="hasActiveSubModals ? 1000 : 100" :backdrop="hasActiveSubModals ? 'static' : true" :persistent="true" data-modal="parent">
    <template #body>
      <AppStyling type="donor-modal-background">
      <AppStyling type="modal-styling" modalType="header" >
        <div class="mb-5 flex items-center justify-between" >
          <div>
          <h3 class="text-2xl font-semibold text-ink-gray-9">
            {{ __('Create Email Group') }}
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
              :doctype="'Email Group'" 
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
            :buttonLoading="isEmailGroupCreating"
            @click="createNewEmailGroup"
          />
        </div>
      </AppStyling>
      </AppStyling>
    </template>
  </Dialog>

  <QuickEntryModal
    v-model="showQuickEntryModal"
    :doctype="'Email Group'"
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
  name: "EmailGroupModal"
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

const emit = defineEmits(['update:modelValue', 'email-group-created', 'email-group-deleted'])

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
const isEmailGroupCreating = ref(false)
const error = ref('')
const modalStack = ref([])
const hasActiveSubModals = computed(() => modalStack.value.some(modal => modal.visible))

const { doctypeMeta } = getMeta('Email Group')

// Create document data object
const document = reactive({
  doc: { ...props.defaults }
})

// Create resource for email group creation
const createEmailGroup = createResource({
  url: 'frappe.client.insert',
})

// Ensure document is properly initialized
onMounted(() => {
  // Initialize document with defaults
  document.doc = { ...props.defaults }
})

const tabs = createResource({
  url: 'crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_fields_layout',
  cache: ['QuickEntry', 'Email Group'],
  params: { doctype: 'Email Group', type: 'Quick Entry' },
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
                  if (field.fieldname == 'total_subscribers') {
                    field.read_only = 1
                  }
                  // Ensure Link fields have proper options and configuration
                  if (field.fieldtype === 'Link') {
                    if (field.fieldname === 'confirmation_email_template') {
                      field.options = 'Email Template'
                      field.placeholder = field.placeholder || 'Select Confirmation Email Template'
                    } else if (field.fieldname === 'welcome_email_template') {
                      field.options = 'Email Template'
                      field.placeholder = field.placeholder || 'Select Welcome Email Template'
                    }
                  }
                  
                  // Ensure Data fields have proper placeholders
                  if (field.fieldtype === 'Data') {
                    if (field.fieldname === 'title' && !field.placeholder) {
                      field.placeholder = 'Enter Email Group Title'
                    } else if (field.fieldname === 'welcome_url' && !field.placeholder) {
                      field.placeholder = 'Enter Welcome URL'
                    }
                  }
                  
                  // Ensure Check fields have proper defaults
                  if (field.fieldtype === 'Check' && field.fieldname === 'add_query_parameters' && field.default === undefined) {
                    field.default = 0
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
    // Fallback to simple layout if API fails
    return {
      data: [{
        name: 'General',
        label: 'General',
        sections: [{
          columns: [{
            fields: [
              { fieldname: 'title', label: 'Title', fieldtype: 'Data', reqd: 1, placeholder: 'Enter Email Group Title' },
              { fieldname: 'total_subscribers', label: 'Total Subscribers', fieldtype: 'Int', read_only: 1, default: 0 },
              { fieldname: 'confirmation_email_template', label: 'Confirmation Email Template', fieldtype: 'Link', options: 'Email Template', placeholder: 'Select Confirmation Email Template' },
              { fieldname: 'welcome_email_template', label: 'Welcome Email Template', fieldtype: 'Link', options: 'Email Template', placeholder: 'Select Welcome Email Template' },
              { fieldname: 'welcome_url', label: 'Welcome URL', fieldtype: 'Data', placeholder: 'Enter Welcome URL' },
              { fieldname: 'add_query_parameters', label: 'Add Query Parameters', fieldtype: 'Check', default: 0 }
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
          { fieldname: 'title', label: 'Title', fieldtype: 'Data', reqd: 1, placeholder: 'Enter Email Group Title' },
          { fieldname: 'total_subscribers', label: 'Total Subscribers', fieldtype: 'Int', read_only: 1, default: 0 },
          { fieldname: 'confirmation_email_template', label: 'Confirmation Email Template', fieldtype: 'Link', options: 'Email Template', placeholder: 'Select Confirmation Email Template' },
          { fieldname: 'welcome_email_template', label: 'Welcome Email Template', fieldtype: 'Link', options: 'Email Template', placeholder: 'Select Welcome Email Template' },
          { fieldname: 'welcome_url', label: 'Welcome URL', fieldtype: 'Data', placeholder: 'Enter Welcome URL' },
          { fieldname: 'add_query_parameters', label: 'Add Query Parameters', fieldtype: 'Check', default: 0 }
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
  emit('email-group-created', document.doc)
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

async function createNewEmailGroup() {
  try {
    isEmailGroupCreating.value = true
    error.value = ''
    
    // Validate required fields
    if (!document.doc.title) {
      error.value = __('Title is required')
      return
    }
    
    // Create the email group using frappe.client.insert
    const result = await call('frappe.client.insert', {
      doc: {
        doctype: 'Email Group',
        ...document.doc,
      },
    })
    
    // Close the modal first
    controlledShow.value = false
    
    // Emit the created event
    emit('email-group-created', result)
    
    // Navigate to the detail page after successful creation
    if (result && result.name) {
      setTimeout(() => {
        try {
          router.push({ 
            name: 'EmailGroupDetail', 
            params: { emailGroupId: result.name } 
          })
        } catch (error) {
          console.error('Error redirecting to detail page:', error)
          // Fallback: try to navigate manually
          window.location.href = `/crm/email-group/${result.name}`
        }
      }, 100)
    }
    
    if (props.options?.afterInsert) {
      props.options.afterInsert()
    }
  } catch (err) {
    console.error('Email Group createNewEmailGroup: Error:', err)
    error.value = err.messages?.[0] || err.message || __('Error creating email group')
  } finally {
    isEmailGroupCreating.value = false
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