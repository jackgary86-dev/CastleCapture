# Castle Capture

A medieval real-time strategy game that runs in the browser. Choose one of five armies, march tiny soldiers between castles, claim unclaimed keeps, and conquer rival kingdoms: in a quick skirmish, a story campaign told by the lords themselves, or the Grand Campaign with all five armies on one great map.

## Play

Open `index.html` in any modern browser. There's no build step and nothing to install.

### Install on Windows

To get a Start menu and desktop shortcut, double-click `install/Install Castle Siege.cmd`. The installer needs no admin rights. It copies the game to `%LOCALAPPDATA%\Programs\Castle Siege`, and the shortcuts open it in its own Edge app window, or in the default browser if Edge is missing. It also lists the game under Settings > Apps, so you can uninstall it there.

Run the installer again after pulling new commits to update the game. Saved games live in the browser's storage, so updating or uninstalling never touches them. The game's fonts load from Google Fonts. Offline, it falls back to the system's serif and sans-serif fonts.

## Features

- **Five armies**, each with its own castles, banners, soldiers, homeland map, music, strengths, special power and AI personality, commanded by a **named rival lord** who taunts you and plays in character.
- **Troop types:** foot, fast cavalry, and slow catapults that hit castles hard.
- **Upgrades and archers:** Walls and Barracks levels bought with a castle's troops, and every castle shoots at enemy columns marching past.
- **Castle kinds:** fortresses, war camps and villages among the unclaimed keeps.
- **Garrison caps:** each castle stops training at its cap, and troops above it slowly desert.
- **Coins and map units:** castles earn coins that buy one Ballista Tower, Siege Trebuchet or Great Ward per battle.
- **Terrain:** rivers crossed only at bridges, lakes, and forests that slow marching troops.
- **Fog of war** (optional): see only near your castles and columns.
- **Weather and day/night:** rain, dust storms, snow, heat and marsh fog drift across each homeland, and nights slow training.
- **Random map events** (optional): mercenaries, plague, bandit raids and harvests.
- **Truces and diplomacy** in battles with three or more kingdoms.
- **Rally points** that send a castle's new troops to the front automatically.
- **Two players on one screen:** player 2 takes the rival army on the keyboard.
- **Story campaigns:** five chapters for each army, with objectives and parchment story screens.
- **Grand Campaign:** all five armies on one great map, played in waves of planning and marching, with four maps, a roaming **map monster** on each, and save slots.
- **Siege Defense:** hold a five-castle fortress against ever bigger waves from up to three lords, with a score, a daily siege and a best-wave record.
- **Tutorial:** a guided first battle in seven lessons.
- **Achievements and records**, kept in your browser.
- **Renown and a profile**: earn renown in every mode, spend it on banners, roof colours and starting map units, and claim the Grand Campaign maps on a realm map that runs in seasons.
- **Accessibility:** colour-blind mode, full keyboard play and screen-reader announcements.
- **Touch and phones:** pinch-zoom, pan and a thumb bar.
- **The codex:** painted cards and entries for every army and monster.
- **Saving:** unfinished battles are saved automatically.

## The five armies

Each army has its own castles, banners, soldiers, homeland map, strengths, special power, and AI personality when it's your rival.

| Army | Role | Strength | Special power | Homeland | As a rival |
|---|---|---|---|---|---|
| **The Azure Crown of Aldmere** (blue) | Defense | Defenders count as 1.45 soldiers | **Stone Oath:** defenders count double for 20s | The Vale of Aldmere | Defensive |
| **The Kharzul Horde** (red) | Attack | Riders 30% faster, strike 1.12×; 0.9 in road battles, palisades defend at 0.9, slowed badly by forests | **Blood Moon Charge:** troops move 2× and hit 1.5× for 15s | The Red Steppe | Very aggressive |
| **The Jarls of Frostmark** (teal) | Defense | 1.45× in road battles, castles defend at 1.4; 5% slower, barely slowed by forests | **Winter's Grip:** every enemy soldier in the field freezes for 12s | The Frostmark Fjords | Very defensive |
| **The Sun Dominion of Solmara** (gold) | Balanced | Soldiers fight at 0.9; relies on the Golden Tithe | **Golden Tithe:** castles train twice as fast for 15s | The Sunscorched Sands | Balanced |
| **The Nyxhollow Covenant** (violet) | Attack | Attacks on unclaimed keeps count 1.35×; strike 1.12× | **Plague of Crows:** the 3 largest enemy castles lose 40% of their garrison | Nyxhollow Mire | Aggressive and cunning |

