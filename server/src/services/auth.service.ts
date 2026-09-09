import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import type { Response } from 'express';
import { db } from '../config/db.js';
import { env } from '../config/env.js';
import * as schema from '../db/schema.js';
import type { AuthUser, JwtPayload, UserRole } from '@nqt/shared';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

export class AuthService {
  /**
   * Hash a refresh token using SHA-256 for secure database storage.
   */
  static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Generate an Access Token (15 min) and a Refresh Token (7 days).
   */
  static generateTokens(payload: JwtPayload): { accessToken: string; refreshToken: string } {
    const accessToken = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: ACCESS_TOKEN_EXPIRY,
    });

    const jti = crypto.randomUUID();
    const refreshToken = jwt.sign(
      { userId: payload.userId, role: payload.role, jti },
      env.REFRESH_TOKEN_SECRET,
      { expiresIn: `${REFRESH_TOKEN_EXPIRY_DAYS}d` }
    );

    return { accessToken, refreshToken };
  }

  /**
   * Store refresh token hash in DB.
   */
  static async storeRefreshToken(
    userId: string,
    refreshToken: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    await db.insert(schema.refreshTokens).values({
      userId,
      tokenHash,
      expiresAt,
      userAgent: userAgent || null,
      ipAddress: ipAddress || null,
    });
  }

  /**
   * Rotate refresh token: validates existing token, revokes it, and issues new token pair.
   */
  static async rotateRefreshToken(
    oldRefreshToken: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<{ accessToken: string; refreshToken: string; user: AuthUser } | null> {
    try {
      const decoded = jwt.verify(oldRefreshToken, env.REFRESH_TOKEN_SECRET) as { userId: string; role: UserRole };
      const tokenHash = this.hashToken(oldRefreshToken);

      // Find token record
      const [tokenRecord] = await db
        .select()
        .from(schema.refreshTokens)
        .where(eq(schema.refreshTokens.tokenHash, tokenHash))
        .limit(1);

      // If token record doesn't exist or already revoked, potential token reuse attempt!
      if (!tokenRecord || tokenRecord.revokedAt) {
        if (tokenRecord?.revokedAt) {
          // Invalidate all tokens for user as security precaution
          await db
            .update(schema.refreshTokens)
            .set({ revokedAt: new Date() })
            .where(eq(schema.refreshTokens.userId, decoded.userId));
        }
        return null;
      }

      // Check expiration
      if (new Date() > new Date(tokenRecord.expiresAt)) {
        return null;
      }

      // Revoke current token
      await db
        .update(schema.refreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(schema.refreshTokens.id, tokenRecord.id));

      // Get current user info
      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, decoded.userId))
        .limit(1);

      if (!user) return null;

      const userPayload: JwtPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
      };

      const newTokens = this.generateTokens(userPayload);
      await this.storeRefreshToken(user.id, newTokens.refreshToken, userAgent, ipAddress);

      return {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      };
    } catch {
      return null;
    }
  }

  /**
   * Revoke a refresh token on logout.
   */
  static async revokeRefreshToken(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await db
      .update(schema.refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(schema.refreshTokens.tokenHash, tokenHash));
  }

  /**
   * Set httpOnly cookies on the response.
   */
  static setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
    const isProduction = env.NODE_ENV === 'production';

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/api/auth/refresh',
      maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000, // 7 days
    });
  }

  /**
   * Clear auth cookies on logout.
   */
  static clearAuthCookies(res: Response): void {
    const isProduction = env.NODE_ENV === 'production';
    res.clearCookie('accessToken', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
    });
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/api/auth/refresh',
    });
  }
}
