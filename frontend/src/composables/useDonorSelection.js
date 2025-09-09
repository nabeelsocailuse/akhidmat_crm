import { call } from 'frappe-ui'

export function useDonorSelection() {
  
  async function fetchDonorDetails(donorId) {
    if (!donorId) {
      console.log('No donor ID provided')
      return null
    }
    
    try {
      console.log('Fetching donor details for:', donorId)
      
      const donorDetails = await call('akf_accounts.akf_accounts.doctype.donation.donation.get_donor_details', {
        donor_id: donorId
      })
      
      console.log('Donor details fetched successfully:', donorDetails)
      return donorDetails
      
    } catch (error) {
      console.error('Error fetching donor details:', error)
      return null
    }
  }
  
  function updateDonorFields(row, donorDetails) {
    if (!donorDetails) {
      console.log('No donor details to update')
      return
    }
    
    console.log('Updating row with donor details:', donorDetails)
    
    // Map donor fields to payment detail fields based on fetch_from configuration
    const fieldMappings = {
      'donor_name': 'donor_name',
      'donor_type': 'donor_type',
      'contact_no': 'contact_no',
      'email': 'email',
      'city': 'city',
      'address': 'address',
      'co_name': 'co_name',
      'co_contact_no': 'co_contact_no',
      'co_email': 'co_email',
      'co_address': 'co_address',
      'relationship_with_donor': 'relationship_with_donor',
      'cnic': 'cnic',
      'donor_desk_id': 'donor_desk_id'
    }
    
    // Update each field with donor data
    Object.entries(fieldMappings).forEach(([donorField, rowField]) => {
      if (donorDetails[donorField] !== undefined) {
        const oldValue = row[rowField]
        row[rowField] = donorDetails[donorField] || ''
        console.log(`Updated ${rowField}: ${oldValue} -> ${row[rowField]}`)
      }
    })
  }
  
  function clearDonorFields(row) {
    console.log('Clearing donor fields for row')
    
    const donorFields = [
      'donor_name', 'donor_type', 'contact_no', 'email', 'city', 'address',
      'co_name', 'co_contact_no', 'co_email', 'co_address', 'relationship_with_donor', 
      'cnic', 'donor_desk_id'
    ]
    
    donorFields.forEach(fieldName => {
      row[fieldName] = ''
    })
  }
  
  return {
    fetchDonorDetails,
    updateDonorFields,
    clearDonorFields
  }
} 

