#!/usr/bin/env node

/**
 * Project Management & Coordination Agent — GetawayAgentes
 *
 * Experto en gestión de proyectos, planificación, presupuestos,
  control de costos, proveedores, cronogramas, calidad y coordinación
  entre equipos técnicos.
 *
 * Coordina tareas entre los otros agentes, genera reportes
  y maneja el ciclo de vida completo de un proyecto.
 */

const http = require('http')
const https = require('https')
const { URL } = require('url')
const WebSocket = require('ws')

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:8787'
// El nombre distingue este agente (proceso Node externo) del builtin homónimo
// que vive dentro del propio Worker (gateway/src/agents/builtin.ts). Antes
// compartían nombre literal y el registro por nombre podía hacer que este
// proceso heredase el id/token del agente builtin al conectarse.
const AGENT_NAME = 'Project Coordinator (Externo)'
const CAPABILITIES = [
  'project_planning',
  'budget_management',
  'supplier_management',
  'quality_control',
  'scheduling',
  'cost_estimation',
  'procurement',
  'technical_reports',
  'change_management',
  'risk_assessment',
  'earned_value',
  'critical_path',
  'stakeholder_management',
  'procurement_management',
  'lean_management',
]

// ─── Metodologías de gestión ───
const METHODOLOGIES = {
  waterfall: { name: 'Waterfall (Cascada)', phases: ['Análisis', 'Diseño', 'Implementación', 'Pruebas', 'Entrega', 'Mantenimiento'], use: 'Proyectos con requisitos fijos, construcción, industria', pros: ['Claro', 'Documentado'], cons: ['Rígido', 'Cambios costosos'] },
  agile: { name: 'Agile (Scrum/Kanban)', phases: ['Backlog', 'Sprint Planning', 'Sprint', 'Review', 'Retrospective'], use: 'Desarrollo software, proyectos dinámicos', pros: ['Flexible', 'Iterativo'], cons: ['Requiere disciplina', 'Menos documentado'] },
  scrum: { name: 'Scrum (Agile)', roles: ['Product Owner', 'Scrum Master', 'Development Team'], ceremonies: ['Sprint Planning (2-4h)', 'Daily Scrum (15min)', 'Sprint Review (1-2h)', 'Sprint Retrospective (1-1.5h)'], artifacts: ['Product Backlog', 'Sprint Backlog', 'Increment', 'Burndown Chart'], sprint_duration: '1-4 semanas (típico 2)', team_size: '5-9 personas' },
  kanban: { name: 'Kanban', principles: ['Visualizar flujo', 'Limitar WIP (work in progress)', 'Medir y gestionar flujo', 'Hacer explícitas reglas'], columns_tipicas: ['Backlog', 'To Do', 'In Progress', 'Review', 'Done'], wip_limits: { default: '3-5 por columna', optimal: 'Depende de capacidad equipo' } },
  prince2: { name: 'PRINCE2', phases: ['Inicio', 'Dirección', 'Cierre'], processes: 8, use: 'Gobierno, grandes proyectos, Europa', pros: ['Estructurado', 'Escalable'], cons: ['Pesado', 'Burocrático'], themes: ['Business case', 'Organization', 'Quality', 'Plans', 'Risk', 'Change', 'Progress'] },
  lean: { name: 'Lean Construction', principles: ['Eliminar desperdicio', 'Flujo continuo', 'Pull planning', 'Mejora continua'], use: 'Construcción, industria', pros: ['Eficiente', 'Reduce costos'], cons: ['Requiere cultura'] },
  pert: { name: 'PERT/CPM', description: 'Diagrama de red con rutas críticas', use: 'Planificación cronograma, construcción', pros: ['Visual', 'Identifica cuellos de botella'], cons: ['Complejo para proyectos grandes'] },
  hybrid: { name: 'Híbrido (Waterfall + Agile)', use: 'Fases waterfall (infraestructura) + sprints agile (software)', pros: ['Combina lo mejor', 'Flexible y estructurado'], cons: ['Requiere experiencia'] },
  phase_gate: { name: 'Phase-Gate (Stage-Gate)', phases: ['Descubrimiento', 'Scoping', 'Planificación', 'Desarrollo', 'Test/Validación', 'Lanzamiento'], gates: ['Go/Kill/Recycle/Hold decisions en cada fase'], use: 'Nuevos productos, I+D' },
}

// ─── Áreas PMI (PMBOK 7ma edición) ───
const PMI_AREAS = {
  entregables: { name: 'Gestión de entregables', desc: 'Definir, producir, validar y entregar entregables del proyecto' },
  plan_proyecto: { name: 'Planificación del proyecto', desc: 'Crear modelo integral que recoja todos los aspectos del proyecto' },
  trabajo_proyecto: { name: 'Dirigir y gestionar el trabajo del proyecto', desc: 'Ejecutar actividades según plan' },
  conocimiento: { name: 'Gestión del conocimiento del proyecto', desc: 'Aprender de la experiencia y aplicar al proyecto' },
  equipo: { name: 'Gestionar el equipo del proyecto', desc: 'Liderar, desarrollar y dirigir equipo' },
  comunicaciones: { name: 'Gestionar las comunicaciones', desc: 'Comunicación efectiva con stakeholders' },
  alcance: { name: 'Gestionar el alcance', desc: 'Definir y controlar qué está y qué no está en el proyecto' },
  cronograma: { name: 'Gestionar el cronograma', desc: 'Gestionar tiempo del proyecto' },
  costes: { name: 'Gestionar los costes', desc: 'Planificar, estimar, presupuestar, financiar, gestionar y controlar costes' },
  calidad: { name: 'Gestionar la calidad', desc: 'Incorporar políticas, procedimientos y estándares de calidad' },
  recursos: { name: 'Gestionar los recursos', desc: 'Identificar, adquirir y gestionar recursos necesarios' },
  adquisiciones: { name: 'Gestionar las adquisiciones', desc: 'Comprar o adquirir productos, servicios o resultados externos' },
  riesgos: { name: 'Gestionar los riesgos', desc: 'Incrementar probabilidad y/o impacto de eventos positivos, reducir negativos' },
  stakeholders: { name: 'Gestionar los stakeholders', desc: 'Identificar, analizar, priorizar e involucrar stakeholders' },
  integracion: { name: 'Gestionar la integración', desc: 'Coordinar todos los elementos del proyecto' },
}

