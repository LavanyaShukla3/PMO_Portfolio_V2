# Performance Optimization in React - Complete Guide

> **Learn how to identify, measure, and fix performance bottlenecks in React applications.**

---

## 🎯 The Performance Mindset

### 💡 Eureka Moment #1: React is Already Fast
React's Virtual DOM and reconciliation algorithm are highly optimized. **Most apps don't need additional optimization**. The golden rule:

> **"Premature optimization is the root of all evil" - Donald Knuth**

**When to optimize:**
1. ✅ **After** you have a measurable performance problem
2. ✅ **After** profiling shows where the bottleneck is
3. ✅ When rendering large lists (100+ items)
4. ✅ When passing callbacks to frequently re-rendering children

**When NOT to optimize:**
1. ❌ Before you have proof of a problem
2. ❌ Based on assumptions without profiling
3. ❌ By adding complexity "just in case"

---

## 📊 Step 1: Measure First, Optimize Second

### Using React DevTools Profiler

**How to profile:**
1. Install React DevTools browser extension
2. Open DevTools → Profiler tab
3. Click record (●) button
4. Interact with your app
5. Stop recording
6. Analyze the flame graph

**What to look for:**
- **Yellow/red components** = slow renders
- **Tall bars** = many nested re-renders
- **Wide bars** = long render time
- **Frequent re-renders** = unnecessary updates

### Your Project Example
```jsx
// Profile the PortfolioGanttChart page
// 1. Navigate to Portfolio view
// 2. Start profiler
// 3. Change filters, paginate
// 4. Check which components re-render and why
```

**Common findings:**
- Entire page re-renders when only filter changed
- Child components re-render even though props didn't change
- Expensive calculations run on every render

---

## 🚀 Optimization Technique #1: React.memo

### What It Does
**Prevents re-renders** when props haven't changed (shallow comparison).

### The Problem
```jsx
function Parent() {
  const [count, setCount] = useState(0);
  const [name, setName] = useState('John');
  
  return (
    <>
      <button onClick={() => setCount(count + 1)}>Count: {count}</button>
      <ExpensiveChild name={name} />  {/* Re-renders even when name didn't change! */}
    </>
  );
}

function ExpensiveChild({ name }) {
  console.log('ExpensiveChild rendered');
  // Imagine expensive computation here
  return <div>{name}</div>;
}
```

**Problem:** When `count` changes, `Parent` re-renders, which causes `ExpensiveChild` to re-render **even though `name` didn't change**.

### The Solution
```jsx
// Wrap component in React.memo
const ExpensiveChild = React.memo(function ExpensiveChild({ name }) {
  console.log('ExpensiveChild rendered');
  return <div>{name}</div>;
});

// Now ExpensiveChild only re-renders when `name` prop changes
```

### 💡 Eureka Moment #2: Props Comparison is Shallow
```jsx
const ExpensiveChild = React.memo(function ExpensiveChild({ user, onClick }) {
  return <div onClick={onClick}>{user.name}</div>;
});

function Parent() {
  const user = { name: 'John' }; // ⚠️ New object every render
  const handleClick = () => {};   // ⚠️ New function every render
  
  return <ExpensiveChild user={user} onClick={handleClick} />;
  // ExpensiveChild re-renders because user and onClick are NEW references!
}
```

**Key Insight:** `React.memo` uses `===` (referential equality) to compare props.
- Primitives (string, number, boolean) are compared by value ✅
- Objects, arrays, functions are compared by reference ⚠️

**Solution:** Combine with `useMemo` and `useCallback`.

### Your Project Example
```jsx
// GanttBar.jsx - wrap in React.memo
const GanttBar = React.memo(function GanttBar({ 
  project, 
  startDate, 
  endDate, 
  onBarClick 
}) {
  // Only re-renders when props actually change
  return <div className="gantt-bar">...</div>;
});
```

### Interview Questions: React.memo
**Q: When should you use React.memo?**
A:
1. Component renders often with the same props
2. Component's render is expensive
3. Component is in a list
4. Parent re-renders frequently for unrelated reasons

