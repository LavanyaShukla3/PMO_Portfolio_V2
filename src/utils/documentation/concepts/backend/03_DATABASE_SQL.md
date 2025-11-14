# Databases, SQL & Data Management 🗄️

## What is a Database?

### The Filing Cabinet Analogy
- **Database** = Filing cabinet
- **Tables** = Drawers
- **Rows** = Individual folders
- **Columns** = Labels on folders (Name, Date, Status)
- **Primary Key** = Unique folder number

**💡 Eureka Moment:** A database is just organized storage for data, with a query language (SQL) to find/modify that data!

---

## SQL Basics (Must Know for Backend!)

### What is SQL?
**SQL** = **S**tructured **Q**uery **L**anguage
- Standard language for talking to relational databases
- Works with MySQL, PostgreSQL, SQLite, SQL Server, **Databricks**, etc.

### Four Main Operations (CRUD):

#### 1. SELECT (Read)
```sql
-- Basic select
SELECT * FROM portfolios;

-- Select specific columns
SELECT portfolio_id, name, status FROM portfolios;

-- With WHERE clause (filtering)
SELECT * FROM portfolios 
WHERE status = 'Active' AND budget > 100000;

-- With ORDER BY (sorting)
SELECT * FROM portfolios 
ORDER BY created_date DESC;

-- With LIMIT (pagination)
SELECT * FROM portfolios 
LIMIT 50 OFFSET 100;  -- Skip 100, return 50
```

#### 2. INSERT (Create)
```sql
-- Insert one row
INSERT INTO portfolios (portfolio_id, name, status, owner)
VALUES ('P001', 'Digital Transformation', 'Active', 'John Doe');

-- Insert multiple rows
INSERT INTO portfolios (portfolio_id, name, status)
VALUES 
  ('P001', 'Portfolio A', 'Active'),
  ('P002', 'Portfolio B', 'Planning');
```

#### 3. UPDATE (Modify)
```sql
-- Update specific rows
UPDATE portfolios 
SET status = 'Completed', end_date = '2025-12-31'
WHERE portfolio_id = 'P001';

-- Update with calculation
UPDATE portfolios 
SET budget = budget * 1.10  -- 10% increase
WHERE status = 'Active';
```

#### 4. DELETE (Remove)
```sql
-- Delete specific rows
DELETE FROM portfolios 
WHERE status = 'Cancelled';

-- ⚠️ NEVER DO THIS (deletes everything!)
DELETE FROM portfolios;  -- No WHERE clause!
```

### Your App's SQL Query:
```sql
-- From hierarchy_query.sql
SELECT 
    COE_ROADMAP_ELEMENT_ID,
    COE_ROADMAP_PARENT_ID,
    DISPLAY_NAME,
    STATUS,
    START_DATE,
    FINISH_DATE
FROM roadmap_hierarchy
WHERE STATUS IN ('Active', 'Planning')
ORDER BY COE_ROADMAP_ELEMENT_ID
OFFSET 0 ROWS 
FETCH NEXT 50 ROWS ONLY;  -- Pagination!
```

**💡 Eureka Moment:** SQL reads like English! SELECT what FROM where WITH conditions.

---

## SQL JOINs (Connecting Data)

### Types of JOINs:

#### INNER JOIN (Most Common)
```sql
-- Get portfolios WITH their programs (only if program exists)
SELECT 
    p.name AS portfolio_name,
    pr.name AS program_name
FROM portfolios p
INNER JOIN programs pr ON p.portfolio_id = pr.portfolio_id;
```

**Result:** Only portfolios that have programs

#### LEFT JOIN
```sql
-- Get ALL portfolios, with programs if they exist
SELECT 
    p.name AS portfolio_name,
    pr.name AS program_name
FROM portfolios p
LEFT JOIN programs pr ON p.portfolio_id = pr.portfolio_id;
```

**Result:** All portfolios, NULL for programs if none exist

#### RIGHT JOIN
```sql
-- Get ALL programs, with portfolio if it exists
SELECT 
    p.name AS portfolio_name,
    pr.name AS program_name
FROM portfolios p
RIGHT JOIN programs pr ON p.portfolio_id = pr.portfolio_id;
```

**Result:** All programs, NULL for portfolio if not linked

