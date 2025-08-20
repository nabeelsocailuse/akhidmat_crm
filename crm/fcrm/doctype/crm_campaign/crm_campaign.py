# Copyright (c) 2025, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class CRMCampaign(Document):
	@staticmethod
	def get_non_filterable_fields():
		"""Return list of fields that should not be available for filtering"""
		return []
	
	@staticmethod
	def default_list_data():
		data = {
			"columns": [
				{"label": "Campaign Name", "type": "Data", "key": "campaign_name", "width": "16rem"},
				{"label": "Modified", "type": "Datetime", "key": "modified", "width": "8rem"},
				{"label": "Owner", "type": "Link", "key": "owner", "options": "User", "width": "12rem"},
			],
			"rows": ["name", "campaign_name", "modified", "owner"],
		}
		return data

	@staticmethod
	def parse_list_data(data):
		for record in data:
			if not record.get("name"):
				record["name"] = record.get("id") or record.get("name") or "Unknown"
		return data

	def on_update(self):
		pass
