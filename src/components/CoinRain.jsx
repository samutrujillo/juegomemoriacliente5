'use client';

import React, { useEffect, useRef } from 'react';
import '@/styles/CoinRain.css';

const CoinRain = ({ active, onComplete }) => {
  const containerRef = useRef(null);
  
  useEffect(() => {
    if (!active || !containerRef.current) return;
    
    // Limpiar monedas anteriores
    containerRef.current.innerHTML = '';
    
    // Usar menos monedas para mejor rendimiento
    const coinCount = window.innerWidth < 768 ? 15 : 25;
    
    // Crear monedas directamente en el DOM sin estado de React
    for (let i = 0; i < coinCount; i++) {
      const coin = document.createElement('div');
      coin.className = 'coin';
      coin.textContent = '💰';
      
      // Aplicar estilos directamente
      coin.style.left = `${Math.random() * 100}%`;
      coin.style.width = `${Math.random() * 15 + 20}px`;
      coin.style.height = `${Math.random() * 15 + 20}px`;
      coin.style.animationDelay = `${Math.random() * 0.5}s`;
      coin.style.animationDuration = `${Math.random() * 1 + 1}s`;
      
      containerRef.current.appendChild(coin);
    }
    
    // Terminar la animación más rápido
    const timer = setTimeout(() => {
      if (onComplete) onComplete();
    }, 1500);
    
    return () => clearTimeout(timer);
  }, [active, onComplete]);
  
  if (!active) return null;
  
  return (
    <div className="coin-rain-container" ref={containerRef}></div>
  );
};

export default CoinRain;