# Performance & Optimization: Making APIs Fast ⚡

## Why Performance Matters

### The User Experience Impact
```
0-100ms:   Instant (feels immediate)
100-300ms: Small delay (noticeable but fine)
300-1000ms: Sluggish (users get impatient)
1000ms+:   Slow (users leave!)
```

**Google Study:** 53% of mobile users abandon sites that take > 3 seconds

**💡 Eureka Moment:** Performance isn't optional - it directly impacts user retention and business success!

---

## Measuring Performance

### Key Metrics:

#### 1. Response Time
Time from request sent to response received
```python
import time

@app.route('/api/data')
def get_data():
    start = time.time()
    
    data = fetch_data()
    
    elapsed = time.time() - start
    logger.info(f"Request took {elapsed:.2f}s")
    
    return jsonify(data)
```

#### 2. Throughput
Requests per second (RPS) your server can handle
```
100 RPS = Good for small app
1000 RPS = Enterprise level
10,000 RPS = Large scale
```

#### 3. Latency Percentiles (More Important Than Average!)
```
p50 (median): 100ms  - Half of requests faster than this
p95:          200ms  - 95% of requests faster than this
p99:          500ms  - 99% of requests faster than this
p99.9:        2000ms - 99.9% faster (worst cases)
```

**Why percentiles matter:** Average can be misleading!
```
Request times: [100ms, 100ms, 100ms, 100ms, 5000ms]
Average: 1080ms (looks terrible!)
p95: 100ms (actually good!)
```

---

## Caching Strategies (Your App's Secret Weapon!)

### Cache Hierarchy:
```
Request
  ↓
1. In-Memory Cache (< 1ms)    ← Fastest
  ↓ miss
2. Disk Cache (1-10ms)         ← Your app uses this
  ↓ miss
3. Database (100-500ms)        ← Slowest
```

### Your App's Disk Cache Implementation:
```python
# cache_service.py
class CacheService:
    def __init__(self, cache_dir: str = "cache"):
        # Disk cache with 500MB limit
        self.disk_cache = dc.Cache(
            cache_dir, 
            size_limit=500_000_000  # 500MB
        )
    
    def get(self, query: str) -> Optional[Any]:
        cache_key = self._generate_key(query)
        cached = self.disk_cache.get(cache_key)
        
        if cached:
            logger.info("💾 Cache HIT!")
            return cached
        
        logger.info("❌ Cache MISS")
        return None
    
    def set(self, query: str, data: Any, ttl: int = 300):
        """Store with 5-minute default TTL."""
        cache_key = self._generate_key(query)
        self.disk_cache.set(cache_key, data, expire=ttl)
```

### Cache Key Generation (Critical!):
```python
def _generate_key(self, query: str, params: Dict = None) -> str:
    """Create unique cache key from query + params."""
    key_data = f"{query}_{params or {}}"
    return f"pmo_query_{hashlib.md5(key_data.encode()).hexdigest()}"

# Examples:
# Same query, different params = different keys
# "SELECT * WHERE page=1" → key_abc123
# "SELECT * WHERE page=2" → key_def456
```

### Cache Usage in Your Routes:
```python
@app.route('/api/data/portfolio', methods=['GET'])
def get_portfolio_data():
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 50))
    
    # Create cache key
    cache_key = f"portfolio_data_p{page}_l{limit}_{hash(str(filters))}"
    
    # 1. Try cache first (FAST!)
    cached_data = cache_service.get(cache_key)
    if cached_data:
        logger.info(f"Serving from cache: {cache_key}")
        return jsonify(cached_data)
    
    # 2. Cache miss - query database (SLOW)
    logger.info(f"Cache miss - querying database")
    results = databricks_client.execute_query(query)
    
    response_data = {
        'status': 'success',
        'data': results,
        'cache_info': {'cached': False}
    }
    
    # 3. Store for next request
    cache_service.set(cache_key, response_data, timeout=300)  # 5 min
    
    return jsonify(response_data)
```

### Cache Invalidation Strategies:

#### 1. Time-Based (TTL - Your App Uses This)
```python
# Expires after 5 minutes
cache_service.set(cache_key, data, ttl=300)
```

