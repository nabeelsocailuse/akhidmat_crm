<template>
  <Dialog v-model="show" :options="{ size: '3xl' }">
    <template #body>
      <AppStyling type="donor-modal-background">
        <AppStyling type="modal-styling" modalType="header">
          <div class="mb-5 flex items-center justify-between">
            <div>
              <h3 class="text-2xl font-semibold leading-6 text-ink-gray-9">
                {{ __('Create Tax Exemption Certificate') }}
              </h3>
            </div>
            <div class="flex items-center gap-1">
              <Button
                v-if="isManager() && !isMobileView"
                variant="ghost"
                class="w-7"
                @click="openQuickEntryModal"
              >
                <template #icon>
                  <EditIcon />
                </template>
              </Button>
              <Button variant="ghost" class="w-7" @click="show = false">
                <template #icon>
                  <FeatherIcon name="x" class="size-4" />
                </template>
              </Button>
            </div>
          </div>
          <div>
            <FieldLayout v-if="tabs.data" :tabs="tabs.data" :data="certificate.doc" />
            <ErrorMessage class="mt-4" v-if="error" :message="__(error)" />
            <ErrorMessage
              class="mt-4"
              v-if="duplicateCnicError"
              :message="__('A certificate with this identification value already exists.')"
            />
          </div>
        </AppStyling>
        <AppStyling type="modal-styling" modalType="footer">
          <div class="flex flex-row-reverse gap-2">
            <AppStyling
              type="button"
              buttonType="create"
              buttonLabel="Create"
              :buttonLoading="isCertificateCreating"
              :disabled="duplicateCnicError"
              @click="createNewCertificate"
            />
          </div>
        </AppStyling>
      </AppStyling>
    </template>
  </Dialog>
</template>

<script setup>
import EditIcon from '@/components/Icons/EditIcon.vue';
import FieldLayout from '@/components/FieldLayout/FieldLayout.vue';
import AppStyling from '@/components/AppStyling.vue';
import { usersStore } from '@/stores/users';
import { statusesStore } from '@/stores/statuses';
import { sessionStore } from '@/stores/session';
import { isMobileView } from '@/composables/settings';
import { showQuickEntryModal, quickEntryProps } from '@/composables/modals';
import { createResource, call } from 'frappe-ui';
import { useDocument } from '@/data/document';
import { computed, ref, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';

const props = defineProps({
  defaults: Object,
});

const { user } = sessionStore();
const { getUser, isManager } = usersStore();
const { getCertificateStatus, statusOptions } = statusesStore();

const show = defineModel();
const router = useRouter();
const error = ref(null);
const isCertificateCreating = ref(false);

const { document: certificate, triggerOnBeforeCreate } = useDocument('Tax Exemption Certificate');

const setFieldValue = (fieldName, value) => {
  if (certificate.doc) {
    certificate.doc[fieldName] = value;
  }
};

const certificateStatuses = computed(() => {
  let statuses = statusOptions('certificate');
  if (!certificate.doc.status) {
    certificate.doc.status = statuses?.[0]?.value;
  }
  return statuses;
});

const tabs = createResource({
  url: 'crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_fields_layout',
  cache: ['QuickEntry', 'Tax Exemption Certificate'],
  params: { doctype: 'Tax Exemption Certificate', type: 'Quick Entry' },
  auto: true,
  transform: (_tabs) => {
    return _tabs.forEach((tab) => {
      tab.sections.forEach((section) => {
        section.columns.forEach((column) => {
          column.fields.forEach((field) => {
            if (field.fieldname == 'status') {
              field.fieldtype = 'Select';
              field.options = certificateStatuses.value;
              field.prefix = getCertificateStatus(certificate.doc.status).color;
            }
            if (field.fieldtype === 'Table') {
              certificate.doc[field.fieldname] = [];
            }
          });
        });
      });
    });
  },
});

const createCertificate = createResource({
  url: 'frappe.client.insert',
});

const duplicateCnicError = ref(false);

watch(
  () => certificate.doc && certificate.doc.custom_identification_value,
  async (newVal) => {
    duplicateCnicError.value = false;
    if (newVal && newVal.trim() !== '') {
      try {
        const res = await call('frappe.client.get_list', {
          doctype: 'Tax Exemption Certificate',
          fields: ['name'],
          filters: { custom_identification_value: newVal.trim() },
          limit_page_length: 1,
        });
        if (Array.isArray(res) && res.length > 0) {
          duplicateCnicError.value = true;
        }
      } catch (e) {
        duplicateCnicError.value = false;
      }
    }
  }
);

// Fetch donor details and populate readonly fields
async function fetchAndSetDonorDetails(donorId) {
  if (!donorId) {
    if (certificate.doc) {
      certificate.doc.donor_name = '';
      certificate.doc.donor_cnic__ntn = '';
      certificate.doc.donor_address = '';
    }
    return;
  }
  try {
    const donor = await call('frappe.client.get', {
      doctype: 'Donor',
      name: donorId,
    });
    if (donor && certificate.doc) {
      certificate.doc.donor_name = donor.donor_name || '';
      certificate.doc.donor_cnic__ntn = donor.cnic || '';
      certificate.doc.donor_address = donor.address || '';
    }
  } catch (e) {
    // ignore
  }
}

// Watch donor link to auto-fill related fields
watch(
  () => certificate.doc && certificate.doc.donor,
  async (newDonor, oldDonor) => {
    if (newDonor !== oldDonor) {
      await fetchAndSetDonorDetails(newDonor);
    }
  }
);

async function createNewCertificate() {
  if (duplicateCnicError.value) {
    error.value = __('A certificate with this identification value already exists.');
    return;
  }

  if (certificate.doc.website && !certificate.doc.website.startsWith('http')) {
    certificate.doc.website = 'https://' + certificate.doc.website;
  }

  await triggerOnBeforeCreate?.();

  createCertificate.submit(
    {
      doc: { doctype: 'Tax Exemption Certificate', ...certificate.doc },
    },
    {
      validate() {
        error.value = null;
        if (certificate.doc.mobile_no && isNaN(certificate.doc.mobile_no.replace(/[-+() ]/g, ''))) {
          error.value = __('Mobile No should be a number');
          return error.value;
        }
        if (certificate.doc.email && !certificate.doc.email.includes('@')) {
          error.value = __('Invalid Email');
          return error.value;
        }

        isCertificateCreating.value = true;
      },
      onSuccess(data) {
        isCertificateCreating.value = false;
        show.value = false;
        router.push({ name: 'TaxExemptionCertificate', params: { certificateId: data.name } });
      },
      onError(err) {
        isCertificateCreating.value = false;
        if (!err.messages) {
          error.value = err.message;
          return;
        }
        error.value = err.messages.join('\n');
      },
    }
  );
}
</script>

<style>
</style>