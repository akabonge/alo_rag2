// All site copy lives here so it can be edited without touching the 3D code.
// Source: aialo.io (Sept 2026).

export const PROFILE = {
  name: 'Aloysious Kabonge',
  role: 'AI/ML Engineer',
  focus: 'Agentic AI · RAG · LLM Automation',
  pitch: 'Building practical, production-ready AI systems, from enterprise compliance automation to products people use.',
  email: 'aloysious310@gmail.com', // TODO: swap if the live site uses a different address
  linkedin: 'https://www.linkedin.com/in/aloysious-kabonge',
  github: 'https://github.com/akabonge',
  site2d: 'https://aialo.io',
  mantra: 'One day at a time.',
};

export const ORIGIN = { label: 'Uganda', lat: 1.37, lon: 32.29 };
export const DEST = { label: 'Fredericksburg, VA', lat: 38.3, lon: -77.46 };

export const TIMELINE = [
  { year: '2022', text: 'Arrived at UMW from Uganda to begin a B.S. in Data Science.' },
  { year: '2023', text: 'Became a Student Alumni Ambassador, Resident Assistant, and Orientation Leader.' },
  { year: '2025', text: 'Landed internships with banduri, Navy Federal Credit Union and SyncData.ai through mentorship and networking.' },
  { year: '2026', text: 'Graduated as a first-generation college graduate and joined Flatter, Inc.' },
];

// The two ends of the arc. Each opens its own panel from the globe or the Journey text.
export const PLACES = {
  uganda: {
    title: 'Uganda',
    kicker: 'Where I’m from · The Pearl of Africa',
    body: [
      'Winston Churchill popularized the name “the Pearl of Africa” in My African Journey (1908), and it still fits: snow-capped mountains on the equator, rainforest, savanna and the great lakes, all in one country.',
      'Uganda is where the White Nile begins at Jinja on Lake Victoria, Africa’s largest lake. Bwindi Impenetrable Forest is home to roughly half of the world’s mountain gorillas, and the Rwenzori “Mountains of the Moon” rise over 5,000 m on the western border.',
      'The grey crowned crane circling this globe is Uganda’s national bird, the one on the flag.',
    ],
    links: [
      { label: 'Uganda on Wikipedia', href: 'https://en.wikipedia.org/wiki/Uganda' },
      { label: 'Explore Uganda (official tourism)', href: 'https://exploreuganda.com/' },
    ],
  },
  fredericksburg: {
    title: 'Fredericksburg, Virginia',
    kicker: 'Home for 4 years of college and counting',
    body: [
      'Founded in 1728 on the Rappahannock River, Fredericksburg sits halfway between Washington, D.C. and Richmond. Its historic downtown is a walkable grid of 18th- and 19th-century brick storefronts, cafés, galleries and river views.',
      'It is home to the University of Mary Washington, where I earned my B.S. in Data Science, and it is where I still live and work today.',
    ],
    photo: 'umw',
    links: [
      { label: 'Fredericksburg on Wikipedia', href: 'https://en.wikipedia.org/wiki/Fredericksburg,_Virginia' },
      { label: 'Visit Fredericksburg (Virginia Tourism)', href: 'https://www.virginia.org/places-to-visit/regions/northern-virginia/fredericksburg/' },
      { label: 'Historic Downtown Fredericksburg', href: 'https://www.virginia.org/listing/historic-downtown-fredericksburg/12103/' },
    ],
  },
};

