import { createRouter, createWebHistory } from 'vue-router'
import { defineAsyncComponent } from 'vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import { userResource } from '@/stores/user'
import { sessionStore } from '@/stores/session'
import { viewsStore } from '@/stores/views'

// Move handleMobileView function before routes
const handleMobileView = (componentName) => {
  return window.innerWidth < 768 ? `Mobile${componentName}` : 'Mobile' + componentName
}

// helper to wrap dynamic imports with a loading spinner
const lazy = (loader) =>
  defineAsyncComponent({
    loader: typeof loader === 'function' ? loader : () => loader(),
    loadingComponent: LoadingSpinner,
  })

const routes = [
  {
    path: '/',
    name: 'Home',
  },
  {
    path: '/notifications',
    name: 'Notifications',
    component: lazy(() => import('@/pages/MobileNotification.vue')),
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: lazy(() => import('@/pages/Dashboard.vue')),
  },
  {
    alias: '/leads',
    path: '/leads/view/:viewType?',
    name: 'Leads',
    component: lazy(() => import('@/pages/Leads.vue')),
  },
  {
    path: '/leads/:leadId',
    name: 'Lead',
    component: lazy(() => import(`@/pages/${handleMobileView('Lead')}.vue`)),
    props: true,
  },
  // {
  //   alias: '/deals',
  //   path: '/deals/view/:viewType?',
  //   name: 'Deals',
  //   component: () => import('@/pages/Deals.vue'),
  // },
  // {
  //   path: '/deals/:dealId',
  //   name: 'Deal',
  //   component: () => import(`@/pages/${handleMobileView('Deal')}.vue`),
  //   props: true,
  // },
  {
    alias: '/notes',
    path: '/notes/view/:viewType?',
    name: 'Notes',
    component: lazy(() => import('@/pages/Notes.vue')),
  },
  {
    alias: '/tasks',
    path: '/tasks/view/:viewType?',
    name: 'Tasks',
    component: lazy(() => import('@/pages/Tasks.vue')),
  },
  {
    alias: '/contacts',
    path: '/contacts/view/:viewType?',
    name: 'Contacts',
    component: lazy(() => import('@/pages/Contacts.vue')),
  },
  {
    path: '/contacts/:contactId',
    name: 'Contact',
    component: lazy(() => import(`@/pages/${handleMobileView('Contact')}.vue`)),
    props: true,
  },
  {
    alias: '/addresses',
    path: '/addresses/view/:viewType?',
    name: 'Addresses',
    component: lazy(() => import('@/pages/Addresses.vue')),
  },
  {
    path: '/addresses/:addressId',
    name: 'Address',
    component: lazy(() => import('@/pages/Address.vue')),
    props: true,
  },
  // {
  //   alias: '/organizations',
  //   path: '/organizations/view/:viewType?',
  //   name: 'Organizations',
  //   component: () => import('@/pages/Organizations.vue'),
  // },
  // {
  //   path: '/organizations/:organizationId',
  //   name: 'Organization',
  //   component: () => import(`@/pages/${handleMobileView('Organization')}.vue`),
  //   props: true,
  // },
  {
    alias: '/call-logs',
    path: '/call-logs/view/:viewType?',
    name: 'Call Logs',
    component: lazy(() => import('@/pages/CallLogs.vue')),
  },
  {
    path: '/welcome',
    name: 'Welcome',
    component: lazy(() => import('@/pages/Welcome.vue')),
  },
  {
    alias: '/campaigns',
    path: '/campaigns/view/:viewType?',
    name: 'Campaigns',
    component: lazy(() => import('@/pages/Campaigns.vue')),
  },
  {
    path: '/campaigns/:campaignId',
    name: 'Campaign',
    component: lazy(() => import('@/pages/Campaign.vue')),
    props: true,
  },
  {
    path: '/:invalidpath',
    name: 'Invalid Page',
    component: lazy(() => import('@/pages/InvalidPage.vue')),
  },
  {
    alias: '/donor',
    path: '/donor/view/:viewType?',
    name: 'Donor',
    component: lazy(() => import('@/pages/Donor.vue')),
  },
  {
    path: '/donor/:donorId',
    name: 'DonorDetail',
    component: lazy(() => import('@/pages/DonorDetail.vue')),
    props: true,
  },
  {
    alias: '/donations',
    path: '/donations/view/:viewType?',
    name: 'Donations',
    component: lazy(() => import('@/pages/Donation.vue')),
  },
  {
    path: '/donations/:donationId',
    name: 'DonationDetail',
    component: lazy(() => import('@/pages/DonationDetail.vue')),
    props: true,
  },
  {
    alias: '/email-template',
    path: '/email-template/view/:viewType?',
    name: 'EmailTemplates',
    component: lazy(() => import('@/pages/EmailTemplates.vue')),
  },
  {
    path: '/email-template/:emailTemplateId',
    name: 'EmailTemplate',
    component: lazy(() => import('@/pages/EmailTemplate.vue')),
    props: true,
  },
  {
    alias: '/email-campaign',
    path: '/email-campaign/view/:viewType?',
    name: 'Email Campaign',
    component: lazy(() => import('@/pages/EmailCampaign.vue')),
  },
  {
    path: '/email-campaign/:emailCampaignId',
    name: 'EmailCampaignDetail',
    component: lazy(() => import('@/pages/EmailCampaignDetail.vue')),
    props: true,
  },
  {
    alias: '/email-group',
    path: '/email-group/view/:viewType?',
    name: 'Email Group',
    component: lazy(() => import('@/pages/EmailGroup.vue')),
  },
  {
    path: '/email-group/:emailGroupId',
    name: 'EmailGroupDetail',
    component: lazy(() => import('@/pages/EmailGroupDetail.vue')),
    props: true,
  },
  {
    path: '/communication',
    name: 'Communication',
    component: lazy(() => import('@/pages/Communication.vue')),
  },
  {
    path: '/communication/:communicationId',
    name: 'CommunicationDetail',
    component: lazy(() => import('@/pages/CommunicationDetail.vue')),
    props: true,
  },
  {
    alias: '/email-group-members',
    path: '/email-group-members/view/:viewType?',
    name: 'Email Group Members',
    component: lazy(() => import('@/pages/EmailGroupMembers.vue')),
  },
  {
    path: '/email-group-members/:memberId',
    name: 'EmailGroupMember',
    component: lazy(() => import('@/pages/EmailGroupMember.vue')),
    props: true,
  },
  {
    alias: [
      '/tax-exemption-certificates',
      // Legacy/alternate aliases for consistency with other doctypes
      '/taxexemptioncertificate',
      '/taxexemptioncertificate/list',
      '/taxexemptioncertificate/view',
      // Additional common variants
      '/tax-exemption-certificate',
      '/tax-exemption-certificate/list',
      '/tax-exemption-certificate/view',
      '/taxexemptioncertificates',
      '/taxexemptioncertificates/view',
      '/taxexemptioncertificates/list',
    ],
    path: '/tax-exemption-certificates/view/:viewType?',
    name: 'TaxExemptionCertificates',
    component: lazy(() => import('@/pages/TaxExemptionCertificates.vue')),
  },
  {
    alias: [
      '/taxexemptioncertificate/:certificateId',
      '/tax-exemption-certificate/:certificateId',
      '/taxexemptioncertificates/:certificateId',
    ],
    path: '/tax-exemption-certificates/:certificateId',
    name: 'TaxExemptionCertificate',
    component: lazy(() => import('@/pages/TaxExemptionCertificate.vue')),
    props: true,
  },
]

let router = createRouter({
  history: createWebHistory('/crm'),
  routes,
})

router.beforeEach(async (to, from, next) => {
  const { isLoggedIn } = sessionStore()

  isLoggedIn && (await userResource.promise)

  if (to.name === 'Home' && isLoggedIn) {
    const { views, getDefaultView } = viewsStore()
    await views.promise

    let defaultView = getDefaultView()
    if (!defaultView) {
      next({ name: 'Leads' })
      return
    }

    let { route_name, type, name, is_standard } = defaultView
    route_name = route_name || 'Leads'

    if (name && !is_standard) {
      next({ name: route_name, params: { viewType: type }, query: { view: name } })
    } else {
      next({ name: route_name, params: { viewType: type } })
    }
  } else if (!isLoggedIn) {
    window.location.href = '/login?redirect-to=/crm'
  } else if (to.matched.length === 0) {
    next({ name: 'Invalid Page' })
  } else if (['Deal', 'Lead'].includes(to.name) && !to.hash) {
    let storageKey = to.name === 'Deal' ? 'lastDealTab' : 'lastLeadTab'
    const activeTab = localStorage.getItem(storageKey) || 'activity'
    const hash = '#' + activeTab
    next({ ...to, hash })
  } else {
    next()
  }
})

export default router
