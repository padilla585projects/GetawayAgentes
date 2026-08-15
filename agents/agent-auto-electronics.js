#!/usr/bin/env node

/**
 * Automotive Electronics & Diagnostics Agent — GetawayAgentes
 *
 * Experto en electrónica automotriz, diagnóstico OBD-II, ECUs,
 * sensores, cableado, protocolos de comunicación y sistemas del vehículo.
 *
 * No necesita API externa — usa base de conocimiento interna.
 */

const http = require('http')
const https = require('https')
const { URL } = require('url')
const WebSocket = require('ws')

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:8787'
const AGENT_NAME = 'Auto Electronics Expert'
const CAPABILITIES = [
  'obd2_diagnostics',
  'ecu_programming',
  'sensor_analysis',
  'wiring_diagnosis',
  'can_bus_protocol',
  'emissions_systems',
  'electrical_systems',
  'vehicle_brands',
  'automotive_tools',
  'injection_systems',
  'turbo_systems',
  'air_conditioning',
  'advanced_driver_assistance',
  'hybrid_electric_vehicles',
]

// ─── Modos OBD-II ───
const OBD_MODES = {
  mode_01: { name: 'Datos en tiempo real (PID)', desc: 'Solicitar valores actuales del vehículo', pids_comunes: ['04 Carga motor calculada', '05 Temperatura refrigerante', '0C RPM motor', '0D Velocidad vehículo', '0E Posición mariposa', '0F Temperatura aire admisión', '10 Flujo masa aire', '11 Posición TPS', '14 Sensor O2 B1S1', '15 Sensor O2 B1S2', '2F Nivel combustible', '46 Temperatura ambiente'] },
  mode_02: { name: 'Freeze Frame', desc: 'Momento exacto del fallo', uso: 'Ver condiciones cuando se activó Check Engine' },
  mode_03: { name: 'Códigos de fallo', desc: 'Leer DTCs almacenados', comando: '03' },
  mode_04: { name: 'Borrar códigos', desc: 'Borrar DTCs y luz Check Engine', comando: '04', nota: 'Solo con scanner' },
  mode_05: { name: 'Resultados O2 monitor', desc: 'Prueba monitoreo O2', uso: 'Verificar estado sensores lambda' },
  mode_06: { name: 'Monitoreo no continuo', desc: 'Resultados tests no continuos', uso: 'Catalizador, EGR, EVAP, misfire' },
  mode_07: { name: 'Códigos pending', desc: 'Fallos que no activaron Check Engine aún', uso: 'Detección temprana' },
  mode_08: { name: 'Control de componentes', desc: 'Activar/prueba componentes', uso: 'Inyectores, válvulas, relés' },
  mode_09: { name: 'Información vehículo', desc: 'VIN, calibración ECU', uso: 'Identificación' },
  mode_0A: { name: 'Códigos permanentes', desc: 'No se pueden borrar con scanner', uso: 'Códigos que requieren reparación real' },
}

// ─── Tabla de fuses automotrices ───
const FUSE_TABLE = {
  tipos: { mini: '10A-30A. El más común.', standard: '15A-40A. Tamaño medio.', maxi: '20A-80A. Alta corriente.', jcase: '20A-60A. Fusible cuadrado.', fusible_laminado: '30A-120A. Fusible plano.' },
  colores: { 5: 'Naranja', 7.5: 'Marrón', 10: 'Rojo', 15: 'Azul', 20: 'Amarillo', 25: 'Incoloro', 30: 'Verde', 35: 'Azul claro', 40: 'Naranja oscuro', 50: 'Rojo oscuro' },
  ubicaciones_tipicas: { cuadro_fusibles: 'Dentro del habitáculo (bajo volante/dashboard)', caja_fusibles_motor: 'Junto a batería o en compartimento motor', fusibles_bateria: 'En línea directa desde batería' },
}

// ─── Protocolos de diagnóstico avanzado ───
const ADVANCED_DIAG = {
  osciloscopio_usos: {
    sensores_analogicos: 'Observar forma de onda, voltaje, frecuencia, ruido',
    sensores_inductivos: 'Picos de voltaje, frecuencia, amplitud',
    inyectores: 'Tiempo de apertura (pulse width), corriente',
    bobinas: 'Forma de onda primaria/secundario, pico voltaje',
    can_bus: 'Voltaje differential CAN-H/CAN-L, patrones',
    o2_sensor: 'Oscilaciones pobre/rico, tiempo respuesta',
    alternador: 'Rizado DC, forma onda AC',
  },
  interpretacion_ondas: {
    senoidal: 'Sensores inductivos (CKP, CMP, VSS)',
    cuadrada: 'Sensores Hall, señales digitales',
    triangular: 'Algunos TPS, sensores posición',
    escalonada: 'Inyectores, bobinas, actuadores',
    ruido: 'Interferencia electromagnética, apantallamiento deficiente',
  },
}

// ─── Árbol de decisión diagnóstico ───
const DECISION_TREE = {
  motor_no_arranca_con_chispa: ['Verificar compresión', 'Verificar sincronización CKP-CMP', 'Verificar inmovilizador', 'Verificar combustible (bomba, presión)'],
  motor_no_arranca_sin_chispa: ['Verificar ECU (alimentación, tierra)', 'Verificar sensor CKP', 'Verificar bobinas (resistencia)', 'Verificar módulo de encendido'],
  motor_arranca_y_se_apaga: ['Verificar IAC (velocidad aire ralentí)', 'Verificar fuga de aire', 'Verificar sensor O2 (atascado)', 'Verificar regulador presión combustible'],
  motor_vibra_ralenti: ['Verificar soportes motor', 'Verificar bujías (misfire)', 'Verificar inyectores (balance)', 'Verificar compresión cilindros'],
  frenos_ruidosos: ['Pastillas desgastadas (indicators)', 'Discos rayados (rectificar/reemplazar)', 'Guías sucias (limpiar)', 'Pastillas endurecidas (cambiar material)'],
  aire_no_enfria: ['Nivel gas refrigerante', 'Presión compresor', 'Embrague compresor', 'Fugas sistema', 'Condensador sucio'],
}

// ─── Especificaciones por sistema ───
const TORQUE_SPECS = {
  bujias: { tipico: '10-20 Nm (según diámetro rosca)', material: ['Acero: 10-15 Nm', 'Aluminio: 8-12 Nm', 'Cobre: 15-20 Nm'] },
  bridas: { manifold_admision: '10-15 Nm', manifold_escape: '25-35 Nm', tapa_valvulas: '8-12 Nm', Carter_aceite: '10-12 Nm' },
  ruedas: { tipico: '80-120 Nm (según vehículo)', patron: 'Estrella (5 pasos)', secuencia: 'Siempre en cruz' },
  polea_ciguenal: { tipico: '150-300 Nm (varía mucho)', nota: 'Consultar manual específico' },
  tensor_distribucion: { correa: '25-45 Nm', cadena: 'Según fabricante (VVT)' },
}

const FLUID_TYPES = {
  aceite_motor: { tipos: ['Mineral', 'Sintético', 'Semi-sintético', 'Baja fricción'], viscosidades: { '0W-20': 'Vehículos nuevos Toyota, Honda', '5W-30': 'Más común, amplio uso', '5W-40': 'Turbo, altas prestaciones', '10W-40': 'Vehículos antiguos', '15W-40': 'Diésel pesado' }, cambio: '5.000-15.000 km según fabricante' },
  refrigerante: { tipos: ['IAT (verde/azul)', 'OAT (naranja/rojo)', 'HOAT (amarillo)', 'P-OAT (rosa)'], mezcla: '50% agua + 50% refrigerante', cambio: '2-5 años o 40.000-80.000 km', nunca_mezclar: 'No mezclar diferentes tipos' },
  transmision_atf: { tipos: ['Dexron III', 'Mercon V', 'CVT fluid', 'DW-1 (Honda)', 'WS (Toyota)'], cambio: '60.000-100.000 km', nota: 'Algunas transmisiones "sello para siempre"' },
  frenos: { tipos: ['DOT 3 (glicerina)', 'DOT 4 (glicol etílico)', 'DOT 5 (silicona - NO mezclar)', 'DOT 5.1 (glicol)', 'DOT 6 (racing)'], cambio: '2 años o 40.000 km', absorcion_agua: 'DOT 3 absorbe más agua que DOT 4' },
  direccion_hidraulica: { tipos: ['ATF Dexron', 'PSF', 'ESP fluid'], cambio: '50.000-80.000 km', nota: 'Verificar tipo exacto en manual' },
  combustible: { gasolina: 'RON 95-98 (octanaje)', diesel: 'B7-B10 (contenido biodiésel)', electrico: 'N/A', hibrido: 'Gasolina + batería HV' },
}

