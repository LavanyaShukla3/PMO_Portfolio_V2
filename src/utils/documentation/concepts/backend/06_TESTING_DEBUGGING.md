# Testing & Debugging: Building Reliable APIs 🧪

## Why Testing Matters

### The Cost of Bugs
```
Bug found in development:   $100 to fix
Bug found in production:    $10,000 to fix + reputation damage
```

**💡 Eureka Moment:** Testing isn't extra work - it SAVES work by catching bugs early!

---

## Types of Testing

### The Testing Pyramid
```
       /\
      /UI\        ← Few, slow, expensive
     /────\
    / API \       ← Moderate number
   /──────\
  /  Unit  \      ← Many, fast, cheap
 /──────────\
```

**Strategy:** More unit tests, fewer integration tests, minimal E2E tests

---

## Unit Testing (Test Individual Functions)

### What is a Unit Test?
**Tests a single function in isolation**

### Basic Example:
```python
# app.py
def calculate_budget(portfolios):
    """Sum budgets of all portfolios."""
    return sum(p['budget'] for p in portfolios)

# test_app.py
import pytest

def test_calculate_budget():
    # Arrange (setup)
    portfolios = [
        {'name': 'P1', 'budget': 100000},
        {'name': 'P2', 'budget': 200000}
    ]
    
    # Act (execute)
    result = calculate_budget(portfolios)
    
    # Assert (verify)
    assert result == 300000

def test_calculate_budget_empty():
    assert calculate_budget([]) == 0

def test_calculate_budget_single():
    assert calculate_budget([{'budget': 50000}]) == 50000
```

### Testing Flask Endpoints:
```python
# test_app.py
import pytest
from app import app

@pytest.fixture
def client():
    """Create test client."""
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_health_check(client):
    """Test health endpoint."""
    response = client.get('/api/health')
    
    assert response.status_code == 200
    assert response.json['status'] == 'healthy'
    assert response.json['version'] == '1.0.0'

def test_portfolio_data(client):
    """Test portfolio endpoint."""
    response = client.get('/api/data/portfolio?page=1&limit=10')
    
    assert response.status_code == 200
    assert 'data' in response.json
    assert 'pagination' in response.json

def test_portfolio_invalid_page(client):
    """Test error handling for invalid page."""
    response = client.get('/api/data/portfolio?page=-1')
    
    assert response.status_code == 400
    assert 'error' in response.json
```

### Pytest Features:

#### 1. Fixtures (Reusable Setup)
```python
@pytest.fixture
def mock_database():
    """Create mock database."""
    db = MockDatabase()
    db.add_data([
        {'id': 'P001', 'name': 'Portfolio A'},
        {'id': 'P002', 'name': 'Portfolio B'}
    ])
    yield db
    db.cleanup()  # Teardown

def test_with_mock_db(mock_database):
    # Use fixture
    result = mock_database.query("SELECT * FROM portfolios")
    assert len(result) == 2
```

#### 2. Parametrize (Multiple Test Cases)
```python
@pytest.mark.parametrize("page,limit,expected", [
    (1, 10, 10),    # Normal case
    (1, 50, 50),    # Max limit
    (2, 10, 10),    # Second page
    (100, 10, 0),   # Beyond data
])
def test_pagination(client, page, limit, expected):
    response = client.get(f'/api/data/portfolio?page={page}&limit={limit}')
    assert len(response.json['data']) == expected
```

#### 3. Mocking (Replace External Dependencies)
```python
from unittest.mock import patch, MagicMock

def test_databricks_query_with_mock():
    """Test without actually querying Databricks."""
    
    # Mock the databricks_client
    with patch('app.databricks_client') as mock_db:
        # Define mock behavior
        mock_db.execute_query.return_value = [
            {'id': 'P001', 'name': 'Portfolio A'}
        ]
        
        # Test your code
        response = client.get('/api/data/portfolio')
        
        # Verify mock was called
        mock_db.execute_query.assert_called_once()
        assert response.json['data'][0]['name'] == 'Portfolio A'
```

---

## Integration Testing (Test Components Together)

### What is Integration Testing?
**Tests how multiple components work together**

### Example:
```python
def test_end_to_end_portfolio_flow():
    """Test full flow: request → cache → DB → response."""
    
    # 1. First request (cache miss)
    response1 = client.get('/api/data/portfolio?page=1')
    assert response1.json['cache_info']['cached'] == False
    
    # 2. Second request (cache hit)
    response2 = client.get('/api/data/portfolio?page=1')
    assert response2.json['cache_info']['cached'] == True
    
    # 3. Data should be identical
    assert response1.json['data'] == response2.json['data']

def test_database_connection():
    """Test actual database connectivity."""
    from databricks_client import databricks_client
    
    # Test connection
    assert databricks_client.test_connection() == True
    
    # Test simple query
    results = databricks_client.execute_query("SELECT 1 as test")
    assert results[0]['test'] == 1
```

