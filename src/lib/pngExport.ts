const EXPORT_BACKGROUND = "#f3f5f7";

// Render a DOM element to PNG bytes without a screenshot API: clone the node,
// inline its computed styles, wrap it in an <svg><foreignObject>, and rasterize
// through a canvas. This keeps PNG export self-contained in the renderer.
export async function renderTimelinePng(element: HTMLElement): Promise<Uint8Array> {
  const width = Math.ceil(element.getBoundingClientRect().width);
  const height = Math.ceil(element.getBoundingClientRect().height);
  if (width <= 0 || height <= 0) {
    throw new Error("Timeline is not visible.");
  }

  const clone = element.cloneNode(true) as HTMLElement;
  // Drop transient/interaction-only overlays from the exported image.
  clone.querySelectorAll(".point-tooltip, .export-exclude").forEach((node) => node.remove());
  inlineComputedStyles(element, clone);
  clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  clone.style.margin = "0";
  clone.style.background = EXPORT_BACKGROUND;

  const serialized = new XMLSerializer().serializeToString(clone);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <foreignObject width="100%" height="100%">${serialized}</foreignObject>
  </svg>`;
  const imageUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const image = await loadImage(imageUrl);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not create PNG canvas.");
  }
  context.fillStyle = EXPORT_BACKGROUND;
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0);
  return dataUrlToBytes(canvas.toDataURL("image/png"));
}

// foreignObject ignores external stylesheets, so styles must be copied onto each
// cloned node explicitly, preserving the source tree order.
function inlineComputedStyles(source: Element, target: Element) {
  const computed = window.getComputedStyle(source);
  const targetElement = target as HTMLElement | SVGElement;
  for (const property of computed) {
    targetElement.style.setProperty(property, computed.getPropertyValue(property), computed.getPropertyPriority(property));
  }

  const sourceChildren = Array.from(source.children);
  const targetChildren = Array.from(target.children);
  sourceChildren.forEach((sourceChild, index) => {
    const targetChild = targetChildren[index];
    if (targetChild) {
      inlineComputedStyles(sourceChild, targetChild);
    }
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not render timeline PNG."));
    image.src = src;
  });
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",", 2)[1];
  if (!base64) {
    throw new Error("Could not encode timeline PNG.");
  }
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
