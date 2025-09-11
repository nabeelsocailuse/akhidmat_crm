<template>
  <Dialog v-model="show" :options="{ size: '3xl' }">
    <template #body>
      <AppStyling type="donor-modal-background">
        <AppStyling type="modal-styling" modalType="header">
          <div class="mb-5 flex items-center justify-between">
            <div>
              <h3 class="text-2xl font-semibold leading-6 text-ink-gray-9">
                {{ editMode ? __('Edit Email Template') : __('Create Email Template') }}
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
                  <EditIcon />
                </template>
              </Button>
              <Button variant="ghost" class="w-7" @click="show = false">
                <template #icon>
                  <FeatherIcon name="x" class="size-4" />
                </template>
              </Button>
            </div>
          </div>
          <div>
            <div v-if="errorMessage" class="mb-4">
              <ErrorMessage :message="__(errorMessage)" />
            </div>
            
            <!-- Use FieldLayout to display all fields from CRM layout -->
            <FieldLayout 
              v-if="fieldLayout && fieldLayout.length > 0" 
              :tabs="fieldLayout" 
              :data="emailTemplate" 
              :doctype="'Email Template'"
              @field-change="handleFieldChange"
            />
            
            <!-- Content editor area controlled by use_html -->
            <div class="mt-3" v-if="fieldLayout && fieldLayout.length > 0">
              <template v-if="emailTemplate.use_html">
                <FormControl
                  size="md"
                  type="textarea"
                  :label="__(' Response ')"
                  :required="true"
                  ref="content_html"
                  :rows="10"
                  v-model="emailTemplate.response_html"
                  :placeholder="__(
                    '<p>Dear {{ lead_name }},</p>\n\n<p>This is a reminder for the payment of {{ grand_total }}.</p>\n\n<p>Thanks,</p>\n<p>Frappé</p>'
                  )"
                />
              </template>
              <template v-else>
                <div class="mb-1.5 text-base text-ink-gray-5">
                  {{ __(' Response ') }}
                  <span class="text-ink-red-3">*</span>
                </div>
                <div class="p-2">
                  <TextEditor
                    ref="content_rich"
                    editor-class="prose-sm min-h-[4rem] border rounded-b-lg border-t-0 p-2"
                    :content="emailTemplate.response || ''"
                    placeholder="Type something..."
                    @change="(val) => (emailTemplate.response = val)"
                    :bubbleMenu="true"
                    :fixed-menu="true"
                  />
                </div>
              </template>
            </div>
            
            <!-- Fallback message if no CRM layout is available -->
            <div v-else class="flex items-center justify-center py-8">
              <div class="text-center">
                <p class="text-ink-gray-5">{{ __('Loading email template fields...') }}</p>
              </div>
            </div>
          </div>
        </AppStyling>
        <AppStyling type="modal-styling" modalType="footer">
          <div class="flex flex-row-reverse gap-2">
            <AppStyling
              type="button"
              buttonType="create"
              :buttonLabel="editMode ? __('Update') : __('Create')"
              :buttonLoading="isCreating"
              @click="editMode ? updateEmailTemplateFn() : createEmailTemplateFn()"
            />
          </div>
        </AppStyling>
      </AppStyling>
    </template>
  </Dialog>
</template>

<script setup>
import { TextEditor, FormControl, Switch, toast, call, createResource, Dialog, ErrorMessage, Button } from 'frappe-ui'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import FieldLayout from '@/components/FieldLayout/FieldLayout.vue'
import AppStyling from '@/components/AppStyling.vue'
import EditIcon from '@/components/Icons/EditIcon.vue'
import FeatherIcon from '@/components/Icons/FeatherIcon.vue'
import { usersStore } from '@/stores/users'
import { isMobileView } from '@/composables/settings'
import { showQuickEntryModal, quickEntryProps } from '@/composables/modals'

