/** Helpers for the Kanban flow (tree/graph) view. */

export interface FlowNode {
  id: string;
  parent_card_id: string | null;
  flow_x: number | null;
  flow_y: number | null;
}

export const NODE_W = 240;
export const NODE_H = 110;
const H_GAP = 60;
const V_GAP = 40;

/** Reingold–Tilford-ish tidy layout for a forest. Returns absolute positions. */
export function autoLayout<N extends FlowNode>(nodes: N[]): Map<string, { x: number; y: number }> {
  const byId = new Map(nodes.map((n) => [n.id, n] as const));
  const childrenOf = new Map<string | null, string[]>();
  for (const n of nodes) {
    const key = n.parent_card_id && byId.has(n.parent_card_id) ? n.parent_card_id : null;
    if (!childrenOf.has(key)) childrenOf.set(key, []);
    childrenOf.get(key)!.push(n.id);
  }
  const roots = childrenOf.get(null) ?? [];

  // Compute subtree width in "leaf units"
  const widthOf = new Map<string, number>();
  const computeWidth = (id: string): number => {
    const kids = childrenOf.get(id) ?? [];
    if (kids.length === 0) { widthOf.set(id, 1); return 1; }
    const w = kids.reduce((s, k) => s + computeWidth(k), 0);
    widthOf.set(id, w);
    return w;
  };
  for (const r of roots) computeWidth(r);

  const pos = new Map<string, { x: number; y: number }>();
  const unit = NODE_W + H_GAP;
  let cursorX = 0;

  const place = (id: string, depth: number, left: number) => {
    const w = widthOf.get(id) ?? 1;
    const kids = childrenOf.get(id) ?? [];
    let acc = left;
    for (const k of kids) {
      const kw = widthOf.get(k) ?? 1;
      place(k, depth + 1, acc);
      acc += kw;
    }
    const centerUnits = left + w / 2 - 0.5;
    pos.set(id, { x: centerUnits * unit, y: depth * (NODE_H + V_GAP) });
  };

  for (const r of roots) {
    const w = widthOf.get(r) ?? 1;
    place(r, 0, cursorX);
    cursorX += w;
  }

  return pos;
}

/** Anchor points on a node rectangle (top-left coords). */
export function bottomAnchor(p: { x: number; y: number }) {
  return { x: p.x + NODE_W / 2, y: p.y + NODE_H };
}
export function topAnchor(p: { x: number; y: number }) {
  return { x: p.x + NODE_W / 2, y: p.y };
}

/** Smooth vertical S-curve between two points. */
export function curvePath(a: { x: number; y: number }, b: { x: number; y: number }): string {
  const dy = Math.max(40, (b.y - a.y) / 2);
  return `M ${a.x} ${a.y} C ${a.x} ${a.y + dy}, ${b.x} ${b.y - dy}, ${b.x} ${b.y}`;
}
