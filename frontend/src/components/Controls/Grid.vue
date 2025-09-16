<template>
  <div class="flex flex-col flex-1 text-base">
    <div v-if="label" class="mb-1.5 text-sm text-ink-gray-5">
      {{ __(label) }}
    </div>

    <div
      v-if="fields?.length"
      class="rounded border border-outline-gray-modals"
    >
      <!-- Header -->
      <div
        class="grid-header flex items-center rounded-t-[7px] bg-surface-gray-2 text-ink-gray-5 truncate"
      >
        <div
          class="inline-flex items-center justify-center border-r border-outline-gray-2 h-8 p-2 w-12"
        >
          <Checkbox
            class="cursor-pointer duration-300"
            :modelValue="allRowsSelected"
            @click.stop="toggleSelectAllRows($event.target.checked)"
          />
        </div>
        <div
          class="inline-flex items-center justify-center border-r border-outline-gray-2 py-2 px-1 w-12"
        >
          {{ __('No') }}
        </div>
        <div
          class="grid w-full truncate"
          :style="{ gridTemplateColumns: gridTemplateColumns }"
        >
          <div
            v-for="field in fields"
            class="border-r border-outline-gray-2 p-2 truncate"
            :class="
              ['Int', 'Float', 'Currency', 'Percent'].includes(field.fieldtype)
                ? 'text-right'
                : ''
            "
            :key="field.fieldname"
            :title="field.label"
          >
            {{ __(field.label) }}
            <span
              v-if="
                field.reqd ||
                (field.mandatory_depends_on && field.mandatory_via_depends_on)
              "
              class="text-ink-red-2"
              >*</span>
          </div>
        </div>
        <div class="w-12">
          <Button
            class="flex w-full items-center justify-center rounded !bg-surface-gray-2 border-0"
            variant="outline"
            @click="showGridFieldsEditorModal = true"
          >
            <template #icon>
              <FeatherIcon name="settings" class="size-4 text-ink-gray-7" />
            </template>
          </Button>
        </div>
      </div>
      <!-- Rows -->
      <template v-if="rows?.length">
        <Draggable
          class="w-full"
          v-model="rows"
          :delay="isTouchScreenDevice() ? 200 : 0"
          group="rows"
          item-key="name"
        >
          <template #item="{ element: row, index }">
            <div
              class="grid-row flex cursor-pointer items-center border-b border-outline-gray-modals bg-surface-modals last:rounded-b last:border-b-0"
              @click.stop="
                () => {
                  if (!gridSettings.editable_grid) {
                    showRowList[index] = true
                  }
                }
              "
            >
              <div
                class="grid-row-checkbox inline-flex h-9.5 items-center bg-surface-white justify-center border-r border-outline-gray-modals p-2 w-12"
              >
                <Checkbox
                  class="cursor-pointer duration-300"
                  :modelValue="selectedRows.has(row.name)"
                  @click.stop="toggleSelectRow(row)"
                />
              </div>
              <div
                class="flex h-9.5 items-center justify-center bg-surface-white border-r border-outline-gray-modals py-2 px-1 text-sm text-ink-gray-8 w-12"
              >
                {{ index + 1 }}
              </div>
              <div
                class="grid w-full h-9.5"
                :style="{ gridTemplateColumns: gridTemplateColumns }"
              >
                <div
                  class="border-r border-outline-gray-modals h-full"
                  v-for="field in fields"
                  :key="field.fieldname"
                >
                  <FormControl
                    v-if="
                      field.read_only &&
                      ![
                        'Int',
                        'Float',
                        'Currency',
                        'Percent',
                        'Check',
                        'Attach',
                        'Attach Image',
                      ].includes(field.fieldtype)
                    "
                    type="text"
                    :placeholder="field.placeholder"
                    v-model="row[field.fieldname]"
                    :disabled="true"
                  />
                  <Link
                    v-else-if="
                      ['Link', 'Dynamic Link'].includes(field.fieldtype)
                    "
                    class="text-sm text-ink-gray-8"
                    :value="row[field.fieldname]"
                    :doctype="
                      field.fieldtype == 'Link'
                        ? field.options
                        : row[field.options]
                    "
                    :filters="field.filters"
                    @change="(v) => fieldChange(v, field, row)"
                    :onCreate="
                      (value, close) => field.create(v, field, row, close)
                    "
                  />
                  <Link
                    v-else-if="field.fieldtype === 'User'"
                    class="form-control"
                    :value="getUser(row[field.fieldname]).full_name"
                    :doctype="field.options"
                    :filters="field.filters"
                    @change="(v) => fieldChange(v, field, row)"
                    :placeholder="field.placeholder"
                    :hideMe="true"
                  >
                    <template #prefix>
                      <UserAvatar
                        class="mr-2"
                        :user="row[field.fieldname]"
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
                  <div 
                    v-else-if="field.fieldtype === 'Attach' || field.fieldtype === 'Attach Image' || (field.fieldtype === 'Data' && field.options === 'Attach')" 
                    class="flex h-full bg-surface-white items-center px-2"
                  >
                    <div v-if="row[field.fieldname]" class="flex items-center gap-2 w-full">
                      <a :href="row[field.fieldname]" target="_blank" rel="noopener" class="truncate text-ink-blue-6 underline">
                        {{ row[field.fieldname] }}
                      </a>
                      <Button size="sm" variant="subtle" @click.stop="() => { row[field.fieldname] = ''; forceReactiveUpdate(); triggerOnChange(field.fieldname, '', row) }">{{ __('Clear') }}</Button>
                    </div>
                    <div v-else class="w-full">
                      <FileUploader @success="(file) => onAttachSuccess(file, field, row)">
                        <template #default>
                          <Button variant="outline" class="w-full justify-center">{{ __('Attach') }}</Button>
                        </template>
                      </FileUploader>
                    </div>
                  </div>
                  <div
                    v-else-if="field.fieldtype === 'Check'"
                    class="flex h-full bg-surface-white justify-center items-center"
                  >
                    <Checkbox
                      class="cursor-pointer duration-300"
                      v-model="row[field.fieldname]"
                      :disabled="!gridSettings.editable_grid"
                      @change="(e) => fieldChange(e.target.checked, field, row)"
                    />
                  </div>
                  <DatePicker
                    v-else-if="field.fieldtype === 'Date'"
                    :value="row[field.fieldname]"
                    icon-left=""
                    variant="outline"
                    :formatter="(date) => getFormat(date, '', true)"
                    input-class="border-none text-sm text-ink-gray-8"
                    @change="(v) => fieldChange(v, field, row)"
                  />
                  <DateTimePicker
                    v-else-if="field.fieldtype === 'Datetime'"
                    :value="row[field.fieldname]"
                    icon-left=""
                    variant="outline"
                    :formatter="(date) => getFormat(date, '', true, true)"
                    input-class="border-none text-sm text-ink-gray-8"
                    @change="(v) => fieldChange(v, field, row)"
                  />
                  <FormControl
                    v-else-if="
                      ['Small Text', 'Text', 'Long Text', 'Code'].includes(
                        field.fieldtype,
                      )
                    "
                    rows="1"
                    type="textarea"
                    variant="outline"
                    :value="row[field.fieldname]"
                    @change="fieldChange($event.target.value, field, row)"
                  />
                  <FormControl
                    v-else-if="field.fieldtype === 'Select'"
                    class="text-sm text-ink-gray-8"
                    type="select"
                    variant="outline"
                    v-model="row[field.fieldname]"
                    :options="field.options"
                    @change="(e) => fieldChange(e.target.value, field, row)"
                  />
                  <Password
                    v-else-if="field.fieldtype === 'Password'"
                    variant="outline"
                    :value="row[field.fieldname]"
                    :disabled="Boolean(field.read_only)"
                    @change="fieldChange($event.target.value, field, row)"
                  />
                  <FormattedInput
                    v-else-if="field.fieldtype === 'Int'"
                    class="[&_input]:text-right"
                    type="text"
                    variant="outline"
                    :value="row[field.fieldname] || '0'"
                    :disabled="Boolean(field.read_only)"
                    @change="fieldChange($event.target.value, field, row)"
                  />
                  <FormattedInput
                    v-else-if="field.fieldtype === 'Percent'"
                    class="[&_input]:text-right"
                    type="text"
                    variant="outline"
                    :value="getFloatWithPrecision(field.fieldname, row)"
                    :formattedValue="(row[field.fieldname] || '0') + '%'"
                    :disabled="Boolean(field.read_only)"
                    @change="fieldChange(flt($event.target.value), field, row)"
                  />
                  <FormattedInput
                    v-else-if="field.fieldtype === 'Float'"
                    class="[&_input]:text-right"
                    type="text"
                    variant="outline"
                    :value="getFloatWithPrecision(field.fieldname, row)"
                    :formattedValue="row[field.fieldname]"
                    :disabled="Boolean(field.read_only)"
                    @change="fieldChange(flt($event.target.value), field, row)"
                  />
                  <FormattedInput
                    v-else-if="field.fieldtype === 'Currency'"
                    class="[&_input]:text-right"
                    type="text"
                    variant="outline"
                    :value="getCurrencyWithPrecision(field.fieldname, row)"
                    :formattedValue="
                      getFormattedCurrency(field.fieldname, row, parentDoc)
                    "
                    :disabled="Boolean(field.read_only)"
                    @change="fieldChange(flt($event.target.value), field, row)"
                  />
                  <FormControl
                    v-else
                    class="text-sm text-ink-gray-8"
                    type="text"
                    variant="outline"
                    v-model="row[field.fieldname]"
                    :options="field.options"
                    @change="fieldChange($event.target.value, field, row)"
                  />
                </div>
              </div>
              <div class="edit-row w-12">
                <Button
                  class="flex w-full items-center justify-center rounded border-0"
                  variant="outline"
                  @click="showRowList[index] = true"
                >
                  <template #icon>
                    <EditIcon class="text-ink-gray-7" />
                  </template>
                </Button>
              </div>
              <GridRowModal
                v-if="showRowList[index]"
                v-model="showRowList[index]"
                v-model:showGridRowFieldsModal="showGridRowFieldsModal"
                :index="index"
                :data="row"
                :doctype="doctype"
                :parentDoctype="parentDoctype"
                :parentFieldname="parentFieldname"
                :donorFiltering="getDonorFilteringFromParent()"
              />
            </div>
          </template>
        </Draggable>
      </template>

      <div
        v-else
        class="flex flex-col items-center rounded p-5 text-sm text-ink-gray-5"
      >
        {{ __('No Data') }}
      </div>
    </div>

    <div v-if="fields?.length" class="mt-2 flex flex-row gap-2">
      <Button
        v-if="showDeleteBtn"
        :label="__('Delete')"
        variant="solid"
        theme="red"
        @click="deleteRows"
      />
      <Button :label="__('Add Row')" @click="addRow" />
    </div>
    <GridRowFieldsModal
      v-if="showGridRowFieldsModal"
      v-model="showGridRowFieldsModal"
      :doctype="doctype"
      :parentDoctype="parentDoctype"
    />
    <GridFieldsEditorModal
      v-if="showGridFieldsEditorModal"
      v-model="showGridFieldsEditorModal"
      :doctype="doctype"
      :parentDoctype="parentDoctype"
    />
  </div>
