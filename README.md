# Squeekerant

A tiny pixel restaurant in a forest, for the Squeekchain community. Your hamster is the head chef. Guests are tiny animals, 180 kinds so far. The real hamster Squeektoshi runs the wheel that powers every kitchen.

Live at https://www.squeekerant.online. The restaurant runs in the browser. A small server only keeps the leaderboard. There is no token or NFT, and connecting a wallet only signs a message. Cash and Winks are game points with no real value.

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

A restaurant that opens in the middle of a sleep counts the whole sleep so far, read back from the wheel, so its first morning brings the same dream as everyone else's. While he sleeps the ribbon over the room shows how far the sleep has come: hours until a Dream Dish, then hours until it turns golden. The landing page says how long he has been asleep.

The daily question on the notice board sometimes asks about his last full day. A day is counted the way the official stats count it, 12:00 to 12:00 UTC, so it holds one whole run. The answers are ranges, and it is only asked on the real wheel once every round of that day has been read. The recording asks something else.

## Inside, outside and the street

The door of the restaurant leads outside: a wide forest that fills the whole screen, with the market, the decor shop, the leaderboard, the notice board, your mailbox and trade shelf, your tree, and the road to Skirting Street. The street shows five neighbours at a time, on lots the day picks, each building looking the way its owner has made it. Click a house to go in. A signpost takes you to another street with five other houses, three times a day. The neighbours are local characters, the same for everyone.

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

## The way in

The landing page comes first on every visit: the name, drawn by hand in `src/art/logo.js`, the game's own woods at the real hour, with your restaurant in them when you have one, and two ways in, with a wallet or without. The restaurant stands still behind it. Disconnecting a wallet comes back here.

Anyone with no restaurant is offered the practice kitchen before naming one, and can skip it. It is a throwaway save on the real rules and the real screens, run by `PracticeFeed`, a pretend hamster the lesson tells when to run and sleep and how fast time goes. A coach (`src/ui/practice.js`) walks through 26 steps and a ring marks what to press. Nothing there is saved or sent to the board, and a real restaurant is put aside and comes back as it was. How To Play, the sixth tab, has everything in short and can open the practice kitchen again.

## Showing it off

The camera button next to Arrange paints a picture of your restaurant (`src/ui/share.js`): your building in the woods as they look this hour, the room as it is right now in a frame, and a ticket with the name, the head chef, the level, guests fed, kinds met, rating, house level, his latest dream and the rarest guests met. Everything on it comes from the save and the engine's own sums, painted by the game's own painters. A phone sends the picture itself to the share sheet. It can also be saved or copied. The Dream Dish card has the same button. The Artifact preview shows the picture but cannot share it.

