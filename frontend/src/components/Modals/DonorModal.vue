<template>
  <Dialog
    v-model="show"
    :options="{ size: '4xl' }"
    :disableOutsideClickToClose="true"
    :disableEscToClose="hasActiveSubModals"
    :zIndex="hasActiveSubModals ? 1000 : 100"
    :backdrop="hasActiveSubModals ? 'static' : true"
    :persistent="true"
    data-modal="parent"
  >
    <template #body>
      <AppStyling type="donor-modal-background">
        <AppStyling type="modal-styling" modalType="header">
          <div class="mb-5 flex items-center justify-between">
            <div>
              <h3 class="text-2xl font-semibold text-ink-gray-9">
                {{ __("Create Donor") }}
              </h3>
            </div>
            <div class="flex items-center gap-1">
              <Button
                v-if="isManager() && !isMobileView"
                variant="ghost"
                class="w-7"
                @click="openQuickEntryModal"
              >
                <template #icon><FeatherIcon name="edit" class="size-4" /></template>
              </Button>
              <Button variant="ghost" class="w-7" @click="handleCloseButton">
                <template #icon><FeatherIcon name="x" class="size-4" /></template>
              </Button>
            </div>
          </div>
          <div>
            <div class="field-layout-wrapper">
              <FieldLayout
                v-if="tabs.data"
                :tabs="tabs.data"
                :data="donor.doc"
                :doctype="'Donor'"
                @open-create-modal="openCreateModal"
                @tab-change="handleTabChange"
                @field-change="onFieldChange"
              />
            </div>
            <ErrorMessage class="mt-4" v-if="error" :message="__(error)" />
          </div>
        </AppStyling>

        <AppStyling type="modal-styling" modalType="footer">
          <div class="flex flex-row-reverse gap-2">
            <AppStyling
              type="button"
              buttonType="create"
              buttonLabel="Create"
              :buttonLoading="isDonorCreating"
              @click="createNewDonor"
            />
          </div>
        </AppStyling>
      </AppStyling>
    </template>
  </Dialog>

  <QuickEntryModal
    v-model="showQuickEntryModal"
    :doctype="'Donor'"
    @close="onQuickEntryClose"
    @reset="onQuickEntryReset"
    @saved="onQuickEntrySaved"
  />

  <template v-for="(modal, idx) in modalStack" :key="idx">
    <CreateDocumentModal
      v-model="modal.visible"
      :doctype="modal.doctype"
      :data="{ name: modal.initialValue }"
      @callback="(doc) => handleModalSuccess(idx, doc)"
      @close="() => handleModalClose(idx)"
      @open-create-modal="openCreateModal"
      @subModalActive="() => ensureParentModalVisible(idx)"
      @subModalInteraction="
        () => {
          handleSubModalInteraction();
          manageParentModalState();
        }
      "
      :isSubModal="true"
    />
  </template>

  <Dialog
    v-model="showCnicExistsDialog"
    :options="{ size: 'sm' }"
    :disableOutsideClickToClose="true"
    :disableEscToClose="true"
  >
    <template #body>
      <div class="p-6 text-center">
        <div class="text-lg font-semibold text-red-600 mb-2">{{ cnicExistsMessage }}</div>
        <Button variant="solid" @click="closeErrorDialog">OK</Button>
      </div>
    </template>
  </Dialog>

  <Dialog
    v-model="showCnicValidationDialog"
    :options="{ size: 'sm' }"
    :disableOutsideClickToClose="true"
    :disableEscToClose="true"
  >
    <template #body>
      <div class="p-6 text-center">
        <div class="text-lg font-semibold text-red-600 mb-2">
          {{ cnicValidationMessage }}
        </div>
        <Button variant="solid" @click="closeCnicValidationDialog">OK</Button>
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { ref, reactive, watch, onMounted, onUnmounted, computed, nextTick } from "vue";
import {
  createResource,
  createListResource,
  call,
  Dialog,
  Button,
  ErrorMessage,
  toast,
} from "frappe-ui";
import FeatherIcon from "@/components/Icons/FeatherIcon.vue";
import QuickEntryModal from "@/components/Modals/QuickEntryModal.vue";
import FieldLayout from "@/components/FieldLayout/FieldLayout.vue";
import CreateDocumentModal from "@/components/Modals/CreateDocumentModal.vue";
import AppStyling from "@/components/AppStyling.vue";
import { useDonorFieldValidation } from "@/composables/useDonorFieldValidation";
import {
  countryCurrencyMap,
  getCurrencyForCountry,
} from "@/constants/countryCurrencyMap";
import { usersStore } from "@/stores/users";
import { sessionStore } from "@/stores/session";
import { showQuickEntryModal, quickEntryProps } from "@/composables/modals";
import { isMobileView } from "@/composables/settings";
import { useDocument } from "@/data/document";
import { useRouter } from "vue-router";

const props = defineProps({
  defaults: Object,
  options: { type: Object, default: () => ({}) },
});
const emit = defineEmits(["donor-created", "donor-deleted"]);
const show = defineModel();

const router = useRouter();
const error = ref(null);
const isDonorCreating = ref(false);

const {
  showCnicExistsDialog,
  cnicExistsMessage,
  showCnicValidationDialog,
  cnicValidationMessage,
  applyCnicMaskToInput,
  validateCnicFormat,
  applyPhoneMaskToInput,
  applyPhoneMasksForCountry,
  validatePhoneNumber,
  showPhoneValidationFeedback,
  findInputField,
} = useDonorFieldValidation();

const { document: donor, triggerOnBeforeCreate } = useDocument("Donor");

let resetDonorForm;

const modalStack = ref([]);
const hasActiveSubModals = computed(() => modalStack.value.some((m) => m.visible));

function openQuickEntryModal() {
  const currentDoctype = modalStack.value.length
    ? modalStack.value[modalStack.value.length - 1].doctype
    : "Donor";
  showQuickEntryModal.value = true;
  quickEntryProps.value = { doctype: currentDoctype };
  nextTick(() => {
    show.value = false;
  });
}

const donorDeskResource = createListResource({
  doctype: "Donor Desk",
  filters: computed(() =>
    donor.doc?.department ? { department: donor.doc.department } : {}
  ),
  fields: ["name", "desk_name", "department"],
  auto: false,
});

