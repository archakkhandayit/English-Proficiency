import { EventEmitter } from 'events';

class AttemptEventManager extends EventEmitter {}

export const attemptEvents = new AttemptEventManager();
// Allow concurrent candidate SSE connections without MaxListenersExceededWarning
attemptEvents.setMaxListeners(0);

