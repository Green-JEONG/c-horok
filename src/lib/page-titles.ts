export function platformPageTitle(platform: string, section?: string) {
  if (!section?.trim()) {
    return platform;
  }

  return `${platform} | ${section.trim()}`;
}

export const HOROK_LOG = "horok-log";
export const HOROK_CODING = "horok-coding";
export const HOROK_ACADEMY = "horok-academy";
export const HOROK_ITEM = "horok-item";

export function horokLogTitle(section?: string) {
  return platformPageTitle(HOROK_LOG, section);
}

export function horokCodingTitle(section?: string) {
  return platformPageTitle(HOROK_CODING, section);
}

export function horokAcademyTitle(section?: string) {
  return platformPageTitle(HOROK_ACADEMY, section);
}

export function horokItemTitle(section?: string) {
  return platformPageTitle(HOROK_ITEM, section);
}
