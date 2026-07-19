import { ConfirmModal, Field, Navigation } from "@decky/ui";
import { ReactElement, useEffect, useState } from "react";

import { GameDetails, getDetails } from "../api";
import { useSettings } from "../hooks/useSettings";
import { t } from "../lib/i18n";
import GameDetailsBody from "./GameDetailsBody";
import WebLabel from "./WebLabel";

export default function PrystanokModal({
  appid,
  closeModal,
}: {
  appid: number;
  closeModal?: () => void;
}): ReactElement {
  useSettings(); // stay subscribed to settings changes
  const [details, setDetails] = useState<GameDetails | null>(null);

  useEffect(() => {
    getDetails(appid)
      .then(setDetails)
      .catch((e) => console.error("[decky-prystanok] modal getDetails failed", e));
  }, [appid]);

  const kuliUrl = details?.kuliUrl;

  return (
    <ConfirmModal
      strTitle={details?.name ?? `AppID ${appid}`}
      strOKButtonText={<WebLabel>{t("btn.prystanok")}</WebLabel>}
      strCancelButtonText={t("btn.close")}
      strMiddleButtonText={kuliUrl ? <WebLabel>{t("btn.kuli")}</WebLabel> : undefined}
      onOK={() => {
        Navigation.NavigateToExternalWeb(`https://prystanok.com.ua/game-check?steamappid=${appid}`);
        closeModal?.();
      }}
      onMiddleButton={
        kuliUrl
          ? () => {
              Navigation.NavigateToExternalWeb(kuliUrl);
              closeModal?.();
            }
          : undefined
      }
      closeModal={closeModal}
    >
      {!details && <Field focusable>{t("modal.loading")}</Field>}
      {details && !details.found && <Field focusable>{t("qam.notInDb")}</Field>}
      {details?.found && <GameDetailsBody details={details} />}
    </ConfirmModal>
  );
}
