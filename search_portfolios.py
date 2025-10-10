"""
Script to search for portfolio names in the database.
"""
import requests
import json

# Backend API URL
BACKEND_URL = "http://localhost:5000"

def search_portfolios(search_term=""):
    """
    Search for portfolios by name.
    
    Args:
        search_term: Term to search for in portfolio names (empty = show all)
    
    Returns:
        List of unique portfolio names
    """
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
        
        # Extract investment data
        investment_data = data.get('data', {}).get('investment', [])
        print(f"✅ Retrieved {len(investment_data)} total investment records\n")
        
        # Get unique portfolio/investment names
        unique_names = set()
        for record in investment_data:
            inv_name = record.get('INVESTMENT_NAME', '')
            inv_type = record.get('CLRTY_INV_TYPE', '')
            if inv_name:
                unique_names.add((inv_name, inv_type))
        
        # Filter by search term if provided
        if search_term:
            filtered_names = [(name, inv_type) for name, inv_type in unique_names 
                            if search_term.lower() in name.lower()]
            print(f"🔍 Found {len(filtered_names)} names containing '{search_term}':\n")
            results = sorted(filtered_names)
        else:
            print(f"📋 Found {len(unique_names)} unique investment names:\n")
            results = sorted(unique_names)
        
        # Display results grouped by type
        portfolios = [name for name, inv_type in results if inv_type == 'Portfolios']
        programs = [name for name, inv_type in results if inv_type == 'Programs']
        projects = [name for name, inv_type in results if inv_type == 'Project']
        
        if portfolios:
            print(f"📁 PORTFOLIOS ({len(portfolios)}):")
            for name in portfolios:
                print(f"  - {name}")
            print()
        
        if programs:
            print(f"📂 PROGRAMS ({len(programs)}):")
            for i, name in enumerate(programs, 1):
                print(f"  {i}. {name}")
            print()
        
        if projects:
            print(f"📄 PROJECTS ({len(projects)}):")
            print(f"  (Showing first 20 of {len(projects)})")
            for name in projects[:20]:
                print(f"  - {name}")
            print()
        
        return results
        
    except requests.exceptions.ConnectionError:
        print(f"❌ Could not connect to backend at {BACKEND_URL}")
        return None
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return None


def main():
    """Main function."""
    print(f"{'='*80}")
    print(f"SEARCHING FOR PORTFOLIOS AND INVESTMENTS")
    print(f"{'='*80}\n")
    
    # First search for anything with "order" in the name
    print("🔍 Searching for investments containing 'order'...\n")
    results = search_portfolios("order")
    
    if results:
        print(f"\n{'='*80}")
        print("💡 Use one of these names exactly in fetch_milestones.py")
        print(f"{'='*80}\n")


if __name__ == "__main__":
    main()
