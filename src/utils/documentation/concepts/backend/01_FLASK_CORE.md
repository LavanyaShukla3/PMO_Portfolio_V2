# Flask Core Concepts: Building Your API 🌶️

## What is Flask?

### Simple Definition
Flask = A **micro web framework** for Python that lets you build web APIs quickly

**Micro** doesn't mean small - it means minimal but extensible!

### The LEGO Analogy
- **Flask Core** = Basic LEGO blocks (routes, requests, responses)
- **Extensions** = Special LEGO pieces (flask-cors, flask-compress, etc.)
- You build exactly what you need!

### Why Flask? (vs Django, FastAPI)
✅ **Simple**: Minimal boilerplate, easy to learn  
✅ **Flexible**: No forced structure  
✅ **Pythonic**: Feels natural to Python developers  
❌ **Manual**: You configure everything (vs Django's "batteries included")

**💡 Eureka Moment:** Flask gives you the tools; you decide how to use them. Django gives you a mansion; Flask gives you bricks!

---

## Your Flask App Structure (app.py)

### The Minimal Flask App
```python
from flask import Flask

app = Flask(__name__)  # Create Flask instance

@app.route('/')        # Define route
def home():            # Define function
    return "Hello!"    # Return response

if __name__ == '__main__':
    app.run()          # Start server
```

### YOUR App Structure (`app.py`):

What is “Enable Cross-Origin Requests”?

Imagine you’re in a school.
Each classroom = a website
Class A (Website A)
Class B (Website B)

Normally, students from one classroom are NOT allowed to just walk into another classroom and take something — for safety.
This is exactly how browsers work too:
One website is not allowed to take data from another website unless permission is given.

⭐ What is "Enabling Cross-Origin Requests"?

It simply means:
“Allow this other website to take some information from me — I trust them.”
In our school example:
Class A tells the teacher:

“It’s okay if students from Class B come in and take worksheets.”
That permission is called CORS.

🚀 Real-Life Example

Let’s say:
Your frontend (React) runs at:
http://localhost:3000

Your backend (Flask API) runs at:
http://localhost:5000

These are different classrooms.
When React tries to talk to Flask:
React → “Hey Flask, give me user data.”
Browser:
❌ “Wait! You are not the same classroom! Access denied.”
If Flask enables CORS, it’s saying:
✔️ “It’s okay — I allow requests from React.”
Now React can fetch data from Flask.

🎯 Why Do We Need CORS in Flask?
💭 Because your React app and Flask app usually run on different ports/domains, like:

React: http://localhost:3000
Flask: http://localhost:5000

Browser sees them as different “origins”, so it blocks the request.
This is like telling Flask:
“Please let other apps/websites talk to me.”

```python
# 1. IMPORTS
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_compress import Compress

# 2. INITIALIZATION
app = Flask(__name__)
Compress(app)  # Add compression
CORS(app)      # Enable cross-origin requests

# 3. CONFIGURATION
app.config['COMPRESS_LEVEL'] = 6

# 4. ROUTES (Your API endpoints)
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy'})

# 5. RUN
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
```

**💡 Eureka Moment:** Flask app = collection of routes (URLs) mapped to functions. When request comes in, Flask calls the matching function!

---

## Flask Application Object

### What is `app`?
```python
app = Flask(__name__)
```

- `app` = Your entire application
- `__name__` = Current module name (helps Flask find resources)
- `app` is the central registry for routes, config, extensions

### Common App Methods:
```python
app.route(...)         # Register route/endpoint
app.config[...]        # Set configuration
app.run(...)           # Start development server
app.errorhandler(...)  # Register error handler
```

### In YOUR App:
```python
# Flask instance
app = Flask(__name__)

# Extensions extend the app
Compress(app)  # Adds response compression
CORS(app, origins=['http://localhost:3000'])  # Adds CORS headers
```

---

## Routing: The Heart of Flask

### What is Routing?
**Routing** = Mapping URLs to Python functions

```python
@app.route('/api/health')  # ← This URL...
def health_check():        # ← ...calls this function
    return jsonify({'status': 'healthy'})
```

### Route Anatomy:
```python
@app.route('/api/portfolio',           # Path
           methods=['GET', 'POST'],    # Allowed HTTP methods
           strict_slashes=False)       # /portfolio and /portfolio/ both work
def get_portfolio():
    return jsonify({'data': []})
```

### Dynamic Routes (URL Parameters):
```python
# With angle brackets = variable part
@app.route('/api/portfolio/<portfolio_id>')
def get_portfolio_details(portfolio_id):  # ← portfolio_id passed as argument
    return jsonify({'id': portfolio_id})

# Example: GET /api/portfolio/P001 → portfolio_id = "P001"

# With type converters:
@app.route('/api/portfolio/<int:id>')  # Only accepts integers
def get_portfolio_by_id(id):
    return jsonify({'id': id})
```

### In YOUR App:
```python
# Static routes (exact match)
@app.route('/api/health', methods=['GET'])
@app.route('/api/test-connection', methods=['GET'])
@app.route('/api/data/portfolio', methods=['GET'])

# You use query parameters instead of URL params:
# /api/data/portfolio?page=1&limit=50
```

**💡 Eureka Moment:** 
- **URL params** (`/portfolio/P001`) = Part of the path, required
- **Query params** (`?page=1&limit=50`) = After `?`, optional, for filtering

---

## The Request Object

### Accessing Request Data
```python
from flask import request  # Global object representing current request

@app.route('/api/data')
def get_data():
    # Query parameters (?page=1&limit=50)
    page = request.args.get('page', default=1, type=int)
    limit = request.args.get('limit', 50)
    
    # Headers
    auth_token = request.headers.get('Authorization')
    content_type = request.headers.get('Content-Type')
    
    # Body (for POST/PUT requests)
    data = request.get_json()  # Parses JSON body
    
    # Method
    method = request.method  # GET, POST, etc.
    
    # Full URL
    url = request.url
    
    return jsonify({'received': True})
```

### In YOUR App (`optimized_routes.py`):
```python
@app.route('/api/data/portfolio', methods=['GET'])
def get_portfolio_data():
    # Extract query parameters
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 50))
    
    # Build filter dict
    filters = {
        'portfolio_id': request.args.get('portfolioId'),
        'parent_id': request.args.get('parentId'),
        'status': request.args.get('status')
    }
    
    # Remove None values
    filters = {k: v for k, v in filters.items() if v is not None}
```

**💡 Eureka Moment:** `request` is a **global object** that magically has the current request data. Flask manages it automatically (using thread-local storage)!

---

## The Response Object

### Ways to Return Responses:

#### 1. Simple String (Flask auto-converts to HTML response)
```python
@app.route('/')
def home():
    return "Hello World"  # Content-Type: text/html
```

#### 2. JSON Response (Most common for APIs)
```python
from flask import jsonify

@app.route('/api/data')
def get_data():
    return jsonify({'status': 'success', 'data': [1, 2, 3]})
    # Flask sets Content-Type: application/json
```

#### 3. Response with Custom Status Code
```python
@app.route('/api/create')
def create_item():
    return jsonify({'id': 123}), 201  # Created
    
@app.route('/api/error')
def error():
    return jsonify({'error': 'Not found'}), 404
```

#### 4. Response with Headers
```python
from flask import make_response

@app.route('/api/data')
def get_data():
    response = make_response(jsonify({'data': []}))
    response.headers['X-Custom-Header'] = 'value'
    response.headers['Cache-Control'] = 'max-age=3600'
    return response
```

### In YOUR App:
```python
# Success response (200 OK by default)
return jsonify({
    'status': 'success',
    'data': {
        'hierarchy': hierarchy_results,
        'investment': investment_results
    },
    'mode': 'databricks'
})

# Error response (explicit 500)
return jsonify({
    'status': 'error',
    'message': f'Failed to fetch: {str(e)}'
}), 500

# Connection test (conditional status)
if is_connected:
    return jsonify({'status': 'success'}), 200
else:
    return jsonify({'status': 'error'}), 500
```

---

## Request-Response Lifecycle (Detailed)

### What Happens When Request Arrives:

```
1. Browser sends: GET /api/data/portfolio?page=1
   ↓
2. Flask receives request on port 5000
   ↓
3. Flask's router matches URL to function
   ↓
4. Flask creates request object with all request data
   ↓
5. Your function executes:
   @app.route('/api/data/portfolio')
   def get_portfolio_data():
       page = request.args.get('page')  # Access request
       data = fetch_from_db(page)
       return jsonify(data)              # Create response
   ↓
6. Flask converts return value to HTTP response
   ↓
7. Flask adds headers (Content-Type, CORS, Compression)
   ↓
8. Flask sends response back to browser
```

### In YOUR App (Full Flow):
```python
@app.route('/api/data/portfolio', methods=['GET'])
def get_portfolio_data():
    try:
        # 1. PARSE REQUEST
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 50))
        
        # 2. VALIDATE INPUT
        if page < 1 or limit < 1:
            return jsonify({'error': 'Invalid params'}), 400
        
        # 3. CHECK CACHE
        cache_key = f"portfolio_p{page}_l{limit}"
        cached = cache_service.get(cache_key)
        if cached:
            return jsonify(cached)  # Early return!
        
        # 4. BUSINESS LOGIC
        results = databricks_client.execute_query(query)
        
        # 5. STRUCTURE RESPONSE
        response_data = {
            'status': 'success',
            'data': results,
            'pagination': {'page': page, 'limit': limit}
        }
        
        # 6. CACHE FOR NEXT TIME
        cache_service.set(cache_key, response_data, timeout=300)
        
        # 7. RETURN RESPONSE
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"Error: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500
```

---

## Flask Extensions (Your App Uses These!)

### 1. Flask-CORS
**Purpose:** Allow frontend (different domain) to call your API

```python
from flask_cors import CORS

# Enable for all routes
CORS(app)

# Or specific origins
CORS(app, origins=['http://localhost:3000'])
```

**Why needed:** Browsers block cross-origin requests by default (security feature). CORS adds headers to allow it.

### 2. Flask-Compress
**Purpose:** Automatically compress responses (reduce size by 70-80%)

```python
from flask_compress import Compress

Compress(app)
app.config['COMPRESS_LEVEL'] = 6        # Compression level (1-9)
app.config['COMPRESS_MIN_SIZE'] = 500   # Only compress if > 500 bytes
```

**Your App Config:**
```python
app.config['COMPRESS_MIMETYPES'] = [
    'text/html',
    'text/javascript',
    'application/json',  # ← Your API responses!
]
```

### 3. python-dotenv
**Purpose:** Load environment variables from `.env` file

```python
from dotenv import load_dotenv
load_dotenv()  # Reads .env file into os.environ

token = os.getenv('DATABRICKS_ACCESS_TOKEN')
```

---

## Configuration Best Practices

### Development vs Production Config

```python
# Development
app.config['DEBUG'] = True           # Detailed errors, auto-reload
app.config['TESTING'] = False

# Production
app.config['DEBUG'] = False          # Hide error details
app.config['TESTING'] = False

# Common configs
app.config['JSON_SORT_KEYS'] = False # Don't sort JSON keys
app.config['JSONIFY_PRETTYPRINT_REGULAR'] = False  # Compact JSON
```

### Environment-Based Config:
```python
import os

class Config:
    DEBUG = False
    TESTING = False
    
class DevelopmentConfig(Config):
    DEBUG = True
    
class ProductionConfig(Config):
    DEBUG = False

# Choose config
env = os.getenv('FLASK_ENV', 'development')
if env == 'production':
    app.config.from_object(ProductionConfig)
else:
    app.config.from_object(DevelopmentConfig)
```

---

## Logging (Essential for Debugging!)

### Setting Up Logging (YOUR App Does This):
```python
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,  # DEBUG, INFO, WARNING, ERROR, CRITICAL
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Use in code
@app.route('/api/data')
def get_data():
    logger.info("Fetching portfolio data")  # Info message
    try:
        data = fetch_data()
        logger.debug(f"Fetched {len(data)} items")  # Debug message
        return jsonify(data)
    except Exception as e:
        logger.error(f"Error fetching data: {str(e)}")  # Error message
        return jsonify({'error': str(e)}), 500
```

### Log Levels (When to Use):
- **DEBUG**: Detailed info for diagnosing (only in dev)
- **INFO**: General informational messages
- **WARNING**: Something unexpected but not breaking
- **ERROR**: Error occurred, function failed
- **CRITICAL**: Serious error, app might crash

**💡 Eureka Moment:** Logging is like leaving breadcrumbs - you trace what happened when things go wrong!

---

## Error Handling

### Try-Except Pattern (Your App Uses This):
```python
@app.route('/api/data')
def get_data():
    try:
        # Risky operation
        data = databricks_client.execute_query(query)
        return jsonify({'data': data})
    except Exception as e:
        # Catch any error
        logger.error(f"Error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed: {str(e)}'
        }), 500
```

### Global Error Handlers:
```python
@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal error: {str(error)}")
    return jsonify({'error': 'Internal server error'}), 500

@app.errorhandler(Exception)  # Catch ALL unhandled exceptions
def handle_exception(e):
    logger.exception("Unhandled exception")
    return jsonify({'error': 'Something went wrong'}), 500
```

**Best Practice:** Always return proper status codes and error messages!

---

## Flask Application Factory Pattern (Advanced)

### Why?
Allows creating multiple app instances (testing, production) with different configs

```python
def create_app(config_name='development'):
    app = Flask(__name__)
    
    # Load config
    app.config.from_object(config[config_name])
    
    # Initialize extensions
    db.init_app(app)
    cors.init_app(app)
    
    # Register blueprints (covered later)
    from .routes import api_blueprint
    app.register_blueprint(api_blueprint)
    
    return app

# Usage
app = create_app('production')
```

**Your App:** Uses simpler direct instantiation (fine for smaller apps!)

---

## Interview Questions

### Q1: What is Flask and how does it differ from Django?
**Answer:** Flask is a micro web framework that's minimal and flexible - you add only what you need. Django is a full-featured framework with built-in admin, ORM, auth, etc. Flask is easier to learn but requires more manual setup. Django is better for large apps with standard patterns; Flask for APIs and custom structures.

### Q2: Explain how routing works in Flask.
**Answer:** Routing maps URLs to Python functions using the `@app.route()` decorator. When a request comes in, Flask's router matches the URL pattern and calls the corresponding function. The function processes the request and returns a response. You can define dynamic routes with `<variable>` and specify allowed HTTP methods.

### Q3: What is the request object in Flask?
**Answer:** `request` is a global object representing the current HTTP request. It provides access to query parameters (`request.args`), headers (`request.headers`), JSON body (`request.get_json()`), form data, cookies, etc. It's thread-safe through context locals.

### Q4: How do you return JSON responses in Flask?
**Answer:** Use `jsonify()` which converts Python dicts/lists to JSON and sets the correct Content-Type header. Example: `return jsonify({'status': 'success'})`. You can also specify status code: `return jsonify({'error': 'msg'}), 404`.

### Q5: What is the purpose of Flask extensions?
**Answer:** Extensions add functionality to Flask apps without bloating the core. Common ones: Flask-CORS (cross-origin requests), Flask-SQLAlchemy (database ORM), Flask-Compress (response compression), Flask-JWT (authentication). They follow a common initialization pattern.

### Q6: Explain error handling in Flask.
**Answer:** Use try-except blocks for specific errors, and `@app.errorhandler()` for global error handling. Always return appropriate status codes (400 for bad input, 500 for server errors) and log errors for debugging. Can catch specific exceptions or all exceptions.

### Q7: Walk me through what happens in your app when `/api/data/portfolio?page=1` is called.
**Answer:**
1. Flask router matches URL to `get_portfolio_data()` function
2. Function extracts `page=1` from `request.args`
3. Checks cache using cache key
4. If cache miss, queries Databricks database
5. Processes results and structures as JSON
6. Caches response for 5 minutes
7. Returns JSON with status, data, and pagination info
8. Flask-Compress compresses response before sending
9. Flask-CORS adds CORS headers
10. Browser receives JSON response

---

## Key Takeaways

✅ Flask = Minimal framework for building APIs  
✅ `app = Flask(__name__)` = Your application instance  
✅ `@app.route()` = Maps URLs to functions  
✅ `request` = Access incoming request data  
✅ `jsonify()` = Return JSON responses  
✅ Extensions = Add features (CORS, compression, etc.)  
✅ Logging = Essential for debugging production issues  
✅ Error handling = Always catch exceptions and return proper status codes  

**Next Step:** Move to `02_REST_API_DESIGN.md` to learn API design patterns!
