# Frontend Migration Guide: From Bulk Loading to Progressive Loading

## Overview
This guide explains how to update your React components to use the new progressive loading API endpoints instead of the old "fetch all data" approach.

## Key Changes

### Before (Old Approach - SLOW 🐌)
```javascript
// OLD: Fetches all 100,000+ records at once
import { fetchAllData } from './services/apiDataService.js';

const data = await fetchAllData(); // 4-7 minutes loading time
const portfolios = data.hierarchy.filter(item => item.COE_ROADMAP_TYPE === 'Portfolio');
```

### After (New Approach - FAST ⚡)
```javascript
// NEW: Fetches only 50 records at a time
import { fetchPortfolioData } from './services/progressiveApiService.js';

const result = await fetchPortfolioData({ page: 1, limit: 50 }); // <1 second loading time
const portfolios = result.data.hierarchy;
```

## Component Migration Examples

### 1. Portfolio Page (Main Dashboard)

**Before:**
```javascript
// OLD: PortfolioGanttChart.jsx
import { fetchAllData } from '../services/apiDataService.js';

function PortfolioGanttChart() {
    const [loading, setLoading] = useState(true);
    const [allData, setAllData] = useState(null);

    useEffect(() => {
        async function loadData() {
            setLoading(true);
            try {
                const data = await fetchAllData(); // SLOW - Gets everything
                setAllData(data);
            } catch (error) {
                console.error('Failed to load data:', error);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, []);

    const portfolios = allData?.hierarchy?.filter(item => 
        item.COE_ROADMAP_TYPE === 'Portfolio'
    ) || [];

    return (
        <div>
            {loading ? <LoadingSpinner /> : <GanttChart data={portfolios} />}
        </div>
    );
}
```

**After:**
```javascript
// NEW: PortfolioGanttChart.jsx
import { fetchPortfolioData } from '../services/progressiveApiService.js';

function PortfolioGanttChart() {
    const [loading, setLoading] = useState(true);
    const [portfolios, setPortfolios] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, hasMore: true });

    const loadMoreData = async (page = 1) => {
        setLoading(true);
        try {
            const result = await fetchPortfolioData({ 
                page, 
                limit: 50 
            }); // FAST - Gets only what's needed
            
            if (page === 1) {
                setPortfolios(result.data.hierarchy);
            } else {
                setPortfolios(prev => [...prev, ...result.data.hierarchy]);
            }
            
            setPagination({
                page: result.data.pagination.page,
                hasMore: result.data.pagination.has_more
            });
        } catch (error) {
            console.error('Failed to load portfolio data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadMoreData(1);
    }, []);

    const handleLoadMore = () => {
        if (pagination.hasMore && !loading) {
            loadMoreData(pagination.page + 1);
        }
    };

    return (
        <div>
            <GanttChart data={portfolios} />
            {pagination.hasMore && (
                <button onClick={handleLoadMore} disabled={loading}>
                    {loading ? 'Loading...' : 'Load More Portfolios'}
                </button>
            )}
        </div>
    );
}
```

### 2. Program Page (Drill-down from Portfolio)

**Before:**
```javascript
// OLD: ProgramGanttChart.jsx
function ProgramGanttChart({ portfolioId }) {
    const [allData, setAllData] = useState(null);

    useEffect(() => {
        async function loadData() {
            const data = await fetchAllData(); // Gets everything again!
            setAllData(data);
        }
        loadData();
    }, []);

    const programs = allData?.hierarchy?.filter(item => 
        item.COE_ROADMAP_PARENT_ID === portfolioId && 
        item.COE_ROADMAP_TYPE === 'Program'
    ) || [];

    return <GanttChart data={programs} />;
}
```

**After:**
```javascript
// NEW: ProgramGanttChart.jsx
import { fetchProgramData } from '../services/progressiveApiService.js';

function ProgramGanttChart({ portfolioId }) {
    const [programs, setPrograms] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadData() {
            if (!portfolioId) return;
            
            setLoading(true);
            try {
                const result = await fetchProgramData(portfolioId, { 
                    page: 1, 
                    limit: 50 
                }); // Only gets programs for this portfolio
                setPrograms(result.data.hierarchy);
            } catch (error) {
                console.error('Failed to load program data:', error);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [portfolioId]);

    if (loading) return <LoadingSpinner />;
    return <GanttChart data={programs} />;
}
```

### 3. Region Roadmap Page

**Before:**
```javascript
// OLD: RegionRoadMap.jsx
function RegionRoadMap({ region }) {
    const [allData, setAllData] = useState(null);

    useEffect(() => {
        async function loadData() {
            const data = await fetchAllData(); // Gets everything
            setAllData(data);
        }
        loadData();
    }, []);

    const regionData = allData?.hierarchy?.filter(item => 
        item.REGION === region
    ) || [];

    return <RoadmapChart data={regionData} />;
}
```

**After:**
```javascript
// NEW: RegionRoadMap.jsx
import { fetchRegionData } from '../services/progressiveApiService.js';

function RegionRoadMap({ region }) {
    const [regionData, setRegionData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadData() {
            if (!region) return;
            
            setLoading(true);
            try {
                const result = await fetchRegionData(region, { 
                    page: 1, 
                    limit: 100  // Regions might have more data
                });
                setRegionData(result.data.hierarchy);
            } catch (error) {
                console.error('Failed to load region data:', error);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [region]);

    if (loading) return <LoadingSpinner />;
    return <RoadmapChart data={regionData} />;
}
```

