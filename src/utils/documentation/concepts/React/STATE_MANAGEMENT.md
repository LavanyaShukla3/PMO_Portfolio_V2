# React State Management: From Basics to Advanced Patterns

Hey there! 👋 Let's talk about **state management** in React—one of the most important (and sometimes confusing) concepts you'll encounter. This guide will take you from "What even is state?" all the way to understanding the sophisticated global cache system we've built in our PMO Portfolio app.

---

## 🎯 What is State in React?

Think of **state** as the **memory of your component**. It's data that can change over time and, when it does, React automatically re-renders your component to reflect those changes.

### Real-World Analogy

Imagine a light switch:
- **State**: Whether the light is ON or OFF
- **Event**: Flipping the switch
- **Re-render**: The light bulb responding to the new state

In React:
- **State**: `const [isLightOn, setIsLightOn] = useState(false)`
- **Event**: User clicks a button
- **Re-render**: Component updates to show the new state

### Simple Example

```jsx
function Counter() {
    const [count, setCount] = useState(0);  // State: count is 0
    
    return (
        <div>
            <p>Count: {count}</p>
            <button onClick={() => setCount(count + 1)}>Increment</button>
        </div>
    );
}
```

When you click the button:
1. `setCount(count + 1)` updates the state
2. React sees state changed
3. Component re-renders with new count value
4. User sees updated number on screen

---

## 🧠 Why Do We Need State Management?

As your app grows, managing state becomes challenging:

### Problem 1: Prop Drilling

Imagine you have deeply nested components:

```
App (has user data)
  └── Header (needs user name)
        └── ProfileDropdown (needs user avatar)
              └── Settings (needs user preferences)
```

Without proper state management, you'd pass props through EVERY level:

```jsx
// 😱 Prop Drilling Hell
<App>
  <Header userName={user.name} userAvatar={user.avatar} userPrefs={user.prefs} />
    <ProfileDropdown userAvatar={user.avatar} userPrefs={user.prefs} />
      <Settings userPrefs={user.prefs} />
</App>
```

**The Problem**: `Header` and `ProfileDropdown` don't even USE those props—they're just passing them down like a relay race. This is called **prop drilling**.

### Problem 2: Shared State

Multiple components need the same data:

```
Portfolio View (needs data)
Program View (needs data)
SubProgram View (needs data)
```

Without global state:
- Each component fetches data independently
- API called 3 times for same data
- Slow, inefficient, inconsistent

---

## 🛠️ Different Ways to Manage State in React

React gives you multiple tools, each suited for different scenarios:

### 1️⃣ `useState` - Local Component State

**When to use**: Simple, component-specific state

```jsx
function LoginForm() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    
    return (
        <form>
            <input value={email} onChange={(e) => setEmail(e.target.value)} />
            <input value={password} onChange={(e) => setPassword(e.target.value)} />
        </form>
    );
}
```

✅ **Pros**: Simple, straightforward
❌ **Cons**: Can't share state between components, gets messy with complex state

---

### 2️⃣ `useReducer` - Complex Component State

**When to use**: Component state with multiple related values and complex update logic

Think of `useReducer` as a more powerful `useState`. Instead of calling `setState` directly, you **dispatch actions** that describe what happened, and a **reducer function** decides how to update state.

#### Analogy: Restaurant Kitchen

- **State**: The kitchen's current orders
- **Action**: A waiter brings a new order ("ADD_ORDER", "COMPLETE_ORDER")
- **Reducer**: The chef who decides how to update the kitchen state based on the action

