export type FieldType = "text" | "textarea" | "image" | "video" | "list" | "stringList" | "palette";

export interface FieldDef {
  path: string; // dot path from content root, e.g. "hero.eyebrow" or "reviews"
  label: string;
  type: FieldType;
  itemFields?: FieldDef[]; // for type "list" of objects
  itemField?: FieldDef; // for type "stringList" (descriptor of the item itself)
  empty?: () => unknown; // factory for a new list item
}

export interface SectionDef {
  id: string;
  title: string;
  fields: FieldDef[];
}

const str = (): unknown => "";
const img = (): unknown => ({ img: "", cap: "" });

export const editorSections: SectionDef[] = [
  {
    id: "theme",
    title: "Color Palette",
    fields: [{ path: "theme.paletteId", label: "Site palette", type: "palette" }],
  },
  {
    id: "brand",
    title: "Branding & Links",
    fields: [
      { path: "branding.logoName", label: "Logo name", type: "text" },
      { path: "branding.logoSub", label: "Logo sub", type: "text" },
      { path: "links.whatsapp", label: "WhatsApp URL", type: "text" },
      { path: "links.instagram", label: "Instagram URL", type: "text" },
    ],
  },
  {
    id: "hero",
    title: "Hero",
    fields: [
      { path: "hero.eyebrow", label: "Eyebrow", type: "text" },
      { path: "hero.sub", label: "Sub line", type: "text" },
      { path: "hero.names", label: "Names strip", type: "text" },
      { path: "hero.cta", label: "CTA text", type: "text" },
      {
        path: "hero.slides",
        label: "Slides",
        type: "list",
        itemFields: [
          { path: "img", label: "Image", type: "image" },
          { path: "title", label: "Title", type: "text" },
        ],
        empty: () => ({ img: "", title: "Portraits" }),
      },
    ],
  },
  {
    id: "duo",
    title: "About the Duo",
    fields: [
      { path: "duo.scriptLine", label: "Script line", type: "text" },
      { path: "duo.headingBefore", label: "Heading before", type: "text" },
      { path: "duo.headingHighlight", label: "Heading highlight", type: "text" },
      { path: "duo.copy", label: "Copy", type: "textarea" },
      { path: "duo.cta", label: "CTA text", type: "text" },
      { path: "duo.hand", label: "Handwritten note", type: "text" },
    ],
  },
  {
    id: "little",
    title: "The Little Things",
    fields: [
      { path: "littleThings.script", label: "Script", type: "text" },
      { path: "littleThings.headingLine1", label: "Heading line 1", type: "text" },
      { path: "littleThings.headingLine2", label: "Heading line 2", type: "text" },
      { path: "littleThings.note", label: "Closing note", type: "text" },
      {
        path: "littleThings.items",
        label: "Items",
        type: "list",
        itemFields: [
          { path: "img", label: "Image", type: "image" },
          { path: "cap", label: "Caption", type: "text" },
        ],
        empty: () => ({ img: "", cap: "" }),
      },
    ],
  },
  {
    id: "story",
    title: "Our Story",
    fields: [
      { path: "story.eyebrow", label: "Eyebrow", type: "text" },
      { path: "story.headingLine1", label: "Heading line 1", type: "text" },
      { path: "story.headingLine2", label: "Heading line 2", type: "text" },
      {
        path: "story.chapters1",
        label: "Chapters 01–03",
        type: "list",
        itemFields: [
          { path: "n", label: "Number", type: "text" },
          { path: "h", label: "Heading", type: "text" },
          { path: "p", label: "Body", type: "textarea" },
        ],
        empty: str,
      },
      { path: "story.pullquote.script", label: "Pullquote script", type: "text" },
      { path: "story.pullquote.line1", label: "Pullquote line 1", type: "text" },
      { path: "story.pullquote.line2Before", label: "Pullquote line 2 before", type: "text" },
      { path: "story.pullquote.line2Em", label: "Pullquote line 2 emphasis", type: "text" },
      {
        path: "story.chapters2",
        label: "Chapters 04+",
        type: "list",
        itemFields: [
          { path: "n", label: "Number", type: "text" },
          { path: "h", label: "Heading", type: "text" },
          { path: "p", label: "Body", type: "textarea" },
          { path: "cta", label: "CTA text (optional)", type: "text" },
        ],
        empty: () => ({ n: "", h: "", p: "" }),
      },
      { path: "story.close", label: "Closing line", type: "textarea" },
      { path: "story.hand", label: "Handwritten note", type: "text" },
    ],
  },
  {
    id: "moral",
    title: "Moral Band",
    fields: [
      { path: "moral.script", label: "Script", type: "text" },
      { path: "moral.line1", label: "Line 1", type: "text" },
      { path: "moral.line2Em", label: "Line 2 (emphasis)", type: "text" },
    ],
  },
  {
    id: "experience",
    title: "Experience",
    fields: [
      { path: "experience.heading", label: "Heading", type: "text" },
      { path: "experience.copy", label: "Copy", type: "textarea" },
      { path: "experience.cta", label: "CTA text", type: "text" },
    ],
  },
  {
    id: "romance",
    title: "Modern Romance",
    fields: [
      { path: "romance.cta", label: "CTA text", type: "text" },
      { path: "romance.hand", label: "Handwritten note", type: "text" },
      {
        path: "romance.grid",
        label: "Grid images",
        type: "stringList",
        itemField: { path: "", label: "Image", type: "image" },
      },
    ],
  },
  {
    id: "documentary",
    title: "Documentary",
    fields: [
      { path: "documentary.banner", label: "Banner", type: "text" },
      { path: "documentary.cta", label: "CTA text", type: "text" },
      {
        path: "documentary.grid",
        label: "Grid images",
        type: "stringList",
        itemField: { path: "", label: "Image", type: "image" },
      },
    ],
  },
  {
    id: "portraits",
    title: "Portraits Band",
    fields: [
      { path: "portraits.script", label: "Script", type: "text" },
      { path: "portraits.heading", label: "Heading", type: "text" },
      { path: "portraits.copy", label: "Copy", type: "textarea" },
      { path: "portraits.proof", label: "Proof line", type: "textarea" },
      { path: "portraits.cta", label: "CTA text", type: "text" },
      { path: "portraits.bg", label: "Background image", type: "image" },
      {
        path: "portraits.grid",
        label: "Band images",
        type: "stringList",
        itemField: { path: "", label: "Image", type: "image" },
      },
    ],
  },
  {
    id: "weddings",
    title: "Weddings Section",
    fields: [
      { path: "weddings.heading", label: "Heading", type: "text" },
      { path: "weddings.sub", label: "Subtitle", type: "text" },
    ],
  },
  {
    id: "theater",
    title: "Theater / Reels",
    fields: [
      { path: "theater.script", label: "Script", type: "text" },
      { path: "theater.title", label: "Title", type: "text" },
      { path: "theater.cineHint", label: "Hint text", type: "text" },
      { path: "theater.hand", label: "Handwritten note", type: "text" },
      {
        path: "theater.reels",
        label: "Reels",
        type: "list",
        itemFields: [
          { path: "src", label: "Video", type: "video" },
          { path: "label", label: "Label", type: "text" },
        ],
        empty: () => ({ src: "", label: "Weddings", spot: "" }),
      },
    ],
  },
  {
    id: "gallery",
    title: "Gallery Tease",
    fields: [
      { path: "gallery.heading", label: "Heading", type: "text" },
      { path: "gallery.small", label: "Small line", type: "text" },
      { path: "gallery.cta", label: "CTA text", type: "text" },
      {
        path: "gallery.items",
        label: "Cards",
        type: "list",
        itemFields: [
          { path: "names", label: "Couple names", type: "text" },
          { path: "img", label: "Image", type: "image" },
        ],
        empty: () => ({ names: "", img: "" }),
      },
    ],
  },
  {
    id: "reviews",
    title: "Reviews",
    fields: [
      {
        path: "reviews",
        label: "Reviews",
        type: "list",
        itemFields: [
          { path: "name", label: "Name", type: "text" },
          { path: "img", label: "Avatar image", type: "image" },
          {
            path: "text",
            label: "Lines",
            type: "stringList",
            itemField: { path: "", label: "Line", type: "text" },
          },
        ],
        empty: () => ({ name: "", img: "", text: ["", "", ""] }),
      },
    ],
  },
  {
    id: "book",
    title: "Book Section",
    fields: [
      { path: "book.eyebrow", label: "Eyebrow", type: "text" },
      { path: "book.title", label: "Title", type: "text" },
      { path: "book.copyLines", label: "Copy lines", type: "stringList", itemField: { path: "", label: "Line", type: "text" } },
      { path: "book.primaryCta", label: "Primary CTA", type: "text" },
      { path: "book.secondaryCta", label: "Secondary CTA", type: "text" },
      { path: "book.img", label: "Background image", type: "image" },
    ],
  },
  {
    id: "footer",
    title: "Footer",
    fields: [
      { path: "footer.tagline", label: "Tagline", type: "text" },
      { path: "footer.copyright", label: "Copyright", type: "text" },
      { path: "footer.right", label: "Right text", type: "text" },
      {
        path: "footer.explore",
        label: "Explore links",
        type: "list",
        itemFields: [
          { path: "label", label: "Label", type: "text" },
          { path: "href", label: "Href", type: "text" },
        ],
        empty: () => ({ label: "", href: "#" }),
      },
    ],
  },
];

// chapters1 items need proper object template (numbers auto-fill)
const ch1 = editorSections.find((s) => s.id === "story")!.fields.find((f) => f.path === "story.chapters1")!;
ch1.empty = () => ({ n: "06", h: "", p: "" });
