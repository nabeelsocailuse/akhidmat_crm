<template>
  <AppStyling type="page-background" pageType="donor">
    <LayoutHeader>
      <template #left-header>
        <ViewBreadcrumbs v-model="viewControls" routeName="Donation" />
      </template>
      <template #right-header>
        <CustomActions
          v-if="donationListView?.customListActions"
          :actions="donationListView.customListActions"
        />
        <AppStyling
          type="button"
          buttonType="create"
          buttonLabel="Create"
          @click="showDonationModal = true"
        >
          <template #prefix><FeatherIcon name="plus" class="h-4" /></template>
        </AppStyling>
      </template>
    </LayoutHeader>

    <ViewControls
      ref="viewControls"
      v-model="donations"
      v-model:loadMore="loadMore"
      v-model:resizeColumn="triggerResize"
      v-model:updatedPageCount="updatedPageCount"
      doctype="Donation"
      :filters="currentFilters"
      :options="{
        allowedViews: ['list'],
        hideColumnsButton: false,
      }"
      @list-refreshed="handleListRefreshed"
      @filter-update="handleViewControlsFilterUpdate"
    />

    <DonationListView
      ref="donationListView"
      v-if="donations.data && rows.length > 0"
      v-model:list="donations"
      v-model:pageLengthCount="donations.data.page_length_count"
      :rows="rows"
      :columns="donations.data.columns"
      :options="{
        showTooltip: false,
        resizeColumn: true,
        rowCount: donations.data.row_count || 0,
        totalCount: donations.data.total_count || 0,
      }"
      @loadMore="() => loadMore++"
      @columnWidthUpdated="() => triggerResize++"
      @updatePageCount="(count) => (updatedPageCount = count)"
      @applyFilter="(data) => viewControls?.applyFilter?.(data)"
      @applyLikeFilter="(data) => viewControls?.applyLikeFilter?.(data)"
      @likeDoc="(data) => viewControls?.likeDoc?.(data)"
      @selectionsChanged="(selections) => viewControls?.updateSelections?.(selections)"
    />

    <div v-else-if="donations.data" class="flex h-full items-center justify-center">
      <div class="flex flex-col items-center gap-3 text-xl font-medium text-ink-gray-4">
        <span>{{ __("No {0} Found", [__("Donations")]) }}</span>
        <Button :label="__('Create Donation')" @click="showDonationModal = true">
          <template #prefix><FeatherIcon name="plus" customClass="h-4" /></template>
        </Button>
      </div>
    </div>

    <DonationModal
      v-if="showDonationModal"
      v-model="showDonationModal"
      :defaults="defaults"
      :options="{ afterInsert: () => donations.reload() }"
      @donation-created="handleDonationCreated"
      @donation-deleted="handleDonationDeleted"
    />
  </AppStyling>
</template>

<script>
export default {
  name: "Donation",
};
</script>

<script setup>
import LayoutHeader from "@/components/LayoutHeader.vue";
import DonationListView from "@/components/ListViews/DonationListView.vue";
import DonationModal from "@/components/Modals/DonationModal.vue";
import ViewControls from "@/components/ViewControls.vue";
import ViewBreadcrumbs from "@/components/ViewBreadcrumbs.vue";
import FeatherIcon from "@/components/Icons/FeatherIcon.vue";
import CustomActions from "@/components/CustomActions.vue";
import { ref, reactive, computed, watch } from "vue";
import { useRoute } from "vue-router";
import { formatDate, timeAgo } from "@/utils";
import { getMeta } from "@/stores/meta";
import { usersStore } from "@/stores/users";
import AppStyling from "@/components/AppStyling.vue";

const { getFormattedCurrency } = getMeta("Donation");
const { getUser } = usersStore();

const showDonationModal = ref(false);
const donations = ref({});
const loadMore = ref(1);
const triggerResize = ref(1);
const updatedPageCount = ref(20);
const defaults = reactive({});
const viewControls = ref(null);
const donationListView = ref(null);
const currentFilters = ref({});

watch(showDonationModal, (val) => {
  if (val) {
    const now = new Date();
    defaults.posting_date = now.toISOString().slice(0, 10);
    defaults.posting_time = now.toTimeString().slice(0, 5);
  }
});

const rows = computed(() => {
  if (!donations.value?.data?.data) {
    return [];
  }
  return parseRows(donations.value.data.data, []);
});

function parseRows(rows, columns = []) {
  if (!rows || !Array.isArray(rows)) {
    return [];
  }

  const displayFields = [
    "name",
    "net_amount",
    "base_net_amount",
    "base_total_donation",
    "total_donation",
    "currency",
    "donor_identity",
    "company",
    "due_date",
    "donation_type",
    "contribution_type",
    "status",
    "amount",
    "posting_date",
    "modified",
    "_assign",
    "image",
  ];

  return rows.map((donation) => {
    let _rows = {};

    displayFields.forEach((field) => {
      if (donation.hasOwnProperty(field)) {
        _rows[field] = donation[field];

        if (field == "donor_identity") {
          _rows[field] = {
            label: donation.donor_identity,
            image: donation.image,
            image_label: donation.donor_identity,
          };
        } else if (field == "status") {
          _rows[field] = {
            label: donation.status,
            color: donation.status === "Active" ? "green" : "red",
          };
        } else if (field == "_assign") {
          try {
            let assignees = JSON.parse(donation._assign || "[]");
            _rows[field] = assignees.map((user) => ({
              name: user,
              image: getUser(user).user_image,
              label: getUser(user).full_name,
            }));
          } catch (e) {
            _rows[field] = [];
          }
        } else if (["modified", "creation", "posting_date"].includes(field)) {
          _rows[field] = {
            label: formatDate(donation[field]),
            timeAgo: __(timeAgo(donation[field])),
          };
        } else if (field == "amount") {
          if (donation[field]) {
            _rows[field] = getFormattedCurrency(field, donation);
          }
        }
      }
    });
    return _rows;
  });
}

const handleListRefreshed = () => {
  if (donations.value && donations.value.reload) {
    donations.value.reload();
  }
};

const handleDonationCreated = () => {};

const handleDonationDeleted = () => {
  if (donations.value && donations.value.reload) {
    donations.value.reload();
  }
};

const handleViewControlsFilterUpdate = (filters) => {
  currentFilters.value = filters;
};


const route = useRoute();

const breadcrumbs = computed(() => {
  if (route.params.donationId) {
    let donationName = route.params.donationId;
    if (donations.value?.data?.data) {
      const found = donations.value.data.data.find(
        (d) => d.name === route.params.donationId
      );
      if (found && found.title) donationName = found.title;
    }
    return [
      { label: __("Donation"), route: { name: "Donation" } },
      {
        label: donationName,
        route: {
          name: "DonationDetail",
          params: { donationId: route.params.donationId },
        },
      },
    ];
  }
  return [
    { label: __("Donation"), route: { name: "Donation" } },
    { label: __("List"), route: { name: "Donation" } },
  ];
});
</script>
