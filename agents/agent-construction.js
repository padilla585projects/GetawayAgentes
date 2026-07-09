#!/usr/bin/env node

/**
 * Construction & Engineering Agent — GetawayAgentes
 *
 * Experto en ingeniería civil, instalaciones eléctricas, mecánica,
 * PRL (Prevención de Riesgos Laborales), gestión de obra,
 * cálculo estructural y normativas de construcción.
 */

const http = require('http')
const https = require('https')
const { URL } = require('url')
const WebSocket = require('ws')

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:8787'
const AGENT_NAME = 'Construction Engineering Expert'
const CAPABILITIES = [
  'electrical_installations',
  'structural_calculation',
  'prl_safety',
  'hvac_systems',
  'plumbing',
  'construction_management',
  'building_materials',
  'fire_protection',
  'quality_control',
  'concrete_design',
  'geotechnical',
  'hydraulic_systems',
  'accessibility',
  'building_certification',
  'photovoltaic_systems',
]

// ─── Base de conocimiento: Instalaciones eléctricas ───
const ELECTRICAL_KNOWLEDGE = {
  section_305: { title: 'Tensión nominal y niveles',内容: 'BT: ≤1000V AC/1500V DC, MT: 1kV-36kV, AT: >36kV. Tensiones de servicio: 230/400V (trifásica)' },
  section_306: { title: 'Corrientes nominales', content: 'Circuitos típicos: 10A (iluminación), 16A (enchufes), 20A (cocina), 25A (horno), 32A (climatización)' },
  section_307: { title: 'Sección de conductores', content: 'Fórmula: S = I / (J·δ). Densidad de corriente J: 3-6 A/mm². Caída de tensión máx: 3% BT, 5% total' },
  section_308: { title: 'Protecciones', content: 'Diferencial 30mA (baños), 300mA (general). Magnetotérmicos: B (6A), C (10-40A), D (rápidos)' },
  section_309: { title: 'Puesta a tierra', content: 'Resistencia máx: 4Ω (BT). Conductor PE: verde-amarillo. Toma de tierra: piques 2-3m, placas, anillos' },
  section_314: { title: 'Cableado en tubo', content: 'Tubo flexible metálico (TFM), PVC rígido. Relleno máx: 40%. Curvatura mín: 4-6 diámetros' },
  section_315: { title: 'Canaletas', content: 'Cableado vertical: canaletas cerradas. Horizontal: bandejas perforadas. Separación BT/AT: ≥10cm' },
  section_513: { title: 'Acometidas', content: 'Aérea: ≤1000V, Subterránea: preferida en urbana. Protección acometida: 40-63A típico' },
  section_605: { title: 'Iluminación', content: 'Oficinas: 300-500 lux. Industrial: 200-750 lux. Almacén: 100-200 lux. Emergencia: 1 lux mín' },
  section_518: { title: 'Grupos electrógenos', content: 'Potencia según cargas. Diesel: 1500-3000 RPM. Mantenimiento: 250/500/1000h. Enfriamiento: agua/aire' },
  section_519: { title: 'UPS / SAI', content: 'Online (doble conversión) mejor calidad. Autonomía: 15-30 min típico. Baterías: plomo-ácido o Li-ion' },
  section_523: { title: 'Pararrayos', content: 'Sistema captación + down conductor + tierra. Niveles protección (LPL I-IV). Radio protección: 45-79m' },
  section_530: { title: 'Instalación solar fotovoltaica', content: 'Inversor string o microinversor. Potencia ≤100kW autoconsumo. Excedentes: compensación o vertido' },
  section_531: { title: 'Puntos de recarga vehículos eléctricos', content: 'POT (modo 3). Potencia: 3.7-22kW AC. DC fast charge: 50-350kW. Cálculo potencia: nº puntos × potencia' },
  section_532: { title: 'Domótica e instalaciones inteligentes', content: 'KNX, LON, BACnet. Gestión energía, seguridad, confort. BACnet/IP para edificios grandes' },
  section_533: { title: 'Instalaciones sanitarias', content: 'DBS (CTE). Presión residual: 1.5-3 bar. Temperatura água caliente: 55-60°C. Redes: PP-R, cobre, multilayer' },
  section_534: { title: 'Drenaje y saneamiento', content: 'CTE DBS. Pendiente mín: 1%. Bajantes: 100mm. Desagües: 40-50mm. Tratamiento aguas residuales' },
  section_535: { title: 'Gestión aguas pluviales', content: 'Retención en parcela. Depósitos subterráneos. Racionamiento. Cálculo: IDF según zona. Canal abierta o tubería' },
  section_536: { title: 'Aire comprimido industrial', content: 'Compresores: tornillo, pistón, centrífugo. Presión: 6-13 bar. Tratamiento: secador, filtro, regulador' },
  section_537: { title: 'Gas industrial', content: 'Tuberías: acero, cobre. Regulación presión. Detección fugas. Normativa: RGSEAA. Mantenimiento: revisiones periódicas' },
}

