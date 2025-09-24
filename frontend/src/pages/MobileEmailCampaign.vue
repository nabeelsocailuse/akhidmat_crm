<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <LayoutHeader v-if="emailCampaign.data">
      <template #left-header>
        <Breadcrumbs :items="breadcrumbs" />
      </template>
      <template #right-header>
        <CustomActions
          v-if="emailCampaign.data._customActions?.length"
          :actions="emailCampaign.data._customActions"
        />
        <AssignTo
          v-model="assignees.data"
          :data="document.doc"
          doctype="Email Campaign"
        />
      </template>
    </LayoutHeader>

    <!-- Mobile Content
    <div v-if="emailCampaign?.data" class="flex-1 overflow-y-auto">
      <Tabs as="div" v-model="tabIndex" :tabs="tabs">
        <TabList class="!px-3" />
        <TabPanel v-slot="{ tab }">
          <template v-if="tab.name === 'Data'">
            <div class="p-4 flex flex-col gap-4">
              <div class="flex items-center justify-end gap-2">
                <Button
                  variant="solid"
                  :label="__('Save')"
                  :disabled="!document?.isDirty"
                  :loading="document?.save?.loading"
                  @click="saveNow"
                />
              </div>
              <FieldLayout
                v-if="detailTabs.data && detailTabs.data.length"
                :tabs="detailTabs.data"
                :data="doc"
                :doctype="'Email Campaign'"
                @field-change="handleFieldChange"
              />
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
          </template>
          <template v-else>
            <Activities
              ref="activities"
              doctype="Email Campaign"
              :tabs="tabs"
              v-model:reload="reload"
              v-model:tabIndex="tabIndex"
              v-model="emailCampaign"
              :docname="props.emailCampaignId"
              @beforeSave="saveChanges"
              @afterSave="reloadAssignees"
            />
          </template>
        </TabPanel>
      </Tabs>
    </div> -->

    <!-- Error -->
    <ErrorPage
      v-if="errorTitle"
      :errorTitle="errorTitle"
      :errorMessage="errorMessage"
    />

    <!-- Modals -->
    <FilesUploader
      v-if="emailCampaign.data?.name"
      v-model="showFilesUploader"
      doctype="Email Campaign"
      :docname="props.emailCampaignId"
      @after="
        () => {
          changeTabTo('attachments')
        }
      "
    />
    <DeleteLinkedDocModal
      v-if="showDeleteLinkedDocModal"
      v-model="showDeleteLinkedDocModal"
      :doctype="'Email Campaign'"
      :docname="props.emailCampaignId"
      name="Email Campaigns"
    />
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
import Tabs from '@/components/Tabs.vue'
// import TabList from '@/components/TabList.vue'
// import TabPanel from '@/components/TabPanel.vue'
import Activities from '@/components/Activities/Activities.vue'
import { Button, createResource, call, toast, TextEditor } from 'frappe-ui'
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
  emailCampaignId: { type: String, required: true },
})

const errorTitle = ref('')
const errorMessage = ref('')
const showFilesUploader = ref(false)
const showDeleteLinkedDocModal = ref(false)

const { assignees, document } = useDocument('Email Campaign', props.emailCampaignId)

const doc = computed(() => document.doc || {})

const detailTabs = createResource({
  url: 'crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_fields_layout',
  cache: ['Detail', 'Email Campaign'],
  params: { doctype: 'Email Campaign', type: 'Detail' },
  auto: true,
})

const emailCampaign = createResource({
  url: 'frappe.client.get',
  params: { doctype: 'Email Campaign', name: props.emailCampaignId },
  cache: ['emailCampaign', props.emailCampaignId],
  onSuccess: (data) => {
    errorTitle.value = ''
    errorMessage.value = ''
    setupCustomizations(emailCampaign, {
      doc: data,
      router,
      toast,
      updateField,
      deleteDoc: deleteEmailCampaign,
      resource: { emailCampaign, detailTabs },
      call,
    })
  },
  onError: (err) => {
    errorTitle.value = __('Not permitted')
    errorMessage.value = err.messages?.[0] || __('Error loading Email Campaign')
  },
})

onMounted(() => {
  if (!emailCampaign.data) emailCampaign.fetch()
})

const useHtml = computed(() => {
  const v = doc.value?.use_html
  return v === 1 || v === true || v === '1'
})

const breadcrumbs = computed(() => [
  { label: __('Email Campaigns'), route: { name: 'EmailCampaigns' } },
  {
    label: doc.value?.name || props.emailCampaignId,
    route: { name: 'EmailCampaign', params: { emailCampaignId: props.emailCampaignId } },
  },
])

const tabs = computed(() => [
  { name: 'Activity', label: __('Activity'), icon: ActivityIcon },
  { name: 'Emails', label: __('Emails'), icon: EmailIcon },
  { name: 'Comments', label: __('Comments'), icon: CommentIcon },
  { name: 'Data', label: __('Data'), icon: DetailsIcon },
  { name: 'Attachments', label: __('Attachments'), icon: AttachmentIcon },
])

const { tabIndex, changeTabTo } = useActiveTabManager(tabs, 'lastEmailCampaignTab')

function handleFieldChange(fieldname, value) {
  if (fieldname === 'use_html') {
    const normalized = value === 1 || value === true || value === '1'
    updateField('use_html', normalized ? 1 : 0)
    if (normalized && !doc.value.response_html && doc.value.response) {
      updateField('response_html', doc.value.response)
    }
  } else {
    updateField(fieldname, value)
  }
}

function updateField(name, value) {
  if (!doc.value) return
  doc.value[name] = value
}

async function deleteEmailCampaign(name) {
  try {
    await call('frappe.client.delete', { doctype: 'Email Campaign', name })
    router.push({ name: 'EmailCampaigns' })
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Failed to delete'))
  }
}

function saveNow() {
  document.save.submit(null, {
    onSuccess: () => toast.success(__('Saved')),
    onError: (err) => toast.error(err?.messages?.[0] || __('Failed to save')),
  })
}
</script>