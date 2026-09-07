/**
 * V3 Forms Lab — Three destination geometries with proven shared DNA.
 *
 * NEW MAPPING (user-approved):
 *   DÜN   = KEY      (construction / connection)
 *   YARIN = INFINITY (branching / possibility — "more than one future")
 *   ŞİMDİ = HEART    (convergence / completion — the proposal moment)
 *
 * Route: ?lab=v3-forms
 * Views: ?song=key | infinity | heart | all | dna | morph
 *
 * DNA ARCHITECTURE — five primary strokes, three poses each.
 * LEFT always stays LEFT across all three forms:
 *   KEY left_outer  = left half of key ring
 *   ∞   left_outer  = left LOOP of infinity (outer boundary)
 *   ♥   left_outer  = left LOBE of heart
 * Coordinate arrays share the same command structure → genuinely morphable.
 *
 * COORD format for "2C" arcs:
 *   [x0,y0, c1x,c1y, c2x,c2y, ex1,ey1, c3x,c3y, c4x,c4y, ex2,ey2]  (14 numbers)
 * COORD format for "L" lines:
 *   [x0,y0, x1,y1]  (4 numbers)
 */

import "./FormsLab.css";

const _p   = new URLSearchParams(window.location.search);
const SONG = (_p.get("song") ?? "heart") as
  "key" | "infinity" | "heart" | "all" | "dna" | "morph";

// ── Shared coordinate inventory ───────────────────────────────────────────

type Coord2C = readonly [
  number,number,  // M start
  number,number,  // C ctrl1
  number,number,  //   ctrl2
  number,number,  //   end1
  number,number,  // C ctrl3
  number,number,  //   ctrl4
  number,number,  //   end2
];
type CoordL = readonly [number,number, number,number];
type Pose = "key" | "infinity" | "heart";

const C: Record<string, Record<Pose, Coord2C | CoordL>> = {

  // ── LEFT_OUTER ─────────────────────────────────────────────────────────
  // KEY:      left half of ring (top → left equator → bottom of ring)
  // INFINITY: outer boundary of LEFT loop (top-crossing → left → bot-crossing)
  // HEART:    outer boundary of left lobe (junction → left → bottom point)
  // KEY:      left half of ring
  // INFINITY: outer left loop — C1 at SAME y as start → departs horizontally
  //           (not upward), preventing the flat-top bow-tie look.
  //           Narrow crossing zone (418→422, 4px) → reads as a proper ∞ pinch.
  // HEART:    left lobe outer
  left_outer: {
    key:      [195,172, 118,148, 72,212,  72,296,  72,380,  118,424, 195,420],
    infinity: [195,418, 128,418, 8,318,   8,420,   8,522,   128,422, 195,422],
    heart:    [195,240, 48,128,  18,238,  18,356,  18,474,  105,574, 195,660],
  },

  // ── RIGHT_OUTER ────────────────────────────────────────────────────────
  right_outer: {
    key:      [195,172, 272,148, 318,212, 318,296, 318,380, 272,424, 195,420],
    infinity: [195,418, 262,418, 382,318, 382,420, 382,522, 262,422, 195,422],
    heart:    [195,240, 342,128, 372,238, 372,356, 372,474, 285,574, 195,660],
  },

  // ── LEFT_INNER ─────────────────────────────────────────────────────────
  // KEY:      inner ring arc
  // INFINITY: collapsed to a near-zero-length arc at the crossing center.
  //           Hidden in ∞ display (InfinityForm sets opacity=0 for inner arcs).
  //           Present in coordinate data so morph to key/heart expands cleanly.
  // HEART:    inner lobe arc
  left_inner: {
    key:      [195,224, 152,210, 128,250, 128,296, 128,342, 152,374, 195,372],
    infinity: [195,420, 188,420, 178,420, 178,420, 178,420, 188,420, 195,420],
    heart:    [195,290, 92,196,  62,280,  62,358,  62,436,  135,524, 195,618],
  },

  // ── RIGHT_INNER ────────────────────────────────────────────────────────
  right_inner: {
    key:      [195,224, 238,210, 262,250, 262,296, 262,342, 238,374, 195,372],
    infinity: [195,420, 202,420, 212,420, 212,420, 212,420, 202,420, 195,420],
    heart:    [195,290, 298,196, 328,280, 328,358, 328,436, 255,524, 195,618],
  },

  // ── SPINE ──────────────────────────────────────────────────────────────
  // KEY:      full shaft below ring
  // INFINITY: center crossing marker (short vertical segment at the crossing)
  // HEART:    short junction marker at top
  spine: {
    key:      [195,172, 195,720],
    infinity: [195,390, 195,450],
    heart:    [195,240, 195,295],
  },

};