Special powers are ready 45 seconds into a battle, then recharge for 5 minutes. The timings live in `FIRST_CHARGE` and `RECHARGE` in `js/data.js`, and the recharge can be changed under Custom battle settings.

## Rival lords

Each army is commanded by a named lord when it's your rival. They introduce themselves before the battle, taunt you when castles change hands or they use their power (taunts can be turned off in the menu), and get the last word on the end screen. Each lord's quirks sit on top of their army's AI personality.

| Lord | Army | How they play |
|---|---|---|
| **Queen Isolde Varr**, the Mason Queen | Aldmere | Keeps her front-line castles topped up before attacking, saves Stone Oath until two castles are under attack, and advances one castle at a time once she outnumbers you 2 to 1. |
| **Khagan Torvek Ash-Mane**, the Red Wind | Kharzul | Hammers the strongest rival's biggest castle, opens his attacks with Blood Moon Charge, and never reinforces. |
| **Jarl Sigrun Ironfrost**, the White Wall | Frostmark | Holds her army home early, freezes big attacks with Winter's Grip and then counter-attacks the castles they came from, and intercepts columns marching on nearby keeps. |
| **Sultan Amaru al-Zahir**, the Golden Hand | Solmara | Expands fastest in the first minute, bribing unclaimed keeps (they count 1.6×) and claiming only keeps on his side of the map, opens the treasury right after a wave of captures, and avoids even fights. |
| **The Hollow Matron Veyra**, Mother of Crows | Nyxhollow | Pounces on castles you've just emptied, looses the crows right before her main attack, and takes keeps near you to box you in. |

The lords reinforce and intercept with cavalry. Under fog of war they play by the same rules you do.

## Modes

- **Skirmish:** pick your rival (or a random one); 1 rival, 2 rivals, or a free-for-all against all four; and whether to invade their homeland or defend yours. Difficulty is Squire, Knight or Warlord. In battles with three or more kingdoms, nobody may attack another kingdom for the first 25 seconds while the armies muster. The Skirmish menu also has toggles for fog of war, map events, two players and lord taunts.
  - **Custom battle settings:** number of castles, map size, starting troops, how strong unclaimed keeps are, troop speed, power recharge time and garrison cap, with **Quick brawl**, **Standard** and **Long war** presets. The end screen shows the map seed; type it into the settings to replay the same map.
