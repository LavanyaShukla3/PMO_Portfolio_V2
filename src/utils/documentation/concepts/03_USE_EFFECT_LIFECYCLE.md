# Step 3: useEffect - Side Effects & Component Lifecycle

## 🎯 Learning Objectives
By the end of this step, you will:
- Understand what "side effects" means in React
- Master the useEffect Hook and dependency arrays
- Handle component lifecycle (mount, update, unmount)
- Write cleanup functions to prevent memory leaks
- Fetch data from APIs properly

---

## 💡 The Eureka Moment: Effects Run AFTER Render

### Traditional Imperative Code
```javascript
// Code runs top-to-bottom, sequentially
const data = fetchData();        // Step 1: Get data
const processed = process(data); // Step 2: Process it
renderUI(processed);             // Step 3: Show it
```

### React's Declarative Approach
```jsx
const Component = () => {
    const [data, setData] = useState(null);
    
    // 1. Component renders with initial state
    // 2. DOM updates
    // 3. THEN effect runs
    useEffect(() => {
        fetchData().then(result => setData(result));
    }, []);
    
    // This JSX runs BEFORE the effect!
    return <div>{data || 'Loading...'}</div>;
};
```

**🎉 EUREKA!**
- Regular code: Runs during render (synchronous)
- useEffect: Runs AFTER render (asynchronous)
- Effects don't block rendering - UI stays responsive!

---

## 📖 What Are Side Effects?

### Pure vs Impure Functions

```javascript
// ✅ PURE - Same input always gives same output, no side effects
function add(a, b) {
    return a + b;
}

// ❌ IMPURE - Has side effects (modifies external state)
let total = 0;
function addToTotal(value) {
    total += value;  // Side effect: modifies external variable
    return total;
}

function saveToDatabase(data) {
    database.save(data);  // Side effect: external interaction
}
```

### Side Effects in React Components

**Side effects include**:
- 🌐 Fetching data from APIs
- 📝 Updating the DOM directly (document.getElementById)
- ⏰ Timers (setTimeout, setInterval)
- 🔔 Subscriptions (WebSocket, event listeners)
- 💾 Local storage access
- 📊 Logging/analytics
- 🔄 Any interaction with the outside world

**Example**:
```jsx
// ❌ DON'T do side effects during render
const Component = () => {
    // This runs during render - BAD!
    fetch('/api/data');  // Runs on every render!
    document.title = 'New Title';  // Direct DOM manipulation during render
    
    return <div>Content</div>;
};

// ✅ DO side effects in useEffect
const Component = () => {
    useEffect(() => {
        // This runs AFTER render - GOOD!
        fetch('/api/data');
        document.title = 'New Title';
    }, []);
    
    return <div>Content</div>;
};
```

---

## 🎣 useEffect Hook Syntax

### Basic Structure

```jsx
useEffect(() => {
    // Effect code runs after render
    
    return () => {
        // Cleanup code (optional)
        // Runs before next effect and on unmount
    };
}, [dependencies]);  // When to re-run the effect
```

### Three Parts of useEffect

1. **Effect Function**: Code to run after render
2. **Cleanup Function** (optional): Code to run before next effect or unmount
3. **Dependency Array**: Controls when effect re-runs

---

## 🔍 useEffect in YOUR Project

### Example 1: Run Once on Mount
**File**: `src/App.jsx` (lines 48-69)

```jsx
// Validate data when app loads (once)
useEffect(() => {
    const validateData = async () => {
        try {
            const validation = await validateApiData();
            setDataValidation({ ...validation, isLoading: false });
        } catch (error) {
            setDataValidation({
                isValid: false,
                errors: [`Failed to validate data: ${error.message}`],
                mode: 'unknown',
                isLoading: false
            });
        }
    };

    validateData();
    
    // Empty dependency array = run ONCE on mount
}, []);
```

**When does this run?**
- ✅ Once when component first mounts
- ❌ Never again (unless component unmounts and remounts)

### Example 2: Run When State Changes
**File**: Your `PortfolioGanttChart.jsx` could have this pattern

```jsx
const [selectedPortfolio, setSelectedPortfolio] = useState(null);
const [portfolioDetails, setPortfolioDetails] = useState(null);

// Fetch details when selected portfolio changes
useEffect(() => {
    if (selectedPortfolio) {
        fetchPortfolioDetails(selectedPortfolio)
            .then(data => setPortfolioDetails(data));
    }
}, [selectedPortfolio]);  // Re-run when selectedPortfolio changes
```

