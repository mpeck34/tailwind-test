// game.js
const gameData = require('./src/data/gameData.json'); // Import the entire game data object

// You can now access the properties directly
const playerData = gameData.playerData;
const areaData = gameData.areas;
const inventoryDescriptions = gameData.inventoryDescriptions;

// Display area information to the player
function displayArea(areaId) {
  const area = areaData.find(area => area.areaId === areaId);

  console.log(`You are in: ${area.name}`);
  console.log(area.description);

  console.log('\nItems here:');
  area.items.forEach(item => {
    console.log(`- ${item.name}: ${item.description}`);
  });

  console.log('\nNPCs here:');
  area.npcs.forEach(npc => {
    console.log(`- ${npc.name}: ${npc.description}`);
  });

  console.log('\nCommands available:');
  area.exits.commands.forEach(command => {
    console.log(`- ${command.command}: ${command.description}`);
  });
}

// Handle player input and actions
function handleCommand(input) {
  const currentArea = areaData.find(area => area.areaId === playerData.currentArea);
  const command = currentArea.exits.commands.find(c => c.command === input);

  if (command) {
    if (command.isOpen) {
      console.log(command.response);
      // Trigger corresponding area action or transition
      handleAction(command);
    } else {
      console.log(`The command "${input}" is not available right now.`);
    }
  } else {
    console.log(`Unknown command: "${input}". Try again.`);
  }
}

// Perform action based on the command
function handleAction(command) {
  // Update player state, area state, etc.
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
    default:
      console.log('Action not implemented yet.');
  }
}

// Check if the player satisfies a condition (e.g., item in inventory)
function checkCondition(condition) {
  if (condition) {
    if (condition.startsWith('hasItem:')) {
      const itemName = condition.split(':')[1];
      return playerData.inventory.some(item => item.item === itemName);
    } else if (condition === 'placedStaffInStump') {
      return playerData.completedActions.placedStaffInStump;
    }
  }
  return true; // Default: condition passed if no condition exists
}

// Start the game by initializing player data and displaying the first area
function startGame() {
  console.log('Welcome to the game!');
  playerData.currentArea = 1; // Start in the first area (Village Square)

  // Display the first area
  displayArea(playerData.currentArea);

  // Example of getting user input
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.on('line', (input) => {
    handleCommand(input.trim().toLowerCase());
    displayArea(playerData.currentArea); // Show updated area after action
  });
}

startGame();
