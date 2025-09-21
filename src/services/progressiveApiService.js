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
 * Generic API call handler with error handling
 */
async function apiCall(endpoint, params = {}) {
    try {
        const url = new URL(`${API_BASE_URL}${endpoint}`);
        
        // Add query parameters
        Object.keys(params).forEach(key => {
            if (params[key] !== null && params[key] !== undefined) {
                url.searchParams.append(key, params[key]);
            }
        });

        console.log(`🔍 API Call: ${url.toString()}`);
        
        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.status !== 'success') {
            throw new Error(data.message || 'API request failed');
        }

        console.log(`✅ API Success: ${endpoint}`, {
            hierarchyCount: data.data?.hierarchy?.length || 0,
            investmentCount: data.data?.investment?.length || 0,
            pagination: data.data?.pagination,
            cached: data.cache_info?.cached
        });

        return data;
        
    } catch (error) {
        console.error(`❌ API Error: ${endpoint}`, error);
        throw error;
    }
}

/**
 * Process raw API data into the format expected by the frontend components
 */
function processRawApiData(apiResponse) {
    console.log('🔄 Processing API response:', apiResponse);
    
    if (!apiResponse?.data?.hierarchy || !apiResponse?.data?.investment) {
        console.warn('Invalid API response structure:', apiResponse);
        return [];
    }

    const hierarchyData = apiResponse.data.hierarchy;
    const investmentData = apiResponse.data.investment;

    console.log('📊 Data counts - Hierarchy:', hierarchyData.length, 'Investment:', investmentData.length);

    // NEW APPROACH: Use investment records directly to create displayable portfolio items
    // This gives us records that actually have timeline data for Gantt charts
    
    // Get all Investment records (not Phases or Milestones)
    const investmentRecords = investmentData.filter(inv => inv.ROADMAP_ELEMENT === 'Investment');
    console.log('📈 Investment records found:', investmentRecords.length);
    
    const processedData = [];
    
    // Process each investment record
    investmentRecords.forEach(investment => {
        console.log('🔄 Processing investment:', investment.INV_EXT_ID, investment.INVESTMENT_NAME);
        
        // Find milestones for this investment
        const milestones = investmentData
            .filter(inv => 
                inv.INV_EXT_ID === investment.INV_EXT_ID && 
                inv.ROADMAP_ELEMENT && 
                inv.ROADMAP_ELEMENT.includes('Milestones')
            )
            .map(milestone => ({
                date: milestone.TASK_START,
                status: milestone.MILESTONE_STATUS,
                label: milestone.TASK_NAME,
                isSG3: milestone.ROADMAP_ELEMENT?.includes('SG3') || milestone.TASK_NAME?.includes('SG3')
            }));

        console.log('🎯 Milestones found for', investment.INV_EXT_ID, ':', milestones.length);

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
    
    console.log('✅ Processed data:', processedData.length, 'investment-based items');
    console.log('📋 Items with timeline data:', processedData.filter(item => item.startDate && item.endDate).length);
    
    if (processedData.length > 0) {
        console.log('📋 Sample processed item:', processedData[0]);
    }
    
    return processedData;
}

/**
 * Process portfolio data from full dataset using hierarchy-based approach
 * This matches the logic from apiDataService.js to ensure consistency
 */
function processPortfolioDataFromFullDataset(apiResponse) {
    console.log('🔄 Processing portfolio data from full dataset:', apiResponse);
    
    if (!apiResponse?.data?.hierarchy || !apiResponse?.data?.investment) {
        console.warn('Invalid API response structure:', apiResponse);
        return [];
    }

    const hierarchyData = apiResponse.data.hierarchy;
    const investmentData = apiResponse.data.investment;

    console.log('📊 Full dataset counts - Hierarchy:', hierarchyData.length, 'Investment:', investmentData.length);

    // Use the same approach as apiDataService.js - filter for Portfolio records
    const portfolioRecords = hierarchyData.filter(item => 
        item.COE_ROADMAP_TYPE === 'Portfolio'
    );

    console.log('📋 Portfolio records found:', portfolioRecords.length);

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
    console.log('📊 PTF groups found:', ptfIds.length);
    
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
                .map(milestone => ({
                    date: milestone.TASK_START,
                    status: milestone.MILESTONE_STATUS,
                    label: milestone.TASK_NAME,
                    isSG3: milestone.ROADMAP_ELEMENT.includes('SG3') || milestone.TASK_NAME.includes('SG3')
                }));

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
            
            console.log('📋 Processing portfolio:', portfolioData.id, portfolioData.name, 'Has investment:', !!investment);
            
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
    
    console.log('✅ Processed portfolio data:', processedData.length, 'portfolio items');
    console.log('📋 Items with investment data:', processedData.filter(item => item.hasInvestmentData).length);
    console.log('📋 Items without investment data:', processedData.filter(item => !item.hasInvestmentData).length);
    
    // Check for our target records
    const targetRecords = ['PROG000328', 'PROG000268'];
    targetRecords.forEach(recordId => {
        const found = processedData.find(item => item.id === recordId);
        if (found) {
            console.log(`✅ TARGET RECORD ${recordId} found:`, found);
        } else {
            console.log(`❌ TARGET RECORD ${recordId} NOT found`);
        }
    });
    
    return processedData;
}

/**
 * Process program data from full dataset using the CORRECTED logic from apiDataService.js
 * This matches the original apiDataService.js approach but fixes the bugs
 */
function processProgramDataFromFullDataset(apiResponse, portfolioId) {
    console.log('🔄 Processing program data for portfolio using apiDataService.js logic:', portfolioId);
    
    if (!apiResponse?.data?.hierarchy || !apiResponse?.data?.investment) {
        console.warn('Invalid API response structure:', apiResponse);
        return [];
    }

    const hierarchyData = apiResponse.data.hierarchy;
    const investmentData = apiResponse.data.investment;

    console.log('📊 Full dataset counts - Hierarchy:', hierarchyData.length, 'Investment:', investmentData.length);

    // STEP 1: Filter hierarchy for Program and Sub-Program data (corrected from apiDataService.js)
    const programTypeData = hierarchyData.filter(item => 
        item.COE_ROADMAP_TYPE === 'Program' || item.COE_ROADMAP_TYPE === 'Sub-Program'
    );
    
    console.log(`📋 Total Program/Sub-Program records: ${programTypeData.length}`);

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
    
    console.log(`📋 Filtered programs for ${portfolioId}: ${filteredData.length}`);

    // STEP 3: Look for self-referencing parent programs (original logic)
    const parentPrograms = filteredData.filter(item => 
        item.COE_ROADMAP_PARENT_ID === item.CHILD_ID && item.COE_ROADMAP_TYPE === 'Program'
    );
    
    console.log(`📋 Self-referencing parent programs: ${parentPrograms.length}`);

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
        console.log('📋 No self-referencing programs found, using flat list approach');
        
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
                .map(milestone => ({
                    date: milestone.TASK_START,
                    status: milestone.MILESTONE_STATUS,
                    label: milestone.TASK_NAME,
                    isSG3: milestone.ROADMAP_ELEMENT.includes('SG3') || milestone.TASK_NAME.includes('SG3')
                }));

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
    
    console.log('✅ Processed program data:', processedData.length, 'program items');
    console.log('📋 Items with investment data:', processedData.filter(item => item.hasInvestmentData).length);
    
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
            console.warn('No hierarchy data in optimized portfolio response');
            return [];
        }

        const hierarchyData = apiResponse.data.hierarchy || [];
        const investmentData = apiResponse.data.investment || [];
        console.log(`🔍 Processing optimized endpoint - Hierarchy: ${hierarchyData.length}, Investment: ${investmentData.length}`);

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
                    (milestone.TASK_NAME.toLowerCase().includes('sg3') || 
                     milestone.TASK_NAME.toLowerCase().includes('deploy'))
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

            console.log(`✅ Portfolio item: ${portfolioItem.name}, dates: ${portfolioItem.startDate} to ${portfolioItem.endDate}, milestones: ${milestones.length}, hasInvestmentData: ${portfolioItem.hasInvestmentData}`);
            return portfolioItem;
        });

        console.log(`✅ Processed ${processedData.length} portfolio items with investment data from optimized endpoint`);
        console.log(`📊 Items with dates: ${processedData.filter(item => item.startDate && item.endDate).length}`);
        console.log(`📊 Items with milestones: ${processedData.filter(item => item.milestones?.length > 0).length}`);
        
        return processedData;

    } catch (error) {
        console.error('❌ Error processing optimized portfolio data:', error);
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
        forceRefresh = false
    } = options;

    // CRITICAL FIX: Always call the API directly for each page.
    // This removes the flawed caching that limited you to 1000 records.
    console.log(`🔄 Fetching portfolio data directly from API for page: ${page}, limit: ${limit}`);
    
    try {
        const response = await apiCall('/api/data/portfolio', {
            page: page,
            limit: limit,
            // Pass filters to backend for server-side filtering
            portfolioId: portfolioId,
            status: status
        });
        
        // Process the structured response from the optimized endpoint
        const processedData = processPortfolioDataFromOptimizedEndpoint(response);
        
        console.log(`✅ Portfolio data fetched: page ${page}, ${processedData.length} items`);
        
        return {
            data: processedData,
            // The backend's pagination object is the source of truth
            hasMore: response.data?.pagination?.has_more || false,
            totalCount: response.data?.pagination?.total_items || processedData.length,
            fromCache: false // Always fresh data
        };
    } catch (error) {
        console.error('Failed to fetch portfolio data:', error);
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
    console.log('🗑️ Portfolio data cache cleared');
}