const donorDeskOptions = computed(() => {
  if (
    !donor.doc?.department ||
    !donorDeskResource.data ||
    donorDeskResource.data.length === 0
  )
    return [];
  return donorDeskResource.data.map((desk) => ({
    label: desk.desk_name || desk.name,
    value: desk.name,
  }));
});

function configureDonorDeskField(field) {
  if (!field || field.fieldname !== "donor_desk") return;
  field.options = "Donor Desk";
  field.fieldtype = "Link";
  field.get_query = () => {
    const department = donor.doc?.department;
    return {
      doctype: "Donor Desk",
      filters: department ? { department } : { department: ["!=", undefined] },
    };
  };
  field.depends_on = "department";
  field.placeholder = donor.doc?.department
    ? "Select Donor Desk"
    : "Please select a department first";
  field.description = donor.doc?.department
    ? ""
    : "Please select a department to see available donor desks";
  field.read_only = !donor.doc?.department;
  field.hidden = false;
  if (!donor.doc[field.fieldname]) donor.doc[field.fieldname] = "";
}

const { getUser, isManager } = usersStore();
const { user } = sessionStore();

async function getCurrentUserId() {
  if (user.value?.name) return user.value.name;
  if (typeof frappe !== "undefined" && frappe.session && frappe.session.user)
    return frappe.session.user;
  try {
    const response = await call("frappe.auth.get_logged_user");
    if (response) return response;
  } catch {}
  try {
    if (typeof window !== "undefined") {
      const fromStorage = localStorage.getItem("frappe_user") || null;
      if (fromStorage) return decodeURIComponent(fromStorage);
      const params = new URLSearchParams(window.location.search);
      const urlUser = params.get("user") || params.get("owner");
      if (urlUser) return decodeURIComponent(urlUser);
      const pageTitle = document.title;
      if (pageTitle && pageTitle.includes("User:")) {
        const m = pageTitle.match(/User:\s*([^\s]+)/);
        if (m) return m[1];
      }
    }
  } catch {}
  return "";
}

resetDonorForm = async function () {
  const currentUserId = await getCurrentUserId();
  donor.doc = {
    status: "Active",
    identification_type: "CNIC",
    identification_value: "99999-9999999-9",
    donor_identity: "Known",
    country: "Pakistan",
    owner_id: currentUserId,
    contact_numbers: [
      { phone: "", is_primary_phone: false, is_primary_mobile_no: false },
    ],
    email_ids: [{ email_id: "", is_primary: false }],
  };
  donorDeskResource.data = [];
  error.value = null;
  isDonorCreating.value = false;
  cnicExistsMessage.value = "";
  cnicValidationMessage.value = "";
};

const tabs = createResource({
  url: "crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_fields_layout",
  cache: ["QuickEntryModal", "Donor", false],
  params: { doctype: "Donor", type: "Quick Entry" },
  auto: true,
  transform: (raw) =>
    raw?.forEach((tab) => {
      tab.sections?.forEach((section) => {
        section.columns?.forEach((column) => {
          column.fields?.forEach((field) => {
            if (field && typeof field === "object") {
              if (field.fieldtype === "Table") donor.doc[field.fieldname] = [];
              field.hidden = false;
              if (field.read_only !== true) field.read_only = false;
              if (field.fieldname === "owner_id") field.read_only = true;
            }
          });
        });
      });
    }),
  onSuccess(data) {
    if (!donor.doc.contact_numbers || donor.doc.contact_numbers.length === 0)
      donor.doc.contact_numbers = [
        { phone: "", is_primary_phone: false, is_primary_mobile_no: false },
      ];
    if (!donor.doc.email_ids || donor.doc.email_ids.length === 0)
      donor.doc.email_ids = [{ email_id: "", is_primary: false }];
    if (!donor.doc.country) donor.doc.country = "Pakistan";
    if (data && data.length) {
      data.forEach((tab) => {
        tab.sections?.forEach((section) => {
          section.columns?.forEach((column) => {
            column.fields?.forEach((field) => {
              if (field && typeof field === "object") {
                if (field.fieldname === "donor_desk") configureDonorDeskField(field);
                field.hidden = false;
                if (field.read_only !== true) field.read_only = false;
                if (field.fieldname === "owner_id") field.read_only = true;
                if (field.fieldname === "status") field.read_only = true;
                if (field.fieldname === "branch_abbreviation") field.read_only = true;
                // console.log(field)
              }
            });
          });
        });
      });
    }
  },
});

defineExpose({
  donorDeskResource,
  onFieldChange,
  reloadDonorDeskData: () => donorDeskResource.reload(),
});

function onFieldChange(fieldname, value) {
  if (fieldname === "department") {
    donor.doc.donor_desk = "";
    if (value) donorDeskResource.reload();
  }
}

watch(
  () => donor.doc.department,
  (n, o) => {
    if (n !== o) {
      donor.doc.donor_desk = "";
      if (n) donorDeskResource.reload();
    }
  }
);

watch(
  () => donor.doc.branch,
  async (newBranch) => {
    if (!newBranch) {
      donor.doc.branch_abbreviation = "";
      return;
    }
    try {
      const res = await call("frappe.client.get_value", {
        doctype: "Cost Center",
        fieldname: "custom_abbreviation",
        filters: { name: newBranch },
      });
      const abbr = res?.message?.custom_abbreviation || res?.custom_abbreviation || "";
      donor.doc.branch_abbreviation = abbr;
    } catch (e) {
      donor.doc.branch_abbreviation = "";
    }
  }
);

watch(
  () => donorDeskOptions.value,
  (opts) => {
    if (!opts || opts.length === 0) donor.doc.donor_desk = "";
  }
);

watch(
  () => donorDeskResource.data,
  (newData) => {
    if (!newData || !tabs.data) return;
    tabs.data.forEach((tab) => {
      tab.sections?.forEach((section) => {
        section.columns?.forEach((column) => {
          column.fields?.forEach((field) => {
            if (field && field.fieldname === "donor_desk") configureDonorDeskField(field);
            if (field && field.fieldname === "owner_id") field.read_only = true;
          });
        });
      });
    });
  },
  { deep: true }
);

