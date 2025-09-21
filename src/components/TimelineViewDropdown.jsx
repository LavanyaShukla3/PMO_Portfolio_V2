import React from 'react';

const TimelineViewDropdown = ({ selectedView, onViewChange, className = '' }) => {
    const viewOptions = [
        {
            id: 'current14',
            label: '14 Months Current Viewport',
            description: 'Previous month to 12 months ahead (14 months total)'
        },
        {
            id: 'future24',
            label: '24 Months in Future',
            description: 'Current month to 24 months ahead'
        },
        {
            id: 'past24',
            label: '24 Months in Past', 
            description: '24 months ago to current month'
        },
        {
            id: 'future36',
            label: '36 Months in Future',
            description: 'Current month to 36 months ahead'
        },
        {
            id: 'past36',
            label: '36 Months in Past',
            description: '36 months ago to current month'
        }
    ];

    return (
        <div className={`flex items-center space-x-2 ${className}`}>
            <label htmlFor="timeline-view" className="text-sm font-medium text-gray-700">
                Timeline View:
            </label>
            <select
                id="timeline-view"
                value={selectedView}
                onChange={(e) => onViewChange(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
                {viewOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                        {option.label}
                    </option>
                ))}
            </select>
        </div>
    );
};

export default TimelineViewDropdown;