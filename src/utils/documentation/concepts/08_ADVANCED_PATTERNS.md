# Advanced React Patterns - Complete Guide

> **Master advanced React patterns with real-world examples, implementation details, and interview preparation.**

---

## 🎯 Why Learn Advanced Patterns?

These patterns solve specific problems:
1. **Custom Hooks** - Share stateful logic across components
2. **Compound Components** - Build flexible, composable APIs
3. **Render Props** - Share code using a prop whose value is a function
4. **Higher-Order Components (HOCs)** - Wrap components to add functionality
5. **Refs & forwardRef** - Access child component instances/DOM
6. **Error Boundaries** - Catch errors in component tree

---

## 🧩 Pattern #1: Custom Hooks

### What They Are
Functions that use hooks and **encapsulate reusable stateful logic**. Must start with "use".

### The Problem They Solve
```jsx
// ❌ Problem: Duplicated logic across components

function ComponentA() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    setLoading(true);
    fetch('/api/users')
      .then(res => res.json())
      .then(data => setData(data))
      .catch(err => setError(err))
      .finally(() => setLoading(false));
  }, []);
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  return <div>{JSON.stringify(data)}</div>;
}

function ComponentB() {
  // Same logic repeated! 😫
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  // ...
}
```

### The Solution: Custom Hook
```jsx
// ✅ Solution: Extract into custom hook

function useFetch(url) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    let cancelled = false;
    
    setLoading(true);
    setError(null);
    
    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (!cancelled) {
          setData(data);
          setLoading(false);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err);
          setLoading(false);
        }
      });
    
    return () => {
      cancelled = true; // Cleanup: prevent state updates if unmounted
    };
  }, [url]);
  
  return { data, loading, error };
}

// Usage in components
function ComponentA() {
  const { data, loading, error } = useFetch('/api/users');
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  return <div>{JSON.stringify(data)}</div>;
}

function ComponentB() {
  const { data, loading, error } = useFetch('/api/posts');
  // Same clean interface! 🎉
}
```

### 💡 Eureka Moment #1: Custom Hooks Share Logic, Not State
```jsx
function App() {
  const users = useFetch('/api/users');  // Independent state
  const posts = useFetch('/api/posts');  // Independent state
  
  // users and posts have SEPARATE state
  // They don't share data, just the fetching LOGIC
}
```

Each call to `useFetch` creates its **own** state. Custom hooks are like functions - each call is independent.

### Your Project's Custom Hook: useGlobalDataCache
```jsx
// src/contexts/GlobalDataCacheContext.jsx

export const useGlobalDataCache = () => {
  const context = useContext(GlobalDataCacheContext);
  
  if (!context) {
    throw new Error('useGlobalDataCache must be used within GlobalDataCacheProvider');
  }
  
  return context;
};

// Usage in App.jsx
const { 
  portfolioData, 
  isLoading, 
  loadDataWithPriority 
} = useGlobalDataCache();
```

**Benefits:**
1. **Encapsulation** - Context access logic in one place
2. **Type safety** - Error if used outside provider
3. **Cleaner imports** - Don't need to import context and useContext separately

### Advanced Custom Hook: useDebounce
```jsx
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  
  return debouncedValue;
}

// Usage: Search with debouncing
function SearchBox() {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  
  useEffect(() => {
    if (debouncedSearchTerm) {
      // API call only when user stops typing for 500ms
      fetch(`/api/search?q=${debouncedSearchTerm}`);
    }
  }, [debouncedSearchTerm]);
  
  return (
    <input 
      value={searchTerm} 
      onChange={e => setSearchTerm(e.target.value)} 
    />
  );
}
```

### Advanced Custom Hook: useLocalStorage
```jsx
function useLocalStorage(key, initialValue) {
  // State to store value
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });
  
  // Return a wrapped version of useState's setter function that
  // persists the new value to localStorage
  const setValue = useCallback(value => {
    try {
      // Allow value to be a function like useState
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  }, [key, storedValue]);
  
  return [storedValue, setValue];
}

// Usage
function Settings() {
  const [theme, setTheme] = useLocalStorage('theme', 'light');
  
  return (
    <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
      Current theme: {theme}
    </button>
  );
}
```

### Custom Hook Best Practices
1. ✅ **Start with "use"** - Required for linting rules
2. ✅ **Return what consumers need** - Usually object or array
3. ✅ **Handle cleanup** - Return cleanup functions in useEffect
4. ✅ **Add error handling** - Don't let errors crash components
5. ✅ **Make dependencies clear** - Accept parameters that affect behavior
6. ✅ **Document usage** - JSDoc comments help

