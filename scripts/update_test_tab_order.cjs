const fs = require('fs');
const files = [
  'C:\\Users\\Atif\\Documents\\GitHub\\Ops-Hub-V2\\tests\\clientPortalUnifiedFixes.test.tsx',
  'C:\\Users\\Atif\\Documents\\Websites Backup\\Ops Hub v2\\tests\\clientPortalUnifiedFixes.test.tsx'
];

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');

  const oldBlock = `    // In unified client view, 4 workspace tabs are present and no separate dashboard tab exists
    expect(screen.getByTestId('tab-setup')).toBeDefined();
    expect(screen.getByTestId('tab-workplans')).toBeDefined();
    expect(screen.getByTestId('tab-details')).toBeDefined();
    expect(screen.getByTestId('tab-reports')).toBeDefined();
    expect(screen.queryByTestId('tab-dashboard')).toBeNull();

    // Stepper is defined
    expect(screen.getByTestId('client-week-stepper')).toBeDefined();

    // Switch to 90-Day Work Plans
    const workplansTabBtn = screen.getByTestId('tab-workplans');
    fireEvent.click(workplansTabBtn);

    expect(screen.getByTestId('tab-workplans')).toBeDefined();`;

  const newBlock = `    // In reverted client view, starting workspace tabs are present and no separate dashboard or reports tab exists
    expect(screen.getByTestId('tab-details')).toBeDefined();
    expect(screen.getByTestId('tab-setup')).toBeDefined();
    expect(screen.getByTestId('tab-workplans')).toBeDefined();
    expect(screen.queryByTestId('tab-reports')).toBeNull();
    expect(screen.queryByTestId('tab-dashboard')).toBeNull();

    // Switch to 30-Day Setup to verify stepper
    fireEvent.click(screen.getByTestId('tab-setup'));
    expect(screen.getByTestId('client-week-stepper')).toBeDefined();

    // Switch to 90-Day Work Plans
    const workplansTabBtn = screen.getByTestId('tab-workplans');
    fireEvent.click(workplansTabBtn);

    expect(screen.getByTestId('tab-workplans')).toBeDefined();`;

  const oldBlockCrlf = oldBlock.replace(/\n/g, '\r\n');
  const newBlockCrlf = newBlock.replace(/\n/g, '\r\n');

  if (content.includes(oldBlock)) {
    content = content.replace(oldBlock, newBlock);
    fs.writeFileSync(f, content, 'utf8');
    console.log('Updated ' + f);
  } else if (content.includes(oldBlockCrlf)) {
    content = content.replace(oldBlockCrlf, newBlockCrlf);
    fs.writeFileSync(f, content, 'utf8');
    console.log('Updated CRLF ' + f);
  } else {
    console.log('Block not found in ' + f);
  }
});
