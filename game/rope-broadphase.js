// Sweep the widest axis, then keep the original solver ordering. This only
// rejects disjoint swept AABBs; exact collision and tunnelling tests are unchanged.
export function visitRopePairs(ropes, swept, radius, visit) {
  const edges = [], lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let ri = 0; ri < ropes.length; ri++) {
    const r = ropes[ri];
    if (r.broken >= 0) continue;
    const cached = r._collisionEdges ||= [];
    for (let i = 0; i < r.points.length - 1; i++) {
      const a = r.points[i], b = r.points[i + 1], p = swept ? r.previous[i] : a, q = swept ? r.previous[i + 1] : b;
      const e = cached[i] ||= { r, i, min: [0, 0, 0], max: [0, 0, 0] };
      e.ri = ri; e.order = edges.length;
      e.min[0] = Math.min(a.x, b.x, p.x, q.x); e.max[0] = Math.max(a.x, b.x, p.x, q.x);
      e.min[1] = Math.min(a.y, b.y, p.y, q.y); e.max[1] = Math.max(a.y, b.y, p.y, q.y);
      e.min[2] = Math.min(a.z, b.z, p.z, q.z); e.max[2] = Math.max(a.z, b.z, p.z, q.z);
      for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], e.min[k]); hi[k] = Math.max(hi[k], e.max[k]); }
      edges.push(e);
    }
  }
  let axis = 0;
  for (let k = 1; k < 3; k++) if (hi[k] - lo[k] > hi[axis] - lo[axis]) axis = k;
  edges.sort((a, b) => a.min[axis] - b.min[axis] || a.order - b.order);
  const hits = []; let checks = 0;
  for (let x = 0; x < edges.length; x++) {
    const left = edges[x];
    for (let y = x + 1; y < edges.length; y++) {
      const right = edges[y];
      if (right.min[axis] > left.max[axis] + radius) break;
      checks++;
      const a = left.order < right.order ? left : right, b = a === left ? right : left;
      if (a.ri === b.ri && Math.abs(b.i - a.i) < 2) continue;
      if (a.min[0] > b.max[0] + radius || b.min[0] > a.max[0] + radius || a.min[1] > b.max[1] + radius || b.min[1] > a.max[1] + radius || a.min[2] > b.max[2] + radius || b.min[2] > a.max[2] + radius) continue;
      hits.push([a, b]);
    }
  }
  hits.sort((a, b) => a[0].order - b[0].order || a[1].order - b[1].order);
  for (const [a, b] of hits) visit(a, b);
  return checks;
}
