<template>
  <div class="sections flex flex-col overflow-y-auto">
    <template v-for="(section, i) in _sections" :key="section.name">
      <div v-if="section.visible" class="section flex flex-col">
        <div
          v-if="i !== firstVisibleIndex()"
          class="w-full section-border h-px border-t"
        />
        <div class="p-1 sm:p-3">
          <Section
            labelClass="px-2 font-semibold"
            headerClass="h-8"
            :label="section.label"
            :hideLabel="!section.label"
            :opened="section.opened"
          >
            <template v-if="!preview" #actions>
              <slot name="actions" v-bind="{ section }">
                <Button
                  v-if="section.showEditButton"
                  variant="ghost"
                  class="w-7 mr-2"
                  @click="showSidePanelModal = true"
                >
                  <template #icon>
                    <EditIcon />
                  </template>
                </Button>
              </slot>
            </template>
            <slot v-bind="{ section }">
              <FadedScrollableDiv
                v-if="section.columns?.[0].fields.length"
                class="column flex flex-col gap-1.5 overflow-y-auto"
              >
                <template
                  v-for="field in section.columns[0].fields || []"
                  :key="field.fieldname"
                >
                  <div
                    v-if="field.visible"
                    class="field flex items-center gap-2 px-3 leading-5 first:mt-3"
                  >
                    <Tooltip :text="__(field.label)" :hoverDelay="1">
                      <div
                        class="w-[35%] min-w-20 shrink-0 flex items-center gap-0.5"
                      >
                        <div class="truncate text-sm text-ink-gray-5">
                          {{ __(field.label) }}
                        </div>
                        <div
                          v-if="
                            field.reqd ||
                            (field.mandatory_depends_on &&
                              field.mandatory_via_depends_on)
                          "
                          class="text-ink-red-2"
                        >
                          *
                        </div>
                      </div>
                    </Tooltip>
                    <div class="flex items-center justify-between w-[65%]">
                      <div
                        class="grid min-h-[28px] flex-1 items-center overflow-hidden text-base"
                      >
                        <div
                          v-if="
                            field.read_only &&
                            ![
                              'Int',
                              'Float',
                              'Currency',
                              'Percent',
                              'Check',
                              'Dropdown',
                            ].includes(field.fieldtype)
                          "
                          class="flex h-7 cursor-pointer items-center px-2 py-1 text-ink-gray-5"
                        >
                          <Tooltip :text="__(field.tooltip)">
                            <div>{{ doc[field.fieldname] }}</div>
                          </Tooltip>
                        </div>
                        <div v-else-if="field.fieldtype === 'Dropdown'">
                          <NestedPopover>
                            <template #target="{ open }">
                              <Button
                                :label="doc[field.fieldname]"
                                class="dropdown-button flex w-full items-center justify-between rounded border border-gray-100 bg-surface-gray-2 px-2 py-1.5 text-base text-ink-gray-8 placeholder-ink-gray-4 transition-colors hover:border-outline-gray-modals hover:bg-surface-gray-3 focus:border-outline-gray-4 focus:bg-surface-white focus:shadow-sm focus:outline-none focus:ring-0 focus-visible:ring-2 focus-visible:ring-outline-gray-3"
                              >
                                <div
                                  v-if="doc[field.fieldname]"
                                  class="truncate"
                                >
                                  {{ doc[field.fieldname] }}
                                </div>
                                <div
                                  v-else
                                  class="text-base leading-5 text-ink-gray-4 truncate"
                                >
                                  {{ field.placeholder }}
                                </div>
                                <template #suffix>
                                  <FeatherIcon
                                    :name="open ? 'chevron-up' : 'chevron-down'"
                                    class="h-4 text-ink-gray-5"
                                  />
                                </template>
                              </Button>
                            </template>
                            <template #body>
                              <div
                                class="my-2 p-1.5 min-w-40 space-y-1.5 divide-y divide-outline-gray-1 rounded-lg bg-surface-modal shadow-2xl ring-1 ring-black ring-opacity-5 focus:outline-none"
                              >
                                <div>
                                  <DropdownItem
                                    v-if="field.options?.length"
                                    v-for="option in field.options"
                                    :key="option.name"
                                    :option="option"
                                  />
                                  <div v-else>
                                    <div
                                      class="p-1.5 pl-3 pr-4 text-base text-ink-gray-4"
                                    >
                                      {{
                                        __('No {0} Available', [field.label])
                                      }}
                                    </div>
                                  </div>
                                </div>
                                <div class="pt-1.5">
                                  <Button
                                    variant="ghost"
                                    class="w-full !justify-start"
                                    :label="__('Create New')"
                                    @click="field.create()"
                                  >
                                    <template #prefix>
                                      <FeatherIcon name="plus" class="h-4" />
                                    </template>
                                  </Button>
                                </div>
                              </div>
                            </template>
                          </NestedPopover>
                        </div>
                        <FormControl
                          v-else-if="field.fieldtype == 'Check'"
                          class="form-control"
                          type="checkbox"
                          v-model="doc[field.fieldname]"
                          @change.stop="
                            fieldChange($event.target.checked, field)
                          "
                          :disabled="Boolean(field.read_only)"
                        />
                        <FormControl
                          v-else-if="
                            [
                              'Small Text',
                              'Text',
                              'Long Text',
                              'Code',
                            ].includes(field.fieldtype)
                          "
                          class="form-control"
                          type="textarea"
                          :value="doc[field.fieldname]"
                          :placeholder="field.placeholder"
                          :debounce="500"
                          @change.stop="fieldChange($event.target.value, field)"
                        />
                        <FormControl
                          v-else-if="field.fieldtype === 'Select'"
                          class="form-control cursor-pointer [&_select]:cursor-pointer truncate"
                          type="select"
                          v-model="doc[field.fieldname]"
                          :options="field.options"
                          :placeholder="field.placeholder"
                          @change.stop="fieldChange($event.target.value, field)"
                        />
                        <Link
                          v-else-if="field.fieldtype === 'User'"
                          class="form-control"
                          :value="
                            doc[field.fieldname] &&
                            getUser(doc[field.fieldname]).full_name
                          "
                          doctype="User"
                          :filters="field.filters"
                          @change="(v) => fieldChange(v, field)"
                          :placeholder="'Select' + ' ' + field.label + '...'"
                          :hideMe="true"
                        >
                          <template v-if="doc[field.fieldname]" #prefix>
                            <UserAvatar
                              class="mr-1.5"
                              :user="doc[field.fieldname]"
                              size="sm"
                            />
                          </template>
                          <template #item-prefix="{ option }">
                            <UserAvatar
                              class="mr-1.5"
                              :user="option.value"
                              size="sm"
                            />
                          </template>
                          <template #item-label="{ option }">
                            <Tooltip :text="option.value">
                              <div class="cursor-pointer">
                                {{ getUser(option.value).full_name }}
                              </div>
                            </Tooltip>
                          </template>
                        </Link>
                        <Link
                          v-else-if="
                            ['Link', 'Dynamic Link'].includes(field.fieldtype)
                          "
                          class="form-control select-text"
                          :value="doc[field.fieldname]"
                          :doctype="
                            field.fieldtype == 'Link'
                              ? field.options
                              : doc[field.options]
                          "
                          :filters="field.filters"
                          :placeholder="field.placeholder"
                          @change="(v) => fieldChange(v, field)"
                          :onCreate="field.create"
                        />
                        <div
                          v-else-if="field.fieldtype === 'Datetime'"
                          class="form-control"
                        >
                          <DateTimePicker
                            icon-left=""
                            :value="doc[field.fieldname]"
                            :formatter="
                              (date) => getFormat(date, '', true, true)
                            "
                            :placeholder="field.placeholder"
                            placement="left-start"
                            :hideIcon="true"
                            @change="(v) => fieldChange(v, field)"
                          />
                        </div>
                        <div
                          v-else-if="field.fieldtype === 'Date'"
                          class="form-control"
                        >
                          <DatePicker
                            icon-left=""
                            :value="doc[field.fieldname]"
                            :formatter="(date) => getFormat(date, '', true)"
                            :placeholder="field.placeholder"
                            placement="left-start"
                            :hideIcon="true"
                            @change="(v) => fieldChange(v, field)"
                          />
                        </div>
                        <FormattedInput
                          v-else-if="field.fieldtype === 'Percent'"
                          class="form-control"
                          type="text"
                          :value="getFormattedPercent(field.fieldname, doc)"
                          :placeholder="field.placeholder"
                          :debounce="500"
                          @change.stop="
                            fieldChange(flt($event.target.value), field)
                          "
                          :disabled="Boolean(field.read_only)"
                        />
                        <Password
                          v-else-if="field.fieldtype === 'Password'"
                          class="form-control"
                          :value="doc[field.fieldname]"
                          :placeholder="field.placeholder"
                          :debounce="500"
                          @change.stop="fieldChange($event.target.value, field)"
                          :disabled="Boolean(field.read_only)"
                        />
                        <FormattedInput
                          v-else-if="field.fieldtype === 'Int'"
                          class="form-control"
                          type="text"
                          :value="doc[field.fieldname] || '0'"
                          :placeholder="field.placeholder"
                          :debounce="500"
                          @change.stop="fieldChange($event.target.value, field)"
                          :disabled="Boolean(field.read_only)"
                        />
                        <FormattedInput
                          v-else-if="field.fieldtype === 'Float'"
                          class="form-control"
                          type="text"
                          :value="getFormattedFloat(field.fieldname, doc)"
                          :placeholder="field.placeholder"
                          :debounce="500"
                          @change.stop="
                            fieldChange(flt($event.target.value), field)
                          "
                          :disabled="Boolean(field.read_only)"
                        />
                        <FormattedInput
                          v-else-if="field.fieldtype === 'Currency'"
                          class="form-control"
                          type="text"
                          :value="getFormattedCurrency(field.fieldname, doc)"
                          :placeholder="field.placeholder"
                          :debounce="500"
                          @change.stop="
                            fieldChange(flt($event.target.value), field)
                          "
                          :disabled="Boolean(field.read_only)"
                        />
                        <FormControl
                          v-else
                          class="form-control"
                          type="text"
                          :value="doc[field.fieldname]"
                          :placeholder="field.placeholder"
                          :debounce="500"
                          @change.stop="fieldChange($event.target.value, field)"
                        />
                      </div>
                      <div class="ml-1">
                        <ArrowUpRightIcon
                          v-if="
                            field.fieldtype === 'Link' &&
                            field.link &&
                            doc[field.fieldname]
                          "
                          class="h-4 w-4 shrink-0 cursor-pointer text-ink-gray-5 hover:text-ink-gray-8"
                          @click.stop="field.link(doc[field.fieldname])"
                        />
                        <EditIcon
                          v-if="
                            field.fieldtype === 'Link' &&
                            field.edit &&
                            doc[field.fieldname]
                          "
                          class="size-3.5 shrink-0 cursor-pointer text-ink-gray-5 hover:text-ink-gray-8"
                          @click.stop="field.edit(doc[field.fieldname])"
                        />
                      </div>
                    </div>
                  </div>
                </template>
              </FadedScrollableDiv>
            </slot>
          </Section>
        </div>
      </div>
    </template>
  </div>
  <SidePanelModal
    v-if="showSidePanelModal"
    v-model="showSidePanelModal"
    :doctype="doctype"
    @reload="() => emit('reload')"
  />
