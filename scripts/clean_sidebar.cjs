const fs = require('fs');
const sidebarPath = 'C:/Users/Atif/Documents/GitHub/Ops-Hub-V2/src/components/layout/Sidebar.tsx';
let code = fs.readFileSync(sidebarPath, 'utf8');

const badChunk = `                    if ((link as any).isTextAction) {
                      return (
                        <React.Fragment key={link.key}>
                          {categoryHeaderElement}
                          <button
                      return (`;

const goodChunk = `                    if ((link as any).isTextAction) {
                      return (
                        <React.Fragment key={link.key}>
                          {categoryHeaderElement}`;

if (code.includes(badChunk)) {
  code = code.replace(badChunk, goodChunk);
  fs.writeFileSync(sidebarPath, code);
  console.log('Fixed bad chunk in Sidebar.tsx');
} else {
  console.log('badChunk not found directly, inspecting lines...');
  const lines = code.split('\n');
  const idx = lines.findIndex(l => l.includes('<button') && lines[lines.indexOf(l)+1]?.includes('return ('));
  console.log('Found near index:', idx);
}
