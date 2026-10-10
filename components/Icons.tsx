type P = { className?: string };

export const WhatsApp = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3.5 20.5l1.3-4.6A8.5 8.5 0 1 1 8.2 19.3L3.5 20.5z" />
    <path d="M9 8.4c.2-.5.5-.6.8-.6h.5c.2 0 .4 0 .5.4l.7 1.6c.1.2 0 .4-.1.6l-.5.6c-.1.1-.1.3 0 .5.5.9 1.3 1.7 2.3 2.2.2.1.4.1.5 0l.6-.7c.1-.2.3-.2.5-.1l1.6.8c.2.1.3.2.3.4v.4c0 .5-.3 1-.8 1.2-.6.3-1.4.4-2.6-.1-1.8-.7-3.3-2.2-4.1-3.9-.4-.9-.4-1.7-.2-2.3z" fill="currentColor" stroke="none" />
  </svg>
);

export const Arrow = ({ className, dir = "right" }: P & { dir?: "left" | "right" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={dir === "left" ? { transform: "scaleX(-1)" } : undefined}>
    <path d="M4 12h15M13 6l6 6-6 6" />
  </svg>
);

export const Home = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 3.2 3 10.4V20a1 1 0 0 0 1 1h5.2v-5.6h5.6V21H20a1 1 0 0 0 1-1v-9.6L12 3.2z" />
  </svg>
);

export const Portfolio = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden>
    <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
    <path d="M10 8.8v6.4l5.2-3.2L10 8.8z" />
  </svg>
);

export const Heart = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden>
    <path d="M12 20.3s-8-4.9-8-10.7A4.4 4.4 0 0 1 12 7a4.4 4.4 0 0 1 8 2.6c0 5.8-8 10.7-8 10.7z" />
  </svg>
);

export const Menu = ({ className }: P) => (
  <svg className={className} viewBox="0 0 34 26" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden>
    <path d="M2 2h30M2 13h30M2 24h30" />
  </svg>
);
