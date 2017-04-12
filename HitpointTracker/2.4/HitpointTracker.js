/**
 *	Useful Macros
 *
 *	Damage
 *		!modHealth --sel --damage ?{Damage|0} ?{Type|Acid|Bludgeoning|Cold|Fire|Force|Lightning|Necrotic|Piercing|Poison|Psychic|Radiant|Slashing|Thunder|Bludgeoning(Magic)|Piercing(Magic)|Slashing(Magic)}
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
	var obj = {};

	var version = 2.4,
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
		
		innateResistanceAttrName = "resistances",
		innateImmunitiesAttrName = "immunities",
		innateVulnerabilitiesAttrName = "vulnerablilities",
		
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
				var typeIndex = this.getIndexForKeyword(keyword.toLowerCase());
				if(typeIndex == 0) {
					log("Damage Type '" + keyword + "' not found");
					return false;
				}
				
				var bearResist = false;
				var bearTotemAttr = GeneralScripts.FindAttrForCharacter(character, totemBearAttrName);
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
			
			getDamageMod: function(character, keyword){
				if(isNPC(character.id)){
					return this.getNpcDamageMod(character, keyword);
				} else {
					return this.getCharacterDamageMod(character, keyword);
				}
			},
			
			getNpcDamageMod: function(npc, keyword) {
				var mod = 1;	// Default to normal damage =	  1;
								// Resistant				=	0.5;
								// Immune 					=	  0;
								// Vulnerable 				=	  2;
				
				if(!isNPC(npc.id)) { return mod; }
				log("Damage Type:" + keyword);
				
				var attr;
				// Check Vulnerabilities
				attr = GeneralScripts.FindAttrForCharacter(npc, npcVulnerabilityAttrName);
				log(attr);
				if(attr && attr.get("current").toLowerCase().indexOf(keyword) !== -1){
					mod = 2;
				}
				
				// Check Resistances
				attr = GeneralScripts.FindAttrForCharacter(npc, npcResistanceAttrName);
				if(attr && attr.get("current").toLowerCase().indexOf(keyword) !== -1){
					mod = 0.5;
				}
				
				// Check Immunities
				log("Immunities");
				attr = GeneralScripts.FindAttrForCharacter(npc, npcImmunityAttrName);
				log(attr);
				if(attr && attr.get("current").toLowerCase().indexOf(keyword) !== -1){
					mod = 0;
				}
				
				return mod;
				
			},
			
			getCharacterDamageMod: function(character, keyword) {
				var mod = 1;	// Default to normal damage =	  1;
								// Resistant				=	0.5;
								// Immune 					=	  0;
								// Vulnerable 				=	  2;
				
				if(isNPC(character.id)) { return mod; }
				log("Damage Type:" + keyword);
				
				var attr;
				// Check Vulnerabilities
				attr = GeneralScripts.FindAttrForCharacter(character, innateVulnerabilitiesAttrName);
				if(attr && attr.get("current").toLowerCase().indexOf(keyword) !== -1){
					mod = 2;
				}
				
				// Check Resistances
				attr = GeneralScripts.FindAttrForCharacter(character, innateResistanceAttrName);
				if(attr && attr.get("current").toLowerCase().indexOf(keyword) !== -1){
					mod = 0.5;
				}
				
				// Check Raging
				if(isCharacterRaging(character) && this.isRageResistantToType(character, keyword)) {
					mod = 0.5;
				}
				
				// Check Immunities
				log("Immunities");
				attr = GeneralScripts.FindAttrForCharacter(character, innateImmunitiesAttrName);
				log(attr);
				if(attr && attr.get("current").toLowerCase().indexOf(keyword) !== -1){
					mod = 0;
				}
				
				return mod;
			}
		},
		//================================================================================
		
		
		//================================================================================
		// Used for Concentration specific calculations of DamageCharacter/DamageTokens
		//================================================================================
		pc_constitution_modifier = "constitution_mod",
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

		var character = GeneralScripts.GetCharacterForTokenId(token.id);
		var showWoundsAttr = GeneralScripts.FindAttrForCharacter(character,showWoundsAttrName);
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
	 * Clears the deathsaving throws for the character when it detects that their health raises from 
	 * 0 or less to positive. Uses the dead_ratio and hpAttrName values defined above.
	 */
	clearDeathSavingThrows = function(obj, prev) {
		// Clear the death saving throws from the character if they just came back from 0 hp.
		if(obj.get("name") == hpAttrName && prev.current <= (obj.get("max") * dead_ratio) && obj.get("current") > (obj.get("max") * dead_ratio)) {
			var character = GeneralScripts.GetCharacterForId(obj.get("characterid"));
			GeneralScripts.WhisperGM(scriptName, "Clearing death saving throws for " + character.get("name"));
			clearDeathSavesForCharacter(character);
		}
	},

	/**
	 * This method resets the 6 attributes that keep track of the death saving throws for the character.
	 */
	clearDeathSavesForCharacter = function(character) {
		var fail1 = GeneralScripts.FindAttrForCharacter(character,"deathsave_fail1");
		var fail2 = GeneralScripts.FindAttrForCharacter(character,"deathsave_fail2");
		var fail3 = GeneralScripts.FindAttrForCharacter(character,"deathsave_fail3");
		var succ1 = GeneralScripts.FindAttrForCharacter(character,"deathsave_succ1");
		var succ2 = GeneralScripts.FindAttrForCharacter(character,"deathsave_succ2");
		var succ3 = GeneralScripts.FindAttrForCharacter(character,"deathsave_succ3");
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
            content = GeneralScripts.ProcessInlineRolls(msg),
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
			GeneralScripts.SendChat(scriptName, "/w " + who + errorMsg);
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
		GeneralScripts.SendChat(scriptName, "/w " + who + output)
	},

	/**
	 * Damages the specified token for the value and then updates the token using updateHealthStatus
	 * Future update will also pass in a damage type that will be used in determining damage with resistances and immunities.
	 */
	damageToken = function(tokenId, value, type) {
		var character = GeneralScripts.GetCharacterForTokenId(tokenId),
			token = GeneralScripts.GetTokenForId(tokenId),
			output = "Damaging " + character.get("name") + " for " + value + " " + type + " damage";

		if(isTokenConcentrating(token)) {
			concentrationCheck(character,value);
		}
		var mod = DAMAGE_TYPES.getDamageMod(character, type);
		if(mod == 2) {
			output = "Damaging " + character.get("name") + " for " + value + " hit points, vulnerable  to " + type + " damage";
		} else if(mod == 0.5) {
			output = "Damaging " + character.get("name") + " for " + Math.floor(value * mod) + " hit points, resisted " + Math.ceil(value * mod) + " " + type + " damage";
		} else if(mod == 0) {
			output = character.get("name") + " is immune to " + type + " damage.";
		}
		value = Math.floor(value * mod);
		if(!isNPC(character.id)) {
			GeneralScripts.SendChat("GM", "/w " + character.get("name").split(" ")[0] + " " + output);
		}
		sendChat(scriptName, "/w gm " + output);
		log(output);

		if(!isNPC(character.id) && value > 0 && getAttrByName(character.id, tempHpAttrName) > 0) {
			// Check for temporary HP to reduce
			var tempHp = GeneralScripts.FindAttrForCharacter(character,tempHpAttrName);
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
			GeneralScripts.WhisperGM(scriptName, error);
			log(error);
			return;
		}

		// Get the character for the id, mainly only need this for the character's name, but it is also needed for concentration checks
		var character = GeneralScripts.GetCharacterForId(characterId);
		var output = "Damaging " + character.get("name") + " for " + value + " hit points";
		// Check if the character is concentrating
		if(isCharacterConcentrating(characterId)) {
			concentrationCheck(character, value);
		}

		// Do damage to any temporary hit points of the character before actual hit points.
		if(getAttrByName(character.id, tempHpAttrName) > 0) {
			var tempHp = GeneralScripts.FindAttrForCharacter(character,tempHpAttrName);
			if(parseInt(tempHp.get("current")) > parseInt(value)) {
				tempHp.set("current", tempHp.get("current") - value);
				return;
			} else {
				value = value - tempHp.get("current");
				tempHp.set("current", 0);
			}
		}
		// Update the character's health with any remaining damage
		var health = GeneralScripts.FindAttrForCharacter(character,hpAttrName);
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
		GeneralScripts.SendChat("GM", "/w " + character.get("name").split(" ")[0] + " " + output);
		sendChat(scriptName, "/w gm " + output);
		log(output);
		},

	/**
	 * Heals the specified token for the value and then updates the token using updateHealthStatus
	 * If the token represents a PC and the token was brought from 0 health to positive health, it will clear the
	 * death saving throws for the character using clearDeathSavesForCharacter.
	 */
	healToken = function(tokenId, value) {
		var token = GeneralScripts.GetTokenForId(tokenId);
		var character = GeneralScripts.GetCharacterForTokenId(tokenId);
		var output = "Healing " + character.get("name") + " for " + value + " hit points"
		log("HealToken");
		if(!isNPC(character.id)){
			GeneralScripts.SendChat("GM", "/w " + character.get("name").split(" ")[0] + " " + output);
			if(parseInt(token.get(token_hp_curr)) == 0 && parseInt(value) > 0) {
				GeneralScripts.SendChat(scriptName, "/w gm Clearing death saving throws for " + character.get("name"));
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
			GeneralScripts.WhisperGM(scriptName,error);
			log(error);
			return;
		}
		// Get the character for the id, and heal the character
		var character = GeneralScripts.GetCharacterForId(characterId),
			health = GeneralScripts.FindAttrForCharacter(character,hpAttrName);
		if(parseInt(health.get("current")) == 0 && parseInt(value) > 0) {
			GeneralScripts.SendChat(scriptName, "/w gm Clearing death saving throws for " + character.get("name"));
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
		GeneralScripts.SendChat("GM", "/w " + character.get("name").split(" ")[0] + " " + output);
		//GeneralScripts.SendChat("GM", "&{template:dmg} {{damage=1}} {{dmg1flag=1}} {{dmg1=" + value + "}} {{dmg1type=Healing}} {{charname=" + character.get("name") + "}}");
		sendChat(scriptName, "/w gm " + output);
		log(output);
	},

	/**
	 * Sets the temporary hit points for the character based on the given value
	 */
	giveTempHpToToken = function(tokenId, value) {
		var character = GeneralScripts.GetCharacterForTokenId(tokenId);
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
			GeneralScripts.WhisperGM(scriptName,error);
			log(error);
		}
		var character = GeneralScripts.GetCharacterForId(characterId);
		var tempHp = GeneralScripts.FindAttrForCharacter(character,tempHpAttrName);
		if(!tempHp) {
			tempHp = createObj("attribute",{
				name: tempHpAttrName,
				characterid: character.id,
				current: 0
			});
		}
		if(tempHp.get("current") >= value) {
			var output = character.get("name") + " already has more temporary hit points than " + value;
			GeneralScripts.SendChat(scriptName, "/w gm " + output);
			log(output);
		} else {
			tempHp.set("current", value);
			var output = character.get("name") + " now has " + value + " temporary hit points";
			GeneralScripts.SendChat(scriptName, "/w " + character.get("name").split(" ")[0] + output);
			GeneralScripts.WhisperGM(scriptName,output);
			log(output);
		}
	},

	/**
	 * This method handles the toggleConcentrationCommand defined above
	 */
	handleToggleConcentration = function(msg) {
		if(msg.type == "api" && msg.content.indexOf(toggleConcentrationCommand) !== -1) {
			if(!msg.selected) {
				GeneralScripts.SendChat(scriptName, "/w " + msg.who.split(" ")[0] + " You must have a token selected to use " + toggleConcentrationCommand);
				return;
			}
			_.each(msg.selected, function(sel) {
				toggleTokenConcentration(GeneralScripts.GetTokenForId(sel._id));
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
		var concentration = GeneralScripts.FindAttrForCharacter(character,concentration_set_attribute);
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
			if(GeneralScripts.FindAttrForCharacter(character,war_caster_feat_attribute)) {
				var warCasterOutput = character.get("name") + " has advantage on their concentratition check due to the War Caster Feat.";
				log(warCasterOutput);
				GeneralScripts.SendChat(scriptName, warCasterOutput);
				roll = "[[2d20kh1]]";
			}
		} else {
		    log("Concentration check for NPC");
		    var attr = GeneralScripts.FindAttrForCharacter(character,npc_concentration_attribute);
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
			var content = GeneralScripts.ProcessInlineRolls(ops[0]),
				values = content.split(" "),
				character = GeneralScripts.GetCharacterForId(values[0]),
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
				GeneralScripts.SendChat("GM", "/w " + character.get("name").split(" ")[0] + " " + output);
			}
			GeneralScripts.SendChat("character|"+character.id,"/w gm " + output);
		});
	},

	/**
	 * Determines whether the character id belongs to an NPC or a PC
	 */
	isNPC = function(characterId) {
		return Kyle5eOglCompanion.IsNPC(characterId);
	},
	
	/**
	 * This method handles the toggleRageCommand defined above and toggles the rage status on each of the selected tokens
	 */
	handleToggleRage = function(msg) {
		if(msg.type == "api" && msg.content.indexOf(toggleRageCommand) !== -1) {
			if(!msg.selected || msg.content.split(" ").length > 1) {
				var split = msg.content.split(" ");
				if(!msg.selected){
					GeneralScripts.SendChat(scriptName, "/w " + msg.who.split(" ")[0] + " You must have a token selected to use " + toggleRageCommand);
					return;
				} else {
					toggleCharacterRage(split[1]);
					return;
				}
			}
			_.each(msg.selected, function(sel) {
				toggleTokenRage(GeneralScripts.GetTokenForId(sel._id));
			});
		}
	},
	
	/**
	 * Toggles the rage status on the given character id
	 */
	 toggleCharacterRage = function(characterid) {
		 log("toggleCharacterRage");
		 if(isNPC(characterid)) { return; }
		 var character = GeneralScripts.GetCharacterForId(characterid);
		 var token = GeneralScripts.GetTokensForCharacter(character)[0];
		 toggleTokenRage(token);
		 if(isTokenRaging(token)) {
			 //Remove a use of Rage from the character's rage resource
			 var rage = Kyle5eOglCompanion.GetResourceWithName("Rage", character.id);
			 if(!rage) { return; }
			 else if(rage.current < 1) {
				 GeneralScripts.WhisperError(scriptName,character.get("name") + " tried to rage but it was not available.");
				 toggleTokenRage(token);
			 } else {
				 rage.set("current", parseInt(rage.current) - 1);
			 }
		 }
	 },
	
	/**
	 * Toggles the rage status on the given token
	 */
	toggleTokenRage = function(token) {
		log("toggleTokenRage");
		token.set(rage_marker, !isTokenRaging(token));
		var result = token.get(rage_marker);
		var character = GeneralScripts.GetCharacterForTokenId(token.id);
		if(!isNPC(character.id)){
			_.each(GeneralScripts.GetTokensForCharacter(character), function(obj){
				obj.set(rage_marker, result);
			});
			var rage = GeneralScripts.FindOrCreateAttrWithName(character.id,"is_raging");
			if(result) { rage.set({current:1});}
			else {rage.set({current:0});}
		}
	},
	
	/**
	 * Determines if the given token has the rage status 
	 */
	isTokenRaging = function(token) {
		return token.get(rage_marker);
	},
	
	isCharacterRaging = function(character) {
		return isTokenRaging(GeneralScripts.GetTokensForCharacter(character)[0]);
	},
	
	deathSaveEventHandler = function(msg) {
		if(msg.rolltemplate && msg.rolltemplate === "simple" && msg.content.indexOf("^{death-save-u}") !== -1) {
			// Because of the way GeneralScripts.ParseTemplate splits based on '}}' the template for Death Saves interfere with the parsing.
			// To resolve this issue, we replace the rname with different name and assert that our change is there after parsing.
			msg.content = msg.content.replace("^{death-save-u}", "DEATH SAVE");
			var simple = Kyle5eOglCompanion.Parse5eOglRollTemplateSimple(msg);
			log(simple);
			if(simple && simple.rname === "DEATH SAVE" && simple.charname !== ""){
				// Now we need to get the character for the charname output
				var character = GeneralScripts.GetCharacterForName(simple.charname);
				var roll = simple.r1;
				if(simple.r2 && simple.advantage == 1 && simple.r2.total > roll.total 
					|| simple.r2 && simple.disadvantage == 1 && simple.r2.toal < roll.total) {
					roll = simple.r2;
				}
				var result = roll.total;
				var resultbase = (roll.inlinerolls.results.rolls[0].results[1]) ? roll.inlinerolls.results.rolls[0].results[1].v : roll.inlinerolls.results.rolls[0].results[0].v;
				var critfail = (resultbase ===  1);
				var critsucc = (resultbase === 20);
				var resultoutput = "";
				if(critsucc) {
					resultoutput = "CRITICAL SUCCESS: 1HP";
					clearDeathSavesForCharacter(character);
					healCharacter(character.id,1);
				} else if( result < 10 || critfail) {
					var f1 = GeneralScripts.FindOrCreateAttrWithName(character.id,"deathsave_fail1");
					var f2 = GeneralScripts.FindOrCreateAttrWithName(character.id,"deathsave_fail2");
					var f3 = GeneralScripts.FindOrCreateAttrWithName(character.id,"deathsave_fail3");
					var fails = [f1.get("current") === "on",f2.get("current") === "on", f3.get("current") === "on"];
					
					if(!fails[0])       { f1.set({current:"on"}); resultoutput = "FAILED 1 of 3"; }
					else if (!fails[1]) { f2.set({current:"on"}); resultoutput = "FAILED 2 of 3"; }
					else                { f3.set({current:"on"}); resultoutput = "DECEASED";      }
					
					if(critfail) {
						if(!fails[0])   { f2.set({current:"on"}); resultoutput = "FAILED 2 of 3"; }
						else            { f3.set({current:"on"}); resultoutput = "DECEASED";      }
					}
				} else {
					var s1 = GeneralScripts.FindOrCreateAttrWithName(character.id,"deathsave_succ1");
					var s2 = GeneralScripts.FindOrCreateAttrWithName(character.id,"deathsave_succ2");
					var s3 = GeneralScripts.FindOrCreateAttrWithName(character.id,"deathsave_succ3");
					var succs = [s1.get("current") === "on",s2.get("current") === "on",s3.get("current") === "on"];
					
					if(!succs[0])      { s1.set({current:"on"}); resultoutput = "SUCCEEDED 1 of 3"; }
					else if(!succs[1]) { s2.set({current:"on"}); resultoutput = "SUCCEEDED 2 of 3"; }
					else               { s3.set({current:"on"}); resultoutput = "STABILIZED";       }
				}
				var output = Kyle5eOglCompanion.Format5eOglRollTemplateDecription(resultoutput);
				sendChat("character|" + character.id, "@{" + simple.charname + "|wtype}" + output);
			}
		}
	},
	
	hitDiceEventHandler = function(msg) {
		if(msg.rolltemplate && msg.rolltemplate === "simple" && msg.content.indexOf("^{hit-dice-u}") !== -1) {
			// Because of the way GeneralScripts.ParseTemplate splits based on '}}' the template for Hit Dice interfere with the parsing.
			// To resolve this issue, we replace the rname with different name and assert that our change is there after parsing.
			msg.content = msg.content.replace("^{hit-dice-u}", "HIT DICE");
			var simple = Kyle5eOglCompanion.Parse5eOglRollTemplateSimple(msg);
			log(simple);
			if(simple && simple.rname === "HIT DICE" && simple.charname !== "") {
				// Now we need to get the character for the charname output
				var character = GeneralScripts.GetCharacterForName(simple.charname);
				//How many hit dice was the 
				var numberUsed = (simple.mod.split("D")[0] !== "") ? parseInt(simple.mod.split("D")[0]) : 1;

				// Check to see how many hit dice the character has remaining
				var hitDice = GeneralScripts.FindAttrForCharacter(character, "hit_dice");
				var error = ""
				if(!hitDice) {
					error = "Could not find hit dice attribute for character " + simple.charname;
				} else if(parseInt(hitDice.get("current")) < numberUsed) {
					error = simple.charname + " tried to use " + numberUsed + " hit dice and only had " + hitDice.get("current") + " remaining ";
				}
				if(error !== "") {
					GeneralScripts.WhisperGM(scriptName, "<b style='color:red'>ERROR</b> -> " + error);
					return;
				}
				
				// Remove the hit dice from the character sheet.
				hitDice.set("current", parseInt(hitDice.get("current")) - numberUsed);
				
				if(GeneralScripts.FindAttrForCharacter(character, "durable_feat")) {
					log(simple.charname + " has the durable feat, they gain a minimum of 2 times their consitution modifier");
					var rolls = "";
					_.each(msg.inlinerolls[simple.r1.inlineIndex].results.rolls[0].results, function(result){
						rolls = rolls + result.v + " "
					});
					var callback_output = character.id + " [[@{" + simple.charname + "|" + pc_constitution_modifier + "}]] " + rolls.substr(0,rolls.length-1); 
					log(callback_output);
					sendChat(scriptName, "/w gm " + callback_output, function(ops) {
						log(ops);
						var csplit = ops[0].content.split(" ");
						var characterid = csplit[0];
						var charname = GeneralScripts.GetCharacterForId(characterid).get("name");
						var constitution_mod = ops[0].inlinerolls[0].results.total;
						var rolls = csplit.slice(2);
						log(rolls);
						var modified = false;
						var hitDieTotal = 0;
						for(var i = 0; i < rolls.length; i++) {
							if(parseInt(rolls[i]) < constitution_mod) {
								modified = true;
								rolls[i] = constitution_mod;
								hitDieTotal = hitDieTotal + 2 * constitution_mod;
							} else {
								hitDieTotal = hitDieTotal + parseInt(rolls[i]) + constitution_mod;
							}
						}
						if(modified) {
							var newRolls = "";
							_.each(rolls, function(roll) {
								newRolls = newRolls + "[[" + roll + "+" + constitution_mod + "]]+";
							});
							newRolls = newRolls.substr(0,newRolls.length - 1);
							var output = "@{" + charname + "|wtype} &{template:simple} {{rname=DURABLE HIT DICE}} {{normal=1}} {{r1=[[" + newRolls + "]]}} @{" + charname + "|charname_output} --silent";
							sendChat("character|"+characterid, output);
						}
						healCharacter(characterid, hitDieTotal);
					});
					return;
				}
				// Heal the character for the amount rolled
				healCharacter(character.id, simple.r1.total);
			}
		}
	},
	
	secondWindEventHandler = function(msg) {
		if(msg.rolltemplate && msg.rolltemplate === "simple" && msg.content.indexOf("SECOND WIND") !== -1) {
			var simple = Kyle5eOglCompanion.Parse5eOglRollTemplateSimple(msg);
			log(simple);
			if(simple && simple.rname === "SECOND WIND" && simple.charname !== "") {
				var secondWind;
				// Now we need to get the character for the charname output
				var character = GeneralScripts.GetCharacterForName(simple.charname);
				
				//Check to see if the Character has their second wind still available
				var error = null;
				var secondWind = Kyle5eOglCompanion.GetResourceWithName("Second Wind", character.id);
				log("SecondWindEventHandler");
				log(secondWind);
				if(!secondWind) {
					return;
				} else if(secondWind.current < 1) {
					error = simple.charname + " tried to use second wind but it was not available";
				}
				
				if(error) {
					GeneralScripts.WhisperGM(scriptName, "<b style='color:red'>ERROR</b> -> " + error);
					return;
				}
				
				// Remove the second wind use from the character sheet.
				secondWind.set("current", parseInt(secondWind.current) - 1);
				
				// Heal the character for the amount rolled
				healCharacter(character.id, simple.r1.total);
			}
		}
	},
	
	songOfRestEventHandler = function(msg) {
		if(msg.rolltemplate && msg.rolltemplate === "simple" && msg.content.indexOf("SONG OF REST") !== -1) {
			var simple = Kyle5eOglCompanion.Parse5eOglRollTemplateSimple(msg);
			log(simple);
			if(simple && simple.rname === "SONG OF REST" && simple.r1.total > 0) {
				var output = "[Song of Rest amount](!modHealth --sel --heal amount)";
				output = output.replace(/amount/g,simple.r1.total);
				output = Kyle5eOglCompanion.Format5eOglRollTemplateDecription(output);
				log(output);
				GeneralScripts.WhisperGM(scriptName,output);
			}
		}
	},
	
	healingPotionEventHandler = function(msg) {
		if(msg.rolltemplate && msg.rolltemplate === "simple" 
			&& msg.content.indexOf("POTION OF ") !== -1 && msg.content.indexOf("HEALING")) {
			var simple = Kyle5eOglCompanion.Parse5eOglRollTemplateSimple(msg);
			log(simple);
			if(simple && simple.rname.indexOf("POTION OF") !== -1 && simple.rname.indexOf("HEALING") !== -1 && simple.charname !== "") {
				var itemname = "Potion of Healing";
				if(simple.rname.indexOf("GREATER") !== -1) {
					itemname = itemname.replace("of", "of Greater");
				} else if(simple.rname.indexOf("SUPERIOR") !== -1) {
					itemname = itemname.replace("of", "of Superior");
				} else if(simple.rname.indexOf("SUPREME") !== -1) {
					itemname = itemname.replace("of", "of Supreme");
				}
				log(itemname);
				var healingPotion;
				
				// Now we need to get the character for the charname output
				var character = GeneralScripts.GetCharacterForName(simple.charname);
				//Check to see if the Character has the potion in their inventory
				var potion = Kyle5eOglCompanion.GetItemWithName(itemname, character.id);
				log(potion);
				var error = null;
				if(!potion) { return; }
				else if (parseInt(potion.count) < 1) {
					error = simple.charname + " tried to use a " + itemname + " but did not have any available";
				}
				
				if(error) {
					GeneralScripts.WhisperGM(scriptName, "<b style='color:red'>ERROR</b> -> " + error);
					return;
				}
				// Remove the potion from the character's inventory.
				potion.set("count", parseInt(potion.count) -1);
				
				// Heal the character for the amount rolled
				healCharacter(character.id, simple.r1.total);
			}
		}
	},
	
	updatePotionMacro = function() {
		var macro = findObjs({
			_type: "macro",
			name: "Take-Potion"
		})[0];
		if(!macro) {return;}
		var action = "@{selected|wtype} &{template:simple} {{normal=1}} {{rname=POTION OF ?{Potion"
			+ "|Basic,HEALING&#125;&#125; {{r1=[[2d4cs0cf0+2]]"
			+ "|Greater,GREATER HEALING&#125;&#125; {{r1=[[4d4cs0cf0+4]]"
			+ "|Superior,SUPERIOR HEALING&#125;&#125; {{r1=[[8d4cs0cf0+8]]"
			+ "|Supreme,SUPREME HEALING&#125;&#125; {{r1=[[10d4cs0cf0+20]]"
			+ "}}} {{mod=}} @{selected|charname_output}";
		macro.set("action",action);
	},
	
	damageEventHandler = function(msg){
		log(msg);
		if(["atkdmg","dmg", "npcaction", "npcdmg"].indexOf(msg.rolltemplate) === -1) { return; }
		log("damageEventHandler");
		/**
		 * Parses the information from the message and returns it as a nice JSON object
		 */
		var template = Kyle5eOglCompanion.ParseRollTemplate(msg);
		log(template);
		
		var saveForHalf = (template.save && template.savedesc && template.savedesc.toLowerCase().indexOf("half") !== -1) ? true : false;
		
		var dmg = "[Apply name amount](!modHealth --sel --damage amount type)";
		var heal = "[Heal name amount](!modHealth --sel --heal amount)";
		var htype = "Healing";
		/**
		 * Get the individual damage values that could exist within the template.
		 */
		var dmg1  = (template.dmg1flag && template.dmg1type) ? dmg.replace("name", "dmg1").replace(/amount/g, template.dmg1.total).replace("type", template.dmg1type) : null,
			crit1 = (template.crit1    && template.dmg1type) ? dmg.replace("name", "crit1").replace(/amount/g, template.dmg1.total + template.crit1.total).replace("type", template.dmg1type) : null,
			dmg2  = (template.dmg2flag && template.dmg2type) ? dmg.replace("name", "dmg2").replace(/amount/g, template.dmg2.total).replace("type", template.dmg2type) : null,
			crit2 = (template.crit2    && template.dmg2type) ? dmg.replace("name", "crit2").replace(/amount/g, template.dmg2.total + template.crit2.total).replace("type", template.dmg2type) : null,
			hldmg = (template.hldmg    && template.dmg1type) ? dmg.replace("name", "hldmg").replace(/amount/g, template.dmg1.total + template.hldmg.total + (template.crit1 ? template.crit1.total : 0)).replace("type", template.dmg1type) : null,
			savedmg1 = (saveForHalf    && template.dmg1type) ? dmg.replace("name", "save").replace(/amount/g, Math.floor((template.dmg1.total + (template.hldmg ? template.hldmg.total : 0) + (template.crit1 ? template.crit1.total : 0)) * 0.5)).replace("type", template.dmg1type) : null;
		
		/**
		 * Check to see if either of the damage types (dmg1type/dmg2type) are 'Healing' instead of damage. If so, change the API
		 * command buttons to call !modHealth --heal.
		 */
		if(template.dmg1type && template.dmg1type.trim() == "Healing") {
			dmg1     = dmg1     ? dmg1.replace("Apply", "Heal").replace("--damage", "--heal").replace(" Healing", "")     : null;
			crit1    = crit1    ? crit1.replace("Apply", "Heal").replace("--damage", "--heal").replace(" Healing", "")    : null;
			hldmg    = hldmg    ? hldmg.replace("Apply", "Heal").replace("--damage", "--heal").replace(" Healing", "")    : null;
			savedmg1 = savedmg1 ? savedmg1.replace("Apply", "Heal").replace("--damage", "--heal").replace(" Healing", "") : null;
		}
		if(template.dmg2type && template.dmg2type.trim() == "Healing") {
			dmg2     = dmg2     ? dmg2.replace("Apply", "Heal").replace("--damage", "--heal").replace(" Healing", "")     : null;
			crit2    = crit2    ? crit2.replace("Apply", "Heal").replace("--damage", "--heal").replace(" Healing", "")    : null;
		}
		
		var output = (dmg1 ? dmg1 : "") + (crit1 ? crit1 : "") + (hldmg ? hldmg : "")
			+ (dmg2 ? dmg2 : "") + (crit2 ? crit2 : "") + (savedmg1 ? savedmg1 : "");
		
		log(output);
		
		if(output != "") {
			/**
			 * Whispers the output to the GM by prepending "/w gm " to the front of the text output
			 */
			GeneralScripts.WhisperGM(scriptName, Kyle5eOglCompanion.Format5eOglRollTemplateDecription(output));
		}
	};

	/**
	 * Displays to the API console that the script has loaded properly. Only used when the API is reloaded.
	 */
	obj.checkInstall = function() {
		log(scriptName + " v" + version + " Ready");
		updatePotionMacro();
	};

	/**
	 * Registers the various event handlers that are used by the script.
	 */
	obj.registerEventHandlers = function() {
		on("change:token:bar1_value", updateHealthStatus);
		on("change:attribute:current", clearDeathSavingThrows);
		on("chat:message", handleModHealth);
		on("chat:message", handleToggleConcentration);
		on("chat:message", handleToggleRage);
		on("chat:message", deathSaveEventHandler);
		on("chat:message", hitDiceEventHandler);
		on("chat:message", secondWindEventHandler);
		on("chat:message", healingPotionEventHandler);
		on("chat:message", damageEventHandler);
		on("chat:message", songOfRestEventHandler);
	};

	return obj;
}());

on('ready', function() {
    'use strict';
    HitpointTracker.checkInstall();
    HitpointTracker.registerEventHandlers();
});
