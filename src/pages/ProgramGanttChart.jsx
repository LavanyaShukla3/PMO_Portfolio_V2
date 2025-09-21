import React, { useState, useEffect, useRef } from 'react';
import TimelineAxis from '../components/TimelineAxis';
import TimelineViewDropdown from '../components/TimelineViewDropdown';
import MilestoneMarker from '../components/MilestoneMarker';
import PaginationControls from '../components/PaginationControls';
import { getTimelineRangeForView, isProjectInTimelineViewport, parseDate, calculatePosition, calculateMilestonePosition, groupMilestonesByMonth, getMonthlyLabelPosition, createVerticalMilestoneLabels, getInitialScrollPosition, truncateLabel } from '../utils/dateUtils';
import { useGlobalDataCache } from '../contexts/GlobalDataCacheContext';
import { getPaginationInfo, getPaginatedData, handlePageChange, ITEMS_PER_PAGE } from '../services/paginationService';
import { differenceInDays, differenceInMonths } from 'date-fns';

// Zoom levels configuration
const ZOOM_LEVELS = {
    0.5: { // 50% - Maximum Zoom Out
        MONTH_WIDTH: 40,
        VISIBLE_MONTHS: 24,
        FONT_SIZE: '8px',
        LABEL_WIDTH: 100,
        BASE_BAR_HEIGHT: 4, // Reduced for more compact rows
        PROGRAM_BAR_HEIGHT: 6,
        TOUCH_TARGET_SIZE: 16,
        MILESTONE_LABEL_HEIGHT: 8,
        MILESTONE_FONT_SIZE: '8px',
        PROJECT_SCALE: 2.0, // Show significantly more projects
        ROW_PADDING: 4 // Reduced padding between rows
    },
    0.75: { // 75% - Zoom Out
        MONTH_WIDTH: 60,
        VISIBLE_MONTHS: 18,
        FONT_SIZE: '10px',
        LABEL_WIDTH: 140,
        BASE_BAR_HEIGHT: 6, // Smaller bars for more projects
        PROGRAM_BAR_HEIGHT: 8,
        TOUCH_TARGET_SIZE: 20,
        MILESTONE_LABEL_HEIGHT: 12,
        MILESTONE_FONT_SIZE: '9px',
        PROJECT_SCALE: 1.5, // Show more projects
        ROW_PADDING: 6
    },
    1.0: { // 100% - Default
        MONTH_WIDTH: 100,
        VISIBLE_MONTHS: 13,
        FONT_SIZE: '14px',
        LABEL_WIDTH: 220,
        BASE_BAR_HEIGHT: 10,
        PROGRAM_BAR_HEIGHT: 12,
        TOUCH_TARGET_SIZE: 24,
        MILESTONE_LABEL_HEIGHT: 20,
        MILESTONE_FONT_SIZE: '10px', // Reduced from default
        PROJECT_SCALE: 1.0, // Normal project count
        ROW_PADDING: 8 // Standard padding
    },
    1.25: { // 125% - Zoom In
        MONTH_WIDTH: 125,
        VISIBLE_MONTHS: 10,
        FONT_SIZE: '16px',
        LABEL_WIDTH: 275,
        BASE_BAR_HEIGHT: 14,
        PROGRAM_BAR_HEIGHT: 16,
        TOUCH_TARGET_SIZE: 30,
        MILESTONE_LABEL_HEIGHT: 28,
        MILESTONE_FONT_SIZE: '12px',
        PROJECT_SCALE: 0.7, // Show fewer projects
        ROW_PADDING: 12 // More padding for larger rows
    },
    1.5: { // 150% - Maximum Zoom In
        MONTH_WIDTH: 150,
        VISIBLE_MONTHS: 8,
        FONT_SIZE: '18px',
        LABEL_WIDTH: 330,
        BASE_BAR_HEIGHT: 18,
        PROGRAM_BAR_HEIGHT: 20,
        TOUCH_TARGET_SIZE: 36,
        MILESTONE_LABEL_HEIGHT: 32,
        MILESTONE_FONT_SIZE: '14px',
        PROJECT_SCALE: 0.5, // Show significantly fewer projects
        ROW_PADDING: 16 // Maximum padding for largest rows
    }
};

