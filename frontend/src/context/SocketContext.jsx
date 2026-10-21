import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { SOCKET_URL } from '../utils/apiClient';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    console.log('Initializing Socket.IO client...');
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Socket connected successfully with ID:', newSocket.id);
    });

    newSocket.on('connect_error', (err) => {
      console.warn('Socket connection error. Real-time features will fallback gracefully.', err.message);
    });

    return () => {
      newSocket.close();
    };
  }, [user]);

  // Join tracking room
  const joinTripTracking = (tripId) => {
    if (!socket) return;
    
    setIsFinished(false);
    setChatMessages([]);
    setCurrentLocation(null);

    socket.emit('joinTrip', { tripId });

    socket.on('locationUpdate', (data) => {
      setCurrentLocation(data);
    });

    socket.on('newChatMessage', (msg) => {
      setChatMessages((prev) => [...prev, msg]);
    });

    socket.on('destinationReached', () => {
      setIsFinished(true);
    });
  };

  // Leave tracking room
  const leaveTripTracking = (tripId) => {
    if (!socket) return;
    socket.emit('leaveTrip', { tripId });
    socket.off('locationUpdate');
    socket.off('newChatMessage');
    socket.off('destinationReached');
    setChatMessages([]);
    setCurrentLocation(null);
    setIsFinished(false);
  };

  // Send chat message in trip room
  const sendTripMessage = (tripId, content) => {
    if (!socket || !user) return;
    socket.emit('sendChatMessage', {
      tripId,
      senderName: user.name,
      content
    });
  };

  return (
    <SocketContext.Provider value={{
      socket,
      currentLocation,
      chatMessages,
      isFinished,
      joinTripTracking,
      leaveTripTracking,
      sendTripMessage
    }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
