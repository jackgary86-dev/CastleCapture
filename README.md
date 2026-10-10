# Castle Siege

A medieval real-time strategy game that runs in the browser. Choose one of five armies, march tiny soldiers between castles, claim unclaimed keeps, and conquer rival kingdoms: in a quick skirmish, a story campaign told by the lords themselves, the Grand Campaign with all five armies on one great map, or one of three shorter modes (King of the Hill, Siege Defense and Capture the Crown).

## Play

Open `index.html` in any modern browser. There's no build step and nothing to install.

### Install on Windows

To get a Start menu and desktop shortcut, double-click `install/Install Castle Siege.cmd`. The installer (`install/install.ps1`) needs no admin rights. It copies `index.html`, `js/` and the two art scripts the page loads to `%LOCALAPPDATA%\Programs\Castle Siege` (the PNGs stay behind), and the shortcuts open it in its own Edge app window, or in the default browser if Edge is missing. It also lists the game under Settings > Apps, which runs the copied `uninstall.ps1` to remove the shortcuts, the entry and the folder. Run from PowerShell, `install.ps1` takes `-Destination <folder>` to install elsewhere and `-NoShortcuts` to skip the shortcuts.

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
- **King of the Hill:** a race to hold the crowned keep at the centre of the map.
- **Siege Defense:** hold a five-castle fortress against ever bigger waves from up to three lords, with a score, a daily siege and a best-wave record.
- **Capture the Crown:** a scouting and bluffing duel under fog of war: hide your crown, find your rival's with scouts, and take the castle that holds it.
- **Deeper strategy** (on by default in skirmishes): castle branches, supply lines, hills, fords and roads, and champions.
- **Smarter lords** who form coalitions, hold grudges, read your style and vary their openings.
- **Alternate lords:** a second lord for each army, bought with renown.
- **Tutorial:** a guided first battle in seven lessons.
- **Achievements and records**, kept in your browser.
- **Renown and a profile**: earn renown in every mode, spend it on banners, roof colours, starting map units and alternate lords, and claim the Grand Campaign maps on a realm map that runs in seasons.
- **Feel:** army voices, war drums, dust, cracked walls, a little screen shake and a victory cinematic.
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
| **The Sun Dominion of Solmara** (gold) | Balanced | Soldiers fight at 1.05; relies on the Golden Tithe | **Golden Tithe:** castles train twice as fast for 15s (1.3× on a big map) | The Sunscorched Sands | Balanced |
| **The Nyxhollow Covenant** (violet) | Attack | Attacks on unclaimed keeps count 1.25×; strike 1.12× | **Plague of Crows:** the 3 largest enemy castles lose 40% of their garrison | Nyxhollow Mire | Aggressive and cunning |

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

### Alternate lords

Each army has a second lord (`LORDS_ALT` in `js/data.js`), bought for 120 renown on the Profile page and then picked on the army card. Once you own one, a rival army has an even chance of fielding them too, except in story chapters, the tutorial, player 2's seat and the daily siege's rivals, which always have the usual lords. Each plays by another lord's tactics with personality numbers of their own, has their own lines and portrait, and puts a twist on the army's power:

