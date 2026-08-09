// Client-safe geo helpers (no server imports) shared by the globe war lines
// and the flat conflict map.

type Pt = [number, number]; // [lat, lng]

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

// Great-circle interpolation between two [lat,lng] points at fraction f (0..1),
// so intermediate nodes follow the curve of the globe rather than a flat line.
function slerp(a: Pt, b: Pt, f: number): Pt {
  const φ1 = toRad(a[0]);
  const λ1 = toRad(a[1]);
  const φ2 = toRad(b[0]);
  const λ2 = toRad(b[1]);
  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((φ2 - φ1) / 2) ** 2 +
          Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2,
      ),
    );
  if (d === 0) return [a[0], a[1]];
  const A = Math.sin((1 - f) * d) / Math.sin(d);
  const B = Math.sin(f * d) / Math.sin(d);
  const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
  const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
  const z = A * Math.sin(φ1) + B * Math.sin(φ2);
  const φ = Math.atan2(z, Math.sqrt(x * x + y * y));
  const λ = Math.atan2(y, x);
  return [toDeg(φ), toDeg(λ)];
}

// Subdivide a coordinate path so it has at least `minNodes` points, adding
// great-circle interpolated nodes between the real vertices. Detailed front
// lines that trace the terrain instead of a coarse zig-zag.
export function densifyPath(path: Pt[], minNodes = 50): Pt[] {
  if (path.length < 2) return path;
  const segments = path.length - 1;
  const perSegment = Math.max(1, Math.ceil((minNodes - 1) / segments));
  const out: Pt[] = [];
  for (let s = 0; s < segments; s++) {
    const a = path[s];
    const b = path[s + 1];
    for (let k = 0; k < perSegment; k++) out.push(slerp(a, b, k / perSegment));
  }
  out.push(path[segments]);
  return out;
}
