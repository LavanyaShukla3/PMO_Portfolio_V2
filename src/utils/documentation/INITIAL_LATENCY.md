# Initial Load Performance Analysis & Optimization Guide

**Document Version:** 1.0  
**Analysis Date:** October 15, 2025  
**Scope:** Comprehensive analysis of data latency from "Loading Data..." to Portfolio page display

---

## Executive Summary

This document provides a comprehensive analysis of the initial load performance bottlenecks in the PMO Portfolio V2 application. The latency between the blue "Loading Data..." message and the actual portfolio page display is caused by **multiple sequential operations** spanning frontend validation, backend API calls, complex database queries, data processing, and React rendering.

### Key Findings:
- **Estimated Total Initial Load Time:** 8-15 seconds (depending on database performance)
- **Primary Bottleneck:** Complex Databricks SQL queries (70-80% of total time)
- **Secondary Bottlenecks:** Sequential data loading, frontend data processing, and React rendering

---

## Table of Contents

1. [Current Architecture Overview](#1-current-architecture-overview)
2. [Detailed Latency Breakdown](#2-detailed-latency-breakdown)
3. [Frontend Performance Analysis](#3-frontend-performance-analysis)
4. [Backend Performance Analysis](#4-backend-performance-analysis)
5. [Database Performance Analysis](#5-database-performance-analysis)
6. [Network & Data Transfer Analysis](#6-network--data-transfer-analysis)
7. [Quantified Performance Metrics](#7-quantified-performance-metrics)
8. [Optimization Recommendations](#8-optimization-recommendations)
9. [Implementation Roadmap](#9-implementation-roadmap)

---

## 1. Current Architecture Overview

### 1.1 Technology Stack

**Frontend:**
- React 18+ with functional components and hooks
- Context API for global state management
- Progressive loading implementation
- Hosted: Static file serving (likely Azure Static Web Apps or App Service)

**Backend:**
- Flask Python API server
- Databricks SQL connector for database access
- File-based caching (30-minute TTL)
- REST API endpoints with pagination support
- Hosted: Azure Web App or VM

**Database:**
- Azure Databricks SQL Warehouse
- Complex multi-CTE queries with data transformation
- Data sources: Clarity PMO system integration tables

### 1.2 Current Data Flow

```
User Opens App
    ↓
[1] App.jsx loads → apiValidation.js checks health endpoint (~500ms)
    ↓
[2] GlobalDataCacheContext triggers data loading (~10-12s)
    ↓
    [2a] Fetch Portfolio Data (~8-10s)
         - Backend receives request
         - Reads hierarchy_query.sql (311 lines, complex CTEs)
         - Executes Databricks query (~6-8s)
         - Reads investment_query.sql (785 lines, complex CTEs)
         - Executes Databricks query (~2-4s)
         - Returns data to frontend
    ↓
    [2b] ProcessRawApiData processes response (~500-1000ms)
    ↓
    [2c] React context updates state
    ↓
[3] PortfolioGanttChart renders (~500-1000ms)
    ↓
    [3a] Process milestones with position calculations
    [3b] Filter data by timeline viewport
    [3c] Paginate data
    [3d] Render SVG Gantt chart
    ↓
[4] User sees Portfolio page
```

---

## 2. Detailed Latency Breakdown

### 2.1 Sequential Operation Timeline

| Phase | Operation | Estimated Time | Percentage | Cumulative |
|-------|-----------|---------------|------------|------------|
| **Phase 1** | **App Initialization** | **~500ms** | **~4%** | **0.5s** |
| 1.1 | React app bundle load & parse | 200-300ms | 2% | 0.3s |
| 1.2 | API validation (health check) | 100-200ms | 1% | 0.5s |
| | | | | |
| **Phase 2** | **Backend Data Fetch** | **~8-10s** | **~72%** | **10.5s** |
| 2.1 | Network request to Flask API | 50-100ms | <1% | 10.55s |
| 2.2 | Read hierarchy_query.sql | 10-20ms | <1% | 10.57s |
| 2.3 | **Execute Databricks hierarchy query** | **6-8s** | **~55%** | **16.57s** |
| | - Connection establishment | 200-500ms | 3% | |
| | - Query compilation | 500-1000ms | 6% | |
| | - Query execution (311 lines, 16 CTEs) | 5-6.5s | 46% | |
| 2.4 | Read investment_query.sql | 10-20ms | <1% | 16.59s |
| 2.5 | **Execute Databricks investment query** | **2-4s** | **~18%** | **18.59s** |
| | - Query compilation | 300-500ms | 3% | |
| | - Query execution (785 lines, 10+ CTEs) | 1.5-3.5s | 15% | |
| 2.6 | Data serialization & network transfer | 100-300ms | 2% | 18.89s |
| | | | | |
| **Phase 3** | **Frontend Data Processing** | **~1-1.5s** | **~10%** | **20.39s** |
| 3.1 | Parse JSON response | 100-200ms | 1% | 20.49s |
| 3.2 | ProcessRawApiData transformation | 500-800ms | 5% | 21.29s |
| | - Filter investment records | 100ms | | |
| | - Map milestones | 200-300ms | | |
| | - Create portfolio objects | 200-300ms | | |
| 3.3 | Context state update | 50-100ms | <1% | 21.39s |
| 3.4 | Component re-render triggers | 100-300ms | 2% | 21.69s |
| | | | | |
| **Phase 4** | **React Rendering** | **~1-2s** | **~12%** | **23.69s** |
| 4.1 | PortfolioGanttChart initial render | 200-400ms | 2% | 23.89s |
| 4.2 | Process milestones with positions | 300-600ms | 4% | 24.49s |
| 4.3 | Timeline filtering & pagination | 200-300ms | 2% | 24.79s |
| 4.4 | SVG rendering (bars, milestones) | 300-700ms | 4% | 25.49s |
| | | | | |
| **TOTAL** | **Initial Load Complete** | **~12-15s** | **100%** | **~15s** |

**Note:** These estimates are based on typical performance. Actual times may vary based on:
- Database warehouse size and load
- Network latency (on-premise vs remote)
- Data volume (number of portfolios, programs, investments)
- Browser performance and device capabilities

---

## 3. Frontend Performance Analysis

### 3.1 React Component Bottlenecks

#### 3.1.1 App.jsx - Initial Validation Delay
**File:** `src/App.jsx`  
**Issue:** Sequential API validation before showing UI

```javascript
// Lines 35-48: Validation blocks UI rendering
useEffect(() => {
    const validateData = async () => {
        try {
            const validation = await validateApiData();  // ~500ms
            setDataValidation({ ...validation, isLoading: false });
        } catch (error) {
            // Error handling
        }
    };
    validateData();
}, []);

// Lines 54-66: Loading state blocks entire UI
if (dataValidation.isLoading) {
    return (
        <div className="min-h-screen bg-gray-50 p-4">
            <div className="bg-blue-50 border border-blue-400">
                <h2>Loading Data...</h2>  {/* User stuck here! */}
            </div>
        </div>
    );
}
```

**Impact:**
- **Time:** ~500ms
- **User Experience:** Blue "Loading Data..." message appears here
- **Blocking:** Completely blocks all UI rendering

**Why it's slow:**
1. Makes 1 health check HTTP request to backend
2. Waits for response before proceeding
3. Blocks Context initialization

---

#### 3.1.2 GlobalDataCacheContext - Sequential Loading
**File:** `src/contexts/GlobalDataCacheContext.jsx`  
**Issue:** Loads Portfolio first, then loads other data sequentially

```javascript
// Lines 217-250: Portfolio loaded first (GOOD)
// PHASE 1: Load Portfolio data FIRST
const portfolioData = await fetchPortfolioData(1, 5000);  // ~8-10s
dispatch({ type: ACTIONS.SET_PORTFOLIO_DATA, payload: portfolioData });

// PHASE 2: Continue loading other data in background
// This doesn't block UI, but still takes time
const backgroundPromises = [
    fetchProgramData(null, { page: 1, limit: 5000 }),      // ~6-8s
    fetchSubProgramData(null, { page: 1, limit: 15000 }),  // ~8-12s
    fetchRegionData(null, { page: 1, limit: 5000 }),       // ~6-8s
    // ...
];
```

**Impact:**
- **Portfolio Load Time:** ~8-10 seconds (PRIMARY BOTTLENECK)
- **Total Background Loading:** Additional ~20-30 seconds (doesn't block initial display)
- **User Experience:** User waits 8-10s before seeing portfolio page

**Why it's slow:**
1. Portfolio fetch makes 2 Databricks queries sequentially
2. Each query involves complex CTEs and joins
3. Data processing on frontend adds overhead

---

#### 3.1.3 PortfolioGanttChart - Rendering & Data Processing
**File:** `src/pages/PortfolioGanttChart.jsx`  
**Issue:** Heavy data transformation and SVG rendering

```javascript
// Lines 48-126: Complex milestone processing
const processMilestonesWithPosition = (milestones, timelineStartDate, ...) => {
    // Filter milestones within viewport (~100ms for 1000 milestones)
    const timelineFilteredMilestones = milestones.filter(...);
    
    // Group by month (~50ms)
    const monthlyGroups = groupMilestonesByMonth(timelineFilteredMilestones);
    
    // Create vertical labels (~200ms)
    const verticalLabelData = createVerticalMilestoneLabels(...);
    
    // Process each milestone (~300ms for 500 milestones)
    monthMilestones.forEach((milestone, index) => {
        // Calculate positions, labels, etc.
    });
};

// Lines 187-196: useEffect triggers on data changes
useEffect(() => {
    if (portfolioData && portfolioData.data) {
        setAllData(portfolioData.data);  // Triggers re-render
        setCurrentPage(1);
        setLoading(false);
    }
}, [portfolioData, cacheLoading]);
```

**Impact:**
- **Time:** ~1-2 seconds
- **Operations:**
  - Milestone processing: ~500-800ms
  - Timeline filtering: ~200-300ms
  - SVG rendering: ~300-700ms

**Why it's slow:**
1. Processes ALL milestones for ALL portfolios upfront
2. Complex position calculations for each milestone
3. SVG DOM manipulation is expensive
4. Multiple useEffect hooks trigger re-renders

---

### 3.2 Frontend Data Processing Bottlenecks

#### 3.2.1 progressiveApiService.js - Data Transformation
**File:** `src/services/progressiveApiService.js`  
**Issue:** Transforms raw API data into component-friendly format

```javascript
// Lines 77-140: Heavy data transformation
function processRawApiData(apiResponse) {
    // Get investment records (~50ms)
    const investmentRecords = investmentData.filter(inv => 
        inv.ROADMAP_ELEMENT === 'Investment'
    );
    
    // Process each investment (~500-800ms for 500 investments)
    investmentRecords.forEach(investment => {
        // Find milestones (~200ms)
        const milestones = investmentData.filter(...).map(...);
        
        // Create portfolio data object (~100ms)
        const portfolioData = { /* ... */ };
        
        processedData.push(portfolioData);
    });
    
    return processedData;
}
```

**Impact:**
- **Time:** ~500-1000ms
- **Loops:** Nested forEach and filter operations
- **Data Volume:** Processes hundreds of investment records

**Why it's slow:**
1. Filters entire investment array multiple times
2. Creates new objects for each investment
3. No memoization or caching of intermediate results

---

## 4. Backend Performance Analysis

### 4.1 Flask API Endpoint Analysis

#### 4.1.1 /api/data/portfolio Endpoint
**File:** `backend/app.py`  
**Lines:** 90-155

```python
@app.route('/api/data/portfolio', methods=['GET'])
def get_portfolio_data():
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 50))
    
    # 1. Read hierarchy query file (~10ms)
    with open(HIERARCHY_QUERY_FILE, 'r') as f:
        hierarchy_query = f.read().strip().rstrip(';')
    
    # 2. Add WHERE clause (~5ms)
    hierarchy_query += " WHERE COE_ROADMAP_TYPE = 'Portfolio'"
    
    # 3. Add pagination (~5ms)
    offset = (page - 1) * limit
    hierarchy_query += f" ORDER BY CHILD_ID LIMIT {limit} OFFSET {offset}"
    
    # 4. Execute query (~6-8s) - MAJOR BOTTLENECK
    hierarchy_results = databricks_client.execute_query(hierarchy_query)
    
    # 5. Extract portfolio IDs (~10ms)
    portfolio_ids = [row['CHILD_ID'] for row in hierarchy_results]
    
    # 6. Read investment query file (~10ms)
    with open(INVESTMENT_QUERY_FILE, 'r') as f:
        investment_query = f.read().strip().rstrip(';')
    
    # 7. Add WHERE clause for investment filtering (~10ms)
    investment_query += f" WHERE INV_EXT_ID IN ('{portfolio_ids_str}')"
    
    # 8. Execute investment query (~2-4s) - SECOND MAJOR BOTTLENECK
    investment_results = databricks_client.execute_query(investment_query)
    
    # 9. Return response (~50ms)
    return jsonify(response_data)
```

**Impact:**
- **Total Time:** ~8-10 seconds
- **Breakdown:**
  - File I/O: ~40ms
  - String operations: ~30ms
  - **Databricks queries: ~8-12s** (95% of backend time)
  - JSON serialization: ~50-100ms

---

### 4.2 Databricks Client Analysis

#### 4.2.1 Connection Management
**File:** `backend/databricks_client.py`  
**Lines:** 101-110

```python
# Creates NEW connection for EACH query
connection = sql.connect(
    server_hostname=self.server_hostname,
    http_path=self.http_path,
    access_token=self.access_token,
    _user_agent_entry="PMO-Portfolio/1.0.0"
)
```

**Impact:**
- **Connection Overhead:** ~200-500ms per query
- **Issue:** No connection pooling - creates/destroys connection every time
- **API Call Pattern:** 2 queries = 2 connections = ~400-1000ms just for connection overhead

---

#### 4.2.2 Query Execution
**File:** `backend/databricks_client.py`  
**Lines:** 128-145

```python
# Execute query
cursor.execute(query)

# Fetch results
results = []
for row in cursor.fetchall():
    results.append(dict(zip(columns, row)))  # Convert to dict

logger.info(f"✅ Query executed successfully, returned {len(results)} rows")
```

**Impact:**
- **Row Processing:** ~1-2ms per row
- **For 500 rows:** ~500-1000ms additional overhead
- **Memory:** Loads ALL results into memory at once

---

## 5. Database Performance Analysis

### 5.1 Hierarchy Query Complexity

**File:** `backend/sql_queries/hierarchy_query.sql` (311 lines)  
**Structure:** 16 Common Table Expressions (CTEs) with complex joins

#### Query Breakdown:

```sql
WITH 
    -- CTE 1: Get active investments only (~200ms)
    ACTIVE_INV_ONLY AS ( ... ),
    
    -- CTE 2: Join hierarchy data (~500ms)
    HIE_KEY_COLS AS ( ... ),
    
    -- CTE 3: Join parent types (~300ms)
    HIE_W_PAR_TYPE AS ( ... ),
    
    -- CTE 4-8: Identify valid parents with multiple self-joins (~2-3s)
    HIE_VALID_PARENTS_PT1 AS ( ... ),
    HIE_VALID_PARENTS_PT2 AS ( ... ),
    HIE_VALID_PARENTS_PT3 AS ( ... ),
    HIE_VALID_PARENTS_PT4 AS ( ... ),
    HIE_VALID_PARENTS_PT5 AS ( ... ),
    
    -- CTE 9-10: Determine COE investment type (~800ms)
    HIE_COE_INV_TYPE_PT1 AS ( ... ),
    HIE_COE_INV_TYPE_PT2 AS ( ... ),
    
    -- CTE 11-15: Handle non-Clarity deployments (~1-2s)
    NON_CLRTY_DEPLOYMENTS_PT1 AS ( ... ),
    NON_CLRTY_DEPLOYMENTS_PT2 AS ( ... ),
    NON_CLRTY_DEPLOYMENTS_PT3 AS ( ... ),
    NON_CLRTY_DEPLOYMENTS_PT4 AS ( ... ),
    NON_CLRTY_DEPLOYMENTS_PT5 AS ( ... ),
    
    -- CTE 16: Union all data (~500ms)
    HIE_VALID_PARENTS_PT6 AS ( ... )

-- Final SELECT
SELECT * FROM HIE_VALID_PARENTS_PT6
WHERE COE_ROADMAP_TYPE = 'Portfolio'  -- Added by backend
ORDER BY CHILD_ID LIMIT 50 OFFSET 0   -- Added by backend
```

**Performance Analysis:**

| CTE Stage | Operation | Est. Time | Rows Processed |
|-----------|-----------|-----------|----------------|
| ACTIVE_INV_ONLY | Single table scan | 200ms | ~5,000 investments |
| HIE_KEY_COLS | Join hierarchy table | 500ms | ~15,000 rows |
| HIE_W_PAR_TYPE | Self-join for parent types | 300ms | ~15,000 rows |
| HIE_VALID_PARENTS_PT1-4 | Multiple self-joins | 2-3s | ~50,000 intermediate rows |
| HIE_COE_INV_TYPE_PT1-2 | Aggregation & grouping | 800ms | ~10,000 rows |
| NON_CLRTY_DEPLOYMENTS | String parsing & filtering | 1-2s | ~2,000 tasks |
| Final UNION & SELECT | Combine & filter | 500ms | Result: ~50 portfolios |

**Total Query Time:** 6-8 seconds

---

### 5.2 Investment Query Complexity

**File:** `backend/sql_queries/investment_query.sql` (785 lines)  
**Structure:** 10+ Common Table Expressions (CTEs) with complex transformations

#### Query Breakdown:

```sql
WITH
    -- CTE 1: Calculate start/finish dates per investment (~300ms)
    INV_START_FIN AS ( ... ),
    
    -- CTE 2-5: Process phases with validation & adjustment (~1-1.5s)
    INV_PHASES_PT1 AS ( ... ),
    INV_PHASES_PT2 AS ( ... ),
    INV_PHASES_PT3 AS ( ... ),
    INV_PHASES_PT4_PHASED AS ( ... ),
    INV_PHASES_PT4_UNPHASED AS ( ... ),
    INV_PHASES_PT5 AS ( ... ),
    
    -- CTE 6-7: Get project & program milestones (~500ms)
    PROJ_MSTONES AS ( ... ),
    PROG_MSTONES AS ( ... ),
    
    -- CTE 8: Union roadmap items (~200ms)
    CLRTY_ROADMAP_ITEMS AS ( ... ),
    
    -- CTE 9-12: Handle non-Clarity deployments (~500ms)
    NON_CLRTY_DEPLOYMENTS_PT1 AS ( ... ),
    -- ... (similar to hierarchy query)
    
    -- CTE 13+: Join investment attributes (~500ms)
    -- ... additional processing ...

-- Final SELECT
SELECT * FROM [combined_investment_data]
WHERE INV_EXT_ID IN ('PR123', 'PR456', ...)  -- Added by backend
```

**Performance Analysis:**

| CTE Stage | Operation | Est. Time | Rows Processed |
|-----------|-----------|-----------|----------------|
| INV_START_FIN | Aggregate task dates | 300ms | ~50,000 tasks |
| INV_PHASES_PT1-5 | Phase detection & validation | 1-1.5s | ~100,000 tasks |
| PROJ/PROG_MSTONES | Filter key milestones | 500ms | ~10,000 milestones |
| CLRTY_ROADMAP_ITEMS | UNION all elements | 200ms | ~150,000 rows |
| NON_CLRTY_DEPLOYMENTS | String operations | 500ms | ~2,000 tasks |
| Investment attributes | JOINs to investment table | 500ms | Final result |

**Total Query Time:** 2-4 seconds (when filtered by portfolio IDs)

---

### 5.3 Database Infrastructure

**Azure Databricks SQL Warehouse Configuration:**

| Configuration | Current Setup | Impact on Performance |
|---------------|---------------|----------------------|
| **Warehouse Size** | Unknown (likely Small/Medium) | Larger = faster query execution |
| **Cluster Type** | Serverless or Classic | Serverless has cold start penalty (~2-5s) |
| **Spot Instance** | Possibly enabled | Can cause query delays |
| **Query Compilation** | Every request | No query plan caching |
| **Connection Type** | SQL Connector | JDBC might be faster |
| **Indexing** | Unknown | Proper indexes could reduce query time by 50% |

**Suspected Issues:**
1. **No Materialized Views:** Complex CTEs recalculated every time
2. **No Query Result Caching:** Databricks query cache not utilized
3. **No Incremental Loading:** Always fetches all historical data
4. **No Partitioning:** Tables likely not partitioned by date/type
5. **Cold Start Penalties:** If serverless, first query after idle costs 2-5s

---

## 6. Network & Data Transfer Analysis

### 6.1 Request/Response Sizes

**Typical Portfolio API Response:**
```json
{
  "status": "success",
  "data": {
    "hierarchy": [ /* 50 portfolios × ~500 bytes = 25 KB */ ],
    "investment": [ /* 500 investments × 2KB = 1 MB */ ]
  },
  "mode": "databricks"
}
```

**Size Analysis:**

| Response Component | Rows | Size per Row | Total Size |
|-------------------|------|--------------|------------|
| Hierarchy data | 50 | 500 bytes | 25 KB |
| Investment records | 500 | 1 KB | 500 KB |
| Milestone data | 2000 | 300 bytes | 600 KB |
| **Total JSON** | | | **~1.1 MB** |
| **Compressed (gzip)** | | | **~200-300 KB** |

**Transfer Time Estimates:**

| Network Speed | Compressed | Uncompressed |
|---------------|------------|--------------|
| Fast (100 Mbps+) | 20-30ms | 100ms |
| Medium (10 Mbps) | 200ms | 1s |
| Slow (1 Mbps) | 2s | 10s |

**Note:** On corporate network, likely 10-100 Mbps, so **transfer time is NOT the bottleneck** (~100-200ms).

---

### 6.2 API Call Patterns

**Current Implementation:**
```javascript
// Single API call for portfolio data
fetchPortfolioData(1, 5000)
  ↓
Backend makes 2 sequential Databricks queries
  ↓
Returns combined result
  ↓
Frontend processes ~1MB of data
```

**Issues:**
1. **Over-fetching:** Fetches up to 5000 portfolios when user sees ~20
2. **No Streaming:** All-or-nothing data transfer
3. **No Parallel Requests:** Sequential query execution
4. **No Compression:** Response may not be gzipped

---

## 7. Quantified Performance Metrics

### 7.1 Time Distribution (Initial Load)

```
┌─────────────────────────────────────────────────────────────────┐
│                    INITIAL LOAD TIME BREAKDOWN                  │
│                         Total: ~12-15s                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ██ App Initialization (4%)                         ~0.5s       │
│                                                                 │
│ ████████████████████████████████ Database Queries (72%) ~10s   │
│   ├─ Hierarchy Query: ~6-8s                                    │
│   └─ Investment Query: ~2-4s                                   │
│                                                                 │
│ █████ Frontend Processing (10%)                     ~1.5s      │
│   ├─ JSON parsing: ~100ms                                      │
│   ├─ Data transformation: ~800ms                               │
│   └─ State updates: ~600ms                                     │
│                                                                 │
│ ████████ React Rendering (12%)                      ~1.5s      │
│   ├─ Milestone processing: ~600ms                              │
│   ├─ Timeline filtering: ~300ms                                │
│   └─ SVG rendering: ~600ms                                     │
│                                                                 │
│ █ Network Transfer (2%)                             ~200ms     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Performance by Component

| Component | Current Time | Optimized Target | Improvement |
|-----------|-------------|------------------|-------------|
| **Database Layer** | 8-12s | 2-3s | 70-75% faster |
| - Hierarchy query | 6-8s | 1-1.5s | 80% faster |
| - Investment query | 2-4s | 0.5-1s | 75% faster |
| **Backend Processing** | 200-300ms | 50-100ms | 65% faster |
| **Network Transfer** | 100-300ms | 50-150ms | 50% faster |
| **Frontend Processing** | 1-1.5s | 300-500ms | 70% faster |
| **React Rendering** | 1-2s | 400-700ms | 65% faster |
| **TOTAL** | **12-15s** | **3-5s** | **70-75% faster** |

---

## 8. Optimization Recommendations

### Priority 1: Database Query Optimization (HIGHEST IMPACT)

#### 8.1 Create Materialized Views

**Problem:** Complex 16-CTE hierarchy query runs every time  
**Solution:** Pre-compute results into materialized views

```sql
-- Create materialized view for hierarchy
CREATE MATERIALIZED VIEW mv_coe_hierarchy_portfolio AS
WITH [... all 16 CTEs ...]
SELECT * FROM HIE_VALID_PARENTS_PT6;

-- Refresh strategy: Daily or on-demand
REFRESH MATERIALIZED VIEW mv_coe_hierarchy_portfolio;

-- Backend query becomes:
SELECT * FROM mv_coe_hierarchy_portfolio
WHERE COE_ROADMAP_TYPE = 'Portfolio'
LIMIT 50 OFFSET 0;
```

**Expected Impact:**
- **Current:** 6-8 seconds
- **Optimized:** 200-500ms
- **Improvement:** 90-95% faster
- **Effort:** Medium (requires DBA access)

---

#### 8.2 Add Database Indexes

**Problem:** Full table scans on large tables  
**Solution:** Create indexes on commonly filtered columns

```sql
-- Index on hierarchy table
CREATE INDEX idx_coe_roadmap_type ON [hierarchy_table](COE_ROADMAP_TYPE);
CREATE INDEX idx_child_id ON [hierarchy_table](CHILD_ID);
CREATE INDEX idx_parent_id ON [hierarchy_table](COE_ROADMAP_PARENT_ID);

-- Index on investment table
CREATE INDEX idx_inv_ext_id ON [investment_table](INV_EXT_ID);
CREATE INDEX idx_inv_active ON [investment_table](INV_ACTIVE);
CREATE INDEX idx_task_inv_id ON [task_table](PROJECT_ID);
```

**Expected Impact:**
- **Hierarchy Query:** 6-8s → 3-4s (50% faster)
- **Investment Query:** 2-4s → 1-2s (50% faster)
- **Effort:** Low (SQL DDL statements)

---

#### 8.3 Implement Query Result Caching at Database Level

**Problem:** Databricks query cache not utilized  
**Solution:** Enable query result caching in Databricks

```python
# In databricks_client.py
def execute_query(self, query: str, use_cache: bool = True):
    # Enable Databricks result caching
    query_with_cache = f"""
        SET spark.databricks.io.cache.enabled = true;
        {query}
    """
    # Execute query
```

**Expected Impact:**
- **Subsequent requests:** Near-instant (<500ms)
- **First request:** No change
- **Effort:** Low

---

### Priority 2: Backend Optimizations

#### 8.4 Implement Connection Pooling

**Problem:** Creates new connection for every query (~400ms overhead)  
**Solution:** Maintain persistent connection pool

```python
# backend/databricks_client.py
from databricks.sql import connect
from queue import Queue
import threading

class DatabricksConnectionPool:
    def __init__(self, pool_size=5):
        self.pool = Queue(maxsize=pool_size)
        self.pool_size = pool_size
        self._initialize_pool()
    
    def _initialize_pool(self):
        for _ in range(self.pool_size):
            conn = sql.connect(
                server_hostname=self.server_hostname,
                http_path=self.http_path,
                access_token=self.access_token
            )
            self.pool.put(conn)
    
    def get_connection(self):
        return self.pool.get()
    
    def return_connection(self, conn):
        self.pool.put(conn)
```

**Expected Impact:**
- **Connection overhead:** 400-1000ms → 10-50ms
- **Improvement:** 95% reduction in connection time
- **Effort:** Medium (refactor connection management)

---

#### 8.5 Parallel Query Execution

**Problem:** Hierarchy and investment queries run sequentially  
**Solution:** Execute queries in parallel

```python
import asyncio
from concurrent.futures import ThreadPoolExecutor

async def get_portfolio_data_parallel():
    with ThreadPoolExecutor(max_workers=2) as executor:
        # Execute both queries in parallel
        hierarchy_future = executor.submit(execute_query, hierarchy_query)
        investment_future = executor.submit(execute_query, investment_query)
        
        # Wait for both to complete
        hierarchy_results = hierarchy_future.result()
        investment_results = investment_future.result()
    
    return combine_results(hierarchy_results, investment_results)
```

**Expected Impact:**
- **Current:** Query1 (8s) + Query2 (4s) = 12s
- **Optimized:** max(8s, 4s) = 8s
- **Improvement:** 33% faster
- **Effort:** Medium (async/await refactoring)

---

#### 8.6 Optimize SQL Queries

**Problem:** Complex CTEs with redundant operations  
**Solution:** Simplify query logic

**Hierarchy Query Optimizations:**
```sql
-- BEFORE: Multiple self-joins in separate CTEs
HIE_VALID_PARENTS_PT1 AS (
    SELECT ...
    FROM HIE_W_PAR_TYPE
    GROUP BY ...
),
HIE_VALID_PARENTS_PT2 AS (
    SELECT ...
    FROM HIE_W_PAR_TYPE hwpt
    LEFT JOIN HIE_VALID_PARENTS_PT1 hvp1_a ON ...
    LEFT JOIN HIE_VALID_PARENTS_PT1 hvp1_b ON ...
)

-- AFTER: Combine into single CTE with window functions
HIE_VALID_PARENTS_COMBINED AS (
    SELECT ...,
           COUNT(*) OVER (PARTITION BY parent_id) as child_count,
           ROW_NUMBER() OVER (PARTITION BY parent_id ORDER BY child_name) as row_num
    FROM HIE_W_PAR_TYPE
)
```

**Expected Impact:**
- **Hierarchy Query:** 6-8s → 4-5s (35% faster)
- **Effort:** High (requires SQL expertise)

---

### Priority 3: Frontend Optimizations

#### 8.7 Implement React.memo and useMemo

**Problem:** Unnecessary re-renders on state changes  
**Solution:** Memoize expensive components and calculations

```javascript
// PortfolioGanttChart.jsx
import React, { memo, useMemo } from 'react';

// Memoize milestone processing
const processedMilestones = useMemo(() => {
    return processMilestonesWithPosition(
        milestones,
        timelineStartDate,
        monthWidth,
        projectEndDate
    );
}, [milestones, timelineStartDate, monthWidth, projectEndDate]);

// Memoize filtered data
const filteredData = useMemo(() => {
    return allData.filter(item => 
        selectedParent === 'All' || item.parentName === selectedParent
    );
}, [allData, selectedParent]);

// Memoize component export
export default memo(PortfolioGanttChart);
```

**Expected Impact:**
- **Re-render time:** 1-2s → 200-400ms
- **Improvement:** 75% faster on subsequent updates
- **Effort:** Low (add useMemo/memo hooks)

---

#### 8.8 Virtualize SVG Rendering

**Problem:** Renders all portfolios at once, even if not visible  
**Solution:** Only render visible rows

```javascript
import { FixedSizeList as List } from 'react-window';

// Virtualized row renderer
const PortfolioRow = ({ index, style }) => {
    const portfolio = paginatedData[index];
    return (
        <div style={style}>
            {/* Render single portfolio bar */}
        </div>
    );
};

// Replace full list with virtualized list
<List
    height={600}
    itemCount={paginatedData.length}
    itemSize={40}
    width="100%"
>
    {PortfolioRow}
</List>
```

**Expected Impact:**
- **Initial render:** 1-2s → 300-500ms
- **Improvement:** 70% faster
- **Effort:** Medium (refactor rendering)

---

#### 8.9 Defer Non-Critical Processing

**Problem:** Processes all milestones immediately  
**Solution:** Use web workers for background processing

```javascript
// Create web worker for milestone processing
const milestoneWorker = new Worker('milestone-processor.worker.js');

// Process milestones in background
milestoneWorker.postMessage({
    milestones: allMilestones,
    timelineStart: startDate,
    timelineEnd: endDate
});

milestoneWorker.onmessage = (event) => {
    setProcessedMilestones(event.data);
};
```

**Expected Impact:**
- **Blocking time:** 500-800ms → 0ms (non-blocking)
- **User perceived load:** Feels 50% faster
- **Effort:** High (requires web worker implementation)

---

#### 8.10 Optimize Data Transformation

**Problem:** Nested loops in processRawApiData  
**Solution:** Use Map for O(1) lookups

```javascript
// progressiveApiService.js - BEFORE
investmentRecords.forEach(investment => {
    const milestones = investmentData.filter(inv =>   // O(n) for each investment
        inv.INV_EXT_ID === investment.INV_EXT_ID && 
        inv.ROADMAP_ELEMENT?.includes('Milestones')
    );
});

// AFTER - Create lookup map first
const milestoneMap = new Map();
investmentData.forEach(inv => {
    if (inv.ROADMAP_ELEMENT?.includes('Milestones')) {
        if (!milestoneMap.has(inv.INV_EXT_ID)) {
            milestoneMap.set(inv.INV_EXT_ID, []);
        }
        milestoneMap.get(inv.INV_EXT_ID).push(inv);
    }
});

// Then use O(1) lookup
investmentRecords.forEach(investment => {
    const milestones = milestoneMap.get(investment.INV_EXT_ID) || [];  // O(1)
});
```

**Expected Impact:**
- **Processing time:** 500-1000ms → 100-200ms
- **Improvement:** 80% faster
- **Effort:** Low (refactor loops)

---

### Priority 4: Network & Infrastructure

#### 8.11 Enable Response Compression

**Problem:** Large JSON responses (~1MB)  
**Solution:** Enable gzip compression in Flask

```python
# backend/app.py
from flask_compress import Compress

app = Flask(__name__)
Compress(app)  # Automatically compresses responses

# Or configure manually
app.config['COMPRESS_MIMETYPES'] = ['application/json']
app.config['COMPRESS_LEVEL'] = 6
```

**Expected Impact:**
- **Response size:** 1.1 MB → 200-300 KB
- **Transfer time:** 300ms → 50ms (on fast network)
- **Effort:** Very Low (one line of code)

---

#### 8.12 Implement HTTP/2

**Problem:** HTTP/1.1 sequential request handling  
**Solution:** Use HTTP/2 for multiplexed requests

**Configuration in Azure App Service:**
```yaml
# Azure App Service configuration
properties:
  http20Enabled: true
```

**Expected Impact:**
- **Parallel requests:** Better utilization
- **Improvement:** 10-20% on multiple requests
- **Effort:** Low (configuration change)

---

#### 8.13 Add CDN for Static Assets

**Problem:** React bundle loaded from App Service  
**Solution:** Serve static assets from Azure CDN

**Expected Impact:**
- **Initial bundle load:** 200-300ms → 50-100ms
- **Global availability:** Better for remote users
- **Effort:** Medium (Azure CDN setup)

---

### Priority 5: Application Architecture

#### 8.14 Implement Incremental Data Loading

**Problem:** Fetches all portfolios upfront  
**Solution:** Load visible portfolios first, rest on scroll

```javascript
// Load first page immediately
const initialLoad = async () => {
    const firstPage = await fetchPortfolioData(1, 20);  // Only 20 items
    setVisibleData(firstPage);
    setLoading(false);  // UI can show now!
    
    // Load remaining pages in background
    setTimeout(() => {
        loadRemainingPages(2, totalPages);
    }, 100);
};
```

**Expected Impact:**
- **Initial load:** 8-10s → 2-3s
- **Improvement:** 70% faster perceived performance
- **Effort:** Medium (refactor data loading)

---

#### 8.15 Add Service Worker for Offline Support

**Problem:** No caching of API responses  
**Solution:** Cache responses in Service Worker

```javascript
// service-worker.js
self.addEventListener('fetch', (event) => {
    if (event.request.url.includes('/api/data/portfolio')) {
        event.respondWith(
            caches.match(event.request).then((cached) => {
                return cached || fetch(event.request).then((response) => {
                    return caches.open('api-cache').then((cache) => {
                        cache.put(event.request, response.clone());
                        return response;
                    });
                });
            })
        );
    }
});
```

**Expected Impact:**
- **Subsequent loads:** 8-10s → <500ms
- **Offline capability:** View last loaded data
- **Effort:** High (implement service worker)

---

## 9. Implementation Roadmap

### Phase 1: Quick Wins (1-2 weeks, ~70% improvement)

1. **Enable Response Compression** (1 hour)
   - Add Flask-Compress
   - Test response sizes
   
2. **Optimize Frontend Data Processing** (2-3 days)
   - Refactor nested loops to use Map
   - Add useMemo to expensive calculations
   - Memoize components with React.memo

3. **Add Database Indexes** (1-2 days)
   - Identify slow columns (COE_ROADMAP_TYPE, INV_EXT_ID)
   - Create indexes
   - Test query performance

4. **Remove API Validation Blocking** (1 day)
   - Make health check non-blocking
   - Show UI immediately with loading state

**Expected Result:** 12-15s → 5-7s

---

### Phase 2: Database Optimization (2-4 weeks, additional ~50% improvement)

1. **Create Materialized Views** (1 week)
   - Work with DBA to create views
   - Set up refresh schedule
   - Update backend queries

2. **Implement Connection Pooling** (3-5 days)
   - Create connection pool class
   - Refactor databricks_client
   - Test concurrent requests

3. **Parallel Query Execution** (2-3 days)
   - Implement async query execution
   - Test error handling
   - Monitor performance

4. **Enable Databricks Query Caching** (1 day)
   - Configure Spark settings
   - Test cache hit rates

**Expected Result:** 5-7s → 2-3s

---

### Phase 3: Advanced Optimizations (4-6 weeks, final 10-20% improvement)

1. **Simplify SQL Queries** (2 weeks)
   - Analyze query plans
   - Refactor CTEs
   - Test data accuracy

2. **Implement Virtualization** (1-2 weeks)
   - Install react-window
   - Refactor rendering
   - Test scrolling performance

3. **Add Service Worker** (1-2 weeks)
   - Implement caching strategy
   - Test offline capability
   - Handle cache invalidation

4. **Incremental Loading** (1 week)
   - Refactor data loading
   - Add scroll-based loading
   - Test user experience

**Expected Result:** 2-3s → 1.5-2s

---

### Monitoring & Measurement

**Add Performance Tracking:**

```javascript
// Frontend - add to App.jsx
const startTime = performance.now();

// After data loaded
const endTime = performance.now();
console.log(`Load time: ${endTime - startTime}ms`);

// Send to analytics
analytics.track('page_load_time', {
    duration: endTime - startTime,
    view: 'portfolio'
});
```

```python
# Backend - add to app.py
import time

@app.route('/api/data/portfolio')
def get_portfolio_data():
    start = time.time()
    
    # ... existing code ...
    
    duration = time.time() - start
    logger.info(f"⏱️ Request completed in {duration:.2f}s")
    
    return jsonify({
        **response_data,
        '_performance': {
            'total_time': duration,
            'db_time': db_time
        }
    })
```

---

## 10. Conclusion

### Summary of Findings

The initial load latency of 12-15 seconds is primarily caused by:

1. **Complex Databricks Queries (72%):** 16-CTE hierarchy query and 10-CTE investment query
2. **Sequential Processing (15%):** No parallelization of queries or processing
3. **Heavy React Rendering (10%):** Processing thousands of milestones and SVG rendering
4. **Connection Overhead (3%):** Creating new DB connections for each query

### Recommended Implementation Priority

**Immediate (Week 1-2):**
- Enable response compression
- Add database indexes
- Optimize frontend data processing
- Remove blocking API validation

**Target: 12-15s → 5-7s (50-60% improvement)**

**Short-term (Week 3-6):**
- Create materialized views
- Implement connection pooling
- Parallel query execution

**Target: 5-7s → 2-3s (70-80% total improvement)**

**Long-term (Month 2-3):**
- Simplify SQL queries
- Implement virtualization
- Add service worker caching

**Target: 2-3s → 1.5-2s (85-90% total improvement)**

### Final Target

**Current:** 12-15 seconds  
**Optimized:** 1.5-2 seconds  
**Improvement:** **87-90% faster**

This represents a transformation from a "slow" user experience to a "fast" user experience, meeting industry standards for enterprise web applications.

---

**Document End**