/**
 * Clear the program data cache
 * Use this when you need to force fresh program data
 */
export function clearProgramDataCache(portfolioId = null) {
    if (portfolioId) {
        programDataCache.delete(portfolioId);
        programCacheTimestamp.delete(portfolioId);
        console.log(`🗑️ Program data cache cleared for portfolio: ${portfolioId}`);
    } else {
        programDataCache.clear();
        programCacheTimestamp.clear();
        console.log('🗑️ All program data cache cleared');
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
    console.log('🔄 fetchProgramData called with selectedPortfolioId:', selectedPortfolioId);
    
    try {
        // Use the same API endpoint as the original apiDataService.js
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

        console.log('📊 Full dataset - Hierarchy:', hierarchyData.length, 'Investment:', investmentData.length);

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
        } else {
            // No portfolio filter applied - showing all programs
        }

        console.log('📋 Filtered program data:', filteredData.length, 'records');

        // Build parent-child hierarchy
        const processedData = [];
        
        // Find all parent programs (where COE_ROADMAP_PARENT_ID === CHILD_ID)
        const parentPrograms = filteredData.filter(item => 
            item.COE_ROADMAP_PARENT_ID === item.CHILD_ID && item.COE_ROADMAP_TYPE === 'Program'
        );
        
        console.log('📋 Parent programs found:', parentPrograms.length);
        
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
        
        console.log('✅ Final processed program data:', sortedData.length, 'items');
        console.log('📋 Items with timeline data:', sortedData.filter(item => item.startDate && item.endDate).length);

        // Return in the format expected by ProgramGanttChart.jsx (exactly like apiDataService.js)
        return {
            data: sortedData,
            totalCount: sortedData.length,
            page: 1,
            limit: 1000,
            hasMore: false,
            fromCache: false
        };
        
    } catch (error) {
        console.error('❌ Failed to load program data:', error);
        throw error;
    }
}

