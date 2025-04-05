import gameData from './data/gameData.json';
import inventoryData from './data/inventoryData.json';
import inventoryDescriptions from './data/inventoryDescriptions.json';
import { parseCommand } from './commandParser.js';

const invDescriptions = inventoryDescriptions.invDescriptions;
const playerData = gameData.playerData;
const areaData = gameData.areas;
const inventory = [...inventoryData.inventory];

// Display whole area with visible things
function displayArea(areaId) {
  const area = areaData.find(area => area.areaId === areaId);
  if (!area) return ['Area not found.'];

  const output = [area.description];

  // Environmental additives
  if (area.environment?.additives) {
    area.environment.additives.forEach(additive => {
      if (!additive.condition || checkCondition(additive.condition, area)) {
        output.push(additive.text);
      }
    });
  }

  // Items, NPCs, and secrets
  const parsedEntities = parseItemsNpcs(area); // Updated to handle inventory items
  if (parsedEntities.length > 0) {
    output.push("You also see:");
    const entityGroups = parsedEntities.reduce((acc, entity) => {
      acc[entity.name] = acc[entity.name] || [];
      acc[entity.name].push(entity);
      return acc;
    }, {});

    for (const name in entityGroups) {
      const entity = entityGroups[name][0]; // First entity per name
      if (entity.state?.isHidden || entity.state?.isInvisible || entity.type === "secret") {
        console.log(`Skipped ${entity.name} (${entity.type === "secret" ? 'secret' : (entity.state?.isHidden ? 'hidden' : 'invisible')})`);
        continue;
      }

      let fullResponse = `${entity.description}`;
      if (entity.interactions) {
        entity.interactions.forEach(inter => {
          if (!inter.condition || checkCondition(inter.condition, area, entity.name)) {
            fullResponse += ` ${inter.text}`;
          }
        });
      }
      output.push(fullResponse);
    }
  }

  console.log(output.join('\n'));
  return output;
}

// Check if a condition is true or false
function checkCondition(condition, currentArea, itemName = undefined) {
  // Default to true
  if (!condition) return true;

  // If condition is an array, ensure all conditions pass (AND logic)
  if (Array.isArray(condition)) {
    return condition.every(subCondition => checkCondition(subCondition, currentArea, itemName));
  }

  // Handle different condition types
  if (condition.type === 'areaState') {
    const value = currentArea?.areaState?.[condition.key];
    // Special case for visibility: default to false (visible) if undefined
    if (condition.key === 'isHidden' || condition.key === 'isInvisible') {
      return (value ?? false) === condition.value;
    }
    // General case: default to false if undefined
    return (value ?? false) === condition.value;
  }
  if (condition.type === 'hasItem') {
    const hasItem = inventory?.some(i => 
      i.name === condition.item && i.itemState?.inInventory === true
    ) ?? false;
    console.log(`Checking if player has "${condition.item}" in inventory: ${hasItem}`);
    console.log(`Full inventory state:`, inventory);
    return hasItem;
  }
  if (condition.type === 'doesNotHaveItem') {
    // eslint-disable-next-line no-constant-binary-expression
    const doesNotHaveItem = !(inventory?.some(i => 
      i.name === condition.item && i.itemState?.inInventory === true)) ?? false;
    console.log(`Checking if player does not have "${condition.item}" in inventory: ${doesNotHaveItem}`);
    return doesNotHaveItem;
  }
  if (condition.type === 'playerState') {
    // Check playerState sub-object first
    let value = playerData?.playerState?.[condition.key];
    if (value === undefined) {
      // Fall back to top-level playerData if not found in playerState (currentArea)
      value = playerData?.[condition.key] ?? false;
    }
    console.log(`Checking playerState: ${condition.key}=${condition.value}, actual=${value}`);
    return value === condition.value;
  }
  if (condition.type === 'npcState') {
    const npc = currentArea?.npcs?.find(n => n.name === condition.npc);
    const value = npc?.npcState?.[condition.key] ?? false;
    return value === condition.value;
  }
  if (condition.type === 'itemState') {
    // Check inventory first
    let item = inventory.find(i => i.name === itemName);
    if (item) {
      const value = item.itemState?.[condition.key] ?? false;
      console.log(`Checking itemState for inventory item ${itemName}: ${condition.key}=${condition.value}, actual=${value}`);
      return value === condition.value;
    }
    // If not in inventory, check area items
    item = currentArea?.items?.find(i => i.name === itemName);
    const value = item?.itemState?.[condition.key] ?? false;
    console.log(`Checking itemState for area item ${itemName}: ${condition.key}=${condition.value}, actual=${value}`);
    if (!item) {
      console.warn(`Item ${itemName} not found in inventory or area ${currentArea?.areaId} for condition check`);
    }
    return value === condition.value;
  }
  if (condition.type === 'secretState') {
    const secret = currentArea?.secrets?.find(s => s.name === itemName);
    const value = secret?.secretState?.[condition.key] ?? false;
    return value === condition.value;
  }
  if (condition.type === 'exitState') {
    const exit = currentArea?.exits?.find(e => e.command === condition.command);
    if (!exit) {
      console.warn(`Exit command "${condition.command}" not found in area ${currentArea?.areaId}`);
      return false; // Default to inaccessible if not found
    }
    const value = exit.exitState?.[condition.key] ?? true; // Default to passable if undefined
    console.log(`Checking exitState for ${exit.direction}: ${condition.key}=${condition.value}, actual=${value}`);
    return value === condition.value;
  }

  // If an unknown condition type is given, assume it's not applicable (false)
  return false;
}

