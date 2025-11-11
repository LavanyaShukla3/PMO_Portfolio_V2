# Quick Reference Guide - React Concepts

## 🎯 Your Learning Path Overview

This is your **cheat sheet** for quick reference. For detailed explanations, refer to individual step documents.

---

## 📚 The 10-Step Journey

### **Step 1: Components & JSX** → `01_COMPONENTS_AND_JSX.md`
- Components are JavaScript functions that return JSX
- Props pass data from parent to child (immutable)
- JSX is JavaScript, not HTML (className, camelCase, etc.)
- Component composition builds complex UIs from simple pieces

### **Step 2: State Management** → `02_STATE_MANAGEMENT.md`
- State is component's memory (mutable)
- `useState` creates state variables
- State updates trigger re-renders
- Lift state up to share between components
- Use functional updates for state that depends on previous value

### **Step 3: useEffect & Lifecycle** → `03_USE_EFFECT_LIFECYCLE.md`
- Effects run AFTER render (side effects)
- Dependency array controls when effect runs
- Always cleanup subscriptions/listeners
- `[]` = run once, `[a, b]` = run when a or b changes

### **Step 4: React Hooks** → `04_REACT_HOOKS.md`
- All hooks explained: useState, useEffect, useCallback, useMemo, useRef, useReducer, useContext
- Interview-focused with conceptual breakdown
- Rules of hooks and common patterns
- Examples from your PMO Portfolio project

### **Step 5: Performance Optimization** → `05_PERFORMANCE_OPTIMIZATION.md`
- `useMemo` memoizes expensive calculations
- `useCallback` memoizes function references
- `React.memo` prevents unnecessary re-renders
- `lazy()` + `Suspense` for code splitting
- Only optimize when you have proof of a problem

### **Step 6: Context API Deep Dive** → `06_CONTEXT_API_DEEP_DIVE.md`
- Share data without prop drilling
- Global state management with Context + useReducer
- Your `GlobalDataCacheContext` as primary example
- Provider/consumer pattern explained

### **Step 7: Best Practices & Refactoring** → `07_BEST_PRACTICES_REFACTORING.md`
- Project structure and organization
- Code quality and maintainability
- Common pitfalls and solutions
- Refactoring patterns from your project

### **Step 8: Advanced Patterns** → `08_ADVANCED_PATTERNS.md`
- Custom hooks for reusable logic
- Compound components pattern
- Render props and HOCs
- Real-world examples

### **Step 9: Interview Preparation** → `09_INTERVIEW_PREPARATION.md`
- Common React interview questions
- Project explanation templates
- How to present your PMO Portfolio
- Coding challenges and practice

### **Step 10: Quick Reference** → `00_QUICK_REFERENCE.md`
- This document - your cheat sheet for all concepts

---

## 🔥 Essential Hooks Cheat Sheet

### useState - Component Memory
```jsx
const [value, setValue] = useState(initialValue);

// Direct update
setValue(newValue);

// Functional update (when depends on previous)
setValue(prev => prev + 1);

// Object update (spread to preserve other properties)
setValue(prev => ({ ...prev, key: newValue }));
```

### useEffect - Side Effects
```jsx
// Run once on mount
useEffect(() => {
    // Effect code
    return () => {
        // Cleanup
    };
}, []);

// Run when deps change
useEffect(() => {
    // Effect code
}, [dep1, dep2]);

// Run after every render (rare)
useEffect(() => {
    // Effect code
});
```

### useContext - Access Context
```jsx
const value = useContext(MyContext);

// Your project's custom hook
const { portfolioData, isLoading } = useGlobalDataCache();
```

### useMemo - Memoize Values
```jsx
const expensiveValue = useMemo(() => {
    return computeExpensiveValue(a, b);
}, [a, b]);  // Only recompute when a or b changes
```

### useCallback - Memoize Functions
```jsx
const memoizedCallback = useCallback(() => {
    doSomething(a, b);
}, [a, b]);  // Same function reference unless a or b changes
```

