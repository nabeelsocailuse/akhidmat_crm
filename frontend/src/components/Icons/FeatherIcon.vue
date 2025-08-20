<template>
  <svg
    :class="['feather', customClass, sizeClass]"
    :width="size"
    :height="size"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    viewBox="0 0 24 24"
  >
    <g v-if="iconName === 'plus'">
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </g>
    <g v-else-if="iconName === 'x'">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </g>
    <g v-else-if="iconName === 'edit'">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </g>
  </svg>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: 24 },
  customClass: { type: [String, Array, Object], default: '' }
})

const iconName = computed(() => props.name)

const sizeClass = computed(() => {
  if (props.size === 24) return 'h-6 w-6'
  if (props.size === 16) return 'h-4 w-4'
  return ''
})
</script>

<style scoped>
.feather {
  display: inline-block;
  vertical-align: middle;
}
</style>
