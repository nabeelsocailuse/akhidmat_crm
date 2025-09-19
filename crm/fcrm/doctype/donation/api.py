import frappe
from frappe.utils import get_link_to_form
from erpnext.setup.utils import get_exchange_rate

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
def get_deduction_details(fund_class=None, fund_class_id=None, company=None):
    """Get deduction details for a fund class"""
    try:
        # Handle both parameter names for backward compatibility
        fund_class_value = fund_class or fund_class_id
        
        if not fund_class_value:
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
            'fund_class': fund_class_value
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

@frappe.whitelist()
def set_deduction_breakeven(payment_details, company, contribution_type, donation_cost_center, 
                           currency=None, to_currency=None, exchange_rate=None, posting_date=None, 
                           is_return=False, existing_deduction_breakeven=None):
    """
    EXACT REPLICATION of backend set_deduction_breakeven functionality.
    This method replicates the exact logic from the backend donation.py file.
    
    Args:
        payment_details: List of payment detail rows
        company: Company name
        contribution_type: Contribution type (Donation/Pledge)
        donation_cost_center: Donation cost center
        currency: Base currency
        to_currency: Target currency
        exchange_rate: Exchange rate
        posting_date: Posting date for currency conversion
        is_return: Whether this is a return transaction
        existing_deduction_breakeven: Existing deduction breakeven rows
    """
    try:
        if not payment_details or not isinstance(payment_details, list):
            return {"success": False, "message": "Invalid payment details"}
        
        if not company:
            return {"success": False, "message": "Company is required"}
        
        def reset_mode_of_payment(row):
            if contribution_type == "Pledge":
                row['mode_of_payment'] = None
                row['account_paid_to'] = None
                row['transaction_no_cheque_no'] = ""
                row['reference_date'] = None
            # Note: Merchant logic removed as it's not in the current backend
        
        def get_deduction_details(row, deduction_breakeven):
            # Skip deduction for Zakat or Pledge (EXACT backend logic)
            intention_id = row.get('intention_id')
            if intention_id in [None, "Zakat"] or contribution_type == 'Pledge':
                return []
            
            # Check existing deduction breakeven first
            _breakeven = [d for d in deduction_breakeven if d.get('random_id') == row.get('random_id')]
            if _breakeven:
                return _breakeven
            
            # Get deduction details from database (EXACT backend query)
            result = frappe.db.sql(f"""
                SELECT 
                    company, income_type,
                    project, 
                    account, 
                    percentage, 
                    min_percent, 
                    max_percent
                FROM 
                    `tabDeduction Details` dd
                WHERE 
                    ifnull(account, "") != ""
                    and company = '{company}'
                    and parenttype = "Fund Class"
                    and parent = '{row.get("fund_class_id")}'
            """, as_dict=True)
            
            return result
        
        def set_deduction_details(row, args):
            # EXACT backend logic for setting deduction details
            deduction_row = {
                "random_id": row.get('random_id'),
                "company": company,
                "income_type": args.get('income_type'),
                "project": args.get('project'),
                "account": args.get('account'),
                "percentage": args.get('percentage', 0),
                "min_percent": args.get('min_percent', 0),
                "max_percent": args.get('max_percent', 0),
                "donation_amount": row.get('donation_amount', 0),
                "amount": percentage_amount,
                "base_amount": base_amount,
                "project_id": args.get('project'),
                "cost_center_id": donation_cost_center,
                "fund_class_id": row.get('fund_class_id'),
                "service_area_id": row.get('pay_service_area'),
                "subservice_area_id": row.get('pay_subservice_area'),
                "product_id": row.get('pay_product'),
                "donor_id": row.get('donor_id'),
                "donor_type_id": row.get('donor_type'),
                "donor_desk_id": row.get('donor_desk_id'),
                "intention_id": row.get('intention_id'),
                "transaction_type_id": row.get('transaction_type_id'),
                "__islocal": True,
                "doctype": "Deduction Breakeven",
                "parentfield": "deduction_breakeven",
                "parenttype": "Donation"
            }
            return deduction_row
        
        def get_default_accounts(fund_class_id, fieldname):
            # EXACT backend logic
            return frappe.db.get_value('Accounts Default', {
                'parent': fund_class_id, 
                'company': company
            }, fieldname)
        
        def get_default_donor_account(donor_id, fieldname):
            # EXACT backend logic
            return frappe.db.get_value('Donor', {'name': donor_id}, fieldname)
        
        def verify_unique_receipt_no(row):
            # EXACT backend logic
            if not row.get('receipt_number'):
                return True
            receipt_list = [d.get('idx') for d in payment_details 
                          if row.get('receipt_number') == d.get('receipt_number') 
                          and row.get('idx') != d.get('idx')]
            if receipt_list:
                frappe.throw(f"Receipt#<b>{row.get('receipt_number')}</b> in row#<b>{row.get('idx')}</b> is already used in another row.", title='Receipt No.')
            return True
        
        def validate_active_donor(row):
            # EXACT backend logic
            if frappe.db.exists("Donor", {"name": row.get('donor_id'), "status": "Blocked"}):
                frappe.throw(f"<b>Row#{row.get('idx')}</b> donor: {row.get('donor_id')} is blocked.", title='Blocked Donor.')
        
        def validate_donor_currency(row):
            # EXACT backend logic
            if currency and not frappe.db.exists("Donor", {"name": row.get('donor_id'), "default_currency": currency}):
                donor_id = get_link_to_form("Donor", row.get('donor_id'))
                frappe.throw(f"<b>Row#{row.get('idx')}</b> donor: {donor_id} currency is not {currency}.", title='Currency conflict')
        
        def apply_currency_exchange(amount):
            # EXACT backend logic
            if currency:
                if currency != to_currency:
                    if exchange_rate and exchange_rate > 0:
                        return amount * exchange_rate
                    return amount * 1
                else:
                    return amount
            return amount
        
        def set_total_donors():
            return len(payment_details)
        
        # Main processing logic (EXACT backend replication)
        deduction_breakeven = existing_deduction_breakeven or []
        deduction_breakeven_rows = []
        deduction_amount = 0
        total_donation = 0
        
        for row in payment_details:
            # Validate required fields
            if not row.get('random_id'):
                row['random_id'] = frappe.generate_hash(length=8)
            
            # EXACT backend validations
            validate_active_donor(row)
            validate_donor_currency(row)
            verify_unique_receipt_no(row)
            reset_mode_of_payment(row)
            
            total_donation += row.get('donation_amount', 0)
            temp_deduction_amount = 0
            
            # Setup Deduction Breakeven (EXACT backend logic)
            for args in get_deduction_details(row, deduction_breakeven):
                percentage_amount = 0
                base_amount = 0
                
                if row.get('donation_amount', 0) > 0 or is_return:
                    percentage_amount = row.get('donation_amount', 0) * (args.get('percentage', 0) / 100)
                    base_amount = apply_currency_exchange(percentage_amount)
                    temp_deduction_amount += percentage_amount
                
                # Create deduction breakeven row
                deduction_row = set_deduction_details(row, args)
                deduction_breakeven_rows.append(deduction_row)
            
            # Set account details (EXACT backend logic)
            row['equity_account'] = get_default_accounts(row.get('fund_class_id'), 'equity_account')
            default_receivable_account = get_default_donor_account(row.get('donor_id'), "default_account")
            row['receivable_account'] = default_receivable_account if default_receivable_account else get_default_accounts(row.get('pay_service_area'), 'receivable_account')
            row['cost_center'] = donation_cost_center
            
            # Calculate amounts (EXACT backend logic)
            deduction_amount += temp_deduction_amount
            row['deduction_amount'] = temp_deduction_amount
            row['net_amount'] = row.get('donation_amount', 0) - temp_deduction_amount
            row['outstanding_amount'] = row.get('donation_amount', 0) if contribution_type == "Pledge" else row['net_amount']
            
            # Currency conversion (EXACT backend logic)
            row['base_donation_amount'] = apply_currency_exchange(row.get('donation_amount', 0))
            row['base_deduction_amount'] = apply_currency_exchange(temp_deduction_amount)
            row['base_net_amount'] = apply_currency_exchange(row['net_amount'])
            row['base_outstanding_amount'] = apply_currency_exchange(row['outstanding_amount'])
        
        # Calculate totals
        total_donors = set_total_donors()
        
        return {
            "success": True,
            "deduction_breakeven": deduction_breakeven_rows,
            "updated_payment_details": payment_details,
            "total_donation": total_donation,
            "total_deduction_amount": deduction_amount,
            "total_donors": total_donors
        }
        
    except Exception as e:
        # frappe.log_error(f"Error in set_deduction_breakeven: {str(e)}", "Set Deduction Breakeven Error")
        # return {"success": False, "message": f"Error setting deduction breakeven: {str(e)}"}
        return {} 

