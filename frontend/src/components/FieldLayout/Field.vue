<template>
  <div v-if="field.visible" class="field">
    <div v-if="field.fieldtype != 'Check'" class="mb-2 text-sm text-ink-gray-5">
      {{ __(field.label) }}
      <span
        v-if="
          field.reqd ||
          (field.mandatory_depends_on && field.mandatory_via_depends_on)
        "
        class="text-ink-red-2"
        >*</span
      >
    </div>

    <FormControl
      v-if="
        field.read_only &&
        !['Int', 'Float', 'Currency', 'Percent', 'Check'].includes(
          field.fieldtype,
        )
      "
      type="text"
      :placeholder="getPlaceholder(field)"
      v-model="data[field.fieldname]"
      :disabled="true"
      :description="field.description"
    />
    <Grid
      v-else-if="field.fieldtype === 'Table'"
      v-model="data[field.fieldname]"
      v-model:parent="data"
      :doctype="field.options"
      :parentDoctype="doctype"
      :parentFieldname="field.fieldname"
    />
    <FormControl
      v-else-if="field.fieldtype === 'Select'"
      type="select"
      class="form-control"
      :class="field.prefix ? 'prefix' : ''"
      :options="getSelectOptions(field)"
      v-model="data[field.fieldname]"
      @change="(e) => fieldChange(e.target.value, field)"
      :placeholder="getPlaceholder(field)"
      :description="field.description"
    >
      <template v-if="field.prefix" #prefix>
        <IndicatorIcon :class="field.prefix" />
      </template>
    </FormControl>
    <div v-else-if="field.fieldtype == 'Check'" class="flex items-center gap-2">
      <FormControl
        class="form-control"
        type="checkbox"
        v-model="data[field.fieldname]"
        @change="(e) => fieldChange(e.target.checked, field)"
        :disabled="Boolean(field.read_only)"
        :description="field.description"
      />
      <label
        class="text-sm text-ink-gray-5"
        @click="
          () => {
            if (!Boolean(field.read_only)) {
              data[field.fieldname] = !data[field.fieldname]
            }
          }
        "
      >
        {{ __(field.label) }}
        <span class="text-ink-red-3" v-if="field.mandatory">*</span>
      </label>
    </div>
    <div
      class="flex gap-1"
      v-else-if="['Link', 'Dynamic Link'].includes(field.fieldtype)"
    >
      <!-- Special handling for Company and Fund Class Id fields - no create functionality -->
      <Link
        v-if="field.fieldname === 'company' || field.fieldname === 'fund_class_id'"
        class="form-control flex-1 truncate"
        v-model="data[field.fieldname]"
        :doctype="field.fieldtype == 'Link' ? field.options : data[field.options]"
        :filters="field.filters"
        :placeholder="getPlaceholder(field)"
        :onCreate="null"
        :only_select="true"
      />
      <!-- Regular Link component for other fields -->
      <Link
        v-else
        class="form-control flex-1 truncate"
        v-model="data[field.fieldname]"
        :doctype="field.fieldtype == 'Link' ? field.options : data[field.options]"
        :filters="field.filters"
        :placeholder="getPlaceholder(field)"
        :onCreate="field.create"
      />
      
      <!-- Edit button for existing values -->
      <Button
        v-if="data[field.fieldname] && field.edit"
        class="shrink-0"
        :label="__('Edit')"
        @click="field.edit(data[field.fieldname])"
      >
        <template #prefix>
          <EditIcon class="h-4 w-4" />
        </template>
      </Button>
    </div>

    <TableMultiselectInput
      v-else-if="field.fieldtype === 'Table MultiSelect'"
      v-model="data[field.fieldname]"
      :doctype="field.options"
      @change="(v) => fieldChange(v, field)"
    />

    <Link
      v-else-if="field.fieldtype === 'User'"
      class="form-control"
      :value="data[field.fieldname] && getUser(data[field.fieldname]).full_name"
      :doctype="field.options"
      :filters="field.filters"
      @change="(v) => fieldChange(v, field)"
      :placeholder="getPlaceholder(field)"
      :hideMe="true"
    >
      <template #prefix>
        <UserAvatar
          v-if="data[field.fieldname]"
          class="mr-2"
          :user="data[field.fieldname]"
          size="sm"
        />
      </template>
      <template #item-prefix="{ option }">
        <UserAvatar class="mr-2" :user="option.value" size="sm" />
      </template>
      <template #item-label="{ option }">
        <Tooltip :text="option.value">
          <div class="cursor-pointer">
            {{ getUser(option.value).full_name }}
          </div>
        </Tooltip>
      </template>
    </Link>
    <DateTimePicker
      v-else-if="field.fieldtype === 'Datetime'"
      :value="data[field.fieldname]"
      :formatter="(date) => getFormat(date, '', true, true)"
      :placeholder="getPlaceholder(field)"
      input-class="border-none"
      @change="(v) => fieldChange(v, field)"
    />
    <DatePicker
      v-else-if="field.fieldtype === 'Date'"
      :value="data[field.fieldname]"
      :formatter="(date) => getFormat(date, '', true)"
      :placeholder="getPlaceholder(field)"
      input-class="border-none"
      @change="(v) => fieldChange(v, field)"
    />
    <FormControl
      v-else-if="
        ['Small Text', 'Text', 'Long Text', 'Code'].includes(field.fieldtype)
      "
      type="textarea"
      :value="data[field.fieldname]"
      :placeholder="getPlaceholder(field)"
      :description="field.description"
      @change="fieldChange($event.target.value, field)"
    />
    <Password
      v-else-if="field.fieldtype === 'Password'"
      :value="data[field.fieldname]"
      :placeholder="getPlaceholder(field)"
      :description="field.description"
      @change="fieldChange($event.target.value, field)"
    />
    <FormattedInput
      v-else-if="field.fieldtype === 'Int'"
      type="text"
      :placeholder="getPlaceholder(field)"
      :value="data[field.fieldname] || '0'"
      :disabled="Boolean(field.read_only)"
      :description="field.description"
      @change="fieldChange($event.target.value, field)"
    />
    <FormattedInput
      v-else-if="field.fieldtype === 'Percent'"
      type="text"
      :value="getFormattedPercent(field.fieldname, data)"
      :placeholder="getPlaceholder(field)"
      :disabled="Boolean(field.read_only)"
      :description="field.description"
      @change="fieldChange(flt($event.target.value), field)"
    />
    <FormattedInput
      v-else-if="field.fieldtype === 'Float'"
      type="text"
      :value="getFormattedFloat(field.fieldname, data)"
      :placeholder="getPlaceholder(field)"
      :disabled="Boolean(field.read_only)"
      :description="field.description"
      @change="fieldChange(flt($event.target.value), field)"
    />
    <FormattedInput
      v-else-if="field.fieldtype === 'Currency'"
      type="text"
      :value="getFormattedCurrency(field.fieldname, data, parentDoc)"
      :placeholder="getPlaceholder(field)"
      :disabled="Boolean(field.read_only)"
      :description="field.description"
      @change="fieldChange(flt($event.target.value), field)"
    />
    <FormControl
      v-else
      type="text"
      :placeholder="getPlaceholder(field)"
      :value="getDataValue(data[field.fieldname], field)"
      :disabled="Boolean(field.read_only)"
      :description="field.description"
      @change="fieldChange($event.target.value, field)"
    />
    <FormControl
      v-else
      type="text"
      :placeholder="getPlaceholder(field)"
      :value="getDataValue(data[field.fieldname], field)"
      :disabled="Boolean(field.read_only)"
      :description="field.description"
      @change="fieldChange($event.target.value, field)"
    />
  </div>
