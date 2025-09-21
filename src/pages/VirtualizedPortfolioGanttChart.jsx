import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { FixedSizeList as List } from 'react-window';
import TimelineAxis from '../components/TimelineAxis';
import MilestoneMarker from '../components/MilestoneMarker';
import LoadingSpinner from '../components/LoadingSpinner';
import { useDataContext } from '../contexts/DataContext';
import { useLegacyData } from '../services/optimizedApiService';
import { 
    getTimelineRange, 
    parseDate, 
    calculatePosition, 
    calculateMilestonePosition, 
    groupMilestonesByMonth, 
    getMonthlyLabelPosition, 
    createVerticalMilestoneLabels, 
    getInitialScrollPosition, 
    truncateLabel 
} from '../utils/dateUtils';
import { processPortfolioData } from '../services/apiDataService';
import { differenceInDays } from 'date-fns';

// Enhanced zoom levels for better performance
const ZOOM_LEVELS = {
    0.5: { // 50% - Maximum Zoom Out (Performance Mode)
        MONTH_WIDTH: 40,
        VISIBLE_MONTHS: 24,
        FONT_SIZE: '8px',
        LABEL_WIDTH: 100,
        BASE_BAR_HEIGHT: 4,
        TOUCH_TARGET_SIZE: 16,
        MILESTONE_LABEL_HEIGHT: 8,
        MILESTONE_FONT_SIZE: '8px',
        PROJECT_SCALE: 2.0,
        ROW_PADDING: 4,
        ROW_HEIGHT: 40 // Increased from 24
    },
    0.75: { // 75% - Zoom Out
        MONTH_WIDTH: 60,
        VISIBLE_MONTHS: 18,
        FONT_SIZE: '10px',
        LABEL_WIDTH: 140,
        BASE_BAR_HEIGHT: 6,
        TOUCH_TARGET_SIZE: 20,
        MILESTONE_LABEL_HEIGHT: 12,
        MILESTONE_FONT_SIZE: '9px',
        PROJECT_SCALE: 1.5,
        ROW_PADDING: 6,
        ROW_HEIGHT: 48 // Increased from 32
    },
    1.0: { // 100% - Default
        MONTH_WIDTH: 100,
        VISIBLE_MONTHS: 13,
        FONT_SIZE: '14px',
        LABEL_WIDTH: 220,
        BASE_BAR_HEIGHT: 10,
        TOUCH_TARGET_SIZE: 24,
        MILESTONE_LABEL_HEIGHT: 20,
        MILESTONE_FONT_SIZE: '10px',
        PROJECT_SCALE: 1.0,
        ROW_PADDING: 8,
        ROW_HEIGHT: 60 // Increased from 40
    },
    1.25: { // 125% - Zoom In
        MONTH_WIDTH: 125,
        VISIBLE_MONTHS: 10,
        FONT_SIZE: '16px',
        LABEL_WIDTH: 275,
        BASE_BAR_HEIGHT: 12,
        TOUCH_TARGET_SIZE: 28,
        MILESTONE_LABEL_HEIGHT: 24,
        MILESTONE_FONT_SIZE: '11px',
        PROJECT_SCALE: 0.8,
        ROW_PADDING: 10,
        ROW_HEIGHT: 72 // Increased from 48
    },
    1.5: { // 150% - Maximum Zoom In
        MONTH_WIDTH: 150,
        VISIBLE_MONTHS: 8,
        FONT_SIZE: '18px',
        LABEL_WIDTH: 300,
        BASE_BAR_HEIGHT: 14,
        TOUCH_TARGET_SIZE: 32,
        MILESTONE_LABEL_HEIGHT: 28,
        MILESTONE_FONT_SIZE: '12px',
        PROJECT_SCALE: 0.7,
        ROW_PADDING: 12,
        ROW_HEIGHT: 80 // Increased from 56
    }
};

const statusColors = {
    'Red': '#ef4444',
    'Amber': '#f59e0b',
    'Green': '#10b981',
    'Grey': '#9ca3af',
    'Yellow': '#E5DE00'
};

