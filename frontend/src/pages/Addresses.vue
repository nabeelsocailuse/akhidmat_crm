<template>
  <AppStyling type="page-background" pageType="addresses">
    <LayoutHeader>
      <template #left-header>
        <ViewBreadcrumbs v-model="viewControls" routeName="Addresses" />
      </template>
      <template #right-header>
        <CustomActions
          v-if="addressesListView?.customListActions"
          :actions="addressesListView.customListActions"
        />
        <AppStyling
          type="button"
          buttonType="create"
          buttonLabel="Create"
          @click="showAddressModal = true"
        >
          <template #prefix><FeatherIcon name="plus" class="h-4" /></template>
        </AppStyling>
      </template>
    </LayoutHeader>
    <ViewControls
      ref="viewControls"
      v-model="addresses"
      v-model:loadMore="loadMore"
      v-model:resizeColumn="triggerResize"
      v-model:updatedPageCount="updatedPageCount"
      doctype="Address"
    />
    <AddressesListView
      ref="addressesListView"
      v-if="addresses.data && rows.length"
      v-model="addresses.data.page_length_count"
      v-model:list="addresses"
      :rows="rows"
      :columns="addresses.data.columns"
      :options="{
        showTooltip: false,
        resizeColumn: true,
        rowCount: addresses.data.row_count,
        totalCount: addresses.data.total_count,
      }"
      @loadMore="() => loadMore++"
      @columnWidthUpdated="() => triggerResize++"
      @updatePageCount="(count) => (updatedPageCount = count)"
      @applyFilter="(data) => viewControls.applyFilter(data)"
      @applyLikeFilter="(data) => viewControls.applyLikeFilter(data)"
      @likeDoc="(data) => viewControls.likeDoc(data)"
      @selectionsChanged="
        (selections) => viewControls.updateSelections(selections)
      "
    />
    <div
      v-else-if="addresses.data"
      class="flex h-full items-center justify-center"
    >
      <div
        class="flex flex-col items-center gap-3 text-xl font-medium text-ink-gray-4"
      >
        <MapPinIcon class="h-10 w-10" />
        <span>{{ __('No {0} Found', [__('Addresses')]) }}</span>
        <Button :label="__('Create')" @click="showAddressModal = true">
          <template #prefix><FeatherIcon name="plus" class="h-4" /></template>
        </Button>
      </div>
    </div>
    <AddressModal
      v-if="showAddressModal"
      v-model="showAddressModal"
      :address="{}"
    />
  </AppStyling>
</template>

<script setup>
import ViewBreadcrumbs from '@/components/ViewBreadcrumbs.vue'
import CustomActions from '@/components/CustomActions.vue'
import MapPinIcon from '@/components/Icons/MapPinIcon.vue'
import LayoutHeader from '@/components/LayoutHeader.vue'
import AddressModal from '@/components/Modals/AddressModal.vue'
import AddressesListView from '@/components/ListViews/AddressesListView.vue'
import ViewControls from '@/components/ViewControls.vue'
import { getMeta } from '@/stores/meta'
import { organizationsStore } from '@/stores/organizations.js'
import { formatDate, timeAgo } from '@/utils'
import { ref, computed } from 'vue'
import { Button, FeatherIcon } from 'frappe-ui'
import AppStyling from '@/components/AppStyling.vue'

const { getFormattedPercent, getFormattedFloat, getFormattedCurrency } =
  getMeta('Address')
const { getOrganization } = organizationsStore()

const showAddressModal = ref(false)

const addressesListView = ref(null)

// addresses data is loaded in the ViewControls component
const addresses = ref({})
const loadMore = ref(1)
const triggerResize = ref(1)
const updatedPageCount = ref(20)
const viewControls = ref(null)

const rows = computed(() => {
  if (
    !addresses.value?.data?.data ||
    !['list', 'group_by'].includes(addresses.value.data.view_type)
  )
    return []
  return addresses.value?.data.data.map((address) => {
    let _rows = {}
    addresses.value?.data.rows.forEach((row) => {
      _rows[row] = address[row]

      let fieldType = addresses.value?.data.columns?.find(
        (col) => (col.key || col.value) == row,
      )?.type

      if (
        fieldType &&
        ['Date', 'Datetime'].includes(fieldType) &&
        !['modified', 'creation'].includes(row)
      ) {
        _rows[row] = formatDate(address[row], '', true, fieldType == 'Datetime')
      }

      if (fieldType && fieldType == 'Currency') {
        _rows[row] = getFormattedCurrency(row, address)
      }

      if (fieldType && fieldType == 'Float') {
        _rows[row] = getFormattedFloat(row, address)
      }

      if (fieldType && fieldType == 'Percent') {
        _rows[row] = getFormattedPercent(row, address)
      }

      if (row == 'address_title') {
        _rows[row] = {
          label: address.address_title,
          image_label: address.address_title,
          image: address.image,
        }
      } else if (row == 'city') {
        _rows[row] = {
          label: address.city,
        }
      } else if (row == 'country') {
        _rows[row] = {
          label: address.country,
        }
      } else if (['modified', 'creation'].includes(row)) {
        _rows[row] = {
          label: formatDate(address[row]),
          timeAgo: __(timeAgo(address[row])),
        }
      }
    })
    return _rows
  })
})
</script> 