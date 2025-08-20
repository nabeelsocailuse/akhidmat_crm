import frappe

def execute():
    """Add missing donor_type and department fields to CRM Donor doctype"""
    
    # Check if fields already exist
    if not frappe.db.exists("DocField", {"parent": "Donor", "fieldname": "donor_type"}):
        # Add donor_type field
        frappe.get_doc({
            "doctype": "DocField",
            "parent": "Donor",
            "fieldname": "donor_type",
            "label": "Donor Type",
            "fieldtype": "Link",
            "options": "Donor Type",
            "in_list_view": 1,
            "in_standard_filter": 1,
            "reqd": 0,
            "insert_after": "donor_name"
        }).insert()
    
    if not frappe.db.exists("DocField", {"parent": "Donor", "fieldname": "department"}):
        # Add department field
        frappe.get_doc({
            "doctype": "DocField",
            "parent": "Donor",
            "fieldname": "department",
            "label": "Department",
            "fieldtype": "Link",
            "options": "Department",
            "in_list_view": 1,
            "in_standard_filter": 1,
            "reqd": 0,
            "insert_after": "donor_type"
        }).insert()
    
    # Create Donor Type doctype if it doesn't exist
    if not frappe.db.exists("DocType", "Donor Type"):
        frappe.get_doc({
            "doctype": "DocType",
            "name": "Donor Type",
            "module": "CRM",
            "custom": 0,
            "istable": 0,
            "issingle": 0,
            "autoname": "field:donor_type",
            "fields": [
                {
                    "fieldname": "donor_type",
                    "label": "Donor Type",
                    "fieldtype": "Data",
                    "reqd": 1,
                    "unique": 1,
                    "in_list_view": 1
                }
            ]
        }).insert()
    
    frappe.db.commit() 