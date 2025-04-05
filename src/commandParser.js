// commandParser.js

import { getInventory, parseItemsNpcs } from "./game.js";

// Expanded dictionary with synonyms and partials, covering all JSON commands
const commandDictionary = {
    "look": ["loo", "lk", "see", "view", "examine", "peek", "observe", "lok", "lo", "l", "watch", "inspect", "check", "v"],
    "talk": ["tal", "tk", "chat", "speak", "converse", "say", "ta", "spk", "tell", "speak with"],
    "inventory": ["inv", "invent", "items", "gear", "stuff", "in", "i", "bag", "list", "itm"],
    "take": ["get", "grab", "pickup", "snag", "collect", "tak", "tke", "t", "grb", "pick"],
    "go": ["move", "travel", "head", "walk", "run", "g", "mv", "go to", "wlk"],
    "push": ["shove", "nudge", "psh", "pu", "shv", "press", "pres"],
    "pull": ["tug", "yank", "pul", "pl", "yg"],
    "hit": ["hit", "tap", "smash", "whack", "bonk"],
    "use": ["utilize", "activate", "us", "u", "act", "employ", "utilise"],
    "place": ["put", "set", "pla", "pt", "drop", "lay", "give"],
    "light": ["ignite", "kindle", "burn", "blaze"]
};

// Generate commandSynonyms from commandDictionary
const commandSynonyms = {};
Object.entries(commandDictionary).forEach(([command, synonyms]) => {
    commandSynonyms[command] = command;
    synonyms.forEach(syn => {
        commandSynonyms[syn] = command;
    });
});

const prepositions = ['at', 'to', 'in', 'on', 'with', 'from', 'by', 'into', 'onto', 'of'];
const MIN_COMMAND_LENGTH = 2;

/**
 * Parses an input string into a canonical command and target.
 * @param {string} input - The raw user input (e.g., "inv gold", "take coin").
 * @param {Array} parsedCommands - List of available commands from parseCommands().
 * @param {Object} currentArea - The current area object for condition checking.
 * @param {Function} checkCondition - Function to evaluate command conditions.
 * @returns {Object} - { command: string|null, target: string|null, bestMatch: Object|null }
 */
// commandParser.js

// ... imports, commandDictionary, commandSynonyms, prepositions, MIN_COMMAND_LENGTH unchanged ...

function parseCommand(input, parsedCommands, currentArea, checkCondition) {
  const trimmedInput = input.toLowerCase().trim();
  if (!trimmedInput) return { command: null, target: null, bestMatch: null };

  // Split and filter out prepositions
  const parts = trimmedInput.split(' ').filter(part => !prepositions.includes(part));
  const inputCommand = parts[0];
  let inputTarget = parts.slice(1).join(' ').trim() || null;

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

  // Resolve target against inventory and area entities
  let resolvedTarget = null;
  if (inputTarget) {
      const inventory = getInventory();
      const areaEntities = parseItemsNpcs(currentArea);

      // For "place", "use", "light", extract the item name from inputTarget
      let itemTarget = inputTarget.split(' ')[0]; // Take first word as item (e.g., "staff" from "staff in stump")
      if (["place", "use", "light"].includes(canonicalCommand)) {
          const invItem = inventory.find(i => 
              i.name.toLowerCase().includes(itemTarget.toLowerCase()) &&
              i.itemState?.inInventory && 
              !i.itemState?.isHidden && 
              !i.itemState?.isInvisible
          );
          if (invItem) {
              resolvedTarget = invItem.name; // e.g., "Wooden Staff"
          }
      }

      // Fallback to area entities if no inventory match or not a held-item command
      if (!resolvedTarget && !["place", "use", "light"].includes(canonicalCommand)) {
          const targetEntity = areaEntities.find(e => {
              const entityName = e.name.toLowerCase();
              const words = entityName.split(/\s+/);
              return words.some(word => word === inputTarget.toLowerCase()) && 
                     !e.state?.isHidden && !e.state?.isInvisible;
          }) || areaEntities.find(e => 
              e.name.toLowerCase().includes(inputTarget.toLowerCase()) && 
              !e.state?.isHidden && !e.state?.isInvisible
          );
          if (targetEntity) {
              resolvedTarget = targetEntity.name;
          }
      }

      // Special case: "inventory" command with target (e.g., "inv coin")
      if (canonicalCommand === "inventory") {
          const invItem = inventory.find(i => 
              i.name.toLowerCase().includes(inputTarget.toLowerCase()) &&
              i.itemState?.inInventory
          );
          if (invItem) {
              resolvedTarget = invItem.name;
          }
      }

      // If no resolved target, use inputTarget as fallback
      if (!resolvedTarget) {
          resolvedTarget = inputTarget;
      }
  }

  const bestMatch = findBestCommandMatch(canonicalCommand, resolvedTarget, parsedCommands, currentArea, checkCondition);

  // Fallback for generic responses if no exact match
  if (!bestMatch && inputTarget && Object.values(commandSynonyms).includes(canonicalCommand)) {
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

function findBestCommandMatch(command, resolvedTarget, parsedCommands, currentArea, checkCondition) {
  console.log(`Finding best match for command: "${command}", target: "${resolvedTarget}"`);
  
  const matchingCommands = parsedCommands.filter(c => c.command.startsWith(command));
  if (matchingCommands.length === 0) return null;
  
  if (!resolvedTarget) {
      return matchingCommands
          .filter(c => !c.target && (!c.condition || checkCondition(c.condition, currentArea, c.target)))
          .sort((a, b) => (b.priority || 0) - (a.priority || 0))[0] || null;
  }

  const targetMatches = matchingCommands.filter(c => {
      if (!c.target) return false;
      const cmdTarget = c.target.toLowerCase();
      const cmdWords = c.command.toLowerCase().split(' ');

      // Exact full command match (e.g., "place staff")
      if (c.command === `${command} ${resolvedTarget.toLowerCase()}`) return true;
      
      // Partial command match (e.g., "use figurine" matches "use wooden figurine")
      if (cmdWords[0] === command && cmdTarget.includes(resolvedTarget.toLowerCase())) return true;

      // Fallback: input target matches command target partially
      return cmdTarget.includes(resolvedTarget.toLowerCase());
  });
  console.log('Target matches:', targetMatches.map(m => `${m.command} (target: ${m.target})`));
  
  if (targetMatches.length === 0) return null;
  
  // Prioritize: 1. Exact command, 2. Partial command with target match, 3. Any target match
  const exactCommandMatches = targetMatches.filter(c => 
      c.command === `${command} ${resolvedTarget.toLowerCase()}`
  );
  const partialCommandMatches = targetMatches.filter(c => 
      c.command.split(' ')[0] === command && c.target.toLowerCase().includes(resolvedTarget.toLowerCase())
  );
  const matchesToUse = exactCommandMatches.length > 0 
      ? exactCommandMatches 
      : (partialCommandMatches.length > 0 ? partialCommandMatches : targetMatches);
  
  const validMatches = matchesToUse
      .filter(c => !c.condition || checkCondition(c.condition, currentArea, c.target))
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));
  console.log('Valid matches after conditions:', validMatches.map(m => `${m.command} (target: ${m.target}, priority: ${m.priority || 0})`));
  
  return validMatches[0] || null;
}

export { parseCommand };