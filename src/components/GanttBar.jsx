import React from 'react';
import MilestoneMarker from './MilestoneMarker';

// Helper function to calculate bar height (copied from PortfolioGanttChart)
const calculateBarHeight = (project) => {
    // Handle undefined or invalid project data
    if (!project || !project.name) {
        return 32; // Reduced default height for compact layout
    }
    
    // More compact calculation
    const projectName = project.name || '';
    const textLines = Math.ceil(projectName.length / 25); // More characters per line
    const hasMilestones = project.milestones && project.milestones.length > 0;
    
    // Compact height calculation: minimal padding, closer spacing
    return Math.max(32, 20 + ((textLines - 1) * 12) + (hasMilestones ? 16 : 0)); // Reduced constants
};

const statusColors = {
    'Red': '#ef4444',    // Tailwind red-500
    'Amber': '#f59e0b',  // Tailwind amber-500
    'Green': '#10b981',  // Tailwind emerald-500
    'Grey': '#9ca3af',    // Tailwind gray-400
    'Yellow': '#E5DE00'
};

// const GanttBar = ({ 
//     data,
//     y,
//     height,
//     startX,
//     width,
//     label,
//     status,
//     onBarClick
// }) => {
//     const barColor = statusColors[status] || statusColors.Grey;

    
//     return (
//         <g className="gantt-bar">
//             {/* Project label with ellipsis */}
//             <text
//                 x={10}
//                 y={y + height/2 + 5} // Vertically centered
//                 className="text-sm fill-gray-700"
//                 style={{ 
//                     fontSize: '12px',
//                     fontFamily: 'system-ui, -apple-system, sans-serif'
//                 }}
//             >
//                 {label.length > 30 ? `${label.substring(0, 27)}...` : label}
//                 <title>{label}</title>
//             </text>
            
//             {/* Main bar */}
//             <rect
//                 x={startX}
//                 y={y}
//                 width={Math.max(width, 2)} // Minimum width of 2px
//                 height={height}
//                 rx={4}
//                 fill={barColor}
//                 className="cursor-pointer transition-opacity duration-150 hover:opacity-90"
//                 onClick={() => onBarClick?.(data)}
//             >
//                 <title>{label}</title>
//             </rect>
//         </g>
//     );
// };

// export default GanttBar;
const GanttBar = ({
    data,
    y,
    width,
    startX,
    label,
    status,
    color, // Phase color override
    milestones = [],
    onBarClick,
    isMobile = false,
    fontSize = '14px',
    touchTargetSize = 24,
    zoomLevel = 1.0
}) => {
    // Use provided color first, then status color fallback
    const barColor = color || statusColors[status] || statusColors.Grey;
    
    // Ensure label is always a string
    const safeLabel = label || data?.name || data?.TASK_NAME || 'Unnamed Task';

    // Responsive text wrapping for long labels
    const maxTextWidth = isMobile ? 120 : 180; // Responsive max width
    const wrapText = (text, maxWidth = maxTextWidth) => {
        // Handle undefined, null, or non-string text
        if (!text || typeof text !== 'string') {
            return [''];
        }
        
        const words = text.split(' ');
        let lines = [];
        let currentLine = '';
        
        words.forEach(word => {
            // Approximate width calculation (you might need to adjust the multiplier)
            const wouldBeLineWidth = (currentLine + ' ' + word).length * 6;
            
            if (wouldBeLineWidth <= maxWidth) {
                currentLine = currentLine ? `${currentLine} ${word}` : word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        });
        if (currentLine) {
            lines.push(currentLine);
        }
        return lines;
    };

    const labelLines = wrapText(safeLabel);
    const lineHeight = isMobile ? 14 : 16; // Responsive line height
    
    return (
        <g className="gantt-bar">
            
            {/* Main bar - positioned exactly where parent specifies */}
            <rect
                x={startX}
                y={y} // Use exact Y position provided by parent - no additional offset
                width={Math.max(width, 2)} // Minimum width of 2px
                height={12} // Fixed 12px height
                rx={3} // Keep 3px border radius
                fill={barColor}
                className="cursor-pointer transition-opacity duration-150 hover:opacity-90"
                onClick={() => onBarClick?.(data)}
            >
                <title>{safeLabel}</title>
            </rect>
            
            {/* Milestones - positioned to align with bar center */}
            {milestones?.map((milestone, index) => (
                <MilestoneMarker
                    key={`${data.id}-milestone-${index}`}
                    x={milestone.x}
                    y={y + 6} // Center with the 12px bar (0 + 6)
                    complete={milestone.status}
                    label={milestone.label}
                    isSG3={milestone.isSG3}
                    labelPosition={milestone.labelPosition}
                    shouldWrapText={milestone.shouldWrapText}
                    isGrouped={milestone.isGrouped}
                    groupLabels={milestone.groupLabels}
                    truncatedLabel={milestone.truncatedLabel}
                    hasAdjacentMilestones={milestone.hasAdjacentMilestones}
                    fontSize={fontSize}
                    isMobile={isMobile}
                    zoomLevel={zoomLevel}
                    // NEW PROPS for the fixes
                    shouldRenderShape={milestone.shouldRenderShape || true} // Default to true if not specified
                    allMilestonesInProject={milestone.allMilestonesInProject || milestones}
                    currentMilestoneDate={milestone.currentMilestoneDate || milestone.date}
                />
            ))}
        </g>
    );
};
export default GanttBar;