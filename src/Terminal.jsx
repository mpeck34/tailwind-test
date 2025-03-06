import React, { useState, useEffect, useRef } from 'react';
import { handleCommand, displayArea } from './game'; 
import './Terminal.css';

function Terminal({ onQuit }) {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState([]);
  const historyEndRef = useRef(null);
  const inputRef = useRef(null);
  const [waitingForInput, setWaitingForInput] = useState(false); // Track if we're waiting for further input
  const [commandState, setCommandState] = useState(null); // To track the state of the current command

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

    if (waitingForInput) {
      // If we're waiting for user input, send the second part of the command
      const result = handleCommand(input, true); // Pass `true` to indicate we’re continuing the input
      setWaitingForInput(false); // Stop waiting for input after handling it
      setInput(''); // Clear the input field
      setHistory((prev) => [...prev, ...newHistory, ...result]); // Update the history with the response
    } else {
      // Otherwise, handle the initial command
        const response = handleCommand(input.toLowerCase());

        if (response.needsFurtherInput) {
          // If the command expects further input (e.g., `look` for an item), set waiting for input
          setWaitingForInput(true);
          setCommandState(response.command); // Track the command for further handling
        }

        // Update the history with the response
        setHistory((prev) => [...prev, ...newHistory, ...response.output]);

        // Clear input
        setInput('');
      }
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
