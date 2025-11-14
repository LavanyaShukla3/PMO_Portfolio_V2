# Backend Basics: Your Starting Point 🚀

## What Even IS Backend? (Absolute Basics)

### The Restaurant Analogy
Think of a restaurant:
- **Frontend** = Dining area (what customers see: menu, tables, decorations)
- **Backend** = Kitchen (where food is prepared, ingredients stored)
- **API** = Waiter (takes orders from dining area to kitchen, brings food back)

**💡 Eureka Moment:** Backend is the "brain" of your application - it handles logic, stores data, and makes decisions. Frontend just displays what backend tells it to show!

---

## How The Web Works (You MUST Know This!)

### The Client-Server Model

```
[Your Browser]  ----REQUEST---->  [Server/Backend]
  (Frontend)                      (Your Flask App)
               <----RESPONSE----   
```

**Step-by-step what happens:**
1. You type `localhost:3000` in browser
2. Browser sends **HTTP Request** to server
3. Server (your Flask app) processes request
4. Server sends back **HTTP Response** (HTML/JSON/data)
5. Browser displays the response

### In YOUR App:
- **Frontend**: React app running on `localhost:3000`
- **Backend**: Flask app running on `localhost:5000` (or similar)
- When you click a button in React, it sends HTTP request to Flask
- Flask queries Databricks, processes data, sends JSON back
- React displays the data

---

## What is HTTP? (Hypertext Transfer Protocol)

### Simple Definition
HTTP = The "language" browsers and servers use to talk to each other

### HTTP Request Structure
```
GET /api/portfolio HTTP/1.1        ← Method + Path
Host: localhost:5000               ← Headers
Authorization: Bearer token123
Content-Type: application/json

{ "page": 1, "limit": 50 }         ← Body (optional)
```

### HTTP Response Structure
```
HTTP/1.1 200 OK                    ← Status Code
Content-Type: application/json     ← Headers
Cache-Control: max-age=300

{"status": "success", "data": [...]} ← Body
```

**💡 Eureka Moment:** HTTP is just text! Servers and browsers just send formatted text messages back and forth.

---

## HTTP Methods (Verbs)

| Method | Purpose | Example | Has Body? |
|--------|---------|---------|-----------|
| **GET** | Retrieve data | Get list of portfolios | No |
| **POST** | Create new resource | Create new project | Yes |
| **PUT** | Update entire resource | Update project details | Yes |
| **PATCH** | Update part of resource | Update project status only | Yes |
| **DELETE** | Remove resource | Delete project | No |

### In YOUR App (from `app.py`):
```python
@app.route('/api/health', methods=['GET'])  # ← GET method
def health_check():
    return jsonify({'status': 'healthy'})

@app.route('/api/data/portfolio', methods=['GET'])  # ← GET with query params
def get_portfolio_data():
    page = request.args.get('page', 1)  # Read from URL: ?page=1
    # ... fetch and return data
```

---

## HTTP Status Codes (MEMORIZE THESE!)

### Success Codes (2xx)
- **200 OK**: Request succeeded, here's your data
- **201 Created**: New resource created successfully
- **204 No Content**: Success, but no data to return

### Client Error (4xx) - User's Fault
- **400 Bad Request**: Invalid input/malformed request
- **401 Unauthorized**: Need to login first
- **403 Forbidden**: Logged in but don't have permission
- **404 Not Found**: Resource doesn't exist

### Server Error (5xx) - Your Fault!
- **500 Internal Server Error**: Your code crashed
- **503 Service Unavailable**: Server overloaded/down

### In YOUR App:
```python
@app.route('/api/test-connection', methods=['GET'])
def test_databricks_connection():
    try:
        is_connected = databricks_client.test_connection()
        if is_connected:
            return jsonify({'status': 'success'}), 200  # ← Explicit 200
        else:
            return jsonify({'status': 'error'}), 500    # ← Server error
    except Exception as e:
        return jsonify({'error': str(e)}), 500          # ← Caught error
```

**💡 Eureka Moment:** Status codes are like emoji for HTTP - they quickly tell you if things went 😊 (2xx), 😕 (4xx), or 💥 (5xx)!

---

## What is an API? (Application Programming Interface)

### The Contract Analogy
API = A menu at a restaurant
- **Menu items** = Available endpoints (`/api/health`, `/api/portfolio`)
- **Item description** = What data you need to send
- **Price** = What you get back

### REST API (Most Common Type)
**REST** = Representational State Transfer (fancy way of saying "organized way to access resources")

**REST Principles:**
1. **Resources** have unique URLs: `/api/portfolio/123`
2. Use **HTTP methods** properly: GET to read, POST to create
3. **Stateless**: Each request independent (no memory between requests)
4. Return data in **standard format** (usually JSON)

### YOUR App is a REST API!
```python
# Each route is an API endpoint:
@app.route('/api/health')           # Endpoint 1: Health check
@app.route('/api/data/portfolio')   # Endpoint 2: Get portfolios
@app.route('/api/data/program')     # Endpoint 3: Get programs
```

**💡 Eureka Moment:** API is just a fancy word for "functions that other programs can call over the internet"!

