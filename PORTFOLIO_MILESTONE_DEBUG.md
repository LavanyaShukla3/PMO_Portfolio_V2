# Portfolio Page Milestone Debugging

## Issue Report

### Examples of Misalignment:
1. **Process Mining DACH/NWE/SWE SG3**
   - Expected: November 1, 2025 (01-11-2025)
   - Actual: Showing at Dec 2025/start of Jan 2026
   - Offset: ~1-2 months LATER

2. **Order Processing/PFNA DSD SG3**
   - Expected: March 1, 2025 (01-03-2025)
   - Actual: Showing at end of Feb 2026/start of March 2026
   - Offset: ~12 months LATER (!!!)

## Debugging Added

### Enhanced Console Logging

Added detailed logging to `processMilestonesWithPosition` function:

```javascript
console.log(`🎯 Portfolio Milestone Position: "${milestone.label}" date=${milestone.date}`, {
    parsedDate: milestoneDate?.toISOString(),
    calculatedX: x,
    monthWidth: monthWidth,
    timelineStartDate: timelineStartDate?.toISOString(),
    monthsDiff: Math.floor(x / monthWidth),
    isFirstInMonth
});
```

### What to Look For in Console

When you navigate to the Portfolio page and open the browser console, look for:

1. **🎯 Portfolio Milestone Position** logs showing:
   - The milestone label
   - The date string from data
   - The parsed ISO date
   - The calculated X position
   - The monthWidth being used
   - The timeline start date

2. **📏 Position calculations** logs showing:
   - Gantt bar positions (startX, endX)
   - Timeline start date
   - Month width

### Expected vs Actual Analysis

For a milestone dated "01-11-2025" (November 1, 2025):

**If timeline starts at September 2025:**
- Month difference: 2 months (Sep → Oct → Nov)
- Expected position: 2 × monthWidth + (0 days into month)
- Example with monthWidth=102: 2 × 102 = 204px

**If showing at January 2026:**
- Actual position: 4 months × monthWidth
- Example with monthWidth=102: 4 × 102 = 408px
- **Offset: 2 months TOO FAR RIGHT**

## Possible Root Causes

### 1. Date Format Parsing Issue
The date format "01-11-2025" might be parsed as:
- DD-MM-YYYY (November 1, 2025) ✅ Expected
- MM-DD-YYYY (January 11, 2025) ❌ Wrong!
- Could be causing American date format confusion

### 2. Wrong Timeline Start Date
If milestone calculation uses a different `startDate` than the timeline axis, positions would be offset.

### 3. Data Transform Issue
The Portfolio page might be transforming milestone dates somewhere in the data pipeline.

### 4. Browser Date Parsing
JavaScript's `new Date()` might interpret date strings differently depending on format.

## Next Steps

1. **Run the application** and open Portfolio page
2. **Open browser console** (F12)
3. **Look for the debug logs** for the problematic milestones
4. **Compare** the parsed dates with expected dates
5. **Share console output** for:
   - Process Mining DACH/NWE/SWE SG3 milestone
   - Order Processing/PFNA DSD SG3 milestone

## Testing Checklist

- [ ] Navigate to Portfolio page
- [ ] Open browser console (F12)
- [ ] Find "Order Management" projects
- [ ] Locate "Process Mining DACH/NWE/SWE" project
- [ ] Check console for `🎯 Portfolio Milestone Position` logs
- [ ] Verify the `parsedDate` matches the expected date
- [ ] Check if `calculatedX` position matches the visual position
- [ ] Compare with `📏 Position calculations` for Gantt bars
- [ ] Share the console logs

---

**Debug Date:** 2025-10-09
**Status:** ⏳ Awaiting console output to diagnose
