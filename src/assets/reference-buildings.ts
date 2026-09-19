import { ASSET_URLS } from './registry.ts';

/** Metres, ground-centred, facade +Z. Bounds include signs, ducts and stairs. */
export const REFERENCE_BUILDINGS = [
  {
    id: 'building-corner-chamfer', name: 'Угловой дом · бетон и скошенный вход',
    category: 'Здания', description: 'Кафе и мастерская · два уличных фасада · 9,9 × 8,8 × 11,6 м',
    url: ASSET_URLS.referenceBuildings.cornerChamfer,
  },
  {
    id: 'building-corner-rounded', name: 'Угловой дом · кирпич и округлый фасад',
    category: 'Здания', description: 'Магазин, округлый угол и наружная лестница · 10,9 × 8,8 × 11,6 м',
    url: ASSET_URLS.referenceBuildings.cornerRounded,
  },
  {
    id: 'building-slender-glass', name: 'Узкая башня · синее стекло',
    category: 'Здания', description: 'Современная башня · вертикальный неон · 6,7 × 9,2 × 36,9 м',
    url: ASSET_URLS.referenceBuildings.slenderGlass,
  },
  {
    id: 'building-slender-terrace', name: 'Узкая башня · светлый бетон и террасы',
    category: 'Здания', description: 'Ступенчатая крыша, лоджии и техническая сторона · 6,7 × 9,3 × 34,3 м',
    url: ASSET_URLS.referenceBuildings.slenderTerrace,
  },
  {
    id: 'outskirts-wreck', name: 'Окраина · ржавый автомобиль',
    category: 'Детали', description: 'Разукомплектованный седан · 2,1 × 4,5 м',
    url: ASSET_URLS.referenceBuildings.outskirtsWreck,
  },
  {
    id: 'outskirts-barrier', name: 'Окраина · разбитый дорожный блок',
    category: 'Ограждения', description: 'Низкий бетонный барьер с арматурой · 3,1 × 0,8 м',
    url: ASSET_URLS.referenceBuildings.outskirtsBarrier,
  },
  {
    id: 'outskirts-ground', name: 'Окраина · грунт и разрушенный асфальт',
    category: 'Поверхности', description: 'Редактируемый участок 64 × 26 м · лужи, щебень и сорняки',
    url: ASSET_URLS.referenceBuildings.outskirtsGround, collision: false,
  },
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

/** Ground dressing never becomes a solid rectangle when placed or transformed. */
export function referenceHasCollision(id: string): boolean {
  const asset = REFERENCE_BUILDINGS.find(item => item.id === id);
  return !(asset && 'collision' in asset && asset.collision === false);
}
