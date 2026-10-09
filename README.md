# Dice Party — multiplayer D&D dice roller

A browser-based dice room for your D&D group. Join with a name and room code, roll dice, and see everyone's rolls update live.

## Features
- Real-time rooms, player list, and shared roll history
- d4, d6, d8, d10, d12, d20 and d100 buttons
- Custom dice pools, modifiers and roll labels
- D&D 5e skill checks with ability modifiers, optional proficiency bonus, advantage, and disadvantage
- Shared initiative tracker sorted from highest to lowest, with next-turn and reset controls
- A player can track multiple named characters or monsters (for example, Goblin 1 and Goblin 2); re-rolling the same name updates that entry
- Mobile-friendly layout

## Deploy on Railway
1. Open https://railway.com/new and sign in.
2. Choose **Deploy from GitHub repo**.
3. Select **house626-sys/dnd-dice-party**, then choose **Deploy Now**.
4. When the deployment finishes, open the service's **Settings** and find **Networking**.
5. Click **Generate Domain** to create a public URL.
6. Open the public URL and share it with your friends. Everyone should use the same room code.

Railway should detect the Node.js app from `package.json` and run `npm start`. The app listens on the port provided through the `PORT` environment variable. Socket.IO provides the live updates. If this repository is connected to an existing Railway service with deploy-on-push enabled, commits to the main branch trigger a redeploy; check the Railway deployment log if the new version does not appear.

## Run locally
Requires Node.js 18 or newer.

1. Run `npm install` in this folder.
2. Run `npm start`.
3. Open http://localhost:3000.

## Notes
- The tracker and roll history are stored in server memory and reset when the service restarts or the room becomes empty.
- The "Next turn" and "Reset tracker" controls are currently available to any room member, so use them as a group.
- Anyone who knows a room code can join that room.