// Create an array of interactable items, npcs, and secrets to be accessed after the
// available commands (parseCommands) have been checked.
function parseItemsNpcs(currentArea) {
  let parsedItemsNpcs = [];

  // Items
  inventory.forEach(item => {
    if (currentArea.itemNames.includes(item.name)) {
      const isHidden = item.itemState?.isHidden ?? false;
      const isInvisible = item.itemState?.isInvisible ?? false;
      const inInventory = item.itemState?.inInventory ?? false;
      const isRemoved = item.itemState?.isRemoved ?? false;

      if (!isHidden && !isInvisible && !inInventory && !isRemoved) {
        parsedItemsNpcs.push({
          type: 'item',
          name: item.name,
          description: item.description,
          state: item.itemState,
          interactions: item.interactions || []
        });
      } else {
        console.log(`Skipped item ${item.name} (${isHidden ? 'hidden' : ''}${isInvisible ? 'invisible' : ''}${inInventory ? 'in inventory' : ''}${isRemoved ? 'removed' : ''})`);
      }
    }
  });

  // NPCs
  currentArea.npcs?.forEach(npc => {
    const isHidden = npc.npcState?.isHidden ?? false;
    const isInvisible = npc.npcState?.isInvisible ?? false;
    if (!isHidden && !isInvisible) {
      parsedItemsNpcs.push({
        type: 'npc',
        name: npc.name,
        description: npc.description,
        state: npc.npcState,
        interactions: npc.interactions || []
      });
    } else {
      console.log(`Skipped NPC ${npc.name} (${isHidden ? 'hidden' : ''}${isInvisible ? 'invisible' : ''})`);
    }
  });

  // Secrets
  currentArea.secrets?.forEach(secret => {
    const isHidden = secret.secretState?.isHidden ?? false;
    const isInvisible = secret.secretState?.isInvisible ?? false;
    if (!isHidden && !isInvisible) {
      parsedItemsNpcs.push({
        type: 'secret',
        name: secret.name,
        description: secret.description,
        state: secret.secretState,
        interactions: secret.interactions || []
      });
    } else {
      console.log(`Skipped secret ${secret.name} (${isHidden ? 'hidden' : ''}${isInvisible ? 'invisible' : ''})`);
    }
  });

  console.log('Parsed Entities:', parsedItemsNpcs);
  return parsedItemsNpcs;
}

// Create an array for each area to dip into to see what's available from the JSON
// The commandParser.js uses this preferentially to figure out what the player's
// input will do
function parseCommands(currentArea) {
  let parsedCommands = [];

  // Exits
  currentArea.exits?.forEach(exit => {
    const isSecret = exit.exitState?.isSecret === true;
    // console.log(`Exit ${exit.command}: isSecret = ${isSecret}`);
    parsedCommands.push({
      command: exit.command,
      target: exit.direction,
      destination: exit.destination,
      type: 'exit',
      response: exit.response,
      elseResponse: exit.elseResponse,
      condition: exit.condition,
      actionTrigger: exit.actionTrigger,
      isSecret: isSecret
    });
  });

  // Items
  inventory.forEach(item => {
    if (currentArea.itemNames.includes(item.name) || item.itemState?.inInventory) {
      const isHidden = item.itemState?.isHidden ?? false;
      const isInvisible = item.itemState?.isInvisible ?? false;
      const inInventory = item.itemState?.inInventory ?? false;

      if ((!isHidden && !isInvisible) && (inInventory || currentArea.itemNames.includes(item.name))) {
        if (item.commands) {
          item.commands.forEach(cmd => {
            const isSecret = currentArea.secrets?.some(s => 
              cmd.response?.toLowerCase().includes(s.name.toLowerCase()) || 
              cmd.actionTrigger?.some(t => t.target?.includes('secrets'))
            ) || false;

            if (cmd.target && cmd.command.startsWith('place')) {
              parsedCommands.push({
                command: cmd.command,
                target: cmd.target,
                type: 'item',
                response: cmd.response,
                condition: cmd.condition,
                actionTrigger: cmd.actionTrigger,
                priority: cmd.priority || 0,
                isSecret: isSecret
              });
            } else {
              parsedCommands.push({
                command: cmd.target ? `${cmd.command} ${cmd.target.toLowerCase()}` : `${cmd.command} ${item.name.toLowerCase()}`,
                target: cmd.target || item.name,
                type: 'item',
                response: cmd.response,
                condition: cmd.condition,
                actionTrigger: cmd.actionTrigger,
                priority: cmd.priority || 0,
                isSecret: isSecret
              });
            }
          });
        }

        if (inInventory) {
          parsedCommands.push({
            command: `inventory ${item.name.toLowerCase()}`,
            target: item.name,
            type: 'item',
            response: null,
            condition: null,
            priority: 0,
            isSecret: false
          });
        }
      }
    }
  });

  // NPCs
  const npcCommands = {};
  currentArea.npcs?.forEach(npc => {
    const isHidden = npc.npcState?.isHidden ?? false;
    const isInvisible = npc.npcState?.isInvisible ?? false;
    if (!isHidden && !isInvisible) {
      npc.commands.forEach(cmd => {
        const command = `${cmd.command} ${npc.name.toLowerCase()}`;
        const isSecret = currentArea.secrets?.some(s => 
          cmd.response?.toLowerCase().includes(s.name.toLowerCase()) || 
          cmd.actionTrigger?.some(t => t.target?.includes('secrets'))
        ) || false;
        // console.log(`NPC ${command}: isSecret = ${isSecret}`);
        if (!npcCommands[npc.name]) npcCommands[npc.name] = [];
        npcCommands[npc.name].push({
          command,
          target: npc.name,
          type: 'npc',
          response: cmd.response,
          condition: cmd.condition,
          actionTrigger: cmd.actionTrigger,
          priority: cmd.priority || 0,
          isSecret: isSecret
        });
      });
    }
  });
  Object.values(npcCommands).forEach(commands => parsedCommands.push(...commands));

  // Secrets
  currentArea.secrets?.forEach(secret => {
    const isHidden = secret.secretState?.isHidden ?? false;
    const isInvisible = secret.secretState?.isInvisible ?? false;
    if (!isHidden && !isInvisible) {
      secret.commands?.forEach(cmd => {
        // console.log(`Secret ${cmd.command}: isSecret = true`);
        parsedCommands.push({
          command: cmd.command,
          target: cmd.target || secret.name,
          type: 'secret',
          response: cmd.response,
          condition: cmd.condition,
          actionTrigger: cmd.actionTrigger,
          priority: cmd.priority || 0,
          isSecret: true
        });
      });
    }
  });

  // Inventory
  inventory.forEach(item => {
    if (item.commands) {
      item.commands.forEach(cmd => {
        const isSecret = cmd.actionTrigger?.some(t => t.target?.includes('secrets')) || false;
        // console.log(`Inventory ${cmd.command}: isSecret = ${isSecret}`);
        parsedCommands.push({
          command: cmd.command,
          target: cmd.target || item.name,
          type: 'inventory',
          response: cmd.response,
          condition: cmd.condition,
          actionTrigger: cmd.actionTrigger,
          priority: cmd.priority || 0,
          isSecret: isSecret
        });
      });
    }
    if (item.itemState.inInventory) {
      parsedCommands.push({
        command: `inventory ${item.name.toLowerCase()}`,
        target: item.name,
        type: 'inventory',
        response: null,
        condition: null,
        priority: 0,
        isSecret: false
      });
    }
  });

  // Dummy Items
  currentArea.dummyItems?.forEach(dummy => {
    const [target, response] = Object.entries(dummy)[0];
    parsedCommands.push({
      command: `look ${target}`,
      target: target,
      description: `Dummy look at the ${target}.`,
      response: response,
      type: 'dummy',
      priority: 1,
      isSecret: false
    });
  });

  // Generic commands
  parsedCommands.push({
    command: 'look',
    target: null,
    type: 'generic',
    response: 'You look around you.',
    actionTrigger: null,
    isSecret: false
  });
  parsedCommands.push({
    command: 'inventory',
    target: null,
    type: 'generic',
    response: 'Your inventory:',
    actionTrigger: null,
    isSecret: false
  });

  console.log('Parsed Commands:', parsedCommands);
  return parsedCommands;
}

