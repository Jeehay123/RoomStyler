// src/panel.ts

import { createSystem } from "@iwsdk/core";

/**
 * Minimal PanelSystem
 *
 * Right now this system doesn't do any special logic.
 * The welcome UI panel is driven directly by /ui/welcome.json.
 *
 * We'll extend this later (for example: Add Bed / Remove Furniture buttons).
 */
export class PanelSystem extends createSystem({}) {
    // No queries / no logic yet – just a stub so TypeScript is happy.
}
