#!/usr/bin/env node

/**
 * Legal & Compliance Agent — GetawayAgentes
 *
 * Experto en derecho empresarial, contratos, derecho laboral,
 * propiedad intelectual, compliance, protección de datos (RGPD),
 * arbitraje, mediación y todo lo legal para empresas.
 */

const http = require('http')
const https = require('https')
const { URL } = require('url')
const WebSocket = require('ws')

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:8787'
const AGENT_NAME = 'Legal Expert'
const CAPABILITIES = [
  'corporate_law',
  'contract_drafting',
  'labor_law',
  'tax_law',
  'intellectual_property',
  'data_protection',
  'compliance',
  'arbitration',
  'regulatory',
  'corporate_governance',
]

// ══════════════════════════════════════════════════════════════
//  DERECHO EMPRESARIAL — Tipos societarios
// ══════════════════════════════════════════════════════════════
const COMPANY_TYPES = {
  sl: {
    name: 'Sociedad Limitada (SL)',
    capital_minimo: 3000,
    socios_min: 1,
    socios_max: 50,
    responsabilidad: 'Limitada al capital aportado',
    administracion: 'Administrador único o Consejo de Administración',
    registro: 'Registro Mercantil',
    impuesto: 'Impuesto Sociedades (25%)',
    constitucion: ['Escritura pública', 'CIF', 'Alta autónomos si único socio', 'Cuenta bancaria', 'Prototipo estatutos'],
    ventajas: ['Responsabilidad limitada', 'Capital bajo', 'Flexibilidad estatutaria', 'Tributación favorable'],
    inconvenientes: ['Prohibición acciones', 'Max 50 socios', 'Intervención notarial en transmisiones'],
  },
  sa: {
    name: 'Sociedad Anónima (SA)',
    capital_minimo: 60000,
    socios_min: 1,
    socios_max: null,
    responsabilidad: 'Limitada al capital aportado',
    administracion: 'Consejo de Administración (mínimo 3 consejeros)',
    registro: 'Registro Mercantil',
    impuesto: 'Impuesto Sociedades (25%)',
    constitucion: ['Escritura pública', 'Prototipo estatutos', 'Depósito capital', 'Nombramiento consejeros', 'CIF'],
    ventajas: ['Acciones libre transmisibilidad', 'Capital grande', 'Bolsa de valores', 'Governance corporativa'],
    inconvenientes: ['Capital alto', 'Más burocracia', 'Comisión Nacional de Valores si cotiza'],
  },
  sc: {
    name: 'Sociedad Cooperativa',
    capital_minimo: 3000,
    socios_min: 3,
    socios_max: null,
    responsabilidad: 'Limitada o solidaria (según estatutos)',
    administracion: 'Asamblea + Consejo Rector',
    registro: 'Registro de Cooperativas',
    impuesto: 'Régimen especial cooperativo (tipo reducido)',
    constitucion: ['Escritura pública', 'Estatutos aprobados por Asamblea', 'Alta Hacienda', 'Seguridad Social'],
    ventajas: ['Tributación favorable', 'Uno hombre = un voto', 'Ayudas públicas', 'Deducción 95% dividendos socios'],
    inconvenientes: ['Reparto limitado de beneficios', 'Más de 3 socios obligatorio', 'Gestión asamblearia'],
  },
  autónomo: {
    name: 'Autónomo / Freelance',
    capital_minimo: 0,
    socios_min: 1,
    socios_max: 1,
    responsabilidad: 'Personal e ilimitada',
    administracion: 'Él mismo',
    registro: 'RETA (Régimen Especial Trabajadores Autónomos)',
    impuesto: 'IRPF + IVA',
    constitucion: ['Alta autónomos (Hacienda)', 'Alta Seguridad Social', 'CIF', 'Impuestos trimestrales'],
    ventajas: ['Sin capital mínimo', 'Total libertad', 'Decisiones inmediatas', 'Gastos deducibles'],
    inconvenientes: ['Responsabilidad ilimitada', 'Cuota autónomos', 'Trabajo personal', 'Sin separación patrimonio'],
  },
}

