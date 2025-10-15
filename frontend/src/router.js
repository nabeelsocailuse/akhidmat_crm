import { createRouter, createWebHistory } from 'vue-router'
import { defineAsyncComponent, h } from 'vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import { userResource } from '@/stores/user'
import { sessionStore } from '@/stores/session'
import { viewsStore } from '@/stores/views'

// Helper: show loading spinner while importing
const lazy = (loader) =>
  defineAsyncComponent({
    loader: typeof loader === 'function' ? loader : () => loader(),
    loadingComponent: LoadingSpinner,
  })

// ✅ Responsive loader for mobile vs desktop
const responsiveLoader = (desktop, mobile) => {
  return {
    render() {
      const isMobile = window.innerWidth < 768
      const component = isMobile
        ? defineAsyncComponent(() => import(`@/pages/${mobile}.vue`))
        : defineAsyncComponent(() => import(`@/pages/${desktop}.vue`))
      return h(component)
    },
  }
}

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
    path: '/lapsed-donor-dashboard',
    name: 'Lapsed Donor Dashboard',
    component: lazy(() => import('@/pages/LapsedDonorDashboard.vue')),
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
    component: responsiveLoader('Lead', 'MobileLead'),
    props: true,
  },
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
    component: responsiveLoader('Contact', 'MobileContact'),
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
    component: responsiveLoader('Campaign', 'MobileCampaign'),
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
    component: responsiveLoader('DonorDetail', 'MobileDonorDetail'),
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
    component: responsiveLoader('DonationDetail', 'MobileDonationDetail'),
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
    component: responsiveLoader('EmailTemplate', 'MobileEmailTemplate'),
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
    component: responsiveLoader('EmailCampaignDetail', 'MobileEmailCampaignDetail'),
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
    component: responsiveLoader('EmailGroupDetail', 'MobileEmailGroupDetail'),
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
    component: responsiveLoader('CommunicationDetail', 'MobileCommunicationDetail'),
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
    component: responsiveLoader('EmailGroupMember', 'MobileEmailGroupMember'),
    props: true,
  },
  {
    alias: [
      '/tax-exemption-certificates',
      '/taxexemptioncertificate',
      '/taxexemptioncertificate/list',
      '/taxexemptioncertificate/view',
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
    component: responsiveLoader('TaxExemptionCertificate', 'MobileTaxExemptionCertificate'),
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
