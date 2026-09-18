import { BADGE_PALETTE } from "./badge-roles";

export const BADGE_TEXTURE_WIDTH = 1024;
export const BADGE_TEXTURE_HEIGHT = 1440;

/** Matches the rounded silhouette of the card mesh. */
const BADGE_TEXTURE_RADIUS = 58;

const INK = "#0f0d0c";
const HEADER_BACKGROUND = "#f4ecd8";
const OUTLINE_WIDTH = 6;
const CARD_BORDER_INSET = 5;

const SLOT_WIDTH = 232;
const SLOT_HEIGHT = 48;
const SLOT_CENTER_Y = 78;

const HEADER_TOP = 150;
const HEADER_BOTTOM = 470;
const LOGO_PADDING = 62;
const LOGO_ASPECT = 306 / 928;

const BODY_INSET = 34;
const STRIPE_WIDTH = 170;
const NAME_LINE_HEIGHT = 96;
const NAME_BASELINE_OFFSET = 118;
const NAME_RULE_OFFSET = 62;

export const BADGE_PORTRAIT_SIZE = 470;
export const BADGE_PORTRAIT_TOP = 566;
export const BADGE_PORTRAIT_LEFT = BODY_INSET + 42;
const PORTRAIT_RADIUS = 16;
const PLACEHOLDER_DASH = [22, 18];
const PLACEHOLDER_LINE_GAP = 48;

interface BadgeTextureContent {
  avatar: CanvasImageSource | null;
  firstName: string;
  lastName: string;
  /**
   * Whether dropping a photo is on offer. A badge someone else shared is only
   * there to be looked at, so it gets an empty frame instead of an invitation
   * to act that would do nothing.
   */
  photoInvite: boolean;
}

/** The lanyard slot punched through the top strip of the badge. */
function drawSlot(ctx: CanvasRenderingContext2D) {
  const x = (BADGE_TEXTURE_WIDTH - SLOT_WIDTH) / 2;
  const y = SLOT_CENTER_Y - SLOT_HEIGHT / 2;

  ctx.beginPath();
  ctx.roundRect(x, y, SLOT_WIDTH, SLOT_HEIGHT, SLOT_HEIGHT / 2);
  ctx.fillStyle = BADGE_PALETTE.clip;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = OUTLINE_WIDTH;
  ctx.stroke();
}

function drawHeader(
  ctx: CanvasRenderingContext2D,
  logo: CanvasImageSource | null
) {
  const headerHeight = HEADER_BOTTOM - HEADER_TOP;

  ctx.fillStyle = HEADER_BACKGROUND;
  ctx.fillRect(0, HEADER_TOP, BADGE_TEXTURE_WIDTH, headerHeight);

  if (logo) {
    const logoWidth = BADGE_TEXTURE_WIDTH - LOGO_PADDING * 2;
    const logoHeight = logoWidth * LOGO_ASPECT;
    ctx.drawImage(
      logo,
      LOGO_PADDING,
      HEADER_TOP + (headerHeight - logoHeight) / 2,
      logoWidth,
      logoHeight
    );
  }

  ctx.fillStyle = INK;
  ctx.fillRect(0, HEADER_BOTTOM, BADGE_TEXTURE_WIDTH, OUTLINE_WIDTH);
}

function drawStripe(ctx: CanvasRenderingContext2D) {
  const stripeX = BADGE_TEXTURE_WIDTH - BODY_INSET - STRIPE_WIDTH;
  const stripeY = HEADER_BOTTOM + OUTLINE_WIDTH + BODY_INSET;
  const stripeHeight = BADGE_TEXTURE_HEIGHT - BODY_INSET - stripeY;

  ctx.fillStyle = BADGE_PALETTE.stripe;
  ctx.fillRect(stripeX, stripeY, STRIPE_WIDTH, stripeHeight);
  ctx.strokeStyle = INK;
  ctx.lineWidth = OUTLINE_WIDTH;
  ctx.strokeRect(stripeX, stripeY, STRIPE_WIDTH, stripeHeight);

  ctx.save();
  ctx.translate(stripeX + STRIPE_WIDTH / 2, stripeY + stripeHeight / 2);
  ctx.rotate(Math.PI / 2);
  ctx.fillStyle = BADGE_PALETTE.stripeText;
  // Bungee, the site's display face, and no weight: it ships a single one, so
  // asking for 900 would only get a synthetic bold that distorts the letters.
  ctx.font = '138px "Bungee", system-ui, sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(BADGE_PALETTE.label, 0, 6, stripeHeight - 56);
  ctx.restore();
}

