import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, Send, ArrowLeft, MessageSquare, Compass, Navigation } from 'lucide-react';
import { API_BASE } from '../utils/apiClient';

// Fix default Leaflet icon paths in Vite bundles
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// Custom Auto/Car pulsing marker icon
const createMovingIcon = (type) => {
  const iconHtml = `
    <div class="relative flex items-center justify-center">
      <span class="absolute inline-flex h-8 w-8 animate-ping rounded-full bg-brand-500 opacity-75"></span>
      <div class="relative flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg border-2 border-white">
        ${type === 'auto' ? '🛺' : type === 'bus' ? '🚌' : '🚗'}
      </div>
    </div>
  `;
  return L.divIcon({
    html: iconHtml,
    className: 'custom-moving-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
};

// Map helper to center the map on new location coordinates
const ChangeMapCenter = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);
  return null;
};

const TrackingMap = () => {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const { 
    currentLocation, 
    chatMessages, 
    isFinished, 
    joinTripTracking, 
    leaveTripTracking, 
    sendTripMessage 
  } = useSocket();

  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chatInput, setChatInput] = useState('');
  const [sosStatus, setSosStatus] = useState('');
  const [checkpointAlert, setCheckpointAlert] = useState('');

  // Fetch trip static details
  useEffect(() => {
    const fetchTrip = async () => {
      try {
        const res = await fetch(`${API_BASE}/trips/${tripId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.trip) {
            setTrip(data.trip);
            joinTripTracking(tripId);
          } else {
            console.error('Trip not found in response');
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchTrip();

    return () => {
      leaveTripTracking(tripId);
    };
  }, [tripId, token]);

  // Listen to checkpoints
  useEffect(() => {
    if (currentLocation && currentLocation.checkpoint) {
      setCheckpointAlert(`Passed ${currentLocation.checkpoint}`);
      const timer = setTimeout(() => setCheckpointAlert(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [currentLocation]);

  const handleSendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendTripMessage(tripId, chatInput);
    setChatInput('');
  };

  const handleTriggerSOS = async () => {
    try {
      setSosStatus('Alerting...');
      const res = await fetch(`${API_BASE}/utility/sos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          tripId,
          currentCoords: currentLocation || (trip ? trip.startLocation : null)
        })
      });
      if (res.ok) {
        setSosStatus('SENT');
        setTimeout(() => setSosStatus(''), 3000);
      } else {
        setSosStatus('FAILED');
      }
    } catch (err) {
      console.error(err);
      setSosStatus('FAILED');
    }
  };

  if (loading) {
    return <div className="text-center mt-20 text-slate-400">Loading tracking session...</div>;
  }

  if (!trip) {
    return (
      <div className="text-center mt-20">
        <p className="text-slate-400">Unable to load active trip details.</p>
        <button onClick={() => navigate('/')} className="mt-4 bg-brand-500 text-white px-4 py-2 rounded-lg">Return to Dashboard</button>
      </div>
    );
  }

  // Fallback map position: start location of the trip
  const startCoords = [trip.startLocation.lat, trip.startLocation.lng];
  const endCoords = [trip.endLocation.lat, trip.endLocation.lng];
  const activePosition = currentLocation ? [currentLocation.lat, currentLocation.lng] : startCoords;

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] space-y-4">
      {/* Map Header */}
      <div className="glass-panel p-4 rounded-xl flex items-center justify-between shadow-md border border-slate-800/80">
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => navigate('/')}
            className="p-2 hover:bg-slate-800/50 rounded-lg text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h3 className="font-extrabold text-sm text-slate-100 flex items-center">
              Live Tracking: {trip.routeName}
              {trip.status === 'active' && (
                <span className="ml-2 px-2 py-0.5 rounded-full text-[9px] font-bold bg-accent-teal/20 text-accent-teal animate-pulse">
                  ACTIVE
                </span>
              )}
            </h3>
            <p className="text-[10px] text-slate-400">
              Vehicle: {trip.vehicleModel || 'Standard'} ({trip.plateNumber || 'JK02-XXXX'})
            </p>
          </div>
        </div>

        {/* Safety SOS and Checkpoint banner */}
        <div className="flex items-center space-x-4">
          {checkpointAlert && (
            <div className="bg-brand-500/20 border border-brand-500/30 text-brand-300 text-[10px] font-bold px-3 py-1 rounded-lg animate-bounce flex items-center space-x-1">
              <Navigation className="h-3 w-3 animate-spin" />
              <span>{checkpointAlert}</span>
            </div>
          )}

          <button
            onClick={handleTriggerSOS}
            className="bg-accent-rose hover:bg-red-600 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl shadow-[0_0_15px_rgba(244,63,94,0.4)] transition flex items-center space-x-1.5"
          >
            <ShieldAlert className="h-4 w-4" />
            <span>{sosStatus || 'SOS'}</span>
          </button>
        </div>
      </div>

      {/* Main Area: Map + Chat sidebar */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 h-full min-h-0">
        
        {/* Left Side: Leaflet Map Container */}
        <div className="lg:col-span-3 h-full relative rounded-xl overflow-hidden shadow-2xl border border-slate-800/60 bg-brand-850">
          <MapContainer 
            center={activePosition} 
            zoom={14} 
            scrollWheelZoom={true}
            className="h-full w-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" // Premium dark-themed maps
            />

            {/* Change center dynamically */}
            <ChangeMapCenter center={activePosition} />

            {/* Start Location Pin */}
            <Marker position={startCoords}>
              <Popup>
                <div className="text-xs font-semibold text-slate-800">
                  <p className="font-bold text-brand-500">Origin Start</p>
                  <p>{trip.startLocation.name}</p>
                </div>
              </Popup>
            </Marker>

            {/* End Location Pin */}
            <Marker position={endCoords}>
              <Popup>
                <div className="text-xs font-semibold text-slate-800">
                  <p className="font-bold text-accent-rose">Destination End</p>
                  <p>{trip.endLocation.name}</p>
                </div>
              </Popup>
            </Marker>

            {/* Simulated Path Line */}
            {trip.path && (
              <Polyline 
                positions={trip.path.map(p => [p.lat, p.lng])} 
                color="#3b6cfd" 
                weight={4}
                opacity={0.6}
                dashArray="5, 10"
              />
            )}

            {/* Live Moving Vehicle Pin */}
            {activePosition && (
              <Marker 
                position={activePosition} 
                icon={createMovingIcon(trip.vehicleType || 'car')}
              >
                <Popup>
                  <div className="text-xs text-slate-800">
                    <p className="font-bold">Live Position</p>
                    <p>Speed: ~35 km/h (Simulated)</p>
                  </div>
                </Popup>
              </Marker>
            )}
          </MapContainer>

          {/* Finished Overlay */}
          {isFinished && (
            <div className="absolute inset-0 bg-brand-900/80 z-[1000] flex flex-col justify-center items-center text-center p-6 backdrop-blur-sm">
              <Compass className="h-16 w-16 text-accent-emerald animate-pulse mb-4" />
              <h2 className="text-2xl font-extrabold text-white">Ride Completed!</h2>
              <p className="text-sm text-slate-400 mt-2">The vehicle has safely arrived at {trip.endLocation.name}.</p>
              <button 
                onClick={() => navigate('/')} 
                className="mt-6 bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm px-6 py-2.5 rounded-xl shadow-lg transition"
              >
                Back to Dashboard
              </button>
            </div>
          )}
        </div>

        {/* Right Side: Chat Panel */}
        <div className="glass-panel rounded-xl shadow-xl flex flex-col h-full overflow-hidden border border-slate-800/80 min-h-0 bg-brand-850">
          <div className="bg-brand-850 px-4 py-3 border-b border-slate-800/80 flex items-center space-x-2">
            <MessageSquare className="h-5 w-5 text-brand-400" />
            <span className="font-bold text-xs text-slate-200 uppercase tracking-wide">In-App Chatroom</span>
          </div>

          {/* Messages list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatMessages.length === 0 ? (
              <div className="text-center text-slate-500 text-xs mt-10">
                No messages yet. Send coordinates/updates to coordinates room.
              </div>
            ) : (
              chatMessages.map((msg, i) => (
                <div 
                  key={i} 
                  className={`flex flex-col text-xs p-2.5 rounded-xl border ${
                    msg.senderName === user.name
                      ? 'bg-brand-500/10 border-brand-500/20 self-end text-right'
                      : 'bg-slate-800/40 border-slate-700/40 self-start text-left'
                  }`}
                >
                  <span className="font-extrabold text-[10px] text-brand-400">{msg.senderName}</span>
                  <span className="text-slate-200 mt-0.5 leading-relaxed">{msg.content}</span>
                </div>
              ))
            )}
          </div>

          {/* Chat input box */}
          <form onSubmit={handleSendChat} className="p-3 border-t border-slate-800/80 flex items-center space-x-2">
            <input
              type="text"
              placeholder="Type a message..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="flex-1 glass-input px-3 py-2.5 rounded-lg text-xs"
            />
            <button
              type="submit"
              className="bg-brand-500 hover:bg-brand-600 text-white p-2.5 rounded-lg transition"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};

export default TrackingMap;
