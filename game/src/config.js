// Mirage City — Desert Heat Run: all tuning numbers, story data and mission
// definitions live here so the rest of the game reads like a spec sheet.
export const SAVE_KEY = 'mirage-city-save-v1';
export const AUTOSAVE_SECONDS = 10;

export const CITY = {
  halfSize: 170,      // drivable/walkable city extent (desert beyond)
  block: 44,          // block pitch; roads run between blocks
  roadWidth: 12,
  maxSpeed: 40,       // player car top speed (m/s)
  trafficSpeed: 11,
  copSpeed: 42,
  walkSpeed: 6.5,
  runSpeed: 10,
};

export const PALETTE = {
  duskSkyTop: 0x2b1a4d,
  duskSkyBottom: 0xff8a3d,
  fog: 0xd98a5a,
  sand: 0xd9a066,
  road: 0x3d3947,
  sidewalk: 0x9a8a78,
  buildingGlass: 0x2a2f4a,
};

// The delivery-chain story: Jax Moreno, a courier driver in Solara, a desert
// casino city at dusk, takes jobs from dispatcher Rosa Delgado and ends up
// pulling the Solara Grand heist.
export const MISSIONS = [
  {
    id: 'M1', title: 'First Fare', reward: 150,
    briefing: 'Rosa: "Jax, first job. Pick up the parcel at the depot and run it to the Solara Grand. Don\'t scratch the paint."',
    steps: [
      { type: 'goto', label: 'Pick up the parcel at the depot', x: -88, z: -88 },
      { type: 'goto', label: 'Deliver the parcel to the Solara Grand', x: 22, z: -22 },
    ],
  },
  {
    id: 'M2', title: 'Two Stops, One Sunset', reward: 300,
    briefing: 'Rosa: "Two drops tonight. Motel first, then the gas station. The clients pay double if you\'re quick."',
    steps: [
      { type: 'goto', label: 'Collect the crate at the market', x: -44, z: 44 },
      { type: 'goto', label: 'Drop it at the Desert Rose Motel', x: 88, z: 44 },
      { type: 'goto', label: 'Final drop at the gas station', x: 88, z: -88 },
    ],
  },
  {
    id: 'M3', title: 'Dust Devil Run', reward: 500, timeLimit: 100,
    briefing: 'Rosa: "A dust storm is rolling in and the Oasis Diner needs its shipment in 100 seconds. Floor it, Jax."',
    steps: [
      { type: 'goto', label: 'Grab the shipment at the warehouse', x: -132, z: 0 },
      { type: 'goto', label: 'Race the storm to the Oasis Diner', x: 132, z: 88 },
    ],
  },
  {
    id: 'M4', title: 'Sandpit Showdown', reward: 800,
    briefing: 'Rosa: "The Dust Vipers jumped our last courier. They\'re waiting at the junkyard. Take your pistol and settle it."',
    steps: [
      { type: 'goto', label: 'Reach the junkyard', x: -44, z: 132 },
      { type: 'kill', label: 'Deal with the Dust Vipers (0/4)', x: -44, z: 132, count: 4 },
    ],
  },
  {
    id: 'M5', title: 'The High Roller', reward: 1200, timeLimit: 85,
    briefing: 'Rosa: "A whale just landed at the airstrip hotel. Drive him to the Solara Grand in 85 seconds and he tips big."',
    steps: [
      { type: 'goto', label: 'Pick up the VIP at the airstrip hotel', x: -132, z: -44 },
      { type: 'goto', label: 'Drive the VIP to the Solara Grand', x: 22, z: -22 },
    ],
  },
  {
    id: 'M6', title: 'The Solara Heist', reward: 3000,
    briefing: 'Rosa: "Last job, Jax. The Grand\'s vault. Five guards between you and the take — then lose the cops and get to the safehouse."',
    steps: [
      { type: 'goto', label: 'Reach the Solara Grand vault', x: 22, z: -22 },
      { type: 'kill', label: 'Clear the vault guards (0/5)', x: 22, z: -22, count: 5 },
      { type: 'hold', label: 'Crack the vault — hold position', x: 22, z: -22, holdSeconds: 4 },
      { type: 'escape', label: 'Escape the police — reach the safehouse', x: -132, z: 132, wanted: 3 },
    ],
  },
];

export const SIDE_JOBS = {
  taxi: { label: 'Taxi fare', rewardMin: 40, rewardMax: 90 },
  courier: { label: 'Courier run', rewardMin: 60, rewardMax: 110 },
};

export const WANTED_DECAY_SECONDS = 25; // no crime + no cop in sight: lose a star
export const COP_COUNT_BY_STARS = [0, 1, 2, 3, 4, 5];
export const STAR_NAMES = ['Clean', 'One star', 'Two stars', 'Three stars', 'Four stars', 'FIVE STARS'];