// Responsive constants with zoom support
const getResponsiveConstants = (zoomLevel = 1.0) => {
    const screenWidth = window.innerWidth;
    const isMobile = screenWidth < 768;
    const isTablet = screenWidth >= 768 && screenWidth < 1024;

    // Get base zoom configuration
    const zoomConfig = ZOOM_LEVELS[zoomLevel] || ZOOM_LEVELS[1.0];

    // Apply mobile adjustments if needed
    const mobileAdjustment = isMobile ? 0.8 : 1.0;

    return {
        MONTH_WIDTH: Math.round(zoomConfig.MONTH_WIDTH * mobileAdjustment),
        TOTAL_MONTHS: 73,
        LABEL_WIDTH: Math.round(zoomConfig.LABEL_WIDTH * mobileAdjustment),
        BASE_BAR_HEIGHT: Math.round(zoomConfig.BASE_BAR_HEIGHT * mobileAdjustment),
        PROGRAM_BAR_HEIGHT: Math.round(zoomConfig.PROGRAM_BAR_HEIGHT * mobileAdjustment),
        MILESTONE_LABEL_HEIGHT: Math.round(zoomConfig.MILESTONE_LABEL_HEIGHT * mobileAdjustment),
        VISIBLE_MONTHS: isMobile ? Math.max(6, Math.round(zoomConfig.VISIBLE_MONTHS * 0.6)) : zoomConfig.VISIBLE_MONTHS,
        TOUCH_TARGET_SIZE: Math.max(isMobile ? 44 : 16, Math.round(zoomConfig.TOUCH_TARGET_SIZE * mobileAdjustment)),
        FONT_SIZE: zoomConfig.FONT_SIZE,
        MILESTONE_FONT_SIZE: zoomConfig.MILESTONE_FONT_SIZE,
        PROJECT_SCALE: zoomConfig.PROJECT_SCALE,
        ROW_PADDING: Math.round(zoomConfig.ROW_PADDING * mobileAdjustment),
        ZOOM_LEVEL: zoomLevel
    };
};

const DAYS_THRESHOLD = 16;
const MAX_LABEL_LENGTH = 5;

const statusColors = {
    'Red': '#ef4444',    // Tailwind red-500
    'Amber': '#f59e0b',  // Tailwind amber-500
    'Green': '#10b981',  // Tailwind emerald-500
    'Grey': '#9ca3af',   // Tailwind gray-400
    'Yellow': '#E5DE00'
};

// Display3: Monthly grouped milestone processing logic
// Updated: Now processes only SG3 milestones (filtered in dataService.js)
const processMilestonesWithPosition = (milestones, startDate, monthWidth = 100, projectEndDate = null) => {
    if (!milestones?.length) return [];

    // Display3: Group milestones by month
    const monthlyGroups = groupMilestonesByMonth(milestones);
    const maxInitialWidth = monthWidth * 8; // Allow intelligent calculation up to 8 months
    

    const processedMilestones = [];

    // Process each monthly group
    Object.entries(monthlyGroups).forEach(([monthKey, monthMilestones]) => {
        // Determine label position for this month (odd = above, even = below)
        const labelPosition = getMonthlyLabelPosition(monthKey);

        // STRICT RULES: Only vertical stacking allowed, no horizontal layout
        // RULE 1: One milestone label per month with alternating positions
        // RULE 2: Multiple milestones stacked vertically with intelligent width calculation
        
        const verticalLabels = createVerticalMilestoneLabels(monthMilestones, maxInitialWidth, '14px', milestones, monthWidth);
        const horizontalLabel = ''; // Disabled to enforce strict vertical stacking


        // Process each milestone in the month
        monthMilestones.forEach((milestone, index) => {
            const milestoneDate = parseDate(milestone.date);
            // Use the new milestone positioning function that aligns with bar ends
            const x = calculateMilestonePosition(milestoneDate, startDate, monthWidth, projectEndDate);

            // STRICT RULE FIX: Only the first milestone in each month shows the labels AND the shape
            // This prevents duplicate label rendering AND duplicate shapes for multiple milestones in same month
            const isFirstInMonth = index === 0;

            processedMilestones.push({
                ...milestone,
                x,
                date: milestoneDate,
                isGrouped: monthMilestones.length > 1,
                isMonthlyGrouped: true, // New flag for Display3
                monthKey,
                labelPosition,
                horizontalLabel: isFirstInMonth ? horizontalLabel : '', // Only first milestone shows horizontal label
                verticalLabels: isFirstInMonth ? verticalLabels : [], // Only first milestone shows vertical labels
                showLabel: true, // Display3: Always show labels
                shouldWrapText: false,
                hasAdjacentMilestones: false, // Not used in Display3
                fullLabel: milestone.label, // Keep original label for tooltips
                shouldRenderShape: isFirstInMonth, // NEW: Only render shape for first milestone in month
                allMilestonesInProject: milestones, // Pass all milestones for ±4 months check
                currentMilestoneDate: milestoneDate // Pass current date for proximity check
            });
        });
    });

    // Sort by date for consistent rendering order
    return processedMilestones.sort((a, b) => a.date - b.date);
};

