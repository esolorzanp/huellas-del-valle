// POST /api/agendar
// Recibe la solicitud de cita desde la interfaz, valida cada campo y la reenvía
// al webhook del escenario 1 de Make. Devuelve a la interfaz lo que Make respondió.
//
// La URL del webhook (y la API key, si se usa) viven en variables de entorno de
// Vercel: nunca quedan en el navegador ni en el repositorio.

const SERVICIOS = ['Consulta general', 'Vacunación', 'Baño', 'Ecografía'];
const ESPECIES = ['perro', 'gato'];

// Sin comillas ni símbolos: lo que pasa esta validación no puede romper el SQL de Make.
const REGLAS = {
  propietario: [/^\p{L}[\p{L} .-]{1,118}$/u, 'El nombre del dueño solo admite letras, espacios, puntos y guiones (2 a 120).'],
  correo: [/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/, 'El correo no tiene un formato válido.'],
  celular: [/^(\d{7,15})?$/, 'El celular debe tener entre 7 y 15 dígitos, o quedar vacío.'],
  mascota: [/^\p{L}[\p{L} -]{0,79}$/u, 'El nombre de la mascota solo admite letras, espacios y guiones.'],
  fecha: [/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener el formato AAAA-MM-DD.'],
  hora: [/^([01]\d|2[0-3]):00$/, 'La hora debe tener el formato HH:MM, en punto.'],
};

const limpiar = (v) => String(v ?? '').trim().replace(/\s+/g, ' ');

function validar(d) {
  const errores = [];
  for (const [campo, [regla, mensaje]] of Object.entries(REGLAS)) {
    if (!regla.test(d[campo])) errores.push({ campo, mensaje });
  }
  if (d.correo.length > 160) errores.push({ campo: 'correo', mensaje: 'El correo es demasiado largo.' });
  if (!ESPECIES.includes(d.especie)) errores.push({ campo: 'especie', mensaje: 'La especie debe ser perro o gato.' });
  if (!SERVICIOS.includes(d.servicio)) errores.push({ campo: 'servicio', mensaje: 'Elige un servicio de la lista.' });
  if (REGLAS.fecha[0].test(d.fecha) && Number.isNaN(Date.parse(`${d.fecha}T00:00:00Z`))) {
    errores.push({ campo: 'fecha', mensaje: 'La fecha no existe en el calendario.' });
  }
  return errores;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Este servicio solo acepta solicitudes POST.' });
  }

  const b = req.body || {};
  const datos = {
    propietario: limpiar(b.propietario),
    correo: limpiar(b.correo).toLowerCase(),
    celular: limpiar(b.celular).replace(/\D/g, ''),
    mascota: limpiar(b.mascota),
    especie: limpiar(b.especie).toLowerCase(),
    servicio: limpiar(b.servicio),
    fecha: limpiar(b.fecha),
    hora: limpiar(b.hora),
  };

  const errores = validar(datos);
  if (errores.length) {
    return res.status(400).json({ error: 'Revisa los datos de la cita.', detalles: errores });
  }

  const url = process.env.MAKE_WEBHOOK_URL;
  if (!url) {
    return res.status(500).json({ error: 'Falta la variable MAKE_WEBHOOK_URL en Vercel.' });
  }

  const headers = { 'Content-Type': 'application/json' };
  if (process.env.MAKE_API_KEY) headers['x-make-apikey'] = process.env.MAKE_API_KEY;

  const enviadoEn = new Date().toISOString();
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(datos),
      signal: AbortSignal.timeout(25000),
    });
    const texto = await r.text();
    let respuesta;
    try {
      respuesta = JSON.parse(texto);
    } catch {
      // Make responde "Accepted" (texto plano) cuando el escenario está apagado.
      respuesta = { resultado: 'SIN_RESPUESTA', texto };
    }
    return res.status(200).json({
      enviado_en: enviadoEn,
      recibido_en: new Date().toISOString(),
      estado_http_make: r.status,
      respuesta,
    });
  } catch (e) {
    console.error('Error llamando al webhook de Make:', e);
    return res.status(502).json({
      enviado_en: enviadoEn,
      error: 'Make no respondió a tiempo. Revisa que el escenario 1 esté activo.',
    });
  }
}
