import frappe
from frappe.utils import nowdate

@frappe.whitelist()
def get_lapsed_donor_dashboard(filters=None):

    conditions = ""
    if filters and isinstance(filters, dict):
        if filters.get("campaign"):
            campaign = filters.get("campaign")
            conditions += f" AND dn.campaign = '{campaign}'"
        if filters.get("fund_class"):
            fund_class = filters.get("fund_class")
            conditions += f" AND pd.fund_class = '{fund_class}'"
        if filters.get("pay_service_area"):
            pay_service_area = filters.get("pay_service_area")
            conditions += f" AND pd.pay_service_area = '{pay_service_area}'"
        if filters.get("pay_subservice_area"):
            pay_subservice_area = filters.get("pay_subservice_area")
            conditions += f" AND pd.pay_subservice_area = '{pay_subservice_area}'"
        if filters.get("pay_product"):
            pay_product = filters.get("pay_product")
            conditions += f" AND pd.pay_product = '{pay_product}'"
        
        if filters.get("time_period") == '3':
            interval = 90
        elif filters.get("time_period") == '6':
            interval = 180
        elif filters.get("time_period") == '12':
            interval = 360
        else:
            interval = 720

    total_active_donors_row = frappe.db.sql("""
        SELECT COUNT(*) AS total_active_donors
        FROM `tabDonor`
        WHERE status = 'Active'
    """, as_dict=True)
    total_active_donors = (total_active_donors_row[0].total_active_donors if total_active_donors_row else 0) or 0

    total_lapsed_row = frappe.db.sql(f"""
        SELECT COUNT(*) AS total_lapsed_donors
        FROM (
            SELECT 
                d.name,
                MAX(dn.due_date) AS last_due_date
            FROM `tabDonor` AS d
            LEFT JOIN `tabPayment Detail` AS pd ON pd.donor = d.name
            LEFT JOIN `tabDonation` AS dn ON dn.name = pd.parent AND dn.docstatus = 1
            WHERE d.status = 'Active' {conditions}
            GROUP BY d.name
            HAVING last_due_date < (CURDATE() - INTERVAL {interval} DAY)
        ) t
    """, as_dict=True)
    total_lapsed_donors = (total_lapsed_row[0].total_lapsed_donors if total_lapsed_row else 0) or 0

    re_engagement_rate_row = frappe.db.sql(f"""
        SELECT 
            ROUND(
                (COUNT(DISTINCT CASE 
                    WHEN dn.due_date >= (CURDATE() - INTERVAL {interval} DAY) THEN pd.donor
                END) / COUNT(DISTINCT d.name)) * 100, 2
            ) AS re_engagement_rate
        FROM 
            `tabDonor` AS d
        LEFT JOIN 
            `tabPayment Detail` AS pd ON pd.donor = d.name
        LEFT JOIN 
            `tabDonation` AS dn ON dn.name = pd.parent
        WHERE 
            d.status = 'Active' AND dn.docstatus = 1 {conditions}
    """, as_dict=True)
    re_engagement_rate = (re_engagement_rate_row[0].re_engagement_rate if re_engagement_rate_row else 0) or 0

    lapsed_donors_list = frappe.db.sql(f"""
        SELECT 
            d.name AS donor_id,
            d.donor_name,
            d.email,
            MAX(dn.due_date) AS last_donation_date,
            SUM(pd.donation_amount) AS total_donations
        FROM 
            `tabDonor` AS d
        LEFT JOIN 
            `tabPayment Detail` AS pd ON pd.donor = d.name
        LEFT JOIN 
            `tabDonation` AS dn ON dn.name = pd.parent
        WHERE 
            d.status = 'Active' AND dn.docstatus = 1 {conditions}
        GROUP BY 
            d.name, d.donor_name, d.email
        HAVING 
            last_donation_date < (CURDATE() - INTERVAL {interval} DAY)
    """, as_dict=True)

    return {
        "total_active_donors": total_active_donors,
        "total_lapsed_donors": total_lapsed_donors,
        "re_engagement_rate": re_engagement_rate,
        "lapsed_donors_list": lapsed_donors_list or []
    }


# @frappe.whitelist()
# def send_lapsed_donor_emails(group_name):
#     """Send email to all members of a given email group using the default outgoing account."""
#     if not group_name:
#         frappe.throw("Email group name is required")

#     members = frappe.get_all(
#         "Email Group Member",
#         filters={"email_group": group_name},
#         fields=["email"]
#     )

#     if not members:
#         frappe.throw("No members found in the specified email group.")

#     emails = [m.email for m in members if m.email]

#     subject = "We Miss You at AKF - Let's Reconnect!"
#     message = """
#         <p>Dear Donor,</p>
#         <p>We noticed it’s been a while since your last contribution. 
#         Your support has always made a real difference, and we’d love to have you back!</p>
#         <p>Click below to renew your support.</p>
#         <p><a href='https://akf.org/donate' 
#               style='background:#007bff;color:#fff;padding:10px 20px;text-decoration:none;border-radius:5px;'>Donate Again</a></p>
#         <p>Warm regards,<br>The AKF Team</p>
#     """

#     frappe.sendmail(
#         recipients=emails,
#         subject=subject,
#         message=message,
#         now=False,  
#         reference_doctype="Email Group",
#         reference_name=group_name
#     )

#     return {"message": f"{len(emails)} emails queued successfully."}
