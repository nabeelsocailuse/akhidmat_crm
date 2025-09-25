<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
      <div class="min-h-screen bg-gradient-to-b from-[#fef7ff] to-[#F5F9FF]">
    <LayoutHeader v-if="emailTemplate.data">
      <template #left-header>
        <Breadcrumbs :items="breadcrumbs" />
      </template>
      <template #right-header>
        <CustomActions
          v-if="emailTemplate.data._customActions?.length"
          :actions="emailTemplate.data._customActions"
        />
        <AssignTo
          v-model="assignees.data"
          :data="document.doc"
          doctype="Email Template"
        />
      </template>
    </LayoutHeader>

    <!-- Mobile Content -->
    <div v-if="emailTemplate?.data" class="flex-1 overflow-y-auto p-4 space-y-4">
      <!-- Save Button -->
      <div class="flex justify-end">
        <Button
          variant="solid"
          :label="__('Save')"
          :disabled="!document?.isDirty"
          :loading="document?.save?.loading"
          @click="saveNow"
        />
      </div>

      <!-- Fields -->
      <FieldLayout
        v-if="detailTabs.data && detailTabs.data.length"
        :tabs="detailTabs.data"
        :data="doc"
        doctype="Email Template"
        @field-change="handleFieldChange"
      />

      <!-- Response Editor -->
      <div>
        <div class="mb-2 text-base text-ink-gray-7">{{ __('Response') }}</div>
        <TextEditor
          v-if="useHtml"
          editor-class="prose-sm min-h-[16rem] border rounded-lg p-2"
          :content="doc?.response_html || ''"
          placeholder="Type something..."
          @change="(val) => updateField('response_html', val)"
          :bubbleMenu="true"
          :fixed-menu="true"
        />
        <TextEditor
          v-else
          editor-class="prose-sm min-h-[16rem] border rounded-lg p-2"
          :content="doc?.response || ''"
          placeholder="Type something..."
          @change="(val) => updateField('response', val)"
          :bubbleMenu="true"
          :fixed-menu="true"
        />
      </div>
    </div>

    <!-- Error -->
    <ErrorPage
      v-if="errorTitle"
      :errorTitle="errorTitle"
      :errorMessage="errorMessage"
    />

    <!-- Modals -->
    <FilesUploader
      v-if="emailTemplate.data?.name"
      v-model="showFilesUploader"
      doctype="Email Template"
      :docname="props.emailTemplateId"
      @after="
        () => {
          changeTabTo('attachments')
        }
      "
    />
    <DeleteLinkedDocModal
      v-if="showDeleteLinkedDocModal"
      v-model="showDeleteLinkedDocModal"
      :doctype="'Email Template'"
      :docname="props.emailTemplateId"
      name="Email Templates"
    />
  </div>
    </div>
</template>

<script setup>
import LayoutHeader from '@/components/LayoutHeader.vue'
import Breadcrumbs from '@/components/Breadcrumbs.vue'
import CustomActions from '@/components/CustomActions.vue'
import AssignTo from '@/components/AssignTo.vue'
import FieldLayout from '@/components/FieldLayout/FieldLayout.vue'
import ErrorPage from '@/components/ErrorPage.vue'
import FilesUploader from '@/components/FilesUploader/FilesUploader.vue'
import DeleteLinkedDocModal from '@/components/DeleteLinkedDocModal.vue'
import { Button, createResource, toast, TextEditor} from 'frappe-ui'
import { computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDocument } from '@/data/document'
import { setupCustomizations } from '@/utils'
import { getView } from '@/utils/view'
import { getSettings } from '@/stores/settings'

const { brand } = getSettings()
const route = useRoute()
const router = useRouter()

const props = defineProps({
  emailTemplateId: { type: String, required: true },
})

const errorTitle = ref('')
const errorMessage = ref('')
const showFilesUploader = ref(false)
const showDeleteLinkedDocModal = ref(false)

const { assignees, document } = useDocument('Email Template', props.emailTemplateId)

const emailTemplate = createResource({
  url: 'frappe.client.get',
  params: { doctype: 'Email Template', name: props.emailTemplateId },
  cache: ['emailTemplate', props.emailTemplateId],
  onSuccess: (data) => {
    errorTitle.value = ''
    errorMessage.value = ''
    setupCustomizations(emailTemplate, {
      doc: data,
      router,
      toast,
      updateField,
      deleteDoc: deleteEmailTemplate,
      resource: { emailTemplate, detailTabs },
    })
  },
  onError: (err) => {
    errorTitle.value = __('Not permitted')
    errorMessage.value = err.messages?.[0] || __('Error loading Email Template')
  },
})

onMounted(() => {
  if (!emailTemplate.data) emailTemplate.fetch()
})

const doc = computed(() => document.doc || {})

const useHtml = computed(() => {
  const v = doc.value?.use_html
  return v === 1 || v === true || v === '1'
})

const breadcrumbs = computed(() => [
  { label: __('Email Templates'), route: { name: 'EmailTemplates' } },
  {
    label: doc.value?.name || props.emailTemplateId,
    route: { name: 'EmailTemplate', params: { emailTemplateId: props.emailTemplateId } },
  },
])

const detailTabs = createResource({
  url: 'crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_fields_layout',
  cache: ['Detail', 'Email Template'],
  params: { doctype: 'Email Template', type: 'Detail' },
  auto: true,
})

function handleFieldChange(fieldname, value) {
  if (fieldname === 'use_html') {
    const normalized = value === 1 || value === true || value === '1'
    updateField('use_html', normalized ? 1 : 0)
  } else {
    updateField(fieldname, value)
  }
}

function updateField(name, value) {
  doc.value[name] = value
}

async function deleteEmailTemplate(name) {
  await frappe.call('frappe.client.delete', { doctype: 'Email Template', name })
  router.push({ name: 'EmailTemplates' })
}

function saveNow() {
  document.save.submit(null, {
    onSuccess: () => toast.success(__('Saved')),
    onError: (err) => toast.error(err?.messages?.[0] || __('Failed to save')),
  })
}
</script>
