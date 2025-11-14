# Deployment & DevOps: Taking Your API to Production 🚀

## Development vs Production

### The Environment Journey
```
Development (Your Laptop)
    ↓
Testing/Staging (Pre-production)
    ↓
Production (Real Users)
```

**💡 Eureka Moment:** Production is NOT just "dev with real data" - it needs reliability, security, monitoring, and scalability!

---

## WSGI Servers (Flask's Production Host)

### Why Not Flask's Built-in Server?
```python
# ❌ DEVELOPMENT ONLY
if __name__ == '__main__':
    app.run(debug=True)  # Single-threaded, not secure, crashes easily
```

**Flask's warning:**
```
WARNING: This is a development server. Do not use it in production.
Use a production WSGI server instead.
```

### What is WSGI?
**WSGI** = **W**eb **S**erver **G**ateway **I**nterface
- Standard for Python web apps to talk to web servers
- Like a translator between web server and your Flask app

### Production WSGI Servers:

#### 1. Gunicorn (Most Popular)
```bash
# Install
pip install gunicorn

# Run (basic)
gunicorn app:app

# Run with options
gunicorn \
    --bind 0.0.0.0:5000 \      # Listen on all interfaces, port 5000
    --workers 4 \               # 4 worker processes
    --threads 2 \               # 2 threads per worker
    --timeout 120 \             # 2 minute timeout
    --access-logfile - \        # Log to stdout
    --error-logfile - \         # Errors to stdout
    app:app                     # module:app_object
```

**Worker Math:**
```
Workers = (2 × CPU cores) + 1
8 core CPU → 17 workers

Each worker can handle multiple requests concurrently (with threads)
4 workers × 2 threads = 8 concurrent requests
```

#### 2. uWSGI (More Features, More Complex)
```bash
pip install uwsgi

uwsgi \
    --http :5000 \
    --wsgi-file app.py \
    --callable app \
    --processes 4 \
    --threads 2
```

#### 3. Waitress (Windows-Friendly)
```python
from waitress import serve

serve(app, host='0.0.0.0', port=5000, threads=4)
```

### Your App Deployment Command:
```bash
# Basic
gunicorn --bind 0.0.0.0:5000 app:app

# Production-ready
gunicorn \
    --bind 0.0.0.0:5000 \
    --workers 4 \
    --timeout 120 \
    --access-logfile /var/log/gunicorn/access.log \
    --error-logfile /var/log/gunicorn/error.log \
    --log-level info \
    app:app
```

---

## Environment Configuration

### The 12-Factor App (Must Know!)

#### Factor 1: Codebase
One codebase in version control, many deploys
```
[Git Repo] → Deploy to Dev, Staging, Prod (same code!)
```

#### Factor 2: Dependencies
Explicitly declare dependencies
```
requirements.txt:
Flask==3.0.0
gunicorn==21.2.0
```

#### Factor 3: Config (Your App Does This!)
Store config in environment, not code
```python
# ✅ GOOD
DATABASE_URL = os.getenv('DATABASE_URL')
SECRET_KEY = os.getenv('SECRET_KEY')

# ❌ BAD
DATABASE_URL = 'postgresql://localhost/db'  # Hardcoded!
```

#### Factor 4: Backing Services
Treat databases, caches, etc. as attached resources
```python
# Can swap databases by changing env var
DATABASE_URL = os.getenv('DATABASE_URL')  # dev: sqlite, prod: postgres
```

### Environment-Specific Configs:
```python
import os

class Config:
    """Base config."""
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key')
    DEBUG = False
    TESTING = False

class DevelopmentConfig(Config):
    """Development config."""
    DEBUG = True
    DATABASE_URL = 'sqlite:///dev.db'

class ProductionConfig(Config):
    """Production config."""
    DATABASE_URL = os.getenv('DATABASE_URL')  # Required!
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL must be set in production")

class TestingConfig(Config):
    """Testing config."""
    TESTING = True
    DATABASE_URL = 'sqlite:///test.db'

# Select config
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig
}

env = os.getenv('FLASK_ENV', 'development')
app.config.from_object(config[env])
```

---

## Docker (Containerization)

