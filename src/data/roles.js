// Newest first. start/end are 'YYYY-MM'; end null = present. `theme` is the
// company theme the whole site switches to while this role is on screen.
export const roles = [
  {
    id: 'aws',
    company: 'Amazon Web Services',
    short: 'AWS',
    title: 'Technical Infrastructure Program Manager Intern',
    shortTitle: 'Technical Infrastructure PM Intern',
    location: 'Herndon, VA',
    state: 'VA',
    start: '2026-09',
    end: null,
    sector: 'Cloud infrastructure',
    track: 'pm',
    summary: 'Planning tools and data-quality automation for the teams delivering generative-AI data-center capacity.',
    bullets: [
      'Developing data center planning tools modeling server placement constraints for generative AI capacity',
      'Architecting Python multi-agent pipeline querying Redshift via MCP to flag stale capacity data and notify owners',
      'Scoping automation requirements with delivery stakeholders by mapping manual blocker tracking workflows',
    ],
    stack: ['Python', 'Amazon Redshift', 'MCP', 'Multi-agent pipelines'],
    result: null,
    motif: 'capacity',
  },
  {
    id: 'rtx',
    company: 'RTX Corporation',
    short: 'RTX',
    title: 'Application Transformation Intern',
    shortTitle: 'Application Transformation Intern',
    location: 'Hartford, CT',
    state: 'CT',
    start: '2026-06',
    end: '2026-08',
    sector: 'Aerospace & defense',
    track: 'pm',
    summary: 'Helped shape the application-modernization roadmap and move enterprise workloads onto RTX’s Xeta Cloud platform.',
    bullets: [
      'Helped design the application modernization value stream and roadmap targeting 2028 enterprise goals',
      'Assessed enterprise applications across discovery and execution phases, migrating workloads to cloud and on-prem',
      'Collaborated with application teams to plan and execute transitions to RTX’s Xeta Cloud modernization platform',
    ],
    stack: ['Application modernization', 'Cloud migration', 'Xeta Cloud', 'Roadmapping'],
    result: { value: '2028', label: 'enterprise modernization roadmap', short: 'roadmap' },
    motif: 'roadmap',
  },
  {
    id: 'bose',
    company: 'Bose Corporation',
    short: 'Bose',
    title: 'Software Engineer Co-op',
    shortTitle: 'Software Engineer Co-op',
    location: 'Framingham, MA',
    state: 'MA',
    start: '2026-01',
    end: '2026-06',
    sector: 'Consumer audio',
    track: 'eng',
    summary: 'Built the log-analysis platform used to debug device firmware, cutting investigations from hours to minutes.',
    bullets: [
      'Built full-stack log analysis platform with 60+ REST endpoints, streaming, and session persistence using FastAPI',
      'Designed 3-phase processing pipeline with 25+ custom tools, reducing firmware debugging from hours to minutes',
      'Shipped cross-platform desktop app (React, Electron, Copilot SDK) integrating Jira, Confluence, and Artifactory',
    ],
    stack: ['Python', 'FastAPI', 'React', 'Electron', 'Copilot SDK', 'Jira', 'Confluence', 'Artifactory'],
    result: { value: '60+', label: 'REST endpoints in the log-analysis platform', short: 'REST endpoints' },
    motif: 'stream',
  },
  {
    id: 'pendar',
    company: 'Pendar Technologies',
    short: 'Pendar',
    title: 'Laser Software Engineer Co-op',
    shortTitle: 'Laser Software Engineer Co-op',
    location: 'Boston, MA',
    state: 'MA',
    start: '2025-07',
    end: '2025-12',
    sector: 'Laser sensing',
    track: 'eng',
    summary: 'Replaced a legacy LabVIEW rig with a real-time Qt/PySide6 acquisition app for laser sensor testing.',
    bullets: [
      'Built real-time data acquisition app in Qt/PySide6 for laser sensor testing, fully replacing legacy LabVIEW system',
      'Implemented automated overnight testing with CSV export, eliminating hours of manual data collection daily',
    ],
    stack: ['Python', 'Qt/PySide6', 'Data acquisition', 'Test automation'],
    result: { value: 'LabVIEW → Qt', label: 'legacy test system fully replaced', short: 'rewrite' },
    motif: 'spectrum',
  },
  {
    id: 'empowerreg',
    company: 'Empowerreg AI',
    short: 'Empowerreg',
    title: 'AI Engineer Intern (part-time)',
    shortTitle: 'AI Engineer Intern',
    location: 'Remote',
    state: null,
    start: '2025-07',
    end: '2025-12',
    sector: 'Regulatory AI',
    track: 'eng',
    summary: 'Visualization, observability and an AI assistant for medical-device regulatory analysts.',
    bullets: [
      'Built interactive visualization tool mapping FDA complaint severity with heatmaps for medical device risk analysis',
      'Deployed Grafana and Loki observability stack, unifying real-time log monitoring across 5+ microservices',
      'Saved 4+ hours/week per analyst by building AI-powered assistant for regulatory compliance queries',
    ],
    stack: ['Python', 'Grafana', 'Loki', 'LLM assistant', 'Data visualization'],
    result: { value: '4+ hrs', label: 'saved per analyst, every week', short: 'saved / analyst / week' },
    motif: 'heatmap',
  },
  {
    id: 'src',
    company: 'SRC, Inc.',
    short: 'SRC',
    title: 'Machine Learning Engineer Intern',
    shortTitle: 'ML Engineer Intern',
    location: 'Syracuse, NY',
    state: 'NY',
    start: '2025-04',
    end: '2025-07',
    sector: 'Defense R&D',
    track: 'eng',
    summary: 'Turned 500+ radar documents into knowledge graphs with a LangGraph extraction pipeline.',
    bullets: [
      'Built pipeline extracting knowledge triplets from 500+ radar docs at 90% accuracy using Pydantic and Docling',
      'Fed extracted triplets into knowledge graphs via LangGraph, automating analysis and cutting review time by 70%',
    ],
    stack: ['Python', 'LangGraph', 'Pydantic', 'Docling', 'Knowledge graphs'],
    result: { value: '90%', label: 'extraction accuracy across 500+ documents', short: 'extraction accuracy' },
    motif: 'graph',
  },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const parseMonth = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return { y, m };
};

