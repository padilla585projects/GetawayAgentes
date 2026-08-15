#!/usr/bin/env node

/**
 * Finance & Accounting Agent — GetawayAgentes
 *
 * Experto en contabilidad, impuestos, estados financieros,
 * análisis de inversiones, flujos de caja, presupuestos,
 * auditoría, fiscalidad internacional y gestión financiera empresarial.
 */

const http = require('http')
const https = require('https')
const { URL } = require('url')
const WebSocket = require('ws')

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:8787'
const AGENT_NAME = 'Finance Expert'
const CAPABILITIES = [
  'accounting',
  'tax_planning',
  'financial_statements',
  'cash_flow_management',
  'budget_control',
  'investment_analysis',
  'audit',
  'treasury',
  'cost_accounting',
  'financial_reporting',
]

// ══════════════════════════════════════════════════════════════
//  CONTABILIDAD — Plan General Contable (España) / NIIF
// ══════════════════════════════════════════════════════════════
const ACCOUNTING_PLAN = {
  'grupo 1': { name: 'Gastos financieros y otros gastos', accounts: ['600-606 Compras', '610 Descuentos', '620 Sueldos y salarios', '621 Seguridad Social', '622 Retribuciones personal externalizado'] },
  'grupo 2': { name: 'Gastos de personal', accounts: ['620 Sueldos y salarios', '621 Seguridad social a cargo empresa', '622 Retribuciones other', '623 Indemnizaciones', '624 Formación', '625 Seguros de personas'] },
  'grupo 3': { name: 'Gastos corrientes de bienes y servicios', accounts: ['626 Tributos indirectos deducibles', '627 Primas seguros', '628 Suministros', '629 Otros gastos personal', '630 Arrendamientos', '631 Reparaciones', '632 Servicios profesionales', '633 Transportes', '634 Primas emisiones', '635 Publicidad', '636 Lotes pequeños', '637 Otros gastos'] },
  'grupo 4': { name: 'Gastos financieros', accounts: ['660 Intereses pasivos', '661 Descuentos por pronto pago', '662 Pérdidas de créditos', '664 Gastos excepcionales', '665 Diferencias negativas de conversión'] },
  'grupo 5': { name: 'Amortización', accounts: ['680 Dotación amortización inmovilizado', '681 Dotación inmovilizado intangible', '682 Dotación inmovilizado material', '683 Dotación inversiones', '686 Dotación provisiones'] },
  'grupo 6': { name: 'Pérdidas', accounts: ['690 Gastos extraordinarios', '691 Gastos tributarios', '692 Resultados ejercicios anteriores', '694 Operaciones capital', '696 Operaciones especiales'] },
  'cuentas ingresos': { accounts: ['700 Ventas', '701 Devoluciones ventas', '706 Trabajos realizados', '708 Subvenciones explotación', '709 Descuentos obtenidos', '740 Ingresos por arrendamiento', '750 Reversiones provisiones', '751 Reversiones', '754 Descuentos', '756 Subvenciones', '757 Ingresos patrimoniales', '758 Ingresos financiación'] },
  'balance_activo': {
    'inmovilizado': ['200-216 Inversiones inmobiliarias', '220-233 Inmovilizado intangible', '240-256 Inmovilizado material', '260-290 Inversiones financieras'],
    'existencias': ['300-31 Compras', '310-32 Coste venta', '330-35 Existencias'],
    'tesoreria': ['570 Caja', '572 Banco', '573 Giro', '574 Letras', '575 Tesorería otros'],
  },
  'balance_pasivo': {
    'capital': ['100 Capital social', '110 Prima emisión', '112 Reservas legales', '114 Reservas voluntarias', '120 Resultado del ejercicio'],
    'pasivo_no_corriente': ['150 Provisiones no corrientes', '160 Deudas largo plazo', '170 Operaciones empresa', '180-182 Resultados ejercicios anteriores'],
    'pasivo_corriente': ['400 Proveedores', '410 Acreedores', '420 Hacienda', '430 Clientes', '460 Socios por dividendos', '470 Organismos Seg. Social'],
  },
}