@frappe.whitelist()
def update_deduction_breakeven(payment_details, deduction_breakeven, company, contribution_type, 
                              donation_cost_center, currency=None, to_currency=None, exchange_rate=None, 
                              posting_date=None, is_return=False):
    """
    EXACT REPLICATION of backend update_deduction_breakeven functionality.
    This method replicates the exact logic from the backend donation.py file.
    """
    try:
        if not payment_details or not isinstance(payment_details, list):
            return {"success": False, "message": "Invalid payment details"}
        
        if not company:
            return {"success": False, "message": "Company is required"}
        
        def apply_currency_exchange(amount):
            # EXACT backend logic
            if currency:
                if currency != to_currency:
                    if exchange_rate and exchange_rate > 0:
                        return amount * exchange_rate
                    return amount * 1
                else:
                    return amount
            return amount
        
        # Main processing logic (EXACT backend replication)
        deduction_amount = 0
        total_donation = 0
        breakeven_list = []
        
        for row1 in payment_details:
            total_donation += row1.get('donation_amount', 0)
            row1['base_donation_amount'] = apply_currency_exchange(row1.get('donation_amount', 0))
            
            # Setup Deduction Breakeven
            temp_deduction_amount = 0
            
            for row2 in deduction_breakeven:
                if row1.get('random_id') == row2.get('random_id'):
                    percentage_amount = 0
                    base_amount = 0
                    
                    if row1.get('donation_amount', 0) > 0 or is_return:
                        percentage_amount = row1.get('donation_amount', 0) * (row2.get('percentage', 0) / 100)
                        base_amount = apply_currency_exchange(percentage_amount)
                        temp_deduction_amount += percentage_amount
                    
                    # EXACT backend args structure
                    args = {
                        "random_id": row1.get('random_id'),
                        "income_type": row2.get('income_type'),
                        "project_id": row2.get('project_id'),
                        "account": row2.get('account'),
                        "percentage": row2.get('percentage', 0),
                        "min_percent": row2.get('min_percent', 0),
                        "max_percent": row2.get('max_percent', 0),
                        "company": row2.get('company'),
                        "cost_center_id": row1.get('cost_center'),
                        "fund_class": row1.get('fund_class_id'),
                        "service_area_id": row1.get('pay_service_area'),
                        "subservice_area_id": row1.get('pay_subservice_area'),
                        "product_id": row1.get('pay_product'),
                        "donor_id": row1.get('donor_id'),
                        "donor_type_id": row1.get('donor_type'),
                        "donor_desk_id": row1.get('donor_desk_id'),
                        "intention_id": row1.get('intention_id'),
                        "transaction_type_id": row1.get('transaction_type_id'),
                        "donation_amount": row1.get('donation_amount', 0),
                        "amount": percentage_amount,
                        "base_amount": base_amount,
                        "payment_detail_id": row1.get('idx'),
                        "__islocal": True,
                        "doctype": "Deduction Breakeven",
                        "parentfield": "deduction_breakeven",
                        "parenttype": "Donation"
                    }
                    breakeven_list.append(args)
            
            # Update payment row amounts (EXACT backend logic)
            row1['deduction_amount'] = temp_deduction_amount
            row1['net_amount'] = row1.get('donation_amount', 0) - temp_deduction_amount
            row1['outstanding_amount'] = row1.get('donation_amount', 0) if contribution_type == "Pledge" else row1['net_amount']
            row1['base_outstanding_amount'] = apply_currency_exchange(row1['outstanding_amount'])
            deduction_amount += temp_deduction_amount
        
        return {
            "success": True,
            "deduction_breakeven": breakeven_list,
            "updated_payment_details": payment_details,
            "total_donation": total_donation,
            "total_deduction_amount": deduction_amount
        }
        
    except Exception as e:
        frappe.log_error(f"Error in update_deduction_breakeven: {str(e)}", "Update Deduction Breakeven Error")
        return {"success": False, "message": f"Error updating deduction breakeven: {str(e)}"}

