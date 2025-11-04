/**
 * Progressive API Service for PMO Portfolio
 * 
 * This service replaces the old "fetch all data" approach with progressive loading.
 * Instead of loading hundreds of thousands of records at once, data is loaded
 * on-demand with pagination and filtering.
 * 
 * Key Benefits:
 * - Fast initial page loads (50 items vs 100,000+ items)
 * - Reduced memory usage in browser
 * - Better user experience with loading states
 * - Secure parameterized queries prevent SQL injection
 * - Efficient database queries with WHERE clauses and pagination
 */

// Base API configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

/**
 * Generic API call handler with error handling and timeout
 */
async function apiCall(endpoint, params = {}, timeoutMs = 30000) {
    try {
        const url = new URL(`${API_BASE_URL}${endpoint}`);
        
        // Add query parameters
        Object.keys(params).forEach(key => {
            if (params[key] !== null && params[key] !== undefined) {
                url.searchParams.append(key, params[key]);
            }
        });

        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        
        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.status !== 'success') {
            throw new Error(data.message || 'API request failed');
        }
        return data;
        
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error(`Request timeout after ${timeoutMs/1000} seconds - Backend may be slow or unresponsive`);
        }
        throw error;
    }
}

/**
 * Process raw API data into the format expected by the frontend components
 */
function processRawApiData(apiResponse) {
    
    if (!apiResponse?.data?.hierarchy || !apiResponse?.data?.investment) {
        return [];
    }

    const hierarchyData = apiResponse.data.hierarchy;
    const investmentData = apiResponse.data.investment;


    // OPTIMIZATION: Use Maps for O(1) lookups instead of O(n) Array.filter
    // This reduces complexity from O(n²) to O(n) for milestone processing
    // Research: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map
    
    // Get all Investment records (not Phases or Milestones)
    const investmentRecords = investmentData.filter(inv => inv.ROADMAP_ELEMENT === 'Investment');
    
    // Build milestone lookup map ONCE (O(n) instead of O(n²))
    const milestoneMap = new Map();
    investmentData.forEach(inv => {
        if (inv.ROADMAP_ELEMENT && inv.ROADMAP_ELEMENT.includes('Milestones')) {
            if (!milestoneMap.has(inv.INV_EXT_ID)) {
                milestoneMap.set(inv.INV_EXT_ID, []);
            }
            
            // CRITICAL FIX: The full milestone label is in INVESTMENT_NAME, not TASK_NAME
            const fullMilestoneLabel = inv.INVESTMENT_NAME || inv.TASK_NAME || 'Milestone';
           
            milestoneMap.get(inv.INV_EXT_ID).push({
                date: inv.TASK_START,
                MILESTONE_DATE: inv.TASK_START,
                MILESTONE_NAME: fullMilestoneLabel,
                TASK_NAME: fullMilestoneLabel,
                status: inv.MILESTONE_STATUS,
                STATUS: inv.MILESTONE_STATUS,
                label: fullMilestoneLabel,
                isSG3: inv.ROADMAP_ELEMENT?.includes('SG3') || inv.TASK_NAME?.includes('SG3')
            });
        }
    });
    
    const processedData = [];
    
    // Process each investment record with O(1) milestone lookup
    investmentRecords.forEach(investment => {
        
        // O(1) lookup instead of O(n) filter!
        const milestones = milestoneMap.get(investment.INV_EXT_ID) || [];


        // Create portfolio item using investment data (compatible with PortfolioGanttChart.jsx)
        const portfolioData = {
            id: investment.INV_EXT_ID,
            name: investment.INVESTMENT_NAME,
            parentId: `FUNC_${investment.INV_FUNCTION || 'Unknown'}`, // Group by function
            parentName: investment.INV_FUNCTION || 'Unknown Function',
            startDate: investment.TASK_START,
            endDate: investment.TASK_FINISH,
            status: investment.INV_OVERALL_STATUS || 'Grey',
            sortOrder: 0,
            isProgram: true, // Keep consistent with original structure
            milestones,
            hasInvestmentData: true, // All these records have investment data
            isDrillable: false, // Investment level records are not drillable
            // Additional fields for compatibility
            region: investment.INV_MARKET,
            market: investment.INV_MARKET,
            function: investment.INV_FUNCTION,
            tier: investment.INV_TIER
        };
        
        processedData.push(portfolioData);
    });
    
    
    return processedData;
}

/**
 * Process portfolio data from full dataset using hierarchy-based approach
 * This matches the logic from apiDataService.js to ensure consistency
 */
function processPortfolioDataFromFullDataset(apiResponse) {
    
    if (!apiResponse?.data?.hierarchy || !apiResponse?.data?.investment) {
        return [];
    }

    const hierarchyData = apiResponse.data.hierarchy;
    const investmentData = apiResponse.data.investment;


    // Use the same approach as apiDataService.js - filter for Portfolio records
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
    
    // Process each PTF group as a portfolio
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
                .map(milestone => {
                    
                    
                    return {
                        date: milestone.TASK_START,
                        status: milestone.MILESTONE_STATUS,
                        label: milestone.TASK_NAME,
                        isSG3: milestone.ROADMAP_ELEMENT.includes('SG3') || milestone.TASK_NAME.includes('SG3')
                    };
                });

            // Create portfolio item (matching apiDataService.js structure)
            const portfolioData = {
                id: portfolio.CHILD_ID,
                name: investment ? investment.INVESTMENT_NAME : portfolio.CHILD_NAME,
                parentId: ptfId,
                parentName: portfolio.COE_ROADMAP_PARENT_NAME,
                startDate: investment ? investment.TASK_START : null,
                endDate: investment ? investment.TASK_FINISH : null,
                status: investment ? investment.INV_OVERALL_STATUS : 'No Investment Data',
                sortOrder: investment ? (investment.SortOrder || 0) : 0,
                isProgram: true,
                milestones,
                hasInvestmentData: !!investment,
                isDrillable: false
            };
            
            
            processedData.push(portfolioData);
        }
    }
    
    // Determine isDrillable based on program relationships
    const programParentIds = new Set(
        hierarchyData
            .filter(item => item.COE_ROADMAP_TYPE === 'Program' || item.COE_ROADMAP_TYPE === 'SubProgram')
            .map(item => item.COE_ROADMAP_PARENT_ID)
            .filter(Boolean)
    );
    
    // Update isDrillable flag for portfolios that have child programs
    processedData.forEach(portfolio => {
        if (programParentIds.has(portfolio.id)) {
            portfolio.isDrillable = true;
        }
    });
    
    
    
    
    return processedData;
}

