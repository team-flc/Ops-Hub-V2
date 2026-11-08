const fs = require('fs');
const env = fs.readFileSync('C:/Users/Atif/Documents/GitHub/Ops-Hub-V2/.env', 'utf8');
const envVars = {};
env.split('\n').forEach(line => {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) envVars[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '');
});
const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_ANON_KEY;

async function checkClients() {
  const res = await fetch(`${supabaseUrl}/rest/v1/clients?select=id,company_name,client_name&limit=10`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });
  const data = await res.json();
  console.log('Clients count:', data.length);
  console.log(data);
}
checkClients();
