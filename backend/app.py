"""
Flask API server for PMO Portfolio application.
Provides endpoints to fetch data from Azure Databricks.
Enhanced with caching, pagination, and progressive loading support.
"""
import os
import logging
import json
from typing import Dict, Any, Optional
from flask import Flask, jsonify, request
from flask_cors import CORS
from databricks_client import databricks_client
from cache_service import cache_service
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)

# Configure CORS
frontend_urls = [
    os.getenv('FRONTEND_URL', 'http://localhost:3000'),
    'http://localhost:3001'  # Additional port for development
]
CORS(app, origins=frontend_urls)

# SQL query file paths
SQL_QUERIES_DIR = os.path.join(os.path.dirname(__file__), 'sql_queries')
HIERARCHY_QUERY_FILE = os.path.join(SQL_QUERIES_DIR, 'hierarchy_query.sql')
INVESTMENT_QUERY_FILE = os.path.join(SQL_QUERIES_DIR, 'investment_query.sql')


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'message': 'PMO Portfolio API is running',
        'version': '1.0.0',
        'mode': 'databricks'
    })


@app.route('/api/test-connection', methods=['GET'])
def test_databricks_connection():
    """Test Databricks connection endpoint."""
    
    try:
        is_connected = databricks_client.test_connection()
        
        if is_connected:
            return jsonify({
                'status': 'success',
                'message': 'Databricks connection successful',
                'mode': 'databricks'
            })
        else:
            return jsonify({
                'status': 'error',
                'message': 'Databricks connection failed',
                'mode': 'databricks'
            }), 500
            
    except Exception as e:
        logger.error(f"Connection test error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Connection test failed: {str(e)}',
            'mode': 'databricks'
        }), 500


# =============================================================================
# OPTIMIZED PROGRESSIVE LOADING ENDPOINTS
# These endpoints support pagination and secure parameterized queries
# =============================================================================

@app.route('/api/data/portfolio', methods=['GET'])
def get_portfolio_data():
    """Get paginated portfolio-level data with a proper filter for high performance."""
    try:
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 50))
        
        logger.info(f"Fetching portfolio data - Page: {page}, Limit: {limit}")
        
        # 1. Read the base hierarchy query
        with open(HIERARCHY_QUERY_FILE, 'r') as f:
            hierarchy_query = f.read().strip().rstrip(';')
        
        # 2. CRITICAL FIX: Add a WHERE clause to only select top-level portfolios.
        # This is the key to making the query fast.
        hierarchy_query += " WHERE COE_ROADMAP_TYPE = 'Portfolio'"

        # 3. Add pagination to the already filtered query
        offset = (page - 1) * limit
        hierarchy_query += f" ORDER BY CHILD_ID LIMIT {limit} OFFSET {offset}"
        
        # 4. Execute the fast, filtered query. Caching is handled automatically by databricks_client.
        hierarchy_results = databricks_client.execute_query(hierarchy_query)
        
        investment_results = []
        
        # 5. CRITICAL FIX: Only get investment data for the portfolios we fetched
        # This prevents non-portfolio records from appearing on the Portfolio page
        if hierarchy_results:
            # Extract portfolio IDs from hierarchy results
            portfolio_ids = [row['CHILD_ID'] for row in hierarchy_results]
            portfolio_ids_str = "', '".join(portfolio_ids)
            
            with open(INVESTMENT_QUERY_FILE, 'r') as f:
                investment_query = f.read().strip().rstrip(';')

            # Add WHERE clause to filter investment data by portfolio IDs only
            investment_query += f" WHERE INV_EXT_ID IN ('{portfolio_ids_str}')"
            
            # Execute the filtered investment query to get only portfolio-related investment records
            investment_results = databricks_client.execute_query(investment_query)
            
            logger.info(f"Filtered investment query for {len(portfolio_ids)} portfolios, got {len(investment_results)} investment records")

        # 6. Structure and return the response
        response_data = {
            'status': 'success',
            'data': {
                'hierarchy': hierarchy_results,
                'investment': investment_results,
                'pagination': {
                    'page': page,
                    'limit': limit,
                    'total_items': len(hierarchy_results),
                    'has_more': len(hierarchy_results) == limit
                }
            },
            'mode': 'databricks'
        }
        
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"Error in get_portfolio_data: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to fetch portfolio data: {str(e)}',
            'mode': 'databricks'
        }), 500


