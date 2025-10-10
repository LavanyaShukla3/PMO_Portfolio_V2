# Smart Milestone Label Collision Avoidance

## Problem Statement
Milestone labels in the same row were experiencing issues:
1. **Overlapping** when neighbors were close (e.g., "Process Mining/UK/Pol…" overlapping "Order Processing/Pola…")
2. **Over-truncation** when neighbors were far or non-existent (e.g., "30th: Order Processin…" truncated unnecessarily when it was the last milestone with plenty of space)

The previous algorithm used fixed caps (2.5-24 months) which were either too restrictive or too generous, not adapting to actual available space.

## Solution: Smart Space-Based Calculation

Instead of arbitrary caps, calculate **actual available space** between neighbors with safety margins.

### Algorithm Logic

```
SAFETY_MARGIN = 15% (to prevent touching)

IF no neighbors on same row:
    → 12 months (generous but not excessive)

ELSE IF no LEFT neighbor (first in row):
    → Extend LEFT up to RIGHT neighbor
    → spanMonths = rightSpan × (1 - 0.15)
    → textAnchor = 'end' (right-align, extends LEFT)

ELSE IF no RIGHT neighbor (last in row):
    → Extend RIGHT freely (no right constraint)
    → spanMonths = max(leftSpan × 0.85, 8 months)
    → textAnchor = 'start' (left-align, extends RIGHT)

ELSE (both neighbors exist):
    → Extend BETWEEN neighbors
    → totalSpace = leftSpan + rightSpan
    → spanMonths = totalSpace × (1 - 0.15)
    → textAnchor = 'middle' (center-align, extends BOTH ways)
```

### Key Improvements

1. **Adaptive to actual space**: Uses real distance to neighbors, not fixed caps
2. **Safety margin**: 15% buffer prevents labels from touching neighbors
3. **Smart text anchoring**: 
   - No left neighbor → Right-align (extends left)
   - No right neighbor → Left-align (extends right)
   - Both neighbors → Center-align (extends both ways)
4. **No artificial limits**: Labels can be as long as space allows

## Code Changes

### File: `src/utils/dateUtils.js`

**Location**: `createVerticalMilestoneLabels()` function, lines ~520-580

**Before**:
```javascript
// Fixed caps and complex min/max logic
const MIN_COMFORTABLE_SPAN = 3;
const MAX_SPAN = 3;
spanMonths = Math.min(rightSpan * 0.75, MAX_SPAN); // Capped at 3
```

**After**:
```javascript
// Direct space-based calculation
const SAFETY_MARGIN = 0.15; // 15% safety buffer
spanMonths = rightSpan * (1 - SAFETY_MARGIN); // Uses actual space
```

## Examples

### Example 1: Close Neighbors (Overlap Prevention)
**Scenario**: "Process Mining/UK/Poland..." and "Order Processing/Poland..." are 2 months apart

```
Current milestone: Oct 2025
Right neighbor: Dec 2025 (2 months away)

Calculation:
rightSpan = 2.0 months
spanMonths = 2.0 × (1 - 0.15) = 1.7 months = ~170px = ~12 characters

Result: "Process Mi..." (truncated to prevent overlap) ✅
```

### Example 2: Far Right Neighbor (No Over-truncation)
**Scenario**: "30th: Order Processing..." is last milestone with neighbor 8 months to the left

```
Current milestone: Oct 2025  
Left neighbor: Feb 2025 (8 months ago)
Right neighbor: None

Calculation:
leftSpan = 8.0 months
spanMonths = max(8.0 × 0.85, 8) = 8 months = ~800px = ~57 characters

Result: "30th: Order Processing/PFNA DSD SG3" (full text!) ✅
```

### Example 3: Both Neighbors Far Apart (Use Full Space)
**Scenario**: "28th: Order Processing..." has space between neighbors

```
Current milestone: Oct 2025
Left neighbor: May 2025 (5 months ago)
Right neighbor: Jan 2026 (3 months ahead)

Calculation:
leftSpan = 5.0 months
rightSpan = 3.0 months
totalSpace = 8.0 months
spanMonths = 8.0 × (1 - 0.15) = 6.8 months = ~680px = ~48 characters

Result: "28th: Order Processing/PFNA DSD SG3" (full or nearly full) ✅
```

## Expected Results

### Fixed Issues:
✅ **No overlap** when milestones are close together
✅ **No over-truncation** when milestones have plenty of space  
✅ **Smart adaptation** based on actual neighbor distances
✅ **Labels use available space efficiently**

### Visual Outcomes:
- "Process Mining/UK/Pol…" + "Order Processing/Pola…" → Properly truncated, no overlap
- "30th: Order Processin…" → Now shows full text: "30th: Order Processing/PFNA DSD SG3"
- "31st: Process Mining/…" → Shows more context: "31st: Process Mining/Mexico/Brazil SG3"
- "28th: Order Processing/…" → Full text where space allows

## Trade-offs

### Pros:
✅ Intelligent space usage - no wasted truncation
✅ Prevents collisions with 15% safety margin
✅ Adapts to any layout automatically
✅ Simple, predictable algorithm

### Cons:
⚠️ Labels may vary in length based on neighbors (not uniform)
💡 This is actually desired behavior - maximize information density

## Testing Checklist

- [ ] View Gantt chart with milestone labels
- [ ] Verify close milestones don't overlap (1-2 month spacing)
- [ ] Verify distant milestones show full text (6+ month spacing)
- [ ] Check edge milestones (first/last in row) extend properly
- [ ] Confirm middle milestones use space between neighbors
- [ ] Test various zoom levels
- [ ] Hover over truncated labels to see full text in tooltip

## Date
October 10, 2025
