# mineflayer-totem-auto

A Mineflayer plugin that automatically equips Totems of Undying in the bot's offhand slot when available in the inventory.

## Features

- Automatically detects and equips Totems of Undying
- Works on every physics tick to ensure a totem is always equipped
- Supports Minecraft 1.9+ (versions with offhand slot)
- Multiple equipping methods to handle different server configurations
- Error handling to prevent console spam
- Simple API with start/stop functionality
- Emits 'totem_pop' event when a totem is activated

## Installation

```bash
npm install mineflayer-totem-auto
```

The plugin requires [mineflayer](https://github.com/PrismarineJS/mineflayer) and [minecraft-data](https://github.com/PrismarineJS/minecraft-data):

```bash
npm install mineflayer minecraft-data
```

## Usage

Basic usage:

```javascript
const mineflayer = require('mineflayer');
const autoTotemPlugin = require('mineflayer-totem-auto');

// Create your bot
const bot = mineflayer.createBot({
  host: 'localhost',
  username: 'Bot',
  // other options
});

// Load the auto-totem plugin
bot.loadPlugin(autoTotemPlugin);

// The plugin is now active and will automatically equip totems

// Listen for totem activation events
bot.on('totem_pop', () => {
  console.log('A totem was used to prevent death!');
  // You can perform additional actions here, like running away
});
```

### Methods

The plugin adds the following methods to your bot:

```javascript
// Stop the auto-totem functionality
bot.autoTotem.stop();

// Resume the auto-totem functionality if it was stopped
bot.autoTotem.start();

// Remove the plugin completely
bot.autoTotem.unload();
```

### Events

The plugin emits the following events:

- `totem_pop`: Fired when a totem is activated to prevent the bot's death. This event uses multiple detection methods including:
  - Entity status packets (most reliable)
  - Health pattern analysis (for when you go from very low health to higher health suddenly)
  - This can be useful for triggering evasive actions after surviving a near-death experience

## Compatibility

This plugin is designed to work with Minecraft 1.9 and above, as these versions introduced the offhand slot which is required for holding totems. The plugin automatically checks the Minecraft version and will disable itself if the version doesn't support offhand items.

The plugin includes multiple methods to equip totems and will automatically retry with alternative methods if the standard approach fails.

## Error Handling

To prevent log spam, the plugin implements:
- Error rate limiting (logs at most one error every 10 seconds)
- Error counting to track persistent issues
- Automatic retry cooldown if errors persist
- Version checking to detect compatibility issues early

## License

MIT