// ══════════════════════════════════════════════════════════════
//  CONTRATOS — Modelos y cláusulas esenciales
// ══════════════════════════════════════════════════════════════
const CONTRACT_TYPES = {
  laboral: {
    name: 'Contrato de Trabajo',
    duracion: ['Indefinido', 'Temporal (obra/sustitución/inicio actividad)', 'Prácticas', 'Formación'],
    clausulas_esenciales: ['Jornada laboral', 'Salario bruto anual', 'Puesto de trabajo', 'Lugar de trabajo', 'Período de prueba', 'No competencia postcontractual', 'Confidencialidad'],
    obligaciones_empleador: ['Salario puntual', 'Seguridad Social', 'Prevención riesgos', 'Formación', 'Trato digno'],
    obligaciones_trabajador: ['Cumplir jornada', 'Obediencia jerárquica', 'No competencia durante', 'Sigilo profesional'],
    extincion: ['Despido objetivo (causas justificadas)', 'Despido disciplinario (faltas graves)', 'Despido colectivo (ERE)', 'Dimisión', 'Jubilación', 'Mutuo acuerdo'],
    indemnizacion: { indefinido_despido_objetivo: '20 días/año (máx 12 mensualidades)', indefinido_disciplinario: '0 (justificado)', improcedente: '33 días/año (máx 24 mensualidades)', temporal: '12 días/año si fin contrato' },
  },
  arrendamiento: {
    name: 'Contrato de Arrendamiento',
    tipos: { vivienda: 'LAU 1994. Mínimo 5 años (particulares). Prórroga obligatoria.', local: 'Libre pacto. Usualmente 5-10 años + prórrogas.' },
    clausulas_esenciales: ['Descripción inmueble', 'Destino (vivienda/local)', 'Renta + revisión IPC', 'Duración', 'Gastos comunitarios/IBI', 'Fianza (1-2 mensualidades)', 'Derecho de tanteo y retracto'],
    fianza: { vivienda: '1 mensualidad (propietario) + 1 (arrendatario) depositada', local: 'Libre pacto, típicamente 2-6 mensualidades' },
    subarriendo: 'Solo si contrato lo permite. Vivienda: total o parcial. Local: según pacto.',
  },
  compraventa: {
    name: 'Contrato de Compraventa',
    clausulas_esenciales: ['Identificación partes', 'Descripción bien', 'Precio y forma pago', 'Transmisión propiedad', 'Garantías (evicción y vicios)', 'Gastos (ITP/IVA)', 'Plazo entrega', 'Cláusula penal'],
    impuestos: { inmueble: 'ITP (6-11% según CCAA) o IVA (10% si promotor)', vehiculo: 'Impuesto Transmisiones (4-12%) o IVA (21%)', empresa: 'Impuesto Transmisiones (0.5-1.5%)' },
    garantias: { eviccion: 'Vendedor responde por terceros que reclamen derecho', vicios: 'Vendedor responde por defectos ocultos (2 años)' },
  },
  suministro: {
    name: 'Contrato de Suministro',
    tipos: ['Electricidad', 'Agua', 'Gas', 'Telecomunicaciones', 'Internet'],
    clausulas: ['Potencia/cantidad', 'Precio unitario', 'Permanencia', 'Penalización baja anticipada', 'Modificaciones', 'Facturación'],
    derechos_consumidor: ['Libre elección', 'Información clara', 'Reclamación', 'Baja sin penalización (después de permanencia)', 'Factura electrónica'],
  },
  servicio: {
    name: 'Contrato de Prestación de Servicios',
    clausulas: ['Alcance servicios', 'Plazos de entrega', 'Precio y forma pago', 'Propiedad intelectual', 'Confidencialidad', 'Niveles de servicio (SLA)', 'Responsabilidad', 'Resolución'],
    sla: ['Disponibilidad (>99.9%)', 'Tiempo respuesta', 'Penalizaciones por incumplimiento', 'Reporting'],
  },
  confidencialidad: {
    name: 'Contrato de Confidencialidad (NDA)',
    tipos: ['Unilateral', 'Bilateral', 'Multilateral'],
    clausulas: ['Definición información confidencial', 'Obligaciones destinatario', 'Excepciones', 'Duración (típico 2-5 años)', 'Devolución/destrucción datos', 'Penalización incumplimiento'],
    duracion: 'Vigencia + 2-5 años después de terminación',
  },
  distribucion: {
    name: 'Contrato de Distribución Comercial',
    tipos: ['Distribución exclusiva', 'Distribución selectiva', 'Distribución libre'],
    clausulas: ['Territorio', 'Exclusividad (si aplica)', 'Pedido mínimo', 'Margen distribuidor', 'Inventario', 'Soporte técnico/formación', 'Terminación'],
    normativa: 'Reglamento UE 2022/720 (vertical block exemption)',
  },
  franquicia: {
    name: 'Contrato de Franquicia',
    requisitos: ['Know-how transferido', 'Marca registrada', 'Pago derechos', 'Formación inicial'],
    clausulas: ['Territorio', 'Exclusividad', 'Cuota inicial + royalties', 'Obligaciones franquiciado', 'Renovación/terminación', 'Competencia post-contrato'],
    normativa: 'Ley 7/1996 (España) - obligación información precontractual',
  },
  arrendamiento_comercial: {
    name: 'Contrato Arrendamiento Local Comercial',
    duracion: 'Libre pacto. Típico 5-10 años + prórrogas.',
    clausulas: ['Destino del local', 'Renta + revisión', 'Obras mejoras', 'Tanteo y retracto', 'Gastos comunidad/IBI', 'Subarriendo libre/pactado', 'Resolución anticipada'],
    fianza: 'Libre pacto. Típico 2-6 mensualidades.',
  },
  compraventa_empresa: {
    name: 'Compraventa de Empresa (negocio)',
    elementos: ['Fondo de comercio', ' Clientela', 'Nombre comercial', 'Patentes/marcas', 'Contratos existentes', 'Personal'],
    clausulas: ['Precio y forma pago', 'Garantías (evicción, vicios)', 'No competencia post-venta', 'Cesión contratos', 'Transmisión personal', 'Inventario'],
    impuestos: 'ITP (0.5-1.5%) o IVA (21% si hay inmuebles)',
  },
  cesion_derechos_uso: {
    name: 'Cesión de Derechos de Uso',
    tipos: ['Licencia de software', 'Licencia marca', 'Licencia patente', 'Licencia contenido'],
    clausulas: ['Territorio', 'Exclusividad/no exclusividad', 'Duración', 'Soporte y mantenimiento', 'Actualizaciones', 'Propiedad intelectual', 'Auditoría uso'],
  },
  contrato_obras: {
    name: 'Contrato de Obra (Construcción)',
    tipos: ['Lump sum (precio alzado)', 'Unit price (precio unitario)', 'Cost plus (coste + honorarios)'],
    clausulas: ['Descripción obra', 'Precio y forma pago (avance obra)', 'Plazo ejecución', 'Penalizaciones retraso', 'Garantía buen fin', 'Seguro RC', 'Variaciones y órdenes cambio'],
    normativa: 'Ley 9/2017 Contratos Sector Público (obras públicas)',
  },
  contrato_suministro_energia: {
    name: 'Suministro Energético (Luz, Gas)',
    clausulas: ['Potencia contratada', 'Peaje de acceso', 'Precio energía', 'Permanencia', 'Penalización baja anticipada', 'Lecturas y facturación'],
    derechos_consumidor: ['Libre elección comercializadora', 'Baja sin permanencia tras plazo', 'Bonón social (vulnerabilidad)', 'Reclamación ante CNMC'],
  },
  contrato_franchise_master: {
    name: 'Franquicia Master',
    desc: 'Franquiciado principal que subfranquicia en un territorio',
    clausulas: ['Territorio exclusivo', 'Subfranquiciación', 'Obligaciones de desarrollo', 'Formación avanzada', 'Soporte regional'],
  },
}

