# React Hooks Deep Dive - Interview-Ready Guide

> **Master React hooks at a conceptual level with real examples from your PMO Portfolio project.**

---

## 📖 What Are Hooks? (The Paradigm Shift)

**Before Hooks (Class Components):**
```jsx
class Counter extends React.Component {
  constructor(props) {
    super(props);
    this.state = { count: 0 };
  }
  
  componentDidMount() {
    document.title = `Count: ${this.state.count}`;
  }
  
  componentDidUpdate() {
    document.title = `Count: ${this.state.count}`;
  }
  
  render() {
    return <button onClick={() => this.setState({ count: this.state.count + 1 })}>
      Count: {this.state.count}
    </button>;
  }
}
```

**After Hooks (Functional Components):**
```jsx
function Counter() {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    document.title = `Count: ${count}`;
  }, [count]);
  
  return <button onClick={() => setCount(count + 1)}>Count: {count}</button>;
}
```

### 💡 Eureka Moment #1: Hooks Let You "Hook Into" React Features
Hooks are **special functions** that let functional components access React features like:
- **State** (component memory)
- **Lifecycle** (mounting, updating, unmounting)
- **Context** (global state)
- **Refs** (persistent values, DOM access)

**Key Insight:** Hooks replaced class components because they organize logic by **what it does** (feature), not **when it runs** (lifecycle).

---

## 🔑 Core Hook #1: `useState`

### What It Does
Adds **local state** (component memory) to a functional component. When state changes, React re-renders the component.

### Syntax & Mental Model
```jsx
const [value, setValue] = useState(initialValue);
//     ↑        ↑                    ↑
//   current  updater           initial value
//   state    function          (only used on first render)
```

### Your Project Example (App.jsx)
```jsx
const [currentView, setCurrentView] = useState(null);
const [selectedPortfolioId, setSelectedPortfolioId] = useState(null);
const [selectedPortfolioName, setSelectedPortfolioName] = useState('');
```

**What's happening:** Each `useState` creates an independent piece of state. When you call `setCurrentView('Portfolio')`, React:
1. Schedules a re-render
2. On next render, `currentView` will be `'Portfolio'`
3. All JSX that depends on `currentView` updates automatically

### 💡 Eureka Moment #2: State Updates Are Asynchronous
```jsx
const [count, setCount] = useState(0);

function handleClick() {
  setCount(count + 1);
  console.log(count); // ⚠️ Still 0! State hasn't updated yet
  setCount(count + 1); // ⚠️ Still using old value (0), so count becomes 1, not 2
}
```

**Solution: Functional Updates**
```jsx
function handleClick() {
  setCount(prev => prev + 1); // Uses latest state
  setCount(prev => prev + 1); // Now count will be 2
}
```

### Interview Questions: useState
**Q: Why use functional updates?**
A: When new state depends on previous state, functional updates guarantee you're using the latest value (because React batches state updates).

**Q: Can you call useState conditionally?**
A: No! Hooks must be called in the same order on every render. This is a core rule.

**Q: How does React know which state belongs to which useState call?**
A: React relies on the **order of hook calls**. It maintains an internal array of state values and matches them by position.

---

## 🔑 Core Hook #2: `useEffect`

### What It Does
Runs **side effects** after React has updated the DOM. Side effects are anything that interacts with the outside world:
- Data fetching
- Subscriptions (WebSocket, event listeners)
- Timers (setTimeout, setInterval)
- Manual DOM manipulation
- Logging

### Syntax & Mental Model
```jsx
useEffect(() => {
  // Effect code (runs AFTER render)
  
  return () => {
    // Cleanup code (runs BEFORE next effect or unmount)
  };
}, [dependencies]);
//   ↑
// When to re-run this effect
```

### Your Project Example (App.jsx)
```jsx
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
}, []); // Empty array = run once on mount
```

**What's happening:**
1. Component renders with initial state
2. React updates the DOM
3. useEffect runs the validation
4. When validation completes, it calls `setDataValidation`
5. This triggers a re-render with new validation state

### Dependency Array Deep Dive

| Dependency Array | When Effect Runs | Use Case |
|-----------------|------------------|----------|
| `undefined` | After every render | Rare, usually a bug |
| `[]` | Once on mount | Data fetching, subscriptions |
| `[a, b]` | When `a` or `b` changes | Update based on props/state |