@app.route('/api/data/program', methods=['GET'])
def get_program_data():
    """Get paginated program-level data supporting both 'All Programs' and drill-through scenarios."""
    try:
        portfolio_id = request.args.get('portfolioId')  # Make this optional
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 50))
        
        if portfolio_id:
            logger.info(f"Fetching program data for specific portfolio: {portfolio_id}, Page: {page}, Limit: {limit}")
        else:
            logger.info(f"Fetching ALL program data - Page: {page}, Limit: {limit}")
        
        # Read the base hierarchy query
        with open(HIERARCHY_QUERY_FILE, 'r') as f:
            hierarchy_query = f.read().strip().rstrip(';')
        
        # Always filter for Program and SubProgram records
        hierarchy_query += " WHERE COE_ROADMAP_TYPE IN ('Program', 'SubProgram')"
        
        # If a specific portfolio is provided, add additional filtering
        # Note: The actual portfolio filtering will be done in the frontend using the same
        # logic as apiDataService.js to ensure consistency
        
        # Add pagination to the filtered query
        offset = (page - 1) * limit
        hierarchy_query += f" ORDER BY CHILD_ID LIMIT {limit} OFFSET {offset}"
        
        # Execute the hierarchy query
        hierarchy_results = databricks_client.execute_query(hierarchy_query)
        
        # Get ALL investment data (same as successful portfolio endpoint)
        # This matches the working portfolio approach - fetch all investments and let frontend filter
        investment_results = []
        if hierarchy_results or not portfolio_id:  # Always fetch investments for "All Programs" view
            with open(INVESTMENT_QUERY_FILE, 'r') as f:
                investment_query = f.read().strip().rstrip(';')

            # Execute the full investment query to get all investment records
            # Frontend will do the matching logic based on INV_EXT_ID === CHILD_ID
            investment_results = databricks_client.execute_query(investment_query)

        # Structure and return the response
        response_data = {
            'status': 'success',
            'data': {
                'hierarchy': hierarchy_results,
                'investment': investment_results,
                'pagination': {
                    'page': page,
                    'limit': limit,
                    'portfolio_id': portfolio_id,  # Can be null for "All Programs"
                    'total_items': len(hierarchy_results),
                    'has_more': len(hierarchy_results) == limit
                }
            },
            'mode': 'databricks'
        }
        
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"Error in get_program_data: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to fetch program data: {str(e)}',
            'mode': 'databricks'
        }), 500


