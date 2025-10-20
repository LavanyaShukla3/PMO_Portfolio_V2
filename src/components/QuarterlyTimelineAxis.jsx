import React from 'react';
import format from 'date-fns/format';
import addMonths from 'date-fns/addMonths';
import differenceInMonths from 'date-fns/differenceInMonths';
import getMonth from 'date-fns/getMonth';
import getYear from 'date-fns/getYear';

/**
 * QuarterlyTimelineAxis - Displays quarters instead of months for 36-month views
 * Each quarter spans 3 months and is centered across them
 * Format: "2026 Q1", "2026 Q2", etc.
 */
const QuarterlyTimelineAxis = ({
    startDate = new Date(),
    endDate = addMonths(new Date(), 12),
    monthWidth = 100,
    fontSize = '14px',
    totalWidth = '100%'
}) => {
    const generateQuarters = () => {
        const quarters = [];
        const totalMonths = Math.max(1, differenceInMonths(endDate, startDate) + 1);
        
        // Group months into quarters
        let currentQuarterStart = null;
        let currentQuarterMonths = [];
        let currentQuarterLabel = '';
        
        for (let i = 0; i < totalMonths; i++) {
            const currentMonth = addMonths(startDate, i);
            const monthIndex = getMonth(currentMonth); // 0-11
            const year = getYear(currentMonth);
            const quarter = Math.floor(monthIndex / 3) + 1; // 1-4
            const quarterLabel = `${year} Q${quarter}`;
            
            // Check if we're starting a new quarter
            if (currentQuarterLabel !== quarterLabel) {
                // Save previous quarter if it exists
                if (currentQuarterStart !== null && currentQuarterMonths.length > 0) {
                    quarters.push({
                        label: currentQuarterLabel,
                        xPosition: currentQuarterStart * monthWidth,
                        width: currentQuarterMonths.length * monthWidth,
                        monthCount: currentQuarterMonths.length
                    });
                }
                
                // Start new quarter
                currentQuarterLabel = quarterLabel;
                currentQuarterStart = i;
                currentQuarterMonths = [currentMonth];
            } else {
                // Continue current quarter
                currentQuarterMonths.push(currentMonth);
            }
        }
        
        // Add the last quarter
        if (currentQuarterStart !== null && currentQuarterMonths.length > 0) {
            quarters.push({
                label: currentQuarterLabel,
                xPosition: currentQuarterStart * monthWidth,
                width: currentQuarterMonths.length * monthWidth,
                monthCount: currentQuarterMonths.length
            });
        }
        
        return quarters;
    };
    
    const quarters = generateQuarters();

    return (
        <div className="flex bg-white border-b border-gray-200" style={{ width: totalWidth }}>
            <div
                className="flex"
                style={{
                    width: '100%'
                }}
            >
                {quarters.map((quarter, index) => (
                    <div
                        key={`${quarter.label}-${index}`}
                        className="flex-shrink-0 p-1 text-xs font-medium text-gray-600 border-r border-gray-200 flex items-center justify-center bg-white"
                        style={{
                            width: `${quarter.width}px`,
                            fontSize: fontSize,
                            minHeight: '40px',
                            maxWidth: `${quarter.width}px`,
                            overflow: 'hidden',
                            backgroundColor: 'white'
                        }}
                    >
                        <span className="text-center leading-tight truncate">
                            {quarter.label}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default QuarterlyTimelineAxis;
