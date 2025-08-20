# Copyright (c) 2025, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

import frappe
from frappe import _


@frappe.whitelist()
def get_campaign(name):
	campaign = frappe.get_doc("CRM Campaign", name)
	campaign.check_permission("read")

	campaign = campaign.as_dict()

	campaign["fields_meta"] = get_fields_meta("CRM Campaign")
	campaign["_form_script"] = get_form_script("CRM Campaign")
	return campaign


def get_fields_meta(doctype):
	meta = frappe.get_meta(doctype)
	return meta.as_dict()


def get_form_script(doctype):
	form_script = frappe.db.get_value("Custom Script", {"dt": doctype, "script_type": "Client"}, "script")
	return form_script or "" 