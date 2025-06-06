'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import io from 'socket.io-client';
import PlayerList from '@/components/PlayerList';
import Tile from '@/components/Tile';
import AdminButton from '@/components/AdminButton';
import WhatsAppButton from '@/components/WhatsAppButton';
import CoinRain from '@/components/CoinRain';
import '@/styles/GameBoard.css';
import config from '@/config';

let socket;

// Componente para ocultar el logo programáticamente
const HideLogoEffect = () => {
  useEffect(() => {
    // Ocultar el logo al montar el componente
    const logoElement = document.querySelector('.app-title');
    if (logoElement) {
      logoElement.style.display = 'none';
    }

    // Restaurar visibilidad al desmontar (si es necesario)
    return () => {
      const logoElement = document.querySelector('.app-title');
      if (logoElement) {
        logoElement.style.display = 'block';
      }
    };
  }, []);

  return null;
};

export default function Game() {
  // Función para generar un tablero local con distribución perfecta
  const generateLocalBoard = () => {
    const localBoard = [];

    // Para cada hilera
    for (let row = 0; row < 4; row++) {
      const rowTiles = [];

      // Crear 2 fichas ganadoras (+15000) y 2 perdedoras (-15000) para esta hilera
      for (let i = 0; i < 2; i++) {
        rowTiles.push({ value: 15000, revealed: false });  // Asegurarse que es positivo
      }
      for (let i = 0; i < 2; i++) {
        rowTiles.push({ value: -15000, revealed: false }); // Asegurarse que es negativo
      }

      // Mezclarlas
      for (let i = rowTiles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rowTiles[i], rowTiles[j]] = [rowTiles[j], rowTiles[i]];
      }

      // Añadirlas al tablero
      localBoard.push(...rowTiles);
    }

    // Validación adicional para verificar los valores
    console.log('Tablero local generado:', localBoard.map(tile => tile.value));

    return localBoard;
  };

  const [board, setBoard] = useState([]);
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [players, setPlayers] = useState([]);
  const [isYourTurn, setIsYourTurn] = useState(false);
  const [score, setScore] = useState(60000);
  const [localScore, setLocalScore] = useState(60000);
  const [message, setMessage] = useState('');
  const [timeLeft, setTimeLeft] = useState(6); // Cambiado de 4 a 6 segundos
  const [gameStatus, setGameStatus] = useState('playing');
  const [user, setUser] = useState(null);
  const [rowSelections, setRowSelections] = useState([0, 0, 0, 0]);
  const [canSelectTiles, setCanSelectTiles] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [lastSelectedTile, setLastSelectedTile] = useState(null);
  const [turnNotification, setTurnNotification] = useState('');
  const [showUnlockAlert, setShowUnlockAlert] = useState(false);

  // Nuevos estados para el sistema de mesas
  const [tablesPlayed, setTablesPlayed] = useState(0);
  const [currentTableNumber, setCurrentTableNumber] = useState(1); // Iniciar en mesa 1
  const [maxTablesReached, setMaxTablesReached] = useState(false);
  const [tableLockReason, setTableLockReason] = useState('');

  // Estado para alertas (restaurado para mostrar alertas)
  const [showAlert, setShowAlert] = useState(false);
  const [alertType, setAlertType] = useState('');
  const [alertMessage, setAlertMessage] = useState('');

  // Estado para modal de administrador
  const [showAdminModal, setShowAdminModal] = useState(false);

  // Nuevo estado para el bloqueo por puntaje
  const [isScoreLocked, setIsScoreLocked] = useState(false);

  // Estado para la lluvia de monedas
  const [showCoinRain, setShowCoinRain] = useState(false);
  const coinRainIdRef = useRef(0);
  const [coinRainId, setCoinRainId] = useState(0);

  const router = useRouter();

  // Referencias para los sonidos
  const winSoundRef = useRef(null);
  const loseSoundRef = useRef(null);
  const turnSoundRef = useRef(null); // Nuevo para sonido de turno

  // Referencia para seguimiento de cambios en puntuación
  const prevScoreRef = useRef();

  // Función segura para reproducir sonidos (modificada para solo reproducir sus propios sonidos)
  const playSoundSafely = (audioRef, volume = 1.0, playerId = null) => {
    // Solo reproducir si es el jugador actual o si no se especifica un playerId
    if (!playerId || playerId === user?.id) {
      if (audioRef && audioRef.current) {
        audioRef.current.volume = volume;

        // Reseteamos la reproducción
        audioRef.current.pause();
        audioRef.current.currentTime = 0;

        // Usar Promise.catch para manejar errores silenciosamente
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.log('Error reproduciendo sonido (ignorado):', error);
          });
        }
      }
    }
  };

  // Función para cerrar sesión y guardar el estado actual
  const handleLogout = () => {
    if (socket) {
      socket.emit('saveGameState', { userId: user.id });
      socket.disconnect();
    }
    sessionStorage.removeItem('user');
    router.push('/');
  };

  // Función para mostrar la alerta (restaurada) - Solo para el jugador actual
  const showPointsAlert = (points) => {
    const isPositive = points > 0;
    setAlertType(isPositive ? 'success' : 'error');
    setAlertMessage(isPositive
      ? `¡Ganaste ${points} puntos!`
      : `¡Perdiste ${Math.abs(points)} puntos!`);
    setShowAlert(true);

    // Ya no controlamos la lluvia de monedas aquí, sino en el evento tileSelected

    setTimeout(() => {
      setShowAlert(false);
    }, 2000);
  };

  // Función para actualizar el puntaje local con persistencia
  const updateLocalScore = (newScore) => {
    setLocalScore(newScore);

    try {
      const userData = sessionStorage.getItem('user');
      if (userData) {
        const userObj = JSON.parse(userData);
        userObj.score = newScore;
        sessionStorage.setItem('user', JSON.stringify(userObj));
        console.log('Puntaje actualizado en sessionStorage:', newScore);
      }
    } catch (error) {
      console.error('Error actualizando sessionStorage:', error);
    }
  };

  // Función para terminar la lluvia de monedas
  const handleCoinRainComplete = () => {
    setShowCoinRain(false);
  };

  // Función para abrir el modal de administrador
  const handleAdminPanel = () => {
    setShowAdminModal(true);
  };

  // Efecto adicional para verificar y registrar el estado del usuario administrador
  useEffect(() => {
    if (user) {
      console.log("Estado de usuario:", {
        username: user.username,
        isAdmin: user.isAdmin,
        id: user.id,
        isLockedDueToScore: user.isLockedDueToScore,
        isBlocked: user.isBlocked
      });

      // Inicializar el estado de bloqueo por puntaje
      setIsScoreLocked(user.isLockedDueToScore || false);
    }
  }, [user]);

  useEffect(() => {
    // Recuperar datos de usuario de sessionStorage
    const userData = sessionStorage.getItem('user');
    if (!userData) {
      router.push('/');
      return;
    }

    try {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      setScore(parsedUser.score || 60000);
      setLocalScore(parsedUser.score || 60000);
      setIsScoreLocked(parsedUser.isLockedDueToScore || false);

      // Inicializar referencia de puntuación
      prevScoreRef.current = parsedUser.score || 60000;

      // Establecer un tablero local
      const initialBoard = generateLocalBoard();
      setBoard(initialBoard);

      // Inicializar socket con opciones mejoradas para compatibilidad móvil
      socket = io(config.socketServerUrl, {
        ...config.socketOptions,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000, // Aumentar timeout para conexiones móviles lentas
        forceNew: false,
        transports: ['websocket', 'polling'] // Asegurar compatibilidad con todos los dispositivos
      });

      socket.on('connect', () => {
        setIsConnected(true);

        // Enviar evento para reconectar al usuario
        socket.emit('reconnectUser', {
          userId: parsedUser.id,
          username: parsedUser.username
        });

        // Solicitar sincronización de estado del juego para obtener la mesa actual
        socket.emit('syncGameState', { userId: parsedUser.id });

        // NUEVO: Verificar estado de mesas al conectar
        socket.emit('checkTableStatus', { userId: parsedUser.id });

        // Unirse al juego
        socket.emit('joinGame');

        setGameStatus('playing');

        if (players.length <= 1) {
          setIsYourTurn(true);
        }
      });

      socket.on('connect_error', (err) => {
        setIsConnected(false);
        setMessage('Error de conexión con el servidor. Reintentando...');

        setTimeout(() => {
          if (!socket.connected) {
            socket.connect();
          }
        }, 2000);
      });

      // Manejo específico para reconexiones en dispositivos móviles
      socket.on('reconnect_attempt', (attemptNumber) => {
        console.log(`Intento de reconexión #${attemptNumber}`);
        // Si estamos en un dispositivo móvil, cambiar a polling que funciona mejor con conexiones inestables
        if (window.innerWidth <= 768 && attemptNumber > 2) {
          socket.io.opts.transports = ['polling', 'websocket'];
        }
      });

      socket.on('sessionClosed', (message) => {
        alert(message);
        router.push('/');
      });

      socket.on('reconnect', (attemptNumber) => {
        setIsConnected(true);

        socket.emit('syncGameState', { userId: parsedUser.id });
        socket.emit('joinGame');
      });

      // Nuevo evento para actualizar el estado de conexión de los jugadores
      socket.on('connectionStatusUpdate', ({ players }) => {
        if (Array.isArray(players)) {
          setPlayers(prevPlayers => {
            // Crear una copia para modificar
            const updatedPlayers = [...prevPlayers];

            // Actualizar el estado de conexión de cada jugador
            players.forEach(playerUpdate => {
              const index = updatedPlayers.findIndex(p => p.id === playerUpdate.id);
              if (index !== -1) {
                updatedPlayers[index] = {
                  ...updatedPlayers[index],
                  isConnected: playerUpdate.isConnected
                };
              }
            });

            return updatedPlayers;
          });

          // Si solo hay un jugador conectado y soy yo, darme el turno
          const connectedPlayers = players.filter(p => p.isConnected);
          if (connectedPlayers.length === 1 && connectedPlayers[0].id === parsedUser.id) {
            setIsYourTurn(true);
            setTimeLeft(6);
            setCanSelectTiles(true);
          }
        }
      });

      // Añadir manejo para el evento de límite de puntaje
      socket.on('scoreLimitReached', ({ message }) => {
        setIsScoreLocked(true);
        setMessage(message);
        setTimeout(() => {
          setMessage('Tu cuenta está bloqueada por alcanzar o llegar a 23000 puntos');
        }, 5000);
      });

      socket.on('userUnlocked', ({ message }) => {
        setIsScoreLocked(false);
        setMessage(message);
        setTimeout(() => setMessage(''), 3000);
      });

      // Nuevo evento para detección de errores en selección de fichas
      socket.on('tileSelectError', ({ message }) => {
        console.log('Error en selección de ficha:', message);
        // Sincronizar estado con el servidor
        socket.emit('syncGameState', { userId: parsedUser.id });
      });

      // Nuevo evento para cambios de estado de bloqueo en tiempo real
      socket.on('blockStatusChanged', ({ isBlocked, isLockedDueToScore, message }) => {
        if (isBlocked !== undefined) {
          setUser(prev => ({ ...prev, isBlocked }));

          // Actualizar los datos del usuario en sessionStorage
          try {
            const userData = sessionStorage.getItem('user');
            if (userData) {
              const userObj = JSON.parse(userData);
              userObj.isBlocked = isBlocked;
              sessionStorage.setItem('user', JSON.stringify(userObj));
            }
          } catch (error) {
            console.error('Error actualizando sessionStorage:', error);
          }
        }

        if (isLockedDueToScore !== undefined) {
          setIsScoreLocked(isLockedDueToScore);
          setUser(prev => ({ ...prev, isLockedDueToScore }));

          // Actualizar los datos del usuario en sessionStorage
          try {
            const userData = sessionStorage.getItem('user');
            if (userData) {
              const userObj = JSON.parse(userData);
              userObj.isLockedDueToScore = isLockedDueToScore;
              sessionStorage.setItem('user', JSON.stringify(userObj));
            }
          } catch (error) {
            console.error('Error actualizando sessionStorage:', error);
          }
        }

        if (message) {
          setMessage(message);
          setTimeout(() => setMessage(''), 3000);
        }
      });

      // Nuevo evento para manejar cambios en la conexión de jugadores
      socket.on('playerConnectionChanged', ({ playerId, isConnected, username }) => {
        // Actualizar la lista de jugadores localmente
        setPlayers(prevPlayers =>
          prevPlayers.map(player =>
            player.id === playerId
              ? { ...player, isConnected }
              : player
          )
        );

        // Mostrar mensaje informativo
        const message = isConnected
          ? `${username} se ha reconectado al juego`
          : `${username} se ha desconectado del juego`;

        setMessage(message);
        setTimeout(() => setMessage(''), 3000);
      });

      // Recibir actualización del estado de las mesas
      socket.on('tablesUpdate', ({ tablesPlayed, currentTable, maxReached, lockReason }) => {
        if (tablesPlayed !== undefined) {
          setTablesPlayed(tablesPlayed);
        }

        if (currentTable !== undefined) {
          setCurrentTableNumber(currentTable);
        }

        setMaxTablesReached(maxReached || false);

        if (lockReason) {
          setTableLockReason(lockReason);
          // Añadir esta parte nueva - Mostrar la alerta cuando se detecte un bloqueo
          if (maxReached) {
            setShowUnlockAlert(true);
          }
        }
      });

      // Actualizar el manejo del evento boardReset
      socket.on('boardReset', ({ message, newTableNumber, newBoard, connectedPlayers }) => {
        setMessage(message);
        setTimeout(() => setMessage(''), 3000);

        // Actualizar número de mesa
        if (newTableNumber !== undefined) {
          setCurrentTableNumber(newTableNumber);
        }

        // Reiniciar completamente el tablero con el tablero nuevo
        if (newBoard) {
          setBoard(prevBoard => {
            // Crear un nuevo tablero basado en el recibido, pero sin revelar ninguna ficha
            return newBoard.map(tile => ({
              ...tile,
              revealed: false // Asegurarse de que ninguna ficha esté revelada
            }));
          });
        } else {
          // Si no se recibe un tablero nuevo, generar uno localmente
          setBoard(generateLocalBoard());
        }

        // Reiniciar selecciones por hilera
        setRowSelections([0, 0, 0, 0]);

        // Actualizar el estado de conexión de los jugadores en la lista local
        if (connectedPlayers && Array.isArray(connectedPlayers)) {
          setPlayers(prevPlayers =>
            prevPlayers.map(player => ({
              ...player,
              isConnected: connectedPlayers.includes(player.id)
            }))
          );
        }

        // Si solo hay un jugador conectado y soy yo, darme el turno directamente
        if (connectedPlayers && connectedPlayers.length === 1 && connectedPlayers[0] === parsedUser.id) {
          setIsYourTurn(true);
          setTimeLeft(6);
          setCanSelectTiles(true);
        }
      });

      // Nuevo evento para solicitud de sincronización forzada
      socket.on('forceSyncRequest', ({ userId }) => {
        console.log("Recibida solicitud de sincronización forzada");

        // Asegurarse de que es para nuestro usuario
        if (userId === parsedUser.id) {
          // Limpiar estados locales del juego
          setRowSelections([0, 0, 0, 0]);
          setCanSelectTiles(true);
          setIsScoreLocked(false);

          // Generar nuevo tablero local fresco
          const newBoard = generateLocalBoard();
          setBoard(newBoard);

          // Solicitar sincronización completa con el servidor
          socket.emit('syncGameState', { userId: parsedUser.id });
        }
      });

      // Evento para mensaje de reinicio
      socket.on('gameResetMessage', ({ message, command }) => {
        setMessage(message);

        if (command === "resetComplete") {
          // Restablecer estados locales críticos
          setCanSelectTiles(true);
          setRowSelections([0, 0, 0, 0]);
          setLocalScore(60000);
          setScore(60000);
          setIsScoreLocked(false);

          // Actualizar en sessionStorage
          try {
            const userData = sessionStorage.getItem('user');
            if (userData) {
              const userObj = JSON.parse(userData);
              userObj.score = 60000;
              userObj.isBlocked = false;
              userObj.isLockedDueToScore = false;
              sessionStorage.setItem('user', JSON.stringify(userObj));
            }
          } catch (error) {
            console.error('Error actualizando sessionStorage:', error);
          }
        }

        setTimeout(() => setMessage(''), 5000);
      });

      // Actualizar el manejador del evento gameCompletelyReset
      socket.on('gameCompletelyReset', ({ message, newBoard, status, players, rowSelections, playerSelections }) => {
        console.log("Juego completamente reiniciado");

        setBoard(newBoard || generateLocalBoard());
        setGameStatus(status || 'playing');
        setRowSelections(rowSelections || [0, 0, 0, 0]); // Usar las selecciones recibidas o reiniciar
        setCanSelectTiles(true);
        setMessage(message);

        // Actualizar el estado de conexión de los jugadores
        if (Array.isArray(players)) {
          setPlayers(prevPlayers => {
            const updatedPlayers = [...prevPlayers];

            // Actualizar el estado de conexión según la información recibida
            players.forEach(playerUpdate => {
              const index = updatedPlayers.findIndex(p => p.id === playerUpdate.id);
              if (index !== -1) {
                updatedPlayers[index] = {
                  ...updatedPlayers[index],
                  isConnected: playerUpdate.isConnected
                };
              }
            });

            return updatedPlayers;
          });
        }

        // Establecer turno para jugador único
        if (players && players.filter(p => p.isConnected).length <= 1) {
          setIsYourTurn(true);
          setTimeLeft(6);
        } else if (currentPlayer && currentPlayer.id === parsedUser.id) {
          setIsYourTurn(true);
          setTimeLeft(6);
        }

        // Actualizar información visual
        setIsScoreLocked(false);
        setUser(prev => ({ ...prev, isBlocked: false, isLockedDueToScore: false }));

        // Actualizar en sessionStorage
        try {
          const userData = sessionStorage.getItem('user');
          if (userData) {
            const userObj = JSON.parse(userData);
            userObj.isBlocked = false;
            userObj.isLockedDueToScore = false;
            userObj.score = 60000;
            sessionStorage.setItem('user', JSON.stringify(userObj));
          }
        } catch (error) {
          console.error('Error actualizando sessionStorage:', error);
        }
      });

      // Actualizar el manejador del evento forceGameStateRefresh
      socket.on('forceGameStateRefresh', (gameState) => {
        console.log("Forzando actualización de estado del juego");

        // Verificar que el estado contenga información válida
        if (gameState && gameState.board && Array.isArray(gameState.board)) {
          setBoard(gameState.board);
          setCurrentPlayer(gameState.currentPlayer);
          setPlayers(gameState.players || []);
          setGameStatus(gameState.status || 'playing');

          // Reiniciar variables críticas y permitir explícitamente jugar
          setCanSelectTiles(gameState.canSelectTiles !== undefined ? gameState.canSelectTiles : true);

          // Verificar si es mi turno
          const isCurrentUserTurn = (gameState.players && gameState.players.length <= 1) ||
            (gameState.currentPlayer && gameState.currentPlayer.id === parsedUser.id);

          setIsYourTurn(isCurrentUserTurn);

          if (isCurrentUserTurn) {
            setTimeLeft(6);
          }

          // Actualizar selecciones por hilera
          if (gameState.rowSelections) {
            setRowSelections(gameState.rowSelections);
          }
        } else {
          console.error("forceGameStateRefresh recibió datos incompletos:", gameState);
          // En caso de datos inválidos, generar un nuevo tablero local
          setBoard(generateLocalBoard());
          setCanSelectTiles(true);

          // Si es el único jugador, darle el turno
          if (players.length <= 1) {
            setIsYourTurn(true);
            setTimeLeft(6);
          }
        }
      });

      socket.on('gameState', (gameState) => {
        // Validar que gameState y sus propiedades existan
        if (!gameState) {
          console.error("gameState recibido es undefined o null");
          return;
        }

        // Establecer jugadores a un array vacío si no existe
        const gamePlayers = gameState.players || [];

        if (gamePlayers.length <= 1) {
          gameState.status = 'playing';
        }

        // Solo actualizar el tablero si existe gameState.board y es un array
        if (gameState.board && Array.isArray(gameState.board)) {
          setBoard(prev => {
            // Verificar que prev sea un array válido
            if (!Array.isArray(prev) || prev.length === 0) {
              return gameState.board;
            }

            const updatedBoard = [...prev];
            // Solo actualizar las fichas que están reveladas en el estado del juego
            for (let i = 0; i < Math.min(updatedBoard.length, gameState.board.length); i++) {
              if (gameState.board[i] && gameState.board[i].revealed) {
                updatedBoard[i] = {
                  ...updatedBoard[i],
                  revealed: true,
                  selectedBy: gameState.board[i].selectedBy,
                  value: gameState.board[i].value || updatedBoard[i].value
                };
              }
            }
            return updatedBoard;
          });
        } else {
          console.warn("gameState.board no es válido:", gameState.board);
        }

        // Verificar si ha cambiado el jugador actual
        const prevPlayerId = currentPlayer?.id;
        const newPlayerId = gameState.currentPlayer?.id;

        setCurrentPlayer(gameState.currentPlayer);
        setPlayers(gamePlayers);
        setGameStatus(gameState.status || 'playing');

        const isCurrentUserTurn = (gamePlayers.length <= 1) ||
          (gameState.currentPlayer && gameState.currentPlayer.id === parsedUser.id);

        setIsYourTurn(isCurrentUserTurn);

        if (isCurrentUserTurn) {
          setTimeLeft(6); // Cambiado a 6 segundos
          setCanSelectTiles(true);
        }

        if (gameState.rowSelections) {
          setRowSelections(gameState.rowSelections);
        }
      });

      // Evento para actualización de puntuaje
      socket.on('directScoreUpdate', (newScore) => {
        setScore(newScore);
        updateLocalScore(newScore);
      });

      socket.on('forceScoreUpdate', (newScore) => {
        setScore(newScore);
        updateLocalScore(newScore);
      });

      socket.on('scoreUpdate', (data) => {
        if (typeof data === 'object' && data.userId) {
          if (data.userId === parsedUser.id) {
            setScore(data.newScore);
            updateLocalScore(data.newScore);
          }
        } else {
          setScore(data);
          updateLocalScore(data);
        }
      });

      socket.on('tileSelected', ({ tileIndex, tileValue, playerId, newScore, rowSelections, soundType, playerUsername, timestamp, isRevealed }) => {
        // Actualizar el tablero para todos los jugadores
        setBoard(prevBoard => {
          // Verificar que prevBoard sea un array válido
          if (!Array.isArray(prevBoard) || prevBoard.length === 0) {
            return prevBoard;
          }

          const newBoard = [...prevBoard];
          if (newBoard[tileIndex]) {
            newBoard[tileIndex] = {
              ...newBoard[tileIndex],
              revealed: true,
              // Usar el valor que viene del servidor, no el local
              value: tileValue,
              lastSelected: true,
              selectedBy: playerUsername
            };
          }
          return newBoard;
        });

        setLastSelectedTile({
          index: tileIndex,
          playerId: playerId,
          playerUsername: playerUsername,
          timestamp: timestamp
        });

        // Determinar si es el jugador actual
        const isCurrentPlayer = playerId === parsedUser.id;

        // Solo reproducir sonidos y mostrar efectos si es el jugador actual
        if (isCurrentPlayer) {
          // Determinar el tipo de sonido basado en el valor real
          const isPositiveValue = tileValue > 0;
          if (isPositiveValue) {
            playSoundSafely(winSoundRef, 1.0);

            // Activar la lluvia de monedas con un nuevo ID único
            coinRainIdRef.current += 1;
            setCoinRainId(coinRainIdRef.current);
            setShowCoinRain(true);

            // Programar el fin de la animación para mantener el rendimiento
            setTimeout(() => {
              setShowCoinRain(false);
            }, 1500);
          } else {
            playSoundSafely(loseSoundRef, 1.0);
          }

          // Mostrar alerta y actualizar puntaje solo para el jugador actual
          showPointsAlert(tileValue);
          updateLocalScore(newScore);
        }

        if (rowSelections) {
          setRowSelections(rowSelections);
        }
      });

      socket.on('turnTimeout', ({ playerId }) => {
        if (playerId === parsedUser.id) {
          setTimeLeft(0);
          setCanSelectTiles(false);

          if (players.length > 1) {
            setIsYourTurn(false);
          } else {
            setIsYourTurn(true);
          }
        }
      });

      socket.on('tableLimitReached', ({ message }) => {
        setMaxTablesReached(true);
        setTableLockReason(message);
      });

      socket.on('tablesUnlocked', () => {
        setMaxTablesReached(false);
        setTableLockReason('');
        setMessage('¡Las mesas han sido desbloqueadas!');
        setTimeout(() => setMessage(''), 3000);
      });

      // Modificado: El evento blocked ya no redirecciona
      socket.on('blocked', () => {
        setMessage('Tu cuenta ha sido bloqueada por el administrador. Puedes ver el juego pero no jugar.');
      });

      socket.on('message', (newMessage) => {
        // Filtrar mensajes relacionados con tiempo agotado y turno
        if (!newMessage.includes('tiempo se agotó') && !newMessage.includes('turno')) {
          setMessage(newMessage);
          setTimeout(() => setMessage(''), 3000);
        }
      });

      socket.on('disconnect', () => {
        setIsConnected(false);
      });

      // Manejador para responder a pings del servidor (verificación de conexión)
      socket.on('ping', (data, callback) => {
        // Responder al ping para confirmar conexión
        if (callback && typeof callback === 'function') {
          callback({ status: 'active', userId: parsedUser.id });
        }
      });

      return () => {
        if (socket) {
          socket.off('connect');
          socket.off('connect_error');
          socket.off('reconnect_attempt');
          socket.off('gameState');
          socket.off('tileSelected');
          socket.off('tileSelectError');
          socket.off('turnTimeout');
          socket.off('scoreUpdate');
          socket.off('forceScoreUpdate');
          socket.off('directScoreUpdate');
          socket.off('boardReset');
          socket.off('tableLimitReached');
          socket.off('tablesUnlocked');
          socket.off('blocked');
          socket.off('message');
          socket.off('sessionClosed');
          socket.off('tablesUpdate');
          socket.off('playerConnectionChanged');
          socket.off('scoreLimitReached');
          socket.off('userUnlocked');
          socket.off('blockStatusChanged');
          socket.off('gameCompletelyReset');
          socket.off('forceGameStateRefresh');
          socket.off('forceSyncRequest');
          socket.off('gameResetMessage');
          socket.off('connectionStatusUpdate');
          socket.off('ping');
          socket.emit('saveGameState', { userId: user?.id }); // Guardar estado al salir
          socket.emit('leaveGame');
          socket.disconnect();
        }
      };
    } catch (error) {
      console.error('Error al procesar datos de usuario:', error);
      router.push('/');
    }
  }, [router]);

  // Añadir un mecanismo para detectar y solucionar problemas de interacción
  useEffect(() => {
    // Si el usuario no puede seleccionar fichas por más de 10 segundos y debería poder
    let problemDetectionTimer = null;

    if (isYourTurn && !canSelectTiles && !isScoreLocked && !user?.isBlocked && !maxTablesReached) {
      problemDetectionTimer = setTimeout(() => {
        console.log("Detectado posible problema de interacción, intentando corregir...");
        // Solicitar reinicio de selecciones por hilera
        socket.emit('resetRowSelections', { userId: user.id });
        // Solicitar verificación de estado de mesas
        socket.emit('checkTableStatus', { userId: user.id });
      }, 10000);
    }

    return () => {
      if (problemDetectionTimer) {
        clearTimeout(problemDetectionTimer);
      }
    };
  }, [isYourTurn, canSelectTiles, isScoreLocked, user, maxTablesReached]);

  // Efecto para el temporizador optimizado
  useEffect(() => {
    let timer;

    if (isYourTurn) {
      // Iniciar siempre con 6 segundos exactos
      setTimeLeft(6);
      setCanSelectTiles(true);

      // Reproducir sonido de turno siempre que sea tu turno
      // (ya sea único jugador o multijugador)
      playSoundSafely(turnSoundRef);

      // Asegurar que el intervalo sea exactamente de 1 segundo
      let previousTime = Date.now();

      timer = setInterval(() => {
        const currentTime = Date.now();
        // Ajustar el intervalo si es necesario
        const drift = currentTime - previousTime - 1000;
        previousTime = currentTime;

        setTimeLeft((prevTime) => {
          const newTime = prevTime - 1;
          console.log(`Temporizador: ${newTime} segundos (drift: ${drift}ms)`);

          if (newTime <= 0) {
            clearInterval(timer);
            setCanSelectTiles(false);
            return 0;
          }
          return newTime;
        });
      }, 1000);
    } else {
      clearInterval(timer);
    }

    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [isYourTurn]);

  // Efecto para limpiar la marca de última ficha seleccionada
  useEffect(() => {
    if (lastSelectedTile) {
      const timer = setTimeout(() => {
        setBoard(prevBoard => {
          const newBoard = [...prevBoard];
          if (newBoard[lastSelectedTile.index] && newBoard[lastSelectedTile.index].lastSelected) {
            newBoard[lastSelectedTile.index] = {
              ...newBoard[lastSelectedTile.index],
              lastSelected: false
            };
          }
          return newBoard;
        });
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [lastSelectedTile]);


  // Función para manejar clics en fichas
  const handleTileClick = useCallback((index) => {
    // No permitir seleccionar fichas si es administrador
    if (user?.isAdmin) {
      setMessage("Los administradores solo pueden observar el juego");
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    // No permitir seleccionar fichas si está bloqueado por puntaje
    if (isScoreLocked) {
      setMessage("Tu cuenta está bloqueada por alcanzar 23000 puntos. Contacta al administrador.");
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    // No permitir seleccionar fichas si el usuario está bloqueado por el administrador
    if (user?.isBlocked) {
      setMessage("Tu cuenta está bloqueada. Puedes ver el juego pero no jugar.");
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    // No permitir seleccionar fichas si se alcanzó el límite de mesas
    if (maxTablesReached) {
      setMessage(`Límite de mesas alcanzado. ${tableLockReason}`);
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    // Validar que haya un tablero válido
    if (!Array.isArray(board) || board.length === 0) {
      console.error("El tablero no es válido");
      setMessage("Error: El tablero no es válido. Recargando...");
      // Solicitar sincronización de estado para obtener un tablero válido
      if (socket && socket.connected) {
        socket.emit('syncGameState', { userId: user.id });
      }
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    // Validar que el índice sea válido
    if (index < 0 || index >= board.length) {
      console.error(`Índice de ficha inválido: ${index}`);
      return;
    }

    // Validar que la ficha existe en el tablero
    if (!board[index]) {
      console.error(`La ficha en el índice ${index} no existe`);
      return;
    }

    // Verificar si ya está revelada
    if (board[index].revealed) {
      console.log("Esta ficha ya está revelada");
      return;
    }

    if (!canSelectTiles) {
      setMessage("¡No puedes seleccionar más fichas en este turno!");
      setTimeout(() => setMessage(''), 2000);
      return;
    }

    if (!isYourTurn && players.length > 1) {
      setMessage("¡Espera tu turno!");
      setTimeout(() => setMessage(''), 2000);
      return;
    }

    if (timeLeft <= 0) {
      setMessage("¡Tiempo agotado para este turno!");
      setTimeout(() => setMessage(''), 2000);
      return;
    }

    const row = Math.floor(index / 4);

    if (rowSelections[row] >= 2) {
      setMessage(`¡Límite de 2 fichas por hilera alcanzado en hilera ${row + 1}!`);
      setTimeout(() => setMessage(''), 2000);
      return;
    }

    const tileValue = board[index]?.value || 0;
    if (!board[index]?.revealed) {
      // IMPORTANTE: Usar setState con callback para asegurar que se base en el valor actual
      setLocalScore(prevScore => {
        const newScore = prevScore + tileValue;

        // Guardar en sessionStorage de manera segura
        try {
          const userData = sessionStorage.getItem('user');
          if (userData) {
            const userObj = JSON.parse(userData);
            userObj.score = newScore;
            sessionStorage.setItem('user', JSON.stringify(userObj));
            console.log('Puntaje local actualizado en sessionStorage:', newScore);
          }
        } catch (error) {
          console.error('Error actualizando sessionStorage:', error);
        }

        return newScore;
      });

      // Actualizar el tablero localmente para feedback inmediato
      setBoard(prevBoard => {
        const newBoard = [...prevBoard];
        if (newBoard[index]) {
          newBoard[index] = {
            ...newBoard[index],
            revealed: true,
            lastSelected: true
          };
        }
        return newBoard;
      });

      // Actualizar las selecciones de hilera y verificar si se debe avanzar al siguiente tablero
      setRowSelections(prev => {
        const updated = [...prev];
        updated[row]++;

        // Verificar si se han completado las selecciones en todas las hileras
        const allRowsFull = updated.every(count => count >= 2);

        // Si todas las hileras están completas y hay un solo jugador o somos el único activo,
        // avanzar al siguiente tablero
        if (allRowsFull && (players.length <= 1 || players.filter(p => p.isConnected).length <= 1)) {
          console.log('Jugador único completó todas sus selecciones, avanzando al siguiente tablero');

          // Incrementar contador de mesas mediante socket
          socket.emit('completeBoard', { userId: user.id });
        }

        return updated;
      });
    }

    // Emisión al servidor con información completa
    socket.emit('selectTile', {
      tileIndex: index,
      currentScore: localScore // Enviar el puntaje actual para verificación
    });
  }, [board, canSelectTiles, isYourTurn, timeLeft, rowSelections, localScore, maxTablesReached, tableLockReason, socket, isScoreLocked, user, players]);

  // Esta función debe ir en la sección de funciones de tu componente
  const handleUnlockAllTables = () => {
    if (socket && socket.connected) {
      setMessage('Desbloqueando mesas para todos los jugadores...');
      socket.emit('unlockAllTables', {}, (response) => {
        if (response && response.success) {
          setMessage('Todas las mesas han sido desbloqueadas');
          setShowUnlockAlert(false);
          setMaxTablesReached(false);
          setTableLockReason('');
          setTimeout(() => setMessage(''), 3000);
        } else {
          setMessage('Error al desbloquear mesas');
          setTimeout(() => setMessage(''), 3000);
        }
      });
    }
  };

  // Memoizar el tablero para evitar re-renderizados innecesarios
  const memoizedBoard = useMemo(() => (
    Array.isArray(board) && board.length > 0 ? (
      board.map((tile, index) => (
        <Tile
          key={index}
          index={index}
          revealed={tile?.revealed || false}
          value={tile?.value || 0}
          onClick={() => handleTileClick(index)}
          disabled={
            tile?.revealed ||
            !canSelectTiles ||
            timeLeft <= 0 ||
            rowSelections[Math.floor(index / 4)] >= 2 ||
            maxTablesReached ||
            isScoreLocked ||
            user?.isBlocked ||
            user?.isAdmin
          }
          lastSelected={lastSelectedTile?.index === index}
          selectedBy={tile?.selectedBy}
          currentUsername={user?.username} // Añadido para resaltar fichas del jugador actual
        />
      ))
    ) : (
      <div className="loading-message">
        Cargando tablero...
        <button
          onClick={() => {
            if (socket) {
              socket.emit('joinGame');
            }
          }}
          className="retry-button"
        >
          Reintentar
        </button>
      </div>
    )
  ), [board, canSelectTiles, timeLeft, rowSelections, lastSelectedTile, maxTablesReached, isScoreLocked, user, handleTileClick]);

  if (!user) {
    return <div className="loading">Cargando...</div>;
  }

  return (
    <>
      {/* Componente para ocultar el logo programáticamente */}
      <HideLogoEffect />

      {/* Componente de lluvia de monedas con clave única */}
      {showCoinRain && (
        <CoinRain
          key={`coin-rain-${coinRainId}`}
          active={true}
          onComplete={handleCoinRainComplete}
        />
      )}

      {(user?.isAdmin || user?.username?.toLowerCase() === "admin") && (
        <button
          className="admin-panel-button"
          onClick={handleAdminPanel}
        >
          Panel de Admin
        </button>
      )}

      <div className="game-container game-page">
        <audio ref={winSoundRef} src="/sounds/win.mp3" preload="auto"></audio>
        <audio ref={loseSoundRef} src="/sounds/lose.mp3" preload="auto"></audio>
        <audio ref={turnSoundRef} src="/sounds/turno.mp3" preload="auto"></audio>

        {/* Restaurar las alertas de puntos, pero solo para el jugador actual */}
        {showAlert && (
          <div className={`points-alert ${alertType}`}>
            {alertMessage}
          </div>
        )}

        <div className="game-info">
          <div className="game-header">
            <h2>Jugador: {user?.username}</h2>
            <button className="logout-button" onClick={handleLogout}>
              Cerrar Sesión
            </button>
          </div>

          {isConnected ? (
            <div className="connection-status connected">Conectado al servidor</div>
          ) : (
            <div className="connection-status disconnected">Desconectado del servidor</div>
          )}
        </div>

        {/* Mesa y turno en la parte superior */}
        <div className="game-status-bar">
          <div className="table-info">
            Mesa {currentTableNumber}
          </div>
          <div className={`turn-status ${isYourTurn ? 'your-turn-indicator' : 'wait-turn-indicator'}`}>
            {isYourTurn ? "Tu turno" : "Espere su turno"}
          </div>
        </div>

        {/* Puntaje después de mesa y turno */}
        <div className="game-score">
          Puntaje: {localScore}
        </div>

        {/* Contador de tiempo antes del tablero */}
        <div className="time-display">
          Tiempo: <span className={`timer-value ${timeLeft === 0 ? 'time-up' : ''}`}>{timeLeft}</span> segundos
        </div>

        {/* Añade esto DESPUÉS del div time-display */}
        {showUnlockAlert && (
          <div className="table-lock-alert">
            <p>Por seguridad se bloqueó la mesa. Haz click en desbloquear mesa.</p>
            <button
              onClick={handleUnlockAllTables}
              className="unlock-all-tables-btn"
            >
              Desbloquear mesa
            </button>
          </div>
        )}

        

        {/* Mensajes de bloqueo */}
        {isScoreLocked && (
          <div className="score-lock-banner">
            Tu cuenta está bloqueada por alcanzar 23000 puntos. Contacta al administrador.
          </div>
        )}

        {user?.isBlocked && (
          <div className="score-lock-banner">
            Tu cuenta está bloqueada por el administrador. Puedes ver el juego pero no jugar.
          </div>
        )}

        {user?.isAdmin && (
          <div className="admin-info-banner">
            Modo administrador: Solo puedes observar el juego.
          </div>
        )}

        {message && <div className="message">{message}</div>}

        {/* Tablero de juego */}
        <div className="game-board">
          {memoizedBoard}
        </div>

        {/* Jugador actual */}
        {currentPlayer && (
          <div className="current-player">
            Jugador actual: <span className="current-player-name">{currentPlayer.username}</span>
          </div>
        )}

        {/* Lista de jugadores conectados */}
        <div className="players-section">
          <h3>Jugadores conectados</h3>
          <PlayerList players={players} currentPlayerId={currentPlayer?.id} />
        </div>

        {showAdminModal && (
          <AdminButton
            onClose={() => setShowAdminModal(false)}
            socket={socket}
          />
        )}

        {/* Botón de WhatsApp */}
        <WhatsAppButton phoneNumber="5492945552523" />
      </div>
    </>
  );
}