<template>
  <AppStyling type="detail-background">
    <LayoutHeader v-if="document.doc">
      <template #left-header>
        <Breadcrumbs :items="breadcrumbs" />
      </template>
      <template #right-header>
        <CustomActions
          v-if="document.doc.actions?.length"
          :actions="document.doc.actions"
        />
        <Dropdown v-if="document.doc" :options="donationStatusOptions">
          <template #default="{ open }">
            <Button :label="document.doc.status || 'Draft'">
              <template #prefix>
                <IndicatorIcon :class="getDonationStatus(document.doc.status).color" />
              </template>
              <template #suffix>
                <FeatherIcon :name="open ? 'chevron-up' : 'chevron-down'" class="h-4" />
              </template>
            </Button>
          </template>
        </Dropdown>
        <AssignTo v-model="assignees.data" :data="document.doc" doctype="Donation" />
        <Button label="Print" @click="printDonation" />
        <Button label="PDF" @click="openDonationPDF" />
        <Button
          v-if="
            document.doc &&
            document.doc.docstatus === 0 &&
            document.doc.status === 'Draft'
          "
          label="Submit"
          variant="solid"
          @click="submitDonation"
        />
        <Dropdown
          v-if="
            document.doc &&
            document.doc.docstatus === 1 &&
            !document.doc.is_return &&
            (document.doc.status || '').toLowerCase() !== 'credit note issued' &&
            (document.doc.donation_type || '').toLowerCase() !== 'in kind donation'
          "
          :options="createDropdownOptions"
        >
          <template #default="{ open }">
            <Button label="Create">
              <template #suffix>
                <FeatherIcon :name="open ? 'chevron-up' : 'chevron-down'" class="h-4" />
              </template>
            </Button>
          </template>
        </Dropdown>
        <Button
          v-if="showReverseDonorButton"
          label="Reverse Donor"
          @click="openReverseDonorModal"
        />
      </template>
    </LayoutHeader>

    <div v-if="document.doc" class="flex h-full overflow-hidden">
      <Tabs as="div" v-model="tabIndex" :tabs="tabs">
        <template #tab-panel>
          <Activities
            v-if="document.doc && document.doc.name"
            ref="activities"
            doctype="Donation"
            :docname="document.doc.name"
            :tabs="tabs"
            :hideSaveButton="isReadOnly"
            :readOnly="isReadOnly"
            v-model:reload="reload"
            v-model:tabIndex="tabIndex"
            @beforeSave="saveChanges"
            @afterSave="reloadAssignees"
          />
        </template>
      </Tabs>

      <Resizer class="flex flex-col justify-between border-l" side="right">
        <div
          class="flex h-10.5 cursor-copy items-center border-b px-5 py-2.5 text-lg font-medium text-ink-gray-9"
          @click="handleCopyToClipboard(document.doc.name)"
        >
          {{ __(document.doc.name) }}
        </div>

        <FileUploader
          @success="(file) => updateField('image', file.file_url)"
          :validateFile="validateIsImageFile"
        >
          <template #default="{ openFileSelector, error }">
            <div class="flex items-center justify-start gap-5 border-b p-5">
              <div class="group relative size-12">
                <Avatar
                  size="3xl"
                  class="size-12"
                  :label="title"
                  :image="document.doc.image"
                />
                <component
                  :is="document.doc.image ? Dropdown : 'div'"
                  v-bind="
                    document.doc.image
                      ? {
                          options: [
                            {
                              icon: 'upload',
                              label: document.doc.image
                                ? __('Change image')
                                : __('Upload image'),
                              onClick: openFileSelector,
                            },
                            {
                              icon: 'trash-2',
                              label: __('Remove image'),
                              onClick: () => updateField('image', ''),
                            },
                          ],
                        }
                      : { onClick: openFileSelector }
                  "
                  class="!absolute bottom-0 left-0 right-0"
                >
                  <div
                    class="flex h-3 w-3 cursor-pointer items-center justify-center rounded-full bg-white shadow-sm"
                  >
                    <CameraIcon class="h-2 w-2 text-gray-600" />
                  </div>
                </component>
              </div>
              <div class="flex flex-col">
                <div class="text-base font-medium text-gray-900">
                  {{ title }}
                </div>
                <div class="text-sm text-gray-500">
                  {{ donorName || __("No donor name") }}
                </div>
              </div>
            </div>
          </template>
        </FileUploader>

        <SLASection
          v-if="document.doc.sla_status"
          v-model="document.doc"
          @updateField="updateField"
        />

        <div
          v-if="sections.data"
          class="flex flex-1 flex-col justify-between overflow-hidden"
        >
          <SidePanelLayout
            :sections="computedSections"
            doctype="Donation"
            :docname="document.doc.name"
            :readOnly="isReadOnly"
            @reload="sections.reload"
            @afterFieldChange="reloadAssignees"
            @open-create-modal="openCreateModal"
          />
          <template v-for="(modal, idx) in modalStack" :key="idx">
            <CreateDocumentModal
              v-model="modal.visible"
              :doctype="modal.doctype"
              :data="{ name: modal.initialValue }"
              @callback="(doc) => handleModalSuccess(idx, doc)"
              @close="() => handleModalClose(idx)"
              @open-create-modal="openCreateModal"
            />
          </template>
        </div>
      </Resizer>
    </div>
  </AppStyling>

  <ErrorPage v-if="errorTitle" :errorTitle="errorTitle" :errorMessage="errorMessage" />

  <!-- Payment Entry Modal -->
  <div v-if="showPaymentEntryModal" class="fixed inset-0 z-50 flex items-center justify-center">
    <div class="absolute inset-0 bg-black/50" @click="showPaymentEntryModal = false"></div>
    <div class="relative z-10 w-[520px] rounded-lg bg-white shadow-xl">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <div class="text-base font-medium">{{ __('Payment Entry') }}</div>
        <button class="rounded px-2 py-1 text-sm text-gray-600 hover:bg-gray-100" @click="showPaymentEntryModal = false">{{ __('Close') }}</button>
      </div>
      <div class="p-4 space-y-4">
        <div class="grid grid-cols-2 gap-3">
          <FormControl :label="__('Donor ID')" type="text" v-model="paymentEntryForm.donor_id" readonly />
          <FormControl :label="__('Serial No.')" type="text" v-model="paymentEntryForm.serial_no" readonly />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <FormControl :label="__('Outstanding Amount')" type="text" :modelValue="formatCurrency(paymentReadonly.outstanding_amount)" readonly />
          <FormControl :label="__('Paid Amount')" type="number" v-model="paymentEntryForm.paid_amount" />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <FormControl :label="__('Doubtful Debt Amount')" type="text" :modelValue="formatCurrency(paymentReadonly.doubtful_debt_amount)" readonly />
          <FormControl :label="__('Remaining Amount')" type="text" :modelValue="formatCurrency(paymentReadonly.remaining_amount)" readonly />
        </div>

        <div class="pt-2 text-sm font-medium text-gray-700">{{ __('Accounts Detail') }}</div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm text-gray-600 mb-1">{{ __('Mode of Payment') }}</label>
            <LinkField 
              class="form-control" 
              :doctype="'Mode of Payment'" 
              v-model="paymentEntryForm.mode_of_payment"
              :placeholder="__('Select Mode of Payment')"
            />
          </div>
          <div>
            <label class="block text-sm text-gray-600 mb-1">{{ __('Account Paid To') }}</label>
            <LinkField 
              class="form-control" 
              :doctype="'Account'" 
              v-model="paymentEntryForm.account_paid_to"
              :placeholder="__('Select Account')"
            />
          </div>
        </div>

        <div class="pt-2 text-sm font-medium text-gray-700">{{ __('Transaction Detail') }}</div>
        <div class="grid grid-cols-2 gap-3">
          <FormControl :label="__('Cheque/Reference No')" type="text" v-model="paymentEntryForm.cheque_reference_no" />
          <FormControl :label="__('Cheque/Reference Date')" type="date" v-model="paymentEntryForm.cheque_reference_date" />
        </div>
      </div>
      <div class="flex justify-end gap-2 border-t px-4 py-3">
        <button class="rounded px-3 py-1.5 text-sm hover:bg-gray-100" @click="showPaymentEntryModal = false">{{ __('Cancel') }}</button>
        <Button variant="solid" :label="__('Create')" @click="submitPaymentEntry" />
      </div>
    </div>
  </div>

  <!-- Reverse Donor Modal -->
  <div v-if="showReverseDonorModal" class="fixed inset-0 z-50 flex items-center justify-center">
    <div class="absolute inset-0 bg-black/50" @click="showReverseDonorModal = false"></div>
    <div class="relative z-10 w-[520px] rounded-lg bg-white shadow-xl">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <div class="text-base font-medium">{{ __('Unknown to Known Donor') }}</div>
        <button class="rounded px-2 py-1 text-sm text-gray-600 hover:bg-gray-100" @click="showReverseDonorModal = false">{{ __('Close') }}</button>
      </div>
      <div class="p-4 space-y-4">
        <Link
          :label="__('Donor (Known)')"
          :doctype="'Donor'"
          :filters="{ donor_name: ['not in', ['Unknown Donor', 'Merchant Known']] }"
          v-model="reverseDonorForm.donor"
        />
        <FormControl 
          :label="__('Payment Detail Serial No')" 
          type="select" 
          :options="availableSerialNumbers.map(num => ({ label: String(num), value: num }))" 
          v-model="reverseDonorForm.serial_no"
          :reqd="true"
        />
      </div>
      <div class="flex justify-end gap-2 border-t px-4 py-3">
        <button class="rounded px-3 py-1.5 text-sm hover:bg-gray-100" @click="showReverseDonorModal = false">{{ __('Cancel') }}</button>
        <Button variant="solid" :label="__('Submit')" @click="submitReverseDonor" />
      </div>
    </div>
  </div>

  <div v-if="showPrintModal" class="fixed inset-0 z-50 flex items-center justify-center">
    <div class="absolute inset-0 bg-black/50" @click="closePrintModal"></div>
    <div class="relative z-10 w-[420px] rounded-lg bg-white shadow-xl">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <div class="text-base font-medium">{{ __("Select Print Format") }}</div>
        <button
          class="rounded px-2 py-1 text-sm text-gray-600 hover:bg-gray-100"
          @click="closePrintModal"
        >
          {{ __("Close") }}
        </button>
      </div>
      <div class="space-y-2 px-4 py-4">
        <label class="block text-sm text-gray-700">{{ __("Print Format") }}</label>
        <select
          class="block w-full rounded border px-3 py-2 text-sm"
          v-model="selectedPrintFormat"
        >
          <option value="" disabled>
            {{ loadingFormats ? __("Loading...") : __("Select a format") }}
          </option>
          <option v-for="f in printFormats" :key="f.name" :value="f.name">
            {{ f.name }}
          </option>
        </select>
      </div>
      <div class="flex items-center justify-end gap-2 border-t px-4 py-3">
        <button
          class="rounded px-3 py-1.5 text-sm hover:bg-gray-100"
          @click="closePrintModal"
        >
          {{ __("Cancel") }}
        </button>
        <button
          class="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="!selectedPrintFormat || loadingFormats"
          @click="confirmPrint"
        >
          {{ __("Print") }}
        </button>
      </div>
    </div>
  </div>

  <FilesUploader
    v-if="document.doc?.name"
    v-model="showFilesUploader"
    doctype="Donation"
    p
    :docname="document.doc.name"
    @after="
      () => {
        activities?.all_activities?.reload();
        changeTabTo('attachments');
      }
    "
  />

  <DeleteLinkedDocModal
    v-if="showDeleteLinkedDocModal"
    v-model="showDeleteLinkedDocModal"
    :doctype="'Donation'"
    :docname="props.donationId"
    name="Donations"
  />
  <FieldLayout
    v-if="tabs.data"
    :tabs="filteredTabs"
    :data="document.doc"
    :doctype="'Donation'"
    :readOnly="isReadOnly"
    :triggerOnChange="customTriggerOnChange"
    :triggerOnRowRemove="customTriggerOnRowRemove"
    @open-create-modal="openCreateModal"
    @tab-change="handleTabChange"
    @donor-selected="handleDonorSelected"
    @add-deduction-row="handleAddDeductionRow"
  />
</template>

