const fetch = require('node-fetch');

async function analyzeRegionData() {
    const BASE_URL = 'http://localhost:5000';
    
    console.log('🔍 COMPREHENSIVE REGION DATA ANALYSIS');
    console.log('=====================================\n');
    
    try {
        console.log('📊 Step 1: Testing pagination to get total record count...');
        
        // Test different page sizes to understand total data volume
        const pageSizes = [20, 50, 100, 200];
        
        for (const pageSize of pageSizes) {
            console.log(`\n--- Testing with limit=${pageSize} ---`);
            const response = await fetch(`${BASE_URL}/api/data/region?page=1&limit=${pageSize}`);
            const data = await response.json();
            
            if (data.data) {
                console.log(`✅ Status: ${response.status}`);
                console.log(`   Hierarchy records: ${data.data.hierarchy?.length || 0}`);
                console.log(`   Investment records: ${data.data.investment?.length || 0}`);
                console.log(`   Total returned: ${(data.data.hierarchy?.length || 0) + (data.data.investment?.length || 0)}`);
                
                // Check if we got the full requested amount (indicates more data available)
                const totalReturned = (data.data.hierarchy?.length || 0) + (data.data.investment?.length || 0);
                if (totalReturned === pageSize * 2) { // pageSize for each of hierarchy and investment
                    console.log(`   🔍 Possibly more data available (got exactly requested amount)`);
                } else {
                    console.log(`   ✅ Likely all data returned (got less than requested)`);
                }
            }
        }
        
        console.log('\n📊 Step 2: Analyzing data structure with largest fetch...');
        const largeResponse = await fetch(`${BASE_URL}/api/data/region?page=1&limit=500`);
        const largeData = await largeResponse.json();
        
        if (largeData.data?.investment) {
            const investments = largeData.data.investment;
            console.log(`\n🔍 DETAILED DATA ANALYSIS (${investments.length} investment records):`);
            
            // Analyze unique project IDs
            const uniqueProjects = new Set(investments.map(inv => inv.INV_EXT_ID));
            console.log(`   Unique project IDs: ${uniqueProjects.size}`);
            console.log(`   Project IDs: ${Array.from(uniqueProjects).join(', ')}`);
            
            // Analyze ROADMAP_ELEMENT distribution
            const roadmapElements = {};
            investments.forEach(inv => {
                const element = inv.ROADMAP_ELEMENT || 'null';
                roadmapElements[element] = (roadmapElements[element] || 0) + 1;
            });
            console.log(`   ROADMAP_ELEMENT distribution:`, roadmapElements);
            
            // Analyze CLRTY_INV_TYPE distribution
            const invTypes = {};
            investments.forEach(inv => {
                const type = inv.CLRTY_INV_TYPE || 'null';
                invTypes[type] = (invTypes[type] || 0) + 1;
            });
            console.log(`   CLRTY_INV_TYPE distribution:`, invTypes);
            
            // Analyze INV_MARKET patterns
            const markets = {};
            investments.forEach(inv => {
                const market = inv.INV_MARKET || 'null';
                markets[market] = (markets[market] || 0) + 1;
            });
            console.log(`   INV_MARKET patterns:`, markets);
            
            // Show detailed breakdown per project
            console.log(`\n🔍 PER-PROJECT BREAKDOWN:`);
            uniqueProjects.forEach(projectId => {
                const projectRecords = investments.filter(inv => inv.INV_EXT_ID === projectId);
                const recordTypes = projectRecords.map(r => r.ROADMAP_ELEMENT);
                console.log(`   ${projectId}: ${projectRecords.length} records [${recordTypes.join(', ')}]`);
                
                // Check if project has Investment record
                const hasInvestmentRecord = projectRecords.some(r => r.ROADMAP_ELEMENT === 'Investment');
                if (!hasInvestmentRecord) {
                    console.log(`     ⚠️  WARNING: No 'Investment' record found for this project!`);
                }
            });
        }
        
        console.log('\n📊 Step 3: Testing multiple pages to see total data volume...');
        let totalRecordsFound = 0;
        let page = 1;
        const recordsPerPage = 100;
        
        while (page <= 10) { // Limit to prevent infinite loop
            const response = await fetch(`${BASE_URL}/api/data/region?page=${page}&limit=${recordsPerPage}`);
            const data = await response.json();
            
            if (data.data?.investment) {
                const pageRecords = data.data.investment.length;
                totalRecordsFound += pageRecords;
                console.log(`   Page ${page}: ${pageRecords} investment records`);
                
                if (pageRecords < recordsPerPage) {
                    console.log(`   ✅ Reached end of data at page ${page}`);
                    break;
                }
            } else {
                console.log(`   ❌ No data on page ${page}`);
                break;
            }
            page++;
        }
        
        console.log(`\n✅ TOTAL INVESTMENT RECORDS FOUND: ${totalRecordsFound}`);
        
    } catch (error) {
        console.error('❌ Error analyzing region data:', error.message);
    }
}

analyzeRegionData();