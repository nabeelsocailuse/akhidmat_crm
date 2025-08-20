<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    :class="['donor-icon', customClass]"
    aria-hidden="true"
  >
    <!-- Heart shape -->
    <path
      d="M12 21s-4.2-3.4-6.2-5.4C3 13.2 2 11.7 2 10a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 1.7-1 3.2-3.8 5.6C16.2 17.6 12 21 12 21z"
    />
    <!-- Optional: hand line for "giving" feel -->
    <path
      d="M12 21v-4"
    />
  </svg>
</template>

<script setup>
const props = defineProps({
  size: { type: [Number, String], default: 24 },
  customClass: { type: [String, Array, Object], default: '' }
})
</script>

<style scoped>
.donor-icon {
  display: inline-block;
  vertical-align: middle;
}
</style>