// HackSpain acceptance email — HTML plus a plain-text alternative.
//
// Email HTML rules this follows, because mail clients are not browsers:
//   - tables for layout, never flex/grid
//   - every style inline; a <style> block does not survive Gmail reliably
//   - no webfonts (Bungee will not load in Outlook/Gmail) — a bold system stack
//     with letter-spacing echoes the brand's condensed display type instead
//   - buttons are padded table cells wrapping an <a>, never <button>
//   - explicit background AND text colour on every block, so forced dark mode
//     cannot leave dark text on a dark panel
//   - the logo is a raster PNG (`public/hs-email-logo.png`), not the source SVG:
//     Gmail strips <img src="*.svg"> outright and Outlook will not render it.
//     Regenerate it from src/assets/logo.svg with the plaque recoloured to
//     `paper` and flattened onto the same colour, so it merges into the panel.

const PALETTE = {
  brown: "#4a2c1f",
  gold: "#eab619",
  ink: "#2a170f",
  navy: "#1e3958",
  paper: "#f4ecd8",
  red: "#cc291f",
  sand: "#e8dcc4",
  teal: "#35858a",
} as const;

const SANS = "'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif";

/**
 * The good news, then the ask. `Confirma` lands at character 15, so it is still
 * visible when a phone truncates the line around 35 — the ask survives even
 * though the whole subject does not. Names HackSpain because RESEND_FROM
 * carries no display name, so the inbox shows a bare noreply address.
 */
export const ACCEPTANCE_EMAIL_SUBJECT =
  "Estás dentro. Confirma tu plaza en HackSpain 2026";

export interface AcceptanceEmailContent {
  cancelUrl: string;
  confirmUrl: string;
  firstName: string;
  logoUrl: string;
}

interface ButtonOptions {
  background: string;
  border: string;
  foreground: string;
  href: string;
  label: string;
}

interface NextStep {
  body: string;
  title: string;
}

const NEXT_STEPS: readonly NextStep[] = [
  {
    body: "Al confirmar verás el enlace en pantalla. Entra en cuanto puedas: <strong>toda la comunicación del evento pasa por ahí</strong> — horarios, cambios de última hora, equipos y avisos. Si no estás en el grupo, te lo vas a perder.",
    title: "Únete al grupo de WhatsApp",
  },
  {
    body: "En la misma pantalla te espera tu acreditación. Publícala en <strong>LinkedIn o X</strong>: cuanta más gente la vea, más cracks se animan a venir — y eso hace mejor el hackathon para todos.",
    title: "Comparte tu acreditación",
  },
];

/**
 * Numbered step, as a two-column table. A real <ol> is styled inconsistently
 * across clients, so the numerals are their own cells.
 */
function stepRow(step: NextStep, index: number, isLast: boolean): string {
  return `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
                <tr>
                  <td width="34" valign="top" style="width:34px;padding:0 12px 0 0;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:34px;">
                      <tr>
                        <td align="center" bgcolor="${PALETTE.gold}" style="background:${PALETTE.gold};border:2px solid ${PALETTE.ink};width:34px;height:34px;font-family:${SANS};font-size:16px;font-weight:800;line-height:30px;color:${PALETTE.ink};">${index + 1}</td>
                      </tr>
                    </table>
                  </td>
                  <td valign="top" style="padding:0 0 ${isLast ? "0" : "18px"};">
                    <div style="font-family:${SANS};font-size:16px;font-weight:800;line-height:1.35;color:${PALETTE.ink};padding-bottom:5px;">${step.title}</div>
                    <div style="font-family:${SANS};font-size:14px;line-height:1.6;color:${PALETTE.brown};">${step.body}</div>
                  </td>
                </tr>
              </table>`;
}

