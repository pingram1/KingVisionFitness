import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { isActiveClient } from '../utils/subscriptionAccess';

interface RequireActiveClientProps {
  children: React.ReactNode;
  featureLabel?: string;
}

/**
 * Screen-level guard for Active Client-only flows (booking, sessions).
 * Shows an upgrade CTA instead of a blank screen or API 403 error.
 */
export default function RequireActiveClient({
  children,
  featureLabel = 'This feature',
}: RequireActiveClientProps) {
  const navigation = useNavigation();
  const { user, loading } = useAuth();

  if (loading && !user) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  if (!isActiveClient(user)) {
    return (
      <View style={styles.centered}>
        <Ionicons name="lock-closed-outline" size={48} color="#667eea" />
        <Text style={styles.title}>Active Client Required</Text>
        <Text style={styles.body}>
          {featureLabel} is available with an Active Client membership — custom plans, trainer
          access, and 1-on-1 booking.
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            const parent = navigation.getParent();
            if (parent) {
              parent.navigate('Profile', { screen: 'Upgrade' });
            }
          }}
        >
          <Text style={styles.buttonText}>View Membership Options</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a2e',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#667eea',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