const createDonor = createResource({
  url: "crm.fcrm.doctype.donor.api.create_donor",
  makeParams(values) {
    const {
      citytown,
      stateprovince,
      address_type,
      address_line_1,
      address_line_2,
      ...filteredValues
    } = values;
    return { doc: { doctype: "Donor", ...filteredValues } };
  },
});

watch(show, async (val) => {
  if (val) {
    await resetDonorForm();
    donor.doc.owner_id = await getCurrentUserId();
    if (donor.doc.department) donorDeskResource.reload();
    scheduleMaskApplication();
    setTimeout(() => ensureDonorDeskConfigured(), 1500);
  }
  if (!val && hasActiveSubModals.value) show.value = true;
});

watch(
  () => show.value,
  async (n, o) => {
    if (o === true && n === false) await resetDonorForm();
  }
);
watch(
  () => show.value,
  (n, o) => {
    if (o === true && n === false && hasActiveSubModals.value)
      nextTick(() => (show.value = true));
  },
  { immediate: true }
);

function ensureParentModalVisible(idx) {
  if (!show.value) show.value = true;
}

async function handleCloseButton() {
  if (hasActiveSubModals.value) return;
  show.value = false;
  await resetDonorForm();
}

watch(
  modalStack,
  (newStack) => {
    if (hasActiveSubModals.value && !show.value) show.value = true;
  },
  { deep: true }
);
watch(hasActiveSubModals, (has) => {
  if (has && !show.value) show.value = true;
});
watch(
  () => modalStack.value.length,
  (len) => {
    if (len > 0 && !show.value) show.value = true;
  }
);
watch(
  () => modalStack.value.filter((m) => m.visible).length,
  (cnt) => {
    if (cnt > 0 && !show.value) show.value = true;
  }
);

watch(
  () => user.value,
  async () => {
    if (show.value && donor.doc) donor.doc.owner_id = await getCurrentUserId();
  }
);
watch(
  () => user.value?.name,
  (n) => {
    if (n && show.value && donor.doc) donor.doc.owner_id = n;
  }
);

watch(
  () => tabs.data,
  (newTabs) => {
    if (!newTabs) return;
    newTabs.forEach((tab) => {
      tab.sections?.forEach((section) => {
        section.columns?.forEach((column) => {
          column.fields?.forEach((field) => {
            if (field.fieldname === "owner_id") field.read_only = true;
          });
        });
      });
    });
  },
  { deep: true }
);

watch(
  () => donor.doc.foa,
  () => {
    setTimeout(
      () => applyCnicMaskToInput("cnic", donor.doc.identification_type, setFieldValue),
      100
    );
    setTimeout(
      async () =>
        applyPhoneMasksForCountry(donor.doc.country, setFieldValue, MAIN_PHONE_FIELDS),
      400
    );
  }
);

const validationTimeouts = new Map();
function clearAllPhoneFieldErrors(exclude = []) {
  document.querySelectorAll(".phone-error-message")?.forEach((m) => m.remove());
  MAIN_PHONE_FIELDS_FULL.forEach((field) => {
    if (!exclude.includes(field)) {
      const el = findInputField(field);
      if (el) {
        el.classList.remove("border-red-500", "border-red-300");
        el.classList.add("border-gray-300");
      }
    }
  });
}
function clearPhoneFieldError(fieldName) {
  document.querySelectorAll(".phone-error-message")?.forEach((msg) => {
    if (msg.getAttribute("data-field") === fieldName) msg.remove();
  });
  const el = findInputField(fieldName);
  if (el) {
    el.classList.remove("border-red-500", "border-red-300");
    el.classList.add("border-gray-300");
  }
}

function createPhoneFieldWatcher(fieldName) {
  return async (newValue) => {
    if (validationTimeouts.has(fieldName))
      clearTimeout(validationTimeouts.get(fieldName));
    let countryForValidation =
      fieldName === "org_representative_contact_number" || fieldName === "org_contact"
        ? donor.doc.orgs_country
        : donor.doc.country;
    const timeoutId = setTimeout(async () => {
      if (
        (newValue && countryForValidation) ||
        (countryForValidation && countryForValidation.toLowerCase() !== "pakistan")
      ) {
        const validation = await validatePhoneNumber(
          newValue || "",
          countryForValidation || ""
        );
        if (validation && validation.isValid !== undefined)
          showPhoneValidationFeedback(fieldName, validation.isValid, validation.message);
      } else clearPhoneFieldError(fieldName);
      validationTimeouts.delete(fieldName);
    }, 300);
    validationTimeouts.set(fieldName, timeoutId);
  };
}

function setFieldValue(fieldName, value) {
  switch (fieldName) {
    case "cnic":
      donor.doc.cnic = value;
      break;
    case "contact_no":
      donor.doc.contact_no = value;
      break;
    case "co_contact_no":
      donor.doc.co_contact_no = value;
      break;
    case "company_contact_number":
      donor.doc.company_contact_number = value;
      break;
    case "organization_contact_person":
      donor.doc.organization_contact_person = value;
      break;
    case "org_representative_contact_number":
      donor.doc.org_representative_contact_number = value;
      break;
    case "org_contact":
      donor.doc.org_contact = value;
      break;
    case "representative_mobile":
      donor.doc.representative_mobile = value;
      break;
    case "mobile_no":
      donor.doc.mobile_no = value;
      break;
    case "phone_no":
      donor.doc.phone_no = value;
      break;
    case "company_ownerceo_conatct":
      donor.doc.company_ownerceo_conatct = value;
      break;
    default:
      donor.doc[fieldName] = value;
  }
}

const PHONE_FIELDS = [
  "contact_no",
  "co_contact_no",
  "company_contact_number",
  "organization_contact_person",
  "org_representative_contact_number",
  "org_contact",
  "representative_mobile",
  "mobile_no",
  "phone_no",
  "company_ownerceo_conatct",
];
const MAIN_PHONE_FIELDS = [
  "contact_no",
  "co_contact_no",
  "company_contact_number",
  "organization_contact_person",
  "representative_mobile",
  "mobile_no",
  "phone_no",
  "company_ownerceo_conatct",
];
const MAIN_PHONE_FIELDS_FULL = [
  "contact_no",
  "co_contact_no",
  "company_contact_number",
  "organization_contact_person",
  "representative_mobile",
  "mobile_no",
  "phone_no",
  "company_ownerceo_conatct",
];

