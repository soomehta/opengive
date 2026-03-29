import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '../../../../server/routers/_app';
import { createContext } from '../../../../server/trpc';

function handler(req: Request) {
  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    // Pass the Request so createContext can extract the Supabase JWT from
    // the incoming Cookie / Authorization headers.
    createContext: () => createContext({ req }),
  });
}

export { handler as GET, handler as POST };
