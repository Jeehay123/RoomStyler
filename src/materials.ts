// materials.ts
import { MeshStandardMaterial } from "@iwsdk/core";
import { Color } from "three";
import type { MaterialGroupKey } from "./sceneConfig";

export const materialGroups: Record<MaterialGroupKey, MeshStandardMaterial[]> =
    {
        walls: [],
        floor: [],
        bedMain: [],
        bedTextile: [],
        sofaBody: [],
        sofaCushionWarm: [],
        sofaCushionLight: [],
        desk: [],
        chair: [],
        wardrobeMain: [],
        wardrobeAccent: [],
        wardrobeHandle: [],
        coffeeTable: [],
        rug: [],
        partitionFrame: [],
        partitionGlass: [],
        lampPole: [],
        lampShade: [],
    };

export function registerMaterial(
    group: MaterialGroupKey,
    mat: MeshStandardMaterial
): MeshStandardMaterial {
    materialGroups[group].push(mat);
    return mat;
}

export function setGroupColor(group: MaterialGroupKey, hex: string) {
    const c = new Color(hex);
    for (const mat of materialGroups[group]) {
        mat.color.copy(c);
    }
}
