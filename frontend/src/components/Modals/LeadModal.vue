<template>
  <Dialog v-model="show" :options="{ size: '3xl' }">
    <template #body>
      <AppStyling type="donor-modal-background">
        <AppStyling type="modal-styling" modalType="header">
          <div class="mb-5 flex items-center justify-between">
            <div>
              <h3 class="text-2xl font-semibold leading-6 text-ink-gray-9">
                {{ __('Create Lead') }}
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
            <FieldLayout v-if="tabs.data" :tabs="tabs.data" :data="lead.doc" />
            <ErrorMessage class="mt-4" v-if="error" :message="__(error)" />
            <ErrorMessage
              class="mt-4"
              v-if="duplicateCnicError"
              :message="__('A lead with this identification value already exists.')"
            />
          </div>
        </AppStyling>
        <AppStyling type="modal-styling" modalType="footer">
          <div class="flex flex-row-reverse gap-2">
            <AppStyling
              type="button"
              buttonType="create"
              buttonLabel="Create"
              :buttonLoading="isLeadCreating"
              :disabled="duplicateCnicError"
              @click="createNewLead"
            />
          </div>
        </AppStyling>
      </AppStyling>
    </template>
  </Dialog>
</template>

<script setup>
import EditIcon from '@/components/Icons/EditIcon.vue'
import FieldLayout from '@/components/FieldLayout/FieldLayout.vue'
import AppStyling from '@/components/AppStyling.vue'
import { usersStore } from '@/stores/users'
import { statusesStore } from '@/stores/statuses'
import { sessionStore } from '@/stores/session'
import { isMobileView } from '@/composables/settings'
import { showQuickEntryModal, quickEntryProps } from '@/composables/modals'
import { capture } from '@/telemetry'
import { createResource } from '@/utils/resource'
import { call } from '@/utils/api'
import { useOnboarding } from 'frappe-ui/frappe'
import { useDocument } from '@/data/document'
import { useDonorFieldValidation } from '@/composables/useDonorFieldValidation'
import { computed, onMounted, ref, nextTick, watch, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

const {
  applyCnicMaskToInput,
  validateCnicFormat,
  applyPhoneMasksForCountry, 
  validatePhoneNumber,
  showPhoneValidationFeedback
} = useDonorFieldValidation()

const props = defineProps({
  defaults: Object,
})

const { user } = sessionStore()
const { getUser, isManager } = usersStore()
const { getLeadStatus, statusOptions } = statusesStore()
const { updateOnboardingStep } = useOnboarding('frappecrm')

const show = defineModel()
const router = useRouter()
const error = ref(null)
const isLeadCreating = ref(false)

const { document: lead, triggerOnBeforeCreate } = useDocument('CRM Lead')

const setFieldValue = (fieldName, value) => {
  if (lead.doc) {
    lead.doc[fieldName] = value
  }
}

const leadStatuses = computed(() => {
  let statuses = statusOptions('lead')
  if (!lead.doc.status) {
    lead.doc.status = statuses?.[0]?.value
  }
  return statuses
})

const tabs = createResource({
  url: 'crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_fields_layout',
  cache: ['QuickEntry', 'CRM Lead'],
  params: { doctype: 'CRM Lead', type: 'Quick Entry' },
  auto: true,
  transform: (_tabs) => {
    return _tabs.forEach((tab) => {
      tab.sections.forEach((section) => {
        section.columns.forEach((column) => {
          column.fields.forEach((field) => {
            if (field.fieldname == 'status') {
              field.fieldtype = 'Select'
              field.options = leadStatuses.value
              field.prefix = getLeadStatus(lead.doc.status).color
            }
            if (field.fieldtype === 'Table') {
              lead.doc[field.fieldname] = []
            }
          })
        })
      })
    })
  },
})

const createLead = createResource({
  url: 'frappe.client.insert',
})

const duplicateCnicError = ref(false)

// Watch for changes in the custom_identification_value field and check for duplicates
watch(
  () => lead.doc && lead.doc.custom_identification_value,
  async (newVal) => {
    duplicateCnicError.value = false
    if (newVal && newVal.trim() !== '') {
      try {
        const res = await call('frappe.client.get_list', {
          doctype: 'CRM Lead',
          fields: ['name'],
          filters: { custom_identification_value: newVal.trim() },
          limit_page_length: 1,
        })
        if (Array.isArray(res) && res.length > 0) {
          duplicateCnicError.value = true
        }
      } catch (e) {
        duplicateCnicError.value = false
      }
    }
  }
)

async function createNewLead() {
  if (duplicateCnicError.value) {
    error.value = __('A lead with this identification value already exists.')
    return
  }

  // Validate mobile number before proceeding
  if (lead.doc.mobile_no && lead.doc.country) {
    const validation = await validatePhoneNumber(lead.doc.mobile_no, lead.doc.country)
    if (!validation.isValid) {
      error.value = validation.message || __('Invalid Mobile No')
      return
    }
  }

  if (lead.doc.website && !lead.doc.website.startsWith('http')) {
    lead.doc.website = 'https://' + lead.doc.website
  }

  await triggerOnBeforeCreate?.()

  // Sync identification fields to core fieldnames to ensure detail view shows the value
  if (lead.doc.custom_identification_type) {
    lead.doc.identification_type = lead.doc.custom_identification_type
  }
  if (lead.doc.custom_identification_value) {
    lead.doc.identification_value = lead.doc.custom_identification_value
  }
 
  createLead.submit(
    {
      doc: { doctype: 'CRM Lead', ...lead.doc },
    },
    {
      validate() {
        error.value = null
        if (!lead.doc.first_name) {
          error.value = __('First Name is mandatory')
          return error.value
        }
        if (lead.doc.annual_revenue) {
          if (typeof lead.doc.annual_revenue === 'string') {
            lead.doc.annual_revenue = lead.doc.annual_revenue.replace(/,/g, '')
          } else if (isNaN(lead.doc.annual_revenue)) {
            error.value = __('Annual Revenue should be a number')
            return error.value
          }
        }
        if (lead.doc.mobile_no && isNaN(lead.doc.mobile_no.replace(/[-+() ]/g, ''))) {
          error.value = __('Mobile No should be a number')
          return error.value
        }
        if (lead.doc.email && !lead.doc.email.includes('@')) {
          error.value = __('Invalid Email')
          return error.value
        }
        if (!lead.doc.status) {
          error.value = __('Status is required')
          return error.value
        }
        if (lead.doc.custom_identification_type && lead.doc.custom_identification_type !== 'Others') {
          if (!lead.doc.custom_identification_value) {
            error.value = `${lead.doc.custom_identification_type} is required`
            return error.value
          }
          if (!validateCnicFormat(lead.doc.custom_identification_value, lead.doc.custom_identification_type)) {
            error.value = `Invalid ${lead.doc.custom_identification_type} format`
            return error.value
          }
        }
        if (lead.doc.custom_identification_type === 'Others') {
          if (!lead.doc.custom_others) {
            error.value = __('Others field is required when Identification Type is "Others"')
            return error.value
          }
        }
        isLeadCreating.value = true
      },
      onSuccess(data) {
        capture('lead_created')
        isLeadCreating.value = false
        show.value = false
        router.push({ name: 'Lead', params: { leadId: data.name } })
        updateOnboardingStep('create_first_lead', true, false, () => {
          localStorage.setItem('firstLead' + user, data.name)
        })
      },
      onError(err) {
        isLeadCreating.value = false
        if (!err.messages) {
          error.value = err.message
          return
        }
        error.value = err.messages.join('\n')
      },
    }
  )
}

function openQuickEntryModal() {
  showQuickEntryModal.value = true
  quickEntryProps.value = { doctype: 'CRM Lead' }
  nextTick(() => (show.value = false))
}

watch(() => lead.doc?.custom_identification_type, (newType, oldType) => {
  if (newType && newType !== oldType) {
    if (lead.doc) {
      lead.doc.custom_identification_value = ''
    }
    nextTick(() => {
      applyCnicMaskToInput('custom_identification_value', newType, setFieldValue)
    })
  }
})

watch(() => lead.doc?.custom_identification_value, (newValue, oldValue) => {
  if (newValue && newValue !== oldValue && lead.doc?.custom_identification_type) {
    nextTick(() => {
      applyCnicMaskToInput('custom_identification_value', lead.doc.custom_identification_type, setFieldValue)
    })
  }
})

watch(() => lead.doc?.country, async (newCountry, oldCountry) => {
  if (!newCountry) return
  if (oldCountry && oldCountry !== newCountry) {
    lead.doc.mobile_no = ''
  }
  setTimeout(() => {
    applyPhoneMasksForCountry(newCountry, setFieldValue, ['mobile_no'])
  }, 300)
})

watch(() => lead.doc?.mobile_no, async (newValue) => {
  if (newValue && lead.doc?.country) {
    const validation = await validatePhoneNumber(newValue, lead.doc.country)
    if (!validation.isValid) {
      showPhoneValidationFeedback('mobile_no', false, validation.message)
    } else {
      showPhoneValidationFeedback('mobile_no', true, '')
    }
  }
})

onMounted(() => {
  if (lead.doc?.country) {
    setTimeout(() => {
      applyPhoneMasksForCountry(lead.doc.country, setFieldValue, ['mobile_no'])
    }, 500)
  }
})

onMounted(() => {
  lead.doc = { no_of_employees: '1-10' }
  Object.assign(lead.doc, props.defaults)

  if (!lead.doc?.lead_owner) {
    lead.doc.lead_owner = getUser().name
  }
  if (!lead.doc?.status && leadStatuses.value[0]?.value) {
    lead.doc.status = leadStatuses.value[0].value
  }
  if (!lead.doc?.custom_identification_type) {
    lead.doc.custom_identification_type = 'CNIC'
  }
  if (lead.doc?.custom_identification_type) {
    setTimeout(() => {
      applyCnicMaskToInput('custom_identification_value', lead.doc.custom_identification_type, setFieldValue)
    }, 500)
  }

  const maskCheckInterval = setInterval(() => {
    if (lead.doc?.custom_identification_type && show.value) {
      const inputElement = document.querySelector(
        'input[name="custom_identification_value"], [data-fieldname="custom_identification_value"] input'
      )
      if (inputElement && !inputElement._maskHandler) {
        applyCnicMaskToInput('custom_identification_value', lead.doc.custom_identification_type, setFieldValue)
      }
    }
  }, 2000)

  window.leadMaskCheckInterval = maskCheckInterval
})

watch(() => show.value, (isVisible) => {
  if (isVisible && lead.doc?.custom_identification_type) {
    setTimeout(() => {
      applyCnicMaskToInput('custom_identification_value', lead.doc.custom_identification_type, setFieldValue)
    }, 300)
  }
})

onUnmounted(() => {
  if (window.leadMaskCheckInterval) {
    clearInterval(window.leadMaskCheckInterval)
    window.leadMaskCheckInterval = null
  }
})
</script>