### Interview Questions: Custom Hooks

**Q: What is a custom hook?**
A: A JavaScript function that uses React hooks and encapsulates reusable stateful logic. Must start with "use" to follow hook rules.

**Q: How do custom hooks differ from regular functions?**
A: Custom hooks can use other hooks (useState, useEffect, etc.). Regular functions cannot. Each call to a custom hook has independent state.

**Q: Can you share state between components using custom hooks?**
A: No! Custom hooks share logic, not state. For shared state, use Context API or lifting state up.

**Q: Give an example of when you'd create a custom hook.**
A: When you have stateful logic (data fetching, form handling, timers) repeated across multiple components. Example: `useFetch`, `useForm`, `useDebounce`.

---

## 🏗️ Pattern #2: Compound Components

### What They Are
Multiple components that work together to form a cohesive UI, sharing implicit state.

### The Problem They Solve
```jsx
// ❌ Problem: Component with too many props

<Tabs 
  activeTab={0}
  onTabChange={handleChange}
  tabs={[
    { label: 'Profile', content: <Profile /> },
    { label: 'Settings', content: <Settings /> },
    { label: 'Billing', content: <Billing /> }
  ]}
/>

// Problems:
// 1. Rigid API - can't customize structure
// 2. Props explosion - needs props for every customization
// 3. Hard to add new features - requires prop updates
```

### The Solution: Compound Components
```jsx
// ✅ Solution: Flexible compound component API

<Tabs defaultTab="profile">
  <TabList>
    <Tab id="profile">Profile</Tab>
    <Tab id="settings">Settings</Tab>
    <Tab id="billing">Billing</Tab>
  </TabList>
  
  <TabPanels>
    <TabPanel id="profile"><Profile /></TabPanel>
    <TabPanel id="settings"><Settings /></TabPanel>
    <TabPanel id="billing"><Billing /></TabPanel>
  </TabPanels>
</Tabs>

// Benefits:
// 1. Flexible - can reorder, add, remove components
// 2. Composable - consumers control structure
// 3. Implicit state sharing - no prop drilling
```

### Implementation
```jsx
// Context for shared state
const TabsContext = createContext();

// Parent component - manages state
function Tabs({ children, defaultTab }) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  
  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className="tabs">{children}</div>
    </TabsContext.Provider>
  );
}

// Child components - access shared state
function TabList({ children }) {
  return <div className="tab-list">{children}</div>;
}

function Tab({ id, children }) {
  const { activeTab, setActiveTab } = useContext(TabsContext);
  const isActive = activeTab === id;
  
  return (
    <button
      className={isActive ? 'tab active' : 'tab'}
      onClick={() => setActiveTab(id)}
    >
      {children}
    </button>
  );
}

function TabPanels({ children }) {
  return <div className="tab-panels">{children}</div>;
}

function TabPanel({ id, children }) {
  const { activeTab } = useContext(TabsContext);
  
  if (activeTab !== id) return null;
  
  return <div className="tab-panel">{children}</div>;
}

// Export as compound component
Tabs.List = TabList;
Tabs.Tab = Tab;
Tabs.Panels = TabPanels;
Tabs.Panel = TabPanel;

export default Tabs;
```

### 💡 Eureka Moment #2: Compound Components = Flexible APIs
Think of HTML's `<select>` and `<option>`:
```html
<select>
  <option value="1">Option 1</option>
  <option value="2">Option 2</option>
</select>
```

You can add, remove, reorder options. Same flexibility with compound components!

### Your Project's Compound Components (Conceptual)
```jsx
// Your Gantt chart could use compound components

<GanttChart data={projects} startDate={start} endDate={end}>
  <GanttChart.Timeline />
  <GanttChart.Bars />
  <GanttChart.Milestones />
  <GanttChart.Dependencies />
</GanttChart>

// Benefits:
// - Consumer controls what to show
// - Easy to add new visualizations
// - Each component accesses shared context (dates, scale, etc.)
```

### Interview Questions: Compound Components

**Q: What are compound components?**
A: Multiple components that work together, sharing implicit state through context. They provide a flexible, composable API.

**Q: What problems do compound components solve?**
A: Avoid prop explosion, provide flexible APIs, let consumers control composition and layout.

**Q: Give an example of compound components.**
A: React's `<select>` and `<option>`, or custom examples like `<Tabs>`, `<Accordion>`, `<Menu>`.

---

## 🔄 Pattern #3: Render Props