// ── Path builders ─────────────────────────────────────────────────────────

function path2C(c: readonly number[]): string {
  return `M ${c[0]},${c[1]} C ${c[2]},${c[3]} ${c[4]},${c[5]} ${c[6]},${c[7]} `
       + `C ${c[8]},${c[9]} ${c[10]},${c[11]} ${c[12]},${c[13]}`;
}

function pathL(c: readonly number[]): string {
  return `M ${c[0]},${c[1]} L ${c[2]},${c[3]}`;
}

function lerp(a: readonly number[], b: readonly number[], t: number): number[] {
  return (a as number[]).map((v, i) => v + (b[i] - v) * t);
}

// ── Stroke styles ─────────────────────────────────────────────────────────

const PRI = { fill:"none", stroke:"rgba(242,238,225,0.90)", strokeWidth:"1.1" } as const;
const SEC = { fill:"none", stroke:"rgba(242,238,225,0.46)", strokeWidth:"0.75" } as const;
const ACC = { fill:"none", stroke:"rgba(242,238,225,0.26)", strokeWidth:"0.58" } as const;
const DTL = { fill:"none", stroke:"rgba(242,238,225,0.65)", strokeWidth:"0.85" } as const;

const DNA_COLOR = {
  left_outer:  "rgba(210,155,78,0.85)",
  right_outer: "rgba(88,148,210,0.85)",
  left_inner:  "rgba(210,155,78,0.50)",
  right_inner: "rgba(88,148,210,0.50)",
  spine:       "rgba(195,188,72,0.80)",
};

// ── Shared primary arcs renderer ──────────────────────────────────────────

function FormArcs({ pose, dna = false }: { pose: Pose; dna?: boolean }) {
  const s = (id: string) => dna
    ? { fill:"none", stroke:DNA_COLOR[id as keyof typeof DNA_COLOR],
        strokeWidth: ["left_outer","right_outer","spine"].includes(id) ? "1.2" : "0.8" }
    : (["left_outer","right_outer"].includes(id) ? PRI
      : id === "spine" ? ACC : SEC);

  // In ∞ form (non-DNA display), inner arcs are collapsed to zero-size — hide them.
  // They exist in data for morphing but don't contribute to the ∞ visual.
  const hideInner = pose === "infinity" && !dna;

  return (
    <>
      <path d={path2C(C.left_outer[pose])}  {...s("left_outer")} />
      <path d={path2C(C.right_outer[pose])} {...s("right_outer")} />
      {!hideInner && <path d={path2C(C.left_inner[pose])}  {...s("left_inner")} />}
      {!hideInner && <path d={path2C(C.right_inner[pose])} {...s("right_inner")} />}
      <path d={pathL(C.spine[pose])}        {...s("spine")} />
    </>
  );
}

// ── Form-specific extras ───────────────────────────────────────────────────

function HeartExtras({ dna = false }: { dna?: boolean }) {
  const s = dna ? { ...ACC, stroke:"rgba(242,238,225,0.18)" } : ACC;
  return (
    <>
      <line x1="106" y1="224" x2="18"  y2="356" {...s} />
      <line x1="284" y1="224" x2="372" y2="356" {...s} />
      <line x1="82"  y1="480" x2="195" y2="618" {...s} />
      <line x1="308" y1="480" x2="195" y2="618" {...s} />
      <path d="M 195,240 C 166,218 138,218 112,236" {...s} />
      <path d="M 195,240 C 224,218 252,218 278,236" {...s} />
    </>
  );
}