<script setup>
import LayoutHeader from "@/components/LayoutHeader.vue";
import Breadcrumbs from "@/components/Breadcrumbs.vue";
import CustomActions from "@/components/CustomActions.vue";
import AssignTo from "@/components/AssignTo.vue";
import Activities from "@/components/Activities/Activities.vue";
import SidePanelLayout from "@/components/SidePanelLayout.vue";
import Resizer from "@/components/Resizer.vue";
import ErrorPage from "@/components/ErrorPage.vue";
// import Icon from "@/components/Icon.vue";
// import DataFields from "@/components/Activities/DataFields.vue";
import FilesUploader from "@/components/FilesUploader/FilesUploader.vue";
import FieldLayout from "@/components/FieldLayout/FieldLayout.vue";
import SLASection from "@/components/SLASection.vue";
import IndicatorIcon from "@/components/Icons/IndicatorIcon.vue";
import CameraIcon from "@/components/Icons/CameraIcon.vue";
import AppStyling from "@/components/AppStyling.vue";
// import LinkIcon from "@/components/Icons/LinkIcon.vue";
import AttachmentIcon from "@/components/Icons/AttachmentIcon.vue";
// import EditIcon from "@/components/Icons/EditIcon.vue";
import { getMeta } from "@/stores/meta";
import { ref, computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useActiveTabManager } from "@/composables/useActiveTabManager";
import { createResource } from "frappe-ui";
import { getSettings } from "@/stores/settings";
import { sessionStore } from "@/stores/session";
import { usersStore } from "@/stores/users";
import { globalStore } from "@/stores/global";
import { statusesStore } from "@/stores/statuses";
import { whatsappEnabled, callEnabled, isMobileView } from "@/composables/settings";
import {
  // openWebsite,
  // setupCustomizations,
  copyToClipboard,
  validateIsImageFile,
} from "@/utils";
// import { showQuickEntryModal, quickEntryProps } from "@/composables/modals";
// import { getView } from "@/utils/view";
// import { capture } from "@/telemetry";
import { useOnboarding } from "frappe-ui/frappe";
import {
  FileUploader,
  Dropdown,
  Tooltip,
  Avatar,
  Tabs,
  Switch,
  call,
  usePageMeta,
  toast,
  FeatherIcon,
  FormControl,
  Link,
  DatePicker,
  DateTimePicker,
  Checkbox,
} from "frappe-ui";
import {
  ref as vueRef,
  reactive,
  computed as vueComputed,
  onMounted as vueOnMounted,
  watch as vueWatch,
  nextTick,
  h,
} from "vue";
import ActivityIcon from "@/components/Icons/ActivityIcon.vue";
import EmailIcon from "@/components/Icons/EmailIcon.vue";
import Email2Icon from "@/components/Icons/Email2Icon.vue";
import CommentIcon from "@/components/Icons/CommentIcon.vue";
import DetailsIcon from "@/components/Icons/DetailsIcon.vue";
import PhoneIcon from "@/components/Icons/PhoneIcon.vue";
import TaskIcon from "@/components/Icons/TaskIcon.vue";
import NoteIcon from "@/components/Icons/NoteIcon.vue";
import WhatsAppIcon from "@/components/Icons/WhatsAppIcon.vue";
import { useDocument } from "@/data/document";
import ViewBreadcrumbs from "@/components/ViewBreadcrumbs.vue";
import CreateDocumentModal from "@/components/Modals/CreateDocumentModal.vue";
import DeleteLinkedDocModal from "@/components/DeleteLinkedDocModal.vue";
import LinkField from "@/components/Controls/Link.vue";

const { brand } = getSettings();
const { user } = sessionStore();
const { isManager } = usersStore();
const { $dialog, $socket, makeCall } = globalStore();
const { statusOptions, getLeadStatus, getDealStatus } = statusesStore();
const { doctypeMeta } = getMeta("Donation");

const { updateOnboardingStep } = useOnboarding("frappecrm");

const route = useRoute();
const router = useRouter();

const props = defineProps({
  donationId: {
    type: String,
    required: true,
  },
});

const errorTitle = ref("");
const errorMessage = ref("");
const showDeleteLinkedDocModal = ref(false);

const { document, assignees, triggerOnChange } = useDocument(
  "Donation",
  props.donationId
);

const reload = ref(false);
const showFilesUploader = ref(false);
const modalStack = ref([]);

function openCreateModal({ doctype, initialValue, onSuccess }) {
  modalStack.value.push({
    doctype,
    initialValue,
    onSuccess,
    visible: true,
  });
}

function handleModalSuccess(idx, doc) {
  const modal = modalStack.value[idx];
  if (modal && modal.onSuccess) modal.onSuccess(doc);
  modalStack.value.splice(idx, 1);
}

function handleModalClose(idx) {
  modalStack.value.splice(idx, 1);
}

const breadcrumbs = computed(() => [
  { label: __("Donations"), route: { name: "Donations" } },
  {
    label: document.doc?.name || props.donationId,
    route: { name: "DonationDetail", params: { donationId: props.donationId } },
  },
]);

const donorName = computed(() => {
  if (document.doc?.payment_detail && document.doc.payment_detail.length > 0) {
    const firstRowWithDonor = document.doc.payment_detail.find((row) => row.donor_name);
    if (firstRowWithDonor) {
      return firstRowWithDonor.donor_name;
    }
  }
  return null;
});

const title = computed(() => {
  if (donorName.value) {
    return donorName.value;
  }
  if (document.doc?.name) {
    return document.doc.name;
  }
  return __("Donation");
});

const donationStatusOptions = computed(() => {
  return [
    { label: __("Draft"), value: "Draft", color: "text-gray-500" },
    { label: __("Submitted"), value: "Submitted", color: "text-blue-500" },
    { label: __("Approved"), value: "Approved", color: "text-green-500" },
    { label: __("Rejected"), value: "Rejected", color: "text-red-500" },
    { label: __("Cancelled"), value: "Cancelled", color: "text-gray-400" },
    {
      label: __("Credit Note Issued"),
      value: "Credit Note Issued",
      color: "text-red-500",
    },
    { label: __("Return"), value: "Return", color: "text-yellow-500" },
    { label: __("Paid"), value: "Paid", color: "text-green-500" },
  ];
});

function getDonationStatus(status) {
  const statusOption = donationStatusOptions.value.find(
    (option) => option.value === status
  );
  return statusOption || { color: "text-gray-500" };
}

const tabs = computed(() => {
  let tabOptions = [
    {
      name: "Activity",
      label: __("Activity"),
      icon: ActivityIcon,
    },
    {
      name: "Emails",
      label: __("Emails"),
      icon: EmailIcon,
    },
    {
      name: "Comments",
      label: __("Comments"),
      icon: CommentIcon,
    },
    {
      name: "Data",
      label: __("Data"),
      icon: DetailsIcon,
    },
    {
      name: "Calls",
      label: __("Calls"),
      icon: PhoneIcon,
    },
    {
      name: "Tasks",
      label: __("Tasks"),
      icon: TaskIcon,
    },
    {
      name: "Notes",
      label: __("Notes"),
      icon: NoteIcon,
    },
    {
      name: "Attachments",
      label: __("Attachments"),
      icon: AttachmentIcon,
    },
    {
      name: "WhatsApp",
      label: __("WhatsApp"),
      icon: WhatsAppIcon,
      condition: () => whatsappEnabled.value,
    },
  ];
  return tabOptions.filter((tab) => (tab.condition ? tab.condition() : true));
});

const { tabIndex, changeTabTo } = useActiveTabManager(tabs, "lastDonationTab");

watch(tabs, (value) => {
  if (value && route.params.tabName) {
    let index = value.findIndex(
      (tab) => tab.name.toLowerCase() === route.params.tabName.toLowerCase()
    );
    if (index !== -1) {
      tabIndex.value = index;
    }
  }
});

const sections = createResource({
  url: "crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_sidepanel_sections",
  cache: ["sidePanelSections", "Donation"],
  params: { doctype: "Donation" },
  auto: true,
});

// Computed sections: hide `return_against` when `is_return` is not checked
const computedSections = computed(() => {
  const raw = sections.data || [];
  // Deep clone to avoid mutating resource cache
  const cloned = JSON.parse(JSON.stringify(raw));
  if (!document?.doc) return cloned;

  // Show field only when status is 'Return' and is_return is enabled
  const isReturnChecked =
    document.doc?.is_return === 1 ||
    document.doc?.is_return === true ||
    document.doc?.is_return === "1";
  const showReturnAgainst = document.doc?.status === "Return" && isReturnChecked;
  if (!showReturnAgainst) {
    // Iterate sections/fields and remove any Return Against field when not a return
    for (const section of cloned) {
      if (!section?.columns) continue;
      for (const column of section.columns) {
        if (!Array.isArray(column?.fields)) continue;
        // Remove the field entirely when not a return
        column.fields = column.fields.filter((field) => {
          const fieldname = (field?.fieldname || "").toLowerCase();
          const label = (field?.label || "").toLowerCase();
          const matchesCommonNames = [
            "return_against",
            "return_document",
            "return_against_dn",
          ].includes(fieldname);
          const matchesLabel = label.includes("return against");
          if (matchesCommonNames || matchesLabel) {
            return false;
          }
          return true;
        });
      }
    }
  }

  // Ensure editability of posting_date/time is controlled by edit_posting_date_time
  const allowEditDateTime =
    document.doc?.edit_posting_date_time === 1 ||
    document.doc?.edit_posting_date_time === true ||
    document.doc?.edit_posting_date_time === "1";
  for (const section of cloned) {
    if (!section?.columns) continue;
    for (const column of section.columns) {
      if (!Array.isArray(column?.fields)) continue;
      for (const field of column.fields) {
        const fname = (field?.fieldname || "").toLowerCase();
        if (fname === "posting_date") {
          field.fieldtype = "Date";
          field.default = field.default ?? "Today";
          field.read_only = !allowEditDateTime;
        }
        if (fname === "posting_time") {
          field.fieldtype = "Time";
          field.default = field.default ?? "Now";
          field.read_only = !allowEditDateTime;
        }
        if (fname === "edit_posting_date_time") {
          field.fieldtype = "Check";
          field.default = field.default ?? 0;
        }
      }
    }
  }

  return cloned;
});

// Ensure default for edit_posting_date_time if missing
watch(
  () => document.doc && document.doc.edit_posting_date_time,
  (val) => {
    if (document?.doc && typeof document.doc.edit_posting_date_time === "undefined") {
      document.doc.edit_posting_date_time = 0;
    }
  },
  { immediate: true }
);

// BULLETPROOF FIX: Override the triggerOnChange to handle deduction_breakeven specially
const originalTriggerOnChange = triggerOnChange;

// Create a custom triggerOnChange that preserves user modifications
const customTriggerOnChange = async (fieldname, value, row) => {
  // console.log('Custom triggerOnChange called:', { fieldname, value, row })

  // CRITICAL: If this is a percentage change in deduction_breakeven, handle it specially
  if (fieldname === "percentage" && row && document.doc.deduction_breakeven) {
    // console.log('Percentage change in deduction_breakeven detected - using special handling')

    // Find the row in the deduction_breakeven table
    const deductionRow = document.doc.deduction_breakeven.find(
      (r) => r.random_id === row.random_id
    );
    if (deductionRow) {
      // console.log('Found deduction row, updating percentage:', value)

      // Update the percentage
      deductionRow.percentage = value;
      deductionRow._userModifiedPercentage = true;
      deductionRow._lastPercentage = value;

      // Calculate and update amount
      const calculatedAmount = calculateDeductionAmount(deductionRow);
      if (calculatedAmount !== null) {
        deductionRow.amount = calculatedAmount;
        deductionRow.base_amount = calculatedAmount;
        // console.log(`Updated amount: ${calculatedAmount}`)
      }

      // Force reactive update without calling backend API
      document.doc = { ...document.doc };

      // console.log('Percentage updated successfully without backend API call')
      return; // Don't call the original triggerOnChange
    }
  }

  // For all other fields, use the original triggerOnChange
  return originalTriggerOnChange(fieldname, value, row);
};

// BULLETPROOF FIX: Enhanced updateField function to prevent reload for deduction_breakeven
async function updateField(name, value, callback) {
  // Validate required fields
  if (await validateRequired(name, value)) {
    return; // Block the update if validation fails
  }

  // CRITICAL: If updating deduction_breakeven table, don't reload
  if (name === "deduction_breakeven") {
    // console.log('Updating deduction_breakeven table - skipping reload to preserve user modifications')

    // Update the document directly without calling backend API
    document.doc.deduction_breakeven = value;
    document.data.deduction_breakeven = value;

    // Trigger callback
    callback?.();

    toast.success(__("Deduction breakeven updated successfully"));
    return;
  }

  // For all other fields, use normal update
  await updateDonation(name, value, () => {
    document.data[name] = value;
    callback?.();
  });
}

// BULLETPROOF FIX: Enhanced updateDonation to prevent reload for deduction_breakeven changes
const updateDonation = createResource({
  url: "frappe.client.set_value",
  makeParams(values) {
    return {
      doctype: "Donation",
      name: props.donationId,
      fieldname: values.name,
      value: values.value,
    };
  },
  onSuccess: () => {
    // CRITICAL: Don't reload for deduction_breakeven changes - they're handled separately
    if (document.data.fieldname !== "deduction_breakeven") {
      document.reload();
    }

    toast.success(__("Donation updated successfully"));
  },
  onError: (err) => {
    const msg = err.messages?.[0] || err.message || __("Error updating donation");

    // Check if it's a timestamp mismatch error
    if (
      msg.includes("TimestampMismatchError") ||
      msg.includes("Document has been modified") ||
      msg.includes("Please refresh to get the latest document")
    ) {
      toast.error(__("Document has been modified. Refreshing donation details..."));

      // Refresh only the donation data after a short delay
      setTimeout(() => {
        document.reload();
      }, 1000);
    } else {
      toast.error(msg);
    }
  },
});