**Q: Does React.memo work with children prop?**
A: Yes, but `children` is a prop like any other. If `children` is created inline (JSX), it's a new reference every time.

**Q: Can you customize the comparison?**
A: Yes! Pass a custom comparison function:
```jsx
const MyComponent = React.memo(
  function MyComponent(props) { ... },
  (prevProps, nextProps) => {
    // Return true if props are equal (skip re-render)
    return prevProps.id === nextProps.id;
  }
);
```

---

## 🚀 Optimization Technique #2: useMemo

### What It Does
**Memoizes computed values** - only recalculates when dependencies change.

### The Problem
```jsx
function ProductList({ products, category }) {
  // ⚠️ Filters and sorts on EVERY render (even when products didn't change)
  const filteredProducts = products
    .filter(p => p.category === category)
    .sort((a, b) => b.price - a.price);
  
  return <div>{filteredProducts.map(p => <ProductCard product={p} />)}</div>;
}
```

**Problem:** If `ProductList` re-renders (parent re-rendered, unrelated state changed), the filtering and sorting runs again unnecessarily.

### The Solution
```jsx
function ProductList({ products, category }) {
  // ✅ Only recalculates when products or category changes
  const filteredProducts = useMemo(() => {
    console.log('Filtering and sorting products...');
    return products
      .filter(p => p.category === category)
      .sort((a, b) => b.price - a.price);
  }, [products, category]);
  
  return <div>{filteredProducts.map(p => <ProductCard product={p} />)}</div>;
}
```

### Your Project Example (Conceptual)
```jsx
// PortfolioGanttChart.jsx - memoize filtered data
function PortfolioGanttChart({ portfolioData, filters }) {
  const filteredProjects = useMemo(() => {
    let result = portfolioData.projects;
    
    if (filters.status) {
      result = result.filter(p => p.status === filters.status);
    }
    
    if (filters.region) {
      result = result.filter(p => p.region === filters.region);
    }
    
    return result;
  }, [portfolioData.projects, filters.status, filters.region]);
  
  return (
    <div>
      {filteredProjects.map(project => (
        <GanttBar key={project.id} project={project} />
      ))}
    </div>
  );
}
```

### 💡 Eureka Moment #3: useMemo Prevents Referential Inequality
```jsx
function Parent() {
  // ⚠️ Without useMemo: new array reference every render
  const items = [1, 2, 3].map(n => n * 2);
  
  return <MemoizedChild items={items} />;
  // MemoizedChild re-renders because items is a new reference!
}

function Parent() {
  // ✅ With useMemo: same array reference unless dependencies change
  const items = useMemo(() => [1, 2, 3].map(n => n * 2), []);
  
  return <MemoizedChild items={items} />;
  // MemoizedChild doesn't re-render (items reference is stable)
}
```

### When to Use useMemo
| Scenario | Use useMemo? |
|----------|-------------|
| Expensive calculation (loops, filtering, sorting) | ✅ Yes |
| Passing objects/arrays to React.memo components | ✅ Yes |
| Simple arithmetic (2 + 2) | ❌ No (overhead > benefit) |
| Creating JSX | ❌ No (React is already fast at this) |

### Interview Questions: useMemo
**Q: What's the difference between useMemo and useCallback?**
A:
- `useMemo(() => value, deps)` - memoizes the **return value**
- `useCallback(fn, deps)` - memoizes the **function itself**
- `useCallback(fn, deps)` = `useMemo(() => fn, deps)`

**Q: Can you use useMemo for side effects?**
A: No! `useMemo` runs during render (must be pure). Use `useEffect` for side effects.

**Q: How do you decide if a calculation is "expensive"?**
A: Profile it! If the calculation takes >5ms, consider memoizing. Use `console.time`:
```jsx
console.time('calculation');
const result = expensiveFunction();
console.timeEnd('calculation'); // "calculation: 15.2ms"
```

---

## 🚀 Optimization Technique #3: useCallback

### What It Does
**Memoizes functions** - returns same function reference unless dependencies change.

