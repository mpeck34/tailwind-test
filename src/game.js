import gameData from './data/gameData.json'; // Ensure correct path
import inventoryDescriptions from './data/inventoryDescriptions.json';
import { parseCommand } from './commandParser.js';

const invDescriptions = inventoryDescriptions.invDescriptions;
const playerData = gameData.playerData;
const areaData = gameData.areas;

// Display whole area with visible things
function displayArea(areaId) {
  const area = areaData.find(area => area.areaId === areaId);
  if (!area) return ['Area not found.'];

  let output = [area.description];

  // Append environmental additives
  if (area.environment?.additives) {
    area.environment.additives.forEach(additive => {
      if (!additive.condition || checkCondition(additive.condition, area)) {
        output.push(additive.text);
      }
    });
  }

  // Parse items, NPCs, and secrets
  const parsedItemsNpcs = parseItemsNpcs(area);
  console.log(parsedItemsNpcs);

  // Add visible entities
  if (parsedItemsNpcs.length > 0) {
    output.push("You see:");

    const entityGroups = parsedItemsNpcs.reduce((acc, entity) => {
      acc[entity.name] = acc[entity.name] || [];
      acc[entity.name].push(entity);
      return acc;
    }, {});

    for (const name in entityGroups) {
      const entities = entityGroups[name];
      const entity = entities[0]; // Assume one per name

      // Skip if hidden
      if (entity.conditions?.isHidden === true) {
        console.log(`Skipped ${entity.name} (hidden)`);
        continue;
      }
      // Skip if invisible
      if (entity.conditions?.isInvisible === true) {
        console.log(`Skipped ${entity.name} (invisible)`);
        continue;
      }

      // Use the base description directly
      let fullResponse = `- ${entity.name}: ${entity.description}`;

      // Append interactions if conditions met
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
  // If no condition is provided, allow by default (fail to true)
  if (!condition) return true;

  // If condition is an array, ensure all conditions pass (AND logic)
  if (Array.isArray(condition)) {
    return condition.every(subCondition => checkCondition(subCondition, currentArea, itemName));
  }

  // Handle different condition types
  if (condition.type === 'areaCondition') {
    const value = currentArea?.conditions?.[condition.key];
    // Special case for visibility: default to false (visible) if undefined
    if (condition.key === 'isHidden' || condition.key === 'isInvisible') {
      return (value ?? false) === condition.value;
    }
    // General case: default to false if undefined
    return (value ?? false) === condition.value;
  }
  if (condition.type === 'hasItem') {
    const hasItem = playerData?.inventory?.some(i => i.name === condition.item) ?? false;
    console.log(`Checking if player has "${condition.item}": ${hasItem}`);
    return hasItem;
  }
  if (condition.type === 'doesNotHaveItem') {
    return !(playerData?.inventory?.some(i => i.name === condition.item)) ?? false;
  }
  if (condition.type === 'playerCondition') {
    const value = playerData?.conditions?.[condition.key] ?? false;
    return value === condition.value;
  }
  if (condition.type === 'npcCondition') {
    const npc = currentArea?.npcs?.find(n => n.name === condition.npc);
    const value = npc?.conditions?.[condition.key] ?? false;
    return value === condition.value;
  }
  if (condition.type === 'itemCondition') {
    const item = currentArea?.items?.find(i => i.name === itemName);
    const value = item?.conditions?.[condition.key] ?? false;
    console.log(`Checking ${condition.key}: ${value} for ${itemName}, Item: ${JSON.stringify(item?.conditions)}`);
    return value === condition.value;
  }
  if (condition.type === 'secretCondition') {
    const secret = currentArea?.secrets?.find(s => s.name === itemName);
    const value = secret?.conditions?.[condition.key] ?? false;
    return value === condition.value;
  }

  // If an unknown condition type is given, assume it's not applicable (false)
  return false;
}

function addItemToInventory(itemName) {
  const itemDescription = invDescriptions.find(item => item.name.toLowerCase() === itemName.toLowerCase());
  if (itemDescription) {
      const newItem = {
          name: itemDescription.name,
          conditions: { ...itemDescription.defaultConditions }
      };
      playerData.inventory.push(newItem);
      console.log(`Added ${itemName} to inventory. Current inventory:`, playerData.inventory);
  } else {
      console.error(`Item "${itemName}" not found in invDescriptions. Inventory unchanged.`);
  }
}

function parseItemsNpcs(currentArea) {
  let parsedItemsNpcs = [];

  // Items
  currentArea.items.forEach(item => {
    parsedItemsNpcs.push({
      type: 'item',
      name: item.name,
      description: item.description,
      conditions: item.conditions,
      interactions: item.interactions
    });
  });

  // NPCs
  currentArea.npcs.forEach(npc => {
    parsedItemsNpcs.push({
      type: 'npc',
      name: npc.name,
      description: npc.description,
      conditions: npc.conditions,
      interactions: npc.interactions
    });
  });

  // Secrets
  currentArea.secrets.forEach(secret => {
    parsedItemsNpcs.push({
      type: 'secret',
      name: secret.name,
      description: secret.description,
      conditions: secret.conditions,
      interactions: secret.interactions || [] // Secrets might not have interactions, default to empty
    });
  });

  return parsedItemsNpcs;
}

function parseCommands(currentArea) {
  let parsedCommands = [];

  // Exits
  currentArea.exits.commands?.forEach(cmd => parsedCommands.push({
    command: cmd.command,
    exit: cmd.command.startsWith('go') ? cmd.command.split(' ')[1] || null : null, // Extract direction
    response: cmd.response,
    condition: cmd.condition,
    actionTrigger: cmd.actionTrigger
  }));

  // Items
  currentArea.items.forEach(item => item.commands.forEach(cmd => parsedCommands.push({
    command: cmd.command + ' ' + item.name.toLowerCase(),
    target: item.name,
    type: 'item',
    response: cmd.response,
    condition: cmd.condition,
    actionTrigger: cmd.actionTrigger
  })));

  // NPCs
  currentArea.npcs.forEach(npc => npc.commands.forEach(cmd => parsedCommands.push({
    command: cmd.command + ' ' + npc.name.toLowerCase(),
    npc: npc.name,
    response: cmd.response,
    condition: cmd.condition,
    actionTrigger: cmd.actionTrigger
  })));

  // Secrets
  currentArea.secrets.forEach(secret => secret.commands.forEach(cmd => parsedCommands.push({
    command: cmd.command,
    secret: secret.name,
    response: cmd.response,
    condition: cmd.condition,
    actionTrigger: cmd.actionTrigger
  })));

  // Inventory commands
  playerData.inventory.forEach(item => {
    parsedCommands.push({
      command: `inventory ${item.name.toLowerCase()}`,
      item: item.name,
      type: 'inventory',
      condition: null // No condition needed, item is already in inventory
    });
  });

  const npcTalkCommands = {};
  currentArea.npcs.forEach(npc => {
      npc.commands.forEach(cmd => {
          if (cmd.command === 'talk') {
              if (!npcTalkCommands[npc.name]) {
                  npcTalkCommands[npc.name] = [];
              }
              npcTalkCommands[npc.name].push({
                  command: `talk ${npc.name.toLowerCase()}`,
                  npc: npc.name,
                  type: 'npc',
                  response: cmd.response,
                  condition: cmd.condition,
                  actionTrigger: cmd.actionTrigger
              });
          } else {
              parsedCommands.push({
                  command: `${cmd.command} ${npc.name.toLowerCase()}`,
                  npc: npc.name,
                  type: 'npc',
                  response: cmd.response,
                  condition: cmd.condition,
                  actionTrigger: cmd.actionTrigger
              });
          }
      });
  });
  Object.values(npcTalkCommands).forEach(commands => parsedCommands.push(...commands));

  // Generic look
  parsedCommands.push({
    command: 'look',
    response: 'You look around you.',
    actionTrigger: null
  });

  console.log(parsedCommands);
  return parsedCommands;
}

function handleLookCommand(input, parsedCommands, currentArea) {
  let output = [];
  const lookInput = input.toLowerCase().trim();

  // If just "look" is entered, show the full area description
  if (lookInput === 'look') {
    output = displayArea(currentArea.areaId);
    output.unshift("You look around you.")
    return { needsFurtherInput: false, output };
  }

  const target = lookInput.replace('look', '').trim();
  console.log(`Looking for: "${target}"`);

const lookCommands = parsedCommands.filter(c => {
    if (!c.command.startsWith('look')) return false;
    const exactCommandMatch = c.command === `look ${target}`;
    const partialCommandMatch = c.command.includes(target);
    const exactTargetMatch = (c.target?.toLowerCase() || c.item?.toLowerCase()) === target;
    const partialTargetMatch = (c.target?.toLowerCase() || c.item?.toLowerCase() || '').includes(target);
    const matches = exactCommandMatch || partialCommandMatch || exactTargetMatch || partialTargetMatch;
    console.log(`Checking: ${c.command}, Target/Item: ${c.target || c.item}, Matches: ${matches}`);
    return matches;
  });

  // Pick the best match based on condition specificity
  const lookCommand = lookCommands.reduce((best, current) => {
    const currentPasses = !current.condition || checkCondition(current.condition, currentArea, current.target);
    if (!currentPasses) return best;
    if (!best) return current;
    const bestPasses = !best.condition || checkCondition(best.condition, currentArea, best.target);
    if (!bestPasses) return current;
    const currentConditionCount = Array.isArray(current.condition) ? current.condition.length : (current.condition ? 1 : 0);
    const bestConditionCount = Array.isArray(best.condition) ? best.condition.length : (best.condition ? 1 : 0);
    return currentConditionCount > bestConditionCount ? current : best;
  }, null);

  if (lookCommand) {
    console.log(`Found: ${lookCommand.command}, Response: ${lookCommand.response}, Condition: ${JSON.stringify(lookCommand.condition)}`);
    // Check conditions with target name
    if (!lookCommand.condition || checkCondition(lookCommand.condition, currentArea, lookCommand.target)) {
      output.push(lookCommand.response || `You see nothing special about the ${target}.`);
      handleAction(lookCommand, currentArea); // Execute any action triggers
    } else {
      if (lookCommand.type === 'secret') {
        output.push(`The secret remains hidden.`);
      } else {
        output.push(`The ${target} is obscured and hard to see.`);
      }
    }
  } else {
    // Fallback for unrecognized targets
    output.push(`You don't see "${target}" to look at.`);
  }

  return { needsFurtherInput: false, output };
}


// Go command
function handleGoCommand(input, currentArea, parsedCommands) {
  let output = [];
  const direction = input.split(' ')[1];

  if (direction) {
    // Ensure exits and commands exist before accessing them
    const goCommand = currentArea?.exits?.commands?.find(cmd => cmd.command === `go ${direction}`);

    if (goCommand) {
      // Check if there are conditions for the exit
      if (goCommand.condition && !checkCondition(goCommand.condition, currentArea)) {
        output.push(`You cannot go ${direction} right now.`);
      } else {
        const exit = currentArea.exits[direction];
        if (exit) {
          const targetArea = areaData.find(area => area.areaId === exit);
          if (targetArea) {
            playerData.currentArea = targetArea.areaId;
            output.push(`You go ${direction} to the ${targetArea.name}.`);
          } else {
            output.push(`You cannot go that way.`);
          }
        } else {
          output.push(`There is no exit in that direction.`);
        }
      }
    } else {
      output.push(`You cannot go in that direction.`);
    }
  } else {
    output.push('Which direction would you like to go?');
  }

  return {
    needsFurtherInput: !direction, // If no direction is specified, we need more input
    output: output
  };
}

// Talk command
function handleTalkCommand(input, parsedCommands, currentArea, isSecondInput) {
  const output = [];
  const validTalkMatches = parsedCommands.filter(c => c.command.startsWith('talk') && c.npc);
  const uniqueNpcs = [...new Set(validTalkMatches.map(c => c.npc))];

  if (!isSecondInput && input.toLowerCase() === 'talk') {
      if (uniqueNpcs.length === 0) {
          output.push('There’s no one here to talk to.');
      } else {
          output.push('Who would you like to talk to?');
          uniqueNpcs.forEach(npc => output.push(`- ${npc}`));
      }
      return { needsFurtherInput: uniqueNpcs.length > 0, output };
  }

  const talkTarget = input.toLowerCase().slice(5).trim();
  const validMatch = validTalkMatches.find(match => 
      match.npc.toLowerCase().includes(talkTarget) && 
      (!match.condition || checkCondition(match.condition, currentArea, match.npc))
  );

  if (validMatch) {
      output.push(validMatch.response);
      handleAction(validMatch, currentArea);
  } else {
      output.push(`You don't see "${talkTarget}" here to talk to.`);
  }
  return { needsFurtherInput: false, output };
}

// Take command
function handleTakeCommand(input, parsedCommands, currentArea) {
  const takeableItems = parsedCommands.filter(c => c.command === 'take');
  let output = [];

  if (takeableItems.length > 0) {
    const itemName = input.split(' ')[1]?.toLowerCase();
    const itemMatch = takeableItems.find(c => c.item.toLowerCase() === itemName);
    if (itemMatch) {
      if (!itemMatch.condition || checkCondition(itemMatch.condition, currentArea)) {
        addItemToInventory(itemMatch.item);
        const item = currentArea.items.find(i => i.name.toLowerCase() === itemName);
        const itemIndex = currentArea.items.indexOf(item);
        currentArea.items.splice(itemIndex, 1);
        output.push(itemMatch.response);
        handleAction(itemMatch, currentArea);
      } else {
        output.push(`You cannot take the ${itemName} right now.`);
      }
    } else {
      output.push(`There is no ${itemName} here to take.`);
    }
  } else {
    output.push('There are no items you can take here.');
  }

  return { needsFurtherInput: false, output };
}

// Push command
function handlePushCommand(input, parsedCommands, currentArea) {
  const pushableItems = parsedCommands.filter(c => c.command === 'push');
  let output = [];

  if (pushableItems.length > 0) {
    const objectName = input.split(' ')[1];
    const object = currentArea.items.find(i => i.name.toLowerCase() === objectName.toLowerCase());

    if (object) {
      // Check if the object has a condition
      if (!object.condition || checkCondition(object.condition, currentArea)) {
        // If the object is pushable, provide feedback
        output.push(`You push the ${objectName}, but nothing happens.`);
      } else {
        output.push(`You cannot push the ${objectName} right now.`);
      }
    } else {
      output.push(`There is no ${objectName} here to push.`);
    }
  } else {
    output.push('There are no objects you can push here.');
  }

  return {
    needsFurtherInput: false, // No further input needed for the 'push' command
    output: output
  };
}

// Pull command
function handlePullCommand(input, parsedCommands, currentArea) {
  const pullableItems = parsedCommands.filter(c => c.command === 'pull');
  let output = [];

  if (pullableItems.length > 0) {
    const objectName = input.split(' ')[1];
    const object = currentArea.items.find(i => i.name.toLowerCase() === objectName.toLowerCase());

    if (object) {
      // Check if the object has a condition
      if (!object.condition || checkCondition(object.condition, currentArea)) {
        // If the object is pullable, provide feedback
        output.push(`You pull the ${objectName}, but nothing happens.`);
      } else {
        output.push(`You cannot pull the ${objectName} right now.`);
      }
    } else {
      output.push(`There is no ${objectName} here to pull.`);
    }
  } else {
    output.push('There are no objects you can pull here.');
  }

  return {
    needsFurtherInput: false, // No further input needed for the 'pull' command
    output: output
  };
}

// Display inventory
function displayInventory() {
  if (!playerData.inventory.length) return ['Your inventory is empty.'];

  const output = ['\nYour inventory:'];
  playerData.inventory.forEach(item => {
    output.push(`- ${item.name}`);
  });
  return output;
}

// Handle "inventory <item>"
function handleInventoryItem(input) {
  const output = [];
  const target = input.toLowerCase().slice(10).trim(); // Assuming "inventory " is 10 chars
  const invItems = playerData.inventory.filter(item => 
      item.name.toLowerCase().includes(target)
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

      // Add extra blurbs if there are conditions set
      if (invDescription.lookBlurbs && invDescription.lookBlurbs.length) {
        const randomBlurb = invDescription.lookBlurbs[Math.floor(Math.random() * invDescription.lookBlurbs.length)];
        output.push(randomBlurb);
      }

      // Add extra condition-based blurbs if conditions are met
      if (invItem.conditions) {
        for (const [condition, isTrue] of Object.entries(invItem.conditions)) {
          if (isTrue && invDescription.extraLookBlurbs?.[condition]) {
            const randomConditionBlurb = invDescription.extraLookBlurbs[condition][Math.floor(Math.random() * invDescription.extraLookBlurbs[condition].length)];
            output.push(randomConditionBlurb);
          }
        }
      }
    } else {
      output.push(`You don't see anything special about the ${target}.`);
    }
  } else {
    output.push(`You don't have a "${target}" in your inventory.`);
  }

  return { needsFurtherInput: false, output };
}

// Handle Action Triggers
function handleAction(command, currentArea) {
  if (!command.actionTrigger) return;
  command.actionTrigger.forEach(trigger => {
    if (trigger.action === 'setCondition') {
      const [path, subPath] = trigger.target.split('.areaId:');
      if (subPath.includes('.npcs.npcId:')) {
        const [areaId, npcPart] = subPath.split('.npcs.npcId:');
        const npcId = parseInt(npcPart);
        const area = areaData.find(a => a.areaId === parseInt(areaId));
        const npc = area.npcs.find(n => n.npcId === npcId);
        npc.conditions[trigger.condition] = trigger.value;
        console.log(`Set ${trigger.condition} = ${trigger.value} for NPC ${npc.name}`);
      } else if (subPath.includes('.items.itemId:')) {
        const [areaId, itemPart] = subPath.split('.items.itemId:');
        const itemId = parseInt(itemPart);
        const area = areaData.find(a => a.areaId === parseInt(areaId));
        const item = area.items.find(i => i.itemId === itemId);
        item.conditions[trigger.condition] = trigger.value;
        console.log(`Set ${trigger.condition} = ${trigger.value} for item ${item.name}`);
      } else if (subPath.includes('.secrets.secretId:')) {
        const [areaId, secretPart] = subPath.split('.secrets.secretId:');
        const secretId = parseInt(secretPart);
        const area = areaData.find(a => a.areaId === parseInt(areaId));
        const secret = area.secrets.find(s => s.secretId === secretId);
        secret.conditions[trigger.condition] = trigger.value;
        console.log(`Set ${trigger.condition} = ${trigger.value} for secret ${secret.name}`);
      } else {
        const area = areaData.find(a => a.areaId === parseInt(subPath));
        area.conditions[trigger.condition] = trigger.value;
        console.log(`Set ${trigger.condition} = ${trigger.value} for area ${area.name}`);
      }
    } else if (trigger.action === 'removeItem') {
      const [areaPath, itemPath] = trigger.target.split('.areaId:')[1].split('.items.itemId:');
      const area = areaData.find(a => a.areaId === parseInt(areaPath));
      const itemIndex = area.items.findIndex(i => i.itemId === parseInt(itemPath));
      area.items.splice(itemIndex, 1);
      console.log(`Removed item with ID ${itemPath} from area ${area.name}`);
    } else if (trigger.action === 'addItemToInventory') {
      addItemToInventory(trigger.item);
      // Only set pickedUp if the item was in the area
      const item = currentArea.items.find(i => i.name === trigger.item);
      if (item) {
        item.conditions.pickedUp = true;
        console.log(`Marked ${trigger.item} as picked up in area`);
      }
    } else if (trigger.action === 'setPlayerArea') {
      playerData.currentArea = trigger.areaId;
      console.log(`Moved player to area ${trigger.areaId}`);
    }
  });
}

// Main function for commands
function handleCommand(input, isSecondInput) {
  const currentArea = areaData.find(area => area.areaId === playerData.currentArea);
  if (!currentArea) return { needsFurtherInput: false, output: ['Invalid area.'] };

  const parsedCommands = parseCommands(currentArea);
  const { command, target, bestMatch } = parseCommand(input, parsedCommands, currentArea, checkCondition);

  if (!command) {
    return { needsFurtherInput: false, output: [`Unknown command: ${input}`] };
  }

  // Handle commands using the canonical command
  if (command === 'look') {
    const lookInput = target ? `${command} ${target}` : command;
    return handleLookCommand(lookInput, parsedCommands, currentArea);
  }

  if (command === 'go') {
    const goInput = target ? `${command} ${target}` : command;
    return handleGoCommand(goInput, currentArea, parsedCommands);
  }

  if (command === 'talk') {
    const talkInput = target ? `${command} ${target}` : command;
    return handleTalkCommand(talkInput, parsedCommands, currentArea, isSecondInput);
  }

  if (command === 'take') {
    const takeInput = target ? `${command} ${target}` : command;
    return handleTakeCommand(takeInput, parsedCommands, currentArea);
  }

  if (command === 'push') {
    const pushInput = target ? `${command} ${target}` : command;
    return handlePushCommand(pushInput, parsedCommands, currentArea);
  }

  if (command === 'pull') {
    const pullInput = target ? `${command} ${target}` : command;
    return handlePullCommand(pullInput, parsedCommands, currentArea);
  }

  if (command === 'inventory') {
    if (!target) {
      return { needsFurtherInput: false, output: displayInventory() };
    }
    return handleInventoryItem(`${command} ${target}`);
  }

  // Generic command handling with bestMatch (conditions already checked by parseCommand)
  if (bestMatch) {
    handleAction(bestMatch, currentArea);
    return { needsFurtherInput: false, output: [bestMatch.response] };
  }

  return { needsFurtherInput: false, output: [`Cannot understand "${input}".`] };
}

export { handleCommand, displayArea, checkCondition };
