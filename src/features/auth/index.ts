export { AuthProvider, useAuth, type AuthStatus } from './AuthProvider';
export { mapAuthError } from './errors';
export {
  deleteAccount,
  exchangeCodeForSession,
  getCurrentSession,
  requestPasswordReset,
  resendConfirmationEmail,
  signInWithEmail,
  signOut,
  signUpWithEmail,
  updatePassword,
  type SignUpOutcome,
} from './service';
export {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  hasAnyError,
  normalizeEmail,
  validateEmail,
  validatePassword,
  validatePasswordConfirmation,
  validateSignIn,
  validateSignUp,
  type CredentialErrors,
} from './validation';
