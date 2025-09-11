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
        !['Int', 'Float', 'Currency', 'Percent', 'Check', 'Attach', 'Attach Image'].includes(
          field.fieldtype,
        )
      "
      type="text"
      :placeholder="getPlaceholder(field)"
      v-model="data[field.fieldname]"
      :disabled="true"
      :description="getDescription(field)"
    />
    <Grid
      v-else-if="field.fieldtype === 'Table'"
      v-model="data[field.fieldname]"
      v-model:parent="data"
      :doctype="field.options"
      :parentDoctype="doctype"
      :parentFieldname="field.fieldname"
      :donorFiltering="getDonorFilteringFromData()"
      @donor-selected="$emit('donor-selected', $event)"
    />
    <FormControl
      v-else-if="field.fieldtype === 'Select' && getSelectOptions(field).length > 0"
      type="select"
      class="form-control"
      :class="field.prefix ? 'prefix' : ''"
      :options="getSelectOptions(field)"
      v-model="data[field.fieldname]"
      @change="(e) => fieldChange(e.target.value, field)"
      :placeholder="getPlaceholder(field)"
      :description="getDescription(field)"
    >
      <template v-if="field.prefix" #prefix>
        <IndicatorIcon :class="field.prefix" />
      </template>
    </FormControl>
    <FormControl
      v-else-if="field.fieldtype === 'Select' && getSelectOptions(field).length === 0"
      type="text"
      class="form-control"
      :placeholder="getPlaceholder(field)"
      :description="getDescription(field)"
      :disabled="true"
      :value="data[field.fieldname]"
    />
    <div v-else-if="field.fieldtype == 'Check'" class="flex items-center gap-2">
      <FormControl
        class="form-control"
        type="checkbox"
        v-model="data[field.fieldname]"
        @change="(e) => fieldChange(e.target.checked, field)"
        :disabled="Boolean(field.read_only)"
        :description="getDescription(field)"
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
      <!-- ADD: Debug logging for Link component props -->
      <div v-if="field.fieldname === 'donor_id'" style="display: none;">
        <!-- Debug info removed -->
      </div>
      
      <Link
        class="form-control flex-1 truncate"
        v-model="data[field.fieldname]"
        :doctype="
          field.fieldtype == 'Link' ? field.options : data[field.options]
        "
        :filters="getFieldFilters(field)"
        :get_query="field.get_query"
        :key="`link-${field.fieldname}-${field._departmentKey || 'default'}`"
        @change="(v) => fieldChange(v, field)"
        :placeholder="getPlaceholder(field)"
        :onCreate="field.create"
      />
      <Button
        v-if="data[field.fieldname] && field.edit"
        class="shrink-0"
        :label="__('Edit')"
        @click="field.edit(data[field.fieldname])"
      >
        <template #prefix>
          <EditIcon name="edit" class="h-4 w-4" />
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
      :filters="getFieldFilters(field)"
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
      v-else-if="field.fieldtype === 'Datetime' && !field.read_only"
      :value="data[field.fieldname]"
      :formatter="(date) => getFormat(date, '', true, true)"
      :placeholder="getPlaceholder(field)"
      input-class="border-none"
      @change="(v) => fieldChange(v, field)"
    />
    <FormControl
      v-else-if="field.fieldtype === 'Datetime' && field.read_only"
      type="text"
      :placeholder="getPlaceholder(field)"
      :value="data[field.fieldname] ? getFormat(data[field.fieldname], '', true, true) : ''"
      :disabled="true"
      :description="getDescription(field)"
    />
    <DatePicker
      v-else-if="field.fieldtype === 'Date' && !field.read_only"
      :value="data[field.fieldname]"
      :formatter="(date) => getFormat(date, '', true)"
      :placeholder="getPlaceholder(field)"
      input-class="border-none"
      @change="(v) => fieldChange(v, field)"
    />
    <FormControl
      v-else-if="field.fieldtype === 'Date' && field.read_only"
      type="text"
      :placeholder="getPlaceholder(field)"
      :value="data[field.fieldname] ? getFormat(data[field.fieldname], '', true) : ''"
      :disabled="true"
      :description="getDescription(field)"
    />
    <FormControl
      v-else-if="
        ['Small Text', 'Text', 'Long Text', 'Code'].includes(field.fieldtype)
      "
      type="textarea"
      :value="data[field.fieldname]"
      :placeholder="getPlaceholder(field)"
      :description="getDescription(field)"
      @change="fieldChange($event.target.value, field)"
    />
    <Password
      v-else-if="field.fieldtype === 'Password'"
      :value="data[field.fieldname]"
      :placeholder="getPlaceholder(field)"
      :description="getDescription(field)"
      @change="fieldChange($event.target.value, field)"
    />
    <FormattedInput
      v-else-if="field.fieldtype === 'Int'"
      type="text"
      :placeholder="getPlaceholder(field)"
      :value="data[field.fieldname] || '0'"
      :disabled="Boolean(field.read_only)"
      :description="getDescription(field)"
      @change="fieldChange($event.target.value, field)"
    />
    <FormattedInput
      v-else-if="field.fieldtype === 'Percent'"
      type="text"
      :value="getFormattedPercent(field.fieldname, data)"
      :placeholder="getPlaceholder(field)"
      :disabled="Boolean(field.read_only)"
      :description="getDescription(field)"
      @change="fieldChange(flt($event.target.value), field)"
    />
    <FormattedInput
      v-else-if="field.fieldtype === 'Float'"
      type="text"
      :value="getFormattedFloat(field.fieldname, data)"
      :placeholder="getPlaceholder(field)"
      :disabled="Boolean(field.read_only)"
      :description="getDescription(field)"
      @change="fieldChange(flt($event.target.value), field)"
    />
    <FormattedInput
      v-else-if="field.fieldtype === 'Currency'"
      type="text"
      :value="getFormattedCurrency(field.fieldname, data, parentDoc)"
      :placeholder="getPlaceholder(field)"
      :disabled="Boolean(field.read_only)"
      :description="getDescription(field)"
      @change="fieldChange(flt($event.target.value), field)"
    />
    <!-- Attach / Attach Image -->
    <div v-else-if="field.fieldtype === 'Attach' || field.fieldtype === 'Attach Image' || (field.fieldtype === 'Data' && field.options === 'Attach')" class="flex items-center gap-2">
      <div v-if="data[field.fieldname]" class="flex items-center gap-2">
        <a :href="data[field.fieldname]" target="_blank" rel="noopener" class="truncate text-ink-blue-6 underline">
          {{ data[field.fieldname] }}
        </a>
        <Button size="sm" variant="subtle" @click.stop="() => fieldChange('', field)">{{ __('Clear') }}</Button>
      </div>
      <div v-else class="w-full">
        <FileUploader @success="(file) => onAttachSuccess(file, field)">
          <template #default="{ openFileSelector }">
            <Button variant="outline" class="w-full justify-center" @click="openFileSelector">{{ __('Attach') }}</Button>
          </template>
        </FileUploader>
      </div>
    </div>
    <FormControl
      v-else
      type="text"
      :placeholder="getPlaceholder(field)"
      :value="getDataValue(data[field.fieldname], field)"
      :disabled="Boolean(field.read_only)"
      :description="getDescription(field)"
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
import { Tooltip, DatePicker, DateTimePicker, FileUploader, Button } from 'frappe-ui'
import { computed, provide, inject, watch, onMounted, nextTick } from 'vue'

