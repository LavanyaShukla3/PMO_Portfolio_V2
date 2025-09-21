import { QueryClient, useQuery, useMutation, useQueryClient } from 'react-query';

// Create a query client with optimized settings
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes
            cacheTime: 10 * 60 * 1000, // 10 minutes
            retry: 3,
            retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
        },
    },
});

// Query keys for different data types
export const QUERY_KEYS = {
    PORTFOLIO_DATA: 'portfolio-data',
    PROGRAM_DATA: 'program-data',
    SUBPROGRAM_DATA: 'subprogram-data',
    REGION_DATA: 'region-data',
    INVESTMENT_DATA: 'investment-data',
};

// API endpoints
const API_BASE = '/api';

// Generic API fetch function with error handling
const fetchFromAPI = async (endpoint, params = {}) => {
    const url = new URL(`${API_BASE}${endpoint}`, window.location.origin);
    
    // Add query parameters
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            url.searchParams.append(key, value);
        }
    });

    const response = await fetch(url);
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.status !== 'success') {
        throw new Error(result.message || 'API request failed');
    }
    
    return result.data;
};

// Progressive data loading functions
export const fetchPortfolioData = async (page = 1, limit = 50, filters = {}) => {
    return fetchFromAPI('/data/portfolio', {
        page,
        limit,
        ...filters
    });
};

export const fetchProgramData = async (portfolioId, page = 1, limit = 50) => {
    return fetchFromAPI('/data/program', {
        portfolioId,
        page,
        limit
    });
};

export const fetchSubProgramData = async (programId, page = 1, limit = 50) => {
    return fetchFromAPI('/data/subprogram', {
        programId,
        page,
        limit
    });
};

export const fetchRegionData = async (page = 1, limit = 50) => {
    return fetchFromAPI('/data/region', {
        page,
        limit
    });
};

// Legacy API function for backward compatibility
export const fetchLegacyData = async () => {
    try {
        const response = await fetchFromAPI('/data');
        // Ensure we always return an array
        if (Array.isArray(response)) {
            return response;
        } else if (response && typeof response === 'object' && response.data) {
            return Array.isArray(response.data) ? response.data : [];
        } else {
            console.warn('Legacy API returned non-array data:', response);
            return [];
        }
    } catch (error) {
        console.error('Legacy API failed:', error);
        throw error;
    }
};

// React Query hooks for data fetching
export const usePortfolioData = (page = 1, limit = 50, filters = {}) => {
    return useQuery(
        [QUERY_KEYS.PORTFOLIO_DATA, page, limit, filters],
        () => fetchPortfolioData(page, limit, filters),
        {
            keepPreviousData: true,
            staleTime: 2 * 60 * 1000, // 2 minutes for frequently accessed data
        }
    );
};

export const useProgramData = (portfolioId, page = 1, limit = 50) => {
    return useQuery(
        [QUERY_KEYS.PROGRAM_DATA, portfolioId, page, limit],
        () => fetchProgramData(portfolioId, page, limit),
        {
            enabled: !!portfolioId,
            keepPreviousData: true,
        }
    );
};

export const useSubProgramData = (programId, page = 1, limit = 50) => {
    return useQuery(
        [QUERY_KEYS.SUBPROGRAM_DATA, programId, page, limit],
        () => fetchSubProgramData(programId, page, limit),
        {
            enabled: !!programId,
            keepPreviousData: true,
        }
    );
};

export const useRegionData = (page = 1, limit = 50) => {
    return useQuery(
        [QUERY_KEYS.REGION_DATA, page, limit],
        () => fetchRegionData(page, limit),
        {
            keepPreviousData: true,
        }
    );
};

// Hook for legacy data (backward compatibility)
export const useLegacyData = () => {
    return useQuery(
        [QUERY_KEYS.PORTFOLIO_DATA, 'legacy'],
        fetchLegacyData,
        {
            staleTime: 5 * 60 * 1000,
            retry: 1, // Reduce retries to fail faster
        }
    );
};

// Data prefetching utilities
export const prefetchProgramData = (portfolioId) => {
    return queryClient.prefetchQuery(
        [QUERY_KEYS.PROGRAM_DATA, portfolioId, 1, 50],
        () => fetchProgramData(portfolioId, 1, 50)
    );
};

export const prefetchSubProgramData = (programId) => {
    return queryClient.prefetchQuery(
        [QUERY_KEYS.SUBPROGRAM_DATA, programId, 1, 50],
        () => fetchSubProgramData(programId, 1, 50)
    );
};

// Cache management utilities
export const invalidatePortfolioCache = () => {
    queryClient.invalidateQueries([QUERY_KEYS.PORTFOLIO_DATA]);
};

export const invalidateProgramCache = (portfolioId) => {
    queryClient.invalidateQueries([QUERY_KEYS.PROGRAM_DATA, portfolioId]);
};

export const invalidateSubProgramCache = (programId) => {
    queryClient.invalidateQueries([QUERY_KEYS.SUBPROGRAM_DATA, programId]);
};

export const clearAllCache = () => {
    queryClient.clear();
};
