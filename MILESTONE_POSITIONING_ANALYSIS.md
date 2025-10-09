# Milestone Positioning Issue Analysis

## Summary of Findings

### Live Data Retrieved
From AccountIQ/Brazil project:
- **SG3 Milestone Date**: `Tue, 30 Jun 2026 00:00:00 GMT` (June 30, 2026)
- **Expected Position**: June 2026 on timeline
- **Actual Position**: April 2026 (2 months earlier)
- **Status**: Incomplete

### Key Code Locations

1. **Gantt Bar Positioning**: Uses `calculatePosition()` in `dateUtils.js` (line 388)
2. **Milestone Positioning**: Uses `calculateMilestonePosition()` in `dateUtils.js` (line 286)
3. **Timeline Axis Rendering**: `TimelineAxis.jsx` uses `addMonths(startDate, i)` (line 19)

## Root Cause Analysis

### Both Functions Use IDENTICAL Logic ✅

Looking at `dateUtils.js`:

**calculatePosition()** (lines 388-427):
```javascript
const startMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
const targetMonth = new Date(date.getFullYear(), date.getMonth(), 1);
const monthsDiff = (targetMonth.getFullYear() - startMonth.getFullYear()) * 12 + 
                  (targetMonth.getMonth() - startMonth.getMonth());
const daysIntoMonth = date.getDate() - 1;
const daysInTargetMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate();
const position = monthsDiff * monthWidth + (daysIntoMonth / daysInTargetMonth) * monthWidth;
```

**calculateMilestonePosition()** (lines 286-379):
```javascript
const startMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
const targetMonth = new Date(date.getFullYear(), date.getMonth(), 1);
const monthsDiff = (targetMonth.getFullYear() - startMonth.getFullYear()) * 12 + 
                  (targetMonth.getMonth() - startMonth.getMonth());
const daysIntoMonth = date.getDate() - 1;
const daysInTargetMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate();
let position = monthsDiff * monthWidth + (daysIntoMonth / daysInTargetMonth) * monthWidth;
```

**BOTH USE THE EXACT SAME CALCULATION!** ✅

### The Real Issue: Timeline Axis vs Position Calculation Mismatch ⚠️

**TimelineAxis.jsx** (line 19):
```javascript
const currentMonth = addMonths(startDate, i);
```

This uses `addMonths()` which operates on the **ORIGINAL startDate** (not normalized to month start).

**Position Calculation** (dateUtils.js):
```javascript
const startMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
```

This normalizes startDate to the **FIRST DAY OF THE MONTH**.

### Example Scenario

If `startDate = "2025-08-15"` (August 15, 2025):

**TimelineAxis renders:**
- Month 0: `addMonths("2025-08-15", 0)` = Aug 15, 2025 → displays "Aug 2025"
- Month 1: `addMonths("2025-08-15", 1)` = Sep 15, 2025 → displays "Sep 2025"
- Month 2: `addMonths("2025-08-15", 2)` = Oct 15, 2025 → displays "Oct 2025"

**Position calculation uses:**
- startMonth = `new Date(2025, 7, 1)` = Aug 1, 2025
- For a date on June 30, 2026:
  - targetMonth = `new Date(2026, 5, 1)` = Jun 1, 2026
  - monthsDiff = (2026-2025)*12 + (5-7) = 12 - 2 = 10 months
  - Position = 10 * monthWidth

**But TimelineAxis shows:**
- Month 10 from Aug 15, 2025 = `addMonths("2025-08-15", 10)` = Jun 15, 2026 → displays "Jun 2026"

**HOWEVER**, if the startDate happens to be mid-month, the visual alignment can be off!

## The ACTUAL Problem

Looking at the debug logs in `calculateMilestonePosition()` (lines 352-360):

```javascript
console.log('  - Timeline months from start (using ORIGINAL startDate - what TimelineAxis renders):');
console.log(`    Month 0: ${format(startDate, 'MMM yyyy')} at position 0px`);
console.log(`    Month 1: ${format(addMonths(startDate, 1), 'MMM yyyy')} at position ${monthWidth}px`);
```

The code is AWARE of this discrepancy and logs both:
1. What the position calculation uses (normalized to month start)
2. What TimelineAxis actually renders (using original startDate)

## Why Gantt Bars Work But Milestones Don't

**Gantt Bars**: Start and end dates are typically at the beginning/end of phases, so the positioning works correctly.

**Milestones**: Are point-in-time markers, so any misalignment is immediately visible.

## The 2-Month Offset Mystery

If June 2026 milestone is appearing in April 2026, that's a 2-month backward shift.

This suggests:
1. The `startDate` being passed might be 2 months LATER than expected
2. OR the calculation is using a different reference point

## Missing Milestone Issue

From the data export, there's NO milestone with date `2026-01-23` in the AccountIQ projects.

The milestones found are:
- AccountIQ/Brazil: 2026-06-30 (SG3)
- AccountIQ/Chile: 2026-03-31 (SG3)
- AccountIQ/Canada: 2025-12-31 (SG3)
- AccountIQ/France: 2026-03-31 (SG3)
- AccountIQ/Poland: 2026-06-30 (SG3)
- AccountIQ/Puerto Rico: 2026-07-01 (SG3)

**The 2026-01-23 milestone doesn't exist in the database for AccountIQ projects.**

## Solution

The fix needs to ensure that:
1. **TimelineAxis** uses the same normalized month-start date as the position calculations
2. **OR** position calculations use the original startDate without normalization

### Recommended Fix

Modify `TimelineAxis.jsx` to normalize the startDate before generating months:

```javascript
const generateMonths = () => {
    const months = [];
    // NORMALIZE startDate to month start (same as position calculations)
    const normalizedStartDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const totalMonths = Math.max(1, differenceInMonths(endDate, normalizedStartDate) + 1);
    
    for (let i = 0; i < totalMonths; i++) {
        const currentMonth = addMonths(normalizedStartDate, i);
        // ... rest of code
    }
}
```

This ensures TimelineAxis and position calculations use the same reference point.