### 💡 Eureka Moment #3: Effects Run AFTER Render
```jsx
function Example() {
  const [count, setCount] = useState(0);
  
  console.log('1. Render phase');
  
  useEffect(() => {
    console.log('3. Effect phase (after DOM update)');
  });
  
  console.log('2. Still render phase');
  
  return <div>{count}</div>;
}

// Output:
// 1. Render phase
// 2. Still render phase
// 3. Effect phase (after DOM update)
```

**Why this matters:** You can't rely on side effects during render. React needs to finish rendering before running effects.

### Cleanup Functions
```jsx
useEffect(() => {
  const interval = setInterval(() => {
    console.log('Tick');
  }, 1000);
  
  return () => {
    clearInterval(interval); // Cleanup when component unmounts
  };
}, []);
```

**When cleanup runs:**
- Before running the effect again (if dependencies changed)
- When component unmounts

### Interview Questions: useEffect
**Q: What happens if you don't include a dependency in the array?**
A: You'll get a stale closure - the effect will use the old value from when it was first created. This is a common bug!

**Q: Why do you need cleanup functions?**
A: To prevent memory leaks. If you set up subscriptions, event listeners, or timers without cleaning them up, they'll keep running even after the component unmounts.

**Q: Can you use async/await directly in useEffect?**
A: No! useEffect expects either nothing or a cleanup function. Create an async function inside the effect:
```jsx
useEffect(() => {
  const fetchData = async () => {
    const data = await fetch('/api');
  };
  fetchData();
}, []);
```

---

## 🔑 Core Hook #3: `useCallback`

### What It Does
Returns a **memoized function** - same reference across renders unless dependencies change.
useCallback is a React Hook that remembers a function between renders.

### Why It Exists
```jsx
function Parent() {
  const [count, setCount] = useState(0);
  
  // ⚠️ Problem: New function created on EVERY render
  const handleClick = () => {
    console.log('Clicked');
  };
  
  return <ExpensiveChild onClick={handleClick} />;
}

// ExpensiveChild re-renders even if count changed (not onClick)
// because handleClick is a new reference every time
```

**Solution with useCallback:**
```jsx
function Parent() {
  const [count, setCount] = useState(0);
  
  // ✅ Same function reference unless dependencies change
  const handleClick = useCallback(() => {
    console.log('Clicked');
  }, []); // No dependencies = never changes
  
  return <ExpensiveChild onClick={handleClick} />;
}
```

### Your Project Example (App.jsx)
```jsx
const handleViewSelection = useCallback((viewName) => {
  setCurrentView(viewName);
  loadDataWithPriority(viewName);
}, [loadDataWithPriority]);
```

**What's happening:** `handleViewSelection` is passed to `WelcomePage`. Without `useCallback`, every time `App` re-renders (even for unrelated state changes), `WelcomePage` would re-render because it receives a "new" function. With `useCallback`, the function reference stays the same.

### 💡 Eureka Moment #4: Functions Are Objects in JavaScript
```jsx
const fn1 = () => {};
const fn2 = () => {};

console.log(fn1 === fn2); // false! Different references
```

React uses **referential equality** (`===`) to check if props changed. New function reference = prop changed = re-render.

### Interview Questions: useCallback
**Q: When should you use useCallback?**
A: 
1. Passing callbacks to optimized child components (wrapped in `React.memo`)
2. When a function is a dependency in `useEffect`
3. When creating event handlers in lists (to prevent re-renders)

**Q: Does useCallback improve performance by default?**
A: No! It only helps when combined with `React.memo` or in `useEffect` dependencies. Otherwise, you're adding overhead for no benefit.

**Q: What's the difference between useCallback and useMemo?**
A:
- `useCallback(fn, deps)` = memoize the **function itself**
- `useMemo(() => fn, deps)` = memoize the **result of calling the function**

---

## 🔑 Core Hook #4: `useMemo`

### What It Does
Returns a **memoized value** - only recalculates when dependencies change.

### Why It Exists
```jsx
function ProductList({ products }) {
  // ⚠️ Problem: Expensive calculation runs on EVERY render
  const sortedProducts = products.sort((a, b) => b.price - a.price);
  
  return <div>{sortedProducts.map(p => <div>{p.name}</div>)}</div>;
}
```

**Solution with useMemo:**
```jsx
function ProductList({ products }) {
  // ✅ Only recalculates when products changes
  const sortedProducts = useMemo(() => {
    return products.sort((a, b) => b.price - a.price);
  }, [products]);
  
  return <div>{sortedProducts.map(p => <div>{p.name}</div>)}</div>;
}
```

