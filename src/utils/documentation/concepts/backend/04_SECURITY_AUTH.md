# Security & Authentication: Protecting Your API 🔒

## Security Fundamentals (Must Know!)

### The Castle Analogy
- **Authentication** = Proving who you are (showing ID at gate)
- **Authorization** = Proving what you can do (access to specific rooms)
- **Encryption** = Secret language (messages only guards understand)
- **HTTPS** = Armored carriage (secure transport)

**💡 Eureka Moment:** Security has layers! Like an onion, each layer protects against different threats.

---

## HTTPS vs HTTP

### HTTP (Insecure)
```
[Browser] --"GET /api/data"-- [Plain Text!] --> [Server]
          <--{"password": "abc123"}--          Anyone can read!
```

### HTTPS (Secure)
```
[Browser] --[Encrypted Tunnel]-- [Server]
          SSL/TLS Certificate      Only endpoints can decrypt
```

**What HTTPS Provides:**
- ✅ **Encryption**: Data encrypted in transit
- ✅ **Authentication**: Server proves identity (certificate)
- ✅ **Integrity**: Data can't be modified without detection

**How to Enable:**
```python
# Production (with certificate)
app.run(ssl_context=('cert.pem', 'key.pem'))

# Development (self-signed)
app.run(ssl_context='adhoc')  # Flask generates temp certificate
```

**💡 Eureka Moment:** HTTPS is mandatory for production! Browsers warn users about HTTP sites, and many features (geolocation, camera) only work on HTTPS.

---

## CORS (Cross-Origin Resource Sharing)

### The Problem: Same-Origin Policy
Browsers block requests from different origins (security feature)

```
Frontend:  http://localhost:3000  (Origin A)
Backend:   http://localhost:5000  (Origin B)

Browser: "Different origins! Request BLOCKED! 🚫"
```

**Origin** = Protocol + Domain + Port
- `http://localhost:3000` ≠ `http://localhost:5001` (different port)
- `http://example.com` ≠ `https://example.com` (different protocol)

### The Solution: CORS Headers
Server tells browser: "It's okay, I allow requests from Frontend"

```python
# Your app uses Flask-CORS
from flask_cors import CORS

# Allow all origins (DEV ONLY!)
CORS(app)

# Production: Specific origins
CORS(app, origins=[
    'http://localhost:3000',
    'https://myapp.com',
    'https://www.myapp.com'
])
```

### Your App's CORS Config:
```python
frontend_urls = [
    os.getenv('FRONTEND_URL', 'http://localhost:3000'),
    'http://localhost:3001'  # Additional dev port
]
CORS(app, origins=frontend_urls)
```

### How CORS Works:

#### 1. Preflight Request (for POST, PUT, DELETE)
🌟 What Is a Preflight Request? (Simple English)
A preflight request is the browser saying:

👉 **“Before I send a dangerous request (POST/PUT/DELETE), let me first ask the server:
Is it safe for me to send this?”
This "asking" happens through a special HTTP request:
```
OPTIONS /api/data
```
🧠 Why does the browser do this?
Because POST, PUT, DELETE (and some headers) are considered dangerous.

Why?
Because they change data on the server.
So the browser wants to protect the user by verifying:

✔ Is this frontend allowed to call this backend?
✔ Does the server allow this method (POST/PUT/DELETE)?
✔ Does the server allow these headers (Content-Type, Authorization)?

This is enforced by the browser as part of CORS (Cross Origin Resource Sharing).
🛠 What the Preflight Actually Looks Like
Step 1 — Browser sends OPTIONS request
```
OPTIONS /api/data
Origin: http://localhost:3000
Access-Control-Request-Method: POST
Access-Control-Request-Headers: Content-Type, Authorization
```
Step 2 — Server responds: YES or NO
Example:
```
HTTP/1.1 200 OK
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Methods: GET, POST, PUT, DELETE
Access-Control-Allow-Headers: Content-Type, Authorization
```
This means:

👉 “Yes, your frontend is allowed!
Go ahead and make the POST request.”

Step 3 — Browser sends the real POST

