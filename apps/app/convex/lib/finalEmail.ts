const PALETTE = {
  brown: "#4a2c1f",
  gold: "#eab619",
  ink: "#2a170f",
  navy: "#1e3958",
  paper: "#f4ecd8",
  red: "#cc291f",
  sand: "#e8dcc4",
} as const;

const SANS = "'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif";

export const FINAL_EMAIL_SUBJECT = "Asiste a la final de HackSpain 2026 · 16:30";

export const FINAL_EMAIL_LOGO_URL = "https://hackspain.com/hs-email-logo.png";

export interface FinalEmailContent {
  cancelUrl: string;
  firstName: string;
  logoUrl: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function button(options: {
  background: string;
  border: string;
  foreground: string;
  href: string;
  label: string;
}): string {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" bgcolor="${options.background}" style="background:${options.background};border:3px solid ${options.border};padding:16px 28px;">
        <a href="${options.href}" style="display:block;font-family:${SANS};font-size:16px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:${options.foreground};text-decoration:none;">${options.label}</a>
      </td>
    </tr>
  </table>`;
}

export function finalEmailHtml(content: FinalEmailContent): string {
  const firstName = escapeHtml(content.firstName);
  const cancelUrl = escapeHtml(content.cancelUrl);

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light only" />
<title>${FINAL_EMAIL_SUBJECT}</title>
</head>
<body style="margin:0;padding:0;background:${PALETTE.ink};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Estás invitado a la final de HackSpain 2026. Ven a ver a los finalistas presentar. A las 16:30 en OneCowork Recoletos.</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${PALETTE.ink}" style="background:${PALETTE.ink};">
    <tr>
      <td align="center" style="padding:28px 14px 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">

          <tr>
            <td align="center" bgcolor="${PALETTE.paper}" style="background:${PALETTE.paper};border:3px solid ${PALETTE.ink};padding:26px 24px 22px;">
              <img src="${content.logoUrl}" width="300" alt="HackSpain" style="display:block;width:300px;max-width:88%;height:auto;border:0;outline:none;text-decoration:none;margin:0 auto;" />
            </td>
          </tr>

          <tr>
            <td align="center" bgcolor="${PALETTE.gold}" style="background:${PALETTE.gold};border:3px solid ${PALETTE.ink};border-top:0;padding:11px 24px;">
              <div style="font-family:${SANS};font-size:11px;font-weight:800;letter-spacing:0.22em;text-transform:uppercase;color:${PALETTE.brown};">Final · Madrid</div>
            </td>
          </tr>

          <tr>
            <td align="center" bgcolor="${PALETTE.red}" style="background:${PALETTE.red};border:3px solid ${PALETTE.ink};border-top:0;padding:30px 24px;">
              <div style="font-family:${SANS};font-size:30px;line-height:1.15;font-weight:800;letter-spacing:0.01em;text-transform:uppercase;color:${PALETTE.paper};">Estás en la final</div>
              <div style="font-family:${SANS};font-size:14px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${PALETTE.gold};padding-top:8px;">Enhorabuena, ${firstName}</div>
            </td>
          </tr>

          <tr>
            <td align="center" bgcolor="${PALETTE.paper}" style="background:${PALETTE.paper};border:3px solid ${PALETTE.ink};border-top:0;padding:28px 24px 22px;">
              <div style="font-family:${SANS};font-size:12px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;color:${PALETTE.brown};padding-bottom:6px;">A las</div>
              <div style="font-family:${SANS};font-size:72px;line-height:0.9;font-weight:800;letter-spacing:-0.03em;color:${PALETTE.ink};">16:30</div>
            </td>
          </tr>

          <tr>
            <td bgcolor="${PALETTE.paper}" style="background:${PALETTE.paper};border:3px solid ${PALETTE.ink};border-top:0;border-bottom:0;padding:22px 26px 8px;">
              <p style="margin:0;font-family:${SANS};font-size:16px;line-height:1.6;color:${PALETTE.ink};">
                Estás invitado a la final de HackSpain 2026. Ven a ver a los finalistas presentar.
              </p>
            </td>
          </tr>

          <tr>
            <td bgcolor="${PALETTE.sand}" style="background:${PALETTE.sand};border:3px solid ${PALETTE.ink};border-top:0;padding:24px 26px 28px;">
              <div style="font-family:${SANS};font-size:11px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:${PALETTE.red};padding-bottom:10px;">Si no puedes venir</div>
              <p style="margin:0 0 16px;font-family:${SANS};font-size:15px;line-height:1.6;color:${PALETTE.ink};">
                Libera tu plaza para que entre otra persona. El botón abre una página de confirmación. El clic no cancela nada.
              </p>
              ${button({ background: PALETTE.paper, border: PALETTE.ink, foreground: PALETTE.ink, href: cancelUrl, label: "Cancelar mi plaza" })}
            </td>
          </tr>

          <tr>
            <td bgcolor="${PALETTE.navy}" style="background:${PALETTE.navy};border:3px solid ${PALETTE.ink};border-top:0;padding:22px 26px;">
              <div style="font-family:${SANS};font-size:11px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:${PALETTE.gold};padding-bottom:8px;">Dónde</div>
              <div style="font-family:${SANS};font-size:15px;line-height:1.7;color:${PALETTE.paper};">
                OneCowork Recoletos<br />
                C. de Prim, 12, Centro, 28004 Madrid
              </div>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:20px 24px 0;">
              <p style="margin:0 0 6px;font-family:${SANS};font-size:12px;line-height:1.6;color:${PALETTE.sand};">
                Nos vemos en la final. El equipo de HackSpain
              </p>
              <p style="margin:0;font-family:${SANS};font-size:11px;line-height:1.6;color:#8a7a6d;">
                Recibes este correo porque estás en la final de HackSpain 2026.<br />
                Este buzón no admite respuestas; escríbenos a
                <a href="mailto:contact@hackspain.com" style="color:${PALETTE.gold};text-decoration:underline;">contact@hackspain.com</a>.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function finalEmailText(content: FinalEmailContent): string {
  return `Hola ${content.firstName},

Estás invitado a la final de HackSpain 2026. Ven a ver a los finalistas presentar.

A LAS 16:30

Si no puedes venir, libera tu plaza para que entre otra persona.

CANCELAR MI PLAZA
${content.cancelUrl}

El enlace abre una página de confirmación. Abrirlo no cancela nada.

DÓNDE
OneCowork Recoletos
C. de Prim, 12, Centro, 28004 Madrid

Nos vemos en la final,
El equipo de HackSpain

Recibes este correo porque estás en la final de HackSpain 2026. Este buzón no admite respuestas; escríbenos a contact@hackspain.com.`;
}

export function firstNameFrom(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) {
    return "hacker";
  }
  const first = trimmed.split(/\s+/)[0] ?? "hacker";
  return first.length > 24 ? first.slice(0, 24) : first;
}
