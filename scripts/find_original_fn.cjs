const { execSync } = require('child_process');
const git = 'C:/Users/Atif/AppData/Local/GitHubDesktop/app-3.6.7/resources/app/git/cmd/git.exe';
const out = execSync(`"${git}" -C "C:/Users/Atif/Documents/GitHub/Ops-Hub-V2" show HEAD:src/components/portal/FinfixClientPortalView.tsx`).toString();
const lines = out.split('\n');
lines.forEach((l, i) => {
  if (l.includes('getTaskEventTimestamp')) {
    console.log('--- Around line ' + (i+1) + ' ---');
    lines.slice(Math.max(0, i - 10), i + 25).forEach((sub, j) => console.log((Math.max(0, i - 10) + j + 1) + ': ' + sub));
  }
});
