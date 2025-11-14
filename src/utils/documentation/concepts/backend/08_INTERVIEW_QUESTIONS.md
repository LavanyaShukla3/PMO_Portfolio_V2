# SDE-1 Backend Interview Questions & Answers 💼

## How to Use This Guide

Each question includes:
- ⭐ Difficulty level (⭐ Basic, ⭐⭐ Intermediate, ⭐⭐⭐ Advanced)
- 📝 Concise answer for interviews
- 💡 Follow-up topics to demonstrate deeper knowledge
- 🔗 Related concepts

---

## Fundamentals

### Q1: What is an API? ⭐
**Answer:** API (Application Programming Interface) is a set of rules defining how applications communicate. It specifies available endpoints, required inputs, and expected outputs. Like a restaurant menu - shows what you can order and what you'll get.

**Follow-up:** REST APIs use HTTP methods and resource-based URLs. Your app exposes `/api/data/portfolio` for getting portfolio data.

---

### Q2: Explain the client-server model. ⭐
**Answer:** Client (browser/app) sends requests, server processes and returns responses. Client initiates, server responds. One server can serve many clients. Communication happens over network using protocols like HTTP.

**Follow-up:** In your app, React (client) requests data from Flask API (server) which queries Databricks (backend service).

---

### Q3: What is HTTP and what are the main methods? ⭐
**Answer:** HTTP is protocol for client-server communication. Main methods:
- GET: Retrieve data (safe, idempotent)
- POST: Create resource
- PUT: Replace entire resource (idempotent)
- PATCH: Update part of resource
- DELETE: Remove resource (idempotent)

**Follow-up:** Safe means no side effects, idempotent means multiple identical requests have same effect as one.

---

### Q4: Explain HTTP status codes. ⭐
**Answer:** 
- 2xx: Success (200 OK, 201 Created, 204 No Content)
- 3xx: Redirection (301 Permanent, 302 Temporary)
- 4xx: Client error (400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found)
- 5xx: Server error (500 Internal Server Error, 503 Service Unavailable)

**Follow-up:** Always return appropriate status codes. 400 for validation errors, 401 for missing auth, 500 for crashes.

---

### Q5: What is JSON and why is it used in APIs? ⭐
**Answer:** JSON (JavaScript Object Notation) is lightweight, text-based data format. Language-independent, human-readable, easy to parse. Standard for API data exchange because it's simpler than XML and supported everywhere.

**Follow-up:** JSON has strict rules - double quotes for keys, no trailing commas, limited data types.

---

## Flask Specific

### Q6: What is Flask and how does it compare to Django? ⭐⭐
**Answer:** Flask is micro web framework - minimal core with extensions for additional features. Django is full-featured with built-in admin, ORM, auth. Flask is lighter, more flexible, better for APIs. Django better for traditional web apps with standard patterns.

**Follow-up:** Flask uses decorators for routing (@app.route), is WSGI-compliant, and follows explicit-is-better-than-implicit philosophy.

---

### Q7: Explain Flask routing and the request object. ⭐⭐
**Answer:** Routing maps URLs to functions using @app.route decorator. Request object provides access to incoming request data - query params (request.args), headers (request.headers), JSON body (request.get_json()), method (request.method). It's thread-local so safe in concurrent requests.

**Follow-up:** Can define dynamic routes with `<variable>` and type converters like `<int:id>`.

---

### Q8: How do you handle errors in Flask? ⭐⭐
**Answer:** Use try-except blocks for specific errors with appropriate status codes. Use @app.errorhandler decorators for global error handling (404, 500, Exception). Always log errors with exc_info=True. Return consistent error format with status, message, and details.

**Follow-up:** Use finally blocks for cleanup (closing connections). Can create custom exception classes for business logic errors.

---

### Q9: What Flask extensions does your app use and why? ⭐⭐
**Answer:** 
- Flask-CORS: Allows cross-origin requests from React frontend (different domain/port)
- Flask-Compress: GZIP compression reduces response size 70-80%
- python-dotenv: Loads environment variables from .env file