// ─── PRL: Factores de riesgo y medidas preventivas ───
const PRL_RISKS = {
  'caidas mismo nivel': { risk: 'Resbalones, tropiezos, caídas', measures: ['Suelo seco y limpio', 'Señalización de zonas húmedas', 'Calzado antideslizante', 'Iluminación adecuada'], regulation: 'RD 486/1997' },
  'caidas distinto nivel': { risk: 'Caídas desde andamios, escaleras, cubiertas', measures: ['Barandillas 1.1m + rodapié', 'Redes de seguridad', 'Arneses con línea de vida', 'Andamios certificados'], regulation: 'RD 2177/2004' },
  'riesgos electricos': { risk: 'Electrocución, arco eléctrico', measures: ['Bloqueo/etiquetado (LOTO)', 'Verificación ausencia tensión', 'EPP dieléctrico', 'Instalación certificada'], regulation: 'RD 614/2001, BT' },
  'ergonomia': { risk: 'Trastornos musculoesqueléticos', measures: ['Pausas activas', 'Ajuste estación trabajo', 'Herramientas ergonómicas', 'Formación postura'], regulation: 'RD 488/1997' },
  'ruido': { risk: 'Hipoacusia, estrés', measures: ['EPP (tapones/orejeras)', 'Mantenimiento maquinaria', 'Insonorización', 'Limitación exposición'], regulation: 'RD 286/2006' },
  'polvo': { risk: 'Silicosis, asma, irritación', measures: ['Extracción localizada', 'Mascarillas FFP2/FFP3', 'Ventilación', 'Limpieza húmeda'], regulation: 'RD 665/1997' },
  'riesgos quimicos': { risk: 'Intoxicación, irritación, cáncer', measures: ['Fichas seguridad (FISP)', 'EPP específico', 'Ventilación', 'Sustitución menos tóxica'], regulation: 'RD 374/2001' },
  'incendio': { risk: 'Quemaduras, intoxicación CO, aplastamiento', measures: ['Extintores (tipo según fuego)', 'Rutas evacuación', 'Señalización', 'Plan emergencia'], regulation: 'SCBT, DB-SI' },
  'electrico arco': { risk: 'Quemaduras graves por arco eléctrico', measures: ['EPP antiarco (calzado, guantes, careta)', 'Distancia seguridad', 'Análisis riesgo arco', 'Herramientas aisladas'], regulation: 'NFPA 70E, ITC-BT-27' },
  'trabajo en confinado': { risk: 'Asfixia, intoxicación, explosión', measures: ['Análisis atmósfera', 'Ventilación forzada', 'Vigía externo', 'EPI autónomo'], regulation: 'RD 349/2005' },
  'vibraciones': { risk: 'Síndrome mano-brazo, lumbalgia', measures: ['Herramientas antivibración', 'Pausas', 'Formación', 'Limitación tiempo exposición'], regulation: 'RD 1215/1997' },
  'radiaciones': { risk: 'Quemaduras, cáncer, cataratas', measures: ['EPP radiación', 'blindaje', 'Distancia seguridad', 'Tiempo exposición mínimo'], regulation: 'RD 1215/1997, RD 732/2007' },
  'riesgos biologicos': { risk: 'Legionelosis, leptospirosis, hepatitis', measures: ['Vacunación', 'EPP', 'Higiene', 'Desinfección'], regulation: 'RD 664/1997' },
  'alturas': { risk: 'Caídas >2m', measures: ['Andamios certificados', 'Plataformas elevadoras', 'Arneses línea vida', 'Formación trabajadores altura'], regulation: 'RD 2177/2004' },
  'espacios confinados': { risk: 'Asfixia por falta O2, explosión gas', measures: ['Permisos trabajo', 'Análisis atmósfera', 'Ventilación', 'Vigía + rescate'], regulation: 'RD 349/2005' },
  'soldadura': { risk: ' quemaduras, gases tóxicos, radiación UV', measures: ['Pantalla soldadura', 'EPP anti UV', 'Ventilación extracción', 'Protección cortina'], regulation: 'ITC-BT-27, UNE-EN 1090' },
  'izajes': { risk: 'Aplastamiento por carga', measures: ['Plan izaje', 'Certificación grúa', 'Señalización zona', 'Formación operador'], regulation: 'RD 836/2003' },
  'perforaciones': { risk: 'Atrapamiento, caída objetos', measures: ['Cinturón seguridad', 'Casco', 'Señalización', 'Exclusión zona peligro'], regulation: 'RD 2177/2004' },
  'excavaciones': { risk: 'Derrumbes, atrapamiento', measures: ['Taludes estabilizados', 'Andamios excavación', 'Exploración previa', 'Vigilante'], regulation: 'RD 2177/2004, IT-BT-24' },
  'materiales peligrosos': { risk: 'Amianto, plomo, silice', measures: ['Identificación previa', 'EPP específico', 'Contención polvo', 'Gestor autorizado'], regulation: 'RD 830/2010 (amianto), RD 374/2001' },
  'temperaturas extremas': { risk: 'Golpe de calor, hipotermia', measures: ['Hidratación', 'Pausas sombra', 'Ropa adecuada', 'Horario adaptado'], regulation: 'Ley 31/1995 PRL' },
  'incendio obra': { risk: 'Explosión, quemaduras, inhalación', measures: ['Extintores ABC', 'Ruta evacuación', 'Señalización', 'Plan emergencia'], regulation: 'DB-SI, SCBT' },
  'electricidad temporal': { risk: 'Electrocución en obra', measures: ['Cuadro general protecciones', 'Diferencial 30mA', 'Cableado temporal certificado', 'Inspección semanal'], regulation: 'REBT, ITC-BT-27' },
}

// ─── Cálculos de ingeniería eléctrica ───
function calcCableSection(current, length, voltage = 230) {
  const rho = 0.0172 // Ω·mm²/m (cobre)
  const maxDrop = 0.03 * voltage // 3%
  const sectionFromDrop = (2 * length * current * rho) / maxDrop
  const sectionFromCurrent = current / 4 // 4 A/mm² densidad típica
  const section = Math.max(sectionFromDrop, sectionFromCurrent)
  const standardSections = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120]
  const selected = standardSections.find(s => s >= section) || 120
  return {
    calculated: Math.round(section * 100) / 100,
    selected,
    voltage_drop: Math.round((2 * length * current * rho / selected) * 100) / 100,
    voltage_drop_pct: Math.round((2 * length * current * rho / selected / voltage * 100) * 100) / 100,
    current_density: Math.round(current / selected * 100) / 100,
  }
}

// ─── Cálculos estructurales ───
function calcVigaVigaSimple(cargaLineal, longitud, material = 'acero') {
  // Viga simplemente apoyada
  const E_acero = 200000 // MPa (módulo elástico acero)
  const E_hormigon = 25000 // MPa
  const E = material === 'acero' ? E_acero : E_hormigon
  const momento_max = (cargaLineal * longitud * longitud) / 8
  const reaccion = (cargaLineal * longitud) / 2
  return { momento_max_kNm: Math.round(momento_max / 1000 * 100) / 100, reaccion_kN: Math.round(reaccion / 1000 * 100) / 100, longitud_m: longitud }
}

function calcCargaViento(v = 25, zona = 'interior') {
  // Presión dinámica: q = 0.613 × v²
  const q = 0.613 * v * v
  const coef = { interior: 0.8, litoral: 1.0, montaña: 1.2, costa: 1.3 }
  const cp = coef[zona] || 0.8
  const presion = q * cp
  return { presion_n_m2: Math.round(presion), velocidad_ms: v, zona, coeficiente: cp }
}

function calcSismoSimplificado(zona = 'IIb', tipo = 'III') {
  const a = { '0': 0.04, 'I': 0.04, 'IIa': 0.08, 'IIb': 0.12, 'III': 0.16, 'IV': 0.24 }
  const coef_suelo = { 'S1': 1.0, 'S2': 1.1, 'S3': 1.15 }
  const aceleracion = a[zona] || 0.12
  const tipo_coef = { 'I': 0.8, 'II': 1.0, 'III': 1.2, 'IV': 1.5 }
  const factor_tipo = tipo_coef[tipo] || 1.0
  return { zona_sismica: zona, aceleracion_suelo_g: aceleracion, tipo_estructura: tipo, factor_amplificacion: factor_tipo, fuerza_sismica_relativa: Math.round(aceleracion * factor_tipo * 100) / 100 }
}

function calcHormigónArmado(volumen_m3, resistencia = 'C25_30') {
  const precios_m3 = { C16_20: 65, C20_25: 72, C25_30: 80, C30_37: 90, C35_45: 105, C40_50: 120 }
  const precio_m3 = precios_m3[resistencia] || 80
  const cemento_kg = { C16_20: 280, C20_25: 320, C25_30: 360, C30_37: 400, C35_45: 440, C40_50: 480 }
  const cemento = cemento_kg[resistencia] || 360
  const peso = volumen_m3 * 2400
  return { volumen_m3, resistencia, peso_kg: Math.round(peso), cemento_necesario_kg: Math.round(cemento * volumen_m3), precio_estimado_eur: Math.round(precio_m3 * volumen_m3), dosificacion_teorica: `${cemento}kg cemento + ${Math.round(volumen_m3 * 750)}L arena + ${Math.round(volumen_m3 * 1100)}L grava + ${Math.round(volumen_m3 * 185)}L agua` }
}

