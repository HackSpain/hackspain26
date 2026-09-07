import { Environment, Lightformer } from "@react-three/drei";
import type { ThreeElement } from "@react-three/fiber";
import { Canvas, extend, useFrame, useThree } from "@react-three/fiber";
import type { RapierRigidBody } from "@react-three/rapier";
import {
  BallCollider,
  CuboidCollider,
  Physics,
  RigidBody,
  useRapier,
  useRopeJoint,
  useSphericalJoint,
} from "@react-three/rapier";
import { MeshLineGeometry, MeshLineMaterial } from "meshline";
import type { RefObject } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { BufferGeometry, Mesh } from "three";
import {
  CanvasTexture,
  CatmullRomCurve3,
  DoubleSide,
  Euler,
  MeshPhysicalMaterial,
  Quaternion,
  RepeatWrapping,
  SRGBColorSpace,
  Vector3,
} from "three";
import { BADGE_PALETTE } from "./badge-roles";
import {
  CARD_BACK_MATERIAL,
  CARD_EDGE_MATERIAL,
  CARD_FRONT_MATERIAL,
  createCardGeometry,
} from "./card-geometry";
import {
  BADGE_BACK_TEXTURE_HEIGHT,
  BADGE_BACK_TEXTURE_WIDTH,
  BADGE_PORTRAIT_LEFT,
  BADGE_PORTRAIT_SIZE,
  BADGE_PORTRAIT_TOP,
  BADGE_TEXTURE_HEIGHT,
  BADGE_TEXTURE_WIDTH,
  drawBadgeBackTexture,
  drawBadgeTexture,
  drawLanyardTexture,
} from "./draw-badge-texture";
import { loadAvatarImage } from "./load-avatar-image";
import { loadLogoImage } from "./load-logo-image";

extend({ MeshLineGeometry, MeshLineMaterial });

declare module "@react-three/fiber" {
  interface ThreeElements {
    meshLineGeometry: ThreeElement<typeof MeshLineGeometry>;
    meshLineMaterial: ThreeElement<typeof MeshLineMaterial>;
  }
}

const CARD_WIDTH = 1.6;
const CARD_HEIGHT = 2.25;
const CARD_DEPTH = 0.045;
const CARD_RADIUS = 0.09;
const PHOTO_TARGET_WIDTH =
  (BADGE_PORTRAIT_SIZE / BADGE_TEXTURE_WIDTH) * CARD_WIDTH;
const PHOTO_TARGET_HEIGHT =
  (BADGE_PORTRAIT_SIZE / BADGE_TEXTURE_HEIGHT) * CARD_HEIGHT;
const PHOTO_TARGET_X =
  ((BADGE_PORTRAIT_LEFT + BADGE_PORTRAIT_SIZE / 2) / BADGE_TEXTURE_WIDTH -
    0.5) *
  CARD_WIDTH;
const PHOTO_TARGET_Y =
  (0.5 -
    (BADGE_PORTRAIT_TOP + BADGE_PORTRAIT_SIZE / 2) / BADGE_TEXTURE_HEIGHT) *
  CARD_HEIGHT;
const PHOTO_TARGET_Z = CARD_DEPTH / 2 + 0.002;
const BAND_WIDTH = 0.52;
/**
 * The metal clip between band and card: a slim crimp on top that takes the
 * band's end, and under it the ring it holds, threading the punched slot.
 * Purely cosmetic — the physics still runs through the joint.
 */
const CLIP_CRIMP_WIDTH = 0.18;
const CLIP_CRIMP_HEIGHT = 0.16;
const CLIP_CRIMP_DEPTH = 0.07;
const CLIP_RING_RADIUS = 0.1;
const CLIP_RING_TUBE = 0.03;
/**
 * Card-local placement. The printed slot spans y 0.966–1.041 and the card's
 * top edge sits at 1.125: centred at 1.10, the ring's lower tube passes
 * through the slot and its top clears the edge, encircling the strip the way
 * a real ring hangs a card. The crimp overlaps the ring's crown from above.
 */