</template>

<script setup>
import Password from '@/components/Controls/Password.vue'
import FormattedInput from '@/components/Controls/FormattedInput.vue'
import Section from '@/components/Section.vue'
import NestedPopover from '@/components/NestedPopover.vue'
import DropdownItem from '@/components/DropdownItem.vue'
import FadedScrollableDiv from '@/components/FadedScrollableDiv.vue'
import ArrowUpRightIcon from '@/components/Icons/ArrowUpRightIcon.vue'
import EditIcon from '@/components/Icons/EditIcon.vue'
import Link from '@/components/Controls/Link.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import SidePanelModal from '@/components/Modals/SidePanelModal.vue'
import { getMeta } from '@/stores/meta'
import { usersStore } from '@/stores/users'
import { isMobileView } from '@/composables/settings'
import { getFormat, evaluateDependsOnValue } from '@/utils'
import { flt } from '@/utils/numberFormat.js'
import { Tooltip, DateTimePicker, DatePicker } from 'frappe-ui'
import { useDocument } from '@/data/document'
import { ref, computed, getCurrentInstance, watch } from 'vue'

const props = defineProps({
  sections: {
    type: Object,
  },
  doctype: {
    type: String,
    default: 'CRM Lead',
    required: true,
  },
  docname: {
    type: String,
    required: true,
  },
  preview: {
    type: Boolean,
    default: false,
  },
  addContact: {
    type: Function,
  },
})