```jsx
// Define possible actions
const ACTIONS = {
    ADD_TODO: 'ADD_TODO',
    TOGGLE_TODO: 'TOGGLE_TODO',
    DELETE_TODO: 'DELETE_TODO'
};

// Reducer function: decides HOW to update state
function todoReducer(state, action) {
    switch (action.type) {
        case ACTIONS.ADD_TODO:
            return {
                ...state,
                todos: [...state.todos, action.payload]
            };
        case ACTIONS.TOGGLE_TODO:
            return {
                ...state,
                todos: state.todos.map(todo =>
                    todo.id === action.payload 
                        ? { ...todo, completed: !todo.completed }
                        : todo
                )
            };
        case ACTIONS.DELETE_TODO:
            return {
                ...state,
                todos: state.todos.filter(todo => todo.id !== action.payload)
            };
        default:
            return state;
    }
}

function TodoApp() {
    const [state, dispatch] = useReducer(todoReducer, { todos: [] });
    
    const addTodo = (text) => {
        dispatch({ 
            type: ACTIONS.ADD_TODO, 
            payload: { id: Date.now(), text, completed: false } 
        });
    };
    
    return (
        <div>
            {state.todos.map(todo => (
                <div key={todo.id}>
                    <span 
                        style={{ textDecoration: todo.completed ? 'line-through' : 'none' }}
                        onClick={() => dispatch({ type: ACTIONS.TOGGLE_TODO, payload: todo.id })}
                    >
                        {todo.text}
                    </span>
                    <button onClick={() => dispatch({ type: ACTIONS.DELETE_TODO, payload: todo.id })}>
                        Delete
                    </button>
                </div>
            ))}
        </div>
    );
}
```

✅ **Pros**: 
- Predictable state updates
- Easy to test (reducer is pure function)
- Better for complex state logic
- Can log actions for debugging

❌ **Cons**: More boilerplate, steeper learning curve

---

### 3️⃣ Context API - Share State Without Prop Drilling

**When to use**: Share state across many components without passing props

Context is like a **broadcast tower**—any component can tune in and receive the signal.

```jsx
// 1. Create context
const ThemeContext = React.createContext();

// 2. Provider wraps your app
function App() {
    const [theme, setTheme] = useState('light');
    
    return (
        <ThemeContext.Provider value={{ theme, setTheme }}>
            <Header />
            <MainContent />
            <Footer />
        </ThemeContext.Provider>
    );
}

// 3. Any child component can access context
function Header() {
    const { theme, setTheme } = useContext(ThemeContext);
    
    return (
        <header style={{ background: theme === 'light' ? 'white' : 'black' }}>
            <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
                Toggle Theme
            </button>
        </header>
    );
}
```

✅ **Pros**: No prop drilling, clean component tree
❌ **Cons**: All consumers re-render when context changes (can be optimized)

---

### 4️⃣ Context API + useReducer (🎯 OUR APPROACH)

**When to use**: Global state with complex update logic

This is **the sweet spot** for medium-to-large apps. You get:
- ✅ Global state accessible anywhere (Context)
- ✅ Predictable state updates (useReducer)
- ✅ No external dependencies (pure React)
- ✅ Easy to debug and test

**This is what we use in our PMO Portfolio app.** Let's dive deep into our implementation!

---

## 🚀 Our Implementation: GlobalDataCacheContext

### The Problem We're Solving

Our app has 4 views (Portfolio, Program, SubProgram, Region), and each needs data from our backend. Without a smart caching system:

❌ **Bad**: Every time you switch views:
```
User clicks "Portfolio View" → API call → Wait 2 seconds
User clicks "Program View" → API call → Wait 2 seconds
User clicks "Portfolio View" again → API call AGAIN → Wait 2 seconds 😡
```

✅ **Good**: With GlobalDataCacheContext:
```
User clicks "Portfolio View" → API call → Wait 2 seconds → Cache data
User clicks "Program View" → API call → Wait 2 seconds → Cache data
User clicks "Portfolio View" again → Instant! (from cache) ⚡
```

### Additional Benefits

1. **Progressive Loading**: Load the view you need first, others in background
2. **State Preservation**: Remember your scroll position, filters, zoom level when navigating
3. **Cache Expiry**: Refresh data every 30 minutes automatically
4. **Centralized Loading States**: One place to manage all loading/error states

---

## 📚 Deep Dive: How Our GlobalDataCacheContext Works

### File Structure

