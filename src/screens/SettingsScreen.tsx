import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import EPlayer, { type OfflineStats } from '../../modules/e-player';
import { IconButton } from '../components/IconButton';
import { getSetting, setSetting } from '../db/settings';
import { refreshOffline, removeAllDownloads, syncLikedDownloads, useOffline } from '../offline/offline';
import { getPowerGuide, isBatteryOptimised } from '../playback/power';
import { ACCENTS, palette, radius } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { formatBytes } from '../utils/text';

const CACHE_LIMITS = [512, 1024, 2048, 5120];

export default function SettingsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { accent, setAccent } = useTheme();
  const offline = useOffline();
  const [autoplay, setAutoplay] = useState(true);
  const [downloadLiked, setDownloadLiked] = useState(true);
  const [stats, setStats] = useState<OfflineStats | null>(null);
  const [optimised, setOptimised] = useState(isBatteryOptimised);
  const guide = getPowerGuide();
  const device = EPlayer.getDeviceInfo();
  const accentName = ACCENTS.find((a) => a.value === accent)?.name ?? 'Custom';

  const loadStats = useCallback(() => {
    EPlayer.offlineStats()
      .then(setStats)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    getSetting('autoplay').then((v) => v !== null && setAutoplay(v === '1')).catch(() => undefined);
    getSetting('downloadLiked').then((v) => setDownloadLiked(v !== '0')).catch(() => undefined);
    // Re-check after returning from the system settings screen.
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setOptimised(isBatteryOptimised());
    });
    return () => sub.remove();
  }, []);

  // Storage figures follow download progress.
  useEffect(loadStats, [loadStats, offline]);

  const toggleAutoplay = (v: boolean) => {
    setAutoplay(v);
    setSetting('autoplay', v ? '1' : '0').catch(() => undefined);
    EPlayer.setAutoplay(v).catch(() => undefined);
  };

  const toggleDownloadLiked = (v: boolean) => {
    setDownloadLiked(v);
    setSetting('downloadLiked', v ? '1' : '0')
      .then(() => (v ? syncLikedDownloads() : undefined))
      .catch(() => undefined);
  };

  const setLimit = (mb: number) => {
    EPlayer.offlineSetLimitMb(mb)
      .then(loadStats)
      .catch(() => undefined);
  };

  const clearRecent = () =>
    Alert.alert('Clear recently played cache?', 'Songs saved from your likes stay on the phone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          EPlayer.offlineClearRecent()
            .then(refreshOffline)
            .then(loadStats)
            .catch(() => undefined);
        },
      },
    ]);

  const removeDownloads = () =>
    Alert.alert('Remove offline liked songs?', 'Your likes stay. Songs will stream again until saved back.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          toggleDownloadLiked(false);
          removeAllDownloads()
            .then(loadStats)
            .catch(() => undefined);
        },
      },
    ]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <IconButton name="chevron-back" size={28} onPress={() => navigation.goBack()} accessibilityLabel="Back" />
        <Text style={styles.heading}>Settings</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.section}>Ambient lighting</Text>
        <View style={styles.card}>
          <Text style={styles.label}>{accentName}</Text>
          <Text style={styles.hint}>Accent colour across the app.</Text>
          <View style={styles.swatches}>
            {ACCENTS.map((a) => (
              <Pressable
                key={a.value}
                onPress={() => setAccent(a.value)}
                accessibilityLabel={a.name}
                style={[styles.swatch, { backgroundColor: a.value }, accent === a.value && styles.swatchActive]}
              >
                {accent === a.value && <Ionicons name="checkmark" size={20} color="#000" />}
              </Pressable>
            ))}
          </View>
        </View>

        <Text style={styles.section}>Playback</Text>
        <View style={styles.card}>
          <View style={styles.switchRow}>
            <View style={styles.flex}>
              <Text style={styles.label}>Autoplay</Text>
              <Text style={styles.hint}>Keep playing similar songs when your queue ends.</Text>
            </View>
            <Switch value={autoplay} onValueChange={toggleAutoplay} trackColor={{ true: accent, false: palette.highlight }} thumbColor="#fff" />
          </View>
        </View>

        <Text style={styles.section}>Offline</Text>
        <View style={styles.card}>
          <View style={styles.switchRow}>
            <View style={styles.flex}>
              <Text style={styles.label}>Save liked songs offline</Text>
              <Text style={styles.hint}>Every song you like is stored on the phone and plays without signal.</Text>
            </View>
            <Switch value={downloadLiked} onValueChange={toggleDownloadLiked} trackColor={{ true: accent, false: palette.highlight }} thumbColor="#fff" />
          </View>
          {offline.pending > 0 && <Text style={[styles.hint, { color: accent }]}>Saving {offline.pending} song(s)…</Text>}

          <View style={styles.spaced}>
            <Text style={styles.label}>Recently played cache</Text>
            <Text style={styles.hint}>
              Songs you stream are kept so replays use no data. Oldest are removed past the limit.
            </Text>
            <View style={styles.chips}>
              {CACHE_LIMITS.map((mb) => (
                <Pressable
                  key={mb}
                  onPress={() => setLimit(mb)}
                  style={[styles.chip, stats?.limitMb === mb && { backgroundColor: accent }]}
                >
                  <Text style={[styles.chipText, stats?.limitMb === mb && styles.chipTextActive]}>
                    {mb >= 1024 ? `${mb / 1024} GB` : `${mb} MB`}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.hint}>A new limit applies the next time the app starts.</Text>
          </View>

          <View style={styles.usage}>
            <UsageRow label="Liked songs (offline)" value={stats ? formatBytes(stats.downloadBytes) : '…'} />
            <UsageRow label="Recently played" value={stats ? formatBytes(stats.recentBytes) : '…'} />
          </View>
          <View style={styles.buttons}>
            <SettingsButton label="Clear recent cache" accent={accent} onPress={clearRecent} />
            <SettingsButton label="Remove offline songs" accent={accent} onPress={removeDownloads} />
          </View>
        </View>

        <Text style={styles.section}>Background playback</Text>
        <View style={styles.card}>
          <View style={styles.statusRow}>
            <Ionicons name={optimised ? 'warning-outline' : 'checkmark-circle'} size={22} color={optimised ? palette.danger : accent} />
            <Text style={[styles.label, styles.flex]}>
              {optimised ? 'Battery optimisation is on' : 'Battery optimisation is off'}
            </Text>
          </View>
          <Text style={styles.hint}>
            {optimised
              ? 'Android may stop music when the screen is off. Turn optimisation off for E Music.'
              : 'Music can keep playing with the screen off.'}
          </Text>
          <Text style={[styles.label, styles.spaced]}>{guide.vendor}</Text>
          {guide.steps.map((s) => (
            <Text key={s} style={styles.hint}>
              • {s}
            </Text>
          ))}
          <View style={styles.buttons}>
            {optimised && (
              <SettingsButton label="Turn off optimisation" accent={accent} primary onPress={() => EPlayer.requestIgnoreBatteryOptimizations()} />
            )}
            {device.hasAutostartScreen && <SettingsButton label="Autostart" accent={accent} onPress={() => EPlayer.openAutostartSettings()} />}
            <SettingsButton label="App info" accent={accent} onPress={() => EPlayer.openAppSettings()} />
          </View>
        </View>

        <Text style={styles.section}>About</Text>
        <View style={styles.card}>
          <Text style={styles.hint}>
            E Music plays files on this phone, YouTube Music through the open-source NewPipe Extractor, and
            Audius (audius.co). All music belongs to its artists and labels; streams are credited to their
            source on every track.
          </Text>
          <Text style={[styles.hint, styles.version]}>
            E Music 0.4.1 · {device.brand} {device.model} · Android API {device.sdkInt}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function UsageRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.usageRow}>
      <Text style={styles.hint}>{label}</Text>
      <Text style={styles.usageValue}>{value}</Text>
    </View>
  );
}

