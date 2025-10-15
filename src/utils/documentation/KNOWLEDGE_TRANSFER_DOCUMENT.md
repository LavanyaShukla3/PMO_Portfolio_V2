# 📚 PMO Portfolio V2 - Knowledge Transfer (KT) Document

**Project Name:** PMO Portfolio Management System V2  
**Date:** October 10, 2025  
**Prepared For:** New Team Members / Developers  

---

## 📋 Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture Overview](#architecture-overview)
3. [Backend Technologies](#backend-technologies)
4. [Frontend Technologies](#frontend-technologies)
5. [Database & Data Source](#database--data-source)
6. [Key Components Deep Dive](#key-components-deep-dive)
7. [Data Flow & API Architecture](#data-flow--api-architecture)
8. [Caching Strategy](#caching-strategy)
9. [Setup & Installation](#setup--installation)
10. [Common Operations](#common-operations)
11. [Troubleshooting](#troubleshooting)

---

## 🎯 Project Overview

### What is PMO Portfolio V2?
This is a **Portfolio Management Office (PMO) visualization tool** built for PepsiCo to manage and visualize project portfolios, programs, sub-programs, and investments across different organizational levels. The application provides **Gantt chart visualizations** with milestones, timelines, and hierarchical navigation.

### Key Features:
- ✅ **Multi-level hierarchy visualization** (Portfolio → Program → Sub-Program → Investment)
- ✅ **Interactive Gantt charts** with timeline views (Monthly, Quarterly, Yearly)
- ✅ **Progressive data loading** with pagination (optimized for 100,000+ records)
- ✅ **Real-time milestone tracking** with SG3 gateway support
- ✅ **Intelligent caching** (Redis + Disk fallback)
- ✅ **Responsive design** with Tailwind CSS
- ✅ **Region-based roadmap views**

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│  React 18 + React Router + Tailwind CSS                     │
│  ├── Portfolio View                                          │
│  ├── Program View                                            │
│  ├── Sub-Program View                                        │
│  └── Region Roadmap View                                     │
└───────────────────┬─────────────────────────────────────────┘
                    │ HTTP REST API (CORS Enabled)
                    │ http://localhost:3000 → http://localhost:5000
                    ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND API SERVER                        │
│  Flask 3.0 + Python 3.13                                     │
│  ├── Progressive Loading Endpoints                           │
│  ├── Pagination Service (50-200 records/page)               │
│  ├── Cache Service (Redis → Disk fallback)                  │
│  └── Databricks SQL Client                                   │
└───────────────────┬─────────────────────────────────────────┘
                    │ Databricks SQL Connector
                    │ HTTPS + Access Token Authentication
                    ▼
┌─────────────────────────────────────────────────────────────┐
│              AZURE DATABRICKS SQL WAREHOUSE                  │
│  Unity Catalog: uc_prod_cgf_mdip_01                         │
│  Schema: poi_edw_business_view                              │
│  ├── clrty_hierarchies_v (Hierarchy data)                   │
│  └── clrty_investments_v (Investment/Milestone data)        │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 Backend Technologies

### Core Framework & Language
| Technology | Version | Purpose |
|------------|---------|---------|
| **Python** | 3.13 | Backend programming language |
| **Flask** | 3.0.0 | Lightweight web framework for REST API |
| **flask-cors** | 4.0.0 | Cross-Origin Resource Sharing for React frontend |

### Database Connectivity
| Technology | Version | Purpose |
|------------|---------|---------|
| **databricks-sql-connector** | 3.3.0 | Official Databricks connector for Python |
| **python-dotenv** | 1.0.0 | Environment variable management |

### Caching & Performance
| Technology | Version | Purpose |
|------------|---------|---------|
| **redis** | 5.0.1 | In-memory cache (primary) |
| **diskcache** | 5.6.3 | Persistent disk-based cache (fallback) |

### Backend File Structure:
```
backend/
├── app.py                      # Main Flask application
├── databricks_client.py        # Databricks connection handler
├── cache_service.py            # Intelligent caching (Redis + Disk)
├── pagination_service.py       # Pagination logic
├── optimized_routes.py         # Additional API routes
├── requirements.txt            # Python dependencies
├── README.md                   # Backend documentation
├── sql_queries/
│   ├── hierarchy_query.sql     # Portfolio/Program hierarchy query
│   └── investment_query.sql    # Investment/milestone data query
└── cache/
    └── cache.db                # SQLite-based disk cache
```

---

## 💻 Frontend Technologies

### Core Framework & Libraries
| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 18.2.0 | UI library for component-based architecture |
| **react-router-dom** | 7.7.1 | Client-side routing |
| **react-scripts** | 5.0.1 | Build tooling (Create React App) |

### Styling & UI
| Technology | Version | Purpose |
|------------|---------|---------|
| **Tailwind CSS** | 3.4.17 | Utility-first CSS framework |
| **PostCSS** | 8.5.6 | CSS processing tool |
| **date-fns** | 2.30.0 | Date manipulation library |

### Frontend File Structure:
```
src/
├── App.jsx                     # Main application component
├── index.jsx                   # React entry point
├── components/                 # Reusable UI components
│   ├── GanttBar.jsx           # Gantt chart bar visualization
│   ├── MilestoneMarker.jsx    # Milestone indicator
│   ├── TimelineAxis.jsx       # Date axis component
│   ├── PaginationControls.jsx # Pagination UI
│   └── LoadingSpinner.jsx     # Loading state indicator
├── pages/                     # View pages
│   ├── PortfolioGanttChart.jsx
│   ├── ProgramGanttChart.jsx
│   ├── SubProgramGanttChartFull.jsx
│   └── RegionRoadMap.jsx
├── contexts/
│   └── GlobalDataCacheContext.jsx  # Global state management
├── services/
│   └── progressiveApiService.js    # API communication layer
└── utils/
    ├── dateUtils.js           # Date formatting utilities
    └── apiValidation.js       # Data validation
```

---

## 🗄️ Database & Data Source

### Azure Databricks Configuration

**Connection Details:**
- **Platform:** Azure Databricks SQL Warehouse
- **Server:** `adb-1944263524297370.10.azuredatabricks.net`
- **HTTP Path:** `/sql/1.0/warehouses/2dd0b6935c0ba472`
- **Authentication:** Personal Access Token (PAT)
- **Catalog:** `uc_prod_cgf_mdip_01` (Unity Catalog)
- **Schema:** `poi_edw_business_view`

### Database Connection Flow

```python
# Environment Variables (loaded from .env file)
DATABRICKS_SERVER_HOSTNAME=adb-1944263524297370.10.azuredatabricks.net
DATABRICKS_HTTP_PATH=/sql/1.0/warehouses/2dd0b6935c0ba472
DATABRICKS_ACCESS_TOKEN=dapi6458498104f82b27fd9d7d705f318qwe

# Connection established in databricks_client.py
from databricks import sql

connection = sql.connect(
    server_hostname=DATABRICKS_SERVER_HOSTNAME,
    http_path=DATABRICKS_HTTP_PATH,
    access_token=DATABRICKS_ACCESS_TOKEN
)
```

### Key Database Views

#### 1. **clrty_hierarchies_v** (Hierarchy View)
Contains the organizational structure:
- Portfolio hierarchy relationships
- Parent-child relationships
- Hierarchy levels (Portfolio → Program → Sub-Program → Investment)
- Investment types and names
- Filtered by: `HIERARCHY_EXTERNAL_ID = 'H-0056'` (PMO COE Hierarchy)

**Key Columns:**
- `HIERARCHY_EXTERNAL_ID`: Hierarchy identifier
- `HIE_INV_EXTERNAL_ID`: Investment external ID
- `HIE_INV_NAME`: Investment name
- `HIE_INV_TYPE_NAME`: Type (Portfolio, Program, Sub-Program, Investment)
- `HIE_INV_HIERARCHY_LEVEL`: Level in hierarchy
- `HIE_INV_PARENT_EXT_ID`: Parent investment ID
- `HIE_INV_PARENT_NAME`: Parent investment name

#### 2. **clrty_investments_v** (Investment & Milestone View)
Contains timeline and milestone data:
- Investment start/end dates
- Roadmap elements (Phases, Milestones, Tasks)
- Milestone dates and statuses
- SG3 gateway milestones

**Key Columns:**
- `INV_EXT_ID`: Investment external ID (FK to hierarchy)
- `INV_NAME`: Investment name
- `INV_START_DATE`: Investment start date
- `INV_FINISH_DATE`: Investment end date
- `ROADMAP_ELEMENT`: Type (Investment, Phase, Milestone)
- `TASK_NAME`: Milestone/task name
- `TASK_START`: Milestone date
- `MILESTONE_STATUS`: Status (Completed, In Progress, etc.)

### SQL Query Strategy

The application uses **two main SQL queries**:

1. **Hierarchy Query** (`hierarchy_query.sql`):
   - Fetches portfolio/program structure
   - Filters active investments only
   - Excludes "Ideas" type investments
   - Builds parent-child relationships with CTEs (Common Table Expressions)

2. **Investment Query** (`investment_query.sql`):
   - Fetches timeline and milestone data
   - Parameterized queries for specific investment IDs
   - Uses `WHERE INV_EXT_ID IN (...)` for efficient filtering

---

## 🔑 Key Components Deep Dive

### Backend Components

#### 1. **app.py** - Main Flask Application
**Responsibilities:**
- Initialize Flask server
- Configure CORS for frontend communication
- Define API endpoints
- Load environment variables
- Health check and connection testing

**Key Endpoints:**
```python
GET  /api/health                # Health check
GET  /api/test-connection       # Test Databricks connectivity
GET  /api/data/portfolio        # Portfolio-level data (paginated)
GET  /api/data/program          # Program-level data (paginated)
GET  /api/data/subprogram       # Sub-program data (paginated)
GET  /api/data/investment       # Investment details with milestones
```

#### 2. **databricks_client.py** - Database Connection Manager
**Responsibilities:**
- Establish and manage Databricks connections
- Execute parameterized SQL queries (SQL injection prevention)
- Handle connection pooling and timeouts
- Integrate with cache service

**Key Methods:**
```python
connect()                              # Establish connection
disconnect()                           # Close connection
execute_query(query, parameters)       # Execute SQL with caching
```

**Security Features:**
- ✅ Parameterized queries (prevent SQL injection)
- ✅ Token-based authentication
- ✅ Query timeout management (default 600s)
- ✅ Connection error handling

#### 3. **cache_service.py** - Intelligent Caching
**Responsibilities:**
- Primary: Redis in-memory cache (fast)
- Fallback: Disk cache (persistent)
- TTL (Time-To-Live) management
- Cache key generation (MD5 hashing)

**Cache Strategy:**
```
Query Request
    ↓
Check Redis Cache → Hit? → Return cached data
    ↓ Miss
Check Disk Cache → Hit? → Return cached data
    ↓ Miss
Execute Databricks Query → Cache results → Return data
```

**Configuration:**
- Default TTL: 300 seconds (5 minutes)
- Disk cache size limit: 500 MB
- Redis host: localhost:6379

#### 4. **pagination_service.py** - Pagination Logic
**Responsibilities:**
- Add LIMIT/OFFSET to SQL queries
- Generate count queries for total records
- Create pagination metadata

**Pagination Parameters:**
- Default page size: 50 records
- Max page size: 200 records
- Page numbers: 1-based indexing

---

### Frontend Components

#### 1. **App.jsx** - Main Application Container
**Responsibilities:**
- Route management between views
- Global state management
- Data validation on startup
- View state preservation

#### 2. **GlobalDataCacheContext.jsx** - State Management
**Responsibilities:**
- Centralized data caching across views
- Background data loading
- Loading progress tracking
- Error state management

#### 3. **progressiveApiService.js** - API Communication Layer
**Responsibilities:**
- Fetch data from backend API
- Handle pagination requests
- Transform API response to frontend format
- Error handling and retries

**Key Functions:**
```javascript
fetchPortfolioData(page, limit)        // Get portfolio list
fetchProgramData(portfolioId)          // Get programs by portfolio
fetchSubProgramData(programId)         // Get sub-programs by program
fetchInvestmentDetail(investmentIds)   // Get investment milestones
```

#### 4. **GanttBar.jsx** - Timeline Visualization
**Responsibilities:**
- Render project timelines as horizontal bars
- Calculate bar width based on date range
- Position bars on timeline axis
- Handle different timeline views (Monthly/Quarterly/Yearly)

#### 5. **MilestoneMarker.jsx** - Milestone Indicator
**Responsibilities:**
- Display milestone markers on timeline
- Different styles for SG3 vs regular milestones
- Tooltip with milestone details
- Status-based coloring

---

## 📊 Data Flow & API Architecture

### Request Flow (Example: Portfolio View)

```
1. USER OPENS PORTFOLIO VIEW
   ↓
2. React Component Mounts (PortfolioGanttChart.jsx)
   ↓
3. Call progressiveApiService.fetchPortfolioData(page=1, limit=50)
   ↓
4. Frontend HTTP GET → http://localhost:5000/api/data/portfolio?page=1&limit=50
   ↓
5. Flask app.py receives request
   ↓
6. Cache Service checks Redis → Not found
   ↓
7. Cache Service checks Disk → Not found
   ↓
8. Databricks Client executes SQL query
   │
   ├── Read hierarchy_query.sql
   ├── Add WHERE clause for top-level portfolios
   ├── Add pagination (LIMIT 50 OFFSET 0)
   └── Execute on Databricks
   ↓
9. Databricks returns 50 portfolio records
   ↓
10. Cache Service stores results (Redis + Disk)
    ↓
11. Flask returns JSON response:
    {
      "status": "success",
      "data": { hierarchy: [...], investment: [...] },
      "pagination": { current_page: 1, total_count: 150, ... }
    }
    ↓
12. Frontend processes data (progressiveApiService)
    ↓
13. Component renders Gantt chart with 50 portfolios
    ↓
14. User clicks "Next Page"
    ↓
15. Repeat with page=2 (cache hit from step 10!)
```

---

## ⚡ Caching Strategy

### Why Caching?
- Databricks queries can take 5-30 seconds for complex queries
- Repeated queries waste resources and slow down user experience
- Caching provides **sub-second response times** for repeated requests

### Two-Tier Cache Architecture

#### Tier 1: Redis (In-Memory)
- **Speed:** Extremely fast (< 1ms latency)
- **Persistence:** No (data lost on restart)
- **Capacity:** Limited by RAM
- **Best for:** Hot data, frequently accessed records

#### Tier 2: Disk Cache (SQLite-based)
- **Speed:** Fast (5-50ms latency)
- **Persistence:** Yes (survives restarts)
- **Capacity:** 500 MB limit (configurable)
- **Best for:** Warm data, backup for Redis

### Cache Key Generation
```python
# Cache key includes query + parameters for uniqueness
import hashlib

def _generate_key(query: str, params: dict) -> str:
    key_data = f"{query}_{params or {}}"
    return f"pmo_query_{hashlib.md5(key_data.encode()).hexdigest()}"
```

### Cache TTL (Time-To-Live)
- **Default:** 1800 seconds (30 minutes)
- **Rationale:** Data changes infrequently in Databricks
- **Customizable:** Can adjust per-query if needed

### Cache Invalidation
Currently **time-based expiration**. Future enhancement could include:
- Manual cache clearing endpoint
- Webhook-based invalidation on data changes
- Smart invalidation on specific hierarchy updates

---

## 🚀 Setup & Installation

### Prerequisites
- **Python 3.13+** installed
- **Node.js 18+** and npm installed
- **Access to Azure Databricks** (credentials required)
- **(Optional) Redis Server** for optimal caching

### Step 1: Clone Repository
```powershell
git clone <repository-url>
cd PMO_Portfolio_V2
```

### Step 2: Backend Setup
```powershell
# Navigate to backend directory
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Verify .env file exists with Databricks credentials
# Should contain:
# DATABRICKS_SERVER_HOSTNAME=adb-1944263524297370.10.azuredatabricks.net
# DATABRICKS_HTTP_PATH=/sql/1.0/warehouses/2dd0b6935c0ba472
# DATABRICKS_ACCESS_TOKEN=dapi6458498104f82b27fd9d7d705f318qwe

# Test connection
python quick_connectivity_test.py

# Start backend server
python app.py
```

Backend will run on **http://localhost:5000**

### Step 3: Frontend Setup
```powershell
# Open new terminal, navigate to project root
cd ..

# Install npm dependencies
npm install

# Start React development server
npm start
```

Frontend will run on **http://localhost:3000**

### Step 4: Verify Setup
1. Open browser → http://localhost:3000
2. You should see Portfolio view loading
3. Check browser console for any errors
4. Check backend terminal for API requests

---

## 🛠️ Common Operations

### Running the Application

**Option 1: Manual Start**
```powershell
# Terminal 1 - Backend
cd backend
python app.py

# Terminal 2 - Frontend
npm start
```

**Option 2: Use Batch File (Windows)**
```powershell
# Start backend using batch file
start_backend.bat
```

### Viewing Logs

**Backend Logs:**
```powershell
# In backend terminal, you'll see:
INFO - Successfully connected to Databricks
INFO - Fetching portfolio data - Page: 1, Limit: 50
INFO - 🚀 Cache hit! Returning 50 cached rows
```

**Frontend Logs:**
- Open browser DevTools (F12)
- Check Console tab for React logs
- Check Network tab for API calls

### Testing Database Connection
```powershell
cd backend
python quick_connectivity_test.py
```

Expected output:
```
✅ Databricks connection successful
✅ Query execution successful
✅ Retrieved X records
```

### Clearing Cache

**Clear Redis Cache:**
```powershell
redis-cli FLUSHDB
```

**Clear Disk Cache:**
```powershell
# Delete cache files
rm backend/cache/cache.db*
# OR
del backend\cache\cache.db*
```

### Viewing Data in Databricks

1. Login to Azure Databricks
2. Navigate to SQL Editor
3. Use these test queries:

```sql
-- View hierarchy data
SELECT * 
FROM uc_prod_cgf_mdip_01.poi_edw_business_view.clrty_hierarchies_v 
WHERE HIERARCHY_EXTERNAL_ID = 'H-0056' 
LIMIT 10;

-- View investment data
SELECT * 
FROM uc_prod_cgf_mdip_01.poi_edw_business_view.clrty_investments_v 
WHERE INV_ACTIVE = 'Yes' 
LIMIT 10;
```

---

## 🐛 Troubleshooting

### Backend Issues

#### Issue: "Connection to Databricks failed"
**Causes:**
- Invalid access token
- Incorrect server hostname or HTTP path
- Network connectivity issues
- Token expired

**Solutions:**
1. Verify `.env` file has correct credentials
2. Test token in Databricks UI
3. Check firewall/VPN settings
4. Regenerate access token if expired

#### Issue: "Redis not available"
**Impact:** Application will work but use disk cache only (slower)

**Solutions:**
1. Install Redis: `choco install redis-64` (Windows)
2. Start Redis service: `redis-server`
3. Verify connection: `redis-cli ping` (should return "PONG")

#### Issue: "Disk cache corruption"
**Error:** `disk.Timeout` or cache read failures

**Solutions:**
```powershell
# Stop backend
# Delete corrupted cache
del backend\cache\cache.db*
# Restart backend (will recreate cache)
```

#### Issue: "Query timeout"
**Error:** Query exceeds 600s timeout

**Solutions:**
1. Check Databricks SQL Warehouse is running
2. Increase timeout in `databricks_client.py`:
   ```python
   execute_query(query, timeout=1200)  # 20 minutes
   ```
3. Optimize SQL query with better WHERE clauses

### Frontend Issues

#### Issue: "CORS error"
**Error:** "Access-Control-Allow-Origin" error in browser console

**Solutions:**
1. Verify backend is running on port 5000
2. Check `app.py` CORS configuration:
   ```python
   frontend_urls = ['http://localhost:3000']
   CORS(app, origins=frontend_urls)
   ```
3. Restart backend after changes

#### Issue: "API connection failed"
**Error:** "Failed to fetch" or network errors

**Solutions:**
1. Verify backend is running: http://localhost:5000/api/health
2. Check `env.local` file:
   ```
   REACT_APP_API_URL=http://localhost:5000
   ```
3. Restart frontend after .env changes

#### Issue: "Data not loading / infinite spinner"
**Causes:**
- Backend returning errors
- Data validation failing
- Cache issues

**Debug Steps:**
1. Open Browser DevTools → Network tab
2. Check API calls for error responses
3. Check backend logs for Python exceptions
4. Clear browser cache: Ctrl+Shift+Delete

### Data Issues

#### Issue: "No data displayed"
**Causes:**
- Empty result from database
- Incorrect hierarchy filter
- Data format mismatch

**Debug:**
1. Check backend response in Network tab
2. Verify SQL queries return data in Databricks UI
3. Check `HIERARCHY_EXTERNAL_ID = 'H-0056'` filter is correct

#### Issue: "Milestones not appearing"
**Causes:**
- Investment has no milestone records
- ROADMAP_ELEMENT filtering issue
- Date parsing problems

**Debug:**
1. Check investment query results
2. Verify `ROADMAP_ELEMENT` contains "Milestones"
3. Check date formats in `dateUtils.js`

---

## 📚 Additional Resources

### Important Files to Review
1. **PROGRESSIVE_LOADING_MIGRATION_GUIDE.md** - Details on pagination implementation
2. **ULTRA_AGGRESSIVE_OPTIMIZATION.md** - Performance optimization strategies
3. **BACKEND_PROGRESSIVE_IMPLEMENTATION_SUMMARY.md** - Backend architecture decisions
4. **backend/README.md** - Backend-specific documentation

### SQL Query Files
- `backend/sql_queries/hierarchy_query.sql` - Complex hierarchy CTE query
- `backend/sql_queries/investment_query.sql` - Investment and milestone query

### Key Dependencies Documentation
- **Flask:** https://flask.palletsprojects.com/
- **Databricks SQL Connector:** https://docs.databricks.com/dev-tools/python-sql-connector.html
- **React:** https://react.dev/
- **Tailwind CSS:** https://tailwindcss.com/docs

---

## 🎓 Learning Path for New Developers

### Week 1: Understand the Stack
- [ ] Review this KT document thoroughly
- [ ] Set up development environment
- [ ] Run application locally
- [ ] Explore Databricks UI and sample queries
- [ ] Understand the hierarchy structure

### Week 2: Backend Deep Dive
- [ ] Read `app.py` and understand Flask routing
- [ ] Study `databricks_client.py` connection logic
- [ ] Review SQL queries in `sql_queries/` folder
- [ ] Test API endpoints with Postman/curl
- [ ] Understand caching mechanism

### Week 3: Frontend Deep Dive
- [ ] Review React component structure
- [ ] Understand `progressiveApiService.js`
- [ ] Study Gantt chart rendering logic
- [ ] Explore state management with Context API
- [ ] Test different views (Portfolio, Program, Sub-Program)

### Week 4: Make Your First Changes
- [ ] Add a new API endpoint
- [ ] Create a new frontend component
- [ ] Modify SQL query to add a field
- [ ] Update documentation
- [ ] Submit your first pull request!

---

## 📞 Support & Contacts

### Code Repository
- **GitHub:** PMO_Portfolio_V2
- **Branch:** main

### Key Contacts
- **Project Owner:** [Add name]
- **Tech Lead:** [Add name]
- **Database Admin:** [Add name]

### Getting Help
1. Check this KT document
2. Review error logs (backend terminal + browser console)
3. Search existing documentation files
4. Ask team members on [communication channel]

---

## ✅ KT Completion Checklist

Use this checklist to ensure knowledge transfer is complete:

- [ ] Environment setup completed successfully
- [ ] Application runs without errors
- [ ] Understand backend architecture
- [ ] Understand frontend architecture
- [ ] Can explain database connection flow
- [ ] Can explain caching strategy
- [ ] Can navigate codebase confidently
- [ ] Know how to troubleshoot common issues
- [ ] Reviewed all SQL queries
- [ ] Tested all main features
- [ ] Made a small code change successfully
- [ ] Read additional documentation files

---

**Document Version:** 1.0  
**Last Updated:** October 10, 2025  
**Next Review:** [Add date]

---

*This document should be kept up-to-date as the project evolves. Please update it when making significant architectural changes.*