**Follow-up:** CORS adds Access-Control-Allow-Origin headers. Compression only applies to responses > 500 bytes by default.

---

## REST API Design

### Q10: What is REST and what are its principles? ⭐⭐
**Answer:** REST (Representational State Transfer) is architectural style for APIs. Principles:
- Resource-based URLs (nouns not verbs)
- Use standard HTTP methods
- Stateless (each request self-contained)
- Cacheable responses
- Uniform interface
- Client-server separation

**Follow-up:** Most "REST APIs" don't follow all constraints (like HATEOAS). True REST is stricter than typical HTTP APIs.

---

### Q11: URL parameters vs query parameters - when to use each? ⭐⭐
**Answer:** URL parameters (`/portfolio/P001`) identify specific resources, are part of path, required. Query parameters (`?page=1&limit=50`) filter/modify results, come after `?`, optional. URL params for hierarchy, query params for options.

**Follow-up:** Your app uses query params for pagination and filtering since they're optional.

---

### Q12: Design a RESTful API for a blog system. ⭐⭐⭐
**Answer:**
```
GET    /api/posts              # List all posts
POST   /api/posts              # Create post
GET    /api/posts/:id          # Get specific post
PUT    /api/posts/:id          # Update entire post
PATCH  /api/posts/:id          # Update part of post
DELETE /api/posts/:id          # Delete post

GET    /api/posts/:id/comments # Get post's comments
POST   /api/posts/:id/comments # Add comment to post

GET    /api/users/:id/posts    # Get user's posts
```

**Follow-up:** Include pagination (?page=1&limit=20), filtering (?status=published), sorting (?sort=created_at:desc).

---

### Q13: How would you version an API? ⭐⭐
**Answer:** Three methods:
1. URL versioning (`/api/v1/posts`) - most common, explicit
2. Header versioning (API-Version: v1) - cleaner URLs
3. Content negotiation (Accept: application/vnd.api.v1+json) - most RESTful

**Follow-up:** URL versioning is simplest and most visible. Can run multiple versions simultaneously during migration.

---

## Database & SQL

### Q14: Explain the difference between INNER JOIN and LEFT JOIN. ⭐⭐
**Answer:** INNER JOIN returns only rows with matches in both tables. LEFT JOIN returns all rows from left table plus matched rows from right (NULL if no match). Use INNER when need both sides, LEFT when want all from one side regardless.

**Follow-up:** RIGHT JOIN is reverse of LEFT. FULL OUTER JOIN returns everything from both tables.

---

### Q15: What is SQL injection and how do you prevent it? ⭐⭐⭐
**Answer:** SQL injection is when attackers inject malicious SQL through user input. Example: username = "admin' OR '1'='1" bypasses authentication. Prevent with parameterized queries (placeholders) - database driver escapes input. Never concatenate user input into SQL strings.

**Follow-up:** Your app's current code vulnerable - uses f-strings to build queries. Should use parameterized queries with named parameters.

---

### Q16: What is a database index and when should you create one? ⭐⭐
**Answer:** Index is data structure that speeds lookups (like book index). Create on columns frequently in WHERE, JOIN, ORDER BY clauses. Trade-off: faster reads but slower writes (index must update). Don't over-index - each has storage and maintenance cost.

**Follow-up:** Primary keys automatically indexed. Composite indexes for multiple columns used together.

---

### Q17: Explain ACID properties. ⭐⭐⭐
**Answer:** Ensures database transaction reliability:
- **Atomicity**: All operations succeed or all fail (no partial)
- **Consistency**: Database moves from valid state to valid state
- **Isolation**: Concurrent transactions don't interfere
- **Durability**: Committed changes persist (survive crashes)

**Follow-up:** Example: bank transfer must deduct from sender AND add to receiver, or neither.

---

