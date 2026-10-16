// Story cutscenes shown after every stage. Pure data (unit-tested): short, punchy, tap to advance.
// Panel: { bg, cam, zoom:[a,b], pan:[x0,x1], actors:[{who,x0,x1,y,face,walk,sil}], fx, map:legIndex, cap:[line1,line2] }.
// who: 'h' = Harambe, 'kid', or an enemy sheet name. Coordinates are on the 320x180 logic grid.
export const MAP_NODES = [
  { name: 'ZOO', x: 36, y: 40 }, { name: 'CITY', x: 92, y: 62 }, { name: 'FBI', x: 150, y: 90 },
  { name: 'ARMY', x: 214, y: 104 }, { name: 'JUNGLE', x: 276, y: 130 },
];
export const MAX_CAP = 50; // characters per caption line (the 320px screen fits ~52 at 6px)

export const CUTSCENES = [
  { title: 'DOWNTOWN', music: { root: 50, tempo: 84, mode: 'minor' }, panels: [
    { bg: 'zoo', cam: 900, zoom: [1, 1.12], pan: [0, -6], fx: 'siren', actors: [{ who: 'h', x0: 90, x1: 210, y: 150, face: 1, walk: true }, { who: 'keeper_net', x0: 40, x1: 30, y: 154, face: 1, sil: true }],
      cap: ['THE HEAD ZOOKEEPER IS DOWN. THE GATE IS OPEN.', 'HARAMBE LOOKS BACK ONE LAST TIME.'] },
    { map: 0, cap: ['THE ONLY WAY OUT IS DOWNTOWN CINCINNATI.', 'THE JUNGLE IS SOUTH. VERY, VERY SOUTH.'] },
    { bg: 'street', cam: 700, zoom: [1.14, 1], pan: [-6, 0], fx: 'siren', actors: [{ who: 'h', x0: 70, x1: 120, y: 156, face: 1, walk: true }, { who: 'cop_baton', x0: 300, x1: 250, y: 152, face: -1, sil: true }, { who: 'cop_shield', x0: 330, x1: 285, y: 164, face: -1, sil: true }],
      say: { x: 100, y: 86, txt: '"just passing through."' }, cap: ['THE ZOO CALLED THE COPS. THE COPS CALLED COPS.', 'NOBODY CALLED THE HAY GUY.'] },
  ] },
  { title: 'THE RIVER', music: { root: 48, tempo: 80, mode: 'dorian' }, panels: [
    { bg: 'street', cam: 1400, zoom: [1, 1.1], pan: [0, 4], actors: [{ who: 'h', x0: 80, x1: 140, y: 154, face: 1, walk: true }, { who: 'boss_captain', x0: 270, x1: 270, y: 150, face: -1, sil: true }],
      cap: ['THE POLICE CAPTAIN HAS LEFT THE BUILDING.', 'THROUGH A WINDOW. HARAMBE FEELS BAD. A LITTLE.'] },
    { map: 1, cap: ['THE BRIDGE OVER THE OHIO RIVER IS THE ONLY', 'WAY SOUTH. THE FBI KNOWS IT, TOO.'] },
    { bg: 'office', cam: 500, zoom: [1.12, 1], pan: [0, 0], actors: [{ who: 'h', x0: 60, x1: 100, y: 156, face: 1, walk: true }, { who: 'agent_kick', x0: 290, x1: 262, y: 150, face: -1, sil: true }, { who: 'agent_case', x0: 320, x1: 290, y: 162, face: -1, sil: true }],
      say: { x: 250, y: 84, txt: '"we have eyes on the gorilla."' }, cap: ['A BLACK VAN. THEN TEN. HE HAS EYES ON THE BRIDGE.', 'HE REMEMBERS RAIN ON BIG LEAVES. HE IS GOING HOME.'] },
  ] },
  { title: 'THE BORDER', music: { root: 46, tempo: 78, mode: 'minor' }, panels: [
    { bg: 'office', cam: 1500, zoom: [1, 1.12], pan: [0, -5], actors: [{ who: 'h', x0: 90, x1: 170, y: 154, face: 1, walk: true }, { who: 'boss_agent', x0: 250, x1: 250, y: 152, face: -1, sil: true }],
      cap: ['THE SPECIAL AGENT\'S EARPIECE FALLS OUT.', 'SO DOES HIS CONFIDENCE.'] },
    { map: 2, cap: ['SOUTH OF THE RIVER, THE ARMY HAS SEALED THE', 'BORDER ROAD. THE ONE ROAD TO THE COAST.'] },
    { bg: 'base', cam: 400, zoom: [1.12, 1], pan: [-5, 0], fx: 'search', actors: [{ who: 'h', x0: 60, x1: 110, y: 156, face: 1, walk: true }, { who: 'soldier_shield', x0: 300, x1: 270, y: 152, face: -1, sil: true }, { who: 'soldier_net', x0: 330, x1: 300, y: 164, face: -1, sil: true }],
      say: { x: 245, y: 84, txt: '"please stop, sir."' }, cap: ['TANKS. SEARCHLIGHTS. "PLEASE STOP, SIR."', 'HARAMBE PLANS TO NOT.'] },
  ] },
  { title: 'THE TREELINE', music: { root: 45, tempo: 76, mode: 'dorian' }, panels: [
    { bg: 'base', cam: 1500, zoom: [1, 1.1], pan: [0, 4], actors: [{ who: 'h', x0: 90, x1: 160, y: 154, face: 1, walk: true }, { who: 'boss_general', x0: 260, x1: 260, y: 150, face: -1, sil: true }],
      cap: ['THE GENERAL\'S TANK IS PARKED SIDEWAYS IN A DITCH.', 'THE FENCE IS DOWN. BEYOND IT: GREEN.'] },
    { map: 3, cap: ['HE CAN SMELL IT. WET LEAVES, WARM RAIN, HOME.', 'ONE LAST STRETCH OF ROAD.'] },
    { bg: 'jungle', cam: 800, zoom: [1.12, 1], pan: [-4, 0], actors: [{ who: 'h', x0: 70, x1: 120, y: 156, face: 1, walk: true }, { who: 'boss_baron', x0: 270, x1: 270, y: 150, face: -1, sil: true }],
      cap: ['BUT SOMEONE OWNS THE TREELINE. THE BARON.', 'HE COLLECTS RARE ANIMALS. HE HEARD ONE IS COMING.'] },
    { bg: 'jungle', cam: 1600, zoom: [1, 1.15], pan: [0, 0], actors: [{ who: 'h', x0: 110, x1: 110, y: 156, face: 1, walk: false }],
      say: { x: 110, y: 78, txt: '"i\'ll be fine."' }, cap: ['"I\'LL BE FINE," SAYS HARAMBE. (HE IS NOT SURE.)', 'HE CRACKS HIS KNUCKLES.'] },
  ] },
  { title: 'HOME', music: { root: 52, tempo: 70, mode: 'dorian' }, panels: [
    { bg: 'jungle', cam: 2200, zoom: [1, 1.1], pan: [0, 3], actors: [{ who: 'h', x0: 120, x1: 130, y: 156, face: 1, walk: false }],
      cap: ['THE BARON\'S CAGES ARE OPEN.', 'EVERY ANIMAL HE COLLECTED WALKS FREE.'] },
    { bg: 'jungle', cam: 400, zoom: [1.1, 1], pan: [0, 0], fx: 'leaves', actors: [{ who: 'h', x0: 100, x1: 150, y: 156, face: 1, walk: true }],
      cap: ['THEN THE CANOPY RUSTLES. A FAMILY STEPS OUT.', 'THEY HAVE BEEN WAITING A LONG TIME.'] },
    { map: 4, cap: ['HE CAME FOR THE QUIET. HE FOUND THE FAMILY.', 'TURNS OUT YOU CAN GO HOME AGAIN.'] },
    { bg: 'zoo', cam: 100, zoom: [1, 1.1], pan: [0, 0], actors: [{ who: 'kid', x0: 160, x1: 160, y: 154, face: 1, walk: false }],
      say: { x: 160, y: 86, txt: '"he\'s just on vacation."' }, cap: ['BACK IN CINCINNATI, A KID LEAVES A BANANA.', '"HE\'LL BE BACK," HE SAYS. THE KID IS FINE.'] },
  ] },
];

/** Typewriter: how many characters are visible `t` seconds into a panel. */
export const typedChars = (t, total, cps = 48) => Math.min(total, Math.floor(Math.max(0, t) * cps));
/** Pure state machine for advancing: 'adv' finishes the typing first, then moves to the next panel; 'skip' ends the cutscene. */
export function csAdvance(s, action, panels, capLen) {
  if (action === 'skip') return { ...s, done: true };
  if (typedChars(s.t, capLen) < capLen) return { ...s, t: capLen / 48 + 0.001 };
  if (s.panel + 1 >= panels) return { ...s, done: true };
  return { ...s, panel: s.panel + 1, t: 0 };
}