**Pros:** Simple, automatic cleanup  
**Cons:** Might serve stale data, might miss freshest data

#### 2. Event-Based (Manual Invalidation)
```python
@app.route('/api/portfolio/<id>', methods=['PUT'])
def update_portfolio(id):
    # Update database
    portfolio.update(data)
    
    # Invalidate related cache
    cache_service.delete(f"portfolio_{id}")
    cache_service.delete("portfolio_list")  # List also outdated
    
    return jsonify(portfolio)
```

#### 3. Cache-Aside Pattern (Most Common)
```python
def get_portfolio(id):
    # 1. Check cache
    cached = cache.get(f"portfolio_{id}")
    if cached:
        return cached
    
    # 2. Cache miss - get from DB
    portfolio = db.query(Portfolio).get(id)
    
    # 3. Store in cache
    cache.set(f"portfolio_{id}", portfolio, ttl=300)
    
    return portfolio
```

**💡 Eureka Moment:** "There are only two hard things in Computer Science: cache invalidation and naming things." - True! Cache invalidation is notoriously difficult.

---

## Response Compression (Your App Does This!)

### The Problem:
```
Uncompressed JSON: 500 KB
Network: Slow (takes 5 seconds to download)
```

### The Solution: GZIP Compression
```
Compressed JSON: 100 KB (80% reduction!)
Network: Fast (takes 1 second to download)
```

### Your App's Configuration:
```python
from flask_compress import Compress

Compress(app)

app.config['COMPRESS_MIMETYPES'] = [
    'text/html',
    'text/css',
    'text/javascript',
    'application/json',  # ← Compresses your API responses!
]
app.config['COMPRESS_LEVEL'] = 6  # Balance speed vs compression (1-9)
app.config['COMPRESS_MIN_SIZE'] = 500  # Only compress if > 500 bytes
```

**Compression Levels:**
```
Level 1: Fast compression, larger size
Level 6: Balanced (your app's choice)
Level 9: Maximum compression, slower
```

**How It Works:**
```
1. Server generates response: {"status": "success", "data": [...]}
2. Flask-Compress compresses: Binary blob (gzip)
3. Adds header: Content-Encoding: gzip
4. Browser receives, decompresses automatically
5. JavaScript sees original JSON (transparent!)
```

---

## Database Query Optimization

### 1. Use Indexes (Covered in 03_DATABASE_SQL.md)
```sql
-- Slow (table scan)
SELECT * FROM portfolios WHERE status = 'Active';  -- 5 seconds

-- Fast (index scan)
CREATE INDEX idx_status ON portfolios(status);
SELECT * FROM portfolios WHERE status = 'Active';  -- 0.01 seconds
```

### 2. Limit Results (Pagination - Your App Does This!)
```python
# ❌ BAD: Return everything
results = db.query("SELECT * FROM portfolios")  # 10,000 rows!

# ✅ GOOD: Paginate
offset = (page - 1) * limit  # page=2, limit=50 → offset=50
query += f" OFFSET {offset} ROWS FETCH NEXT {limit} ROWS ONLY"
results = db.query(query)  # 50 rows only
```

### 3. Select Only Needed Columns
```python
# ❌ BAD: Select all (wasteful)
SELECT * FROM portfolios  -- Returns 50 columns

# ✅ GOOD: Select specific
SELECT portfolio_id, name, status FROM portfolios  -- Returns 3 columns
```

### 4. Avoid N+1 Queries (Covered in 03_DATABASE_SQL.md)
```python
# ❌ BAD: N+1 queries
portfolios = get_portfolios()  # 1 query
for portfolio in portfolios:  # 100 iterations
    programs = get_programs(portfolio.id)  # 100 queries
# Total: 101 queries! 😱

# ✅ GOOD: JOIN (1 query)
query = """
    SELECT p.*, pr.program_id, pr.name
    FROM portfolios p
    LEFT JOIN programs pr ON p.id = pr.portfolio_id
"""
results = db.query(query)  # 1 query! 🎉
```

---

## Connection Pooling (Your App's Biggest Optimization!)