PHONE_FIELDS.forEach((f) => watch(() => donor.doc[f], createPhoneFieldWatcher(f)));

watch(
  () => donor.doc.donor_type,
  async (newDonorType) => {
    if (!newDonorType) return;
    if (donor.doc.country)
      setTimeout(
        () =>
          applyPhoneMasksForCountry(donor.doc.country, setFieldValue, MAIN_PHONE_FIELDS),
        300
      );
    if (newDonorType === "Organizational" && donor.doc.orgs_country)
      setTimeout(
        () =>
          applyPhoneMasksForCountry(donor.doc.orgs_country, setFieldValue, [
            "org_representative_contact_number",
            "org_contact",
          ]),
        300
      );
  }
);

watch(
  () => tabs.data,
  (newTabs) => {
    if (!newTabs) return;
    setTimeout(async () => {
      const cnicInput = findInputField("cnic");
      if (cnicInput && !cnicInput._maskHandler && donor.doc.identification_type)
        applyCnicMaskToInput("cnic", donor.doc.identification_type, setFieldValue);
      if (donor.doc.country)
        await applyPhoneMasksForCountry(
          donor.doc.country,
          setFieldValue,
          MAIN_PHONE_FIELDS
        );
    }, 300);
  },
  { deep: true }
);

let fieldLayoutObserver = null;
let modalObserver = null;
let mutationObserver = null;
let maskCheckInterval = null;

function scheduleMaskApplication() {
  setTimeout(
    () => applyCnicMaskToInput("cnic", donor.doc.identification_type, setFieldValue),
    500
  );
  if (donor.doc.country)
    setTimeout(
      () =>
        applyPhoneMasksForCountry(donor.doc.country, setFieldValue, MAIN_PHONE_FIELDS),
      1000
    );
  if (donor.doc.orgs_country)
    setTimeout(
      () =>
        applyPhoneMasksForCountry(donor.doc.orgs_country, setFieldValue, [
          "org_representative_contact_number",
          "org_contact",
        ]),
      1200
    );
}

function ensureDonorDeskConfigured() {
  if (!tabs.data) return;
  tabs.data.forEach((tab) =>
    tab.sections?.forEach((section) =>
      section.columns?.forEach((column) =>
        column.fields?.forEach((field) => {
          if (field && field.fieldname === "donor_desk") configureDonorDeskField(field);
        })
      )
    )
  );
}

watch(
  () => show.value,
  (isVisible) => {
    if (isVisible) {
      setTimeout(() => {
        const layout = document.querySelector(".field-layout-wrapper");
        if (layout) {
          fieldLayoutObserver = new MutationObserver(() => {
            setTimeout(() => {
              const cnicInput = findInputField("cnic");
              if (cnicInput && !cnicInput._maskHandler && donor.doc.identification_type)
                applyCnicMaskToInput(
                  "cnic",
                  donor.doc.identification_type,
                  setFieldValue
                );
              if (donor.doc.country)
                applyPhoneMasksForCountry(
                  donor.doc.country,
                  setFieldValue,
                  MAIN_PHONE_FIELDS
                );
            }, 200);
          });
          fieldLayoutObserver.observe(layout, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["class", "style"],
          });
        }

        const modalContent = document.querySelector('[data-modal="parent"]');
        if (modalContent) {
          modalObserver = new MutationObserver((mutations) => {
            let should = false;
            mutations.forEach((m) => {
              if (m.type === "childList")
                m.addedNodes.forEach((node) => {
                  if (
                    node.nodeType === Node.ELEMENT_NODE &&
                    node.querySelector &&
                    (node.querySelector("input") ||
                      node.querySelector(".field") ||
                      node.querySelector(".form-group"))
                  )
                    should = true;
                });
            });
            if (should) {
              setTimeout(() => {
                const cnicInput = findInputField("cnic");
                if (cnicInput && !cnicInput._maskHandler && donor.doc.identification_type)
                  applyCnicMaskToInput(
                    "cnic",
                    donor.doc.identification_type,
                    setFieldValue
                  );
                if (donor.doc.country)
                  applyPhoneMasksForCountry(
                    donor.doc.country,
                    setFieldValue,
                    MAIN_PHONE_FIELDS
                  );
              }, 200);
            }
          });
          modalObserver.observe(modalContent, { childList: true, subtree: true });
        }

        mutationObserver = new MutationObserver((mutations) => {
          let shouldReapply = false;
          mutations.forEach((m) => {
            if (m.type === "childList")
              m.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                  const el = node;
                  if (
                    el.classList &&
                    (el.classList.contains("field") ||
                      el.classList.contains("form-group") ||
                      el.querySelector(".field") ||
                      el.querySelector("input"))
                  )
                    shouldReapply = true;
                }
              });
          });
          if (shouldReapply)
            setTimeout(() => {
              const cnicInput = findInputField("cnic");
              if (cnicInput && !cnicInput._maskHandler && donor.doc.identification_type)
                applyCnicMaskToInput(
                  "cnic",
                  donor.doc.identification_type,
                  setFieldValue
                );
              if (donor.doc.country)
                applyPhoneMasksForCountry(
                  donor.doc.country,
                  setFieldValue,
                  MAIN_PHONE_FIELDS
                );
            }, 200);
        });
        const modalEl = document.querySelector('[data-modal="parent"]');
        if (modalEl)
          mutationObserver.observe(modalEl, { childList: true, subtree: true });

        maskCheckInterval = setInterval(() => {
          const cnicInput = findInputField("cnic");
          if (cnicInput && !cnicInput._maskHandler && donor.doc.identification_type)
            applyCnicMaskToInput("cnic", donor.doc.identification_type, setFieldValue);
          MAIN_PHONE_FIELDS.forEach((fieldName) => {
            const inputElement = findInputField(fieldName);
            if (
              inputElement &&
              !inputElement._pakistanHandler &&
              !inputElement._otherCountryHandler &&
              donor.doc.country
            )
              applyPhoneMaskToInput(fieldName, donor.doc.country, setFieldValue);
          });
          if (donor.doc.orgs_country) {
            ["org_representative_contact_number", "org_contact"].forEach((fieldName) => {
              const inputElement = findInputField(fieldName);
              if (
                inputElement &&
                !inputElement._pakistanHandler &&
                !inputElement._otherCountryHandler &&
                !inputElement._afghanistanHandler
              )
                applyPhoneMaskToInput(fieldName, donor.doc.orgs_country, setFieldValue);
            });
          }
        }, 5000);
      }, 300);
    } else {
      if (fieldLayoutObserver) {
        fieldLayoutObserver.disconnect();
        fieldLayoutObserver = null;
      }
      if (modalObserver) {
        modalObserver.disconnect();
        modalObserver = null;
      }
      if (mutationObserver) {
        mutationObserver.disconnect();
        mutationObserver = null;
      }
      if (maskCheckInterval) {
        clearInterval(maskCheckInterval);
        maskCheckInterval = null;
      }
    }
  }
);

