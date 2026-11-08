const fs = require('fs');
const sidebarPath = 'C:/Users/Atif/Documents/GitHub/Ops-Hub-V2/src/components/layout/Sidebar.tsx';
let code = fs.readFileSync(sidebarPath, 'utf8');

code = code.replace(
  '{activeInCategory} active</span>',
  '({activeInCategory} linked)</span>'
);

fs.writeFileSync(sidebarPath, code);
console.log('Replaced category active text');