---

## Test-Driven Development (TDD)

### The Red-Green-Refactor Cycle:
```
1. RED:    Write failing test
2. GREEN:  Write minimal code to pass test
3. REFACTOR: Improve code while keeping tests green
```

### Example:
```python
# Step 1: Write test FIRST (RED - fails)
def test_filter_active_portfolios():
    portfolios = [
        {'name': 'P1', 'status': 'Active'},
        {'name': 'P2', 'status': 'Closed'},
        {'name': 'P3', 'status': 'Active'}
    ]
    result = filter_active(portfolios)
    assert len(result) == 2
    assert all(p['status'] == 'Active' for p in result)

# Step 2: Write code to pass (GREEN)
def filter_active(portfolios):
    return [p for p in portfolios if p['status'] == 'Active']

# Step 3: Refactor for clarity
def filter_active(portfolios):
    """Filter portfolios by active status."""
    return [
        portfolio 
        for portfolio in portfolios 
        if portfolio.get('status') == 'Active'
    ]
```

---

## Logging (Essential for Debugging!)

### Log Levels (Your App Uses These):
```python
import logging

logger = logging.getLogger(__name__)

logger.debug("Detailed info for diagnosing")    # Development only
logger.info("General informational messages")   # Normal operations
logger.warning("Warning but not breaking")      # Unexpected situations
logger.error("Error occurred, function failed") # Errors
logger.critical("Serious error, app may crash") # Critical issues
```

### Your App's Logging Setup:
```python
# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Usage in routes
@app.route('/api/data/portfolio')
def get_portfolio_data():
    logger.info(f"Fetching portfolio data - Page: {page}, Limit: {limit}")
    
    try:
        results = databricks_client.execute_query(query)
        logger.info(f"Successfully fetched {len(results)} items")
        return jsonify(results)
    except Exception as e:
        logger.error(f"Error fetching data: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500
```

### Advanced Logging:

#### 1. Structured Logging (JSON Format)
```python
import json

class JsonFormatter(logging.Formatter):
    def format(self, record):
        log_obj = {
            'timestamp': self.formatTime(record),
            'level': record.levelname,
            'message': record.getMessage(),
            'module': record.module,
            'function': record.funcName
        }
        if record.exc_info:
            log_obj['exception'] = self.formatException(record.exc_info)
        return json.dumps(log_obj)

handler = logging.StreamHandler()
handler.setFormatter(JsonFormatter())
logger.addHandler(handler)

# Output:
# {"timestamp": "2025-11-11 10:30:00", "level": "INFO", "message": "Request received"}
```

#### 2. Request ID Tracking
```python
import uuid
from flask import g

@app.before_request
def before_request():
    g.request_id = str(uuid.uuid4())

def log_with_request_id(message):
    logger.info(f"[{g.request_id}] {message}")

# All logs for single request have same ID
# Easy to trace through logs
```

#### 3. Log to File
```python
import logging
from logging.handlers import RotatingFileHandler

# Rotate logs when file reaches 10MB, keep 5 backups
handler = RotatingFileHandler(
    'app.log',
    maxBytes=10_000_000,  # 10MB
    backupCount=5
)
handler.setFormatter(logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
))
logger.addHandler(handler)
```

---

## Debugging Techniques

### 1. Print Debugging (Quick & Dirty)
```python
@app.route('/api/data')
def get_data():
    page = request.args.get('page', 1)
    print(f"DEBUG: page = {page}, type = {type(page)}")  # ← Quick check
    
    data = fetch_data(page)
    print(f"DEBUG: Got {len(data)} items")  # ← See intermediate results
    
    return jsonify(data)
```

**Pros:** Fast, no setup  
**Cons:** Manual cleanup, clutters code

### 2. Logging (Better Than Print)
```python
@app.route('/api/data')
def get_data():
    logger.debug(f"Request params: {request.args}")  # More context
    
    page = request.args.get('page', 1)
    logger.debug(f"Parsed page: {page}")
    
    data = fetch_data(page)
    logger.info(f"Fetched {len(data)} items")
    
    return jsonify(data)
```

**Pros:** Levels, formatting, no cleanup needed  
**Cons:** None really!

### 3. Python Debugger (pdb)
```python
@app.route('/api/data')
def get_data():
    import pdb; pdb.set_trace()  # ← Breakpoint here!
    
    page = request.args.get('page', 1)
    data = fetch_data(page)
    return jsonify(data)

# When hit, drops into interactive shell:
# (Pdb) print(page)
# (Pdb) print(request.args)
# (Pdb) next  # Next line
# (Pdb) continue  # Resume
```

