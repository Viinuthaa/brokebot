import { useCallback, useEffect, useRef, useState } from 'react';
import {
  OrderType,
  ReplayPayload,
  ShockScenario,
  Side,
  TickPayload,
} from '../types';

export type ConnectionStatus = 'CONNECTING' | 'LIVE' | 'DISCONNECTED';

const DEFAULT_WS_URL =
  (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_WS_URL ??
  'ws://localhost:8080';

export function useExchangeSocket(url = DEFAULT_WS_URL) {
  const [status, setStatus] = useState<ConnectionStatus>('CONNECTING');
  const [liveState, setLiveState] = useState<TickPayload | null>(null);
  const [replayState, setReplayState] = useState<ReplayPayload | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const orderSeqRef = useRef(0);

  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return;
    }

    setStatus('CONNECTING');
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('LIVE');
      setLastError(null);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'TICK') {
          setLiveState(data as TickPayload);
        } else if (data.type === 'REPLAY_STATE') {
          setReplayState(data as ReplayPayload);
        } else if (data.type === 'ERROR') {
          setLastError(data.message ?? 'Exchange error');
        }
      } catch {
        setLastError('Malformed frame from exchange');
      }
    };

    ws.onclose = () => {
      setStatus('DISCONNECTED');
      wsRef.current = null;
      reconnectTimerRef.current = window.setTimeout(() => {
        connect();
      }, 1500);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [url]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current);
      }
      wsRef.current?.close();
    };
  }, [connect]);

  const sendRaw = useCallback((payload: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  }, []);

  const placeOrder = useCallback(
    (params: {
      side: Side;
      orderType: OrderType;
      price: number;
      qty: number;
    }) => {
      orderSeqRef.current += 1;
      sendRaw({
        type: 'COMMAND',
        command: {
          kind: 'PLACE',
          orderId: `manual-${Date.now()}-${orderSeqRef.current}`,
          traderId: 'human-desk',
          side: params.side,
          orderType: params.orderType,
          price: params.orderType === 'MARKET' ? 0 : Math.round(params.price),
          qty: Math.round(params.qty),
        },
      });
    },
    [sendRaw]
  );

  const togglePause = useCallback(
    (paused: boolean) => {
      sendRaw({ type: 'PAUSE', paused });
    },
    [sendRaw]
  );

  const triggerShock = useCallback(
    (scenario: ShockScenario) => {
      sendRaw({ type: 'SHOCK', scenario });
    },
    [sendRaw]
  );

  const resetExchange = useCallback(() => {
    setReplayState(null);
    sendRaw({ type: 'RESET' });
  }, [sendRaw]);

  const queryReplay = useCallback(
    (seq: number) => {
      sendRaw({ type: 'REPLAY_QUERY', seq });
    },
    [sendRaw]
  );

  const exitReplay = useCallback(() => {
    setReplayState(null);
  }, []);

  return {
    status,
    liveState,
    replayState,
    lastError,
    placeOrder,
    togglePause,
    triggerShock,
    resetExchange,
    queryReplay,
    exitReplay,
  };
}