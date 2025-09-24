<template>
  <LayoutHeader>
    <header
      class="relative flex h-10.5 items-center justify-between gap-2 py-2.5 pl-2"
    >
      <Breadcrumbs :items="breadcrumbs" />
      <div class="absolute right-0">
        <Dropdown v-if="donorDocument.doc" :options="donorStatusOptions">
          <template #default="{ open }">
            <Button :label="donorDocument.doc.status || 'Active'">
              <template #prefix>
                <IndicatorIcon :class="getDonorStatus(donorDocument.doc.status).color" />
              </template>
              <template #suffix>
                <FeatherIcon :name="open ? 'chevron-up' : 'chevron-down'" class="h-4" />
              </template>
            </Button>
          </template>
        </Dropdown>
      </div>
    </header>
  </LayoutHeader>

  <div
    v-if="donor.data?.name"
    class="flex h-12 items-center justify-between gap-2 border-b px-3 py-2.5"
  >
    <AssignTo v-model="assignees.data" doctype="Donor" :docname="donorId" />
    <div class="flex items-center gap-2">
      <CustomActions v-if="donor.data.actions?.length" :actions="donor.data.actions" />
    </div>
  </div>

  <div v-if="donor.data?.name" class="flex h-full overflow-hidden">
    <Tabs as="div" v-model="tabIndex" :tabs="tabs" class="overflow-auto">
      <TabList class="!px-3" />
      <TabPanel v-slot="{ tab }">
        <div v-if="tab.name == 'Details'">
          <SLASection
            v-if="donorDocument.doc?.sla_status"
            v-model="donorDocument.doc"
            @updateField="updateField"
          />
          <div
            v-if="sections.data"
            class="flex flex-1 flex-col justify-between overflow-hidden"
          >
            <SidePanelLayout
              :sections="sections.data"
              doctype="Donor"
              :docname="donorId"
              @reload="sections.reload"
              @afterFieldChange="reloadAssignees"
            />
          </div>
        </div>
        <Activities
          v-else
          doctype="Donor"
          :docname="donorId"
          :tabs="tabs"
          v-model:reload="reload"
          v-model:tabIndex="tabIndex"
          @beforeSave="saveChanges"
          @afterSave="reloadAssignees"
        />
      </TabPanel>
    </Tabs>
  </div>

  <ErrorPage v-else :errorTitle="errorTitle" :errorMessage="errorMessage" />
</template>
  
<script setup>
import ErrorPage from '@/components/ErrorPage.vue'
import LayoutHeader from '@/components/LayoutHeader.vue'
import Activities from '@/components/Activities/Activities.vue'
import AssignTo from '@/components/AssignTo.vue'
import SidePanelLayout from '@/components/SidePanelLayout.vue'
import SLASection from '@/components/SLASection.vue'
import CustomActions from '@/components/CustomActions.vue'
import Breadcrumbs from '@/components/Breadcrumbs.vue'
import IndicatorIcon from '@/components/Icons/IndicatorIcon.vue'
import ActivityIcon from '@/components/Icons/ActivityIcon.vue'
import EmailIcon from '@/components/Icons/EmailIcon.vue'
import CommentIcon from '@/components/Icons/CommentIcon.vue'
import DetailsIcon from '@/components/Icons/DetailsIcon.vue'
import PhoneIcon from '@/components/Icons/PhoneIcon.vue'
import TaskIcon from '@/components/Icons/TaskIcon.vue'
import NoteIcon from '@/components/Icons/NoteIcon.vue'
import AttachmentIcon from '@/components/Icons/AttachmentIcon.vue'
import WhatsAppIcon from '@/components/Icons/WhatsAppIcon.vue'
import { useDocument } from '@/data/document'
import { useActiveTabManager } from '@/composables/useActiveTabManager'
import { getMeta } from '@/stores/meta'
import { getSettings } from '@/stores/settings'
import { whatsappEnabled, callEnabled } from '@/composables/settings'
import {
  Tabs,
  TabList,
  TabPanel,
  Dropdown,
  call,
  usePageMeta,
  toast,
  Button,
  FeatherIcon,
  createResource,
} from 'frappe-ui'
import { ref, computed, watch, nextTick, h } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const route = useRoute()
const router = useRouter()

const props = defineProps({ donorId: { type: String, required: true } })

const { brand } = getSettings()
const { doctypeMeta } = getMeta('Donor')

