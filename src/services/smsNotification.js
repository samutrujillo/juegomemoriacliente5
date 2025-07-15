// services/smsNotification.js
// Servicio para enviar notificaciones automáticas por SMS

class SMSNotificationService {
  constructor() {
    // Tu número de teléfono donde quieres recibir las notificaciones
    this.adminPhone = "+573132736590"; // Cambia por tu número con código de país
    
    // Configuración para diferentes proveedores de SMS
    this.smsConfig = {
      // Twilio (Recomendado)
      twilio: {
        accountSid: process.env.TWILIO_ACCOUNT_SID || null,
        authToken: process.env.TWILIO_AUTH_TOKEN || null,
        fromNumber: process.env.TWILIO_FROM_NUMBER || null,
        apiUrl: 'https://api.twilio.com/2010-04-01/Accounts'
      },
      
      // Vonage (ex Nexmo)
      vonage: {
        apiKey: process.env.VONAGE_API_KEY || null,
        apiSecret: process.env.VONAGE_API_SECRET || null,
        apiUrl: 'https://rest.nexmo.com/sms/json'
      },
      
      // TextMagic
      textmagic: {
        username: process.env.TEXTMAGIC_USERNAME || null,
        apiKey: process.env.TEXTMAGIC_API_KEY || null,
        apiUrl: 'https://rest.textmagic.com/api/v2/messages'
      },
      
      // SMS API genérica
      generic: {
        apiUrl: process.env.SMS_API_URL || null,
        apiKey: process.env.SMS_API_KEY || null,
        apiSecret: process.env.SMS_API_SECRET || null
      }
    };
  }