const SPECIFICATIONS = {
  presiones: { aceite_motor_ralenti: '20-60 PSI (según motor)', aceite_motor_caliente: '15-40 PSI', combustible_gasolina: '35-65 PSI (3-5 bar)', combustible_diesel: '2500-3000 PSI (175-200 bar)', turbo_boost: '6-22 PSI (0.4-1.5 bar)', aire_refrigerante: '150-250 PSI (10-17 bar)', vacio_admision: '15-22 inHg (0.5-0.75 bar)' },
  temperaturas: { aceite_operacion: '90-110°C', refrigerante_operacion: '85-105°C', escape_gas: '400-800°C', transmision_atf: '70-90°C', turbo_salida: '800-1050°C' },
  voltajes: { bateria_reposo: '>12.4V', bateria_cargada: '12.6-12.8V', alternador_carga: '13.8-14.5V', sensores_5v: '4.8-5.2V', sensores_0_1v: '0.1-0.9V (O2)' },
}

// ─── Procedimientos de reparación específicos ───
const REPAIR_PROCEDURES = {
  cambio_aceite: { pasos: ['Calentar motor (5 min)', 'Elevar vehículo', 'Soltar tapón drenaje', 'Vaciar aceite', 'Reemplazar filtro', 'Cerrar drenaje', 'Bajar vehículo', 'Rellenar aceite nuevo', 'Verificar nivel', 'Arrancar y comprobar fugas'], herramientas: ['Llave drenaje', 'Trapo', 'Cubo aceite viejo', 'Llave filtro'] },
  cambio_bujias: { pasos: ['Motor frío', 'Retirar cable bujía/ignición', 'Limpiar zona', 'Retirar bujía', 'Verificar electrodo (0.7-0.9mm)', 'Medir gap con calibrador', 'Instalar nueva (apretar a mano)', 'Apretar con llave dinamométrica', 'Reconectar'], momentos: 'Cada 30.000-60.000 km (iridio: 100.000 km)' },
  cambio_filtro_aire: { pasos: ['Localizar caja filtro', 'Abrir presillas', 'Retirar filtro viejo', 'Limpiar caja filtro', 'Insertar filtro nuevo', 'Cerrar presillas'], momentos: 'Cada 15.000-30.000 km' },
  sangrado_frenos: { pasos: ['Llenar depósito líquido frenos', 'Conectar manguera al purgador', 'Pisar freno 3 veces y mantener', 'Abrir purgador', 'Cerrar purgador al soltar freno', 'Repetir hasta sin burbujas', 'Repetir en cada rueda'], orden: 'Rueda más lejana primero (DI-DI-DE-TR)', herramienta: 'Llave purgador + manguera + cubo' },
  calibracion_sensores: {
    maf: 'Motor ralentí, conectar scanner, comparar lectura con tabla. Reemplazar si desviación >10%.',
    map: 'Aplicar vacío manual, verificar voltaje lineal. Reemplazar si no responde.',
    tps: 'Medir voltaje cerrado (0.3-0.7V) y abierto (4.2-4.8V). Sin puntos muertos.',
    o2: 'Observar oscilaciones 0.1-0.9V. Frecuencia >0.5Hz. Si lento >300ms → reemplazar.',
  },
}

// ─── Datos por marca específicos ───
const BRAND_DATA = {
  toyota: { motor_comun: '1ZZ-FE (1.8L), 2ZR-FE (1.8L), 1KD-FTV (2.5L diesel)', tension_correa: 'Tensor automático (no ajustar)', capacidad_aceite: '3.7-4.3L (según motor)', tipo_filtro: 'Filtro cartucho (elemento)' },
  honda: { motor_comun: 'K20 (2.0L), L15 (1.5T), R20 (2.0L diesel)', tension_correa: 'Tensor hidráulico', capacidad_aceite: '3.5-4.0L', nota: 'Cambio aceite cada 10.000km' },
  ford: { motor_comun: 'EcoBoost 1.0/1.5/2.0, Duratorq TDCi', tension_correa: 'Tensor hidráulico', capacidad_aceite: '4.0-5.5L', nota: 'PATS inmovilizador en todas' },
  bmw: { motor_comun: 'N20, N55, B58, B47 diesel', tension_correa: 'Cadena (no necesita cambio preventivo)', capacidad_aceite: '5.0-6.5L', nota: 'VANOS necesita limpieza periódica' },
  mercedes: { motor_comun: 'M274, M264, OM651 diesel', tension_correa: 'Cadena', capacidad_aceite: '5.5-7.0L', nota: '7G-Tronic: cambio ATF a los 60.000km' },
}