const errorTitle = ref('')
const errorMessage = ref('')
const reload = ref(false)

const donor = createResource({
  url: 'crm.fcrm.doctype.donor.api.get_donor',
  params: { name: props.donorId },
  cache: ['donor', props.donorId],
  auto: true,
  onError: (err) => {
    errorTitle.value = __('Not permitted')
    errorMessage.value = __(err.messages?.[0] || 'Error loading donor')
  },
})

const { document: donorDocument, assignees } = useDocument('Donor', props.donorId)

const title = computed(() => {
  let t = doctypeMeta['Donor']?.title_field || 'name'
  return donor.data?.[t] || props.donorId
})

usePageMeta(() => ({ title: title.value, icon: brand.favicon }))

const breadcrumbs = computed(() => [
  { label: __('Donor'), route: { name: 'Donor' } },
  { label: title.value, route: { name: 'MobileDonorDetail', params: { donorId: props.donorId } } },
])

const tabs = computed(() => {
  const tabOptions = [
    { name: 'Details', label: __('Details'), icon: DetailsIcon },
    { name: 'Activity', label: __('Activity'), icon: ActivityIcon },
    { name: 'Emails', label: __('Emails'), icon: EmailIcon },
    { name: 'Comments', label: __('Comments'), icon: CommentIcon },
    { name: 'Data', label: __('Data'), icon: DetailsIcon },
    { name: 'Calls', label: __('Calls'), icon: PhoneIcon, condition: () => callEnabled.value },
    { name: 'Tasks', label: __('Tasks'), icon: TaskIcon },
    { name: 'Notes', label: __('Notes'), icon: NoteIcon },
    { name: 'Attachments', label: __('Attachments'), icon: AttachmentIcon },
    { name: 'WhatsApp', label: __('WhatsApp'), icon: WhatsAppIcon, condition: () => whatsappEnabled.value },
  ]
  return tabOptions.filter((tab) => (tab.condition ? tab.condition() : true))
})

const { tabIndex, changeTabTo } = useActiveTabManager(tabs, 'lastDonorTab')

const sections = createResource({
  url: 'crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_sidepanel_sections',
  cache: ['sidePanelSections', 'Donor'],
  params: { doctype: 'Donor' },
  auto: true,
})

function updateField(name, value) {
  value = Array.isArray(name) ? '' : value
  let oldValues = Array.isArray(name) ? {} : donorDocument.doc?.[name]

  if (!donorDocument.doc) return

  if (Array.isArray(name)) {
    name.forEach((field) => (donorDocument.doc[field] = value))
  } else {
    donorDocument.doc[name] = value
  }

  donorDocument.save.submit(null, {
    onSuccess: () => (reload.value = true),
    onError: (err) => {
      if (Array.isArray(name)) {
        name.forEach((field) => (donorDocument.doc[field] = oldValues[field]))
      } else {
        donorDocument.doc[name] = oldValues
      }
      toast.error(err.messages?.[0] || __('Error updating field'))
    },
  })
}

function reloadAssignees(data) {
  if (data?.hasOwnProperty('donor_owner')) {
    assignees.reload()
  }
}

function saveChanges(data) {
  donorDocument.save.submit(null, {
    onSuccess: () => reloadAssignees(data),
  })
}

const donorStatusOptions = computed(() => [
  {
    label: __('Active'),
    value: 'Active',
    icon: () => h(IndicatorIcon, { class: 'text-green-500' }),
    onClick: () => updateDonorStatus('Active'),
  },
  {
    label: __('Blocked'),
    value: 'Blocked',
    icon: () => h(IndicatorIcon, { class: 'text-red-500' }),
    onClick: () => updateDonorStatus('Blocked'),
  },
])

function getDonorStatus(status) {
  if (!status || status === 'Active') return { name: 'Active', color: 'text-green-500' }
  return { name: status, color: 'text-red-500' }
}

async function updateDonorStatus(newStatus) {
  if (!donor.data || !newStatus) return
  try {
    const result = await call('crm.fcrm.doctype.donor.api.update_donor_status', {
      name: donor.data.name,
      status: newStatus,
    })
    if (result.success) {
      if (donor.data) donor.data.status = newStatus
      if (donorDocument.doc) donorDocument.doc.status = newStatus
      toast.success(__('Status updated successfully'))
    } else {
      toast.error(result.message || __('Failed to update status'))
    }
  } catch (error) {
    toast.error(__('Failed to update status'))
  }
}
</script>
  