/**
 * Process program data from full dataset using the CORRECTED logic from apiDataService.js
 * This matches the original apiDataService.js approach but fixes the bugs
 */
function processProgramDataFromFullDataset(apiResponse, portfolioId) {
    
    if (!apiResponse?.data?.hierarchy || !apiResponse?.data?.investment) {
        return [];
    }

    const hierarchyData = apiResponse.data.hierarchy;
    const investmentData = apiResponse.data.investment;


    // STEP 1: Filter hierarchy for Program and Sub-Program data (corrected from apiDataService.js)
    const programTypeData = hierarchyData.filter(item => 
        item.COE_ROADMAP_TYPE === 'Program' || item.COE_ROADMAP_TYPE === 'Sub-Program'
    );
    

    // STEP 2: Filter for the selected portfolio using the original apiDataService.js logic
    let filteredData = programTypeData;
    if (portfolioId) {
        // Original logic from apiDataService.js lines 151-156
        filteredData = programTypeData.filter(item => 
            item.COE_ROADMAP_PARENT_ID === portfolioId ||
            programTypeData.some(parent => 
                parent.CHILD_ID === item.COE_ROADMAP_PARENT_ID && 
                parent.COE_ROADMAP_PARENT_ID === portfolioId
            )
        );
    }
    

    // STEP 3: Look for self-referencing parent programs (original logic)
    const parentPrograms = filteredData.filter(item => 
        item.COE_ROADMAP_PARENT_ID === item.CHILD_ID && item.COE_ROADMAP_TYPE === 'Program'
    );
    

    const processedData = [];
    
    if (parentPrograms.length > 0) {
        // STEP 4: Process using original hierarchy logic
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
                .map(milestone => {
                    // CRITICAL FIX: Use INVESTMENT_NAME for full label (contains full text)
                    // TASK_NAME only contains "SG3" for non-Clarity deployments
                    const fullLabel = milestone.INVESTMENT_NAME || milestone.TASK_NAME;
                    return {
                        date: milestone.TASK_START,
                        status: milestone.MILESTONE_STATUS,
                        label: fullLabel,
                        isSG3: milestone.ROADMAP_ELEMENT.includes('SG3') || milestone.TASK_NAME.includes('SG3')
                    };
                });

            // Process parent program
            const parentData = {
                id: parentProgram.CHILD_ID,
                name: investment ? investment.INVESTMENT_NAME : (parentProgram.COE_ROADMAP_PARENT_NAME || parentProgram.CHILD_NAME),
                parentId: parentProgram.CHILD_ID,
                parentName: parentProgram.COE_ROADMAP_PARENT_NAME,
                startDate: investment ? investment.TASK_START : null,
                endDate: investment ? investment.TASK_FINISH : null,
                status: investment ? investment.INV_OVERALL_STATUS : 'No Investment Data',
                sortOrder: investment ? (investment.SortOrder || 0) : 0,
                isProgram: true,
                milestones,
                hasInvestmentData: !!investment,
                isDrillable: false
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
                    startDate: childInvestment ? childInvestment.TASK_START : null,
                    endDate: childInvestment ? childInvestment.TASK_FINISH : null,
                    status: childInvestment ? childInvestment.INV_OVERALL_STATUS : 'No Investment Data',
                    sortOrder: childInvestment ? (childInvestment.SortOrder || 0) : 0,
                    isProgram: child.COE_ROADMAP_TYPE === 'Program',
                    isSubProgram: child.COE_ROADMAP_TYPE === 'Sub-Program',
                    milestones: childMilestones,
                    hasInvestmentData: !!childInvestment,
                    isDrillable: false
                };
                
                processedData.push(childData);
            }
        }
    } else {
        // FALLBACK: No self-referencing programs found, use all filtered programs as flat list
        
        for (const program of filteredData) {
            // Find investment data for this program
            const investment = investmentData.find(inv => 
                inv.INV_EXT_ID === program.CHILD_ID && inv.ROADMAP_ELEMENT === 'Investment'
            );
            
            // Find milestones for this program
            const milestones = investmentData
                .filter(inv => 
                    inv.INV_EXT_ID === program.CHILD_ID && 
                    inv.ROADMAP_ELEMENT && 
                    inv.ROADMAP_ELEMENT.includes('Milestones')
                )
                .map(milestone => {
                    // CRITICAL FIX: Use INVESTMENT_NAME for full label (contains full text)
                    // TASK_NAME only contains "SG3" for non-Clarity deployments
                    const fullLabel = milestone.INVESTMENT_NAME || milestone.TASK_NAME;
                    return {
                        date: milestone.TASK_START,
                        status: milestone.MILESTONE_STATUS,
                        label: fullLabel,
                        isSG3: milestone.ROADMAP_ELEMENT.includes('SG3') || milestone.TASK_NAME.includes('SG3')
                    };
                });

            // Create program item
            const programData = {
                id: program.CHILD_ID,
                name: investment ? investment.INVESTMENT_NAME : program.CHILD_NAME,
                parentId: program.COE_ROADMAP_PARENT_ID,
                parentName: program.COE_ROADMAP_PARENT_NAME,
                startDate: investment ? investment.TASK_START : null,
                endDate: investment ? investment.TASK_FINISH : null,
                status: investment ? investment.INV_OVERALL_STATUS : 'No Investment Data',
                sortOrder: investment ? (investment.SortOrder || 0) : 0,
                isProgram: program.COE_ROADMAP_TYPE === 'Program',
                isSubProgram: program.COE_ROADMAP_TYPE === 'Sub-Program',
                milestones,
                hasInvestmentData: !!investment,
                isDrillable: false
            };
            
            processedData.push(programData);
        }
    }
    
    
    return processedData;
}

/**
 * Process portfolio data from the optimized /api/data/portfolio endpoint
 * This endpoint returns clean, structured data instead of raw database records
 * CRITICAL FIX: Process ALL portfolio hierarchy records, with or without investment data
 */
