// Legacy service file - functions moved to utils folder
// This file is kept for backward compatibility with other components

// API function to fetch unified backend data and process for portfolio view
const processPortfolioDataFromAPI = async () => {
    try {
        
        // Fetch unified dataset from backend
        const response = await fetch('/api/data');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        
        if (result.status !== 'success') {
            throw new Error(result.message || 'Failed to fetch unified roadmap data');
        }
        
        // Extract both hierarchy and investment data from structured response
        const hierarchyData = result.data.hierarchy;
        const investmentData = result.data.investment;

        // CORRECT APPROACH: Group Portfolio records by their parent PTF IDs
        // Portfolio structure: Portfolio records (PROG000xxx) are grouped by COE_ROADMAP_PARENT_ID (PTF000xxx)
        const portfolioRecords = hierarchyData.filter(item => 
            item.COE_ROADMAP_TYPE === 'Portfolio'
        );

        // Group portfolios by their parent PTF ID
        const portfolioGroups = {};
        portfolioRecords.forEach(portfolio => {
            const ptfId = portfolio.COE_ROADMAP_PARENT_ID;
            if (!portfolioGroups[ptfId]) {
                portfolioGroups[ptfId] = [];
            }
            portfolioGroups[ptfId].push(portfolio);
        });
        
        const ptfIds = Object.keys(portfolioGroups);
        
        // Initialize processed data array
        const processedData = [];
        
        // STEP 1: Process each PTF group as a portfolio (with isDrillable: false by default)
        for (const ptfId of ptfIds) {
            const portfoliosInGroup = portfolioGroups[ptfId];
            
            // Process each portfolio in this PTF group
            for (const portfolio of portfoliosInGroup) {
                
                // Find investment data for this portfolio
                const investment = investmentData.find(inv => 
                    inv.INV_EXT_ID === portfolio.CHILD_ID && inv.ROADMAP_ELEMENT === 'Investment'
                );
                
                // Find milestones for this portfolio
                const milestones = investmentData
                    .filter(inv => 
                        inv.INV_EXT_ID === portfolio.CHILD_ID && 
                        inv.ROADMAP_ELEMENT && 
                        inv.ROADMAP_ELEMENT.includes('Milestones')
                    )
                    .map(milestone => ({
                        date: milestone.TASK_START,
                        status: milestone.MILESTONE_STATUS,
                        label: milestone.TASK_NAME,
                        isSG3: milestone.ROADMAP_ELEMENT.includes('SG3') || milestone.TASK_NAME.includes('SG3')
                    }));

                // Process portfolio item (with or without investment data)
                const portfolioData = {
                    id: portfolio.CHILD_ID,
                    name: investment ? investment.INVESTMENT_NAME : portfolio.CHILD_NAME, // Use portfolio name if no investment
                    parentId: ptfId, // Use PTF ID as parent
                    parentName: portfolio.COE_ROADMAP_PARENT_NAME, // Use the actual parent name from hierarchy
                    startDate: investment ? investment.TASK_START : null, // No timeline if no investment
                    endDate: investment ? investment.TASK_FINISH : null,
                    status: investment ? investment.INV_OVERALL_STATUS : 'No Investment Data',
                    sortOrder: investment ? (investment.SortOrder || 0) : 0,
                    isProgram: true, // Keep consistent with program data structure
                    milestones,
                    hasInvestmentData: !!investment, // Flag to indicate if we have timeline data
                    isDrillable: false // STEP 1: Default to false
                };
                
                processedData.push(portfolioData);
            }
        }
        
        // STEP 2: Two-Pass Processing - Determine isDrillable based on program relationships
        // Get all program parent IDs from hierarchy data
        const programParentIds = new Set(
            hierarchyData
                .filter(item => item.COE_ROADMAP_TYPE === 'Program' || item.COE_ROADMAP_TYPE === 'SubProgram')
                .map(item => item.COE_ROADMAP_PARENT_ID)
                .filter(Boolean) // Remove null/undefined values
        );
        
        
        // Update isDrillable flag for portfolios that have child programs
        processedData.forEach(portfolio => {
            if (programParentIds.has(portfolio.id)) {
                portfolio.isDrillable = true;
            }
        });
        
        // If you need to inspect processedData, do so here (e.g., for debugging)
        return processedData;
        
    } catch (error) {
        console.error('❌ Failed to load portfolio data:', error);
        throw error;
    }
};