const emit = defineEmits(['beforeFieldChange', 'afterFieldChange', 'reload'])

const { getFormattedPercent, getFormattedFloat, getFormattedCurrency } =
  getMeta(props.doctype)

const { users, isManager, getUser } = usersStore()

const showSidePanelModal = ref(false)

let document = { doc: {} }
let triggerOnChange

if (props.docname) {
  let d = useDocument(props.doctype, props.docname)
  document = d.document
  triggerOnChange = d.triggerOnChange
}

const doc = computed(() => document.doc || {})

const _sections = computed(() => {
  if (!props.sections?.length) return []
  let editButtonAdded = false
  return props.sections.map((section) => {
    if (section.columns?.length) {
      section.columns[0].fields = section.columns[0].fields.map((field) => {
        return parsedField(field)
      })
    }
    let _section = parsedSection(section, editButtonAdded)
    if (_section.showEditButton) {
      editButtonAdded = true
    }
    return _section
  })
})

function parsedField(field) {
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
      name: ['in', users.data?.crmUsers?.map((user) => user.name)],
    })
  }

  // Make owner_id field readonly for Donor doctype
  if (field.fieldname === 'owner_id' && props.doctype === 'Donor') {
    field.read_only = true
  }

  // Configure department field as required for Donor doctype
  if (field.fieldname === 'department' && props.doctype === 'Donor') {
    field.reqd = true
    field.placeholder = 'Select Department *'
  }

  // Configure donor_desk field with set query functionality for Donor doctype
  if (field.fieldname === 'donor_desk' && props.doctype === 'Donor') {
    // Set up the get_query function for dynamic filtering based on department
    field.get_query = () => {
      const department = doc.value?.department
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
    if (!doc.value?.department) {
      field.placeholder = 'Please select a department first *'
      field.description = 'Please select a department to see available donor desks'
      field.read_only = true
    } else {
      field.placeholder = 'Select Donor Desk *'
      field.description = ''
      field.read_only = false
    }
    
    // Mark field as required
    field.reqd = true
    
    // Ensure field is always visible
    field.hidden = false
    
    // Add a dynamic key to force field reload when department changes
    field._departmentKey = doc.value?.department || 'no-department'
  }

  let _field = {
    ...field,
    filters: field.link_filters && JSON.parse(field.link_filters),
    placeholder: field.placeholder || field.label,
    display_via_depends_on: evaluateDependsOnValue(field.depends_on, doc.value),
    mandatory_via_depends_on: evaluateDependsOnValue(
      field.mandatory_depends_on,
      doc.value,
    ),
  }

  _field.visible = isFieldVisible(_field)
  return _field
}

