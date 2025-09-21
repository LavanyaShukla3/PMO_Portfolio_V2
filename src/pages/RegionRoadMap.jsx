import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useGlobalDataCache } from '../contexts/GlobalDataCacheContext';
import { parseDate, calculatePosition, calculateMilestonePosition, getTimelineRangeForView, isProjectInTimelineViewport, groupMilestonesByMonth, getMonthlyLabelPosition, createVerticalMilestoneLabels, getInitialScrollPosition, truncateLabel } from '../utils/dateUtils';
import { differenceInDays, differenceInMonths } from 'date-fns';
import TimelineAxis from '../components/TimelineAxis';
import TimelineViewDropdown from '../components/TimelineViewDropdown';
import MilestoneMarker from '../components/MilestoneMarker';
import GanttBar from '../components/GanttBar';
import PaginationControls from '../components/PaginationControls';
import { getPaginationInfo, getPaginatedData, handlePageChange, ITEMS_PER_PAGE } from '../services/paginationService';

// Zoom levels configuration
const ZOOM_LEVELS = {
    0.5: { // 50% - Maximum Zoom Out
        MONTH_WIDTH: 40,
        VISIBLE_MONTHS: 24,
        FONT_SIZE: '8px',
        LABEL_WIDTH: 160,
        BASE_BAR_HEIGHT: 4, // Reduced for more compact rows
        TOUCH_TARGET_SIZE: 16,
        MILESTONE_FONT_SIZE: '8px',
        PROJECT_SCALE: 2.0, // Show significantly more projects
        ROW_PADDING: 3 // Minimal padding for maximum compactness
    },
    0.75: { // 75% - Zoom Out
        MONTH_WIDTH: 60,
        VISIBLE_MONTHS: 18,
        FONT_SIZE: '10px',
        LABEL_WIDTH: 220,
        BASE_BAR_HEIGHT: 6, // Smaller bars for more projects
        TOUCH_TARGET_SIZE: 20,
        MILESTONE_FONT_SIZE: '9px',
        PROJECT_SCALE: 1.5, // Show more projects
        ROW_PADDING: 4 // Reduced padding
    },
    1.0: { // 100% - Default
        MONTH_WIDTH: 100,
        VISIBLE_MONTHS: 13,
        FONT_SIZE: '14px',
        LABEL_WIDTH: 320,
        BASE_BAR_HEIGHT: 10,
        TOUCH_TARGET_SIZE: 24,
        MILESTONE_FONT_SIZE: '10px', // Reduced from default
        PROJECT_SCALE: 1.0, // Normal project count
        ROW_PADDING: 6 // Compact but readable padding
    },
    1.25: { // 125% - Zoom In
        MONTH_WIDTH: 125,
        VISIBLE_MONTHS: 10,
        FONT_SIZE: '16px',
        LABEL_WIDTH: 400,
        BASE_BAR_HEIGHT: 14, // Larger bars for fewer projects
        TOUCH_TARGET_SIZE: 30,
        MILESTONE_FONT_SIZE: '12px',
        PROJECT_SCALE: 0.7, // Show fewer projects
        ROW_PADDING: 6 // Moderate padding for larger rows
    },
    1.5: { // 150% - Maximum Zoom In
        MONTH_WIDTH: 150,
        VISIBLE_MONTHS: 8,
        FONT_SIZE: '18px',
        LABEL_WIDTH: 480,
        BASE_BAR_HEIGHT: 18, // Much larger bars
        TOUCH_TARGET_SIZE: 36,
        MILESTONE_FONT_SIZE: '14px',
        PROJECT_SCALE: 0.5, // Show significantly fewer projects
        ROW_PADDING: 8 // Standard padding for largest rows
    }
};

// Responsive constants with zoom support
const getResponsiveConstants = (zoomLevel = 1.0) => {
    const screenWidth = window.innerWidth;
    const isMobile = screenWidth < 768;
    const isTablet = screenWidth >= 768 && screenWidth < 1024;

    // Get base zoom configuration
    const zoomConfig = ZOOM_LEVELS[zoomLevel] || ZOOM_LEVELS[1.0];

    // Apply mobile adjustments if needed (match PortfolioGanttChart)
    const mobileAdjustment = isMobile ? 0.8 : 1.0;

    return {
        MONTH_WIDTH: Math.round(zoomConfig.MONTH_WIDTH * mobileAdjustment),
        TOTAL_MONTHS: 73,
        LABEL_WIDTH: Math.round(zoomConfig.LABEL_WIDTH * mobileAdjustment),
        BASE_BAR_HEIGHT: Math.round(zoomConfig.BASE_BAR_HEIGHT * mobileAdjustment),
        VISIBLE_MONTHS: isMobile ? Math.max(6, Math.round(zoomConfig.VISIBLE_MONTHS * 0.6)) : zoomConfig.VISIBLE_MONTHS,
        TOUCH_TARGET_SIZE: Math.max(isMobile ? 44 : 16, Math.round(zoomConfig.TOUCH_TARGET_SIZE * mobileAdjustment)),
        FONT_SIZE: zoomConfig.FONT_SIZE,
        MILESTONE_FONT_SIZE: zoomConfig.MILESTONE_FONT_SIZE,
        PROJECT_SCALE: zoomConfig.PROJECT_SCALE,
        ROW_PADDING: Math.round(zoomConfig.ROW_PADDING * mobileAdjustment),
        ZOOM_LEVEL: zoomLevel
    };
};

// Milestone label spacing constants (match PortfolioGanttChart)
const LINE_HEIGHT = 12;
const LABEL_PADDING = 1; // Minimal padding for labels
const ABOVE_LABEL_OFFSET = 1; // Minimal space above bar - very close to marker
const BELOW_LABEL_OFFSET = 1; // Minimal space below bar - very close to marker

// Note: truncateLabel and milestone constants are now imported from dateUtils.js

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

