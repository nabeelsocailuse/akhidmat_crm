import { call } from '@/utils/api'

export function useDonorSelection() {
  async function fetchDonorDetails(donorId) {
    if (!donorId) return null
    try {
      return await call('frappe.client.get', {
        doctype: 'Donor',
        name: donorId,
      })
    } catch (error) {
      console.error('Error fetching donor details:', error)
      return null
    }
  }

  function updateDonorFields(row, donorDetails) {
    if (!donorDetails) return
    const fieldMappings = {
      donor_name: 'donor_name',
      donor_type: 'donor_type',
      contact_no: 'contact_no',
      email: 'email',
      city: 'city',
      address: 'address',
      co_name: 'co_name',
      co_contact_no: 'co_contact_no',
      co_email: 'co_email',
      co_address: 'co_address',
      relationship_with_donor: 'relationship_with_donor',
      cnic: 'cnic',
      donor_desk_id: 'donor_desk_id',
    }
    Object.entries(fieldMappings).forEach(([donorField, rowField]) => {
      if (donorDetails[donorField] !== undefined) {
        row[rowField] = donorDetails[donorField] || ''
      }
    })
  }

  function clearDonorFields(row) {
    const donorFields = [
      'donor_name',
      'donor_type',
      'contact_no',
      'email',
      'city',
      'address',
      'co_name',
      'co_contact_no',
      'co_email',
      'co_address',
      'relationship_with_donor',
      'cnic',
      'donor_desk_id',
    ]
    donorFields.forEach((fieldName) => {
      row[fieldName] = ''
    })
  }

  return {
    fetchDonorDetails,
    updateDonorFields,
    clearDonorFields,
  }
}