// Validation function for required fields
async function validateRequired(fieldname, value) {
  let meta = document.fields_meta || {};
  if (meta[fieldname]?.reqd && !value) {
    toast.error(__("{0} is a required field", [meta[fieldname].label]));  
    return true;
  }
  return false;
}

// Delete donation
async function deleteDonation(name) {
  await call("frappe.client.delete", {
    doctype: "Donation",
    name,
  });
  router.push({ name: "Donation" });
}

async function deleteDonationWithModal(name) {
  const confirmed = await $dialog.confirm({
    title: __("Delete Donation"),
    message: __(
      "Are you sure you want to delete this donation? This action cannot be undone."
    ),
    confirmText: __("Delete"),
    cancelText: __("Cancel"),
    variant: "danger",
  });

  if (confirmed) {
    await deleteDonation(name);
  }
}

// Reload assignees
function reloadAssignees(data) {
  if (data?.hasOwnProperty("donation_owner")) {
    assignees.reload();
  }
}

// COMPREHENSIVE VALIDATION: Function to validate all mandatory fields
async function validateDonationForm() {
  const errors = [];

  // Main donation mandatory fields (from JSON schema)
  const mainRequiredFields = [
    { field: "company", label: "Company" },
    { field: "donation_type", label: "Donation Type" },
    { field: "due_date", label: "Due Date" },
  ];

  // Check main donation fields
  mainRequiredFields.forEach(({ field, label }) => {
    if (
      !document.doc[field] ||
      (typeof document.doc[field] === "string" && document.doc[field].trim() === "")
    ) {
      errors.push(`${label} is required`);
    }
  });

  // Additional business logic required fields
  if (!document.doc.donor_identity || document.doc.donor_identity.trim() === "") {
    errors.push("Donor Identity is required");
  }

  // Contribution Type is not required for In Kind Donation
  if (document.doc.donation_type !== "In Kind Donation") {
    if (!document.doc.contribution_type || document.doc.contribution_type.trim() === "") {
      errors.push("Contribution Type is required");
    }
  }

  if (!document.doc.posting_date) {
    errors.push("Posting Date is required");
  }

  if (!document.doc.currency || document.doc.currency.trim() === "") {
    errors.push("Currency is required");
  }
  if (document.doc.donation_type !== "In Kind Donation") {
    if (
      !document.doc.donation_cost_center ||
      document.doc.donation_cost_center.trim() === ""
    ) {
      errors.push("Donation Cost Center is required");
    }
  }

  // Payment detail validation
  if (document.doc.donation_type !== "In Kind Donation") {
    if (
      !document.doc.payment_detail ||
      !Array.isArray(document.doc.payment_detail) ||
      document.doc.payment_detail.length === 0
    ) {
      errors.push("At least one payment detail is required");
    } else {
      document.doc.payment_detail.forEach((row, index) => {
        const rowNum = index + 1;

        if (document.doc.donation_type !== "In kind Donaiton") {
        if (!row.donation_amount || row.donation_amount <= 0) {
          errors.push(
            `Donation Amount for payment detail row ${rowNum} is required and must be greater than 0`
          );
        }
      }

       if (document.doc.donaiton_type !== "In Kind Donation") {
        if (!row.equity_account || row.equity_account.trim() === "") {
          errors.push(`Equity Account for payment detail row ${rowNum} is required`);
        }
      }
       if (document.doc.donation_type !== "In Kind Donation") {
        if (!row.receivable_account || row.receivable_account.trim() === "") {
          errors.push(`Receivable Account for payment detail row ${rowNum} is required`);
        }
      }
        if (document.doc.donation_type !== "In Kind Donation") {
        if (!row.donor || row.donor.trim() === "") {
          errors.push(`Donor for payment detail row ${rowNum} is required`);
        }
      }

      if (document.doc.donation_type !== "In Kind Donation") {
        if (!row.fund_class || row.fund_class.trim() === "") {
          errors.push(`Fund Class for payment detail row ${rowNum} is required`);
        }
      }
      if (document.doc.donation_type !== "In Kind Donation") {
        if (!row.mode_of_payment || row.mode_of_payment.trim() === "") {
          errors.push(`Mode of Payment for payment detail row ${rowNum} is required`);
        }
      }
       if (document.doc.donation_type !== "In Kind Donation") {
        // Transaction Type ID is always mandatory
        if (!row.transaction_type || row.transaction_type.trim() === "") {
          errors.push(`Transaction Type for payment detail row ${rowNum} is required`);
        }
      }
        // Conditional mandatory fields based on mode of payment
        if (
          row.mode_of_payment &&
          ["bank", "Cheque", "Bank Draft"].includes(row.mode_of_payment)
        ) {
          if (!row.account_paid_to || row.account_paid_to.trim() === "") {
            errors.push(
              `Account Paid To for payment detail row ${rowNum} is required when Mode of Payment is ${row.mode_of_payment}`
            );
          }

          if (
            !row.transaction_no_cheque_no ||
            row.transaction_no_cheque_no.trim() === ""
          ) {
            errors.push(
              `Transaction No/ Cheque No for payment detail row ${rowNum} is required when Mode of Payment is ${row.mode_of_payment}`
            );
          }

          if (!row.reference_date) {
            errors.push(
              `Cheque / Reference Date for payment detail row ${rowNum} is required when Mode of Payment is ${row.mode_of_payment}`
            );
          }
        }
      });
    }
  }

  // Deduction breakeven validation
  if (
    document.doc.deduction_breakeven &&
    Array.isArray(document.doc.deduction_breakeven)
  ) {
    for (let index = 0; index < document.doc.deduction_breakeven.length; index++) {
      const row = document.doc.deduction_breakeven[index];
      const rowNum = index + 1;

      // Basic validation
      if (!row.percentage) {
        errors.push(`Percentage for deduction breakeven row ${rowNum} is required.`);
        continue;
      }

      // Validate percentage is a valid number
      const percentage = parseFloat(row.percentage);
      if (isNaN(percentage)) {
        errors.push(
          `Percentage for deduction breakeven row ${rowNum} must be a valid number.`
        );
        continue;
      }

      if (percentage < 0) {
        errors.push(
          `Percentage for deduction breakeven row ${rowNum} cannot be negative.`
        );
        continue;
      }

      if (percentage > 100) {
        errors.push(
          `Percentage for deduction breakeven row ${rowNum} cannot exceed 100%.`
        );
        continue;
      }

      // Min/Max validation using the min_percent and max_percent fields from the row
      if (
        row.min_percent !== null &&
        row.min_percent !== undefined &&
        row.max_percent !== null &&
        row.max_percent !== undefined
      ) {
        const minPercentage = parseFloat(row.min_percent);
        const maxPercentage = parseFloat(row.max_percent);

        if (!isNaN(minPercentage) && !isNaN(maxPercentage)) {
          if (percentage < minPercentage || percentage > maxPercentage) {
            errors.push(
              `Percentage for deduction breakeven row ${rowNum} must be between ${minPercentage}% and ${maxPercentage}%. Current value: ${percentage}%.`
            );
          }
        } else if (!isNaN(minPercentage) && percentage < minPercentage) {
          errors.push(
            `Percentage for deduction breakeven row ${rowNum} must be at least ${minPercentage}%. Current value: ${percentage}%.`
          );
        } else if (!isNaN(maxPercentage) && percentage > maxPercentage) {
          errors.push(
            `Percentage for deduction breakeven row ${rowNum} must not exceed ${maxPercentage}%. Current value: ${percentage}%.`
          );
        }
      }
    }
  }

  return errors;
}

// ENHANCED: Function to validate deduction breakeven percentage with min/max validation
async function validateDeductionBreakevenPercentages() {
  const errors = [];

  if (
    document.doc.deduction_breakeven &&
    Array.isArray(document.doc.deduction_breakeven)
  ) {
    for (let index = 0; index < document.doc.deduction_breakeven.length; index++) {
      const row = document.doc.deduction_breakeven[index];
      const rowNum = index + 1;

      // Basic validation
      if (!row.percentage) {
        errors.push(`Percentage for deduction breakeven row ${rowNum} is required.`);
        continue;
      }

      // Validate percentage is a valid number
      const percentage = parseFloat(row.percentage);
      if (isNaN(percentage)) {
        errors.push(
          `Percentage for deduction breakeven row ${rowNum} must be a valid number.`
        );
        continue;
      }

      if (percentage < 0) {
        errors.push(
          `Percentage for deduction breakeven row ${rowNum} cannot be negative.`
        );
        continue;
      }

      if (percentage > 100) {
        errors.push(
          `Percentage for deduction breakeven row ${rowNum} cannot exceed 100%.`
        );
        continue;
      }

      // Min/Max validation if fund_class and account are available
      if (row.fund_class && row.account) {
        try {
          const result = await call(
            "crm.fcrm.doctype.donation.api.get_min_max_percentage",
            {
              fund_class: row.fund_class,
              account: row.account,
            }
          );

          if (result && result.length === 2) {
            const minPercentage = result[0];
            const maxPercentage = result[1];

            if (minPercentage !== null && maxPercentage !== null) {
              if (percentage < minPercentage || percentage > maxPercentage) {
                errors.push(
                  `Percentage for deduction breakeven row ${rowNum} must be between ${minPercentage}% and ${maxPercentage}%. Current value: ${percentage}%.`
                );
              }
            } else if (minPercentage !== null && percentage < minPercentage) {
              errors.push(
                `Percentage for deduction breakeven row ${rowNum} must be at least ${minPercentage}%. Current value: ${percentage}%.`
              );
            } else if (maxPercentage !== null && percentage > maxPercentage) {
              errors.push(
                `Percentage for deduction breakeven row ${rowNum} must not exceed ${maxPercentage}%. Current value: ${percentage}%.`
              );
            }
          }
        } catch (error) {}
      }
    }
  }

  return errors;
}

// ENHANCED: Function to validate and show user-friendly error messages
async function validateAndShowErrors() {
  const errors = await validateDonationForm();

  // Add deduction breakeven percentage validation
  const deductionErrors = await validateDeductionBreakevenPercentages();
  errors.push(...deductionErrors);

  if (errors.length > 0) {
    // Show the first error as a toast
    toast.error(errors[0]);

    return false;
  }

  return true;
}

async function saveChanges(data) {
  // Validate before saving
  if (!(await validateAndShowErrors())) {
    return; // Don't save if validation fails
  }

  // Ensure any user-edited deduction percentages are applied to the doc
  applyUserModifiedDeductionPercentages();

  // BULLETPROOF FIX: Preserve user-modified percentage values before saving
  const preservedUserModifications = preserveUserModificationsBeforeSave();

  document.save.submit(null, {
    onSuccess: () => {
      // BULLETPROOF FIX: Restore user modifications after successful save
      setTimeout(() => {
        restoreUserModificationsAfterSave(preservedUserModifications);
      }, 1000); // Wait for save to complete

      toast.success(__("Donation saved successfully"));
      reloadAssignees(data);
    },
    onError: (err) => {
      toast.error(__("Error saving donation"));
    },
  });
}

// Apply user-edited deduction percentages into the document before persisting
function applyUserModifiedDeductionPercentages() {
  if (
    document.doc.deduction_breakeven &&
    Array.isArray(document.doc.deduction_breakeven)
  ) {
    document.doc.deduction_breakeven.forEach((row) => {
      if (!row) return;
      if (row._userModifiedPercentage && row._lastPercentage !== undefined) {
        row.percentage = row._lastPercentage;
      }
    });
    // Trigger shallow reactivity without replacing arrays used by Grid
    document.doc = { ...document.doc };
  }
}

// BULLETPROOF FIX: Function to preserve user modifications before save
function preserveUserModificationsBeforeSave() {
  const userModifications = {};

  // Preserve deduction breakeven modifications
  if (
    document.doc.deduction_breakeven &&
    Array.isArray(document.doc.deduction_breakeven)
  ) {
    document.doc.deduction_breakeven.forEach((row, index) => {
      if (row && (row._userModifiedPercentage || row._lastPercentage !== undefined)) {
        userModifications[`deduction_breakeven_${index}`] = {
          percentage: row.percentage,
          min_percent: row.min_percent,
          max_percent: row.max_percent,
          amount: row.amount,
          base_amount: row.base_amount,
          _userModifiedPercentage: row._userModifiedPercentage,
          _lastPercentage: row._lastPercentage,
          _userModifiedMinPercent: row._userModifiedMinPercent,
          _lastMinPercent: row._lastMinPercent,
          _userModifiedMaxPercent: row._userModifiedMaxPercent,
          _lastMaxPercent: row._lastMaxPercent,
        };
      }
    });
  }

  // Preserve payment detail fields including mode_of_payment
  if (
    document.doc.payment_detail &&
    Array.isArray(document.doc.payment_detail)
  ) {
    document.doc.payment_detail.forEach((row, index) => {
      if (row) {
        userModifications[`payment_detail_${index}`] = {
          mode_of_payment: row.mode_of_payment,
          account_paid_to: row.account_paid_to,
          transaction_no_cheque_no: row.transaction_no_cheque_no,
          cheque_reference_date: row.cheque_reference_date,
          donor_id: row.donor_id,
          donor_name: row.donor_name,
          donor_type: row.donor_type,
          contact_no: row.contact_no,
          email: row.email,
          city: row.city,
          address: row.address,
          cnic: row.cnic,
          co_name: row.co_name,
          co_contact_no: row.co_contact_no,
          co_email: row.co_email,
          co_address: row.co_address,
          relationship_with_donor: row.relationship_with_donor,
          area: row.area,
          co_city: row.co_city,
          co_country: row.co_country,
          co_designation: row.co_designation,
          _lastMOPId: row._lastMOPId,
        };
      }
    });
  }

  // Store in sessionStorage to survive the save process
  sessionStorage.setItem("preservedUserModifications", JSON.stringify(userModifications));

  return userModifications;
}

