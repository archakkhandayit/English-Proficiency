export type UserRole = 'candidate' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  created_at: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  name: string;
  email: string;
  password: string;
  terms_acknowledged: boolean;
}

export interface AuthResponse {
  user: AuthUser;
  message?: string;
}
