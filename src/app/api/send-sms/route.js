// app/api/send-sms/route.js
import smsNotificationService from '@/services/smsNotification';

export async function POST(request) {
  try {
    const { to, message } = await request.json();

    if (!to || !message) {
      return Response.json(
        { error: 'Faltan parámetros requeridos: to, message' },
        { status: 400 }
      );
    }

    // Verificar configuración
    const config = smsNotificationService.checkConfiguration();
    
    if (!config.configured && process.env.NODE_ENV === 'production') {
      return Response.json(
        { error: 'Servicio SMS no configurado' },
        { status: 500 }
      );
    }

    // Enviar SMS
    const result = await smsNotificationService.sendCustomNotification(message);

    if (result.success) {
      return Response.json({
        success: true,
        messageId: result.messageId || 'simulated',
        provider: result.provider || 'unknown'
      });
    } else {
      return Response.json(
        { error: result.error || 'Error desconocido' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error en API de SMS:', error);
    return Response.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// Método GET para verificar estado del servicio
export async function GET() {
  try {
    const config = smsNotificationService.checkConfiguration();
    
    return Response.json({
      status: 'active',
      configured: config.configured,
      providers: config.providers,
      fallbackOnly: config.fallbackOnly
    });
  } catch (error) {
    return Response.json(
      { error: 'Error verificando configuración' },
      { status: 500 }
    );
  }
}