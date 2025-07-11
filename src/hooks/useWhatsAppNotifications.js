// hooks/useWhatsAppNotifications.js
import { useCallback, useRef } from 'react';

/**
 * Hook personalizado para manejar notificaciones de WhatsApp
 * Incluye throttling para evitar spam de notificaciones
 */
export const useWhatsAppNotifications = (adminWhatsApp = "573018695692") => {
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
      console.log(`Notificación throttled para ${playerName}`);
      return { success: false, reason: 'throttled' };
    }

    try {
      const message = formatPlayerOnlineMessage(playerName, mesaType);
      const result = await sendWhatsAppMessage(message, adminWhatsApp);
      
      // Actualizar timestamp de última notificación
      lastNotificationRef.current[notificationKey] = now;
      
      return result;
    } catch (error) {
      console.error('Error en notificación de jugador online:', error);
      return { success: false, error: error.message };
    }
  }, [adminWhatsApp]);

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
      const result = await sendWhatsAppMessage(message, adminWhatsApp);
      
      lastNotificationRef.current[notificationKey] = now;
      
      return result;
    } catch (error) {
      console.error('Error en notificación de jugador offline:', error);
      return { success: false, error: error.message };
    }
  }, [adminWhatsApp]);

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
      return await sendWhatsAppMessage(message, adminWhatsApp);
    } catch (error) {
      console.error('Error en notificación personalizada:', error);
      return { success: false, error: error.message };
    }
  }, [adminWhatsApp]);

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

  return `🎮 *FTAPPGAME - Jugador en Línea*

👤 *Jugador:* ${playerName}
🎯 *Mesa:* ${mesaType} 5.000
⏰ *Hora:* ${timeStr}
🟢 *Estado:* CONECTADO

_Notificación automática del sistema_`;
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

  return `🎮 *FTAPPGAME - Jugador Desconectado*

👤 *Jugador:* ${playerName}
🎯 *Mesa:* ${mesaType} 5.000
⏰ *Hora:* ${timeStr}
🔴 *Estado:* DESCONECTADO

_Notificación automática del sistema_`;
};

/**
 * Enviar mensaje de WhatsApp usando diferentes métodos
 */
const sendWhatsAppMessage = async (message, phoneNumber) => {
  // Método 1: WhatsApp Web (preferido para navegadores)
  if (typeof window !== 'undefined') {
    return await sendViaWhatsAppWeb(message, phoneNumber);
  }
  
  // Método 2: API de WhatsApp Business (si está disponible)
  if (process.env.NEXT_PUBLIC_WHATSAPP_API_URL) {
    return await sendViaAPI(message, phoneNumber);
  }
  
  throw new Error('No hay método de envío disponible');
};

/**
 * Enviar via WhatsApp Web
 */
const sendViaWhatsAppWeb = async (message, phoneNumber) => {
  const encodedMessage = encodeURIComponent(message);
  const whatsappURL = `https://web.whatsapp.com/send?phone=${phoneNumber}&text=${encodedMessage}`;
  
  // Crear un popup pequeño que se cierre automáticamente
  const popup = window.open(
    whatsappURL, 
    'whatsapp_notification',
    'width=400,height=600,scrollbars=no,resizable=no,toolbar=no,location=no,status=no'
  );
  
  // Intentar cerrar automáticamente después de 2 segundos
  if (popup) {
    setTimeout(() => {
      try {
        if (!popup.closed) {
          popup.close();
        }
      } catch (error) {
        console.log('No se pudo cerrar automáticamente el popup de WhatsApp');
      }
    }, 2000);
  }
  
  return { success: true, method: 'whatsapp_web' };
};

/**
 * Enviar via API de WhatsApp Business
 */
const sendViaAPI = async (message, phoneNumber) => {
  const apiURL = process.env.NEXT_PUBLIC_WHATSAPP_API_URL;
  const apiToken = process.env.NEXT_PUBLIC_WHATSAPP_API_TOKEN;
  
  if (!apiURL || !apiToken) {
    throw new Error('API de WhatsApp no configurada');
  }
  
  const response = await fetch(apiURL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiToken}`
    },
    body: JSON.stringify({
      to: phoneNumber,
      text: message,
      type: 'text'
    })
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  const data = await response.json();
  return { success: true, method: 'api', data };
};

export default useWhatsAppNotifications;