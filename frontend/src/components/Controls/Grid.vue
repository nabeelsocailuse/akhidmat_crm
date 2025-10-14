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
          v-if="gridSettings.editable_grid"
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
            :disabled="!gridSettings.editable_grid"
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
              class="grid-row flex items-center border-b border-outline-gray-modals bg-surface-modals last:rounded-b last:border-b-0"
            >
              <div
                v-if="gridSettings.editable_grid"
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
                        'Table',
                      ].includes(field.fieldtype)
                    "
                    type="text"
                    :placeholder="field.placeholder"
                    :value="row[field.fieldname]"
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
                    :disabled="!canEditField(field)"
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
                    :disabled="!canEditField(field)"
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
                      <Button v-if="gridSettings.editable_grid" size="sm" variant="subtle" @click.stop="() => { row[field.fieldname] = ''; forceReactiveUpdate(); triggerOnChange(field.fieldname, '', row) }">{{ __('Clear') }}</Button>
                    </div>
                    <div v-else-if="gridSettings.editable_grid" class="w-full">
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
                      :disabled="Boolean(field.read_only) || !canEditField(field)"
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
                    :disabled="!canEditField(field)"
                    @change="(v) => fieldChange(v, field, row)"
                  />
                  <DateTimePicker
                    v-else-if="field.fieldtype === 'Datetime'"
                    :value="row[field.fieldname]"
                    icon-left=""
                    variant="outline"
                    :formatter="(date) => getFormat(date, '', true, true)"
                    input-class="border-none text-sm text-ink-gray-8"
                    :disabled="!canEditField(field)"
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
                    :disabled="!canEditField(field)"
                    @change="fieldChange($event.target.value, field, row)"
                  />
                  <FormControl
                    v-else-if="field.fieldtype === 'Select'"
                    class="text-sm text-ink-gray-8"
                    type="select"
                    variant="outline"
                    v-model="row[field.fieldname]"
                    :options="field.options"
                    :disabled="!canEditField(field)"
                    @change="(e) => fieldChange(e.target.value, field, row)"
                  />
                  <Password
                    v-else-if="field.fieldtype === 'Password'"
                    variant="outline"
                    :value="row[field.fieldname]"
                    :disabled="Boolean(field.read_only) || !canEditField(field)"
                    @change="fieldChange($event.target.value, field, row)"
                  />
                  <FormattedInput
                    v-else-if="field.fieldtype === 'Int'"
                    class="[&_input]:text-right"
                    type="text"
                    variant="outline"
                    :value="row[field.fieldname] || '0'"
                    :disabled="Boolean(field.read_only) || !gridSettings.editable_grid"
                    @change="fieldChange($event.target.value, field, row)"
                  />
                  <FormattedInput
                    v-else-if="field.fieldtype === 'Percent'"
                    class="[&_input]:text-right"
                    type="text"
                    variant="outline"
                    :value="getFloatWithPrecision(field.fieldname, row)"
                    :formattedValue="(row[field.fieldname] || '0') + '%'"
                    :disabled="Boolean(field.read_only) || !canEditField(field)"
                    @change="fieldChange(flt($event.target.value), field, row)"
                  />
                  <FormattedInput
                    v-else-if="field.fieldtype === 'Float'"
                    class="[&_input]:text-right"
                    type="text"
                    variant="outline"
                    :value="getFloatWithPrecision(field.fieldname, row)"
                    :formattedValue="row[field.fieldname]"
                    :disabled="Boolean(field.read_only) || !canEditField(field)"
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
                    :disabled="Boolean(field.read_only) || !canEditField(field)"
                    @change="fieldChange(flt($event.target.value), field, row)"
                  />
                  <FormControl
                    v-else
                    class="text-sm text-ink-gray-8"
                    type="text"
                    variant="outline"
                    v-model="row[field.fieldname]"
                    :options="field.options"
                    :disabled="!canEditField(field)"
                    @change="fieldChange($event.target.value, field, row)"
                  />
                  <Grid
                    v-if="field.fieldtype === 'Table'"
                    v-model="data[field.fieldname]"
                    v-model:parent="data"
                    :doctype="field.options"
                    :parentDoctype="doctype"
                    :parentFieldname="field.fieldname"
                    :donorFiltering="getDonorFilteringFromData()"
                    :readOnly="readOnly || Boolean(field.read_only)"
                    @donor-selected="$emit('donor-selected', $event)"
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
                :readOnly="!gridSettings.editable_grid"
                :returnAmountOnly="parentDoctype === 'Donation' && parentFieldname === 'payment_detail' && isDonationReturn"
                @field-change="(fieldname, value) => handleGridRowModalFieldChange(index, fieldname, value)"
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
        v-if="showDeleteBtn && gridSettings.editable_grid"
        :label="__('Delete')"
        variant="solid"
        theme="red"
        @click="deleteRows"
      />
      <Button v-if="canAddRows" :label="__('Add Row')" @click="addRow" />
    </div>
    <GridRowFieldsModal
      v-if="showGridRowFieldsModal"
      v-model="showGridRowFieldsModal"
      :doctype="doctype"
      :parentDoctype="parentDoctype"
      :readOnly="!gridSettings.editable_grid"
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
import { ref, reactive, computed, inject, provide, watch, nextTick, onMounted } from 'vue'
import { useDonorSelection } from '@/composables/useDonorSelection'

