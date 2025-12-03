import { Transform } from "@iwsdk/core";

export function setEntityPosition(
    entity: any,
    x: number,
    y: number,
    z: number
) {
    const pos = entity.getVectorView(Transform, "position");
    pos[0] = x;
    pos[1] = y;
    pos[2] = z;
}

export function rotateQuaternionY(q: Float32Array, deltaRad: number) {
    const half = deltaRad * 0.5;
    const s = Math.sin(half);
    const c = Math.cos(half);

    const dx = 0;
    const dy = s;
    const dz = 0;
    const dw = c;

    const x = q[0];
    const y = q[1];
    const z = q[2];
    const w = q[3];

    const nx = dw * x + dx * w + dy * z - dz * y;
    const ny = dw * y - dx * z + dy * w + dz * x;
    const nz = dw * z + dx * y - dy * x + dz * w;
    const nw = dw * w - dx * x - dy * y - dz * z;

    const invLen = 1 / Math.hypot(nx, ny, nz, nw);
    q[0] = nx * invLen;
    q[1] = ny * invLen;
    q[2] = nz * invLen;
    q[3] = nw * invLen;
}