// Export the portfolio function for compatibility
export const processPortfolioData = processPortfolioDataFromAPI;

// API function to fetch unified backend data and process for program view
const processProgramDataFromAPI = async (selectedPortfolioId = null) => {
    try {
        
        // Fetch unified dataset from backend
        const response = await fetch('/api/data');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        
        if (result.status !== 'success') {
            throw new Error(result.message || 'Failed to fetch unified roadmap data');
        }
        
        // Extract both hierarchy and investment data from structured response
        const hierarchyData = result.data.hierarchy;
        const investmentData = result.data.investment;



        // Filter hierarchy for Program and SubProgram data
        const programTypeData = hierarchyData.filter(item => 
            item.COE_ROADMAP_TYPE === 'Program' || item.COE_ROADMAP_TYPE === 'SubProgram'
        );


        // If a specific portfolio is selected, filter to show only its programs
        let filteredData = programTypeData;
        if (selectedPortfolioId) {
            
            // Find programs that belong to the selected portfolio
            filteredData = programTypeData.filter(item => 
                item.COE_ROADMAP_PARENT_ID === selectedPortfolioId ||
                programTypeData.some(parent => 
                    parent.CHILD_ID === item.COE_ROADMAP_PARENT_ID && 
                    parent.COE_ROADMAP_PARENT_ID === selectedPortfolioId
                )
            );
        } else {
            // No portfolio filter applied - showing all programs
        }

        // Build parent-child hierarchy
        const processedData = [];
        
        // Find all parent programs (where COE_ROADMAP_PARENT_ID === CHILD_ID)
        const parentPrograms = filteredData.filter(item => 
            item.COE_ROADMAP_PARENT_ID === item.CHILD_ID && item.COE_ROADMAP_TYPE === 'Program'
        );
        
        for (const parentProgram of parentPrograms) {
            // Find investment data for this program
            const investment = investmentData.find(inv => 
                inv.INV_EXT_ID === parentProgram.CHILD_ID && inv.ROADMAP_ELEMENT === 'Investment'
            );
            
            // Find milestones for this program
            const milestones = investmentData
                .filter(inv => 
                    inv.INV_EXT_ID === parentProgram.CHILD_ID && 
                    inv.ROADMAP_ELEMENT && 
                    inv.ROADMAP_ELEMENT.includes('Milestones')
                )
                .map(milestone => ({
                    date: milestone.TASK_START,
                    status: milestone.MILESTONE_STATUS,
                    label: milestone.TASK_NAME,
                    isSG3: milestone.ROADMAP_ELEMENT.includes('SG3') || milestone.TASK_NAME.includes('SG3')
                }));

            // Process parent program
            const parentData = {
                id: parentProgram.CHILD_ID,
                name: investment ? investment.INVESTMENT_NAME : (parentProgram.COE_ROADMAP_PARENT_NAME || parentProgram.CHILD_NAME),
                parentId: parentProgram.CHILD_ID,
                parentName: parentProgram.COE_ROADMAP_PARENT_NAME,
                startDate: investment ? investment.TASK_START : parentProgram.COE_ROADMAP_START_DATE,
                endDate: investment ? investment.TASK_FINISH : parentProgram.COE_ROADMAP_END_DATE,
                status: investment ? investment.INV_OVERALL_STATUS : parentProgram.COE_ROADMAP_STATUS,
                sortOrder: investment ? investment.SortOrder || 0 : 0,
                isProgram: true,
                milestones
            };
            
            processedData.push(parentData);
            
            // Find and process children (projects under this program)
            const children = filteredData.filter(item => 
                item.COE_ROADMAP_PARENT_ID === parentProgram.CHILD_ID && 
                item.CHILD_ID !== parentProgram.CHILD_ID
            );
            
            for (const child of children) {
                // Find investment data for this child project
                const childInvestment = investmentData.find(inv => 
                    inv.INV_EXT_ID === child.CHILD_ID && inv.ROADMAP_ELEMENT === 'Investment'
                );
                
                // Find milestones for this child project
                const childMilestones = investmentData
                    .filter(inv => 
                        inv.INV_EXT_ID === child.CHILD_ID && 
                        inv.ROADMAP_ELEMENT && 
                        inv.ROADMAP_ELEMENT.includes('Milestones')
                    )
                    .map(milestone => ({
                        date: milestone.TASK_START,
                        status: milestone.MILESTONE_STATUS,
                        label: milestone.TASK_NAME,
                        isSG3: milestone.ROADMAP_ELEMENT.includes('SG3') || milestone.TASK_NAME.includes('SG3')
                    }));

                const childData = {
                    id: child.CHILD_ID,
                    name: childInvestment ? childInvestment.INVESTMENT_NAME : child.CHILD_NAME,
                    parentId: parentProgram.CHILD_ID,
                    parentName: parentProgram.COE_ROADMAP_PARENT_NAME,
                    startDate: childInvestment ? childInvestment.TASK_START : child.COE_ROADMAP_START_DATE,
                    endDate: childInvestment ? childInvestment.TASK_FINISH : child.COE_ROADMAP_END_DATE,
                    status: childInvestment ? childInvestment.INV_OVERALL_STATUS : child.COE_ROADMAP_STATUS,
                    sortOrder: childInvestment ? childInvestment.SortOrder || 0 : 0,
                    isProgram: false,
                    milestones: childMilestones
                };
                
                processedData.push(childData);
            }
        }
        
        // Sort to ensure proper hierarchy: Programs first, then their children
        const sortedData = processedData.sort((a, b) => {
            // First, group by parent program
            if (a.isProgram && b.isProgram) {
                // Both are programs, sort by sortOrder then name
                const sortOrderA = a.sortOrder || 0;
                const sortOrderB = b.sortOrder || 0;
                if (sortOrderA !== sortOrderB) {
                    return sortOrderA - sortOrderB;
                }
                return a.name.localeCompare(b.name);
            }
            
            // If one is a program and other is not, check if they're related
            if (a.isProgram && !b.isProgram) {
                // If b is a child of a, then a should come first
                if (b.parentId === a.id) {
                    return -1; // a (program) comes before b (child)
                }
                // Otherwise sort by sortOrder/name
                return (a.sortOrder || 0) - (b.sortOrder || 0) || a.name.localeCompare(b.name);
            }
            
            if (!a.isProgram && b.isProgram) {
                // If a is a child of b, then b should come first
                if (a.parentId === b.id) {
                    return 1; // b (program) comes before a (child)
                }
                // Otherwise sort by sortOrder/name
                return (a.sortOrder || 0) - (b.sortOrder || 0) || a.name.localeCompare(b.name);
            }
            
            // Both are children - group them by their parent program
            if (a.parentId !== b.parentId) {
                // Different parents - sort by parent program order
                return a.parentId.localeCompare(b.parentId);
            }
            
            // Same parent - sort by sortOrder then name
            const sortOrderA = a.sortOrder || 0;
            const sortOrderB = b.sortOrder || 0;
            if (sortOrderA !== sortOrderB) {
                return sortOrderA - sortOrderB;
            }
            return a.name.localeCompare(b.name);
        });
        
        return sortedData;
        
    } catch (error) {
        console.error('❌ Failed to load program data:', error);
        throw error;
    }
};

