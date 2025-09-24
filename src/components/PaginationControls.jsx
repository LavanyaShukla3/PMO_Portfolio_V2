import React from 'react';

/**
 * Unified Pagination Component
 * Provides numbered page buttons with 25 items per page
 * Replaces the old "Load More" button approach
 */
const PaginationControls = ({ 
    currentPage, 
    totalItems, 
    itemsPerPage = 25, 
    onPageChange,
    className = "" 
}) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    
    // Don't render if there's only one page or no items
    if (totalPages <= 1) return null;
    
    // Calculate which page numbers to show
    const getVisiblePages = () => {
        const delta = 2; // Show 2 pages before and after current page
        const range = [];
        const rangeWithDots = [];
        
        for (let i = Math.max(2, currentPage - delta); 
             i <= Math.min(totalPages - 1, currentPage + delta); 
             i++) {
            range.push(i);
        }
        
        if (currentPage - delta > 2) {
            rangeWithDots.push(1, '...');
        } else {
            rangeWithDots.push(1);
        }
        
        rangeWithDots.push(...range);
        
        if (currentPage + delta < totalPages - 1) {
            rangeWithDots.push('...', totalPages);
        } else {
            rangeWithDots.push(totalPages);
        }
        
        return rangeWithDots;
    };
    
    const visiblePages = getVisiblePages();
    
    return (
        <div className={`flex flex-wrap items-center justify-center gap-2 py-4 ${className}`}>
            {/* Previous button */}
            <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Previous
            </button>
            
            {/* Page numbers */}
            {visiblePages.map((page, index) => (
                <React.Fragment key={`${page}-${index}`}>
                    {page === '...' ? (
                        <span className="px-3 py-2 text-sm font-medium text-gray-500">
                            ...
                        </span>
                    ) : (
                        <button
                            onClick={() => onPageChange(page)}
                            className={`px-3 py-2 text-sm font-medium rounded-md ${
                                currentPage === page
                                    ? 'text-white bg-blue-600 border border-blue-600'
                                    : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                            }`}
                        >
                            {page}
                        </button>
                    )}
                </React.Fragment>
            ))}
            
            {/* Next button */}
            <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Next
            </button>
            
            {/* Page info - responsive, can wrap to new line */}
            <div className="w-full sm:w-auto mt-2 sm:mt-0 sm:ml-4 text-sm text-gray-700 text-center sm:text-left">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} items
            </div>
        </div>
    );
};

export default PaginationControls;