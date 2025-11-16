// Test script to verify timer and pause functionality
console.log('🧪 Testing timer and pause functionality...');

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('✅ DOM loaded');
  
  // Test timer elements exist
  const timeDisplay = document.getElementById('timeDisplay');
  const pausePlayBtn = document.getElementById('pausePlayBtn');
  const pauseOverlay = document.getElementById('pauseOverlay');
  
  console.log('📊 Elements check:');
  console.log('  timeDisplay:', timeDisplay ? '✅' : '❌');
  console.log('  pausePlayBtn:', pausePlayBtn ? '✅' : '❌');
  console.log('  pauseOverlay:', pauseOverlay ? '✅' : '❌');
  
  // Test if gameTimer object exists
  setTimeout(() => {
    if (typeof gameTimer !== 'undefined') {
      console.log('✅ gameTimer object exists');
      console.log('  isRunning:', gameTimer.isRunning);
      console.log('  elapsed:', gameTimer.elapsed);
    } else {
      console.log('❌ gameTimer object missing');
    }
  }, 100);
});
