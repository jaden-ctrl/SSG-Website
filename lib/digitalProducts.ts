export type ProductListing = {
 slug: string;
 number: string;
 category: string;
 name: string;
 price: number;
 description: string;
 audience: string;
 lead: string;
 formats: string[];
 highlights: string[];
 steps: string[];
 faq: string[][];
};

export const productCatalog: ProductListing[] = [
  {
    "slug": "client-acquisition-sales-toolkit",
    "number": "01",
    "category": "SALES & GROWTH",
    "name": "Client Acquisition & Sales Toolkit",
    "price": 79,
    "description": "Build a consistent prospecting, outreach and follow-up process with practical client acquisition templates.",
    "audience": "Service businesses, independent consultants and B2B sellers",
    "lead": "Turn scattered outreach into a repeatable sales process.",
    "formats": [
      "Excel (.xlsx)",
      "Word (.docx)",
      "PDF",
      "HTML"
    ],
    "highlights": [
      "9-sheet sales CRM and pipeline workbook",
      "29 editable outreach and conversation templates",
      "Discovery-call worksheet and proposal summary",
      "30-day sales execution plan",
      "Client quote template and quick-start guide"
    ],
    "steps": [
      "Identify your target customer and qualifying criteria.",
      "Track each new lead and the next follow-up date.",
      "Personalize an outreach message, then log the result.",
      "Use the discovery worksheet before preparing a proposal.",
      "Review opportunities and follow-ups every week."
    ],
    "faq": [
      [
        "Does this send emails automatically?",
        "No. Scripts and trackers are editable tools. You choose the communication channel and send messages yourself."
      ],
      [
        "Can I edit the templates?",
        "Yes. The included workbook and Word documents are intended to be adapted for your own business."
      ]
    ]
  },
  {
    "slug": "business-profit-pricing-calculator",
    "number": "02",
    "category": "FINANCE & PRICING",
    "name": "Business Profit & Pricing Calculator",
    "price": 39,
    "description": "Price services, model expenses and estimate break-even sales using an interactive financial workbook.",
    "audience": "Service providers and business owners reviewing costs and margins",
    "lead": "Know the numbers behind every quote.",
    "formats": [
      "Excel (.xlsx)",
      "PDF"
    ],
    "highlights": [
      "10-sheet financial calculator with dashboard",
      "Service pricing and margin analysis",
      "Monthly overhead and break-even planning",
      "12-month forecast and scenario lab",
      "Client quote builder and quick-start guide"
    ],
    "steps": [
      "Enter real expense and business assumptions.",
      "Add service delivery costs and expected volumes.",
      "Review margins, capacity and the operating break-even point.",
      "Test alternative pricing and cost scenarios.",
      "Prepare customer quotes from your verified assumptions."
    ],
    "faq": [
      [
        "Does this replace an accountant?",
        "No. It is a planning tool, not accounting, legal or tax advice."
      ],
      [
        "Is Excel required?",
        "It is designed as an Excel workbook. Other spreadsheet programs may handle formatting or formulas differently."
      ]
    ]
  },
  {
    "slug": "small-business-launch-kit",
    "number": "03",
    "category": "STARTUP PLANNING",
    "name": "Small Business Launch Kit",
    "price": 59,
    "description": "Plan, validate and organize a new business with editable worksheets and a structured 90-day roadmap.",
    "audience": "First-time founders, solo operators and emerging small businesses",
    "lead": "Turn a business idea into a documented launch plan.",
    "formats": [
      "Excel (.xlsx)",
      "Word (.docx)",
      "PDF"
    ],
    "highlights": [
      "14-sheet startup finance and roadmap workbook",
      "Editable 11-page business plan builder",
      "Customer discovery interview kit",
      "One-page offer canvas and weekly planner",
      "10-page launch playbook and 90-day roadmap"
    ],
    "steps": [
      "Define your buyer and the problem you intend to solve.",
      "Run discovery interviews and document findings.",
      "Estimate launch costs, pricing and cash needs.",
      "Define a concrete offer and a simple acquisition test.",
      "Follow the weekly 90-day execution roadmap."
    ],
    "faq": [
      [
        "Does this establish or register a business?",
        "No. You must separately handle incorporation, permits, taxes and local requirements."
      ],
      [
        "Are sample financial numbers included?",
        "Yes. Example figures illustrate the model and must be replaced with your actual assumptions."
      ]
    ]
  },
  {
    "slug": "90-day-marketing-content-engine",
    "number": "04",
    "category": "MARKETING",
    "name": "90-Day Marketing Content Engine",
    "price": 49,
    "description": "Plan three months of marketing activity with editable posts, campaigns, prompts and KPI tracking.",
    "audience": "Small businesses managing their own content and marketing",
    "lead": "Spend less time staring at a blank content calendar.",
    "formats": [
      "Excel (.xlsx)",
      "Word (.docx)",
      "CSV",
      "PDF"
    ],
    "highlights": [
      "90-day editable content calendar and 11-sheet workbook",
      "52 adaptable social captions",
      "40 marketing prompts for AI assistants",
      "24 email templates across six campaigns",
      "16 short-form video scripts and KPI dashboard"
    ],
    "steps": [
      "Choose your target audience and content pillars.",
      "Tailor the included calendar to your products and capacity.",
      "Personalize captions, email sequences and video scripts.",
      "Publish on your preferred channels.",
      "Log actual results in the weekly KPI tracker."
    ],
    "faq": [
      [
        "Will posts publish automatically?",
        "No. This is a planning and tracking toolkit. You publish using the social tools you already use."
      ],
      [
        "Can I reuse the templates?",
        "You can adapt the templates for use within your business, subject to the included customer license."
      ]
    ]
  },
  {
    "slug": "client-onboarding-retention-system",
    "number": "05",
    "category": "CLIENT OPERATIONS",
    "name": "Client Onboarding & Retention System",
    "price": 69,
    "description": "Standardize client intake, kickoff, delivery, handoff and relationship follow-up.",
    "audience": "Service businesses and small teams managing client projects",
    "lead": "Give every new client a smoother, repeatable experience.",
    "formats": [
      "Excel (.xlsx)",
      "Word (.docx)",
      "PDF"
    ],
    "highlights": [
      "9-sheet customer success and retention tracker",
      "Seven editable Word documents",
      "18 client communication messages",
      "Intake, kickoff and project handoff templates",
      "Retention playbook and 14-day implementation plan"
    ],
    "steps": [
      "Customize intake and kickoff templates to your service.",
      "Enter clients and delivery milestones into the tracker.",
      "Assign owners and due dates to onboarding tasks.",
      "Follow up at defined post-delivery intervals.",
      "Review satisfaction and renewal risks regularly."
    ],
    "faq": [
      [
        "Is this a full CRM?",
        "No. It is a structured Excel and Word operating toolkit, not a hosted CRM."
      ],
      [
        "Does it automatically email clients?",
        "No. Client messages are templates that you send using your own communication systems."
      ]
    ]
  },
  {
    "slug": "ai-business-automation-playbook",
    "number": "06",
    "category": "AI & AUTOMATION",
    "name": "AI Business Automation Playbook",
    "price": 99,
    "description": "Identify, design and safely roll out AI-assisted workflows with reusable prompts and implementation controls.",
    "audience": "Owners and small teams exploring practical AI-assisted operations",
    "lead": "Move from AI experimentation to repeatable, reviewed workflows.",
    "formats": [
      "Excel (.xlsx)",
      "Word (.docx)",
      "PDF",
      "TXT"
    ],
    "highlights": [
      "60 copy-ready business AI prompts",
      "12 documented workflow blueprints",
      "9-sheet opportunity scoring and ROI workbook",
      "30-day rollout and QA testing plan",
      "Human approval, governance and incident templates"
    ],
    "steps": [
      "Select a low-risk repetitive task and document its inputs.",
      "Score effort, impact and likely return on investment.",
      "Customize a workflow blueprint and prompt.",
      "Test with fictional or approved data before deployment.",
      "Use human approval checkpoints and track results."
    ],
    "faq": [
      [
        "Does the toolkit include AI subscriptions or software?",
        "No. You bring your own AI tools and accounts; the package includes planning and implementation resources."
      ],
      [
        "Will it automatically connect my business apps?",
        "No. Integrations and any required development must be configured separately."
      ]
    ]
  }
];

export const bundleOffer = {
 slug: 'business-growth-bundle',
 name: 'SSG Business Growth Bundle',
 price: 199,
 regularPrice: 394,
 description: 'All six SSG digital products together: sales, pricing, launch planning, marketing, client operations and AI workflow planning.',
} as const;

export const getProductBySlug = (slug: string) => productCatalog.find(product => product.slug === slug);