function processPortfolioDataFromOptimizedEndpoint(apiResponse) {
    try {
        if (!apiResponse?.data?.hierarchy) {
            return [];
        }

        const hierarchyData = apiResponse.data.hierarchy || [];
        const investmentData = apiResponse.data.investment || [];

        // Create maps for quick lookups
        const investmentMap = new Map();
        investmentData.forEach(inv => {
            const key = `${inv.INV_EXT_ID}_${inv.ROADMAP_ELEMENT}`;
            if (!investmentMap.has(key)) {
                investmentMap.set(key, []);
            }
            investmentMap.get(key).push(inv);
        });

        // CRITICAL FIX: Start with hierarchy records (guaranteed portfolios) and enrich with investment data
        const processedData = hierarchyData.map(hierarchyRecord => {
            // Find main investment record for this portfolio
            const mainInvestmentKey = `${hierarchyRecord.CHILD_ID}_Investment`;
            const mainInvestment = investmentMap.get(mainInvestmentKey)?.[0];
            
            // Find milestones for this portfolio (both Deployment and Other milestones)
            const deploymentMilestonesKey = `${hierarchyRecord.CHILD_ID}_Milestones - Deployment`;
            const otherMilestonesKey = `${hierarchyRecord.CHILD_ID}_Milestones - Other`;
            const deploymentMilestones = investmentMap.get(deploymentMilestonesKey) || [];
            const otherMilestones = investmentMap.get(otherMilestonesKey) || [];
            
            // Combine all milestone types and filter for relevant ones
            const allMilestones = [...deploymentMilestones, ...otherMilestones];
            
            
            
            const milestones = allMilestones
                .filter(milestone => 
                    milestone.TASK_NAME && 
                    milestone.TASK_START && 
                    (milestone.ROADMAP_ELEMENT?.includes('Milestones - Deployment') || 
                     milestone.TASK_NAME.toLowerCase().includes('sg3'))
                )
                .map(milestone => ({
                    date: milestone.TASK_START,
                    status: milestone.MILESTONE_STATUS || 'Pending',
                    label: milestone.TASK_NAME,
                    type: milestone.ROADMAP_ELEMENT,
                    isSG3: milestone.TASK_NAME?.toLowerCase().includes('sg3'),
                    isDeploy: milestone.TASK_NAME?.toLowerCase().includes('deploy')
                }));

            const portfolioItem = {
                id: hierarchyRecord.CHILD_ID,
                parentId: hierarchyRecord.PARENT_ID || hierarchyRecord.COE_ROADMAP_PARENT_ID || null,
                name: hierarchyRecord.CHILD_NAME || 'Unnamed Portfolio',
                startDate: mainInvestment?.TASK_START || null, // May be null if no investment data
                endDate: mainInvestment?.TASK_FINISH || null,   // May be null if no investment data
                status: mainInvestment?.INV_OVERALL_STATUS || hierarchyRecord.CHILD_STATUS || 'Unknown',
                type: 'Portfolio',
                hasInvestmentData: !!mainInvestment,
                milestones: milestones,
                
                // Additional fields for compatibility
                CHILD_ID: hierarchyRecord.CHILD_ID,
                PARENT_ID: hierarchyRecord.PARENT_ID,
                CHILD_NAME: hierarchyRecord.CHILD_NAME,
                CHILD_START: mainInvestment?.TASK_START || null,
                CHILD_FINISH: mainInvestment?.TASK_FINISH || null,
                CHILD_STATUS: mainInvestment?.INV_OVERALL_STATUS || hierarchyRecord.CHILD_STATUS,
                COE_ROADMAP_PARENT_ID: hierarchyRecord.COE_ROADMAP_PARENT_ID,
                COE_ROADMAP_PARENT_NAME: hierarchyRecord.COE_ROADMAP_PARENT_NAME, // CRITICAL: Include parent name for dropdown
                COE_ROADMAP_TYPE: hierarchyRecord.COE_ROADMAP_TYPE
            };

            return portfolioItem;
        });

        
        return processedData;

    } catch (error) {
        return [];
    }
}

// Cache for full dataset to avoid repeated API calls
let portfolioDataCache = null;
let cacheTimestamp = null;
// Cache for program data
let programDataCache = new Map(); // Key: portfolioId, Value: processed program data
let programCacheTimestamp = new Map(); // Key: portfolioId, Value: timestamp
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Progressive Portfolio Data Fetching with Smart Caching
 * 
 * This function implements smart caching to avoid repeated full dataset fetches:
 * 1. First call: Fetches complete dataset from /api/data and caches it
 * 2. Subsequent calls: Uses cached data for pagination (much faster)
 * 3. Cache expires after 5 minutes to ensure data freshness
 */
export async function fetchPortfolioData(page = 1, limit = 50, options = {}) {
    const {
        portfolioId = null,
        status = null,
        forceRefresh = false,
        useParallel = true  // NEW: Enable parallel execution by default
    } = options;

    // OPTIMIZATION: Use parallel endpoint for ~33% faster response
    // Falls back to sequential endpoint if parallel fails
    
    try {
        // Try parallel endpoint first (optimized for performance)
        if (useParallel) {
            try {
                const response = await apiCall('/api/data/portfolio-parallel', {
                    page: page,
                    limit: limit,
                    portfolioId: portfolioId,
                    status: status
                });
                
                // Process response
                
                // Process the structured response from the optimized parallel endpoint
                const processedData = processPortfolioDataFromOptimizedEndpoint(response);
                
                return {
                    data: processedData,
                    hasMore: response.data?.pagination?.has_more || false,
                    totalCount: response.data?.pagination?.total_items || processedData.length,
                    fromCache: false,
                    mode: 'parallel'
                };
            } catch (parallelError) {
                console.warn('⚠️ Parallel endpoint failed, falling back to sequential:', parallelError.message);
                // Fall through to sequential endpoint
            }
        }
        
        const response = await apiCall('/api/data/portfolio', {
            page: page,
            limit: limit,
            portfolioId: portfolioId,
            status: status
        });
        
        // Process the structured response from the optimized endpoint
        const processedData = processPortfolioDataFromOptimizedEndpoint(response);
        
        return {
            data: processedData,
            hasMore: response.data?.pagination?.has_more || false,
            totalCount: response.data?.pagination?.total_items || processedData.length,
            fromCache: false,
            mode: 'sequential'
        };
    } catch (error) {
        throw error;
    }
}

/**
 * Clear the portfolio data cache
 * Use this when you need to force fresh data (e.g., after data updates)
 */
export function clearPortfolioDataCache() {
    portfolioDataCache = null;
    cacheTimestamp = null;
}

/**
 * Clear the program data cache
 * Use this when you need to force fresh program data
 */
export function clearProgramDataCache(portfolioId = null) {
    if (portfolioId) {
        programDataCache.delete(portfolioId);
        programCacheTimestamp.delete(portfolioId);
    } else {
        programDataCache.clear();
        programCacheTimestamp.clear();
    }
}

