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
            name: 'EmailTemplate',
            params: { emailTemplateId: row.name }
          }
        } catch (error) {
          console.error('Error in getRowRoute:', error)
          return { name: 'EmailTemplates' }
        }
      },
      selectable: options.selectable,
      showTooltip: options.showTooltip,
      resizeColumn: options.resizeColumn,
      // Ensure rowCount and totalCount are passed for ListFooter
      rowCount: options.rowCount,
      totalCount: options.totalCount,
    }"
    :row-class="(row) => {
      return row.enabled === 'Yes' ? 'bg-green-50' : 'bg-gray-50'
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
      doctype="Email Template"
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
          <div v-if="column.key === 'name'">
            <Avatar
              v-if="item.label"
              class="flex items-center"
              :label="item.label"
              size="sm"
            />
          </div>
          <div v-else-if="column.key === 'subject'">
            <EmailIcon class="h-4 w-4" />
          </div>
          <div v-else-if="column.key === 'use_html'">
            <IndicatorIcon class="h-4 w-4" />
          </div>
          <div v-else-if="column.key === 'enabled'">
            <IndicatorIcon :class="statusesStore().getEnabledStatus(item?.label || item).color" />
          </div>
        </template>
        <template #default="{ label }">
          <div
            v-if="['modified', 'creation'].includes(column.key)"
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
            <Tooltip :text="item.label">
              <div>{{ item.timeAgo }}</div>
            </Tooltip>
          </div>
          <div v-else-if="column.key === 'subject'" class="truncate text-base">
            <Tooltip :text="item.label">
              <div class="truncate">{{ item.label }}</div>
            </Tooltip>
          </div>
          <div v-else-if="column.type === 'Check' || column.key === 'enabled'">
            <div class="truncate text-sm font-medium">
              <span :class="statusesStore().getEnabledStatus(item?.label || item).color">
                {{ statusesStore().getEnabledStatus(item?.label || item).name }}
              </span>
            </div>
          </div>
          <div v-else-if="column.key === '_liked_by'">
            <Button
              v-if="column.key == '_liked_by'"
              variant="ghosted"
              :class="isLiked(item) ? 'fill-red-500' : 'fill-white'"
              @click.stop.prevent="
                () => emit('likeDoc', { name: row.name, liked: isLiked(item) })
              "
            >
              <HeartIcon class="h-4 w-4" />
            </Button>
          </div>
          <div v-else class="truncate text-base">
            {{ label }}
          </div>
        </template>
      </ListRowItem>
    </ListRows>
    <!-- Move ListSelectBanner above ListFooter, like in EmailCampaignListView -->
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
    doctype="Email Template"
    :options="{
      hideAssign: true,
    }"
  />
</template>

<script setup>
import HeartIcon from '@/components/Icons/HeartIcon.vue'
import EmailIcon from '@/components/Icons/EmailIcon.vue'
import IndicatorIcon from '@/components/Icons/IndicatorIcon.vue'
import MultipleAvatar from '@/components/MultipleAvatar.vue'
import { statusesStore } from '@/stores/statuses'
import ListBulkActions from '@/components/ListBulkActions.vue'
import ListRows from '@/components/ListViews/ListRows.vue'
import AppStyling from '@/components/AppStyling.vue'
import {
  Avatar,
  ListView,
  ListHeader,
  ListHeaderItem,
  ListRowItem,
  ListFooter,
  ListSelectBanner,
  Button,
  FormControl,
  Tooltip,
  Dropdown,
} from 'frappe-ui'
import { useRoute } from 'vue-router'
import { ref, computed } from 'vue'

const route = useRoute()

const props = defineProps({
  columns: {
    type: Array,
    required: true,
  },
  rows: {
    type: Array,
    required: true,
  },
  selections: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
  totalCount: {
    type: Number,
    default: 0,
  },
  pageSize: {
    type: Number,
    default: 20,
  },
  currentPage: {
    type: Number,
    default: 1,
  },
  showSelection: {
    type: Boolean,
    default: true,
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
  'updatePageCount',
])

const pageLengthCount = defineModel()
const list = defineModel('list')
const listBulkActionsRef = ref(null)

function isLiked(item) {
  if (item && typeof item === 'string') {
    try {
      let likedByMe = JSON.parse(item)
      return Array.isArray(likedByMe) && likedByMe.length > 0
    } catch (e) {
      return false
    }
  }
  return false
}



defineExpose({
  customListActions: computed(
    () => listBulkActionsRef.value?.customListActions,
  ),
})
</script>