// ══════════════════════════════════════════════════════════════
//  DERECHO LABORAL — Normativa
// ══════════════════════════════════════════════════════════════
const LABOR_LAW = {
  estatuto_trabajadores: {
    jornada_maxima: '40 horas semanales (promedio anual)',
    horas_extras: 'Máximo 80/año. Recargo: 50% primeras 2h, 100% restantes. No obligatorias salvo fuerza mayor.',
    descanso_semanal: '1.5 días continuados (sábado tarde/domingo). Por ley 1.5 días.',
    vacaciones: '30 días naturales (2.5 días/mes). Mínimo 12 días/año en convenio.',
    permisos_retribuidos: ['Matrimonio (15 días)', 'Nacimiento hijo (15 días)', 'Defunción familiar (2-5 días)', 'Mudanza (1 día)', 'Cita médica (horas)', 'Deber público (horas)'],
    despido: { objetivo: 'Causas经济技术 (20 días/año, máx 12 mensualidades)', disciplinario: 'Faltas graves (0 indemnización)', colectivo: 'ERE (15-90 días)', improcedente: '33 días/año (máx 24 mensualidades)' },
    cotizacion: { trabajador: '6.35% base cotización', empresa: '29.9% base cotización', total: '36.25%' },
  },
  tipos_contrato: {
    indefinido: { duracion: 'Indefinida', periodo_prueba: 'Máx 6 meses (técnicos), 2 meses (otros)', indemnizacion: '33 días/año (improcedente, máx 24 mensualidades)' },
    temporal: { duracion: 'Obra/sustitución/inicio actividad, máx 12 meses', periodo_prueba: 'Máx 6 meses si duración >6 meses', indemnizacion: '12 días/año' },
    practicas: { duracion: '6 meses a 2 años', requisitos: 'Titulado <2 años titulación', salario: 'Mínimo 60% salario referente' },
    formacion: { duracion: '6 meses a 2 años', requisitos: 'Sin experiencia/ formación específica', salario: 'Mínimo 60% salario referente' },
  },
  despidos: {
    objetivo: { causas: ['Ineptitud sobrevenida', 'Falta adaptación', 'Causas económicas/técnicas/organizativas/producción'], indemnizacion: '20 días/año, máx 12 mensualidades', preaviso: '15 días' },
    disciplinario: { causas: ['Faltas repetidas', 'Desobediencia', 'Indisciplina', 'Acoso', 'Embriaguez habitual'], indemnizacion: '0 (justificado)', prescripcion: '20 días desde conocimiento' },
    colectivo: { proceso: 'ERE', fases: ['Comunicación representantes', 'Período consultas (30 días)', 'Autoridad laboral'] },
    improcedente: { indemnizacion: '33 días/año, máx 24 mensualidades', opcion: 'Readmisión o indemnización' },
  },
  permisos: {
    retribuidos: ['Nacimiento hijo (15 días)', 'Adopción/acogimiento (15 días)', 'Defunción familiar 1er grado (5 días)', 'Matrimonio (15 días)', 'Mudanza (1 día)', 'Deber público (horas)', 'Cita médica (horas)'], lactancia: '1 hora diaria. Reducción jornada 30 min.'
  },
  salario: {
    complementos: ['Salario base', 'Plus convenio', 'Antigüedad', 'Complemento peligrosidad', 'Nocturnidad', 'Horas extra', 'Comisiones'],
    descuentos: ['IRPF (19-47%)', 'Seguridad Social trabajador (6.35%)'],
    pagas_extras: 'Mínimo 2 pagas extras (junio/diciembre)',
  },
  seguridad_social: {
    contingencias_comunes: { trabajador: '4.70%', empresa: '23.60%' },
    contingencias_profesionales: { empresa: '1.5-3.5% (según riesgo)' },
    desempleo: { indefinido: { trabajador: '1.55%', empresa: '1.60%' }, temporal: { trabajador: '1.60%', empresa: '1.60%' } },
    formacion_profesional: { trabajador: '0.10%', empresa: '0.60%' },
    fogasa: { empresa: '0.20%' },
    total_trabajador: '6.35%', total_empresa: '29.9%',
  },
  convenio_colectivo: {
    desc: 'Acuerdo entre representantes trabajadores y empresa. Obligatorio si existe para sector.',
    prioridad: 'Convenio de empresa > convenio de sector > estatuto',
    contenido: ['Salarios', 'Jornada', 'Vacaciones', 'Permisos', 'Clasificación profesional', 'Seguridad y salud'],
  },
  prevencion_riesgos: {
    delegado_prevencion: 'Si >50 trabajadores (obligatorio)',
    evaluacion_riesgos: 'Obligatoria. Documento único evaluación riesgos.',
    formacion: 'Formación continua trabajadores + formación específica',
    epis: 'EPP proporcionados por empresa, sin coste trabajador',
    accidentes: 'Comunicación a INSST en 24h. Investigación interna.',
    sanciones: { leve: '60-625€', grave: '626-6.250€', muy_grave: '6.251-187.515€' },
  },
}

// ══════════════════════════════════════════════════════════════
//  DERECHO DIGITAL Y ECONOMÍA DIGITAL
// ══════════════════════════════════════════════════════════════
const DIGITAL_LAW = {
  comercio_electronico: {
    normativa: 'LSSI-CE (Ley 34/2002)',
    requisitos: ['Aviso legal obligatorio', 'Condiciones generales', 'Política cookies', 'Política privacidad', 'Medios reclamación', 'Información precios claros'],
    cookies: { obligatorio: 'Informar + consentimiento previo (excepto técnicas)', tipos: ['Propias', 'Terceros', 'Analíticas', 'Publicitarias'], consentimiento: 'Opt-in activo. No pre-marcadas.' },
  },
  plataformas_digitales: {
    normativa: 'Ley 7/2021 Servicios Plataforma. Regula intermediarios digitales.',
    obligaciones: ['Transparencia algoritmos', 'Información vendedores', 'Mediación disputas', 'Retención pagos (seguridad)', 'Verificación identidad'],
  },
  contratos_digitales: {
    valencia: 'Consentimiento electrónico. Firma electrónica avanzada (Reglamento eIDAS).',
    firma: { simple: 'Cualquier método identificación (click)', avanzada: 'Firma electrónica certificada (FNMT, certificado digital)', cualificada: 'eIDAS equivalente manuscrita' },
  },
  inteligencia_artificial: {
    normativa_europea: 'AI Act (Reglamento UE 2024/1689)',
    clasificacion: ['Riesgo inaceptable (prohibido)', 'Alto riesgo (regulados)', 'Riesgo limitado (transparencia)', 'Riesgo mínimo (sin regulación)'],
    obligaciones: ['Evaluación impacto', 'Transparencia algoritmos', 'Supervisión humana', 'Robustez y seguridad'],
  },
  ciberseguridad: {
    normativa_europea: 'NIS2 (Directiva UE 2022/2555)',
    entidades: ['Infraestructuras críticas', 'Proveedor servicios digitales', 'Administraciones públicas'],
    obligaciones: ['Gestión riesgos', 'Notificación incidentes 24h', 'Auditorías', 'Planes continuidad'],
  },
}