### The Problem:
```
Request 1: Create connection (500ms) + Query (100ms) = 600ms
Request 2: Create connection (500ms) + Query (100ms) = 600ms
Request 3: Create connection (500ms) + Query (100ms) = 600ms

Total: 1800ms for 3 requests!
```

### The Solution: Connection Pool
```
Startup: Create 12 connections (6000ms once)

Request 1: Get from pool (instant) + Query (100ms) = 100ms
Request 2: Get from pool (instant) + Query (100ms) = 100ms
Request 3: Get from pool (instant) + Query (100ms) = 100ms

Total: 300ms for 3 requests! (6x faster!) 🚀
```

### Your App's Implementation:
```python
class DatabricksConnectionPool:
    def __init__(self, pool_size: int = 12):
        self.pool = Queue(maxsize=pool_size)
        
        # Pre-create connections on startup
        logger.info(f"🔌 Initializing pool with {pool_size} connections...")
        for i in range(pool_size):
            conn = sql.connect(
                server_hostname=self.server_hostname,
                http_path=self.http_path,
                access_token=self.access_token
            )
            self.pool.put(conn)
            logger.info(f"✅ Connection {i+1}/{pool_size} created")
    
    def get_connection(self, timeout: float = 5.0):
        """Get connection from pool (instant!)"""
        conn = self.pool.get(timeout=timeout)
        return conn
    
    def return_connection(self, conn):
        """Return to pool for reuse"""
        self.pool.put(conn)

# Global instance
connection_pool = DatabricksConnectionPool(pool_size=12)
```

**Usage:**
```python
def execute_query(self, query: str):
    # Get from pool (instant!)
    connection = connection_pool.get_connection(timeout=5.0)
    
    try:
        cursor = connection.cursor()
        cursor.execute(query)
        results = cursor.fetchall()
        return results
    finally:
        cursor.close()
        connection_pool.return_connection(connection)  # Return for reuse!
```

**💡 Eureka Moment:** Connection pool = taxi stand. Taxis wait for passengers (fast) instead of passengers calling new taxis each time (slow)!

---

## Async/Concurrent Programming

### The Problem: Blocking I/O
```python
# Synchronous (blocks)
def get_all_data():
    portfolios = fetch_portfolios()    # 500ms (waiting...)
    programs = fetch_programs()        # 500ms (waiting...)
    projects = fetch_projects()        # 500ms (waiting...)
    return portfolios, programs, projects  # Total: 1500ms
```

### The Solution: Parallel Execution
```python
from concurrent.futures import ThreadPoolExecutor, as_completed

def get_all_data_parallel():
    with ThreadPoolExecutor(max_workers=3) as executor:
        # Submit all tasks at once
        future_portfolios = executor.submit(fetch_portfolios)
        future_programs = executor.submit(fetch_programs)
        future_projects = executor.submit(fetch_projects)
        
        # Wait for all to complete
        portfolios = future_portfolios.result()  # All run in parallel!
        programs = future_programs.result()
        projects = future_projects.result()
        
    return portfolios, programs, projects  # Total: 500ms (3x faster!)
```

### Your App Uses This Pattern:
```python
from concurrent.futures import ThreadPoolExecutor, as_completed

def execute_queries_parallel(queries):
    """Execute multiple queries in parallel."""
    with ThreadPoolExecutor(max_workers=len(queries)) as executor:
        # Submit all queries
        futures = {
            executor.submit(execute_query, q): name 
            for name, q in queries.items()
        }
        
        # Collect results as they complete
        results = {}
        for future in as_completed(futures):
            name = futures[future]
            results[name] = future.result()
        
    return results
```

**When to Use Parallel Execution:**
- ✅ Multiple independent I/O operations (API calls, DB queries)
- ✅ Reading multiple files
- ❌ CPU-intensive tasks (use multiprocessing instead)

---

## Profiling (Find Bottlenecks!)

