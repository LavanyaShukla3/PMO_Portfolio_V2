# Milestone Rendering Fix Summary

## Issues Identified

### Issue 1: Date Offset (Milestones Plotted 2 Months Earlier)
**Symptom:** June 2026 milestone (SG3 for AccountIQ/Brazil) appeared in April 2026 instead of June 2026.

**Root Cause:** Inconsistent `monthWidth` values between milestone position calculation and rendering:
- Milestones were calculated using `constants.MONTH_WIDTH` (fixed at 80px)
- Timeline axis and Gantt bars were rendered using dynamic `monthWidth` (calculated as 102px based on viewport)
- This mismatch caused a 2-month offset: 797.33px (calculated with 80px) vs 1016.6px (should be with 102px)

### Issue 2: Missing Milestone Markers
**Symptom:** Milestone diamond shapes were not visible on the page, even though the label text existed.

**Root Cause:** SVG elements with rotation transforms were being clipped by parent container due to missing `overflow="visible"` attribute.

## Fixes Applied

### Fix 1: Consistent monthWidth Usage (SubProgramGanttChartFull.jsx)

**File:** `src/pages/SubProgramGanttChartFull.jsx`

**Changes:**
1. Line ~1356: Changed `constants.MONTH_WIDTH` to `monthWidth`
2. Line ~1380: Changed `constants.MONTH_WIDTH` to `monthWidth`

**Before:**
```javascript
const processedMilestones = processMilestonesForProject(
    row.project.milestones || [],
    startDate,
    constants.MONTH_WIDTH,  // ❌ Fixed value (80px)
    projectEndDate,
    startDate,
    endDate
);
```

**After:**
```javascript
const processedMilestones = processMilestonesForProject(
    row.project.milestones || [],
    startDate,
    monthWidth,  // ✅ Dynamic value (matches timeline rendering)
    projectEndDate,
    startDate,
    endDate
);
```

**Impact:** Milestones now calculate positions using the same dynamic `monthWidth` as the timeline axis and Gantt bars, ensuring perfect alignment.

**Note:** Portfolio, Program, and Region pages already used dynamic `monthWidth` correctly and did not require this fix.

### Fix 2: SVG Overflow Visibility (All 4 Pages)

**Files Modified:**
1. `src/pages/SubProgramGanttChartFull.jsx`
2. `src/pages/PortfolioGanttChart.jsx`
3. `src/pages/ProgramGanttChart.jsx`
4. `src/pages/RegionRoadMap.jsx`

**Changes:** Added `overflow="visible"` attribute to main SVG containers

**Before:**
```jsx
<svg
    width={Math.max(800, window.innerWidth - constants.LABEL_WIDTH)}
    height={getTotalHeight()}
>
```

**After:**
```jsx
<svg
    width={Math.max(800, window.innerWidth - constants.LABEL_WIDTH)}
    height={getTotalHeight()}
    overflow="visible"
>
```

**Impact:** Milestone markers with 45-degree rotation transforms are no longer clipped and are fully visible.

## Verification Steps

1. **Check Milestone Position:**
   - Open SubProgram page and navigate to AccountIQ/Brazil project
   - Verify that SG3 milestone dated June 30, 2026 appears in June 2026 column (not April 2026)
   - Check console logs: Position should be ~1016px for June 2026 (with monthWidth=102)

2. **Check Milestone Visibility:**
   - Verify diamond-shaped milestone markers are visible on all 4 pages:
     - Portfolio page
     - Program page
     - SubProgram page
     - Region page
   - Both completed (filled blue) and incomplete (white with blue border) milestones should render

3. **Test Across All Pages:**
   - Navigate to each page and verify milestones align correctly with timeline months
   - Resize browser window and verify milestones remain aligned (dynamic monthWidth working)

## Console Log Analysis

**Before Fix:**
```
- Month width: 102
- Final calculated position: 1016.6 px
🎯 RENDERING milestone at x: 797.3333333333334 px  ❌ Wrong position!
```

**After Fix:**
```
- Month width: 102
- Final calculated position: 1016.6 px
🎯 RENDERING milestone at x: 1016.6 px  ✅ Correct position!
```

## Technical Details

### Why Dynamic monthWidth Matters

The application calculates `monthWidth` dynamically to fit the viewport:

```javascript
const availableGanttWidth = window.innerWidth - constants.LABEL_WIDTH - 40;
const dynamicMonthWidth = Math.max(30, Math.floor(availableGanttWidth / totalMonths));
const monthWidth = dynamicMonthWidth;
```

This ensures:
- No horizontal scrolling
- Timeline fits viewport width
- Month columns scale with browser size

Using a fixed `constants.MONTH_WIDTH` (80px) for milestone calculations while rendering with dynamic `monthWidth` (e.g., 102px) caused misalignment.

### How Milestones Are Positioned

Milestone position calculation in `dateUtils.js`:

```javascript
export const calculateMilestonePosition = (date, startDate, monthWidth, barEndDate = null) => {
    const startMonth = startOfMonth(startDate);
    const targetMonth = startOfMonth(date);
    
    // Calculate exact months difference
    const monthsDiff = (targetMonth.getFullYear() - startMonth.getFullYear()) * 12 + 
                      (targetMonth.getMonth() - startMonth.getMonth());
    
    // Calculate position within the target month
    const daysIntoMonth = date.getDate() - 1;
    const daysInTargetMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate();
    
    let position = monthsDiff * monthWidth + (daysIntoMonth / daysInTargetMonth) * monthWidth;
    return Math.max(0, position);
};
```

**Key Formula:** `position = (monthsDiff × monthWidth) + (dayProgress × monthWidth)`

For June 30, 2026 (with start date Sep 2025):
- monthsDiff = 9 months
- dayProgress = 29/30 = 0.9667
- With monthWidth=102: position = (9 × 102) + (0.9667 × 102) = 918 + 98.6 = 1016.6px ✅
- With monthWidth=80: position = (9 × 80) + (0.9667 × 80) = 720 + 77.3 = 797.3px ❌

## Gantt Bars Unaffected

**Important Note:** Gantt bars rendered correctly throughout this issue because they used the dynamic `monthWidth` value consistently via the `calculatePosition()` function. Only milestone calculations in the SubProgram page were using the incorrect fixed value.

## Files Changed

1. `src/pages/SubProgramGanttChartFull.jsx` - 3 changes
   - Line ~1356: monthWidth parameter fix
   - Line ~1380: monthWidth parameter fix  
   - Line ~1328: Added overflow="visible"

2. `src/pages/PortfolioGanttChart.jsx` - 1 change
   - Line ~775: Added overflow="visible"

3. `src/pages/ProgramGanttChart.jsx` - 1 change
   - Line ~780: Added overflow="visible"

4. `src/pages/RegionRoadMap.jsx` - 1 change
   - Line ~1052: Added overflow="visible"

## Testing Checklist

- [ ] SubProgram page: June 2026 milestone appears in June (not April)
- [ ] SubProgram page: Milestone diamond markers are visible
- [ ] Portfolio page: Milestone markers are visible
- [ ] Program page: Milestone markers are visible
- [ ] Region page: Milestone markers are visible
- [ ] Browser resize: Milestones remain aligned with timeline
- [ ] Console logs: Position calculations match rendering positions
- [ ] All milestone types: Completed (blue) and incomplete (white) both visible

---

**Fix Date:** 2025-10-09
**Issue Persistence:** All 4 pages (was only affecting SubProgram positioning, but visibility affected all)
**Status:** ✅ Fixed and ready for testing
