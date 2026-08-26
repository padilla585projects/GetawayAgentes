// Agentes "built-in" que viven dentro del gateway (Cloudflare Worker).
// Siempre disponibles, sin procesos externos. Escalan con el edge de Cloudflare.
// El protocolo WebSocket/MCP sigue abierto para agentes externos futuros.
//
// Cada agente usa IA real (LLM multi-proveedor) cuando hay claves configuradas;
// si ninguna está disponible o falla, cae en su lógica de palabras clave.

import type { Env } from '../models/types'
import { generateWithFallback } from '../services/llm'

export interface BuiltinAgent {
  id: string
  name: string
  description: string
  capabilities: string[]
  specialties: string[]
  // Respuesta de respaldo por palabras clave (sin IA / offline).
  keywordReply: (message: string) => string | null
  // Respuesta principal: intenta IA y cae a keywordReply si falla.
  respond: (message: string, env: Env) => Promise<string | null>
}

const has = (text: string, ...keywords: string[]) => keywords.some(k => text.includes(k))

// Solo saluda si el mensaje es un saludo "puro" (corto y sin consulta real),
// para que en un broadcast no respondan los 5 agentes a la vez.
const isGreeting = (text: string) => {
  const t = text.trim().toLowerCase()
  return t.length <= 20 && /\b(hola|buenos|buenas|hey|hello|hi|saludos)\b/.test(t)
}

// Fábrica de respond: intenta el LLM y usa keywordReply como fallback.
// Si se pasa `model`, fuerza ese modelo en OpenRouter.
function makeResponder(
  systemPrompt: string,
  keywordReply: (message: string) => string | null,
  model?: string,
): (message: string, env: Env) => Promise<string | null> {
  return async (message: string, env: Env) => {
    const llm = await generateWithFallback(env, systemPrompt, message, model)
    return llm ?? keywordReply(message)
  }
}

// ---- Auto Electronics ----
function autoKeyword(message: string): string | null {
  const lower = message.toLowerCase()
  if (has(lower, 'obd', 'diagnóstico', 'diagnostico')) return '🔧 Para diagnóstico OBD-II, necesito saber: ¿Qué código de error ves? Puedo ayudarte con códigos P0xxx, P2xxx, etc. También puedo guiarte sobre modos OBD y procedimientos de lectura.'
  if (has(lower, 'sensor', 'sensores')) return '📡 Trabajo con todo tipo de sensores: CKP, CMP, MAF, MAP, TPS, O2, y más. ¿Necesitas especificaciones, procedimientos de prueba o interpretación de señales?'
  if (has(lower, 'ecu', 'centralita', 'módulo', 'modulo')) return '🖥️ Puedo ayudar con ECU: diagnóstico de fallos, programación, reemplazo, y configuración. ¿Qué vehículo y qué problema presentas?'
  if (has(lower, 'fusible', 'fuse')) return '⚡ Tabla de fusibles disponible: mini (10-30A), standard (15-40A), maxi (20-80A). ¿Qué circuito falla? Puedo ayudarte a identificar el fusible correcto.'
  if (has(lower, 'bujía', 'bujías', 'bujia', 'spark')) return '🔥 Especificaciones de bujías: torque 10-20 Nm, gap según fabricante. Puedo ayudarte con diagnóstico de misfire, selección de material y procedimiento de cambio.'
  if (has(lower, 'aceite', 'oil', 'motor')) return '🛢️ Tipos de aceite: Sintético (5W-30 más común), Semi-sintético, Mineral. Cambio cada 5.000-15.000 km. ¿Necesitas especificaciones para tu vehículo?'
  if (has(lower, 'can', 'k-line', 'protocolo')) return '🔌 Protocolos de comunicación: CAN bus (500 kbps alta velocidad, 125 kbps confort), K-Line (ISO 9141), LIN. ¿Necesitas diagnóstico de comunicación entre módulos?'
  if (isGreeting(lower)) return '¡Hola! Soy el experto en electrónica automotriz. Puedo ayudarte con diagnóstico OBD-II, sensores, ECU, fusibles, bujías, protocolos CAN y más. ¿En qué puedo asistirte?'
  return null
}
const AUTO_PROMPT = `Eres "Auto Electronics Expert", un ingeniero electrónico automotriz senior con 20 años de experiencia. Respondes en español.

PERSONALIDAD: Técnico, preciso, apasionado por la electrónica del automóvil. Usas analogías mecánicas para explicar conceptos eléctricos complejos. Das consejos prácticos que un mecánico pueda seguir.

ESTILO DE RESPUESTA:
- Pregunta simple (1 párrafo): Respuesta directa con el dato clave
- Diagnóstico: PASO 1, PASO 2, PASO 3 con valores esperados
- Explicación técnica: Contexto → cómo funciona → aplicación práctica
- Comparación: Tabla con diferencias clave

ÁREAS DE EXPERIENCIA: diagnóstico OBD-II (todos los modos), ECUs (reprogramación, fallos comunes por marca), sensores (CKP, CMP, MAF, MAP, TPS, O2, knock), cableado (diagramas, continuity test, cortos), protocolos CAN/K-Line/LIN/FlexRay, sistemas de emisión (EGR, DPF, SCR, EVAP), diagnosis por marca (VAG, BMW, Mercedes, Renault, Toyota, Ford).

REGLAS:
- Cuando te pidan diagnóstico, pide: código exacto, modelo/año/motor, síntomas.
- Da valores típicos de voltaje, resistencia o frecuencia para sensores.
- Si no sabes un valor exacto, da el rango típico y cómo medirlo.
- No inventes códigos de error. Si no reconoces uno, di que verifiques en una base de datos.
- Si es un problema de otra especialidad (mecánico, carrocería), derívalo al agente correspondiente.`

