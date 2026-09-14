import type {HubIconName} from './hub-content.ts';

const PATHS: Record<HubIconName, string> = {
  home: 'M3 11l9-7 9 7M5.5 9.5V20h4.5v-6h4v6h4.5V9.5',
  play: 'M8 5l11 7-11 7z',
  character: 'M12 3C7.8 3 5 6 5 10v3l2 2v5h10v-5l2-2v-3c0-4-2.8-7-7-7zM8 11h8M9.5 11l1 3h3l1-3',
  inventory: 'M3 7.5L12 3l9 4.5-9 4.5zM3 7.5v9L12 21l9-4.5v-9M12 12v9',
  season: 'M12 3l8 3v5c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6zM8.5 10.5l3.5 3 3.5-3',
  events: 'M4 6h16v14H4zM4 10h16M8 3v5M16 3v5M8 14h2M12 14h2M8 17h2M12 17h2',
  leaderboard: 'M4 20v-8h4v8M10 20V5h4v15M16 20v-5h4v5',
  marketplace: 'M3 4h2.5l2.3 11h10.1L20 8H6.6M9 19.5h.01M17 19.5h.01',
  news: 'M5 4h14v16H5zM8.5 8h7M8.5 12h7M8.5 16h4',
  chevron: 'M9 5.5l6.5 6.5L9 18.5',
  wallet: 'M4 7.5h14.5A1.5 1.5 0 0 1 20 9v10H4zM4 7.5L15.5 4v3.5M15.5 13.5H20',
};

export default function HubIcon({name}: {name: HubIconName}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} />
    </svg>
  );
}