**Location**: `src/contexts/GlobalDataCacheContext.jsx` (496 lines)

### Architecture Overview

```
GlobalDataCacheProvider (Wraps entire app)
    ↓
Manages state with useReducer
    ↓
Provides data & functions via Context
    ↓
Any component can access with useGlobalDataCache()
```

---

### Part 1: Actions & Initial State

```jsx
// Define all possible actions (like commands)
const ACTIONS = {
    START_LOADING: 'START_LOADING',              // Begin loading data
    SET_PORTFOLIO_DATA: 'SET_PORTFOLIO_DATA',    // Store portfolio data
    SET_PROGRAM_DATA: 'SET_PROGRAM_DATA',        // Store program data
    SET_SUBPROGRAM_DATA: 'SET_SUBPROGRAM_DATA',  // Store subprogram data
    SET_REGION_DATA: 'SET_REGION_DATA',          // Store region data
    SET_REGION_FILTERS: 'SET_REGION_FILTERS',    // Store region filters
    SET_ERROR: 'SET_ERROR',                       // Handle errors
    SET_LOADING_STEP: 'SET_LOADING_STEP',        // Update loading progress
    START_BACKGROUND_LOADING: 'START_BACKGROUND_LOADING',  // Background fetch
    PRESERVE_VIEW_STATE: 'PRESERVE_VIEW_STATE',  // Save UI state (scroll, filters)
    UPDATE_CACHE_TIMESTAMP: 'UPDATE_CACHE_TIMESTAMP'  // Track when data was cached
};
```

These actions are like **events** that describe what happened. The reducer (coming next) decides how to update state based on these events.

```jsx
// Initial state when app starts
const initialState = {
    // Data cache for each view
    portfolioData: null,
    programData: null,
    subProgramData: null,
    regionData: null,
    regionFilters: null,
    
    // Loading states
    isLoading: false,              // Is primary data loading?
    isBackgroundLoading: false,    // Is background data loading?
    loadingProgress: 0,            // 0-100%
    loadingStep: '',               // "Loading portfolio data..."
    
    // Error handling
    error: null,
    
    // Cache metadata
    cacheTimestamp: null,          // When was data last fetched?
    
    // View state preservation (scroll positions, filters, etc.)
    viewStates: {
        portfolio: {},
        program: {},
        subprogram: {},
        region: {}
    }
};
```

---

### Part 2: The Reducer Function

The reducer is the **brain** of our state management. It's a pure function that takes current state + action, and returns new state.

```jsx
function dataReducer(state, action) {
    switch (action.type) {
        case ACTIONS.START_LOADING:
            return {
                ...state,
                isLoading: true,
                isBackgroundLoading: false,
                error: null,
                loadingProgress: 0,
                loadingStep: 'Initializing...'
            };
            
        case ACTIONS.SET_PORTFOLIO_DATA:
            return {
                ...state,
                portfolioData: action.payload,
                loadingProgress: action.progress || state.loadingProgress
            };
            
        case ACTIONS.SET_PROGRAM_DATA:
            return {
                ...state,
                programData: action.payload,
                loadingProgress: action.progress || state.loadingProgress
            };
            
        case ACTIONS.SET_SUBPROGRAM_DATA:
            return {
                ...state,
                subProgramData: action.payload,
                loadingProgress: action.progress || state.loadingProgress
            };
            
        case ACTIONS.SET_REGION_DATA:
            return {
                ...state,
                regionData: action.payload,
                loadingProgress: action.progress || state.loadingProgress
            };
            
        case ACTIONS.SET_REGION_FILTERS:
            return {
                ...state,
                regionFilters: action.payload
            };
            
        case ACTIONS.SET_ERROR:
            return {
                ...state,
                error: action.payload,
                isLoading: false,
                isBackgroundLoading: false
            };
            
        case ACTIONS.SET_LOADING_STEP:
            return {
                ...state,
                loadingStep: action.payload.step,
                loadingProgress: action.payload.progress,
                isLoading: action.payload.isLoading ?? state.isLoading,
                isBackgroundLoading: action.payload.isBackgroundLoading ?? state.isBackgroundLoading
            };
            
        case ACTIONS.START_BACKGROUND_LOADING:
            return {
                ...state,
                isLoading: false,              // Primary loading done!
                isBackgroundLoading: true,      // Now loading in background
                loadingStep: action.payload.step,
                loadingProgress: action.payload.progress
            };
            
        case ACTIONS.PRESERVE_VIEW_STATE:
            return {
                ...state,
                viewStates: {
                    ...state.viewStates,
                    [action.payload.view]: {
                        ...state.viewStates[action.payload.view],
                        ...action.payload.state
                    }
                }
            };
            
        case ACTIONS.UPDATE_CACHE_TIMESTAMP:
            return {
                ...state,
                cacheTimestamp: action.payload
            };
            
        default:
            return state;
    }
}
```