| Lord | Army | How they play | Power twist |
|---|---|---|---|
| **Prince Corwin Varr**, the Lance of Aldmere | Aldmere | Lets you break on his walls, then counter-attacks the castles you came from (Sigrun's tactics) | Stone Oath lasts 12 s instead of 20, but is ready again 30% sooner |
| **Ilkai Two-Winds**, the Patient Arrow | Kharzul | Circles, then pounces on castles you have just emptied; agrees to every truce and keeps none (Veyra's tactics) | Blood Moon lasts 21 s instead of 15, but rises 30% later |
| **Bjorn Avalanche**, the Breaking Ice | Frostmark | Picks the strongest castle in sight and keeps hitting it (Torvek's tactics) | Winter's Grip lasts 9 s instead of 12 |
| **Vizier Zahra al-Qadir**, the Silver Tongue | Solmara | Talks unclaimed keeps over in the first minute and turns the realm on its leader (Amaru's tactics, bolder numbers) | Golden Tithe lasts half as long again, but comes round 25% later |
| **Morwen the Pale**, the Drowned Saint | Nyxhollow | Keeps the castles facing you full and creeps forward once ahead (Isolde's tactics) | The crows take 30% instead of 40%, but fly again 20% sooner |

`tools/balance.js --lords alt` plays every seat with its alternate (the default, `--lords base`, the usual lords).

They also remember and adapt (`js/mind.js`):

- **Coalitions:** when one realm holds 40% of all the troops on the map, the other lords make peace with each other and turn on it. A banner announces it, and against another lord the player is offered a place in it. The truces break once the leader falls below 30%.
- **Grudges:** a lord remembers who took its castles and who broke a truce with it, wants that realm's castles more, and tells you when it has had enough of you. Grudges fade slowly and are kept in saved games.
- **Reading you:** a lord notices if you rush (it keeps more troops home) or turtle behind upgrades (it expands faster).
- **Openings:** each lord has two or three named openings and picks one per battle (Isolde's *Stone by stone*, Torvek's *Red dawn*, Veyra's *Whispering mire*...), so the same lord plays differently from game to game. The Grand Campaign keeps its own opening rule.

None of this plays in King of the Hill, Siege Defense or Capture the Crown, where the lords have tactics of their own for the mode. Open the game with `?aidebug` in the address (or set localStorage `cs-ai-debug` to `1`) for an overlay of each lord's opening, current target and grudges. `tools/balance.js --set mind.on=0` (or `mind.openings=0`, `mind.grudgeWeight=0`...) measures any of it switched off.

## Modes

- **Skirmish:** pick your rival (or a random one); 1 rival, 2 rivals, or a free-for-all against all four; and whether to invade their homeland or defend yours. Difficulty is Squire, Knight or Warlord. In battles with three or more kingdoms, nobody may attack another kingdom for the first 25 seconds while the armies muster. The Skirmish menu also has toggles for fog of war, map events, two players and lord taunts.
  - **Custom battle settings:** number of castles, map size, starting troops, how strong unclaimed keeps are, troop speed, power recharge time and garrison cap, with **Quick brawl**, **Standard** and **Long war** presets, and the four [Deeper strategy](#deeper-strategy) switches. A map with more than 10 castles a kingdom (the Long war preset, Capture the Crown) is a big map: the lords keep at most 6 troops at home and the Golden Tithe trains 1.3× instead of double (`BIG_MAP` in `js/data.js`). The end screen shows the map seed; type it into the settings to replay the same map.
- **Two players:** turn on **Two players** in the Skirmish menu and a second player takes the rival army on the same keyboard (see [Controls](#controls)). Fog of war and Deeper strategy are off for two players, and there is no end cinematic. Skirmish only.
- **Campaign:** each army has its own **story campaign** of five chapters, told in the lords' voices on a parchment screen before each battle and ending in a showdown with one rival. Chapters have their own objectives (hold out for a time, take one named castle, or start outnumbered) shown on a badge during the battle. Each win unlocks the next chapter, and progress is kept per army.
- **Grand Campaign:** all five armies on one great map, played in waves. In the plan phase nothing moves while you queue orders (sends, your power, map units); press **March** and every kingdom's orders launch at once for a 20-second march. Rival realms surrender once they fall below 35% of the strongest realm's troops (not before wave 20; from wave 120 that share rises a point a wave, up to 90%, so a long standoff ends). The treasury has no cap. Save to five slots, or export and import a save file, from the pause menu; **Continue** on the menu picks up the latest. The realm is bigger than the screen: it opens zoomed in on your home castle (see [Controls](#controls) for panning and zoom).
  - **Map monsters:** four maps, each with a monster (`js/monsters.js`, data in `MONSTERS` and `GRAND_MAPS`): **the Wyrm of the Wastes** on **The Five Realms**; **Vaelthyr the Red**, the dragon of **The Scorched Reach**, which flies between its lair and the keeps and breathes fire on the nearest column or castle where it lands, burning a fifth of it; **Old Grom of the Fells**, the cyclops of **The Giant's Fells**, which follows the roads (its route is drawn a wave ahead) and smashes a castle it walks into, losing it 30% of its garrison and an upgrade level, and sleeps where it stops (troops that catch it asleep strike 1.5×); and **the Blackwood Five**, the bandit gang of **The Blackwood Marches**, five captains who ambush columns among the trees, raid castles for a quarter of their coins, and heal at a camp that a big enough force can overrun. A monster wanders between the castles during each march, stands still between waves, and bites any column that strays within reach. Drag troops onto it to fight it: every troop deals 1 damage a second and the monster kills troops at its own rate, shared across everyone fighting it. Its health bar shows each army's share of the damage, and **whoever lands the final blow takes the whole bounty** (150 coins for the Wyrm, 180 for Vaelthyr, 220 for Old Grom; each bandit captain pays 50 and the last one 150 more; the others get 10% of their damage back). It regenerates when left alone, respawns ten waves after a kill with a warning the wave before, and the lords ignore it while healthy, hunt it only with troops to spare, and swarm it below a quarter health.
- **King of the Hill** (under **Modes** on the menu): a short race of five to twelve minutes against 1, 2 or all 4 AI lords. A crowned keep stands at the centre of the map (on dry ground: no rivers in this mode). It is large, its walls count 1.5×, and it can't be upgraded. Whoever holds it scores a point a second, shown for every realm on a score bar in the header; the first to 300 wins, and after 12 minutes the most points wins. Each kingdom's starting castle is its seat (gold pennant): it can be emptied but never taken, so nobody is knocked out of the race and nobody surrenders. A banner calls out the leader, and at 250 points every lord turns on them. The lords know the rule: **Torvek** rushes the hill, **Isolde** takes the keeps beside it and counter-takes it right after someone else has paid for it, **Amaru** builds a Ballista Tower next to it, **Veyra** waits for the holder to bleed and then strikes, and **Sigrun** freezes the holder's columns with Winter's Grip while hers close in. Records keep your best time to 300 for each army. Rules in `js/hill.js` (numbers in `HILL` in `js/data.js`), the menu, score bar and crown in `js/hill-ui.js`; `node tools/balance.js --mode hill` checks every army's win rate.
- **Siege Defense** (under **Modes** on the menu): a solo survival mode. You hold a fortress of five castles on the west edge (at the bottom on a tall phone screen, where the map turns); up to three rival lords muster at siege camps on the far edge (they can't be taken) and attack in timed waves, a second lord joining at wave 4 and a third at wave 7. Every wave is bigger than the last and adds a trick: **catapults** with a foot escort from wave 4, a **cavalry flank** against the castle furthest from the main blow from wave 6, and from wave 10 a **siege beast**, one huge column whose every soldier strikes three times as hard, aimed at your biggest garrison. Castles the lords take send most of their garrison with the next wave. After each wave you beat come **20 seconds** (or press **Next wave**) and a **coin payout**, more for each unclaimed keep you hold, to spend on **Walls** and **Barracks** (with coins, from the castle panel, or troops as usual) and **map units** (another after every wave, up to two standing). The **score** is the waves survived plus the castles you held when the last of them was beaten; the siege ends when your last castle falls. The **Daily siege** uses a fixed seed for the calendar day (the same homeland and waves for everyone, at Knight; the lords are drawn from the day and your army) and keeps your best score for each day in this browser. The menu card shows your most waves held, and achievements unlock at waves 10, 20 and 30. Rules and their numbers in `js/defense.js` (`DEFENSE`), interface in `js/defense-ui.js`.
- **Capture the Crown** (under **Modes** on the menu): a duel against one AI lord, fought on the lord's homeland on a large map (30 castles, 1.6× the size of a standard battle, so a big map) and always under fog of war. Each crown starts in its realm's seat; in the first 30 seconds you can hide yours in any castle you hold, free and unseen (select the castle, then **Hide your crown here** in the castle panel). Take the castle that holds the lord's crown and you win; lose the castle that holds yours and you lose. **Scouts**, a troop button of this mode (**T** doesn't cycle to them), cost 2 troops from your nearest castle and look inside a castle without attacking it; capturing a castle also shows whether a crown was there. After the opening, moving your crown costs 15 coins (every realm starts with 15) and takes 20 seconds on the road, escorted by your send % of its garrison: whoever destroys that column takes the crown. The lords guess where crowns are from how heavily castles are held, so a fat decoy garrison draws them, and each plays it in character (Isolde walls hers in, Torvek never moves his and sends no scouts, Amaru scouts the most and keeps his moving, Veyra keeps a decoy). After 10 minutes the heralds reveal every crown. The crown bar in the header shows what you know of both crowns. Rules and their numbers in `js/crown.js` (`CROWN`, and `crownCfg` for the setup), interface in `js/crown-ui.js`.
- **Learn to play:** the tutorial (see below).

## Controls

### Player 1 (mouse, touch and keyboard)

| Action | Mouse / touch | Keyboard |
|---|---|---|
| Send troops | Drag from your castle to any castle | Select, move focus to the target, **Enter** (**Shift+Enter** to send to your own castle) |
| Attack from several castles | Drag across them, or tap to select then tap the target | **Space** selects all your castles |
| How many to send | Scroll wheel; **Send %** on the thumb bar | **1**–**4**: 25%, 50%, 75%, all |
| Troop type | Troops buttons in the header (plus **Scouts** in Capture the Crown) | **T** cycles foot, cavalry, catapults |
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
| Sound effects / music | Sound and Music buttons; **Sound** sliders on the menu and pause sheet | **M** / **N** |
| Colour-blind mode | Menu toggle | **C** |
| Call the next wave early (Siege Defense) | **Next wave** button beside Pause | |
| Skip the end cinematic | Click or tap it | Any key (Ctrl, Cmd and Alt shortcuts pass through to the browser) |

In a two-player game **T**, **Shift+1**–**Shift+4**, and **Y** / **N** while player 2 has a truce offer, belong to player 2.

### Grand Campaign

| Action | Mouse / touch | Keyboard |
|---|---|---|
| March (end the plan phase) | **March** button | **Enter** (**Ctrl+Enter** while the keyboard cursor is in use) |
| Pan the realm | Drag empty ground, or two fingers | **W A S D** |
| Zoom | **+**, **−** and **Fit** buttons above the minimap; Ctrl+scroll or pinch | **+** / **-** to zoom, **0** to fit the whole realm |

While the armies march, **Q**, **U**, **I** and **B** wait for the next plan phase.

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

Each homeland has its own synthesised theme (no audio files): a lute-like air in the Vale of Aldmere, droning saws and frame drums on the Red Steppe, slow bells in the Frostmark Fjords, a Hijaz melody and hand drums in the Sunscorched Sands, and a beating drone in Nyxhollow Mire. The music swells with the fighting, adding drums and quicker, higher lines when armies are on the march, clashing, or using a special power. A snare joins on the backbeat once the fighting is real, with tom rolls when it is fiercest, and the main menu has a stately theme of its own. The Music button or **N** turns it on or off, separately from the sound effects, and the **Sound** sliders on the menu and the pause sheet set the overall, effects and music volume.

## Deeper strategy

Skirmishes add four layers of strategy (`js/strategy.js`, numbers in `STRATEGY`), all on by default and each switched on or off under **Custom battle settings → Deeper strategy**. Two-player games play without them.

- **Castle branches.** Once a castle has an upgrade (of its Walls or Barracks) it can become, for good, a **Keep** (defenders count 25% more and it holds 40% more), a **Barracks** (trains 30% faster) or a **Market** (2.5× the coins, 10% slower training), for 10, 15 or 20 coins by its size. Pick one from the castle panel; each shows as a badge beside the garrison. The rival lords specialise their own castles, Keeps facing the enemy and the rest Barracks or Markets.
- **Supply lines.** Supply runs out from your capital (your starting castle, or your biggest once it falls) from castle to neighbouring castle, through your own castles. A castle more than three castles away from that chain is cut off, shows a broken chain, and trains at half speed, so a deep raid needs castles behind it.
- **Terrain.** A quarter of the unclaimed keeps, in matching sets so every kingdom gets the same, stand on hills, where defenders count 25% more. Columns wade river crossings at 60% speed and march 20% faster on the roads.
- **Champions.** Each lord's champion waits in a castle (at first, your capital) and rides out with the first attack of 6 or more troops sent from it: every column of that attack strikes 30% harder, and the first carries the champion's standard. While waiting in a castle the champion stiffens its defenders by 20%. Win, and the champion holds the castle taken; fail, or lose the castle the champion waits in, and they fall, returning after 90 seconds at your strongest castle.

## Feel

Each army sounds like itself: Aldmere's steel rings, Kharzul's horde clatters on hoof and horn, Frostmark's shields thud, Solmara's brass is bright and Nyxhollow's notes slide, both in a clash and in the call that sounds when a castle changes hands. Marching columns kick up dust, a captured castle throws sparks in its new colours as the banner changes, walls crack and rubble falls on a castle attacked in the last 25 seconds whose garrison is below 40% of what it holds, and scaffolding goes up round a castle being upgraded. Big clashes you are part of shake the board a little, and in the Grand Campaign the camera glides to the monster when it strikes somewhere off screen. A battle ends with a short cinematic (the winning army's banner unfurls, its lord appears and has a last word; click or press any key to skip, except Ctrl, Cmd or Alt shortcuts), except in two-player games and Siege Defense, and the end screen shows a sparkline of your share of all troops from start to finish. With reduced motion set in your system, the dust, sparks, shake and camera glides are left out and the cinematic stands still; cracks and scaffolding stay. The battle effects are drawn in `js/render.js`, the rest in `js/juice.js`, and the sounds in `js/sfx.js`.

## Achievements and records

Twenty-seven achievements. Thirteen are for battles, from First Blood and Lightning War (win in under 2 minutes) to Bane of Lords (beat every lord on Warlord) and Conqueror (capture 100 castles); five are for the Grand Campaign (Crowned, Emperor, Lord of Every Land, Monster Slayer and Beast Hunter), and King of the Hill has three (King of the Hill, Unshaken and Every Crown). New ones appear on the victory screen. The menu's achievements sheet also keeps your records: battles, wins and losses, fastest wins at each difficulty, castles captured, enemy troops destroyed on the road, Siege Defense games, most waves held and best score, and your record with each army and against each lord. Siege Defense has three of its own, Hold the Line, Unbroken and The Last Bastion, for surviving 10, 20 and 30 waves; they unlock the moment the wave is beaten. Capture the Crown has three more, Crown Thief (win a raid), Highway Robbery (seize a crown from its column on the road) and Sleight of Hand (win without rival scouts ever finding your crown), and its raids won and crowns taken are kept with the records. Everything is saved in your browser.

## Renown and the profile

Every game pays renown (`RENOWN` in `js/progress.js`): more for harder difficulties and for longer modes (a Warlord battle won pays 20, a Warlord Grand Campaign won 120, Siege Defense 2 a wave held), a little for a loss, 15 for each achievement and 10 for the killing blow on a map monster. Two-player games and the tutorial pay nothing. The victory screen shows what a game paid. A profile that already has achievements and wins starts with renown for those past deeds.

**Profile** on the menu spends it. Banners (any army's banner shape) and roof colours are cosmetic skins for your castles. [Alternate lords](#alternate-lords) cost 120 each. A starting map unit stands beside your home castle at the start of every skirmish and uses up that battle's one map unit. Winning a Grand Campaign claims its map on the **realm map**: each region claimed this season adds 4 troops to your home castle in later Grand Campaigns, at most 12. Both gameplay unlocks have a switch on the profile page, and the headless balance runner never sees them. Beginning a new season clears the realm map and keeps the old one in the hall of fame. The profile is saved in your browser and can be exported to a file and imported again.

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
| `js/data.js` | Constants, the five armies and their lords (`LORDS`) and alternate lords (`LORDS_ALT`), homeland themes and weather, troop types, castle kinds, map units, Grand Campaign (`GRAND`) and King of the Hill (`HILL`) settings, big-map rules (`BIG_MAP`), the map monsters and Grand Campaign maps, utilities, and the event bus (`on` / `emit`) |
| `js/campaigns.js` | The story campaigns' chapters: maps, setups, objectives and story text. Pure data |
| `js/sfx.js` | Synthesised sound effects and music: each army's voice, the homeland themes, war drums, the menu theme and the three volume channels |
| `js/sim.js` | Map generation and terrain, battle state, army stats and powers, fog of war, weather, truces, surrender, the AI lords, coins and map units, and the simulation step. No DOM access: it reports what happens through `emit()` |
| `js/grand.js` | The Grand Campaign's rules: the five-realm map and the wave loop. No DOM access |
| `js/hill.js` | King of the Hill rules: scoring the crowned keep, seats, the race's end, each lord's tactics for the hill, and `hillCfg`. No DOM access |
| `js/strategy.js` | Deeper strategy rules (`STRATEGY`): castle branches, supply lines, hills, fords and roads, champions, the lords' branch picks, and `strategyWorthMul` for the AI. Off unless a battle's `cfg.strategy` turns it on. No DOM access |
| `js/defense.js` | Siege Defense's rules (`DEFENSE`): the fortress map (turned on portrait screens), the waves and their twists, payouts, coin upgrades, the daily seed and `defenseCfg`. No DOM access |
| `js/crown.js` | Capture the Crown rules (`CROWN`): hiding and moving crowns, scouts, knockouts, the heralds' reveal, each lord's guessing, scouting and bluffing, and `crownCfg`. No DOM access |
| `js/render.js` | Canvas drawing and the view state the input writes (`ptr`, `sel`), including the dust, capture sparks, cracked walls and scaffolding |
| `js/ui.js` | HUD, power panel, treasury, troop types, diplomacy, input, menus, Custom battle settings, saving, the frame loop, and the listeners that turn simulation events into sound and banners |
| `js/grand-ui.js` | The Grand Campaign's planning screen, orders list, March button, camera panning, zoom buttons, minimap, save slots, and export and import |
| `js/achievements.js` | Achievements and personal records |
| `js/progress.js` | Renown (`RENOWN`), the unlocks, alternate-lord picks and the realm map's seasons, saved under `cs-progress`. No DOM access |
| `js/progress-ui.js` | The Profile page (renown, shop, realm map, hall of fame, export and import), the renown line on the end screen, and the banner and roof skins render.js asks for |
| `js/access.js` | Colour-blind mode, keyboard play and screen-reader announcements |
| `js/touch.js` | Pinch-zoom and pan camera, larger touch targets and the thumb bar |
| `js/monsters.js` | Grand Campaign map monsters: movement, fighting, bounties, each monster's special, the lords' hooks, and their drawing. Its simulation half has no DOM access |
| `js/mind.js` | Smarter lords (`AI_MIND`): coalitions against a runaway leader, grudges, reading the player's style, and each lord's openings. No DOM access |
| `js/mind-ui.js` | The coalition banners and the `?aidebug` overlay |
| `art/launch-bg.js`, `art/gallery.js` | Procedural paintings: the launch background and the army and monster panels |
| `js/menu-art.js` | Paints the launch background behind the main menu |
| `js/grand-menu.js` | The menu's Grand Campaign section: map cards, Begin, Continue and the saved-games sheet |
| `js/modes-ui.js` | What the three Modes cards share (`modeUi`): picking rivals, the card and header helpers and the crown icon |
| `js/hill-ui.js` | King of the Hill menu card (under Modes), the header score bar, leader banners, the crown over the keep and the end screen |
| `js/defense-ui.js` | Siege Defense in the browser: the Modes menu card, wave line, Next wave button, coin upgrades, siege beast and end screen |
| `js/crown-ui.js` | Capture the Crown in the browser: the Modes menu card, the crown bar, the Scouts button, hiding and moving your crown from the castle panel, crown marks on the map, banners and the end screen |
| `js/events.js` | Random map events and their menu toggle |
| `js/story.js` | The story campaign ladder, story screens, objective badge and progress |
| `js/twoplayer.js` | Two players on one screen: player 2's keyboard controls, panel and truce cards |
| `js/codex.js` | The Armies and monsters cards and codex entries |
| `js/tutorial.js` | The guided first battle |
| `js/strategy-ui.js` | Deeper strategy in the browser: the Custom battle switches, the branch buttons on the castle panel, the hill, branch, broken-chain and champion badges, the champion's standard, and the champion's banners |
| `js/juice.js` | Feel (#69): the shake on big clashes, the Grand camera following the monster, the victory and defeat cinematic, the end-screen sparkline and the volume sliders. Loads last |

`data.js`, `campaigns.js`, `sim.js`, `grand.js`, `hill.js`, `strategy.js`, `defense.js`, `crown.js`, `mind.js`, `progress.js` and the simulation half of `monsters.js` never touch the DOM. `tools/balance.js` loads `data.js`, `sim.js`, `grand.js`, `hill.js`, `strategy.js`, `defense.js`, `crown.js`, `monsters.js` and `mind.js` directly (never `progress.js`, so no profile unlock reaches its results). The files after `ui.js` only hook into what loads before them.

| Folder | What it holds |
|---|---|
| `art/` | The launch background and gallery painters, their HTML viewers, and the exported PNGs |
| `install/` | The Windows installer (`Install Castle Siege.cmd`, `install.ps1`), `uninstall.ps1` and the shortcut icon |
| `tools/` | `balance.js` (headless balance test), `smoke.js` (loads the whole page headlessly), `render-art.js` (exports the paintings to PNG) |

## Balance tests

`tools/balance.js` runs the simulation headlessly in Node: every army fights every other with the AI on both sides, and the run fails if any army's win rate leaves the agreed band.

```bash
node tools/balance.js --games 8
```

Options:

- `--games N` games per pairing (default 4), `--diff easy|medium|hard` (default `hard`, Warlord), `--seconds` cap per battle (default 600), `--band 0.33,0.67` the win band (the default), `--json` for machine-readable results, and `--fps` the simulation step (default 60, as in the game; coarser is faster but skews road battles).
- `--castles N` and `--scale X` play the ordinary battles on another map size (the Long war preset is 26 and 1.25).
- `--strategy on` plays the battles with every deeper-strategy feature switched on, `off` (the default) without, and a list such as `--strategy spec,terrain` with just those (`spec`, `supply`, `terrain`, `heroes`).
- `--lords alt` seats every army's alternate lord in every game; `--lords base` (the default) the usual lords.
- `--set key=value,...` changes settings for one run without editing the code: a `GRAND` setting (`--set surrenderShare=0.3,siegeSources.hard=10`), `mind.<key>` for the smarter lords (`--set mind.on=0`, `mind.openings=0`, `mind.grudgeWeight=0`...), or `strategy.<key>` for Deeper strategy (`--set strategy.supplyHops=3`).
- `--mode hill` races every pairing for the crowned keep of King of the Hill instead (each race ends at 300 points or the 12-minute cap, so every game counts) and checks the same band.
- `--mode defense` seats the AI in the Siege Defense fortress for every army and reports the median waves survived per army; it fails if any army's median is more than `--spread` (default 0.4) from the overall median. The target is 8–15 waves on Warlord.
- `--mode crown` plays every pairing of Capture the Crown to the last crown (games still running at `--seconds`, here default 1500, are undecided) and checks the same band.
- `--mode grand` plays Grand Campaigns with five AI lords and reports how long they run, without a pass or fail on balance; `--map realm|scorched|fells|blackwood` picks the map (default `realm`; `all` cycles them).
- `--seed N` is the first seed for `--mode grand` and `--mode defense` (default 7000).

Runs are seeded, so the same arguments always give the same result. GitHub Actions runs the smoke test and then `--games 8` on Warlord and on Knight on every push to `main` and every pull request (`.github/workflows/balance.yml`).

## Smoke test

The balance test only loads the simulation files, so it can't see mistakes in the UI files. `tools/smoke.js` loads every script `index.html` loads, in the same order and sharing one global scope, with stand-in browser objects. Then it:

- plays a battle through the menu path, draws frames, saves, resumes and finishes it;
- checks progression: the win pays renown, and buying a banner, a roof and a starting unit charges the right amount;
- forms a coalition against a runaway leader and has a lord voice a grudge;
- buys an alternate lord, picks it on the army card and plays a battle with it;
- plays a King of the Hill race, saved and resumed, then won, lost and timed out;
- plans, marches, saves and loads Grand Campaign waves, and fights the monster on every map through a save and load;
- plays Siege Defense through three waves, a save and resume, and the fall of the last castle, and lays it out on a portrait screen;
- plays a Capture the Crown raid: hiding, scouting, a crown move saved and resumed on the road, a win, and a crown lost on the road;
- plays a Deeper strategy battle with a branch, a cut-off castle, a hill and a champion who falls and returns;
- checks that a standard river map builds in under 150 ms (the median of five builds after a warm-up).

It fails on any exception. That catches using a name before the file that defines it has run, two files declaring the same top-level name, and HUD or drawing code that throws. The Grand Campaign and King of the Hill runs are seeded; set `SMOKE_SEED` to play another seed.

```bash
node tools/smoke.js
SMOKE_SEED=5 node tools/smoke.js
```

CI runs it before the balance test. It still isn't a substitute for opening the game in a browser, since the stand-ins accept anything.

## Art

`art/launch-bg.js` paints the launch background procedurally (a dusk valley with the five homelands' castles), seeded so it renders identically everywhere. Open `art/launch-bg.html` to see it fill the window, or export PNGs with `node tools/render-art.js` after a one-off `npm install @napi-rs/canvas`. The exported `art/launch-bg.png` (1920×1080) and `art/launch-bg-3840x2160.png` are checked in.

`art/gallery.html` shows one painted panel for each army, homeland, Grand Campaign map and monster (`art/gallery.js`); `node tools/render-art.js --gallery` exports them to `art/gallery/` plus the contact sheet `art/gallery.png`. The renderer needs the canvas package's `icudtl.dat` next to the working directory or the Node binary for text to render.
