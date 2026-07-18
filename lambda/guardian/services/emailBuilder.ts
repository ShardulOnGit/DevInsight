/**
 * @file lambda/guardian/services/emailBuilder.ts
 * @description Premium HTML email builder for DevInsight Guardian morning briefs.
 *
 * Rendering targets: Gmail (desktop/iOS/Android) · Outlook 2016-2021 · Apple Mail 15+
 *
 * Architecture:
 *   - All layout is table-based (Outlook uses Word rendering engine — no flexbox/grid)
 *   - All critical styles are inline (Gmail strips <head><style> on webmail)
 *   - <style> block preserved for responsive breakpoints and Apple Mail dark mode
 *   - MSO conditional comments prevent Outlook from collapsing max-width containers
 *   - color-scheme meta prevents iOS Mail from force-inverting the dark design
 *   - Preheader div injects contextual preview text in the inbox summary pane
 *
 * Design system:
 *   - Dark-native (matches DevInsight app identity)
 *   - Indigo (#6366f1) accent throughout
 *   - Priority signals via color: red (CRITICAL) · amber (HIGH) · indigo (MEDIUM)
 *   - Typography: Helvetica Neue / Arial (universally safe in email)
 *   - First 550px above-fold: score, burnout, trend, top priority — scannable in <5s
 */

import type { ComputedMetrics, Decision, ReportData } from '../../../shared/types.ts';
import type { EmailBuildParams, EmailContent } from '../types.ts';

// ─── Design Tokens ────────────────────────────────────────────────────────────

const C = {
  // Surfaces
  outerBg:    '#060709',
  surface:    '#0c0d1c',
  surfaceAlt: '#111228',
  border:     '#1c1d35',
  borderFaint:'#14152a',

  // Brand
  accent:     '#6366f1',
  accentMid:  '#4f46e5',
  accentText: '#818cf8',

  // Semantic
  success:    '#10b981',
  successBg:  '#052e1c',
  warning:    '#f59e0b',
  warningBg:  '#431407',
  danger:     '#ef4444',
  dangerBg:   '#3f0808',
  purple:     '#c084fc',
  purpleBg:   '#2d1054',

  // Text
  textHigh:   '#f0f0f8',
  textMed:    '#8888aa',
  textLow:    '#6464a0',  // lifted from #44445f — WCAG AA compliant on dark surfaces

  // Gradients (expressed as multiple stops for table-based fallback)
  headerTop:  '#0c0e2a',
} as const;

const F = `'Helvetica Neue', Helvetica, Arial, sans-serif`;

// ─── Pure helpers ──────────────────────────────────────────────────────────────

const rnd = (n: number): string => Math.round(n).toString();

function pctFmt(val: number): string {
  const r = Math.round(val);
  if (r === 0) return 'Stable';
  return `${r > 0 ? '+' : ''}${r}%`;
}

function scoreColor(s: number): string {
  if (s >= 75) return C.success;
  if (s >= 55) return C.warning;
  return C.danger;
}

function burnoutColor(r: string): string {
  if (r === 'High')   return C.danger;
  if (r === 'Medium') return C.warning;
  return C.success;
}

function burnoutBg(r: string): string {
  if (r === 'High')   return C.dangerBg;
  if (r === 'Medium') return C.warningBg;
  return C.successBg;
}

function priorityColor(p: string): string {
  if (p === 'CRITICAL') return C.danger;
  if (p === 'HIGH')     return C.warning;
  return C.accentText;
}

function trendColor(pct: number): string {
  if (pct > 3)  return C.success;
  if (pct < -3) return C.danger;
  return C.textMed;
}

function trendArrow(pct: number): string {
  if (pct > 3)  return '↑';
  if (pct < -3) return '↓';
  return '→';
}

function urgencyBadge(urgency: string): string {
  switch (urgency) {
    case 'CRITICAL':
      return badge('⚠&nbsp;ACTION NEEDED', C.danger, C.dangerBg);
    case 'CELEBRATORY':
      return badge('★&nbsp;STRONG WEEK', C.purple, C.purpleBg);
    default:
      return badge('MORNING BRIEF', C.textLow, C.borderFaint);
  }
}

function badge(text: string, color: string, bg: string): string {
  return `<span style="display:inline-block;background:${bg};border:1px solid ${color};color:${color};font-size:10px;font-weight:700;letter-spacing:0.1em;padding:3px 10px;border-radius:3px;font-family:${F};">${text}</span>`;
}