</template>
<script setup>
import Password from '@/components/Controls/Password.vue'
import FormattedInput from '@/components/Controls/FormattedInput.vue'
import EditIcon from '@/components/Icons/EditIcon.vue'
import IndicatorIcon from '@/components/Icons/IndicatorIcon.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import TableMultiselectInput from '@/components/Controls/TableMultiselectInput.vue'
import Link from '@/components/Controls/Link.vue'
import Grid from '@/components/Controls/Grid.vue'
import { createDocument } from '@/composables/document'
import { getFormat, evaluateDependsOnValue } from '@/utils'
import { flt } from '@/utils/numberFormat.js'
import { getMeta } from '@/stores/meta'
import { usersStore } from '@/stores/users'
import { useDocument } from '@/data/document'
import { Tooltip, DatePicker, DateTimePicker } from 'frappe-ui'
import { computed, provide, inject, watch, onMounted, nextTick } from 'vue'

const props = defineProps({
  field: Object,
})

const data = inject('data')
const doctype = inject('doctype')
const preview = inject('preview')
const isGridRow = inject('isGridRow')

const { getFormattedPercent, getFormattedFloat, getFormattedCurrency } =
  getMeta(doctype)

const { users, getUser } = usersStore()

let triggerOnChange
let parentDoc

if (!isGridRow) {
  const {
    triggerOnChange: trigger,
    triggerOnRowAdd,
    triggerOnRowRemove,
  } = useDocument(doctype, data.value.name)
  triggerOnChange = trigger

  provide('triggerOnChange', triggerOnChange)
  provide('triggerOnRowAdd', triggerOnRowAdd)
  provide('triggerOnRowRemove', triggerOnRowRemove)
} else {
  triggerOnChange = inject('triggerOnChange', () => {})
  parentDoc = inject('parentDoc')
}