/**
 * Program Data Fetching using Optimized /api/data/program Endpoint
 * 
 * This function uses the new optimized program endpoint that follows the same
 * successful pattern as the portfolio endpoint:
 * 1. Backend fetches Programs for the specific portfolio with pagination
 * 2. Backend gets ALL investment data (not filtered)
 * 3. Frontend processes and matches the data correctly
 */
/**
 * Program Data Fetching - EXACT REPLICATION of apiDataService.js logic
 * This function replicates processProgramDataFromAPI() from apiDataService.js
 * to ensure 100% compatibility with ProgramGanttChart.jsx
 */
export async function fetchProgramData(selectedPortfolioId = null, options = {}) {
    const { useParallel = true, page = 1, limit = 5000 } = options;
    
    try {
        // Try parallel endpoint first (optimized for performance)
        if (useParallel) {
            try {
                const result = await apiCall('/api/data/program-parallel', {
                    portfolioId: selectedPortfolioId,
                    page: page,
                    limit: limit
                }, 60000); // 60 seconds timeout
                
                // Process result
                
                if (result.status !== 'success') {
                    throw new Error(result.message || 'Failed to fetch program data');
                }
                
                // Process the response
                const processedData = processProgramDataFromOptimizedEndpoint(result, selectedPortfolioId);
                
                return {
                    data: processedData,
                    totalCount: processedData.length,
                    page: page,
                    limit: limit,
                    hasMore: result.data?.pagination?.has_more || false,
                    fromCache: false,
                    mode: 'parallel'
                };
            } catch (parallelError) {
                console.warn('⚠️ Parallel endpoint failed, falling back to sequential:', parallelError.message);
                // Fall through to sequential endpoint
            }
        }
        
        // Fallback to sequential endpoint
        const result = await apiCall('/api/data/program', {
            portfolioId: selectedPortfolioId,
            page: page,
            limit: limit
        }, 60000);
        
        if (result.status !== 'success') {
            throw new Error(result.message || 'Failed to fetch program data');
        }
        
        // Process the response
        const processedData = processProgramDataFromOptimizedEndpoint(result, selectedPortfolioId);
        
        return {
            data: processedData,
            totalCount: processedData.length,
            page: page,
            limit: limit,
            hasMore: result.data?.pagination?.has_more || false,
            fromCache: false,
            mode: 'sequential'
        };
    } catch (error) {
        throw error;
    }
}

/**
 * Helper function to process program data from optimized endpoint
 */
function processProgramDataFromOptimizedEndpoint(result, selectedPortfolioId) {
    // Extract both hierarchy and investment data from structured response
    const hierarchyData = result.data.hierarchy;
    const investmentData = result.data.investment;

    // EXACT LOGIC from apiDataService.js processProgramDataFromAPI()

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
                .map(milestone => {
                    // CRITICAL FIX: Use INVESTMENT_NAME for full label (contains full text)
                    // TASK_NAME only contains "SG3" for non-Clarity deployments
                    const fullLabel = milestone.INVESTMENT_NAME || milestone.TASK_NAME;
                    return {
                        date: milestone.TASK_START,
                        status: milestone.MILESTONE_STATUS,
                        label: fullLabel,
                        isSG3: milestone.ROADMAP_ELEMENT.includes('SG3') || milestone.TASK_NAME.includes('SG3')
                    };
                });

            // Process parent program (EXACT structure from apiDataService.js)
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
        
        // Sort to ensure proper hierarchy: Programs first, then their children (EXACT sorting from apiDataService.js)
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
        
        // Return the sorted data
        return sortedData;
}

/**
 * Process program data using ADAPTED logic for the actual data structure
 * This handles the real data format we're receiving from the API
 */
function processProgramDataUsingApiDataServiceLogic(apiResponse, selectedPortfolioId = null) {
    
    if (!apiResponse?.data?.hierarchy || !apiResponse?.data?.investment) {
        return [];
    }

    const hierarchyData = apiResponse.data.hierarchy;
    const investmentData = apiResponse.data.investment;


    // STEP 1: Filter hierarchy for Program and SubProgram data
    const programTypeData = hierarchyData.filter(item => 
        item.COE_ROADMAP_TYPE === 'Program' || item.COE_ROADMAP_TYPE === 'SubProgram'
    );


    // STEP 2: Apply portfolio filtering if specified
    let filteredData = programTypeData;
    if (selectedPortfolioId) {
        filteredData = programTypeData.filter(item => 
            item.COE_ROADMAP_PARENT_ID === selectedPortfolioId ||
            programTypeData.some(parent => 
                parent.CHILD_ID === item.COE_ROADMAP_PARENT_ID && 
                parent.COE_ROADMAP_PARENT_ID === selectedPortfolioId
            )
        );
    } 

    const processedData = [];
    
    // ADAPTED APPROACH: Since we don't have self-referencing programs,
    // treat each program record as a displayable item
    
    for (const program of filteredData) {
        // Look for investment data using different ROADMAP_ELEMENT values
        // Try both "Investment" and "Phases" since we see "Phases" in the data
        const investment = investmentData.find(inv => 
            inv.INV_EXT_ID === program.CHILD_ID && 
            (inv.ROADMAP_ELEMENT === 'Investment' || inv.ROADMAP_ELEMENT === 'Phases')
        );
        
        // If no direct match, try partial matching or use any investment with this ID
        const fallbackInvestment = !investment ? investmentData.find(inv => 
            inv.INV_EXT_ID === program.CHILD_ID
        ) : null;
        
        const finalInvestment = investment || fallbackInvestment;
        
        // Find milestones for this program
        const milestones = investmentData
            .filter(inv => 
                inv.INV_EXT_ID === program.CHILD_ID && 
                inv.ROADMAP_ELEMENT && 
                inv.ROADMAP_ELEMENT.includes('Milestones')
            )
            .map(milestone => ({
                date: milestone.TASK_START,
                status: milestone.MILESTONE_STATUS,
                label: milestone.TASK_NAME,
                isSG3: milestone.ROADMAP_ELEMENT?.includes('SG3') || milestone.TASK_NAME?.includes('SG3')
            }));

        // Create program item - use investment data if available, otherwise hierarchy data
        const programData = {
            id: program.CHILD_ID,
            name: finalInvestment ? finalInvestment.INVESTMENT_NAME : program.CHILD_NAME,
            parentId: program.COE_ROADMAP_PARENT_ID || program.CHILD_ID,
            parentName: program.COE_ROADMAP_PARENT_NAME || 'Unknown',
            startDate: finalInvestment ? finalInvestment.TASK_START : null,
            endDate: finalInvestment ? finalInvestment.TASK_FINISH : null,
            status: finalInvestment ? finalInvestment.INV_OVERALL_STATUS : 'No Data',
            sortOrder: finalInvestment ? (finalInvestment.SortOrder || 0) : 0,
            isProgram: program.COE_ROADMAP_TYPE === 'Program',
            milestones,
            isDrillable: false, // Will be set later based on SubProgram relationships
            hasInvestmentData: !!finalInvestment
        };

        
        processedData.push(programData);
    }
    
    // If we have no timeline data, let's create some sample items using hierarchy data
    if (processedData.length > 0 && processedData.every(item => !item.startDate)) {
        
        processedData.forEach(item => {
            // Use current date range as fallback for demonstration
            const today = new Date();
            const futureDate = new Date();
            futureDate.setMonth(today.getMonth() + 6);
            
            if (!item.startDate) {
                item.startDate = today.toISOString();
                item.endDate = futureDate.toISOString();
                item.status = 'Demo Data';
            }
        });
    }
    
    // Sort by name for now
    const sortedData = processedData.sort((a, b) => {
        return a.name.localeCompare(b.name);
    });
    
    
    return sortedData;
}

