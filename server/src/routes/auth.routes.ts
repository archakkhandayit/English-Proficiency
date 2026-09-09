import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../config/db.js';
import * as schema from '../db/schema.js';
import { AuthService } from '../services/auth.service.js';
import { requireAuth } from '../middleware/auth.js';
import type { AuthUser, JwtPayload } from '@nqt/shared';

export const authRouter = Router();

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  terms_acknowledged: z.boolean().refine((val) => val === true, {
    message: 'You must acknowledge the terms and honor code to register',
  }),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// POST /api/auth/register
authRouter.post('/register', async (req, res) => {
  try {
    const parseResult = registerSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.flatten().fieldErrors,
      });
      return;
    }

    const { name, email, password } = parseResult.data;
    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const [existing] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, normalizedEmail))
      .limit(1);

    if (existing) {
      res.status(409).json({
        error: 'An account with this email address already exists.',
      });
      return;
    }

    // Hash password & create user (candidates by default)
    const passwordHash = await bcrypt.hash(password, 10);
    const [newUser] = await db
      .insert(schema.users)
      .values({
        email: normalizedEmail,
        name: name.trim(),
        passwordHash,
        role: 'candidate',
      })
      .returning();

    const payload: JwtPayload = {
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role,
    };

    const tokens = AuthService.generateTokens(payload);
    await AuthService.storeRefreshToken(
      newUser.id,
      tokens.refreshToken,
      req.headers['user-agent'],
      req.ip
    );

    AuthService.setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    const user: AuthUser = {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
    };

    res.status(201).json({
      user,
      message: 'Account created successfully.',
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to create account. Please try again later.' });
  }
});

// POST /api/auth/login
authRouter.post('/login', async (req, res) => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.flatten().fieldErrors,
      });
      return;
    }

    const { email, password } = parseResult.data;
    const normalizedEmail = email.toLowerCase().trim();

    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, normalizedEmail))
      .limit(1);

    if (!user) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const tokens = AuthService.generateTokens(payload);
    await AuthService.storeRefreshToken(
      user.id,
      tokens.refreshToken,
      req.headers['user-agent'],
      req.ip
    );

    AuthService.setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };

    res.status(200).json({
      user: authUser,
      message: 'Logged in successfully.',
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error during login.' });
  }
});

// POST /api/auth/refresh
authRouter.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      AuthService.clearAuthCookies(res);
      res.status(401).json({ error: 'No refresh token provided.' });
      return;
    }

    const result = await AuthService.rotateRefreshToken(
      refreshToken,
      req.headers['user-agent'],
      req.ip
    );

    if (!result) {
      AuthService.clearAuthCookies(res);
      res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
      return;
    }

    AuthService.setAuthCookies(res, result.accessToken, result.refreshToken);

    res.status(200).json({
      user: result.user,
      message: 'Session refreshed successfully.',
    });
  } catch (error: any) {
    console.error('Refresh token error:', error);
    AuthService.clearAuthCookies(res);
    res.status(401).json({ error: 'Failed to refresh session.' });
  }
});

// POST /api/auth/logout
authRouter.post('/logout', async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
      await AuthService.revokeRefreshToken(refreshToken);
    }
    AuthService.clearAuthCookies(res);
    res.status(200).json({ message: 'Logged out successfully.' });
  } catch (error: any) {
    console.error('Logout error:', error);
    AuthService.clearAuthCookies(res);
    res.status(200).json({ message: 'Logged out successfully.' });
  }
});

// GET /api/auth/me
authRouter.get('/me', requireAuth, async (req, res) => {
  try {
    const [user] = await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
        role: schema.users.role,
      })
      .from(schema.users)
      .where(eq(schema.users.id, req.user!.userId))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    res.status(200).json({ user });
  } catch (error: any) {
    console.error('Fetch me error:', error);
    res.status(500).json({ error: 'Failed to fetch current user profile.' });
  }
});

