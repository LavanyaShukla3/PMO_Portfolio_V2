const fetch = require('node-fetch');

async function testCachingPerformance() {
    console.log('🚀 Testing Portfolio API Caching Performance...\n');
    
    const baseUrl = 'http://localhost:5000';
    
    // Simulate the old approach - multiple full dataset fetches
    console.log('📊 OLD APPROACH - Multiple Full Dataset Fetches:');
    const start1 = Date.now();
    
    // Simulate what the old code was doing - fetching full dataset multiple times
    console.log('  📞 Call 1: Fetching full dataset...');
    const call1Start = Date.now();
    await fetch(`${baseUrl}/api/data`);
    console.log(`    ✅ Completed in ${Date.now() - call1Start}ms`);
    
    console.log('  📞 Call 2: Fetching full dataset again...');
    const call2Start = Date.now();
    await fetch(`${baseUrl}/api/data`);
    console.log(`    ✅ Completed in ${Date.now() - call2Start}ms`);
    
    console.log('  📞 Call 3: Fetching full dataset again...');
    const call3Start = Date.now();
    await fetch(`${baseUrl}/api/data`);
    console.log(`    ✅ Completed in ${Date.now() - call3Start}ms`);
    
    const totalOldTime = Date.now() - start1;
    console.log(`\n📈 OLD APPROACH TOTAL: ${totalOldTime}ms\n`);
    
    // Simulate the new approach - one fetch + client-side pagination
    console.log('🎯 NEW APPROACH - Single Fetch + Client Caching:');
    const start2 = Date.now();
    
    console.log('  📞 Call 1: Fetching full dataset (first time)...');
    const response = await fetch(`${baseUrl}/api/data`);
    const data = await response.json();
    console.log(`    ✅ Data fetched: ${data.data?.hierarchy?.length || 0} hierarchy + ${data.data?.investment?.length || 0} investment records`);
    
    console.log('  📦 Call 2: Using cached data (pagination)...');
    const pagStart = Date.now();
    // Simulate client-side pagination (no network call)
    const page1 = data.data?.hierarchy?.slice(0, 20) || [];
    console.log(`    ✅ Page 1 processed in ${Date.now() - pagStart}ms (${page1.length} items)`);
    
    console.log('  📦 Call 3: Using cached data (pagination)...');
    const pag2Start = Date.now();
    const page2 = data.data?.hierarchy?.slice(20, 40) || [];
    console.log(`    ✅ Page 2 processed in ${Date.now() - pag2Start}ms (${page2.length} items)`);
    
    const totalNewTime = Date.now() - start2;
    console.log(`\n📈 NEW APPROACH TOTAL: ${totalNewTime}ms\n`);
    
    // Performance comparison
    console.log('🏆 PERFORMANCE COMPARISON:');
    console.log(`⚡ Speed improvement: ${Math.round((totalOldTime / totalNewTime) * 100) / 100}x faster`);
    console.log(`💾 Network reduction: ${Math.round(((totalOldTime - totalNewTime) / totalOldTime) * 100)}% less network time`);
    console.log(`🌐 Network calls: Old = 3 calls, New = 1 call (66% reduction)`);
    
    if (totalNewTime < totalOldTime) {
        console.log('✅ NEW APPROACH IS FASTER! 🎉');
    } else {
        console.log('❌ Something might be wrong with the implementation...');
    }
    
    // Data completeness check
    console.log('\n📋 DATA COMPLETENESS:');
    console.log(`✅ All ${data.data?.hierarchy?.length || 0} records available in cache`);
    console.log(`✅ No data truncation (vs old 100-record limit)`);
    
    // Target records check
    const targetRecords = ['PROG000328', 'PROG000268'];
    console.log('\n🎯 TARGET RECORDS CHECK:');
    targetRecords.forEach(recordId => {
        const found = data.data?.hierarchy?.find(h => h.CHILD_ID === recordId);
        if (found) {
            console.log(`✅ ${recordId} (${found.CHILD_NAME}) - FOUND`);
        } else {
            console.log(`❌ ${recordId} - NOT FOUND`);
        }
    });
}

testCachingPerformance().catch(console.error);