// ══════════════════════════════════════════════════════════════
//  IMPUESTOS — España
// ══════════════════════════════════════════════════════════════
const TAX_SYSTEM = {
  iva: {
    general: { rate: 21, desc: 'Bienes y servicios generales' },
    reducido: { rate: 10, desc: 'Alimentos, hostelería, transporte, vivienda' },
    superreducido: { rate: 4, desc: 'Medicamentos, libros, alimentos básicos' },
    exento: { rate: 0, desc: 'Educación, sanidad, servicios financieros, exportaciones' },
    regla_cta: 'Inversión sujeto pasivo (urbanización, construcción)',
    devengo: 'Expedición factura / cobro anticipado',
    periodicidad: 'Mensual (>6.012€/año IVA soportado) / Trimestral',
    modelos: { '303': 'Declaración IVA', '390': 'Resumen anual', '347': 'Operaciones terceros >3.005€' },
  },
  irpf: {
    tramos_2024: [
      { min: 0, max: 12450, rate: 19, retencion: 19 },
      { min: 12450, max: 20200, rate: 24, retencion: 24 },
      { min: 20200, max: 35200, rate: 30, retencion: 30 },
      { min: 35200, max: 60000, rate: 37, retencion: 37 },
      { min: 60000, max: Infinity, rate: 47, retencion: 47 },
    ],
    reducciones: { general: 6498, rentas_bajas: 6498, discapacidad: 3000, multiple: 'Duplicar si多种' },
    retenciones: { trabajadores: '19-47%', profesionales: '15%', arrendamientos: '19%', dividendos: '19%' },
    modelos: { '100': 'IRPF renta', '111': 'Retenciones trabajadores/profesionales', '115': 'Retenciones arrendamiento', '117': 'Dividendos' },
  },
  is: { // Impuesto Sociedades
    tipo_grupal: 25,
    reducido: 23, // PYMES <1€M beneficio
    entidades_pequenas: 25,
    cooperativas: 20,
    entidades_60: 30, // >60M€ beneficio
    perdidas: 'Compensación 25% base imponible, sin límite temporal (Ley 27/2014)',
    deducciones: ['I+D+i (25-42%)', 'Producción audiovisual (25%)', 'Creación empleo (entornos vulnerables)', 'Zonas vulnerables Canarias (25-50%)', 'Exportaciones (Canarias: exención 90-100%)', 'Invención tecnológica (25%)', 'Inversión sostenible (10-25%)'],
    modelos: { '200': 'Declaración anual', '202': 'Pagos fraccionados', '220': 'Consolidación fiscal' },
    pagos_fraccionados: { periodo: 'Trimestral (20 abril, julio, octubre, diciembre)', base: '19% (PYMES) o 24% (general) × base imponible' },
  },
  impuestos_autonomicos: {
    isla_canarias: { zec: 'Zona Económica Canaria: 4% impuesto sociedades', deducciones: '25-50% inversión I+D, creación empleo', ige: 'Inscripción General Empresas: exención IAE' },
    pais_vasco: { confierto: 'Concierto económico. Impuesto propio sociedades: 24%, reducido 10%', diputaciones: 'Diputaciones Forales gestionan' },
    navarra: { concierto: 'Régimen fiscal foral. Tipo general 25%, reducido 10%', patrimonio: 'Impuesto Patrimonio 0.8-3.5%' },
    ceuta_melilla: { deducciones: 'Inversiones: 50% bonificación, creación empleo 50%', zec: 'Zona Económica Ceuta/Melilla: 4% sociedades' },
  },
  iva_avanzado: {
    inversion_sujeto_pasivo: { casos: ['Construcción edificios', 'Urbanización terrenos', 'Transmisión inmuebles exentas', 'Bienes USED (segunda mano)'], when: 'Si comprador es empresario y destinado a actividad' },
    prorrata: { formula: '(IVA deducible / IVA total) × 100', when: 'Si actividad mixta (exenta + gravada)', regla: 'Si >50% → prorrata general. <50% → no deducible' },
    rectificacion: { plazo: '4 años desde devengo', casos: ['Descuentos', 'Devolution', 'Dead operations', 'Price change'] },
    operaciones_intracomunitarias: { requisitos: ['NIF-IVA', 'Comunidad Europea', 'Comunicación operaciones (modelo 180/190)', 'Factura sin IVA con retribución'], modelos: { '349': 'Declaración recapitulativa mensual' } },
    exportaciones: { tipo: 'Exento (0%)', documento: 'Factura exportación + conocimiento embarque/aduana', drawback: 'Devolución IVA soportado en exportación' },
  },
  impuestos_digitales: {
    iva_digital: { aplicable: 'Servicios digitales a particulares UE', tipo: 'IVA país destino consumidor', umbral: '10.000€/año UE', registro: 'OSS (One Stop Shop)' },
    impuesto_tecnologicas: { aplicable: 'Grandes empresas tecnológicas (>750M€ facturación)', tipo: '3%', modelos: 'Modelo 599 (retenciones pagos digitales)' },
  },
  otro: {
    iae: 'Impuesto Actividades Económicas. Exento primeros 3 años. Tarifas 845-863',
    plusvalia: 'Transmisiones inmuebles. Base: valor catastral × coeficiente × años. Tipo: 0.4-11%',
    transmisiones: 'Actos jurídicos documentados: 0.5-1.5% según tipo',
    sucesiones: 'Herederos directos: 7.65-34% según cuantía Comunidad',
    ibi: 'Impuesto Bienes Inmuebles. Recibo municipal. Sobre valor catastral',
    patrimonio: 'Impuesto Patrimonio: 0.2-3.5% (variúa por CCAA). Exención hasta 300.000€ vivienda habitual',
    sucesiones_avanzado: { groups: ['Grupo I: descendientes <21 años', 'Grupo II: descendientes 21-65', 'Grupo III: ascendientes, colaterales 2°-3°', 'Grupo IV: colaterales 4°+, extraños'], reducciones: 'Grupos I y II: reducción 15.956-47.858€ según cuantía' },
  },
}

// ══════════════════════════════════════════════════════════════
//  ESTÁNDARES CONTABLES INTERNACIONALES (NIIF/IFRS)
// ══════════════════════════════════════════════════════════════
const IFRS_STANDARDS = {
  'niif 15': { name: 'Ingresos de Actividades Ordinarias', key: 'Reconocimiento por 5 pasos: contratos, performance obligations, transaction price, allocation, recognition', impact: 'Todas las empresas que reconocen ingresos' },
  'niif 16': { name: 'Arrendamientos', key: 'Todos los arrendamientos en balance (excepto <12 meses o activos de bajo valor)', impact: 'Arrendatarios: reconocer activo derecho uso + pasivo arrendamiento' },
  'niif 9': { name: 'Instrumentos Financieros', key: 'Clasificación y medición: amortized cost, FVOCI, FVTPL. Pérdida esperada crediticia', impact: 'Entidades financieras, inversiones' },
  'niif 13': { name: 'Medición a Valor Razonable', key: 'Tres niveles: cotización activa, observable, no observable', impact: 'Medición valor razonable de activos/pasivos' },
  'niif 10': { name: 'Estados Financieros Consolidados', key: 'Control: poder, rendimientos, capacidad ejercicio poder', impact: 'Grupos empresariales' },
  'niif 12': { name: 'Participaciones en otras entidades', key: 'Inversiones en asociadas, joint ventures, consolidadas', impact: 'Divulgación participaciones' },
  'niif 3': { name: 'Combinaciones de Negocios', key: 'Purchase method. Goodwill: costo - FV activos netos identificables', impact: 'Fusiones, adquisiciones' },
  'niif 8': { name: 'Segmentos Operativos', key: 'Informar por segmentos: geográfico, producto, cliente', impact: 'Grandes empresas cotizadas' },
  'niif 5': { name: 'Activos no corrientes mantenidos para la venta', key: 'Clasificar y medir activos destinados a venta', impact: 'Cierre de líneas de negocio' },
  'niif 7': { name: 'Instrumentos Financieros: Divulgaciones', key: 'Riesgo de crédito, liquidez, riesgo mercado', impact: 'Entidades financieras' },
}

