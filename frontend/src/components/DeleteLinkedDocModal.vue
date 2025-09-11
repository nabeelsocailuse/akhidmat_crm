<template>
  <Dialog v-model="show" :options="{ size: 'xl' }">
    <!-- Normal delete/unlink modal -->
    <template #body v-if="!confirmDeleteInfo.show">
      <div class="bg-surface-modal px-4 pb-6 pt-5 sm:px-6">
        <div class="mb-4 flex items-center justify-between">
          <div>
            <h3 class="text-2xl leading-6 text-ink-gray-9 font-semibold">
              {{
                linkedDocs?.length == 0
                  ? __('Delete')
                  : __('Delete or unlink linked documents')
              }}
            </h3>
          </div>
          <div class="flex items-center gap-1">
            <Button variant="ghost" icon="x" @click="show = false" />
          </div>
        </div>
        <div>
          <div v-if="linkedDocs?.length > 0">
            <span class="text-ink-gray-5 text-base">
              {{
                __(
                  'Delete or unlink these linked documents before deleting this document',
                )
              }}
            </span>
            <LinkedDocsListView
              class="mt-4"
              :rows="linkedDocs"
              :columns="[
                {
                  label: 'Document',
                  key: 'title',
                },
                {
                  label: 'Master',
                  key: 'reference_doctype',
                  width: '30%',
                },
              ]"
              @selectionsChanged="
                (selections) => viewControls.updateSelections(selections)
              "
              :linkedDocsResource="linkedDocsResource"
              :unlinkLinkedDoc="unlinkLinkedDoc"
            />
          </div>
          <div v-if="linkedDocs?.length == 0" class="text-ink-gray-5 text-base">
            {{
              __('Are you sure you want to delete {0} - {1}?', [
                props.doctype,
                props.docname,
              ])
            }}
          </div>
        </div>
      </div>
      <div class="px-4 pb-7 pt-0 sm:px-6">
        <div class="flex flex-row-reverse gap-2">
          <Button
            v-if="linkedDocs?.length > 0"
            :label="
              viewControls?.selections?.length == 0
                ? __('Delete all')
                : __('Delete {0} item(s)', [viewControls?.selections?.length])
            "
            theme="red"
            variant="solid"
            icon-left="trash-2"
            @click="confirmDelete()"
          />
          <Button
            v-if="linkedDocs?.length > 0"
            :label="
              viewControls?.selections?.length == 0
                ? __('Unlink all')
                : __('Unlink {0} item(s)', [viewControls?.selections?.length])
            "
            variant="subtle"
            theme="gray"
            icon-left="unlock"
            @click="confirmUnlink()"
          />
          <Button
            v-if="linkedDocs?.length == 0"
            variant="solid"
            icon-left="trash-2"
            :label="__('Delete')"
            :loading="isDealCreating"
            @click="deleteDoc()"
            theme="red"
          />
        </div>
      </div>
    </template>

    <!-- Confirmation / Error modal -->
    <template #body v-if="confirmDeleteInfo.show">
      <div class="bg-surface-modal px-4 pb-6 pt-5 sm:px-6">
        <div class="mb-6 flex items-center justify-between">
          <div>
            <h3 class="text-2xl leading-6 text-ink-gray-9 font-semibold">
              {{ confirmDeleteInfo.title }}
            </h3>
          </div>
          <div class="flex items-center gap-1">
            <Button variant="ghost" icon="x" @click="show = false" />
          </div>
        </div>

        <!-- Show error or confirmation message -->
        <div class="text-ink-gray-5 text-base whitespace-pre-line">
          {{ confirmDeleteInfo.message }}
        </div>

        <div class="flex justify-end gap-2 mt-6">
          <!-- ✅ If it's an error: show only OK -->
          <template v-if="confirmDeleteInfo.isError">
            <Button variant="solid" theme="blue" @click="show = false">
              OK
            </Button>
          </template>

          <!-- Normal confirmation (delete/unlink) -->
          <template v-else>
            <Button variant="ghost" @click="cancel()">
              {{ __('Cancel') }}
            </Button>
            <Button
              variant="solid"
              :label="confirmDeleteInfo.title"
              @click="removeDocLinks()"
              theme="red"
            />
          </template>
        </div>
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { createResource, call } from 'frappe-ui'
import { useRouter } from 'vue-router'
import { computed, ref } from 'vue'

