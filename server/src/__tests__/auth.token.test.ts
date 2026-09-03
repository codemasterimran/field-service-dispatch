import jwt from 'jsonwebtoken';

// ── Mirror auth token logic from auth.ts middleware ───────────────────────────
// We test the pure token verification logic without Express or Prisma.

const JWT_SECRET = 'test-secret-for-unit-tests';

interface TokenPayload {
  id: string;
  email: string;
  role: 'DISPATCHER' | 'TECHNICIAN';
  name: string;
}

function signToken(payload: TokenPayload, secret = JWT_SECRET): string {
  return jwt.sign(payload, secret, { expiresIn: '1h' });
}

function verifyToken(token: string, secret = JWT_SECRET): TokenPayload {
  return jwt.verify(token, secret) as TokenPayload;
}

describe('Auth token — sign & verify', () => {
  // ── Happy path ────────────────────────────────────────────────────────────

  test('signed token can be verified and contains correct payload', () => {
    const payload: TokenPayload = {
      id: 'user-123',
      email: 'dispatcher@test.com',
      role: 'DISPATCHER',
      name: 'Sarah',
    };
    const token = signToken(payload);
    const decoded = verifyToken(token);

    expect(decoded.id).toBe(payload.id);
    expect(decoded.email).toBe(payload.email);
    expect(decoded.role).toBe(payload.role);
    expect(decoded.name).toBe(payload.name);
  });

  test('TECHNICIAN role is preserved in token', () => {
    const token = signToken({
      id: 'tech-456',
      email: 'tech@test.com',
      role: 'TECHNICIAN',
      name: 'James',
    });
    const decoded = verifyToken(token);
    expect(decoded.role).toBe('TECHNICIAN');
  });

  // ── Invalid / expired / tampered ─────────────────────────────────────────

  test('throws when token is signed with different secret', () => {
    const token = signToken({
      id: 'u1', email: 'a@b.com', role: 'DISPATCHER', name: 'A',
    }, 'correct-secret');

    expect(() => verifyToken(token, 'wrong-secret')).toThrow();
  });

  test('throws on malformed token string', () => {
    expect(() => verifyToken('not.a.token')).toThrow();
  });

  test('throws on empty string', () => {
    expect(() => verifyToken('')).toThrow();
  });

  test('throws on expired token', () => {
    const token = jwt.sign(
      { id: 'u2', email: 'x@y.com', role: 'DISPATCHER', name: 'X' },
      JWT_SECRET,
      { expiresIn: -1 } // already expired
    );
    expect(() => verifyToken(token)).toThrow();
  });

  // ── Role guard helper ─────────────────────────────────────────────────────

  function requireRole(userRole: string, required: string): boolean {
    return userRole === required;
  }

  test('requireRole returns true when roles match', () => {
    expect(requireRole('DISPATCHER', 'DISPATCHER')).toBe(true);
  });

  test('requireRole returns false for TECHNICIAN accessing DISPATCHER route', () => {
    expect(requireRole('TECHNICIAN', 'DISPATCHER')).toBe(false);
  });

  test('requireRole returns false for DISPATCHER accessing TECHNICIAN-only route', () => {
    expect(requireRole('DISPATCHER', 'TECHNICIAN')).toBe(false);
  });
});