@app.route('/api/data/subprogram', methods=['GET'])
def get_subprogram_data():
    """
    Get paginated sub-program data. Handles both an "All Sub-Programs" view 
    and a filtered drill-through view from a specific program.
    """
    try:
        program_id = request.args.get('programId')  # Optional
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 50))
        
        logger.info(f"Fetching sub-program data. Program ID: {program_id or 'All'}, Page: {page}, Limit: {limit}")
        
        # Build the hierarchy query with a secure, conditional filter
        with open(HIERARCHY_QUERY_FILE, 'r') as f:
            hierarchy_query = f.read().strip().rstrip(';')

        # Base filter for the 'Sub-Program' record type. Note the hyphen.
        hierarchy_query += " WHERE COE_ROADMAP_TYPE = 'Sub-Program'"

        # If a specific program is provided, add additional filtering
        if program_id:
            hierarchy_query += f" AND COE_ROADMAP_PARENT_ID = '{program_id}'"
        
        # Add pagination to the filtered query
        offset = (page - 1) * limit
        hierarchy_query += f" ORDER BY CHILD_ID LIMIT {limit} OFFSET {offset}"
        
        # Execute the hierarchy query
        hierarchy_results = databricks_client.execute_query(hierarchy_query)
        logger.info(f"Found {len(hierarchy_results)} Sub-Program records")
        
        # Fetch investment data ONLY for the sub-programs found on the current page
        subprogram_ids = [record['CHILD_ID'] for record in hierarchy_results]
        investment_results = []

        if subprogram_ids:
            logger.info(f"Fetching investment data for subprogram IDs: {subprogram_ids}")
            
            with open(INVESTMENT_QUERY_FILE, 'r') as f:
                investment_query = f.read().strip().rstrip(';')

            # Use simple string formatting for IN clause (secure since we control the IDs)
            if subprogram_ids:
                id_placeholders = ', '.join([f"'{pid}'" for pid in subprogram_ids])
                investment_query += f" WHERE INV_EXT_ID IN ({id_placeholders})"
                
                # Debug the actual query being executed
                logger.info(f"🎯 BACKEND DEBUG: About to execute investment query with filter for PROG000201")
                logger.info(f"🎯 BACKEND DEBUG: Query length: {len(investment_query)} chars")
                
                investment_results = databricks_client.execute_query(investment_query)
                logger.info(f"Found {len(investment_results)} investment records for subprograms")
                
                # Debug ALL investment records for PROG000201 specifically
                all_prog201_records = [inv for inv in investment_results if inv.get('INV_EXT_ID') == 'PROG000201']
                if all_prog201_records:
                    logger.info(f"🎯 BACKEND DEBUG: Found {len(all_prog201_records)} total PROG000201 investment records")
                    for i, record in enumerate(all_prog201_records):
                        logger.info(f"🎯 BACKEND DEBUG: Record {i+1} - ROADMAP_ELEMENT: {record.get('ROADMAP_ELEMENT')}, TASK_NAME: {record.get('TASK_NAME')}, INVESTMENT_NAME: {record.get('INVESTMENT_NAME')}")
                else:
                    logger.warning("🎯 BACKEND DEBUG: NO PROG000201 investment records found in query results!")
                
                # Debug CaTAlyst specifically
                catalyst_records = [inv for inv in investment_results if inv.get('INV_EXT_ID') == 'PROG000201']
                if catalyst_records:
                    logger.info(f"🎯 BACKEND DEBUG: Found {len(catalyst_records)} CaTAlyst investment records by INV_EXT_ID")
                    for record in catalyst_records:
                        logger.info(f"🎯 BACKEND DEBUG: CaTAlyst record - ROADMAP_ELEMENT: {record.get('ROADMAP_ELEMENT')}, TASK_NAME: {record.get('TASK_NAME')}")
                else:
                    logger.warning("🎯 BACKEND DEBUG: NO CaTAlyst investment records found by INV_EXT_ID!")
                    
                    # Check if CaTAlyst exists by PROJECT_NAME
                    catalyst_by_name = [inv for inv in investment_results if 'CaTAlyst' in str(inv.get('PROJECT_NAME', '')).upper()]
                    if catalyst_by_name:
                        logger.info(f"🎯 BACKEND DEBUG: Found {len(catalyst_by_name)} CaTAlyst records by PROJECT_NAME")
                        for record in catalyst_by_name[:3]:  # Show first 3
                            logger.info(f"🎯 BACKEND DEBUG: CaTAlyst by name - INV_EXT_ID: {record.get('INV_EXT_ID')}, PROJECT_NAME: {record.get('PROJECT_NAME')}, ROADMAP_ELEMENT: {record.get('ROADMAP_ELEMENT')}")
                    else:
                        logger.warning("🎯 BACKEND DEBUG: NO CaTAlyst investment records found by PROJECT_NAME either!")
                    
                    # Log sample INV_EXT_ID values to debug mismatch
                    sample_ids = list(set([inv.get('INV_EXT_ID') for inv in investment_results[:10]]))
                    logger.info(f"🎯 BACKEND DEBUG: Sample INV_EXT_ID values: {sample_ids}")

        # Structure and return the response
        response_data = {
            'status': 'success',
            'data': {
                'hierarchy': hierarchy_results,
                'investment': investment_results,
                'pagination': {
                    'page': page,
                    'limit': limit,
                    'program_id': program_id,
                    'total_items': len(hierarchy_results),
                    'has_more': len(hierarchy_results) == limit
                }
            },
            'mode': 'databricks'
        }
        
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"Error in get_subprogram_data: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to fetch subprogram data: {str(e)}',
            'mode': 'databricks'
        }), 500

        # Structure and return the response
        response_data = {
            'status': 'success',
            'data': {
                'hierarchy': hierarchy_results,
                'investment': investment_results,
                'pagination': {
                    'page': page,
                    'limit': limit,
                    'program_id': program_id,  # Can be null for "All SubPrograms"
                    'total_items': len(hierarchy_results),
                    'has_more': len(hierarchy_results) == limit
                }
            },
            'mode': 'databricks'
        }
        
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"Error in get_subprogram_data: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to fetch subprogram data: {str(e)}',
            'mode': 'databricks'
        }), 500


