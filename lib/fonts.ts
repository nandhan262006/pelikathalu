export type FontKit = {
  id: string;
  name: string;
  serif: string;
  script: string;
  sans: string;
};

const SANS_FALLBACK = "system-ui, -apple-system, sans-serif";
const SERIF_FALLBACK = '"Times New Roman", serif';

export const fontKits: FontKit[] = [
  {
    id: "pelli-classic",
    name: "Pelli Classic",
    serif: `"Bodoni Moda", ${SERIF_FALLBACK}`,
    script: `"Dancing Script", cursive`,
    sans: `"Work Sans", ${SANS_FALLBACK}`,
  },
  {
    id: "playfair-vibes",
    name: "Playfair & Vibes",
    serif: `"Playfair Display", ${SERIF_FALLBACK}`,
    script: `"Great Vibes", cursive`,
    sans: `"Montserrat", ${SANS_FALLBACK}`,
  },
  {
    id: "cormorant-romance",
    name: "Cormorant Romance",
    serif: `"Cormorant Garamond", ${SERIF_FALLBACK}`,
    script: `"Parisienne", cursive`,
    sans: `"Raleway", ${SANS_FALLBACK}`,
  },
  {
    id: "baskerville-editorial",
    name: "Baskerville Editorial",
    serif: `"Libre Baskerville", ${SERIF_FALLBACK}`,
    script: `"Sacramento", cursive`,
    sans: `"Karla", ${SANS_FALLBACK}`,
  },
  {
    id: "vogue-display",
    name: "Vogue Display",
    serif: `"DM Serif Display", ${SERIF_FALLBACK}`,
    script: `"Pacifico", cursive`,
    sans: `"Inter", ${SANS_FALLBACK}`,
  },
  {
    id: "garamond-pinyon",
    name: "Garamond & Pinyon",
    serif: `"EB Garamond", ${SERIF_FALLBACK}`,
    script: `"Pinyon Script", cursive`,
    sans: `"Nunito Sans", ${SANS_FALLBACK}`,
  },
  {
    id: "prata-caveat",
    name: "Prata & Caveat",
    serif: `"Prata", ${SERIF_FALLBACK}`,
    script: `"Caveat", cursive`,
    sans: `"Jost", ${SANS_FALLBACK}`,
  },
  {
    id: "marcellus-gallery",
    name: "Marcellus Gallery",
    serif: `"Marcellus", ${SERIF_FALLBACK}`,
    script: `"Satisfy", cursive`,
    sans: `"Mulish", ${SANS_FALLBACK}`,
  },
];

export function getFontKit(id?: string): FontKit {
  return fontKits.find((k) => k.id === id) ?? fontKits[0];
}