export const EXPERIENCE = [
  {
    id: 'flatter',
    org: 'Flatter, Inc.',
    title: 'Executive Support & Innovation Intern',
    when: 'Jul 2026 – Present',
    where: 'Fredericksburg, VA · On-site',
    body: 'I contribute to the development and improvement of PersonaOpps, Flatter’s conversational AI web application built on Microsoft Azure within ISO 27001, NIST and CMMC frameworks.',
    bullets: [
      'Contribute to the development and improvement of Flatter, Inc.’s PersonaOpps web application.',
      'Build and refine frontend features using Vue.js, JavaScript, HTML, and CSS, translating business needs into clear, usable interfaces.',
      'Deploy and support frontend application updates through Azure Static Web Apps.',
      'Collaborate with leadership and technical teammates in an iterative development environment.',
      'Support AI tooling research, prototyping, workflow automation, and process-improvement initiatives across the organization.',
    ],
    tags: ['PersonaOpps', 'Vue.js', 'JavaScript', 'HTML/CSS', 'Azure Static Web Apps', 'AI Tooling', 'Prototyping', 'Workflow Automation', 'ISO 27001 · NIST · CMMC'],
    height: 11,
  },
  {
    id: 'syncdata',
    org: 'SyncData.ai',
    title: 'AI Engineering Intern · Security & Compliance Automation',
    when: 'Dec 2025 – Apr 2026',
    where: 'Remote · CCI Scholar',
    body: 'Built AI-powered compliance automation for regulated data workflows: Python/FastAPI ingestion with MinIO quarantine storage, PostgreSQL metadata, SHA-256 hashing, RabbitMQ publishing and idempotent artifacts. Designed job state machines, Redis worker contracts, schema validation and async pipelines. LLM enrichment via Ollama and AWS Bedrock with structured JSON, PII/PHI redaction, and executive PDF/HTML compliance exports.',
    bullets: [
      'Designed the LLM-assisted architecture for the Fisherman compliance pipeline: LLMs write summaries, explanations and next steps while classification and evidence stay deterministic and auditable.',
      'Built an LLM evaluation and gating framework (schema adherence, faithfulness, hallucination risk, privacy leakage, prompt-injection resistance, regression tests), including DeepEval-based model selection.',
      'Recommended model and deployment strategies across AWS Bedrock + Anthropic Claude, OpenAI Structured Outputs and customer-hosted options for sensitive clients.',
      'Implemented PII/PHI workflow controls with AWS Bedrock and Amazon Macie for detection and guardrails.',
    ],
    tags: ['FastAPI', 'AWS Bedrock', 'Anthropic Claude', 'Amazon Macie', 'Ollama', 'DeepEval', 'PostgreSQL', 'RabbitMQ', 'Redis', 'MinIO', 'PII/PHI Redaction', 'LLM Evaluation'],
    height: 13,
  },
  {
    id: 'nfcu',
    org: 'Navy Federal Credit Union',
    title: 'Summer Associate · Business Intelligence Analyst',
    when: 'May 2025 – Aug 2025',
    where: 'Vienna, VA · Hybrid · Member Analytics Team',
    body: 'Analyzed credit and debit card transaction data to understand how Active Duty members’ spending changes during Permanent Change of Station (PCS) moves, 2019–2024. Built Databricks pipelines with PySpark, developed Power BI dashboards, and delivered stakeholder presentations with member-support recommendations.',
    bullets: [
      'Processed high-volume credit and debit card transaction data in Databricks and PySpark to find PCS movement patterns for active-duty members.',
      'Validated data integrity and ran exploratory analysis in Excel to confirm consistency across sources.',
      'Built interactive Power BI dashboards of member movement patterns and presented strategic insights to leadership.',
    ],
    tags: ['PySpark', 'Databricks', 'Power BI', 'Excel', 'Data Validation', 'EDA', 'Stakeholder Presentations'],
    height: 9.5,
  },
  {
    id: 'banduri',
    org: 'banduri · Jade Rabbit AI',
    title: 'Data Strategy & Analysis Intern',
    when: 'Jan 2025 – Apr 2025',
    where: 'Fredericksburg, VA · Hybrid',
    body: 'Contributed to Jade Rabbit, an AI-driven healthcare product, in banduri’s inaugural internship cohort with the UMW College of Business. Applied Change Architecture and agile design thinking to surface pain points, validate problem–solution fit, and deliver roadmap insights to executives.',
    bullets: [
      'Led 30+ customer discovery interviews and synthesized them into personas, journey pain points and problem statements for Jade Rabbit’s 2025 go-to-market roadmap.',
      'Ran mixed-method validation (market research plus quantitative and qualitative analysis) to test problem–solution fit and value propositions.',
      'Collaborated across data science, computer science, marketing and business, then presented final recommendations to faculty, executives and stakeholders.',
    ],
    tags: ['Healthcare AI', 'Customer Discovery', 'Change Architecture', 'Design Thinking', 'Market Research', 'Go-to-Market'],
    height: 8,
  },
  {
    id: 'umw',
    org: 'University of Mary Washington',
    title: 'Campus Leadership & Service',
    when: '2022 – 2026',
    where: 'Fredericksburg, VA',
    body: 'Rise Peer Mentor, Student Alumni Ambassador, Resident Assistant, Orientation Leader and Student Fundraiser. Vice President of the African Student Union and of the National Society of Collegiate Scholars. Habitat for Humanity Team Lead. Active in NAACP, COAR volunteering, and Pi Mu Epsilon. B.S. Data Science, May 2026.',
    bullets: [
      'Vice President, African Student Union (Fall 2024 – Spring 2025): coordinated meetings and events with African students and the wider student body to strengthen community on campus.',
      'Vice President, National Society of Collegiate Scholars (Fall 2023 – Spring 2024): helped lead chapter operations and member engagement.',
      'Resident Assistant (Jan 2023 – May 2026): built an inclusive community for 30+ residents through programs, 1:1 check-ins, mediation and dependable duty rotations.',
      'Orientation Leader, Class of 2027 (Summer 2023): welcomed and mentored incoming students and families.',
      'Habitat for Humanity, 4 spring-break builds helping construct 12 homes: Winston-Salem, NC (2023) · Fort Lauderdale, FL (2024) · Goose Creek, SC (2025) · Avery County, NC (2026, Team Lead of a 7-person crew).',
      'Rise Peer Mentor, Student Alumni Ambassador and Student Fundraiser; active in NAACP, COAR volunteering and Pi Mu Epsilon.',
    ],
    tags: ['Leadership', 'Mentorship', 'Community', 'African Student Union VP', 'NSCS VP', 'Habitat for Humanity Team Lead', 'Resident Assistant', 'Orientation Leader'],
    height: 7,
  },
];