const instance = getCurrentInstance()
const attrs = instance?.vnode?.props ?? {}

// Watch for department changes to clear donor_desk field and force field reload
watch(
  () => doc.value?.department,
  (newDepartment, oldDepartment) => {
    if (props.doctype === 'Donor' && oldDepartment !== undefined && newDepartment !== oldDepartment) {
      console.log('Department changed, clearing donor_desk field:', {
        oldDepartment,
        newDepartment
      })
      
      // Clear donor_desk when department changes
      if (document.doc && document.doc.donor_desk) {
        document.doc.donor_desk = ''
        // Trigger change for donor_desk field
        triggerOnChange('donor_desk', '')
      }
      
      // Force a reload of the sections to update field states
      emit('reload')
      
      // Force clear any cached options in Link components
      nextTick(() => {
        // This will trigger the key change and force Link component reload
        console.log('Forcing field reload after department change')
      })
    }
  }
)

async function fieldChange(value, df) {
  if (props.preview) return

  // Handle special case: when department changes, clear donor_desk field
  if (df.fieldname === 'department' && props.doctype === 'Donor') {
    // Clear the donor_desk field when department changes
    if (document.doc && document.doc.donor_desk) {
      document.doc.donor_desk = ''
      // Also trigger change for donor_desk field
      await triggerOnChange('donor_desk', '')
    }
  }

  await triggerOnChange(df.fieldname, value)

  const hasListener = attrs['onBeforeFieldChange'] !== undefined

  if (hasListener) {
    emit('beforeFieldChange', { [df.fieldname]: value })
  } else {
    document.save.submit(null, {
      onSuccess: () => emit('afterFieldChange', { [df.fieldname]: value }),
    })
  }
}

function parsedSection(section, editButtonAdded) {
  let isContactSection = section.name == 'contacts_section'
  section.showEditButton = !(
    isMobileView.value ||
    !isManager() ||
    isContactSection ||
    editButtonAdded
  )

  section.visible =
    isContactSection ||
    section.columns?.[0].fields.filter((f) => f.visible).length

  return section
}

function isFieldVisible(field) {
  if (props.preview) return true
  return (
    (field.fieldtype == 'Check' ||
      (field.read_only && doc.value?.[field.fieldname]) ||
      !field.read_only) &&
    (!field.depends_on || field.display_via_depends_on) &&
    !field.hidden
  )
}

function firstVisibleIndex() {
  return _sections.value.findIndex((section) => section.visible)
}
</script>

<style scoped>
.form-control {
  margin: 2px;
}

:deep(.form-control input:not([type='checkbox'])),
:deep(.form-control select),
:deep(.form-control textarea),
:deep(.form-control button),
.dropdown-button {
  border-color: transparent;
  background: transparent;
}

:deep(.form-control button) {
  gap: 0;
}
:deep(.form-control [type='checkbox']) {
  margin-left: 9px;
  cursor: pointer;
}

:deep(.form-control button > div) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.form-control button svg) {
  color: white;
  width: 0;
}

.sections .section .column {
  max-height: 300px;
}
.sections .section:last-of-type .column {
  max-height: none;
}
</style>