// ─── Contratación pública ───
const PUBLIC_PROCUREMENT = {
  normativa: {
    espana: { ley: 'Ley 9/2017 Contratos del Sector Público', tramitacion: ['Ordinaria', 'Simplificada', 'Urgente'], umbrales: { obras: '5.382.000€', suministros: '144.000€', servicios: '215.000€', consultoria: '144.000€' } },
    mexico: { ley: 'Ley de Adquisiciones, Arrendamientos y Servicios', tramitacion: ['Licitación pública', 'Invitación a cuando menos 3 personas', 'Adjudicación directa'] },
    colombia: { ley: 'Ley 80/1993 + Decreto 1082/2015', tramitacion: ['Licitación pública', 'Selección abreviada', 'Mínima cuantía'] },
    argentina: { ley: 'Ley 17.565 (Licitaciones)', tramitacion: ['Licitación pública', 'Contratación directa', 'Licitación privada'] },
  },
  tipos_contrato: {
    precio_global: { desc: 'Precio fijo total. Menor riesgo para cliente.', ideal: 'Proyecto bien definido' },
    precio_unitario: { desc: 'Precio por unidad de medida. Ajuste según cantidades reales.', ideal: 'Cantidades inciertas' },
    coste_mas_honorarios: { desc: 'Coste real + fee fijo o porcentual.', ideal: 'Proyectos inciertos, consultoría' },
    llave_en_mano: { desc: 'Precio fijo todo incluido (diseño + ejecución).', ideal: 'Quiero que otro se encargue de todo' },
  },
  evaluacion_ofertas: {
    criterios: { precio: '40-60% (mínimo 51% en contratos públicos España)', experiencia: '15-25%', propuesta_tecnica: '20-40%', plazo: '5-10%', sostenibilidad: '5-10%', ird: '5-15% (Innovación, Responsabilidad, Digital)' },
    umbral_cuantia: 'Contratos >60.000€ requieren criterios de adjudicación ponderados',
  },
}

// ─── Métricas avanzadas de proyecto ───
const PROJECT_METRICS = {
  productividad: {
    earned_value: { formula: 'SPI = EV / PV', interpretacion: '>1 adelantado, <1 retrasado', uso: 'Seguimiento cronograma continuo' },
    cost_efficiency: { formula: 'CPI = EV / AC', interpretacion: '>1 bajo presupuesto, <1 sobrecoste', uso: 'Control costes continuo' },
    tcpi: { formula: 'TCPI = (BAC - EV) / (BAC - AC)', desc: 'Coste pendiente para completar según presupuesto' },
  },
  calidad: {
    defect_density: { formula: 'Defectos / unidades entregadas', objetivo: 'Reducir iterativamente' },
    first_pass_yield: { formula: 'Entregables correctos primer intento / total × 100%', objetivo: '>95%' },
    customer_satisfaction: { escala: 'CSAT (1-5), NPS (-100 a +100)', frecuencia: 'Al final de cada sprint/fase' },
  },
  tiempo: {
    lead_time: { desc: 'Tiempo desde petición hasta entrega al cliente', formula: 'Fecha entrega - Fecha petición' },
    cycle_time: { desc: 'Tiempo desde inicio trabajo hasta completar', formula: 'Fecha fin - Fecha inicio' },
    velocity: { desc: 'Puntos historia completados por sprint (Scrum)', formula: 'Suma puntos historia sprint', uso: 'Predecir capacidad futura' },
    on_time_delivery: { formula: 'Entregas a tiempo / total entregas × 100%', objetivo: '>90%' },
  },
  costes: {
    cost_variance: { formula: 'CV = EV - AC', positivo: 'bajo presupuesto' },
    schedule_variance: { formula: 'SV = EV - PV', positivo: 'adelantado' },
    estimate_at_completion: { formula: 'EAC = BAC / CPI', desc: 'Estimación final ajustada por rendimiento' },
    to_complete: { formula: 'ETC = EAC - AC', desc: 'Coste pendiente para completar' },
  },
  stakeholder: {
    engagement_assessment: { niveles: ['Ignorado', 'Resistente', 'Neutral', 'Apoyador', 'Líder'], frecuencia: 'Mensual o por hito' },
    communication_effectiveness: { metrica: 'Tasa respuesta, claridad, tiempo respuesta', encuesta: 'Trimestral con stakeholders clave' },
  },
}

// ─── BIM (Building Information Modeling) ───
const BIM_KNOWLEDGE = {
  niveles: {
    nivel_0: 'CAD 2D. Sin integración.',
    nivel_1: '3D sin integración. Modelos separados por disciplina.',
    nivel_2: 'Modelos federados. Coordinación entre disciplinas.',
    nivel_3: 'Modelo único integrado. Collaborative working.',
  },
  disciplinas: ['Arquitectura', 'Estructura', 'Instalaciones (MEP)', 'Paisajismo', 'Topografía', 'Geotecnia'],
  software: { modelado: ['Revit', 'ArchiCAD', 'BIM 360', 'Navisworks'], estructura: ['Tekla', 'ETABS', 'SAP2000'], MEP: ['Revit MEP', 'MagiCAD', 'Hevacomp'], clash_detection: ['Navisworks', 'BIMcollab', 'Solibri'] },
  beneficios: ['Detección conflictos antes construcción', 'Cuantificación automática', 'Planificación 4D (cronograma + modelo)', 'Costes 5D (presupuesto + modelo)', 'Sostenibilidad 6D', 'Mantenimiento 7D (facility management)'],
}

// ─── Sustainability / ESG ───
const SUSTAINABILITY = {
  esg: {
    environmental: ['Emisiones CO2', 'Consumo energía', 'Gestión residuos', 'Uso agua', 'Biodiversidad'],
    social: ['Diversidad e inclusión', 'Condiciones laborales', 'Comunidad local', 'Salud y seguridad'],
    governance: ['Ética negocios', 'Transparencia', 'Diversidad consejo', 'Anti-corrupción'],
  },
  certificaciones_edificacion: {
    leed: { name: 'LEED (Leadership in Energy and Environmental Design)', niveles: ['Certified', 'Silver', 'Gold', 'Platinum'], creditos: ['Energía', 'Agua', 'Materiales', 'Calidad interior', 'Innovación'] },
    breeam: { name: 'BREEAM (Building Research Establishment)', niveles: ['Pass', 'Good', 'Very Good', 'Excellent', 'Outstanding'] },
    passivhaus: { name: 'Passive House (Passivhaus)', requisitos: ['Consumo <15 kWh/m²a calefacción', 'Consumo <15 kWh/m²a refrigeración', 'Hermeticidad <0.6 ACH@50Pa', 'Calefacción <10 W/m²'] },
    headquarters_verde: { name: 'HQE (Haute Qualité Environnementale)', niveles: ['Débutant', 'Confirmé', 'Excellent', 'Exceptionnel'] },
  },
}

