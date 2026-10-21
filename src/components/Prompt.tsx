import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { palette, radius } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

interface PromptRequest {
  title: string;
  initial?: string;
  confirmLabel?: string;
  onSubmit: (value: string) => void;
}

let open: ((req: PromptRequest) => void) | null = null;

/** Text prompt (new playlist, rename). Mount <PromptHost/> once at the root. */
export function prompt(req: PromptRequest): void {
  open?.(req);
}

export function PromptHost() {
  const { accent } = useTheme();
  const [req, setReq] = useState<PromptRequest | null>(null);
  const [value, setValue] = useState('');

  useEffect(() => {
    open = (r) => {
      setValue(r.initial ?? '');
      setReq(r);
    };
    return () => {
      open = null;
    };
  }, []);

  const close = () => setReq(null);
  const submit = () => {
    const v = value.trim();
    if (!v || !req) return;
    req.onSubmit(v);
    close();
  };

  return (
    <Modal visible={req !== null} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={styles.card} onPress={() => undefined}>
          <Text style={styles.title}>{req?.title}</Text>
          <TextInput
            value={value}
            onChangeText={setValue}
            autoFocus
            selectTextOnFocus
            onSubmitEditing={submit}
            returnKeyType="done"
            placeholder="Name"
            placeholderTextColor={palette.textTertiary}
            selectionColor={accent}
            style={[styles.input, { borderBottomColor: accent }]}
          />
          <View style={styles.actions}>
            <Pressable onPress={close} hitSlop={8}>
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>
            <Pressable onPress={submit} hitSlop={8} style={[styles.confirm, { backgroundColor: accent }]}>
              <Text style={styles.confirmText}>{req?.confirmLabel ?? 'Save'}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: palette.overlay, justifyContent: 'center', padding: 28 },
  card: { backgroundColor: palette.elevated, borderRadius: radius.lg, padding: 22 },
  title: { color: palette.text, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  input: {
    color: palette.text,
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
    borderBottomWidth: 2,
    marginVertical: 24,
    paddingVertical: 8,
  },
  actions: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 28 },
  cancel: { color: palette.textSecondary, fontSize: 15, fontWeight: '600' },
  confirm: { borderRadius: radius.pill, paddingHorizontal: 28, paddingVertical: 12 },
  confirmText: { color: '#000', fontSize: 15, fontWeight: '700' },
});
