import { Ionicons } from '@expo/vector-icons';
import { BottomTabBar, createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { DarkTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MiniPlayer, MINI_PLAYER_HEIGHT } from '../components/MiniPlayer';
import { ToastHost } from '../components/Toast';
import { usePlayer } from '../playback/hooks';
import AlbumScreen from '../screens/AlbumScreen';
import ArtistScreen from '../screens/ArtistScreen';
import HomeScreen from '../screens/HomeScreen';
import LibraryScreen from '../screens/LibraryScreen';
import LikedScreen from '../screens/LikedScreen';
import LocalMusicScreen from '../screens/LocalMusicScreen';
import PlayerScreen from '../screens/PlayerScreen';
import PlaylistScreen from '../screens/PlaylistScreen';
import QueueScreen from '../screens/QueueScreen';
import SearchScreen from '../screens/SearchScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { palette } from '../theme/colors';
import {
  navigationRef,
  type HomeStackParams,
  type LibraryStackParams,
  type RootParams,
  type SearchStackParams,
  type TabParams,
} from './types';

type TabStackParams = HomeStackParams & SearchStackParams & LibraryStackParams;

const Root = createNativeStackNavigator<RootParams>();
const Tabs = createBottomTabNavigator<TabParams>();
// One navigator definition, rendered once per tab, so every tab has its own history.
const Stack = createNativeStackNavigator<TabStackParams>();

const stackOptions = {
  headerShown: false,
  animation: 'slide_from_right',
  contentStyle: { backgroundColor: palette.bg },
} as const;

// The same detail screens live in every tab's stack.
const detailScreens = (
  <>
    <Stack.Screen name="Album" component={AlbumScreen} />
    <Stack.Screen name="Artist" component={ArtistScreen} />
    <Stack.Screen name="Playlist" component={PlaylistScreen} />
    <Stack.Screen name="Liked" component={LikedScreen} />
    <Stack.Screen name="LocalMusic" component={LocalMusicScreen} />
    <Stack.Screen name="Settings" component={SettingsScreen} />
  </>
);

function HomeTab() {
  return (
    <Stack.Navigator screenOptions={stackOptions} initialRouteName="HomeMain">
      <Stack.Screen name="HomeMain" component={HomeScreen} />
      {detailScreens}
    </Stack.Navigator>
  );
}

function SearchTab() {
  return (
    <Stack.Navigator screenOptions={stackOptions} initialRouteName="SearchMain">
      <Stack.Screen name="SearchMain" component={SearchScreen} />
      {detailScreens}
    </Stack.Navigator>
  );
}

function LibraryTab() {
  return (
    <Stack.Navigator screenOptions={stackOptions} initialRouteName="LibraryMain">
      <Stack.Screen name="LibraryMain" component={LibraryScreen} />
      {detailScreens}
    </Stack.Navigator>
  );
}

/** Mini player sits on top of the tab bar, over a fade so content scrolls under it. */
function TabBarWithPlayer(props: BottomTabBarProps) {
  return (
    <View style={{ backgroundColor: 'transparent' }}>
      <MiniPlayer />
      <BottomTabBar {...props} />
    </View>
  );
}

function TabsScreen() {
  const insets = useSafeAreaInsets();
  const player = usePlayer();
  const tabHeight = 56 + insets.bottom;

  return (
    <View style={{ flex: 1 }}>
      <Tabs.Navigator
        tabBar={(props) => <TabBarWithPlayer {...props} />}
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: palette.text,
          tabBarInactiveTintColor: palette.textTertiary,
          tabBarStyle: {
            backgroundColor: 'rgba(11,11,13,0.97)',
            borderTopWidth: 0,
            elevation: 0,
            height: tabHeight,
            paddingTop: 6,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
          tabBarIcon: ({ focused, color, size }) => {
            const icons = {
              HomeTab: focused ? 'home' : 'home-outline',
              SearchTab: focused ? 'search' : 'search-outline',
              LibraryTab: focused ? 'library' : 'library-outline',
            } as const;
            return <Ionicons name={icons[route.name]} size={size} color={color} />;
          },
          sceneStyle: { backgroundColor: palette.bg },
        })}
      >
        <Tabs.Screen name="HomeTab" component={HomeTab} options={{ title: 'Home' }} />
        <Tabs.Screen name="SearchTab" component={SearchTab} options={{ title: 'Search' }} />
        <Tabs.Screen name="LibraryTab" component={LibraryTab} options={{ title: 'Your Library' }} />
      </Tabs.Navigator>
      <ToastHost bottomOffset={tabHeight + (player.track ? MINI_PLAYER_HEIGHT + 12 : 12)} />
    </View>
  );
}

const theme: Theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: palette.bg, card: palette.bg, primary: palette.text, border: 'transparent' },
};

export function RootNavigator() {
  return (
    <NavigationContainer ref={navigationRef} theme={theme}>
      <Root.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.bg } }}>
        <Root.Screen name="Tabs" component={TabsScreen} />
        <Root.Screen
          name="Player"
          component={PlayerScreen}
          options={{ animation: 'slide_from_bottom', gestureEnabled: true, gestureDirection: 'vertical' }}
        />
        <Root.Screen name="Queue" component={QueueScreen} options={{ animation: 'slide_from_bottom' }} />
      </Root.Navigator>
    </NavigationContainer>
  );
}
