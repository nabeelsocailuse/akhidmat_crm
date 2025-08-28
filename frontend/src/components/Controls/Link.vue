<template>
  <div class="space-y-1.5 p-[2px] -m-[2px]">
    <label class="block" :class="labelClasses" v-if="attrs.label">
      {{ __(attrs.label) }}
    </label>
    <Autocomplete
      ref="autocomplete"
      :options="options.data"
      v-model="value"
      :size="attrs.size || 'sm'"
      :variant="attrs.variant"
      :placeholder="attrs.placeholder"
      :disabled="attrs.disabled"
      :placement="attrs.placement"
      :filterable="false"
    >
      <template #target="{ open, togglePopover }">
        <slot name="target" v-bind="{ open, togglePopover }" />
      </template>

      <template #prefix>
        <slot name="prefix" />
      </template>

      <template #item-prefix="{ active, selected, option }">
        <slot name="item-prefix" v-bind="{ active, selected, option }" />
      </template>

      <template #item-label="{ active, selected, option }">
        <slot name="item-label" v-bind="{ active, selected, option }">
          <div v-if="option.description" class="flex flex-col gap-1">
            <div class="flex-1 font-semibold truncate text-ink-gray-7">
              {{ option.label }}
            </div>
            <div class="flex-1 text-sm truncate text-ink-gray-5">
              {{ option.description }}
            </div>
          </div>
          <div v-else class="flex-1 truncate text-ink-gray-7">
            {{ option.label }}
          </div>
        </slot>
      </template>

      <template #footer="{ value, close }">
        <div v-if="attrs.onCreate">
          <Button
            variant="ghost"
            class="w-full !justify-start"
            :label="__('Create New')"
            @click="() => attrs.onCreate(value, close)"
          >
            <template #prefix>
              <FeatherIcon name="plus" class="h-4" />
            </template>
          </Button>
        </div>
        <div>
          <Button
            variant="ghost"
            class="w-full !justify-start"
            :label="__('Clear')"
            @click="() => clearValue(close)"
          >
            <template #prefix>
              <FeatherIcon name="x" class="h-4" />
            </template>
          </Button>
        </div>
      </template>
    </Autocomplete>
  </div>
</template>

<script setup>
import Autocomplete from '@/components/frappe-ui/Autocomplete.vue'
import { watchDebounced } from '@vueuse/core'
import { createResource } from 'frappe-ui'
import { useAttrs, computed, ref, watch } from 'vue'

const props = defineProps({
  doctype: {
    type: String,
    required: true,
  },
  filters: {
    type: [Array, Object, String],
    default: [],
  },
  get_query: {
    type: Function,
    default: null,
  },
  key: {
    type: String,
    default: '',
  },
  modelValue: {
    type: String,
    default: '',
  },
  hideMe: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue', 'change'])

const attrs = useAttrs()

const valuePropPassed = computed(() => 'value' in attrs && !('modelValue' in attrs))

const value = computed({
  get: () => {
    // Prioritize modelValue when using v-model, fallback to value for backward compatibility
    if ('modelValue' in attrs) {
      return props.modelValue
    }
    return valuePropPassed.value ? attrs.value : props.modelValue
  },
  set: (val) => {
    // Fix: Handle both object and string values properly
    let newValue = ''
    
    if (val && typeof val === 'object' && val.value !== undefined) {
      // Handle object with value property (from autocomplete selection)
      newValue = val.value
    } else if (val && typeof val === 'string') {
      // Handle direct string value
      newValue = val
    } else if (val === null || val === undefined) {
      // Handle null/undefined
      newValue = ''
    } else {
      // Fallback: try to extract value or use as-is
      newValue = val?.value || val || ''
    }
    
    // Emit the change event with the proper value
    if (valuePropPassed.value) {
      emit('change', newValue)
    } else {
      emit('update:modelValue', newValue)
    }
  },
})

const autocomplete = ref(null)
const text = ref('')

watchDebounced(
  () => autocomplete.value?.query,
  (val) => {
    val = val || ''
    if (text.value === val) return
    text.value = val
    reload(val)
  },
  { debounce: 300, immediate: true },
)

watchDebounced(
  () => props.doctype,
  () => reload(''),
  { debounce: 300, immediate: true },
)

// Add watcher to monitor filter changes
watch(
  () => props.filters,
  (newFilters, oldFilters) => {
    console.log('Link component filters changed:', {
      newFilters,
      oldFilters,
      doctype: props.doctype
    })
    // Force reload when filters change
    reload(text.value || '')
  },
  { deep: true }
)

// Add watcher to monitor get_query function changes
watch(
  () => props.get_query,
  (newGetQuery, oldGetQuery) => {
    console.log('Link component get_query changed:', {
      newGetQuery: typeof newGetQuery,
      oldGetQuery: typeof oldGetQuery,
      doctype: props.doctype
    })
    // Force reload when get_query changes
    reload(text.value || '')
  }
)

// Add watcher to monitor key changes (for department-based reloading)
watch(
  () => props.key,
  (newKey, oldKey) => {
    if (newKey !== oldKey) {
      console.log('Link component key changed:', {
        newKey,
        oldKey,
        doctype: props.doctype
      })
      // Clear current options and force reload
      options.data = []
      reload(text.value || '')
    }
  }
)

// Expose reload method for parent components
defineExpose({
  reload: () => reload(text.value || '')
})

const options = createResource({
  url: 'frappe.desk.search.search_link',
  cache: [props.doctype, text.value, props.hideMe, props.filters],
  method: 'POST',
  params: computed(() => {
    // Handle get_query function if provided
    let filters = props.filters || {}
    
    // If get_query is a function, call it to get dynamic filters
    if (typeof props.get_query === 'function') {
      try {
        const queryResult = props.get_query()
        if (queryResult && queryResult.filters) {
          filters = { ...filters, ...queryResult.filters }
        }
      } catch (error) {
        console.error('Error executing get_query function:', error)
      }
    }
    
    return {
      txt: text.value,
      doctype: props.doctype,
      filters: filters,
    }
  }),
  transform: (data) => {
    let allData = data.map((option) => {
      return {
        label: option.label || option.value,
        value: option.value,
        description: option.description,
      }
    })
    if (!props.hideMe && props.doctype == 'User') {
      allData.unshift({
        label: '@me',
        value: '@me',
      })
    }
    return allData
  },
})

function reload(val) {
  if (!props.doctype) return
  
  // Clear current options data to force fresh loading
  options.data = []
  
  // Handle get_query function if provided
  let filters = props.filters || {}
  
  // If get_query is a function, call it to get dynamic filters
  if (typeof props.get_query === 'function') {
    try {
      const queryResult = props.get_query()
      if (queryResult && queryResult.filters) {
        filters = { ...filters, ...queryResult.filters }
      }
    } catch (error) {
      console.error('Error executing get_query function:', error)
    }
  }

  options.update({
    params: {
      txt: val,
      doctype: props.doctype,
      filters: filters,
    },
  })
  options.reload()
}

function clearValue(close) {
  emit(valuePropPassed.value ? 'change' : 'update:modelValue', '')
  close()
}

const labelClasses = computed(() => {
  return [
    {
      sm: 'text-xs',
      md: 'text-base',
    }[attrs.size || 'sm'],
    'text-ink-gray-5',
  ]
})
</script>