// Export the program function
export const processProgramData = processProgramDataFromAPI;

// API function to fetch unified backend data and process for sub-program view
const processSubProgramDataFromAPI = async (selectedProgramId = null) => {
    try {

        
        // Fetch unified dataset from backend
        const response = await fetch('/api/data');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        
        if (result.status !== 'success') {
            throw new Error(result.message || 'Failed to fetch unified roadmap data');
        }
        
        // Extract both hierarchy and investment data from structured response
        const hierarchyData = result.data.hierarchy;
        const investmentData = result.data.investment;



        // Filter hierarchy for SubProgram data (note: 'Sub-Program' with hyphen in actual data)
        const subProgramTypeData = hierarchyData.filter(item => 
            item.COE_ROADMAP_TYPE === 'Sub-Program'
        );


        // Build simplified data structure for SubProgramGanttChart component
        const projects = [];
        const milestones = [];

        // Process each sub-program
        subProgramTypeData.forEach(subProgram => {
            const projectId = subProgram.CHILD_ID;
            
            // Find investment data for this sub-program
            const projectInvestments = investmentData.filter(inv => 
                inv.INV_EXT_ID === projectId
            );
            
            if (projectInvestments.length > 0) {
                // Get basic project info
                const projectInfo = projectInvestments.find(inv => inv.ROADMAP_ELEMENT === 'Investment') || projectInvestments[0];
                
                // Get phase data
                const phaseData = projectInvestments.filter(inv => 
                    inv.ROADMAP_ELEMENT === 'Phases' && inv.TASK_NAME
                );
                
                // Get milestone data (SG3 milestones)
                const milestoneData = projectInvestments.filter(inv => 
                    (inv.ROADMAP_ELEMENT === 'Milestones - Other' || inv.ROADMAP_ELEMENT === 'Milestones - Deployment') &&
                    inv.TASK_NAME?.toLowerCase().includes('sg3')
                );
                
                // Find parent program name from hierarchy
                const parentProgramName = subProgram.COE_ROADMAP_PARENT_NAME || 
                                        projectInfo.INV_FUNCTION || 
                                        'Unassigned';
                
                // Add to projects array
                projects.push({
                    PROJECT_ID: projectId,
                    PROJECT_NAME: projectInfo.INVESTMENT_NAME || subProgram.CHILD_NAME,
                    START_DATE: projectInfo.TASK_START,
                    END_DATE: projectInfo.TASK_FINISH,
                    STATUS: projectInfo.INV_OVERALL_STATUS,
                    COE_ROADMAP_PARENT_NAME: parentProgramName, // Add parent program name for filtering
                    INV_FUNCTION: projectInfo.INV_FUNCTION, // Also keep function for additional filtering
                    isSubProgram: true,
                    phaseData: phaseData,
                    milestones: milestoneData
                });
                
                // Add milestones to separate milestones array
                milestoneData.forEach(milestone => {
                    milestones.push({
                        PROJECT_ID: projectId,
                        MILESTONE_DATE: milestone.TASK_START,
                        MILESTONE_TYPE: 'SG3',
                        MILESTONE_NAME: milestone.TASK_NAME,
                        MILESTONE_STATUS: milestone.MILESTONE_STATUS
                    });
                });
            }
        });
        
        return { projects, milestones };
        
        // If no Sub-Program hierarchy found, return empty structure
        if (subProgramTypeData.length === 0) {

            return { projects: [], milestones: [] };
        }

        return { projects, milestones };
        
    } catch (error) {
        console.error('❌ Failed to load sub-program data:', error);
        throw error;
    }
};

