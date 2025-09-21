import React, { useState, useEffect } from 'react';
import PortfolioGanttChart from './pages/PortfolioGanttChart';
import ProgramGanttChart from './pages/ProgramGanttChart';
import SubProgramGanttChart from './pages/SubProgramGanttChartFull';
import RegionRoadMap from './pages/RegionRoadMap';
import { GlobalDataCacheProvider, useGlobalDataCache } from './contexts/GlobalDataCacheContext';
import { validateApiData } from './utils/apiValidation';
import './App.css';

// Main App Content Component
function AppContent() {
    const [currentView, setCurrentView] = useState('Portfolio'); // Start with Portfolio view as default
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
        getViewState 
    } = useGlobalDataCache();

    // Validate data on app start
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

        validateData();
    }, []);

    // Show loading state
    if (dataValidation.isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 p-4">
                <div className="max-w-7xl mx-auto">
                    <div className="bg-blue-50 border border-blue-400 text-blue-700 px-4 py-3 rounded">
                        <h2 className="text-lg font-semibold mb-2">Loading Data...</h2>
                        <p>Connecting to backend and validating data...</p>
                    </div>
                </div>
            </div>
        );
    }

    // Show error state
    if (!dataValidation.isValid) {
        return (
            <div className="min-h-screen bg-gray-50 p-4">
                <div className="max-w-7xl mx-auto">
                    <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded">
                        <h2 className="text-lg font-semibold mb-2">Data Validation Error</h2>
                        <ul className="list-disc list-inside mb-3">
                            {dataValidation.errors.map((error, index) => (
                                <li key={index}>{error}</li>
                            ))}
                        </ul>
                        <button 
                            onClick={() => window.location.reload()} 
                            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                        >
                            Retry
                        </button>
                    </div>
                </div>
            </div>
        );
    }

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

    return (
        <div className="min-h-screen bg-gray-50">
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
                                    <span className="text-blue-700 font-medium">Loading Portfolio data...</span>
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