// ─── Gestión de riesgos avanzada ───
const RISK_MANAGEMENT = {
  categorias: {
    estrategicos: { desc: 'Riesgos del negocio y entorno', ejemplos: ['Cambio mercado', 'Nueva competencia', 'Regulación'], mitigation: 'Diversificación, estudios de mercado, planificación escenarios' },
    operacionales: { desc: 'Riesgos de ejecución', ejemplos: ['Retrasos', 'Defectos', 'Pérdida personal clave'], mitigation: 'Planes contingencia, formación, redundancia' },
    financieros: { desc: 'Riesgos monetarios', ejemplos: ['Tipo cambio', 'Tipo interés', 'Liquidez'], mitigation: 'Hedging, seguros, reserva efectivo' },
    legales: { desc: 'Riesgos regulatorios', ejemplos: ['Incumplimiento normativo', 'Demandas', 'Sanciones'], mitigation: 'Legal review, compliance, seguros' },
    reputacionales: { desc: 'Riesgos de imagen', ejemplos: ['Escándalo', 'Fallo producto', 'Redes sociales'], mitigation: 'Comunicación crisis, calidad, transparencia' },
  },
  respuestas: {
    evitar: 'Eliminar la causa del riesgo (cambiar plan)',
    mitigar: 'Reducir probabilidad o impacto (acciones preventivas)',
    transferir: 'Traspasar a tercero (seguros, contratos)',
    aceptar: 'Reconocer riesgo y preparar plan contingencia',
  },
  matriz_probabilidad_impacto: {
    escalas: { probabilidad: '1-Raro, 2-Improbable, 3-Posible, 4-Probable, 5-Casi seguro', impacto: '1-Insignificante, 2-Menor, 3-Moderado, 4-Mayor, 5-Catastrófico' },
    umbrales: { bajo: '1-6 (aceptable)', medio: '8-12 (monitorear)', alto: '15-25 (acción urgente)' },
  },
  herramientas: ['Register riesgos', 'Risk breakdown structure (RBS)', 'Monte Carlo simulation', 'Análisis sensibilidad', 'Análisis causa raíz', 'Diagrama Ishikawa'],
}

// ─── Presupuestos típicos de construcción (€/m²) ───
const CONSTRUCTION_COSTS = {
  vivienda_social: { cost_m2: '600-900', total_tipico: '60-90K€', includes: ['Estructura', 'Cerramientos', 'Instalaciones básicas', 'Acabados estándar'] },
  vivienda_media: { cost_m2: '900-1400', total_tipico: '135-210K€', includes: ['Todo lo anterior + mejor acabados', 'Carpintería', 'Pintura'] },
  vivienda_lujo: { cost_m2: '1400-2500', total_tipico: '280-500K€', includes: ['Todo + acabados premium', 'Domótica', 'Piscina'] },
  local_comercial: { cost_m2: '800-1200', total_tipico: '80-120K€', includes: ['Estructura', 'Cerramientos', 'HVAC', 'Electricidad'] },
  oficina: { cost_m2: '1000-1600', total_tipico: '200-320K€', includes: ['Acondicionamiento', 'Cableado', 'Iluminación', 'Sistemas'] },
  nave_industrial: { cost_m2: '400-700', total_tipico: '120-210K€ (300m²)', includes: ['Estructura metálica', 'Paneles', 'Suelo hormigón', 'Puertas'] },
  obra_pública: { cost_m2: '150-400', total_tipico: 'Varía mucho', includes: ['Infraestructura vial', 'Drenaje', 'Señalización'] },
}

// ─── Desglose de costos por partida ───
const COST_BREAKDOWN = {
  estructura: { pct: '25-35%', items: ['Hormigón armado', 'Acero', 'Cimbrado', 'Excavación', 'Cimentación'] },
  cerramientos: { pct: '15-20%', items: ['Fachada', 'Cubierta', 'Carpintería exterior', 'Aislamiento'] },
  instalaciones: { pct: '20-30%', items: ['Eléctrica', 'Sanitaria', 'HVAC', 'Protección incendios', 'Telecomunicaciones'] },
  acabados: { pct: '15-25%', items: ['Pavimentos', 'Pintura', 'Azulejos', 'Carpintería interior', 'Mobiliario'] },
  exterior: { pct: '5-10%', items: ['Jardinería', 'Pavimentación exterior', 'Alambrado', 'Iluminación exterior'] },
  generales: { pct: '10-15%', items: ['Dirección obra', 'Estudios', 'Licencias', 'Seguros', 'Impuestos'] },
}

// ─── Gestión de proveedores ───
const SUPPLIER_CATEGORIES = {
  materiales: { suppliers: ['Hormigones preparados', 'Acero estructural', 'Ladrillos', 'Aislantes', 'Carpintería'], evaluation: ['Precio', 'Plazo entrega', 'Calidad', 'Garantía', 'Servicio postventa'] },
  maquinaria: { suppliers: ['Grúas', 'Excavadoras', 'Hormigoneras', 'Andamios', 'Herramienta'], evaluation: ['Disponibilidad', 'Mantenimiento', 'Seguro', 'Experiencia operador'] },
  subcontratas: { suppliers: ['Electricistas', 'Fontaneros', 'Yesistas', 'Pintores', 'Instaladores HVAC'], evaluation: ['Cualificación', 'Experiencia', 'Seguro RC', 'Certificaciones', 'Referencias'] },
  servicios: { suppliers: ['Topógrafos', 'Laboratorio control', 'Ensayos no destructivos', 'Peritos'], evaluation: ['Acreditación', 'Plazo resultados', 'Coste'] },
}

// ─── Planificación de proyecto tipo ───
function planProject(type, area_m2) {
  const plans = {
    vivienda: {
      duracion_meses: Math.max(8, Math.round(area_m2 / 50)),
      fases: [
        { name: 'Proyecto y licencias', duracion_meses: 2, cost_pct: 8 },
        { name: 'Cimentación', duracion_meses: 1, cost_pct: 12 },
        { name: 'Estructura', duracion_meses: 2, cost_pct: 25 },
        { name: 'Cerramientos', duracion_meses: 1, cost_pct: 15 },
        { name: 'Instalaciones', duracion_meses: 2, cost_pct: 22 },
        { name: 'Acabados', duracion_meses: 2, cost_pct: 18 },
      ],
    },
    local: {
      duracion_meses: Math.max(4, Math.round(area_m2 / 80)),
      fases: [
        { name: 'Proyecto y licencias', duracion_meses: 1, cost_pct: 6 },
        { name: 'Demolición/adaptación', duracion_meses: 0.5, cost_pct: 5 },
        { name: 'Estructura', duracion_meses: 1, cost_pct: 15 },
        { name: 'Instalaciones', duracion_meses: 1.5, cost_pct: 30 },
        { name: 'Acabados', duracion_meses: 1, cost_pct: 25 },
        { name: 'Mobiliario/equipamiento', duracion_meses: 0.5, cost_pct: 19 },
      ],
    },
    nave: {
      duracion_meses: Math.max(3, Math.round(area_m2 / 120)),
      fases: [
        { name: 'Proyecto y licencias', duracion_meses: 1, cost_pct: 5 },
        { name: 'Cimentación', duracion_meses: 0.5, cost_pct: 10 },
        { name: 'Estructura metálica', duracion_meses: 1, cost_pct: 30 },
        { name: 'Cerramientos', duracion_meses: 0.5, cost_pct: 20 },
        { name: 'Suelo y acabados', duracion_meses: 0.5, cost_pct: 15 },
        { name: 'Instalaciones', duracion_meses: 1, cost_pct: 20 },
      ],
    },
  }
  return plans[type] || plans.vivienda
}