// Look command
function handleLookCommand(input, parsedCommands, currentArea, target, bestMatch) {
  const output = [];

  if (!target) {
    output.push("You look around you.");
    output.push(...displayArea(currentArea.areaId));
    return { output };
  }

  let validMatch = null;
  if (bestMatch && bestMatch.command.startsWith('look') && 
      bestMatch.target && bestMatch.target.toLowerCase().includes(target.toLowerCase()) &&
      (!bestMatch.condition || checkCondition(bestMatch.condition, currentArea, bestMatch.target))) {
    validMatch = bestMatch;
    console.log(`Using bestMatch: ${bestMatch.command} (target: ${bestMatch.target}, priority: ${bestMatch.priority || 0})`);
  } else {
    console.log(`bestMatch invalid or missing: ${bestMatch ? bestMatch.command : 'none'} (target: ${bestMatch?.target || 'none'})`);
    const lookMatches = parsedCommands.filter(c => 
      c.command.startsWith('look') && c.target && 
      c.target.toLowerCase().includes(target.toLowerCase())
    );
    validMatch = lookMatches
      .filter(c => !c.condition || checkCondition(c.condition, currentArea, c.target))
      .sort((a, b) => (b.priority || 0) - (a.priority || 0))[0];
    console.log(`Fallback selected: ${validMatch ? validMatch.command : 'none'} (target: ${validMatch?.target || 'none'}, priority: ${validMatch?.priority || 0})`);
  }

  if (validMatch && validMatch.response) {
    output.push(validMatch.response);
    handleAction(validMatch, currentArea);
  } else if (bestMatch && bestMatch.type === 'generic') {
    const entities = parseItemsNpcs(currentArea);
    const isValidEntity = entities.some(e => 
      e.name.toLowerCase() === bestMatch.target.toLowerCase() && 
      !e.state?.isHidden && !e.state?.isInvisible
    );
    if (isValidEntity) {
      output.push(`You see nothing special about the ${bestMatch.target}.`);
    } else {
      const secretMatch = parsedCommands.find(c => 
        c.command.startsWith('look') && c.type === 'secret' && 
        c.target.toLowerCase().includes(target.toLowerCase())
      );
      output.push(secretMatch ? "The secret remains hidden." : `You don't see "${target}" to look at.`);
    }
  } else {
    const lookMatches = parsedCommands.filter(c => 
      c.command.startsWith('look') && c.target && 
      c.target.toLowerCase().includes(target.toLowerCase())
    );
    if (lookMatches.length > 0) {
      output.push(`You can't look at "${target}" right now.`);
    } else {
      const secretMatch = parsedCommands.find(c => 
        c.command.startsWith('look') && c.type === 'secret' && 
        c.target.toLowerCase().includes(target.toLowerCase())
      );
      output.push(secretMatch ? "The secret remains hidden." : `You don't see "${target}" to look at.`);
    }
  }

  return { output };
}