/** Their GitHub avatar, framed like the photo on a printed pass. */
function drawPortrait(
  ctx: CanvasRenderingContext2D,
  avatar: CanvasImageSource
) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(
    BADGE_PORTRAIT_LEFT,
    BADGE_PORTRAIT_TOP,
    BADGE_PORTRAIT_SIZE,
    BADGE_PORTRAIT_SIZE,
    PORTRAIT_RADIUS
  );
  ctx.clip();
  ctx.drawImage(
    avatar,
    BADGE_PORTRAIT_LEFT,
    BADGE_PORTRAIT_TOP,
    BADGE_PORTRAIT_SIZE,
    BADGE_PORTRAIT_SIZE
  );
  ctx.restore();
}

/**
 * Stands in for the portrait when there is no avatar: a dashed frame inviting a
 * photo to be dropped onto the badge. Drawn into the texture rather than laid
 * over the page, because the card swings — an HTML overlay could not follow it.
 * Without the invitation it is just an empty frame, so the card keeps its
 * printed proportions.
 */
function drawPortraitPlaceholder(
  ctx: CanvasRenderingContext2D,
  photoInvite: boolean
) {
  ctx.save();
  if (photoInvite) {
    ctx.setLineDash(PLACEHOLDER_DASH);
  }
  ctx.beginPath();
  ctx.roundRect(
    BADGE_PORTRAIT_LEFT,
    BADGE_PORTRAIT_TOP,
    BADGE_PORTRAIT_SIZE,
    BADGE_PORTRAIT_SIZE,
    PORTRAIT_RADIUS
  );
  ctx.strokeStyle = INK;
  ctx.lineWidth = OUTLINE_WIDTH;
  ctx.stroke();

  if (!photoInvite) {
    ctx.restore();
    return;
  }

  const textX = BADGE_PORTRAIT_LEFT + 42;
  const textCenterY = BADGE_PORTRAIT_TOP + BADGE_PORTRAIT_SIZE / 2;
  ctx.setLineDash([]);
  ctx.fillStyle = INK;
  ctx.font = '700 44px "DM Sans", system-ui, sans-serif';
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(
    "ARRASTRA TU FOTO",
    textX,
    textCenterY - PLACEHOLDER_LINE_GAP / 2
  );
  ctx.font = '600 26px "DM Sans", system-ui, sans-serif';
  ctx.fillText("O HAZ CLIC", textX, textCenterY + PLACEHOLDER_LINE_GAP / 2);
  ctx.restore();
}

function drawName(
  ctx: CanvasRenderingContext2D,
  firstName: string,
  lastName: string
) {
  const textX = BODY_INSET + 42;
  const maxWidth = BADGE_TEXTURE_WIDTH - BODY_INSET * 2 - STRIPE_WIDTH - 84;
  const baseline = BADGE_TEXTURE_HEIGHT - BODY_INSET - NAME_BASELINE_OFFSET;

  ctx.fillStyle = BADGE_PALETTE.nameText;
  ctx.font = '700 96px "DM Sans", system-ui, sans-serif';
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(firstName, textX, baseline - NAME_LINE_HEIGHT, maxWidth);
  ctx.fillText(lastName, textX, baseline, maxWidth);

  ctx.fillStyle = INK;
  ctx.fillRect(
    textX,
    BADGE_TEXTURE_HEIGHT - BODY_INSET - NAME_RULE_OFFSET,
    maxWidth,
    OUTLINE_WIDTH - 2
  );
}

/** Follows the rounded silhouette so the print reads as one card. */
function drawCardBorder(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.roundRect(
    CARD_BORDER_INSET,
    CARD_BORDER_INSET,
    BADGE_TEXTURE_WIDTH - CARD_BORDER_INSET * 2,
    BADGE_TEXTURE_HEIGHT - CARD_BORDER_INSET * 2,
    BADGE_TEXTURE_RADIUS
  );
  ctx.strokeStyle = INK;
  ctx.lineWidth = OUTLINE_WIDTH * 2;
  ctx.stroke();
}

