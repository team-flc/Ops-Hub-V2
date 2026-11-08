async function pollDeployment() {
  const previousBundle = 'index-DMpFVthP.js';
  console.log('Polling for new deployment on https://ops.faseehlall.com (previous: ' + previousBundle + ')...');

  for (let attempt = 1; attempt <= 30; attempt++) {
    try {
      const url = `https://ops.faseehlall.com/?_t=${Date.now()}`;
      const res = await fetch(url, { headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' } });
      const html = await res.text();
      const match = html.match(/\/assets\/(index-[a-zA-Z0-9_\-]+\.js)/);
      const currentBundle = match ? match[1] : null;

      console.log(`[Attempt ${attempt}/30] Current index bundle: ${currentBundle}`);
      if (currentBundle && currentBundle !== previousBundle) {
        console.log(`>>> NEW BUNDLE DETECTED: ${currentBundle}! Deployment is LIVE!`);
        return true;
      }
    } catch (err) {
      console.error(`Attempt ${attempt} error:`, err.message);
    }
    await new Promise(r => setTimeout(r, 6000));
  }
  console.log('Polling timed out after 3 minutes.');
  return false;
}

pollDeployment().catch(console.error);
