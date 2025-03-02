import React, { useState } from 'react';
import Terminal from './Terminal';
import './App.css';
import './Terminal.css';

function GameMenu() {
    const [hasSavedGame, setHasSavedGame] = useState(false);
    const [isNewGame, setIsNewGame] = useState(false);

    const handleNewGame = () => {
        setIsNewGame(true);
        setHasGameStarted(true);
    };

    const handleContinueGame = () => {
        setIsNewGame(true); // Just resume the game
      };

    const handleQuit = () => {
        console.log("Quitting game... Returning to menu.");
        setIsNewGame(false); // Hide terminal and return to menu
      };

    return (
        <div className="game-container">
            <div className="menu-container">
                <h1 className="title">My Awesome Game</h1>
                {!isNewGame ? (
                    <div className="menu-items">
                        <button className="menu-button" onClick={handleNewGame}>New Game</button>
                        <button className="menu-button" onClick={handleContinueGame} disabled={!hasGameStarted}>
                            Continue Game
                        </button>
                        <button className="menu-button" onClick={() => alert("Opening options")}>Options</button>
                        <button className="menu-button" onClick={() => alert("Exiting game")}>Exit Game</button>
                    </div>
                ) : null}
            </div>
            
            {isNewGame && (
                <div className="terminal-outer-container">
                    <Terminal onQuit={handleQuit} />
                </div>
            )}
        </div>
    );
}

export default GameMenu;
