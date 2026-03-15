import { io } from 'socket.io-client';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.isConnected = false;
  }

  connect(backendUrl) {
    if (this.socket) {
      return;
    }

    // Convert HTTP URL to WebSocket URL
    const wsUrl = backendUrl.replace(/^http/, 'ws');
    
    this.socket = new WebSocket(`${wsUrl}/api/ws`);

    this.socket.onopen = () => {
      console.log('WebSocket connected');
      this.isConnected = true;
      this.notifyListeners('connected', { connected: true });

      // Start heartbeat
      this.heartbeatInterval = setInterval(() => {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
          this.socket.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);
    };

    this.socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('WebSocket message:', message);
        
        if (message.type) {
          this.notifyListeners(message.type, message.data);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.notifyListeners('error', { error });
    };

    this.socket.onclose = () => {
      console.log('WebSocket disconnected');
      this.isConnected = false;
      this.notifyListeners('disconnected', { connected: false });
      
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
      }

      // Attempt reconnection after 5 seconds
      setTimeout(() => {
        if (!this.isConnected) {
          this.socket = null;
          this.connect(backendUrl);
        }
      }, 5000);
    };
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
      this.isConnected = false;
    }
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  notifyListeners(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in listener callback:', error);
        }
      });
    }
  }

  send(data) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    }
  }
}

const wsService = new WebSocketService();

export default wsService;