// ─── Gestión de riesgos del proyecto ───
const PROJECT_RISKS = {
  retraso: { probability: 'Alta', impact: 'Alto', mitigation: ['Buffer temporal 10-20%', 'Multas por retraso', 'Planificación realista', 'Seguimiento semanal'] },
  sobrecoste: { probability: 'Media', impact: 'Alto', mitigation: ['Presupuesto con contingencia 15%', 'Control semanal de costos', 'Variaciones controladas', 'Comparativas de mercado'] },
  calidad: { probability: 'Media', impact: 'Medio', mitigation: ['Plan de calidad', 'Controles en obra', 'Ensayos periódicos', 'Recepción con listas de verificación'] },
  seguridad: { probability: 'Baja', impact: 'Muy Alto', mitigation: ['Plan de seguridad', 'EPP obligatorio', 'Formación trabajadores', 'Supervisor seguridad'] },
  proveedores: { probability: 'Media', impact: 'Medio', mitigation: ['Múltiples proveedores', 'Contratos con penalizaciones', 'Seguimiento entregas', 'Stock seguridad'] },
  clima: { probability: 'Variable', impact: 'Medio', mitigation: ['Plan climatológico', 'Cubiertas temporales', 'Secuenciación flexible', 'Seguro temporal'] },
}

// ─── Earned Value Management ───
const EARNED_VALUE = {
  formulas: {
    pv: 'Valor Planificado (PV) = Valor trabajos programados hasta fecha',
    ev: 'Valor Ganado (EV) = Valor trabajos completados',
    ac: 'Coste Real (AC) = Coste real incurrido',
    sv: 'Desviación Cronograma (SV) = EV - PV (positivo = adelantado)',
    cv: 'Desviación Coste (CV) = EV - AC (positivo = bajo presupuesto)',
    spi: 'Índice Cronograma (SPI) = EV / PV (>1 = adelantado)',
    cpi: 'Índice Coste (CPI) = EV / AC (>1 = bajo presupuesto)',
    eac: 'Estimación a Completar (EAC) = BAC / CPI',
    etc: 'Trabajo por Completar (ETC) = EAC - AC',
    vac: 'Desviación a Completar (VAC) = BAC - EAC',
  },
  interpretacion: {
    spi_cpi_ambos_gt_1: '🟢 Proyecto adelantado y bajo presupuesto',
    spi_gt_1_cpi_lt_1: '🟡 Adelantado pero sobrecoste',
    spi_lt_1_cpi_gt_1: '🟡 Retrasado pero bajo presupuesto',
    spi_cpi_ambos_lt_1: '🔴 Retrasado y sobrecoste — acción correctiva urgente',
  },
  thresholds: { spmin: 0.9, spmax: 1.1, cpmin: 0.9, cpmax: 1.1 },
}

// ─── Ruta Crítica (CPM) ───
const CRITICAL_PATH = {
  metodos: {
    forward_pass: 'Calcular ES/EF de inicio a fin. EF = ES + duración.',
    backward_pass: 'Calcular LS/LF de fin a inicio. LS = LF - duración.',
    float: 'Holgura (Float) = LS - ES o LF - EF. Float = 0 → ruta crítica.',
    critical: 'Ruta crítica = secuencia actividades con float = 0. Es la más larga.',
  },
  pasos: [
    '1. Identificar todas las actividades',
    '2. Establecer dependencias (FS, SS, FF, SF)',
    '3. Estimar duraciones',
    '4. Forward pass: Early Start (ES) y Early Finish (EF)',
    '5. Backward pass: Late Start (LS) y Late Finish (LF)',
    '6. Calcular holgura: Float = LS - ES',
    '7. Ruta crítica = actividades con Float = 0',
    '8. Calcular duración total = suma duraciones ruta crítica',
  ],
  herramientas: ['Microsoft Project', 'Primavera P6', 'GanttProject (gratis)', 'ProjectLibre (gratis)', 'Excel (manual)'],
}

// ─── Stakeholder Management ───
const STAKEHOLDER_MANAGEMENT = {
  clasificacion: {
    poder_alto_interes_alto: { accion: 'Gestionar de cerca. Decisión conjunta.', ejemplo: 'Director proyecto, cliente principal' },
    poder_alto_interes_bajo: { accion: 'Mantener satisfecho. Informar periódicamente.', ejemplo: 'Patrocinador, accionistas' },
    poder_bajo_interes_alto: { accion: 'Mantener informado. Usar como aliado.', ejemplo: 'Equipo técnico, usuarios finales' },
    poder_bajo_interes_bajo: { accion: 'Monitorizar. Esfuerzo mínimo.', ejemplo: 'Otros departamentos, proveedores secundarios' },
  },
  estrategias: ['Comunicación regular', 'Involucrar en decisiones clave', 'Gestionar expectativas', 'Resolver conflictos pronto', 'Celebrar hitos'],
}

// ─── Gestión de cambios ───
const CHANGE_MANAGEMENT = {
  tipos: {
    cambio_alcance: { desc: 'Adición, eliminación o modificación de alcance', proceso: ['Solicitud cambio', 'Análisis impacto (coste, tiempo, calidad)', 'Aprobación PM/steering', 'Actualización plan', 'Comunicación'] },
    cambio_diseño: { desc: 'Modificación al diseño existente', proceso: ['Identificar necesidad', 'Evaluar alternativas', 'Aprobar cambio', 'Implementar', 'Verificar'] },
    orden_cambio: { desc: 'Autorización formal de modificación', contenido: ['Descripción cambio', 'Justificación', 'Impacto coste/plazo', 'Aprobaciones', 'Fecha efectiva'] },
  },
  control_cambios: {
    comite: 'Comité de Control de Cambios (CCB)',
    registro: 'Log de cambios con estado, prioridad, impacto',
    umbrales: { menor: 'Sin impacto plazo/coste', mayor: 'Requiere aprobación PM', critico: 'Requiere aprobación dirección' },
  },
}

