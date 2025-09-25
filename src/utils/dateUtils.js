import { parse, differenceInDays, addMonths, subMonths, startOfMonth, getMonth, getYear } from 'date-fns';

// Milestone Layout Configuration: Enforcing strict rules for milestone display
export const MILESTONE_LAYOUT_TYPE = 'vertical'; // Strict rule: vertical stacking for multiple milestones per month

// Constants for timeline configuration
const MONTH_WIDTH = 100; // Width per month in pixels
const MONTHS_BEFORE = 36; // Show 36 months before current
const MONTHS_AFTER = 36;  // Show 36 months after current
const INITIAL_VIEWPORT_BEFORE = 1;  // Initial view: 1 month before
const INITIAL_VIEWPORT_AFTER = 12;  // Initial view: 12 months after
const TOTAL_MONTHS = MONTHS_BEFORE + MONTHS_AFTER + 1; // +1 for current month

/**
 * Parses a date string from the investment data format
 * @param {string} dateString - Date in format "dd-MMM-yy" (e.g., "12-Aug-24")
 * @param {string} context - Optional context for debugging (e.g., project name)
 * @returns {Date|null} Parsed date or null if invalid
 */

export const parseDate = (dateString, context = '') => {
    if (!dateString) return null;
    
    // Handle different date formats
    try {
        // First try to parse as a standard JavaScript date (includes GMT format)
        // This handles formats like "2024-08-12", "2024-08-12T00:00:00.000Z", and "Tue, 10 Jan 2023 00:00:00 GMT"
        const directParse = new Date(dateString);
        if (!isNaN(directParse.getTime())) {
            // console.log('✅ Successfully parsed date:', dateString, '→', directParse.toISOString(), context ? `[${context}]` : '');
            return directParse;
        }
        
        // Legacy format: dd-MMM-yy (e.g., "12-Aug-24")
        if (dateString.includes('-') && dateString.length <= 10) {
            // Check if it looks like ISO format (YYYY-MM-DD)
            if (/^\d{4}-\d{2}-\d{2}/.test(dateString)) {
                const parsedDate = parse(dateString, 'yyyy-MM-dd', new Date());
                // console.log('✅ Parsed ISO date:', dateString, '→', parsedDate.toISOString(), context ? `[${context}]` : '');
                return parsedDate;
            } else {
                // Legacy dd-MMM-yy format
                const parsedDate = parse(dateString, 'dd-MMM-yy', new Date());
                // console.log('✅ Parsed legacy date:', dateString, '→', parsedDate.toISOString(), context ? `[${context}]` : '');
                return parsedDate;
            }
        } 
        
        // MM/dd/yyyy format
        if (dateString.includes('/')) {
            const parsedDate = parse(dateString, 'MM/dd/yyyy', new Date());
            // console.log('✅ Parsed MM/dd/yyyy date:', dateString, '→', parsedDate.toISOString(), context ? `[${context}]` : '');
            return parsedDate;
        }
        
        console.warn('Unrecognized date format:', dateString, context ? `[${context}]` : '');
        return null;
    } catch (error) {
        console.error('❌ Error parsing date:', dateString, error, context ? `[${context}]` : '');
        return null;
    }
};

/**
 * Gets the full scrollable timeline range
 * @returns {{startDate: Date, endDate: Date}} Timeline range
 */
export const getTimelineRange = () => {
    const today = new Date();
    const startDate = startOfMonth(subMonths(today, MONTHS_BEFORE));
    const endDate = startOfMonth(addMonths(today, MONTHS_AFTER));
    return { startDate, endDate };
};

/**
 * Gets the initial viewport range
 * @returns {{startDate: Date, endDate: Date}} Viewport range
 */
export const getInitialViewportRange = () => {
    const today = new Date();
    const startDate = startOfMonth(subMonths(today, INITIAL_VIEWPORT_BEFORE));
    const endDate = startOfMonth(addMonths(today, INITIAL_VIEWPORT_AFTER));
    return { startDate, endDate };
};

/**
 * Calculate initial scroll position to show current month - 1
 * @param {number} monthWidth - Width per month in pixels
 * @returns {number} Scroll position in pixels
 */
