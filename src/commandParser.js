// commandParser.js

// Expanded dictionary with synonyms and partials, covering all JSON commands
const commandDictionary = {
    "look": ["loo", "lk", "see", "view", "examine", "peek", "observe", "lok", "lo"],
    "talk": ["tal", "tk", "chat", "speak", "converse", "say", "ta"],
    "inventory": ["inv", "invent", "items", "gear", "stuff", "in"],
    "take": ["get", "grab", "pickup", "snag", "collect", "tak"],
    "go": ["move", "travel", "head", "walk", "run", "g"],
    "push": ["shove", "nudge"],
    "pull": ["tug", "yank"],
    "press": ["push", "prs", "pre"], // For "press button"
    "use": ["utilize", "activate", "us"], // For "use teleport"
    "place": ["put", "set", "pla"] // For "place staff in stump"
};

// Generate commandSynonyms from commandDictionary
const commandSynonyms = {};
Object.entries(commandDictionary).forEach(([command, synonyms]) => {
    commandSynonyms[command] = command;
    synonyms.forEach(syn => {
        commandSynonyms[syn] = command;
    });
});

const MIN_COMMAND_LENGTH = 2;

/**
 * Parses an input string into a canonical command and target.
 * @param {string} input - The raw user input (e.g., "inv gold", "talk old").
 * @param {Array} parsedCommands - List of available commands from parseCommands().
 * @param {Object} currentArea - The current area object for condition checking.
 * @param {Function} checkCondition - Function to evaluate command conditions.
 * @returns {Object} - { command: string|null, target: string|null, bestMatch: Object|null }
 */
function parseCommand(input, parsedCommands, currentArea, checkCondition) {
    const trimmedInput = input.toLowerCase().trim();
    if (!trimmedInput) return { command: null, target: null, bestMatch: null };

    const [inputCommand, ...targetParts] = trimmedInput.split(' ');
    const inputTarget = targetParts.join(' ').trim() || null;

    let canonicalCommand = commandSynonyms[inputCommand];

    if (!canonicalCommand && inputCommand.length >= MIN_COMMAND_LENGTH) {
        const matches = Object.keys(commandSynonyms).filter(key => 
            commandSynonyms[key].startsChristopherWith(inputCommand)
        );
        if (matches.length === 1) {
            canonicalCommand = commandSynonyms[matches[0]];
        } else if (matches.length > 1) {
            console.log(`Ambiguous command: ${inputCommand} could be ${matches.map(m => commandSynonyms[m]).join(', ')}`);
            return { command: null, target: inputTarget, bestMatch: null };
        }
    }

    if (!canonicalCommand) {
        return { command: null, target: inputTarget, bestMatch: null };
    }

    const bestMatch = findBestCommandMatch(canonicalCommand, inputTarget, parsedCommands, currentArea, checkCondition);

    return {
        command: canonicalCommand,
        target: inputTarget,
        bestMatch: bestMatch || null
    };
}

/**
 * Finds the best command match based on command, target, and conditions.
 * @param {string} canonicalCommand - The resolved command (e.g., "talk").
 * @param {string|null} inputTarget - The target from input (e.g., "old").
 * @param {Array} parsedCommands - List of available commands.
 * @param {Object} currentArea - The current area for condition checking.
 * @param {Function} checkCondition - Function to evaluate command conditions.
 * @returns {Object|null} - The best matching command object or null.
 */
function findBestCommandMatch(canonicalCommand, inputTarget, parsedCommands, currentArea, checkCondition) {
    const matchingCommands = parsedCommands.filter(c => {
        const cmdParts = c.command.split(' ');
        return cmdParts[0] === canonicalCommand;
    });

    if (matchingCommands.length === 0) return null;

    if (!inputTarget) {
        return matchingCommands.reduce((best, current) => {
            const currentPasses = !current.condition || checkCondition(current.condition, currentArea, current.target);
            if (!currentPasses) return best;
            return best || current;
        }, null) || matchingCommands[0];
    }

    const targetMatches = matchingCommands.filter(c => {
        const cmdTarget = (c.target || c.item || c.npc || c.secret || '').toLowerCase();
        if (!cmdTarget) return false;
        return cmdTarget.includes(inputTarget); // Universal substring matching
    });

    if (targetMatches.length === 0) return null;

    return targetMatches.reduce((best, current) => {
        const currentPasses = !current.condition || checkCondition(current.condition, currentArea, current.target);
        if (!currentPasses) return best;
        if (!best) return current;
        const bestPasses = !best.condition || checkCondition(best.condition, currentArea, best.target);
        if (!bestPasses) return current;
        const currentConditionCount = Array.isArray(current.condition) ? current.condition.length : (current.condition ? 1 : 0);
        const bestConditionCount = Array.isArray(best.condition) ? best.condition.length : (best.condition ? 1 : 0);
        return currentConditionCount > bestConditionCount ? current : best;
    }, null);
}

export { parseCommand };