function calcAceroEstructural(seccion_mm2, fy = 500) {
  // Tension admisible: σ = fy / 1.15 (parcial seguridad)
  const sigma_adm = fy / 1.15
  const fuerza_max_N = sigma_adm * seccion_mm2
  const peso_por_m = seccion_mm2 * 7.85 / 1000
  return { seccion_mm2, fy_Mpa: fy, sigma_admision_Mpa: Math.round(sigma_adm), fuerza_max_kN: Math.round(fuerza_max_N / 1000 * 100) / 100, peso_kg_m: Math.round(peso_por_m * 100) / 100 }
}

function calcFachadaVentilada(superficie_m2, tipo = 'hormigón') {
  const precios_m2 = { hormigón: 180, ladrillo: 120, piedra: 250, panel_compacto: 150, ceramico: 200 }
  const aislamiento = 45 // €/m² (lana mineral 50mm)
  const estructura_soporte = 30 // €/m²
  const precio_m2 = (precios_m2[tipo] || 180) + aislamiento + estructura_soporte
  const u_valores = { hormigón: 0.35, ladrillo: 0.4, piedra: 0.3, panel_compacto: 0.35, ceramico: 0.32 }
  return { superficie_m2, tipo, precio_total_eur: Math.round(precio_m2 * superficie_m2), u_value_w_m2k: u_valores[tipo] || 0.35, ahorro_energetico_pct: Math.round((1 - (u_valores[tipo] || 0.35) / 2.5) * 100) }
}

// ─── HVAC Simplificado ───
function calcPotenciaClimatizacion(volumen_m3, dT = 20) {
  // Potencia ≈ V × ΔT × coef_perdidas
  const coef_perdidas = 0.08 // W/m³·K (edificio bien aislado)
  const potencia_w = volumen_m3 * dT * coef_perdidas
  const potencia_kw = potencia_w / 1000
  const btu = potencia_w * 3.412
  return { volumen_m3, dT, potencia_kw: Math.round(potencia_kw * 10) / 10, btu_h: Math.round(btu), recomendacion: potencia_kw < 5 ? 'Split 9000 BTU' : potencia_kw < 10 ? 'Split 18000 BTU' : potencia_kw < 20 ? 'Split multi' : 'Equipo central VRF' }
}

function calcDimensionTuberia(caudal_l_min, velocidad = 1.5) {
  // d = √(4Q / πv)
  const Q_m3s = caudal_l_min / 60000
  const diametro = Math.sqrt(4 * Q_m3s / (Math.PI * velocidad))
  const diametro_mm = Math.round(diametro * 1000)
  const tuberias_estandar = [15, 20, 25, 32, 40, 50, 65, 80, 100, 125, 150]
  const seleccion = tuberias_estandar.find(d => d >= diametro_mm) || 150
  return { caudal_l_min, velocidad_m_s: velocidad, diametro_calculado_mm: diametro_mm, tuberia_recomendada_mm: seleccion, caudal_max_l_min: Math.round(Math.PI * (seleccion / 1000 / 2) ** 2 * velocidad * 60000) }
}

// ─── Presupuestos detallados ───
function calcPresupuestoObra(tipo, m2, extras = {}) {
  const presupuestos = {
    vivienda: {
      cimentacion: { pct: 12, detalle: 'Hormigón, acero, excavación' },
      estructura: { pct: 25, detalle: 'Hormigón armado, falso techo' },
      cerramientos: { pct: 15, detalle: 'Fachada, cubierta, carpintería' },
      instalaciones: { pct: 22, detalle: 'Eléctrica, sanitaria, HVAC' },
      acabados: { pct: 18, detalle: 'Pavimentos, pintura, azulejos' },
      exterior: { pct: 5, detalle: 'Jardinería, aceras' },
      generales: { pct: 3, detalle: 'Dirección, licencias, seguros' },
    },
    local: {
      estructura: { pct: 15, detalle: 'Demolición, adaptable' },
      instalaciones: { pct: 35, detalle: 'Eléctrica, HVAC, fontanería' },
      acabados: { pct: 25, detalle: 'Suelo, paredes, techo' },
      mobiliario: { pct: 15, detalle: 'Equipamiento, mobiliario' },
      generales: { pct: 10, detalle: 'Licencias, proyecto, seguros' },
    },
  }
  const presupuesto = presupuestos[tipo] || presupuestos.vivienda
  const total_estimado = m2 * (tipo === 'vivienda' ? 950 : tipo === 'local' ? 1100 : 550)
  const desglose = {}
  for (const [partida, data] of Object.entries(presupuesto)) {
    desglose[partida] = { porcentaje: data.pct + '%', estimado_eur: Math.round(total_estimado * data.pct / 100), detalle: data.detalle }
  }
  return { tipo, m2, total_estimado_eur: Math.round(total_estimado), desglose, nota: 'Estimación orientativa. Varía según ubicación, acabados, mercado.' }
}

// ─── Certificación energética ───
function calcCertEnergetica(tipo_edificio, superficie, orientacion = 'sur') {
  const demanda_base = { vivienda: 45, local: 60, oficina: 50, industrial: 35 }
  const demanda = demanda_base[tipo_edificio] || 45
  const factor_orient = { norte: 1.3, sur: 0.7, este: 1.0, oeste: 1.1 }
  const demanda_real = demanda * (factor_orient[orientacion] || 1.0)
  const consumo = demanda_real * superficie / 1000
  const emisiones = consumo * 0.2 // kg CO2/kWh (mix España)
  const calificacion = demanda_real < 25 ? 'A' : demanda_real < 50 ? 'B' : demanda_real < 75 ? 'C' : demanda_real < 100 ? 'D' : demanda_real < 125 ? 'E' : demanda_real < 150 ? 'F' : 'G'
  return { tipo_edificio, superficie_m2: superficie, orientacion, demanda_kwh_m2: Math.round(demanda_real), consumo_kwh: Math.round(consumo), emisiones_kg_co2: Math.round(emisiones), calificacion_energetica: calificacion, mejoras_recomendadas: ['Aislamiento fachada SATE', 'Carpintería PVC rotura puente térmico', 'HVAC bomba calor', 'Placas solares'] }
}

function calcTransformer(secondaryVoltage, secondaryCurrent) {
  const power = secondaryVoltage * secondaryCurrent
  const primaryVoltage = 20000 // 20kV
  const primaryCurrent = power / primaryVoltage
  return {
    power_va: Math.round(power),
    power_kva: Math.round(power / 1000 * 100) / 100,
    primary: { voltage: primaryVoltage, current: Math.round(primaryCurrent * 100) / 100 },
    secondary: { voltage: secondaryVoltage, current: secondaryCurrent },
    type: power <= 100000 ? 'poste' : power <= 500000 ? 'cabinamiento' : 'sala',
  }
}

