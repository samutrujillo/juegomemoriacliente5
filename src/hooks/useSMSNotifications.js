// hooks/useSMSNotifications.js
import { useCallback, useRef } from 'react';

/**
 * Hook personalizado para manejar notificaciones SMS
 * Incluye throttling para evitar spam de notificaciones
 */
export const useSMSNotifications = (adminPhone = "+5492945552523") => {
  const lastNotificationRef = useRef({});
  const THROTTLE_TIME = 30000; // 30 segundos entre notificaciones del mismo tipo

  /**
   * Enviar notificación de jugador conectado
   */
  const notifyPlayerOnline = useCallback(async (playerName, mesaType = "GOLD") => {
    const notificationKey = `online_${playerName}`;
    const now = Date.now();
    
    // Verificar throttling
    if (lastNotificationRef.current[notificationKey] && 
        (now - lastNotificationRef.current[notificationKey]) < THROTTLE_TIME) {
      console.log(`Notificación SMS throttled para ${playerName}`);
      return { success: false, reason: 'throttled' };
    }

    try {
      const message = formatPlayerOnlineMessage(playerName, mesaType);
      const result = await sendSMSMessage(message, adminPhone);
      
      // Actualizar timestamp de última notificación
      lastNotificationRef.current[notificationKey] = now;
      
      return result;
    } catch (error) {
      console.error('Error en notificación SMS de jugador online:', error);
      return { success: false, error: error.message };
    }
  }, [adminPhone]);

  /**
   * Enviar notificación de jugador desconectado
   */
  const notifyPlayerOffline = useCallback(async (playerName, mesaType = "GOLD") => {
    const notificationKey = `offline_${playerName}`;
    const now = Date.now();
    
    // Verificar throttling
    if (lastNotificationRef.current[notificationKey] && 
        (now - lastNotificationRef.current[notificationKey]) < THROTTLE_TIME) {
      return { success: false, reason: 'throttled' };
    }

    try {
      const message = formatPlayerOfflineMessage(playerName, mesaType);
      const result = await sendSMSMessage(message, adminPhone);
      
      lastNotificationRef.current[notificationKey] = now;
      
      return result;
    } catch (error) {
      console.error('Error en notificación SMS de jugador offline:', error);
      return { success: false, error: error.message };
    }
  }, [adminPhone]);

  /**
   * Enviar notificación personalizada
   */
  const sendCustomNotification = useCallback(async (message, throttleKey = null) => {
    if (throttleKey) {
      const now = Date.now();
      if (lastNotificationRef.current[throttleKey] && 
          (now - lastNotificationRef.current[throttleKey]) < THROTTLE_TIME) {
        return { success: false, reason: 'throttled' };
      }
      lastNotificationRef.current[throttleKey] = now;
    }

    try {
      return await sendSMSMessage(message, adminPhone);
    } catch (error) {
      console.error('Error en notificación SMS personalizada:', error);
      return { success: false, error: error.message };
    }
  }, [adminPhone]);

  return {
    notifyPlayerOnline,
    notifyPlayerOffline,
    sendCustomNotification
  };
};

/**
 * Formatear mensaje de jugador conectado
 */
const formatPlayerOnlineMessage = (playerName, mesaType) => {
  const timeStr = new Date().toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return `🎮 FTAPPGAME
👤 ${playerName}
🎯 Mesa ${mesaType} 5.000
⏰ ${timeStr}
🟢 CONECTADO`;
};

/**
 * Formatear mensaje de jugador desconectado
 */
const formatPlayerOfflineMessage = (playerName, mesaType) => {
  const timeStr = new Date().toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return `🎮 FTAPPGAME
👤 ${playerName}
🎯 Mesa ${mesaType} 5.000
⏰ ${timeStr}
🔴 DESCONECTADO`;
};

/**
 * Enviar mensaje SMS usando el servicio
 */
const sendSMSMessage = async (message, phoneNumber) => {
  // En el cliente, usar la API route de Next.js
  if (typeof window !== 'undefined') {
    return await sendViaSMSAPI(message, phoneNumber);
  }
  
  // En el servidor, usar el servicio directamente
  const smsService = require('@/services/smsNotification').default;
  return await smsService.sendCustomNotification(message);
};

/**
 * Enviar via API route de Next.js
 */
const sendViaSMSAPI = async (message, phoneNumber) => {
  try {
    const response = await fetch('/api/send-sms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: phoneNumber,
        message: message
      })
    });

    if (!response.ok) {
      throw new Error(`SMS API Error: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, method: 'api_route', data };
  } catch (error) {
    console.error('Error enviando SMS via API route:', error);
    
    // Fallback: mostrar en consola para desarrollo
    if (process.env.NODE_ENV === 'development') {
      console.log('='.repeat(50));
      console.log('📱 SMS FALLBACK (DESARROLLO)');
      console.log('='.repeat(50));
      console.log(`Para: ${phoneNumber}`);
      console.log(`Mensaje: ${message}`);
      console.log(`Tiempo: ${new Date().toLocaleString('es-ES')}`);
      console.log('='.repeat(50));
      
      return { success: true, method: 'fallback', simulated: true };
    }
    
    throw error;
  }
};

export default useSMSNotifications;