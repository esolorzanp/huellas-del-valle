    // Casos de prueba del enunciado. Luna usa el mismo correo en C1 y C5:
    // así el sistema reconoce que es la misma mascota.
    const CASOS = {
      C1: { propietario: 'Ana Pérez', correo: 'edwin.solorzano+luna@gmail.com', celular: '3000000001', mascota: 'Luna', especie: 'perro', servicio: 'Consulta general', fecha: '2026-10-14', hora: '08:00' },
      C2: { propietario: 'Carlos Gómez', correo: 'edwin.solorzano+michi@gmail.com', celular: '3000000002', mascota: 'Michi', especie: 'gato', servicio: 'Vacunación', fecha: '2026-10-14', hora: '10:00' },
      C3: { propietario: 'Diana Ruiz', correo: 'edwin.solorzano+rocky@gmail.com', celular: '3000000003', mascota: 'Rocky', especie: 'perro', servicio: 'Baño', fecha: '2026-10-14', hora: '11:00' },
      C4: { propietario: 'Jorge Castro', correo: 'edwin.solorzano+pelusa@gmail.com', celular: '3000000004', mascota: 'Pelusa', especie: 'gato', servicio: 'Consulta general', fecha: '2026-10-20', hora: '08:00' },
      C5: { propietario: 'Ana Pérez', correo: 'edwin.solorzano+luna@gmail.com', celular: '3000000001', mascota: 'Luna', especie: 'perro', servicio: 'Baño', fecha: '2026-10-14', hora: '09:00' },
    };

    const $ = (id) => document.getElementById(id);
    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const horaCO = (iso) => iso ? new Date(iso).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'medium' }) : '';

    // Horas en punto de 07:00 a 18:00
    for (let h = 7; h <= 18; h++) {
      const v = String(h).padStart(2, '0') + ':00';
      $('hora').add(new Option(v, v, false, v === '08:00'));
    }

    $('caso').addEventListener('change', (e) => {
      const c = CASOS[e.target.value];
      if (!c) return;
      for (const [k, v] of Object.entries(c)) $(k).value = v;
      $('resultado').innerHTML = '';
    });

    // ---------- Agendar ----------
    function pintarResultado(json, solicitud) {
      const r = json.respuesta || {};
      const mascota = esc(solicitud.mascota);
      let clase = 'r-error', titulo = 'Sin respuesta del proceso', texto = '';

      switch (r.resultado) {
        case 'CONFIRMADA':
          clase = 'r-confirmada'; titulo = 'Cita confirmada';
          texto = `La cita de ${mascota} quedó registrada. Le enviamos la confirmación a ${esc(solicitud.correo)}. Quedan ${esc(r.libres)} cupos libres en esa franja.`;
          break;
        case 'CONFIRMADA_ALERTA':
          clase = 'r-alerta'; titulo = 'Cita confirmada, la franja se está llenando';
          const quedan = Number(r.libres) <= 0 ? 'quedó llena' : `quedó con ${esc(r.libres)} cupo libre`;
          texto = `La cita de ${mascota} quedó registrada y confirmada por correo. La franja ${quedan}, así que avisamos a la administración.`;
          break;
        case 'RECHAZADA':
          clase = 'r-rechazada'; titulo = 'No se pudo agendar';
          texto = Number(r.libres) <= 0
            ? 'La franja ya está llena. Elige otra hora o fecha. No se registró nada.'
            : `${mascota} ya tiene una cita de ese servicio ese día, o ya tiene otra cita a esa misma hora. No se registró nada.`;
          break;
        case 'RESPALDO':
          clase = 'r-respaldo'; titulo = 'Esa franja no está en la agenda';
          texto = `La clínica no atiende en esa fecha y hora. Quedó registrada la incidencia #${esc(r.incidencia_id)} para que la recepción se comunique contigo.`;
          break;
        case 'SIN_RESPUESTA':
          texto = 'Make recibió la solicitud pero no devolvió un resultado. Revisa que el escenario 1 esté activo.';
          break;
        default:
          texto = esc(json.error || 'La respuesta no tiene un resultado conocido.');
      }

      $('resultado').innerHTML = `
        <div class="resultado ${clase}">
          <h3>${titulo}</h3>
          <p>${texto}</p>
          <p class="cuando">Enviada: ${horaCO(json.enviado_en)}${json.recibido_en ? ` · Respondida: ${horaCO(json.recibido_en)}` : ''}</p>
          <details><summary>Ver la respuesta del proceso</summary><pre>${esc(JSON.stringify(json.respuesta ?? json, null, 2))}</pre></details>
        </div>`;
    }

    $('form-cita').addEventListener('submit', async (e) => {
      e.preventDefault();
      const solicitud = Object.fromEntries(new FormData(e.target).entries());
      $('btn-agendar').disabled = true;
      $('enviando').hidden = false;
      $('resultado').innerHTML = '';
      try {
        const resp = await fetch('/api/agendar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(solicitud),
        });
        const json = await resp.json();
        if (resp.status === 400) {
          $('resultado').innerHTML = `<div class="resultado r-error"><h3>Revisa los datos</h3><p>${(json.detalles || []).map((d) => esc(d.mensaje)).join('<br>')}</p></div>`;
          return;
        }
        pintarResultado(json, solicitud);
        if (solicitud.fecha === $('fecha-agenda').value) cargarAgenda();
      } catch (err) {
        $('resultado').innerHTML = `<div class="resultado r-error"><h3>No hubo conexión</h3><p>No se pudo enviar la solicitud. Revisa tu conexión e inténtalo de nuevo.</p></div>`;
      } finally {
        $('btn-agendar').disabled = false;
        $('enviando').hidden = true;
      }
    });

    // ---------- Agenda del día ----------
    const huella = (clase) => `<span class="cupo ${clase}"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#huella"/></svg></span>`;
    const ESTADOS = { CONFIRMADA: 'Confirmada', CONFIRMADA_ALERTA: 'Confirmada con alerta', CANCELADA: 'Cancelada', ATENDIDA: 'Atendida', NO_ASISTIO: 'No asistió' };

    async function cargarAgenda() {
      const fecha = $('fecha-agenda').value;
      if (!fecha) return;
      $('tablero').innerHTML = '<li class="vacio">Cargando…</li>';
      $('citas').innerHTML = '';
      try {
        const resp = await fetch(`/api/agenda?fecha=${encodeURIComponent(fecha)}`);
        const json = await resp.json();
        if (!resp.ok) throw new Error(json.error);

        $('tablero').innerHTML = json.franjas.length
          ? json.franjas.map((f) => {
              const libres = f.cupo - f.ocupados;
              const estado = libres <= 0 ? 'llena' : libres === 1 ? 'casi' : '';
              const puntos = Array.from({ length: f.cupo }, (_, i) => huella(i < f.ocupados ? 'ocupado' : 'libre')).join('');
              const leyenda = libres <= 0 ? 'Llena' : libres === 1 ? '1 libre' : `${libres} libres`;
              return `<li class="franja ${estado}">
                <span class="franja-hora">${esc(f.hora)}</span>
                <span class="cupos" role="img" aria-label="${f.ocupados} de ${f.cupo} cupos ocupados">${puntos}</span>
                <span class="franja-libres">${leyenda}</span>
              </li>`;
            }).join('')
          : '<li class="vacio">La clínica no tiene franjas para esta fecha.</li>';

        $('citas').innerHTML = json.citas.length
          ? json.citas.map((c) => `<tr>
              <td class="fw-bold">${esc(c.hora)}</td>
              <td>${esc(c.mascota)} <span class="text-secondary">(${esc(c.especie)})</span></td>
              <td>${esc(c.servicio)}</td>
              <td>${esc(c.propietario)}</td>
              <td><span class="estado e-${esc(c.estado)}">${esc(ESTADOS[c.estado] || c.estado)}</span></td>
              <td class="text-secondary">${horaCO(c.solicitada_en)}</td>
            </tr>`).join('')
          : '<tr><td colspan="6" class="vacio">Todavía no hay citas para esta fecha.</td></tr>';
      } catch (err) {
        $('tablero').innerHTML = `<li class="vacio">${esc(err.message || 'No se pudo cargar la agenda.')}</li>`;
      }
    }

    $('form-agenda').addEventListener('submit', (e) => { e.preventDefault(); cargarAgenda(); });
    cargarAgenda();
