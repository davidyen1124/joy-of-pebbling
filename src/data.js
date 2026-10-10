// Everything the show can choose from. Drawing lives in pebble.js; what Cobb says lives in script.js.

// The paints on the palette. `id` matches the blobs in the model; `tv` is what the yellow caption says.
export const PAINTS = {
  white: { name: 'Titanium White', tv: 'TITANIUM WHITE', hex: '#f5f2e8' },
  yellow: { name: 'Cadmium Yellow', tv: 'CADMIUM YELLOW', hex: '#ffd21f' },
  ochre: { name: 'Yellow Ochre', tv: 'YELLOW OCHRE', hex: '#c9952c' },
  indian: { name: 'Indian Yellow', tv: 'INDIAN YELLOW', hex: '#e8a317' },
  red: { name: 'Bright Red', tv: 'BRIGHT RED', hex: '#d9281e' },
  crimson: { name: 'Alizarin Crimson', tv: 'ALIZARIN CRIMSON', hex: '#8e1b2c' },
  sap: { name: 'Sap Green', tv: 'SAP GREEN', hex: '#3f6b24' },
  pgreen: { name: 'Phthalo Green', tv: 'PHTHALO GREEN', hex: '#0f4b3e' },
  pblue: { name: 'Phthalo Blue', tv: 'PHTHALO BLUE', hex: '#123c8c' },
  prussian: { name: 'Prussian Blue', tv: 'PRUSSIAN BLUE', hex: '#0e2244' },
  sienna: { name: 'Dark Sienna', tv: 'DARK SIENNA', hex: '#5a2d1a' },
  vandyke: { name: 'Van Dyke Brown', tv: 'VAN DYKE BROWN', hex: '#33211a' },
  black: { name: 'Midnight Black', tv: 'MIDNIGHT BLACK', hex: '#0b0b0e' },
}

// What a Pebble can be made of. `paint` is the tube Cobb reaches for; `say` is how he names it.
export const COLORS = [
  { id: 'pblue', label: 'blue', say: 'Phthalo Blue', paint: 'pblue', base: '#4f8fd6', dark: '#3b72b8', light: '#7db1ea', feet: '#33487c' },
  { id: 'sap', label: 'green', say: 'Sap Green', paint: 'sap', base: '#6f9d3c', dark: '#547d29', light: '#93bb5c', feet: '#394a1f' },
  { id: 'teal', label: 'teal', say: 'Phthalo Green, with a little white', paint: 'pgreen', base: '#1fa696', dark: '#168273', light: '#57c7b7', feet: '#1c4d58' },
  { id: 'crimson', label: 'crimson', say: 'Alizarin Crimson', paint: 'crimson', base: '#c4435c', dark: '#9c2f47', light: '#dd7187', feet: '#5c1e32' },
  { id: 'red', label: 'red', say: 'Bright Red', paint: 'red', base: '#e35a43', dark: '#bd402d', light: '#f3856f', feet: '#7a2a22' },
  { id: 'yellow', label: 'yellow', say: 'Cadmium Yellow', paint: 'yellow', base: '#f1c740', dark: '#d0a228', light: '#f9df7c', feet: '#8c5b1c' },
  { id: 'ochre', label: 'ochre', say: 'Yellow Ochre', paint: 'ochre', base: '#a8922e', dark: '#8a7622', light: '#c3ae4c', feet: '#74402f' },
  { id: 'indian', label: 'orange', say: 'Indian Yellow', paint: 'indian', base: '#e79c30', dark: '#c27c1e', light: '#f4ba62', feet: '#7e3f1e' },
  { id: 'sienna', label: 'sienna', say: 'Dark Sienna', paint: 'sienna', base: '#b97b40', dark: '#9c6530', light: '#d29a5e', feet: '#74404a' },
  { id: 'vandyke', label: 'brown', say: 'Van Dyke Brown', paint: 'vandyke', base: '#7c5438', dark: '#5f3e28', light: '#9a6d4e', feet: '#392318' },
  { id: 'prussian', label: 'navy', say: 'Prussian Blue', paint: 'prussian', base: '#3d5390', dark: '#2b3c6e', light: '#5b72ae', feet: '#1b2646' },
  { id: 'white', label: 'white', say: 'Titanium White', paint: 'white', base: '#e9e4d8', dark: '#c6bfae', light: '#fbf8f0', feet: '#8d8576' },
  { id: 'black', label: 'charcoal', say: 'Midnight Black', paint: 'black', base: '#454853', dark: '#2f3039', light: '#62667a', feet: '#17181d', paleEyes: true },
  { id: 'pink', label: 'pink', say: 'a little Crimson and a lot of white', paint: 'crimson', base: '#ee9db6', dark: '#d37a97', light: '#f8c1d1', feet: '#8c3f5c' },
  { id: 'lavender', label: 'lavender', say: 'Crimson, Blue, and a lot of white', paint: 'pblue', base: '#a792da', dark: '#866fbb', light: '#c4b4ea', feet: '#48387a' },
]

