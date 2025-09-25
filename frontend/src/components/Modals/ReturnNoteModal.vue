<template>
  <!-- Thin wrapper that reuses the Create Donation form -->
  <DonationModal
    v-if="show"
    v-model="show"
    :defaults="defaultsRef || {}"
    :options="{ isReturn: true, afterInsert: () => emit('success') }"
  />
</template>

<script setup>
import DonationModal from '@/components/Modals/DonationModal.vue'
import { ref, watch } from 'vue'
import { call } from 'frappe-ui'

const props = defineProps({
  donationId: { type: String, required: false },
  donationDoc: { type: Object, required: false },
})

const emit = defineEmits(['success'])

const show = defineModel()
const defaultsRef = ref(null)

function deepClone(obj) {
  try {
    return JSON.parse(JSON.stringify(obj))
  } catch (e) {
    return {}
  }
}

function sanitizeChildRows(rows = []) {
  return (rows || []).map((r) => {
    const clone = { ...r }
    delete clone.name
    delete clone.owner
    delete clone.creation
    delete clone.modified
    delete clone.modified_by
    delete clone.docstatus
    return clone
  })
}

function buildReturnDefaults(src) {
  const base = deepClone(src || {})
  delete base.name
  delete base.owner
  delete base.creation
  delete base.modified
  delete base.modified_by
  base.docstatus = 0
  base.status = 'Draft'
  base.is_return = 1
  base.return_against = src?.name || ''
  base.payment_detail = sanitizeChildRows(base.payment_detail)
  base.items = sanitizeChildRows(base.items)
  base.deduction_breakeven = sanitizeChildRows(base.deduction_breakeven)
  return Object.freeze(base)
}

async function ensureDefaultsOnce() {
  if (defaultsRef.value || !show.value) return
  let source = props.donationDoc
  if (!source && props.donationId) {
    try {
      // Single fetch, no loops
      source = await call('frappe.client.get', {
        doctype: 'Donation',
        name: props.donationId,
      })
    } catch (e) {
      source = {}
    }
  }
  defaultsRef.value = buildReturnDefaults(source || {})
}

watch(() => show.value, async (val) => {
  if (val) {
    defaultsRef.value = null
    await ensureDefaultsOnce()
  }
})
</script>

<style>
</style>