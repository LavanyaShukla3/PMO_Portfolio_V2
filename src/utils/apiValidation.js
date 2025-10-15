/**
 * API validation utilities for checking backend connectivity
 * Enhanced with debugging to troubleshoot connection issues
 */

/**
 * Debug API responses to see what's being returned
 */
const debugApiResponse = async (url, description) => {
    try {
        // Add timeout to prevent indefinite hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        const responseText = await response.text();
        
        
        if (responseText.startsWith('<!DOCTYPE')) {

            return { error: 'HTML_RESPONSE', response: responseText };
        }
        
        try {
            const jsonData = JSON.parse(responseText);

            return { success: true, data: jsonData };
        } catch (parseError) {

            return { error: 'INVALID_JSON', response: responseText };
        }
        
    } catch (networkError) {
        if (networkError.name === 'AbortError') {
            return { error: 'TIMEOUT', message: 'Request timed out after 10 seconds' };
        }
        return { error: 'NETWORK_ERROR', message: networkError.message };
    }
};

/**
 * Validates that the backend API is accessible and returns expected data
 * @returns {Promise<Object>} Validation result with isValid, errors, and mode
 */
export const validateApiData = async () => {
    // Use the correct backend URLs
    const API_BASE_URL = 'http://localhost:5000';
    
    // OPTIMIZED: Only check health endpoint for validation
    // This is much faster than fetching actual data from Databricks
    const endpoints = [
        { url: `${API_BASE_URL}/api/health`, name: 'Health Check' }
    ];
    
    const results = [];
    
    for (const endpoint of endpoints) {
        const result = await debugApiResponse(endpoint.url, endpoint.name);
        results.push({ ...endpoint, ...result });
    }
    
    // Check if all succeeded
    const allSuccess = results.every(r => r.success);
    
    if (allSuccess) {
        // Get mode from health check
        const healthResult = results.find(r => r.name === 'Health Check');
        const mode = healthResult?.data?.mode || 'unknown';
        
        return {
            isValid: true,
            errors: [],
            mode: mode,
            counts: {
                portfolios: 0,
                investments: 0
            }
        };
    } else {
        const errors = results
            .filter(r => !r.success)
            .map(r => {
                if (r.error === 'HTML_RESPONSE') {
                    return `${r.name}: Backend server not running - received HTML instead of JSON. Please start Flask server with: python backend/app.py`;
                } else if (r.error === 'NETWORK_ERROR') {
                    return `${r.name}: ${r.message} - Check if backend is running on localhost:5000`;
                } else if (r.error === 'TIMEOUT') {
                    return `${r.name}: Request timed out - Backend may be slow or unresponsive`;
                } else {
                    return `${r.name}: ${r.error}`;
                }
            });
            
        return {
            isValid: false,
            errors: errors,
            mode: 'unknown',
            counts: {
                portfolios: 0,
                investments: 0
            }
        };
    }
};