export const getInitialScrollPosition = (monthWidth = MONTH_WIDTH) => {
    // Timeline starts at MONTHS_BEFORE months ago
    // Current month is at position MONTHS_BEFORE
    // We want to show (current month - 1), so position (MONTHS_BEFORE - 1)
    const currentMonthPosition = MONTHS_BEFORE;
    const targetPosition = currentMonthPosition - 1; // Show previous month (Aug 2025 if current is Sep 2025)
    return targetPosition * monthWidth;
};

/**
 * Get timeline range for "14 Months Current Viewport" view (default)
 * Shows previous month to 12 months ahead (14 months total)
 * @returns {{startDate: Date, endDate: Date}} Timeline range
 */
export const getCurrent14MonthsRange = () => {
    const today = new Date();
    const startDate = startOfMonth(subMonths(today, 1)); // Start from previous month
    const endDate = startOfMonth(addMonths(today, 12)); // End 12 months from now
    return { startDate, endDate };
};

/**
 * Get timeline range for "24 Months in Future" view
 * Shows current month to 24 months ahead
 * @returns {{startDate: Date, endDate: Date}} Timeline range
 */
export const getFuture24MonthsRange = () => {
    const today = new Date();
    const startDate = startOfMonth(today); // Start from current month
    const endDate = startOfMonth(addMonths(today, 24)); // End 24 months from now
    return { startDate, endDate };
};

/**
 * Get timeline range for "24 Months in Past" view
 * Shows 24 months ago to current month
 * @returns {{startDate: Date, endDate: Date}} Timeline range
 */
export const getPast24MonthsRange = () => {
    const today = new Date();
    const startDate = startOfMonth(subMonths(today, 24)); // Start 24 months ago
    const endDate = startOfMonth(addMonths(today, 1)); // End at end of current month
    return { startDate, endDate };
};

/**
 * Get timeline range for "36 Months in Future" view
 * Shows current month to 36 months ahead
 * @returns {{startDate: Date, endDate: Date}} Timeline range
 */  
export const getFuture36MonthsRange = () => {
    const today = new Date();
    const startDate = startOfMonth(today); // Start from current month
    const endDate = startOfMonth(addMonths(today, 36)); // End 36 months from now
    return { startDate, endDate };
};

/**
 * Get timeline range for "36 Months in Past" view
 * Shows 36 months ago to current month
 * @returns {{startDate: Date, endDate: Date}} Timeline range
 */
export const getPast36MonthsRange = () => {
    const today = new Date();
    const startDate = startOfMonth(subMonths(today, 36)); // Start 36 months ago
    const endDate = startOfMonth(addMonths(today, 1)); // End at end of current month
    return { startDate, endDate };
};

/**
 * Get timeline range for "14 Months in Future" view
 * Shows current month to 14 months ahead
 * @returns {{startDate: Date, endDate: Date}} Timeline range
 */
export const getFuture14MonthsRange = () => {
    const today = new Date();
    const startDate = startOfMonth(today); // Start from current month
    const endDate = startOfMonth(addMonths(today, 14)); // End 14 months from now
    return { startDate, endDate };
};

/**
 * Get timeline range for "14 Months in Past" view
 * Shows 14 months ago to current month
 * @returns {{startDate: Date, endDate: Date}} Timeline range
 */
export const getPast14MonthsRange = () => {
    const today = new Date();
    const startDate = startOfMonth(subMonths(today, 14)); // Start 14 months ago
    const endDate = startOfMonth(addMonths(today, 1)); // End at end of current month
    return { startDate, endDate };
};

/**
 * Get timeline range based on view selection
 * @param {string} viewType - 'current14', 'future14', 'past14', 'future24', 'past24', 'future36', or 'past36'
 * @returns {{startDate: Date, endDate: Date}} Timeline range
 */
export const getTimelineRangeForView = (viewType = 'current14') => {
    switch (viewType) {
        case 'future14':
            return getFuture14MonthsRange();
        case 'past14':
            return getPast14MonthsRange();
        case 'future24':
            return getFuture24MonthsRange();
        case 'past24':
            return getPast24MonthsRange();
        case 'future36':
            return getFuture36MonthsRange();
        case 'past36':
            return getPast36MonthsRange();
        case 'current14':
        default:
            return getCurrent14MonthsRange();
    }
};