/**
 * Process program data from optimized API response
 * This follows the exact same pattern as the original apiDataService.js program processing
 */
function processProgramDataFromOptimizedAPI(apiResponse, selectedPortfolioId) {
    
    if (!apiResponse?.data?.hierarchy || !apiResponse?.data?.investment) {
        return [];
    }

    const hierarchyData = apiResponse.data.hierarchy;
    const investmentData = apiResponse.data.investment;


    // Filter hierarchy for Program and SubProgram data (same as apiDataService.js)
    const programTypeData = hierarchyData.filter(item => 
        item.COE_ROADMAP_TYPE === 'Program' || item.COE_ROADMAP_TYPE === 'SubProgram'
    );


    // Filter for the selected portfolio using the EXACT logic from apiDataService.js (lines 151-156)
    let filteredData = programTypeData;
    if (selectedPortfolioId) {
        filteredData = programTypeData.filter(item => 
            item.COE_ROADMAP_PARENT_ID === selectedPortfolioId ||
            programTypeData.some(parent => 
                parent.CHILD_ID === item.COE_ROADMAP_PARENT_ID && 
                parent.COE_ROADMAP_PARENT_ID === selectedPortfolioId
            )
        );
    }


    // Build parent-child hierarchy (EXACT logic from apiDataService.js lines 161-165)
    const processedData = [];
    
    // Find all parent programs (where COE_ROADMAP_PARENT_ID === CHILD_ID)
    const parentPrograms = filteredData.filter(item => 
        item.COE_ROADMAP_PARENT_ID === item.CHILD_ID && item.COE_ROADMAP_TYPE === 'Program'
    );

    
    for (const parentProgram of parentPrograms) {
        // Find investment data for this program (EXACT logic from apiDataService.js)
        const investment = investmentData.find(inv => 
            inv.INV_EXT_ID === parentProgram.CHILD_ID && inv.ROADMAP_ELEMENT === 'Investment'
        );
        
        // Find milestones for this program (EXACT logic from apiDataService.js)
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

        // Process parent program (EXACT structure from apiDataService.js lines 178-190)
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
            milestones,
            isDrillable: false // Will be set later based on SubProgram relationships
        };
        
        processedData.push(parentData);
        
        // Find and process children (projects under this program) - EXACT logic from apiDataService.js lines 194-196
        const children = filteredData.filter(item => 
            item.COE_ROADMAP_PARENT_ID === parentProgram.CHILD_ID && 
            item.CHILD_ID !== parentProgram.CHILD_ID
        );
        
        for (const child of children) {
            // Find investment data for this child project (EXACT logic from apiDataService.js)
            const childInvestment = investmentData.find(inv => 
                inv.INV_EXT_ID === child.CHILD_ID && inv.ROADMAP_ELEMENT === 'Investment'
            );
            
            // Find milestones for this child project (EXACT logic from apiDataService.js)
            const childMilestones = investmentData
                .filter(inv => 
                    inv.INV_EXT_ID === child.CHILD_ID && 
                    inv.ROADMAP_ELEMENT && 
                    inv.ROADMAP_ELEMENT.includes('Milestones')
                )
                .map(milestone => {
                    // CRITICAL FIX: Use INVESTMENT_NAME for full label (contains full text)
                    // TASK_NAME only contains "SG3" for non-Clarity deployments
                    const fullLabel = milestone.INVESTMENT_NAME || milestone.TASK_NAME;
                    return {
                        date: milestone.TASK_START,
                        status: milestone.MILESTONE_STATUS,
                        label: fullLabel,
                        isSG3: milestone.ROADMAP_ELEMENT.includes('SG3') || milestone.TASK_NAME.includes('SG3')
                    };
                });

            // Process child data (EXACT structure from apiDataService.js lines 217-229)
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
                milestones: childMilestones,
                isDrillable: false // SubPrograms can be drillable based on whether they have sub-projects
            };
            
            processedData.push(childData);
        }
    }
    
    // Sort to ensure proper hierarchy: Programs first, then their children (EXACT logic from apiDataService.js lines 235-270)
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
}

/**
 * Process program data from API response - Modified to use investment data directly
 * Since we don't have actual Program/SubProgram hierarchy data, we'll show investment records as programs
 */
