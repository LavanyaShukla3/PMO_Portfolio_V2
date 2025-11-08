# Step 2: State Management - Making Components Interactive

## 🎯 Learning Objectives
By the end of this step, you will:
- Understand what state is and why it's needed
- Use the useState Hook effectively
- Know when to use state vs props
- Handle multiple state variables
- Lift state up to share data between components

---

## 💡 The BIGGEST Eureka Moment: State Changes = Re-renders

### How Traditional JavaScript Works
```javascript
// Traditional DOM manipulation
let counter = 0;

function increment() {
    counter++;  // Update variable
    document.getElementById('count').innerText = counter;  // Manually update UI
}
```

### How React Works
```jsx
// React's declarative approach
const [counter, setCounter] = useState(0);

function increment() {
    setCounter(counter + 1);  // Update state
    // React automatically updates UI! No manual DOM manipulation!
}

return <div>{counter}</div>;
```

**🎉 EUREKA!** 
- In traditional JS: You update data AND manually update the UI
- In React: You update state, React automatically updates the UI
- React re-renders your component when state changes

---

## 📖 useState Hook - The Foundation

### Basic Syntax

```jsx
import { useState } from 'react';

const [stateValue, setStateValue] = useState(initialValue);
//     ↑              ↑                        ↑
//  current value   updater function      starting value
```

**Analogy**: Think of it like a variable with a special setter:
```javascript
// Regular variable
let count = 0;
count = 1;  // Direct assignment

// State variable
const [count, setCount] = useState(0);
setCount(1);  // Must use setter function
```

### Why Can't We Just Use Regular Variables?

```jsx
// ❌ This DOESN'T work
const Counter = () => {
    let count = 0;  // Regular variable
    
    const increment = () => {
        count++;  // This updates the variable...
        console.log(count);  // This logs the new value...
        // But the UI doesn't update! React doesn't know count changed!
    };
    
    return <button onClick={increment}>{count}</button>;
};

// ✅ This DOES work
const Counter = () => {
    const [count, setCount] = useState(0);  // State variable
    
    const increment = () => {
        setCount(count + 1);  // React knows state changed!
        // React will re-render the component!
    };
    
    return <button onClick={increment}>{count}</button>;
};
```

**Eureka!** Regular variables reset on every render. State variables persist between renders AND trigger re-renders when updated!

---

## 🔍 useState in YOUR Project

### Example 1: Simple State (Current View)
**File**: `src/App.jsx` (line 14)

```jsx
const [currentView, setCurrentView] = useState(null);
//     ↑ State variable - currently selected view (null, 'Portfolio', 'Program', etc.)
//                       ↑ Setter function
//                                          ↑ Initial value (no view selected)

// Later in the code...
const handleViewSelection = useCallback((viewName) => {
    setCurrentView(viewName);  // Update state → triggers re-render
}, []);

// Render different content based on state
{currentView === null && <WelcomePage onSelectView={handleViewSelection} />}
{currentView === 'Portfolio' && <PortfolioGanttChart />}
{currentView === 'Program' && <ProgramGanttChart />}
```

**What happens when you click a view card:**
1. User clicks "Portfolio Roadmap" button
2. `WelcomePage` calls `onSelectView('Portfolio')`
3. `handleViewSelection` calls `setCurrentView('Portfolio')`
4. React re-renders `App` component
5. Now `currentView === 'Portfolio'` is true
6. `PortfolioGanttChart` renders instead of `WelcomePage`

### Example 2: Multiple State Variables
**File**: `src/App.jsx` (lines 14-26)

```jsx
// Managing multiple pieces of state
const [currentView, setCurrentView] = useState(null);
const [selectedPortfolioId, setSelectedPortfolioId] = useState(null);
const [selectedPortfolioName, setSelectedPortfolioName] = useState('');
const [selectedSubProgramId, setSelectedSubProgramId] = useState(null);
const [selectedSubProgramName, setSelectedSubProgramName] = useState('');
const [dataValidation, setDataValidation] = useState({ 
    isValid: null, 
    errors: [], 
    mode: 'unknown',
    isLoading: true 
});
```