function setupObservers() {
  // kept minimal: real observers set in show watcher
}

onUnmounted(() => {
  if (fieldLayoutObserver) {
    fieldLayoutObserver.disconnect();
    fieldLayoutObserver = null;
  }
  if (modalObserver) {
    modalObserver.disconnect();
    modalObserver = null;
  }
  if (mutationObserver) {
    mutationObserver.disconnect();
    mutationObserver = null;
  }
  if (maskCheckInterval) {
    clearInterval(maskCheckInterval);
    maskCheckInterval = null;
  }
  validationTimeouts.forEach((t) => clearTimeout(t));
  validationTimeouts.clear();
  document.querySelectorAll("input").forEach((input) => {
    if (input._pakistanHandler) {
      input.removeEventListener("input", input._pakistanHandler);
      input._pakistanHandler = null;
    }
    if (input._pakistanKeydownHandler) {
      input.removeEventListener("keydown", input._pakistanKeydownHandler);
      input._pakistanKeydownHandler = null;
    }
    if (input._pakistanPasteHandler) {
      input.removeEventListener("paste", input._pakistanPasteHandler);
      input._pakistanPasteHandler = null;
    }
    if (input._otherCountryHandler) {
      input.removeEventListener("input", input._otherCountryHandler);
      input._otherCountryHandler = null;
    }
    if (input._otherCountryKeydownHandler) {
      input.removeEventListener("keydown", input._otherCountryKeydownHandler);
      input._otherCountryKeydownHandler = null;
    }
  });
});

function setCurrencyForCountry(country) {
  const code = getCurrencyForCountry(country);
  donor.doc.default_currency = code;
  donor.doc._default_currency_readonly = !!code;
}

watch(
  () => donor.doc.country,
  async (newCountry, oldCountry) => {
    if (!newCountry) return;
    setCurrencyForCountry(newCountry);
    if (oldCountry && oldCountry !== newCountry && oldCountry !== undefined) {
      [
        "contact_no",
        "co_contact_no",
        "company_contact_number",
        "organization_contact_person",
        "company_ownerceo_conatct",
        "state",
        "area",
      ].forEach((f) => (donor.doc[f] = ""));
      const toClear = [
        "contact_no",
        "co_contact_no",
        "company_contact_number",
        "organization_contact_person",
        "representative_mobile",
        "company_ownerceo_conatct",
      ];
      const clearPhoneField = (inputElement) => {
        if (!inputElement) return;
        inputElement.parentNode
          ?.querySelectorAll(".country-prefix")
          ?.forEach((p) => p.remove());
        inputElement.parentNode
          ?.querySelectorAll(".phone-error-message")
          ?.forEach((m) => m.remove());
        inputElement.style.paddingLeft = "";
        inputElement.style.position = "";
        if (inputElement.parentNode) inputElement.parentNode.style.position = "";
        inputElement.classList.remove("border-red-500", "border-green-500");
      };
      toClear.forEach((field) => clearPhoneField(findInputField(field)));
    }
    clearAllPhoneFieldErrors(["org_representative_contact_number", "org_contact"]);
    validationTimeouts.forEach((t) => clearTimeout(t));
    validationTimeouts.clear();
    setTimeout(async () => {
      await applyPhoneMasksForCountry(newCountry, setFieldValue, MAIN_PHONE_FIELDS);
      for (const f of MAIN_PHONE_FIELDS) {
        if (donor.doc[f] && donor.doc[f].trim() !== "") {
          const v = await validatePhoneNumber(donor.doc[f].trim(), newCountry);
          if (!v.isValid)
            showPhoneValidationFeedback(
              f,
              false,
              newCountry === "Pakistan"
                ? "Pakistan phone number must be 10 digits and start with valid mobile prefix (30-39). Example: 348-8903564"
                : v.message
            );
          else showPhoneValidationFeedback(f, true, "");
        }
      }
    }, 500);
  }
);

watch(
  () => donor.doc.orgs_country,
  async (newC, oldC) => {
    if (!newC || oldC === newC) return;
    const orgRep = findInputField("org_representative_contact_number"),
      orgContact = findInputField("org_contact");
    const clearPhoneField = (el) => {
      if (!el) return;
      el.parentNode?.querySelectorAll(".country-prefix")?.forEach((p) => p.remove());
      el.parentNode?.querySelectorAll(".phone-error-message")?.forEach((m) => m.remove());
      el.style.paddingLeft = "";
      el.style.position = "";
      if (el.parentNode) el.parentNode.style.position = "";
      el.classList.remove("border-red-500", "border-green-500");
    };
    clearPhoneField(orgRep);
    clearPhoneField(orgContact);
    clearPhoneFieldError("org_representative_contact_number");
    clearPhoneFieldError("org_contact");
    setTimeout(async () => {
      await applyPhoneMasksForCountry(newC, setFieldValue, [
        "org_representative_contact_number",
        "org_contact",
      ]);
      for (const f of ["org_representative_contact_number", "org_contact"]) {
        if (donor.doc[f] && donor.doc[f].trim() !== "") {
          const v = await validatePhoneNumber(donor.doc[f].trim(), newC);
          if (!v.isValid) showPhoneValidationFeedback(f, false, v.message);
          else showPhoneValidationFeedback(f, true, "");
        }
      }
    }, 500);
  }
);

