<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :class="props.class"
    :width="props.size"
    :height="props.size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="2" x2="22" y1="12" y2="12" />
    <path d="m9 12 2 2 4-4" />
  </svg>
</template>

<script setup>
const props = defineProps({
  class: {
    type: String,
    default: '',
  },
  size: {
    type: [String, Number],
    default: 24,
  },
})
</script> 