### The Problem
```jsx
function Parent() {
  const [count, setCount] = useState(0);
  
  // ⚠️ New function created on every render
  const handleClick = () => {
    console.log('Clicked');
  };
  
  return (
    <>
      <button onClick={() => setCount(count + 1)}>Count: {count}</button>
      <MemoizedChild onClick={handleClick} />
      {/* MemoizedChild re-renders because handleClick is a new reference! */}
    </>
  );
}

const MemoizedChild = React.memo(function MemoizedChild({ onClick }) {
  console.log('MemoizedChild rendered');
  return <button onClick={onClick}>Click me</button>;
});
```

### The Solution
```jsx
function Parent() {
  const [count, setCount] = useState(0);
  
  // ✅ Same function reference across renders
  const handleClick = useCallback(() => {
    console.log('Clicked');
  }, []); // No dependencies = never changes
  
  return (
    <>
      <button onClick={() => setCount(count + 1)}>Count: {count}</button>
      <MemoizedChild onClick={handleClick} />
      {/* MemoizedChild doesn't re-render (onClick reference is stable) */}
    </>
  );
}
```

### Your Project Example (App.jsx)
```jsx
const handleViewSelection = useCallback((viewName) => {
  setCurrentView(viewName);
  loadDataWithPriority(viewName);
}, [loadDataWithPriority]);

// Pass to WelcomePage
<WelcomePage onSelectView={handleViewSelection} />

// WelcomePage doesn't re-render unnecessarily because handleViewSelection is stable
```

### 💡 Eureka Moment #4: useCallback Needs React.memo to Work
```jsx
// ❌ useCallback alone doesn't help
function Parent() {
  const handleClick = useCallback(() => {}, []);
  return <Child onClick={handleClick} />; // Child still re-renders with Parent
}

// ✅ useCallback + React.memo works together
const Child = React.memo(function Child({ onClick }) {
  return <button onClick={onClick}>Click</button>;
});

function Parent() {
  const handleClick = useCallback(() => {}, []);
  return <Child onClick={handleClick} />; // Child skips re-render
}
```

### useCallback in useEffect Dependencies
```jsx
function Component({ id }) {
  // ⚠️ Without useCallback: infinite loop!
  const fetchData = () => {
    fetch(`/api/data/${id}`).then(...);
  };
  
  useEffect(() => {
    fetchData();
  }, [fetchData]); // fetchData changes every render → effect runs every render → re-render → ...
  
  // ✅ With useCallback: stable reference
  const fetchData = useCallback(() => {
    fetch(`/api/data/${id}`).then(...);
  }, [id]); // Only changes when id changes
  
  useEffect(() => {
    fetchData();
  }, [fetchData]); // Effect only runs when id changes
}
```

### Interview Questions: useCallback
**Q: When do you need useCallback?**
A:
1. Passing callbacks to memoized child components
2. Using functions in useEffect dependencies
3. Passing callbacks to custom hooks that depend on them

**Q: Does useCallback improve performance in event handlers?**
A: Not usually. Event handlers don't cause re-renders unless you're passing them as props to memoized children.

---

## 🚀 Optimization Technique #4: Code Splitting & Lazy Loading

### What It Does
**Splits your bundle** into smaller chunks that load on-demand.

### The Problem
```jsx
// ⚠️ All pages bundled together
import WelcomePage from './pages/WelcomePage';
import PortfolioGanttChart from './pages/PortfolioGanttChart';
import ProgramGanttChart from './pages/ProgramGanttChart';
import SubProgramGanttChart from './pages/SubProgramGanttChartFull';
import RegionRoadMap from './pages/RegionRoadMap';

// Initial bundle: 500KB (includes all pages user might never visit)
```

### The Solution
```jsx
// ✅ Lazy load pages
import { lazy, Suspense } from 'react';

const PortfolioGanttChart = lazy(() => import('./pages/PortfolioGanttChart'));
const ProgramGanttChart = lazy(() => import('./pages/ProgramGanttChart'));
const SubProgramGanttChart = lazy(() => import('./pages/SubProgramGanttChartFull'));
const RegionRoadMap = lazy(() => import('./pages/RegionRoadMap'));

// Initial bundle: 100KB (only WelcomePage)
// Other pages load when user navigates to them
```
Normally, when you import a component like this:

import MyComponent from './MyComponent';

