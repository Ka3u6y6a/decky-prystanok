import {
  ButtonItem,
  DialogButton,
  Field,
  ModalRoot,
  PanelSection,
  PanelSectionRow,
  showModal,
  SliderField,
  ToggleField,
} from "@decky/ui";
import { ReactElement, ReactNode, useState } from "react";
import { FaChevronDown, FaChevronRight } from "./icons";

import { BadgeConfig, BadgePosition, PrystanokSettings } from "../api";
import { useSettings } from "../hooks/useSettings";
import { t } from "../lib/i18n";
import { detectSteamLang, LANGS } from "../lib/steamLang";

// Modal, not DropdownItem — the dropdown pop-up steals gamepad focus on close
// and scrolls the QAM panel.
function LangModal({
  current,
  onPick,
  closeModal,
}: {
  current: string;
  onPick: (value: string) => void;
  closeModal?: () => void;
}): ReactElement {
  const pick = (value: string) => {
    onPick(value);
    closeModal?.();
  };
  const opt = (value: string, label: string) => (
    <DialogButton
      key={value}
      onClick={() => pick(value)}
      style={{
        marginBottom: "6px",
        background: value === current ? "#1a9fff" : undefined,
        color: value === current ? "#06294a" : undefined,
      }}
    >
      {label}
    </DialogButton>
  );
  return (
    <ModalRoot onCancel={closeModal} onEscKeypress={closeModal}>
      <div style={{ fontWeight: 500, marginBottom: "10px" }}>{t("set.langLabel")}</div>
      <div style={{ maxHeight: "60vh", overflowY: "auto", display: "flex", flexDirection: "column" }}>
        {opt("auto", t("set.langAuto"))}
        {LANGS.map((l) => opt(l.code, l.label))}
      </div>
    </ModalRoot>
  );
}

// 3×2 arrow grid position picker (DropdownItem avoided — see LangModal)
const POSITIONS: { value: BadgePosition; arrow: string }[] = [
  { value: "top-left", arrow: "↖" },
  { value: "top-center", arrow: "↑" },
  { value: "top-right", arrow: "↗" },
  { value: "bottom-left", arrow: "↙" },
  { value: "bottom-center", arrow: "↓" },
  { value: "bottom-right", arrow: "↘" },
];

type BadgeKey = "capsules" | "appPage" | "store";

// Chevron-headed expandable block; shared shell for every settings group. `note`
// renders next to the title (e.g. the "off" indicator).
function CollapsibleGroup({
  title,
  note,
  children,
}: {
  title: string;
  note?: ReactNode;
  children: ReactNode;
}): ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PanelSectionRow>
        <ButtonItem layout="below" onClick={() => setOpen((o) => !o)}>
          <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {open ? <FaChevronDown /> : <FaChevronRight />}
            {title}
            {note}
          </span>
        </ButtonItem>
      </PanelSectionRow>
      {open && children}
    </>
  );
}

function BadgeGroup({
  title,
  k,
  cfg,
  update,
}: {
  title: string;
  k: BadgeKey;
  cfg: BadgeConfig;
  update: (patch: Partial<PrystanokSettings>) => Promise<unknown>;
}): ReactElement {
  const set = (patch: Partial<BadgeConfig>) => update({ [k]: { ...cfg, ...patch } });

  return (
    <CollapsibleGroup
      title={title}
      note={!cfg.enabled ? <span style={{ opacity: 0.5 }}>{t("set.off")}</span> : undefined}
    >
      <PanelSectionRow>
        <ToggleField
          label={t("set.surfaceOn")}
          checked={cfg.enabled}
          onChange={(v) => set({ enabled: v })}
        />
      </PanelSectionRow>
      <PanelSectionRow>
            <Field label={t("set.position")} childrenLayout="below" bottomSeparator="none">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px" }}>
                {POSITIONS.map((p) => (
                  <DialogButton
                    key={p.value}
                    style={{
                      minWidth: 0,
                      padding: "6px 0",
                      fontSize: "18px",
                      background: cfg.position === p.value ? "#1a9fff" : undefined,
                    }}
                    onClick={() => set({ position: p.value })}
                  >
                    {p.arrow}
                  </DialogButton>
                ))}
              </div>
            </Field>
          </PanelSectionRow>
          <PanelSectionRow>
            <SliderField
              label={t("set.size")}
              value={cfg.size}
              min={16}
              max={64}
              step={2}
              showValue
              onChange={(v) => set({ size: v })}
            />
          </PanelSectionRow>
          <PanelSectionRow>
            <SliderField
              label={t("set.offsetX")}
              value={cfg.offsetX}
              min={0}
              max={120}
              step={2}
              showValue
              onChange={(v) => set({ offsetX: v })}
            />
          </PanelSectionRow>
          <PanelSectionRow>
            <SliderField
              label={t("set.offsetY")}
              value={cfg.offsetY}
              min={0}
              max={120}
              step={2}
              showValue
              onChange={(v) => set({ offsetY: v })}
            />
          </PanelSectionRow>
    </CollapsibleGroup>
  );
}

export default function SettingsSection(): ReactElement {
  const { settings, update } = useSettings();

  const langValue = settings.targetLangAuto ? "auto" : settings.targetLang;
  const langLabel = settings.targetLangAuto
    ? t("set.langAuto")
    : LANGS.find((l) => l.code === settings.targetLang)?.label ?? settings.targetLang.toUpperCase();
  const pickLang = (value: string) =>
    value === "auto"
      ? update({ targetLangAuto: true, targetLang: detectSteamLang() })
      : update({ targetLangAuto: false, targetLang: value });

  return (
    <>
      <PanelSection title={t("set.title")}>
        <BadgeGroup key="capsules" title={t("set.capsules")} k="capsules" cfg={settings.capsules} update={update} />
        <BadgeGroup key="appPage" title={t("set.appPage")} k="appPage" cfg={settings.appPage} update={update} />
        <BadgeGroup key="store" title={t("set.store")} k="store" cfg={settings.store} update={update} />
        <CollapsibleGroup title={t("set.secLoc")}>
          <PanelSectionRow>
            <ToggleField
              label={t("set.showLoc")}
              description={t("set.showLocDesc")}
              checked={settings.showLoc}
              onChange={(v) => update({ showLoc: v })}
            />
          </PanelSectionRow>
          <PanelSectionRow>
            <ToggleField
              label={t("set.detailed")}
              description={t("set.detailedDesc")}
              checked={settings.detailedBadges}
              onChange={(v) => update({ detailedBadges: v })}
            />
          </PanelSectionRow>
          <PanelSectionRow>
            <ButtonItem
              layout="below"
              label={t("set.langLabel")}
              onClick={() => showModal(<LangModal current={langValue} onPick={pickLang} />)}
            >
              {langLabel}
            </ButtonItem>
          </PanelSectionRow>
        </CollapsibleGroup>
      </PanelSection>

      <PanelSection title={t("set.secPanel")}>
        <PanelSectionRow>
          <ToggleField
            label={t("set.qamDetails")}
            checked={settings.showQuickAccess}
            onChange={(v) => update({ showQuickAccess: v })}
          />
        </PanelSectionRow>
      </PanelSection>
    </>
  );
}
