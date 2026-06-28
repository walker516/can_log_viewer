export interface SignalIdentity {
  signal_name: string;
  message_name: string;
  can_id: string | number;
}

export function signalKey(signal: SignalIdentity): string {
  return `${signal.message_name}::${signal.signal_name}::${normalizeCanId(signal.can_id)}`;
}

export function sameSignal(left: SignalIdentity, right: SignalIdentity): boolean {
  return signalKey(left) === signalKey(right);
}

function normalizeCanId(canId: string | number): string {
  return String(canId);
}
