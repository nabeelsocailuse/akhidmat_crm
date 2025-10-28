<template>
  <ListView
    :class="$attrs.class"
    :columns="columns"
    :rows="processedRows"
    :options="{
      getRowRoute: (row) => {
        if (!row || !row.name) {
          return { name: 'Donation' };
        }
        return {
          name: 'DonationDetail',
          params: { donationId: row.name },
        };
      },
      selectable: options.selectable,
      showTooltip: options.showTooltip,
      resizeColumn: options.resizeColumn,
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

  <ListRows :rows="processedRows" v-slot="{ idx, column, item, row }" doctype="Donation">
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
          <div
            v-else
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
    v-if="pageLengthCount"
    class="border-t sm:px-5 px-3 py-2"
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
    doctype="Donation"
    :options="{ hideEdit: false, hideDelete: false, hideAssign: false }"
  />
</template>

<script setup>
import HeartIcon from "@/components/Icons/HeartIcon.vue";
import IndicatorIcon from "@/components/Icons/IndicatorIcon.vue";
import MultipleAvatar from "@/components/MultipleAvatar.vue";
import ListBulkActions from "@/components/ListBulkActions.vue";
import ListRows from "@/components/ListViews/ListRows.vue";
import AppStyling from "@/components/AppStyling.vue";
import {
  ListView,
  ListHeaderItem,
  ListSelectBanner,
  ListRowItem,
  ListFooter,
  Dropdown,
  Tooltip,
} from "frappe-ui";
import { sessionStore } from "@/stores/session";
import { ref, computed, watch } from "vue";

const props = defineProps({
  rows: {
    type: Array,
    required: true,
  },
  columns: {
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
});

const emit = defineEmits([
  "loadMore",
  "updatePageCount",
  "columnWidthUpdated",
  "applyFilter",
  "applyLikeFilter",
  "likeDoc",
  "selectionsChanged",
]);

const pageLengthCount = ref(20);
const list = ref([]);

const isLikeFilterApplied = computed(() => {
  return list.value.params?.filters?._liked_by ? true : false;
});

watch(pageLengthCount, (val, old_value) => {
  if (val === old_value) return;
  emit("updatePageCount", val);
});

const listBulkActionsRef = ref(null);

const statusColorMap = {
  Draft: 'text-gray-500',
  Unpaid: 'text-orange-500',
  Paid: 'text-green-500',
  'Partly Return': 'text-yellow-500',
  Return: 'text-gray-500',
  'Credit Note Issued': 'text-gray-500',
  'Unpaid and Discounted': 'text-orange-500',
  'Partly Paid and Discounted': 'text-yellow-500',
  'Overdue and Discounted': 'text-red-500',
  Overdue: 'text-red-500',
  'Partly Paid': 'text-yellow-500',
  'Internal Transfer': 'text-gray-600',
  'Unknown To Known': 'text-green-500',
};

const processedRows = computed(() => {
  try {
    return (props.rows || []).map((r) => {
      // determine color from either existing row.color or status mapping
      const statusKey = r && typeof r.status === 'object' ? r.status.label : r?.status;
      const color = r?.color || statusColorMap[statusKey] || 'text-gray-500';

      // ensure the status cell is an object with label and color so ListRows' `item` has `color`
      const statusCell = r?.status && typeof r.status === 'object'
        ? { ...r.status, color }
        : { label: r?.status || '', color };

      return { ...r, status: statusCell, color };
    });
  } catch (error) {
    return props.rows || [];
  }
});

defineExpose({
  customListActions: computed(() => listBulkActionsRef.value?.customListActions),
});
</script>
