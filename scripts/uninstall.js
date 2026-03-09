#!/usr/bin/env node

/**
 * ClawBridge Uninstall Script
 * 
 * Automated uninstall with safety confirmations
 * Follows the uninstall guide in UNINSTALL.md
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Colors for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function question(prompt) {
  return new Promise(resolve => rl.question(prompt, resolve));
}

async function confirm(message) {
  const answer = await question(`${colors.yellow}${message} (yes/no): ${colors.reset}`);
  return answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y';
}

function exec(command, options = {}) {
  try {
    return execSync(command, {
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options
    });
  } catch (error) {
    if (!options.ignoreErrors) {
      throw error;
    }
    return null;
  }
}

async function notifyPeers() {
  log('\n📡 Step 1: Notifying peers...', 'cyan');
  
  try {
    const response = exec('curl -s -X POST http://localhost:9100/api/disconnect -H "Content-Type: application/json" -d \'{"reason": "Uninstalling ClawBridge", "permanent": true}\'', {
      silent: true,
      ignoreErrors: true
    });
    
    if (response) {
      log('✅ Disconnect notification sent to peers', 'green');
    } else {
      log('⚠️  Server not responding, skipping notification', 'yellow');
    }
  } catch (error) {
    log('⚠️  Could not notify peers (server may be stopped)', 'yellow');
  }
}

async function stopServer() {
  log('\n🛑 Step 2: Stopping ClawBridge server...', 'cyan');
  
  // Check systemd service
  const hasSystemd = exec('which systemctl 2>/dev/null', { silent: true, ignoreErrors: true });
  
  if (hasSystemd) {
    const serviceStatus = exec('systemctl is-active clawbridge 2>/dev/null', { 
      silent: true, 
      ignoreErrors: true 
    });
    
    if (serviceStatus && serviceStatus.trim() === 'active') {
      log('Found systemd service, stopping...', 'blue');
      
      try {
        exec('sudo systemctl stop clawbridge');
        log('✅ systemd service stopped', 'green');
        return 'systemd';
      } catch (error) {
        log('❌ Failed to stop systemd service', 'red');
        throw error;
      }
    }
  }
  
  // Check for background process
  const psOutput = exec('ps aux | grep "src/server.js" | grep -v grep', { 
    silent: true, 
    ignoreErrors: true 
  });
  
  if (psOutput) {
    log('Found background process, stopping...', 'blue');
    
    // Try to get PID from file
    let pid = null;
    if (fs.existsSync('clawbridge.pid')) {
      pid = fs.readFileSync('clawbridge.pid', 'utf8').trim();
    } else {
      // Parse from ps output
      const match = psOutput.match(/\s+(\d+)\s+/);
      if (match) pid = match[1];
    }
    
    if (pid) {
      try {
        // Graceful shutdown
        exec(`kill -TERM ${pid}`, { ignoreErrors: true });
        log(`Sent SIGTERM to process ${pid}, waiting...`, 'blue');
        
        // Wait 5 seconds
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Check if still running
        const stillRunning = exec(`ps -p ${pid}`, { silent: true, ignoreErrors: true });
        
        if (stillRunning) {
          log('Process did not stop gracefully, force killing...', 'yellow');
          exec(`kill -9 ${pid}`, { ignoreErrors: true });
        }
        
        log('✅ Background process stopped', 'green');
        return 'background';
      } catch (error) {
        log('❌ Failed to stop background process', 'red');
        throw error;
      }
    }
  }
  
  log('⚠️  No running ClawBridge server found', 'yellow');
  return 'none';
}

async function removeSystemdService() {
  log('\n🗑️  Step 3: Removing systemd service...', 'cyan');
  
  const serviceFile = '/etc/systemd/system/clawbridge.service';
  
  if (fs.existsSync(serviceFile)) {
    try {
      // Disable service
      exec('sudo systemctl disable clawbridge 2>/dev/null', { ignoreErrors: true });
      
      // Remove service file
      exec(`sudo rm ${serviceFile}`);
      
      // Reload systemd
      exec('sudo systemctl daemon-reload');
      
      // Reset failed state
      exec('sudo systemctl reset-failed clawbridge 2>/dev/null', { ignoreErrors: true });
      
      log('✅ systemd service removed', 'green');
    } catch (error) {
      log('❌ Failed to remove systemd service', 'red');
      throw error;
    }
  } else {
    log('⚠️  No systemd service found', 'yellow');
  }
}

async function removeLogs() {
  log('\n📝 Step 4: Removing logs...', 'cyan');
  
  const logLocations = [
    '/var/log/clawbridge',
    path.join(process.cwd(), 'clawbridge.log'),
    '/tmp/clawbridge.log'
  ];
  
  let removed = 0;
  
  for (const location of logLocations) {
    if (fs.existsSync(location)) {
      try {
        if (fs.statSync(location).isDirectory()) {
          fs.rmSync(location, { recursive: true, force: true });
        } else {
          fs.unlinkSync(location);
        }
        removed++;
        log(`  ✓ Removed: ${location}`, 'green');
      } catch (error) {
        log(`  ⚠️  Could not remove: ${location}`, 'yellow');
      }
    }
  }
  
  // Clean journald logs
  exec('sudo journalctl --vacuum-time=1s --unit=clawbridge 2>/dev/null', { 
    silent: true, 
    ignoreErrors: true 
  });
  
  if (removed > 0) {
    log(`✅ Removed ${removed} log location(s)`, 'green');
  } else {
    log('⚠️  No log files found', 'yellow');
  }
}

async function removeDirectory() {
  log('\n🗂️  Step 5: Removing ClawBridge directory...', 'cyan');
  
  const currentDir = process.cwd();
  const dirName = path.basename(currentDir);
  
  log(`Current directory: ${currentDir}`, 'blue');
  log(`This will delete ALL files in this directory.`, 'yellow');
  
  const confirmed = await confirm('\n⚠️  DELETE ClawBridge directory? This cannot be undone!');
  
  if (!confirmed) {
    log('❌ Uninstall cancelled by user', 'red');
    process.exit(1);
  }
  
  // Navigate out of directory first
  const parentDir = path.dirname(currentDir);
  process.chdir(parentDir);
  
  try {
    // Remove directory
    fs.rmSync(currentDir, { recursive: true, force: true });
    log(`✅ ClawBridge directory removed: ${currentDir}`, 'green');
    return currentDir;
  } catch (error) {
    log(`❌ Failed to remove directory: ${error.message}`, 'red');
    throw error;
  }
}

async function displayPeerCleanup() {
  log('\n🌐 Step 6: Network cleanup required', 'cyan');
  
  // Try to read peers config
  const peersPath = path.join(process.cwd(), 'config', 'peers.json');
  
  if (fs.existsSync(peersPath)) {
    try {
      const peers = JSON.parse(fs.readFileSync(peersPath, 'utf8'));
      const agentPath = path.join(process.cwd(), 'config', 'agent.json');
      const agent = JSON.parse(fs.readFileSync(agentPath, 'utf8'));
      
      log('\n⚠️  This agent must be removed from peer configs:', 'yellow');
      log(`    Agent name: ${agent.name}`, 'blue');
      log(`    Agent ID: ${agent.id}`, 'blue');
      log(`    Agent URL: ${agent.url}`, 'blue');
      
      log('\n📋 Peers that have this agent configured:', 'cyan');
      peers.peers.forEach(peer => {
        log(`  - ${peer.id || peer.name || 'Unknown'} (${peer.url})`, 'blue');
      });
      
      log('\n📝 Action required on each peer machine:', 'yellow');
      log(`  1. Open: config/peers.json`, 'blue');
      log(`  2. Remove entry for: ${agent.name}`, 'blue');
      log(`  3. Save and restart their ClawBridge`, 'blue');
      
      log('\n💡 Or ask each peer agent:', 'cyan');
      log(`  "Remove peer '${agent.name}' from your ClawBridge config"`, 'blue');
      
    } catch (error) {
      log('⚠️  Could not read peer config', 'yellow');
    }
  }
}

async function verify() {
  log('\n✅ Step 7: Verifying uninstall...', 'cyan');
  
  const checks = [];
  
  // Check port 9100
  const portCheck = exec('lsof -i :9100 2>/dev/null', { silent: true, ignoreErrors: true });
  checks.push({
    name: 'Port 9100',
    passed: !portCheck,
    status: portCheck ? '❌ Still in use' : '✅ Free'
  });
  
  // Check process
  const processCheck = exec('ps aux | grep "src/server.js" | grep -v grep', { 
    silent: true, 
    ignoreErrors: true 
  });
  checks.push({
    name: 'Process',
    passed: !processCheck,
    status: processCheck ? '❌ Still running' : '✅ Stopped'
  });
  
  // Check systemd service
  const serviceCheck = exec('systemctl list-units --all | grep clawbridge', { 
    silent: true, 
    ignoreErrors: true 
  });
  checks.push({
    name: 'systemd service',
    passed: !serviceCheck,
    status: serviceCheck ? '❌ Still exists' : '✅ Removed'
  });
  
  log('\nVerification Results:', 'blue');
  checks.forEach(check => {
    log(`  ${check.status} ${check.name}`, check.passed ? 'green' : 'red');
  });
  
  const allPassed = checks.every(check => check.passed);
  
  if (allPassed) {
    log('\n✅ All verification checks passed!', 'green');
  } else {
    log('\n⚠️  Some checks failed. Manual cleanup may be needed.', 'yellow');
  }
  
  return allPassed;
}

async function main() {
  log('\n╔════════════════════════════════════════════╗', 'cyan');
  log('║   ClawBridge Uninstall Script              ║', 'cyan');
  log('╚════════════════════════════════════════════╝', 'cyan');
  
  log('\n⚠️  WARNING: This will completely remove ClawBridge', 'yellow');
  log('   - Stop the server', 'blue');
  log('   - Remove systemd service', 'blue');
  log('   - Delete all config files', 'blue');
  log('   - Remove logs', 'blue');
  log('   - Delete ClawBridge directory', 'blue');
  
  const proceed = await confirm('\nProceed with uninstall?');
  
  if (!proceed) {
    log('\n❌ Uninstall cancelled', 'red');
    rl.close();
    process.exit(0);
  }
  
  // Backup option
  const backup = await confirm('\nCreate config backup before uninstalling?');
  let backupPath = null;
  
  if (backup) {
    backupPath = path.join(require('os').homedir(), `clawbridge-config-backup-${Date.now()}`);
    const configDir = path.join(process.cwd(), 'config');
    
    if (fs.existsSync(configDir)) {
      try {
        fs.cpSync(configDir, backupPath, { recursive: true });
        log(`✅ Config backed up to: ${backupPath}`, 'green');
      } catch (error) {
        log(`⚠️  Backup failed: ${error.message}`, 'yellow');
      }
    }
  }
  
  try {
    // Execute uninstall steps
    await notifyPeers();
    await stopServer();
    await removeSystemdService();
    await removeLogs();
    await displayPeerCleanup();
    
    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
    log('Before deleting directory, verify everything looks correct.', 'yellow');
    
    const continueDelete = await confirm('Continue with directory deletion?');
    
    if (continueDelete) {
      const removedPath = await removeDirectory();
      await verify();
      
      // Final report
      log('\n╔════════════════════════════════════════════╗', 'green');
      log('║   ✅ ClawBridge Uninstall Complete        ║', 'green');
      log('╚════════════════════════════════════════════╝', 'green');
      
      log('\n📋 Summary:', 'cyan');
      log('  ✅ Server stopped', 'green');
      log('  ✅ systemd service removed', 'green');
      log('  ✅ Logs cleaned', 'green');
      log(`  ✅ Directory deleted: ${removedPath}`, 'green');
      
      if (backupPath) {
        log(`  ℹ️  Config backup: ${backupPath}`, 'blue');
      }
      
      log('\n⚠️  Manual follow-up required:', 'yellow');
      log('  - Remove this agent from peer configs on other machines', 'blue');
      log('  - Update network documentation', 'blue');
      
      log('\n🔄 To reinstall:', 'cyan');
      log('  git clone https://github.com/paprini/clawbridge.git', 'blue');
      log('  cd clawbridge && npm install && npm run setup', 'blue');
      
    } else {
      log('\n❌ Directory deletion cancelled', 'red');
      log('ClawBridge server and services removed, but files remain.', 'yellow');
    }
    
  } catch (error) {
    log(`\n❌ Uninstall failed: ${error.message}`, 'red');
    log('Check UNINSTALL.md for manual uninstall steps', 'yellow');
    rl.close();
    process.exit(1);
  }
  
  rl.close();
}

// Run main function
main().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  rl.close();
  process.exit(1);
});
