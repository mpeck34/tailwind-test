import React, { useState, useEffect, useRef } from 'react';
import { handleCommand, displayArea } from './game'; 
import './Terminal.css';

function Terminal({ onQuit }) {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState([]);
  const historyEndRef = useRef(null);
  const inputRef = useRef(null);
  const [isShaking, setIsShaking] = useState(false);
  const [flickerIndex, setFlickerIndex] = useState(null);
  const [glitchIndex, setGlitchIndex] = useState(null);
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (!hasInitialized.current) {
      console.log('Initializing game...');
      //Initial display first area
      setHistory(displayArea("MM5"));
      hasInitialized.current = true;
    }
  }, []);

  useEffect(() => {
    if (historyEndRef.current) {
      historyEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [history]);

// Randomly pick a line to flicker from the last 10 lines whenever history updates
useEffect(() => {
  if (history.length > 0) {
    // Reset flicker first to clear previous
    setFlickerIndex(null);
    // Use a slight delay to ensure reset applies before new flicker
    setTimeout(() => {
      const startIndex = Math.max(0, history.length - 10);
      const eligibleLines = history.length - startIndex;
      const randomOffset = Math.floor(Math.random() * eligibleLines);
      const newFlickerIndex = startIndex + randomOffset;
      setFlickerIndex(newFlickerIndex);
    }, 0); // Zero delay ensures it runs after render
  }
}, [history]);

// Random glitch every ~10 seconds
useEffect(() => {
  if (history.length === 0) return;

  const glitchInterval = () => {
    const startIndex = Math.max(0, history.length - 10);
    const eligibleLines = history.length - startIndex;
    const randomOffset = Math.floor(Math.random() * eligibleLines);
    const newGlitchIndex = startIndex + randomOffset;

    setGlitchIndex(newGlitchIndex);
    setTimeout(() => setGlitchIndex(null), 500); // Glitch lasts 0.5s

    // Random delay between 5-15 seconds (avg ~10s)
    const nextGlitchDelay = 5000 + Math.random() * 10000;
    return setTimeout(glitchInterval, nextGlitchDelay);
  };

  const timeoutId = glitchInterval();
  return () => clearTimeout(timeoutId); // Cleanup on unmount or history change
}, [history]);

  const handleInputSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    // Add the player's input to history
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

    if (output.some((line) => line.toLowerCase().includes('error') || line.toLowerCase().includes('unknown'))) {
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 200);
    }

    setHistory((prev) => [...prev, ...newHistory, ...response.output]);
    setInput('');
  };

    return (
      <div className="terminal-outer-container">
        <div
          className={`terminal-container scanlines relative ${
            isShaking ? 'animate-screen-glitch' : ''
          }`}
          onClick={() => inputRef.current.focus()}
        >
          <div className="terminal-history">
          {history.map((line, index) => {
            const isCommand = line.startsWith('> ');
            return (
              <div
                key={index}
                className={`terminal-line ${
                  isCommand ? 'command-line' : ''} ${
                  index === flickerIndex
                    ? 'animate-flicker'
                    : index === glitchIndex
                    ? 'animate-glitch'
                    : line.toLowerCase().includes('secret') || line.toLowerCase().includes('hidden')
                    ? 'animate-glitch-static'
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
      </div>
    );
  }

export default Terminal;
