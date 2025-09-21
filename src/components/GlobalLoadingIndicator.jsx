import React from 'react';

const GlobalLoadingIndicator = ({ isLoading, loadingProgress, loadingStep, error }) => {
    if (!isLoading && !error) return null;

    return (
        <div className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 shadow-sm z-50">
            <div className="max-w-7xl mx-auto px-4 py-3">
                {error ? (
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
                            <span className="text-red-700 font-medium">Error loading data</span>
                            <span className="text-red-600 text-sm">{error}</span>
                        </div>
                        <button 
                            onClick={() => window.location.reload()}
                            className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                        >
                            Retry
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-3">
                            <div className="w-4 h-4 bg-blue-500 rounded-full animate-spin border-2 border-white border-t-transparent"></div>
                            <span className="text-blue-700 font-medium">Loading data in background...</span>
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
                )}
            </div>
        </div>
    );
};

export default GlobalLoadingIndicator;