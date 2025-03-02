import React, { useState, useEffect, useRef } from 'react';
import './Terminal.css'; // Assuming you will add styling here

function Terminal() {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState([]);

  // Create a ref to the terminal history container
  const historyEndRef = useRef(null);

  // Scroll to the bottom of the history container when new content is added
  useEffect(() => {
    if (historyEndRef.current) {
      historyEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [history]);

  // Function to handle input submission
  const handleInputSubmit = (e) => {
    e.preventDefault();
    
    // Add the input to the history
    setHistory(prev => [...prev, `> ${input}`]);

    // Example: Handle specific commands here
    if (input === 'look') {
      setHistory((prev) => [...prev, 'You see a vast, endless landscape.']);
    } else if (input === 'help') {
      setHistory((prev) => [...prev, 'Commands: look, help, quit']);
    } else if (input === 'quit') {
      setHistory((prev) => [...prev, 'Game Over']);
    } else {
      setHistory((prev) => [...prev, `Unknown command: ${input}`]);
    }

    // Reset input field
    setInput('');
  };

  return (
    <div className="terminal-container">
      {/* Displaying the text history */}
      <div className="terminal-history">
        {history.map((line, index) => (
          <div key={index} className="terminal-line">{line}</div>
        ))}
      </div>

      {/* Input field */}
      <form className="terminal-input" onSubmit={handleInputSubmit}>
        <span className="prompt">{'>'} </span>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoFocus
          className="terminal-text-input"
        />
      </form>
    </div>
  );
}

export default Terminal;
