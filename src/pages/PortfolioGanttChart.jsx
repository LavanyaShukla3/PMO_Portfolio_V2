import React, { useState, useEffect, useRef } from 'react';
import TimelineViewDropdown from '../components/TimelineViewDropdown';
import TimelineAxis from '../components/TimelineAxis';
import MilestoneMarker from '../components/MilestoneMarker';
import PaginationControls from '../components/PaginationControls';
import { getTimelineRange, getTimelineRangeForView, isProjectInTimelineViewport, parseDate, calculatePosition, calculateMilestonePosition, groupMilestonesByMonth, getMonthlyLabelPosition, createVerticalMilestoneLabels, truncateLabel } from '../utils/dateUtils';
import { useGlobalDataCache } from '../contexts/GlobalDataCacheContext';
import { getPaginationInfo, getPaginatedData, handlePageChange, ITEMS_PER_PAGE } from '../services/paginationService';
import { differenceInDays } from 'date-fns';

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
        const milestoneDate = parseDate(milestone.date);
        if (!milestoneDate) return false;

        // Only include milestones that fall within the timeline range
        const isWithinTimeline = milestoneDate >= timelineStartDate && milestoneDate <= timelineEndDate;

        if (!isWithinTimeline) {
            console.log('🚫 Excluding milestone outside timeline:', milestone.label, milestoneDate.toISOString());
        }

        return isWithinTimeline;
    });

    console.log(`🎯 Timeline filtered milestones: ${timelineFilteredMilestones.length} out of ${milestones.length} milestones are within viewport`);

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
        const verticalLabelsForMonth = createVerticalMilestoneLabels(
            monthMilestones,
            maxInitialWidth,
            '14px',
            timelineFilteredMilestones,
            monthWidth
        );

        // Process each milestone in the month
        monthMilestones.forEach((milestone, index) => {
            // STRICT RULE FIX: Only the first milestone in each month shows the labels AND the shape
            const isFirstInMonth = index === 0;
            const milestoneDate = parseDate(milestone.date);
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
                // Removed smart-stretch metadata; labels are generated per-month above
            });
        });
    });

    // Sort by date for consistent rendering order
    return processedMilestones.sort((a, b) => a.date - b.date);
};

