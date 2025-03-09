import gameData from './data/gameData.json'; // Ensure correct path

const inventoryDescriptions = gameData.inventoryDescriptions;
const playerData = gameData.playerData;
const areaData = gameData.areas;

function displayArea(areaId) {
  const area = areaData.find(area => area.areaId === areaId);
  if (!area) return ['Area not found.'];

  let output = [area.description];

  // Append environmental additives
  if (area.environment?.additives) {
    area.environment.additives.forEach(additive => {
      if (checkCondition(additive.condition, area)) {
        output.push(additive.text);
      }
    });
  }

  // Add visible items
  const items = parseCommands(area).filter(c => c.command === 'look' && c.item);
  if (items.length > 0) {
    output.push("You see:");
    items.forEach(item => {
      if (!item.condition || checkCondition(item.condition, area)) {
        output.push(`- ${item.item}`);
      }
    });
  }

  // Add visible NPCs
    const npcs = parseCommands(area).filter(c => c.command === 'talk' && c.npc);
    if (npcs.length > 0) {
      output.push("Present:");
      npcs.forEach(npc => {
        if (!npc.condition || checkCondition(npc.condition, area)) {
          output.push(`- ${npc.npc}`);
        }
      });
    }

  return output;
}

function checkCondition(condition, currentArea) {
  // If no condition is provided, the action is allowed
  if (!condition) return true;

  // If condition is an array, all sub-conditions must be true (AND logic)
  if (Array.isArray(condition)) {
    return condition.every(subCondition => checkCondition(subCondition, currentArea));
  }

  // Handle different condition types
  if (condition.type === 'areaCondition') {
    return currentArea.conditions[condition.key] === condition.value;
  }
  if (condition.type === 'hasItem') {
    const item = playerData.inventory.find(i => i.name === condition.item);
    return item && item.quantity >= (condition.quantity || 1);
  }
  if (condition.type === 'playerCondition') {
    return playerData.conditions[condition.key] === condition.value;
  }
  if (condition.type === 'itemCondition') {
    const item = playerData.inventory.find(i => i.name === condition.item);
    return item && item.conditions[condition.key] === condition.value;
  }

  // If the condition type is unknown, fail safely
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

function lookAtItem(itemName) {
  const itemDescription = inventoryDescriptions.find(item => item.name === itemName);
  if (itemDescription) {
    const randomBlurb = itemDescription.lookBlurbs[Math.floor(Math.random() * itemDescription.lookBlurbs.length)];
    return [itemDescription.description, randomBlurb];
  }
  return [`You don't have a "${itemName}" in your inventory.`];
}

function parseCommands(currentArea) {
  let parsedCommands = [];
  // Exits
  currentArea.exits.commands?.forEach(cmd => parsedCommands.push({
    command: cmd.command,
    exit: cmd.command === 'go' ? cmd.command.split(' ')[1] || null : null, // Extract direction
    response: cmd.response,
    condition: cmd.condition,
    actionTrigger: cmd.actionTrigger
  }));
  // Items
  currentArea.items.forEach(item => item.commands.forEach(cmd => parsedCommands.push({
    command: cmd.command,
    item: item.name,
    response: cmd.response,
    condition: cmd.condition,
    actionTrigger: cmd.actionTrigger
  })));
  // NPCs
  currentArea.npcs.forEach(npc => npc.commands.forEach(cmd => parsedCommands.push({
    command: cmd.command,
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

  console.log(parsedCommands);
  return parsedCommands;
}

function handleLookCommand(input, parsedCommands, currentArea) {
  let output = [];
  const lookInput = input.toLowerCase().trim();

  // If just "look" is entered, show the full area description
  if (lookInput === 'look') {
    output = displayArea(currentArea.areaId);
    return { needsFurtherInput: false, output };
  }

  // Handle "look <target>" (e.g., "look golden coin")
  const target = lookInput.replace('look', '').trim();
  const lookableItems = parsedCommands.filter(c => c.command === 'look' && c.item?.toLowerCase() === target);
  const lookableSecrets = parsedCommands.filter(c => c.command === 'look' && c.secret?.toLowerCase() === target);

  if (lookableItems.length > 0) {
    const itemMatch = lookableItems[0]; // Take the first matching response
    if (!itemMatch.condition || checkCondition(itemMatch.condition)) {
      output.push(itemMatch.response || `You see nothing special about the ${target}.`);
    } else {
      output.push(`The ${target} is obscured and hard to see.`);
    }
  } else if (lookableSecrets.length > 0) {
    const secretMatch = lookableSecrets[0];
    if (!secretMatch.condition || checkCondition(secretMatch.condition)) {
      output.push(secretMatch.response || `You uncover the ${secretMatch.secret}.`);
    } else {
      output.push(`The secret remains hidden.`);
    }
  } else {
    output.push(`You don’t see "${target}" to look at.`);
  }

  return { needsFurtherInput: false, output };
}

  return {
    needsFurtherInput: false, // No more input needed
    output: output
  };
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
  const talkableNPCs = parsedCommands.filter(c => c.command === 'talk');
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
        output.push(`${npcMatch.npc} doesn’t want to talk right now.`);
      }
    } else {
      output.push(`You don’t see "${input}" here to talk to.`);
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

  const npcMatch = talkableNPCs.find(c => c.npc.toLowerCase() === npcName);
  if (npcMatch) {
    if (!npcMatch.condition || checkCondition(npcMatch.condition, currentArea)) {
      output.push(npcMatch.response);
    } else {
      output.push(`${npcMatch.npc} doesn’t want to talk right now.`);
    }
  } else {
    output.push(`You don’t see "${npcName}" here to talk to.`);
  }

  return { needsFurtherInput: false, output };
}

// Take command
function handleTakeCommand(input, parsedCommands, currentArea) {
  const takeableItems = parsedCommands.filter(c => c.command === 'take');
  let output = [];

  if (takeableItems.length > 0) {
    const itemName = input.split(' ')[1]?.toLowerCase();
    const item = currentArea.items.find(i => i.name.toLowerCase() === itemName);
    if (item) {
      if (!item.condition || checkCondition(item.condition, currentArea)) {
        addItemToInventory(item.name); // Use the standardized function
        const itemIndex = currentArea.items.indexOf(item);
        currentArea.items.splice(itemIndex, 1);
        output.push(`You take the ${itemName}.`);
      } else {
        output.push(`You cannot take the ${itemName} right now.`);
      }
    } else {
      output.push(`There is no ${itemName} here.`);
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
    if (trigger.type === 'area') {
      currentArea.completedAreaActions[trigger.action] = trigger.value;
    } else if (trigger.type === 'player') {
      playerData.completedActions[trigger.action] = trigger.value;
    } else if (trigger.action === 'setCondition') {
      const target = trigger.target === 'playerData' ? playerData.conditions : currentArea;
      target[trigger.condition] = trigger.value;
    } else if (trigger.action === 'removeItem') {
      const [areaPath, itemPath] = trigger.target.split('.areaId:')[1].split('.items.itemId:');
      const area = areaData.find(a => a.areaId === parseInt(areaPath));
      const itemIndex = area.items.findIndex(i => i.itemId === parseInt(itemPath));
      area.items.splice(itemIndex, 1);
    } else if (trigger.action === 'addItemToInventory') {
      addItemToInventory(trigger.item); // Replace manual push
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

  if (isSecondInput) {
    // Handle continued input (e.g., after "look")
    const lookableItems = parsedCommands.filter(c => c.command === 'look');
    if (input && lookableItems.length > 0) {
      const target = input.toLowerCase();
      const itemMatch = lookableItems.find(c => c.item?.toLowerCase() === target);
      const secretMatch = lookableItems.find(c => c.secret?.toLowerCase() === target);

      if (itemMatch) {
        if (!itemMatch.condition || checkCondition(itemMatch.condition, currentArea)) {
          output.push(`You examine the ${itemMatch.item}. It looks ${itemMatch.response || 'ordinary.'}`);
        } else {
          output.push(`The ${itemMatch.item} is obscured and hard to see.`);
        }
      } else if (secretMatch) {
        if (!secretMatch.condition || checkCondition(secretMatch.condition, currentArea)) {
          output.push(secretMatch.response || `You uncover the ${secretMatch.secret}.`);
        } else {
          output.push(`The secret remains hidden.`);
        }
      } else {
        output.push(`You don’t see a "${target}" to look at.`);
      }
    } else {
      output.push('Nothing to examine.');
    }
    return { needsFurtherInput: false, output };
  }

  if (input.toLowerCase() === 'look') {
    const lookResult = handleLookCommand(input, parsedCommands);
    return lookResult; // Already returns { needsFurtherInput: true, output }
  }

  if (input.toLowerCase() === 'go') {
    const goResult = handleGoCommand(input, parsedCommands, currentArea);
    return goResult;
  }

  else if (input.toLowerCase().startsWith('talk ')) {
    const talkResult = handleTalkCommand(input, parsedCommands, currentArea);
    return talkResult;
  }

  else if (input.toLowerCase().startsWith('take ')) {
    const takeResult = handleTakeCommand(input, parsedCommands, currentArea);
    return takeResult;
  }

  else if (input.toLowerCase().startsWith('push ')) {
    const pushResult = handlePushCommand(input, parsedCommands, currentArea);
    return pushResult;
  }

  else if (input.toLowerCase().startsWith('pull ')) {
    const pullResult = handlePullCommand(input, parsedCommands, currentArea);
    return pullResult;
  }

  if (input.toLowerCase().startsWith('inventory ')) {
    const target = input.toLowerCase().slice(10).trim(); // Corrected to slice(10) for "inventory "
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

  else {
    const command = parsedCommands.find(c => c.command.toLowerCase() === input.toLowerCase());
    if (command) {
      if (!command.condition || checkCondition(command.condition, currentArea)) {
        output.push(command.response);
        handleAction(command, currentArea);
      } else {
        output.push('You cannot do that right now.');
      }
    } else if (input.trim()) {
      output.push(`Unknown command: ${input}`);
    }
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
