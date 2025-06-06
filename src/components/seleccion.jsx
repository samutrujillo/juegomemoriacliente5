import { useState } from 'react';
import { Sparkles, ChevronRight, Users } from 'lucide-react';

export default function MesaSelection() {
  const [hoveredTable, setHoveredTable] = useState(null);
  // Función para redirigir al componente login.jsx
  const navigateToLogin = (mesaValue) => {
    console.log(`Navegando al login con valor de mesa: ${mesaValue}`);
    // En una implementación real, esta función conectaría con el componente login.jsx
    // Por ahora simulamos la navegación con una alerta
    alert(`Redirigiendo a login.jsx con mesa de ${mesaValue}`);
    // En una aplicación real podríamos usar:
    // window.location.href = '/login?mesa=' + mesaValue;
  };

  const mesas = [
    { id: 1, nombre: "MESA VIP", valor: "15.000", color: "from-purple-600 to-blue-700", hover: "from-purple-500 to-blue-600" },
    { id: 2, nombre: "MESA ROYAL", valor: "30.000", color: "from-green-500 to-green-400", hover: "from-green-400 to-green-300" },
    { id: 3, nombre: "MESA GOLD", valor: "20.000", color: "from-amber-500 to-yellow-400", hover: "from-amber-400 to-yellow-300" }
  ];

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4 bg-opacity-90 relative overflow-hidden">
      {/* Background animation effect */}
      <div className="absolute inset-0 bg-black">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900 to-black opacity-70"></div>
        <div className="absolute top-0 left-0 w-full h-full bg-[url('/api/placeholder/1200/800')] bg-cover opacity-10"></div>
      </div>
      
      {/* Main content */}
      <div className="relative z-10 w-full max-w-5xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 mb-4">
            FTAPPGAME
          </h1>
          <p className="text-xl text-gray-300 mb-6">Selecciona una mesa para comenzar</p>
          <div className="flex items-center justify-center">
            <Sparkles className="text-yellow-400 mr-2" size={24} />
            <span className="text-yellow-400 font-semibold">¡Grandes premios te esperan!</span>
          </div>
        </div>

        {/* Table selection grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {mesas.map((mesa) => (
            <div
              key={mesa.id}
              className={`
                bg-gradient-to-br ${mesa.id === hoveredTable ? mesa.hover : mesa.color}
                rounded-lg p-1 transform transition-all duration-300 
                ${mesa.id === hoveredTable ? 'scale-105 shadow-lg shadow-blue-500/50' : 'scale-100'}
              `}
              onMouseEnter={() => setHoveredTable(mesa.id)}
              onMouseLeave={() => setHoveredTable(null)}
              onClick={() => navigateToLogin(mesa.valor)}
            >
              <div className="bg-gray-800 bg-opacity-80 rounded-lg p-6 h-full flex flex-col justify-between cursor-pointer">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2 flex items-center">
                    {mesa.nombre}
                  </h2>
                  <div className="flex items-center text-gray-300 mb-4">
                    <Users size={18} className="mr-2" />
                    <span>Jugadores online: 10</span>
                  </div>
                </div>
                
                <div className="mt-4">
                  <div className="text-sm font-medium text-green-400 mb-1">GANAS</div>
                  <div className="text-3xl font-bold text-white mb-2">
                    ${mesa.valor}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300"></span>
                    <div className={`
                      inline-flex items-center px-3 py-1 rounded-full 
                      bg-gradient-to-r from-blue-600/70 to-purple-600/70 
                      text-white text-sm font-medium
                    `}>
                      ENTRAR <ChevronRight size={16} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Footer note */}
        <div className="text-center mt-12">
          <p className="text-gray-400 text-sm">
            Debes iniciar sesión para jugar. Juego para mayores de 18 años.
          </p>
        </div>
      </div>
    </div>
  );
}