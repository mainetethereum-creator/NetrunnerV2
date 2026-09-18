/** One shared buildable rectangle for rendering, navigation and the minimap. */
export const FLOOR_WEST = -32;
export const FLOOR_EAST = 32;
export const FLOOR_NORTH = -42;
export const FLOOR_SOUTH = 12;
export const FLOOR_WIDTH = FLOOR_EAST - FLOOR_WEST;
export const FLOOR_DEPTH = FLOOR_SOUTH - FLOOR_NORTH;
export const FLOOR_CENTER_X = (FLOOR_WEST + FLOOR_EAST) / 2;
export const FLOOR_CENTER_Z = (FLOOR_NORTH + FLOOR_SOUTH) / 2;

/** Keep the player slightly inside the visible platform edges. */
export const LIMIT = { x: FLOOR_EAST - .55, z: FLOOR_SOUTH - .55 };
export const BASE_NORTH = FLOOR_NORTH + .55;
export const BACKGROUND_NORTH = FLOOR_NORTH - 7;
