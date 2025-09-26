import React from 'react';
import { format, addMonths, differenceInMonths } from 'date-fns';

const TimelineAxis = ({
    startDate = new Date(),
    endDate = addMonths(new Date(), 12),
    monthWidth = 100,
    fontSize = '14px',
    totalWidth = '100%'
}) => {
    const generateMonths = () => {
        const months = [];
        const totalMonths = Math.max(1, differenceInMonths(endDate, startDate) + 1);
        
        for (let i = 0; i < totalMonths; i++) {
            const currentMonth = addMonths(startDate, i);
            const xPosition = i * monthWidth;
            months.push({
                date: currentMonth,
                label: format(currentMonth, 'MMM yyyy'),
                shortLabel: format(currentMonth, 'MMM yy'),
                xPosition: xPosition
            });
        }
        
        return months;
    };
    
    const months = generateMonths();

    // Determine label format based on available space
    const useShortFormat = monthWidth < 60;  // Use abbreviated format when space is very limited
    const useFullFormat = monthWidth >= 100; // Use full format when there's good space

    return (
        <div className="flex bg-white border-b border-gray-200" style={{ width: totalWidth }}>
            {/* Fixed-width timeline - no scrolling */}
            <div
                className="flex"
                style={{
                    width: '100%'
                }}
            >
                {months.map((month) => (
                    <div
                        key={month.label}
                        className="flex-shrink-0 p-1 text-xs font-medium text-gray-600 border-r border-gray-200 flex items-center justify-center bg-white"
                        style={{
                            width: `${monthWidth}px`,
                            fontSize: fontSize,
                            minHeight: '40px',
                            maxWidth: `${monthWidth}px`,
                            overflow: 'hidden',
                            backgroundColor: 'white'
                        }}
                    >
                        <span className="text-center leading-tight truncate">
                            {useShortFormat ? month.shortLabel : month.label}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TimelineAxis;
