const fs = require('fs');
const filePath = 'C:/Users/Atif/Documents/GitHub/Ops-Hub-V2/src/components/portal/FinfixClientPortalView.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Insert getTaskEventTimestamp before const unifiedRecentActivities
const target = `  // Unified Recent Activity (Identical labels and dates between dashboard list and modal)
  const unifiedRecentActivities = useMemo(() => {`;

const fnDef = `  const getTaskEventTimestamp = (t: ClientTask): { iso: string; formatted: string } => {
    const isDone = t.status === 'Completed' || t.status === 'Done';
    const raw = isDone && t.completedAt ? t.completedAt : t.createdAt || t.updatedAt || '';
    return {
      iso: raw,
      formatted: raw ? formatPKTDate(raw) : 'Recently'
    };
  };

  // Unified Recent Activity (Identical labels and dates between dashboard list and modal)
  const unifiedRecentActivities = useMemo(() => {`;

content = content.replace(target, fnDef);

// In unifiedRecentActivities, ensure iconType is typed as union
const oldIconType = `        return {
          id: t.id,
          title,
          action,
          iconType,
          weekNumber: t.weekNumber,`;

const newIconType = `        return {
          id: t.id,
          title,
          action,
          iconType: iconType as 'check' | 'message' | 'dollar' | 'edit',
          weekNumber: t.weekNumber,`;

content = content.replace(oldIconType, newIconType);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully fixed TS errors in FinfixClientPortalView.tsx!');
