// Hub data: navigation and feature cards. Readable text lives here. Card titles and
// "coming soon" badges are owner artwork; their text is kept here as accessible labels.
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

// The hub has one way into the game: PLAY → /base. Expedition and metro are reached
// from the base (ADR-015), so no card links into the game.
export type HubCardId = 'season' | 'skynet' | 'nft';

export interface HubCardArt {
  src: string;
  /** width / height of the image, so the element keeps the artwork's shape. */
  ratio: number;
}

export interface HubCard {
  id: HubCardId;
  tone: 'blue' | 'red' | 'violet';
  /** Text shown in the title artwork (its accessible label). */
  title: string;
  subtitle: string;
  tagline: readonly string[];
  /** Small decorative lines at the top right and bottom right. */
  aside: readonly string[];
  footnote: readonly string[];
  status: string;
  href?: string;
  art: string;
  titleArt: HubCardArt;
  statusArt: HubCardArt;
}

export const HUB_CARDS: readonly HubCard[] = [
  {
    id: 'season',
    tone: 'blue',
    title: 'Season 1',
    subtitle: 'The Awakening',
    tagline: ['Some things', 'were never meant', 'to stay asleep.'],
    aside: ['A higher', 'tomorrow', 'anyway'],
    footnote: ['55.7558° N', '37.6173° E'],
    status: 'Coming soon',
    art: ASSET_URLS.ui.hubCards.season,
    titleArt: {src: ASSET_URLS.ui.hubCardTitles.season, ratio: 970 / 392},
    statusArt: {src: ASSET_URLS.ui.hubCardBadges.season, ratio: 1107 / 264},
  },
  {
    id: 'skynet',
    tone: 'red',
    title: 'SkyNet',
    subtitle: 'The machines take over.',
    tagline: ['No signals.', 'No mercy.', 'A different tomorrow.'],
    aside: ['Humanity', 'was a phase'],
    footnote: ['47.2861° N', '9.5228° E'],
    status: 'Coming soon',
    art: ASSET_URLS.ui.hubCards.skynet,
    titleArt: {src: ASSET_URLS.ui.hubCardTitles.skynet, ratio: 986 / 354},
    statusArt: {src: ASSET_URLS.ui.hubCardBadges.skynet, ratio: 1120 / 254},
  },
  {
    id: 'nft',
    tone: 'violet',
    title: 'NFT Collection',
    subtitle: 'CyberBase Genesis',
    tagline: ['People.', 'Places.', 'A brighter tomorrow.', 'Onchain.'],
    aside: ['Own', 'Belong', 'Build', 'Beyond'],
    footnote: ['CyberBase', 'MMXXV'],
    status: 'Coming soon',
    art: ASSET_URLS.ui.hubCards.nft,
    titleArt: {src: ASSET_URLS.ui.hubCardTitles.nft, ratio: 987 / 281},
    statusArt: {src: ASSET_URLS.ui.hubCardBadges.nft, ratio: 1115 / 258},
  },
];

export function shortAddress(address: string): string {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}
