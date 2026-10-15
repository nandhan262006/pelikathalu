export type HeroSlide = { img: string; title: string; imgCrop?: string };
export type LittleThing = { img: string; cap: string; imgCrop?: string };
export type Chapter = { n: string; h: string; p: string; cta?: string };
export type Review = { name: string; img: string; text: string[]; imgCrop?: string };
export type Reel = { src: string; poster?: string; label: string; rotate?: boolean; spot?: string; x?: number; y?: number; w?: number; h?: number };
export type Tease = { names: string; img: string; imgCrop?: string };

export interface SiteContent {
  theme: { paletteId: string };
  branding: { logoName: string; logoSub: string; ariaName: string };
  links: { whatsapp: string; instagram: string };
  menu: string[];
  hero: {
    eyebrow: string;
    sub: string;
    names: string;
    cta: string;
    slides: HeroSlide[];
  };
  duo: {
    scriptLine: string;
    headingBefore: string;
    headingHighlight: string;
    copy: string;
    cta: string;
    hand: string;
  };
  littleThings: {
    script: string;
    headingLine1: string;
    headingLine2: string;
    note: string;
    items: LittleThing[];
  };
  story: {
    eyebrow: string;
    headingLine1: string;
    headingLine2: string;
    chapters1: Chapter[];
    pullquote: { script: string; line1: string; line2Before: string; line2Em: string };
    chapters2: Chapter[];
    close: string;
    hand: string;
  };
  moral: { script: string; line1: string; line2Em: string };
  experience: { heading: string; copy: string; cta: string };
  romance: { cta: string; hand: string; grid: string[] };
  documentary: { banner: string; cta: string; grid: string[] };
  portraits: {
    script: string;
    heading: string;
    copy: string;
    proof: string;
    cta: string;
  };
  weddings: { heading: string; coupleNames: string; sub: string; albumSlug: string };
  theater: {
    script: string;
    title: string;
    cineHint: string;
    hand: string;
    reels: Reel[];
    canvasH?: number; // measured theater canvas height (px) once reels are free-placed
  };
  gallery: { heading: string; small: string; cta: string; items: Tease[] };
  reviews: Review[];
  book: {
    eyebrow: string;
    title: string;
    copyLines: string[];
    primaryCta: string;
    secondaryCta: string;
    img: string;
    imgCrop?: string;
  };
  footer: {
    tagline: string;
    copyright: string;
    right: string;
    explore: { label: string; href: string }[];
    contact: { label: string; href: "whatsapp" | "instagram" }[];
  };
}

