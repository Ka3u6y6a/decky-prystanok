// Minimal @decky/ui surface used at module-load time by imported components.
export const appDetailsClasses = { Header: "Header", InnerContainer: "InnerContainer" };
export const appDetailsHeaderClasses = {
  TopCapsule: "TopCapsule",
  FullscreenEnterStart: "FullscreenEnterStart",
  FullscreenEnterActive: "FullscreenEnterActive",
  FullscreenEnterDone: "FullscreenEnterDone",
  FullscreenExitStart: "FullscreenExitStart",
  FullscreenExitActive: "FullscreenExitActive",
  FullscreenExitDone: "FullscreenExitDone",
};
export const staticClasses = { Title: "Title" };
export const DialogButton = "DialogButton";
export const ButtonItem = "ButtonItem";
export const Field = "Field";
export const PanelSection = "PanelSection";
export const PanelSectionRow = "PanelSectionRow";
export const ConfirmModal = "ConfirmModal";
export const DropdownItem = "DropdownItem";
export const SliderField = "SliderField";
export const ToggleField = "ToggleField";
export const Navigation = { NavigateToExternalWeb() {} };
export const Router = { MainRunningApp: undefined };
export function showModal() {}
export function useParams() {
  return {};
}
export function afterPatch() {}
export function createReactTreePatcher() {
  return () => {};
}
export function findInReactTree() {
  return null;
}
