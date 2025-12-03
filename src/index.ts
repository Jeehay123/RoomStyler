// index.ts
import {
    World,
    SessionMode,
    BoxGeometry,
    Mesh,
    MeshStandardMaterial,
    AmbientLight,
    DirectionalLight,
    Transform,
} from "@iwsdk/core";

import { Color, Raycaster, Vector2 } from "three";

import {
    ROOM_WIDTH,
    ROOM_DEPTH,
    WALL_HEIGHT,
    ROTATE_SENSITIVITY,
    BED_RADIUS,
    DESK_RADIUS,
    CHAIR_RADIUS,
    WARDROBE_RADIUS,
    SOFA_RADIUS,
    COFFEE_RADIUS,
    RUG_RADIUS,
    PARTITION_RADIUS,
    LAMP_RADIUS,
    MaterialGroupKey,
} from "./sceneConfig";
import { materialGroups, registerMaterial, setGroupColor } from "./materials";
import { setEntityPosition, rotateQuaternionY } from "./transformHelpers";
import {
    furniture,
    FurnitureItem,
    selectedItem,
    addSelectionListener,
    selectItem,
    findNonOverlappingPosition,
    resizeSelectedFromDrag,
    setDefaultLayout,
    deleteSelectedFurniture,
    createBed,
    createChair,
    createCoffeeTable,
    createDesk,
    createLamp,
    createPartition,
    createRug,
    createSofa,
    createWardrobe,
} from "./furniture";

// ===== Global state =====
let floorMeshRef: Mesh | null = null;
let selectedLabel: HTMLDivElement | null = null;

type DragMode = "none" | "move" | "scale" | "rotate";
let dragMode: DragMode = "none";
let dragItem: FurnitureItem | null = null;
let dragStartMouseX = 0;
let dragStartScale = 1;
let dragOffsetXZ = { x: 0, z: 0 };
let rotateLastMouseX = 0;

const sceneContainer = document.getElementById(
    "scene-container"
) as HTMLDivElement | null;

if (!sceneContainer) {
    throw new Error("scene-container div not found in index.html");
}

const container = sceneContainer as HTMLDivElement;

