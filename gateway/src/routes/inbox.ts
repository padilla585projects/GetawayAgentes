import { Hono } from 'hono'
import { Env } from '../models/types'
import { nanoid } from '../services/utils'

const inbox = new Hono<{ Bindings: Env }>()

// Bandeja de entrada simulada de "Suministros Industriales Vega S.L.", una
// distribuidora mayorista de material industrial y ferretería para
// construcción (empresa de prueba para validar el mecanismo del Director
// antes de conectar nada real). 4 categorías con señal distinta:
// - correspondencia: ruido, no debería disparar ningún departamento nuevo
// - facturas: señal para un agente de Contabilidad/Facturación
// - rrhh: señal para un agente de Personal
// - almacen: señal para un agente de Almacén/Inventario
const SEED_EMAILS: Array<{ from_name: string; from_email: string; subject: string; body: string; category: string; days_ago: number }> = [
  // ---- correspondencia (ruido) ----
  {
    from_name: 'Marta Solís — Construcciones Solís',
    from_email: 'marta.solis@construccionessolis.es',
    subject: 'Reunión de la semana que viene',
    body: '¿Podemos mover la reunión del jueves al viernes por la mañana? Nos viene mejor para revisar el pedido de perfilería antes de confirmarlo.',
    category: 'correspondencia',
    days_ago: 1,
  },
  {
    from_name: 'Newsletter FerreExpo',
    from_email: 'noticias@ferreexpo.com',
    subject: 'FerreExpo 2026: reserva ya tu stand',
    body: 'La feria del sector ferretero industrial vuelve en marzo. Reserva tu espacio antes del 15 de enero y consigue un 10% de descuento en la cuota de stand.',
    category: 'correspondencia',
    days_ago: 4,
  },
  {
    from_name: 'Javier Roldán — Talleres Roldán',
    from_email: 'jroldan@talleresroldan.com',
    subject: 'Gracias por la entrega rápida',
    body: 'Solo para deciros que el pedido de anclajes llegó en tiempo record. Seguimos contando con vosotros para la próxima obra.',
    category: 'correspondencia',
    days_ago: 6,
  },
  // ---- facturas (señal: Contabilidad/Facturación) ----
  {
    from_name: 'Facturación — Aceros del Norte S.A.',
    from_email: 'facturacion@acerosdelnorte.com',
    subject: 'Factura #AN-4471 — Perfilería estructural',
    body: 'Adjuntamos la factura #AN-4471 correspondiente al pedido de perfilería estructural del mes pasado, por importe de 8.420,50€. Vencimiento a 30 días.',
    category: 'facturas',
    days_ago: 9,
  },
  {
    from_name: 'Administración — Tornillería Ibérica',
    from_email: 'admin@tornilleriaiberica.es',
    subject: 'Recordatorio: factura #TI-2201 vencida',
    body: 'La factura #TI-2201 por importe de 1.230,00€ venció hace 12 días y sigue pendiente de pago. Por favor confirmadnos fecha de abono o nos ponemos en contacto por teléfono.',
    category: 'facturas',
    days_ago: 2,
  },
  {
    from_name: 'Facturación — Aceros del Norte S.A.',
    from_email: 'facturacion@acerosdelnorte.com',
    subject: 'Factura #AN-4502 — Pedido mensual',
    body: 'Factura #AN-4502 del pedido mensual habitual: chapa galvanizada y perfil tubular, 6.180,00€. Mismo vencimiento a 30 días de siempre.',
    category: 'facturas',
    days_ago: 5,
  },
  {
    from_name: 'Contabilidad — Recambios Bertol',
    from_email: 'contabilidad@recambiosbertol.com',
    subject: 'Posible factura duplicada #RB-990',
    body: 'Hemos detectado que la factura #RB-990 aparece registrada dos veces en nuestro sistema con el mismo importe (2.150,00€). ¿Podéis confirmar si abonasteis ambas o solo una?',
    category: 'facturas',
    days_ago: 3,
  },
  // ---- rrhh (señal: Personal) ----
  {
    from_name: 'Laura Méndez',
    from_email: 'laura.mendez@vega-industrial.es',
    subject: 'Solicitud de vacaciones — segunda quincena de julio',
    body: 'Quería solicitar la segunda quincena de julio de vacaciones. Ya lo he comentado con mi responsable de almacén, pero necesito la confirmación oficial para organizar el turno con el resto del equipo.',
    category: 'rrhh',
    days_ago: 7,
  },
  {
    from_name: 'Carlos Núñez',
    from_email: 'carlos.nunez@vega-industrial.es',
    subject: 'Duda sobre la nómina de este mes',
    body: 'En la nómina de este mes no me aparecen las horas extra del sábado de reposición de stock. ¿Podéis revisarlo? Fueron 4 horas, las apunté en el parte semanal.',
    category: 'rrhh',
    days_ago: 1,
  },
  {
    from_name: 'Recursos Humanos (externo) — Gestoría Prat',
    from_email: 'rrhh@gestoriaprat.com',
    subject: 'Checklist incorporación nuevo mozo de almacén',
    body: 'Para dar de alta al nuevo mozo de almacén que empieza el lunes necesitamos: contrato firmado, alta en Seguridad Social, y el reconocimiento médico de PRL programado. ¿Nos confirmáis fecha del reconocimiento?',
    category: 'rrhh',
    days_ago: 10,
  },
  // ---- almacen (señal: Almacén/Inventario) ----
  {
    from_name: 'Sistema de Inventario Vega',
    from_email: 'alertas@vega-industrial.es',
    subject: 'ALERTA: rotura de stock — Tornillería M8 galvanizada',
    body: 'El artículo "Tornillería M8 galvanizada" ha llegado a stock 0. Hay 3 pedidos de clientes pendientes de servir que incluyen este artículo. Se recomienda repedido urgente al proveedor.',
    category: 'almacen',
    days_ago: 2,
  },
  {
    from_name: 'Pedro Aguilar — Transportes Aguilar',
    from_email: 'pedro@transportesaguilar.com',
    subject: 'Retraso en la entrega de hoy',
    body: 'Os aviso de que el camión con el pedido de chapa galvanizada para Talleres Roldán va a llegar con unas 3 horas de retraso por una avería en ruta. Disculpad las molestias.',
    category: 'almacen',
    days_ago: 4,
  },
  {
    from_name: 'Recepción de Almacén',
    from_email: 'almacen@vega-industrial.es',
    subject: 'Mercancía dañada en la recepción del lote #L-3387',
    body: 'Al recibir el lote #L-3387 de perfil tubular, 6 unidades llegaron con abolladuras importantes, probablemente por mala sujeción en el transporte. Las hemos apartado en la zona de incidencias, pendiente de decidir si se devuelven al proveedor.',
    category: 'almacen',
    days_ago: 6,
  },
  {
    from_name: 'Sistema de Inventario Vega',
    from_email: 'alertas@vega-industrial.es',
    subject: 'Aviso: punto de repedido alcanzado — Anclajes químicos 16mm',
    body: 'El artículo "Anclajes químicos 16mm" ha alcanzado su punto de repedido (25 unidades). Consumo medio mensual: 180 unidades. Se recomienda generar pedido al proveedor habitual esta semana.',
    category: 'almacen',
    days_ago: 8,
  },
  {
    from_name: 'Miguel Ortega — Turno de tarde',
    from_email: 'miguel.ortega@vega-industrial.es',
    subject: 'Falta de espacio en la zona B del almacén',
    body: 'La zona B está saturada desde hace dos semanas, estamos apilando pallets fuera de la zona señalizada. Con el volumen que estamos moviendo últimamente creo que necesitamos revisar la distribución o ampliar la zona de picking.',
    category: 'almacen',
    days_ago: 3,
  },
]

// GET /inbox — lista la bandeja simulada (usada por el panel y por la
// auditoría del Director)
inbox.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM simulated_inbox ORDER BY received_at DESC'
  ).all()
  return c.json(results)
})

// POST /inbox/seed — siembra la bandeja de prueba (idempotente: si ya hay
// correos, no duplica)
inbox.post('/seed', async (c) => {
  const existing = await c.env.DB.prepare('SELECT COUNT(*) as count FROM simulated_inbox').first() as { count: number }
  if (existing.count > 0) {
    return c.json({ message: 'Ya sembrada', count: existing.count })
  }

  const now = Date.now()
  for (const email of SEED_EMAILS) {
    const receivedAt = new Date(now - email.days_ago * 24 * 60 * 60 * 1000).toISOString()
    await c.env.DB.prepare(`
      INSERT INTO simulated_inbox (id, from_name, from_email, subject, body, category, received_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(nanoid(), email.from_name, email.from_email, email.subject, email.body, email.category, receivedAt).run()
  }

  return c.json({ message: 'Bandeja sembrada', count: SEED_EMAILS.length })
})

export default inbox