const CLIP_RING_CENTER_Y = 1.1;
const CLIP_CRIMP_CENTER_Y =
  CLIP_RING_CENTER_Y + CLIP_RING_RADIUS + CLIP_CRIMP_HEIGHT / 2;
/** Just inside the crimp's mouth, so the band ends swallowed by the clip. */
const JOINT_ANCHOR_Y = CLIP_CRIMP_CENTER_Y + CLIP_CRIMP_HEIGHT / 4;
/**
 * The last two points of the drawn band, both read off the card rather than
 * off the rope it hangs from. The solver leaves the rope a little loose against
 * the card, and a spline takes its direction at the end from the next point
 * along: with only the endpoint pinned, that slack still swung the final
 * stretch a hair every frame and grazed it past the metal. Pinning the exit as
 * well fixes the tangent, so the band leaves the clip along the clip's own
 * axis — which is what a clamped strap does — and the seam stays buried.
 */
const BAND_END_Y = CLIP_CRIMP_CENTER_Y - CLIP_CRIMP_HEIGHT / 4;
const BAND_EXIT_Y = CLIP_CRIMP_CENTER_Y + CLIP_CRIMP_HEIGHT / 2 + 0.14;
const CLIP_COLOR = "#ccd2d9";
const CURVE_SEGMENTS = 32;
const MIN_LERP_SPEED = 10;
const MAX_LERP_SPEED = 50;
const MAX_FRAME_DELTA = 1 / 30;
/**
 * The rope lets the card travel four units from its anchor, which is further
 * than the camera sees. Releasing a fast drag handed it enough speed to reach
 * that, so it left the frame for a second and read as having vanished. Natural
 * swinging never gets near this, so only the violent throws are tamed.
 */
const MAX_CARD_SPEED = 10;
/** Per second, not per frame: pull toward the resting facing, and its brake. */
const FACING_GAIN = 6;
const FACING_DAMPING = 5;
const ROPE_SEGMENT_LENGTH = 1;
/**
 * Where the band is pinned, above the top of the frame. The card comes to rest
 * a rope's length below it, so this is what sets how high the badge hangs: it
 * used to park a little under the middle of the view, close to the panel along
 * the bottom.
 */
const ANCHOR_HEIGHT = 4.95;
const GRAVITY = 40;
/**
 * The badge hangs from a pivot 4.3 units above its middle, so a tilt of x
 * degrees parks it 4.3·sin(x) to the side. A phone now frames about 1.33 units
 * either side of centre and the card fills 0.8 of that, so much past six degrees
 * walks its edge out of the picture. It was 28° when a phone was framed from far
 * enough back to show twice the width.
 */
const MAX_TILT_DEGREES = 6;
const TILT_SMOOTHING = 6;
/** Ignores sensor noise while still waking the badge for deliberate movement. */
const TILT_WAKE_THRESHOLD_DEGREES = 0.25;
const DEGREES_TO_RADIANS = Math.PI / 180;
/**
 * How far the card turns out of the screen while it is held. Pinched in the
 * middle it stays square; pinched at an edge it turns to face the hand, and the
 * foreshortening that shows is what makes it read as a solid object rather than
 * a picture of one. Deliberately small — enough to catch the light along an
 * edge, not enough to become a spin.
 */
const MAX_DRAG_YAW = 22 * DEGREES_TO_RADIANS;
const MAX_DRAG_PITCH = 12 * DEGREES_TO_RADIANS;
/** Per second, so the turn eases in rather than snapping on the first frame. */
const DRAG_TURN_SMOOTHING = 8;
const LANYARD_TEXTURE_WIDTH = 512;
const LANYARD_TEXTURE_HEIGHT = 64;

interface BadgeContent {
  /**
   * The photo printed in the portrait frame, whether just dropped onto the page
   * or saved on an earlier visit. Wins over the GitHub avatar.
   */
  droppedPhoto: HTMLImageElement | null;
  firstName: string;
  /** GitHub handle, when they gave one — their avatar goes on the badge. */
  githubHandle: string | null;
  lastName: string;
}