</template>

<script setup>
import Password from '@/components/Controls/Password.vue'
import FormattedInput from '@/components/Controls/FormattedInput.vue'
import GridFieldsEditorModal from '@/components/Controls/GridFieldsEditorModal.vue'
import GridRowFieldsModal from '@/components/Controls/GridRowFieldsModal.vue'
import GridRowModal from '@/components/Controls/GridRowModal.vue'
import EditIcon from '@/components/Icons/EditIcon.vue'
import Link from '@/components/Controls/Link.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import { getRandom, getFormat, isTouchScreenDevice } from '@/utils'
import { flt } from '@/utils/numberFormat.js'
import { usersStore } from '@/stores/users'
import { getMeta } from '@/stores/meta'
import { createDocument } from '@/composables/document'
import {
  FeatherIcon,
  FormControl,
  Checkbox,
  DateTimePicker,
  DatePicker,
  Tooltip,
  dayjs,
  call,
  toast,
  FileUploader,
} from 'frappe-ui'
import Draggable from 'vuedraggable'
import { ref, reactive, computed, inject, provide, watch, nextTick, onMounted, getCurrentInstance } from 'vue'
import { useDonorSelection } from '@/composables/useDonorSelection'

const props = defineProps({
  label: {
    type: String,
    default: '',
  },
  doctype: {
    type: String,
    required: true,
  },
  parentDoctype: {
    type: String,
    required: true,
  },
  parentFieldname: {
    type: String,
    required: true,
  },
})

const triggerOnChange = inject('triggerOnChange', () => {})
const triggerOnRowAdd = inject('triggerOnRowAdd', () => {})
const triggerOnRowRemove = inject('triggerOnRowRemove', () => {})

const {
  getGridViewSettings,
  getFields,
  getFloatWithPrecision,
  getCurrencyWithPrecision,
  getFormattedCurrency,
  getGridSettings,
} = getMeta(props.doctype)
getMeta(props.parentDoctype)
const { users, getUser } = usersStore()

const rows = defineModel()
const parentDoc = defineModel('parent')

const initializeRows = () => {
  if (!rows.value) {
    rows.value = []
  }
}

initializeRows()

watch(rows, (newRows) => {
  if (!newRows) {
    rows.value = []
  }
}, { immediate: true })

provide('parentDoc', parentDoc)

const showRowList = ref(new Array(rows.value?.length || []).fill(false))
const selectedRows = reactive(new Set())

const showGridFieldsEditorModal = ref(false)
const showGridRowFieldsModal = ref(false)

const gridSettings = computed(() => getGridSettings())

const fields = computed(() => {
  let gridViewSettings = getGridViewSettings(props.parentDoctype)
  let gridFields = getFields()
  if (gridViewSettings.length) {
    let d = gridViewSettings.map((gs) =>
      getFieldObj(gridFields.find((f) => f.fieldname === gs.fieldname)),
    )
    return d
  }
  return (
    gridFields?.filter((f) => f.in_list_view).map((f) => getFieldObj(f)) || []
  )
})

// Debug: Log fields for deduction breakeven table
if (props.parentFieldname === 'deduction_breakeven') {
  console.log('=== DEDUCTION BREAKEVEN FIELDS ===')
  console.log('Grid view settings:', getGridViewSettings(props.parentDoctype))
  console.log('All fields:', getFields())
  console.log('Computed fields:', fields.value)
}

const allFields = computed(() => {
  const base = getFields()?.map((f) => getFieldObj(f)) || []
  // Guarantee Transaction Attachment appears in the editor even if hidden/filtered in meta
  const hasTxnAttach = base.some((f) => f.fieldname === 'transaction_attachment')
  if (!hasTxnAttach) {
    base.push(
      getFieldObj({
        fieldname: 'transaction_attachment',
        label: 'Transaction Attachment',
        fieldtype: 'Attach Image',
        options: 'Attach',
        in_list_view: false,
      })
    )
  }
  return base
})

// ADD: Force refresh of Link components when filters change
watch(
  () => fields.value,
  (newFields) => {
    if (newFields) {
      newFields.forEach(field => {
        if (field.fieldname === 'donor_id' && field.options === 'Donor') {
          console.log('Grid - donor_id field detected, ensuring proper filtering:', {
            fieldname: field.fieldname,
            filters: field.filters,
            hasGetQuery: !!field.get_query
          })
        }
      })
    }
  },
  { deep: true }
)

// ADD: Force refresh when parent document changes
watch(
  () => parentDoc.value,
  (newParentDoc) => {
    if (newParentDoc) {
      console.log('Grid - Parent document changed, forcing field refresh')
      
      // Force a reactive update
      nextTick(() => {
        // This will trigger the fields computed property to recalculate
        console.log('Grid - Parent document change triggered field refresh')
      })
    }
  },
  { deep: true }
)

// ADD: Watch for company changes in parent document to refresh deduction fields
watch(
  () => parentDoc.value?.company,
  (newCompany, oldCompany) => {
    if (newCompany && newCompany !== oldCompany && props.parentFieldname === 'deduction_breakeven') {
      console.log('Company changed in parent document, refreshing deduction fields')
      
      // Refresh deduction fields for all rows that have fund_class selected
      if (rows.value && Array.isArray(rows.value)) {
        let refreshCount = 0
        rows.value.forEach(async (row) => {
          if (row.fund_class) {
            console.log('Refreshing deduction fields for row with fund_class:', row.fund_class)
            try {
              // Company is no longer required, only fund class ID
              const deductionDetails = await fetchDeductionDetails(row.fund_class)
              if (deductionDetails && Object.keys(deductionDetails).length > 0) {
                updateDeductionFields(row, deductionDetails)
                refreshCount++
              } else {
                // Clear fields when no deduction details found
                clearDeductionFields(row)
              }
            } catch (error) {
              console.error('Error refreshing deduction fields for row:', error)
              // Clear fields on error
              clearDeductionFields(row)
            }
          }
        })
        
        // Force reactive update
        forceReactiveUpdate()
        
        // Show user feedback
        if (refreshCount > 0) {
          toast.success(`Refreshed deduction fields for ${refreshCount} row(s)`)
        }
      }
    }
  }
)

// Debug: Watch for any changes in the deduction breakeven table
if (props.parentFieldname === 'deduction_breakeven') {
  watch(
    () => rows.value,
    (newRows) => {
      console.log('=== DEDUCTION BREAKEVEN ROWS CHANGED ===')
      console.log('New rows:', newRows)
      console.log('Rows length:', newRows?.length)
      if (newRows && Array.isArray(newRows)) {
        newRows.forEach((row, index) => {
          console.log(`Row ${index}:`, row)
        })
      }
    },
    { deep: true }
  )
  
  // Test API accessibility when component mounts
  onMounted(async () => {
    console.log('=== TESTING API ACCESSIBILITY ===')
    try {
      const testResult = await call('crm.fcrm.doctype.donation.api.test_api')
      console.log('Test API result:', testResult)
      
      // Also test the deduction details API directly
      console.log('=== TESTING DEDUCTION DETAILS API ===')
      try {
        const deductionResult = await call('crm.fcrm.doctype.donation.api.get_deduction_details', {
          fund_class: 'AKFP'
        })
        console.log('Deduction details test result:', deductionResult)
      } catch (deductionError) {
        console.error('Deduction details test error:', deductionError)
      }
    } catch (error) {
      console.error('Test API error:', error)
    }
  })
}

// ADD: Watch for donation_amount changes in deduction_breakeven rows to recalculate amounts
watch(
  () => rows.value,
  (newRows) => {
    if (newRows && Array.isArray(newRows) && props.parentFieldname === 'deduction_breakeven') {
      newRows.forEach((row) => {
        if (row.donation_amount && row.percentage) {
          // Watch for changes in donation_amount or percentage
          watch(
            () => [row.donation_amount, row.percentage],
            () => {
              if (row.donation_amount && row.percentage) {
                calculateDeductionAmount(row)
              }
            },
            { immediate: false }
          )
        }
      })
    }
  },
  { deep: true }
)

// ADD: Watch for parent document changes to sync donation amount
watch(
  () => [parentDoc.value?.donation_amount, parentDoc.value?.payment_detail],
  () => {
    if (props.parentFieldname === 'deduction_breakeven') {
      syncDonationAmount()
    }
  },
  { deep: true }
)

// ADD: Enhanced setQueryForField function specifically for donor_id
function setQueryForField(field, parentDoc) {
  console.log('Grid setQueryForField called for:', field.fieldname, 'with parent doc:', parentDoc)
  
  if (field.fieldname === 'donor_id' && field.options === 'Donor') {
    let filters = {
      status: "Active"
    }
    
    if (parentDoc?.currency) {
      filters.default_currency = parentDoc.currency
      console.log('Grid setQueryForField - Added currency filter:', parentDoc.currency)
    }
    
    if (parentDoc?.donor_identity && parentDoc.donor_identity.trim() !== '') {
      filters.donor_identity = parentDoc.donor_identity
      console.log('Grid setQueryForField - Added donor_identity filter:', parentDoc.donor_identity)
    }
    
    // CRITICAL: Set both filters and get_query
    field.filters = filters
    field.get_query = () => ({ filters })
    
    console.log('Grid setQueryForField - Final donor_id configuration:', {
      fieldname: field.fieldname,
      filters: field.filters,
      hasGetQuery: !!field.get_query,
      getQueryResult: field.get_query()
    })
  }
  
  return field
}