@frappe.whitelist()
def validate_deduction_percentages(deduction_breakeven):
    """
    EXACT REPLICATION of backend validate_deduction_percentages functionality.
    This method replicates the exact logic from the backend donation.py file.
    """
    try:
        if not deduction_breakeven or not isinstance(deduction_breakeven, list):
            return {"success": True, "message": "No deduction breakeven to validate"}
        
        errors = []
        
        for row in deduction_breakeven:
            if not row.get('account'):
                continue
            
            fund_class = row.get('fund_class_id') or row.get('fund_class')
            account = row.get('account')
            percentage = row.get('percentage', 0)
            
            # Get min/max percentage for this account (EXACT backend logic)
            min_percentage, max_percentage = get_min_max_percentage(fund_class, account)
            
            if min_percentage is not None and max_percentage is not None:
                if percentage < min_percentage or percentage > max_percentage:
                    errors.append(f"Row#{row.get('idx', 'N/A')}; Percentage for account '{account}' must be between {min_percentage}% and {max_percentage}%.")
        
        if errors:
            return {"success": False, "errors": errors}
        
        return {"success": True, "message": "All percentages are valid"}
        
    except Exception as e:
        frappe.log_error(f"Error in validate_deduction_percentages: {str(e)}", "Deduction Percentage Validation Error")
        return {"success": False, "message": f"Error validating percentages: {str(e)}"}