### What It Is
A technique for **sharing code** using a prop whose value is a function.

### The Problem It Solves
```jsx
// ❌ Problem: How to share mouse position logic?

function ComponentA() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  
  useEffect(() => {
    const handleMove = (e) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, []);
  
  return <div>X: {mousePos.x}, Y: {mousePos.y}</div>;
}

function ComponentB() {
  // Same logic repeated! Need to track mouse here too 😫
}
```

### The Solution: Render Prop
```jsx
// ✅ Solution: Component with render prop

function MouseTracker({ render }) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  
  useEffect(() => {
    const handleMove = (e) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, []);
  
  return render(mousePos);  // Call the function with state
}

// Usage
function App() {
  return (
    <>
      <MouseTracker render={({ x, y }) => (
        <h1>Mouse at ({x}, {y})</h1>
      )} />
      
      <MouseTracker render={({ x, y }) => (
        <div style={{ position: 'absolute', left: x, top: y }}>
          🎯
        </div>
      )} />
    </>
  );
}
```

### Alternative: Children as Function
```jsx
// Can also use children prop
function MouseTracker({ children }) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  
  useEffect(() => {
    const handleMove = (e) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, []);
  
  return children(mousePos);
}

// Usage
<MouseTracker>
  {({ x, y }) => <h1>Mouse at ({x}, {y})</h1>}
</MouseTracker>
```

### 💡 Eureka Moment #3: Render Props vs Custom Hooks
**Modern React:** Custom hooks have largely replaced render props for sharing logic.

```jsx
// Render prop (old way, still valid)
<MouseTracker render={pos => <div>{pos.x}</div>} />

// Custom hook (modern way, cleaner)
function Component() {
  const pos = useMousePosition();
  return <div>{pos.x}</div>;
}

function useMousePosition() {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const handleMove = (e) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, []);
  return pos;
}
```

**When to still use render props:**
- Component libraries (more flexible API)
- When you need to render multiple things based on state
- When consumers need full control over rendering

### Interview Questions: Render Props

**Q: What is a render prop?**
A: A technique where a component takes a function as a prop and calls it to determine what to render. The function receives data/state from the component.

**Q: What problem does it solve?**
A: Sharing component logic without inheritance. Multiple components can reuse the same stateful logic with different rendering.

**Q: How do render props compare to custom hooks?**
A: Custom hooks are now preferred for sharing logic (cleaner, more composable). Render props still useful for component libraries and when consumers need full rendering control.

---

## 🏆 Pattern #4: Higher-Order Components (HOCs)

### What They Are
Functions that take a component and return a new component with added functionality.

### The Pattern
```jsx
// HOC signature
function withSomething(Component) {
  return function EnhancedComponent(props) {
    // Add functionality here
    return <Component {...props} />;
  };
}
```

### Example: withAuth HOC
```jsx
function withAuth(Component) {
  return function AuthenticatedComponent(props) {
    const { user, loading } = useAuth(); // Custom hook
    
    if (loading) return <div>Loading...</div>;
    if (!user) return <Redirect to="/login" />;
    
    return <Component {...props} user={user} />;
  };
}

// Usage
function Dashboard({ user }) {
  return <h1>Welcome, {user.name}!</h1>;
}

export default withAuth(Dashboard);
```

### Example: withLogging HOC
```jsx
function withLogging(Component) {
  return function LoggedComponent(props) {
    useEffect(() => {
      console.log(`${Component.name} mounted`);
      return () => console.log(`${Component.name} unmounted`);
    }, []);
    
    useEffect(() => {
      console.log(`${Component.name} props:`, props);
    }, [props]);
    
    return <Component {...props} />;
  };
}

// Usage
const MyComponentWithLogging = withLogging(MyComponent);
```

### 💡 Eureka Moment #4: HOCs vs Hooks
**HOCs are mostly replaced by hooks:**

```jsx
// Old way: HOC
function withWindowSize(Component) {
  return function(props) {
    const [size, setSize] = useState(window.innerWidth);
    useEffect(() => {
      const handleResize = () => setSize(window.innerWidth);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, []);
    return <Component {...props} windowSize={size} />;
  };
}

const MyComponent = withWindowSize(({ windowSize }) => <div>{windowSize}</div>);

// New way: Custom hook (simpler!)
function useWindowSize() {
  const [size, setSize] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setSize(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return size;
}

function MyComponent() {
  const windowSize = useWindowSize();
  return <div>{windowSize}</div>;
}
```

