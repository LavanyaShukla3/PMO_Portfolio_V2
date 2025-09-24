/**
 * Unified Pagination Service
 * Handles pagination logic across all views with consistent 13 items per page
 */

export const ITEMS_PER_PAGE = 13;

/**
 * Calculate pagination metadata
 * @param {number} totalItems - Total number of items
 * @param {number} currentPage - Current page number (1-based)
 * @param {number} itemsPerPage - Items per page (default: 13)
 * @returns {object} Pagination metadata
 */
export const getPaginationInfo = (totalItems, currentPage = 1, itemsPerPage = ITEMS_PER_PAGE) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
    
    return {
        totalPages,
        currentPage: Math.max(1, Math.min(currentPage, totalPages)),
        startIndex,
        endIndex,
        itemsPerPage,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1,
        itemsOnCurrentPage: endIndex - startIndex
    };
};

/**
 * Get paginated slice of data
 * @param {Array} data - Full data array
 * @param {number} currentPage - Current page number (1-based)
 * @param {number} itemsPerPage - Items per page (default: 13)
 * @returns {Array} Paginated data slice
 */
export const getPaginatedData = (data, currentPage = 1, itemsPerPage = ITEMS_PER_PAGE) => {
    if (!Array.isArray(data)) return [];
    
    const { startIndex, endIndex } = getPaginationInfo(data.length, currentPage, itemsPerPage);
    return data.slice(startIndex, endIndex);
};

/**
 * Handle page change with validation
 * @param {number} targetPage - Target page number
 * @param {number} totalPages - Total number of pages
 * @param {function} setCurrentPage - State setter for current page
 * @returns {boolean} Whether page change was successful
 */
export const handlePageChange = (targetPage, totalPages, setCurrentPage) => {
    const newPage = Math.max(1, Math.min(targetPage, totalPages));
    if (newPage !== targetPage) {
        console.warn(`Page ${targetPage} out of range, clamping to ${newPage}`);
    }
    
    setCurrentPage(newPage);
    return true;
};

/**
 * Reset pagination to first page
 * @param {function} setCurrentPage - State setter for current page
 */
export const resetToFirstPage = (setCurrentPage) => {
    setCurrentPage(1);
};

/**
 * Calculate total height for virtualized rendering
 * @param {Array} paginatedData - Current page data
 * @param {function} calculateBarHeight - Function to calculate individual item height
 * @param {object} responsiveConstants - Responsive constants object
 * @returns {number} Total height in pixels
 */
export const calculatePaginatedHeight = (paginatedData, calculateBarHeight, responsiveConstants) => {
    if (!Array.isArray(paginatedData) || paginatedData.length === 0) {
        return 400; // Minimum height
    }
    
    const minimalRowSpacing = Math.round(2 * (responsiveConstants.ZOOM_LEVEL || 1.0));
    const topMargin = Math.round(8 * (responsiveConstants.ZOOM_LEVEL || 1.0));
    
    const totalItemHeight = paginatedData.reduce((total, item) => {
        return total + calculateBarHeight(item) + minimalRowSpacing;
    }, 0);
    
    return topMargin + totalItemHeight + 100; // Add some bottom padding
};