onMounted(async () => {
  donor.doc = donor.doc || {};
  donor.doc.identification_type ||= "CNIC";
  donor.doc.donor_identity ||= "Known";
  donor.doc.default_currency ||= "PKR";
  donor.doc.naming_series ||= "DONOR-.{branch_abbreviation}.-.YYYY.-";
  donor.doc.status ||= "Active";
  donor.doc.country ||= "Pakistan";
  if (!donor.doc.owner_id) getCurrentUserId().then((u) => (donor.doc.owner_id = u));
  donor.doc.contact_numbers ||= [
    { phone: "", is_primary_phone: false, is_primary_mobile_no: false },
  ];
  donor.doc.email_ids ||= [{ email_id: "", is_primary: false }];
  if (props.defaults) Object.assign(donor.doc, props.defaults);
  setTimeout(
    () => applyCnicMaskToInput("cnic", donor.doc.identification_type, setFieldValue),
    500
  );
  if (donor.doc.country)
    setTimeout(
      () =>
        applyPhoneMasksForCountry(donor.doc.country, setFieldValue, MAIN_PHONE_FIELDS),
      800
    );
  if (donor.doc.orgs_country)
    setTimeout(
      () =>
        applyPhoneMasksForCountry(donor.doc.orgs_country, setFieldValue, [
          "org_representative_contact_number",
          "org_contact",
        ]),
      1000
    );
  setupObservers();
});

watch(
  () => donor.doc.identification_type,
  (newType, oldType) => {
    if (!newType) {
      donor.doc.identification_type = "CNIC";
      return;
    }
    if (oldType && oldType !== newType) {
      donor.doc.cnic = "";
      donor.doc.others = "";
    }
    setTimeout(() => applyCnicMaskToInput("cnic", newType, setFieldValue), 100);
  },
  { immediate: true }
);