X cannot take a picture through a link, so Post on X gives the picture a link of its own, `/p/<id>`, and X shows that link as a large picture in the post. Discord and Telegram show it the same way. What goes to the server is never an image: the game first writes the picture down as plain data (the save's pieces and where everyone stands), checks it with `cleanPicture`, and paints that. The server runs the same check on what it gets, puts both names through the leaderboard's rules, writes in the real board for the sign outside, and paints the picture itself with the same painters (`server/picture.js`, on `@napi-rs/canvas` with the three fonts in `src/fonts`). So nothing on a picture can be anything but the game's own pieces and a name the board would take. The same picture always gets the same link.

The server has only those three fonts, so a letter none of them can draw, an emoji or a Chinese letter in a name for one, is left off the picture on both sides and the two pictures stay the same. The words of the post keep the name exactly as the player wrote it. A test reads the fonts' own tables and checks the list in `share.js` against them.

The data is kept in the `pictures` table (id, when, data), with nothing about who made it. Only the newest 20,000 are kept, an address can make 20 an hour and the whole site 2,000 a day. An address with no picture behind it still opens and shows the game's own preview. The picture for a link never changes, so it is cached for good. If the server cannot make a link, the post links the site instead and the game says so.

## The link preview

A link to the site shows a picture and a line of text on X, Discord and Telegram. `scripts/build.js` writes the tags into the page head, and the picture is `src/ui/og.png`, 1200 by 630, painted from the game itself: a dressed level 24 restaurant on a spring day with him running. The build copies it next to the page, and the public build stops if it is missing.

## Updates

https://www.squeekerant.online/updates lists every release, newest first, from `src/updates.json`, built into `updates.html` by `scripts/updates-page.js`. Each deploy is one release, numbered 0.0.1, 0.0.2 and on. In each release the items marked big come first with a title, the small ones follow in small print, and each says New, Better or Fixed. The build stops if a release is out of order or an item is missing something, and the welcome page and How To Play link there with the latest number.

## Counts

To see how far people get, the game counts a few steps: opening the page for the first time, connecting a wallet, starting, finishing or leaving the practice kitchen and each of its steps, opening a real restaurant, a first real guest, a first Dream Dish, playing today, still coming back after 1, 3, 7, 14 and 30 days, and using the share picture. The full list is in `server/rules.js`, and nothing else is stored.

Only a number per step per day reaches the server, in the `counts` table (day, step, n). There is no address, no name, no cookie and nothing kept about the request. The browser keeps a short list under `squeekerant-counted` of what it has already counted, so each browser counts each step once (playing today once a day), and it sends what it has in one small request, so a visit wakes the database once at most. Browsers run by a program, test browsers included, and the Artifact preview never count.

Read them at https://www.squeekerant.online/api/stats, a table of the last 14 days, or as JSON at `/api/counts`. Both are cached for five minutes. Anyone could send counts by hand, so they show trends and are never a reason to pay anyone. One address can send 60 an hour, counted in memory only, so a flood cannot keep the database awake all month.

## The leaderboard and wallets

The board lists only restaurants whose owner connected a wallet, ranked by restaurant level, then progress toward the next one, then who got there first. Nothing else is on it, so an empty board is simply empty. A wallet keeps its best restaurant, so starting again takes nobody off the board.

Connecting asks the wallet for its address and one signature on a Sign-In with Ethereum message. There is no fee and no transaction. The server checks the signature and hands back a session that lasts 60 days. Only a restaurant on the real wheel sends its score, right after connecting, within a minute of a new level, and otherwise at most every ten minutes, so the database can sleep. The board itself is cached for five minutes.

**Scores can be forged.** All the game's numbers live in the player's browser, so anyone can edit their save. The server only refuses what cannot have happened: more than 8,000 XP plus 9,000 a day since launch, which stays above the best bot. Look before paying any reward. `players` keeps first and last seen, and `player_days` keeps one line per wallet per day, which the player cannot fake without actually coming back each day:

```sql
SELECT p.wallet, p.shop, p.level, p.total_xp, p.first_seen, p.last_seen, count(d.day) AS days
FROM players p LEFT JOIN player_days d USING (wallet)
WHERE NOT p.hidden GROUP BY p.wallet ORDER BY p.total_xp DESC;

UPDATE players SET hidden = true WHERE wallet = '0x...'; -- takes someone off the board
```

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

One tab plays at a time. A newly opened tab takes over and an older one stops with a Play here button, so two tabs can never save over each other. If the official API stops answering for a minute after the page has connected, the wheel shows no signal rather than its last answer.

The game itself needs nothing installed. The leaderboard's server needs `npm install` once, and again after a new package such as the picture painter, and `npm start` runs a local one that keeps its board and pictures in memory until you stop it. With network access the game follows the real wheel, so while he sleeps nobody comes in. A restaurant that follows the real wheel waits while the wheel can't be reached, shows no signal and catches up afterwards, it is never mixed with the recording. A new restaurant with no network, as in an Artifact, replays the recording in `src/data/recording.js` on a loop that keeps the time of day, and moves to the real wheel if the network comes back.

## Going live

`vercel deploy --prod` from this folder. `vercel.json` builds `public/index.html`, the only file visitors get, and serves `api/index.js` as one function for `/api/` and the picture links under `/p/`. The function carries `src` with it, for painting pictures. `dist/vi` is only for testing and never goes up.

The board needs a Postgres database, its address in the `DATABASE_URL` setting on Vercel, and one more deploy to pick it up. The tables make themselves. Until then the game says the board is not open yet, and everything else works.

## Layout

- `src/core`: rules (`engine.js`), data sources including the practice kitchen's pretend hamster (`feed.js`), the wallet and the board (`wallet.js`), the anonymous counts (`counter.js`), seeded random numbers.
- `src/data`: guests, food, decor, the world outside with its seasons and weather, the recording.
- `src/art`: pixel painters, nothing is an image file. `houses.js` paints every building part.
- `src/ui`: the landing page, the canvas world with its three places and camera, panels, the carousel game, the practice kitchen, the share picture, sound and music, start up. `og.png` is the link preview picture.
- `src/lang`: the Vietnamese test build, left out of the plain build.
- `src/fonts`: the page's three fonts, for the server's pictures, each with its SIL Open Font License.
- `server`, `api`: the leaderboard's server, sign in, the rules for a score, the counts and the shared pictures.

## Not built yet

Real friends and saves that follow a wallet. Neighbours, their buildings and the callers at your shelf are local characters. Connecting needs a wallet in the browser, so a phone must open the page in its wallet app, and a smart contract wallet cannot sign in yet. Balance comes from a bot only and needs people to play it. Sound has not been heard on real speakers.

## Credits and rules kept

Mechanics are inspired by Restaurant City style games and by films about small cooks, with no names, art, music or lines taken from them. Foods are limited to ones named safe for hamsters by at least one published care guide (PetMD, Chewy, Woodgreen, Burgess, or the Squeektoshi care policy), in small plain amounts. It is a game, not care advice.

## Squeekchain Genesis

The line below, a tag in the page's head (scripts/build.js) and a DNS TXT record on `_squeekchain.www.squeekerant.online` prove this project on Squeekchain Genesis. They are checked again every day, so all three must stay.

squeekchain-project: 59c16db5-e31e-4532-966b-35152d96700f