// BULLETPROOF FIX: Function to restore user modifications after save
function restoreUserModificationsAfterSave(preservedUserModifications) {
  if (!document.doc) {
    return;
  }

  // Try to get from parameter first, then from sessionStorage
  let modifications = preservedUserModifications;
  if (!modifications || Object.keys(modifications).length === 0) {
    try {
      const stored = sessionStorage.getItem("preservedUserModifications");
      if (stored) {
        modifications = JSON.parse(stored);
        sessionStorage.removeItem("preservedUserModifications"); // Clean up
      }
    } catch (error) {
      return;
    }
  }

  if (!modifications || Object.keys(modifications).length === 0) {
    return;
  }

  // console.log('Restoring user modifications after save:', modifications)

  // Restore deduction breakeven modifications
  if (
    document.doc.deduction_breakeven &&
    Array.isArray(document.doc.deduction_breakeven)
  ) {
    document.doc.deduction_breakeven.forEach((row, index) => {
      const key = `deduction_breakeven_${index}`;
      if (row && modifications[key]) {
        const preserved = modifications[key];

        // Restore user-modified percentage
        if (preserved.percentage !== undefined) {
          row.percentage = preserved.percentage;
          row._lastPercentage = preserved._lastPercentage;
          row._userModifiedPercentage = preserved._userModifiedPercentage;
          // console.log(`Restored percentage for row ${index}: ${row.percentage}`)
        }

        // Restore user-modified min_percent
        if (preserved.min_percent !== undefined) {
          row.min_percent = preserved.min_percent;
          row._lastMinPercent = preserved._lastMinPercent;
          row._userModifiedMinPercent = preserved._userModifiedMinPercent;
          // console.log(`Restored min_percent for row ${index}: ${row.min_percent}`)
        }

        // Restore user-modified max_percent
        if (preserved.max_percent !== undefined) {
          row.max_percent = preserved.max_percent;
          row._lastMaxPercent = preserved._lastMaxPercent;
          row._userModifiedMaxPercent = preserved._userModifiedMaxPercent;
          // console.log(`Restored max_percent for row ${index}: ${row.max_percent}`)
        }

        // Restore calculated amount based on preserved percentage
        if (preserved.percentage !== undefined) {
          const calculatedAmount = calculateDeductionAmount(row);
          if (calculatedAmount !== null) {
            row.amount = calculatedAmount;
            row.base_amount = calculatedAmount;
            // console.log(`Restored calculated amount for row ${index}: ${calculatedAmount}`)
          }
        }
      }
    });
  }

  // Restore payment detail fields including mode_of_payment
  if (
    document.doc.payment_detail &&
    Array.isArray(document.doc.payment_detail)
  ) {
    document.doc.payment_detail.forEach((row, index) => {
      const key = `payment_detail_${index}`;
      if (row && modifications[key]) {
        const preserved = modifications[key];

        // Restore all preserved payment detail fields
        Object.keys(preserved).forEach(fieldName => {
          if (preserved[fieldName] !== undefined && preserved[fieldName] !== null) {
            row[fieldName] = preserved[fieldName];
          }
        });
      }
    });
  }

  // Force reactive update to show restored values
  document.doc = { ...document.doc };

  // console.log('User modifications restored successfully after save')
}

// ADD: Function to calculate deduction amount (if not already exists)
function calculateDeductionAmount(row) {
  const percentage = parseFloat(row.percentage);
  const donationAmount = parseFloat(row.donation_amount);

  // Validate inputs
  if (isNaN(percentage) || isNaN(donationAmount)) {
    // console.log('Cannot calculate amount: invalid percentage or donation amount')
    return null;
  }

  if (donationAmount <= 0) {
    // console.log('Cannot calculate amount: donation amount must be greater than 0')
    return null;
  }

  // Calculate amount: (percentage / 100) * donation_amount
  const calculatedAmount = (percentage / 100) * donationAmount;

  // console.log(`Calculating amount: (${percentage}% / 100) * ${donationAmount} = ${calculatedAmount}`)

  return calculatedAmount;
}

// Handle copy to clipboard (renamed to avoid conflict)
function handleCopyToClipboard(text) {
  copyToClipboard(text);
  toast.success(__("Copied to clipboard"));
}

// Open email box
// function openEmailBox() {
//   // console.log('Opening email box for:', document.data.email)
// }

function printDonation() {
  try {
    const doctype = "Donation";
    const name = document?.doc?.name;
    if (!name) {
      toast?.error && toast.error(__("Document not loaded"));
      return;
    }
    openPrintModal();
  } catch (e) {
    // console.error('Error opening print view:', e)
  }
}

// Print modal state and logic
const showPrintModal = ref(false);
const printFormats = ref([]);
const selectedPrintFormat = ref("");
const loadingFormats = ref(false);

async function openPrintModal() {
  showPrintModal.value = true;
  selectedPrintFormat.value = "";
  await fetchPrintFormats();
}

function closePrintModal() {
  showPrintModal.value = false;
}

async function fetchPrintFormats() {
  loadingFormats.value = true;
  try {
    const formats = await call("frappe.client.get_list", {
      doctype: "Print Format",
      fields: ["name"],
      filters: { doc_type: "Donation", disabled: 0 },
      order_by: "name asc",
      limit_page_length: 1000,
    });
    printFormats.value = Array.isArray(formats) ? formats : [];
    if (printFormats.value.length === 1) {
      selectedPrintFormat.value = printFormats.value[0].name;
    }
  } catch (e) {
    // console.error('Error fetching print formats:', e)
    toast.error(__("Failed to load print formats"));
  } finally {
    loadingFormats.value = false;
  }
}

function confirmPrint() {
  const format = selectedPrintFormat.value;
  if (!format) {
    toast.error(__("Please select a print format"));
    return;
  }
  openPrintView(format);
  closePrintModal();
}

function openPrintView(format) {
  try {
    const doctype = "Donation";
    const name = document?.doc?.name;
    if (!name) return;
    const params = new URLSearchParams({
      doctype,
      name: encodeURIComponent(name),
      trigger_print: "1",
      format,
      no_letterhead: "1",
    });
    const url = `/printview?${params.toString()}`;
    window.open(url, "_blank");
  } catch (e) {
    // console.error('Error opening print view:', e)
  }
}

// Open direct PDF using existing backend endpoint
function openDonationPDF() {
  try {
    const doctype = "Donation";
    const name = document?.doc?.name;
    if (!name) {
      toast?.error && toast.error(__("Document not loaded"));
      return;
    }
    // Default to Standard print format; users can print via the modal for others
    const format = selectedPrintFormat.value || "Standard";
    const params = new URLSearchParams({
      doctype,
      name: encodeURIComponent(name),
      format,
      no_letterhead: "0",
    });
    const url = `/api/method/frappe.utils.print_format.download_pdf?${params.toString()}`;
    window.open(url, "_blank");
  } catch (e) {
    // console.error('Error opening PDF:', e)
  }
}

// Activities reference
const activities = ref(null);

// Page meta
usePageMeta({
  title: computed(() => donorName.value || document.data?.name || __("Donation")),
  description: computed(
    () => `Donation details for ${donorName.value || document.data?.name}`
  ),
  icon: brand.favicon,
});

// Watch for refresh parameter changes
watch(
  () => route.query.refresh,
  (newRefresh) => {
    if (newRefresh) {
      // Clear cache and force reload
      document.cache = ["donation", props.donationId, Date.now()];
      document.reload();
      // Clear the refresh parameter from URL
      router.replace({
        name: "DonationDetail",
        params: { donationId: props.donationId },
        query: {},
      });
    }
  },
  { immediate: true }
);

onMounted(() => {
  // Handle refresh parameter for fresh donation creation
  if (route.query.refresh) {
    // Clear cache and force reload
    document.cache = ["donation", props.donationId, Date.now()];
    document.reload();
    // Clear the refresh parameter from URL
    router.replace({
      name: "DonationDetail",
      params: { donationId: props.donationId },
      query: {},
    });
  }
});

// ADD: Method to refresh deduction breakeven using the minimal backend method
async function refreshDeductionBreakeven() {
  if (!document.doc?.name) {
    return;
  }

  try {
    // Call the minimal backend method
    const result = await call(
      "akf_accounts.akf_accounts.doctype.donation.donation.refresh_deduction_breakeven",
      {
        name: document.doc.name,
      }
    );

    if (result.status === "success") {
      toast.success("Deduction breakeven table refreshed successfully");

      // Reload the document to show updated data
      document.reload();
    }
  } catch (error) {
    // toast.error('Failed to refresh deduction breakeven table')
  }
}

function detectAndPreserveUserModifications() {
  isUpdatingFromAPI = true;

  if (
    document.doc.deduction_breakeven &&
    Array.isArray(document.doc.deduction_breakeven)
  ) {
    document.doc.deduction_breakeven.forEach((row, index) => {
      if (row) {
        row._isUserModified = true;
        row._userModifiedPercentage = true;
        row._originalPercentage = row.percentage;
        row._originalMinPercent = row.min_percent;
        row._originalMaxPercent = row.max_percent;
        row._originalAmount = row.amount;
        row._originalBaseAmount = row.base_amount;
      }
    });
  }

  // Reset flag after initialization
  setTimeout(() => {
    isUpdatingFromAPI = false;
  }, 100);
}

// CRITICAL FIX: Enhanced onMounted to detect user modifications
onMounted(async () => {
  await nextTick();

  // Wait for document to load
  setTimeout(() => {
    // CRITICAL: Always detect and preserve user modifications FIRST
    detectAndPreserveUserModifications();

    // CRITICAL: For existing donations, NEVER call any backend APIs
    if (document.doc?.name && document.doc.name !== "") {
      return;
    }

    // Only auto-refresh for new donations
    if (shouldPopulateDeductionBreakeven()) {
      setTimeout(() => {
        refreshDeductionBreakeven();
      }, 2000);
    }
  }, 1000);
});

// CRITICAL FIX: Watch for document changes to auto-refresh when needed
watch(
  () => document.doc,
  (newDoc, oldDoc) => {
    // CRITICAL: For existing donations, NEVER call any backend APIs
    if (document.doc?.name && document.doc.name !== "") {
      return;
    }

    // Only auto-refresh for new donations
    if (shouldPopulateDeductionBreakeven()) {
      setTimeout(() => {
        refreshDeductionBreakeven();
      }, 1000);
    }
  },
  { immediate: false, deep: true }
);

// === ENRICHERS ===
async function safeFetchDonor(donorId) {
  try {
    return donorId
      ? await call("frappe.client.get", { doctype: "Donor", name: donorId })
      : null;
  } catch {
    return null;
  }
}
async function safeFetchFundClass(fcId) {
  try {
    return fcId
      ? await call("crm.fcrm.doctype.donation.api.get_fund_class_details", {
          fund_class: fcId,
          company: document.doc?.company || "Alkhidmat Foundation Pakistan",
        })
      : null;
  } catch {
    return null;
  }
}
async function safeFetchMOP(mopId) {
  try {
    return mopId
      ? await call("frappe.client.get", { doctype: "Mode of Payment", name: mopId })
      : null;
  } catch {
    return null;
  }
}

function mapDonor(row, donor) {
  if (!row || !donor) return;
  const map = [
    "donor_name",
    "donor_type",
    "contact_no",
    "email",
    "city",
    "address",
    "cnic",
    "co_name",
    "co_contact_no",
    "co_email",
    "co_address",
    "relationship_with_donor",
    "area",
    "co_city",
    "co_country",
    "co_designation",
  ];
  map.forEach((k) => {
    if (donor[k] !== undefined) row[k] = donor[k] || "";
  });
}
function mapFundClass(row, fc) {
  if (!row || !fc) return;
  const pairs = {
    service_area: "pay_service_area",
    subservice_area: "pay_subservice_area",
    product: "pay_product",
    equity_account: "equity_account",
    receivable_account: "receivable_account",
    cost_center: "cost_center",
  };
  Object.entries(pairs).forEach(([src, tgt]) => {
    if (fc[src] !== undefined) row[tgt] = fc[src] || "";
  });
}