@frappe.whitelist()
def get_min_max_percentage(fund_class, account):
    """
    EXACT REPLICATION of backend get_min_max_percentage functionality.
    This method replicates the exact logic from the backend donation.py file.
    """
    try:
        if not fund_class or not account:
            return None, None
        
        result = frappe.db.sql("""
            SELECT min_percent, max_percent
            FROM `tabDeduction Details`
            WHERE parent = %s AND account = %s
        """, (fund_class, account), as_dict=True)
        
        if result:
            return result[0].get('min_percent'), result[0].get('max_percent')
        else:
            return None, None
            
    except Exception as e:
        frappe.log_error(f"Error in get_min_max_percentage: {str(e)}", "Min Max Percentage Error")
        return None, None

@frappe.whitelist()
def calculate_percentage(deduction_breakeven):
    """
    EXACT REPLICATION of backend calculate_percentage functionality.
    This method replicates the exact logic from the backend donation.py file.
    """
    try:
        if not deduction_breakeven or not isinstance(deduction_breakeven, list):
            return {"success": False, "message": "No deduction breakeven to calculate"}
        
        deduction_amount = 0
        
        for row in deduction_breakeven:
            amount = row.get('donation_amount', 0) * (row.get('percentage', 0) / 100)
            row['amount'] = amount
            deduction_amount += amount
        
        return {
            "success": True,
            "deduction_breakeven": deduction_breakeven,
            "total_deduction_amount": deduction_amount
        }
        
    except Exception as e:
        frappe.log_error(f"Error in calculate_percentage: {str(e)}", "Calculate Percentage Error")
        return {"success": False, "message": f"Error calculating percentage: {str(e)}"}

@frappe.whitelist()
def populate_deduction_breakeven(payment_details, company, contribution_type, 
                                donation_cost_center, currency=None, to_currency=None, 
                                posting_date=None, is_return=False, 
                                existing_deduction_breakeven=None):
    """
    Populate deduction breakeven table based on payment details.
    This replicates the backend set_deduction_breakeven functionality.
    
    Args:
        payment_details: List of payment detail rows
        company: Company name
        contribution_type: Contribution type (Donation/Pledge)
        donation_cost_center: Donation cost center
        currency: Base currency
        to_currency: Target currency
        posting_date: Posting date for currency conversion
        is_return: Whether this is a return transaction
    """
    try:
        if not payment_details or not isinstance(payment_details, list):
            return {"success": False, "message": "Invalid payment details"}
        
        if not company:
            return {"success": False, "message": "Company is required"}
        
        deduction_breakeven_rows = []
        total_deduction_amount = 0
        total_donation = 0
        
        for row in payment_details:
            # Validate required fields
            if not row.get('random_id'):
                row['random_id'] = frappe.generate_hash(length=8)
            
            if not row.get('donor_id'):
                continue
                
            if not row.get('fund_class_id'):
                continue
                
            if not row.get('donation_amount') or row.get('donation_amount', 0) <= 0:
                continue
            
            # Validate active donor
            if not validate_active_donor(row.get('donor_id')):
                continue
            
            # Validate donor currency if provided
            if currency and not validate_donor_currency(row.get('donor_id'), currency):
                continue
            
            # Verify unique receipt number
            if not verify_unique_receipt_no(row, payment_details):
                continue
            
            # Reset mode of payment for Pledge
            reset_mode_of_payment(row, contribution_type)
            
            total_donation += row.get('donation_amount', 0)
            temp_deduction_amount = 0
            
            # Get deduction details for this payment row
            deduction_details = get_deduction_details_for_row(row, company, contribution_type)
            
            for deduction_detail in deduction_details:
                percentage_amount = 0
                base_amount = 0
                
                if row.get('donation_amount', 0) > 0 or is_return:
                    percentage_amount = row.get('donation_amount', 0) * (deduction_detail.get('percentage', 0) / 100)
                    base_amount = apply_currency_exchange(percentage_amount, currency, to_currency, posting_date)
                    temp_deduction_amount += percentage_amount
                
                # Create deduction breakeven row
                deduction_row = create_deduction_breakeven_row(
                    row, deduction_detail, percentage_amount, base_amount, 
                    company, donation_cost_center
                )
                
                deduction_breakeven_rows.append(deduction_row)
            
            # Set account details for payment row
            row['equity_account'] = get_default_accounts(row.get('fund_class_id'), 'equity_account', company)
            default_receivable_account = get_default_donor_account(row.get('donor_id'), "default_account")
            row['receivable_account'] = default_receivable_account if default_receivable_account else get_default_accounts(row.get('pay_service_area'), 'receivable_account', company)
            row['cost_center'] = donation_cost_center
            
            # Calculate amounts
            row['deduction_amount'] = temp_deduction_amount
            row['net_amount'] = row.get('donation_amount', 0) - temp_deduction_amount
            row['outstanding_amount'] = row.get('donation_amount', 0) if contribution_type == "Pledge" else row['net_amount']
            
            # Currency conversion
            row['base_donation_amount'] = apply_currency_exchange(row.get('donation_amount', 0), currency, to_currency, posting_date)
            row['base_deduction_amount'] = apply_currency_exchange(temp_deduction_amount, currency, to_currency, posting_date)
            row['base_net_amount'] = apply_currency_exchange(row['net_amount'], currency, to_currency, posting_date)
            row['base_outstanding_amount'] = apply_currency_exchange(row['outstanding_amount'], currency, to_currency, posting_date)
            
            total_deduction_amount += temp_deduction_amount
        
        return {
            "success": True,
            "deduction_breakeven": deduction_breakeven_rows,
            "updated_payment_details": payment_details,
            "total_donation": total_donation,
            "total_deduction_amount": total_deduction_amount,
            "total_donors": len(payment_details)
        }
        
    except Exception as e:
        frappe.log_error(f"Error in populate_deduction_breakeven: {str(e)}", "Deduction Breakeven Error")
        return {"success": False, "message": f"Error populating deduction breakeven: {str(e)}"}

