import frappe
import json

from crm.api.doc import get_assigned_users, get_fields_meta
from crm.fcrm.doctype.crm_form_script.crm_form_script import get_form_script


@frappe.whitelist()
def get_donor(name):
	donor = frappe.get_doc("Donor", name)
	donor.check_permission("read")

	donor = donor.as_dict()

	donor["fields_meta"] = get_fields_meta("Donor")
	donor["_form_script"] = get_form_script("Donor")
	
	return donor


@frappe.whitelist()
def update_donor_status(name, status):
	try:
		donor = frappe.get_doc("Donor", name)
		donor.check_permission("write")
		
		frappe.db.set_value("Donor", name, "status", status)
		
		return {
			"success": True, 
			"message": "Status updated successfully",
			"refresh_required": True,
			"timestamp": frappe.utils.now()
		}
	except Exception as e:
		frappe.log_error(f"Error updating donor status: {str(e)}")
		return {"success": False, "message": str(e)}


@frappe.whitelist()
def create_donor(doc):
	"""Create a new donor with refresh functionality"""
	try:
		if isinstance(doc, str):
			doc = json.loads(doc)
		
		frappe.logger().info(f"Creating donor with data: {doc}")
		
		# Handle naming series fallback
		if doc.get('naming_series') and '{branch_abbreviation}' in doc.get('naming_series', ''):
			if not doc.get('branch_abbreviation'):
				# Try to get branch_abbreviation from branch
				if doc.get('branch'):
					branch_abbreviation = frappe.db.get_value('Cost Center', doc.get('branch'), 'custom_abbreviation')
					if branch_abbreviation:
						doc['branch_abbreviation'] = branch_abbreviation
					else:
						# Use fallback naming series
						doc['naming_series'] = 'DONOR-.YYYY.-'
				else:
					# Use fallback naming series
					doc['naming_series'] = 'DONOR-.YYYY.-'
		
		donor_doc = frappe.get_doc(doc)
		donor_doc.insert()
		
		frappe.logger().info(f"Donor created successfully with name: {donor_doc.name}")
		
		return {
			"success": True,
			"message": "Donor created successfully",
			"name": donor_doc.name,
			"refresh_required": True,
			"timestamp": frappe.utils.now()
		}
	except Exception as e:
		frappe.log_error(f"Error creating donor: {str(e)}")
		frappe.logger().error(f"Donor creation failed: {str(e)}")
		return {"success": False, "message": str(e)}


@frappe.whitelist()
def delete_donor(name):
	try:
		donor = frappe.get_doc("Donor", name)
		donor.check_permission("delete")
		
		frappe.delete_doc("Donor", name, ignore_missing=False)
		
		return {
			"success": True,
			"message": "Donor deleted successfully",
			"refresh_required": True,
			"timestamp": frappe.utils.now()
		}
	except Exception as e:
		frappe.log_error(f"Error deleting donor: {str(e)}")
		return {"success": False, "message": str(e)}