/**
 * Check if a project overlaps with the selected timeline range
 * A project is included if any of its dates (project, phases, or milestones) overlap with the timeline
 * @param {Object} project - Project object
 * @param {Date} timelineStart - Timeline start date
 * @param {Date} timelineEnd - Timeline end date
 * @returns {boolean} True if project should be displayed
 */
export const isProjectInTimelineViewport = (project, timelineStart, timelineEnd) => {
    if (!project || !timelineStart || !timelineEnd) return false;

    // Check main project dates
    const projectStart = parseDate(project.startDate);
    const projectEnd = parseDate(project.endDate);
    
    if (projectStart && projectEnd) {
        // Project overlaps if it starts before timeline ends AND ends after timeline starts
        if (projectStart <= timelineEnd && projectEnd >= timelineStart) {
            return true;
        }
    }

    // Check phase dates if project has phases
    if (project.phases && project.phases.length > 0) {
        for (const phase of project.phases) {
            const phaseStart = parseDate(phase.startDate);
            const phaseEnd = parseDate(phase.endDate);
            
            if (phaseStart && phaseEnd) {
                if (phaseStart <= timelineEnd && phaseEnd >= timelineStart) {
                    return true;
                }
            }
        }
    }

    // Check milestone dates
    if (project.milestones && project.milestones.length > 0) {
        for (const milestone of project.milestones) {
            const milestoneDate = parseDate(milestone.date);
            
            if (milestoneDate) {
                if (milestoneDate >= timelineStart && milestoneDate <= timelineEnd) {
                    return true;
                }
            }
        }
    }

    return false;
};

// Milestone Rules Constants
const DAYS_THRESHOLD = 16; // Threshold for considering milestones as overlapping
const MAX_LABEL_LENGTH = 5; // Maximum length before truncation

/**
 * Intelligent label truncation rule from PortfolioGanttChart
 * @param {string} label - Label to truncate
 * @param {boolean} hasAdjacentMilestones - Whether there are adjacent milestones
 * @returns {string} Truncated label
 */
export const truncateLabel = (label, hasAdjacentMilestones) => {
    // Only truncate if there are adjacent milestones and length exceeds max
    if (!hasAdjacentMilestones || label.length <= MAX_LABEL_LENGTH) return label;
    return label.substring(0, MAX_LABEL_LENGTH) + '...';
};

/**
 * Calculate X position for a milestone marker
 * When milestone falls on the end date of a bar, position it flush with the bar's right edge
 * @param {Date} date - Date to calculate position for
 * @param {Date} startDate - Timeline start date
 * @param {number} monthWidth - Width per month in pixels (default: 100)
 * @param {Date} barEndDate - Optional end date of the related Gantt bar
 * @returns {number} X-position in pixels
 */
export const calculateMilestonePosition = (date, startDate, monthWidth = MONTH_WIDTH, barEndDate = null) => {
    if (!date || !startDate) {
        console.warn('❌ Missing date or startDate:', { date, startDate });
        return 0;
    }

    const days = differenceInDays(date, startDate);
    let position = Math.max(0, (days / 30.44) * monthWidth);
    
    // ISSUE FIX: If milestone date equals bar end date, position it within the bar
    if (barEndDate && date.getTime() === barEndDate.getTime()) {
        const barEndDays = differenceInDays(barEndDate, startDate);
        const barEndPosition = Math.max(0, (barEndDays / 30.44) * monthWidth);
        
        // Position milestone slightly inside the bar end (subtract half milestone width)
        const milestoneWidth = 14; // Approximate milestone diamond width
        position = Math.max(0, barEndPosition - (milestoneWidth / 2));
    }

    return position;
};

/**
 * Calculates the x-position for a date on the timeline
 * @param {Date} date - The date to position
 * @param {Date} startDate - Timeline start date
 * @param {number} monthWidth - Width per month in pixels (default: 100)
 * @returns {number} X-position in pixels
 */
export const calculatePosition = (date, startDate, monthWidth = MONTH_WIDTH) => {
    if (!date || !startDate) {
        console.warn('❌ Missing date or startDate:', { date, startDate });
        return 0;
    }

    const days = differenceInDays(date, startDate);
    const position = Math.max(0, (days / 30.44) * monthWidth);

    return position;
};

/**
 * Display3: Groups milestones by month for monthly grouped milestone labels
 * @param {Array} milestones - Array of milestone objects with date property
 * @returns {Object} Object with month keys (YYYY-MM format) and milestone arrays as values
 */
