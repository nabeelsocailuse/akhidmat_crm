import frappe

@frappe.whitelist()
def get_lapsed_donor_dashboard():
    # --- Total Active Donors ---
    total_active_donors_row = frappe.db.sql("""
        SELECT COUNT(*) AS total_active_donors
        FROM `tabDonor`
        WHERE status = 'Active';
    """, as_dict=True)
    total_active_donors = (total_active_donors_row[0].total_active_donors if total_active_donors_row else 0) or 0

    total_lapsed_row = frappe.db.sql("""
        SELECT COUNT(*) AS total_lapsed_donors
        FROM (
            SELECT 
                d.name,
                MAX(dn.due_date) AS last_due_date
            FROM `tabDonor` AS d
            LEFT JOIN `tabPayment Detail` AS pd 
                ON pd.donor = d.name
            LEFT JOIN `tabDonation` AS dn 
                ON dn.name = pd.parent AND dn.docstatus = 1
            WHERE d.status = 'Active'
            GROUP BY d.name
            HAVING last_due_date < (CURDATE() - INTERVAL 365 DAY)
        ) t
    """, as_dict=True)
    total_lapsed_donors = (total_lapsed_row[0].total_lapsed_donors if total_lapsed_row else 0) or 0

    # --- Re-engagement Rate ---
    re_engagement_rate_row = frappe.db.sql("""
        SELECT 
            ROUND(
                (COUNT(DISTINCT CASE 
                    WHEN dn.due_date >= (CURDATE() - INTERVAL 365 DAY) THEN pd.donor
                END) 
                / COUNT(DISTINCT d.name)) * 100, 2
            ) AS re_engagement_rate
        FROM 
            `tabDonor` AS d
        LEFT JOIN 
            `tabPayment Detail` AS pd ON pd.donor = d.name
        LEFT JOIN 
            `tabDonation` AS dn ON dn.name = pd.parent
        WHERE 
            d.status = 'Active' AND dn.docstatus = 1
    """, as_dict=True)
    re_engagement_rate = (re_engagement_rate_row[0].re_engagement_rate if re_engagement_rate_row else 0) or 0

    lapsed_donors_list = frappe.db.sql("""
        SELECT 
            d.name AS donor_id,
            d.donor_name,
            MAX(dn.due_date) AS last_donation_date,
            SUM(pd.donation_amount) AS total_donations
        FROM 
            `tabDonor` AS d
        LEFT JOIN 
            `tabPayment Detail` AS pd ON pd.donor = d.name
        LEFT JOIN 
            `tabDonation` AS dn ON dn.name = pd.parent
        WHERE 
            d.status = 'Active' AND dn.docstatus = 0
        GROUP BY 
            d.name, d.donor_name
        HAVING 
            last_donation_date < (CURDATE() - INTERVAL 365 DAY)
    """, as_dict=True)

    return {
        "total_active_donors": total_active_donors,
        "total_lapsed_donors": total_lapsed_donors,
        "re_engagement_rate": re_engagement_rate,
        "lapsed_donors_list": lapsed_donors_list or []
    }
