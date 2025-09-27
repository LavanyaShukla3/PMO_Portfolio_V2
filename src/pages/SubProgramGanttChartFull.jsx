import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import TimelineAxis from '../components/TimelineAxis';
import MilestoneMarker from '../components/MilestoneMarker';
import GanttBar from '../components/GanttBar';
import PaginationControls from '../components/PaginationControls';
import { getTimelineRangeForView, isProjectInTimelineViewport, parseDate, calculatePosition, calculateMilestonePosition, groupMilestonesByMonth, getMonthlyLabelPosition, createVerticalMilestoneLabels } from '../utils/dateUtils';
import { useGlobalDataCache } from '../contexts/GlobalDataCacheContext';
import { getPaginatedData, handlePageChange, ITEMS_PER_PAGE } from '../services/paginationService';
import TimelineViewDropdown from '../components/TimelineViewDropdown';
import { differenceInDays } from 'date-fns';

// Fixed constants (zoom removed)
const getResponsiveConstants = () => {
    const screenWidth = window.innerWidth;
    const isMobile = screenWidth < 768;
    const mobileAdjustment = isMobile ? 0.8 : 1.0;

    return {
        MONTH_WIDTH: Math.round(80 * mobileAdjustment),
        VISIBLE_MONTHS: isMobile ? Math.max(6, Math.round(12 * 0.6)) : 12,
        FONT_SIZE: '12px',
        LABEL_WIDTH: Math.round(220 * mobileAdjustment),
        BASE_BAR_HEIGHT: Math.round(8 * mobileAdjustment),
        TOUCH_TARGET_SIZE: Math.max(isMobile ? 44 : 16, Math.round(24 * mobileAdjustment)),
        MILESTONE_LABEL_HEIGHT: Math.round(12 * mobileAdjustment),
        MILESTONE_FONT_SIZE: '11px',
        PROJECT_SCALE: 1.0,
        ROW_PADDING: Math.round(8 * mobileAdjustment)
    };
};

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
    'Unphased': '#c0c0c0'     // Light Grey
};

const STATUS_COLORS = {
    'Red': '#EF4444',
    'Amber': '#F59E0B', 
    'Green': '#10B981',
    'Grey': '#9CA3AF',
    'Yellow': '#EAB308'
};