function KeyExtras({ dna = false }: { dna?: boolean }) {
  const s = dna ? { ...ACC, stroke:"rgba(242,238,225,0.18)" } : ACC;
  return (
    <>
      {/* Structural ribs inside ring */}
      <line x1="140" y1="212" x2="72"  y2="296" {...s} />
      <line x1="250" y1="212" x2="318" y2="296" {...s} />
      <line x1="128" y1="370" x2="195" y2="420" {...s} />
      <line x1="262" y1="370" x2="195" y2="420" {...s} />
      {/* Notch arcs at ring top */}
      <path d="M 195,172 C 170,156 144,160 120,180" {...s} />
      <path d="M 195,172 C 220,156 246,160 270,180" {...s} />
      {/* Teeth — key only */}
      <line x1="195" y1="516" x2="138" y2="516" {...(dna ? s : DTL)} />
      <line x1="195" y1="576" x2="154" y2="576" {...(dna ? s : DTL)} />
      <line x1="195" y1="636" x2="138" y2="636" {...(dna ? s : DTL)} />
      <line x1="175" y1="720" x2="215" y2="720" {...(dna ? s : DTL)} />
    </>
  );
}

function InfinityExtras({ dna = false }: { dna?: boolean }) {
  const s = dna ? { ...ACC, stroke:"rgba(242,238,225,0.18)" } : ACC;
  // Clean minimal extras — just the center crossing accent.
  // The ∞ is legible from the outer arcs alone; no corner ribs or notch arcs needed.
  return (
    <>
      {/* Subtle crossing marker — short diagonal accents at the pinch point */}
      <line x1="180" y1="413" x2="210" y2="427" {...s} />
      <line x1="210" y1="413" x2="180" y2="427" {...s} />
    </>
  );
}

// ── Full form compositions ────────────────────────────────────────────────

function HeartForm({ dna = false }: { dna?: boolean }) {
  return <><FormArcs pose="heart" dna={dna}/><HeartExtras dna={dna}/></>;
}

function KeyForm({ dna = false }: { dna?: boolean }) {
  return <><FormArcs pose="key" dna={dna}/><KeyExtras dna={dna}/></>;
}

function InfinityForm({ dna = false }: { dna?: boolean }) {
  return <><FormArcs pose="infinity" dna={dna}/><InfinityExtras dna={dna}/></>;
}

// ── Morph proof ────────────────────────────────────────────────────────────

function MorphForm({ from, to, t }: { from: Pose; to: Pose; t: number }) {
  const makeS = (id: string) => ({
    fill: "none",
    stroke: DNA_COLOR[id as keyof typeof DNA_COLOR],
    strokeWidth: ["left_outer","right_outer"].includes(id) ? "1.2" : "0.8",
  });
  const ids = ["left_outer","right_outer","left_inner","right_inner","spine"] as const;
  return (
    <>
      {ids.map((id) => {
        const coords = lerp(C[id][from], C[id][to], t);
        const d = C[id][from].length === 4 ? pathL(coords) : path2C(coords);
        return <path key={id} d={d} {...makeS(id)} />;
      })}
    </>
  );
}

// ── Scaled wrapper ─────────────────────────────────────────────────────────

function Scaled({
  scale = 1, cx = 195, cy = 420, children,
}: { scale?: number; cx?: number; cy?: number; children: React.ReactNode }) {
  return (
    <g transform={`translate(${cx - 195 * scale},${cy - 420 * scale}) scale(${scale})`}>
      {children}
    </g>
  );
}

// ── Legend ─────────────────────────────────────────────────────────────────

function DNALegend({ y0 = 720 }: { y0?: number }) {
  return (
    <>
      {(Object.entries(DNA_COLOR) as [string,string][]).map(([id, col], i) => (
        <g key={id} transform={`translate(16,${y0 + i * 13})`}>
          <line x1="0" y1="0" x2="16" y2="0" stroke={col} strokeWidth="1.5"/>
          <text x="22" y="4" fontFamily="ui-sans-serif" fontSize="7" fill={col}
                letterSpacing="0.06em">{id}</text>
        </g>
      ))}
    </>
  );
}

// ── App ────────────────────────────────────────────────────────────────────

