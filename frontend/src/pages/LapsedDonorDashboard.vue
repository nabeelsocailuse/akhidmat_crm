<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-6">Lapsed Donor Dashboard</h1>

    <!-- Filters -->
    <div class="flex flex-wrap gap-4 mb-6">
      <select v-model="selectedYear" class="border rounded p-2">
        <option v-for="year in years" :key="year" :value="year">
          {{ year }}
        </option>
      </select>

      <select v-model="selectedRegion" class="border rounded p-2">
        <option value="">All Regions</option>
        <option v-for="region in regions" :key="region">{{ region }}</option>
      </select>
    </div>

    <!-- Chart -->
    <div class="bg-white p-4 rounded-lg shadow mb-8">
      <canvas id="donorChart" height="100"></canvas>
    </div>

    <!-- Data Table -->
    <div class="bg-white p-4 rounded-lg shadow">
      <table id="lapsedDonorTable" class="display w-full">
        <thead>
          <tr>
            <th>Donor Name</th> 
            <th>Last Donation Date</th>
            <th>Total Donations</th>
            <th>Region</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="donor in donors" :key="donor.name">
            <td>{{ donor.name }}</td>
            <td>{{ donor.lastDonation }}</td>
            <td>{{ donor.totalDonations }}</td>
            <td>{{ donor.region }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import $ from "jquery";
import "datatables.net-dt/css/dataTables.dataTables.css";
import DataTable from "datatables.net-dt";
import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from "chart.js";

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const selectedYear = ref("2025");
const selectedRegion = ref("");
const years = [2023, 2024, 2025];
const regions = ["North", "South", "East", "West"];

const donors = ref([
  { name: "Ali Khan", lastDonation: "2023-04-10", totalDonations: 12, region: "North" },
  { name: "Sara Ahmed", lastDonation: "2022-11-05", totalDonations: 8, region: "South" },
  { name: "Bilal Khan", lastDonation: "2021-12-22", totalDonations: 5, region: "West" },
  { name: "Fatima Noor", lastDonation: "2023-01-19", totalDonations: 9, region: "East" },
]);

onMounted(() => {
  // Initialize DataTable
  new DataTable("#lapsedDonorTable");

  // Initialize Chart.js bar chart
  const ctx = document.getElementById("donorChart");
  new Chart(ctx, {
    type: "bar",
    data: {
      labels: donors.value.map((d) => d.name),
      datasets: [
        {
          label: "Total Donations",
          data: donors.value.map((d) => d.totalDonations),
          backgroundColor: "rgba(54, 162, 235, 0.5)",
          borderColor: "rgb(54, 162, 235)",
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: true }, tooltip: { enabled: true } },
      scales: { y: { beginAtZero: true } },
    },
  });
});
</script>

<style>
body {
  background-color: #f9fafb;
}
</style>
