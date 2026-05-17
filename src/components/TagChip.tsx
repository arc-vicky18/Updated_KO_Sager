import type { Tag } from "@/lib/types";
import { motion } from "framer-motion";

export function TagChip({ tag, onClick, selected, size = "sm" }: { tag: Tag; onClick?: () => void; selected?: boolean; size?: "sm" | "md" }) {
  return (
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`group inline-flex items-center gap-1.5 rounded-full border transition-all ${size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-sm"} ${selected ? "border-primary bg-primary/10 text-primary" : "border-border bg-card hover:border-primary/50 hover:bg-primary/5"}`}
      style={selected ? undefined : { boxShadow: `inset 3px 0 0 ${tag.color}` }}
      title={tag.description}
    >
      <span className="size-1.5 rounded-full" style={{ background: tag.color }} />
      <span className="font-medium truncate max-w-[18ch]">{tag.name}</span>
      {tag.count > 0 && <span className="text-[10px] text-muted-foreground tabular-nums">{tag.count}</span>}
    </motion.button>
  );
}

export function SeverityDot({ s }: { s: Tag["severity"] }) {
  const map: Record<string, string> = {
    info: "bg-info", low: "bg-info", medium: "bg-warning", high: "bg-destructive", critical: "bg-destructive",
  };
  return <span className={`size-2 rounded-full ${map[s]}`} title={s} />;
}
