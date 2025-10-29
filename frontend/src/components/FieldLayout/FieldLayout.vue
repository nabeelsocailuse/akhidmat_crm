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
        <div class="sections overflow-hidden" :class="{ 'my-4 sm:my-5': hasTabs }">
          <template v-for="section in tab.sections" :key="section.name">
            <Section
              :section="section"
              :data-name="section.name"
              @fund-class-selected="emit('fund-class-selected', $event)"
              @donor-selected="emit('donor-selected', $event)"
              @add-deduction-row="emit('add-deduction-row', $event)"
              @open-create-modal="emit('open-create-modal', $event)"
            />
          </template>
        </div>
      </TabPanel>
    </Tabs>
  </div>
</template>

<script setup>
import Section from "@/components/FieldLayout/Section.vue";
import { Tabs, TabList, TabPanel } from "frappe-ui";
import { ref, computed, provide, onMounted, inject } from "vue";

const props = defineProps({
  tabs: Array,
  data: Object,
  doctype: {
    type: String,
    default: "CRM Lead",
  },
  // Flag to indicate this FieldLayout is rendered inside a modal
  isModal: {
    type: Boolean,
    default: false,
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
    default: "",
  },
  readOnly: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits([
  "open-create-modal",
  "donor-selected",
  "field-change",
  "fund-class-selected",
  "add-deduction-row",
]);

const tabIndex = ref(0);

const hasTabs = computed(() => {
  return props.tabs.length > 1 || (props.tabs.length === 1 && props.tabs[0].label);
});

const reactiveData = computed(() => {
  return props.data || {};
});

const handleFieldChange = (fieldName, value) => {
  emit("field-change", fieldName, value);
};

const parentOnFieldChange = inject("onFieldChange", null);

const combinedFieldChange = (fieldName, value) => {
  if (parentOnFieldChange) {
    parentOnFieldChange(fieldName, value);
  }
  handleFieldChange(fieldName, value);
};

provide("data", reactiveData);
provide("hasTabs", hasTabs);
provide("doctype", props.doctype);
provide("preview", props.preview);
provide("isGridRow", props.isGridRow);
provide("parentFieldname", props.parentFieldname);
provide("readOnly", props.readOnly);
// Provide modal context so Field components can adjust behavior
provide("isModal", props.isModal);
provide("onFieldChange", combinedFieldChange);

onMounted(() => {
  if (!props.data) {
    // fallback provided by reactiveData already
  }
});
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
