import React, { useState, useEffect, useRef } from 'react';
import useSound from 'use-sound';
import staticSound from './assets/audio/static-noise-several-different-ones-59881.mp3';
import musicTrack1 from './assets/audio/fantasy-medieval-ambient-237371.mp3'; /* https://www.free-stock-music.com/search.php?keyword=medieval */
import musicTrack2 from './assets/audio/medieval-ambient-236809.mp3';
import musicTrack3 from './assets/audio/medieval-citytavern-ambient-235876.mp3';
import { handleCommand } from './game';
import './Terminal.css';

function Terminal({ onQuit, initialHistory = [] }) {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState(initialHistory);
  const historyEndRef = useRef(null);
  const inputRef = useRef(null);
  const canvasRef = useRef(null);
  const [isShaking, setIsShaking] = useState(false);
  const [flickerIndex, setFlickerIndex] = useState(null);
  const [glitchIndex, setGlitchIndex] = useState(null);
  const [problemQueue, setProblemQueue] = useState([]);
  const spawnersRef = useRef([]);
  const sparksRef = useRef([]);
  const decayIntervalRef = useRef(null);
  const renderIntervalRef = useRef(null);

  // Static sound
  const [playStatic, { sound: staticAudio }] = useSound(staticSound, {
    volume: 0,
    loop: true,
  });

  // Music playlist - sequential loop
  const playlist = [musicTrack1, musicTrack2, musicTrack3];
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [playMusic, {stop: stopMusic }] = useSound(playlist[currentTrackIndex], {
    volume: 0.8,
    onend: () => {
      console.log(`Track ${currentTrackIndex + 1} ended`);
      setCurrentTrackIndex((prev) => (prev + 1) % playlist.length);
    },
  });

  // Start music with a delay and handle track switching
  useEffect(() => {
    const startMusic = () => {
      console.log(`Starting track ${currentTrackIndex + 1}: ${playlist[currentTrackIndex].split('/').pop()}`);
      playMusic();
    };

    const timer = setTimeout(startMusic, 1000);

    return () => {
      clearTimeout(timer);
      stopMusic();
      console.log('Music stopped on unmount');
    };
  }, [currentTrackIndex, playMusic, stopMusic]); // Re-run when track changes

  // Adjust static sound volume based on queue length
  useEffect(() => {
    if (!staticAudio) return; // Wait until sound is loaded

    const queueLength = problemQueue.length > 37 ? 37 : problemQueue.length;
    const maxQueue = 37;
    const volume = queueLength / maxQueue; // Scale from 0 to 1
    staticAudio.volume(volume);
    console.log('Static volume updated to:', volume, 'Queue length:', queueLength);
  }, [problemQueue.length, staticAudio]);

  // Render sparks, a visual theme when the user enters a command that doesn't work
  const renderSparks = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.log('Canvas not ready for render!');
      return;
    }
    const ctx = canvas.getContext('2d');
    const chunkSize = 4;

    if (!canvas.dataset.sized) {
      const container = canvas.parentElement;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      canvas.dataset.sized = 'true';
      console.log('Canvas sized:', canvas.width, 'x', canvas.height);
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    sparksRef.current.forEach(spark => {
      const alpha = spark.ttl / 200;
      ctx.fillStyle = `rgba(0, 255, 0, ${alpha})`;
      ctx.fillRect(spark.x, spark.y, chunkSize, chunkSize);
    });
  };

  // Update spark TTLs
  const updateSparks = () => {
    const now = performance.now();
    sparksRef.current = sparksRef.current
      .map(spark => ({
        ...spark,
        ttl: Math.max(spark.ttl - (now - spark.lastUpdate), 0),
        lastUpdate: now,
      }))
      .filter(spark => spark.ttl > 0);
    if (sparksRef.current.length > 20000) {
      sparksRef.current = sparksRef.current.slice(-20000);
      console.log('Capped sparks at 20k');
    }
    renderSparks();
  };

  // Spawn sparks randomly
  const spawnSparks = (rate, queueLength) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.log('No canvas for spawning!');
      return;
    }
    const width = canvas.width;
    const height = canvas.height;

    const newSparks = [];
    for (let i = 0; i < rate; i++) {
      const x = Math.floor(Math.random() * width / 4) * 4;
      const y = Math.floor(Math.random() * height / 4) * 4;
      newSparks.push({
        x,
        y,
        ttl: 200,
        lastUpdate: performance.now(),
        fromQueue: queueLength,
      });
    }
    sparksRef.current.push(...newSparks);
  };

  // Update spawners
  const updateSpawners = (queueLength) => {
    spawnersRef.current.forEach(spawner => clearInterval(spawner.intervalId));
    spawnersRef.current = [];

    let spawnerCount = Math.min(queueLength, 10);
    let targetRate = 0;
    for (let i = 0; i < spawnerCount; i++) {
      let rate;
      if (queueLength <= 4) {
        rate = 1;
      } else if (queueLength <= 7) {
        rate = i < queueLength - 4 ? 3 : 1;
      } else if (queueLength <= 10) {
        rate = i < queueLength - 7 ? 5 : i < queueLength - 4 ? 3 : 1;
      } else if (queueLength <= 13) {
        rate = i < queueLength - 10 ? 10 : i < queueLength - 7 ? 5 : i < queueLength - 4 ? 3 : 1;
      } else if (queueLength <= 16) {
        rate = i < queueLength - 13 ? 20 : i < queueLength - 10 ? 10 : i < queueLength - 7 ? 5 : i < queueLength - 4 ? 3 : 1;
      } else if (queueLength <= 19) {
        rate = i < queueLength - 16 ? 50 : i < queueLength - 13 ? 20 : i < queueLength - 10 ? 10 : i < queueLength - 7 ? 5 : i < queueLength - 4 ? 3 : 1;
      } else if (queueLength <= 22) {
        rate = i < queueLength - 19 ? 100 : i < queueLength - 16 ? 50 : i < queueLength - 13 ? 20 : i < queueLength - 10 ? 10 : i < queueLength - 7 ? 5 : i < queueLength - 4 ? 3 : 1;
      } else if (queueLength <= 25) {
        rate = i < queueLength - 22 ? 200 : i < queueLength - 19 ? 100 : i < queueLength - 16 ? 50 : i < queueLength - 13 ? 20 : i < queueLength - 10 ? 10 : i < queueLength - 7 ? 5 : i < queueLength - 4 ? 3 : 1;
      } else if (queueLength <= 28) {
        rate = i < queueLength - 25 ? 500 : i < queueLength - 22 ? 200 : i < queueLength - 19 ? 100 : i < queueLength - 16 ? 50 : i < queueLength - 13 ? 20 : i < queueLength - 10 ? 10 : i < queueLength - 7 ? 5 : i < queueLength - 4 ? 3 : 1;
      } else if (queueLength <= 31) {
        rate = i < queueLength - 28 ? 1000 : i < queueLength - 25 ? 500 : i < queueLength - 22 ? 200 : i < queueLength - 19 ? 100 : i < queueLength - 16 ? 50 : i < queueLength - 13 ? 20 : i < queueLength - 10 ? 10 : i < queueLength - 7 ? 5 : i < queueLength - 4 ? 3 : 1;
      } else if (queueLength <= 34) {
        rate = i < queueLength - 31 ? 2000 : i < queueLength - 28 ? 1000 : i < queueLength - 25 ? 500 : i < queueLength - 22 ? 200 : i < queueLength - 19 ? 100 : i < queueLength - 16 ? 50 : i < queueLength - 13 ? 20 : i < queueLength - 10 ? 10 : i < queueLength - 7 ? 5 : i < queueLength - 4 ? 3 : 1;
      } else if (queueLength <= 37) {
        rate = i < queueLength - 34 ? 3000 : i < queueLength - 31 ? 2000 : i < queueLength - 28 ? 1000 : i < queueLength - 25 ? 500 : i < queueLength - 22 ? 200 : i < queueLength - 19 ? 100 : i < queueLength - 16 ? 50 : i < queueLength - 13 ? 20 : i < queueLength - 10 ? 10 : i < queueLength - 7 ? 5 : i < queueLength - 4 ? 3 : 1;
      } else {
        rate = 500; // Cap at Queue 40 (won't hit this)
      }
      targetRate += rate;
      const intervalId = setInterval(() => spawnSparks(rate, queueLength), 50);
      spawnersRef.current.push({ rate, intervalId, fromQueue: queueLength });
    }
    console.log('Spawners updated - Queue:', queueLength, 'Spawners:', spawnersRef.current.length, 'Target rate:', targetRate);
  };

  // Get decay interval
  const getDecayInterval = (queueLength) => {
    if (queueLength <= 10) return 3000;
    if (queueLength <= 20) return 2250;
    if (queueLength <= 30) return 1500;
    return 1000;
  };

  // Setup static sound and sparks
  useEffect(() => {
    sparksRef.current = [];
    spawnersRef.current = [];
    renderSparks();

    updateSpawners(problemQueue.length > 37 ? 37 : problemQueue.length);

    const decayInterval = getDecayInterval(problemQueue.length);
    decayIntervalRef.current = setInterval(() => {
      setProblemQueue((prev) => {
        if (prev.length === 0) {
          console.log('Queue empty, no decay');
          return prev;
        }
        const newQueue = prev.slice(1);
        const newLength = newQueue.length > 37 ? 37 : newQueue.length;
        sparksRef.current = sparksRef.current.filter(spark => spark.fromQueue > newLength);
        console.log('Decayed to Queue:', newLength, 'Active:', sparksRef.current.length);
        return newQueue;
      });
    }, decayInterval);

    renderIntervalRef.current = setInterval(updateSparks, 50);
    playStatic();

    return () => {
      clearInterval(decayIntervalRef.current);
      clearInterval(renderIntervalRef.current);
      spawnersRef.current.forEach(spawner => clearInterval(spawner.intervalId));
      spawnersRef.current = [];
      staticAudio?.stop();
      console.log('Cleanup complete');
    };
  }, [playStatic, staticAudio]);

  // Sync spawners and decay interval with queue length
  useEffect(() => {
    const newLength = problemQueue.length > 37 ? 37 : problemQueue.length;
    updateSpawners(newLength);
    const newInterval = getDecayInterval(newLength);
    clearInterval(decayIntervalRef.current);
    decayIntervalRef.current = setInterval(() => {
      setProblemQueue((prev) => {
        if (prev.length === 0) return prev;
        const newQueue = prev.slice(1);
        const cappedLength = newQueue.length > 37 ? 37 : newQueue.length;
        sparksRef.current = sparksRef.current.filter(spark => spark.fromQueue > cappedLength);
        console.log('Decayed to Queue:', cappedLength, 'Active:', sparksRef.current.length);
        return newQueue;
      });
    }, newInterval);
    console.log('Queue updated to:', newLength, 'Decay interval:', newInterval);
  }, [problemQueue.length]);

  // Add problem
  const addProblem = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setProblemQueue((prev) => {
      if (prev.length >= 37) {
        console.log('Queue capped at 37, ignoring new problem');
        return prev; // Cap at 37
      }
      const newQueue = [...prev, Date.now()];
      console.log('Problem added, new queue length:', newQueue.length);
      return newQueue;
    });
  };

  // Scroll to bottom with debounce
  useEffect(() => {
    if (!historyEndRef.current) return;

    // Use a timeout to debounce the scroll, ensuring it happens after all updates
    const scrollTimeout = setTimeout(() => {
      historyEndRef.current.scrollIntoView({
        behavior: isShaking ? 'auto' : 'smooth', // Use 'auto' during shake to avoid jitter
      });
    }, 50); // Small delay to batch updates

    return () => clearTimeout(scrollTimeout);
  }, [history, isShaking]);

  // Sync initial history
  useEffect(() => {
    setHistory(initialHistory);
  }, [initialHistory]);

  // Flicker effect
  useEffect(() => {
    if (history.length === 0) return;
    const flickerInterval = setInterval(() => {
      const startIndex = Math.max(0, history.length - 10);
      const randomOffset = Math.floor(Math.random() * (history.length - startIndex));
      setFlickerIndex(startIndex + randomOffset);
      setTimeout(() => setFlickerIndex(null), 150);
    }, 3000 + Math.random() * 4000);
    return () => clearInterval(flickerInterval);
  }, [history]);

  // Glitch effect
  useEffect(() => {
    if (history.length === 0) return;
    const glitchInterval = setInterval(() => {
      const startIndex = Math.max(0, history.length - 10);
      const randomOffset = Math.floor(Math.random() * (history.length - startIndex));
      const newGlitchIndex = startIndex + randomOffset;
      const isSecretLine = history[newGlitchIndex]?.isSecret;
      setGlitchIndex(newGlitchIndex);
      setTimeout(() => setGlitchIndex(null), isSecretLine ? 1000 : 500);
    }, 5000 + Math.random() * 10000);
    return () => clearInterval(glitchInterval);
  }, [history]);

  const handleInputSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    let newHistory = [`> ${input}`];
    if (input.toLowerCase() === 'quit') {
      newHistory.push('Game Over');
      setHistory((prev) => [...prev, ...newHistory]);
      setInput('');
      onQuit();
      return;
    }

    const response = handleCommand(input);
    const output = Array.isArray(response.output) ? response.output : ['Something went wrong.'];
    if (response.isProblem) {
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 200);
      addProblem();
    }
    const taggedOutput = output.map(line => ({ text: line, isSecret: response.isSecret }));
    setHistory((prev) => [...prev, ...newHistory, ...taggedOutput]);
    setInput('');
  };

  return (
    <div
      className={`terminal-container scanlines relative ${isShaking ? 'animate-screen-glitch' : ''}`}
      onClick={() => inputRef.current.focus()}
    >
      <canvas
        ref={canvasRef}
        className="static-overlay"
        style={{ opacity: sparksRef.current.length > 0 ? 1 : 0 }}
      />
      <div className="terminal-history">
        {history.map((entry, index) => {
          const line = typeof entry === 'string' ? entry : entry.text;
          const isSecret = typeof entry === 'object' && entry.isSecret;
          const isCommand = line.startsWith('> ');
          return (
            <div
              key={`${index}-${line}`}
              className={`terminal-line ${isCommand ? 'command-line' : ''} ${
                index === flickerIndex
                  ? 'animate-flicker'
                  : index === glitchIndex
                  ? 'animate-glitch'
                  : isSecret
                  ? 'animate-fuzz'
                  : ''
              }`}
            >
              {line}
            </div>
          );
        })}
        <div ref={historyEndRef} />
      </div>

      <form className="terminal-input" onSubmit={handleInputSubmit}>
        <span className="prompt">{'>'}</span>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoFocus
          className="terminal-text-input"
          ref={inputRef}
        />
      </form>
    </div>
  );
}

export default Terminal;