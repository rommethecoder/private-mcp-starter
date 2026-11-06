import { handle } from './worker.js';
export default { fetch: (request, env) => handle(request, env, true) };