**Key Points**:
- Every case returns a **new state object** (immutability is crucial)
- We use spread operator `...state` to keep unchanged properties
- Each action updates specific slices of state
- Reducer is a **pure function**: same input = same output, no side effects

---

### Part 3: Creating Context & Custom Hook

```jsx
// Create context (the broadcast tower)
const GlobalDataCacheContext = React.createContext();

// Custom hook for easy access
export function useGlobalDataCache() {
    const context = useContext(GlobalDataCacheContext);
    if (!context) {
        throw new Error('useGlobalDataCache must be used within GlobalDataCacheProvider');
    }
    return context;
}
```

This custom hook makes it easy for components to access our context:

```jsx
// In any component:
const { portfolioData, isLoading, loadDataWithPriority } = useGlobalDataCache();
```

---

### Part 4: The Provider Component

This is where the magic happens! The provider wraps our app and provides all the state + functions.

```jsx
export function GlobalDataCacheProvider({ children }) {
    const [state, dispatch] = useReducer(dataReducer, initialState);
    
    // Cache validation: is data older than 30 minutes?
    const isCacheValid = useCallback(() => {
        if (!state.cacheTimestamp) return false;
        const thirtyMinutes = 30 * 60 * 1000;
        return Date.now() - state.cacheTimestamp < thirtyMinutes;
    }, [state.cacheTimestamp]);
    
    // ... (more functions coming next)
}
```

---

### Part 5: Priority-Based Loading (The Star Feature ⭐)

This is what makes our app feel fast! Instead of loading everything at once, we load what the user needs FIRST, then load other views in the background.

```jsx
const loadDataWithPriority = useCallback(async (priorityView = 'portfolio', forceRefresh = false) => {
    // Check cache first
    if (!forceRefresh && isCacheValid() && state.portfolioData) {
        console.log('✅ Using cached data');
        return;
    }
    
    // Start loading
    dispatch({ type: ACTIONS.START_LOADING });
    
    try {
        // PHASE 1: Load priority view FIRST (20% progress)
        console.log(`🎯 Phase 1: Loading ${priorityView} data first`);
        
        if (priorityView === 'portfolio') {
            const portfolioData = await fetchPortfolioDataFromAPI();
            dispatch({ 
                type: ACTIONS.SET_PORTFOLIO_DATA, 
                payload: portfolioData,
                progress: 20 
            });
        } else if (priorityView === 'program') {
            const programData = await fetchProgramDataFromAPI();
            dispatch({ 
                type: ACTIONS.SET_PROGRAM_DATA, 
                payload: programData,
                progress: 20 
            });
        }
        // ... (similar for subprogram and region)
        
        // 🎯 KEY MOMENT: Switch to background loading!
        dispatch({ 
            type: ACTIONS.START_BACKGROUND_LOADING,
            payload: { 
                step: `✅ ${priorityView} loaded! Loading other views...`,
                progress: 20
            }
        });
        
        // PHASE 2: Load remaining views in background (20% → 100%)
        console.log('🔄 Phase 2: Loading remaining data in background');
        
        // Load all other views (60%, 80%, 90%, 100%)
        const remainingData = await Promise.all([
            fetchPortfolioDataFromAPI(),
            fetchProgramDataFromAPI(),
            fetchSubProgramDataFromAPI(),
            fetchRegionDataFromAPI()
        ]);
        
        dispatch({ type: ACTIONS.SET_PORTFOLIO_DATA, payload: remainingData[0], progress: 60 });
        dispatch({ type: ACTIONS.SET_PROGRAM_DATA, payload: remainingData[1], progress: 80 });
        dispatch({ type: ACTIONS.SET_SUBPROGRAM_DATA, payload: remainingData[2], progress: 90 });
        dispatch({ type: ACTIONS.SET_REGION_DATA, payload: remainingData[3], progress: 100 });
        
        // Update cache timestamp
        dispatch({ type: ACTIONS.UPDATE_CACHE_TIMESTAMP, payload: Date.now() });
        
        // Done!
        dispatch({ 
            type: ACTIONS.SET_LOADING_STEP,
            payload: { 
                step: '✅ All data loaded and cached',
                progress: 100,
                isBackgroundLoading: false
            }
        });
        
    } catch (error) {
        dispatch({ type: ACTIONS.SET_ERROR, payload: error.message });
    }
}, [isCacheValid, state.portfolioData]);
```

