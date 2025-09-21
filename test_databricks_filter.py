import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from databricks_client import databricks_client
import traceback

def test_filter_query():
    print("🔍 Testing filter options query directly...")
    
    try:
        # The exact query from the backend
        filter_query = """
        WITH investment_data AS (
            SELECT DISTINCT
                INV_MARKET,
                INV_FUNCTION,
                INV_TIER
            FROM uc_prod_cgf_mdip_01.poi_edw_business_view.clrty_task_v 
            WHERE INV_MARKET IS NOT NULL 
            AND INV_MARKET != ''
            AND CLRTY_INV_TYPE IN ('Non-Clarity item', 'Project', 'Programs')
        )
        SELECT DISTINCT
            SPLIT(INV_MARKET, '/')[0] as region,
            SPLIT(INV_MARKET, '/')[1] as market,
            INV_FUNCTION as function,
            CAST(INV_TIER as STRING) as tier
        FROM investment_data
        WHERE INV_MARKET IS NOT NULL AND INV_MARKET != ''
        LIMIT 10
        """
        
        print("Query to execute:")
        print(filter_query)
        print()
        
        # Execute query
        results = databricks_client.execute_query(filter_query)
        
        print(f"✅ Query executed successfully! Got {len(results)} results:")
        for i, row in enumerate(results):
            print(f"  Row {i+1}: {row}")
        
        # Process results like the backend does
        regions = set()
        markets = set() 
        functions = set()
        tiers = set()
        
        for row in results:
            if row.get('region'):
                regions.add(row['region'])
            if row.get('market'):
                markets.add(row['market'])
            if row.get('function'):
                functions.add(row['function'])
            if row.get('tier'):
                tiers.add(row['tier'])
        
        print(f"\nProcessed results:")
        print(f"  - Regions: {sorted(list(regions))}")
        print(f"  - Markets: {sorted(list(markets))}")
        print(f"  - Functions: {sorted(list(functions))}")
        print(f"  - Tiers: {sorted(list(tiers))}")
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        print("Full traceback:")
        print(traceback.format_exc())

if __name__ == "__main__":
    test_filter_query()