function getFieldObj(field) {
  if (field.fieldtype === 'Link' && field.options !== 'User') {
    if (!field.create) {
      field.create = (value, field, row, close) => {
        const callback = (d) => {
          if (d) fieldChange(d.name, field, row)
        }
        createDocument(field.options, value, close, callback)
      }
    }
  }

  if (field.fieldtype === 'Link' && field.options === 'User') {
    field.fieldtype = 'User'
    field.link_filters = JSON.stringify({
      ...(field.link_filters ? JSON.parse(field.link_filters) : {}),
      name: ['in', users.data.crmUsers?.map((user) => user.name)],
    })
  }

  setQueryForField(field, parentDoc.value)

  // Force correct control for Transaction Attachment
  if (field.fieldname === 'transaction_attachment') {
    // Ensure it's treated as an attach control in the grid
    field.fieldtype = field.fieldtype === 'Attach' || field.fieldtype === 'Attach Image' ? field.fieldtype : 'Attach Image'
    field.options = field.options || 'Attach'
  }

  // Apply filter to link_doctype field in links/timeline_links child tables
  if ((props.parentFieldname === 'links' || props.parentFieldname === 'timeline_links')
    && field.fieldname === 'link_doctype'
    && field.fieldtype === 'Link'
    && field.options === 'DocType') {
    field.filters = { name: ['in', ['Donor', 'CRM Lead', 'Contact']] }
  }

  const fieldObj = {
    ...field,
    placeholder: field.placeholder || field.label,
  }
  
  if (field.depends_on) {
    fieldObj.display_via_depends_on = true
  }
  
  // CRITICAL: Ensure filters are properly set
  if (field.filters) {
    fieldObj.filters = field.filters
  } else if (field.link_filters) {
    fieldObj.filters = JSON.parse(field.link_filters)
  }
  
  // CRITICAL: Ensure get_query is preserved
  if (field.get_query) {
    fieldObj.get_query = field.get_query
  }
  
  return fieldObj
}

const gridTemplateColumns = computed(() => {
  if (!fields.value?.length) return '1fr'
  // for the checkbox & sr no. columns
  let gridViewSettings = getGridViewSettings(props.parentDoctype)
  if (gridViewSettings.length) {
    return gridViewSettings
      .map((gs) => `minmax(0, ${gs.columns || 2}fr)`)
      .join(' ')
  }
  return fields.value.map(() => `minmax(0, 2fr)`).join(' ')
})

const allRowsSelected = computed(() => {
  if (!rows.value?.length) return false
  return rows.value.length === selectedRows.size
})

const showDeleteBtn = computed(() => selectedRows.size > 0)

const toggleSelectAllRows = (iSelected) => {
  if (iSelected) {
    rows.value?.forEach((row) => selectedRows.add(row.name))
  } else {
    selectedRows.clear()
  }
}

const toggleSelectRow = (row) => {
  if (selectedRows.has(row.name)) {
    selectedRows.delete(row.name)
  } else {
    selectedRows.add(row.name)
  }
}

const addRow = () => {
  // Check if this is deduction_breakeven and contribution_type is Pledge
  if (props.parentFieldname === 'deduction_breakeven') {
    // Get the parent document to check contribution_type
    const parentDoc = props.parentDoc || window.parentDocument
    if (parentDoc && parentDoc.contribution_type === 'Pledge') {
      console.log('Skipped adding deduction_breakeven row - contribution_type is Pledge')
      toast.warning('Deduction Breakeven rows cannot be added when Contribution Type is Pledge')
      return
    }
  }
  
  if (!rows.value) {
    rows.value = []
  }
  
  const newRow = {}
  allFields.value?.forEach((field) => {
    if (field.fieldtype === 'Check') {
      newRow[field.fieldname] = false
    } else {
      newRow[field.fieldname] = ''
    }

    if (field.default) {
      newRow[field.fieldname] = getDefaultValue(field.default, field.fieldtype)
    }
    
    // Set default value for link_doctype field in links/timeline_links child table
    if ((props.parentFieldname === 'links' || props.parentFieldname === 'timeline_links')
      && field.fieldname === 'link_doctype' && field.fieldtype === 'Link' && field.options === 'DocType') {
      newRow[field.fieldname] = 'Donor'
    }
  })
  
  // Generate random ID for deduction breakeven table (similar to payment detail)
  if (props.parentFieldname === 'deduction_breakeven') {
    newRow.random_id = Math.floor((1000 + rows.value.length + 1) + (Math.random() * 9000))
    console.log('=== ADDING DEDUCTION BREAKEVEN ROW ===')
    console.log('New row:', newRow)
    console.log('Parent fieldname:', props.parentFieldname)
  }
  
  newRow.name = getRandom(10)
  showRowList.value.push(false)
  newRow['__islocal'] = true
  newRow['idx'] = rows.value.length + 1
  newRow['doctype'] = props.doctype
  newRow['parentfield'] = props.parentFieldname
  newRow['parenttype'] = props.parentDoctype
  rows.value.push(newRow)
  triggerOnRowAdd(newRow)
}

const deleteRows = () => {
  rows.value = rows.value.filter((row) => !selectedRows.has(row.name))
  triggerOnRowRemove(selectedRows, rows.value)

  showRowList.value.pop()
  selectedRows.clear()
}

const emit = defineEmits(['donor-selected', 'deduction-row-added', 'add-deduction-row', 'deduction-table-cleared'])

const { fetchDonorDetails, updateDonorFields, clearDonorFields } = useDonorSelection()

// Function to fetch deduction details for a fund class
async function fetchDeductionDetails(fundClassId) {
  try {
    console.log('=== FETCHING DEDUCTION DETAILS ===')
    console.log('Fund class ID:', fundClassId)
    console.log('Fund class type:', typeof fundClassId)
    
    if (!fundClassId) {
      console.warn('No fund class ID provided')
      return null
    }
    
    // FIX: Use correct parameter name
    const params = { fund_class_id: fundClassId }
    console.log('API parameters:', params)
    console.log('API endpoint: crm.fcrm.doctype.donation.api.get_deduction_details')
    
    const result = await call('crm.fcrm.doctype.donation.api.get_deduction_details', params)
    
    console.log('API response:', result)
    console.log('Result type:', typeof result)
    console.log('Result keys:', result ? Object.keys(result) : 'null')
    
    if (result && Object.keys(result).length > 0) {
      console.log('Deduction details found:', result)
      return result
    } else {
      console.log('No deduction details found in response')
      return null
    }
  } catch (error) {
    console.error('=== ERROR FETCHING DEDUCTION DETAILS ===')
    console.error('Error details:', error)
    console.error('Error message:', error.message)
    
    // Check if it's a network error, API error, or other type
    if (error.response) {
      console.error('Error response:', error.response)
    }
    if (error.status) {
      console.error('Error status:', error.status)
    }
    
    toast.error('Error fetching deduction details. Please try again.')
    return null
  }
}

// Function to add a new row to deduction breakeven table from payment detail
// This function is now simplified to just emit events - the parent component will handle the actual row addition
async function addDeductionBreakevenRow(deductionDetails, fundClassId) {
  console.log('=== ADDING DEDUCTION BREAKEVEN ROW FROM PAYMENT DETAIL ===')
  console.log('Deduction details:', deductionDetails)
  console.log('Fund class ID:', fundClassId)
  
  // Check contribution_type before proceeding
  if (parentDoc.value && parentDoc.value.contribution_type === 'Pledge') {
    console.log('Skipped adding deduction_breakeven row - contribution_type is Pledge')
    toast.warning('Deduction Breakeven rows cannot be added when Contribution Type is Pledge')
    return null
  }
  
  // Create the row data structure
  const newDeductionRow = {
    random_id: Math.floor((1000 + Math.random() * 9000)),
    fund_class: fundClassId,
    percentage: deductionDetails.percentage || 0,
    min_percent: deductionDetails.min_percent || 0,
    max_percent: deductionDetails.max_percent || 0,
    amount: 0, // Will be calculated based on percentage and donation amount
    company: deductionDetails.company || '',
    income_type: deductionDetails.income_type || '',
    account: deductionDetails.account || '',
    project: deductionDetails.project || '',
  }
  
  console.log('New deduction row data created:', newDeductionRow)
  
  // Emit event to parent component to handle the actual row addition
  emit('add-deduction-row', {
    fundClassId: fundClassId,
    deductionDetails: deductionDetails,
    newRowData: newDeductionRow,
    sourceTable: 'payment_detail'
  })
  
  console.log('Event emitted to parent component')
  return newDeductionRow
}

// Function to add deduction row directly to parent document
async function addDeductionRowToParent(deductionDetails, fundClassId, paymentRowRandomId) {
  console.log('=== ADDING DEDUCTION ROW DIRECTLY TO PARENT ===')
  console.log('Deduction details:', deductionDetails)
  console.log('Fund class ID:', fundClassId)
  console.log('Parent doc:', parentDoc.value)
  
  try {
    // Check if parent document is available
    if (!parentDoc.value) {
      console.error('Parent document not available')
      return false
    }
    
    // Check contribution_type before adding deduction row
    if (parentDoc.value.contribution_type === 'Pledge') {
      console.log('Skipped adding deduction_breakeven row - contribution_type is Pledge')
      toast.warning('Deduction Breakeven rows cannot be added when Contribution Type is Pledge')
      return false
    }
    
    // Check if deduction_breakeven table exists in parent document
    if (!parentDoc.value.deduction_breakeven) {
      console.log('Creating deduction_breakeven array in parent document')
      parentDoc.value.deduction_breakeven = []
    }
    
    console.log('Current deduction_breakeven rows:', parentDoc.value.deduction_breakeven)
    
    // Create new deduction breakeven row (without project and account as requested)
    const newDeductionRow = {
      random_id: paymentRowRandomId || Math.floor((1000 + parentDoc.value.deduction_breakeven.length + 1) + (Math.random() * 9000)),
      fund_class: fundClassId,
      percentage: deductionDetails.percentage || 0,
      min_percent: deductionDetails.min_percent || 0,
      max_percent: deductionDetails.max_percent || 0,
      amount: 0, // Will be calculated based on percentage and donation amount
      company: deductionDetails.company || '',
      income_type: deductionDetails.income_type || '',
      account: deductionDetails.account || '',
      project: deductionDetails.project || '',
      // Note: project and account are intentionally not populated as requested
      __islocal: true,
      doctype: 'Deduction Breakeven',
      parentfield: 'deduction_breakeven',
      parenttype: props.parentDoctype || 'Donation',
      idx: (parentDoc.value.deduction_breakeven.length + 1)
    }
    
    console.log('New deduction row created:', newDeductionRow)
    
    // Add the new row to the deduction breakeven table
    parentDoc.value.deduction_breakeven.push(newDeductionRow)
    
    // Force reactive update by creating new array reference
    parentDoc.value.deduction_breakeven = [...parentDoc.value.deduction_breakeven]
    
    console.log('Deduction breakeven row added successfully to parent')
    console.log('Total deduction rows in parent:', parentDoc.value.deduction_breakeven.length)
    console.log('Updated parent doc deduction_breakeven:', parentDoc.value.deduction_breakeven)
    
    // Emit event to notify parent component about the change
    emit('deduction-row-added', {
      row: newDeductionRow,
      fundClassId: fundClassId,
      deductionDetails: deductionDetails
    })
    
    return true
    
  } catch (error) {
    console.error('Error adding deduction row to parent:', error)
    return false
  }
}