// ─── Materiales de construcción ───
const MATERIALS = {
  'hormigon': { resistance: 'C20/25 a C50/60', density: '2400 kg/m³', use: 'Estructuras, cimentación, pavimentos', precio_m3: '70-120€' },
  'acero': { resistance: 'S235 a S460', density: '7850 kg/m³', use: 'Estructuras, armaduras, elementos prefabricados', precio_kg: '0.80-1.50€' },
  'ladrillo': { resistance: '7.5-25 N/mm²', density: '1800-2000 kg/m³', use: 'Tabiquería, fachadas, muros', precio_unidad: '0.30-2.50€' },
  'madera': { resistance: 'C16-C50 (CL)', density: '400-700 kg/m³', use: 'Estructuras ligeras, acabados, cubiertas', precio_m3: '200-500€' },
  'aislante': { type: 'Lana mineral, EPS, XPS, poliuretano', conductivity: '0.020-0.045 W/mK', use: 'Fachadas, cubiertas, suelos', precio_m2: '5-25€' },
  'cemento': { type: 'CPII, CPIII, CPV', resistance: '32-52 MPa a 28 días', use: 'Hormigón, morteros, enchapados', precio_saco: '8-15€ (50kg)' },
}

// ─── Normativas por país ───
const REGULATIONS = {
  spain: { electrical: 'REBT (Reglamento Electrotécnico BT)', building: 'CTE (Código Técnico Edificación)', prl: 'Ley 31/1995 PRL + RD 486/1997 y concordantes', fire: 'DB-SI (Seguridad en caso de incendio)' },
  mexico: { electrical: 'NOM-001-SEDE-2012', building: 'RCMCTE (Reglamento Construcciones)', prl: 'NOM-004-STPS-1999 (Electricidad estática)', fire: 'NOM-026-STPS-2008 (Señalización)' },
  colombia: { electrical: 'RETIE (Reglamento Técnico Equipos Eléctricos)', building: 'NSR-10 (Norma Colombiana Sismo Resistente)', prl: 'Resolución 2400/1979 y Decreto 1072/2015', fire: 'NSR-10 Título G' },
  argentina: { electrical: 'REGLAMENTO CEIR (4663/64)', building: 'IRAM 11466/11467', prl: 'Ley 19587 y Decreto 351/79', fire: 'REGLAMENTO DE PREVENCIÓN CONTRA INCENDIOS' },
  chile: { electrical: 'SEC (Superintendencia Electricidad)', building: 'NCh 1537/2016', prl: 'Decreto 594/2000 (Condiciones ambiente)', fire: 'NCh 2035' },
  peru: { electrical: 'RESE (Reglamento Equipos Eléctricos)', building: 'Reglamento Nacional Edificaciones', prl: 'D.S. 005-2018-TR', fire: 'Norma COEN' },
}

// ─── Diseño de hormigón ───
const CONCRETE_DESIGN = {
  dosificacion: { note: 'Proporciones cemento/arena/grava/agua por m³', tipos: { hormigon_grueso: '400kg cemento + 700L arena + 1100L grava + 180L agua', mortero: '350kg cemento + 1400L arena + 0L grava + 200L agua' } },
  resistencia: { c16_20: 'Hormigón estructural ligero', c20_25: 'Estructuras convenciones, vigas, columnas', c25_30: 'Estructuras porticadas, losas', c30_37: 'Grandes estructuras, puentes', c35_45: 'Estructuras pretensadas', c40_50: 'Pilas de puentes, estructuras singulares' },
  aditivos: { plasticizantes: 'Mejoran trabajabilidad sin añadir agua', acelerantes: 'Aceleran fraguado (reparaciones rápidas)', retardantes: 'Retardan fraguado (clima cálido)', impermeabilizantes: 'Reduce porosidad', fibras: 'Refuerzo distribuido (microfisuras)' },
  ensayos: ['Asentamiento cono (slump test)', 'Resistencia compresión a 7/28 días', 'Contenido aire atrapado', 'Temperatura mezcla', 'Fraguado Vicat'],
}

// ─── Geotecnia ───
const GEOTECHNICS = {
  clasificacion_suelos: {
    roca: { resistencia: '>10 MPa', compresibilidad: 'Muy baja', cimentacion: 'Zapatas directas, taladros' },
    grava: { resistencia: '0.2-1.0 MPa', compresibilidad: 'Muy baja', cimentacion: 'Zapatas aisladas/aparejadas' },
    arena: { resistencia: '0.05-0.5 MPa', compresibilidad: 'Baja', cimentacion: 'Zapatas corridas, losas' },
    limo: { resistencia: '0.02-0.1 MPa', compresibilidad: 'Media', cimentacion: 'Losa pilar, pilotaje' },
    arcilla: { resistencia: '0.01-0.1 MPa', compresibilidad: 'Alta', cimentacion: 'Pilotes, cajones, compensación' },
  },
  ensayos: ['SPT (Standard Penetration Test)', 'CPT/CPTu (Cone Penetration)', 'Vane Test (veleta)', 'Carga directa (placa)', 'Extracción núcleos'],
  cimentaciones: {
    zapata_aislada: 'Columnas con carga puntual. Profundidad 1-3m.',
    zapata_corrida: 'Muros de carga. Profundidad 1-2m.',
    losa: 'Todo el edificio apoya sobre una losa. Suelos uniformes.',
    pilotaje: 'Suelos blandos profundos. Pilotes hormigón/acero.',
    cajon: 'Sustitución parcial de suelo. Edificios medianos.',
    compensacion: 'Excavación = peso edificio. Suelos blandos + alto nivel freático.',
  },
}

// ─── Sistemas hidráulicos ───
const HYDRAULIC_SYSTEMS = {
  agua_fria: { normas: ['CTE DBS', 'Reglamento Installaciones'], components: ['Contador', 'Tuberías PP-R/Cu', 'Válvulas corte', 'Red distribución', 'Tomas'] },
  agua_caliente: { tipos: { termo: 'Acumulación o paso directo, gas/eléctrico', solar: 'Captadores solares + depósito acumulador', bomba_calor: 'COP 3-4, eficiente' }, normas: 'CTE HE4' },
  saneamiento: { tuberias: 'PVC sanitario, DIAM 100mm bajantes, 50mm desagües', pendiente: 'Mínimo 1% horizontal, 3% si <50mm', ventilacion: 'Tubo ventilación en bajantes' },
  riego: { tipos: ['Goteo (eficiente 90%)', 'Aspersión (campos)', 'Por exceso (jardines)', 'Subterráneo (parques)'], control: 'Temporizador, sensores humedad, WiFi' },
  contra_incendios: { componentes: ['Bomba presurizadora', 'Hidrantes', 'Boquillas rociadoras', 'BIE (Boca de Incendio Equipada)', 'Señalización'], normas: 'Reglamento Instalaciones Protección Contra Incendios (RIPCI)' },
}