// Go command
function handleGoCommand(input, parsedCommands, currentArea, target, bestMatch) {
  const output = [];

  // If no target is provided, list available exits
  if (!target) {
    const availableExits = parsedCommands
      .filter(c => 
        c.command.startsWith('go') && 
        c.type === 'exit' && 
        c.target && 
        c.destination !== null &&
        (!c.condition || checkCondition(c.condition, currentArea, c.target))
      )
      .map(c => c.target)
      .filter((value, index, self) => self.indexOf(value) === index);

    if (availableExits.length > 0) {
      output.push('Available directions:');
      availableExits.forEach(exit => output.push(`- ${exit}`));
    } else {
      output.push('There are no obvious exits from here.');
    }
    return { output };
  }

  // Find the matching "go" command from parsedCommands, allowing shorthand
  const goMatches = parsedCommands.filter(c => 
    c.command.startsWith('go ') && 
    c.type === 'exit' && 
    c.target && 
    c.target.toLowerCase().includes(target.toLowerCase())
  );
  
  let validMatch = null;
  if (goMatches.length > 0) {
    validMatch = goMatches[0]; // Use the first match (e.g., "go passage" for "go pass")
    console.log(`Selected exit command: ${validMatch.command} (target: ${validMatch.target})`);
  } else {
    console.log(`No exit match for "go ${target}", checking bestMatch: ${bestMatch ? bestMatch.command : 'none'} (target: ${bestMatch?.target || 'none'})`);
    // Fallback to bestMatch if it's a valid exit command with a matching target
    if (bestMatch && 
        bestMatch.command.startsWith('go ') && 
        bestMatch.type === 'exit' && 
        bestMatch.target?.toLowerCase().includes(target.toLowerCase())) {
      validMatch = bestMatch;
      console.log(`Using bestMatch: ${validMatch.command} (target: ${validMatch.target}, priority: ${validMatch.priority || 0})`);
    }
  }

  // Handle the result
  if (validMatch) {
    if (!validMatch.condition || checkCondition(validMatch.condition, currentArea, validMatch.target)) {
      if (validMatch.destination !== null) {
        // Condition passes and destination exists: use the main response and trigger actions
        output.push(validMatch.response || 'You move on.');
        handleAction(validMatch, currentArea);
        if (validMatch.actionTrigger && validMatch.actionTrigger[0]?.areaId) {
          output.push(...displayArea(validMatch.actionTrigger[0].areaId));
        }
      } else {
        // No destination, treat as blocked
        output.push(validMatch.response || `You can't go "${validMatch.target}" from here.`);
      }
    } else if (validMatch.elseResponse) {
      // Condition fails but elseResponse exists: use it
      output.push(validMatch.elseResponse);
    } else {
      // Condition fails, no elseResponse: generic message
      output.push(`You can't go "${validMatch.target}" from here.`);
    }
  } else {
    // No valid match found
    output.push(`There doesn't appear to be an exit "${target}" from here.`);
  }

  console.log(`Output from handleGoCommand: ${JSON.stringify(output)}`);
  return { output };
}

// Talk command
function handleTalkCommand(input, parsedCommands, currentArea, target, bestMatch) {
  const output = [];

  if (!target) {
    output.push("Who would you like to talk to?");
    const uniqueNpcs = [...new Set(parsedCommands
      .filter(c => {
        // Basic command checks
        const isTalkCommand = c.command.startsWith('talk') && c.target;
        if (!isTalkCommand) return false;

        // Find the NPC in the current area
        const npc = currentArea.npcs?.find(n => n.name === c.target);
        if (!npc) return false; // Skip if NPC isn't in the area

        // Check visibility: neither hidden nor invisible
        const isHidden = npc.npcState?.isHidden ?? false;
        const isInvisible = npc.npcState?.isInvisible ?? false;
        const isAccessible = !isHidden && !isInvisible;

        // Check command condition
        const conditionPasses = !c.condition || checkCondition(c.condition, currentArea, c.target);

        return isAccessible && conditionPasses;
      })
      .map(c => c.target))];
    if (uniqueNpcs.length > 0) {
      uniqueNpcs.forEach(npc => output.push(`- ${npc}`));
    }
    return { output };
  }

  let validMatch = null;
  if (bestMatch && bestMatch.command.startsWith('talk') && 
      bestMatch.target && bestMatch.target.toLowerCase().includes(target.toLowerCase()) &&
      (!bestMatch.condition || checkCondition(bestMatch.condition, currentArea, bestMatch.target))) {
    validMatch = bestMatch;
    console.log(`Using bestMatch: ${bestMatch.command} (target: ${bestMatch.target}, priority: ${bestMatch.priority || 0})`);
  } else {
    console.log(`bestMatch invalid or missing: ${bestMatch ? bestMatch.command : 'none'} (target: ${bestMatch?.target || 'none'})`);
    const talkMatches = parsedCommands.filter(c => 
      c.command.startsWith('talk') && c.target && 
      c.target.toLowerCase().includes(target.toLowerCase())
    );
    validMatch = talkMatches
      .filter(c => !c.condition || checkCondition(c.condition, currentArea, c.target))
      .sort((a, b) => (b.priority || 0) - (a.priority || 0))[0];
    console.log(`Fallback selected: ${validMatch ? validMatch.command : 'none'} (target: ${validMatch?.target || 'none'}, priority: ${validMatch?.priority || 0})`);
  }

  if (validMatch && validMatch.response) {
    output.push(validMatch.response);
    handleAction(validMatch, currentArea);
  } else if (bestMatch && bestMatch.type === 'generic') {
    const entities = parseItemsNpcs(currentArea);
    const isValidEntity = entities.some(e => 
      e.name.toLowerCase() === bestMatch.target.toLowerCase() && 
      !e.state?.isHidden && !e.state?.isInvisible
    );
    if (isValidEntity) {
      output.push(`You can't talk to the ${bestMatch.target}.`);
    } else {
      output.push(`There's nothing matching "${target}" to talk to here.`);
    }
  } else {
    output.push(`There's nothing matching "${target}" to talk to here.`);
  }

  return { output };
}

// Take command
function handleTakeCommand(input, parsedCommands, currentArea, target, bestMatch) {
  const output = [];

  if (!target) {
    output.push("What would you like to take?");
    const availableItems = parsedCommands
      .filter(c => c.command.startsWith('take') && c.target && 
                   (!c.condition || checkCondition(c.condition, currentArea, c.target)))
      .map(c => c.target);
    if (availableItems.length > 0) {
      output.push("You can take:");
      availableItems.forEach(item => output.push(`- ${item}`));
    } else {
      output.push("There's nothing to take here.");
    }
    return { output };
  }

  let validMatch = null;
  if (bestMatch && bestMatch.command.startsWith('take') && 
      bestMatch.target && bestMatch.target.toLowerCase().includes(target.toLowerCase()) &&
      (!bestMatch.condition || checkCondition(bestMatch.condition, currentArea, bestMatch.target))) {
    validMatch = bestMatch;
    console.log(`Using bestMatch: ${bestMatch.command} (target: ${bestMatch.target}, priority: ${bestMatch.priority || 0})`);
  } else {
    console.log(`bestMatch invalid or missing: ${bestMatch ? bestMatch.command : 'none'} (target: ${bestMatch?.target || 'none'})`);
    const takeMatches = parsedCommands.filter(c => 
      c.command.startsWith('take') && c.target && 
      c.target.toLowerCase().includes(target.toLowerCase())
    );
    validMatch = takeMatches
      .filter(c => !c.condition || checkCondition(c.condition, currentArea, c.target))
      .sort((a, b) => (b.priority || 0) - (a.priority || 0))[0];
    console.log(`Fallback selected: ${validMatch ? validMatch.command : 'none'} (target: ${validMatch?.target || 'none'}, priority: ${validMatch?.priority || 0})`);
  }

  if (validMatch && validMatch.response) {
    output.push(validMatch.response);
    handleAction(validMatch, currentArea);
  } else {
    output.push(`There's nothing matching "${target}" to take here.`); // Consistent message
  }

  return { output };
}