**Design Decision**: Why separate state variables instead of one big object?

```jsx
// ❌ ONE BIG STATE OBJECT
const [appState, setAppState] = useState({
    currentView: null,
    selectedPortfolioId: null,
    selectedPortfolioName: '',
    // ... etc
});

// To update ONE property, you must spread the entire object!
setAppState({ ...appState, currentView: 'Portfolio' });

// ✅ SEPARATE STATE VARIABLES
const [currentView, setCurrentView] = useState(null);
const [selectedPortfolioId, setSelectedPortfolioId] = useState(null);

// Simpler updates!
setCurrentView('Portfolio');
setSelectedPortfolioId(123);
```

**Best Practice**: 
- Use separate state for independent values
- Use object state for related values (like `dataValidation`)

### Example 3: Object State
**File**: `src/App.jsx` (lines 22-26)

```jsx
const [dataValidation, setDataValidation] = useState({ 
    isValid: null, 
    errors: [], 
    mode: 'unknown',
    isLoading: true 
});

// Update object state - must spread existing properties!
setDataValidation({
    ...dataValidation,      // Keep all existing properties
    isLoading: false,       // Update this one
    isValid: true          // And this one
});

// Or shorter using prev state
setDataValidation(prev => ({
    ...prev,
    isLoading: false,
    isValid: true
}));
```

---

## 🎯 State Update Patterns

### Pattern 1: Direct Update (Simple Values)

```jsx
const [name, setName] = useState('');
const [count, setCount] = useState(0);
const [isActive, setIsActive] = useState(false);

// Direct updates
setName('Lavanya');
setCount(42);
setIsActive(true);
```

### Pattern 2: Functional Update (Based on Previous State)

```jsx
const [count, setCount] = useState(0);

// ❌ WRONG - May cause bugs with async updates
const increment = () => {
    setCount(count + 1);  // Uses stale value if clicked rapidly
};

// ✅ CORRECT - Always uses latest value
const increment = () => {
    setCount(prevCount => prevCount + 1);
};

// Example: Double increment
const doubleIncrement = () => {
    setCount(c => c + 1);  // +1
    setCount(c => c + 1);  // +1 more = +2 total ✅
};

// ❌ This would only increment by 1!
const wrongDoubleIncrement = () => {
    setCount(count + 1);  // +1
    setCount(count + 1);  // Still +1 (uses same 'count' value)
};
```

**💡 Eureka!** State updates are batched and asynchronous. Use functional updates when new state depends on old state!

### Pattern 3: Object State Updates

```jsx
const [user, setUser] = useState({
    name: 'John',
    age: 30,
    email: 'john@example.com'
});

// ❌ WRONG - Loses other properties
setUser({ name: 'Jane' });  // age and email are now undefined!

// ✅ CORRECT - Spread operator preserves other properties
setUser({ ...user, name: 'Jane' });

// ✅ BETTER - Use functional update for safety
setUser(prevUser => ({
    ...prevUser,
    name: 'Jane'
}));

// ✅ Update nested properties
setUser(prevUser => ({
    ...prevUser,
    address: {
        ...prevUser.address,
        city: 'New York'
    }
}));
```

### Pattern 4: Array State Updates

```jsx
const [items, setItems] = useState([1, 2, 3]);

// Add item
setItems([...items, 4]);  // [1, 2, 3, 4]

// Remove item
setItems(items.filter(item => item !== 2));  // [1, 3]

// Update item
setItems(items.map(item => 
    item === 2 ? 20 : item
));  // [1, 20, 3]

// Replace entire array
setItems([10, 20, 30]);
```

**Key Point**: Never mutate state directly!

```jsx
// ❌ WRONG - Mutates state directly
items.push(4);
setItems(items);  // React won't detect the change!

// ✅ CORRECT - Create new array
setItems([...items, 4]);
```

---

## 🔄 State vs Props

### The Golden Rule: Props Down, State Up

