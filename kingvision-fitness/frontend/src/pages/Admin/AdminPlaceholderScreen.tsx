import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type AdminPlaceholderProps = {
  /** Icon shown above the title. */
  icon: keyof typeof Ionicons.glyphMap;
  /** Big screen title. */
  title: string;
  /** One-line subtitle below the title. */
  subtitle: string;
  /** Bulleted list of upcoming capabilities for this section. */
  upcoming: string[];
};

/**
 * Shared "coming soon" layout for stubbed admin tabs. Keeps the navigation
 * shell wired up and the visual language consistent while the real
 * sub-features are built out incrementally.
 */
export default function AdminPlaceholderScreen({
  icon,
  title,
  subtitle,
  upcoming,
}: AdminPlaceholderProps) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={28} color="#d4af37" />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        <View style={styles.divider} />

        <Text style={styles.upcomingHeader}>Coming next</Text>
        {upcoming.map((item) => (
          <View key={item} style={styles.upcomingRow}>
            <Ionicons name="ellipse" size={6} color="#9ca3af" style={styles.upcomingDot} />
            <Text style={styles.upcomingText}>{item}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f7f7fb',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#1f2937',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
    lineHeight: 20,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e5e7eb',
    marginVertical: 16,
  },
  upcomingHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  upcomingDot: {
    marginRight: 10,
    marginTop: 7,
  },
  upcomingText: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    lineHeight: 19,
  },
});
