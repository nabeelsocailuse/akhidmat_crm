<template>
  <Dialog v-model="show" :options="{ size: '3xl' }">
    <template #body>
      <AppStyling type="donor-modal-background">
        <AppStyling type="modal-styling" modalType="header">
          <div class="mb-5 flex items-center justify-between">
            <div>
              <h3 class="text-2xl font-semibold leading-6 text-ink-gray-9">{{ __('Create Email Group Member') }}</h3>
            </div>
            <div class="flex items-center gap-1">
              <Button
                v-if="!isMobileView"
                variant="ghost"
                class="w-7"
                @click="openQuickEntryModal"
              >
                <template #icon>
                  <EditIcon />
                </template>
              </Button>
              <Button variant="ghost" class="w-7" @click="show = false">
                <template #icon><FeatherIcon name="x" class="size-4" /></template>
              </Button>
            </div>
          </div>
          <div>
            <FieldLayout v-if="tabs.data" :tabs="tabs.data" :data="member.doc" />
            <ErrorMessage class="mt-4" v-if="error" :message="__(error)" />
          </div>
        </AppStyling>
        <AppStyling type="modal-styling" modalType="footer">
          <div class="flex flex-row-reverse gap-2">
            <AppStyling type="button" buttonType="create" buttonLabel="Create" :buttonLoading="isCreating" @click="createMember" />
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
import { createResource } from 'frappe-ui'
import { useRouter } from 'vue-router'
import { ref, onMounted } from 'vue'
import { useDocument } from '@/data/document'
import { isMobileView } from '@/composables/settings'
import { showQuickEntryModal, quickEntryProps } from '@/composables/modals'

const show = defineModel()
const error = ref(null)
const isCreating = ref(false)
const router = useRouter()

const { document: member, triggerOnBeforeCreate } = useDocument('Email Group Member')

const tabs = createResource({
  url: 'crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_fields_layout',
  cache: ['QuickEntry', 'Email Group Member'],
  params: { doctype: 'Email Group Member', type: 'Quick Entry' },
  auto: true,
})

const createDoc = createResource({ url: 'frappe.client.insert' })

async function createMember() {
  await triggerOnBeforeCreate?.()
  createDoc.submit(
    { doc: { doctype: 'Email Group Member', ...member.doc } },
    {
      validate() {
        error.value = null
        if (!member.doc?.email) {
          error.value = __('Email is mandatory')
          return error.value
        }
        isCreating.value = true
      },
      onSuccess(data) {
        isCreating.value = false
        show.value = false
        router.push({ name: 'EmailGroupMember', params: { memberId: data.name } })
      },
      onError(err) {
        isCreating.value = false
        error.value = err.messages?.join('\n') || err.message
      },
    },
  )
}

onMounted(() => {
  member.doc = member.doc || {}
})

function openQuickEntryModal() {
  showQuickEntryModal.value = true
  quickEntryProps.value = { doctype: 'Email Group Member' }
  show.value = false
}
</script>


