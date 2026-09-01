"use client";

import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { API_URL } from "@/lib/config";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_URL, { autoConnect: true });
  }
  return socket;
}

export function useSessionSocket(sessionId: string, userName: string) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const s = getSocket();
    socketRef.current = s;
    s.emit("join", { sessionId, user: { name: userName } });
    return () => {
      s.emit("leave", { sessionId });
    };
  }, [sessionId, userName]);

  return socketRef.current ?? getSocket();
}
