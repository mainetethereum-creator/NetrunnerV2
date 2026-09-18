import { ASSET_URLS } from './registry.ts';

/** Metres, ground-centred, facade +Z. Bounds include signs, ducts and stairs. */
export const REFERENCE_BUILDINGS = [
  {
    id: 'building-reference-armory',
    name: 'Оружейный · ARMORY V1',
    category: 'Здания',
    description: 'Blender · бетонный оружейный по концепту V1 · витрина, бронедверь, жалюзи',
    url: ASSET_URLS.referenceBuildings.armory,
  },
  {
    id: 'building-reference-restaurant',
    name: 'Китайский ресторан · V1',
    category: 'Здания',
    description: 'Blender · ресторан по концепту V1 · фонари, кухня, балкон и вытяжка',
    url: ASSET_URLS.referenceBuildings.restaurant,
  },
  {
    id: 'building-reference-administration',
    name: 'Главное управление · V1',
    category: 'Здания',
    description: 'Управление по концепту V1 · 13,3 × 8 м · высота 13,2 м · компактная версия для Базы',
    url: ASSET_URLS.referenceBuildings.administration,
  },
  {
    id: 'building-media-tower',
    name: 'Медиа-башня · стекло и портрет',
    category: 'Здания',
    description: 'Стеклянная башня · оригинальный портрет из концепта · 11,2 × 10 м · высота 34,7 м',
    url: ASSET_URLS.referenceBuildings.mediaTower,
  },
  {
    id: 'building-glass-corner',
    name: 'Угловой коммерческий корпус · стекло и реклама',
    category: 'Здания',
    description: 'Второй концепт · красный медиафасад, голограмма энергоячейки и кабели · 14,9 × 11,4 м · высота 21,1 м',
    url: ASSET_URLS.referenceBuildings.glassCorner,
  },
  {
    id: 'building-japanese-cafe',
    name: 'Японское кафе · 食堂 / ラーメン',
    category: 'Здания',
    description: 'Компактное кафе по концепту · тёплая кухня, фонари, стойка и балкон · 7,7 × 6,4 м · высота 7,9 м',
    url: ASSET_URLS.referenceBuildings.japaneseCafe,
  },
  {
    id: 'building-wallet-tower',
    name: 'Башня Coinbase wallet · стекло и голограмма',
    category: 'Здания',
    description: 'Узкая башня по концепту · логотип и замкнутая светящаяся лента · 8,2 × 7,6 м · высота 32,7 м · реклама пока статичная',
    url: ASSET_URLS.referenceBuildings.walletTower,
  },
  {
    id: 'building-cyberbase-tower',
    name: 'Башня CYBERBASE · вертикальная реклама',
    category: 'Здания',
    description: 'Стеклянная башня · 8,5 × 8,5 м · высота 28 м · вертикальная вывеска пока статичная',
    url: ASSET_URLS.referenceBuildings.cyberbaseTower,
  },
  {
    id: 'building-japanese-parts-shop',
    name: 'Японский магазин запчастей · 部品 / PARTS',
    category: 'Здания',
    description: 'Тёплые витрины и фиолетовый неон · 10,2 × 8,6 м · высота 10,7 м',
    url: ASSET_URLS.referenceBuildings.japanesePartsShop,
  },
  {
    id: 'building-urban-office',
    name: 'Современный городской корпус · стекло и бетон',
    category: 'Здания',
    description: 'Угловое остекление и тонкая подсветка · 11,3 × 10,1 м · высота 11 м с оборудованием крыши',
    url: ASSET_URLS.referenceBuildings.urbanOffice,
  },
] as const;

export type ReferenceBuildingId = typeof REFERENCE_BUILDINGS[number]['id'];

export function isReferenceBuilding(id: string): id is ReferenceBuildingId {
  return REFERENCE_BUILDINGS.some(asset => asset.id === id);
}