### Q18: What is the N+1 query problem and how do you fix it? ⭐⭐⭐
**Answer:** N+1 occurs when querying list (1 query), then looping to fetch related data (N queries). For 100 portfolios fetching programs each = 101 queries. Fix with JOINs or eager loading to fetch everything in one/few queries.

**Follow-up:** Can drastically impact performance. Use query profiling to detect. ORMs often cause this with lazy loading.

---

## Performance & Optimization

### Q19: Explain your app's caching strategy. ⭐⭐⭐
**Answer:** Uses disk-based caching (diskcache) with 500MB limit. For each query, generates MD5 hash as cache key including parameters. Checks cache first - if hit returns immediately (< 1ms). On miss, queries Databricks (100-500ms), caches result with 5-minute TTL, returns data.

**Follow-up:** Could upgrade to Redis for distributed caching across multiple servers. Cache invalidation is hard problem - currently using time-based expiry.

---

### Q20: What is connection pooling and why is it critical? ⭐⭐⭐
**Answer:** Connection pool maintains reusable database connections instead of creating new ones per request. Creating connections expensive (500-1000ms). Pool pre-creates connections on startup in queue. Requests get connection instantly, use it, return to pool. Dramatically improves performance and limits max connections.

**Follow-up:** Your app uses 12-connection pool. Formula: connections = (2 × CPU cores) + 1 for balanced sizing.

---

### Q21: How does response compression work in your app? ⭐⭐
**Answer:** Flask-Compress automatically GZIP compresses responses. Reduces JSON size 70-80%. Server compresses, adds Content-Encoding: gzip header, sends compressed bytes. Browser decompresses automatically. Only compresses responses > 500 bytes. Uses level 6 compression (balanced speed/size).

**Follow-up:** Minimal CPU cost for huge bandwidth savings. Critical for mobile users on slow connections.

---

### Q22: Explain lazy loading vs eager loading. ⭐⭐
**Answer:** Lazy loading fetches data only when accessed (on-demand). Eager loading fetches everything upfront. Lazy can cause N+1 in loops. Eager uses more memory but avoids multiple queries. Choose based on usage: if definitely needed, eager; if maybe needed, lazy.

**Follow-up:** ORMs typically lazy load by default. Can explicitly eager load with joins or fetch strategies.

---

### Q23: How would you optimize a slow database query? ⭐⭐⭐
**Answer:** 
1. Add indexes on filtered/joined columns
2. Select only needed columns (not SELECT *)
3. Paginate results (LIMIT/OFFSET)
4. Avoid N+1 with JOINs
5. Cache frequently accessed data
6. Use EXPLAIN to analyze query plan
7. Consider denormalization for read-heavy

**Follow-up:** Measure first, optimize second. Use profiling to find actual bottleneck.

---

## Security & Authentication

### Q24: What's the difference between authentication and authorization? ⭐
**Answer:** Authentication verifies identity ("who are you?") - like showing ID. Authorization determines permissions ("what can you do?") - like checking guest list. User can be authenticated but not authorized for specific resource.

**Follow-up:** 401 Unauthorized for missing authentication, 403 Forbidden for insufficient permissions.

---

### Q25: Explain how JWT authentication works. ⭐⭐⭐
**Answer:** JWT (JSON Web Token) is stateless auth. Server creates token containing user data, signs with secret key, returns to client. Client stores token and sends in Authorization header (Bearer token) with each request. Server verifies signature and extracts user data without database lookup. Token expires after set time.

**Follow-up:** JWT structure: header.payload.signature (base64 encoded). Can't revoke before expiration. Include exp claim for expiry.

---

### Q26: What is CORS and why do you need it? ⭐⭐
**Answer:** CORS (Cross-Origin Resource Sharing) allows cross-origin requests. Browsers block requests to different origins (protocol + domain + port) by default for security. Server adds CORS headers to allow specific origins. Your app needs CORS because React (localhost:3000) and Flask (localhost:5000) are different origins.

**Follow-up:** Preflight request (OPTIONS) checks permissions before actual request. Access-Control-Allow-Origin header specifies allowed origins.

---