/**
 * Process program data using ADAPTED logic for the actual data structure
 * This handles the real data format we're receiving from the API
 */
function processProgramDataUsingApiDataServiceLogic(apiResponse, selectedPortfolioId = null) {
    console.log('🔄 Processing program data with adapted logic, selectedPortfolioId:', selectedPortfolioId);
    
    if (!apiResponse?.data?.hierarchy || !apiResponse?.data?.investment) {
        console.warn('Invalid API response structure:', apiResponse);
        return [];
    }

    const hierarchyData = apiResponse.data.hierarchy;
    const investmentData = apiResponse.data.investment;

    console.log('📊 API response counts - Hierarchy:', hierarchyData.length, 'Investment:', investmentData.length);

    // STEP 1: Filter hierarchy for Program and SubProgram data
    const programTypeData = hierarchyData.filter(item => 
        item.COE_ROADMAP_TYPE === 'Program' || item.COE_ROADMAP_TYPE === 'SubProgram'
    );

    console.log(`📋 Program/SubProgram records: ${programTypeData.length}`);

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
        console.log(`📋 Filtered programs for ${selectedPortfolioId}: ${filteredData.length}`);
    } else {
        console.log('📋 No portfolio filter - showing all programs');
    }

    const processedData = [];
    
    // ADAPTED APPROACH: Since we don't have self-referencing programs,
    // treat each program record as a displayable item
    console.log('📋 Using adapted approach for actual data structure');
    
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
        
        console.log('✅ Processed program item:', {
            id: programData.id,
            name: programData.name,
            hasInvestment: !!finalInvestment,
            startDate: programData.startDate,
            endDate: programData.endDate
        });
        
        processedData.push(programData);
    }
    
    // If we have no timeline data, let's create some sample items using hierarchy data
    if (processedData.length > 0 && processedData.every(item => !item.startDate)) {
        console.log('⚠️ No timeline data found in investments, using hierarchy dates');
        
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
    
    console.log('✅ Final processed program data:', sortedData.length, 'items');
    console.log('📋 Items with timeline data:', sortedData.filter(item => item.startDate && item.endDate).length);
    
    if (sortedData.length > 0) {
        console.log('📋 Sample final item:', {
            id: sortedData[0].id,
            name: sortedData[0].name,
            startDate: sortedData[0].startDate,
            endDate: sortedData[0].endDate,
            status: sortedData[0].status
        });
    }
    
    return sortedData;
}