function openCreateModal({ doctype, initialValue, onSuccess }) {
  if (!show.value) show.value = true;
  modalStack.value.push({ doctype, initialValue, onSuccess, visible: true });
  nextTick(() => {
    if (hasActiveSubModals.value && !show.value) show.value = true;
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

function extractErrorMessage(err) {
  if (err?.message && typeof err.message === "string" && err.message.length)
    return err.message;
  if (err?._server_messages) {
    try {
      const msgs = JSON.parse(err._server_messages);
      if (Array.isArray(msgs) && msgs.length) {
        try {
          const inner = JSON.parse(msgs[0]);
          if (inner.message) return inner.message;
        } catch {
          return msgs[0];
        }
      }
    } catch {}
  }
  if (err?.exc) {
    const m = err.exc.match(/ValidationError: ([\s\S]+)/);
    if (m) return m[1];
    return err.exc;
  }
  if (err?.error) return err.error;
  return String(err);
}

async function createNewDonor() {
  donor.doc.naming_series = "DONOR-.{branch_abbreviation}.-.YYYY.-";
  const validationErrors = [];
  const validatePhoneField = async (fieldName, label) => {
    if (donor.doc[fieldName] && donor.doc[fieldName].trim() !== "" && donor.doc.country) {
      const v = await validatePhoneNumber(donor.doc[fieldName].trim(), donor.doc.country);
      if (!v.isValid)
        validationErrors.push(
          donor.doc.country === "Pakistan"
            ? `${label}: Pakistan phone number must be 10 digits and start with valid mobile prefix (30-39). Example: 348-8903564`
            : `${label}: ${v.message}`
        );
    }
  };

  await triggerOnBeforeCreate?.();

  if (!donor.doc.identification_type)
    validationErrors.push("Identification Type is required");
  const isCnicMandatory =
    donor.doc.identification_type &&
    donor.doc.identification_type !== "Others" &&
    (!donor.doc.foa || donor.doc.foa === 0);
  if (isCnicMandatory) {
    if (!donor.doc.cnic || donor.doc.cnic.trim() === "")
      validationErrors.push(`${donor.doc.identification_type} is required`);
    else {
      if (!validateCnicFormat(donor.doc.cnic, donor.doc.identification_type)) {
        validationErrors.push(
          donor.doc.identification_type === "CNIC"
            ? "Invalid CNIC format. Please enter CNIC in format: 12345-1234567-1"
            : donor.doc.identification_type === "NTN"
            ? "Invalid NTN format. Please enter NTN in format: 123456-1"
            : "Invalid Passport format. Please enter 9 digits."
        );
      }
    }
  }
  if (
    donor.doc.identification_type === "Others" &&
    (!donor.doc.others || donor.doc.others.trim() === "")
  )
    validationErrors.push("Others field is required when Identification Type is Others");
  if (!donor.doc.donor_name || donor.doc.donor_name.trim() === "")
    validationErrors.push("Donor Name is required");
  if (!donor.doc.donor_type || donor.doc.donor_type.trim() === "")
    validationErrors.push("Donor Type is required");
  if (!donor.doc.email || donor.doc.email.trim() === "")
    validationErrors.push("Donor Email is required");
  else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(donor.doc.email.trim()))
      validationErrors.push("Invalid email format. Please enter a valid email address.");
  }

  if (
    donor.doc.donor_type === "Corporate Donors" &&
    donor.doc.company_email_address &&
    donor.doc.company_email_address.trim() !== ""
  ) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(donor.doc.company_email_address.trim()))
      validationErrors.push(
        "Invalid Company Email Address format. Please enter a valid email address."
      );
  }

  if (
    (donor.doc.donor_type === "Corporate Donors" ||
      donor.doc.donor_type === "Organization") &&
    donor.doc.representative_email &&
    donor.doc.representative_email.trim() !== ""
  ) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(donor.doc.representative_email.trim()))
      validationErrors.push(
        "Invalid Representative Email format. Please enter a valid email address."
      );
  }

  if (
    donor.doc.org_representative_email_address &&
    donor.doc.org_representative_email_address.trim() !== ""
  ) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(donor.doc.org_representative_email_address.trim()))
      validationErrors.push(
        "Invalid Organization Representative Email Address format. Please enter a valid email address."
      );
  }

  if (!donor.doc.donor_identity || donor.doc.donor_identity.trim() === "")
    validationErrors.push("Donor Identity is required");
  if (!donor.doc.default_currency || donor.doc.default_currency.trim() === "")
    validationErrors.push("Default Currency is required");
  if (!donor.doc.department || donor.doc.department.trim() === "")
    validationErrors.push("Department is required");
  if (!donor.doc.donor_desk || donor.doc.donor_desk.trim() === "")
    validationErrors.push("Donor Desk is required");

  if (donor.doc.country && (!donor.doc.contact_no || donor.doc.contact_no.trim() === ""))
    validationErrors.push("Contact Number is required when Country is selected");
  else if (
    donor.doc.contact_no &&
    donor.doc.contact_no.trim() !== "" &&
    donor.doc.country
  ) {
    const phoneValidation = await validatePhoneNumber(
      donor.doc.contact_no.trim(),
      donor.doc.country
    );
    if (!phoneValidation.isValid)
      validationErrors.push(
        donor.doc.country === "Pakistan"
          ? "Contact Number: Pakistan phone number must be 10 digits and start with valid mobile prefix (30-39). Example: 348-8903564"
          : `Contact Number: ${phoneValidation.message}`
      );
  }

  if (donor.doc.donor_type === "Organizational") {
    if (
      !donor.doc.organization_contact_person ||
      donor.doc.organization_contact_person.trim() === ""
    )
      validationErrors.push(
        "Organization Contact Person is required for Organizational donors"
      );
    if (
      !donor.doc.representative_designation ||
      donor.doc.representative_designation.trim() === ""
    )
      validationErrors.push(
        "Representative Designation is required for Organizational donors"
      );
    if (!donor.doc.company_name || donor.doc.company_name.trim() === "")
      validationErrors.push("Company Name is required for Organizational donors");
  }

  if (donor.doc.foa) {
    if (!donor.doc.co_name || donor.doc.co_name.trim() === "")
      validationErrors.push("C/O Name is required when FOA is enabled");
    if (!donor.doc.co_contact_no || donor.doc.co_contact_no.trim() === "")
      validationErrors.push("C/O Contact No is required when FOA is enabled");
    else {
      const coPhoneValidation = await validatePhoneNumber(
        donor.doc.co_contact_no.trim(),
        donor.doc.country
      );
      if (!coPhoneValidation.isValid)
        validationErrors.push(
          donor.doc.country === "Pakistan"
            ? "C/O Contact Number: Pakistan phone number must be 10 digits and start with valid mobile prefix (30-39). Example: 348-8903564"
            : `C/O Contact Number: ${coPhoneValidation.message}`
        );
    }
    if (!donor.doc.co_email || donor.doc.co_email.trim() === "")
      validationErrors.push("C/O Email is required when FOA is enabled");
    else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(donor.doc.co_email.trim()))
        validationErrors.push(
          "Invalid C/O Email format. Please enter a valid email address."
        );
    }
    if (!donor.doc.co_address || donor.doc.co_address.trim() === "")
      validationErrors.push("C/O Address is required when FOA is enabled");
    if (
      !donor.doc.relationship_with_donor ||
      donor.doc.relationship_with_donor.trim() === ""
    )
      validationErrors.push("Relationship With Donor is required when FOA is enabled");
    if (!donor.doc.area || donor.doc.area.trim() === "")
      validationErrors.push("Area is required when FOA is enabled");
    if (!donor.doc.co_city || donor.doc.co_city.trim() === "")
      validationErrors.push("C/O City is required when FOA is enabled");
    if (!donor.doc.co_country || donor.doc.co_country.trim() === "")
      validationErrors.push(" C/O Country is required when FOA is enabled");
  }

  await validatePhoneField("company_contact_number", "Company Contact Number");
  await validatePhoneField("organization_contact_person", "Organization Contact Person");
  await validatePhoneField(
    "org_representative_contact_number",
    "Organization Representative Contact Number"
  );
  await validatePhoneField("org_contact", "Organization Contact Number");
  await validatePhoneField("representative_mobile", "Representative Mobile Number");
  await validatePhoneField("mobile_no", "Mobile No");
  await validatePhoneField("phone_no", "Phone No");
  await validatePhoneField("company_ownerceo_conatct", "Company Owner/CEO Contact");

  if (
    donor.doc.identification_type &&
    donor.doc.identification_type !== "Others" &&
    donor.doc.cnic &&
    donor.doc.cnic.trim() !== ""
  ) {
    try {
      const existingDonors = await call("frappe.client.get_list", {
        doctype: "Donor",
        filters: { cnic: donor.doc.cnic },
        fields: ["name"],
      });
      if (existingDonors && existingDonors.length > 0)
        validationErrors.push(
          `This ${donor.doc.identification_type} already exists for another donor.`
        );
    } catch {}
  }

  if (validationErrors.length > 0) {
    const errorMessage = `Please fill in the following required fields:\n\n${validationErrors
      .map((e) => `• ${e}`)
      .join("\n")}`;
    error.value = errorMessage;
    if (typeof frappe !== "undefined" && frappe.show_alert)
      frappe.show_alert({ message: errorMessage, indicator: "red" });
    else if (typeof frappe !== "undefined" && frappe.msgprint)
      frappe.msgprint({
        title: "Validation Error",
        message: errorMessage,
        indicator: "red",
      });
    else alert(errorMessage);
    return;
  }

  isDonorCreating.value = true;
  error.value = null;
  cnicExistsMessage.value = "";

  createDonor.submit(donor.doc, {
    onSuccess(data) {
      isDonorCreating.value = false;
      let donorName =
        data?.name ||
        data?.message?.name ||
        (typeof data?.message === "string" ? data.message : null) ||
        data?.donor_name ||
        data?.donor_id;
      if (!donorName) {
        console.error("Could not extract donor name from response:", data);
        error.value =
          "Donor creation failed. Please try again. Response format unexpected.";
        return;
      }
      show.value = false;
      resetDonorForm().then(() => {
        emit("donor-created");
      });
      toast.success(__("Donor created successfully"));
      const refreshTimestamp = Date.now();
      router.push({
        name: "DonorDetail",
        params: { donorId: donorName },
        query: { refresh: refreshTimestamp },
      });
      if (props.options.afterInsert) props.options.afterInsert(data);
    },
    onError(err) {
      isDonorCreating.value = false;
      let msg = "An error occurred while creating the donor.";
      let handled = false;
      const rawMsg = extractErrorMessage(err);
      if (
        /CNIC[\s\S]*already exists/i.test(rawMsg) ||
        (/ValidationError/i.test(rawMsg) && /CNIC/i.test(rawMsg))
      ) {
        if (donor.doc.cnic && donor.doc.cnic.trim() !== "") {
          msg = "CNIC already exists for another donor.";
          showCnicValidationError(msg);
          handled = true;
        } else {
          msg = "Please enter a valid CNIC number.";
          showCnicValidationError(msg);
          handled = true;
        }
      } else if (/MandatoryError/i.test(rawMsg)) {
        const m = rawMsg.match(/MandatoryError.*?:\s*(.+)/i);
        msg = m
          ? `Please fill in the following required fields: ${m[1]
              .split(",")
              .map((s) => s.trim())
              .join(", ")}`
          : "Please fill all the mandatory fields (Donor Name, Donor Type, Email, etc).";
        handled = true;
      } else if (
        /invalid email address/i.test(rawMsg) ||
        /email.*invalid/i.test(rawMsg) ||
        /invalid.*email/i.test(rawMsg) ||
        /email.*format/i.test(rawMsg)
      ) {
        msg = "Invalid email address.";
        handled = true;
      } else if (/naming_series/i.test(rawMsg)) {
        msg = "Naming series error. Please try again.";
        handled = true;
      } else if (/ValidationError/i.test(rawMsg)) {
        const m = rawMsg.match(/ValidationError:\s*(.+)/i);
        msg = m ? m[1].trim() : "Validation error: " + rawMsg;
        handled = true;
      } else if (/DuplicateEntryError/i.test(rawMsg) || /unique/i.test(rawMsg)) {
        msg = "A record with this information already exists.";
        handled = true;
      } else if (/PermissionError/i.test(rawMsg)) {
        msg = "You do not have permission to create donors.";
        handled = true;
      } else if (/LinkError/i.test(rawMsg)) {
        msg = "Invalid reference in one of the fields.";
        handled = true;
      } else if (/DataError/i.test(rawMsg)) {
        msg = "Data format error. Please check your input.";
        handled = true;
      } else if (/IntegrityError/i.test(rawMsg)) {
        msg = "Data integrity error. Please try again.";
        handled = true;
      } else if (/OperationalError/i.test(rawMsg)) {
        msg = "Database operation failed. Please try again.";
        handled = true;
      } else if (/ProgrammingError/i.test(rawMsg)) {
        msg = "System error. Please contact support.";
        handled = true;
      } else if (/email/i.test(rawMsg)) {
        msg = "Email validation error. Please check the email format.";
        handled = true;
      } else if (/required/i.test(rawMsg) || /mandatory/i.test(rawMsg)) {
        msg = "Please fill all required fields.";
        handled = true;
      } else if (/format/i.test(rawMsg)) {
        msg = "Invalid format in one or more fields.";
        handled = true;
      } else if (/length/i.test(rawMsg)) {
        msg = "One or more fields exceed the maximum length.";
        handled = true;
      }
      if (!handled && rawMsg && rawMsg !== "An error occurred while creating the donor.")
        msg = rawMsg;
      error.value = msg;
    },
  });
}

