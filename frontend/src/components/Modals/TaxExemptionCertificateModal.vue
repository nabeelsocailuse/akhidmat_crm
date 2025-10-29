<template>
  <Dialog v-model="show" :options="{ size: '3xl' }">
    <template #body>
      <AppStyling type="donor-modal-background">
        <!-- Header -->
        <AppStyling type="modal-styling" modalType="header">
          <div class="mb-5 flex items-center justify-between">
            <div>
              <h3 class="text-2xl font-semibold leading-6 text-ink-gray-9">
                {{ __('Create Tax Exemption Certificate') }}
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

          <!-- Body -->
          <div>
            <FieldLayout 
              v-if="tabs.data" 
              :tabs="tabs.data" 
              doctype="Tax Exemption Certificate"
              :isModal="true"
              :data="certificate.doc"
              @field-change="handleFieldChange"
            />
            <ErrorMessage class="mt-4" v-if="error" :message="__(error)" />
          </div>
        </AppStyling>

        <!-- Footer -->
        <AppStyling type="modal-styling" modalType="footer">
          <div class="flex flex-row-reverse gap-2">
            <AppStyling
              type="button"
              buttonType="create"
              buttonLabel="Create"
              :buttonLoading="isCertificateCreating"
              @click="createNewCertificate"
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
import { createResource, call } from 'frappe-ui'
import { useDocument } from '@/data/document'
import { computed, ref, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({ defaults: Object })

const { user } = sessionStore()
const { getUser, isManager } = usersStore()
const { getCertificateStatus, statusOptions } = statusesStore()

const show = defineModel()
const router = useRouter()
const error = ref(null)
const isCertificateCreating = ref(false)

const { document: certificate, triggerOnBeforeCreate } = useDocument('Tax Exemption Certificate')

const certificateStatuses = computed(() => {
  let statuses = statusOptions('certificate')
  if (!certificate.doc.status) {
    certificate.doc.status = statuses?.[0]?.value
  }
  return statuses
})

const tabs = createResource({
  url: 'crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_fields_layout',
  cache: ['QuickEntry', 'Tax Exemption Certificate'],
  params: { doctype: 'Tax Exemption Certificate', type: 'Quick Entry' },
  auto: true,
  transform: (_tabs) => {
    return _tabs.forEach((tab) => {
      tab.sections.forEach((section) => {
        section.columns.forEach((column) => {
          column.fields.forEach((field) => {
            if (field.fieldname == 'status') {
              field.fieldtype = 'Select'
              field.options = certificateStatuses.value
              field.prefix = getCertificateStatus(certificate.doc.status).color
            }
            if (field.fieldtype === 'Table') {
              certificate.doc[field.fieldname] = []
            }
          })
        })
      })
    })
  },
})

const createCertificate = createResource({ url: 'frappe.client.insert' })

// ✅ Fetch donor details + currency
async function fetchAndSetDonorDetails(donorId) {
  if (!donorId) {
    if (certificate.doc) {
      certificate.doc.donor_name = ''
      certificate.doc.donor_cnic__ntn = ''
      certificate.doc.donor_address = ''
      certificate.doc.total_donation = 0
      certificate.doc.currency = null
    }
    return
  }
  try {
    const donor = await call('frappe.client.get', {
      doctype: 'Donor',
      name: donorId,
    })
    if (donor && certificate.doc) {
      certificate.doc.donor_name = donor.donor_name || ''
      certificate.doc.donor_cnic__ntn = donor.cnic || ''
      certificate.doc.donor_address = donor.address || ''
      certificate.doc.currency = donor.default_currency || donor.currency || null
    }
  } catch (e) {
    console.error(e)
  }
}

async function handleFieldChange(fieldName, value) {
  if (fieldName === 'donor' && value) {
    await fetchAndSetDonorDetails(value)
  }
}

watch(
  () => certificate.doc?.donor,
  async (newDonor, oldDonor) => {
    if (!certificate.doc) return
    if (newDonor !== oldDonor) {
      await fetchAndSetDonorDetails(newDonor)
    }
  },
  { immediate: true }
)

watch(
  () => [certificate.doc?.donor, certificate.doc?.fiscal_year],
  async ([newDonor, newFiscalYear]) => {
    if (!certificate.doc) return

    certificate.doc.total_donation = 0
    error.value = null

    if (!newDonor || !newFiscalYear) return

    try {
      const r = await call(
        'akfp_crm.akfp_crm.doctype.tax_exemption_certificate.tax_exemption_certificate.get_total_donation',
        {
          donor: newDonor,
          fiscal_year: newFiscalYear,
        }
      )

      if (r && r.total_donation !== undefined) {
        const amount = parseFloat(r.total_donation || 0)
        // Store numeric amount for Currency field rendering
        certificate.doc.total_donation = amount
      }

      if (r.message) {
        error.value = r.message
        nextTick(() => frappe.msgprint(r.message))
      }
    } catch (e) {
      console.error(e)
      error.value = 'Error fetching total donation'
    }
  },
  { immediate: true }
)


// Removed formattedDonation header display

async function createNewCertificate() {
  await triggerOnBeforeCreate?.()

  createCertificate.submit(
    { doc: { doctype: 'Tax Exemption Certificate', ...certificate.doc } },
    {
      validate() {
        error.value = null
        isCertificateCreating.value = true
      },
      onSuccess(data) {
        isCertificateCreating.value = false
        show.value = false
        router.push({
          name: 'TaxExemptionCertificate',
          params: { certificateId: data.name },
        })
      },
      onError(err) {
        isCertificateCreating.value = false
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
  quickEntryProps.value = { doctype: 'Tax Exemption Certificate' }
  nextTick(() => (show.value = false))
}

// Initialize document
if (!certificate.doc) {
  certificate.doc = {}
  Object.assign(certificate.doc, props.defaults)
}

// Set date_of_issue to today
nextTick(() => {
  if (certificate.doc && !certificate.doc.date_of_issue) {
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    certificate.doc.date_of_issue = `${yyyy}-${mm}-${dd}`
  }
})
</script>

<style></style>
