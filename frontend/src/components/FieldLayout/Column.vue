<template>
  <div class="column flex flex-col gap-4 w-full">
    <div
      v-if="column.label && !column.hideLabel"
      class="text-ink-gray-9 max-w-fit text-base"
    >
      {{ column.label }}
    </div>
    <template v-for="field in column.fields" :key="field.fieldname">
      <Field 
        :field="field" 
        :data-name="field.fieldname"
        @donor-selected="$emit('donor-selected', $event)"
        @fund-class-selected="$emit('fund-class-selected', $event)"
        @add-deduction-row="$emit('add-deduction-row', $event)"
        @open-create-modal="$emit('open-create-modal', $event)"
      />
    </template>
  </div>
</template>
<script setup>
import Field from '@/components/FieldLayout/Field.vue'

const props = defineProps({
  column: Object,
})

const emit = defineEmits(['donor-selected', 'fund-class-selected', 'add-deduction-row', 'open-create-modal'])
</script>