**When does this run?**
- ✅ On mount
- ✅ Every time `selectedPortfolio` changes
- ❌ Not when other state changes

### Example 3: Window Event Listeners with Cleanup

```jsx
const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight
});

useEffect(() => {
    // Setup: Add event listener
    const handleResize = () => {
        setWindowSize({
            width: window.innerWidth,
            height: window.innerHeight
        });
    };
    
    window.addEventListener('resize', handleResize);
    
    // Cleanup: Remove event listener
    return () => {
        window.removeEventListener('resize', handleResize);
    };
}, []); // Run once on mount
```

**Why cleanup?**
- Without cleanup, event listener stays in memory after component unmounts
- Multiple mounts/unmounts = multiple listeners (memory leak!)
- Cleanup runs before next effect AND on unmount

---

## 📅 Dependency Array Deep Dive

The dependency array is the MOST IMPORTANT part of useEffect!

### No Dependency Array - Runs Every Render

```jsx
useEffect(() => {
    console.log('Runs after EVERY render');
});
// No dependency array = runs on every render (rarely useful)
```

**Use case**: Almost never! Usually a mistake.

### Empty Dependency Array - Run Once

```jsx
useEffect(() => {
    console.log('Runs ONCE on mount');
}, []);
// Empty array [] = run once when component mounts
```

**Use cases**:
- Initial data fetching
- Setting up subscriptions
- Analytics (page view tracking)
- Initializing third-party libraries

### With Dependencies - Run When Dependencies Change

```jsx
useEffect(() => {
    console.log('Runs when count changes');
}, [count]);
// Run when 'count' changes
```

**Use cases**:
- Fetch data when ID/filter changes
- Sync with external systems
- Update document title
- Debounced search

### Multiple Dependencies

```jsx
useEffect(() => {
    console.log('Runs when ANY of these change');
}, [count, name, isActive]);
// Run when count OR name OR isActive changes
```

---

## 🎯 Common useEffect Patterns

### Pattern 1: Data Fetching

```jsx
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

useEffect(() => {
    // Reset states
    setLoading(true);
    setError(null);
    
    // Fetch data
    fetch('/api/data')
        .then(response => response.json())
        .then(data => {
            setData(data);
            setLoading(false);
        })
        .catch(error => {
            setError(error.message);
            setLoading(false);
        });
}, []);

// Render based on states
if (loading) return <div>Loading...</div>;
if (error) return <div>Error: {error}</div>;
return <div>{JSON.stringify(data)}</div>;
```

### Pattern 2: Data Fetching with Cancel Token (Proper Way)

```jsx
useEffect(() => {
    let cancelled = false;  // Track if component unmounted
    
    const fetchData = async () => {
        try {
            const response = await fetch('/api/data');
            const data = await response.json();
            
            // Only update state if component still mounted
            if (!cancelled) {
                setData(data);
            }
        } catch (error) {
            if (!cancelled) {
                setError(error.message);
            }
        }
    };
    
    fetchData();
    
    // Cleanup: Mark as cancelled
    return () => {
        cancelled = true;
    };
}, []);
```

**Why?** Prevents "can't perform state update on unmounted component" warning.

### Pattern 3: Debounced Search

```jsx
const [searchTerm, setSearchTerm] = useState('');
const [results, setResults] = useState([]);

useEffect(() => {
    // Don't search if empty
    if (!searchTerm) {
        setResults([]);
        return;
    }
    
    // Debounce: Wait 500ms after user stops typing
    const timeoutId = setTimeout(() => {
        fetch(`/api/search?q=${searchTerm}`)
            .then(res => res.json())
            .then(data => setResults(data));
    }, 500);
    
    // Cleanup: Cancel previous timeout
    return () => clearTimeout(timeoutId);
}, [searchTerm]);
```

**Result**: Only searches 500ms after user stops typing (saves API calls!)

### Pattern 4: Synchronizing with Props

```jsx
const MyComponent = ({ userId }) => {
    const [user, setUser] = useState(null);
    
    // Fetch new user data when userId prop changes
    useEffect(() => {
        fetchUser(userId)
            .then(data => setUser(data));
    }, [userId]);  // Dependency on prop
    
    return <div>{user?.name}</div>;
};
```

### Pattern 5: Timers

```jsx
const [seconds, setSeconds] = useState(0);

useEffect(() => {
    // Start interval
    const intervalId = setInterval(() => {
        setSeconds(s => s + 1);  // Functional update!
    }, 1000);
    
    // Cleanup: Clear interval
    return () => clearInterval(intervalId);
}, []);  // Empty array = timer runs once
```