👉 React loads it immediately when the app starts —
even if the user never visits that page or section.

### Your Project Example (App.jsx)
```jsx
// Lazy load ALL page components
const PortfolioGanttChart = lazy(() => import('./pages/PortfolioGanttChart'));
const ProgramGanttChart = lazy(() => import('./pages/ProgramGanttChart'));
const SubProgramGanttChart = lazy(() => import('./pages/SubProgramGanttChartFull'));
const RegionRoadMap = lazy(() => import('./pages/RegionRoadMap'));

// Wrap in Suspense
<Suspense fallback={<LoadingSpinner />}>
  {currentView === 'Portfolio' && <PortfolioGanttChart />}
  {currentView === 'Program' && <ProgramGanttChart />}
  {currentView === 'SubProgram' && <SubProgramGanttChart />}
  {currentView === 'Region' && <RegionRoadMap />}
</Suspense>
```

### 💡 Eureka Moment #5: Lazy Loading = Faster Initial Load
**Without lazy loading:**
- Initial load: 500KB → 3 seconds
- User waits 3 seconds before seeing anything

**With lazy loading:**
- Initial load: 100KB → 0.5 seconds
- User sees welcome page in 0.5 seconds
- Portfolio page loads in background when needed

### Interview Questions: Code Splitting
**Q: How does React.lazy work?**
A: It returns a component that dynamically imports a module. React suspends rendering until the module loads, showing the Suspense fallback.

**Q: Can you use lazy loading with named exports?**
A: No, `lazy()` only works with default exports. Workaround:
```jsx
// Component.js
export function MyComponent() { ... }

// Intermediate file
export { MyComponent as default } from './Component';

// App.js
const MyComponent = lazy(() => import('./Intermediate'));
```

**Q: When should you use code splitting?**
A:
1. Route-based splitting (different pages)
2. Feature-based splitting (modals, rarely-used features)
3. Large libraries (charts, editors) used in specific components

---

## 🚀 Optimization Technique #5: Efficient List Rendering

### Keys in Lists
```jsx
// ❌ Bad: Index as key (causes bugs with reordering, deletions)
{items.map((item, index) => (
  <div key={index}>{item.name}</div>
))}

// ✅ Good: Stable unique ID as key
{items.map(item => (
  <div key={item.id}>{item.name}</div>
))}
```

### 💡 Eureka Moment #6: Keys Help React Identify Changes
When list items are reordered:
- **Without keys:** React re-renders all items
- **With index keys:** React gets confused (wrong items update)
- **With unique ID keys:** React knows which item moved (minimal re-renders)

### Windowing for Large Lists
For 1000+ items, use **virtualization** (only render visible items):

```jsx
// Without virtualization: renders all 10,000 items
{data.map(item => <Row key={item.id} data={item} />)}

// With virtualization: renders only ~20 visible items
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={data.length}
  itemSize={35}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      <Row data={data[index]} />
    </div>
  )}
</FixedSizeList>
```

**Libraries:**
- `react-window` - lightweight, modern
- `react-virtualized` - feature-rich, larger

### Your Project Application
```jsx
// If you have 500+ Gantt bars, consider windowing
// Only render visible bars in the scroll viewport
```

---

## 🚀 Optimization Technique #6: Debouncing & Throttling

### Debouncing (Wait for User to Stop)
```jsx
function SearchBox() {
  const [query, setQuery] = useState('');
  
  // ⚠️ Without debouncing: API call on every keystroke
  useEffect(() => {
    fetch(`/api/search?q=${query}`);
  }, [query]);
  
  return <input value={query} onChange={e => setQuery(e.target.value)} />;
}

// ✅ With debouncing: API call after user stops typing (500ms)
function SearchBox() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 500);
    
    return () => clearTimeout(timer); // Cleanup
  }, [query]);
  
  useEffect(() => {
    if (debouncedQuery) {
      fetch(`/api/search?q=${debouncedQuery}`);
    }
  }, [debouncedQuery]);
  
  return <input value={query} onChange={e => setQuery(e.target.value)} />;
}
```