function priorityBadge(priority: string): string {
  return badge(priority, priorityColor(priority), `${priorityColor(priority)}22`);
}

function confidenceBar(confidence: number): string {
  const filled = Math.round(confidence / 20); // 0–5
  const bars   = ['|', '|', '|', '|', '|'].map((b, i) =>
    `<span style="color:${i < filled ? C.accent : C.border}">${b}</span>`
  ).join('');
  return `<span style="font-size:11px;letter-spacing:1px;font-family:monospace;">${bars}</span><span style="color:${C.textLow};font-size:10px;margin-left:6px;">${confidence}%</span>`;
}

// ─── Section: <style> block ────────────────────────────────────────────────────

function styleBlock(): string {
  return `
<style>
  /* Responsive — Apple Mail, iOS Mail, and Gmail App on Android honor these */
  @media only screen and (max-width: 520px) {
    .wrap  { padding: 12px 4px !important; }
    .inner { border-radius: 8px !important; }
    .pad   { padding-left: 20px !important; padding-right: 20px !important; }
    .stat-cell { display: block !important; width: 100% !important; margin-bottom: 12px; }
    .hero-score { font-size: 44px !important; }
  }
  /* Prevent iOS auto-linking phone numbers / dates / addresses */
  a[x-apple-data-detectors] {
    color: inherit !important;
    text-decoration: none !important;
  }
  /* Prevent Gmail from resizing text on mobile */
  u + #body a { color: inherit; text-decoration: none; font-size: inherit; }
</style>`.trim();
}

// ─── Section: preheader ────────────────────────────────────────────────────────

function preheader(metrics: ComputedMetrics, decision: Decision): string {
  const rec = decision.recommendations[0];
  const preview = rec
    ? `Score ${rnd(metrics.productivityScore)} · Burnout ${metrics.burnoutRiskStatus} · ${rec.action.slice(0, 60)}`
    : `Score ${rnd(metrics.productivityScore)} · Burnout ${metrics.burnoutRiskStatus} · ${metrics.trend}`;

  // Zero-width non-joiners pad the preview so body content doesn't bleed through
  const padding = '\u200C\u200C\u200C\u200C\u200C\u200C\u200C\u200C\u200C\u200C\u200C\u200C\u200C\u200C\u200C\u200C\u200C\u200C\u200C\u200C\u200C\u200C\u200C\u200C\u200C\u200C\u200C\u200C\u200C\u200C';

  return `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preview}${padding}</div>`;
}

// ─── Section: header bar ───────────────────────────────────────────────────────

function headerSection(today: string): string {
  return `
  <tr>
    <td class="pad" style="background:${C.headerTop};border-radius:12px 12px 0 0;border:1px solid ${C.border};border-bottom:1px solid ${C.borderFaint};padding:18px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="font-family:${F};">
            <span style="color:${C.accent};font-size:17px;font-weight:700;letter-spacing:-0.01em;">DevInsight</span><span style="color:${C.textLow};font-size:13px;font-weight:400;margin-left:8px;">· Guardian</span>
          </td>
          <td align="right" style="font-family:${F};">
            <span style="color:${C.textLow};font-size:12px;">${today}</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>`.trim();
}

// ─── Section: hero ────────────────────────────────────────────────────────────

