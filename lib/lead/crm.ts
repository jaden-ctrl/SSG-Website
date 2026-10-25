import { LiveTestBlockedError, outboundFetch } from "@/lib/gateway";

export type CrmResult = { status: number; data: unknown; networkError?: boolean };

export type Crm = {
  request(method: string, path: string, body?: unknown, retry?: "never" | "safe"): Promise<CrmResult>;
};

type TaskRecord = { id: string; properties: Record<string, string>; contactId: string; createdAt: number };
type NoteRecord = { id: string; properties: Record<string, string>; contactId: string };
type ContactRecord = { id: string; properties: Record<string, string> };
type CompanyRecord = { id: string; properties: Record<string, string> };

export type MemoryCrm = Crm & {
  state: {
    contacts: ContactRecord[];
    tasks: TaskRecord[];
    notes: NoteRecord[];
    companies: CompanyRecord[];
    contactCompany: Map<string, string>;
    owners: Map<string, { archived: boolean }>;
    calls: { method: string; path: string }[];
    postRetries: { path: string; count: number }[];
  };
};

function json(value: unknown): unknown {
  return value && typeof value === "object" ? value : {};
}

export function createMemoryCrm(options?: { permissiveOwners?: boolean; createDelayMs?: number }): MemoryCrm {
  const state: MemoryCrm["state"] = {
    contacts: [],
    tasks: [],
    notes: [],
    companies: [{ id: "c1", properties: { domain: "existingco.com", name: "Existing Co" } }],
    contactCompany: new Map(),
    owners: new Map(),
    calls: [],
    postRetries: [],
  };
  let sequence = 1;
  const attempts = new Map<string, number>();

  const crm: MemoryCrm = {
    state,
    async request(method, path, body, retry = "safe") {
      const run = async (): Promise<CrmResult> => {
        state.calls.push({ method, path: path.split("?")[0] });
        if (options?.createDelayMs && method === "POST" && path === "/crm/v3/objects/tasks") {
          await new Promise((resolve) => setTimeout(resolve, options.createDelayMs));
        }
        const payload = json(body) as { properties?: Record<string, string>; associations?: { to?: { id?: string } }[]; filterGroups?: { filters: { propertyName: string; value: string }[] }[]; inputs?: { id: string }[] };
        if (method === "GET" && path.startsWith("/crm/v3/objects/contacts/") && !path.includes("/associations/")) {
          const idPart = decodeURIComponent(path.split("/").pop()?.split("?")[0] || "");
          const found = path.includes("idProperty=email")
            ? state.contacts.find((contact) => contact.properties.email === idPart)
            : state.contacts.find((contact) => contact.id === idPart);
          return found ? { status: 200, data: found } : { status: 404, data: null };
        }
        if (path === "/crm/v3/objects/contacts" && method === "POST") {
          const email = payload.properties?.email || "";
          const existing = state.contacts.find((contact) => contact.properties.email === email);
          if (existing) return { status: 409, data: { message: `Contact already exists. Existing ID: ${existing.id}` } };
          const created = { id: `contact-${sequence++}`, properties: { ...(payload.properties || {}) } };
          state.contacts.push(created);
          return { status: 201, data: created };
        }
        if (path.startsWith("/crm/v3/objects/contacts/") && method === "PATCH") {
          const id = path.split("/").pop() || "";
          const contact = state.contacts.find((item) => item.id === id);
          if (!contact) return { status: 404, data: null };
          contact.properties = { ...contact.properties, ...(payload.properties || {}) };
          return { status: 200, data: contact };
        }
        if (path.startsWith("/crm/v3/owners/") && method === "GET") {
          const id = path.split("/")[4]?.split("?")[0] || "";
          if (options?.permissiveOwners && /^\d+$/.test(id)) return { status: 200, data: { id, archived: false } };
          const owner = state.owners.get(id);
          if (!owner || owner.archived) return { status: 404, data: null };
          return { status: 200, data: { id, archived: false } };
        }
        if (method === "GET" && /\/associations\/tasks$/.test(path)) {
          const contactId = path.split("/")[5];
          return { status: 200, data: { results: state.tasks.filter((task) => task.contactId === contactId).map((task) => ({ toObjectId: task.id })) } };
        }
        if (method === "GET" && /\/associations\/notes$/.test(path)) {
          const contactId = path.split("/")[5];
          return { status: 200, data: { results: state.notes.filter((note) => note.contactId === contactId).map((note) => ({ toObjectId: note.id })) } };
        }
        if (path === "/crm/v3/objects/tasks/batch/read" && method === "POST") {
          const ids = new Set((payload.inputs || []).map((item) => item.id));
          return { status: 200, data: { results: state.tasks.filter((task) => ids.has(task.id)) } };
        }
        if (path === "/crm/v3/objects/notes/batch/read" && method === "POST") {
          const ids = new Set((payload.inputs || []).map((item) => item.id));
          return { status: 200, data: { results: state.notes.filter((note) => ids.has(note.id)) } };
        }
        if (method === "GET" && path.startsWith("/crm/v3/objects/tasks/")) {
          const task = state.tasks.find((item) => item.id === path.split("/")[5]);
          return task ? { status: 200, data: task } : { status: 404, data: null };
        }
        if (path === "/crm/v3/objects/tasks" && method === "POST") {
          const created: TaskRecord = {
            id: `task-${sequence++}`,
            properties: { ...(payload.properties || {}) },
            contactId: payload.associations?.[0]?.to?.id || "",
            createdAt: Date.now() + state.tasks.length,
          };
          state.tasks.push(created);
          return { status: 201, data: created };
        }
        if (method === "PATCH" && path.startsWith("/crm/v3/objects/tasks/")) {
          const task = state.tasks.find((item) => item.id === path.split("/")[5]);
          if (!task) return { status: 404, data: null };
          task.properties = { ...task.properties, ...(payload.properties || {}) };
          return { status: 200, data: task };
        }
        if (path === "/crm/v3/objects/notes" && method === "POST") {
          const created: NoteRecord = {
            id: `note-${sequence++}`,
            properties: { ...(payload.properties || {}) },
            contactId: payload.associations?.[0]?.to?.id || "",
          };
          state.notes.push(created);
          return { status: 201, data: created };
        }
        if (method === "GET" && /\/associations\/company$/.test(path.split("?")[0])) {
          const contactId = path.split("/")[5];
          const companyId = state.contactCompany.get(contactId);
          return { status: 200, data: { results: companyId ? [{ toObjectId: companyId }] : [] } };
        }
        if (path === "/crm/v3/objects/companies/search" && method === "POST") {
          const domain = payload.filterGroups?.[0]?.filters?.[0]?.value;
          return { status: 200, data: { results: state.companies.filter((company) => company.properties.domain === domain) } };
        }
        if (path === "/crm/v3/objects/companies" && method === "POST") {
          const created: CompanyRecord = { id: `company-${sequence++}`, properties: { ...(payload.properties || {}) } };
          state.companies.push(created);
          const contactId = payload.associations?.[0]?.to?.id;
          if (contactId) state.contactCompany.set(contactId, created.id);
          return { status: 201, data: created };
        }
        if (method === "PUT" && path.includes("/associations/default/company/")) {
          const parts = path.split("/");
          state.contactCompany.set(parts[5], parts[9]);
          return { status: 200, data: {} };
        }
        return { status: 404, data: null };
      };

      const first = await run();
      const retryable = first.status === 429 || (retry === "safe" && (first.networkError || first.status >= 500 || first.networkError));
      if (!retryable) return first;
      const key = `${method} ${path}`;
      attempts.set(key, (attempts.get(key) || 1) + 1);
      if (method === "POST") state.postRetries.push({ path, count: attempts.get(key) || 0 });
      return run();
    },
  };
  return crm;
}

