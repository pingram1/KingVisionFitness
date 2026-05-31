import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { requestPasswordReset } from '../api/authPassword';
import { BrandLogo } from '../components/BrandLogo';

export type AuthStackParamList = {
  Login: { message?: string } | undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: undefined;
};

type Nav = NativeStackNavigationProp<AuthStackParamList, 'ForgotPassword'>;

function parseApiError(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const data = (error as { response?: { data?: { message?: string } } }).response?.data;
    if (typeof data?.message === 'string' && data.message) return data.message;
  }
  return fallback;
}

export default function ForgotPasswordScreen() {
  const navigation = useNavigation<Nav>();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    setError('');
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      setError('Enter the email address for your account.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalized)) {
      setError('Enter a valid email address.');
      return;
    }

    try {
      setLoading(true);
      await requestPasswordReset(normalized);
      setSent(true);
    } catch (err) {
      setError(parseApiError(err, 'Could not send reset email. Try again.'));
    } finally {
      setLoading(false);
    }
  };

  const goToReset = useCallback(() => {
    navigation.navigate('ResetPassword');
  }, [navigation]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.flex}
    >
      <LinearGradient colors={['#f3f4f6', '#e5e7eb']} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.backRow}
              onPress={() => navigation.goBack()}
              disabled={loading}
            >
              <Ionicons name="arrow-back" size={20} color="#4f46e5" />
              <Text style={styles.backText}>Back to sign in</Text>
            </TouchableOpacity>

            <View style={styles.header}>
              <BrandLogo style={styles.logoMark} />
              <Text style={styles.title}>Reset Password</Text>
              <Text style={styles.tagline}>
                Enter your email and we will send a reset link with a one-time code.
              </Text>
            </View>

            {sent ? (
              <View style={styles.successBox}>
                <Ionicons name="mail-open-outline" size={28} color="#166534" />
                <Text style={styles.successTitle}>Check your inbox</Text>
                <Text style={styles.successBody}>
                  If an account exists for that email, a reset link has been sent. Open the email
                  and copy the reset code from the link, then enter it on the next screen.
                </Text>
                <TouchableOpacity style={styles.primaryButton} onPress={goToReset}>
                  <Text style={styles.primaryButtonText}>Enter Reset Code</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={styles.label}>Email Address</Text>
                <View style={styles.inputRow}>
                  <Ionicons name="mail-outline" size={20} color="#9ca3af" style={styles.leadingIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="you@example.com"
                    placeholderTextColor="#9ca3af"
                    value={email}
                    onChangeText={(v) => {
                      setEmail(v);
                      if (error) setError('');
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading}
                  />
                </View>

                {error ? (
                  <View style={[styles.banner, styles.bannerError]}>
                    <Text style={styles.bannerTextError}>{error}</Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
                  onPress={handleSubmit}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Send Reset Link</Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity style={styles.secondaryLink} onPress={goToReset} disabled={loading}>
              <Text style={styles.secondaryLinkText}>Already have a reset code?</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 32,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 28,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  backText: {
    color: '#4f46e5',
    fontSize: 14,
    fontWeight: '600',
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoMark: {
    width: 96,
    height: 96,
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 52,
    marginBottom: 16,
    backgroundColor: '#fafafa',
  },
  leadingIcon: { marginRight: 8 },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
  },
  banner: {
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  bannerError: { backgroundColor: '#fee2e2' },
  bannerTextError: { color: '#991b1b', fontSize: 14, lineHeight: 20 },
  primaryButton: {
    backgroundColor: '#667eea',
    borderRadius: 12,
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  primaryButtonDisabled: { opacity: 0.65 },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  successBox: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#166534',
    marginTop: 4,
  },
  successBody: {
    fontSize: 14,
    color: '#374151',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  secondaryLink: {
    alignItems: 'center',
    marginTop: 20,
  },
  secondaryLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4f46e5',
  },
});