#### FULL OUTER JOIN
```sql
-- Get ALL portfolios AND programs, match where possible
SELECT 
    p.name AS portfolio_name,
    pr.name AS program_name
FROM portfolios p
FULL OUTER JOIN programs pr ON p.portfolio_id = pr.portfolio_id;
```

**Result:** Everything from both tables, NULLs where no match

### Visual Representation:
```
INNER JOIN:      [A ∩ B]  Only matching rows
LEFT JOIN:       [A ∪ (A ∩ B)]  All A + matching B
RIGHT JOIN:      [(A ∩ B) ∪ B]  Matching A + all B
FULL OUTER:      [A ∪ B]  Everything
```

---

## Database Connections (How Your App Talks to DB)

### Connection Basics:
```python
# 1. Establish connection
connection = database.connect(
    host="database.server.com",
    port=443,
    username="user",
    password="secret"
)

# 2. Create cursor (executes queries)
cursor = connection.cursor()

# 3. Execute query
cursor.execute("SELECT * FROM portfolios")

# 4. Fetch results
results = cursor.fetchall()

# 5. Close connection (IMPORTANT!)
cursor.close()
connection.close()
```

### Your App's Connection (`databricks_client.py`):
```python
def connect(self) -> None:
    """Establish connection to Databricks."""
    self.connection = sql.connect(
        server_hostname=self.server_hostname,  # From env var
        http_path=self.http_path,
        access_token=self.access_token,
        _user_agent_entry="PMO-Portfolio/1.0.0"
    )
    logger.info("Successfully connected to Databricks")

def execute_query(self, query: str) -> List[Dict[str, Any]]:
    """Execute SQL and return results."""
    connection = connection_pool.get_connection(timeout=5.0)
    cursor = None
    
    try:
        cursor = connection.cursor()
        cursor.execute(query)
        
        # Fetch all rows
        rows = cursor.fetchall()
        columns = [desc[0] for desc in cursor.description]
        
        # Convert to list of dicts
        results = [dict(zip(columns, row)) for row in rows]
        
        return results
    finally:
        if cursor:
            cursor.close()
        connection_pool.return_connection(connection)
```

**💡 Eureka Moment:** Always close connections/cursors in `finally` block - prevents resource leaks!

---

## Connection Pooling (Performance Optimization!)

### The Problem:
Creating a new database connection is **SLOW** (500-1000ms!)

```python
# ❌ BAD: Create new connection every time
def get_data():
    conn = database.connect()  # 500ms
    data = conn.query("SELECT ...")  # 100ms
    conn.close()
    return data  # Total: 600ms per request!
```

### The Solution: Connection Pool

**Connection Pool** = Pre-created connections ready to use

```
┌─────────────────────────────┐
│   Connection Pool (Size 10) │
├─────────────────────────────┤
│  [Conn1] [Conn2] [Conn3]    │  ← Available
│  [Conn4] [Conn5] [Conn6]    │
│  (Conn7) (Conn8)            │  ← In use
│  [Conn9] [Conn10]           │
└─────────────────────────────┘
```

### Your App's Connection Pool (`connection_pool.py`):
```python
class DatabricksConnectionPool:
    def __init__(self, pool_size: int = 12):
        self.pool = Queue(maxsize=pool_size)
        
        # Pre-create connections
        for i in range(pool_size):
            conn = sql.connect(...)
            self.pool.put(conn)  # Add to pool
    
    def get_connection(self, timeout: float = 5.0):
        """Get connection from pool (instant!)"""
        conn = self.pool.get(timeout=timeout)
        return conn
    
    def return_connection(self, conn):
        """Return connection to pool for reuse"""
        self.pool.put(conn)

# Global pool instance
connection_pool = DatabricksConnectionPool(pool_size=12)
```

**Benefits:**
- ✅ **500-1000ms saved per query!**
- ✅ Handles concurrent requests
- ✅ Reuses connections (efficient)
- ✅ Limits max connections (prevents overload)

**Usage in Your App:**
```python
# Get from pool (fast!)
connection = connection_pool.get_connection(timeout=5.0)

try:
    cursor = connection.cursor()
    cursor.execute(query)
    results = cursor.fetchall()
finally:
    cursor.close()
    connection_pool.return_connection(connection)  # Return to pool!
```