- **Two players:** turn on **Two players** in the Skirmish menu and a second player takes the rival army on the same keyboard (see [Controls](#controls)). Fog of war is off for two players. Skirmish only.
- **Campaign:** each army has its own **story campaign** of five chapters, told in the lords' voices on a parchment screen before each battle and ending in a showdown with one rival. Chapters have their own objectives (hold out for a time, take one named castle, or start outnumbered) shown on a badge during the battle. Each win unlocks the next chapter, and progress is kept per army.
- **Grand Campaign:** all five armies on one great map, played in waves. In the plan phase nothing moves while you queue orders (sends, your power, map units); press **March** and every kingdom's orders launch at once for a 20-second march. Rival realms surrender once they fall below a fifth of the strongest realm's troops (not before wave 20). The treasury has no cap. Save to five slots, or export and import a save file, from the pause menu; **Continue** on the menu picks up the latest.
  - **Map monsters:** four maps, each with a monster (`js/monsters.js`, data in `MONSTERS` and `GRAND_MAPS`): the Wyrm of the Wastes on the Five Realms; the **Red Dragon** of the Scorched Reach, which flies between its lair and the keeps and breathes fire on the nearest column or castle where it lands; the **Cyclops** of the Giant's Fells, which follows the roads (its route is drawn a wave ahead) and smashes a castle it walks into, losing it 30% of its garrison and an upgrade level, and sleeps where it stops (troops that catch it asleep strike 1.5×); and the **Bandit Gang** of the Blackwood Marches, five captains who ambush columns among the trees, raid castles for a quarter of their coins, and heal at a camp that a big enough force can overrun. A monster wanders between the castles during each march, stands still between waves, and bites any column that strays within reach. Drag troops onto it to fight it: every troop deals 1 damage a second and the monster kills troops at its own rate, shared across everyone fighting it. Its health bar shows each army's share of the damage, and **whoever lands the final blow takes the whole bounty** (150–220 coins; the others get 10% of their damage back). It regenerates when left alone, respawns ten waves after a kill with a warning the wave before, and the lords ignore it while healthy, hunt it only with troops to spare, and swarm it below a quarter health.
- **King of the Hill** (under **Modes** on the menu): a short race of five to ten minutes against 1, 2 or all 4 AI lords. A crowned keep stands at the centre of the map (on dry ground: no rivers in this mode). It is large, its walls count 1.5×, and it can't be upgraded. Whoever holds it scores a point a second, shown for every realm on a score bar in the header; the first to 300 wins, and after 12 minutes the most points wins. Each kingdom's starting castle is its seat (gold pennant): it can be emptied but never taken, so nobody is knocked out of the race and nobody surrenders. A banner calls out the leader, and at 250 points every lord turns on them. The lords know the rule: **Torvek** rushes the hill, **Isolde** takes the keeps beside it and counter-takes it right after someone else has paid for it, **Amaru** builds a Ballista Tower next to it, **Veyra** waits for the holder to bleed and then strikes, and **Sigrun** freezes the holder's columns with Winter's Grip while hers close in. Records keep your best time to 300 for each army. Rules in `js/hill.js`, the menu, score bar and crown in `js/hill-ui.js`; `node tools/balance.js --mode hill` checks every army's win rate.
- **Siege Defense** (under **Modes** on the menu): a solo survival mode. You hold a fortress of five castles on the west edge; up to three rival lords muster at siege camps on the east edge (they can't be taken) and attack in timed waves, a second lord joining at wave 4 and a third at wave 7. Every wave is bigger than the last and adds a trick: **catapults** with a foot escort from wave 4, a **cavalry flank** against the castle furthest from the main blow from wave 6, and from wave 10 a **siege beast**, one huge column whose every soldier strikes three times as hard, aimed at your biggest garrison. Castles the lords take send most of their garrison with the next wave. After each wave you beat come **20 seconds** (or press **Next wave**) and a **coin payout**, more for each unclaimed keep you hold, to spend on **Walls** and **Barracks** (with coins, from the castle panel, or troops as usual) and **map units** (another after every wave, up to two standing). The **score** is the waves survived plus the castles you held when the last of them was beaten; the siege ends when your last castle falls. The **Daily siege** uses a fixed seed for the calendar day (the same homeland and waves for everyone, at Knight; the lords are drawn from the day and your army) and keeps your best score for each day in this browser. The menu card shows your most waves held, and achievements unlock at waves 10, 20 and 30. Rules in `js/defense.js`, interface in `js/defense-ui.js`.
- **Learn to play:** the tutorial (see below).

## Controls

### Player 1 (mouse, touch and keyboard)

| Action | Mouse / touch | Keyboard |
|---|---|---|
| Send troops | Drag from your castle to any castle | Select, move focus to the target, **Enter** (**Shift+Enter** to send to your own castle) |
| Attack from several castles | Drag across them, or tap to select then tap the target | **Space** selects all your castles |
| How many to send | Scroll wheel; **Send %** on the thumb bar | **1**–**4**: 25%, 50%, 75%, all |
| Troop type | Troops buttons in the header | **T** cycles foot, cavalry, catapults |
| Move between castles | | **Tab** / **Shift+Tab** (your castles), **arrow keys** (nearest castle that way) |
| Special power | Power panel (top left) or **Power** on the thumb bar | **Q** |
| Upgrade Walls / Barracks | Buttons on a selected castle | **U** / **I** (every selected castle) |
| Shop for a map unit | Treasury panel (top right) | **B**; **Esc** cancels placing |
| Rally point | Right-drag or Shift-drag between your castles; long-press then drag on touch | |
| Clear a rally point | Right-click the castle | |
| Zoom and pan | Pinch and two-finger drag; Ctrl+scroll or trackpad pinch; **Fit** shows the whole map | |
| Diplomacy | **Diplomacy** button; answer offers on their card | |
| Game speed | Speed buttons | **[** / **]**: 1×, 1.5×, 2× |
| Pause | Pause button | **P**, or **Esc** with nothing selected |
| Clear the selection | Click empty ground | **Esc** |
| Sound effects / music | Sound and Music buttons | **M** / **N** |
| Colour-blind mode | Menu toggle | **C** |

### Player 2 (keyboard, two-player skirmish)

| Action | Key |
|---|---|
| Move the cursor ring between castles | **W A S D** |
| Select your castle, or send the selected troops to the castle under the cursor | **E** (**Shift+E** sends to one of your own) |
| Select all your castles | **F** |
| Special power | **R** |
| How many to send | **Shift+1**–**Shift+4** |
| Offer or break a truce with the lord under the cursor | **T** |
| Accept or refuse a truce offer | **Y** / **N** |

## How to play

- **Drag** from one of your castles to any castle to send troops. **Drag across** several of your castles to attack from all of them, or **tap** castles to select them and then tap a target.
- **Special power:** the panel in the top left of the map shows the power's name, what it does, and a countdown until it's ready.
- **Upgrades:** select one of your castles to spend its troops on **Walls** (each level: defenders count 15% more, the castle holds 15 more troops, and its archers shoot faster, farther and harder) or **Barracks** (each level: 8% faster training, and the soldiers it sends hit 12% harder, shown by a gold crest). Three levels each, costing 15 / 25 / 40 troops for a medium castle (0.8× small, 1.2× large). A captured castle loses one level of each. Pips under the garrison count show a castle's levels.
- **Archers:** every castle a kingdom holds shoots at enemy columns marching past, so a small raid on a fortified castle can lose a third of its troops before it arrives.
- **Special castles:** about a quarter of the unclaimed keeps are special, marked by a badge beside the troop count and a detail on the map. A **fortress** (shield, outer rampart) counts every defender double. A **war camp** (crossed swords, tents) trains 60% faster, but its defenders count only 0.7. A **village** (cottage, houses) trains nothing, but its owner's castles within its dashed circle train 25% faster each (up to 50%). Captured castles keep their kind, and mirrored copies on the map always share a kind.
- **Garrison caps:** a small castle holds 60 troops, a medium 90 and a large 120, plus 15 per Walls level (scaled by the Garrison cap setting). A castle at its cap stops training. Troops marching in can push it over, but the excess slowly deserts.
- **Upkeep:** a castle trains at half speed once its garrison passes twice its size, and a quarter speed past four times. An hourglass on its plaque shows when.
- **Bigger castles** train troops faster. Unclaimed keeps never grow. A captured castle is rebuilt in its new owner's style.
- **Rivers** can only be crossed at bridges, so troops march the long way round and bridges become chokepoints. **Forests** slow marching troops (Kharzul horses most, Frostmark woodsmen least). Routes follow the roads automatically, and while aiming you can see the exact route each column will take. The desert has neither.
- **Troop types:** **Foot** are all-rounders. **Cavalry** march 1.6× as fast but hit castles at only 0.6×: use them to rush reinforcements and catch columns on the road. **Catapults** crawl at 0.55× and fight at 0.75× on the road, but hit castles 1.8× as hard. The rival lords use cavalry to reinforce and to catch columns. AI catapults (sent with a foot escort marching at their pace) are built but switched off with `AI_SIEGE` in `js/data.js` until their tactics are tuned ([#58](https://github.com/jackgary86-dev/CastleCapture/issues/58)).
- **Armies that meet on the road fight.** The stronger column marches on with what's left.
- **Red banners** over your castles count the enemy troops marching on them. A pulsing ring means the castle will fall unless you reinforce it.
- **Truces** (battles with three or more kingdoms): the **Diplomacy** button offers a rival lord a 90-second truce, and lords sometimes offer you one on a card you accept or refuse. Allies can't attack each other (columns already marching at an ally turn back home), allied columns pass on the road, archers and map units hold fire, and allied castles fly a white pennant. Each lord answers in character: Isolde accepts unless she's winning, Amaru accepts for 15 coins (and offers truces himself when second, as Isolde does), Sigrun only deals with someone stronger, Torvek always refuses, and Veyra always accepts, then breaks the truce about a minute later. AI lords make truces with each other too. A truce can't be renewed for 60 seconds after it ends.
- **Weather** drifts across each homeland in spells of a minute or so, between clear spells: **rain** on the vale (march 10% slower), **dust storms** on the steppe (15% slower, shorter sight), **snow** in the fjords (15% slower), **heat** (training 15% slower) or dust in the desert, **marsh fog** (half sight, 5% slower) or rain in the mire. The army whose homeland it is ignores its own weather. **Night** falls once every four-minute day and trains troops up to 10% slower. Sight effects matter under fog of war.
- **Fog of war** (optional): you only see near your own castles and marching columns. Castles out of sight show the owner and garrison you last saw, greyed, and enemy columns in the fog are hidden. Send troops out to scout.
- **Map events** (optional): every 60 to 90 seconds something happens, announced with a toast. Mercenaries fill an unclaimed keep, plague thins a garrison, a bandit column raids the weakest castle, or a harvest speeds one kingdom's training for a while.
- **Rally points:** a castle with a rally point sends its new troops to the other castle automatically, leaving 5 at home. The route breaks if either castle is lost.
- **Rivals surrender** when they hold under 10% of all troops and two castles or fewer for 8 seconds (after the first minute). Against one rival their castles open their gates to you; with two or more they fall back to neutral.
- **Saving:** an unfinished battle is saved in your browser when you close or hide the tab, and every 10 seconds. Resume it from the banner at the top of the menu, or discard it. Retreating to the menu abandons the battle. Grand Campaign games have their own save slots.

## Coins and map units

Every castle you hold earns coins each minute: small castles 1, medium 2, large 3. Coins build up slowly, so they pay off late in a battle, and the treasury holds at most 300 (no cap in the Grand Campaign). Spend them on **one map unit per battle**, placed on the map near your castles. Open the shop from the Treasury panel at the top right, or press **B**.

| Map unit | Type | Price | Range | Effect |
|---|---|---|---|---|
| **Ballista Tower** | Defensive | 40 | 120 | Fires bolts at enemy soldiers marching within range, killing about three troops a second |
| **Siege Trebuchet** | Offensive | 65 | 180 | Every 5 seconds, hurls a boulder at the enemy castle in range with the biggest garrison, knocking out 15% of its defenders |
| **Great Ward** | Support | 90 | 150 | Your castles inside train twice as fast and defend at 1.5x; enemy troops passing through march at half speed |

Map units can't be destroyed once placed, and a Great Ward only helps the kingdom that built it. AI lords save up for the unit that suits them. The prices and ranges live in `MAP_UNITS`, `COIN_PER_MIN` and `COIN_CAP` in `js/data.js`.

## Music

Each homeland has its own synthesised theme (no audio files): a lute-like air in the Vale of Aldmere, droning saws and frame drums on the Red Steppe, slow bells in the Frostmark Fjords, a Hijaz melody and hand drums in the Sunscorched Sands, and a beating drone in Nyxhollow Mire. The music swells with the fighting, adding drums and quicker, higher lines when armies are on the march, clashing, or using a special power. The Music button or **N** turns it on or off, separately from the sound effects.

## Achievements and records

Thirteen achievements, from First Blood and Lightning War (win in under 2 minutes) to Bane of Lords (beat every lord on Warlord) and Conqueror (capture 100 castles). New ones appear on the victory screen. The menu's achievements sheet also keeps your records: battles, wins and losses, fastest wins at each difficulty, castles captured, enemy troops destroyed on the road, Siege Defense games, most waves held and best score, and your record with each army and against each lord. Siege Defense has three of its own, Hold the Line, Unbroken and The Last Bastion, for surviving 10, 20 and 30 waves; they unlock the moment the wave is beaten. Everything is saved in your browser.

## Renown and the profile

Every game pays renown: more for harder difficulties and for longer modes (a Warlord battle won pays 20, a Warlord Grand Campaign won 120), a little for a loss, 15 for each achievement and 10 for the killing blow on a map monster. The victory screen shows what a game paid. A profile that already has achievements and wins starts with renown for those past deeds.

**Profile** on the menu spends it. Banners (any army's banner shape) and roof colours are cosmetic. A starting map unit stands beside your home castle at the start of every skirmish and uses up that battle's one map unit. Winning a Grand Campaign claims its map on the **realm map**: each region claimed this season adds 4 troops to your home castle in later Grand Campaigns, at most 12. Both gameplay unlocks have a switch on the profile page, and the headless balance runner never sees them. Beginning a new season clears the realm map and keeps the old one in the hall of fame. The profile is saved in your browser and can be exported to a file and imported again.

## Accessibility

- **Colour-blind mode** (menu, or **C**) switches the armies to a colour-blind-safe palette and puts each army's emblem (crown, moon, snowflake, sun, eye) on its garrison plaques and above its marching columns, so kingdoms can be told apart by shape.
- **Keyboard play:** **Tab** and **Shift+Tab** move between your castles, the **arrow keys** move to the nearest castle in that direction, **Enter** selects your castle or sends your selected troops to an enemy or unclaimed castle, and **Shift+Enter** sends them to any castle, including your own.
- **Touch and phones:** pinch with two fingers to zoom (up to 3×) and drag them to pan; **Fit** shows the whole map again. Ctrl+scroll (or a trackpad pinch) zooms on desktop. Castles have larger tap areas for fingers, and phones and touch screens get a thumb bar with big **Power**, **Send %**, **All** and **Fit** buttons.
- **Screen readers** hear the focused castle, captures, special powers, map units, surrenders and the result.

## Tutorial

New players are offered a short guided battle on first launch, and it's always available from the menu under **Learn to play**. Seven lessons, each waiting until you've done it: sending troops, choosing how many, attacking from several castles, reading red banners and reinforcing, intercepting a column on the road, using your special power, and finally winning the battle. Gold rings mark what to click; the lesson card can be folded down or a lesson skipped. Tutorial battles aren't saved and don't count towards achievements.

## The codex

The main menu's **Armies and monsters** section (`js/codex.js`) shows a painted card for each army and monster. Each opens a codex entry with the army's story, strength, stats, troop types, special power, personality, homeland and lord, or the monster's story, abilities, bounty and how to beat it.

See the [issues](https://github.com/jackgary86-dev/CastleCapture/issues) for planned improvements.

## Code layout

The game has no build step. `index.html` holds the markup and CSS and loads plain scripts that share the page's global scope, in this order:

| File | What it holds |
|---|---|
| `js/data.js` | Constants, the five armies and their lords, homeland themes and weather, troop types, castle kinds, map units, Grand Campaign settings, utilities, and the event bus (`on` / `emit`) |
| `js/campaigns.js` | The story campaigns' chapters: maps, setups, objectives and story text. Pure data |
| `js/sfx.js` | Synthesised sound effects and music |
| `js/sim.js` | Map generation and terrain, battle state, army stats and powers, fog of war, weather, truces, the AI lords, coins and map units, and the simulation step. No DOM access: it reports what happens through `emit()` |
| `js/grand.js` | The Grand Campaign's rules: the five-realm map and the wave loop. No DOM access |
| `js/hill.js` | King of the Hill rules: scoring the crowned keep, seats, the race's end, and each lord's tactics for the hill. No DOM access |
| `js/defense.js` | Siege Defense's rules: the fortress map, the waves and their twists, payouts, coin upgrades and the daily seed. No DOM access |
| `js/render.js` | Canvas drawing and the view state the input writes (`ptr`, `sel`) |
| `js/ui.js` | HUD, power panel, treasury, troop types, diplomacy, input, menus, saving, the frame loop, and the listeners that turn simulation events into sound and banners |
| `js/grand-ui.js` | The Grand Campaign's planning screen, orders list and save slots |
| `js/achievements.js` | Achievements and personal records |
| `js/progress.js` | Renown, the unlocks and the realm map's seasons, saved under `cs-progress`. No DOM access |
| `js/progress-ui.js` | The Profile page (shop, realm map, hall of fame, export and import), the renown line on the end screen, and the banner and roof skins render.js asks for |
| `js/access.js` | Colour-blind mode, keyboard play and screen-reader announcements |
| `js/touch.js` | Pinch-zoom and pan camera, larger touch targets and the thumb bar |
| `js/monsters.js` | Grand Campaign map monsters: movement, fighting, bounties, each monster's special, the lords' hooks, and their drawing. Its simulation half has no DOM access |
| `art/launch-bg.js`, `art/gallery.js` | Procedural paintings: the launch background and the army and monster panels |
| `js/menu-art.js` | Paints the launch background behind the main menu |
| `js/grand-menu.js` | The menu's Grand Campaign section: map cards, Begin, Continue and the saved-games sheet |
| `js/hill-ui.js` | King of the Hill menu entry (under Modes), the header score bar, leader banners, the crown over the keep and the end screen |
| `js/defense-ui.js` | Siege Defense in the browser: the Modes menu card, wave line, Next wave button, coin upgrades, siege beast and end screen |
| `js/events.js` | Random map events and their menu toggle |
| `js/story.js` | The story campaign ladder, story screens, objective badge and progress |
| `js/twoplayer.js` | Two players on one screen: player 2's keyboard controls, panel and truce cards |
| `js/codex.js` | The Armies and monsters cards and codex entries |
| `js/tutorial.js` | The guided first battle |

`data.js`, `campaigns.js`, `sim.js`, `grand.js`, `hill.js`, `defense.js` and the simulation half of `monsters.js` never touch the DOM, so the headless tools in `tools/` load them directly. The files after `ui.js` only hook into what loads before them.

| Folder | What it holds |
|---|---|
| `art/` | The launch background and gallery painters, their HTML viewers, and the exported PNGs |
| `tools/` | `balance.js` (headless balance test), `smoke.js` (loads the whole page headlessly), `render-art.js` (exports the paintings to PNG) |

## Balance tests

`tools/balance.js` runs the simulation headlessly in Node: every army fights every other with the AI on both sides, and the run fails if any army's win rate leaves the agreed band.

```bash
node tools/balance.js --games 8
```

Options: `--games N` per pairing, `--diff easy|medium|hard`, `--seconds` cap per battle, `--band 0.25,0.75`, `--json`. `--mode hill` races every pairing for the crowned keep of King of the Hill instead (each race ends at 300 points or the 12-minute cap, so every game counts); `--mode defense` seats the AI in the Siege Defense fortress for every army and reports the median waves survived per army (it fails if any army's median is more than `--spread`, default 40%, from the overall median; the target is 8–15 waves on Warlord); and `--mode grand` plays Grand Campaigns. Runs are seeded, so the same arguments always give the same result. GitHub Actions runs it on every push and pull request (`.github/workflows/balance.yml`).

## Smoke test

The balance test only loads the simulation files (`js/data.js`, `js/sim.js`, `js/grand.js`, `js/hill.js`, `js/defense.js`, `js/monsters.js`), so it can't see mistakes in the UI files. `tools/smoke.js` loads every script `index.html` loads, in the same order and sharing one global scope, with stand-in browser objects. It then plays two battles through the menu path, draws frames, saves, resumes and finishes a battle, plays a short King of the Hill race to its end, plays Grand Campaign waves, and plays a Siege Defense through three waves, a save and resume, and the fall of the last castle, and fails on any exception. That catches using a name before the file that defines it has run, two files declaring the same top-level name, and HUD or drawing code that throws.

```bash
node tools/smoke.js
```

CI runs it before the balance test. It still isn't a substitute for opening the game in a browser, since the stand-ins accept anything.

## Art

`art/launch-bg.js` paints the launch background procedurally (a dusk valley with the five homelands' castles), seeded so it renders identically everywhere. Open `art/launch-bg.html` to see it fill the window, or export PNGs with `node tools/render-art.js` after a one-off `npm install @napi-rs/canvas`. The exported `art/launch-bg.png` (1920×1080) and `art/launch-bg-3840x2160.png` are checked in.

`art/gallery.html` shows one painted panel for each army, homeland, Grand Campaign map and monster (`art/gallery.js`); `node tools/render-art.js --gallery` exports them to `art/gallery/` plus the contact sheet `art/gallery.png`. The renderer needs the canvas package's `icudtl.dat` next to the working directory or the Node binary for text to render.