### Throttling (Limit Frequency)
```jsx
// For scroll events, resize events
function useThrottle(value, delay) {
  const [throttledValue, setThrottledValue] = useState(value);
  const lastRan = useRef(Date.now());
  
  useEffect(() => {
    const handler = setTimeout(() => {
      if (Date.now() - lastRan.current >= delay) {
        setThrottledValue(value);
        lastRan.current = Date.now();
      }
    }, delay - (Date.now() - lastRan.current));
    
    return () => clearTimeout(handler);
  }, [value, delay]);
  
  return throttledValue;
}
```

---

## 🚀 Optimization Technique #7: Background Loading

### Your Project's Brilliant Pattern
```jsx
// GlobalDataCacheContext.jsx - Priority-based loading
async function loadDataWithPriority(priorityView) {
  // PHASE 1: Load priority view data first (Portfolio, Program, etc.)
  const priorityData = await fetchPriorityData(priorityView);
  dispatch({ type: 'SET_DATA', payload: priorityData });
  // ✅ UI shows immediately
  
  // PHASE 2: Load remaining data in background
  Promise.all([
    fetchPortfolioData(),
    fetchProgramData(),
    fetchSubProgramData(),
    fetchRegionData()
  ]).then(results => {
    // Update cache in background
  });
}
```

**Benefit:** User sees UI in 500ms (priority data), while non-critical data loads in background.

---

## 📊 Performance Checklist

### Measurement
- [ ] Profile with React DevTools before optimizing
- [ ] Use `console.time()` for expensive calculations
- [ ] Check bundle size (webpack-bundle-analyzer)
- [ ] Test on slow devices/networks

### Optimization
- [ ] Use `React.memo` for expensive components
- [ ] Use `useMemo` for expensive calculations
- [ ] Use `useCallback` for callbacks to memoized children
- [ ] Implement code splitting with `lazy()` and `Suspense`
- [ ] Use unique `key` props in lists
- [ ] Consider windowing for long lists (500+ items)
- [ ] Debounce user input
- [ ] Load critical data first, non-critical in background

### Anti-Patterns to Avoid
- [ ] ❌ Don't optimize without profiling
- [ ] ❌ Don't use index as key in dynamic lists
- [ ] ❌ Don't create objects/arrays inline in render (pass to memoized children)
- [ ] ❌ Don't forget to clean up effects (timers, subscriptions)
- [ ] ❌ Don't over-use memoization (adds overhead)

---

## 🎓 Interview Cheat Sheet

**Q: How do you identify performance bottlenecks in React?**
A: Use React DevTools Profiler to find:
1. Components that re-render frequently
2. Components with long render times
3. Unnecessary re-renders (props didn't change)

**Q: What's the difference between React.memo and useMemo?**
A:
- `React.memo` - prevents component re-renders. Wrapping a component. Prevents-Unnecessary component re-renders
- `useMemo` - memoizes computed values within a component. Wrapping a value or calculation. Prevents-Unnecessary re-computation inside a component
**Q: When would you NOT use React.memo?**
A:
1. Component almost always renders with different props
2. Component is cheap to render
3. Props include callbacks/objects that change every render (unless you also use useCallback/useMemo)

**Q: How does code splitting improve performance?**
A: Reduces initial bundle size → faster download → faster initial render. Users only download code they actually use.

**Q: What's the cost of memoization?**
A: Memory (stores previous values) and comparison overhead (checking if deps changed). Only worth it for expensive operations.

---

## 🚀 Your Project's Performance Strategy

### What Your Project Does Well ✅
1. **Lazy loading** - Pages load on demand
2. **Priority loading** - Critical data first, background data later
3. **useCallback** - Stable function references in App.jsx
4. **Context optimization** - Global cache prevents duplicate fetches

### Potential Improvements 🔧
1. **Add React.memo** to `GanttBar` component (if rendering 100+ bars)
2. **Memoize filter/sort** in Gantt chart pages
3. **Implement windowing** if lists exceed 500 items
4. **Debounce search/filter** inputs
5. **Profile with React DevTools** to find actual bottlenecks

---

> **Next Steps:** Profile your PMO Portfolio app, identify the slowest components, and apply these techniques strategically!