**💡 Eureka Moment:** Connection pool is like a taxi stand - taxis wait for passengers instead of passengers waiting for new taxis to arrive!

---

## SQL Injection (Security Critical!)

### What is SQL Injection?
**Attacker manipulates SQL query by injecting malicious code**

### ❌ VULNERABLE CODE:
```python
# User input
user_id = request.args.get('id')  # Attacker sends: "1 OR 1=1"

# DANGER: String concatenation
query = f"SELECT * FROM users WHERE id = {user_id}"
# Result: SELECT * FROM users WHERE id = 1 OR 1=1
# Returns ALL users! 😱

# Or worse:
user_id = "1; DROP TABLE users; --"
query = f"SELECT * FROM users WHERE id = {user_id}"
# Result: SELECT * FROM users WHERE id = 1; DROP TABLE users; --
# DELETES ENTIRE TABLE! 💥
```

### ✅ SAFE: Parameterized Queries
```python
# Use placeholders
query = "SELECT * FROM users WHERE id = ?"
cursor.execute(query, (user_id,))  # DB driver escapes input

# Or named parameters
query = "SELECT * FROM users WHERE id = :id"
cursor.execute(query, {'id': user_id})
```

### Your App (Could Improve!):
```python
# Current: String concatenation (VULNERABLE!)
if filters.get('portfolio_id'):
    hierarchy_query += f" AND COE_ROADMAP_PARENT_ID = '{filters['portfolio_id']}'"

# Better: Use parameterized queries
query = "SELECT * FROM hierarchy WHERE parent_id = :portfolio_id"
results = databricks_client.execute_query(query, {
    'portfolio_id': filters['portfolio_id']
})
```

**💡 Eureka Moment:** NEVER build SQL with f-strings using user input! Always use parameterized queries.

---

## Database Indexing (Performance)

### What is an Index?
**Index** = Like a book's index - helps find data fast

```
Without Index (Table Scan):
Scan ALL 1,000,000 rows → 5 seconds

With Index on portfolio_id:
Lookup in index → find row → 0.01 seconds
```

### Types of Indexes:

#### Primary Key (Unique, Clustered)
```sql
CREATE TABLE portfolios (
    portfolio_id VARCHAR(50) PRIMARY KEY,  -- Automatically indexed
    name VARCHAR(200),
    status VARCHAR(50)
);
```

#### Secondary Index
```sql
-- Create index on frequently queried columns
CREATE INDEX idx_status ON portfolios(status);
CREATE INDEX idx_dates ON portfolios(start_date, end_date);
```

#### When to Use Indexes:
- ✅ Columns in WHERE clauses
- ✅ Columns in JOIN conditions
- ✅ Columns in ORDER BY
- ❌ Small tables (< 1000 rows)
- ❌ Columns that change frequently

**Trade-off:**
- ✅ Faster SELECT queries
- ❌ Slower INSERT/UPDATE/DELETE (index must update)

---

## Transactions (ACID Properties)

### What is a Transaction?
**Group of operations that must ALL succeed or ALL fail**

### Example: Bank Transfer
```python
# Must be atomic!
def transfer_money(from_account, to_account, amount):
    conn.begin_transaction()
    
    try:
        # Step 1: Deduct from sender
        cursor.execute(
            "UPDATE accounts SET balance = balance - ? WHERE id = ?",
            (amount, from_account)
        )
        
        # Step 2: Add to receiver
        cursor.execute(
            "UPDATE accounts SET balance = balance + ? WHERE id = ?",
            (amount, to_account)
        )
        
        conn.commit()  # Both succeed!
    except:
        conn.rollback()  # Both fail! Money not lost
```

### ACID Properties (Interview Favorite!):

**A - Atomicity**: All or nothing  
**C - Consistency**: Data stays valid  
**I - Isolation**: Transactions don't interfere  
**D - Durability**: Committed data persists (survives crash)

---

## ORMs (Object-Relational Mapping)

### What is an ORM?
**Converts database tables ↔ Python objects**

### Without ORM (Raw SQL):
```python
cursor.execute("SELECT * FROM portfolios WHERE id = ?", (portfolio_id,))
row = cursor.fetchone()
portfolio = {
    'id': row[0],
    'name': row[1],
    'status': row[2]
}
```

