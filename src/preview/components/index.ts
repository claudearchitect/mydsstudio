/**
 * Registry mapping componentId -> exemplar React component. The keys here
 * must match COMPONENT_MANIFEST's componentIds exactly (verified in
 * renderComponent.test.ts) — this is the "real" component library that
 * replaces the Phase-0 gray-box placeholder.
 */
import type { ComponentType } from "react";
import { ButtonPrimary } from "./ButtonPrimary";
import { CardDefault } from "./CardDefault";
import { InputText } from "./InputText";
import { HeadingDefault } from "./HeadingDefault";
import { BadgeDefault } from "./BadgeDefault";
import { NavDefault } from "./NavDefault";

export const COMPONENT_REGISTRY: Record<string, ComponentType> = {
  "button.primary": ButtonPrimary,
  "card.default": CardDefault,
  "input.text": InputText,
  "heading.default": HeadingDefault,
  "badge.default": BadgeDefault,
  "nav.default": NavDefault,
};

export {
  ButtonPrimary,
  CardDefault,
  InputText,
  HeadingDefault,
  BadgeDefault,
  NavDefault,
};
