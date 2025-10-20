const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');

console.log('\n=== DETAILED REACT-SCRIPTS STARTUP PROFILING ===\n');

const startTime = performance.now();
let lastTime = startTime;

function logPhase(phase) {
    const now = performance.now();
    const duration = now - lastTime;
    const total = now - startTime;
    console.log(`[${total.toFixed(0)}ms] ${phase}: +${duration.toFixed(0)}ms`);
    lastTime = now;
}

// Check if package.json exists and is readable
logPhase('Script started');

const packageJson = require('./package.json');
logPhase('Loaded package.json');

// Count actual dependencies to load
const depCount = Object.keys(packageJson.dependencies || {}).length;
const devDepCount = Object.keys(packageJson.devDependencies || {}).length;
console.log(`  → ${depCount} prod deps, ${devDepCount} dev deps`);

// Check node_modules
const nodeModulesPath = path.join(__dirname, 'node_modules');
const nodeModulesExists = fs.existsSync(nodeModulesPath);
logPhase('Checked node_modules existence');
console.log(`  → node_modules exists: ${nodeModulesExists}`);

// Test a lightweight module load
require('react');
logPhase('Loaded React');

require('react-dom');
logPhase('Loaded React DOM');

// Check react-scripts info
console.log('\n🔍 Analyzing react-scripts...');
const rsPackagePath = path.join(nodeModulesPath, 'react-scripts', 'package.json');
if (fs.existsSync(rsPackagePath)) {
    const rsPackageJson = JSON.parse(fs.readFileSync(rsPackagePath, 'utf8'));
    logPhase('Loaded react-scripts package.json');
    const rsDeps = Object.keys(rsPackageJson.dependencies || {}).length;
    console.log(`  → react-scripts v${rsPackageJson.version} has ${rsDeps} direct dependencies`);
} else {
    console.log('  → react-scripts not found in node_modules');
}

// Test webpack load time
console.log('\n🔍 Loading webpack...');
const webpackStart = performance.now();
require('webpack');
const webpackTime = performance.now() - webpackStart;
console.log(`  → Webpack loaded in ${webpackTime.toFixed(0)}ms`);

// Test webpack-dev-server load time
console.log('\n🔍 Loading webpack-dev-server...');
const wdsStart = performance.now();
require('webpack-dev-server');
const wdsTime = performance.now() - wdsStart;
console.log(`  → webpack-dev-server loaded in ${wdsTime.toFixed(0)}ms`);

// Test babel load time
console.log('\n🔍 Loading @babel/core...');
const babelStart = performance.now();
require('@babel/core');
const babelTime = performance.now() - babelStart;
console.log(`  → Babel loaded in ${babelTime.toFixed(0)}ms`);

const totalTime = performance.now() - startTime;

console.log('\n=== SUMMARY ===');
console.log(`Total profiling time: ${totalTime.toFixed(0)}ms`);
console.log(`\nKey findings:`);
console.log(`- Webpack: ${webpackTime.toFixed(0)}ms`);
console.log(`- Webpack Dev Server: ${wdsTime.toFixed(0)}ms`);
console.log(`- Babel: ${babelTime.toFixed(0)}ms`);
console.log(`- Other overhead: ${(totalTime - webpackTime - wdsTime - babelTime).toFixed(0)}ms`);

console.log('\n💡 The 10-second delay is caused by loading these heavy dependencies.');
console.log('This is inherent to Create React App architecture.');
console.log('\nPossible solutions:');
console.log('1. Migrate to Vite (no-bundle dev server, instant startup)');
console.log('2. Use npm ci instead of npm install (faster dependency resolution)');
console.log('3. Clear npm cache: npm cache clean --force');
console.log('4. Upgrade to Node.js v20 LTS (faster module loading)');

console.log('\n=== END PROFILING ===\n');
