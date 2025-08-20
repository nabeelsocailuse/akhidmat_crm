# Copyright (c) 2023, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.desk.form.assign_to import add as assign
from frappe.model.document import Document
from frappe.utils import has_gravatar, validate_email_address

from crm.fcrm.doctype.crm_service_level_agreement.utils import get_sla
from crm.fcrm.doctype.crm_status_change_log.crm_status_change_log import (
	add_status_change_log,
)


class Donor(Document):
	def before_validate(self):
		self.set_sla()

	def validate(self):
		self.set_full_name()
		self.set_donor_name()
		self.set_title()
		self.validate_email()
		if not self.is_new() and self.has_value_changed("donor_owner") and self.donor_owner:
			self.share_with_agent(self.donor_owner)
			self.assign_agent(self.donor_owner)
		if self.has_value_changed("status"):
			add_status_change_log(self)

	def after_insert(self):
		if self.donor_owner:
			self.assign_agent(self.donor_owner)

	def before_save(self):
		self.apply_sla()

	def set_full_name(self):
		if self.first_name:
			self.donor_name = " ".join(
				filter(
					None,
					[
						self.salutation,
						self.first_name,
						self.middle_name,
						self.last_name,
					],
				)
			)

	def set_donor_name(self):
		if not self.donor_name:
			if not self.organization and not self.email and not self.flags.ignore_mandatory:
				frappe.throw(_("A Donor requires either a person's name or an organization's name"))
			elif self.organization:
				self.donor_name = self.organization
			elif self.email:
				self.donor_name = self.email.split("@")[0]
			else:
				self.donor_name = "Unnamed Donor"

	def set_title(self):
		self.title = self.organization or self.donor_name

	def validate_email(self):
		if self.email:
			if not self.flags.ignore_email_validation:
				validate_email_address(self.email, throw=True)

			if self.email == self.donor_owner:
				frappe.throw(_("Donor Owner cannot be same as the Donor Email Address"))

			if self.is_new() or not self.image:
				self.image = has_gravatar(self.email)

	def assign_agent(self, agent):
		if not agent:
			return

		assignees = self.get_assigned_users()
		if assignees:
			for assignee in assignees:
				if agent == assignee:
					# the agent is already set as an assignee
					return

		assign({"assign_to": [agent], "doctype": "Donor", "name": self.name})

	def share_with_agent(self, agent):
		if not agent:
			return

		docshares = frappe.get_all(
			"DocShare",
			filters={"share_name": self.name, "share_doctype": self.doctype},
			fields=["name", "user"],
		)

		shared_with = [d.user for d in docshares] + [agent]

		for user in shared_with:
			if user == agent and not frappe.db.exists(
				"DocShare",
				{"user": agent, "share_name": self.name, "share_doctype": self.doctype},
			):
				frappe.share.add_docshare(
					self.doctype,
					self.name,
					agent,
					write=1,
					flags={"ignore_share_permission": True},
				)
			elif user != agent:
				frappe.share.remove(self.doctype, self.name, user)

	def create_contact(self, existing_contact=None, throw=True):
		if not self.donor_name:
			self.set_full_name()
			self.set_donor_name()

		existing_contact = existing_contact or self.contact_exists(throw)
		if existing_contact:
			self.update_donor_contact(existing_contact)
			return existing_contact

		contact = frappe.new_doc("Contact")
		contact.update(
			{
				"first_name": self.first_name or self.donor_name,
				"last_name": self.last_name,
				"salutation": self.salutation,
				"gender": self.gender,
				"designation": self.job_title,
				"company_name": self.organization,
				"image": self.image or "",
			}
		)

		if self.email:
			contact.append("email_ids", {"email_id": self.email, "is_primary": 1})

		if self.phone:
			contact.append("phone_nos", {"phone": self.phone, "is_primary_phone": 1})

		if self.mobile_no:
			contact.append("phone_nos", {"phone": self.mobile_no, "is_primary_mobile_no": 1})

		contact.insert(ignore_permissions=True)
		contact.reload()  # load changes by hooks on contact

		return contact.name

	def create_organization(self, existing_organization=None):
		if not self.organization and not existing_organization:
			return

		existing_organization = existing_organization or frappe.db.exists(
			"CRM Organization", {"organization_name": self.organization}
		)
		if existing_organization:
			self.db_set("organization", existing_organization)
			return existing_organization

		organization = frappe.new_doc("CRM Organization")
		organization.update(
			{
				"organization_name": self.organization,
				"website": self.website,
				"territory": self.territory,
				"industry": self.industry,
				"annual_revenue": self.annual_revenue,
			}
		)
		organization.insert(ignore_permissions=True)
		return organization.name

	def update_donor_contact(self, contact):
		contact = frappe.get_cached_doc("Contact", contact)
		frappe.db.set_value(
			"Donor",
			self.name,
			{
				"salutation": contact.salutation,
				"first_name": contact.first_name,
				"last_name": contact.last_name,
				"email": contact.email_id,
				"mobile_no": contact.mobile_no,
			},
		)

	def contact_exists(self, throw=True):
		email_exist = frappe.db.exists("Contact Email", {"email_id": self.email})
		phone_exist = frappe.db.exists("Contact Phone", {"phone": self.phone})
		mobile_exist = frappe.db.exists("Contact Phone", {"phone": self.mobile_no})

		doctype = "Contact Email" if email_exist else "Contact Phone"
		name = email_exist or phone_exist or mobile_exist

		if name:
			text = "Email" if email_exist else "Phone" if phone_exist else "Mobile No"
			data = self.email if email_exist else self.phone if phone_exist else self.mobile_no

			value = "{0}: {1}".format(text, data)

			contact = frappe.db.get_value(doctype, name, "parent")

			if throw:
				frappe.throw(
					_(f"Contact already exists with {value}"),
					title=_("Contact Already Exists"),
				)
			return contact

		return False

	def set_sla(self):
		"""
		Find an SLA to apply to the donor.
		"""
		if self.sla:
			return

		sla = get_sla(self)
		if not sla:
			self.first_responded_on = None
			self.first_response_time = None
			return
		self.sla = sla.name

	def apply_sla(self):
		"""
		Apply SLA if set.
		"""
		if not self.sla:
			return
		sla = frappe.get_last_doc("CRM Service Level Agreement", {"name": self.sla})
		if sla:
			sla.apply(self)

	@staticmethod
	def get_non_filterable_fields():
		"""Return list of fields that should not be available for filtering"""
		return ["converted", "image", "sla_creation"]  # Exclude more fields that shouldn't be filtered

	@staticmethod
	def default_list_data():
		"""Return default list data for donor list view"""
		return {
			"columns": [
				{"label": "Donor Name", "type": "Data", "key": "donor_name", "width": "16rem"},
				{"label": "Organization", "type": "Data", "key": "organization", "width": "16rem"},
				{"label": "Email", "type": "Data", "key": "email", "width": "16rem"},
				{"label": "Mobile No", "type": "Data", "key": "mobile_no", "width": "12rem"},
				{"label": "Donor Owner", "type": "Link", "key": "donor_owner", "options": "User", "width": "12rem"},
				{"label": "Status", "type": "Link", "key": "status", "options": "Donor Status", "width": "8rem"},
				{"label": "Donor Type", "type": "Link", "key": "donor_type", "options": "Donor Type", "width": "12rem"},
				{"label": "Department", "type": "Link", "key": "department", "options": "Department", "width": "12rem"},
				{"label": "Modified", "type": "Datetime", "key": "modified", "width": "8rem"},
			],
			"rows": ["name", "donor_name", "organization", "email", "mobile_no", "donor_owner", "status", "donor_type", "department", "modified"],
		}

	@staticmethod
	def default_kanban_settings():
		return {
			"column_field": "status",
			"title_field": "donor_name",
			"kanban_fields": '["organization", "email", "mobile_no", "_assign", "modified"]',
		}


@frappe.whitelist()
def convert_to_deal(lead, doc=None, deal=None, existing_contact=None, existing_organization=None):
	if not (doc and doc.flags.get("ignore_permissions")) and not frappe.has_permission(
		"CRM Lead", "write", lead
	):
		frappe.throw(_("Not allowed to convert Lead to Deal"), frappe.PermissionError)

	lead = frappe.get_cached_doc("CRM Lead", lead)
	if frappe.db.exists("CRM Lead Status", "Qualified"):
		lead.db_set("status", "Qualified")
	lead.db_set("converted", 1)
	if lead.sla and frappe.db.exists("CRM Communication Status", "Replied"):
		lead.db_set("communication_status", "Replied")
	contact = lead.create_contact(existing_contact, False)
	organization = lead.create_organization(existing_organization)
	_deal = lead.create_deal(contact, organization, deal)
	return _deal