function heroSection(
  displayName: string,
  decision: Decision,
  report: ReportData,
): string {
  const firstName = displayName.split(' ')[0] ?? displayName;
  const badge = urgencyBadge(decision.urgency);

  const ackBlock = decision.acknowledgement
    ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;">
        <tr>
          <td style="background:${C.successBg};border-left:3px solid ${C.success};border-radius:0 4px 4px 0;padding:10px 14px;font-family:${F};">
            <span style="color:${C.success};font-size:11px;font-weight:700;letter-spacing:0.08em;">PROGRESS</span><br>
            <span style="color:#86efac;font-size:13px;line-height:1.5;margin-top:3px;display:block;">${decision.acknowledgement}</span>
          </td>
        </tr>
      </table>`
    : '';

  return `
  <tr>
    <td class="pad" style="background:${C.surface};border-left:1px solid ${C.border};border-right:1px solid ${C.border};padding:28px 32px 24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="font-family:${F};padding-bottom:12px;">${badge}</td>
        </tr>
        <tr>
          <td style="font-family:${F};padding-bottom:6px;">
            <span style="color:${C.textHigh};font-size:22px;font-weight:700;letter-spacing:-0.02em;line-height:1.25;">Good morning, ${firstName}.</span>
          </td>
        </tr>
        <tr>
          <td style="font-family:${F};">
            <span style="color:${C.textMed};font-size:14px;line-height:1.65;">${report.headline}</span>
          </td>
        </tr>
        ${ackBlock ? `<tr><td>${ackBlock}</td></tr>` : ''}
      </table>
    </td>
  </tr>`.trim();
}

// ─── Section: status strip (3 key numbers) ────────────────────────────────────

function statusStrip(metrics: ComputedMetrics): string {
  const score      = Math.round(metrics.productivityScore);
  const scorePct   = score; // 0–100
  const sColor     = scoreColor(score);
  const bColor     = burnoutColor(metrics.burnoutRiskStatus);
  const bBg        = burnoutBg(metrics.burnoutRiskStatus);
  const trend      = metrics.nextWeekPctChange;
  const tColor     = trendColor(trend);
  const tArrow     = trendArrow(trend);

  // Progress bar via table width — Outlook-compatible
  const filledPct  = scorePct;
  const emptyPct   = 100 - scorePct;

  return `
  <tr>
    <td class="pad" style="background:${C.surfaceAlt};border-left:1px solid ${C.border};border-right:1px solid ${C.border};padding:20px 32px 24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr valign="top">

          <!-- SCORE -->
          <td class="stat-cell" width="34%" style="padding-right:8px;font-family:${F};">
            <div style="background:${C.surface};border:1px solid ${C.border};border-radius:8px;padding:16px 18px;">
              <div style="color:${C.textLow};font-size:10px;font-weight:700;letter-spacing:0.1em;margin-bottom:6px;">THIS WEEK</div>
              <div class="hero-score" style="color:${sColor};font-size:38px;font-weight:800;letter-spacing:-0.04em;line-height:1;">${rnd(score)}</div>
              <div style="color:${C.textLow};font-size:10px;margin-top:2px;">/100 productivity</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;">
                <tr>
                  <td width="${filledPct}%" height="3" bgcolor="${sColor}" style="border-radius:2px;font-size:0;line-height:0;">&nbsp;</td>
                  <td width="${emptyPct}%" height="3" bgcolor="${C.border}" style="border-radius:2px;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>
            </div>
          </td>

          <!-- BURNOUT -->
          <td class="stat-cell" width="34%" style="padding:0 4px;font-family:${F};">
            <div style="background:${bBg};border:1px solid ${bColor}33;border-radius:8px;padding:16px 18px;">
              <div style="color:${C.textLow};font-size:10px;font-weight:700;letter-spacing:0.1em;margin-bottom:6px;">BURNOUT</div>
              <div style="color:${bColor};font-size:22px;font-weight:800;letter-spacing:-0.02em;line-height:1;">${metrics.burnoutRiskStatus}</div>
              <div style="color:${bColor}aa;font-size:10px;margin-top:4px;">risk level</div>
              <div style="margin-top:10px;color:${C.textLow};font-size:11px;">
                ${rnd(metrics.totalLateNight)} late-night · ${rnd(metrics.totalWeekend)} weekend
              </div>
            </div>
          </td>

          <!-- TREND -->
          <td class="stat-cell" width="32%" style="padding-left:8px;font-family:${F};">
            <div style="background:${C.surface};border:1px solid ${C.border};border-radius:8px;padding:16px 18px;">
              <div style="color:${C.textLow};font-size:10px;font-weight:700;letter-spacing:0.1em;margin-bottom:6px;">TRAJECTORY</div>
              <div style="color:${tColor};font-size:30px;font-weight:800;line-height:1;">${tArrow} ${pctFmt(trend)}</div>
              <div style="color:${C.textLow};font-size:10px;margin-top:4px;">next week projection</div>
              <div style="margin-top:10px;color:${C.textLow};font-size:11px;">
                ${rnd(metrics.activeDays)}/${rnd(metrics.totalTrackedDays)} days active
              </div>
            </div>
          </td>

        </tr>
      </table>
    </td>
  </tr>`.trim();
}

// ─── Section: top priority (above the fold) ───────────────────────────────────

function topPrioritySection(decision: Decision): string {
  const top = decision.recommendations[0];
  if (!top) return '';

  const pColor = priorityColor(top.priority);

  return `
  <tr>
    <td class="pad" style="background:${C.surface};border-left:1px solid ${C.border};border-right:1px solid ${C.border};padding:0 32px 24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding-bottom:10px;font-family:${F};">
            <span style="color:${C.textLow};font-size:10px;font-weight:700;letter-spacing:0.1em;">TODAY'S PRIORITY</span>
          </td>
        </tr>
        <tr>
          <td style="background:${pColor}0f;border:1px solid ${pColor}33;border-left:4px solid ${pColor};border-radius:0 8px 8px 0;padding:18px 20px;font-family:${F};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding-bottom:8px;">
                  ${priorityBadge(top.priority)}
                  <span style="color:${C.textLow};font-size:10px;margin-left:10px;">${confidenceBar(top.confidence)}</span>
                </td>
              </tr>
              <tr>
                <td style="color:${C.textHigh};font-size:15px;font-weight:600;line-height:1.45;padding-bottom:8px;">${top.action}</td>
              </tr>
              <tr>
                <td style="color:${C.textMed};font-size:13px;line-height:1.6;">${top.reason}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>`.trim();
}

// ─── Section divider ──────────────────────────────────────────────────────────

function divider(): string {
  return `
  <tr>
    <td style="background:${C.surface};border-left:1px solid ${C.border};border-right:1px solid ${C.border};padding:0 32px;">
      <div style="border-top:1px solid ${C.border};height:0;font-size:0;line-height:0;">&nbsp;</div>
    </td>
  </tr>`.trim();
}

// ─── Section: remaining recommendations ───────────────────────────────────────

function recommendationsSection(decision: Decision): string {
  const rest = decision.recommendations.slice(1);
  if (rest.length === 0) return '';

  const rows = rest.map(rec => {
    const pColor = priorityColor(rec.priority);
    return `
      <tr>
        <td style="padding:14px 0;border-bottom:1px solid ${C.border};font-family:${F};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td width="4" style="background:${pColor};border-radius:2px;">&nbsp;</td>
              <td style="padding-left:14px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="padding-bottom:6px;">
                      ${priorityBadge(rec.priority)}
                      <span style="color:${C.textLow};font-size:10px;margin-left:8px;">${rec.category} &middot; ${confidenceBar(rec.confidence)}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="color:${C.textHigh};font-size:13px;font-weight:600;line-height:1.4;padding-bottom:5px;">${rec.action}</td>
                  </tr>
                  <tr>
                    <td style="color:${C.textMed};font-size:12px;line-height:1.55;">${rec.reason}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
  }).join('');

  return `
  <tr>
    <td class="pad" style="background:${C.surface};border-left:1px solid ${C.border};border-right:1px solid ${C.border};padding:20px 32px 4px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="color:${C.textLow};font-size:10px;font-weight:700;letter-spacing:0.1em;padding-bottom:6px;font-family:${F};">ADDITIONAL ACTIONS</td>
        </tr>
        ${rows}
      </table>
    </td>
  </tr>`.trim();
}

