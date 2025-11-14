# Step 1: Components & JSX - Building Blocks of React

## 🎯 Learning Objectives
By the end of this step, you will:
- Understand what components are and why they matter
- Read and write JSX confidently
- Pass data between components using props
- Compose complex UIs from simple components

---

## 💡 The Eureka Moment: Components Are Just Functions

### Traditional Web Development
```html
<!-- HTML -->
<div id="welcome-card">
    <h1>Welcome</h1>
    <p>Click to continue</p>
</div>

<script>
    // JavaScript (separate from HTML)
    document.getElementById('welcome-card').addEventListener('click', function() {
        alert('Clicked!');
    });
</script>
```

### React Way
```jsx
// Everything in one place: structure, logic, and behavior
function WelcomeCard() {
    const handleClick = () => {
        alert('Clicked!');
    };
    
    return (
        <div onClick={handleClick}>
            <h1>Welcome</h1>
            <p>Click to continue</p>
        </div>
    );
}
```

**Eureka!** In React, a component is just a JavaScript function that returns UI (JSX). It's self-contained and reusable!

---

## 📖 Components in YOUR Project

### Example 1: Simple Component (WelcomePage)
**File**: `src/pages/WelcomePage.jsx`

```jsx
// 1. Import React (needed for JSX)
import React from 'react';

// 2. Component is a function that returns JSX
const WelcomePage = ({ onSelectView }) => {
    // 3. JavaScript logic goes here
    const views = [
        {
            id: 'Portfolio',
            title: 'Portfolio Roadmap',
            description: 'View all portfolios and their timelines',
            icon: '📊',
            color: 'blue'
        },
        // ... more views
    ];

    // 4. Return JSX (looks like HTML, but it's JavaScript!)
    return (
        <div className="welcome-container">
            <h1 className="welcome-title">PMO Portfolio Management</h1>
            
            <div className="view-grid">
                {/* JavaScript in JSX uses curly braces */}
                {views.map(view => (
                    <button
                        key={view.id}  // key is required for lists!
                        className={`view-card view-card-${view.color}`}
                        onClick={() => onSelectView(view.id)}
                    >
                        <div className="view-icon">{view.icon}</div>
                        <h2 className="view-title">{view.title}</h2>
                        <p className="view-description">{view.description}</p>
                    </button>
                ))}
            </div>
        </div>
    );
};

// 5. Export so other files can use it
export default WelcomePage;
```

**Key Observations**:
- Component name starts with **capital letter** (WelcomePage, not welcomePage)
- Takes props as parameter: `{ onSelectView }`
- Returns JSX (JavaScript XML)
- Uses JavaScript expressions in curly braces: `{view.icon}`
- Event handlers use camelCase: `onClick` (not `onclick`)

---

## 🔤 JSX: JavaScript + XML

### What is JSX?

JSX is **NOT HTML**. It's a syntax extension that looks like HTML but is actually JavaScript.

```jsx
// This JSX...
const element = <h1 className="greeting">Hello, {name}!</h1>;

// ...compiles to this JavaScript:
const element = React.createElement(
    'h1',
    { className: 'greeting' },
    'Hello, ',
    name,
    '!'
);
```

### JSX Rules You Must Know

#### Rule 1: One Parent Element
```jsx
// ❌ WRONG - Multiple siblings
return (
    <h1>Title</h1>
    <p>Description</p>
);

// ✅ CORRECT - Wrap in parent
return (
    <div>
        <h1>Title</h1>
        <p>Description</p>
    </div>
);

// ✅ BETTER - Use Fragment to avoid extra div
return (
    <>
        <h1>Title</h1>
        <p>Description</p>
    </>
);
```

#### Rule 2: JavaScript in Curly Braces
```jsx
const name = "Lavanya";
const age = 25;
const isAdmin = true;

return (
    <div>
        {/* Variables */}
        <p>Hello, {name}!</p>
        
        {/* Expressions */}
        <p>Next year you'll be {age + 1}</p>
        
        {/* Conditional rendering */}
        {isAdmin && <button>Admin Panel</button>}
        
        {/* Ternary operator */}
        <p>Status: {isAdmin ? 'Admin' : 'User'}</p>
        
        {/* Function calls */}
        <p>{name.toUpperCase()}</p>
    </div>
);
```

