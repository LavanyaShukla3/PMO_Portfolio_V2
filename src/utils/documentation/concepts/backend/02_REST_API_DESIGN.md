# REST API Design: Building Professional APIs 🎯

## REST Principles (Must Know for Interviews!)

### What is REST?
**REST** = **RE**presentational **S**tate **T**ransfer

### The Library Analogy
Think of a library:
- **Resources** = Books (each has unique ID)
- **HTTP Methods** = Actions (checkout, return, search)
- **Representations** = Book format (physical, PDF, audiobook)
- **Stateless** = Librarian doesn't remember you from yesterday

**💡 Eureka Moment:** REST is just a set of conventions for organizing APIs so they're predictable and easy to use!

---

## 6 REST Constraints (Core Principles)

### 1. Client-Server Separation
- Frontend and backend are independent
- They communicate only through API
- Can be developed/deployed separately

### 2. Stateless
- Each request contains ALL info needed
- Server doesn't remember previous requests
- No session storage on server

**Example:**
```
❌ BAD (Stateful):
Request 1: POST /login → Server stores session
Request 2: GET /profile → Server uses stored session

✅ GOOD (Stateless):
Request 1: POST /login → Returns auth token
Request 2: GET /profile + Authorization: Bearer token → Self-contained
```

### 3. Cacheable
- Responses should indicate if they can be cached
- Improves performance

**Your App Does This:**
```python
cache_service.set(cache_key, response_data, timeout=300)  # Cache for 5 min
```

### 4. Uniform Interface
- Consistent resource naming
- Standard HTTP methods
- Predictable URL structure

### 5. Layered System
- Client can't tell if connected directly to server or through intermediaries
- Can add load balancers, caches, proxies transparently

### 6. Code on Demand (Optional)
- Server can send executable code (JavaScript) to client
- Least used constraint

**💡 Eureka Moment:** Most "REST APIs" are really "HTTP APIs" - true REST is stricter! But knowing these principles makes you stand out in interviews.

---

## Resource-Based URLs (Not Action-Based!)

### The Golden Rule
URLs should represent **RESOURCES** (nouns), not **ACTIONS** (verbs)

### ✅ GOOD (Resource-Based):
```
GET    /api/portfolios          # Get all portfolios
GET    /api/portfolios/P001     # Get specific portfolio
POST   /api/portfolios          # Create new portfolio
PUT    /api/portfolios/P001     # Update entire portfolio
PATCH  /api/portfolios/P001     # Update part of portfolio
DELETE /api/portfolios/P001     # Delete portfolio

GET    /api/portfolios/P001/programs  # Get programs in portfolio
```

### ❌ BAD (Action-Based):
```
GET    /api/getPortfolios
POST   /api/createPortfolio
POST   /api/updatePortfolio
GET    /api/deletePortfolio     # Wrong method too!
GET    /api/portfolio/get/P001
```

### Your App's URLs:
```python
# Good resource-based URLs
@app.route('/api/health')                # Resource: health status
@app.route('/api/test-connection')       # Resource: connection status
@app.route('/api/data/portfolio')        # Resource: portfolio data
@app.route('/api/data/program')          # Resource: program data
@app.route('/api/data/subprogram')       # Resource: subprogram data
```

**💡 Eureka Moment:** HTTP methods are the verbs (GET, POST, DELETE). URLs are the nouns (portfolios, programs). Keep them separate!

---

## HTTP Methods & Their Meanings

### The CRUD Mapping

| Operation | HTTP Method | Example | Idempotent? | Safe? |
|-----------|-------------|---------|-------------|-------|
| **Create** | POST | Create portfolio | No | No |
| **Read** | GET | Get portfolio | Yes | Yes |
| **Update (full)** | PUT | Replace portfolio | Yes | No |
| **Update (partial)** | PATCH | Update status | No | No |
| **Delete** | DELETE | Remove portfolio | Yes | No |

