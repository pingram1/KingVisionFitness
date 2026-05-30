import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { BrandLogo } from './BrandLogo';
import { formatDurationLabel, formatVolumeLbs } from '../pages/activeWorkoutHelpers';

export interface WorkoutCompletionStats {
  durationMinutes: number;
  totalVolume: number;
  completedSets: number;
  workoutTitle?: string;
}

type WorkoutCompletionModalProps = {
  visible: boolean;
  stats: WorkoutCompletionStats | null;
  onGoHome: () => void;
};

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
}) {
  return (
    <View style={styles.metricCard} accessibilityRole="text">
      <Ionicons name={icon} size={22} color="#667eea" />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export default function WorkoutCompletionModal({
  visible,
  stats,
  onGoHome,
}: WorkoutCompletionModalProps) {
  const scaleAnim = useRef(new Animated.Value(0.82)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    if (!visible) {
      scaleAnim.setValue(0.82);
      opacityAnim.setValue(0);
      setLogoFailed(false);
      return;
    }

    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 7,
        tension: 70,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, opacityAnim, scaleAnim]);

  const durationLabel = stats ? formatDurationLabel(stats.durationMinutes) : '—';
  const volumeLabel = stats ? formatVolumeLbs(stats.totalVolume) : '—';
  const setsLabel = stats ? String(stats.completedSets) : '—';

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
      onRequestClose={onGoHome}
    >
      <View style={styles.screen}>
        <Animated.View
          style={[
            styles.logoWrap,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {logoFailed ? (
            <View style={styles.logoFallback} accessibilityLabel="King Vision Fitness">
              <Ionicons name="trophy" size={56} color="#667eea" />
              <Text style={styles.logoFallbackText}>King Vision Fitness</Text>
            </View>
          ) : (
            <BrandLogo
              style={styles.logo}
              onError={() => setLogoFailed(true)}
            />
          )}
        </Animated.View>

        <Text style={styles.headline}>Workout Complete!</Text>
        {stats?.workoutTitle ? (
          <Text style={styles.subheadline}>{stats.workoutTitle}</Text>
        ) : null}

        <View style={styles.metricsRow}>
          <MetricCard icon="time-outline" label="Duration" value={durationLabel} />
          <MetricCard icon="barbell-outline" label="Volume" value={volumeLabel} />
          <MetricCard icon="checkmark-done-outline" label="Sets" value={setsLabel} />
        </View>

        <View style={styles.messageCard}>
          <Ionicons name="people-outline" size={20} color="#667eea" />
          <Text style={styles.messageText}>
            Your stats are on their way to your team leaderboards. Keep showing up — your crew
            is watching.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.homeButton}
          onPress={onGoHome}
          accessibilityRole="button"
          accessibilityLabel="Back to Home"
        >
          <Ionicons name="home-outline" size={22} color="#fff" />
          <Text style={styles.homeButtonText}>Back to Home</Text>
        </TouchableOpacity>

        {!stats ? (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator size="large" color="#667eea" />
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 56 : 32,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  logoWrap: {
    marginBottom: 8,
  },
  logo: {
    width: 160,
    height: 160,
    marginBottom: 0,
  },
  logoFallback: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#eef0fc',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  logoFallbackText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#667eea',
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  headline: {
    fontSize: 28,
    fontWeight: '800',
    color: '#222',
    textAlign: 'center',
    marginTop: 8,
  },
  subheadline: {
    fontSize: 15,
    color: '#666',
    marginTop: 6,
    textAlign: 'center',
    fontWeight: '600',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 28,
    width: '100%',
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#222',
    textAlign: 'center',
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  messageCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#eef0fc',
    borderRadius: 14,
    padding: 16,
    marginTop: 24,
    width: '100%',
  },
  messageText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
    color: '#3949ab',
    fontWeight: '600',
  },
  homeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#667eea',
    borderRadius: 14,
    paddingVertical: 16,
    width: '100%',
    marginTop: 28,
  },
  homeButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(245,245,245,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
