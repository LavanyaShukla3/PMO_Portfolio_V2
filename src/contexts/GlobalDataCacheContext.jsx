/**
 * Global Data Cache Context for PMO Portfolio
 * 
 * This context provides:
 * - Background loading of all data using Promise.all
 * - Intelligent caching with automatic cache invalidation
 * - State preservation across view navigation
 * - Instant loading when switching between views
 * - Progress tracking for background operations
 */

import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import { 
    fetchPortfolioData, 
    fetchProgramData, 
    fetchSubProgramData, 
    fetchRegionData
} from '../services/progressiveApiService';
import { getRegionFilterOptions } from '../services/progressiveApiService';

// Action types for the reducer
const ACTIONS = {
    START_LOADING: 'START_LOADING',
    START_BACKGROUND_LOADING: 'START_BACKGROUND_LOADING',
    SET_PORTFOLIO_DATA: 'SET_PORTFOLIO_DATA',
    SET_PROGRAM_DATA: 'SET_PROGRAM_DATA',
    SET_SUBPROGRAM_DATA: 'SET_SUBPROGRAM_DATA',
    SET_REGION_DATA: 'SET_REGION_DATA',
    SET_REGION_FILTERS: 'SET_REGION_FILTERS',
    SET_ERROR: 'SET_ERROR',
    SET_LOADING_PROGRESS: 'SET_LOADING_PROGRESS',
    PRESERVE_VIEW_STATE: 'PRESERVE_VIEW_STATE',
    RESTORE_VIEW_STATE: 'RESTORE_VIEW_STATE',
    CLEAR_CACHE: 'CLEAR_CACHE',
};

// Initial state
const initialState = {
    // Data cache
    portfolioData: null,
    programData: null,
    subProgramData: null,
    regionData: null,
    regionFilters: null,
    
    // Loading states
    isLoading: false,
    loadingProgress: 0,
    loadingStep: '',
    isBackgroundLoading: false, // New: tracks background loading while UI is shown
    
    // Error handling
    error: null,
    
    // State preservation
    viewStates: {
        portfolio: {
            currentPage: 1,
            selectedItems: [],
            filters: {},
            zoomLevel: 1.0,
            timelineView: 'Full Timeline',
        },
        program: {
            selectedPortfolio: null,
            currentPage: 1,
            filters: {},
            zoomLevel: 1.0,
            timelineView: 'Full Timeline',
        },
        region: {
            selectedRegion: null,
            selectedDepartment: null,
            selectedProgram: null,
            currentPage: 1,
            zoomLevel: 1.0,
            timelineView: 'Full Timeline',
        },
        subProgram: {
            selectedProgram: null,
            currentPage: 1,
            filters: {},
            zoomLevel: 1.0,
            timelineView: 'Full Timeline',
        },
    },
    
    // Cache metadata
    cacheTimestamp: null,
    cacheExpiry: 30 * 60 * 1000, // 30 minutes
};

