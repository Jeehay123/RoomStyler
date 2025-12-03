// furniture.ts
import {
    World,
    BoxGeometry,
    Mesh,
    MeshStandardMaterial,
    Transform,
} from "@iwsdk/core";

import {
    Group,
    Color,
    RingGeometry,
    MeshBasicMaterial,
    DoubleSide,
    Sprite,
    SpriteMaterial,
    CylinderGeometry,
} from "three";

import {
    ROOM_WIDTH,
    ROOM_DEPTH,
    BED_RADIUS,
    DESK_RADIUS,
    CHAIR_RADIUS,
    WARDROBE_RADIUS,
    SOFA_RADIUS,
    COFFEE_RADIUS,
    RUG_RADIUS,
    PARTITION_RADIUS,
    LAMP_RADIUS,
    MIN_SCALE,
    MAX_SCALE,
    FurnitureKind,
} from "./sceneConfig";
import { registerMaterial } from "./materials";
import { setEntityPosition, rotateQuaternionY } from "./transformHelpers";
import { getResizeIconTexture } from "./resizeIcon";

// ===== Types & state =====

export interface FurnitureItem {
    entity: any;
    kind: FurnitureKind;
    id: number;
    label: string;

    baseRadius: number;
    radius: number;
    baseScale: number;

    selectionRing?: Mesh;
    scaleHandle?: Mesh;
}

export type SelectionListener = (selected: FurnitureItem | null) => void;

export const furniture: FurnitureItem[] = [];
export let selectedItem: FurnitureItem | null = null;

let nextFurnitureId = 1;
let selectionListeners: SelectionListener[] = [];

// Shared selection-ring geometry
const selectionRingGeom = new RingGeometry(0.5, 0.7, 48);
const selectionRingMaterialBase = new MeshBasicMaterial({
    color: 0x38bdf8,
    side: DoubleSide,
    transparent: true,
    opacity: 0.9,
});

export function addSelectionListener(listener: SelectionListener) {
    selectionListeners.push(listener);
}

function notifySelectionChanged() {
    for (const l of selectionListeners) l(selectedItem);
}

function applySelectionVisuals() {
    for (const item of furniture) {
        const root = item.entity.object3D as Group | undefined;
        if (!root) continue;

        const isSelected = item === selectedItem;
        const highlightScale = isSelected ? 1.08 : 1.0;
        const s = item.baseScale * highlightScale;
        root.scale.set(s, s, s);

        if (item.selectionRing) item.selectionRing.visible = isSelected;
        if (item.scaleHandle) item.scaleHandle.visible = isSelected;
    }
}

export function selectItem(item: FurnitureItem | null) {
    selectedItem = item;
    applySelectionVisuals();
    notifySelectionChanged();
}

// ===== Position / collision helpers =====

function getFurnitureXZ(item: FurnitureItem): { x: number; z: number } {
    const pos = item.entity.getVectorView(Transform, "position");
    return { x: pos[0], z: pos[2] };
}

function randomRoomPosition(radius: number): { x: number; z: number } {
    const margin = radius + 0.3;
    const xRange = ROOM_WIDTH / 2 - margin;
    const zRange = ROOM_DEPTH / 2 - margin;

    return {
        x: (Math.random() * 2 - 1) * xRange,
        z: (Math.random() * 2 - 1) * zRange * 0.7,
    };
}

export function findNonOverlappingPosition(radius: number): {
    x: number;
    z: number;
} {
    const maxAttempts = 25;

    for (let i = 0; i < maxAttempts; i++) {
        const p = randomRoomPosition(radius);
        let ok = true;

        for (const item of furniture) {
            const ex = getFurnitureXZ(item);
            const dx = p.x - ex.x;
            const dz = p.z - ex.z;
            const minDist = radius + item.radius + 0.25;
            if (dx * dx + dz * dz < minDist * minDist) {
                ok = false;
                break;
            }
        }

        if (ok) return p;
    }

    return randomRoomPosition(radius);
}

export function resizeSelectedFromDrag(multiplier: number) {
    if (!selectedItem) return;
    let newScale = selectedItem.baseScale * multiplier;
    if (newScale < MIN_SCALE) newScale = MIN_SCALE;
    if (newScale > MAX_SCALE) newScale = MAX_SCALE;

    selectedItem.baseScale = newScale;
    selectedItem.radius = selectedItem.baseRadius * newScale;
    applySelectionVisuals();
}

// ===== Internal: furniture registration + selection ring / handle setup =====

