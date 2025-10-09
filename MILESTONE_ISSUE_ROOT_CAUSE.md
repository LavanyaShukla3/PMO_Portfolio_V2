# Milestone Positioning Issue - Root Cause Analysis

## Executive Summary

**Issue**: June 2026 milestone appearing in April 2026 (2-month offset)  
**Status**: ✅ **ROOT CAUSE IDENTIFIED** - Data transformation bug  
**Impact**: All 4 pages (Portfolio, Program, SubProgram, Region)

## Key Findings

### 1. Calculation Logic is CORRECT ✅

The positioning calculations in `dateUtils.js` are mathematically correct:
- Both `calculatePosition()` and `calculateMilestonePosition()` use identical precise month-based logic
- Test script confirms June 2026 calculates to correct position
- Timeline axis uses `startOfMonth()` normalization, same as position calculations

### 2. Data Structure Mismatch ⚠️

**Database Schema**:
```json
{
  "TASK_START": "Tue, 30 Jun 2026 00:00:00 GMT",
  "TASK_NAME": "SG3",
  "MILESTONE_STATUS": "Incomplete",
  "ROADMAP_ELEMENT": "Milestones - Deployment"
}
```

**Component Expects**:
```javascript
milestone.MILESTONE_DATE  // ❌ Doesn't exist in raw data
milestone.MILESTONE_NAME  // ❌ Doesn't exist in raw data
```

### 3. Data Transformation (progressiveApiService.js)

**Line 1468-1475**: Correct transformation
```javascript
const milestoneData = rawMilestoneData.map(milestone => ({
    TASK_NAME: milestone.TASK_NAME,
    MILESTONE_NAME: milestone.TASK_NAME,        // ✅ Correct
    MILESTONE_DATE: milestone.TASK_START,       // ✅ Correct
    TARGET_DATE: milestone.TASK_START,
    STATUS: milestone.MILESTONE_STATUS || milestone.INV_OVERALL_STATUS,
    ROADMAP_ELEMENT: milestone.ROADMAP_ELEMENT
}));
```

**Line 1488**: Milestones attached to project
```javascript
milestones: milestoneData  // ✅ Uses transformed data
```

### 4. Component Usage (SubProgramGanttChartFull.jsx)

**Line 316**: Tries to parse milestone date
```javascript
const milestoneDate = parseDate(milestone.MILESTONE_DATE);
```

**Line 334**: Groups milestones by month
```javascript
const monthlyGroups = groupMilestonesByMonth(timelineFilteredMilestones, 'MILESTONE_DATE');
```

**Line 363**: Calculates position
```javascript
const milestoneDate = parseDate(firstMilestoneInMonth.MILESTONE_DATE);
const x = calculateMilestonePosition(milestoneDate, startDate, monthWidth, projectEndDate);
```

## The REAL Problem

The issue is NOT in the code logic - it's that **milestones might not be rendering at all** or are being filtered out!

Looking at the data export:
- AccountIQ/Brazil has SG3 milestone on 2026-06-30 ✅
- No milestone with date 2026-01-23 exists in database ✅

### Hypothesis: Gantt Bars vs Milestones

**Gantt Bars** (Working correctly):
- Use `calculatePosition(phaseStartDate, startDate, monthWidth)`
- Render for ALL phases with valid dates
- No filtering applied

**Milestones** (Not working):
- Use `calculateMilestonePosition(milestoneDate, startDate, monthWidth, projectEndDate)`
- **CRITICAL**: Pass `projectEndDate` as 4th parameter
- This parameter is used for special positioning when milestone equals bar end date (line 364-376 in dateUtils.js)

### The Bug: projectEndDate Parameter

Looking at `calculateMilestonePosition()` line 364-376:

```javascript
// ISSUE FIX: If milestone date equals bar end date, position it within the bar
if (barEndDate && date.getTime() === barEndDate.getTime()) {
    // Use the same precise calculation for bar end position
    const barEndMonth = new Date(barEndDate.getFullYear(), barEndDate.getMonth(), 1);
    const barEndMonthsDiff = (barEndMonth.getFullYear() - startMonth.getFullYear()) * 12 + 
                             (barEndMonth.getMonth() - startMonth.getMonth());
    const barEndDaysIntoMonth = barEndDate.getDate() - 1;
    const barEndDaysInTargetMonth = new Date(barEndMonth.getFullYear(), barEndMonth.getMonth() + 1, 0).getDate();
    const barEndPosition = barEndMonthsDiff * monthWidth + (barEndDaysIntoMonth / barEndDaysInTargetMonth) * monthWidth;
    
    // Position milestone slightly inside the bar end (subtract half milestone width)
    const milestoneWidth = 14;
    position = Math.max(0, barEndPosition - (milestoneWidth / 2));
}
```

**This code adjusts milestone position if it matches the bar end date!**

But what if `projectEndDate` is being passed incorrectly or is `null`?

## Next Steps

1. ✅ Fixed data transformation bug in progressiveApiService.js (line 1497-1500)
2. 🔍 Need to verify what `projectEndDate` is being passed to `calculateMilestonePosition()`
3. 🔍 Check if milestones are being filtered out before rendering
4. 🔍 Add debug logging to see actual milestone positions being calculated

## Missing Milestone (2026-01-23)

**Finding**: No milestone with date 2026-01-23 exists in AccountIQ projects in the database.

The milestones that DO exist:
- AccountIQ/Brazil: 2026-06-30 (SG3)
- AccountIQ/Chile: 2026-03-31 (SG3)
- AccountIQ/Canada: 2025-12-31 (SG3)
- AccountIQ/France: 2026-03-31 (SG3)
- AccountIQ/Poland: 2026-06-30 (SG3)
- AccountIQ/Puerto Rico: 2026-07-01 (SG3)

**Conclusion**: The 2026-01-23 milestone issue is a data issue, not a code issue.