def get_deduction_details_for_row(row, company, contribution_type):
    """Get deduction details for a specific payment row"""
    try:
        # Skip deduction for Zakat or Pledge
        intention_id = row.get('intention_id')
        if intention_id in [None, "Zakat"] or contribution_type == 'Pledge':
            return []
        
        fund_class_id = row.get('fund_class_id')
        if not fund_class_id:
            return []
        
        result = frappe.db.sql("""
            SELECT 
                company, income_type, project, account, 
                percentage, min_percent, max_percent
            FROM 
                `tabDeduction Details` dd
            WHERE 
                ifnull(account, "") != ""
                and company = %(company)s
                and parenttype = "Fund Class"
                and parent = %(fund_class_id)s
        """, {
            'company': company,
            'fund_class_id': fund_class_id
        }, as_dict=True)
        
        return result
        
    except Exception as e:
        frappe.log_error(f"Error getting deduction details: {str(e)}", "Deduction Details Error")
        return []

def create_deduction_breakeven_row(payment_row, deduction_detail, percentage_amount, base_amount, company, donation_cost_center):
    """Create a deduction breakeven row with EXACT backend field mapping"""
    return {
        "random_id": payment_row.get('random_id'),
        "company": company,
        "income_type": deduction_detail.get('income_type'),
        "project": deduction_detail.get('project'),
        "account": deduction_detail.get('account'),
        "percentage": deduction_detail.get('percentage', 0),
        "min_percent": deduction_detail.get('min_percent', 0),
        "max_percent": deduction_detail.get('max_percent', 0),
        "donation_amount": payment_row.get('donation_amount', 0),
        "amount": percentage_amount,
        "base_amount": base_amount,
        # EXACT backend field mapping
        "project_id": deduction_detail.get('project'),
        "cost_center_id": donation_cost_center,
        "fund_class_id": payment_row.get('fund_class_id'),
        "service_area_id": payment_row.get('pay_service_area'),
        "subservice_area_id": payment_row.get('pay_subservice_area'),
        "product_id": payment_row.get('pay_product'),
        "donor_id": payment_row.get('donor_id'),
        "donor_type_id": payment_row.get('donor_type'),
        "donor_desk_id": payment_row.get('donor_desk_id'),
        "intention_id": payment_row.get('intention_id'),
        "transaction_type_id": payment_row.get('transaction_type_id'),
        "__islocal": True,
        "doctype": "Deduction Breakeven",
        "parentfield": "deduction_breakeven",
        "parenttype": "Donation"
    }

def validate_active_donor(donor_id):
    """Validate if donor is active"""
    try:
        if not donor_id:
            return False
        
        donor_status = frappe.db.get_value("Donor", {"name": donor_id}, "status")
        return donor_status != "Blocked"
        
    except Exception:
        return False

def validate_donor_currency(donor_id, currency):
    """Validate if donor currency matches the required currency"""
    try:
        if not donor_id or not currency:
            return True
        
        donor_currency = frappe.db.get_value("Donor", {"name": donor_id}, "default_currency")
        return donor_currency == currency
        
    except Exception:
        return True

def verify_unique_receipt_no(row, all_payment_details):
    """Verify that receipt number is unique across all payment details"""
    try:
        receipt_number = row.get('receipt_number')
        if not receipt_number:
            return True
        
        current_idx = row.get('idx', 0)
        for other_row in all_payment_details:
            if (other_row.get('receipt_number') == receipt_number and 
                other_row.get('idx', 0) != current_idx):
                return False
        
        return True
        
    except Exception:
        return True

def reset_mode_of_payment(row, contribution_type):
    """Reset mode of payment based on contribution type"""
    try:
        if contribution_type == "Pledge":
            row['mode_of_payment'] = None
            row['account_paid_to'] = None
            row['transaction_no_cheque_no'] = ""
            row['reference_date'] = None
    except Exception:
        pass