// Function to clear the deduction breakeven table when intention is Zakat
async function clearDeductionBreakevenTable() {
  console.log('=== CLEARING DEDUCTION BREAKEVEN TABLE ===')
  console.log('Parent doc:', parentDoc.value)
  
  try {
    // Check if parent document is available
    if (!parentDoc.value) {
      console.error('Parent document not available')
      return false
    }
    
    // Check if deduction_breakeven table exists
    if (parentDoc.value.deduction_breakeven && Array.isArray(parentDoc.value.deduction_breakeven)) {
      console.log('Current deduction_breakeven rows before clearing:', parentDoc.value.deduction_breakeven.length)
      
      // Clear all rows from the deduction breakeven table
      parentDoc.value.deduction_breakeven = []
      
      // Force reactive update by creating new array reference
      parentDoc.value.deduction_breakeven = [...parentDoc.value.deduction_breakeven]
      
      console.log('Deduction breakeven table cleared successfully')
      console.log('Total deduction rows after clearing:', parentDoc.value.deduction_breakeven.length)
      
      // Emit event to notify parent component about the clearing
      emit('deduction-table-cleared', {
        reason: 'Zakat intention',
        tableName: 'deduction_breakeven'
      })
      
      return true
    } else {
      console.log('Deduction breakeven table does not exist or is not an array')
      return true // Consider it successful if there's nothing to clear
    }
    
  } catch (error) {
    console.error('Error clearing deduction breakeven table:', error)
    return false
  }
}

// Function to update deduction fields in a row
function updateDeductionFields(row, deductionDetails) {
  if (!deductionDetails) return
  
  console.log('Updating deduction fields with:', deductionDetails)
  
  // Update percentage fields
  if (deductionDetails.percentage !== undefined) {
    row.percentage = deductionDetails.percentage
  }
  if (deductionDetails.min_percent !== undefined) {
    row.min_percent = deductionDetails.min_percent
  }
  if (deductionDetails.max_percent !== undefined) {
    row.max_percent = deductionDetails.max_percent
  }
  
  if (deductionDetails.income_type) {
    row.income_type = deductionDetails.income_type
  }
  if (deductionDetails.account) {
    row.account = deductionDetails.account
  }
  if (deductionDetails.project) {
    row.project = deductionDetails.project
  }
  
  console.log('Deduction fields updated successfully')
  
  // Validate the updated fields
  const validationErrors = validateDeductionFields(row)
  if (validationErrors.length > 0) {
    console.warn('Validation warnings for deduction fields:', validationErrors)
  }
  
  // Calculate amount based on percentage and donation amount
  calculateDeductionAmount(row)
}

// Function to validate deduction fields after update
function validateDeductionFields(row) {
  const errors = []
  
  // Validate percentage ranges
  if (row.percentage !== undefined && (row.percentage < 0 || row.percentage > 100)) {
    errors.push('Percentage should be between 0 and 100')
  }
  
  if (row.min_percent !== undefined && (row.min_percent < 0 || row.min_percent > 100)) {
    errors.push('Min Percent should be between 0 and 100')
  }
  
  if (row.max_percent !== undefined && (row.max_percent < 0 || row.max_percent > 100)) {
    errors.push('Max Percent should be between 0 and 100')
    }
  
  // Validate min/max relationship
  if (row.min_percent !== undefined && row.max_percent !== undefined && 
      row.min_percent > row.max_percent) {
    errors.push('Min Percent cannot be greater than Max Percent')
  }
  
  // Validate percentage is within min/max range
  if (row.percentage !== undefined && row.min_percent !== undefined && 
      row.max_percent !== undefined) {
    if (row.percentage < row.min_percent) {
      errors.push('Percentage cannot be less than Min Percent')
    }
    if (row.percentage > row.max_percent) {
      errors.push('Percentage cannot be greater than Max Percent')
    }
  }
  
  if (errors.length > 0) {
    console.warn('Deduction field validation errors:', errors)
  }
  
  return errors
}

// Function to validate all deduction breakeven rows
function validateAllDeductionRows() {
  if (props.parentFieldname !== 'deduction_breakeven') return []
  
  const allErrors = []
  
  if (rows.value && Array.isArray(rows.value)) {
    rows.value.forEach((row, index) => {
      if (row.fund_class) {
        const rowErrors = validateDeductionFields(row)
        if (rowErrors.length > 0) {
          allErrors.push({
            row: index + 1,
            errors: rowErrors
          })
        }
      }
    })
  }
  
  return allErrors
}

// Function to get validation summary for deduction breakeven table
function getDeductionValidationSummary() {
  const validationErrors = validateAllDeductionRows()
  
  if (validationErrors.length === 0) {
    return { valid: true, message: 'All deduction fields are valid' }
  }
  
  const totalErrors = validationErrors.reduce((sum, item) => sum + item.errors.length, 0)
  const message = `Found ${totalErrors} validation error(s) in ${validationErrors.length} row(s)`
  
  return {
    valid: false,
    message,
    details: validationErrors
  }
}

// Function to get summary of all deduction data
function getDeductionDataSummary() {
  if (props.parentFieldname !== 'deduction_breakeven') return null
  
  if (!rows.value || !Array.isArray(rows.value)) return null
  
  const summary = {
    totalRows: rows.value.length,
    rowsWithFundClass: 0,
    totalPercentage: 0,
    totalAmount: 0,
    validationStatus: getDeductionValidationSummary()
  }
  
  rows.value.forEach((row) => {
    if (row.fund_class) {
      summary.rowsWithFundClass++
      
      if (row.percentage) {
        summary.totalPercentage += parseFloat(row.percentage) || 0
      }
      
      if (row.amount) {
        summary.totalAmount += parseFloat(row.amount) || 0
      }
    }
  })
  
  return summary
}

// Function to export deduction data for debugging
function exportDeductionData() {
  if (props.parentFieldname !== 'deduction_breakeven') return null
  
  const data = {
    timestamp: new Date().toISOString(),
    parentDocument: parentDoc.value ? {
      company: parentDoc.value.company,
      donation_amount: parentDoc.value.donation_amount
    } : null,
    rows: rows.value ? [...rows.value] : [],
    summary: getDeductionDataSummary()
  }
  
  console.log('Deduction data export:', data)
  return data
}

// Manual test function for deduction details fetching
async function testDeductionDetailsFetching(fundClassId = 'AKFP') {
  console.log('=== MANUAL TEST: DEDUCTION DETAILS FETCHING ===')
  console.log('Testing with fund class:', fundClassId)
  
  try {
    const result = await fetchDeductionDetails(fundClassId)
    console.log('Manual test result:', result)
    return result
  } catch (error) {
    console.error('Manual test error:', error)
    return null
  }
}

// Make the test function globally accessible for debugging
if (typeof window !== 'undefined') {
  window.testDeductionDetailsFetching = testDeductionDetailsFetching
  window.testAPI = async () => {
    console.log('=== MANUAL API TEST ===')
    try {
      const result = await call('crm.fcrm.doctype.donation.api.test_api')
      console.log('Test API result:', result)
      
      const deductionResult = await call('crm.fcrm.doctype.donation.api.get_deduction_details', {
        fund_class: 'AKFP'
      })
      console.log('Deduction API test result:', deductionResult)
      
      return { test: result, deduction: deductionResult }
    } catch (error) {
      console.error('Manual API test error:', error)
      return null
    }
  }
  
  window.testSimpleDeduction = async (fundClass = 'AKFP') => {
    console.log('=== SIMPLE DEDUCTION TEST ===')
    try {
      const result = await call('crm.fcrm.doctype.donation.api.test_deduction_simple', {
        fund_class: fundClass
      })
      console.log('Simple deduction test result:', result)
      return result
    } catch (error) {
      console.error('Simple deduction test error:', error)
      return null
    }
  }
  
  window.testAddDeductionRow = async (fundClass = 'AKFP') => {
    console.log('=== TEST ADDING DEDUCTION ROW ===')
    try {
      const deductionDetails = await fetchDeductionDetails(fundClass)
      if (deductionDetails) {
        const newRow = await addDeductionBreakevenRow(deductionDetails, fundClass)
        console.log('Test deduction row added:', newRow)
        return newRow
      } else {
        console.log('No deduction details found for testing')
        return null
      }
    } catch (error) {
      console.error('Test add deduction row error:', error)
      return null
    }
  }
  
  window.testFundClassIdChange = async (fundClassId = 'AKFP') => {
    console.log('=== TESTING FUND CLASS ID CHANGE SIMULATION ===')
    try {
      // Simulate the field change event
      const mockField = { fieldname: 'fund_class_id', fieldtype: 'Link' }
      const mockRow = { random_id: 9999 }
      
      // Call the field change handler directly
      await fieldChange(fundClassId, mockField, mockRow)
      console.log('Field change simulation completed')
      return true
    } catch (error) {
      console.error('Field change simulation error:', error)
      return false
    }
  }
  
  window.manualAddDeductionRow = async (fundClassId = 'AKFP') => {
    console.log('=== MANUAL DEDUCTION ROW ADDITION ===')
    try {
      // Fetch deduction details
      const deductionDetails = await fetchDeductionDetails(fundClassId)
      console.log('Deduction details fetched:', deductionDetails)
      
      if (deductionDetails) {
        // Try direct addition to parent first
        const success = await addDeductionRowToParent(deductionDetails, fundClassId)
        
        if (success) {
          console.log('Manual deduction row added successfully to parent')
          return true
        } else {
          console.log('Direct addition failed, falling back to event emission')
          // Create row data
          const newRow = {
            random_id: Math.floor((1000 + Math.random() * 9000)),
            fund_class: fundClassId,
            percentage: deductionDetails.percentage || 0,
            min_percent: deductionDetails.min_percent || 0,
            max_percent: deductionDetails.max_percent || 0,
            amount: 0,
            company: deductionDetails.company || '',
            income_type: deductionDetails.income_type || ''
          }
          
          console.log('New row data created:', newRow)
          
          // Emit event
          emit('add-deduction-row', {
            fundClassId: fundClassId,
            deductionDetails: deductionDetails,
            newRowData: newRow,
            sourceTable: 'manual'
          })
          
          console.log('Manual deduction row event emitted')
          return newRow
        }
      } else {
        console.log('No deduction details found')
        return null
      }
    } catch (error) {
      console.error('Manual deduction row error:', error)
      return null
    }
  }
  
  window.testParentDocAccess = () => {
    console.log('=== TESTING PARENT DOC ACCESS ===')
    console.log('Parent doc available:', !!parentDoc.value)
    console.log('Parent doc type:', typeof parentDoc.value)
    console.log('Parent doc keys:', parentDoc.value ? Object.keys(parentDoc.value) : 'none')
    
    if (parentDoc.value) {
      console.log('Parent doc company:', parentDoc.value.company)
      console.log('Parent doc payment_detail:', parentDoc.value.payment_detail)
      console.log('Parent doc deduction_breakeven:', parentDoc.value.deduction_breakeven)
      console.log('Parent doc intention_id:', parentDoc.value.intention_id)
    }
    
    return parentDoc.value
  }
  
  window.testIntentionZakat = async () => {
    console.log('=== TESTING INTENTION ZAKAT FUNCTIONALITY ===')
    try {
      // Test clearing the deduction breakeven table
      const success = await clearDeductionBreakevenTable()
      console.log('Clear table result:', success)
      return success
    } catch (error) {
      console.error('Test intention Zakat error:', error)
      return false
    }
  }
  
  window.testIntentionNonZakat = async (fundClassId = 'AKFP') => {
    console.log('=== TESTING INTENTION NON-ZAKAT FUNCTIONALITY ===')
    try {
      // Test adding deduction row (existing functionality)
      const deductionDetails = await fetchDeductionDetails(fundClassId)
      if (deductionDetails) {
        const success = await addDeductionRowToParent(deductionDetails, fundClassId)
        console.log('Add row result:', success)
        return success
      } else {
        console.log('No deduction details found for testing')
        return false
      }
    } catch (error) {
      console.error('Test intention non-Zakat error:', error)
      return false
    }
  }

  window.testMultipleDeductionRows = async (fundClassId = 'Community Service') => {
    console.log('=== TESTING MULTIPLE DEDUCTION ROWS FUNCTIONALITY ===')
    try {
      // Test fetching multiple deduction details
      const deductionDetails = await fetchDeductionDetails(fundClassId)
      console.log('API response:', deductionDetails)
      
      if (deductionDetails && Object.keys(deductionDetails).length > 0) {
        const isArray = Array.isArray(deductionDetails)
        const detailsArray = isArray ? deductionDetails : [deductionDetails]
        
        console.log(`Found ${detailsArray.length} deduction detail row(s) for fund class: ${fundClassId}`)
        console.log('Details array:', detailsArray)
        
        // Test adding rows for each detail
        let addedRowsCount = 0
        for (const detail of detailsArray) {
          const success = await addDeductionRowToParent(detail, fundClassId)
          if (success) addedRowsCount++
        }
        
        console.log(`Successfully added ${addedRowsCount} rows`)
        return { success: true, addedRows: addedRowsCount, totalDetails: detailsArray.length }
      } else {
        console.log('No deduction details found for testing')
        return { success: false, addedRows: 0, totalDetails: 0 }
      }
    } catch (error) {
      console.error('Test multiple deduction rows error:', error)
      return { success: false, error: error.message }
    }
  }
  
  // Add this to the existing global test functions
  window.testModeOfPayment = async (modeOfPayment = 'Cash') => {
    console.log('=== TESTING MODE OF PAYMENT FUNCTIONALITY ===')
    
    if (props.parentFieldname !== 'payment_detail') {
      console.log('This test only works in payment_detail table')
      return false
    }
    
    if (!rows.value || rows.value.length === 0) {
      console.log('No payment detail rows available for testing')
      return false
    }
    
    const testRow = rows.value[0]
    console.log('Testing with row:', testRow)
    
    try {
      // Simulate mode of payment change
      const mockField = { fieldname: 'mode_of_payment', fieldtype: 'Link' }
      await fieldChange(modeOfPayment, mockField, testRow)
      
      console.log('Mode of payment test completed')
      console.log('Final account_paid_to:', testRow.account_paid_to)
      
      return testRow.account_paid_to
    } catch (error) {
      console.error('Mode of payment test error:', error)
      return false
    }
  }
}

