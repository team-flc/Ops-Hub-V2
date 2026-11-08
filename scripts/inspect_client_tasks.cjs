const fs = require('fs');
const env = fs.readFileSync('C:/Users/Atif/Documents/GitHub/Ops-Hub-V2/.env', 'utf8');
const envVars = {};
env.split('\n').forEach(line => {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) envVars[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '');
});
const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_ANON_KEY;

async function checkTasks() {
  const clients = {
    'Maven': '8e5d17bf-1ba9-41e1-9ef7-09ca137a72d3',
    'Pixel': '5b9ea614-9b21-4b26-9c17-a8fa98b451c8',
    'CloudZ': 'd3d666c2-24c7-4cc7-b879-55c6d5881185'
  };

  for (const [name, id] of Object.entries(clients)) {
    const res = await fetch(`${supabaseUrl}/rest/v1/client_tasks?client_id=eq.${id}&select=id,title,status,week_number,created_at,due_date,completed_at,archived_at`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    const tasks = await res.json();
    console.log(`=== ${name} (Total: ${tasks.length}) ===`);
    tasks.forEach(t => {
      console.log(`- [Wk ${t.week_number}] ${t.title} | Status: ${t.status} | Created: ${t.created_at} | Comp: ${t.completed_at}`);
    });
  }
}
checkTasks();
