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
      if (entity.state?.isHidden || entity.state?.isInvisible) {
        console.log(`Skipped ${entity.name} (${entity.state.isHidden ? 'hidden' : 'invisible'})`);
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
    const hasItem = playerData?.inventory?.some(i => i.name === condition.item) ?? false;
    console.log(`Checking if player has "${condition.item}": ${hasItem}`);
    return hasItem;
  }
  if (condition.type === 'doesNotHaveItem') {
    return !(playerData?.inventory?.some(i => i.name === condition.item)) ?? false;
  }
  if (condition.type === 'playerState') {
    const value = playerData?.playerState?.[condition.key] ?? false;
    return value === condition.value;
  }
  if (condition.type === 'npcState') {
    const npc = currentArea?.npcs?.find(n => n.name === condition.npc);
    const value = npc?.npcState?.[condition.key] ?? false;
    return value === condition.value;
  }
  if (condition.type === 'itemState') {
    const item = currentArea?.items?.find(i => i.name === itemName);
    console.log(`Checking itemState for ${itemName}: ${condition.key}=${condition.value}, actual=${item?.itemState?.[condition.key]}`);
    console.log(`Item ${itemName} itemState:`, item?.itemState);
    const value = item?.itemState?.[condition.key] ?? false;
    console.log(`Checking ${condition.key}: ${value} for ${itemName}, Item: ${JSON.stringify(item?.itemState)}`);
    return value === condition.value;
  }
  if (condition.type === 'secretState') {
    const secret = currentArea?.secrets?.find(s => s.name === itemName);
    const value = secret?.secretState?.[condition.key] ?? false;
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
          conditions: { ...itemDescription.defaultStates } //assume default! Check beacuse currently no states or conditions in invdesc
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
      state: item.itemState,
      interactions: item.interactions
    });
  });

  // NPCs
  currentArea.npcs.forEach(npc => {
    parsedItemsNpcs.push({
      type: 'npc',
      name: npc.name,
      description: npc.description,
      state: npc.npcState,
      interactions: npc.interactions
    });
  });

  // Secrets
  currentArea.secrets.forEach(secret => {
    parsedItemsNpcs.push({
      type: 'secret',
      name: secret.name,
      description: secret.description,
      state: secret.secretState,
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


function handleLookCommand(input, parsedCommands, currentArea, target, bestMatch) {
  const output = [];

  if (!target) {
    output.push("You look around you.");
    output.push(...displayArea(currentArea.areaId));
    return { needsFurtherInput: false, output };
  }

  let validMatch = null;
  if (bestMatch && bestMatch.command.startsWith('look') && 
      bestMatch.target && bestMatch.target.toLowerCase().includes(target.toLowerCase()) &&
      (!bestMatch.condition || checkCondition(bestMatch.condition, currentArea, bestMatch.target))) {
    validMatch = bestMatch;
    console.log(`Using bestMatch: ${bestMatch.command} (target: ${bestMatch.target}, priority: ${bestMatch.priority || 0})`);
  } else {
    console.log(`bestMatch invalid or missing: ${bestMatch ? bestMatch.command : 'none'}`);
    const lookMatches = parsedCommands.filter(c => 
      c.command.startsWith('look') && c.target && 
      c.target.toLowerCase().includes(target.toLowerCase())
    );
    validMatch = lookMatches
      .filter(c => !c.condition || checkCondition(c.condition, currentArea, c.target))
      .sort((a, b) => (b.priority || 0) - (a.priority || 0))[0];
    console.log(`Fallback selected: ${validMatch ? validMatch.command : 'none'} (target: ${validMatch?.target || 'none'}, priority: ${validMatch?.priority || 0})`);
  }

  if (validMatch) {
    output.push(validMatch.response || `You see nothing special about the ${target}.`);
    handleAction(validMatch, currentArea);
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
function handleTalkCommand(input, parsedCommands, currentArea, target, bestMatch) {
  const output = [];

  if (!target) {
    output.push("Who would you like to talk to?");
    const uniqueNpcs = [...new Set(parsedCommands
      .filter(c => c.command.startsWith('talk') && c.target && 
                   (!c.condition || checkCondition(c.condition, currentArea, c.target)))
      .map(c => c.target))];
    if (uniqueNpcs.length > 0) {
      uniqueNpcs.forEach(npc => output.push(`- ${npc}`));
    }
    return { needsFurtherInput: false, output };
  }

  let validMatch = null;
  if (bestMatch && bestMatch.command.startsWith('talk') && 
      bestMatch.target && bestMatch.target.toLowerCase().includes(target.toLowerCase()) &&
      (!bestMatch.condition || checkCondition(bestMatch.condition, currentArea, bestMatch.target))) {
    validMatch = bestMatch;
    console.log(`Using bestMatch: ${bestMatch.command} (target: ${bestMatch.target})`);
  } else {
    const talkMatches = parsedCommands.filter(c => 
      c.command.startsWith('talk') && c.target && 
      c.target.toLowerCase().includes(target.toLowerCase())
    );
    validMatch = talkMatches.find(c => 
      !c.condition || checkCondition(c.condition, currentArea, c.target)
    );
  }

  if (validMatch) {
    output.push(validMatch.response);
    handleAction(validMatch, currentArea);
  } else {
    output.push(`You don't see "${target}" here to talk to.`);
  }

  return { needsFurtherInput: false, output };
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
      output.push("There’s nothing to take here.");
    }
    return { needsFurtherInput: false, output };
  }

  let validMatch = null;
  if (bestMatch && bestMatch.command.startsWith('take') && 
      bestMatch.target && bestMatch.target.toLowerCase().includes(target.toLowerCase()) &&
      (!bestMatch.condition || checkCondition(bestMatch.condition, currentArea, bestMatch.target))) {
    validMatch = bestMatch;
    console.log(`Using bestMatch: ${bestMatch.command} (target: ${bestMatch.target}, priority: ${bestMatch.priority || 0})`);
  } else {
    console.log(`bestMatch invalid or missing: ${bestMatch ? bestMatch.command : 'none'}`);
    const takeMatches = parsedCommands.filter(c => 
      c.command.startsWith('take') && c.target && 
      c.target.toLowerCase().includes(target.toLowerCase())
    );
    validMatch = takeMatches
      .filter(c => !c.condition || checkCondition(c.condition, currentArea, c.target))
      .sort((a, b) => (b.priority || 0) - (a.priority || 0))[0];
    console.log(`Fallback selected: ${validMatch ? validMatch.command : 'none'} (target: ${validMatch?.target || 'none'}, priority: ${validMatch?.priority || 0})`);
  }

  if (validMatch) {
    output.push(validMatch.response || `You take the ${target}.`);
    handleAction(validMatch, currentArea);
  } else {
    output.push(`There’s nothing matching "${target}" to take here.`);
  }

  return { needsFurtherInput: false, output };
}

function handlePushCommand(input, parsedCommands, currentArea, target, bestMatch) {
  const output = [];

  if (!target) {
    output.push("What would you like to push?");
    const availableTargets = parsedCommands
      .filter(c => c.command.startsWith('push') && c.target && 
                   (!c.condition || checkCondition(c.condition, currentArea, c.target)))
      .map(c => c.target);
    if (availableTargets.length > 0) {
      output.push("You can push:");
      availableTargets.forEach(item => output.push(`- ${item}`));
    } else {
      output.push("There’s nothing to push here.");
    }
    return { needsFurtherInput: false, output };
  }

  let validMatch = null;
  if (bestMatch && bestMatch.command.startsWith('push') && 
      bestMatch.target && bestMatch.target.toLowerCase().includes(target.toLowerCase()) &&
      (!bestMatch.condition || checkCondition(bestMatch.condition, currentArea, bestMatch.target))) {
    validMatch = bestMatch;
    console.log(`Using bestMatch: ${bestMatch.command} (target: ${bestMatch.target}, priority: ${bestMatch.priority || 0})`);
  } else {
    console.log(`bestMatch invalid or missing: ${bestMatch ? bestMatch.command : 'none'}`);
    const pushMatches = parsedCommands.filter(c => 
      c.command.startsWith('push') && c.target && 
      c.target.toLowerCase().includes(target.toLowerCase())
    );
    validMatch = pushMatches
      .filter(c => !c.condition || checkCondition(c.condition, currentArea, c.target))
      .sort((a, b) => (b.priority || 0) - (a.priority || 0))[0];
    console.log(`Fallback selected: ${validMatch ? validMatch.command : 'none'} (target: ${validMatch?.target || 'none'}, priority: ${validMatch?.priority || 0})`);
  }

  if (validMatch) {
    output.push(validMatch.response || `You push the ${target}.`);
    handleAction(validMatch, currentArea);
  } else {
    output.push(`There’s nothing matching "${target}" to push here.`);
  }

  return { needsFurtherInput: false, output };
}

// Pull command
function handlePullCommand(input, parsedCommands, currentArea, target, bestMatch) {
  const output = [];

  if (!target) {
    output.push("What would you like to pull?");
    const availableTargets = parsedCommands
      .filter(c => c.command.startsWith('pull') && c.target && 
                   (!c.condition || checkCondition(c.condition, currentArea, c.target)))
      .map(c => c.target);
    if (availableTargets.length > 0) {
      output.push("You can pull:");
      availableTargets.forEach(item => output.push(`- ${item}`));
    } else {
      output.push("There’s nothing to pull here.");
    }
    return { needsFurtherInput: false, output };
  }

  let validMatch = null;
  if (bestMatch && bestMatch.command.startsWith('pull') && 
      bestMatch.target && bestMatch.target.toLowerCase().includes(target.toLowerCase()) &&
      (!bestMatch.condition || checkCondition(bestMatch.condition, currentArea, bestMatch.target))) {
    validMatch = bestMatch;
    console.log(`Using bestMatch: ${bestMatch.command} (target: ${bestMatch.target}, priority: ${bestMatch.priority || 0})`);
  } else {
    console.log(`bestMatch invalid or missing: ${bestMatch ? bestMatch.command : 'none'}`);
    const pullMatches = parsedCommands.filter(c => 
      c.command.startsWith('pull') && c.target && 
      c.target.toLowerCase().includes(target.toLowerCase())
    );
    validMatch = pullMatches
      .filter(c => !c.condition || checkCondition(c.condition, currentArea, c.target))
      .sort((a, b) => (b.priority || 0) - (a.priority || 0))[0];
    console.log(`Fallback selected: ${validMatch ? validMatch.command : 'none'} (target: ${validMatch?.target || 'none'}, priority: ${validMatch?.priority || 0})`);
  }

  if (validMatch) {
    output.push(validMatch.response || `You pull the ${target}.`);
    handleAction(validMatch, currentArea);
  } else {
    output.push(`There’s nothing matching "${target}" to pull here.`);
  }

  return { needsFurtherInput: false, output };
}

function handleHitCommand(input, parsedCommands, currentArea, target, bestMatch) {
  const output = [];

  if (!target) {
    output.push("What would you like to hit?");
    const availableTargets = parsedCommands
      .filter(c => c.command.startsWith('hit') && c.target && 
                   (!c.condition || checkCondition(c.condition, currentArea, c.target)))
      .map(c => c.target);
    if (availableTargets.length > 0) {
      output.push("You can hit:");
      availableTargets.forEach(item => output.push(`- ${item}`));
    } else {
      output.push("There’s nothing to hit here.");
    }
    return { needsFurtherInput: false, output };
  }

  let validMatch = null;
  if (bestMatch && bestMatch.command.startsWith('hit') && 
      bestMatch.target && bestMatch.target.toLowerCase().includes(target.toLowerCase()) &&
      (!bestMatch.condition || checkCondition(bestMatch.condition, currentArea, bestMatch.target))) {
    validMatch = bestMatch;
    console.log(`Using bestMatch: ${bestMatch.command} (target: ${bestMatch.target}, priority: ${bestMatch.priority || 0})`);
  } else {
    console.log(`bestMatch invalid or missing: ${bestMatch ? bestMatch.command : 'none'}`);
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
    output.push(`You can't hit the ${bestMatch.target}.`);
  } else {
    output.push(`There’s nothing matching "${target}" to hit here.`);
  }

  return { needsFurtherInput: false, output };
}

function handleUseCommand(input, parsedCommands, currentArea, target, bestMatch) {
  const output = [];

  if (!target) {
    output.push("What would you like to use?");
    const availableTargets = parsedCommands
      .filter(c => c.command.startsWith('use') && c.target && 
                   (!c.condition || checkCondition(c.condition, currentArea, c.target)))
      .map(c => c.target);
    if (availableTargets.length > 0) {
      output.push("You can use:");
      availableTargets.forEach(item => output.push(`- ${item}`));
    } else {
      output.push("There’s nothing to use here.");
    }
    return { needsFurtherInput: false, output };
  }

  let validMatch = null;
  if (bestMatch && bestMatch.command.startsWith('use') && 
      bestMatch.target && bestMatch.target.toLowerCase().includes(target.toLowerCase()) &&
      (!bestMatch.condition || checkCondition(bestMatch.condition, currentArea, bestMatch.target))) {
    validMatch = bestMatch;
    console.log(`Using bestMatch: ${bestMatch.command} (target: ${bestMatch.target}, priority: ${bestMatch.priority || 0})`);
  } else {
    console.log(`bestMatch invalid or missing: ${bestMatch ? bestMatch.command : 'none'}`);
    const useMatches = parsedCommands.filter(c => 
      c.command.startsWith('use') && c.target && 
      c.target.toLowerCase().includes(target.toLowerCase())
    );
    validMatch = useMatches
      .filter(c => !c.condition || checkCondition(c.condition, currentArea, c.target))
      .sort((a, b) => (b.priority || 0) - (a.priority || 0))[0];
    console.log(`Fallback selected: ${validMatch ? validMatch.command : 'none'} (target: ${validMatch?.target || 'none'}, priority: ${validMatch?.priority || 0})`);
  }

  if (validMatch) {
    output.push(validMatch.response || `You use the ${target}.`);
    handleAction(validMatch, currentArea);
  } else {
    output.push(`You can’t use "${target}" here.`);
  }

  return { needsFurtherInput: false, output };
}

function handlePlaceCommand(input, parsedCommands, currentArea, target, bestMatch) {
  const output = [];

  if (!target) {
    output.push("What would you like to place?");
    const availableTargets = parsedCommands
      .filter(c => c.command.startsWith('place') && c.target && 
                   (!c.condition || checkCondition(c.condition, currentArea, c.target)))
      .map(c => c.target);
    if (availableTargets.length > 0) {
      output.push("You can place:");
      availableTargets.forEach(item => output.push(`- ${item}`));
    } else {
      output.push("There’s nowhere to place anything here.");
    }
    return { needsFurtherInput: false, output };
  }

  let validMatch = null;
  if (bestMatch && bestMatch.command.startsWith('place') && 
      bestMatch.target && bestMatch.target.toLowerCase().includes(target.toLowerCase()) &&
      (!bestMatch.condition || checkCondition(bestMatch.condition, currentArea, bestMatch.target))) {
    validMatch = bestMatch;
    console.log(`Using bestMatch: ${bestMatch.command} (target: ${bestMatch.target}, priority: ${bestMatch.priority || 0})`);
  } else {
    console.log(`bestMatch invalid or missing: ${bestMatch ? bestMatch.command : 'none'}`);
    const placeMatches = parsedCommands.filter(c => 
      c.command.startsWith('place') && c.target && 
      c.target.toLowerCase().includes(target.toLowerCase())
    );
    validMatch = placeMatches
      .filter(c => !c.condition || checkCondition(c.condition, currentArea, c.target))
      .sort((a, b) => (b.priority || 0) - (a.priority || 0))[0];
    console.log(`Fallback selected: ${validMatch ? validMatch.command : 'none'} (target: ${validMatch?.target || 'none'}, priority: ${validMatch?.priority || 0})`);
  }

  if (validMatch) {
    output.push(validMatch.response || `You place the ${target}.`);
    handleAction(validMatch, currentArea);
  } else {
    output.push(`There’s nowhere to place "${target}" here.`);
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
  const target = input.toLowerCase().slice(10).trim();
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

      if (invDescription.lookBlurbs && invDescription.lookBlurbs.length) {
        const randomBlurb = invDescription.lookBlurbs[Math.floor(Math.random() * invDescription.lookBlurbs.length)];
        output.push(randomBlurb);
      }

      if (invItem.itemState) {
        for (const [condition, isTrue] of Object.entries(invItem.itemState)) {
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
    if (trigger.action === 'setState') {
      const [path, subPath] = trigger.target.split('.areaId:');
      if (subPath.includes('.npcs.npcId:')) {
        const [areaId, npcPart] = subPath.split('.npcs.npcId:');
        const npcId = parseInt(npcPart);
        const area = areaData.find(a => a.areaId === parseInt(areaId));
        const npc = area.npcs.find(n => n.npcId === npcId);
        npc.npcState[trigger.condition] = trigger.value;
        console.log(`Set ${trigger.condition} = ${trigger.value} for NPC ${npc.name}`);
      } else if (subPath.includes('.items.itemId:')) {
        const [areaId, itemPart] = subPath.split('.items.itemId:');
        const itemId = parseInt(itemPart);
        const area = areaData.find(a => a.areaId === parseInt(areaId));
        const item = area.items.find(i => i.itemId === itemId);
        item.itemState[trigger.condition] = trigger.value;
        console.log(`Set ${trigger.condition} = ${trigger.value} for item ${item.name}`);
      } else if (subPath.includes('.secrets.secretId:')) {
        const [areaId, secretPart] = subPath.split('.secrets.secretId:');
        const secretId = parseInt(secretPart);
        const area = areaData.find(a => a.areaId === parseInt(areaId));
        const secret = area.secrets.find(s => s.secretId === secretId);
        secret.secretState[trigger.condition] = trigger.value;
        console.log(`Set ${trigger.condition} = ${trigger.value} for secret ${secret.name}`);
      } else {
        const area = areaData.find(a => a.areaId === parseInt(subPath));
        area.areaState[trigger.condition] = trigger.value;
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
      const item = currentArea.items.find(i => i.name === trigger.item);
      if (item) {
        item.itemState.pickedUp = true;
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
      return handleLookCommand(input, parsedCommands, currentArea, target, bestMatch);
    case 'go':
      return handleGoCommand(input, parsedCommands, currentArea);
    case 'talk':
      return handleTalkCommand(input, parsedCommands, currentArea, target, bestMatch);
    case 'take':
      return handleTakeCommand(input, parsedCommands, currentArea, target, bestMatch);
    case 'push':
      return handlePushCommand(input, parsedCommands, currentArea, target, bestMatch);
    case 'pull':
      return handlePullCommand(input, parsedCommands, currentArea, target, bestMatch);
    case 'inventory':
      if (!target) return { needsFurtherInput: false, output: displayInventory() };
      return handleInventoryItem(`${command} ${target}`);
    case 'hit':
      return handleHitCommand(input, parsedCommands, currentArea, target, bestMatch);
    case 'use':
      return handleUseCommand(input, parsedCommands, currentArea, target, bestMatch);
    case 'place':
      return handlePlaceCommand(input, parsedCommands, currentArea, target, bestMatch);
    default:
      if (bestMatch) {
        handleAction(bestMatch, currentArea);
        return { needsFurtherInput: false, output: [bestMatch.response] };
      }
      return { needsFurtherInput: false, output: [`Command "${command}" not implemented yet.`] };
  }
}

export { handleCommand, displayArea, checkCondition, parseItemsNpcs };