/**
 * Process program data from optimized API response
 * This follows the exact same pattern as the original apiDataService.js program processing
 */
function processProgramDataFromOptimizedAPI(apiResponse, selectedPortfolioId) {
    console.log('🔄 Processing program data from optimized API for portfolio:', selectedPortfolioId);
    
    if (!apiResponse?.data?.hierarchy || !apiResponse?.data?.investment) {
        console.warn('Invalid API response structure:', apiResponse);
        return [];
    }

    const hierarchyData = apiResponse.data.hierarchy;
    const investmentData = apiResponse.data.investment;

    console.log('📊 API response counts - Hierarchy:', hierarchyData.length, 'Investment:', investmentData.length);

    // Filter hierarchy for Program and SubProgram data (same as apiDataService.js)
    const programTypeData = hierarchyData.filter(item => 
        item.COE_ROADMAP_TYPE === 'Program' || item.COE_ROADMAP_TYPE === 'SubProgram'
    );

    console.log(`📋 Program/SubProgram records: ${programTypeData.length}`);

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

    console.log(`📋 Filtered programs for ${selectedPortfolioId}: ${filteredData.length}`);

    // Build parent-child hierarchy (EXACT logic from apiDataService.js lines 161-165)
    const processedData = [];
    
    // Find all parent programs (where COE_ROADMAP_PARENT_ID === CHILD_ID)
    const parentPrograms = filteredData.filter(item => 
        item.COE_ROADMAP_PARENT_ID === item.CHILD_ID && item.COE_ROADMAP_TYPE === 'Program'
    );

    console.log(`📋 Parent programs found: ${parentPrograms.length}`);
    
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
                .map(milestone => ({
                    date: milestone.TASK_START,
                    status: milestone.MILESTONE_STATUS,
                    label: milestone.TASK_NAME,
                    isSG3: milestone.ROADMAP_ELEMENT.includes('SG3') || milestone.TASK_NAME.includes('SG3')
                }));

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
    
    console.log('✅ Processed and sorted program data:', sortedData.length, 'items');
    console.log('📋 Items with investment data:', sortedData.filter(item => item.startDate && item.endDate).length);
    
    return sortedData;
}