// What kind of Pebble. wr = width over height, hs = height against a classic one, n = how square,
// tt/tb = how much the top and bottom narrow.
export const KINDS = [
  { id: 'classic', label: 'classic pebble', a: 'a classic pebble', wr: 0.74, hs: 1.0, n: 2.45, tt: 0.14, tb: 0.03 },
  { id: 'boulder', label: 'small boulder', a: 'a boulder. A small one', wr: 1.02, hs: 0.84, n: 2.25, tt: 0.09, tb: 0.06 },
  { id: 'tall', label: 'tall drink of gravel', a: 'a tall one', wr: 0.55, hs: 1.14, n: 2.7, tt: 0.1, tb: 0.02 },
  { id: 'river', label: 'river rock', a: 'a river rock', wr: 1.4, hs: 0.64, n: 2.5, tt: 0.1, tb: 0.04 },
  { id: 'egg', label: 'egg-shaped pebble', a: 'an egg-shaped fellow', wr: 0.8, hs: 0.98, n: 2.1, tt: 0.34, tb: 0.0 },
  { id: 'bean', label: 'bean', a: 'a bean', wr: 0.7, hs: 1.02, n: 2.4, tt: 0.1, tb: 0.04, lean: 0.085 },
  { id: 'potato', label: 'lumpy pebble', a: 'a lumpy one. They are all beautiful', wr: 0.9, hs: 0.9, n: 2.3, tt: 0.08, tb: 0.05, lumps: 1 },
  { id: 'skipper', label: 'skipping stone', a: 'a skipping stone', wr: 1.85, hs: 0.48, n: 2.6, tt: 0.06, tb: 0.06 },
]

export const HAIR_COLORS = [
  { id: 'black', label: 'black', c: '#201c1f', hi: '#4a4248', paint: 'black' },
  { id: 'brown', label: 'brown', c: '#4d2e19', hi: '#84542f', paint: 'vandyke' },
  { id: 'auburn', label: 'auburn', c: '#8c3c1c', hi: '#c26a36', paint: 'sienna' },
  { id: 'blonde', label: 'blonde', c: '#e0b548', hi: '#f6e09a', paint: 'ochre' },
  { id: 'gray', label: 'silver', c: '#9a9aa2', hi: '#d0d0d6', paint: 'white' },
  { id: 'white', label: 'white', c: '#ecece6', hi: '#ffffff', paint: 'white' },
  { id: 'pink', label: 'hot pink', c: '#ff5fa2', hi: '#ffa3ca', paint: 'crimson' },
  { id: 'teal', label: 'teal', c: '#17b3a1', hi: '#7be3d5', paint: 'pgreen' },
  { id: 'purple', label: 'purple', c: '#7748cf', hi: '#ad90ea', paint: 'pblue' },
  { id: 'green', label: 'lime green', c: '#5dbb39', hi: '#a2e384', paint: 'sap' },
  { id: 'orange', label: 'orange', c: '#ef781b', hi: '#f9ae66', paint: 'indian' },
]