let didEnrichOnce = false;

async function enrichOnceAfterLoad() {
  if (didEnrichOnce || !document.doc) return;
  didEnrichOnce = true;

  isUpdatingFromAPI = true;

  try {
    // Payment Details
    if (Array.isArray(document.doc.payment_detail)) {
      for (let i = 0; i < document.doc.payment_detail.length; i++) {
        const row = document.doc.payment_detail[i];
        if (row && !row.random_id)
          row.random_id = Math.floor(1000 + i + 1 + Math.random() * 9000);
        // Initialize tracking fields for fund class changes
        if (row && !row._lastFundClassId && row.fund_class) {
          row._lastFundClassId = row.fund_class;
        }
        if (row?.donor) {
          const d = await safeFetchDonor(row.donor);
          mapDonor(row, d);
        }
        if (row?.fund_class) {
          const fc = await safeFetchFundClass(row.fund_class);
          mapFundClass(row, fc);
        }
        if (row?.mode_of_payment) {
          const mop = await safeFetchMOP(row.mode_of_payment);
          if (mop?.accounts && document.doc.company) {
            const comp = mop.accounts.find((a) => a.company === document.doc.company);
            if (comp?.default_account) row.account_paid_to = comp.default_account;
          }
        }
      }
      document.doc.payment_detail = [...document.doc.payment_detail];
    }

    // Deduction Breakeven
    if (Array.isArray(document.doc.deduction_breakeven)) {
      for (let i = 0; i < document.doc.deduction_breakeven.length; i++) {
        const r = document.doc.deduction_breakeven[i];
        if (r && !r.random_id)
          r.random_id = Math.floor(1000 + i + 1 + Math.random() * 9000);
        const fcid = r.fund_class || r.fund_class;
        if (fcid) {
          const fc = await safeFetchFundClass(fcid);
          if (fc) {
            const pairs = [
              ["service_area", "service_area"],
              ["subservice_area", "subservice_area"],
              ["product", "product"],
              ["service_area", "pay_service_area"],
              ["subservice_area", "pay_subservice_area"],
              ["product", "pay_product"],
              ["cost_center", "cost_center"],
            ];
            pairs.forEach(([src, tgt]) => {
              if (tgt in r && fc[src] !== undefined) r[tgt] = fc[src] || "";
            });
          }
        }
      }
      document.doc.deduction_breakeven = [...document.doc.deduction_breakeven];
    }
  } catch (e) {
    // Fail-safe: do not break page
    // console.error('Enrichment error:', e)
  } finally {
    // After enrichment, sync originalDoc to current doc so UI does not show Not Saved
    try {
      if (document && document.doc) {
        const snapshot = JSON.parse(JSON.stringify(document.doc));
        document.originalDoc = snapshot;
        // also reset any explicit dirty flags if present
        if (typeof document.isDirty !== "undefined") {
          document.isDirty = false;
        }
      }
    } catch (syncErr) {
      // console.warn('Failed to sync originalDoc after enrichment:', syncErr)
    }
    // Reset flag after enrichment is complete
    isUpdatingFromAPI = false;
  }
}

onMounted(async () => {
  await nextTick();
  // small delay to ensure doc rendered
  setTimeout(() => {
    enrichOnceAfterLoad();
  }, 300);

  // Final stabilization: after all initial timers and watchers settle, sync baseline
  setTimeout(() => {
    try {
      if (document && document.doc) {
        const snapshot = JSON.parse(JSON.stringify(document.doc));
        document.originalDoc = snapshot;
        if (typeof document.isDirty !== "undefined") {
          document.isDirty = false;
        }
      }
    } catch (e) {
      // console.warn('Stabilization sync failed:', e)
    }
  }, 1500);
});

watch(
  () => document.doc?.name,
  () => {
    didEnrichOnce = false;
    setTimeout(() => {
      enrichOnceAfterLoad();
    }, 300);
  }
);

let isProcessingPaymentDetail = false;
let isProcessingDeductionBreakeven = false;
let isUpdatingFromAPI = false;

// Debouncing timeouts
let paymentDetailTimeout = null;
let deductionBreakevenTimeout = null;

// Function to generate random ID for payment detail rows (same logic as backend)
const generateRandomId = (idx) => {
  return Math.floor(1000 + idx + Math.random() * 9000);
};

// Function to fetch the single unknown donor from the system
async function fetchUnknownDonor() {
  try {
    const result = await call("frappe.client.get_list", {
      doctype: "Donor",
      filters: { donor_identity: "Unknown" },
      fields: ["name"],
      limit: 1,
    });
    
    if (result && result.length > 0) {
      return result[0].name;
    }
    return null;
  } catch (error) {
    console.error("Error fetching unknown donor:", error);
    return null;
  }
}

// CRITICAL FIX: Enhanced intention_id change handling to prevent infinite loops
watch(
  () => document.doc?.payment_detail,
  async (newPaymentDetail, oldPaymentDetail) => {
    // Skip if we're processing or updating from API
    if (isProcessingPaymentDetail || isUpdatingFromAPI) return;

    // Clear existing timeout
    if (paymentDetailTimeout) {
      clearTimeout(paymentDetailTimeout);
    }

    // Debounce the processing
    paymentDetailTimeout = setTimeout(async () => {
      if (!newPaymentDetail || !Array.isArray(newPaymentDetail)) return;

      isProcessingPaymentDetail = true;

      try {
        let shouldTriggerSetDeductionBreakeven = false;
        let hasChanges = false;

        // Process each payment detail row for changes that trigger backend calls
        for (let index = 0; index < newPaymentDetail.length; index++) {
          const row = newPaymentDetail[index];

          // Ensure random_id is present (EXACT backend logic)
          if (row && !row.random_id) {
            // Assign a random_id immediately for newly added rows to keep linkages stable
            row.random_id = generateRandomId(index + 1);
            hasChanges = true;

            // AUTO-FETCH: For new rows, if donor_identity is "Unknown", auto-fetch the unknown donor
            if (document.doc.donor_identity === "Unknown" && !row.donor) {
              const unknownDonorId = await fetchUnknownDonor();
              if (unknownDonorId) {
                row.donor = unknownDonorId;
                row._lastDonorId = unknownDonorId;
                // Fetch and populate donor details
                await handleDonorSelectionDirect(unknownDonorId, row);
                hasChanges = true;
              }
            }
          }

          // EXACT backend trigger: donor_id change
          if (row.donor && row.donor !== row._lastDonorId) {
            // console.log(`Donor ID changed in row ${index}:`, row.donor_id)
            row._lastDonorId = row.donor;
            row.donor = row.donor;
            await handleDonorSelectionDirect(row.donor, row);
            hasChanges = true;
          }

          // EXACT backend trigger: fund_class change
          if (row.fund_class && row.fund_class !== row._lastFundClassId) {
            console.log(`Fund Class ID changed in row ${index}:`, row.fund_class);
            row._lastFundClassId = row.fund_class;
            row.fund_class = row.fund_class;

            // When fund class changes, allow backend to recalculate by clearing any
            // user-locked percentage flags on related deduction breakeven rows
            if (
              document.doc.deduction_breakeven &&
              Array.isArray(document.doc.deduction_breakeven) &&
              row.random_id
            ) {
              document.doc.deduction_breakeven = document.doc.deduction_breakeven.map(
                (deductionRow) => {
                  if (deductionRow && deductionRow.random_id === row.random_id) {
                    // Clear preservation markers so new percentages from API can apply
                    delete deductionRow._userModifiedPercentage;
                    delete deductionRow._lastPercentage;
                  }
                  return deductionRow;
                }
              );
            }

            // Trigger backend deduction logic for all contribution types including Pledge
            shouldTriggerSetDeductionBreakeven = true;

            hasChanges = true;
          }

          // EXACT backend trigger: donation_amount change
          if (row.donation_amount !== row._lastDonationAmount) {
            // console.log(`Donation amount changed in row ${index}:`, row.donation_amount)
            row._lastDonationAmount = row.donation_amount;
            shouldTriggerSetDeductionBreakeven = true;
            hasChanges = true;
          }

          // EXACT backend trigger: intention_id change
          if (row.intention_id !== row._lastIntentionId) {
            // console.log(`Intention ID changed in row ${index}:`, row.intention_id)
            row._lastIntentionId = row.intention_id;

            // CRITICAL FIX: Handle Zakat intention by clearing only corresponding deduction breakeven rows
            if (row.intention_id === "Zakat") {
              // console.log(`Intention changed to Zakat for payment detail row ${index} with random_id ${row.random_id}`)

              // Clear only deduction breakeven rows that correspond to this specific payment detail row
              if (
                document.doc.deduction_breakeven &&
                Array.isArray(document.doc.deduction_breakeven)
              ) {
                const originalLength = document.doc.deduction_breakeven.length;

                // Guard against missing random_id on either side; only remove when both ids are defined and equal
                document.doc.deduction_breakeven = document.doc.deduction_breakeven.filter(
                  (deductionRow) => {
                    const payHasId = !!row.random_id;
                    const dedHasId = !!deductionRow.random_id;
                    // Keep the row unless both ids exist and match
                    const shouldKeep = !(
                      payHasId &&
                      dedHasId &&
                      deductionRow.random_id === row.random_id
                    );
                    return shouldKeep;
                  }
                );

                const removedCount =
                  originalLength - document.doc.deduction_breakeven.length;
                if (removedCount > 0) {
                  toast.success(
                    `Cleared ${removedCount} deduction breakeven row(s) for Zakat intention`
                  );
                }
              }

              hasChanges = true;
            } else {
              // For non-Zakat intentions, trigger deduction breakeven population
              shouldTriggerSetDeductionBreakeven = true;
              hasChanges = true;
            }
          }

          // EXACT backend trigger: mode of payment - handle account_paid_to auto-fill
          if (row.mode_of_payment && row.mode_of_payment !== row._lastMOPId) {
            // console.log('MODE OF PAYMENT CHANGED IN DONATION DETAIL', row.mode_of_payment)
            row._lastMOPId = row.mode_of_payment;

            try {
              const company = document.doc?.company || "Alkhidmat Foundation Pakistan";

              const result = await call(
                "crm.fcrm.doctype.donation.api.get_payment_mode_account",
                {
                  mode_of_payment: row.mode_of_payment,
                  company: company,
                }
              );

              if (result && result.success && result.account) {
                // console.log('Account fetched successfully:', result.account)
                row.account_paid_to = result.account;
              } else {
                // console.log('No account found')
                row.account_paid_to = "";

                if (result && result.message) {
                  toast.warning(result.message);
                } else {
                  toast.warning("No default account found for this mode of payment");
                }
              }
            } catch (error) {
              // console.error('Error fetching payment mode account:', error)
              row.account_paid_to = "";
              toast.error(`Error loading account for mode of payment: ${error.message}`);
            }

            hasChanges = true;
          }
        }

        // CRITICAL FIX: Only call set_deduction_breakeven for non-Zakat intentions
        if (shouldTriggerSetDeductionBreakeven) {
          // Check if any payment detail has Zakat intention
          const hasZakatIntention = newPaymentDetail.some(
            (row) => row.intention_id === "Zakat"
          );

          if (!hasZakatIntention) {
            // console.log('Triggering set_deduction_breakeven due to payment detail changes...')
            await setDeductionBreakevenFromAPI();
          } else {
            // console.log('Skipping set_deduction_breakeven due to Zakat intention - will handle row-specific clearing instead')
          }
        }

        // FIXED: Only trigger reactive update if we actually made changes and it's not from API
        if (hasChanges && !isUpdatingFromAPI) {
          // Use nextTick to avoid immediate re-triggering
          await nextTick();
          // Mark that we're updating to prevent watcher loops
          isUpdatingFromAPI = true;

          // CRITICAL FIX: Don't replace the array - just trigger reactivity without breaking row references
          // This preserves the Grid component's selection state
          document.doc = { ...document.doc };

          // Reset flag after a short delay
          setTimeout(() => {
            isUpdatingFromAPI = false;
          }, 100);
        }
      } finally {
        isProcessingPaymentDetail = false;
      }
    }, 300); // 300ms debounce
  },
  { deep: true }
);

