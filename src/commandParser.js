// commandParser.js
import { parseItemsNpcs } from "./game";

// Expanded dictionary with synonyms and partials, covering all JSON commands
const commandDictionary = {
    "look": ["loo", "lk", "see", "view", "examine", "peek", "observe", "lok", "lo", "l", "watch", "inspect", "check", "v"],
    "talk": ["tal", "tk", "chat", "speak", "converse", "say", "ta", "spk", "tell", "speak with"],
    "inventory": ["inv", "invent", "items", "gear", "stuff", "in", "i", "bag", "list", "itm"],
    "take": ["get", "grab", "pickup", "snag", "collect", "tak", "tke", "t", "grb", "pick"],
    "go": ["move", "travel", "head", "walk", "run", "g", "mv", "go to", "wlk"],
    "push": ["shove", "nudge", "psh", "pu", "shv"],
    "pull": ["tug", "yank", "pul", "pl", "yg"],
    "hit": ["hit", "tap", "smash", "whack", "bonk"],
    "use": ["utilize", "activate", "us", "u", "act", "employ"],
    "place": ["put", "set", "pla", "pt", "drop", "lay"]
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
 * @param {Function} parseItemsNpcs - Function to list all current area interactables.
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
            commandSynonyms[key].startsWith(inputCommand)
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

// If no bestMatch but command is valid, resolve target from entities
if (!bestMatch && inputTarget && Object.values(commandSynonyms).includes(canonicalCommand)) {
    const entities = parseItemsNpcs(currentArea);
    const targetEntity = entities.find(e => {
        const entityName = e.name.toLowerCase();
        const words = entityName.split(/\s+/);
        return words.some(word => word === inputTarget.toLowerCase()) && 
               !e.state?.isHidden && !e.state?.isInvisible;
    }) || entities.find(e => 
        e.name.toLowerCase().includes(inputTarget.toLowerCase()) && 
        !e.state?.isHidden && !e.state?.isInvisible
    );
    const resolvedTarget = targetEntity ? targetEntity.name : inputTarget;
    return {
        command: canonicalCommand,
        target: inputTarget,
        bestMatch: { command: canonicalCommand, target: resolvedTarget, response: null, type: 'generic' }
    };
}

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
function findBestCommandMatch(command, inputTarget, parsedCommands, currentArea, checkCondition) {
    console.log(`Finding best match for command: "${command}", target: "${inputTarget}"`);
    
    const matchingCommands = parsedCommands.filter(c => c.command.startsWith(command));
    if (matchingCommands.length === 0) return null;
    
    // If no target, return the first valid command with no target requirement
    if (!inputTarget) {
        return matchingCommands
        .filter(c => !c.target && (!c.condition || checkCondition(c.condition, currentArea, c.target)))
        .sort((a, b) => (b.priority || 0) - (a.priority || 0))[0] || null;
    }

    const targetMatches = matchingCommands.filter(c => {
      const cmdTarget = (c.target || '').toLowerCase();
      return cmdTarget && cmdTarget.includes(inputTarget.toLowerCase());
    });
    console.log('Target matches:', targetMatches.map(m => `${m.command} (target: ${m.target})`));
    
    if (targetMatches.length === 0) return null;
    
    const exactWordMatches = targetMatches.filter(c => {
      const cmdTarget = c.target.toLowerCase();
      const words = cmdTarget.split(' ');
      const isExact = words.includes(inputTarget.toLowerCase());
      console.log(`Checking exact match for "${cmdTarget}": words=${words}, input="${inputTarget}", exact=${isExact}`);
      return isExact;
    });
    console.log('Exact word matches:', exactWordMatches.map(m => `${m.command} (target: ${m.target})`));
    
    const matchesToUse = exactWordMatches.length > 0 ? exactWordMatches : targetMatches;
    
    if (matchesToUse.length > 1) {
      console.log(`Ambiguous command "${command} ${inputTarget}" could match:`, 
        matchesToUse.map(m => `${m.command} (target: ${m.target})`));
    }
    
    const validMatches = matchesToUse
      .filter(c => !c.condition || checkCondition(c.condition, currentArea, c.target))
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));
    console.log('Valid matches after conditions:', validMatches.map(m => `${m.command} (target: ${m.target}, priority: ${m.priority || 0})`));
    
    return validMatches[0] || null;
  }
  
  export { parseCommand };
