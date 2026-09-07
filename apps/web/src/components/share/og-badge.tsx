import {
  badgeInitials,
  clampBadgeName,
  splitBadgeName,
} from "../../lib/badge-name";
import { OG_BADGE_HEIGHT, OG_BADGE_WIDTH } from "../../lib/badge-share-params";
import { BADGE_PALETTE } from "./badge-roles";
import { logoWordmarkDataUri } from "./logo-wordmark";

const INK = "#0f0d0c";
const PAPER = "#f4ecd8";
const BROWN = "#4a2c1f";
const GOLD = "#eab619";
const RED = "#cc291f";

const HEADLINE_LINES = ["VOY A", "HACKSPAIN", "2026"] as const;

/**
 * The printed badge squeezes a long name into the space it has; here the type
 * steps down instead, which keeps compound Spanish surnames on the card without
 * ever pushing the portrait out of shape.
 */
const NAME_TYPE_STEPS = [
  { fontSize: 27, maxCharacters: 14 },
  { fontSize: 22, maxCharacters: 20 },
] as const;
const NAME_FONT_SIZE_FLOOR = 18;

function nameFontSize(firstName: string, lastName: string): number {
  const longestLine = Math.max(firstName.length, lastName.length);
  const step = NAME_TYPE_STEPS.find(
    ({ maxCharacters }) => longestLine <= maxCharacters
  );
  return step?.fontSize ?? NAME_FONT_SIZE_FLOOR;
}

interface Props {
  /** Inlined avatar bytes; the renderer cannot reach out to the network. */
  avatarDataUri: string | null;
  fullName: string;
}

/**
 * The social preview for a shared badge, laid out for the 1200x630 card that X,
 * LinkedIn and WhatsApp crop from. It redraws the printed badge rather than
 * reusing the 3D one on the page: the renderer has no WebGL and no canvas, so
 * the card is rebuilt here out of plain boxes and text.
 */
export function OgBadge({ avatarDataUri, fullName }: Props) {
  const printedName = clampBadgeName(fullName);
  const { firstName, lastName } = splitBadgeName(printedName);
  const initials = badgeInitials(fullName);
  const nameStyle = {
    color: BADGE_PALETTE.nameText,
    display: "flex",
    fontFamily: "DM Sans",
    fontSize: nameFontSize(firstName, lastName),
    fontWeight: 700,
    lineHeight: 1.15,
  } as const;

  return (
    <div
      style={{
        alignItems: "center",
        backgroundColor: PAPER,
        display: "flex",
        height: OG_BADGE_HEIGHT,
        width: OG_BADGE_WIDTH,
      }}
    >
      {/* Left: the claim, so the card still reads at thumbnail size. */}
      <div
        style={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          justifyContent: "center",
          paddingLeft: 76,
          paddingRight: 32,
        }}
      >
        <div
          style={{
            alignSelf: "flex-start",
            backgroundColor: GOLD,
            border: `3px solid ${INK}`,
            color: INK,
            display: "flex",
            fontFamily: "Bungee",
            fontSize: 19,
            letterSpacing: 1,
            marginBottom: 24,
            padding: "7px 14px",
          }}
        >
          18-20 SEP · MADRID
        </div>

        {HEADLINE_LINES.map((line) => (
          <div
            key={line}
            style={{
              color: INK,
              display: "flex",
              fontFamily: "Bungee",
              fontSize: 74,
              lineHeight: 1.04,
            }}
          >
            {line}
          </div>
        ))}

        {printedName ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                backgroundColor: RED,
                height: 7,
                marginBottom: 14,
                marginTop: 28,
                width: 104,
              }}
            />
            <div
              style={{
                color: INK,
                display: "flex",
                fontFamily: "DM Sans",
                fontSize: 34,
                fontWeight: 900,
              }}
            >
              {printedName}
            </div>
          </div>
        ) : null}

        <div
          style={{
            color: BROWN,
            display: "flex",
            fontFamily: "DM Sans",
            fontSize: 22,
            fontWeight: 700,
            marginTop: 30,
          }}
        >
          hackspain.com
        </div>
      </div>

      {/* Right: the badge itself, tilted like it is hanging off the lanyard. */}
      <div
        style={{
          alignItems: "center",
          display: "flex",
          justifyContent: "center",
          paddingRight: 76,
          width: 470,
        }}
      >
        <div
          style={{
            backgroundColor: BADGE_PALETTE.background,
            border: `5px solid ${INK}`,
            borderRadius: 22,
            boxShadow: `16px 16px 0 0 ${INK}`,
            display: "flex",
            flexDirection: "column",
            height: 476,
            transform: "rotate(-5deg)",
            width: 330,
          }}
        >
          {/* The punched lanyard slot. */}
          <div
            style={{
              alignItems: "center",
              display: "flex",
              height: 52,
              justifyContent: "center",
            }}
          >
            <div
              style={{
                backgroundColor: BADGE_PALETTE.clip,
                border: `3px solid ${INK}`,
                borderRadius: 10,
                height: 19,
                width: 98,
              }}
            />
          </div>

          <div
            style={{
              alignItems: "center",
              backgroundColor: PAPER,
              borderBottom: `5px solid ${INK}`,
              borderTop: `5px solid ${INK}`,
              display: "flex",
              height: 100,
              justifyContent: "center",
            }}
          >
            <img
              alt=""
              height={78}
              src={logoWordmarkDataUri()}
              style={{ height: 78, width: 244 }}
              width={244}
            />
          </div>

          <div
            style={{
              display: "flex",
              flex: 1,
              flexDirection: "row",
              padding: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                flex: 1,
                flexDirection: "column",
                marginRight: 12,
              }}
            >
              {avatarDataUri ? (
                <img
                  alt=""
                  height={192}
                  src={avatarDataUri}
                  style={{
                    border: `4px solid ${INK}`,
                    borderRadius: 10,
                    flexShrink: 0,
                    height: 192,
                    objectFit: "cover",
                    width: "100%",
                  }}
                  width={218}
                />
              ) : (
                <div
                  style={{
                    alignItems: "center",
                    border: `4px solid ${INK}`,
                    borderRadius: 10,
                    color: PAPER,
                    display: "flex",
                    flexShrink: 0,
                    fontFamily: "Bungee",
                    fontSize: 58,
                    height: 192,
                    justifyContent: "center",
                    width: "100%",
                  }}
                >
                  {initials}
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  marginTop: "auto",
                }}
              >
                <div style={nameStyle}>{firstName}</div>
                <div style={nameStyle}>{lastName}</div>
                <div
                  style={{
                    backgroundColor: INK,
                    height: 4,
                    marginTop: 8,
                    width: "100%",
                  }}
                />
              </div>
            </div>

            {/* The role stripe, printed sideways down the edge of the card. */}
            <div
              style={{
                alignItems: "center",
                backgroundColor: BADGE_PALETTE.stripe,
                border: `3px solid ${INK}`,
                display: "flex",
                justifyContent: "center",
                width: 54,
              }}
            >
              <div
                style={{
                  color: BADGE_PALETTE.stripeText,
                  display: "flex",
                  // Matches the printed stripe on the 3D badge. Bungee ships a
                  // single weight, so 400 is the only one registered for it.
                  fontFamily: "Bungee",
                  fontSize: 26,
                  fontWeight: 400,
                  transform: "rotate(90deg)",
                  whiteSpace: "nowrap",
                }}
              >
                {BADGE_PALETTE.label}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