**Idempotent** = Multiple identical requests have same effect as one  
**Safe** = Doesn't modify data (read-only)

### Method Details:

#### GET - Retrieve Data
```python
@app.route('/api/portfolios', methods=['GET'])
def get_portfolios():
    # Query params for filtering
    status = request.args.get('status')
    limit = request.args.get('limit', 50)
    
    portfolios = db.query(...).limit(limit)
    return jsonify(portfolios), 200
```

**Rules:**
- ✅ Should be idempotent and safe
- ✅ No request body
- ✅ Use query params for filtering
- ❌ Should NOT modify data

#### POST - Create Resource
```python
@app.route('/api/portfolios', methods=['POST'])
def create_portfolio():
    data = request.get_json()
    
    # Validate input
    if not data.get('name'):
        return jsonify({'error': 'Name required'}), 400
    
    # Create resource
    portfolio = Portfolio.create(data)
    
    # Return with 201 Created and Location header
    return jsonify(portfolio), 201, {
        'Location': f'/api/portfolios/{portfolio.id}'
    }
```

**Rules:**
- ✅ Request has body (JSON data)
- ✅ Return 201 Created on success
- ✅ Include Location header with new resource URL
- ❌ Not idempotent (creates duplicate if called twice)

#### PUT - Replace Entire Resource
```python
@app.route('/api/portfolios/<id>', methods=['PUT'])
def replace_portfolio(id):
    data = request.get_json()
    
    # All fields required
    if not all([data.get('name'), data.get('status'), data.get('owner')]):
        return jsonify({'error': 'All fields required'}), 400
    
    # Replace entire resource
    portfolio = Portfolio.get(id)
    portfolio.replace_all(data)  # Overwrites everything
    
    return jsonify(portfolio), 200
```

#### PATCH - Partial Update
```python
@app.route('/api/portfolios/<id>', methods=['PATCH'])
def update_portfolio(id):
    data = request.get_json()
    
    # Only update provided fields
    portfolio = Portfolio.get(id)
    if 'status' in data:
        portfolio.status = data['status']
    if 'name' in data:
        portfolio.name = data['name']
    
    portfolio.save()
    return jsonify(portfolio), 200
```

#### DELETE - Remove Resource
```python
@app.route('/api/portfolios/<id>', methods=['DELETE'])
def delete_portfolio(id):
    portfolio = Portfolio.get(id)
    if not portfolio:
        return jsonify({'error': 'Not found'}), 404
    
    portfolio.delete()
    
    # 204 No Content = success but no response body
    return '', 204
```

### Your App (Currently Read-Only):
```python
# Only GET methods (read-only API)
@app.route('/api/data/portfolio', methods=['GET'])
@app.route('/api/data/program', methods=['GET'])
@app.route('/api/data/subprogram', methods=['GET'])

# To add create/update later:
@app.route('/api/data/portfolio', methods=['POST'])  # Create
@app.route('/api/data/portfolio/<id>', methods=['PATCH'])  # Update
```

---

## Status Codes Deep Dive

### Success (2xx)

#### 200 OK - Standard Success
```python
return jsonify({'data': results}), 200
# Use for: GET, PUT, PATCH requests
```

#### 201 Created - Resource Created
```python
return jsonify({'id': new_id}), 201, {'Location': f'/api/resource/{new_id}'}
# Use for: POST requests that create resources
```

#### 204 No Content - Success, No Response Body
```python
return '', 204
# Use for: DELETE requests, updates with no return data
```

### Client Errors (4xx)

#### 400 Bad Request - Invalid Input
```python
if not data.get('name'):
    return jsonify({'error': 'Name is required'}), 400
# Use for: Validation errors, malformed JSON
```

#### 401 Unauthorized - Not Authenticated
```python
if not auth_token:
    return jsonify({'error': 'Authentication required'}), 401
# Use for: Missing or invalid credentials
```

#### 403 Forbidden - Not Authorized
```python
if not user.can_access(resource):
    return jsonify({'error': 'Access denied'}), 403
# Use for: User is logged in but lacks permission
```

