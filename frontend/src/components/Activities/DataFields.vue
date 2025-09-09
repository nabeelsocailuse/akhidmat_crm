<template>
  <div
    class="my-3 flex items-center justify-between text-lg font-medium sm:mb-4 sm:mt-8"
  >
    <div class="flex h-8 items-center text-xl font-semibold text-ink-gray-8">
      {{ __('Data') }}
      <Badge
        v-if="document?.isDirty"
        class="ml-3"
        :label="'Not Saved'"
        theme="orange"
      />
    </div>
    <div class="flex gap-1">
      <Button
        v-if="isManager() && !isMobileView"
        @click="showDataFieldsModal = true"
      >
        <template #icon>
          <EditIcon />
        </template>
      </Button>
      <AppStyling
        type="button"
        buttonType="create"
        buttonLabel="Save"
        :disabled="!document?.isDirty"
        :loading="document?.save?.loading"
        @click="saveChanges"
      />
    </div>
  </div>
  <div
    v-if="document?.get?.loading"
    class="flex flex-1 flex-col items-center justify-center gap-3 text-xl font-medium text-ink-gray-6"
  >
    <LoadingIndicator class="h-6 w-6" />
    <span>{{ __('Loading...') }}</span>
  </div>
  <div v-else class="pb-8">
    <FieldLayout
      v-if="tabs?.data"
      :tabs="tabs.data"
      :data="document?.doc"
      :doctype="doctype"
    />
  </div>
  <DataFieldsModal
    v-if="showDataFieldsModal"
    v-model="showDataFieldsModal"
    :doctype="doctype"
    @reload="
      () => {
        tabs?.reload()
        document?.reload()
      }
    "
  />
</template>

<script setup>
import EditIcon from '@/components/Icons/EditIcon.vue'
import DataFieldsModal from '@/components/Modals/DataFieldsModal.vue'
import FieldLayout from '@/components/FieldLayout/FieldLayout.vue'
import AppStyling from '@/components/AppStyling.vue'
import { Badge, createResource } from 'frappe-ui'
import LoadingIndicator from '@/components/Icons/LoadingIndicator.vue'
import { usersStore } from '@/stores/users'
import { useDocument } from '@/data/document'
import { isMobileView } from '@/composables/settings'
import { ref, watch, getCurrentInstance } from 'vue'

const props = defineProps({
  doctype: {
    type: String,
    required: true,
  },
  docname: {
    type: String,
    required: true,
  },
})

const emit = defineEmits(['beforeSave', 'afterSave'])

const { isManager } = usersStore()

const instance = getCurrentInstance()
const attrs = instance?.vnode?.props ?? {}

const showDataFieldsModal = ref(false)

const { document } = useDocument(props.doctype, props.docname)

const tabs = createResource({
  url: 'crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_fields_layout',
  cache: ['DataFields', props.doctype],
  params: { doctype: props.doctype, type: 'Data Fields' },
  auto: true,
  transform: (tabs) => {
    if (!tabs || !Array.isArray(tabs)) return tabs
    const allowed = ['Donor', 'CRM Lead', 'Contact']
    tabs.forEach((tab) => {
      if (!tab.sections || !Array.isArray(tab.sections)) return
      tab.sections.forEach((section) => {
        if (!section.columns || !Array.isArray(section.columns)) return
        section.columns.forEach((column) => {
          if (!column.fields || !Array.isArray(column.fields)) return
          column.fields.forEach((field) => {
            if (field.fieldtype === 'Link' && field.fieldname === 'reference_doctype') {
              field.options = 'DocType'
              field.link_filters = JSON.stringify({ name: ['in', allowed] })
              field.get_query = () => ({ doctype: 'DocType', filters: { name: ['in', allowed] } })
            }
          })
        })
      })
    })
    return tabs
  },
})

function saveChanges() {
  if (!document?.isDirty) return

  const updatedDoc = { ...document.doc }
  const oldDoc = { ...document.originalDoc }

  const changes = Object.keys(updatedDoc).reduce((acc, key) => {
    if (JSON.stringify(updatedDoc[key]) !== JSON.stringify(oldDoc[key])) {
      acc[key] = updatedDoc[key]
    }
    return acc
  }, {})

  const hasListener = attrs['onBeforeSave'] !== undefined

  if (hasListener) {
    emit('beforeSave', changes)
  } else {
    document?.save?.submit(null, {
      onSuccess: () => emit('afterSave', changes),
    })
  }
}

watch(
  () => document?.doc,
  (newValue, oldValue) => {
    if (!oldValue) return
    if (newValue && oldValue && document?.originalDoc) {
      const isDirty =
        JSON.stringify(newValue) !== JSON.stringify(document.originalDoc)
      if (document) {
        document.isDirty = isDirty
        if (isDirty && document.save) {
          document.save.loading = false
        }
      }
    }
  },
  { deep: true },
)
</script>