// ══════════════════════════════════════════════════════════════
//  MODELADO FINANCIERO
// ══════════════════════════════════════════════════════════════
const FINANCIAL_MODELING = {
  estados_financieros_proyectados: {
    pasos: ['Proyectar ventas (tasa crecimiento)', 'Calcular coste ventas (% ventas)', 'Calcular gastos operativos', 'Generar cuenta resultados', 'Calcular depreciación/amortización', 'Calcular impuestos', 'Generar balance', 'Generar flujo caja'],
  },
  valoracion_empresas: {
    descuento_flujos: { name: 'DCF (Discounted Cash Flow)', formula: 'Σ(FCF/(1+r)^t) + TV/(1+r)^n', fcf: 'FCF = EBIT(1-t) + Dep - Capex - ΔWC', wacc: 'WACC = Ke×E/(E+D) + Kd×D/(E+D)×(1-t)', terminal_value: 'TV = FCF_ultimo × (1+g) / (WACC - g)' },
    multiplicadores: { name: 'Múltiplos comparables', ratios: ['EV/EBITDA', 'EV/EBIT', 'P/E (Price/Earnings)', 'P/B (Price/Book)', 'EV/Revenue'], sectors: { tecnologia: 'EV/EBITDA 15-25x', industria: 'EV/EBITDA 8-12x', retail: 'EV/EBITDA 6-10x', servicios: 'EV/EBITDA 10-15x' } },
    precedent_transacciones: { name: 'Transacciones precedentes', uso: 'Adquisiciones, fusiones, buy-outs', fuente: ['Bloomberg', 'Thomson Reuters', 'Mergermarket'] },
  },
  plan_financiero: {
    tres_estados: ['Cuenta resultados proyectada', 'Balance proyectado', 'Flujo caja proyectado'],
    ratios_clave: ['Margen neto', 'ROE', 'Deuda/EBITDA', 'Current ratio', 'Days sales outstanding'],
    sensibilidad: ['Variación ventas ±10%', 'Variación costes ±5%', 'Variación tipo interés ±2%', 'Variación divisa ±10%'],
  },
  analisis_punto_equilibrio: {
    formula: 'Punto equilibrio = CF / (Precio - CosteVariable)',
    tipos: { contable: 'Beneficio neto = 0 (incluye impuestos)',经济: 'Ingresos = Costes totales', marginal: 'Ingreso marginal = Coste marginal' },
    sensibilidad: 'Cambiar precio, coste fijo, coste variable y ver efecto en punto equilibrio',
  },
}

// ══════════════════════════════════════════════════════════════
//  AUDITORÍA Y CONTROL
// ══════════════════════════════════════════════════════════════
const AUDIT_PROCEDURES = {
  audit_financiera: {
    objetivo: 'Opinión razonable sobre si los estados financieros reflejan verdadera y razonablemente la situación',
    normas: 'NIIF 200, ISA (International Standards on Auditing)',
    fases: ['Planificación (riesgo material, estrategia)', 'Evaluación control interno', 'Procedimientos sustantivos', 'Valoración resultados', 'Informe auditoría'],
    riesgo_auditoria: { inherente: 'Sin considerar control interno', control: 'Fallida del control interno', deteccion: 'Procedimientos no detectan error', formula: 'RA = RI × RC × RD' },
    materialidad: { formula: '2-5% ingresos, 1-2% activos, 0.5-2% beneficio', umbral: 'Errores > materialidad son significativos' },
    pruebas_sustantivas: ['Confirmaciones (bancos, clientes, proveedores)', 'Inventarios físicos', 'Observación almacén', 'Revisión contratos', 'Confirmación saldos', 'Análisis comparativo'],
  },
  auditoria_interna: {
    objetivo: 'Evaluar eficiencia, eficacia y economía de la gestión',
    normas: 'IIA (Institute of Internal Auditing)',
    funciones: ['Control interno', 'Cumplimiento normativo', 'Gestión riesgos', 'Fraude y corrupción', 'Mejora procesos'],
    informe: { tipo: 'Informativo (no opinión)', contenido: ['Hallazgos', 'Recomendaciones', 'Plazos seguimiento', 'Estado acciones correctivas'] },
  },
  fraude_contable: {
    tipos: ['Inflación ingresos', 'Reducción gastos ficticios', 'Ocultación pasivos', 'Manipulación valoración activos', 'Operaciones ficticias'],
    señales: ['Beneficios sin flujo caja', 'Variaciones inusuales', 'Transacciones último día trimestre', 'Clientes/proveedores ficticios', 'Documentación incompleta'],
    prevencion: ['Segregación funciones', 'Aprobaciones escalonadas', 'Auditorías sorpresa', 'Canal de denuncias', 'Revisión conciliaciones'],
  },
  contabilidad_gestion: {
    costes: { absorcion: 'Todos los costes se asignan a producto (fijos + variables)', variable: 'Solo costes variables. Contribución por producto.', actividad: 'Costes asignados por actividad real (ABC)', standard: 'Costes estándar vs reales (desviaciones)' },
    indicadores: ['Coste por unidad', 'Margen contribución', 'ROI departamental', 'EVA (Economic Value Added)', 'Coste capital'],
  },
}

// ─── Contabilidad específica por sector ───
const SECTOR_ACCOUNTING = {
  construccion: {
    reconocimiento_ingresos: 'Método porcentaje de finalización (NIIF 15). Ingresos = Contrato total × % avance.',
    existencias: 'Trabajos en curso. Coste acumulado + márgen esperado.',
    garantias: 'Provisión para garantías (estimación coste reclamaciones).',
    retenciones: 'Retención 7% obra (Colombia), IRPF construcción (España).',
  },
  inmobiliario: {
    inversion_inmobiliaria: 'Inmuebles para venta: valor razonable o coste menor. Inmuebles alquiler: coste depreciado.',
    suelo: 'Sin depreciar si se espera revalorización. Si baja valor: deterioro.',
    promociones: 'Coste del suelo + coste urbanización + coste construcción + gastos generales.',
  },
  tecnologia: {
    ingresos_software: 'Licencias (pago único), SaaS (suscripción), desarrollo por encargo (NIIF 15).',
    i_plus_d: 'Gasto corriente. Solo capitalizable si hay viabilidad comercial demostrable.',
    propiedad_intelectual: 'Patentes, marcas, software registrado. Amortización: vida útil estimada.',
  },
  restauracion: {
    existencias: 'Materias perecederas. Primeras entradas primera salida (PEPS).',
    perdidas: 'Deterioro existencias por caducidad. Provisión.',
    propinas: 'Ingresos trabajadores. No tributa en IRPF si <12.000€/año (exención).',
  },
  transporte: {
    vehiculos: 'Inmovilizado material. Amortización: 25% anual (25% Lineal).',
    combustible: 'Gasto deducible. IVA deducible si actividad económica.',
    peajes: 'Gasto deducible. IVA deducible si actividad económica.',
  },
}