#### 404 Not Found - Resource Doesn't Exist
```python
portfolio = Portfolio.get(id)
if not portfolio:
    return jsonify({'error': 'Portfolio not found'}), 404
```

#### 409 Conflict - Resource Conflict
```python
if Portfolio.exists(name):
    return jsonify({'error': 'Portfolio name already exists'}), 409
# Use for: Duplicate resources, version conflicts
```

#### 422 Unprocessable Entity - Semantic Error
```python
if data['start_date'] > data['end_date']:
    return jsonify({'error': 'Start date must be before end date'}), 422
# Use for: Valid JSON but business logic violation
```

### Server Errors (5xx)

#### 500 Internal Server Error - Your Code Crashed
```python
try:
    result = risky_operation()
except Exception as e:
    logger.error(f"Error: {str(e)}")
    return jsonify({'error': 'Internal server error'}), 500
```

#### 503 Service Unavailable - Temporary Issue
```python
if not databricks_client.is_connected():
    return jsonify({'error': 'Database unavailable'}), 503
# Use for: Database down, third-party API down
```

### Your App's Status Codes:
```python
# Success
return jsonify({'status': 'success', 'data': [...]}), 200

# Server error
return jsonify({'status': 'error', 'message': str(e)}), 500

# Connection test
if is_connected:
    return jsonify({'status': 'success'}), 200
else:
    return jsonify({'status': 'error'}), 500
```

**💡 Eureka Moment:** Status codes are like traffic lights - 2xx = green (go), 4xx = yellow (you messed up), 5xx = red (we messed up)!

---

## Query Parameters vs URL Parameters

### URL Parameters (Part of Path)
```python
@app.route('/api/portfolios/<portfolio_id>/programs/<program_id>')
def get_program(portfolio_id, program_id):
    return jsonify({'portfolio': portfolio_id, 'program': program_id})

# Example: GET /api/portfolios/P001/programs/PROG123
```

**Use for:**
- ✅ Identifying specific resources
- ✅ Hierarchical relationships
- ✅ Required parameters

### Query Parameters (After `?`)
```python
@app.route('/api/portfolios')
def get_portfolios():
    status = request.args.get('status')        # Optional
    limit = request.args.get('limit', 50)      # Default value
    page = request.args.get('page', 1, type=int)  # Type conversion
    
    return jsonify({'results': [...]})

# Example: GET /api/portfolios?status=active&limit=20&page=2
```

**Use for:**
- ✅ Filtering results
- ✅ Sorting
- ✅ Pagination
- ✅ Optional parameters

### Your App Uses Query Parameters:
```python
@app.route('/api/data/portfolio', methods=['GET'])
def get_portfolio_data():
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 50))
    filters = {
        'portfolio_id': request.args.get('portfolioId'),
        'status': request.args.get('status')
    }
    
# Called as: /api/data/portfolio?page=1&limit=50&portfolioId=P001&status=active
```

---

## Pagination Patterns

### Why Pagination?
Sending 10,000 records at once:
- ❌ Slow response time
- ❌ High memory usage
- ❌ Bad user experience
- ❌ Server overload

### Offset-Based Pagination (Your App Uses This!)

**Request:**
```
GET /api/portfolios?page=2&limit=50
```

**Response:**
```json
{
  "data": [...],
  "pagination": {
    "page": 2,
    "limit": 50,
    "total_items": 50,
    "total_pages": 20,
    "has_more": true
  }
}
```

**SQL Implementation:**
```sql
SELECT * FROM portfolios
OFFSET 50 ROWS      -- (page - 1) * limit
FETCH NEXT 50 ROWS ONLY  -- limit
```

**Your App's Implementation:**
```python
page = int(request.args.get('page', 1))
limit = int(request.args.get('limit', 50))

offset = (page - 1) * limit
query += f" OFFSET {offset} ROWS FETCH NEXT {limit} ROWS ONLY"

response_data = {
    'data': results,
    'pagination': {
        'page': page,
        'limit': limit,
        'total_items': len(results),
        'has_more': len(results) == limit  # If full page, probably more
    }
}
```

