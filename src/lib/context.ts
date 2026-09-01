import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  user?: {
    id?: string;
    email?: string;
    role?: string;
    name?: string;
  };
}

export const requestContext = new AsyncLocalStorage<RequestContext>();