@app.route('/api/data/region', methods=['GET'])
def get_region_data():
    """Get paginated region-filtered data using a correct and efficient two-step fetch."""
    try:
        region = request.args.get('region')  # Optional
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 50))
        
        logger.info(f"Fetching region data. Region: {region or 'All'}, Page: {page}, Limit: {limit}")

        # Build cache key based on whether region is specified
        cache_key = f"region_data_{region or 'all'}_p{page}_l{limit}"
        
        # Check cache first
        cached_data = cache_service.get(cache_key)
        if cached_data:
            logger.info(f"Serving region data from cache: {cache_key}")
            return jsonify(cached_data)

        # Step 1: Fetch a page of HIERARCHY records, filtered by region if provided.
        with open(HIERARCHY_QUERY_FILE, 'r') as f:
            hierarchy_query = f.read().strip().rstrip(';')

        params = {}
        where_clauses = ["COE_ROADMAP_TYPE IN ('Sub-Program', 'Project')"]  # Fetch relevant types

        if region and region.lower() != 'all':
            # TEMPORARY: Frontend filtering for now since SPLIT function causes issues
            # When region filtering is needed in backend, implement proper column filtering
            pass  # Frontend will handle region filtering for now
        
        hierarchy_query += " WHERE " + " AND ".join(where_clauses)
        
        offset = (page - 1) * limit
        hierarchy_query += f" ORDER BY CHILD_ID LIMIT {limit} OFFSET {offset}"
        
        hierarchy_results = databricks_client.execute_query(hierarchy_query, parameters=params)
        
        # Step 2: Take the IDs from Step 1 and fetch ONLY their corresponding investment records.
        item_ids = [record['CHILD_ID'] for record in hierarchy_results]
        investment_results = []

        if item_ids:
            with open(INVESTMENT_QUERY_FILE, 'r') as f:
                investment_query = f.read().strip().rstrip(';')

            # Use secure parameterized queries for the IN clause
            id_placeholders = ', '.join(['%(id' + str(i) + ')s' for i in range(len(item_ids))])
            params_investment = {f'id{i}': pid for i, pid in enumerate(item_ids)}
            
            investment_query += f" WHERE INV_EXT_ID IN ({id_placeholders})"
            investment_results = databricks_client.execute_query(investment_query, parameters=params_investment)

        response_data = {
            'status': 'success',
            'data': {
                'hierarchy': hierarchy_results,
                'investment': investment_results,
                'pagination': {
                    'page': page,
                    'limit': limit,
                    'region': region or 'All',
                    'total_items': len(hierarchy_results),
                    'has_more': len(hierarchy_results) == limit
                }
            },
            'mode': 'databricks',
            'cache_info': {
                'cached': False,
                'cache_key': cache_key
            }
        }
        
        # Cache the response
        cache_service.set(cache_key, response_data, ttl=300)
        
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"Error in get_region_data: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to fetch region data: {str(e)}',
            'mode': 'databricks'
        }), 500



@app.route('/api/data/region/filters', methods=['GET'])
def get_region_filter_options():
    """Get available filter options for regions - regions, markets, functions, tiers."""
    try:
        cache_key = "region_filter_options"
        
        # Check cache first
        cached_data = cache_service.get(cache_key)
        if cached_data:
            logger.info("Serving region filter options from cache")
            return jsonify(cached_data)
        
        logger.info("Fetching region filter options from database")
        
        # Get actual filter options from the same investment query used for data
        # This ensures filter options match the available data
        
        # Read the investment query file
        with open(INVESTMENT_QUERY_FILE, 'r') as f:
            investment_query = f.read().strip().rstrip(';')
        
        # Modify query to get unique filter values
        filter_query = f"""
        WITH base_data AS (
            {investment_query}
        )
        SELECT DISTINCT
            CASE 
                WHEN INV_MARKET = '-Unrecognised-' THEN 'Unrecognised'
                WHEN INV_MARKET IS NULL OR INV_MARKET = '' THEN 'Unknown'
                WHEN LOCATE('/', INV_MARKET) > 0 THEN SUBSTR(INV_MARKET, 1, LOCATE('/', INV_MARKET) - 1)
                ELSE INV_MARKET
            END as region,
            CASE 
                WHEN INV_MARKET = '-Unrecognised-' THEN 'Unrecognised'
                WHEN INV_MARKET IS NULL OR INV_MARKET = '' THEN 'Unknown'
                WHEN LOCATE('/', INV_MARKET) > 0 THEN SUBSTR(INV_MARKET, LOCATE('/', INV_MARKET) + 1)
                ELSE 'Unknown'
            END as market,
            INV_FUNCTION as function,
            CAST(INV_TIER as STRING) as tier
        FROM base_data 
        WHERE INV_MARKET IS NOT NULL 
        AND INV_MARKET != ''
        """
        
        # Execute query
        results = databricks_client.execute_query(filter_query)
        
        # Process results to create filter options
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
        
        response_data = {
            'status': 'success',
            'data': {
                'regions': sorted(list(regions)),
                'markets': sorted(list(markets)),
                'functions': sorted(list(functions)),
                'tiers': sorted(list(tiers))
            }
        }
        
        # Cache for 30 minutes
        cache_service.set(cache_key, response_data, ttl=1800)
        
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"Error fetching region filter options: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to fetch filter options: {str(e)}'
        }), 500


