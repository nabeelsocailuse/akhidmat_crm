<template>
  <div class="flex flex-col gap-5.5">
    <div
      class="flex items-center gap-2 text-base bg-surface-gray-2 rounded py-2 px-2.5"
    >
      <Draggable
        v-if="tabs.length && tabs[tabIndex].label"
        :list="tabs"
        item-key="name"
        class="flex items-center gap-2"
        @end="(e) => (tabIndex = e.newIndex)"
      >
        <template #item="{ element: tab, index: i }">
          <div
            class="flex items-center gap-2 cursor-pointer rounded"
            :class="[
              tabIndex == i
                ? 'text-ink-gray-9 bg-surface-white shadow-sm'
                : 'text-ink-gray-5 hover:text-ink-gray-9 hover:bg-surface-white hover:shadow-sm',
              tab.editingLabel ? 'p-1' : 'px-2 py-1',
            ]"
            @click="tabIndex = i"
          >
            <div @dblclick="() => (tab.editingLabel = true)">
              <div v-if="!tab.editingLabel" class="flex items-center gap-2">
                {{ __(tab.label) || __('Untitled') }}
              </div>
              <div v-else class="flex gap-1 items-center">
                <Input
                  v-model="tab.label"
                  @keydown.enter="tab.editingLabel = false"
                  @blur="tab.editingLabel = false"
                  @click.stop
                />
                <Button
                  v-if="tab.editingLabel"
                  icon="check"
                  variant="ghost"
                  @click="tab.editingLabel = false"
                />
              </div>
            </div>
            <Dropdown
              v-if="tab.label && tabIndex == i"
              :options="getTabOptions(tab)"
              class="!h-4"
              @click.stop
            >
              <template #default>
                <Button variant="ghost" class="!p-1 !h-4">
                  <FeatherIcon name="more-horizontal" class="h-4" />
                </Button>
              </template>
            </Dropdown>
          </div>
        </template>
      </Draggable>
      <Button
        variant="ghost"
        class="!h-6.5 !text-ink-gray-5 hover:!text-ink-gray-9"
        @click="addTab"
        :label="__('Add Tab')"
      >
        <template v-slot:[slotName]>
          <FeatherIcon name="plus" class="h-4" />
        </template>
      </Button>
    </div>
    <div v-show="tabIndex == i" v-for="(tab, i) in tabs" :key="tab.name">
      <Draggable
        :list="tab.sections"
        item-key="name"
        class="flex flex-col gap-5.5"
      >
        <template #item="{ element: section, index: i }">
          <div
            class="section flex flex-col gap-1.5 p-2.5 bg-surface-gray-2 rounded cursor-grab"
          >
            <div class="flex items-center justify-between">
              <div
                class="flex h-7 max-w-fit cursor-pointer items-center gap-2 text-base font-medium leading-4 text-ink-gray-9"
                @dblclick="() => (section.editingLabel = true)"
              >
                <div
                  v-if="!section.editingLabel"
                  class="flex items-center gap-2"
                  :class="{
                    'text-ink-gray-3': section.hideLabel || !section.label,
                    italic: !section.label,
                  }"
                >
                  {{ __(section.label) || __('No label') }}
                </div>
                <div v-else class="flex gap-2 items-center">
                  <Input
                    v-model="section.label"
                    @keydown.enter="section.editingLabel = false"
                    @blur="section.editingLabel = false"
                    @click.stop
                  />
                  <Button
                    icon="check"
                    variant="ghost"
                    @click="section.editingLabel = false"
                  />
                </div>
              </div>
              <Dropdown
                :options="getSectionOptions(i, section, tab)"
                class="!h-4"
                @click.stop
              >
                <template #default>
                  <Button variant="ghost" class="!p-1 !h-4">
                    <FeatherIcon name="more-horizontal" class="h-4" />
                  </Button>
                </template>
              </Dropdown>
            </div>
            <div class="flex flex-col gap-1.5">
              <Draggable
                :list="section.columns"
                item-key="name"
                class="flex gap-2"
              >
                <template #item="{ element: column }">
                  <div
                    class="flex flex-col gap-1.5 flex-1 p-2 border border-dashed border-outline-gray-2 rounded bg-surface-modal cursor-grab"
                  >
                    <Draggable
                      :list="column.fields"
                      group="fields"
                      item-key="fieldname"
                      class="flex flex-col gap-1.5"
                      handle=".cursor-grab"
                    >
                      <template #item="{ element: field }">
                        <div
                          class="field px-2.5 py-2 border border-outline-gray-2 rounded text-base bg-surface-modal text-ink-gray-8 flex items-center leading-4 justify-between gap-2"
                        >
                          <div class="flex items-center gap-2 truncate">
                            <DragVerticalIcon class="h-3.5 cursor-grab" />
                            <div class="truncate">{{ field.label }}</div>
                          </div>
                          <Button
                            variant="ghost"
                            class="!size-4 rounded-sm"
                            icon="x"
                            @click="
                              column.fields.splice(
                                column.fields.indexOf(field),
                                1,
                              )
                            "
                          />
                        </div>
                      </template>
                    </Draggable>
                    
                    <!-- Field Selection Dropdown -->
                    <div class="mt-2">
                      <Dropdown
                        :options="getFieldOptions(column)"
                        placement="bottom-start"
                        class="w-full"
                      >
                        <template #default>
                          <Button
                            class="w-full !h-8 !bg-surface-modal"
                            variant="outline"
                            :label="__('Add Field')"
                          >
                            <template #prefix>
                              <FeatherIcon name="plus" class="h-4" />
                            </template>
                          </Button>
                        </template>
                      </Dropdown>
                    </div>
                  </div>
                </template>
              </Draggable>
            </div>
          </div>
        </template>
      </Draggable>
      <div class="mt-5.5">
        <Button
          class="w-full h-8"
          variant="subtle"
          :label="__('Add Section')"
          @click="
            tabs[tabIndex].sections.push({
              label: __('New Section'),
              name: 'section_' + getRandom(),
              opened: true,
              columns: [{ name: 'column_' + getRandom(), fields: [] }],
            })
          "
        >
          <template #prefix>
            <FeatherIcon name="plus" class="h-4" />
          </template>
        </Button>
      </div>
    </div>
  </div>
