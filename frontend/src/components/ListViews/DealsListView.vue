<template>
  <ListView
    :class="$attrs.class"
    :columns="columns"
    :rows="rows"
    :options="{
      getRowRoute: (row) => ({
        name: 'Deal',
        params: { dealId: row.name },
        query: { view: route.query.view, viewType: route.params.viewType },
      }),
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
      doctype="CRM Deal"
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
          <div v-else-if="column.key === 'organization'">
            <Avatar
              v-if="item.label"
              class="flex items-center"
              :image="item.logo"
              :label="item.label"
              size="sm"
            />
          </div>
          <div v-else-if="column.key === 'deal_owner'">
            <Avatar
              v-if="item.full_name"
              class="flex items-center"
              :image="item.user_image"
              :label="item.full_name"
              size="sm"
            />
          </div>
          <div v-else-if="column.key === 'mobile_no'">
            <PhoneIcon class="h-4 w-4" />
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
        </template>
        <template #default="{ label }">
          <div
            v-if="
              [
                'modified',
                'creation',
                'expected_close_date',
                'closing_date',
                'response_by',
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
            {{ label }}
          </div>
          <div v-else class="truncate text-base">
            {{ label }}
          </div>
        </template>
      </ListRowItem>
    </ListRows>
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
</template>

<script setup>
import HeartIcon from '@/components/Icons/HeartIcon.vue'
import IndicatorIcon from '@/components/Icons/IndicatorIcon.vue'
import PhoneIcon from '@/components/Icons/PhoneIcon.vue'
import MultipleAvatar from '@/components/MultipleAvatar.vue'
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
  Button,
} from 'frappe-ui'
import { sessionStore } from '@/stores/session'
import { useRoute } from 'vue-router'

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

const { user } = sessionStore()

function isLiked(item) {
  if (item) {
    try {
      let likedByMe = JSON.parse(item)
      return likedByMe.includes(user)
    } catch (error) {
      return false
    }
  }
  return false
}
</script>