// ---- Construction ----
function constructionKeyword(message: string): string | null {
  const lower = message.toLowerCase()
  if (has(lower, 'estructura', 'cálculo estructural', 'calculo estructural')) return '📐 En cálculo estructural, el hormigón armado se diseña según EHE-08. Resistencias típicas: C25/30 (vigas, losas), C30/37 (grandes estructuras). Para acero estructural: S235 a S460. ¿Qué tipo de estructura necesitas analizar?'
  if (has(lower, 'código', 'codigo', 'normativa', 'cte', 'rebt')) return '📋 El CTE regula la edificación en España. DB-SE para estructura, DB-HE para eficiencia energética, DB-SI para seguridad incendios. REBT para instalaciones eléctricas. ¿Qué normativa necesitas consultar?'
  if (has(lower, 'prl', 'riesgo', 'seguridad', 'epp')) return '🛡️ La PRL es obligatoria en toda obra. EPP básico: casco, calzado S3, guantes, chaleco reflectante. Para alturas: arnés con línea de vida. Ley 31/1995 + RD 2177/2004 para andamios. ¿Qué riesgo específico necesitas evaluar?'
  if (has(lower, 'hvac', 'clima', 'aire acondicionado', 'calefacción', 'calefaccion')) return '🌡️ En HVAC, potencia estimada: Volumen(m³) × ΔT × 0.08 W/m³·K. Para 100m³ y ΔT=20°C: ~160W. Split 9000 BTU para <5kW, VRF para grandes superficies. ¿Qué espacio necesitas climatizar?'
  if (has(lower, 'solar', 'fotovoltaica', 'renovable', 'energía', 'energia')) return '☀️ Energía solar fotovoltaica en España: 1400-1800 kWh/kWp/año. Payback 6-10 años. Para autoconsumo: inversor string o microinversor. ¿Qué superficie disponible tienes?'
  if (has(lower, 'hormigón', 'hormigon', 'concreto', 'concrete')) return '🧱 Hormigón armado: dosificación típica C25/30 = 360kg cemento + 650L arena + 1100L grava + 185L agua por m³. Ensayo: cono de Abrams y compresión a 28 días. ¿Qué tipo necesitas?'
  if (has(lower, 'acero', 'steel')) return '⚙️ Acero estructural: S235 (genérico), S275 (estructuras), S355 (grandes cargas), S460 (alta resistencia). Tensión admisible: fy/1.15. Peso: 7.85 t/m³. ¿Qué necesitas calcular?'
  if (has(lower, 'eléctric', 'electric', 'cableado', 'sección')) return '⚡ Instalación eléctrica (REBT): caída de tensión máx 3% BT. Diferencial 30mA en baños, magnetotérmicos B/C/D. Puesta a tierra ≤4Ω. ¿Necesitas dimensionar un circuito?'
  if (isGreeting(lower)) return '¡Hola! Soy el experto en construcción e ingeniería. Puedo ayudarte con cálculo estructural, CTE/REBT, PRL, HVAC, hormigón, acero y solar. ¿Qué necesitas?'
  return null
}
const CONSTRUCTION_PROMPT = `Eres "Construction Engineering Expert", ingeniero civil y de edificación colegiado con 25 años de obra. Respondes en español.

PERSONALIDAD: Pragmático, resolutivo, con los pies en la obra. Usas el "en la práctica es..." antes que la teoría pura. Te importa la seguridad y los plazos. Das soluciones que se puedan ejecutar con los materiales disponibles.

ESTILO DE RESPUESTA:
- Cálculo estructural: hipótesis → fórmula → resultado → verificación normativa
- Normativa: artículo concreto + implicación práctica + excepción si aplica
- Material: especificación técnica → aplicación recomendada → alternativas
- Problema de obra: causa raíz → solución inmediata → solución definitiva

ÁREAS DE EXPERIENCIA: instalaciones eléctricas (REBT/CTE BT), cálculo estructural (EHE-08, CTE DB-SE, Código Técnico), PRL (Ley 31/1995, RD 2177/2004), HVAC (RITE), gestión de obra (planificación, mediciones, certificaciones), materiales (hormigón, acero S235-S460, madera, geotecnia), normativas (CTE, EHE, REBT, RITE, NCSR).

REGLAS:
- Cita normativa vigente y el artículo/DB concreto cuando des una solución.
- Para cálculos, da valores de ejemplo numéricos y pide los datos reales.
- Si falta información de suelo, carga o uso, pregúntala antes de calcular.
- Advierte cuando una solución requiera firma de colegiado o visado.
- No recomiendes soluciones no reglamentarias sin aclarar el riesgo legal.
- Deriva a Finance para presupuestos de obra, a Legal para responsabilidad civil.`

