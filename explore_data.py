"""
Script to explore the database structure and find Portfolio Order Management.
"""
import requests
import json

# Backend API URL
BACKEND_URL = "http://localhost:5000"

def explore_data():
    """Explore the database structure."""
    try:
        # Fetch full data from backend
        print(f"🔍 Fetching data from backend...")
        data_response = requests.get(f"{BACKEND_URL}/api/data", timeout=120)
        
        if data_response.status_code != 200:
            print(f"❌ Failed to fetch data: {data_response.status_code}")
            return None
        
        data = data_response.json()
        
        if data.get('status') != 'success':
            print(f"❌ API returned error: {data.get('message')}")
            return None
        
        # Extract both hierarchy and investment data
        hierarchy_data = data.get('data', {}).get('hierarchy', [])
        investment_data = data.get('data', {}).get('investment', [])
        
        print(f"✅ Retrieved {len(hierarchy_data)} hierarchy records")
        print(f"✅ Retrieved {len(investment_data)} investment records\n")
        
        # Check investment types
        inv_types = set()
        for record in investment_data:
            inv_type = record.get('CLRTY_INV_TYPE', '')
            if inv_type:
                inv_types.add(inv_type)
        
        print(f"📊 Investment Types Found: {sorted(inv_types)}\n")
        
        # Check hierarchy for portfolios
        print(f"{'='*80}")
        print("CHECKING HIERARCHY DATA FOR PORTFOLIOS")
        print(f"{'='*80}\n")
        
        roadmap_types = set()
        portfolio_names = set()
        
        for record in hierarchy_data:
            roadmap_type = record.get('COE_ROADMAP_TYPE', '')
            child_name = record.get('CHILD_NAME', '')
            
            if roadmap_type:
                roadmap_types.add(roadmap_type)
            
            if roadmap_type == 'Portfolio':
                portfolio_names.add(child_name)
        
        print(f"📊 Roadmap Types: {sorted(roadmap_types)}\n")
        
        if portfolio_names:
            print(f"📁 FOUND {len(portfolio_names)} PORTFOLIOS IN HIERARCHY:\n")
            for i, portfolio in enumerate(sorted(portfolio_names), 1):
                print(f"{i}. {portfolio}")
        else:
            print("❌ No portfolios found in hierarchy data")
        
        # Search for "Order Management" specifically
        print(f"\n{'='*80}")
        print("SEARCHING FOR 'ORDER MANAGEMENT' IN HIERARCHY")
        print(f"{'='*80}\n")
        
        order_mgmt_records = []
        for record in hierarchy_data:
            child_name = record.get('CHILD_NAME', '')
            if 'order' in child_name.lower() and 'management' in child_name.lower():
                order_mgmt_records.append(record)
        
        if order_mgmt_records:
            print(f"✅ Found {len(order_mgmt_records)} records with 'Order Management':\n")
            for i, record in enumerate(order_mgmt_records, 1):
                print(f"{i}. {record.get('CHILD_NAME')}")
                print(f"   Type: {record.get('COE_ROADMAP_TYPE')}")
                print(f"   ID: {record.get('CHILD_ID')}")
                print(f"   Parent: {record.get('PARENT_NAME', 'N/A')}")
                print()
        else:
            print("❌ No records found with 'Order Management'")
        
        # Also search in investment data
        print(f"{'='*80}")
        print("SEARCHING FOR 'ORDER MANAGEMENT' IN INVESTMENTS")
        print(f"{'='*80}\n")
        
        order_mgmt_investments = []
        for record in investment_data:
            inv_name = record.get('INVESTMENT_NAME', '')
            if 'order' in inv_name.lower() and 'management' in inv_name.lower():
                order_mgmt_investments.append(record)
        
        if order_mgmt_investments:
            print(f"✅ Found {len(order_mgmt_investments)} investment records with 'Order Management'")
            
            # Get unique investment names
            unique_names = set()
            for record in order_mgmt_investments:
                inv_name = record.get('INVESTMENT_NAME', '')
                inv_type = record.get('CLRTY_INV_TYPE', '')
                inv_id = record.get('INV_EXT_ID', '')
                if inv_name:
                    unique_names.add((inv_name, inv_type, inv_id))
            
            print(f"\n📋 Unique Investments ({len(unique_names)}):\n")
            for name, inv_type, inv_id in sorted(unique_names):
                print(f"  - {name}")
                print(f"    Type: {inv_type}, ID: {inv_id}")
                
                # Count milestones for this investment
                milestones = [r for r in order_mgmt_investments 
                            if r.get('INVESTMENT_NAME') == name 
                            and 'milestone' in r.get('ROADMAP_ELEMENT', '').lower()]
                print(f"    Milestones: {len(milestones)}")
                print()
        
        return True
        
    except requests.exceptions.ConnectionError:
        print(f"❌ Could not connect to backend at {BACKEND_URL}")
        return None
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return None


def main():
    """Main function."""
    print(f"{'='*80}")
    print(f"EXPLORING DATABASE STRUCTURE")
    print(f"{'='*80}\n")
    
    explore_data()


if __name__ == "__main__":
    main()