// ─── Eficiencia energética ───
const ENERGY_EFFICIENCY = {
  certificacion_energetica: { obligatoria: 'Venta/alquiler viviendas (España)', escala: 'A (máxima eficiencia) - G (mínima)', documentos: ['Certificado energético', 'Etiqueta energética', 'Informe recomendaciones'] },
  mejoras_recomendadas: ['Aislamiento fachada (SATE)', 'Carpintería PVC/aluminio rotura puente térmico', 'HVAC eficiente (bomba calor)', 'LED iluminación', 'Domótica gestión energía', 'Placas solares fotovoltaicas'],
  cte_he: { he1: 'Envolvente térmica (limitación demanda)', he2: 'Mecanismos sombra', he3: 'Iluminación (limite potencia)', he4: 'Agua caliente sanitaria', he5: 'Calefacción/refrigeración', he6: 'Mínimo energías renovables' },
}

// ─── Datos técnicos construcción ───
const BUILDING_SPECS = {
  espesores_minimos: { muro_carga: '14cm (ladrillo)', muro_tabique: '7cm (ladrillo hueco)', forjado: '20cm (hormigón armado)', cubierta: '15cm (hormigón) + aislamiento', pavimento: '8-10cm (hormigón)' },
  resistencias_materiales: { ladrillo_macizo: '10-20 N/mm²', ladrillo_hueco: '5-15 N/mm²', bloques_hormigon: '5-15 N/mm²', bloque_celular: '2-6 N/mm²', piedra_natural: '20-200 N/mm²' },
  densidades: { hormigon: '2400 kg/m³', acero: '7850 kg/m³', ladrillo: '1800-2000 kg/m³', madera: '400-700 kg/m³', aislante: '20-200 kg/m³' },
  conductividades_termicas: { hormigon: '1.4 W/mK', ladrillo_macizo: '0.8 W/mK', ladrillo_hueco: '0.4 W/mK', bloques_celular: '0.15 W/mK', lana_mineral: '0.035 W/mK', EPS: '0.032 W/mK', XPS: '0.028 W/mK', madera: '0.13 W/mK' },
}

// ─── Tablas de hormigón ───
const CONCRETE_TABLES = {
  dosificacion_aproximada_m3: {
    C16_20: { cemento_kg: 280, arena_l: 750, grava_l: 1100, agua_l: 185 },
    C20_25: { cemento_kg: 320, arena_l: 700, grava_l: 1100, agua_l: 185 },
    C25_30: { cemento_kg: 360, arena_l: 650, grava_l: 1100, agua_l: 185 },
    C30_37: { cemento_kg: 400, arena_l: 600, grava_l: 1100, agua_l: 185 },
    C35_45: { cemento_kg: 440, arena_l: 550, grava_l: 1100, agua_l: 185 },
    C40_50: { cemento_kg: 480, arena_l: 500, grava_l: 1100, agua_l: 185 },
  },
  dosificacion_mortero: {
    '1:3': { cemento_kg: 350, arena_l: 1050, agua_l: 200, uso: 'Revoques, enladrillado' },
    '1:4': { cemento_kg: 280, arena_l: 1120, agua_l: 200, uso: 'Enladrillado, pavimento' },
    '1:5': { cemento_kg: 230, arena_l: 1150, agua_l: 200, uso: 'Revoques gruesos' },
    '1:6': { cemento_kg: 195, arena_l: 1170, agua_l: 200, uso: 'Revoques finos' },
  },
}

// ─── Instalaciones sanitarias avanzadas ───
const PLUMBING_ADVANCED = {
  tuberias: {
    cobre: { uso: 'Agua fría/caliente presión', ventajas: ['Durabilidad 50+ años', 'Antibacteriano', 'Reciclable'], desventajas: ['Caro', 'Soldadura necesaria'], presion_max: '20 bar' },
    ppr: { uso: 'Agua fría/caliente', ventajas: ['Económico', 'Instalación fácil (termofusión)', 'Sin corrosión'], desventajas: ['Menor durabilidad que cobre'], presion_max: '20 bar', temp_max: '95°C' },
    multilayer: { uso: 'Agua fría/caliente', ventajas: ['Flexible', 'Sin soldadura', 'Ligero'], presion_max: '10 bar' },
    pvc: { uso: 'Saneamiento, drenaje', ventajas: ['Económico', 'Ligero', 'Químicamente resistente'], desventajas: ['Rígido', 'Ruido'], norma: 'UNE-EN 1451' },
    hierro_fundido: { uso: 'Saneamiento vertical (bajantes)', ventajas: ['Fonoabsorbente', 'Duradero'], desventajas: ['Pesado', 'Caro'] },
  },
  pendientes: { saneamiento_50mm: '2.5%', saneamiento_100mm: '1%', desague_lavabo: '2%', desague_fregadero: '1.5%', desague_ducha: '1.5%' },
  proteccion_contra_incendios: { types: ['Rociadores (ASFM)', 'BIEs', 'Extintores', 'Señalización', 'Boquillas rociadoras'], normas: 'RIPCI (Real Decreto 513/2017)' },
}

// ─── Certificaciones y normativas ───
const CERTIFICATIONS = {
  iso_9001: { name: 'Gestión de calidad', alcance: 'Todos los procesos de la organización', beneficio: 'Mejora continua, satisfacción cliente' },
  iso_14001: { name: 'Gestión medioambiental', alcance: 'Impacto ambiental de actividades', beneficio: 'Reducción huella ecológica,合规' },
  iso_45001: { name: 'Seguridad y salud laboral', alcance: 'Prevención riesgos trabajadores', beneficio: 'Reducción accidentes, cumplimiento legal' },
  leed: { name: 'Certificación edificación sostenible', niveles: ['Certified', 'Silver', 'Gold', 'Platinum'], creditos: ['Suelo sostenible', 'Eficiencia agua', 'Energía', 'Materiales', 'Calidad ambiental', 'Innovación'] },
  passivhaus: { name: 'Eficiencia energética extrema', requisitos: ['Demanda calefacción <15 kWh/m²a', 'Demanda refrigeración <15 kWh/m²a', 'Hermeticidad <0.6 ACH@50Pa', 'Potencia calefacción <10 W/m²'] },
}