### useRef - Persist Values & DOM Access
```jsx
const ref = useRef(initialValue);

// Access/modify without re-render
ref.current = newValue;

// DOM reference
<div ref={ref} />
ref.current.scrollTop = 0;
```

### useReducer - Complex State
```jsx
const [state, dispatch] = useReducer(reducer, initialState);

function reducer(state, action) {
    switch (action.type) {
        case 'INCREMENT':
            return { ...state, count: state.count + 1 };
        default:
            return state;
    }
}

dispatch({ type: 'INCREMENT', payload: data });
```

---

## 🎨 Common Patterns in YOUR Project

### Pattern 1: Conditional Rendering
```jsx
// In App.jsx
{currentView === null && <WelcomePage />}
{currentView === 'Portfolio' && <PortfolioGanttChart />}
{currentView === 'Program' && <ProgramGanttChart />}

// Ternary
{loading ? <LoadingSpinner /> : <Content />}

// Short-circuit
{error && <ErrorBanner message={error} />}
```

### Pattern 2: List Rendering
```jsx
// In WelcomePage.jsx
{views.map(view => (
    <button key={view.id} onClick={() => onSelectView(view.id)}>
        {view.title}
    </button>
))}
```

### Pattern 3: Event Handlers
```jsx
// Inline
<button onClick={() => setCount(count + 1)}>

// Function reference
<button onClick={handleClick}>

// With parameters
<button onClick={() => handleClick(id)}>
```

### Pattern 4: Lifting State Up
```jsx
// Parent owns state
const Parent = () => {
    const [data, setData] = useState('');
    return <Child data={data} onChange={setData} />;
};

// Child uses props
const Child = ({ data, onChange }) => {
    return <input value={data} onChange={e => onChange(e.target.value)} />;
};
```

### Pattern 5: Data Fetching
```jsx
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

useEffect(() => {
    let cancelled = false;
    
    fetch('/api/data')
        .then(res => res.json())
        .then(data => {
            if (!cancelled) {
                setData(data);
                setLoading(false);
            }
        })
        .catch(err => {
            if (!cancelled) {
                setError(err.message);
                setLoading(false);
            }
        });
    
    return () => { cancelled = true; };
}, []);
```

### Pattern 6: Context Provider
```jsx
// Create context
const MyContext = createContext();

// Provider wraps app
<MyContext.Provider value={data}>
    <App />
</MyContext.Provider>

// Consume in any component
const data = useContext(MyContext);
```

---

## ⚡ React Mental Model

### The React Flow
```
1. Props or State Change
         ↓
2. Component Re-renders
         ↓
3. React Creates New Virtual DOM
         ↓
4. React Compares with Previous Virtual DOM (Reconciliation)
         ↓
5. React Updates ONLY Changed Parts in Real DOM
         ↓
6. useEffect Runs (After DOM Update)
         ↓
7. Cleanup from Previous Effect (if any)
         ↓
8. New Effect Runs
```

### Data Flow
```
         Parent Component
               ↓
         (Props Down)
               ↓
         Child Component
               ↓
      (Events/Callbacks Up)
               ↓
         Parent Component
         (Updates State)
```

---

## 🚫 Common Mistakes & Solutions

### Mistake 1: Mutating State
```jsx
// ❌ WRONG
const [items, setItems] = useState([1, 2, 3]);
items.push(4);  // Mutates state!
setItems(items);  // React won't detect change

// ✅ CORRECT
setItems([...items, 4]);  // New array
```

### Mistake 2: Missing Dependencies
```jsx
// ❌ WRONG
useEffect(() => {
    fetchData(userId);  // Uses userId
}, []);  // But userId not in deps!

// ✅ CORRECT
useEffect(() => {
    fetchData(userId);
}, [userId]);
```

