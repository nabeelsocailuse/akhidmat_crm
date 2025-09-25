<template>
    <div class="min-h-screen bg-gradient-to-b from-[#fef7ff] to-[#F5F9FF]">
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
    </div>
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
import { useDonorFieldValidation } from '@/composables/useDonorFieldValidation'

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

const {
  showCnicExistsDialog,
  cnicExistsMessage,
  showCnicValidationDialog,
  cnicValidationMessage,
  validateCnicFormat,
  validatePhoneNumber
} = useDonorFieldValidation();

async function validateBeforeSave() {
  const errors = [];

  if (donorDocument.doc?.identification_type && donorDocument.doc?.identification_type !== 'Others') {
    if (!donorDocument.doc?.cnic || donorDocument.doc.cnic.trim() === '') {
      errors.push('CNIC is required when identification type is set');
    } else if (!validateCnicFormat(donorDocument.doc.cnic, donorDocument.doc.identification_type)) {
      errors.push(`Invalid ${donorDocument.doc.identification_type} format. Please enter a valid ${donorDocument.doc.identification_type} number.`);
    }
  }

  // Phone Number Validation
  if (donorDocument.doc?.country) {
    const phoneFields = ['contact_no', 'mobile_no'];
    for (const field of phoneFields) {
      const value = donorDocument.doc[field];
      if (value && value.trim() !== '') {
        const validation = await validatePhoneNumber(value, donorDocument.doc.country);
        if (!validation.isValid) {
          errors.push(`${field}: ${validation.message}`);
        }
      }
    }
  }

  // Email Validation
  const emailFields = ['email'];
  for (const field of emailFields) {
    const value = donorDocument.doc[field];
    if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      errors.push(`${field}: Invalid email format.`);
    }
  }

  // Required Fields
  const requiredFields = ['donor_name', 'email'];
  for (const field of requiredFields) {
    if (!donorDocument.doc[field] || donorDocument.doc[field].trim() === '') {
      errors.push(`${field} is a required field.`);
    }
  }

  // FOA-Specific Validation
  if (donorDocument.doc?.foa) {
    const foaFields = [
      { field: 'co_name', label: 'C/O Name' },
      { field: 'co_designation', label: 'C/O Designation' },
      { field: 'co_contact_no', label: 'C/O Contact No' },
      { field: 'co_email', label: 'C/O Email' },
      { field: 'co_address', label: 'C/O Address' },
      { field: 'relationship_with_donor', label: 'Relationship With Donor' },
      { field: 'area', label: 'Area' },
      { field: 'co_city', label: 'C/O City' },
      { field: 'co_country', label: 'C/O Country' },
    ];

    for (const { field, label } of foaFields) {
      if (!donorDocument.doc[field] || donorDocument.doc[field].trim() === '') {
        errors.push(`${label} is required when FOA is enabled.`);
      }
    }
  }

  // Organization-Specific Validation
  if (donorDocument.doc?.donor_type === 'Organization') {
    const orgFields = [
      { field: 'org_contact', label: 'Organization Contact' },
      { field: 'org_representative_contact_number', label: 'Organization Representative Contact Number' },
    ];

    for (const { field, label } of orgFields) {
      const value = donorDocument.doc[field];
      if (value && value.trim() !== '' && donorDocument.doc?.org_country) {
        const validation = await validatePhoneNumber(value, donorDocument.doc.org_country);
        if (!validation.isValid) {
          errors.push(`${label}: ${validation.message}`);
        }
      } else if (!value || value.trim() === '') {
        errors.push(`${label} is required when Donor Type is Organization.`);
      }
    }

    // Email Validation for Organization Representative
    const emailField = 'org_representative_email_address';
    const emailValue = donorDocument.doc[emailField];
    if (emailValue && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
      errors.push(`${emailField}: Invalid email format.`);
    } else if (!emailValue || emailValue.trim() === '') {
      errors.push('Organization Representative Email Address is required when Donor Type is Organization.');
    }
  }

  if (errors.length > 0) {
    toast.error(errors.join('\n'));
    return false;
  }

  return true;
}

function updateField(name, value) {
  validateBeforeSave().then((isValid) => {
    if (isValid) {
      donorDocument.doc[name] = value;
      donorDocument.save.submit(null, {
        onSuccess: () => (reload.value = true),
        onError: (err) => {
          toast.error(err.messages?.[0] || __('Error updating field'))
        },
      })
    }
  })
}

function reloadAssignees(data) {
  if (data?.hasOwnProperty('donor_owner')) {
    assignees.reload()
  }
}

function saveChanges(data) {
  validateBeforeSave().then((isValid) => {
    if (isValid) {
      donorDocument.save.submit(null, {
        onSuccess: () => reloadAssignees(data),
      })
    }
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
