/**
 * Test Cache Status Component
 * Displays cache loading progress and data status
 */
import React from 'react';
import { useGlobalDataCache } from '../contexts/GlobalDataCacheContext';

const CacheStatusTest = () => {
    const {
        portfolioData,
        programData,
        subProgramData,
        regionData,
        regionFilters,
        isLoading,
        isBackgroundLoading,
        loadingProgress,
        loadingStep,
        error,
        isCacheValid,
        cacheTimestamp,
    } = useGlobalDataCache();

    return (
        <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-4">🔄 Global Data Cache Status</h2>
            
            {/* Loading Status */}
            <div className="mb-6">
                <h3 className="font-semibold mb-2">Loading Status:</h3>
                <div className={`p-3 rounded ${
                    isLoading ? 'bg-blue-50 border border-blue-200' : 
                    isBackgroundLoading ? 'bg-yellow-50 border border-yellow-200' : 
                    'bg-green-50 border border-green-200'
                }`}>
                    <div className="flex items-center space-x-3">
                        {isLoading ? (
                            <>
                                <div className="w-4 h-4 bg-blue-500 rounded-full animate-spin border-2 border-white border-t-transparent"></div>
                                <span className="text-blue-700 font-medium">Initial Loading: {loadingStep}</span>
                                <span className="text-blue-600">{loadingProgress}%</span>
                            </>
                        ) : isBackgroundLoading ? (
                            <>
                                <div className="w-4 h-4 bg-yellow-500 rounded-full animate-pulse"></div>
                                <span className="text-yellow-700 font-medium">✅ UI Ready - Background Loading: {loadingStep}</span>
                                <span className="text-yellow-600">{loadingProgress}%</span>
                            </>
                        ) : (
                            <>
                                <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                                <span className="text-green-700 font-medium">✅ All Data Cached & Ready</span>
                            </>
                        )}
                    </div>
                    
                    {/* Progress Bar */}
                    {(isLoading || isBackgroundLoading) && (
                        <div className="mt-2">
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                    className={`h-2 rounded-full transition-all duration-300 ease-out ${
                                        isLoading ? 'bg-blue-600' : 'bg-yellow-500'
                                    }`}
                                    style={{ width: `${loadingProgress}%` }}
                                ></div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Error Status */}
            {error && (
                <div className="mb-6">
                    <h3 className="font-semibold mb-2">❌ Error:</h3>
                    <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700">
                        {error}
                    </div>
                </div>
            )}

            {/* Cache Info */}
            <div className="mb-6">
                <h3 className="font-semibold mb-2">Cache Info:</h3>
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span>Valid:</span>
                        <span className={isCacheValid ? 'text-green-600' : 'text-red-600'}>
                            {isCacheValid ? '✅ Yes' : '❌ No'}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span>Timestamp:</span>
                        <span className="text-gray-600">
                            {cacheTimestamp ? new Date(cacheTimestamp).toLocaleString() : 'Not set'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Data Status */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <h3 className="font-semibold mb-2">📊 Data Status:</h3>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span>Portfolio:</span>
                            <span className={portfolioData ? 'text-green-600' : 'text-gray-400'}>
                                {portfolioData ? `✅ ${portfolioData.data?.length || 0} items` : '⏳ Loading...'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span>Program:</span>
                            <span className={programData ? 'text-green-600' : 'text-gray-400'}>
                                {programData ? `✅ ${programData.data?.length || 0} items` : '⏳ Loading...'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span>SubProgram:</span>
                            <span className={subProgramData ? 'text-green-600' : 'text-gray-400'}>
                                {subProgramData ? `✅ ${subProgramData.projects?.length || 0} items` : '⏳ Loading...'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span>Region:</span>
                            <span className={regionData ? 'text-green-600' : 'text-gray-400'}>
                                {regionData ? `✅ ${regionData.data?.length || 0} items` : '⏳ Loading...'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span>Region Filters:</span>
                            <span className={regionFilters ? 'text-green-600' : 'text-gray-400'}>
                                {regionFilters ? '✅ Loaded' : '⏳ Loading...'}
                            </span>
                        </div>
                    </div>
                </div>

                <div>
                    <h3 className="font-semibold mb-2">🎯 Performance:</h3>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span>Total Items:</span>
                            <span className="text-blue-600 font-mono">
                                {(portfolioData?.data?.length || 0) + 
                                 (programData?.data?.length || 0) + 
                                 (subProgramData?.projects?.length || 0) + 
                                 (regionData?.data?.length || 0)}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span>Memory Usage:</span>
                            <span className="text-blue-600 font-mono">
                                ~{Math.round(JSON.stringify({
                                    portfolioData, programData, subProgramData, regionData
                                }).length / 1024)}KB
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span>Load Time:</span>
                            <span className="text-blue-600 font-mono">
                                {isLoading ? 'Loading Portfolio...' : 
                                 isBackgroundLoading ? 'UI Ready! (Background loading...)' : 
                                 'Instant ⚡'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Debug Info */}
            <details className="mt-6">
                <summary className="font-semibold cursor-pointer">🔍 Debug Info (Click to expand)</summary>
                <div className="mt-2 p-3 bg-gray-50 rounded text-xs font-mono overflow-auto max-h-40">
                    <pre>{JSON.stringify({
                        isLoading,
                        loadingProgress,
                        loadingStep,
                        error,
                        isCacheValid,
                        cacheTimestamp,
                        dataKeys: {
                            portfolio: portfolioData ? Object.keys(portfolioData) : null,
                            program: programData ? Object.keys(programData) : null,
                            subProgram: subProgramData ? Object.keys(subProgramData) : null,
                            region: regionData ? Object.keys(regionData) : null,
                            regionFilters: regionFilters ? Object.keys(regionFilters) : null,
                        }
                    }, null, 2)}</pre>
                </div>
            </details>
        </div>
    );
};

export default CacheStatusTest;