function processProgramDataFromApi(apiResponse, selectedPortfolioId = null) {
    
    if (!apiResponse?.data?.investment) {
        return [];
    }

    const investmentData = apiResponse.data.investment;

    // For program view, use investment records directly
    // Group investments by their function or market to create a program-like hierarchy
    const investmentRecords = investmentData.filter(inv => 
        inv.ROADMAP_ELEMENT === 'Investment' &&
        inv.INV_EXT_ID && 
        inv.INVESTMENT_NAME
    );




    // Process each investment record as a program item
    const processedData = [];
    
    for (const investment of filteredData) {
                
        // Find milestones for this investment
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

        // Process parent program (EXACT SAME STRUCTURE as apiDataService.js)
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
            milestones,
            hasInvestmentData: !!investment
        };
        
        processedData.push(parentData);
        
        // Find and process children (projects under this program)
        const children = filteredData.filter(item => 
            item.COE_ROADMAP_PARENT_ID === parentProgram.CHILD_ID && 
            item.CHILD_ID !== parentProgram.CHILD_ID
        );
        
        
        for (const child of children) {
            // Find investment data for this child project (EXACT SAME LOGIC as apiDataService.js)
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
                .map(milestone => {
                    // CRITICAL FIX: Use INVESTMENT_NAME for full label (contains full text)
                    // TASK_NAME only contains "SG3" for non-Clarity deployments
                    const fullLabel = milestone.INVESTMENT_NAME || milestone.TASK_NAME;
                    return {
                        date: milestone.TASK_START,
                        status: milestone.MILESTONE_STATUS,
                        label: fullLabel,
                        isSG3: milestone.ROADMAP_ELEMENT.includes('SG3') || milestone.TASK_NAME.includes('SG3')
                    };
                });

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
                milestones: childMilestones,
                hasInvestmentData: !!childInvestment
            };
            
            processedData.push(childData);
        }
    }
    
    // Sort to ensure proper hierarchy: Programs first, then their children (EXACT SAME LOGIC as apiDataService.js)
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
}

/**
 * SubProgram Data Fetching - EXACT REPLICATION of processSubProgramData() from apiDataService.js
 * This function replicates processSubProgramDataFromAPI() from apiDataService.js
 * to ensure 100% compatibility with SubProgramGanttChartFull.jsx
 */
export async function fetchSubProgramData(selectedProgramId = null, options = {}) {
    const { useParallel = true, page = 1, limit = 1000 } = options;
    
    try {
        // Try parallel endpoint first (optimized for performance)
        if (useParallel) {
            try {
                const response = await apiCall('/api/data/subprogram-parallel', {
                    programId: selectedProgramId,
                    page: page,
                    limit: limit
                }, 120000); // 120 seconds timeout
                
                // Process response
                
                if (response.status !== 'success') {
                    throw new Error(response.message || 'Failed to fetch subprogram data');
                }
                
                // Process the response
                const processedData = processSubProgramDataFromOptimizedEndpoint(response);
                
                return {
                    data: processedData,
                    totalCount: processedData.projects?.length || 0,
                    page: page,
                    limit: limit,
                    hasMore: response.data?.pagination?.has_more || false,
                    fromCache: false,
                    mode: 'parallel'
                };
            } catch (parallelError) {
                console.warn('⚠️ Parallel endpoint failed, falling back to sequential:', parallelError.message);
                // Fall through to sequential endpoint
            }
        }
        
        
        const response = await apiCall('/api/data/subprogram', {
            programId: selectedProgramId,
            page: page,
            limit: limit
        }, 120000);
        
        if (response.status !== 'success') {
            throw new Error(response.message || 'Failed to fetch subprogram data');
        }
        
        // Process the response
        const processedData = processSubProgramDataFromOptimizedEndpoint(response);
        
        return {
            data: processedData,
            totalCount: processedData.projects?.length || 0,
            page: page,
            limit: limit,
            hasMore: response.data?.pagination?.has_more || false,
            fromCache: false,
            mode: 'sequential'
        };
    } catch (error) {
        console.error('Error fetching subprogram data:', error);
        throw error;
    }
}

/**
 * Helper function to process subprogram data from optimized endpoint
 */
function processSubProgramDataFromOptimizedEndpoint(result) {
    
    // Extract both hierarchy and investment data from structured response
    const hierarchyData = result.data.hierarchy;
    const allInvestmentData = result.data.investment;
    
    console.log(`📊 Raw data: ${hierarchyData?.length || 0} hierarchy, ${allInvestmentData?.length || 0} investment records`);
    
    if (!hierarchyData || hierarchyData.length === 0) {
        return { projects: [], milestones: [] };
    }
    
    // CRITICAL: Filter investment data to only include records matching hierarchy IDs
    // This is needed because parallel endpoint fetches ALL investment data
    const subprogramIds = hierarchyData.map(sp => sp.CHILD_ID);
    const investmentData = allInvestmentData.filter(inv => 
        subprogramIds.includes(inv.INV_EXT_ID)
    );
    

    // *** CRITICAL FIX: Filter out parent records where COE_ROADMAP_PARENT_ID == CHILD_ID ***
    // These are self-referencing records that create duplicates
    const filteredHierarchyData = hierarchyData.filter(subProgram => {
        const isParentSameAsChild = subProgram.COE_ROADMAP_PARENT_ID === subProgram.CHILD_ID;
        if (isParentSameAsChild) {
            console.log(`🚫 DUPLICATE FILTER: Excluding self-referencing record: ${subProgram.CHILD_NAME} (Parent ID = Child ID = ${subProgram.CHILD_ID})`);
        }
        return !isParentSameAsChild;
    });


        // Build simplified data structure for SubProgramGanttChart component
        const projects = [];
        const milestones = [];

        // Process each sub-program from the filtered hierarchy - NO MORE HARDCODED FALLBACKS
        filteredHierarchyData.forEach(subProgram => {
            const projectId = subProgram.CHILD_ID;
          
            
            // Find investment data for this sub-program
            const projectInvestments = investmentData.filter(inv => 
                inv.INV_EXT_ID === projectId
            );
            
            
           
            
            // If there's no investment data, create a default entry but log it
            if (projectInvestments.length === 0) {
                
                // Create default entry for projects without investment data
                projects.push({
                    PROJECT_ID: projectId,
                    PROJECT_NAME: subProgram.CHILD_NAME,
                    START_DATE: null,  // Don't use hardcoded dates
                    END_DATE: null,
                    STATUS: 'No Data',
                    COE_ROADMAP_PARENT_NAME: subProgram.COE_ROADMAP_PARENT_NAME || 'Unassigned',
                    INV_FUNCTION: subProgram.COE_ROADMAP_PARENT_NAME || 'Unassigned',
                    isSubProgram: true,
                    phaseData: [],
                    milestones: []
                });
                return; 
            }

            // Find the main investment record for overall status and dates
            // Look for ROADMAP_ELEMENT === 'Investment' with TASK_NAME === 'Start/Finish Dates'
            const mainInvestment = projectInvestments.find(inv => 
                inv.ROADMAP_ELEMENT === 'Investment' && inv.TASK_NAME === 'Start/Finish Dates'
            ) || projectInvestments.find(inv => inv.ROADMAP_ELEMENT === 'Investment') || projectInvestments[0];
            
            
            
            // Find phase data
            const phaseData = projectInvestments.filter(inv => inv.ROADMAP_ELEMENT === 'Phases' && inv.TASK_NAME);
            
            
            // Find milestone data - UPDATED: Removed SG3 filter to show ALL milestones
            const rawMilestoneData = projectInvestments.filter(inv => 
                (inv.ROADMAP_ELEMENT === 'Milestones - Other' || inv.ROADMAP_ELEMENT === 'Milestones - Deployment')
            );

            // Transform milestone data to match component expectations
            // CRITICAL FIX: The full milestone label is in INVESTMENT_NAME, not TASK_NAME
            // TASK_NAME only contains "SG3" for non-Clarity deployments, but INVESTMENT_NAME has the full text like:
            // "Case of the Future/Market: Global SG3" or "McKinsey Partnership/Market: Global SG3"
            const milestoneData = rawMilestoneData.map(milestone => {
                const fullMilestoneLabel = milestone.INVESTMENT_NAME || milestone.TASK_NAME || 'Milestone';
                
                return {
                    TASK_NAME: fullMilestoneLabel,
                    MILESTONE_NAME: fullMilestoneLabel, // Component looks for this
                    MILESTONE_DATE: milestone.TASK_START, // Component looks for this instead of TASK_START
                    TARGET_DATE: milestone.TASK_START, // Fallback property
                    STATUS: milestone.MILESTONE_STATUS || milestone.INV_OVERALL_STATUS,
                    ROADMAP_ELEMENT: milestone.ROADMAP_ELEMENT
                };
            });

            // Add to projects array using REAL data. NO MORE HARDCODED DATES.
            const projectData = {
                PROJECT_ID: projectId,
                PROJECT_NAME: mainInvestment.INVESTMENT_NAME || subProgram.CHILD_NAME,
                START_DATE: mainInvestment.TASK_START,  // Use REAL data from backend
                END_DATE: mainInvestment.TASK_FINISH,   // Use REAL data from backend
                STATUS: mainInvestment.INV_OVERALL_STATUS || 'Grey',
                COE_ROADMAP_PARENT_NAME: subProgram.COE_ROADMAP_PARENT_NAME,
                INV_FUNCTION: mainInvestment.INV_FUNCTION,
                isSubProgram: true,
                phaseData: phaseData,
                milestones: milestoneData
            };

            projects.push(projectData);

            // Add milestones to separate milestones array
            milestoneData.forEach(milestone => {
                milestones.push({
                    PROJECT_ID: projectId,
                    MILESTONE_DATE: milestone.MILESTONE_DATE, // Use MILESTONE_DATE from transformed object
                    MILESTONE_TYPE: 'SG3',
                    MILESTONE_NAME: milestone.MILESTONE_NAME,
                    MILESTONE_STATUS: milestone.STATUS
                });
            });
        });
        
        return { projects, milestones };
}