// Function to reset all deduction fields in the table
function resetAllDeductionFields() {
  if (props.parentFieldname !== 'deduction_breakeven') return
  
  if (rows.value && Array.isArray(rows.value)) {
    rows.value.forEach((row) => {
      clearDeductionFields(row)
    })
    
    // Force reactive update
    forceReactiveUpdate()
    
    toast.success('All deduction fields have been reset')
    console.log('All deduction fields reset')
  }
}

// Function to refresh all deduction fields from fund class data
async function refreshAllDeductionFields() {
  if (props.parentFieldname !== 'deduction_breakeven') return
  
  if (!parentDoc.value?.company) {
    toast.error('Company is required to refresh deduction fields')
    return
  }
  
  if (rows.value && Array.isArray(rows.value)) {
    let refreshCount = 0
    let errorCount = 0
    
    for (const row of rows.value) {
      if (row.fund_class) {
        try {
          const deductionDetails = await fetchDeductionDetails(row.fund_class)
          if (deductionDetails && Object.keys(deductionDetails).length > 0) {
            updateDeductionFields(row, deductionDetails)
            refreshCount++
          } else {
            clearDeductionFields(row)
          }
        } catch (error) {
          console.error('Error refreshing deduction fields for row:', error)
          clearDeductionFields(row)
          errorCount++
        }
      }
    }
    
    // Force reactive update
    forceReactiveUpdate()
    
    // Show user feedback
    if (refreshCount > 0) {
      toast.success(`Refreshed deduction fields for ${refreshCount} row(s)`)
    }
    if (errorCount > 0) {
      toast.error(`Failed to refresh ${errorCount} row(s)`)
    }
    
    console.log(`Deduction fields refresh completed: ${refreshCount} successful, ${errorCount} failed`)
  }
}

// Function to check if all required deduction fields are filled
function checkRequiredDeductionFields() {
  if (props.parentFieldname !== 'deduction_breakeven') return { valid: true, missing: [] }
  
  const missing = []
  
  if (rows.value && Array.isArray(rows.value)) {
    rows.value.forEach((row, index) => {
      if (row.fund_class) {
        // Check required fields for rows with fund class
        if (!row.percentage && row.percentage !== 0) {
          missing.push(`Row ${index + 1}: Percentage is required`)
        }
        if (!row.account) {
          missing.push(`Row ${index + 1}: Account is required`)
        }
        if (!row.income_type) {
          missing.push(`Row ${index + 1}: Income Type is required`)
        }
      }
    })
  }
  
  return {
    valid: missing.length === 0,
    missing
  }
}

// Function to get comprehensive validation report for deduction breakeven table
function getDeductionValidationReport() {
  if (props.parentFieldname !== 'deduction_breakeven') return null
  
  const fieldValidation = checkRequiredDeductionFields()
  const percentageValidation = getDeductionValidationSummary()
  const dataSummary = getDeductionDataSummary()
  
  return {
    timestamp: new Date().toISOString(),
    requiredFields: fieldValidation,
    percentageValidation: percentageValidation,
    dataSummary: dataSummary,
    overallValid: fieldValidation.valid && percentageValidation.valid,
    recommendations: []
  }
}

// Function to get total deduction amount
function getTotalDeductionAmount() {
  if (props.parentFieldname !== 'deduction_breakeven') return 0
  
  if (!rows.value || !Array.isArray(rows.value)) return 0
  
  let totalAmount = 0
  
  rows.value.forEach((row) => {
    if (row.fund_class && row.amount) {
      totalAmount += parseFloat(row.amount) || 0
    }
  })
  
  return totalAmount
}

// Function to get total deduction percentage
function getTotalDeductionPercentage() {
  if (props.parentFieldname !== 'deduction_breakeven') return 0
  
  if (!rows.value || !Array.isArray(rows.value)) return 0
  
  let totalPercentage = 0
  
  rows.value.forEach((row) => {
    if (row.fund_class && row.percentage) {
      totalPercentage += parseFloat(row.percentage) || 0
    }
  })
  
  return totalPercentage
}

// Function to check if total deduction percentage exceeds 100%
function checkDeductionPercentageLimit() {
  const totalPercentage = getTotalDeductionPercentage()
  
  if (totalPercentage > 100) {
    toast.warning(`Total deduction percentage (${totalPercentage.toFixed(2)}%) exceeds 100%`)
    return false
  }
  
  return true
}

// Function to get net donation amount after deductions
function getNetDonationAmount() {
  if (props.parentFieldname !== 'deduction_breakeven') return 0
  
  const totalDonationAmount = getDonationAmountFromParent()
  const totalDeductionAmount = getTotalDeductionAmount()
  
  return totalDonationAmount - totalDeductionAmount
}

// Function to get deduction summary for display
function getDeductionSummary() {
  if (props.parentFieldname !== 'deduction_breakeven') return null
  
  const totalDonationAmount = getDonationAmountFromParent()
  const totalDeductionAmount = getTotalDeductionAmount()
  const totalDeductionPercentage = getTotalDeductionPercentage()
  const netAmount = getNetDonationAmount()
  
  return {
    totalDonationAmount,
    totalDeductionAmount,
    totalDeductionPercentage,
    netAmount,
    deductionRatio: totalDonationAmount > 0 ? (totalDeductionAmount / totalDonationAmount) * 100 : 0
  }
}

// Function to clear deduction fields in a row
function clearDeductionFields(row) {
  console.log('Clearing deduction fields')
  
  // Reset percentage fields to default values
  row.percentage = 0
  row.min_percent = 0
  row.max_percent = 0
  
  // Clear other related fields
  row.account = ''
  row.income_type = ''
  row.project = ''
  
  // Reset amount fields
  row.amount = 0
  row.base_amount = 0
  
  console.log('Deduction fields cleared')
}

// Function to calculate amount based on percentage and donation amount (EXACT BACKEND LOGIC)
function calculateDeductionAmount(row) {
  // EXACT backend logic: only calculate if donation_amount > 0
  const donationAmount = parseFloat(row.donation_amount) || 0
  const percentage = parseFloat(row.percentage) || 0
  
  if (donationAmount > 0 && percentage > 0) {
    const calculatedAmount = (percentage / 100) * donationAmount
    row.amount = calculatedAmount
    row.base_amount = calculatedAmount
    
    console.log(`Calculated deduction amount: ${calculatedAmount} (${percentage}% of ${donationAmount})`)
    return calculatedAmount
  } else {
    // EXACT backend logic: set amount to 0 if donation_amount is 0 or empty
    row.amount = 0
    row.base_amount = 0
    console.log(`Deduction amount set to 0 (donation_amount: ${donationAmount}, percentage: ${percentage})`)
    return 0
  }
}

// Function to get donation amount from parent document or payment detail
function getDonationAmountFromParent() {
  if (!parentDoc.value) return 0
  
  // Try to get donation amount from parent document
  if (parentDoc.value.donation_amount) {
    return parseFloat(parentDoc.value.donation_amount) || 0
  }
  
  // Try to get from payment detail table if available
  if (parentDoc.value.payment_detail && Array.isArray(parentDoc.value.payment_detail)) {
    const totalAmount = parentDoc.value.payment_detail.reduce((sum, row) => {
      return sum + (parseFloat(row.donation_amount) || 0)
    }, 0)
    return totalAmount
  }
  
  return 0
}

