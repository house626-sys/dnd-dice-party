# Dice Party — multiplayer D&D dice roller

A browser-based dice room for your D&D group. Join with a name and room code, roll dice, and see everyone's rolls update live.

## Deploy on Railway

1. Open https://railway.com/new and sign in.
2. Choose **Deploy from GitHub repo**.
3. Select **house626-sys/dnd-dice-party**, then choose **Deploy Now**.
4. When the deployment finishes, open the service's **Settings** and find **Networking**.
5. Click **Generate Domain** to create a public URL.
6. Open the public URL and share it with your friends. Everyone should use the same room code.

Railway should detect the Node.js app from `package.json` and run `npm start`. The service listens on the port provided through the `PORT` environment variable. Socket.IO provides live updates between players.

## Features

- Room codes and player names; no accounts required
- d4, d6, d8, d10, d12, d20 and d100 buttons
- Custom dice pools, modifiers and roll labels
- One-click initiative rolls
- Shared live roll history and online player list
- Mobile-friendly layout

## Run locally

Requires Node.js 18 or newer.

1. Run `npm install` in this folder.
2. Run `npm start`.
3. Open http://localhost:3000.

## Notes

Room state and roll history are stored in server memory and reset when the service restarts or the room becomes empty. Anyone who knows a room code can join that room.