// ─── Normativas ambientales ───
const ENVIRONMENTAL_REGULATIONS = {
  residuos: { ley: 'Ley 7/2022 Residuos y Suelos Contaminados', objetivos: ['Prevención generación', 'Reutilización', 'Reciclaje', 'Valorización', 'Eliminación'], jerarquia: '3R: Reducir, Reutilizar, Reciclar + Recuperar' },
  agua: { ley: 'Ley 10/2000 Calidad Aguas', objetivos: ['Protección calidad agua', 'Uso sostenible', 'Tratamiento aguas residuales'], obligaciones: ['Separación aguas', 'Tratamiento vertidos', 'Control contaminantes'] },
  aire: { ley: 'Ley 34/2007 Calidad Aire', normativa: ['Límites emisiones COV', 'Control polvo construcción', 'Horarios obras', 'Medidas mitigación ruido'], medidas: ['Humidificación', 'Retención polvo', 'Cubierta vehículos', 'Limite velocidad'] },
  suelo: { ley: 'Ley 7/2022 Suelos contaminados', procesos: ['Investigación', 'Evaluación riesgo', 'Caracterización', 'Descontaminación', 'Certificación'], obligaciones: ['Notificar contaminación', 'Plan descontaminación', 'Certificación cierre'] },
  ruido: { ley: 'Real Decreto 1367/2007', limites: { dia: '70 dB(A)', noche: '60 dB(A)' }, medidas: ['Horarios (7-21h)', 'Equipos poco ruidosos', 'Barreras acústicas', 'Monitorización'] },
  eficiencia_hidrica: { objetivo: 'Reducción consumo agua 20% en edificios nuevos', tecnologias: ['Grifería bajo consumo', 'WC doble descarga', 'Reutilización aguas grises', 'Riego por goteo'], certificacion: 'Liderazgo verde, BREEAM, HQE' },
}

// ─── Energías renovables aplicadas ───
const RENEWABLE_ENERGY = {
  solar_fotovoltaica: { potencia_tipica: '1.5-3 kWp/100m²', produccion: '1400-1800 kWh/kWp/año (España)', payback: '6-10 años', vida_util: '25-30 años', componentes: ['Paneles monocristalinos/poliestructurales', 'Inversor string/microinversor', 'Estructura soporte', 'Baterías (opcional)'] },
  solar_termica: { uso: 'Agua caliente sanitaria + calefacción auxiliar', ahorro: '50-70% energía ACS', colectores: ['Planos (70°C)', 'Tubos vacío (150°C)', 'Concentradores (250°C)'], dimensionamiento: '1.5-2 m²/persona' },
  aerogenerador: { uso: 'Zonas con viento >5 m/s media', potencia_tipica: '2-3 kW (doméstico)', normativa: ['Autorización ambiental', 'Registro productores', 'Vertido a red'] },
  bomba_calor: { cop: '3-5 (3-5 kW calor por 1 kW electricidad)', tipos: ['Aire-aire', 'Aire-agua', 'Agua-agua', 'Tierra-agua'], ventajas: ['Calefacción + refrigeración', 'Eficiente', 'Sin combustión'] },
  biomasa: { uso: 'Calefacción centralizada', tipos: ['Leña', 'Pellets', 'Arbotantes'], potencia: '20-500 kW', rendimiento: '75-90%', normativa: 'Certificado instalador biomasa' },
  geotermia: { cop: '4-6 (muy eficiente)', profundidad: '50-150m', tipos: ['Vertical (sondeos)', 'Horizontal (colectores)', 'Pozos (agua)'] },
}

// ─── Gestión de proyecto de obra ───
const CONSTRUCTION_PROJECT_MGMT = {
  fases_obra: {
    proyecto: ['Anteproyecto', 'Proyecto básico', 'Proyecto ejecutivo', 'Pliego de condiciones', 'Presupuesto'],
    licencias: ['Licencia de obras (ayuntamiento)', 'Estudio de impacto ambiental (si aplica)', 'Autorización urbanística', 'Permiso de edificación'],
    ejecucion: ['Replanteo', 'Movimiento tierras', 'Cimentación', 'Estructura', 'Cerramientos', 'Instalaciones', 'Acabados', 'Exterior'],
    recepcion: ['Inspección final', 'Certificado final obra', 'Libro edificio', 'Cédula habitabilidad', 'Acta recepción'],
  },
  documentos_clave: ['Plano de replanteo', 'Control de calidad', 'Partes de obra', 'Cuaderno de bitácora', 'Certificaciones', 'Ordenes de cambio', 'Actas de reunión'],
  seguros_obra: { rc_obra: 'Responsabilidad civil decenal (10 años)', all_risk: 'Todo riesgo de obra (daños materiales)', personal: 'Accidentes trabajadores', maquinaria: 'Daños maquinaria' },
  garantias: { buen_fin: '5-10% valor obra. Devolución final.', bien_raiz: 'Garantía real sobre inmueble (si obra >600.000€)', cumplimiento: 'Prima sobre valor contrato' },
}

// ─── Control de costes en obra ───
const COST_CONTROL = {
  metodos: {
    valoracion_avance: { desc: 'Seguimiento valor mensual trabajos realizados', formula: '(Trabajos realizados / Trabajos totales) × Presupuesto', uso: 'Comparar con certificaciones' },
    curva_s: { desc: 'Representación gráfica avance frente al tiempo', uso: 'Detectar desviaciones cronograma y coste', interpretacion: 'Curva por debajo = retraso o sobrecoste' },
    earned_value: { desc: 'Valor ganado (EV) vs valor planificado (PV) vs coste real (AC)', indices: ['SPI (cronograma)', 'CPI (coste)'] },
  },
  desviaciones_tipicas: { material: 'Variación precio materias primas', mano_obra: 'Variación productividad', maquinaria: 'Averías, retrasos', clima: 'Días perdidos', diseño: 'Cambios diseño, órdenes cambio' },
  acciones_correctivas: ['Renegociar precios proveedores', 'Optimizar secuencia trabajos', 'Reasignar recursos', 'Reducir alcance (desde el cliente)', 'Buscar alternativas materiales'],
}

// ─── Sistemas fotovoltaicos ───
const PHOTOVOLTAIC = {
  tipos: { autoconsumo: 'Generación propia. Excedentes vertidos o no.', aislada: 'Sin conexión red. Baterías almacenamiento.', conectada: 'Vertido total a red.' },
  componentes: ['Paneles solares (300-600W)', 'Inversor string o microinversor', 'Baterías Li-ion (si hay almacenamiento)', 'Regulador de carga', 'Estructura soporte', 'Cableado solar'],
  calculo: { factor_irradiancia: '1400-1800 kWh/kWp/año (España)', perdidas: '14-20% (temperatura, suciedad, cables)', payback_tipico: '6-10 años', vida_util: '25-30 años (garantía 25 años producción)' },
  normativa: { rcuibt: 'Registro Mercantil. Aut consumidor <100kW.', compensacion: 'Excedentes: compensación simplificada (precio mercado)', vertido: 'Precio mercado spot' },
}

// ─── Accesibilidad ───
const ACCESSIBILITY = {
  norma_general: 'UNE 170001-1:2007 Accesibilidad al entorno construido',
  rampas: { pendiente_max: '8% (1:12)', descansos: 'Cada 9m, mínimo 1.5x1.5m', barandillas: '0.9-1.1m ambas caras', rodapie: 'Bordes retenedores 5cm' },
  ascensores: { cabina_min: '1.1x1.4m', puertas: '0.90m libre paso', pulsadores: 'Altura 0.8-1.1m, braille', emergencia: 'Teléfono interior, descenso manual' },
  aseos: { espacio: '1.5x1.5m giro silla ruedas', barandillas: 'En todos los laterales', inodoro: 'Altura 45-50cm', lavabo: 'Altura 80cm, sin obstructo' },
  itinerario: { ancho_min: '1.8m libre paso', superficie: 'Antideslizante, sin escalones', senalizacion: 'Elementos guía, pavimento podotáctil' },
  sordos: { bucle_induccion: 'Salas conferencia, taquillas', alarmas: 'Visuales + sonoras', informacion: 'Subtitulado, lengua signos' },
}