// Function to sync donation amount across deduction breakeven rows
function syncDonationAmount() {
  if (props.parentFieldname !== 'deduction_breakeven') return
  
  const donationAmount = getDonationAmountFromParent()
  
  if (rows.value && Array.isArray(rows.value)) {
    rows.value.forEach((row) => {
      if (row.donation_amount !== donationAmount) {
        row.donation_amount = donationAmount
        // Recalculate amount if percentage is set
        if (row.percentage) {
          calculateDeductionAmount(row)
        }
      }
    })
  }
}

// Function to sync donation amount from payment detail to deduction breakeven (EXACT BACKEND LOGIC)
function syncDonationAmountFromPaymentDetail() {
  if (props.parentFieldname !== 'deduction_breakeven') return
  
  if (!parentDoc.value || !parentDoc.value.payment_detail || !rows.value) return
  
  console.log('=== SYNCING DONATION AMOUNTS FROM PAYMENT DETAIL ===')
  
  // For each deduction breakeven row, find the matching payment detail row by random_id
  rows.value.forEach((deductionRow) => {
    if (deductionRow.random_id) {
      // Find matching payment detail row
      const matchingPaymentRow = parentDoc.value.payment_detail.find(
        paymentRow => paymentRow.random_id === deductionRow.random_id
      )
      
      if (matchingPaymentRow) {
        const paymentDonationAmount = parseFloat(matchingPaymentRow.donation_amount) || 0
        const currentDeductionDonationAmount = parseFloat(deductionRow.donation_amount) || 0
        
        // Only update if the amounts are different
        if (paymentDonationAmount !== currentDeductionDonationAmount) {
          console.log(`Syncing donation amount for random_id ${deductionRow.random_id}: ${currentDeductionDonationAmount} -> ${paymentDonationAmount}`)
          deductionRow.donation_amount = paymentDonationAmount
          
          // Recalculate deduction amount based on new donation amount
          calculateDeductionAmount(deductionRow)
        }
      } else {
        // If no matching payment detail found, set donation amount to 0
        if (deductionRow.donation_amount !== 0) {
          console.log(`No matching payment detail found for random_id ${deductionRow.random_id}, setting donation amount to 0`)
          deductionRow.donation_amount = 0
          calculateDeductionAmount(deductionRow)
        }
      }
    }
  })
  
  // Force reactive update
  forceReactiveUpdate()
}

// Enhanced fieldChange function with comprehensive field checking
async function fieldChange(value, field, row) {
  console.log('🔥 FIELD CHANGE FUNCTION CALLED 🔥', {
    fieldname: field?.fieldname,
    fieldtype: field?.fieldtype,
    parentFieldname: props.parentFieldname,
    value: value
  })
  
  // ADD THIS DEBUG LOG AT THE VERY BEGINNING
  console.log('🔥 GRID FIELD CHANGE CALLED 🔥', {
    fieldname: field?.fieldname,
    fieldtype: field?.fieldtype,
    parentFieldname: props.parentFieldname,
    value: value,
    row: row
  })
  
  console.log('=== GRID FIELD CHANGE ===')
  console.log('Field name:', field.fieldname)
  console.log('Field type:', field.fieldtype)
  console.log('Parent fieldname:', props.parentFieldname)
  console.log('Value:', value)
  console.log('Row:', row)
  
  // Check if this is a mode of payment field in payment detail table
  const isModeOfPaymentField = field.fieldname === 'mode_of_payment'
  const isPaymentDetailTable = props.parentFieldname === 'payment_detail'
  
  console.log('Field checks:', {
    isModeOfPaymentField,
    isPaymentDetailTable,
    fieldNameMatch: field.fieldname === 'mode_of_payment',
    tableNameMatch: props.parentFieldname === 'payment_detail'
  })
  
  if (isModeOfPaymentField && isPaymentDetailTable) {
    // Skip mode of payment handling for payment_detail - parent component handles it
    triggerOnChange(field.fieldname, value, row)
    return
  }
  
  // Special debug for deduction breakeven table
  if (props.parentFieldname === 'deduction_breakeven') {
    console.log('=== DEDUCTION BREAKEVEN FIELD CHANGE ===')
    console.log('Field details:', {
      fieldname: field.fieldname,
      fieldtype: field.fieldtype,
      options: field.options,
      value: value,
      row: row
    })
  }
  
  if (field.fieldname === 'donor_id' && props.parentFieldname === 'payment_detail') {
    console.log('Processing donor_id change in Grid:', { value, row })
    
    row.donor_id = value
    
    if (value) {
      const donorDetails = await fetchDonorDetails(value)
      if (donorDetails) {
        updateDonorFields(row, donorDetails)
      }
    } else {
      console.log('Clearing donor fields')
      clearDonorFields(row)
    }
    
    // Emit donor-selected event for parent components
    emit('donor-selected', { row, donorId: value, success: !!value })
    
    // Force reactive update
    forceReactiveUpdate()
    
    // Call the original triggerOnChange
    triggerOnChange(field.fieldname, value, row)
    
    return
  }
  
  // Handle fund_class change in deduction_breakeven table
  if (field.fieldname === 'fund_class' && props.parentFieldname === 'deduction_breakeven') {
    console.log('=== FUND CLASS CHANGE DETECTED ===')
    console.log('Fund class value:', value)
    
    if (value) {
      // Fetch deduction details for the selected fund class
      const deductionDetails = await fetchDeductionDetails(value)
      console.log('Deduction details response:', deductionDetails)
      
      if (deductionDetails && Object.keys(deductionDetails).length > 0) {
        console.log('Updating deduction fields with:', deductionDetails)
        updateDeductionFields(row, deductionDetails)
        
        // IMPORTANT: Recalculate amount after updating deduction fields
        calculateDeductionAmount(row)
        
        toast.success('Deduction details fetched successfully')
      } else {
        console.log('No deduction details found, clearing fields')
        toast.info('No deduction details found for this fund class')
        clearDeductionFields(row)
      }
    } else {
      // Clear deduction fields when fund class is cleared
      clearDeductionFields(row)
      toast.info('Deduction fields cleared')
    }
    
    // Force reactive update
    forceReactiveUpdate()
    
    // Call the original triggerOnChange
    triggerOnChange(field.fieldname, value, row)
    
    return
  }
  
  // Handle fund_class_id change in payment_detail table
  if (field.fieldname === 'fund_class_id' && props.parentFieldname === 'payment_detail') {
    console.log('=== FUND CLASS ID CHANGE IN PAYMENT DETAIL ===')
    console.log('Field name:', field.fieldname)
    console.log('Parent fieldname:', props.parentFieldname)
    console.log('Fund class ID value:', value)
    console.log('Parent doc available:', !!parentDoc.value)
    console.log('Parent doc keys:', parentDoc.value ? Object.keys(parentDoc.value) : 'none')
    
    if (value) {
      // FIX: Fetch fund class details first
      try {
        const fundClassDetails = await call('crm.fcrm.doctype.donation.api.get_fund_class_details', {
          fund_class_id: value,
          company: parentDoc.value?.company || 'Alkhidmat Foundation Pakistan'
        })
        
        if (fundClassDetails && Object.keys(fundClassDetails).length > 0) {
          console.log('Fund class details received:', fundClassDetails)
          
          // Update payment detail row with fund class details
          row.pay_service_area = fundClassDetails.service_area || ''
          row.pay_subservice_area = fundClassDetails.subservice_area || ''
          row.pay_product = fundClassDetails.product || ''
          row.fund_class = fundClassDetails.fund_class_name || value
          
          console.log('Payment detail row updated with fund class details')
          toast.success('Fund class details loaded successfully')
        } else {
          console.log('No fund class details found')
          toast.warning('No fund class details found')
        }
      } catch (error) {
        console.error('Error fetching fund class details:', error)
        toast.error('Error loading fund class details')
      }
      
      // Check intention_id to determine behavior
      const intentionId = row.intention_id || parentDoc.value?.intention_id
      console.log('Current intention_id:', intentionId)
      
      if (intentionId === 'Zakat') {
        console.log('Intention is Zakat - clearing deduction breakeven table')
        await clearDeductionBreakevenTable()
        toast.info('Deduction breakeven table cleared (Zakat intention)')
      } else {
        console.log('Intention is not Zakat - running existing functionality')
        // Fetch deduction details for the selected fund class
        const deductionDetails = await fetchDeductionDetails(value)
        console.log('Deduction details for payment detail:', deductionDetails)
        
        if (deductionDetails && Object.keys(deductionDetails).length > 0) {
          // Check if deductionDetails is an array (multiple rows) or single object
          const isArray = Array.isArray(deductionDetails)
          const detailsArray = isArray ? deductionDetails : [deductionDetails]
          
          console.log(`Found ${detailsArray.length} deduction detail row(s) for fund class: ${value}`)
          console.log('Deduction details:', detailsArray)
          
          // Add rows for each deduction detail
          let addedRowsCount = 0
          let failedRowsCount = 0
          
          for (const detail of detailsArray) {
            try {
              const success = await addDeductionRowToParent(detail, value, row.random_id)
              if (success) {
                addedRowsCount++
                console.log(`Successfully added row ${addedRowsCount} for deduction detail:`, detail)
              } else {
                failedRowsCount++
                console.log(`Failed to add row for deduction detail:`, detail)
              }
            } catch (error) {
              failedRowsCount++
              console.error(`Error adding row for deduction detail:`, error, detail)
            }
          }
          
          // Show appropriate toast message
          if (addedRowsCount > 0) {
            if (addedRowsCount === 1) {
              toast.success('New deduction row added successfully')
            } else {
              toast.success(`${addedRowsCount} deduction rows added successfully`)
            }
          }
          
          if (failedRowsCount > 0) {
            toast.error(`Failed to add ${failedRowsCount} deduction rows`)
          }
          
          // If all direct additions failed, emit event to parent as fallback
          if (addedRowsCount === 0 && failedRowsCount > 0) {
            console.log('All direct additions failed, emitting event to parent')
            emit('add-deduction-row', {
              fundClassId: value,
              deductionDetails: deductionDetails,
              sourceTable: 'payment_detail',
              sourceRow: row
            })
          }
        } else {
          toast.info('No deduction details found for this fund class')
        }
      }
    }
    
    // Force reactive update
    forceReactiveUpdate()
    
    // Call the original triggerOnChange
    triggerOnChange(field.fieldname, value, row)
    
    return
  }
  
  // Add flag to prevent infinite loops during intention_id changes
  let isProcessingIntentionChange = false

  // Handle intention_id change to clear deduction breakeven table when set to Zakat
  if (field.fieldname === 'intention_id') {
    console.log('=== INTENTION ID CHANGE DETECTED ===')
    console.log('New intention_id value:', value)
    console.log('Parent fieldname:', props.parentFieldname)
    
    // Prevent infinite loops
    if (isProcessingIntentionChange) {
      console.log('Already processing intention change, skipping...')
      return
    }
    
    isProcessingIntentionChange = true
    
    try {
      // Update the row value first
      row.intention_id = value
      
      // Handle Zakat vs non-Zakat logic
      if (value === 'Zakat') {
        console.log('Intention changed to Zakat - clearing deduction breakeven table')
        
        // Clear deduction breakeven table
        if (parentDoc.value && parentDoc.value.deduction_breakeven) {
          parentDoc.value.deduction_breakeven = []
          console.log('Deduction breakeven table cleared for Zakat')
          toast.info('Deduction breakeven table cleared (Zakat intention)')
        }
      } else if (value && value !== 'Zakat') {
        console.log('Intention changed from Zakat to:', value)
        
        // Check if we need to repopulate deduction breakeven
        if (parentDoc.value && 
            parentDoc.value.deduction_breakeven && 
            Array.isArray(parentDoc.value.deduction_breakeven) && 
            parentDoc.value.deduction_breakeven.length === 0 &&
            parentDoc.value.payment_detail && 
            Array.isArray(parentDoc.value.payment_detail) && 
            parentDoc.value.payment_detail.length > 0) {
          
          console.log('Repopulating deduction breakeven table for non-Zakat intention')
          
          // Use the existing setDeductionBreakevenFromAPI function if available
          if (window.setDeductionBreakevenFromAPI) {
            try {
              await window.setDeductionBreakevenFromAPI()
              console.log('Successfully repopulated deduction breakeven using existing function')
            } catch (error) {
              console.error('Error repopulating deduction breakeven:', error)
            }
          } else {
            // Fallback: Direct API call
            try {
              const result = await call('crm.fcrm.doctype.donation.api.set_deduction_breakeven', {
                payment_details: parentDoc.value.payment_detail,
                company: parentDoc.value.company || 'Alkhidmat Foundation',
                contribution_type: parentDoc.value.contribution_type || 'Donation',
                donation_cost_center: parentDoc.value.donation_cost_center,
                currency: parentDoc.value.currency,
                to_currency: parentDoc.value.to_currency || parentDoc.value.currency,
                posting_date: parentDoc.value.posting_date,
                is_return: parentDoc.value.is_return || false
              })
              
              if (result.success && result.deduction_breakeven) {
                parentDoc.value.deduction_breakeven = result.deduction_breakeven
                parentDoc.value.payment_detail = result.updated_payment_details || parentDoc.value.payment_detail
                
                console.log('Successfully repopulated deduction breakeven table')
                toast.success(`Successfully populated ${result.deduction_breakeven.length} deduction breakeven rows`)
              }
            } catch (error) {
              console.error('Error repopulating deduction breakeven:', error)
            }
          }
        }
      }
      
      // Force reactive update
      forceReactiveUpdate()
      
      // Call the original triggerOnChange
      triggerOnChange(field.fieldname, value, row)
      
    } finally {
      // Reset flag after a delay
      setTimeout(() => {
        isProcessingIntentionChange = false
      }, 1000)
    }
    
    return
  }
  
  // Handle donation_amount change in payment_detail table - SYNC TO DEDUCTION BREAKEVEN
  if (field.fieldname === 'donation_amount' && props.parentFieldname === 'payment_detail') {
    console.log('=== DONATION AMOUNT CHANGE IN PAYMENT DETAIL ===')
    console.log('Donation amount value:', value)
    console.log('Row random_id:', row.random_id)
    
    // Update the payment detail row
    row.donation_amount = value
    
    // IMPORTANT: Sync donation amount to matching deduction breakeven rows
    if (parentDoc.value && parentDoc.value.deduction_breakeven) {
      const matchingDeductionRows = parentDoc.value.deduction_breakeven.filter(
        deductionRow => deductionRow.random_id === row.random_id
      )
      
      matchingDeductionRows.forEach((deductionRow) => {
        console.log(`Syncing donation amount to deduction row with random_id ${deductionRow.random_id}: ${value}`)
        deductionRow.donation_amount = value
        
        // Recalculate deduction amount based on new donation amount
        calculateDeductionAmount(deductionRow)
      })
      
      // Force reactive update of deduction breakeven table
      parentDoc.value.deduction_breakeven = [...parentDoc.value.deduction_breakeven]
    }
    
    // Force reactive update
    forceReactiveUpdate()
    
    // Call the original triggerOnChange
    triggerOnChange(field.fieldname, value, row)
    
    return
  }
  
  // Handle percentage change in deduction_breakeven table - RECALCULATE AMOUNT
  if (field.fieldname === 'percentage' && props.parentFieldname === 'deduction_breakeven') {
    console.log('=== PERCENTAGE CHANGE IN DEDUCTION BREAKEVEN ===')
    console.log('Percentage value:', value)
    
    // Update the percentage
    row.percentage = value
    
    // IMPORTANT: Recalculate amount based on new percentage
    calculateDeductionAmount(row)
    
    // Force reactive update
    forceReactiveUpdate()
    
    // Call the original triggerOnChange
    triggerOnChange(field.fieldname, value, row)
    
    return
  }
  
  // Debug: Log all field changes to see what's happening
  if (props.parentFieldname === 'deduction_breakeven') {
    console.log('=== DEDUCTION BREAKEVEN FIELD CHANGE ===')
    console.log('Field name:', field.fieldname)
    console.log('Field type:', field.fieldtype)
    console.log('Field options:', field.options)
    console.log('Value:', value)
    console.log('Row:', row)
    
    // Special debug for fund_class field
    if (field.fieldname === 'fund_class') {
      console.log('=== FUND CLASS FIELD CHANGE DETECTED ===')
      console.log('Field object:', field)
      console.log('Field value:', value)
      console.log('Row data:', row)
    }
  }
  
  // Regular field change handling
  triggerOnChange(field.fieldname, value, row)
}

