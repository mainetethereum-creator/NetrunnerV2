/** Metres / seconds. Visual traffic stays outside the refuge's walkable pad. */
export const CITY_STREET = {
  halfLength: 130,
  roadNorth: 16.4,
  roadSouth: 26.4,
  roadY: -.06,
  lanes: [
    { z: 18.85, direction: 1, speed: 7.5 },
    { z: 23.95, direction: -1, speed: 9 },
  ],
} as const;

export type TrafficVehicle = {
  lane: number;
  offset: number;
  kind: 'sedan' | 'taxi' | 'bus';
  color: number;
};

export const TRAFFIC_PERIOD = CITY_STREET.halfLength * 2 / 1.5;
const palette = [0x7f9aab, 0xced3ce, 0x773731, 0x263a43, 0x8d9387, 0x335851];

export function trafficVehicles(mobile: boolean): TrafficVehicle[] {
  const count = mobile ? 8 : 12;
  return CITY_STREET.lanes.flatMap((_, lane) => Array.from({ length: count }, (_, index) => ({
    lane,
    offset: (index + .35 + lane * .4) * CITY_STREET.halfLength * 2 / count,
    kind: index === Math.floor(count / 2) ? 'bus' : index % 4 === 1 ? 'taxi' : 'sedan',
    color: palette[(index + lane * 2) % palette.length],
  })));
}

/** All vehicles in a lane share a speed, preserving headway through the wrap. */
export function trafficPose(vehicle: TrafficVehicle, elapsed: number) {
  const lane = CITY_STREET.lanes[vehicle.lane];
  const time = Number.isFinite(elapsed) ? elapsed : 0;
  const length = CITY_STREET.halfLength * 2;
  const distance = vehicle.offset + lane.direction * lane.speed * time;
  return {
    x: ((distance % length) + length) % length - CITY_STREET.halfLength,
    y: CITY_STREET.roadY,
    z: lane.z,
    yaw: lane.direction === 1 ? 0 : Math.PI,
  };
}
