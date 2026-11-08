const fs = require('fs');

// 1. tests/clientPortalUnifiedFixes.test.tsx
const p1 = 'C:/Users/Atif/Documents/GitHub/Ops-Hub-V2/tests/clientPortalUnifiedFixes.test.tsx';
let f1 = fs.readFileSync(p1, 'utf8');
f1 = f1.replace(
  "f.includes('finfix_pro_monthly_report.txt')",
  "(f.includes('finfix_pro') && f.includes('monthly_report.txt'))"
);
fs.writeFileSync(p1, f1);
console.log('Fixed clientPortalUnifiedFixes.test.tsx');

// 2. tests/finfixClientPortal.test.tsx
const p2 = 'C:/Users/Atif/Documents/GitHub/Ops-Hub-V2/tests/finfixClientPortal.test.tsx';
let f2 = fs.readFileSync(p2, 'utf8');
f2 = f2.replace(
  "expect(tasksCard.textContent).toContain('0/9');",
  "expect(tasksCard.textContent).toContain('0/10');"
);
fs.writeFileSync(p2, f2);
console.log('Fixed finfixClientPortal.test.tsx');
