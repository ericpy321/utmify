// Textos de la interfaz en español, inglés y portugués.
// El español es la referencia: los otros idiomas deben tener exactamente las mismas claves.

const es = {
  app: { name: "Tracker de Ventas" },
  nav: {
    dashboard: "Dashboard", campaigns: "Campañas", sales: "Ventas", creativeHub: "Creative Hub",
    connect: "Conectar", settings: "Configuración", logout: "Salir",
    allPlatforms: "Todas", meta: "Meta", tiktok: "TikTok",
  },
  common: {
    sample: "Ejemplo",
    sampleBanner: "Estás viendo DATOS DE EJEMPLO. Ningún número de esta pantalla es real hasta que conectes tus cuentas.",
    demoNoAuth: "Modo desarrollo sin Supabase: el login está desactivado solo en tu máquina local.",
    noData: "Sin datos", search: "Buscar", status: "Estado", all: "Todos", active: "Activo", paused: "Pausado",
    theme: "Tema", dark: "Oscuro", light: "Claro", language: "Idioma", save: "Guardar", saved: "Guardado",
    refresh: "Actualizar", refreshing: "Actualizando…", vsPrev: "vs. período anterior", copy: "Copiar", copied: "Copiado",
    total: "Total", readOnly: "Solo lectura", count: "Cantidad",
  },
  filters: {
    period: "Período", today: "Hoy", yesterday: "Ayer", last7: "7 días", last30: "30 días", custom: "Personalizado",
    from: "Desde", to: "Hasta", account: "Cuenta de anuncios", allAccounts: "Todas las cuentas",
    offer: "Oferta", allOffers: "Todas las ofertas", timezone: "Zona horaria", currency: "Moneda", apply: "Aplicar",
  },
  kpi: {
    revenue: "Facturación", spend: "Gasto", profit: "Lucro", roas: "ROAS", roi: "ROI", sales: "Ventas",
    cpa: "CPA", aov: "Ticket medio", refunds: "Reembolsos", chargebacks: "Contracargos",
    net: "Líquido recibido", attribution: "Ventas atribuidas a un anuncio", orders: "Pedidos",
  },
  dashboard: {
    salesByHour: "Ventas por hora", funnel: "Embudo", checkout: "Checkout iniciado", purchase: "Compra",
    upsell1: "Upsell 1", upsell2: "Upsell 2", refundsChargebacks: "Reembolsos y contracargos",
    cutIn: "Día recortado en", fxUsed: "Cotización", lastSync: "Última sincronización", never: "nunca",
    attributionLow: "Solo {pct} de las ventas tienen anuncio de origen (meta: 80%). Páginas que más pierden el rastreo:",
    unknownPage: "página desconocida",
    netMissing: "{n} ventas llegaron sin comisión del gateway: se usó el valor bruto como líquido.",
    attributionFiltered: "Con filtro de plataforma o cuenta solo se cuentan ventas con origen.",
    checkoutNotSent: "El gateway no envía este evento",
    taxesNote: "Lucro ya descuenta impuestos y costos de Configuración.",
  },
  campaigns: {
    title: "Campañas", name: "Nombre", budget: "Presupuesto/día", account: "Cuenta",
    note: "Estado y presupuesto son solo de lectura en esta versión.", empty: "No hay gasto ni ventas en el período.",
  },
  sales: {
    title: "Ventas", all: "Todas", unattributed: "Sin origen", time: "Hora", product: "Producto", value: "Valor",
    status: "Estado", platform: "Plataforma", campaign: "Campaña", ad: "Anuncio", gateway: "Gateway",
    buyer: "Comprador", approved: "Aprobada", refunded: "Reembolsada", chargeback: "Contracargo",
    showing: "Mostrando {n} de {total}", unattributedHelp: "Ventas que llegaron sin parámetros de rastreo. Revisa la página indicada.",
    sourcePage: "Página", empty: "No hay ventas en el período.",
    kind: { main: "Principal", bump: "Order bump", upsell1: "Upsell 1", upsell2: "Upsell 2", downsell: "Downsell" },
  },
  connect: {
    title: "Conectar", status: "Estado", notConnected: "No conectado", pendingLast: "Se configura en la etapa final de integraciones.",
    adPlatforms: "Plataformas de anuncios", gateways: "Gateways de pago", webhookUrl: "URL del webhook",
    trackingScript: "Script de rastreo", urlParams: "Parámetros de URL",
    paramsHelp: "Pega esto en el campo «Parámetros de URL» de cada anuncio. Usa IDs, no nombres: los nombres cambian y se repiten.",
    verifyMacros: "Las macros se verifican contra la documentación vigente de cada plataforma en la etapa de integraciones.",
    scriptPending: "El script se genera en la etapa de integraciones, cuando definamos tu gateway.",
    webhookPending: "Cada gateway tendrá su propia URL en el dominio de producción.",
  },
  creatives: {
    title: "Creative Hub", offers: "Ofertas", batches: "Tandas", batch: "Tanda", creatives: "Creativos",
    tested: "Probados", validated: "Validados", champions: "Campeones", testing: "En prueba", rejected: "Reprobado",
    champion: "Campeón", validatedOne: "Validado", assertiveness: "Asertividad",
    evolution: "Evolución de la asertividad por tanda", modeValidated: "Validados ÷ probados",
    modeChampions: "Campeones ÷ probados", rules: "Regla", ruleValidated: "Validado", ruleChampion: "Campeón",
    minSales: "ventas mín.", minRoas: "ROAS mín.", invested: "Invertido", date: "Fecha",
    finished: "Finalizada", inTesting: "En prueba", copy: "Copy", editor: "Editor", back: "Volver",
    rulesHelp: "Cambia los números y todo se recalcula al momento.", noCode: "Anuncios sin código de creativo",
    rejectedHelp: "Reprobado = tanda finalizada sin llegar a validado.", hook: "Gancho", format: "Formato",
    lifetime: "Números de toda la vida del creativo, sumando todas las cuentas y campañas.",
  },
  settings: {
    title: "Configuración", defaults: "Vista por defecto", costs: "Costos para el lucro",
    revenueTax: "Impuesto sobre la facturación (%)", spendTax: "Impuesto/IOF sobre el gasto en anuncios (%)",
    costPerSale: "Costo fijo por venta (en la moneda del panel)", feeNote: "La comisión del gateway se toma del webhook.",
    rules: "Regla del Creative Hub", stored: "Guardado en esta sesión del navegador hasta conectar la base de datos.",
  },
  login: {
    title: "Entrar al panel", subtitle: "Te enviamos un enlace mágico a tu correo. Solo los correos autorizados pueden entrar.",
    email: "Correo electrónico", send: "Enviar enlace", sent: "Si el correo está autorizado, en un minuto te llega el enlace.",
    notConfigured: "Falta configurar Supabase (variables de entorno). El panel queda bloqueado hasta entonces.",
    error: "No se pudo iniciar sesión. Pide un enlace nuevo.",
  },
};