// CRITICAL FIX: Enhanced deduction breakeven watcher to prevent infinite loops
watch(
  () => document.doc?.deduction_breakeven,
  async (newDeductionBreakeven, oldDeductionBreakeven) => {
    // Skip if we're processing or updating from API
    if (isProcessingDeductionBreakeven || isUpdatingFromAPI) return;

    if (deductionBreakevenTimeout) {
      clearTimeout(deductionBreakevenTimeout);
    }
    deductionBreakevenTimeout = setTimeout(async () => {
      if (!newDeductionBreakeven || !Array.isArray(newDeductionBreakeven)) return;

      isProcessingDeductionBreakeven = true;

      try {
        let shouldTriggerSetDeductionBreakeven = false;
        let hasChanges = false;

        newDeductionBreakeven.forEach((row, index) => {
          if (row.percentage !== row._lastPercentage) {
            const validationResult = validatePercentageLimits(row, index);
            if (!validationResult.isValid) {
              toast.error(validationResult.errorMessage);
              row.percentage = row._lastPercentage; 
              return; 
            }
            const calculatedAmount = calculateDeductionAmount(row);
            if (calculatedAmount !== null) {
              row.amount = calculatedAmount;
              row.base_amount = calculatedAmount;
            }

            row._lastPercentage = row.percentage;
            row._userModifiedPercentage = true; 
            shouldTriggerSetDeductionBreakeven = true;
            hasChanges = true;
          }
          if (row.min_percent !== row._lastMinPercent) {
            row._lastMinPercent = row.min_percent;
            row._userModifiedMinPercent = true;
            hasChanges = true;
          }

          if (row.max_percent !== row._lastMaxPercent) {
            row._lastMaxPercent = row.max_percent;
            row._userModifiedMaxPercent = true;
            hasChanges = true;
          }

          if (row.donation_amount !== row._lastDonationAmount) {
            row._lastDonationAmount = row.donation_amount;
            const calculatedAmount = calculateDeductionAmount(row);
            if (calculatedAmount !== null) {
              row.amount = calculatedAmount;
              row.base_amount = calculatedAmount;
            }

            hasChanges = true;
          }
        });
        if (shouldTriggerSetDeductionBreakeven) {
          await setDeductionBreakevenFromAPI();
        }
        if (hasChanges && !isUpdatingFromAPI) {
          await nextTick();
          isUpdatingFromAPI = true;
          document.doc.deduction_breakeven = [...document.doc.deduction_breakeven];
          setTimeout(() => {
            isUpdatingFromAPI = false;
          }, 100);
        }
      } finally {
        isProcessingDeductionBreakeven = false;
      }
    }, 300); 
  },
  { deep: true }
);
watch(
  () => document.doc?.contribution_type,
  async (newContributionType, oldContributionType) => {
    // Allow deduction breakeven for both Donation and Pledge types
    // Only refresh deduction breakeven when switching between types
    if (newContributionType && oldContributionType && newContributionType !== oldContributionType) {
      // Refresh deduction breakeven when contribution type changes
      await setDeductionBreakevenFromAPI();
    }
  }
);

async function handleDonorSelectionDirect(donorId, row) {
  if (!donorId) {
    clearDonorFields(row);
    return;
  }

  try {
    const donorDetails = await fetchDonorDetails(donorId);
    if (donorDetails) {
      updateDonorFields(row, donorDetails);
    } else {
      toast.error("Could not fetch donor details");
    }
  } catch (error) {
    toast.error("Error loading donor details");
  }
}

async function fetchDonorDetails(donorId) {
  try {
    const result = await call("frappe.client.get", {
      doctype: "Donor",
      name: donorId,
    });
    return result;
  } catch (error) {
    toast.error("Error loading donor details");
    return null;
  }
}

function updateDonorFields(row, donorDetails) {
  const fieldMappings = {
    donor_name: "donor_name",
    donor_type: "donor_type",
    contact_no: "contact_no",
    email: "email",
    city: "city",
    address: "address",
    cnic: "cnic",
    co_name: "co_name",
    co_contact_no: "co_contact_no",
    co_email: "co_email",
    co_address: "co_address",
    relationship_with_donor: "relationship_with_donor",
    area: "area",
    co_city: "co_city",
    co_country: "co_country",
    co_designation: "co_designation",
  };

  Object.entries(fieldMappings).forEach(([donorField, rowField]) => {
    if (donorDetails[donorField] !== undefined) {
      const oldValue = row[rowField];
      row[rowField] = donorDetails[donorField] || "";
    }
  });
}

function clearDonorFields(row) {
  const donorFields = [
    "donor_name",
    "donor_type",
    "contact_no",
    "email",
    "city",
    "address",
    "cnic",
    "co_name",
    "co_contact_no",
    "co_email",
    "co_address",
    "relationship_with_donor",
    "area",
    "co_city",
    "co_country",
    "co_designation",
  ];

  donorFields.forEach((fieldName) => {
    row[fieldName] = "";
  });

}
async function populateFundClassFieldsForPledge(row) {
  if (!row.fund_class) {
    clearFundClassFields(row);
    return;
  }

  try {
    const fundClassDetails = await fetchFundClassDetails(row.fund_class);
    if (fundClassDetails) {
      updateFundClassFields(row, fundClassDetails);
    } else {
      toast.error("Could not fetch Fund Class details");
    }
  } catch (error) {
    toast.error("Error loading Fund Class details");
  }
}

async function fetchFundClassDetails(fundClassId) {

  try {
    const result = await call("crm.fcrm.doctype.donation.api.get_fund_class_details", {
      fund_class: fundClassId,
      company: document.doc.company || "Alkhidmat Foundation Pakistan",
    });
    return result;
  } catch (error) {
    toast.error("Error loading Fund Class details");
    return null;
  }
}
function updateFundClassFields(row, fundClassDetails) {

  const fieldMappings = {
    service_area: "pay_service_area",
    subservice_area: "pay_subservice_area",
    product: "pay_product",
    equity_account: "equity_account",
    receivable_account: "receivable_account",
    cost_center: "cost_center",
  };

  Object.entries(fieldMappings).forEach(([fundClassField, rowField]) => {
    if (fundClassDetails[fundClassField] !== undefined) {
      const oldValue = row[rowField];
      row[rowField] = fundClassDetails[fundClassField] || "";

      if (fundClassDetails[fundClassField]) {
        row[rowField] = fundClassDetails[fundClassField];
      }
    }
  });

  if (fundClassDetails.equity_account) {
    row.equity_account = fundClassDetails.equity_account;
  }

  if (fundClassDetails.receivable_account) {
    row.receivable_account = fundClassDetails.receivable_account;
  }

}
function clearFundClassFields(row) {
  const fundClassFields = [
    "pay_service_area",
    "pay_subservice_area",
    "pay_product",
    "equity_account",
    "receivable_account",
    "cost_center",
  ];

  fundClassFields.forEach((fieldName) => {
    row[fieldName] = "";
  });

}

function shouldPopulateDeductionBreakeven() {
  if (document.doc?.name && document.doc.name !== "") {
    if (
      document.doc?.deduction_breakeven &&
      document.doc.deduction_breakeven.length > 0
    ) {
      return false;
    }
  }
  const shouldPopulate =
    document.doc?.donation_type === "Cash" &&
    document.doc?.payment_detail &&
    document.doc?.payment_detail.length > 0 &&
    (!document.doc?.deduction_breakeven ||
      document.doc?.deduction_breakeven.length === 0);

  return shouldPopulate;
}

let _populateDBDebounceTimer = null;
function schedulePopulateDeductionBreakeven() {
  if (_populateDBDebounceTimer) clearTimeout(_populateDBDebounceTimer);
  _populateDBDebounceTimer = setTimeout(() => {
    populateDeductionBreakevenFromAPI();
  }, 400);
}

onMounted(async () => {
  await nextTick();

  if (shouldPopulateDeductionBreakeven()) {
    setTimeout(() => {
      schedulePopulateDeductionBreakeven();
    }, 2000);
  }
  await refreshPaymentEntryAvailability();
});

watch(
  () => document.doc,
  (newDoc) => {
    if (shouldPopulateDeductionBreakeven()) {
      setTimeout(() => {
        schedulePopulateDeductionBreakeven();
      }, 800);
    }
  },
  { immediate: false, deep: true }
);
async function populateDeductionBreakevenFromAPI() {
  if (populateDeductionBreakevenFromAPI._inFlight) return;
  const nowTs = Date.now();
  const minGapMs = 1000;
  if (
    populateDeductionBreakevenFromAPI._lastRun &&
    nowTs - populateDeductionBreakevenFromAPI._lastRun < minGapMs
  )
    return;
  populateDeductionBreakevenFromAPI._inFlight = true;
  populateDeductionBreakevenFromAPI._lastRun = nowTs;

  if (!document.doc.payment_detail || document.doc.payment_detail.length === 0) {
    populateDeductionBreakevenFromAPI._inFlight = false;
    return;
  }

  // Allow deduction breakeven for all contribution types, including Pledge

  document.doc.payment_detail.forEach((row, idx) => {
    if (row && !row.random_id) {
      row.random_id = generateRandomId(idx + 1);
    }
  });

  const anyZakat = document.doc.payment_detail.some(
    (row) => row.intention_id === "Zakat"
  );
  const zakatRowIds = new Set();
  document.doc.payment_detail.forEach((row) => {
    if (row.intention_id === "Zakat" && row.random_id) {
      zakatRowIds.add(row.random_id);
    }
  });

  if (anyZakat) {
    if (
      document.doc.deduction_breakeven &&
      Array.isArray(document.doc.deduction_breakeven)
    ) {
      const originalLength = document.doc.deduction_breakeven.length;

      document.doc.deduction_breakeven = document.doc.deduction_breakeven.filter(
        (deductionRow) => {
          const shouldKeep = !zakatRowIds.has(deductionRow.random_id);

          return shouldKeep;
        }
      );

      const removedCount = originalLength - document.doc.deduction_breakeven.length;
      if (removedCount > 0) {
        toast.success(
          `Cleared ${removedCount} deduction breakeven row(s) for Zakat intention`
        );
      }
    }

    const nonZakatRows = document.doc.payment_detail.filter(
      (row) => row.intention_id !== "Zakat"
    );
    if (nonZakatRows.length === 0) {
      populateDeductionBreakevenFromAPI._inFlight = false;
      return;
    }
  }

  try {
    const result = await call(
      "crm.fcrm.doctype.donation.api.populate_deduction_breakeven",
      {
        payment_details: document.doc.payment_detail,
        company: document.doc.company || "Alkhidmat Foundation",
        contribution_type: document.doc.contribution_type || "Donation",
        donation_cost_center: document.doc.donation_cost_center,
        currency: document.doc.currency,
        to_currency: document.doc.to_currency || document.doc.currency,
        posting_date: document.doc.posting_date,
        is_return: document.doc.is_return || false,
        existing_deduction_breakeven: document.doc.deduction_breakeven || [],
      }
    );

    if (result.success) {
      document.doc.deduction_breakeven = result.deduction_breakeven;
      
      // Preserve user-entered fields when updating payment_detail
      if (result.updated_payment_details && Array.isArray(result.updated_payment_details)) {
        result.updated_payment_details.forEach((updatedRow, index) => {
          const existingRow = document.doc.payment_detail[index];
          if (existingRow && updatedRow) {
            // Preserve important user-entered fields
            const fieldsToPreserve = [
              'mode_of_payment', 'account_paid_to', 'transaction_no_cheque_no', 
              'cheque_reference_date', 'donor_id', 'donor_name', 'donor_type',
              'contact_no', 'email', 'city', 'address', 'cnic', 'co_name',
              'co_contact_no', 'co_email', 'co_address', 'relationship_with_donor',
              'area', 'co_city', 'co_country', 'co_designation', '_lastMOPId'
            ];
            
            fieldsToPreserve.forEach(field => {
              if (existingRow[field] !== undefined && existingRow[field] !== '') {
                updatedRow[field] = existingRow[field];
              }
            });
          }
        });
      }
      
      document.doc.payment_detail = result.updated_payment_details;
      document.doc = { ...document.doc };

      if (result.deduction_breakeven && result.deduction_breakeven.length > 0) {
      } else {
      }
    } else {
      toast.error(result.message || "Failed to populate deduction breakeven");
    }
  } catch (error) {
    toast.error("Error populating deduction breakeven");
  } finally {
    setTimeout(() => {
      populateDeductionBreakevenFromAPI._inFlight = false;
    }, 300);
  }
}