// Reducer function
function dataReducer(state, action) {
    switch (action.type) {
        case ACTIONS.START_LOADING:
            return {
                ...state,
                isLoading: true,
                loadingProgress: 0,
                loadingStep: action.payload?.step || 'Loading data...',
                error: null,
            };
            
        case ACTIONS.START_BACKGROUND_LOADING:
            return {
                ...state,
                isBackgroundLoading: true,
                loadingStep: 'Loading background data...',
            };
            
        case ACTIONS.SET_LOADING_PROGRESS:
            return {
                ...state,
                loadingProgress: action.payload.progress,
                loadingStep: action.payload.step,
            };
            
        case ACTIONS.SET_PORTFOLIO_DATA:
            return {
                ...state,
                portfolioData: action.payload,
                isLoading: false, // UI can be shown now!
            };
            
        case ACTIONS.SET_PROGRAM_DATA:
            return {
                ...state,
                programData: action.payload,
            };
            
        case ACTIONS.SET_SUBPROGRAM_DATA:
            return {
                ...state,
                subProgramData: action.payload,
            };
            
        case ACTIONS.SET_REGION_DATA:
            return {
                ...state,
                regionData: action.payload,
            };
            
        case ACTIONS.SET_REGION_FILTERS:
            return {
                ...state,
                regionFilters: action.payload,
                // Keep isLoading as false (Portfolio already loaded UI)
                isBackgroundLoading: false, // Background loading complete
                loadingProgress: 100,
                loadingStep: 'All data loaded',
                cacheTimestamp: Date.now(),
            };
            
        case ACTIONS.SET_ERROR:
            return {
                ...state,
                error: action.payload,
                isLoading: false,
                loadingProgress: 0,
                loadingStep: 'Error',
            };
            
        case ACTIONS.PRESERVE_VIEW_STATE:
            return {
                ...state,
                viewStates: {
                    ...state.viewStates,
                    [action.payload.viewName]: {
                        ...state.viewStates[action.payload.viewName],
                        ...action.payload.state,
                    },
                },
            };
            
        case ACTIONS.RESTORE_VIEW_STATE:
            return state; // State is already preserved, just return current state
            
        case ACTIONS.CLEAR_CACHE:
            return {
                ...initialState,
                viewStates: state.viewStates, // Preserve view states when clearing cache
            };
            
        default:
            return state;
    }
}

// Create context
const GlobalDataCacheContext = createContext();

// Custom hook to use the context
export const useGlobalDataCache = () => {
    const context = useContext(GlobalDataCacheContext);
    if (!context) {
        throw new Error('useGlobalDataCache must be used within a GlobalDataCacheProvider');
    }
    return context;
};