const props = defineProps({
  label: { type: String, default: '' },
  doctype: { type: String, required: true },
  parentDoctype: { type: String, required: true },
  parentFieldname: { type: String, required: true },
  readOnly: { type: Boolean, default: false },
})

const emit = defineEmits(['donor-selected', 'fund-class-selected', 'deduction-row-added', 'add-deduction-row', 'deduction-table-cleared'])

const triggerOnChange = inject('triggerOnChange', () => {})
const triggerOnRowAdd = inject('triggerOnRowAdd', () => {})
const triggerOnRowRemove = inject('triggerOnRowRemove', () => {})

const { users, getUser } = usersStore()
const {
  getGridViewSettings,
  getFields,
  getFloatWithPrecision,
  getCurrencyWithPrecision,
  getFormattedCurrency,
  getGridSettings,
} = getMeta(props.doctype)
getMeta(props.parentDoctype)

const rows = defineModel()
const parentDoc = defineModel('parent')

const initializeRows = () => {
  if (!rows.value) rows.value = []
}
initializeRows()

watch(rows, (newRows) => {
  if (!newRows) rows.value = []
}, { immediate: true })

provide('parentDoc', parentDoc)

const showRowList = ref(new Array(rows.value?.length || []).fill(false))
const selectedRows = reactive(new Set())
const showGridFieldsEditorModal = ref(false)
const showGridRowFieldsModal = ref(false)

const gridSettings = computed(() => {
  const settings = getGridSettings()
  if (props.readOnly) return { ...settings, editable_grid: false }
  return settings
})

const isDonationReturn = computed(() => {
  if (props.parentDoctype !== 'Donation' || props.parentFieldname !== 'payment_detail') return false
  const doc = parentDoc.value || {}
  const isReturnFlag = doc.is_return === 1 || doc.is_return === true || doc.is_return === '1'
  const hasReturnAgainst = !!doc.return_against
  const statusText = (doc.status || '').toString().toLowerCase()
  const isReturnStatus = statusText === 'return' || statusText === 'credit note issued'
  return isReturnFlag || hasReturnAgainst || isReturnStatus
})

const canAddRows = computed(() => {
  return gridSettings.value.editable_grid && !isDonationReturn.value
})

function canEditField(field) {
  if (!gridSettings.value.editable_grid) return false
  if (props.parentDoctype === 'Donation' && props.parentFieldname === 'payment_detail' && isDonationReturn.value) { 
    return field?.fieldname === 'donation_amount'
  }
  return true
}

const fields = computed(() => {
  const gridViewSettings = getGridViewSettings(props.parentDoctype)
  const gridFields = getFields()
  if (gridViewSettings.length) {
    return gridViewSettings
      .map((gs) => getFieldObj(gridFields.find((f) => f.fieldname === gs.fieldname)))
      .filter(Boolean)
  }
  return (
    gridFields?.filter((f) => f.in_list_view).map((f) => getFieldObj(f)).filter(Boolean) || []
  )
})

