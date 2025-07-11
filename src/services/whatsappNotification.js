// services/whatsappNotification.js
// Servicio para enviar notificaciones automáticas de WhatsApp

class WhatsAppNotificationService {
  constructor() {
    // Tu número de WhatsApp donde quieres recibir las notificaciones
    this.adminWhatsApp = "573018695692"; // Cambia por tu número
    
    // URL base para la API de WhatsApp Web
    this.whatsappWebURL = "https://web.whatsapp.com/send";
    
    // Configuración para usar un servicio de API de WhatsApp (opcional)
    this.apiConfig = {
      // Si tienes una API de WhatsApp Business, configúrala aquí
      apiURL: process.env.WHATSAPP_API_URL || null,
      apiToken: process.env.WHATSAPP_API_TOKEN || null
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
      // Método 1: Usar WhatsApp Web (abre ventana nueva)
      await this.sendViaWhatsAppWeb(message);
      
      // Método 2: Si tienes API de WhatsApp Business, usar ese método
      if (this.apiConfig.apiURL && this.apiConfig.apiToken) {
        await this.sendViaAPI(message);
      }
      
      console.log(`Notificación enviada: ${playerName} está en línea`);
      return { success: true, message: "Notificación enviada correctamente" };
      
    } catch (error) {
      console.error("Error enviando notificación de WhatsApp:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Formatear el mensaje de notificación
   */
  formatPlayerOnlineMessage(playerName, mesaType, timestamp) {
    const timeStr = new Date(timestamp).toLocaleString('es-ES', {
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
  }

  /**
   * Enviar mensaje via WhatsApp Web (abre ventana nueva)
   */
  async sendViaWhatsAppWeb(message) {
    if (typeof window === 'undefined') {
      // Estamos en el servidor, no podemos abrir WhatsApp Web
      return;
    }

    const encodedMessage = encodeURIComponent(message);
    const whatsappURL = `${this.whatsappWebURL}?phone=${this.adminWhatsApp}&text=${encodedMessage}`;
    
    // Abrir en ventana nueva pequeña
    const popup = window.open(
      whatsappURL, 
      'whatsapp_notification',
      'width=400,height=600,scrollbars=yes,resizable=yes'
    );
    
    // Cerrar automáticamente después de 3 segundos
    setTimeout(() => {
      if (popup && !popup.closed) {
        popup.close();
      }
    }, 3000);
  }

  /**
   * Enviar mensaje via API de WhatsApp Business (si está configurada)
   */
  async sendViaAPI(message) {
    if (!this.apiConfig.apiURL || !this.apiConfig.apiToken) {
      return;
    }

    const response = await fetch(this.apiConfig.apiURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiConfig.apiToken}`
      },
      body: JSON.stringify({
        to: this.adminWhatsApp,
        text: message,
        type: 'text'
      })
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Notificar desconexión de jugador
   */
  async notifyPlayerOffline(playerName, mesaType = "GOLD") {
    const message = `🎮 *FTAPPGAME - Jugador Desconectado*

👤 *Jugador:* ${playerName}
🎯 *Mesa:* ${mesaType} 5.000
⏰ *Hora:* ${new Date().toLocaleString('es-ES')}
🔴 *Estado:* DESCONECTADO

_Notificación automática del sistema_`;

    return await this.sendNotification(message);
  }

  /**
   * Método genérico para enviar cualquier notificación
   */
  async sendNotification(message) {
    try {
      await this.sendViaWhatsAppWeb(message);
      
      if (this.apiConfig.apiURL && this.apiConfig.apiToken) {
        await this.sendViaAPI(message);
      }
      
      return { success: true };
    } catch (error) {
      console.error("Error enviando notificación:", error);
      return { success: false, error: error.message };
    }
  }
}

// Instancia singleton del servicio
const whatsappNotificationService = new WhatsAppNotificationService();

export default whatsappNotificationService;

// También exportar la clase para uso personalizado
export { WhatsAppNotificationService };