export const processSubProgramData = processSubProgramDataFromAPI;

/**
 * Fetches investment data from Flask endpoint
 * @returns {Array} Investment data from the API
 */
const fetchInvestmentData = async () => {
    try {

        
        // Use the same endpoint as Portfolio and Program charts
        const response = await fetch('/api/data');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        
        if (result.status !== 'success') {
            throw new Error(result.message || 'Failed to fetch unified roadmap data');
        }
        
        // Extract investment data from the structured response
        const investmentData = result.data.investment;

        
        return investmentData;
        
    } catch (error) {
        console.error('❌ Failed to fetch investment data:', error);
        throw error;
    }
};

/**
 * DEBUG FUNCTION: Analyzes all Supply Chain data
 * @returns {Object} Detailed analysis of Supply Chain records
 */
export const debugSupplyChainData = async () => {
    try {

        
        // Fetch all investment data
        const investmentData = await fetchInvestmentData();

        
        // Find all Supply Chain records
        const allSupplyChain = investmentData.filter(item => item.INV_FUNCTION === 'Supply Chain');

        
        // Group by INV_EXT_ID
        const supplyChainGroups = {};
        allSupplyChain.forEach(item => {
            if (!supplyChainGroups[item.INV_EXT_ID]) {
                supplyChainGroups[item.INV_EXT_ID] = [];
            }
            supplyChainGroups[item.INV_EXT_ID].push(item);
        });
        

        
        // Analyze each project
        Object.keys(supplyChainGroups).forEach(projectId => {
            const projectRecords = supplyChainGroups[projectId];
            const investmentRecord = projectRecords.find(r => r.ROADMAP_ELEMENT === 'Investment');
            







            
            // Check if this would pass processRegionData filters
            const hasInvestmentRecord = !!investmentRecord;
            const hasMarket = investmentRecord?.INV_MARKET && investmentRecord.INV_MARKET.trim() !== '';
            const isCorrectType = investmentRecord && ["Non-Clarity item", "Project", "Programs"].includes(investmentRecord.CLRTY_INV_TYPE);
            




        });
        
        return {
            totalRecords: investmentData.length,
            supplyChainRecords: allSupplyChain.length,
            uniqueProjects: Object.keys(supplyChainGroups).length,
            projectDetails: supplyChainGroups
        };
        
    } catch (error) {
        console.error('❌ Error in debugSupplyChainData:', error);
        throw error;
    }
};