### Mistake 3: State in Render
```jsx
// ❌ WRONG
const Component = () => {
    const [count] = useState(0);
    count++;  // Side effect during render!
    return <div>{count}</div>;
};

// ✅ CORRECT
const Component = () => {
    const [count, setCount] = useState(0);
    return (
        <div>
            {count}
            <button onClick={() => setCount(count + 1)}>+</button>
        </div>
    );
};
```

### Mistake 4: Async useEffect
```jsx
// ❌ WRONG
useEffect(async () => {
    const data = await fetch('/api');  // Can't make effect async!
}, []);

// ✅ CORRECT
useEffect(() => {
    const fetchData = async () => {
        const data = await fetch('/api');
    };
    fetchData();
}, []);
```

### Mistake 5: Forgetting Keys
```jsx
// ❌ WRONG
{items.map((item, index) => (
    <div>{item}</div>  // No key!
))}

// ❌ BAD (using index)
{items.map((item, index) => (
    <div key={index}>{item}</div>
))}

// ✅ CORRECT
{items.map(item => (
    <div key={item.id}>{item.name}</div>
))}
```

---

## 🎤 Interview Quick Prep

### Top 10 Questions You Should Master

#### 1. **What is React and why use it?**
- JavaScript library for building UIs
- Component-based architecture
- Virtual DOM for performance
- Declarative (describe what, not how)
- Large ecosystem and community

#### 2. **What's the difference between state and props?**
- **Props**: External data, passed from parent, immutable
- **State**: Internal data, managed by component, mutable

#### 3. **Explain the Virtual DOM**
- Lightweight JavaScript representation of real DOM
- React creates new virtual DOM on state change
- Compares with previous (diffing/reconciliation)
- Updates only changed parts in real DOM
- Much faster than direct DOM manipulation

#### 4. **What are React Hooks?**
- Functions that let you "hook into" React features
- Use state and effects in functional components
- `useState`, `useEffect`, `useContext`, etc.
- Must follow rules: top level, only in React functions

#### 5. **Explain useEffect and its dependency array**
- Runs side effects AFTER render
- `[]` = once on mount
- `[a, b]` = when a or b changes
- No array = every render
- Return function = cleanup

#### 6. **When would you use useReducer instead of useState?**
- Complex state with multiple sub-values
- State transitions follow patterns
- Next state depends on previous in complex ways
- Example: Your `GlobalDataCacheContext`

#### 7. **What is Context API and when to use it?**
- Share data without prop drilling
- Global state accessible by any component
- Use for: theme, auth, language, global cache
- Don't overuse - can cause unnecessary re-renders

#### 8. **How do you optimize React performance?**
- `React.memo` for component memoization
- `useMemo` for expensive calculations
- `useCallback` for function references
- `lazy` + `Suspense` for code splitting
- Virtualization for long lists
- **But**: Profile first, optimize when proven needed

#### 9. **What's lifting state up?**
- Moving state to common parent component
- Allows siblings to share state
- Parent passes state as props
- Children trigger updates via callbacks
- Example: Your `App.jsx` manages state for all pages

#### 10. **Explain component lifecycle**
- **Mount**: Component created and inserted into DOM
- **Update**: Props or state changes, component re-renders
- **Unmount**: Component removed from DOM
- useEffect handles all three with dependencies and cleanup

---

## 📊 Your Project Architecture Map

```
App.jsx (Root)
├── GlobalDataCacheProvider (Context)
│   └── Manages: portfolioData, programData, loading states
│
├── WelcomePage
│   └── Renders: View selection cards
│
├── PortfolioGanttChart
│   ├── Manages: pagination, filtering, timeline view
│   ├── TimelineAxis
│   ├── TimelineViewDropdown
│   ├── GanttBar (for each project)
│   ├── MilestoneMarker (for each milestone)
│   └── PaginationControls
│
├── ProgramGanttChart
│   └── Similar structure to Portfolio
│
├── SubProgramGanttChart
│   └── Similar structure to Portfolio
│
└── RegionRoadMap
    └── Region-specific view
```