</template>
<script setup>
import DragVerticalIcon from '@/components/Icons/DragVerticalIcon.vue'
import Draggable from 'vuedraggable'
import { getRandom } from '@/utils'
import { Dropdown, createResource, Input, Button, FeatherIcon } from 'frappe-ui'
import { ref, computed, watch, nextTick } from 'vue'

const props = defineProps({
  tabs: Object,
  doctype: String,
  onlyRequired: {
    type: Boolean,
    default: false,
  },
})

const tabIndex = ref(0)

const slotName = computed(() => {
  if (props.tabs.length == 1 && !props.tabs[0].label) {
    return 'prefix'
  }
  return 'default'
})

const restrictedFieldTypes = [
  'Geolocation',
  'Attach',
  'Attach Image',
  'HTML',
  'Signature',
]

const params = computed(() => {
  return {
    doctype: props.doctype,
    restricted_fieldtypes: restrictedFieldTypes,
    as_array: true,
    only_required: props.onlyRequired,
  }
})

// Get all fields from the doctype
const fields = createResource({
  url: 'crm.api.doc.get_fields_meta',
  params: params.value,
  cache: ['fieldsMeta', props.doctype],
  auto: true,
  onSuccess: (data) => {
    console.log('=== FIELDS LOADED SUCCESSFULLY ===')
    console.log('Number of fields:', data ? data.length : 0)
    if (data && data.length > 0) {
      console.log('First field sample:', data[0])
    }
  },
  onError: (error) => {
    console.error('Error loading fields:', error)
  }
})