### Cursor-Based Pagination (More Advanced)

**Better for large datasets, real-time data**

**Request:**
```
GET /api/portfolios?cursor=abc123&limit=50
```

**Response:**
```json
{
  "data": [...],
  "pagination": {
    "next_cursor": "xyz789",
    "has_more": true
  }
}
```

**Pros:**
- ✅ Consistent results (no duplicates if data changes)
- ✅ Faster for large offsets

**Cons:**
- ❌ Can't jump to specific page
- ❌ More complex implementation

---

## API Versioning

### Why Version APIs?
Breaking changes shouldn't break existing clients!

### Method 1: URL Versioning (Most Common)
```python
@app.route('/api/v1/portfolios')  # Version 1
@app.route('/api/v2/portfolios')  # Version 2

# Can run both simultaneously!
```

### Method 2: Header Versioning
```python
@app.route('/api/portfolios')
def get_portfolios():
    version = request.headers.get('API-Version', 'v1')
    if version == 'v2':
        return handle_v2()
    return handle_v1()
```

### Method 3: Content Negotiation
```
Accept: application/vnd.myapi.v2+json
```

**Best Practice:** URL versioning (simplest and most visible)

---

## Error Response Format (Consistency Matters!)

### Standard Error Format:
```json
{
  "status": "error",
  "code": "VALIDATION_ERROR",
  "message": "Invalid input data",
  "details": {
    "field": "email",
    "reason": "Invalid email format"
  },
  "timestamp": "2025-11-11T10:30:00Z"
}
```

### Your App's Error Format:
```python
return jsonify({
    'status': 'error',
    'message': f'Failed to fetch portfolio data: {str(e)}',
    'mode': 'databricks'
}), 500
```

**Improvements You Could Add:**
```python
def error_response(message, status_code=500, error_code=None, details=None):
    response = {
        'status': 'error',
        'message': message,
        'timestamp': datetime.utcnow().isoformat()
    }
    if error_code:
        response['code'] = error_code
    if details:
        response['details'] = details
    
    return jsonify(response), status_code

# Usage
return error_response(
    'Invalid pagination parameters',
    status_code=400,
    error_code='INVALID_PARAMS',
    details={'page': 'must be positive integer'}
)
```

---

## Request Validation

### Input Validation is Critical!

#### 1. Type Validation
```python
# Bad - can crash
page = int(request.args.get('page'))

# Good - handle errors
try:
    page = int(request.args.get('page', 1))
    if page < 1:
        return jsonify({'error': 'Page must be >= 1'}), 400
except ValueError:
    return jsonify({'error': 'Page must be an integer'}), 400
```

#### 2. Required Fields
```python
@app.route('/api/portfolios', methods=['POST'])
def create_portfolio():
    data = request.get_json()
    
    required = ['name', 'owner', 'status']
    missing = [field for field in required if field not in data]
    
    if missing:
        return jsonify({
            'error': 'Missing required fields',
            'missing': missing
        }), 400
```

#### 3. Business Logic Validation
```python
if data['start_date'] > data['end_date']:
    return jsonify({'error': 'Start date must be before end date'}), 422

if data['budget'] < 0:
    return jsonify({'error': 'Budget cannot be negative'}), 422
```

### Your App's Validation:
```python
# Basic type conversion
page = int(request.args.get('page', 1))
limit = int(request.args.get('limit', 50))

# Could add:
if page < 1 or page > 1000:
    return jsonify({'error': 'Page must be between 1 and 1000'}), 400

if limit < 1 or limit > 100:
    return jsonify({'error': 'Limit must be between 1 and 100'}), 400
```

---

## HATEOAS (Hypermedia as Engine of Application State)

### Advanced REST Concept
Responses include links to related resources

