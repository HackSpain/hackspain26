import { ExtrudeGeometry, Shape } from "three";

export const CARD_FRONT_MATERIAL = 0;
export const CARD_BACK_MATERIAL = 1;
export const CARD_EDGE_MATERIAL = 2;

/**
 * Edge triangles are perfectly vertical walls, so their signed area in XY is
 * exactly zero. Only floating-point noise has to be tolerated — a magnitude
 * threshold would misclassify the small triangles in the rounded corners.
 */
const FACING_EPSILON = 1e-9;
const CORNER_SEGMENTS = 8;

function roundedCardShape(
  width: number,
  height: number,
  radius: number
): Shape {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const shape = new Shape();

  shape.moveTo(-halfWidth + radius, -halfHeight);
  shape.lineTo(halfWidth - radius, -halfHeight);
  shape.quadraticCurveTo(
    halfWidth,
    -halfHeight,
    halfWidth,
    -halfHeight + radius
  );
  shape.lineTo(halfWidth, halfHeight - radius);
  shape.quadraticCurveTo(halfWidth, halfHeight, halfWidth - radius, halfHeight);
  shape.lineTo(-halfWidth + radius, halfHeight);
  shape.quadraticCurveTo(
    -halfWidth,
    halfHeight,
    -halfWidth,
    halfHeight - radius
  );
  shape.lineTo(-halfWidth, -halfHeight + radius);
  shape.quadraticCurveTo(
    -halfWidth,
    -halfHeight,
    -halfWidth + radius,
    -halfHeight
  );

  return shape;
}

/**
 * ExtrudeGeometry writes shape-space coordinates into the UVs, so the artwork
 * would be sampled at world scale. Rescaling them to 0..1 makes the texture fit
 * the card exactly. Edge faces carry no map, so their UVs are free to follow.
 */
function normalizeUvs(
  geometry: ExtrudeGeometry,
  width: number,
  height: number
): void {
  const { uv } = geometry.attributes;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(
      i,
      (uv.getX(i) + width / 2) / width,
      (uv.getY(i) + height / 2) / height
    );
  }
  uv.needsUpdate = true;
}

/**
 * Both caps come out of `normalizeUvs` with the same mapping, which is right for
 * the front and mirrored for the back: turning the card over puts object +x on
 * the viewer's left, while u still grows with +x, so the reverse reads
 * right-to-left. Mirroring u on the back-facing triangles turns it back round.
 *
 * Done on the geometry rather than by flipping the texture, so anything mapped
 * to that face later is oriented correctly too. Safe per-triangle because
 * ExtrudeGeometry is non-indexed — no UV is shared with another triangle.
 */
function mirrorBackFaceUvs(geometry: ExtrudeGeometry): void {
  const { position } = geometry.attributes;
  const { uv } = geometry.attributes;

  for (let triangle = 0; triangle < position.count / 3; triangle++) {
    const first = triangle * 3;
    // Edge walls sit at a facing of zero and carry no map: leave them alone.
    if (triangleFacing(geometry, first) >= -FACING_EPSILON) {
      continue;
    }
    for (let corner = 0; corner < 3; corner++) {
      const index = first + corner;
      uv.setX(index, 1 - uv.getX(index));
    }
  }

  uv.needsUpdate = true;
}

/**
 * Splits the extrusion into front / back / edge draw groups by triangle facing,
 * so each side of the card can carry its own material.
 */
function assignFaceGroups(geometry: ExtrudeGeometry): void {
  const { position } = geometry.attributes;
  geometry.clearGroups();

  let runStart = 0;
  let runMaterial = -1;

  for (let triangle = 0; triangle < position.count / 3; triangle++) {
    const first = triangle * 3;
    const facing = triangleFacing(geometry, first);
    let material = CARD_EDGE_MATERIAL;
    if (facing > FACING_EPSILON) {
      material = CARD_FRONT_MATERIAL;
    } else if (facing < -FACING_EPSILON) {
      material = CARD_BACK_MATERIAL;
    }

    if (material !== runMaterial) {
      if (runMaterial !== -1) {
        geometry.addGroup(runStart, first - runStart, runMaterial);
      }
      runStart = first;
      runMaterial = material;
    }
  }

  geometry.addGroup(runStart, position.count - runStart, runMaterial);
}

/** Z component of the triangle normal — positive faces the viewer. */
function triangleFacing(geometry: ExtrudeGeometry, first: number): number {
  const { position } = geometry.attributes;
  const ax = position.getX(first);
  const ay = position.getY(first);
  const bx = position.getX(first + 1);
  const by = position.getY(first + 1);
  const cx = position.getX(first + 2);
  const cy = position.getY(first + 2);
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

export function createCardGeometry(
  width: number,
  height: number,
  depth: number,
  radius: number
): ExtrudeGeometry {
  const geometry = new ExtrudeGeometry(
    roundedCardShape(width, height, radius),
    { bevelEnabled: false, curveSegments: CORNER_SEGMENTS, depth }
  );

  geometry.translate(0, 0, -depth / 2);
  normalizeUvs(geometry, width, height);
  mirrorBackFaceUvs(geometry);
  assignFaceGroups(geometry);

  return geometry;
}