# =============================================================================
# LEGACY ENDPOINT (Kept for minimal backward compatibility with limited data)
# =============================================================================

@app.route('/api/data/paginated', methods=['GET'])
def get_paginated_data():
    """
    Legacy paginated endpoint - kept for backward compatibility.
    Limited to small datasets to prevent performance issues.
    """
    try:
        # Get pagination parameters from query string
        page = request.args.get('page', 1, type=int)
        page_size = min(request.args.get('page_size', 25, type=int), 50)  # Cap at 50
        use_cache = request.args.get('cache', 'true').lower() == 'true'
        
        logger.info(f"🚀 Fetching limited paginated data (page={page}, size={page_size}, cache={use_cache})")
        
        # Execute both queries with pagination - using smaller page sizes
        hierarchy_result = databricks_client.execute_paginated_query(
            open(HIERARCHY_QUERY_FILE, 'r').read(),
            page=page,
            page_size=page_size,
            use_cache=use_cache,
            cache_ttl=300  # 5 minutes cache for legacy endpoint
        )
        
        investment_result = databricks_client.execute_paginated_query(
            open(INVESTMENT_QUERY_FILE, 'r').read(),
            page=page,
            page_size=page_size,
            use_cache=use_cache,
            cache_ttl=300
        )
        
        logger.info(f"✅ Successfully fetched limited paginated data")
        
        return jsonify({
            'status': 'success',
            'data': {
                'hierarchy': hierarchy_result,
                'investment': investment_result
            },
            'mode': 'databricks',
            'pagination_info': {
                'page': page,
                'page_size': page_size,
                'cached': use_cache,
                'note': 'Legacy endpoint - use specific endpoints like /api/data/portfolio for better performance'
            }
        })
        
    except Exception as e:
        error_msg = f"Failed to fetch paginated data: {str(e)}"
        logger.error(error_msg)
        return jsonify({
            'status': 'error',
            'message': error_msg
        }), 500


# =============================================================================
# DEPRECATED ENDPOINTS (REMOVED FOR PERFORMANCE)
# =============================================================================
# The following endpoints have been removed because they fetch entire datasets
# and cause 4-7 minute loading times. Use the progressive endpoints above instead:
#
# REMOVED: /api/hierarchy_data - Use /api/data/portfolio, /api/data/program, etc.
# REMOVED: /api/investment_data - Use /api/data/portfolio, /api/data/program, etc.  
# REMOVED: /api/portfolios - Use /api/data/portfolio with pagination
# REMOVED: /api/investments - Use /api/data/portfolio, /api/data/program, etc.
# REMOVED: /api/data - Use specific progressive endpoints based on context
#
# Migration Guide: See PROGRESSIVE_LOADING_MIGRATION_GUIDE.md
# =============================================================================

# =============================================================================
# LEGACY FULL DATA ENDPOINT (For backward compatibility with frontend)
# =============================================================================

