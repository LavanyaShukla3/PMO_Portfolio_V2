import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import TimelineViewDropdown from '../components/TimelineViewDropdown';
import TimelineAxis from '../components/TimelineAxis';
import QuarterlyTimelineAxis from '../components/QuarterlyTimelineAxis';
import MilestoneMarker from '../components/MilestoneMarker';
import PaginationControls from '../components/PaginationControls';
import { getTimelineRange, getTimelineRangeForView, isProjectInTimelineViewport, parseDate, calculatePosition, calculateMilestonePosition, groupMilestonesByMonth, getMonthlyLabelPosition, createVerticalMilestoneLabels, truncateLabel } from '../utils/dateUtils';
import { useGlobalDataCache } from '../contexts/GlobalDataCacheContext';
import { getPaginationInfo, getPaginatedData, handlePageChange, ITEMS_PER_PAGE } from '../services/paginationService';
import differenceInDays from 'date-fns/differenceInDays';

// Fixed constants (zoom removed)
const getResponsiveConstants = () => {
    const screenWidth = window.innerWidth;
    const isMobile = screenWidth < 768;

    // Apply mobile adjustments if needed
    const mobileAdjustment = isMobile ? 0.8 : 1.0;

    return {
        MONTH_WIDTH: Math.round(100 * mobileAdjustment),
        LABEL_WIDTH: Math.round(220 * mobileAdjustment),
        BASE_BAR_HEIGHT: Math.round(10 * mobileAdjustment),
        MILESTONE_LABEL_HEIGHT: Math.round(20 * mobileAdjustment),
        VISIBLE_MONTHS: isMobile ? Math.max(6, Math.round(13 * 0.6)) : 13,
        TOUCH_TARGET_SIZE: Math.max(isMobile ? 44 : 16, Math.round(24 * mobileAdjustment)),
        FONT_SIZE: '14px',
        MILESTONE_FONT_SIZE: '10px',
        PROJECT_SCALE: 1.0,
        ROW_PADDING: Math.round(8 * mobileAdjustment)
    };
};

const DAYS_THRESHOLD = 16; // Threshold for considering milestones as overlapping - moved to dateUtils.js
const MAX_LABEL_LENGTH = 5; // Maximum length before truncation - moved to dateUtils.js

const statusColors = {
    'Red': '#ef4444',    // Tailwind red-500
    'Amber': '#f59e0b',  // Tailwind amber-500
    'Green': '#10b981',  // Tailwind emerald-500
    'Grey': '#9ca3af',   // Tailwind gray-400
    'Yellow': '#E5DE00'
};

// Use centralized truncateLabel function from dateUtils.js

