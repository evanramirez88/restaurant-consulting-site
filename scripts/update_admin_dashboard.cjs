const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'pages', 'AdminDashboard.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add Brain import
content = content.replace(
  'Wrench, FileText, Calendar, Settings, Users, Ticket, Mail\n} from \'lucide-react\';',
  'Wrench, FileText, Calendar, Settings, Users, Ticket, Mail, Brain\n} from \'lucide-react\';'
);

// 2. Add ClientIntelligenceTab import
content = content.replace(
  'import TicketingDashboard from \'../src/components/admin/tickets/TicketingDashboard\';',
  `import TicketingDashboard from '../src/components/admin/tickets/TicketingDashboard';
import { ClientIntelligenceTab } from '../src/components/admin/intelligence';`
);

// 3. Update TabType
content = content.replace(
  "type TabType = 'overview' | 'portals' | 'clients' | 'reps' | 'tickets' | 'email' | 'tools' | 'toasthub' | 'availability' | 'config';",
  "type TabType = 'overview' | 'portals' | 'clients' | 'reps' | 'tickets' | 'email' | 'intelligence' | 'tools' | 'toasthub' | 'availability' | 'config';"
);

// 4. Add intelligence tab to tabs array (after email)
content = content.replace(
  "{ id: 'email', label: 'Email', icon: <Mail className=\"w-4 h-4\" /> },\n    { id: 'tools'",
  "{ id: 'email', label: 'Email', icon: <Mail className=\"w-4 h-4\" /> },\n    { id: 'intelligence', label: 'Intel', icon: <Brain className=\"w-4 h-4\" /> },\n    { id: 'tools'"
);

// 5. Add Intelligence tab rendering (after email tab)
content = content.replace(
  '{/* Tools Tab */}\n        {activeTab === \'tools\'',
  `{/* Intelligence Tab */}
        {activeTab === 'intelligence' && (
          <ClientIntelligenceTab />
        )}

        {/* Tools Tab */}
        {activeTab === 'tools'`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('AdminDashboard.tsx updated successfully!');
