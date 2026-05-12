import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

export const useSocket = (token) => {
    const socketRef = useRef(null);

    useEffect(() => {
        if (!token) return;

        socketRef.current = io('http://localhost:5000', {
            auth: { token },
        });

        socketRef.current.on('connect', () => {
            console.log('Connected to server');
        });

        socketRef.current.on('disconnect', () => {
            console.log('Disconnected');
        });

        return () => {
            socketRef.current.disconnect();
        };
    }, [token]);

    return socketRef.current;
};