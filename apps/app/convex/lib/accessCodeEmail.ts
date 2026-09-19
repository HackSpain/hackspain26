// HackSpain event access code email — HTML plus a plain-text alternative.
//
// Email clients need table layout and inline styles. This deliberately mirrors
// the dashboard OTP and landing acceptance emails instead of relying on browser
// CSS or webfonts that Gmail and Outlook may strip.

const PALETTE = {
  brown: "#4a2c1f",
  gold: "#eab619",
  ink: "#2a170f",
  navy: "#1e3958",
  paper: "#f4ecd8",
  red: "#cc291f",
  sand: "#e8dcc4",
  teal: "#2b8c85",
} as const;

const SANS = "'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif";
const LOGO_URL = "https://hackspain.com/hs-email-logo.png";

export const ACCESS_CODE_EMAIL_SUBJECT = "Tu código de acceso a HackSpain 2026";

type AccessCodeEmailContent = {
  code: string;
  name: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function accessCodeEmailHtml(content: AccessCodeEmailContent): string {
  const code = escapeHtml(content.code);
  const name = escapeHtml(content.name);

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light only" />
<title>${ACCESS_CODE_EMAIL_SUBJECT}</title>
</head>
<body style="margin:0;padding:0;background:${PALETTE.ink};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Tu código personal para entrar en HackSpain 2026.</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${PALETTE.ink}" style="background:${PALETTE.ink};">
    <tr>
      <td align="center" style="padding:28px 14px 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">

          <tr>
            <td align="center" bgcolor="${PALETTE.paper}" style="background:${PALETTE.paper};border:3px solid ${PALETTE.ink};padding:26px 24px 22px;">
              <img src="${LOGO_URL}" width="300" alt="HackSpain" style="display:block;width:300px;max-width:88%;height:auto;border:0;outline:none;text-decoration:none;margin:0 auto;" />
            </td>
          </tr>

          <tr>
            <td align="center" bgcolor="${PALETTE.gold}" style="background:${PALETTE.gold};border:3px solid ${PALETTE.ink};border-top:0;padding:11px 24px;">
              <div style="font-family:${SANS};font-size:11px;font-weight:800;letter-spacing:0.22em;text-transform:uppercase;color:${PALETTE.brown};">Madrid · 18—20 septiembre 2026</div>
            </td>
          </tr>

          <tr>
            <td align="center" bgcolor="${PALETTE.navy}" style="background:${PALETTE.navy};border:3px solid ${PALETTE.ink};border-top:0;padding:32px 24px 30px;">
              <div style="font-family:${SANS};font-size:11px;font-weight:800;letter-spacing:0.22em;text-transform:uppercase;color:${PALETTE.gold};padding-bottom:14px;">Tu código de acreditación</div>
              <div style="font-family:${SANS};font-size:46px;line-height:1.1;font-weight:800;letter-spacing:0.22em;color:${PALETTE.paper};font-variant-numeric:tabular-nums;">${code}</div>
              <div style="font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:0.13em;text-transform:uppercase;color:${PALETTE.gold};padding-top:14px;">Personal e intransferible</div>
            </td>
          </tr>

          <tr>
            <td bgcolor="${PALETTE.paper}" style="background:${PALETTE.paper};border:3px solid ${PALETTE.ink};border-top:0;border-bottom:0;padding:30px 26px 8px;">
              <div style="font-family:${SANS};font-size:24px;line-height:1.25;font-weight:800;color:${PALETTE.ink};padding-bottom:14px;">Hola, ${name}</div>
              <p style="margin:0;font-family:${SANS};font-size:16px;line-height:1.6;color:${PALETTE.ink};">
                Este es tu código personal para entrar en HackSpain 2026. Guárdalo y tenlo a mano cuando llegues.
              </p>
            </td>
          </tr>

          <tr>
            <td bgcolor="${PALETTE.paper}" style="background:${PALETTE.paper};border:3px solid ${PALETTE.ink};border-top:0;border-bottom:0;padding:22px 26px 30px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="top" width="46" style="padding:0 12px 18px 0;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="${PALETTE.gold}" style="background:${PALETTE.gold};border:2px solid ${PALETTE.ink};width:34px;height:34px;font-family:${SANS};font-size:16px;font-weight:800;line-height:30px;color:${PALETTE.ink};">1</td></tr></table>
                  </td>
                  <td valign="top" style="padding:0 0 18px;">
                    <div style="font-family:${SANS};font-size:16px;font-weight:800;line-height:1.35;color:${PALETTE.ink};padding-bottom:4px;">Enséñalo al llegar</div>
                    <div style="font-family:${SANS};font-size:14px;line-height:1.6;color:${PALETTE.brown};">El equipo de acreditación validará el código y marcará tu entrada.</div>
                  </td>
                </tr>
                <tr>
                  <td valign="top" width="46" style="padding:0 12px 0 0;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="${PALETTE.teal}" style="background:${PALETTE.teal};border:2px solid ${PALETTE.ink};width:34px;height:34px;font-family:${SANS};font-size:16px;font-weight:800;line-height:30px;color:#ffffff;">2</td></tr></table>
                  </td>
                  <td valign="top">
                    <div style="font-family:${SANS};font-size:16px;font-weight:800;line-height:1.35;color:${PALETTE.ink};padding-bottom:4px;">Entra en el dashboard</div>
                    <div style="font-family:${SANS};font-size:14px;line-height:1.6;color:${PALETTE.brown};">Después del check-in, inicia sesión en <a href="https://hackspain.app" style="color:${PALETTE.teal};font-weight:800;text-decoration:underline;">hackspain.app</a> con este mismo email.</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td bgcolor="${PALETTE.sand}" style="background:${PALETTE.sand};border:3px solid ${PALETTE.ink};border-top:0;padding:22px 26px;">
              <div style="font-family:${SANS};font-size:11px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:${PALETTE.red};padding-bottom:9px;">No lo compartas</div>
              <p style="margin:0;font-family:${SANS};font-size:14px;line-height:1.6;color:${PALETTE.brown};">
                Este código identifica tu acreditación. Si no reconoces este correo, escríbenos a <a href="mailto:contact@hackspain.com" style="color:${PALETTE.red};font-weight:800;text-decoration:underline;">contact@hackspain.com</a>.
              </p>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:20px 24px 0;">
              <p style="margin:0 0 6px;font-family:${SANS};font-size:12px;line-height:1.6;color:${PALETTE.sand};">Nos vemos en Madrid — El equipo de HackSpain</p>
              <p style="margin:0;font-family:${SANS};font-size:11px;line-height:1.6;color:#8a7a6d;">Este buzón no admite respuestas.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Plain-text alternative for clients that do not render HTML email. */
export function accessCodeEmailText(content: AccessCodeEmailContent): string {
  return `Hola ${content.name},

Tu código de acceso a HackSpain 2026 es: ${content.code}

Enséñalo al equipo de acreditación cuando llegues. Después del check-in, inicia sesión en https://hackspain.app desde tu ordenador con este mismo email para acceder a la experiencia del evento.

Este código es personal. No lo compartas.

Nos vemos en Madrid,
El equipo de HackSpain`;
}