export const fmtMonth = (ym) => {
  const { y, m } = parseMonth(ym);
  return `${MONTHS[m - 1]} ${y}`;
};

export const fmtRange = (role) =>
  `${fmtMonth(role.start)} - ${role.end ? fmtMonth(role.end) : 'Present'}`;

// "Jun–Aug 2026", "Jul–Dec 2025", "Sep 2026 – now"
export const fmtShortRange = (role) => {
  const a = parseMonth(role.start);
  if (!role.end) return `${MONTHS[a.m - 1]} ${a.y} - now`;
  const b = parseMonth(role.end);
  if (a.y === b.y) return `${MONTHS[a.m - 1]}-${MONTHS[b.m - 1]} ${b.y}`;
  return `${MONTHS[a.m - 1]} ${a.y} - ${MONTHS[b.m - 1]} ${b.y}`;
};

export const monthIndex = (ym) => {
  const { y, m } = parseMonth(ym);
  return y * 12 + (m - 1);
};

export const nowMonth = () => {
  const d = new Date();
  return d.getFullYear() * 12 + d.getMonth();
};

export const currentRole = roles.find((r) => !r.end);

// `track` on each role: 'pm' for technical program management, 'eng' for
// software, AI and ML engineering
export const TRACKS = [
  { id: 'all', label: 'All roles' },
  { id: 'pm', label: 'Program management' },
  { id: 'eng', label: 'Software engineering' },
];

// the address of a role on this site (opens the Experience page on that role),
// for the résumé or anywhere else
export const roleLink = (id) => `/experience/${id}`;
