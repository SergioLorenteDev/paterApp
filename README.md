# PaterApp

PaterApp is the field-operations layer for industrial after-sales teams: a technician identifies a machine by the identifier carried on its QR label, sees its status and technical history, reads the official documentation for that model and decides the next action from a phone. It does not replace Salesforce — it treats it as the source of truth and turns it into a fast field experience with actionable KPIs. The interface, API messages and date and number formats are written in Spanish (`es-ES`).

<p>
  <img alt="Next.js 15" src="https://img.shields.io/badge/Next.js-15-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" />
  <img alt="NestJS 11" src="https://img.shields.io/badge/NestJS-11-E0234E?style=for-the-badge&logo=nestjs&logoColor=white" />
  <img alt="PostgreSQL 16" src="https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" />
  <img alt="Prisma 6" src="https://img.shields.io/badge/Prisma-6-2D3748?style=for-the-badge&logo=prisma&logoColor=white" />
  <img alt="Docker Compose" src="https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white" />
  <img alt="MIT License" src="https://img.shields.io/badge/License-MIT-3DA639?style=for-the-badge&logo=opensourceinitiative&logoColor=white" />
</p>

![Asset record in PaterApp: machine status, model context, documentation library, cases, work orders and the technical assistant](docs/screenshots/hero-ficha-activo.png)

## Highlights

- **From the QR label to the machine record.** The asset identifier (`AST-1001`) is the entry point: one lookup brings together status, location, warranty, customer, open cases, work orders and the official documentation for the model.
- **Three roles with real permissions.** `technician`, `manager` and `commercial` are enforced by a `Bearer` token auth guard plus a role guard: changing a case status is reserved for technicians and service managers, and the rest of the API answers `401` without a token and `403` with the wrong role.
- **KPIs computed on the server.** MTTR, MTBF, first-time-fix, SLA compliance, overdue cases and repeat failures are derived from `cases` and `work_orders` with aggregate SQL, and returned next to documentation coverage and data-quality metrics.
- **A documentation library per model.** The `manufacturers → machine_models → technical_documents` hierarchy holds 18 document types with language, revision, access level and ingestion status, queryable per asset with filters.
- **A technical assistant that cites its sources.** Every answer returns the citations (document, chunk and excerpt) that justify it, with two modes: `strict` (internal documentation only) and `expanded` (adds clearly labelled hypotheses). It runs on Gemini, on OpenAI, or on a local ranking when no key is configured.
- **Three-step documentation ingestion.** A CSV manifest import, content download with native text extraction (OCR as fallback) and overlapping chunk building ready for the assistant. Every step leaves an audit trail in the database.
- **A stable domain behind adapters.** A modular NestJS monolith with a single Prisma contract; the data source (CSV today, the Salesforce API later) stays behind the ingestion layer.
- **Ready to try without integrations.** `db/init/001_init.sql` creates the schema, seeds a representative dataset (5 manufacturers, 11 machine models, 18 assets, 17 technical documents, cases and work orders) and adds two SQL views for documentation KPIs. The seeded records are fictional.
- **No UI dependencies, mobile-first.** The frontend only declares `next`, `react` and `react-dom`: the interface is plain CSS with a persistent light and dark theme, plus a Next.js BFF proxy that keeps the API token on the server.

## Project Structure

```
PaterApp/
├── apps/
│   ├── backend/                 NestJS API (one module per domain + role guard)
│   │   ├── prisma/schema.prisma data contract (single source of the model)
│   │   └── src/scripts/         documentation ingestion pipeline
│   └── frontend/                Next.js 15 (App Router, server components)
│       └── src/app/api/         BFF routes that sign calls to the backend
├── db/
│   ├── docker-compose.yml       Postgres 16 (5433) + Redis 7 (6379)
│   └── init/001_init.sql        schema, demo dataset and KPI views
├── docs/                        documentation samples, analysis and screenshots
├── scripts/run-local.sh         one-command start that opens the browser
└── docker-compose.prod.yml      deployment stack (frontend, backend, Postgres, Redis, Adminer)
```

## Quick Start

You need Node.js 22 and Docker (for Postgres and Redis). The package manager is pinned to `pnpm@10.6.2` and enabled through `corepack`, which ships with Node.