const field = computed(() => {
  let field = props.field
  
  if (field.fieldtype == 'Select' && typeof field.options === 'string') {
    field.options = field.options.split('\n').map((option) => {
      return { label: option, value: option }
    })

    if (field.options[0].value !== '') {
      field.options.unshift({ label: '', value: '' })
    }
  }

  if (field.fieldtype === 'Link' && field.options === 'User') {
    field.fieldtype = 'User'
    field.link_filters = JSON.stringify({
      ...(field.link_filters ? JSON.parse(field.link_filters) : {}),
      name: ['in', users.data.crmUsers?.map((user) => user.name)],
    })
  }

  // NEW: Disable create functionality for Company and Fund Class Id fields only
  if (field.fieldtype === 'Link' && (field.fieldname === 'company' || field.fieldname === 'fund_class_id')) {
    field.create = null // Remove create functionality
    field.only_select = true // Force only selection mode
    field.allow_on_submit = 0 // Prevent creation on submit
    field.allow_in_quick_entry = 0 // Prevent creation in quick entry
    console.log(`Field ${field.fieldname} create functionality disabled in Field component`)
  }
  // Keep existing logic for other Link fields
  else if (field.fieldtype === 'Link' && field.options !== 'User') {
    if (!field.create) {
      field.create = (value, close) => {
        // Close the dropdown immediately when "Create New" is clicked
        close?.()
        
        // Emit the open-create-modal event to the parent instead of using global createDocument
        emit('open-create-modal', {
          doctype: field.options,
          initialValue: value,
          onSuccess: (doc) => {
            if (doc) fieldChange(doc.name, field)
          }
        })
      }
    }
  }

  let _field = {
    ...field,
    filters: field.link_filters && JSON.parse(field.link_filters),
    placeholder: field.placeholder || field.label,
    display_via_depends_on: evaluateDependsOnValue(
      field.depends_on,
      data.value,
    ),
    mandatory_via_depends_on: evaluateDependsOnValue(
      field.mandatory_depends_on,
      data.value,
    ),
  }

  _field.visible = isFieldVisible(_field)
  return _field
})

function isFieldVisible(field) {
  if (preview.value) return true
  return (
    (field.fieldtype == 'Check' ||
      (field.read_only && data.value[field.fieldname]) ||
      !field.read_only) &&
    (!field.depends_on || field.display_via_depends_on) &&
    !field.hidden
  )
}

const getPlaceholder = (field) => {
  if (field.placeholder) {
    return __(field.placeholder)
  }
  if (['Select', 'Link'].includes(field.fieldtype)) {
    return __('Select {0}', [__(field.label)])
  } else {
    return __('Enter {0}', [__(field.label)])
  }
}