### Q27: How should passwords be stored? ⭐⭐
**Answer:** Never store plain passwords! Use strong hashing (bcrypt, argon2, scrypt) with salt. Hashing is one-way - can't reverse. Salt is random data added before hashing, ensures same password has different hash. Use slow algorithms to prevent brute force. Verify by hashing input and comparing hashes.

**Follow-up:** Never use MD5/SHA1 (too fast, broken). Work factor (iterations) adjustable to stay secure as hardware improves.

---

### Q28: What security vulnerabilities should backend developers know? ⭐⭐⭐
**Answer:**
- SQL Injection: Parameterized queries
- XSS: Escape output (less relevant for JSON APIs)
- CSRF: Token validation (not needed for token-based auth)
- Insecure Direct Object References: Authorization checks
- Sensitive Data Exposure: Don't return password hashes, internal fields
- Insufficient Logging: Log security events
- Rate Limiting: Prevent abuse

**Follow-up:** OWASP Top 10 is essential reading. Always validate input, sanitize output, use HTTPS.

---

## Testing & Debugging

### Q29: What's the difference between unit and integration tests? ⭐⭐
**Answer:** Unit tests test individual functions in isolation, mocking external dependencies. Fast and numerous. Integration tests test multiple components together, including real database/API calls. Slower but verify components work together. Unit tests catch logic bugs, integration tests catch integration issues.

**Follow-up:** Testing pyramid: many unit tests, moderate integration tests, few E2E tests.

---

### Q30: What is Test-Driven Development (TDD)? ⭐⭐
**Answer:** TDD is writing tests before code. Process: 1) Write failing test (red), 2) Write minimal code to pass (green), 3) Refactor while keeping tests green. Forces thinking about requirements first. Provides better design and comprehensive tests.

**Follow-up:** Benefits: confidence in refactoring, living documentation, fewer bugs. Requires discipline and experience.

---

### Q31: How do you debug production issues without a debugger? ⭐⭐⭐
**Answer:** Use extensive logging with proper levels and context (request IDs). Log inputs, outputs, intermediate values. Check exception tracebacks to identify error location. Use monitoring/alerting to detect issues. Reproduce locally with production-like data if possible. Add temporary verbose logging if needed.

**Follow-up:** Structured logging (JSON) makes parsing easier. Centralized logging (ELK, Datadog) essential for distributed systems.

---

### Q32: What is mocking and when should you use it? ⭐⭐
**Answer:** Mocking replaces real objects with fake ones simulating behavior. Use for external dependencies (databases, APIs, file systems) in unit tests. Makes tests fast, deterministic, independent. Avoids hitting rate limits or costing money. Can control return values and verify interactions.

**Follow-up:** Python's unittest.mock provides patch decorator. Be careful not to mock too much - integration tests still needed.

---

## Deployment & DevOps

### Q33: Why can't Flask's dev server be used in production? ⭐⭐
**Answer:** Flask dev server is single-threaded, not secure, crashes easily. Designed for development with auto-reload. Production needs multi-process/multi-threaded WSGI server like Gunicorn that handles concurrent requests, recovers from errors, follows security best practices.

**Follow-up:** WSGI (Web Server Gateway Interface) is standard for Python web apps to communicate with web servers.

---

### Q34: What is Gunicorn and how do you configure it? ⭐⭐⭐
**Answer:** Gunicorn is Python WSGI server for production. Pre-fork worker model creates multiple processes handling requests concurrently. Each worker can run threads. Basic config: `gunicorn --bind 0.0.0.0:5000 --workers 4 --threads 2 app:app`. Workers = (2 × CPU) + 1. Timeout for long requests.

**Follow-up:** 4 workers × 2 threads = 8 concurrent requests. Can use different worker classes (sync, gevent, uvicorn for async).

---

### Q35: What is Docker and why use it? ⭐⭐⭐
**Answer:** Docker packages application and dependencies into containers running identically anywhere. Benefits: consistency across environments, isolation, easy deployment, version control for entire environment, efficient resource usage. Dockerfile defines image, docker-compose orchestrates multiple containers.