const show = defineModel()
const router = useRouter()
const props = defineProps({
  name: { type: String, required: true },
  doctype: { type: String, required: true },
  docname: { type: String, required: true },
  reload: { type: Function },
})

const viewControls = ref({
  selections: [],
  updateSelections: (selections) => {
    viewControls.value.selections = Array.from(selections || [])
  },
})

const confirmDeleteInfo = ref({
  show: false,
  title: '',
  message: '',
  delete: false,
  isError: false,
})

const linkedDocsResource = createResource({
  url: 'crm.api.doc.get_linked_docs_of_document',
  params: { doctype: props.doctype, docname: props.docname },
  auto: true,
  validate(params) {
    return !!(params?.doctype && params?.docname)
  },
})

const linkedDocs = computed(() => {
  return (
    linkedDocsResource.data?.map((doc) => ({
      id: doc.reference_docname,
      ...doc,
    })) || []
  )
})

const cancel = () => {
  confirmDeleteInfo.value.show = false
  viewControls.value.updateSelections([])
}

const formatErrorMessage = (err) => {
  let raw =
    err.messages?.join('\n') ||
    err.exception ||
    err.message ||
    __('An unexpected error occurred')

  let cleaned = raw.replace(/<\/?[^>]+(>|$)/g, '') // strip HTML
  cleaned = cleaned.replace(/Row\s*#\d+:/gi, '') // remove Row #X
  cleaned = cleaned.replace(/Value missing for:\s*/gi, '') // simplify
  cleaned = cleaned.replace(/\s+/g, ' ').trim()

  let parts = cleaned
    .split(/Error:/i)
    .map((p) => p.trim())
    .filter((p) => p)

  parts = parts.map((p) => {
    if (p.includes('Cost Center')) return 'Cost Center is required'
    if (p.includes('Donor')) return 'Donor is required'
    if (p.includes('Transaction Type')) return 'Transaction Type is required'
    return p
  })

  return parts.map((p) => `• ${p}`).join('\n')
}

const unlinkLinkedDoc = async (doc) => {
  let selectedDocs = []
  if (viewControls.value.selections.length > 0) {
    Array.from(viewControls.value.selections).forEach((selection) => {
      const docData = linkedDocs.value.find((d) => d.id == selection)
      selectedDocs.push({
        doctype: docData.reference_doctype,
        docname: docData.reference_docname,
      })
    })
  } else {
    selectedDocs = linkedDocs.value.map((doc) => ({
      doctype: doc.reference_doctype,
      docname: doc.reference_docname,
    }))
  }

  try {
    await call('crm.api.doc.remove_linked_doc_reference', {
      items: selectedDocs,
      remove_contact: props.doctype == 'Contact',
      delete: doc.delete,
    })
    linkedDocsResource.reload()
    confirmDeleteInfo.value = { show: false, title: '', message: '', isError: false }
  } catch (err) {
    confirmDeleteInfo.value = {
      show: true,
      title: __('Delete Failed'),
      message: formatErrorMessage(err),
      delete: false,
      isError: true,
    }
  }
}

const confirmDelete = () => {
  const items =
    viewControls.value.selections.length == 0
      ? 'all'
      : viewControls.value.selections.length
  confirmDeleteInfo.value = {
    show: true,
    title: __('Delete linked item'),
    message: __('Are you sure you want to delete {0} linked item(s)?', [items]),
    delete: true,
    isError: false,
  }
}

const confirmUnlink = () => {
  const items =
    viewControls.value.selections.length == 0
      ? 'all'
      : viewControls.value.selections.length
  confirmDeleteInfo.value = {
    show: true,
    title: __('Unlink linked item'),
    message: __('Are you sure you want to unlink {0} linked item(s)?', [items]),
    delete: false,
    isError: false,
  }
}

const removeDocLinks = () => {
  unlinkLinkedDoc({
    reference_doctype: props.doctype,
    reference_docname: props.docname,
    delete: confirmDeleteInfo.value.delete,
  })
  viewControls.value.updateSelections([])
}

const deleteDoc = async () => {
  try {
    await call('frappe.client.delete', {
      doctype: props.doctype,
      name: props.docname,
    })
    if (props?.reload) props.reload()
    router.push({ name: props.name, query: { refresh: Date.now() } })
  } catch (err) {
    confirmDeleteInfo.value = {
      show: true,
      title: __('Delete Failed'),
      message: formatErrorMessage(err),
      delete: false,
      isError: true,
    }
  }
}
</script>