// Enhanced watcher for payment detail changes to sync donation amounts
watch(
  () => parentDoc.value?.payment_detail,
  (newPaymentDetail) => {
    if (props.parentFieldname === 'deduction_breakeven' && newPaymentDetail) {
      console.log('=== PAYMENT DETAIL CHANGED - SYNCING DONATION AMOUNTS ===')
      syncDonationAmountFromPaymentDetail()
    }
  },
  { deep: true }
)

// Enhanced watcher for donation amount changes in payment detail
watch(
  () => parentDoc.value?.payment_detail?.map(row => row.donation_amount),
  (newDonationAmounts) => {
    if (props.parentFieldname === 'deduction_breakeven') {
      console.log('=== DONATION AMOUNTS CHANGED - SYNCING TO DEDUCTION BREAKEVEN ===')
      syncDonationAmountFromPaymentDetail()
    }
  },
  { deep: true }
)

function onAttachSuccess(file, field, row) {
  const fileUrl = file?.file_url || file?.name || ''
  row[field.fieldname] = fileUrl
  forceReactiveUpdate()
  triggerOnChange(field.fieldname, fileUrl, row)
}

// Force reactive update by creating new array reference
function forceReactiveUpdate() {
  if (rows.value && Array.isArray(rows.value)) {
    console.log('Forcing reactive update of rows')
    rows.value = [...rows.value]
  }
}

// Add watcher for donor_id changes as backup
watch(rows, (newRows) => {
  if (!newRows) {
    rows.value = []
    return
  }
  
  // Monitor donor_id changes in each row
  newRows.forEach((row, index) => {
    if (row.donor_id && row.donor_id !== row._lastDonorId) {
      // console.log(`Watcher detected donor_id change in row ${index}:`, row.donor_id)
      row._lastDonorId = row.donor_id
      
      // Handle the donor selection
      handleDonorSelectionFromWatcher(row.donor_id, row)
    }
  })
}, { deep: true })

// Handle donor selection from watcher
async function handleDonorSelectionFromWatcher(donorId, row) {
  // console.log('Handling donor selection from watcher:', { donorId, row })
  
  if (donorId) {
    const donorDetails = await fetchDonorDetails(donorId)
    if (donorDetails) {
      updateDonorFields(row, donorDetails)
      forceReactiveUpdate()
    }
  } else {
    clearDonorFields(row)
    forceReactiveUpdate()
  }
}

function getDefaultValue(defaultValue, fieldtype) {
  if (['Float', 'Currency', 'Percent'].includes(fieldtype)) {
    return flt(defaultValue)
  } else if (fieldtype === 'Check') {
    if (['1', 'true', 'True'].includes(defaultValue)) {
      return true
    } else if (['0', 'false', 'False'].includes(defaultValue)) {
      return false
    }
  } else if (fieldtype === 'Int') {
    return parseInt(defaultValue)
  } else if (defaultValue === 'Today' && fieldtype === 'Date') {
    return dayjs().format('YYYY-MM-DD')
  } else if (
    ['Now', 'now'].includes(defaultValue) &&
    fieldtype === 'Datetime'
  ) {
    return dayjs().format('YYYY-MM-DD HH:mm:ss')
  } else if (['Now', 'now'].includes(defaultValue) && fieldtype === 'Time') {
    return dayjs().format('HH:mm:ss')
  } else if (fieldtype === 'Date') {
    return dayjs(defaultValue).format('YYYY-MM-DD')
  } else if (fieldtype === 'Datetime') {
    return dayjs(defaultValue).format('YYYY-MM-DD HH:mm:ss')
  } else if (fieldtype === 'Time') {
    return dayjs(defaultValue).format('HH:mm:ss')
  }

  return defaultValue
}

// ADD: Function to get donor filtering from parent document
function getDonorFilteringFromParent() {
  console.log('Grid: Getting donor filtering from parent document:', parentDoc.value)
  
  if (parentDoc.value) {
    const donorFiltering = {
      donor_identity: parentDoc.value.donor_identity,
      currency: parentDoc.value.currency
    }
    
    console.log('Grid: Extracted donor filtering:', donorFiltering)
    return donorFiltering
  }
  
  console.log('Grid: No parent document available for donor filtering')
  return {}
}

// CORRECTED Grid.vue - Exact Backend Field Mappings

