import gameData from './data/gameData.json'; // Ensure correct path

const playerData = gameData.playerData;
const areaData = gameData.areas;

function displayArea(areaId) {
  const area = areaData.find(area => area.areaId === areaId);
  if (!area) return ['Area not found.'];

  let output = [];
  output.push(area.description);

  if (area.items.length > 0) {
    output.push('\nYou see ');
    area.items.forEach(item => output.push(` ${item.description}`));
  }

  if (area.npcs.length > 0) {
    area.npcs.forEach(npc => output.push(`${npc.description}`));
  }

  /*
  output.push(`\nYou are in: ${area.name}`);
  output.push(area.description);

  if (area.items.length > 0) {
    output.push('\nItems here:');
    area.items.forEach(item => output.push(`- ${item.name}: ${item.description}`));
  }

  if (area.npcs.length > 0) {
    output.push('\nNPCs here:');
    area.npcs.forEach(npc => output.push(`- ${npc.name}: ${npc.description}`));
  }

  output.push('\nCommands available:');
  const allCommands = [
    ...area.exits.commands, 
    ...area.items.flatMap(i => i.commands), 
    ...area.npcs.flatMap(n => n.commands), 
    ...area.secrets.flatMap(s => s.commands)
  ];
  allCommands.forEach(command => output.push(`- ${command.command}: ${command.description}`));
*/

  return output;
}

function parseCommands(currentArea) {
  let parsedCommands = [];

  // Parse exits
  if (currentArea.exits) {
    for (let exit in currentArea.exits) {
      parsedCommands.push({
        command: 'go',
        exit: exit,
        destination: currentArea.exits[exit]
      });
    }
  }

  // Parse items
  currentArea.items.forEach(item => {
    parsedCommands.push({
      command: 'look',
      item: item.name,
      description: item.description,
      condition: item.conditions ? item.conditions : null
    });

    parsedCommands.push({
      command: 'take',
      item: item.name,
      condition: item.conditions ? item.conditions : null
    });
  });

  // Parse NPCs
  currentArea.npcs.forEach(npc => {
    parsedCommands.push({
      command: 'talk',
      npc: npc.name,
      dialogue: npc.dialogue,
      condition: null
    });
  });

  // Parse secrets
  currentArea.secrets.forEach(secret => {
    parsedCommands.push({
      command: 'look',
      secret: secret.name,
      description: secret.description,
      condition: secret.conditions ? secret.conditions : null
    });
  });

  console.log(parsedCommands);
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
    const itemName = input.split(' ')[1];
    const item = currentArea.items.find(i => i.name.toLowerCase() === itemName.toLowerCase());

    if (item) {
      // Check if the item has a condition
      if (!item.condition || checkCondition(item.condition)) {
        // Check if the player already has the item in their inventory
        const existingItem = playerData.inventory.find(i => i.item.toLowerCase() === itemName.toLowerCase());
        if (existingItem) {
          existingItem.quantity += item.quantity;  // Increase the quantity of the existing item
        } else {
          // Add the item to the inventory
          playerData.inventory.push({
            item: item.name,
            quantity: item.quantity,
            description: item.description,
            conditions: item.conditions || []
          });
        }

        // Remove the item from the current area
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

  return {
    needsFurtherInput: false, // No further input needed for the 'take' command
    output: output
  };
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

  // Check for other commands
  else {
    const command = parsedCommands.find(c => c.command.toLowerCase() === input);
    if (command) {
      if (!command.condition || checkCondition(command.condition)) {
        output.push(command.response || `You perform the action: ${input}.`);
        handleAction(command, currentArea);
      } else {
        output.push('You cannot do that right now.');
      }
    } else {
      output.push(`Unknown command: "${input}".`);
    }
  }

  return {
    needsFurtherInput: false, // No more input needed unless indicated
    output: output
  };
}


export { handleCommand, displayArea };