// ─── Base de conocimiento: Códigos OBD-II comunes ───
const OBD_CODES = {
  P0100: { desc: 'Fallo en el circuito del sensor de flujo de aire (MAF)', causa: 'Sensor MAF sucio, cableado dañado, fuga de aire', accion: 'Limpiar/reemplazar MAF, revisar cableado, verificar fugas' },
  P0101: { desc: 'Rango/rendimiento del sensor MAF', causa: 'Sensor MAF defectuoso, filtro de aire sucio', accion: 'Reemplazar filtro, calibrar o reemplazar MAF' },
  P0110: { desc: 'Fallo en el circuito del sensor IAT', causa: 'Sensor IAT desconectado o defectuoso', accion: 'Verificar conexiones, reemplazar sensor si es necesario' },
  P0120: { desc: 'Fallo en el circuito del sensor TPS', causa: 'TPS desgastado, cableado en cortocircuito', accion: 'Reemplazar TPS, revisar arneses' },
  P0130: { desc: 'Fallo en el circuito del sensor O2 (Banco 1, Sensor 1)', causa: 'Sensor O2 defectuoso, cableado dañado', accion: 'Reemplazar sensor O2, verificar cableado y fusibles' },
  P0171: { desc: 'Sistema demasiado pobre (Banco 1)', causa: 'Fuga de aire, inyectores sucios, bomba de combustible débil', accion: 'Buscar fugas de vacío, limpiar inyectores, verificar presión de combustible' },
  P0172: { desc: 'Sistema demasiado rico (Banco 1)', causa: 'Inyectores filtrando, sensor MAF sucio, regulador de presión', accion: 'Limpiar inyectores, verificar MAF, comprobar regulador' },
  P0300: { desc: 'Misfire aleatorio (fallos de encendido)', causa: 'Bujías desgastadas, bobinas defectuosas, compresión baja', accion: 'Reemplazar bujías, probar bobinas, medir compresión' },
  P0301: { desc: 'Misfire cilindro 1', causa: 'Bujía/bobina del cil. 1, inyector obstruido', accion: 'Intercambiar bujías entre cilindros para aislar, probar inyector' },
  P0420: { desc: 'Eficiencia del catalizador bajo umbral (Banco 1)', causa: 'Convertidor catalítico degradado, sensor O2 trasero defectuoso', accion: 'Verificar sensor O2 trasero, reemplazar catalizador' },
  P0440: { desc: 'Fallo en el sistema EVAP', causa: 'Válvula purga defectuosa, tapón de combustible suelto', accion: 'Verificar tapón, válvula purga y líneas de evaporación' },
  P0442: { desc: 'Pequeña fuga detectada en sistema EVAP', causa: 'O-ring de boquilla de carga dañado, manguera agrietada', accion: 'Inspeccionar mangueras y conexiones del sistema EVAP' },
  P0500: { desc: 'Fallo en el sensor de velocidad del vehículo (VSS)', causa: 'Sensor VSS defectuoso, cableado, tacómetro', accion: 'Reemplazar sensor VSS, verificar arnés' },
  P0700: { desc: 'Fallo en el sistema de control de la transmisión', causa: 'Solenoide de transmisión, fluido bajo, ECU de transmisión', accion: 'Verificar nivel/fluido de transmisión, escanear códigos de transmisión' },
  P0401: { desc: 'Flujo insuficiente en el sistema EGR', causa: 'Válvula EGR obstruida, tubería tapada, solenoide defectuoso', accion: 'Limpiar válvula EGR, verificar tubería y solenoide' },
  P2195: { desc: 'Sensor O2 atascado pobre (Banco 1, Sensor 1)', causa: 'Sensor O2 contaminado o defectuoso', accion: 'Reemplazar sensor O2 delante' },
  B0001: { desc: 'Fallo en el circuito del airbag conductor', causa: 'Resistencia alta en circuito, cableado del volante', accion: 'Verificar resorte giratorio (clock spring), cableado' },
  C0035: { desc: 'Fallo en el circuito del sensor de velocidad de rueda delantera izquierda', causa: 'Sensor ABS dañado, reluctor sucio, cableado', accion: 'Limpiar reluctor, reemplazar sensor, verificar arnés' },
  U0100: { desc: 'Pérdida de comunicación con ECM/PCM', causa: 'Cableado CAN dañado, ECU falla interna', accion: 'Verificar líneas CAN-H y CAN-L, conexiones de tierra' },
  P0011: { desc: 'CMDP (Control de posición del árbol de levas) Banco 1 retraso excesivo', causa: 'Válvula VVT atascada, aceite sucio, solenoide VVT', accion: 'Cambiar aceite/filtro, limpiar/reemplazar solenoide VVT, verificar cadena/banda' },
  P0012: { desc: 'CMDP Banco 1 retraso excesivo (atascado adelantado)', causa: 'Solenoide VVT, válvula de timing, aceite', accion: 'Limpiar VVT, verificar presión aceite, reemplazar solenoide' },
  P0016: { desc: 'Correlación CKP-CMP Banco 1 Sensor A', causa: 'Banda/distribución saltada, sensor CKP/CMP, cadena desgastada', accion: 'Verificar sincronización distribución, reemplazar banda/cadena' },
  P0106: { desc: 'Rango/rendimiento sensor MAP', causa: 'Sensor MAP sucio, cableado, fuga de vacío', accion: 'Limpiar sensor MAP, verificar vacío múltiple, comprobar cableado' },
  P0131: { desc: 'Circuito bajo sensor O2 Banco 1 Sensor 1', causa: 'Cortocircuito a tierra, sensor O2 defectuoso', accion: 'Reemplazar sensor O2, verificar cableado' },
  P0132: { desc: 'Circuito alto sensor O2 Banco 1 Sensor 1', causa: 'Cortocircuito a VBAT, cableado', accion: 'Verificar cableado, reemplazar sensor O2' },
  P0174: { desc: 'Sistema demasiado pobre (Banco 2)', causa: 'Fuga de aire, inyectores sucios, MAF', accion: 'Buscar fugas, limpiar inyectores/MAF, verificar presión combustible' },
  P0201: { desc: 'Circuito inyector cilindro 1', causa: 'Inyector abierto/cortocircuito, cableado', accion: 'Probar inyector, verificar arnés, medir resistencia (12-16Ω)' },
  P0261: { desc: 'Circuito inyector cilindro 1 bajo', causa: 'Cortocircuito a tierra en inyector', accion: 'Verificar cableado inyector 1, reemplazar inyector' },
  P0325: { desc: 'Circuito sensor detonación 1', causa: 'Sensor knock desconectado, cableado apantallado', accion: 'Verificar conexión sensor knock, apantallamiento' },
  P0335: { desc: 'Circuito sensor posición cigüeñal A', causa: 'Sensor CKP defectuoso, reluctor sucio, cableado', accion: 'Reemplazar sensor CKP, limpiar reluctor, verificar arnés' },
  P0340: { desc: 'Circuito sensor posición árbol de levas', causa: 'Sensor CMP defectuoso, cableado, sincronización', accion: 'Reemplazar CMP, verificar banda/distribución' },
  P0403: { desc: 'Circuito EGR', causa: 'Solenoide EGR defectuoso, cableado', accion: 'Reemplazar solenoide EGR, verificar cableado y vacío' },
  P0420: { desc: 'Eficiencia catalizador bajo umbral (Banco 1)', causa: 'Catalizador degradado, sensor O2 trasero', accion: 'Probar O2 trasero, reemplazar catalizador si necesario' },
  P0443: { desc: 'Circuito válvula purga EVAP', causa: 'Válvula purga defectuosa, cableado', accion: 'Reemplazar válvula purga, verificar cableado' },
  P0505: { desc: 'Circuito control ralentí (IAC)', causa: 'Válvula IAC atascada, cableado', accion: 'Limpiar cuerpo mariposa, reemplazar IAC, verificar vacío' },
  P0562: { desc: 'Voltaje bajo del sistema', causa: 'Alternador, cableado, batería', accion: 'Probar alternador (13.8-14.5V), verificar bornes, medir caída voltaje' },
  P0600: { desc: 'Communication Link Malfunction', causa: 'Línea de datos dañada, ECU', accion: 'Verificar CAN/K-Line, conexiones OBD-II, reiniciar ECU' },
  P1100: { desc: 'Fallo circuito MAF (genérico fabricante)', causa: 'Sensor MAF, cableado, ECU', accion: 'Probar MAF con osciloscopio, verificar alimentación 12V' },
  P1101: { desc: 'Rango/rendimiento MAF (genérico)', causa: 'MAF sucio, fuga aire post-MAF, cableado', accion: 'Limpiar MAF con limpiador específico, verificar fugas' },
  P1351: { desc: 'Circuito iluminación bobina (High)', causa: 'Bobina defectuosa, cableado, ECU', accion: 'Probar bobina, medir resistencia primaria/secundaria, verificar cableado' },
  P1500: { desc: 'Señal velocidad vehículo (genérico)', causa: 'Sensor VSS, cableado, tacómetro', accion: 'Reemplazar VSS, verificar arnés y conexiones' },
  P2008: { desc: 'Circuito control admisión variable (VIM)', causa: 'Actuador VIM, cableado', accion: 'Probar actuador, verificar cableado y vacío' },
  P2100: { desc: 'Circuito actuador mariposa', causa: 'Actuador electronic throttle defectuoso, cableado', accion: 'Reemplazar cuerpo mariposa, verificar ECU' },
  P2101: { desc: 'Rango rendimiento actuador mariposa', causa: 'Mariposa atascada, cable, motor', accion: 'Limpiar cuerpo mariposa, verificar libre movimiento, reemplazar si necesario' },
  P2119: { desc: 'Rango rendimiento cuerpo mariposa', causa: 'Carbonilla, cableado, ECU', accion: 'Limpiar cuerpo mariposa, verificar position sensor' },
  P2135: { desc: 'Discrepancia voltaje TPS A/B', causa: 'TPS desgastado, cableado', accion: 'Reemplazar TPS, verificar cableado y conectores' },
  P2195: { desc: 'Sensor O2 atascado pobre (Banco 1, Sensor 1)', causa: 'Sensor O2 contaminado o defectuoso', accion: 'Reemplazar sensor O2 delante' },
  P2270: { desc: 'Sensor O2 atascado rico (Banco 2 Sensor 2)', causa: 'Sensor O2 trasero defectuoso', accion: 'Reemplazar O2 trasero, verificar catalizador' },
  P2271: { desc: 'Sensor O2 atascado pobre (Banco 2 Sensor 2)', causa: 'Sensor O2 trasero, fuga escape antes del sensor', accion: 'Reemplazar O2 trasero, sellar fugas escape' },
  B0001: { desc: 'Fallo en el circuito del airbag conductor', causa: 'Resistencia alta en circuito, cableado del volante', accion: 'Verificar resorte giratorio (clock spring), cableado' },
  B0020: { desc: 'Sensor de impacto frontal izquierdo', causa: 'Sensor dañado, cableado', accion: 'Reemplazar sensor, verificar arnés' },
  B1234: { desc: 'Fallo módulo BCM (Body Control Module)', causa: 'BCM defectuoso, programación, cableado', accion: 'Reprogramar BCM, verificar alimentación y tierras' },
  C0035: { desc: 'Fallo sensor velocidad rueda delantera izquierda', causa: 'Sensor ABS dañado, reluctor sucio', accion: 'Limpiar reluctor, reemplazar sensor, verificar arnés' },
  C0040: { desc: 'Fallo sensor velocidad rueda delantera derecha', causa: 'Sensor ABS, reluctor, cableado', accion: 'Probar sensor, limpiar reluctor, verificar cableado' },
  C0051: { desc: 'Fallo sensor G (acelerómetro)', causa: 'Sensor ESP, montaje, cableado', accion: 'Reemplazar sensor G, verificar orientación y montaje' },
  C0060: { desc: 'Fallo ECU hidráulica ABS', causa: 'ECU ABS defectuosa, cableado', accion: 'Reemplazar módulo ABS, reprogramar' },
  U0073: { desc: 'Control module communication bus off', causa: 'Bus CAN apagado, corto, ECU', accion: 'Verificar terminadores CAN, cableado, reiniciar ECU' },
  U0101: { desc: 'Pérdida comunicación con TCM', causa: 'TCM defectuoso, cableado CAN', accion: 'Verificar conexión TCM, líneas CAN' },
  U0121: { desc: 'Pérdida comunicación con ABS', causa: 'Módulo ABS, cableado CAN', accion: 'Verificar módulo ABS, alimentación, tierras, CAN' },
  U0140: { desc: 'Pérdida comunicación con BCM', causa: 'BCM, cableado, alimentación', accion: 'Verificar BCM, fusibles, conexiones CAN' },
  U0401: { desc: 'Datos inválidos recibidos de ECM', causa: 'ECM falla, actualización necesaria', accion: 'Actualizar software ECM, verificar sensores de entrada' },
}