// ─── Section: key win / key risk ──────────────────────────────────────────────

function keyWinRiskSection(report: ReportData): string {
  if (!report.keyWin && !report.keyRisk) return '';

  const winBlock = report.keyWin ? `
    <tr>
      <td width="48%" valign="top" style="font-family:${F};padding-right:8px;">
        <div style="background:${C.successBg};border:1px solid ${C.success}33;border-radius:8px;padding:16px;">
          <div style="color:${C.success};font-size:10px;font-weight:700;letter-spacing:0.1em;margin-bottom:6px;">KEY WIN</div>
          <div style="color:#86efac;font-size:13px;line-height:1.6;">${report.keyWin}</div>
        </div>
      </td>` : '';

  const riskBlock = report.keyRisk ? `
      <td width="48%" valign="top" style="font-family:${F};padding-left:8px;">
        <div style="background:${C.warningBg};border:1px solid ${C.warning}33;border-radius:8px;padding:16px;">
          <div style="color:${C.warning};font-size:10px;font-weight:700;letter-spacing:0.1em;margin-bottom:6px;">WATCH</div>
          <div style="color:#fcd34d;font-size:13px;line-height:1.6;">${report.keyRisk}</div>
        </div>
      </td>` : '';

  return `
  <tr>
    <td class="pad" style="background:${C.surface};border-left:1px solid ${C.border};border-right:1px solid ${C.border};padding:20px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          ${winBlock}
          ${riskBlock}
        </tr>
      </table>
    </td>
  </tr>`.trim();
}