```jsx
// Parent Component - OWNS the state
const App = () => {
    const [count, setCount] = useState(0);  // State lives here
    
    return (
        <div>
            <Display count={count} />         {/* Pass as prop DOWN */}
            <Controls onIncrement={() => setCount(count + 1)} />  {/* Pass updater DOWN */}
        </div>
    );
};

// Child Component 1 - DISPLAYS the data
const Display = ({ count }) => {  // Receives as prop
    return <h1>{count}</h1>;
};

// Child Component 2 - TRIGGERS updates
const Controls = ({ onIncrement }) => {  // Receives updater as prop
    return <button onClick={onIncrement}>+1</button>;
};
```

**Comparison Table**:

| Feature | State | Props |
|---------|-------|-------|
| **Owned by** | Component itself | Parent component |
| **Can change?** | Yes (via setState) | No (read-only) |
| **Triggers re-render?** | Yes | Only if prop value changed |
| **Scope** | Local to component | Passed from parent |
| **Use for** | Dynamic data | Configuration, callbacks |

---

## 🏗️ Lifting State Up

### Problem: Sharing State Between Siblings

```jsx
// ❌ Problem: Two components need to share data
const ComponentA = () => {
    const [data, setData] = useState('hello');
    // How does ComponentB access this data?
};

const ComponentB = () => {
    // Can't access ComponentA's state!
};
```

### Solution: Lift State to Common Parent

```jsx
// ✅ Solution: State lives in parent, shared via props
const Parent = () => {
    const [data, setData] = useState('hello');  // State lifted up
    
    return (
        <div>
            <ComponentA data={data} onDataChange={setData} />
            <ComponentB data={data} />
        </div>
    );
};

const ComponentA = ({ data, onDataChange }) => {
    return (
        <input 
            value={data} 
            onChange={e => onDataChange(e.target.value)} 
        />
    );
};

const ComponentB = ({ data }) => {
    return <p>You typed: {data}</p>;
};
```

### Real Example from YOUR Project
**File**: `src/App.jsx`

```jsx
// App.jsx - State lives here (lifted up)
const [selectedPortfolioId, setSelectedPortfolioId] = useState(null);
const [selectedPortfolioName, setSelectedPortfolioName] = useState('');

// Passed to PortfolioGanttChart
<PortfolioGanttChart 
    onDrillToProgram={(portfolioId, portfolioName) => {
        setSelectedPortfolioId(portfolioId);  // Update parent state
        setSelectedPortfolioName(portfolioName);
        setCurrentView('Program');
    }}
/>

// Later used in ProgramGanttChart
<ProgramGanttChart 
    portfolioId={selectedPortfolioId}      // Shared via props
    portfolioName={selectedPortfolioName}
/>
```

**Flow**:
1. User clicks portfolio in `PortfolioGanttChart`
2. `onDrillToProgram` callback fires, updating `App` state
3. `App` re-renders with new state
4. `App` switches to `ProgramGanttChart`
5. `ProgramGanttChart` receives portfolio data via props

---

## 🧪 Hands-On Exercises

### Exercise 1: Counter with Multiple Operations

```jsx
const Counter = () => {
    const [count, setCount] = useState(0);
    
    return (
        <div>
            <h1>{count}</h1>
            <button onClick={() => setCount(count + 1)}>+1</button>
            <button onClick={() => setCount(count - 1)}>-1</button>
            <button onClick={() => setCount(count * 2)}>×2</button>
            <button onClick={() => setCount(0)}>Reset</button>
        </div>
    );
};
```

**Challenge**: Add a "+10" button and "÷2" button.

### Exercise 2: Form Input State

```jsx
const UserForm = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [age, setAge] = useState('');
    
    const handleSubmit = (e) => {
        e.preventDefault();
        console.log({ name, email, age });
    };
    
    return (
        <form onSubmit={handleSubmit}>
            <input 
                placeholder="Name"
                value={name}
                onChange={e => setName(e.target.value)}
            />
            <input 
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
            />
            <input 
                placeholder="Age"
                type="number"
                value={age}
                onChange={e => setAge(e.target.value)}
            />
            <button type="submit">Submit</button>
        </form>
    );
};
```