### What is Docker?
**Packages your app + dependencies into a container (like a virtual box)**

### The Shipping Container Analogy
- **Container**: Ships app everywhere (laptop, server, cloud)
- **Same environment**: Works identical everywhere
- **Isolated**: Doesn't interfere with other apps

### Dockerfile (Your App):
```dockerfile
# Base image (Python 3.11)
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Copy requirements first (for caching)
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 5000

# Environment variables (defaults)
ENV FLASK_ENV=production
ENV PORT=5000

# Run with Gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "4", "app:app"]
```

### Docker Commands:
```bash
# Build image
docker build -t pmo-portfolio-api:latest .

# Run container
docker run -p 5000:5000 \
    -e DATABRICKS_SERVER_HOSTNAME=your-server \
    -e DATABRICKS_ACCESS_TOKEN=your-token \
    pmo-portfolio-api:latest

# Run with env file
docker run -p 5000:5000 --env-file .env pmo-portfolio-api:latest

# Stop container
docker stop <container-id>

# View logs
docker logs <container-id>

# View running containers
docker ps
```

### Docker Compose (Multi-Container):
```yaml
# docker-compose.yml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "5000:5000"
    environment:
      - FLASK_ENV=production
      - DATABASE_URL=postgresql://db:5432/pmo
    depends_on:
      - db
    volumes:
      - ./cache:/app/cache
    restart: unless-stopped

  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=pmo
      - POSTGRES_USER=admin
      - POSTGRES_PASSWORD=secret
    volumes:
      - postgres_data:/var/lib/postgresql/data

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - api

volumes:
  postgres_data:
```

**Commands:**
```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f api

# Rebuild after code changes
docker-compose up -d --build
```

---

## CI/CD (Continuous Integration/Deployment)

### What is CI/CD?
- **CI (Continuous Integration)**: Automatically test code on every commit
- **CD (Continuous Deployment)**: Automatically deploy if tests pass

### The Pipeline:
```
Commit → Push to GitHub → Run Tests → Build Docker Image → Deploy to Production
```

### GitHub Actions Example:
```yaml
# .github/workflows/deploy.yml
name: Deploy API

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install pytest pytest-cov
      
      - name: Run tests
        run: pytest --cov=app
      
      - name: Check coverage
        run: |
          coverage report --fail-under=70

  deploy:
    needs: test  # Only deploy if tests pass
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Build Docker image
        run: docker build -t pmo-api:${{ github.sha }} .
      
      - name: Push to registry
        run: |
          docker tag pmo-api:${{ github.sha }} registry.com/pmo-api:latest
          docker push registry.com/pmo-api:latest
      
      - name: Deploy to production
        run: |
          ssh user@production-server 'docker pull registry.com/pmo-api:latest && docker-compose up -d'
```

---

## Reverse Proxy (Nginx)

### What is a Reverse Proxy?
**Sits in front of your app, handles:**
- SSL/TLS termination (HTTPS)
- Load balancing (multiple app instances)
- Static file serving
- Request routing

### Architecture:
```
Internet
    ↓
[Nginx :80/:443]  ← SSL, static files, load balancing
    ↓
[Gunicorn :5000]  ← Your Flask app
    ↓
[Databricks]
```

### Nginx Configuration:
```nginx
# nginx.conf
http {
    upstream flask_app {
        # Load balance across multiple Gunicorn instances
        server 127.0.0.1:5000;
        server 127.0.0.1:5001;
        server 127.0.0.1:5002;
    }

    server {
        listen 80;
        server_name api.example.com;

        # Redirect HTTP to HTTPS
        return 301 https://$host$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name api.example.com;

        # SSL certificates
        ssl_certificate /etc/ssl/certs/cert.pem;
        ssl_certificate_key /etc/ssl/private/key.pem;

        # Security headers
        add_header Strict-Transport-Security "max-age=31536000" always;
        add_header X-Frame-Options "DENY" always;
        add_header X-Content-Type-Options "nosniff" always;

        # API requests
        location /api/ {
            proxy_pass http://flask_app;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # Timeouts
            proxy_connect_timeout 120s;
            proxy_send_timeout 120s;
            proxy_read_timeout 120s;
        }

        # Static files (if any)
        location /static/ {
            alias /var/www/static/;
            expires 30d;
            add_header Cache-Control "public, immutable";
        }

        # Health check
        location /health {
            access_log off;
            return 200 "OK";
        }
    }
}
```