@app.route('/api/data', methods=['GET'])
def get_legacy_full_data():
    """
    Legacy endpoint that returns full dataset in the old format.
    Added back for backward compatibility with existing frontend code.
    """
    try:
        logger.info("🔄 Fetching full legacy data for backward compatibility")
        
        # Use cache with longer TTL for full dataset
        cache_key = "legacy_full_data"
        cached_data = cache_service.get(cache_key)
        
        if cached_data:
            logger.info("✅ Serving full legacy data from cache")
            return jsonify(cached_data)
        
        # Read and execute both queries without pagination
        with open(HIERARCHY_QUERY_FILE, 'r') as f:
            hierarchy_query = f.read()
        
        with open(INVESTMENT_QUERY_FILE, 'r') as f:
            investment_query = f.read()
        
        # Execute queries without pagination
        hierarchy_result = databricks_client.execute_query_unlimited(hierarchy_query, use_cache=True, cache_ttl=600)
        investment_result = databricks_client.execute_query_unlimited(investment_query, use_cache=True, cache_ttl=600)
        
        # Structure the response in the old format
        response_data = {
            'status': 'success',
            'data': {
                'hierarchy': hierarchy_result,
                'investment': investment_result
            },
            'mode': 'databricks',
            'note': 'Legacy full dataset endpoint - consider using paginated endpoints for better performance'
        }
        
        # Cache for 10 minutes
        cache_service.set(cache_key, response_data, ttl=600)
        
        logger.info("✅ Successfully fetched and cached full legacy data")
        return jsonify(response_data)
        
    except Exception as e:
        error_msg = f"Failed to fetch legacy full data: {str(e)}"
        logger.error(error_msg)
        return jsonify({
            'status': 'error',
            'message': error_msg
        }), 500


# =============================================================================
# UTILITY AND CACHE MANAGEMENT ENDPOINTS
# =============================================================================


@app.route('/api/cache/stats', methods=['GET'])
def get_cache_stats():
    """Get cache statistics and performance metrics."""
    try:
        stats = cache_service.get_cache_stats()
        return jsonify({
            'status': 'success',
            'cache_stats': stats,
            'mode': 'databricks'
        })
    except Exception as e:
        error_msg = f"Failed to get cache stats: {str(e)}"
        logger.error(error_msg)
        return jsonify({
            'status': 'error',
            'message': error_msg
        }), 500


@app.route('/api/cache/clear', methods=['POST'])
def clear_cache():
    """Clear cache entries."""
    try:
        pattern = request.json.get('pattern') if request.json else None
        success = cache_service.clear_cache(pattern)
        
        if success:
            return jsonify({
                'status': 'success',
                'message': 'Cache cleared successfully',
                'mode': 'databricks'
            })
        else:
            return jsonify({
                'status': 'error',
                'message': 'Failed to clear cache'
            }), 500
            
    except Exception as e:
        error_msg = f"Failed to clear cache: {str(e)}"
        logger.error(error_msg)
        return jsonify({
            'status': 'error',
            'message': error_msg
        }), 500


# =============================================================================
# ERROR HANDLERS
# =============================================================================


@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors."""
    return jsonify({
        'status': 'error',
        'message': 'Endpoint not found'
    }), 404


@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors."""
    return jsonify({
        'status': 'error',
        'message': 'Internal server error'
    }), 500


if __name__ == '__main__':
    # Validate environment variables on startup
    required_env_vars = [
        'DATABRICKS_SERVER_HOSTNAME',
        'DATABRICKS_HTTP_PATH', 
        'DATABRICKS_ACCESS_TOKEN'
    ]
    
    missing_vars = [var for var in required_env_vars if not os.getenv(var)]
    if missing_vars:
        logger.error(f"Missing required environment variables: {', '.join(missing_vars)}")
        logger.error("Please check your .env file and ensure all required variables are set.")
        exit(1)
    
    # Check if SQL query files exist
    if not os.path.exists(HIERARCHY_QUERY_FILE):
        logger.error(f"Hierarchy query file not found: {HIERARCHY_QUERY_FILE}")
        exit(1)
    
    if not os.path.exists(INVESTMENT_QUERY_FILE):
        logger.error(f"Investment query file not found: {INVESTMENT_QUERY_FILE}")
        exit(1)
    
    # Start the Flask server
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    
    logger.info(f"Starting PMO Portfolio API server on port {port}")
    logger.info(f"CORS enabled for: {', '.join(frontend_urls)}")
    
    app.run(
        host='0.0.0.0',
        port=port,
        debug=debug
    )