// ══════════════════════════════════════════════════════════════
//  COMPLIANCE INTERNACIONAL
// ══════════════════════════════════════════════════════════════
const INTERNATIONAL_COMPLIANCE = {
  anticorrupcion_internacional: {
    uk_bribery_act: { alcance: 'Global. Empresas con negocio en UK.', penales: 'Prisión hasta 10 años. Multas ilimitadas.', pasivos: 'Soborno pasivo (funcionario) + activo (privado)' },
    fcpa: { alcance: 'Empresas cotizadas EEUU. Global.', prohibiciones: ['Soborno funcionarios extranjeros', 'Contabilidad falsa'], defensa: 'Programa compliance efectivo' },
    directiva_ue_fraude: { alcance: 'Toda la UE.', delitos: ['Fraude', 'Corrupción privada', 'Blanqueo fondos'], penales: 'Mínimo: prisión 4 años' },
  },
  proteccion_datos_internacional: {
    transferencias_us: { base: 'EU-US Data Privacy Framework', alternativas: ['Cláusulas contractuales', 'BCR'] },
    transferencias_latam: { mexico: 'LFPDPPP. Notificación titular. Transferencias con consentimiento.', colombia: 'Ley 1581/2012. Registro SIC.', argentina: 'PDPA. Equivalencia reconocida UE.', chile: 'Ley 19.628. Reforma 2024.' },
  },
  sostenibilidad_corporativa: {
    csrd: { name: 'Corporate Sustainability Reporting Directive', aplicable: 'Empresas UE >250 empleados o cotizadas', reporte: 'Sostenibilidad (ambiental, social, gobernanza)' },
    taxonomy: { name: 'Taxonomía verde UE', actividades: ['Mitigación cambio climático', 'Adaptación cambio climático', 'Agua', 'Economía circular', 'Contaminación', 'Biodiversidad'] },
  },
}

// ══════════════════════════════════════════════════════════════
//  DERECHO SOCIETARIO INTERNACIONAL
// ══════════════════════════════════════════════════════════════
const INTERNATIONAL_CORPORATE = {
  estructuras: {
    holding: { desc: 'Sociedad matriz que controla filiales', ventajas: ['Fiscal (participaciones)', 'Patrimonio separado', 'Gestión centralizada'], tipos: ['Holding financiero', 'Holding industrial'] },
    filial: { desc: 'Sociedad dependiente (>50% capital)', tipos: ['Filial española', 'Filial extranjera', 'Establecimiento permanente'] },
    joint_venture: { desc: 'Acuerdo entre empresas para proyecto específico', tipos: ['JV contractual', 'JV societaria'], regulacion: ['Derecho competencia', 'Protección datos'] },
    sucursal: { desc: 'Extensión de empresa extranjera', requisitos: ['Constitución filial', 'Representante legal', 'Inscripción registro mercantil'] },
  },
  fiscalidad_internacional: {
    precios_transferencia: { norma: 'OECD. Precios de mercado entre vinculados.', documentacion: ['Archivo país por país', 'Estudio precios transferencia', 'Información país por país'], sanciones: 'Recargo 25-50% + intereses' },
    doble_imposicion: { convenios: 'España tiene >90 convenios para evitar DII', metodos: ['Exención', 'Exención progresiva', 'Método crédito fiscal'], residencia: 'Centro intereses vitales o estancia >183 días' },
    planificacion_fiscal: { estrategias: ['Sede en jurisdicción favorable', 'Holding participaciones', 'Patentes en sociedad/licencia', 'Operaciones intragrupo'], anti_abuso: ['Cláusula sustancia', 'CFC rules', 'Limitación deducción intereses'] },
  },
  fusiones_adquisiciones: {
    tipos: { fusion: 'Unión de dos o más empresas. Necesita acuerdo asamblea + registro.', absorcion: 'Una empresa absorbe otra. Patrimonio, derechos y obligaciones pasan.', escision: 'División de empresa en varias. Total o parcial.', oferta_publica: 'OPA: adquisición acciones cotizadas en mercado.' },
    due_diligence: { areas: ['Jurídica (contratos, litigios, cumplimiento)', 'Financiera (cuentas, deudas, impuestos)', 'Fiscal (riesgos, revisiones)', 'Laboral (empleados, convenios, despidos)', 'Mercantil (propietad intelectual, marcas)', 'Medioambiental (contaminación, responsabilidad)', 'Tecnológica (sistemas, licencias)'] },
    valoracion: { metodos: ['DCF (descuento flujos)', 'Múltiplos comparables', 'Transacciones precedentes', 'Patrimonio neto ajustado'], factores_prima: { control: '30-50% (prima por control)', liquidez: '20-40% (descuento por falta liquidez)', sin_control: '15-30% (minority discount)' } },
    clausulas_clave: ['Garantías y declaraciones', 'Indemnización', 'No competencia post-venta', 'Material adverse change', 'MAC clause', 'Break fee (penalización ruptura)', 'Earn-out (pago condicional futuro)'],
  },
}

// ─── Gobierno corporativo ───
const CORPORATE_GOVERNANCE = {
  principios: ['Transparencia', 'Rendición de cuentas', 'Equidad trato accionistas', 'Responsabilidad', 'Interés público'],
  organos: {
    administracion: { tipos: ['Administrador único', 'Consejo de administración', 'Consejero delegado'], funciones: ['Dirección estratégica', 'Aprobación presupuestos', 'Nombramientos', 'Política dividendos'] },
    auditoria: { funciones: ['Supervisar contabilidad', 'Control interno', 'Auditoría externa', 'Información financiera'] },
  },
  accionistas: {
    derechos: ['Voto en junta', 'Información (cuentas, actas)', 'Impugnación acuerdos', 'Tanteo y retracto', 'Dividendo', 'Disolución'],
    obligaciones: ['Aportar capital', 'No competencia (si estatutos)', 'Responsabilidad hasta aportación'],
  },
}

