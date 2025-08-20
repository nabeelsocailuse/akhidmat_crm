<template>
  <div class="flex items-center justify-between gap-2 px-5 pb-4 pt-3">
    <div class="flex items-center gap-2">
      <Filter
        v-model="list"
        :doctype="doctype"
        :default_filters="filters"
        @update="updateFilter"
      />
    </div>
    <div class="flex items-center gap-2">
      <Button :label="__('Refresh')" @click="reload()" :loading="isLoading">
        <template #icon>
          <RefreshIcon class="h-4 w-4" />
        </template>
      </Button>
      <SortBy
        v-model="list"
        :doctype="doctype"
        @update="updateSort"
      />
      <ColumnSettings
        v-model="list"
        :doctype="doctype"
        @update="updateColumns"
      />
    </div>
  </div>
</template>

<script setup>
import Filter from './Filter.vue'
import SortBy from './SortBy.vue'
import ColumnSettings from './ColumnSettings.vue'
import RefreshIcon from './Icons/RefreshIcon.vue'

const props = defineProps({
  list: Object,
  doctype: String,
  filters: Object
})

const emit = defineEmits(['updateFilter', 'updateSort', 'updateColumns'])

const isLoading = ref(false)

function reload() {
  isLoading.value = true
  if (props.list?.reload) {
    props.list.reload()
  }
  setTimeout(() => {
    isLoading.value = false
  }, 1000)
}

function updateFilter(filters) {
  emit('updateFilter', filters)
}

function updateSort(orderBy) {
  emit('updateSort', orderBy)
}

function updateColumns(columns) {
  emit('updateColumns', columns)
}
</script> 