# Kairos — landing site

The marketing site for [Kairos](../README.md). React + Vite + Tailwind CSS v4, no runtime UI dependencies beyond React.

## Develop

```bash
cd site
npm install
npm run dev        # http://localhost:5173
```

## Build

```bash
npm run build      # outputs to site/dist
npm run preview    # serve the production build locally
```

## Deploy to Vercel

Point Vercel at this repo and set:

| Setting | Value |
|---|---|
| **Root Directory** | `site` |
| Framework preset | Vite |
| Build command | `npm run build` (auto) |
| Output directory | `dist` (auto) |

That's it — every push to `main` redeploys. The custom domain in the project is
`kairosbysubhodeep.vercel.app`.

## Screenshots

The images live in [`public/screenshots/`](public/screenshots) and are a copy of the
repo-root `screenshots/` folder. If you replace a screenshot, update both (or just
re-copy). Missing images degrade gracefully to a labelled placeholder, so the site never
looks broken.

## Structure

```
src/
├── App.jsx              section order
├── index.css           Tailwind v4 theme (the warm palette) + keyframes
├── data.js             all copy and content in one place
├── lib/useReveal.js    scroll-reveal + count-up hooks
└── components/         Hero, AgentCard, Surfaces, Features, HowItWorks, Stats, …
```