**Challenge**: 
1. Add validation (email must contain @, age must be > 0)
2. Show error messages
3. Disable submit button if form is invalid

### Exercise 3: Todo List

```jsx
const TodoList = () => {
    const [todos, setTodos] = useState([]);
    const [inputValue, setInputValue] = useState('');
    
    const addTodo = () => {
        if (inputValue.trim()) {
            setTodos([...todos, { id: Date.now(), text: inputValue, done: false }]);
            setInputValue('');
        }
    };
    
    const toggleTodo = (id) => {
        setTodos(todos.map(todo =>
            todo.id === id ? { ...todo, done: !todo.done } : todo
        ));
    };
    
    const deleteTodo = (id) => {
        setTodos(todos.filter(todo => todo.id !== id));
    };
    
    return (
        <div>
            <input 
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && addTodo()}
            />
            <button onClick={addTodo}>Add</button>
            
            <ul>
                {todos.map(todo => (
                    <li key={todo.id}>
                        <input 
                            type="checkbox"
                            checked={todo.done}
                            onChange={() => toggleTodo(todo.id)}
                        />
                        <span style={{ 
                            textDecoration: todo.done ? 'line-through' : 'none' 
                        }}>
                            {todo.text}
                        </span>
                        <button onClick={() => deleteTodo(todo.id)}>Delete</button>
                    </li>
                ))}
            </ul>
        </div>
    );
};
```

**Challenge**: Add a filter (All / Active / Completed)

### Exercise 4: Lifting State - Temperature Converter

```jsx
// Parent holds the state
const TemperatureConverter = () => {
    const [celsius, setCelsius] = useState(0);
    
    return (
        <div>
            <CelsiusInput 
                value={celsius} 
                onChange={setCelsius} 
            />
            <FahrenheitInput 
                value={celsius * 9/5 + 32}
                onChange={f => setCelsius((f - 32) * 5/9)}
            />
        </div>
    );
};

// Child 1
const CelsiusInput = ({ value, onChange }) => (
    <div>
        <label>Celsius:</label>
        <input 
            type="number"
            value={value}
            onChange={e => onChange(Number(e.target.value))}
        />
    </div>
);

// Child 2
const FahrenheitInput = ({ value, onChange }) => (
    <div>
        <label>Fahrenheit:</label>
        <input 
            type="number"
            value={value}
            onChange={e => onChange(Number(e.target.value))}
        />
    </div>
);
```

---

## 🎓 Key Takeaways

### State Fundamentals
- ✅ State is component's memory
- ✅ Updating state triggers re-render
- ✅ State updates are asynchronous and batched
- ✅ Never mutate state directly (use setState)
- ✅ Use functional updates when new state depends on old state

### State vs Props
- ✅ State = internal, changeable data
- ✅ Props = external, read-only data
- ✅ State flows down as props
- ✅ Events flow up via callbacks

### Design Patterns
- ✅ Lift state up to share between components
- ✅ Keep state close to where it's used
- ✅ Split complex state into multiple simple pieces
- ✅ Group related state into objects

---

## 🚀 Next Steps

Now that you understand state, you're ready for:
- **Step 3**: useEffect - Side effects and component lifecycle
- **Step 4**: Performance - useMemo and useCallback

---

## 📝 Self-Check Questions

1. What's the difference between a regular variable and state?
2. Why can't we just assign to state directly (`count = 5`)?
3. When should you use functional updates (`setState(prev => ...)`)?
4. How do you update one property in an object state?
5. What does "lifting state up" mean?
6. Can a child component modify its props?

**Answers**:
1. Regular variables reset on render; state persists and triggers re-renders
2. React wouldn't know to re-render; must use setState
3. When new state depends on previous state (async safety)
4. Use spread operator: `setState({ ...state, property: newValue })`
5. Moving state to a common parent to share between siblings
6. No, props are read-only; must call parent's callback to request changes
