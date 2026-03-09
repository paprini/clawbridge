const { callPeerSkill } = require('./src/client');

async function testPing() {
  try {
    console.log('📡 Testing A2A communication...\n');
    
    // Ping whatsapp-agent
    console.log('🎯 Test 1: Pinging whatsapp-agent...');
    const result1 = await callPeerSkill('whatsapp-agent', 'ping');
    console.log('✅ Ping result:', JSON.stringify(result1, null, 2));
    
    console.log('\n🎯 Test 2: Getting status from whatsapp-agent...');
    const result2 = await callPeerSkill('whatsapp-agent', 'get_status');
    console.log('✅ Status result:', JSON.stringify(result2, null, 2));
    
    console.log('\n✅ ALL TESTS PASSED! A2A communication fully working!');
    process.exit(0);
  } catch (error) {
    console.error('❌ FAILED:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testPing();
