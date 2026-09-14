// Hub data: navigation and feature cards. Text lives here, not in images
// (UI kit rule: artwork only in PNG/WebP, everything readable is rendered by React).
import {ASSET_URLS} from '../../assets/registry.ts';

export type HubIconName =
  | 'home'
  | 'play'
  | 'character'
  | 'inventory'
  | 'season'
  | 'events'
  | 'leaderboard'
  | 'marketplace'
  | 'news'
  | 'chevron'
  | 'wallet';

export interface HubNavItem {
  id: string;
  label: string;
  icon: HubIconName;
  /** Route; items without a route are shown as "soon". */
  href?: string;
  /** Shown in the mobile portrait tab bar. */
  tab: boolean;
}

export const HUB_NAV: readonly HubNavItem[] = [
  {id: 'home', label: 'Home', icon: 'home', href: '/', tab: true},
  {id: 'play', label: 'Play', icon: 'play', href: '/base', tab: true},
  {id: 'character', label: 'Character', icon: 'character', tab: true},
  {id: 'inventory', label: 'Inventory', icon: 'inventory', tab: true},
  {id: 'season', label: 'Season', icon: 'season', tab: true},
  {id: 'events', label: 'Events', icon: 'events', tab: true},
  {id: 'leaderboard', label: 'Leaderboard', icon: 'leaderboard', tab: false},
  {id: 'marketplace', label: 'Marketplace', icon: 'marketplace', tab: false},
  {id: 'news', label: 'News', icon: 'news', tab: false},
];

export type HubCardId = 'season' | 'skynet' | 'nft' | 'base' | 'metro';

export interface HubCard {
  id: HubCardId;
  tone: 'blue' | 'red' | 'violet';
  eyebrow?: string;
  title: string;
  subtitle: string;
  note?: string;
  /** Shown instead of the arrow when the card has no route yet. */
  status?: string;
  href?: string;
  art: string;
}

export const HUB_CARDS: readonly HubCard[] = [
  {
    id: 'season',
    tone: 'blue',
    title: 'Season 1',
    subtitle: 'The Awakening',
    note: 'New challenges. Higher rewards.',
    status: 'Coming soon',
    art: ASSET_URLS.ui.hubCards.season,
  },
  {
    id: 'skynet',
    tone: 'red',
    eyebrow: 'Limited time event',
    title: 'SkyNet',
    subtitle: 'The machines take over.',
    note: 'The resistance fights back.',
    status: 'Coming soon',
    art: ASSET_URLS.ui.hubCards.skynet,
  },
  {
    id: 'nft',
    tone: 'violet',
    title: 'NFT Collection',
    subtitle: 'CyberBase Genesis',
    note: 'Own. Play. Belong.',
    status: 'Coming soon',
    art: ASSET_URLS.ui.hubCards.nft,
  },
  {
    id: 'base',
    tone: 'blue',
    title: 'Base',
    subtitle: 'Safe zone',
    href: '/base',
    art: ASSET_URLS.ui.hubCards.base,
  },
  {
    id: 'metro',
    tone: 'red',
    eyebrow: 'Coming soon',
    title: 'Metro',
    subtitle: 'Prototype preview',
    href: '/metro',
    art: ASSET_URLS.ui.hubCards.metro,
  },
];

export function shortAddress(address: string): string {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}