const props = defineProps({
  field: Object,
})

const data = inject('data')
const doctype = inject('doctype')
const preview = inject('preview')
const isGridRow = inject('isGridRow')
const parentFieldname = inject('parentFieldname')

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

  if (field.fieldtype === 'Link' && field.options !== 'User') {
    // Disable "Create New" functionality for Company and Fund Class Id fields
    if (field.fieldname === 'company' || field.fieldname === 'fund_class_id') {
      // Remove the create function to disable "Create New" button
      field.create = undefined
    } else if (!field.create) {
      field.create = (value, close) => {
        const callback = (d) => {
          if (d) fieldChange(d.name, field)
        }
        createDocument(field.options, value, close, callback)
      }
    }
  }

  // Make owner_id field readonly for Donor doctype
  if (field.fieldname === 'owner_id' && doctype === 'Donor') {
    field.read_only = true
  }

  // Configure donor_desk field with set query functionality for Donor doctype
  if (field.fieldname === 'donor_desk' && doctype === 'Donor') {
    // Set up the get_query function for dynamic filtering based on department
    field.get_query = () => {
      const department = data.value?.department
      if (!department) {
        return {
          doctype: 'Donor Desk',
          filters: { department: ['!=', undefined] }
        }
      }
      return {
        doctype: 'Donor Desk',
        filters: { department: department }
      }
    }
    
    // Set up depends_on to show/hide field based on department selection
    field.depends_on = 'department'
    
    // Set placeholder and description based on department selection
    if (!data.value?.department) {
      field.placeholder = 'Please select a department first'
      field.description = 'Please select a department to see available donor desks'
      field.read_only = true
    } else {
      field.placeholder = 'Select Donor Desk'
      field.description = ''
      field.read_only = false
    }
    
    // Ensure field is always visible
    field.hidden = false
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
  
  // Special case: donor desk field should always be visible
  if (field.fieldname === 'donor_desk') {
    return true
  }
  
  return (
    (field.fieldtype == 'Check' ||
      field.read_only ||
      !field.read_only) &&
    (!field.depends_on || field.display_via_depends_on) &&
    !field.hidden
  )
}