interface BadgeProps {
  content: BadgeContent;
  /** Left out when the badge is only on display, as on a shared link. */
  onPhotoClick?: () => void;
  wind: RefObject<number>;
}

interface LanyardBadgeProps extends BadgeProps {
  tilt: RefObject<number | null>;
}

function createTextureCanvas(width: number, height: number) {
  const element = document.createElement("canvas");
  element.width = width;
  element.height = height;
  return element;
}

function createPrintTexture(canvas: HTMLCanvasElement) {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function useBadgeTexture(
  { githubHandle, droppedPhoto, firstName, lastName }: BadgeContent,
  photoInvite: boolean
) {
  const [assets, setAssets] = useState<{
    avatar: HTMLImageElement | null;
    logo: HTMLImageElement | null;
    fontsReady: boolean;
  }>({ avatar: null, fontsReady: false, logo: null });

  const canvas = useMemo(
    () => createTextureCanvas(BADGE_TEXTURE_WIDTH, BADGE_TEXTURE_HEIGHT),
    []
  );
  const backCanvas = useMemo(
    () =>
      createTextureCanvas(BADGE_BACK_TEXTURE_WIDTH, BADGE_BACK_TEXTURE_HEIGHT),
    []
  );

  const texture = useMemo(() => createPrintTexture(canvas), [canvas]);
  const backTexture = useMemo(
    () => createPrintTexture(backCanvas),
    [backCanvas]
  );

  useEffect(() => {
    let cancelled = false;
    loadLogoImage().then((image) => {
      if (!cancelled) {
        setAssets((current) => ({ ...current, logo: image }));
      }
    });
    document.fonts.ready.then(() => {
      if (!cancelled) {
        setAssets((current) => ({ ...current, fontsReady: true }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!githubHandle) {
      setAssets((current) => ({ ...current, avatar: null }));
      return;
    }
    let cancelled = false;
    loadAvatarImage(githubHandle).then((image) => {
      if (!cancelled) {
        setAssets((current) => ({ ...current, avatar: image }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [githubHandle]);

  useEffect(() => {
    drawBadgeTexture(
      canvas,
      {
        avatar: droppedPhoto ?? assets.avatar,
        firstName,
        lastName,
        photoInvite,
      },
      assets.logo
    );
    texture.needsUpdate = true;
    drawBadgeBackTexture(backCanvas, assets.logo);
    backTexture.needsUpdate = true;
  }, [
    canvas,
    texture,
    backCanvas,
    backTexture,
    firstName,
    lastName,
    droppedPhoto,
    photoInvite,
    assets,
  ]);

  useEffect(
    () => () => {
      texture.dispose();
      backTexture.dispose();
    },
    [texture, backTexture]
  );

  return { backTexture, texture };
}

function useLanyardTexture() {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = LANYARD_TEXTURE_WIDTH;
    canvas.height = LANYARD_TEXTURE_HEIGHT;
    drawLanyardTexture(canvas);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(-3, 1);
    return texture;
  }, []);
}

/**
 * The badge faces are printed artwork, so their colour must survive to the
 * screen untouched. Carrying it as diffuse albedo would multiply it by whatever
 * the lights happen to add up to; carrying it as emissive means the incoming
 * light budget cannot shift the brand colours at all. The physical layer is
 * still there — it just contributes the laminate highlight on top.
 */
function printedMaterial({
  color,
  map,
}: {
  color?: string;
  map?: CanvasTexture;
}) {
  return new MeshPhysicalMaterial({
    // Black base: no diffuse response, so lighting cannot tint the artwork.
    color: "#000000",
    // White with a map multiplies the texture through untouched.
    emissive: color ?? "#ffffff",
    emissiveMap: map,
    emissiveIntensity: 1,
    clearcoat: 1,
    clearcoatRoughness: 0.28,
    metalness: 0,
    roughness: 0.45,
  });
}

/** Wraps an angle into (-PI, PI] so the card always turns the short way round. */
function shortestAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

/** A grab past the printed edge (the rounded corners) still counts as the edge. */
function clampToEdge(fraction: number): number {
  return Math.max(-1, Math.min(1, fraction));
}

/**
 * Turns the phone's tilt into the direction gravity pulls, so the badge swings
 * against the real world rather than always straight down the screen. The angle
 * is eased instead of applied raw: the sensor is noisy enough that feeding it
 * straight in makes the card jitter.
 */
function TiltGravity({ tilt }: { tilt: RefObject<number | null> }) {
  const { world } = useRapier();
  const applied = useRef(0);
  const lastWakeTilt = useRef<number | null>(null);

  useFrame((_state, delta) => {
    const gamma = tilt.current;
    if (gamma === null) {
      return;
    }
    const targetDegrees = Math.max(
      -MAX_TILT_DEGREES,
      Math.min(MAX_TILT_DEGREES, gamma)
    );
    if (
      lastWakeTilt.current === null ||
      Math.abs(targetDegrees - lastWakeTilt.current) >=
        TILT_WAKE_THRESHOLD_DEGREES
    ) {
      world.forEachRigidBody((body) => body.wakeUp());
      lastWakeTilt.current = targetDegrees;
    }
    const target = targetDegrees * DEGREES_TO_RADIANS;
    applied.current +=
      (target - applied.current) *
      Math.min(1, Math.min(delta, MAX_FRAME_DELTA) * TILT_SMOOTHING);
    world.gravity = {
      x: Math.sin(applied.current) * GRAVITY,
      y: -Math.cos(applied.current) * GRAVITY,
      z: 0,
    };
  });

  return null;
}

function Badge({ content, onPhotoClick, wind }: BadgeProps) {
  const band = useRef<Mesh>(null);
  const fixed = useRef<RapierRigidBody>(null);
  const j1 = useRef<RapierRigidBody>(null);
  const j2 = useRef<RapierRigidBody>(null);
  const j3 = useRef<RapierRigidBody>(null);
  const card = useRef<RapierRigidBody>(null);

  const vec = useMemo(() => new Vector3(), []);
  const dir = useMemo(() => new Vector3(), []);
  const ang = useMemo(() => new Vector3(), []);
  const axis = useMemo(() => new Vector3(), []);
  const quat = useMemo(() => new Quaternion(), []);
  const bandEnd = useMemo(() => new Vector3(), []);
  const bandExit = useMemo(() => new Vector3(), []);
  const cardQuat = useMemo(() => new Quaternion(), []);
  const grabWorld = useMemo(() => new Vector3(), []);
  const dragTurn = useMemo(() => new Quaternion(), []);
  const dragTarget = useMemo(() => new Quaternion(), []);
  const dragEuler = useMemo(() => new Euler(), []);
  const lerped1 = useMemo(() => new Vector3(), []);
  const lerped2 = useMemo(() => new Vector3(), []);
  const curve = useMemo(() => {
    const catmull = new CatmullRomCurve3([
      new Vector3(),
      new Vector3(),
      new Vector3(),
      new Vector3(),
      new Vector3(),
    ]);
    // Centripetal (the default) overshoots hard when the control points bunch
    // up, which is exactly what happens as the chain swings — the band whips
    // far past the anchor for a frame. Chordal keeps the spline inside its hull.
    catmull.curveType = "chordal";
    // Only feeds the arc-length table the sampling below reads; 32 samples do
    // not need the default 200 entries, and this is rebuilt every frame.
    catmull.arcLengthDivisions = 64;
    return catmull;
  }, []);

  /** Where on the card it is being held, in the card's own frame. Null when free. */
  const [grab, setGrab] = useState<Vector3 | null>(null);
  const [hovered, setHovered] = useState(false);

  const { size, camera } = useThree();
  const { texture: badgeTexture, backTexture } = useBadgeTexture(
    content,
    onPhotoClick !== undefined
  );
  const lanyardTexture = useLanyardTexture();

  useRopeJoint(fixed, j1, [[0, 0, 0], [0, 0, 0], ROPE_SEGMENT_LENGTH]);
  useRopeJoint(j1, j2, [[0, 0, 0], [0, 0, 0], ROPE_SEGMENT_LENGTH]);
  useRopeJoint(j2, j3, [[0, 0, 0], [0, 0, 0], ROPE_SEGMENT_LENGTH]);
  useSphericalJoint(j3, card, [
    [0, 0, 0],
    [0, JOINT_ANCHOR_Y, 0],
  ]);

  useEffect(() => {
    if (!hovered) {
      return;
    }
    document.body.style.cursor = grab ? "grabbing" : "grab";
    return () => {
      document.body.style.cursor = "auto";
    };
  }, [hovered, grab]);

  const geometry = useMemo(
    () => createCardGeometry(CARD_WIDTH, CARD_HEIGHT, CARD_DEPTH, CARD_RADIUS),
    []
  );

  const materials = useMemo(() => {
    const faces: MeshPhysicalMaterial[] = [];
    faces[CARD_FRONT_MATERIAL] = printedMaterial({ map: badgeTexture });
    faces[CARD_BACK_MATERIAL] = printedMaterial({ map: backTexture });
    faces[CARD_EDGE_MATERIAL] = printedMaterial({
      color: BADGE_PALETTE.stripe,
    });
    return faces;
  }, [badgeTexture, backTexture]);

  const clipMaterial = useMemo(
    () =>
      new MeshPhysicalMaterial({
        color: CLIP_COLOR,
        metalness: 1,
        roughness: 0.28,
      }),
    []
  );

  useEffect(() => () => geometry.dispose(), [geometry]);

  useEffect(() => () => clipMaterial.dispose(), [clipMaterial]);

  useEffect(
    () => () => {
      for (const material of new Set(materials)) {
        material.dispose();
      }
    },
    [materials]
  );

  useFrame((state, delta) => {
    if (
      !(fixed.current && j1.current && j2.current && j3.current && card.current)
    ) {
      return;
    }

    // A tab that was in the background hands back one huge delta; smoothing
    // against it is meaningless, so cap it at a couple of frames.
    const frameDelta = Math.min(delta, MAX_FRAME_DELTA);

    if (grab) {
      vec.set(state.pointer.x, state.pointer.y, 0.5).unproject(camera);
      dir.copy(vec).sub(camera.position).normalize();
      vec.add(dir.multiplyScalar(camera.position.length()));
      for (const body of [card, j1, j2, j3, fixed]) {
        body.current?.wakeUp();
      }

      // How far from the middle it was grabbed decides how far it turns, so a
      // card taken by the corner shows its depth and one taken by the middle
      // stays square. The side being held is the side that comes forward.
      dragTarget.setFromEuler(
        dragEuler.set(
          clampToEdge(grab.y / (CARD_HEIGHT / 2)) * MAX_DRAG_PITCH,
          -clampToEdge(grab.x / (CARD_WIDTH / 2)) * MAX_DRAG_YAW,
          0
        )
      );
      dragTurn.slerp(dragTarget, Math.min(1, frameDelta * DRAG_TURN_SMOOTHING));
      card.current.setNextKinematicRotation(dragTurn);

      // Turning happens about the centre of mass, so the translation has to put
      // the held point back under the cursor afterwards. That is what makes the
      // card pivot around the corner being pinched instead of sliding out from
      // under it.
      grabWorld.copy(grab).applyQuaternion(dragTurn);
      card.current.setNextKinematicTranslation({
        x: vec.x - grabWorld.x,
        y: vec.y - grabWorld.y,
        z: vec.z - grabWorld.z,
      });
    } else {
      const velocity = card.current.linvel();
      const speed = Math.hypot(velocity.x, velocity.y, velocity.z);
      wind.current = Math.min(1, speed / MAX_CARD_SPEED);
      if (speed > MAX_CARD_SPEED) {
        const scale = MAX_CARD_SPEED / speed;
        card.current.setLinvel(
          {
            x: velocity.x * scale,
            y: velocity.y * scale,
            z: velocity.z * scale,
          },
          true
        );
      }
    }

    for (const [body, lerped] of [
      [j1, lerped1],
      [j2, lerped2],
    ] as const) {
      const translation = body.current?.translation();
      if (!translation) {
        continue;
      }
      if (lerped.lengthSq() === 0) {
        lerped.set(translation.x, translation.y, translation.z);
      }
      const target = vec.set(translation.x, translation.y, translation.z);
      const clampedDistance = Math.max(
        0.1,
        Math.min(1, lerped.distanceTo(target))
      );
      // Vector3.lerp extrapolates past the target for alpha > 1, and the result
      // is fed back in on the next frame. One long frame — a background tab, a
      // resize, a GC pause — is enough to send the point off to infinity and it
      // never returns, which is what dragged the band across the screen.
      const alpha = Math.min(
        1,
        frameDelta *
          (MIN_LERP_SPEED + clampedDistance * (MAX_LERP_SPEED - MIN_LERP_SPEED))
      );
      lerped.lerp(target, alpha);
    }

    const cardAt = card.current.translation();
    const cardFacing = card.current.rotation();
    cardQuat.set(cardFacing.x, cardFacing.y, cardFacing.z, cardFacing.w);
    vec.set(cardAt.x, cardAt.y, cardAt.z);
    bandEnd.set(0, BAND_END_Y, 0).applyQuaternion(cardQuat).add(vec);
    bandExit.set(0, BAND_EXIT_Y, 0).applyQuaternion(cardQuat).add(vec);

    const tail = fixed.current.translation();
    curve.points[0].copy(bandEnd);
    curve.points[1].copy(bandExit);
    curve.points[2].copy(lerped2);
    curve.points[3].copy(lerped1);
    curve.points[4].set(tail.x, tail.y, tail.z);

    const bandGeometry = band.current?.geometry as
      | (BufferGeometry & {
          setPoints?: (points: Vector3[]) => void;
        })
      | undefined;
    /*
     * Spaced by length, not by control point. `getPoints` splits its samples
     * evenly between the segments however long each one is, and the printed
     * strap is laid out per sample — so the short segment inside the clip was
     * taking a quarter of the lettering and squeezing it into a fraction of an
     * inch, which is what read as blur there. Arc-length sampling keeps the
     * letters one size the whole way down. The table it reads is rebuilt each
     * frame because the points move under it.
     */
    curve.needsUpdate = true;
    bandGeometry?.setPoints?.(curve.getSpacedPoints(CURVE_SEGMENTS));

    const angular = card.current.angvel();
    const rotation = card.current.rotation();
    ang.set(angular.x, angular.y, angular.z);
    // The card steers back to facing you. Steering on the yaw angle rather than
    // on the quaternion's y term (which is sin(yaw / 2)) keeps the pull linear
    // all the way in, instead of collapsing as it nears square-on.
    // That term is sin(yaw / 2), so its error collapses as the target nears and
    // the turn stalls short — measured at 155° of the 180° it was asked for.
    // The angle error stays linear the whole way, and the damping term stops it
    // ringing once it arrives.
    const yawError = shortestAngle(-2 * Math.atan2(rotation.y, rotation.w));

    // Spin about the card's own up axis, not the world's. The joint pins a
    // point JOINT_ANCHOR_Y above the centre of mass: that point sits on the card's own
    // axis, so turning around it is free, while turning around world Y drags
    // the pin sideways whenever the card hangs at an angle — and the solver
    // cancels most of it. That is why it used to stall a third of the way.
    const spinAxis = axis
      .set(0, 1, 0)
      .applyQuaternion(
        quat.set(rotation.x, rotation.y, rotation.z, rotation.w)
      );
    // Scaled by the frame time: applied per frame instead, the card would turn
    // twice as fast on a 120Hz display as on a 60Hz one, and crawl whenever the
    // browser throttles rendering.
    const correction =
      (yawError * FACING_GAIN - ang.dot(spinAxis) * FACING_DAMPING) *
      frameDelta;
    ang.addScaledVector(spinAxis, correction);
    card.current.setAngvel({ x: ang.x, y: ang.y, z: ang.z }, true);
  });

  const segmentProps = {
    angularDamping: 2,
    canSleep: true,
    colliders: false,
    linearDamping: 2,
  } as const;

  return (
    <>
      <group position={[0, ANCHOR_HEIGHT, 0]}>
        <RigidBody ref={fixed} {...segmentProps} type="fixed" />
        <RigidBody position={[0.5, 0, 0]} ref={j1} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[1, 0, 0]} ref={j2} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[1.5, 0, 0]} ref={j3} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody
          position={[2, 0, 0]}
          ref={card}
          {...segmentProps}
          type={grab ? "kinematicPosition" : "dynamic"}
        >
          <CuboidCollider
            args={[CARD_WIDTH / 2, CARD_HEIGHT / 2, CARD_DEPTH / 2]}
          />
          <group
            onLostPointerCapture={() => setGrab(null)}
            onPointerCancel={() => setGrab(null)}
            onPointerDown={(event) => {
              const target = event.target as Element & {
                setPointerCapture: (id: number) => void;
              };
              target.setPointerCapture(event.pointerId);
              const translation = card.current?.translation();
              const rotation = card.current?.rotation();
              if (translation && rotation) {
                // The turn starts from wherever the card already is, so taking
                // hold of a swinging badge eases into the tilt instead of
                // snapping to it.
                dragTurn.set(rotation.x, rotation.y, rotation.z, rotation.w);
                // Stored in the card's frame rather than the world's: which
                // part of the card is held is what sets the tilt, and it has to
                // stay that part while the card turns underneath.
                setGrab(
                  new Vector3()
                    .copy(event.point)
                    .sub(vec.set(translation.x, translation.y, translation.z))
                    .applyQuaternion(quat.copy(dragTurn).invert())
                );
              }
            }}
            onPointerOut={() => setHovered(false)}
            onPointerOver={() => setHovered(true)}
            onPointerUp={(event) => {
              const target = event.target as Element & {
                releasePointerCapture: (id: number) => void;
              };
              target.releasePointerCapture(event.pointerId);
              setGrab(null);
            }}
          >
            <mesh geometry={geometry} material={materials} />
            <group>
              <mesh
                material={clipMaterial}
                position={[0, CLIP_CRIMP_CENTER_Y, 0]}
              >
                <boxGeometry
                  args={[CLIP_CRIMP_WIDTH, CLIP_CRIMP_HEIGHT, CLIP_CRIMP_DEPTH]}
                />
              </mesh>
              {/* In the YZ plane so it passes through the card, not across it. */}
              <mesh
                material={clipMaterial}
                position={[0, CLIP_RING_CENTER_Y, 0]}
                rotation={[0, Math.PI / 2, 0]}
              >
                <torusGeometry
                  args={[CLIP_RING_RADIUS, CLIP_RING_TUBE, 12, 24]}
                />
              </mesh>
            </group>
            {onPhotoClick && (
              /* biome-ignore lint/a11y/noStaticElementInteractions: WebGL hit target over the printed photo area; the native file input owns the actual file-picker interaction. */
              <mesh
                onClick={(event) => {
                  event.stopPropagation();
                  onPhotoClick();
                }}
                onPointerDown={(event) => event.stopPropagation()}
                onPointerUp={(event) => event.stopPropagation()}
                position={[PHOTO_TARGET_X, PHOTO_TARGET_Y, PHOTO_TARGET_Z]}
              >
                <planeGeometry
                  args={[PHOTO_TARGET_WIDTH, PHOTO_TARGET_HEIGHT]}
                />
                <meshBasicMaterial depthWrite={false} opacity={0} transparent />
              </mesh>
            )}
          </group>
        </RigidBody>
      </group>
      {/*
        Two things made the band flicker. Frustum culling tested it against a
        bounding sphere built from the bare centreline — empty (so NaN) on the
        first frames, and always narrower than the ribbon the shader actually
        expands — so the band popped out of view at the edges. And `depthTest`
        off left it drawn in plain scene order, flipping in front of and behind
        the card as the sort changed. Unculled and depth-tested, it is stable
        and simply disappears into the crimp that clamps the band's end.
      */}
      <mesh frustumCulled={false} ref={band}>
        <meshLineGeometry />
        <meshLineMaterial
          color="#ffffff"
          lineWidth={BAND_WIDTH}
          map={lanyardTexture}
          repeat={[-4, 1]}
          resolution={[size.width, size.height]}
          side={DoubleSide}
          useMap={1}
        />
      </mesh>
    </>
  );
}

const BASE_CAMERA_DISTANCE = 11;
/**
 * Framing treats nothing as narrower than this, whatever the screen's real
 * shape. The pull-back used to track the aspect ratio exactly, which holds the
 * world's width steady across screens — but a phone is over twice as tall as it
 * is wide, so it was framed from nearly double the distance and the card came
 * out at a quarter of the frame's height against nearly half on a wide window.
 * Framed at this shape instead, the card stays close to its desktop size, and
 * the tilt below is cut to fit the narrower view that leaves.
 */
const NARROWEST_FRAMING_ASPECT = 0.85;
const CAMERA_FOV = 25;
/**
 * How far down the frame the badge hangs, as a share of the frame's height. The
 * plain behind it is placed in screen percentages too, so measuring the drop
 * this way keeps the badge the same distance above the horizon whichever way the
 * screen is turned, even though the camera stands further off on a phone.
 */
const BADGE_DROP = 0.07;

/**
 * Lighting only shapes the clip and the laminate highlights — the printed faces
 * carry their own colour (see `printedMaterial`). Kept near 1 so the clip reads
 * as the same plastic as the card.
 */
const AMBIENT_INTENSITY = 0.9;
const ENVIRONMENT_INTENSITY = 0.4;

/** Pulls the camera back on portrait screens, but only so far. */
function ResponsiveCamera() {
  const { camera, size } = useThree();

  useEffect(() => {
    const aspect = size.width / size.height;
    const isPortrait = aspect < 1;
    // Narrow screens are framed as though they were squarer than they are, and
    // wide ones are left alone.
    camera.position.z =
      BASE_CAMERA_DISTANCE /
      Math.min(1, Math.max(aspect, NARROWEST_FRAMING_ASPECT));
    // Raising the camera drops the badge down the frame without changing
    // anything about how it hangs or swings.
    const framedHeight =
      2 * camera.position.z * Math.tan((CAMERA_FOV / 2) * DEGREES_TO_RADIANS);
    camera.position.y = (isPortrait ? 0.1 : 0.4) + framedHeight * BADGE_DROP;
    camera.updateProjectionMatrix();
  }, [camera, size]);

  return null;
}

export default function LanyardBadge({
  content,
  onPhotoClick,
  tilt,
  wind,
}: LanyardBadgeProps) {
  return (
    <Canvas
      camera={{ fov: CAMERA_FOV, position: [0, 0, BASE_CAMERA_DISTANCE] }}
      flat
      gl={{ alpha: true, antialias: true }}
      style={{ touchAction: "none" }}
    >
      <ResponsiveCamera />
      <ambientLight intensity={AMBIENT_INTENSITY} />
      <Physics gravity={[0, -GRAVITY, 0]} interpolate timeStep={1 / 60}>
        <TiltGravity tilt={tilt} />
        <Badge content={content} onPhotoClick={onPhotoClick} wind={wind} />
      </Physics>
      <Environment blur={0.75} environmentIntensity={ENVIRONMENT_INTENSITY}>
        <Lightformer
          intensity={2}
          position={[0, -1, 5]}
          rotation={[0, 0, Math.PI / 3]}
          scale={[100, 0.1, 1]}
        />
        <Lightformer
          intensity={3}
          position={[-1, -1, 1]}
          rotation={[0, 0, Math.PI / 3]}
          scale={[100, 0.1, 1]}
        />
        <Lightformer
          intensity={3}
          position={[1, 1, 1]}
          rotation={[0, 0, Math.PI / 3]}
          scale={[100, 0.1, 1]}
        />
        <Lightformer
          intensity={10}
          position={[-10, 0, 14]}
          rotation={[0, Math.PI / 2, Math.PI / 3]}
          scale={[100, 10, 1]}
        />
      </Environment>
    </Canvas>
  );
}