/**
 * Legacy Subprogram-level data fetching
 * Use this when a user clicks on a program to view its subprograms
 */
export async function fetchSubProgramDataLegacy(programId, options = {}) {
    if (!programId) {
        throw new Error('programId is required for fetchSubProgramData');
    }

    const {
        page = 1,
        limit = 50
    } = options;

    return apiCall('/api/data/subprogram', {
        programId,
        page,
        limit
    });
}

/**
 * Region-filtered data fetching
 * Use this for region-specific views
 * 
 * This function processes data from the new /api/data/region endpoint
 * but transforms it to match the exact format expected by RegionRoadmap.jsx
 * (same format as apiDataService.js processRegionData function)
 */
export async function fetchRegionData(region = null, options = {}) {
    const {
        useParallel = true,
        page = 1,
        limit = 1000,
        market = null,
        function: functionFilter = null,
        tier = null
    } = options;

    const params = {
        page,
        limit
    };
    
    if (region) {
        params.region = region;
    }
    
    if (market) {
        params.market = market;
    }
    
    if (functionFilter) {
        params.function = functionFilter;
    }
    
    if (tier) {
        params.tier = tier;
    }

    try {
        // Try parallel endpoint first (optimized for performance)
        if (useParallel) {
            try {
                const apiResponse = await apiCall('/api/data/region-parallel', params);
                
                // Process response
                
                // Process the raw API response
                const processedData = processRegionDataToExpectedFormat(apiResponse, { page, limit });
                
                return {
                    status: 'success',
                    data: {
                        data: processedData.data,
                        totalCount: processedData.totalCount,
                        page: processedData.page,
                        limit: processedData.limit,
                        hasMore: processedData.hasMore
                    },
                    mode: 'parallel'
                };
            } catch (parallelError) {
                console.warn('⚠️ Parallel endpoint failed, falling back to sequential:', parallelError.message);
                // Fall through to sequential endpoint
            }
        }
        
        // Fallback to sequential endpoint
        console.log(`📊 Fetching region data via SEQUENTIAL endpoint`);
        const apiResponse = await apiCall('/api/data/region', params);
        
        // Process the raw API response
        const processedData = processRegionDataToExpectedFormat(apiResponse, { page, limit });
        
        return {
            status: 'success',
            data: {
                data: processedData.data,
                totalCount: processedData.totalCount,
                page: processedData.page,
                limit: processedData.limit,
                hasMore: processedData.hasMore
            },
            mode: 'sequential'
        };
        
    } catch (error) {
        throw error;
    }
}

/**
 * Process raw API response from /api/data/region endpoint to match
 * the exact format expected by RegionRoadmap.jsx component
 * 
 * This replicates the logic from apiDataService.js processRegionData function
 */
