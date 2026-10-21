import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PromptHost } from './src/components/Prompt';
import { TrackSheetHost } from './src/components/TrackSheet';
import { RootNavigator } from './src/navigation/RootNavigator';
import { PlayerProvider } from './src/playback/hooks';
import { palette } from './src/theme/colors';
import { ThemeProvider } from './src/theme/ThemeContext';

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          <PlayerProvider>
            <RootNavigator />
            <TrackSheetHost />
            <PromptHost />
          </PlayerProvider>
        </ThemeProvider>
      </SafeAreaProvider>
      <StatusBar style="light" />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
});