export function FormsLab() {
  const label =
    SONG === "key"      ? "KEY / DÜN" :
    SONG === "infinity" ? "∞ / YARIN" : "";

  // DNA color-coded comparison
  if (SONG === "dna") {
    const s = 0.27;
    return (
      <div className="vf">
        <svg viewBox="0 0 390 844" className="vf__svg" preserveAspectRatio="xMidYMid meet">
          <rect width="390" height="844" fill="#010101"/>
          <text x="195" y="42" textAnchor="middle" fontFamily="ui-sans-serif"
                fontSize="7.5" letterSpacing="0.18em" fill="rgba(242,238,225,0.26)">
            SHARED STROKES — same color = same ID
          </text>
          <Scaled scale={s} cx={65}  cy={400}><KeyForm      dna/></Scaled>
          <Scaled scale={s} cx={195} cy={400}><InfinityForm dna/></Scaled>
          <Scaled scale={s} cx={325} cy={400}><HeartForm    dna/></Scaled>
          <text x="65"  y="575" textAnchor="middle" fontFamily="ui-sans-serif"
                fontSize="6.5" letterSpacing="0.14em" fill="rgba(242,238,225,0.22)">DÜN</text>
          <text x="195" y="575" textAnchor="middle" fontFamily="ui-sans-serif"
                fontSize="6.5" letterSpacing="0.14em" fill="rgba(242,238,225,0.22)">YARIN</text>
          <text x="325" y="575" textAnchor="middle" fontFamily="ui-sans-serif"
                fontSize="6.5" letterSpacing="0.14em" fill="rgba(242,238,225,0.22)">ŞİMDİ</text>
          <DNALegend y0={620}/>
        </svg>
      </div>
    );
  }

  // Morph proof
  if (SONG === "morph") {
    return (
      <div className="vf">
        <svg viewBox="0 0 390 844" className="vf__svg" preserveAspectRatio="xMidYMid slice">
          <rect width="390" height="844" fill="#010101"/>
          {/* Two mid-frames: KEY→∞ and ∞→HEART side by side */}
          <text x="195" y="38" textAnchor="middle" fontFamily="ui-sans-serif"
                fontSize="7.5" letterSpacing="0.14em" fill="rgba(242,238,225,0.25)">
            KEY → ∞  ·  ∞ → HEART  (t = 0.5)
          </text>
          {/* Left: KEY→∞ at t=0.5 */}
          <Scaled scale={0.48} cx={98} cy={320}><MorphForm from="key" to="infinity" t={0.5}/></Scaled>
          {/* Right: ∞→HEART at t=0.5 */}
          <Scaled scale={0.48} cx={292} cy={320}><MorphForm from="infinity" to="heart" t={0.5}/></Scaled>
          {/* Divider */}
          <line x1="195" y1="100" x2="195" y2="560"
                stroke="rgba(242,238,225,0.10)" strokeWidth="0.5"/>
          <DNALegend y0={580}/>
        </svg>
      </div>
    );
  }

  // Side-by-side all
  if (SONG === "all") {
    const s = 0.27;
    return (
      <div className="vf">
        <svg viewBox="0 0 390 844" className="vf__svg" preserveAspectRatio="xMidYMid meet">
          <rect width="390" height="844" fill="#010101"/>
          <text x="195" y="42" textAnchor="middle" fontFamily="ui-sans-serif"
                fontSize="8" letterSpacing="0.20em" fill="rgba(242,238,225,0.26)">
            KEY · ∞ · HEART
          </text>
          <Scaled scale={s} cx={65}  cy={420}><KeyForm/></Scaled>
          <Scaled scale={s} cx={195} cy={420}><InfinityForm/></Scaled>
          <Scaled scale={s} cx={325} cy={420}><HeartForm/></Scaled>
          <text x="65"  y="748" textAnchor="middle" fontFamily="ui-sans-serif"
                fontSize="7" letterSpacing="0.14em" fill="rgba(242,238,225,0.24)">DÜN</text>
          <text x="195" y="748" textAnchor="middle" fontFamily="ui-sans-serif"
                fontSize="7" letterSpacing="0.14em" fill="rgba(242,238,225,0.24)">YARIN</text>
          <text x="325" y="748" textAnchor="middle" fontFamily="ui-sans-serif"
                fontSize="7" letterSpacing="0.14em" fill="rgba(242,238,225,0.24)">ŞİMDİ</text>
        </svg>
      </div>
    );
  }

  // Full-screen single form
  return (
    <div className="vf">
      <svg viewBox="0 0 390 844" className="vf__svg" preserveAspectRatio="xMidYMid slice">
        <rect width="390" height="844" fill="#010101"/>
        {SONG === "key"      && <KeyForm/>}
        {SONG === "infinity" && <InfinityForm/>}
        {SONG === "heart"    && <HeartForm/>}
        {label && (
          <text x="195" y="40" textAnchor="middle" fontFamily="ui-sans-serif"
                fontSize="8" letterSpacing="0.24em" fill="rgba(242,238,225,0.20)">
            {label}
          </text>
        )}
      </svg>
    </div>
  );
}