```bash
git clone https://github.com/SergioLorenteDev/PaterApp.git && cd PaterApp
corepack pnpm install
docker compose -f db/docker-compose.yml up -d
cp apps/backend/.env.example apps/backend/.env
corepack pnpm --filter backend prisma:push
corepack pnpm dev
```

The last command starts both applications in watch mode:

| Service | URL | Notes |
| --- | --- | --- |
| Frontend | http://localhost:3000 | Dashboard, asset lookup, cases and KPIs |
| API | http://localhost:4000/api | Global `api` prefix |
| Health check | http://localhost:4000/api/health | Public route, together with `auth/tokens` |
| Development tokens | http://localhost:4000/api/auth/tokens | Lists the three test tokens |
| Postgres | `localhost:5433` | `paterapp` / `paterapp` / database `paterapp` |
| Redis | `localhost:6379` | Redis service of the development environment |

The Postgres container runs `db/init/001_init.sql` the first time the volume is created: it creates the tables, the enum types and the demo dataset. If you change that script, recreate the volume with `docker compose -f db/docker-compose.yml down -v`.

As an alternative, `bash scripts/run-local.sh` chains the install, starts both services and opens the browser, using the Node runtime bundled in `.tools/node` when present.

## API Reference

Every route lives under `http://localhost:4000/api` and requires `Authorization: Bearer <token>` unless marked as public.

| Method | Route | Roles | Notes |
| --- | --- | --- | --- |
| GET | `/health` | public | Service status |
| GET | `/auth/tokens` | public | Available development tokens |
| GET | `/auth/me` | all | Identity and role of the current token |
| GET | `/assets` | all | Asset list |
| GET | `/assets/:id` | all | Single asset |
| GET | `/assets/:id/context` | all | Asset + cases + work orders |
| GET | `/assets/:id/documents` | all | Model library, `language` and `documentType` filters |
| GET | `/assets/:id/ai-context` | all | Documentation context for the assistant, with `language`, `documentType` and `maxChunks` filters |
| GET | `/documents/:id/file` | all | Serves the local file or redirects to the official source |
| GET | `/cases` | all | Case list |
| GET | `/cases/:id` | all | Case detail |
| PATCH | `/cases/:id/status` | technician, manager | Changes the status with `{ "status": "closed" }` |
| GET | `/kpis/summary` | all | Service, documentation and data-quality metrics |
| GET | `/work-orders` | technician, manager | Work-order list |
| GET | `/work-orders/:id` | technician, manager | Work-order detail |
| POST | `/ai/chat` | all | Asks the assistant with `assetId`, `question`, `mode` and `maxCitations` |

Example: reading the machine record with a documentation filter.

```bash
curl -H "Authorization: Bearer dev-tecnico" \
  "http://localhost:4000/api/assets/AST-1001/documents?documentType=quick_guide&language=en-US"
```

## Environment Variables

`apps/backend/.env` (copy of `apps/backend/.env.example`):

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` | `4000` | API port |
| `CORS_ORIGIN` | `http://localhost:3000` | Comma-separated list |
| `DATABASE_URL` | `postgresql://paterapp:paterapp@localhost:5433/paterapp?schema=public` | Port `5433` is the one published by `db/docker-compose.yml` |
| `AI_PROVIDER` | `gemini` | `gemini`, `openai` or `auto` (the code falls back to `auto` when unset) |
| `GEMINI_API_KEY` | empty | Required for the Gemini provider |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Model used with Gemini |
| `OPENAI_API_KEY` | empty | Alternative provider |
| `OPENAI_MODEL` | `gpt-5-mini` | Model used with OpenAI |
| `CHUNK_SIZE` | `1400` | Used by `docs:build-chunks` |
| `CHUNK_OVERLAP` | `200` | Overlap between chunks |

`apps/frontend/.env.local` (optional, when the backend does not run on the default port):