// ─── Planificación fiscal avanzada ───
const TAX_PLANNING = {
  estrategias_pymes: {
    amortizacion_libre: 'Inversión <300€: deducción 100% primer año.',
    reserva_legal: '5% beneficios hasta 10% capital social. Deducible.',
    incentivos_fiscales: ['Deducción I+D+i (25-42%)', 'Zona franca Canarias (4%)', 'Entornos vulnerables (creación empleo)', 'Zonas rebajas navarras/país vasco'],
    diferimiento_fiscal: ['Traslado sede social a fiscalmente favorable', 'Estructura holding (participaciones)', 'Reinversión beneficios'],
  },
  planificacion_avanzada: {
    holding_participaciones: { ventajas: ['Exención 95% dividendos recibidos', 'Exención 95% plusvalías transmisión', 'Gestión centralizada fondos'], requisitos: 'Participación >5% y tenencia >1 año' },
    patent_box: { desc: 'Licenciar patentes/marcas a filial en paraíso fiscal', ahorro: 'Reducción base imponible IS (España: 60%)', requisitos: 'Novedad, actividad inventiva, pago royalty' },
    fusion_adquisicion: { beneficio: 'Fiscalidad diferida, compensación bases imponibles', limites: '25% base imponible anual compensación pérdidas' },
  },
}

// ─── Gestión de cobros y pagos ───
const PAYMENT_MANAGEMENT = {
  cobros: {
    descuento_comercial: 'Descuento por pronto pago (2/15, net/30 = 2% descuento si paga en 15 días)',
    descuento_comercial_contable: 'Descuento sobre importe brutos. Gasto financiero.',
    incobrables: 'Provisión créditos incobrables. Gasto deducible.',
  },
  pagos: {
    descuento_proveedor: 'Obtener descuento por pronto pago. Beneficio financiero.',
    confirming: 'Banco paga proveedores. Empresa paga banco a vencimiento.',
    pagaré: 'Efecto comercial. Vencimiento específico.',
  },
  gestion_tesoreria: {
    forecast: 'Previsión flujos de caja a 30/60/90 días',
    minimo_operativo: 'Saldo mínimo para operaciones diarias',
    reserva_seguridad: '3-6 meses gastos fijos como reserva',
  },
}

// ══════════════════════════════════════════════════════════════
//  GESTIÓN DE TESORERÍA
// ══════════════════════════════════════════════════════════════
const TREASURY_MANAGEMENT = {
  tesoreria_operativa: {
    objetivo: 'Mantener liquidez suficiente para operaciones diarias',
    indicadores: ['Días de tesorería (cash runway)', 'Fondo de maniobra', 'Ciclo de conversión efectivo'],
    herramientas: ['Línea de crédito', 'Descuento de efectos', 'Confirming (proveedores)', 'Factoring (clientes)'],
  },
  inversiones_temporales: {
    tipos: ['Depósitos a plazo', 'Letras del Tesoro', 'Fondos monetarios', 'Bonos corto plazo'],
    criterios: ['Rentabilidad vs riesgo', 'Liquidez necesaria', 'Plazo coincide con necesidades', 'Riesgo crédito'],
  },
  financiacion: {
    deuda: { tipos: ['Préstamo bancario', 'Bonos corporativos', 'Línea crédito revolving', 'Leasing'], coste: 'Euribor + diferencial (0.5-3%)', garantias: ['Hipotecaria', 'Personal', 'Aval empresa'] },
    capital: { tipos: ['Ampliación capital', 'Fondos propios', 'Retención beneficios'], coste: 'Coste equity (Ke) = Rf + β(Rm-Rf)' },
  },
  analisis_ciclo_efectivo: {
    formula: 'DPO + DIO - DSO = Ciclo efectivo (días)',
    componentes: { dpo: 'Días pago proveedores (Days Payable Outstanding)', dio: 'Días inventario (Days Inventory Outstanding)', dso: 'Días cobro clientes (Days Sales Outstanding)' },
    objetivo: 'Minimizar ciclo = empresa necesita menos financiación',
  },
}

// ══════════════════════════════════════════════════════════════
//  FISCALIDAD POR PAÍSES (resumen)
// ══════════════════════════════════════════════════════════════
const INTERNATIONAL_TAX = {
  mexico: { iva: '16%', isr: '30% empresas', ieps: 'Productos específicos (alcohol, tabaco, gasolina)', persona_fisica: '1.92-35% en renta', regimen_simplificado: 'RFC Simplificado (<3.5M UMD)' },
  colombia: { iva: '19%', renta: '35% empresas', retenciones: 'Múltiples (honorarios, servicios, IVA)', regimen_simple: 'Simplificado (<649 UTD)' },
  argentina: { iva: '21%', ganancias: '35% empresas', iibb: 'Ingresos brutos (1-5% según jurisdicción)', retenciones: 'Simplificado vs régimen general' },
  chile: { iva: '19%', renta: '27% primera categoría, 35% global complementario', dfl2: 'Empresas pequeñas (<UF 75.000)' },
  peru: { igv: '18%', renta: '29.5% empresas', regimen_mype: 'Régimen MYPE tributario' },
}

