<template>
  <div class="p-8 bg-gray-50 min-h-screen">
    <h1 class="text-3xl font-bold mb-8 text-gray-800">Lapsed Donor Dashboard</h1>

    <!-- Success toast -->
    <div v-if="successMessage" class="fixed top-6 right-6 z-50">
      <div class="bg-green-600 text-white px-4 py-2 rounded shadow">{{ successMessage }}</div>
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap gap-4 mb-8">
      <Link v-model="selectedCampaign" :doctype="'Campaign'" placeholder="All Campaigns" class="filter-input"/>
      <Link v-model="selectedFundClass" :doctype="'Fund Class'" placeholder="All Fund Classes" class="filter-input"/>
      <Link v-model="selectedServiceArea" :doctype="'Service Area'" placeholder="All Service Areas" class="filter-input"/>
      <Link v-model="selectedSubServiceArea" :doctype="'Subservice Area'" placeholder="All Sub Service Areas" class="filter-input"/>
      <Link v-model="selectedProduct" :doctype="'Product'" placeholder="All Products" class="filter-input"/>

        <select 
          v-model="selectedTimePeriod" 
          class="border rounded-lg p-2 w-48"
          required
        >
          <option disabled value="">Select Months</option>
          <option value="3">3</option>
          <option value="6">6</option>
          <option value="12">12</option>
          <option value="24">24</option>
        </select>
      <button @click="handleSendEmails" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
        <i class="fas fa-envelope mr-2"></i> Create Email Group
      </button>
    </div>

    <!-- Create Email Group Modal -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="fixed inset-0 bg-black opacity-40" @click="closeModal"></div>
      <div class="bg-white rounded-lg shadow-xl z-10 w-full max-w-md p-6">
        <h3 class="text-lg font-semibold mb-3">Create Email Group</h3>
        <p class="text-sm text-gray-600 mb-4">Enter a name for the email group.</p>

        <input
          v-model="groupInput"
          placeholder="name email group"
          class="w-full border rounded-md p-2 mb-2"
          @keyup.enter="createEmailGroup"
        />

        <p v-if="modalError" class="text-sm text-red-600 mb-2">{{ modalError }}</p>

        <div class="flex justify-end gap-3 mt-4">
          <button class="px-4 py-2 rounded border" @click="closeModal" :disabled="creating">Cancel</button>
          <button class="px-4 py-2 rounded bg-blue-600 text-white" @click="createEmailGroup" :disabled="creating">
            <span v-if="!creating">Create</span>
            <span v-else>Creating...</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
      <div class="card-blue">
        <div class="card-content">
          <p>Total Active Donors</p>
          <h2>{{ totalActiveDonors }}</h2>
        </div>
        <i class="fas fa-users"></i>
      </div>
      <div class="card-red">
        <div class="card-content">
          <p>Lapsed Donors</p>
          <h2>{{ totalLapsedDonors }}</h2>
        </div>
        <i class="fas fa-user-times"></i>
      </div>
      <div class="card-green">
        <div class="card-content">
          <p>Re-engagement Rate</p>
          <h2>{{ reEngagementRate }}%</h2>
        </div>
        <i class="fas fa-sync-alt"></i>
      </div>
    </div>

    <!-- Table (no Vue v-for rendering of rows) -->
    <div class="bg-white p-6 rounded-2xl shadow-lg">
      <table id="lapsedDonorTable" class="display w-full text-sm">
        <thead>
          <tr class="bg-gray-100 text-gray-700">
            <th>Donor</th>
            <th>Donor Name</th>
            <th>Email</th>
            <th>Last Donation Date</th>
            <th>Total Donations</th>
          </tr>
        </thead>
        <tbody><!-- DataTables will manage rows here --></tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, watch, onBeforeUnmount } from "vue";
import Link from "@/components/Controls/Link.vue";
import $ from "jquery";
import "datatables.net-dt/css/dataTables.dataTables.css";
import DataTable from "datatables.net-dt";
import { call } from "frappe-ui";

const selectedCampaign = ref("");
const selectedFundClass = ref("");
const selectedServiceArea = ref("");
const selectedSubServiceArea = ref("");
const selectedProduct = ref("");
const selectedTimePeriod = ref("12");

const lapsedDonors = ref([]);
const totalActiveDonors = ref(0);
const totalLapsedDonors = ref(0);
const reEngagementRate = ref(0);
let dataTable = null;

// modal state for creating email group
const showModal = ref(false);
const groupInput = ref("");
const modalError = ref("");
const creating = ref(false);
const successMessage = ref("");
let successTimer = null;

// helper to convert server list -> DataTables rows (array of arrays)
function buildRows(list) {
  return (list || []).map(d => [
    d.donor_id || "",
    d.donor_name || "",
    d.email || "",
    d.last_donation_date || "",
    d.total_donations || 0
  ]);
}

async function initOrUpdateDataTable(rows) {
  await nextTick();

  // First time: initialize with data and column titles
  if (!dataTable) {
    dataTable = new DataTable("#lapsedDonorTable", {
      data: rows,
      columns: [
        { title: "Donor" },
        { title: "Donor Name" },
        { title: "Email" },
        { title: "Last Donation Date" },
        { title: "Total Donations" }
      ],
      // any DataTables options you prefer:
      pageLength: 10,
      ordering: true,
      searching: true,
      destroy: true
    });
    return;
  }

  // Otherwise update existing DataTable safely
  try {
    const dt = $("#lapsedDonorTable").DataTable();
    dt.clear();
    dt.rows.add(rows);
    dt.draw();
  } catch (err) {
    // If DataTable unexpectedly gone, re-create it
    if (dataTable) {
      try { dataTable.destroy(true); } catch (e) {}
      dataTable = null;
    }
    dataTable = new DataTable("#lapsedDonorTable", {
      data: rows,
      columns: [
        { title: "Donor" },
        { title: "Donor Name" },
        { title: "Email" },
        { title: "Last Donation Date" },
        { title: "Total Donations" }
      ],
      pageLength: 10,
      ordering: true,
      searching: true,
      destroy: true
    });
  }
}

