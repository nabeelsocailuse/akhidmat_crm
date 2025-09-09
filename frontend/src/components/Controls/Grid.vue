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
              >*</span
            >
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
  return getFields()?.map((f) => getFieldObj(f)) || []
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

  // Apply filter to link_doctype field in the links child table
  if (props.parentFieldname === 'links' && field.fieldname === 'link_doctype' && field.fieldtype === 'Link' && field.options === 'DocType') {
    field.filters = { name: 'Donor' }
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
    
    // Set default value for link_doctype field in links child table
    if (props.parentFieldname === 'links' && field.fieldname === 'link_doctype' && field.fieldtype === 'Link' && field.options === 'DocType') {
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
    
    const params = { fund_class: fundClassId }
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
  
  // Create the row data structure
  const newDeductionRow = {
    random_id: Math.floor((1000 + Math.random() * 9000)),
    fund_class: fundClassId,
    percentage: deductionDetails.percentage || 0,
    min_percent: deductionDetails.min_percent || 0,
    max_percent: deductionDetails.max_percent || 0,
    amount: 0, // Will be calculated based on percentage and donation amount
    company: deductionDetails.company || '',
    income_type: deductionDetails.income_type || ''
    // Note: project and account are intentionally not populated as requested
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
  
  // // Update other related fields if available
  // if (deductionDetails.account) {
  //   row.account = deductionDetails.account
  // }
  if (deductionDetails.income_type) {
    row.income_type = deductionDetails.income_type
  }
  // if (deductionDetails.project) {
  //   row.project = deductionDetails.project
  // }
  
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

// Function to calculate amount based on percentage and donation amount
function calculateDeductionAmount(row) {
  if (row.percentage && row.donation_amount) {
    const percentage = parseFloat(row.percentage) || 0
    const donationAmount = parseFloat(row.donation_amount) || 0
    
    if (percentage > 0 && donationAmount > 0) {
      const calculatedAmount = (percentage / 100) * donationAmount
      row.amount = calculatedAmount
      row.base_amount = calculatedAmount
      
      console.log(`Calculated deduction amount: ${calculatedAmount} (${percentage}% of ${donationAmount})`)
      return calculatedAmount
    }
  }
  
  // Reset amount if calculation not possible
  row.amount = 0
  row.base_amount = 0
  return 0
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

// Enhanced fieldChange function with donor_id handling
async function fieldChange(value, field, row) {
  console.log('=== GRID FIELD CHANGE ===')
  console.log('Field name:', field.fieldname)
  console.log('Field type:', field.fieldtype)
  console.log('Parent fieldname:', props.parentFieldname)
  console.log('Value:', value)
  console.log('Row:', row)
  
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
      // console.log('Fetching donor details for:', value)
      const donorDetails = await fetchDonorDetails(value)
      if (donorDetails) {
        updateDonorFields(row, donorDetails)
        // console.log('Donor fields updated successfully')
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
        // Do not auto-set intention_id here; rely on actual selection
        
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
  
  // Handle intention_id change to clear deduction breakeven table when set to Zakat
  if (field.fieldname === 'intention_id') {
    console.log('=== INTENTION ID CHANGE DETECTED ===')
    console.log('New intention_id value:', value)
    console.log('Parent fieldname:', props.parentFieldname)
    
    // Skip validation errors by ensuring valid value
    if (!value || value === 'Cash' || value === '') {
      console.log('Invalid intention_id detected, setting to valid value')
      value = ''
      row.intention_id = ''
    }
    
    if (value === 'Zakat') {
      console.log('Intention changed to Zakat - clearing deduction breakeven table')
      await clearDeductionBreakevenTable()
      toast.info('Deduction breakeven table cleared (Zakat intention)')
    } else {
      console.log('Intention changed from Zakat to:', value)
      // Optionally, you could restore previous deduction rows here if needed
    }
    
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
</script>

<style scoped>
/* For Input fields */
:deep(.grid-row input:not([type='checkbox'])),
:deep(.grid-row textarea) {
  border: none;
  border-radius: 0;
  height: 38px;
}

:deep(.grid-row input:focus),
:deep(.grid-row input:hover),
:deep(.grid-row textarea:focus),
:deep(.grid-row textarea:hover) {
  box-shadow: none;
}

:deep(.grid-row input:focus-within) :deep(.grid-row textarea:focus-within) {
  border: 1px solid var(--outline-gray-2);
}

/* For select field */
:deep(.grid-row select) {
  border: none;
  border-radius: 0;
  height: 38px;
}

/* For Autocomplete */
:deep(.grid-row button) {
  border: none;
  border-radius: 0;
  background-color: var(--surface-white);
  height: 38px;
}

:deep(.grid-row:last-child .grid-row-checkbox) {
  border-bottom-left-radius: 7px;
}

:deep(.grid-row .edit-row button) {
  border-bottom-right-radius: 7px;
}

:deep(.grid-row button:focus) :deep(.grid-row button:hover) {
  box-shadow: none;
  background-color: var(--surface-white);
}

:deep(.grid-row button:focus-within) {
  border: 1px solid var(--outline-gray-2);
}
</style>