const allFields = computed(() => {
  const base = getFields()?.map((f) => getFieldObj(f)) || []
  const hasTxnAttach = base.some((f) => f.fieldname === 'transaction_attachment')
  if (!hasTxnAttach) {
    base.push(getFieldObj({
      fieldname: 'transaction_attachment',
      label: 'Transaction Attachment',
      fieldtype: 'Attach Image',
      options: 'Attach',
      in_list_view: false,
    }))
  }
  return base
})

const gridTemplateColumns = computed(() => {
  if (!fields.value?.length) return '1fr'
  const gridViewSettings = getGridViewSettings(props.parentDoctype)
  if (gridViewSettings.length) {
    return gridViewSettings.map((gs) => `minmax(0, ${gs.columns || 2}fr)`).join(' ')
  }
  return fields.value.map(() => `minmax(0, 2fr)`).join(' ')
})

const allRowsSelected = computed(() => {
  if (!rows.value?.length) return false
  return rows.value.length === selectedRows.size
})

const showDeleteBtn = computed(() => selectedRows.size > 0)

function setQueryForField(field) {
  if (field.fieldname === 'donor' && field.options === 'Donor') {
    const filters = { status: 'Active' }
    if (parentDoc.value?.currency) filters.default_currency = parentDoc.value.currency
    if (parentDoc.value?.donor_identity && parentDoc.value.donor_identity.trim() !== '') filters.donor_identity = parentDoc.value.donor_identity
    field.filters = filters
    field.get_query = () => ({ filters })
  }
  return field
}