const PortfolioGanttChart = ({ onDrillToProgram }) => {
    const [selectedParent, setSelectedParent] = useState('All');
    const [responsiveConstants, setResponsiveConstants] = useState(getResponsiveConstants());
    const [loading, setLoading] = useState(false); // Will use cached data
    const [error, setError] = useState(null);
    
    // Get cached data and state
    const { 
        portfolioData, 
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
    console.log('� Responsive constants:', responsiveConstants);
    console.log('�📅 Timeline view:', timelineView);
    console.log('�📅 Timeline range:', startDate?.toISOString(), 'to', endDate?.toISOString());
    
    // Calculate total months dynamically based on selected timeline
    const totalMonths = Math.ceil(differenceInDays(endDate, startDate) / 30);
    
    // Calculate dynamic month width to fit viewport (no horizontal scrolling)
    const availableGanttWidth = window.innerWidth - responsiveConstants.LABEL_WIDTH - 40; // 40px for margins/padding
    const dynamicMonthWidth = Math.max(30, Math.floor(availableGanttWidth / totalMonths)); // Minimum 30px per month
    
    console.log('📐 Dynamic sizing:', {
        totalMonths,
        availableGanttWidth,
        dynamicMonthWidth,
        viewportWidth: window.innerWidth
    });

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
        console.log('📅 Timeline view changed to:', newView);
        setTimelineView(newView);
    };

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [allData, setAllData] = useState([]); // Store all loaded data
    
    // Use cached data instead of making API calls
    useEffect(() => {
        if (portfolioData && portfolioData.data) {
            console.log('✅ Using cached portfolio data:', portfolioData);
            setAllData(portfolioData.data);
            setCurrentPage(1);
            setLoading(false);
            setError(null);
        } else if (!cacheLoading && !portfolioData) {
            setError('No portfolio data available');
            setLoading(false);
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
        if (!loading) {
            console.log('📊 Data loaded, fixed-width layout ready');
            // No scroll restoration needed since we don't have horizontal scrolling
        }
    }, [allData, loading]); // Runs when data changes and loading stops

    // Create a mapping of portfolio IDs to their names from the data
    const portfolioIdToNameMap = new Map();
    
    // Build the mapping from available COE_ROADMAP_PARENT_NAME fields
    (allData || []).forEach(item => {
        // The data already contains COE_ROADMAP_PARENT_NAME from the backend
        if (item.COE_ROADMAP_PARENT_ID && item.COE_ROADMAP_PARENT_NAME) {
            portfolioIdToNameMap.set(item.COE_ROADMAP_PARENT_ID, item.COE_ROADMAP_PARENT_NAME);
        }
    });
    
    // Add parent names to data items - use the COE_ROADMAP_PARENT_NAME that comes from backend
    const dataWithParentNames = (allData || []).map(item => ({
        ...item,
        // Use the COE_ROADMAP_PARENT_NAME field that already exists in the data
        parentName: item.COE_ROADMAP_PARENT_NAME || 
                   (item.COE_ROADMAP_PARENT_ID ? 
                    portfolioIdToNameMap.get(item.COE_ROADMAP_PARENT_ID) || item.COE_ROADMAP_PARENT_ID 
                    : 'Root')
    }));

    // Calculate filtered data based on selection
    const filteredData = selectedParent === 'All'
        ? dataWithParentNames
        : dataWithParentNames.filter(item => item.parentName === selectedParent);

    // Apply timeline filtering BEFORE pagination (like Program page)
    const timelineFilteredData = filteredData.filter(project =>
        isProjectInTimelineViewport(project, startDate, endDate)
    );

    // Get paginated data from timeline-filtered data
    const paginatedData = getPaginatedData(timelineFilteredData, currentPage, ITEMS_PER_PAGE);

    // Handle page changes
    const onPageChange = (newPage) => {
        handlePageChange(newPage, Math.ceil(timelineFilteredData.length / ITEMS_PER_PAGE), setCurrentPage);
    };

    // Extract unique parent names for dropdown
    const parentNames = ['All', ...Array.from(new Set(dataWithParentNames.map(item => item.parentName).filter(name => name && name !== 'Root')))];
    
    // Debug logging for dropdown  
    if (portfolioIdToNameMap.size > 0) {
        console.log('✅ Portfolio dropdown mapping:', {
            totalItems: allData?.length || 0,
            portfolioNames: parentNames,
            mappingSize: portfolioIdToNameMap.size
        });
    }

    const handleParentChange = (e) => {
        const value = e.target.value;
        setSelectedParent(value);
        setCurrentPage(1); // Reset to first page when filter changes
    };

    // Apply project scaling based on zoom level (timeline filtering already applied)
    const getScaledFilteredData = () => {
        const projectScale = responsiveConstants.PROJECT_SCALE || 1.0;

        if (projectScale >= 1.0) {
            return paginatedData;
        } else {
            const targetCount = Math.max(1, Math.round(paginatedData.length * projectScale));
            return paginatedData.slice(0, targetCount);
        }
    };

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

    // Calculate dynamic spacing that utilizes available viewport height
    const getDynamicSpacingInfo = () => {
        const scaledData = getScaledFilteredData();
        if (scaledData.length === 0) return { totalHeight: 400, spacing: 8 };

        // Calculate available content height (viewport minus headers and pagination)
        const viewportHeight = window.innerHeight;
        const headerHeight = 120; // Approximate height for top header and timeline axis
        const paginationHeight = 60; // Approximate height for pagination
        const availableContentHeight = viewportHeight - headerHeight - paginationHeight;

        // Calculate total content height needed (without spacing)
        const totalContentHeight = scaledData.reduce((total, project) => {
            return total + calculateBarHeight(project);
        }, 0);

        // Calculate how much space we have left for spacing
        const topMargin = 12; // Reduced top margin for more compact layout
        const bottomPadding = 16; // Reduced bottom padding for more compact layout
        const usableSpacingArea = availableContentHeight - totalContentHeight - topMargin - bottomPadding;

        // Distribute the remaining space as spacing between rows
        const numberOfGaps = Math.max(1, scaledData.length + 1); // +1 for space before first item

        // CRITICAL: Ensure minimum spacing to prevent milestone label overlap
        // Calculate max milestone label extension that could overlap with adjacent rows
        const LINE_HEIGHT = 12;
        const MILESTONE_OFFSET = 3; // Reduced offset for compact layout
        const maxMilestoneExtension = LINE_HEIGHT + MILESTONE_OFFSET; // Max label extension
        const minRequiredSpacing = Math.max(6, maxMilestoneExtension * 0.6); // Compact but safe spacing

        const calculatedSpacing = usableSpacingArea > 0 ? Math.floor(usableSpacingArea / numberOfGaps) : 0;
        const dynamicSpacing = Math.max(minRequiredSpacing, calculatedSpacing); // Ensure minimum spacing for milestone clarity

        const totalHeight = totalContentHeight + (dynamicSpacing * numberOfGaps) + topMargin + bottomPadding;

        return {
            totalHeight: Math.max(availableContentHeight, totalHeight),
            spacing: dynamicSpacing,
            topMargin
        };
    };

    const getTotalHeight = () => {
        return getDynamicSpacingInfo().totalHeight;
    };


    return (
        <div className="w-full h-screen flex flex-col overflow-hidden">
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



            {/* Error State */}
            {error && (
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
                            <label className="font-medium text-sm text-gray-700 whitespace-nowrap">Portfolio:</label>
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
                    
                    {/* Timeline Axis */}
                    <div className="flex-1 overflow-hidden">
                        <TimelineAxis
                            startDate={startDate}
                            endDate={endDate}
                            monthWidth={dynamicMonthWidth}
                            fontSize={responsiveConstants.FONT_SIZE}
                            totalWidth="100%"
                        />
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
                    <div style={{ position: 'relative', height: getTotalHeight() }}>
                        {getScaledFilteredData().map((project, index) => {
                            const displayData = getScaledFilteredData();
                            const spacingInfo = getDynamicSpacingInfo();
                            console.log('🎨 Rendering project:', index, project.name, project);

                            // Use dynamic spacing for better visual separation
                            const yOffset = displayData
                                .slice(0, index)
                                .reduce((total, p) => total + calculateBarHeight(p) + spacingInfo.spacing, spacingInfo.topMargin + spacingInfo.spacing);
                            
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
                                            onDrillToProgram(project.id, project.name);
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
                    <div className="relative w-full" style={{ height: getTotalHeight() }}>
                        <svg
                            width={Math.max(800, window.innerWidth - responsiveConstants.LABEL_WIDTH)}
                            height={getTotalHeight()}
                            style={{
                                touchAction: 'pan-y',
                                display: 'block'
                            }}
                            className="block"
                        >
                            {/* iii. Removed swimlanes from PortfolioGanttChart as requested */}
                            {getScaledFilteredData().map((project, index) => {
                                // Calculate cumulative Y offset using dynamic spacing for optimal layout
                                const scaledData = getScaledFilteredData();
                                const spacingInfo = getDynamicSpacingInfo();
                                console.log('📊 Rendering Gantt bar for:', index, project.name, {
                                    startDate: project.startDate,
                                    endDate: project.endDate,
                                    milestones: project.milestones?.length || 0,
                                    spacing: spacingInfo.spacing
                                });

                                // Use dynamic spacing that matches the left panel
                                const yOffset = scaledData
                                    .slice(0, index)
                                    .reduce((total, p) => total + calculateBarHeight(p) + spacingInfo.spacing, spacingInfo.topMargin + spacingInfo.spacing);

                                const projectStartDate = parseDate(project.startDate);
                                const projectEndDate = parseDate(project.endDate);

                                console.log('📅 Parsed project dates:', {
                                    projectStartDate: projectStartDate?.toISOString(),
                                    projectEndDate: projectEndDate?.toISOString()
                                });

                                // Skip rendering if dates are invalid
                                if (!projectStartDate || !projectEndDate) {
                                    console.warn('⚠️ Skipping project due to invalid dates:', project.name);
                                    return null;
                                }
                                
                                const startX = calculatePosition(projectStartDate, startDate, dynamicMonthWidth);
                                const endX = calculatePosition(projectEndDate, startDate, dynamicMonthWidth);
                                const width = endX - startX;
                                
                                console.log('📏 Position calculations:', {
                                    startX, endX, width, yOffset,
                                    monthWidth: dynamicMonthWidth
                                });

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

export default PortfolioGanttChart;