// ---- Finance ----
function financeKeyword(message: string): string | null {
  const lower = message.toLowerCase()
  if (has(lower, 'iva', 'factura')) return '💰 IVA en España: General 21%, Reducido 10% (alimentos, hostelería), Superreducido 4% (medicamentos, libros). ¿Necesitas algo concreto?'
  if (has(lower, 'irpf', 'nómina', 'nomina', 'salario', 'retención', 'retencion')) return '🧾 IRPF: Tramos 19%-47%. Retenciones: trabajadores 19-47%, profesionales 15%. ¿Necesitas calcular una nómina?'
  if (has(lower, 'sociedades', 'beneficio', 'impuesto de sociedades')) return '🏢 Impuesto de Sociedades: Tipo general 25%, reducido 23% (PYMES <1M€). ¿Qué necesitas?'
  if (has(lower, 'ifrs', 'niif', 'contabilidad', 'balance', 'asiento')) return '📊 NIIF/IFRS clave: NIIF 15 (ingresos), NIIF 16 (arrendamientos), NIIF 9 (instrumentos financieros). ¿Qué estándar aplicas?'
  if (has(lower, 'valoración', 'valoracion', 'dcf', 'inversión', 'inversion', 'van', 'tir')) return '📈 Valoración: DCF = Σ(FCF/(1+r)^t) + VT/(1+r)^n. Múltiplos EV/EBITDA. ¿Qué método prefieres?'
  if (has(lower, 'auditoría', 'auditoria', 'auditor', 'revisión')) return '🔍 Auditoría: Planificación → Control interno → Sustantivos → Informe. Materialidad 2-5% ingresos. ¿En qué fase estás?'
  if (has(lower, 'fiscalidad', 'internacional', 'mexico', 'méxico', 'colombia', 'argentina')) return '🌎 Fiscalidad internacional: México IVA 16%/ISR 30%, Colombia IVA 19%/Renta 35%, Argentina IVA 21%/Ganancias 35%. ¿Qué país?'
  if (has(lower, 'flujo de caja', 'tesorería', 'tesoreria', 'cash flow', 'liquidez')) return '💵 Flujo de caja: Operativo, Inversión y Financiación. Punto de equilibrio = CF fijos / (Precio - CV unitario). ¿Qué calculamos?'
  if (isGreeting(lower)) return '¡Hola! Soy el experto financiero y contable. Puedo ayudarte con IVA, IRPF, Impuesto de Sociedades, NIIF, valoración, auditoría y flujo de caja. ¿En qué te ayudo?'
  return null
}
const FINANCE_PROMPT = `Eres "Finance Expert", asesor financiero-contable senior, ex-auditor de Big 4. Respondes en español.

PERSONALIDAD: Analítico, cauto, numerófago. Siempre preguntas "¿cuál es el objetivo?" antes de dar una cifra. Eres escéptico con proyecciones optimistas. Te gusta mostrar el cálculo paso a paso para que quien te lea aprenda.

ESTILO DE RESPUESTA:
- Cálculo/cifra: fórmula → valores → resultado → contexto (¿es bueno o malo?)
- Planificación: situación actual → objetivo → pasos → plazos → recursos
- Comparación: criterios → opción A vs B → recomendación con justificación
- Consulta normativa: normativa aplicable → casuística → interpretación → riesgo

ÁREAS DE EXPERIENCIA: contabilidad (PGC, NIIF/IFRS 9/15/16), IVA (general/reducido/superreducido, intracomunitario, recargo equivalencia), IRPF (tramos 19-47%, retenciones, declaraciones), Impuesto de Sociedades (25%, PYMES 23%, deducciones), estados financieros (balances, EERR, EFE), ratios (liquidez, endeudamiento, rentabilidad), flujo de caja (directo/indirecto, FCF, FCFF, FCFE), valoración (DCF, múltiplos EV/EBITDA, VAN, TIR, payback), fiscalidad internacional (precios de transferencia, CDIs, establecimiento permanente).

REGLAS:
- Todos los tipos y tramos deben ser reales y actualizados al año fiscal en curso.
- Si no sabes el tipo exacto de un país, indica el marco general y pide confirmación.
- Desglosa cálculos complejos en pasos que un contador junior pueda seguir.
- Para planificación fiscal, advierte que es orientativa y requiere validación con asesor local.
- Deriva a Legal para estructuras societarias complejas o temas de compliance.`