#### Rule 3: className, not class
```jsx
// ❌ WRONG - class is a reserved word in JavaScript
<div class="container">

// ✅ CORRECT - Use className
<div className="container">

// ✅ Dynamic classes
<div className={`view-card view-card-${view.color}`}>
```

#### Rule 4: Self-Closing Tags
```jsx
// ❌ WRONG
<img src="photo.jpg">
<input type="text">

// ✅ CORRECT - Must self-close
<img src="photo.jpg" />
<input type="text" />
```

#### Rule 5: CamelCase for Attributes
```jsx
// HTML uses kebab-case
<div onclick="..." tabindex="0">

// JSX uses camelCase
<div onClick={...} tabIndex={0}>
```

---

## 🎁 Props: Passing Data to Components

### What Are Props?

Props (properties) are how you pass data from a parent component to a child component.

**Think of props like function arguments**:
```javascript
// Regular function
function greet(name) {
    return `Hello, ${name}!`;
}

// React component with props
function Greeting({ name }) {
    return <h1>Hello, {name}!</h1>;
}
```

### Props in YOUR Project

**Example**: `GanttBar` component receives many props

**File**: `src/components/GanttBar.jsx`

```jsx
// Component definition - destructure props
const GanttBar = ({
    data,           // Project data object
    y,              // Y position
    width,          // Bar width
    startX,         // X position
    label,          // Project name
    status,         // Red/Amber/Green
    onBarClick      // Callback function
}) => {
    // Use props in component
    const barColor = statusColors[status] || statusColors.Grey;
    
    return (
        <g className="gantt-bar">
            <text x={10} y={y + height/2}>
                {label}
            </text>
            
            <rect
                x={startX}
                width={width}
                fill={barColor}
                onClick={() => onBarClick?.(data)}
            />
        </g>
    );
};
```

**Usage**: Parent passes props to GanttBar

**File**: `src/pages/PortfolioGanttChart.jsx`

```jsx
// Parent component renders GanttBar with props
{projects.map(project => (
    <GanttBar
        key={project.id}
        data={project}
        y={calculateY(project)}
        width={calculateWidth(project)}
        startX={calculateStartX(project)}
        label={project.name}
        status={project.status}
        onBarClick={handleProjectClick}
    />
))}
```

### Props Are Read-Only (Immutable)

```jsx
// ❌ WRONG - Never modify props
const MyComponent = ({ count }) => {
    count = count + 1; // ERROR! Props are read-only
    return <div>{count}</div>;
};

// ✅ CORRECT - Use state for values that change
const MyComponent = ({ initialCount }) => {
    const [count, setCount] = useState(initialCount);
    return (
        <div>
            {count}
            <button onClick={() => setCount(count + 1)}>+</button>
        </div>
    );
};
```

### Prop Types

Props can be any JavaScript value:

```jsx
<MyComponent
    // String
    name="John"
    
    // Number
    age={30}
    
    // Boolean
    isActive={true}
    isActive  // Shorthand for {true}
    
    // Array
    items={[1, 2, 3]}
    
    // Object
    user={{ name: 'John', age: 30 }}
    
    // Function
    onClick={handleClick}
    onClick={() => console.log('clicked')}
    
    // JSX
    icon={<Icon />}
/>
```

---

## 🏗️ Component Composition

### Building Complex UIs from Simple Pieces

Your `PortfolioGanttChart` is a great example of composition:

```jsx
<div className="portfolio-gantt-chart">
    <Header />
    <TimelineViewDropdown 
        selectedView={timelineView}
        onViewChange={setTimelineView}
    />
    <div className="gantt-container">
        <TimelineAxis />
        <div className="projects-container">
            {projects.map(project => (
                <div key={project.id}>
                    <GanttBar {...project} />
                    <MilestoneMarker milestones={project.milestones} />
                </div>
            ))}
        </div>
    </div>
    <PaginationControls 
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
    />
</div>
```

**Benefits**:
- Each component has one job
- Easy to test individual pieces
- Reusable across different pages
- Easy to understand and maintain

---

## 🧪 Hands-On Exercises

### Exercise 1: Create a Simple Component

Create a new file `src/components/ProjectCard.jsx`:

