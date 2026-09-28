# ZFT Raised Hands

ZFT Raised Hands is a system-agnostic Foundry VTT module that maintains an authoritative, persistent queue of users who have raised their hands.

## Version

1.1.1

## Foundry compatibility

- Foundry VTT V13 Build 351
- V14 is not supported by this build
- Requires SocketLib

## Features

- High-contrast yellow Player Raise/Lower Hand toggle in Token Controls
- Configurable Foundry keybinding (default: H)
- Persistent world-level ordered queue
- Native Raised Hands sidebar tab with live queue count badge for GMs and players
- Foundry user avatars displayed in the queue at compact chat-portrait size
- Full GM queue management directly inside the Foundry sidebar
- Player sidebar view is read-only; only GMs see Individual Clear, Clear Next, and Clear All controls
- Player-list raised-hand indicators
- Offline users remain in the queue until cleared
- Transient GM notification when a hand is raised
- Configurable GM alert sound with enable/disable, audio file picker, and volume
- Bundled default raised-hand chime
- No chat-card dependency
- No game-system dependency

## Queue behavior

The queue is the authoritative state. UI elements are rendered from the queue; they are not used to infer whether a user's hand is raised.

Each queue entry stores only:

```json
{
  "userId": "FoundryUserId",
  "raisedAt": 1790560212345
}
```

User names and online status are resolved live from Foundry's user collection.

## Alert sound settings

Configure under **Game Settings → Configure Settings → Module Settings → ZFT Raised Hands**:

- Raised Hand Alert Sound
- Raised Hand Alert Sound File
- Raised Hand Alert Volume

The sound plays only on connected GM clients when a hand is newly raised. Lowering or clearing a hand does not play the alert.

## Installation for local testing

Copy the `zft-raised-hands` directory into your Foundry `Data/modules/` directory, restart Foundry if required for module discovery, enable SocketLib, then enable ZFT Raised Hands in the world.

## License

Copyright © 2026 Zantor's Realms, LLC. All rights reserved.


## v1.4.1

- Added each Foundry user's current avatar to Raised Hands queue entries.
- Uses a compact 36px portrait treatment intended to match the visual scale of Foundry chat portraits.
- Avatar is resolved live from the User document and is not stored in the queue.
- Applies to both GM and read-only player sidebar views.

## v1.4.0

- Made the native Raised Hands sidebar tab visible to non-GM users.
- Player view is read-only and shows the same live queue, order, elapsed time, online status, and badge count.
- Hidden all queue-management controls from non-GM users.
- Preserved GM-only socket authorization for all clear operations.
- Players still raise or lower only their own hand from Token Controls.

## v1.3.0

- Removed raised-hand chat cards because the native sidebar tab and queue-count badge provide persistent visibility and direct management.
- Added a configurable GM alert sound for newly raised hands.
- Added a bundled default chime.
- Added settings for sound enable/disable, audio-file selection, and volume.

## v1.2.2

- Replaced the simulated sidebar overlay with a native Foundry V13 sidebar tab.
- Raised Hands now swaps normally with Chat, Actors, Scenes, and other sidebar tabs.
- Yellow hand tab is positioned immediately after Chat and shows a badge only when hands are raised.
