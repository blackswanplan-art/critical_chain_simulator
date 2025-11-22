#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read the HTML template
const html = fs.readFileSync('index-strategic.html', 'utf8');

// Read all JavaScript files
const ccpmScheduler = fs.readFileSync('ccpm-scheduler.js', 'utf8');
const bufferManager = fs.readFileSync('buffer-manager.js', 'utf8');
const drumBufferRope = fs.readFileSync('drum-buffer-rope.js', 'utf8');
const appStrategic = fs.readFileSync('app-strategic.js', 'utf8');

// Replace the script tags with embedded JavaScript
const standalone = html.replace(
    /<script src="ccpm-scheduler\.js"><\/script>\s*<script src="buffer-manager\.js"><\/script>\s*<script src="drum-buffer-rope\.js"><\/script>\s*<script src="app-strategic\.js"><\/script>/,
    `<script>
// ===== CCPM SCHEDULER =====
${ccpmScheduler}

// ===== BUFFER MANAGER =====
${bufferManager}

// ===== DRUM-BUFFER-ROPE =====
${drumBufferRope}

// ===== APPLICATION =====
${appStrategic}
</script>`
);

// Write the standalone file
fs.writeFileSync('standalone-systemic.html', standalone);
fs.writeFileSync('milestone-ccpm-mvp/standalone-systemic.html', standalone);

console.log('✅ Standalone file generated successfully!');
console.log('   - standalone-systemic.html');
console.log('   - milestone-ccpm-mvp/standalone-systemic.html');