// Push command
function handlePushCommand(input, parsedCommands, currentArea, target, bestMatch) {
  const output = [];

  if (!target) {
    output.push("I don't know what you want to push.");
    return { output };
  }

  let validMatch = null;
  if (bestMatch && bestMatch.command.startsWith('push') && 
      bestMatch.target && bestMatch.target.toLowerCase().includes(target.toLowerCase()) &&
      (!bestMatch.condition || checkCondition(bestMatch.condition, currentArea, bestMatch.target))) {
    validMatch = bestMatch;
    console.log(`Using bestMatch: ${bestMatch.command} (target: ${bestMatch.target}, priority: ${bestMatch.priority || 0})`);
  } else {
    console.log(`bestMatch invalid or missing: ${bestMatch ? bestMatch.command : 'none'} (target: ${bestMatch?.target || 'none'})`);
    const pushMatches = parsedCommands.filter(c => 
      c.command.startsWith('push') && c.target && 
      c.target.toLowerCase().includes(target.toLowerCase())
    );
    validMatch = pushMatches
      .filter(c => !c.condition || checkCondition(c.condition, currentArea, c.target))
      .sort((a, b) => (b.priority || 0) - (a.priority || 0))[0];
    console.log(`Fallback selected: ${validMatch ? validMatch.command : 'none'} (target: ${validMatch?.target || 'none'}, priority: ${validMatch?.priority || 0})`);
  }

  if (validMatch && validMatch.response) {
    output.push(validMatch.response);
    handleAction(validMatch, currentArea);
  } else if (bestMatch && bestMatch.type === 'generic') {
    const entities = parseItemsNpcs(currentArea);
    const isValidEntity = entities.some(e => 
      e.name.toLowerCase() === bestMatch.target.toLowerCase() && 
      !e.state?.isHidden && !e.state?.isInvisible
    );
    if (isValidEntity) {
      output.push(`You can't push the ${bestMatch.target}.`);
    } else {
      output.push(`There's nothing matching "${target}" to push here.`);
    }
  } else {
    output.push(`There's nothing matching "${target}" to push here.`);
  }

  return { output };
}

// Pull command
function handlePullCommand(input, parsedCommands, currentArea, target, bestMatch) {
  const output = [];

  if (!target) {
    output.push("I don't know what you want to pull.");
    return { output };
  }

  let validMatch = null;
  if (bestMatch && bestMatch.command.startsWith('pull') && 
      bestMatch.target && bestMatch.target.toLowerCase().includes(target.toLowerCase()) &&
      (!bestMatch.condition || checkCondition(bestMatch.condition, currentArea, bestMatch.target))) {
    validMatch = bestMatch;
    console.log(`Using bestMatch: ${bestMatch.command} (target: ${bestMatch.target}, priority: ${bestMatch.priority || 0})`);
  } else {
    console.log(`bestMatch invalid or missing: ${bestMatch ? bestMatch.command : 'none'} (target: ${bestMatch?.target || 'none'})`);
    const pullMatches = parsedCommands.filter(c => 
      c.command.startsWith('pull') && c.target && 
      c.target.toLowerCase().includes(target.toLowerCase())
    );
    validMatch = pullMatches
      .filter(c => !c.condition || checkCondition(c.condition, currentArea, c.target))
      .sort((a, b) => (b.priority || 0) - (a.priority || 0))[0];
    console.log(`Fallback selected: ${validMatch ? validMatch.command : 'none'} (target: ${validMatch?.target || 'none'}, priority: ${validMatch?.priority || 0})`);
  }

  if (validMatch && validMatch.response) {
    output.push(validMatch.response);
    handleAction(validMatch, currentArea);
  } else if (bestMatch && bestMatch.type === 'generic') {
    const entities = parseItemsNpcs(currentArea);
    const isValidEntity = entities.some(e => 
      e.name.toLowerCase() === bestMatch.target.toLowerCase() && 
      !e.state?.isHidden && !e.state?.isInvisible
    );
    if (isValidEntity) {
      output.push(`You can't pull the ${bestMatch.target}.`);
    } else {
      output.push(`There's nothing matching "${target}" to pull here.`);
    }
  } else {
    output.push(`There's nothing matching "${target}" to pull here.`);
  }

  return { output };
}

