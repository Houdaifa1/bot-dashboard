# Healthcare dashboard

React and TypeScript admin dashboard for the healthcare bot backend. The current pages cover booking requests, campaigns, campaign patients, complaints, handoff, clinic settings, bot messages, and FAQs.

## Run locally

Requires Node.js 24 and npm.

```bash
npm ci
npm run dev
```

Set `VITE_API_URL` at **build time** to the backend origin. For local Vite development it defaults to `http://localhost:3000`. An explicit empty value uses same-origin `/api` requests, as used by the local Caddy proxy. A hosted build without this variable defaults to `https://api.houdaifa.dev`; verify that origin before deployment.

```bash
npm test
npm run build
npm run lint
```

CI runs the complete lint, test, build, and production dependency audit checks.

## Booking confirmation

The dashboard sends date, time, ClinOps patient ID, ClinOps specialty ID, a reviewed booking reason (`motif`), doctor label, and optional WhatsApp text to `POST /api/admin/v1/booking-requests/:id/confirm` on the backend. Specialty and doctor choices come from the backend's targeting options endpoint. The backend verifies the patient phone and doctor availability before a live ClinOps `createNewRDV` call. The dashboard cannot verify that WhatsApp delivered a notification. A pending request with a prior external attempt must be reconciled in ClinOps by staff.

For follow-up rebooking, the form displays the patient's date and time preferences. If an existing appointment was confirmed, the dashboard requires staff to acknowledge that they reviewed and resolved it in ClinOps. The bot cannot cancel it through the documented API.

The dashboard is a staff interface, not the external ClinOps API client. It must be deployed alongside the matching backend branch and tested in an authorized staging environment before use with patient information.

## Deployment

The repository contains `wrangler.toml` for Cloudflare Pages. `npm run deploy` deploys the current `dist` build to the configured Pages project. The code repository does not contain deployment credentials or a deployment workflow. Set `VITE_API_URL` correctly for the target environment before building.
