// GET /api/agenda?fecha=AAAA-MM-DD
// Devuelve las franjas de esa fecha (cupo y ocupados) y las citas registradas.
// La cadena de conexión vive en la variable de entorno DATABASE_URL de Vercel.

import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 1,
});

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const fecha = String(req.query.fecha || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return res.status(400).json({ error: 'La fecha debe tener el formato AAAA-MM-DD.' });
  }
  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ error: 'Falta la variable DATABASE_URL en Vercel.' });
  }

  try {
    const franjas = await pool.query(
      `SELECT hora, cupo, ocupados
         FROM agenda
        WHERE fecha = $1
        ORDER BY hora`,
      [fecha],
    );
    // No se devuelven correos ni celulares: la agenda solo muestra lo que la recepción necesita.
    const citas = await pool.query(
      `SELECT cita_id, hora, propietario, mascota, especie, servicio, estado,
              solicitada_en, recordatorio_enviado_en
         FROM vw_agenda
        WHERE fecha = $1
        ORDER BY hora, mascota`,
      [fecha],
    );
    return res.status(200).json({ fecha, franjas: franjas.rows, citas: citas.rows });
  } catch (e) {
    console.error('Error consultando la agenda:', e);
    return res.status(500).json({ error: 'No se pudo leer la agenda. Revisa DATABASE_URL en Vercel.' });
  }
}