/**
 * Process program data from API response - Modified to use investment data directly
 * Since we don't have actual Program/SubProgram hierarchy data, we'll show investment records as programs
 */
function processProgramDataFromApi(apiResponse, selectedPortfolioId = null) {
    console.log('🔄 Processing program data from API...', apiResponse);
    
    if (!apiResponse?.data?.investment) {
        console.warn('No investment data in API response for programs:', apiResponse);
        return [];
    }

    const investmentData = apiResponse.data.investment;
    console.log('📊 Program data - Investment records:', investmentData.length);

    // For program view, use investment records directly
    // Group investments by their function or market to create a program-like hierarchy
    const investmentRecords = investmentData.filter(inv => 
        inv.ROADMAP_ELEMENT === 'Investment' &&
        inv.INV_EXT_ID && 
        inv.INVESTMENT_NAME
    );

    console.log('📋 Investment records for program view:', investmentRecords.length);

    // If a specific portfolio is selected, we can filter here if needed
    let filteredData = investmentRecords;
    if (selectedPortfolioId && selectedPortfolioId !== 'All') {
        console.log('🎯 Note: Portfolio filtering for programs not yet implemented');
        // For MVP, show all investments as program-level items
        // This could be enhanced later with proper portfolio-program relationships
    }

    console.log('📋 Filtered program data:', filteredData.length);

    // Process each investment record as a program item
    const processedData = [];
    
    for (const investment of filteredData) {
        console.log('� Processing investment as program:', investment.INV_EXT_ID);
        
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
        
        console.log('✅ Processed parent program:', parentData);
        processedData.push(parentData);
        
        // Find and process children (projects under this program)
        const children = filteredData.filter(item => 
            item.COE_ROADMAP_PARENT_ID === parentProgram.CHILD_ID && 
            item.CHILD_ID !== parentProgram.CHILD_ID
        );
        
        console.log('👶 Children found for', parentProgram.CHILD_ID, ':', children.length);
        
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
                milestones: childMilestones,
                hasInvestmentData: !!childInvestment
            };
            
            console.log('✅ Processed child project:', childData);
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
    
    console.log('🏁 Final processed program data:', sortedData.length, 'items');
    return sortedData;
}

/**
 * SubProgram Data Fetching - EXACT REPLICATION of processSubProgramData() from apiDataService.js
 * This function replicates processSubProgramDataFromAPI() from apiDataService.js
 * to ensure 100% compatibility with SubProgramGanttChartFull.jsx
 */
