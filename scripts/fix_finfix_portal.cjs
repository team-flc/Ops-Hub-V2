const fs = require('fs');
const filePath = 'C:/Users/Atif/Documents/GitHub/Ops-Hub-V2/src/components/portal/FinfixClientPortalView.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Normalize all CRLF to LF
content = content.replace(/\r\n/g, '\n');

// 1. Insert getTaskEventTimestamp before unifiedRecentActivities
const target = `  // Unified Recent Activity (Identical labels and dates between dashboard list and modal)
  const unifiedRecentActivities = useMemo(() => {`;

const replacement = `  // Unified task event timestamp helper (Eliminates modal vs card date mismatch)
  const getTaskEventTimestamp = (t: ClientTask): { iso: string; formatted: string } => {
    const isDone = t.status === 'Completed' || t.status === 'Done';
    const raw = isDone && t.completedAt ? t.completedAt : t.createdAt || t.updatedAt || '';
    return {
      iso: raw,
      formatted: raw ? formatPKTDate(raw) : 'Recently'
    };
  };

  // Unified Recent Activity (Identical labels and dates between dashboard list and modal)
  const unifiedRecentActivities = useMemo(() => {`;

if (!content.includes(target)) {
  console.error('Target not found!');
  process.exit(1);
}
content = content.replace(target, replacement);

// 2. Fix iconType typing in unifiedRecentActivities
const oldRet = `        return {
          id: t.id,
          title,
          action,
          iconType,
          weekNumber: t.weekNumber,`;

const newRet = `        return {
          id: t.id,
          title,
          action,
          iconType: iconType as 'check' | 'message' | 'dollar' | 'edit',
          weekNumber: t.weekNumber,`;

if (!content.includes(oldRet)) {
  console.error('oldRet not found!');
  process.exit(1);
}
content = content.replace(oldRet, newRet);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed FinfixClientPortalView.tsx successfully!');