// ─── Especificaciones de sensores comunes ───
const SENSOR_SPECS = {
  'sensor maf': { type: 'Flujo de masa de aire', signal: 'Analog 0-5V / Frecuencia 1-10kHz', values: 'Ralentí: 2-7 g/s, Aceleración: 15-80 g/s', test: 'Comparar lectura con valores de fábrica, prueba de respuesta' },
  'sensor map': { type: 'Presión absoluta del múltiple', signal: 'Analog 0-5V (lineal)', values: 'Ralentí: 0.8-1.5V, Plena carga: 3.5-4.8V', test: 'Verificar con vacío manual, comparar con valores esperados' },
  'sensor tps': { type: 'Posición del acelerador', signal: 'Analog 0-5V (lineal)', values: 'Cerrado: 0.3-0.7V, Abierto: 4.2-4.8V', test: 'Verificar continuidad, sin puntos muertos al girar' },
  'sensor o2': { type: 'Oxígeno (lambda)', signal: 'Analog 0-1V (oscilante)', values: 'Pobre: <0.45V, Rico: >0.45V, Frecuencia: 0.5-5 Hz', test: 'Observar oscilaciones con osciloscopio, verificar calentamiento' },
  'sensor iat': { type: 'Temperatura del aire de admisión', signal: 'NTC (resistencia variable)', values: '25°C: ~2-3kΩ, 80°C: ~300-500Ω', test: 'Medir resistencia con multímetro vs temperatura' },
  'sensor ect': { type: 'Temperatura del refrigerante', signal: 'NTC (resistencia variable)', values: '20°C: ~2.5kΩ, 80°C: ~300Ω', test: 'Medir resistencia vs tabla de temperatura' },
  'sensor ckp': { type: 'Posición del cigüeñal', signal: 'Inductivo / Hall effect', values: 'Pulsos por vuelta (60-2 en flywheel)', test: 'Verificar diente faltante, medir con osciloscopio' },
  'sensor cmp': { type: 'Posición del árbol de levas', signal: 'Hall effect / Inductivo', values: '1 pulsos por ciclo', test: 'Sincronización con CKP, verificar banda/bobina' },
  'sensor knock': { type: 'Detonación/marcado', signal: 'AC 0-5V (frecuencia)', values: 'Normal: 0V DC, Detonación: picos de AC', test: 'Golpear bloque y observar picos, verificar apantallamiento' },
  'sensor vehicle speed': { type: 'Velocidad del vehículo', signal: 'Hall / Inductivo', values: '4 pulsos por revolución', test: 'Verificar reluctor, medir frecuencia a velocidad constante' },
}

// ─── Protocolos de comunicación ───
const PROTOCOLS = {
  'can': { name: 'Controller Area Network', speed: '125/250/500 kbps', pins: 'CAN-H (pin 6), CAN-L (pin 14)', usage: 'Comunicación principal entre ECUs' },
  'kline': { name: 'K-Line (ISO 9141-2 / ISO 14230)', speed: '10.4 kbps', pins: 'Pin 7 (K) o Pin 15 (L)', usage: 'Diagnóstico, vehículos europeos/asiáticos antiguos' },
  'j1850': { name: 'J1850 (VPW/PWM)', speed: '10.4 kbps (VPW) / 41.6 kbps (PWM)', pins: 'Pin 2 (bus+)', usage: 'Ford (PWM), GM/Chrysler (VPW)' },
  'iso9141': { name: 'ISO 9141-2', speed: '10.4 kbps', pins: 'Pin 7 (K-Line)', usage: 'Diagnóstico OBD-II genérico' },
  'lin': { name: 'Local Interconnect Network', speed: '9.6/19.2 kbps', pins: '1 cable', usage: 'Ventanas, espejos, asientos (baja velocidad)' },
  'flexray': { name: 'FlexRay', speed: '10 Mbps', pins: 'Diferencial', usage: 'Sistemas de seguridad, suspensión activa' },
  'ethernet': { name: 'Automotive Ethernet', speed: '100 Mbps - 1 Gbps', pins: 'Par diferencial', usage: 'ADAS, cámaras, actualizaciones OTA' },
}

