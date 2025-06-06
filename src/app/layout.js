import './globals.css';
import WhatsAppButton from '@/components/WhatsAppButton';

export const metadata = {
  title: 'FTAPP GAME',
  description: 'Juego multijugador en tiempo real ',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <div className="app-container">
          <div className="app-title">
            <img src="/images/logo.png" alt="FTAPP GAME" className="logo-image" />
          </div>
          {children}
          <WhatsAppButton phoneNumber="573016497697" />
        </div>
      </body>
    </html>
  );
}