function fieldChange(value, df) {
  // Debug logging for link fields
  if (['Link', 'Dynamic Link', 'User'].includes(df.fieldtype)) {
    console.log(`🔗 Link field change: ${df.fieldname} = ${value}`)
    console.log(`🔗 Previous value: ${data.value[df.fieldname]}`)
  }
  
  // CRITICAL FIX: Always update the data first
  data.value[df.fieldname] = value
  
  // Debug logging after update
  if (['Link', 'Dynamic Link', 'User'].includes(df.fieldtype)) {
    console.log(`🔗 After update: ${df.fieldname} = ${data.value[df.fieldname]}`)
  }
  
  // Force reactivity update for link fields specifically
  if (['Link', 'Dynamic Link', 'User'].includes(df.fieldtype)) {
    // Ensure the value persists by forcing a reactive update
    nextTick(() => {
      if (data.value[df.fieldname] !== value) {
        console.log(`🔗 Value lost, restoring: ${df.fieldname} = ${value}`)
        data.value[df.fieldname] = value
      }
    })
  }
  
  if (isGridRow) {
    triggerOnChange(df.fieldname, value, data.value)
  } else {
    // Add fallback for when triggerOnChange is not available
    if (triggerOnChange) {
      triggerOnChange(df.fieldname, value)
    } else {
      // Fallback: directly update the data and force reactivity
      console.log(`Field ${df.fieldname} updated to:`, value)
      
      // Force a reactive update by triggering Vue's reactivity system
      nextTick(() => {
        if (data.value && data.value[df.fieldname] !== value) {
          data.value[df.fieldname] = value
        }
      })
    }
  }
}

function getDataValue(value, field) {
  if (field.fieldtype === 'Duration') {
    return value || 0
  }
  return value
}

// Remove the ensureChildTableInitialized computed property and add this watcher
watch(() => field.value, (newField) => {
  if (newField && newField.fieldtype === 'Table' && !data.value[newField.fieldname]) {
    data.value[newField.fieldname] = []
  }
}, { immediate: true })

// Add watcher to ensure link field values persist
watch(() => data.value, (newData, oldData) => {
  if (field.value && ['Link', 'Dynamic Link', 'User'].includes(field.value.fieldtype)) {
    const fieldname = field.value.fieldname
    if (newData[fieldname] && oldData && oldData[fieldname] !== newData[fieldname]) {
      // Ensure the value persists by forcing a reactive update
      nextTick(() => {
        if (data.value[fieldname] !== newData[fieldname]) {
          data.value[fieldname] = newData[fieldname]
        }
      })
    }
  }
}, { deep: true })

// Add specific watcher for link fields to prevent value loss
watch(() => field.value, (newField) => {
  if (newField && ['Link', 'Dynamic Link', 'User'].includes(newField.fieldtype)) {
    const fieldname = newField.fieldname
    const currentValue = data.value[fieldname]
    
    // If there's a value, ensure it persists
    if (currentValue) {
      nextTick(() => {
        // Double-check the value is still there
        if (data.value[fieldname] !== currentValue) {
          data.value[fieldname] = currentValue
        }
      })
    }
  }
}, { immediate: true })

// Also ensure initialization on mount
onMounted(() => {
  if (field.value && field.value.fieldtype === 'Table' && !data.value[field.value.fieldname]) {
    data.value[field.value.fieldname] = []
  }
})

// Add this function to handle select field options
function getSelectOptions(field) {
  if (field.fieldtype === 'Select') {
    if (typeof field.options === 'string') {
      // Split by newlines and create option objects
      return field.options.split('\n').map(option => ({
        label: option,
        value: option
      }))
    } else if (Array.isArray(field.options)) {
      // If already an array, ensure proper format
      return field.options.map(option => {
        if (typeof option === 'string') {
          return { label: option, value: option }
        }
        return option
      })
    }
  }
  return field.options || []
}

</script>
<style scoped>
:deep(.form-control.prefix select) {
  padding-left: 2rem;
}
</style>