// ─── Cierre de proyecto ───
const PROJECT_CLOSURE = {
  pasos: {
    verificacion: ['Entregables completados y aceptados', 'Pruebas finales aprobadas', 'Documentación entregada', 'Formación realizada'],
    administrativo: ['Contratos cerrados y pagados', 'Personal reasignado', 'Recursos liberados', 'Archivos documentados'],
    lecciones_aprendidas: ['Reunión retrospectiva', 'Qué salió bien / qué mejorar', 'Base de conocimiento actualizada', 'Recomendaciones futuras'],
    recepcion: ['Acta de recepción cliente', 'Certificado final obra', 'Garantías documentadas', 'Plan mantenimiento'],
  },
  metricas_cierre: { satisfaccion_cliente: 'Encuesta CSAT/NPS', desviacion_coste: '(Real - Presupuesto) / Presupuesto', desviacion_plazo: '(Real - Planificado) / Planificado', lecciones: 'Nº mejoras documentadas' },
}

// ─── Comunicación de proyecto ───
const COMMUNICATION_PLAN = {
  audiencias: {
    direccion: { frecuencia: 'Mensual', formato: 'Dashboard + informe 1 página', contenido: ['Hitos alcanzados', 'Desviaciones', 'Riesgos clave', 'Próximos pasos'] },
    equipo: { frecuencia: 'Diaria (Scrum) / Semanal', formato: 'Reunión 15min / tablero visual', contenido: ['Estado tareas', 'Bloqueadores', 'Coordinación'] },
    cliente: { frecuencia: 'Quincenal', formato: 'Informe + demo', contenido: ['Progreso entregables', 'Cambios', 'Calidad'] },
    proveedores: { frecuencia: 'Según entregables', formato: 'Email + reunión', contenido: ['Pedidos', 'Plazos', 'Calidad'] },
  },
  herramientas: ['MS Project / Primavera', 'Jira / Trello / Asana', 'Confluence / SharePoint', 'Slack / Teams', 'Power BI / dashboards'],
}

// ─── Gestión de calidad avanzada ───
const QUALITY_ADVANCED = {
  herramientas: {
    Ishikawa: { nombre: 'Diagrama Ishikawa (espina de pescado)', causas: ['Mano de obra', 'Método', 'Material', 'Máquina', 'Medición', 'Medio ambiente'], uso: 'Análisis causa raíz de problemas' },
    pareto: { nombre: 'Principio de Pareto (80/20)', regla: '80% efectos vienen de 20% causas', uso: 'Priorizar problemas más importantes' },
    pdca: { nombre: 'Ciclo PDCA (Deming)', fases: ['Planificar', 'Hacer', 'Verificar', 'Actuar'], uso: 'Mejora continua de procesos' },
    six_sigma: { nombre: 'Six Sigma', objetivo: '≤3.4 defectos por millón', DMAIC: ['Definir', 'Medir', 'Analizar', 'Mejorar', 'Controlar'] },
    control_estadistico: { nombre: 'SPC (Control Estadístico de Procesos)', graficos: ['X̄-R (media-rango)', 'p (proporción defectos)', 'c (defectos por unidad)'], uso: 'Detectar variabilidad especial' },
  },
  inspeccion: {
    inspeccion_visual: 'Verificación visual de acabados, dimensiones',
    ensayos_no_destructivos: ['Ultrasonidos', 'Radiografía', 'Líquidos penetrantes', 'Magnetoscopia', 'Corrientes inducidas'],
    pruebas_funcionales: ['Prueba presión hidráulica', 'Prueba estanqueidad', 'Prueba carga', 'Prueba funcionamiento'],
  },
}

// ─── Lean Construction ───
const LEAN_CONSTRUCTION = {
  principios: [
    'Eliminar desperdicios (7 desperdicios lean)',
    'Flujo continuo de valor',
    'Pull planning (planificación tirada)',
    'Mejora continua (Kaizen)',
    'Respeto por las personas',
  ],
  desperdicios: [
    { tipo: 'Sobreproducción', ejemplo: 'Hacer más de lo que se pide' },
    { tipo: 'Espera', ejemplo: 'Operarios esperando materiales' },
    { tipo: 'Transporte', ejemplo: 'Mover materiales innecesariamente' },
    { tipo: 'Sobreprocesamiento', ejemplo: 'Trabajo no añade valor' },
    { tipo: 'Inventario', ejemplo: 'Stock excesivo en obra' },
    { tipo: 'Movimiento', ejemplo: 'Desplazamientos innecesarios operarios' },
    { tipo: 'Defectos', ejemplo: 'Retrabajos, desperdicio materiales' },
  ],
  herramientas: ['Last Planner System (LPS)', '5S en obra', 'Kanban materiales', 'Value Stream Mapping', 'A3 problem solving'],
}

// ─── Contratación y licitaciones ───
const PROCUREMENT = {
  tipos: {
    contrato_suministro: 'Compra materiales. Garantías de calidad y plazo.',
    contrato_servicios: 'Prestación de servicios. SLA definidos.',
    contrato_obra: 'Construcción. Pliego de condiciones técnicas.',
    contrato_mixto: 'Combinación suministro + obra.',
  },
  pliegos: {
    pliego_condiciones: 'Requisitos técnicos del proyecto',
    pliego_clausulas: 'Requisitos jurídicos y económicos',
    pliego_prescripciones: 'Normativa aplicable, estándares',
  },
  criterios_evaluacion: ['Precio (40-60%)', 'Experiencia (20-30%)', 'Propuesta técnica (20-40%)', 'Plazo de entrega (5-15%)', 'Sostenibilidad (5-10%)'],
  garantias: { buen_fin: '5-10% del contrato. Devolución final.', fiel_cumplimiento: '5-10% del contrato. Garantiza ejecución.', anticipo: '20-30% del anticipo solicitado.' },
}

// ─── Control de calidad ───
const QUALITY_CONTROL = {
  normas: { iso9001: 'Gestión de calidad. requisitos del cliente, mejora continua.', iso14001: 'Gestión medioambiental.', iso45001: 'Seguridad y salud laboral.' },
  inspecciones: ['Recepción materiales', 'Control dimensional', 'Ensayos no destructivos (END)', 'Pruebas funcionales', 'Inspección visual', 'Documentación'],
  plan_calidad: { contenido: ['Objetivos calidad', 'Responsabilidades', 'Procedimientos inspección', 'Criterios aceptación', 'Acciones correctivas', 'Registro no conformidades'] },
  end: { ultrasonidos: 'Detectar grietas internas', radiografia: 'Soldaduras, defectos internos', liquidos_penetrantes: 'Defectos superficiales', magnetoscopia: 'Defectos superficiales/acero', corrientes_inducidas: 'Tubos, conductores' },
}

class ProjectCoordinatorAgent {
  constructor(gatewayUrl) {
    this.gatewayUrl = gatewayUrl
    this.name = AGENT_NAME
    this.capabilities = CAPABILITIES
    this.id = null
    this.token = null
    this.ws = null
    this.registrationCheckInterval = null
    this.reconnectTimer = null
    this.reconnectDelay = 3000
  }

