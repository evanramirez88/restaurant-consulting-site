// Deploy email sequence steps to D1
// Run with: node scripts/deploy_sequences.js

const { execSync } = require('child_process');

const steps = [
  // Segment A - POS Switcher Steps
  {
    id: 'step_switcher_001_1',
    sequence_id: 'seq_pos_switcher_001',
    step_number: 1,
    step_name: 'Switch Anxiety Intro',
    delay_value: 0,
    delay_unit: 'hours',
    subject_a: 'Quick question about your POS at {{company}}',
    from_name_a: 'Evan from R&G Consulting'
  },
  {
    id: 'step_switcher_001_2',
    sequence_id: 'seq_pos_switcher_001',
    step_number: 2,
    step_name: 'Outage Insurance Angle',
    delay_value: 4,
    delay_unit: 'days',
    subject_a: 'The real cost of POS outages (not what you think)',
    from_name_a: 'Evan from R&G Consulting'
  },
  {
    id: 'step_switcher_001_3',
    sequence_id: 'seq_pos_switcher_001',
    step_number: 3,
    step_name: 'Speed Differentiator',
    delay_value: 8,
    delay_unit: 'days',
    subject_a: 'Menu builds that take corporate 3 weeks - I deliver in 48 hours',
    from_name_a: 'Evan from R&G Consulting'
  },
  {
    id: 'step_switcher_001_4',
    sequence_id: 'seq_pos_switcher_001',
    step_number: 4,
    step_name: 'Breakup Email',
    delay_value: 15,
    delay_unit: 'days',
    subject_a: 'Closing your file?',
    from_name_a: 'Evan from R&G Consulting'
  },
  // Segment C - Transition Steps
  {
    id: 'step_transition_001_1',
    sequence_id: 'seq_transition_001',
    step_number: 1,
    step_name: 'Systems Gap Intro',
    delay_value: 0,
    delay_unit: 'hours',
    subject_a: 'If you are taking over {{company}}, avoid the systems gap',
    from_name_a: 'Evan from R&G Consulting'
  },
  {
    id: 'step_transition_001_2',
    sequence_id: 'seq_transition_001',
    step_number: 2,
    step_name: 'Horror Story Prevention',
    delay_value: 4,
    delay_unit: 'days',
    subject_a: 'The $8,000 mistake new restaurant owners make',
    from_name_a: 'Evan from R&G Consulting'
  },
  {
    id: 'step_transition_001_3',
    sequence_id: 'seq_transition_001',
    step_number: 3,
    step_name: 'Zero Downtime Promise',
    delay_value: 8,
    delay_unit: 'days',
    subject_a: 'How to change ownership without closing for a day',
    from_name_a: 'Evan from R&G Consulting'
  },
  {
    id: 'step_transition_001_4',
    sequence_id: 'seq_transition_001',
    step_number: 4,
    step_name: 'Breakup Email',
    delay_value: 14,
    delay_unit: 'days',
    subject_a: 'Still planning the transition?',
    from_name_a: 'Evan from R&G Consulting'
  },
  // Segment D - Local Network Steps
  {
    id: 'step_network_001_1',
    sequence_id: 'seq_local_network_001',
    step_number: 1,
    step_name: 'Local Intro',
    delay_value: 0,
    delay_unit: 'hours',
    subject_a: 'Quick local question - Wi-Fi or printers ever drop during rush?',
    from_name_a: 'Evan from Cape Cod Cable'
  },
  {
    id: 'step_network_001_2',
    sequence_id: 'seq_local_network_001',
    step_number: 2,
    step_name: 'Kitchen Environment Expertise',
    delay_value: 4,
    delay_unit: 'days',
    subject_a: 'Why your kitchen kills your Wi-Fi (and what to do about it)',
    from_name_a: 'Evan from Cape Cod Cable'
  },
  {
    id: 'step_network_001_3',
    sequence_id: 'seq_local_network_001',
    step_number: 3,
    step_name: 'Local Case Study',
    delay_value: 8,
    delay_unit: 'days',
    subject_a: 'How a Cape restaurant stopped losing tickets during peak hours',
    from_name_a: 'Evan from Cape Cod Cable'
  },
  {
    id: 'step_network_001_4',
    sequence_id: 'seq_local_network_001',
    step_number: 4,
    step_name: 'Breakup Email',
    delay_value: 14,
    delay_unit: 'days',
    subject_a: 'Network running smoothly?',
    from_name_a: 'Evan from Cape Cod Cable'
  }
];

// Simple placeholder HTML for now - can be updated later with full content
const bodyHtml = '<p>Email content placeholder - update via admin UI</p>';
const bodyText = 'Email content placeholder - update via admin UI';

console.log('Deploying email sequence steps to D1...\n');

for (const step of steps) {
  const sql = `INSERT OR IGNORE INTO sequence_steps (id, sequence_id, step_number, step_name, delay_value, delay_unit, subject_a, body_html_a, body_text_a, from_name_a, status) VALUES ('${step.id}', '${step.sequence_id}', ${step.step_number}, '${step.step_name}', ${step.delay_value}, '${step.delay_unit}', '${step.subject_a.replace(/'/g, "''")}', '${bodyHtml}', '${bodyText}', '${step.from_name_a}', 'active');`;

  try {
    console.log(`Inserting ${step.id}...`);
    execSync(`npx wrangler d1 execute rg-consulting-forms --remote --command "${sql.replace(/"/g, '\\"')}"`, {
      cwd: 'C:\\Users\\evanr\\projects\\restaurant-consulting-site',
      stdio: 'pipe'
    });
    console.log(`  ✓ ${step.step_name}\n`);
  } catch (err) {
    console.error(`  ✗ Failed: ${err.message}\n`);
  }
}

console.log('Done!');