---

## 🧪 Real-World Example from YOUR Project

### Global Data Loading
**File**: `src/contexts/GlobalDataCacheContext.jsx`

```jsx
// Load all data in parallel on mount
useEffect(() => {
    const loadAllData = async () => {
        dispatch({ type: ACTIONS.START_LOADING });
        
        try {
            // Parallel loading using Promise.all
            const [portfolio, program, subProgram, region] = await Promise.all([
                fetchPortfolioData(),
                fetchProgramData(),
                fetchSubProgramData(),
                fetchRegionData()
            ]);
            
            // Update state with all data
            dispatch({ type: ACTIONS.SET_PORTFOLIO_DATA, payload: portfolio });
            dispatch({ type: ACTIONS.SET_PROGRAM_DATA, payload: program });
            dispatch({ type: ACTIONS.SET_SUBPROGRAM_DATA, payload: subProgram });
            dispatch({ type: ACTIONS.SET_REGION_DATA, payload: region });
            
        } catch (error) {
            dispatch({ type: ACTIONS.SET_ERROR, payload: error.message });
        }
    };
    
    loadAllData();
}, []); // Run once on app startup
```

**Benefits**:
- Loads all data on mount
- Parallel loading (faster than sequential)
- Cached for instant view switching
- Only loads once (empty dependency array)

---

## ⚠️ Common Pitfalls & How to Fix Them

### Pitfall 1: Infinite Loop

```jsx
// ❌ INFINITE LOOP
const [count, setCount] = useState(0);

useEffect(() => {
    setCount(count + 1);  // State update...
}, [count]);  // ...triggers effect...which updates state...
// INFINITE LOOP!
```

**Fix**: Remove dependency if you want it to run once, or change logic:
```jsx
// ✅ Run once
useEffect(() => {
    setCount(1);
}, []);

// ✅ Or only update on certain condition
useEffect(() => {
    if (count < 10) {
        setCount(count + 1);
    }
}, [count]);
```

### Pitfall 2: Missing Dependencies

```jsx
// ❌ Missing dependency (ESLint will warn)
const [userId, setUserId] = useState(1);
const [userData, setUserData] = useState(null);

useEffect(() => {
    fetchUser(userId).then(data => setUserData(data));
}, []);  // userId is used but not in dependencies!
```

**What happens**: Effect only runs once with initial userId value. Changes to userId are ignored!

**Fix**: Include all dependencies:
```jsx
// ✅ Include userId in dependencies
useEffect(() => {
    fetchUser(userId).then(data => setUserData(data));
}, [userId]);  // Now re-fetches when userId changes
```

### Pitfall 3: Stale Closure

```jsx
// ❌ Stale closure
const [count, setCount] = useState(0);

useEffect(() => {
    const intervalId = setInterval(() => {
        console.log(count);  // Always logs 0!
        setCount(count + 1);  // Always sets to 1!
    }, 1000);
    
    return () => clearInterval(intervalId);
}, []); // Empty deps = 'count' is captured at first render
```

**Fix**: Use functional update:
```jsx
// ✅ Functional update
useEffect(() => {
    const intervalId = setInterval(() => {
        setCount(c => {
            console.log(c);  // Logs current count
            return c + 1;    // Always increments correctly
        });
    }, 1000);
    
    return () => clearInterval(intervalId);
}, []);
```

### Pitfall 4: Forgetting Cleanup

```jsx
// ❌ Memory leak - no cleanup
useEffect(() => {
    window.addEventListener('resize', handleResize);
}, []);
// Event listener persists after unmount!

// ✅ Proper cleanup
useEffect(() => {
    window.addEventListener('resize', handleResize);
    
    return () => {
        window.removeEventListener('resize', handleResize);
    };
}, []);
```

### Pitfall 5: Async Function in useEffect

```jsx
// ❌ WRONG - Can't make effect function async
useEffect(async () => {
    const data = await fetchData();  // Syntax error!
}, []);

// ✅ CORRECT - Define async function inside
useEffect(() => {
    const loadData = async () => {
        const data = await fetchData();
        setData(data);
    };
    
    loadData();
}, []);

// ✅ ALTERNATIVE - Use .then()
useEffect(() => {
    fetchData()
        .then(data => setData(data))
        .catch(error => setError(error));
}, []);
```

---

## 🧪 Hands-On Exercises