---

## Monitoring & Logging

### Application Monitoring:

#### 1. Health Check Endpoint (Your App Has This!)
```python
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'version': '1.0.0',
        'uptime': get_uptime(),
        'cache_size': cache_service.get_size()
    })
```

#### 2. Metrics Endpoint
```python
from flask import jsonify
import time

# Track metrics
request_count = 0
request_duration = []
start_time = time.time()

@app.before_request
def before_request():
    g.start = time.time()

@app.after_request
def after_request(response):
    global request_count, request_duration
    
    request_count += 1
    duration = time.time() - g.start
    request_duration.append(duration)
    
    # Keep only last 1000 requests
    if len(request_duration) > 1000:
        request_duration.pop(0)
    
    return response

@app.route('/api/metrics')
def metrics():
    return jsonify({
        'uptime_seconds': time.time() - start_time,
        'total_requests': request_count,
        'avg_response_time': sum(request_duration) / len(request_duration) if request_duration else 0,
        'cache_hit_rate': cache_service.get_hit_rate()
    })
```

#### 3. Error Tracking (Sentry)
```python
import sentry_sdk
from sentry_sdk.integrations.flask import FlaskIntegration

sentry_sdk.init(
    dsn=os.getenv('SENTRY_DSN'),
    integrations=[FlaskIntegration()],
    traces_sample_rate=0.1,  # 10% of requests for performance monitoring
    environment=os.getenv('FLASK_ENV', 'production')
)

# Errors automatically sent to Sentry!
```

### Centralized Logging:

#### Log Aggregation Services:
- **Datadog**: Full monitoring + logging
- **Splunk**: Enterprise logging
- **ELK Stack** (Elasticsearch, Logstash, Kibana): Open-source
- **CloudWatch** (AWS), **Stackdriver** (GCP), **Azure Monitor**

#### Structured Logging for Aggregation:
```python
import json
import logging

class JsonFormatter(logging.Formatter):
    def format(self, record):
        log_record = {
            'timestamp': self.formatTime(record),
            'level': record.levelname,
            'message': record.getMessage(),
            'module': record.module,
            'function': record.funcName,
            'line': record.lineno
        }
        
        # Add custom fields
        if hasattr(record, 'user_id'):
            log_record['user_id'] = record.user_id
        if hasattr(record, 'request_id'):
            log_record['request_id'] = record.request_id
        
        return json.dumps(log_record)

handler = logging.StreamHandler()
handler.setFormatter(JsonFormatter())
logger.addHandler(handler)

# Now logs are easily parsed by aggregation tools!
```

---

## Scaling Strategies

### Vertical Scaling (Scale Up)
```
Bigger machine: 2 CPU → 8 CPU, 4GB RAM → 32GB RAM
```

**Pros:** Simple  
**Cons:** Limited, expensive, single point of failure

### Horizontal Scaling (Scale Out - Better!)
```
More machines: 1 server → 10 servers
```

**Requirements:**
- Load balancer (Nginx, AWS ALB)
- Stateless application (no session storage on server)
- Shared database/cache (all servers access same DB)

### Your App is Horizontally Scalable!
✅ Stateless (no session storage)  
✅ Uses shared Databricks  
✅ Cache can be shared (Redis instead of disk)  

**To scale:**
```bash
# Run multiple Gunicorn instances behind load balancer
Server 1: gunicorn --bind :5000 app:app
Server 2: gunicorn --bind :5000 app:app
Server 3: gunicorn --bind :5000 app:app

# Nginx distributes requests across all
```

---

## Deployment Checklist

### Before Production:
- [ ] Remove DEBUG = True
- [ ] Set strong SECRET_KEY
- [ ] Use environment variables for secrets
- [ ] Add .env to .gitignore
- [ ] Enable HTTPS
- [ ] Configure CORS properly (specific origins)
- [ ] Set up error logging (Sentry)
- [ ] Add health check endpoint
- [ ] Configure database connection pooling
- [ ] Set up caching
- [ ] Add rate limiting
- [ ] Write tests (70%+ coverage)
- [ ] Set up CI/CD pipeline
- [ ] Configure monitoring/alerting
- [ ] Document API (Swagger/OpenAPI)
- [ ] Load test (know your limits)

