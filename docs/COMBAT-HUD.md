# Combat and compact HUD

The base and expedition share `components/game/GameHud` and `CombatDriver`.
The driver owns energy and cooldowns; the React HUD only displays its reported
state and sends input. Class choice persists in `netrunner.combat.class`.
Keys 1–4 activate skills, I opens inventory. Base skills are practice actions;
expedition skills use range and line-of-sight checks against living enemies.
Damage is currently resolved at activation; animation contact timing is a future
refinement. Ranger uses the legacy retargeted shooting clip, sword and magic use
the authored Neon Sentinel clips already in the character asset.

Inventory reads the existing `netrunner.expedition.stash.v1` save. Expedition
loot stays separate until extraction. This is a local prototype, with no server
inventory or token rewards. Level currently starts and stays at 1. The talents
panel selects classes; progression nodes and Claim rewards are explicitly locked.

The legacy sword, retarget and class-action helpers are reused from the parent
game. Only the shooting donor asset is needed in the new project. Existing
movement, collision, wallet and extraction flows are retained.

Environment update: a central octagonal fountain, four ruined stone walls and
85 seeded bare trees use shared geometry/materials and chunked instancing.
Trunks and walls are included in navigation blockers. Reachability tests cover
all POIs and extraction points, including the fountain approach.