export const groupMilestonesByMonth = (milestones, dateKey = 'date') => {
    if (!milestones?.length) return {};

    const groups = {};

    milestones.forEach(milestone => {
        // Use the specified dateKey to get the date string
        const date = parseDate(milestone[dateKey]);
        if (!date) return;

        const monthKey = `${getYear(date)}-${String(getMonth(date) + 1).padStart(2, '0')}`;

        if (!groups[monthKey]) {
            groups[monthKey] = [];
        }

        groups[monthKey].push({
            ...milestone,
            parsedDate: date,
            day: date.getDate()
        });
    });

    // Sort milestones within each month by day (ascending order)
    Object.keys(groups).forEach(monthKey => {
        groups[monthKey].sort((a, b) => a.day - b.day);
    });

    return groups;
};

/**
 * Display3: Creates horizontal comma-separated milestone labels for a month
 * @param {Array} monthMilestones - Array of milestones for a specific month
 * @param {number} maxWidth - Maximum width in pixels (2 months width)
 * @param {string} fontSize - Font size for width calculation
 * @returns {string} Comma-separated horizontal label string
 */
export const createHorizontalMilestoneLabel = (monthMilestones, maxWidth, fontSize = '14px') => {
    if (!monthMilestones?.length) return '';

    // Create individual milestone labels in format "4th: Spain"
    const milestoneLabels = monthMilestones.map(milestone =>
        `${milestone.day}${getOrdinalSuffix(milestone.day)}: ${milestone.label}`
    );

    // Join with commas and spaces
    const combinedLabel = milestoneLabels.join(', ');

    // Truncate if exceeds max width
    return truncateTextToWidth(combinedLabel, maxWidth, fontSize);
};

/**
 * STRICT RULE 2: Creates vertical stacked milestone labels for a month with intelligent stretching
 * Task 2: Remove date prefix when there's only one milestone in the month
 * Each milestone label is intelligently truncated based on available timeline space
 * @param {Array} monthMilestones - Array of milestones for a specific month
 * @param {number} maxWidth - Maximum width in pixels (cluster-based, not fixed 2 months)
 * @param {string} fontSize - Font size for width calculation
 * @param {Array} allProjectMilestones - All milestones in project for intelligent sizing
 * @returns {Array} Array of individual milestone label strings for vertical stacking
 */