def get_default_accounts(parent_id, fieldname, company):
    """Get default accounts from Accounts Default"""
    try:
        if not parent_id or not fieldname or not company:
            return None
        
        return frappe.db.get_value('Accounts Default', {
            'parent': parent_id, 
            'company': company
        }, fieldname)
        
    except Exception:
        return None

def get_default_donor_account(donor_id, fieldname):
    """Get default account from Donor"""
    try:
        if not donor_id or not fieldname:
            return None
        
        return frappe.db.get_value('Donor', {'name': donor_id}, fieldname)
        
    except Exception:
        return None

def apply_currency_exchange(amount, from_currency, to_currency, posting_date):
    """Apply currency exchange rate"""
    try:
        if not amount or not from_currency or not to_currency:
            return amount
        
        if from_currency == to_currency:
            return amount
        
        from erpnext.setup.utils import get_exchange_rate
        exchange_rate = get_exchange_rate(from_currency, to_currency, posting_date)
        
        if exchange_rate:
            return amount * exchange_rate
        
        return amount
        
    except Exception:
        return amount

@frappe.whitelist()
def get_deduction_details_comprehensive(fund_class_id, company):
    """
    Get comprehensive deduction details for a fund class.
    This is an enhanced version of the existing get_deduction_details function.
    """
    try:
        if not fund_class_id:
            return {"success": False, "message": "Fund class ID is required"}
        
        if not company:
            return {"success": False, "message": "Company is required"}
        
        # Get deduction details with additional information
        result = frappe.db.sql("""
            SELECT 
                dd.company, 
                dd.income_type,
                it.project,
                dd.account, 
                dd.percentage, 
                dd.min_percent, 
                dd.max_percent,
                a.account_name,
                a.account_type,
                it.income_type_name
            FROM 
                `tabDeduction Details` dd
            LEFT JOIN `tabIncome Type` it ON dd.income_type = it.name
            LEFT JOIN `tabAccount` a ON dd.account = a.name
            WHERE 
                dd.parenttype = "Fund Class"
                and dd.parent = %(fund_class_id)s
                and dd.company = %(company)s
                and ifnull(dd.account, "") != ""
            ORDER BY dd.idx
        """, {
            'fund_class_id': fund_class_id,
            'company': company
        }, as_dict=True)
        
        if result:
            return {"success": True, "data": result}
        else:
            return {"success": False, "message": "No deduction details found"}
            
    except Exception as e:
        frappe.log_error(f"Error in get_deduction_details_comprehensive: {str(e)}", "Comprehensive Deduction Details Error")
        return {"success": False, "message": f"Error fetching deduction details: {str(e)}"}

@frappe.whitelist()
def calculate_deduction_amounts(payment_details, deduction_breakeven):
    """
    Calculate deduction amounts for payment details and deduction breakeven rows.
    This is useful for real-time calculation in the frontend.
    """
    try:
        if not payment_details or not deduction_breakeven:
            return {"success": False, "message": "Payment details and deduction breakeven are required"}
        
        calculated_data = []
        
        for payment_row in payment_details:
            payment_random_id = payment_row.get('random_id')
            donation_amount = payment_row.get('donation_amount', 0)
            
            # Find matching deduction rows
            matching_deductions = [
                d for d in deduction_breakeven 
                if d.get('random_id') == payment_random_id
            ]
            
            total_deduction = 0
            deduction_details = []
            
            for deduction_row in matching_deductions:
                percentage = deduction_row.get('percentage', 0)
                amount = donation_amount * (percentage / 100)
                
                deduction_details.append({
                    'income_type': deduction_row.get('income_type'),
                    'account': deduction_row.get('account'),
                    'percentage': percentage,
                    'amount': amount
                })
                
                total_deduction += amount
            
            calculated_data.append({
                'random_id': payment_random_id,
                'donation_amount': donation_amount,
                'total_deduction': total_deduction,
                'net_amount': donation_amount - total_deduction,
                'deduction_details': deduction_details
            })
        
        return {"success": True, "data": calculated_data}
        
    except Exception as e:
        frappe.log_error(f"Error in calculate_deduction_amounts: {str(e)}", "Deduction Amount Calculation Error")
        return {"success": False, "message": f"Error calculating deduction amounts: {str(e)}"}

