import { useEffect } from 'react';
import { sayVoiced } from './voiced';

// Say a conversation's line in its speaker's voice while it's up (lib/voiced.js):
// the line going (the next one, or the conversation closing) stops it, and
// only it, said or still waiting its turn (lib/speech.js).
export function useVoiced(who, text) {
  useEffect(() => {
    if (!who || !text) return undefined;
    const said = sayVoiced(who, text);
    return () => said.stop();
  }, [who, text]);
}