function processRegionDataToExpectedFormat(apiResponse, paginationOptions = {}) {
    try {
        if (!apiResponse?.data?.investment) {
            return [];
        }

        const investmentData = apiResponse.data.investment;
        
        // 1. Filter to only show records of specific types (same as original logic)
        const projectData = investmentData.filter(item =>
            ["Non-Clarity item", "Project", "Programs"].includes(item.CLRTY_INV_TYPE)
        );


        // 2. Group all records for each project by its unique ID
        const projectGroups = {};
        projectData.forEach(item => {
            if (!projectGroups[item.INV_EXT_ID]) {
                projectGroups[item.INV_EXT_ID] = [];
            }
            projectGroups[item.INV_EXT_ID].push(item);
        });

        
        const processedProjects = [];
        const allProjectIds = Object.keys(projectGroups);
        

        allProjectIds.forEach((projectId, index) => {
            
            const projectItems = projectGroups[projectId];
            
            // Show what types of records we have for this project
            const recordTypes = projectItems.map(item => item.ROADMAP_ELEMENT);

            // FIXED: Don't filter out records with null/empty INV_MARKET
            // Many valid projects have null market data - we should include them
            const itemsWithMarket = projectItems; // Include ALL project items
            
            if (itemsWithMarket.length > 0) {
                const sampleMarket = itemsWithMarket[0].INV_MARKET;
            }

            // 3. FIXED: Prioritize Investment record for unphased projects to get correct project-level dates
            // Find Investment record that contains the main project dates
            let mainRecord = itemsWithMarket.find(item =>
                item.ROADMAP_ELEMENT === "Investment"
            );
            
            // If no Investment record, try to find a record with INVESTMENT_NAME (highest priority)
            if (!mainRecord) {
                mainRecord = itemsWithMarket.find(item =>
                    item.INVESTMENT_NAME && item.INVESTMENT_NAME.trim() !== ''
                );
            }
            
            // If still no record, try to find any record with TASK_NAME that's not a phase
            if (!mainRecord) {
                mainRecord = itemsWithMarket.find(item =>
                    item.TASK_NAME && 
                    item.TASK_NAME.trim() !== '' &&
                    !['Initiate', 'Evaluate', 'Develop', 'Deploy', 'Sustain', 'Close'].includes(item.TASK_NAME)
                );
            }
            
            // Last resort: use the first available record (but log a warning)
            if (!mainRecord && itemsWithMarket.length > 0) {
                mainRecord = itemsWithMarket[0];
            }

            if (mainRecord) {
                const projectName = mainRecord.INVESTMENT_NAME || mainRecord.TASK_NAME || `Project ${projectId}`;
                
            } else {
                const availableElements = [...new Set(itemsWithMarket.map(item => item.ROADMAP_ELEMENT))];
                return; // Skip if no record is found
            }

            // 4. Parse the market string to get region and market (handle null markets)
            const parseMarket = (invMarket) => {
                if (!invMarket || invMarket === null) {
                    return { region: 'Unknown', market: 'Unknown' };
                }
                if (invMarket === '-Unrecognised-') {
                    return { region: 'Unrecognised', market: 'Unrecognised' };
                }
                const parts = invMarket.split('/');
                return {
                    region: parts[0] || 'Unknown',
                    market: parts[1] || 'Unknown'
                };
            };
            const { region, market } = parseMarket(mainRecord.INV_MARKET);

            // Get phase data (same as original)
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

            // 6. Filter for SG3 milestones ONLY from Milestones - Deployment (same as original)
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

            // 7. Assemble the final project object in EXACT format expected by RegionRoadmap.jsx
            const projectName = mainRecord.INVESTMENT_NAME || mainRecord.TASK_NAME || `Project ${projectId}`;
            
            
            processedProjects.push({
                id: projectId,
                name: projectName,
                region,
                market,
                function: mainRecord.INV_FUNCTION || '',
                tier: mainRecord.INV_TIER?.toString() || '',
                startDate: projectStart,
                endDate: projectEnd,
                status: mainRecord.INV_OVERALL_STATUS || 'Unknown',
                isUnphased,
                phases,
                milestones
            });
        });

        // 8. Return the final list, sorted by name (same as original)
        const sortedResults = processedProjects.sort((a, b) => a.name.localeCompare(b.name));
        
        
        // 9. Apply CLIENT-SIDE PAGINATION for performance
        const { page = 1, limit = 25 } = paginationOptions;
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedResults = sortedResults.slice(startIndex, endIndex);
        
  
        return {
            data: paginatedResults,
            totalCount: sortedResults.length,
            page,
            limit,
            hasMore: endIndex < sortedResults.length
        };

    } catch (error) {
        return {
            data: [],
            totalCount: 0,
            page: 1,
            limit: 25,
            hasMore: false
        };
    }
}

/**
 * Get available filter options for regions
 * 
 * This function processes filter options from the new /api/data/region/filters endpoint
 * and returns them in the exact format expected by RegionRoadmap.jsx
 * (same format as apiDataService.js getRegionFilterOptions function)
 */
export async function getRegionFilterOptions() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/data/region/filters`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();        
        // Process the response to match the expected format
        if (data.status === 'success' && data.data) {
            const filterOptions = {
                regions: data.data.regions || [],
                markets: data.data.markets || [],
                functions: data.data.functions || [],
                tiers: data.data.tiers || []
            };
            
            // Return the filter options directly (not wrapped in status/data structure)
            return filterOptions;
        } else {
            throw new Error(data.message || 'Failed to fetch filter options');
        }
        
    } catch (error) {
        // Return empty filters if API call fails (same format as original)
        return {
            regions: [],
            markets: [],
            functions: [],
            tiers: []
        };
    }
}

/**
 * Debug supply chain data
 */
export async function debugSupplyChainData(limit = 10) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/data/region/debug?limit=${limit}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        throw error;
    }
}

/**
 * Cache management utilities
 */
export async function clearApiCache(pattern = null) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/cache/clear`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ pattern })
        });

        const data = await response.json();
        
        if (data.status === 'success') {
            return true;
        } else {
            return false;
        }
    } catch (error) {
        return false;
    }
}

export async function getCacheStats() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/cache/stats`);
        const data = await response.json();
        
        if (data.status === 'success') {
            return data.cache_stats;
        } else {
            throw new Error(data.message || 'Failed to get cache stats');
        }
    } catch (error) {
        throw error;
    }
}

/**
 * Legacy API support (for backward compatibility)
 * These should be phased out in favor of the progressive methods above
 */
export async function fetchPaginatedData(page = 1, pageSize = 25) {
    
    return apiCall('/api/data/paginated', {
        page,
        page_size: Math.min(pageSize, 50), // Cap to prevent performance issues
        cache: 'true'
    });
}

/**
 * Health check utility
 */
export async function checkApiHealth() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/health`);
        const data = await response.json();
        return data.status === 'healthy';
    } catch (error) {
        return false;
    }
}

/**
 * Test database connectivity
 */
export async function testDatabaseConnection() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/test-connection`);
        const data = await response.json();
        return data.status === 'success';
    } catch (error) {
        return false;
    }
}

// Export all functions as default for easy importing
export default {
    fetchPortfolioData,
    clearPortfolioDataCache,
    fetchProgramData,
    clearProgramDataCache,
    fetchSubProgramData,
    fetchSubProgramDataLegacy,
    fetchRegionData,
    getRegionFilterOptions,
    debugSupplyChainData,
    fetchPaginatedData,
    clearApiCache,
    getCacheStats,
    checkApiHealth,
    testDatabaseConnection
};