export type Dict = typeof es;

const en: Dict = {
  app: { name: "Sales Tracker" },
  nav: {
    dashboard: "Dashboard", campaigns: "Campaigns", sales: "Sales", creativeHub: "Creative Hub",
    connect: "Connect", settings: "Settings", logout: "Log out",
    allPlatforms: "All", meta: "Meta", tiktok: "TikTok",
  },
  common: {
    sample: "Sample",
    sampleBanner: "You are looking at SAMPLE DATA. No number on this screen is real until you connect your accounts.",
    demoNoAuth: "Development mode without Supabase: login is disabled on your local machine only.",
    noData: "No data", search: "Search", status: "Status", all: "All", active: "Active", paused: "Paused",
    theme: "Theme", dark: "Dark", light: "Light", language: "Language", save: "Save", saved: "Saved",
    refresh: "Refresh", refreshing: "Refreshing…", vsPrev: "vs. previous period", copy: "Copy", copied: "Copied",
    total: "Total", readOnly: "Read only", count: "Count",
  },
  filters: {
    period: "Period", today: "Today", yesterday: "Yesterday", last7: "7 days", last30: "30 days", custom: "Custom",
    from: "From", to: "To", account: "Ad account", allAccounts: "All accounts",
    offer: "Offer", allOffers: "All offers", timezone: "Time zone", currency: "Currency", apply: "Apply",
  },
  kpi: {
    revenue: "Revenue", spend: "Spend", profit: "Profit", roas: "ROAS", roi: "ROI", sales: "Sales",
    cpa: "CPA", aov: "Average order", refunds: "Refunds", chargebacks: "Chargebacks",
    net: "Net received", attribution: "Sales attributed to an ad", orders: "Orders",
  },
  dashboard: {
    salesByHour: "Sales by hour", funnel: "Funnel", checkout: "Checkout started", purchase: "Purchase",
    upsell1: "Upsell 1", upsell2: "Upsell 2", refundsChargebacks: "Refunds and chargebacks",
    cutIn: "Day cut in", fxUsed: "Exchange rate", lastSync: "Last sync", never: "never",
    attributionLow: "Only {pct} of sales have a source ad (target: 80%). Pages losing tracking the most:",
    unknownPage: "unknown page",
    netMissing: "{n} sales arrived without the gateway fee: gross was used as net.",
    attributionFiltered: "With a platform or account filter, only attributed sales are counted.",
    checkoutNotSent: "The gateway does not send this event",
    taxesNote: "Profit already deducts the taxes and costs from Settings.",
  },
  campaigns: {
    title: "Campaigns", name: "Name", budget: "Budget/day", account: "Account",
    note: "Status and budget are read-only in this version.", empty: "No spend or sales in this period.",
  },
  sales: {
    title: "Sales", all: "All", unattributed: "No source", time: "Time", product: "Product", value: "Amount",
    status: "Status", platform: "Platform", campaign: "Campaign", ad: "Ad", gateway: "Gateway",
    buyer: "Buyer", approved: "Approved", refunded: "Refunded", chargeback: "Chargeback",
    showing: "Showing {n} of {total}", unattributedHelp: "Sales that arrived without tracking parameters. Check the page shown.",
    sourcePage: "Page", empty: "No sales in this period.",
    kind: { main: "Main", bump: "Order bump", upsell1: "Upsell 1", upsell2: "Upsell 2", downsell: "Downsell" },
  },
  connect: {
    title: "Connect", status: "Status", notConnected: "Not connected", pendingLast: "Configured in the final integrations stage.",
    adPlatforms: "Ad platforms", gateways: "Payment gateways", webhookUrl: "Webhook URL",
    trackingScript: "Tracking script", urlParams: "URL parameters",
    paramsHelp: "Paste this into each ad's “URL parameters” field. Use IDs, not names: names change and repeat.",
    verifyMacros: "Macros are checked against each platform's current docs in the integrations stage.",
    scriptPending: "The script is generated in the integrations stage, once your gateway is defined.",
    webhookPending: "Each gateway will get its own URL on the production domain.",
  },
  creatives: {
    title: "Creative Hub", offers: "Offers", batches: "Batches", batch: "Batch", creatives: "Creatives",
    tested: "Tested", validated: "Validated", champions: "Champions", testing: "Testing", rejected: "Rejected",
    champion: "Champion", validatedOne: "Validated", assertiveness: "Hit rate",
    evolution: "Hit rate by batch", modeValidated: "Validated ÷ tested",
    modeChampions: "Champions ÷ tested", rules: "Rule", ruleValidated: "Validated", ruleChampion: "Champion",
    minSales: "min. sales", minRoas: "min. ROAS", invested: "Invested", date: "Date",
    finished: "Finished", inTesting: "Testing", copy: "Copy", editor: "Editor", back: "Back",
    rulesHelp: "Change the numbers and everything recalculates instantly.", noCode: "Ads without a creative code",
    rejectedHelp: "Rejected = finished batch that never reached validated.", hook: "Hook", format: "Format",
    lifetime: "Lifetime numbers per creative, summing every account and campaign.",
  },
  settings: {
    title: "Settings", defaults: "Default view", costs: "Costs for profit",
    revenueTax: "Tax on revenue (%)", spendTax: "Tax on ad spend (%)",
    costPerSale: "Fixed cost per sale (in the panel currency)", feeNote: "The gateway fee comes from the webhook.",
    rules: "Creative Hub rule", stored: "Stored in this browser session until the database is connected.",
  },
  login: {
    title: "Log in to the panel", subtitle: "We'll email you a magic link. Only authorized emails can log in.",
    email: "Email", send: "Send link", sent: "If the email is authorized, the link arrives within a minute.",
    notConfigured: "Supabase is not configured (environment variables). The panel stays locked until then.",
    error: "Could not log in. Request a new link.",
  },
};

