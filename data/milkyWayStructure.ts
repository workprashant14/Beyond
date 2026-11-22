/**
 * Milky Way structure facts. Every value was read from the page named in `source` on 2026-11-13 (WebFetch summaries,
 * quoted in `quote`). Where sources disagree, both are kept. Nothing here is invented: a row without a checked source is
 * listed in UNVERIFIED instead.
 */
import type { DataKind } from "@/types/provenance";

export interface StructureFact {
  id: string;
  label: string;
  value: string;
  kind: DataKind;
  note?: string;
  quote: string;
  source: { label: string; url: string };
}

const GRAVITY = { label: "GRAVITY Collaboration, A&A 657, L12 (2022)", url: "https://www.aanda.org/10.1051/0004-6361/202142465" };
const REID = { label: "Reid et al. 2019, Trigonometric Parallaxes of High-Mass Star-Forming Regions: Our View of the Milky Way", url: "https://arxiv.org/abs/1910.03357" };
const SPITZER = { label: "NASA/JPL-Caltech, PIA10748 (artist's concept)", url: "https://www.jpl.nasa.gov/images/pia10748-our-milky-way-gets-a-makeover-artist-concept" };
const SPACE = { label: "Space.com, Milky Way galaxy facts (secondary source)", url: "https://www.space.com/19915-milky-way-galaxy.html" };

/** Distance Sun to Sgr A*, in parsecs, as measured by GRAVITY (statistical error 9 pc, systematic about 30 pc). */
export const R0_GRAVITY_PC = 8277;
export const R0_GRAVITY_STAT_PC = 9;
export const R0_GRAVITY_SYS_PC = 30;
/** Reid et al. 2019 value in kiloparsecs. */
export const R0_REID_KPC = 8.15;
export const R0_REID_ERR_KPC = 0.15;
/** Disk diameter in light-years (Space.com), used only to place the Sun on the schematic. */
export const DISK_DIAMETER_LY = 100_000;
/** Average pitch angle of the four major arms in Reid et al. 2019, section 8.1 ("about 10 degrees"). */
export const ARM_PITCH_DEG = 10;

export const FACTS: StructureFact[] = [
  {
    id: "r0-gravity", label: "Distance from the Sun to Sgr A*", value: "8,277 ± 9 pc (about 27,000 light-years)", kind: "observed",
    note: "The ±9 pc is statistical; the paper gives a systematic uncertainty of about 30 pc. The light-year figure is my conversion (1 pc = 3.26156 ly).",
    quote: "The best fit further yields R0 = (8277 ± 9) pc", source: GRAVITY,
  },
  {
    id: "r0-reid", label: "Same distance, from star-forming region parallaxes", value: "8.15 ± 0.15 kpc", kind: "observed",
    note: "A different method (maser and radio parallaxes), so the two values are independent estimates and overlap within their uncertainties.",
    quote: "distance to the Galactic center, R0 = 8.15 ± 0.15 kpc", source: REID,
  },
  {
    id: "arms-four", label: "Spiral arms (parallax view)", value: "Four major arms: Norma-Outer, Scutum-Centaurus-OSC, Sagittarius-Carina, Perseus, plus extra segments and spurs", kind: "observed",
    note: "Average pitch angle of the major arms is about 10° (section 8.1).",
    quote: "These measurements strongly suggest that the Milky Way is a four-arm spiral, with some extra arm segments and spurs.", source: REID,
  },
  {
    id: "arms-two", label: "Spiral arms (Spitzer-era view)", value: "Two major arms attached to the ends of a thick central bar, plus two less distinct minor arms between them", kind: "observed",
    note: "This is the 2008 NASA/JPL description, shown beside an artist's concept. It disagrees with the four-major-arm picture above; astronomers' descriptions differ by which tracer (young stars and gas, or older stars) is used. I am showing both rather than choosing.",
    quote: "The galaxy's two major arms can be seen attached to the ends of a thick central bar … the two now-demoted minor arms are less distinct and located between the major arms.", source: SPITZER,
  },
  {
    id: "sun-arm", label: "Where the Sun sits", value: "Near a small partial arm called the Orion Arm, or Orion Spur (also called the Local arm)", kind: "observed",
    note: "Reid et al. call the Local arm \"an isolated arm segment with very significant massive star formation\".",
    quote: "Our sun lies near a small, partial arm called the Orion Arm, or Orion Spur", source: SPITZER,
  },
  {
    id: "disk", label: "Disk size", value: "About 100,000 light-years across and 1,000 light-years thick", kind: "estimated",
    note: "From a secondary source that is inconsistent elsewhere in the same article. The catalogue entry also says \"roughly 100,000 light-years\". Treat as approximate.",
    quote: "100,000 light-years across and 1,000 light-years thick", source: SPACE,
  },
  {
    id: "bulge", label: "Central bulge", value: "Peanut-shaped, about 10,000 light-years across", kind: "estimated",
    note: "Attributed to ESA by the secondary source; I could not open the ESA page to check.",
    quote: "peanut-shaped, measuring 10,000 light-years across, according to ESA", source: SPACE,
  },
  {
    id: "orbit", label: "Sun's orbit around the centre", value: "About 230 million years per circuit (the same article also says 250 million)", kind: "estimated",
    note: "The secondary source gives both numbers, so the true value is not pinned down here.",
    quote: "takes 230 million years to complete a full orbit around the galactic center", source: SPACE,
  },
];

/** Things people expect on this page that I could not verify from a primary source, so they are not shown as facts. */
export const UNVERIFIED = [
  "Size of the halo (the secondary source's description of it is doubtful, so I left it out).",
  "Exact length and angle of the central bar.",
  "Where each arm lies in the sky: the schematic uses idealised spirals, not a measured map.",
  "Total mass and number of stars.",
];

/** Metres-free helper: parsecs to light-years. */
export const PC_TO_LY = 3.26156;
export const parsecsToLy = (pc: number) => pc * PC_TO_LY;