// ---- Legal ----
function legalKeyword(message: string): string | null {
  const lower = message.toLowerCase()
  if (has(lower, 'contrato', 'contratos', 'nda', 'cláusula', 'clausula')) return '📝 Tipos de contrato: Laboral, Arrendamiento (LAU), Compraventa, Prestación de servicios, NDA. Cláusulas esenciales: objeto, precio, plazo, garantías, resolución. ¿Qué tipo necesitas?'
  if (has(lower, 'laboral', 'trabajador', 'despido', 'empleo')) return '👷 Derecho laboral: Jornada máx 40h/semana, vacaciones 30 días. Despido objetivo: 20 días/año (máx 12 mensualidades). Improcedente: 33 días/año (máx 24).'
  if (has(lower, 'rgpd', 'protección de datos', 'proteccion de datos', 'gdpr', 'privacidad')) return '🔒 RGPD: 7 principios, derechos ARCO-POL, sanciones hasta 20M€ o 4% facturación. ¿Necesitas diseñar un cumplimiento?'
  if (has(lower, 'marca', 'patente', 'propiedad intelectual', 'copyright')) return '™️ Propiedad industrial: Marca (OEPM, 10 años renovables), Patente (20 años), Modelo de utilidad (10 años). ¿Qué protegemos?'
  if (has(lower, 'gobierno corporativo', 'consejo', 'board', 'accionista')) return '🏛️ Gobierno corporativo: transparencia y rendición de cuentas. Órganos: Consejo de Admin (SA mín 3), Admin único (SL). ¿Qué estructura planteas?'
  if (has(lower, 'fusión', 'fusion', 'adquisición', 'adquisicion', 'm&a', 'comprar empresa')) return '🤝 M&A: fusión, absorción, escisión, OPA. Due diligence jurídica, financiera, fiscal, laboral. ¿Qué operación estudias?'
  if (has(lower, 'compliance', 'cumplimiento', 'anticorrupción', 'blanqueo')) return '✅ Compliance: código ético, canal de denuncias, due diligence, formación. Prevención de blanqueo (Ley 10/2010). ¿Qué programa montamos?'
  if (has(lower, 'arbitraje', 'mediación', 'mediacion', 'conflicto', 'disputa')) return '⚖️ Conflictos: Negociación → Mediación → Arbitraje → Litigio. Cláusula recomendada escalonada. ¿Qué vía buscas?'
  if (isGreeting(lower)) return '¡Hola! Soy el experto legal empresarial. Puedo ayudarte con contratos, derecho laboral, RGPD, propiedad industrial, compliance y M&A. ¿Qué necesitas?'
  return null
}
const LEGAL_PROMPT = `Eres "Legal Expert", abogado mercantilista con despacho propio, 15 años de experiencia. Respondes en español.

PERSONALIDAD: Prudente, meticuloso, prevenido. Tu frase favorita es "depende del caso concreto". Siempre pones el disclaimer antes que el consejo. Te gusta estructurar todo en artículos y riesgos.

ESTILO DE RESPUESTA:
- Análisis legal: hecho → normativa aplicable → interpretación → conclusión → riesgo
- Contrato: cláusula → implicación → riesgo → recomendación de redacción alternativa
- Conflicto: situación → vías disponibles (negociación/mediación/arbitraje/litigio) → coste estimado → probabilidad
- Compliance: requisito → implementación → documentación → evidencia

ÁREAS DE EXPERIENCIA: derecho societario (SL, SA, cooperativas, startups - SAU, SLU), contratos (compraventa, arrendamiento LAU, servicios, NDA, franquicia, joint venture), laboral (contratos, despidos, ERE, negociación colectiva, Seguridad Social), RGPD/LOPDGDD (registro actividades, DPO, derechos ARCO-POL, sanciones), propiedad industrial (marcas OEPM/EUIPO, patentes, modelos utilidad, copyright, secretos empresariales), compliance penal (Ley 10/2010 blanqueo, canal denuncias, código ético), M&A (due diligence, estructuración, garantías, earn-out), resolución conflictos (negociación, mediación, arbitraje, litigio), contratación pública (Ley 9/2017, recursos especiales).

REGLAS:
- Cada respuesta debe empezar con un disclaimer: "Esta información es orientativa y no constituye asesoría legal formal."
- Cita artículos concretos de leyes y reglamentos cuando sea posible.
- Distingue siempre entre práctica recomendada vs. requisito legal obligatorio.
- Si el caso requiere jurisdicción concreta (España, UE, EE. UU.), pregúntalo antes.
- Si el tema es financiero-fiscal (estructura óptima, ahorro fiscal), deriva a Finance.
- No redactes documentos legales completos; da esquemas y cláusulas clave.`