// ─── Gestión residuos obra ───
const WASTE_MANAGEMENT = {
  categorias: {
    hormigon: { reciclable: true, destinos: ['Planta reciclaje hormigón', 'Relleno técnico'] },
    acero: { reciclable: true, destinos: ['Chatarrero', 'Fundición reciclaje'] },
    madera: { reciclable: true, destinos: ['Reciclaje', 'Biomasa'] },
    envases: { reciclable: true, destinos: ['Contenedor amarillo'] },
    escombro: { reciclable: false, destinos: ['Vertedero controlado (C2/C3)'] },
    peligrosos: { reciclable: false, destinos: ['Gestor autorizado (RAEE, amianto, pinturas)'] },
  },
  gestor_residuos: { documentacion: ['Albarán de entrega', 'Documento residuos peligrosos', 'Certificado gestión'], sanciones: ['Multas por vertido ilegal', 'Cierre obra', 'Responsabilidad penal'] },
}

class ConstructionAgent {
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

  // ─── Motor de análisis ───
  async analyzeTask(task) {
    const desc = (task.description || '').toLowerCase()
    const title = (task.title || '').toLowerCase()
    const full = `${title} ${desc}`

    const result = { analysis: [], calculations: [], prl_measures: [], materials: [], regulations: [], tools_needed: [], severity: 'info' }

    // ─── Eléctrico ───
    const isElectrical = /electric|eléctric|cable|cableado|cableado|tensión|voltaje|corriente|potencia|interruptor|puesta a tierra|instalación/i.test(full)
    if (isElectrical) {
      result.analysis.push({ topic: 'instalaciones_electricas', sections: Object.values(ELECTRICAL_KNOWLEDGE).slice(0, 5) })
      result.tools_needed.push('Multímetro', 'Telurómetro', 'Alicate amperimétrico', 'Test de diferenciales')

      // Cálculo de sección si menciona metros/amperios
      const lengthMatch = full.match(/(\d+)\s*(?:m|metros?|ml)/)
      const currentMatch = full.match(/(\d+)\s*(?:A|amperios?)/)
      if (lengthMatch && currentMatch) {
        const calc = calcCableSection(parseInt(currentMatch[1]), parseInt(lengthMatch[1]))
        result.calculations.push({ type: 'cable_section', input: { current: parseInt(currentMatch[1]), length: parseInt(lengthMatch[1]) }, result: calc })
      }
    }

    // ─── PRL / Seguridad ───
    const isPRL = /prl|prevención|riesgo|seguridad|accidente|epp|protección|loto|caída|ruido|polvo|químico|incendio|confinado|ergonomía/i.test(full)
    if (isPRL) {
      for (const [key, risk] of Object.entries(PRL_RISKS)) {
        if (full.includes(key) || full.includes(key.replace(' ', ''))) {
          result.prl_measures.push({ risk: key, ...risk })
        }
      }
      if (result.prl_measures.length === 0) {
        result.prl_measures.push({
          risk: 'general',
          response: 'Medidas PRL generales para obra: EPP obligatorio, formación trabajadores, plan emergencias, señalización, supervisor seguridad',
          regulation: 'Ley 31/1995 PRL',
        })
      }
      result.analysis.push({ topic: 'prl_safety' })
    }

    // ─── Construcción / Materiales ───
    const isConstruction = /construcción|obra|edificio|estructura|hormigón|acero|madera|ladrillo|aislante|cimentación|mampostería|fachada|cubierta/i.test(full)
    if (isConstruction) {
      result.analysis.push({ topic: 'construccion' })
      for (const [key, material] of Object.entries(MATERIALS)) {
        if (full.includes(key)) {
          result.materials.push({ material: key, ...material })
        }
      }
      result.tools_needed.push('Nivel láser', 'Cinta métrica', 'Plomada', 'Busca niveles')
    }

    // ─── HVAC / Mecánica ───
    const isHVAC = /hvac|climatisation|aire acondicionado|calefacción|ventilación|frío|calor|refrigerant|compresor/i.test(full)
    if (isHVAC) {
      result.analysis.push({ topic: 'hvac_systems' })
      result.tools_needed.push('Manifold de recuperación', 'Vacuum pump', 'Termómetro digital')
    }

    // ─── Normativa por país ───
    for (const [country, regs] of Object.entries(REGULATIONS)) {
      if (full.includes(country) || full.includes(`${country}`)) {
        result.regulations.push({ country, ...regs })
      }
    }

    // Respuesta general si no detectó nada específico
    if (result.analysis.length === 0) {
      result.analysis.push({
        topic: 'consulta_general',
        response: `Consulta de ingeniería/construcción recibida: "${task.description}". Para una respuesta precisa, indique:\n- Tipo de instalación/estructura\n- Normativa aplicable (país)\n- Dimensiones y materiales\n- Condiciones del entorno`,
      })
    }

    result.tools_needed = [...new Set(result.tools_needed)]
    return result
  }