## Data Context Updates

### Before (DataContext.jsx)
```javascript
// OLD: Loads everything upfront
const DataContext = createContext();

export function DataProvider({ children }) {
    const [allData, setAllData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadInitialData() {
            const data = await fetchAllData(); // SLOW
            setAllData(data);
            setLoading(false);
        }
        loadInitialData();
    }, []);

    return (
        <DataContext.Provider value={{ allData, loading }}>
            {children}
        </DataContext.Provider>
    );
}
```

### After (DataContext.jsx)
```javascript
// NEW: Loads data on demand
import progressiveApi from '../services/progressiveApiService.js';

const DataContext = createContext();

export function DataProvider({ children }) {
    const [cache, setCache] = useState(new Map());
    const [loading, setLoading] = useState(false);

    const loadData = async (type, params = {}) => {
        const cacheKey = `${type}_${JSON.stringify(params)}`;
        
        if (cache.has(cacheKey)) {
            return cache.get(cacheKey); // Return cached data
        }

        setLoading(true);
        try {
            let result;
            switch (type) {
                case 'portfolio':
                    result = await progressiveApi.fetchPortfolioData(params);
                    break;
                case 'program':
                    result = await progressiveApi.fetchProgramData(params.portfolioId, params);
                    break;
                case 'subprogram':
                    result = await progressiveApi.fetchSubProgramData(params.programId, params);
                    break;
                case 'region':
                    result = await progressiveApi.fetchRegionData(params.region, params);
                    break;
                default:
                    throw new Error(`Unknown data type: ${type}`);
            }
            
            setCache(prev => new Map(prev).set(cacheKey, result));
            return result;
        } finally {
            setLoading(false);
        }
    };

    const clearCache = () => {
        setCache(new Map());
        progressiveApi.clearApiCache();
    };

    return (
        <DataContext.Provider value={{ loadData, loading, clearCache }}>
            {children}
        </DataContext.Provider>
    );
}
```

## Migration Checklist

### 1. Update API Service Imports
- [ ] Replace `import { fetchAllData }` with specific progressive methods
- [ ] Update component state management for pagination
- [ ] Add loading states for incremental data loading

### 2. Update Component Logic
- [ ] **PortfolioGanttChart.jsx**: Use `fetchPortfolioData()`
- [ ] **ProgramGanttChart.jsx**: Use `fetchProgramData(portfolioId)`  
- [ ] **SubProgramGanttChartFull.jsx**: Use `fetchSubProgramData(programId)`
- [ ] **RegionRoadMap.jsx**: Use `fetchRegionData(region)`
- [ ] **VirtualizedPortfolioGanttChart.jsx**: Implement virtual scrolling with pagination

### 3. Add Pagination Support
- [ ] Add "Load More" buttons or infinite scroll
- [ ] Implement proper loading states
- [ ] Handle pagination metadata (`page`, `limit`, `has_more`)

### 4. Update Data Context
- [ ] Implement progressive caching strategy
- [ ] Add cache invalidation logic
- [ ] Remove bulk data loading from context

### 5. Test Performance
- [ ] Verify initial page load is under 2 seconds
- [ ] Test navigation between Portfolio → Program → Subprogram
- [ ] Validate region filtering performance
- [ ] Confirm cache effectiveness

## Performance Benefits

| Metric | Before (Bulk Loading) | After (Progressive Loading) |
|--------|----------------------|----------------------------|
| Initial Load Time | 4-7 minutes | <2 seconds |
| Memory Usage | 500MB+ | <50MB |
| Network Transfer | 100MB+ | <1MB per request |
| Database Load | High (full table scans) | Low (indexed queries) |
| User Experience | Blocking, frustrating | Responsive, smooth |

## Troubleshooting

### Common Issues

1. **"portfolioId is required" error**
   - Ensure you're passing the correct ID when calling `fetchProgramData()`

2. **No data returned**
   - Check that your SQL queries have the correct column names for filtering
   - Verify parameterized queries are working correctly

3. **Infinite loading**
   - Check the `has_more` flag in pagination response
   - Ensure pagination logic doesn't create infinite loops

4. **Cache not working**
   - Verify cache keys are being generated correctly
   - Check cache TTL settings in backend

### Debugging Tips

```javascript
// Add debug logging
const result = await fetchPortfolioData({ page: 1, limit: 50 });
console.log('API Response:', result);
console.log('Data count:', result.data.hierarchy.length);
console.log('Pagination:', result.data.pagination);
console.log('Cache info:', result.cache_info);
```

## Next Steps

1. **Phase 1**: Update PortfolioGanttChart.jsx (highest impact)
2. **Phase 2**: Update ProgramGanttChart.jsx and RegionRoadMap.jsx 
3. **Phase 3**: Implement advanced features like infinite scroll
4. **Phase 4**: Add search and advanced filtering capabilities

The progressive loading approach will transform your application from a slow, monolithic experience into a fast, responsive, and scalable solution.