// label reads after "a" / "an"; `say` is Cobb's line as he paints it.
export const HAIRS = [
  { id: 'afro', label: 'afro', say: ['Let’s give him an afro. I’m not biased.', 'An afro. You just tap. Tap, tap, tap. It’s the only way I know.'] },
  { id: 'mohawk', label: 'mohawk', say: ['A mohawk. He went through something, and he came out the other side.', 'Straight up. A mohawk. His mother isn’t watching.'] },
  { id: 'mullet', label: 'mullet', say: ['Now here’s your bravery test. A mullet. Once you commit, you commit.', 'Short on top. Then just let it go at the back. Let it be free.'] },
  { id: 'pompadour', label: 'pompadour', say: ['A big pompadour. Just swoop it. Thank you very much.', 'Load the brush full and swoop. That’s a pompadour. That’s confidence.'] },
  { id: 'bowl', label: 'bowl cut', say: ['A bowl cut. Somebody loved him enough to do this at home.', 'Straight across. A bowl cut. We don’t judge in this world.'] },
  { id: 'pigtails', mass: true, label: 'pigtails', say: ['Two little pigtails. One for each side. That’s how pigtails work.', 'Pigtails. They’re just happy little clouds that live on your head.'] },
  { id: 'bun', label: 'top knot', say: ['A little top knot. He’s been doing yoga.', 'Just one round dab, right on top. A bun. Very tidy.'] },
  { id: 'long', mass: true, label: 'long flowing hair', say: ['Long, flowing hair. Pull it straight down and let gravity help. Gravity’s your friend.', 'Just let it fall. Long hair. He’s in a band, but only on weekends.'] },
  { id: 'curly', label: 'perm', say: ['A perm. Little round curls, all the way round. Each one’s a friend.', 'Tight little curls. He sat under the dryer for an hour. Worth it.'] },
  { id: 'spiky', mass: true, label: 'spiky hair', say: ['Spiky. Flick the brush outward. He’s the main character now.', 'Flick, flick, flick. Spikes. Careful, he’s pointy.'] },
  { id: 'combover', label: 'comb-over', say: ['Three hairs. Right across the top. He’s doing his best, and that’s all any of us can do.', 'A comb-over. Just three strokes. Each one is doing a lot of work.'] },
  { id: 'bald', label: 'no hair at all', say: ['And for his hair... nothing. He’s bald. And that’s okay. I’ll just add a little shine.', 'No hair today. A pebble is smooth. That’s what the river wanted.'] },
  { id: 'beehive', label: 'beehive', say: ['A beehive. Just keep going up. I’ll tell you when to stop. ...Keep going.', 'Up, and up, and up. A beehive. There are no bees. I checked.'] },
  { id: 'dreads', mass: true, label: 'dreadlocks', say: ['Dreadlocks. Pull each one down, nice and slow. Give every one a little bead.', 'Long locks, one at a time. Don’t rush them. They took years.'] },
  { id: 'ponytail', label: 'ponytail', say: ['A ponytail. Just flick it out the back. There it goes.', 'One quick stroke out the side. A ponytail. It bounces when he walks.'] },
  { id: 'sidepart', label: 'side part', say: ['A neat side part. He reads the evening news, on channel four.', 'Part it on the side. Very sensible. This pebble has a mortgage.'] },
  { id: 'flattop', label: 'flat-top', say: ['A flat-top. You could land a little plane on that.', 'Use the knife for this one. Flat across the top. Very level.'] },
]

