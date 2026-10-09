# Castle Capture

A medieval real-time strategy game that runs in the browser. Choose one of five armies, march tiny soldiers between castles, claim unclaimed keeps, and conquer rival kingdoms.

## Play

Open `index.html` in any modern browser. There's no build step and nothing to install.

## The five armies

Each army has its own castles, banners, soldiers, homeland map, strengths, special power, and AI personality when it's your rival.

| Army | Role | Strength | Special power | Homeland | As a rival |
|---|---|---|---|---|---|
| **The Azure Crown of Aldmere** (blue) | Defense | Defenders count as 1.45 soldiers | **Stone Oath:** defenders count double for 20s | The Vale of Aldmere | Defensive |
| **The Kharzul Horde** (red) | Attack | Riders 30% faster, strike 1.12×; 0.9 in road battles, palisades defend at 0.9, slowed badly by forests | **Blood Moon Charge:** troops move 2× and hit 1.5× for 15s | The Red Steppe | Very aggressive |
| **The Jarls of Frostmark** (teal) | Defense | 1.45× in road battles, castles defend at 1.4; 5% slower, barely slowed by forests | **Winter's Grip:** every enemy soldier in the field freezes for 12s | The Frostmark Fjords | Very defensive |
| **The Sun Dominion of Solmara** (gold) | Balanced | Soldiers fight at 0.9; relies on the Golden Tithe | **Golden Tithe:** castles train twice as fast for 15s | The Sunscorched Sands | Balanced |
| **The Nyxhollow Covenant** (violet) | Attack | Attacks on unclaimed keeps count 1.35×; strike 1.12× | **Plague of Crows:** the 3 largest enemy castles lose 40% of their garrison | Nyxhollow Mire | Aggressive and cunning |

Special powers are ready 45 seconds into a battle, then recharge for 5 minutes. The timings live in `FIRST_CHARGE` and `RECHARGE` at the top of the script.

## Rival lords

Each army is commanded by a named lord when it's your rival. They introduce themselves before the battle, taunt you when castles change hands or they use their power (taunts can be turned off in the menu), and get the last word on the end screen. Each lord's quirks sit on top of their army's AI personality.

| Lord | Army | How they play |
|---|---|---|
| **Queen Isolde Varr**, the Mason Queen | Aldmere | Keeps her front-line castles topped up before attacking, saves Stone Oath until two castles are under attack, and advances one castle at a time once she outnumbers you 2 to 1. |
| **Khagan Torvek Ash-Mane**, the Red Wind | Kharzul | Hammers the strongest rival's biggest castle, opens his attacks with Blood Moon Charge, and never reinforces. |
| **Jarl Sigrun Ironfrost**, the White Wall | Frostmark | Holds her army home early, freezes big attacks with Winter's Grip and then counter-attacks the castles they came from, and intercepts columns marching on nearby keeps. |
| **Sultan Amaru al-Zahir**, the Golden Hand | Solmara | Expands fastest in the first minute, bribing unclaimed keeps (they count 1.6×) and claiming only keeps on his side of the map, opens the treasury right after a wave of captures, and avoids even fights. |
| **The Hollow Matron Veyra**, Mother of Crows | Nyxhollow | Pounces on castles you've just emptied, looses the crows right before her main attack, and takes keeps near you to box you in. |

## Coins and map units

Every castle you hold earns coins each minute: small castles 1, medium 2, large 3. Coins build up slowly, so they pay off late in a battle. Spend them on **one map unit per battle**, placed on the map near your castles. Open the shop from the Treasury panel at the top right, or press **B**.

| Map unit | Type | Price | Range | Effect |
|---|---|---|---|---|
| **Ballista Tower** | Defensive | 40 | 120 | Fires bolts at enemy soldiers marching within range, killing about three troops a second |
| **Siege Trebuchet** | Offensive | 65 | 180 | Every 5 seconds, hurls a boulder at the enemy castle in range with the biggest garrison, knocking out 15% of its defenders |
| **Great Ward** | Support | 90 | 150 | Your castles inside train twice as fast and defend at 1.5x; enemy troops passing through march at half speed |

Map units can't be destroyed once placed, and a Great Ward only helps the kingdom that built it. AI lords save up for the unit that suits them. The prices and ranges live in `MAP_UNITS` and `COIN_PER_MIN` at the top of the script.

## How to play