### Your Project Example (Conceptual - GanttBar.jsx)
```jsx
// Hypothetical example from your Gantt chart
const barWidth = useMemo(() => {
  const start = new Date(project.startDate);
  const end = new Date(project.endDate);
  const days = (end - start) / (1000 * 60 * 60 * 24);
  return days * pixelsPerDay;
}, [project.startDate, project.endDate, pixelsPerDay]);
```

### 💡 Eureka Moment #5: Memoization is a Trade-off
**Without useMemo:**
- Pros: Simpler code
- Cons: Recalculates every render

**With useMemo:**
- Pros: Skips expensive calculations
- Cons: Uses more memory, adds complexity

**Rule of thumb:** Only use `useMemo` when:
1. The calculation is expensive (profiling shows it)
2. The value is used in a child component's props (referential equality)

### Interview Questions: useMemo
**Q: When should you use useMemo?**
A:
1. Expensive calculations (filtering, sorting large arrays)
2. Preventing referential inequality (passing objects/arrays to `React.memo` children)
3. As a performance optimization after profiling

**Q: Can you use useMemo for side effects?**
A: No! Use `useEffect` for side effects. `useMemo` is for computing values.

---

## 🔑 Core Hook #5: `useRef`

### What It Does
Creates a **mutable container** that persists across renders but doesn't trigger re-renders when changed.

### Two Use Cases

#### 1. Accessing DOM Elements
```jsx
function TextInput() {
  const inputRef = useRef(null);
  
  const focusInput = () => {
    inputRef.current.focus(); // Direct DOM access
  };
  
  return (
    <>
      <input ref={inputRef} />
      <button onClick={focusInput}>Focus</button>
    </>
  );
}
```

#### 2. Storing Mutable Values
```jsx
function Timer() {
  const [count, setCount] = useState(0);
  const intervalRef = useRef(null);
  
  const startTimer = () => {
    intervalRef.current = setInterval(() => {
      setCount(c => c + 1);
    }, 1000);
  };
  
  const stopTimer = () => {
    clearInterval(intervalRef.current);
  };
  
  return <div>{count}</div>;
}
🧠 So useRef has two main uses

1️⃣ Access DOM elements	
Get or manipulate a specific element	
example: Focus an input, scroll to a div
2️⃣ Persist values	
Store data that shouldn’t trigger re-renders	
example: Track previous value, timer ID, count, etc.
```

### Your Project Example (GlobalDataCacheContext.jsx)
```jsx
const hasFetchedRef = useRef(false);

useEffect(() => {
  if (!hasFetchedRef.current) {
    loadDataWithPriority(priorityView);
    hasFetchedRef.current = true;
  }
}, []);
```

**What's happening:** The ref prevents double-fetching in development mode (React's StrictMode runs effects twice). State would cause a re-render; ref doesn't.

### 💡 Eureka Moment #6: Ref vs State
| `useRef` | `useState` |
|----------|-----------|
| Doesn't trigger re-render | Triggers re-render |
| Mutable (.current) | Immutable (use setter) |
| Synchronous updates | Asynchronous updates |
| Use for DOM access, timers | Use for UI state |

### Interview Questions: useRef
**Q: When would you use useRef instead of useState?**
A: When you need to store a value that:
1. Persists across renders
2. Changes but shouldn't trigger a re-render
3. Needs to be accessed synchronously

**Q: Can you read/write ref.current during render?**
A: Writing during render is an anti-pattern (side effect). Reading is okay but rare. Use state for values needed in render.

---

## 🔑 Core Hook #6: `useReducer`

### What It Does
Manages **complex state** with actions (like Redux, but local to a component).

### When to Use Over useState
- State has multiple sub-values
- State logic is complex (many updates in one action)
- Next state depends on previous state
- You want predictable state transitions

### Syntax & Mental Model
```jsx
const [state, dispatch] = useReducer(reducer, initialState);
//     ↑        ↑             ↑            ↑
//   current  function      pure         initial
//   state    to update     function     value
//            state         (state,action)=>newState
```