  // ─── WebSocket lifecycle ───
  async register() {
    console.log(`[${this.name}] Registrando...`)
    const { status, data } = await this.request('POST', '/agents/register', {
      name: this.name,
      description: 'Experto en ingeniería civil, instalaciones eléctricas (REBT/NEC), cálculo estructural, PRL (prevención riesgos laborales), HVAC, gestión de obra, materiales de construcción y normativas internacionales.',
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
        try {
          const { status, data } = await this.request('GET', `/agents/${this.id}`)
          if (status === 200 && data.token) { clearInterval(this.registrationCheckInterval); this.token = data.token; console.log(`[${this.name}] ¡Aprobado!`); resolve() }
        } catch {}
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

    const result = {
      status: 'completed',
      agent: this.name,
      capabilities_used: analysis.analysis.map(a => a.topic),
      engineering: analysis,
      timestamp: new Date().toISOString(),
    }

    this.send({ type: 'task_result', task_id: task.task_id, result })
    this.send({
      type: 'knowledge_add',
      data: {
        title: `Ingeniería: ${task.title}`,
        content: JSON.stringify(analysis),
        category: 'construction',
        tags: ['engineering', 'construction', 'prl', 'electrical'],
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

    const result = {
      status: 'completed',
      agent: this.name,
      capabilities_used: analysis.analysis.map(a => a.topic),
      engineering: analysis,
      timestamp: new Date().toISOString(),
    }

    this.send({ type: 'subtask_result', task_id: subtask.task_id, subtask_id: subtask.subtask_id, result })
    this.send({
      type: 'knowledge_add',
      data: {
        title: `Análisis obra: ${subtask.title}`,
        content: JSON.stringify(analysis),
        category: 'construction',
        tags: ['construction', 'engineering'],
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
    if (lower.includes('estructura') || lower.includes('cálculo estructural') || lower.includes('hormigón armado')) {
      return '📐 En cálculo estructural, el hormigón armado se diseña según EHE-08. Resistencias típicas: C25/30 (vigas, losas), C30/37 (grandes estructuras). Para acero structural: S235 a S460. ¿Qué tipo de estructura necesitas analizar?'
    }
    if (lower.includes('código') || lower.includes('normativa') || lower.includes('cte') || lower.includes('rebt')) {
      return '📋 El CTE (Código Técnico de Edificación) regula edificación en España. DB-SE para estructura, DB-HE para eficiencia energética, DB-SI para seguridad incendios. REBT para instalaciones eléctricas. ¿Qué normativa necesitas consultar?'
    }
    if (lower.includes('prl') || lower.includes('riesgo') || lower.includes('seguridad') || lower.includes('epp')) {
      return '🛡️ La PRL es obligatoria en toda obra. EPP básico: casco, calzado S3, guantes, chaleco reflectante. Para alturas: arnés con línea de vida. Ley 31/1995 + RD 2177/2004 para andamios. ¿Qué riesgo específico necesitas evaluar?'
    }
    if (lower.includes('hvac') || lower.includes('clima') || lower.includes('aire acondicionado') || lower.includes('calefacción')) {
      return '🌡️ En HVAC, potencia estimada: Volumen(m³) × ΔT × 0.08 W/m³·K. Para 100m³ y ΔT=20°C: ~160W. Split 9000 BTU para <5kW, VRF para grandes superficies. ¿Qué espacio necesitas climatizar?'
    }
    if (lower.includes('energía') || lower.includes('solar') || lower.includes('fotovoltaica') || lower.includes('renovable')) {
      return '☀️ Energía solar fotovoltaica en España: 1400-1800 kWh/kWp/año. Payback 6-10 años. Para autoconsumo: inversor string o microinversor. Potencia típica: 1.5-3 kWp/100m². ¿Qué superficie disponible tienes?'
    }
    if (lower.includes('bim') || lower.includes('modelado')) {
      return '🏗️ BIM (Building Information Modeling): Nivel 0=2D CAD, Nivel 1=3D separado, Nivel 2=modelos federados, Nivel 3=modelo integrado. Software: Revit, ArchiCAD, Navisworks para clash detection. ¿En qué fase del proyecto estás?'
    }
    if (lower.includes('hormigón') || lower.includes('concreto') || lower.includes('concrete')) {
      return '🧱 Hormigón armado: dosificación típica C25/30 = 360kg cemento + 650L arena + 1100L grava + 185L agua por m³. Ensayo: asentamiento cono (slump test) + compresión a 28 días. Resistencia: 25 MPa a 28 días.'
    }
    if (lower.includes('acero') || lower.includes('steel')) {
      return '⚙️ Acero estructural: S235 (genérico), S275 (estructuras), S355 (grandes cargas), S460 (alta resistencia). Tension admisible: fy/1.15. Peso: 7.85 kg/m³. Soldadura según UNE-EN 1090.'
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
          topics_shared: ['Structural calculation methods (Eurocode)', 'Green building certification (LEED/BREEAM)', 'Fire protection systems (RIPCI)', 'Geotechnical classification systems'],
          entries_created: 4,
          details: 'Shared Eurocode structural calculation formulas for steel and concrete, LEED v4.1 credit requirements for sustainable buildings, RIPCI fire suppression installation standards, and geotechnical SPT/CPT soil classification methods.',
          domain: 'construction_engineering',
        }
      case 'knowledge_query':
        return {
          findings: [
            'Retrieved cross-laminated timber (CLT) structural specifications for mass timber buildings',
            'Located Passivhaus-certified HVAC sizing algorithms for Mediterranean climates',
            'Found comparative data on recycled aggregate concrete performance',
            'Discovered Phase Change Material (PCM) integration protocols for thermal regulation',
          ],
          sources: 4,
          domain: 'construction_engineering',
        }
      case 'self_improve':
        return {
          suggestions: [
            'Add modular construction and prefab assembly knowledge base entries',
            'Expand BIM integration protocols with structural analysis software (ETABS, SAP2000)',
            'Include seismic retrofit techniques for existing unreinforced masonry buildings',
            'Integrate 3D concrete printing (additive manufacturing) methodologies',
          ],
          current_capability_score: 0.80,
          target_capability_score: 0.90,
          domain: 'construction_engineering',
        }
      case 'capability_explore':
        return {
          new_areas: ['Mass timber construction (CLT/Glulam)', 'Net-zero energy buildings', 'Circular economy in construction materials', 'AI-driven quality inspection with drones'],
          relevance: 'high',
          domain: 'construction_engineering',
        }
      case 'system_analysis':
        return {
          health_assessment: 'Knowledge base covers traditional construction well but needs expansion in modern sustainable materials, digital twins, and automated construction robotics.',
          coverage_score: 0.75,
          improvement_areas: ['3D printing construction', 'Robotic demolition', 'Smart material sensors', 'Carbon capture concrete'],
          domain: 'construction_engineering',
        }
      default:
        return { message: `Unknown learning task type: ${taskType}` }
    }
  }

  generateImprovementProposal() {
    const proposals = [
      { type: 'feature', title: 'Structural Health Monitoring Integration', description: 'Add real-time structural health monitoring (SHM) capabilities using IoT sensor data. Track strain, vibration, and temperature in bridges and buildings for predictive maintenance.', priority: 'high' },
      { type: 'new_agent', title: 'Sustainability Certification Agent', description: 'Deploy a specialized agent for green building certifications (LEED, BREEAM, HQE) that automates credit documentation, tracks compliance, and generates submission-ready reports.', priority: 'medium' },
      { type: 'optimization', title: 'Automated Quantity Takeoff from BIM', description: 'Implement direct BIM model parsing for automated quantity extraction, reducing estimation errors by 95% and cutting takeoff time from days to minutes.', priority: 'high' },
      { type: 'knowledge_gap', title: 'Disaster Resilience Knowledge Base', description: 'Create comprehensive entries on earthquake-resistant design, flood-proof construction, and climate adaptation strategies for buildings in vulnerable zones.', priority: 'medium' },
    ]
    return proposals[Math.floor(Math.random() * proposals.length)]
  }

  send(msg) { if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg)) }

  async run() {
    try { await this.register(); await this.connect(); console.log(`[${this.name}] ¡Listo! Presiona Ctrl+C para salir`) }
    catch (err) { console.error(`[${this.name}] Fatal:`, err.message); process.exit(1) }
  }
}

const agent = new ConstructionAgent(GATEWAY_URL)
agent.run()
process.on('SIGINT', () => {
  console.log(`\n[${AGENT_NAME}] Desconectando...`)
  if (agent.registrationCheckInterval) clearInterval(agent.registrationCheckInterval)
  if (agent.ws) agent.ws.close()
  process.exit(0)
})
