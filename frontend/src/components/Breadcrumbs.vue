<template>
  <nav class="flex items-center">
    <template v-for="(item, idx) in items" :key="idx">
      <router-link
        v-if="item.route"
        :to="item.route"
        class="text-lg font-medium text-ink-gray-7 hover:text-ink-gray-9"
      >
        {{ item.label }}
      </router-link>
      <span v-else class="text-lg font-medium text-ink-gray-7">{{ item.label }}</span>
      <span v-if="idx < items.length - 1" class="mx-1 text-ink-gray-4">/</span>
    </template>
  </nav>
</template>

<script setup>
const props = defineProps({
  items: {
    type: Array,
    required: true,
  },
})
</script> 