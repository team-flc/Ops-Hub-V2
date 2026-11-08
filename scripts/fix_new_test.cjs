const fs = require('fs');

const testPath = 'C:/Users/Atif/Documents/GitHub/Ops-Hub-V2/tests/fourRemainingMistakes.test.tsx';
let code = fs.readFileSync(testPath, 'utf8');

code = code.replace(
  "import { ClientRecord, ClientTask, UserProfile, DEFAULT_WEEK_NAMES } from '../src/types';",
  "import { ClientRecord, ClientTask, UserProfile, DEFAULT_WEEK_NAMES } from '../src/types';\nimport { useOpsStore } from '../src/store/opsStore';"
);

const oldSidebarTest = `  // 4. PROBLEM 4: STAFF SIDEBAR LAPTOP OPTIMIZATION (1366x768)
  it('Problem 4: Staff sidebar categorizes links with quick jump pills and keeps Slack, WhatsApp, POC reachable', () => {
    // Render staff sidebar in MemoryRouter
    render(
      <MemoryRouter>
        <AuthProvider>
          <Sidebar />
        </AuthProvider>
      </MemoryRouter>
    );

    // Jump pills exist
    expect(screen.getByText('Core')).toBeInTheDocument();
    expect(screen.getByText('Communication')).toBeInTheDocument();
  });`;

const newSidebarTest = `  // 4. PROBLEM 4: STAFF SIDEBAR LAPTOP OPTIMIZATION (1366x768)
  it('Problem 4: Staff sidebar categorizes links with quick jump pills and keeps Slack, WhatsApp, POC reachable', () => {
    useOpsStore.setState({
      clients: [cloudZClient],
      selectedClientId: cloudZClient.id
    });

    render(
      <MemoryRouter>
        <AuthProvider>
          <Sidebar />
        </AuthProvider>
      </MemoryRouter>
    );

    // Jump pills exist
    expect(screen.getByText('Core')).toBeInTheDocument();
    expect(screen.getByText('Communication')).toBeInTheDocument();

    // Section headers exist
    expect(screen.getByTestId('workspace-cat-core')).toBeInTheDocument();
    expect(screen.getByTestId('workspace-cat-contact')).toBeInTheDocument();

    // Slack, WhatsApp, POC WhatsApp and POC Email are rendered
    expect(screen.getByTestId('sidebar-link-slack-channel')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-link-whatsapp-group')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-link-poc-number')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-link-poc-email')).toBeInTheDocument();
  });`;

code = code.replace(oldSidebarTest, newSidebarTest);
fs.writeFileSync(testPath, code);
console.log('Updated fourRemainingMistakes.test.tsx');