### Production Launch:
- [ ] Deploy to staging first
- [ ] Test on staging
- [ ] Database backups configured
- [ ] Rollback plan ready
- [ ] Monitor during launch
- [ ] Have on-call person

---

## Interview Questions

### Q1: Why can't you use Flask's built-in server in production?
**Answer:** Flask's dev server is single-threaded, not secure, and crashes easily. Designed for development with features like auto-reload. Production needs multi-process/multi-threaded WSGI server like Gunicorn that handles concurrent requests, recovers from errors, and follows security best practices.

### Q2: What is Gunicorn and how does it work?
**Answer:** Gunicorn is a Python WSGI HTTP server that runs Flask apps in production. Uses pre-fork worker model - creates multiple worker processes that handle requests concurrently. Each worker can run threads. Formula: workers = (2 × CPU) + 1. Acts as middle layer between web server (Nginx) and Flask app.

### Q3: Explain the difference between horizontal and vertical scaling.
**Answer:** Vertical scaling increases single server capacity (more CPU/RAM) - simple but limited and expensive. Horizontal scaling adds more servers running same application behind load balancer - better for high availability and theoretically unlimited. Requires stateless app and shared data store.

### Q4: What is Docker and why use it?
**Answer:** Docker packages application and dependencies into containers that run identically anywhere. Benefits: consistency across environments, isolation, easy deployment, version control for entire environment, efficient resource usage. Dockerfile defines image, docker-compose orchestrates multiple containers.

### Q5: What is CI/CD?
**Answer:** CI (Continuous Integration) automatically tests code on every commit to catch bugs early. CD (Continuous Deployment) automatically deploys if tests pass. Pipeline: commit → run tests → build → deploy. Benefits: faster releases, fewer bugs reach production, consistent deployment process.

### Q6: What is a reverse proxy and why use Nginx?
**Answer:** Reverse proxy sits in front of application servers, handling requests before they reach app. Nginx provides: SSL termination, load balancing across multiple app instances, static file serving, request routing, security (hide backend structure). More efficient at handling connections than Python apps.

### Q7: How do you handle secrets in production?
**Answer:** Never hardcode or commit secrets. Use environment variables in production set by platform (Heroku config, Docker secrets, Kubernetes secrets). For more security, use managed services (AWS Secrets Manager, Azure Key Vault, HashiCorp Vault). Rotate secrets regularly. Use .env for local development only.

### Q8: What are the key differences between development and production environments?
**Answer:** Development: DEBUG=True, detailed errors shown, auto-reload, simple server, relaxed security, local database, verbose logging. Production: DEBUG=False, generic errors, WSGI server (Gunicorn), strict security, managed database, structured logging, monitoring/alerting, HTTPS required, performance optimization.

### Q9: How would you deploy your Flask app?
**Answer:** 1) Create Dockerfile with dependencies, 2) Set up environment variables for secrets, 3) Use Gunicorn as WSGI server with multiple workers, 4) Put Nginx reverse proxy in front for HTTPS and load balancing, 5) Set up monitoring and logging, 6) Create CI/CD pipeline for automated testing and deployment, 7) Deploy to cloud platform (AWS, Azure, Heroku).

---

## Key Takeaways

✅ Never use Flask dev server in production (use Gunicorn)  
✅ Workers = (2 × CPU) + 1 for Gunicorn  
✅ Use environment variables for configuration (12-factor app)  
✅ Docker = Consistent deployments everywhere  
✅ CI/CD = Automated testing and deployment  
✅ Nginx = Reverse proxy for HTTPS, load balancing, static files  
✅ Horizontal scaling = Add more servers (better than vertical)  
✅ Monitoring & logging = Essential for production  
✅ Health checks = Know when your app is down  

**Next Step:** Move to `08_INTERVIEW_QUESTIONS.md` for comprehensive interview prep!