/**
 * Processes investment data for Region Roadmap
 * @param {Object} filters - Filter criteria {region, market, function, tier}
 * @returns {Array} Processed data ready for the Region Gantt chart
 */
export const processRegionData = async (filters = {}) => {
    try {

        
        // Fetch investment data from API
        const investmentData = await fetchInvestmentData();
        
        // 1. Filter to only show records of specific types
        const projectData = investmentData.filter(item =>
            ["Non-Clarity item", "Project", "Programs"].includes(item.CLRTY_INV_TYPE)
        );

        
        // Debug: Check Supply Chain records specifically
        const supplyChainRecords = projectData.filter(item => item.INV_FUNCTION === 'Supply Chain');



        // 2. Group all records for each project by its unique ID
        const projectGroups = {};
        projectData.forEach(item => {
            if (!projectGroups[item.INV_EXT_ID]) {
                projectGroups[item.INV_EXT_ID] = [];
            }
            projectGroups[item.INV_EXT_ID].push(item);
        });


        const processedProjects = [];

        Object.keys(projectGroups).forEach(projectId => {
            const projectItems = projectGroups[projectId];

            // Filter out records without INV_MARKET
            const itemsWithMarket = projectItems.filter(item => 
                item.INV_MARKET && item.INV_MARKET.trim() !== ''
            );
            
            if (itemsWithMarket.length === 0) {
                return; // Skip projects without market data
            }

            // 3. Find the main investment record to get project metadata
            const mainRecord = itemsWithMarket.find(item =>
                item.ROADMAP_ELEMENT === "Investment"
            );

            if (!mainRecord) {
                return; // Skip if no main investment record is found
            }

            // 4. Parse the market string to get region and market
            const parseMarket = (invMarket) => {
                if (!invMarket) return { region: '', market: '' };
                const parts = invMarket.split('/');
                return {
                    region: parts[0] || '',
                    market: parts[1] || ''
                };
            };
            const { region, market } = parseMarket(mainRecord.INV_MARKET);

            // 5. Apply the user-selected filters
            const beforeFilterCount = processedProjects.length;
            
            if (filters.region && filters.region !== 'All' && region !== filters.region) {

                return;
            }
            if (filters.market && filters.market !== 'All' && market !== filters.market) {

                return;
            }
            if (filters.function && filters.function !== 'All' && mainRecord.INV_FUNCTION !== filters.function) {

                return;
            }
            if (filters.tier && filters.tier !== 'All' && mainRecord.INV_TIER?.toString() !== filters.tier) {

                return;
            }
            


            // --- If a project passes the filters, process its details ---

            // Get phase data
            const phaseRecords = itemsWithMarket.filter(item =>
                item.ROADMAP_ELEMENT === "Phases" &&
                item.TASK_NAME &&
                ['Initiate', 'Evaluate', 'Develop', 'Deploy', 'Sustain', 'Close'].includes(item.TASK_NAME)
            );

            const isUnphased = phaseRecords.length === 0;
            let phases = [];
            let projectStart = mainRecord.TASK_START;
            let projectEnd = mainRecord.TASK_FINISH;

            if (!isUnphased) {
                phases = phaseRecords
                    .sort((a, b) => new Date(a.TASK_START) - new Date(b.TASK_START))
                    .map(phase => ({
                        name: phase.TASK_NAME,
                        startDate: phase.TASK_START,
                        endDate: phase.TASK_FINISH
                    }));

                // Recalculate overall project timeline from its phases
                if (phases.length > 0) {
                    projectStart = phases[0].startDate;
                    projectEnd = phases[phases.length - 1].endDate;
                }
            }

            // 6. Filter for SG3 milestones ONLY from Milestones - Deployment
            const milestones = itemsWithMarket
                .filter(item =>
                    item.ROADMAP_ELEMENT === "Milestones - Deployment" &&
                    item.TASK_START &&
                    item.TASK_NAME?.toLowerCase().includes('sg3') // Only SG3 milestones
                )
                .map(milestone => ({
                    date: milestone.TASK_START,
                    status: milestone.MILESTONE_STATUS || 'Pending',
                    label: milestone.TASK_NAME,
                    type: milestone.ROADMAP_ELEMENT,
                    isSG3: true // Mark as SG3
                }))
                .sort((a, b) => new Date(a.date) - new Date(b.date));

            // 7. Assemble the final, clean project object
            processedProjects.push({
                id: projectId,
                name: mainRecord.INVESTMENT_NAME,
                region,
                market,
                function: mainRecord.INV_FUNCTION || '',
                tier: mainRecord.INV_TIER?.toString() || '',
                startDate: projectStart,
                endDate: projectEnd,
                status: mainRecord.INV_OVERALL_STATUS,
                isUnphased,
                phases,
                milestones
            });
        });



        // 8. Return the final list, sorted by name
        return processedProjects.sort((a, b) => a.name.localeCompare(b.name));

    } catch (error) {
        console.error('❌ Error processing region data:', error);
        return [];
    }
};