const props = defineProps({
  editMode: {
    type: Boolean,
    default: false,
  },
  templateData: {
    type: Object,
    default: () => ({}),
  },
  modelValue: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue', 'success'])

const route = useRoute()
const router = useRouter()

const show = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const errorMessage = ref('')
const isCreating = ref(false)

const { getUser, isManager } = usersStore()

const emailTemplate = ref({
  name: '',
  reference_doctype: '',
  subject: '',
  content_type: 'Rich Text',
  use_html: 0,
  response_html: '',
  response: '',
  enabled: false,
})

// Fetch CRM field layout for Email Template
const tabs = createResource({
  url: 'crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_fields_layout',
  cache: ['EmailTemplateModal', 'Email Template'],
  params: { doctype: 'Email Template', type: 'Quick Entry' },
  auto: true,
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
                  if (field.fieldname === 'name') {
                    field.read_only = false
                    field.hidden = false
                    field.reqd = field.reqd || 1
                    field.placeholder = field.placeholder || 'Enter Template Name'
                  }
                  if (['response', 'response_html'].includes(field.fieldname)) {
                    field.hidden = true
                  }
                  if (field.fieldtype === 'Link') {
                    if (field.fieldname === 'reference_doctype') {
                      field.options = 'DocType'
                      field.placeholder = field.placeholder || 'Select Reference DocType'
                      const allowed = ['Donor', 'CRM Lead', 'Contact']
                      field.get_query = () => ({
                        doctype: 'DocType',
                        filters: { name: ['in', allowed] },
                      })
                      field.link_filters = JSON.stringify({ name: ['in', allowed] })
                    }
                  }
                  
                  // Ensure Data fields have proper placeholders
                  if (field.fieldtype === 'Data') {
                    if (field.fieldname === 'name' && !field.placeholder) {
                      field.placeholder = 'Enter Template Name'
                    } else if (field.fieldname === 'subject' && !field.placeholder) {
                      field.placeholder = 'Enter Email Subject'
                    }
                  }
                  
                  // Ensure Check fields have proper defaults
                  if (field.fieldtype === 'Check' && field.fieldname === 'enabled' && field.default === undefined) {
                    field.default = 0
                  }
                })
              }
            })
          }
        })
      }
    
    let hasName = false
    _tabs.forEach((tab) => {
      tab.sections?.forEach((section) => {
        section.columns?.forEach((column) => {
          if (column.fields && column.fields.some((f) => f.fieldname === 'name')) {
            hasName = true
          }
        })
      })
    })
    if (!hasName) {
      try {
        const firstTab = _tabs[0]
        const firstSection = firstTab.sections && firstTab.sections[0]
        const firstColumn = firstSection.columns && firstSection.columns[0]
        if (firstColumn && Array.isArray(firstColumn.fields)) {
          firstColumn.fields.unshift({
            fieldname: 'name',
            label: 'Template Name',
            fieldtype: 'Data',
            reqd: 1,
            placeholder: 'Enter Template Name',
          })
        }
      } catch (e) {
        // ignore injection errors
      }
    }
    })
    
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
              { fieldname: 'name', label: 'Template Name', fieldtype: 'Data', reqd: 1, placeholder: 'Enter Template Name' },
              { fieldname: 'subject', label: 'Subject', fieldtype: 'Data', reqd: 1, placeholder: 'Enter Email Subject' },
              { fieldname: 'reference_doctype', label: 'Reference DocType', fieldtype: 'Link', options: 'DocType', placeholder: 'Select Reference DocType' },
              { fieldname: 'use_html', label: 'Use HTML', fieldtype: 'Check', default: 0 },
              { fieldname: 'response', label: 'Response (Text)', fieldtype: 'Text', placeholder: 'Enter text response' },
              { fieldname: 'response_html', label: 'Response (HTML)', fieldtype: 'Code', placeholder: 'Enter HTML response' },
              { fieldname: 'enabled', label: 'Enabled', fieldtype: 'Check', default: 0 }
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
          { fieldname: 'name', label: 'Template Name', fieldtype: 'Data', reqd: 1, placeholder: 'Enter Template Name' },
          { fieldname: 'subject', label: 'Subject', fieldtype: 'Data', reqd: 1, placeholder: 'Enter Email Subject' },
          { fieldname: 'reference_doctype', label: 'Reference DocType', fieldtype: 'Link', options: 'DocType', placeholder: 'Select Reference DocType' },
          { fieldname: 'use_html', label: 'Use HTML', fieldtype: 'Check', default: 0 },
          { fieldname: 'response', label: 'Response (Text)', fieldtype: 'Text', placeholder: 'Enter text response', hidden: 1 },
          { fieldname: 'response_html', label: 'Response (HTML)', fieldtype: 'Code', placeholder: 'Enter HTML response', hidden: 1 },
          { fieldname: 'enabled', label: 'Enabled', fieldtype: 'Check', default: 0 }
        ]
      }]
    }]
  }]
  
  return fallbackLayout
})

const createEmailTemplate = createResource({
  url: 'frappe.client.insert',
})

const updateEmailTemplate = createResource({
  url: 'frappe.client.set_value',
})

// Handle field changes from FieldLayout
function handleFieldChange(fieldname, value) {
  if (emailTemplate.value) {
    emailTemplate.value[fieldname] = value
  }
}