World.create(container, {
    xr: {
        sessionMode: SessionMode.ImmersiveVR,
        offer: "always",
    },
    features: {
        locomotion: { useWorker: true },
        grabbing: true,
        physics: false,
        sceneUnderstanding: false,
    },
}).then((world) => {
    // Camera & lights
    world.camera.position.set(0, 1.7, 5.2);
    world.camera.lookAt(0, 1.2, 0);

    const ambient = new AmbientLight(0xffffff, 0.9);
    const dirLight = new DirectionalLight(0xffffff, 0.7);
    dirLight.position.set(3, 5, 2);
    world.scene.add(ambient);
    world.scene.add(dirLight);

    // Room shell materials
    const floorMaterial = registerMaterial(
        "floor",
        new MeshStandardMaterial({
            color: new Color(0xc89a6d),
            roughness: 0.85,
            metalness: 0.1,
        })
    );
    const wallMaterial = registerMaterial(
        "walls",
        new MeshStandardMaterial({
            color: new Color(0xe4e1dd),
            roughness: 1.0,
            metalness: 0.0,
        })
    );

    world.scene.background = new Color(0xf3f4f6);

    function createRoomShell() {
        // Floor
        const floorMesh = new Mesh(
            new BoxGeometry(ROOM_WIDTH, 0.1, ROOM_DEPTH),
            floorMaterial
        );
        const floorEntity = world.createTransformEntity(floorMesh);
        setEntityPosition(floorEntity, 0, -0.05, 0);
        floorMeshRef = floorMesh;

        // Back wall
        const backWallMesh = new Mesh(
            new BoxGeometry(ROOM_WIDTH, WALL_HEIGHT, 0.05),
            wallMaterial
        );
        const backWallEntity = world.createTransformEntity(backWallMesh);
        setEntityPosition(backWallEntity, 0, WALL_HEIGHT / 2, -ROOM_DEPTH / 2);

        // Left wall
        const leftWallMesh = new Mesh(
            new BoxGeometry(0.05, WALL_HEIGHT, ROOM_DEPTH),
            wallMaterial
        );
        const leftWallEntity = world.createTransformEntity(leftWallMesh);
        setEntityPosition(leftWallEntity, -ROOM_WIDTH / 2, WALL_HEIGHT / 2, 0);

        // Right wall (slightly shorter, shifted forward)
        const rightWallMesh = new Mesh(
            new BoxGeometry(0.05, WALL_HEIGHT, ROOM_DEPTH * 0.7),
            wallMaterial
        );
        const rightWallEntity = world.createTransformEntity(rightWallMesh);
        setEntityPosition(
            rightWallEntity,
            ROOM_WIDTH / 2,
            WALL_HEIGHT / 2,
            ROOM_DEPTH * 0.15
        );
    }

    createRoomShell();

    // Update text in the "Selected: ..." status label
    function updateSelectedLabel() {
        if (!selectedLabel) return;
        if (selectedItem) {
            selectedLabel.textContent = `Selected: ${selectedItem.label} – drag to move, drag the resize icon to scale, drag the blue ring to rotate.`;
        } else {
            selectedLabel.textContent =
                "Selected: none. Click empty space to deselect.";
        }
    }

    // ===== UI Panel =====
    const uiRoot = document.createElement("div");
    uiRoot.style.position = "absolute";
    uiRoot.style.top = "0";
    uiRoot.style.left = "0";
    uiRoot.style.right = "0";
    uiRoot.style.padding = "8px 16px 10px 16px";
    uiRoot.style.borderRadius = "0 0 12px 12px";
    uiRoot.style.background = "rgba(15,16,20,0.85)";
    uiRoot.style.color = "#ffffff";
    uiRoot.style.fontFamily =
        '-apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", sans-serif';
    uiRoot.style.display = "flex";
    uiRoot.style.flexDirection = "column";
    uiRoot.style.alignItems = "stretch";
    uiRoot.style.gap = "6px";
    uiRoot.style.zIndex = "10";
    uiRoot.style.pointerEvents = "auto";
    uiRoot.style.maxWidth = "100%";
    uiRoot.style.boxSizing = "border-box";

    const headerRow = document.createElement("div");
    headerRow.style.display = "flex";
    headerRow.style.alignItems = "center";
    headerRow.style.justifyContent = "space-between";
    headerRow.style.gap = "12px";
    uiRoot.appendChild(headerRow);

    const titleGroup = document.createElement("div");
    titleGroup.style.display = "flex";
    titleGroup.style.flexDirection = "column";
    titleGroup.style.gap = "2px";
    headerRow.appendChild(titleGroup);

    const title = document.createElement("div");
    title.textContent = "RoomStyler – VR Interior Planner";
    title.style.fontSize = "14px";
    title.style.fontWeight = "600";
    titleGroup.appendChild(title);

    const subtitle = document.createElement("div");
    subtitle.textContent =
        "Use the buttons to add furniture. Select an item to change its colors.";
    subtitle.style.fontSize = "11px";
    subtitle.style.opacity = "0.85";
    subtitle.style.lineHeight = "1.3";
    titleGroup.appendChild(subtitle);

    selectedLabel = document.createElement("div");
    selectedLabel.style.fontSize = "11px";
    selectedLabel.style.opacity = "0.92";
    headerRow.appendChild(selectedLabel);

    const toggleBtn = document.createElement("button");
    toggleBtn.textContent = "Hide panel";
    toggleBtn.style.padding = "6px 10px";
    toggleBtn.style.borderRadius = "999px";
    toggleBtn.style.border = "none";
    toggleBtn.style.fontSize = "11px";
    toggleBtn.style.cursor = "pointer";
    toggleBtn.style.background = "#ffffff";
    toggleBtn.style.color = "#111827";
    toggleBtn.style.fontWeight = "500";
    toggleBtn.onmouseenter = () => {
        toggleBtn.style.background = "#e5e7eb";
    };
    toggleBtn.onmouseleave = () => {
        toggleBtn.style.background = "#ffffff";
    };
    headerRow.appendChild(toggleBtn);

    const controlsBody = document.createElement("div");
    controlsBody.style.display = "flex";
    controlsBody.style.flexWrap = "wrap";
    controlsBody.style.alignItems = "flex-start";
    controlsBody.style.gap = "8px 24px";
    uiRoot.appendChild(controlsBody);

    let controlsVisible = true;
    toggleBtn.onclick = () => {
        controlsVisible = !controlsVisible;
        controlsBody.style.display = controlsVisible ? "flex" : "none";
        toggleBtn.textContent = controlsVisible ? "Hide panel" : "Show panel";
    };

    // Left column: layout + add-furniture controls
    const layoutColumn = document.createElement("div");
    layoutColumn.style.display = "flex";
    layoutColumn.style.flexDirection = "column";
    layoutColumn.style.gap = "6px";
    controlsBody.appendChild(layoutColumn);

    const topButtonsRow = document.createElement("div");
    topButtonsRow.style.display = "flex";
    topButtonsRow.style.flexWrap = "wrap";
    topButtonsRow.style.gap = "8px";
    layoutColumn.appendChild(topButtonsRow);

    function makeButton(label: string, onClick: () => void) {
        const btn = document.createElement("button");
        btn.textContent = label;
        btn.style.padding = "8px 14px";
        btn.style.borderRadius = "999px";
        btn.style.border = "none";
        btn.style.fontSize = "12px";
        btn.style.cursor = "pointer";
        btn.style.background = "#ffffff";
        btn.style.color = "#111827";
        btn.style.fontWeight = "500";
        btn.onmouseenter = () => {
            btn.style.background = "#e5e7eb";
        };
        btn.onmouseleave = () => {
            btn.style.background = "#ffffff";
        };
        btn.onclick = onClick;
        return btn;
    }

    topButtonsRow.appendChild(
        makeButton("Default layout", () => setDefaultLayout(world))
    );
    topButtonsRow.appendChild(
        makeButton("Remove selected", () => deleteSelectedFurniture(world))
    );

    const addContainer = document.createElement("div");
    addContainer.style.display = "flex";
    addContainer.style.flexDirection = "column";
    addContainer.style.gap = "4px";
    layoutColumn.appendChild(addContainer);

    const addHeaderBtn = document.createElement("button");
    addHeaderBtn.textContent = "Add furniture ▾";
    addHeaderBtn.style.alignSelf = "flex-start";
    addHeaderBtn.style.padding = "6px 10px";
    addHeaderBtn.style.borderRadius = "999px";
    addHeaderBtn.style.border = "none";
    addHeaderBtn.style.fontSize = "12px";
    addHeaderBtn.style.cursor = "pointer";
    addHeaderBtn.style.background = "#111827";
    addHeaderBtn.style.color = "#ffffff";
    addHeaderBtn.style.fontWeight = "500";
    addHeaderBtn.onmouseenter = () => {
        addHeaderBtn.style.background = "#1f2937";
    };
    addHeaderBtn.onmouseleave = () => {
        addHeaderBtn.style.background = "#111827";
    };
    addContainer.appendChild(addHeaderBtn);

    const addList = document.createElement("div");
    addList.style.display = "flex";
    addList.style.flexDirection = "column";
    addList.style.borderRadius = "10px";
    addList.style.background = "rgba(17,24,39,0.9)";
    addList.style.padding = "4px 0";
    addList.style.minWidth = "150px";
    addContainer.appendChild(addList);

    let addOpen = true;
    addHeaderBtn.onclick = () => {
        addOpen = !addOpen;
        addList.style.display = addOpen ? "flex" : "none";
        addHeaderBtn.textContent = addOpen
            ? "Add furniture ▾"
            : "Add furniture ▸";
    };

    function makeAddMenuItem(label: string, onClick: () => void) {
        const btn = document.createElement("button");
        btn.textContent = label;
        btn.style.border = "none";
        btn.style.background = "transparent";
        btn.style.padding = "6px 14px";
        btn.style.textAlign = "left";
        btn.style.color = "#f9fafb";
        btn.style.fontSize = "12px";
        btn.style.cursor = "pointer";
        btn.style.width = "100%";
        btn.onmouseenter = () => {
            btn.style.background = "rgba(55,65,81,0.9)";
        };
        btn.onmouseleave = () => {
            btn.style.background = "transparent";
        };
        btn.onclick = onClick;
        addList.appendChild(btn);
    }

    // Individual furniture add menu
    makeAddMenuItem("Bed", () => {
        const p = findNonOverlappingPosition(BED_RADIUS * 0.8);
        const item = createBed(world, p.x, p.z);
        selectItem(item);
    });
    makeAddMenuItem("Sofa", () => {
        const p = findNonOverlappingPosition(SOFA_RADIUS * 0.8);
        const item = createSofa(world, p.x, p.z);
        selectItem(item);
    });
    makeAddMenuItem("Coffee table", () => {
        const p = findNonOverlappingPosition(COFFEE_RADIUS * 0.8);
        const item = createCoffeeTable(world, p.x, p.z);
        selectItem(item);
    });
    makeAddMenuItem("Chair", () => {
        const p = findNonOverlappingPosition(CHAIR_RADIUS * 0.8);
        const item = createChair(world, p.x, p.z);
        selectItem(item);
    });
    makeAddMenuItem("Desk", () => {
        const p = findNonOverlappingPosition(DESK_RADIUS * 0.8);
        const item = createDesk(world, p.x, p.z);
        selectItem(item);
    });
    makeAddMenuItem("Wardrobe", () => {
        const p = findNonOverlappingPosition(WARDROBE_RADIUS * 0.8);
        const item = createWardrobe(world, p.x, p.z);
        selectItem(item);
    });
    makeAddMenuItem("Partition", () => {
        const p = findNonOverlappingPosition(PARTITION_RADIUS * 0.8);
        const item = createPartition(world, p.x, p.z);
        selectItem(item);
    });
    makeAddMenuItem("Rug", () => {
        const p = findNonOverlappingPosition(RUG_RADIUS * 0.8);
        const item = createRug(world, p.x, p.z);
        selectItem(item);
    });
    makeAddMenuItem("Lamp", () => {
        const p = findNonOverlappingPosition(LAMP_RADIUS * 0.8);
        const item = createLamp(world, p.x, p.z);
        selectItem(item);
    });

    // ----- Right side: color panel -----
    const colorsColumn = document.createElement("div");
    colorsColumn.style.display = "flex";
    colorsColumn.style.flexDirection = "column";
    colorsColumn.style.gap = "2px";
    colorsColumn.style.minWidth = "230px";
    controlsBody.appendChild(colorsColumn);

    function makeColorRow(
        labelText: string,
        group: MaterialGroupKey,
        fallbackHex: string
    ) {
        const line = document.createElement("div");
        line.style.display = "flex";
        line.style.alignItems = "center";
        line.style.gap = "8px";
        line.style.marginTop = "2px";

        const label = document.createElement("span");
        label.textContent = labelText;
        label.style.fontSize = "11px";
        label.style.minWidth = "140px";

        const input = document.createElement("input");
        input.type = "color";
        input.style.border = "none";
        input.style.background = "transparent";
        input.style.width = "32px";
        input.style.height = "18px";
        input.style.padding = "0";

        const mats = materialGroups[group];
        if (mats.length > 0) {
            input.value = "#" + mats[0].color.getHexString();
        } else {
            input.value = fallbackHex;
        }

        input.oninput = () => setGroupColor(group, input.value);

        line.appendChild(label);
        line.appendChild(input);
        colorsColumn.appendChild(line);
    }

    const rebuildColorControls = () => {
        colorsColumn.innerHTML = "";

        const header = document.createElement("div");
        header.style.fontSize = "12px";
        header.style.fontWeight = "500";
        header.style.opacity = "0.9";
        header.style.marginBottom = "2px";

        if (!selectedItem) {
            header.textContent = "Colors – scene (no furniture selected)";
            colorsColumn.appendChild(header);

            const hint = document.createElement("div");
            hint.textContent =
                "Tip: click a bed/sofa/etc. to edit its colors. When nothing is selected, you can recolor walls and floor.";
            hint.style.fontSize = "10px";
            hint.style.opacity = "0.8";
            hint.style.marginBottom = "4px";
            colorsColumn.appendChild(hint);

            makeColorRow("Walls", "walls", "#e4e1dd");
            makeColorRow("Floor", "floor", "#c89a6d");
            return;
        }

        header.textContent = `Colors – ${selectedItem.label}`;
        colorsColumn.appendChild(header);

        const kind = selectedItem.kind;
        if (kind === "Bed") {
            makeColorRow("Frame / headboard", "bedMain", "#8b7d71");
            makeColorRow("Bedding / blanket", "bedTextile", "#d0d3d8");
        } else if (kind === "Sofa") {
            makeColorRow("Sofa body", "sofaBody", "#8b5a35");
            makeColorRow("Cushion (warm)", "sofaCushionWarm", "#f4c542");
            makeColorRow("Cushion (light)", "sofaCushionLight", "#f4c542");
        } else if (kind === "Desk") {
            makeColorRow("Desk wood / legs", "desk", "#d1b79a");
        } else if (kind === "Chair") {
            makeColorRow("Chair seat / frame", "chair", "#d6b89a");
        } else if (kind === "Wardrobe") {
            makeColorRow("Wardrobe body", "wardrobeMain", "#444444");
            makeColorRow("Front panel", "wardrobeAccent", "#f4f5f7");
            makeColorRow("Handles", "wardrobeHandle", "#111111");
        } else if (kind === "CoffeeTable") {
            makeColorRow("Coffee table", "coffeeTable", "#222222");
        } else if (kind === "Rug") {
            makeColorRow("Rug", "rug", "#f7f7f7");
        } else if (kind === "Partition") {
            makeColorRow("Frame", "partitionFrame", "#141414");
            makeColorRow("Glass", "partitionGlass", "#ffffff");
        } else if (kind === "Lamp") {
            makeColorRow("Pole / base", "lampPole", "#222222");
            makeColorRow("Shade", "lampShade", "#f5f1e6");
        }
    };

    // When selection changes → update label & color panel
    addSelectionListener(() => {
        updateSelectedLabel();
        rebuildColorControls();
    });

    // Attach UI DOM to the document
    document.body.appendChild(uiRoot);
    updateSelectedLabel();
    rebuildColorControls();

    // ===== Pointer-based move / scale / rotate =====
    const raycaster = new Raycaster();
    const mouse = new Vector2();

    function updateMouseFromEvent(event: MouseEvent) {
        const rect = container.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        mouse.set(x, y);
    }

    function onPointerDown(event: MouseEvent) {
        if (event.button !== 0) return;
        if (!floorMeshRef) return;

        event.preventDefault();
        updateMouseFromEvent(event);
        raycaster.setFromCamera(mouse, world.camera);

        const clickTargets: any[] = [];
        for (const item of furniture) {
            if (item.entity.object3D) clickTargets.push(item.entity.object3D);
            if (item.scaleHandle) clickTargets.push(item.scaleHandle);
            if (item.selectionRing) clickTargets.push(item.selectionRing);
        }

        if (clickTargets.length === 0) {
            selectItem(null);
            return;
        }

        const intersects = raycaster.intersectObjects(clickTargets, true);
        if (intersects.length === 0) {
            selectItem(null);
            return;
        }

        const hitObj = intersects[0].object as any;

        // --- 1) scale handle? ---
        let handleItem: FurnitureItem | null = null;
        {
            let current: any = hitObj;
            while (current) {
                handleItem =
                    furniture.find((f) => f.scaleHandle === current) ?? null;
                if (handleItem) break;
                current = current.parent;
            }
        }

        if (handleItem) {
            selectItem(handleItem);
            dragMode = "scale";
            dragItem = handleItem;
            dragStartMouseX = event.clientX;
            dragStartScale = handleItem.baseScale;
            return;
        }

        // --- 2) ring → rotate ---
        let ringItem: FurnitureItem | null = null;
        {
            let current: any = hitObj;
            while (current) {
                ringItem =
                    furniture.find((f) => f.selectionRing === current) ?? null;
                if (ringItem) break;
                current = current.parent;
            }
        }

        if (ringItem) {
            selectItem(ringItem);
            dragMode = "rotate";
            dragItem = ringItem;
            rotateLastMouseX = event.clientX;
            return;
        }

        // --- 3) furniture body → move ---
        const roots = furniture
            .map((f) => f.entity.object3D as any)
            .filter((obj) => !!obj);

        let root: any = hitObj;
        while (root.parent && !roots.includes(root)) {
            root = root.parent;
        }

        const item = furniture.find((f) => f.entity.object3D === root) ?? null;
        if (!item) {
            selectItem(null);
            return;
        }

        selectItem(item);
        dragMode = "move";
        dragItem = item;

        const floorHits = raycaster.intersectObject(floorMeshRef, false);
        if (floorHits.length > 0) {
            const hitPoint = floorHits[0].point;
            const pos = item.entity.getVectorView(Transform, "position");
            dragOffsetXZ = {
                x: hitPoint.x - pos[0],
                z: hitPoint.z - pos[2],
            };
        } else {
            dragOffsetXZ = { x: 0, z: 0 };
        }
    }

    function onPointerMove(event: MouseEvent) {
        if (dragMode === "none" || !dragItem) return;
        if (!floorMeshRef) return;

        updateMouseFromEvent(event);
        raycaster.setFromCamera(mouse, world.camera);

        if (dragMode === "move") {
            const floorHits = raycaster.intersectObject(floorMeshRef, false);
            if (floorHits.length === 0) return;
            const p = floorHits[0].point;
            const newX = p.x - dragOffsetXZ.x;
            const newZ = p.z - dragOffsetXZ.z;
            setEntityPosition(dragItem.entity, newX, 0, newZ);
        } else if (dragMode === "scale") {
            const deltaX = event.clientX - dragStartMouseX;
            let factor = 1 + deltaX / 300;
            if (factor < 0.2) factor = 0.2;
            if (factor > 3.0) factor = 3.0;
            resizeSelectedFromDrag(factor);
        } else if (dragMode === "rotate") {
            const dx = event.clientX - rotateLastMouseX;
            if (dx === 0) return;
            rotateLastMouseX = event.clientX;

            const entity = dragItem.entity;
            const orientation = entity.getVectorView(Transform, "orientation");
            if (!orientation) return;

            const deltaRad = dx * ROTATE_SENSITIVITY;
            rotateQuaternionY(orientation, deltaRad);
        }
    }

    function onPointerUp() {
        dragMode = "none";
        dragItem = null;
    }

    container.addEventListener("mousedown", onPointerDown);
    window.addEventListener("mousemove", onPointerMove);
    window.addEventListener("mouseup", onPointerUp);

    // ===== Initial layout =====
    setDefaultLayout(world);
});