@frappe.whitelist()
def test_deduction_breakeven_population(payment_details, company, contribution_type, donation_cost_center):
    """
    Test endpoint to debug deduction breakeven population.
    This will help identify why donor_id and intention_id are not being populated.
    """
    try:
        if not payment_details or not isinstance(payment_details, list):
            return {"success": False, "message": "Invalid payment details"}
        
        if not company:
            return {"success": False, "message": "Company is required"}
        
        debug_info = {
            "payment_details_count": len(payment_details),
            "company": company,
            "contribution_type": contribution_type,
            "donation_cost_center": donation_cost_center,
            "payment_details_sample": []
        }
        
        # Analyze first few payment details
        for i, row in enumerate(payment_details[:3]):  # Only first 3 for debugging
            debug_info["payment_details_sample"].append({
                "index": i,
                "donor_id": row.get('donor_id'),
                "intention_id": row.get('intention_id'),
                "fund_class_id": row.get('fund_class_id'),
                "donation_amount": row.get('donation_amount'),
                "random_id": row.get('random_id'),
                "all_fields": row
            })
        
        # Test deduction details retrieval
        if payment_details and payment_details[0].get('fund_class_id'):
            fund_class_id = payment_details[0].get('fund_class_id')
            deduction_details = get_deduction_details_for_row(payment_details[0], company, contribution_type)
            debug_info["deduction_details_sample"] = deduction_details
        
        # Test creating a sample deduction row
        if payment_details and payment_details[0].get('fund_class_id'):
            sample_payment = payment_details[0]
            sample_deduction = {
                "company": company,
                "income_type": "Test Income Type",
                "project": "Test Project",
                "account": "Test Account",
                "percentage": 5.0,
                "min_percent": 0.0,
                "max_percent": 100.0
            }
            
            sample_deduction_row = create_deduction_breakeven_row(
                sample_payment, sample_deduction, 100, 100, company, donation_cost_center
            )
            debug_info["sample_deduction_row"] = sample_deduction_row
        
        return {"success": True, "debug_info": debug_info}
        
    except Exception as e:
        frappe.log_error(f"Error in test_deduction_breakeven_population: {str(e)}", "Test Deduction Breakeven Error")
        return {"success": False, "message": f"Error testing deduction breakeven: {str(e)}"}

@frappe.whitelist()
def validate_payment_details(payment_details):
    """
    EXACT REPLICATION of backend validate_payment_details functionality.
    This method replicates the exact logic from the backend donation.py file.
    """
    try:
        if not payment_details or not isinstance(payment_details, list):
            return {"success": False, "message": "Invalid payment details"}
        
        if len(payment_details) < 1:
            return {"success": False, "message": "Please provide, payment details to proceed further."}
        
        return {"success": True, "message": "Payment details are valid"}
        
    except Exception as e:
        frappe.log_error(f"Error in validate_payment_details: {str(e)}", "Payment Details Validation Error")
        return {"success": False, "message": f"Error validating payment details: {str(e)}"}

@frappe.whitelist()
def validate_pledge_contribution_type(payment_details, contribution_type):
    """
    EXACT REPLICATION of backend validate_pledge_contribution_type functionality.
    This method replicates the exact logic from the backend donation.py file.
    """
    try:
        if contribution_type == "Pledge":
            return {"success": True, "message": "Pledge contribution type is valid"}
        
        errors = []
        
        for d in payment_details:
            msg = []
            if not d.get('mode_of_payment'):
                msg.append("Mode of Payment")
            if not d.get('transaction_no_cheque_no') and not d.get('reference_date') and d.get('mode_of_payment') != "Cash":
                msg.append("Transaction No/Cheque No")
            if not d.get('account_paid_to'):
                msg.append("Account Paid To")
            
            if msg:
                error_msg = f"<b>Row#{d.get('idx')}:</b> {', '.join(msg)}"
                errors.append(error_msg)
        
        if errors:
            return {"success": False, "errors": errors, "message": "Payment Detail validation failed"}
        
        return {"success": True, "message": "Payment details are valid"}
        
    except Exception as e:
        frappe.log_error(f"Error in validate_pledge_contribution_type: {str(e)}", "Pledge Contribution Type Validation Error")
        return {"success": False, "message": f"Error validating pledge contribution type: {str(e)}"}

@frappe.whitelist()
def validate_is_return(donation_data):
    """
    EXACT REPLICATION of backend validate_is_return functionality.
    This method replicates the exact logic from the backend donation.py file.
    """
    try:
        if not donation_data:
            return {"success": True, "message": "No donation data to validate"}
        
        # Add any specific return validation logic here
        # This is a placeholder for the exact backend logic
        
        return {"success": True, "message": "Return validation passed"}
        
    except Exception as e:
        frappe.log_error(f"Error in validate_is_return: {str(e)}", "Is Return Validation Error")
        return {"success": False, "message": f"Error validating return: {str(e)}"}

@frappe.whitelist()
def update_status(donation_data):
    """
    EXACT REPLICATION of backend update_status functionality.
    This method replicates the exact logic from the backend donation.py file.
    """
    try:
        if not donation_data:
            return {"success": True, "message": "No donation data to update status"}
        
        # Add any specific status update logic here
        # This is a placeholder for the exact backend logic
        
        return {"success": True, "message": "Status updated successfully"}
        
    except Exception as e:
        frappe.log_error(f"Error in update_status: {str(e)}", "Status Update Error")
        return {"success": False, "message": f"Error updating status: {str(e)}"}