export async function fetchSubProgramData(selectedProgramId = null, options = {}) {
    console.log('🔄 Calling CORRECTED fetchSubProgramData with programId:', selectedProgramId);
    
    try {
        // Use the fast progressive API endpoint with SQL-level filtering
        const endpoint = '/api/data/subprogram';
        const params = {
            programId: selectedProgramId,
            page: options.page || 1,
            limit: options.limit || 1000
        };
        
        const response = await apiCall(endpoint, params);
        const result = response;
        
        if (result.status !== 'success') {
            throw new Error(result.message || 'Failed to fetch subprogram data');
        }
        
        // Extract both hierarchy and investment data from structured response
        const hierarchyData = result.data.hierarchy;
        const investmentData = result.data.investment;

        console.log('📊 SubProgram data (corrected API) - Hierarchy:', hierarchyData.length, 'Investment:', investmentData.length);

        // *** CRITICAL FIX: Filter out parent records where COE_ROADMAP_PARENT_ID == CHILD_ID ***
        // These are self-referencing records that create duplicates
        const filteredHierarchyData = hierarchyData.filter(subProgram => {
            const isParentSameAsChild = subProgram.COE_ROADMAP_PARENT_ID === subProgram.CHILD_ID;
            if (isParentSameAsChild) {
                console.log(`🚫 DUPLICATE FILTER: Excluding self-referencing record: ${subProgram.CHILD_NAME} (Parent ID = Child ID = ${subProgram.CHILD_ID})`);
            }
            return !isParentSameAsChild;
        });

        console.log(`📊 After duplicate filtering: ${hierarchyData.length} → ${filteredHierarchyData.length} records`);

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
            
            console.log(`🔍 Processing ${subProgram.CHILD_NAME} (${projectId}): Found ${projectInvestments.length} investment records`);
            
            // If there's no investment data, create a default entry but log it
            if (projectInvestments.length === 0) {
                console.warn(`⚠️ No investment data found for sub-program: ${subProgram.CHILD_NAME}. Creating default entry.`);
                
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
            
            // Enhanced debugging for CaTAlyst projects
            if (subProgram.CHILD_NAME && (subProgram.CHILD_NAME.toLowerCase().includes('catalyst') || subProgram.CHILD_NAME === 'CaTAlyst')) {
                console.log('🎯 CATALYST API: Found CaTAlyst with investment data!');
                console.log('🎯 CATALYST API: Project ID:', projectId);
                console.log('🎯 CATALYST API: Investment count:', projectInvestments.length);
                console.log('🎯 CATALYST API: All investment data:', projectInvestments);
                console.log('🎯 CATALYST API: Main investment:', mainInvestment);
                console.log('🎯 CATALYST API: Main investment ROADMAP_ELEMENT:', mainInvestment?.ROADMAP_ELEMENT);
                console.log('🎯 CATALYST API: Main investment TASK_NAME:', mainInvestment?.TASK_NAME);
            }
            
            // Find phase data
            const phaseData = projectInvestments.filter(inv => inv.ROADMAP_ELEMENT === 'Phases' && inv.TASK_NAME);
            
            console.log('🔍 Phase data filtered for', subProgram.CHILD_NAME, ':', phaseData.length, 'phases found');
            
            // Additional debugging for any project that should have phases
            if (subProgram.CHILD_NAME && (subProgram.CHILD_NAME.toLowerCase().includes('catalyst') || subProgram.CHILD_NAME === 'CaTAlyst')) {
                console.log('🎯 CATALYST PHASE DEBUG: Raw phase filter result:', phaseData);
                console.log('🎯 CATALYST PHASE DEBUG: Looking for ROADMAP_ELEMENT === "Phases" with TASK_NAME');
                projectInvestments.forEach(inv => {
                    console.log(`🎯 CATALYST PHASE DEBUG: Investment record - ROADMAP_ELEMENT: "${inv.ROADMAP_ELEMENT}", TASK_NAME: "${inv.TASK_NAME}"`);
                });
            }
            
            // Find milestone data - ENHANCED DEBUGGING
            const rawMilestoneData = projectInvestments.filter(inv => 
                inv.TASK_NAME?.toLowerCase().includes('sg3') &&
                (inv.ROADMAP_ELEMENT === 'Milestones - Other' || inv.ROADMAP_ELEMENT === 'Milestones - Deployment')
            );

            // Transform milestone data to match component expectations
            const milestoneData = rawMilestoneData.map(milestone => ({
                TASK_NAME: milestone.TASK_NAME,
                MILESTONE_NAME: milestone.TASK_NAME, // Component looks for this
                MILESTONE_DATE: milestone.TASK_START, // Component looks for this instead of TASK_START
                TARGET_DATE: milestone.TASK_START, // Fallback property
                STATUS: milestone.MILESTONE_STATUS || milestone.INV_OVERALL_STATUS,
                ROADMAP_ELEMENT: milestone.ROADMAP_ELEMENT
            }));

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
                    MILESTONE_DATE: milestone.TASK_START,
                    MILESTONE_TYPE: 'SG3',
                    MILESTONE_NAME: milestone.TASK_NAME,
                    MILESTONE_STATUS: milestone.MILESTONE_STATUS
                });
            });
        });
        
        console.log('✅ SubProgram data processed correctly:', projects.length, 'projects,', milestones.length, 'milestones');
        
        // Return in the EXACT SAME format as apiDataService.js
        return { projects, milestones };
        
    } catch (error) {
        console.error('❌ Failed to load sub-program data:', error);
        throw error;
    }
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
        page = 1,
        limit = 1000, // Increased default limit to fetch more records
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
        // Fetch data from the new optimized endpoint
        const apiResponse = await apiCall('/api/data/region', params);
        
        console.log('⏱️ Starting data processing...');
        const processingStart = Date.now();
        
        // Process the raw API response to match the format expected by RegionRoadmap.jsx
        const processedData = processRegionDataToExpectedFormat(apiResponse, { page, limit });
        
        const processingTime = Date.now() - processingStart;
        console.log(`⏱️ Data processing completed in ${processingTime}ms, got ${processedData.length} projects`);
        
        // Return in the same structure expected by the component
        return {
            status: 'success',
            data: {
                data: processedData.data,
                totalCount: processedData.totalCount,
                page: processedData.page,
                limit: processedData.limit,
                hasMore: processedData.hasMore
            }
        };
        
    } catch (error) {
        console.error('❌ Failed to fetch region data:', error);
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
            console.warn('No investment data in API response');
            return [];
        }

        const investmentData = apiResponse.data.investment;
        
        // 1. Filter to only show records of specific types (same as original logic)
        const projectData = investmentData.filter(item =>
            ["Non-Clarity item", "Project", "Programs"].includes(item.CLRTY_INV_TYPE)
        );

        console.log(`🔍 Filtered project data: ${projectData.length} records`);

        // 2. Group all records for each project by its unique ID
        const projectGroups = {};
        projectData.forEach(item => {
            if (!projectGroups[item.INV_EXT_ID]) {
                projectGroups[item.INV_EXT_ID] = [];
            }
            projectGroups[item.INV_EXT_ID].push(item);
        });

        console.log(`🔍 Processing ${Object.keys(projectGroups).length} unique projects from ${projectData.length} filtered records`);
        
        const processedProjects = [];
        const allProjectIds = Object.keys(projectGroups);
        
        console.log(`⚡ PERFORMANCE OPTIMIZATION: Processing ${allProjectIds.length} projects...`);

        allProjectIds.forEach((projectId, index) => {
            // Only log every 1000th project to reduce console spam
            if (index % 1000 === 0 || index < 3) {
                console.log(`🔄 Processing project ${index + 1}/${allProjectIds.length}: ${projectId}`);
            }
            const projectItems = projectGroups[projectId];
            console.log(`  - ${projectItems.length} records for this project`);
            
            // Show what types of records we have for this project
            const recordTypes = projectItems.map(item => item.ROADMAP_ELEMENT);
            console.log(`  - Record types: ${recordTypes.join(', ')}`);

            // FIXED: Don't filter out records with null/empty INV_MARKET
            // Many valid projects have null market data - we should include them
            const itemsWithMarket = projectItems; // Include ALL project items
            
            console.log(`  - All project records included: ${itemsWithMarket.length}/${projectItems.length}`);
            if (itemsWithMarket.length > 0) {
                const sampleMarket = itemsWithMarket[0].INV_MARKET;
                console.log(`  - Sample market value: "${sampleMarket}" (${typeof sampleMarket})`);
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
                console.warn(`⚠️ Using fallback record for project ${projectId} - dates may be incorrect`);
                mainRecord = itemsWithMarket[0];
            }
            
            console.log(`  - Looking for project record...`);
            if (mainRecord) {
                const projectName = mainRecord.INVESTMENT_NAME || mainRecord.TASK_NAME || `Project ${projectId}`;
                console.log(`  ✅ Found project record: ${projectName}`);
                console.log(`  📅 Record dates: ${mainRecord.TASK_START} to ${mainRecord.TASK_FINISH}`);
                
                // Special debugging for the problematic project
                if (projectName && projectName.includes('1C ERP Rollouts BCCA')) {
                    console.log(`🎯 DETAILED RECORD DEBUG for ${projectName}:`, {
                        ROADMAP_ELEMENT: mainRecord.ROADMAP_ELEMENT,
                        TASK_START: mainRecord.TASK_START,
                        TASK_FINISH: mainRecord.TASK_FINISH,
                        INVESTMENT_NAME: mainRecord.INVESTMENT_NAME,
                        TASK_NAME: mainRecord.TASK_NAME,
                        fullRecord: mainRecord
                    });
                    
                    // Show all available records for this project
                    console.log(`🎯 ALL RECORDS for ${projectName}:`, 
                        itemsWithMarket.map(item => ({
                            ROADMAP_ELEMENT: item.ROADMAP_ELEMENT,
                            TASK_START: item.TASK_START,
                            TASK_FINISH: item.TASK_FINISH,
                            INVESTMENT_NAME: item.INVESTMENT_NAME,
                            TASK_NAME: item.TASK_NAME
                        }))
                    );
                }
            } else {
                console.log(`  ❌ No valid project record found`);
                const availableElements = [...new Set(itemsWithMarket.map(item => item.ROADMAP_ELEMENT))];
                console.log(`  - Available elements: ${availableElements.join(', ')}`);
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
            console.log(`  ✅ Successfully processed project: ${projectName}`);
            
            // Special debugging for the problematic project
            if (projectName && projectName.includes('1C ERP Rollouts BCCA')) {
                console.log(`🎯 FINAL PROJECT DATA for ${projectName}:`, {
                    id: projectId,
                    name: projectName,
                    startDate: projectStart,
                    endDate: projectEnd,
                    isUnphased,
                    phases: phases,
                    mainRecord_TASK_START: mainRecord.TASK_START,
                    mainRecord_TASK_FINISH: mainRecord.TASK_FINISH
                });
            }
            
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
        
        console.log(`\n✅ Final results: Processed ${sortedResults.length} region projects for display`);
        
        // 9. Apply CLIENT-SIDE PAGINATION for performance
        const { page = 1, limit = 25 } = paginationOptions;
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedResults = sortedResults.slice(startIndex, endIndex);
        
        console.log(`📄 Pagination applied: Page ${page}, showing ${paginatedResults.length} of ${sortedResults.length} total projects`);
        console.log(`📄 Range: ${startIndex + 1}-${Math.min(endIndex, sortedResults.length)} of ${sortedResults.length}`);
        
        return {
            data: paginatedResults,
            totalCount: sortedResults.length,
            page,
            limit,
            hasMore: endIndex < sortedResults.length
        };

    } catch (error) {
        console.error('❌ Error processing region data to expected format:', error);
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
            // Return the filter options directly (not wrapped in status/data structure)
            return {
                regions: data.data.regions || [],
                markets: data.data.markets || [],
                functions: data.data.functions || [],
                tiers: data.data.tiers || []
            };
        } else {
            throw new Error(data.message || 'Failed to fetch filter options');
        }
        
    } catch (error) {
        console.error('Error fetching region filter options:', error);
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
        console.error('Error fetching debug supply chain data:', error);
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
            console.log('✅ Cache cleared successfully');
            return true;
        } else {
            console.error('❌ Failed to clear cache:', data.message);
            return false;
        }
    } catch (error) {
        console.error('❌ Cache clear error:', error);
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
        console.error('❌ Cache stats error:', error);
        throw error;
    }
}

/**
 * Legacy API support (for backward compatibility)
 * These should be phased out in favor of the progressive methods above
 */
export async function fetchPaginatedData(page = 1, pageSize = 25) {
    console.warn('⚠️ fetchPaginatedData is legacy - consider using specific fetch methods for better performance');
    
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
        console.error('❌ Health check failed:', error);
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
        console.error('❌ Database connection test failed:', error);
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
