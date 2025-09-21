#!/usr/bin/env python3
"""
Generate portfolio data JSON file from live Databricks database
Only includes records where COE_ROADMAP_TYPE = 'Portfolio'
"""

import json
import os
import sys
from datetime import datetime
from databricks_client import DatabricksClient

def generate_portfolio_json():
    """Generate JSON file with live portfolio data from Databricks"""
    
    print("🚀 Starting live portfolio data generation...")
    
    # Initialize Databricks client
    client = DatabricksClient()
    
    try:
        # Connect to database
        print("📡 Connecting to Databricks...")
        client.connect()
        
        # Read hierarchy query
        hierarchy_query_path = os.path.join(os.path.dirname(__file__), 'sql_queries', 'hierarchy_query.sql')
        with open(hierarchy_query_path, 'r') as f:
            hierarchy_query = f.read()
        
        # Read investment query  
        investment_query_path = os.path.join(os.path.dirname(__file__), 'sql_queries', 'investment_query.sql')
        with open(investment_query_path, 'r') as f:
            investment_query = f.read()
        
        print("📊 Executing hierarchy query...")
        # Execute hierarchy query without automatic LIMIT
        hierarchy_data = client.execute_query_unlimited(hierarchy_query, timeout=900, use_cache=False)
        print(f"✅ Hierarchy query completed: {len(hierarchy_data)} records")
        
        print("📊 Executing investment query...")
        # Execute investment query without automatic LIMIT  
        investment_data = client.execute_query_unlimited(investment_query, timeout=900, use_cache=False)
        print(f"✅ Investment query completed: {len(investment_data)} records")
        
        # Filter for Portfolio records only
        portfolio_hierarchy = [
            record for record in hierarchy_data 
            if record.get('COE_ROADMAP_TYPE') == 'Portfolio'
        ]
        
        print(f"🎯 Found {len(portfolio_hierarchy)} Portfolio records in hierarchy")
        
        # Extract Portfolio IDs to filter investment data
        portfolio_ids = {record['CHILD_ID'] for record in portfolio_hierarchy}
        
        # Filter investment data for Portfolio IDs only
        portfolio_investments = [
            record for record in investment_data 
            if record.get('INV_EXT_ID') in portfolio_ids
        ]
        
        print(f"💰 Found {len(portfolio_investments)} investment records for Portfolio IDs")
        
        # Create the structured data format matching the API response
        portfolio_data = {
            "status": "success",
            "message": f"Portfolio data generated from live database on {datetime.now().isoformat()}",
            "timestamp": datetime.now().isoformat(),
            "data": {
                "hierarchy": portfolio_hierarchy,
                "investment": portfolio_investments
            },
            "metadata": {
                "total_portfolio_records": len(portfolio_hierarchy),
                "total_investment_records": len(portfolio_investments),
                "unique_portfolio_ids": len(portfolio_ids),
                "generation_method": "live_databricks_query",
                "query_files": ["hierarchy_query.sql", "investment_query.sql"],
                "filter_criteria": "COE_ROADMAP_TYPE = 'Portfolio'"
            }
        }
        
        # Write to JSON file
        output_file = 'portfolio_live_data.json'
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(portfolio_data, f, indent=2, default=str, ensure_ascii=False)
        
        print(f"✅ Portfolio data saved to {output_file}")
        print(f"📈 Summary:")
        print(f"   - Portfolio hierarchy records: {len(portfolio_hierarchy)}")
        print(f"   - Portfolio investment records: {len(portfolio_investments)}")
        print(f"   - Unique Portfolio IDs: {len(portfolio_ids)}")
        
        # Print sample of Portfolio IDs found
        sample_portfolios = list(portfolio_ids)[:10]
        print(f"🔍 Sample Portfolio IDs: {sample_portfolios}")
        
        # Print sample portfolio names
        sample_names = [
            f"{record['CHILD_ID']}: {record['CHILD_NAME']}" 
            for record in portfolio_hierarchy[:5]
        ]
        print(f"📝 Sample Portfolio Names:")
        for name in sample_names:
            print(f"   - {name}")
        
        return output_file
        
    except Exception as e:
        print(f"❌ Error generating portfolio data: {str(e)}")
        raise
    finally:
        client.disconnect()

if __name__ == "__main__":
    try:
        output_file = generate_portfolio_json()
        print(f"\n🎉 Successfully generated {output_file}")
        print("📁 File contains live Portfolio data from Databricks database")
        print("🔧 Use this data to fix PortfolioGanttChart rendering issues")
    except Exception as e:
        print(f"\n💥 Failed to generate portfolio data: {str(e)}")
        sys.exit(1)
