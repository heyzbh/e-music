import { createNavigationContainerRef, type NavigatorScreenParams } from '@react-navigation/native';

/** Detail screens available inside every tab, so the tab bar and mini player stay visible. */
export type DetailParams = {
  Album: { id: string; name: string; artist: string; artworkUrl: string | null };
  Artist: { name: string; artworkUrl: string | null };
  Playlist: { id: number };
  Liked: undefined;
  LocalMusic: undefined;
  Settings: undefined;
};

export type HomeStackParams = { HomeMain: undefined } & DetailParams;
export type SearchStackParams = { SearchMain: undefined } & DetailParams;
export type LibraryStackParams = { LibraryMain: undefined } & DetailParams;

export type TabParams = {
  HomeTab: NavigatorScreenParams<HomeStackParams>;
  SearchTab: NavigatorScreenParams<SearchStackParams>;
  LibraryTab: NavigatorScreenParams<LibraryStackParams>;
};

export type RootParams = {
  Tabs: NavigatorScreenParams<TabParams>;
  Player: undefined;
  Queue: undefined;
};

export const navigationRef = createNavigationContainerRef<RootParams>();

/**
 * Opens a detail screen in whichever tab is active. Used from places outside a stack,
 * such as the player and the track action sheet.
 */
export function openDetail<K extends keyof DetailParams>(screen: K, params: DetailParams[K]): void {
  if (!navigationRef.isReady()) return;
  const state = navigationRef.getRootState();
  if (!state) return;
  const tabs = state.routes.find((r) => r.name === 'Tabs')?.state;
  const tab = (tabs?.routes[tabs.index ?? 0]?.name as keyof TabParams | undefined) ?? 'HomeTab';
  // Leave the full-screen player first so the destination is visible.
  if (state.routes[state.index]?.name !== 'Tabs') navigationRef.goBack();
  const nav = navigationRef as unknown as {
    navigate: (name: 'Tabs', p: { screen: keyof TabParams; params: { screen: K; params: DetailParams[K] } }) => void;
  };
  nav.navigate('Tabs', { screen: tab, params: { screen, params } });
}