**Follow-up:** Containers vs VMs: containers share OS kernel (lighter), VMs include full OS (heavier). Docker images are layered for efficiency.

---

### Q36: Explain CI/CD. ⭐⭐
**Answer:** CI (Continuous Integration) automatically tests code on every commit to catch bugs early. CD (Continuous Deployment) automatically deploys if tests pass. Pipeline: commit → run tests → build → deploy. Benefits: faster releases, fewer bugs reach production, consistent process.

**Follow-up:** Tools: GitHub Actions, GitLab CI, Jenkins, CircleCI. Can have staging environment between CI and production CD.

---

### Q37: What is a reverse proxy and why use Nginx? ⭐⭐⭐
**Answer:** Reverse proxy sits in front of application servers handling requests first. Nginx provides: SSL termination, load balancing across multiple instances, static file serving, request routing, security (hide backend structure). More efficient at handling connections than Python apps.

**Follow-up:** Nginx can handle thousands of concurrent connections with minimal memory. Acts as buffer protecting backend.

---

### Q38: How do you handle environment-specific configuration? ⭐⭐
**Answer:** Use environment variables for configuration that changes per environment. Store in .env locally (don't commit!), set by platform in production (Heroku config, Docker secrets). Have separate config classes (Development, Production, Testing) loaded based on FLASK_ENV variable.

**Follow-up:** 12-factor app principles: config in environment, codebase in version control. Use secrets managers (AWS Secrets Manager) for production.

---

### Q39: Horizontal vs vertical scaling - which is better? ⭐⭐⭐
**Answer:** Vertical scaling increases single server capacity (more CPU/RAM) - simple but limited and expensive, single point of failure. Horizontal scaling adds more servers with load balancer - better availability, theoretically unlimited, fault tolerant. Requires stateless app and shared data store. Horizontal is generally better for production.

**Follow-up:** Your app is horizontally scalable - stateless, uses shared Databricks, cache could be Redis for sharing.

---

## System Design

### Q40: Design a URL shortener service. ⭐⭐⭐
**Answer:**
**Requirements:** Shorten URLs, redirect to original, track clicks

**API:**
```
POST /api/shorten - Create short URL
GET  /:shortCode - Redirect to original
GET  /api/stats/:shortCode - Get click stats
```

**Database:**
```sql
urls (
  id, short_code (unique, indexed), 
  original_url, created_at, clicks
)
```

**Key Generation:** Base62 encoding (a-z, A-Z, 0-9) of auto-increment ID or hash. 6 chars = 62^6 = 56 billion URLs.

**Caching:** Cache short_code → original_url for fast redirects.

**Follow-up:** Handle collisions (rare with hash), expiration, custom URLs, rate limiting, analytics.

---

### Q41: How would you design a rate limiter? ⭐⭐⭐
**Answer:**
**Algorithms:**
1. **Token Bucket**: Bucket fills with tokens at fixed rate, request consumes token
2. **Fixed Window**: Count requests in time window (e.g., 100 per hour)
3. **Sliding Window**: Rolling window for smoother limiting

**Implementation:**
```python
# Redis-based
key = f"ratelimit:{user_id}:{current_hour}"
count = redis.incr(key)
redis.expire(key, 3600)  # 1 hour
if count > 100:
    return 429 Too Many Requests
```

**Follow-up:** Can use different limits per endpoint, user tier. Distributed systems need shared storage (Redis).

---

### Q42: Design a caching layer for your API. ⭐⭐⭐
**Answer:**
**Layers:**
```
Request → In-Memory (< 1ms) → Disk (1-10ms) → Database (100-500ms)
```

**Strategy:** Cache-aside pattern
1. Check cache
2. If miss, query database
3. Store in cache with TTL
4. Return data

**Key Design:**
```python
cache_key = f"{endpoint}_{hash(params)}"
```

**Invalidation:**
- Time-based: TTL (5 minutes)
- Event-based: Clear on updates
- LRU: Evict least recently used when full

**Follow-up:** Your app uses disk cache (diskcache). Could upgrade to Redis for sharing across servers, add memory cache layer for frequently accessed items.

---

## Behavioral (Your Project)

### Q43: Walk me through your Flask app architecture. ⭐⭐⭐
**Answer:**
**Flow:**
```
React Frontend
    ↓ HTTP Request
Flask API (app.py)
    ↓ Check cache (cache_service.py)
    ↓ If miss, get connection (connection_pool.py)
    ↓ Execute query (databricks_client.py)
    ↓ Return to pool
    ↓ Cache result
    ↓ Compress response (Flask-Compress)
    ↓ Add CORS headers (Flask-CORS)
    ↓ Return JSON
```

**Key optimizations:**
- Connection pooling (eliminates 500-1000ms)
- Disk caching with 5-min TTL
- Response compression (70-80% smaller)
- Pagination (limit results)

---

### Q44: What was the biggest performance problem you solved? ⭐⭐⭐
**Answer:** Connection overhead - creating new Databricks connection per request took 500-1000ms. Implemented connection pool with 12 pre-created connections. Requests now get connection instantly from pool, use it, return it. Reduced query time from ~1000ms to ~100ms (10x improvement).

**Follow-up:** Also added disk caching with 5-min TTL. Cache hits return in < 1ms. Combined with compression, these optimizations drastically improved user experience.

---

### Q45: If you could improve one thing in your app, what would it be? ⭐⭐
**Answer:** Add JWT authentication - currently no user auth. Would implement login endpoint returning JWT, middleware to verify token on protected routes, role-based authorization for different user types. Also add SQL injection protection with parameterized queries instead of string concatenation.

**Follow-up:** Would also add comprehensive test suite (currently none), CI/CD pipeline, monitoring/alerting (Sentry), API documentation (Swagger).

---

## Quick Fire Rounds

### General Backend ⭐
- **Synchronous vs Asynchronous?** Sync blocks waiting for I/O, async does other work while waiting
- **Monolith vs Microservices?** Monolith single app, microservices multiple small services
- **HTTP vs HTTPS?** HTTPS is HTTP with SSL/TLS encryption
- **Cookie vs Token?** Cookie server-managed, token client-managed
- **SQL vs NoSQL?** SQL relational/structured, NoSQL flexible schema

### Flask ⭐
- **Flask vs FastAPI?** FastAPI async-native, automatic docs, type hints required
- **Blueprint?** Organizes routes into modules
- **g object?** Thread-local storage for request-specific data
- **session vs g?** session persists across requests, g only during request

### Performance ⭐⭐
- **Database replication?** Master for writes, replicas for reads (scales reads)
- **CDN?** Caches static content close to users geographically
- **Message Queue?** Async task processing (Celery, RabbitMQ)
- **Load Balancer?** Distributes requests across multiple servers

### Security ⭐⭐
- **HTTPS certificate?** Proves server identity, enables encryption
- **OAuth?** Delegated authorization (login with Google)
- **API Gateway?** Single entry point, handles auth, rate limiting, routing
- **Secret rotation?** Periodically change secrets to limit damage if leaked

---

## Key Takeaways for Interviews

✅ **Know your project deeply** - Be ready to explain every design decision  
✅ **Use analogies** - Makes complex concepts clearer  
✅ **Discuss trade-offs** - Every design has pros/cons  
✅ **Show growth mindset** - "I'd improve X by doing Y"  
✅ **Connect to your app** - Use concrete examples from your code  
✅ **Practice out loud** - Explaining is different from understanding  
✅ **Ask clarifying questions** - Shows thoughtful analysis  
✅ **Start simple, then elaborate** - Give concise answer first  

**Remember:** Interviewers want to see:
1. Problem-solving ability
2. Communication skills
3. Depth of knowledge
4. Learning attitude
5. Real experience (your project!)

Good luck! 🚀
