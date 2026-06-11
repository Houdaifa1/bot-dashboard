<div align="center">

# 🏥 Healthcare Dashboard

**Admin panel for managing healthcare clinics, doctors, appointments, and chatbot conversations.**

Built with **React**, **TypeScript**, **Tailwind CSS**, and **Vite**.

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript)](https://typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?logo=tailwindcss)](https://tailwindcss.com)
[![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?logo=vite)](https://vite.dev)

</div>

---

## ✨ Features

| Feature | Description |
|---|---|
| 📊 **Dashboard** | Real-time statistics — appointments, active doctors, pending cases |
| 🏥 **Clinic Management** | Edit clinic info, phone, address, timezone, and supported languages |
| 💬 **Bot Messages** | Configure multilingual chatbot responses and conversation flows |
| 🩺 **Specialties** | Create and organize medical specialties with ordering and i18n |
| 👨‍⚕️ **Doctors** | Manage doctor profiles, specialties, bios, and display order |
| 🕐 **Time Slots** | Set per-doctor weekly availability with configurable slot durations |
| ❓ **FAQs** | Manage frequently asked questions with keyword tagging |
| 📅 **Appointments** | View, confirm, cancel, and track all patient appointments |
| 🟢 **Handoff Sessions** | Monitor live chatbot-to-human handoff conversations |
| 🔐 **Authentication** | Secure JWT-based admin login with session persistence |
| 🌍 **Bilingual (FR/EN)** | Full French and English interface — toggle on the fly |
| 🌙 **Dark Mode** | Beautiful light & dark themes with system persistence |
| 📱 **Responsive** | Works seamlessly on desktop, tablet, and mobile |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9

### 1. Clone & Install

```bash
git clone https://github.com/your-username/healthcare-dashboard.git
cd healthcare-dashboard
npm install
```

### 2. Configure Environment

Create a `.env` file in the project root:

```env
VITE_API_URL=https://your-api-domain.com
```

### 3. Run Development Server

```bash
npm run dev
```

The app will be available at [http://localhost:5173](http://localhost:5173).

---

## 📦 Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite development server with HMR |
| `npm run build` | Type-check with `tsc` then build for production |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint across the project |

---

## 🏗️ Project Structure

```
healthcare-dashboard/
├── public/                  # Static assets (favicon, icons)
├── src/
│   ├── api/                 # API client (Axios) & endpoint functions
│   ├── components/
│   │   ├── layout/          # App shell, sidebar, header
│   │   └── ui/              # Reusable UI: Modal, Badge, Table, etc.
│   ├── i18n/                # FR / EN translation keys
│   ├── pages/               # Route-level page components
│   │   ├── Dashboard.tsx    # Stats overview
│   │   ├── Clinic.tsx       # Clinic settings
│   │   ├── BotMessages.tsx  # Chatbot message config
│   │   ├── Specialties.tsx  # Medical specialties CRUD
│   │   ├── Doctors.tsx      # Doctors & time slots CRUD
│   │   ├── Faqs.tsx         # FAQ management
│   │   ├── Appointments.tsx # Appointment list & status
│   │   ├── Handoff.tsx      # Live handoff sessions
│   │   └── Login.tsx        # Admin login
│   ├── store/
│   │   ├── auth.tsx         # Auth context (JWT, user, theme, lang)
│   │   └── toast.tsx        # Toast notification context
│   ├── types/               # TypeScript interfaces
│   ├── App.tsx              # Router & provider setup
│   ├── main.tsx             # Entry point
│   └── index.css            # Tailwind directives & custom styles
├── .env                     # Environment variables (git-ignored)
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

---

## 🛠️ Tech Stack

- **React 19** — UI library
- **TypeScript 6** — Type-safe development
- **Vite 8** — Fast build tooling & dev server
- **Tailwind CSS 3** — Utility-first styling
- **TanStack React Query** — Server state management & caching
- **React Router 7** — Client-side routing
- **React Hook Form + Zod** — Form handling & validation
- **Axios** — HTTP client
- **Lucide React** — Icon library
- **date-fns** — Date formatting utilities

---

## 🌐 API

This dashboard connects to a REST API backend. Set the API base URL in your `.env`:

```env
VITE_API_URL=https://api.yourdomain.com
```

### Key Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/login` | Admin login → JWT token |
| `GET` | `/admin/stats` | Dashboard statistics |
| `GET/PUT` | `/admin/clinic` | Clinic profile |
| `GET/POST/PUT/DELETE` | `/admin/bot-messages` | Bot message management |
| `GET/POST/PUT/DELETE` | `/admin/specialties` | Specialties CRUD |
| `GET/POST/PUT/DELETE` | `/admin/doctors` | Doctors CRUD |
| `GET/POST/PUT/DELETE` | `/admin/doctors/:id/time-slots` | Time slots CRUD |
| `GET/POST/PUT/DELETE` | `/admin/faqs` | FAQs CRUD |
| `GET` | `/admin/appointments` | List appointments |
| `PATCH` | `/admin/appointments/:id/status` | Update appointment status |
| `GET` | `/admin/handoff` | Active handoff sessions |

---

## 🚢 Deployment

### Cloudflare Pages (Recommended)

This dashboard is optimized for **Cloudflare Pages** — free hosting with global CDN.

1. Push the repository to **GitHub**
2. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
3. Go to **Workers & Pages → Create → Pages → Connect to Git**
4. Select your repository
5. Configure the build:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
6. Click **Save and Deploy**
7. Under **Custom domains**, add `admin.houdaifa.dev`
8. Cloudflare will automatically configure DNS for your domain

#### Environment Variables on Cloudflare

In the Pages project settings → **Settings → Environment variables**, add:

| Variable | Value |
|---|---|
| `VITE_API_URL` | `https://api.houdaifa.dev` |

> **Note:** Because this is a Single Page Application (SPA), you need a `_redirects` file or a Cloudflare Page Rule to redirect all routes to `index.html`. Add a `_redirects` file in the `public/` directory:

```
/*    /index.html   200
```

### Other Platforms

<details>
<summary>Vercel</summary>

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

Set `VITE_API_URL` in the Vercel project settings.

</details>

<details>
<summary>Netlify</summary>

1. Drag & drop the `dist/` folder to [app.netlify.com](https://app.netlify.com)
2. Or connect your Git repo with:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`

Create a `netlify.toml` or `_redirects` for SPA routing:

```
/*    /index.html   200
```

</details>

<details>
<summary>GitHub Pages</summary>

1. Install the gh-pages package: `npm install -D gh-pages`
2. Add to `vite.config.ts`:
   ```ts
   export default defineConfig({
     plugins: [react()],
     base: '/healthcare-dashboard/',
   })
   ```
3. Add deploy script to `package.json`:
   ```json
   "scripts": {
     "deploy": "gh-pages -d dist"
   }
   ```
4. Run `npm run build && npm run deploy`

</details>

---

## 🎨 Theming

The app supports **light** and **dark** modes. Toggle via the theme switcher in the sidebar. The preference is persisted in `localStorage`.

### Customizing Colors

Edit `tailwind.config.js` to adjust the color palette:

```js
theme: {
  extend: {
    colors: {
      brand: {
        50: '#eff6ff',
        600: '#2563eb',
        700: '#1d4ed8',
      }
    }
  }
}
```

---

## 🌍 Internationalization

The app ships with **French (FR)** and **English (EN)** translations in `src/i18n/index.ts`. Toggle languages via the UI language selector.

To add a new language:

1. Add a new translation object in `src/i18n/index.ts`
2. Add the language code to the `Lang` type
3. Update the language selector in the shell component

---

## 📄 License

This project is private and proprietary.

---