<template>
  <Dialog v-model="show" :options="{ size: 'xl' }">
    <template #body>
      <AppStyling type="modal-styling" modalType="header">
        <div class="mb-5 flex items-center justify-between">
          <div>
            <h3 class="text-2xl font-semibold leading-6 text-ink-gray-9">
              {{ __('New Address') }}
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
        <FieldLayout
          v-if="tabs.data?.length"
          :tabs="tabs.data"
          :data="_address.doc"
          doctype="Address"
        />
      </AppStyling>
      <AppStyling type="modal-styling" modalType="footer">
        <div class="space-y-2">
          <AppStyling
            type="button"
            buttonType="create"
            buttonLabel="Create"
            :buttonLoading="loading"
            @click="createAddress"
            class="w-full"
          />
        </div>
      </AppStyling>
    </template>
  </Dialog>
</template>

<script setup>
import FieldLayout from '@/components/FieldLayout/FieldLayout.vue'
import EditIcon from '@/components/Icons/EditIcon.vue'
import AppStyling from '@/components/AppStyling.vue'
import { usersStore } from '@/stores/users'
import { isMobileView } from '@/composables/settings'
import {
  showQuickEntryModal,
  quickEntryProps,
} from '@/composables/modals'
import { useDocument } from '@/data/document'
import { capture } from '@/telemetry'
import { Button, call, createResource, FeatherIcon } from 'frappe-ui'
import { ref, nextTick, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({
  address: {
    type: Object,
    default: {},
  },
  options: {
    type: Object,
    default: {
      redirect: true,
      afterInsert: () => {},
    },
  },
})

const { isManager } = usersStore()

const router = useRouter()
const show = defineModel()

const loading = ref(false)

const { document: _address, triggerOnBeforeCreate } = useDocument('Address')

async function createAddress() {
  await triggerOnBeforeCreate?.()

  const doc = await call('frappe.client.insert', {
    doc: {
      doctype: 'Address',
      ..._address.doc,
    },
  })
  if (doc.name) {
    capture('address_created')
    handleAddressUpdate(doc)
  }
}

function handleAddressUpdate(doc) {
  props.address?.reload?.()
  if (doc.name && props.options.redirect) {
    router.push({
      name: 'Address',
      params: { addressId: doc.name },
    })
  }
  show.value = false
  props.options.afterInsert && props.options.afterInsert(doc)
}

const tabs = createResource({
  url: 'crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_fields_layout',
  cache: ['QuickEntry', 'Address'],
  params: { doctype: 'Address', type: 'Quick Entry' },
  auto: true,
  transform: (_tabs) => {
    return _tabs.forEach((tab) => {
      tab.sections.forEach((section) => {
        section.columns.forEach((column) => {
          column.fields.forEach((field) => {
            if (field.fieldtype === 'Table') {
              _address.doc[field.fieldname] = []
            }
          })
        })
      })
    })
  },
})

onMounted(() => {
  _address.doc = {}
  Object.assign(_address.doc, props.address.data || props.address)
})

function openQuickEntryModal() {
  showQuickEntryModal.value = true
  quickEntryProps.value = { doctype: 'Address' }
  nextTick(() => (show.value = false))
}
</script>

<style scoped>
:deep(:has(> .dropdown-button)) {
  width: 100%;
}
</style>