async function loadLapsedDonorDashboard() {
  console.log("Sending Filters:", {
    campaign: selectedCampaign.value,
    fund_class: selectedFundClass.value,
    pay_service_area: selectedServiceArea.value,
    pay_subservice_area: selectedSubServiceArea.value,
    pay_product: selectedProduct.value,
    time_period: selectedTimePeriod.value,
  });

  try {
    const res = await call("crm.api.LapsedDonor.get_lapsed_donor_dashboard", {
      filters: {
        campaign: selectedCampaign.value,
        fund_class: selectedFundClass.value,
        pay_service_area: selectedServiceArea.value,
        pay_subservice_area: selectedSubServiceArea.value,
        pay_product: selectedProduct.value,
        time_period: selectedTimePeriod.value,
      },
    });

    totalActiveDonors.value = res?.total_active_donors || 0;
    totalLapsedDonors.value = res?.total_lapsed_donors || 0;
    reEngagementRate.value = res?.re_engagement_rate || 0;
    lapsedDonors.value = res?.lapsed_donors_list || [];

    const rows = buildRows(lapsedDonors.value);
    await initOrUpdateDataTable(rows);
  } catch (e) {
    console.error("Error loading lapsed donor dashboard:", e);
  }
}

watch(
  [
    selectedCampaign,
    selectedFundClass,
    selectedServiceArea,
    selectedSubServiceArea,
    selectedProduct,
    selectedTimePeriod,
  ],
  () => {
    loadLapsedDonorDashboard();
  }
);

onMounted(loadLapsedDonorDashboard);

onBeforeUnmount(() => {
  // destroy DataTable cleanly when component unmounts
  try {
    if (dataTable) {
      const dt = $("#lapsedDonorTable").DataTable();
      dt.destroy(true); // remove DOM added by DataTables
      dataTable = null;
    }
  } catch (e) {
    // ignore
  }
});

async function handleSendEmails() {
  // open modal to create email group
  modalError.value = "";
  groupInput.value = "";
  showModal.value = true;
}

function closeModal() {
  if (creating.value) return;
  showModal.value = false;
  modalError.value = "";
  groupInput.value = "";
}

async function createEmailGroup() {
  modalError.value = "";
  const title = (groupInput.value || "").trim();
  if (!title) {
    modalError.value = "Please provide a non-empty email group name.";
    return;
  }

  try {
    creating.value = true;

    // Extract donor emails from lapsedDonors data first
    const donorEmails = lapsedDonors.value
      .filter(donor => donor.email && donor.email.trim()) // Filter out empty emails
      .map(donor => donor.email.trim());

    // Check if there are any donor emails before proceeding
    if (donorEmails.length === 0) {
      modalError.value = `No donor emails were found in the lapsed donor list. The email group "${title}" was not created.`;
      creating.value = false;
      return;
    }

    // check for existing group with same title
    const existing = await call("frappe.client.get_list", {
      doctype: "Email Group",
      filters: { title },
      fields: ["name", "title"],
      limit_page_length: 1,
    });

    if (existing && existing.length) {
      modalError.value = "An email group with this name already exists.";
      creating.value = false;
      return;
    }

    // Create the email group
    const group = await call("frappe.client.insert", {
      doc: {
        doctype: "Email Group",
        title,
        total_subscribers: 0,
      },
    });

    console.log(`✅ Created email group: ${title}`, group);

    // Add donor emails as subscribers to the email group
    try {
      await call("frappe.email.doctype.email_group.email_group.add_subscribers", {
        name: group.name,
        email_list: donorEmails
      });
      console.log(`✅ Added ${donorEmails.length} donor emails to email group`);
    } catch (addErr) {
      console.error("Error adding subscribers:", addErr);
      modalError.value = "Email group created but failed to add donor emails.";
      creating.value = false;
      return;
    }

    // allow modal to close (closeModal prevents close while creating === true)
    creating.value = false;
    closeModal();
    
    // show success toast with count of added donors
    successMessage.value = `Email group "${title}" created with ${donorEmails.length} donor emails.`;
    
    if (successTimer) clearTimeout(successTimer);
    successTimer = setTimeout(() => {
      successMessage.value = "";
      successTimer = null;
    }, 4000);
  } catch (err) {
    console.error("Error creating email group:", err);
    modalError.value = "Failed to create email group. Try again.";
  } finally {
    creating.value = false;
  }
}

onBeforeUnmount(() => {
  try {
    if (successTimer) clearTimeout(successTimer);
  } catch (e) {}
});
</script>

<style>
@import "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css";

body {
  background-color: #f9fafb;
  font-family: "Inter", sans-serif;
}

.filter-input {
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  padding: 0.5rem;
  width: 12rem;
}

.card-blue {
  background: linear-gradient(to bottom right, #3b82f6, #1e40af);
  color: white;
  padding: 1.5rem;
  border-radius: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-red {
  background: linear-gradient(to bottom right, #ef4444, #b91c1c);
  color: white;
  padding: 1.5rem;
  border-radius: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-green {
  background: linear-gradient(to bottom right, #10b981, #047857);
  color: white;
  padding: 1.5rem;
  border-radius: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
