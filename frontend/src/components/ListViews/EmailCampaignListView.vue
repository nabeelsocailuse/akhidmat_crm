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
      getRowRoute: (row) => {
        try {
          return {
            name: 'EmailCampaignDetail',
            params: { emailCampaignId: row.name }
          }
        } catch (error) {
          console.error('Error in getRowRoute:', error)
          return { name: 'EmailCampaign' }
        }
      },
      selectable: options.selectable,
      showTooltip: options.showTooltip,
      resizeColumn: options.resizeColumn,
      // Pass rowCount and totalCount for ListFooter
      rowCount: options.rowCount,
      totalCount: options.totalCount,
    }"
    :row-class="(row) => {
      return row.status === 'Completed' ? 'bg-green-50' : 'bg-gray-50'
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
      doctype="Email Campaign"
    >
      <div v-if="column.key === '_assign'" class="flex items-center">
        <MultipleAvatar
          :avatars="item"
          size="sm"
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
        />
      </div>
      <ListRowItem v-else :item="item" :align="column.align">
        <template #prefix>
          <div v-if="column.key === 'status'">
            <IndicatorIcon :class="item.color" />
          </div>
          <div v-else-if="column.key === 'campaign_name'">
            <Avatar
              v-if="item.label"
              class="flex items-center"
              :image="item.image"
              :label="item.image_label"
              size="sm"
            />
          </div>
          <div v-else-if="column.key === 'sender'">
            <Avatar
              v-if="item.full_name"
              class="flex items-center"
              :image="item.user_image"
              :label="item.full_name"
              size="sm"
            />
          </div>
        </template>
        <template #default="{ label }">
          <div
            v-if="
              [
                'modified',
                'creation',
                'start_date',
                'end_date',
              ].includes(column.key)
            "
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
            <template v-if="column.key === 'modified'">
              <Tooltip :text="item.label">
                <div>{{ item.timeAgo || label }}</div>
              </Tooltip>
            </template>
            <template v-else>
              <span>{{ label }}</span>
            </template>
          </div>
          <div v-else-if="column.type === 'Check'">
            <FormControl
              type="checkbox"
              :modelValue="item === 'Enable' || item === true"
              :disabled="true"
              class="text-ink-gray-9"
            />
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
    <ListFooter
      v-if="options.rowCount || options.totalCount"
      class="border-t px-3 py-2 sm:px-5"
      :modelValue="pageSize"
      :options="{
        rowCount: options.rowCount,
        totalCount: options.totalCount,
      }"
      @update:modelValue="(val) => emit('updatePageCount', val)"
      @loadMore="emit('loadMore')"
    />
  </ListView>
  <ListBulkActions
    ref="listBulkActionsRef"
    v-model="list"
    doctype="Email Campaign"
    :options="{
      hideAssign: true,
    }"
  />
</template>

<script setup>
import HeartIcon from '@/components/Icons/HeartIcon.vue'
import IndicatorIcon from '@/components/Icons/IndicatorIcon.vue'
import MultipleAvatar from '@/components/MultipleAvatar.vue'
import ListBulkActions from '@/components/ListBulkActions.vue'
import ListRows from '@/components/ListViews/ListRows.vue'
import AppStyling from '@/components/AppStyling.vue'
import { Avatar, ListView, ListHeader, ListHeaderItem, ListRowItem, ListFooter, ListSelectBanner, Button, Dropdown, FormControl } from 'frappe-ui'
import { useRoute } from 'vue-router'
import { ref, computed } from 'vue'

// dayjs for relative time
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
dayjs.extend(relativeTime)

const route = useRoute()

const props = defineProps({
  columns: { type: Array, required: true },
  rows: { type: Array, required: true },
  selections: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  totalCount: { type: Number, default: 0 },
  pageSize: { type: Number, default: 20 },
  currentPage: { type: Number, default: 1 },
  showSelection: { type: Boolean, default: true },
  options: { type: Object, default: () => ({ selectable: true, showTooltip: true, resizeColumn: false, totalCount: 0, rowCount: 0 }) },
  isLikeFilterApplied: { type: Boolean, default: false },
})

const emit = defineEmits(['selectionsChanged', 'columnWidthUpdated', 'applyFilter', 'applyLikeFilter', 'loadMore', 'updatePageCount'])

const pageLengthCount = defineModel()
const list = defineModel('list')
const listBulkActionsRef = ref(null)

defineExpose({ customListActions: computed(() => listBulkActionsRef.value?.customListActions) })

// Helper to show relative time for the modified column
function getRelativeTime(value) {
  if (!value) return ''
  return dayjs(value).fromNow()
}
</script>

<style scoped>
.email-campaign-list-view {
  background: #ffffff;
  border-radius: 0.5rem;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}
.email-campaign-list-view table { width: 100%; border-collapse: collapse; }
.email-campaign-list-view th { position: sticky; top: 0; z-index: 10; }
.email-campaign-list-view tbody tr:hover { background: #f8fafc; }
</style>