export const createVerticalMilestoneLabels = (monthMilestones, maxWidth, fontSize = '14px', allProjectMilestones = null, currentMonthWidth = 100) => {
    if (!monthMilestones?.length) return [];

    // Task 2: Remove date from milestone marker where there is just one milestone in the month
    const isSingleMilestone = monthMilestones.length === 1;

    // ENHANCED: Calculate intelligent max width based on alternating row system
    let effectiveMaxWidth = maxWidth;
    
    
    if (allProjectMilestones?.length > 1) {
        // Get the current month's position (above/below) to determine potential conflicts
        const firstMilestone = monthMilestones[0];
        const milestoneDate = parseDate(firstMilestone.date);
        const currentMonth = milestoneDate ? milestoneDate.getMonth() + 1 : 1; // 1-based month
        const currentLabelPosition = currentMonth % 2 === 1 ? 'above' : 'below';
        
        
        // Filter to only consider milestones that would be in the same row (same alternating position)
        // BUT exclude milestones from the same month (they don't compete for horizontal space)
        const sameRowMilestones = allProjectMilestones
            .filter(m => m.date && m.date !== firstMilestone.date)
            .map(m => ({ ...m, parsedDate: parseDate(m.date) }))
            .filter(m => {
                if (!m.parsedDate || isNaN(m.parsedDate.getTime())) return false;
                const milestoneMonth = m.parsedDate.getMonth() + 1;
                const milestoneLabelPosition = milestoneMonth % 2 === 1 ? 'above' : 'below';
                
                // Only consider milestones in same row AND different months
                const isSameRow = milestoneLabelPosition === currentLabelPosition;
                const isDifferentMonth = milestoneMonth !== currentMonth;
                return isSameRow && isDifferentMonth;
            })
            .sort((a, b) => a.parsedDate - b.parsedDate);
        
        
        if (sameRowMilestones.length === 0) {
            // No conflicts in the same row - be very generous with width
            // Increase cap from 8 → 24 months to avoid unnecessary truncation
            effectiveMaxWidth = 24 * currentMonthWidth; // 24 months of space when no conflicts
        } else {
            // Find immediate neighbors in the same row
            const currentMilestoneDate = milestoneDate;
            const leftNeighbor = sameRowMilestones
                .filter(m => m.parsedDate < currentMilestoneDate)
                .sort((a, b) => b.parsedDate - a.parsedDate)[0];
            const rightNeighbor = sameRowMilestones
                .filter(m => m.parsedDate > currentMilestoneDate)
                .sort((a, b) => a.parsedDate - b.parsedDate)[0];
            
            
            // Calculate available space between same-row neighbors
            let spanMonths;
            if (!leftNeighbor && !rightNeighbor) {
                // Redundant with sameRowMilestones.length === 0, but keep safe default
                spanMonths = 24; // Very generous space
            } else if (!leftNeighbor) {
                // Only right neighbor exists: allow approximately double the right span
                const rightSpan = (rightNeighbor.parsedDate - currentMilestoneDate) / (1000 * 60 * 60 * 24 * 30.44);
                spanMonths = Math.min(Math.max(2, rightSpan * 2), 24);
            } else if (!rightNeighbor) {
                // Only left neighbor exists: allow approximately double the left span
                const leftSpan = (currentMilestoneDate - leftNeighbor.parsedDate) / (1000 * 60 * 60 * 24 * 30.44);
                spanMonths = Math.min(Math.max(2, leftSpan * 2), 24);
            } else {
                // Both neighbors exist: use 90% of total span between them
                const totalSpan = (rightNeighbor.parsedDate - leftNeighbor.parsedDate) / (1000 * 60 * 60 * 24 * 30.44);
                spanMonths = Math.min(Math.max(2, totalSpan * 0.9), 24);
            }

            effectiveMaxWidth = spanMonths * currentMonthWidth;
        }
    }
    

    return monthMilestones.map((milestone, index) => {
        let label;
        if (isSingleMilestone) {
            // Task 2: Single milestone - no date prefix
            // current: 31st: RGM 3.0/PFNA SG3
            // expected: RGM 3.0/PFNA SG3
            label = milestone.label;
        } else {
            // Multiple milestones - keep date prefix for stacking
            // 4th: Spain
            // 11th: Mexico
            // 18th: Thailand
            label = `${milestone.day}${getOrdinalSuffix(milestone.day)}: ${milestone.label}`;
        }

        
        // ENHANCED: Use intelligent truncation based on alternating-row-aware max width
        const result = truncateTextToWidth(label, effectiveMaxWidth, fontSize);
        return result;
    });
};

/**
 * Helper function to get ordinal suffix (1st, 2nd, 3rd, 4th, etc.)
 * @param {number} day - Day of the month
 * @returns {string} Ordinal suffix
 */
const getOrdinalSuffix = (day) => {
    if (day >= 11 && day <= 13) {
        return 'th';
    }
    switch (day % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
    }
};

/**
 * STRICT RULE 1: Determines label position based on month index
 * Months 1/3/5/etc (odd) = above gantt bar
 * Months 2/4/6/etc (even) = below gantt bar
 * This ensures labels can be up to 2 month's wide before overlap issues occur
 * @param {string} monthKey - Month key in YYYY-MM format
 * @returns {string} 'above' or 'below'
 */
export const getMonthlyLabelPosition = (monthKey) => {
    const [year, month] = monthKey.split('-').map(Number);
    const monthIndex = month; // 1-based month number (1=Jan, 2=Feb, etc.)
    // STRICT RULE 1: Odd months (1,3,5,7,9,11) above, Even months (2,4,6,8,10,12) below
    return monthIndex % 2 === 1 ? 'above' : 'below';
};

/**
 * Display3: Calculates approximate text width for truncation
 * @param {string} text - Text to measure
 * @param {string} fontSize - Font size (e.g., '14px')
 * @returns {number} Approximate width in pixels
 */
export const calculateTextWidth = (text, fontSize = '14px') => {
    // Approximate character width based on font size
    const baseFontSize = parseInt(fontSize);
    const avgCharWidth = baseFontSize * 0.6; // Rough approximation for system fonts
    return text.length * avgCharWidth;
};

