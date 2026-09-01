import '@fastify/jwt';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AdminJWTPayload;
    user: AdminJWTPayload;
  }
}

export interface AdminJWTPayload {
  id: string;
  email: string;
  name: string;
  role: 'superadmin' | 'admin' | 'moderator';
}