const getPlaceholder = (field) => {
  if (field.placeholder) {
    // Handle computed placeholders
    if (typeof field.placeholder === 'function') {
      return __(field.placeholder())
    }
    return __(field.placeholder)
  }
  if (['Select', 'Link'].includes(field.fieldtype)) {
    return __('Select {0}', [__(field.label)])
  } else {
    return __('Enter {0}', [__(field.label)])
  }
}

const getDescription = (field) => {
  if (field.description) {
    // Handle computed descriptions
    if (typeof field.description === 'function') {
      return __(field.description())
    }
    return __(field.description)
  }
  return ''
}

function fieldChange(value, df) {
  // CRITICAL FIX: Always update the data first
  data.value[df.fieldname] = value
  
  // Emit field change to parent component
  const onFieldChange = inject('onFieldChange')
  if (onFieldChange) {
    onFieldChange(df.fieldname, value)
  }
  
  if (isGridRow) {
    triggerOnChange(df.fieldname, value, data.value)
  } else {
    // Add fallback for when triggerOnChange is not available
    if (triggerOnChange) {
      triggerOnChange(df.fieldname, value)
    } else {
      // Fallback: directly update the data and force reactivity
      
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
    let options = []
    
    // Handle computed options
    if (field.options && typeof field.options === 'function') {
      options = field.options() || []
    } else if (typeof field.options === 'string') {
      // Split by newlines and create option objects
      options = field.options.split('\n').map(option => ({
        label: option,
        value: option
      }))
    } else if (Array.isArray(field.options)) {
      // If already an array, ensure proper format
      options = field.options.map(option => {
        if (typeof option === 'string') {
          return { label: option, value: option }
        }
        return option
      })
    } else {
      options = field.options || []
    }
    
    // Special handling for donor desk field - return empty array when no options
    if (field.fieldname === 'donor_desk' && (!options || options.length === 0)) {
      return []
    }
    
    // For other fields, if no options available, show "No results found" message
    if (!options || options.length === 0) {
      return [{
        label: 'No results found',
        value: '',
        disabled: true
      }]
    }
    
    return options
  }
  return field.options || []
}

function getFieldFilters(field) {
  // Apply filter to link_doctype field in links/timeline_links child tables
  // Only allow Donor, CRM Lead, Contact doctypes
  if ((parentFieldname === 'links' || parentFieldname === 'timeline_links')
    && field.fieldname === 'link_doctype'
    && field.fieldtype === 'Link'
    && field.options === 'DocType') {
    return { name: ['in', ['Donor', 'CRM Lead', 'Contact']] }
  }
  
  // Return existing filters if available
  if (field.filters) {
    return field.filters
  }
  
  // Parse link_filters if available
  if (field.link_filters) {
    try {
      const parsedFilters = JSON.parse(field.link_filters)
      return parsedFilters
    } catch (e) {
      return {}
    }
  }
  
  return {}
}

// Function to get donor filtering from data
function getDonorFilteringFromData() {
  if (data.value) {
    const donorFiltering = {
      donor_identity: data.value.donor_identity,
      currency: data.value.currency
    }
    
    return donorFiltering
  }
  
  return {}
}

function onAttachSuccess(file, df) {
  const fileUrl = file?.file_url || file?.name || ''
  fieldChange(fileUrl, df)
}

</script>
<style scoped>
:deep(.form-control.prefix select) {
  padding-left: 2rem;
}

/* Style for disabled options in select dropdowns */
:deep(select option[disabled]) {
  color: #6b7280;
  font-style: italic;
  background-color: #f3f4f6;
}

/* Style for "No records found" message */
:deep(select option[value=""][disabled]) {
  color: #9ca3af;
  font-style: italic;
  background-color: #f9fafb;
}

/* Ensure placeholder text is visible when no value is selected */
:deep(select:invalid) {
  color: #6b7280;
}

/* Style for empty select fields */
:deep(select:not([size]) option:first-child:empty) {
  display: none;
}
</style>