- **Drag** from one of your castles to any castle to send troops.
- **Keys 1–4** or the **scroll wheel** choose how many to send: 25%, 50%, 75% or all.
- **Drag across** several of your castles to attack from all of them, or **tap** castles to select them and then tap a target.
- **Q** or the power panel in the top left of the map uses your army's special power. The panel shows the power's name, what it does, and a countdown until it's ready.
- **Upgrades:** select one of your castles to spend its troops on **Walls** (each level: defenders count 15% more, and the castle's archers shoot faster, farther and harder) or **Barracks** (each level: 8% faster training, and the soldiers it sends hit 12% harder, shown by a gold crest). Three levels each, costing 15 / 25 / 40 troops for a medium castle (0.8× small, 1.2× large). **U** and **I** upgrade every selected castle. A captured castle loses one level of each. Pips under the garrison count show a castle's levels.
- **Archers:** every castle a kingdom holds shoots at enemy columns marching past, so a small raid on a fortified castle can lose a third of its troops before it arrives.
- **Special castles:** about a quarter of the unclaimed keeps are special, marked by a badge beside the troop count and a detail on the map. A **fortress** (shield, outer rampart) counts every defender double. A **war camp** (crossed swords, tents) trains 60% faster, but its defenders count only 0.7. A **village** (cottage, houses) trains nothing, but its owner's castles within its dashed circle train 25% faster each (up to 50%). Captured castles keep their kind, and mirrored copies on the map always share a kind.
- **Rivers** can only be crossed at bridges, so troops march the long way round and bridges become chokepoints. **Forests** slow marching troops (Kharzul horses most, Frostmark woodsmen least). Routes follow the roads automatically, and while aiming you can see the exact route each column will take. The desert has neither.
- **Truces** (battles with three or more kingdoms): the **Diplomacy** button offers a rival lord a 90-second truce, and lords sometimes offer you one on a card you accept or refuse. Allies can't attack each other (columns already marching at an ally turn back home), allied columns pass on the road, archers and map units hold fire, and allied castles fly a white pennant. Each lord answers in character: Isolde accepts unless she's winning, Amaru accepts for 15 coins (and offers truces himself when second, as Isolde does), Sigrun only deals with someone stronger, Torvek always refuses, and Veyra always accepts, then breaks the truce about a minute later. AI lords make truces with each other too. A truce can't be renewed for 60 seconds after it ends.
- **Weather** drifts across each homeland in spells of a minute or so, between clear spells: **rain** on the vale (march 10% slower), **dust storms** on the steppe (15% slower, shorter sight), **snow** in the fjords (15% slower), **heat** (training 15% slower) or dust in the desert, **marsh fog** (half sight, 5% slower) or rain in the mire. The army whose homeland it is ignores its own weather. **Night** falls once every four-minute day and trains troops up to 10% slower. Sight effects matter under fog of war.
- **Fog of war** (optional, in the skirmish menu): you only see near your own castles and marching columns. Castles out of sight show the owner and garrison you last saw, greyed, and enemy columns in the fog are hidden. Send troops out to scout. The rival lords play by exactly the same rules.
- **Armies that meet on the road fight.** The stronger column marches on with what's left.
- **Red banners** over your castles count the enemy troops marching on them. A pulsing ring means the castle will fall unless you reinforce it.
- **Rivals surrender** when they hold under 10% of all troops and two castles or fewer for 8 seconds (after the first minute). Against one rival their castles open their gates to you; with two rivals they fall back to neutral.
- **Rally points:** right-drag (or Shift-drag, or long-press then drag on touch) from one of your castles to another, and its new troops march there automatically, leaving 5 at home. Right-click the castle to clear it; the route also breaks if either castle is lost.
- **Saving:** an unfinished battle is saved in your browser when you close or hide the tab, and every 10 seconds. Resume it from the banner at the top of the menu, or discard it. Retreating to the menu abandons the battle.
- **Upkeep:** a castle trains at half speed once its garrison passes twice its size, and a quarter speed past four times. An hourglass on its plaque shows when.
- **Bigger castles** train troops faster. Unclaimed keeps never grow. A captured castle is rebuilt in its new owner's style.
- **Space** selects all your castles. **[** and **]** (or the Speed buttons) change the game speed: 1×, 1.5× or 2×. **P** pauses. **M** mutes sound effects and **N** the music.

## Music

Each homeland has its own synthesised theme (no audio files): a lute-like air in the Vale of Aldmere, droning saws and frame drums on the Red Steppe, slow bells in the Frostmark Fjords, a Hijaz melody and hand drums in the Sunscorched Sands, and a beating drone in Nyxhollow Mire. The music swells with the fighting, adding drums and quicker, higher lines when armies are on the march, clashing, or using a special power. The Music button or **N** turns it on or off, separately from the sound effects.

## Achievements and records

Thirteen achievements, from First Blood and Lightning War (win in under 2 minutes) to Bane of Lords (beat every lord on Warlord) and Conqueror (capture 100 castles). New ones appear on the victory screen. The menu's achievements sheet also keeps your records: battles, wins and losses, fastest wins at each difficulty, castles captured, enemy troops destroyed on the road, and your record with each army and against each lord. Everything is saved in your browser.

## Accessibility

- **Colour-blind mode** (menu, or **C**) switches the armies to a colour-blind-safe palette and puts each army's emblem (crown, moon, snowflake, sun, eye) on its garrison plaques and above its marching columns, so kingdoms can be told apart by shape.
- **Keyboard play:** **Tab** and **Shift+Tab** move between your castles, the **arrow keys** move to the nearest castle in that direction, **Enter** selects your castle or sends your selected troops to an enemy or unclaimed castle, and **Shift+Enter** sends them to any castle, including your own.
- **Touch and phones:** pinch with two fingers to zoom (up to 3×) and drag them to pan; **Fit** shows the whole map again. Ctrl+scroll (or a trackpad pinch) zooms on desktop. Castles have larger tap areas for fingers, and phones and touch screens get a thumb bar with big **Power**, **Send %**, **All** and **Fit** buttons.
- **Screen readers** hear the focused castle, captures, special powers, map units, surrenders and the result.

## Tutorial

New players are offered a short guided battle on first launch, and it's always available from the menu under **Learn to play**. Seven lessons, each waiting until you've done it: sending troops, choosing how many, attacking from several castles, reading red banners and reinforcing, intercepting a column on the road, using your special power, and finally winning the battle. Gold rings mark what to click; the lesson card can be folded down or a lesson skipped. Tutorial battles aren't saved and don't count towards achievements.

## Modes

- **Skirmish:** Pick your rival (or a random one), 1 or 2 rivals, and whether to invade their homeland or defend yours. Difficulty is Squire, Knight or Warlord.
  - **Custom battle settings** (in the Skirmish menu): number of castles, map size, starting troops, how strong unclaimed keeps are, troop speed and power recharge time, with **Quick brawl**, **Standard** and **Long war** presets. The end screen shows the map seed; type it into the settings to replay the same map.
- **Campaign:** Eight battles across the rival homelands, from Thornbury to the High Throne. Each win unlocks the next.

See the [issues](https://github.com/jackgary86-dev/CastleCapture/issues) for planned improvements.

## Code layout

The game has no build step. `index.html` holds the markup and CSS and loads five plain scripts that share the page's global scope, in this order:

| File | What it holds |
|---|---|
| `js/data.js` | Constants, the five armies and their lords, homeland themes, campaign levels, utilities, and the event bus (`on` / `emit`) |
| `js/sfx.js` | Synthesised sound effects and music |
| `js/sim.js` | Map generation, battle state, army stats and powers, the AI lords, coins and map units, and the simulation step. No DOM access: it reports what happens through `emit()` |
| `js/render.js` | Canvas drawing and the view state the input writes (`ptr`, `sel`) |
| `js/ui.js` | HUD, power panel, treasury, input, menus, saving, the frame loop, and the listeners that turn simulation events into sound and banners |

## Balance tests

`tools/balance.js` runs the simulation headlessly in Node: every army fights every other with the AI on both sides, and the run fails if any army's win rate leaves the agreed band.

```bash
node tools/balance.js --games 8
```

Options: `--games N` per pairing, `--diff easy|medium|hard`, `--seconds` cap per battle, `--band 0.25,0.75`, `--json`. Runs are seeded, so the same arguments always give the same result. GitHub Actions runs it on every push and pull request (`.github/workflows/balance.yml`).

## Smoke test

The balance test only loads `js/data.js` and `js/sim.js`, so it can't see mistakes in the UI files. `tools/smoke.js` loads every script `index.html` loads, in the same order and sharing one global scope, with stand-in browser objects. It then plays two battles through the menu path, draws frames, saves, resumes and finishes a battle, and fails on any exception. That catches using a name before the file that defines it has run, two files declaring the same top-level name, and HUD or drawing code that throws.

```bash
node tools/smoke.js
```

CI runs it before the balance test. It still isn't a substitute for opening the game in a browser, since the stand-ins accept anything.

## Art

`art/launch-bg.js` paints the launch background procedurally (a dusk valley with the five homelands' castles), seeded so it renders identically everywhere. Open `art/launch-bg.html` to see it fill the window, or export PNGs with `node tools/render-art.js` after a one-off `npm install @napi-rs/canvas`. The exported `art/launch-bg.png` (1920×1080) and `art/launch-bg-3840x2160.png` are checked in.

`art/gallery.html` shows one painted panel for each army, homeland, Grand Campaign map and monster (`art/gallery.js`); `node tools/render-art.js --gallery` exports them to `art/gallery/` plus the contact sheet `art/gallery.png`. The renderer needs the canvas package's `icudtl.dat` next to the working directory or the Node binary for text to render.

The main menu's **Armies and monsters** section (`js/codex.js`) shows the same paintings as cards; each opens a codex entry with the army's story, strength, stats, special power, personality, homeland and lord, or the monster's story, abilities, bounty and how to beat it.