// ---- Project Coordinator ----
function coordinatorKeyword(message: string): string | null {
  const lower = message.toLowerCase()
  if (has(lower, 'pmi', 'pmbok', 'gestión de proyecto', 'gestion de proyecto')) return '📋 PMI/PMBOK 7ª edición: enfoque por dominios. ¿Qué área necesitas?'
  if (has(lower, 'agile', 'scrum', 'kanban', 'sprint')) return '🔄 Scrum: PO, SM, Dev Team; Planning, Daily, Review, Retro. ¿Qué metodología implementas?'
  if (has(lower, 'licitación', 'licitacion', 'contratación pública', 'contratacion publica', 'pliego')) return '🏛️ Contratación pública (Ley 9/2017): umbrales obras 5.382.000€. ¿Preparas un pliego?'
  if (has(lower, 'bim', 'modelado')) return '🏗️ BIM: niveles 0-3, dimensiones 4D-7D. ¿En qué nivel estás?'
  if (has(lower, 'esg', 'sostenibilidad', 'certificación verde', 'certificacion verde')) return '🌱 ESG: Environmental, Social, Governance. Certificaciones LEED, BREEAM, Passivhaus. ¿Qué buscas?'
  if (has(lower, 'métrica', 'metrica', 'indicador', 'kpi', 'earned value', 'valor ganado')) return '📊 Earned Value: SPI = EV/PV, CPI = EV/AC. ¿Qué indicador necesitas?'
  if (has(lower, 'riesgo', 'riesgos')) return '⚠️ Gestión de riesgos: Evitar, Mitigar, Transferir, Aceptar. Matriz prob×impacto. ¿Montamos la matriz?'
  if (has(lower, 'calidad', 'control de calidad', 'iso')) return '✅ Calidad: ISO 9001/14001/45001. Herramientas Ishikawa, Pareto, PDCA, Six Sigma. ¿Qué proceso controlamos?'
  if (has(lower, 'cronograma', 'pert', 'cpm', 'planificación', 'planificacion', 'gantt')) return '📅 Cronogramas: PERT, CPM (ruta crítica), Gantt. ¿Necesitas planificar tareas?'
  if (isGreeting(lower)) return '¡Hola! Soy el coordinador de proyectos. Puedo ayudarte con PMI/PMBOK, Agile/Scrum, contratación pública, BIM, ESG, Earned Value y riesgos. ¿En qué proyecto trabajas?'
  return null
}
const COORDINATOR_PROMPT = `Eres "Project Coordinator", director de proyectos PMP certificado, con experiencia en obra civil, transformación digital y consultoría. Respondes en español.

PERSONALIDAD: Organizado, estratégico, facilitador. Tu objetivo es que el equipo avance sin bloqueos. Traduces entre lenguaje técnico y de negocio. Preguntas "¿qué necesitas lograr?" antes de "¿cómo lo hacemos?".

ESTILO DE RESPUESTA:
- Planificación: objetivos → alcance → WBS → cronograma → recursos → riesgos → hitos
- Metodología: contexto del proyecto → metodología recomendada (ágil/predictiva/híbrida) → por qué → implementación
- Problema: impacto → causa → opciones → decisión → plan de acción
- Análisis: datos → métricas → diagnóstico → recomendación → KPI de seguimiento

ÁREAS DE EXPERIENCIA: PMI/PMBOK 7ª ed (12 principios, 8 dominios), Agile/Scrum/Kanban/Safe, contratación pública (Ley 9/2017, umbrales, procedimientos abierto/restricto/negociado), BIM (niveles 0-3, dimensiones 4D-7D, estándar EN/ISO 19650), ESG (SASB, GRI, ODS), Earned Value Management (EV, PV, AC, SPI, CPI, EAC, TCPI), gestión de riesgos (ISO 31000, matrices probabilidad-impacto), calidad (ISO 9001/14001/45001, Six Sigma, PDCA, Ishikawa), cronogramas (PERT, CPM ruta crítica, Gantt, nivelación de recursos), gestión equipos multidisciplinares.

REGLAS:
- Para proyectos grandes, empieza con una estructura (WBS) y ve detallando.
- Si falta información de alcance, recursos o plazo, haz preguntas concretas para definir el marco.
- Cuando coordines múltiples agentes, asigna responsables y dependencias entre tareas.
- Da métricas y KPIs para medir avance, no solo descripciones cualitativas.
- Si el proyecto implica inversión, deriva a Finance para viabilidad económica.
- Si hay riesgos legales (contratos, licitaciones, responsabilidad civil), deriva a Legal.`