### With ORM (SQLAlchemy):
```python
from sqlalchemy import Column, String
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class Portfolio(Base):
    __tablename__ = 'portfolios'
    
    portfolio_id = Column(String(50), primary_key=True)
    name = Column(String(200))
    status = Column(String(50))

# Query (no SQL!)
portfolio = session.query(Portfolio).filter_by(
    portfolio_id=portfolio_id
).first()

# Access like object
print(portfolio.name)
print(portfolio.status)
```

### ORM Benefits:
- ✅ Less boilerplate code
- ✅ Type safety (IDE autocomplete)
- ✅ Database-agnostic (switch MySQL → PostgreSQL easily)
- ✅ Prevents SQL injection automatically

### ORM Drawbacks:
- ❌ Learning curve
- ❌ Can generate inefficient SQL
- ❌ Less control over queries

**Your App:** Uses raw SQL (fine for read-heavy, simple queries!)

---

## Database Migrations

### What are Migrations?
**Version control for database schema**

```python
# Migration 001: Create table
def upgrade():
    conn.execute("""
        CREATE TABLE portfolios (
            id VARCHAR(50) PRIMARY KEY,
            name VARCHAR(200),
            status VARCHAR(50)
        )
    """)

def downgrade():
    conn.execute("DROP TABLE portfolios")

# Migration 002: Add column
def upgrade():
    conn.execute("ALTER TABLE portfolios ADD COLUMN budget DECIMAL(15,2)")

def downgrade():
    conn.execute("ALTER TABLE portfolios DROP COLUMN budget")
```

### Tools:
- **Alembic** (works with SQLAlchemy)
- **Flask-Migrate** (Flask + Alembic)
- **Django Migrations** (built-in)

**Your App:** Doesn't need migrations (reads from existing Databricks tables!)

---

## Caching (Your App Does This!)

### Why Cache?
**Database queries are slow (100-500ms). Cache is fast (< 1ms)!**

### Cache Layers:
```
Request → [In-Memory Cache] → [Disk Cache] → [Database]
           < 1ms               1-10ms         100-500ms
```

### Your App's Caching (`cache_service.py`):
```python
class CacheService:
    def __init__(self, cache_dir: str = "cache"):
        # Disk cache (persists across restarts)
        self.disk_cache = dc.Cache(cache_dir, size_limit=500_000_000)  # 500MB
    
    def get(self, query: str) -> Optional[Any]:
        """Get cached result."""
        cache_key = self._generate_key(query)
        cached = self.disk_cache.get(cache_key)
        if cached:
            logger.info("💾 Cache HIT!")
            return cached
        logger.info("❌ Cache MISS")
        return None
    
    def set(self, query: str, data: Any, ttl: int = 300):
        """Store in cache with TTL (time to live)."""
        cache_key = self._generate_key(query)
        self.disk_cache.set(cache_key, data, expire=ttl)

# Usage in your app
@app.route('/api/data/portfolio')
def get_portfolio_data():
    cache_key = f"portfolio_p{page}_l{limit}"
    
    # Try cache first
    cached = cache_service.get(cache_key)
    if cached:
        return jsonify(cached)  # Fast path!
    
    # Cache miss - query database
    data = databricks_client.execute_query(query)
    
    # Store for next time
    cache_service.set(cache_key, data, ttl=300)  # 5 minutes
    
    return jsonify(data)
```

### Cache Invalidation (Hard Problem!):
```python
# When data changes, clear cache
def update_portfolio(portfolio_id):
    # Update database
    db.update(...)
    
    # Invalidate related cache
    cache_service.delete(f"portfolio_{portfolio_id}")
    cache_service.delete("portfolio_list")  # List also outdated
```

**💡 Eureka Moment:** "There are only two hard things in Computer Science: cache invalidation and naming things." - Phil Karlton

---

## N+1 Query Problem (Performance Killer!)

### The Problem:
```python
# 1 query for portfolios
portfolios = get_portfolios()  # SELECT * FROM portfolios

# N queries for programs (one per portfolio)
for portfolio in portfolios:  # 100 portfolios
    programs = get_programs(portfolio.id)  # SELECT * FROM programs WHERE portfolio_id = ?
    
# Total: 1 + 100 = 101 queries! 😱
```