// Updated: Now processes only SG3 milestones (filtered in dataService.js)
const processMilestonesWithPosition = (milestones, timelineStartDate, monthWidth = 100, projectEndDate = null, projectIndex = 0, timelineEndDate = null) => {
    if (!milestones?.length) return [];

    // CRITICAL FIX: Filter milestones to only include those within the timeline viewport
    const timelineFilteredMilestones = milestones.filter(milestone => {
        // DEBUG: Pass milestone label as context to parseDate
        const milestoneDate = parseDate(milestone.date, milestone.label);
        if (!milestoneDate) return false;

        // Only include milestones that fall within the timeline range
        const isWithinTimeline = milestoneDate >= timelineStartDate && milestoneDate <= timelineEndDate;


        return isWithinTimeline;
    });


    // Group filtered milestones by month for positioning logic
    const monthlyGroups = groupMilestonesByMonth(timelineFilteredMilestones);
    const processedMilestones = [];

    // Process each monthly group with smart labels
    Object.entries(monthlyGroups).forEach(([monthKey, monthMilestones]) => {
        // Determine label position for this month (odd = above, even = below)
        // Use strict monthly parity to keep calculations consistent with createVerticalMilestoneLabels
        const labelPosition = getMonthlyLabelPosition(monthKey);

        // Calculate vertical, row-aware labels for this month using all in-viewport milestones
        const maxInitialWidth = monthWidth * 8; // generous initial width (up to 8 months)
        const verticalLabelData = createVerticalMilestoneLabels(
            monthMilestones,
            maxInitialWidth,
            '14px',
            timelineFilteredMilestones,
            monthWidth
        );
        
        // Extract labels and metadata
        const verticalLabelsForMonth = verticalLabelData.labels;
        const textAnchor = verticalLabelData.textAnchor;
        const spanMonths = verticalLabelData.spanMonths;

        // Process each milestone in the month
        monthMilestones.forEach((milestone, index) => {
            // STRICT RULE FIX: Only the first milestone in each month shows the labels AND the shape
            const isFirstInMonth = index === 0;
            // DEBUG: Pass milestone label as context
            const milestoneDate = parseDate(milestone.date, milestone.label);
            const x = calculateMilestonePosition(milestoneDate, timelineStartDate, monthWidth, projectEndDate);

            processedMilestones.push({
                ...milestone,
                x,
                date: milestoneDate,
                isGrouped: monthMilestones.length > 1,
                isMonthlyGrouped: true,
                monthKey,
                labelPosition,
                // Use vertical, row-aware labels generated above
                label: milestone.label,
                horizontalLabel: '', // Enforce strict vertical stacking
                verticalLabels: isFirstInMonth ? verticalLabelsForMonth : [],
                showLabel: true,
                shouldWrapText: false,
                hasAdjacentMilestones: false,
                fullLabel: isFirstInMonth && verticalLabelsForMonth.length > 0 ? verticalLabelsForMonth[0] : (milestone.label || ''),
                shouldRenderShape: isFirstInMonth,
                allMilestonesInProject: milestones,
                currentMilestoneDate: milestone.date,
                // NEW: Adaptive text anchoring metadata
                textAnchor: textAnchor, // 'start', 'middle', or 'end'
                spanMonths: spanMonths, // Number of months span
            });
        });
    });

    // Sort by date for consistent rendering order
    return processedMilestones.sort((a, b) => a.date - b.date);
};