---

## JSON (JavaScript Object Notation)

### What is JSON?
The universal language for APIs to send data (like how English is for humans)

```json
{
  "status": "success",
  "data": {
    "portfolio_id": "P001",
    "name": "Digital Transformation",
    "programs": ["Prog1", "Prog2"]
  },
  "metadata": {
    "page": 1,
    "total": 100
  }
}
```

**Key Rules:**
- Keys MUST be in "double quotes"
- Values can be: string, number, boolean, array, object, null
- No trailing commas
- No comments allowed

### In YOUR App:
```python
# Flask automatically converts Python dict to JSON
return jsonify({
    'status': 'success',
    'data': hierarchy_results,  # List of dicts
    'pagination': {
        'page': page,
        'limit': limit
    }
})
```

**💡 Eureka Moment:** JSON is just Python dictionaries but stricter! Flask's `jsonify()` does all the conversion for you.

---

## Request-Response Lifecycle (How YOUR App Works)

### Step-by-Step:
```
1. User clicks "Load Portfolio" in React
   ↓
2. React sends: GET http://localhost:5000/api/data/portfolio?page=1
   ↓
3. Flask receives request at @app.route('/api/data/portfolio')
   ↓
4. Your function executes:
   - Read query params (page=1)
   - Check cache
   - Query Databricks if cache miss
   - Process results
   ↓
5. Flask returns: jsonify({status: 'success', data: [...]})
   ↓
6. React receives JSON and displays in UI
```

### In YOUR App (`app.py`):
```python
@app.route('/api/data/portfolio', methods=['GET'])
def get_portfolio_data():
    # 1. Parse request
    page = int(request.args.get('page', 1))
    
    # 2. Check cache
    cache_key = f"portfolio_data_p{page}_l{limit}"
    cached_data = cache_service.get(cache_key)
    if cached_data:
        return jsonify(cached_data)  # Early return!
    
    # 3. Query database
    hierarchy_results = databricks_client.execute_query(query)
    
    # 4. Structure response
    response_data = {
        'status': 'success',
        'data': {'hierarchy': hierarchy_results}
    }
    
    # 5. Cache and return
    cache_service.set(cache_key, response_data)
    return jsonify(response_data)
```

---

## Environment Variables (Secrets Management 101)

### Why?
**NEVER** hardcode passwords/tokens in code!

### How YOUR App Does It:
```python
# .env file (NEVER commit this to Git!)
DATABRICKS_SERVER_HOSTNAME=your-workspace.cloud.databricks.com
DATABRICKS_ACCESS_TOKEN=super_secret_token_12345

# In code:
from dotenv import load_dotenv
load_dotenv()  # Reads .env file

# Access like this:
access_token = os.getenv('DATABRICKS_ACCESS_TOKEN')
```

**💡 Eureka Moment:** Environment variables = Post-it notes for your app that change per environment (dev/staging/prod) without changing code!

---

## Interview Questions (Basics)

### Q1: What is the difference between frontend and backend?
**Answer:** Frontend handles UI and user interactions (runs in browser), backend handles business logic, data storage, and security (runs on server). They communicate via APIs.

### Q2: Explain the client-server model.
**Answer:** Client (browser) sends requests to server, server processes requests and sends responses back. Client initiates, server responds. Multiple clients can connect to one server.

### Q3: What is REST?
**Answer:** REST is an architectural style for APIs that uses HTTP methods (GET, POST, PUT, DELETE) to perform CRUD operations on resources identified by URLs. It's stateless and uses standard data formats like JSON.

### Q4: What are HTTP status codes and why are they important?
**Answer:** Status codes indicate request outcome: 2xx success, 4xx client error, 5xx server error. They help clients handle responses appropriately (e.g., retry on 503, redirect on 401, show error on 404).

### Q5: What is JSON and why is it used in APIs?
**Answer:** JSON (JavaScript Object Notation) is a lightweight, language-independent data format. It's human-readable, easily parsed by all languages, and has become the de facto standard for API data exchange.

### Q6: How does HTTPS differ from HTTP?
**Answer:** HTTPS = HTTP + TLS/SSL encryption. It encrypts data in transit, preventing eavesdropping and man-in-the-middle attacks. Essential for transmitting sensitive data like passwords and tokens.

### Q7: In your app, what happens when a user loads the portfolio page?
**Answer:** 
1. React sends GET request to `/api/data/portfolio`
2. Flask checks cache for existing data
3. If cache miss, queries Databricks database
4. Processes and structures data as JSON
5. Caches response for future requests
6. Returns JSON to React
7. React renders the data

---

## Key Takeaways

✅ Backend = Server-side logic + data storage  
✅ HTTP = Protocol for client-server communication  
✅ API = Contract defining how to interact with backend  
✅ REST = Organized way to design APIs using HTTP  
✅ JSON = Standard data format for APIs  
✅ Status codes = Quick feedback on request outcome  
✅ Your Flask app = REST API that queries Databricks and returns JSON  

**Next Step:** Move to `01_FLASK_CORE.md` to learn Flask specifics!