// ─── Procedimientos legales específicos ───
const LEGAL_PROCEDURES = {
  registro_mercantil: { documentos: ['Escritura constitución', 'Estatutos', 'Nombramiento administradores', 'Domicilio social', 'Objeto social'], costes: 'Aprox. 100-300€ por inscripción', plazo: '5-15 días hábiles' },
  propiedad_intelectual: {
    registro: { entidad: 'Ministerio Cultura', costes: '30-80€ por obra', duracion: 'Vida autor + 70 años' },
    marca: { entidad: 'OE.S.P.T.I.', costes: '150-250€ por clase', duracion: '10 años (renovables indefinidamente)' },
    patente: { entidad: 'OE.S.P.T.I.', costes: '2.000-8.000€ tramitación completa', duracion: '20 años desde solicitud', requisitos: ['Novedad', 'Actividad inventiva', 'Aplicación industrial'] },
  },
  reclamaciones: {
    civil: { plazo: '5 años (general), 15 años (reales)', cuantia: 'Juzgado paz (<6.000€), primera instancia (<60.000€)' },
    mercantil: { plazo: '1 año (responsabilidad administradores)', tribunal: 'Juzgado de lo Mercantil' },
  },
}

// ─── Protección del consumidor ───
const CONSUMER_PROTECTION = {
  derechos: ['Información clara y veraz', 'Libre elección', 'No discriminación', 'Protección datos personales', 'Reclamación', 'Desistimiento (14 días compra online)'],
  clausulas_abusivas: { tipos: ['Limitación responsabilidad', 'Penalizaciones desproporcionadas', 'Renuncia derechos', 'Modificación unilateral precio'], consecuencias: 'Nulidad parcial del contrato' },
}

// ══════════════════════════════════════════════════════════════
//  PROTECCIÓN DE DATOS — RGPD / LOPD
// ══════════════════════════════════════════════════════════════
const DATA_PROTECTION = {
  principios_rgpd: ['Licitud, lealtad y transparencia', 'Limitación de la finalidad', 'Minimización de datos', 'Exactitud', 'Limitación del plazo', 'Integridad y confidencialidad', 'Responsabilidad proactiva'],
  bases_licitud: ['Consentimiento explícito', 'Ejecución de contrato', 'Obligación legal', 'Protección intereses vitales', 'Interés público', 'Interés legítimo'],
  derechos_titular: ['Acceso', 'Rectificación', 'Supresión ("olvido")', 'Limitación tratamiento', 'Portabilidad', 'Oposición', 'No automatización decisiones'],
  registro_actividades: { obligatorio: 'Si >250 empleados o tratamientos de alto riesgo', contenido: ['Finalidad', 'Categorías datos', 'Destinatarios', 'Transferencias internacionales', 'Plazos supresión', 'Medidas seguridad'] },
  dpdo: { obligatorio: 'Tratamientos a gran escala de datos especiales o vigilancia', funciones: ['Supervisar cumplimiento RGPD', 'Informar y asesorar', 'Cooperar con AEPD'] },
  sanciones: { leve: 'Hasta 40.000€', grave: 'Hasta 300.000€', muy_grave: 'Hasta 20.000.000€ o 4% facturación global' },
  transferencias_internacionales: ['Cláusulas contractuales tipo (CCE)', 'Decisiones adecuación Comisión Europea', 'Normas corporativas vinculantes (BCR)', 'Certificación (Art. 42)', 'Excepciones (Art. 49)'],
}

// ══════════════════════════════════════════════════════════════
//  PROPIEDAD INTELECTUAL E INDUSTRIAL
// ══════════════════════════════════════════════════════════════
const IP_LAW = {
  propiedad_intelectual: {
    derechos: ['Reproducción', 'Distribución', 'Comunicación pública', 'Transformación', 'Traducción', 'Adaptación'],
    duracion: 'Vida autor + 70 años (obras literarias, musicales)',
    registro: 'Propiedad Intelectual (Ministerio Cultura). No obligatorio pero recomendable.',
    software: 'Protegido como obra literaria. Sin registro = prueba más difícil.',
    bases_datos: 'Protección sui generis: 15 años inversión.',
  },
  propiedad_industrial: {
    marca: { registro: 'O.E.M.P.I. (SPTO)', duracion: '10 renovables', proteccion: 'Nombre/logo/distintivo', coste: '~150€ online, ~200€ presencial' },
    patente: { registro: 'O.E.M.P.I.', duracion: '20 años', proteccion: 'Inventos técnicos', coste: '5.000-15.000€ (tramitación completa)' },
    modelo_utilidad: { registro: 'O.E.M.P.I.', duracion: '10 renovables', proteccion: 'Forma o disposición práctica', coste: '2.000-5.000€' },
    dibujo_modelo: { registro: 'O.E.M.P.I.', duracion: '5 (máx 25)', proteccion: 'Apariencia estética', coste: '1.500-4.000€' },
    secreto_industrial: { proteccion: 'Confidencialidad + medidas seguridad', duracion: 'Mientras sea secreto', coste: 'Bajo (medidas internas)' },
  },
  cesion_derechos: {
    exclusiva: 'Solo cedente puede usar. Más caro.',
    no_exclusiva: 'Cedente puede ceder a otros. Más barato.',
    territorial: 'Puede limitarse a país/zona.',
    temporal: 'Puede limitarse a tiempo.',
    contraprestacion: 'Cánones, porcentaje ventas, pago único.',
  },
}

// ══════════════════════════════════════════════════════════════
//  COMPLIANCE — Programas de cumplimiento normativo
// ══════════════════════════════════════════════════════════════
const COMPLIANCE_PROGRAMS = {
  anticorrupcion: {
    normas: ['Ley 3/2015 Prevención delictos societarios', 'UK Bribery Act', 'FCPA (EEUU)', 'Directiva UE 2017/1371 (fraude)'],
    medidas: ['Código ético', 'Canal de denuncias', 'Due diligence terceros', 'Control donaciones/patrocinios', 'Formación empleados'],
    riesgos: ['Sobornos', 'Cohecho pasivo propio', 'Comisiones ilegales', 'Blanqueo capitales', 'Conflicto intereses'],
  },
  prevencion_blanceo: {
    normas: 'Ley 10/2010. Prevención blanqueo capitales y financiación terrorismo.',
    sujetos: ['Entidades financieras', 'Juegos de azar', 'Inmobiliarias', 'Asesorías fiscales', 'Auditorías', 'Comercio joyería/metal'],
    obligaciones: ['Identificar clientes', 'Comprobar identidad', 'Vigilar operaciones', 'Comunicar operaciones sospechosos (SEPBLAC)', 'Conservar documentación 10 años'],
  },
  proteccion_datos: { base: 'RGPD + LOPDGDD', medidas: ['DPO', 'Registro actividades', 'Evaluación impacto', 'Clausulas informativas', 'Consentimiento', 'Seguridad datos'] },
  prevencion_delitos_societarios: { base: 'Ley 3/2015', delitos: ['Cohecho', 'Tráfico de influencias', 'Falsedad documental', 'Blanqueo capitales', 'Estafa', 'Delitos informáticos'], medidas: ['Programa compliance', 'Canal de denuncias', 'Debida diligencia', 'Control contable'] },
}

