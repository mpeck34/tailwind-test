import React, { useState, useEffect, useRef } from 'react';
import { handleCommand, displayArea } from './game'; 
import './Terminal.css';

function Terminal({ onQuit }) {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState([]);
  const historyEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    // Display the starting area when the game loads
    setHistory(displayArea(1));
  }, []);

  useEffect(() => {
    if (historyEndRef.current) {
      historyEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [history]);

  const handleInputSubmit = (e) => {
    e.preventDefault();
    
    // Add the player's input to history
    let newHistory = [`> ${input}`];

    if (input.toLowerCase() === 'quit') {
      newHistory.push('Game Over');
      setHistory((prev) => [...prev, ...newHistory]);
      setInput('');
      onQuit();
      return;
    }

    // Process the command in the game logic
    const response = handleCommand(input.toLowerCase());

    // Update the history with the response
    setHistory((prev) => [...prev, ...newHistory, ...response]);

    // Clear input
    setInput('');
  };

  return (
    <div className="terminal-container" onClick={() => inputRef.current.focus()}>
      <div className="terminal-history">
        {history.map((line, index) => (
          <div key={index} className="terminal-line">{line}</div>
        ))}
        <div ref={historyEndRef} />
      </div>

      <form className="terminal-input" onSubmit={handleInputSubmit}>
        <span className="prompt">{'>'} </span>
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