#### How This Improves User Experience

**Without Priority Loading**:
```
User clicks "Portfolio" → Load ALL 4 views → Wait 8 seconds → Show Portfolio 😴
```

**With Priority Loading**:
```
User clicks "Portfolio" → Load Portfolio → Wait 2 seconds → Show Portfolio! ⚡
                        ↘ Background: Load other 3 views → User doesn't wait
```

The user can start interacting with Portfolio view while Program, SubProgram, and Region data loads quietly in the background!

---

### Part 6: State Preservation

When you navigate from Portfolio → Program → Portfolio, we want to remember:
- Your scroll position
- Filters you applied
- Zoom level
- Selected items

```jsx
// Save current view state before navigating away
const preserveViewState = useCallback((view, viewState) => {
    dispatch({
        type: ACTIONS.PRESERVE_VIEW_STATE,
        payload: { view: view.toLowerCase(), state: viewState }
    });
}, []);

// Retrieve saved view state when navigating back
const getViewState = useCallback((view) => {
    return state.viewStates[view.toLowerCase()] || {};
}, [state.viewStates]);
```

**Usage in App.jsx**:

```jsx
const handleViewChange = (newView) => {
    // Save current view's state
    preserveViewState(currentView.toLowerCase(), {
        selectedPortfolioId,
        selectedPortfolioName,
        selectedSubProgramId,
        selectedSubProgramName,
    });
    
    setCurrentView(newView);
    
    // Restore saved state for new view
    const savedState = getViewState(newView.toLowerCase());
    if (savedState.selectedPortfolioId) {
        setSelectedPortfolioId(savedState.selectedPortfolioId);
        setSelectedPortfolioName(savedState.selectedPortfolioName);
    }
};
```

---

### Part 7: Providing Everything to the App

```jsx
// Context value: everything we want to expose
const contextValue = {
    // Data
    portfolioData: state.portfolioData,
    programData: state.programData,
    subProgramData: state.subProgramData,
    regionData: state.regionData,
    regionFilters: state.regionFilters,
    
    // Loading states
    isLoading: state.isLoading,
    isBackgroundLoading: state.isBackgroundLoading,
    loadingProgress: state.loadingProgress,
    loadingStep: state.loadingStep,
    
    // Error
    error: state.error,
    
    // Functions
    refreshData: (view) => loadDataWithPriority(view, true),
    loadDataWithPriority,
    preserveViewState,
    getViewState,
    isCacheValid
};

return (
    <GlobalDataCacheContext.Provider value={contextValue}>
        {children}
    </GlobalDataCacheContext.Provider>
);
```

---

## 🎬 How It All Comes Together

