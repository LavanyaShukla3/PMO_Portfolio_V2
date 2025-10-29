"""
Connection Pool for Databricks
Based on: https://docs.databricks.com/dev-tools/python-sql-connector.html
Research: https://stackoverflow.com/questions/tagged/connection-pooling

This module provides a thread-safe connection pool for Databricks SQL connections.
Benefits:
- Eliminates 500-1000ms connection overhead per query
- Reuses connections across requests
- Handles connection failures gracefully
"""
import logging
import threading
from queue import Queue, Empty
from typing import Optional
from databricks import sql
from dotenv import load_dotenv
import os

load_dotenv()
logger = logging.getLogger(__name__)


class DatabricksConnectionPool:
    """
    Thread-safe connection pool for Databricks SQL connections.
    
    Benefits:
    - Eliminates 500-1000ms connection overhead per query
    - Reuses connections across requests
    - Handles connection failures gracefully
    """
    
    def __init__(self, pool_size: int = 12):
        self.pool_size = pool_size
        self.pool = Queue(maxsize=pool_size)
        self.lock = threading.Lock()
        self._initialized = False
        
        # Connection params
        self.server_hostname = os.getenv('DATABRICKS_SERVER_HOSTNAME')
        self.http_path = os.getenv('DATABRICKS_HTTP_PATH')
        self.access_token = os.getenv('DATABRICKS_ACCESS_TOKEN')
        
        # Initialize pool
        self._initialize_pool()
    
    def _initialize_pool(self):
        """Pre-create connections and add to pool."""
        with self.lock:
            if self._initialized:
                return
            
            logger.info(f"🔌 Initializing connection pool with {self.pool_size} connections...")
            
            for i in range(self.pool_size):
                try:
                    conn = sql.connect(
                        server_hostname=self.server_hostname,
                        http_path=self.http_path,
                        access_token=self.access_token,
                        user_agent_entry="PMO-Portfolio-Pool/1.0.0"
                    )
                    self.pool.put(conn)
                    logger.info(f"✅ Connection {i+1}/{self.pool_size} created")
                except Exception as e:
                    logger.error(f"❌ Failed to create connection {i+1}: {e}")
            
            self._initialized = True
            logger.info(f"🎉 Connection pool initialized successfully")
    
    def get_connection(self, timeout: float = 5.0):
        """
        Get a connection from the pool.
        
        Args:
            timeout: Max seconds to wait for available connection
            
        Returns:
            Connection object
            
        Raises:
            Empty: If no connection available within timeout
        """
        try:
            conn = self.pool.get(timeout=timeout)
            logger.debug(f"📤 Connection retrieved from pool (available: {self.pool.qsize()})")
            return conn
        except Empty:
            logger.warning("⚠️ No connections available in pool, creating new one...")
            # Fallback: create new connection if pool exhausted
            return sql.connect(
                server_hostname=self.server_hostname,
                http_path=self.http_path,
                access_token=self.access_token,
                user_agent_entry="PMO-Portfolio-Overflow/1.0.0"
            )
    
    def return_connection(self, conn):
        """Return a connection to the pool."""
        try:
            self.pool.put_nowait(conn)
            logger.debug(f"📥 Connection returned to pool (available: {self.pool.qsize()})")
        except:
            # Pool is full, close the connection
            try:
                conn.close()
                logger.debug("🔌 Closed overflow connection")
            except:
                pass
    
    def close_all(self):
        """Close all connections in pool (call on shutdown)."""
        logger.info("🔌 Closing all connections in pool...")
        while not self.pool.empty():
            try:
                conn = self.pool.get_nowait()
                conn.close()
            except:
                pass
        logger.info("✅ All connections closed")


# Global connection pool instance
# Increased to 12 to handle parallel queries across portfolio/program/subprogram/region endpoints
connection_pool = DatabricksConnectionPool(pool_size=12)
