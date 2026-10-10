# Huellas del Valle · Sistema de agendamiento

Interfaz propia del Parcial 1 (Seminario de Actualización, UNIAJC).

- `index.html`: formulario para agendar y vista «Agenda del día».
- `api/agendar.js`: valida la solicitud y la reenvía al webhook del escenario 1 de Make.
- `api/agenda.js`: lee de PostgreSQL (Supabase) las franjas y las citas de una fecha.

Las claves **no están en el código**: viven en variables de entorno de Vercel.

| Variable | Valor |
|---|---|
| `MAKE_WEBHOOK_URL` | URL del webhook del escenario 1 |
| `DATABASE_URL` | Cadena del *Session pooler* de Supabase, con la contraseña |
| `MAKE_API_KEY` | Opcional: la API key del webhook, si se activa en Make |

## Flujo

```
Navegador → /api/agendar (Vercel) → Webhook de Make → PostgreSQL → Webhook response → Navegador
Navegador → /api/agenda  (Vercel) → PostgreSQL (vista vw_agenda y tabla agenda)
```