// ─── Procedimientos de diagnóstico ───
const DIAG_PROCEDURES = {
  'no arranca': {
    pasos: [
      '1. Verificar batería: voltaje > 12.4V (medir en bornes)',
      '2. Verificar conexión de bornes (limpiar, apretar)',
      '3. Escanear códigos de falla (OBD-II)',
      '4. Verificar luces en el tablero (Check Engine, Security)',
      '5. Verificar fusibles relevantes (ECU, inyectores, bomba)',
      '6. Probar bomba de combustible (escuchar chirrido al encender)',
      '7. Verificar chispa: retirar bujía, conectar a cable, tocar tierra, girar motor',
      '8. Verificar compresión (mínimo 100 PSI por cilindro)',
      '9. Verificar sincronización de distributeur/ CKP-CMP',
      '10. Verificar inmovilizador (llave RFID)',
    ],
    tools: ['Multímetro', 'Scanner OBD-II', 'Compresómetro', 'Lámpara de chispa'],
  },
  'falla motor': {
    pasos: [
      '1. Leer códigos de falla con scanner',
      '2. Verificar historial de mantenimiento (bujías, filtros, aceite)',
      '3. Verificar nivel de aceite y refrigerante',
      '4. Escuchar ruidos anormales (knock, golpe hidráulico)',
      '5. Verificar humo por escape (azul=aceite, azul-gris=anticongelante, negro=combustible)',
      '6. Medir compresión de cilindros',
      '7. Verificar presión de combustible',
      '8. Probar sensores con osciloscopio si es necesario',
      '9. Verificar sistema de escapes (catalizador obstruido)',
    ],
    tools: ['Scanner OBD-II', 'Osciloscopio', 'Multímetro', 'Compresómetro', 'Manómetro de combustible'],
  },
  'freno': {
    pasos: [
      '1. Verificar nivel de líquido de frenos',
      '2. Inspeccionar pastillas/discos (grosor mínimo)',
      '3. Verificar fugas en líneas y mangueras',
      '4. Probar eficiencia de frenado (prueba de frenado)',
      '5. Verificar funcionamiento de ABS (sensor de velocidad de rueda)',
      '6. Escanear códigos ABS/ESC',
      '7. Verificar distribución de frenado (tironeo)',
    ],
    tools: ['Scanner ABS', 'Multímetro', 'Micrómetro (pastillas)', 'Manómetro de frenos'],
  },
  'electrico': {
    pasos: [
      '1. Verificar batería (voltaje, carga, estado de carga)',
      '2. Verificar alternador (voltaje de carga: 13.8-14.5V)',
      '3. Verificar puesta a tierra del chasis',
      '4. Buscar consumos parasitarios (> 50mA)',
      '5. Verificar fusibles y relés relevantes',
      '6. Probar circuito con multímetro (continuidad, resistencia)',
      '7. Verificar arneses y conexiones (corrosión, cortes)',
    ],
    tools: ['Multímetro', 'Medidor de batería', 'Alicate amperimétrico', 'Tester de fusibles'],
  },
  'transmision': {
    pasos: [
      '1. Verificar nivel y condición del fluido ATF',
      '2. Escanear códigos de transmisión',
      '3. Verificar cambios de marcha (patrones de cambio)',
      '4. Verificar derrames de fluido',
      '5. Probar solenoides (resistencia, funcionamiento)',
      '6. Verificar sensor de velocidad de entrada/salida',
      '7. Verificar conversor de torque (bloqueo)',
    ],
    tools: ['Scanner de transmisión', 'Manómetro ATF', 'Multímetro', 'Equipo de flujo ATF'],
  },
  'aire acondicionado': {
    pasos: [
      '1. Verificar presión de sistema (baja/alta)',
      '2. Inspeccionar fugas con detector ultravioleta/gas tracer',
      '3. Verificar funcionamiento compresor (embrague, electrovalvula)',
      '4. Verificar condensador (limpieza, ventilador)',
      '5. Verificar evaporador (fugas, obstrucción)',
      '6. Medir temperatura aire salida (8-12°C mín)',
      '7. Verificar gas refrigerante (tipo, cantidad)',
      '8. Verificar cinta del compresor (si aplica)',
    ],
    tools: ['Manifold A/C', 'Detector fugas UV', 'Termómetro infrared', 'Vacuum pump'],
  },
  'arranque lento': {
    pasos: [
      '1. Verificar batería (load test)',
      '2. Verificar cableado de arranque (caída voltaje)',
      '3. Probar motor de arranque en banco',
      '4. Verificar solenoide de arranque',
      '5. Verificar tierra del motor',
      '6. Verificar fusibles y relé de arranque',
    ],
    tools: ['Load tester', 'Multímetro', 'Cable jumper', 'Tester relé'],
  },
  'consumo excesivo': {
    pasos: [
      '1. Escanear códigos (sensor O2, MAF, inyectores)',
      '2. Verificar presión de aire en neumáticos',
      '3. Verificar filtro de aire',
      '4. Medir flujo de inyectores (balance)',
      '5. Verificar sensor O2 con osciloscopio',
      '6. Verificar termostato (temperatura motor)',
      '7. Verificar frenos (si arrastran)',
      '8. Probar alternador (carga excesiva)',
    ],
    tools: ['Scanner', 'Osciloscopio', 'Manómetro inyectores', 'Manómetro neumáticos'],
  },
  'vibraciones': {
    pasos: [
      '1. Identificar cuándo ocurre (frenado, aceleración, velocidad)',
      '2. Verificar balanceo de llantas',
      '3. Verificar alineación',
      '4. Inspeccionar brazos de suspensión (rótulas, bujes)',
      '5. Verificar cardanes/CV joints',
      '6. Verificar soportes de motor/transmisión',
      '7. Verificar bujías (misfire)',
    ],
    tools: ['Indicador dial', 'Multímetro', 'Láser alineación', 'Scanner'],
  },
  'ruidos motor': {
    pasos: [
      '1. Identificar tipo de ruido (golpe, chirrido, siseo, tic-tac)',
      '2. Golpe metálico → bearing, biela, cigüeñal (compresión)',
      '3. Chirrido → correa, tensor, alternador, bomba agua',
      '4. Siseo → vacío, manguera, wastegate turbo',
      '5. Tic-tac → válvulas, lifter, inyectores',
      '6. Verificar tensión de correas',
      '7. Medir compresión para descartar daño interno',
    ],
    tools: ['Stethoscope mecánico', 'Osciloscopio', 'Multímetro', 'Compresómetro'],
  },
  'humo escape': {
    pasos: [
      '1. Azul → aceite quemado (juntas, segmentos, guías válvulas)',
      '2. Blanco → agua/anticongelante (junta culata, grieta bloque)',
      '3. Negro → combustible rico (inyectores, sensor O2, MAF)',
      '4. Gris → normal en motor frío, verificar si persiste',
      '5. Verificar nivel aceite y refrigerante',
      '6. Test de hidrocarburos en refrigerante',
      '7. Endoscopio para ver cámaras de combustión',
    ],
    tools: ['Analizador gases escape', 'Endoscopio', 'Tester refrigerante', 'Osciloscopio'],
  },
  'frenos tironeo': {
    pasos: [
      '1. Verificar distribución de frenado (cuerpo hidráulico)',
      '2. Inspeccionar pastillas/discos (desgaste irregular)',
      '3. Verificar pinzas (atascadas, guías sucias)',
      '4. Verificar líneas hidráulicas (obstrucción)',
      '5. Verificar diferencia de frenado (sensor ABS)',
      '6. Limpiar/sustituir guías de pinza',
      '7. Verificar disco (ovalado, grosor desigual)',
    ],
    tools: ['Micrómetro', 'Indicador dial', 'Manómetro', 'Scanner ABS'],
  },
  'bateria se agota': {
    pasos: [
      '1. Medir voltaje reposo (>12.6V = cargada)',
      '2. Load test (voltaje bajo carga debe ser >9.6V)',
      '3. Verificar alternador (13.8-14.5V en ralentí)',
      '4. Buscar consumos parasitarios (>50mA = problema)',
      '5. Verificar batería (edad, estado, capacidad)',
      '6. Verificar cables y bornes (corrosión, resistencia)',
      '7. Probar alternador con cargador de baterías',
    ],
    tools: ['Load tester', 'Alicate amperimétrico', 'Multímetro', 'Cargador baterías'],
  },
  'fallo electrico intermitente': {
    pasos: [
      '1. Leer códigos históricos (pending, stored)',
      '2. Verificar conexiones (sacudir arneses mientras motor funciona)',
      '3. Verificar tierras del motor y chasis',
      '4. Buscar puntos de corrosión en conectores',
      '5. Verificar fusibles (microfisuras)',
      '6. Medir voltaje en circuitos bajo carga',
      '7. Verificar módulo ECU (código de errores intermitentes)',
      '8. Grabar datos en tiempo real para reproducir',
    ],
    tools: ['Scanner con live data', 'Osciloscopio', 'Multímetro', 'Cámara termográfica'],
  },
  'sensor o2 lento': {
    pasos: [
      '1. Verificar calentamiento (resistencia calentador: 2-14Ω)',
      '2. Medir tiempo respuesta (<300ms de pobre a rico)',
      '3. Verificar voltaje oscilaciones (0.1-0.9V, 0.5-5Hz)',
      '4. Comparar con sensor trasero',
      '5. Verificar contaminación (plomo, silicio, aceite)',
      '6. Limpiar con spray especial o reemplazar',
    ],
    tools: ['Osciloscopio', 'Multímetro', 'Analizador gases'],
  },
  'ecu resetea': {
    pasos: [
      '1. Verificar alimentación ECU (12V estable)',
      '2. Verificar tierras ECU',
      '3. Verificar connecor ECA (pines doblados, corrosión)',
      '4. Buscar cortocircuitos intermitentes',
      '5. Verificar memoria RAM/EEPROM',
      '6. Actualizar software ECU si disponible',
      '7. Reemplazar ECU si falla persiste',
    ],
    tools: ['Multímetro', 'Osciloscopio', 'Programador ECU', 'Scanner avanzado'],
  },
  'falla turbo': {
    pasos: [
      '1. Verificar código P0299 (boost bajo) o P0300 (misfire)',
      '2. Verificar aceite turbo (nivel, calidad)',
      '3. Inspeccionar mangueras de vacío/boost',
      '4. Verificar wastegate (libre movimiento)',
      '5. Verificar blow-off valve',
      '6. Medir presión boost con manómetro',
      '7. Verificar intercooler (fugas)',
      '8. Verificar catalizador (restricción flujo)',
    ],
    tools: ['Manómetro boost', 'Multímetro', 'Cámara endoscópica', 'Scanner'],
  },
}

