# Portraits by Pelli Kathalu — Next.js site

Mobile-first replica of the Pelli Kathalu landing page mockup (Next.js 15, App Router, TypeScript, plain CSS).

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start   # production
```

## Structure

```
app/
  layout.tsx     fonts (self-hosted via @fontsource) + metadata
  page.tsx       every section: header, hero, categories, about, recent work, reviews, booking, bottom nav
  globals.css    all styling
components/
  Icons.tsx      WhatsApp, arrows, home, portfolio, heart, menu (inline SVG)
public/images/   photos and leaf illustrations
```

## How the sizing works

Every size in `globals.css` is written in mockup pixels (the mockup is 854px wide)
multiplied by `--u`, so the layout scales proportionally and matches the design at
any phone width. On desktop it caps at 600px wide and centres.

## Things to fill in

- `WHATSAPP_URL` at the top of `app/page.tsx` → add the studio number, e.g. `https://wa.me/91XXXXXXXXXX`
- Reviews 2–4 in `page.tsx` are placeholder text — replace with real client reviews
- Swap the images in `public/images/` for full-resolution originals from the photographers
  (the current ones were cropped from screenshots, so they're lower resolution)

## Interactive bits

- Hero progress bars auto-advance every 4s and are clickable
- Review carousel: arrows and dots switch reviews
- "Book a Shoot" and "Contact" open WhatsApp; "View All" opens the Instagram profile