const PortfolioGanttChart = ({ onDrillToProgram, onBackToWelcome }) => {
    const [selectedParent, setSelectedParent] = useState('All');
    const [responsiveConstants, setResponsiveConstants] = useState(getResponsiveConstants());
    const [loading, setLoading] = useState(false); // Will use cached data
    const [error, setError] = useState(null);
    
    // Get cached data and state
    const { 
        portfolioData,
        programData,
        isLoading: cacheLoading, 
        preserveViewState, 
        getViewState 
    } = useGlobalDataCache();
    
    // NEW: Timeline view state
    const [timelineView, setTimelineView] = useState('current14'); // Default to "14 Months Current Viewport"

    const ganttScrollRef = useRef(null);
    const leftPanelScrollRef = useRef(null);
    // scrollPositionRef removed - no horizontal scrolling in fixed-width layout

    // Get timeline range based on selected view
    const { startDate, endDate } = getTimelineRangeForView(timelineView);
    
    // Calculate total months dynamically based on selected timeline
    const totalMonths = Math.ceil(differenceInDays(endDate, startDate) / 30);
    
    // Calculate dynamic month width to fit viewport (no horizontal scrolling)
    const availableGanttWidth = window.innerWidth - responsiveConstants.LABEL_WIDTH - 40; // 40px for margins/padding
    const dynamicMonthWidth = Math.max(30, Math.floor(availableGanttWidth / totalMonths)); // Minimum 30px per month
    

    // Handle window resize - recalculate both responsive constants and force re-render for dynamic spacing
    useEffect(() => {
        const handleResize = () => {
            setResponsiveConstants(getResponsiveConstants());
            // Force a re-render to recalculate dynamic spacing based on new viewport height
            // This is necessary because getDynamicSpacingInfo() uses window.innerHeight
            setTimeout(() => {
                // Small delay to ensure DOM has updated with new dimensions
                setCurrentPage(prev => prev); // Trigger re-render without changing page
            }, 10);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []); // Remove currentPage from dependency array to fix circular reference

    // Timeline view change handler
    const handleTimelineViewChange = (newView) => {
        setTimelineView(newView);
    };

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [allData, setAllData] = useState([]); // Store all loaded data
    
    // Use cached data instead of making API calls
    useEffect(() => {
        if (portfolioData && portfolioData.data) {
            setAllData(portfolioData.data);
            setCurrentPage(1);
            setLoading(false);
            setError(null);
        } else if (!cacheLoading && !portfolioData) {
            // Don't show error immediately - keep loading state
            setLoading(true);
        }
    }, [portfolioData, cacheLoading]);

    // Scroll synchronization handlers - UPDATED for fixed-width layout
    // NOTE: Horizontal scrolling disabled - only vertical scroll sync needed
    const handleGanttScroll = (e) => {
        const scrollTop = e.target.scrollTop;
        // Synchronize vertical scroll with left panel
        if (leftPanelScrollRef.current && leftPanelScrollRef.current.scrollTop !== scrollTop) {
            leftPanelScrollRef.current.scrollTop = scrollTop;
        }
    };

    const handleLeftPanelScroll = (e) => {
        const scrollTop = e.target.scrollTop;
        // Synchronize vertical scroll with gantt chart
        if (ganttScrollRef.current && ganttScrollRef.current.scrollTop !== scrollTop) {
            ganttScrollRef.current.scrollTop = scrollTop;
        }
    };

    // UPDATED: No horizontal scroll restoration needed in fixed-width layout
    useEffect(() => {
    }, [allData, loading]); // Runs when data changes and loading stops

    // OPTIMIZATION: Memoize portfolio ID to name mapping
    // Research: https://react.dev/reference/react/useMemo
    const portfolioIdToNameMap = useMemo(() => {
        const map = new Map();
        
        // Build the mapping from available COE_ROADMAP_PARENT_NAME fields
        (allData || []).forEach(item => {
            if (item.COE_ROADMAP_PARENT_ID && item.COE_ROADMAP_PARENT_NAME) {
                map.set(item.COE_ROADMAP_PARENT_ID, item.COE_ROADMAP_PARENT_NAME);
            }
        });
        
        return map;
    }, [allData]);
    
    // OPTIMIZATION: Memoize data with parent names
    const dataWithParentNames = useMemo(() => {
        return (allData || []).map(item => ({
            ...item,
            parentName: item.COE_ROADMAP_PARENT_NAME || 
                       (item.COE_ROADMAP_PARENT_ID ? 
                        portfolioIdToNameMap.get(item.COE_ROADMAP_PARENT_ID) || item.COE_ROADMAP_PARENT_ID 
                        : 'Root'),
            isDrillable: false
        }));
    }, [allData, portfolioIdToNameMap]);

    // Build set of Program parent IDs from globally cached programData
    // programData might be an object with a 'data' property or direct array
    // OPTIMIZATION: Already using React.useMemo - keep as is
    const programParentIds = React.useMemo(() => {
        const ids = new Set();
        
        // Handle different programData structures
        let programArray = null;
        if (Array.isArray(programData)) {
            programArray = programData;
        } else if (programData && Array.isArray(programData.data)) {
            programArray = programData.data;
        } else if (programData && programData.projects && Array.isArray(programData.projects)) {
            programArray = programData.projects;
        }

        
        if (programArray && programArray.length > 0) {
            programArray.forEach(item => {
                const isProgramItem = item.isProgram || item.COE_ROADMAP_TYPE === 'Program';
                const parent = item.parentId || item.COE_ROADMAP_PARENT_ID;
                if (isProgramItem && parent) {
                    ids.add(parent);
                }
            });
            
        }
        
        return ids;
    }, [programData]);

    // Pass 2: Mark Portfolios as drillable if they have Program children
    // OPTIMIZATION: Memoize drillable logic
    const dataWithDrillableLogic = useMemo(() => {
        return dataWithParentNames.map(item => ({
            ...item,
            isDrillable: item.COE_ROADMAP_TYPE === 'Portfolio' && 
                        item.CHILD_ID && 
                        programParentIds.has(item.CHILD_ID)
        }));
    }, [dataWithParentNames, programParentIds]);

    // OPTIMIZATION: Memoize filtered data
    const filteredData = useMemo(() => {
        return selectedParent === 'All'
            ? dataWithDrillableLogic
            : dataWithDrillableLogic.filter(item => item.parentName === selectedParent);
    }, [dataWithDrillableLogic, selectedParent]);

    // OPTIMIZATION: Memoize timeline-filtered data
    const timelineFilteredData = useMemo(() => {
        return filteredData.filter(project =>
            isProjectInTimelineViewport(project, startDate, endDate)
        );
    }, [filteredData, startDate, endDate]);

    // OPTIMIZATION: Memoize paginated data
    const paginatedData = useMemo(() => {
        return getPaginatedData(timelineFilteredData, currentPage, ITEMS_PER_PAGE);
    }, [timelineFilteredData, currentPage]);

    // OPTIMIZATION: Memoize page change handler
    const onPageChange = useCallback((newPage) => {
        handlePageChange(newPage, Math.ceil(timelineFilteredData.length / ITEMS_PER_PAGE), setCurrentPage);
    }, [timelineFilteredData.length]);

    // OPTIMIZATION: Memoize parent names
    const parentNames = useMemo(() => {
        return ['All', ...Array.from(new Set(dataWithDrillableLogic.map(item => item.parentName).filter(name => name && name !== 'Root')))];
    }, [dataWithDrillableLogic]);

    // OPTIMIZATION: Memoize parent change handler
    const handleParentChange = useCallback((e) => {
        const value = e.target.value;
        setSelectedParent(value);
        setCurrentPage(1); // Reset to first page when filter changes
    }, []);

    // Apply project scaling based on zoom level (timeline filtering already applied)
    // OPTIMIZATION: Memoize scaled filtered data
    const getScaledFilteredData = useMemo(() => {
        const projectScale = responsiveConstants.PROJECT_SCALE || 1.0;

        if (projectScale >= 1.0) {
            return paginatedData;
        } else {
            const targetCount = Math.max(1, Math.round(paginatedData.length * projectScale));
            return paginatedData.slice(0, targetCount);
        }
    }, [paginatedData, responsiveConstants.PROJECT_SCALE]);

    const calculateMilestoneLabelHeight = (milestones, monthWidth = dynamicMonthWidth, projectIndex = 0) => {
        if (!milestones?.length) return { total: 0, above: 0, below: 0 };

        // Process milestones to get their positions and grouping info
        const processedMilestones = processMilestonesWithPosition(milestones, startDate, monthWidth, null, projectIndex, endDate);

        let maxAboveHeight = 0;
        let maxBelowHeight = 0;
        const LINE_HEIGHT = 12;
        const MILESTONE_LABEL_PADDING = 2; // Reduced padding for more compact layout
        const MILESTONE_ABOVE_OFFSET = 3; // Reduced to 70-80% of original (8px -> 3px)
        const MILESTONE_BELOW_OFFSET = 3; // Reduced to 70-80% of original (8px -> 3px)

        let hasAnyLabels = false;

        processedMilestones.forEach(milestone => {
            if (milestone.isMonthlyGrouped) {
                // Display3: Monthly grouped milestones - height depends on actual layout
                let labelHeight = 0;
                if (milestone.horizontalLabel && milestone.horizontalLabel.trim()) {
                    labelHeight = LINE_HEIGHT;
                    hasAnyLabels = true;
                } else if (milestone.verticalLabels?.length > 0) {
                    const nonEmptyLabels = milestone.verticalLabels.filter(label => label && label.trim());
                    labelHeight = nonEmptyLabels.length * LINE_HEIGHT;
                    if (nonEmptyLabels.length > 0) hasAnyLabels = true;
                }

                if (labelHeight > 0) {
                    if (milestone.labelPosition === 'above') {
                        maxAboveHeight = Math.max(maxAboveHeight, labelHeight + MILESTONE_ABOVE_OFFSET);
                    } else {
                        maxBelowHeight = Math.max(maxBelowHeight, labelHeight + MILESTONE_BELOW_OFFSET);
                    }
                }
            } else if (milestone.isGrouped && milestone.groupLabels?.length > 0) {
                const nonEmptyGroupLabels = milestone.groupLabels.filter(label => label && label.trim());
                if (nonEmptyGroupLabels.length > 0) {
                    const groupHeight = nonEmptyGroupLabels.length * LINE_HEIGHT;
                    maxBelowHeight = Math.max(maxBelowHeight, groupHeight + MILESTONE_LABEL_PADDING);
                    hasAnyLabels = true;
                }
            } else if (milestone.label && milestone.label.trim()) {
                hasAnyLabels = true;
                if (milestone.labelPosition === 'above') {
                    maxAboveHeight = Math.max(maxAboveHeight, MILESTONE_ABOVE_OFFSET);
                } else {
                    maxBelowHeight = Math.max(maxBelowHeight, MILESTONE_BELOW_OFFSET);
                }
            }
        });

        // Return detailed breakdown for better spacing calculations
        return {
            total: hasAnyLabels ? (maxAboveHeight + maxBelowHeight) : 0,
            above: hasAnyLabels ? maxAboveHeight : 0,
            below: hasAnyLabels ? maxBelowHeight : 0
        };
    };

    const calculateBarHeight = (project) => {
        // STEP 1: Calculate actual Gantt bar height (fixed)
        const ganttBarHeight = 12; // Fixed height for the actual bar
        
        // STEP 2: Calculate milestone label space needed (detailed breakdown)
        const milestoneHeights = calculateMilestoneLabelHeight(project.milestones, dynamicMonthWidth, 0);
        
        // STEP 3: Calculate project name space (minimal, just enough to display)
        const projectName = project.name || '';
        const estimatedNameWidth = responsiveConstants.LABEL_WIDTH - 16; // Account for padding
        const maxCharsPerLine = Math.max(30, estimatedNameWidth / 7); // More efficient text wrapping
        const textLines = Math.ceil(projectName.length / maxCharsPerLine);
        const lineHeight = Math.round(12 * (responsiveConstants.ZOOM_LEVEL || 1.0)); // Compact line height
        const nameHeight = Math.max(16, textLines * lineHeight); // Just enough for text
        
        // STEP 4: Content-driven height calculation with proper milestone spacing
        // The row height = MAX of:
        // - Space needed for project name in left panel
        // - Space needed for milestone labels above + Gantt bar + milestone labels below in right panel
        const leftPanelNeeds = nameHeight + 8; // Name + minimal padding
        const rightPanelNeeds = milestoneHeights.above + ganttBarHeight + milestoneHeights.below + 8; // Proper vertical stacking
        
        // Use the larger of the two, but keep it compact
        const contentDrivenHeight = Math.max(leftPanelNeeds, rightPanelNeeds);
        
        // STEP 5: Ensure minimum usability
        const minimumHeight = Math.round(28 * (responsiveConstants.ZOOM_LEVEL || 1.0)); // Reduced minimum
        
        return Math.max(minimumHeight, contentDrivenHeight);
    };

    // Use compact spacing like Program page instead of distributing across viewport
    // OPTIMIZATION: Memoize compact spacing info
    const getCompactSpacingInfo = useMemo(() => {
        const scaledData = getScaledFilteredData;
        if (scaledData.length === 0) return { totalHeight: 400, spacing: 1, topMargin: 8 };

        // Use fixed ultra-minimal spacing for compact layout (like Program page)
        const ultraMinimalSpacing = 1; // Ultra-minimal spacing - just 1px separation
        const topMargin = 8; // Absolute minimum top margin - just enough to prevent clipping

        // Calculate total height with compact spacing
        const totalContentHeight = scaledData.reduce((total, project) => {
            return total + calculateBarHeight(project) + ultraMinimalSpacing;
        }, topMargin);

        return {
            totalHeight: totalContentHeight,
            spacing: ultraMinimalSpacing,
            topMargin
        };
    }, [getScaledFilteredData]);

    // OPTIMIZATION: Memoize total height calculation
    const getTotalHeight = useMemo(() => {
        const scaledData = getScaledFilteredData;
        const ultraMinimalSpacing = 1; // Ultra-minimal spacing - just 1px separation
        const topMargin = 8; // Absolute minimum top margin
        
        // Calculate base height with compact spacing
        const baseHeight = scaledData.reduce((total, project) => {
            const barHeight = calculateBarHeight(project);
            return total + barHeight + ultraMinimalSpacing;
        }, topMargin);
        
        // Add extra space at the bottom for the last item's milestone labels that extend below
        if (scaledData.length > 0) {
            const lastProject = scaledData[scaledData.length - 1];
            if (lastProject.milestones?.length > 0) {
                // Calculate how much the milestone labels extend below the last bar
                const milestoneHeights = calculateMilestoneLabelHeight(lastProject.milestones, dynamicMonthWidth, scaledData.length - 1);
                // Add the below height plus some padding to ensure labels aren't cut off
                const bottomPadding = milestoneHeights.below + 20; // Extra 20px safety padding
                return baseHeight + bottomPadding;
            }
        }
        
        return baseHeight + 20; // Add minimal bottom padding even if no milestones
    }, [getScaledFilteredData, dynamicMonthWidth]);


    return (
        <div className="w-full h-screen flex flex-col overflow-hidden">
            {/* Back to Welcome Button */}
            {onBackToWelcome && (
                <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex items-center gap-2">
                    <button
                        onClick={onBackToWelcome}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:text-gray-900 transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back to Welcome
                    </button>
                </div>
            )}
            
            {/* Loading Status Badge - Top Right */}
            {loading && (
                <div 
                    style={{
                        position: 'fixed',
                        top: '20px',
                        right: '20px',
                        width: 'auto',
                        height: 'auto',
                        padding: '8px 15px',
                        zIndex: 1000,
                        backgroundColor: '#2196F3',
                        color: 'white',
                        borderRadius: '15px',
                        fontSize: '0.9em',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}
                >
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>{currentPage === 1 ? 'Loading...' : `Loading page ${currentPage}`}</span>
                </div>
            )}
            {/* Loading State */}
            {(cacheLoading || (loading && allData.length === 0)) && !error && (
                <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-600 text-lg">Loading Portfolio data...</p>
                    </div>
                </div>
            )}

            {/* Error State */}
            {error && !cacheLoading && (
                <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded m-4">
                    <h3 className="font-semibold">Error Loading Portfolio Data</h3>
                    <p>{error}</p>
                    <button 
                        onClick={() => window.location.reload()} 
                        className="mt-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* Main Content - Only show when not loading and no error */}
            {!loading && !error && (
            <>
            {/* Compact Header */}
            <div className="flex-shrink-0 px-2 py-2 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    {/* Left Section: Portfolio Selector & Timeline */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                            <label className="font-medium text-sm text-gray-700 whitespace-nowrap">Investment:</label>
                            <select
                                value={selectedParent}
                                onChange={handleParentChange}
                                className="border border-gray-300 rounded px-2 py-1 bg-white text-sm min-w-[120px] max-w-[180px]"
                            >
                                {parentNames.map((name) => (
                                    <option key={name} value={name}>
                                        {name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        
                        <TimelineViewDropdown
                            selectedView={timelineView}
                            onViewChange={handleTimelineViewChange}
                            className="text-sm"
                        />
                    </div>

                    {/* Center: Pagination */}
                    <div className="flex-1 flex justify-center min-w-0">
                        <PaginationControls
                            currentPage={currentPage}
                            totalItems={timelineFilteredData.length}
                            itemsPerPage={ITEMS_PER_PAGE}
                            onPageChange={onPageChange}
                            compact={true}
                        />
                    </div>
                    
                    {/* Milestone Legend */}
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                            <span className="text-xs font-medium text-gray-600">Milestones:</span>
                            <div className="flex gap-3">
                                <div className="flex items-center gap-1">
                                    <svg width="10" height="10" viewBox="0 0 16 16">
                                        <path d="M8 2 L14 8 L8 14 L2 8 Z" fill="#005CB9" stroke="#005CB9" strokeWidth="2"/>
                                    </svg>
                                    <span className="text-xs text-gray-700">Complete</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <svg width="10" height="10" viewBox="0 0 16 16">
                                        <path d="M8 2 L14 8 L8 14 L2 8 Z" fill="white" stroke="#005CB9" strokeWidth="2"/>
                                    </svg>
                                    <span className="text-xs text-gray-700">Incomplete</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <svg width="10" height="10" viewBox="0 0 16 16">
                                        <path d="M8 2 L14 8 L8 14 L2 8 Z" fill="black" stroke="white" strokeWidth="2"/>
                                    </svg>
                                    <span className="text-xs text-gray-700">Multiple</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Timeline Axis Header */}
            <div className="flex-shrink-0 bg-white border-b border-gray-200">
                <div className="flex">
                    {/* Left Panel Header */}
                    <div
                        className="flex-shrink-0 bg-gray-50 border-r border-gray-200 flex items-center px-2"
                        style={{ width: responsiveConstants.LABEL_WIDTH, height: '40px' }}
                    >
                        <span className="text-sm font-semibold text-gray-700 truncate">Portfolios</span>
                    </div>
                    
                    {/* Timeline Axis - Use Quarterly for 36-month views, Monthly for others */}
                    <div className="flex-1 overflow-hidden">
                        {(timelineView === 'future36' || timelineView === 'past36') ? (
                            <QuarterlyTimelineAxis
                                startDate={startDate}
                                endDate={endDate}
                                monthWidth={dynamicMonthWidth}
                                fontSize={responsiveConstants.FONT_SIZE}
                                totalWidth="100%"
                            />
                        ) : (
                            <TimelineAxis
                                startDate={startDate}
                                endDate={endDate}
                                monthWidth={dynamicMonthWidth}
                                fontSize={responsiveConstants.FONT_SIZE}
                                totalWidth="100%"
                            />
                        )}
                    </div>
                </div>
            </div>



            {/* Main Content Area - Flex Layout */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Panel - Portfolio Names */}
                <div
                    ref={leftPanelScrollRef}
                    className="flex-shrink-0 bg-white border-r border-gray-200 overflow-y-auto"
                    style={{
                        width: responsiveConstants.LABEL_WIDTH,
                        position: 'sticky',
                        left: 0,
                        zIndex: 10,
                    }}
                    onScroll={handleLeftPanelScroll}
                >
                    <div style={{ position: 'relative', height: getTotalHeight }}>
                        {getScaledFilteredData.map((project, index) => {
                            const scaledData = getScaledFilteredData;
                            const ultraMinimalSpacing = 1; // Ultra-minimal spacing
                            const topMargin = 8; // Absolute minimum top margin - just enough to prevent clipping

                            // Use fixed compact spacing like Program page
                            const yOffset = scaledData
                                .slice(0, index)
                                .reduce((total, p) => total + calculateBarHeight(p) + ultraMinimalSpacing, topMargin);
                            
                            return (
                                <div
                                    key={project.id}
                                    className={`absolute flex items-start border-b border-gray-100 transition-colors ${
                                        project.isDrillable ? 'cursor-pointer bg-blue-50/30 hover:bg-blue-100/50 border-blue-200' : 'cursor-default bg-white hover:bg-gray-50'
                                    }`}
                                    style={{
                                        top: yOffset,
                                        height: calculateBarHeight(project),
                                        paddingTop: '6px', // Add top padding
                                        paddingBottom: '6px', // Add bottom padding
                                        paddingLeft: responsiveConstants.TOUCH_TARGET_SIZE > 24 ? '12px' : '8px',
                                        fontSize: responsiveConstants.FONT_SIZE,
                                        width: '100%',
                                        cursor: project.isDrillable ? 'pointer' : 'default',
                                        minHeight: responsiveConstants.TOUCH_TARGET_SIZE,
                                        fontWeight: project.isDrillable ? 600 : 'normal',
                                    }}
                                    onClick={() => {
                                        if (project.isDrillable && onDrillToProgram) {
                                            // Pass the Portfolio's CHILD_ID which is what Programs reference as their parent
                                            onDrillToProgram(project.CHILD_ID, project.name);
                                        }
                                    }}
                                >
                                    <div className="flex items-center justify-between w-full h-full">
                                        <div className="flex flex-col justify-center flex-1 py-1.5">
                                            <span className={`pr-2 leading-tight ${
                                                project.isDrillable ? 'font-bold text-blue-900' : 'font-medium text-gray-700'
                                            }`} 
                                            title={project.name}
                                            style={{
                                                wordBreak: 'break-word',
                                                overflowWrap: 'break-word',
                                                lineHeight: '1.2',
                                                maxWidth: `${responsiveConstants.LABEL_WIDTH - 24}px`
                                            }}>
                                                {project.name || `[No Name - ID: ${project.id}]`}
                                                {project.isDrillable && (
                                                    <span className="text-blue-600 text-sm ml-1" title="Click to view programs">
                                                        ↗️
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right Panel - Gantt Chart */}
                <div
                    ref={ganttScrollRef}
                    className="flex-1 overflow-y-auto overflow-x-hidden"
                    onScroll={handleGanttScroll}
                >
                    <div className="relative w-full" style={{ height: getTotalHeight }}>
                        <svg
                            width={Math.max(800, window.innerWidth - responsiveConstants.LABEL_WIDTH)}
                            height={getTotalHeight}
                            style={{
                                touchAction: 'pan-y',
                                display: 'block'
                            }}
                            className="block"
                            overflow="visible"
                        >
                            {/* iii. Removed swimlanes from PortfolioGanttChart as requested */}
                            {getScaledFilteredData.map((project, index) => {
                                // Calculate cumulative Y offset using compact fixed spacing
                                const scaledData = getScaledFilteredData;
                                const ultraMinimalSpacing = 1; // Ultra-minimal spacing
                                const topMargin = 8; // Absolute minimum top margin

                                // Use fixed compact spacing that matches the left panel
                                const yOffset = scaledData
                                    .slice(0, index)
                                    .reduce((total, p) => total + calculateBarHeight(p) + ultraMinimalSpacing, topMargin);

                                const projectStartDate = parseDate(project.startDate);
                                const projectEndDate = parseDate(project.endDate);



                                // Skip rendering if dates are invalid
                                if (!projectStartDate || !projectEndDate) {
                                    return null;
                                }
                                
                                const startX = calculatePosition(projectStartDate, startDate, dynamicMonthWidth);
                                const endX = calculatePosition(projectEndDate, startDate, dynamicMonthWidth);
                                const width = endX - startX;

                                // Get detailed milestone label height breakdown
                                const milestoneHeights = calculateMilestoneLabelHeight(project.milestones, dynamicMonthWidth, index);
                                
                                // Position Gantt bar accounting for milestone labels above it
                                const ganttBarY = yOffset + Math.round(8 * (responsiveConstants.ZOOM_LEVEL || 1.0)) + milestoneHeights.above;
                                const milestoneY = ganttBarY + 6; // Center milestones with the 12px bar

                                // Process milestones with position information
                                const milestones = processMilestonesWithPosition(project.milestones, startDate, dynamicMonthWidth, projectEndDate, index, endDate);

                                return (
                                    <g key={`project-${project.id}`} className="project-group">
                                        {/* Render bar - positioned based on actual content needs */}
                                        <rect
                                            key={`bar-${project.id}`}
                                            x={startX}
                                            y={ganttBarY}
                                            width={Math.max(width + 2, 4)} // Add 2px to width for milestone alignment
                                            height={12} // 12px height instead of TOUCH_TARGET_SIZE
                                            rx={3} // Keep 3px border radius
                                            fill={project.status ? statusColors[project.status] : statusColors.Grey}
                                            className="transition-opacity duration-150 hover:opacity-90 cursor-default"
                                        />

                                        {/* Render milestones - positioned to align with bar center */}
                                        {milestones.map((milestone, mIndex) => (
                                            <MilestoneMarker
                                                key={`${project.id}-milestone-${mIndex}`}
                                                x={milestone.x}
                                                y={milestoneY}
                                                complete={milestone.status}
                                                label={milestone.label}
                                                isSG3={milestone.isSG3}
                                                labelPosition={milestone.labelPosition}
                                                shouldWrapText={milestone.shouldWrapText}
                                                isGrouped={milestone.isGrouped}
                                                groupLabels={milestone.groupLabels}
                                                fullLabel={milestone.fullLabel}
                                                hasAdjacentMilestones={milestone.hasAdjacentMilestones}
                                                showLabel={milestone.showLabel}
                                                fontSize={responsiveConstants.MILESTONE_FONT_SIZE}
                                                isMobile={responsiveConstants.TOUCH_TARGET_SIZE > 24}
                                                zoomLevel={responsiveConstants.ZOOM_LEVEL}
                                                // Display3: New props for monthly grouped labels
                                                isMonthlyGrouped={milestone.isMonthlyGrouped}
                                                monthlyLabels={milestone.monthlyLabels}
                                                horizontalLabel={milestone.horizontalLabel}
                                                verticalLabels={milestone.verticalLabels}
                                                monthKey={milestone.monthKey}
                                                // NEW PROPS for the fixes
                                                shouldRenderShape={milestone.shouldRenderShape}
                                                allMilestonesInProject={milestone.allMilestonesInProject}
                                                currentMilestoneDate={milestone.currentMilestoneDate}
                                            />
                                        ))}
                                    </g>
                                );
                            })}
                        </svg>
                    </div>
                </div>
            </div>


            </>
            )}
        </div>
    );
};

// OPTIMIZATION: Wrap component with React.memo to prevent unnecessary re-renders
// Research: https://react.dev/reference/react/memo
export default memo(PortfolioGanttChart);

