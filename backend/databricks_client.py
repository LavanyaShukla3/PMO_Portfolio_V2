"""
Databricks SQL connector client for secure database operations.
Enhanced with caching and pagination support.
"""
import os
import logging
from typing import List, Dict, Any, Optional, Tuple
from databricks import sql
from dotenv import load_dotenv

# Import our services
from cache_service import cache_service
from pagination_service import pagination_service

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DatabricksClient:
    """
    A client for connecting to and querying Databricks SQL warehouses.
    """
    
    def __init__(self):
        """Initialize the Databricks client with environment variables."""
        self.server_hostname = os.getenv('DATABRICKS_SERVER_HOSTNAME')
        self.http_path = os.getenv('DATABRICKS_HTTP_PATH')
        self.access_token = os.getenv('DATABRICKS_ACCESS_TOKEN')
        
        # Validate required environment variables
        if not all([self.server_hostname, self.http_path, self.access_token]):
            raise ValueError(
                "Missing required Databricks configuration. "
                "Please check DATABRICKS_SERVER_HOSTNAME, DATABRICKS_HTTP_PATH, "
                "and DATABRICKS_ACCESS_TOKEN environment variables."
            )
        
        self.connection = None
    
    def connect(self) -> None:
        """Establish connection to Databricks."""
        try:
            self.connection = sql.connect(
                server_hostname=self.server_hostname,
                http_path=self.http_path,
                access_token=self.access_token,
                _user_agent_entry="PMO-Portfolio/1.0.0"
            )
            logger.info("Successfully connected to Databricks")
        except Exception as e:
            logger.error(f"Failed to connect to Databricks: {str(e)}")
            raise
    
    def disconnect(self) -> None:
        """Close the Databricks connection."""
        if self.connection:
            self.connection.close()
            self.connection = None
            logger.info("Disconnected from Databricks")
    
    def execute_query(self, query: str, parameters: Optional[Dict[str, Any]] = None, timeout: int = 600, use_cache: bool = True, cache_ttl: int = 1800) -> List[Dict[str, Any]]:
        """
        Execute a SQL query and return results as a list of dictionaries.
        Enhanced with caching support and parameterized queries for security.
        
        Args:
            query (str): The SQL query to execute
            parameters (Dict[str, Any], optional): Parameters for parameterized queries
            timeout (int): Query timeout in seconds (default: 600 = 10 minutes)
            use_cache (bool): Whether to use caching for this query
            cache_ttl (int): Cache time-to-live in seconds (default 30 minutes)
            
        Returns:
            List[Dict[str, Any]]: Query results as list of dictionaries
        """
        # Create cache key including parameters for security
        cache_key = f"{query}_{str(parameters) if parameters else ''}"
        
        # Check cache first if enabled
        if use_cache:
            cached_result = cache_service.get(cache_key)
            if cached_result is not None:
                logger.info(f"🚀 Cache hit! Returning {len(cached_result)} cached rows")
                return cached_result
        
        if not self.connection:
            self.connect()
        
        try:
            cursor = self.connection.cursor()
            
            # Add reasonable LIMIT to very long queries if not already present
            # But allow larger limits for filtered queries (e.g., WHERE INV_EXT_ID IN (...))
            if len(query) > 2000 and "LIMIT" not in query.upper():
                if "WHERE INV_EXT_ID IN" in query:
                    # For filtered investment queries, use a much higher limit since we're targeting specific records
                    # The CaTAlyst data exists but is beyond the 1000 row limit - trying 15000 to be absolutely sure
                    logger.info("Adding LIMIT 15000 to filtered investment query to ensure all targeted records are included")
                    query = query.rstrip(';') + "\nLIMIT 15000;"
                else:
                    logger.warning("Adding LIMIT 100 to large query to prevent timeout")
                    query = query.rstrip(';') + "\nLIMIT 100;"
            
            logger.info(f"🔍 Executing query (length: {len(query)} chars)")
            
            # Execute with or without parameters
            if parameters:
                cursor.execute(query, parameters)
            else:
                cursor.execute(query)
            
            # Get column names
            columns = [desc[0] for desc in cursor.description]
            
            # Fetch all results and convert to list of dictionaries
            results = []
            for row in cursor.fetchall():
                results.append(dict(zip(columns, row)))
            
            cursor.close()
            logger.info(f"✅ Query executed successfully, returned {len(results)} rows")
            
            # Cache the results if caching is enabled
            if use_cache and results:
                cache_service.set(cache_key, results, ttl=cache_ttl)
            
            return results
            
        except Exception as e:
            logger.error(f"❌ Query execution failed: {str(e)}")
            raise
    
    def execute_query_unlimited(self, query: str, timeout: int = 1200, use_cache: bool = True, cache_ttl: int = 1800) -> List[Dict[str, Any]]:
        """
        Execute a SQL query without automatic LIMIT addition for large datasets.
        
        Args:
            query (str): The SQL query to execute
            timeout (int): Query timeout in seconds (default: 1200 = 20 minutes)
            use_cache (bool): Whether to use caching for this query
            cache_ttl (int): Cache time-to-live in seconds (default 30 minutes)
            
        Returns:
            List[Dict[str, Any]]: Query results as list of dictionaries
        """
        # Check cache first if enabled
        if use_cache:
            cached_result = cache_service.get(query)
            if cached_result is not None:
                logger.info(f"🚀 Cache hit! Returning {len(cached_result)} cached rows")
                return cached_result
        
        if not self.connection:
            self.connect()
        
        try:
            cursor = self.connection.cursor()
            
            # Don't add automatic LIMIT for unlimited queries
            logger.info(f"🔍 Executing unlimited query (length: {len(query)} chars)")
            cursor.execute(query)
            
            # Get column names
            columns = [desc[0] for desc in cursor.description]
            
            # Fetch all results and convert to list of dictionaries
            results = []
            for row in cursor.fetchall():
                results.append(dict(zip(columns, row)))
            
            cursor.close()
            logger.info(f"✅ Unlimited query executed successfully, returned {len(results)} rows")
            
            # Cache the results if caching is enabled
            if use_cache and results:
                cache_service.set(query, results, ttl=cache_ttl)
            
            return results
            
        except Exception as e:
            logger.error(f"❌ Unlimited query execution failed: {str(e)}")
            raise
    
    def execute_paginated_query(
        self, 
        query: str, 
        page: int = 1, 
        page_size: int = 50,
        use_cache: bool = True,
        cache_ttl: int = 300
    ) -> Dict[str, Any]:
        """
        Execute a paginated query with caching support.
        
        Args:
            query: Original SQL query
            page: Page number (1-based)
            page_size: Number of records per page
            use_cache: Whether to use caching
            cache_ttl: Cache time-to-live in seconds
            
        Returns:
            Dictionary with paginated data and metadata
        """
        # Create cache key including pagination params
        cache_params = {"page": page, "page_size": page_size}
        
        # Check cache first
        if use_cache:
            cached_result = cache_service.get(query, cache_params)
            if cached_result is not None:
                logger.info(f"📄 Returning cached paginated result for page {page}")
                return cached_result
        
        try:
            # For very large queries, we'll paginate at the database level
            if len(query) > 1000:
                # Add pagination to the query
                paginated_query = pagination_service.add_pagination_to_query(query, page, page_size)
                
                # Execute the paginated query
                results = self.execute_query(paginated_query, use_cache=False)  # Don't double-cache
                
                # For large queries, we'll estimate total count to avoid expensive COUNT queries
                total_count = len(results) * 10  # Rough estimate for development
                if len(results) < page_size:
                    # If we got fewer results than requested, we're near the end
                    total_count = (page - 1) * page_size + len(results)
                
                # Create pagination metadata
                metadata = pagination_service.create_pagination_metadata(total_count, page, page_size)
                
                result = {
                    "data": results,
                    **metadata
                }
                
            else:
                # For smaller queries, get full results and paginate in memory
                full_results = self.execute_query(query, use_cache=use_cache, cache_ttl=cache_ttl)
                result = pagination_service.paginate_list(full_results, page, page_size)
            
            # Cache the paginated result
            if use_cache:
                cache_service.set(query, result, ttl=cache_ttl, params=cache_params)
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Paginated query execution failed: {str(e)}")
            raise
    
    def execute_query_from_file(
        self, 
        file_path: str, 
        timeout: int = 600,
        use_cache: bool = True, 
        cache_ttl: int = 1800
    ) -> List[Dict[str, Any]]:
        """
        Execute a SQL query from a file with caching support.
        
        Args:
            file_path (str): Path to the SQL file
            timeout (int): Query timeout in seconds (default: 600 = 10 minutes)
            use_cache (bool): Whether to use caching
            cache_ttl (int): Cache time-to-live in seconds (default: 30 minutes)
            
        Returns:
            List[Dict[str, Any]]: Query results as list of dictionaries
        """
        try:
            with open(file_path, 'r', encoding='utf-8') as file:
                query = file.read()
            
            logger.info(f"📄 Executing query from file: {file_path}")
            return self.execute_query(query, timeout=timeout, use_cache=use_cache, cache_ttl=cache_ttl)
            
        except FileNotFoundError:
            logger.error(f"❌ SQL file not found: {file_path}")
            raise
        except Exception as e:
            logger.error(f"❌ Error reading SQL file {file_path}: {str(e)}")
            raise
    
    def test_connection(self) -> bool:
        """
        Test the Databricks connection.
        
        Returns:
            bool: True if connection is successful, False otherwise
        """
        try:
            self.connect()
            # Execute a simple query to test connection
            test_query = "SELECT 1 as test_column"
            result = self.execute_query(test_query)
            
            if result and result[0].get('test_column') == 1:
                logger.info("Databricks connection test successful")
                return True
            else:
                logger.error("Databricks connection test failed - unexpected result")
                return False
                
        except Exception as e:
            logger.error(f"Databricks connection test failed: {str(e)}")
            return False
        finally:
            self.disconnect()


# Global client instance
databricks_client = DatabricksClient()
