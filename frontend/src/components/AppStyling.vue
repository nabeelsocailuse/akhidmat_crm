<template>
  <!-- For buttons -->
  <Button
    v-if="type === 'button'"
    v-bind="componentProps"
    :class="componentClasses"
    @click="handleClick"
  >
    <template #prefix v-if="$slots.prefix">
      <slot name="prefix" />
    </template>
    <template #suffix v-if="$slots.suffix">
      <slot name="suffix" />
    </template>
    <template #default>
      {{ buttonLabel }}
    </template>
  </Button>
  
  <!-- For list headers -->
  <ListHeader
    v-else-if="type === 'list-header'"
    :class="componentClasses"
    @columnWidthUpdated="handleColumnWidthUpdated"
  >
    <slot />
  </ListHeader>
  
  <!-- For other components, -->
  <div
    v-else
    :class="componentClasses"
  >
    <slot />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Button, ListHeader } from 'frappe-ui'

const props = defineProps({
  // Component type what to render
  type: {
    type: String,
    required: true,
    validator: (value) => ['button', 'page-background', 'modal-styling', 'list-header', 'status-badge', 'sidebar', 'detail-background', 'donor-modal-background'].includes(value)
  },
  
  // Button specific props
  buttonType: {
    type: String,
    default: 'default',
    validator: (value) => ['default', 'filter', 'sort', 'columns', 'create'].includes(value)
  },
  buttonVariant: {
    type: String,
    default: 'solid'
  },
  buttonLabel: {
    type: String,
    default: ''
  },
  buttonLoading: {
    type: Boolean,
    default: false
  },
  
  // Page background specific props
  pageType: {
    type: String,
    default: 'default', 
    validator: (value) => ['default', 'leads', 'donor', 'campaigns'].includes(value)
  },
  minHeight: {
    type: String,
    default: 'min-h-screen'
  },
  
  // Modal styling specific props
  modalType: {
    type: String,
    default: 'header', 
    validator: (value) => ['header', 'footer'].includes(value)
  },
  
  // List header specific props
  headerMargin: {
    type: String,
    default: 'sm:mx-5 mx-3'
  },
  
  // Status badge specific props
  status: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['click', 'columnWidthUpdated'])

// Component props based on type
const componentProps = computed(() => {
  if (props.type === 'button') {
    return {
      variant: props.buttonVariant,
      loading: props.buttonLoading
    }
  }
  return {}
})

// Handle click events
const handleClick = (event) => {
  if (props.type === 'button') {
    emit('click', event)
  }
}

// Handle column width updated event for list header
const handleColumnWidthUpdated = () => {
  emit('columnWidthUpdated')
}

// Component classes based on type and props
const componentClasses = computed(() => {
  switch (props.type) {
    case 'button':
      return getButtonClasses()
    case 'page-background':
      return getPageBackgroundClasses()
    case 'modal-styling':
      return getModalStylingClasses()
    case 'list-header':
      return getListHeaderClasses()
    case 'status-badge':
      return getStatusBadgeClasses()
    case 'sidebar':
      return getSidebarClasses()
    case 'detail-background':
      return getDetailBackgroundClasses()
    case 'donor-modal-background':
      return getDonorModalBackgroundClasses()
    default:
      return ''
  }
})

// Button styling logic
const getButtonClasses = () => {
  const baseClasses = 'font-bold rounded-lg transition-all duration-200'
  
  switch (props.buttonType) {
    case 'filter':
      return `${baseClasses} !bg-[#EE82EE] hover:!bg-[#D870D8] !border-[#EE82EE] hover:!border-[#D870D8] !text-black !px-4 !py-2`
    
    case 'sort':
      return `${baseClasses} !bg-[#90EE90] hover:!bg-[#7ACA7A] !border-[#90EE90] hover:!border-[#7ACA7A] !text-black !px-4 !py-2`
    
    case 'columns':
      return `${baseClasses} !bg-[#D0D0D0] hover:!bg-[#B8B8B8] !border-black !text-black !px-4 !py-2`
    
    case 'create':
      return `${baseClasses} !bg-[#7c3aed] hover:!bg-[#6d28d9] !border-[#7c3aed] hover:!border-[#6d28d9] !text-white !px-4 !py-2 !shadow-lg hover:!shadow-xl hover:!-translate-y-0.5`
    
    default:
      return baseClasses
  }
}

// Page background styling logic
const getPageBackgroundClasses = () => {
  const baseClasses = props.minHeight
  
  switch (props.pageType) {
    case 'leads':
    case 'donor':
    case 'campaigns':
      return `${baseClasses} bg-gradient-to-br from-[#fef7ff] to-[#f8faff]`
    
    default:
      return baseClasses
  }
}

// Modal styling logic
const getModalStylingClasses = () => {
  const baseClasses = 'px-4 sm:px-6'
  
  switch (props.modalType) {
    case 'header':
      return `${baseClasses} pb-6 pt-5`
    
    case 'footer':
      return `${baseClasses} pb-7 pt-4`
    
    default:
      return baseClasses
  }
}

// List header styling logic
const getListHeaderClasses = () => {
  return `${props.headerMargin} !bg-[#e9d5ff] !py-2 !px-2 !min-h-[40px] list-header-bold`
}

// Status badge styling logic
const getStatusBadgeClasses = () => {
  const baseClasses = 'm-2 font-bold flex w-fit rounded-lg p-2'
  
  const statusToColor = {
    "Active": "green",
    "Inactive": "red",
    "Paid": "green",
    "Unpaid": "orange",
    "Pending": "yellow",
    "Open": "green",
    "Closed": "red",
    "Draft": "yellow",
    "Submitted": "blue",
    "Approved": "green",
    "Rejected": "red",
    "Completed": "green",
    "In Progress": "blue",
    "On Hold": "orange",
    "Cancelled": "red",
    "Converted": "green",
    "Lost": "red",
    "Won": "green",
    "New": "blue",
    "Contacted": "yellow",
    "Qualified": "green",
    "Unqualified": "red"
  }
  
  const colorToClasses = {
    "green": "text-green-700 bg-green-300",
    "red": "text-red-700 bg-red-300",
    "orange": "text-amber-700 bg-orange-300",
    "yellow": "text-yellow-700 bg-yellow-300",
    "blue": "text-blue-700 bg-blue-300"
  }
  
  const color = statusToColor[props.status] || 'blue'
  return `${baseClasses} ${colorToClasses[color]}`
}

// Sidebar styling logic
const getSidebarClasses = () => {
  return 'relative flex h-full flex-col justify-between transition-all duration-300 ease-in-out bg-gradient-to-b from-[#e9d5ff] to-[#c7d2fe]'
}

// Detail background styling logic
const getDetailBackgroundClasses = () => {
  return 'min-h-full !bg-gradient-to-br !from-[#fef7ff] !to-[#f8faff]'
}

// Donor modal background styling logic
const getDonorModalBackgroundClasses = () => {
  return 'bg-gradient-to-b from-[#FFFFFF] to-[#F5F9FF]'
}
</script>

<style scoped>
.list-header-bold :deep(*) {
  font-weight: bold !important;
}
</style> 