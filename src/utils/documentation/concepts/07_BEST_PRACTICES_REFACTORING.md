# Best Practices & Refactoring (PMO Portfolio)

> **Write clean, maintainable React code and refactor with confidence, using lessons from your project.**

---

## 🏆 Best Practices

### 1. Component Organization
- Keep components small and focused
- Use folders for related components (see `/src/components`)

### 2. State Management
- Use local state for UI, context/reducer for global data
- Avoid unnecessary state in parent components

### 3. Naming Conventions
- Use clear, descriptive names for components, props, and state

### 4. Avoid Prop Drilling
- Use Context API for deeply shared data

### 5. Side Effects
- Use useEffect for data fetching, subscriptions, and cleanup
- Always clean up effects to avoid memory leaks

### 6. Performance
- Memoize expensive calculations and functions
- Lazy load components/pages

### 7. Error Handling
- Show user-friendly error messages
- Catch errors in async functions

---

## 🔄 Refactoring Patterns
- Extract reusable logic into custom hooks
- Split large components into smaller ones
- Move utility functions to `/src/utils`
- Replace prop drilling with context
- Use useReducer for complex state

---

## 🧠 Interview Questions (Best Practices)
- How do you organize a large React project?
- What are common mistakes beginners make?
- How do you refactor a component for better readability?
- How do you handle errors in React?

---

## 💡 Eureka Concepts
- **React is declarative: UI = function(state)**
- **Small components are easier to test and maintain**
- **Custom hooks = reusable logic**
- **Context and reducer = scalable state management**

---

## 🚀 Practice & Next Steps
- Refactor a large component into smaller ones
- Create a custom hook for a repeated pattern
- Audit your project for prop drilling and replace with context
- Explain your refactoring process in interviews

---

> **Use this guide to write better React code and prepare for interview questions on best practices and refactoring!**