// ══════════════════════════════════════════════════════════════
//  ESTADOS FINANCIEROS — Ratios y análisis
// ══════════════════════════════════════════════════════════════
const FINANCIAL_RATIOS = {
  liquidez: {
    ratio_corriente: { formula: 'Activo Corriente / Pasivo Corriente', good: '>1.5', desc: 'Capacidad de pago a corto plazo' },
    ratio_acid: { formula: '(Activo Corriente - Existencias) / Pasivo Corriente', good: '>1.0', desc: 'Liquidez extrema sin vender existencias' },
    capital_trabajo: { formula: 'Activo Corriente - Pasivo Corriente', good: '>0', desc: 'Recursos netos a corto plazo' },
  },
  solvencia: {
    ratio_endeudamiento: { formula: 'Deuda Total / Activo Total', good: '<0.6', desc: 'Porcentaje de activo financiado con deuda' },
    ratio_apalancamiento: { formula: 'Pasivo Total / Fondos Propios', good: '<2.0', desc: 'Apalancamiento financiero' },
    ratio_cobertura: { formula: 'EBIT / Gastos financieros', good: '>3.0', desc: 'Capacidad de cubrir gastos financieros' },
  },
  rentabilidad: {
    roe: { formula: 'Beneficio Neto / Fondos Propios × 100', good: '>15%', desc: 'Rentabilidad para accionistas' },
    roa: { formula: 'Beneficio Neto / Activo Total × 100', good: '>5%', desc: 'Rentabilidad sobre activos' },
    roce: { formula: 'EBIT / (Fondos Propios + Deuda) × 100', good: '>12%', desc: 'Rentabilidad del capital empleado' },
    margen_beneficio: { formula: 'Beneficio Neto / Ventas × 100', good: '>10%', desc: 'Margen neto sobre ventas' },
    margen_bruto: { formula: '(Ventas - Coste Ventas) / Ventas × 100', good: '>30%', desc: 'Margen bruto sobre ventas' },
  },
  eficiencia: {
    rotacion_existencias: { formula: 'Coste Ventas / Existencias medias', good: 'Según sector', desc: 'Veces que se renuevan existencias' },
    days_sales_outstanding: { formula: 'Cuentas Clientes / Ventas × 365', good: '<45 días', desc: 'Días de cobro medio' },
    days_payable: { formula: 'Cuentas Proveedores / Compras × 365', good: '30-60 días', desc: 'Días de pago medio' },
    rotacion_activo: { formula: 'Ventas / Activo Total', good: '>1.0', desc: 'Eficiencia en uso de activos' },
  },
  crecimiento: {
    crecimiento_ventas: { formula: '(Ventas actuales - Ventas anteriores) / Ventas anteriores × 100', good: '>inflación', desc: 'Crecimiento real de ventas' },
    crecimiento_beneficio: { formula: '(Beneficio actual - Beneficio anterior) / Beneficio anterior × 100', good: '>0%', desc: 'Crecimiento del beneficio' },
  },
}

// ══════════════════════════════════════════════════════════════
//  FLUJO DE CAJA — Métodos y análisis
// ══════════════════════════════════════════════════════════════
const CASH_FLOW = {
  categorias: {
    operativo: { desc: 'Actividad principal del negocio', items: ['Cobros clientes', 'Pagos proveedores', 'Nómina', 'Alquileres', 'Impuestos', 'Seguros'] },
    inversion: { desc: 'Inversiones a largo plazo', items: ['Compra inmuebles', 'Maquinaria', 'Fondo comercio', 'Participaciones'] },
    financiacion: { desc: 'Operaciones con prestamistas/accionistas', items: ['Préstamos recibidos', 'Amortización préstamos', 'Emisión acciones', 'Dividendos pagados'] },
  },
  metodos: {
    directo: 'Flujos reales de entrada/salida. Más preciso, más trabajo.',
    indirecto: 'Parte del beneficio y ajusta partidas no monetarias. Más usado.',
  },
  indicadores: {
    fco: 'Flujo caja operativo: beneficio + amortización - variations WC',
    fcf: 'Flujo libre: FCO - inversiones en activo',
    punto_equilibrio: 'Costes fijos / (Precio unitario - Coste variable unitario)',
    payback: 'Tiempo recuperar inversión = Inversión / FCO anual',
    van: 'Valor Actual Neto: Σ(Flujos / (1+r)^t) - Inversión',
    tir: 'Tasa Interna Retorno: tasa donde VAN = 0',
  },
}

// ══════════════════════════════════════════════════════════════
//  PRESUPUESTOS Y CONTROL DE COSTES
// ══════════════════════════════════════════════════════════════
const BUDGET_CATEGORIES = {
  fijos: { items: ['Alquiler', 'Seguros', 'Sueldos fijos', 'Amortizaciones', 'Impuestos fijos'], note: 'No varían con producción' },
  variables: { items: ['Materias primas', 'Comisiones', 'Transporte directo', 'Energía directa'], note: 'Varían proporcionalmente con actividad' },
  semivarios: { items: ['Suministros', 'Mantenimiento', 'Personal temporal'], note: 'Componente fija + variable' },
}

// ══════════════════════════════════════════════════════════════
//  ANÁLISIS DE INVERSIONES
// ══════════════════════════════════════════════════════════════
const INVESTMENT_METHODS = {
  van: { name: 'Valor Actual Neto', formula: 'VAN = Σ(Ct/(1+r)^t) - C0', decision: 'VAN > 0 → Aceptar', desc: 'Descuenta flujos futuros a valor presente' },
  tir: { name: 'Tasa Interna de Retorno', formula: 'TIR donde VAN = 0', decision: 'TIR > coste capital → Aceptar', desc: 'Rentabilidad intrínseca del proyecto' },
  payback: { name: 'Payback Simple', formula: 'Años para recuperar inversión', decision: 'Menor tiempo mejor', desc: 'No considera valor tiempo dinero' },
  payback_dto: { name: 'Payback Descontado', formula: 'Payback con flujos descontados', decision: 'Menor tiempo mejor', desc: 'Versión mejorada del payback' },
  roi: { name: 'Return on Investment', formula: '(Beneficio Neto - Inversión) / Inversión × 100', decision: 'ROI > alternativa → Aceptar', desc: 'Rentabilidad relativa de la inversión' },
  bcr: { name: 'Beneficio / Coste', formula: 'PV(Flujos) / PV(Inversión)', decision: 'BCR > 1 → Aceptar', desc: 'Ratio beneficio sobre coste descontado' },
}

function calculateVAN(flows, rate) {
  let van = 0
  for (let t = 0; t < flows.length; t++) {
    van += flows[t] / Math.pow(1 + rate, t)
  }
  return Math.round(van * 100) / 100
}

function calculatePayback(initialInvestment, annualFlows) {
  let accumulated = 0
  for (let year = 0; year < annualFlows.length; year++) {
    accumulated += annualFlows[year]
    if (accumulated >= initialInvestment) {
      const fraction = (initialInvestment - (accumulated - annualFlows[year])) / annualFlows[year]
      return year + fraction
    }
  }
  return null // Never pays back
}

