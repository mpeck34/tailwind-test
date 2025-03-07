import gameData from './data/gameData.json'; // Ensure correct path

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

  if (area.items?.length > 0) {
    output.push('\nYou see:');
    area.items.forEach(item => output.push(`- ${item.description}`));
  }

  if (area.npcs?.length > 0) {
    output.push('\nPresent:');
    area.npcs.forEach(npc => output.push(`- ${npc.description}`));
  }

  return output;
}

// To check if a condition is fulfilled before an action -- needs update
function checkCondition(condition, currentArea) {
  if (!condition) return true;
  for (const [key, value] of Object.entries(condition)) {
    if (key === 'type' && condition.type === 'area') {
      return currentArea.conditions[condition[key]] === value;
    }
    if (key === 'type' && condition.type === 'hasItem') {
      const item = playerData.inventory.find(i => i.name === condition.item);
      return item && item.quantity >= (condition.quantity || 1);
    }
    return (currentArea?.conditions?.[key] === value) || 
           (playerData?.conditions?.[key] === value) || 
           false;
  }
}

function parseCommands(currentArea) {
  let parsedCommands = [];
  // Exits
  currentArea.exits.commands?.forEach(cmd => parsedCommands.push({
    command: cmd.command,
    response: cmd.response,
    condition: cmd.condition,
    actionTrigger: cmd.actionTrigger
  }));
  // Items
  currentArea.items.forEach(item => item.commands.forEach(cmd => parsedCommands.push({
    command: cmd.command,
    item: item.name,
    response: cmd.response,
    condition: cmd.conditions,
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
    condition: cmd.conditions,
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

  return parsedCommands;
}

function handleLookCommand(input, parsedCommands) {
  const lookableItems = parsedCommands.filter(c => c.command === 'look');
  let output = [];

  if (lookableItems.length > 0) {
    output.push('What would you like to look at?');
    
    // Check each lookable item and secret for conditions
    lookableItems.forEach(item => {
      if (item.item) {
        // If the item has a condition, check if it's met
        if (!item.condition || checkCondition(item.condition)) {
          output.push(item.item);
        } else {
          output.push(`The ${item.item} is obscured.`);
        }
      }

      if (item.secret) {
        // If the secret has a condition, check if it's met
        if (!item.condition || checkCondition(item.condition)) {
          output.push(item.secret);
        } else {
          output.push(`The secret is hidden.`);
        }
      }
    });

    return {
      needsFurtherInput: true,  // Indicate that we expect more input
      output: output
    };
  } else {
    output.push('There is nothing to look at.');
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
    // Find the exit command from parsedCommands
    const goCommand = parsedCommands.find(command => command.command === 'go' && command.exit === direction);

    if (goCommand) {
      // Check if there are conditions for the exit
      if (goCommand.condition && !checkCondition(goCommand.condition)) {
        output.push(`You cannot go ${direction} right now.`);
      } else {
        const exit = currentArea.exits[direction];
        if (exit) {
          const targetArea = areaData.find(area => area.areaId === exit);
          if (targetArea) {
            playerData.currentArea = targetArea.areaId;
            output.push(`You go ${direction} to the ${targetArea.name}.`);
          } else {
            output.push(`You can't go that way.`);
          }
        } else {
          output.push(`There is no exit in that direction.`);
        }
      }
    } else {
      output.push(`You can't go in that direction.`);
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
function handleTalkCommand(input, parsedCommands, currentArea) {
  const talkableNPCs = parsedCommands.filter(c => c.command === 'talk');
  let output = [];

  if (talkableNPCs.length > 0) {
    const npcName = input.split(' ')[1];
    const npc = currentArea.npcs.find(n => n.name.toLowerCase() === npcName.toLowerCase());

    if (npc) {
      // Check if NPC has a condition to talk
      if (!npc.condition || checkCondition(npc.condition)) {
        output.push(`${npc.name} says: ${npc.dialogue.join(' ')}`);
      } else {
        output.push(`${npc.name} doesn't want to talk right now.`);
      }
    } else {
      output.push(`You don't see a ${npcName} here.`);
    }
  } else {
    output.push('There is no one to talk to here.');
  }

  return {
    needsFurtherInput: false, // No further input needed for the 'talk' command
    output: output
  };
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
        const existingItem = playerData.inventory.find(i => i.name.toLowerCase() === itemName);
        const invItemTemplate = gameData.inventoryItems.find(i => i.name.toLowerCase() === itemName);
        if (existingItem) {
          existingItem.quantity += item.quantity || 1;
        } else {
          playerData.inventory.push({
            name: item.name,
            quantity: item.quantity || 1,
            conditions: invItemTemplate?.conditions || item.conditions || {}
          });
        }
        const itemIndex = currentArea.items.indexOf(item);
        currentArea.items.splice(itemIndex, 1);
        output.push(`You take the ${itemName}.`);
      } else {
        output.push(`You can't take the ${itemName} right now.`);
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
      if (!object.condition || checkCondition(object.condition)) {
        // If the object is pushable, provide feedback
        output.push(`You push the ${objectName}, but nothing happens.`);
      } else {
        output.push(`You can't push the ${objectName} right now.`);
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
      if (!object.condition || checkCondition(object.condition)) {
        // If the object is pullable, provide feedback
        output.push(`You pull the ${objectName}, but nothing happens.`);
      } else {
        output.push(`You can't pull the ${objectName} right now.`);
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
    }
  });
}

// Main function for commands
function handleCommand(input, isSecondInput) {
  const currentArea = areaData.find(area => area.areaId === playerData.currentArea);
  if (!currentArea) return ['Invalid area.'];

  let output = [];

  // Parse the current area's commands
  const parsedCommands = parseCommands(currentArea);

  // Handle 'look' command
  if (input.toLowerCase() === 'look') {
    const lookResult = handleLookCommand(input, parsedCommands);
    output = lookResult.output;
    if (lookResult.needsFurtherInput) {
      return {
        needsFurtherInput: true,
        output: output
      };
    }
  }

  // Handle 'go' command
  if (input.toLowerCase() === 'go') {
    const goResult = handleGoCommand(input, parsedCommands, currentArea);
    output = goResult.output;
    if (goResult.needsFurtherInput) {
      return {
        needsFurtherInput: true,
        output: output
      };
    }
  }

  // Handle 'talk' command
  else if (input.toLowerCase().startsWith('talk ')) {
    const talkResult = handleTalkCommand(input, parsedCommands, currentArea);
    output = talkResult.output;
  }

  // Handle 'take' command
  else if (input.toLowerCase().startsWith('take ')) {
    const takeResult = handleTakeCommand(input, parsedCommands, currentArea);
    output = takeResult.output;
  }

  // Handle 'push' command
  else if (input.toLowerCase().startsWith('push ')) {
    const pushResult = handlePushCommand(input, parsedCommands, currentArea);
    output = pushResult.output;
  }

  // Handle 'pull' command
  else if (input.toLowerCase().startsWith('pull ')) {
    const pullResult = handlePullCommand(input, parsedCommands, currentArea);
    output = pullResult.output;
  }

  // Handle inventory look
  if (input.toLowerCase().startsWith('inventory ')) {
    const target = input.toLowerCase().slice(5); // Remove "inventory "
    const invCommand = parsedCommands.find(c => c.command === `inventory ${target}` && c.type === 'inventory');
    if (invCommand) {
      const invItem = gameData.inventoryItems.find(i => i.name.toLowerCase() === target);
      if (invItem && invItem.lookBlurbs?.length) {
        const randomBlurb = invItem.lookBlurbs[Math.floor(Math.random() * invItem.lookBlurbs.length)];
        output.push(randomBlurb);
      } else {
        output.push(invItem?.description || `You see nothing special about the ${target}.`);
      }
      return { needsFurtherInput: false, output };
    }
  }

  // Check for other commands
  else {
    const command = parsedCommands.find(c => c.command.toLowerCase() === input.toLowerCase());
    if (command) {
      if (!command.condition || checkCondition(command.condition)) {
        output.push(command.response);
        handleAction(command, currentArea);
      } else {
        output.push('You cannot do that right now.');
      }
    }
  }

  return {
    needsFurtherInput: false, // No more input needed unless indicated
    output: output
  };
}

// Display inventory
function displayInventory() {
  if (!playerData.inventory.length) return ['Your inventory is empty.'];

  const output = ['\nYour inventory:'];
  playerData.inventory.forEach(item => {
    const invItem = gameData.inventoryItems.find(i => i.name === item.name);
    if (invItem) {
      output.push(`- ${invItem.description}`);
    }
  });
  return output;
}


export { handleCommand, displayArea };
