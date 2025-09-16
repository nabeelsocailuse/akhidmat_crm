import frappe
from frappe import _
from frappe.utils import add_days, getdate, today, cint
from erpnext.crm.doctype.email_campaign.email_campaign import send_mail


@frappe.whitelist()
def send_email_to_leads_or_contacts_extended(force: bool = False, email_campaign_id: str | None = None):

    force_flag = bool(cint(force))
    total_recipients = 0

    if email_campaign_id:
        filters = {"name": email_campaign_id, "status": ("!=", "Unsubscribed")}
    else:
        filters = {"status": ("not in", ["Unsubscribed", "Completed", "Scheduled"])}

    email_campaigns = frappe.get_all("Email Campaign", filters=filters)
    for camp in email_campaigns:
        email_campaign = frappe.get_doc("Email Campaign", camp.name)
        campaign = frappe.get_cached_doc("Campaign", email_campaign.campaign_name)

        campaign_recipient_count = 0
        if email_campaign.email_campaign_for == "Email Group":
            campaign_recipient_count = cint(
                frappe.db.get_value("Email Group", email_campaign.get("recipient"), "total_subscribers") or 0
            )
        else:
            email_addr = frappe.db.get_value(
                email_campaign.email_campaign_for, email_campaign.get("recipient"), "email_id"
            )
            campaign_recipient_count = 1 if email_addr else 0

        sent_any_for_campaign = False
        for entry in campaign.get("campaign_schedules"):
            scheduled_date = add_days(email_campaign.get("start_date"), entry.get("send_after_days"))
            if force_flag or scheduled_date == getdate(today()):
                send_mail(entry, email_campaign)  
                sent_any_for_campaign = True

        if sent_any_for_campaign:
            total_recipients += campaign_recipient_count

    return {"status": "success", "message": _(f"Emails sent successfully ({total_recipients})")}



def update_email_group_total_on_member_update(doc, method=None):
    """Update totals when an Email Group Member changes its `email_group`."""
    if not doc.email_group:
        return

    old_group = None
    if hasattr(doc, "get_doc_before_save") and doc.get_doc_before_save():
        old_group = doc.get_doc_before_save().get("email_group")

    if old_group and old_group != doc.email_group:
        frappe.get_doc("Email Group", old_group).update_total_subscribers()
        frappe.get_doc("Email Group", doc.email_group).update_total_subscribers()
    else:
        frappe.get_doc("Email Group", doc.email_group).update_total_subscribers()
