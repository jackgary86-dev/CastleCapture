// campaigns.js
//
// Castle Siege is split into plain scripts that share the page's global scope, in this
// load order: data.js, sfx.js, sim.js, render.js, ui.js, then optional extras. There is no build step.
// Story campaigns (#27): five battles for each army, told in the lords' voices, ending in a
// showdown with one rival. Pure data, loaded right after data.js, so the headless tools see it too.
//
// Each chapter: { name, seed, n, diff, rivals, map, setup, objective, story, after }
//   map      the homeland fought in: 'home' for the player's own, or an army id
//   setup    hooks newGame applies: playerUnits (your starting garrison), aiBonus (extra rival
//            troops), holdFor (seconds to survive for the win), mustTake ('largest' | 'nearest':
//            the one enemy castle whose capture wins), playerKind ('fortress' for your start castle)
//   story    the parchment screen before the battle: [{ who: army id, text }], in that lord's voice
//   after    what the victory screen says; the last chapter's is the epilogue

const CAMPAIGNS = {
  aldmere: [
    {
      name: 'The Burning March', seed: 1101, n: 12, diff: 'easy', rivals: ['kharzul'], map: 'home',
      setup: { playerUnits: 24, aiBonus: 15 },
      objective: 'The Horde has crossed the river with more riders than you have spears. Take back every Kharzul palisade in the vale.',
      story: [
        { who: 'aldmere', text: 'They came over Coldwater Bridge at dawn, and the villages along the river are burning. Nine hundred years, and no Khagan has ever ridden this far. Let him see what a wall is for.' },
        { who: 'kharzul', text: 'Your bridges are good firewood, Mason Queen. Come out from behind your stones and I will show you how a war is actually fought.' },
      ],
      after: 'The riders are driven back over the river. The masons are already at work on the bridge they burned.',
    },
    {
      name: 'Coldwater Keep', seed: 1102, n: 14, diff: 'easy', rivals: ['nyx'], map: 'home',
      setup: { playerUnits: 70, aiBonus: 40, holdFor: 180, playerKind: 'fortress' },
      objective: 'The Covenant has taken the lower vale while you fought the Horde. Hold Coldwater Keep for three minutes until the levies arrive.',
      story: [
        { who: 'nyx', text: 'The crows told me your riders went north, Isolde. Such a big valley, and so empty. I only came to borrow it.' },
        { who: 'aldmere', text: 'The levies are two days out. Until then there is one keep, one wall and one order: nothing comes through that gate. Masons to the parapets.' },
      ],
      after: 'The levies arrive to find the keep standing and the mire-folk gone. Not one stone was lost.',
    },
    {
      name: "The Sultan's Price", seed: 1103, n: 16, diff: 'medium', rivals: ['solmara'], map: 'solmara',
      setup: { mustTake: 'largest' },
      objective: 'Amaru has been paying the Horde in gold. Cross the sands and take his treasury, the largest castle on the map, ringed in gold.',
      story: [
        { who: 'solmara', text: 'Business is business, Your Majesty. The Khagan pays on time. If you wish to outbid him, my door is always open.' },
        { who: 'aldmere', text: "I do not bargain with men who fund the burning of my villages. I will not take his sands. I will take his treasury, and the war will pay for itself." },
      ],
      after: "The treasury gates are yours. Without the Sultan's gold the Horde's clans begin to drift home.",
    },
    {
      name: 'Two Fronts', seed: 1104, n: 18, diff: 'medium', rivals: ['kharzul', 'nyx'], map: 'kharzul',
      setup: { aiBonus: 10 },
      objective: 'The Horde and the Covenant have made common cause on the Red Steppe. Break them both.',
      story: [
        { who: 'kharzul', text: 'The witch and I have an understanding. She gets your vale; I get your head. Ride, Aldmere. We are waiting.' },
        { who: 'nyx', text: 'Do not listen to him, dear. I have an understanding with everyone.' },
        { who: 'aldmere', text: 'An alliance of fire and rot. Hold the line, take the keeps between them, and let them learn what my masons already know: anything built in a hurry falls.' },
      ],
      after: 'The alliance breaks on the open grass. Veyra withdraws into the mire without a word to her ally.',
    },
    {
      name: 'The Red Steppe', seed: 1105, n: 20, diff: 'hard', rivals: ['kharzul'], map: 'kharzul',
      setup: { aiBonus: 25 },
      objective: "The Khagan waits with every clan he has left. Take every palisade on the Red Steppe and end the war where it began.",
      story: [
        { who: 'kharzul', text: 'You walked the whole way here, wall-builder. I almost respect it. Now there are no walls. Only grass, and me.' },
        { who: 'aldmere', text: 'There are no walls, Torvek. There is only a line of spears that will not move, and a queen standing behind it. Swear the Oath.' },
      ],
      after: 'The Red Wind is broken. Isolde orders a single wall raised on the steppe, a low one, with a gate that is never shut: a border, not a prison. Aldmere has stood nine hundred years. It will stand a while yet.',
    },
  ],

  kharzul: [
    {
      name: 'First Grass', seed: 1201, n: 12, diff: 'easy', rivals: ['solmara'], map: 'home',
      setup: {},
      objective: 'Solmaran caravans are crossing the steppe without paying the clans their due. Burn every outpost the Sultan has raised on the red grass.',
      story: [
        { who: 'kharzul', text: 'The Sultan thinks the steppe is a road. The steppe is a horse, and I hold the reins. Ride at first grass, and burn his toll-houses.' },
        { who: 'solmara', text: 'Toll-houses, Khagan? They are warehouses. If you wanted a share, you could simply have asked.' },
      ],
      after: 'The warehouses burn beautifully. The caravans pay the clans from now on.',
    },
    {
      name: 'The Longhouse', seed: 1202, n: 14, diff: 'easy', rivals: ['frostmark'], map: 'frostmark',
      setup: { mustTake: 'largest' },
      objective: "Ride north and take the Jarl's great longhouse, the largest castle on the map, ringed in gold. Nothing else matters.",
      story: [
        { who: 'frostmark', text: 'Come north, then.' },
        { who: 'kharzul', text: 'Three words! The old woman grows chatty. We do not need her fjords. We need her hall, so every jarl hears that the Red Wind sat in it.' },
      ],
      after: "The longhouse is yours for one night. You burn it on the way out, which Sigrun will not forget.",
    },
    {
      name: 'The Crows Come', seed: 1203, n: 14, diff: 'medium', rivals: ['nyx'], map: 'home',
      setup: { playerUnits: 60, aiBonus: 45, holdFor: 180 },
      objective: 'The Covenant has crept onto the steppe while the clans were north. Hold the winter camp for three minutes until the riders return.',
      story: [
        { who: 'nyx', text: 'The crows told me you had gone north, Torvek. Such a wide steppe, and so few horses left to guard it.' },
        { who: 'kharzul', text: 'A horse lord does not hide behind sticks. But the riders are three days out, so tonight, sticks it is. Hold the camp. Then we ride.' },
      ],
      after: 'The riders come home to a camp still standing. The crows go hungry.',
    },
    {
      name: 'The Golden Road', seed: 1204, n: 18, diff: 'medium', rivals: ['solmara', 'nyx'], map: 'solmara',
      setup: { aiBonus: 10 },
      objective: 'Amaru has hired the Covenant to guard his desert roads. Ride through both of them.',
      story: [
        { who: 'solmara', text: 'You cost me a great deal of money, Khagan, so I have spent a little more. The Matron is very reasonable, for a witch.' },
        { who: 'kharzul', text: 'Gold and crows. Fine. The moon is red tonight. Ride through the lot of them.' },
      ],
      after: 'The desert roads belong to whoever holds the horses, and that is you. Veyra is not paid.',
    },
    {
      name: 'Walls of Aldmere', seed: 1205, n: 20, diff: 'hard', rivals: ['aldmere'], map: 'aldmere',
      setup: { aiBonus: 25 },
      objective: 'The Mason Queen has nine hundred years of stone and every spear in the vale. Take every castle in Aldmere.',
      story: [
        { who: 'aldmere', text: 'Aldmere has stood nine hundred years, Torvek. It will stand tonight. The gate is shut.' },
        { who: 'kharzul', text: 'Then I will not use the gate. Clans of the steppe, the wall-builder says her stones will outlast us. Let us find out how long a stone burns.' },
      ],
      after: "The Azure Crown lies in the grass at the Khagan's feet. He does not pick it up. 'Keep your walls,' he tells the queen. 'Just leave the gates open.' The Red Wind rides home.",
    },
  ],

  frostmark: [
    {
      name: 'The Thaw', seed: 1301, n: 12, diff: 'easy', rivals: ['nyx'], map: 'home',
      setup: {},
      objective: 'With the spring thaw, crows from the mire have settled in the lower fjords. Clear every Covenant spire from the north.',
      story: [
        { who: 'nyx', text: 'The ice is thin this year, Jarl. The crows told me. We only came to see.' },
        { who: 'frostmark', text: 'You have seen. Now leave.' },
      ],
      after: 'The spires are empty by midsummer. Sigrun says nothing about it, which is her way of being pleased.',
    },
    {
      name: 'Hold the Pass', seed: 1302, n: 14, diff: 'easy', rivals: ['kharzul'], map: 'home',
      setup: { playerUnits: 70, aiBonus: 40, holdFor: 180, playerKind: 'fortress' },
      objective: 'The Red Wind has burned your longhouse and rides for the pass. Hold the pass fort for three minutes until the storm closes it behind him.',
      story: [
        { who: 'kharzul', text: 'I sat in your hall, old woman. Nice fire. Now I come for the rest.' },
        { who: 'frostmark', text: 'Shieldwall at the pass. The storm comes at dusk. Hold until then, and the winter does the rest.' },
      ],
      after: 'The storm closes the pass. What rode in does not ride out.',
    },
    {
      name: 'Southward', seed: 1303, n: 16, diff: 'medium', rivals: ['aldmere'], map: 'aldmere',
      setup: { mustTake: 'nearest' },
      objective: "Aldmere closed the river to northern timber. March south and take the Queen's border keep, ringed in gold, to reopen the trade.",
      story: [
        { who: 'aldmere', text: 'The river is closed to Frostmark until the Jarl explains why her longships were seen off my coast. I am patient. I can wait.' },
        { who: 'frostmark', text: 'I am not. We take the border keep. Then she can explain.' },
      ],
      after: 'The border keep falls and the river opens. Isolde sends a letter. Sigrun does not read it.',
    },
    {
      name: 'Sand and Snow', seed: 1304, n: 18, diff: 'medium', rivals: ['solmara', 'kharzul'], map: 'solmara',
      setup: { aiBonus: 10 },
      objective: 'The Sultan has bought the Horde to keep the north out of the desert trade. Break them both on their own sand.',
      story: [
        { who: 'solmara', text: 'The north wants my markets, Jarl? Very well. I have purchased a great many horses to explain why not.' },
        { who: 'frostmark', text: 'Sand is just cold ground that has forgotten. Shieldwall. Forward.' },
      ],
      after: 'The shieldwall walks across the desert and nothing bought with gold can stop it.',
    },
    {
      name: 'Mother of Crows', seed: 1305, n: 20, diff: 'hard', rivals: ['nyx'], map: 'nyx',
      setup: { aiBonus: 25 },
      objective: 'Every winter the crows return. End it. Take every spire in the Nyxhollow Mire.',
      story: [
        { who: 'nyx', text: 'The crows told me you would come, Sigrun. They told me in the spring. I have had all summer to prepare.' },
        { who: 'frostmark', text: 'Then you know how it ends.' },
      ],
      after: "The last spire goes quiet and the crows scatter over the marsh. Sigrun stands a long while in the silence, then turns for home. 'The north keeps its own,' she says. It is the most anyone has heard her say in a year.",
    },
  ],

  solmara: [
    {
      name: 'A Fair Price', seed: 1401, n: 12, diff: 'easy', rivals: ['aldmere'], map: 'home',
      setup: {},
      objective: 'Aldmere has seized the oasis forts to collect its own tolls. Reclaim every fort on the caravan road.',
      story: [
        { who: 'aldmere', text: 'Your caravans use my river roads, Sultan. A toll is only fair. I have taken the oasis forts as surety.' },
        { who: 'solmara', text: 'Surety! She has a gift for words. Open the treasury, captains. We are going to buy our forts back, and the price is going to be her soldiers.' },
      ],
      after: 'The forts are yours again and the tolls flow the right way. Isolde sends a courteous note. You frame it.',
    },
    {
      name: 'The Caravan', seed: 1402, n: 14, diff: 'easy', rivals: ['kharzul'], map: 'kharzul',
      setup: { mustTake: 'largest' },
      objective: "The Horde has looted the great caravan and stored it in the Khagan's largest palisade, ringed in gold. Take it back.",
      story: [
        { who: 'kharzul', text: 'Your wagons were on my grass. On my grass, things belong to me. That is the whole of the law out here.' },
        { who: 'solmara', text: 'Then I shall come and collect, in person, with a receipt. The receipt is an army.' },
      ],
      after: 'The caravan is recovered, down a few silks. The Khagan sends a bill for storage. You do not pay it.',
    },
    {
      name: 'Siege of the Oasis', seed: 1403, n: 14, diff: 'medium', rivals: ['nyx'], map: 'home',
      setup: { playerUnits: 60, aiBonus: 45, holdFor: 180 },
      objective: 'The Covenant has poisoned the wells and surrounds the great oasis. Hold it for three minutes until the relief column arrives.',
      story: [
        { who: 'nyx', text: 'Gold does not drink, Sultan. Your soldiers do. I wonder which of us is richer tonight.' },
        { who: 'solmara', text: 'The relief column is three days out and the wells are foul. Very well. We will see how much an oasis is worth when it is the only water for forty miles.' },
      ],
      after: 'The relief column arrives to a garrison still standing and a witch already gone. The wells clear by autumn.',
    },
    {
      name: 'Northern Markets', seed: 1404, n: 18, diff: 'medium', rivals: ['frostmark', 'aldmere'], map: 'frostmark',
      setup: { aiBonus: 10 },
      objective: 'The Jarl and the Queen have closed the northern ports to Solmaran trade. Open them with an army.',
      story: [
        { who: 'frostmark', text: 'The north does not need your spices.' },
        { who: 'aldmere', text: 'Nor your interest rates, Sultan. The ports stay closed.' },
        { who: 'solmara', text: 'Two kingdoms agreeing on anything is a market distortion. Let us correct it.' },
      ],
      after: 'The ports open under new management. The spice price in Frostmark falls by half, which is very good for business.',
    },
    {
      name: "The Ash-Mane's Debt", seed: 1405, n: 20, diff: 'hard', rivals: ['kharzul'], map: 'kharzul',
      setup: { aiBonus: 25 },
      objective: 'Torvek has raided the Sunscorched Sands for a generation and never paid for any of it. Collect. Take every palisade on the Red Steppe.',
      story: [
        { who: 'kharzul', text: 'You keep sending me bills, merchant. I keep burning them. Come and collect yourself if you want it so badly.' },
        { who: 'solmara', text: 'I intend to. Open the treasury, all of it. Every rider he has is about to learn what a Solmaran soldier is paid.' },
      ],
      after: "The Red Steppe is quiet and the Khagan's debt is settled in full. Amaru takes nothing from the steppe but a single horsehair tassel, which he hangs in the treasury beside the receipt.",
    },
  ],

  nyx: [
    {
      name: 'The First Whisper', seed: 1501, n: 12, diff: 'easy', rivals: ['solmara'], map: 'home',
      setup: {},
      objective: "The Sultan has sent surveyors to drain the mire for farmland. Teach them what the marsh keeps. Take every Solmaran fort.",
      story: [
        { who: 'solmara', text: "Swamp is only farmland that has not been invoiced yet, Matron. My engineers assure me the drainage is straightforward." },
        { who: 'nyx', text: 'The crows watched his engineers come in. They have not watched them leave. Whisper to the keeps, my darlings. The mire is waking.' },
      ],
      after: 'The surveyors are not seen again. The Sultan writes the mire off as a bad investment.',
    },
    {
      name: 'The White Wall', seed: 1502, n: 14, diff: 'easy', rivals: ['frostmark'], map: 'frostmark',
      setup: { mustTake: 'largest' },
      objective: "The Jarl burned the Covenant's winter roost. Take her great longhouse, the largest castle on the map, ringed in gold, and leave a crow on every beam.",
      story: [
        { who: 'frostmark', text: 'You roosted in my fjords. I burned the roost. That is all.' },
        { who: 'nyx', text: 'All? She has no idea how many eyes a longhouse has. The crows have seen every door. Open them.' },
      ],
      after: 'The longhouse falls in a single night. You leave it standing. It is more frightening that way.',
    },
    {
      name: 'The Mire Holds', seed: 1503, n: 14, diff: 'medium', rivals: ['aldmere'], map: 'home',
      setup: { playerUnits: 60, aiBonus: 45, holdFor: 180 },
      objective: 'The Mason Queen has come to burn the Covenant out while the crows are away. Hold the black spire for three minutes until the flock returns.',
      story: [
        { who: 'aldmere', text: 'Your crows are in the north, Matron, and I have brought masons. We will see how a swamp holds against a proper siege.' },
        { who: 'nyx', text: 'My darlings are three days away and the queen has brought ladders. How thoughtful. The mire keeps what it drowns. Let us see what it keeps tonight.' },
      ],
      after: 'The flock returns at dusk to a spire still standing. The masons go home with fewer ladders.',
    },
    {
      name: 'Red Moon Rising', seed: 1504, n: 18, diff: 'medium', rivals: ['kharzul', 'solmara'], map: 'kharzul',
      setup: { aiBonus: 10 },
      objective: 'The Khagan and the Sultan have joined to clear the roads of crows. Clear the roads of them instead.',
      story: [
        { who: 'kharzul', text: 'The merchant pays, I ride, and the crows get eaten. Simple. I like simple.' },
        { who: 'nyx', text: 'The moon will be red tonight, Torvek. The crows told me. They did not tell me whose blood it was for.' },
      ],
      after: 'The alliance of gold and horses fails on the open grass. The crows eat well.',
    },
    {
      name: 'The Mason Queen', seed: 1505, n: 20, diff: 'hard', rivals: ['aldmere'], map: 'aldmere',
      setup: { aiBonus: 25 },
      objective: 'Nine hundred years of walls stand between the Covenant and the green vale. Take every castle in Aldmere.',
      story: [
        { who: 'aldmere', text: 'Aldmere has stood nine hundred years, Veyra, and it has never once fallen to whispers. Bring your crows. My walls are listening.' },
        { who: 'nyx', text: 'Nine hundred years, and every one of them with a crow on the parapet. I know every stone of those walls, dear. The masons told me.' },
      ],
      after: "The vale goes quiet under a sky of wings. Veyra does not take the Azure Crown; she leaves it on its cushion and a single black feather beside it. 'The crows did see this,' she tells the queen. 'They just didn't tell you.'",
    },
  ],
};
for (const id of Object.keys(CAMPAIGNS)) if (ARMIES[id]) ARMIES[id].campaign = CAMPAIGNS[id];
