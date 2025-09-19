<script setup>
import { ref, computed } from 'vue';
import { useRoute } from 'vue-router';

const tabs = ref([
  { name: 'Details', label: 'Details' },
  { name: 'Activity', label: 'Activity' },
]);

const activeTab = ref(tabs.value[0].name);

function switchTab(tabName) {
  activeTab.value = tabName;
}
</script>

<template>
  <div class="tabs-container">
    <div class="tabs-header">
      <div
        v-for="tab in tabs"
        :key="tab.name"
        :class="['tab', { active: activeTab === tab.name }]"
        @click="switchTab(tab.name)"
      >
        {{ tab.label }}
      </div>
    </div>
    <div class="tabs-content">
      <slot :name="activeTab" />
    </div>
  </div>
</template>

<style scoped>
.tabs-container {
  display: flex;
  flex-direction: column;
}

.tabs-header {
  display: flex;
  border-bottom: 1px solid #ccc;
}

.tab {
  padding: 10px 20px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
}

.tab.active {
  border-bottom: 2px solid #007bff;
  font-weight: bold;
}

.tabs-content {
  padding: 20px;
}
</style>