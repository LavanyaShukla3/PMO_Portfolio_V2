"""
Script to fetch all milestones for Portfolio Order Management from the backend.
"""
import requests
import json
import sys

# Backend API URL
BACKEND_URL = "http://localhost:5000"

def fetch_milestones_for_portfolio(portfolio_name):
    """
    Fetch all milestone data for a specific portfolio.
    
    Args:
        portfolio_name: The name of the portfolio to filter (e.g., "Portfolio Order Management")
    
    Returns:
        List of milestone records
    """
    try:
        # First, test if backend is running
        print(f"🔍 Testing backend connection...")
        health_response = requests.get(f"{BACKEND_URL}/api/health", timeout=5)
        
        if health_response.status_code != 200:
            print(f"❌ Backend health check failed: {health_response.status_code}")
            return None
        
        print(f"✅ Backend is running: {health_response.json()}")
        
        # Fetch full data from backend
        print(f"\n🔍 Fetching data from backend...")
        data_response = requests.get(f"{BACKEND_URL}/api/data", timeout=120)
        
        if data_response.status_code != 200:
            print(f"❌ Failed to fetch data: {data_response.status_code}")
            print(f"Response: {data_response.text}")
            return None
        
        data = data_response.json()
        
        if data.get('status') != 'success':
            print(f"❌ API returned error: {data.get('message')}")
            return None
        
        # Extract investment data
        investment_data = data.get('data', {}).get('investment', [])
        print(f"✅ Retrieved {len(investment_data)} total investment records")
        
        # Filter for the specific portfolio and milestones only
        milestones = []
        portfolio_records = []
        
        for record in investment_data:
            inv_name = record.get('INVESTMENT_NAME', '')
            roadmap_element = record.get('ROADMAP_ELEMENT', '')
            
            # Check if this record belongs to the target portfolio
            if portfolio_name.lower() in inv_name.lower():
                portfolio_records.append(record)
                
                # Check if this is a milestone record
                if 'milestone' in roadmap_element.lower():
                    milestones.append(record)
        
        print(f"\n📊 Found {len(portfolio_records)} total records for '{portfolio_name}'")
        print(f"🎯 Found {len(milestones)} milestone records for '{portfolio_name}'")
        
        return milestones
        
    except requests.exceptions.ConnectionError:
        print(f"❌ Could not connect to backend at {BACKEND_URL}")
        print(f"💡 Make sure the backend is running. You can start it with: python backend/app.py")
        return None
    except requests.exceptions.Timeout:
        print(f"❌ Request timed out. The backend might be processing a large dataset.")
        return None
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return None


def print_milestones_json(milestones):
    """Print milestones in formatted JSON."""
    if not milestones:
        print("\n📭 No milestones found.")
        return
    
    print(f"\n{'='*80}")
    print(f"MILESTONES JSON RESPONSE ({len(milestones)} records)")
    print(f"{'='*80}\n")
    
    # Pretty print the JSON
    print(json.dumps(milestones, indent=2, default=str))
    
    # Also print a summary
    print(f"\n{'='*80}")
    print("MILESTONE SUMMARY")
    print(f"{'='*80}\n")
    
    for i, milestone in enumerate(milestones, 1):
        print(f"{i}. {milestone.get('TASK_NAME', 'Unknown')}")
        print(f"   Portfolio: {milestone.get('INVESTMENT_NAME', 'Unknown')}")
        print(f"   Type: {milestone.get('ROADMAP_ELEMENT', 'Unknown')}")
        print(f"   Start: {milestone.get('TASK_START', 'N/A')}")
        print(f"   Finish: {milestone.get('TASK_FINISH', 'N/A')}")
        print(f"   Status: {milestone.get('MILESTONE_STATUS', 'N/A')}")
        print()


def main():
    """Main function."""
    portfolio_name = "Portfolio Order Management"
    
    print(f"{'='*80}")
    print(f"FETCHING MILESTONES FOR: {portfolio_name}")
    print(f"{'='*80}\n")
    
    milestones = fetch_milestones_for_portfolio(portfolio_name)
    
    if milestones is not None:
        print_milestones_json(milestones)
        
        # Save to file
        output_file = "portfolio_order_management_milestones.json"
        with open(output_file, 'w') as f:
            json.dump(milestones, f, indent=2, default=str)
        print(f"\n💾 Results saved to: {output_file}")
    else:
        print("\n❌ Failed to fetch milestones. Please check the error messages above.")
        sys.exit(1)


if __name__ == "__main__":
    main()