**Commands:**
- `n` (next): Execute next line
- `s` (step): Step into function
- `c` (continue): Resume execution
- `p variable`: Print variable value
- `l` (list): Show current code
- `q` (quit): Exit debugger

### 4. IDE Debugger (VS Code, PyCharm)
**Best option for development!**

**VS Code:**
1. Set breakpoint (click left of line number)
2. F5 to start debugging
3. Step through, inspect variables, evaluate expressions

### 5. Exception Traceback Reading
```python
Traceback (most recent call last):
  File "app.py", line 45, in get_portfolio_data
    results = databricks_client.execute_query(query)
  File "databricks_client.py", line 120, in execute_query
    cursor.execute(query)
  File "databricks/sql/client.py", line 89, in execute
    raise OperationalError("Connection timeout")
databricks.sql.exc.OperationalError: Connection timeout
```

**Read from BOTTOM to TOP:**
1. **Bottom:** Actual error (OperationalError: Connection timeout)
2. **Middle:** Where error occurred (databricks/sql/client.py:89)
3. **Top:** Your code that triggered it (app.py:45)

**💡 Eureka Moment:** Tracebacks are like breadcrumbs - follow them from where error happened back to your code!

---

## Error Handling Patterns

### 1. Try-Except-Finally (Your App Uses This)
```python
@app.route('/api/data')
def get_data():
    connection = None
    try:
        connection = pool.get_connection()
        cursor = connection.cursor()
        cursor.execute(query)
        results = cursor.fetchall()
        return jsonify(results)
    except sql.exc.OperationalError as e:
        logger.error(f"Database error: {str(e)}")
        return jsonify({'error': 'Database unavailable'}), 503
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        return jsonify({'error': 'Internal server error'}), 500
    finally:
        # ALWAYS executes (even if return or exception)
        if connection:
            pool.return_connection(connection)
```

### 2. Context Managers (Automatic Cleanup)
```python
class DatabaseConnection:
    def __enter__(self):
        self.conn = pool.get_connection()
        return self.conn
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        pool.return_connection(self.conn)

# Usage
with DatabaseConnection() as conn:
    cursor = conn.cursor()
    cursor.execute(query)
    results = cursor.fetchall()
# Connection automatically returned, even if exception!
```

### 3. Global Error Handlers (Flask)
```python
@app.errorhandler(404)
def not_found(error):
    logger.warning(f"404 Not Found: {request.url}")
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"500 Internal Error", exc_info=True)
    return jsonify({'error': 'Internal server error'}), 500

@app.errorhandler(Exception)
def handle_exception(e):
    """Catch ALL unhandled exceptions."""
    logger.exception("Unhandled exception")
    return jsonify({'error': 'Something went wrong'}), 500
```

---

## Testing Best Practices

### 1. AAA Pattern (Arrange-Act-Assert)
```python
def test_calculate_total():
    # Arrange: Set up test data
    portfolios = [
        {'budget': 100},
        {'budget': 200}
    ]
    
    # Act: Execute function
    result = calculate_total(portfolios)
    
    # Assert: Verify result
    assert result == 300
```

### 2. Test One Thing Per Test
```python
# ❌ BAD: Tests multiple things
def test_portfolio_everything():
    assert portfolio.name == "Test"
    assert portfolio.budget > 0
    assert portfolio.status == "Active"
    assert len(portfolio.programs) == 5

# ✅ GOOD: Separate tests
def test_portfolio_name():
    assert portfolio.name == "Test"

def test_portfolio_budget_positive():
    assert portfolio.budget > 0

def test_portfolio_has_programs():
    assert len(portfolio.programs) == 5
```

### 3. Use Descriptive Test Names
```python
# ❌ BAD
def test_1():
    pass

def test_portfolio():
    pass

# ✅ GOOD
def test_portfolio_data_returns_200_for_valid_request():
    pass

def test_portfolio_data_returns_400_for_negative_page():
    pass

def test_portfolio_data_caches_results_for_5_minutes():
    pass
```

### 4. Don't Test External Dependencies
```python
# ❌ BAD: Actually calls Databricks
def test_fetch_data():
    data = databricks_client.execute_query("SELECT * FROM portfolios")
    assert len(data) > 0

# ✅ GOOD: Mock external service
@patch('app.databricks_client')
def test_fetch_data(mock_db):
    mock_db.execute_query.return_value = [{'id': 'P001'}]
    data = fetch_portfolios()
    assert len(data) == 1
```

