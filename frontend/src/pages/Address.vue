<template>
  <AppStyling type="detail-background">
    <LayoutHeader v-if="address.doc">
      <template #left-header>
        <Breadcrumbs :items="breadcrumbs">
          <template #prefix="{ item }">
            <Icon v-if="item.icon" :icon="item.icon" class="mr-2 h-4" />
          </template>
        </Breadcrumbs>
      </template>
    </LayoutHeader>
    
    <div v-if="address.doc" ref="parentRef" class="flex h-full bg-gradient-to-br from-[#fef7ff] to-[#f8faff]">
      <Resizer
        v-if="address.doc"
        :parent="$refs.parentRef"
        class="flex h-full flex-col overflow-hidden border-r"
      >
      <div class="border-b">
        <div class="flex flex-col items-start justify-start gap-4 p-5">
          <div class="flex gap-4 items-center">
            <div class="group relative h-15.5 w-15.5">
              <Avatar
                size="3xl"
                class="h-15.5 w-15.5"
                :label="address.doc.address_title"
                :image="address.doc.image"
              />
            </div>
            <div class="flex flex-col gap-2 truncate text-ink-gray-9">
              <div class="truncate text-2xl font-medium">
                {{ address.doc.address_title }}
              </div>
              <div
                v-if="address.doc.address_type"
                class="flex items-center gap-1.5 text-base text-ink-gray-8"
              >
                <span class="">{{ address.doc.address_type }} Address</span>
              </div>
            </div>
          </div>
          <div class="flex gap-1.5">
            <Button
              :label="__('Delete')"
              theme="red"
              size="sm"
              icon-left="trash-2"
              @click="deleteAddress()"
            />
          </div>
        </div>
      </div>
      <div
        v-if="sections.data"
        class="flex flex-1 flex-col justify-between overflow-hidden"
      >
        <div class="flex-1 overflow-auto p-5">
          <div class="space-y-6">
            <!-- Address Details Section -->
            <div class="space-y-4">
              <h3 class="text-lg font-medium text-ink-gray-9">{{ __('Address Details') }}</h3>
              <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div v-if="address.doc?.address_line1" class="space-y-2">
                  <label class="text-sm font-medium text-ink-gray-7">{{ __('Address Line 1') }}</label>
                  <div class="text-sm text-ink-gray-9">{{ address.doc.address_line1 }}</div>
                </div>
                <div v-if="address.doc?.address_line2" class="space-y-2">
                  <label class="text-sm font-medium text-ink-gray-7">{{ __('Address Line 2') }}</label>
                  <div class="text-sm text-ink-gray-9">{{ address.doc.address_line2 }}</div>
                </div>
                <div v-if="address.doc?.city" class="space-y-2">
                  <label class="text-sm font-medium text-ink-gray-7">{{ __('City') }}</label>
                  <div class="text-sm text-ink-gray-9">{{ address.doc.city }}</div>
                </div>
                <div v-if="address.doc?.state" class="space-y-2">
                  <label class="text-sm font-medium text-ink-gray-7">{{ __('State') }}</label>
                  <div class="text-sm text-ink-gray-9">{{ address.doc.state }}</div>
                </div>
                <div v-if="address.doc?.country" class="space-y-2">
                  <label class="text-sm font-medium text-ink-gray-7">{{ __('Country') }}</label>
                  <div class="text-sm text-ink-gray-9">{{ address.doc.country }}</div>
                </div>
                <div v-if="address.doc?.pincode" class="space-y-2">
                  <label class="text-sm font-medium text-ink-gray-7">{{ __('Pincode') }}</label>
                  <div class="text-sm text-ink-gray-9">{{ address.doc.pincode }}</div>
                </div>
                <div v-if="address.doc?.is_primary_address" class="space-y-2">
                  <label class="text-sm font-medium text-ink-gray-7">{{ __('Primary Billing Address') }}</label>
                  <div class="text-sm text-ink-gray-9">{{ address.doc.is_primary_address ? __('Yes') : __('No') }}</div>
                </div>
                <div v-if="address.doc?.is_shipping_address" class="space-y-2">
                  <label class="text-sm font-medium text-ink-gray-7">{{ __('Primary Shipping Address') }}</label>
                  <div class="text-sm text-ink-gray-9">{{ address.doc.is_shipping_address ? __('Yes') : __('No') }}</div>
                </div>
              </div>
            </div>

            <!-- Contact Information Section -->
            <div v-if="address.doc?.email_id || address.doc?.phone || address.doc?.fax" class="space-y-4">
              <h3 class="text-lg font-medium text-ink-gray-9">{{ __('Contact Information') }}</h3>
              <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div v-if="address.doc?.email_id" class="space-y-2">
                  <label class="text-sm font-medium text-ink-gray-7">{{ __('Email') }}</label>
                  <div class="text-sm text-ink-gray-9">{{ address.doc.email_id }}</div>
                </div>
                <div v-if="address.doc?.phone" class="space-y-2">
                  <label class="text-sm font-medium text-ink-gray-7">{{ __('Phone') }}</label>
                  <div class="text-sm text-ink-gray-9">{{ address.doc.phone }}</div>
                </div>
                <div v-if="address.doc?.fax" class="space-y-2">
                  <label class="text-sm font-medium text-ink-gray-7">{{ __('Fax') }}</label>
                  <div class="text-sm text-ink-gray-9">{{ address.doc.fax }}</div>
                </div>
              </div>
            </div>


          </div>
        </div>
      </div>
    </Resizer>
    </div>
  </AppStyling>
  <ErrorPage
    v-if="errorTitle"
    :errorTitle="errorTitle"
    :errorMessage="errorMessage"
  />
