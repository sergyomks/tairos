export const TEAM_MEMBERS = [
  { id: "1", name: "Sergio", role: "Backend / DevOps", avatar: "S", color: "#8b5cf6" },
  { id: "2", name: "Carlos", role: "Frontend / Diseño", avatar: "C", color: "#06b6d4" },
  { id: "3", name: "Ana", role: "Negocio / Producto", avatar: "A", color: "#10b981" },
];

export const CHAT_MESSAGES = [
  {
    id: "m1",
    sender: "Ana",
    role: "Negocio",
    avatar: "A",
    color: "#10b981",
    content: "Necesitamos un SaaS de control de inventarios para restaurantes. El mercado en LATAM está desatendido.",
    time: "09:15 AM",
    isAgent: false,
  },
  {
    id: "m2",
    sender: "Sergio",
    role: "Backend",
    avatar: "S",
    color: "#8b5cf6",
    content: "Tiene sentido. Podríamos reutilizar el módulo de autenticación del último proyecto y enfocarnos en el CRUD de productos.",
    time: "09:17 AM",
    isAgent: false,
  },
  {
    id: "m3",
    sender: "Carlos",
    role: "Frontend",
    avatar: "C",
    color: "#06b6d4",
    content: "Voy a revisar los componentes de tabla que ya tenemos. Creo que se pueden adaptar rápido.",
    time: "09:19 AM",
    isAgent: false,
  },
  {
    id: "m4",
    sender: "@tairos-architect",
    role: "System Agent",
    avatar: "T",
    color: "#8b5cf6",
    content: "He analizado la intención. Propongo la siguiente arquitectura: Next.js + Supabase con 4 tablas (productos, categorías, movimientos, alertas). Generando PRP v1.0 para votación.",
    time: "09:20 AM",
    isAgent: true,
  },
];

export const PRP_VOTE = {
  title: "PRP v1.0: SaaS de Inventarios para Restaurantes",
  description: "Implementar plataforma de gestión de inventarios con alertas de stock bajo, dashboard de movimientos y reportes semanales.",
  sprint: "Sprint 1",
  votes: [
    { name: "Ana", status: "approved" as "approved" | "pending" | "rejected" },
    { name: "Sergio", status: "approved" as "approved" | "pending" | "rejected" },
    { name: "Carlos", status: "pending" as "approved" | "pending" | "rejected" },
  ],
  approvedCount: 2,
  totalCount: 3,
};

export const PROJECTS = [
  {
    id: "p1",
    name: "Nimbus HR",
    type: "SaaS de Recursos Humanos",
    status: "deployed" as const,
    uptime: "99.9%",
    users: 1420,
    growth: "+8%",
    revenue: "$8,560",
    conversionRate: "4.2%",
  },
  {
    id: "p2",
    name: "Quantum CRM",
    type: "CRM de Ventas B2B",
    status: "deployed" as const,
    uptime: "100%",
    users: 980,
    growth: "+12%",
    revenue: "$6,230",
    conversionRate: "3.8%",
  },
  {
    id: "p3",
    name: "InvenTrack",
    type: "Inventarios para Restaurantes",
    status: "developing" as const,
    uptime: "—",
    users: 0,
    growth: "—",
    revenue: "—",
    conversionRate: "—",
  },
];

export const AGENT_TASKS = [
  {
    id: "t1",
    agent: "Worker 1 (Qwen-Coder)",
    agentIcon: "🤖",
    task: "Crear endpoints de base de datos",
    phase: "database" as const,
    status: "completed" as const,
    progress: 100,
  },
  {
    id: "t2",
    agent: "Worker 2 (DeepSeek-Coder)",
    agentIcon: "🐺",
    task: "Diseñar componentes React de la interfaz",
    phase: "frontend" as const,
    status: "in_progress" as const,
    progress: 68,
  },
  {
    id: "t3",
    agent: "Worker 3 (Llama-3 Local)",
    agentIcon: "🦙",
    task: "Generar y ejecutar pruebas de QA",
    phase: "qa" as const,
    status: "pending" as const,
    progress: 0,
  },
];

export const HEALING_EVENTS = [
  {
    id: "h1",
    type: "error" as const,
    title: "Error de Test — Playwright",
    detail: "Botón de envío no encontrado en /checkout",
    timestamp: "Hace 3 min",
  },
  {
    id: "h2",
    type: "diagnosis" as const,
    agent: "Agente Auditor",
    detail: "El selector del botón cambió de 'button.submit' a '#submit-btn'. Se requiere actualizar el test.",
    timestamp: "Hace 2 min",
  },
  {
    id: "h3",
    type: "fix" as const,
    agent: "Agente Refactor",
    oldCode: 'await page.click("button.submit")',
    newCode: 'await page.click("#submit-btn")',
    timestamp: "Hace 1 min",
  },
  {
    id: "h4",
    type: "success" as const,
    title: "Pruebas Locales: 100% Pasadas",
    detail: "12/12 tests pasaron exitosamente.",
    timestamp: "Ahora",
  },
];

export const RUNNER_STATUS = {
  isOnline: true,
  lastHeartbeat: "Hace 12s",
  cpu: "23%",
  ram: "1.2 GB / 8 GB",
  tasksProcessed: 47,
  uptime: "3d 14h 22m",
};