  request(method, path, body = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.gatewayUrl)
      const client = url.protocol === 'https:' ? https : http
      const options = {
        hostname: url.hostname, port: url.port, path: url.pathname + url.search, method,
        headers: { 'Content-Type': 'application/json', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) },
      }
      const req = client.request(options, (res) => {
        let data = ''
        res.on('data', chunk => data += chunk)
        res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(data) }) } catch { resolve({ status: res.statusCode, data: null }) } })
      })
      req.on('error', reject)
      if (body) req.write(JSON.stringify(body))
      req.end()
    })
  }

  // ─── Motor de análisis de proyecto ───
  async analyzeTask(task) {
    const desc = (task.description || '').toLowerCase()
    const title = (task.title || '').toLowerCase()
    const full = `${title} ${desc}`

    const result = { project_plan: null, budget: null, risks: [], schedule: [], methodology: null, suppliers: [], reports: [], recommendations: [] }

    // Detectar tipo de proyecto
    let projectType = 'vivienda'
    if (/local|comercial|tienda|oficina/.test(full)) projectType = 'local'
    if (/nave|industrial|polígono|almacén/.test(full)) projectType = 'nave'

    // Detectar área
    const areaMatch = full.match(/(\d+(?:\.\d+)?)\s*(?:m2|m²|metros?\s*cuadrados?)/)
    const area = areaMatch ? parseFloat(areaMatch[1]) : 100

    // Planificar si se menciona proyecto/obra
    if (/proyecto|obra|constru|edific|ampliación|reform/.test(full)) {
      result.project_plan = planProject(projectType, area)
      result.project_plan.type = projectType
      result.project_plan.area_m2 = area

      // Presupuesto
      const costs = CONSTRUCTION_COSTS[projectType === 'local' ? 'local_comercial' : projectType === 'nave' ? 'nave_industrial' : 'vivienda_media']
      result.budget = {
        cost_per_m2: costs.cost_m2,
        total_estimate: costs.total_tipico,
        breakdown: COST_BREAKDOWN,
        includes: costs.includes,
        area_m2: area,
      }

      // Riesgos
      result.risks = Object.entries(PROJECT_RISKS).map(([key, risk]) => ({ risk: key, ...risk }))

      // Proveedores
      result.suppliers = Object.entries(SUPPLIER_CATEGORIES).map(([key, cat]) => ({ category: key, ...cat }))
    }

    // Detectar metodología
    for (const [key, method] of Object.entries(METHODOLOGIES)) {
      if (full.includes(key) || full.includes(method.name.toLowerCase())) {
        result.methodology = method
      }
    }

    // Detectar presupuesto/costos
    if (/presupuesto|costo|coste|precio|invert/.test(full)) {
      if (!result.budget) {
        result.budget = { note: 'Para un presupuesto detallado, proporcione: tipo de proyecto, área (m²), ubicación, nivel de acabados', breakdown: COST_BREAKDOWN }
      }
    }

    // Detectar cronograma
    if (/cronograma|plazo|tiempo|cuándo|cuando|fecha|deadlin/.test(full)) {
      if (!result.project_plan) {
        result.schedule = [{ note: 'Para un cronograma detallado, indique tipo de proyecto y superficie' }]
      }
    }

    // Detectar calidad
    if (/calidad|inspección|control|ensayo|recepción/.test(full)) {
      result.recommendations.push('Plan de calidad: especificaciones técnicas, puntos de control, ensayos periódicos, listas de verificación por fase')
      result.recommendations.push('Normas aplicables: ISO 9001 (gestión), ISO 14001 (medio ambiente), OHSAS 18001 (seguridad)')
    }

    // Detectar proveedores
    if (/proveedor|subcontrat|suministr|licitación/.test(full)) {
      result.suppliers = Object.entries(SUPPLIER_CATEGORIES).map(([key, cat]) => ({ category: key, ...cat }))
    }

    // Respuesta general
    if (!result.project_plan && !result.methodology && result.risks.length === 0) {
      result.recommendations.push(`Gestión de proyecto: "${task.description}". Para ayudarte mejor, indique:\n- Tipo de proyecto (vivienda, local, nave, obra pública)\n- Superficie en m²\n- Fase actual (proyecto, obra, acabados)\n- Presupuesto estimado\n- Normativa aplicable`)
    }

    return result
  }

  // ─── Generar reporte ───
  generateReport(analysis, taskTitle) {
    const lines = [
      `═══ REPORTE DE PROYECTO: ${taskTitle} ═══`,
      `Fecha: ${new Date().toLocaleDateString('es-ES')}`,
      '',
    ]

    if (analysis.project_plan) {
      const plan = analysis.project_plan
      lines.push(`TIPO: ${plan.type?.toUpperCase()} | ÁREA: ${plan.area_m2} m²`)
      lines.push(`DURACIÓN ESTIMADA: ${plan.duracion_meses} meses`)
      lines.push('CRONOGRAMA:')
      for (const fase of plan.fases) {
        lines.push(`  • ${fase.name}: ${fase.duracion_meses} meses (${fase.cost_pct}%)`)
      }
      lines.push('')
    }

    if (analysis.budget) {
      lines.push('PRESUPUESTO:')
      lines.push(`  Coste/m²: ${analysis.budget.cost_per_m2} €`)
      lines.push(`  Total estimado: ${analysis.budget.total_estimate}`)
      lines.push('  Desglose por partida:')
      for (const [key, val] of Object.entries(analysis.budget.breakdown || {})) {
        lines.push(`    ${key}: ${val.pct}`)
      }
      lines.push('')
    }

    if (analysis.risks.length > 0) {
      lines.push('RIESGOS DEL PROYECTO:')
      for (const risk of analysis.risks) {
        lines.push(`  ⚠ ${risk.risk}: Prob=${risk.probability} Impacto=${risk.impact}`)
      }
      lines.push('')
    }

    return lines.join('\n')
  }

  // ─── WebSocket lifecycle ───
  async register() {
    console.log(`[${this.name}] Registrando...`)
    const { status, data } = await this.request('POST', '/agents/register', {
      name: this.name,
      description: 'Coordinador de proyectos de construcción e ingeniería. Planificación, presupuestos, cronogramas (PERT/CPM), gestión de proveedores, control de calidad, gestión de riesgos, reportes técnicos. Metodologías: Waterfall, Agile, PRINCE2, Lean Construction.',
      version: '1.0.0',
      capabilities: this.capabilities,
      endpoint: 'ws://localhost',
      connection_type: 'websocket',
      owner: 'getaway-agentes',
      is_external: true,
      max_concurrent_tasks: 5,
    })
    if (status !== 200) throw new Error(`Registro falló: ${data?.error}`)
    this.id = data.agent_id

    // If already approved and has token, use it
    if (data.token && data.status === 'idle') {
      this.token = data.token
      console.log(`[${this.name}] Ya aprobado, usando token existente`)
      return
    }

    console.log(`[${this.name}] Registrado: ${this.id} - Esperando aprobación...`)
    await this.waitForApproval()
  }

  async waitForApproval() {
    return new Promise((resolve) => {
      // Backoff progresivo: un agente puede tardar días en ser aprobado, y
      // sondear cada 5 s indefinidamente suponía ~17.000 peticiones al gateway
      // por agente y día. Empezamos en 5 s y crecemos hasta un techo de 5 min.
      let delay = 5000
      const check = async () => {
        try {
          const { status, data } = await this.request('GET', `/agents/${this.id}`)
          if (status === 200 && data.token) {
            this.token = data.token
            console.log(`[${this.name}] ¡Aprobado!`)
            resolve()
            return
          }
        } catch {}
        delay = Math.min(delay * 2, 300000)
        this.registrationCheckInterval = setTimeout(check, delay)
      }
      this.registrationCheckInterval = setTimeout(check, delay)
    })
  }

  connect() {
    return new Promise((resolve, reject) => {
      const wsUrl = this.gatewayUrl.replace(/^http/, 'ws') + `/ws?role=agent&token=${encodeURIComponent(this.token)}`
      this.ws = new WebSocket(wsUrl)
      this.ws.on('open', () => { this.reconnectDelay = 3000; console.log(`[${this.name}] Conectado`); resolve() })
      this.ws.on('message', (d) => { try { this.handleMessage(JSON.parse(d)) } catch {} })
      this.ws.on('close', (code) => {
        // 4000 = el gateway está en modo mantenimiento (kill switch). No tiene
        // sentido escalar el backoff: esperamos fijo 5 min hasta que reactiven.
        if (code === 4000) {
          console.log(`[${this.name}] Gateway en mantenimiento. Reintentando en 5min...`)
          this.reconnectTimer = setTimeout(() => this.connect().catch(console.error), 300000)
          return
        }
        // Backoff con techo: si el gateway está caído o el token ya no vale,
        // reintentar cada 3 s eternamente satura el worker sin llegar a conectar.
        const wait = this.reconnectDelay || 3000
        this.reconnectDelay = Math.min(wait * 2, 300000)
        console.log(`[${this.name}] Desconectado. Reconectando en ${Math.round(wait / 1000)}s...`)
        this.reconnectTimer = setTimeout(() => this.connect().catch(console.error), wait)
      })
      this.ws.on('error', reject)
    })
  }

  handleMessage(msg) {
    switch (msg.type) {
      case 'heartbeat': this.send({ type: 'heartbeat_ack' }); break
      case 'shutdown': console.log(`[${this.name}] El gateway entra en mantenimiento, desconectando...`); break
      case 'task_assigned': this.processTask(msg); break
      case 'subtask_assigned': this.processSubtask(msg); break
      case 'agent_message': this.handleChatMessage(msg); break
      case 'knowledge_query': this.handleKnowledgeQuery(msg); break
      case 'learning_task': this.handleLearningTask(msg); break
      default: break
    }
  }

  async processTask(task) {
    console.log(`[${this.name}] Tarea: ${task.title}`)
    this.send({ type: 'task_status_update', task_id: task.task_id, status: 'in_progress' })

    const analysis = await this.analyzeTask(task)
    const report = this.generateReport(analysis, task.title)

    const result = {
      status: 'completed',
      agent: this.name,
      capabilities_used: ['project_planning', 'budget_management', 'risk_assessment'],
      project_management: analysis,
      report,
      timestamp: new Date().toISOString(),
    }

    this.send({ type: 'task_result', task_id: task.task_id, result })
    this.send({
      type: 'knowledge_add',
      data: {
        title: `Gestión proyecto: ${task.title}`,
        content: JSON.stringify(analysis),
        category: 'project_management',
        tags: ['planning', 'budget', 'scheduling', 'construction'],
        source_agent_id: this.id,
        source_agent_name: this.name,
        source_task_id: task.task_id,
        visibility: 'public',
      },
    })
    console.log(`[${this.name}] Completado: ${task.task_id}`)
  }

  async processSubtask(subtask) {
    console.log(`[${this.name}] Subtarea: ${subtask.description?.slice(0, 80)}`)
    this.send({ type: 'task_status_update', task_id: subtask.task_id, status: 'in_progress' })

    const analysis = await this.analyzeTask({ title: subtask.title, description: subtask.description })
    const report = this.generateReport(analysis, subtask.title)

    const result = {
      status: 'completed',
      agent: this.name,
      capabilities_used: ['project_planning', 'budget_management'],
      project_management: analysis,
      report,
      timestamp: new Date().toISOString(),
    }

    this.send({ type: 'subtask_result', task_id: subtask.task_id, subtask_id: subtask.subtask_id, result })
    this.send({
      type: 'knowledge_add',
      data: {
        title: `Planificación: ${subtask.title}`,
        content: JSON.stringify(analysis),
        category: 'project_management',
        tags: ['planning', 'budget'],
        source_agent_id: this.id,
        source_agent_name: this.name,
        source_task_id: subtask.task_id,
        visibility: 'public',
      },
    })
    console.log(`[${this.name}] Subtarea completada: ${subtask.subtask_id}`)
  }

  handleChatMessage(msg) {
    console.log(`[${this.name}] Chat de ${msg.from_name}: ${msg.content}`)
    const response = this.generateChatResponse(msg.content)
    if (response) {
      this.send({
        type: 'chat_response',
        agent_id: this.id,
        agent_name: this.name,
        content: response,
        channel: msg.channel || 'general',
        reply_to: msg.from,
      })
    }
  }

  generateChatResponse(message) {
    const lower = message.toLowerCase()
    if (lower.includes('pmi') || lower.includes('pmbok') || lower.includes('gestión de proyecto')) {
      return '📋 PMI/PMBOK 7ª edición: 14 áreas de conocimiento. Enfoque por dominios: Personas, Proceso, Entorno de negocio, Ciclo de vida. Principios: entregables, planificación, trabajo del proyecto, conocimiento, equipo, comunicaciones, alcance, cronograma, costes, calidad, recursos, adquisiciones, riesgos, stakeholders.'
    }
    if (lower.includes('agile') || lower.includes('scrum') || lower.includes('kanban')) {
      return '🔄 Scrum: Roles (PO, SM, Dev Team), Ceremonias (Sprint Planning, Daily, Review, Retro), Artefactos (Backlog, Sprint Backlog, Increment). Sprint 1-4 semanas. Kanban: visualizar flujo, limitar WIP (3-5), medir y gestionar. ¿Qué metodología implementas?'
    }
    if (lower.includes('licitación') || lower.includes('contratación pública') || lower.includes('pliego')) {
      return '🏛️ Contratación pública España (Ley 9/2017): Umbrales obras 5.382.000€, servicios 215.000€. Criterios evaluación: precio 40-60%, experiencia 15-25%, propuesta técnica 20-40%. Pliegos: condiciones técnicas + cláusulas jurídicas.'
    }
    if (lower.includes('bim') || lower.includes('modelado')) {
      return '🏗️ BIM: Nivel 0=2D, 1=3D separado, 2=modelos federados, 3=modelo integrado. Beneficios: detección clash, cuantificación auto, planificación 4D, costes 5D, sostenibilidad 6D, FM 7D. Software: Revit, ArchiCAD, Navisworks. ¿En qué nivel estás?'
    }
    if (lower.includes('esg') || lower.includes('sostenibilidad') || lower.includes('certificación verde')) {
      return '🌱 ESG: Environmental (CO2, energía, residuos), Social (diversidad, seguridad, comunidad), Governance (ética, transparencia). Certificaciones: LEED (4 niveles), BREEAM, Passivhaus (<15 kWh/m²a). CSRD obligatoria para >250 empleados UE.'
    }
    if (lower.includes('métrica') || lower.includes('indicador') || lower.includes('kpi') || lower.includes('earned value')) {
      return '📊 Earned Value: SPI = EV/PV (>1=adelantado), CPI = EV/AC (>1=bajo presupuesto). Calidad: defect density, first pass yield >95%, CSAT/NPS. Tiempo: lead time, cycle time, velocity por sprint. Costes: CV=EV-AC, SV=EV-PV.'
    }
    if (lower.includes('riesgo') || lower.includes('riesgos')) {
      return '⚠️ Gestión riesgos: 4 respuestas = Evitar, Mitigar, Transferir, Aceptar. Matriz probabilidad×impacto (1-25). Categorías: estratégicos, operacionales, financieros, legales, reputacionales. Herramientas: register, RBS, Monte Carlo, Ishikawa.'
    }
    if (lower.includes('calidad') || lower.includes('control de calidad') || lower.includes('iso')) {
      return '✅ Calidad: ISO 9001 (gestión), ISO 14001 (medio ambiente), ISO 45001 (seguridad). Herramientas: Ishikawa (causa raíz), Pareto (80/20), PDCA, Six Sigma (≤3.4 defectos/PPM), SPC. Inspección: visual, END, pruebas funcionales.'
    }
    return null
  }

  handleLearningTask(msg) {
    console.log(`[${this.name}] Learning task received: ${msg.task_type}`)
    const result = this.generateLearningResult(msg.task_type)
    this.send({
      type: 'learning_result',
      task_id: msg.task_id,
      agent_id: this.id,
      agent_name: this.name,
      task_type: msg.task_type,
      result,
      timestamp: new Date().toISOString(),
    })
    if (Math.random() < 0.3) {
      const proposal = this.generateImprovementProposal()
      this.send({
        type: 'improvement_proposal',
        agent_id: this.id,
        agent_name: this.name,
        proposal,
        timestamp: new Date().toISOString(),
      })
    }
  }

  generateLearningResult(taskType) {
    switch (taskType) {
      case 'knowledge_share':
        return {
          topics_shared: ['PMI Talent Triangle development paths', 'Agile scaling frameworks (SAFe, LeSS)', 'Earned Value Management advanced techniques', 'Remote-first project governance'],
          entries_created: 4,
          details: 'Shared PMI Talent Triangle skill development guidelines, SAFe 6.0 program increment planning procedures, EVM TCPI (To-Complete Performance Index) analysis methods, and distributed team async ceremony best practices.',
          domain: 'project_management',
        }
      case 'knowledge_query':
        return {
          findings: [
            'Located research on AI-augmented project scheduling and risk prediction',
            'Retrieved comparative study of Agile vs Waterfall success rates by industry sector',
            'Found best practices for hybrid team coordination across time zones',
            'Discovered project portfolio management metrics for multi-project environments',
          ],
          sources: 4,
          domain: 'project_management',
        }
      case 'self_improve':
        return {
          suggestions: [
            'Add construction-specific Lean Last Planner System (LPS) scheduling capabilities',
            'Include resource leveling algorithms for multi-constraint optimization',
            'Integrate stakeholder sentiment analysis from project communications',
            'Extend risk register with quantitative Monte Carlo simulation outputs',
          ],
          current_capability_score: 0.83,
          target_capability_score: 0.92,
          domain: 'project_management',
        }
      case 'capability_explore':
        return {
          new_areas: ['AI project management assistants', 'Digital twin for project simulation', 'Outcome-driven delivery (OKR integration)', 'Construction robotics coordination'],
          relevance: 'high',
          domain: 'project_management',
        }
      case 'system_analysis':
        return {
          health_assessment: 'Strong traditional PM knowledge. Needs expansion in modern Agile-at-scale practices, remote team management, and AI-augmented project controls.',
          coverage_score: 0.80,
          improvement_areas: ['Virtual reality site inspections', 'Blockchain for supply chain transparency', 'Autonomous project scheduling', 'Climate risk in project planning'],
          domain: 'project_management',
        }
      default:
        return { message: `Unknown learning task type: ${taskType}` }
    }
  }

  generateImprovementProposal() {
    const proposals = [
      { type: 'feature', title: 'AI-Powered Risk Prediction Engine', description: 'Implement machine learning models trained on historical project data to predict schedule delays, cost overruns, and quality issues before they occur, enabling proactive mitigation.', priority: 'high' },
      { type: 'new_agent', title: 'Remote Team Coordination Agent', description: 'Deploy a specialized agent for distributed project teams, covering async standup coordination, timezone-aware scheduling, virtual collaboration facilitation, and team morale monitoring.', priority: 'medium' },
      { type: 'optimization', title: 'Automated Earned Value Reporting', description: 'Build real-time EVM dashboards that auto-calculate SPI, CPI, EAC, and TCPI from task completion data, with trend analysis and early warning alerts for deviation thresholds.', priority: 'high' },
      { type: 'knowledge_gap', title: 'Construction Digital Twin Knowledge Base', description: 'Create comprehensive entries on digital twin implementation for construction projects, covering BIM-to-twin workflows, real-time sensor integration, and predictive maintenance scheduling.', priority: 'medium' },
    ]
    return proposals[Math.floor(Math.random() * proposals.length)]
  }

  send(msg) { if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg)) }

  async run() {
    try { await this.register(); await this.connect(); console.log(`[${this.name}] ¡Listo! Presiona Ctrl+C para salir`) }
    catch (err) { console.error(`[${this.name}] Fatal:`, err.message); process.exit(1) }
  }
}

const agent = new ProjectCoordinatorAgent(GATEWAY_URL)
agent.run()
process.on('SIGINT', () => {
  console.log(`\n[${AGENT_NAME}] Desconectando...`)
  if (agent.registrationCheckInterval) clearTimeout(agent.registrationCheckInterval); if (agent.reconnectTimer) clearTimeout(agent.reconnectTimer)
  if (agent.ws) agent.ws.close()
  process.exit(0)
})