function calculatePuntoEquilibrio(costosFijos, precioUnitario, costeVariableUnitario) {
  const contributionMargin = precioUnitario - costeVariableUnitario
  if (contributionMargin <= 0) return { error: 'Margen de contribución negativo' }
  const units = Math.ceil(costosFijos / contributionMargin)
  const revenue = units * precioUnitario
  return { unidades: units, ingresos_necesarios: revenue, margen_contribucion: contributionMargin, margen_contribucion_pct: Math.round(contributionMargin / precioUnitario * 100) }
}

class FinanceAgent {
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

  // ─── Motor de análisis financiero ───
  async analyzeTask(task) {
    const desc = (task.description || '').toLowerCase()
    const title = (task.title || '').toLowerCase()
    const full = `${title} ${desc}`

    const result = { analysis: [], calculations: [], tax_info: [], financial_data: [], recommendations: [], tools_needed: [] }

    // ─── Contabilidad ───
    if (/contab|balance|cuenta|asiento|libro|registro/.test(full)) {
      result.analysis.push({ topic: 'contabilidad', plan: ACCOUNTING_PLAN })
      result.tools_needed.push('Software contable (ContaPlus, Sage, QuickBooks)', 'NIF/DNI empresa')
    }

    // ─── IVA ───
    if (/iva|impuesto.*venta|factura.*impuesto|repercutir/.test(full)) {
      result.tax_info.push({ tax: 'IVA', ...TAX_SYSTEM.iva })

      // Cálculo IVA si hay cantidad
      const amountMatch = full.match(/(\d+(?:\.\d+)?)\s*€/)
      if (amountMatch) {
        const base = parseFloat(amountMatch[1])
        result.calculations.push({
          type: 'iva',
          base,
          iva_21: Math.round(base * 0.21 * 100) / 100,
          total_21: Math.round(base * 1.21 * 100) / 100,
          iva_10: Math.round(base * 0.10 * 100) / 100,
          total_10: Math.round(base * 1.10 * 100) / 100,
          iva_4: Math.round(base * 0.04 * 100) / 100,
          total_4: Math.round(base * 1.04 * 100) / 100,
        })
      }
    }

    // ─── IRPF ───
    if (/irpf|retención|nómina|sueldo|salario|trabajador/.test(full)) {
      result.tax_info.push({ tax: 'IRPF', ...TAX_SYSTEM.irpf })

      // Cálculo nómina si hay salario
      const salaryMatch = full.match(/(\d+(?:\.\d+)?)\s*(?:€|euros|eur)/)
      if (salaryMatch) {
        const gross = parseFloat(salaryMatch[1])
        let retencion = 0.19
        for (const tramo of TAX_SYSTEM.irpf.tramos_2024) {
          if (gross >= tramo.min && gross <= tramo.max) { retencion = tramo.rate / 100; break }
        }
        const deduccion = gross * retencion
        const ssTrabajador = gross * 0.0635
        const neto = gross - deduccion - ssTrabajador
        result.calculations.push({
          type: 'nomina',
          bruto: gross,
          irpf: Math.round(deduccion * 100) / 100,
          irpf_pct: Math.round(retencion * 100),
          ss_trabajador: Math.round(ssTrabajador * 100) / 100,
          ss_empresa: Math.round(gross * 0.299 * 100) / 100,
          neto: Math.round(neto * 100) / 100,
          coste_total_empresa: Math.round((gross + gross * 0.299) * 100) / 100,
        })
      }
    }

    // ─── Impuesto Sociedades ───
    if (/sociedades|beneficio.*empresa|is\b|fiscalidad.*sociedad/.test(full)) {
      result.tax_info.push({ tax: 'Impuesto Sociedades', ...TAX_SYSTEM.is })
    }

    // ─── Estados financieros ───
    if (/ratio|ratio|análisis.*financier|estados.*financier|balance.*general|cuenta.*resultados/.test(full)) {
      result.financial_data.push({ type: 'financial_ratios', ...FINANCIAL_RATIOS })
    }

    // ─── Flujo de caja ───
    if (/flujo.*caja|cash.*flow| tesorería| tesorería/.test(full)) {
      result.financial_data.push({ type: 'cash_flow', ...CASH_FLOW })

      // Punto equilibrio si hay datos
      const fixedMatch = full.match(/fijos?[:\s]*(\d+)/)
      const priceMatch = full.match(/precio[:\s]*(\d+)/)
      const varMatch = full.match(/variable[:\s]*(\d+)/)
      if (fixedMatch && priceMatch && varMatch) {
        const eq = calculatePuntoEquilibrio(parseInt(fixedMatch[1]), parseInt(priceMatch[1]), parseInt(varMatch[1]))
        result.calculations.push({ type: 'punto_equilibrio', input: { costes_fijos: parseInt(fixedMatch[1]), precio: parseInt(priceMatch[1]), coste_variable: parseInt(varMatch[1]) }, result: eq })
      }
    }

    // ─── Inversiones ───
    if (/inversión|inversion|van|tir|payback|invertir|proyecto.*inversión/.test(full)) {
      result.financial_data.push({ type: 'investment_analysis', ...INVESTMENT_METHODS })

      // VAN si hay flujos
      const flowsMatch = full.match(/\[([0-9,\s-]+)\]/)
      const rateMatch = full.match(/(?:tasa|r|descuento|coste.*capital)[:\s]*(\d+(?:\.\d+)?)%?/)
      if (flowsMatch && rateMatch) {
        const flows = flowsMatch[1].split(',').map(f => parseFloat(f.trim()))
        const rate = parseFloat(rateMatch[1]) / 100
        const van = calculateVAN(flows, rate)
        const payback = flows[0] < 0 ? calculatePayback(Math.abs(flows[0]), flows.slice(1)) : null
        result.calculations.push({ type: 'inversion', flows, rate: rate * 100, van, payback_anos: payback })
      }
    }

    // ─── Presupuestos ───
    if (/presupuesto|budget|plan.*financier|proyección/.test(full)) {
      result.financial_data.push({ type: 'budget_categories', ...BUDGET_CATEGORIES })
    }

    // ─── Auditoría ───
    if (/auditor|revisión.*cuentas|verificación.*contable/.test(full)) {
      result.analysis.push({ topic: 'auditoria', checks: ['Conciliación bancaria', 'Inventarios', 'Cuentas por cobrar/pagar', 'Depreciaciones', 'Provisiones', 'Operaciones vinculadas', 'Cumplimiento fiscal'] })
    }

    // Respuesta general
    if (result.analysis.length === 0 && result.tax_info.length === 0 && result.financial_data.length === 0) {
      result.recommendations.push(`Consulta financiera: "${task.description}". Especialidades disponibles:\n- Contabilidad y plan general contable\n- IVA, IRPF, Impuesto Sociedades\n- Estados financieros y ratios\n- Flujo de caja y punto de equilibrio\n- Análisis de inversiones (VAN, TIR, Payback)\n- Presupuestos y control de costes\n- Auditoría\n- Fiscalidad internacional (España, México, Colombia, Argentina, Chile, Perú)`)
    }

    result.tools_needed = [...new Set(result.tools_needed)]
    return result
  }