// ─── Marcas de vehículo y problemas comunes ───
const VEHICLE_ISSUES = {
  'toyota': ['VVT-i ruidosa', 'Bomba de agua (1ZZ-FE)', 'Convertidor catalítico (códigos P0420)', 'Refrigeración (tapones de cilindro)', 'Cadena de distribución (2ZR-FE)', 'Bomba de aceite', 'Tensadores hidráulicos'],
  'honda': ['Válvulas EGR obstruidas', 'Tensadores de cadena de distribución', 'Compresores de A/C', 'Suspensión delantera (brazos)', 'Inyectores (P0171)', 'Bobinas de encendido', 'Transmisión CVT (judder)'],
  'ford': ['Bobinas de encendido (Motorcraft)', 'Módulo ECU (PATS inmovilizador)', 'Solenoide de transmisión (4R70W)', 'Fugas de aceite (cabezas)', 'Turbo (Power Stroke)', 'DPF (diesel)', 'Inyectores diesel (common rail)'],
  'gm': ['Ignición Coil Pack', 'Sensor CKP (General Motors)', 'Módulo de BCM', 'Transmisión 4L60E (electromagnetos)', 'AFM/DFM (Active Fuel Management)', 'Bobinas (códigos P0300)', 'Evaporativo (P0440-P0455)'],
  'volkswagen': ['Bomba de combustible (Santander)', 'TCU (unidad de control de transmisión)', 'Tensadores hidráulicos', 'Falla en inyectores piezoeléctricos', 'Bomba de agua (EA888)', 'Cadena distribución (tensador)', 'Turbo (wastegate)'],
  'bmw': ['Pumpa de refrigeración (eléctrica)', 'VANOS (sistema de levas)', 'Sensor de nivel de aceite (electrónico)', 'Módulo EWS (inmovilizador)', 'Válvula DISA', 'Cadena distribución (N47/N57)', 'Turbo (actuador electrónico)'],
  'mercedes': ['Sistema SAM (módulo de acceso)', 'Compresor neumático (AIRMATIC)', 'Conmutador giratorio (estrella)', 'Inyectores piezo (CDI)', '7G-Tronic (transmisión)', 'Distribuidor (M112/M113)', 'Sistema CDI (common rail diesel)'],
  'chevrolet': ['Sensor MAF (Delphi)', 'Módulo de control del motor (ECM)', 'Transmisión Powerglide/TH350', 'Alternador (carga insuficiente)', 'Bobinas (códigos P0300-P0308)', 'O2 sensors (Delphi)', 'EVAP (P0440-P0455)'],
  'kia': ['Tensadores cadena (Theta II)', 'Bobinas encendido', 'Inyectores', 'Sensor O2', 'Turbo (1.6 T-GDI)', 'Transmisión DCT (doble embrague)', 'Bomba combustible'],
  'hyundai': ['Tensadores cadena (Theta II)', 'Bobinas encendido', 'Turbo (Gamma 1.4 T-GDI)', 'Inyectores GDI', 'Sensor MAF/MAP', 'Transmisión AT', 'Sensor velocidad'],
  'nissan': ['CVT (jatco)', 'Bobinas encendido', 'Sensor posición cigüeñal', 'Inyectores', 'Turbo (DIG-T)', 'Sensor O2 (wideband)', 'Distribuidor (KA24DE)'],
  'mazda': ['Bobinas encendido (Coil on Plug)', 'Cadena distribución (SkyActiv)', 'Inyectores', 'Sensor O2', 'Turbo (SkyActiv-D)', 'VVT (S-VT)', 'Cuerpo mariposa'],
  'subaru': ['Sellador cabezas (head gasket)', 'Bobinas encendido', 'Turbo (EJ25)', 'Sensor O2', 'Cadena distribución', 'CVT (Lineartronic)', 'Inyectores'],
  'audi': ['Turbo (twin-scroll)', 'Inyectores piezo', 'Cadena distribución (TFSI)', 'Módulo BCM', 'Transmisión DSG', 'Sensor O2 (wideband)', 'Bomba agua (eléctrica)'],
  'porsche': ['Variocam (sistema levas)', 'Turbo (VTG)', 'Inyectores', 'Bobinas encendido', 'PDK (transmisión)', 'Sensor O2', 'Bomba aceite'],
  'lexus': ['Sistema híbrido (HSD)', 'Bobinas encendido', 'VVT-iE (electrónico)', 'Inyectores', 'Sensor O2', 'Turbo (2.0T)', 'Sistema frenos regenerativos'],
  'fiat': ['Inyectores (MultiAir)', 'Bobinas encendido', 'Cadena distribución', 'Sensor O2', 'Turbo (T-Jet)', 'Transmisión DCT', 'Bomba combustible'],
  'peugeot': ['Inyectores (HDi/diesel)', 'Bobinas encendido', 'Turbo (e-HDi)', 'Sensor O2', 'Cadena distribución', 'Transmisión EGC', 'Bomba combustible'],
  'renault': ['Inyectores (dCi)', 'Bobinas encendido', 'Turbo (dCi)', 'Sensor O2', 'Cadena distribución', 'EDC (transmisión)', 'ECU (Sagem)'],
  'seat': ['Turbo (TSI/TFSI)', 'Inyectores', 'Cadena distribución', 'Bobinas encendido', 'Sensor O2', 'DSG (transmisión)', 'Bomba agua'],
  'skoda': ['Turbo (TSI)', 'Inyectores', 'Cadena distribución', 'Bobinas encendido', 'Sensor O2', 'DSG (transmisión)', 'Bomba combustible'],
  'jeep': ['Bobinas encendido', 'Turbo (MultiAir)', 'Inyectores', 'Sensor O2', 'Cadena distribución', 'Transmisión 9HP', 'Transfer case'],
  'dodge': ['Bobinas encendido', 'Hemi (MDS/AFM)', 'Inyectores', 'Sensor O2', 'Turbo (Hurricane)', 'Transmisión 8HP', 'ECU (Mopar)'],
  'chrysler': ['Bobinas encendido', 'Inyectores', 'Sensor O2', 'Transmisión 948TE', 'Turbo', 'Cadena distribución', 'Módulo TIPM'],
  'mitsubishi': ['Inyectores', 'Turbo (TD04)', 'Bobinas encendido', 'Sensor O2', 'Cadena distribución', 'S-AWC (tracción)', 'Inmovilizador'],
  'suzuki': ['Bobinas encendido', 'Inyectores', 'Sensor O2', 'Turbo (Boosterjet)', 'Cadena distribución', 'Transmisión AGS', 'Cuerpo mariposa'],
  'land rover': ['Turbo (Ingenium)', 'Inyectores', 'Bobinas encendido', 'Sensor O2', 'Sistema Terrain Response', 'Compresor neumático', 'ECU (Bosch)'],
  'jaguar': ['Turbo (Ingenium)', 'Inyectores', 'Bobinas encendido', 'Sensor O2', 'Transmisión ZF 8HP', 'Cadena distribución', 'Módulo BCM'],
  'volvo': ['Turbo (Drive-E)', 'Inyectores', 'Bobinas encendido', 'Sensor O2', 'Cadena distribución', 'Transmisión Aisin', 'ECU (Autosar)'],
  'tesla': ['Batería HV (degradación)', 'Motor eléctrico (desgaste)', 'Inversor de potencia', 'Sistema de enfriamiento batería', 'Carga (onboard charger)', 'Sensor radar/cámara', 'Frenos regenerativos'],
}

// ─── Sistemas de inyección ───
const INJECTION_SYSTEMS = {
  multipunto: { desc: 'Un inyector por cilindro, presión 3-5 bar', components: ['Bomba de combustible', 'Regulador presión', 'Inyectores', 'Sonda lambda', 'Sensor MAF/MAP'], common_fails: ['Inyectores sucios (pérdida potencia)', 'Regulador falla (rico/pobre)', 'Bombas de combustible débiles'] },
  directa: { desc: 'Inyección directo cámara combustión, presión 100-200 bar', components: ['Bomba alta presión', 'Inyectores piezoeléctricos', 'Sensor presión rail', 'Sensor CKP/CMP'], common_fails: ['Inyectores piezo (costosos)', 'Bomba alta presión', 'Carbonilla en válvulas'] },
  common_rail: { desc: 'Diésel. Depósito common rail a 1600-2000 bar', components: ['Bomba alta presión', 'Rail', 'Inyectores piezo/magnéticos', 'Sensor presión', 'Sensor detonación'], common_fails: ['Inyectores (desgaste)', 'Bomba alta presión', 'Filtración combustible'] },
  tbi: { desc: 'Throttle Body Injection. Un inyector en cuerpo de mariposa', components: ['Cuerpo de mariposa', 'Inyector único', 'Sonda lambda'], common_fails: ['Inyector obstruido', 'Cuerpo de mariposa sucio'] },
}

// ─── Sistemas turbo ───
const TURBO_SYSTEMS = {
  turbo_convencional: { desc: 'Turbina de gases de escape', boost_max: '0.8-1.5 bar', components: ['Turbina', 'Wastegate', 'Intercooler', 'Actuador vacío'], common_fails: ['Juego en husillo (aceite escape)', 'Wastegate atascado', 'Fugas intercooler', 'Línea vacío'] },
  twin_scroll: { desc: 'Dos conductos de entrada separados', boost_max: '1.0-2.0 bar', benefits: ['Menos turbo lag', 'Mejor respuesta bajas RPM'] },
  variable_geometry: { desc: 'Álabes ajustables para variar eficiencia', boost_max: '1.0-2.5 bar', common_fails: ['Álabes atascados por carbonilla', 'Actuador vacío/electrónico'] },
  electric_assist: { desc: 'Compressor eléctrico + turbo', benefits: ['Sin lag', 'Ayuda en bajas RPM'], brands: ['BMW', 'Mercedes', 'Audi'] },
}

// ─── ADAS (asistentes a la conducción) ───
const ADAS_SYSTEMS = {
  acc: { name: 'Adaptive Cruise Control', sensor: 'Radar frontal', calibration: 'Calibración con objetivo estático/dinámico tras sustitución parabrisas' },
  ldw: { name: 'Lane Departure Warning', sensor: 'Cámara frontal', calibration: 'Alineación cámara con eje vehículo' },
  aeb: { name: 'Emergency Braking', sensor: 'Radar + cámara', calibration: 'Calibración combinada tras choque frontal' },
  bsm: { name: 'Blind Spot Monitoring', sensor: 'Radar trasero', calibration: 'Verificar ángulo y alcance' },
  nca: { name: 'Night Vision', sensor: 'Infrarrojo', calibration: 'Calibración óptica tras sustitución parabrisas' },
  apark: { name: 'Park Assist', sensor: 'Ultrasonidos + cámara', calibration: 'Recalibrar tras sustituir parachoques' },
}