/**
 * Display3: Truncates text to fit within specified width with improved character estimation
 * @param {string} text - Text to truncate
 * @param {number} maxWidth - Maximum width in pixels
 * @param {string} fontSize - Font size for width calculation
 * @returns {string} Truncated text with ellipsis if needed
 */
export const truncateTextToWidth = (text, maxWidth, fontSize = '14px') => {
    if (!text) return '';


    // Improved character width estimation based on common milestone text patterns
    const baseFontSize = parseInt(fontSize);
    const avgCharWidth = baseFontSize * 0.55; // Slightly more accurate for typical text
    
    const fullWidth = text.length * avgCharWidth;
    
    if (fullWidth <= maxWidth) {
        return text;
    }

    const ellipsisWidth = 3 * avgCharWidth; // "..." width
    const availableWidth = maxWidth - ellipsisWidth;

    if (availableWidth <= 0) {
        return '…';
    }

    const maxChars = Math.floor(availableWidth / avgCharWidth);
    
    // Ensure minimum readable length
    const minChars = 8;
    const effectiveMaxChars = Math.max(minChars, maxChars);

    const result = text.substring(0, effectiveMaxChars) + '…';
    return result;
};

/**
 * Smart milestone label stretching algorithm
 * Extends milestone labels as far as possible within available space
 * Only truncates when overlap would occur
 * @param {Array} milestones - Milestones to process
 * @param {number} monthWidth - Width per month in pixels
 * @param {Date} timelineStartDate - Start of timeline
 * @param {Date} timelineEndDate - End of timeline
 * @returns {Array} Processed milestones with smart labels
 */
export const createSmartMilestoneLabels = (milestones, monthWidth, timelineStartDate, timelineEndDate, fontSize = '14px') => {
    if (!milestones?.length) return [];

    // Sort milestones by date to process in order
    const sortedMilestones = [...milestones].sort((a, b) => {
        const dateA = parseDate(a.date);
        const dateB = parseDate(b.date);
        return dateA - dateB;
    });

    // Calculate positions for all milestones
    const milestonesWithPositions = sortedMilestones.map(milestone => {
        const milestoneDate = parseDate(milestone.date);
        const x = calculateMilestonePosition(milestoneDate, timelineStartDate, monthWidth);
        return {
            ...milestone,
            x,
            date: milestoneDate,
            originalLabel: milestone.label || milestone.title || milestone.name || 'Milestone'
        };
    });

    // For each milestone, determine the maximum stretch window
    const processedMilestones = milestonesWithPositions.map((currentMilestone, index) => {
        // Find the stretch boundaries
        const leftBoundary = index > 0 ? milestonesWithPositions[index - 1].x : 0;

        // For right boundary, be more generous when there's no next milestone
        let rightBoundary;
        if (index < milestonesWithPositions.length - 1) {
            // There is a next milestone - use its position as boundary
            rightBoundary = milestonesWithPositions[index + 1].x;
        } else {
            // No next milestone - allow stretching to the actual timeline end
            // Calculate the position of the timeline end date
            rightBoundary = calculateMilestonePosition(timelineEndDate, timelineStartDate, monthWidth);
        }

        // Calculate available stretch window (leave some margin for readability)
        const margin = 10; // 10px margin between adjacent milestone labels
        const availableLeftSpace = Math.max(0, currentMilestone.x - leftBoundary - margin);
        const availableRightSpace = Math.max(0, rightBoundary - currentMilestone.x - margin);

        // Total available width for the label (can extend in both directions from milestone marker)
        const maxLabelWidth = availableLeftSpace + availableRightSpace;

        // Try to fit the full label
        const fullLabelWidth = calculateTextWidth(currentMilestone.originalLabel, fontSize);

        let finalLabel;
        if (fullLabelWidth <= maxLabelWidth) {
            // Label fits fully - no truncation needed
            finalLabel = currentMilestone.originalLabel;
        } else {
            // Label needs truncation - use smart truncation
            finalLabel = truncateTextToWidth(currentMilestone.originalLabel, maxLabelWidth, fontSize);
        }

        return {
            ...currentMilestone,
            label: finalLabel,
            stretchWidth: maxLabelWidth,
            usedFullLabel: fullLabelWidth <= maxLabelWidth
        };
    });

    return processedMilestones;
};