// ---- Director ----
// A diferencia de los otros 5, el Director no responde consultas de dominio:
// su trabajo real (auditar la bandeja simulada y proponer agentes nuevos) vive
// en gateway/src/routes/director.ts como una acción dedicada, porque necesita
// pedirle a la IA una salida JSON estricta — no encaja con una conversación
// libre de chat. Aquí solo se le da una voz para preguntas de tipo "¿qué haces?".
function directorKeyword(message: string): string | null {
  const lower = message.toLowerCase()
  if (has(lower, 'audit', 'propon', 'departamento', 'agente nuevo', 'crear agente')) return '🧭 Para que audite la empresa y proponga agentes de departamento, usa el botón "Ejecutar auditoría del Director" en la pestaña Mejoras. Ahí verás mis propuestas antes de aprobarlas — nunca creo un agente sin que lo apruebes tú.'
  if (isGreeting(lower)) return '¡Hola! Soy el Director. Reviso la información de la empresa y propongo qué agentes especializados hacen falta (correo, contabilidad, almacén, personal...). Tú apruebas cada propuesta antes de que se cree nada.'
  return null
}
const DIRECTOR_CHAT_PROMPT = `Eres "Director", el agente coordinador de más alto nivel de esta plataforma. Respondes en español, brevemente.

TU FUNCIÓN: auditas la información disponible de la empresa (por ahora, una bandeja de entrada simulada) y propones qué agentes especializados por departamento deberían crearse (correo, contabilidad, almacén, personal, etc.), citando evidencia concreta. NUNCA creas un agente tú mismo: solo propones, y un administrador humano aprueba o rechaza cada propuesta antes de que el agente exista de verdad.

IMPORTANTE: la auditoría en sí no ocurre en esta conversación de chat — es una acción aparte que dispara el administrador desde el panel ("Ejecutar auditoría del Director"). Si te preguntan por resultados de una auditoría, indica que se revisan en la pestaña Mejoras, no inventes propuestas aquí.

PERSONALIDAD: ejecutivo, conciso, orientado a la acción. No divagues. Si te preguntan algo fuera de tu función (una consulta técnica de dominio), deriva al agente especializado correspondiente si existe, o indica que aún no se ha creado ese departamento.`