After the preflight succeeds, then your actual request goes:
```
POST /api/data

```
```
Browser sends OPTIONS request first:
OPTIONS /api/data HTTP/1.1
Origin: http://localhost:3000
Access-Control-Request-Method: POST

Server responds:
HTTP/1.1 200 OK
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Methods: GET, POST, PUT, DELETE
Access-Control-Allow-Headers: Content-Type, Authorization
```

#### 2. Actual Request
```
Browser sends POST:
POST /api/data HTTP/1.1
Origin: http://localhost:3000

Server responds:
HTTP/1.1 200 OK
Access-Control-Allow-Origin: http://localhost:3000
```

### CORS Headers Explained:
```python
# Which origins can access
Access-Control-Allow-Origin: http://localhost:3000

# Which methods allowed
Access-Control-Allow-Methods: GET, POST, PUT, DELETE

# Which headers allowed
Access-Control-Allow-Headers: Content-Type, Authorization

# Allow credentials (cookies, auth headers)
Access-Control-Allow-Credentials: true

# Cache preflight response (seconds)
Access-Control-Max-Age: 3600
```

**💡 Eureka Moment:** CORS is the bouncer at the club. Without CORS, browser says "You're not on the list!" (even though server doesn't care).

---

## Authentication (Who Are You?)

### Common Methods:

### 1. Session-Based Auth (Traditional)
```python
from flask import session

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    user = User.authenticate(data['username'], data['password'])
    
    if user:
        # Store in server-side session
        session['user_id'] = user.id
        return jsonify({'status': 'logged in'})
    
    return jsonify({'error': 'Invalid credentials'}), 401

@app.route('/api/profile')
def profile():
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    user = User.get(session['user_id'])
    return jsonify(user.to_dict())
```

**How it works:**
1. User logs in with username/password
2. Server creates session, stores user ID
3. Server sends session ID cookie to browser
4. Browser sends cookie with every request
5. Server looks up session to identify user

**Pros:**
- ✅ Simple to implement
- ✅ Server has full control (can revoke sessions)

**Cons:**
- ❌ Doesn't work well with multiple servers (session storage issue)
- ❌ Requires sticky sessions or shared session store (Redis)
- ❌ Not ideal for APIs (CORS issues with cookies)

### 2. Token-Based Auth (Modern, Your App Should Use This!)

#### JWT (JSON Web Tokens)
```python
import jwt
from datetime import datetime, timedelta

# Generate token
@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    user = User.authenticate(data['username'], data['password'])
    
    if user:
        # Create JWT token
        payload = {
            'user_id': user.id,
            'username': user.username,
            'exp': datetime.utcnow() + timedelta(hours=24)  # Expires in 24h
        }
        token = jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')
        
        return jsonify({'token': token})
    
    return jsonify({'error': 'Invalid credentials'}), 401

# Verify token
@app.route('/api/profile')
def profile():
    auth_header = request.headers.get('Authorization')
    
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Missing token'}), 401
    
    token = auth_header.split(' ')[1]  # "Bearer <token>"
    
    try:
        payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        user = User.get(payload['user_id'])
        return jsonify(user.to_dict())
    except jwt.ExpiredSignatureError:
        return jsonify({'error': 'Token expired'}), 401
    except jwt.InvalidTokenError:
        return jsonify({'error': 'Invalid token'}), 401
```

**JWT Structure:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxMjN9.abc123def456
│                                      │                    │
Header (algorithm)                     Payload (data)       Signature
```

**How JWT Works:**
1. User logs in
2. Server creates JWT with user data
3. Server signs JWT with secret key
4. Client stores token (localStorage/memory)
5. Client sends token in Authorization header
6. Server verifies signature and extracts data

**Pros:**
- ✅ Stateless (no server-side session storage)
- ✅ Works across multiple servers
- ✅ Perfect for APIs
- ✅ Can include user data (no DB lookup needed)

**Cons:**
- ❌ Can't revoke tokens (valid until expiration)
- ❌ Token size (larger than session ID)

✅ 1. What is a cookie in a website? What is a cookie in this context?
🍪 Website Cookie = Small piece of data stored in your browser by a website.

Your browser saves it like:
session_id = abcd123456
theme = dark
cart_items = 4

A cookie is just key–value data stored on your device, NOT on the server.
✔ Why do websites use cookies?

To remember things between page loads.
For example:

Stay logged in
Save items in shopping cart
Remember theme (dark/light mode)
Remember language

🚨 In Authentication context, a cookie usually stores:

A session ID (for session-based auth)
or
A JWT token (if the site uses cookie storage)

So in auth:
📌 Cookie = the badge given to you so the server knows who you are.

✅ 2. Is Session-Based Auth needed only for websites with login (Netflix, Amazon)? Or also for websites without login?
✔ Websites WITH login → MUST use session/auth

Examples:

Netflix
Amazon
Gmail
Flipkart
Instagram
Why?
Because they need to recognize which user is requesting what.

✔ Websites WITHOUT login → may also use cookies/sessions
Even websites without accounts use cookies/sessions for:

Tracking clicks
Remembering dark mode
Saving items in cart even without login
Analytics (Google Analytics)
Showing “recently viewed items”
Preventing bots
🟢 But they may not need authentication in that case.
They just use cookies to store small information.

### 3. API Keys (Simple, Your Databricks Uses This!)
```python
# Your app's Databricks authentication
self.access_token = os.getenv('DATABRICKS_ACCESS_TOKEN')

connection = sql.connect(
    server_hostname=self.server_hostname,
    http_path=self.http_path,
    access_token=self.access_token  # ← API key!
)
```

**Usage Pattern:**
```python
@app.route('/api/data')
def get_data():
    api_key = request.headers.get('X-API-Key')
    
    if not api_key or api_key != os.getenv('VALID_API_KEY'):
        return jsonify({'error': 'Invalid API key'}), 401
    
    # Proceed with request
    data = fetch_data()
    return jsonify(data)
```

**Pros:**
- ✅ Very simple
- ✅ Good for service-to-service auth

**Cons:**
- ❌ No user identity (one key for all users)
- ❌ Hard to rotate (need to update all clients)
- ❌ If leaked, full access until changed

**💡 Eureka Moment:** Sessions = Server remembers you. JWT = You carry proof of identity. API Key = Password for the API itself.

---

## Authorization (What Can You Do?)

### Authentication vs Authorization
```
Authentication: "Who are you?"  → Login
Authorization:  "What can you do?" → Permissions
```

### Role-Based Access Control (RBAC)
```python
# User roles
ROLES = {
    'admin': ['read', 'write', 'delete'],
    'editor': ['read', 'write'],
    'viewer': ['read']
}

def require_permission(permission):
    def decorator(f):
        def wrapped(*args, **kwargs):
            # Get user from token
            user = get_current_user()
            
            # Check permission
            if permission not in ROLES[user.role]:
                return jsonify({'error': 'Permission denied'}), 403
            
            return f(*args, **kwargs)
        return wrapped
    return decorator

# Usage
@app.route('/api/portfolios', methods=['POST'])
@require_permission('write')
def create_portfolio():
    # Only users with 'write' permission can access
    pass

@app.route('/api/portfolios/<id>', methods=['DELETE'])
@require_permission('delete')
def delete_portfolio(id):
    # Only admins can delete
    pass
```

---

## Password Security

### ❌ NEVER Store Plain Passwords!
```python
# TERRIBLE!
user.password = request.json['password']  # Plain text in DB 😱
```

### ✅ Hash Passwords
```python
from werkzeug.security import generate_password_hash, check_password_hash

# Registration
@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    
    # Hash password
    hashed = generate_password_hash(data['password'], method='pbkdf2:sha256')
    
    user = User.create(
        username=data['username'],
        password_hash=hashed  # Store hash, not password!
    )
    
    return jsonify({'status': 'created'}), 201

# Login
@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    user = User.get_by_username(data['username'])
    
    # Check password against hash
    if user and check_password_hash(user.password_hash, data['password']):
        return jsonify({'status': 'logged in'})
    
    return jsonify({'error': 'Invalid credentials'}), 401
```

**How Hashing Works:**
- **One-way function**: Can't reverse hash to get password
- **Same password = different hash**: Salt added (random data)
- **Slow by design**: Prevents brute force (bcrypt, scrypt, argon2)

**Password Best Practices:**
- ✅ Use strong hashing (bcrypt, argon2)
- ✅ Add salt (unique per password)
- ✅ Use work factor (iterations)
- ❌ Never use MD5/SHA1 (too fast, broken)

---

## Environment Variables & Secrets Management

### Your App's Pattern:
```python
# .env file (NEVER commit to Git!)
DATABRICKS_SERVER_HOSTNAME=your-workspace.cloud.databricks.com
DATABRICKS_HTTP_PATH=/sql/1.0/warehouses/abc123
DATABRICKS_ACCESS_TOKEN=super_secret_token_here
SECRET_KEY=your-flask-secret-key

# In code
from dotenv import load_dotenv
load_dotenv()  # Loads .env into environment

# Access
token = os.getenv('DATABRICKS_ACCESS_TOKEN')
secret = os.getenv('SECRET_KEY')

# With default
port = os.getenv('PORT', '5000')  # Default to '5000' if not set
```

### .gitignore (Critical!)
```
# .gitignore
.env
*.env
.env.*
secrets/
*.key
*.pem
```

### Production Secrets Management:
```python
# Don't use .env files in production!

# Use cloud provider secrets:
# - AWS Secrets Manager
# - Azure Key Vault
# - Google Secret Manager
# - HashiCorp Vault

# Or environment variables set by platform
# Heroku: heroku config:set SECRET_KEY=...
# Docker: docker run -e SECRET_KEY=...
```

**💡 Eureka Moment:** .env for development, cloud secrets for production. NEVER commit secrets to Git (can't undo - entire history has them!).

---

## Common Security Vulnerabilities

### 1. SQL Injection (Covered in 03_DATABASE_SQL.md)
```python
# ❌ BAD
query = f"SELECT * FROM users WHERE id = {user_input}"

# ✅ GOOD
query = "SELECT * FROM users WHERE id = ?"
cursor.execute(query, (user_input,))
```

### 2. Cross-Site Scripting (XSS)
**Attack:** Inject malicious JavaScript into page

```python
# If you return HTML (not applicable to JSON APIs):
from flask import escape

@app.route('/profile/<username>')
def profile(username):
    # ❌ BAD
    return f"<h1>Profile: {username}</h1>"
    # If username = "<script>alert('hacked')</script>", executes!
    
    # ✅ GOOD
    return f"<h1>Profile: {escape(username)}</h1>"
    # Converts < > to &lt; &gt; (safe)
```

**For JSON APIs:** Not an issue (browser doesn't execute JSON)

### 3. CSRF (Cross-Site Request Forgery)
**Attack:** Trick user's browser into making unwanted requests

```html
<!-- Attacker's site -->
<img src="http://yourbank.com/transfer?to=attacker&amount=1000">
<!-- If user logged in to bank, browser sends cookies automatically! -->
```

**Protection: CSRF Tokens**
```python
from flask_wtf.csrf import CSRFProtect

csrf = CSRFProtect(app)

# For APIs: Don't use cookies for auth (use tokens in headers)
# CSRF only affects cookie-based auth
```

### 4. Insecure Direct Object References (IDOR)
```python
# ❌ VULNERABLE
@app.route('/api/portfolio/<id>')
def get_portfolio(id):
    # Anyone can access any portfolio by guessing ID!
    portfolio = Portfolio.get(id)
    return jsonify(portfolio)

# ✅ SECURE
@app.route('/api/portfolio/<id>')
def get_portfolio(id):
    user = get_current_user()
    portfolio = Portfolio.get(id)
    
    # Check if user has access
    if portfolio.owner_id != user.id and not user.is_admin:
        return jsonify({'error': 'Access denied'}), 403
    
    return jsonify(portfolio)
```

### 5. Rate Limiting (Prevent Abuse)
```python
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)

