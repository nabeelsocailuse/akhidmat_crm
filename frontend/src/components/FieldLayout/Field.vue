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
        !['Int', 'Float', 'Currency', 'Percent', 'Check', 'Attach', 'Attach Image', 'Table'].includes(
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
      :readOnly="Boolean(field.read_only)"
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
        :disabled="Boolean(field.read_only)"
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
      :disabled="Boolean(field.read_only)"
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
      :disabled="Boolean(field.read_only)"
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
        <Button 
          v-if="!field.read_only"
          size="sm" 
          variant="subtle" 
          @click.stop="() => fieldChange('', field)"
        >
          {{ __('Clear') }}
        </Button>
      </div>
      <div v-else-if="!field.read_only" class="w-full">
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
      :class="getFieldClasses(field)"
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
import { useDonorFieldValidation } from '@/composables/useDonorFieldValidation'

const props = defineProps({
  field: Object,
})

const data = inject('data')
const doctype = inject('doctype')
const preview = inject('preview')
const isGridRow = inject('isGridRow')
const parentFieldname = inject('parentFieldname')
const readOnly = inject('readOnly', false)

const { getFormattedPercent, getFormattedFloat, getFormattedCurrency } =
  getMeta(doctype)

const { users, getUser } = usersStore()

// Initialize masking utilities
const {
  applyCnicMaskToInput,
  validateCnicFormat,
  applyPhoneMasksForCountry,
  validatePhoneNumber,
  showPhoneValidationFeedback,
} = useDonorFieldValidation()

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
  
  // Apply global read-only state from FieldLayout
  // Handle both ref and non-ref cases
  const isReadOnly = readOnly?.value !== undefined ? readOnly.value : readOnly
  if (isReadOnly) {
    field = { ...field, read_only: true }
  }

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

  // Force specific fields to be read-only for Tax Exemption Certificate across UI
  if (doctype === 'Tax Exemption Certificate' && ['donor_name', 'donor_cnic__ntn', 'donor_address'].includes(field.fieldname)) {
    field.read_only = true
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

  // Custom visibility rule for Donation returns: hide Return Against unless status is 'Return' and is_return is enabled
  if (doctype === 'Donation') {
    const fieldnameLower = (field.fieldname || '').toLowerCase()
    const isReturnAgainstField = ['return_against'].includes(fieldnameLower)
    if (isReturnAgainstField) {
      const isReturnChecked = data.value?.is_return === 1 || data.value?.is_return === true || data.value?.is_return === '1'
      const shouldShow =  isReturnChecked
      if (!shouldShow) {
        field.hidden = true
      }
    }

    // Enforce read-only for posting_date and posting_time based on edit_posting_date_time
    const allowEditDateTime = data.value?.edit_posting_date_time === 1 || data.value?.edit_posting_date_time === true || data.value?.edit_posting_date_time === '1'
    if (fieldnameLower === 'posting_date') {
      field.fieldtype = 'Date'
      field.read_only = !allowEditDateTime
    }
    if (fieldnameLower === 'posting_time') {
      field.fieldtype = 'Time'
      field.read_only = !allowEditDateTime
    }
    if (fieldnameLower === 'edit_posting_date_time') {
      field.fieldtype = 'Check'
      if (typeof data.value?.edit_posting_date_time === 'undefined') {
        // Initialize default to unchecked
        if (data.value) data.value.edit_posting_date_time = 0
      }
    }
  }

  // Configure warehouse field with filters for donation form
  if (field.fieldname === 'warehouse' 
    && field.fieldtype === 'Link' 
    && field.options === 'Warehouse'
    && doctype === 'Donation') {
    // Apply warehouse-specific filters
    field.filters = {
      is_group: 0,
      is_rejected_warehouse: 0,
      company: data.value?.company || 'Alkhidmat Foundation'
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

// Add emit definition at the top
const emit = defineEmits(['field-change'])

function fieldChange(value, df) {
  
  // CRITICAL FIX: Always update the data first
  data.value[df.fieldname] = value
  
  // Emit field change to parent component
  const onFieldChange = inject('onFieldChange', null)
  
  if (onFieldChange) {
    onFieldChange(df.fieldname, value)
  } else {
    // Fallback: emit directly to parent
    emit('field-change', df.fieldname, value)
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
  
  // Apply warehouse-specific filters for donation form
  if (field.fieldname === 'warehouse' 
    && field.fieldtype === 'Link' 
    && field.options === 'Warehouse'
    && doctype === 'Donation') {
    return {
      is_group: 0,
      is_rejected_warehouse: 0,
      company: data.value?.company || 'Alkhidmat Foundation'
    }
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

// Helper function to set field value for masking
function setFieldValue(fieldName, value) {
  if (data.value) {
    data.value[fieldName] = value
  }
}

// Get field classes for validation feedback
function getFieldClasses(field) {
  const classes = []
  
  // Add validation classes for specific fields (Lead and Donor)
  if (field.fieldname === 'custom_identification_value' || field.fieldname === 'cnic' ||
      field.fieldname === 'mobile_no' || field.fieldname === 'contact_no' ||
      field.fieldname === 'co_contact_no' || field.fieldname === 'company_contact_number' ||
      field.fieldname === 'organization_contact_person' || field.fieldname === 'representative_mobile' ||
      field.fieldname === 'phone_no' || field.fieldname === 'company_ownerceo_conatct' ||
      field.fieldname === 'org_representative_contact_number' || field.fieldname === 'org_contact') {
    // These will be set by the validation feedback functions
    classes.push('validation-field')
  }
  
  return classes.join(' ')
}

// Watch for identification type changes to apply CNIC masking (Lead and Donor)
watch(() => data.value?.custom_identification_type, (newType, oldType) => {
  if (newType && newType !== oldType && field.value?.fieldname === 'custom_identification_value') {
    if (data.value) {
      data.value.custom_identification_value = ''
    }
    nextTick(() => {
      applyCnicMaskToInput('custom_identification_value', newType, setFieldValue)
    })
  }
})

// Watch for identification type changes to apply CNIC masking (Donor)
watch(() => data.value?.identification_type, (newType, oldType) => {
  if (newType && newType !== oldType && field.value?.fieldname === 'cnic') {
    if (data.value) {
      data.value.cnic = ''
    }
    nextTick(() => {
      applyCnicMaskToInput('cnic', newType, setFieldValue)
    })
  }
})

// Watch for identification value changes to reapply masking (Lead)
watch(() => data.value?.custom_identification_value, (newValue, oldValue) => {
  if (newValue && newValue !== oldValue && 
      field.value?.fieldname === 'custom_identification_value' && 
      data.value?.custom_identification_type) {
    nextTick(() => {
      applyCnicMaskToInput('custom_identification_value', data.value.custom_identification_type, setFieldValue)
    })
  }
})

// Watch for CNIC value changes to reapply masking (Donor)
watch(() => data.value?.cnic, (newValue, oldValue) => {
  if (newValue && newValue !== oldValue && 
      field.value?.fieldname === 'cnic' && 
      data.value?.identification_type) {
    nextTick(() => {
      applyCnicMaskToInput('cnic', data.value.identification_type, setFieldValue)
    })
  }
})

// Watch for country changes to apply phone masking (Lead and Donor)
watch(() => data.value?.country, (newCountry, oldCountry) => {
  if (newCountry && newCountry !== oldCountry && 
      (field.value?.fieldname === 'mobile_no' || field.value?.fieldname === 'contact_no' ||
       field.value?.fieldname === 'co_contact_no' || field.value?.fieldname === 'company_contact_number' ||
       field.value?.fieldname === 'organization_contact_person' || field.value?.fieldname === 'representative_mobile' ||
       field.value?.fieldname === 'phone_no' || field.value?.fieldname === 'company_ownerceo_conatct')) {
    if (data.value) {
      data.value[field.value.fieldname] = ''
    }
    setTimeout(() => {
      applyPhoneMasksForCountry(newCountry, setFieldValue, [field.value.fieldname])
    }, 300)
  }
})

// Watch for orgs_country changes to apply phone masking (Donor organization fields)
watch(() => data.value?.orgs_country, (newCountry, oldCountry) => {
  if (newCountry && newCountry !== oldCountry && 
      (field.value?.fieldname === 'org_representative_contact_number' || field.value?.fieldname === 'org_contact')) {
    if (data.value) {
      data.value[field.value.fieldname] = ''
    }
    setTimeout(() => {
      applyPhoneMasksForCountry(newCountry, setFieldValue, [field.value.fieldname])
    }, 300)
  }
})

// Watch for phone number changes to validate (Lead and Donor)
watch(() => data.value?.mobile_no, async (newValue) => {
  if (newValue && data.value?.country && field.value?.fieldname === 'mobile_no') {
    const validation = await validatePhoneNumber(newValue, data.value.country)
    if (!validation.isValid) {
      showPhoneValidationFeedback('mobile_no', false, validation.message)
    } else {
      showPhoneValidationFeedback('mobile_no', true, '')
    }
  }
})

watch(() => data.value?.contact_no, async (newValue) => {
  if (newValue && data.value?.country && field.value?.fieldname === 'contact_no') {
    const validation = await validatePhoneNumber(newValue, data.value.country)
    if (!validation.isValid) {
      showPhoneValidationFeedback('contact_no', false, validation.message)
    } else {
      showPhoneValidationFeedback('contact_no', true, '')
    }
  }
})

// Watch for donor phone fields validation
watch(() => data.value?.co_contact_no, async (newValue) => {
  if (newValue && data.value?.country && field.value?.fieldname === 'co_contact_no') {
    const validation = await validatePhoneNumber(newValue, data.value.country)
    if (!validation.isValid) {
      showPhoneValidationFeedback('co_contact_no', false, validation.message)
    } else {
      showPhoneValidationFeedback('co_contact_no', true, '')
    }
  }
})

watch(() => data.value?.company_contact_number, async (newValue) => {
  if (newValue && data.value?.country && field.value?.fieldname === 'company_contact_number') {
    const validation = await validatePhoneNumber(newValue, data.value.country)
    if (!validation.isValid) {
      showPhoneValidationFeedback('company_contact_number', false, validation.message)
    } else {
      showPhoneValidationFeedback('company_contact_number', true, '')
    }
  }
})

watch(() => data.value?.organization_contact_person, async (newValue) => {
  if (newValue && data.value?.country && field.value?.fieldname === 'organization_contact_person') {
    const validation = await validatePhoneNumber(newValue, data.value.country)
    if (!validation.isValid) {
      showPhoneValidationFeedback('organization_contact_person', false, validation.message)
    } else {
      showPhoneValidationFeedback('organization_contact_person', true, '')
    }
  }
})

watch(() => data.value?.representative_mobile, async (newValue) => {
  if (newValue && data.value?.country && field.value?.fieldname === 'representative_mobile') {
    const validation = await validatePhoneNumber(newValue, data.value.country)
    if (!validation.isValid) {
      showPhoneValidationFeedback('representative_mobile', false, validation.message)
    } else {
      showPhoneValidationFeedback('representative_mobile', true, '')
    }
  }
})

watch(() => data.value?.phone_no, async (newValue) => {
  if (newValue && data.value?.country && field.value?.fieldname === 'phone_no') {
    const validation = await validatePhoneNumber(newValue, data.value.country)
    if (!validation.isValid) {
      showPhoneValidationFeedback('phone_no', false, validation.message)
    } else {
      showPhoneValidationFeedback('phone_no', true, '')
    }
  }
})

watch(() => data.value?.company_ownerceo_conatct, async (newValue) => {
  if (newValue && data.value?.country && field.value?.fieldname === 'company_ownerceo_conatct') {
    const validation = await validatePhoneNumber(newValue, data.value.country)
    if (!validation.isValid) {
      showPhoneValidationFeedback('company_ownerceo_conatct', false, validation.message)
    } else {
      showPhoneValidationFeedback('company_ownerceo_conatct', true, '')
    }
  }
})

// Watch for organization phone fields validation
watch(() => data.value?.org_representative_contact_number, async (newValue) => {
  if (newValue && data.value?.orgs_country && field.value?.fieldname === 'org_representative_contact_number') {
    const validation = await validatePhoneNumber(newValue, data.value.orgs_country)
    if (!validation.isValid) {
      showPhoneValidationFeedback('org_representative_contact_number', false, validation.message)
    } else {
      showPhoneValidationFeedback('org_representative_contact_number', true, '')
    }
  }
})

watch(() => data.value?.org_contact, async (newValue) => {
  if (newValue && data.value?.orgs_country && field.value?.fieldname === 'org_contact') {
    const validation = await validatePhoneNumber(newValue, data.value.orgs_country)
    if (!validation.isValid) {
      showPhoneValidationFeedback('org_contact', false, validation.message)
    } else {
      showPhoneValidationFeedback('org_contact', true, '')
    }
  }
})

// Initialize masks when component mounts
onMounted(() => {
  nextTick(() => {
    // Apply CNIC mask for Lead fields
    if (field.value?.fieldname === 'custom_identification_value' && 
        data.value?.custom_identification_type) {
      setTimeout(() => {
        applyCnicMaskToInput('custom_identification_value', data.value.custom_identification_type, setFieldValue)
      }, 500)
    }
    
    // Apply CNIC mask for Donor fields
    if (field.value?.fieldname === 'cnic' && 
        data.value?.identification_type) {
      setTimeout(() => {
        applyCnicMaskToInput('cnic', data.value.identification_type, setFieldValue)
      }, 500)
    }
    
    // Apply phone mask for Lead and Donor fields
    if ((field.value?.fieldname === 'mobile_no' || field.value?.fieldname === 'contact_no' ||
         field.value?.fieldname === 'co_contact_no' || field.value?.fieldname === 'company_contact_number' ||
         field.value?.fieldname === 'organization_contact_person' || field.value?.fieldname === 'representative_mobile' ||
         field.value?.fieldname === 'phone_no' || field.value?.fieldname === 'company_ownerceo_conatct') && 
        data.value?.country) {
      setTimeout(() => {
        applyPhoneMasksForCountry(data.value.country, setFieldValue, [field.value.fieldname])
      }, 500)
    }
    
    // Apply phone mask for Donor organization fields
    if ((field.value?.fieldname === 'org_representative_contact_number' || field.value?.fieldname === 'org_contact') && 
        data.value?.orgs_country) {
      setTimeout(() => {
        applyPhoneMasksForCountry(data.value.orgs_country, setFieldValue, [field.value.fieldname])
      }, 500)
    }
  })
})

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
