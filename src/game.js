import gameData from './data/gameData.json'; // Ensure correct path

const inventoryDescriptions = gameData.inventoryDescriptions;
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
  const itemDescription = inventoryDescriptions.find(item => item.name === itemName);
  if (itemDescription) {
    const newItem = {
      name: itemDescription.name,
      conditions: { ...itemDescription.defaultConditions } // Copy default conditions
    };
    playerData.inventory.push(newItem);
  } else {
    console.error(`Item "${itemName}" not found in inventoryDescriptions.`);
  }
}

// Look at item in inventory
function lookAtItem(itemName) {
  const itemDescription = inventoryDescriptions.find(item => item.name === itemName);
  if (itemDescription) {
    const randomBlurb = itemDescription.lookBlurbs[Math.floor(Math.random() * itemDescription.lookBlurbs.length)];
    return [itemDescription.description, randomBlurb];
  }
  return [`You don't have a "${itemName}" in your inventory.`];
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
    command:`${cmd.command} ${item.name.toLowerCase()}`,
    target: item.name,
    type: 'item',
    response: cmd.response,
    condition: cmd.condition,
    actionTrigger: cmd.actionTrigger
  })));

  // NPCs
  currentArea.npcs.forEach(npc => npc.commands.forEach(cmd => parsedCommands.push({
    command:`${cmd.command} ${npc.name.toLowerCase()}`,
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
function handleTalkCommand(input, parsedCommands, currentArea, isSecondInput = false) {
  const talkableNPCs = parsedCommands.filter(c => c.command.startsWith('talk '));
  console.log('Talkable NPCs:', talkableNPCs.map(npc => npc.npc));
  let output = [];

  if (!talkableNPCs.length) {
    output.push('There is no one to talk to here.');
    return { needsFurtherInput: false, output };
  }

  if (isSecondInput) {
    const npcName = input.trim().toLowerCase();
    const npcMatch = talkableNPCs.find(c => c.npc.toLowerCase() === npcName);
    if (npcMatch) {
      if (!npcMatch.condition || checkCondition(npcMatch.condition, currentArea)) {
        output.push(npcMatch.response);
      } else {
        output.push(`${npcMatch.npc} doesn't want to talk right now.`);
      }
    } else {
      output.push(`You don't see "${input}" here to talk to.`);
    }
    return { needsFurtherInput: false, output };
  }

  const npcName = input.toLowerCase().replace('talk', '').trim();
  if (!npcName) {
    output.push('Who would you like to talk to?');
    talkableNPCs.forEach(npc => {
      if (!npc.condition || checkCondition(npc.condition, currentArea)) {
        output.push(`- ${npc.npc}`);
      }
    });
    return { needsFurtherInput: true, output };
  }

  const npcMatch = talkableNPCs.filter(c => c.npc.toLowerCase() === npcName);
  if (npcMatch.length > 0) {
    const validMatch = npcMatch.find(c => !c.condition || checkCondition(c.condition, currentArea));
    if (validMatch) {
      output.push(validMatch.response);
      handleAction(validMatch, currentArea);
    } else {
      output.push(`${npcName} doesn't want to talk right now.`);
    }
  } else {
    output.push(`You don't see "${npcName}" here to talk to.`);
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
      } else {
        const area = areaData.find(a => a.areaId === parseInt(subPath));
        area.conditions[trigger.condition] = trigger.value;
      }
    } else if (trigger.action === 'removeItem') {
      const [areaPath, itemPath] = trigger.target.split('.areaId:')[1].split('.items.itemId:');
      const area = areaData.find(a => a.areaId === parseInt(areaPath));
      const itemIndex = area.items.findIndex(i => i.itemId === parseInt(itemPath));
      area.items.splice(itemIndex, 1);
    } else if (trigger.action === 'addItemToInventory') {
      addItemToInventory(trigger.item);
      const item = currentArea.items.find(i => i.name === trigger.item);
        if (item) item.conditions.pickedUp = true; // Sync JSON
    } else if (trigger.action === 'setPlayerArea') {
      playerData.currentArea = trigger.areaId;
    }
  });
}

// Main function for commands
function handleCommand(input, isSecondInput) {
  const currentArea = areaData.find(area => area.areaId === playerData.currentArea);
  if (!currentArea) return { needsFurtherInput: false, output: ['Invalid area.'] };

  let output = [];

  // Parse the current area's commands
  const parsedCommands = parseCommands(currentArea);

  // Handle "look" and "look <target>"
  if (input.toLowerCase().startsWith('look')) {
    const lookResult = handleLookCommand(input, parsedCommands, currentArea);
    return lookResult;
  }

  // Handle "go"
  if (input.toLowerCase().startsWith('go')) {
    const goResult = handleGoCommand(input, parsedCommands, currentArea);
    return goResult;
  }

  // Handle "talk" and "talk <target>"
  if (input.toLowerCase().startsWith('talk')) {
    const talkResult = handleTalkCommand(input, parsedCommands, currentArea);
    return talkResult;
  }

  // Handle "take <target>"
  if (input.toLowerCase().startsWith('take')) {
    const takeResult = handleTakeCommand(input, parsedCommands, currentArea);
    return takeResult;
  }

  // Handle "push <target>"
  if (input.toLowerCase().startsWith('push')) {
    const pushResult = handlePushCommand(input, parsedCommands, currentArea);
    return pushResult;
  }

  // Handle "pull <target>"
  if (input.toLowerCase().startsWith('pull')) {
    const pullResult = handlePullCommand(input, parsedCommands, currentArea);
    return pullResult;
  }

  // Handle "inventory <target>"
  if (input.toLowerCase().startsWith('inventory ')) {
    const target = input.toLowerCase().slice(10).trim();
    const invCommand = parsedCommands.find(c => c.command === `inventory ${target}` && c.type === 'inventory');
    if (invCommand) {
      const invItem = inventoryDescriptions.find(i => i.name.toLowerCase() === target);
      if (invItem && invItem.lookBlurbs?.length) {
        const randomBlurb = invItem.lookBlurbs[Math.floor(Math.random() * invItem.lookBlurbs.length)];
        output.push(invItem.description);
        output.push(randomBlurb);
      } else {
        output.push(invItem?.description || `You see nothing special about the ${target}.`);
      }
      return { needsFurtherInput: false, output };
    }
  }

  // Generic command handling
  const command = parsedCommands.find(c => c.command.toLowerCase() === input.toLowerCase());
  if (command) {
    if (!command.condition || checkCondition(command.condition, currentArea, command.target)) {
      output.push(command.response);
      handleAction(command, currentArea);
    } else {
      output.push('You cannot do that right now.');
    }
  } else if (input.trim()) {
    output.push(`Unknown command: ${input}`);
  }

  return { needsFurtherInput: false, output };
}

// Display inventory
function displayInventory() {
  if (!playerData.inventory.length) return ['Your inventory is empty.'];

  const output = ['\nYour inventory:'];
  playerData.inventory.forEach(item => {
    const invItem = inventoryDescriptions.find(i => i.name === item.name);
    if (invItem) {
      output.push(`- ${invItem.description}`);
    }
  });
  return output;
}


export { handleCommand, displayArea };