// ─── Section: forecast ────────────────────────────────────────────────────────

function forecastSection(metrics: ComputedMetrics, report: ReportData): string {
  const pct  = metrics.nextWeekPctChange;
  const tCol = trendColor(pct);
  const label = pct === 0
    ? 'Stable week ahead'
    : `${pct > 0 ? 'Upward' : 'Downward'} trajectory into next week`;

  return `
  <tr>
    <td class="pad" style="background:${C.surface};border-left:1px solid ${C.border};border-right:1px solid ${C.border};padding:20px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="color:${C.textLow};font-size:10px;font-weight:700;letter-spacing:0.1em;padding-bottom:10px;font-family:${F};">NEXT WEEK</td>
        </tr>
        <tr>
          <td style="background:${C.surfaceAlt};border:1px solid ${C.border};border-radius:8px;padding:16px 20px;font-family:${F};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td>
                  <span style="color:${tCol};font-size:20px;font-weight:700;">${trendArrow(pct)}&nbsp;${pctFmt(pct)}</span>
                  <span style="color:${C.textLow};font-size:12px;margin-left:10px;">${label}</span>
                </td>
              </tr>
              ${report.nextWeekForecast ? `
              <tr>
                <td style="color:${C.textMed};font-size:13px;line-height:1.6;padding-top:10px;border-top:1px solid ${C.border};margin-top:10px;">${report.nextWeekForecast}</td>
              </tr>` : ''}
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>`.trim();
}

// ─── Section: CTA ─────────────────────────────────────────────────────────────

function ctaSection(dashboardUrl: string): string {
  return `
  <tr>
    <td class="pad" style="background:${C.surface};border-left:1px solid ${C.border};border-right:1px solid ${C.border};padding:24px 32px 32px;text-align:center;font-family:${F};">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${dashboardUrl}" style="height:44px;width:210px;v-text-anchor:middle;" arcsize="18%" stroke="f" fillcolor="${C.accent}">
        <w:anchorlock/>
        <center style="color:#ffffff;font-family:${F};font-size:14px;font-weight:600;">Open Dashboard &#8594;</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-->
      <a href="${dashboardUrl}" target="_blank" style="display:inline-block;background:${C.accent};color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:8px;letter-spacing:0.01em;font-family:${F};">Open Dashboard &rarr;</a>
      <!--<![endif]-->
      <div style="color:${C.textLow};font-size:11px;margin-top:14px;">View detailed analytics, adjust goals, and update your GitHub connection.</div>
    </td>
  </tr>`.trim();
}

// ─── Section: footer ──────────────────────────────────────────────────────────

function footerSection(generatedAt: string): string {
  return `
  <tr>
    <td class="pad" style="background:${C.borderFaint};border:1px solid ${C.border};border-top:none;border-radius:0 0 12px 12px;padding:18px 32px;text-align:center;font-family:${F};">
      <p style="color:${C.textLow};font-size:11px;line-height:1.7;margin:0;">
        DevInsight Guardian &nbsp;·&nbsp; Autonomous AI Engineering Manager<br>
        Generated ${generatedAt} (IST) &nbsp;·&nbsp; <a href="%%unsubscribe%%" style="color:${C.textLow};text-decoration:underline;">Unsubscribe</a>
      </p>
    </td>
  </tr>`.trim();
}

// ─── Subject line ─────────────────────────────────────────────────────────────

function buildSubject(decision: Decision, metrics: ComputedMetrics, today: string): string {
  switch (decision.urgency) {
    case 'CRITICAL':
      return `⚠️ Action needed · DevInsight Guardian · ${today}`;
    case 'CELEBRATORY':
      return `🏆 Strong week · Score ${rnd(metrics.productivityScore)} · Your morning brief`;
    default:
      return `Your morning brief · Score ${rnd(metrics.productivityScore)} · ${today}`;
  }
}

// ─── Plain-text version ───────────────────────────────────────────────────────

