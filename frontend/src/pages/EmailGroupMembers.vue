<template>
  <AppStyling type="page-background" pageType="email-group-members">
    <LayoutHeader>
      <template #left-header>
        <ViewBreadcrumbs v-model="viewControls" routeName="Email Group Members" />
      </template>
      <template #right-header>
        <AppStyling
          type="button"
          buttonType="create"
          buttonLabel="Create"
          @click="showModal = true"
        >
          <template #prefix><FeatherIcon name="plus" class="h-4 w-4 text-white" /></template>
        </AppStyling>
      </template>
    </LayoutHeader>

    <ViewControls
      ref="viewControls"
      v-model="members"
      v-model:loadMore="loadMore"
      v-model:resizeColumn="triggerResize"
      v-model:updatedPageCount="updatedPageCount"
      doctype="Email Group Member"
      :options="{ allowedViews: ['list'] }"
    />

    <EmailGroupMembersListView
      v-if="members.data && rows.length"
      v-model="members.data.page_length_count"
      v-model:list="members"
      :rows="rows"
      :columns="listColumns"
      :options="{
        showTooltip: false,
        resizeColumn: true,
        rowCount: members.data.row_count,
        totalCount: members.data.total_count,
      }"
      @loadMore="() => loadMore++"
      @columnWidthUpdated="() => triggerResize++"
      @updatePageCount="(count) => (updatedPageCount = count)"
      @applyFilter="(data) => viewControls.applyFilter(data)"
      @applyLikeFilter="(data) => viewControls.applyLikeFilter(data)"
      @selectionsChanged="(selections) => viewControls.updateSelections(selections)"
    />

    <div v-else-if="members.data" class="flex h-full items-center justify-center">
      <div class="flex flex-col items-center gap-3 text-xl font-medium text-ink-gray-4">
        <span>{{ __('No {0} Found', [__('Email Group Members')]) }}</span>
        <Button :label="__('Create')" @click="showModal = true">
          <template #prefix><FeatherIcon name="plus" class="h-4" /></template>
        </Button>
      </div>
    </div>

    <EmailGroupMemberModal v-if="showModal" v-model="showModal" />
  </AppStyling>
</template>

<script setup>
import ViewBreadcrumbs from '@/components/ViewBreadcrumbs.vue'
import LayoutHeader from '@/components/LayoutHeader.vue'
import EmailGroupMembersListView from '@/components/ListViews/EmailGroupMembersListView.vue'
import EmailGroupMemberModal from '@/components/Modals/EmailGroupMemberModal.vue'
import ViewControls from '@/components/ViewControls.vue'
import AppStyling from '@/components/AppStyling.vue'
import { Button } from 'frappe-ui'
import { ref, computed } from 'vue'
import { formatDate, timeAgo } from '@/utils'

const showModal = ref(false)

const members = ref({})
const loadMore = ref(1)
const triggerResize = ref(1)
const updatedPageCount = ref(20)
const viewControls = ref(null)

const rows = computed(() => {
  if (!members.value?.data?.data) return []

  // Map rows to ensure date fields use { label, timeAgo } like other list views
  return members.value.data.data.map((member) => {
    const mapped = { ...member }
    ;['modified', 'creation'].forEach((field) => {
      if (mapped[field]) {
        mapped[field] = {
          label: formatDate(mapped[field]),
          timeAgo: __(timeAgo(mapped[field])),
        }
      }
    })
    return mapped
  })
})

const listColumns = computed(() => {
  const cols = members.value?.data?.columns || []
  if (cols.length) return cols
  return [
    { key: 'name', label: __('ID') },
    { key: 'email', label: __('Email') },
    { key: 'email_group', label: __('Email Group') },
    { key: 'unsubscribed', label: __('Unsubscribed'), align: 'center' },
  ]
})
</script>