function handleHitCommand(input, parsedCommands, currentArea, target, bestMatch) {
  const output = [];

  if (!target) {
    output.push("I don't know what you want to hit.");
    return { output };
  }

  let validMatch = null;
  if (bestMatch && bestMatch.command.startsWith('hit') && 
      bestMatch.target && bestMatch.target.toLowerCase().includes(target.toLowerCase()) &&
      (!bestMatch.condition || checkCondition(bestMatch.condition, currentArea, bestMatch.target))) {
    validMatch = bestMatch;
    console.log(`Using bestMatch: ${bestMatch.command} (target: ${bestMatch.target}, priority: ${bestMatch.priority || 0})`);
  } else {
    console.log(`bestMatch invalid or missing: ${bestMatch ? bestMatch.command : 'none'} (target: ${bestMatch?.target || 'none'})`);
    const hitMatches = parsedCommands.filter(c => 
      c.command.startsWith('hit') && c.target && 
      c.target.toLowerCase().includes(target.toLowerCase())
    );
    validMatch = hitMatches
      .filter(c => !c.condition || checkCondition(c.condition, currentArea, c.target))
      .sort((a, b) => (b.priority || 0) - (a.priority || 0))[0];
    console.log(`Fallback selected: ${validMatch ? validMatch.command : 'none'} (target: ${validMatch?.target || 'none'}, priority: ${validMatch?.priority || 0})`);
  }

  if (validMatch && validMatch.response) {
    output.push(validMatch.response);
    handleAction(validMatch, currentArea);
  } else if (bestMatch && bestMatch.type === 'generic') {
    const entities = parseItemsNpcs(currentArea);
    const isValidEntity = entities.some(e => 
      e.name.toLowerCase() === bestMatch.target.toLowerCase() && 
      !e.state?.isHidden && !e.state?.isInvisible
    );
    if (isValidEntity) {
      output.push(`You can't hit the ${bestMatch.target}.`);
    } else {
      output.push(`There's nothing matching "${target}" to hit here.`);
    }
  } else {
    output.push(`There's nothing matching "${target}" to hit here.`);
  }

  return { output };
}

function handleUseCommand(input, parsedCommands, currentArea, target, bestMatch) {
  const output = [];
  console.log(`handleUseCommand: input="${input}", target="${target}", bestMatch=`, bestMatch);

  if (!target) {
    output.push("I don't know what you want to use.");
    return { output };
  }

  const invItem = inventory?.find(item => 
  item?.name?.toLowerCase()?.includes(target.toLowerCase()) && item?.itemState?.inInventory
  );

  if (invItem) {
    // Look for a "use" command in the inventory item's commands
    const invCommand = invItem.commands?.find(cmd => 
      cmd.command.toLowerCase() === `use ${target.toLowerCase()}` ||
      cmd.command.toLowerCase() === `use ${invItem.name.toLowerCase()}`
    );

    if (invCommand && (!invCommand.condition || checkCondition(invCommand.condition, currentArea, invItem.name))) {
      output.push(invCommand.response);
      handleAction(invCommand, currentArea);
      console.log('Using inventory command:', invCommand.response);
      return { output };
    }
  }

// Check environment via parsedCommands
let validMatch = null;
if (bestMatch && bestMatch.command.startsWith('use') && 
    bestMatch.target && bestMatch.target.toLowerCase().includes(target.toLowerCase()) &&
    (!bestMatch.condition || checkCondition(bestMatch.condition, currentArea, bestMatch.target))) {
  validMatch = bestMatch;
  console.log(`Using bestMatch: ${bestMatch.command} (target: ${bestMatch.target}, priority: ${bestMatch.priority || 0})`);
} else {
  console.log(`bestMatch invalid or missing: ${bestMatch ? bestMatch.command : 'none'} (target: ${bestMatch?.target || 'none'})`);
  const useMatches = parsedCommands.filter(c => 
    c.command.startsWith('use') && c.target && 
    c.target.toLowerCase().includes(target.toLowerCase())
  );
  validMatch = useMatches
    .filter(c => !c.condition || checkCondition(c.condition, currentArea, c.target))
    .sort((a, b) => (b.priority || 0) - (a.priority || 0))[0];
  console.log(`Fallback selected: ${validMatch ? validMatch.command : 'none'} (target: ${validMatch?.target || 'none'}, priority: ${validMatch?.priority || 0})`);
}

if (validMatch && validMatch.response) {
  output.push(validMatch.response);
  handleAction(validMatch, currentArea);
} else if (bestMatch && bestMatch.type === 'generic') {
  const entities = parseItemsNpcs(currentArea);
  const isValidEntity = entities.some(e => 
    e.name.toLowerCase() === bestMatch.target.toLowerCase() && 
    !e.state?.isHidden && !e.state?.isInvisible
  );
  if (isValidEntity) {
    output.push(`You can't use the ${bestMatch.target} that way... yet?`);
  } else {
    output.push(`There's nothing matching "${target}" to use here.`);
  }
} else {
  output.push(invItem ? `You can't use the ${invItem.name} that way... yet?` : `There's nothing matching "${target}" to use here.`);
}

console.log('Returning output:', output);
return { output };
}

// Place command
function handlePlaceCommand(input, parsedCommands, currentArea, target, bestMatch) {
  const output = [];

  if (!target) {
    output.push("I don't know what you want to place.");
    return { output };
  }

  const invItem = inventory.find(item => 
    item.name.toLowerCase().includes(target.toLowerCase()) && item.itemState.inInventory
  );

  if (!invItem) {
    output.push(`You don't have anything matching "${target}" in your inventory to place.`);
    return { output };
  }

  let validMatch = null;
  // Check bestMatch first, ensuring it matches the item and command
  if (bestMatch && 
      bestMatch.command.startsWith('place ') && 
      bestMatch.command.toLowerCase().includes(target.toLowerCase()) && 
      (!bestMatch.condition || checkCondition(bestMatch.condition, currentArea, bestMatch.target))) {
    validMatch = bestMatch;
    console.log(`Using bestMatch: ${bestMatch.command} (target: ${bestMatch.target}, priority: ${bestMatch.priority || 0})`);
  } else {
    console.log(`bestMatch invalid or missing: ${bestMatch ? bestMatch.command : 'none'} (target: ${bestMatch?.target || 'none'})`);
    // Fallback to parsedCommands, matching on the full command string
    const placeMatches = parsedCommands.filter(c => 
      c.command.startsWith('place ') && 
      c.command.toLowerCase().includes(target.toLowerCase()) // Match item in command, not just target
    );
    validMatch = placeMatches
      .filter(c => !c.condition || checkCondition(c.condition, currentArea, c.target))
      .sort((a, b) => (b.priority || 0) - (a.priority || 0))[0];
    console.log(`Fallback selected: ${validMatch ? validMatch.command : 'none'} (target: ${validMatch?.target || 'none'}, priority: ${validMatch?.priority || 0})`);
  }

  if (validMatch && validMatch.response) {
    output.push(validMatch.response);
    handleAction(validMatch, currentArea);
  } else {
    output.push(`You can't place the ${invItem.name} here right now.`);
  }

  console.log(`Output from handlePlaceCommand: ${JSON.stringify(output)}`);
  return { output };
}

