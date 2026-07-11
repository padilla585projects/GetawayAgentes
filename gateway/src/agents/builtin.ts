// Agentes "built-in" que viven dentro del gateway (Cloudflare Worker).
// Siempre disponibles, sin procesos externos. Escalan con el edge de Cloudflare.
// El protocolo WebSocket/MCP sigue abierto para agentes externos futuros.

export interface BuiltinAgent {
  id: string
  name: string
  description: string
  capabilities: string[]
  specialties: string[]
  respond: (message: string) => string | null
}

const has = (text: string, ...keywords: string[]) => keywords.some(k => text.includes(k))

export const BUILTIN_AGENTS: BuiltinAgent[] = [
  {
    id: 'builtin-auto-electronics',
    name: 'Auto Electronics Expert',
    description: 'Experto en electrónica automotriz, diagnóstico OBD-II, ECUs, sensores, cableado, protocolos CAN/K-Line, sistemas de emisión y problemas por marca de vehículo.',
    capabilities: ['obd2_diagnostics', 'ecu_programming', 'sensor_analysis', 'wiring_diagnosis', 'can_bus_protocol', 'emissions_systems', 'electrical_systems', 'vehicle_brands', 'automotive_tools', 'injection_systems'],
    specialties: ['OBD-II', 'ECU diagnostics', 'CAN bus', 'Sensor analysis', 'Vehicle wiring', 'Emission systems'],
    respond(message) {
      const lower = message.toLowerCase()
      if (has(lower, 'obd', 'diagnóstico', 'diagnostico')) return '🔧 Para diagnóstico OBD-II, necesito saber: ¿Qué código de error ves? Puedo ayudarte con códigos P0xxx, P2xxx, etc. También puedo guiarte sobre modos OBD y procedimientos de lectura.'
      if (has(lower, 'sensor', 'sensores')) return '📡 Trabajo con todo tipo de sensores: CKP, CMP, MAF, MAP, TPS, O2, y más. ¿Necesitas especificaciones, procedimientos de prueba o interpretación de señales?'
      if (has(lower, 'ecu', 'centralita', 'módulo', 'modulo')) return '🖥️ Puedo ayudar con ECU: diagnóstico de fallos, programación, reemplazo, y configuración. ¿Qué vehículo y qué problema presentas?'
      if (has(lower, 'fusible', 'fuse')) return '⚡ Tabla de fusibles disponible: mini (10-30A), standard (15-40A), maxi (20-80A). ¿Qué circuito falla? Puedo ayudarte a identificar el fusible correcto.'
      if (has(lower, 'bujía', 'bujías', 'bujia', 'spark')) return '🔥 Especificaciones de bujías: torque 10-20 Nm, gap según fabricante. Puedo ayudarte con diagnóstico de misfire, selección de material y procedimiento de cambio.'
      if (has(lower, 'aceite', 'oil', 'motor')) return '🛢️ Tipos de aceite: Sintético (5W-30 más común), Semi-sintético, Mineral. Cambio cada 5.000-15.000 km. ¿Necesitas especificaciones para tu vehículo?'
      if (has(lower, 'can', 'k-line', 'protocolo')) return '🔌 Protocolos de comunicación: CAN bus (500 kbps alta velocidad, 125 kbps confort), K-Line (ISO 9141), LIN. ¿Necesitas diagnóstico de comunicación entre módulos?'
      if (has(lower, 'hola', 'buenos', 'hello', 'hi ')) return '¡Hola! Soy el experto en electrónica automotriz. Puedo ayudarte con diagnóstico OBD-II, sensores, ECU, fusibles, bujías, protocolos CAN y más. ¿En qué puedo asistirte?'
      return null
    },
  },
  {
    id: 'builtin-construction',
    name: 'Construction Engineering Expert',
    description: 'Experto en ingeniería civil, instalaciones eléctricas (REBT/NEC), cálculo estructural, PRL (prevención riesgos laborales), HVAC, gestión de obra, materiales de construcción y normativas internacionales.',
    capabilities: ['electrical_installations', 'structural_calculation', 'prl_safety', 'hvac_systems', 'plumbing', 'construction_management', 'building_materials', 'fire_protection', 'quality_control', 'concrete_design', 'photovoltaic_systems'],
    specialties: ['Cálculo estructural', 'CTE/REBT', 'PRL', 'HVAC', 'Hormigón y acero', 'Solar fotovoltaica'],
    respond(message) {
      const lower = message.toLowerCase()
      if (has(lower, 'estructura', 'cálculo estructural', 'calculo estructural')) return '📐 En cálculo estructural, el hormigón armado se diseña según EHE-08. Resistencias típicas: C25/30 (vigas, losas), C30/37 (grandes estructuras). Para acero estructural: S235 a S460. ¿Qué tipo de estructura necesitas analizar?'
      if (has(lower, 'código', 'codigo', 'normativa', 'cte', 'rebt')) return '📋 El CTE (Código Técnico de Edificación) regula la edificación en España. DB-SE para estructura, DB-HE para eficiencia energética, DB-SI para seguridad incendios. REBT para instalaciones eléctricas. ¿Qué normativa necesitas consultar?'
      if (has(lower, 'prl', 'riesgo', 'seguridad', 'epp')) return '🛡️ La PRL es obligatoria en toda obra. EPP básico: casco, calzado S3, guantes, chaleco reflectante. Para alturas: arnés con línea de vida. Ley 31/1995 + RD 2177/2004 para andamios. ¿Qué riesgo específico necesitas evaluar?'
      if (has(lower, 'hvac', 'clima', 'aire acondicionado', 'calefacción', 'calefaccion')) return '🌡️ En HVAC, potencia estimada: Volumen(m³) × ΔT × 0.08 W/m³·K. Para 100m³ y ΔT=20°C: ~160W. Split 9000 BTU para <5kW, VRF para grandes superficies. ¿Qué espacio necesitas climatizar?'
      if (has(lower, 'solar', 'fotovoltaica', 'renovable', 'energía', 'energia')) return '☀️ Energía solar fotovoltaica en España: 1400-1800 kWh/kWp/año. Payback 6-10 años. Para autoconsumo: inversor string o microinversor. Potencia típica: 1.5-3 kWp/100m². ¿Qué superficie disponible tienes?'
      if (has(lower, 'hormigón', 'hormigon', 'concreto', 'concrete')) return '🧱 Hormigón armado: dosificación típica C25/30 = 360kg cemento + 650L arena + 1100L grava + 185L agua por m³. Ensayo: cono de Abrams (slump) + compresión a 28 días. Resistencia: 25 MPa a 28 días.'
      if (has(lower, 'acero', 'steel')) return '⚙️ Acero estructural: S235 (genérico), S275 (estructuras), S355 (grandes cargas), S460 (alta resistencia). Tensión admisible: fy/1.15. Peso: 7.85 t/m³. Soldadura según UNE-EN 1090.'
      if (has(lower, 'eléctric', 'electric', 'cableado', 'sección')) return '⚡ Instalación eléctrica (REBT): caída de tensión máx 3% BT. Diferencial 30mA en baños, magnetotérmicos B/C/D. Puesta a tierra ≤4Ω. ¿Necesitas dimensionar un circuito?'
      if (has(lower, 'hola', 'buenos', 'hello', 'hi ')) return '¡Hola! Soy el experto en construcción e ingeniería. Puedo ayudarte con cálculo estructural, CTE/REBT, PRL, HVAC, hormigón, acero y solar. ¿Qué necesitas?'
      return null
    },
  },
  {
    id: 'builtin-finance',
    name: 'Finance Expert',
    description: 'Experto financiero y contable. Contabilidad (PGC/NIIF), IVA, IRPF, Impuesto Sociedades, estados financieros, ratios, flujo de caja, análisis inversiones (VAN/TIR/Payback), presupuestos, auditoría, fiscalidad internacional.',
    capabilities: ['accounting', 'tax_planning', 'financial_statements', 'cash_flow_management', 'budget_control', 'investment_analysis', 'audit', 'treasury', 'cost_accounting', 'financial_reporting'],
    specialties: ['IVA/IRPF/IS', 'NIIF/PGC', 'Valoración DCF', 'Auditoría', 'Flujo de caja', 'Fiscalidad internacional'],
    respond(message) {
      const lower = message.toLowerCase()
      if (has(lower, 'iva', 'factura')) return '💰 IVA en España: General 21%, Reducido 10% (alimentos, hostelería), Superreducido 4% (medicamentos, libros). Regla de inversión del sujeto pasivo en construcción. Periodicidad: mensual si facturación >6.010.121€/año.'
      if (has(lower, 'irpf', 'nómina', 'nomina', 'salario', 'retención', 'retencion')) return '🧾 IRPF: Tramos 19%-47%. Reducción general. Retenciones: trabajadores 19-47%, profesionales 15%, arrendamientos 19%. SS trabajador: 6.35%, empresa: ~29.9%. ¿Necesitas calcular una nómina?'
      if (has(lower, 'sociedades', 'beneficio', 'impuesto de sociedades')) return '🏢 Impuesto de Sociedades: Tipo general 25%, reducido 23% (PYMES <1M€), cooperativas 20%. Compensación de pérdidas sin límite temporal. Deducciones I+D+i: 25-42%. Pagos fraccionados trimestrales.'
      if (has(lower, 'ifrs', 'niif', 'contabilidad', 'balance', 'asiento')) return '📊 NIIF/IFRS clave: NIIF 15 (ingresos en 5 pasos), NIIF 16 (arrendamientos en balance), NIIF 9 (instrumentos financieros). Plan General Contable España: grupos 1-7. ¿Qué estándar necesitas aplicar?'
      if (has(lower, 'valoración', 'valoracion', 'dcf', 'inversión', 'inversion', 'van', 'tir')) return '📈 Valoración de empresas: DCF = Σ(FCF/(1+r)^t) + VT/(1+r)^n. Múltiplos: EV/EBITDA (tecnología 15-25x, industria 8-12x, retail 6-10x). VAN y TIR para proyectos. ¿Qué método prefieres?'
      if (has(lower, 'auditoría', 'auditoria', 'auditor', 'revisión')) return '🔍 Auditoría financiera: Planificación → Evaluación control interno → Procedimientos sustantivos → Informe. Materialidad: 2-5% ingresos, 1-2% activos. Riesgo de auditoría = RI × RC × RD.'
      if (has(lower, 'fiscalidad', 'internacional', 'mexico', 'méxico', 'colombia', 'argentina')) return '🌎 Fiscalidad internacional: México IVA 16%, ISR 30%. Colombia IVA 19%, Renta 35%. Argentina IVA 21%, Ganancias 35%. Chile IVA 19%. Perú IGV 18%. ¿Qué país necesitas?'
      if (has(lower, 'flujo de caja', 'tesorería', 'tesoreria', 'cash flow', 'liquidez')) return '💵 Flujo de caja: Operativo, Inversión y Financiación. Punto de equilibrio = CF fijos / (Precio - CV unitario). VAN = Σ(flujos/(1+r)^t) - Inversión inicial.'
      if (has(lower, 'hola', 'buenos', 'hello', 'hi ')) return '¡Hola! Soy el experto financiero y contable. Puedo ayudarte con IVA, IRPF, Impuesto de Sociedades, NIIF, valoración de empresas, auditoría y flujo de caja. ¿En qué te ayudo?'
      return null
    },
  },
  {
    id: 'builtin-legal',
    name: 'Legal Expert',
    description: 'Experto legal empresarial. Derecho societario (SL, SA, cooperativas), contratos (laborales, arrendamiento, compraventa, servicios, NDA), derecho laboral, RGPD/LOPD, propiedad intelectual e industrial, compliance, resolución de conflictos.',
    capabilities: ['corporate_law', 'contract_drafting', 'labor_law', 'tax_law', 'intellectual_property', 'data_protection', 'compliance', 'arbitration', 'regulatory', 'corporate_governance'],
    specialties: ['Contratos', 'Derecho laboral', 'RGPD', 'Propiedad industrial', 'Compliance', 'M&A'],
    respond(message) {
      const lower = message.toLowerCase()
      if (has(lower, 'contrato', 'contratos', 'nda', 'cláusula', 'clausula')) return '📝 Tipos de contrato principales: Laboral (indefinido/temporal), Arrendamiento (LAU), Compraventa, Prestación de servicios, NDA, Distribución, Franquicia. Cláusulas esenciales: objeto, precio, plazo, garantías, resolución. ¿Qué tipo necesitas?'
      if (has(lower, 'laboral', 'trabajador', 'despido', 'empleo')) return '👷 Derecho laboral: Jornada máx 40h/semana, vacaciones 30 días naturales, permisos retribuidos. Despido objetivo: 20 días/año (máx 12 mensualidades). Improcedente: 33 días/año (máx 24 mensualidades).'
      if (has(lower, 'rgpd', 'protección de datos', 'proteccion de datos', 'gdpr', 'privacidad')) return '🔒 RGPD: 7 principios (licitud, finalidad, minimización, exactitud, limitación, integridad, responsabilidad). Derechos ARCO-POL. Sanciones: hasta 20M€ o 4% de facturación. DPO obligatorio en ciertos casos.'
      if (has(lower, 'marca', 'patente', 'propiedad intelectual', 'copyright')) return '™️ Propiedad industrial: Marca (OEPM, 10 años renovables, ~150€), Patente (20 años, 5.000-15.000€), Modelo de utilidad (10 años). Propiedad intelectual: vida del autor + 70 años. Software protegido como obra literaria.'
      if (has(lower, 'gobierno corporativo', 'consejo', 'board', 'accionista')) return '🏛️ Gobierno corporativo: transparencia, rendición de cuentas, equidad. Órganos: Consejo de Admin (SA: mín 3 consejeros), Administrador único (SL). Derechos del accionista: voto, información, impugnación, dividendo.'
      if (has(lower, 'fusión', 'fusion', 'adquisición', 'adquisicion', 'm&a', 'comprar empresa')) return '🤝 M&A: fusión, absorción, escisión, OPA. Due diligence: jurídica, financiera, fiscal, laboral, medioambiental. Cláusulas clave: garantías, no competencia, MAC clause, break fee, earn-out.'
      if (has(lower, 'compliance', 'cumplimiento', 'anticorrupción', 'blanqueo')) return '✅ Programa de compliance: código ético, canal de denuncias, due diligence de terceros, formación. Prevención de blanqueo (Ley 10/2010): identificar clientes, vigilar operaciones, comunicar a SEPBLAC.'
      if (has(lower, 'arbitraje', 'mediación', 'mediacion', 'conflicto', 'disputa')) return '⚖️ Resolución de conflictos: 1) Negociación, 2) Mediación (confidencial), 3) Arbitraje (vinculante, 3-12 meses), 4) Litigio (1-5+ años). Cláusula recomendada: Negociación → Mediación → Arbitraje.'
      if (has(lower, 'hola', 'buenos', 'hello', 'hi ')) return '¡Hola! Soy el experto legal empresarial. Puedo ayudarte con contratos, derecho laboral, RGPD, propiedad industrial, compliance y M&A. ¿Qué necesitas?'
      return null
    },
  },
  {
    id: 'builtin-project-coordinator',
    name: 'Project Coordinator',
    description: 'Coordinador de proyectos. Planificación, presupuestos, cronogramas (PERT/CPM), gestión de proveedores, control de calidad, gestión de riesgos, reportes técnicos. Metodologías: Waterfall, Agile, PRINCE2, Lean.',
    capabilities: ['project_planning', 'budget_management', 'supplier_management', 'quality_control', 'scheduling', 'cost_estimation', 'procurement', 'technical_reports', 'risk_assessment', 'stakeholder_management'],
    specialties: ['PMI/PMBOK', 'Agile/Scrum', 'Contratación pública', 'ESG', 'Earned Value', 'Gestión de riesgos'],
    respond(message) {
      const lower = message.toLowerCase()
      if (has(lower, 'pmi', 'pmbok', 'gestión de proyecto', 'gestion de proyecto')) return '📋 PMI/PMBOK 7ª edición: enfoque por dominios (Personas, Proceso, Entorno de negocio). Principios: entregables, planificación, equipo, comunicaciones, alcance, cronograma, costes, calidad, riesgos, stakeholders. ¿Qué área necesitas?'
      if (has(lower, 'agile', 'scrum', 'kanban', 'sprint')) return '🔄 Scrum: Roles (PO, SM, Dev Team), Ceremonias (Planning, Daily, Review, Retro), Artefactos (Backlog, Sprint Backlog, Increment). Sprint 1-4 semanas. Kanban: visualizar flujo, limitar WIP. ¿Qué metodología implementas?'
      if (has(lower, 'licitación', 'licitacion', 'contratación pública', 'contratacion publica', 'pliego')) return '🏛️ Contratación pública España (Ley 9/2017): umbrales obras 5.382.000€, servicios 215.000€. Criterios: precio 40-60%, experiencia 15-25%, propuesta técnica 20-40%. Pliegos: técnicos + jurídicos.'
      if (has(lower, 'bim', 'modelado')) return '🏗️ BIM: Nivel 0=2D, 1=3D separado, 2=modelos federados, 3=integrado. Dimensiones: 4D (tiempo), 5D (coste), 6D (sostenibilidad), 7D (FM). Software: Revit, ArchiCAD, Navisworks. ¿En qué nivel estás?'
      if (has(lower, 'esg', 'sostenibilidad', 'certificación verde', 'certificacion verde')) return '🌱 ESG: Environmental (CO2, energía, residuos), Social (diversidad, seguridad), Governance (ética, transparencia). Certificaciones: LEED, BREEAM, Passivhaus. CSRD obligatoria para grandes empresas UE.'
      if (has(lower, 'métrica', 'metrica', 'indicador', 'kpi', 'earned value', 'valor ganado')) return '📊 Earned Value: SPI = EV/PV (>1=adelantado), CPI = EV/AC (>1=bajo presupuesto). CV = EV-AC, SV = EV-PV. KPIs de calidad: first pass yield >95%, CSAT/NPS. ¿Qué indicador necesitas?'
      if (has(lower, 'riesgo', 'riesgos')) return '⚠️ Gestión de riesgos: 4 respuestas = Evitar, Mitigar, Transferir, Aceptar. Matriz probabilidad × impacto (1-25). Herramientas: risk register, RBS, Monte Carlo, Ishikawa. ¿Quieres montar una matriz?'
      if (has(lower, 'calidad', 'control de calidad', 'iso')) return '✅ Calidad: ISO 9001 (gestión), ISO 14001 (medio ambiente), ISO 45001 (seguridad). Herramientas: Ishikawa, Pareto (80/20), PDCA, Six Sigma (≤3.4 DPMO), SPC. ¿Qué proceso quieres controlar?'
      if (has(lower, 'cronograma', 'pert', 'cpm', 'planificación', 'planificacion', 'gantt')) return '📅 Cronogramas: PERT (3 estimaciones), CPM (ruta crítica), Gantt (visualización). Holgura = LS - ES. La ruta crítica define la duración mínima del proyecto. ¿Necesitas planificar tareas?'
      if (has(lower, 'hola', 'buenos', 'hello', 'hi ')) return '¡Hola! Soy el coordinador de proyectos. Puedo ayudarte con PMI/PMBOK, Agile/Scrum, contratación pública, BIM, ESG, Earned Value y gestión de riesgos. ¿En qué proyecto trabajas?'
      return null
    },
  },
]

