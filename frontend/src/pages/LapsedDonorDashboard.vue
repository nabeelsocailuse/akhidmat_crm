<template>
  <div class="p-8 bg-gray-50 min-h-screen">
    <h1 class="text-3xl font-bold mb-8 text-gray-800">
      Lapsed Donor Dashboard
    </h1>

    <!-- Filters -->
    <div class="flex flex-wrap gap-4 mb-8">
      <Link
        v-model="selectedCampaign"
        :doctype="'Campaign'"
        class="border rounded-lg p-2 shadow-sm focus:ring focus:ring-blue-300 w-48 block"
        placeholder="All Campaigns"
      />

      <!-- Send Email Button -->
      <button
        @click="handleSendEmails"
        class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-md transition"
      >
        <i class="fas fa-envelope mr-2"></i> Send Lapsed Donor Emails
      </button>
    </div>

    <!-- Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
      <div
        class="bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-2xl p-6 shadow-lg transform hover:scale-105 transition-transform duration-300"
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="text-lg font-medium opacity-90">Total Active Donors</p>
            <h2 class="text-4xl font-bold mt-2">{{ totalActiveDonors }}</h2>
          </div>
          <div class="bg-white/30 rounded-full p-3">
            <i class="fas fa-users text-3xl"></i>
          </div>
        </div>
      </div>

      <div
        class="bg-gradient-to-br from-red-500 to-red-700 text-white rounded-2xl p-6 shadow-lg transform hover:scale-105 transition-transform duration-300"
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="text-lg font-medium opacity-90">Lapsed Donors</p>
            <h2 class="text-4xl font-bold mt-2">{{ totalLapsedDonors }}</h2>
          </div>
          <div class="bg-white/30 rounded-full p-3">
            <i class="fas fa-user-times text-3xl"></i>
          </div>
        </div>
      </div>

      <div
        class="bg-gradient-to-br from-green-500 to-green-700 text-white rounded-2xl p-6 shadow-lg transform hover:scale-105 transition-transform duration-300"
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="text-lg font-medium opacity-90">Re-engagement Rate</p>
            <h2 class="text-4xl font-bold mt-2">{{ reEngagementRate }}%</h2>
          </div>
          <div class="bg-white/30 rounded-full p-3">
            <i class="fas fa-sync-alt text-3xl"></i>
          </div>
        </div>
      </div>
    </div>

    <!-- Table -->
    <div class="bg-white p-6 rounded-2xl shadow-lg">
      <table id="lapsedDonorTable" class="display w-full text-sm">
        <thead>
          <tr class="bg-gray-100 text-gray-700">
            <th class="p-2 text-left">Donor</th>
            <th class="p-2 text-left">Donor Name</th>
            <th class="p-2 text-left">Email</th>
            <th class="p-2 text-left">Last Donation Date</th>
            <th class="p-2 text-left">Total Donations</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="donor in lapsedDonors"
            :key="donor.donor_id"
            class="hover:bg-blue-50 transition-colors"
          >
            <td class="p-2">{{ donor.donor_id }}</td>
            <td class="p-2">{{ donor.donor_name }}</td>
            <td class="p-2">{{ donor.email }}</td>
            <td class="p-2">{{ donor.last_donation_date }}</td>
            <td class="p-2">{{ donor.total_donations }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, watch } from "vue";
import Link from "@/components/Controls/Link.vue";
import $ from "jquery";
import "datatables.net-dt/css/dataTables.dataTables.css";
import DataTable from "datatables.net-dt";
import { call } from "frappe-ui";

const selectedCampaign = ref("");
const lapsedDonors = ref([]);
const totalActiveDonors = ref(0);
const totalLapsedDonors = ref(0);
const reEngagementRate = ref(0);
let dataTable = null;

async function loadLapsedDonorDashboard() {
  try {
    const res = await call("crm.api.LapsedDonor.get_lapsed_donor_dashboard", {
      filters: { campaign: selectedCampaign.value },
    });

    totalActiveDonors.value = res?.total_active_donors || 0;
    totalLapsedDonors.value = res?.total_lapsed_donors || 0;
    reEngagementRate.value = res?.re_engagement_rate || 0;
    lapsedDonors.value = res?.lapsed_donors_list || [];

    await nextTick();
    if (!dataTable) {
      dataTable = new DataTable("#lapsedDonorTable");
    } else {
      const dt = $("#lapsedDonorTable").DataTable();
      dt.clear();
      dt.rows.add(
        lapsedDonors.value.map((d) => [
          d.donor_id,
          d.donor_name,
          d.email,
          d.last_donation_date,
          d.total_donations,
        ])
      );
      dt.draw();
    }
  } catch (e) {
    console.error("Error loading lapsed donor dashboard:", e);
  }
}

async function handleSendEmails() {
  try {
    if (!lapsedDonors.value.length) {
      return;
    }

    const timestamp = new Date()
      .toISOString()
      .replace("T", " ")
      .replace(/\..+/, "");
    const groupTitle = `Lapsed Donors - ${timestamp}`;

    const group = await call("frappe.client.insert", {
      doc: {
        doctype: "Email Group",
        title: groupTitle,
        total_subscribers: 0,
      },
    });

    const groupName = group.name;

    for (const donor of lapsedDonors.value) {
      if (!donor.email) continue;

      await call("frappe.client.insert", {
        doc: {
          doctype: "Email Group Member",
          email: donor.email,
          email_group: groupName, 
        },
      }).catch(() => {

      });
    }

    await call("crm.api.LapsedDonor.send_lapsed_donor_emails", {
      group_name: groupName,
    });

    console.log(`✅ Created and sent emails for group: ${groupTitle}`);
  } catch (error) {
    console.error("❌ Error sending lapsed donor emails:", error);
  }
}



watch(selectedCampaign, () => {
  loadLapsedDonorDashboard();
});

onMounted(loadLapsedDonorDashboard);
</script>

<style>
@import "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css";
body {
  background-color: #f9fafb;
  font-family: "Inter", sans-serif;
}
</style>
