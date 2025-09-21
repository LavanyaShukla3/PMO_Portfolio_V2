# API Performance Optimization Routes
# Additional routes to add to app.py for progressive data loading

@app.route('/api/data/portfolio', methods=['GET'])
def get_portfolio_data():
    """Get paginated portfolio-level data."""
    try:
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 50))
        filters = {
            'portfolio_id': request.args.get('portfolioId'),
            'parent_id': request.args.get('parentId'),
            'status': request.args.get('status')
        }
        
        # Remove None values from filters
        filters = {k: v for k, v in filters.items() if v is not None}
        
        # Create cache key
        cache_key = f"portfolio_data_p{page}_l{limit}_{hash(str(filters))}"
        
        # Check cache first
        cached_data = cache_service.get(cache_key)
        if cached_data:
            logger.info(f"Serving portfolio data from cache: {cache_key}")
            return jsonify(cached_data)
        
        logger.info(f"Fetching portfolio data - Page: {page}, Limit: {limit}, Filters: {filters}")
        
        # Read SQL queries
        with open(HIERARCHY_QUERY_FILE, 'r') as f:
            hierarchy_query = f.read()
        
        with open(INVESTMENT_QUERY_FILE, 'r') as f:
            investment_query = f.read()
        
        # Modify queries for portfolio-level filtering and pagination
        if filters.get('portfolio_id'):
            hierarchy_query += f" AND COE_ROADMAP_PARENT_ID = '{filters['portfolio_id']}'"
            investment_query += f" AND INVESTMENT_ID LIKE '{filters['portfolio_id']}%'"
        
        if filters.get('status'):
            hierarchy_query += f" AND STATUS = '{filters['status']}'"
            investment_query += f" AND STATUS = '{filters['status']}'"
        
        # Add pagination
        offset = (page - 1) * limit
        hierarchy_query += f" ORDER BY COE_ROADMAP_ELEMENT_ID OFFSET {offset} ROWS FETCH NEXT {limit} ROWS ONLY"
        investment_query += f" ORDER BY INVESTMENT_ID OFFSET {offset} ROWS FETCH NEXT {limit} ROWS ONLY"
        
        # Execute queries
        hierarchy_results = databricks_client.execute_query(hierarchy_query)
        investment_results = databricks_client.execute_query(investment_query)
        
        # Structure response
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
            'mode': 'databricks',
            'cache_info': {
                'cached': False,
                'cache_key': cache_key
            }
        }
        
        # Cache the response
        cache_service.set(cache_key, response_data, timeout=300)  # 5 minutes
        
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
    """Get paginated program-level data."""
    try:
        portfolio_id = request.args.get('portfolioId')
        if not portfolio_id:
            return jsonify({
                'status': 'error',
                'message': 'portfolioId parameter is required'
            }), 400
        
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 50))
        
        cache_key = f"program_data_{portfolio_id}_p{page}_l{limit}"
        
        # Check cache first
        cached_data = cache_service.get(cache_key)
        if cached_data:
            logger.info(f"Serving program data from cache: {cache_key}")
            return jsonify(cached_data)
        
        logger.info(f"Fetching program data for portfolio: {portfolio_id}")
        
        # Read and modify SQL queries for program-level data
        with open(HIERARCHY_QUERY_FILE, 'r') as f:
            hierarchy_query = f.read()
        
        with open(INVESTMENT_QUERY_FILE, 'r') as f:
            investment_query = f.read()
        
        # Filter for specific portfolio and program level
        hierarchy_query += f" AND COE_ROADMAP_PARENT_ID = '{portfolio_id}' AND COE_ROADMAP_TYPE = 'Program'"
        investment_query += f" AND INVESTMENT_ID LIKE '{portfolio_id}%'"
        
        # Add pagination
        offset = (page - 1) * limit
        hierarchy_query += f" ORDER BY COE_ROADMAP_ELEMENT_ID OFFSET {offset} ROWS FETCH NEXT {limit} ROWS ONLY"
        investment_query += f" ORDER BY INVESTMENT_ID OFFSET {offset} ROWS FETCH NEXT {limit} ROWS ONLY"
        
        # Execute queries
        hierarchy_results = databricks_client.execute_query(hierarchy_query)
        investment_results = databricks_client.execute_query(investment_query)
        
        response_data = {
            'status': 'success',
            'data': {
                'hierarchy': hierarchy_results,
                'investment': investment_results,
                'pagination': {
                    'page': page,
                    'limit': limit,
                    'portfolio_id': portfolio_id,
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
        cache_service.set(cache_key, response_data, timeout=300)
        
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
    """Get paginated subprogram-level data."""
    try:
        program_id = request.args.get('programId')
        if not program_id:
            return jsonify({
                'status': 'error',
                'message': 'programId parameter is required'
            }), 400
        
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 50))
        
        cache_key = f"subprogram_data_{program_id}_p{page}_l{limit}"
        
        # Check cache first
        cached_data = cache_service.get(cache_key)
        if cached_data:
            logger.info(f"Serving subprogram data from cache: {cache_key}")
            return jsonify(cached_data)
        
        logger.info(f"Fetching subprogram data for program: {program_id}")
        
        # Read and modify SQL queries for subprogram-level data
        with open(HIERARCHY_QUERY_FILE, 'r') as f:
            hierarchy_query = f.read()
        
        with open(INVESTMENT_QUERY_FILE, 'r') as f:
            investment_query = f.read()
        
        # Filter for specific program and subprogram level, or all if program_id is 'ALL'
        if program_id.upper() == 'ALL':
            # Load all sub-program data
            hierarchy_query += " AND COE_ROADMAP_TYPE = 'SubProgram'"
            # Don't filter investment query for specific program
        else:
            # Filter for specific program and subprogram level
            hierarchy_query += f" AND COE_ROADMAP_PARENT_ID = '{program_id}' AND COE_ROADMAP_TYPE = 'SubProgram'"
            investment_query += f" AND INVESTMENT_ID LIKE '{program_id}%'"
        
        # Add pagination
        offset = (page - 1) * limit
        hierarchy_query += f" ORDER BY COE_ROADMAP_ELEMENT_ID OFFSET {offset} ROWS FETCH NEXT {limit} ROWS ONLY"
        investment_query += f" ORDER BY INVESTMENT_ID OFFSET {offset} ROWS FETCH NEXT {limit} ROWS ONLY"
        
        # Execute queries
        hierarchy_results = databricks_client.execute_query(hierarchy_query)
        investment_results = databricks_client.execute_query(investment_query)
        
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
            'mode': 'databricks',
            'cache_info': {
                'cached': False,
                'cache_key': cache_key
            }
        }
        
        # Cache the response
        cache_service.set(cache_key, response_data, timeout=300)
        
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
    """Get paginated region-level data."""
    try:
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 50))
        region = request.args.get('region')
        
        cache_key = f"region_data_{region or 'all'}_p{page}_l{limit}"
        
        # Check cache first
        cached_data = cache_service.get(cache_key)
        if cached_data:
            logger.info(f"Serving region data from cache: {cache_key}")
            return jsonify(cached_data)
        
        logger.info(f"Fetching region data - Region: {region}, Page: {page}, Limit: {limit}")
        
        # Read and modify SQL queries for region-level data
        with open(HIERARCHY_QUERY_FILE, 'r') as f:
            hierarchy_query = f.read()
        
        with open(INVESTMENT_QUERY_FILE, 'r') as f:
            investment_query = f.read()
        
        # Filter by region if specified
        if region:
            hierarchy_query += f" AND REGION = '{region}'"
            investment_query += f" AND REGION = '{region}'"
        
        # Add pagination
        offset = (page - 1) * limit
        hierarchy_query += f" ORDER BY COE_ROADMAP_ELEMENT_ID OFFSET {offset} ROWS FETCH NEXT {limit} ROWS ONLY"
        investment_query += f" ORDER BY INVESTMENT_ID OFFSET {offset} ROWS FETCH NEXT {limit} ROWS ONLY"
        
        # Execute queries
        hierarchy_results = databricks_client.execute_query(hierarchy_query)
        investment_results = databricks_client.execute_query(investment_query)
        
        response_data = {
            'status': 'success',
            'data': {
                'hierarchy': hierarchy_results,
                'investment': investment_results,
                'pagination': {
                    'page': page,
                    'limit': limit,
                    'region': region,
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
        cache_service.set(cache_key, response_data, timeout=300)
        
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"Error in get_region_data: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to fetch region data: {str(e)}',
            'mode': 'databricks'
        }), 500


@app.route('/api/cache/clear', methods=['POST'])
def clear_cache():
    """Clear all cache entries."""
    try:
        cache_service.clear()
        logger.info("Cache cleared successfully")
        return jsonify({
            'status': 'success',
            'message': 'Cache cleared successfully'
        })
    except Exception as e:
        logger.error(f"Error clearing cache: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to clear cache: {str(e)}'
        }), 500