function showCnicValidationError(message) {
  cnicValidationMessage.value = message;
  showCnicValidationDialog.value = true;
}
function closeCnicValidationDialog() {
  showCnicValidationDialog.value = false;
  cnicValidationMessage.value = "";
}
function closeErrorDialog() {
  showCnicExistsDialog.value = false;
  cnicExistsMessage.value = "";
}
watch(showCnicExistsDialog, (v) => {
  if (!v) cnicExistsMessage.value = "";
});

function onQuickEntryClose() {
  showQuickEntryModal.value = false;
  show.value = true;
}
function onQuickEntryReset() {
  showQuickEntryModal.value = false;
  show.value = true;
}
function onQuickEntrySaved() {
  showQuickEntryModal.value = false;
  show.value = true;
}

function createEmailWatcher(fieldName) {
  return (newEmail) => {
    if (newEmail && newEmail.trim() !== "") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newEmail.trim()))
        showEmailValidationFeedback(
          fieldName,
          false,
          "Invalid email format. Please enter a valid email address."
        );
      else showEmailValidationFeedback(fieldName, true, "");
    } else showEmailValidationFeedback(fieldName, true, "");
  };
}

watch(() => donor.doc.company_email_address, createEmailWatcher("company_email_address"));
watch(() => donor.doc.representative_email, createEmailWatcher("representative_email"));
watch(() => donor.doc.email, createEmailWatcher("email"));
watch(() => donor.doc.co_email, createEmailWatcher("co_email"));
watch(() => donor.doc.org_email, createEmailWatcher("org_email"));
watch(() => donor.doc.donor_email, createEmailWatcher("donor_email"));
watch(
  () => donor.doc.org_representative_email_address,
  createEmailWatcher("org_representative_email_address")
);

function showEmailValidationFeedback(fieldName, isValid, message) {
  nextTick(() => {
    let inputElement =
      document.querySelector(`input[name="${fieldName}"]`) ||
      document.querySelector(`[data-name="${fieldName}"] input`) ||
      document.querySelector(`[data-fieldname="${fieldName}"] input`);
    inputElement?.parentNode
      ?.querySelectorAll(".email-error-message")
      ?.forEach((m) => m.remove());
    if (!inputElement) return;
    inputElement.classList.remove("border-red-500", "border-green-500");
    if (!isValid) {
      inputElement.classList.add("border-red-500");
      let el = inputElement.parentNode.querySelector(".email-error-message");
      if (!el) {
        el = document.createElement("div");
        el.className = "email-error-message text-red-500 text-sm mt-1 block w-full";
        el.style.cssText =
          "color: #ef4444; font-size: 12px; margin-top: 4px; display: block; width: 100%";
        inputElement.parentNode.appendChild(el);
      }
      el.textContent = message;
    } else {
      inputElement.classList.add("border-green-500");
      const el = inputElement.parentNode.querySelector(".email-error-message");
      if (el) el.remove();
    }
  });
}
</script>