function SettingsButton({ label, onPress, accent, primary }: { label: string; onPress: () => unknown; accent: string; primary?: boolean }) {
  return (
    <Pressable
      onPress={() => {
        const result = onPress();
        if (result instanceof Promise) result.catch(() => undefined);
      }}
      style={({ pressed }) => [styles.button, primary ? { backgroundColor: accent } : styles.buttonOutline, pressed && { opacity: 0.75 }]}
    >
      <Text style={[styles.buttonText, primary && styles.buttonTextPrimary]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 56 },
  heading: { color: palette.text, fontSize: 18, fontWeight: '700', marginLeft: 8 },
  content: { padding: 16, paddingBottom: 40 },
  section: { color: palette.textSecondary, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 20, marginBottom: 8 },
  card: { backgroundColor: palette.surface, borderRadius: radius.md, padding: 16 },
  label: { color: palette.text, fontSize: 15, fontWeight: '600' },
  hint: { color: palette.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 4 },
  flex: { flex: 1 },
  spaced: { marginTop: 18 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 14 },
  swatch: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  swatchActive: { borderWidth: 3, borderColor: '#fff' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, marginBottom: 4 },
  chip: { backgroundColor: palette.elevated, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 7 },
  chipText: { color: palette.text, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#000' },
  usage: { marginTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border, paddingTop: 10 },
  usageRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  usageValue: { color: palette.text, fontSize: 13, fontWeight: '600', marginTop: 4 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  button: { borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 9 },
  buttonOutline: { borderWidth: 1, borderColor: palette.textTertiary },
  buttonText: { color: palette.text, fontSize: 13, fontWeight: '700' },
  buttonTextPrimary: { color: '#000' },
  version: { marginTop: 12, color: palette.textTertiary },
});