/**
 * Gets filter options for Region Roadmap
 * @returns {Object} Available filter options {regions, markets, functions, tiers}
 */
export const getRegionFilterOptions = async () => {
    try {

        
        // Fetch investment data from API
        const investmentData = await fetchInvestmentData();
        
        // Filter to only show records of specific types with market data
        const projectData = investmentData.filter(item =>
            ["Non-Clarity item", "Project", "Programs"].includes(item.CLRTY_INV_TYPE) &&
            item.ROADMAP_ELEMENT === "Investment" &&
            item.INV_MARKET && item.INV_MARKET.trim() !== ''
        );
        


        // Extract unique values for each filter type
        const regions = new Set();
        const markets = new Set();
        const functions = new Set();
        const tiers = new Set();

        projectData.forEach(item => {
            // Parse market to get region and market
            if (item.INV_MARKET) {
                const parts = item.INV_MARKET.split('/');
                const region = parts[0];
                const market = parts[1];
                
                if (region) regions.add(region);
                if (market) markets.add(market);
            }
            
            if (item.INV_FUNCTION) functions.add(item.INV_FUNCTION);
            if (item.INV_TIER) tiers.add(item.INV_TIER.toString());
        });

        const options = {
            regions: Array.from(regions).sort(),
            markets: Array.from(markets).sort(),
            functions: Array.from(functions).sort(),
            tiers: Array.from(tiers).sort()
        };

        return options;
    } catch (error) {
        console.error('❌ Error loading region filter options:', error);
        return {
            regions: [],
            markets: [],
            functions: [],
            tiers: []
        };
    }
};