### 5. Test Edge Cases
```python
def test_calculate_average():
    # Normal case
    assert calculate_average([1, 2, 3]) == 2
    
    # Edge case: Empty list
    assert calculate_average([]) == 0
    
    # Edge case: Single item
    assert calculate_average([5]) == 5
    
    # Edge case: Negative numbers
    assert calculate_average([-1, -2, -3]) == -2
    
    # Edge case: Very large numbers
    assert calculate_average([10**9, 10**9]) == 10**9
```

---

## Code Coverage

### What is Coverage?
**Percentage of your code executed by tests**

```python
def divide(a, b):
    if b == 0:        # Line 1
        return None   # Line 2 (not covered!)
    return a / b      # Line 3

# Test
def test_divide():
    assert divide(10, 2) == 5

# Coverage: 66% (2 of 3 lines executed)
```

### Using Coverage.py:
```bash
# Install
pip install coverage pytest-cov

# Run tests with coverage
pytest --cov=app --cov-report=html

# View report
# Creates htmlcov/index.html showing which lines not covered
```

### Target Coverage:
- **70-80%**: Good for most projects
- **90%+**: Excellent (but diminishing returns)
- **100%**: Often not worth the effort (hard to test error paths)

**💡 Eureka Moment:** High coverage doesn't mean bug-free! It just means code is executed, not necessarily tested correctly.

---

## Interview Questions

### Q1: What's the difference between unit tests and integration tests?
**Answer:** Unit tests test individual functions in isolation, mocking external dependencies. Fast and numerous. Integration tests test multiple components together, including real database/API calls. Slower but verify components work together. Unit tests catch logic bugs, integration tests catch integration issues.

### Q2: What is Test-Driven Development (TDD)?
**Answer:** TDD is writing tests before code. Process: 1) Write failing test (red), 2) Write minimal code to pass (green), 3) Refactor while keeping tests green. Benefits: better design, comprehensive tests, confidence in refactoring. Forces thinking about requirements first.

### Q3: Explain the different log levels and when to use each.
**Answer:** DEBUG (detailed diagnostics, dev only), INFO (normal operations like "request received"), WARNING (unexpected but not breaking), ERROR (function failed, like database error), CRITICAL (serious failure, app may crash). Use appropriate level so you can filter logs in production.

### Q4: How do you debug a production issue without a debugger?
**Answer:** Use logs extensively - log inputs, outputs, intermediate values with proper levels and context (request IDs). Check exception tracebacks to identify error location. Use monitoring/alerting to detect issues. Add temporary verbose logging if needed. Reproduce locally with production-like data if possible.

### Q5: What is mocking and when should you use it?
**Answer:** Mocking replaces real objects with fake ones that simulate behavior. Use for external dependencies (databases, APIs, file systems) in unit tests. Makes tests fast, deterministic, and independent. Avoids hitting rate limits or costing money. Can control return values and verify interactions.

### Q6: How do you handle exceptions in Flask?
**Answer:** Use try-except blocks for specific errors with appropriate status codes. Use @app.errorhandler decorators for global error handling (404, 500, Exception). Always log errors with exc_info=True for traceback. Return consistent error format. Use finally for cleanup (closing connections).

### Q7: What is code coverage and what's a good target?
**Answer:** Coverage measures percentage of code executed by tests. Good target is 70-80% for most projects. 90%+ is excellent but has diminishing returns. 100% often not worth effort. High coverage doesn't guarantee quality - tests must verify correct behavior, not just execute code.

### Q8: How would you test your caching implementation?
**Answer:** Test cache miss (first request queries database), cache hit (second request returns cached data without querying), cache expiration (data refreshes after TTL), cache key generation (different params = different keys), cache invalidation (updates clear related cache). Mock database to verify query count.

### Q9: Explain pytest fixtures and why they're useful.
**Answer:** Fixtures provide reusable test setup/teardown. Define once with @pytest.fixture, use in multiple tests by passing as argument. Can have setup (before yield) and teardown (after yield). Examples: test database, mock objects, test client. Reduces code duplication and ensures consistent test environment.

---

## Key Takeaways

✅ Unit tests = Test functions in isolation (fast, many)  
✅ Integration tests = Test components together (slower, fewer)  
✅ TDD = Write tests first, then code  
✅ Logging = Essential for debugging production issues  
✅ Log levels = Use appropriately (DEBUG for dev, INFO for operations, ERROR for failures)  
✅ Mocking = Replace external dependencies in tests  
✅ Try-except-finally = Proper error handling with cleanup  
✅ Coverage = Measure test completeness (aim for 70-80%)  
✅ AAA pattern = Arrange-Act-Assert for clear tests  

**Next Step:** Move to `07_DEPLOYMENT_DEVOPS.md` to learn production deployment!