### The Solution: JOIN or Eager Loading
```python
# 1 query with JOIN
query = """
    SELECT 
        p.*,
        pr.program_id,
        pr.name AS program_name
    FROM portfolios p
    LEFT JOIN programs pr ON p.portfolio_id = pr.portfolio_id
"""
results = execute_query(query)  # Single query!

# Group by portfolio in Python
portfolios = {}
for row in results:
    portfolio_id = row['portfolio_id']
    if portfolio_id not in portfolios:
        portfolios[portfolio_id] = {
            'id': portfolio_id,
            'name': row['name'],
            'programs': []
        }
    portfolios[portfolio_id]['programs'].append({
        'id': row['program_id'],
        'name': row['program_name']
    })
```

---

## Interview Questions

### Q1: What is SQL and what does it stand for?
**Answer:** SQL stands for Structured Query Language. It's the standard language for interacting with relational databases. Used for querying, inserting, updating, and deleting data, as well as managing database structure.

### Q2: Explain the difference between INNER JOIN and LEFT JOIN.
**Answer:** INNER JOIN returns only rows where there's a match in both tables. LEFT JOIN returns all rows from the left table, and matched rows from the right table - unmatched rows get NULL values for right table columns. Example: LEFT JOIN portfolios and programs returns all portfolios, even those without programs.

### Q3: What is SQL injection and how do you prevent it?
**Answer:** SQL injection is when attackers manipulate queries by injecting malicious SQL code through user input. Prevent by using parameterized queries (placeholders like ? or :param) instead of string concatenation. The database driver properly escapes input, making injection impossible.

### Q4: What is a database index and when should you use one?
**Answer:** An index is a data structure that speeds up data retrieval, like a book's index. Create indexes on columns frequently used in WHERE, JOIN, or ORDER BY clauses. Trade-off: faster reads but slower writes (index must update). Don't over-index - each index has storage/maintenance cost.

### Q5: Explain ACID properties.
**Answer:** ACID ensures database transaction reliability:
- **Atomicity**: All operations succeed or all fail (no partial)
- **Consistency**: Database moves from one valid state to another
- **Isolation**: Concurrent transactions don't interfere
- **Durability**: Committed changes persist (survive crashes)

### Q6: What is a connection pool and why is it important?
**Answer:** Connection pool maintains reusable database connections instead of creating new ones per request. Creating connections is expensive (500-1000ms). Pool provides instant access to pre-created connections, significantly improving performance. Must set appropriate pool size to balance resource usage and concurrency.

### Q7: What's the N+1 query problem?
**Answer:** N+1 occurs when you fetch a list (1 query), then fetch related data for each item (N queries). For 100 portfolios with programs, that's 101 queries! Solution: use JOINs or eager loading to fetch everything in one or few queries. Can drastically improve performance.

### Q8: Explain how your app uses connection pooling.
**Answer:** My app pre-creates 12 Databricks connections on startup in a thread-safe queue. When a request needs to query, it gets a connection from the pool (instant), executes the query, then returns the connection to the pool. This eliminates 500-1000ms connection overhead per request. If pool is exhausted, it creates temporary overflow connections.

### Q9: How does your caching strategy work?
**Answer:** Uses disk-based caching with 500MB limit and 5-minute TTL. For each query, generates MD5 hash as cache key. On request, checks cache first - if hit, returns immediately (< 1ms). On miss, queries Databricks (100-500ms), stores result in cache for 5 minutes, then returns. Dramatically reduces database load for repeated queries.

---

## Key Takeaways

✅ SQL = Language for database operations (SELECT, INSERT, UPDATE, DELETE)  
✅ JOINs = Connect data from multiple tables  
✅ Connection pooling = Reuse connections for massive speed boost  
✅ SQL injection = Always use parameterized queries!  
✅ Indexes = Speed up reads, slow down writes  
✅ ACID = Transaction properties ensuring data integrity  
✅ Caching = Store expensive query results for fast access  
✅ N+1 problem = Fetch related data efficiently with JOINs  

**Next Step:** Move to `04_SECURITY_AUTH.md` to learn security best practices!
