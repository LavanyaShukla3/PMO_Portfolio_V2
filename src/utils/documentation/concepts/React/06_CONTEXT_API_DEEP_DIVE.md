# Context API Deep Dive - Complete Guide

> **Master global state management in React using Context API + useReducer, with real examples from your GlobalDataCacheContext.**

---

## 📖 The Problem Context API Solves

### The Prop Drilling Nightmare
```jsx
// ⚠️ Problem: Passing data through multiple levels

function App() {
  const [user, setUser] = useState({ name: 'John', role: 'admin' });
  return <Dashboard user={user} setUser={setUser} />;
}

function Dashboard({ user, setUser }) {
  return <Sidebar user={user} setUser={setUser} />; // Just passing through
}

function Sidebar({ user, setUser }) {
  return <Navigation user={user} setUser={setUser} />; // Still passing through
}

function Navigation({ user, setUser }) {
  return <UserProfile user={user} setUser={setUser} />; // Still passing through!
}

function UserProfile({ user, setUser }) {
  return <div>{user.name}</div>; // FINALLY used here
}
```

**Problems:**
1. **Verbose** - Pass props through every level
2. **Fragile** - Change user structure = update all components
3. **Couples components** - Intermediate components know about data they don't use
4. **Hard to refactor** - Moving components requires rewiring props

### 💡 Eureka Moment #1: Context Creates a "Wormhole"
Context lets you **teleport data** from Provider → Consumer, skipping intermediate components:

```jsx
// ✅ Solution: Context API

// 1. Create context
const UserContext = createContext(null);

// 2. Provide value at top level
function App() {
  const [user, setUser] = useState({ name: 'John', role: 'admin' });
  
  return (
    <UserContext.Provider value={{ user, setUser }}>
      <Dashboard />
    </UserContext.Provider>
  );
}

// 3. Intermediate components don't need props
function Dashboard() {
  return <Sidebar />;
}

function Sidebar() {
  return <Navigation />;
}

function Navigation() {
  return <UserProfile />;
}

// 4. Consumer accesses context directly
function UserProfile() {
  const { user, setUser } = useContext(UserContext);
  return <div>{user.name}</div>;
}
```

---

## 🏗️ Context API Architecture

### The Three Core Pieces

#### 1. Create Context
```jsx
const MyContext = createContext(defaultValue);
//                                    ↑
//                   Only used if component is OUTSIDE Provider
//                   (usually null or undefined)
```

#### 2. Provider Component
```jsx
<MyContext.Provider value={/* any value */}>
  {/* All children can access this value */}
</MyContext.Provider>
```

**Key insights:**
- Provider "broadcasts" the value to all descendants
- `value` can be **anything**: object, array, function, primitive
- When `value` changes, all consumers re-render

#### 3. Consumer (useContext Hook)
```jsx
const value = useContext(MyContext);
```

**Compared to old Consumer component:**
```jsx
// Old way (still works, but verbose)
<MyContext.Consumer>
  {value => <div>{value}</div>}
</MyContext.Consumer>

// New way (cleaner)
const value = useContext(MyContext);
```

---

## 🔥 Your Project: GlobalDataCacheContext Deep Dive

Let's dissect your actual implementation line by line.

### Step 1: Define Action Types
```jsx
const ACTIONS = {
  START_LOADING: 'START_LOADING',
  SET_PORTFOLIO_DATA: 'SET_PORTFOLIO_DATA',
  SET_PROGRAM_DATA: 'SET_PROGRAM_DATA',
  SET_ERROR: 'SET_ERROR',
  // ... more actions
};
```

