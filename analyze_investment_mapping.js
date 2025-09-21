const fetch = require('node-fetch');

async function analyzeInvestmentMapping() {
    try {
        console.log('🔍 Analyzing investment data mapping...');
        const response = await fetch('http://localhost:5000/api/data');
        const data = await response.json();
        
        const hierarchyData = data.data.hierarchy;
        const investmentData = data.data.investment;
        
        console.log(`📊 Dataset: ${hierarchyData.length} hierarchy, ${investmentData.length} investment records`);
        
        // Find our target programs in hierarchy
        const targetPrograms = ['PROG000328', 'PROG000268'];
        
        console.log('\n🎯 Target Programs in Hierarchy:');
        targetPrograms.forEach(programId => {
            const hierarchyRecord = hierarchyData.find(h => h.CHILD_ID === programId);
            if (hierarchyRecord) {
                console.log(`\n${programId} (${hierarchyRecord.CHILD_NAME}):`);
                console.log(`  - COE_ROADMAP_TYPE: ${hierarchyRecord.COE_ROADMAP_TYPE}`);
                console.log(`  - COE_ROADMAP_PARENT_ID: ${hierarchyRecord.COE_ROADMAP_PARENT_ID}`);
                console.log(`  - COE_ROADMAP_PARENT_NAME: ${hierarchyRecord.COE_ROADMAP_PARENT_NAME}`);
                console.log(`  - HIERARCHY_EXTERNAL_ID: ${hierarchyRecord.HIERARCHY_EXTERNAL_ID}`);
            }
        });
        
        // Analyze investment data fields and look for our targets
        console.log('\n🔍 Checking investment data fields...');
        if (investmentData.length > 0) {
            console.log('Sample investment record fields:');
            console.log(Object.keys(investmentData[0]));
            
            // Look for investment records related to our targets
            console.log('\n🎯 Searching for investment records related to target programs...');
            
            targetPrograms.forEach(programId => {
                console.log(`\n${programId}:`);
                
                // Try different possible field mappings
                const byInvExtId = investmentData.filter(inv => inv.INV_EXT_ID === programId);
                const byProgramId = investmentData.filter(inv => inv.PROGRAM_ID === programId);
                const byPortfolioId = investmentData.filter(inv => inv.PORTFOLIO_ID === programId);
                const byInvestmentId = investmentData.filter(inv => inv.INVESTMENT_ID === programId);
                
                console.log(`  - INV_EXT_ID matches: ${byInvExtId.length}`);
                console.log(`  - PROGRAM_ID matches: ${byProgramId.length}`);
                console.log(`  - PORTFOLIO_ID matches: ${byPortfolioId.length}`);
                console.log(`  - INVESTMENT_ID matches: ${byInvestmentId.length}`);
                
                // Show any matches
                if (byInvExtId.length > 0) {
                    console.log('  INV_EXT_ID matches:', byInvExtId.map(inv => ({ name: inv.INVESTMENT_NAME, status: inv.INV_OVERALL_STATUS })));
                }
                if (byProgramId.length > 0) {
                    console.log('  PROGRAM_ID matches:', byProgramId.map(inv => ({ name: inv.INVESTMENT_NAME, status: inv.INV_OVERALL_STATUS })));
                }
                if (byPortfolioId.length > 0) {
                    console.log('  PORTFOLIO_ID matches:', byPortfolioId.map(inv => ({ name: inv.INVESTMENT_NAME, status: inv.INV_OVERALL_STATUS })));
                }
                if (byInvestmentId.length > 0) {
                    console.log('  INVESTMENT_ID matches:', byInvestmentId.map(inv => ({ name: inv.INVESTMENT_NAME, status: inv.INV_OVERALL_STATUS })));
                }
            });
            
            // Let's also check what investment records exist for the portfolio PTF000109
            console.log('\n🔍 Checking investments for portfolio PTF000109 (Commercial Programs):');
            const portfolioInvestments = investmentData.filter(inv => 
                inv.PORTFOLIO_ID === 'PTF000109' || 
                inv.INV_EXT_ID?.startsWith('PTF000109') ||
                inv.PROGRAM_ID === 'PTF000109'
            );
            
            console.log(`Found ${portfolioInvestments.length} investments linked to PTF000109`);
            if (portfolioInvestments.length > 0) {
                portfolioInvestments.slice(0, 5).forEach(inv => {
                    console.log(`  - ${inv.INVESTMENT_NAME} (${inv.INVESTMENT_ID}) - Program: ${inv.PROGRAM_ID}, Portfolio: ${inv.PORTFOLIO_ID}`);
                });
            }
            
            // Check if investments reference our programs by name
            console.log('\n🔍 Searching by investment name containing target program names...');
            targetPrograms.forEach(programId => {
                const hierarchyRecord = hierarchyData.find(h => h.CHILD_ID === programId);
                if (hierarchyRecord) {
                    const programName = hierarchyRecord.CHILD_NAME;
                    const nameMatches = investmentData.filter(inv => 
                        inv.INVESTMENT_NAME?.toLowerCase().includes(programName.toLowerCase())
                    );
                    
                    console.log(`"${programName}" name matches: ${nameMatches.length}`);
                    nameMatches.slice(0, 3).forEach(inv => {
                        console.log(`  - ${inv.INVESTMENT_NAME} (${inv.INVESTMENT_ID}) - Program: ${inv.PROGRAM_ID}`);
                    });
                }
            });
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

analyzeInvestmentMapping();
