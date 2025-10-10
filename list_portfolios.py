"""
Script to list all portfolios in the database.
"""
import requests
import json

# Backend API URL
BACKEND_URL = "http://localhost:5000"

def list_all_portfolios():
    """List all portfolios in the database."""
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
        
        # Get unique portfolios only
        portfolios = set()
        for record in investment_data:
            inv_name = record.get('INVESTMENT_NAME', '')
            inv_type = record.get('CLRTY_INV_TYPE', '')
            if inv_type == 'Portfolios' and inv_name:
                portfolios.add(inv_name)
        
        print(f"📁 FOUND {len(portfolios)} PORTFOLIOS:\n")
        for i, portfolio in enumerate(sorted(portfolios), 1):
            print(f"{i}. {portfolio}")
        
        return sorted(portfolios)
        
    except requests.exceptions.ConnectionError:
        print(f"❌ Could not connect to backend at {BACKEND_URL}")
        return None
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return None


def main():
    """Main function."""
    print(f"{'='*80}")
    print(f"LISTING ALL PORTFOLIOS")
    print(f"{'='*80}\n")
    
    portfolios = list_all_portfolios()
    
    if portfolios:
        print(f"\n{'='*80}")
        print("💡 Copy the exact portfolio name to use in fetch_milestones.py")
        print(f"{'='*80}\n")


if __name__ == "__main__":
    main()
