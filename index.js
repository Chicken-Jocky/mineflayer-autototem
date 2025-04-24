module.exports = (bot) => {
  // Plugin injection function
  const mcData = require('minecraft-data')(bot.version);
  const totemId = mcData.itemsByName.totem_of_undying?.id;

  if (!totemId) {
    // No need for console log here
    return; // Stop loading if totems don't exist in this version
  }

  // Track state
  let isActive = true;
  let lastErrorTime = 0;
  let errorCount = 0;
  let retryTimeout = null;
  let lastHealth = bot.health;
  
  // Add a cooldown for totem pop events (measured in Minecraft ticks)
  let totemPopCooldown = 0;
  const TOTEM_POP_COOLDOWN_TICKS = 20; // 1 second (20 ticks) cooldown
  
  // Check if offhand is supported in this version (1.9+)
  const mcVersion = bot.version.split('.');
  const majorVersion = parseInt(mcVersion[0], 10) || 0;
  const minorVersion = parseInt(mcVersion[1], 10) || 0;
  const hasOffhand = majorVersion > 1 || (majorVersion === 1 && minorVersion >= 9);

  if (!hasOffhand) {
    // Remove console warn
    return; // Can't use totems in offhand before 1.9
  }

  // Centralized function to emit totem_pop event with cooldown
  const emitTotemPop = () => {
    if (totemPopCooldown <= 0) {
      bot.emit('totem_pop');
      totemPopCooldown = TOTEM_POP_COOLDOWN_TICKS;
      // Remove console.log for totem pop detection
    }
  };

  // Decrement the cooldown on each physics tick
  bot.on('physicsTick', () => {
    if (totemPopCooldown > 0) {
      totemPopCooldown--;
    }
  });
  
  // Detect totem activations through multiple methods
  const checkTotemActivation = (oldHealth, newHealth) => {
    // Method 1: Look for near-death patterns
    // The pattern is typically: health drops very low (near 0) and then jumps back up
    const wasNearDeath = oldHealth <= 4; // Very low health threshold
    const healthJumpedUp = newHealth > oldHealth && newHealth > 1;

    // Check if this pattern matches a totem activation
    if (wasNearDeath && healthJumpedUp) {
      // Most likely case: player was about to die but a totem saved them
      emitTotemPop();
    }
  };
  
  // Listen for health changes to detect possible totem activations
  bot.on('health', () => {
    if (bot.health !== lastHealth) {
      checkTotemActivation(lastHealth, bot.health);
      lastHealth = bot.health;
    }
  });
  
  // Entity Status method - used in newer Minecraft versions
  // The entity status packet with id=35 indicates totem activation
  if (bot._client) {
    bot._client.on('entity_status', (packet) => {
      // Entity status 35 = totem popped
      // Only trigger if it's the bot's entity id
      if (packet.entityId === bot.entity.id && packet.entityStatus === 35) {
        emitTotemPop();
      }
    });
  }
  
  // Also track inventory changes in the offhand to detect totem usage
  bot.on('playerCollect', (collector, collected) => {
    if (collector.id === bot.entity.id) {
      // The bot picked up an item - check if it's a totem
      setTimeout(equipTotemListener, 50); // Try to equip a totem soon after collecting
    }
  });

  // Store the listener function to remove it later
  const equipTotemListener = async () => {
    if (!isActive) return; // Check if plugin is active
    
    // Avoid spamming equip attempts when errors occur
    if (retryTimeout) return;

    try {
      // Different ways to identify the offhand slot
      // Standard inventory slot is usually 45 in most versions
      let offhandItem = null;
      
      // Try different methods to get offhand item
      if (bot.inventory.slots[45]) {
        offhandItem = bot.inventory.slots[45];
      } else if (bot.inventory.offhand) {
        offhandItem = bot.inventory.offhand[0]; // Some versions use this pattern
      }
      
      // Already holding a totem? Do nothing.
      if (offhandItem && offhandItem.type === totemId) {
        return;
      }

      // Find a totem in inventory
      const totem = bot.inventory.items().find(item => item.type === totemId);
      
      // If found, equip it
      if (totem) {
        try {
          await bot.equip(totem, 'offhand');
        } catch (equipErr) {
          // If standard equip fails, try alternative methods
          if (equipErr.message.includes('invalid destination: offhand')) {
            // Alternative method 1: Try to use a specific window slot
            try {
              // Some servers use different window Click methods instead
              if (bot.clickWindow) {
                await bot.clickWindow(totem.slot, 0, 0); // Pick up the totem
                await bot.clickWindow(45, 0, 0); // Place in offhand slot
              }
            } catch (altErr) {
              throw new Error(`Failed alternative equip method: ${altErr.message}`);
            }
          } else {
            throw equipErr; // Re-throw other errors
          }
        }
      }
      
      // Reset error tracking on success
      errorCount = 0;
      
    } catch (err) {
      // Implement error rate limiting to prevent spam
      const now = Date.now();
      const errorThrottleMs = 10000; // 10 seconds between error messages
      
      errorCount++;
      
      // Only show error log at most once per throttle period
      if (now - lastErrorTime > errorThrottleMs) {
        // Remove console.error for equip errors
        lastErrorTime = now;
        
        // If we get consistent errors, add a delay between retries
        if (errorCount > 10) {
          retryTimeout = setTimeout(() => {
            retryTimeout = null;
          }, 5000); // Wait 5 seconds before trying again
        }
      }
    }
  };

  // --- Plugin initialization ---
  // Attach the listener to check on physics ticks
  bot.on('physicsTick', equipTotemListener);
  
  // --- Add properties/methods to bot object (namespaced) ---
  // Create a namespace for the plugin on the bot object
  bot.autoTotem = {};

  // Add a method to manually stop the plugin's checks
  bot.autoTotem.stop = () => {
    if (!isActive) return;
    isActive = false;
    if (retryTimeout) {
      clearTimeout(retryTimeout);
      retryTimeout = null;
    }
    bot.removeListener('physicsTick', equipTotemListener);
  };

  // Add a method to restart the plugin's checks if stopped
  bot.autoTotem.start = () => {
    if (isActive) return;
    isActive = true;
    errorCount = 0;
    if (retryTimeout) {
      clearTimeout(retryTimeout);
      retryTimeout = null;
    }
    bot.on('physicsTick', equipTotemListener); // Re-attach listener
  };

  // Original unload logic
  bot.autoTotem.unload = () => {
    bot.autoTotem.stop(); // Use the stop logic
  };
}; 