### Step 1: Wrap App with Provider

**App.jsx**:
```jsx
function App() {
    return (
        <GlobalDataCacheProvider>
            <AppContent />
        </GlobalDataCacheProvider>
    );
}
```

This makes our global cache available to EVERY component in the app.

---

### Step 2: Access Data in Any Component

**App.jsx** (AppContent):
```jsx
function AppContent() {
    const { 
        isLoading, 
        isBackgroundLoading,
        loadingProgress, 
        loadingStep, 
        error,
        preserveViewState,
        getViewState,
        loadDataWithPriority
    } = useGlobalDataCache();
    
    // Handle view selection from welcome page
    const handleViewSelection = useCallback((viewName) => {
        setCurrentView(viewName);
        // Load the selected view's data first, then others in background
        loadDataWithPriority(viewName);
    }, [loadDataWithPriority]);
    
    // ... rest of component
}
```

**PortfolioGanttChart.jsx** (or any other component):
```jsx
function PortfolioGanttChart() {
    const { portfolioData, isLoading } = useGlobalDataCache();
    
    if (isLoading) return <LoadingSpinner />;
    if (!portfolioData) return <div>No data</div>;
    
    return (
        <div>
            {portfolioData.map(item => <GanttBar key={item.id} data={item} />)}
        </div>
    );
}
```

---

### Step 3: Visual Flow

```
User lands on app
    ↓
<GlobalDataCacheProvider> wraps app
    ↓
useReducer initializes state (all null, isLoading: false)
    ↓
User sees WelcomePage
    ↓
User clicks "Portfolio View"
    ↓
handleViewSelection('portfolio') called
    ↓
loadDataWithPriority('portfolio') called
    ↓
dispatch({ type: START_LOADING })
    ↓
Reducer updates state: isLoading = true
    ↓
All components using useGlobalDataCache() re-render
    ↓
Loading indicator shows
    ↓
PHASE 1: Fetch portfolio data (2 seconds)
    ↓
dispatch({ type: SET_PORTFOLIO_DATA })
    ↓
dispatch({ type: START_BACKGROUND_LOADING })
    ↓
Reducer updates: isLoading = false, isBackgroundLoading = true
    ↓
Portfolio view renders with data! ⚡
    ↓
PHASE 2: Fetch remaining views in background
    ↓
dispatch actions for program, subprogram, region data
    ↓
Background loading indicator shows progress
    ↓
All data cached! ✅
```

---

## 🆚 Why This Approach vs. Alternatives?

### Context + useReducer vs. Redux

**Redux** is a popular state management library, but it adds complexity:

| Feature | Context + useReducer | Redux |
|---------|---------------------|-------|
| **Setup Complexity** | Minimal | High (actions, reducers, store, middleware) |
| **Dependencies** | None (built into React) | redux, react-redux, redux-thunk/saga |
| **Boilerplate** | Moderate | High |
| **DevTools** | Basic React DevTools | Powerful Redux DevTools |
| **Best For** | Small-to-medium apps | Large apps with complex state |

**Our Choice**: Context + useReducer gives us 90% of Redux's benefits with 50% of the complexity. Perfect for our app size.

---

### Context + useReducer vs. useState Everywhere

**Bad Approach** (useState in App.jsx):
```jsx
function App() {
    const [portfolioData, setPortfolioData] = useState(null);
    const [programData, setProgramData] = useState(null);
    const [isLoadingPortfolio, setIsLoadingPortfolio] = useState(false);
    const [isLoadingProgram, setIsLoadingProgram] = useState(false);
    const [errorPortfolio, setErrorPortfolio] = useState(null);
    const [errorProgram, setErrorProgram] = useState(null);
    // ... 20 more useState calls 😱
}
```

**Problems**:
- Too many state variables
- State updates scattered everywhere
- Hard to track what causes re-renders
- Difficult to debug

**Our Approach** (Context + useReducer):
```jsx
function GlobalDataCacheProvider() {
    const [state, dispatch] = useReducer(dataReducer, initialState);
    // One state object, one dispatch function, clear action logs
}
```

