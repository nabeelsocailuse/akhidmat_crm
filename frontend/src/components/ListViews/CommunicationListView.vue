<template>
  <ListView
    :columns="columns"
    :rows="rows"
    :show-pagination="false"
    :options="{
      getRowRoute: (row) => {
        try {
          if (row && row.nameForRouting) {
            return {
              name: 'CommunicationDetail',
              params: { communicationId: row.nameForRouting },
            }
          }
          console.warn('Missing real Communication name for routing. Staying on list.')
          return { name: 'Communication' }
        } catch (error) {
          console.error('Error in getRowRoute:', error)
          return { name: 'Communication' }
        }
      },
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
      >
        <Button
          v-if="column.key == '_liked_by'"
          variant="ghosted"
          class="!h-4"
          :class="isLikeFilterApplied ? 'fill-red-500' : 'fill-white'"
          @click="() => emit('applyLikeFilter')"
        >
          <HeartIcon class="h-4 w-4" />
        </Button>
      </ListHeaderItem>
    </AppStyling>
    <ListRows
      :rows="rows"
      v-slot="{ idx, column, item, row }"
      doctype="Communication"
    >
      <div v-if="column.key === '_assign'" class="flex items-center">
        <div class="flex -space-x-1">
          <Avatar
            v-for="assignee in item || []"
            :key="assignee?.name || Math.random()"
            :image="assignee?.image"
            :label="assignee?.label"
            size="sm"
            class="ring-2 ring-white"
          />
        </div>
      </div>
      <ListRowItem v-else :item="item" :align="column?.align">
        <template #prefix>
          <div v-if="column.key === 'status'">
            <IndicatorIcon :class="item.color" />
          </div>
          <div v-else-if="column.key === 'sender'">
            <Avatar
              v-if="item && item.label"
              class="flex items-center"
              :image="item.image"
              :label="item.label"
              size="sm"
            />
          </div>
        </template>
        <template #default="{ label }">
          <div
            v-if="['modified','creation'].includes(column.key)"
            class="truncate text-base"
            @click="
              (event) =>
                emit('applyFilter', {
                  event,
                  idx,
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
    :options="{
      rowCount: options.rowCount,
      totalCount: options.totalCount,
    }"
    @loadMore="emit('loadMore')"
  />
  <ListBulkActions
    ref="listBulkActionsRef"
    v-model="list"
    doctype="Communication"
    :options="{ hideAssign: true }"
  />
</template>

<script setup>
import { ref, computed } from 'vue'
import { ListView, ListHeaderItem, ListRowItem, ListFooter, ListSelectBanner, Dropdown, Avatar, Button } from 'frappe-ui'
import ListRows from '@/components/ListViews/ListRows.vue'
import ListBulkActions from '@/components/ListBulkActions.vue'
import HeartIcon from '@/components/Icons/HeartIcon.vue'
import IndicatorIcon from '@/components/Icons/IndicatorIcon.vue'
import AppStyling from '@/components/AppStyling.vue'

const props = defineProps({
  columns: {
    type: Array,
    required: true,
  },
  rows: {
    type: Array,
    required: true,
  },
  options: {
    type: Object,
    default: () => ({
      selectable: true,
      showTooltip: true,
      resizeColumn: false,
      totalCount: 0,
      rowCount: 0,
    }),
  },
  isLikeFilterApplied: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits([
  'selectionsChanged',
  'columnWidthUpdated',
  'applyFilter',
  'applyLikeFilter',
  'likeDoc',
  'loadMore',
])

const pageLengthCount = defineModel()
const list = defineModel('list')
const listBulkActionsRef = ref(null)

defineExpose({
  customListActions: computed(() => listBulkActionsRef.value?.customListActions),
})
</script>