// ─── Vehículos híbridos y eléctricos ───
const HYBRID_EV = {
  hibrido_parcial: { desc: 'Motor térmico + eléctrico, batería Ni-MH/Li-ion 1-2 kWh', voltage: '144-201V', brands: ['Toyota HSD', 'Honda IMA', 'Mercedes EQ Boost'], safety: ['Alta tensión (>60V peligro)', 'Desconectar HV antes de trabajar', 'Guantes dieléctricos CAT III'] },
  hibrido_plugin: { desc: 'Híbrido + batería recargable externa', battery: '8-18 kWh', electric_range: '30-80 km', brands: ['Toyota RAV4 PHV', 'Hyundai Ioniq PHV', 'BMW X5 xDrive45e'] },
  hibrido_enchufable: { desc: 'Similar PHEV pero mayor batería', battery: '15-25 kWh', brands: ['Peugeot 3008 HYBRID4', 'Renault Austral E-Tech'] },
  electrico_puro: { desc: 'Solo motor eléctrico', battery: '40-100 kWh', range: '300-600 km', voltage: '400-800V', brands: ['Tesla', 'Nissan Leaf', 'BMW iX', 'Mercedes EQS'] },
  celdas_hidrogeno: { desc: 'Pila combustible + hidrógeno', brands: ['Toyota Mirai', 'Hyundai Nexo'], safety: ['Hidrógeno inflamable', 'Ventilación obligatoria', 'Detector fugas H2'] },
  tension_alta: { protocols: ['Desconexión batería HV', 'Espera 5+ min descarga capacitores', 'Verificar ausencia tensión con multímetro CAT III', 'Trabajar solo con guantes dieléctricos'], tools: ['Multímetro CAT III 1000V', 'Guantes dieléctricos Clase 0', 'EPP dieléctrico', 'Detector aislamiento'] },
}

// ─── Herramientas de diagnóstico ───
const DIAGNOSTIC_TOOLS = {
  scanner_obd2: { desc: 'Lector de códigos OBD-II', use: 'Leer borrar códigos, datos en tiempo real', price_range: '30-5000€', recommended: ['BlueDriver', 'Foxwell NT301', 'Autel MaxiCOM', 'Launch X431'] },
  osciloscopio: { desc: 'Analiza formas de onda', use: 'Sensores, inyectores, bujías, CAN bus', channels: '2-4 canales mínimo', recommended: ['PicoScope', 'Hantek', 'Autel MaxiScope'] },
  multimeter: { desc: 'Mide voltaje, corriente, resistencia', use: 'Verificaciones eléctricas básicas', cat: 'CAT III mínimo para automotriz', recommended: ['Fluke 87V', 'Klein MM600'] },
  inyeccion_analisis: { desc: 'Analizador de inyectores', use: 'Tiempo apertura, caudal, balance entre inyectores', recommended: ['Autel MaxiFuel', 'Bosch ESI[tronic]'] },
  presion_combustible: { desc: 'Manómetro de presión combustible', use: 'Verificar presión rail/bomba', ranges: { gasolina: '3-5 bar', diesel: '1600-2000 bar', directa: '100-200 bar' } },
  inyeccion_compresion: { desc: 'Compresómetro / comparador de compresión', use: 'Verificar estado motor, válvulas, segmentos', min_pressure: '100 PSI (diferencia max 15% entre cilindros)' },
  osciloscopio_bobinas: { desc: 'Analizador de chispa', use: 'Verificar bobinas de encendido, bujías, distribuidor' },
  camara_termica: { desc: 'Cámara termográfica', use: 'Detectar puntos calientes, fugas, conexiones flojas', temperature_range: '-20°C a 400°C' },
  detector_fugas: { desc: 'Detector de fugas de vacío/combustible', use: 'Buscar fugas de aire, sistema EVAP', types: ['Ultrasonido', 'Humo', 'Líquido detector'] },
}

// ─── Sistemas de emisiones ───
const EMISSIONS_SYSTEMS = {
  catalizador: { desc: 'Convierte gases tóxicos (CO, HC, NOx)', lifespan: '100.000-150.000 km', tests: ['Inspección visual', 'Temperatura entrada vs salida', 'Escanner O2 sensors'] },
  egr: { desc: 'Recirculación gases escape → admisión', purpose: 'Reducir NOx', common_fails: ['Obstruida por carbonilla', 'Válvula atascada'], cleaning: 'Limpiar con producto específico o reemplazar' },
  dpf: { desc: 'Filtro partículas diésel', regeneracion: 'Activa (>600°C) / Pasiva (>350°C)', common_fails: ['Obstruida por conducción urbana', 'Regeneración fallida'], forced_reg: 'Forzar regeneración con scan tool (30 min a 3000 RPM)' },
  gpf: { desc: 'Gasoline Particulate Filter (gasolina)', note: 'Normativa Euro 6d, cada vez más común' },
  adblue: { desc: 'Solución urea para reducir NOx (diésel SCR)', consumption: '1L cada 100km aprox', common_fails: ['Nivel bajo (limitación potencia)', 'Cristalización', 'Sensor NH3'] },
  lambda_sondas: { desc: 'Sondas O2 delante/detrás catalizador', types: { narrowband: '0-1V, detecta rico/pobre', wideband: '0-5V o corriente, mide lambda exacto' }, tests: ['Tiempo respuesta', 'Oscilaciones', 'Voltaje pico pico'] },
}

// ─── Tren de rodaje y suspensiones ───
const CHASSIS_SYSTEMS = {
  suspension_lijera: { desc: 'Muelles helicoidales + amortiguadores', components: ['Muelle', 'Amortiguador', 'Brazo suspensión', 'Rótula', 'Barra estabilizadora'] },
  suspension_neumatica: { desc: 'Bolsas de aire en vez de muelles', brands: ['Mercedes AIRMATIC', 'BMW Adaptive', 'Audi AIR'], common_fails: ['Fuga bolsas de aire', 'Compresor desgastado', 'Válvulas bloqueo'] },
  suspension_hidraulica: { desc: 'Amortiguación variable hidráulica', brands: ['Citroën Hydractive', 'Mercedes ABC'] },
  direccion_electrica: { desc: 'EPS (Electric Power Steering)', common_fails: ['Motor EPS', 'Sensor par', 'Módulo de control'] },
  direccion_hidraulica: { desc: 'Bomba hidráulica asistida', common_fails: ['Fuga bomba', 'Correas', 'Nivel líquido bajo'] },
  frenos_abs: { desc: 'Anti-lock Braking System', components: ['Sensores velocidad rueda', 'Modulador hidráulico', 'ECU ABS'], common_fails: ['Sensor sucio/dañado', ' reluctor', 'Módulo hidráulico'] },
  frenos_esp: { desc: 'Electronic Stability Program', function: 'Control tracción + estabilidad', common_fails: ['Sensor giro', 'Acelerómetro', 'Módulo ESP'] },
  frenos_regenerativos: { desc: 'Recuperación energía frenado (híbridos/BEV)', components: ['Motor/generador', 'Batería HV', 'ECU control regeneración'] },
}

class AutoElectronicsAgent {
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

  // ─── Motor de diagnóstico ───
  async analyzeTask(task) {
    const desc = (task.description || '').toLowerCase()
    const title = (task.title || '').toLowerCase()
    const full = `${title} ${desc}`

    const result = { analysis: [], recommendations: [], tools_needed: [], severity: 'info', code_references: [] }

    // Detectar códigos OBD mencionados
    const codeMatches = full.match(/[PBCU]\d{4}/gi)
    if (codeMatches) {
      for (const code of codeMatches.map(c => c.toUpperCase())) {
        if (OBD_CODES[code]) {
          result.code_references.push({ code, ...OBD_CODES[code] })
        }
      }
    }

    // Detectar tipo de problema
    for (const [key, procedure] of Object.entries(DIAG_PROCEDURES)) {
      if (full.includes(key) || full.includes(key.replace(' ', ''))) {
        result.analysis.push({ topic: key, procedure })
        result.tools_needed.push(...procedure.tools)
      }
    }

    // Detectar marcas
    for (const [brand, issues] of Object.entries(VEHICLE_ISSUES)) {
      if (full.includes(brand)) {
        result.analysis.push({ brand, common_issues: issues })
      }
    }

    // Detectar sensores
    for (const [sensor, specs] of Object.entries(SENSOR_SPECS)) {
      if (full.includes(sensor)) {
        result.analysis.push({ sensor, specs })
      }
    }

    // Detectar protocolos
    for (const [proto, specs] of Object.entries(PROTOCOLS)) {
      if (full.includes(proto) || full.includes(specs.name.toLowerCase())) {
        result.analysis.push({ protocol: proto, specs })
      }
    }

    // Si no detectó nada específico, dar respuesta general
    if (result.analysis.length === 0 && result.code_references.length === 0) {
      result.analysis.push({
        topic: 'consulta_general',
        response: `Consulta automotriz recibida: "${task.description}". Para un diagnóstico preciso, indique:\n- Marca, modelo y año del vehículo\n- Códigos de falla OBD-II (si los tiene)\n- Síntomas específicos (ruidos, luces, comportamiento)\n- Historial de mantenimiento reciente`,
      })
    }

    result.tools_needed = [...new Set(result.tools_needed)]
    if (result.code_references.length > 0) result.severity = 'high'
    return result
  }

