# Tracker de Ventas

Panel propio que junta el gasto de Meta Ads, TikTok Ads y Google Ads con las ventas del gateway, en la misma zona horaria
y la misma moneda, y muestra facturación, gasto, lucro, ROAS, ROI y CPA por campaña, conjunto y anuncio.
Incluye el Creative Hub para medir la asertividad de cada tanda de creativos.

- Interfaz en **español, inglés y portugués** (selector en la barra lateral).
- **Multimoneda**: cada monto se guarda en su moneda original y se convierte con la cotización del día.
- Stack: Next.js 16 (Vercel) + Supabase (base de datos y login con enlace mágico).

## Estado

| Etapa | Estado |
|---|---|
| 2 · Pantallas con datos de ejemplo | Lista (los datos están marcados como "ejemplo") |
| 3 · Base de datos | Migración lista en `supabase/migrations/`, falta aplicarla |
| 4 · Integraciones (Meta, TikTok, gateways, rastreo) | Pendiente, al final |

## Variables de entorno

Ver `.env.example`. Se cargan en Vercel → Settings → Environment Variables.

| Variable | Dónde se encuentra |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API Keys → Publishable key |
| `ALLOWED_EMAILS` | Tu correo (o varios separados por coma) |
| `NEXT_PUBLIC_SITE_URL` | El dominio de producción de Vercel |

## Desarrollo

```bash
npm install
npm run dev
```

Sin variables de Supabase, `npm run dev` abre el panel sin login (solo en local). En producción, sin Supabase el panel queda bloqueado.