export function createFailingCrm(mode: "down" | "timeout-once" | "commit-timeout"): Crm & { state: MemoryCrm["state"] } {
  const memory = createMemoryCrm({ permissiveOwners: mode !== "down" });
  let timedOut = false;
  return {
    state: memory.state,
    async request(method, path, body, retry = "safe") {
      if (mode === "down") return { status: 503, data: { category: "SERVICE_UNAVAILABLE" }, networkError: false };
      if (mode === "timeout-once" && !timedOut) {
        timedOut = true;
        return { status: 0, data: null, networkError: true };
      }
      if (mode === "commit-timeout" && method === "POST" && path === "/crm/v3/objects/tasks") {
        const created = await memory.request(method, path, body, "never");
        return { status: 0, data: created.data, networkError: true };
      }
      return memory.request(method, path, body, retry);
    },
  };
}

export function createLiveCrm(): Crm {
  return {
    async request(method, path, body, retry = "safe") {
      const send = async (): Promise<CrmResult> => {
        try {
          const response = await outboundFetch({
            channel: "hubspot",
            path,
            method,
            body: body === undefined ? undefined : JSON.stringify(body),
            timeoutMs: 8_000,
          });
          if (response.headers.get("X-SSG-Outbound") === "mock") {
            const data = await response.json().catch(() => null);
            return { status: response.status, data };
          }
          const data = await response.json().catch(() => null);
          return { status: response.status, data };
        } catch (error) {
          if (error instanceof LiveTestBlockedError) throw error;
          return { status: 0, data: null, networkError: true };
        }
      };
      const first = await send();
      const again = first.status === 429 || (retry === "safe" && (first.networkError || first.status >= 500));
      return again ? send() : first;
    },
  };
}

export function errorClass(result: CrmResult): "retryable" | "permanent" {
  if (result.networkError || result.status === 0 || result.status === 408 || result.status === 429 || result.status >= 500) return "retryable";
  return "permanent";
}