async function setDeductionBreakevenFromAPI() {
  if (!document.doc.payment_detail || document.doc.payment_detail.length === 0) {
    return;
  }

  // Allow deduction breakeven for all contribution types, including Pledge
  const zakatRowIds = new Set();
  document.doc.payment_detail.forEach((row) => {
    if (row.intention_id === "Zakat" && row.random_id) {
      zakatRowIds.add(row.random_id);
    }
  });

  if (zakatRowIds.size > 0) {
    if (
      document.doc.deduction_breakeven &&
      Array.isArray(document.doc.deduction_breakeven)
    ) {
      const originalLength = document.doc.deduction_breakeven.length;
      document.doc.deduction_breakeven = document.doc.deduction_breakeven.filter(
        (deductionRow) => {
          const shouldKeep = !zakatRowIds.has(deductionRow.random_id);
          if (!shouldKeep) {
          }
          return shouldKeep;
        }
      );

      const removedCount = originalLength - document.doc.deduction_breakeven.length;
      if (removedCount > 0) {
        toast.success(
          `Cleared ${removedCount} deduction breakeven row(s) for Zakat intention`
        );
      }
    }
    const nonZakatRows = document.doc.payment_detail.filter(
      (row) => row.intention_id !== "Zakat"
    );
    if (nonZakatRows.length === 0) {
      return;
    }
  }

  if (isUpdatingFromAPI) {
    return;
  }

  try {
    isUpdatingFromAPI = true;

    const preservedUserModifications = {};
    if (
      document.doc.deduction_breakeven &&
      Array.isArray(document.doc.deduction_breakeven)
    ) {
      document.doc.deduction_breakeven.forEach((row, index) => {
        if (row && (row._userModifiedPercentage || row._lastPercentage !== undefined)) {
          preservedUserModifications[index] = {
            percentage: row.percentage,
            min_percent: row.min_percent,
            max_percent: row.max_percent,
            amount: row.amount,
            base_amount: row.base_amount,
          };
        }
      });
    }
    const result = await call("crm.fcrm.doctype.donation.api.set_deduction_breakeven", {
      payment_details: document.doc.payment_detail,
      company: document.doc.company || "Alkhidmat Foundation",
      contribution_type: document.doc.contribution_type || "Donation",
      donation_cost_center: document.doc.donation_cost_center,
      currency: document.doc.currency,
      to_currency: document.doc.to_currency || document.doc.currency,
      posting_date: document.doc.posting_date,
      is_return: document.doc.is_return || false,
    });

    if (result.success) {
      document.doc.deduction_breakeven = result.deduction_breakeven;
      
      // Preserve user-entered fields when updating payment_detail
      if (result.updated_payment_details && Array.isArray(result.updated_payment_details)) {
        result.updated_payment_details.forEach((updatedRow, index) => {
          const existingRow = document.doc.payment_detail[index];
          if (existingRow && updatedRow) {
            // Preserve important user-entered fields
            const fieldsToPreserve = [
              'mode_of_payment', 'account_paid_to', 'transaction_no_cheque_no', 
              'cheque_reference_date', 'donor_id', 'donor_name', 'donor_type',
              'contact_no', 'email', 'city', 'address', 'cnic', 'co_name',
              'co_contact_no', 'co_email', 'co_address', 'relationship_with_donor',
              'area', 'co_city', 'co_country', 'co_designation', '_lastMOPId'
            ];
            
            fieldsToPreserve.forEach(field => {
              if (existingRow[field] !== undefined && existingRow[field] !== '') {
                updatedRow[field] = existingRow[field];
              }
            });
          }
        });
      }
      
      document.doc.payment_detail = result.updated_payment_details;

      if (
        document.doc.deduction_breakeven &&
        Array.isArray(document.doc.deduction_breakeven)
      ) {
        document.doc.deduction_breakeven.forEach((row, index) => {
          if (row && preservedUserModifications[index]) {
            const preserved = preservedUserModifications[index];

            row.percentage = preserved.percentage;
            row._lastPercentage = preserved.percentage;
            row._userModifiedPercentage = preserved._userModifiedPercentage;

            if (preserved.min_percent !== undefined) {
              row.min_percent = preserved.min_percent;
              row._lastMinPercent = preserved.min_percent;
            }

            if (preserved.max_percent !== undefined) {
              row.max_percent = preserved.max_percent;
              row._lastMaxPercent = preserved.max_percent;
            }
            const calculatedAmount = calculateDeductionAmount(row);
            if (calculatedAmount !== null) {
              row.amount = calculatedAmount;
              row.base_amount = calculatedAmount;
            }
          }
        });
      }

      await nextTick();
      document.doc = { ...document.doc };

      if (result.deduction_breakeven && result.deduction_breakeven.length > 0) {
      }
    } 
  } catch (error) {
    toast.error("Error setting deduction breakeven");
  } finally {
    setTimeout(() => {
      isUpdatingFromAPI = false;
    }, 200);
  }
}

function validatePercentageLimits(row, rowIndex) {
  const rowNum = rowIndex + 1;
  const percentage = parseFloat(row.percentage);

  if (isNaN(percentage)) {
    return {
      isValid: false,
      errorMessage: `Percentage for deduction breakeven row ${rowNum} must be a valid number.`,
    };
  }

  if (percentage < 0) {
    return {
      isValid: false,
      errorMessage: `Percentage for deduction breakeven row ${rowNum} cannot be negative.`,
    };
  }

  if (percentage > 100) {
    return {
      isValid: false,
      errorMessage: `Percentage for deduction breakeven row ${rowNum} cannot exceed 100%.`,
    };
  }

  if (
    row.min_percent !== null &&
    row.min_percent !== undefined &&
    row.max_percent !== null &&
    row.max_percent !== undefined
  ) {
    const minPercentage = parseFloat(row.min_percent);
    const maxPercentage = parseFloat(row.max_percent);

    if (!isNaN(minPercentage) && !isNaN(maxPercentage)) {
      if (percentage < minPercentage || percentage > maxPercentage) {
        return {
          isValid: false,
          errorMessage: `Percentage for deduction breakeven row ${rowNum} must be between ${minPercentage}% and ${maxPercentage}%. Current value: ${percentage}%.`,
        };
      }
    } else if (!isNaN(minPercentage) && percentage < minPercentage) {
      return {
        isValid: false,
        errorMessage: `Percentage for deduction breakeven row ${rowNum} must be at least ${minPercentage}%. Current value: ${percentage}%.`,
      };
    } else if (!isNaN(maxPercentage) && percentage > maxPercentage) {
      return {
        isValid: false,
        errorMessage: `Percentage for deduction breakeven row ${rowNum} must not exceed ${maxPercentage}%. Current value: ${percentage}%.`,
      };
    }
  }

  return { isValid: true };
}

function restoreUserModificationsAfterReload(preservedUserModifications) {
  if (!document.doc || !document.doc.deduction_breakeven) {
    return;
  }
  let modifications = preservedUserModifications;
  if (!modifications || Object.keys(modifications).length === 0) {
    try {
      const stored = sessionStorage.getItem("preservedUserModifications");
      if (stored) {
        modifications = JSON.parse(stored);
        sessionStorage.removeItem("preservedUserModifications"); 
      }
    } catch (error) {
      return;
    }
  }

  if (!modifications || Object.keys(modifications).length === 0) {
    return;
  }

  if (
    document.doc.deduction_breakeven &&
    Array.isArray(document.doc.deduction_breakeven)
  ) {
    document.doc.deduction_breakeven.forEach((row, index) => {
      const key = `deduction_breakeven_${index}`;
      if (row && modifications[key]) {
        const preserved = modifications[key];

        if (preserved.percentage !== undefined) {
          row.percentage = preserved.percentage;
          row._lastPercentage = preserved._lastPercentage;
          row._userModifiedPercentage = preserved._userModifiedPercentage;
        }

        if (preserved.min_percent !== undefined) {
          row.min_percent = preserved.min_percent;
          row._lastMinPercent = preserved._lastMinPercent;
          row._userModifiedMinPercent = preserved._userModifiedMinPercent;
        }

        if (preserved.max_percent !== undefined) {
          row.max_percent = preserved.max_percent;
          row._lastMaxPercent = preserved._lastMaxPercent;
          row._userModifiedMaxPercent = preserved._userModifiedMaxPercent;
        }
        if (preserved.percentage !== undefined) {
          const calculatedAmount = calculateDeductionAmount(row);
          if (calculatedAmount !== null) {
            row.amount = calculatedAmount;
            row.base_amount = calculatedAmount;
          }
        }
      }
    });
    document.doc = { ...document.doc };
  }
}

watch(
  () => document.doc,
  (newDoc, oldDoc) => {
    if (newDoc && (!oldDoc || oldDoc.name !== newDoc.name)) {

      setTimeout(() => {
        restoreUserModificationsAfterReload();
      }, 1000);
    }
  },
  { deep: true }
);

document.triggerOnChange = customTriggerOnChange;

const originalTriggerOnRowRemove = document.triggerOnRowRemove;

const customTriggerOnRowRemove = (selectedRows, remainingRows) => {

  if (document.doc.payment_detail && Array.isArray(document.doc.payment_detail)) {

    const deletedRandomIds = new Set();
    selectedRows.forEach((rowName) => {
      const deletedRow = document.doc.payment_detail.find((row) => row.name === rowName);
      if (deletedRow && deletedRow.random_id) {
        deletedRandomIds.add(deletedRow.random_id);
      }
    });

    if (
      deletedRandomIds.size > 0 &&
      document.doc.deduction_breakeven &&
      Array.isArray(document.doc.deduction_breakeven)
    ) {
      const originalDeductionLength = document.doc.deduction_breakeven.length;

      document.doc.deduction_breakeven = document.doc.deduction_breakeven.filter(
        (deductionRow) => {
          const shouldKeep = !deletedRandomIds.has(deductionRow.random_id);
          if (!shouldKeep) {
          }
          return shouldKeep;
        }
      );

      const deletedDeductionCount =
        originalDeductionLength - document.doc.deduction_breakeven.length;
      if (deletedDeductionCount > 0) {
        toast.success(
          `Deleted ${deletedDeductionCount} corresponding deduction breakeven row(s)`
        );
      }
    }
  }

  if (originalTriggerOnRowRemove) {
    originalTriggerOnRowRemove(selectedRows, remainingRows);
  }
};

document.triggerOnRowRemove = customTriggerOnRowRemove;

const createDropdownOptions = computed(() => {
  const options = [];

  const doc = document.doc;
  if (!doc) return options;

  const contribution = (doc.contribution_type || "").toLowerCase();
  const donationType = (doc.donation_type || "").toLowerCase();
  const status = (doc.status || "").toLowerCase();

  // If status is "partly paid", only show Payment Entry
  if (status === "partly paid") {
    options.push({ label: "Payment Entry", onClick: openPaymentEntryModal });
    return options;
  }

  // Show Return / Credit Note ONLY when contribution_type is Donation and donation_type is Cash
  if (contribution === "donation" && donationType === "cash" && !doc.is_return) {
    options.push({ label: "Return / Credit Note", onClick: createReturnCreditNote });
  }
  // When contribution_type is Pledge and donation_type is Cash, show Payment Entry instead
  else if (contribution === "pledge" && donationType === "cash") {
    if (!hasPaymentEntry.value) {
      options.push({ label: "Payment Entry", onClick: openPaymentEntryModal });
    } else if (!doc.is_return) {
      options.push({ label: "Return / Credit Note", onClick: createReturnCreditNote });
    }
  }

  return options;
});

// Computed property for showing Reverse Donor button separately
const showReverseDonorButton = computed(() => {
  const doc = document.doc;
  if (!doc) return false;

  const donorIdentity = (doc.donor_identity || "").toLowerCase();
  const contribution = (doc.contribution_type || "").toLowerCase();

  return donorIdentity === "unknown" && doc.docstatus === 1 && contribution === "donation";
});

// Payment Entry Modal State
const showPaymentEntryModal = ref(false);
const paymentEntryForm = ref({
  donor_id: "",
  serial_no: "",
  mode_of_payment: "",
  account_paid_to: "",
  cheque_reference_no: "",
  paid_amount: 0,
});
const paymentReadonly = ref({
  outstanding_amount: 0,
  doubtful_debt_amount: 0,
  remaining_amount: 0,
});
const hasPaymentEntry = ref(false);

function formatCurrency(value) {
  const num = Number(value || 0);
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: document.doc?.to_currency || document.doc?.currency || 'PKR' }).format(num);
  } catch (e) {
    return `${num}`;
  }
}

async function refreshPaymentEntryAvailability() {
  try {
    if (!document.doc?.name) return;
    const res = await call("akf_accounts.akf_accounts.doctype.donation.donation.verify_payment_entry", {
      doctype: "Payment Entry Reference",
      reference_name: document.doc.name,
      fieldname: "name",
    });
    hasPaymentEntry.value = Array.isArray(res) ? res.length > 0 : !!res?.length;
  } catch (e) {
    // ignore
  }
}

function openPaymentEntryModal() {
  // Try to prefill donor and serial from first payment_detail row
  const pd = (document.doc && Array.isArray(document.doc.payment_detail)) ? document.doc.payment_detail[0] : null;
  paymentEntryForm.value = {
    donor_id: pd?.donor || "",
    serial_no: pd?.idx || pd?.serial_no || "",
    mode_of_payment: "",
    account_paid_to: "",
    cheque_reference_no: "",
    paid_amount: 0,
  };
  // Fetch readonly metrics for selected donor/row
  fetchDonationPaymentMetrics();
  showPaymentEntryModal.value = true;
}