**Benefits**:
- Single source of truth
- Predictable state updates
- Easy to debug (log actions)
- Cleaner component code

---

## 🎓 Key Takeaways

### When to Use Each Pattern

1. **useState**: Simple, local component state (form inputs, toggles)
2. **useReducer**: Complex component state with multiple related values
3. **Context API**: Share state across many components (theme, user auth)
4. **Context + useReducer** (⭐): Global state with complex logic (our cache system)
5. **Redux**: Very large apps with hundreds of actions and complex middleware needs

### Best Practices We Follow

✅ **Immutable State Updates**: Always return new objects/arrays
✅ **Action Constants**: Use `ACTIONS` object to prevent typos
✅ **Pure Reducers**: No side effects, same input = same output
✅ **Single Responsibility**: Each action does one thing
✅ **Custom Hooks**: `useGlobalDataCache()` abstracts complexity
✅ **Error Boundaries**: Handle errors gracefully
✅ **Performance**: Priority loading + background loading = fast UX

---

## 📊 Visual Summary: Our State Management Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   GlobalDataCacheProvider                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              useReducer(dataReducer)                 │  │
│  │                                                      │  │
│  │  State:                       Dispatch:             │  │
│  │  • portfolioData              • START_LOADING       │  │
│  │  • programData                • SET_PORTFOLIO_DATA  │  │
│  │  • subProgramData             • SET_PROGRAM_DATA    │  │
│  │  • regionData                 • SET_REGION_DATA     │  │
│  │  • isLoading                  • SET_ERROR           │  │
│  │  • loadingProgress            • PRESERVE_VIEW_STATE │  │
│  │  • viewStates                 • ...more actions     │  │
│  └──────────────────────────────────────────────────────┘  │
│                             ↓                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              GlobalDataCacheContext                  │  │
│  │         (Broadcast tower for all components)         │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ↓
        ┌─────────────────────┴─────────────────────┐
        ↓                     ↓                     ↓
┌───────────────┐    ┌────────────────┐    ┌──────────────┐
│   App.jsx     │    │  Portfolio     │    │   Program    │
│               │    │  GanttChart    │    │  GanttChart  │
├───────────────┤    ├────────────────┤    ├──────────────┤
│ const {       │    │ const {        │    │ const {      │
│   isLoading,  │    │   portfolioData│    │   programData│
│   loadData..  │    │   isLoading    │    │   isLoading  │
│ } = useGlobal │    │ } = useGlobal  │    │ } = useGlobal│
│     DataCache │    │     DataCache  │    │     DataCache│
│ ();           │    │ ();            │    │ ();          │
└───────────────┘    └────────────────┘    └──────────────┘
```

---

## 🔮 Interview Questions to Prepare

### Question 1: What is the difference between props and state?

**Answer**:
- **Props**: Data passed from parent to child (immutable from child's perspective)
- **State**: Data managed within a component (can change over time)

Example:
```jsx
// Props
<WelcomePage onSelectView={handleViewSelection} />  // onSelectView is a prop

// State
const [currentView, setCurrentView] = useState(null);  // currentView is state
```

---

### Question 2: When would you use useReducer instead of useState?

**Answer**: Use `useReducer` when:
1. State has complex structure (objects with many properties)
2. Next state depends on previous state
3. Multiple related state values that update together
4. You want predictable, testable state updates

Example: Our `GlobalDataCacheContext` has 11 different pieces of state that all relate to data loading—perfect for `useReducer`.

---

### Question 3: What is Context API and when should you use it?

**Answer**: Context API lets you share data across components without prop drilling.

**When to use**:
- Theme (light/dark mode)
- User authentication
- Language preferences
- Global data cache (our use case!)

**When NOT to use**:
- Local component state
- Data that doesn't need to be shared

---

### Question 4: What is prop drilling and how does Context solve it?

**Answer**: Prop drilling is passing props through intermediate components that don't need them.

**Without Context**:
```jsx
<App userData={user}>
  <Header userData={user}>  {/* Doesn't use it */}
    <Profile userData={user}>  {/* Doesn't use it */}
      <Avatar userData={user} />  {/* Finally uses it! */}