### Your Project Example (GlobalDataCacheContext.jsx)
```jsx
// Define action types
const ACTIONS = {
  START_LOADING: 'START_LOADING',
  SET_PORTFOLIO_DATA: 'SET_PORTFOLIO_DATA',
  SET_ERROR: 'SET_ERROR',
};

// Define initial state
const initialState = {
  portfolioData: null,
  isLoading: false,
  error: null,
};

// Define reducer function
function dataReducer(state, action) {
  switch (action.type) {
    case ACTIONS.START_LOADING:
      return {
        ...state,
        isLoading: true,
        error: null,
      };
      
    case ACTIONS.SET_PORTFOLIO_DATA:
      return {
        ...state,
        portfolioData: action.payload,
        isLoading: false,
      };
      
    case ACTIONS.SET_ERROR:
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };
      
    default:
      return state;
  }
}

// Use in component
function MyComponent() {
  const [state, dispatch] = useReducer(dataReducer, initialState);
  
  // Dispatch actions
  dispatch({ type: ACTIONS.START_LOADING });
  dispatch({ type: ACTIONS.SET_PORTFOLIO_DATA, payload: data });
}
```

### 💡 Eureka Moment #7: Dispatch Describes "What Happened"
Instead of imperatively updating state:
```jsx
// Imperative (useState)
setIsLoading(true);
setError(null);
setData(fetchedData);
setIsLoading(false);
```

You declare what happened:
```jsx
// Declarative (useReducer)
dispatch({ type: 'FETCH_SUCCESS', payload: fetchedData });
```

The reducer decides how state changes. This makes state transitions **predictable and testable**.

### Interview Questions: useReducer
**Q: When would you use useReducer over useState?**
A: 
1. Complex state logic (multiple sub-values)
2. State updates involve multiple steps
3. Need to pass dispatch down (more stable than multiple setters)
4. State transitions are predictable and testable

**Q: What's the difference between useReducer and Redux?**
A:
- **useReducer:** Local to component/context, simpler, no middleware
- **Redux:** Global, dev tools, middleware, time-travel debugging

**Q: Can you have async logic in a reducer?**
A: No! Reducers must be **pure functions**. Put async logic outside (in the component or custom hook) and dispatch actions with results.

---

## 🔑 Core Hook #7: `useContext`

### What It Does
Accesses **global state** provided by a Context Provider (solves prop drilling).

### The Problem: Prop Drilling
```jsx
function App() {
  const [user, setUser] = useState(null);
  return <Parent user={user} />;
}

function Parent({ user }) {
  return <Child user={user} />; // Just passing through
}

function Child({ user }) {
  return <GrandChild user={user} />; // Still passing through
}

function GrandChild({ user }) {
  return <div>{user.name}</div>; // Finally used!
}
```

### The Solution: Context API
```jsx
// 1. Create context
const UserContext = createContext(null);

// 2. Provide value at top level
function App() {
  const [user, setUser] = useState(null);
  return (
    <UserContext.Provider value={user}>
      <Parent />
    </UserContext.Provider>
  );
}

// 3. Consume anywhere in the tree
function GrandChild() {
  const user = useContext(UserContext);
  return <div>{user.name}</div>;
}


```
useState is just a React hook — it comes from the React library itself.

So when you write:

import { useState } from "react";

You’re importing React’s built-in state management hook.

Then you can use it like this:
const [user, setUser] = useState(null);

user → is your state variable (it holds data, starts as null).
setUser → is the function to update that data.

So when you later call setUser({ name: "Lavanya" }),
user becomes { name: "Lavanya" } and the component re-renders.

💭 2. Why do we use useState with Context?

We don’t have to — but they are often used together because they solve different problems:
Hook	Purpose
useState	To store data (e.g., user, theme, language) inside one component
useContext	To share that data across many components without prop drilling

So:
useState → creates and controls the data
Context → shares that data anywhere it’s needed

### Your Project Example (GlobalDataCacheContext.jsx)
```jsx
// 1. Create context
const GlobalDataCacheContext = createContext(null);

// 2. Custom hook for convenience
export function useGlobalDataCache() {
  const context = useContext(GlobalDataCacheContext);
  if (!context) {
    throw new Error('useGlobalDataCache must be used within GlobalDataCacheProvider');
  }
  return context;
}

// 3. Provider component
export function GlobalDataCacheProvider({ children }) {
  const [state, dispatch] = useReducer(dataReducer, initialState);
  
  const value = {
    portfolioData: state.portfolioData,
    isLoading: state.isLoading,
    loadDataWithPriority,
    // ... other values and functions
  };
  
  return (
    <GlobalDataCacheContext.Provider value={value}>
      {children}
    </GlobalDataCacheContext.Provider>
  );
}

// 4. Use in any component
function App() {
  const { portfolioData, isLoading } = useGlobalDataCache();
  // ...
}
```

### 💡 Eureka Moment #8: Context + useReducer = Lightweight Redux
Combining `useContext` and `useReducer` gives you:
- **Global state** (via context)
- **Predictable updates** (via reducer)
- **No external library** (built into React)

