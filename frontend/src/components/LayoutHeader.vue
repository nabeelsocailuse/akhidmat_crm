<template>
  <Teleport to="#app-header" v-if="showHeader">
    <slot>
      <header class="flex h-10.5 items-center justify-between py-[7px] sm:pl-5 pl-2">
        <div class="flex items-center gap-2">
          <slot name="left-header" />
        </div>
        <div class="flex items-center gap-2">
          <slot name="right-header" />
        </div>
      </header>
    </slot>
  </Teleport>
</template>

<script setup>
import { ref, nextTick, onMounted } from 'vue'

const showHeader = ref(false)

// Fix line 20-21 - Add proper error handling for nextTick
onMounted(() => {
  try {
    nextTick(() => {
      showHeader.value = true
    })
  } catch (error) {
    console.error('LayoutHeader error:', error)
    // Fallback - show header immediately
    showHeader.value = true
  }
})
</script>
