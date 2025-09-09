<template>
  <Dialog v-model="show" :options="{ size: '3xl' }">
    <template #body>
      <AppStyling type="modal-styling" modalType="header">
        <div class="mb-5 flex items-center justify-between">
          <div>
            <h3 class="text-2xl font-semibold leading-6 text-ink-gray-9">
              {{ __('Create Campaign') }}
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
          <div class="field-layout-wrapper">
            <FieldLayout 
              v-if="tabs.data" 
              :tabs="tabs.data" 
              :data="campaign.doc" 
              :doctype="'Campaign'" 
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
            :buttonLoading="isCampaignCreating"
            @click="createNewCampaign"
          />
        </div>
      </AppStyling>
    </template>
  </Dialog>
</template>

<script setup>
import EditIcon from '@/components/Icons/EditIcon.vue'
import AppStyling from '@/components/AppStyling.vue'
import FieldLayout from '@/components/FieldLayout/FieldLayout.vue'
import { usersStore } from '@/stores/users'
import { sessionStore } from '@/stores/session'
import { isMobileView } from '@/composables/settings'
import { showQuickEntryModal, quickEntryProps } from '@/composables/modals'
import { capture } from '@/telemetry'
import { createResource, call, FormControl } from 'frappe-ui'
import { useOnboarding } from 'frappe-ui/frappe'
import { useDocument } from '@/data/document'
import { computed, onMounted, ref, nextTick } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({
  defaults: Object,
})

const { user } = sessionStore()
const { getUser, isManager, users } = usersStore()
const { updateOnboardingStep } = useOnboarding('frappecrm')

const show = defineModel()
const router = useRouter()
const error = ref(null)
const isCampaignCreating = ref(false)

const { document: campaign, triggerOnBeforeCreate } = useDocument('Campaign')

// Add tabs resource for field layout
const tabs = createResource({
  url: 'crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_fields_layout',
    cache: ['QuickEntryModal', 'Campaign', false],
  params: { doctype: 'Campaign', type: 'Quick Entry' },
  auto: true,
})

// Field change handler
const onFieldChange = (fieldname, value) => {
  console.log(`Campaign field changed: ${fieldname} = ${value}`)
  // The FieldLayout component will automatically update campaign.doc[fieldname]
}

const createCampaign = createResource({
  url: 'frappe.client.insert',
})

async function createNewCampaign() {
  await triggerOnBeforeCreate?.()

  createCampaign.submit(
    {
      doc: {
        doctype: 'Campaign',
        ...campaign.doc,
      },
    },
    {
      validate() {
        error.value = null
        if (!campaign.doc.campaign_name) {
          error.value = __('Campaign Name is mandatory')
          return error.value
        }
        isCampaignCreating.value = true
      },
      onSuccess(data) {
        capture('campaign_created')
        isCampaignCreating.value = false
        show.value = false
        router.push({ name: 'Campaign', params: { campaignId: data.name } })
        updateOnboardingStep('create_first_campaign', true, false, () => {
          localStorage.setItem('firstCampaign' + user, data.name)
        })
      },
      onError(err) {
        isCampaignCreating.value = false
        if (!err.messages) {
          error.value = err.message
          return
        }
        error.value = err.messages.join('\n')
      },
    },
  )
}

function openQuickEntryModal() {
  showQuickEntryModal.value = true
          quickEntryProps.value = { doctype: 'Campaign' }
  nextTick(() => (show.value = false))
}

onMounted(() => {
  campaign.doc = {}
  Object.assign(campaign.doc, props.defaults)

  if (!campaign.doc?.campaign_owner) {
    campaign.doc.campaign_owner = getUser().name
  }
})

</script>
