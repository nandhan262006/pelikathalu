import { getPalette } from "@/lib/palettes";

export default function PaletteVars({ id }: { id?: string }) {
  const p = getPalette(id);
  const css = `:root{--pk-bg:${p.bg};--pk-surface:${p.surface};--pk-primary:${p.primary};--pk-accent:${p.accent};--pk-text:${p.text};}`;
  return <style data-palette={p.id} dangerouslySetInnerHTML={{ __html: css }} />;
}
