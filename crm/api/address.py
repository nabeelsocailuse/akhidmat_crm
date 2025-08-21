import frappe
from frappe import _


def validate(doc, method):
	update_deals_address(doc)


def update_deals_address(doc):
	# For now, we'll skip this function since CRM Addresses doctype doesn't exist
	# This can be implemented later when the linking structure is defined
	pass


@frappe.whitelist()
def get_address(name):
	address = frappe.get_doc("Address", name)
	address.check_permission("read")

	address = address.as_dict()

	if not len(address):
		frappe.throw(_("Address not found"), frappe.DoesNotExistError)

	return address


@frappe.whitelist()
def get_linked_deals(address):
	"""Get linked deals for an address"""

	if not frappe.has_permission("Address", "read", address):
		frappe.throw("Not permitted", frappe.PermissionError)

	# For now, return empty list since CRM Addresses doctype doesn't exist
	# This can be implemented later when the linking structure is defined
	return []


@frappe.whitelist()
def create_new(address, field, value):
	"""Create new email or phone for an address"""
	if not frappe.has_permission("Address", "write", address):
		frappe.throw("Not permitted", frappe.PermissionError)

	address = frappe.get_cached_doc("Address", address)

	if field == "email":
		address.email_id = value
	elif field in ("phone", "fax"):
		address.set(field, value)
	else:
		frappe.throw("Invalid field")

	address.save()
	return True


@frappe.whitelist()
def set_as_primary(address, field, value):
	"""Set address as primary for a deal"""
	if not frappe.has_permission("Address", "write", address):
		frappe.throw("Not permitted", frappe.PermissionError)

	address = frappe.get_doc("Address", address)

	if field == "is_primary_address":
		address.is_primary_address = value
	elif field == "is_shipping_address":
		address.is_shipping_address = value
	else:
		frappe.throw("Invalid field")

	address.save()
	return True


@frappe.whitelist()
def search_addresses(txt: str):
	doctype = "Address"
	meta = frappe.get_meta(doctype)
	filters = [["Address", "address_title", "is", "set"]]

	if meta.get("fields", {"fieldname": "enabled", "fieldtype": "Check"}):
		filters.append([doctype, "enabled", "=", 1])
	if meta.get("fields", {"fieldname": "disabled", "fieldtype": "Check"}):
		filters.append([doctype, "disabled", "!=", 1])

	or_filters = []
	search_fields = ["address_title", "city", "name"]
	if txt:
		for f in search_fields:
			or_filters.append([doctype, f.strip(), "like", f"%{txt}%"])

	results = frappe.get_list(
		doctype,
		filters=filters,
		fields=search_fields,
		or_filters=or_filters,
		limit_start=0,
		limit_page_length=20,
		order_by="address_title, city, name",
		ignore_permissions=False,
		as_list=True,
		strict=False,
	)

	return results 