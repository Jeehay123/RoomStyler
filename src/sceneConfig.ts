// sceneConfig.ts
export const ROOM_WIDTH = 6;
export const ROOM_DEPTH = 6;
export const WALL_HEIGHT = 2.4;

export const ROTATE_SENSITIVITY = Math.PI / 360;

export const BED_RADIUS = 1.0;
export const DESK_RADIUS = 0.8;
export const CHAIR_RADIUS = 0.6;
export const WARDROBE_RADIUS = 0.9;
export const SOFA_RADIUS = 1.1;
export const COFFEE_RADIUS = 0.7;
export const RUG_RADIUS = 1.8;
export const PARTITION_RADIUS = 1.0;
export const LAMP_RADIUS = 0.4;

export const MIN_SCALE = 0.5;
export const MAX_SCALE = 1.6;

export type FurnitureKind =
    | "Bed"
    | "Desk"
    | "Chair"
    | "Wardrobe"
    | "Sofa"
    | "CoffeeTable"
    | "Rug"
    | "Partition"
    | "Lamp";

export type MaterialGroupKey =
    | "walls"
    | "floor"
    | "bedMain"
    | "bedTextile"
    | "sofaBody"
    | "sofaCushionWarm"
    | "sofaCushionLight"
    | "desk"
    | "chair"
    | "wardrobeMain"
    | "wardrobeAccent"
    | "wardrobeHandle"
    | "coffeeTable"
    | "rug"
    | "partitionFrame"
    | "partitionGlass"
    | "lampPole"
    | "lampShade";
