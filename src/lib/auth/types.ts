// =============================================================================
// Contrato de autenticación. La UI solo conoce esta interfaz; hay dos
// implementaciones intercambiables: Supabase (nube) y Local (sin backend).
// =============================================================================

export interface AuthUser {
  id: string;
  email: string | null;
  displayName: string | null;
  stallName: string | null;
}

export type AuthMode = 'supabase' | 'local';

export interface SignInInput {
  /** Solo modo Supabase */
  email?: string;
  /** Contraseña (Supabase) o clave de acceso (local) */
  password: string;
}

export interface SignUpInput extends SignInInput {
  fullName: string;
  stallName: string;
}

export interface SignUpResult {
  user: AuthUser | null;
  /** true si Supabase exige confirmar el correo antes de poder ingresar */
  needsConfirmation: boolean;
}

export interface AuthService {
  readonly mode: AuthMode;
  /** Sesión vigente (funciona sin conexión si ya se había iniciado sesión). */
  getSession(): Promise<AuthUser | null>;
  signIn(input: SignInInput): Promise<AuthUser>;
  signUp(input: SignUpInput): Promise<SignUpResult>;
  signOut(): Promise<void>;
  /** Suscripción a cambios de sesión (p. ej. cierre de sesión en otra pestaña). */
  onChange(listener: (user: AuthUser | null) => void): () => void;
  /** Modo local: true cuando aún no existe una cuenta en este dispositivo. */
  needsSignUp(): Promise<boolean>;
  /** Supabase: envía el correo de recuperación. Local: no disponible. */
  requestPasswordReset(email: string): Promise<void>;
  /** Fija una contraseña nueva usando la sesión de recuperación (Supabase). */
  updatePassword(next: string): Promise<void>;
  /** Cambio desde Ajustes: exige la contraseña/clave actual. */
  changePassword(current: string, next: string): Promise<void>;
}

/** Error con mensaje ya listo para mostrar al usuario. */
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export const MIN_PASSWORD_LENGTH = 6;
export const MIN_LOCAL_SECRET_LENGTH = 4;