// Community: Habitat for Humanity spring-break builds. x/y pins come from usmap.js (US_PINS).
export const COMMUNITY = {
  title: 'Community & paying it forward',
  intro: [
    'Community is how I got here. When I arrived from Uganda, mentors, friends and people I had just met opened doors for me. The least I can do is hold the door open for the next person.',
    'Since 2023 I have spent every spring break on a Habitat for Humanity build instead of on vacation: four builds in three states, helping construct 12 homes. Painting walls, building scaffolding and working next to people I met that week taught me that a good crew, like a good team, runs on showing up, listening and doing the unglamorous work well.',
    'Paying it forward is how I want to make the world a little better, one day and one home at a time.',
  ],
  stats: [['4', 'Builds'], ['3', 'States'], ['12', 'Homes'], ['2026', 'Team Lead']],
  links: [{ label: 'Habitat for Humanity', href: 'https://www.habitat.org/' }],
  builds: [
    { id: 'ws', year: '2023', city: 'Winston-Salem', state: 'NC', pin: 'ws', role: 'Volunteer · first build',
      text: 'My first build. Site prep, cleanup and painting on residential homes, while learning tool safety, crew communication and how to take direction on an active jobsite.',
      org: 'Habitat for Humanity of Forsyth County', href: 'https://habitatforsyth.org/' },
    { id: 'ftl', year: '2024', city: 'Fort Lauderdale', state: 'FL', pin: 'ftl', role: 'Volunteer · 8-person team',
      text: 'Residential build sites with an 8-person team. Site prep, painting and tool safety, adapting quickly to a new city and fast-paced workdays.',
      org: 'Habitat for Humanity of Broward', href: 'https://habitatbroward.org/' },
    { id: 'gc', year: '2025', city: 'Goose Creek', state: 'SC', pin: 'gc', role: 'Volunteer · rotating crew roles',
      text: 'Rotated across painting, material handling and build support, and stayed in close contact with site leaders on safety, quality and timing.',
      org: 'Habitat for Humanity of Berkeley County', href: 'https://www.berkeleyhabitat.org/', photo: 'habitat_gc', video: 'assets/habitat-goose-creek.mp4' },
    { id: 'avery', year: '2026', city: 'Avery County', state: 'NC', pin: 'avery', role: 'Team Lead · 7-person crew',
      text: 'Led a 7-person crew supporting community development and on-site work alongside other volunteers.',
      org: 'Avery County Habitat for Humanity', href: 'https://www.habitat.org/nc/newland/avery-county-habitat-humanity' },
  ],
};