function registerFurniture(
    entity: any,
    kind: FurnitureKind,
    baseRadius: number,
    baseScale = 0.8
): FurnitureItem {
    const id = nextFurnitureId++;

    const item: FurnitureItem = {
        entity,
        kind,
        id,
        label: `${kind} ${id}`,
        baseRadius,
        radius: baseRadius * baseScale,
        baseScale,
    };

    const root = entity.object3D as Group | undefined;
    if (root) {
        // Base scale
        root.scale.set(baseScale, baseScale, baseScale);

        // Selection ring
        const ring = new Mesh(
            selectionRingGeom,
            selectionRingMaterialBase.clone()
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.02;

        const baseOuterRadius = 0.7;
        const scaleFactor = (baseRadius * 1.4) / baseOuterRadius;
        ring.scale.set(scaleFactor, scaleFactor, 1);

        ring.visible = false;
        root.add(ring);
        item.selectionRing = ring;

        // Resize handle
        const handleGeom = new BoxGeometry(0.18, 0.18, 0.18);
        const handleMat = new MeshStandardMaterial({
            color: new Color(0xffffff),
            transparent: true,
            opacity: 0,
            roughness: 0.2,
            metalness: 0.0,
        });
        const handle = new Mesh(handleGeom, handleMat);
        const handleDistance = baseRadius * 1.7;
        handle.position.set(handleDistance, 0.15, handleDistance);
        (handle as any).userData = { type: "scaleHandle", itemId: id };
        handle.visible = false;

        const iconMat = new SpriteMaterial({
            map: getResizeIconTexture(),
            transparent: true,
        });
        iconMat.depthTest = false;
        const iconSprite = new Sprite(iconMat);
        iconSprite.scale.set(0.2, 0.2, 1);
        iconSprite.position.set(0, 0, 0.1);
        iconSprite.renderOrder = 3;
        handle.add(iconSprite);

        root.add(handle);
        item.scaleHandle = handle;
    }

    furniture.push(item);
    return item;
}

// ===== Actual furniture creation functions (exported) =====

export function createBed(world: World, x: number, z: number): FurnitureItem {
    const root = new Group();

    const frameMat = registerMaterial(
        "bedMain",
        new MeshStandardMaterial({
            color: new Color(0x8b7d71),
            roughness: 0.9,
            metalness: 0.1,
        })
    );
    const frame = new Mesh(new BoxGeometry(1.8, 0.25, 1.2), frameMat);
    frame.position.set(0, 0.125, 0);
    root.add(frame);

    const mattressMat = registerMaterial(
        "bedTextile",
        new MeshStandardMaterial({
            color: new Color(0xfdfdfd),
            roughness: 0.98,
            metalness: 0.0,
        })
    );
    const mattress = new Mesh(new BoxGeometry(1.8, 0.22, 1.2), mattressMat);
    mattress.position.set(0, 0.25 + 0.22 / 2, 0);
    root.add(mattress);

    const blanketMat = registerMaterial(
        "bedTextile",
        new MeshStandardMaterial({
            color: new Color(0xd0d3d8),
            roughness: 0.99,
            metalness: 0.0,
        })
    );
    const blanket = new Mesh(new BoxGeometry(1.75, 0.06, 1.0), blanketMat);
    blanket.position.set(0.02, 0.25 + 0.22 + 0.03, 0.05);
    blanket.rotation.x = -0.03;
    root.add(blanket);

    const entity = world.createTransformEntity(root);
    setEntityPosition(entity, x, 0, z);
    return registerFurniture(entity, "Bed", BED_RADIUS);
}

export function createDesk(world: World, x: number, z: number): FurnitureItem {
    const root = new Group();

    const topMat = registerMaterial(
        "desk",
        new MeshStandardMaterial({
            color: new Color(0xd1b79a),
            roughness: 0.8,
            metalness: 0.05,
        })
    );
    const top = new Mesh(new BoxGeometry(1.4, 0.1, 0.6), topMat);
    top.position.set(0, 0.75, 0);
    root.add(top);

    const legMat = registerMaterial(
        "desk",
        new MeshStandardMaterial({
            color: new Color(0x232733),
            roughness: 0.9,
            metalness: 0.05,
        })
    );
    const legGeom = new BoxGeometry(0.08, 0.7, 0.08);

    const legPositions = [
        [-0.6, 0.35, -0.25],
        [0.6, 0.35, -0.25],
        [-0.6, 0.35, 0.25],
        [0.6, 0.35, 0.25],
    ];

    for (const [lx, ly, lz] of legPositions) {
        const leg = new Mesh(legGeom, legMat);
        leg.position.set(lx, ly, lz);
        root.add(leg);
    }

    const entity = world.createTransformEntity(root);
    setEntityPosition(entity, x, 0, z);
    return registerFurniture(entity, "Desk", DESK_RADIUS);
}

export function createChair(world: World, x: number, z: number): FurnitureItem {
    const root = new Group();

    const seatMat = registerMaterial(
        "chair",
        new MeshStandardMaterial({
            color: new Color(0xd6b89a),
            roughness: 0.9,
        })
    );
    const seat = new Mesh(new BoxGeometry(0.6, 0.1, 0.6), seatMat);
    seat.position.set(0, 0.55, 0);
    root.add(seat);

    const back = new Mesh(new BoxGeometry(0.6, 0.7, 0.08), seatMat);
    back.position.set(0, 0.95, -0.25);
    root.add(back);

    const legMat = registerMaterial(
        "chair",
        new MeshStandardMaterial({
            color: new Color(0x232733),
            roughness: 0.9,
        })
    );
    const legGeom = new BoxGeometry(0.06, 0.55, 0.06);

    const legPositions = [
        [-0.25, 0.275, -0.25],
        [0.25, 0.275, -0.25],
        [-0.25, 0.275, 0.25],
        [0.25, 0.275, 0.25],
    ];

    for (const [lx, ly, lz] of legPositions) {
        const leg = new Mesh(legGeom, legMat);
        leg.position.set(lx, ly, lz);
        root.add(leg);
    }

    const entity = world.createTransformEntity(root);
    setEntityPosition(entity, x, 0, z);
    return registerFurniture(entity, "Chair", CHAIR_RADIUS);
}

export function createWardrobe(
    world: World,
    x: number,
    z: number
): FurnitureItem {
    const root = new Group();

    const bodyMat = registerMaterial(
        "wardrobeMain",
        new MeshStandardMaterial({
            color: new Color(0x444444),
            roughness: 0.95,
        })
    );
    const body = new Mesh(new BoxGeometry(1.0, 2.0, 0.4), bodyMat);
    body.position.set(0, 1.0, 0);
    root.add(body);

    const edgeMat = registerMaterial(
        "wardrobeAccent",
        new MeshStandardMaterial({
            color: new Color(0xf4f5f7),
            roughness: 0.9,
        })
    );
    const edge = new Mesh(new BoxGeometry(1.02, 2.02, 0.02), edgeMat);
    edge.position.set(0, 1.0, 0.21);
    root.add(edge);

    const handleMat = registerMaterial(
        "wardrobeHandle",
        new MeshStandardMaterial({
            color: new Color(0x111111),
            roughness: 0.3,
            metalness: 0.8,
        })
    );
    const handleGeom = new BoxGeometry(0.03, 0.35, 0.03);

    const handleLeft = new Mesh(handleGeom, handleMat);
    handleLeft.position.set(-0.15, 1.0, 0.24);
    root.add(handleLeft);

    const handleRight = new Mesh(handleGeom, handleMat);
    handleRight.position.set(0.15, 1.0, 0.24);
    root.add(handleRight);

    const entity = world.createTransformEntity(root);
    setEntityPosition(entity, x, 0, z);
    return registerFurniture(entity, "Wardrobe", WARDROBE_RADIUS);
}

export function createSofa(world: World, x: number, z: number): FurnitureItem {
    const root = new Group();

    const bodyMat = registerMaterial(
        "sofaBody",
        new MeshStandardMaterial({
            color: new Color(0x8b5a35),
            roughness: 0.9,
        })
    );
    const seatMat = registerMaterial(
        "sofaBody",
        new MeshStandardMaterial({
            color: new Color(0x8b5a35),
            roughness: 0.9,
        })
    );
    const armMat = registerMaterial(
        "sofaBody",
        new MeshStandardMaterial({
            color: new Color(0x8b5a35),
            roughness: 0.9,
        })
    );

    const base = new Mesh(new BoxGeometry(1.9, 0.15, 0.9), bodyMat);
    base.position.set(0, 0.2, 0);
    root.add(base);

    const seat = new Mesh(new BoxGeometry(1.8, 0.25, 0.8), seatMat);
    seat.position.set(0, 0.4, 0);
    root.add(seat);

    const back = new Mesh(new BoxGeometry(1.8, 0.55, 0.12), seatMat);
    back.position.set(0, 0.8, -0.34);
    root.add(back);

    const armGeom = new BoxGeometry(0.12, 0.5, 0.8);
    const leftArm = new Mesh(armGeom, armMat);
    leftArm.position.set(-0.9, 0.65, 0);
    root.add(leftArm);
    const rightArm = new Mesh(armGeom, armMat);
    rightArm.position.set(0.9, 0.65, 0);
    root.add(rightArm);

    const warmCushionMat = registerMaterial(
        "sofaCushionWarm",
        new MeshStandardMaterial({
            color: new Color(0xf4c542),
            roughness: 0.98,
        })
    );
    const lightCushionMat = registerMaterial(
        "sofaCushionLight",
        new MeshStandardMaterial({
            color: new Color(0xf4c542),
            roughness: 0.98,
        })
    );

    const cushionGeom = new BoxGeometry(0.55, 0.25, 0.3);

    const cushion1 = new Mesh(cushionGeom, warmCushionMat);
    cushion1.position.set(-0.3, 0.9, -0.25);
    root.add(cushion1);

    const cushion2 = new Mesh(cushionGeom, lightCushionMat);
    cushion2.position.set(0.3, 0.9, -0.25);
    root.add(cushion2);

    const entity = world.createTransformEntity(root);
    setEntityPosition(entity, x, 0, z);
    return registerFurniture(entity, "Sofa", SOFA_RADIUS, 0.9);
}

export function createCoffeeTable(
    world: World,
    x: number,
    z: number
): FurnitureItem {
    const root = new Group();
    const tableMat = registerMaterial(
        "coffeeTable",
        new MeshStandardMaterial({
            color: new Color(0x222222),
            roughness: 0.7,
            metalness: 0.05,
        })
    );
    const shelfMat = registerMaterial(
        "coffeeTable",
        new MeshStandardMaterial({
            color: new Color(0x222222),
            roughness: 0.8,
            metalness: 0.02,
        })
    );

    const top = new Mesh(new BoxGeometry(1.0, 0.06, 0.6), tableMat);
    top.position.set(0, 0.45, 0);
    root.add(top);

    const shelf = new Mesh(new BoxGeometry(0.96, 0.05, 0.56), shelfMat);
    shelf.position.set(0, 0.25, 0);
    root.add(shelf);

    const legGeom = new BoxGeometry(0.07, 0.42, 0.07);
    const legMat = shelfMat;
    const legPositions = [
        [-0.47, 0.21, -0.28],
        [0.47, 0.21, -0.28],
        [-0.47, 0.21, 0.28],
        [0.47, 0.21, 0.28],
    ];
    for (const [lx, ly, lz] of legPositions) {
        const leg = new Mesh(legGeom, legMat);
        leg.position.set(lx, ly, lz);
        root.add(leg);
    }

    const entity = world.createTransformEntity(root);
    setEntityPosition(entity, x, 0, z);
    return registerFurniture(entity, "CoffeeTable", COFFEE_RADIUS, 1.0);
}

export function createRug(world: World, x: number, z: number): FurnitureItem {
    const root = new Group();

    const rugMat = registerMaterial(
        "rug",
        new MeshStandardMaterial({
            color: new Color(0xf7f7f7),
            roughness: 0.98,
            metalness: 0,
        })
    );
    const rug = new Mesh(new BoxGeometry(3.4, 0.02, 2.4), rugMat);
    rug.position.set(0, 0.01, 0);
    root.add(rug);

    const entity = world.createTransformEntity(root);
    setEntityPosition(entity, x, 0, z);
    return registerFurniture(entity, "Rug", RUG_RADIUS, 1.0);
}

export function createPartition(
    world: World,
    x: number,
    z: number
): FurnitureItem {
    const root = new Group();

    const frameMat = registerMaterial(
        "partitionFrame",
        new MeshStandardMaterial({
            color: new Color(0x141414),
            roughness: 0.35,
            metalness: 0.6,
        })
    );

    const glassMat = registerMaterial(
        "partitionGlass",
        new MeshStandardMaterial({
            color: new Color(0xffffff),
            transparent: true,
            opacity: 0.08,
            roughness: 0.1,
            metalness: 0,
        })
    );

    const width = 1.8;
    const height = 2.2;
    const thick = 0.04;

    const bottom = new Mesh(new BoxGeometry(width, 0.06, thick), frameMat);
    bottom.position.set(0, 0.03, 0);
    root.add(bottom);

    const top = new Mesh(new BoxGeometry(width, 0.06, thick), frameMat);
    top.position.set(0, height - 0.03, 0);
    root.add(top);

    const left = new Mesh(new BoxGeometry(0.06, height, thick), frameMat);
    left.position.set(-width / 2, height / 2, 0);
    root.add(left);

    const right = new Mesh(new BoxGeometry(0.06, height, thick), frameMat);
    right.position.set(width / 2, height / 2, 0);
    root.add(right);

    const verticalCount = 3;
    const vSpacing = width / (verticalCount + 1);
    for (let i = 1; i <= verticalCount; i++) {
        const bar = new Mesh(
            new BoxGeometry(0.04, height - 0.12, thick),
            frameMat
        );
        bar.position.set(-width / 2 + i * vSpacing, height / 2, 0);
        root.add(bar);
    }

    const mid = new Mesh(new BoxGeometry(width - 0.12, 0.04, thick), frameMat);
    mid.position.set(0, height / 2, 0);
    root.add(mid);

    const glass = new Mesh(
        new BoxGeometry(width - 0.14, height - 0.14, thick * 0.5),
        glassMat
    );
    glass.position.set(0, height / 2, 0);
    root.add(glass);

    const entity = world.createTransformEntity(root);
    setEntityPosition(entity, x, 0, z);
    return registerFurniture(entity, "Partition", PARTITION_RADIUS, 1.0);
}

export function createLamp(world: World, x: number, z: number): FurnitureItem {
    const root = new Group();

    const poleMat = registerMaterial(
        "lampPole",
        new MeshStandardMaterial({
            color: new Color(0x222222),
            roughness: 0.4,
            metalness: 0.7,
        })
    );

    const base = new Mesh(new CylinderGeometry(0.18, 0.18, 0.04, 20), poleMat);
    base.position.set(0, 0.02, 0);
    root.add(base);

    const pole = new Mesh(new CylinderGeometry(0.03, 0.03, 1.4, 12), poleMat);
    pole.position.set(0, 0.75, 0);
    root.add(pole);

    const shadeMat = registerMaterial(
        "lampShade",
        new MeshStandardMaterial({
            color: new Color(0xf5f1e6),
            emissive: new Color(0xfff2c7),
            emissiveIntensity: 0.3,
            roughness: 0.85,
            metalness: 0.0,
        }) as any
    );
    const shade = new Mesh(new CylinderGeometry(0.18, 0.18, 0.5, 20), shadeMat);
    shade.position.set(0, 1.45, 0);
    root.add(shade);

    const entity = world.createTransformEntity(root);
    setEntityPosition(entity, x, 0, z);
    return registerFurniture(entity, "Lamp", LAMP_RADIUS, 1.0);
}

// ===== Layout & deletion =====

export function destroyAllFurniture(world: World) {
    for (const item of furniture) {
        if (typeof item.entity.destroy === "function") {
            item.entity.destroy();
        } else if (item.entity.object3D) {
            world.scene.remove(item.entity.object3D);
        }
    }
    furniture.length = 0;
    selectedItem = null;
    notifySelectionChanged();
}

export function setScandiStudioLayout(world: World) {
    destroyAllFurniture(world);

    const bed = createBed(world, -2.1, -0.45);
    const bedOrientation = bed.entity.getVectorView(Transform, "orientation");
    if (bedOrientation) {
        rotateQuaternionY(bedOrientation, Math.PI / 2);
    }

    createWardrobe(world, -1.0, -0.35);

    const partition = createPartition(world, -0.1, 0.2);
    const partOrientation = partition.entity.getVectorView(
        Transform,
        "orientation"
    );
    if (partOrientation) {
        rotateQuaternionY(partOrientation, Math.PI / 2);
    }

    createRug(world, 1.2, 0.9);
    createSofa(world, 1.6, 0.4);
    createCoffeeTable(world, 1.6, 1.3);
    createLamp(world, -2.4, 1.0);

    selectItem(partition);
}

export function setDefaultLayout(world: World) {
    setScandiStudioLayout(world);
}

export function deleteSelectedFurniture(world: World) {
    if (!selectedItem) return;
    const item = selectedItem;
    const idx = furniture.indexOf(item);
    if (idx >= 0) furniture.splice(idx, 1);

    if (typeof item.entity.destroy === "function") {
        item.entity.destroy();
    } else if (item.entity.object3D) {
        world.scene.remove(item.entity.object3D);
    }

    selectedItem = null;
    notifySelectionChanged();
}