This is exactly what your `GlobalDataCacheContext` does!

### Interview Questions: useContext
**Q: When should you use Context API?**
A:
1. Theme (dark mode, colors)
2. User authentication
3. Language/localization
4. Global caches (like your project)

**Q: What's the performance concern with Context?**
A: When context value changes, **all consumers re-render**. Solutions:
1. Split contexts by concern
2. Use `React.memo` on consumers
3. Pass stable references (useCallback, useMemo)

**Q: Can you have multiple contexts?**
A: Yes! Nest providers:
```jsx
<UserContext.Provider>
  <ThemeContext.Provider>
    <DataContext.Provider>
      <App />
    </DataContext.Provider>
  </ThemeContext.Provider>
</UserContext.Provider>
```

---

## 🎯 Rules of Hooks (Critical for Interviews!)

### Rule #1: Only Call Hooks at the Top Level
```jsx
// ❌ Bad: Conditional hook
function Component({ condition }) {
  if (condition) {
    const [value, setValue] = useState(0); // Error!
  }
}

// ✅ Good: Hook always called
function Component({ condition }) {
  const [value, setValue] = useState(0);
  if (condition) {
    // Use the value conditionally
  }
}
```

**Why?** React relies on the **order** of hook calls to match state. Conditional hooks break this order.

### Rule #2: Only Call Hooks from React Functions
```jsx
// ❌ Bad: Hook in regular function
function helperFunction() {
  const [value, setValue] = useState(0); // Error!
}

// ✅ Good: Hook in React component
function MyComponent() {
  const [value, setValue] = useState(0);
}

// ✅ Good: Hook in custom hook
function useCustomHook() {
  const [value, setValue] = useState(0);
  return value;
}
```

---

## 🚀 Custom Hooks (Reusable Logic)

### What They Are
Functions that use hooks and encapsulate reusable logic. **Must start with "use"**.

### Example: Custom Fetch Hook
```jsx
function useFetch(url) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    setLoading(true);
    fetch(url)
      .then(res => res.json())
      .then(data => {
        setData(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err);
        setLoading(false);
      });
  }, [url]);
  
  return { data, loading, error };
}

// Usage
function MyComponent() {
  const { data, loading, error } = useFetch('/api/users');
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  return <div>{data.map(user => <div>{user.name}</div>)}</div>;
}
```

### Your Project's Custom Hook
```jsx
export function useGlobalDataCache() {
  const context = useContext(GlobalDataCacheContext);
  if (!context) {
    throw new Error('useGlobalDataCache must be used within GlobalDataCacheProvider');
  }
  return context;
}
```

This encapsulates context access and error handling!

---

## 📝 Interview Cheat Sheet

### useState
- **Use:** Local component state
- **Gotcha:** Updates are async and batched
- **Tip:** Use functional updates when new state depends on old

### useEffect
- **Use:** Side effects (data fetching, subscriptions)
- **Gotcha:** Stale closures if dependencies are wrong
- **Tip:** Always clean up subscriptions

### useCallback
- **Use:** Memoize functions for child components or effect deps
- **Gotcha:** Doesn't help unless child is memoized
- **Tip:** Don't overuse - premature optimization

### useMemo
- **Use:** Memoize expensive calculations
- **Gotcha:** Adds overhead, only optimize when needed
- **Tip:** Profile first, optimize second

### useRef
- **Use:** DOM access, mutable values that don't trigger renders
- **Gotcha:** Don't write to .current during render
- **Tip:** Use for timers, intervals, previous values

### useReducer
- **Use:** Complex state logic with multiple sub-values
- **Gotcha:** Reducers must be pure functions
- **Tip:** Dispatch describes "what happened", reducer decides "how state changes"

### useContext
- **Use:** Access global state without prop drilling
- **Gotcha:** All consumers re-render on value change
- **Tip:** Combine with useReducer for scalable state management

---

## 🎓 Final Takeaways

1. **Hooks organize logic by feature, not lifecycle**
2. **State updates are async; effects run after render**
3. **Memoization prevents unnecessary work**
4. **Refs persist without re-rendering**
5. **Reducers make state transitions predictable**
6. **Context eliminates prop drilling**
7. **Custom hooks encapsulate reusable logic**

---

> **Next Steps:** Study your `GlobalDataCacheContext.jsx` to see hooks in action. Trace how `useReducer` + `useContext` create a global state management system!
