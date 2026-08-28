export type AtlasSpecialist = {
  id: string;
  name: string;
  purpose: string;
  defaultTools: string[];
  canDelegate: boolean;
};

export const ATLAS_SPECIALIST_REGISTRY: readonly AtlasSpecialist[] = [
  {
    id: "research-intelligence",
    name: "Research & Intelligence",
    purpose: "Gather, verify, synthesize, and cite evidence required for Atlas decisions.",
    defaultTools: ["read", "search"],
    canDelegate: false,
  },
  {
    id: "growth-systems",
    name: "Growth Systems Architect",
    purpose: "Design acquisition, conversion, CRM, automation, retention, and measurement systems.",
    defaultTools: ["read", "simulate"],
    canDelegate: false,
  },
  {
    id: "digital-delivery",
    name: "Digital Delivery Architect",
    purpose: "Plan and review websites, applications, integrations, deployments, and technical delivery.",
    defaultTools: ["read", "draft", "simulate"],
    canDelegate: false,
  },
  {
    id: "qa-assurance",
    name: "QA & Assurance",
    purpose: "Challenge outputs, test success criteria, identify failure modes, and verify evidence before release.",
    defaultTools: ["read", "simulate"],
    canDelegate: false,
  },
];

export function getAtlasSpecialist(id: string) {
  return ATLAS_SPECIALIST_REGISTRY.find((specialist) => specialist.id === id) ?? null;
}