</template>

<script setup>
import ErrorPage from '@/components/ErrorPage.vue'
import Resizer from '@/components/Resizer.vue'
import Icon from '@/components/Icon.vue'
import SidePanelLayout from '@/components/SidePanelLayout.vue'
import LayoutHeader from '@/components/LayoutHeader.vue'

import AppStyling from '@/components/AppStyling.vue'
import { formatDate, timeAgo } from '@/utils'
import { getView } from '@/utils/view'
import { useDocument } from '@/data/document'
import { getSettings } from '@/stores/settings'
import { getMeta } from '@/stores/meta'
import { globalStore } from '@/stores/global.js'
import { usersStore } from '@/stores/users.js'
import { organizationsStore } from '@/stores/organizations.js'
import { statusesStore } from '@/stores/statuses'
import {
  Breadcrumbs,
  Avatar,
  Tabs,
  call,
  createResource,
  usePageMeta,
  toast,

} from 'frappe-ui'
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const { brand } = getSettings()
const { $dialog } = globalStore()

const { getUser } = usersStore()
const { getOrganization } = organizationsStore()
const { getDealStatus } = statusesStore()
const { doctypeMeta } = getMeta('Address')

const props = defineProps({
  addressId: {
    type: String,
    required: true,
  },
})

const route = useRoute()
const router = useRouter()

const errorTitle = ref('')
const errorMessage = ref('')

const { document: address } = useDocument('Address', props.addressId)

const breadcrumbs = computed(() => {
  let items = [{ label: __('Addresses'), route: { name: 'Addresses' } }]

  if (route.query.view || route.query.viewType) {
    let view = getView(route.query.view, route.query.viewType, 'Address')
    if (view) {
      items.push({
        label: __(view.label),
        icon: view.icon,
        route: {
          name: 'Addresses',
          params: { viewType: route.query.viewType },
          query: { view: route.query.view },
        },
      })
    }
  }

  items.push({
    label: title.value,
    route: { name: 'Address', params: { addressId: props.addressId } },
  })
  return items
})

const title = computed(() => {
  let t = doctypeMeta['Address']?.title_field || 'address_title'
  return address.doc?.[t] || props.addressId
})

usePageMeta(() => {
  return {
    title: title.value,
    icon: brand.favicon,
  }
})

async function deleteAddress() {
  $dialog({
    title: __('Delete address'),
    message: __('Are you sure you want to delete this address?'),
    actions: [
      {
        label: __('Delete'),
        theme: 'red',
        variant: 'solid',
        async onClick(close) {
          await call('frappe.client.delete', {
            doctype: 'Address',
            name: props.addressId,
          })
          close()
          router.push({ name: 'Addresses' })
        },
      },
    ],
  })
}



const sections = createResource({
  url: 'crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_sidepanel_sections',
  cache: ['sidePanelSections', 'Address'],
  params: { doctype: 'Address' },
  auto: true,
  transform: (data) => computed(() => getParsedSections(data)),
})

function getParsedSections(_sections) {
  return _sections.map((section) => {
    section.columns = section.columns.map((column) => {
      column.fields = column.fields.map((field) => {
        return field
      })
      return column
    })
    return section
  })
}
</script> 