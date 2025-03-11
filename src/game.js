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

  const output = [area.description];

  // Environmental additives
  if (area.environment?.additives) {
    area.environment.additives.forEach(additive => {
      if (!additive.condition || checkCondition(additive.condition, area)) {
        output.push(additive.text);
      }
    });
  }

  // Items, NPCs, secrets
  const parsedItemsNpcs = parseItemsNpcs(area);
  if (parsedItemsNpcs.length > 0) {
    output.push("You see:");

    const entityGroups = parsedItemsNpcs.reduce((acc, entity) => {
      acc[entity.name] = acc[entity.name] || [];
      acc[entity.name].push(entity);
      return acc;
    }, {});

    for (const name in entityGroups) {
      const entity = entityGroups[name][0]; // First entity per name
      if (entity.conditions?.isHidden || entity.conditions?.isInvisible) {
        console.log(`Skipped ${entity.name} (${entity.conditions.isHidden ? 'hidden' : 'invisible'})`);
        continue;
      }

      let fullResponse = `- ${entity.name}: ${entity.description}`;
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
    console.log(`Item ${itemName} conditions:`, item?.conditions);
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

  console.log(parsedItemsNpcs);
  return parsedItemsNpcs;
}

// Create an array for each area to dip into to see what's available from the JSON
function parseCommands(currentArea) {
  let parsedCommands = [];

  // Exits
  currentArea.exits.commands?.forEach(cmd => parsedCommands.push({
    command: cmd.command,
    target: cmd.command.startsWith('go') ? cmd.command.split(' ')[1] || null : null,
    type: 'exit',
    response: cmd.response,
    condition: cmd.condition,
    actionTrigger: cmd.actionTrigger
  }));

  // Items
  currentArea.items.forEach(item => item.commands.forEach(cmd => parsedCommands.push({
    command: `${cmd.command} ${item.name.toLowerCase()}`,
    target: item.name,
    type: 'item',
    response: cmd.response,
    condition: cmd.condition,
    actionTrigger: cmd.actionTrigger
  })));

  // NPCs
  const npcCommands = {};
  currentArea.npcs.forEach(npc => {
    npc.commands.forEach(cmd => {
      const command = `${cmd.command} ${npc.name.toLowerCase()}`;
      if (!npcCommands[npc.name]) npcCommands[npc.name] = [];
      npcCommands[npc.name].push({
        command,
        target: npc.name,
        type: 'npc',
        response: cmd.response,
        condition: cmd.condition,
        actionTrigger: cmd.actionTrigger
      });
    });
  });
  Object.values(npcCommands).forEach(commands => parsedCommands.push(...commands));

  // Secrets
  currentArea.secrets.forEach(secret => secret.commands.forEach(cmd => parsedCommands.push({
    command: cmd.command,
    target: cmd.target || secret.name,  // Use cmd.target if provided, else secret.name
    type: 'secret',
    response: cmd.response,
    condition: cmd.condition,
    actionTrigger: cmd.actionTrigger,
    priority: cmd.priority  // Include priority for sorting in handleLookCommand
  })));

  // Inventory
  playerData.inventory.forEach(item => {
    parsedCommands.push({
      command: `inventory ${item.name.toLowerCase()}`,
      target: item.name,
      type: 'inventory',
      response: null, // Handled by handleInventoryItem
      condition: null
    });
  });

  // Generic commands
  parsedCommands.push({
    command: 'look',
    target: null,
    type: 'generic',
    response: 'You look around you.',
    actionTrigger: null
  });

  parsedCommands.push({
    command: 'inventory',
    target: null,
    type: 'generic',
    response: 'Your inventory:',
    actionTrigger: null
  });

  console.log('Parsed Commands:', parsedCommands);
  return parsedCommands;
}


function handleLookCommand(input, parsedCommands, currentArea) {
  const output = [];
  const lookTarget = input.toLowerCase().slice(4).trim();

  if (!lookTarget) {
    output.push("You look around you.");
    output.push(...displayArea(currentArea.areaId));
    return { needsFurtherInput: false, output };
  }

  const lookMatches = parsedCommands.filter(c => 
    c.command.startsWith('look') && c.target && 
    c.target.toLowerCase().includes(lookTarget)
  );

  // Check all conditions and if multiple commands have all conditions met...
  // Sort by priority
  const validMatch = lookMatches
  .filter(c => !c.condition || checkCondition(c.condition, currentArea, c.target))
  .sort((a, b) => (b.priority || 0) - (a.priority || 0))[0];

  if (validMatch) {
    output.push(validMatch.response || `You see nothing special about the ${lookTarget}.`);
    handleAction(validMatch, currentArea);
  } else if (lookMatches.length > 0) {
    output.push(`You can't look at "${lookTarget}" right now.`);
  } else {
    const secretMatch = parsedCommands.find(c => 
      c.command.startsWith('look') && c.type === 'secret' && 
      c.target.toLowerCase().includes(lookTarget)
    );
    output.push(secretMatch ? "The secret remains hidden." : `You don't see "${lookTarget}" to look at.`);
  }

  return { needsFurtherInput: false, output };
}

// Go command
function handleGoCommand(input, parsedCommands, currentArea) {
  const output = [];
  const goTarget = input.toLowerCase().slice(3).trim();

  if (!goTarget) {
    output.push('Which direction would you like to go?');
    const availableExits = parsedCommands
      .filter(c => c.command.startsWith('go') && c.target)
      .map(c => c.target);
    if (availableExits.length > 0) {
      output.push('Available directions:');
      availableExits.forEach(exit => output.push(`- ${exit}`));
    }
    return { needsFurtherInput: true, output };
  }

  const goMatches = parsedCommands.filter(c => 
    c.command.startsWith('go') && c.target && 
    c.target.toLowerCase().includes(goTarget)
  );
  const validMatch = goMatches.find(c => 
    !c.condition || checkCondition(c.condition, currentArea, c.target)
  );

  if (validMatch) {
    output.push(validMatch.response);
    handleAction(validMatch, currentArea);
  } else {
    output.push(`You can’t go "${goTarget}" from here.`);
  }

  return { needsFurtherInput: false, output };
}

// Talk command
function handleTalkCommand(input, parsedCommands, currentArea, isSecondInput) {
  const output = [];
  const talkTarget = input.toLowerCase().slice(5).trim();

  if (!talkTarget) {
    output.push('Who would you like to talk to?');
    const uniqueNpcs = [...new Set(parsedCommands
      .filter(c => c.command.startsWith('talk') && c.target)
      .map(c => c.target))];
    if (uniqueNpcs.length > 0) {
      uniqueNpcs.forEach(npc => output.push(`- ${npc}`));
    }
    return { needsFurtherInput: true, output };
  }

  // Find all talk commands for the target
  const talkMatches = parsedCommands.filter(c => 
    c.command.startsWith('talk') && c.target && 
    c.target.toLowerCase().includes(talkTarget)
  );
  console.log('talkMatches:', talkMatches.map(m => ({ command: m.command, target: m.target, type: m.type, condition: m.condition })));

  // Pick the first match where condition passes (or no condition)
  const validMatch = talkMatches.find(c => 
    !c.condition || checkCondition(c.condition, currentArea, c.target)
  );

  if (validMatch) {
    output.push(validMatch.response);
    handleAction(validMatch, currentArea);
  } else if (talkMatches.length > 0) {
    output.push(`"${talkTarget}" doesn't want to talk right now.`);
  } else {
    output.push(`You don't see "${talkTarget}" here to talk to.`);
  }

  console.log('talkMatches:', talkMatches);
  console.log('validMatch:', validMatch);
  return { needsFurtherInput: false, output };
}

// Take command
function handleTakeCommand(input, parsedCommands, currentArea) {
  const output = [];
  const takeTarget = input.toLowerCase().slice(5).trim();

  const takeMatches = parsedCommands.filter(c => 
    c.command.startsWith('take') && c.target && 
    c.target.toLowerCase().includes(takeTarget)
  );
  const validMatch = takeMatches.find(c => 
    !c.condition || checkCondition(c.condition, currentArea, c.target)
  );

  if (validMatch) {
    output.push(validMatch.response);
    handleAction(validMatch, currentArea);
  } else {
    output.push(`There’s nothing matching "${takeTarget}" to take here.`);
  }

  return { needsFurtherInput: false, output };
}

// Push command
function handlePushCommand(input, parsedCommands, currentArea) {
  const output = [];
  const pushTarget = input.toLowerCase().slice(5).trim();
  const validMatch = parsedCommands.find(c => 
    c.command.startsWith('push') && 
    (!c.condition || checkCondition(c.condition, currentArea, c.target))
  );
  if (validMatch) {
    output.push(validMatch.response);
    handleAction(validMatch, currentArea);
  } else {
    output.push(`There’s nothing to push here.`);
  }
  return { needsFurtherInput: false, output };
}

// Pull command
function handlePullCommand(input, parsedCommands, currentArea) {
  const output = [];
  const fullCommand = input.toLowerCase().trim();
  const pullMatches = parsedCommands.filter(c => c.command === fullCommand);
  const validMatch = pullMatches
    .filter(c => !c.condition || checkCondition(c.condition, currentArea, c.target))
    .sort((a, b) => (b.priority || 0) - (a.priority || 0))[0];
  if (validMatch) {
    output.push(validMatch.response);
    handleAction(validMatch, currentArea);
  } else {
    output.push(`There’s nothing to pull here.`);
  }
  return { needsFurtherInput: false, output };
}

function handlePressCommand(input, parsedCommands, currentArea) {
  const output = [];
  const fullCommand = input.toLowerCase().trim();
  const pressMatches = parsedCommands.filter(c => c.command === fullCommand);
  const validMatch = pressMatches
    .filter(c => !c.condition || checkCondition(c.condition, currentArea, c.target))
    .sort((a, b) => (b.priority || 0) - (a.priority || 0))[0];
  if (validMatch) {
    output.push(validMatch.response);
    handleAction(validMatch, currentArea);
  } else {
    output.push(`There’s nothing to press here.`);
  }
  return { needsFurtherInput: false, output };
}

function handleUseCommand(input, parsedCommands, currentArea) {
  const output = [];
  const fullCommand = input.toLowerCase().trim();
  const useMatches = parsedCommands.filter(c => c.command === fullCommand);
  const validMatch = useMatches
    .filter(c => !c.condition || checkCondition(c.condition, currentArea, c.target))
    .sort((a, b) => (b.priority || 0) - (a.priority || 0))[0];
  if (validMatch) {
    output.push(validMatch.response);
    handleAction(validMatch, currentArea);
  } else {
    output.push(`You can’t use "${fullCommand.slice(4).trim()}" here.`);
  }
  return { needsFurtherInput: false, output };
}

function handlePlaceCommand(input, parsedCommands, currentArea) {
  const output = [];
  const fullCommand = input.toLowerCase().trim();
  const placeMatches = parsedCommands.filter(c => c.command === fullCommand);
  const validMatch = placeMatches
    .filter(c => !c.condition || checkCondition(c.condition, currentArea, c.target))
    .sort((a, b) => (b.priority || 0) - (a.priority || 0))[0];
  if (validMatch) {
    output.push(validMatch.response);
    handleAction(validMatch, currentArea);
  } else {
    output.push(`There’s nowhere to place "${fullCommand.slice(6).trim()}" here.`);
  }
  return { needsFurtherInput: false, output };
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
  console.log('handleCommand:', { input, currentArea: currentArea?.areaId, isSecondInput });
  if (!currentArea) return { needsFurtherInput: false, output: ['Invalid area.'] };

  const parsedCommands = parseCommands(currentArea);
  const { command, target, bestMatch } = parseCommand(input, parsedCommands, currentArea, checkCondition);

  if (!command) {
    return { needsFurtherInput: false, output: [`Unknown command: ${input}`] };
  }

  switch (command) {
    case 'look':
      return handleLookCommand(input, parsedCommands, currentArea);
    case 'go':
      return handleGoCommand(input, parsedCommands, currentArea);
    case 'talk':
      return handleTalkCommand(input, parsedCommands, currentArea, isSecondInput);
    case 'take':
      return handleTakeCommand(input, parsedCommands, currentArea);
    case 'push':
      return handlePushCommand(input, parsedCommands, currentArea);
    case 'pull':
      return handlePullCommand(input, parsedCommands, currentArea);
    case 'inventory':
      if (!target) return { needsFurtherInput: false, output: displayInventory() };
      return handleInventoryItem(`${command} ${target}`);
    case 'press':
      return handlePressCommand(input, parsedCommands, currentArea);
    case 'use':
      return handleUseCommand(input, parsedCommands, currentArea);
    case 'place':
      return handlePlaceCommand(input, parsedCommands, currentArea);
    default:
      if (bestMatch) {
        handleAction(bestMatch, currentArea);
        return { needsFurtherInput: false, output: [bestMatch.response] };
      }
      return { needsFurtherInput: false, output: [`Command "${command}" not implemented yet.`] };
  }
}

export { handleCommand, displayArea, checkCondition };
