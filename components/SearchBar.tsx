"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { getAllObjects, getPopular } from "@/services/catalogue";
import { CATEGORY_CHIPS, norm, searchObjects } from "@/utils/search";
import { CATEGORY_LABEL } from "@/types/celestial";
import { loadSky, loadDso, mergeDso, type DsoSet, type SkyData } from "@/universe/sky/skyData";
import { searchSky } from "@/utils/skySearch";
import { searchMoons, type Moon } from "@/utils/moons";
import { loadMoons } from "@/utils/moonData";

/** One row in the dropdown, whether it comes from the catalogue or from the sky atlas. */
interface Item {
  key: string;
  name: string;
  summary: string;
  meta: string | null;
  label: string;
  href: string;
}

const toItem = (o: ReturnType<typeof getPopular>[number], target: string): Item => ({
  key: `obj-${o.id}`,
  name: o.name,
  summary: o.summary,
  meta: [o.distance, o.diameter && `Ø ${o.diameter}`].filter(Boolean).join(" · ") || null,
  label: CATEGORY_LABEL[o.category],
  href: `/${target}?object=${encodeURIComponent(o.id)}`,
});

const skyHref = (h: { kind: "star" | "con" | "dso"; id: string }) =>
  h.kind === "con" ? `/sky?con=${encodeURIComponent(h.id)}` : h.kind === "dso" ? `/sky?dso=${encodeURIComponent(h.id)}` : `/sky?star=${h.id}`;

/** Bold the part of the name the user typed (plain substring match; fuzzy hits just show unhighlighted). */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-transparent font-semibold text-cyan">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

export default function SearchBar({
  autoFocus = false,
  target = "explore",
}: {
  autoFocus?: boolean;
  /** Where choosing a result navigates. */
  target?: "explore" | "map";
}) {
  const router = useRouter();
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const typed = norm(query).length > 0;
  const [sky, setSky] = useState<SkyData | null>(null);
  const [moons, setMoons] = useState<Moon[] | null>(null);
  const [dsoBright, setDsoBright] = useState<DsoSet | null>(null);
  const [dsoFaint, setDsoFaint] = useState<DsoSet | null>(null);

  // The star catalogue (about 130 KB gzip) is fetched the first time the box opens, never on page load.
  useEffect(() => {
    if (open && !sky) loadSky().then(setSky).catch(() => {});
    if (open && !dsoBright) loadDso("bright").then(setDsoBright).catch(() => {});
    if (open && !moons) loadMoons().then(setMoons).catch(() => {});
  }, [open, sky, dsoBright, moons]);
  // The faint tier (about 250 KB) is only fetched when the query looks like a catalogue number such as "NGC 4565".
  const wantsFaint = /^(ngc|ic|pgc|mel|ugc|eso)\s?\d/i.test(query.trim());
  useEffect(() => {
    if (open && wantsFaint && !dsoFaint) loadDso("faint").then(setDsoFaint).catch(() => {});
  }, [open, wantsFaint, dsoFaint]);
  const dso = useMemo(() => (dsoBright ? mergeDso(dsoBright, dsoFaint) : null), [dsoBright, dsoFaint]);

  const objectNames = useMemo(() => new Set(getAllObjects().map((o) => norm(o.name))), []);
  // With nothing typed we suggest popular objects, so the list is never empty on focus.
  const suggestions = useMemo(() => getPopular().slice(0, 5).map((o) => toItem(o, target)), [target]);
  const list: Item[] = useMemo(() => {
    if (!typed) return suggestions;
    const objs = searchObjects(getAllObjects(), query).map((o) => toItem(o, target));
    const skyHits = sky
      ? searchSky(sky, query, 6, objectNames, dso).map<Item>((h) => ({
          key: `sky-${h.kind}-${h.id}`,
          name: h.name,
          summary: h.sub,
          meta: null,
          label: h.kind === "con" ? "Constellation" : h.kind === "dso" ? "Deep sky" : "Star",
          href: skyHref(h),
        }))
      : [];
    const moonHits = moons
      ? searchMoons(moons, query, 5, objectNames).map<Item>((h) => ({
          key: `moon-${h.id}`, name: h.name, summary: h.sub, meta: null, label: "Moon", href: `/moons?m=${encodeURIComponent(h.id)}`,
        }))
      : [];
    return [...objs, ...moonHits, ...skyHits];
  }, [typed, query, moons, sky, dso, suggestions, objectNames, target]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  const go = (o: Item) => {
    setOpen(false);
    router.push(o.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, Math.max(list.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (list[active]) go(list[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const showList = open;
  const activeId = showList && list[active] ? `${listId}-${list[active].key}` : undefined;

  return (
    <div ref={wrapRef} className="relative w-full max-w-xl">
      <div className="glass flex items-center gap-3 rounded-full px-5 py-3.5 transition focus-within:border-cyan/50 focus-within:shadow-[0_0_30px_-8px_rgba(82,224,255,0.5)]">
        <Search size={18} className="shrink-0 text-muted" aria-hidden />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label="Search celestial objects"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={activeId}
          aria-autocomplete="list"
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck={false}
          value={query}
          placeholder="Search Earth, Andromeda, black holes, nebulae…"
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="w-full bg-transparent text-sm text-ink placeholder:text-muted/70 focus:outline-none"
        />
      </div>

      {showList && (
        <div className="glass absolute left-0 right-0 top-full z-40 mt-2 max-h-[min(26rem,70svh)] overflow-y-auto rounded-2xl p-2 text-left">
          {!typed && (
            <div className="flex flex-wrap gap-1.5 px-2 pb-2 pt-1" aria-label="Browse by type">
              {CATEGORY_CHIPS.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => {
                    setQuery(c.query);
                    setActive(0);
                    inputRef.current?.focus();
                  }}
                  className="rounded-full border border-line px-3 py-1 text-xs text-muted transition hover:border-cyan/60 hover:text-ink"
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}
          {!typed && <p className="eyebrow !text-[0.6rem] px-3 pb-1 pt-1">Popular</p>}

          <ul id={listId} role="listbox" aria-label={typed ? "Search results" : "Popular objects"}>
            {list.length === 0 ? (
              <li className="px-4 py-3 text-sm text-muted">No object, star or constellation matches “{query}”.</li>
            ) : (
              list.map((o, i) => (
                <li key={o.key} id={`${listId}-${o.key}`} role="option" aria-selected={i === active}>
                  <div
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(o)}
                    className={`flex w-full cursor-pointer items-start justify-between gap-4 rounded-xl px-4 py-3 text-left transition ${
                      i === active ? "bg-white/8" : ""
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-ink">
                        <Highlight text={o.name} query={query} />
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">{o.summary}</span>
                      {o.meta && <span className="mt-1 block text-[11px] text-muted/80">{o.meta}</span>}
                    </span>
                    <span className="eyebrow shrink-0 pt-0.5 !text-[0.6rem]">{o.label}</span>
                  </div>
                </li>
              ))
            )}
          </ul>

          {typed && list.length > 0 && (
            <Link
              href={`/search?q=${encodeURIComponent(query.trim())}`}
              onClick={() => setOpen(false)}
              className="mt-1 block rounded-xl px-4 py-2.5 text-xs text-muted transition hover:bg-white/5 hover:text-ink"
            >
              See all results for “{query.trim()}” →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