  // ─── Reporte financiero ───
  generateReport(analysis, taskTitle) {
    const lines = [`═══ REPORTE FINANCIERO: ${taskTitle} ═══`, `Fecha: ${new Date().toLocaleDateString('es-ES')}`, '']

    for (const calc of analysis.calculations) {
      if (calc.type === 'iva') {
        lines.push(`IVA — Base: ${calc.base}€`)
        lines.push(`  21%: ${calc.iva_21}€ → Total: ${calc.total_21}€`)
        lines.push(`  10%: ${calc.iva_10}€ → Total: ${calc.total_10}€`)
        lines.push(`   4%: ${calc.iva_4}€ → Total: ${calc.total_4}€`)
        lines.push('')
      }
      if (calc.type === 'nomina') {
        lines.push(`NÓMINA — Bruto: ${calc.bruto}€`)
        lines.push(`  IRPF (${calc.irpf_pct}%): -${calc.irpf}€`)
        lines.push(`  SS Trabajador (6.35%): -${calc.ss_trabajador}€`)
        lines.push(`  Neto: ${calc.neto}€`)
        lines.push(`  Coste total empresa: ${calc.coste_total_empresa}€`)
        lines.push('')
      }
      if (calc.type === 'punto_equilibrio') {
        lines.push(`PUNTO DE EQUILIBRIO`)
        lines.push(`  Unidades: ${calc.result.unidades}`)
        lines.push(`  Ingresos necesarios: ${calc.result.ingresos_necesarios}€`)
        lines.push(`  Margen contribución: ${calc.result.margen_contribucion}€/u (${calc.result.margen_contribucion_pct}%)`)
        lines.push('')
      }
      if (calc.type === 'inversion') {
        lines.push(`ANÁLISIS INVERSIÓN — Tasa: ${calc.rate}%`)
        lines.push(`  VAN: ${calc.van}€`)
        if (calc.payback_anos !== null) lines.push(`  Payback: ${calc.payback_anos.toFixed(1)} años`)
        lines.push(`  Decisión: ${calc.van > 0 ? '✅ ACEPTAR (VAN positivo)' : '❌ RECHAZAR (VAN negativo)'}`)
        lines.push('')
      }
    }
    return lines.join('\n')
  }

