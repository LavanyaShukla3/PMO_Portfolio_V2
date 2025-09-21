/**
 * Simple Backend Health Check
 */

const fetch = require('node-fetch');

async function healthCheck() {
    console.log('🔍 Backend Health Check\n');
    
    try {
        // Test basic connection
        console.log('Testing basic connection...');
        const response = await fetch('http://localhost:5000/api/health', {
            timeout: 5000
        });
        
        if (response.ok) {
            const data = await response.text();
            console.log('✅ Backend is responding:', data);
        } else {
            console.log('❌ Backend responded with error:', response.status);
        }
        
    } catch (error) {
        console.log('❌ Backend connection failed:', error.message);
        
        // Try alternative endpoints
        try {
            console.log('\nTrying alternative endpoint...');
            const altResponse = await fetch('http://127.0.0.1:5000/api/health');
            if (altResponse.ok) {
                console.log('✅ Backend responding on 127.0.0.1');
            }
        } catch (altError) {
            console.log('❌ Alternative endpoint also failed:', altError.message);
        }
    }
}

healthCheck();
