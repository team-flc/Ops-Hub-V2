const fs = require('fs');
const filePath = 'C:/Users/Atif/Documents/GitHub/Ops-Hub-V2/tests/sixMistakesPortalRollout.test.tsx';
let file = fs.readFileSync(filePath, 'utf8');

file = file.replace(
  "title: 'Cloud Z Internal Budget Note',",
  "title: 'Cloud Z Internal Budget Note',\n      isInternalOnly: true,"
);

file = file.replace(
  "title: 'Cloud Z Internal Quality Gate',",
  "title: 'Cloud Z Internal Quality Gate',\n      isInternalOnly: true,"
);

file = file.replace(
  "getByTestId('recent-activity-view-all-btn')",
  "getByTestId('recent-activity-view-all')"
);

fs.writeFileSync(filePath, file);
console.log('Successfully updated sixMistakesPortalRollout.test.tsx');
