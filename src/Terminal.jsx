import React, { useState, useEffect, useRef } from 'react';
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

  // Render sparks
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
    // console.log('Rendered:', sparksRef.current.length, 'sparks'); // Disabled for now
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
    // console.log('Spawned:', newSparks.length, 'Total active:', sparksRef.current.length);
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
    if (queueLength <= 10) return 7000;
    if (queueLength <= 20) return 5000;
    if (queueLength <= 30) return 2000;
    return 1000;
  };

  // Setup and cleanup
  useEffect(() => {
    sparksRef.current = [];
    spawnersRef.current = [];
    renderSparks();

    updateSpawners(problemQueue.length > 37 ? 37 : problemQueue.length); // Cap at 37

    const decayInterval = getDecayInterval(problemQueue.length);
    decayIntervalRef.current = setInterval(() => {
      setProblemQueue((prev) => {
        if (prev.length === 0) {
          console.log('Queue empty, no decay');
          return prev;
        }
        const newQueue = prev.slice(1);
        const newLength = newQueue.length > 37 ? 37 : newQueue.length; // Cap at 37
        sparksRef.current = sparksRef.current.filter(spark => spark.fromQueue > newLength);
        console.log('Decayed to Queue:', newLength, 'Active:', sparksRef.current.length);
        return newQueue;
      });
    }, decayInterval);

    renderIntervalRef.current = setInterval(updateSparks, 50);

    return () => {
      clearInterval(decayIntervalRef.current);
      clearInterval(renderIntervalRef.current);
      spawnersRef.current.forEach(spawner => clearInterval(spawner.intervalId));
      spawnersRef.current = [];
      console.log('Cleanup complete');
    };
  }, []);

  // Sync spawners and decay interval with queue length
  useEffect(() => {
    const newLength = problemQueue.length > 37 ? 37 : problemQueue.length; // Cap at 37
    updateSpawners(newLength);
    const newInterval = getDecayInterval(newLength);
    clearInterval(decayIntervalRef.current);
    decayIntervalRef.current = setInterval(() => {
      setProblemQueue((prev) => {
        if (prev.length === 0) return prev;
        const newQueue = prev.slice(1);
        const cappedLength = newQueue.length > 37 ? 37 : newQueue.length; // Cap at 37
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

  // Scroll to bottom
  useEffect(() => {
    if (historyEndRef.current) {
      historyEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [history]);

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