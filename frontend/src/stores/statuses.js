import IndicatorIcon from '@/components/Icons/IndicatorIcon.vue'
import { capture } from '@/telemetry'
import { parseColor } from '@/utils'
import { defineStore } from 'pinia'
import { createListResource } from 'frappe-ui'
import { reactive, h } from 'vue'

export const statusesStore = defineStore('crm-statuses', () => {
  let leadStatusesByName = reactive({})
  let dealStatusesByName = reactive({})
  let communicationStatusesByName = reactive({})

  const leadStatuses = createListResource({
    doctype: 'CRM Lead Status',
    fields: ['name', 'color', 'position'],
    orderBy: 'position asc',
    cache: 'lead-statuses',
    initialData: [],
    auto: true,
    transform(statuses) {
      for (let status of statuses) {
        status.color = parseColor(status.color)
        leadStatusesByName[status.name] = status
      }
      return statuses
    },
  })

  const dealStatuses = createListResource({
    doctype: 'CRM Deal Status',
    fields: ['name', 'color', 'position', 'type'],
    orderBy: 'position asc',
    cache: 'deal-statuses',
    initialData: [],
    auto: true,
    transform(statuses) {
      for (let status of statuses) {
        status.color = parseColor(status.color)
        dealStatusesByName[status.name] = status
      }
      return statuses
    },
  })

  const communicationStatuses = createListResource({
    doctype: 'CRM Communication Status',
    fields: ['name'],
    cache: 'communication-statuses',
    initialData: [],
    auto: true,
    transform(statuses) {
      for (let status of statuses) {
        communicationStatusesByName[status.name] = status
      }
      return statuses
    },
  })

  function getLeadStatus(name) {
    if (!name) {
      name = leadStatuses.data[0].name
    }
    return leadStatusesByName[name]
  }

  function getDealStatus(name) {
    if (!name) {
      name = dealStatuses.data[0].name
    }
    return dealStatusesByName[name]
  }

  function getCommunicationStatus(name) {
    const communicationStatusMap = {
      'Open': { name: 'Open', color: 'text-red-500' },
      'Replied': { name: 'Replied', color: 'text-gray-500' },
      'Closed': { name: 'Closed', color: 'text-green-500' },
      'Linked': { name: 'Linked', color: 'text-gray-500' },
    }
    return communicationStatusMap[name] || { name: name || 'Open', color: 'text-gray-500' }
  }

  function getEmailCampaignStatus(name) {
    const emailCampaignStatuses = {
      'Scheduled': { name: 'Scheduled', color: 'text-blue-500' },
      'In Progress': { name: 'In Progress', color: 'text-orange-500' },
      'Completed': { name: 'Completed', color: 'text-green-500' },
      'Unsubscribed': { name: 'Unsubscribed', color: 'text-red-500' }
    }
    return emailCampaignStatuses[name] || emailCampaignStatuses['Scheduled']
  }

  function getDonorStatus(name) {
    const donorStatuses = {
      'Active': { name: 'Active', color: 'text-green-500' },
      'Blocked': { name: 'Blocked', color: 'text-red-500' },
    }
    return donorStatuses[name] || donorStatuses['Active']
  }

  function getEnabledStatus(value) {
    // Accept boolean or 'Yes'/'No' strings (case-insensitive)
    if (typeof value === 'string') {
      const normalized = value.toLowerCase()
      if (normalized === 'yes' || normalized === 'true' || normalized === '1') {
        return { name: 'Enabled', color: 'text-green-500' }
      }
      return { name: 'Disabled', color: 'text-red-500' }
    }
    if (typeof value === 'boolean') {
      return value ? { name: 'Enabled', color: 'text-green-500' } : { name: 'Disabled', color: 'text-red-500' }
    }
    return { name: value || 'Disabled', color: 'text-red-500' }
  }

  function statusOptions(doctype, statuses = [], triggerStatusChange = null) {
    let statusesByName =
      doctype == 'deal' ? dealStatusesByName : 
      doctype == 'email_campaign' ? { 'Scheduled': { name: 'Scheduled', color: 'text-blue-500' }, 'In Progress': { name: 'In Progress', color: 'text-orange-500' }, 'Completed': { name: 'Completed', color: 'text-green-500' }, 'Unsubscribed': { name: 'Unsubscribed', color: 'text-red-500' } } :
      leadStatusesByName

    if (statuses?.length) {
      statusesByName = statuses.reduce((acc, status) => {
        acc[status] = statusesByName[status]
        return acc
      }, {})
    }

    let options = []
    for (const status in statusesByName) {
      options.push({
        label: statusesByName[status]?.name,
        value: statusesByName[status]?.name,
        icon: () => h(IndicatorIcon, { class: statusesByName[status]?.color }),
        onClick: async () => {
          await triggerStatusChange?.(statusesByName[status]?.name)
          capture('status_changed', { doctype, status })
        },
      })
    }
    return options
  }

  return {
    leadStatuses,
    dealStatuses,
    communicationStatuses,
    getLeadStatus,
    getDealStatus,
    getCommunicationStatus,
    getEmailCampaignStatus,
  getDonorStatus,
    statusOptions,
  getEnabledStatus,
  }
})
