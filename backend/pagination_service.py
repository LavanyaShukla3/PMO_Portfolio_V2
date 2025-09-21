"""
Pagination service for large dataset queries.
Provides intelligent pagination with configurable page sizes.
"""
import logging
import math
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)


class PaginationService:
    """
    Service to handle pagination for large query results.
    """
    
    def __init__(self, default_page_size: int = 50, max_page_size: int = 200):
        self.default_page_size = default_page_size
        self.max_page_size = max_page_size
    
    def add_pagination_to_query(self, query: str, page: int = 1, page_size: int = None) -> str:
        """
        Add LIMIT and OFFSET clauses to a SQL query for pagination.
        
        Args:
            query: Original SQL query
            page: Page number (1-based)
            page_size: Number of records per page
            
        Returns:
            Modified query with pagination
        """
        page_size = min(page_size or self.default_page_size, self.max_page_size)
        page = max(1, page)  # Ensure page is at least 1
        
        offset = (page - 1) * page_size
        
        # Remove existing LIMIT/OFFSET clauses if any
        query_upper = query.upper()
        if 'LIMIT' in query_upper:
            # Find the position of LIMIT and remove everything after it
            limit_pos = query_upper.rfind('LIMIT')
            query = query[:limit_pos].rstrip()
        
        # Add new pagination
        paginated_query = f"{query.rstrip(';')}\nLIMIT {page_size} OFFSET {offset};"
        
        logger.info(f"📄 Added pagination: page={page}, page_size={page_size}, offset={offset}")
        return paginated_query
    
    def get_count_query(self, original_query: str) -> str:
        """
        Generate a COUNT query from the original query to get total records.
        
        Args:
            original_query: The original SELECT query
            
        Returns:
            COUNT query to get total number of records
        """
        # Remove LIMIT/OFFSET clauses
        query_upper = original_query.upper()
        if 'LIMIT' in query_upper:
            limit_pos = query_upper.rfind('LIMIT')
            query = original_query[:limit_pos].rstrip()
        else:
            query = original_query.rstrip(';')
        
        # Wrap in COUNT query
        count_query = f"SELECT COUNT(*) as total_count FROM ({query}) as count_subquery;"
        
        logger.info("🔢 Generated count query for pagination")
        return count_query
    
    def create_pagination_metadata(
        self, 
        total_count: int, 
        page: int, 
        page_size: int
    ) -> Dict[str, Any]:
        """
        Create pagination metadata for API responses.
        
        Args:
            total_count: Total number of records
            page: Current page number
            page_size: Records per page
            
        Returns:
            Dictionary containing pagination metadata
        """
        total_pages = math.ceil(total_count / page_size) if total_count > 0 else 0
        has_next = page < total_pages
        has_previous = page > 1
        
        metadata = {
            "pagination": {
                "current_page": page,
                "page_size": page_size,
                "total_count": total_count,
                "total_pages": total_pages,
                "has_next": has_next,
                "has_previous": has_previous,
                "next_page": page + 1 if has_next else None,
                "previous_page": page - 1 if has_previous else None
            }
        }
        
        logger.info(f"📊 Pagination metadata: {total_count} total, page {page}/{total_pages}")
        return metadata
    
    def paginate_list(
        self, 
        data: List[Any], 
        page: int = 1, 
        page_size: int = None
    ) -> Dict[str, Any]:
        """
        Paginate an in-memory list (for cached results).
        
        Args:
            data: List of data to paginate
            page: Page number (1-based)
            page_size: Records per page
            
        Returns:
            Dictionary with paginated data and metadata
        """
        page_size = min(page_size or self.default_page_size, self.max_page_size)
        page = max(1, page)
        
        total_count = len(data)
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        
        paginated_data = data[start_idx:end_idx]
        metadata = self.create_pagination_metadata(total_count, page, page_size)
        
        return {
            "data": paginated_data,
            **metadata
        }


# Global pagination service instance
pagination_service = PaginationService(
    default_page_size=50,  # Good balance for development
    max_page_size=200      # Prevent too large requests
)