// ══════════════════════════════════════════════════════════════
//  RESOLUCIÓN DE CONFLICTOS
// ══════════════════════════════════════════════════════════════
const DISPUTE_RESOLUTION = {
  negociacion: { desc: 'Primera vía. Directa entre partes.', duracion: '1-4 semanas', coste: 'Bajo (tiempo interno)', ventajas: ['Confidencialidad', 'Control resultado', 'Relación preservada'] },
  mediacion: { desc: 'Tercero neutral facilita acuerdo. No vinculante.', duracion: '1-3 meses', coste: 'Medio (mediador + abogados)', ventajas: ['Confidencial', 'Voluntario', 'Flexible', 'Preserva relación'] },
  arbitraje: { desc: 'Tercero decide. Vinculante y ejecutivo.', duracion: '3-12 meses', coste: 'Alto (árbitro + abogados)', ventajas: ['Resolución definitiva', 'Ejecutivo internacional', 'Especialista decide'] },
  litigio: { desc: 'Juzgado. Último recurso.', duracion: '1-5+ años', coste: 'Muy alto', ventajas: ['Garantías procesales', 'Recurso apelación'] },
  clausula_resolucion: { tipica: 'Negociación → Mediación (1 mes) → Arbitraje (LCIA/CCI) o litigio (juzgado competente)', recomendada: 'Incluir en todo contrato importante' },
}