// Memoized row component for virtualization
const VirtualizedRow = memo(({ index, style, data }) => {
    const { projects, responsiveConstants, startDate, onDrillToProgram } = data;
    const project = projects[index];
    
    if (!project) return null;

    const projectStartDate = parseDate(project.startDate);
    const projectEndDate = parseDate(project.endDate);
    
    if (!projectStartDate || !projectEndDate) {
        return <div style={style} />;
    }

    const startX = calculatePosition(projectStartDate, startDate, responsiveConstants.MONTH_WIDTH);
    const endX = calculatePosition(projectEndDate, startDate, responsiveConstants.MONTH_WIDTH);
    const width = endX - startX;

    // Process milestones
    const processMilestonesWithPosition = (milestones, startDate, monthWidth = 100, projectEndDate = null) => {
        if (!milestones?.length) return [];

        const monthlyGroups = groupMilestonesByMonth(milestones);
        const maxInitialWidth = monthWidth * 8;
        const processedMilestones = [];

        Object.entries(monthlyGroups).forEach(([monthKey, monthMilestones]) => {
            const labelPosition = getMonthlyLabelPosition(monthKey);
            const verticalLabels = createVerticalMilestoneLabels(monthMilestones, maxInitialWidth, '14px', milestones, monthWidth);

            monthMilestones.forEach((milestone, index) => {
                const milestoneDate = parseDate(milestone.date);
                const x = calculateMilestonePosition(milestoneDate, startDate, monthWidth, projectEndDate);
                const isFirstInMonth = index === 0;

                processedMilestones.push({
                    ...milestone,
                    x,
                    date: milestoneDate,
                    isGrouped: monthMilestones.length > 1,
                    isMonthlyGrouped: true,
                    labelPosition,
                    verticalLabels: isFirstInMonth ? verticalLabels : [],
                    monthKey,
                    shouldRenderShape: isFirstInMonth,
                    allMilestonesInProject: milestones,
                    currentMilestoneDate: milestoneDate
                });
            });
        });

        return processedMilestones;
    };

    const milestones = processMilestonesWithPosition(project.milestones, startDate, responsiveConstants.MONTH_WIDTH, projectEndDate);
    const ganttBarY = 16; // Fixed Y position for virtualized rows
    const milestoneY = ganttBarY + 6;

    return (
        <div style={style} className="flex">
            {/* Left panel - Project name */}
            <div 
                style={{ 
                    width: responsiveConstants.LABEL_WIDTH,
                    minHeight: responsiveConstants.ROW_HEIGHT
                }}
                className={`border-r border-gray-200 flex items-center px-3 ${
                    project.isDrillable ? 'cursor-pointer hover:bg-blue-50' : ''
                }`}
                onClick={() => {
                    if (project.isDrillable && onDrillToProgram) {
                        onDrillToProgram(project.id, project.name);
                    }
                }}
            >
                <div className="flex items-center justify-between w-full">
                    <span className={`font-medium text-sm ${
                        project.isDrillable ? 'text-blue-700 hover:text-blue-800' : 'text-gray-800'
                    }`} title={project.name}>
                        {project.name || `[No Name - ID: ${project.id}]`}
                    </span>
                    {project.isDrillable && (
                        <span className="text-blue-600 text-sm ml-1" title="Click to view programs">
                            ↗️
                        </span>
                    )}
                </div>
            </div>
            
            {/* Right panel - SVG Gantt chart */}
            <div className="flex-1 relative">
                <svg
                    width="100%"
                    height={responsiveConstants.ROW_HEIGHT}
                    className="block"
                >
                    {/* Project bar */}
                    <rect
                        x={startX}
                        y={ganttBarY}
                        width={Math.max(width + 2, 4)}
                        height={12}
                        rx={3}
                        fill={project.status ? statusColors[project.status] : statusColors.Grey}
                        className="transition-opacity duration-150 hover:opacity-90"
                    />
                    
                    {/* Milestones */}
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
                            zoomLevel={responsiveConstants.ZOOM_LEVEL || 1.0}
                            isMonthlyGrouped={milestone.isMonthlyGrouped}
                            monthlyLabels={milestone.monthlyLabels}
                            horizontalLabel={milestone.horizontalLabel}
                            verticalLabels={milestone.verticalLabels}
                            monthKey={milestone.monthKey}
                            shouldRenderShape={milestone.shouldRenderShape}
                            allMilestonesInProject={milestone.allMilestonesInProject}
                            currentMilestoneDate={milestone.currentMilestoneDate}
                        />
                    ))}
                </svg>
            </div>
        </div>
    );
});

