import React, { useState, useEffect } from 'react';
import Terminal from './Terminal';
import { displayArea } from './game'; // Import here
import './App.css';

function GameMenu() {
    const [hasContinue, setHasContinue] = useState(false);
    const [isInProgress, setIsInProgress] = useState(false);
    const [initialHistory, setInitialHistory] = useState([]); // New state for initial history

    const handleNewGame = () => {
        console.log("Starting new game...");
        const initialOutput = displayArea("MM5"); // Initialize here
        setInitialHistory(initialOutput.map(text => ({ text, isSecret: false })));
        setIsInProgress(true);
        setHasContinue(true);
    };

    const handleContinueGame = () => {
        if (hasContinue) {
            setIsInProgress(true);
            console.log("Continuing the game...");
        }
    };

    const handleQuit = () => {
        console.log("Quitting game... Returning to menu.");
        setIsInProgress(false);
        setInitialHistory([]); // Reset on quit
    };

    useEffect(() => {
        console.log('GameMenu rendered, isInProgress:', isInProgress);
    }, [isInProgress]);

    return (
        <div className="game-container">
            <div className="menu-container">
                <h1 className="title">My Awesome Game</h1>
                {!isInProgress ? (
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
                    <Terminal onQuit={handleQuit} initialHistory={initialHistory} />
                </div>
            )}
        </div>
    );
}

export default GameMenu;