const gameData = require('./src/data/gameData.json');

const playerData = gameData.playerData;
const areaData = gameData.areas;
const inventoryDescriptions = gameData.inventoryDescriptions;

function displayArea(areaId) {
  const area = areaData.find(area => area.areaId === areaId);
  if (!area) return console.log('Area not found.');

  console.log(`\nYou are in: ${area.name}`);
  console.log(area.description);

  console.log('\nItems here:');
  area.items.forEach(item => console.log(`- ${item.name}: ${item.description}`));

  console.log('\nNPCs here:');
  area.npcs.forEach(npc => console.log(`- ${npc.name}: ${npc.description}`));

  console.log('\nCommands available:');
  [...area.exits.commands, ...area.items.flatMap(i => i.commands), ...area.npcs.flatMap(n => n.commands), ...area.secrets.flatMap(s => s.commands)].forEach(command => {
    console.log(`- ${command.command}: ${command.description}`);
  });
}

function handleCommand(input) {
  const currentArea = areaData.find(area => area.areaId === playerData.currentArea);
  if (!currentArea) return console.log('Invalid area.');

  const allCommands = [...currentArea.exits.commands, ...currentArea.items.flatMap(i => i.commands), ...currentArea.npcs.flatMap(n => n.commands), ...currentArea.secrets.flatMap(s => s.commands)];
  const command = allCommands.find(c => c.command.toLowerCase() === input);

  if (command) {
    if (!command.condition || checkCondition(command.condition)) {
      console.log(command.response);
      handleAction(command, currentArea);
    } else {
      console.log(`You cannot do that right now.`);
    }
  } else {
    console.log(`Unknown command: "${input}".`);
  }
}

function handleAction(command, currentArea) {
  if (command.actionTrigger) {
    const { type, action, value } = command.actionTrigger;
    if (type === 'area') {
      currentArea.completedAreaActions[action] = value;
    } else if (type === 'player') {
      playerData.completedActions[action] = value;
    }
  }

  switch (command.command) {
    case 'go south':
      playerData.currentArea = currentArea.exits.south;
      break;
    case 'go north':
      playerData.currentArea = currentArea.exits.north;
      break;
    case 'teleport':
      if (command.condition && checkCondition(command.condition)) {
        playerData.currentArea = currentArea.exits.teleport;
      } else {
        console.log('You cannot teleport yet.');
      }
      break;
    case 'pick up':
      const item = currentArea.items.find(i => i.name === command.response.split(' ')[2]);
      if (item) {
        playerData.inventory.push({ item: item.name, quantity: 1 });
        console.log(`${item.name} added to your inventory.`);
      }
      break;
    default:
      console.log('Action completed.');
  }
}

function checkCondition(condition) {
  if (!condition) return true;
  if (condition.startsWith('hasItem:')) {
    const itemName = condition.split(':')[1];
    return playerData.inventory.some(item => item.item === itemName);
  }
  return playerData.completedActions[condition] || false;
}

function startGame() {
  console.log('Welcome to the game!');
  playerData.currentArea = 1;
  displayArea(playerData.currentArea);

  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  rl.on('line', (input) => {
    handleCommand(input.trim().toLowerCase());
    displayArea(playerData.currentArea);
  });
}

startGame();
