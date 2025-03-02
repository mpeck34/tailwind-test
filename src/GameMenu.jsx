import React, { useState } from 'react';
import Terminal from './Terminal';
import './App.css';
import './Terminal.css';

function GameMenu() {
    const [hasContinue, setHasContinue] = useState(false);
    const [isInProgress, setIsInProgress] = useState(false);

    const handleNewGame = () => {
        setIsInProgress(true);
        setHasContinue(true); // Now a new game means the game can be continued
    };

    const handleContinueGame = () => {
        if (hasContinue) {
            setIsInProgress(true); // Game is in progress, continue
            console.log("Continuing the game...");
        }
    };

    const handleQuit = () => {
        console.log("Quitting game... Returning to menu.");
        setIsInProgress(false); // Hide terminal and return to menu
        // Optionally you can add logic for saving the game here
    };

    return (
        <div className="game-container">
            <div className="menu-container">
                <h1 className="title">My Awesome Game</h1>
                {!isInProgress ? (  // Show menu only when game isn't in progress
                    <div className="menu-items">
                        <button className="menu-button" onClick={handleNewGame}>New Game</button>
                        <button className="menu-button" onClick={handleContinueGame} disabled={!hasContinue}>
                            Continue Game
                        </button>
                        <button className="menu-button" onClick={() => alert("Opening options")}>Options</button>
                        <button className="menu-button" onClick={() => alert("Exiting game")}>Exit Game</button>
                    </div>
                ) : null}
            </div>

            {isInProgress && (
                <div className="terminal-outer-container">
                    <Terminal onQuit={handleQuit} />
                </div>
            )}
        </div>
    );
}

export default GameMenu;
