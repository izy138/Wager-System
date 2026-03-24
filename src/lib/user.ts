import type { User, PublicUser } from '@/types/index.js';

export function toPublicUser(user: User): PublicUser {
  const { password_hash: _, ...pub } = user;
  return pub;
}