// Initialize form when modal opens
onMounted(() => {
  if (props.editMode && props.templateData) {
    // Edit mode: populate form with existing data
    Object.keys(props.templateData).forEach(key => {
      if (emailTemplate.value.hasOwnProperty(key)) {
        emailTemplate.value[key] = props.templateData[key]
      }
    })
    // Map legacy content_type to use_html if not present
    if (props.templateData.use_html === undefined && props.templateData.content_type) {
      emailTemplate.value.use_html = props.templateData.content_type === 'HTML' ? 1 : 0
    }
  } else {
    // Create mode: set default values
    emailTemplate.value = {
      name: '',
      reference_doctype: '',
      subject: '',
      content_type: 'Rich Text',
      use_html: 0,
      response_html: '',
      response: '',
      enabled: false,
    }
  }
})

// Watch for changes in modelValue to reset form when modal opens/closes
watch(() => props.modelValue, (newVal) => {
  if (newVal && !props.editMode) {
    // Reset form when opening in create mode
    emailTemplate.value = {
      name: '',
      reference_doctype: '',
      subject: '',
      content_type: 'Rich Text',
      use_html: 0,
      response_html: '',
      response: '',
      enabled: false,
    }
    errorMessage.value = ''
  }
})

function openQuickEntryModal() {
  showQuickEntryModal.value = true
  quickEntryProps.value = {
    doctype: 'Email Template',
    defaults: emailTemplate.value,
  }
}

async function createEmailTemplateFn() {
  errorMessage.value = ''
  isCreating.value = true
  
  // Basic validation for required fields
  if (!emailTemplate.value.name) {
    errorMessage.value = __('Name is required')
    isCreating.value = false
    return
  }
  if (!emailTemplate.value.subject) {
    errorMessage.value = __('Subject is required')
    isCreating.value = false
    return
  }
  if (!emailTemplate.value.response) {
    errorMessage.value = __('Response is required')
    isCreating.value = false
    return
  }

  // Create template data with all fields from the form
  const templateData = {
    doctype: 'Email Template',
    ...emailTemplate.value,
  }

  createEmailTemplate.submit(
    { doc: templateData },
    {
      onSuccess: (data) => {
        toast.success(__('Email Template created successfully'))
        
        // Close the modal first
        show.value = false
        
        // Emit success event
        emit('success')
        
        // Use the name from the form data since that's what was submitted
        const templateName = templateData.name
        
        if (templateName) {
          // Add a longer delay to ensure the document is fully committed to the database
          setTimeout(() => {
            try {
              router.push({ name: 'EmailTemplate', params: { emailTemplateId: templateName } })
            } catch (error) {
              console.error('Error redirecting to detail page:', error)
              // Fallback: try to navigate manually
              window.location.href = `/crm/email-template/${templateName}`
            }
          }, 1000) // Increased delay to 1 second to ensure document is committed
        } else {
          // Fallback: redirect to list view
          router.push({ name: 'EmailTemplates' })
        }
      },
      onError: (error) => {
        errorMessage.value = error.messages?.[0] || __('Failed to create email template')
        isCreating.value = false
      },
    },
  )
}



async function updateEmailTemplateFn() {
  errorMessage.value = ''
  isCreating.value = true
  
  if (!emailTemplate.value.name) {
    errorMessage.value = __('Name is required')
    isCreating.value = false
    return
  }
  if (!emailTemplate.value.subject) {
    errorMessage.value = __('Subject is required')
    isCreating.value = false
    return
  }
  if (!emailTemplate.value.use_html && !emailTemplate.value.response) {
    errorMessage.value = __(' Response  is required')
    isCreating.value = false
    return
  }
  if (emailTemplate.value.use_html && !emailTemplate.value.response_html) {
    errorMessage.value = __(' Response  is required')
    isCreating.value = false
    return
  }

  const updates = [
    { fieldname: 'subject', value: emailTemplate.value.subject },
    { fieldname: 'use_html', value: emailTemplate.value.use_html ? 1 : 0 },
    { fieldname: 'enabled', value: emailTemplate.value.enabled ? 1 : 0 },
  ]

  if (!emailTemplate.value.use_html) {
    updates.push({ fieldname: 'response', value: emailTemplate.value.response })
  } else {
    updates.push({ fieldname: 'response_html', value: emailTemplate.value.response_html })
  }

  // Update each field
  for (const update of updates) {
    await updateEmailTemplate.submit({
      doctype: 'Email Template',
      name: props.templateData.name,
      fieldname: update.fieldname,
      value: update.value,
    })
  }

  toast.success(__('Email Template updated successfully'))
  emit('success')
  isCreating.value = false
}
</script> 