const pt: Dict = {
  app: { name: "Tracker de Vendas" },
  nav: {
    dashboard: "Dashboard", campaigns: "Campanhas", sales: "Vendas", creativeHub: "Creative Hub",
    connect: "Conectar", settings: "Configurações", logout: "Sair",
    allPlatforms: "Todas", meta: "Meta", tiktok: "TikTok",
  },
  common: {
    sample: "Exemplo",
    sampleBanner: "Você está vendo DADOS DE EXEMPLO. Nenhum número desta tela é real até você conectar suas contas.",
    demoNoAuth: "Modo de desenvolvimento sem Supabase: o login está desligado só na sua máquina local.",
    noData: "Sem dados", search: "Buscar", status: "Status", all: "Todos", active: "Ativo", paused: "Pausado",
    theme: "Tema", dark: "Escuro", light: "Claro", language: "Idioma", save: "Salvar", saved: "Salvo",
    refresh: "Atualizar", refreshing: "Atualizando…", vsPrev: "vs. período anterior", copy: "Copiar", copied: "Copiado",
    total: "Total", readOnly: "Somente leitura", count: "Quantidade",
  },
  filters: {
    period: "Período", today: "Hoje", yesterday: "Ontem", last7: "7 dias", last30: "30 dias", custom: "Personalizado",
    from: "De", to: "Até", account: "Conta de anúncio", allAccounts: "Todas as contas",
    offer: "Oferta", allOffers: "Todas as ofertas", timezone: "Fuso horário", currency: "Moeda", apply: "Aplicar",
  },
  kpi: {
    revenue: "Faturamento", spend: "Gasto", profit: "Lucro", roas: "ROAS", roi: "ROI", sales: "Vendas",
    cpa: "CPA", aov: "Ticket médio", refunds: "Reembolsos", chargebacks: "Chargebacks",
    net: "Líquido recebido", attribution: "Vendas atribuídas a um anúncio", orders: "Pedidos",
  },
  dashboard: {
    salesByHour: "Vendas por hora", funnel: "Funil", checkout: "Checkout iniciado", purchase: "Compra",
    upsell1: "Upsell 1", upsell2: "Upsell 2", refundsChargebacks: "Reembolsos e chargebacks",
    cutIn: "Dia recortado em", fxUsed: "Cotação", lastSync: "Última sincronização", never: "nunca",
    attributionLow: "Só {pct} das vendas têm anúncio de origem (meta: 80%). Páginas que mais perdem o rastreio:",
    unknownPage: "página desconhecida",
    netMissing: "{n} vendas chegaram sem a taxa do gateway: o valor bruto foi usado como líquido.",
    attributionFiltered: "Com filtro de plataforma ou conta, só contam vendas com origem.",
    checkoutNotSent: "O gateway não envia este evento",
    taxesNote: "O lucro já desconta os impostos e custos das Configurações.",
  },
  campaigns: {
    title: "Campanhas", name: "Nome", budget: "Orçamento/dia", account: "Conta",
    note: "Status e orçamento são somente leitura nesta versão.", empty: "Sem gasto nem vendas no período.",
  },
  sales: {
    title: "Vendas", all: "Todas", unattributed: "Sem origem", time: "Hora", product: "Produto", value: "Valor",
    status: "Status", platform: "Plataforma", campaign: "Campanha", ad: "Anúncio", gateway: "Gateway",
    buyer: "Comprador", approved: "Aprovada", refunded: "Reembolsada", chargeback: "Chargeback",
    showing: "Mostrando {n} de {total}", unattributedHelp: "Vendas que chegaram sem parâmetros de rastreio. Confira a página indicada.",
    sourcePage: "Página", empty: "Sem vendas no período.",
    kind: { main: "Principal", bump: "Order bump", upsell1: "Upsell 1", upsell2: "Upsell 2", downsell: "Downsell" },
  },
  connect: {
    title: "Conectar", status: "Status", notConnected: "Não conectado", pendingLast: "Configurado na etapa final de integrações.",
    adPlatforms: "Plataformas de anúncio", gateways: "Gateways de pagamento", webhookUrl: "URL do webhook",
    trackingScript: "Script de rastreio", urlParams: "Parâmetros de URL",
    paramsHelp: "Cole no campo “Parâmetros de URL” de cada anúncio. Use IDs, não nomes: nomes mudam e se repetem.",
    verifyMacros: "Os macros são conferidos na documentação atual de cada plataforma na etapa de integrações.",
    scriptPending: "O script é gerado na etapa de integrações, quando definirmos seu gateway.",
    webhookPending: "Cada gateway terá sua própria URL no domínio de produção.",
  },
  creatives: {
    title: "Creative Hub", offers: "Ofertas", batches: "Levas", batch: "Leva", creatives: "Criativos",
    tested: "Testados", validated: "Validados", champions: "Campeões", testing: "Em teste", rejected: "Reprovado",
    champion: "Campeão", validatedOne: "Validado", assertiveness: "Assertividade",
    evolution: "Evolução da assertividade por leva", modeValidated: "Validados ÷ testados",
    modeChampions: "Campeões ÷ testados", rules: "Régua", ruleValidated: "Validado", ruleChampion: "Campeão",
    minSales: "vendas mín.", minRoas: "ROAS mín.", invested: "Investido", date: "Data",
    finished: "Finalizada", inTesting: "Em teste", copy: "Copy", editor: "Editor", back: "Voltar",
    rulesHelp: "Mude os números e tudo recalcula na hora.", noCode: "Anúncios sem código de criativo",
    rejectedHelp: "Reprovado = leva finalizada sem chegar a validado.", hook: "Gancho", format: "Formato",
    lifetime: "Números da vida toda do criativo, somando todas as contas e campanhas.",
  },
  settings: {
    title: "Configurações", defaults: "Visão padrão", costs: "Custos para o lucro",
    revenueTax: "Imposto sobre o faturamento (%)", spendTax: "Imposto/IOF sobre o gasto de anúncio (%)",
    costPerSale: "Custo fixo por venda (na moeda do painel)", feeNote: "A taxa do gateway vem do webhook.",
    rules: "Régua do Creative Hub", stored: "Salvo nesta sessão do navegador até conectar o banco de dados.",
  },
  login: {
    title: "Entrar no painel", subtitle: "Enviamos um link mágico para o seu e-mail. Só e-mails autorizados entram.",
    email: "E-mail", send: "Enviar link", sent: "Se o e-mail for autorizado, o link chega em um minuto.",
    notConfigured: "Falta configurar o Supabase (variáveis de ambiente). O painel fica bloqueado até lá.",
    error: "Não foi possível entrar. Peça um link novo.",
  },
};

export type Lang = "es" | "en" | "pt";
export const LANGS: Lang[] = ["es", "en", "pt"];
export const LANG_LABEL: Record<Lang, string> = { es: "Español", en: "English", pt: "Português" };
export const dictionaries: Record<Lang, Dict> = { es, en, pt };

/** Reemplaza {clave} por su valor. */
export function fmt(s: string, vars: Record<string, string | number>) {
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}
