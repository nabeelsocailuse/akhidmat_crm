<template>
  <TransitionRoot :show="sidebarOpened">
    <Dialog as="div" @close="sidebarOpened = false" class="fixed inset-0 z-40">
      <!-- Sidebar Panel -->
      <TransitionChild
        as="template"
        enter="transition ease-in-out duration-200 transform"
        enter-from="-translate-x-full"
        enter-to="translate-x-0"
        leave="transition ease-in-out duration-200 transform"
        leave-from="translate-x-0"
        leave-to="-translate-x-full"
      >
        <div
          class="relative z-10 flex h-full w-[260px] flex-col justify-between border-r bg-white transition-all duration-300 ease-in-out"
        >
          <!-- User Dropdown -->
          <div>
            <UserDropdown class="p-2" :isCollapsed="!sidebarOpened" />
          </div>

          <!-- Sidebar Content -->
          <div class="flex-1 overflow-y-auto">
            <!-- Notifications -->
            <div class="mb-3 flex flex-col">
              <SidebarLink
                id="notifications-btn"
                :label="__('Notifications')"
                :icon="NotificationsIcon"
                :to="{ name: 'Notifications' }"
                class="relative mx-2 my-0.5"
              >
                <template #right>
                  <Badge
                    v-if="unreadNotificationsCount"
                    :label="unreadNotificationsCount"
                    variant="subtle"
                  />
                </template>
              </SidebarLink>
            </div>

            <!-- All Views / Fundraising / Public / Pinned -->
            <div v-for="view in allViews" :key="view.name">
              <Section
                :label="view.name"
                :hideLabel="view.hideLabel"
                :opened="view.opened"
              >
                <template #header="{ opened, hide, toggle }">
                  <div
                    v-if="!hide"
                    class="ml-2 mt-4 flex h-7 cursor-pointer gap-1.5 px-1 text-base font-medium text-gray-600"
                    @click="toggle()"
                  >
                    <FeatherIcon
                      name="chevron-right"
                      class="h-4 text-gray-500 transition-transform duration-200"
                      :class="{ 'rotate-90': opened }"
                    />
                    <span>{{ __(view.name) }}</span>
                  </div>
                </template>
                <nav class="flex flex-col">
                  <SidebarLink
                    v-for="link in view.views"
                    :key="link.label"
                    :icon="link.icon"
                    :label="__(link.label)"
                    :to="link.to"
                    class="mx-2 my-0.5"
                  />
                </nav>
              </Section>
            </div>
          </div>
        </div>
      </TransitionChild>

      <!-- Overlay -->
      <TransitionChild
        as="template"
        enter="transition-opacity ease-linear duration-200"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="transition-opacity ease-linear duration-200"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <DialogOverlay class="fixed inset-0 bg-gray-600 bg-opacity-50" />
      </TransitionChild>
    </Dialog>
  </TransitionRoot>
</template>

<script setup>
import {
  TransitionRoot,
  TransitionChild,
  Dialog,
  DialogOverlay,
} from '@headlessui/vue'
import { computed, h } from 'vue'
import { mobileSidebarOpened as sidebarOpened } from '@/composables/settings'
import { viewsStore } from '@/stores/views'
import { unreadNotificationsCount } from '@/stores/notifications'

// Components
import Section from '@/components/Section.vue'
import SidebarLink from '@/components/SidebarLink.vue'
import UserDropdown from '@/components/UserDropdown.vue'
// import Badge from '@/components/Badge.vue'

// Icons
import Email2Icon from '@/components/Icons/Email2Icon.vue'
import PinIcon from '@/components/Icons/PinIcon.vue'
import LeadsIcon from '@/components/Icons/LeadsIcon.vue'
import DonorIcon from '@/components/Icons/DonorIcon.vue'
import ContactsIcon from '@/components/Icons/ContactsIcon.vue'
import DonationIcon from '@/components/Icons/DonationIcon.vue'
import EmailIcon from '@/components/Icons/EmailIcon.vue'
import NoteIcon from '@/components/Icons/NoteIcon.vue'
import CampaignIcon from '@/components/Icons/CampaignIcon.vue'
import TaskIcon from '@/components/Icons/TaskIcon.vue'
import PhoneIcon from '@/components/Icons/PhoneIcon.vue'
import NotificationsIcon from '@/components/Icons/NotificationsIcon.vue'

const { getPinnedViews, getPublicViews } = viewsStore()

// Base links
const links = [
  { label: 'Dashboard', icon: CampaignIcon, to: 'Dashboard' },
  { label: 'Leads', icon: LeadsIcon, to: 'Leads' },
  { label: 'Contacts', icon: ContactsIcon, to: 'Contacts' },
  { label: 'Addresses', icon: LeadsIcon, to: 'Addresses' },
  { label: 'Notes', icon: NoteIcon, to: 'Notes' },
  { label: 'Tasks', icon: TaskIcon, to: 'Tasks' },
  { label: 'Call Logs', icon: PhoneIcon, to: 'Call Logs' },
  { label: 'Donor', icon: DonorIcon, to: 'Donor' },
  { label: 'Donation', icon: DonationIcon, to: 'Donations' },
  { label: 'Tax Exemption Certificates', icon: NoteIcon, to: 'TaxExemptionCertificates' },
]

// Fundraising group
const fundraisingCampaign = {
  name: 'Fundraising Campaign',
  opened: false,
  views: [
    { label: 'Campaigns', icon: CampaignIcon, to: 'Campaigns' },
    { label: 'Email Campaign', icon: CampaignIcon, to: 'Email Campaign' },
    { label: 'Email Template', icon: EmailIcon, to: 'EmailTemplates' },
    { label: 'Email Group', icon: EmailIcon, to: 'Email Group' },
    { label: 'Email Group Members', icon: EmailIcon, to: 'Email Group Members' },
    { label: 'Communication', icon: Email2Icon, to: 'Communication' },
  ],
}

// Build sidebar views
const allViews = computed(() => {
  let _views = [
    { name: 'All Views', hideLabel: true, opened: true, views: links },
    fundraisingCampaign,
  ]

  if (getPublicViews().length) {
    _views.push({
      name: 'Public views',
      opened: true,
      views: parseView(getPublicViews()),
    })
  }

  if (getPinnedViews().length) {
    _views.push({
      name: 'Pinned views',
      opened: true,
      views: parseView(getPinnedViews()),
    })
  }

  return _views
})

function parseView(views) {
  return views.map((view) => ({
    label: view.label,
    icon: getIcon(view.route_name, view.icon),
    to: {
      name: view.route_name,
      params: { viewType: view.type || 'list' },
      query: { view: view.name },
    },
  }))
}

function getIcon(routeName, icon) {
  if (icon) return h('div', { class: 'size-auto' }, icon)

  switch (routeName) {
    case 'Leads':
      return LeadsIcon
    case 'Contacts':
      return ContactsIcon
    case 'Notes':
      return NoteIcon
    case 'Call Logs':
      return PhoneIcon
    case 'Campaigns':
    case 'Email Campaign':
      return CampaignIcon
    case 'Donor':
      return DonorIcon
    case 'Email Template':
      return EmailIcon
    case 'Tasks':
      return TaskIcon
    case 'Notifications':
      return NotificationsIcon
    default:
      return PinIcon
  }
}
</script>