# Specific limit for expensive endpoint
@app.route('/api/data/portfolio')
@limiter.limit("10 per minute")
def get_portfolio_data():
    # Prevents user from hammering API
    pass
```

### 6. Sensitive Data Exposure
```python
# ❌ BAD: Expose internal details
return jsonify({
    'user': {
        'id': 123,
        'username': 'john',
        'password_hash': 'abc123...',  # Don't expose!
        'internal_notes': 'VIP customer',  # Don't expose!
        'created_at': '2025-01-01'
    }
})

# ✅ GOOD: Only necessary data
return jsonify({
    'user': {
        'id': 123,
        'username': 'john',
        'created_at': '2025-01-01'
    }
})
```

---

## Security Headers

### Essential Headers:
```python
@app.after_request
def set_security_headers(response):
    # Prevent MIME sniffing
    response.headers['X-Content-Type-Options'] = 'nosniff'
    
    # Prevent clickjacking
    response.headers['X-Frame-Options'] = 'DENY'
    
    # XSS protection (browser built-in)
    response.headers['X-XSS-Protection'] = '1; mode=block'
    
    # HTTPS only (if using HTTPS)
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    
    # Control what can be loaded
    response.headers['Content-Security-Policy'] = "default-src 'self'"
    
    return response
```

---

## Interview Questions

### Q1: What's the difference between authentication and authorization?
**Answer:** Authentication verifies identity ("who are you?") - like showing ID. Authorization determines permissions ("what can you do?") - like checking if you're on the guest list. You can be authenticated but not authorized. Example: logged in user (authenticated) trying to delete admin-only resource (not authorized).

### Q2: Explain how JWT authentication works.
**Answer:** JWT (JSON Web Token) is a stateless auth method. Server creates token containing user data, signs it with secret key, returns to client. Client stores token and sends it in Authorization header (Bearer token) with each request. Server verifies signature and extracts user data without database lookup. Token expires after set time. Can't be revoked before expiration.

### Q3: What is CORS and why is it needed?
**Answer:** CORS (Cross-Origin Resource Sharing) allows browsers to make requests across different origins (protocol + domain + port). Browsers block cross-origin requests by default for security. Server adds CORS headers to allow specific origins. For APIs, need CORS so frontend on one domain can call backend on another domain.

### Q4: How should passwords be stored?
**Answer:** Never store plain passwords! Use strong hashing algorithms (bcrypt, argon2, scrypt) with salt. Hashing is one-way - can't reverse to get password. Salt is random data added to each password before hashing, ensuring same password has different hash. Verify by hashing input and comparing hashes. Use slow algorithms to prevent brute force.

### Q5: What is SQL injection and how do you prevent it?
**Answer:** SQL injection is when attackers inject malicious SQL through user input. Example: username = "admin' OR '1'='1" bypasses login. Prevent with parameterized queries (placeholders) - database driver properly escapes input. Never concatenate user input into SQL strings.

### Q6: What are environment variables and why use them?
**Answer:** Environment variables store configuration and secrets outside code. Different values per environment (dev/prod) without code changes. Keeps secrets out of version control. Access via os.getenv(). Use .env files locally, cloud secrets managers in production. Never commit .env files to Git.

### Q7: Explain the difference between session-based and token-based authentication.
**Answer:** Session-based stores user session on server, sends session ID cookie to client. Stateful - server remembers login. Token-based (JWT) stores user data in signed token on client. Stateless - server doesn't store anything. Sessions work well for monoliths, tokens for APIs and microservices (scales better).

### Q8: What is rate limiting and why is it important?
**Answer:** Rate limiting restricts number of requests from a client in time period (e.g., 100/hour). Prevents abuse, DoS attacks, and protects resources. Especially important for expensive operations like database queries. Return 429 Too Many Requests when limit exceeded. Can be per IP, per user, or per API key.

### Q9: How does HTTPS differ from HTTP?
**Answer:** HTTPS is HTTP over TLS/SSL encryption. Encrypts data in transit so eavesdroppers can't read it. Server proves identity with certificate. Ensures data integrity - can't be modified without detection. Essential for sensitive data, required by browsers for many features. Prevents man-in-the-middle attacks.

---

## Key Takeaways

✅ HTTPS = Mandatory for production (encryption)  
✅ CORS = Allows cross-origin requests (add headers)  
✅ Authentication = Verify identity (JWT recommended for APIs)  
✅ Authorization = Verify permissions (role-based access)  
✅ Password hashing = bcrypt/argon2 with salt, never plain text  
✅ Environment variables = Store secrets (.env local, cloud in prod)  
✅ SQL injection = Use parameterized queries always  
✅ Rate limiting = Prevent abuse and DoS attacks  
✅ Security headers = Add extra protection layers  

**Next Step:** Move to `05_PERFORMANCE_OPTIMIZATION.md` to make your API fast!