// `a` reads after "a happy little"; `prop` after "he needs"
export const JOBS = [
  { id: 'firefighter', label: 'firefighter', prop: 'an axe', poseR: 'hold', poseL: 'hip',
    say: ['He’s a firefighter. He has never seen a fire. He’s a rock. But he’s ready.', 'A firefighter. The bravest pebble on the whole beach.'] },
  { id: 'chef', label: 'chef', prop: 'a pan, with one egg', poseR: 'hold', poseL: 'down',
    say: ['He’s a chef. He only makes one dish, and it’s stone soup.', 'A chef. A tall white hat, so everybody knows who’s in charge of the soup.'] },
  { id: 'doctor', label: 'doctor', prop: 'a clipboard', poseR: 'hip', poseL: 'hold',
    say: ['A doctor. He listens to your heart. He doesn’t have one, but he listens.', 'He’s a doctor. Kidney stones are family, so he’s very gentle with them.'] },
  { id: 'astronaut', label: 'astronaut', prop: 'a flag', poseR: 'hold', poseL: 'up',
    say: ['An astronaut. Every moon rock was a pebble with a dream.', 'He’s an astronaut. Up there, they call him a meteoroid. Down here he’s just Dave.'] },
  { id: 'lumberjack', label: 'lumberjack', prop: 'an axe', poseR: 'hold', poseL: 'hip',
    say: ['A lumberjack. Don’t worry, he only chops the trees I haven’t painted yet.', 'He’s a lumberjack. Flannel. That’s just Bright Red with lines on it.'] },
  { id: 'detective', label: 'detective', prop: 'a magnifying glass', poseR: 'hold', poseL: 'hip',
    say: ['A detective. He leaves no stone unturned. It’s awkward at family reunions.', 'He’s a detective. He already knows who did it. It was erosion.'] },
  { id: 'builder', label: 'builder', prop: 'a hammer', poseR: 'hold', poseL: 'down',
    say: ['A builder. A hard hat, for a rock. Safety first.', 'He’s in construction. He’s also the construction material. It’s a conflict of interest.'] },
  { id: 'pirate', label: 'pirate', prop: 'a cutlass', poseR: 'up', poseL: 'hip',
    say: ['A pirate. He sank straight away, but he had a wonderful time.', 'He’s a pirate. Arr. That’s the only word he knows, and he’s a pebble, so he doesn’t say it.'] },
  { id: 'wizard', label: 'wizard', prop: 'a wand', poseR: 'up', poseL: 'out',
    say: ['A wizard. He turned himself into a pebble, and he can’t remember the spell to turn back.', 'He’s a wizard. A big pointy hat. That’s where he keeps the magic.'] },
  { id: 'cowboy', label: 'cowboy', prop: 'a lasso', poseR: 'up', poseL: 'hip',
    say: ['A cowboy. This rock is not big enough for the both of us, he says. It is.', 'He’s a cowboy. He doesn’t ride. He rolls.'] },
  { id: 'rockstar', label: 'rock star', prop: 'a guitar', poseR: 'front', poseL: 'hold',
    say: ['A rock star. I didn’t write that joke. It was just lying there on the ground.', 'He’s a rock star. He plays rock. I don’t know what you expected.'] },
  { id: 'scientist', label: 'scientist', prop: 'a little flask of something green', poseR: 'hold', poseL: 'down',
    say: ['A scientist. He’s sedimentary, my dear viewer.', 'He’s a scientist. He’s been studying moss. I’m flattered.'] },
  { id: 'royal', label: 'monarch', prop: 'a sceptre', poseR: 'hold', poseL: 'hip',
    say: ['Royalty. A crown. He rules everything the tide leaves behind.', 'A king. Or a queen. With pebbles you can’t tell, and it’s rude to ask.'] },
  { id: 'mail', label: 'mail carrier', prop: 'a letter', poseR: 'up', poseL: 'down',
    say: ['A mail carrier. Neither rain, nor snow... He’s a rock. Weather isn’t a problem.', 'He delivers the mail. Slowly. He’s a pebble.'] },
  { id: 'accountant', label: 'accountant', prop: 'a briefcase', poseR: 'down', poseL: 'hip',
    say: ['An accountant. Somebody has to count the other pebbles.', 'He’s an accountant. He does taxes for the whole riverbed. They owe nothing. They’re rocks.'] },
  { id: 'geologist', label: 'geologist', prop: 'a rock hammer, and his cousin Greg', poseR: 'hold', poseL: 'out',
    say: ['A geologist. He studies his own relatives. That’s Greg he’s holding.', 'He’s a geologist. Every field trip is a family reunion.'] },
  { id: 'painter', label: 'painter', prop: 'a brush, and a tiny canvas', poseR: 'hold', poseL: 'out',
    say: ['A painter. He’s painting a pebble, who’s painting a pebble. Don’t think about it too long.', 'He paints. I like him already.'] },
  { id: 'gardener', label: 'gardener', prop: 'a sunflower', poseR: 'hold', poseL: 'down',
    say: ['A gardener. He planted himself once. Nothing happened. He’s not bitter.', 'He’s a gardener. A big straw hat. The sun is very hard on a pebble.'] },
  { id: 'dj', label: 'DJ', prop: 'a record', poseR: 'up', poseL: 'out',
    say: ['A DJ. He only plays rock. And a little gravel.', 'He’s a DJ. He drops the bass. He drops everything, he has no fingers.'] },
  { id: 'ballerina', label: 'ballerina', prop: 'a little sparkle', poseR: 'up', poseL: 'up',
    say: ['A ballerina. Very graceful, for a rock.', 'She dances. A tutu. Just tap it out, all the way round, like a little pink bush.'] },
]

export const NAMES = [
  'Rocky', 'Sandy', 'Clay', 'Cliff', 'Flint', 'Jasper', 'Ruby', 'Opal', 'Onyx', 'Slate', 'Dusty', 'Rocco',
  'Gemma', 'Agatha', 'Garnet', 'Mica', 'Shale', 'Basil', 'Gary', 'Marge', 'Peter', 'Petra', 'Dwayne', 'Mason',
  'Pearl', 'Stoney', 'Brock', 'Amber', 'Chip', 'Gritty', 'Crystal', 'Jade', 'Rubble', 'Tuff', 'Beryl', 'Cole',
  'Sterling', 'Topaz', 'Pebbles', 'Monty', 'Rhoda', 'Stan', 'Marla', 'Quartz', 'Dolly', 'Howlite', 'Skip',
]