async function fetchDonationPaymentMetrics() {
  try {
    const doc = document.doc;
    if (!doc) return;
    if (!paymentEntryForm.value.donor_id || !paymentEntryForm.value.serial_no) return;
    const details = await call("akf_accounts.akf_accounts.doctype.donation.donation.get_donation_details", {
      filters: JSON.stringify({ name: doc.name, donor_id: paymentEntryForm.value.donor_id, idx: paymentEntryForm.value.serial_no }),
    });
    // Backend returns values only for certain flows; provide robust fallback like backend UI
    let outstanding = Number(details?.outstanding_amount ?? NaN);
    let doubtful = Number(details?.doubtful_debt_amount ?? NaN);
    if (Number.isNaN(outstanding)) {
      // Fallbacks: prefer document's outstanding_amount if available
      const docOutstanding = Number(doc.outstanding_amount ?? NaN);
      if (!Number.isNaN(docOutstanding)) {
        outstanding = docOutstanding;
      } else {
        // Compute based on backend logic: pledge uses total_donation; donation uses net amount
        const totalDonation = Number(doc.total_donation || 0);
        const totalDeduction = Number(doc.total_deduction || 0);
        const netAmount = totalDonation - totalDeduction;
        const isPledge = (doc.contribution_type || "").toLowerCase() === "pledge";
        outstanding = isPledge ? totalDonation : netAmount;
      }
    }
    if (Number.isNaN(doubtful)) {
      doubtful = 0;
    }
    paymentReadonly.value.outstanding_amount = outstanding;
    paymentReadonly.value.doubtful_debt_amount = doubtful;
    paymentReadonly.value.remaining_amount = Math.max(outstanding - Number(paymentEntryForm.value.paid_amount || 0), 0);
  } catch (e) {
    // ignore errors
    // Still set fallbacks so UI shows expected values
    const doc = document.doc;
    if (doc) {
      const docOutstanding = Number(doc.outstanding_amount ?? NaN);
      const totalDonation = Number(doc.total_donation || 0);
      const totalDeduction = Number(doc.total_deduction || 0);
      const netAmount = totalDonation - totalDeduction;
      const isPledge = (doc.contribution_type || "").toLowerCase() === "pledge";
      const outstanding = !Number.isNaN(docOutstanding) ? docOutstanding : (isPledge ? totalDonation : netAmount);
      paymentReadonly.value.outstanding_amount = outstanding;
      paymentReadonly.value.doubtful_debt_amount = 0;
      paymentReadonly.value.remaining_amount = Math.max(outstanding - Number(paymentEntryForm.value.paid_amount || 0), 0);
    }
  }
}

watch(() => paymentEntryForm.value.paid_amount, () => {
  const outstanding = Number(paymentReadonly.value.outstanding_amount || 0);
  paymentReadonly.value.remaining_amount = Math.max(outstanding - Number(paymentEntryForm.value.paid_amount || 0), 0);
});

watch(
  () => paymentEntryForm.value.mode_of_payment,
  async (value) => {
    try {
      if (!value) return;
      const mop = await call("frappe.client.get", { doctype: "Mode of Payment", name: value });
      const accounts = mop?.accounts || [];
      const forCompany = accounts.find((a) => a.company === document.doc.company);
      if (forCompany?.default_account) {
        paymentEntryForm.value.account_paid_to = forCompany.default_account;
      }
    } catch (e) {
      // ignore
    }
  }
);

async function submitPaymentEntry() {
  try {
    const doc = document.doc;
    if (!doc) return;
    const paidAmount = Number(paymentEntryForm.value.paid_amount || 0);
    const serialNo = Number(paymentEntryForm.value.serial_no || 0);
    if (!paidAmount || paidAmount <= 0) {
      toast.error(__('Please enter a valid Paid Amount'));
      return;
    }
    const payloadDoc = JSON.stringify({ name: doc.name, company: doc.company, currency: doc.currency, to_currency: doc.to_currency, total_donation: doc.total_donation, outstanding_amount: doc.outstanding_amount });
    const payloadValues = JSON.stringify({
      donor_id: paymentEntryForm.value.donor_id,
      serial_no: serialNo,
      mode_of_payment: paymentEntryForm.value.mode_of_payment,
      account_paid_to: paymentEntryForm.value.account_paid_to,
      cheque_reference_no: paymentEntryForm.value.cheque_reference_no,
      cheque_reference_date: paymentEntryForm.value.cheque_reference_date,
      paid_amount: paidAmount,
    });
    const peName = await call("akf_accounts.akf_accounts.doctype.donation.donation.pledge_payment_entry", {
      doc: payloadDoc,
      values: payloadValues,
    });
    toast.success(__("Payment Entry created"));
    showPaymentEntryModal.value = false;
    await document.reload();
    await refreshPaymentEntryAvailability();
  } catch (e) {
    console.error(e);
    // Extract friendly message from frappe error
    const msg = e?.messages?.[0] || e?.message || (typeof e === 'string' ? e : null);
    const friendly = msg && typeof msg === 'string' ? msg.replace(/Traceback[\s\S]*/,'').trim() : null;
    toast.error(friendly || __('Error creating Payment Entry'));
  }
}

// Reverse Donor Modal State
const showReverseDonorModal = ref(false);
const reverseDonorForm = ref({
  donor: "",
  serial_no: "",
});
const availableSerialNumbers = ref([]);

async function openReverseDonorModal() {
  try {
    if (!document.doc?.name) return;
    
    // Fetch available serial numbers (payment details that can be reversed)
    const idxList = await call("akf_accounts.akf_accounts.doctype.donation.donation.get_idx_list_unknown", {
      donation_id: document.doc.name,
    });
    
    if (!idxList || idxList.length === 0) {
      toast.info(__("No payment details available for reversal"));
      return;
    }
    
    availableSerialNumbers.value = idxList;
    reverseDonorForm.value = {
      donor: "",
      serial_no: idxList[0] || "",
    };
    
    showReverseDonorModal.value = true;
  } catch (e) {
    console.error(e);
    toast.error(__("Error loading payment details"));
  }
}

async function submitReverseDonor() {
  try {
    if (!reverseDonorForm.value.donor) {
      toast.error(__("Please select a donor"));
      return;
    }

    if (!reverseDonorForm.value.serial_no) {
      toast.error(__("Please select a serial number"));
      return;
    }

    // Update current donation (Desk uses the same method)
    await call("akf_accounts.akf_accounts.doctype.donation.donation.set_unknown_to_known", {
      name: document.doc.name,
      values: JSON.stringify({
        donor: reverseDonorForm.value.donor,
        serial_no: reverseDonorForm.value.serial_no,
      }),
    });

    toast.success(__("Donor reversed to Known successfully"));
    showReverseDonorModal.value = false;
    await document.reload();
  } catch (e) {
    console.error(e);
    toast.error(e.message || __("Error updating donor"));
  }
}

async function createReturnCreditNote() {
  try {
    if (!document.doc || !document.doc.name) return;
    const totalReturned = await call(
      "akf_accounts.akf_accounts.doctype.donation.donation.get_total_donors_return",
      {
        return_against: document.doc.name,
      }
    );

    if (totalReturned === document.doc.total_donors) {
      toast.info(__("All donors already returned for this document"));
      return;
    }

    // PRESERVE original payment detail fields before creating return
    const originalPaymentDetails = [];
    if (document.doc.payment_detail && Array.isArray(document.doc.payment_detail)) {
      document.doc.payment_detail.forEach((row, index) => {
        if (row) {
          originalPaymentDetails[index] = {
            mode_of_payment: row.mode_of_payment,
            account_paid_to: row.account_paid_to,
            transaction_no_cheque_no: row.transaction_no_cheque_no,
            cheque_reference_date: row.cheque_reference_date,
            donor_id: row.donor_id || row.donor,
            donor_name: row.donor_name,
            donor_type: row.donor_type,
            contact_no: row.contact_no,
            email: row.email,
            city: row.city,
            address: row.address,
            cnic: row.cnic,
            co_name: row.co_name,
            co_contact_no: row.co_contact_no,
            co_email: row.co_email,
            co_address: row.co_address,
            relationship_with_donor: row.relationship_with_donor,
            area: row.area,
            co_city: row.co_city,
            co_country: row.co_country,
            co_designation: row.co_designation,
          };
        }
      });
    }

    const mapped = await call(
      "akf_accounts.akf_accounts.doctype.donation.donation.make_donation_return",
      {
        source_name: document.doc.name,
      },
      { silent: true }
    );
    const created = await call("frappe.client.insert", { doc: mapped }, { silent: true });

    if (created && created.name) {
      // RESTORE preserved fields to the return document
      if (originalPaymentDetails.length > 0 && created.payment_detail && Array.isArray(created.payment_detail)) {
        let needsUpdate = false;
        
        created.payment_detail.forEach((row, index) => {
          const originalRow = originalPaymentDetails[index];
          if (row && originalRow) {
            // Restore all preserved payment detail fields
            Object.keys(originalRow).forEach(fieldName => {
              if (originalRow[fieldName] !== undefined && originalRow[fieldName] !== null && originalRow[fieldName] !== '') {
                if (row[fieldName] !== originalRow[fieldName]) {
                  row[fieldName] = originalRow[fieldName];
                  needsUpdate = true;
                }
              }
            });
          }
        });

        // Update the return document with preserved fields
        if (needsUpdate) {
          await call("frappe.client.save", { 
            doc: created 
          }, { silent: true });
        }
      }

      toast.success(__("Return / Credit Note created"));
      router.push({ name: "DonationDetail", params: { donationId: created.name } });
    } else {
      toast.error(__("Failed to create Return / Credit Note"));
    }
  } catch (e) {
    const htmlToText = (input) => {
      if (!input) return "";
      let str = String(input);
      str = str.replace(/<br\s*\/?\s*>/gi, "\n");
      str = str.replace(/<[^>]+>/g, "");
      str = str
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
      str = str
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .join("\n");
      return str;
    };

    const extractFrappeServerMessage = (err) => {
      const tryParse = (val) => {
        try {
          return JSON.parse(val);
        } catch {
          return null;
        }
      };

      if (Array.isArray(err?.messages) && err.messages.length) {
        let text = htmlToText(err.messages.join("\n"));
        if (text) {
          if (/^Row\s*#\d+/i.test(text) && !/Return entries already exist\./i.test(text)) {
            text = `Return entries already exist.\n${text}`;
          }
          return text;
        }
      }

      const server = err?._server_messages || err?.response?._server_messages || err?.exc?._server_messages;
      if (server && typeof server === "string") {
        const list = tryParse(server);
        if (Array.isArray(list) && list.length > 0) {
          const first = typeof list[0] === "string" ? tryParse(list[0]) || list[0] : list[0];
          if (first && typeof first === "object") {
            const title = first.title ? String(first.title) : "";
            const message = first.message ? String(first.message) : "";
            const text = [title && htmlToText(title), htmlToText(message)]
              .filter(Boolean)
              .join("\n");
            if (text) return text;
          } else if (typeof first === "string") {
            return htmlToText(first);
          }
        }
      }
      const raw = err?.message || err?.exc || err;
      return htmlToText(raw);
    };

    const pretty = extractFrappeServerMessage(e) || __("Failed to create Return / Credit Note");
    toast.error(pretty);
  }
}

async function submitDonation() {
  try {
    if (!document.doc.company) {
      toast.error("Company is required before submitting");
      return;
    }

    if (!document.doc.donation_type) {
      toast.error("Donation Type is required before submitting");
      return;
    }

    if (!document.doc.due_date) {
      toast.error("Due Date is required before submitting");
      return;
    }

    if (
      !document.doc.donation_type === "In Kind Donation" &&
      (!document.doc.payment_detail || document.doc.payment_detail.length === 0)
    ) {
      toast.error("At least one payment detail is required before submitting");
      return;
    }

    if (!(await validateAndShowErrors())) {
      return;
    }

    // PRESERVE user modifications before submit (same as save function)
  // Ensure user-edited deduction percentages are applied before submit
  applyUserModifiedDeductionPercentages();
  const preservedUserModifications = preserveUserModificationsBeforeSave();

    await new Promise((resolve, reject) => {
      document.save.submit(null, {
        onSuccess: () => resolve(),
        onError: (err) => reject(err),
      });
    });
    let result;
    try {
      if (document.submit) {
        result = await document.submit();
      } else {
        result = await call("frappe.client.submit", {
          doc: document.doc,
        });
      }
    } catch (submitError) {
      result = await call("frappe.client.submit", {
        doc: document.doc,
      });
    }

    if (result) {
      toast.success("Donation submitted successfully");
      try {
        await document.reload();
        
        // RESTORE user modifications after reload (same as save function)
        setTimeout(() => {
          restoreUserModificationsAfterSave(preservedUserModifications);
        }, 1000); // Wait for reload to complete

      } catch (e) {
        setTimeout(() => {
          window.location.reload();
        }, 300);
      }
    } else {
      toast.error("Failed to submit donation");
    }
  } catch (error) {
    if (error.message && error.message.includes("TimestampMismatchError")) {
      toast.error(
        "Document was modified by another user. Please refresh the page and try again."
      );
      await document.reload();
    } else {
      toast.error(`Failed to submit donation: ${error.message || error}`);
    }
  }
}

const isReadOnly = computed(() => {
  return document.doc && document.doc.docstatus === 1;
});

function handleAddDeductionRow(data) {
  schedulePopulateDeductionBreakeven();
}
</script>

<style scoped></style>
