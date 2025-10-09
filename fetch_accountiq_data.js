/**
 * Script to fetch live AccountIQ SubProgram data from the database
 * This will help us understand the milestone positioning issue
 */

const fetch = require('node-fetch');
const fs = require('fs');

const API_BASE_URL = 'http://localhost:5000';

async function fetchAccountIQData() {
    try {
        console.log('🔍 Fetching full dataset from API...');
        
        // Fetch the complete dataset
        const response = await fetch(`${API_BASE_URL}/api/data`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.status !== 'success') {
            throw new Error(result.message || 'Failed to fetch data');
        }
        
        console.log('✅ Data fetched successfully');
        console.log(`📊 Total hierarchy records: ${result.data.hierarchy.length}`);
        console.log(`📊 Total investment records: ${result.data.investment.length}`);
        
        // Filter for AccountIQ SubPrograms
        const accountIQProjects = [
            'AccountIQ/Brazil',
            'AccountIQ/Canada',
            'AccountIQ/Chile',
            'AccountIQ/France'
        ];
        
        const filteredData = {
            hierarchy: [],
            investment: [],
            milestones: []
        };
        
        // Find hierarchy records for AccountIQ
        result.data.hierarchy.forEach(record => {
            const projectName = record.CHILD_NAME || '';
            if (accountIQProjects.some(name => projectName.includes('AccountIQ'))) {
                filteredData.hierarchy.push(record);
            }
        });
        
        // Find investment records for AccountIQ
        result.data.investment.forEach(record => {
            const projectName = record.INVESTMENT_NAME || '';
            if (accountIQProjects.some(name => projectName.includes('AccountIQ'))) {
                filteredData.investment.push(record);
                
                // Separate milestones
                if (record.ROADMAP_ELEMENT && record.ROADMAP_ELEMENT.includes('Milestones')) {
                    filteredData.milestones.push({
                        project: record.INVESTMENT_NAME,
                        taskName: record.TASK_NAME,
                        taskStart: record.TASK_START,
                        taskFinish: record.TASK_FINISH,
                        milestoneStatus: record.MILESTONE_STATUS,
                        roadmapElement: record.ROADMAP_ELEMENT,
                        invExtId: record.INV_EXT_ID
                    });
                }
            }
        });
        
        console.log('\n📋 AccountIQ Data Summary:');
        console.log(`  - Hierarchy records: ${filteredData.hierarchy.length}`);
        console.log(`  - Investment records: ${filteredData.investment.length}`);
        console.log(`  - Milestone records: ${filteredData.milestones.length}`);
        
        // Log specific milestones we're looking for
        console.log('\n🎯 Looking for specific milestones:');
        console.log('  1. SG3 milestone with date 2026-06-30 (Brazil)');
        console.log('  2. Milestone with date 2026-01-23');
        
        const june2026Milestones = filteredData.milestones.filter(m => 
            m.taskStart && m.taskStart.includes('2026-06-30')
        );
        
        const jan2026Milestones = filteredData.milestones.filter(m => 
            m.taskStart && m.taskStart.includes('2026-01-23')
        );
        
        console.log(`\n📍 June 2026 (2026-06-30) milestones found: ${june2026Milestones.length}`);
        june2026Milestones.forEach(m => {
            console.log(`  - ${m.project}: ${m.taskName} (${m.taskStart})`);
        });
        
        console.log(`\n📍 January 2026 (2026-01-23) milestones found: ${jan2026Milestones.length}`);
        jan2026Milestones.forEach(m => {
            console.log(`  - ${m.project}: ${m.taskName} (${m.taskStart})`);
        });
        
        // Save to file
        const outputFile = 'accountiq_data_export.json';
        fs.writeFileSync(outputFile, JSON.stringify(filteredData, null, 2));
        console.log(`\n✅ Data exported to ${outputFile}`);
        
        // Also create a summary file
        const summaryFile = 'accountiq_milestone_summary.txt';
        let summary = '=== AccountIQ Milestone Data Summary ===\n\n';
        
        summary += 'Projects Found:\n';
        const uniqueProjects = [...new Set(filteredData.milestones.map(m => m.project))];
        uniqueProjects.forEach(project => {
            const projectMilestones = filteredData.milestones.filter(m => m.project === project);
            summary += `\n${project} (${projectMilestones.length} milestones):\n`;
            projectMilestones.forEach(m => {
                summary += `  - ${m.taskStart}: ${m.taskName} [${m.milestoneStatus}]\n`;
            });
        });
        
        summary += '\n\n=== ISSUE INVESTIGATION ===\n\n';
        summary += '1. June 2026 Milestone (Expected: June, Actual: April):\n';
        june2026Milestones.forEach(m => {
            summary += `   Project: ${m.project}\n`;
            summary += `   Task: ${m.taskName}\n`;
            summary += `   Date: ${m.taskStart}\n`;
            summary += `   Status: ${m.milestoneStatus}\n`;
            summary += `   Type: ${m.roadmapElement}\n\n`;
        });
        
        summary += '2. January 2026 Milestone (Missing from display):\n';
        jan2026Milestones.forEach(m => {
            summary += `   Project: ${m.project}\n`;
            summary += `   Task: ${m.taskName}\n`;
            summary += `   Date: ${m.taskStart}\n`;
            summary += `   Status: ${m.milestoneStatus}\n`;
            summary += `   Type: ${m.roadmapElement}\n\n`;
        });
        
        fs.writeFileSync(summaryFile, summary);
        console.log(`✅ Summary exported to ${summaryFile}`);
        
    } catch (error) {
        console.error('❌ Error fetching data:', error.message);
        process.exit(1);
    }
}

// Run the script
fetchAccountIQData();
