# Castle Capture

A medieval real-time strategy game that runs in the browser. Choose one of five armies, march tiny soldiers between castles, claim unclaimed keeps, and conquer rival kingdoms.

## Play

Open `index.html` in any modern browser. There's no build step and nothing to install.

## The five armies

Each army has its own castles, banners, soldiers, homeland map, strengths, special power, and AI personality when it's your rival.

| Army | Role | Strength | Special power | Homeland | As a rival |
|---|---|---|---|---|---|
| **The Azure Crown of Aldmere** (blue) | Defense | Defenders count as 1.3 soldiers | **Stone Oath:** defenders count double for 20s | The Vale of Aldmere | Defensive |
| **The Kharzul Horde** (red) | Attack | Riders 30% faster, strike 1.25×; palisades defend at 0.9 | **Blood Moon Charge:** troops move 2× and hit 1.5× for 15s | The Red Steppe | Very aggressive |
| **The Jarls of Frostmark** (teal) | Defense | 1.4× in road battles, castles defend at 1.25; 5% slower | **Winter's Grip:** every enemy soldier in the field freezes for 12s | The Frostmark Fjords | Very defensive |
| **The Sun Dominion of Solmara** (gold) | Balanced | Castles train 15% faster; soldiers fight at 0.95 | **Golden Tithe:** castles train 2.5× as fast for 15s | The Sunscorched Sands | Balanced |
| **The Nyxhollow Covenant** (violet) | Attack | Attacks on unclaimed keeps count 1.5×; strike 1.15× | **Plague of Crows:** the 3 largest enemy castles lose 40% of their garrison | Nyxhollow Mire | Aggressive and cunning |

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
- **Armies that meet on the road fight.** The stronger column marches on with what's left.
- **Red banners** over your castles count the enemy troops marching on them. A pulsing ring means the castle will fall unless you reinforce it.
- **Rivals surrender** when they hold under 10% of all troops and two castles or fewer for 8 seconds (after the first minute). Against one rival their castles open their gates to you; with two rivals they fall back to neutral.
- **Rally points:** right-drag (or Shift-drag, or long-press then drag on touch) from one of your castles to another, and its new troops march there automatically, leaving 5 at home. Right-click the castle to clear it; the route also breaks if either castle is lost.
- **Upkeep:** a castle trains at half speed once its garrison passes twice its size, and a quarter speed past four times. An hourglass on its plaque shows when.
- **Bigger castles** train troops faster. Unclaimed keeps never grow. A captured castle is rebuilt in its new owner's style.
- **Space** selects all your castles. **[** and **]** (or the Speed buttons) change the game speed: 1×, 1.5× or 2×. **P** pauses. **M** mutes the sound.

## Modes

- **Skirmish:** Pick your rival (or a random one), 1 or 2 rivals, and whether to invade their homeland or defend yours. Difficulty is Squire, Knight or Warlord.
  - **Custom battle settings** (in the Skirmish menu): number of castles, map size, starting troops, how strong unclaimed keeps are, troop speed and power recharge time, with **Quick brawl**, **Standard** and **Long war** presets. The end screen shows the map seed; type it into the settings to replay the same map.
- **Campaign:** Eight battles across the rival homelands, from Thornbury to the High Throne. Each win unlocks the next.

See the [issues](https://github.com/jackgary86-dev/CastleCapture/issues) for planned improvements.
