import frappe
from frappe import _
from frappe.utils import add_days, getdate, today, cint
from frappe.utils.background_jobs import enqueue
from frappe.core.doctype.communication.email import make


def send_mail_extended(entry, email_campaign):
    """Extended send_mail function that respects unsubscribe status for Email Groups"""
    recipient_list = []
    if email_campaign.email_campaign_for == "Email Group":
        # Only get unsubscribed members (unsubscribed = 0 means active)
        for member in frappe.db.get_list(
            "Email Group Member", 
            filters={
                "email_group": email_campaign.get("recipient"),
                "unsubscribed": 0  # Only active members
            }, 
            fields=["email"]
        ):
            recipient_list.append(member["email"])
        
        # Check if there are members but all are unsubscribed
        if not recipient_list:
            total_members = frappe.db.get_list(
                "Email Group Member", 
                filters={"email_group": email_campaign.get("recipient")}, 
                fields=["email"]
            )
            if total_members:
                frappe.log_error(
                    f"Email Campaign {email_campaign.name}: All members in email group '{email_campaign.get('recipient')}' are unsubscribed",
                    "Email Campaign Warning"
                )
    else:
        recipient_list.append(
            frappe.db.get_value(
                email_campaign.email_campaign_for, email_campaign.get("recipient"), "email_id"
            )
        )

    # Skip if no recipients
    if not recipient_list or not any(recipient_list):
        return None

    email_template = frappe.get_doc("Email Template", entry.get("email_template"))
    sender = frappe.db.get_value("User", email_campaign.get("sender"), "email")
    context = {"doc": frappe.get_doc(email_campaign.email_campaign_for, email_campaign.recipient)}
    # send mail and link communication to document
    comm = make(
        doctype="Email Campaign",
        name=email_campaign.name,
        subject=frappe.render_template(email_template.get("subject"), context),
        content=frappe.render_template(email_template.response_, context),
        sender=sender,
        recipients=recipient_list,
        communication_medium="Email",
        sent_or_received="Sent",
        send_email=True,
        email_template=email_template.name,
    )
    return comm


@frappe.whitelist()
def send_email_to_leads_or_contacts_extended(force: bool = False, email_campaign_id: str | None = None):
    """Public method called from Vue. Enqueue a background job and return job_id."""
    job = enqueue(
        method=_process_email_campaigns,
        queue="default",
        timeout=600,  # 10 min
        job_name=f"Send Email Campaign {email_campaign_id or 'bulk'}",
        force=force,
        email_campaign_id=email_campaign_id,
        user=frappe.session.user, 
    )
    return {
        "status": "Queued",
        # "message": _("Emails are being sent in the background..."),
        "job_id": job.id,
    }


def _process_email_campaigns(force: bool = False, email_campaign_id: str | None = None, user: str | None = None):
    """Actual heavy job that runs in background."""
    try:
        force_flag = bool(cint(force))
        total_recipients = 0
        updated_campaigns = []
        warning_messages = []

        # Build filters
        if email_campaign_id:
            filters = {"name": email_campaign_id, "status": ("!=", "Unsubscribed")}
        else:
            filters = {"status": ("not in", ["Unsubscribed", "Completed", "Scheduled"])}

        # Get matching campaigns
        email_campaigns = frappe.get_all("Email Campaign", filters=filters)
        for camp in email_campaigns:
            email_campaign = frappe.get_doc("Email Campaign", camp.name)
            campaign = frappe.get_cached_doc("Campaign", email_campaign.campaign_name)

            # Determine total recipients
            campaign_recipient_count = 0
            if email_campaign.email_campaign_for == "Email Group":
                # Only include active members
                active_members = frappe.get_all(
                    "Email Group Member",
                    filters={
                        "email_group": email_campaign.get("recipient"),
                        "unsubscribed": 0
                    },
                    fields=["email"]
                )
                campaign_recipient_count = len(active_members)
                if campaign_recipient_count == 0:
                    # Check if there are any members at all (including unsubscribed)
                    total_members = frappe.get_all(
                        "Email Group Member",
                        filters={"email_group": email_campaign.get("recipient")},
                        fields=["email"]
                    )
                    if len(total_members) > 0:
                        # There are members but all are unsubscribed
                        warning_messages.append(_("All members in email group '{0}' are unsubscribed. No emails will be sent.").format(email_campaign.get("recipient")))
                    continue  # skip if no active members
            else:
                email_addr = frappe.db.get_value(
                    email_campaign.email_campaign_for, email_campaign.get("recipient"), "email_id"
                )
                if email_addr:
                    campaign_recipient_count = 1
                else:
                    continue 

            sent_any_for_campaign = False
            for entry in campaign.get("campaign_schedules"):
                scheduled_date = add_days(email_campaign.get("start_date"), entry.get("send_after_days"))
                if force_flag or scheduled_date == getdate(today()):
                    # send_mail_extended handles recipients internally and respects unsubscribe status
                    result = send_mail_extended(entry, email_campaign)
                    if result:  # Only mark as sent if there were actual recipients
                        sent_any_for_campaign = True

            if sent_any_for_campaign:
                total_recipients += campaign_recipient_count
                email_campaign.db_set("status", "Completed", update_modified=True)
                updated_campaigns.append(email_campaign.name)

        frappe.db.commit()

        # Prepare final message
        if warning_messages and total_recipients > 0:
            # Both warnings and successful sends
            final_message = _("Emails sent successfully ({0}). Warnings: {1}").format(
                total_recipients, "; ".join(warning_messages)
            )
            status = "Completed"
        elif warning_messages and total_recipients == 0:
            # Only warnings, no successful sends
            final_message = _("No emails sent. {0}").format("; ".join(warning_messages))
            status = "Warning"
        elif total_recipients > 0:
            # Only successful sends
            final_message = _("Emails sent successfully ({0})").format(total_recipients)
            status = "Completed"
        else:
            # No campaigns processed or no recipients
            final_message = _("No emails to send")
            status = "Info"

        frappe.publish_realtime(
            "email_campaign_progress",
            {
                "status": status,
                "updated_campaigns": updated_campaigns,
                "total_recipients": total_recipients,
                "message": final_message,
                "warnings": warning_messages if warning_messages else None,
            },
            user=user or frappe.session.user,
            after_commit=True,
        )

    except Exception as e:
        frappe.db.rollback()
        # Notify frontend of failure
        frappe.publish_realtime(
            "email_campaign_progress",
            {
                "status": "Failed",
                "message": _("Email sending failed: {0}").format(str(e)),
            },
            user=user or frappe.session.user,
            after_commit=True,
        )
        frappe.log_error(title="Email Campaign Sending Failed", message=frappe.get_traceback())
        raise



def update_email_group_total_on_member_update(doc, method=None):
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