### Exercise 1: Timer Component

```jsx
const Timer = () => {
    const [seconds, setSeconds] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
    
    useEffect(() => {
        if (!isRunning) return;
        
        const intervalId = setInterval(() => {
            setSeconds(s => s + 1);
        }, 1000);
        
        return () => clearInterval(intervalId);
    }, [isRunning]);
    
    return (
        <div>
            <h1>{seconds}s</h1>
            <button onClick={() => setIsRunning(!isRunning)}>
                {isRunning ? 'Pause' : 'Start'}
            </button>
            <button onClick={() => setSeconds(0)}>Reset</button>
        </div>
    );
};
```

**Challenge**: Add lap times functionality!

### Exercise 2: Live Search

```jsx
const LiveSearch = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    
    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            return;
        }
        
        setLoading(true);
        
        const timeoutId = setTimeout(() => {
            // Simulated API call
            fetch(`/api/search?q=${query}`)
                .then(res => res.json())
                .then(data => {
                    setResults(data);
                    setLoading(false);
                });
        }, 500);  // Debounce
        
        return () => clearTimeout(timeoutId);
    }, [query]);
    
    return (
        <div>
            <input 
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search..."
            />
            {loading && <p>Searching...</p>}
            <ul>
                {results.map(item => (
                    <li key={item.id}>{item.name}</li>
                ))}
            </ul>
        </div>
    );
};
```

### Exercise 3: Document Title Sync

```jsx
const PageWithTitle = () => {
    const [count, setCount] = useState(0);
    
    // Update document title when count changes
    useEffect(() => {
        document.title = `Count: ${count}`;
        
        // Cleanup: Reset title on unmount
        return () => {
            document.title = 'PMO Portfolio';
        };
    }, [count]);
    
    return (
        <div>
            <h1>{count}</h1>
            <button onClick={() => setCount(count + 1)}>+</button>
        </div>
    );
};
```

### Exercise 4: Fetch User Data

```jsx
const UserProfile = ({ userId }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    useEffect(() => {
        let cancelled = false;
        
        setLoading(true);
        setError(null);
        
        fetch(`/api/users/${userId}`)
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch');
                return res.json();
            })
            .then(data => {
                if (!cancelled) {
                    setUser(data);
                    setLoading(false);
                }
            })
            .catch(err => {
                if (!cancelled) {
                    setError(err.message);
                    setLoading(false);
                }
            });
        
        return () => {
            cancelled = true;
        };
    }, [userId]);  // Re-fetch when userId changes
    
    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;
    if (!user) return <div>No user found</div>;
    
    return (
        <div>
            <h2>{user.name}</h2>
            <p>{user.email}</p>
        </div>
    );
};
```

---

## 🎓 Key Takeaways

### useEffect Fundamentals
- ✅ Effects run AFTER render, not during
- ✅ Use for side effects (API calls, subscriptions, DOM updates)
- ✅ Always include cleanup for subscriptions/listeners
- ✅ Dependency array controls when effect re-runs

### Dependency Array Rules
- ✅ No array = runs every render (rare)
- ✅ Empty array `[]` = runs once on mount
- ✅ With values `[a, b]` = runs when a or b changes
- ✅ Include ALL values used in effect (ESLint will help)

### Common Patterns
- ✅ Data fetching with loading/error states
- ✅ Event listeners with cleanup
- ✅ Timers with cleanup
- ✅ Debounced operations
- ✅ Syncing with props/state

### Cleanup
- ✅ Return function from effect for cleanup
- ✅ Cleanup runs before next effect
- ✅ Cleanup runs on unmount
- ✅ Always cleanup subscriptions, listeners, timers

---

## 🚀 Next Steps

Now that you master effects, you're ready for:
- **Step 4**: Performance Optimization - useMemo, useCallback
- **Step 5**: Context API - Global state management

---

## 📝 Self-Check Questions

1. When does a useEffect run?
2. What's the difference between `useEffect(() => {}, [])` and `useEffect(() => {})`?
3. Why do we need cleanup functions?
4. What happens if you forget a dependency in the array?
5. Can you make the effect function `async`?
6. How do you cancel an API request in useEffect?

**Answers**:
1. After every render (can be controlled with dependencies)
2. `[]` runs once on mount; no array runs after every render
3. To prevent memory leaks and clean up resources
4. Effect uses stale values; won't re-run when that value changes
5. No, but you can define an async function inside and call it
6. Use a `cancelled` flag and check before updating state
