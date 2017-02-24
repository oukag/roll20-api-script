/**
 *	Useful Macros
 *
 *	Damage
 *		!modHealth --sel --damage ?{Damage|0} ?{Type|Acid,acid|Bludgeoning,bludgeoning|Cold,cold|Fire,fire|Force,force|Lightning,lightning|Necrotic,necrotic|Piercing,piercing|Poison,poison|Psychic,psychic|Radiant,radiant|Slashing,slashing|Thunder,thunder|Bludgeoning Magical,bludgeoning(magic)|Piercing Magical,piercing(magic)|Slashing Magical,slashing(magic)}
 *
 *	Heal
 *		!modHealth --sel --heal ?{Healing|0}
 *
 *	ToggleConcentration
 *		!toggleConcentration
 *
 *	ToggleRage
 *		!toggleRage
 */

var HitpointTracker = HitpointTracker || (function(){
	'use strict';

	var version = 1.2,
		scriptName = "Hitpoint Tracker",
		modHealthCommand = "!modHealth",
		toggleConcentrationCommand = "!toggleConcentration",
		toggleRageCommand = "!toggleRage",
		helpCommand = "--help",

		//================================================================================
		// Used in modHealthCommand
		//================================================================================
		// Selection Options
		charIdOption = "charids",
		charNameOption = "charnames",
		tokenIdOption = "tokenids",
		selectedOption = "sel",		//Default Option

		// Modify Options
		damageOption = "damage",	//Default Option
		healOption = "heal",
		tempHpOption = "temphp",

		// Character Sheet specific attributes
		tempHpAttrName = "hp_temp",
		hpAttrName = "hp",	// This is also used in clearDeathSavingThrows() event handler
		npcAttrName = "npc",
		npcAttrValue = 1,
		
		npcResistanceAttrName = "npc_resistance",
		npcImmunityAttrName = "npc_immunities",
		npcVulnerabilityAttrName = "npc_vulnerabilities",
		//================================================================================

		//================================================================================
		// Used for status tracking
		//================================================================================
		allowNegative = false,	// If true, does not allow token hp to go under -MAX.
								// Otherwise, does not allow token hp to go under 0.
		// Token Information
		hp_bar = "bar1",
		token_hp_curr = hp_bar + "_value",
		token_hp_max = hp_bar + "_max",
		bloodied_status = "status_redmarker",
		bloodied_ratio = 0.5,
		dead_status = "status_dead",
		dead_ratio = 0,
		
		// Show wounds information.
		/* 
		 * If a character has an attribute with the name in showWoundsAttrName and a value
		 * that is the same as any of the values stored in showWoundsValues, then the
		 * bloodied status will not be applied to that token.
		 */
		showWoundsAttrName = "showWounds",
		showWoundsValues = ["off", "0", "false"],
		//================================================================================

		
		//================================================================================
		// Used in toggleConcentrationCommand
		//================================================================================
		// Concentration Information
		concentration_status = "stopwatch",
		concentration_marker = "status_" + concentration_status,
		//================================================================================
		
		//================================================================================
		// Used in toggleRageCommand
		//================================================================================
		// Rage Information
		rage_status = "strong",
		rage_marker = "status_" + rage_status,
		// Used in damageToken
		totemBearAttrName = "bear_totem",
		totemBearAttrValues = ["on", "1", "true"],
		
		DAMAGE_TYPES = {
			ACID:				 1,
			BLUDGEONING:		 2,
			COLD:				 3,
			FIRE:				 4,
			FORCE:				 5,
			LIGHTNING:			 6,
			NECROTIC:			 7,
			PIERCING:			 8,
			POISON:				 9,
			PSYCHIC:			10,
			RADIANT:			11,
			SLASHING:			12,
			THUNDER:			13,
			BLUDGEONING_MAGIC:	14,
			PIERCING_MAGIC:		15,
			SLASHING_MAGIC:		16,
			size: 16,
			props: {
				1:	{name: "Acid",					rage: false,	bear:  true,	keywords: ["acid"]},
				2:	{name: "Bludgeoning",			rage: true,		bear:  true,	keywords: ["bludgeoning"]},
				3:	{name: "Cold",					rage: false,	bear:  true,	keywords: ["cold"]},
				4:	{name: "Fire",					rage: false,	bear:  true,	keywords: ["fire"]},
				5:	{name: "Force",					rage: false,	bear:  true,	keywords: ["force"]},
				6:	{name: "Lightning",				rage: false,	bear:  true,	keywords: ["lightning"]},
				7:	{name: "Necrotic",				rage: false,	bear:  true,	keywords: ["necrotic"]},
				8:	{name: "Piercing",				rage: true,		bear:  true,	keywords: ["piercing"]},
				9:	{name: "Poison",				rage: false,	bear:  true,	keywords: ["poison"]},
				10:	{name: "Psychic",				rage: false,	bear: false,	keywords: ["psychic"]},
				11:	{name: "Radiant",				rage: false,	bear:  true,	keywords: ["radiant"]},
				12:	{name: "Slashing",				rage: true,		bear:  true,	keywords: ["slashing"]},
				13:	{name: "Thunder",				rage: false,	bear:  true,	keywords: ["thunder"]},
				14:	{name: "Bludgeoning Magical",	rage: true,		bear:  true,	keywords: ["bludgeoning(magic)"]},
				15:	{name: "Piercing Magical",		rage: true,		bear:  true,	keywords: ["piercing(magic)"]},
				16:	{name: "Slashing Magical",		rage: true, 	bear:  true,	keywords: ["slashing(magic)"]},
			},
			
			isRageResistantToType:	function(character,keyword) {
				var typeIndex = this.getIndexForKeyword(keyword);
				if(typeIndex == 0) {
					log("Damage Type '" + keyword + "' not found");
					return false;
				}
				
				var bearResist = false;
				var bearTotemAttr = findAttrForCharacter(character, totemBearAttrName);
				if(bearTotemAttr) {
					var value = bearTotemAttr.get("current");
					_.each(totemBearAttrValues, function(obj){
						if(obj == value) {
							bearResist = true;
						}
					});
				}
				
				if(bearResist) {
					log("Resist:" + this.props[typeIndex].bear);
					return this.props[typeIndex].bear;
				} else {
					log("Resist:" + this.props[typeIndex].rage);
					return this.props[typeIndex].rage;
				}
			},
			
			getIndexForKeyword: function(keyword) {
				var index = 0;
				for(var i = 1; i <= this.size; i++) {
					_.each(this.props[i].keywords, function(obj){
						if(keyword == obj) {
							index = i;
						}
					});
				}
				return index;
			},
			
			getNpcDamageMod(npc, keyword) {
				var mod = 1;	// Default to normal damage =	  1;
								// Resistant				=	0.5;
								// Immune 					=	  0;
								// Vulnerable 				=	  2;
				
				if(!isNPC(npc.id)) { return mod; }
				log("Damage Type:" + keyword);
				
				var attr;
				// Check Vulnerabilities
				attr = findAttrForCharacter(npc, npcVulnerabilityAttrName);
				if(attr && attr.get("current").indexOf(keyword) !== -1){
					mod = 2;
				}
				
				// Check Resistances
				attr = findAttrForCharacter(npc, npcResistanceAttrName);
				if(attr && attr.get("current").indexOf(keyword) !== -1){
					mod = 0.5;
				}
				
				// Check Immunities
				log("Immunities");
				attr = findAttrForCharacter(npc, npcImmunityAttrName);
				log(attr);
				if(attr && attr.get("current").indexOf(keyword) !== -1){
					mod = 0;
				}
				
				return mod;
				
			}
		},
		//================================================================================
		
		
		//================================================================================
		// Used for Concentration specific calculations of DamageCharacter/DamageToken
		//================================================================================
		concentration_set_attribute = "concentration",
		npc_concentration_attribute = "npcd_con_save",
		npc_concentration_base_stat = "npcd_con_mod",
		pc_concentration_attribute = "constitution_save_bonus",
		war_caster_feat_attribute = "war_caster_feat",
		//================================================================================

	/**
	 * Updates the status markers for the token. Will also ensure that the token's hp will
	 * not go over its maximum hp nor under 0.
	 * This method requires that tokens have a value stored in token_hp_max
	 */
    updateHealthStatus = function(token) {
		// If the token does not have a value in the hp_bar max attribute, return
		if(token.get(token_hp_max) == "") return;

		var curr = parseInt(token.get(token_hp_curr));
		var max = parseInt(token.get(token_hp_max));

		// If the token has more current health than maximum health, reset to maximum
		if(curr > max) {
			token.set(token_hp_curr, max);
		} else if(!allowNegative && curr < 0) {
			token.set(token_hp_curr, 0);
		} else if(allowNegative && curr < (0 - max)) {
			token.set(token_hp_curr, 0 - max);
		}

		var character = getCharacterForTokenId(token.id);
		var showWoundsAttr = findAttrForCharacter(character,showWoundsAttrName);
		var showWounds = true;
		if(showWoundsAttr) {
			var value = showWoundsAttr.get("current");
			_.each(showWoundsValues, function(obj) {
				if(obj == value) {
					showWounds = false;
				}
			});
		}
		// If the token is under the bloodied ratio set above, set bloodied status to true
		// Otherwise set bloodied status to false
		if(showWounds && curr <= (max * bloodied_ratio)) {
			token.set(bloodied_status, true);
		} else {
			token.set(bloodied_status, false);
		}

		// If the object is under the death status set above, set dead status to true
		// Otherwise set dead status to false
		if(curr <= (max * dead_ratio)) {
			token.set(dead_status, true);
		} else {
			token.set(dead_status, false);
		}
	},

	/**
	 * Returns the first attribute found for the given character's id under the given attribute name.
	 * If no attribute is found, will return a null variable.
	 *
	 * I created this because I found it was too easy to make a mistake for finding an attribute when
	 * using Roll20's findObjs() method for an attribute.
	 */
	findAttrForCharacter = function(character, attrName) {
		return findObjs({
			_type: "attribute",
			characterid: character.id,
			name: attrName
		},{caseInsensitive: true})[0];
	},

	/**
	 * Clears the deathsaving throws for the character when it detects that their health raises from 
	 * 0 or less to positive. Uses the dead_ratio and hpAttrName values defined above.
	 */
	clearDeathSavingThrows = function(obj, prev) {
		// Clear the death saving throws from the character if they just came back from 0 hp.
		if(obj.get("name") == hpAttrName && prev.current <= (obj.get("max") * dead_ratio) && obj.get("current") > (obj.get("max") * dead_ratio)) {
			var character = getCharacterForId(obj.get("characterid"));
			myWhisperGM(scriptName, "Clearing death saving throws for " + character.get("name"));
			clearDeathSavesForCharacter(character);
		}
	},

	/**
	 * This method resets the 6 attributes that keep track of the death saving throws for the character.
	 */
	clearDeathSavesForCharacter = function(character) {
		var fail1 = findAttrForCharacter(character,"deathsave_fail1");
		var fail2 = findAttrForCharacter(character,"deathsave_fail2");
		var fail3 = findAttrForCharacter(character,"deathsave_fail3");
		var succ1 = findAttrForCharacter(character,"deathsave_succ1");
		var succ2 = findAttrForCharacter(character,"deathsave_succ2");
		var succ3 = findAttrForCharacter(character,"deathsave_succ3");
		if(fail1) {fail1.set({current:"0"});};
		if(fail2) {fail2.set({current:"0"});};
		if(fail3) {fail3.set({current:"0"});};
		if(succ1) {succ1.set({current:"0"});};
		if(succ2) {succ2.set({current:"0"});};
		if(succ3) {succ3.set({current:"0"});};
	},

	/**
	 * This method handles the modHealthCommand defined above.
	 */
	handleModHealth = function(msg) {
	   if(msg.type == "api" && msg.content.indexOf(modHealthCommand) !== -1) {
			var commands = getModHealthCommands(msg);
			log(commands);
			if(commands){
				if(commands.target == charIdOption || commands.target == tokenIdOption) {
					_.each(commands.target_values, function(target){
						modHealth(commands.type, commands.amount, target, false, commands.damage_type);
					});
				} else { // Default to selected
					_.each(msg.selected, function(selected){
						var target = selected._id;
						modHealth(commands.type, commands.amount, target, true, commands.damage_type);
					});
			   }
		   } else {
			   modHealthHelp(msg.who.split(" ")[0]);
		   }
	   }
	},

	/**
	 * The main method that performs the action specified when the modHealthCommand is run.
	 */
	modHealth = function(type, amount, target, isTokenId, damage_type) {
		if(!isTokenId) {
			switch(type) {
				case tempHpOption:
					giveTempHpToCharacter(target,amount);
					break;
				case healOption:
					healCharacter(target, amount);
					break;
				case damageOption:
				default:
					damageCharacter(target, amount, damage_type);
					break;
			}
		} else {
			switch(type) {
				case tempHpOption:
					giveTempHpToToken(target,amount);
					break;
				case healOption:
					healToken(target, amount);
					break;
				case damageOption:
				default:
					damageToken(target, amount, damage_type);
					break;
			}
		}
	},

	/**
	 * This method parses through the modHealthCommand entered by the user and returns the options to be used
	 */
	getModHealthCommands = function(msg) {
		if(msg.content.indexOf(modHealthCommand) == -1) {
			log("Tried to parse command for something other than '" + modHealthCommand + "'");
			return null;
		}
		if(msg.content.indexOf(helpCommand) !== -1) {
			return null;
		}
		var who = msg.who.split(" ")[0],
            content = processInlinerolls(msg),
			commandStrs = content.split("--"),
			target_str = commandStrs[1].split(" "),
			option_str = commandStrs[2].split(" "),
			target = target_str[0],
			target_values = target_str.slice(1,target_str.length),
			type = option_str[0],
			amount = option_str[1],
			damage_type = option_str[option_str.length - 1],
			valid = true,
			errorMsg = "";
		if(target == selectedOption && !msg.selected) {
			errorMsg = errorMsg + " You must have selected tokens to use &lt;target> --sel.";
			valid = false;
		} else if(target == tokenIdOption && target_values.length == 0
			|| target == charIdOption && target_values.length == 0) {
			errorMsg = errorMsg + " Expected &lt;target_values> not found.";
			valid = false;
		}
		else if (target != selectedOption && target != tokenIdOption && target != charIdOption) {
			errorMsg = errorMsg + " Expected &lt;target> to be either --sel, --tokenids, or --charids instead of --" + target + ".";
			valid = false;
		}
		
		if(target_values[target_values.length - 1] === "") {
			target_values = target_values.slice(0,target_values.length - 1);
		}
		if(type != tempHpOption && type != healOption && type != damageOption) {
			errorMsg = errorMsg + " Expected &lt;type> to be either --" + tempHpOption + ", --" + healOption + ", --" + damageOption + " instead of --" + type + ".";
			valid = false;
		}

		if(parseInt(amount) <= 0 || amount == "") {
			errorMsg = errorMsg + " Expected &lt;amount> to be greater than 0.";
			valid = false;
		}
		
		if(type == damageOption && damage_type == amount) {
			errorMsg = errorMsg + " Expected &lt;damage_type> not found";
			valid = false;
		}

		if(!valid) {
			mySendChat(scriptName, "/w " + who + errorMsg);
			return null;
		}

		var commands = {
			"target": target,
			"target_values": target_values,
			"type": type,
			"amount": amount,
			"damage_type": damage_type
		};
		return commands;
	},

	/**
	 * Prints the help message for the modHealthCommand
	 */
	modHealthHelp = function(who) {
		var output = " <b>" + modHealthCommand + " &lt;target> &lt;target_values> &lt;type> &lt;amount> &lt;damage_type></b><br>"
			+ "<br> <b>&lt;target></b>        - --" + selectedOption + ", --" + tokenIdOption + " or --" + charIdOption
			+ "<br> <b>&lt;target_values></b> - optional for --" + selectedOption + " but mandatory for --" + tokenIdOption + " and --" + charIdOption
			+ "<br>              Example: tokenid1 tokenid2 tokenid3 ..."
			+ "<br> <b>&lt;type></b>          - --" + tempHpOption + ", --" + healOption + ", or --" + damageOption
			+ "<br>              " + tempHpOption + " currently only works for PCs not NPCs"
			+ "<br> <b>&lt;amount></b>        - the amount of damage/healing/temporary hp to be applied to the target(s)."
			+ "<br> <b>&lt;damage_type></b>   - Mandatory for --" + damageOption + ". Used in determining if the amount needs to be adjust due to resistances/immunities/vulnerabilities.";
		mySendChat(scriptName, "/w " + who + output)
	},

	/**
	 * Damages the specified token for the value and then updates the token using updateHealthStatus
	 * Future update will also pass in a damage type that will be used in determining damage with resistances and immunities.
	 */
	damageToken = function(tokenId, value, type) {
		var character = getCharacterForTokenId(tokenId),
			token = getTokenForId(tokenId),
			output = "Damaging " + character.get("name") + " for " + value + " " + type + " damage";

		if(isTokenConcentrating(token)) {
			concentrationCheck(character,value);
		}
		if(!isNPC(character.id)) {
			if(isTokenRaging(token) && DAMAGE_TYPES.isRageResistantToType(character, type)) {
				var resistedDamage = Math.ceil(value/2);
				value = value - resistedDamage;
				output = "Damaging " + character.get("name") + " for " + value + " hit points, resisted " + resistedDamage + " " + type + " damage";
			}
			mySendChat("GM", "/w " + character.get("name").split(" ")[0] + " " + output);
		} else {
		    var mod = DAMAGE_TYPES.getNpcDamageMod(character, type);
			if(mod == 2) {
				output = "Damaging " + character.get("name") + " for " + value + " hit points, vulnerable  to " + type + " damage";
			} else if(mod == 0.5) {
				output = "Damaging " + character.get("name") + " for " + value + " hit points, resisted " + Math.ceil(value * mod) + " " + type + " damage";
			} else if(mod == 0) {
				output = character.get("name") + " is immune to " + type + " damage.";
			}
			value = value * mod;
		}
		sendChat(scriptName, "/w gm " + output);
		log(output);

		if(!isNPC(character.id) && value > 0 && getAttrByName(character.id, tempHpAttrName) > 0) {
			// Check for temporary HP to reduce
			var tempHp = findAttrForCharacter(character,tempHpAttrName);
			if(parseInt(tempHp.get("current")) > parseInt(value)) {
				tempHp.set("current", tempHp.get("current") - value);
				return;
			} else {
				value = value - tempHp.get("current");
				tempHp.set("current", 0);
			}
		}

		token.set(token_hp_curr, token.get(token_hp_curr) - value);
		updateHealthStatus(token);
	},
	
	/**
	 * Damages the character for the value and then updates all tokens for the character using updateHealthStatus.
	 * NOTE: Does not work for NPCs, only PCs
	 */
	damageCharacter = function(characterId, value) {
		// Make sure that the character is not an NPC character. Otherwise this would affect all tokens linked to the NPC.
		// This should not be a problem, but I'd rather check anyway.
		if(isNPC(characterId)) {
			var error = "ERROR - [damageCharacter] cannot use this function to damage an NPC, try using --tokenids or damageToken() instead.";
			myWhisperGM(scriptName, error);
			log(error);
			return;
		}

		// Get the character for the id, mainly only need this for the character's name, but it is also needed for concentration checks
		var character = getCharacterForId(characterId);
		var output = "Damaging " + character.get("name") + " for " + value + " hit points";
		// Check if the character is concentrating
		if(isCharacterConcentrating(characterId)) {
			concentrationCheck(character, value);
		}

		// Do damage to any temporary hit points of the character before actual hit points.
		if(getAttrByName(character.id, tempHpAttrName) > 0) {
			var tempHp = findAttrForCharacter(character,tempHpAttrName);
			if(parseInt(tempHp.get("current")) > parseInt(value)) {
				tempHp.set("current", tempHp.get("current") - value);
				return;
			} else {
				value = value - tempHp.get("current");
				tempHp.set("current", 0);
			}
		}
		// Update the character's health with any remaining damage
		var health = findAttrForCharacter(character,hpAttrName);
		if(parseInt(value) > health.get("current")) {
			health.set("current",0);
		} else {
			health.set("current", health.get("current") - value);
		}

		// Update the health status for each token that represents the character.
		_.each(findObjs({
			_type: "graphic",
			_subtype: "token",
			represents: character.id
		}), function(token) {
		   updateHealthStatus(token);
		});

		// Output the result to the character, gm, and api log
		mySendChat("GM", "/w " + character.get("name").split(" ")[0] + " " + output);
		sendChat(scriptName, "/w gm " + output);
		log(output);
		},

	/**
	 * Heals the specified token for the value and then updates the token using updateHealthStatus
	 * If the token represents a PC and the token was brought from 0 health to positive health, it will clear the
	 * death saving throws for the character using clearDeathSavesForCharacter.
	 */
	healToken = function(tokenId, value) {
		var token = getTokenForId(tokenId);
		var character = getCharacterForTokenId(tokenId);
		var output = "Healing " + character.get("name") + " for " + value + " hit points"
		log("HealToken");
		if(!isNPC(character.id)){
			mySendChat("GM", "/w " + character.get("name").split(" ")[0] + " " + output);
			if(parseInt(token.get(token_hp_curr)) == 0 && parseInt(value) > 0) {
				mySendChat(scriptName, "/w gm Clearing death saving throws for " + character.get("name"));
				clearDeathSavesForCharacter(character);
			}
		}
		sendChat(scriptName,"/w gm " + output);
		token.set(token_hp_curr, parseInt(token.get(token_hp_curr)) + parseInt(value));
		updateHealthStatus(token);
	},

	/**
	 * Heals the character for the value and then updates all tokens for the character using updateHealthStatus.
	 * NOTE: Does not work for NPCs, only PCs
	 */
	healCharacter = function(characterId, value) {
		// Make sure that the character is not an NPC character. Otherwise this would affect all tokens linked to the NPC.
		// This should not be a problem, but I'd rather check anyway.
		if(isNPC(characterId)) {
			var error = "ERROR - [healCharacter] cannot heal an NPC using this method, please use --" + tokenIdOption + " or healToken";
			myWhisperGM(scriptName,error);
			log(error);
			return;
		}
		// Get the character for the id, and heal the character
		var character = getCharacterForId(characterId),
			health = findAttrForCharacter(character,hpAttrName);
		if(parseInt(health.get("current")) == 0 && parseInt(value) > 0) {
			mySendChat(scriptName, "/w gm Clearing death saving throws for " + character.get("name"));
			clearDeathSavesForCharacter(character);
		}

		if(parseInt(parseInt(health.get("current")) + parseInt(value)) > parseInt(health.get("max"))) {
			value = parseInt(health.get("max")) - parseInt(health.get("current"));
			health.set("current", health.get("max"));
		} else {
			health.set("current", parseInt(health.get("current")) + parseInt(value));
		}

		// Update the health status for each token that represents the character.
		_.each(findObjs({
			_type: "graphic",
			_subtype: "token",
			represents: character.id
		}), function(token) {
		   updateHealthStatus(token);
		});

		var output = "Healing " + character.get("name") + " for " + value + " hit points";
		mySendChat("GM", "/w " + character.get("name").split(" ")[0] + " " + output);
		//mySendChat("GM", "&{template:dmg} {{damage=1}} {{dmg1flag=1}} {{dmg1=" + value + "}} {{dmg1type=Healing}} {{charname=" + character.get("name") + "}}");
		sendChat(scriptName, "/w gm " + output);
		log(output);
	},

	/**
	 * Sets the temporary hit points for the character based on the given value
	 */
	giveTempHpToToken = function(tokenId, value) {
		var character = getCharacterForTokenId(tokenId);
		giveTempHpToCharacter(character.id, value);
	},

	/**
	 * Sets the temporary hit points for the character based on the given value
	 * NOTE: Does not work for NPCs, only PCs
	 * NOTE: If the character already has temporary hit points. Will keep the greater of the two values. If the new value is
	 *       less than the previous. The gm is informed of the situation and it will be their job to manually update.
	 */
	giveTempHpToCharacter = function(characterId, value) {
		// Make sure that the character is not an NPC character. Otherwise this would affect all tokens linked to the NPC.
		// This should not be a problem, but I'd rather check anyway.
		if(isNPC(characterId)) {
			var error = "ERROR - [giveTempHpToCharacter] cannot give temporary hit points to an NPC using this method, please use --tokenids or giveTempHpToToken";
			myWhisperGM(scriptName,error);
			log(error);
		}
		var character = getCharacterForId(characterId);
		var tempHp = findAttrForCharacter(character,tempHpAttrName);
		if(!tempHp) {
			tempHp = createObj("attribute",{
				name: tempHpAttrName,
				characterid: character.id,
				value: 0
			});
		}
		if(tempHp.get("current") >= value) {
			var output = character.get("name") + " already has more temporary hit points than " + value;
			mySendChat(scriptName, "/w gm " + output);
			log(output);
		} else {
			tempHp.set("current", value);
			var output = character.get("name") + " now has " + value + " temporary hit points";
			mySendChat(scriptName, "/w " + character.get("name").split(" ")[0] + output);
			myWhisperGM(scriptName,output);
			log(output);
		}
	},

	/**
	 * This method handles the toggleConcentrationCommand defined above
	 */
	handleToggleConcentration = function(msg) {
		if(msg.type == "api" && msg.content.indexOf(toggleConcentrationCommand) !== -1) {
			if(!msg.selected) {
				mySendChat(scriptName, "/w " + msg.who.split(" ")[0] + " You must have a token selected to use " + toggleConcentrationCommand);
				return;
			}
			_.each(msg.selected, function(sel) {
				toggleTokenConcentration(getTokenForId(sel._id));
			});
		}
	},

	/**
	 * Toggles the specified token's concentration status using isTokenConcentrating and concentration_marker
	 */
	toggleTokenConcentration = function(token) {
		token.set(concentration_marker, !isTokenConcentrating(token));
	},

	/**
	 * Determines whether the specified token is concentrating by check it's status marker defined in concentration_marker above
	 */
	isTokenConcentrating = function(token) {
	    return token.get(concentration_marker);
	},

	/**
	 * Determines whether the character is concentrating by checking for a concentration attribute being set as defined above
	 * in concentration_set_attribute. 
	 *
	 * NOTE: This is not currently used except where it is checked in damageCharacter. There is no functionality that sets this
	 *       concentration to "on" or "off"
	 */
	isCharacterConcentrating = function(characterId) {
		if(isNPC(characterId)) {
			log("ERROR - [isCharacterConcentrating] cannot use this method for an NPC, please use isTokenConcentrating");
		}
		var concentration = findAttrForCharacter(character,concentration_set_attribute);
		if(!concentration || concentration.get("current") != 1) {
			return false;
		}
		return true;
	},

	/**
	 * Performs the concentration check using the character's stats and outputs the result to the GM in a roll template.
	 * This has the functionality to account for the War Caster's Feat of D&D 5e but has not been needed as of yet and
	 * therefore has not been tested.
	 */
	concentrationCheck = function(character, damage) {
		var attribute_name,
            roll = "[[d20]]";
		if(!isNPC(character.id)) {
			log("Concentration check for PC");
			attribute_name = pc_concentration_attribute;
			if(findAttrForCharacter(character,war_caster_feat_attribute)) {
				roll = "[[2d20kh1]]";
			}
		} else {
		    log("Concentration check for NPC");
		    var attr = findAttrForCharacter(character,npc_concentration_attribute);
		    log(attr);
		    if(attr && attr.get("current") == "") {
		        attribute_name = npc_concentration_base_stat;
            } else {
		        attribute_name = npc_concentration_attribute;
            }
        }
		log("Attribute_name : " + attribute_name);
		var attribute_mod = "[[@{" + character.get("name") + "|" + attribute_name + "}]]";
		log("Attribute_mod : " + attribute_mod);

		var saveDc = "[[{10,floor(" + damage + "/2)}kh1]]";
        var saveDc = 10;
		var output = character.id + " " + damage + " " + saveDc + " " + roll + " " + attribute_mod;

		sendChat(scriptName, "/w gm " + output, function(ops) {
			var content = processInlinerolls(ops[0]),
				values = content.split(" "),
				character = getCharacterForId(values[0]),
				damage = values[1],
				saveDcCalc = parseInt(values[2]),
                saveDcOut = 10,
				saveDcOut = "[[{10,floor(" + damage + "/2)}kh1]]",
				roll = parseInt(values[3]),
				attribute_mod = parseInt(values[4]),
				result = "Maintained}}";
			if((roll + attribute_mod) < saveDcCalc) {
				result = "Broken}}";
			}
			var output = "&{template:default} {{name=Concentration Check for " + character.get("name") + "}}"
					+ "{{Damage taken=" + damage + "}}"
					+ "{{Save DC=" + saveDcOut + "}}"
					+ "{{Roll=[[" + roll + "+" + attribute_mod + "]]}}"
					+ "{{Concentration=" + result;
			if(!isNPC(character.id)) {
				mySendChat("GM", "/w " + character.get("name").split(" ")[0] + " " + output);
			}
			mySendChat("character|"+character.id,"/w gm " + output);
		});
	},

	/**
	 * Basic method that returns token for the given id
	 */
	getTokenForId = function(id) { return getObj("graphic", id); },

	/**
	 * Basic function that returns the character for the given id
	 */
	getCharacterForId = function(id) { return getObj("character", id); },

	/**
	 * This method returns the character object for the given token id.
	 */
	getCharacterForTokenId = function(id) {
		var token = getTokenForId(id);
		return getCharacterForId(token.get("represents"));
	},

	/**
	 * Determines whether the character id belongs to an NPC or a PC
	 */
	isNPC = function(characterId) {
		return (getAttrByName(characterId, npcAttrName) == npcAttrValue);
	},

	/**
	 * Allows a message to be sent to the chat log but will not be stored in the archive.
	 * Useful for display an error message to a specific user.
	 */
	mySendChat = function(speakingAs, message) {
		sendChat(speakingAs, message, null, {noarchive: true});
	},

	/**
	 * Allows a message to be seen by the GM in the chat log that will not be stored in the chat archive.
	 * Useful for displaying a message directly to the GM.
	 */
	myWhisperGM = function(speakingAs, message) {
		mySendChat(speakingAs, "/w gm " + message);
	},

	/**
	 * Converts any inline rolls that are contained in a message sent by the chat log and returns the converted string.
	 */
	processInlinerolls = function(msg) {
		if (_.has(msg, 'inlinerolls')) {
			return _.chain(msg.inlinerolls)
				.reduce(function(previous, current, index) {
					previous['$[[' + index + ']]'] = current.results.total || 0;
					return previous;
				},{})
				.reduce(function(previous, current, index) {
					return previous.replace(index, current);
				}, msg.content)
				.value();
		} else {
			return msg.content;
		}
	},
	
	/**
	 * This method handles the toggleRageCommand defined above and toggles the rage status on each of the selected tokens
	 */
	handleToggleRage = function(msg) {
		if(msg.type == "api" && msg.content.indexOf(toggleRageCommand) !== -1) {
			if(!msg.selected) {
				mySendChat(scriptName, "/w " + msg.who.split(" ")[0] + " You must have a token selected to use " + toggleRageCommand);
				return;
			}
			_.each(msg.selected, function(sel) {
				toggleTokenRage(getTokenForId(sel._id));
			});
		}
	},
	
	/**
	 * Toggles the rage status on the given token
	 */
	toggleTokenRage = function(token) {
		token.set(rage_marker, !isTokenRaging(token));
	},
	
	/**
	 * Determines if the given token has the rage status 
	 */
	isTokenRaging = function(token) {
		return token.get(rage_marker);
	},
	
	isResistantToType = function(character, type) {
		
		
	},

	/**
	 * Displays to the API console that the script has loaded properly. Only used when the API is reloaded.
	 */
	checkInstall = function() {
		log(scriptName + " v" + version + " Ready");
	},

	/**
	 * Registers the various event handlers that are used by the script.
	 */
	registerEventHandlers = function() {
		on("change:token:bar1_value", updateHealthStatus);
		on("change:attribute:current", clearDeathSavingThrows);
		on("chat:message", handleModHealth);
		on("chat:message", handleToggleConcentration);
		on("chat:message", handleToggleRage);
	};

	return {
		CheckInstall: checkInstall,
		RegisterEventHandlers: registerEventHandlers
	};
}());

on('ready', function() {
    'use strict';
    HitpointTracker.CheckInstall();
    HitpointTracker.RegisterEventHandlers();
});