/** Padded-cell button — the only construction that renders everywhere. */
function button(options: ButtonOptions): string {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
    <tr>
      <td align="center" bgcolor="${options.background}" style="background:${options.background};border:3px solid ${options.border};padding:16px 34px;">
        <a href="${options.href}" style="display:block;font-family:${SANS};font-size:17px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:${options.foreground};text-decoration:none;">${options.label}</a>
      </td>
    </tr>
  </table>`;
}

export function acceptanceEmailHtml(content: AcceptanceEmailContent): string {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light only" />
<title>${ACCEPTANCE_EMAIL_SUBJECT}</title>
</head>
<body style="margin:0;padding:0;background:${PALETTE.ink};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Tienes plaza en HackSpain 2026. Confirma tu asistencia.</div>

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
              <div style="font-family:${SANS};font-size:11px;font-weight:800;letter-spacing:0.22em;text-transform:uppercase;color:${PALETTE.brown};">Madrid · 18—20 septiembre 2026</div>
            </td>
          </tr>

          <tr>
            <td align="center" bgcolor="${PALETTE.red}" style="background:${PALETTE.red};border:3px solid ${PALETTE.ink};border-top:0;padding:30px 24px;">
              <div style="font-family:${SANS};font-size:30px;line-height:1.15;font-weight:800;letter-spacing:0.01em;text-transform:uppercase;color:${PALETTE.paper};">Tienes plaza</div>
              <div style="font-family:${SANS};font-size:14px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${PALETTE.gold};padding-top:8px;">¡Enhorabuena, ${content.firstName}!</div>
            </td>
          </tr>

          <tr>
            <td bgcolor="${PALETTE.paper}" style="background:${PALETTE.paper};border:3px solid ${PALETTE.ink};border-top:0;border-bottom:0;padding:30px 26px 6px;">
              <p style="margin:0 0 16px;font-family:${SANS};font-size:16px;line-height:1.6;color:${PALETTE.ink};">
                Estás dentro. Nos han llegado más de 500 solicitudes y la tuya nos ha convencido, así que nos hace mucha ilusión decirte que tienes plaza en HackSpain 2026.
              </p>
              <p style="margin:0;font-family:${SANS};font-size:16px;line-height:1.6;color:${PALETTE.ink};">
                Vas a pasar un fin de semana construyendo junto a algunos de los mejores <strong>hackers jóvenes de España</strong> y con los <strong>emprendedores y las startups que están definiendo el ecosistema</strong>: 36 horas, cinco tracks y un gran premio.
              </p>
            </td>
          </tr>

          <tr>
            <td bgcolor="${PALETTE.paper}" style="background:${PALETTE.paper};border:3px solid ${PALETTE.ink};border-top:0;border-bottom:0;padding:24px 26px 0;">
              <div style="font-family:${SANS};font-size:11px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:${PALETTE.teal};padding-bottom:14px;">Siguientes pasos</div>
              ${NEXT_STEPS.map((step, index) => stepRow(step, index, index === NEXT_STEPS.length - 1)).join("")}
            </td>
          </tr>

          <tr>
            <td align="center" bgcolor="${PALETTE.paper}" style="background:${PALETTE.paper};border:3px solid ${PALETTE.ink};border-top:0;border-bottom:0;padding:26px 26px 38px;">
              ${button({ background: PALETTE.teal, border: PALETTE.ink, foreground: "#ffffff", href: content.confirmUrl, label: "Confirmar asistencia" })}
            </td>
          </tr>

          <tr>
            <td bgcolor="${PALETTE.sand}" style="background:${PALETTE.sand};border:3px solid ${PALETTE.ink};border-top:0;padding:22px 26px;">
              <div style="font-family:${SANS};font-size:11px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:${PALETTE.red};padding-bottom:10px;">Antes de confirmar, lee esto</div>
              <p style="margin:0 0 12px;font-family:${SANS};font-size:14px;line-height:1.6;color:${PALETTE.brown};">
                Al confirmar, contamos contigo. Con más de 500 solicitudes, tu plaza es una plaza que otra persona no va a tener. Además compramos comida y merch por adelantado para cada asistente confirmado.
              </p>
              <p style="margin:0;font-family:${SANS};font-size:14px;line-height:1.6;color:${PALETTE.brown};">
                No aparecer, o cancelar sin avisar con <strong>al menos un mes de antelación</strong>, supone quedar <strong>excluido de futuros eventos de HackSpain y de Exponential</strong>. Si ves que no vas a poder venir, cancela cuanto antes — sin problema y sin rencor.
              </p>
            </td>
          </tr>

          <tr>
            <td align="center" bgcolor="${PALETTE.paper}" style="background:${PALETTE.paper};border:3px solid ${PALETTE.ink};border-top:0;padding:24px 26px 28px;">
              <p style="margin:0 0 16px;font-family:${SANS};font-size:14px;line-height:1.5;color:${PALETTE.brown};">¿No vas a poder venir?</p>
              ${button({ background: PALETTE.paper, border: PALETTE.ink, foreground: PALETTE.ink, href: content.cancelUrl, label: "Cancelar mi plaza" })}
            </td>
          </tr>

          <tr>
            <td bgcolor="${PALETTE.navy}" style="background:${PALETTE.navy};border:3px solid ${PALETTE.ink};border-top:0;padding:22px 26px;">
              <div style="font-family:${SANS};font-size:11px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:${PALETTE.gold};padding-bottom:8px;">Los datos</div>
              <div style="font-family:${SANS};font-size:15px;line-height:1.7;color:${PALETTE.paper};">
                <strong>18—20 de septiembre de 2026</strong><br />
                UPM · ETSIT, Madrid<br />
                36 horas · 5 tracks · 1 gran premio
              </div>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:20px 24px 0;">
              <p style="margin:0 0 6px;font-family:${SANS};font-size:12px;line-height:1.6;color:${PALETTE.sand};">
                Nos vemos en septiembre — El equipo de HackSpain
              </p>
              <p style="margin:0;font-family:${SANS};font-size:11px;line-height:1.6;color:#8a7a6d;">
                Recibes este correo porque solicitaste plaza en HackSpain 2026.<br />
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
export function acceptanceEmailText(content: AcceptanceEmailContent): string {
  return `Hola ${content.firstName},

Tienes plaza en HackSpain 2026. ¡Enhorabuena!

Nos han llegado más de 500 solicitudes y la tuya nos ha convencido. Vas a pasar un fin de semana construyendo junto a algunos de los mejores hackers jóvenes de España y con los emprendedores y las startups que están definiendo el ecosistema: 36 horas, cinco tracks y un gran premio.

SIGUIENTES PASOS

1. Únete al grupo de WhatsApp. Al confirmar verás el enlace en pantalla. Entra en cuanto puedas: toda la comunicación del evento pasa por ahí — horarios, cambios de última hora, equipos y avisos. Si no estás en el grupo, te lo vas a perder.

2. Comparte tu acreditación. En la misma pantalla te espera tu acreditación. Publícala en LinkedIn o X: cuanta más gente la vea, más cracks se animan a venir — y eso hace mejor el hackathon para todos.

CONFIRMA TU ASISTENCIA
${content.confirmUrl}

ANTES DE CONFIRMAR, LEE ESTO
Al confirmar, contamos contigo. Con más de 500 solicitudes, tu plaza es una plaza que otra persona no va a tener. Además compramos comida y merch por adelantado para cada asistente confirmado.

No aparecer, o cancelar sin avisar con al menos un mes de antelación, supone quedar excluido de futuros eventos de HackSpain y de Exponential. Si ves que no vas a poder venir, cancela cuanto antes — sin problema y sin rencor.

¿NO VAS A PODER VENIR? CANCELA TU PLAZA
${content.cancelUrl}

LOS DATOS
18—20 de septiembre de 2026
UPM · ETSIT, Madrid
36 horas · 5 tracks · 1 gran premio

Nos vemos en septiembre,
El equipo de HackSpain

Recibes este correo porque solicitaste plaza en HackSpain 2026. Este buzón no admite respuestas; escríbenos a contact@hackspain.com.`;
}