function getFieldObj(field) {
  if (!field) return field
  if (field.fieldtype === 'Link' && field.options !== 'User') {
    if (!field.create) {
      field.create = (value, fieldRef, row, close) => {
        const callback = (d) => { if (d) fieldChange(d.name, fieldRef, row) }
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

  setQueryForField(field)
  if (field.fieldname === 'transaction_attachment') {
    field.fieldtype = ['Attach', 'Attach Image'].includes(field.fieldtype) ? field.fieldtype : 'Attach Image'
    field.options = field.options || 'Attach'
  }

  if ((props.parentFieldname === 'links' || props.parentFieldname === 'timeline_links')
    && field.fieldname === 'link_doctype'
    && field.fieldtype === 'Link'
    && field.options === 'DocType') {
    field.filters = { name: ['in', ['Donor', 'CRM Lead', 'Contact']] }
  }

  const fieldObj = { ...field, placeholder: field.placeholder || field.label }
  if (field.depends_on) fieldObj.display_via_depends_on = true
  if (field.filters) fieldObj.filters = field.filters
  else if (field.link_filters) fieldObj.filters = JSON.parse(field.link_filters)
  if (field.get_query) fieldObj.get_query = field.get_query

  return fieldObj
}

const toggleSelectAllRows = (iSelected) => {
  if (iSelected) {
    rows.value?.forEach((row) => selectedRows.add(row.name))
  } else {
    selectedRows.clear()
  }
}

const toggleSelectRow = (row) => {
  if (selectedRows.has(row.name)) selectedRows.delete(row.name)
  else selectedRows.add(row.name)
}

const addRow = () => {

  if (!rows.value) rows.value = []

  const newRow = {}
  allFields.value?.forEach((field) => {
    if (field.fieldtype === 'Check') newRow[field.fieldname] = false
    else newRow[field.fieldname] = ''
    if ((props.parentFieldname === 'links' || props.parentFieldname === 'timeline_links')
      && field.fieldname === 'link_doctype' && field.fieldtype === 'Link' && field.options === 'DocType') {
      newRow[field.fieldname] = 'Donor'
    }
  })

  if (props.parentFieldname === 'deduction_breakeven') {
    newRow.random_id = Math.floor(1000 + rows.value.length + 1 + (Math.random() * 9000))
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

const { fetchDonorDetails, updateDonorFields, clearDonorFields } = useDonorSelection()


async function fetchDeductionDetails(fundClass) {
  if (!fundClass) return null
  try {
    const params = { fund_class: fundClass }
    const result = await call('crm.fcrm.doctype.donation.api.get_deduction_details', params)
    if (result && Object.keys(result).length > 0) return result
    return null
  } catch (error) {
    toast.error('Error fetching deduction details. Please try again.')
    return null
  }
}

async function addDeductionRowToParent(deductionDetails, fundClass, paymentRowRandomId, donorId) {
  try {
    if (!parentDoc.value) return false

    if (!parentDoc.value.deduction_breakeven) parentDoc.value.deduction_breakeven = []

    const newDeductionRow = {
      random_id: paymentRowRandomId || Math.floor(1000 + parentDoc.value.deduction_breakeven.length + 1 + (Math.random() * 9000)),
      fund_class: fundClass,
      fund_class: fundClass,
      donor: donor || '',
      percentage: deductionDetails?.percentage || 0,
      min_percent: deductionDetails?.min_percent || 0,
      max_percent: deductionDetails?.max_percent || 0,
      amount: 0,
      company: deductionDetails?.company || '',
      income_type: deductionDetails?.income_type || '',
      account: deductionDetails?.account || '',
      project: deductionDetails?.project || '',
      __islocal: true,
      doctype: 'Deduction Breakeven',
      parentfield: 'deduction_breakeven',
      parenttype: props.parentDoctype || 'Donation',
      idx: (parentDoc.value.deduction_breakeven.length + 1)
    }

    parentDoc.value.deduction_breakeven.push(newDeductionRow)
    parentDoc.value.deduction_breakeven = [...parentDoc.value.deduction_breakeven]

    emit('deduction-row-added', { row: newDeductionRow, fundClass, deductionDetails })
    return true
  } catch (error) {
    return false
  }
}

function updateDeductionFields(row, deductionDetails) {
  if (!deductionDetails) return
  if (deductionDetails.percentage !== undefined) row.percentage = deductionDetails.percentage
  if (deductionDetails.min_percent !== undefined) row.min_percent = deductionDetails.min_percent
  if (deductionDetails.max_percent !== undefined) row.max_percent = deductionDetails.max_percent
  if (deductionDetails.income_type) row.income_type = deductionDetails.income_type
  if (deductionDetails.account) row.account = deductionDetails.account
  if (deductionDetails.project) row.project = deductionDetails.project

  const validationErrors = validateDeductionFields(row)
  if (validationErrors.length > 0) {
  }
  calculateDeductionAmount(row)
}

function validateDeductionFields(row) {
  const errors = []
  if (row.percentage !== undefined && (row.percentage < 0 || row.percentage > 100)) errors.push('Percentage should be between 0 and 100')
  if (row.min_percent !== undefined && (row.min_percent < 0 || row.min_percent > 100)) errors.push('Min Percent should be between 0 and 100')
  if (row.max_percent !== undefined && (row.max_percent < 0 || row.max_percent > 100)) errors.push('Max Percent should be between 0 and 100')
  if (row.min_percent !== undefined && row.max_percent !== undefined && row.min_percent > row.max_percent) errors.push('Min Percent cannot be greater than Max Percent')
  if (row.percentage !== undefined && row.min_percent !== undefined && row.max_percent !== undefined) {
    if (row.percentage < row.min_percent) errors.push('Percentage cannot be less than Min Percent')
    if (row.percentage > row.max_percent) errors.push('Percentage cannot be greater than Max Percent')
  }
  return errors
}

function clearDeductionFields(row) {
  row.percentage = 0
  row.min_percent = 0
  row.max_percent = 0
  row.account = ''
  row.income_type = ''
  row.project = ''
  row.amount = 0
  row.base_amount = 0
}

function calculateDeductionAmount(row) {
  const donationAmount = parseFloat(row.donation_amount) || 0
  const percentage = parseFloat(row.percentage) || 0
  if (donationAmount > 0 && percentage > 0) {
    const calculatedAmount = (percentage / 100) * donationAmount
    row.amount = calculatedAmount
    row.base_amount = calculatedAmount
    return calculatedAmount
  } else {
    row.amount = 0
    row.base_amount = 0
    return 0
  }
}

function syncDonationAmountFromPaymentDetail() {
  if (props.parentFieldname !== 'deduction_breakeven') return
  if (!parentDoc.value || !parentDoc.value.payment_detail || !rows.value) return
  rows.value.forEach((deductionRow) => {
    if (deductionRow.random_id) {
      const matchingPaymentRow = parentDoc.value.payment_detail.find(paymentRow => paymentRow.random_id === deductionRow.random_id)
      if (matchingPaymentRow) {
        const paymentDonationAmount = parseFloat(matchingPaymentRow.donation_amount) || 0
        const currentDeductionDonationAmount = parseFloat(deductionRow.donation_amount) || 0
        if (paymentDonationAmount !== currentDeductionDonationAmount) {
          deductionRow.donation_amount = paymentDonationAmount
          calculateDeductionAmount(deductionRow)
        }
      } else {
        if (deductionRow.donation_amount !== 0) {
          deductionRow.donation_amount = 0
          calculateDeductionAmount(deductionRow)
        }
      }
    }
  })
  forceReactiveUpdate()
}

async function fieldChange(value, field, row) {
  const normalizedValue = (value && typeof value === 'object')
    ? (value.value ?? value.name ?? '')
    : value

  const isModeOfPaymentField = field?.fieldname === 'mode_of_payment'
  const isPaymentDetailTable = props.parentFieldname === 'payment_detail'
  if (isModeOfPaymentField && isPaymentDetailTable) {
    triggerOnChange(field.fieldname, normalizedValue, row)
    return
  }

  // Payment detail donor_id -> fetch donor details
  if (field.fieldname === 'donor' && props.parentFieldname === 'payment_detail') {
    row.donor = normalizedValue
    if (normalizedValue) {
      const donorDetails = await fetchDonorDetails(normalizedValue)
      if (donorDetails) updateDonorFields(row, donorDetails)
    } else {
      clearDonorFields(row)
    }
    emit('donor-selected', { row, donorId: normalizedValue, success: !!normalizedValue })
    forceReactiveUpdate()
    triggerOnChange(field.fieldname, normalizedValue, row)
    return
  }

  // Deduction fund_class change
  if (field.fieldname === 'fund_class' && props.parentFieldname === 'deduction_breakeven') {
  if (normalizedValue) {
    const deductionDetails = await fetchDeductionDetails(normalizedValue)
    if (deductionDetails && Object.keys(deductionDetails).length > 0) {
      updateDeductionFields(row, deductionDetails)
      calculateDeductionAmount(row)
      toast.success('Deduction details fetched successfully')
    } else {
      clearDeductionFields(row)
      toast.info('No deduction details found for this fund class')
    }
  } else {
    clearDeductionFields(row)
    toast.info('Deduction fields cleared')
  }

  // 🔧 Trigger reactivity properly without breaking link
  await nextTick()
  forceReactiveUpdate() // if needed
  triggerOnChange(field.fieldname, normalizedValue, row)
  return
}


  // Fund class id change in payment_detail -> load fund class details and potentially add deduction rows
  if (field.fieldname === 'fund_class' && props.parentFieldname === 'payment_detail') {
    if (normalizedValue) {
      try {
        const fundClassDetails = await call('crm.fcrm.doctype.donation.api.get_fund_class_details', {
          fund_class: normalizedValue,
          company: parentDoc.value?.company || 'Alkhidmat Foundation Pakistan'
        })

        if (fundClassDetails && Object.keys(fundClassDetails).length > 0) {
          row.pay_service_area = fundClassDetails.service_area || ''
          row.pay_subservice_area = fundClassDetails.subservice_area || ''
          row.pay_product = fundClassDetails.product || ''
          row.fund_class = fundClassDetails.fund_class_name || normalizedValue
          row.equity_account = fundClassDetails.equity_account || ''
          row.receivable_account = fundClassDetails.receivable_account || ''
          toast.success('Fund class details loaded successfully')
        } else {
          toast.warning('No fund class details found')
        }
      } catch (error) {
        toast.error('Error loading fund class details')
      }

      const intentionId = row.intention_id || parentDoc.value?.intention_id
      if (intentionId === 'Zakat') {
        await clearDeductionBreakevenTable()
        toast.info('Deduction breakeven table cleared (Zakat intention)')
      } else {
        const deductionDetails = await fetchDeductionDetails(normalizedValue)
        if (deductionDetails && Object.keys(deductionDetails).length > 0) {
          const isArray = Array.isArray(deductionDetails)
          const detailsArray = isArray ? deductionDetails : [deductionDetails]
          let addedRowsCount = 0
          for (const detail of detailsArray) {
            const success = await addDeductionRowToParent(detail, normalizedValue, row.random_id, row.donor)
            if (success) addedRowsCount++
          }
          if (addedRowsCount > 0) toast.success(`${addedRowsCount} deduction rows added successfully`)
        } else {
          toast.info('No deduction details found for this fund class')
        }
      }
    }
    forceReactiveUpdate()
    triggerOnChange(field.fieldname, normalizedValue, row)
    return
  }

  // intention_id change handling
  let isProcessingIntentionChange = false
  if (field.fieldname === 'intention_id') {
    if (isProcessingIntentionChange) return
    isProcessingIntentionChange = true
    try {
      row.intention_id = normalizedValue
      if (normalizedValue === 'Zakat') {
        if (parentDoc.value && parentDoc.value.deduction_breakeven) {
          parentDoc.value.deduction_breakeven = [] 
          toast.info('Deduction breakeven table cleared (Zakat intention)')
        }
      } else if (normalizedValue && normalizedValue !== 'Zakat') {
        if (parentDoc.value && parentDoc.value.deduction_breakeven && Array.isArray(parentDoc.value.deduction_breakeven) && parentDoc.value.deduction_breakeven.length === 0 && parentDoc.value.payment_detail && Array.isArray(parentDoc.value.payment_detail) && parentDoc.value.payment_detail.length > 0) {
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
              toast.success(`Successfully populated ${result.deduction_breakeven.length} deduction breakeven rows`)
            }
          } catch {
            // ignore errors in fallback repopulation
          }
        }
      }
      forceReactiveUpdate()
      triggerOnChange(field.fieldname, normalizedValue, row)
    } finally {
      setTimeout(() => { isProcessingIntentionChange = false }, 1000)
    }
    return
  }

  // donation_amount change in payment_detail -> sync to deduction_breakeven
  if (field.fieldname === 'donation_amount' && props.parentFieldname === 'payment_detail') {
    row.donation_amount = normalizedValue
    if (parentDoc.value && parentDoc.value.deduction_breakeven) {
      const matchingDeductionRows = parentDoc.value.deduction_breakeven.filter(d => d.random_id === row.random_id)
      matchingDeductionRows.forEach((deductionRow) => {
        deductionRow.donation_amount = normalizedValue
        calculateDeductionAmount(deductionRow)
      })
      parentDoc.value.deduction_breakeven = [...parentDoc.value.deduction_breakeven]
    }
    forceReactiveUpdate()
    triggerOnChange(field.fieldname, normalizedValue, row)
    return
  }

  if (field.fieldname === 'percentage' && props.parentFieldname === 'deduction_breakeven') {
    row.percentage = value
    calculateDeductionAmount(row)
    rows.value = [...rows.value]
    forceReactiveUpdate()
    triggerOnChange(field.fieldname, value, row)
    return
  }

  if (props.parentFieldname === 'items') {
    // Enforce mutual exclusivity for In-Kind item condition checkboxes
    if (field.fieldname === 'new' || field.fieldname === 'used') {
      if (field.fieldname === 'new') {
        row.new = Boolean(normalizedValue)
        if (row.new) row.used = false
      } else if (field.fieldname === 'used') {
        row.used = Boolean(normalizedValue)
        if (row.used) row.new = false
      }
      forceReactiveUpdate()
      triggerOnChange(field.fieldname, Boolean(normalizedValue), row)
      return
    }

    if (field.fieldname === 'fund_class' && normalizedValue) {
      try {
        const fundClassDetails = await call('crm.fcrm.doctype.donation.api.get_fund_class_details', {
          fund_class: normalizedValue,
          company: parentDoc.value?.company || 'Alkhidmat Foundation'
        })
        if (fundClassDetails && Object.keys(fundClassDetails).length > 0) {
          if (fundClassDetails.service_area) row.service_area = fundClassDetails.service_area
          if (fundClassDetails.subservice_area) row.subservice_area = fundClassDetails.subservice_area
          if (fundClassDetails.product) row.product = fundClassDetails.product
          if (fundClassDetails.cost_center) row.cost_center = fundClassDetails.cost_center
          toast.success('Fund class details loaded successfully')
        } else {
          toast.warning('No fund class details found')
        }
      } catch {
        toast.error('Error loading fund class details')
      }
      emit('fund-class-selected', { row, fundClass: normalizedValue, success: !!normalizedValue })
      forceReactiveUpdate()
      triggerOnChange(field.fieldname, normalizedValue, row)
      return
    }

    if (field.fieldname === 'donor' && normalizedValue) {
      try {
        const donorDetails = await call('frappe.client.get', { doctype: 'Donor', name: normalizedValue })
        if (donorDetails) {
          if (donorDetails.donor_name) row.donor_name = donorDetails.donor_name
          if (donorDetails.donor_type) row.donor_type = donorDetails.donor_type
          if (donorDetails.donor_desk) row.donor_desk = donorDetails.donor_desk
          toast.success('Donor details loaded successfully')
        } else {
          toast.warning('No donor details found')
        }
      } catch {
        toast.error('Error loading donor details')
      }
      emit('donor-selected', { row, donorId: normalizedValue, success: !!normalizedValue })
      forceReactiveUpdate()
      triggerOnChange(field.fieldname, normalizedValue, row)
      return
    }

    if (field.fieldname === 'project' && normalizedValue) {
      try {
        const projectDetails = await call('frappe.client.get', { doctype: 'Project', name: normalizedValue })
        if (projectDetails) {
          if (projectDetails.cost_center) row.cost_center = projectDetails.cost_center
          if (projectDetails.custom_service_area) row.service_area = projectDetails.custom_service_area
          if (projectDetails.custom_subservice_area) row.subservice_area = projectDetails.custom_subservice_area
          if (projectDetails.custom_product) row.product = projectDetails.custom_product
          if (projectDetails.fund_class) row.fund_class = projectDetails.fund_class
          toast.success('Project details loaded successfully')
        } else {
          toast.warning('No project details found')
        }
      } catch {
        toast.error('Error loading project details')
      }
      forceReactiveUpdate()
      triggerOnChange(field.fieldname, normalizedValue, row)
      return
    }

    if (field.fieldname === 'item_code' && normalizedValue) {
      try {
        const itemDetails = await call('frappe.client.get', { doctype: 'Item', name: normalizedValue })
        if (itemDetails) {
          if (itemDetails.item_name) row.item_name = itemDetails.item_name
          if (itemDetails.valuation_rate) row.basic_rate = itemDetails.valuation_rate
          toast.success('Item details loaded successfully')
        } else {
          toast.warning('No item details found')
        }
      } catch {
        toast.error('Error loading item details')
      }
      forceReactiveUpdate()
      triggerOnChange(field.fieldname, normalizedValue, row)
      return
    }
  }

  triggerOnChange(field.fieldname, normalizedValue, row)
}

watch(
  () => parentDoc.value?.payment_detail,
  (newPaymentDetail) => {
    if (props.parentFieldname === 'deduction_breakeven' && newPaymentDetail) syncDonationAmountFromPaymentDetail()
  },
  { deep: true }
)

watch(
  () => parentDoc.value?.payment_detail?.map(row => row.donation_amount),
  () => {
    if (props.parentFieldname === 'deduction_breakeven') syncDonationAmountFromPaymentDetail()
  },
  { deep: true }
)

// Watch rows for donor_id changes (backup)
watch(rows, (newRows) => {
  if (!newRows) { rows.value = []; return }
  newRows.forEach((row) => {
    if (row.donor && row.donor !== row._lastDonorId) {
      row._lastDonorId = row.donor
      handleDonorSelectionFromWatcher(row.donor, row)
    }
  })
}, { deep: true })

async function handleDonorSelectionFromWatcher(donorId, row) {
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

function onAttachSuccess(file, field, row) {
  const fileUrl = file?.file_url || file?.name || ''
  row[field.fieldname] = fileUrl
  forceReactiveUpdate()
  triggerOnChange(field.fieldname, fileUrl, row)
}

function forceReactiveUpdate() {
  if (rows.value && Array.isArray(rows.value)) rows.value = [...rows.value]
}


function getDonorFilteringFromParent() {
  if (parentDoc.value) {
    return { donor_identity: parentDoc.value.donor_identity, currency: parentDoc.value.currency }
  }
  return {}
}

function getDonorFilteringFromData() {
  return getDonorFilteringFromParent()
}

async function handleGridRowModalFieldChange(rowIndex, fieldname, value) {
  console.log('🔥 Grid handleGridRowModalFieldChange called:', { 
    rowIndex, 
    fieldname, 
    value, 
    parentFieldname: props.parentFieldname,
    doctype: props.doctype 
  })

  const normalizedValue = (value && typeof value === 'object')
    ? (value.value ?? value.name ?? '')
    : value

  if (rowIndex >= 0 && rowIndex < data.value.length) {
    const row = data.value[rowIndex]
    row[fieldname] = normalizedValue
    
    // Find the field definition from allFields
    const field = allFields.value?.find(f => f.fieldname === fieldname)
    
    console.log('🔥 allFields has', allFields.value?.length, 'fields')
    console.log('🔥 Field found:', !!field, field ? `(${field.fieldname})` : '')
    console.log('🔥 Available field names:', allFields.value?.map(f => f.fieldname).join(', '))
    
    if (field) {
      // Call the main fieldChange function which has all the fetch logic
      console.log('🔥 Calling fieldChange with:', { value: normalizedValue, fieldname: field.fieldname, fieldtype: field.fieldtype })
      await fieldChange(normalizedValue, field, row)
    } else {
      console.warn('🔥 Field definition not found for:', fieldname, '- Creating temporary field object')
      // Create a temporary field object for fields not in allFields
      const tempField = {
        fieldname: fieldname,
        fieldtype: 'Link', // Assume Link for fund_class
        options: fieldname === 'fund_class' ? 'Fund Class' : undefined
      }
      console.log('🔥 Calling fieldChange with temporary field:', tempField)
      await fieldChange(normalizedValue, tempField, row)
    }
  }
}

async function handleFetchFromForItems(rowIndex, fieldname, value) {
  console.log('🔥 handleFetchFromForItems called:', { rowIndex, fieldname, value })
  
  try {
    const row = data.value[rowIndex]
    if (fieldname === 'fund_class') {
      console.log('🔥 Fetching fund class details for:', value)
      const fundClassDetails = await call('crm.fcrm.doctype.donation.api.get_fund_class_details', { fund_class: value, company: parentDoc.value?.company || 'Alkhidmat Foundation Pakistan' })
      console.log('🔥 Fund class details received:', fundClassDetails)
      
      if (fundClassDetails && Object.keys(fundClassDetails).length > 0) {
        if (fundClassDetails.service_area) {
          console.log('🔥 Setting service_area:', fundClassDetails.service_area)
          row.service_area = fundClassDetails.service_area
        }
        if (fundClassDetails.subservice_area) {
          console.log('🔥 Setting subservice_area:', fundClassDetails.subservice_area)
          row.subservice_area = fundClassDetails.subservice_area
        }
        if (fundClassDetails.product) {
          console.log('🔥 Setting product:', fundClassDetails.product)
          row.product = fundClassDetails.product
        }
        if (fundClassDetails.cost_center) {
          console.log('🔥 Setting cost_center:', fundClassDetails.cost_center)
          row.cost_center = fundClassDetails.cost_center
        }
        toast.success('Fund class details loaded successfully')
      } else {
        console.log('⚠️ No fund class details found')
        toast.warning('No fund class details found')
      }
    }

    if (fieldname === 'donor') {
      console.log('🔥 Fetching donor details for:', value)
      const donorDetails = await call('frappe.client.get', { doctype: 'Donor', name: value })
      console.log('🔥 Donor details received:', donorDetails)
      
      if (donorDetails) {
        if (donorDetails.donor_name) {
          console.log('🔥 Setting donor_name:', donorDetails.donor_name)
          row.donor_name = donorDetails.donor_name
        }
        if (donorDetails.donor_type) {
          console.log('🔥 Setting donor_type:', donorDetails.donor_type)
          row.donor_type = donorDetails.donor_type
        }
        if (donorDetails.donor_desk) {
          console.log('🔥 Setting donor_desk:', donorDetails.donor_desk)
          row.donor_desk = donorDetails.donor_desk
        }
        toast.success('Donor details loaded successfully')
      } else {
        console.log('⚠️ No donor details found')
        toast.warning('No donor details found')
      }
    }
    
    console.log('🔥 Forcing reactive update')
    forceReactiveUpdate()
  } catch (error) {
    console.error('❌ Error in handleFetchFromForItems:', error)
    toast.error(`Error loading ${fieldname} details`)
  }
}
// }
onMounted(() => {
})
</script>
