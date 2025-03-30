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
      const initialOutput = displayArea("MM5");
      setHistory(initialOutput.map(text => ({ text, isSecret: false })));
      hasInitialized.current = true;
    }
  }, []);

  useEffect(() => {
    if (historyEndRef.current) {
      historyEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [history]);

  // Randomly pick a line to flicker from the last 10 lines
  useEffect(() => {
    if (history.length > 0) {
      setFlickerIndex(null);
      setTimeout(() => {
        const startIndex = Math.max(0, history.length - 10);
        const eligibleLines = history.length - startIndex;
        const randomOffset = Math.floor(Math.random() * eligibleLines);
        const newFlickerIndex = startIndex + randomOffset;
        setFlickerIndex(newFlickerIndex);
      }, 0);
    }
  }, [history]);

  // Random glitch every ~10s, boosted for secrets
  useEffect(() => {
    if (history.length === 0) return;

    const glitchInterval = () => {
      const startIndex = Math.max(0, history.length - 10);
      const eligibleLines = history.length - startIndex;
      const randomOffset = Math.floor(Math.random() * eligibleLines);
      const newGlitchIndex = startIndex + randomOffset;

      // Boost glitch if the line is secret-related
      const isSecretLine = history[newGlitchIndex]?.isSecret;
      setGlitchIndex(newGlitchIndex);
      setTimeout(() => setGlitchIndex(null), isSecretLine ? 1000 : 500); // Longer for secrets

      const nextGlitchDelay = isSecretLine ? 1000000 : (5000 + Math.random() * 10000); // Faster for secrets
      return setTimeout(glitchInterval, nextGlitchDelay);
    };

    const timeoutId = glitchInterval();
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

    // Attach isSecret to each output line if the command involves a secret
    const taggedOutput = output.map(line => ({ text: line, isSecret: response.isSecret }));
    setHistory((prev) => [...prev, ...newHistory, ...taggedOutput]);
    setInput('');
  };

  return (
    <div
      className={`terminal-container scanlines relative ${
        isShaking ? 'animate-screen-glitch' : ''
      }`}
      onClick={() => inputRef.current.focus()}
    >
      <div className="terminal-history">
        {history.map((entry, index) => {
          const line = typeof entry === 'string' ? entry : entry.text;
          const isSecret = typeof entry === 'object' && entry.isSecret;
          console.log(`Line ${index}: "${line}", isSecret: ${isSecret}`);
          const isCommand = line.startsWith('> ');
          return (
            <div
              key={index}
              className={`terminal-line ${
                isCommand ? 'command-line' : ''
              } ${
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