```json
{
  "id": "P001",
  "name": "Digital Transformation",
  "links": {
    "self": "/api/portfolios/P001",
    "programs": "/api/portfolios/P001/programs",
    "update": "/api/portfolios/P001",
    "delete": "/api/portfolios/P001"
  }
}
```

**Benefit:** Clients discover available actions dynamically

**Reality:** Most APIs skip this (adds complexity, rarely needed)

---

## Interview Questions

### Q1: What are the main principles of REST?
**Answer:** REST has 6 constraints: client-server separation, stateless communication, cacheable responses, uniform interface, layered system, and code on demand (optional). Key ideas are resource-based URLs (nouns not verbs), using standard HTTP methods, and stateless requests where each contains all needed info.

### Q2: What's the difference between PUT and PATCH?
**Answer:** PUT replaces the entire resource (all fields must be provided), while PATCH updates only specified fields. PUT is idempotent - multiple identical requests have same effect. PATCH is typically not idempotent. Example: PUT needs {name, status, owner}, PATCH can send just {status: "active"}.

### Q3: Why should APIs be stateless?
**Answer:** Stateless APIs don't store client session data, making them easier to scale (any server can handle any request), more reliable (no session loss on server restart), and simpler (no session management). Each request includes all needed info like auth tokens.

### Q4: Explain the difference between 400, 401, 403, and 404.
**Answer:** 
- 400 Bad Request: Invalid input/malformed request (client error)
- 401 Unauthorized: No valid authentication provided (need to login)
- 403 Forbidden: Authenticated but lacks permission (access denied)
- 404 Not Found: Resource doesn't exist

### Q5: What's the difference between query parameters and path parameters?
**Answer:** Path parameters are part of the URL path (`/portfolios/P001`) and identify specific resources - they're required. Query parameters come after `?` (`?page=1&limit=50`) and are used for filtering, sorting, pagination - they're typically optional. Path params are for hierarchy, query params for options.

### Q6: How would you design pagination for a large dataset?
**Answer:** Use offset-based pagination for small-medium datasets: `?page=1&limit=50`. Return metadata: current page, total items, has_more. For large datasets or real-time data, use cursor-based pagination with opaque tokens that point to next set. Always set reasonable max limits (e.g., 100 items) to prevent abuse.

### Q7: How does your app handle errors?
**Answer:** Uses try-except blocks to catch errors, logs them with the logging module, and returns consistent error responses with status, message, and mode. Returns 500 for server errors, 200 for success. Could improve by adding specific error codes, field-level validation errors, and using more specific status codes (400 for validation, 503 for database down).

### Q8: How would you version your API?
**Answer:** Best practice is URL versioning (`/api/v1/portfolios`, `/api/v2/portfolios`) because it's explicit and allows running multiple versions simultaneously. Alternatively, can use header versioning (API-Version header) or content negotiation (Accept header), but URL versioning is simplest for clients to understand and most visible.

### Q9: What makes an API RESTful vs just HTTP-based?
**Answer:** RESTful APIs follow REST constraints: resource-based URLs (nouns), proper HTTP method usage (GET for read, POST for create), stateless requests, cacheable responses, standard status codes. Many "REST APIs" are really just HTTP APIs that don't follow all REST principles (like HATEOAS). The distinction matters for interview correctness but less in practice.

---

## Key Takeaways

✅ REST = Resource-based, uses HTTP methods properly, stateless  
✅ URLs = Nouns (resources), HTTP methods = Verbs (actions)  
✅ GET = read, POST = create, PUT = replace, PATCH = update, DELETE = remove  
✅ Status codes tell the story: 2xx success, 4xx client error, 5xx server error  
✅ Query params for filtering/pagination, URL params for resource identity  
✅ Pagination prevents overload, improves performance  
✅ Validation is essential - never trust client input  
✅ Consistent error format makes debugging easier  

**Next Step:** Move to `03_DATABASE_SQL.md` to learn database interactions!
