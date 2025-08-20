import frappe
import json

@frappe.whitelist()
def create_donation_layout():
    """Create CRM Fields Layout for Donation doctype"""
    
    # Check if layout already exists
    if frappe.db.exists("CRM Fields Layout", {"dt": "Donation", "type": "Quick Entry"}):
        return {"message": "Donation Quick Entry layout already exists"}
    
    # Create the layout
    layout_doc = frappe.new_doc("CRM Fields Layout")
    layout_doc.dt = "Donation"
    layout_doc.type = "Quick Entry"
    layout_doc.layout = '''[
        {
            "name": "basic_details_section",
            "columns": [
                {
                    "name": "column_basic1",
                    "fields": ["company", "donor_identity", "contribution_type"]
                },
                {
                    "name": "column_basic2", 
                    "fields": ["donation_cost_center", "currency", "select_donation_type"]
                }
            ]
        },
        {
            "name": "payment_details_section",
            "columns": [
                {
                    "name": "column_payment",
                    "fields": ["payment_detail"]
                }
            ]
        },
        {
            "name": "deduction_breakeven_section",
            "columns": [
                {
                    "name": "column_deduction",
                    "fields": ["deduction_breakeven"]
                }
            ]
        }
    ]'''
    
    layout_doc.insert()
    return {"message": "Donation Quick Entry layout created successfully"} 