// resizeIcon.ts
import { Texture, TextureLoader } from "three";

const RESIZE_ICON_URL = "resize-icon.png";

let resizeIconTexture: Texture | null = null;

export function getResizeIconTexture(): Texture {
    if (resizeIconTexture) return resizeIconTexture;
    const loader = new TextureLoader();
    resizeIconTexture = loader.load(RESIZE_ICON_URL);
    return resizeIconTexture;
}