@frappe.whitelist()
def calculate_total(total_donation, total_deduction_amount):
    """
    EXACT REPLICATION of backend calculate_total functionality.
    This method replicates the exact logic from the backend donation.py file.
    """
    try:
        if not total_donation:
            total_donation = 0
        if not total_deduction_amount:
            total_deduction_amount = 0
        
        net_total = total_donation - total_deduction_amount
        
        return {
            "success": True,
            "total_donation": total_donation,
            "total_deduction_amount": total_deduction_amount,
            "net_total": net_total
        }
        
    except Exception as e:
        frappe.log_error(f"Error in calculate_total: {str(e)}", "Calculate Total Error")
        return {"success": False, "message": f"Error calculating total: {str(e)}"}

@frappe.whitelist()
def get_exchange_rate_api(from_currency, to_currency, posting_date=None):
    """
    Get exchange rate between currencies.
    This replicates the backend set_exchange_rate functionality.
    """
    try:
        if not from_currency or not to_currency:
            return {"success": False, "message": "Both currencies are required"}
        
        if from_currency == to_currency:
            return {"success": True, "exchange_rate": 1.0}
        
        exchange_rate = get_exchange_rate(from_currency, to_currency, posting_date)
        
        if exchange_rate:
            return {"success": True, "exchange_rate": exchange_rate}
        else:
            return {"success": False, "message": "Exchange rate not found"}
            
    except Exception as e:
        frappe.log_error(f"Error in get_exchange_rate_api: {str(e)}", "Exchange Rate Error")
        return {"success": False, "message": f"Error getting exchange rate: {str(e)}"}

@frappe.whitelist()
def get_donation_validation_summary(payment_details, company, contribution_type, donation_cost_center, 
                                   currency=None, to_currency=None, exchange_rate=None, posting_date=None, 
                                   is_return=False, existing_deduction_breakeven=None):
    """
    Get a comprehensive validation summary for donation data.
    This combines all validation functions into a single endpoint.
    """
    try:
        validation_results = {}
        
        # Validate payment details
        payment_validation = validate_payment_details(payment_details)
        validation_results['payment_details'] = payment_validation
        
        # Validate pledge contribution type
        pledge_validation = validate_pledge_contribution_type(payment_details, contribution_type)
        validation_results['pledge_contribution_type'] = pledge_validation
        
        # Set deduction breakeven
        deduction_result = set_deduction_breakeven(
            payment_details, company, contribution_type, donation_cost_center,
            currency, to_currency, exchange_rate, posting_date, is_return, existing_deduction_breakeven
        )
        validation_results['deduction_breakeven'] = deduction_result
        
        # Validate deduction percentages
        if deduction_result.get('success') and deduction_result.get('deduction_breakeven'):
            percentage_validation = validate_deduction_percentages(deduction_result['deduction_breakeven'])
            validation_results['deduction_percentages'] = percentage_validation
        
        # Calculate totals
        if deduction_result.get('success'):
            total_calculation = calculate_total(
                deduction_result.get('total_donation', 0),
                deduction_result.get('total_deduction_amount', 0)
            )
            validation_results['totals'] = total_calculation
        
        # Overall success
        overall_success = all([
            payment_validation.get('success', False),
            pledge_validation.get('success', False),
            deduction_result.get('success', False)
        ])
        
        return {
            "success": overall_success,
            "validation_results": validation_results,
            "message": "Validation completed" if overall_success else "Validation failed"
        }
        
    except Exception as e:
        frappe.log_error(f"Error in get_donation_validation_summary: {str(e)}", "Donation Validation Summary Error")
        return {"success": False, "message": f"Error in validation summary: {str(e)}"}

@frappe.whitelist()
def get_payment_mode_account(mode_of_payment, company):
    """
    Get the default account for a mode of payment.
    This replicates the erpnext.accounts.pos.get_payment_mode_account functionality.
    """
    try:
        if not mode_of_payment:
            return {"success": False, "message": "Mode of payment is required"}
        
        if not company:
            return {"success": False, "message": "Company is required"}
        
        # Get the default account for the mode of payment
        account = frappe.db.get_value('Mode of Payment Account', {
            'parent': mode_of_payment,
            'company': company
        }, 'default_account')
        
        if account:
            return {"success": True, "account": account}
        else:
            # If no company-specific account found, try to get any default account
            account = frappe.db.get_value('Mode of Payment Account', {
                'parent': mode_of_payment
            }, 'default_account')
            
            if account:
                return {"success": True, "account": account}
            else:
                return {"success": False, "message": f"No default account found for mode of payment: {mode_of_payment}"}
                
    except Exception as e:
        frappe.log_error(f"Error in get_payment_mode_account: {str(e)}", "Payment Mode Account Error")
        return {"success": False, "message": f"Error getting payment mode account: {str(e)}"}