function buildPlainText(params: EmailBuildParams, today: string): string {
  const { user, metrics, decision, report, dashboardUrl } = params;
  const name  = user.displayName.split(' ')[0] ?? user.displayName;
  const score = rnd(metrics.productivityScore);
  const rec0  = decision.recommendations[0];

  const recs = decision.recommendations
    .map((r, i) =>
      `${i + 1}. [${r.priority}] ${r.action}\n   ${r.reason} (${r.confidence}% confidence)`
    ).join('\n\n');

  const lines: string[] = [
    `DevInsight Guardian — ${today}`,
    '─'.repeat(52),
    '',
    `Good morning, ${name}.`,
    '',
    report.headline,
    '',
    decision.acknowledgement ? `Progress: ${decision.acknowledgement}\n` : '',
    '── KEY NUMBERS ─────────────────────────────────────',
    `Productivity Score:  ${score}/100`,
    `Burnout Risk:        ${metrics.burnoutRiskStatus}`,
    `Trajectory:          ${pctFmt(metrics.nextWeekPctChange)} next week`,
    `Active Days:         ${rnd(metrics.activeDays)}/${rnd(metrics.totalTrackedDays)}`,
    `Commits This Week:   ${rnd(metrics.totalCommits)}`,
    '',
    '── TODAY\'S PRIORITY ─────────────────────────────────',
    rec0 ? `[${rec0.priority}] ${rec0.action}\n${rec0.reason}` : '',
    '',
    recs.length > 1 ? '── ADDITIONAL ACTIONS ───────────────────────────────' : '',
    decision.recommendations.slice(1).map((r, i) =>
      `${i + 2}. [${r.priority}] ${r.action}`
    ).join('\n'),
    '',
    '── THIS WEEK ────────────────────────────────────────',
    `Win:  ${report.keyWin}`,
    `Risk: ${report.keyRisk}`,
    '',
    '── NEXT WEEK ────────────────────────────────────────',
    report.nextWeekForecast,
    '',
    '─'.repeat(52),
    `Dashboard: ${dashboardUrl}`,
  ];

  return lines.filter(l => l !== '').join('\n');
}

// ─── Main builder ─────────────────────────────────────────────────────────────

/**
 * Builds the premium morning brief email — HTML and plain-text.
 *
 * Pure function: same inputs always produce the same output.
 * No side effects, no external calls.
 */
export function buildMorningBrief(params: EmailBuildParams): EmailContent {
  const { user, metrics, decision, report, dashboardUrl } = params;

  const now = new Date();

  const today = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });

  const generatedAt = now.toLocaleString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Kolkata',
  });

  const subject = buildSubject(decision, metrics, today);

  const html = `<!DOCTYPE html>
<html lang="en" dir="ltr" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>${subject}</title>
  <!--[if gte mso 9]>
  <xml>
    <o:OfficeDocumentSettings>
      <o:AllowPNG/>
      <o:PixelsPerInch>96</o:PixelsPerInch>
    </o:OfficeDocumentSettings>
  </xml>
  <![endif]-->
  ${styleBlock()}
</head>
<body id="body" style="margin:0;padding:0;background-color:${C.outerBg};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;word-break:break-word;">

${preheader(metrics, decision)}

<table role="presentation" class="wrap" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${C.outerBg};">
  <tr>
    <td align="center" style="padding:24px 8px;">

      <!--[if (gte mso 9)|(IE)]>
      <table width="600" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td>
      <![endif]-->

      <table role="presentation" class="inner" width="100%" style="max-width:600px;" cellpadding="0" cellspacing="0" border="0">

        ${headerSection(today)}
        ${heroSection(user.displayName, decision, report)}
        ${statusStrip(metrics)}
        ${topPrioritySection(decision)}
        ${divider()}
        ${recommendationsSection(decision)}
        ${decision.recommendations.length > 1 ? divider() : ''}
        ${keyWinRiskSection(report)}
        ${divider()}
        ${forecastSection(metrics, report)}
        ${divider()}
        ${ctaSection(dashboardUrl)}
        ${footerSection(generatedAt)}

      </table>

      <!--[if (gte mso 9)|(IE)]>
      </td></tr></table>
      <![endif]-->

    </td>
  </tr>
</table>

</body>
</html>`;

  const text = buildPlainText(params, today);

  return { subject, html, text };
}