| Variable | Default | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:4000/api` | API URL |
| `NEXT_PUBLIC_API_TOKEN` | `dev-tecnico` | Development token |
| `API_BASE_URL` | empty | Takes precedence over `NEXT_PUBLIC_API_BASE_URL`; used on the server |
| `API_TOKEN` | empty | Takes precedence over `NEXT_PUBLIC_API_TOKEN`; used on the server |

Never commit your `.env` files: they are already listed in `.gitignore`, and only the `.env.example` templates belong in the repository.

## Roles And Authentication

In development, identity is resolved from fixed tokens defined in `apps/backend/src/common/auth/auth.constants.ts`:

| Token | Role | Scope |
| --- | --- | --- |
| `dev-tecnico` | `technician` | Field work: cases, work orders and status changes |
| `dev-manager` | `manager` | Service supervision: the same operation plus work-order reads |
| `dev-comercial` | `commercial` | Reads assets, cases, documentation and KPIs, without status changes |

The browser never talks to the API directly: pages are rendered on the server and mutations go through BFF routes (`/api/ai/chat`, `/api/cases/[id]/status`, `/api/documents/[id]/file`) that attach the token server-side. Before exposing the API outside a local environment, replace these development tokens with your own identity provider.

## Operational KPIs

`GET /api/kpis/summary` returns the following, computed from `cases` and `work_orders`:

| Metric | What it measures | How it is computed |
| --- | --- | --- |
| Open cases | Live service workload | Cases in `open`, `in_progress` or `blocked` |
| SLA risk | Immediate priority | Open cases with `high` or `critical` severity |
| Overdue cases | Ongoing breach | Hours since opening above the target for their severity |
| Repeat failures (30d) | Recurrence per machine | Assets with two or more cases recorded in the last 30 days |
| MTTR | Mean time to repair | Mean hours between opening and closing for closed cases |
| MTBF | Mean time between failures | Mean interval between consecutive cases on the same asset |
| First-time-fix | Fixed on the first visit | Share of closed cases resolved with a single work order |
| SLA compliance | Service delivered on time | Share of closed cases resolved within the target for their severity |
| Work orders per case | Resolution effort | Mean work orders per closed case |

SLA targets per severity are 8 h (`critical`), 24 h (`high`), 48 h (`medium`) and 72 h (`low`). Resolution metrics are published once there are at least three closed cases: until then the API returns `null` and the view says so, which keeps unreliable averages out of the dashboard. The same summary includes documentation coverage (documents per model, share of documented assets, breakdown by type, manufacturer and language) and data quality (parsed documents, with revision, with publication date).

![Operational KPI dashboard with open cases, SLA risk, overdue cases and repeat failures](docs/screenshots/kpis-operativos.png)

## Technical Documentation And Assistant

Every asset can be linked to a machine model, and every model to its official documentation. On top of that:

1. **Import the manifest** of documents into the database (a CSV with manufacturer, model, document type, language, URL, revision and access level):

   ```bash
   corepack pnpm --filter backend docs:import-manifest
   ```

2. **Download and extract the text** of every pending document. The script uses `pdftotext` for native PDFs and OCR (`pdftoppm` + `tesseract`) as a fallback; when no extractor is available it leaves the document in the `downloaded` state with the reason recorded. It accepts `--retry-failed`, `--retry-downloaded` and `--only-pending`.

   ```bash
   corepack pnpm --filter backend docs:ingest-content
   ```

3. **Build the chunks** that feed the assistant, with configurable size and overlap and per-chunk traceability:

   ```bash
   corepack pnpm --filter backend docs:build-chunks
   ```

The assistant (`POST /api/ai/chat`) ranks the chunks that are most relevant to the question, discards template and navigation noise, and always answers with citations. In `strict` mode it only uses internal documentation; in `expanded` mode it adds clearly labelled diagnostic hypotheses and safety checks when the context is not enough.

![Case detail with severity, current status and status change](docs/screenshots/detalle-caso.png)

## Interface And Field Experience

The interface is designed to be used one-handed on a plant floor: at most three primary actions per view, 44 px buttons, explicit status semantics and the data source visible on every screen. The light and dark theme is stored in the browser and respects `prefers-color-scheme` on the first visit, with a skip link to the main content and accessible form labels.

<table>
  <tr>
    <td width="45%"><img alt="Asset record on a mobile screen" src="docs/screenshots/movil-ficha-activo.png" /></td>
    <td>The same record on a 414 px phone: the header reflows, cards collapse into a single column and the primary action of each block spans the full width. The asset catalogue, cases and KPIs follow the same responsive pattern, with Spanish date and number formatting.</td>
  </tr>
</table>

## How It Works

```
Phone / browser
      │  (Next.js server components)
      ▼
