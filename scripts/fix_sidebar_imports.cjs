const fs = require('fs');
const sidebarPath = 'C:/Users/Atif/Documents/GitHub/Ops-Hub-V2/src/components/layout/Sidebar.tsx';
let code = fs.readFileSync(sidebarPath, 'utf8');

// 1. Fix ArrowDown import
code = code.replace(
  "import { ArrowDown, useSafeNavigate, useSafeLocation } from '../../lib/safeRouterHooks';",
  "import { useSafeNavigate, useSafeLocation } from '../../lib/safeRouterHooks';"
);
code = code.replace(
  "import { \n  Building2,",
  "import { \n  ArrowDown,\n  Building2,"
);

// 2. Fix displayedWorkspaceLinks.map
const oldMap = `{displayedWorkspaceLinks.map((link) => {
                  const hasContent = Boolean(link.url && link.url.trim());
                  const categoryHeaderElement = isNewCategory && currentCategory ? (`;

const newMap = `{displayedWorkspaceLinks.map((link, linkIdx) => {
                  const currentCategory = WORKSPACE_CATEGORIES.find((cat) => cat.keys.includes(link.key));
                  const prevLink = linkIdx > 0 ? displayedWorkspaceLinks[linkIdx - 1] : null;
                  const prevCategory = prevLink ? WORKSPACE_CATEGORIES.find((cat) => cat.keys.includes(prevLink.key)) : null;
                  const isNewCategory = currentCategory && (!prevCategory || prevCategory.id !== currentCategory.id);
                  const activeInCategory = currentCategory
                    ? displayedWorkspaceLinks.filter((l) => currentCategory.keys.includes(l.key) && Boolean(l.url && l.url.trim())).length
                    : 0;
                  const hasContent = Boolean(link.url && link.url.trim());
                  const categoryHeaderElement = isNewCategory && currentCategory ? (`;

code = code.replace(oldMap, newMap);

fs.writeFileSync(sidebarPath, code);
console.log('Fixed imports and map in Sidebar.tsx');