// CliftonStrengths Top 5 (Gallup), in my own words.
export const STRENGTHS = [
  { name: 'Achiever', text: 'I have a lot of stamina and get real satisfaction from a productive day.' },
  { name: 'Positivity', text: 'I bring upbeat energy that lifts a team, especially when a project gets hard.' },
  { name: 'Includer', text: 'I notice who is left out and make the effort to bring them in.' },
  { name: 'Developer', text: 'I see potential in people and enjoy helping them grow, one small win at a time.' },
  { name: 'Responsibility', text: 'When I commit, I own it: dependable, honest and loyal.' },
];

export const PROJECTS = [
  {
    id: 'proofmode',
    name: 'ProofMode',
    badge: '2nd Place · UMW Eagle Egg Pitch',
    when: 'Mar 2026 – Present',
    problem: 'AI-detection tools guess whether writing “looks like” AI after the fact: an arms race that punishes honest students and is easy to spoof.',
    approach: 'Proof-of-process instead of detection. Timestamped writing checkpoints and revision history are sealed into tamper-evident PDFs, with field-level encryption, Argon2 password hashing and signed JWT sessions.',
    result: 'Won 2nd place at the UMW Eagle Egg Pitch Competition and shipped as a live product.',
    tags: ['FastAPI', 'Next.js', 'PostgreSQL', 'Docker'],
    links: [{ label: 'GitHub', href: 'https://github.com/akabonge/proofmode' }],
  },
  {
    id: 'rag',
    name: 'Emergency Alerting RAG',
    badge: 'Presented at NCUR 2026 · Richmond, VA',
    when: 'Aug 2025 – Apr 2026',
    problem: 'Emergency alerting regulations are dense and scattered across agencies, so staff are slow to find grounded, citable answers during time-sensitive decisions.',
    approach: 'A retrieval-augmented generation pipeline over the regulatory corpus: Pinecone vector embeddings for retrieval and grounded generation with source citations, exposed through a Streamlit UI and a CLI.',
    result: 'Selected to present at the National Conference on Undergraduate Research (NCUR) 2026.',
    tags: ['RAG', 'Pinecone', 'Embeddings', 'Streamlit'],
    links: [{ label: 'GitHub', href: 'https://github.com/UMW-Projects/CPSC491Spring2026' }],
  },
  {
    id: 'aialo',
    name: 'AI Alo · Local Business Automations',
    badge: '5 live demos',
    when: '2026',
    problem: 'Local businesses want AI automation but have no low-risk way to see it working on their own use case before committing budget.',
    approach: 'Five production-style agentic assistants, each with Claude tool-calling, an Ollama fallback, local embeddings via ChromaDB, an MCP server and an operator dashboard. Guardrails cover 23 prompt-injection patterns plus session and rate limiting.',
    result: 'Five verticals live at once on Railway, the core sales tool for the AI Alo consulting practice.',
    tags: ['FastAPI', 'Claude', 'ChromaDB', 'MCP'],
    links: [],
  },
];

export const DEMOS = [
  { id: 'bistro', name: 'Casa Alo’s Bistro', agent: 'Aria', vertical: 'Restaurant', text: 'Aria books reservations and answers menu questions 24/7.', href: 'https://alorestaurant-production.up.railway.app/', color: 0xf2b655 },
  { id: 'realty', name: 'Rappahannock Realty', agent: 'Scout', vertical: 'Real estate', text: 'Scout qualifies leads and powers a mini-CRM dashboard.', href: 'https://realestate-production-bbce.up.railway.app/', color: 0x5fd4c4 },
  { id: 'spa', name: 'Luminara Med Spa', agent: 'Luna', vertical: 'Med spa', text: 'Luna recommends treatments and screens candidacy.', href: 'https://med-spa-production.up.railway.app/', color: 0xe98fc0 },
  { id: 'ironclad', name: 'Ironclad Home Services', agent: 'Rex', vertical: 'HVAC & trades', text: 'Rex dispatches jobs and quotes from live data.', href: 'https://ironclad-production-a158.up.railway.app/', color: 0xff7a45 },
  { id: 'law', name: 'Billie Jean Law', agent: 'Vera', vertical: 'Law firm', text: 'Vera handles intake, statute-of-limitations triage and booking.', href: 'https://web-production-f0d91.up.railway.app/', color: 0x8fa8ff },
];