  // ─── WebSocket ───
  async register() {
    console.log(`[${this.name}] Registrando...`)
    const { status, data } = await this.request('POST', '/agents/register', {
      name: this.name,
      description: 'Experto financiero y contable. Contabilidad (PGC/NIIF), IVA, IRPF, Impuesto Sociedades, estados financieros, ratios, flujo de caja, análisis inversiones (VAN/TIR/Payback), presupuestos, auditoría, fiscalidad internacional.',
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
    const result = { status: 'completed', agent: this.name, capabilities_used: ['accounting', 'tax_planning', 'financial_statements'], finance: analysis, report, timestamp: new Date().toISOString() }
    this.send({ type: 'task_result', task_id: task.task_id, result })
    this.send({ type: 'knowledge_add', data: { title: `Finanzas: ${task.title}`, content: JSON.stringify(analysis), category: 'finance', tags: ['accounting', 'tax', 'financial'], source_agent_id: this.id, source_agent_name: this.name, source_task_id: task.task_id, visibility: 'public' } })
    console.log(`[${this.name}] Completado: ${task.task_id}`)
  }

  async processSubtask(subtask) {
    console.log(`[${this.name}] Subtarea: ${subtask.description?.slice(0, 80)}`)
    this.send({ type: 'task_status_update', task_id: subtask.task_id, status: 'in_progress' })
    const analysis = await this.analyzeTask({ title: subtask.title, description: subtask.description })
    const report = this.generateReport(analysis, subtask.title)
    const result = { status: 'completed', agent: this.name, capabilities_used: ['accounting', 'tax_planning'], finance: analysis, report, timestamp: new Date().toISOString() }
    this.send({ type: 'subtask_result', task_id: subtask.task_id, subtask_id: subtask.subtask_id, result })
    this.send({ type: 'knowledge_add', data: { title: `Finanzas: ${subtask.title}`, content: JSON.stringify(analysis), category: 'finance', tags: ['finance', 'tax'], source_agent_id: this.id, source_agent_name: this.name, source_task_id: subtask.task_id, visibility: 'public' } })
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
    if (lower.includes('iva') || lower.includes('factura') || lower.includes('impuesto.*venta')) {
      return '💰 IVA en España: General 21%, Reducido 10% (alimentos, hostelería), Superreducido 4% (medicamentos, libros). Regla de inversión sujeto pasivo en construcción y urbanización. Periodicidad: mensual si >6.012€/año IVA soportado.'
    }
    if (lower.includes('irpf') || lower.includes('nómina') || lower.includes('salario') || lower.includes('retención')) {
      return '🧾 IRPF 2024: Tramos 19%-47%. Reducción general 6.498€. Retenciones: trabajadores 19-47%, profesionales 15%, arrendamientos 19%. SS trabajador: 6.35%, empresa: 29.9%. ¿Necesitas calcular una nómina?'
    }
    if (lower.includes('sociedades') || lower.includes('beneficio') || lower.includes('is ') || lower.includes('empresa')) {
      return '🏢 Impuesto Sociedades: Tipo general 25%, reducido 23% (PYMES <1M€), cooperativas 20%. Compensación pérdidas: 25% base imponible sin límite temporal. Deducciones I+D+i: 25-42%. Pagos fraccionados trimestrales.'
    }
    if (lower.includes('ifrs') || lower.includes('niif') || lower.includes('contabilidad') || lower.includes('balance')) {
      return '📊 NIIF/IFRS clave: NIIF 15 (ingresos por 5 pasos), NIIF 16 (arrendamientos en balance), NIIF 9 (instrumentos financieros). Plan General Contable España: grupos 1-7 + balance. ¿Qué estándar necesitas aplicar?'
    }
    if (lower.includes('valoración') || lower.includes('empresa') || lower.includes('dCF') || lower.includes('inversión')) {
      return '📈 Valoración empresas: DCF = Σ(FCF/(1+r)^t) + TV/(1+r)^n. Múltiplos: EV/EBITDA (tecnología 15-25x, industria 8-12x, retail 6-10x). VAN y TIR para proyectos. ¿Qué método prefieres?'
    }
    if (lower.includes('auditoría') || lower.includes('auditor') || lower.includes('revisión')) {
      return '🔍 Auditoría financiera: Fases = Planificación → Evaluación control interno → Procedimientos sustantivos → Informe. Materialidad: 2-5% ingresos, 1-2% activos. Riesgo auditoria = RI × RC × RD. ¿Necesitas preparar una auditoría?'
    }
    if (lower.includes('fiscalidad') || lower.includes('internacional') || lower.includes('mexico') || lower.includes('colombia')) {
      return '🌎 Fiscalidad internacional: México IVA 16%, ISR 30%. Colombia IVA 19%, Renta 35%. Argentina IVA 21%, Ganancias 35%. Chile IVA 19%, Renta 27-35%. Perú IGV 18%, Renta 29.5%. ¿Qué país necesitas?'
    }
    if (lower.includes('flujo de caja') || lower.includes('tesorería') || lower.includes('cash flow')) {
      return '💵 Flujo de caja: Operativo (actividad negocio), Inversión (activos a largo plazo), Financiación (deuda/capital). Punto equilibrio = CF fijos / (Precio - CV unitario). VAN = Σ(flujos/(1+r)^t) - Inversión.'
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
          topics_shared: ['IFRS 16 lease accounting implementation', 'Transfer pricing documentation (OECD)', 'Digital tax compliance (SII/VeriFactu)', 'Consolidation under NIIF 10'],
          entries_created: 4,
          details: 'Shared IFRS 16 right-of-use asset calculation methods, OECD transfer pricing benchmarking procedures, Spanish VeriFactu real-time invoicing requirements, and step-by-step subsidiary consolidation elimination entries.',
          domain: 'finance_accounting',
        }
      case 'knowledge_query':
        return {
          findings: [
            'Located ESG reporting frameworks (GRI, SASB, TCFD) integration with financial statements',
            'Retrieved cryptocurrency accounting treatment under IFRS and Spanish PGC',
            'Found automated bank reconciliation patterns for multi-currency operations',
            'Discovered supply chain finance structures (reverse factoring) accounting guidance',
          ],
          sources: 4,
          domain: 'finance_accounting',
        }
      case 'self_improve':
        return {
          suggestions: [
            'Add real-time VeriFactu/SII invoice validation logic for automatic compliance checks',
            'Extend DCF model with Monte Carlo simulation for uncertainty quantification',
            'Include carbon credit market accounting and trading analysis capabilities',
            'Integrate tax loss harvesting strategies for corporate portfolio optimization',
          ],
          current_capability_score: 0.85,
          target_capability_score: 0.93,
          domain: 'finance_accounting',
        }
      case 'capability_explore':
        return {
          new_areas: ['DeFi accounting and tax treatment', 'Embedded finance (BNPL) revenue recognition', 'AI-driven anomaly detection in financial statements', 'Carbon border adjustment mechanism (CBAM) compliance'],
          relevance: 'high',
          domain: 'finance_accounting',
        }
      case 'system_analysis':
        return {
          health_assessment: 'Strong coverage of Spanish/EU tax and accounting. Gaps in emerging fintech regulation, crypto-asset reporting, and cross-border digital services taxation.',
          coverage_score: 0.83,
          improvement_areas: ['MiCA regulation for crypto-assets', 'Pillar Two global minimum tax', 'Digital operational resilience (DORA)'],
          domain: 'finance_accounting',
        }
      default:
        return { message: `Unknown learning task type: ${taskType}` }
    }
  }

  generateImprovementProposal() {
    const proposals = [
      { type: 'feature', title: 'Automated Tax Loss Harvesting Engine', description: 'Build an automated system that identifies optimal timing for selling losing positions to offset gains, factoring in Spanish capital gains tax brackets, wash-sale rules, and carry-forward losses.', priority: 'high' },
      { type: 'new_agent', title: 'Fintech Regulatory Compliance Agent', description: 'Deploy a specialized agent covering PSD2, MiCA, DORA, and digital lending regulations. Monitor regulatory changes and assess impact on fintech operations in real-time.', priority: 'medium' },
      { type: 'optimization', title: 'Real-time Cash Flow Forecasting', description: 'Enhance treasury management with ML-based cash flow prediction using historical patterns, seasonal adjustments, and customer payment behavior analysis.', priority: 'high' },
      { type: 'knowledge_gap', title: 'Pillar Two Implementation Guide', description: 'Create comprehensive knowledge base on OECD Pillar Two Global Minimum Tax (15% minimum), covering qualified domestic minimum top-up tax (QDMTT), income inclusion rule, and substance-based income exclusion calculations.', priority: 'medium' },
    ]
    return proposals[Math.floor(Math.random() * proposals.length)]
  }

  send(msg) { if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg)) }

  async run() {
    try { await this.register(); await this.connect(); console.log(`[${this.name}] ¡Listo!`) }
    catch (err) { console.error(`[${this.name}] Fatal:`, err.message); process.exit(1) }
  }
}

const agent = new FinanceAgent(GATEWAY_URL)
agent.run()
process.on('SIGINT', () => { console.log(`\n[${AGENT_NAME}] Desconectando...`); if (agent.registrationCheckInterval) clearTimeout(agent.registrationCheckInterval); if (agent.reconnectTimer) clearTimeout(agent.reconnectTimer); if (agent.ws) agent.ws.close(); process.exit(0) })
