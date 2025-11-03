"""
Cache service for PMO Portfolio API using disk cache.
Provides intelligent caching for expensive Databricks queries.
"""
import hashlib
import json
import logging
import os
from datetime import datetime, timedelta
from typing import Any, Optional, Dict

import diskcache as dc

logger = logging.getLogger(__name__)


class CacheService:
    """
    Intelligent caching service using disk cache with configurable TTL.
    """
    
    def __init__(self, cache_dir: str = "cache", default_ttl: int = 300):
        self.default_ttl = default_ttl  # 5 minutes default
        self.cache_dir = cache_dir
        
        # Initialize disk cache
        os.makedirs(cache_dir, exist_ok=True)
        try:
            self.disk_cache = dc.Cache(cache_dir, size_limit=500_000_000)  # 500MB limit
            logger.info(f"✅ Disk cache initialized at {cache_dir}")
        except Exception as e:
            logger.warning(f"⚠️ Disk cache corruption detected: {e}")
            logger.info("🔧 Attempting to clear corrupted cache files...")
            
            # Try to clear corrupted cache files
            import glob
            cache_files = glob.glob(os.path.join(cache_dir, "cache.db*"))
            for cache_file in cache_files:
                try:
                    if os.path.exists(cache_file):
                        os.remove(cache_file)
                        logger.info(f"🗑️ Removed corrupted cache file: {cache_file}")
                except Exception as remove_error:
                    logger.warning(f"⚠️ Could not remove {cache_file}: {remove_error}")
            
            # Try to initialize cache again
            try:
                self.disk_cache = dc.Cache(cache_dir, size_limit=500_000_000)
                logger.info(f"✅ Disk cache reinitialized after cleanup at {cache_dir}")
            except Exception as retry_error:
                logger.error(f"❌ Failed to reinitialize disk cache: {retry_error}")
                # Set to None to disable disk caching
                self.disk_cache = None
    
    def _generate_key(self, query: str, params: Dict = None) -> str:
        """Generate a consistent cache key from query and parameters."""
        key_data = f"{query}_{params or {}}"
        return f"pmo_query_{hashlib.md5(key_data.encode()).hexdigest()}"
    
    def get(self, query: str, params: Dict = None) -> Optional[Any]:
        """Get cached result for a query."""
        cache_key = self._generate_key(query, params)
        
        # Check disk cache
        if self.disk_cache:
            try:
                cached = self.disk_cache.get(cache_key)
                if cached:
                    logger.info(f"💾 Disk cache HIT for key: {cache_key[:20]}...")
                    return cached
            except Exception as e:
                logger.warning(f"Disk cache get error: {e}")
        
        logger.info(f"❌ Cache MISS for key: {cache_key[:20]}...")
        return None
    
    def set(self, query: str, data: Any, ttl: int = None, params: Dict = None) -> bool:
        """Store result in cache with TTL."""
        cache_key = self._generate_key(query, params)
        ttl = ttl or self.default_ttl
        
        # Store in disk cache
        if self.disk_cache:
            try:
                expire_time = datetime.now() + timedelta(seconds=ttl)
                self.disk_cache.set(cache_key, data, expire=expire_time)
                logger.info(f"✅ Disk cache SET for key: {cache_key[:20]}... (TTL: {ttl}s)")
                return True
            except Exception as e:
                logger.warning(f"Disk cache set error: {e}")
        
        return False
    
    def clear_cache(self, pattern: str = None) -> bool:
        """Clear all disk cache entries (pattern not supported)."""
        try:
            if self.disk_cache:
                self.disk_cache.clear()
                logger.info("🗑️ Cleared disk cache")
            return True
        except Exception as e:
            logger.error(f"Cache clear error: {e}")
            return False
    
    def get_cache_stats(self) -> Dict:
        """Get cache statistics."""
        return {
            "disk_cache_available": self.disk_cache is not None,
            "disk_cache_size": len(self.disk_cache) if self.disk_cache else 0
        }


# Global cache instance
cache_service = CacheService(
    cache_dir="cache", 
    default_ttl=300  # 5 minutes for development, increase for production
)