// Light command
function handleLightCommand(input, parsedCommands, currentArea, target, bestMatch) {
  const output = [];

  if (!target) {
    output.push("What do you want to light?");
    return { output };
  }

  const invItem = inventory.find(item => 
    item.name.toLowerCase().includes(target.toLowerCase()) && item.itemState.inInventory
  );

  if (!invItem) {
    output.push(`You don't have anything matching "${target}" in your inventory to light.`);
    return { output };
  }

  let validMatch = null;
  if (bestMatch && bestMatch.command.startsWith('light') && 
      bestMatch.target && bestMatch.target.toLowerCase().includes(target.toLowerCase()) &&
      (!bestMatch.condition || checkCondition(bestMatch.condition, currentArea, bestMatch.target))) {
    validMatch = bestMatch;
    console.log(`Using bestMatch: ${bestMatch.command} (target: ${bestMatch.target}, priority: ${bestMatch.priority || 0})`);
  } else {
    console.log(`bestMatch invalid or missing: ${bestMatch ? bestMatch.command : 'none'} (target: ${bestMatch?.target || 'none'})`);
    const lightMatches = parsedCommands.filter(c => 
      c.command.startsWith('light') && c.target && 
      c.target.toLowerCase().includes(target.toLowerCase())
    );
    validMatch = lightMatches
      .filter(c => !c.condition || checkCondition(c.condition, currentArea, c.target))
      .sort((a, b) => (b.priority || 0) - (a.priority || 0))[0];
    console.log(`Fallback selected: ${validMatch ? validMatch.command : 'none'} (target: ${validMatch?.target || 'none'}, priority: ${validMatch?.priority || 0})`);
  }

  if (validMatch && validMatch.response) {
    output.push(validMatch.response);
    handleAction(validMatch, currentArea);
  } else if (bestMatch && bestMatch.type === 'generic') {
    output.push(`You can't light the ${invItem.name} right now.`);
  } else {
    output.push(`You can't light the ${invItem.name} right now.`);
  }

  return { output };
}

// Display inventory
function displayInventory() {
  const invItems = inventory.filter(item => item.itemState.inInventory);
  if (!invItems.length) return ['Your inventory is empty.'];

  const output = ['\nYour inventory:'];
  invItems.forEach(item => output.push(`- ${item.name}`));
  console.log(invItems);
  return output;
}

// Handle "inventory <item>"
function handleInventoryItem(input) {
  const output = [];
  const target = input.toLowerCase().slice(10).trim();
  const invItems = inventory.filter(item => 
    item.name.toLowerCase().includes(target) && item.itemState.inInventory
  );

  if (invItems.length === 0) {
    output.push(`You don't have anything matching "${target}" in your inventory.`);
  } else if (invItems.length === 1) {
    const invItem = invItems[0];
    const invDescription = invDescriptions.find(i => 
      i.name.toLowerCase() === invItem.name.toLowerCase()
    );
    if (invDescription) {
      output.push(invDescription.description);

      // Check for applicable extraLookBlurbs first
      let hasExtraBlurb = false;
      if (invItem.itemState) {
        for (const [condition, isTrue] of Object.entries(invItem.itemState)) {
          if (isTrue && invDescription.extraLookBlurbs?.[condition]) {
            const randomConditionBlurb = invDescription.extraLookBlurbs[condition][
              Math.floor(Math.random() * invDescription.extraLookBlurbs[condition].length)
            ];
            output.push(randomConditionBlurb);
            hasExtraBlurb = true; // Flag that an extra blurb was added
          }
        }
      }

      // Only add lookBlurbs if no extraLookBlurbs were applied
      if (!hasExtraBlurb && invDescription.lookBlurbs && invDescription.lookBlurbs.length) {
        const randomBlurb = invDescription.lookBlurbs[
          Math.floor(Math.random() * invDescription.lookBlurbs.length)
        ];
        output.push(randomBlurb);
      }
    } else {
      output.push(`You don't see anything special about the ${invItem.name}.`);
    }
  } else {
    output.push(`You don't have a "${target}" in your inventory.`);
  }

  return { output };
}

