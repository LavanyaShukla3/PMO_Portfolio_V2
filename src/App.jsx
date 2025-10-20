import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
// Import only the welcome page eagerly - everything else loads on demand
import WelcomePage from './pages/WelcomePage';
import { GlobalDataCacheProvider, useGlobalDataCache } from './contexts/GlobalDataCacheContext';
import { validateApiData } from './utils/apiValidation';
import './App.css';

// Lazy load ALL page components - they only compile when user selects them
const PortfolioGanttChart = lazy(() => import('./pages/PortfolioGanttChart'));
const ProgramGanttChart = lazy(() => import('./pages/ProgramGanttChart'));
const SubProgramGanttChart = lazy(() => import('./pages/SubProgramGanttChartFull'));
const RegionRoadMap = lazy(() => import('./pages/RegionRoadMap'));

// Main App Content Component
function AppContent() {
    const [currentView, setCurrentView] = useState(null); // Start with NO view selected (welcome page)
    const [selectedPortfolioId, setSelectedPortfolioId] = useState(null);
    const [selectedPortfolioName, setSelectedPortfolioName] = useState('');
    const [selectedSubProgramId, setSelectedSubProgramId] = useState(null);
    const [selectedSubProgramName, setSelectedSubProgramName] = useState('');
    const [dataValidation, setDataValidation] = useState({ 
        isValid: null, 
        errors: [], 
        mode: 'unknown',
        isLoading: true 
    });
    
    // Get cache data and states
    const { 
        isLoading: cacheLoading, 
        isBackgroundLoading,
        loadingProgress, 
        loadingStep, 
        error: cacheError,
        preserveViewState,
        getViewState,
        loadDataWithPriority // NEW: For priority-based loading
    } = useGlobalDataCache();
    
    // Handle view selection from welcome page
    const handleViewSelection = useCallback((viewName) => {
        console.log(`🎯 User selected ${viewName} view - loading with priority...`);
        setCurrentView(viewName);
        // Load the selected view's data first, then others in background
        loadDataWithPriority(viewName);
    }, [loadDataWithPriority]);

    // Validate data on app start (NON-BLOCKING - runs in background)
    useEffect(() => {
        const validateData = async () => {
            try {
                const validation = await validateApiData();
                setDataValidation({ ...validation, isLoading: false });
            } catch (error) {
                setDataValidation({
                    isValid: false,
                    errors: [`Failed to validate data: ${error.message}`],
                    mode: 'unknown',
                    isLoading: false
                });
            }
        };

        // Start validation in background
        validateData();
        
        // OPTIMIZATION: Don't block UI - let it render immediately
        // Set isLoading to false so the UI can start rendering while validation runs
        setDataValidation(prev => ({ ...prev, isLoading: false, isValid: true }));
    }, []);

    // Show error banner if validation fails (but don't block UI)
    const showErrorBanner = !dataValidation.isLoading && dataValidation.isValid === false && dataValidation.errors.length > 0;

    // Handle view changes with state preservation
    const handleViewChange = (newView) => {
        // Preserve current view state
        preserveViewState(currentView.toLowerCase(), {
            selectedPortfolioId,
            selectedPortfolioName,
            selectedSubProgramId,
            selectedSubProgramName,
        });
        
        setCurrentView(newView);
        
        // Restore state for new view
        const savedState = getViewState(newView.toLowerCase());
        if (savedState.selectedPortfolioId) {
            setSelectedPortfolioId(savedState.selectedPortfolioId);
            setSelectedPortfolioName(savedState.selectedPortfolioName);
        }
        if (savedState.selectedSubProgramId) {
            setSelectedSubProgramId(savedState.selectedSubProgramId);
            setSelectedSubProgramName(savedState.selectedSubProgramName);
        }
        
        if (newView === 'Portfolio') {
            setSelectedPortfolioId(null);
            setSelectedPortfolioName('');
            setSelectedSubProgramId(null);
            setSelectedSubProgramName('');
        }
    };

    // Show welcome page if no view is selected
    if (!currentView) {
        return <WelcomePage onSelectView={handleViewSelection} />;
    }

    return (
        <div className="min-h-screen bg-gray-50">{/* Error Banner (non-blocking) */}
            {showErrorBanner && (
                <div className="fixed top-0 left-0 right-0 z-50 bg-red-50 border-b border-red-400">
                    <div className="max-w-7xl mx-auto px-4 py-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                                <span className="text-red-700 text-sm font-medium">API validation warning: {dataValidation.errors[0]}</span>
                            </div>
                            <button 
                                onClick={() => setDataValidation(prev => ({ ...prev, errors: [] }))}
                                className="text-red-600 hover:text-red-800"
                            >
                                ✕
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Global Loading Indicator */}
            {(cacheLoading || isBackgroundLoading || cacheError) && (
                <div className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 shadow-sm z-50">
                    <div className="max-w-7xl mx-auto px-4 py-3">
                        {cacheError ? (
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
                                    <span className="text-red-700 font-medium">Error loading data</span>
                                    <span className="text-red-600 text-sm">{cacheError}</span>
                                </div>
                            </div>
                        ) : cacheLoading ? (
                            <div className="flex items-center space-x-4">
                                <div className="flex items-center space-x-3">
                                    <div className="w-4 h-4 bg-blue-500 rounded-full animate-spin border-2 border-white border-t-transparent"></div>
                                    {/* <span className="text-blue-700 font-medium">Loading Portfolio data...</span> */}
                                    <span className="text-blue-600 text-sm">{loadingStep}</span>
                                </div>
                                
                                {/* Progress Bar */}
                                <div className="flex-1 max-w-md">
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div 
                                            className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                                            style={{ width: `${loadingProgress}%` }}
                                        ></div>
                                    </div>
                                    <span className="text-xs text-gray-600 mt-1 block">{loadingProgress}%</span>
                                </div>
                            </div>
                        ) : isBackgroundLoading ? (
                            <div className="flex items-center space-x-4">
                                <div className="flex items-center space-x-3">
                                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                                    <span className="text-green-700 font-medium">✅ Portfolio loaded - Loading other views in background...</span>
                                    <span className="text-green-600 text-sm">{loadingStep}</span>
                                </div>
                                
                                {/* Subtle Progress Bar */}
                                <div className="flex-1 max-w-sm">
                                    <div className="w-full bg-green-100 rounded-full h-1">
                                        <div 
                                            className="bg-green-500 h-1 rounded-full transition-all duration-300 ease-out"
                                            style={{ width: `${loadingProgress}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>
            )}

            <header className={`bg-white shadow-sm ${(cacheLoading || isBackgroundLoading || cacheError) ? 'mt-16' : ''}`}>
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">
                                {currentView} Roadmap
                            </h1>
                            <p className="text-sm text-gray-600 mt-1">
                                Data Mode: <span className="font-semibold capitalize">{dataValidation.mode}</span>
                                {dataValidation.mode === 'mock' && (
                                    <span className="ml-2 bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">
                                        Demo Data
                                    </span>
                                )}
                                {dataValidation.mode === 'databricks' && (
                                    <span className="ml-2 bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                                        Live Data
                                    </span>
                                )}
                                {/* Cache Status Indicator */}
                                {!cacheLoading && !cacheError && (
                                    <span className="ml-2 bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                                        {isBackgroundLoading ? '🔄 Loading...' : '⚡ Cached'}
                                    </span>
                                )}
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            <label className="font-medium">View:</label>
                            <select
                                value={currentView}
                                onChange={(e) => handleViewChange(e.target.value)}
                                className="border border-gray-300 rounded px-2 py-1 bg-white"
                            >
                                <option value="Portfolio">Portfolio Roadmap</option>
                                <option value="Program">Program Roadmap</option>
                                <option value="SubProgram">Sub-Program Roadmap</option>
                                <option value="Region">Region Roadmap</option>
                            </select>
                        </div>
                    </div>
                </div>
            </header>

            <main className="mx-auto px-4 py-6">
                <div className="bg-white shadow rounded-lg p-6">
                    <Suspense fallback={
                        <div className="view-loading">
                            <div className="view-loading-spinner"></div>
                            <p className="view-loading-text">Loading {currentView} view...</p>
                        </div>
                    }>
                        {currentView === 'Portfolio' ? (
                            <PortfolioGanttChart
                                onDrillToProgram={(portfolioId, portfolioName) => {
                                    setSelectedPortfolioId(portfolioId);
                                    setSelectedPortfolioName(portfolioName);
                                    setCurrentView('Program');
                                }}
                            />
                        ) : currentView === 'Program' ? (
                            <ProgramGanttChart
                                selectedPortfolioId={selectedPortfolioId}
                                selectedPortfolioName={selectedPortfolioName}
                                onBackToPortfolio={() => {
                                    setCurrentView('Portfolio');
                                    setSelectedPortfolioId(null);
                                    setSelectedPortfolioName('');
                                }}
                                onDrillToSubProgram={(subProgramId, subProgramName) => {
                                    // Task 1: Drill-through from Program to SubProgram
                                    setSelectedSubProgramId(subProgramId);
                                    setSelectedSubProgramName(subProgramName);
                                    setCurrentView('SubProgram');
                                }}
                            />
                        ) : currentView === 'SubProgram' ? (
                            <SubProgramGanttChart
                                selectedSubProgramId={selectedSubProgramId}
                                selectedSubProgramName={selectedSubProgramName}
                                selectedProgramName={selectedPortfolioName} // Pass portfolio name for breadcrumb context
                                selectedProgramId={selectedPortfolioId} // Pass program ID for API calls
                                onNavigateUp={() => {
                                    setCurrentView('Program');
                                    setSelectedSubProgramId(null);
                                    setSelectedSubProgramName('');
                                }}
                                onBackToProgram={() => {
                                    setCurrentView('Program');
                                    setSelectedSubProgramId(null);
                                    setSelectedSubProgramName('');
                                }}
                            />
                        ) : (
                            <RegionRoadMap />
                        )}
                    </Suspense>
                </div>
            </main>
        </div>
    );
}

// Main App Component with Global Data Cache Provider
function App() {
    return (
        <GlobalDataCacheProvider>
            <AppContent />
        </GlobalDataCacheProvider>
    );
}

export default App;