### Data Flow in Your Project
```
1. App mounts → GlobalDataCacheContext loads all data
2. User sees WelcomePage (currentView = null)
3. User clicks "Portfolio Roadmap"
   → setCurrentView('Portfolio')
   → App re-renders
4. PortfolioGanttChart mounts
   → useGlobalDataCache() accesses cached data
   → No API call needed (instant load!)
5. User clicks a portfolio
   → onDrillToProgram callback
   → Updates App state (portfolioId, view)
6. ProgramGanttChart renders with portfolioId prop
```

---

## 🛠️ Debugging Tips

### React DevTools
1. Install React Developer Tools extension
2. Components tab: Inspect props and state
3. Profiler tab: Measure performance
4. Find why component re-rendered

### Console Debugging
```jsx
// Log renders
console.log('Component rendered', { props, state });

// Log effect runs
useEffect(() => {
    console.log('Effect ran', { dependencies });
}, [dependencies]);

// Measure performance
console.time('Expensive Operation');
const result = expensiveCalculation();
console.timeEnd('Expensive Operation');
```

### Common Warnings & Fixes
- **"Can't perform state update on unmounted component"**
  → Use cleanup with `cancelled` flag in useEffect

- **"Missing dependency"**
  → Add to dependency array or remove from effect

- **"Each child should have unique key prop"**
  → Add `key={item.id}` to list items

- **"Maximum update depth exceeded"**
  → Infinite loop in useEffect or setState

---

## 🎯 Practice Challenges

### Beginner
1. Build a counter with +, -, reset buttons
2. Create a form with controlled inputs
3. Build a todo list with add/delete
4. Fetch and display data from an API

### Intermediate
5. Add filtering to the todo list
6. Build a debounced search component
7. Create a modal with portal
8. Implement pagination

### Advanced
9. Build your own custom hooks library
10. Create a data table with sorting and filtering
11. Implement infinite scroll
12. Build a form with complex validation

---

## 📚 Learning Resources

### Official Documentation
- **React Docs**: https://react.dev (NEW docs, excellent!)
- **React Beta Docs**: More detailed explanations

### Your Best Resource
- **Your own codebase**: Study `PMO_Portfolio_V2`
- Trace data flow from App → Components
- Understand patterns already working in production

### Practice
- Build features in your project
- Refactor components to apply new patterns
- Add new pages using existing patterns

---

## ✅ Readiness Checklist

### Foundation
- [ ] Can explain what components are
- [ ] Comfortable with JSX syntax
- [ ] Understand props vs state
- [ ] Can use useState effectively

### Intermediate
- [ ] Master useEffect and dependencies
- [ ] Know when to lift state up
- [ ] Can fetch data properly
- [ ] Understand component lifecycle

### Advanced
- [ ] Know when to optimize (useMemo, useCallback)
- [ ] Understand Context API
- [ ] Can build custom hooks
- [ ] Familiar with useReducer

### Production Ready
- [ ] Can explain your project architecture
- [ ] Know common pitfalls and solutions
- [ ] Can debug using React DevTools
- [ ] Ready for technical interviews

---

## 🎓 Final Tips

### For Learning
1. **Read your own code** - Best examples are in your project
2. **Break things** - Change code and see what breaks
3. **Console.log everything** - Understand the flow
4. **Use React DevTools** - Visualize props/state

### For Interviews
1. **Explain your project** - Use real examples from PMO Portfolio
2. **Know the "why"** - Don't just memorize, understand
3. **Practice talking** - Explain concepts out loud
4. **Build something** - Small projects solidify understanding

### For Growth
1. **Refactor** - Apply new patterns to existing code
2. **Optimize** - Find slow components and improve them
3. **Extend** - Add new features using learned concepts
4. **Share** - Teach others (best way to learn)

---

## 🚀 You're Ready!

You have:
- ✅ A production React application
- ✅ Real-world patterns and practices
- ✅ Comprehensive learning materials
- ✅ Hands-on exercises
- ✅ Interview preparation

**Next step**: Start with Step 1 and work through systematically. Refer back to this guide anytime!

Good luck! 🎉
