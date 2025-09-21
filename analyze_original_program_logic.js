const fetch = require('node-fetch');

async function analyzeOriginalProgramLogic() {
    console.log('🔍 Analyzing Original Program Logic from apiDataService.js...\n');
    
    try {
        const response = await fetch('http://localhost:5000/api/data');
        const data = await response.json();
        
        const hierarchyData = data.data.hierarchy;
        
        console.log('🔍 Step 1: Filter for Program and SubProgram types');
        
        // Test both versions
        const programTypeDataOld = hierarchyData.filter(item => 
            item.COE_ROADMAP_TYPE === 'Program' || item.COE_ROADMAP_TYPE === 'SubProgram'
        );
        
        const programTypeDataCorrect = hierarchyData.filter(item => 
            item.COE_ROADMAP_TYPE === 'Program' || item.COE_ROADMAP_TYPE === 'Sub-Program'
        );
        
        console.log(`Using 'SubProgram': ${programTypeDataOld.length} records`);
        console.log(`Using 'Sub-Program': ${programTypeDataCorrect.length} records`);
        
        // Use the correct version
        const programTypeData = programTypeDataCorrect;
        
        console.log('\n🔍 Step 2: Look for self-referencing programs (COE_ROADMAP_PARENT_ID === CHILD_ID)');
        
        const selfReferencingPrograms = programTypeData.filter(item => 
            item.COE_ROADMAP_PARENT_ID === item.CHILD_ID && item.COE_ROADMAP_TYPE === 'Program'
        );
        
        console.log(`Self-referencing programs found: ${selfReferencingPrograms.length}`);
        
        if (selfReferencingPrograms.length > 0) {
            console.log('Sample self-referencing programs:');
            selfReferencingPrograms.slice(0, 5).forEach(prog => {
                console.log(`  ${prog.CHILD_ID}: ${prog.CHILD_NAME} (Parent: ${prog.COE_ROADMAP_PARENT_ID})`);
            });
        }
        
        console.log('\n🔍 Step 3: Filter for selectedPortfolioId = PTF000109');
        const selectedPortfolioId = 'PTF000109';
        
        // Original logic
        const filteredData = programTypeData.filter(item => 
            item.COE_ROADMAP_PARENT_ID === selectedPortfolioId ||
            programTypeData.some(parent => 
                parent.CHILD_ID === item.COE_ROADMAP_PARENT_ID && 
                parent.COE_ROADMAP_PARENT_ID === selectedPortfolioId
            )
        );
        
        console.log(`Programs filtered for ${selectedPortfolioId}: ${filteredData.length}`);
        
        if (filteredData.length > 0) {
            console.log('Sample filtered programs:');
            filteredData.slice(0, 10).forEach(prog => {
                console.log(`  ${prog.CHILD_ID}: ${prog.CHILD_NAME} (${prog.COE_ROADMAP_TYPE}) -> Parent: ${prog.COE_ROADMAP_PARENT_ID}`);
            });
        }
        
        console.log('\n🔍 Step 4: Find parent programs in filtered data');
        const parentPrograms = filteredData.filter(item => 
            item.COE_ROADMAP_PARENT_ID === item.CHILD_ID && item.COE_ROADMAP_TYPE === 'Program'
        );
        
        console.log(`Parent programs in filtered data: ${parentPrograms.length}`);
        
        if (parentPrograms.length > 0) {
            console.log('Parent programs:');
            parentPrograms.forEach(prog => {
                console.log(`  ${prog.CHILD_ID}: ${prog.CHILD_NAME}`);
                
                // Find children
                const children = filteredData.filter(item => 
                    item.COE_ROADMAP_PARENT_ID === prog.CHILD_ID && 
                    item.CHILD_ID !== prog.CHILD_ID
                );
                
                console.log(`    Children: ${children.length}`);
                children.slice(0, 3).forEach(child => {
                    console.log(`      - ${child.CHILD_ID}: ${child.CHILD_NAME} (${child.COE_ROADMAP_TYPE})`);
                });
            });
        }
        
        console.log('\n🎯 Conclusion:');
        if (parentPrograms.length === 0) {
            console.log('❌ No parent programs found using original logic');
            console.log('This explains why the Program page shows "Loading data..."');
            console.log('The original logic expects self-referencing programs that may not exist in this dataset');
        } else {
            console.log('✅ Parent programs found - original logic should work');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

analyzeOriginalProgramLogic();
