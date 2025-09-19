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
            name: 'TaxExemptionCertificate',
            params: { certificateId: row.name },
          }
        } catch (error) {
          console.error('Error in getRowRoute:', error)
          return { name: 'TaxExemptionCertificates' }
        }
      },
      selectable: options.selectable,
      showTooltip: options.showTooltip,
      resizeColumn: options.resizeColumn,
    }"
    :row-class="(row) => {
      return row.status === 'Active' ? 'bg-green-50' : 'bg-gray-50'
    }"
    row-key="name"
    @update:selections="(selections) => emit('selectionsChanged', selections)"
  >
    <AppStyling
      type="list-header"
      headerMargin="sm:mx-5 mx-3"
      @columnWidthUpdated="emit('columnWidthUpdated')"
    >
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

    <ListRows :rows="rows" v-slot="{ idx, column, item, row }" doctype="Tax Exemption Certificate">
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
          <div v-if="column.key === 'donor'">
            <Avatar v-if="item" class="flex items-center" :label="item" size="sm" />
          </div>
        </template>

        <template #default="{ label }">
          <div
            v-if="['date_of_issue', 'donation_date'].includes(column.key)"
            class="text-sm text-gray-600"
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
            {{ label }}
          </div>
          <div v-else-if="column.key === 'total_donation'" class="font-medium text-green-600">
            {{ label }}
          </div>
          <div v-else-if="column.key === '_comment_count'" class="flex items-center gap-1">
            <CommentIcon class="h-4 w-4" />
            <span class="text-sm">{{ label || 0 }}</span>
          </div>
          <div v-else class="truncate text-base">
            {{ label }}
          </div>
        </template>
      </ListRowItem>
    </ListRows>
  </ListView>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue'
import { useRoute } from 'vue-router'
import {
  ListView,
  ListHeaderItem,
  Avatar,
  Button,
  ListRowItem,
} from 'frappe-ui'
import AppStyling from '@/components/AppStyling.vue'
import ListRows from '@/components/ListViews/ListRows.vue'
import MultipleAvatar from '@/components/MultipleAvatar.vue'
import CommentIcon from '@/components/Icons/CommentIcon.vue'
import HeartIcon from '@/components/Icons/HeartIcon.vue'

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
  isLikeFilterApplied: { type: Boolean, default: false },
})

const emit = defineEmits([
  'selectionsChanged',
  'columnWidthUpdated',
  'applyFilter',
  'applyLikeFilter',
  'loadMore',
  'updatePageCount',
])
</script>