Next.js frontend  ──►  BFF routes (/api/ai/chat, /api/cases/:id/status, /api/documents/:id/file)
      │                        │
      └────────┬───────────────┘
               ▼
        NestJS API  ──►  AuthGuard (Bearer)  ──►  RolesGuard (technician/manager/commercial)
               │
               ├──►  Prisma 6  ──►  PostgreSQL 16
               └──►  AiService  ──►  local ranking + Gemini / OpenAI with citations
```

The backend is a modular monolith: each domain (`assets`, `cases`, `work-orders`, `documents`, `kpis`, `ai`) lives in `apps/backend/src/modules`, with a global authentication guard and a declarative role guard (`@Roles(...)`) per route. The data contract is defined once in `apps/backend/prisma/schema.prisma`; `db/init/001_init.sql` creates the same schema in SQL (enum types included) and adds the demo dataset together with the `kpi_document_ingestion_global` and `kpi_document_ingestion_by_model` views. The ingestion layer is provider-agnostic: today it reads CSV manifests and later it can read from the Salesforce API without touching the domain.

## Further Documentation

| File | Content |
| --- | --- |
| [docs/analisis-muestra-documental-y-reglas-bbdd.md](docs/analisis-muestra-documental-y-reglas-bbdd.md) | Analysis of real OEM documentation and the database rules derived from it (Spanish) |
| [docs/muestra-documental-representativa.csv](docs/muestra-documental-representativa.csv) | 12-row manifest used by `docs:import-manifest` |
| [docs/fuentes-documentacion-industrial.csv](docs/fuentes-documentacion-industrial.csv) | Five public OEM sources for the models seeded in the demo database |
| [AGENTS.md](AGENTS.md) | Product scope, architecture principles and working agreements for the project |

## Deployment

The repository ships `apps/frontend/Dockerfile`, `apps/backend/Dockerfile` and a full stack in `docker-compose.prod.yml`. The backend image adds `poppler-utils` and `tesseract-ocr`, so text extraction and OCR also work inside the container.

```bash
corepack pnpm docker:up     # builds and starts the stack
corepack pnpm docker:down   # stops it
```

| Service | Image / build | Published port |
| --- | --- | --- |
| `frontend` | `apps/frontend/Dockerfile`, Next.js in production mode | `3001` |
| `backend` | `apps/backend/Dockerfile`, compiled NestJS | `4000` |
| `postgres` | `postgres:16` with the schema and demo dataset | internal network only |
| `redis` | `redis:7` | internal network only |
| `adminer` | `adminer:4`, web SQL viewer | `8080` |

In Adminer the connection is PostgreSQL, server `postgres`, user `paterapp`, password `paterapp` and database `paterapp`. The containerised frontend uses `3001` so that it can run alongside the development environment on `3000`.

## Roadmap

- [x] Authentication and roles (technician, service manager, commercial)
- [x] Entry point from the asset identifier (QR label) and machine record
- [x] Cases and work orders with status changes
- [x] KPI dashboard (MTTR, MTBF, first-time-fix, SLA compliance, repeat failures)
- [x] Documentation ingestion pipeline (CSV manifest, native extraction and OCR, chunks)
- [x] Technical assistant with citations and answer modes
- [ ] Global search across assets, serial numbers, customers and cases
- [ ] Audit views for operational traceability
- [ ] Salesforce API connector as an alternative source to the CSV
- [ ] Vector index for the assistant, on top of the already traceable chunks
- [ ] Predictive risk signals (failure recurrence and SLA risk)
- [ ] Enterprise hardening: SSO, advanced observability and request rate limits

## Conventions

The interface, API messages and documentation are written in Spanish (`es-ES`); technical names coming from integrations stay in English in the backend and are translated in the UI. Every new backend domain becomes a module in `apps/backend/src/modules/<domain>`, and any model change is made first in `apps/backend/prisma/schema.prisma` and then in `db/init/001_init.sql`, so the SQL and Prisma schemas do not drift apart. Commits follow [Conventional Commits](https://www.conventionalcommits.org/). Before considering a change finished, `corepack pnpm -r build` compiles the backend and also type-checks and lints the frontend.

## License

Released under the [MIT License](LICENSE). Copyright (c) 2026 Sergio Lorente Bogas.
