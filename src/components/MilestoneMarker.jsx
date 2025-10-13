import React from 'react';
import { parseDate } from '../utils/dateUtils';

const MilestoneMarker = ({
    x,
    y,
    complete,   // This is your MILESTONE_STATUS
    label,
    isSG3 = false,
    labelPosition = 'below', // New prop for label position
    shouldWrapText = false, // Whether to wrap text based on proximity
    isGrouped = false, // Whether this is part of a same-date group
    groupLabels = [], // Array of labels for same-date groups
    fullLabel = '', // Display2: Full label for next upcoming milestone only
    hasAdjacentMilestones = false, // Whether there are milestones within threshold
    showLabel = true, // Display2: Control whether to show label
    fontSize = '14px', // Responsive font size
    isMobile = false, // Mobile flag for responsive behavior
    zoomLevel = 1.0, // New prop for zoom-based scaling
    // Display3: New props for monthly grouped labels
    isMonthlyGrouped = false, // Whether this uses Display3 monthly grouping
    monthlyLabels = [], // Array of monthly label lines (legacy - for backward compatibility)
    horizontalLabel = '', // Single horizontal comma-separated label for Display3
    verticalLabels = [], // Array of vertical labels for Display3 A/B testing
    monthKey = '', // Month key for this milestone
    // NEW PROPS for the fixes
    shouldRenderShape = true, // Whether to render the diamond shape (only first in month)
    allMilestonesInProject = [], // All milestones in the project for ±4 months check
    currentMilestoneDate = null, // Current milestone date for proximity check
    // CRITICAL FIX: New props to control positioning mode
    useTopAnchoring = false, // Whether to use top-anchoring instead of centering
    hasValidBar = false, // Whether the project has a valid Gantt bar
    // NEW: Adaptive text anchoring for smarter label positioning
    textAnchor = 'middle', // 'start', 'middle', or 'end' - controls label alignment
    spanMonths = 0, // Number of months span for this label cluster
}) => {
    // Zoom-responsive sizing - REDUCED: Smaller milestone markers
    const zoomScale = Math.max(0.5, Math.min(1.5, zoomLevel)); // Clamp zoom between 0.5 and 1.5
    const baseSize = isMobile ? 8 : 6; // Reduced from 12:10 to 8:6
    const zoomedBaseSize = Math.round(baseSize * zoomScale);
    
    // ISSUE FIX: All milestones same size - remove isSG3 size variation
    const size = zoomedBaseSize; // Always use base size, no multiplication for SG3
    
    const yOffset = 0; // Position milestone on the Gantt bar instead of above it
    const isComplete = complete === 'Completed';
    
    // CRITICAL FIX: Complete override of positioning when useTopAnchoring is true
    let finalY, finalVerticalOffset;
    if (useTopAnchoring) {
        // Top-anchoring mode: use Y coordinate as-is, no centering offset
        finalY = y;
        finalVerticalOffset = 0;
    } else {
        // Legacy centering mode: apply centering offset
        finalY = y + yOffset;
        finalVerticalOffset = -size / 2;
    }
    

    // DYNAMIC WRAPPING: Allow label to stretch between neighboring milestones with alternating row awareness
    const truncateLabel = (labelText, currentLabelPosition) => {
        
        if (!labelText || typeof labelText !== 'string') return labelText;
        
        // NEW FIX: If we have monthly grouped labels, they've already been intelligently processed
        // in createVerticalMilestoneLabels, so skip additional truncation
        if (isMonthlyGrouped && (verticalLabels?.length > 0 || horizontalLabel)) {
            return labelText; // Return as-is, already processed
        }
        
        const monthWidth = 100; // Default month width
        
        // If no milestone data available, use conservative but generous width
        if (!currentMilestoneDate || !allMilestonesInProject?.length) {
            const conservativeCharLimit = Math.floor((6 * monthWidth) / 6.5); // 6 months, more accurate char width
            if (labelText.length <= conservativeCharLimit) return labelText;
            return labelText.substring(0, conservativeCharLimit - 3) + '...';
        }
        
        // Parse and sort all milestones by date
        const currentDate = new Date(currentMilestoneDate);
        const validMilestones = allMilestonesInProject
            .filter(m => m.date && m.date !== currentMilestoneDate)
            .map(m => {
                const parsed = parseDate ? parseDate(m.date) : new Date(m.date);
                return { ...m, parsedDate: parsed };
            })
            .filter(m => m.parsedDate && !isNaN(m.parsedDate.getTime()))
            .sort((a, b) => a.parsedDate - b.parsedDate);
        
        // Determine current milestone's label position (above/below)
        // Use the passed parameter if available, otherwise calculate from month
        if (!currentLabelPosition) {
            const currentMonth = currentDate.getMonth() + 1; // 1-based month
            currentLabelPosition = currentMonth % 2 === 1 ? 'above' : 'below';
        }
        
        // Filter neighbors to only consider those that could potentially collide
        // Since above/below don't collide, we only need to worry about milestones on the same row
        // AND exclude milestones from the same month (they stack vertically, not horizontally)
        const currentMonth = currentDate.getMonth() + 1; // 1-based month
        const sameRowMilestones = validMilestones.filter(m => {
            const milestoneMonth = m.parsedDate.getMonth() + 1;
            const milestoneLabelPosition = milestoneMonth % 2 === 1 ? 'above' : 'below';
            
            // Only consider milestones in same row AND different months
            const isSameRow = milestoneLabelPosition === currentLabelPosition;
            const isDifferentMonth = milestoneMonth !== currentMonth;
            return isSameRow && isDifferentMonth;
        });
        
        if (sameRowMilestones.length === 0) {
            // No milestones on the same row - since alternating months don't collide,
            // we can extend very generously
            const maxSpanMonths = 24; // Very generous space since no conflicts on this row
            const maxCharLimit = Math.floor((maxSpanMonths * monthWidth) / 6.5); // Reduced char width for better fitting
            return labelText.length <= maxCharLimit ? labelText : labelText.substring(0, maxCharLimit - 3) + '...';
        }
        
        // Find the immediate left and right neighbors on the same row
        const leftNeighbor = sameRowMilestones
            .filter(m => m.parsedDate < currentDate)
            .sort((a, b) => b.parsedDate - a.parsedDate)[0]; // Closest before
        
        const rightNeighbor = sameRowMilestones
            .filter(m => m.parsedDate > currentDate)
            .sort((a, b) => a.parsedDate - b.parsedDate)[0]; // Closest after
        
        // Calculate available space between same-row neighbors
        let leftBoundary, rightBoundary;
        
        if (!leftNeighbor) {
            // No left neighbor on same row - allow generous LEFT extension
            leftBoundary = new Date(currentDate);
            leftBoundary.setMonth(currentDate.getMonth() - 12); // 12 months back for generous extension
        } else {
            // Use 70% towards left neighbor with safety margin
            const span = currentDate.getTime() - leftNeighbor.parsedDate.getTime();
            const boundaryMs = leftNeighbor.parsedDate.getTime() + (span * 0.30); // 30% safety margin
            leftBoundary = new Date(boundaryMs);
        }
        
        if (!rightNeighbor) {
            // No right neighbor on same row - allow RIGHT extension
            // But check if left neighbor is close - if so, be more conservative
            rightBoundary = new Date(currentDate);
            
            if (leftNeighbor) {
                const leftSpanMs = currentDate.getTime() - leftNeighbor.parsedDate.getTime();
                const leftSpanMonths = leftSpanMs / (1000 * 60 * 60 * 24 * 30.44);
                
                // CRITICAL: Be very conservative to avoid collision with left neighbor
                if (leftSpanMonths >= 8) {
                    // Left neighbor is very far (8+ months) - allow generous right extension
                    rightBoundary.setMonth(currentDate.getMonth() + 24);
                } else if (leftSpanMonths >= 4) {
                    // Left neighbor is moderately far (4-8 months) - moderate extension
                    // Use 70% of available space with safety
                    const extension = Math.min(leftSpanMonths * 0.7, 12);
                    rightBoundary.setMonth(currentDate.getMonth() + extension);
                } else {
                    // Left neighbor is close (< 4 months) - very conservative
                    // Only extend half the distance or minimum 3 months
                    const extension = Math.max(leftSpanMonths * 0.5, 3);
                    rightBoundary.setMonth(currentDate.getMonth() + extension);
                }
            } else {
                // No left neighbor either - maximum extension
                rightBoundary.setMonth(currentDate.getMonth() + 24);
            }
        } else {
            // Use 70% towards right neighbor with safety margin
            const span = rightNeighbor.parsedDate.getTime() - currentDate.getTime();
            const boundaryMs = currentDate.getTime() + (span * 0.70); // 70% towards neighbor
            rightBoundary = new Date(boundaryMs);
        }
        
        // Calculate the available span in months
        const spanMs = rightBoundary - leftBoundary;
        const spanMonths = spanMs / (1000 * 60 * 60 * 24 * 30.44); // Convert to months
        
        // Apply different caps based on neighbor situation
        let maxCap;
        if (!leftNeighbor && !rightNeighbor) {
            // Both sides free - very generous
            maxCap = 24;
        } else if (!leftNeighbor || !rightNeighbor) {
            // One side is free - allow up to 24 months extension
            maxCap = 24;
        } else {
            // Both neighbors present - be more conservative
            maxCap = 10;
        }
        const usableSpanMonths = Math.max(2.5, Math.min(spanMonths, maxCap)); // Min 2.5 months, dynamic max
        const availableWidth = usableSpanMonths * monthWidth;
        
        // Calculate character limit with more accurate character width estimation
        const charLimit = Math.floor(availableWidth / 6.5); // ~6.5 pixels per character (more accurate)
        
        if (labelText.length <= charLimit) {
            return labelText;
        }
        
        // Apply smart truncation with more generous minimum readable length
        const minChars = 15; // Increased minimum readable characters from 10 to 15
        const effectiveLimit = Math.max(minChars, charLimit - 3);
        return labelText.substring(0, effectiveLimit) + '...';
    };

    // Text wrapping logic
    const wrapText = (text, shouldWrap) => {
        if (!shouldWrap) return [text];
        
        const words = text.split(' ');
        if (words.length <= 1) return [text];
        
        // For 2 words, split into 2 lines
        if (words.length === 2) return words;
        
        // For 3 or more words, one word per line
        return words;
    };

    const wrappedLines = wrapText(label, shouldWrapText);
    const lineHeight = isMobile ? 12 : 10; // Reduced line height to match smaller markers
    const totalTextHeight = wrappedLines.length * lineHeight;


    return (
        <g className="milestone-marker">
            <title>{label}</title>

            {/* Diamond shape - Only render if shouldRenderShape is true (one per month) */}
            {shouldRenderShape && (
                <rect 
                    x={Math.round(x)} 
                    y={Math.round(finalY + finalVerticalOffset)} 
                    width={size} 
                    height={size} 
                    transform={`rotate(45, ${Math.round(x + size / 2)}, ${Math.round(finalY + finalVerticalOffset + size / 2)})`}
                    fill={isGrouped ? 'black' : (isComplete ? '#005CB9' : 'white')}
                    stroke={isGrouped ? 'white' : '#005CB9'}
                    strokeWidth={2}
                    className="cursor-pointer transition-colors duration-150"
                />
            )}

            {/* Label rendering - Display3: Monthly grouped labels or Display2: Legacy logic */}
            {showLabel && (isMonthlyGrouped ? (
                // Display3: A/B Testing - Horizontal vs Vertical layouts
                <>
                    {/* Horizontal Layout: Single comma-separated label */}
                    {horizontalLabel && (
                        <text
                            key={`${monthKey}-horizontal`}
                            x={x + size / 2}
                            y={labelPosition === 'below'
                                ? finalY + finalVerticalOffset + size + (isMobile ? 12 : 10) // Below marker - reduced spacing for compactness
                                : finalY + finalVerticalOffset - (isMobile ? 8 : 6)} // Above marker - reduced spacing for compactness
                            textAnchor={textAnchor}
                            className="text-l fill-gray-600"
                            style={{
                                fontSize: fontSize,
                                fontFamily: 'system-ui, -apple-system, sans-serif',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {horizontalLabel}
                        </text>
                    )}

                    {/* Vertical Layout: Stacked individual labels */}
                    {verticalLabels.map((labelLine, index) => (
                        <text
                            key={`${monthKey}-vertical-${index}`}
                            x={x + size / 2}
                            y={labelPosition === 'below'
                                ? finalY + finalVerticalOffset + size + (isMobile ? 12 : 10) + (index * lineHeight) // Below marker, stacked down - reduced spacing for compactness
                                : finalY + finalVerticalOffset - (isMobile ? 8 : 6) - ((verticalLabels.length - 1 - index) * lineHeight)} // Above marker, stacked up - reduced spacing for compactness
                            textAnchor={textAnchor}
                            className="text-l fill-gray-600"
                            style={{
                                fontSize: fontSize,
                                fontFamily: 'system-ui, -apple-system, sans-serif',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {labelLine}
                        </text>
                    ))}
                </>
            ) : (
                // Display2: Legacy logic for backward compatibility
                isGrouped ? (
                    // Stacked milestone labels with commas - Display2: Only if showLabel is true
                    groupLabels.map((label, index) => (
                        <text
                            key={index}
                            x={x + size / 2}
                            y={finalY + finalVerticalOffset + size + (isMobile ? 12 : 10) + (index * lineHeight)} // Reduced space below marker for grouped labels - more compact
                            textAnchor="middle"
                            className="text-l fill-gray-600"
                            style={{
                                fontSize: fontSize,
                                fontFamily: 'system-ui, -apple-system, sans-serif',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {label + (index < groupLabels.length - 1 ? ',' : '')}
                        </text>
                    ))
                ) : (
                    // Individual milestone label - Display2: Only show if showLabel is true
                    fullLabel && (
                        <text
                            x={x + size / 2}
                            y={labelPosition === 'below'
                                ? finalY + finalVerticalOffset + size + (isMobile ? 10 : 8)   // Below marker - reduced spacing for compactness
                                : finalY + finalVerticalOffset - (isMobile ? 8 : 6)}         // Above marker - reduced spacing for compactness
                            textAnchor="middle"
                            className="text-l fill-gray-600"
                            style={{
                                fontSize: fontSize,
                                fontFamily: 'system-ui, -apple-system, sans-serif',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {fullLabel}
                        </text>
                    )
                )
            ))}
        </g>
    );
};

export default MilestoneMarker;


// import React from 'react';

// const MilestoneMarker = ({ 
//     x, 
//     y,
//     yOffset = 0,
//     complete, 
//     label,
//     isSG3 = false
// }) => {
//     const size = isSG3 ? 16 : 12;
//     const baseYOffset = isSG3 ? -8 : -6;
    
//     // Calculate final y position including stagger offset
//     const finalY = y + baseYOffset + yOffset;
    
//     // Split label into lines for text wrapping
//     const maxLineLength = 20;
//     const words = label.split(' ');
//     let lines = [];
//     let currentLine = '';
    
//     words.forEach(word => {
//         if ((currentLine + ' ' + word).length <= maxLineLength) {
//             currentLine = currentLine ? `${currentLine} ${word}` : word;
//         } else {
//             lines.push(currentLine);
//             currentLine = word;
//         }
//     });
//     if (currentLine) {
//         lines.push(currentLine);
//     }

//     return (
//         <g className="milestone-marker">
//             <title>{label}</title>
            
//             {/* Diamond shape */}
//             <rect 
//                 x={x} 
//                 y={finalY} 
//                 width={size} 
//                 height={size} 
//                 transform={`rotate(45, ${x + size/2}, ${finalY + size/2})`}
//                 fill={complete === 'Complete' ? '#005CB9' : 'white'} 
//                 stroke={'#005CB9'}
//                 strokeWidth={2}
//                 className="cursor-pointer transition-colors duration-150"
//             />
            
//             {/* Label below diamond */}
//             <g transform={`translate(${x - size}, ${finalY + size + 12})`}>
//                 {lines.map((line, index) => (
//                     <text
//                         key={index}
//                         x={size} // Center text relative to diamond
//                         y={index * 12} // Line spacing
//                         textAnchor="middle"
//                         className="text-xs fill-gray-600"
//                         style={{ 
//                             fontSize: '10px',
//                             fontFamily: 'system-ui, -apple-system, sans-serif'
//                         }}
//                     >
//                         {line}
//                     </text>
//                 ))}
//             </g>
//         </g>
//     );
// };

// export default MilestoneMarker;
