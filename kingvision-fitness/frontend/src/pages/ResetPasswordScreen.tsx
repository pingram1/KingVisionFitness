import React, { useMemo, useState } from 'react';
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
import { resetPasswordWithToken } from '../api/authPassword';
import type { AuthStackParamList } from './ForgotPasswordScreen';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'ResetPassword'>;

function parseApiError(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const data = (error as { response?: { data?: { message?: string; errors?: unknown[] } } })
      .response?.data;
    if (typeof data?.message === 'string' && data.message) return data.message;
    if (Array.isArray(data?.errors) && data.errors.length > 0) {
      const first = data.errors[0];
      if (typeof first === 'object' && first !== null && 'msg' in first) {
        return String((first as { msg: string }).msg);
      }
    }
  }
  return fallback;
}

/** Accept raw token or full reset URL pasted from email. */
function normalizeResetToken(raw: string): string {
  const trimmed = raw.trim();
  const tokenMatch = trimmed.match(/[?&]token=([a-f0-9]+)/i);
  if (tokenMatch) return tokenMatch[1];
  return trimmed;
}

export default function ResetPasswordScreen() {
  const navigation = useNavigation<Nav>();
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const passwordHints = useMemo(
    () => ({
      length: password.length >= 8,
      upper: /[A-Z]/.test(password),
      lower: /[a-z]/.test(password),
      digit: /\d/.test(password),
    }),
    [password]
  );

  const handleSubmit = async () => {
    setError('');
    const normalizedToken = normalizeResetToken(token);
    if (!normalizedToken) {
      setError('Paste the reset code from your email.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!passwordHints.length || !passwordHints.upper || !passwordHints.lower || !passwordHints.digit) {
      setError('Password must be at least 8 characters with uppercase, lowercase, and a number.');
      return;
    }

    try {
      setLoading(true);
      await resetPasswordWithToken(normalizedToken, password);
      navigation.navigate('Login', {
        message: 'Password updated. Sign in with your new password.',
      });
    } catch (err) {
      setError(parseApiError(err, 'Could not reset password. The code may have expired.'));
    } finally {
      setLoading(false);
    }
  };

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
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>

            <Text style={styles.title}>Create New Password</Text>
            <Text style={styles.tagline}>
              Paste the reset code from your email, or the full reset link. Codes expire after 1
              hour.
            </Text>

            <Text style={styles.label}>Reset Code</Text>
            <View style={styles.inputRow}>
              <Ionicons name="key-outline" size={20} color="#9ca3af" style={styles.leadingIcon} />
              <TextInput
                style={styles.input}
                placeholder="Paste code or reset link"
                placeholderTextColor="#9ca3af"
                value={token}
                onChangeText={(v) => {
                  setToken(v);
                  if (error) setError('');
                }}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
            </View>

            <Text style={styles.label}>New Password</Text>
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={20} color="#9ca3af" style={styles.leadingIcon} />
              <TextInput
                style={styles.input}
                placeholder="At least 8 characters"
                placeholderTextColor="#9ca3af"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                editable={!loading}
              />
              <TouchableOpacity onPress={() => setShowPassword((s) => !s)} hitSlop={12}>
                <Ionicons
                  name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                  size={20}
                  color="#9ca3af"
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Confirm Password</Text>
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={20} color="#9ca3af" style={styles.leadingIcon} />
              <TextInput
                style={styles.input}
                placeholder="Re-enter password"
                placeholderTextColor="#9ca3af"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
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
                <Text style={styles.primaryButtonText}>Update Password</Text>
              )}
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
    marginBottom: 16,
  },
  backText: {
    color: '#4f46e5',
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 20,
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
});
