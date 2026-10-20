/**
 * Navigation requests that do not arrive as anchor clicks still need the page
 * editor's unsaved-changes guard. Components dispatch this cancelable event
 * before a programmatic `router.push`, then continue only when it returns true.
 */
export const APP_NAVIGATION_EVENT = "wiki:before-navigate";

export type AppNavigationDetail = {
  href: string;
};

export function requestAppNavigation(href: string): boolean {
  if (typeof window === "undefined") {
    return true;
  }

  const event = new CustomEvent<AppNavigationDetail>(APP_NAVIGATION_EVENT, {
    cancelable: true,
    detail: { href }
  });

  return window.dispatchEvent(event);
}
