import React, { useState, useEffect, useRef } from 'react';
import { handleCommand } from './game';
import './Terminal.css';

function Terminal({ onQuit, initialHistory = [] }) {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState(initialHistory);
  const historyEndRef = useRef(null);
  const inputRef = useRef(null);
  const [isShaking, setIsShaking] = useState(false);
  const [flickerIndex, setFlickerIndex] = useState(null);
  const [glitchIndex, setGlitchIndex] = useState(null);

  useEffect(() => {
    console.log('Terminal mounted, instance:', Date.now());
    return () => console.log('Terminal unmounted');
  }, []);

  useEffect(() => {
    setHistory(initialHistory);
  }, [initialHistory]);

  useEffect(() => {
    if (historyEndRef.current) {
      historyEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [history]);

  useEffect(() => {
    if (history.length === 0) return;
    const timer = setTimeout(() => {
      const startIndex = Math.max(0, history.length - 10);
      const randomOffset = Math.floor(Math.random() * (history.length - startIndex));
      setFlickerIndex(startIndex + randomOffset);
    }, 100);
    return () => clearTimeout(timer);
  }, [history]);

  useEffect(() => {
    if (history.length === 0) return;
    let timeoutId;
    const glitchInterval = () => {
      const startIndex = Math.max(0, history.length - 10);
      const randomOffset = Math.floor(Math.random() * (history.length - startIndex));
      const newGlitchIndex = startIndex + randomOffset;
      const isSecretLine = history[newGlitchIndex]?.isSecret;
      setGlitchIndex(newGlitchIndex);
      setTimeout(() => setGlitchIndex(null), isSecretLine ? 1000 : 500);
      timeoutId = setTimeout(glitchInterval, isSecretLine ? 1000000 : (5000 + Math.random() * 10000));
    };
    timeoutId = setTimeout(glitchInterval, 5000);
    return () => clearTimeout(timeoutId);
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
    if (output.some(line => line.toLowerCase().includes('error') || line.toLowerCase().includes('unknown'))) {
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 200);
    }
    const taggedOutput = output.map(line => ({ text: line, isSecret: response.isSecret }));
    setHistory((prev) => [...prev, ...newHistory, ...taggedOutput]);
    setInput('');
  };

  useEffect(() => {
    console.log('DOM .terminal-history count:', document.querySelectorAll('.terminal-history').length);
  }, [history]);

  console.log('Terminal rendering, history length:', history.length);

  return (
    <>
      <div className={`terminal-container scanlines relative ${isShaking ? 'animate-screen-glitch' : ''}`} onClick={() => inputRef.current.focus()}>
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          {/* Define the radial gradient (same as before) */}
          <radialGradient id="displacementGradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgb(255, 255, 255)" />
            <stop offset="100%" stopColor="rgb(128, 128, 128)" />
          </radialGradient>

          {/* The filter */}
          <filter id="barrel-distort" x="-20%" y="-20%" width="140%" height="140%">
            {/* Use the radial gradient as the displacement map */}
            <feImage xlinkHref="#displacementGradient" result="displacementMap" width="100%" height="100%"/>
            <feDisplacementMap
              in="SourceGraphic"
              in2="displacementMap"
              scale="0"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>
        <div className="terminal-history">
          {history.map((entry, index) => {
            const line = typeof entry === 'string' ? entry : entry.text;
            const isSecret = typeof entry === 'object' && entry.isSecret;
            console.log(`Line ${index}: "${line}", isSecret: ${isSecret}`);
            const isCommand = line.startsWith('> ');
            return (
              <div
                key={`${index}-${line}`}
                className={`terminal-line ${isCommand ? 'command-line' : ''} ${
                  index === flickerIndex ? 'animate-flicker' : index === glitchIndex ? 'animate-glitch' : isSecret ? 'animate-fuzz' : ''
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
    </>
  );
}

export default Terminal;