### Basic Timing:
```python
import time

@app.route('/api/data')
def get_data():
    start = time.time()
    
    # Step 1
    t1 = time.time()
    cache_check = check_cache()
    logger.info(f"Cache check: {time.time() - t1:.2f}s")
    
    # Step 2
    t2 = time.time()
    db_query = execute_query()
    logger.info(f"DB query: {time.time() - t2:.2f}s")  # ← Bottleneck found!
    
    # Step 3
    t3 = time.time()
    process_results()
    logger.info(f"Processing: {time.time() - t3:.2f}s")
    
    logger.info(f"Total: {time.time() - start:.2f}s")
    return jsonify(data)
```

### Python Profiler:
```python
import cProfile

def profile_endpoint():
    profiler = cProfile.Profile()
    profiler.enable()
    
    # Code to profile
    result = get_portfolio_data()
    
    profiler.disable()
    profiler.print_stats(sort='cumulative')  # Shows slowest functions
    
    return result
```

### Flask Profiling Middleware:
```python
from werkzeug.middleware.profiler import ProfilerMiddleware

app.wsgi_app = ProfilerMiddleware(
    app.wsgi_app, 
    restrictions=[30],  # Show top 30 slowest functions
    profile_dir='./profiles'
)
```

---

## Lazy Loading vs Eager Loading

### Lazy Loading (Load When Needed)
```python
class Portfolio:
    def __init__(self, id):
        self.id = id
        self._programs = None  # Not loaded yet
    
    @property
    def programs(self):
        if self._programs is None:
            self._programs = load_programs(self.id)  # Load on access
        return self._programs

# Only loads programs if accessed
portfolio = Portfolio('P001')
print(portfolio.id)  # No DB query
print(portfolio.programs)  # Triggers DB query
```

### Eager Loading (Load Everything Upfront)
```python
# Load portfolio WITH programs in one query
query = """
    SELECT p.*, pr.program_id, pr.name
    FROM portfolios p
    LEFT JOIN programs pr ON p.id = pr.portfolio_id
    WHERE p.id = ?
"""
result = db.query(query, ('P001',))
```

**When to Use:**
- **Lazy**: Unknown if data needed, might waste resources
- **Eager**: Know data will be used, avoid N+1 queries

---

## HTTP/2 Benefits

### HTTP/1.1 (Old):
```
Request 1 → Response 1
             ↓ (wait)
             Request 2 → Response 2
                          ↓ (wait)
                          Request 3 → Response 3
```

### HTTP/2 (Modern):
```
Request 1 ↘
Request 2 → All parallel! → Response 1, 2, 3
Request 3 ↗
```

**Benefits:**
- ✅ Multiple requests on single connection (multiplexing)
- ✅ Header compression
- ✅ Server push (not widely used)

**How to Enable:**
```python
# Use HTTPS (HTTP/2 requires it)
# Modern servers (Gunicorn with gevent) support HTTP/2 automatically
```

---

## Database Connection Best Practices

### 1. Always Use Connection Pool (Your App Does This!)
```python
# ✅ GOOD
connection = pool.get_connection()

# ❌ BAD
connection = sql.connect(...)  # New connection every time!
```

### 2. Always Close/Return Connections
```python
# ✅ GOOD: Use try/finally
connection = pool.get_connection()
try:
    cursor = connection.cursor()
    cursor.execute(query)
    results = cursor.fetchall()
finally:
    cursor.close()
    pool.return_connection(connection)  # Always executes!

# ❌ BAD: If exception, connection leaks
connection = pool.get_connection()
cursor = connection.cursor()
cursor.execute(query)  # If error here, connection never returned!
pool.return_connection(connection)
```

### 3. Set Appropriate Timeouts
```python
# Prevent hanging forever
connection = pool.get_connection(timeout=5.0)  # Max 5 seconds wait

cursor.execute(query, timeout=30)  # Max 30 seconds for query
```

---

## Load Testing

### Tools:
- **Apache Bench (ab)**: Simple command-line tool
- **wrk**: Modern, scriptable
- **Locust**: Python-based, web UI
- **JMeter**: GUI, enterprise features

### Example with Apache Bench:
```bash
# 1000 requests, 10 concurrent
ab -n 1000 -c 10 http://localhost:5000/api/data/portfolio

# Results:
Requests per second: 245.67 [#/sec]
Time per request: 40.703 [ms] (mean)
Time per request: 4.070 [ms] (mean, across all concurrent requests)

Percentage of requests served within a certain time (ms)
  50%     35
  66%     38
  75%     40
  80%     42
  90%     50
  95%     60
  98%     75
  99%     85
 100%    150 (longest request)
```

