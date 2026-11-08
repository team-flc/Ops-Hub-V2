async function checkDeploy() {
  const url = 'https://ops.faseehlall.com/?_cb=' + Date.now();
  const res = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
  const html = await res.text();
  console.log('Deploy check at:', new Date().toISOString());
  const scriptMatches = html.match(/\/assets\/[a-zA-Z0-9_\-\.]+\.js/g) || [];
  const cssMatches = html.match(/\/assets\/[a-zA-Z0-9_\-\.]+\.css/g) || [];
  console.log('Scripts:', scriptMatches);
  console.log('CSS:', cssMatches);
  return { scriptMatches, cssMatches };
}

checkDeploy().catch(console.error);