```

**With Context**:
```jsx
<UserContext.Provider value={user}>
  <App>
    <Header>
      <Profile>
        <Avatar />  {/* Gets user from useContext(UserContext) */}
```

---

### Question 5: How does React know when to re-render a component?

**Answer**: React re-renders when:
1. **State changes** (via `useState` or `useReducer`)
2. **Props change**
3. **Parent re-renders** (unless optimized with `React.memo`)
4. **Context value changes** (all consumers re-render)

In our app: When `dispatch` is called in GlobalDataCacheProvider, React sees state changed, so all components using `useGlobalDataCache()` re-render with new data.

---

### Question 6: Explain your app's state management architecture.

**Answer** (This is YOUR time to shine!):

"Our app uses **Context API + useReducer** for global state management. Here's why:

1. **Problem**: We have 4 views (Portfolio, Program, SubProgram, Region) that all need data from our backend. Without caching, switching views meant redundant API calls and poor performance.

2. **Solution**: I built a `GlobalDataCacheContext` that:
   - Caches data for all views (30-minute expiry)
   - Implements priority-based loading (load what user needs first, background load the rest)
   - Preserves UI state (scroll position, filters) across navigation
   - Manages all loading/error states centrally

3. **Implementation**:
   - Used `useReducer` with 11 action types for predictable state updates
   - Created custom `useGlobalDataCache()` hook for easy component access
   - Two-phase loading: Priority view (20% progress) → Background loading (remaining 80%)

4. **Results**:
   - First view loads in 2 seconds, subsequent views are instant (from cache)
   - Clean component code (no prop drilling)
   - Easy to debug (action logs show exactly what happened)

This approach gave us the benefits of Redux without the complexity, perfect for our medium-sized app."

---

## 🎯 Next Steps for Learning

### Beginner Level ✅
- [ ] Understand `useState` thoroughly
- [ ] Practice using `useEffect` for side effects
- [ ] Learn Context API basics

### Intermediate Level 🔄
- [ ] Master `useReducer` pattern
- [ ] Combine Context + useReducer
- [ ] Understand React re-rendering

### Advanced Level 🚀
- [ ] Performance optimization (`useMemo`, `useCallback`, `React.memo`)
- [ ] Build your own global state management
- [ ] Compare with Redux, Zustand, Jotai

---

## 📚 Additional Resources

### Official React Docs
- [State: A Component's Memory](https://react.dev/learn/state-a-components-memory)
- [useReducer Hook](https://react.dev/reference/react/useReducer)
- [Context API](https://react.dev/learn/passing-data-deeply-with-context)

### Great Articles
- "You Might Not Need Redux" (by Dan Abramov, Redux creator!)
- "When to useReducer vs useState"
- "React Context Performance"

---

## 💡 Eureka Moment

Here's the **BIG INSIGHT** about state management:

> **State management isn't about storing data—it's about controlling WHEN and HOW your UI updates.**

When you understand this, you realize:
- `useState` = Simple on/off switch
- `useReducer` = Complex control panel with buttons and levers
- Context = Broadcast system
- Context + useReducer = **Global control center** ← This is what we built!

---

## 🎬 Wrapping Up

You now understand:
✅ What state is and why it matters
✅ Different state management approaches
✅ When to use each approach
✅ How our GlobalDataCacheContext works (496 lines of smart state management!)
✅ Why we chose Context + useReducer
✅ How priority loading improves UX

**Most importantly**: You can now explain this architecture confidently in interviews! Practice explaining it out loud—teaching is the best way to solidify understanding.

Got questions? Review the code in `src/contexts/GlobalDataCacheContext.jsx` and trace through the flow. Add `console.log` statements in the reducer to see actions being dispatched!

Happy coding! 🚀
