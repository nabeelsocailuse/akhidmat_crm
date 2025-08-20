<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    class="icon icon-tabler icon-tabler-donation"
    width="1em"
    height="1em"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <!-- Heart -->
    <path
      d="M12 21s-6-4.35-6-8.5A3.5 3.5 0 0 1 12 7a3.5 3.5 0 0 1 6 5.5C18 16.65 12 21 12 21z"
    />
    <!-- Hand (palm) -->
    <path
      d="M2 19c0-1.104.896-2 2-2h7"
    />
    <!-- Hand (fingers) -->
    <path
      d="M9 17v2a2 2 0 0 0 2 2h7"
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