// The eight paintings Codex made with the imagegen skill. Bands run top to bottom: Cobb paints the
// picture in that order. y values are fractions of the canvas height. `ground` is where feet go.
export const PLATES = [
  { id: 'gravelmore', title: 'Mount Gravelmore', ground: 0.915, base: 'white',
    bands: [
      { what: 'sky', y: [0, 0.3], style: 'criss', tool: 'big', paints: ['pblue', 'white'] },
      { what: 'mountain', y: [0.1, 0.5], style: 'knife', tool: 'knife', paints: ['prussian', 'white', 'black'] },
      { what: 'lake', y: [0.46, 0.74], style: 'rows', tool: 'big', paints: ['pblue', 'white'] },
      { what: 'meadow', y: [0.7, 1], style: 'dab', tool: 'big', paints: ['sap', 'yellow'] },
    ] },
  { id: 'sundown', title: 'Shoal at Sundown', ground: 0.925, base: 'white',
    bands: [
      { what: 'sunset', y: [0, 0.5], style: 'criss', tool: 'big', paints: ['yellow', 'red', 'crimson'] },
      { what: 'hills', y: [0.38, 0.62], style: 'knife', tool: 'knife', paints: ['vandyke', 'crimson'] },
      { what: 'water', y: [0.58, 0.82], style: 'rows', tool: 'big', paints: ['red', 'ochre'] },
      { what: 'shore', y: [0.78, 1], style: 'dab', tool: 'big', paints: ['vandyke', 'sienna'] },
    ] },
  { id: 'hollow', title: 'Mossy Hollow', ground: 0.91, base: 'white',
    bands: [
      { what: 'mist', y: [0, 0.32], style: 'criss', tool: 'big', paints: ['white', 'yellow'] },
      { what: 'forest', y: [0.12, 0.62], style: 'dab', tool: 'big', paints: ['sap', 'pgreen', 'vandyke'] },
      { what: 'clearing', y: [0.58, 1], style: 'dab', tool: 'big', paints: ['sap', 'yellow'] },
    ] },
  { id: 'winter', title: 'Cabin in the Cobbles', ground: 0.905, base: 'white',
    bands: [
      { what: 'sky', y: [0, 0.4], style: 'criss', tool: 'big', paints: ['crimson', 'white', 'pblue'] },
      { what: 'mountain', y: [0.28, 0.6], style: 'knife', tool: 'knife', paints: ['prussian', 'white'] },
      { what: 'cabin', y: [0.45, 0.76], style: 'dab', tool: 'big', paints: ['vandyke', 'white'] },
      { what: 'snow', y: [0.72, 1], style: 'rows', tool: 'big', paints: ['white', 'pblue'] },
    ] },
  { id: 'autumn', title: 'October Gravel Road', ground: 0.915, base: 'white',
    bands: [
      { what: 'sky', y: [0, 0.4], style: 'criss', tool: 'big', paints: ['indian', 'white'] },
      { what: 'mountain', y: [0.18, 0.55], style: 'knife', tool: 'knife', paints: ['sienna', 'white'] },
      { what: 'trees', y: [0.3, 0.72], style: 'dab', tool: 'big', paints: ['indian', 'red', 'yellow'] },
      { what: 'path', y: [0.68, 1], style: 'rows', tool: 'big', paints: ['ochre', 'sienna'] },
    ] },
  { id: 'seaside', title: 'Pebble Beach', ground: 0.915, base: 'white',
    bands: [
      { what: 'sky', y: [0, 0.46], style: 'criss', tool: 'big', paints: ['pblue', 'crimson', 'white'] },
      { what: 'wave', y: [0.4, 0.74], style: 'rows', tool: 'big', paints: ['pgreen', 'white'] },
      { what: 'beach', y: [0.7, 1], style: 'rows', tool: 'big', paints: ['ochre', 'sienna'] },
    ] },
  { id: 'aurora', title: 'Northern Lights', ground: 0.91, base: 'black',
    bands: [
      { what: 'aurora', y: [0, 0.36], style: 'cols', tool: 'big', paints: ['pgreen', 'white', 'crimson'] },
      { what: 'mountain', y: [0.24, 0.52], style: 'knife', tool: 'knife', paints: ['prussian', 'white'] },
      { what: 'lake', y: [0.48, 0.7], style: 'rows', tool: 'big', paints: ['prussian', 'pgreen'] },
      { what: 'snow', y: [0.66, 1], style: 'rows', tool: 'big', paints: ['white', 'prussian'] },
    ] },
  { id: 'mesa', title: 'Mesa at Golden Hour', ground: 0.9, base: 'white',
    bands: [
      { what: 'sunset', y: [0, 0.52], style: 'criss', tool: 'big', paints: ['indian', 'red', 'white'] },
      { what: 'mesa', y: [0.42, 0.68], style: 'knife', tool: 'knife', paints: ['sienna', 'red'] },
      { what: 'desert', y: [0.64, 1], style: 'rows', tool: 'big', paints: ['ochre', 'indian'] },
    ] },
]

export const byId = (list, id) => list.find((x) => x.id === id)
