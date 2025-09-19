<template>
  <div
    class="flex flex-col"
    :class="{
      'border border-outline-gray-1 rounded-lg': hasTabs,
      'border-outline-gray-modals': hasTabs,
    }"
  >
    <Tabs as="div" v-model="tabIndex" :tabs="tabs">
      <TabList :class="!hasTabs ? 'hidden' : 'border-outline-gray-modals'" />
      <TabPanel v-slot="{ tab }">
        <div
          class="sections overflow-hidden"
          :class="{ 'my-4 sm:my-5': hasTabs }"
        >
          <template v-for="section in tab.sections" :key="section.name">
            <Section :section="section" :data-name="section.name" />
          </template>
        </div>
      </TabPanel>
    </Tabs>
  </div>
</template>

<script setup>
import Section from '@/components/FieldLayout/Section.vue'
import { Tabs, TabList, TabPanel } from 'frappe-ui'
import { ref, computed, provide, onMounted, inject } from 'vue'

const props = defineProps({
  tabs: Array,
  data: Object,
  doctype: {
    type: String,
    default: 'CRM Lead',
  },
  isGridRow: {
    type: Boolean,
    default: false,
  },
  preview: {
    type: Boolean,
    default: false,
  },
  parentFieldname: {
    type: String,
    default: '',
  },
  readOnly: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['open-create-modal', 'donor-selected', 'field-change'])

const tabIndex = ref(0)

const hasTabs = computed(() => {
  return (
    props.tabs.length > 1 || (props.tabs.length == 1 && props.tabs[0].label)
  )
})

// Ensure data is always reactive
const reactiveData = computed(() => {
  if (!props.data) {
    return {}
  }
  return props.data
})

// Function to handle field changes and emit to parent
const handleFieldChange = (fieldName, value) => {
  console.log('🔧 FieldLayout handleFieldChange called:', { fieldName, value, parentFieldname: props.parentFieldname })
  emit('field-change', fieldName, value)
}

// Get the parent's onFieldChange if available (for GridRowModal)
const parentOnFieldChange = inject('onFieldChange', null)

// Create a combined handler that calls both
const combinedFieldChange = (fieldName, value) => {
  console.log(' FieldLayout combinedFieldChange called:', { fieldName, value, hasParent: !!parentOnFieldChange, parentFieldname: props.parentFieldname })
  
  // Call parent's handler first (GridRowModal)
  if (parentOnFieldChange) {
    console.log(' Calling parent onFieldChange')
    parentOnFieldChange(fieldName, value)
  }
  
  // Then call our own handler
  handleFieldChange(fieldName, value)
}

provide(
  'data',
  reactiveData,
)
provide('hasTabs', hasTabs)
provide('doctype', props.doctype)
provide('preview', props.preview)
provide('isGridRow', props.isGridRow)
provide('parentFieldname', props.parentFieldname)
provide('readOnly', props.readOnly)
// Always provide the combined handler
provide('onFieldChange', combinedFieldChange)

console.log('🔧 FieldLayout providing onFieldChange function:', !!combinedFieldChange, 'parentFieldname:', props.parentFieldname)

// Add fallback for missing data
onMounted(() => {
  if (!props.data) {
    console.warn('FieldLayout: No data provided, using empty object')
  }
})
</script>
<style scoped>
.section:not(:has(.field)) {
  display: none;
}

.section:has(.field):nth-child(1 of .section:has(.field)) {
  border-top: none;
  margin-top: 0;
  padding-top: 0;
}
</style>