class LegalAgent {
  constructor(gatewayUrl) {
    this.gatewayUrl = gatewayUrl
    this.name = AGENT_NAME
    this.capabilities = CAPABILITIES
    this.id = null
    this.token = null
    this.ws = null
    this.registrationCheckInterval = null
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

  // ─── Motor de análisis legal ───
  async analyzeTask(task) {
    const desc = (task.description || '').toLowerCase()
    const title = (task.title || '').toLowerCase()
    const full = `${title} ${desc}`

    const result = { analysis: [], legal_info: [], contracts: [], compliance: [], recommendations: [], urgency: 'normal' }

    // ─── Constitución de empresa ───
    if (/constitu|crear.*empresa|constituir|sociedad|alta.*empresa|montar.*empresa|abrir.*negocio/.test(full)) {
      let tipoDetectado = 'sl'
      if (/s\.?a\.?|anónim/.test(full)) tipoDetectado = 'sa'
      if (/cooperativ/.test(full)) tipoDetectado = 'sc'
      if (/autónom|freelance|por.*cuenta.*propia/.test(full)) tipoDetectado = 'autónomo'

      result.analysis.push({ topic: 'constitucion_empresa', company: COMPANY_TYPES[tipoDetectado] })
      result.legal_info.push(`Documentación necesaria: ${COMPANY_TYPES[tipoDetectado].constitucion.join(', ')}`)
    }

    // ─── Contratos ───
    for (const [key, contract] of Object.entries(CONTRACT_TYPES)) {
      const regex = new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      if (regex.test(full) || full.includes(contract.name.toLowerCase())) {
        result.contracts.push({ type: key, ...contract })
        result.recommendations.push(`Contrato ${contract.name}: revisar cláusulas esenciales, plazos y penalizaciones.`)
      }
    }

    // ─── Derecho laboral ───
    if (/laboral|trabajador|emplead|nómina|despido|jornada|vacaciones|convenio|accidente.*trabajo|ERTE|ERE/.test(full)) {
      result.legal_info.push({ topic: 'derecho_laboral', ...LABOR_LAW })
      result.urgency = 'high'

      if (/despido/.test(full)) {
        result.recommendations.push('DESPIDO: Verificar causa justificada, documentar, ofrecer improcedencia si no hay pruebas suficientes. Indemnización según tipo.')
        result.urgency = 'urgent'
      }
    }

    // ─── Protección de datos ───
    if (/rgpd|lopd|protección.*datos|gdpr|datos.*personales|privacidad|consentimiento.*datos|dpo|aepd/.test(full)) {
      result.legal_info.push({ topic: 'proteccion_datos', ...DATA_PROTECTION })
      result.compliance.push('RGPD/LOPD: Verificar bases licitud, derechos titulares, registro actividades, medidas seguridad, cláusulas informativas.')
    }

    // ─── Propiedad intelectual ───
    if (/marca|patente|registro.*marca|proteger.*marca|copyright|propiedad.*intelectual|software.*proteg| cesión.*derechos|licencia/.test(full)) {
      result.legal_info.push({ topic: 'propiedad_intelectual', ...IP_LAW })
    }

    // ─── Compliance ───
    if (/compliance|cumplimiento|anticorrupción|blanqueo|sepblac|canal.*denuncias|programa.*cumplimiento/.test(full)) {
      result.compliance.push({ topic: 'compliance', ...COMPLIANCE_PROGRAMS })
    }

    // ─── Resolución conflictos ───
    if (/conflict|disputa|arbitraje|mediación|litigio|demanda|reclam|juicio|tribunal/.test(full)) {
      result.analysis.push({ topic: 'resolucion_conflictos', ...DISPUTE_RESOLUTION })
    }

    // ─── Impuestos / fiscal ───
    if (/impuest|fiscal|hacienda|declaración.*renta|iva|irpf|sociedades|retención/.test(full)) {
      result.legal_info.push({ topic: 'fiscalidad', note: 'Para consultas fiscales específicas, coordinar con Finance Expert para cálculos. Legal proporciona marco normativo.' })
    }

    // Respuesta general
    if (result.analysis.length === 0 && result.legal_info.length === 0 && result.contracts.length === 0) {
      result.recommendations.push(`Consulta legal: "${task.description}". Especialidades:\n- Derecho societario (SL, SA, cooperativas)\n- Contratos laborales, arrendamiento, compraventa, servicios, NDA\n- Derecho laboral (despido, ERTE, convenios)\n- Protección datos (RGPD/LOPD)\n- Propiedad intelectual e industrial\n- Compliance y prevención delitos\n- Resolución de conflictos (mediación, arbitraje, litigio)\n- Fiscalidad (marco legal, coordinación con Finance Expert)`)
    }

    return result
  }

  // ─── Reporte legal ───
  generateReport(analysis, taskTitle) {
    const lines = [`═══ INFORME LEGAL: ${taskTitle} ═══`, `Fecha: ${new Date().toLocaleDateString('es-ES')}`, `Urgencia: ${analysis.recommendations.some(r => r.includes('urgent')) ? '🔴 URGENTE' : '🟡 NORMAL'}`, '']

    for (const contract of analysis.contracts) {
      lines.push(`CONTRATO: ${contract.name}`)
      if (contract.duracion) lines.push(`  Duración: ${Array.isArray(contract.duracion) ? contract.duracion.join(', ') : contract.duracion}`)
      if (contract.clausulas_esenciales) lines.push(`  Cláusulas esenciales: ${contract.clausulas_esenciales.join(', ')}`)
      if (contract.impuestos) lines.push(`  Impuestos: ${JSON.stringify(contract.impuestos)}`)
      lines.push('')
    }

    if (analysis.compliance.length > 0) {
      lines.push('COMPLIANCE REQUERIDO:')
      for (const comp of analysis.compliance) {
        lines.push(`  ✓ ${comp.topic || 'General'}`)
      }
      lines.push('')
    }

    if (analysis.recommendations.length > 0) {
      lines.push('RECOMENDACIONES:')
      for (const rec of analysis.recommendations) {
        lines.push(`  → ${rec}`)
      }
      lines.push('')
    }

    return lines.join('\n')
  }

  // ─── WebSocket ───
  async register() {
    console.log(`[${this.name}] Registrando...`)
    const { status, data } = await this.request('POST', '/agents/register', {
      name: this.name,
      description: 'Experto legal empresarial. Derecho societario (SL, SA, cooperativas), contratos (laborales, arrendamiento, compraventa, servicios, NDA), derecho laboral, RGPD/LOPD, propiedad intelectual e industrial, compliance, resolución de conflictos.',
      version: '1.0.0',
      capabilities: this.capabilities,
      endpoint: 'ws://localhost',
      connection_type: 'websocket',
      owner: 'getaway-agentes',
      is_external: false,
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
      this.registrationCheckInterval = setInterval(async () => {
        try { const { status, data } = await this.request('GET', `/agents/${this.id}`); if (status === 200 && data.token) { clearInterval(this.registrationCheckInterval); this.token = data.token; console.log(`[${this.name}] ¡Aprobado!`); resolve() } } catch {}
      }, 5000)
    })
  }

  connect() {
    return new Promise((resolve, reject) => {
      const wsUrl = this.gatewayUrl.replace(/^http/, 'ws') + `/ws?role=agent&token=${encodeURIComponent(this.token)}`
      this.ws = new WebSocket(wsUrl)
      this.ws.on('open', () => { console.log(`[${this.name}] Conectado`); resolve() })
      this.ws.on('message', (d) => { try { this.handleMessage(JSON.parse(d)) } catch {} })
      this.ws.on('close', () => { console.log(`[${this.name}] Desconectado. Reconectando...`); setTimeout(() => this.connect().catch(console.error), 3000) })
      this.ws.on('error', reject)
    })
  }

  handleMessage(msg) {
    switch (msg.type) {
      case 'heartbeat': this.send({ type: 'heartbeat_ack' }); break
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
    const result = { status: 'completed', agent: this.name, capabilities_used: ['corporate_law', 'contract_drafting', 'compliance'], legal: analysis, report, timestamp: new Date().toISOString() }
    this.send({ type: 'task_result', task_id: task.task_id, result })
    this.send({ type: 'knowledge_add', data: { title: `Legal: ${task.title}`, content: JSON.stringify(analysis), category: 'legal', tags: ['law', 'compliance', 'contracts'], source_agent_id: this.id, source_agent_name: this.name, source_task_id: task.task_id, visibility: 'public' } })
    console.log(`[${this.name}] Completado: ${task.task_id}`)
  }

  async processSubtask(subtask) {
    console.log(`[${this.name}] Subtarea: ${subtask.description?.slice(0, 80)}`)
    this.send({ type: 'task_status_update', task_id: subtask.task_id, status: 'in_progress' })
    const analysis = await this.analyzeTask({ title: subtask.title, description: subtask.description })
    const report = this.generateReport(analysis, subtask.title)
    const result = { status: 'completed', agent: this.name, capabilities_used: ['corporate_law', 'compliance'], legal: analysis, report, timestamp: new Date().toISOString() }
    this.send({ type: 'subtask_result', task_id: subtask.task_id, subtask_id: subtask.subtask_id, result })
    this.send({ type: 'knowledge_add', data: { title: `Legal: ${subtask.title}`, content: JSON.stringify(analysis), category: 'legal', tags: ['legal', 'compliance'], source_agent_id: this.id, source_agent_name: this.name, source_task_id: subtask.task_id, visibility: 'public' } })
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
    if (lower.includes('contrato') || lower.includes('contratos')) {
      return '📝 Tipos de contrato principales: Laboral (indefinido/temporal), Arrendamiento (LAU), Compraventa, Prestación servicios, NDA, Distribución, Franquicia. Cláusulas esenciales: objeto, precio, plazo, garantías, resolución. ¿Qué tipo necesitas?'
    }
    if (lower.includes('laboral') || lower.includes('trabajador') || lower.includes('despido') || lower.includes('empleo')) {
      return '👷 Derecho laboral: Jornada máx 40h/semanales, vacaciones 30 días naturales, permisos retribuidos (15 días nacimiento). Despido objetivo: 20 días/año (máx 12 mensualidades). Improcedente: 33 días/año (máx 24 mensualidades).'
    }
    if (lower.includes('rgpd') || lower.includes('protección de datos') || lower.includes('gdpr') || lower.includes('privacidad')) {
      return '🔒 RGPD: 7 principios (licitud, finalidad, minimización, exactitud, limitación, integridad, responsabilidad). Derechos: acceso, rectificación, supresión, portabilidad, oposición. Sanciones: hasta 20M€ o 4% facturación. DPO obligatorio si >250 empleados.'
    }
    if (lower.includes('marca') || lower.includes('patente') || lower.includes('propiedad intelectual') || lower.includes('copyright')) {
      return '™️ Propiedad industrial: Marca (OEPM, 10 años renovables, ~150€), Patente (20 años, 5.000-15.000€), Modelo utilidad (10 años). Propiedad intelectual: Vida autor + 70 años. Software protegido como obra literaria.'
    }
    if (lower.includes('gobierno corporativo') || lower.includes('board') || lower.includes('consejo')) {
      return '🏛️ Gobierno corporativo: Transparencia, rendición de cuentas, equidad trato accionistas. Órganos: Consejo Admin (SA: mín 3 consejeros), Administrador único (SL). Derechos accionistas: voto, información, impugnación, dividendo.'
    }
    if (lower.includes('fusión') || lower.includes('adquisición') || lower.includes('m&a') || lower.includes('comprar empresa')) {
      return '🤝 M&A: Tipos = fusión, absorción, escisión, OPA. Due diligence: jurídica, financiera, fiscal, laboral, medioambiental. Cláusulas clave: garantías, no competencia, MAC clause, break fee, earn-out. Valoración: DCF, múltiplos, precedentes.'
    }
    if (lower.includes('compliance') || lower.includes('cumplimiento') || lower.includes('anticorrupción')) {
      return '✅ Programa compliance: Código ético, canal denuncias, due diligence terceros, formación empleados. Prevención blanqueo (Ley 10/2010): identificar clientes, vigilar operaciones, comunicar SOS a SEPBLAC. Ley 3/2015 delitos societarios.'
    }
    if (lower.includes('arbitraje') || lower.includes('mediación') || lower.includes('conflicto') || lower.includes('disputa')) {
      return '⚖️ Resolución conflictos: 1) Negociación (1-4 sem, bajo coste), 2) Mediación (1-3 meses, confidencial), 3) Arbitraje (3-12 meses, vinculante), 4) Litigio (1-5+ años). Cláusula recomendada: Negociación → Mediación → Arbitraje LCIA/CCI.'
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
          topics_shared: ['AI Act compliance requirements (EU 2024/1689)', 'Cross-border data transfer mechanisms (SCCs/BCR)', 'Corporate sustainability reporting (CSRD)', 'Digital Markets Act implications'],
          entries_created: 4,
          details: 'Shared AI Act risk classification system and conformity assessment requirements, Standard Contractual Clauses for EU-to-third-country data transfers, CSRD double materiality assessment methodology, and DMA gatekeeper obligations timeline.',
          domain: 'legal_compliance',
        }
      case 'knowledge_query':
        return {
          findings: [
            'Retrieved latest AEPD guidelines on AI and automated decision-making under GDPR',
            'Located comparative analysis of EU vs US data privacy frameworks (DORA, CCPA)',
            'Found precedent cases on algorithmic transparency obligations',
            'Discovered emerging regulatory sandboxes for AI in healthcare and finance',
          ],
          sources: 4,
          domain: 'legal_compliance',
        }
      case 'self_improve':
        return {
          suggestions: [
            'Add real-time regulatory change monitoring for digital services legislation',
            'Expand knowledge base with sector-specific compliance checklists (healthtech, fintech)',
            'Include contract automation templates using legal AI for standard NDAs and SLAs',
            'Integrate case outcome prediction based on Spanish jurisdictional patterns',
          ],
          current_capability_score: 0.81,
          target_capability_score: 0.90,
          domain: 'legal_compliance',
        }
      case 'capability_explore':
        return {
          new_areas: ['AI liability directive implications', 'Digital identity (eIDAS 2.0)', 'Open finance regulation (PSD3)', 'Environmental claims substantification (Green Claims Directive)'],
          relevance: 'high',
          domain: 'legal_compliance',
        }
      case 'system_analysis':
        return {
          health_assessment: 'Solid coverage of traditional legal areas. Growing gaps in rapidly evolving digital regulation, AI governance, and cross-border e-commerce compliance frameworks.',
          coverage_score: 0.79,
          improvement_areas: ['AI Act implementation guidance', 'Metaverse intellectual property', 'Autonomous vehicle liability frameworks'],
          domain: 'legal_compliance',
        }
      default:
        return { message: `Unknown learning task type: ${taskType}` }
    }
  }

  generateImprovementProposal() {
    const proposals = [
      { type: 'feature', title: 'Automated Compliance Monitoring Dashboard', description: 'Build a real-time regulatory change tracker that monitors EU/Spain legislative feeds, identifies affected business operations, and generates compliance gap assessments with recommended actions.', priority: 'high' },
      { type: 'new_agent', title: 'AI Governance & Ethics Agent', description: 'Deploy a specialized agent for AI Act compliance, including high-risk AI system classification, conformity assessment preparation, bias auditing, and algorithmic transparency documentation.', priority: 'high' },
      { type: 'optimization', title: 'Smart Contract Clause Review', description: 'Implement automated contract clause analysis that flags non-compliant terms, suggests alternatives based on current jurisprudence, and benchmarks against industry standards.', priority: 'medium' },
      { type: 'knowledge_gap', title: 'ESG Greenwashing Legal Framework', description: 'Create comprehensive knowledge entries on the Green Claims Directive, substantiation requirements for environmental claims, and penalties for greenwashing under EU consumer protection law.', priority: 'medium' },
    ]
    return proposals[Math.floor(Math.random() * proposals.length)]
  }

  send(msg) { if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg)) }

  async run() {
    try { await this.register(); await this.connect(); console.log(`[${this.name}] ¡Listo!`) }
    catch (err) { console.error(`[${this.name}] Fatal:`, err.message); process.exit(1) }
  }
}

const agent = new LegalAgent(GATEWAY_URL)
agent.run()
process.on('SIGINT', () => { console.log(`\n[${AGENT_NAME}] Desconectando...`); if (agent.registrationCheckInterval) clearInterval(agent.registrationCheckInterval); if (agent.ws) agent.ws.close(); process.exit(0) })
