import {
  ButtonItem,
  ConfirmModal,
  Field,
  Navigation,
  PanelSection,
  PanelSectionRow,
  Router,
  showModal,
} from "@decky/ui";
import { toaster } from "@decky/api";
import { ReactElement, useEffect, useState } from "react";
import { FaChevronDown, FaChevronRight } from "./icons";

import { clearCache, GameDetails, getDetails, getStoreApp } from "../api";
import { getLastViewedAppId } from "../lib/currentApp";
import { t } from "../lib/i18n";
import { useSettings } from "../hooks/useSettings";
import { resetSettings } from "../lib/settingsStore";
import { getSteamId64 } from "../lib/steamUser";
import GameDetailsBody from "./GameDetailsBody";
import SettingsSection from "./SettingsSection";
import WebLabel from "./WebLabel";

// Same body as the modal, plus the QAM's own action buttons.
function GameDetailsSection({ details }: { details: GameDetails }): ReactElement {
  return (
    <PanelSection title={details.name ?? `AppID ${details.appid}`}>
      <PanelSectionRow>
        <GameDetailsBody details={details} />
      </PanelSectionRow>
      {details.kuliUrl && (
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            onClick={() => Navigation.NavigateToExternalWeb(details.kuliUrl!)}
          >
            <WebLabel>{t("qam.kuli")}</WebLabel>
          </ButtonItem>
        </PanelSectionRow>
      )}
      <PanelSectionRow>
        <ButtonItem
          layout="below"
          onClick={() =>
            Navigation.NavigateToExternalWeb(
              `https://prystanok.com.ua/game-check?steamappid=${details.appid}`
            )
          }
        >
          <WebLabel>{t("qam.checkPrystanok")}</WebLabel>
        </ButtonItem>
      </PanelSectionRow>
    </PanelSection>
  );
}

export default function QuickAccessContent(): ReactElement {
  const { settings } = useSettings();
  const [details, setDetails] = useState<GameDetails | null>(null);
  const [state, setState] = useState<"loading" | "idle" | "empty" | "error">("loading");

  // game open on a store app-page (separate CEF tab, tracked by backend); polled
  // while the panel is open
  const [storeApp, setStoreApp] = useState<number | undefined>(undefined);
  useEffect(() => {
    if (!settings.showQuickAccess) return;
    let ignore = false;
    const poll = () =>
      getStoreApp()
        .then((a) => {
          if (!ignore) setStoreApp(a ?? undefined);
        })
        .catch(() => {});
    poll();
    const id = window.setInterval(poll, 2500);
    return () => {
      ignore = true;
      window.clearInterval(id);
    };
  }, [settings.showQuickAccess]);

  const runningAppId = Router.MainRunningApp?.appid;
  // priority: running game > store > last library page viewed
  const targetAppId =
    runningAppId !== undefined ? Number(runningAppId) : storeApp ?? getLastViewedAppId();
  const steamId = getSteamId64();
  const [serviceOpen, setServiceOpen] = useState(false);

  useEffect(() => {
    if (!settings.showQuickAccess) return;
    if (targetAppId === undefined) {
      setState("empty");
      return;
    }
    let ignore = false;
    setState("loading");
    getDetails(targetAppId)
      .then((d) => {
        if (ignore) return;
        setDetails(d);
        setState("idle");
      })
      .catch((e) => {
        console.error("[decky-prystanok] getDetails failed", e);
        if (!ignore) setState("error");
      });
    return () => {
      ignore = true;
    };
  }, [targetAppId, settings.showQuickAccess]);

  return (
    <>
      {settings.showQuickAccess && state === "empty" && (
        <PanelSection>
          <PanelSectionRow>
            <Field focusable childrenLayout="below" childrenContainerWidth="max">
              {t("qam.empty")}
            </Field>
          </PanelSectionRow>
        </PanelSection>
      )}
      {settings.showQuickAccess && state === "error" && (
        <PanelSection>
          <PanelSectionRow>
            <Field focusable childrenLayout="below" childrenContainerWidth="max">
              {t("qam.error")}
            </Field>
          </PanelSectionRow>
        </PanelSection>
      )}
      {settings.showQuickAccess && state === "idle" && details && (
        <>
          {details.found ? (
            <GameDetailsSection details={details} />
          ) : (
            <PanelSection title={`AppID ${targetAppId}`}>
              <PanelSectionRow>
                <Field focusable childrenLayout="below" childrenContainerWidth="max">
                  {t("qam.notInDb")}
                </Field>
              </PanelSectionRow>
            </PanelSection>
          )}
        </>
      )}

      <SettingsSection />

      <PanelSection>
        {steamId && (
          <PanelSectionRow>
            <ButtonItem
              layout="below"
              onClick={() =>
                Navigation.NavigateToExternalWeb(
                  `https://prystanok.com.ua/library/${steamId}`
                )
              }
            >
              <WebLabel>{t("qam.checkLibrary")}</WebLabel>
            </ButtonItem>
          </PanelSectionRow>
        )}
      </PanelSection>

      <PanelSection>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={() => setServiceOpen((o) => !o)}>
            <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {serviceOpen ? <FaChevronDown /> : <FaChevronRight />} {t("qam.service")}
            </span>
          </ButtonItem>
        </PanelSectionRow>
        {serviceOpen && (
          <>
            <PanelSectionRow>
              <ButtonItem
                layout="below"
                onClick={() =>
                  showModal(
                    <ConfirmModal
                      strTitle={t("qam.clearCacheTitle")}
                      strDescription={t("qam.clearCacheDesc")}
                      strOKButtonText={t("qam.clearCache")}
                      strCancelButtonText={t("qam.cancel")}
                      onOK={async () => {
                        await clearCache();
                        toaster.toast({ title: "Prystanok", body: t("toast.cacheCleared") });
                      }}
                    />
                  )
                }
              >
                {t("qam.clearCache")}
              </ButtonItem>
            </PanelSectionRow>
            <PanelSectionRow>
              <ButtonItem
                layout="below"
                onClick={() =>
                  showModal(
                    <ConfirmModal
                      strTitle={t("qam.resetTitle")}
                      strDescription={t("qam.resetDesc")}
                      strOKButtonText={t("qam.reset")}
                      strCancelButtonText={t("qam.cancel")}
                      onOK={async () => {
                        await resetSettings();
                        toaster.toast({ title: "Prystanok", body: t("toast.settingsReset") });
                      }}
                    />
                  )
                }
              >
                {t("qam.resetSettings")}
              </ButtonItem>
            </PanelSectionRow>
          </>
        )}
      </PanelSection>
    </>
  );
}