export function drawBadgeTexture(
  canvas: HTMLCanvasElement,
  { firstName, lastName, avatar, photoInvite }: BadgeTextureContent,
  logo: CanvasImageSource | null
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  ctx.clearRect(0, 0, BADGE_TEXTURE_WIDTH, BADGE_TEXTURE_HEIGHT);
  ctx.fillStyle = BADGE_PALETTE.background;
  ctx.fillRect(0, 0, BADGE_TEXTURE_WIDTH, BADGE_TEXTURE_HEIGHT);

  drawSlot(ctx);
  drawHeader(ctx, logo);

  const bodyY = HEADER_BOTTOM + OUTLINE_WIDTH + BODY_INSET;
  ctx.strokeStyle = INK;
  ctx.lineWidth = OUTLINE_WIDTH - 2;
  ctx.strokeRect(
    BODY_INSET,
    bodyY,
    BADGE_TEXTURE_WIDTH - BODY_INSET * 2,
    BADGE_TEXTURE_HEIGHT - BODY_INSET - bodyY
  );

  drawStripe(ctx);
  if (avatar) {
    drawPortrait(ctx, avatar);
  } else {
    drawPortraitPlaceholder(ctx, photoInvite);
  }
  drawName(ctx, firstName, lastName);
  drawCardBorder(ctx);
}

export const BADGE_BACK_TEXTURE_WIDTH = 512;
export const BADGE_BACK_TEXTURE_HEIGHT = 720;

const BACK_LOGO_PADDING = 74;
const BACK_LOGO_TOP = 132;
const BACK_RULE_GAP = 54;
const BACK_LINE_HEIGHT = 52;
const BACK_URL_OFFSET = 84;
const BACK_BORDER_RADIUS = 29;

/** Event details, so turning the badge around is worth doing. */
const BACK_LINES = [
  { font: '30px "Bungee", system-ui, sans-serif', text: "18—20 SEP 2026" },
  { font: '700 26px "DM Sans", system-ui, sans-serif', text: "UPM · ETSIT" },
  {
    font: '700 26px "DM Sans", system-ui, sans-serif',
    text: "MADRID · ESPAÑA",
  },
] as const;

export function drawBadgeBackTexture(
  canvas: HTMLCanvasElement,
  logo: CanvasImageSource | null
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  ctx.fillStyle = BADGE_PALETTE.background;
  ctx.fillRect(0, 0, BADGE_BACK_TEXTURE_WIDTH, BADGE_BACK_TEXTURE_HEIGHT);

  let cursorY = BACK_LOGO_TOP;

  if (logo) {
    const logoWidth = BADGE_BACK_TEXTURE_WIDTH - BACK_LOGO_PADDING * 2;
    const logoHeight = logoWidth * LOGO_ASPECT;
    ctx.drawImage(logo, BACK_LOGO_PADDING, cursorY, logoWidth, logoHeight);
    cursorY += logoHeight + BACK_RULE_GAP;
  }

  ctx.fillStyle = INK;
  ctx.fillRect(
    BACK_LOGO_PADDING,
    cursorY,
    BADGE_BACK_TEXTURE_WIDTH - BACK_LOGO_PADDING * 2,
    OUTLINE_WIDTH - 2
  );
  cursorY += BACK_RULE_GAP;

  ctx.fillStyle = BADGE_PALETTE.nameText;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const line of BACK_LINES) {
    ctx.font = line.font;
    ctx.fillText(line.text, BADGE_BACK_TEXTURE_WIDTH / 2, cursorY);
    cursorY += BACK_LINE_HEIGHT;
  }

  ctx.font = '700 24px "DM Sans", system-ui, sans-serif';
  ctx.fillText(
    "hackspain.com",
    BADGE_BACK_TEXTURE_WIDTH / 2,
    BADGE_BACK_TEXTURE_HEIGHT - BACK_URL_OFFSET
  );

  ctx.beginPath();
  ctx.roundRect(
    CARD_BORDER_INSET,
    CARD_BORDER_INSET,
    BADGE_BACK_TEXTURE_WIDTH - CARD_BORDER_INSET * 2,
    BADGE_BACK_TEXTURE_HEIGHT - CARD_BORDER_INSET * 2,
    BACK_BORDER_RADIUS
  );
  ctx.strokeStyle = INK;
  ctx.lineWidth = OUTLINE_WIDTH;
  ctx.stroke();
}

const LANYARD_EDGE_STRIPE = 6;

export function drawLanyardTexture(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  ctx.fillStyle = "#cc291f";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(15, 13, 12, 0.28)";
  ctx.fillRect(0, 0, canvas.width, LANYARD_EDGE_STRIPE);
  ctx.fillRect(
    0,
    canvas.height - LANYARD_EDGE_STRIPE,
    canvas.width,
    LANYARD_EDGE_STRIPE
  );

  ctx.fillStyle = "#f4ecd8";
  ctx.font = '900 30px "DM Sans", system-ui, sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("HACKSPAIN · 2026", canvas.width / 2, canvas.height / 2);
}
