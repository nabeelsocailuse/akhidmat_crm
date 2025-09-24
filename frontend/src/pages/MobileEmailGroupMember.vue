<template>
    <LayoutHeader>
      <header class="relative flex h-10.5 items-center justify-between gap-2 py-2.5 pl-2">
        <Breadcrumbs :items="breadcrumbs" />
      </header>
    </LayoutHeader>
  
    <div v-if="member.data?.name" class="flex h-12 items-center justify-between gap-2 border-b px-3 py-2.5">
      <AssignTo v-model="assignees.data" doctype="Email Group Member" :docname="props.memberId" />
      <div class="flex items-center gap-2">
        <CustomActions v-if="member.data._customActions?.length" :actions="member.data._customActions" />
        <CustomActions v-if="document.actions?.length" :actions="document.actions" />
      </div>
    </div>
  
    <div v-if="member?.data" class="flex h-full overflow-hidden">
      <Tabs as="div" v-model="tabIndex" :tabs="tabs" class="overflow-auto">
        <TabList class="!px-3" />
        <TabPanel v-slot="{ tab }">
          <!-- Details Tab -->
          <div v-if="tab.name == 'Details'">
            <div v-if="sections.data && sections.data.length" class="flex flex-1 flex-col justify-between overflow-hidden">
              <SidePanelLayout
                :sections="sections.data"
                doctype="Email Group Member"
                :docname="member.data.name"
                @reload="sections.reload"
                @afterFieldChange="reloadAssignees"
              />
            </div>
          </div>
  
          <!-- Activities Tab -->
          <Activities
            v-else
            ref="activities"
            doctype="Email Group Member"
            :tabs="tabs"
            v-model:reload="reload"
            v-model:tabIndex="tabIndex"
            v-model="member"
            :docname="props.memberId"
            @beforeSave="saveChanges"
            @afterSave="reloadAssignees"
          />
        </TabPanel>
      </Tabs>
    </div>
  
    <ErrorPage v-else :errorTitle="errorTitle" :errorMessage="errorMessage" />
  
    <FilesUploader
      v-if="member.data?.name"
      v-model="showFilesUploader"
      doctype="Email Group Member"
      :docname="props.memberId"
      @after="
        () => {
          activities?.all_activities?.reload()
          changeTabTo('attachments')
        }
      "
    />
  </template>
  
  <script setup>
  import ErrorPage from '@/components/ErrorPage.vue'
  import LayoutHeader from '@/components/LayoutHeader.vue'
  import Activities from '@/components/Activities/Activities.vue'
  import AssignTo from '@/components/AssignTo.vue'
  import SidePanelLayout from '@/components/SidePanelLayout.vue'
  import CustomActions from '@/components/CustomActions.vue'
  import Breadcrumbs from '@/components/Breadcrumbs.vue'
  import { useDocument } from '@/data/document'
  import { getSettings } from '@/stores/settings'
  import { getMeta } from '@/stores/meta'
  import { useActiveTabManager } from '@/composables/useActiveTabManager'
  import {
    createResource,
    Tabs,
    TabList,
    TabPanel,
    usePageMeta,
  } from 'frappe-ui'
  import ActivityIcon from '@/components/Icons/ActivityIcon.vue'
  import DetailsIcon from '@/components/Icons/DetailsIcon.vue'
  import EmailIcon from '@/components/Icons/EmailIcon.vue'
  import CommentIcon from '@/components/Icons/CommentIcon.vue'
  import WhatsAppIcon from '@/components/Icons/WhatsAppIcon.vue'
  import NoteIcon from '@/components/Icons/NoteIcon.vue'
  import PhoneIcon from '@/components/Icons/PhoneIcon.vue'
  import TaskIcon from '@/components/Icons/TaskIcon.vue'
  import { whatsappEnabled } from '@/composables/settings'
  import AttachmentIcon from '@/components/Icons/AttachmentIcon.vue'
  import FilesUploader from '@/components/FilesUploader/FilesUploader.vue'
  import { getView } from '@/utils/view'
  import { ref, computed, onMounted } from 'vue'
  import { useRouter, useRoute } from 'vue-router'
  
  const { brand } = getSettings()
  const { doctypeMeta } = getMeta('Email Group Member')
  
  const props = defineProps({ memberId: { type: String, required: true } })
  
  const router = useRouter()
  const route = useRoute()
  
  const errorTitle = ref('')
  const errorMessage = ref('')
  const reload = ref(false)
  const showFilesUploader = ref(false)
  
  const { document, assignees } = useDocument('Email Group Member', props.memberId)
  
  const member = createResource({
    url: 'frappe.client.get',
    params: { doctype: 'Email Group Member', name: props.memberId },
    cache: ['email_group_member', props.memberId],
    auto: true,
    onError: (err) => {
      errorTitle.value = __('Not permitted')
      errorMessage.value = __(err.messages?.[0] || 'Error loading Email Group Member')
    },
  })
  
  onMounted(() => {
    if (!member.data) member.fetch()
  })
  
  const title = computed(() => member.data?.full_name || member.data?.name || props.memberId)
  
  usePageMeta(() => ({ title: title.value, icon: brand.favicon }))
  
  const breadcrumbs = computed(() => {
    let items = [{ label: __('Email Group Members'), route: { name: 'Email Group Members' } }]
    if (route.query.view || route.query.viewType) {
      let view = getView(route.query.view, route.query.viewType, 'Email Group Member')
      if (view) {
        items.push({
          label: __(view.label),
          icon: view.icon,
          route: {
            name: 'Email Group Members',
            params: { viewType: route.query.viewType },
            query: { view: route.query.view },
          },
        })
      }
    }
    items.push({ label: title.value, route: { name: 'MobileEmailGroupMember', params: { memberId: props.memberId } } })
    return items
  })
  
  const tabs = computed(() => {
    let tabOptions = [
    {
      name: 'Activity',
      label: __('Activity'),
      icon: ActivityIcon,
    },
    {
      name: 'Emails',
      label: __('Emails'),
      icon: EmailIcon,
    },
    {
      name: 'Comments',
      label: __('Comments'),
      icon: CommentIcon,
    },
    {
      name: 'Data',
      label: __('Data'),
      icon: DetailsIcon,
    },
    {
      name: 'Calls',
      label: __('Calls'),
      icon: PhoneIcon,
    },
    {
      name: 'Tasks',
      label: __('Tasks'),
      icon: TaskIcon,
    },
    {
      name: 'Notes',
      label: __('Notes'),
      icon: NoteIcon,
    },
    {
      name: 'Attachments',
      label: __('Attachments'),
      icon: AttachmentIcon,
    },
    {
      name: 'WhatsApp',
      label: __('WhatsApp'),
      icon: WhatsAppIcon,
      condition: () => whatsappEnabled.value,
    },
  ]
  return tabOptions.filter((tab) => (tab.condition ? tab.condition() : true))
})
  
  const { tabIndex, changeTabTo } = useActiveTabManager(tabs, 'lastEmailGroupMemberTab')
  
  const sections = createResource({
    url: 'crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_sidepanel_sections',
    cache: ['sidePanelSections', 'Email Group Member'],
    params: { doctype: 'Email Group Member' },
    auto: true,
  })
  
  const activities = ref(null)
  
  function saveChanges(data) {
    document.save.submit(null, { onSuccess: () => reloadAssignees(data) })
  }
  
  function reloadAssignees() {
    assignees.reload?.()
  }
  </script>
  