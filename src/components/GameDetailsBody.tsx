// Shared detail body for both the tap-to-open modal and the QAM panel. Callers
// own the surrounding chrome (footer / action buttons).
import { Focusable } from "@decky/ui";
import { ReactElement, ReactNode, useState } from "react";
import { FaChevronDown, FaChevronRight } from "./icons";

import { CuratorReview, GameDetails } from "../api";
import { t } from "../lib/i18n";
import { locSourceLabel } from "../lib/locSource";
import { hasThreat, verdict } from "../lib/verdict";
import { riskyVendors } from "../lib/vendorRisk";
import { localizationBadge } from "./badgeContent";

export const C = {
  line: "rgba(255,255,255,.08)",
  text: "#e6edf3",
  muted: "#9aa4b2",
  faint: "#6b7581",
  crit: "#e5484d",
  warn: "#f5a623",
  green: "#7ec96f",
};
const TONE: Record<string, string> = {
  clean: C.green,
  vendor: C.warn,
  suspect: C.crit,
  russian: C.crit,
};

function Eyebrow({ children }: { children: ReactNode }): ReactElement {
  return (
    <div
      style={{
        fontSize: "11px",
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: C.faint,
        fontWeight: 600,
      }}
    >
      {children}
    </div>
  );
}

/** Label + value on one line. */
function InlineRow({ label, children }: { label: string; children: ReactNode }): ReactElement {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        padding: "10px 0",
        borderTop: `1px solid ${C.line}`,
      }}
    >
      <Eyebrow>{label}</Eyebrow>
      <span style={{ fontSize: "12.5px", color: C.text, textAlign: "right" }}>{children}</span>
    </div>
  );
}

/** Chevron header + collapsible body; toggles on tap / gamepad A. */
export function Collapsible({
  header,
  children,
}: {
  header: ReactNode;
  children: ReactNode;
}): ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <Focusable
      onActivate={() => setOpen((o) => !o)}
      onClick={() => setOpen((o) => !o)}
      style={{ padding: "10px 0", borderTop: `1px solid ${C.line}` }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: C.text }}>
        <span style={{ color: C.faint, display: "inline-flex", flexShrink: 0 }}>
          {open ? <FaChevronDown /> : <FaChevronRight />}
        </span>
        {header}
      </div>
      {open && (
        <div
          style={{ marginTop: "8px", fontSize: "12px", color: C.muted, lineHeight: 1.5, whiteSpace: "normal" }}
        >
          {children}
        </div>
      )}
    </Focusable>
  );
}

function reviewChip(type: string): { label: string; color: string } {
  if (type === "Recommended") return { label: t("review.up"), color: C.green };
  if (type === "NotRecommended") return { label: t("review.down"), color: C.crit };
  return { label: t("review.info"), color: "#a9c2e8" };
}

function Chip({ label, color }: { label: string; color: string }): ReactElement {
  return (
    <span
      style={{
        fontSize: "10px",
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: "10px",
        color,
        background: `${color}22`,
        border: `0.5px solid ${color}55`,
      }}
    >
      {label}
    </span>
  );
}

function ReviewRow({ review }: { review: CuratorReview }): ReactElement {
  const c = reviewChip(review.ReviewType);
  return (
    <Collapsible
      header={
        <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
          <Chip label={c.label} color={c.color} />
          <span style={{ fontWeight: 600, color: "#cdd4dd" }}>{review.CuratorName}</span>
        </span>
      }
    >
      {review.Review}
    </Collapsible>
  );
}

function VerdictBanner({ details }: { details: GameDetails }): ReactElement {
  const v = verdict(details);
  const tone = TONE[v.tone];
  const locBadge =
    (details.loc === "audio" || details.loc === "text") && details.threatLevel !== "russian"
      ? localizationBadge(details, true)
      : null;
  return (
    <div style={{ display: "flex", gap: "11px", borderRadius: "10px", overflow: "hidden", background: `${tone}1f` }}>
      <div style={{ width: "4px", background: tone, flexShrink: 0 }} />
      <div style={{ padding: "10px 12px 10px 2px", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: tone, flexShrink: 0 }} />
          <span style={{ fontSize: "14px", fontWeight: 600, color: C.text }}>{v.title}</span>
        </div>
        {v.sub && (
          <div style={{ fontSize: "12px", color: C.muted, marginTop: "3px", lineHeight: 1.4 }}>{v.sub}</div>
        )}
        {locBadge && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              marginTop: "9px",
              height: "22px",
              padding: "0 9px",
              borderRadius: "11px",
              fontSize: "11px",
              fontWeight: 600,
              background: locBadge.background,
              border: locBadge.border,
              color: locBadge.color ?? C.text,
            }}
          >
            {locBadge.icon}
            {locBadge.label}
            {locBadge.typeIcons}
          </span>
        )}
      </div>
    </div>
  );
}

// details.found must be true
export default function GameDetailsBody({ details }: { details: GameDetails }): ReactElement {
  const vendors = riskyVendors(details.vendors);
  const reviews = (details.curatorReviews ?? []).slice(0, 3);

  return (
    <div style={{ color: C.text, width: "100%" }}>
      <VerdictBanner details={details} />

      {locSourceLabel(details) && <InlineRow label={t("modal.loc")}>{locSourceLabel(details)}</InlineRow>}

      {(details.developers?.length ?? 0) > 0 && (
        <InlineRow label={t("modal.dev")}>{details.developers!.join(", ")}</InlineRow>
      )}

      {details.bloodyPrice && <InlineRow label={t("modal.bloody")}>{details.bloodyPrice}</InlineRow>}

      {vendors.length > 0 && (
        <div style={{ padding: "10px 0", borderTop: `1px solid ${C.line}` }}>
          <Eyebrow>{t("modal.vendors")}</Eyebrow>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
            {vendors.map((v) => {
              const pct = Math.round(v.share * 100);
              return (
                <div key={v.name}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
                    <span style={{ fontSize: "12.5px" }}>{v.name}</span>
                    <span style={{ fontSize: "11.5px", color: C.muted, fontVariantNumeric: "tabular-nums" }}>
                      {v.rus} / {v.total} · {pct}%
                    </span>
                  </div>
                  <div
                    style={{
                      height: "5px",
                      borderRadius: "3px",
                      background: "rgba(255,255,255,.08)",
                      overflow: "hidden",
                      marginTop: "4px",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${pct}%`,
                        borderRadius: "3px",
                        background: v.majority ? C.crit : C.warn,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(details.russianLinks?.length ?? 0) > 0 && (
        <InlineRow label={t("modal.links")}>
          <span style={{ display: "inline-flex", gap: "6px", whiteSpace: "nowrap" }}>
            {details.russianLinks!.map((l) => (
              <Chip key={l} label={l} color={C.crit} />
            ))}
          </span>
        </InlineRow>
      )}

      {reviews.length > 0 && (
        <div style={{ padding: "10px 0 0", borderTop: `1px solid ${C.line}` }}>
          <Eyebrow>{t("modal.reviews")}</Eyebrow>
          {reviews.map((r) => (
            <ReviewRow key={r.CuratorId} review={r} />
          ))}
        </div>
      )}

      {hasThreat(details) && (
        <Collapsible header={<span>{t("modal.why")}</span>}>{t("modal.whyText")}</Collapsible>
      )}
    </div>
  );
}
