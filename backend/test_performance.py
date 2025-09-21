#!/usr/bin/env python3
"""
Quick performance test for API endpoints
"""
import time
import requests
import json

BASE_URL = "http://localhost:5000"

def test_endpoint(endpoint, description):
    """Test an endpoint and measure response time."""
    print(f"\n🧪 Testing {description}...")
    print(f"📍 Endpoint: {endpoint}")
    
    start_time = time.time()
    
    try:
        response = requests.get(f"{BASE_URL}{endpoint}", timeout=1800)  # 30 minute timeout
        end_time = time.time()
        
        elapsed = end_time - start_time
        
        if response.status_code == 200:
            data = response.json()
            if 'count' in data:
                print(f"✅ Success: {data['count']} records in {elapsed:.2f} seconds")
            else:
                print(f"✅ Success in {elapsed:.2f} seconds")
            
            if 'data' in data:
                print(f"📊 Sample data keys: {list(data['data'][0].keys()) if data['data'] else 'No data'}")
        else:
            print(f"❌ Failed: HTTP {response.status_code}")
            print(f"🔍 Response: {response.text}")
            
    except requests.exceptions.Timeout:
        print(f"⏰ Timeout after 30 minutes")
    except Exception as e:
        print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    print("🚀 PMO Portfolio API Performance Test")
    print("=" * 50)
    
    # Test health first
    test_endpoint("/api/health", "Health Check")
    
    # Test connection
    test_endpoint("/api/test-connection", "Databricks Connection")
    
    # Test hierarchy data (smaller query)
    test_endpoint("/api/hierarchy_data", "Hierarchy Data (311 line query)")
    
    # Test investment data (larger query)  
    test_endpoint("/api/investment_data", "Investment Data (785 line query)")
    
    print("\n" + "=" * 50)
    print("🏁 Performance test completed!")