VirtualizedRow.displayName = 'VirtualizedRow';

const VirtualizedPortfolioGanttChart = ({ onDrillToProgram }) => {
    const [zoomLevel, setZoomLevel] = useState(1.0);
    const [processedData, setProcessedData] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    const timelineScrollRef = useRef();
    const ganttScrollRef = useRef();
    const leftPanelScrollRef = useRef();
    const listRef = useRef();

    // Memoized responsive constants
    const responsiveConstants = useMemo(() => {
        return {
            ...ZOOM_LEVELS[zoomLevel],
            ZOOM_LEVEL: zoomLevel
        };
    }, [zoomLevel]);

    // Use optimized data fetching
    const { 
        data: legacyData, 
        isLoading: queryLoading, 
        error: queryError,
        refetch
    } = useLegacyData();

    // Memoized timeline calculations
    const { startDate, totalWidth } = useMemo(() => {
        const timelineRange = getTimelineRange();
        return {
            startDate: timelineRange.startDate,
            totalWidth: 73 * responsiveConstants.MONTH_WIDTH
        };
    }, [responsiveConstants.MONTH_WIDTH]);

    // Memoized filtered data based on zoom level
    const scaledFilteredData = useMemo(() => {
        if (!filteredData.length) return [];

        // Don't scale down at portfolio level - show all records
        // Portfolio level should show complete data, especially records without investment data
        return filteredData;
        
        // Original scaling logic commented out for portfolio view
        // const scale = responsiveConstants.PROJECT_SCALE || 1.0;
        // const maxProjects = Math.floor(filteredData.length * scale);
        // return filteredData.slice(0, Math.max(1, maxProjects));
    }, [filteredData]);

    // Load data effect
    useEffect(() => {
        if (legacyData && !queryLoading) {
            // Process the data from react-query
            console.log('📊 Portfolio data loaded:', {
                totalRecords: legacyData.length,
                recordsWithInvestmentData: legacyData.filter(r => r.hasInvestmentData).length,
                recordsWithoutInvestmentData: legacyData.filter(r => !r.hasInvestmentData).length,
                sampleRecord: legacyData[0]
            });
            setProcessedData(legacyData);
            setFilteredData(legacyData);
            setLoading(false);
        } else if (queryError) {
            setError(queryError.message);
            setLoading(false);
        }
    }, [legacyData, queryLoading, queryError]);

    // Fallback to legacy loading if react-query is not working
    useEffect(() => {
        if (!legacyData && !queryLoading && !queryError) {
            let isCurrentRequest = true;
            
            const loadData = async () => {
                try {
                    setLoading(true);
                    setError(null);
                    
                    const data = await processPortfolioData();
                    
                    if (isCurrentRequest) {
                        console.log('📊 Portfolio data loaded (fallback):', {
                            totalRecords: data.length,
                            recordsWithInvestmentData: data.filter(r => r.hasInvestmentData).length,
                            recordsWithoutInvestmentData: data.filter(r => !r.hasInvestmentData).length,
                            sampleRecord: data[0]
                        });
                        setProcessedData(data);
                        setFilteredData(data);
                        
                        // Initial scroll positioning
                        setTimeout(() => {
                            if (timelineScrollRef.current) {
                                const scrollPosition = getInitialScrollPosition(responsiveConstants.MONTH_WIDTH);
                                timelineScrollRef.current.scrollLeft = scrollPosition;
                                if (ganttScrollRef.current) {
                                    ganttScrollRef.current.scrollLeft = scrollPosition;
                                }
                            }
                        }, 100);
                    }
                } catch (err) {
                    if (isCurrentRequest) {
                        console.error('Failed to load portfolio data from API:', err);
                        setError(err.message);
                    }
                } finally {
                    if (isCurrentRequest) {
                        setLoading(false);
                    }
                }
            };

            loadData();
            
            return () => {
                isCurrentRequest = false;
            };
        }
    }, [legacyData, queryLoading, queryError, responsiveConstants.MONTH_WIDTH]);

    // Zoom handlers
    const handleZoomIn = useCallback(() => {
        const zoomLevels = Object.keys(ZOOM_LEVELS).map(Number).sort((a, b) => a - b);
        const currentIndex = zoomLevels.indexOf(zoomLevel);
        if (currentIndex < zoomLevels.length - 1) {
            setZoomLevel(zoomLevels[currentIndex + 1]);
        }
    }, [zoomLevel]);

    const handleZoomOut = useCallback(() => {
        const zoomLevels = Object.keys(ZOOM_LEVELS).map(Number).sort((a, b) => a - b);
        const currentIndex = zoomLevels.indexOf(zoomLevel);
        if (currentIndex > 0) {
            setZoomLevel(zoomLevels[currentIndex - 1]);
        }
    }, [zoomLevel]);

    const handleZoomReset = useCallback(() => {
        setZoomLevel(1.0);
    }, []);

    // Scroll synchronization
    const handleTimelineScroll = useCallback((e) => {
        const scrollLeft = e.target.scrollLeft;
        if (ganttScrollRef.current && ganttScrollRef.current.scrollLeft !== scrollLeft) {
            ganttScrollRef.current.scrollLeft = scrollLeft;
        }
    }, []);

    const handleGanttScroll = useCallback((e) => {
        const scrollLeft = e.target.scrollLeft;
        if (timelineScrollRef.current && timelineScrollRef.current.scrollLeft !== scrollLeft) {
            timelineScrollRef.current.scrollLeft = scrollLeft;
        }
    }, []);

    // Memoized data for virtual list
    const virtualListData = useMemo(() => ({
        projects: scaledFilteredData,
        responsiveConstants,
        startDate,
        onDrillToProgram
    }), [scaledFilteredData, responsiveConstants, startDate, onDrillToProgram]);

    if (loading || queryLoading) {
        return <LoadingSpinner message="Loading portfolio data..." />;
    }

    if (error || queryError) {
        return (
            <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded m-4">
                <h3 className="font-semibold">Error Loading Portfolio Data</h3>
                <p>{error || queryError?.message}</p>
                <button 
                    onClick={() => queryError ? refetch() : window.location.reload()} 
                    className="mt-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="w-full flex flex-col">
            {/* Controls */}
            <div className="flex items-center justify-between mb-4 p-4 bg-gray-50 rounded">
                <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-gray-700">
                        Showing {scaledFilteredData.length} of {processedData.length} projects
                    </span>
                </div>
                
                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-700">Zoom:</label>
                    <button
                        onClick={handleZoomOut}
                        disabled={zoomLevel <= 0.5}
                        className="w-8 h-6 flex items-center justify-center bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-300 rounded text-xs font-bold transition-colors"
                        title="Zoom Out"
                    >
                        −
                    </button>
                    <span className="text-xs min-w-[35px] text-gray-600 text-center font-medium">
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
                        Reset
                    </button>
                </div>
            </div>

            {/* Main chart container */}
            <div className="flex flex-col bg-white border border-gray-200 rounded-lg overflow-hidden">
                {/* Timeline header */}
                <div className="flex border-b border-gray-200">
                    <div 
                        style={{ width: responsiveConstants.LABEL_WIDTH }}
                        className="border-r border-gray-200 bg-gray-50 p-2 flex items-center"
                    >
                        <span className="text-sm font-medium text-gray-700">Project</span>
                    </div>
                    <div
                        ref={timelineScrollRef}
                        className="flex-1 overflow-x-auto"
                        style={{ width: totalWidth }}
                        onScroll={handleTimelineScroll}
                    >
                        <TimelineAxis
                            startDate={startDate}
                            monthWidth={responsiveConstants.MONTH_WIDTH}
                            fontSize={responsiveConstants.FONT_SIZE}
                        />
                    </div>
                </div>

                {/* Virtualized project rows */}
                <div 
                    ref={ganttScrollRef}
                    className="flex-1 overflow-x-auto"
                    style={{ width: totalWidth }}
                    onScroll={handleGanttScroll}
                >
                    <List
                        ref={listRef}
                        height={400} // Fixed height for virtualization
                        itemCount={scaledFilteredData.length}
                        itemSize={responsiveConstants.ROW_HEIGHT}
                        itemData={virtualListData}
                        width={responsiveConstants.LABEL_WIDTH + totalWidth}
                    >
                        {VirtualizedRow}
                    </List>
                </div>
            </div>
        </div>
    );
};

export default VirtualizedPortfolioGanttChart;
