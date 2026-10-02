export { adoptServerState, toServerPayload, type ServerState } from './payload';
export {
  PUSH_DEBOUNCE_MS,
  canPush,
  decideStartup,
  isForeignNewer,
  isLocalEmpty,
  type PushGuards,
  type PushVerdict,
  type ServerRow,
  type StartupDecision
} from './decide';
