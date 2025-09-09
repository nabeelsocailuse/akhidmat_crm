import frappe

@frappe.whitelist()
def get_donation(name):
    """Get donation details by name"""
    try:
        # Since donation doctype exists in akf_accounts, we'll fetch from there
        if frappe.db.exists("Donation", name):
            donation = frappe.get_doc("Donation", name)
            return donation.as_dict()
        else:
            frappe.throw(f"Donation {name} not found")
    except Exception as e:
        frappe.throw(f"Error fetching donation: {str(e)}")

@frappe.whitelist()
def get_deduction_details(fund_class, company=None):
    """Get deduction details for a fund class"""
    try:
        if not fund_class:
            return {}
        
        # Get ALL deduction details for this fund class (not just the first one)
        result = frappe.db.sql("""
            SELECT 
                company, income_type, project, account, 
                percentage, min_percent, max_percent
            FROM 
                `tabDeduction Details` dd
            WHERE 
                parent = %(fund_class)s
            ORDER BY idx
        """, {
            'fund_class': fund_class
        }, as_dict=True)
        
        # Return all results if available
        if result and len(result) > 0:
            return result
        else:
            return {}
            
    except Exception as e:
        # No logging at all - just return empty dict
        return {}

@frappe.whitelist()
def test_api():
    """Test endpoint to verify API is working"""
    return {"message": "API is working", "timestamp": frappe.utils.now()}

@frappe.whitelist()
def test_deduction_simple(fund_class):
    """Simple test endpoint for deduction details"""
    try:
        result = frappe.db.sql("""
            SELECT percentage, min_percent, max_percent
            FROM `tabDeduction Details`
            WHERE parent = %s
            LIMIT 1
        """, (fund_class,), as_dict=True)
        
        if result:
            return {"success": True, "data": result[0]}
        else:
            return {"success": False, "message": "No data found"}
            
    except Exception as e:
        return {"success": False, "error": str(e)[:100]} 


@frappe.whitelist()
def get_fund_class_details(fund_class_id, company=None):
    """
    Get fund class details including service area, subservice area, product, and account information.
    This method is called from the frontend when a fund class is selected in payment details.
    """
    try:
        if not fund_class_id:
            return {}
       
        # Get the fund class document
        fund_class = frappe.get_doc("Fund Class", fund_class_id)
       
        # Get basic fund class details
        result = {
            'service_area': fund_class.service_area,
            'subservice_area': fund_class.subservice_area,
            'product': fund_class.product,
            'fund_class_name': fund_class.fund_class_name
        }
       
        # Get account defaults if company is provided
        if company and fund_class.accounts_default:
            for account_default in fund_class.accounts_default:
                if account_default.company == company:
                    result.update({
                        'equity_account': account_default.equity_account,
                        'receivable_account': account_default.receivable_account,
                        'cost_center': account_default.cost_center
                    })
                    break
       
        # If no company-specific accounts found, try to get any available accounts
        if not company and fund_class.accounts_default:
            for account_default in fund_class.accounts_default:
                result.update({
                    'equity_account': account_default.equity_account,
                    'receivable_account': account_default.receivable_account,
                    'cost_center': account_default.cost_center
                })
                break
       
        return result
       
    except Exception as e:
        frappe.log_error(f"Error in get_fund_class_details: {str(e)}", "Fund Class Details Error")
        return {}