export const defaultContent: SiteContent = {
  theme: { paletteId: "pelli-classic" },
  branding: {
    logoName: "Pelli Kathalu",
    logoSub: "BY PREM & PAVAN",
    ariaName: "Pelli Kathalu by Prem and Pavan",
  },
  links: { whatsapp: "https://wa.me/", instagram: "https://www.instagram.com/portraits.by_pellikathalu/" },
  menu: [
    "New-age Films",
    "About Us",
    "Our Story",
    "The Little Things",
    "Modern Romance",
    "Documentary",
    "Portraits",
    "Weddings",
    "Gallery",
  ],
  hero: {
    eyebrow: "MADE FOR FUTURE NOSTALGIA",
    sub: "It's not about how it looked. It's about how it felt.",
    names: "PREM & PAVAN",
    cta: "Book your wedding",
    slides: [
      { img: "/images/hero3.webp", title: "Weddings" },
      { img: "/images/hero1.webp", title: "Portraits" },
      { img: "/images/hero2.jpg", title: "Portraits" },
    ],
  },
  duo: {
    scriptLine: "It started with two people who simply loved",
    headingBefore: "Telling",
    headingHighlight: "stories",
    copy: "Prem Chandra and Pavan began their journey behind cameras, capturing people, emotions and moments — long before Pellikathalu had a name. What started as two friends with cameras has grown into a Hyderabad-based wedding photography and cinematography studio built on passion, trust and the stories of the people who choose us.",
    cta: "The Full Story",
    hand: "prem and pavan may ask you to laugh for the last time, 16 times",
  },
  littleThings: {
    script: "the little things",
    headingLine1: "Weddings became more",
    headingLine2: "than assignments.",
    note: "\u201c\u2026and the moments that happen when nobody is posing for the camera.\u201d",
    items: [
      { img: "/images/2026-03-16_11-11-49_UTC_1.webp", cap: "a father's eyes before his daughter's wedding" },
      { img: "/images/2026-03-16_11-11-49_UTC_2.webp", cap: "a mother's smile" },
      { img: "/images/2026-03-16_11-11-49_UTC_3.webp", cap: "nervous hands" },
      { img: "/images/2026-03-16_11-11-49_UTC_4.webp", cap: "uncontrollable laughter" },
    ],
  },
  story: {
    eyebrow: "OUR STORY",
    headingLine1: "More than capturing a moment.",
    headingLine2: "Preserving the story behind it.",
    chapters1: [
      {
        n: "01",
        h: "Behind the camera, before the name",
        p: "Prem Chandra and Pavan began their journey behind cameras, capturing people, emotions and moments long before Pellikathalu had a name.",
      },
      {
        n: "02",
        h: "The little things",
        p: "Over the years, weddings became more than assignments for us. We started noticing the little things — a father's eyes before his daughter's wedding, a mother's smile, nervous hands, uncontrollable laughter, and the moments that happen when nobody is posing for the camera.",
      },
      {
        n: "03",
        h: "That is when Pellikathalu was born",
        p: "We never wanted to create just another wedding photography brand. We wanted to tell stories — honestly, beautifully and cinematically.",
      },
    ],
    pullquote: {
      script: "because",
      line1: "a wedding isn't just about how it looked;",
      line2Before: "it's about ",
      line2Em: "how it felt.",
    },
    chapters2: [
      {
        n: "04",
        h: "Portraits & personalities",
        p: "Alongside weddings, our creative vision led us to build our Portraits page, where we explore people, personalities and powerful visual identities. That journey has taken us from everyday portraits to working with well-known celebrities and personalities, who trusted our vision and our way of seeing them.",
        cta: "Explore Portraits",
      },
      {
        n: "05",
        h: "Proof that vision travels",
        p: "For us, that recognition is not just a milestone — it's proof that a strong vision can take you places you never imagined.",
      },
    ],
    close: "What started as two friends with cameras has grown into a creative journey built on passion, trust and the stories of the people who choose us.",
    hand: "pellikathalu — the story behind the moment",
  },
  moral: {
    script: "Pelli Kathalu",
    line1: "means more than capturing a moment.",
    line2Em: "It means preserving the story behind it.",
  },
  experience: {
    heading: "The Pellikathalu Way",
    copy: "We never wanted to create just another wedding photography brand. We wanted to tell stories — honestly, beautifully and cinematically. By the time the wedding arrives, we don't want it to feel like you're being photographed. We want it to feel like you're fully inside the moment — and we're there for the little things: the unposed laughs, the quiet glances, the ones nobody asked for.",
    cta: "Behind The Frames",
  },
  romance: {
    cta: "explore modern romance",
    hand: "psst — prem may ask you to laugh one last time, 16 times",
    grid: [
      "/images/pre-weddings.jpg",
      "/images/recent-1.jpg",
      "/images/recent-2.jpg",
      "/images/2026-10-03_11-44-48_UTC_1.jpg",
      "/images/2026-10-03_11-44-48_UTC_2.jpg",
      "/images/2026-09-15_01-30-02_UTC_5.jpg",
    ],
  },
  documentary: {
    banner: "CAPTURED THE WAY THEY FEEL.",
    cta: "View More Documentary",
    grid: [
      "/images/weddings.jpg",
      "/images/2026-03-19_04-10-36_UTC_5.webp",
      "/images/2026-03-19_04-10-36_UTC_2.webp",
      "/images/2026-03-19_04-10-36_UTC_3.webp",
      "/images/2026-03-19_04-10-36_UTC_6.webp",
      "/images/2026-03-19_04-10-36_UTC_4.webp",
    ],
  },
  portraits: {
    script: "beyond weddings",
    heading: "Portraits & Personalities",
    copy: "Our creative vision led us to build our Portraits page, where we explore people, personalities and powerful visual identities. That journey has taken us from everyday portraits to working with well-known celebrities and personalities, who trusted our vision and our way of seeing them.",
    proof: "That recognition is not just a milestone — it's proof that a strong vision can take you places you never imagined.",
    cta: "Explore Portraits",
  },
  weddings: {
    heading: "Weddings",
    coupleNames: "Aishwarya + Lokesh",
    sub: "Tap a couple to open their full story",
    albumSlug: "aishwarya-lokesh",
  },
  theater: {
    script: "Motion",
    title: "New-age Films & Reels",
    cineHint: "Tap a video for sound",
    hand: "we've survived sun, rain, power cuts & family politics",
    reels: [
      { src: "/reels/portrait-1.mp4", label: "Portraits", spot: "reel-vt-1" },
      { src: "/reels/portrait-2.mp4", label: "Portraits", spot: "reel-vt-2" },
      { src: "/reels/wedding-1.mp4", label: "Weddings", spot: "reel-vt-w1" },
      { src: "/reels/vetical.mp4", label: "Weddings", spot: "reel-vt-4" },
      { src: "/reels/wedding-2.mp4", label: "Weddings", spot: "reel-vt-w2" },
    ],
  },
  gallery: {
    heading: "Gallery",
    small: "Swipe sideways for slideshow",
    cta: "enter the gallery",
    items: [
      { names: "Kruti + Sharath", img: "/images/2026-09-22_11-06-46_UTC_3.jpg" },
      { names: "Rasya + Jashwanth", img: "/images/2026-09-17_14-38-27_UTC_2.jpg" },
      { names: "Yasaswi + Harsha", img: "/images/2026-09-30_13-14-36_UTC_4.webp" },
    ],
  },
  reviews: [
    {
      name: "ASHIKA R.",
      img: "/images/recent-1.jpg",
      text: [
        "Their work is full of emotion and so natural.",
        "They made the entire shoot feel so comfortable.",
        "The pictures are just magical! ♡",
      ],
    },
    {
      name: "SIMRAN",
      img: "/images/recent-3.jpg",
      text: [
        "Every frame felt like a memory.",
        "Prem & Pavan are so easy to work with.",
        "Absolutely loved it! ♡",
      ],
    },
    {
      name: "MEGHALEKHA",
      img: "/images/weddings.jpg",
      text: [
        "They captured exactly how I felt that day.",
        "Calm, patient and so creative.",
        "Highly recommend! ♡",
      ],
    },
    {
      name: "ANANYA",
      img: "/images/pre-weddings.jpg",
      text: [
        "Beautiful light, beautiful stories.",
        "Our pre-wedding shoot was a dream.",
        "Thank you both! ♡",
      ],
    },
  ],
  book: {
    eyebrow: "LET'S CREATE YOUR STORY",
    title: "Book Your Wedding",
    copyLines: ["Portraits, pre-weddings, weddings or", "just you — we'd love to be a part of", "your story."],
    primaryCta: "Book a Shoot",
    secondaryCta: "View Our Work",
    img: "/images/book-shoot.jpg",
  },
  footer: {
    tagline: "Made for future nostalgia.",
    copyright: "© 2026 PORTRAITS BY PELLI KATHALU",
    right: "PREM & PAVAN",
    explore: [
      { label: "Films", href: "#films" },
      { label: "Portfolio", href: "/portfolio" },
      { label: "Reviews", href: "#reviews" },
      { label: "Our Story", href: "#our-story" },
      { label: "Book a Shoot", href: "#book" },
    ],
    contact: [
      { label: "Book a Shoot", href: "whatsapp" },
      { label: "Instagram", href: "instagram" },
    ],
  },
};

export function mergeContent(partial: unknown): SiteContent {
  return deepMerge(
    defaultContent as unknown as Record<string, unknown>,
    (partial ?? {}) as Record<string, unknown>
  ) as unknown as SiteContent;
}

function deepMerge(base: Record<string, unknown>, over: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const k of Object.keys(over)) {
    const b = base[k];
    const o = over[k];
    if (isPlainObj(b) && isPlainObj(o)) out[k] = deepMerge(b, o);
    else if (o !== undefined) out[k] = o;
  }
  return out;
}

function isPlainObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