**When to still use HOCs:**
- Working with class components (can't use hooks)
- Third-party libraries that provide HOCs
- Adding functionality to components you don't control

### Interview Questions: HOCs

**Q: What is a Higher-Order Component?**
A: A function that takes a component and returns a new component with additional functionality. It's a pattern for reusing component logic.

**Q: Give an example of when you'd use an HOC.**
A: Adding authentication checks, logging, error boundaries, or data fetching to multiple components. Example: `withAuth`, `withRouter` (React Router).

**Q: How do HOCs compare to hooks?**
A: Hooks are now preferred (cleaner, more composable, no wrapper hell). HOCs still useful for class components and libraries.

**Q: What are the downsides of HOCs?**
A: Wrapper hell (multiple HOCs create deep nesting), prop collisions (HOCs might use same prop names), harder to debug.

---

## 🎯 Pattern #5: forwardRef & useImperativeHandle

### forwardRef: Forwarding Refs to DOM Elements
```jsx
// Without forwardRef - ref doesn't work
function TextInput({ placeholder }) {
  return <input placeholder={placeholder} />;
}

// Parent can't access the input element
function Parent() {
  const inputRef = useRef();
  
  return (
    <>
      <TextInput ref={inputRef} />  {/* ❌ Doesn't work! */}
      <button onClick={() => inputRef.current.focus()}>Focus</button>
    </>
  );
}

// With forwardRef - ref is forwarded
const TextInput = forwardRef(function TextInput({ placeholder }, ref) {
  return <input ref={ref} placeholder={placeholder} />;
});

// Now it works!
function Parent() {
  const inputRef = useRef();
  
  return (
    <>
      <TextInput ref={inputRef} />  {/* ✅ Works! */}
      <button onClick={() => inputRef.current.focus()}>Focus</button>
    </>
  );
}
```

### useImperativeHandle: Customize Ref Value
```jsx
// Expose custom API instead of raw DOM element
const FancyInput = forwardRef(function FancyInput(props, ref) {
  const inputRef = useRef();
  
  // Customize what the ref exposes
  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current.focus();
    },
    clear: () => {
      inputRef.current.value = '';
    },
    getValue: () => {
      return inputRef.current.value;
    }
  }));
  
  return <input ref={inputRef} {...props} />;
});

// Parent uses custom API
function Parent() {
  const inputRef = useRef();
  
  return (
    <>
      <FancyInput ref={inputRef} />
      <button onClick={() => inputRef.current.focus()}>Focus</button>
      <button onClick={() => inputRef.current.clear()}>Clear</button>
      <button onClick={() => alert(inputRef.current.getValue())}>Get Value</button>
    </>
  );
}
```

### 💡 Eureka Moment #5: Refs Break Encapsulation (Use Sparingly)
Refs give parent direct access to child's internals. This breaks encapsulation and React's data flow.

**Prefer:** Props and callbacks (declarative)
**Use refs only for:** Focus, scroll, animations, third-party libraries

### Interview Questions: forwardRef

**Q: What is forwardRef?**
A: A React API that lets you forward a ref through a component to a child element. Needed because ref is not a prop.

**Q: When would you use useImperativeHandle?**
A: When you want to customize what the parent component can access via ref. Example: Expose specific methods like `focus()` or `clear()` instead of the raw DOM element.

**Q: Why should you use refs sparingly?**
A: Refs break React's declarative data flow and encapsulation. Prefer props and callbacks. Use refs only for imperative actions (focus, scroll, animations).

---

## 🚨 Pattern #6: Error Boundaries

### What They Are
Components that **catch JavaScript errors** anywhere in their child component tree and display a fallback UI.

### Implementation
```jsx
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  
  static getDerivedStateFromError(error) {
    // Update state so next render shows fallback UI
    return { hasError: true, error };
  }
  
  componentDidCatch(error, errorInfo) {
    // Log error to error reporting service
    console.error('Error caught by boundary:', error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h1>Something went wrong</h1>
          <details>
            <summary>Error details</summary>
            <pre>{this.state.error.toString()}</pre>
          </details>
          <button onClick={() => this.setState({ hasError: false })}>
            Try again
          </button>
        </div>
      );
    }
    
    return this.props.children;
  }
}

// Usage
function App() {
  return (
    <ErrorBoundary>
      <ComponentThatMightError />
    </ErrorBoundary>
  );
}
```

### 💡 Eureka Moment #6: Error Boundaries Are Still Class Components
**No hooks equivalent yet!** Error boundaries must be class components because:
1. `getDerivedStateFromError` and `componentDidCatch` are lifecycle methods
2. No hook alternatives exist (as of React 18)

### What Error Boundaries Catch
✅ Errors in render methods
✅ Errors in lifecycle methods  
✅ Errors in constructors
✅ Errors in child components

### What Error Boundaries DON'T Catch
❌ Event handlers (use try/catch)
❌ Async code (use try/catch)
❌ Server-side rendering errors
❌ Errors in the error boundary itself

### Practical Usage
```jsx
// Wrap each route
function App() {
  return (
    <Router>
      <ErrorBoundary>
        <Route path="/" element={<Home />} />
      </ErrorBoundary>
      <ErrorBoundary>
        <Route path="/dashboard" element={<Dashboard />} />
      </ErrorBoundary>
    </Router>
  );
}

// Or wrap the whole app
function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes />
      </Router>
    </ErrorBoundary>
  );
}
```

### Interview Questions: Error Boundaries

**Q: What is an error boundary?**
A: A React component that catches JavaScript errors in its child component tree, logs them, and displays a fallback UI instead of crashing.

**Q: What errors do error boundaries NOT catch?**
A: Event handlers, async code (setTimeout, promises), server-side rendering, and errors in the error boundary itself.

**Q: Why are error boundaries still class components?**
A: Because `getDerivedStateFromError` and `componentDidCatch` lifecycle methods don't have hook equivalents yet.

**Q: Where should you place error boundaries?**
A: At route level (isolate page errors) or top level (catch all errors). Can have multiple for granular error handling.

---

## 🎓 Pattern Comparison Table

| Pattern | Use Case | Replaced By | Still Useful? |
|---------|----------|-------------|---------------|
| **Custom Hooks** | Share stateful logic | N/A (modern approach) | ✅ Primary pattern |
| **Compound Components** | Flexible component APIs | N/A (still great) | ✅ For libraries/reusable components |
| **Render Props** | Share logic with render control | Custom Hooks | ⚠️ Occasionally (libraries) |
| **HOCs** | Wrap components with functionality | Custom Hooks | ⚠️ Legacy code, class components |
| **forwardRef** | Forward refs to DOM | N/A (still needed) | ✅ When exposing DOM refs |
| **Error Boundaries** | Catch rendering errors | N/A (no alternative) | ✅ Essential for error handling |

---

## 🚀 Your Project Application

### Patterns You're Already Using ✅
1. **Custom Hook**: `useGlobalDataCache()` - Encapsulates context access
2. **Context + useReducer**: Global state management
3. **Lazy Loading**: Code splitting with React.lazy

### Patterns You Could Add 🔧
1. **Error Boundary**: Wrap routes to catch errors gracefully
2. **Compound Components**: Refactor Gantt chart into composable pieces
3. **Custom Hooks**: Extract repeated logic (filtering, sorting, date calculations)

### Example: Add Error Boundary to Your Project
```jsx
// src/components/ErrorBoundary.jsx
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };
  
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error, errorInfo) {
    console.error('PMO Portfolio Error:', error, errorInfo);
    // TODO: Send to error tracking service (Sentry, LogRocket, etc.)
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="error-container">
          <h1>Oops! Something went wrong</h1>
          <p>The PMO Portfolio encountered an error. Please try refreshing the page.</p>
          <button onClick={() => window.location.reload()}>Refresh Page</button>
        </div>
      );
    }
    
    return this.props.children;
  }
}

// src/App.jsx - Wrap each view
<Suspense fallback={<LoadingSpinner />}>
  <ErrorBoundary>
    {currentView === 'Portfolio' && <PortfolioGanttChart />}
  </ErrorBoundary>
  <ErrorBoundary>
    {currentView === 'Program' && <ProgramGanttChart />}
  </ErrorBoundary>
</Suspense>
```

---

## 📝 Interview Preparation Summary

### Must-Know Patterns
1. **Custom Hooks** - Your primary tool for sharing logic
2. **Compound Components** - For building flexible APIs
3. **Error Boundaries** - For production error handling

### Good-to-Know Patterns
4. **Render Props** - Legacy pattern, now replaced by hooks
5. **HOCs** - Legacy pattern, now replaced by hooks
6. **forwardRef/useImperativeHandle** - For ref forwarding (rare)

### Interview Talking Points
- "I use custom hooks extensively, like `useGlobalDataCache` in my project"
- "For flexible component APIs, compound components are great"
- "Error boundaries are essential for production apps to prevent crashes"
- "Modern React favors hooks over render props and HOCs"

---

> **Master custom hooks and error boundaries - they're essential for modern React development. The other patterns are good to know for interviews!**
