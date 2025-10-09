/**
 * Test script to manually calculate milestone positions
 * This will help us understand the 2-month offset issue
 */

// Simulate the calculation logic from dateUtils.js

function calculateMilestonePosition(date, startDate, monthWidth = 100) {
    console.log('\n=== MILESTONE POSITION CALCULATION ===');
    console.log('Input date:', date);
    console.log('Start date:', startDate);
    console.log('Month width:', monthWidth);
    
    // Create clean month start dates
    const startMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const targetMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    
    console.log('\nNormalized dates:');
    console.log('Start month:', startMonth.toISOString());
    console.log('Target month:', targetMonth.toISOString());
    
    // Calculate exact months difference
    const monthsDiff = (targetMonth.getFullYear() - startMonth.getFullYear()) * 12 + 
                      (targetMonth.getMonth() - startMonth.getMonth());
    
    console.log('\nMonths calculation:');
    console.log('Target year:', targetMonth.getFullYear(), 'Start year:', startMonth.getFullYear());
    console.log('Target month (0-based):', targetMonth.getMonth(), 'Start month (0-based):', startMonth.getMonth());
    console.log('Year difference:', targetMonth.getFullYear() - startMonth.getFullYear(), 'years');
    console.log('Month difference within year:', targetMonth.getMonth() - startMonth.getMonth());
    console.log('Total months difference:', monthsDiff);
    
    // Calculate position within the target month
    const daysIntoMonth = date.getDate() - 1; // 0-based day within month
    const daysInTargetMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate();
    
    console.log('\nDay calculation:');
    console.log('Date day:', date.getDate());
    console.log('Days into month (0-based):', daysIntoMonth);
    console.log('Total days in target month:', daysInTargetMonth);
    console.log('Fraction of month:', daysIntoMonth / daysInTargetMonth);
    
    // Precise position calculation
    const position = monthsDiff * monthWidth + (daysIntoMonth / daysInTargetMonth) * monthWidth;
    
    console.log('\nFinal position:');
    console.log('Base position (months * width):', monthsDiff * monthWidth, 'px');
    console.log('Within-month offset:', (daysIntoMonth / daysInTargetMonth) * monthWidth, 'px');
    console.log('TOTAL POSITION:', position, 'px');
    console.log('This places the milestone at month index:', monthsDiff);
    
    return position;
}

function simulateTimelineAxis(startDate, monthWidth = 100) {
    console.log('\n=== TIMELINE AXIS SIMULATION ===');
    console.log('Timeline starts at:', startDate.toISOString());
    console.log('\nMonth labels:');
    
    for (let i = 0; i <= 12; i++) {
        const monthDate = new Date(startDate);
        monthDate.setMonth(startDate.getMonth() + i);
        const position = i * monthWidth;
        const monthName = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        console.log(`  Month ${i}: ${monthName} at ${position}px`);
    }
}

// Test Case 1: June 2026 milestone appearing in April 2026
console.log('\n\n========================================');
console.log('TEST CASE 1: AccountIQ/Brazil SG3 Milestone');
console.log('========================================');

// Assuming current date is around October 2025 (when this issue was reported)
const today = new Date('2025-10-09'); // Simulating current date
console.log('Today:', today.toISOString());

// Calculate startDate using getCurrent14MonthsRange logic
// Shows previous month to 12 months ahead
const startOfMonthFunc = (date) => new Date(date.getFullYear(), date.getMonth(), 1);
const subMonthsFunc = (date, months) => {
    const result = new Date(date);
    result.setMonth(date.getMonth() - months);
    return result;
};

const startDate = startOfMonthFunc(subMonthsFunc(today, 1));
console.log('Timeline startDate (previous month):', startDate.toISOString());

// The milestone date from database
const milestoneDate = new Date('2026-06-30T00:00:00.000Z');
console.log('Milestone date:', milestoneDate.toISOString());

// Calculate position
const position = calculateMilestonePosition(milestoneDate, startDate, 100);

// Show what the timeline axis would display
simulateTimelineAxis(startDate, 100);

console.log('\n\n========================================');
console.log('ANALYSIS');
console.log('========================================');
console.log('If the milestone appears at position', position, 'px');
console.log('And each month is 100px wide');
console.log('Then it appears at month index:', Math.floor(position / 100));
console.log('Which should be:', startDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }), '+ ', Math.floor(position / 100), 'months');

const expectedMonth = new Date(startDate);
expectedMonth.setMonth(startDate.getMonth() + Math.floor(position / 100));
console.log('Expected month label:', expectedMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
console.log('Actual milestone date:', milestoneDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));

if (expectedMonth.getMonth() !== milestoneDate.getMonth() || expectedMonth.getFullYear() !== milestoneDate.getFullYear()) {
    console.log('\n⚠️ MISMATCH DETECTED!');
    console.log('The milestone is being positioned in the wrong month!');
    const monthDiff = (milestoneDate.getFullYear() - expectedMonth.getFullYear()) * 12 + 
                     (milestoneDate.getMonth() - expectedMonth.getMonth());
    console.log('Offset:', monthDiff, 'months');
} else {
    console.log('\n✅ Position is CORRECT!');
}