```jsx
import React from 'react';

const ProjectCard = ({ title, status, startDate, endDate }) => {
    const statusColors = {
        'Green': '#10b981',
        'Amber': '#f59e0b',
        'Red': '#ef4444'
    };
    
    return (
        <div style={{
            border: `3px solid ${statusColors[status]}`,
            padding: '16px',
            borderRadius: '8px',
            margin: '8px'
        }}>
            <h3>{title}</h3>
            <p>Status: {status}</p>
            <p>Start: {startDate}</p>
            <p>End: {endDate}</p>
        </div>
    );
};

export default ProjectCard;
```

**Use it**:
```jsx
<ProjectCard 
    title="Project Alpha"
    status="Green"
    startDate="2025-01-01"
    endDate="2025-12-31"
/>
```

### Exercise 2: Lists and Keys

**Question**: Why do we need the `key` prop in lists?

```jsx
// Look at this code from WelcomePage.jsx
{views.map(view => (
    <button key={view.id}>  {/* Why is key needed? */}
        {view.title}
    </button>
))}
```

**Answer**: 
- React uses keys to identify which items changed, were added, or removed
- Without keys, React re-renders ALL items when one changes
- Keys must be unique among siblings
- Don't use array index as key if list can change order

```jsx
// ❌ BAD - Using index as key
{items.map((item, index) => (
    <div key={index}>{item}</div>
))}

// ✅ GOOD - Using unique ID
{items.map(item => (
    <div key={item.id}>{item}</div>
))}
```

### Exercise 3: Conditional Rendering

Add conditional rendering to your project:

```jsx
const StatusBadge = ({ status, showIcon }) => {
    return (
        <div className="status-badge">
            {/* Only show icon if showIcon is true */}
            {showIcon && <span>🔴</span>}
            
            {/* Ternary for different text */}
            <span>{status === 'Red' ? 'At Risk' : 'On Track'}</span>
            
            {/* Multiple conditions */}
            {status === 'Red' && <button>View Details</button>}
            {status === 'Amber' && <button>Review</button>}
            {status === 'Green' && <span>✓</span>}
        </div>
    );
};
```

### Exercise 4: Component Composition Challenge

Create a `MetricsCard` component that composes smaller components:

```jsx
// Small components
const MetricLabel = ({ children }) => (
    <div style={{ fontSize: '12px', color: '#666' }}>{children}</div>
);

const MetricValue = ({ children }) => (
    <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{children}</div>
);

// Composed component
const MetricsCard = ({ label, value, trend }) => {
    return (
        <div style={{ padding: '16px', border: '1px solid #ddd' }}>
            <MetricLabel>{label}</MetricLabel>
            <MetricValue>{value}</MetricValue>
            {trend && <span>{trend > 0 ? '📈' : '📉'}</span>}
        </div>
    );
};

// Usage
<MetricsCard label="Active Projects" value={42} trend={5} />
```

---

## 🎓 Key Takeaways

### Components
- ✅ Components are JavaScript functions that return JSX
- ✅ Component names must start with capital letter
- ✅ Components should be small and focused (single responsibility)
- ✅ Components can be composed to build complex UIs

### JSX
- ✅ JSX is JavaScript, not HTML
- ✅ JavaScript expressions go in curly braces `{}`
- ✅ Use `className` instead of `class`
- ✅ All tags must be closed (self-closing or with closing tag)
- ✅ camelCase for attributes (`onClick`, not `onclick`)

### Props
- ✅ Props pass data from parent to child (one-way flow)
- ✅ Props are read-only (immutable)
- ✅ Destructure props for cleaner code
- ✅ Props can be any JavaScript value
- ✅ `key` prop is special and required for lists

---

## 🚀 Next Steps

Now that you understand components and JSX, you're ready for:
- **Step 2**: State Management - Making your components interactive
- **Step 3**: Effects - Handling side effects and lifecycle

---

## 📝 Self-Check Questions

1. What's the difference between props and state?
2. Why do we need keys in lists?
3. Can you modify props inside a component?
4. What's the difference between `className` and `class`?
5. How do you pass a function as a prop?
6. What happens if a component returns multiple JSX elements without a wrapper?

**Answers**:
1. Props are passed from parent (immutable), state is internal to component (mutable)
2. Keys help React identify which items changed, improving performance
3. No, props are read-only
4. `className` is JSX attribute (JavaScript), `class` is HTML attribute and JS reserved word
5. `<Component onClick={handleClick} />` or `<Component onClick={() => {...}} />`
6. Error - must wrap in parent element or Fragment
