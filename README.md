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

## How to play

- **Drag** from one of your castles to any castle to send troops.
- **Keys 1–4** or the **scroll wheel** choose how many to send: 25%, 50%, 75% or all.
- **Drag across** several of your castles to attack from all of them, or **tap** castles to select them and then tap a target.
- **Q** or the power button uses your army's special power.
- **Armies that meet on the road fight.** The stronger column marches on with what's left.
- **Red banners** over your castles count the enemy troops marching on them. A pulsing ring means the castle will fall unless you reinforce it.
- **Bigger castles** train troops faster. Unclaimed keeps never grow. A captured castle is rebuilt in its new owner's style.
- **Space** selects all your castles. **P** pauses. **M** mutes the sound.

## Modes

- **Skirmish:** Pick your rival (or a random one), 1 or 2 rivals, and whether to invade their homeland or defend yours. Difficulty is Squire, Knight or Warlord.
- **Campaign:** Eight battles across the rival homelands, from Thornbury to the High Throne. Each win unlocks the next.

See the [issues](https://github.com/jackgary86-dev/CastleCapture/issues) for planned improvements.