**Why constants?**
1. Typo protection (`'SET_DATA'` vs `'SET_DAAT'` - second won't work silently)
2. Autocomplete in IDE
3. Easy refactoring (change in one place)

### Step 2: Define Initial State
```jsx
const initialState = {
  // Data cache
  portfolioData: null,
  programData: null,
  subProgramData: null,
  regionData: null,
  regionFilters: null,
  
  // Loading states
  isLoading: false,
  loadingProgress: 0,
  loadingStep: '',
  isBackgroundLoading: false,
  
  // Error handling
  error: null,
  
  // State preservation
  viewStates: { /* ... */ },
  
  // Cache metadata
  cacheTimestamp: null,
  cacheExpiry: 30 * 60 * 1000, // 30 minutes
};
```

### 💡 Eureka Moment #2: State Shape Matters
Your state is **flat but organized**:
- **Data** - What to cache
- **UI state** - Loading, progress, errors
- **Metadata** - Timestamps, expiry

This makes it easy to:
- Reset loading state without affecting data
- Clear cache while preserving view states
- Check cache validity

### Step 3: Define Reducer Function
```jsx
function dataReducer(state, action) {
  switch (action.type) {
    case ACTIONS.START_LOADING:
      return {
        ...state,  // Spread existing state
        isLoading: true,  // Update specific fields
        loadingProgress: 0,
        loadingStep: action.payload?.step || 'Loading data...',
        error: null,  // Clear previous errors
      };
      
    case ACTIONS.SET_PORTFOLIO_DATA:
      return {
        ...state,
        portfolioData: action.payload,  // Store the data
        isLoading: false,  // Mark loading complete
      };
      
    case ACTIONS.SET_ERROR:
      return {
        ...state,
        error: action.payload,
        isLoading: false,
        loadingProgress: 0,
        loadingStep: 'Error',
      };
      
    default:
      return state;  // Unknown action = no change
  }
}
```

### 💡 Eureka Moment #3: Reducers are Pure Functions
A reducer **must**:
1. ✅ Be pure (same input = same output)
2. ✅ Return new object (don't mutate state)
3. ✅ Have no side effects (no API calls, no timers)

**Why?**
- Predictable state transitions
- Time-travel debugging (can replay actions)
- Easy testing (input → output, no mocks needed)

```jsx
// ❌ BAD: Mutates state
case 'ADD_ITEM':
  state.items.push(action.payload);  // Mutation!
  return state;

// ✅ GOOD: Returns new state
case 'ADD_ITEM':
  return {
    ...state,
    items: [...state.items, action.payload]  // New array
  };
```

### Step 4: Create Context
```jsx
const GlobalDataCacheContext = createContext(null);
```

**Why `null` as default?**
- Signals "no provider found"
- Lets custom hook throw helpful error

### Step 5: Custom Hook for Access
```jsx
export const useGlobalDataCache = () => {
  const context = useContext(GlobalDataCacheContext);
  
  if (!context) {
    throw new Error('useGlobalDataCache must be used within GlobalDataCacheProvider');
  }
  
  return context;
};
```

**Benefits:**
1. **Error handling** - Catches mistakes (using hook outside provider)
2. **Naming** - `useGlobalDataCache()` is clearer than `useContext(GlobalDataCacheContext)`
3. **Encapsulation** - Consumer doesn't need to import context, just the hook

### Step 6: Provider Component
```jsx
export const GlobalDataCacheProvider = ({ children }) => {
  // 1. Set up reducer
  const [state, dispatch] = useReducer(dataReducer, initialState);
  
  // 2. Set up refs for preventing duplicate loads
  const loadingRef = useRef(false);
  
  // 3. Define helper functions
  const isCacheValid = useCallback(() => {
    if (!state.cacheTimestamp) return false;
    return (Date.now() - state.cacheTimestamp) < state.cacheExpiry;
  }, [state.cacheTimestamp, state.cacheExpiry]);
  
  const loadDataWithPriority = useCallback(async (priorityView = 'Portfolio', forceRefresh = false) => {
    // Prevent duplicate loads
    if (loadingRef.current && !forceRefresh) {
      console.log('🔄 Data loading already in progress...');
      return;
    }
    
    // Check cache
    if (isCacheValid() && !forceRefresh && state.portfolioData) {
      console.log('✅ Using cached data');
      return;
    }
    
    loadingRef.current = true;
    
    // Dispatch START_LOADING action
    dispatch({ 
      type: ACTIONS.START_LOADING,
      payload: { step: `Loading ${priorityView} data...` }
    });
    
    try {
      // PHASE 1: Load priority data
      const priorityData = await fetchPortfolioData(1, 5000);
      
      // Dispatch SET_PORTFOLIO_DATA action
      dispatch({ 
        type: ACTIONS.SET_PORTFOLIO_DATA, 
        payload: priorityData 
      });
      
      // PHASE 2: Load background data with Promise.all
      dispatch({ type: ACTIONS.START_BACKGROUND_LOADING });
      
      const results = await Promise.all([
        fetchProgramData(),
        fetchSubProgramData(),
        fetchRegionData()
      ]);
      
      // Dispatch actions for background data
      dispatch({ type: ACTIONS.SET_PROGRAM_DATA, payload: results[0] });
      dispatch({ type: ACTIONS.SET_SUBPROGRAM_DATA, payload: results[1] });
      dispatch({ type: ACTIONS.SET_REGION_DATA, payload: results[2] });
      
    } catch (error) {
      dispatch({ type: ACTIONS.SET_ERROR, payload: error.message });
    } finally {
      loadingRef.current = false;
    }
  }, [isCacheValid, state.portfolioData]);
  
  // 4. Create context value object
  const value = {
    // State
    portfolioData: state.portfolioData,
    programData: state.programData,
    subProgramData: state.subProgramData,
    regionData: state.regionData,
    isLoading: state.isLoading,
    loadingProgress: state.loadingProgress,
    loadingStep: state.loadingStep,
    isBackgroundLoading: state.isBackgroundLoading,
    error: state.error,
    
    // Actions
    loadDataWithPriority,
    preserveViewState: (viewName, viewState) => {
      dispatch({ 
        type: ACTIONS.PRESERVE_VIEW_STATE, 
        payload: { viewName, state: viewState } 
      });
    },
    clearCache: () => {
      dispatch({ type: ACTIONS.CLEAR_CACHE });
    },
  };
  
  // 5. Provide value to children
  return (
    <GlobalDataCacheContext.Provider value={value}>
      {children}
    </GlobalDataCacheContext.Provider>
  );
};
```

### 💡 Eureka Moment #4: Side Effects Go in Provider, Not Reducer
```jsx
// ✅ CORRECT: Async logic in provider
const loadData = useCallback(async () => {
  dispatch({ type: 'START_LOADING' });  // Reducer handles sync update
  
  try {
    const data = await fetch('/api');  // Async side effect in provider
    dispatch({ type: 'SET_DATA', payload: data });  // Reducer handles sync update
  } catch (error) {
    dispatch({ type: 'SET_ERROR', payload: error });  // Reducer handles sync update
  }
}, []);

// ❌ WRONG: Async logic in reducer
function reducer(state, action) {
  switch (action.type) {
    case 'LOAD_DATA':
      fetch('/api').then(data => {  // ❌ Side effect in reducer!
        // How do we dispatch from here?
      });
      return state;
  }
}
```

**The pattern:**
1. **Provider**: Handles async logic, dispatches actions
2. **Reducer**: Handles sync state transitions based on actions

---

## 🎯 How Data Flows (Step-by-Step)

### Scenario: User Selects Portfolio View

```jsx
// 1. USER ACTION: Click "Portfolio" button
<button onClick={() => handleViewSelection('Portfolio')}>
  View Portfolio
</button>

// 2. HANDLER: Call loadDataWithPriority
const handleViewSelection = useCallback((viewName) => {
  setCurrentView(viewName);
  loadDataWithPriority(viewName);  // From context
}, [loadDataWithPriority]);

// 3. CONTEXT FUNCTION: loadDataWithPriority runs
async function loadDataWithPriority(priorityView) {
  // 4. DISPATCH: START_LOADING action
  dispatch({ 
    type: ACTIONS.START_LOADING,
    payload: { step: 'Loading Portfolio data...' }
  });
  
  // 5. REDUCER: Updates state (isLoading = true)
  // All consumers re-render with new state
  
  // 6. API CALL: Fetch data
  const data = await fetchPortfolioData();
  
  // 7. DISPATCH: SET_PORTFOLIO_DATA action
  dispatch({ 
    type: ACTIONS.SET_PORTFOLIO_DATA, 
    payload: data 
  });
  
  // 8. REDUCER: Updates state (portfolioData = data, isLoading = false)
  // All consumers re-render with new state
}

// 9. COMPONENT: Receives new state via useContext
const { portfolioData, isLoading } = useGlobalDataCache();

// 10. REACT: Re-renders with new data
if (isLoading) return <LoadingSpinner />;
return <GanttChart data={portfolioData} />;
```

### 💡 Eureka Moment #5: Dispatch is Synchronous, setState is Not
```jsx
// useReducer: dispatch is synchronous
dispatch({ type: 'INCREMENT' });
console.log(state.count);  // Updated immediately! (in next render)

// useState: setState is asynchronous
setState(count + 1);
console.log(count);  // Still old value!
```

Wait, that seems contradictory! Here's the truth:
- **Dispatch schedules a re-render** (like setState)
- **But reducer runs immediately** (synchronously)
- **New state available in next render** (like useState)

The difference: You can dispatch multiple actions and know they'll be processed in order.

---

## 🚀 Advanced Pattern: Context + useReducer = Redux-lite

### Comparison

| Feature | Context + useReducer | Redux |
|---------|---------------------|-------|
| **Global state** | ✅ | ✅ |
| **Predictable updates** | ✅ | ✅ |
| **Time-travel debugging** | ❌ | ✅ |
| **Middleware** | ❌ (custom) | ✅ |
| **DevTools** | ❌ | ✅ |
| **Bundle size** | 0KB (built-in) | ~10KB |
| **Learning curve** | Low | Medium |

**When to use Context + useReducer:**
- Medium-sized apps
- No need for time-travel debugging
- Want to avoid extra dependencies

**When to use Redux:**
- Large apps with complex state
- Need middleware (logging, persistence)
- Want Redux DevTools
- Team familiar with Redux

### Your Project's Choice
You chose Context + useReducer! Benefits:
1. **No external library** - Built into React
2. **Simpler** - No boilerplate, no store config
3. **Scoped** - Multiple contexts for different concerns
4. **Sufficient** - Your state management needs fit perfectly

---

## ⚠️ Context Performance Pitfalls

### Problem: Context Re-renders All Consumers
```jsx
const ThemeContext = createContext();

function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light');
  const [user, setUser] = useState(null);
  
  // ⚠️ New object on every render
  const value = {
    theme,
    setTheme,
    user,
    setUser
  };
  
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// Problem: When user changes, ALL consumers re-render (even ones only using theme)
```

### Solution 1: Memoize Context Value
```jsx
function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light');
  const [user, setUser] = useState(null);
  
  // ✅ Same object reference unless dependencies change
  const value = useMemo(() => ({
    theme,
    setTheme,
    user,
    setUser
  }), [theme, user]);
  
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
```

### Solution 2: Split Contexts
```jsx
// ✅ Separate concerns
const ThemeContext = createContext();
const UserContext = createContext();

function AppProviders({ children }) {
  return (
    <ThemeProvider>
      <UserProvider>
        {children}
      </UserProvider>
    </ThemeProvider>
  );
}

// Now theme changes don't affect user consumers, and vice versa
```

### Solution 3: Use React.memo on Consumers
```jsx
const ExpensiveComponent = React.memo(function ExpensiveComponent() {
  const { theme } = useContext(ThemeContext);
  return <div className={theme}>Expensive render</div>;
});
```

### Your Project's Approach
```jsx
const value = {
  // State
  portfolioData: state.portfolioData,
  programData: state.programData,
  // ... all state and functions
};
```

**Is this a problem?** Not really! Why:
1. Your state changes infrequently (only on load/refresh)
2. Most consumers need multiple pieces of state
3. Premature optimization would add complexity

**When to optimize:**
- If profiling shows unnecessary re-renders
- If you have many consumers using only a subset of state

---

## 📝 Interview Questions: Context API

**Q: What problems does Context API solve?**
A: **Prop drilling** - passing props through many levels of components that don't use them. Context lets you "teleport" data to deeply nested components.

**Q: When should you use Context vs lifting state up?**
A:
- **Lifting state up**: For 2-3 levels, simple parent-child communication
- **Context**: For deeply nested components, truly global state (theme, auth, cache)

**Q: What's the performance concern with Context?**
A: When context value changes, **all consumers re-render**. Solutions:
1. Memoize context value with `useMemo`
2. Split contexts by concern
3. Use `React.memo` on consumer components

**Q: Can you have multiple contexts?**
A: Yes! Nest providers or create a custom provider that combines them:
```jsx
<UserProvider>
  <ThemeProvider>
    <DataProvider>
      <App />
    </DataProvider>
  </ThemeProvider>
</UserProvider>
```

**Q: What's the difference between Context and Redux?**
A:
- **Context**: Built-in, simpler, no middleware, no DevTools
- **Redux**: External library, middleware, DevTools, time-travel debugging

Both solve global state management, Redux is more powerful but Context + useReducer is often sufficient.

**Q: How do you test components using Context?**
A: Wrap them in a provider with test values:
```jsx
render(
  <MyContext.Provider value={testValue}>
    <ComponentUnderTest />
  </MyContext.Provider>
);
```

**Q: Can you use Context for dependency injection?**
A: Yes! Provide services/functions via context:
```jsx
const ApiContext = createContext();

function ApiProvider({ children }) {
  const api = useMemo(() => ({
    fetchUser: (id) => fetch(`/api/users/${id}`),
    fetchPosts: () => fetch('/api/posts')
  }), []);
  
  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;
}
```

---

## 🎓 Context API Checklist

### Setup
- [ ] Create context with `createContext()`
- [ ] Define initial state (if using with useReducer)
- [ ] Define action types and reducer function
- [ ] Create custom hook for accessing context
- [ ] Create provider component

### Provider Component
- [ ] Set up state with `useReducer` or `useState`
- [ ] Define helper functions (wrapped in `useCallback`)
- [ ] Create value object with state and functions
- [ ] Memoize value object if performance matters
- [ ] Return `<Context.Provider value={value}>{children}</Context.Provider>`

### Consumer Components
- [ ] Use custom hook to access context
- [ ] Handle loading/error states
- [ ] Avoid unnecessary re-renders with `React.memo` if needed

### Best Practices
- [ ] Throw error if context used outside provider
- [ ] Split contexts by concern if they change independently
- [ ] Keep side effects in provider, not reducer
- [ ] Memoize expensive context values
- [ ] Document what the context provides

---

## 🚀 Your Next Steps

1. **Study your GlobalDataCacheContext.jsx** - Trace a dispatch call from action to state update
2. **Add logging** - Log every action and state change to understand the flow
3. **Experiment** - Add a new action type and see how it propagates
4. **Profile** - Use React DevTools to see when consumers re-render
5. **Practice explaining** - Describe your context architecture in an interview

---

> **You have a production-quality Context + useReducer implementation! Use it as your primary interview example for global state management.**
