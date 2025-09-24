# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm start` - Start development server (with ESLint disabled)
- `npm run build` - Build for production
- `npm test` - Run tests
- `npm run eject` - Eject from Create React App (not recommended)

## Architecture Overview

This is a React-based PMO (Portfolio Management Office) frontend application built with Create React App. The application provides interactive Gantt chart visualizations for portfolio roadmaps with multi-level drill-down capabilities.

### Key Components Structure

**Main Application Flow:**
- `App.jsx` - Main app component with view routing and data validation
- `GlobalDataCacheContext.jsx` - Centralized data management with progressive loading
- Four main views: Portfolio → Program → Sub-Program → Region

**Page Components:**
- `PortfolioGanttChart.jsx` - Top-level portfolio view
- `ProgramGanttChart.jsx` - Program-level drill-down
- `SubProgramGanttChartFull.jsx` - Sub-program detail view
- `RegionRoadMap.jsx` - Regional roadmap view

**Reusable Components:**
- `GanttBar.jsx` - Individual Gantt chart bars
- `TimelineAxis.jsx` - Timeline visualization
- `TimelineViewDropdown.jsx` - Timeline view selector
- `MilestoneMarker.jsx` - Milestone indicators
- `PaginationControls.jsx` - Data pagination
- `LoadingSpinner.jsx` - Loading states

### Data Architecture

**Progressive Loading Strategy:**
1. Portfolio data loads first for immediate UI display
2. Background loading continues for Program, Sub-Program, and Region data
3. Global cache context manages all data with 30-minute expiry
4. State preservation across view navigation

**API Services:**
- `progressiveApiService.js` - Main API service for data fetching
- `optimizedApiService.js` - Performance-optimized API calls
- `apiDataService.js` - Legacy service (backward compatibility)
- `paginationService.js` - Handles paginated data

**Data Flow:**
- API endpoints expect `/api/data` for unified backend data
- Backend proxy configured for `http://localhost:5000`
- Data validation through `apiValidation.js`
- Support for both mock and live Databricks data modes

### State Management

**Global Data Cache Context:**
- Centralized data storage with React Context
- Background data loading with Promise.all
- View state preservation (pagination, filters, zoom levels)
- Cache invalidation and refresh capabilities

**View Navigation:**
- Portfolio → Program (drill-down by portfolio ID)
- Program → Sub-Program (drill-down by sub-program ID)
- Breadcrumb navigation with preserved state
- View state includes: currentPage, filters, zoomLevel, timelineView

### Styling

- Tailwind CSS for styling
- Responsive design for various screen sizes
- Timeline visualization with dynamic month widths based on viewport
- Loading indicators and progress bars

### Key Features

**Timeline Views:**
- "14 Months in Future" and "14 Months in Past" options
- Dynamic zoom levels and month width calculations
- Full timeline view as default

**Data Export:**
- JSON export utilities in `jsonExportUtils.js`
- Export functionality for various data formats

**Performance:**
- Virtualized rendering for large datasets
- Progressive data loading to minimize initial load time
- Background caching for smooth view transitions
- Optimized API calls with pagination support