// Handle Action Triggers
function handleAction(command, currentArea) {
  if (!command.actionTrigger) return;
  if (!currentArea) {
    console.error('handleAction: currentArea is undefined');
    return;
  }

  command.actionTrigger.forEach(trigger => {
    if (trigger.action === 'setState') {
      const targetParts = trigger.target.split('.');
      if (targetParts[0] === 'inventory' && targetParts[1].startsWith('name:')) {
        const itemName = targetParts[1].split(':')[1];
        const item = inventory.find(i => i.name === itemName);
        if (item) {
          item.itemState[trigger.condition] = trigger.value;
          console.log(`Set ${trigger.condition} = ${trigger.value} for inventory item ${item.name}`);
        } else {
          console.warn(`Item ${itemName} not found in inventory`);
        }
      } else if (targetParts[0] === 'areas' && targetParts[1].startsWith('areaId:')) {
        const [, subPath] = trigger.target.split('.areaId:');
        if (subPath.includes('.npcs.npcId:')) {
          const [areaId, npcPart] = subPath.split('.npcs.npcId:');
          const npcId = parseInt(npcPart, 10); // Specify radix for clarity
          const area = areaData.find(a => a.areaId === areaId);
          if (!area) {
            console.error(`Area ${areaId} not found in areaData`);
            return;
          }
          const npc = area.npcs.find(n => n.npcId === npcId);
          npc.npcState[trigger.condition] = trigger.value;
          console.log(`Set ${trigger.condition} = ${trigger.value} for NPC ${npc.name}`);
        } else if (subPath.includes('.secrets.secretId:')) {
          const [areaId, secretPart] = subPath.split('.secrets.secretId:');
          const secretId = parseInt(secretPart, 10);
          const area = areaData.find(a => a.areaId === areaId);
          if (!area) {
            console.error(`Area ${areaId} not found in areaData`);
            return;
          }
          const secret = area.secrets.find(s => s.secretId === secretId);
          if (secret) {
            secret.secretState[trigger.condition] = trigger.value;
            console.log(`Set ${trigger.condition} = ${trigger.value} for secret ${secret.name}`);
          } else {
            console.warn(`Secret with ID ${secretId} not found in area ${areaId}`);
          }
        } else if (subPath.includes('.items.name:')) {
          const [areaId, itemPart] = subPath.split('.items.name:');
          const itemName = itemPart;
          const area = areaData.find(a => a.areaId === areaId);
          if (!area) {
            console.error(`Area ${areaId} not found in areaData`);
            return;
          }
          const item = area.items.find(i => i.name === itemName);
          if (!item) {
            console.error(`Item ${itemName} not found in area ${areaId}`);
            return;
          }
          item.itemState[trigger.condition] = trigger.value;
          console.log(`Set ${trigger.condition} = ${trigger.value} for item ${item.name} in area ${area.name}`);
        } else {
          const areaId = subPath;
          const area = areaData.find(a => a.areaId === areaId);
          if (!area) {
            console.error(`Area ${areaId} not found in areaData`);
            return;
          }
          area.areaState[trigger.condition] = trigger.value;
          console.log(`Set ${trigger.condition} = ${trigger.value} for area ${area.name}`);
        }
      }
    } else if (trigger.action === 'addItemToInventory') {
      const item = inventory.find(i => i.name.toLowerCase() === trigger.item.toLowerCase());
      if (item) {
        item.itemState.inInventory = true;
        console.log(`Set ${trigger.item} inInventory = true. Current inventory:`, 
          inventory.filter(i => i.itemState.inInventory));
      } else {
        console.warn(`Item ${trigger.item} not found in inventory`);
      }
    } else if (trigger.action === 'removeItemFromInventory') {
      const item = inventory.find(i => i.name.toLowerCase() === trigger.item.toLowerCase());
      if (item) {
        item.itemState.inInventory = false;
        console.log(`Set ${trigger.item} inInventory = false. Current inventory:`, 
          inventory.filter(i => i.itemState.inInventory));
      } else {
        console.warn(`Item ${trigger.item} not found in inventory`);
      }
    } else if (trigger.action === 'setPlayerArea') {
      playerData.currentArea = trigger.areaId;
      console.log(`Moved player to area ${trigger.areaId}`);
    }
  });
}

// Main function for commands
function handleCommand(input) {
  const currentArea = areaData.find(area => area.areaId === playerData.currentArea);
  console.log('handleCommand:', { input, currentArea: currentArea?.areaId});
  if (!currentArea) return { output: ['Invalid area.'], isSecret: false, isProblem: true };

  const parsedCommands = parseCommands(currentArea); // Grabs available commands from the current area
  const { command, target, bestMatch } = parseCommand(input, parsedCommands, currentArea, checkCondition);
  
  if (!command) {
    return { output: [`Unknown command: ${input}`], isSecret: false, isProblem: true };
  }

  // Determine if the command involves a secret
  const matchedCommand = parsedCommands.find(c => c.command === (bestMatch?.command || input)) || bestMatch;
  const isSecret = matchedCommand?.isSecret || false;

  let response;
  switch (command) {
    case 'look':
      response = handleLookCommand(input, parsedCommands, currentArea, target, bestMatch);
      break;
    case 'go':
      response = handleGoCommand(input, parsedCommands, currentArea, target, bestMatch);
      break;
    case 'talk':
      response = handleTalkCommand(input, parsedCommands, currentArea, target, bestMatch);
      break;
    case 'take':
      response = handleTakeCommand(input, parsedCommands, currentArea, target, bestMatch);
      break;
    case 'push':
      response = handlePushCommand(input, parsedCommands, currentArea, target, bestMatch);
      break;
    case 'pull':
      response = handlePullCommand(input, parsedCommands, currentArea, target, bestMatch);
      break;
    case 'inventory':
      if (!target) response = { output: displayInventory() };
      else response = handleInventoryItem(`${command} ${target}`);
      break;
    case 'hit':
      response = handleHitCommand(input, parsedCommands, currentArea, target, bestMatch);
      break;
    case 'use':
      response = handleUseCommand(input, parsedCommands, currentArea, target, bestMatch);
      break;
    case 'place':
      response = handlePlaceCommand(input, parsedCommands, currentArea, target, bestMatch);
      break;
    case 'light':
      response = handleLightCommand(input, parsedCommands, currentArea, target, bestMatch);
      break;
    default:
      if (bestMatch) {
        handleAction(bestMatch, currentArea);
        response = { output: [bestMatch.response] };
      } else {
        response = { output: [`Command "${command}" not implemented yet.`], isProblem: true };
      }
      break;
  }

  // Attach isSecret to the response
  response.isSecret = isSecret;
  response.isProblem = response.isProblem || isProblemResponse(response.output);
  console.log(`handleCommand response:`, { output: response.output, isSecret, isProblem: response.isProblem });
  return response;
}

function isProblemResponse(output) {
  const problemPatterns = [
    /unknown command/i,
    /there's nothing matching/i,
    /there doesn't appear/i,
    /you can't/i,
    /you don't see/i,
    /not implemented yet/i,
    /there are no/i,
    /i don't know/i,
    /you don't have/i,
    /you don't have anything matching/i
  ];
  console.log(`isProblem received `, {output});
  return output.some(line => 
    problemPatterns.some(pattern => pattern.test(line.toLowerCase()))
  );
}

export function getInventory() {
  return inventory;
}

export function updatePlayerData(newData){
  Object.assign(playerData, newData);
}

export { handleCommand, displayArea, checkCondition, parseItemsNpcs };