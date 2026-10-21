import { memo, type ReactNode } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { palette } from '../theme/colors';
import { Artwork } from './Artwork';

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.titleRow}>
      <Text style={styles.title}>{title}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={10}>
          <Text style={styles.action}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export interface CardItem {
  key: string;
  title: string;
  subtitle?: string;
  artworkUrl: string | null;
  round?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}

export const CARD_SIZE = 148;

function CardImpl({ item }: { item: CardItem }) {
  return (
    <Pressable
      onPress={item.onPress}
      onLongPress={item.onLongPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <Artwork uri={item.artworkUrl} size={CARD_SIZE} round={item.round} radius={8} />
      <Text style={[styles.cardTitle, item.round && styles.center]} numberOfLines={item.round ? 1 : 2}>
        {item.title}
      </Text>
      {item.subtitle ? (
        <Text style={[styles.cardSubtitle, item.round && styles.center]} numberOfLines={1}>
          {item.subtitle}
        </Text>
      ) : null}
    </Pressable>
  );
}

export const Card = memo(CardImpl);

/** Titled horizontal row of cards, the main building block of Home, Artist and Search. */
export function Shelf({ title, items, action, onAction }: { title: string; items: CardItem[]; action?: string; onAction?: () => void }) {
  if (items.length === 0) return null;
  return (
    <View style={styles.shelf}>
      <SectionTitle title={title} action={action} onAction={onAction} />
      <FlatList
        horizontal
        data={items}
        keyExtractor={(i) => i.key}
        renderItem={({ item }) => <Card item={item} />}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.shelfContent}
        initialNumToRender={4}
      />
    </View>
  );
}

export function EmptyState({ icon, title, message, children }: { icon: ReactNode; title: string; message?: string; children?: ReactNode }) {
  return (
    <View style={styles.empty}>
      {icon}
      <Text style={styles.emptyTitle}>{title}</Text>
      {message ? <Text style={styles.emptyMessage}>{message}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  title: { color: palette.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.3, flexShrink: 1 },
  action: { color: palette.textSecondary, fontSize: 13, fontWeight: '700' },
  shelf: { marginBottom: 28 },
  shelfContent: { paddingHorizontal: 16, gap: 14 },
  card: { width: CARD_SIZE },
  pressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
  cardTitle: { color: palette.text, fontSize: 13, fontWeight: '600', marginTop: 8 },
  cardSubtitle: { color: palette.textSecondary, fontSize: 12, marginTop: 2 },
  center: { textAlign: 'center' },
  empty: { alignItems: 'center', paddingHorizontal: 32, paddingVertical: 48 },
  emptyTitle: { color: palette.text, fontSize: 20, fontWeight: '700', marginTop: 16, textAlign: 'center' },
  emptyMessage: { color: palette.textSecondary, fontSize: 14, marginTop: 8, textAlign: 'center', lineHeight: 20 },
});
