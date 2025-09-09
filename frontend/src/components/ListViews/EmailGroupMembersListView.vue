<template>
  <ListView
    :columns="columns"
    :rows="rows"
    :selections="selections"
    :loading="loading"
    :total-count="totalCount"
    :page-size="pageSize"
    :current-page="currentPage"
    :show-selection="showSelection"
    :show-pagination="false"
    :options="{
      getRowRoute: (row) => ({ name: 'EmailGroupMember', params: { memberId: row.name } }),
      selectable: options.selectable,
      showTooltip: options.showTooltip,
      resizeColumn: options.resizeColumn,
    }"
    row-key="name"
    @update:selections="(selections) => emit('selectionsChanged', selections)"
  >
    <AppStyling type="list-header" headerMargin="sm:mx-5 mx-3" @columnWidthUpdated="emit('columnWidthUpdated')">
      <ListHeaderItem
        v-for="column in columns"
        :key="column.key"
        :item="column"
        @columnWidthUpdated="emit('columnWidthUpdated', column)"
      />
    </AppStyling>
    <ListRows
      :rows="rows"
      v-slot="{ column, item, row }"
      doctype="Email Group Member"
    >
      <ListRowItem :item="formatItem(column.key, item)" :align="column.align">
        <template #default="{ label }">
          <div
            v-if="['modified', 'creation'].includes(column.key)"
            class="truncate text-base"
            @click="
              (event) =>
                emit('applyFilter', {
                  event,
                  idx: undefined,
                  column,
                  item,
                  firstColumn: columns[0],
                })
            "
          >
            <Tooltip :text="item && item.label ? item.label : label">
              <div>{{ item && item.timeAgo ? item.timeAgo : label }}</div>
            </Tooltip>
          </div>
          <div v-else class="truncate text-base">
            {{ label }}
          </div>
        </template>
      </ListRowItem>
    </ListRows>
    <ListSelectBanner>
      <template #actions="{ selections, unselectAll }">
        <Dropdown :options="listBulkActionsRef.bulkActions(selections, unselectAll)">
          <Button icon="more-horizontal" variant="ghost" />
        </Dropdown>
      </template>
    </ListSelectBanner>
  </ListView>
  <ListFooter
    v-if="options.rowCount || options.totalCount"
    class="border-t px-3 py-2 sm:px-5"
    v-model="pageLengthCount"
    :options="{ rowCount: options.rowCount, totalCount: options.totalCount }"
    @loadMore="emit('loadMore')"
  />
  <ListBulkActions
    ref="listBulkActionsRef"
    v-model="list"
    doctype="Email Group Member"
    :options="{ hideAssign: true }"
  />
</template>

<script setup>
import ListRows from '@/components/ListViews/ListRows.vue'
import AppStyling from '@/components/AppStyling.vue'
import ListBulkActions from '@/components/ListBulkActions.vue'
import { ListView, ListHeaderItem, ListRowItem, ListFooter, ListSelectBanner, Tooltip, Dropdown, Button } from 'frappe-ui'
import { ref, computed } from 'vue'

const props = defineProps({
  columns: Array,
  rows: Array,
  selections: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  totalCount: { type: Number, default: 0 },
  pageSize: { type: Number, default: 20 },
  currentPage: { type: Number, default: 1 },
  showSelection: { type: Boolean, default: true },
  options: {
    type: Object,
    default: () => ({ selectable: true, showTooltip: true, resizeColumn: false, totalCount: 0, rowCount: 0 }),
  },
})

const emit = defineEmits(['selectionsChanged', 'columnWidthUpdated', 'applyFilter', 'applyLikeFilter', 'loadMore', 'updatePageCount'])

const pageLengthCount = defineModel()
const list = defineModel('list')
const listBulkActionsRef = ref(null)

defineExpose({
  customListActions: computed(() => listBulkActionsRef.value?.customListActions),
})

function formatItem(key, item) {
  if (key === 'unsubscribed') {
    return { label: item ? __('Yes') : __('No') }
  }
  return item
}
</script>


