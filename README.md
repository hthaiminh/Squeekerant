# Squeekerant

A tiny pixel restaurant in a forest, for the Squeekchain community. Your hamster is the head chef. Guests are tiny animals, 180 kinds so far. The real hamster Squeektoshi runs the wheel that powers every kitchen.

This is a playable prototype. Everything runs in the browser, with no server, wallet, token or NFT. Cash and Winks are game points with no real value.

## How his day runs the game

| What he does | Where it is read from | What happens |
|---|---|---|
| Runs | Wheel passes | One guest per 10 passes. Woks fire. Waiters tire. |
| A round settles | SqueekCore | The till is banked. Spendable money only moves here. |
| Rests | Rounds with no passes | +1 Wink, staff +1% energy, pots simmer. Nobody comes in. |
| Wakes after 10 hours or more | Hash of the round he woke on | A Dream Dish, the same for everyone. 15 hours or more makes it golden. |
| Naps of 1 hour or more | Same | A small ingredient gift and a new craving for the next shift. |
| Passes a distance milestone | Running total | A festival day and bunting. |
| No signal | Missing round record | Nothing counts, nothing is lost. |

Nothing can wake him or ask him to run, and food never spoils, in line with his [care policy](https://docs.squeekchain.com/system/squeektoshi.md).

The daily question on the notice board sometimes asks about his last full day. A day is counted the way the official stats count it, 12:00 to 12:00 UTC, so it holds one whole run. The answers are ranges, and it is only asked on the real wheel once every round of that day has been read. The recording asks something else.

## Inside, outside and the street

The door of the restaurant leads outside: a wide forest that fills the whole screen, with the market, the decor shop, the leaderboard, the notice board, your mailbox and trade shelf, your tree, and the road to Skirting Street. The street shows five neighbours at a time, on lots the day picks, each building looking the way its owner has made it. Click a house to go in. A signpost takes you to another street with five other houses, three times a day. Real players would come first, with locals filling up whatever is left.

There is one list of guests. They walk the road, go through the door, sit, eat and walk back out, so both sides of the door always agree on who is where. A running hamster fills a round's seats in its first few minutes, so those guests stroll up spread over the whole round and people come and go all the time, not in waves. This only changes how it looks, the engine has already counted them. With every seat taken a guest walks on instead of waiting in the doorway. Furniture may close off a seat, the guests then squeeze through as little of it as they can.

The road is never empty. Other animals pass along it day and night, some in twos and threes, more when he runs and fewer when he sleeps. Some stop to read the sign on your door and walk on, some go into the market or the decor shop and some come back out. They are only passers by and pay nothing. Nobody comes into the restaurant unless the wheel brought them, so while he sleeps the room stands empty.

Time follows him. While he is up, or within 20 minutes of his last pass, it is day. Once he is asleep it is night, with the moon and the lamps on. A season lasts 7 days and weather turns every 3 hours, both worked out from the round number, so everyone shares them. Rain, snow, storms and other weather add 2 to 10% to tips, and a dish with the flavour of the season adds 10%.

Yard pieces and the look of your building add charm. Charm draws extra guests, from nothing up to 50% more when the whole yard and the best building are in place. It counts most at the start. Only the first of each yard piece counts for charm, and more of the same add only a quarter of their rating. Buildings are made of parts (walls, roof, roof top, awning, windows, door, foundation, balcony, towers, trim and sign), and any part goes with any other. Parts and yard pieces draw on building styles from all over the world, and the dearer they are the grander they get.

Each place has its own gentle tune, played by the browser note by note, with no sound files: a cafe waltz inside, a slow flute and harp in the forest, a whistled stroll on the street. They crossfade as you walk and stop for On the Line. The sound button turns off music and sound together.

## Where the money comes from

Selling food in the restaurant is the living. A bot that does every side job still earns more than three quarters of its money from food after the first few days, and `node tests/sim.js` fails if that drops below 75%. Parties pay above the menu price but are small. The carousel pays half to full menu price, up to a daily limit that grows with level. Machines pay a small fixed amount on each round he runs. Trees and floors are pocket money.

Money is kept tight on purpose. A full five stars tips half the menu price. Ingredients cost a quarter to a half of a batch at menu price, and the better the dish, the thinner the margin, so cooking always costs something. At one visit a day, the dearest new thing at a level takes one to three days of income in the first two weeks and more than ten near the top. The bot also fails if ingredients fall below 7% of income, or if a day's income starts buying the dearest new thing at a level.

## Why neighbours trade

Every restaurant has its own stall each day, and better ingredients are scarce on it. Each neighbour grows a fixed few things and has a limited amount out each day, so what your stall lacks is usually on someone's shelf. A trade is one for one, giving the same level or better.

You can hang your own ingredients on a shelf. Unlocked goods swap on their own when a neighbour comes by, locked ones send an offer to your mailbox. Asking for something locked on their shelf gets an answer by mail at the next round, and they may say no.

Trees and floors always pay cash, with a small chance of an ingredient, a bit of junk or a treasure.

## Three clocks in the kitchen

- Stove: real time, always works.
- Wok: real wheel passes, so it waits while he sleeps.
- Pot: rounds he does not run, so it finishes while he sleeps.

## Run it

```sh
npm start          # builds both versions and serves them on this computer, http://localhost:3000/ in English and /vi/ in Vietnamese
npm run build      # writes dist/index.html and dist/artifact.html, English only
npm run build:vi   # writes the Vietnamese test build to dist/vi
npm test           # rules on a made up wheel
node tests/sim.js  # a bot plays 30 days on his real rounds and prints prices and income by source. Days, visits a day and busy can be given
npm run recording  # refreshes src/data/recording.js from the API and SqueekCore
```

There is nothing to install. With network access the game follows the real wheel, so while he sleeps nobody comes in. A restaurant that follows the real wheel waits while the wheel can't be reached, shows no signal and catches up afterwards, it is never mixed with the recording. A new restaurant with no network, as in an Artifact, replays the recording in `src/data/recording.js` on a loop that keeps the time of day, and moves to the real wheel if the network comes back.

Going on a domain takes one file, `dist/index.html`. Everything is inside it and it needs no server. `dist/vi` is only for testing and must not go up.

## Layout

- `src/core`: rules (`engine.js`), data sources (`feed.js`), seeded random numbers.
- `src/data`: guests, food, decor, the world outside with its seasons and weather, the recording.
- `src/art`: pixel painters, nothing is an image file. `houses.js` paints every building part.
- `src/ui`: the canvas world with its three places and camera, panels, the carousel game, sound and music, start up.
- `src/lang`: the Vietnamese test build, left out of the plain build.

## Not built yet

Real friends, a server and shared saves. Neighbours, their buildings, the leaderboard and the callers at your shelf are local characters for now. Balance comes from a bot only and needs people to play it. Sound has not been heard on real speakers.

## Credits and rules kept

Mechanics are inspired by Restaurant City style games and by films about small cooks, with no names, art, music or lines taken from them. Foods are limited to ones named safe for hamsters by at least one published care guide (PetMD, Chewy, Woodgreen, Burgess, or the Squeektoshi care policy), in small plain amounts. It is a game, not care advice.