const SubProgramGanttChart = ({ selectedSubProgramId, selectedSubProgramName, selectedProgramName, selectedProgramId, onNavigateUp, onBackToProgram }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false); // Will use cached data
    const [error, setError] = useState(null);
    const [responsiveConstants] = useState(getResponsiveConstants());
    const [selectedProgram, setSelectedProgram] = useState('All');
    const [programNames, setProgramNames] = useState(['All']);
    const [dataVersion, setDataVersion] = useState(0);
    
    // Get cached data and state
    const { 
        subProgramData, 
        isLoading: cacheLoading
    } = useGlobalDataCache();
    
    // Timeline view state with default to current14
    const [timelineView, setTimelineView] = useState('current14'); // Default to "14 Months Current Viewport"

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [allData, setAllData] = useState([]); // Store all loaded data

    // Smart pagination with hierarchical grouping and parent header repetition
    const processedData = useMemo(() => {
        if (!data?.projects) return [];
        
        // Filter out null/undefined projects first
        const cleanedProjects = (data.projects || []).filter(project => project && project.PROJECT_NAME);

        // Apply program filtering
        const programFilteredProjects = selectedProgram === 'All'
            ? cleanedProjects
            : cleanedProjects.filter(project => {
                const parentName = project.COE_ROADMAP_PARENT_NAME || project.INV_FUNCTION || 'Unassigned';
                return parentName === selectedProgram;
            });

        // Apply timeline filtering BEFORE pagination
        const { startDate: timelineStart, endDate: timelineEnd } = getTimelineRangeForView(timelineView);
        const timelineFilteredProjects = programFilteredProjects.filter(project => {
            const projectForFiltering = {
                startDate: project.START_DATE,
                endDate: project.END_DATE,
                name: project.PROJECT_NAME
            };
            return isProjectInTimelineViewport(projectForFiltering, timelineStart, timelineEnd);
        });

        // Use timeline-filtered projects for all subsequent processing
        const filteredProjects = timelineFilteredProjects;

        // If no data found after filtering, return a helpful message
        if (filteredProjects.length === 0 && selectedProgram !== 'All') {
            console.log(`⚠️ No projects found for selected program: ${selectedProgram}`);
            return [];
        }
        
        // Apply hierarchical grouping BEFORE pagination
        const hierarchicalData = selectedProgram === 'All' ? (() => {
            const hierarchicalResult = [];
            
            // Group by program names
            const programGroups = {};
            filteredProjects.forEach(project => {
                const parentName = project.COE_ROADMAP_PARENT_NAME || project.INV_FUNCTION || 'Unassigned';
                
                if (!programGroups[parentName]) {
                    programGroups[parentName] = {
                        program: {
                            name: parentName,
                            PROJECT_ID: `PARENT_${parentName}`,
                            PROJECT_NAME: parentName,
                            isProgramHeader: true
                        },
                        children: []
                    };
                }
                
                // Add project as child with isChildItem flag
                programGroups[parentName].children.push({
                    ...project,
                    isChildItem: true,
                    parentId: `PARENT_${parentName}` // Add parentId for smart pagination
                });
            });
            
            // Create flat hierarchical list with full aggregation: program header + indented children
            Object.values(programGroups).forEach(group => {
                // *** CALCULATE AGGREGATE DATA FOR PROGRAM HEADERS ***
                let programStartDate = null;
                let programEndDate = null;
                let programPhases = [];
                let programMilestones = [];
                
                // Aggregate data from all children projects
                group.children.forEach(child => {
                    // Aggregate start and end dates
                    if (child.START_DATE) {
                        const childStartDate = parseDate(child.START_DATE);
                        if (childStartDate && (!programStartDate || childStartDate < programStartDate)) {
                            programStartDate = childStartDate;
                        }
                    }
                    
                    if (child.END_DATE) {
                        const childEndDate = parseDate(child.END_DATE);
                        if (childEndDate && (!programEndDate || childEndDate > programEndDate)) {
                            programEndDate = childEndDate;
                        }
                    }
                    
                    // Aggregate phases (if any) - filter out null/undefined phases
                    if (child.phaseData && child.phaseData.length > 0) {
                        const validChildPhases = child.phaseData.filter(phase => 
                            phase && 
                            phase.TASK_NAME && 
                            phase.TASK_START && 
                            phase.TASK_FINISH &&
                            phase.TASK_START.trim() !== '' && 
                            phase.TASK_FINISH.trim() !== ''
                        );
                        programPhases.push(...validChildPhases);
                    }
                    
                    // Aggregate milestones for program headers
                    if (child.milestones && child.milestones.length > 0) {
                        programMilestones.push(...child.milestones);
                    }
                });
                
                // Add program header with aggregated data
                hierarchicalResult.push({
                    ...group.program,
                    isProgramHeader: true,
                    displayName: `📌 ${group.program.name}`,
                    originalName: group.program.name,
                    // *** AGGREGATED DATA FOR GANTT BAR AND MILESTONES ***
                    START_DATE: programStartDate ? programStartDate.toISOString().split('T')[0] : null,
                    END_DATE: programEndDate ? programEndDate.toISOString().split('T')[0] : null,
                    phaseData: programPhases, // Aggregated phases from children
                    milestones: programMilestones, // Aggregated milestones from all children
                    childrenCount: group.children.length
                });
                
                // Add indented children
                group.children.forEach(child => {
                    hierarchicalResult.push({
                        ...child,
                        isChildItem: true,
                        displayName: `   ${child.PROJECT_NAME}`, // Indent with spaces  
                        originalName: child.PROJECT_NAME,
                        parentId: `PARENT_${group.program.name}` // Ensure parentId is set for smart pagination
                    });
                });
            });
            
            console.log('🎯 SUBPROGRAM HIERARCHICAL DATA:', {
                totalItems: hierarchicalResult.length,
                programHeaders: hierarchicalResult.filter(item => item.isProgramHeader).length,
                childItems: hierarchicalResult.filter(item => item.isChildItem).length,
                programGroups: Object.keys(programGroups).length
            });
            
            return hierarchicalResult;
        })() : filteredProjects;
        
        // Smart pagination that repeats parent headers when needed
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
                        item.isChildItem && item.parentId === parentHeader.PROJECT_ID
                    );
                    
                    if (childrenBelongToParent) {
                        console.log('🎯 SUBPROGRAM SMART PAGINATION: Adding parent header', parentHeader.displayName, 'to page', page);
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
        
        return getSmartPaginatedData(hierarchicalData, currentPage, ITEMS_PER_PAGE);
    }, [data?.projects, currentPage, selectedProgram, timelineView]);

    // Calculate correct totalItems for pagination after all filtering
    const actualTotalItems = useMemo(() => {
        if (!data?.projects) return 0;

        // Apply same filtering logic as in processedData
        const cleanedProjects = (data.projects || []).filter(project => project && project.PROJECT_NAME);

        const programFilteredProjects = selectedProgram === 'All'
            ? cleanedProjects
            : cleanedProjects.filter(project => {
                const parentName = project.COE_ROADMAP_PARENT_NAME || project.INV_FUNCTION || 'Unassigned';
                return parentName === selectedProgram;
            });

        const { startDate: timelineStart, endDate: timelineEnd } = getTimelineRangeForView(timelineView);
        const timelineFilteredProjects = programFilteredProjects.filter(project => {
            const projectForFiltering = {
                startDate: project.START_DATE,
                endDate: project.END_DATE,
                name: project.PROJECT_NAME
            };
            return isProjectInTimelineViewport(projectForFiltering, timelineStart, timelineEnd);
        });

        // For "All" view, add hierarchical headers count
        if (selectedProgram === 'All') {
            const uniquePrograms = new Set(timelineFilteredProjects.map(p => p.COE_ROADMAP_PARENT_NAME || p.INV_FUNCTION || 'Unassigned')).size;
            return timelineFilteredProjects.length + uniquePrograms;
        }

        return timelineFilteredProjects.length;
    }, [data?.projects, selectedProgram, timelineView]);

    const scrollContainerRef = useRef(null);
    const headerScrollRef = useRef(null);
    const leftPanelRef = useRef(null);

    // responsiveConstants already declared as state above

    // Simplified milestone processing to prevent infinite loops
    const processMilestonesForProject = (milestones, startDate, monthWidth, projectEndDate = null, timelineStartDate = null, timelineEndDate = null) => {
        if (!milestones || milestones.length === 0) return [];

        try {
            // CRITICAL FIX: Filter milestones to only include those within the timeline viewport
            const timelineFilteredMilestones = milestones.filter(milestone => {
                const milestoneDate = parseDate(milestone.MILESTONE_DATE);
                if (!milestoneDate) return false;

                // Only include milestones that fall within the timeline range
                if (timelineStartDate && timelineEndDate) {
                    const isWithinTimeline = milestoneDate >= timelineStartDate && milestoneDate <= timelineEndDate;
                    if (!isWithinTimeline) {
                        console.log('🚫 SubProgram: Excluding milestone outside timeline:', milestone.MILESTONE_NAME, milestoneDate.toISOString());
                    }
                    return isWithinTimeline;
                }

                return true; // If no timeline bounds provided, include all milestones
            });

            console.log(`🎯 SubProgram: Timeline filtered milestones: ${timelineFilteredMilestones.length} out of ${milestones.length} milestones are within viewport`);

            // CRITICAL FIX: Use the correct date property for grouping milestones with filtered data
            const monthlyGroups = groupMilestonesByMonth(timelineFilteredMilestones, 'MILESTONE_DATE');
            const processedMilestones = [];

            // Step 2: Process each monthly group to handle overlaps.
            Object.entries(monthlyGroups).forEach(([monthKey, monthMilestones]) => {
                // Determine if labels should be 'above' or 'below' the bar for this month.
                const labelPosition = getMonthlyLabelPosition(monthKey);

                // Create row-aware, vertical labels using Program page logic
                const monthMilestonesNormalized = monthMilestones.map(m => ({
                    date: m.MILESTONE_DATE,
                    label: m.MILESTONE_NAME || m.TASK_NAME || 'Milestone'
                }));
                const allMilestonesNormalized = timelineFilteredMilestones.map(m => ({
                    ...m,
                    date: m.MILESTONE_DATE,
                    label: m.MILESTONE_NAME || m.TASK_NAME || 'Milestone'
                }));
                const maxInitialWidth = monthWidth * 8;
                const verticalLabels = createVerticalMilestoneLabels(
                    monthMilestonesNormalized,
                    maxInitialWidth,
                    '14px',
                    allMilestonesNormalized,
                    monthWidth
                );

                // Step 3: Create a single, consolidated milestone marker for the month.
                const firstMilestoneInMonth = monthMilestones[0];
                const milestoneDate = parseDate(firstMilestoneInMonth.MILESTONE_DATE);
                if (!milestoneDate) return;

                const x = calculateMilestonePosition(milestoneDate, startDate, monthWidth, projectEndDate);

                processedMilestones.push({
                    ...firstMilestoneInMonth,
                    x,
                    date: milestoneDate,
                    // Extract status correctly for milestone display
                    status: firstMilestoneInMonth.STATUS === 'Completed' ? 'Completed' : 'Incomplete',
                    label: firstMilestoneInMonth.MILESTONE_NAME || firstMilestoneInMonth.TASK_NAME || 'Milestone',
                    isSG3: firstMilestoneInMonth.MILESTONE_NAME?.includes('SG3') || firstMilestoneInMonth.TASK_NAME?.includes('SG3'),
                    isGrouped: monthMilestones.length > 1,
                    isMonthlyGrouped: true,
                    labelPosition: labelPosition,
                    verticalLabels: verticalLabels,
                    horizontalLabel: '',
                    showLabel: true,
                    fullLabel: verticalLabels.join(', '),
                    shouldRenderShape: true,
                    shouldWrapText: false,
                    hasAdjacentMilestones: false,
                    monthKey: monthKey,
                    groupLabels: monthMilestones.length > 1 ? verticalLabels : [],
                    monthlyLabels: [],
                    allMilestonesInProject: milestones,
                    currentMilestoneDate: milestoneDate
                });
            });

            return processedMilestones.sort((a, b) => a.date - b.date);
        } catch (error) {
            console.error('🎯 Error in milestone processing:', error);
            return [];
        }
    };

    

    // Use cached data
    useEffect(() => {
        if (subProgramData && subProgramData.projects) {
            console.log('✅ Using cached subprogram data:', subProgramData);
            
            // Extract unique program names for dropdown (same clean logic as Portfolio page)
            const programNames = ['All', ...Array.from(new Set(
                subProgramData.projects
                    .map(project => project.COE_ROADMAP_PARENT_NAME || project.INV_FUNCTION || 'Unassigned')
                    .filter(name => name && name !== 'Root' && name !== 'Unassigned')
            )).sort()];

            setProgramNames(programNames);
            
            // Filter by selected program if specified
            let filteredProjects = subProgramData.projects;
            if (selectedProgramId) {
                filteredProjects = subProgramData.projects.filter(project => 
                    project.PROGRAM_ID === selectedProgramId || 
                    project.program_id === selectedProgramId ||
                    project.COE_ROADMAP_PARENT_NAME === selectedProgramName
                );
            }
            
            const processedData = {
                projects: filteredProjects,
                totalProjects: filteredProjects.length,
            };
            
            setData(processedData);
            setAllData(filteredProjects);
            // Calculate total items including hierarchical headers for "All" view
            const totalItemsCount = filteredProjects.length + new Set(filteredProjects.map(p => p.COE_ROADMAP_PARENT_NAME || p.INV_FUNCTION || 'Unassigned')).size;
            setTotalItems(totalItemsCount);
            setCurrentPage(1);
            setLoading(false);
            setError(null);
            
            console.log(`✅ SubProgram data filtered: ${filteredProjects.length} items from cache`);

            // If no projects match the filter, show a helpful message instead of error
            if (filteredProjects.length === 0 && selectedProgramId) {
                setError(`No sub-programs found for the selected program. Try selecting "All" or a different program.`);
            }
        } else if (!cacheLoading && !subProgramData) {
            setError('No subprogram data available. Please check your connection and try again.');
            setLoading(false);
        }
    }, [subProgramData, cacheLoading, selectedProgramId, selectedProgramName]);
    
    // Removed legacy API loading effect and test sample data

    // Zoom removed

    const handleProgramChange = (e) => {
        setSelectedProgram(e.target.value);
        setCurrentPage(1); // Reset to first page when filter changes
        setDataVersion(prev => prev + 1); // Increment data version to force re-render
    };

    const handleScroll = (e) => {
        const scrollLeft = e.target.scrollLeft;
        const scrollTop = e.target.scrollTop;
        // Sync horizontal scroll with header (guard against loops)
        if (headerScrollRef.current && headerScrollRef.current.scrollLeft !== scrollLeft) {
            headerScrollRef.current.scrollLeft = scrollLeft;
        }
        // Sync vertical scroll with left panel (guard against loops)
        if (leftPanelRef.current && leftPanelRef.current.scrollTop !== scrollTop) {
            leftPanelRef.current.scrollTop = scrollTop;
        }
    };

    const handleHeaderScroll = (e) => {
        const scrollLeft = e.target.scrollLeft;
        if (scrollContainerRef.current && scrollContainerRef.current.scrollLeft !== scrollLeft) {
            scrollContainerRef.current.scrollLeft = scrollLeft;
        }
    };

    const handleLeftPanelScroll = (e) => {
        // Sync vertical scroll with gantt area
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = e.target.scrollTop;
        }
    };

    // Handle page changes for client-side pagination
    const handlePageChangeCallback = useCallback((newPage) => {
        const totalPages = Math.ceil(actualTotalItems / ITEMS_PER_PAGE);
        handlePageChange(newPage, totalPages, setCurrentPage);
    }, [actualTotalItems]);

    // Calculate milestone label height to prevent overlap (compact like Program page)
    const calculateMilestoneLabelHeight = (milestones, monthWidth = 100) => {
        if (!milestones?.length) return { total: 0, above: 0, below: 0 };

        try {
            let maxAboveHeight = 0;
            let maxBelowHeight = 0;
            const LINE_HEIGHT = 12;
            const COMPACT_LABEL_PADDING = 1;
            const COMPACT_ABOVE_OFFSET = 1;
            const COMPACT_BELOW_OFFSET = 1;

            const looksProcessed = !!milestones[0]?.isMonthlyGrouped || Array.isArray(milestones[0]?.verticalLabels);

            if (looksProcessed) {
                // Already processed milestones: compute directly from provided verticalLabels
                let hasAnyLabels = false;
                milestones.forEach(milestone => {
                    if (milestone.isMonthlyGrouped) {
                        const nonEmptyLabels = (milestone.verticalLabels || []).filter(l => l && l.trim());
                        const labelHeight = nonEmptyLabels.length * LINE_HEIGHT;
                        if (nonEmptyLabels.length > 0) hasAnyLabels = true;
                        if (labelHeight > 0) {
                            if (milestone.labelPosition === 'above') {
                                maxAboveHeight = Math.max(maxAboveHeight, labelHeight + COMPACT_ABOVE_OFFSET);
                            } else {
                                maxBelowHeight = Math.max(maxBelowHeight, labelHeight + COMPACT_BELOW_OFFSET);
                            }
                        }
                    } else if (milestone.isGrouped && milestone.groupLabels?.length > 0) {
                        const nonEmptyGroupLabels = milestone.groupLabels.filter(l => l && l.trim());
                        if (nonEmptyGroupLabels.length > 0) {
                            const groupHeight = nonEmptyGroupLabels.length * LINE_HEIGHT;
                            maxBelowHeight = Math.max(maxBelowHeight, groupHeight + COMPACT_LABEL_PADDING);
                            hasAnyLabels = true;
                        }
                    } else if (milestone.label && milestone.label.trim()) {
                        hasAnyLabels = true;
                        if (milestone.labelPosition === 'above') {
                            maxAboveHeight = Math.max(maxAboveHeight, COMPACT_ABOVE_OFFSET);
                        } else {
                            maxBelowHeight = Math.max(maxBelowHeight, COMPACT_BELOW_OFFSET);
                        }
                    }
                });

                return {
                    total: (maxAboveHeight + maxBelowHeight),
                    above: maxAboveHeight,
                    below: maxBelowHeight
                };
            }

            // Raw milestones: group by month and generate row-aware vertical labels
            const monthlyGroups = groupMilestonesByMonth(milestones, 'MILESTONE_DATE');
            Object.entries(monthlyGroups).forEach(([monthKey, monthMilestones]) => {
                const labelPosition = getMonthlyLabelPosition(monthKey);
                const monthMilestonesNormalized = monthMilestones.map(m => ({
                    date: m.MILESTONE_DATE,
                    label: m.MILESTONE_NAME || m.TASK_NAME || 'Milestone'
                }));
                const allMilestonesNormalized = milestones.map(m => ({
                    date: m.MILESTONE_DATE,
                    label: m.MILESTONE_NAME || m.TASK_NAME || 'Milestone'
                }));

                const verticalLabels = createVerticalMilestoneLabels(
                    monthMilestonesNormalized,
                    monthWidth * 8,
                    '14px',
                    allMilestonesNormalized,
                    monthWidth
                );

                const lineCount = Array.isArray(verticalLabels) ? verticalLabels.filter(l => l && l.trim()).length : 0;
                const labelHeight = lineCount * LINE_HEIGHT;
                if (labelHeight > 0) {
                    if (labelPosition === 'above') {
                        maxAboveHeight = Math.max(maxAboveHeight, labelHeight + COMPACT_ABOVE_OFFSET);
                    } else {
                        maxBelowHeight = Math.max(maxBelowHeight, labelHeight + COMPACT_BELOW_OFFSET);
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

    // Calculate row height for each project (ULTRA-COMPACT LOGIC - Like Program)
    const calculateBarHeight = (project, processedMilestones = null, monthWidthArg = 100) => {
        const constants = getResponsiveConstants();
        const ganttBarHeight = constants.BASE_BAR_HEIGHT; // The height of the bar itself

        // Calculate the detailed space needed for milestone labels
        const milestoneHeights = calculateMilestoneLabelHeight(
            processedMilestones || project?.milestones || [], 
            monthWidthArg
        );

        // Check if this project has any milestones
        const hasNoMilestones = (!processedMilestones || processedMilestones.length === 0) && 
                               (!project?.milestones || project.milestones.length === 0);

        // Match Program page's height calculation approach exactly
        
        // Calculate project name space (same as Program page)
        const projectName = project?.PROJECT_NAME || project?.displayName || '';
        const estimatedNameWidth = constants.LABEL_WIDTH - 16; // Account for padding
        const maxCharsPerLine = Math.max(30, estimatedNameWidth / 7); // More efficient text wrapping
        const textLines = Math.ceil(projectName.length / maxCharsPerLine);
        const lineHeight = Math.round(12 * 1.0); // Compact line height
        const nameHeight = Math.max(16, textLines * lineHeight); // Just enough for text
        
        // Content-driven height calculation with proper milestone spacing (Program page logic)
        const leftPanelNeeds = nameHeight + 8; // Name + minimal padding (same as Program page)
        const rightPanelNeeds = milestoneHeights.above + ganttBarHeight + milestoneHeights.below + 8; // Proper vertical stacking (same as Program page)
        
        // Use the larger of the two, but keep it compact
        const contentDrivenHeight = Math.max(leftPanelNeeds, rightPanelNeeds);
        
        // Ensure minimum usability (same as Program page)
        const minimumHeight = Math.round(28 * 1.0); // Same as Program page
        
        return Math.max(minimumHeight, contentDrivenHeight);
    };

    // Render the main Gantt chart content
    const renderGanttChart = () => {
        if (!processedData || processedData.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center h-64">
                    <div className="text-lg text-gray-600">No sub-program data available</div>
                    <div className="text-sm text-gray-500 mt-2">Try selecting a different program or check your filters</div>
                </div>
            );
        }

        const constants = getResponsiveConstants();
        const projects = processedData || [];

        console.log('🎯 MAIN PROCESSING: Starting with', projects.length, 'projects (already filtered and paginated)');
        console.log('🎯 MAIN PROCESSING: First 3 project names:', projects.slice(0, 3).map(p => p.PROJECT_NAME));

        // Get timeline date range for rendering calculations
        const { startDate, endDate } = getTimelineRangeForView(timelineView);
        console.log('📅 SubProgram Timeline view:', timelineView);
        console.log('📅 SubProgram Timeline range:', startDate?.toISOString(), 'to', endDate?.toISOString());

        // Calculate total months dynamically based on selected timeline
        const totalMonths = Math.ceil(differenceInDays(endDate, startDate) / 30);

        // Calculate dynamic month width to fit viewport (no horizontal scrolling)
        const availableGanttWidth = window.innerWidth - constants.LABEL_WIDTH - 40; // 40px for margins/padding
        const dynamicMonthWidth = Math.max(30, Math.floor(availableGanttWidth / totalMonths)); // Minimum 30px per month
        const monthWidth = dynamicMonthWidth;

        console.log('📐 SubProgram Dynamic sizing:', {
            totalMonths,
            availableGanttWidth,
            dynamicMonthWidth,
            viewportWidth: window.innerWidth
        });
        

        // Note: Hierarchical grouping and smart pagination now happens in processedData memo
        // The projects array is already hierarchically structured and paginated

    // Calculate timeline range from ALL project dates (including phased, unphased, and non-phased projects)
    let earliestDate = new Date();
    let latestDate = new Date();
    
    projects.forEach(project => {
        // Skip program headers when calculating timeline (they don't have real project dates)
        if (project.isProgramHeader) return;
        
        // Check phase data for phased projects
        if (project.phaseData && project.phaseData.length > 0) {
            const validProjectPhases = project.phaseData.filter(phase => 
                phase && 
                phase.TASK_NAME && 
                phase.TASK_START && 
                phase.TASK_FINISH &&
                phase.TASK_START.trim() !== '' && 
                phase.TASK_FINISH.trim() !== ''
            );
            validProjectPhases.forEach(phase => {
                if (phase.TASK_START) {
                    const startDate = parseDate(phase.TASK_START);
                    if (startDate && startDate < earliestDate) earliestDate = startDate;
                }
                if (phase.TASK_FINISH) {
                    const endDate = parseDate(phase.TASK_FINISH);
                    if (endDate && endDate > latestDate) latestDate = endDate;
                }
            });
        } 
        
        // Also check project-level dates for all projects (some might have both)
        if (project.START_DATE) {
            const startDate = parseDate(project.START_DATE);
            if (startDate && startDate < earliestDate) earliestDate = startDate;
        }
        if (project.END_DATE) {
            const endDate = parseDate(project.END_DATE);
            if (endDate && endDate > latestDate) latestDate = endDate;
        }
    });

    // Remove totalWidth calculation to prevent horizontal scrolling (matching Portfolio page)
    // const totalWidth = totalMonths * monthWidth; // Removed - causes horizontal scrolling
    const timelineWidth = Math.max(800, window.innerWidth - constants.LABEL_WIDTH); // Dynamic width like Portfolio page
    
    // Process project phases for rendering - handle hierarchical structure
    const allProjectRows = [];
    projects.forEach((project, index) => {
        // Safety check for undefined projects
        if (!project) {
            console.error(`🚨 ERROR: Undefined project at index ${index} in projects array`);
            return; // Skip this iteration
        }
        
        // Handle program headers differently - they don't have real project data
        if (project.isProgramHeader) {
            console.log('🎯 HIERARCHICAL: Processing program header:', project.displayName);
            // Use aggregated phaseData for Gantt bar
            const validPhases = project.phaseData && project.phaseData.length > 0 ? project.phaseData.filter(phase =>
                phase && phase.TASK_NAME && phase.TASK_START && phase.TASK_FINISH && phase.TASK_START.trim() !== '' && phase.TASK_FINISH.trim() !== ''
            ) : [];
            
            // Use aggregated milestones from program header (already aggregated from children)
            const programMilestones = project.milestones || [];
            console.log('🎯 HIERARCHICAL: Program header has', programMilestones.length, 'aggregated milestones');
            
            allProjectRows.push({
                project: project,
                renderType: validPhases.length > 0 ? 'phases' : 'program-header',
                hasPhases: validPhases.length > 0,
                phases: validPhases,
                singleProjectPhase: validPhases.length === 0 && project.START_DATE && project.END_DATE ? {
                    TASK_NAME: 'Program',
                    TASK_START: project.START_DATE,
                    TASK_FINISH: project.END_DATE,
                    INV_OVERALL_STATUS: 'Green' // Default status for program headers
                } : null,
                // Note: milestones are accessed via project.milestones, not projectMilestones
                isProgramHeader: true
            });
            return;
        }

        if (project.phaseData && project.phaseData.length > 0) {
            console.log('🎯 DEBUG: Phase details:', project.phaseData
                .filter(p => p && p.TASK_NAME && p.TASK_START && p.TASK_FINISH) // Comprehensive filter
                .map(p => ({
                name: p.TASK_NAME,
                start: p.TASK_START,
                finish: p.TASK_FINISH,
                status: p.INV_OVERALL_STATUS
            })));
        }
        
        // Special debug for CaTAlyst
        if (project.PROJECT_NAME && project.PROJECT_NAME.toLowerCase().includes('catalyst')) {
            if (project.phaseData) {
                console.log('🔍 CATALYST DEBUG: Phase details:', project.phaseData
                    .filter(p => p && p.TASK_NAME && p.TASK_START && p.TASK_FINISH) // Comprehensive filter
                    .map(p => ({
                    name: p.TASK_NAME,
                    element: p.ROADMAP_ELEMENT,
                    start: p.TASK_START,
                    finish: p.TASK_FINISH
                })));
            }
        }
        
        // Check if project has phase data AND phases are not all "Unphased"
        const hasValidPhases = project.phaseData && project.phaseData.length > 0;
        const validPhases = hasValidPhases ? project.phaseData.filter(phase => 
            phase && 
            phase.TASK_NAME && 
            phase.TASK_START && 
            phase.TASK_FINISH && 
            phase.TASK_START.trim() !== '' && 
            phase.TASK_FINISH.trim() !== ''
        ) : [];
        const hasUnphasedOnly = validPhases.length > 0 && validPhases.every(phase => 
            phase.TASK_NAME === 'Unphased' || phase.TASK_NAME === 'Project'
        );
        
        console.log('🎯 DEBUG: hasValidPhases:', hasValidPhases, 'hasUnphasedOnly:', hasUnphasedOnly);
        console.log('🎯 DEBUG: validPhases count:', validPhases.length);
        if (validPhases.length > 0) {
            console.log('🎯 DEBUG: Phase names found:', validPhases.map(p => p.TASK_NAME));
            console.log('🎯 DEBUG: Phase details:', validPhases.map(p => ({
                name: p.TASK_NAME,
                start: p.TASK_START,
                finish: p.TASK_FINISH,
                status: p.INV_OVERALL_STATUS,
                element: p.ROADMAP_ELEMENT
            })));
        }
        
        // Enhanced debugging for projects that should have phases
        if (validPhases.length > 0 && !hasUnphasedOnly) {
            console.log('🎯 ENHANCED DEBUG: Project has REAL phases:', project.PROJECT_NAME);
            console.log('🎯 ENHANCED DEBUG: Phase count:', validPhases.length);
            console.log('🎯 ENHANCED DEBUG: All phase names:', validPhases.map(p => p.TASK_NAME));
            console.log('🎯 ENHANCED DEBUG: Phase dates check:', validPhases.map(p => ({
                name: p.TASK_NAME,
                start: p.TASK_START,
                finish: p.TASK_FINISH,
                startParsed: parseDate(p.TASK_START),
                finishParsed: parseDate(p.TASK_FINISH)
            })));
        }
        
        if (validPhases.length > 0 && !hasUnphasedOnly) {
            // Project WITH real phase data - show multiple colored phase bars
            console.log('🎯 DEBUG: Project WITH phases:', project.PROJECT_NAME, 'phases:', validPhases.length);
            console.log('🎯 DEBUG: Phase names:', validPhases.map(p => p.TASK_NAME));
            
            allProjectRows.push({
                project: project, // Keep the original project object with milestones
                displayName: project.PROJECT_NAME,
                phases: validPhases, // Use filtered valid phases only
                hasPhases: true,
                renderType: 'phases',
                ...project // Spread project properties for backward compatibility
            });
        } else if (hasUnphasedOnly) {
            // Project marked as "Unphased" - show single grey bar
            console.log('🎯 DEBUG: Project marked as UNPHASED:', project.PROJECT_NAME);
            
            const unphasedPhase = validPhases[0]; // Use the first valid unphased phase data
            if (unphasedPhase && unphasedPhase.TASK_START && unphasedPhase.TASK_FINISH) {
                allProjectRows.push({
                    project: project, // Keep the original project object with milestones
                    displayName: project.PROJECT_NAME,
                    phases: [], // No phases, will render single project bar
                    hasPhases: false,
                    renderType: 'unphased',
                    // Create a single "phase" from the unphased data for rendering
                    singleProjectPhase: {
                        TASK_NAME: 'Unphased',
                        TASK_START: unphasedPhase.TASK_START,
                        TASK_FINISH: unphasedPhase.TASK_FINISH,
                        INV_OVERALL_STATUS: unphasedPhase.INV_OVERALL_STATUS || project.STATUS
                    },
                    ...project // Spread project properties for backward compatibility
                });
            } else {
                console.warn('🚨 Skipping unphased project with invalid dates:', project.PROJECT_NAME);
            }
        } else {
            // Project WITHOUT phase data - show single status-colored bar using START_DATE and END_DATE
            console.log('🎯 DEBUG: Project WITHOUT phases:', project.PROJECT_NAME, 'START_DATE:', project.START_DATE, 'END_DATE:', project.END_DATE);
            
            // Only create a row if the project has valid start and end dates
            if (project.START_DATE && project.END_DATE && 
                project.START_DATE.trim() !== '' && project.END_DATE.trim() !== '') {
                allProjectRows.push({
                    project: project, // Keep the original project object with milestones
                    displayName: project.PROJECT_NAME,
                    phases: [], // No phases, will render single project bar
                    hasPhases: false,
                    renderType: 'project',
                    // Create a single "phase" from the project dates for rendering
                    singleProjectPhase: {
                        TASK_NAME: 'Project',
                        TASK_START: project.START_DATE,
                        TASK_FINISH: project.END_DATE,
                        INV_OVERALL_STATUS: project.STATUS
                    },
                    ...project // Spread project properties for backward compatibility
                });
            } else {
                console.warn('🚨 Skipping project with invalid dates:', project.PROJECT_NAME, 'START_DATE:', project.START_DATE, 'END_DATE:', project.END_DATE);
            }
        }
    });
    
    console.log('🎯 DEBUG: Total rows to render:', allProjectRows.length);
    console.log('🎯 DEBUG: Rows with phases:', allProjectRows.filter(r => r.renderType === 'phases').length);
    console.log('🎯 DEBUG: Rows marked unphased:', allProjectRows.filter(r => r.renderType === 'unphased').length);
    console.log('🎯 DEBUG: Rows without phases:', allProjectRows.filter(r => r.renderType === 'project').length);
    
    // *** CHECK FOR DUPLICATE PROJECT IDs ***
    const projectIds = allProjectRows.map(r => r.project?.PROJECT_ID).filter(id => id);
    const duplicateIds = projectIds.filter((id, index) => projectIds.indexOf(id) !== index);
    if (duplicateIds.length > 0) {
        console.error('🚨 DUPLICATE PROJECT IDs FOUND:', duplicateIds);
        const duplicateProjects = allProjectRows.filter(r => duplicateIds.includes(r.project?.PROJECT_ID));
        console.error('🚨 DUPLICATE PROJECT DETAILS:', duplicateProjects.map(r => ({
            projectId: r.project?.PROJECT_ID,
            projectName: r.project?.PROJECT_NAME,
            isProgramHeader: r.project?.isProgramHeader,
            isChildItem: r.project?.isChildItem,
            renderType: r.renderType
        })));
    }
    
    // Debug first few and last few projects to see if all are processed (with safety checks)
    const first5 = allProjectRows.slice(0, 5).map((r, i) => ({ 
        index: i,
        name: r?.project?.PROJECT_NAME || 'UNDEFINED_PROJECT', 
        renderType: r?.renderType || 'UNDEFINED_TYPE',
        hasProject: !!r?.project
    }));
    console.log('🎯 DEBUG: First 5 projects:', first5);
    
    const last5 = allProjectRows.slice(-5).map((r, i) => ({ 
        index: allProjectRows.length - 5 + i,
        name: r?.project?.PROJECT_NAME || 'UNDEFINED_PROJECT', 
        renderType: r?.renderType || 'UNDEFINED_TYPE',
        hasProject: !!r?.project
    }));
    console.log('🎯 DEBUG: Last 5 projects:', last5);
    
    // Check for any undefined projects in the array
    const undefinedProjects = allProjectRows.filter(r => !r || !r.project);
    if (undefinedProjects.length > 0) {
        console.error('🚨 ERROR: Found undefined projects:', undefinedProjects.length);
        console.error('🚨 ERROR: Undefined project details:', undefinedProjects);
    }
    
    // Final safety check: filter out any invalid rows before rendering
    const validProjectRows = allProjectRows.filter(row => {
        if (!row || !row.project) {
            console.error('🚨 ERROR: Invalid row filtered out:', row);
            return false;
        }
        return true;
    });
    
    console.log('🎯 DEBUG: Total valid rows for rendering:', validProjectRows.length);
    console.log('🎯 DEBUG: Filtered out invalid rows:', allProjectRows.length - validProjectRows.length);

    // Check if CaTAlyst is in the processed rows (use validProjectRows now)
    const catalystRow = validProjectRows.find(r => r?.project?.PROJECT_NAME === 'CaTAlyst');
    if (catalystRow) {
        console.log('🎯 CATALYST DEBUG: CaTAlyst found in processed rows!', catalystRow);
    } else {
        console.log('🎯 CATALYST DEBUG: CaTAlyst NOT found in processed rows');
    }

    return (
        <div className="w-full flex flex-col relative bg-gray-50">
            {/* Header */}
            <div className="bg-gray-50 border-b border-gray-200 px-3 py-2">
                {/* Navigation Breadcrumb */}
                {(onNavigateUp || onBackToProgram) && (
                    <div className="flex items-center space-x-2 mb-2">
                        <button
                            onClick={onNavigateUp || onBackToProgram}
                            className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 transition-colors text-sm"
                        >
                            <span>←</span>
                            <span>Back to Program</span>
                        </button>
                        <span className="text-gray-400">→</span>
                        <span className="text-gray-600 text-sm">
                            {selectedSubProgramName ? `${selectedSubProgramName} (Sub-Program)` : 'Sub-Program View'}
                        </span>
                    </div>
                )}
                
                {/* Two-row Header Layout to prevent overflow */}
                <div className="space-y-2">
                    {/* First Row: Controls and Pagination */}
                    <div className="flex items-center justify-between">
                        {/* Left: Controls */}
                        <div className="flex items-center space-x-3">
                            <label className="font-medium text-sm">Program:</label>
                            <select
                                value={selectedProgram}
                                onChange={handleProgramChange}
                                className="border border-gray-300 rounded px-2 py-1 bg-white text-sm min-w-[120px]"
                            >
                                {programNames.map((name) => (
                                    <option key={name} value={name}>
                                        {name}
                                    </option>
                                ))}
                            </select>

                            <TimelineViewDropdown
                                selectedView={timelineView}
                                onViewChange={setTimelineView}
                            />
                        </div>

                        {/* Center: Pagination */}
                        <div className="flex-1 flex justify-center min-w-0">
                            <PaginationControls
                                currentPage={currentPage}
                                totalItems={actualTotalItems}
                                itemsPerPage={ITEMS_PER_PAGE}
                                onPageChange={handlePageChangeCallback}
                                compact={true}
                            />
                        </div>

                        {/* Right: Spacer to maintain layout balance */}
                        <div className="w-40"></div>
                    </div>

                    {/* Second Row: Legends */}
                    <div className="flex items-center justify-center gap-8">
                        {/* Phase Legend */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-700">Phases:</span>
                            <div className="flex gap-2">
                                {['Initiate', 'Evaluate', 'Develop', 'Deploy', 'Sustain', 'Close'].map((phase) => (
                                    <div key={phase} className="flex items-center gap-1">
                                        <div
                                            className="w-2 h-2 rounded"
                                            style={{ backgroundColor: PHASE_COLORS[phase] || PHASE_COLORS['Unphased'] }}
                                        ></div>
                                        <span className="text-xs text-gray-600">{phase}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Milestone Legend */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-600">Milestones:</span>
                            <div className="flex gap-2">
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

            {/* Gantt Chart */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Panel - Project Names */}
                <div 
                    ref={leftPanelRef}
                    className="bg-white border-r border-gray-200 flex-shrink-0 overflow-y-auto"
                    style={{ minWidth: `${constants.LABEL_WIDTH}px`, width: 'auto', position: 'sticky', left: 0, zIndex: 10, height: '100%' }}
                    onScroll={handleLeftPanelScroll}
                >
                    {/* Header */}
                    <div 
                        className="bg-gray-100 border-b border-gray-200 flex items-center px-4 font-semibold text-gray-700"
                        style={{ height: '40px', fontSize: constants.FONT_SIZE }}
                    >
                        Project / Phase
                    </div>
                    
                    {/* Project Rows */}
                    <div style={{ position: 'relative', height: (() => {
                        // Calculate total height using ultra-compact logic (like Program page)
                        const topMargin = Math.round(8 * 1.0); // Match Program page's topMargin
                        const ultraMinimalSpacing = Math.round(1 * 1.0); // Ultra-minimal spacing
                        return validProjectRows.reduce((total, p) => {
                            const projectEndDate = p.hasPhases
                                ? (p.phases && p.phases.length > 0 ? p.phases.reduce((latest, phase) => {
                                    if (!phase || !phase.TASK_FINISH) return latest;
                                    const phaseEndDate = parseDate(phase.TASK_FINISH);
                                    return (phaseEndDate && (!latest || phaseEndDate > latest)) ? phaseEndDate : latest;
                                }, null) : null)
                                : parseDate(p.singleProjectPhase?.TASK_FINISH);
                            
                            const processedMilestones = processMilestonesForProject(
                                p.project.milestones || [],
                                startDate,
                                monthWidth,
                                projectEndDate
                            );
                            
                            return total + calculateBarHeight(p, processedMilestones, monthWidth) + ultraMinimalSpacing;
                        }, topMargin); // Remove extra bottom padding for compactness
                    })() }}>
                        {validProjectRows.map((row, index) => {
                            // Safety check for undefined rows
                            if (!row || !row.project) {
                                console.error(`🚨 ERROR: Undefined row at index ${index}:`, row);
                                return null;
                            }
                            
                                            // Process milestones first to get accurate height calculation
                                            const projectEndDate = row.hasPhases 
                                                ? (row.phases && row.phases.length > 0 ? row.phases.reduce((latest, phase) => {
                                                    if (!phase || !phase.TASK_FINISH) return latest;
                                                    const phaseEndDate = parseDate(phase.TASK_FINISH);
                                                    return (phaseEndDate && (!latest || phaseEndDate > latest)) ? phaseEndDate : latest;
                                                }, null) : null)
                                                : parseDate(row.singleProjectPhase?.TASK_FINISH); // For projects without phases
                            
                            const processedMilestones = processMilestonesForProject(
                                row.project.milestones || [], // Fix: Use milestones from project object
                                startDate,
                                monthWidth,
                                projectEndDate
                            );
                            
                            const rowHeight = calculateBarHeight(row, processedMilestones, monthWidth);
                            const ultraMinimalSpacing = Math.round(1 * 1.0); // Ultra-minimal spacing like Program page
                            const topMargin = Math.round(8 * 1.0); // Match Program page's topMargin for proper positioning
                            
                            // Calculate cumulative Y offset to match Gantt bars with ultra-compact spacing
                            const yOffset = validProjectRows
                                .slice(0, index)
                                .reduce((total, p, i) => {
                                    // Process milestones for previous rows for accurate height calculation
                                    const prevProjectEndDate = p.hasPhases
                                        ? (p.phases && p.phases.length > 0 ? p.phases.reduce((latest, phase) => {
                                            if (!phase || !phase.TASK_FINISH) return latest;
                                            const phaseEndDate = parseDate(phase.TASK_FINISH);
                                            return (phaseEndDate && (!latest || phaseEndDate > latest)) ? phaseEndDate : latest;
                                        }, null) : null)
                                        : parseDate(p.singleProjectPhase?.TASK_FINISH); // For projects without phases
                                    
                                    const prevProcessedMilestones = processMilestonesForProject(
                                        p.project.milestones || [], // Fix: Use milestones from project object
                                        startDate,
                                        monthWidth,
                                        prevProjectEndDate,
                                        startDate,
                                        endDate
                                    );
                                    
                                    return total + calculateBarHeight(p, prevProcessedMilestones, monthWidth) + ultraMinimalSpacing;
                                }, topMargin);
                            
                            return (
                                <div
                                    key={`${row.project.PROJECT_ID}-${index}`}
                                    className={`absolute flex items-start border-b border-gray-100 transition-colors ${
                                        row.isProgramHeader 
                                            ? 'bg-blue-50 border-blue-200' 
                                            : row.project.isProgram
                                                ? 'bg-gray-100'
                                                : 'bg-white hover:bg-gray-50'
                                    }`}
                                    style={{ 
                                        top: yOffset,
                                        height: `${rowHeight}px`,
                                        paddingTop: '6px', // Add top padding
                                        paddingBottom: '6px', // Add bottom padding
                                        paddingLeft: constants.TOUCH_TARGET_SIZE > 24 ? '12px' : '8px',
                                        fontSize: row.isProgramHeader ? 
                                            `calc(${constants.FONT_SIZE} * 1.1)` : 
                                            constants.FONT_SIZE,
                                        width: '100%',
                                        cursor: 'default',
                                        minHeight: constants.TOUCH_TARGET_SIZE,
                                        fontWeight: (row.project.isProgram || row.isProgramHeader) ? 600 : 'normal',
                                        textTransform: (row.project.isProgram || row.isProgramHeader) ? 'uppercase' : 'none',
                                    }}
                                >
                                    <div className="flex items-center justify-between w-full h-full">
                                        <div className="flex flex-col justify-center flex-1 py-1.5">
                                            <span 
                                                className={`pr-2 leading-tight ${
                                                    row.isProgramHeader ? 'font-bold text-blue-900' :
                                                    row.project.isProgram ? 'font-semibold text-gray-800' :
                                                    'font-medium text-gray-700'
                                                }`}
                                                title={row.project.displayName || row.project.PROJECT_NAME}
                                                style={{
                                                    wordBreak: 'break-word',
                                                    overflowWrap: 'break-word',
                                                    lineHeight: '1.2',
                                                    maxWidth: `${constants.LABEL_WIDTH - 24}px`
                                                }}
                                            >
                                                {row.project.displayName || row.project.PROJECT_NAME}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right Panel - Timeline and Gantt */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Timeline Header */}
                    <div 
                        ref={headerScrollRef}
                        className="bg-gray-100 border-b border-gray-200 overflow-x-hidden overflow-y-hidden"
                        style={{
                            width: '100%',

                            minHeight: '40px',
                            paddingTop: '10px'
                        }}
                        onScroll={handleHeaderScroll}
                    >
                        <TimelineAxis
                            startDate={startDate}
                            endDate={endDate}
                            monthWidth={monthWidth}
                            fontSize={constants.FONT_SIZE}
                            
                        />
                    </div>

                    {/* Gantt Chart Area */}
                    <div 
                        ref={scrollContainerRef}
                        className="flex-1 overflow-y-auto overflow-x-hidden"





                        onScroll={handleScroll}
                    >
                        <div style={{ width: '100%', height: (() => {
                            const topMargin = Math.round(8 * 1.0);
                            const ultraMinimalSpacing = Math.round(1 * 1.0);
                            return validProjectRows.reduce((total, p) => {
                                const projectEndDate = p.hasPhases
                                    ? (p.phases && p.phases.length > 0 ? p.phases.reduce((latest, phase) => {
                                        if (!phase || !phase.TASK_FINISH) return latest;
                                        const phaseEndDate = parseDate(phase.TASK_FINISH);
                                        return (phaseEndDate && (!latest || phaseEndDate > latest)) ? phaseEndDate : latest;
                                    }, null) : null)
                                    : parseDate(p.singleProjectPhase?.TASK_FINISH);
                                const processedMilestones = processMilestonesForProject(
                                    p.project.milestones || [],
                                    startDate,
                                    monthWidth,
                                    projectEndDate,
                                    startDate,
                                    endDate
                                );
                                return total + calculateBarHeight(p, processedMilestones, monthWidth) + ultraMinimalSpacing;
                            }, topMargin);
                        })() }}>
                            <svg 
                                key={`gantt-${selectedProgram}-${dataVersion}`} // Add key to force re-render
                                width={Math.max(800, window.innerWidth - constants.LABEL_WIDTH)}
                                height={(() => {
                                    const topMargin = Math.round(8 * 1.0);
                                    const ultraMinimalSpacing = Math.round(1 * 1.0);
                                    return validProjectRows.reduce((total, p) => {
                                        const projectEndDate = p.hasPhases
                                            ? (p.phases && p.phases.length > 0 ? p.phases.reduce((latest, phase) => {
                                                if (!phase || !phase.TASK_FINISH) return latest;
                                                const phaseEndDate = parseDate(phase.TASK_FINISH);
                                                return (phaseEndDate && (!latest || phaseEndDate > latest)) ? phaseEndDate : latest;
                                            }, null) : null)
                                            : parseDate(p.singleProjectPhase?.TASK_FINISH); // For projects without phases
                                        
                                        const processedMilestones = processMilestonesForProject(
                                            p.project.milestones || [], // Fix: Use milestones from project object
                                            startDate,
                                            monthWidth,
                                            projectEndDate,
                                            startDate,
                                            endDate
                                        );
                                        
                                        return total + calculateBarHeight(p, processedMilestones, monthWidth) + ultraMinimalSpacing;
                                    }, topMargin);
                                })()}
                            >
                                {validProjectRows.map((row, index) => {
                                    // Safety check for undefined rows
                                    if (!row || !row.project) {
                                        console.error(`🚨 ERROR: Undefined row at index ${index} in Gantt rendering:`, row);
                                        return null;
                                    }
                                    
                    // *** MODIFIED: Allow rendering Gantt bars for program headers ***
                    // Program headers now have aggregated data and should display Gantt bars
                    if (row.isProgramHeader) {
                        console.log('🎯 HIERARCHICAL: Rendering Gantt bar for program header:', row.project.displayName);
                        console.log('🎯 HIERARCHICAL: Program header has phases:', row.hasPhases, 'milestone count:', row.project.milestones?.length || 0);
                    }                                    // Process milestones first to get accurate height calculation
                                    const projectEndDate = row.hasPhases 
                                        ? (row.phases && row.phases.length > 0 ? row.phases.reduce((latest, phase) => {
                                            if (!phase || !phase.TASK_FINISH) return latest;
                                            const phaseEndDate = parseDate(phase.TASK_FINISH);
                                            return (phaseEndDate && (!latest || phaseEndDate > latest)) ? phaseEndDate : latest;
                                        }, null) : null)
                                        : parseDate(row.singleProjectPhase?.TASK_FINISH); // For projects without phases
                                    
                                    const processedMilestones = processMilestonesForProject(
                                        row.project.milestones || [], // Fix: Use milestones from project object
                                        startDate,
                                        constants.MONTH_WIDTH,
                                        projectEndDate,
                                        startDate,
                                        endDate
                                    );

                                    // Calculate proper Y offset using Program page's ultra-compact logic
                                    const ultraMinimalSpacing = Math.round(1 * 1.0); // Ultra-minimal spacing like Program page
                                    const topMargin = Math.round(8 * 1.0); // Match Program page's topMargin
                                    const yOffset = validProjectRows
                                        .slice(0, index)
                                        .reduce((total, p, i) => {
                                            // Process milestones for each previous row for accurate height calculation
                                            const prevProjectEndDate = p.hasPhases
                                                ? (p.phases && p.phases.length > 0 ? p.phases.reduce((latest, phase) => {
                                                    if (!phase || !phase.TASK_FINISH) return latest;
                                                    const phaseEndDate = parseDate(phase.TASK_FINISH);
                                                    return (phaseEndDate && (!latest || phaseEndDate > latest)) ? phaseEndDate : latest;
                                                }, null) : null)
                                                : parseDate(p.singleProjectPhase?.TASK_FINISH); // For projects without phases
                                            
                                            const prevProcessedMilestones = processMilestonesForProject(
                                                p.project.milestones || [], // Fix: Use milestones from project object
                                                startDate,
                                                constants.MONTH_WIDTH,
                                                prevProjectEndDate,
                                                startDate,
                                                endDate
                                            );
                                            
                                            return total + calculateBarHeight(p, prevProcessedMilestones) + ultraMinimalSpacing;
                                        }, topMargin);
                                    
                                    // Calculate the project's total height
                                    const totalHeight = calculateBarHeight(row, processedMilestones, monthWidth);
                                    
                                    // COMPACT LAYOUT: Position Gantt bar using Program page's exact logic
                                    const milestoneLabelHeights = calculateMilestoneLabelHeight(processedMilestones, monthWidth);
                                    
                                    // Position Gantt bar exactly like Program page
                                    const ganttBarY = yOffset + Math.round(8 * 1.0) + milestoneLabelHeights.above;
                                    const milestoneY = ganttBarY + Math.round(constants.BASE_BAR_HEIGHT / 2); // Center milestones with bar
                                    
                                    return (
                                        <g key={`${row.PROJECT_ID}-${index}`}>
                                            {/* Render phase bars OR single project bar based on renderType */}
                                            {row.renderType === 'phases' ? (
                                                // Project WITH phases - render multiple colored phase bars
                                                (() => {
                                                    console.log('🎨 RENDERING PHASES for:', row.PROJECT_NAME, 'with', row.phases.length, 'phases');
                                                    return row.phases
                                                        .filter(phase => phase && phase.TASK_NAME && phase.TASK_START && phase.TASK_FINISH) // Filter out null phases and ensure dates exist
                                                        .map((phase, phaseIndex) => {
                                                        console.log('🔍 Phase parsing for', row.PROJECT_NAME, '- Phase:', phase.TASK_NAME, 'Raw dates:', phase.TASK_START, 'to', phase.TASK_FINISH);
                                                        
                                                        const phaseStartDate = parseDate(phase.TASK_START);
                                                        const phaseEndDate = parseDate(phase.TASK_FINISH);
                                                        
                                                        console.log('🔍 Parsed dates for', phase.TASK_NAME, ':', phaseStartDate, 'to', phaseEndDate);
                                                        
                                                        if (!phaseStartDate || !phaseEndDate) {
                                                            console.log('🚨 Invalid phase dates:', phase.TASK_NAME, 'START:', phase.TASK_START, 'END:', phase.TASK_FINISH, 'Parsed START:', phaseStartDate, 'Parsed END:', phaseEndDate);
                                                            return null;
                                                        }
                                                        
                                                        const x = calculatePosition(phaseStartDate, startDate, monthWidth);
                                                        const width = calculatePosition(phaseEndDate, startDate, monthWidth) - x;
                                                        
                                                        // Get the phase color based on the task name
                                                        const phaseColor = PHASE_COLORS[phase.TASK_NAME] || PHASE_COLORS['Unphased'];
                                                        
                                                        console.log('🎨 Phase rendering:', phase.TASK_NAME, 'color:', phaseColor, 'dates:', phase.TASK_START, 'to', phase.TASK_FINISH, 'x:', x, 'width:', width);
                                                        
                                                        return (
                                                            <GanttBar
                                                                key={`${row.PROJECT_ID}-${phase.TASK_NAME}-${phaseIndex}`}
                                                                data={{
                                                                    ...phase,
                                                                    id: `${row.PROJECT_ID}-${phase.TASK_NAME}`,
                                                                    name: `${row.PROJECT_NAME} - ${phase.TASK_NAME}`
                                                                }}
                                                                startX={x}
                                                                y={ganttBarY}
                                                                width={width}
                                                                label={`${phase.TASK_NAME}`}
                                                                status={phase.INV_OVERALL_STATUS || row.STATUS}
                                                                color={phaseColor}
                                                                touchTargetSize={constants.TOUCH_TARGET_SIZE}
                                                                fontSize={constants.FONT_SIZE}
                                                                isMobile={false}
                                                                                                                            />
                                                        );
                                                    });
                                                })()
                                            ) : (
                                                // Project WITHOUT phases OR marked as "Unphased" - render single bar
                                                (() => {
                                                    console.log('🎨 RENDERING SINGLE BAR for:', row.PROJECT_NAME, 'renderType:', row.renderType);
                                                    console.log('🎨 Single bar data:', row.singleProjectPhase);
                                                    
                                                    // CRITICAL FIX: Add comprehensive safety checks
                                                    if (!row.singleProjectPhase || 
                                                        !row.singleProjectPhase.TASK_START || 
                                                        !row.singleProjectPhase.TASK_FINISH) {
                                                        console.warn('🚨 Skipping single bar - missing singleProjectPhase data:', row.PROJECT_NAME);
                                                        return null;
                                                    }
                                                    
                                                    const projectStartDate = parseDate(row.singleProjectPhase.TASK_START);
                                                    const projectEndDate = parseDate(row.singleProjectPhase.TASK_FINISH);
                                                    
                                                    if (!projectStartDate || !projectEndDate) {
                                                        console.log('🚨 Invalid project dates:', row.PROJECT_NAME, 'START:', row.singleProjectPhase.TASK_START, 'END:', row.singleProjectPhase.TASK_FINISH, 'Parsed START:', projectStartDate, 'Parsed END:', projectEndDate);
                                                        return null;
                                                    }
                                                    
                                                    const x = calculatePosition(projectStartDate, startDate, monthWidth);
                                                    const width = calculatePosition(projectEndDate, startDate, monthWidth) - x;
                                                    
                                                    // Choose color based on render type
                                                    let barColor;
                                                    if (row.renderType === 'unphased') {
                                                        barColor = PHASE_COLORS['Unphased']; // Grey for unphased
                                                    } else {
                                                        barColor = STATUS_COLORS[row.STATUS] || STATUS_COLORS['Grey']; // Status color for projects
                                                    }
                                                    
                                                    console.log('🎨 Single bar rendering:', row.renderType, 'color:', barColor, 'dates:', row.singleProjectPhase.TASK_START, 'to', row.singleProjectPhase.TASK_FINISH, 'x:', x, 'width:', width);
                                                    
                                                    return (
                                                        <GanttBar
                                                            key={`${row.PROJECT_ID}-project`}
                                                            data={{
                                                                ...row.singleProjectPhase,
                                                                id: row.PROJECT_ID,
                                                                name: row.PROJECT_NAME
                                                            }}
                                                            startX={x}
                                                            y={ganttBarY}
                                                            width={width}
                                                            label={row.singleProjectPhase.TASK_NAME}
                                                            status={row.singleProjectPhase.INV_OVERALL_STATUS || row.STATUS}
                                                            color={barColor}
                                                            touchTargetSize={constants.TOUCH_TARGET_SIZE}
                                                            fontSize={constants.FONT_SIZE}
                                                            isMobile={false}
                                                                                                                    />
                                                    );
                                                })()
                                            )}
                                            
                                            {/* Render Milestones using already processed milestone data */}
                                            {/* CRITICAL FIX: Don't render milestones for program headers */}
                                            {!row.isProgramHeader && processedMilestones.map((milestone, milestoneIndex) => {
                                                // COMPACT LAYOUT: Use the same milestoneY as calculated above for consistency
                                                // This positions milestones to align with the compact Gantt bar position
                                                
                                                return (
                                                    <MilestoneMarker
                                                        key={`milestone-${row.PROJECT_ID}-${milestoneIndex}`}
                                                        x={milestone.x}
                                                        y={milestoneY}
                                                        complete={milestone.status}
                                                        label={milestone.label}
                                                        isSG3={milestone.isSG3}
                                                        labelPosition={milestone.labelPosition}
                                                        shouldWrapText={milestone.shouldWrapText}
                                                        isGrouped={milestone.isGrouped}
                                                        groupLabels={milestone.groupLabels || []}
                                                        fullLabel={milestone.fullLabel}
                                                        hasAdjacentMilestones={milestone.hasAdjacentMilestones}
                                                        showLabel={milestone.showLabel}
                                                        fontSize={constants.MILESTONE_FONT_SIZE}
                                                        isMobile={false}
                                                                                                                isMonthlyGrouped={milestone.isMonthlyGrouped}
                                                        monthlyLabels={milestone.monthlyLabels || []}
                                                        horizontalLabel={milestone.horizontalLabel || ''}
                                                        verticalLabels={milestone.verticalLabels || []}
                                                        monthKey={milestone.monthKey || ''}
                                                        shouldRenderShape={milestone.shouldRenderShape}
                                                        allMilestonesInProject={milestone.allMilestonesInProject || row.project.milestones || []}
                                                        currentMilestoneDate={milestone.currentMilestoneDate || milestone.date}
                                                    />
                                                );
                                            })}
                                        </g>
                                    );
                                })}
                            </svg>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        );
    };

    // Main component return with new loading UI
    return (
        <div className="w-full flex flex-col relative">
            {/* Status Badge - Top Right (same as Program GanttChart) */}
            {loading && (
                <div className="absolute top-4 right-4 z-50 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium shadow-md flex items-center gap-2">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                    Loading data...
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded m-4">
                    <h3 className="font-semibold">Error Loading Sub-Program Data</h3>
                    <p>{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* No Data Found State */}
            {!loading && !error && data && processedData.length === 0 && (
                <div className="bg-yellow-50 border border-yellow-400 text-yellow-700 px-4 py-3 rounded m-4">
                    <h3 className="font-semibold">No Sub-Program Data Found</h3>
                    <p>
                        {selectedProgram === 'All'
                            ? 'No sub-program data is available for the current selection.'
                            : `No sub-programs found for "${selectedProgram}". Try selecting "All" or a different program.`
                        }
                    </p>
                    <button
                        onClick={() => setSelectedProgram('All')}
                        className="mt-2 bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700"
                    >
                        Show All Programs
                    </button>
                </div>
            )}

            {/* Show content even while loading (same pattern as Program GanttChart) */}
            {(!loading || (data && data.projects)) && !error && renderGanttChart()}
            
            {/* Bottom Pagination Controls */}
            {(!loading || (data && data.projects)) && !error && actualTotalItems > 0 && (
                <div className="p-4 bg-white border-t border-gray-200">
                    <PaginationControls
                        currentPage={currentPage}
                        totalItems={actualTotalItems}
                        itemsPerPage={ITEMS_PER_PAGE}
                        onPageChange={handlePageChangeCallback}
                    />
                </div>
            )}
        </div>
    );
};

export default SubProgramGanttChart;