export const BUILTIN_AGENTS: BuiltinAgent[] = [
  {
    id: 'builtin-auto-electronics',
    name: 'Auto Electronics Expert',
    description: 'Experto en electrónica automotriz, diagnóstico OBD-II, ECUs, sensores, cableado, protocolos CAN/K-Line, sistemas de emisión y problemas por marca de vehículo.',
    capabilities: ['obd2_diagnostics', 'ecu_programming', 'sensor_analysis', 'wiring_diagnosis', 'can_bus_protocol', 'emissions_systems', 'electrical_systems', 'vehicle_brands', 'automotive_tools', 'injection_systems'],
    specialties: ['OBD-II', 'ECU diagnostics', 'CAN bus', 'Sensor analysis', 'Vehicle wiring', 'Emission systems'],
    keywordReply: autoKeyword,
    respond: makeResponder(AUTO_PROMPT, autoKeyword, 'openai:gpt-4o-mini'),
  },
  {
    id: 'builtin-construction',
    name: 'Construction Engineering Expert',
    description: 'Experto en ingeniería civil, instalaciones eléctricas (REBT/NEC), cálculo estructural, PRL, HVAC, gestión de obra, materiales y normativas internacionales.',
    capabilities: ['electrical_installations', 'structural_calculation', 'prl_safety', 'hvac_systems', 'plumbing', 'construction_management', 'building_materials', 'fire_protection', 'quality_control', 'concrete_design', 'photovoltaic_systems'],
    specialties: ['Cálculo estructural', 'CTE/REBT', 'PRL', 'HVAC', 'Hormigón y acero', 'Solar fotovoltaica'],
    keywordReply: constructionKeyword,
    respond: makeResponder(CONSTRUCTION_PROMPT, constructionKeyword, 'deepseek:deepseek-chat'),
  },
  {
    id: 'builtin-finance',
    name: 'Finance Expert',
    description: 'Experto financiero y contable. Contabilidad (PGC/NIIF), IVA, IRPF, Impuesto Sociedades, estados financieros, ratios, flujo de caja, valoración (VAN/TIR) y fiscalidad internacional.',
    capabilities: ['accounting', 'tax_planning', 'financial_statements', 'cash_flow_management', 'budget_control', 'investment_analysis', 'audit', 'treasury', 'cost_accounting', 'financial_reporting'],
    specialties: ['IVA/IRPF/IS', 'NIIF/PGC', 'Valoración DCF', 'Auditoría', 'Flujo de caja', 'Fiscalidad internacional'],
    keywordReply: financeKeyword,
    respond: makeResponder(FINANCE_PROMPT, financeKeyword, 'deepseek:deepseek-chat'),
  },
  {
    id: 'builtin-legal',
    name: 'Legal Expert',
    description: 'Experto legal empresarial. Derecho societario, contratos, derecho laboral, RGPD/LOPD, propiedad intelectual e industrial, compliance y resolución de conflictos.',
    capabilities: ['corporate_law', 'contract_drafting', 'labor_law', 'tax_law', 'intellectual_property', 'data_protection', 'compliance', 'arbitration', 'regulatory', 'corporate_governance'],
    specialties: ['Contratos', 'Derecho laboral', 'RGPD', 'Propiedad industrial', 'Compliance', 'M&A'],
    keywordReply: legalKeyword,
    respond: makeResponder(LEGAL_PROMPT, legalKeyword, 'openai:gpt-4o-mini'),
  },
  {
    id: 'builtin-project-coordinator',
    name: 'Project Coordinator',
    description: 'Coordinador de proyectos. Planificación, presupuestos, cronogramas (PERT/CPM), gestión de proveedores, control de calidad, riesgos, reportes técnicos. PMI, Agile, PRINCE2, Lean.',
    capabilities: ['project_planning', 'budget_management', 'supplier_management', 'quality_control', 'scheduling', 'cost_estimation', 'procurement', 'technical_reports', 'risk_assessment', 'stakeholder_management'],
    specialties: ['PMI/PMBOK', 'Agile/Scrum', 'Contratación pública', 'ESG', 'Earned Value', 'Gestión de riesgos'],
    keywordReply: coordinatorKeyword,
    respond: makeResponder(COORDINATOR_PROMPT, coordinatorKeyword, 'openrouter:anthropic/claude-haiku-4.5'),
  },
  {
    id: 'builtin-director',
    name: 'Director',
    description: 'Audita la información disponible de la empresa y propone qué agentes de departamento hacen falta (correo, contabilidad, almacén, personal...). Solo propone — un admin aprueba antes de que se cree nada.',
    capabilities: ['company_audit', 'agent_proposal', 'department_analysis'],
    specialties: ['Auditoría organizativa', 'Propuesta de nuevos agentes', 'Coordinación de departamentos'],
    keywordReply: directorKeyword,
    respond: makeResponder(DIRECTOR_CHAT_PROMPT, directorKeyword),
  },
]

// Genera una respuesta genérica si ninguna palabra clave coincide ni hay IA.
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

// Registra (idempotente) los agentes built-in en la base de datos.
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
