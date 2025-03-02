import React, { useState } from 'react';
import Terminal from './Terminal';
import './App.css';
import './Terminal.css';

function GameMenu() {
    const [hasSavedGame, setHasSavedGame] = useState(false);
    const [isNewGame, setIsNewGame] = useState(false);

    const startNewGame = () => {
        setIsNewGame(true);
    };

    return (
        <div className="game-container">
            <div className="menu-container">
                <h1 className="title">My Awesome Game</h1>
                {!isNewGame ? (
                    <div className="menu-items">
                        <button className="menu-button" onClick={startNewGame}>New Game</button>
                        <button
                            className="menu-button"
                            disabled={!hasSavedGame}
                            style={{ backgroundColor: !hasSavedGame ? '#ccc' : '#4CAF50' }}
                            onClick={() => hasSavedGame ? alert("Continuing game") : null}
                        >
                            Continue Game
                        </button>
                        <button className="menu-button" onClick={() => alert("Opening options")}>Options</button>
                        <button className="menu-button" onClick={() => alert("Exiting game")}>Exit Game</button>
                    </div>
                ) : null}
            </div>
            
            {isNewGame && (
                <div className="terminal-outer-container">
                    <Terminal />  {/* Render Terminal when new game is started */}
                </div>
            )}
        </div>
    );
}

export default GameMenu;
