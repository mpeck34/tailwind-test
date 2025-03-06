import gameData from './data/gameData.json'; // Ensure correct path

const playerData = gameData.playerData;
const areaData = gameData.areas;

function displayArea(areaId) {
  const area = areaData.find(area => area.areaId === areaId);
  if (!area) return ['Area not found.'];

  let output = [];
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

  return output;
}

function handleCommand(input) {
  const currentArea = areaData.find(area => area.areaId === playerData.currentArea);
  if (!currentArea) return ['Invalid area.'];

  let output = [];
  const allCommands = [
    ...currentArea.exits.commands, 
    ...currentArea.items.flatMap(i => i.commands), 
    ...currentArea.npcs.flatMap(n => n.commands), 
    ...currentArea.secrets.flatMap(s => s.commands)
  ];
  const command = allCommands.find(c => c.command.toLowerCase() === input);

  if (command) {
    if (!command.condition || checkCondition(command.condition)) {
      output.push(command.response);
      handleAction(command, currentArea);
    } else {
      output.push('You cannot do that right now.');
    }
  } else {
    output.push(`Unknown command: "${input}".`);
  }

  return output.concat(displayArea(playerData.currentArea));
}

export { handleCommand, displayArea };