const RegionRoadMap = () => {
    // ALL HOOKS MUST BE DECLARED AT THE TOP LEVEL
    const [filters, setFilters] = useState({
        region: 'All',
        market: 'All',
        function: 'All',
        tier: 'All'
    });

    const [filterOptions, setFilterOptions] = useState({
        regions: [],
        markets: [],
        functions: [],
        tiers: []
    });

    const [availableMarkets, setAvailableMarkets] = useState([]);
    const [zoomLevel, setZoomLevel] = useState(1.0);
    const [responsiveConstants, setResponsiveConstants] = useState(getResponsiveConstants(1.0));
    const [loading, setLoading] = useState(false); // Will use cached data
    const [error, setError] = useState(null);
    
    // Get cached data and state
    const { 
        regionData, 
        regionFilters,
        isLoading: cacheLoading, 
        preserveViewState, 
        getViewState 
    } = useGlobalDataCache();
    
    // Timeline view state with default to current14
    const [timelineView, setTimelineView] = useState('current14'); // Default to "14 Months Current Viewport"
    
    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [allData, setAllData] = useState([]); // Store all loaded data

    // Timeline range - must be defined early for useMemos to use it
    const { startDate, endDate } = getTimelineRangeForView(timelineView);
    const totalMonths = differenceInMonths(endDate, startDate);
    const monthWidth = Math.max(80, Math.min(150, 1200 / totalMonths)); // Dynamic width, min 80px, max 150px

    // PAGINATION FIX: Apply timeline filtering first, then pagination
    // Step 1: Apply timeline filtering to all data
    const timelineFilteredAllData = useMemo(() => {
        console.log('📊 Computing timelineFilteredAllData:', {
            allDataLength: allData?.length || 0,
            hasData: !!allData && allData.length > 0
        });
        
        if (!allData || allData.length === 0) return [];
        
        const filtered = allData.filter(project => {
            // Simple timeline filtering - can be made more sophisticated later
            if (!project.startDate && !project.endDate) return true; // Include projects without dates
            
            const projectStart = parseDate(project.startDate);
            const projectEnd = parseDate(project.endDate);
            
            // Include project if it overlaps with timeline range
            if (!projectStart || !projectEnd) return true;
            return projectEnd >= startDate && projectStart <= endDate;
        });
        
        console.log('✅ Timeline filtered result:', {
            inputLength: allData.length,
            outputLength: filtered.length,
            totalPages: Math.ceil(filtered.length / ITEMS_PER_PAGE)
        });
        
        return filtered;
    }, [allData, startDate, endDate]);
    
    // Step 2: Apply pagination to timeline-filtered data
    const processedData = useMemo(() => {
        console.log('🔍 PAGINATION DEBUG - Processing data:', {
            timelineFilteredLength: timelineFilteredAllData?.length || 0,
            currentPage,
            ITEMS_PER_PAGE,
            startIndex: (currentPage - 1) * ITEMS_PER_PAGE,
            endIndex: currentPage * ITEMS_PER_PAGE
        });
        const result = getPaginatedData(timelineFilteredAllData, currentPage, ITEMS_PER_PAGE);
        console.log('📊 PAGINATION RESULT:', {
            resultLength: result?.length || 0,
            expectedLength: Math.min(ITEMS_PER_PAGE, timelineFilteredAllData?.length || 0),
            actualData: result?.slice(0, 2)?.map(item => ({ name: item.name, id: item.id }))
        });
        return result;
    }, [timelineFilteredAllData, currentPage]);

    const timelineScrollRef = useRef(null);
    const ganttScrollRef = useRef(null);
    const leftPanelScrollRef = useRef(null);

    // Debug: Track renders and state changes
    console.log('🔄 REGIONROADMAP RENDER - Current state:', {
        loading,
        error: error ? error.substring(0, 50) + '...' : null,
        processedDataLength: processedData?.length || 0,
        allDataLength: allData?.length || 0,
        currentPage,
        totalItems
    });

    // Constrain total width to prevent horizontal overflow  
    const calculatedWidth = monthWidth * totalMonths;
    const maxAvailableWidth = typeof window !== 'undefined' ? window.innerWidth - responsiveConstants.LABEL_WIDTH - 50 : 1200;
    const totalWidth = Math.min(calculatedWidth, maxAvailableWidth);

    // Handle window resize for responsive behavior
    useEffect(() => {
        const handleResize = () => {
            setResponsiveConstants(getResponsiveConstants());
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // OLD API LOADING DISABLED - Using cached data only
    // useEffect(() => {
        // let isCancelled = false; // Prevent race conditions
        
        // const loadData = async () => {
            // console.log(`🚀 STARTING DATA LOAD - Page: ${currentPage}, Filters:`, {
            //     region: filters.region,
            //     market: filters.market,
            //     function: filters.function,
            //     tier: filters.tier
            // });
            
            // Prevent race conditions - if this effect is cancelled, don't proceed
            // if (isCancelled) {
            //     console.log('🚫 Load cancelled due to cleanup');
            //     return;
            // }
            
            // setLoading(true);
            // setError(null);
            
            // try {
                // const regionFilter = filters.region === 'All' ? null : filters.region;
                // const marketFilter = filters.market === 'All' ? null : filters.market;
                // const functionFilter = filters.function === 'All' ? null : filters.function;
                // const tierFilter = filters.tier === 'All' ? null : filters.tier;
                
                // console.log('🔍 About to call fetchRegionData with params:', {
                //     regionFilter,
                //     market: marketFilter,
                //     function: functionFilter,
                //     tier: tierFilter
                // });
                
                // // OLD API CALL REMOVED - Using cached data instead
                // console.log('⚠️ Old API loading disabled - using cached data');
                
                // Check again if cancelled after async operation
                // if (isCancelled) {
                //     console.log('🚫 Load cancelled after API call');
                //     return;
                // }
                
                // const newData = response?.data?.data || [];
                // console.log(`✅ DATA LOADED - Got ${newData.length} items for page ${currentPage}`, newData);
                
                // // Set all data for client-side pagination
                console.log('� Setting all region data - DISABLED - COMMENTED OUT');
                // setAllData(newData);
                
                // setTotalItems(newData.length);
                
                // PAGINATION FIX: Commented out - this was resetting page to 1 every render!
                // Reset to page 1 when filters change
                // if (currentPage !== 1) {
                //     setCurrentPage(1);
                // }
                
                // console.log('State updates complete');
                
                // CRITICAL DEBUG: Let's also try setting some test data to see if the issue is with state setting
                // if (newData.length === 0) {
                    // console.log('⚠️ NO DATA RECEIVED - Setting test data to check if state setting works');
                    // const testData = [
                    //     {
                    //         id: 'TEST001',
                    //         name: 'Test Project 1',
                    //         startDate: '2024-01-01',
                    //         endDate: '2024-12-31',
                    //         phases: [],
                    //         milestones: []
                    //     }
                    // ];
                    // // Note: Don't use setProcessedData, let the pagination compute it from allData
                    // console.log('Test data would be set, but letting pagination handle it from allData');
                // }
                
                // // Debug: Force a small timeout to let state update, then check
                // setTimeout(() => {
                //     console.log('🔍 POST-UPDATE CHECK: processedData length should now be:', newData.length || 1);
                // }, 100);

            // } catch (err) {
                // // if (!isCancelled) {
                // //     console.error('❌ FAILED TO LOAD DATA:', err);
                // //     console.error('❌ Error stack:', err.stack);
                // //     setError(`Failed to load data: ${err.message}`);
                // // }
            // } finally {
                // // if (!isCancelled) {
                // //     console.log(`🏁 DATA LOAD COMPLETE - Setting loading to false`);
                // //     setLoading(false);
                // // }
            // }
        // };

        // loadData();

        // // Cleanup function to prevent race conditions
        // return () => {
        //     console.log('🧹 Cleaning up data loading effect');
        //     isCancelled = true;
        // };

    // }, [filters.region, filters.market, filters.function, filters.tier, currentPage]); // Use individual filter properties - DISABLED

    // Use cached data instead of API calls
    useEffect(() => {
        if (regionData && regionData.data && regionData.data.data) {
            console.log('✅ Using cached region data:', regionData);
            
            // Apply client-side filtering - access the actual array at regionData.data.data
            let filteredData = regionData.data.data;
            
            // Ensure filteredData is an array before filtering
            if (!Array.isArray(filteredData)) {
                console.error('❌ Region data is not an array:', filteredData);
                setError('Invalid region data format');
                setLoading(false);
                return;
            }
            
            if (filters.region !== 'All') {
                filteredData = filteredData.filter(item => 
                    item.region === filters.region
                );
            }
            if (filters.market !== 'All') {
                filteredData = filteredData.filter(item => 
                    item.market === filters.market
                );
            }
            if (filters.function !== 'All') {
                filteredData = filteredData.filter(item => 
                    item.function === filters.function
                );
            }
            if (filters.tier !== 'All') {
                filteredData = filteredData.filter(item => 
                    item.tier === filters.tier
                );
            }
            
            console.log(`✅ Region data filtered: ${filteredData.length} items from cache`);
            setAllData(filteredData);
            setTotalItems(filteredData.length); // This will be overridden by timeline filtering, but kept for compatibility
            // PAGINATION FIX: Don't reset currentPage here - let it be handled by filter change events only
            setLoading(false);
            setError(null);
        } else if (!cacheLoading && (!regionData || !regionData.data || !regionData.data.data)) {
            setError('No region data available or invalid data structure');
            setLoading(false);
        }
    }, [regionData, cacheLoading, filters]);
    
    // Load cached filter options
    useEffect(() => {
        if (regionFilters) {
            console.log('✅ Using cached region filters:', regionFilters);
            setFilterOptions(regionFilters);
            setAvailableMarkets(regionFilters.markets || []);
        }
    }, [regionFilters]);

    // Handle initial scroll position after data loads and month width is calculated
    useEffect(() => {
        if (!loading && timelineScrollRef.current && monthWidth) {
            // Use utility function to calculate proper scroll position to show current month - 1
            const scrollPosition = getInitialScrollPosition(monthWidth);
            timelineScrollRef.current.scrollLeft = scrollPosition;
            // Sync gantt scroll position
            if (ganttScrollRef.current) {
                ganttScrollRef.current.scrollLeft = scrollPosition;
            }
        }
    }, [loading, monthWidth]);

    // Simple market update when region filter changes
    useEffect(() => {
        if (filterOptions.markets?.length > 0) {
            if (filters.region === 'All') {
                setAvailableMarkets(filterOptions.markets);
            } else {
                // For simplicity, show all markets when a specific region is selected
                // The backend filtering will handle the actual filtering
                setAvailableMarkets(filterOptions.markets);
            }
        }
    }, [filters.region, filterOptions.markets]);

    // Handle page changes for client-side pagination - SIMPLIFIED
    const handlePageChangeCallback = useCallback((newPage) => {
        console.log('🔄 PAGINATION: handlePageChangeCallback called with newPage:', newPage);
        console.log('📊 PAGINATION: Current state before change:', {
            currentPage,
            newPage,
            allDataLength: allData?.length || 0,
            timelineFilteredAllDataLength: timelineFilteredAllData?.length || 0
        });
        
        // Direct state update without validation to test if it works
        setCurrentPage(newPage);
        console.log('✅ PAGINATION: setCurrentPage called with:', newPage);
    }, []); // Empty dependencies to ensure stable reference

    // Update responsive constants when zoom level changes
    useEffect(() => {
        setResponsiveConstants(getResponsiveConstants(zoomLevel));
    }, [zoomLevel]);

    // Use the new viewport-based filtering logic
    const isProjectWithinViewport = useCallback((project) => {
        return isProjectInTimelineViewport(project, startDate, endDate);
    }, [startDate, endDate]);

    // PAGINATION FIX: processedData is already timeline-filtered and paginated
    const timelineFilteredData = useMemo(() => {
        console.log(`🔍 TIMELINE FILTERING DEBUG (${timelineView}):`);
        console.log(`📊 Total processedData records: ${processedData.length}`);
        console.log(`📊 Current page: ${currentPage}`);
        console.log(`📅 Timeline Range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
        
        // Log first few projects for debugging
        if (processedData.length > 0) {
            console.log(`📋 Sample projects from page ${currentPage}:`, processedData.slice(0, 3).map(p => ({
                name: p.name,
                startDate: p.startDate,
                endDate: p.endDate,
                hasPhases: !!p.phases,
                phaseCount: p.phases?.length || 0
            })));
        }
        
        // processedData is already filtered and paginated, just return it
        console.log(`✅ Timeline Filtering Result: ${processedData.length} projects from page ${currentPage}`);
        
        return processedData;
    }, [processedData, timelineView, currentPage]);

    // ALL CONDITIONAL LOGIC AND EARLY RETURNS MUST COME AFTER ALL HOOKS

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

    // Update responsive constants when zoom level changes
    useEffect(() => {
        setResponsiveConstants(getResponsiveConstants(zoomLevel));
    }, [zoomLevel]);

    // Phase colors mapping
    const phaseColors = {
        'Initiate': '#c1e5f5',
        'Evaluate': '#f6c6ad',
        'Develop': '#84e291',
        'Deploy': '#e59edd',
        'Sustain': '#156082',
        'Close': '#006400'
    };

    // PHASE_COLORS for Gantt bars (matching SubProgram page)
    const PHASE_COLORS = {
        'Initiate': '#1f77b4',    // Blue
        'Evaluate': '#2ca02c',    // Green (maps to Define)
        'Develop': '#9467bd',     // Purple (maps to Design)
        'Deploy': '#ff7f0e',      // Orange (maps to Build)
        'Sustain': '#d62728',     // Red (maps to Qualify)
        'Close': '#17becf',       // Cyan (more visible than dark grey)
        // Keep the original names for backward compatibility
        'Define': '#2ca02c',      // Green
        'Design': '#9467bd',      // Purple
        'Build': '#ff7f0e',       // Orange
        'Qualify': '#d62728',     // Red
        'Build - Scale': '#6366F1', // Keep existing for legacy support
        'Implementation': '#8B5CF6', // Keep existing for legacy support
        'Planning': '#06B6D4',      // Keep existing for legacy support
        'Testing': '#EF4444',       // Keep existing for legacy support
        'Unphased': '#c0c0c0',    // Light Grey (matching SubProgram)
        'Project': '#9CA3AF'     // Gray for single project bars
    };

    // Function to handle filter changes that resets the page to 1
    const handleFilterChange = useCallback((filterType, value) => {
        setFilters(prev => ({
            ...prev,
            [filterType]: value,
            // If the region changes, reset the market filter
            ...(filterType === 'region' && { market: 'All' })
        }));
        // CRITICAL: Reset to page 1 to start a new filtered search
        setCurrentPage(1);
    }, []); // No dependencies needed since we're only using setters

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

    // Apply project scaling based on zoom level
    const getScaledFilteredData = () => {
        const projectScale = responsiveConstants.PROJECT_SCALE;
        if (projectScale >= 1.0) {
            return timelineFilteredData;
        } else {
            const targetCount = Math.max(1, Math.round(timelineFilteredData.length * projectScale));
            return timelineFilteredData.slice(0, targetCount);
        }
    };

    // Calculate height needed for milestone labels to prevent overlap with bars
    const calculateMilestoneLabelHeight = (milestones, monthWidth) => {
        try {
            if (!milestones || milestones.length === 0 || !monthWidth) {
                return { total: 0, above: 0, below: 0 };
            }

            const monthlyGroups = groupMilestonesByMonth(milestones);
            let maxAboveHeight = 0;
            let maxBelowHeight = 0;

            Object.entries(monthlyGroups).forEach(([monthKey, monthMilestones]) => {
                const labelPosition = getMonthlyLabelPosition(monthKey);
                const stackedLabels = createVerticalMilestoneLabels(
                    monthMilestones, 
                    monthWidth * 8,
                    '14px',
                    milestones,
                    monthWidth
                );

                // Add null check and ensure stackedLabels is a string
                if (stackedLabels && typeof stackedLabels === 'string') {
                    const labelHeight = stackedLabels.split('\n').length * LINE_HEIGHT + LABEL_PADDING;

                    if (labelPosition === 'above') {
                        maxAboveHeight = Math.max(maxAboveHeight, labelHeight + ABOVE_LABEL_OFFSET);
                    } else {
                        maxBelowHeight = Math.max(maxBelowHeight, labelHeight + BELOW_LABEL_OFFSET);
                    }
                } else {
                    // Fallback if stackedLabels is not a string
                    const fallbackHeight = 20; // Default height for one line
                    if (labelPosition === 'above') {
                        maxAboveHeight = Math.max(maxAboveHeight, fallbackHeight + ABOVE_LABEL_OFFSET);
                    } else {
                        maxBelowHeight = Math.max(maxBelowHeight, fallbackHeight + BELOW_LABEL_OFFSET);
                    }
                }
            });

            return {
                total: maxAboveHeight + maxBelowHeight,
                above: maxAboveHeight,
                below: maxBelowHeight
            };
        } catch (error) {
            console.warn('Error calculating milestone label height:', error);
            return { total: 60, above: 30, below: 30 };
        }
    };

    // Helper function to estimate text height for wrapped text
    const estimateTextHeight = (text, fontSize, containerWidth) => {
        if (!text) return fontSize;
        
        const averageCharWidth = fontSize * 0.6;
        const availableWidth = containerWidth - 16;
        const charsPerLine = Math.floor(availableWidth / averageCharWidth);
        
        if (charsPerLine <= 0) return fontSize;
        
        const lines = Math.ceil(text.length / charsPerLine);
        return lines * (fontSize * 1.2);
    };

    const calculateRowHeight = (projectName = '', milestones = [], projectStartDate = null, projectEndDate = null, startDate = null, endDate = null) => {
        // STEP 1: Calculate actual Gantt bar height (fixed)
        const ganttBarHeight = 12; // Fixed height for the actual bar
        
        // STEP 2: Calculate milestone label space needed (detailed breakdown)
        const safeMonthWidth = monthWidth || 100; // Fallback to 100 if monthWidth is undefined
        const milestoneHeights = calculateMilestoneLabelHeight(milestones, safeMonthWidth);
        
        // STEP 3: Calculate project name space (minimal, just enough to display)
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

    return (
        <div className="w-full flex flex-col relative">
            {/* Status Badge - Top Right (matches ProgramGanttChart) */}
            {loading && (
                <div className="absolute top-4 right-4 z-50 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium shadow-md flex items-center gap-2">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                    Loading data...
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded m-4">
                    <h3 className="font-semibold">Error Loading Region Data</h3>
                    <p>{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 mt-2"
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* Main Content - Show when data is available or when not loading */}
            {(processedData.length > 0 || !loading) && !error && (
                <div className="region-roadmap">
                    {/* Compact Header */}
                    <div className="flex-shrink-0 px-3 py-2 bg-gray-50 border-b border-gray-200">
                        <div className="flex items-center justify-between gap-3">
                            {/* Left: Compact Filters */}
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-lg font-semibold text-gray-800">Region Roadmap</h1>
                                <select
                                    value={filters.region}
                                    onChange={(e) => handleFilterChange('region', e.target.value)}
                                    className="border border-gray-300 rounded px-2 py-1 bg-white text-sm min-w-0 max-w-[120px]"
                                >
                                    <option value="All">All Regions</option>
                                    {filterOptions.regions.map(region => (
                                        <option key={region} value={region}>{region}</option>
                                    ))}
                                </select>
                                <select
                                    value={filters.market}
                                    onChange={(e) => handleFilterChange('market', e.target.value)}
                                    className="border border-gray-300 rounded px-2 py-1 bg-white text-sm min-w-0 max-w-[120px]"
                                >
                                    <option value="All">All Markets</option>
                                    {availableMarkets.map(market => (
                                        <option key={market} value={market}>{market}</option>
                                    ))}
                                </select>
                                <select
                                    value={filters.function}
                                    onChange={(e) => handleFilterChange('function', e.target.value)}
                                    className="border border-gray-300 rounded px-2 py-1 bg-white text-sm min-w-0 max-w-[120px]"
                                >
                                    <option value="All">All Functions</option>
                                    {filterOptions.functions.map(func => (
                                        <option key={func} value={func}>{func}</option>
                                    ))}
                                </select>
                                <select
                                    value={filters.tier}
                                    onChange={(e) => handleFilterChange('tier', e.target.value)}
                                    className="border border-gray-300 rounded px-2 py-1 bg-white text-sm min-w-0 max-w-[100px]"
                                >
                                    <option value="All">All Tiers</option>
                                    {filterOptions.tiers.map(tier => (
                                        <option key={tier} value={tier}>Tier {tier}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Center: Pagination Controls */}
                            <div className="flex-1 flex justify-center">
                                <PaginationControls
                                    currentPage={currentPage}
                                    totalItems={timelineFilteredAllData?.length || 0}
                                    itemsPerPage={ITEMS_PER_PAGE}
                                    onPageChange={(page) => {
                                        console.log('🚀 Direct onPageChange called with page:', page);
                                        handlePageChangeCallback(page);
                                    }}
                                    compact={true}
                                />
                            </div>
                        </div>
                    </div>



                    {/* Gantt Chart */}
                    {timelineFilteredData.length === 0 ? (
                        <div className="flex-1 flex flex-col">
                            {/* Show Timeline Axis even when no data */}
                            <div className="sticky top-0 z-20 bg-white border-b border-gray-200">
                                <div className="relative flex w-full">
                                    {/* Sticky Project Names Header */}
                                    <div
                                        className="flex-shrink-0 bg-white border-r border-gray-200"
                                        style={{
                                            width: responsiveConstants.LABEL_WIDTH,
                                            position: 'sticky',
                                            left: 0,
                                            zIndex: 30,
                                        }}
                                    >
                                        <div
                                            className="flex items-center justify-between px-2 font-semibold text-gray-700"
                                            style={{
                                                height: responsiveConstants.TOUCH_TARGET_SIZE,
                                                fontSize: responsiveConstants.FONT_SIZE
                                            }}
                                        >
                                            <span className="truncate">Region Projects</span>
                                            {/* Zoom Controls */}
                                            <div className="flex items-center space-x-1 ml-2">
                                                <button
                                                    onClick={handleZoomOut}
                                                    disabled={zoomLevel <= 0.5}
                                                    className="w-8 h-6 flex items-center justify-center bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-300 rounded text-xs font-bold transition-colors"
                                                    title="Zoom Out"
                                                >
                                                    −
                                                </button>
                                                <span className="text-xs text-gray-600 text-center font-medium min-w-[35px]">
                                                    {Math.round(zoomLevel * 100)}%
                                                </span>
                                                <button
                                                    onClick={handleZoomIn}
                                                    disabled={zoomLevel >= 1.5}
                                                    className="w-8 h-6 flex items-center justify-center bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-300 rounded text-xs font-bold transition-colors"
                                                    title="Zoom In"
                                                >
                                                    +
                                                </button>
                                                <button
                                                    onClick={handleZoomReset}
                                                    className="text-xs px-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                                                    title="Reset to 100%"
                                                >
                                                    ↺
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Timeline Axis */}
                                    <div
                                        ref={timelineScrollRef}
                                        className="flex-1 overflow-x-auto"
                                        style={{
                                            width: `${responsiveConstants.MONTH_WIDTH * responsiveConstants.VISIBLE_MONTHS}px`,
                                            maxWidth: `calc(100vw - ${responsiveConstants.LABEL_WIDTH}px)`
                                        }}
                                        onScroll={handleTimelineScroll}
                                    >
                                        {monthWidth && (
                                            <TimelineAxis
                                                startDate={startDate}
                                                endDate={endDate}
                                                monthWidth={monthWidth}
                                                fontSize={responsiveConstants.FONT_SIZE}
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            {/* No Data Message */}
                            <div className="text-center py-8 text-gray-500">
                                <div className="mb-2">No projects match the current filters or fall within the timeline range</div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col">
                            {/* Fixed Header Area - Timeline Axis */}
                            <div className="sticky top-0 z-20 bg-white border-b border-gray-200">
                                <div className="relative flex w-full">
                                    {/* Sticky Project Names Header */}
                                    <div
                                        className="flex-shrink-0 bg-white border-r border-gray-200"
                                        style={{
                                            width: responsiveConstants.LABEL_WIDTH,
                                            position: 'sticky',
                                            left: 0,
                                            zIndex: 30,
                                        }}
                                    >
                                        <div
                                            className="flex items-center justify-between px-2 font-semibold text-gray-700"
                                            style={{
                                                height: responsiveConstants.TOUCH_TARGET_SIZE,
                                                fontSize: responsiveConstants.FONT_SIZE
                                            }}
                                        >
                                            <span className="truncate">Region Projects</span>
                                            {/* Zoom Controls */}
                                            <div className="flex items-center space-x-1 ml-2">
                                                <button
                                                    onClick={handleZoomOut}
                                                    disabled={zoomLevel <= 0.5}
                                                    className="w-8 h-6 flex items-center justify-center bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-300 rounded text-xs font-bold transition-colors"
                                                    title="Zoom Out"
                                                >
                                                    −
                                                </button>
                                                <span className="text-xs text-gray-600 text-center font-medium min-w-[35px]">
                                                    {Math.round(zoomLevel * 100)}%
                                                </span>
                                                <button
                                                    onClick={handleZoomIn}
                                                    disabled={zoomLevel >= 1.5}
                                                    className="w-8 h-6 flex items-center justify-center bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-300 rounded text-xs font-bold transition-colors"
                                                    title="Zoom In"
                                                >
                                                    +
                                                </button>
                                                <button
                                                    onClick={handleZoomReset}
                                                    className="text-xs px-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                                                    title="Reset to 100%"
                                                >
                                                    ↺
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Timeline Axis and Controls */}
                                    <div
                                        ref={timelineScrollRef}
                                        className="flex-1 overflow-x-auto"
                                        style={{
                                            width: `${responsiveConstants.MONTH_WIDTH * responsiveConstants.VISIBLE_MONTHS}px`,
                                            maxWidth: `calc(100vw - ${responsiveConstants.LABEL_WIDTH}px)`
                                        }}
                                        onScroll={handleTimelineScroll}
                                    >
                                        {/* Timeline Controls Row */}
                                        <div className="flex items-center justify-between px-2 py-1 bg-gray-50 border-b">
                                            <div className="flex items-center space-x-3">
                                                <TimelineViewDropdown 
                                                    selectedView={timelineView}
                                                    onViewChange={setTimelineView}
                                                />
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <span className="text-xs font-medium text-gray-700">Phases:</span>
                                                <div className="flex space-x-2">
                                                    {['Initiate', 'Evaluate', 'Develop', 'Deploy', 'Sustain', 'Close'].map((phase) => (
                                                        <div key={phase} className="flex items-center space-x-1">
                                                            <div 
                                                                className="w-2 h-2 rounded" 
                                                                style={{ backgroundColor: PHASE_COLORS[phase] || PHASE_COLORS['Unphased'] }}
                                                            ></div>
                                                            <span className="text-xs text-gray-600">{phase}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                
                                                <span className="text-xs font-medium text-gray-600 ml-3">Legend:</span>
                                                <div className="flex gap-2">
                                                    {/* Complete Milestone */}
                                                    <div className="flex items-center gap-1">
                                                        <svg width="10" height="10" viewBox="0 0 16 16">
                                                            <path
                                                                d="M8 2 L14 8 L8 14 L2 8 Z"
                                                                fill="white"
                                                                stroke="#3B82F6"
                                                                strokeWidth="2"
                                                            />
                                                        </svg>
                                                        <span className="text-xs text-gray-500">Complete</span>
                                                    </div>

                                                    {/* Incomplete Milestone */}
                                                    <div className="flex items-center gap-1">
                                                        <svg width="10" height="10" viewBox="0 0 16 16">
                                                            <path
                                                                d="M8 2 L14 8 L8 14 L2 8 Z"
                                                                fill="#3B82F6"
                                                                stroke="#3B82F6"
                                                                strokeWidth="2"
                                                            />
                                                        </svg>
                                                        <span className="text-xs text-gray-500">Incomplete</span>
                                                    </div>

                                                    {/* Multiple Milestones */}
                                                    <div className="flex items-center gap-1">
                                                        <svg width="10" height="10" viewBox="0 0 16 16">
                                                            <path
                                                                d="M8 2 L14 8 L8 14 L2 8 Z"
                                                                fill="#1F2937"
                                                                stroke="white"
                                                                strokeWidth="2"
                                                            />
                                                        </svg>
                                                        <span className="text-xs text-gray-500">Multiple</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {monthWidth && (
                                            <TimelineAxis
                                                startDate={startDate}
                                                endDate={endDate}
                                                monthWidth={monthWidth}
                                                fontSize={responsiveConstants.FONT_SIZE}
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Scrollable Content Area */}
                            <div className="relative flex w-full">
                                {/* Sticky Project Names - Synchronized Scrolling */}
                                <div
                                    ref={leftPanelScrollRef}
                                    className="flex-shrink-0 bg-white border-r border-gray-200 overflow-y-auto"
                                    style={{
                                        minWidth: responsiveConstants.LABEL_WIDTH,
                                        width: 'auto',
                                        position: 'sticky',
                                        left: 0,
                                        zIndex: 10,
                                        height: '100%',
                                    }}
                                    onScroll={handleLeftPanelScroll}
                                >
                                    <div style={{ position: 'relative', height: getScaledFilteredData().reduce((total, project) => {
                                        const projectStartDate = parseDate(project.startDate, `${project.name} - Project Start`);
                                        const projectEndDate = parseDate(project.endDate, `${project.name} - Project End`);
                                        const projectRowHeight = calculateRowHeight(project.name, project.milestones, projectStartDate, projectEndDate, startDate, endDate);
                                        return total + projectRowHeight + Math.round(1 * (responsiveConstants.ZOOM_LEVEL || 1.0)); // Ultra-minimal spacing
                                    }, Math.round(8 * (responsiveConstants.ZOOM_LEVEL || 1.0))) }}>
                                        {getScaledFilteredData().map((project, index) => {
                                            const projectStartDate = parseDate(project.startDate, `${project.name} - Project Start`);
                                            const projectEndDate = parseDate(project.endDate, `${project.name} - Project End`);
                                            
                                            // Debug specific project that has the issue
                                            if (project.name && project.name.includes('1C ERP Rollouts BCCA')) {
                                                console.log(`🎯 DETAILED DEBUG for ${project.name}:`, {
                                                    startDate: project.startDate,
                                                    endDate: project.endDate,
                                                    parsedStartDate: projectStartDate?.toISOString().split('T')[0],
                                                    parsedEndDate: projectEndDate?.toISOString().split('T')[0],
                                                    isUnphased: project.isUnphased
                                                });
                                            }
                                            const projectRowHeight = calculateRowHeight(project.name, project.milestones, projectStartDate, projectEndDate, startDate, endDate);
                                            const ultraMinimalSpacing = Math.round(1 * (responsiveConstants.ZOOM_LEVEL || 1.0)); // Ultra-minimal spacing
                                            const topMargin = Math.round(8 * (responsiveConstants.ZOOM_LEVEL || 1.0)); // Absolute minimum top margin - just enough to prevent clipping
                                            const yOffset = getScaledFilteredData().slice(0, index).reduce((total, p) => {
                                                const pStartDate = parseDate(p.startDate, `${p.name} - Project Start`);
                                                const pEndDate = parseDate(p.endDate, `${p.name} - Project End`);
                                                const pRowHeight = calculateRowHeight(p.name, p.milestones, pStartDate, pEndDate, startDate, endDate);
                                                return total + pRowHeight + ultraMinimalSpacing;
                                            }, topMargin);
                                            return (
                                                <div
                                                    key={project.id}
                                                    className="absolute flex items-start border-b border-gray-100 bg-white hover:bg-gray-50 transition-colors"
                                                    style={{
                                                        top: yOffset,
                                                        height: projectRowHeight,
                                                        paddingTop: '6px', // Add top padding
                                                        paddingBottom: '6px', // Add bottom padding
                                                        paddingLeft: responsiveConstants.TOUCH_TARGET_SIZE > 24 ? '12px' : '8px',
                                                        fontSize: responsiveConstants.FONT_SIZE,
                                                        width: '100%',
                                                        cursor: 'default',
                                                        minHeight: responsiveConstants.TOUCH_TARGET_SIZE,
                                                        fontWeight: 'normal',
                                                    }}
                                                >
                                                    <div className="flex items-center justify-between w-full h-full">
                                                        <div className="flex flex-col justify-center flex-1 py-1.5">
                                                            <span 
                                                                className="font-medium text-gray-700 pr-2 leading-tight" 
                                                                title={project.name}
                                                                style={{
                                                                    wordBreak: 'break-word',
                                                                    overflowWrap: 'break-word',
                                                                    lineHeight: '1.2',
                                                                    maxWidth: `${responsiveConstants.LABEL_WIDTH - 24}px`
                                                                }}
                                                            >
                                                                {project.name}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Right Panel - Timeline Content */}
                                <div
                                    ref={ganttScrollRef}
                                    className="flex-1 overflow-x-auto"
                                    style={{
                                        width: `${responsiveConstants.MONTH_WIDTH * responsiveConstants.VISIBLE_MONTHS}px`,
                                        maxWidth: `calc(100vw - ${responsiveConstants.LABEL_WIDTH}px)`
                                    }}
                                    onScroll={handleGanttScroll}
                                >
                                    <div className="relative" style={{ width: totalWidth }}>
                                        <svg
                                            width={totalWidth}
                                            height={getScaledFilteredData().reduce((total, project) => {
                                                const projectStartDate = parseDate(project.startDate, `${project.name} - Project Start`);
                                                const projectEndDate = parseDate(project.endDate, `${project.name} - Project End`);
                                                const projectRowHeight = calculateRowHeight(project.name, project.milestones, projectStartDate, projectEndDate, startDate, endDate);
                                                return total + projectRowHeight + Math.round(1 * (responsiveConstants.ZOOM_LEVEL || 1.0)); // Ultra-minimal spacing
                                            }, Math.round(8 * (responsiveConstants.ZOOM_LEVEL || 1.0)))}
                                            style={{ height: getScaledFilteredData().reduce((total, project) => {
                                                const projectStartDate = parseDate(project.startDate, `${project.name} - Project Start`);
                                                const projectEndDate = parseDate(project.endDate, `${project.name} - Project End`);
                                                const projectRowHeight = calculateRowHeight(project.name, project.milestones, projectStartDate, projectEndDate, startDate, endDate);
                                                return total + projectRowHeight + Math.round(1 * (responsiveConstants.ZOOM_LEVEL || 1.0)); // Ultra-minimal spacing
                                            }, Math.round(8 * (responsiveConstants.ZOOM_LEVEL || 1.0))) }}
                                        >
                                            {/* iv. Simple line-based swimlanes for RegionGanttChart */}
                                            {/* Vertical month separator lines - responsive to zoom */}
                                            {Array.from({ length: Math.ceil(totalWidth / responsiveConstants.MONTH_WIDTH) }, (_, i) => (
                                                <line
                                                    key={`month-line-${i}`}
                                                    x1={i * responsiveConstants.MONTH_WIDTH}
                                                    y1="0"
                                                    x2={i * responsiveConstants.MONTH_WIDTH}
                                                    y2={getScaledFilteredData().reduce((total, project) => {
                                                        const projectStartDate = parseDate(project.startDate, `${project.name} - Project Start`);
                                                        const projectEndDate = parseDate(project.endDate, `${project.name} - Project End`);
                                                        const projectRowHeight = calculateRowHeight(project.name, project.milestones, projectStartDate, projectEndDate, startDate, endDate);
                                                        return total + projectRowHeight + Math.round(1 * (responsiveConstants.ZOOM_LEVEL || 1.0)); // Ultra-minimal spacing
                                                    }, Math.round(8 * (responsiveConstants.ZOOM_LEVEL || 1.0)))}
                                                    stroke="rgba(0,0,0,0.1)"
                                                    strokeWidth="1"
                                                />
                                            ))}
                                            {getScaledFilteredData().map((project, index) => {
                                                // Parse project dates first for accurate row height calculation
                                                const projectStartDate = parseDate(project.startDate, `${project.name} - Project Start`);
                                                const projectEndDate = parseDate(project.endDate, `${project.name} - Project End`);
                                                
                                                const projectRowHeight = calculateRowHeight(project.name, project.milestones, projectStartDate, projectEndDate, startDate, endDate);
                                                const ultraMinimalSpacing = Math.round(1 * (responsiveConstants.ZOOM_LEVEL || 1.0)); // Ultra-minimal spacing
                                                const topMargin = Math.round(8 * (responsiveConstants.ZOOM_LEVEL || 1.0)); // Absolute minimum top margin - just enough to prevent clipping
                                                
                                                // Calculate row Y position with ultra-minimal spacing
                                                const yOffset = getScaledFilteredData().slice(0, index).reduce((total, p) => {
                                                    const pStartDate = parseDate(p.startDate, `${p.name} - Project Start`);
                                                    const pEndDate = parseDate(p.endDate, `${p.name} - Project End`);
                                                    const pRowHeight = calculateRowHeight(p.name, p.milestones, pStartDate, pEndDate, startDate, endDate);
                                                    return total + pRowHeight + ultraMinimalSpacing; // Ultra-minimal spacing between rows
                                                }, topMargin);

                                                // Process milestones after we have projectEndDate
                                                const milestones = processMilestonesWithPosition(project.milestones || [], startDate, responsiveConstants.MONTH_WIDTH, projectEndDate);
                                                
                                                // Get detailed milestone height breakdown for proper positioning
                                                const milestoneHeights = calculateMilestoneLabelHeight(project.milestones || [], responsiveConstants.MONTH_WIDTH);
                                                
                                                // Check if this project has a valid bar (both start and end dates within timeline)
                                                const hasValidBar = projectStartDate && projectEndDate && 
                                                                  !(projectStartDate > endDate || projectEndDate < startDate);
                                                
                                                // FIXED: True top-anchoring without any centering inconsistencies
                                                // Bar positioning: immediately after milestone labels above (no centering)
                                                const ganttBarY = yOffset + milestoneHeights.above;
                                                
                                                // CORRECTED LOGIC: Simplified milestone positioning matching PortfolioGanttChart
                                                // Always center milestones on the Gantt bar, regardless of hasValidBar
                                                const milestoneY = ganttBarY + 6; // Always center milestone on the 12px bar
                                                
                                                // DEBUG LOGGING for positioning
                                                console.log(`🎯 POSITIONING DEBUG for "${project.name.substring(0, 20)}..."`);
                                                console.log(`  📊 yOffset: ${yOffset}`);
                                                console.log(`  📏 milestoneHeights:`, milestoneHeights);
                                                console.log(`  🎯 hasValidBar: ${hasValidBar}`);
                                                console.log(`  📐 ganttBarY: ${ganttBarY}`);
                                                console.log(`  🔴 milestoneY: ${milestoneY}`);
                                                console.log(`  🔵 projectRowHeight: ${projectRowHeight}`);
                                                console.log(`  ---`);

                                                return (
                                                    <g key={`project-${project.id}`} className="project-group">
                                                        {/* Project bars - PHASE-AWARE rendering similar to SubProgram page */}
                                                        {(() => {
                                                            if (!projectStartDate || !projectEndDate) return null;

                                                            // Skip projects that don't overlap with timeline range
                                                            if (projectStartDate > endDate || projectEndDate < startDate) {
                                                                return null;
                                                            }

                                                            // Check if project has phases - using Region data structure
                                                            const hasValidPhases = project.phases && project.phases.length > 0;
                                                            
                                                            // DEBUG: Log phase data structure
                                                            console.log(`🎨 PHASE DEBUG for "${project.name}":`, {
                                                                hasPhases: !!project.phases,
                                                                phasesLength: project.phases?.length || 0,
                                                                phases: project.phases,
                                                                isUnphased: project.isUnphased
                                                            });
                                                            
                                                            const validPhases = hasValidPhases ? project.phases.filter(phase => 
                                                                phase && 
                                                                phase.name && 
                                                                phase.startDate && 
                                                                phase.endDate && 
                                                                phase.startDate.trim() !== '' && 
                                                                phase.endDate.trim() !== ''
                                                            ) : [];
                                                            
                                                            // Check if phases are real phases (not just "Unphased" or "Project")
                                                            const hasRealPhases = validPhases.length > 0 && !validPhases.every(phase => 
                                                                phase.name === 'Unphased' || phase.name === 'Project'
                                                            );

                                                            // DEBUG: More detailed phase validation logging
                                                            if (validPhases.length > 0) {
                                                                console.log(`🎨 PHASE VALIDATION for "${project.name}":`, {
                                                                    validPhasesCount: validPhases.length,
                                                                    hasRealPhases: hasRealPhases,
                                                                    phaseNames: validPhases.map(p => p.name),
                                                                    phaseDetails: validPhases.map(p => ({ name: p.name, start: p.startDate, end: p.endDate })),
                                                                    isUnphased: project.isUnphased
                                                                });
                                                            }
                                                            
                                                            if (hasRealPhases) {
                                                                console.log(`✅ RENDERING PHASES for ${project.name}`);
                                                                // Render individual phase bars - copied from SubProgram logic
                                                                return validPhases.map((phase, phaseIndex) => {
                                                                    const phaseStartDate = parseDate(phase.startDate);
                                                                    const phaseEndDate = parseDate(phase.endDate);
                                                                    
                                                                    if (!phaseStartDate || !phaseEndDate) return null;
                                                                    
                                                                    const x = calculatePosition(phaseStartDate, startDate, responsiveConstants.MONTH_WIDTH);
                                                                    const width = calculatePosition(phaseEndDate, startDate, responsiveConstants.MONTH_WIDTH) - x;
                                                                    
                                                                    if (width <= 0) return null;
                                                                    
                                                                    // Get the phase color
                                                                    const phaseColor = PHASE_COLORS[phase.name] || PHASE_COLORS['Unphased'];
                                                                    
                                                                    console.log(`🎨 Phase rendering: ${phase.name}, color: ${phaseColor}, x: ${x}, width: ${width}`);
                                                                    
                                                                    return (
                                                                        <GanttBar
                                                                            key={`${project.id}-${phase.name}-${phaseIndex}`}
                                                                            data={{
                                                                                ...phase,
                                                                                id: `${project.id}-${phase.name}`,
                                                                                name: `${project.name} - ${phase.name}`
                                                                            }}
                                                                            startX={x}
                                                                            y={ganttBarY}
                                                                            width={width}
                                                                            label={phase.name}
                                                                            status={project.status}
                                                                            color={phaseColor}
                                                                            touchTargetSize={responsiveConstants.TOUCH_TARGET_SIZE}
                                                                            fontSize={responsiveConstants.FONT_SIZE}
                                                                            isMobile={false}
                                                                            zoomLevel={zoomLevel}
                                                                        />
                                                                    );
                                                                });
                                                            } else {
                                                                console.log(`📊 RENDERING SINGLE BAR for ${project.name} (no valid phases)`);
                                                                // Debug dates for problematic projects
                                                                if (project.name && project.name.includes('1C ERP Rollouts BCCA')) {
                                                                    console.log(`🔍 DATE DEBUG for ${project.name}:`, {
                                                                        rawStart: project.startDate,
                                                                        rawEnd: project.endDate,
                                                                        parsedStart: projectStartDate?.toISOString().split('T')[0],
                                                                        parsedEnd: projectEndDate?.toISOString().split('T')[0]
                                                                    });
                                                                }
                                                                
                                                                // Render single project bar for unphased projects
                                                                const startX = calculatePosition(projectStartDate, startDate, responsiveConstants.MONTH_WIDTH);
                                                                const endX = calculatePosition(projectEndDate, startDate, responsiveConstants.MONTH_WIDTH);
                                                                const width = endX - startX;
                                                                
                                                                // Debug positions for problematic projects
                                                                if (project.name && project.name.includes('1C ERP Rollouts BCCA')) {
                                                                    console.log(`📏 POSITION DEBUG for ${project.name}:`, {
                                                                        startX, endX, width
                                                                    });
                                                                }

                                                                // Get status color
                                                                const statusColors = {
                                                                    'Red': '#ef4444',
                                                                    'Amber': '#f59e0b',
                                                                    'Green': '#10b981',
                                                                    'Grey': '#9ca3af',
                                                                    'Yellow': '#E5DE00'
                                                                };

                                                                return (
                                                                    <rect
                                                                        key={`bar-${project.id}`}
                                                                        x={startX}
                                                                        y={ganttBarY}
                                                                        width={Math.max(width + 2, 4)}
                                                                        height={12}
                                                                        rx={3}
                                                                        fill={project.status ? statusColors[project.status] : statusColors.Grey}
                                                                        className="transition-opacity duration-150 hover:opacity-90 cursor-default"
                                                                    >
                                                                        <title>{project.name}</title>
                                                                    </rect>
                                                                );
                                                            }
                                                        })()}

                                                        {/* Milestones - match PortfolioGanttChart positioning */}
                                                        {milestones.map((milestone, milestoneIndex) => (
                                                            <MilestoneMarker
                                                                key={`${project.id}-milestone-${milestoneIndex}`}
                                                                x={milestone.x}
                                                                y={milestoneY} // Use the fixed Y position
                                                                complete={milestone.status === 'Complete'}
                                                                label={milestone.label}
                                                                isSG3={milestone.isSG3}
                                                                labelPosition={milestone.labelPosition}
                                                                shouldWrapText={milestone.shouldWrapText}
                                                                isGrouped={milestone.isGrouped}
                                                                groupLabels={milestone.groupLabels}
                                                                fullLabel={milestone.fullLabel}
                                                                showLabel={milestone.showLabel}
                                                                hasAdjacentMilestones={milestone.hasAdjacentMilestones}
                                                                fontSize={responsiveConstants.MILESTONE_FONT_SIZE}
                                                                isMobile={responsiveConstants.TOUCH_TARGET_SIZE > 24}
                                                                zoomLevel={responsiveConstants.ZOOM_LEVEL}
                                                                // Display3: New props for monthly grouped labels
                                                                isMonthlyGrouped={milestone.isMonthlyGrouped}
                                                                monthlyLabels={milestone.monthlyLabels}
                                                                horizontalLabel={milestone.horizontalLabel}
                                                                verticalLabels={milestone.verticalLabels}
                                                                monthKey={milestone.monthKey}
                                                                // NEW PROPS for the fixes (matching PortfolioGanttChart)
                                                                shouldRenderShape={milestone.shouldRenderShape}
                                                                allMilestonesInProject={milestone.allMilestonesInProject}
                                                                currentMilestoneDate={milestone.currentMilestoneDate}
                                                                // CRITICAL FIX: Enable centering on gantt bars for proper milestone positioning
                                                                useTopAnchoring={false} // Allow MilestoneMarker to center on the gantt bar
                                                                hasValidBar={true} // Always true since we're rendering inside gantt bar context
                                                            />
                                                        ))}
                                                    </g>
                                                );
                                            })}
                                        </svg>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Pagination Controls */}
                            <PaginationControls 
                                currentPage={currentPage}
                                totalItems={timelineFilteredAllData?.length || 0}
                                itemsPerPage={ITEMS_PER_PAGE}
                                onPageChange={(page) => {
                                    console.log('🚀 Bottom pagination onPageChange called with page:', page);
                                    handlePageChangeCallback(page);
                                }}
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default RegionRoadMap;