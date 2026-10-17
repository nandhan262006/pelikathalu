import { getFontKit } from "@/lib/fonts";

export default function FontVars({ id }: { id?: string }) {
  const f = getFontKit(id);
  const css = `:root{--serif:${f.serif};--script:${f.script};--sans:${f.sans};}`;
  return <style data-font={f.id} dangerouslySetInnerHTML={{ __html: css }} />;
}