// Provider component
export const GlobalDataCacheProvider = ({ children }) => {
    const [state, dispatch] = useReducer(dataReducer, initialState);
    const loadingRef = useRef(false);
    
    // Check if cache is valid
    const isCacheValid = useCallback(() => {
        if (!state.cacheTimestamp) return false;
        return (Date.now() - state.cacheTimestamp) < state.cacheExpiry;
    }, [state.cacheTimestamp, state.cacheExpiry]);
    
    // Load data with priority based on selected view
    const loadDataWithPriority = useCallback(async (priorityView = 'Portfolio', forceRefresh = false) => {
        // Prevent multiple simultaneous loads
        if (loadingRef.current && !forceRefresh) {
            console.log('🔄 Data loading already in progress...');
            return;
        }
        
        // Check cache validity
        if (isCacheValid() && !forceRefresh && state.portfolioData) {
            console.log('✅ Using cached data');
            return;
        }
        
        loadingRef.current = true;
        dispatch({ 
            type: ACTIONS.START_LOADING,
            payload: { step: `Loading ${priorityView} data...` }
        });
        
        try {
            // PHASE 1: Load PRIORITY VIEW data FIRST and show UI immediately
            try {
                let priorityData;
                switch (priorityView) {
                    case 'Portfolio':
                        priorityData = await fetchPortfolioData(1, 5000);
                        dispatch({ type: ACTIONS.SET_PORTFOLIO_DATA, payload: priorityData });
                        break;
                    case 'Program':
                        priorityData = await fetchProgramData(null, { page: 1, limit: 5000 });
                        dispatch({ type: ACTIONS.SET_PROGRAM_DATA, payload: priorityData });
                        // Also set a flag to show UI is ready
                        dispatch({ type: ACTIONS.SET_PORTFOLIO_DATA, payload: { projects: [] } }); // Dummy to unblock UI
                        break;
                    case 'SubProgram':
                        priorityData = await fetchSubProgramData(null, { page: 1, limit: 15000 });
                        dispatch({ type: ACTIONS.SET_SUBPROGRAM_DATA, payload: priorityData });
                        dispatch({ type: ACTIONS.SET_PORTFOLIO_DATA, payload: { projects: [] } }); // Dummy to unblock UI
                        break;
                    case 'Region':
                        // Load Region data AND filter options in parallel for better UX
                        const [regionData, filterOptions] = await Promise.all([
                            fetchRegionData(null, { page: 1, limit: 5000 }),
                            getRegionFilterOptions().catch(err => {
                                console.error('Failed to load filter options:', err);
                                return { regions: [], markets: [], functions: [], tiers: [] };
                            })
                        ]);
                        dispatch({ type: ACTIONS.SET_REGION_DATA, payload: regionData });
                        dispatch({ type: ACTIONS.SET_REGION_FILTERS, payload: filterOptions });
                        dispatch({ type: ACTIONS.SET_PORTFOLIO_DATA, payload: { projects: [] } }); // Dummy to unblock UI
                        break;
                    default:
                        priorityData = await fetchPortfolioData(1, 5000);
                        dispatch({ type: ACTIONS.SET_PORTFOLIO_DATA, payload: priorityData });
                }
                
                dispatch({ 
                    type: ACTIONS.SET_LOADING_PROGRESS, 
                    payload: { progress: 20, step: `${priorityView} data loaded - UI ready!` }
                });
                console.log(`✅ ${priorityView} data loaded - UI can now be displayed!`);
            } catch (error) {
                console.error(`❌ Failed to load ${priorityView} data:`, error);
            }
            
            // PHASE 2: Continue loading other data in background (skip priority view)
            console.log('🔄 Phase 2: Loading remaining data in background...');
            dispatch({ type: ACTIONS.START_BACKGROUND_LOADING });
            
            const backgroundPromises = [];
            
            // Portfolio data (skip if already loaded as priority)
            if (priorityView !== 'Portfolio') {
                backgroundPromises.push(
                    fetchPortfolioData(1, 5000).then(data => {
                        dispatch({ 
                            type: ACTIONS.SET_LOADING_PROGRESS, 
                            payload: { progress: 30, step: 'Portfolio data loaded' }
                        });
                        dispatch({ type: ACTIONS.SET_PORTFOLIO_DATA, payload: data });
                        return { type: 'portfolio', data };
                    }).catch(error => {
                        return { type: 'portfolio', data: null, error };
                    })
                );
            }
            
            // Program data (skip if already loaded as priority)
            if (priorityView !== 'Program') {
                backgroundPromises.push(
                    fetchProgramData(null, { page: 1, limit: 5000 }).then(data => {
                        dispatch({ 
                            type: ACTIONS.SET_LOADING_PROGRESS, 
                            payload: { progress: 40, step: 'Program data loaded' }
                        });
                        dispatch({ type: ACTIONS.SET_PROGRAM_DATA, payload: data });
                        return { type: 'program', data };
                    }).catch(error => {
                        return { type: 'program', data: null, error };
                    })
                );
            }
            
            // SubProgram data (skip if already loaded as priority)
            if (priorityView !== 'SubProgram') {
                backgroundPromises.push(
                    fetchSubProgramData(null, { page: 1, limit: 15000 }).then(data => {
                        dispatch({ 
                            type: ACTIONS.SET_LOADING_PROGRESS, 
                            payload: { progress: 60, step: 'SubProgram data loaded' }
                        });
                        dispatch({ type: ACTIONS.SET_SUBPROGRAM_DATA, payload: data });
                        return { type: 'subProgram', data };
                    }).catch(error => {
                        return { type: 'subProgram', data: null, error };
                    })
                );
            }
            
            // Region data (skip if already loaded as priority)
            if (priorityView !== 'Region') {
                backgroundPromises.push(
                    fetchRegionData(null, { page: 1, limit: 5000 }).then(data => {
                        dispatch({ 
                            type: ACTIONS.SET_LOADING_PROGRESS, 
                            payload: { progress: 80, step: 'Region data loaded' }
                        });
                        dispatch({ type: ACTIONS.SET_REGION_DATA, payload: data });
                        return { type: 'region', data };
                    }).catch(error => {
                        return { type: 'region', data: null, error };
                    })
                );
            }
            
            // Region filter options (only load in background if not already loaded in Phase 1)
            if (priorityView !== 'Region') {
                backgroundPromises.push(
                    (async () => {
                        try {
                            const data = await getRegionFilterOptions();
                            
                            dispatch({ 
                                type: ACTIONS.SET_LOADING_PROGRESS, 
                                payload: { progress: 90, step: 'Filter options loaded' }
                            });
                            return { type: 'regionFilters', data };
                        } catch (error) {
                            // Return default empty filters structure
                            return { 
                                type: 'regionFilters', 
                                data: {
                                    regions: [],
                                    markets: [],
                                    functions: [],
                                    tiers: []
                                },
                                error
                            };
                        }
                    })()
                );
            }
            
            const results = await Promise.allSettled(backgroundPromises);
            
            // Process background loading results
            const regionFiltersResult = results.find(r => r.status === 'fulfilled' && r.value?.type === 'regionFilters');
            if (regionFiltersResult) {
                dispatch({ type: ACTIONS.SET_REGION_FILTERS, payload: regionFiltersResult.value.data });
            }
            
            // Log successful and failed loads
            const successful = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;
            
            
            
        } catch (error) {
            dispatch({ 
                type: ACTIONS.SET_ERROR, 
                payload: `Failed to load data: ${error.message}` 
            });
        } finally {
            loadingRef.current = false;
        }
    }, [isCacheValid, state.portfolioData]);
    
    // Wrapper for backward compatibility - loads Portfolio by default
    const loadAllData = useCallback(async (forceRefresh = false) => {
        return loadDataWithPriority('Portfolio', forceRefresh);
    }, [loadDataWithPriority]);
    
    // Auto-load data on mount (Portfolio by default - but will be overridden by App.jsx)
    useEffect(() => {
        // Don't auto-load - let App.jsx control when to load based on selected view
        // loadAllData();
    }, []);
    
    // Preserve view state
    const preserveViewState = useCallback((viewName, viewState) => {
        dispatch({
            type: ACTIONS.PRESERVE_VIEW_STATE,
            payload: { viewName, state: viewState },
        });
    }, []);
    
    // Get preserved view state
    const getViewState = useCallback((viewName) => {
        return state.viewStates[viewName] || {};
    }, [state.viewStates]);
    
    // Clear cache and reload
    const refreshData = useCallback(() => {
        dispatch({ type: ACTIONS.CLEAR_CACHE });
        loadAllData(true);
    }, [loadAllData]);
    
    // Get cached data by type
    const getCachedData = useCallback((dataType) => {
        switch (dataType) {
            case 'portfolio':
                return state.portfolioData;
            case 'program':
                return state.programData;
            case 'subProgram':
                return state.subProgramData;
            case 'region':
                return state.regionData;
            case 'regionFilters':
                return state.regionFilters;
            default:
                return null;
        }
    }, [state]);
    
    // Context value
    const contextValue = {
        // Data
        portfolioData: state.portfolioData,
        programData: state.programData,
        subProgramData: state.subProgramData,
        regionData: state.regionData,
        regionFilters: state.regionFilters,
        
        // Loading states
        isLoading: state.isLoading,
        isBackgroundLoading: state.isBackgroundLoading,
        loadingProgress: state.loadingProgress,
        loadingStep: state.loadingStep,
        error: state.error,
        
        // Cache management
        isCacheValid: isCacheValid(),
        cacheTimestamp: state.cacheTimestamp,
        refreshData,
        loadAllData,
        loadDataWithPriority, // NEW: Allow priority-based loading
        
        // State preservation
        preserveViewState,
        getViewState,
        viewStates: state.viewStates,
        
        // Utilities
        getCachedData,
    };
    
    return (
        <GlobalDataCacheContext.Provider value={contextValue}>
            {children}
        </GlobalDataCacheContext.Provider>
    );
};

export default GlobalDataCacheContext;