// Get available fields for a specific column
function getFieldOptions(column) {
  if (!fields.data || !Array.isArray(fields.data)) {
    return []
  }

  let restrictedFields = [
    'name',
    'owner',
    'creation',
    'modified',
    'modified_by',
    'docstatus',
    '_comments',
    '_user_tags',
    '_assign',
    '_liked_by',
  ]

  // Get existing fields in this column
  const existingFieldnames = column.fields.map(f => f.fieldname)

  // Filter out restricted fields and already added fields
  const availableFields = fields.data.filter((field) => {
    return !restrictedFields.includes(field.fieldname) && 
           !existingFieldnames.includes(field.fieldname)
  })

  // Convert to dropdown options format
  return availableFields.map(field => ({
    label: `${field.label} (${field.fieldname})`,
    icon: 'plus',
    onClick: () => addField(column, field)
  }))
}

function addTab() {
  if (props.tabs.length == 1 && !props.tabs[0].label) {
    props.tabs[0].label = __('New Tab')
    return
  }

  props.tabs.push({
    label: __('New Tab'),
    name: 'tab_' + getRandom(),
    sections: [],
  })
  tabIndex.value = props.tabs.length ? props.tabs.length - 1 : 0
}

function addField(column, field) {
  console.log('=== addField called ===')
  console.log('Field parameter:', field)
  console.log('Column:', column)

  if (!field) {
    console.log('addField: No field provided')
    return
  }

  // Check for duplicates
  const existingField = column.fields.find(f => f.fieldname === field.fieldname)
  if (existingField) {
    console.log('Field already exists in this column:', field.fieldname)
    return
  }

  // Add the field
  column.fields.push(field)

  // Force reactivity update
  column.fields = [...column.fields]

  console.log('Field added successfully:', field)
  console.log('Column fields after adding:', column.fields)
}

function getTabOptions(tab) {
  return [
    {
      label: __('Edit'),
      icon: 'edit',
      onClick: () => (tab.editingLabel = true),
    },
    {
      label: __('Remove tab'),
      icon: 'trash-2',
      onClick: () => {
        if (props.tabs.length == 1) {
          props.tabs[0].label = ''
          return
        }
        props.tabs.splice(tabIndex.value, 1)
        tabIndex.value = tabIndex.value ? tabIndex.value - 1 : 0
      },
    },
  ]
}

function getSectionOptions(i, section, tab) {
  let column = section.columns[section.columns.length - 1]
  return [
    {
      group: __('Section'),
      items: [
        {
          label: __('Edit'),
          icon: 'edit',
          onClick: () => (section.editingLabel = true),
        },
        {
          label: __('Remove section'),
          icon: 'trash-2',
          onClick: () => {
            if (tab.sections.length == 1) {
              tab.sections[0].label = ''
              return
            }
            tab.sections.splice(i, 1)
          },
        },
      ],
    },
    {
      group: __('Column'),
      items: [
        {
          label: __('Add column'),
          icon: 'columns',
          onClick: () => {
            section.columns.push({
              label: '',
              name: 'column_' + getRandom(),
              fields: [],
            })
          },
          condition: () => section.columns.length < 4,
        },
        {
          label: __('Remove column'),
          icon: 'trash-2',
          onClick: () => section.columns.pop(),
          condition: () => section.columns.length > 1,
        },
        {
          label: __('Remove and move fields to previous column'),
          icon: 'trash-2',
          onClick: () => {
            let previousColumn = section.columns[section.columns.length - 2]
            previousColumn.fields = previousColumn.fields.concat(column.fields)
            section.columns.pop()
          },
          condition: () => section.columns.length > 1 && column.fields.length,
        },
        {
          label: __('Move to next section'),
          icon: 'corner-up-right',
          onClick: () => {
            let nextSection = tab.sections[i + 1]
            nextSection.columns.push(column)
            section.columns.pop()
          },
          condition: () => tab.sections[i + 1],
        },
        {
          label: __('Move to previous section'),
          icon: 'corner-up-left',
          onClick: () => {
            let previousSection = tab.sections[i - 1]
            previousSection.columns.push(column)
            section.columns.pop()
          },
          condition: () => tab.sections[i + 1],
        },
      ],
    },
  ]
}

watch(
  () => props.doctype,
  () => {
    if (props.doctype) {
      console.log('Doctype changed to:', props.doctype)
      fields.fetch(params.value)
    }
  },
  { immediate: true }
)
</script>
