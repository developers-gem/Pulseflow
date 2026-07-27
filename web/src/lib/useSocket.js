import { useEffect, useRef } from "react";
import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:4000";

export function useSocket(onTick) {
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ["websocket"] });
    socketRef.current = socket;
    socket.on("simulation:tick", () => onTick?.());
    socket.on("patient:updated", () => onTick?.());
    socket.on("patient:created", () => onTick?.());
    socket.on("bed:updated", () => onTick?.());
    socket.on("ambulance:updated", () => onTick?.());
    socket.on("ambulance:created", () => onTick?.());
    return () => socket.disconnect();
  }, [onTick]);
}
