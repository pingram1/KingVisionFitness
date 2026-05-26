import jwt from 'jsonwebtoken';
import type { Server, Socket } from 'socket.io';
import { env } from '../config/env';
import Group from '../models/Group';

// Extend the Socket type with the authenticated principal we attach on connect.
export interface AuthedSocket extends Socket {
  data: Socket['data'] & {
    userId: string;
    role?: string;
  };
}

/**
 * Socket.io handshake authentication. Clients must supply a JWT either via
 *   `io(url, { auth: { token } })`
 * or the `Authorization: Bearer <token>` upgrade header.
 *
 * Unauthenticated sockets are rejected at handshake — we never let an anonymous
 * client into `user-*` or `group-*` rooms.
 */
export function attachSocketAuth(io: Server): void {
  io.use((socket, next) => {
    try {
      const rawAuthToken =
        (socket.handshake.auth && (socket.handshake.auth as Record<string, unknown>).token) ||
        socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');

      if (typeof rawAuthToken !== 'string' || rawAuthToken.length === 0) {
        return next(new Error('UNAUTHORIZED'));
      }

      const decoded = jwt.verify(rawAuthToken, env.JWT_SECRET, { algorithms: ['HS256'] }) as {
        _id?: string;
        role?: string;
      };

      if (!decoded?._id) {
        return next(new Error('UNAUTHORIZED'));
      }

      (socket as AuthedSocket).data.userId = decoded._id;
      (socket as AuthedSocket).data.role = decoded.role;

      return next();
    } catch {
      return next(new Error('UNAUTHORIZED'));
    }
  });
}

/**
 * Replace the legacy free-for-all room joiners. The user can ONLY join their
 * own user-room (the JWT subject), and may only join groups they actually
 * belong to (checked against the Group model on each request).
 */
export function registerAuthedRoomHandlers(io: Server): void {
  io.on('connection', (socket) => {
    const authed = socket as AuthedSocket;
    const { userId } = authed.data;

    // Auto-join the principal's user room — no client opt-in needed.
    authed.join(`user-${userId}`);

    authed.on('join-group', async (groupId: string, ack?: (ok: boolean) => void) => {
      try {
        if (typeof groupId !== 'string' || groupId.length === 0) {
          ack?.(false);
          return;
        }
        // `isMember()` falls back to the legacy `members[]` array when
        // `memberships[]` is empty, so we MUST project both fields — otherwise
        // legacy-only members would be rejected even though they have access.
        const group: any = await Group.findById(groupId).select('memberships.user memberships.role members');
        if (!group || typeof group.isMember !== 'function' || !group.isMember(userId)) {
          ack?.(false);
          return;
        }
        authed.join(`group-${groupId}`);
        ack?.(true);
      } catch {
        ack?.(false);
      }
    });

    authed.on('leave-group', (groupId: string, ack?: (ok: boolean) => void) => {
      if (typeof groupId === 'string' && groupId.length > 0) {
        authed.leave(`group-${groupId}`);
      }
      ack?.(true);
    });
  });
}