export const SKILLS = {
  'AI & LLM': ['Agentic AI', 'RAG Pipelines', 'LLM Evaluation', 'Claude API', 'AWS Bedrock', 'Ollama', 'OpenAI API', 'PII/PHI Redaction', 'Prompt-Injection Defense', 'Structured JSON', 'Fine-tuning', 'MCP', 'DeepEval'],
  'Data Science': ['Python', 'PySpark', 'Databricks', 'Power BI', 'pandas', 'NumPy', 'scikit-learn', 'Statistics', 'SQL', 'R', 'Feature Engineering'],
  'Engineering': ['FastAPI', 'PostgreSQL', 'Redis', 'RabbitMQ', 'MinIO', 'Docker', 'Azure Static Web Apps', 'Azure DevOps', 'Next.js', 'Vue.js', 'JavaScript', 'Django', 'Railway'],
  'Vector Search': ['Pinecone', 'ChromaDB', 'Embeddings', 'Semantic Search', 'Amazon Macie'],
  'Human Skills': ['Communication', 'Problem Solving', 'Critical Thinking', 'Global Awareness', 'Intercultural Communication', 'Leadership', 'Mentorship', 'Stakeholder Comms', 'Teamwork', 'Adaptability'],
};

// One entry per scroll station. `id` must match a <section data-station> in index.html.
export const STATIONS = [
  { id: 'welcome', label: 'Oli otya' },
  { id: 'hero', label: 'Signal' },
  { id: 'journey', label: 'Journey' },
  { id: 'experience', label: 'Experience' },
  { id: 'projects', label: 'Projects' },
  { id: 'demos', label: 'Live demos' },
  { id: 'skills', label: 'Skills' },
  { id: 'community', label: 'Community' },
  { id: 'stars', label: 'Stars' },
  { id: 'contact', label: 'Contact' },
];

// Photos in src/assets/. Add a key here to show a new one (anything that fails to load is skipped).
// portrait: hero portrait card + profile panel. proofmode: also textures the 3D ProofMode document.
// Others appear as proof photos in the drawer whose id matches the key (exp:umw, proj:rag, journey = graduation).
export const IMAGES = {
  portrait: { src: 'assets/portrait.jpg', alt: 'Aloysious Kabonge' },
  graduation: { src: 'assets/graduation.jpg', alt: 'Aloysious in cap and first-generation stole outside Mary Washington College', caption: 'First-generation graduate · May 2026' },
  proofmode: { src: 'assets/proofmode.jpg', alt: 'ProofMode landing page: Prove how your writing happened', caption: 'ProofMode · live web app' },
  umw: { src: 'assets/umw.jpg', alt: 'Aerial view of the University of Mary Washington bell tower in autumn', caption: 'Campus Photo · University of Mary Washington' },
  habitat_gc: { src: 'assets/habitat-goose-creek.jpg', alt: 'Aloysious with the UMW Habitat for Humanity crew at the Berkeley County ReStore in Goose Creek, SC', caption: 'Goose Creek, SC · Spring Break 2025' },
  finale: { src: 'assets/finale.jpg', alt: 'Aloysious Kabonge by a window in a pink shirt' },
  profile: { src: 'assets/profile.jpg', alt: 'Aloysious Kabonge laughing in sunglasses, vest and tie', caption: 'Aloysious Kabonge' },
  // rag: { src: 'assets/ncur.jpg', alt: 'Presenting at NCUR 2026', caption: 'NCUR 2026 · Richmond, VA' },
};