// Genera una respuesta genérica si ninguna palabra clave coincide.
export function fallbackResponse(agent: BuiltinAgent): string {
  return `Soy ${agent.name}. Mis especialidades: ${agent.specialties.join(', ')}. ¿Puedes darme más detalle sobre lo que necesitas?`
}

export function findBuiltinAgent(id: string): BuiltinAgent | undefined {
  return BUILTIN_AGENTS.find(a => a.id === id)
}

// IDs de los agentes built-in (para marcarlos siempre online).
export const BUILTIN_AGENT_IDS = new Set(BUILTIN_AGENTS.map(a => a.id))

type MinimalDB = {
  prepare(sql: string): {
    bind(...args: unknown[]): { run(): Promise<unknown>; first(): Promise<unknown> }
    run(): Promise<unknown>
  }
}

let builtinReady: Promise<void> | null = null

// Registra (idempotente) los agentes built-in en la base de datos como
// aprobados y de confianza. Se ejecuta una vez al iniciar el worker.
export function ensureBuiltinAgents(db: MinimalDB): Promise<void> {
  if (!builtinReady) {
    builtinReady = (async () => {
      for (const agent of BUILTIN_AGENTS) {
        await db.prepare(`
          INSERT INTO agents (id, name, description, version, capabilities, endpoint, connection_type, owner, is_external, status, trust_level, metadata, max_concurrent_tasks, updated_at)
          VALUES (?, ?, ?, '1.0.0', ?, 'builtin', 'builtin', 'getaway-agentes', 0, 'idle', 'trusted', ?, 5, datetime('now'))
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            description = excluded.description,
            capabilities = excluded.capabilities,
            status = 'idle',
            trust_level = 'trusted',
            metadata = excluded.metadata,
            updated_at = datetime('now')
        `).bind(
          agent.id,
          agent.name,
          agent.description,
          JSON.stringify(agent.capabilities),
          JSON.stringify({ builtin: true, specialties: agent.specialties }),
        ).run()
      }
    })().catch((e) => {
      builtinReady = null
      throw e
    })
  }
  return builtinReady
}
