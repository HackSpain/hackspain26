// HackSpain dashboard OTP email — HTML plus a plain-text alternative.
//
// Same vocabulary as `apps/web/src/lib/acceptance-email-template.ts`. Mail
// clients are not browsers:
//   - tables for layout, never flex/grid
//   - every style inline; a <style> block does not survive Gmail reliably
//   - no webfonts (Bungee will not load in Outlook/Gmail) — a bold system stack
//     with letter-spacing echoes the brand's condensed display type instead
//   - explicit background AND text colour on every block, so forced dark mode
//     cannot leave dark text on a dark panel
//   - the logo is the same raster PNG as the landing acceptance mail
//     (`https://hackspain.com/hs-email-logo.png`). Email clients cannot resolve
//     relative paths, and a data: URI would be stripped by Gmail.

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

const LOGO_URL = "https://hackspain.com/hs-email-logo.png";

export const OTP_EMAIL_SUBJECT = "Tu código de acceso a HackSpain";

export function otpEmailHtml(token: string): string {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light only" />
<title>${OTP_EMAIL_SUBJECT}</title>
</head>
<body style="margin:0;padding:0;background:${PALETTE.ink};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Tu código caduca en 15 minutos. Úsalo para entrar al dashboard.</div>

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
            <td align="center" bgcolor="${PALETTE.navy}" style="background:${PALETTE.navy};border:3px solid ${PALETTE.ink};border-top:0;padding:30px 24px 28px;">
              <div style="font-family:${SANS};font-size:11px;font-weight:800;letter-spacing:0.22em;text-transform:uppercase;color:${PALETTE.gold};padding-bottom:14px;">Tu código de acceso</div>
              <div style="font-family:${SANS};font-size:36px;line-height:1.15;font-weight:800;letter-spacing:0.22em;color:${PALETTE.paper};font-variant-numeric:tabular-nums;">${token}</div>
              <div style="font-family:${SANS};font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${PALETTE.gold};padding-top:12px;">Caduca en 15 minutos</div>
            </td>
          </tr>

          <tr>
            <td bgcolor="${PALETTE.paper}" style="background:${PALETTE.paper};border:3px solid ${PALETTE.ink};border-top:0;padding:28px 26px 30px;">
              <p style="margin:0 0 16px;font-family:${SANS};font-size:16px;line-height:1.6;color:${PALETTE.ink};">
                Úsalo para entrar al dashboard de HackSpain. Escríbelo en la pantalla de acceso — no lo compartas con nadie.
              </p>
              <p style="margin:0;font-family:${SANS};font-size:16px;line-height:1.6;color:${PALETTE.ink};">
                Si el código caduca, pide uno nuevo desde la misma pantalla. El anterior dejará de valer.
              </p>
            </td>
          </tr>

          <tr>
            <td bgcolor="${PALETTE.sand}" style="background:${PALETTE.sand};border:3px solid ${PALETTE.ink};border-top:0;padding:22px 26px;">
              <div style="font-family:${SANS};font-size:11px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:${PALETTE.red};padding-bottom:10px;">Si no has sido tú</div>
              <p style="margin:0;font-family:${SANS};font-size:14px;line-height:1.6;color:${PALETTE.brown};">
                Si no has pedido este código, puedes ignorar este correo. Nadie entra en tu cuenta sin él.
              </p>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:20px 24px 0;">
              <p style="margin:0 0 6px;font-family:${SANS};font-size:12px;line-height:1.6;color:${PALETTE.sand};">
                Nos vemos en Madrid — El equipo de HackSpain
              </p>
              <p style="margin:0;font-family:${SANS};font-size:11px;line-height:1.6;color:#8a7a6d;">
                Recibes este correo porque pediste entrar al dashboard de HackSpain.<br />
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

/** Plain-text alternative. Some clients read only this. */
export function otpEmailText(token: string): string {
  return `Tu código de acceso a HackSpain es ${token}.

Caduca en 15 minutos. Úsalo para entrar al dashboard. Escríbelo en la pantalla de acceso — no lo compartas con nadie.

Si el código caduca, pide uno nuevo desde la misma pantalla. El anterior dejará de valer.

Si no has pedido este código, puedes ignorar este correo. Nadie entra en tu cuenta sin él.

Nos vemos en Madrid,
El equipo de HackSpain

Recibes este correo porque pediste entrar al dashboard de HackSpain. Este buzón no admite respuestas; escríbenos a contact@hackspain.com.`;
}