// Function to add deduction breakeven row with EXACT backend field mapping
async function addDeductionBreakevenRowFromAPI(paymentRow, fundClassId) {
  console.log("Adding deduction breakeven row using exact backend field mapping...")
  
  if (!paymentRow || !fundClassId) {
    console.log("Missing required parameters")
    return false
  }
  
  try {
    // Get deduction details from API
    const deductionDetails = await call("crm.fcrm.doctype.donation.api.get_deduction_details_comprehensive", {
      fund_class_id: fundClassId,
      company: parentDoc.value.company || "Alkhidmat Foundation"
    })
    
    if (!deductionDetails.success || !deductionDetails.data || deductionDetails.data.length === 0) {
      console.log("No deduction details found")
      return false
    }
    
    // Create deduction breakeven rows with EXACT backend field mapping
    const newDeductionRows = []
    
    for (const deductionDetail of deductionDetails.data) {
      const percentageAmount = paymentRow.donation_amount * (deductionDetail.percentage / 100)
      const baseAmount = percentageAmount // Apply currency exchange if needed
      
      // EXACT backend field mapping from set_deduction_details function
      const newDeductionRow = {
        "random_id": paymentRow.random_id,
        "company": parentDoc.value.company || "Alkhidmat Foundation",
        "income_type": deductionDetail.income_type,
        "project": deductionDetail.project,
        "account": deductionDetail.account,
        "percentage": deductionDetail.percentage || 0,
        "min_percent": deductionDetail.min_percent || 0,
        "max_percent": deductionDetail.max_percent || 0,
        "donation_amount": paymentRow.donation_amount,
        "amount": percentageAmount,
        "base_amount": baseAmount,
        // EXACT backend field mapping
        "project_id": deductionDetail.project,
        "cost_center_id": parentDoc.value.donation_cost_center,
        "fund_class_id": paymentRow.fund_class_id,
        "service_area_id": paymentRow.pay_service_area,
        "subservice_area_id": paymentRow.pay_subservice_area,
        "product_id": paymentRow.pay_product,
        "donor_id": paymentRow.donor_id,
        "donor_type_id": paymentRow.donor_type,
        "donor_desk_id": paymentRow.donor_desk_id,
        "intention_id": paymentRow.intention_id,
        "transaction_type_id": paymentRow.transaction_type_id,
        "__islocal": true,
        "doctype": "Deduction Breakeven",
        "parentfield": "deduction_breakeven",
        "parenttype": props.parentDoctype || "Donation",
        "idx": (parentDoc.value.deduction_breakeven.length + newDeductionRows.length + 1)
      }
      
      newDeductionRows.push(newDeductionRow)
    }
    
    // Add rows to parent document
    parentDoc.value.deduction_breakeven.push(...newDeductionRows)
    parentDoc.value.deduction_breakeven = [...parentDoc.value.deduction_breakeven]
    
    console.log("Added deduction breakeven rows with exact backend field mapping:", newDeductionRows.length)
    return true
    
  } catch (error) {
    console.error("Error adding deduction breakeven row:", error)
    return false
  }
}

// NEW: Update deduction amounts using API
async function updateDeductionAmountsFromAPI() {
  console.log('Updating deduction amounts using API...')
  
  if (!parentDoc.value.payment_detail || !parentDoc.value.deduction_breakeven) {
    console.log('Missing payment detail or deduction breakeven data')
    return
  }
  
  try {
    const result = await call('crm.fcrm.doctype.donation.api.calculate_deduction_amounts', {
      payment_details: parentDoc.value.payment_detail,
      deduction_breakeven: parentDoc.value.deduction_breakeven
    })
    
    if (result.success) {
      console.log('Updated deduction amounts via API:', result.data)
      
      // Update the deduction breakeven rows with calculated amounts
      result.data.forEach(calculation => {
        const matchingDeductions = parentDoc.value.deduction_breakeven.filter(
          d => d.random_id === calculation.random_id
        )
        
        matchingDeductions.forEach((deduction, index) => {
          if (calculation.deduction_details[index]) {
            deduction.amount = calculation.deduction_details[index].amount
            deduction.base_amount = calculation.deduction_details[index].amount
          }
        })
      })
      
      // Force reactive update
      parentDoc.value.deduction_breakeven = [...parentDoc.value.deduction_breakeven]
      
      console.log('Deduction amounts updated successfully')
    } else {
      console.error('Failed to update deduction amounts:', result.message)
    }
  } catch (error) {
    console.error('Error updating deduction amounts via API:', error)
  }
}

// NEW: Validate deduction percentages using API
async function validateDeductionPercentagesFromAPI() {
  console.log('Validating deduction percentages using API...')
  
  if (!parentDoc.value.deduction_breakeven || parentDoc.value.deduction_breakeven.length === 0) {
    return { success: true, message: 'No deduction breakeven to validate' }
  }
  
  try {
    const result = await call('crm.fcrm.doctype.donation.api.validate_deduction_percentages', {
      deduction_breakeven: parentDoc.value.deduction_breakeven
    })
    
    if (!result.success && result.errors) {
      console.error('Deduction percentage validation failed:', result.errors)
      return { success: false, errors: result.errors }
    }
    
    return result
  } catch (error) {
    console.error('Error validating deduction percentages:', error)
    return { success: false, message: 'Error validating deduction percentages' }
  }
}


let updateDeductionTimeout = null

// NEW: Debounced update function
function debouncedUpdateDeductionAmounts() {
  if (updateDeductionTimeout) {
    clearTimeout(updateDeductionTimeout)
  }
  
  updateDeductionTimeout = setTimeout(async () => {
    debouncedUpdateDeductionAmounts()
  }, 300) // 300ms debounce
}

// Add this function to test the API directly
async function testPaymentModeAPI() {
  console.log('=== TESTING PAYMENT MODE API ===')
  
  try {
    // Use the CORRECT custom API endpoint
    const result = await call('crm.fcrm.doctype.donation.api.get_payment_mode_account', {
      mode_of_payment: 'Cash', // Test with Cash
      company: 'Alkhidmat Foundation Pakistan'
    })
    
    console.log('API Test Result:', result)
    return result
  } catch (error) {
    console.error('API Test Error:', error)
    return null
  }
}

// Call this function when the component mounts to test the API
onMounted(() => {
  // Test the API when component mounts
  setTimeout(() => {
    testPaymentModeAPI()
  }, 1000)
})

// Add this watcher after the existing watchers
watch(
  () => rows.value,
  (newRows) => {
    if (!newRows || props.parentFieldname !== 'payment_detail') return
    
    newRows.forEach((row, index) => {
      // Skip mode of payment handling for payment_detail - parent component handles it
      if (row.mode_of_payment && row.mode_of_payment !== row._lastModeOfPayment && !row._isUpdatingAccountPaidTo) {
        console.log(`Grid watcher detected mode_of_payment change in row ${index} - skipping (parent component handles it)`)
        row._lastModeOfPayment = row.mode_of_payment
        // Don't call handleModeOfPaymentChange - let parent component handle it
      }
    })
  },
  { deep: true }
)

// Add this function to handle mode of payment changes
async function handleModeOfPaymentChange(modeOfPayment, row) {
  console.log('=== GRID WATCHER: MODE OF PAYMENT CHANGE ===')
  console.log('Mode of payment:', modeOfPayment)
  console.log('Row:', row)
  
  if (!modeOfPayment) {
    row.account_paid_to = ''
    forceReactiveUpdate()
    return
  }
  
  try {
    const company = parentDoc.value?.company || 'Alkhidmat Foundation Pakistan'
    console.log('Company:', company)
    
    const result = await call('crm.fcrm.doctype.donation.api.get_payment_mode_account', {
      mode_of_payment: modeOfPayment,
      company: company
    })
    
    console.log('Grid watcher API result:', result)
    
    if (result && result.success && result.account) {
      console.log('✅ Grid watcher: Account fetched successfully:', result.account)
      row.account_paid_to = result.account
      forceReactiveUpdate()
      toast.success(`Account Paid To auto-filled: ${result.account}`)
    } else {
      console.log('❌ Grid watcher: No account found')
      row.account_paid_to = ''
      forceReactiveUpdate()
      
      if (result && result.message) {
        toast.warning(result.message)
      } else {
        toast.warning('No default account found for this mode of payment')
      }
    }
  } catch (error) {
    console.error('❌ Grid watcher: Error fetching payment mode account:', error)
    row.account_paid_to = ''
    forceReactiveUpdate()
    toast.error(`Error loading account for mode of payment: ${error.message}`)
  }
}

// Add this at the very beginning of the script setup section
console.log('🔥 GRID COMPONENT LOADED 🔥', {
  doctype: props.doctype,
  parentDoctype: props.parentDoctype,
  parentFieldname: props.parentFieldname
})

// Add this in the onMounted hook
onMounted(() => {
  console.log('🔥 GRID COMPONENT MOUNTED 🔥', {
    doctype: props.doctype,
    parentDoctype: props.parentDoctype,
    parentFieldname: props.parentFieldname,
    rowsCount: rows.value?.length || 0
  })
  
  // Test the API when component mounts
  setTimeout(() => {
    testPaymentModeAPI()
  }, 1000)
})

// Add this right after the script setup line
console.log('🔥 GRID COMPONENT SCRIPT LOADED 🔥')

// Add this watcher after the existing watchers
watch(
  () => rows.value?.map(row => row.mode_of_payment),
  (newModeOfPayments, oldModeOfPayments) => {
    // Skip mode of payment handling for payment_detail - parent component handles it
    if (!newModeOfPayments || props.parentFieldname !== 'payment_detail') return
    
    console.log('🔥 MODE OF PAYMENT WATCHER TRIGGERED - SKIPPING FOR PAYMENT_DETAIL 🔥', {
      newModeOfPayments,
      oldModeOfPayments,
      parentFieldname: props.parentFieldname
    })
    
    // Don't handle mode of payment changes for payment_detail - parent component handles it
    return
  },
  { deep: true }
)

// // Add this function to handle mode of payment changes directly
// async function handleModeOfPaymentChangeDirectly(modeOfPayment, row) {
//   console.log('🔥 HANDLING MODE OF PAYMENT CHANGE DIRECTLY ', {
//     modeOfPayment,
//     row
//   })
  
//   if (!modeOfPayment) {
//     row.account_paid_to = ''
//     forceReactiveUpdate()
//     return
//   }
  
//   try {
//     const company = parentDoc.value?.company || 'Alkhidmat Foundation Pakistan'
//     console.log('Company:', company)
    
//     const result = await call('crm.fcrm.doctype.donation.api.get_payment_mode_account', {
//       mode_of_payment: modeOfPayment,
//       company: company
//     })
    
//     console.log('🔥 API RESULT 🔥', result)
    
//     if (result && result.success && result.account) {
//       console.log('✅ Account fetched successfully:', result.account)
//       row.account_paid_to = result.account
//       forceReactiveUpdate()
//       toast.success(`Account Paid To auto-filled: ${result.account}`)
//     } else {
//       console.log('❌ No account found')
//       row.account_paid_to = ''
//       forceReactiveUpdate()
      
//       if (result && result.message) {
//         toast.warning(result.message)
//       } else {
//         toast.warning('No default account found for this mode of payment')
//       }
//     }
//   } catch (error) {
//     console.error('❌ Error fetching payment mode account:', error)
//     row.account_paid_to = ''
//     forceReactiveUpdate()
//     toast.error(`Error loading account for mode of payment: ${error.message}`)
//   }
// }
</script>