**Look For:**
- ✅ p95 < 200ms (95% requests fast)
- ✅ High RPS (requests per second)
- ❌ Errors or timeouts
- ❌ Increasing response times (memory leaks)

---

## Interview Questions

### Q1: What are the main types of caching strategies?
**Answer:** Three main types: 1) In-memory (fastest, < 1ms, volatile), 2) Disk cache (fast, 1-10ms, persistent), 3) Distributed cache like Redis (shared across servers). Also cache-aside pattern (check cache, if miss load from DB and store) vs write-through (update cache on every write).

### Q2: Explain connection pooling and its benefits.
**Answer:** Connection pool maintains reusable database connections instead of creating new ones per request. Creating connections is expensive (500-1000ms). Pool pre-creates connections on startup. Requests get connection from pool (instant), use it, return it. Dramatically improves performance, limits max connections, handles concurrency. My app uses 12-connection pool for Databricks.

### Q3: What is the N+1 query problem?
**Answer:** N+1 happens when you query for list (1 query), then loop through results making additional queries (N queries). Example: fetch 100 portfolios (1 query), then for each portfolio fetch programs (100 queries) = 101 total. Solution: use JOINs or eager loading to fetch related data in single query.

### Q4: How does response compression work?
**Answer:** Server compresses response (usually gzip), adds Content-Encoding: gzip header, sends compressed bytes. Browser automatically decompresses. Can reduce response size 70-80% for JSON/HTML. My app uses Flask-Compress with level 6 compression on responses > 500 bytes. Minimal CPU cost for huge bandwidth savings.

### Q5: What's the difference between lazy loading and eager loading?
**Answer:** Lazy loading fetches data only when accessed (on-demand), eager loading fetches everything upfront. Lazy can cause N+1 if accessed in loop. Eager uses more memory but avoids multiple queries. Choose based on: if data definitely needed, eager load; if maybe needed, lazy load.

### Q6: How do you identify performance bottlenecks?
**Answer:** Use timing/profiling to measure each step. Add logging with timestamps. Use Python profiler (cProfile) to find slow functions. Monitor metrics: response time, throughput (RPS), memory usage. Use p95/p99 percentiles not just average. Load test with tools like Apache Bench to find breaking points.

### Q7: Explain how your app optimizes performance.
**Answer:** Multiple optimizations: 1) Connection pooling eliminates 500-1000ms connection overhead, 2) Disk caching with 5-min TTL caches query results, 3) Response compression reduces size 70-80%, 4) Pagination limits results to 50 rows, 5) Parallel query execution when fetching multiple independent datasets. These combined drastically improve response times.

### Q8: What is cache invalidation and why is it difficult?
**Answer:** Cache invalidation means removing/updating stale cached data. Difficult because: hard to know when data changes, multiple cache levels can get out of sync, related data may also be outdated (portfolio changes affects portfolio list). Solutions: time-based expiry (TTL), event-based (invalidate on updates), versioned cache keys.

### Q9: When should you use parallel/async execution?
**Answer:** Use for multiple independent I/O operations (API calls, DB queries, file reads) that don't depend on each other. I/O-bound tasks benefit most since they wait for external resources. For CPU-bound tasks, use multiprocessing instead (avoids GIL). My app could use parallel execution when fetching hierarchy and investment data simultaneously.

---

## Key Takeaways

✅ Caching = Fastest optimization (cache everything you can)  
✅ Connection pooling = Eliminates connection overhead (500-1000ms saved!)  
✅ Compression = Reduces response size 70-80% (users love fast downloads)  
✅ Pagination = Never return all data at once  
✅ Parallel execution = Do independent I/O operations simultaneously  
✅ Indexing = Makes database queries orders of magnitude faster  
✅ Profiling = Measure to find bottlenecks, don't guess  
✅ Load testing = Know your limits before production  

**Next Step:** Move to `06_TESTING_DEBUGGING.md` to ensure quality!