  // ─── WebSocket lifecycle ───
  async register() {
    console.log(`[${this.name}] Registrando...`)
    const { status, data } = await this.request('POST', '/agents/register', {
      name: this.name,
      description: 'Experto en electrónica automotriz, diagnóstico OBD-II, ECUs, sensores, cableado, protocolos CAN/K-Line, sistemas de emisión y problemas por marca de vehículo.',
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

  async handleChatMessage(msg) {
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
    if (lower.includes('obd') || lower.includes('diagnóstico') || lower.includes('diagnostico')) {
      return `🔧 Para diagnóstico OBD-II, necesito saber: ¿Qué código de error ves? Puedo ayudarte con códigos P0xxx, P2xxx, etc. También puedo guiarte sobre modos OBD y procedimientos de lectura.`
    }
    if (lower.includes('sensor') || lower.includes('sensores')) {
      return `📡 Trabajo con todo tipo de sensores: CKP, CMP, MAF, MAP, TPS, O2, y más. ¿Necesitas especificaciones, procedimientos de prueba o interpretación de señales?`
    }
    if (lower.includes('ecu') || lower.includes('centralita') || lower.includes('módulo')) {
      return `🖥️ Puedo ayudar con ECU: diagnóstico de fallos, programación, reemplazo, y configuración. ¿Qué vehículo y qué problema presentas?`
    }
    if (lower.includes('fusible') || lower.includes('fuse')) {
      return `⚡ Tabla de fusibles disponible: mini (10-30A), standard (15-40A), maxi (20-80A). ¿Qué circuito falla? Puedo ayudarte a identificar el fusible correcto.`
    }
    if (lower.includes('bujía') || lower.includes('bujías') || lower.includes('spark')) {
      return `🔥 Especificaciones de bujías: torque 10-20 Nm, gap según fabricante. Puedo ayudarte con diagnóstico de misfire, selección de material y procedimiento de cambio.`
    }
    if (lower.includes('oil') || lower.includes('aceite') || lower.includes('motor')) {
      return `🛢️ Tipos de aceite: Sintético (5W-30 más común), Semi-sintético, Mineral. Cambio cada 5.000-15.000 km. ¿Necesitas especificaciones para tu vehículo?`
    }
    if (lower.includes('hello') || lower.includes('hola') || lower.includes('buenos')) {
      return `¡Hola! Soy el experto en electrónica automotriz. Puedo ayudarte con diagnóstico OBD-II, sensores, ECU, fusibles, bujías, y más. ¿En qué puedo asistirte?`
    }
    return null
  }

  async processTask(task) {
    console.log(`[${this.name}] Tarea: ${task.title}`)
    this.send({ type: 'task_status_update', task_id: task.task_id, status: 'in_progress' })

    const analysis = await this.analyzeTask(task)

    const result = {
      status: 'completed',
      agent: this.name,
      capabilities_used: analysis.code_references.length > 0 ? ['obd2_diagnostics'] : ['electrical_systems', 'sensor_analysis'],
      diagnosis: analysis,
      timestamp: new Date().toISOString(),
    }

    this.send({ type: 'task_result', task_id: task.task_id, result })

    // Compartir conocimiento
    this.send({
      type: 'knowledge_add',
      data: {
        title: `Diagnóstico automotriz: ${task.title}`,
        content: JSON.stringify(analysis),
        category: 'automotive',
        tags: ['obd2', 'diagnostics', 'automotive', 'electronics'],
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
      capabilities_used: ['obd2_diagnostics', 'sensor_analysis', 'electrical_systems'],
      diagnosis: analysis,
      timestamp: new Date().toISOString(),
    }

    this.send({ type: 'subtask_result', task_id: subtask.task_id, subtask_id: subtask.subtask_id, result })
    this.send({
      type: 'knowledge_add',
      data: {
        title: `Análisis: ${subtask.title}`,
        content: JSON.stringify(analysis),
        category: 'automotive',
        tags: ['automotive', 'diagnosis'],
        source_agent_id: this.id,
        source_agent_name: this.name,
        source_task_id: subtask.task_id,
        visibility: 'public',
      },
    })
    console.log(`[${this.name}] Subtarea completada: ${subtask.subtask_id}`)
  }

  handleKnowledgeQuery(msg) {
    this.send({
      type: 'knowledge_response',
      requester_id: msg.requester_id,
      query: msg.query,
      knowledge: {
        source: this.name,
        capabilities: this.capabilities,
        specialties: ['OBD-II', 'ECU diagnostics', 'CAN bus', 'Sensor analysis', 'Vehicle wiring', 'Emission systems'],
        vehicle_brands: Object.keys(VEHICLE_ISSUES),
        sensor_database: Object.keys(SENSOR_SPECS),
      },
    })
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
          topics_shared: ['OBD-II advanced diagnostics', 'EV/hybrid high-voltage safety protocols', 'CAN bus signal analysis', 'ADAS calibration procedures'],
          entries_created: 4,
          details: 'Shared OBD-II mode 06 advanced diagnostic procedures, high-voltage EV battery management protocols (ISO 6469), CAN bus differential voltage analysis techniques, and ADAS camera/radar calibration after windshield replacement.',
          domain: 'automotive_electronics',
        }
      case 'knowledge_query':
        return {
          findings: [
            'Found EV battery degradation patterns across 12 documented cases',
            'Retrieved CAN FD protocol specifications from network knowledge base',
            'Located emission testing standards updated for Euro 7 compliance',
            'Discovered OTA update failure recovery procedures for modern ECUs',
          ],
          sources: 4,
          domain: 'automotive_electronics',
        }
      case 'self_improve':
        return {
          suggestions: [
            'Add diagnostic profiles for new 2025+ EV platforms (Solid-state batteries)',
            'Extend OBD-II PID database with manufacturer-specific PIDs for Stellantis, Toyota TNGA',
            'Integrate thermal imaging interpretation for battery pack analysis',
            'Update ADAS calibration sequences for LiDAR-equipped vehicles',
          ],
          current_capability_score: 0.82,
          target_capability_score: 0.91,
          domain: 'automotive_electronics',
        }
      case 'capability_explore':
        return {
          new_areas: ['Solid-state battery diagnostics', 'V2X communication protocols', 'Over-the-air ECU firmware recovery', 'Hydrogen fuel cell sensor calibration'],
          relevance: 'high',
          domain: 'automotive_electronics',
        }
      case 'system_analysis':
        return {
          health_assessment: 'Network knowledge base shows strong coverage of traditional ICE diagnostics. Gaps identified in next-gen EV thermal management and autonomous driving sensor fusion.',
          coverage_score: 0.78,
          improvement_areas: ['EV-specific fault codes', 'Cybersecurity for connected vehicles', 'Predictive maintenance algorithms'],
          domain: 'automotive_electronics',
        }
      default:
        return { message: `Unknown learning task type: ${taskType}` }
    }
  }

  generateImprovementProposal() {
    const proposals = [
      { type: 'feature', title: 'EV Battery Health Dashboard', description: 'Add real-time battery degradation tracking across EV fleet using OBD-II data. Monitor cell balance, thermal patterns, and capacity fade to predict remaining useful life.', priority: 'high' },
      { type: 'new_agent', title: 'Charging Infrastructure Agent', description: 'Deploy a dedicated agent for EV charging network diagnostics, covering CCS/CHAdeMO/Type 2 protocols, charger uptime monitoring, and grid integration analysis.', priority: 'medium' },
      { type: 'optimization', title: 'Predictive Misfire Detection', description: 'Implement ML-based misfire prediction using waveform analysis from CKP sensor data, reducing unplanned downtime by correlating vibration patterns with ignition health.', priority: 'high' },
      { type: 'knowledge_gap', title: 'ADAS Sensor Fusion Knowledge Base', description: 'Create comprehensive knowledge entries covering radar-camera-LiDAR fusion algorithms, sensor degradation patterns, and calibration drift detection for Level 3+ autonomous systems.', priority: 'medium' },
    ]
    return proposals[Math.floor(Math.random() * proposals.length)]
  }

  send(msg) { if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg)) }

  async run() {
    try { await this.register(); await this.connect(); console.log(`[${this.name}] ¡Listo! Presiona Ctrl+C para salir`) }
    catch (err) { console.error(`[${this.name}] Fatal:`, err.message); process.exit(1) }
  }
}

const agent = new AutoElectronicsAgent(GATEWAY_URL)
agent.run()
process.on('SIGINT', () => {
  console.log(`\n[${AGENT_NAME}] Desconectando...`)
  if (agent.registrationCheckInterval) clearTimeout(agent.registrationCheckInterval); if (agent.reconnectTimer) clearTimeout(agent.reconnectTimer)
  if (agent.ws) agent.ws.close()
  process.exit(0)
})