  /**
   * Método principal para enviar notificación de jugador en línea
   * @param {string} playerName - Nombre del jugador que ingresó
   * @param {string} mesaType - Tipo de mesa (VIP, ROYAL, GOLD)
   * @param {string} timestamp - Timestamp del ingreso
   */
  async notifyPlayerOnline(playerName, mesaType = "GOLD", timestamp = new Date()) {
    const message = this.formatPlayerOnlineMessage(playerName, mesaType, timestamp);
    
    try {
      const result = await this.sendSMS(message);
      
      console.log(`Notificación SMS enviada: ${playerName} está en línea`);
      return { success: true, message: "Notificación SMS enviada correctamente", data: result };
      
    } catch (error) {
      console.error("Error enviando notificación SMS:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Formatear el mensaje de notificación para SMS
   */
  formatPlayerOnlineMessage(playerName, mesaType, timestamp) {
    const timeStr = new Date(timestamp).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Los SMS tienen límite de caracteres, mantenemos el mensaje conciso
    return `🎮 MJAPPGAME
👤 ${playerName} 
🎯 Mesa ${mesaType} 5.000
⏰ ${timeStr}
🟢 CONECTADO`;
  }

  /**
   * Formatear mensaje de desconexión
   */
  formatPlayerOfflineMessage(playerName, mesaType) {
    const timeStr = new Date().toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    return `🎮 MJAPPGAME
👤 ${playerName}
🎯 Mesa ${mesaType} 5.000
⏰ ${timeStr}
🔴 DESCONECTADO`;
  }

  /**
   * Notificar desconexión de jugador
   */
  async notifyPlayerOffline(playerName, mesaType = "GOLD") {
    const message = this.formatPlayerOfflineMessage(playerName, mesaType);
    return await this.sendSMS(message);
  }

  /**
   * Método principal para enviar SMS usando el proveedor disponible
   */
  async sendSMS(message) {
    // Intentar con Twilio primero (más confiable)
    if (this.smsConfig.twilio.accountSid && this.smsConfig.twilio.authToken) {
      try {
        return await this.sendViaTwilio(message);
      } catch (error) {
        console.warn('Twilio falló, intentando con otro proveedor:', error.message);
      }
    }

    // Intentar con Vonage
    if (this.smsConfig.vonage.apiKey && this.smsConfig.vonage.apiSecret) {
      try {
        return await this.sendViaVonage(message);
      } catch (error) {
        console.warn('Vonage falló, intentando con otro proveedor:', error.message);
      }
    }

    // Intentar con TextMagic
    if (this.smsConfig.textmagic.username && this.smsConfig.textmagic.apiKey) {
      try {
        return await this.sendViaTextMagic(message);
      } catch (error) {
        console.warn('TextMagic falló, intentando con API genérica:', error.message);
      }
    }

    // Intentar con API genérica
    if (this.smsConfig.generic.apiUrl && this.smsConfig.generic.apiKey) {
      try {
        return await this.sendViaGenericAPI(message);
      } catch (error) {
        console.warn('API genérica falló:', error.message);
      }
    }

    // Si todos fallan, usar método de fallback (simulación)
    return await this.sendViaFallback(message);
  }

  /**
   * Enviar SMS via Twilio
   */
  async sendViaTwilio(message) {
    const { accountSid, authToken, fromNumber } = this.smsConfig.twilio;
    
    if (!accountSid || !authToken || !fromNumber) {
      throw new Error('Configuración de Twilio incompleta');
    }

    const url = `${this.smsConfig.twilio.apiUrl}/${accountSid}/Messages.json`;
    
    const credentials = btoa(`${accountSid}:${authToken}`);
    
    const formData = new URLSearchParams({
      To: this.adminPhone,
      From: fromNumber,
      Body: message
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Twilio Error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return { success: true, provider: 'twilio', messageId: data.sid };
  }

  /**
   * Enviar SMS via Vonage (ex Nexmo)
   */
  async sendViaVonage(message) {
    const { apiKey, apiSecret } = this.smsConfig.vonage;
    
    if (!apiKey || !apiSecret) {
      throw new Error('Configuración de Vonage incompleta');
    }

    const response = await fetch(this.smsConfig.vonage.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'MJAPPGAME',
        to: this.adminPhone.replace('+', ''),
        text: message,
        api_key: apiKey,
        api_secret: apiSecret
      })
    });

    if (!response.ok) {
      throw new Error(`Vonage Error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.messages && data.messages[0].status !== '0') {
      throw new Error(`Vonage Error: ${data.messages[0]['error-text']}`);
    }

    return { success: true, provider: 'vonage', messageId: data.messages[0]['message-id'] };
  }

  /**
   * Enviar SMS via TextMagic
   */
  async sendViaTextMagic(message) {
    const { username, apiKey } = this.smsConfig.textmagic;
    
    if (!username || !apiKey) {
      throw new Error('Configuración de TextMagic incompleta');
    }

    const credentials = btoa(`${username}:${apiKey}`);

    const response = await fetch(this.smsConfig.textmagic.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: message,
        phones: this.adminPhone
      })
    });

    if (!response.ok) {
      throw new Error(`TextMagic Error: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, provider: 'textmagic', messageId: data.id };
  }

  /**
   * Enviar SMS via API genérica
   */
  async sendViaGenericAPI(message) {
    const { apiUrl, apiKey, apiSecret } = this.smsConfig.generic;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'X-API-Secret': apiSecret || ''
      },
      body: JSON.stringify({
        to: this.adminPhone,
        message: message,
        from: 'FTAPPGAME'
      })
    });

    if (!response.ok) {
      throw new Error(`API Genérica Error: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, provider: 'generic', data };
  }

  /**
   * Método de fallback (simulación/log)
   */
  
  /**
   * Método genérico para enviar cualquier notificación
   */
  async sendCustomNotification(message) {
    try {
      return await this.sendSMS(message);
    } catch (error) {
      console.error("Error enviando notificación SMS personalizada:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Verificar configuración de SMS
   */
  checkConfiguration() {
    const providers = [];
    
    if (this.smsConfig.twilio.accountSid && this.smsConfig.twilio.authToken) {
      providers.push('Twilio');
    }
    
    if (this.smsConfig.vonage.apiKey && this.smsConfig.vonage.apiSecret) {
      providers.push('Vonage');
    }
    
    if (this.smsConfig.textmagic.username && this.smsConfig.textmagic.apiKey) {
      providers.push('TextMagic');
    }
    
    if (this.smsConfig.generic.apiUrl && this.smsConfig.generic.apiKey) {
      providers.push('API Genérica');
    }
    
    return {
      configured: providers.length > 0,
      providers: providers,
      fallbackOnly: providers.length === 0
    };
  }
}

// Instancia singleton del servicio
const smsNotificationService = new SMSNotificationService();

export default smsNotificationService;

// También exportar la clase para uso personalizado
export { SMSNotificationService };