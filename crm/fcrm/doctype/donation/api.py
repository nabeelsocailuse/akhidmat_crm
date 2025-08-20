import frappe

@frappe.whitelist()
def get_donation(name):
    """Get donation details by name"""
    try:
        # Since donation doctype exists in akf_accounts, we'll fetch from there
        if frappe.db.exists("Donation", name):
            donation = frappe.get_doc("Donation", name)
            return donation.as_dict()
        else:
            frappe.throw(f"Donation {name} not found")
    except Exception as e:
        frappe.log_error(f"Error in get_donation: {str(e)}")
        frappe.throw(f"Error fetching donation: {str(e)}") 