// "Ask about Alo" generation backends, tried in order after on-device retrieval:
// 1. ASK_ENDPOINT: your own serverless function (see api/ask.js). Leave null until deployed.
// 2. Claude inside claude.ai (the artifact's `sample` capability, viewer's own account).
// 3. Fallback: the best-matching sentences from the retrieved source, no LLM.
export const ASK_ENDPOINT = '/api/ask'; // Vercel function; if it's missing (local dev, claude.ai copy) the next option is used
export const SOUNDTRACK = null; // optional licensed/royalty-free loop, e.g. 'assets/soundtrack.mp3'

// Guestbook API (Vercel function + free Upstash Redis). Falls back automatically when missing.
export const GUESTBOOK_ENDPOINT = '/api/guestbook';

// Guided tour for recruiters: station ids from STATIONS, seconds on screen, caption (also narrated).
export const TOUR = [ // captions follow my recorded narration (assets/tour-1.mp3 … tour-8.mp3)
  { station: 'hero', secs: 6, text: 'Hi, I’m Alo. Welcome, and thanks for stopping by. Come on, let me show you around.' },
  { station: 'journey', secs: 8, text: 'Every story has a beginning, and mine starts in Uganda. I got on a plane with a suitcase full of hope and dreams, and twenty-three hours later, Fredericksburg became home.' },
  { station: 'experience', secs: 9, text: 'Along the way, a few places took a chance on me. Each of these towers is one of them. Today I’m at Flatter, and I’m still learning something new every single day.' },
  { station: 'projects', secs: 8, text: 'Some of my favorite work started with a problem that just wouldn’t leave me alone. ProofMode began with one question: how do you prove you wrote something yourself?' },
  { station: 'demos', secs: 8, text: 'And these? These are real. Five AI assistants you can talk to with your keyboard or your own voice, live right now. Go ahead, try one.' },
  { station: 'skills', secs: 7, text: 'Every star up here is a skill. Click one, and it’ll show you where I’ve put it to work.' },
  { station: 'community', secs: 7, text: 'This part is so close to my heart. So many people have opened doors for me in ways I couldn’t imagine. Now I try to do the same, one home at a time, with Habitat for Humanity.' },
  { station: 'contact', secs: 7, text: 'And that’s me, for now. If you’d like to talk, I’d really love to hear from you. Webale kujja. Thank you for coming.' },
];

// Crane easter egg: one fact per click. Celebrations (with my voice) at 5 and at all 15.
export const UGANDA_FACTS = [
  'The grey crowned crane is Uganda’s national bird. It stands on the flag and the coat of arms.',
  'The White Nile begins its journey north at Jinja, on the shores of Lake Victoria.',
  'Bwindi Impenetrable Forest is home to about half of the world’s mountain gorillas.',
  'The Rwenzori, the “Mountains of the Moon”, hold glaciers almost on the equator. Margherita Peak rises 5,109 m.',
  'Lake Victoria, Africa’s largest lake, is shared by Uganda, Kenya and Tanzania.',
  'The equator crosses Uganda. At Kayabwe you can stand with one foot in each hemisphere.',
  'At Murchison Falls the entire Nile squeezes through a gap only about 7 metres wide.',
  'Uganda became independent on 9 October 1962.',
  'Kampala is traditionally said to be built on seven hills.',
  'More than 40 languages are spoken in Uganda. English and Swahili are the official languages.',
  'Luganda is the most widely spoken local language. “Oli otya?” means “How are you?”',
  'Over 1,000 bird species have been recorded in Uganda, one of the richest birdwatching countries on Earth.',
  'The Kasubi Tombs in Kampala, burial grounds of the Kabakas of Buganda, are a UNESCO World Heritage Site.',
  'In Ishasha, in Queen Elizabeth National Park, lions are famous for lounging up in fig trees.',
  'A rolex isn’t a watch in Uganda: it’s a chapati rolled with an omelette, the country’s favourite street food.',
];

// Flight game: dreams to collect along the route.
export const DREAMS = ['Hope', 'Family', 'Education', 'Courage', 'A new life'];