const ProgramGanttChart = ({ selectedPortfolioId, selectedPortfolioName, onBackToPortfolio, onDrillToSubProgram }) => {
    const [selectedProgram, setSelectedProgram] = useState('All');
    const [zoomLevel, setZoomLevel] = useState(1.0);
    const [responsiveConstants, setResponsiveConstants] = useState(getResponsiveConstants(1.0));
    const [loading, setLoading] = useState(false); // Will use cached data
    const [error, setError] = useState(null);
    
    // Get cached data and state
    const { 
        programData, 
        isLoading: cacheLoading, 
        preserveViewState, 
        getViewState 
    } = useGlobalDataCache();
    
    // Timeline view state with default to current14
    const [timelineView, setTimelineView] = useState('current14'); // Default to "14 Months Current Viewport"
    
    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [allData, setAllData] = useState([]); // Store all loaded data

    const timelineScrollRef = useRef(null);
    const ganttScrollRef = useRef(null);
    const leftPanelScrollRef = useRef(null);

    // Get timeline range based on selected view
    const { startDate, endDate } = getTimelineRangeForView(timelineView);
    console.log('📅 Program Timeline view:', timelineView);
    console.log('📅 Program Timeline range:', startDate?.toISOString(), 'to', endDate?.toISOString());
    
    // Calculate total months dynamically based on selected timeline
    const totalMonths = Math.ceil(differenceInDays(endDate, startDate) / 30);
    
    // Calculate dynamic month width to fit viewport (no horizontal scrolling)
    const availableGanttWidth = window.innerWidth - responsiveConstants.LABEL_WIDTH - 40; // 40px for margins/padding
    const dynamicMonthWidth = Math.max(30, Math.floor(availableGanttWidth / totalMonths)); // Minimum 30px per month
    
    // Calculate total width for the timeline (used by SVG)
    const totalWidth = totalMonths * dynamicMonthWidth;
    
    console.log('📐 Program Dynamic sizing:', {
        totalMonths,
        availableGanttWidth,
        dynamicMonthWidth,
        totalWidth,
        viewportWidth: window.innerWidth
    });

    // Handle window resize and zoom changes
    useEffect(() => {
        const handleResize = () => {
            setResponsiveConstants(getResponsiveConstants(zoomLevel));
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [zoomLevel]);

    // Update responsive constants when zoom level changes
    useEffect(() => {
        setResponsiveConstants(getResponsiveConstants(zoomLevel));
    }, [zoomLevel]);

    // Zoom handlers
    const handleZoomIn = () => {
        const zoomLevels = Object.keys(ZOOM_LEVELS).map(Number).sort((a, b) => a - b);
        const currentIndex = zoomLevels.indexOf(zoomLevel);
        if (currentIndex < zoomLevels.length - 1) {
            setZoomLevel(zoomLevels[currentIndex + 1]);
        }
    };

    const handleZoomOut = () => {
        const zoomLevels = Object.keys(ZOOM_LEVELS).map(Number).sort((a, b) => a - b);
        const currentIndex = zoomLevels.indexOf(zoomLevel);
        if (currentIndex > 0) {
            setZoomLevel(zoomLevels[currentIndex - 1]);
        }
    };

    const handleZoomReset = () => {
        setZoomLevel(1.0);
    };

    // Use cached data and filter by portfolio
    useEffect(() => {
        if (programData && programData.data) {
            console.log('✅ Using cached program data:', programData);
            
            // Filter programs by selected portfolio
            let filteredData = programData.data;
            if (selectedPortfolioId) {
                filteredData = programData.data.filter(program => 
                    program.portfolioId === selectedPortfolioId || 
                    program.portfolio_id === selectedPortfolioId ||
                    program.parent_program_id === selectedPortfolioId
                );
            }
            
            setAllData(filteredData);
            setCurrentPage(1);
            setLoading(false);
            setError(null);
            
            console.log(`✅ Program data filtered: ${filteredData.length} items from cache`);
        } else if (!cacheLoading && !programData) {
            setError('No program data available');
            setLoading(false);
        }
    }, [programData, cacheLoading, selectedPortfolioId]);

    // Handle page changes
    const onPageChange = (newPage) => {
        handlePageChange(newPage, Math.ceil(timelineFilteredData.length / ITEMS_PER_PAGE), setCurrentPage);
    };

    // Scroll synchronization handlers
    const handleTimelineScroll = (e) => {
        const scrollLeft = e.target.scrollLeft;
        if (ganttScrollRef.current && ganttScrollRef.current.scrollLeft !== scrollLeft) {
            ganttScrollRef.current.scrollLeft = scrollLeft;
        }
    };

    const handleGanttScroll = (e) => {
        const scrollLeft = e.target.scrollLeft;
        const scrollTop = e.target.scrollTop;
        if (timelineScrollRef.current && timelineScrollRef.current.scrollLeft !== scrollLeft) {
            timelineScrollRef.current.scrollLeft = scrollLeft;
        }
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

    // Calculate filtered data based on selection
    const filteredData = selectedProgram === 'All' 
        ? allData 
        : allData.filter(item => item.parentName === selectedProgram);

    // Apply hierarchical grouping BEFORE pagination (for "All" view)
    const hierarchicalData = selectedProgram === 'All' ? (() => {
        const hierarchicalResult = [];
        
        // Group by program names
        const programGroups = {};
        filteredData.forEach(item => {
            if (item.isProgram) {
                // This is a program header
                const programName = item.name;
                if (!programGroups[programName]) {
                    programGroups[programName] = {
                        program: item,
                        children: []
                    };
                }
            } else {
                // This is a sub-program, find its parent
                const parentProgram = filteredData.find(p => p.isProgram && p.id === item.parentId);
                if (parentProgram) {
                    const programName = parentProgram.name;
                    if (!programGroups[programName]) {
                        programGroups[programName] = {
                            program: parentProgram,
                            children: []
                        };
                    }
                    programGroups[programName].children.push(item);
                }
            }
        });
        
        // Create flat list with proper hierarchy: program header + indented children
        Object.values(programGroups).forEach(group => {
            // Add program header with special flag
            hierarchicalResult.push({
                ...group.program,
                isProgramHeader: true,
                displayName: `📌 ${group.program.name}`,
                originalName: group.program.name
            });
            
            // Add indented children
            group.children.forEach(child => {
                hierarchicalResult.push({
                    ...child,
                    isChildItem: true,
                    displayName: `   ${child.name}`, // Indent with spaces
                    originalName: child.name
                });
            });
        });
        
        return hierarchicalResult;
    })() : filteredData;

    // Apply timeline filtering BEFORE pagination
    const timelineFilteredData = hierarchicalData.filter(project => 
        isProjectInTimelineViewport(project, startDate, endDate)
    );

    // Calculate total items based on timeline-filtered data
    const totalItems = timelineFilteredData.length;

    // Smart pagination that repeats parent headers when children span multiple pages
    const getSmartPaginatedData = (data, page, itemsPerPage) => {
        if (selectedProgram !== 'All') {
            // For specific program view, use regular pagination
            return getPaginatedData(data, page, itemsPerPage);
        }
        
        // For "All" view with hierarchical data, use smart pagination
        const startIndex = (page - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        let paginatedSlice = data.slice(startIndex, endIndex);
        
        // Check if the page starts with child items (no parent header)
        if (paginatedSlice.length > 0 && paginatedSlice[0].isChildItem) {
            // Find the most recent parent header before this page
            let parentHeader = null;
            for (let i = startIndex - 1; i >= 0; i--) {
                if (data[i].isProgramHeader) {
                    parentHeader = data[i];
                    break;
                }
            }
            
            if (parentHeader) {
                // Check if any child in this page belongs to this parent
                const childrenBelongToParent = paginatedSlice.some(item => 
                    item.isChildItem && item.parentId === parentHeader.id
                );
                
                if (childrenBelongToParent) {
                    // Add the parent header at the beginning of the page
                    paginatedSlice = [parentHeader, ...paginatedSlice];
                    
                    // Remove one item from the end to maintain page size
                    if (paginatedSlice.length > itemsPerPage) {
                        paginatedSlice = paginatedSlice.slice(0, itemsPerPage);
                    }
                }
            }
        }
        
        return paginatedSlice;
    };

    // Get paginated data with smart parent header repetition
    const paginatedData = getSmartPaginatedData(timelineFilteredData, currentPage, ITEMS_PER_PAGE);
    
    // Function to get the paginated data (no additional timeline filtering needed)
    const getTimelineFilteredData = () => {
        console.log('🎯 Program getTimelineFilteredData called:', {
            paginatedLength: paginatedData.length,
            timelineView: timelineView,
            currentPage: currentPage
        });
        
        return paginatedData; // Already filtered by timeline
    };

    // Function to apply both program and timeline filtering  
    const applyFiltering = (programValue) => {
        setSelectedProgram(programValue);
        setCurrentPage(1); // Reset to first page when filter changes
    };



    // Legacy function - updated to use allData
    const applyLegacyFiltering = (programValue) => {
        let programFilteredData;
        if (programValue === 'All') {
            programFilteredData = allData;
        } else {
            // Filter to show selected program and its children
            const selectedProgramData = allData.find(item => 
                item.isProgram && item.name === programValue
            );
            
            if (selectedProgramData) {
                programFilteredData = allData.filter(item => 
                    item.parentId === selectedProgramData.id || item.id === selectedProgramData.id
                );
            } else {
                programFilteredData = [];
            }
        }

        // Legacy function no longer needed with pagination approach
        console.log('Legacy filtering would have filtered to:', programFilteredData.length, 'items');
    };

    // Note: We don't need to reset page when timeline changes
    // The filtering happens automatically via the filteredData calculation

    // Get unique parent names for the dropdown (to filter by parent program)
    const programNames = ['All', ...Array.from(new Set(allData
        .map(item => item.parentName)
        .filter(name => name && name !== 'Root')
    ))];

    const handleProgramChange = (e) => {
        const value = e.target.value;
        setSelectedProgram(value);
        applyFiltering(value);
    };

    // Apply project scaling based on zoom level
    const getScaledFilteredData = () => {
        let dataToProcess = getTimelineFilteredData();
        
        const projectScale = responsiveConstants.PROJECT_SCALE;
        if (projectScale >= 1.0) {
            // Zooming out - show more projects (no change needed, show all)
            return dataToProcess;
        } else {
            // Zooming in - show fewer projects
            const targetCount = Math.max(1, Math.round(dataToProcess.length * projectScale));
            return dataToProcess.slice(0, targetCount);
        }
    };

    const calculateMilestoneLabelHeight = (milestones, monthWidth = dynamicMonthWidth) => {
        if (!milestones?.length) return { total: 0, above: 0, below: 0 };

        // Process milestones to get their positions and grouping info
        const processedMilestones = processMilestonesWithPosition(milestones, startDate, monthWidth);

        let maxAboveHeight = 0;
        let maxBelowHeight = 0;
        const LINE_HEIGHT = 12;
        const COMPACT_LABEL_PADDING = 1; // Minimal padding for labels
        const COMPACT_ABOVE_OFFSET = 1; // Minimal space above bar - very close to marker
        const COMPACT_BELOW_OFFSET = 1; // Minimal space below bar - very close to marker

        let hasAnyLabels = false;

        processedMilestones.forEach(milestone => {
            if (milestone.isMonthlyGrouped) {
                // Display3: Monthly grouped milestones - height depends on actual layout
                let labelHeight = 0;
                if (milestone.horizontalLabel && milestone.horizontalLabel.trim()) {
                    // Horizontal layout: single line
                    labelHeight = LINE_HEIGHT;
                    hasAnyLabels = true;
                } else if (milestone.verticalLabels?.length > 0) {
                    // Vertical layout: multiple lines, but only count non-empty labels
                    const nonEmptyLabels = milestone.verticalLabels.filter(label => label && label.trim());
                    labelHeight = nonEmptyLabels.length * LINE_HEIGHT;
                    if (nonEmptyLabels.length > 0) hasAnyLabels = true;
                }

                if (labelHeight > 0) {
                    if (milestone.labelPosition === 'above') {
                        maxAboveHeight = Math.max(maxAboveHeight, labelHeight + COMPACT_ABOVE_OFFSET);
                    } else {
                        maxBelowHeight = Math.max(maxBelowHeight, labelHeight + COMPACT_BELOW_OFFSET);
                    }
                }
            } else if (milestone.isGrouped && milestone.groupLabels?.length > 0) {
                // Display2: Legacy grouped milestones - only count non-empty labels
                const nonEmptyGroupLabels = milestone.groupLabels.filter(label => label && label.trim());
                if (nonEmptyGroupLabels.length > 0) {
                    const groupHeight = nonEmptyGroupLabels.length * LINE_HEIGHT;
                    maxBelowHeight = Math.max(maxBelowHeight, groupHeight + COMPACT_LABEL_PADDING);
                    hasAnyLabels = true;
                }
            } else if (milestone.label && milestone.label.trim()) {
                // Display2: Legacy individual milestones - only count if label exists
                hasAnyLabels = true;
                if (milestone.labelPosition === 'above') {
                    maxAboveHeight = Math.max(maxAboveHeight, COMPACT_ABOVE_OFFSET);
                } else {
                    maxBelowHeight = Math.max(maxBelowHeight, COMPACT_BELOW_OFFSET);
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
        const isProgram = project.isProgram;
        const isProgramHeader = project.isProgramHeader;
        
        // STEP 1: Calculate actual Gantt bar height (fixed)
        const ganttBarHeight = isProgramHeader ? 14 : 12; // Fixed height for the actual bar
        
        // STEP 2: Calculate milestone label space needed (detailed breakdown)
        const milestoneHeights = calculateMilestoneLabelHeight(project.milestones, dynamicMonthWidth);
        
        // STEP 3: Calculate project name space (minimal, just enough to display)
        const projectName = project.displayName || project.name || '';
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

    const getTotalHeight = () => {
        const scaledData = getScaledFilteredData();
        const ultraMinimalSpacing = Math.round(1 * (responsiveConstants.ZOOM_LEVEL || 1.0)); // Ultra-minimal spacing - just 1px separation
        return scaledData.reduce((total, project) => {
            const barHeight = calculateBarHeight(project);
            return total + barHeight + ultraMinimalSpacing;
        }, Math.round(8 * (responsiveConstants.ZOOM_LEVEL || 1.0))); // Absolute minimum top margin - just enough to prevent clipping
    };

    return (
        <div className="w-full h-screen flex flex-col overflow-hidden">
            {/* Status Badge - Top Right */}
            {loading && (
                <div className="absolute top-4 right-4 z-50 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium shadow-md flex items-center gap-2">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                    Loading data...
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded m-4">
                    <h3 className="font-semibold">Error Loading Program Data</h3>
                    <p>{error}</p>
                    <button 
                        onClick={() => window.location.reload()} 
                        className="mt-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* Main Content - Show when data is available (even while loading more) */}
            {(allData.length > 0 || !loading) && !error && (
            <>
            {/* Compact Header */}
            <div className="flex-shrink-0 px-2 py-2 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    {/* Left Section */}
                    <div className="flex items-center gap-3 flex-wrap">
                        {onBackToPortfolio && (
                            <button
                                onClick={onBackToPortfolio}
                                className="text-blue-600 hover:text-blue-800 text-sm font-medium whitespace-nowrap"
                            >
                                ← Portfolio
                            </button>
                        )}
                        <div className="flex items-center gap-2">
                            <label className="font-medium text-sm text-gray-700 whitespace-nowrap">Program:</label>
                            <select
                                value={selectedProgram}
                                onChange={handleProgramChange}
                                className="border border-gray-300 rounded px-2 py-1 bg-white text-sm min-w-[120px] max-w-[180px]"
                            >
                                {programNames.map((name) => (
                                    <option key={name} value={name}>
                                        {name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        
                        <TimelineViewDropdown
                            selectedView={timelineView}
                            onViewChange={setTimelineView}
                            className="text-sm"
                        />
                    </div>

                    {/* Center: Pagination */}
                    <div className="flex-1 flex justify-center min-w-0">
                        <PaginationControls
                            currentPage={currentPage}
                            totalItems={totalItems}
                            itemsPerPage={ITEMS_PER_PAGE}
                            onPageChange={onPageChange}
                            compact={true}
                        />
                    </div>
                    
                    {/* Right Section: Compact Zoom & Legend */}
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                            <button
                                onClick={handleZoomOut}
                                disabled={zoomLevel <= 0.5}
                                className="w-7 h-7 flex items-center justify-center bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-300 rounded text-xs font-bold transition-colors"
                                title="Zoom Out"
                            >
                                −
                            </button>
                            <span className="text-xs text-gray-600 min-w-[35px] text-center font-medium">
                                {Math.round(zoomLevel * 100)}%
                            </span>
                            <button
                                onClick={handleZoomIn}
                                disabled={zoomLevel >= 1.5}
                                className="w-7 h-7 flex items-center justify-center bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-300 rounded text-xs font-bold transition-colors"
                                title="Zoom In"
                            >
                                +
                            </button>
                        </div>
                        
                        {/* Mini Legend */}
                        <div className="flex items-center gap-1 ml-2">
                            <span className="text-xs font-medium text-gray-600">Legend:</span>
                            <div className="flex gap-1">
                                <div className="flex items-center gap-1">
                                    <svg width="8" height="8" viewBox="0 0 16 16">
                                        <path d="M8 2 L14 8 L8 14 L2 8 Z" fill="white" stroke="#3B82F6" strokeWidth="2"/>
                                    </svg>
                                    <span className="text-xs text-gray-500">Done</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <svg width="8" height="8" viewBox="0 0 16 16">
                                        <path d="M8 2 L14 8 L8 14 L2 8 Z" fill="#3B82F6" stroke="#3B82F6" strokeWidth="2"/>
                                    </svg>
                                    <span className="text-xs text-gray-500">Todo</span>
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
                        <span className="text-sm font-semibold text-gray-700 truncate">Programs</span>
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
                {/* Left Panel - Program Names */}
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
                            const scaledData = getScaledFilteredData();
                            const ultraMinimalSpacing = Math.round(1 * (responsiveConstants.ZOOM_LEVEL || 1.0)); // Ultra-minimal spacing
                            const topMargin = Math.round(8 * (responsiveConstants.ZOOM_LEVEL || 1.0)); // Absolute minimum top margin - just enough to prevent clipping
                            const yOffset = scaledData
                                .slice(0, index)
                                .reduce((total, p) => total + calculateBarHeight(p) + ultraMinimalSpacing, topMargin);
                            
                            const isProgram = project.isProgram;
                            const isProgramHeader = project.isProgramHeader;
                            const isChildItem = project.isChildItem;
                            
                            return (
                                <div
                                    key={`${project.id}-${index}`}
                                    className={`absolute flex items-start border-b border-gray-100 transition-colors ${
                                        isProgramHeader 
                                            ? 'bg-blue-50 border-blue-200' 
                                            : isProgram 
                                                ? 'bg-gray-100' 
                                                : 'bg-white hover:bg-gray-50'
                                    }`}
                                    style={{
                                        top: yOffset,
                                        height: calculateBarHeight(project),
                                        paddingTop: '6px', // Add top padding
                                        paddingBottom: '6px', // Add bottom padding
                                        paddingLeft: responsiveConstants.TOUCH_TARGET_SIZE > 24 ? '12px' : '8px',
                                        fontSize: isProgramHeader ? 
                                            `calc(${responsiveConstants.FONT_SIZE} * 1.1)` : 
                                            responsiveConstants.FONT_SIZE,
                                        width: '100%',
                                        cursor: 'default',
                                        minHeight: responsiveConstants.TOUCH_TARGET_SIZE,
                                        fontWeight: (isProgram || isProgramHeader) ? 600 : 'normal',
                                        textTransform: (isProgram || isProgramHeader) ? 'uppercase' : 'none',
                                    }}
                                >
                                    <div className="flex items-center justify-between w-full h-full">
                                        <div className="flex flex-col justify-center flex-1 py-1.5">
                                            <span className={`pr-2 leading-tight ${
                                                isProgramHeader ? 'font-bold text-blue-900' :
                                                isProgram ? 'font-semibold text-gray-800' :
                                                'font-medium text-gray-700'
                                            }`} 
                                            title={project.originalName || project.name}
                                            style={{
                                                wordBreak: 'break-word',
                                                overflowWrap: 'break-word',
                                                lineHeight: '1.2',
                                                maxWidth: `${responsiveConstants.LABEL_WIDTH - 24}px`
                                            }}>
                                                {project.displayName || project.name}
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
                    <div className="relative w-full h-full">
                        <svg
                            width="100%"
                            height="100%"
                            viewBox={`0 0 ${Math.max(800, window.innerWidth - responsiveConstants.LABEL_WIDTH)} ${Math.max(400, getTotalHeight())}`}
                            preserveAspectRatio="none"
                            style={{
                                touchAction: 'pan-y', // Only allow vertical scrolling
                                minHeight: Math.max(400, getTotalHeight())
                            }}
                            className="block"
                        >
                            {getScaledFilteredData().map((project, index) => {
                                // Calculate cumulative Y offset with ultra-minimal spacing to pack rows ultra-tightly
                                const scaledData = getScaledFilteredData();
                                const ultraMinimalSpacing = Math.round(1 * (responsiveConstants.ZOOM_LEVEL || 1.0)); // Ultra-minimal spacing
                                const topMargin = Math.round(8 * (responsiveConstants.ZOOM_LEVEL || 1.0)); // Absolute minimum top margin - just enough to prevent clipping
                                const yOffset = scaledData
                                    .slice(0, index)
                                    .reduce((total, p) => total + calculateBarHeight(p) + ultraMinimalSpacing, topMargin);

                                const projectStartDate = parseDate(project.startDate);
                                const projectEndDate = parseDate(project.endDate);
                                const startX = calculatePosition(projectStartDate, startDate, dynamicMonthWidth);
                                const endX = calculatePosition(projectEndDate, startDate, dynamicMonthWidth);
                                const width = endX - startX;
                                
                                // Debug block removed

                                // Calculate the project's actual content height
                                const totalHeight = calculateBarHeight(project);
                                
                                // Get detailed milestone label height breakdown
                                const milestoneHeights = calculateMilestoneLabelHeight(project.milestones, dynamicMonthWidth);
                                
                                // Position Gantt bar accounting for milestone labels above it
                                const ganttBarY = yOffset + Math.round(8 * (responsiveConstants.ZOOM_LEVEL || 1.0)) + milestoneHeights.above;
                                const milestoneY = ganttBarY + 6; // Center milestones with the 12px bar

                                // Process milestones with position information
                                const milestones = processMilestonesWithPosition(project.milestones, startDate, dynamicMonthWidth, projectEndDate);

                                const isProgram = project.isProgram;
                                const isProgramHeader = project.isProgramHeader;

                                return (
                                    <g key={`project-${project.id}-${index}`} className="project-group">
                                        {/* Background highlight for program row - only as tall as needed */}
                                        {(isProgram || isProgramHeader) && (
                                            <rect
                                                x={0}
                                                y={yOffset}
                                                width={totalWidth}
                                                height={totalHeight}
                                                fill={isProgramHeader ? "#e0f2fe" : "#f0f9ff"}
                                                opacity={0.5}
                                            />
                                        )}

                                        {/* Render Gantt bars for projects with valid dates, including program headers with investment data */}
                                        {projectStartDate && projectEndDate && (
                                            <>
                                                {/* Render bar - positioned based on actual content needs */}
                                                <rect
                                                    key={`bar-${project.id}`}
                                                    x={startX}
                                                    y={ganttBarY}
                                                    width={Math.max(width + 2, 4)} // Add 2px to width for milestone alignment
                                                    height={isProgramHeader ? 14 : 12} // Slightly taller bars for program headers
                                                    rx={3} // Keep 3px border radius
                                                    fill={project.status ? statusColors[project.status] : statusColors.Grey}
                                                    className="transition-opacity duration-150 hover:opacity-90 cursor-default"
                                                    stroke={isProgramHeader ? "#1e40af" : "none"} // Blue border for program headers
                                                    strokeWidth={isProgramHeader ? 1 : 0}
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
                                                        // Fix for Issue 1: Only render shape for first milestone in month
                                                        shouldRenderShape={milestone.shouldRenderShape}
                                                        allMilestonesInProject={milestone.allMilestonesInProject}
                                                        currentMilestoneDate={milestone.currentMilestoneDate}
                                                    />
                                                ))}
                                            </>
                                        )}
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

export default ProgramGanttChart;