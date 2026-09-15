// Line icons shared by the in-game HUD and the UI kit panels.

export const GLYPH_PATHS: Readonly<Record<string, string>> = {
  sword: "M5 20L19 4l1 5L9 20M4 14l6 6M3 21l3-3",
  blades: "M3 3l17 18M21 3L4 21M3 15l6 6M15 21l6-6",
  burst: "M12 2v5M12 17v5M2 12h5M17 12h5M5 5l4 4M15 15l4 4M19 5l-4 4M9 15l-4 4",
  shield: "M12 3l8 3v6q0 6-8 10Q4 18 4 12V6zM12 8v8M8 12h8",
  spark: "M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3z",
  bolt: "M14 2L5 14h7l-2 8 9-14h-7z",
  target: "M8 12a4 4 0 1 0 8 0 4 4 0 1 0-8 0M12 2v5M12 17v5M2 12h5M17 12h5",
  bag: "M7 7V5q5-5 10 0v2M4 7h16v14H4zM4 12h16",
  tree: "M12 3v18M4 9h16M4 9v6M20 9v6M10 2h4v3h-4zM2 15h4v4H2zM18 15h4v4h-4z",
  quest: "M5 3h14v18H5zM9 8h6M9 12h6M9 16h4",
  settings: "M3 7h18M3 17h18M8 3v8M16 13v8",
};

export function Glyph({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={GLYPH_PATHS[name] ?? GLYPH_PATHS.spark} />
    </svg>
  );
}
