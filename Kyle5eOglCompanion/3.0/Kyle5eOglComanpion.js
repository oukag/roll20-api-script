var Kyle5eOglCompanion = Kyle5eOglCompanion || (function(){
	'use strict';
	
	var version = 3.0,
		scriptName = "5e OGL Companion",
	
	StatusMarkers = {
		// Each of these markers require 'status_' prepended to the value in order to modify and use later in the script.
		RAGE          : "status_strong",
		CONCENTRATION : "status_stopwatch",
		BLOODIED      : "status_red",
		DEAD          : "status_dead",
		PRONE         : "status_half-haze",
	},
	
	TokenSpecifics = {
		HP_BAR         : "bar1",
		AC_BAR         : "bar2",
		NPC_SPEED_BAR  : "bar3",
		TEMP_HP_BAR    : "bar3",
		BLOODIED_RATIO : 0.5,
		DEAD_RATIO     : 0,
		ALLOW_NEGATIVE : false,
	},
	
	SpecificAttributes = {
		LEVEL                  : "level",
		NPC                    : "npc",
		HP                     : "hp",
		TEMP_HP                : "hp_temp",
		AC                     : "ac",
		HIT_DICE               : "hit_dice",
		EXHAUSTION             : "exhaustion",
		INSPIRATION            : "inspiration",
		INSPIRATION_VALUE      : "inspiration_value",	// Used to store the bard's inspiration die value for use in the roll or 'advantage' if inspiration is from the GM.
		SHOW_WORUNDS           : "showWounds",			// Determines if the bloodied status should be applied to tokens
		// Death saving throws
		DEATHSAVE_FAIL1        : "deathsave_fail1",
		DEATHSAVE_FAIL2        : "deathsave_fail2",
		DEATHSAVE_FAIL3        : "deathsave_fail3",
		DEATHSAVE_SUCC1        : "deathsave_succ1",
		DEATHSAVE_SUCC2        : "deathsave_succ2",
		DEATHSAVE_SUCC3        : "deathsave_succ3",
		// Rest attributes
		LONG_REST_RESOURCES    : "long_rest_resources",		// Comma separated list of resources that are reset on a long rest. Can use inline rolls to update, for example Wand of Magic Missiles[[1d6+1]]
		SHORT_REST_RESOURCES   : "short_rest_resources",	// Comma separated list of resources that are reset on a short rest. Can use inline rolls to update, for example Wand of Magic Missiles[[1d6+1]]
		SHORT_REST_ABILITIES   : "short_rest_abilities",	// Comma separated list of character abilities that must be created in the character's attributes and abilities tab
		// Resistance/Vulnerability/Immunity Specific
		INNATE_RESISTANCES     : "resistances",			// Should follow the same pattern as NPC resistance/vulnerability/immunity
		INNATE_IMMUNITIES      : "immunities",			// Should follow the same pattern as NPC resistance/vulnerability/immunity
		INNATE_VULNERABILITIES : "vulnerabilities",		// Should follow the same pattern as NPC resistance/vulnerability/immunity
		NPC_RESISTANCES        : "npc_resistances",
		NPC_IMMUNITIES         : "npc_immunities",
		NPC_VULNERABILITIES    : "npc_vulnerabilities",
		// Rage Specific
		BEAR_TOTEM             : "bear_totem",
		IS_RAGING              : "is_raging",
		// Feat Specific
		WAR_CASTER_FEAT        : "war_caster_feat",
		DURABLE_FEAT           : "durable_feat",
		//NPC Specific
		NPC_HP                 : "npcd_hp",
		NPC_AC                 : "npcd_ac",
		NPC_SPEED              : "npcd_speed",
	},
	
	DamageTypes = DamageTypes || (function(){
		var obj = {};
		
		var TYPES = {
			ACID:        {name: "Acid",        rage: false, bear:  true, magic:  true},
			BLUDGEONING: {name: "Bludgeoning", rage:  true, bear:  true, magic: false},
			COLD:        {name: "Cold",        rage: false, bear:  true, magic:  true},
			FIRE:        {name: "Fire",        rage: false, bear:  true, magic:  true},
			FORCE:       {name: "Force",       rage: false, bear:  true, magic:  true},
			LIGHTNING:   {name: "Lightning",   rage: false, bear:  true, magic:  true},
			NECROTIC:    {name: "Necrotic",    rage: false, bear:  true, magic:  true},
			PIERCING:    {name: "Piercing",    rage:  true, bear:  true, magic: false},
			POISON:      {name: "Poison",      rage: false, bear:  true, magic:  true},
			PSYCHIC:     {name: "Psychic",     rage: false, bear: false, magic:  true},
			RADIANT:     {name: "Radiant",     rage: false, bear:  true, magic:  true},
			SLASHING:    {name: "Slashing",    rage:  true, bear:  true, magic: false},
			THUNDER:     {name: "Thunder",     rage: false, bear:  true, magic:  true},
		},
		
		getTypeForKeyword = function(keyword) {
			if(!keyword) { General.whisperError(scriptName,"No damage keyword provided."); return null;}
			var result = null;
			_.each(TYPES, function(type){
				if(type.name.toLowerCase().indexOf(keyword.toLowerCase().trim()) !== -1) {
					result = type;
				}
			});
			return result;
		},
		
		isRageResistantToType = function(charId, keyword) {
			var type = getTypeForKeyword(keyword);
			if(!type) { General.whisperError(scriptName, "Could not find damage type for keyword '" + keyword + "'."); return; }
			var resist;
			
			var bearTotemAttr = General.findAttr(charId, SpecificAttributes.BEAR_TOTEM);
			if(bearTotemAttr && ["1", "on", "true"].indexOf(bearTotemAttr.get("current")) !== -1) {
				resist = type.bear;
			} else {
				resist = type.rage;
			}
			log("Resist: " + resist);
			return resist;
		},
		
		isKeywordInAttr = function(charId, keyword, magical, silvered, adamantine, attrName) {
			var result = false;
			var attr = General.findAttr(charId, attrName);
			if(attr && attr.get("current").toLowerCase().indexOf(keyword.toLowerCase().trim()) !== -1) {
				// The damage type was found in the attribute.
				result = true;
				// Check to see if the result might change due to magical, silvered, or adamantine weapons.
				_.each(attr.get("current").toLowerCase().split(";"), function(value) {
					if(value.indexOf(keyword.toLowerCase().trim()) == -1) { return; }
					if(    (value.indexOf("adamantine") !== -1 && adamantine) 
						|| (value.indexOf("silver")     !== -1 && silvered)
						|| (value.indexOf("nonmagic")   !== -1 && magical) ) {
							result = false;
					}
				});
			}
			return result;
		},
		
		getCharacterDamageMod = function(charId, keyword, magical, silvered, adamantine) {
			var mod = 1;	// Normal 	  = 1		// Default
							// Resistant  = 0.5
							// Immune     = 0
							// Vulnerable = 2
			
			log("Damage Type: " + keyword);
			
			//Check Vulnerabilities
			if(isKeywordInAttr(charId, keyword, magical, silvered, adamantine, SpecificAttributes.INNATE_VULNERABILITIES)) { mod = 2; }
			
			//Check Resistances and Rage
			if(isKeywordInAttr(charId, keyword, magical, silvered, adamantine, SpecificAttributes.INNATE_RESISTANCES)
				|| isCharacterRaging(charId) && isRageResistantToType(charId, keyword)) {
				mod = 0.5;
			}
			
			//Check Immunities
			if(isKeywordInAttr(charId, keyword, magical, silvered, adamantine, SpecificAttributes.INNATE_IMMUNITIES)) { mod = 0; }
			
			return mod;
		},
		
		getNpcDamageMod = function(charId, keyword, magical, silvered, adamantine) {
			log("getNpcDamageMod("+charId +","+keyword+","+magical+","+silvered+","+adamantine+")");
			var mod = 1;	// Normal 	  = 1		// Default
							// Resistant  = 0.5
							// Immune     = 0
							// Vulnerable = 2
			log("Damage Type: " + keyword);
			
			if(isKeywordInAttr(charId, keyword, magical, silvered, adamantine, SpecificAttributes.NPC_VULNERABILITIES)) { mod = 2;}
			if(isKeywordInAttr(charId, keyword, magical, silvered, adamantine, SpecificAttributes.NPC_RESISTANCES)) { mod = 0.5; }
			if(isKeywordInAttr(charId, keyword, magical, silvered, adamantine, SpecificAttributes.NPC_IMMUNITIES)) { mod = 0; }
			
			return mod;
		};
		
		
		obj.getDamageMod = function(charId, keyword, magical, silvered, adamantine) {
			log("getDamageMod("+charId +","+keyword+","+magical+","+silvered+","+adamantine+")");
			if(isNPC(charId)) { return getNpcDamageMod(charId, keyword, magical, silvered, adamantine); }
			else { return getCharacterDamageMod(charId, keyword, magical, silvered, adamantine); }
		};
		
		obj.isMagicalDamage = function(keyword) {
			var type = getTypeForKeyword(keyword);
			return (type && type.magic) ? type.magic : false;
		};
		
		return obj;
	}()),
		
	Resource = Resource || (function(){
		var obj = {
			resource    : "",
			id          : "",
			name        : "",
			current     : "",
			max         : "",
			itemid      : "",
			characterid : "",
		};
			
		var SUFFIX = {
			NAME   : "_name",
			ITEMID : "_itemid",
		},
		
		/*
		 * Should only be called after the characterid is set for the object.
		 */
		getAttrNotNull = function(n, v) {
			var attr = General.findAttr(obj.characterid, n);
			if(v == null) { v = "current"; }
			return (attr != null) ? attr.get(v) : "";
		},
		
		update = function(res,charId) {
			obj.resource = res;
			obj.characterid = charId;
			
			obj.name = getAttrNotNull(res + SUFFIX.NAME);
			obj.itemid = getAttrNotNull(res + SUFFIX.ITEMID);
			
			var attr = General.findAttr(obj.characterid, res);
			obj.current = attr ? attr.get("current") : "";
			obj.max = attr ? attr.get("max") : "";
			obj.id = attr ? attr.id : "";
			return obj;
		};
		
		obj.set = function(n,v) {
			var attr;
			switch (n) {
				case "name":
					obj.name = v;
					attr = General.findAttr(characterid, obj.resource + SUFFIX.NAME);
					attr.set("current", v);
					break;
				case "current":
				case "max":
					if(n === "current") { obj.current = v; }
					else { obj.max = v; }
					attr = General.findAttr(obj.characterid, obj.resource);
					attr.set(n, v);
					break;
				default:
					log("Could not find attribute '" + n + "' for resource. It may be 'private' or not exist");
			}
			return obj;
		},
		
		obj.resetResourceWithName = function(charId, resName, amount){
			var resource = Resource.getForName(resName.trim(), charId);
			var error = null;
			if(resource) {
				if(amount === "max" && resource.max == "") {
					error = "Tried to set resource '" + resName + "' to max, but no max is set for the resource";
				} else if(resource.max == "") {
					// Overwrite the current amount of the resource with the amount, regardless of its current value
					resource.set("current", amount);
				} else if(resource.max) {
					var newAmount = (parseInt(resource.current||0) + parseInt(amount||0) < parseInt(resource.max) ? parseInt(resource.current) + parseInt(amount||0) : parseInt(resource.max));
					resource.set("current", newAmount);
				} else {
					error = "Something went wrong with reseting resource '" + resName + "' for " + charname; 
				}
			}
			if(error) { General.whisperError(scriptname, error); }
		};
		
		obj.getForName = function(resourceName, charId) {
			log("Resource.getForName(" + resourceName + "," + charId + ")");
			var res = null, error = null;
			// See if the resource with the name exists
			var resourceNameAttr = null;
			_.each(General.findAttrs(charId, resourceName), function(attr){
				if(attr.get("name").indexOf(SUFFIX.NAME) !== -1){ log(attr); resourceNameAttr = attr; }
			});
			if(!resourceNameAttr) {
				error = "Could not find resource with name '" + resourceName + "' for character with id '" + charId + "'";
			} else {
				var resourceAttr = General.findAttr(charId, resourceNameAttr.get("name").replace(SUFFIX.NAME,""));
				if(!resourceAttr) { error = "Could not find resource values for resource with name '" + resourceNameAttr.get("name").replace(SUFFIX.NAME,"") + "' for the character with id '" + charId + "'"; } 
				else { res = resourceAttr.get("name"); }
			}
			if(error) { General.whisperError(scriptName,error); return null; }
			return update(res,charId);
		};
		
		obj.getForId = function(resId) {
			//log("getForId");
			var error = null;
			var resourceAttr = getObj("attribute", resId);
			if(!resourceAttr) {
				General.whisperError(scriptName,"Could not find resource with id '" + resId + "'");
				return null; 
			}
			return update(resourceAttr.get("name"), resourceAttr.get("characterid"));
		};
		
		return obj;
	}()),
	
	Item = Item || (function(){
		var obj = {
			rowid        : "",
			characterid  : "",
			name         : "",
			count        : "",
			weight       : "",
			ac           : "",
			attackid     : "",
			content      : "",
			damage       : "",
			damagetype   : "",
			equippedflag : "",
			modifiers    : "",
			properties   : "",
			resourceid   : "",
			type         : "",
		};
			
		var PREFIX = {
			REPEATING_INVENTORY : "repeating_inventory_",
		},
		
		SUFFIX = {
			AC           : "_itemac",
			ATTACKID     : "_itemattackid",
			CONTENT      : "_itemcontent",
			COUNT        : "_itemcount",
			DAMAGE       : "_itemdamage",
			DAMAGETYPE   : "_itemdamagetype",
			EQUIPPEDFLAG : "_equippedflag",
			MODIFIERS    : "_itemmodifiers",
			NAME         : "_itemname",
			PROPERTIES   : "_itemproperties",
			RESOURCEID   : "_itemresourceid",
			TYPE         : "_itemtype",
			WEIGHT       : "_itemweight",
		},
		
		/*
		 * Should only be called after the characterid is set for the object.
		 */
		getAttrNotNull = function(n, v) {
			var attr = General.findAttr(obj.characterid, n);
			if(v == null) { v = "current"; }
			return (attr != null) ? attr.get(v) : "";
		};
		
		obj.set = function(n,v) {
			var suffix = null;
			switch(n){
				case "ac":           obj.ac = v;           suffix = SUFFIX.AC;           break;
				case "attackid":     obj.attackid = v;     suffix = SUFFIX.ATTACKID;     break;
				case "content":      obj.content = v;      suffix = SUFFIX.CONTENT;      break;
				case "count":        obj.count = v;        suffix = SUFFIX.COUNT;        break;
				case "damage":       obj.damage = v;       suffix = SUFFIX.DAMAGE;       break;
				case "damagetype":   obj.damagetype = v;   suffix = SUFFIX.DAMAGETYPE;   break;
				case "equippedflag": obj.equippedflag = v; suffix = SUFFIX.EQUIPPEDFLAG; break;
				case "modifiers":    obj.modifiers = v;    suffix = SUFFIX.MODIFIERS;    break;
				case "name":         obj.name = v;         suffix = SUFFIX.NAME;         break;
				case "properties":   obj.properties = v;   suffix = SUFFIX.PROPERTIES;   break;
				case "type":         obj.type = v;         suffix = SUFFIX.TYPE;         break;
				case "weight":       obj.weight = v;       suffix = SUFFIX.WEIGHT;       break;
				default:
					log("Could not find attribute '" + n + "' for item. It may be 'private' or not exist");
					break;
			}
			if(suffix) {
				var attr = General.findOrCreateAttr(obj.characterid, PREFIX.REPEATING_INVENTORY + obj.rowid + suffix);
				attr.set("current",v);
			}
			return obj;
		};
		
		obj.getForName = function(itemName, charId) {
			log("Item.getForName " + itemName + ", " + charId);
			if(!itemName || !charId || isNPC(charId)) { return null; }
			var error = null;
			// See if the item with the given name exists
			var itemNameAttr = null; 
			_.each(General.findAttrs(charId,itemName),function(attr){
				if(attr.get("name").indexOf(SUFFIX.NAME) !== -1 && attr.get("name").indexOf(PREFIX.REPEATING_INVENTORY) !== -1) {
					itemNameAttr = attr;
				}
			});
			log(itemNameAttr);
			if(!itemNameAttr) {
				error = "Could not find item with name '" + itemName + "' in inventory for character with id '" + charId + "'";
			}
			if(error) { 
				log(scriptName + "-> Item.getForName -> " + error); 
				return null;
			}
			// Get each of the attributes that contain the individual values of the item.
			var prefix = itemNameAttr.get("name").replace(SUFFIX.NAME, "");
							
			obj.rowid =        prefix.replace(PREFIX.REPEATING_INVENTORY,"");
			obj.name =         itemName;
			obj.characterid =  charId;
			obj.weight =       getAttrNotNull(prefix + SUFFIX.WEIGHT);
			obj.content =      getAttrNotNull(prefix + SUFFIX.CONTENT);
			obj.type =         getAttrNotNull(prefix + SUFFIX.TYPE);
			obj.equippedflag = getAttrNotNull(prefix + SUFFIX.EQUIPPEDFLAG);
			obj.damage =       getAttrNotNull(prefix + SUFFIX.DAMAGE);
			obj.damagetype =   getAttrNotNull(prefix + SUFFIX.DAMAGETYPE);
			obj.attackid =     getAttrNotNull(prefix + SUFFIX.ATTACKID);
			obj.ac =           getAttrNotNull(prefix + SUFFIX.AC);
			obj.count =        getAttrNotNull(prefix + SUFFIX.COUNT);
			obj.modifiers =    getAttrNotNull(prefix + SUFFIX.MODIFIERS);
			obj.properties =   getAttrNotNull(prefix + SUFFIX.PROPERTIES);
			obj.resourceid =   getAttrNotNull(prefix + SUFFIX.RESOURCEID);
				
			return obj;
		};
		
		return obj;
	}()),
	
	Spell = Spell || (function(){
		var obj = {
			name               : "",
			level              : "",
			school             : "",
			castingtime        : "",
			range              : "",
			comp               : "",
			comp_v             : "",
			comp_s             : "",
			comp_m             : "",
			comp_materials     : "",
			concentrationflag  : "",
			concentration      : "",
			duration           : "",
			content            : "",
			attack             : "",
			damage             : "",
			damagetype         : "",
			damage_progression : "",
			prep               : "",
			attackinfoflag     : "",
			output             : "",
			description        : "",
			athigherlevels     : "",
			attackid           : "",
			rollcontent        : "",
			options_flag       : "",
			name_base          : "",
			characterid        : "",
			rowid              : "",
		};
		
		var PREFIX = {
			REPEATING_SPELL : "repeating_spell-",
		},
		
		SUFFIX = {
			ATHIGHERLEVELS     : "_spellathigherlevels",
			ATTACKID           : "_spellattackid",
			ATTACKINFOFLAG     : "_spellattackinfoflag",
			ATTACK             : "_spellattack",
			CASTINGTIME        : "_spellcastingtime",
			COMP               : "_spellcomp",
			COMP_V             : "_spellcomp_v",
			COMP_S             : "_spellcomp_s",
			COMP_M             : "_spellcomp_m",
			COMP_MATERIALS     : "_spellcomp_materials",
			CONCENTRATIONFLAG  : "_spellconcentrationflag",
			CONCENTRATION      : "_spellconcentration",
			CONTENT            : "_spellcontent",
			DAMAGE_PROGRESSION : "_spell_damage_progression",
			DAMAGE             : "_spelldamage",
			DAMAGETYPE         : "_spelldamagetype",
			DESCRIPTION        : "_spelldescription",
			DURATION           : "_spellduration",
			LEVEL              : "_spelllevel",
			NAME_BASE          : "_spellname_base",
			NAME               : "_spellname",
			OPTIONS_FLAG       : "_options-flag",
			OUTPUT             : "_spelloutput",
			PREP               : "_prep",
			RANGE              : "_spellrange",
			ROLLCONTENT        : "_rollcontent",
			SCHOOL             : "_spellschool",
		},
		
		/*
		 * Should only be called after the characterid is set for the object.
		 */
		getAttrNotNull = function(n, v) {
			var attr = General.findAttr(obj.characterid, n);
			if(v == null) { v = "current"; }
			return (attr != null) ? attr.get(v) : "";
		},
		
		
		update = function(spelllevel,rowId, charId) {
			var prefix = repeating_spell_prefix + ((spelllevel == "0") ? "cantrip" : spelllevel);
			
			obj.characterid = charId;
			obj.rowId = rowId;
			obj.level = spelllevel;
			
			obj.athigherlevels =     getAttrNotNull(prefix + SUFFIX.ATHIGHERLEVELS);
			obj.attackid =           getAttrNotNull(prefix + SUFFIX.ATTACKID);
			obj.attackinfoflag =     getAttrNotNull(prefix + SUFFIX.ATTACKINFOFLAG);
			obj.attack =             getAttrNotNull(prefix + SUFFIX.ATTACK);
			obj.castingtime =        getAttrNotNull(prefix + SUFFIX.CASTINGTIME);
			obj.comp =               getAttrNotNull(prefix + SUFFIX.COMP);
			obj.comp_v =             getAttrNotNull(prefix + SUFFIX.COMP_V);
			obj.comp_s =             getAttrNotNull(prefix + SUFFIX.COMP_S);
			obj.comp_m =             getAttrNotNull(prefix + SUFFIX.COMP_M);
			obj.comp_materials =     getAttrNotNull(prefix + SUFFIX.COMP_MATERIALS);
			obj.concentrationflag =  getAttrNotNull(prefix + SUFFIX.CONCENTRATIONFLAG);
			obj.concentration =      getAttrNotNull(prefix + SUFFIX.CONCENTRATION);
			obj.content =            getAttrNotNull(prefix + SUFFIX.CONTENT);
			obj.damage_progression = getAttrNotNull(prefix + SUFFIX.DAMAGE_PROGRESSION);
			obj.damage =             getAttrNotNull(prefix + SUFFIX.DAMAGE);
			obj.damagetype =         getAttrNotNull(prefix + SUFFIX.DAMAGETYPE);
			obj.description =        getAttrNotNull(prefix + SUFFIX.DESCRIPTION);
			obj.duration =           getAttrNotNull(prefix + SUFFIX.DURATION);
			obj.name_base =          getAttrNotNull(prefix + SUFFIX.NAME_BASE);
			obj.name =               getAttrNotNull(prefix + SUFFIX.NAME);
			obj.options_flag =       getAttrNotNull(prefix + SUFFIX.OPTIONS_FLAG);
			obj.output =             getAttrNotNull(prefix + SUFFIX.OUTPUT);
			obj.prep =               getAttrNotNull(prefix + SUFFIX.PREP);
			obj.range =              getAttrNotNull(prefix + SUFFIX.RANGE);
			obj.rollcontent =        getAttrNotNull(prefix + SUFFIX.ROLLCONTENT);
			obj.school =             getAttrNotNull(prefix + SUFFIX.SCHOOL);
			return obj;
		};
		
		obj.set =function(n,v) {
			var suffix = null;
			switch (n) {
				case "athigherlevels":     obj.athigherlevels = v;     suffix = SUFFIX.ATHIGHERLEVELS;     break;
				case "attackid":           obj.attackid = v;           suffix = SUFFIX.ATTACKID;           break;
				case "attackinfoflag":     obj.attackinfoflag = v;     suffix = SUFFIX.ATTACKINFOFLAG;     break;
				case "attack":             obj.attack = v;             suffix = SUFFIX.ATTACK;             break;
				case "castingtime":        obj.castingtime = v;        suffix = SUFFIX.CASTINGTIME;        break;
				case "comp_v":             obj.comp_v = v;             suffix = SUFFIX.COMP_V;             break;
				case "comp_s":             obj.comp_s = v;             suffix = SUFFIX.COMP_S;             break;
				case "comp_m":             obj.comp_m = v;             suffix = SUFFIX.COMP_M;             break;
				case "comp_materials":     obj.comp_materials = v;     suffix = SUFFIX.COMP_MATERIALS;     break;
				case "concentrationflag":  obj.concentrationflag = v;  suffix = SUFFIX.CONCENTRATIONFLAG;  break;
				case "concentration":      obj.concentration = v;      suffix = SUFFIX.CONCENTRATION;      break;
				case "content":            obj.content = v;            suffix = SUFFIX.CONTENT;            break;
				case "damage_progression": obj.damage_progression = v; suffix = SUFFIX.DAMAGE_PROGRESSION; break;
				case "damage":             obj.damage = v;             suffix = SUFFIX.DAMAGE;             break;
				case "damagetype":         obj.damagetype = v;         suffix = SUFFIX.DAMAGETYPE;         break;
				case "description":        obj.description = v;        suffix = SUFFIX.DESCRIPTION;        break;
				case "duration":           obj.duration = v;           suffix = SUFFIX.DURATION;           break;
				case "level":              obj.level = v;              suffix = SUFFIX.LEVEL;              break;
				case "name_base":          obj.name_base = v;          suffix = SUFFIX.NAME_BASE;          break;
				case "name":               obj.name = v;               suffix = SUFFIX.NAME;               break;
				case "options_flag":       obj.options_flag = v;       suffix = SUFFIX.OPTIONS_FLAG;       break;
				case "output":             obj.output = v;             suffix = SUFFIX.OUTPUT;             break;
				case "prep":               obj.prep = v;               suffix = SUFFIX.PREP;               break;
				case "range":              obj.range = v;              suffix = SUFFIX.RANGE;              break;
				case "rollcontent":        obj.rollcontent = v;        suffix = SUFFIX.ROLLCONTENT;        break;
				case "school":             obj.school = v;             suffix = SUFFIX.SCHOOL;             break;
				default:
					log("Could not find attribute '" + n + "' for spell. It may be 'private' or not exist");
					break;
			}
			if(suffix) {
				var attr = General.findOrCreateAttr(obj.characterid, PREFIX.REPEATING_SPELL + obj.level + "_" + obj.rowId + suffix);
				attr.set("current", v);
			}
			return obj;
		};
		
		obj.getForSpelllevelAndRowId = function(spelllevel, rowId, charId){
			log("Spell.getForSpelllevelAndRowId(" + spelllevel + "," + rowId + "," + charId + ")");
			var error = null;
			var prefix = PREFIX.REPEATING_SPELL + ((spelllevel == "0") ? "cantrip" : spelllevel);
			// See if the spell for the given row id and spell level exists
			var spellname_baseAttr = General.findAttr(charId, prefix + SUFFIX.NAME_BASE);
			if(!spellname_baseAttr) {
				error = "Could not find spell for level '" + spelllevel + "' and row id '" + rowId + "' for character with id '" + charId + "'";
				General.whisperError(scriptName, error);
				return null;
			}
			
			return update(spelllevel,rowId,charId);
		};
		
		obj.getForName = function(spellName, charId) {
			log("Spell.getForName " + spellName + ", " + charId);
			var error = null;
			// See if the item with the given name exists
			var rowid = null,
				level = null;
			_.each(General.findAttrs(charId,spellName),function(attr){
				if(attr.get("name").indexOf(SUFFIX.NAME) !== -1 && attr.get("name").indexOf(PREFIX.REPEATING_SPELL) !== -1) {
					// Get the rowid and spell level from the name attr;
					var level_row = attr.get("name").replace(SUFFIX.NAME, "").replace(PREFIX.REPEATING_SPELL,"").split("_");
					level = level_row[0];
					rowid = level_row[1];
				}
			});
			log("spell level: " + level + " rowid: " + rowid);
			if(!level || !rowid) {
				error = "Could not find spell with name '" + spellName + "' in inventory for character with id '" + charId + "'";
			}
			if(error) { 
				log(scriptName + "--> " + error); 
				return null;
			}
			return update(level, rowid, charId);
		};
		
		return obj;
	}()),
	
	General = General ||(function(){
		var obj = {};
		
		/**
		 * Allows a message to be sent to the chat log but will not be stored in the archive.
		 */
		obj.sendChat = function(sender, message, callback, options) {
			if(options) { options.noarchive = true; }
			else { options = {noarchive: true}; }
			sendChat(sender, message, callback, options);
		};
		/**
		 * Allows a message to be sent directly to the gm but will not be stored in the archive
		 */
		obj.whisperGM = function(sender, message, callback, options) { obj.sendChat(sender, "/w gm " + message, callback, options); };		
		/**
		 * Allows a message to be sent to the gm that will be used to inform them that an error occured
		 */
		obj.whisperError = function(sender, message, callback, options) { obj.whisperGM(sender, "<b style='color:red'>ERROR</b> -> " + message, callback, options); };
		obj.getSenderForName = function(name) {
			var character = obj.getCharacterForName(name);
			if(character) { return "character|"+character.id; }
			
			var displayName = name.lastIndexOf(" (GM)") === name.length - 5 ? name.substring(0, name.length -5) : name;
			var player = findObjs({type:"player",displayname:displayName})[0];
			if(player) { return "player|"+player.id; }
			
			return name;
		};

		obj.getToken = function(id) { return getObj("graphic", id); };
		obj.getCharacter = function(id) { return getObj("character", id); };
		obj.getCharacterForName = function(name) { return findObjs({_type:"character",name:name})[0]; };
		obj.getCharacterForToken = function(token) {
			var charId = token.get ? token.get("represents") : (obj.getToken(token) ? obj.getToken(token).get("represents") : null);
			return obj.getCharacter(charId);
		};
		obj.getTokensForCharacter = function(character) {
			var charId = (character.id) ? character.id : character;
			return findObjs({_type:"graphic",_subtype:"token",represents:charId});
		};
		
		/**
		 * Returns a list of all attributes of the character with the given name set as the current value.
		 * This is used to find resources, items, spells, and attacks with given names.
		 */
		obj.findAttrs = function(character, attrName) {
			if(!character || !attrName) { return null; }
			var charId = (character.id) ? character.id : character;
			return findObjs({_type:"attribute",characterid:charId,current:attrName},{caseInsensitive:true});
		};
		/**
		 * Returns the first attribute found for the given character's id under the given attribute name.
		 * If no attribute is found, will return a null variable.
		 */
		obj.findAttr = function(character, attrName) {
			if(!character || !attrName) { return null; }
			var charId = (character.id) ? character.id : character;
			return findObjs({_type:"attribute",characterid:charId,name:attrName},{caseInsensitive:true})[0];
		};
		/**
		 * Will either return the attribute with the name, or create a new attribute with the name and default value.
		 * If not default value is provided, sets the current value to an empty string.
		 */
		obj.findOrCreateAttr = function(character, attrName, current, max) {
			if(!character || !attrName) { return null; }
			var charId = (character.id) ? character.id : character;
			var attr = obj.findAttr(charId, attrName);
			if(attr) { return attr; }
			return createObj("attribute", {characterid:charId,name:attrName,current:(current?current:""),max:(max?max:"")});
		};
		
		/**
		 * Coverts any inline rolls contained in a message and returns the converted string
		 */
		obj.processInlinerolls = function(msg) {
			if (_.has(msg, 'inlinerolls')) {
				return _.chain(msg.inlinerolls)
					.reduce(function(previous, current, index) { previous['$[['+index+']]'] = current.results.total || 0; return previous; },{})
					.reduce(function(previous, current, index) { return previous.replace(index, current); }, msg.content)
					.value();
			}
			else { return msg.content; }
		};
		
		/**
		 * Returns an array of roll template key-value pairs.
		 * For example, {{name=Sample Name}} {{r1=15}} would return the following array
		 *	[ [name,SampleName], [r1,15], ]
		 */
		obj.parseTemplate = function(content) {
			var result = [];
			_.each(content.match(/({{(.*?)=(.*?)}})/g), function(match){
				result.push(match.replace("{{", "").replace("}}","").split("="));
			});
			return result;
		};
		
		obj.getRollForIndex = function(msg, index) {
			var iRolls = msg.inlinerolls[index];
			return {
				inlineIndex: index,
				inlinerolls: (iRolls != null) ? iRolls : null,
				total: (iRolls && iRolls.results && iRolls.results.rolls && iRolls.results.rolls[0] && iRolls.results.rolls[0].dice != 0) ? parseInt(iRolls.results.total) : 0
			};
		};
		
		return obj;
	}()),
	
	RollTemplates = RollTemplates || (function(){
		var obj = {};
		
		obj.TEMPLATES = {
			DESC:      { type: 'desc', fields: [{name:'desc', processed: true, expectInt: false}], },
			SIMPLE:    { type: 'simple',
				fields: [
					{name: 'rname',        processed:  true, expectInt: false},
					{name: 'mod',          processed:  true, expectInt: false},
					{name: 'normal',       processed:  true, expectInt:  true},
					{name: 'advantage',    processed:  true, expectInt:  true},
					{name: 'disadvantage', processed:  true, expectInt:  true},
					{name: 'always',       processed:  true, expectInt:  true},
					{name: 'r1',           processed: false, expectInt: false},
					{name: 'r2',           processed: false, expectInt: false},
					{name: 'charname',     processed:  true, expectInt: false},
				],
			},
			ATK:       { type: 'atk',
				fields: [
					{name: 'rname',        processed:  true, expectInt: false},
					{name: 'mod',          processed:  true, expectInt: false},
					{name: 'normal',       processed:  true, expectInt:  true},
					{name: 'advantage',    processed:  true, expectInt:  true},
					{name: 'disadvantage', processed:  true, expectInt:  true},
					{name: 'always',       processed:  true, expectInt:  true},
					{name: 'r1',           processed: false, expectInt: false},
					{name: 'r2',           processed: false, expectInt: false},
					{name: 'range',        processed:  true, expectInt: false},
					{name: 'desc',         processed:  true, expectInt: false},
					{name: 'charname',     processed:  true, expectInt: false},
				],
			},
			ATKDMG:    { type: 'atkdmg',
				fields: [
					{name: 'rname',        processed:  true, expectInt: false},
					{name: 'mod',          processed:  true, expectInt: false},
					{name: 'normal',       processed:  true, expectInt:  true},
					{name: 'advantage',    processed:  true, expectInt:  true},
					{name: 'disadvantage', processed:  true, expectInt:  true},
					{name: 'always',       processed:  true, expectInt:  true},
					{name: 'attack',       processed:  true, expectInt:  true},
					{name: 'r1',           processed: false, expectInt: false},
					{name: 'r2',           processed: false, expectInt: false},
					{name: 'range',        processed:  true, expectInt: false},
					{name: 'damage',       processed:  true, expectInt:  true},
					{name: 'dmg1flag',     processed:  true, expectInt:  true},
					{name: 'dmg1',         processed: false, expectInt: false},
					{name: 'dmg1type',     processed:  true, expectInt: false},
					{name: 'crit1',        processed: false, expectInt: false},
					{name: 'dmg2flag',     processed:  true, expectInt:  true},
					{name: 'dmg2',         processed: false, expectInt: false},
					{name: 'dmg2type',     processed:  true, expectInt: false},
					{name: 'crit2',        processed: false, expectInt: false},
					{name: 'save',         processed:  true, expectInt:  true},
					{name: 'saveattr',     processed:  true, expectInt: false},
					{name: 'savedesc',     processed:  true, expectInt: false},
					{name: 'savedc',       processed:  true, expectInt:  true},
					{name: 'spelllevel',   processed:  true, expectInt: false},
					{name: 'hldmg',        processed: false, expectInt: false},
					{name: 'desc',         processed:  true, expectInt: false},
					{name: 'charname',     processed:  true, expectInt: false},
				],
			},
			DMG:       { type: 'dmg',
				fields: [
					{name: 'rname',        processed:  true, expectInt: false},
					{name: 'damage',       processed:  true, expectInt:  true},
					{name: 'dmg1flag',     processed:  true, expectInt:  true},
					{name: 'dmg1',         processed: false, expectInt: false},
					{name: 'dmg1type',     processed:  true, expectInt: false},
					{name: 'crit1',        processed: false, expectInt: false},
					{name: 'dmg2flag',     processed:  true, expectInt:  true},
					{name: 'dmg2',         processed: false, expectInt: false},
					{name: 'dmg2type',     processed:  true, expectInt: false},
					{name: 'crit2',        processed: false, expectInt: false},
					{name: 'save',         processed:  true, expectInt:  true},
					{name: 'saveattr',     processed:  true, expectInt: false},
					{name: 'savedesc',     processed:  true, expectInt: false},
					{name: 'savedc',       processed:  true, expectInt:  true},
					{name: 'spelllevel',   processed:  true, expectInt: false},
					{name: 'hldmg',        processed: false, expectInt: false},
					{name: 'desc',         processed:  true, expectInt: false},
					{name: 'charname',     processed:  true, expectInt: false},
				],
			},
			SPELL:     { type: 'spell',
				fields: [
					{name: 'name',           processed:  true, expectInt: false},
					{name: 'level',          processed:  true, expectInt: false},
					{name: 'school',         processed:  true, expectInt: false},
					{name: 'castingtime',    processed:  true, expectInt: false},
					{name: 'range',          processed:  true, expectInt: false},
					{name: 'target',         processed:  true, expectInt: false},
					{name: 'v',              processed:  true, expectInt: false},
					{name: 's',              processed:  true, expectInt: false},
					{name: 'm',              processed:  true, expectInt: false},
					{name: 'material',       processed:  true, expectInt: false},
					{name: 'duration',       processed:  true, expectInt: false},
					{name: 'description',    processed:  true, expectInt: false},
					{name: 'concentration',  processed:  true, expectInt:  true},
					{name: 'athigherlevels', processed:  true, expectInt: false},
					{name: 'charname',       processed:  true, expectInt: false},
				],
			},
			NPCACTION: { type: 'npcaction',
				fields: [
					{name: 'name',         processed:  true, expectInt: false},
					{name: 'rname',        processed:  true, expectInt: false},
					{name: 'rnamec',       processed:  true, expectInt: false},
					{name: 'normal',       processed:  true, expectInt:  true},
					{name: 'advantage',    processed:  true, expectInt:  true},
					{name: 'disadvantage', processed:  true, expectInt:  true},
					{name: 'always',       processed:  true, expectInt:  true},
					{name: 'attack',       processed:  true, expectInt:  true},
					{name: 'r1',           processed: false, expectInt: false},
					{name: 'r2',           processed: false, expectInt: false},
					{name: 'damage',       processed:  true, expectInt:  true},
					{name: 'dmg1flag',     processed:  true, expectInt:  true},
					{name: 'dmg1',         processed: false, expectInt: false},
					{name: 'dmg1type',     processed:  true, expectInt: false},
					{name: 'crit1',        processed: false, expectInt: false},
					{name: 'dmg2flag',     processed:  true, expectInt:  true},
					{name: 'dmg2',         processed: false, expectInt: false},
					{name: 'dmg2type',     processed:  true, expectInt: false},
					{name: 'crit2',        processed: false, expectInt: false},
					{name: 'desc',         processed:  true, expectInt: false},
					{name: 'charname',     processed:  true, expectInt: false},
				],
			},
			NPCDMG:    { type: 'npcdmg',
				fields: [
					{name: 'damage',       processed:  true, expectInt:  true},
					{name: 'dmg1flag',     processed:  true, expectInt:  true},
					{name: 'dmg1',         processed: false, expectInt: false},
					{name: 'dmg1type',     processed:  true, expectInt: false},
					{name: 'crit1',        processed: false, expectInt: false},
					{name: 'dmg2flag',     processed:  true, expectInt:  true},
					{name: 'dmg2',         processed: false, expectInt: false},
					{name: 'dmg2type',     processed:  true, expectInt: false},
					{name: 'crit2',        processed: false, expectInt: false},
					{name: 'charname',     processed:  true, expectInt: false},
				],
			},
		};
		
		var parseTemplate = function(msg, template) {
			var rt = { type: template.type, };
			var processedContent = General.processInlinerolls(msg),
				content = msg.content;
			log(msg);
			
			// Go through any fields that require processed message content, this is anything that does not require specific roll information
			_.each(General.parseTemplate(processedContent), function(field){
				var v = (field[1] != null) ? field[1] : "";
				// For each field, set the value if the key matches the field name, and the field is a processed field.
				_.each(template.fields, function(FIELD) {
					if(FIELD.processed && FIELD.name == field[0]) {
						// If we expected a number, parse it when setting the value.
						rt[FIELD.name] = (FIELD.expectInt) ? parseInt(v) : v; 
					}
				});
			});
			// Go through any fields that require unprocessed message content, this is anything that requires specific roll information
			_.each(General.parseTemplate(content), function(field){
				var v = (field[1] != null) ? parseInt(field[1].replace("$[[","").replace("]]","")) : null;
				// For each field, set the value if the key matches the field name, and the field is NOT a processed field.
				_.each(template.fields, function(FIELD) { 
					if(!FIELD.processed && FIELD.name == field[0]) { 
						log(FIELD.name);
						log(v);
						rt[FIELD.name] = General.getRollForIndex(msg,v); 
					}
				});
			});
			
			// Special for spells and higher level damage from 'atkdmg' & 'dmg'
			if(rt.spelllevel && rt.hldmg) {
				var hllevel = (rt.hldmg.inlinerolls.expression.split("*")[1]||'').split(")")[0];
				rt.spelllevel = parseInt(rt.spelllevel) + parseInt(hllevel);
				if(parseInt(hllevel) == 0) { rt.hldmg = null; }
			}
			
			// Special for spell schools and level from 'spell'
			if(rt.level) {
				var split = rt.level.split(" ");
				rt.school = split[0];
				rt.level  = split[1];
			}
			
			// Return the template
			return rt;
		};
		
		obj.parse = function(msg) {
			var rt = null;
			_.each(obj.TEMPLATES, function(template) { if(msg.rolltemplate == template.type) { rt = parseTemplate(msg,template); } });
			return rt;
		};
		
		obj.formatOutput = function(rt) {
			var output = "";
			_.each(rt, function(value, key) {
				if(typeof rt[key] != 'function' && key !== 'type') { output = output + "{{"+key+"="+value+"}} ";}
				else if(key == 'type') { output = output + "&{template:"+value+"}"; }
			});
			log(output);
			return output;
		};
		
		return obj;
	}()),
	
	handleAmmo = function(msg) {
		log("handleAmmo");
		if(msg.content.indexOf("ammo=") === -1 || msg.content.indexOf("ammo= charname=") !== -1) {
			// UNABLE TO FIND AMMO
			return;
		}
		var contents = General.processInlinerolls(msg);
		log(contents);
		
		// Get the ammo name/id and the uses.
		var ammoRegex = /ammo=.*(?={{|\n|\r)/g;
		var ammoStr = (ammoRegex.exec(contents) ? contents.match(ammoRegex)[0].replace("ammo=","") : contents.split("ammo=")[1]);
		log("Ammo string after regex: '" + ammoStr + "'");
		var ammoSplit = ammoStr.split("--");
		var ammofull = ammoSplit[0].trim();
		var ammoUses = 1;
		_.each(ammoSplit, function(str) {
			// For the uses, we expect it to be sent in as 'uses|X'
			if(str.indexOf("uses|") !== -1 && parseInt(str.split("|")[1]) > 0) {
				ammoUses = parseInt(str.split("|")[1]);
				log(ammofull + " uses " + ammoUses + " resources");
			}
		});
		var charnameRegex = /({{charname=(.*?)}})/g;
		var nameRegex = /({{name=(.*?)}})/g;
		var charname = (contents.indexOf("charname=") !== -1 ? contents.match(charnameRegex)[0] : (contents.indexOf("name=") !== -1 ? contents.match(nameRegex)[0] : null));
		charname = charname.replace("{{","").replace("charname=","").replace("name=","").replace("}}","");
		log("Charname: '" + charname + "'");
		var character = General.getCharacterForName(charname);
		if(ammofull == "" || !character || isNPC(character.id)) { return; }
		
		var ammoresource = null;
		if(ammofull.substring(0,1) === "-") {
			ammoresource = Resource.getForId(ammofull);
		}
		else if(ammofull.indexOf("|") > -1) {
			ammoresource = Resource.getForId(ammofull.split("|")[1]);
			log(ammoresource);
		}
		else {
			ammoresource = Resource.getForName(ammofull.trim(), character.id);
		}
		if(ammoresource && ammoresource.name !== "") {
			log("handleAmmo - resource exists");
			ammoresource.set("current", parseInt(ammoresource.current) - ammoUses);
			log(ammoresource);
			var ammoitem = Item.getForName(ammoresource.name,character.id);
			log(ammoitem);
			if(ammoitem) {
				ammoitem.set("count", parseInt(ammoitem.count) - ammoUses);
				var totalweight = findObjs({type: 'attribute', characterid: character.id, name: "weighttotal"}, {caseInsensitive: true})[0];
				if(ammoitem.weight && totalweight) {
					totalweight.set({current: parseInt(totalweight.get("current")) - parseInt(ammoitem.weight)});
				}
			}
			var output = RollTemplate_Description.formatOutput(ammoresource.name + ":\n" + ((ammoresource.current >= 0) ? ammoresource.current  + " LEFT" : "OUT OF " + (ammoitem ? "AMMO" : "USES")));
			sendChat(General.getSenderForName(msg.who),output)
		}
	},
	
	isNPC = function(character) {
		var charId = (character && character.id) ? character.id : character;
		var attr = General.findOrCreateAttr(charId, SpecificAttributes.NPC);
		return (attr && attr.get("current") == 1);
	},
	
	handleSpellSlot = function(msg) {
		if([RollTemplates.TEMPLATES.SPELL.type, RollTemplates.TEMPLATES.ATKDMG.type, RollTemplates.TEMPLATES.DMG.type].indexOf(msg.rolltemplate) === -1 && ["{{spelllevel=","{{level="].indexOf(msg.content) === -1) { return; }
		log("handleSpellSlot");
		log(msg);
		var template = RollTemplates.parse(msg);
		log(template);
		var spelllevel = null;
		var spellName = null;
		if(template.type === 'spell') {
			spelllevel = template.level;
			spellName = template.name;
		} else {
			spelllevel = template.spelllevel;
			spellName = template.rname;
		}
		log("spelllevel: " + spelllevel);
		var character = General.getCharacterForName(template.charname);
		log("Spellcasting character");
		log(character);
		if(spelllevel === "") {
			var spell = Spell.getForName(spellName, character.id);
			log(spell);
			if(spell && spell.level) { 
				spell.set("level", spell.level); 
				spelllevel = spell.level;
			}
		}
		
		var isTrackableSpellLevel = function(spelllevel) {
			var res = ["1", "2", "3", "4", "5", "6", "7", "8", "9"].indexOf(spelllevel.toString()) !== -1;
			log("isTrackableSpellLevel(" + spelllevel + "): " + res);
			return res;
		};
		if(!character 
			|| isNPC(character.id) 
			|| !spelllevel 
			|| !isTrackableSpellLevel(spelllevel)) 
			{ return; }
		var spellslotCurrent = General.findOrCreateAttr(character.id, "lvl"+spelllevel+"_slots_expended");
		var spellslotMax =  General.findOrCreateAttr(character.id, "lvl"+spelllevel+"_slots_total");
		log(spellslotCurrent);
		log(spellslotMax);
		var spent = parseInt(spellslotCurrent.get("current")||0) - 1;
		log(spent <= parseInt(spellslotMax.get("current")));
		spellslotCurrent.set("current", spent);
		var output = "SPELL SLOT LEVEL " + spelllevel + "\n<span style='color: red'>" +
			spent + " OF " + spellslotMax.get("current") + "</span> REMAINING";
		sendChat(General.getSenderForName(msg.who), RollTemplate_Description.formatOutput(output));
	},
	
	clearSpellSlotsForCharacter = function(charId) {
		var remainingAttrName = "lvlSPELLLEVEL_slots_expended";
		var maxAttrName = "lvlSPELLLEVEL_slots_total";
		for(var spelllevel = 1; spelllevel <= 9; spelllevel++) {
			var remaining = General.findOrCreateAttr(charId, remainingAttrName.replace("SPELLLEVEL", spelllevel));
			var max = General.findAttr(charId, maxAttrName.replace("SPELLLEVEL", spelllevel));
			if(max) { remaining.set("current",max.get("current")); }
		}
	},

	/**
	 * This method resets the 6 attributes that keep track of the death saving throws for the character.
	 */
	clearDeathSavesForCharacter = function(character) {
		var charId = (character.id ? character.id : character);
		var fail1 = General.findAttr(charId,SpecificAttributes.DEATHSAVE_FAIL1);
		var fail2 = General.findAttr(charId,SpecificAttributes.DEATHSAVE_FAIL2);
		var fail3 = General.findAttr(charId,SpecificAttributes.DEATHSAVE_FAIL3);
		var succ1 = General.findAttr(charId,SpecificAttributes.DEATHSAVE_SUCC1);
		var succ2 = General.findAttr(charId,SpecificAttributes.DEATHSAVE_SUCC2);
		var succ3 = General.findAttr(charId,SpecificAttributes.DEATHSAVE_SUCC3);
		if(fail1) {fail1.set({current:"0"});};
		if(fail2) {fail2.set({current:"0"});};
		if(fail3) {fail3.set({current:"0"});};
		if(succ1) {succ1.set({current:"0"});};
		if(succ2) {succ2.set({current:"0"});};
		if(succ3) {succ3.set({current:"0"});};
	},
	
	deathSaveEventHandler = function(msg) {
		if(msg.rolltemplate && msg.rolltemplate === RollTemplates.TEMPLATES.SIMPLE.type && msg.content.indexOf("^{death-save-u}") !== -1) {
			// Because of the way General.parseTemplate splits based on '}}' the template for Death Saves interfere with the parsing.
			// To resolve this issue, we replace the rname with different name and assert that our change is there after parsing.
			msg.content = msg.content.replace("^{death-save-u}", "DEATH SAVE");
			var simple = RollTemplates.parse(msg)
			log(simple);
			if(simple && simple.type == RollTemplates.TEMPLATES.SIMPLE.type && simple.rname === "DEATH SAVE" && simple.charname !== ""){
				// Now we need to get the character for the charname output
				var character = General.getCharacterForName(simple.charname);
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
					// Set the character's health to 1.
					healCharacter(character.id, 1);
				} else if( result < 10 || critfail) {
					var f1 = General.findOrCreateAttr(character.id,SpecificAttributes.DEATHSAVE_FAIL1);
					var f2 = General.findOrCreateAttr(character.id,SpecificAttributes.DEATHSAVE_FAIL2);
					var f3 = General.findOrCreateAttr(character.id,SpecificAttributes.DEATHSAVE_FAIL3);
					var fails = [f1.get("current") === "on",f2.get("current") === "on", f3.get("current") === "on"];
					
					if(!fails[0])       { f1.set({current:"on"}); resultoutput = "FAILED 1 of 3"; }
					else if (!fails[1]) { f2.set({current:"on"}); resultoutput = "FAILED 2 of 3"; }
					else                { f3.set({current:"on"}); resultoutput = "DECEASED";      }
					
					if(critfail) {
						if(!fails[0])   { f2.set({current:"on"}); resultoutput = "FAILED 2 of 3"; }
						else            { f3.set({current:"on"}); resultoutput = "DECEASED";      }
					}
				} else {
					var s1 = General.findOrCreateAttr(character.id,SpecificAttributes.DEATHSAVE_SUCC1);
					var s2 = General.findOrCreateAttr(character.id,SpecificAttributes.DEATHSAVE_SUCC2);
					var s3 = General.findOrCreateAttr(character.id,SpecificAttributes.DEATHSAVE_SUCC3);
					var succs = [s1.get("current") === "on",s2.get("current") === "on",s3.get("current") === "on"];
					
					if(!succs[0])      { s1.set({current:"on"}); resultoutput = "SUCCEEDED 1 of 3"; }
					else if(!succs[1]) { s2.set({current:"on"}); resultoutput = "SUCCEEDED 2 of 3"; }
					else               { s3.set({current:"on"}); resultoutput = "STABILIZED";       }
				}
				var output = RollTemplates.formatOutput({type: RollTemplates.TEMPLATES.DESC.type, desc:resultoutput});
				sendChat("character|" + character.id, "@{" + simple.charname + "|wtype}" + output);
			}
		}
	},
	
	resetResources = function(resAttrName, charId) {
		var resAttr = General.findAttr(charId, resAttrName);
		if(!resAttr || resAttr.get("current") === "") { return null; }
		var resources = resAttr.get("current");
		_.each(resources.split(","), function(res) {
			var resName = (res.indexOf("|") !== -1 ? res.split("|")[0] : res);
			var resetAmount = (res.indexOf("|") !== -1 ? res.split("|")[1] : "max");
			resources = resources.replace("|" + resetAmount, "");
			sendChat(scriptName, resName + "|" + resetAmount, function(ops) {
				var contents = General.processInlinerolls(ops[0]);
				var args = contents.split("|");
				Resource.resetResourceWithName(charId, args[0], args[1]);
				if(args[1] !== "max") {
					var charname = General.getCharacter(charId).get("name");
					var output = RollTemplates.formatOutput({
						type: RollTemplates.TEMPLATES.SIMPLE.type,
						rname: resName,
						mod: resetAmount.replace("[[","").replace("]]",""),
						normal: 1,
						r1: args[1],
						charname: charname
					});
					General.sendChat("GM", "/w " + charname.split(" ")[0] + output);
					General.whisperGM(scriptName, output);
				}
			});
		});
		return resources.replace(/, /g, ",<br>");
	},
	
	outputShortRestAbilities = function(charId) {
		var srAbilities = General.findAttr(charId, SpecificAttributes.SHORT_REST_ABILITIES);
		var charname = General.getCharacter(charId).get("name").replace(/\)/g,"&"+"#41;");
		if(!srAbilities || srAbilities.get("current") === "") { return; }
		var charFName = charname.split(" ")[0];
		var output = "/w " + charFName + " &{template:default} {{name=" + charFName + " - Short Rest}} ";
		_.each(srAbilities.get("current").split(","), function(ablName) {
			ablName = ablName.trim();
			var normalizedAblName = ablName.replace(/-/g," ").replace(/_/g, " ");
			var str = "[ABLITY_OUT](~CHARNAME|ABILITY)";
			output = output + "{{[" + normalizedAblName + "](!&"+"#13;&"+"#37;{" + charname + "|" + ablName + "})}} ";
		});
		return output;
	},
	
	handleLongRest = function(msg) {
		if(msg.type == "api" && msg.content.indexOf("!longrest") !== -1) {
			var charids = [];
			if(msg.selected) {
				_.each(msg.selected, function(sel){
					charids.push(General.getCharacterForToken(sel._id).id);
				});
			} else if(msg.content.indexOf("--charid") !== -1) {
				_.each(msg.content.split("--"), function(str){
					if(str.indexOf("charid") !== -1) {
						var split = str.split(" ");
						charids = split.slice(1,split.length);
					}
				});
			}
			log(charids);
			var error = "";
			_.each(charids, function(charId){
				if(isNPC(charId)) {General.whisperError(scriptName, "Cannot use !longrest on NPCs"); return; }
				// Clear and expended spells for the character
				log("Long rest for character - " + General.getCharacter(charId).get("name"));
				log("Clear spell slots");
				clearSpellSlotsForCharacter(charId);
				
				//Reset the character's hit points
				log("Reset hit points");
				var hp = General.findAttr(charId, SpecificAttributes.HP);
				if(hp) { healCharacter(charId, hp.get("max")); }
				
				if(parseInt(hp.get("current")) != parseInt(hp.get("max"))) {
					error =  error + "<p>The hit points for character <b>'" + General.getCharacter(charId).get("name")
						+ "'</b> did not update properly. Please delete and reset attribute with name <b>'" 
						+ SpecificAttributes.HP + "'</b> and run <b>!updateDefaultToken</b> for the character.</p>"
				}
				
				log("Regain hit dice");
				var level = General.findAttr(charId, SpecificAttributes.LEVEL);
				var hd = General.findOrCreateAttr(charId, SpecificAttributes.HIT_DICE);
				var hdRegain;
				if(level) {
					if(hd.get("max") === "") { hd.set("max",level.get("current")); }
					var maxRegain  = Math.ceil(parseInt(level.get("current"))/2),
						hdCurr = parseInt(hd.get("current")),
						hdMax =  parseInt(hd.get("max"));
					hdRegain = (hdMax - hdCurr > maxRegain) ? maxRegain : hdMax - hdCurr ;
					hd.set("current", hdCurr + hdRegain);
				}
				
				log("Decrement exhaustion");
				var exhaustion = General.findOrCreateAttr(charId,SpecificAttributes.EXHAUSTION);
				var exhaustionCurrent = parseInt(exhaustion.get("current")||1);
				if(exhaustionCurrent > 0) {
					exhaustion.set("current", exhaustionCurrent - 1);
				}
				
				log("Long and short rest resources");
				var lrResources = resetResources(SpecificAttributes.LONG_REST_RESOURCES,charId);
				var srResources = resetResources(SpecificAttributes.SHORT_REST_RESOURCES,charId);
				var resourceOut = null;
				if(srResources && lrResources) { resourceOut = "{{Resources=" + srResources + ",<br>" + lrResources + "}}"; }
				else if(srResources) { resourceOut = "{{Resources=" + srResources + "}}"; }
				else if(lrResources) { resourceOut = "{{Resources=" + lrResources + "}}"; }
				var charname = General.getCharacter(charId).get("name");
				var output = "&{template:default} {{name=" + charname + " - Long Rest}} "
					+ "{{Hitpoints reset=" + hdRegain + " hit dice}} {{Spell slots=Exhaustion " + exhaustion.get("current") + "}} "
					+ (resourceOut ? resourceOut : "");
				log(output);
				General.whisperGM(scriptName, output);
				General.sendChat("GM", "/w " + charname.split(" ")[0] + output);
				
				// Remove inspiration if it's not from the GM
				var inspiration = General.findAttr(charId,SpecificAttributes.INSPIRATION);
				var inspiration_value = General.findAttr(charId,SpecificAttributes.INSPIRATION_VALUE);
				if(inspiration && inspiration_value && inspiration_value.get("current") != "advantage") {
					inspiration.set({current:""});
					inspiration_value.set({current:""});
				}
			});
			if(error != "") {
				log(error);
				General.whisperError(scriptName, error);
			}
		}
	},
	
	handleUpdateDefaultToken = function(msg) {
		if(msg.type == "api" && msg.content.indexOf("!updateDefaultToken") !== -1) {
			if(!msg.selected) { General.whisperError(scriptName, "You must select a token to use !updateDefaultToken."); return;}
			_.each(msg.selected, function(sel) {
				var character = General.getCharacterForToken(sel._id);
				var defaulttoken = (character.defaulttoken ? JSON.parse(character.defaulttoken) : General.getToken(sel._id));
				log(defaulttoken);
				var mods = {};
				if(isNPC(character.id)) {
					// NPC bar values (not linked because they are mooks) 1: AVG_HP, 2: NPC_AC, 3: NPC_SPEED
					mods[TokenSpecifics.HP_BAR+"_value"] = getAttrByName(character.id, SpecificAttributes.NPC_HP);
					mods[TokenSpecifics.AC_BAR+"_value"] = getAttrByName(character.id, SpecificAttributes.NPC_AC);
					mods[TokenSpecifics.NPC_SPEED_BAR+"_value"] = getAttrByName(character.id, SpecificAttributes.NPC_SPEED);
				} else {
					// PC bar links 1: HP, 2: AC, 3: HP_TEMP
					var hp = General.findOrCreateAttr(character.id, SpecificAttributes.HP),
						ac = General.findOrCreateAttr(character.id, SpecificAttributes.AC),
						temphp = General.findOrCreateAttr(character.id, SpecificAttributes.TEMP_HP);
					
					mods[TokenSpecifics.HP_BAR+"_link"]  = hp.id;
					mods[TokenSpecifics.HP_BAR+"_value"] = hp.get("current");
					mods[TokenSpecifics.HP_BAR+"_max"]   = hp.get("max");
					mods[TokenSpecifics.AC_BAR+"_link"]  = ac.id;
					mods[TokenSpecifics.AC_BAR+"_value"] = ac.get("current");
					mods[TokenSpecifics.AC_BAR+"_max"]   = ac.get("max");
					mods[TokenSpecifics.TEMP_HP_BAR+"_link"]  = temphp.id;
					mods[TokenSpecifics.TEMP_HP_BAR+"_value"] = temphp.get("current");
					mods[TokenSpecifics.TEMP_HP_BAR+"_max"]   = temphp.get("max");
				}
				defaulttoken.set({statusmarkers:""});
				defaulttoken.set(mods);
				setDefaultTokenForCharacter(character, defaulttoken);
				_.each(General.getTokensForCharacter(character.id), function(token){ token.set(mods); });
			});
		}
	},
	
	handleShortRest = function(msg) {
		if(msg.type == "api" && msg.content.indexOf("!shortrest") !== -1) {
			var charids = [];
			if(msg.selected) {
				_.each(msg.selected, function(sel){
					charids.push(General.getCharacterForToken(sel._id).id);
				});
			} else if(msg.content.indexOf("--charid") !== -1) {
				_.each(msg.content.split("--"), function(str){
					if(str.indexOf("charid") !== -1) {
						var split = str.split(" ");
						charids = split.slice(1,split.length);
					}
				});
			}
			log(charids);
			
			_.each(charids, function(charId){
				if(isNPC(charId)) { General.whisperError(scriptName, "Cannot use !shortrest on NPCs."); return; }
				log(charId);
				var srResources = resetResources(SpecificAttributes.SHORT_REST_RESOURCES,charId);
				var output = outputShortRestAbilities(charId);
				output = output + (srResources ? "{{Resources: " + srResources + "}}" : "");
				log(output);
				General.sendChat("GM", output);
				General.whisperGM(scriptName, output);
			});
		}
	},
	
	/**
	 * Assumes a command of 
	 * !divinePortent --charid <character_id> --portent <1|2>
	 */
	handleDivinePortent = function(msg) {
		if(msg.type == "api" && msg.content.indexOf("!divinePortent") !== -1) {
			var charid = null,
				portent = null;
			_.each(msg.content.split("--"), function(arg) {
				if(arg.indexOf("charid") !== -1) {
					charid = arg.replace("charid", "").replace(" ", "").replace("|","").trim();
				} else if(arg.indexOf("portent") !== -1) {
					portent = arg.replace("portent", "").replace(" ", "").replace("|","").trim();
				}
			});
			if(!portent || !charid) {
				var error = "Tried to use divine portent but received the following values<br>"
					+ "character id: " + charid + "<br>"
					+ "portent number: " + portent;
				General.whisperError(scriptName, error);
				return;
			}
			var res = Resource.getForName("Divine Portent " + portent, charid);
			if(!res) { return; }
			if(!parseInt(res.current)) {
				var error = "Tried to use divine portent but portent value was '" + res.current + "'";
				General.whisperError(scriptName, error);
				return;
			}
			var output = formatRollTemplateOutput({
				type: RollTemplates.TEMPLATES.SIMPLE.type,
				rname: "Divine Portent " + portent,
				r1: "[[" + res.current + "]]",
				normal: 1,
				charname: General.getCharacter(charid).get("name")
			});
			sendChat("character|"+charid, output);
			res.set("current", "NA");
		}
	},
	
	handleBardInspiration = function(msg) {
		if(msg.type == "api" && msg.content.indexOf("!inspire") !== -1) {
			var charId = null,
				targetId = null,
				value = null;
			_.each(General.processInlinerolls(msg).split("--"), function(command){
				if(command.indexOf("charid") !== -1) { charId = command.replace("charid","").replace("|","").trim(); }
				if(command.indexOf("targetid") !== -1) { targetId = command.replace("targetid","").replace("|","").trim(); }
				else if(command.indexOf("value") !== -1) { value = command.replace("value","").replace("|","").trim(); }
			});
			if(!charId && !value && msg.who.indexOf("(GM)") !== -1) { 
				charId = "gm";
				value = "advantage";
			}
			inspireCharacter(targetId, value, charId);
		}
	},
	
	inspireCharacter = function(targetId, value, charId) {
		if(isNPC(targetId)) {
			General.sendChat(scriptName, "/w \"" + who + "\" You can't inspire NPCs");
			return;
		}
		var targetname =  General.getCharacter(targetId).get("name");
		var who = (charId == "gm") ? charId : General.getCharacter(charId).get("name");
		var inspiration =  General.findOrCreateAttr(targetId, SpecificAttributes.INSPIRATION);
		log(inspiration);
		if(inspiration.get("current") !== "on") {
			var insp_value = General.findOrCreateAttr(targetId, SpecificAttributes.INSPIRATION_VALUE);
			if(who != "gm") {
				// Decrease the character's Bardic Inspiration resource
				var bardicInspiration = Resource.getForName("Bardic Inspiration", charId);
				if(!bardicInspiration || parseInt(bardicInspiration.current) <= 0) {
					var output = who + " has no Inspiration to give.";
					General.sendChat("GM", "/w \"" + who + "\" " + output);
					General.whisperGM(scriptName, output);
					return;
				}
				bardicInspiration.set("current", parseInt(bardicInspiration.current) - 1);
			}
			inspiration.set("current", "on");
			insp_value.set("current", value);
			General.sendChat("character|"+targetId,"/em is feeling inspired by " + who);
		} else {
			General.sendChat(scriptName, "/w \"" + who + "\" " + targetname + " is already inspired.");
			if(who != "gm") {
				General.whisperGM(scriptName, who + " tried to inspire " + targetname + " but was already inspired.");
			}
		}
	},
	
	handleUseInspiration = function(msg) {
		if(msg.type == "api" && msg.content.indexOf("!useInspiration") !== -1) {
			_.each(msg.selected, function(sel){
				var character = General.getCharacterForToken(sel._id);
				if(!isNPC(character.id)) {
					var inspiration = General.findOrCreateAttr(character.id, SpecificAttributes.INSPIRATION);
					var insp_value = General.findOrCreateAttr(character.id, SpecificAttributes.INSPIRATION_VALUE);
					var output;
					if(inspiration.get("current") == "" || inspiration.get("current") !== "on" || insp_value.get("current") == "") {
						General.sendChat(scriptName,"/w " + msg.who.split(" ")[0] + " " + character.get("name") + " does not have inspiration.");
						return;
					} else if(insp_value.get("current") == "advantage") {
						output = "/em uses inspiration to have advantage on the roll";
					} else {
						output = RollTemplates.formatOutput({
							type: RollTemplates.TEMPLATES.SIMPLE.type,
							rname: "INSPIRATION",
							normal: 1,
							r1: "[[" + insp_value.get("current") + "]]",
							charname: character.get("name")
						});
					}
					sendChat("character|"+character.id, output);
					inspiration.set("current", "off");
					insp_value.set("current", "");
				}
			});
		}
	},
	
	hitDiceEventHandler = function(msg) {
		if(msg.rolltemplate && msg.rolltemplate === RollTemplates.TEMPLATES.SIMPLE.type && msg.content.indexOf("^{hit-dice-u}") !== -1) {
			// Because of the way General.parseTemplate splits based on '}}' the template for Hit Dice interfere with the parsing.
			// To resolve this issue, we replace the rname with different name and assert that our change is there after parsing.
			msg.content = msg.content.replace("^{hit-dice-u}", "HIT DICE");
			var simple = RollTemplates.parse(msg);
			if(simple && simple.type == RollTemplates.TEMPLATES.SIMPLE.type && simple.rname === "HIT DICE" && simple.charname !== "") {
				// Now we need to get the character for the charname output
				var character = General.getCharacterForName(simple.charname);
				//How many hit dice was the 
				var numberUsed = (simple.mod.split("D")[0] !== "") ? parseInt(simple.mod.split("D")[0]) : 1;

				// Check to see how many hit dice the character has remaining
				var hitDice = General.findAttr(character.id, SpecificAttributes.HIT_DICE);
				
				var error = "";
				// If not hit dice attribute found, or the player tried to use more hit dice than their character had remainining,
				// print an error to the gm.
				if(!hitDice) { error = "Could not find hit dice attribute for character " + simple.charname; }
				else if(parseInt(hitDice.get("current")) < numberUsed) { error = simple.charname + " tried to use " + numberUsed + " hit dice and only had " + hitDice.get("current") + " remaining "; }
				if(error !== "") { General.whisperError(scriptName, error); return; }
				
				// Remove the hit dice from the character sheet and begin to add the health to the character
				hitDice.set("current", parseInt(hitDice.get("current")) - numberUsed);
				var health = General.findAttr(character.id, SpecificAttributes.HP);
				
				// If the character has the Durable feat, they cannot get less hit points than 2 times their Constitution modifier
				if(General.findAttr(character.id, SpecificAttributes.DURABLE_FEAT)) {
					log(simple.charname + " has the durable feat, they gain a minimum of 2 times their consitution modifier");
					// The character may have rolled multiple hit dice at once and each die rolled has to match the Durable feat.
					// So we have to look at each individual roll and compare it to the consititution modifier.
					var rolls = "";
					_.each(msg.inlinerolls[simple.r1.inlineIndex].results.rolls[0].results, function(result){ rolls = rolls + result.v + " " });
					var callback_output = character.id + " [[@{" + simple.charname + "|constitution_mod}]] " + rolls.substr(0,rolls.length-1); 
					log(callback_output);
					
					// Currently, we have no way of getting the calculated Constitution modifier for the character, so to save time
					// we use roll20's asynchronous sendChat function to perform the calculation for us through inline rolls.
					sendChat(scriptName, "/w gm " + callback_output, function(ops) {
						
						var csplit = General.processInlinerolls(ops[0]).split(" ");
						var characterid = csplit[0],
							con_mod = parseInt(csplit[1]),
							rolls = csplit.slice(2),
							modified = false,
							hitDieTotal = 0;
						// We go through each of the rolls. If the roll is less than the Constitution modifier,
						// we change the roll to reflect the modifier. Then we update the new total for the hit dice.
						_.each(rolls, function(roll) {
							if(parseInt(roll) && parseInt(roll) < con_mod) { modified = true; roll = con_mod; }
							hitDieTotal = hitDieTotal + parseInt(roll) + con_mod;
						});
						// If we modified the hit dice, we output the new result to the chat log.
						if(modified) {
							var newRolls = "";
							_.each(rolls, function(roll) {
								newRolls = newRolls + "[[" + roll + "+" + con_mod + "]]+";
							});
							newRolls = newRolls.substr(0,newRolls.length - 1);
							var outputSimple = RollTemplates.formatOutput({
								type: RollTemplates.TEMPLATES.SIMPLE.type,
								rname: "DURABLE HIT DICE",
								normal: 1,
								r1: "[[" + newRolls + "]]",
								charname: General.getCharacter(characterId).get("name")
							});
							var output = "@{" + characterid + "|wtype} " + outputSimple;
							sendChat("character|"+characterid, output);
						}
						// Heal the character for the updated total from the hit dice.
						healCharacter(characterid, hitDieTotal);
					});
					return;
				}
				// Heal the character for the amount rolled
				healCharacter(character.id, simple.r1.total);
			}
		}
	},
	
	/**
	 * Heals the character with the given id. Does not work on NPCs. If the amount to be given is more than the character's
	 * maximum health, this method limits the amount of healing.
	 */
	healCharacter = function(charId, amount) {
		if(isNPC(charId)) { return; }
		var charname = General.getCharacter(charId).get("name");
		var health = General.findAttr(charId, SpecificAttributes.HP);
		if(!health) { General.whisperError(scriptName, "Could not find health attribute for '" + charname + "'."); return; }
		
		var curr = parseInt(health.get("current")) || 0,
			max = parseInt(health.get("max")),
			amount = parseInt(amount) || 0;
		
		// If there is no set maximum hit points, print an error and return.
		if(!max) { General.whisperError(scriptName, "No max health set for '" + charname + "'."); return; }
		
		// See if you need to clear death saving throws. This only happens when a character has 0 hit points and gains more.
		if(curr === 0 && amount > 0) {
			General.whisperGM(scriptName, "Clearing death saving throws for " + charname);
			clearDeathSavesForCharacter(charId);
		}
		
		// If the amount would set the character over their maximum health. Limit the amount received to the maximum health.
		if((curr + amount) > max) { amount = max - curr; }
		log(health);
		log("curr:"+curr);
		log("max:"+max);
		log("amount:"+amount);
		
		// add the health to the character
		health.set("current", curr + amount);
		
		// Update the tokens for the character
		_.each(General.getTokensForCharacter(charId), function(token) {
			updateHealthStatus(token)
		});
		
		// Output the result to the character and the GM
		var output = "Healing " + charname + " for " + amount + " hit points.";
		General.sendChat("GM", "/w \"" + charname + "\" " + output);
		General.whisperGM(scriptName, output);
		log(output);
	},
	
	/**
	 * Heals the specified token for the value and then updates the token status using updateHealthStatus.
	 * If the token represents a PC then this function simply calls healCharacter instead.
	 */
	healToken = function(tokenId, value) {
		var character = General.getCharacterForToken(tokenId);
		if(!isNPC(character.id)) { healCharacter(character.id, value); return; }
		
		var token = General.getToken(tokenId);
		var output = "Healing " + character.get("name") + " for " + value + " hit points.";
		sendChat(scriptName, "/w gm " + output);
		token.set(TokenSpecifics.HP_BAR+"_value", parseInt(TokenSpecifics.HP_BAR)+parseInt(value));
		updateHealthStatus(token);
	},
	
	damageToken =  function(tokenId, damage) {
		var character = General.getCharacterForToken(tokenId),
			token = General.getToken(tokenId),
			output = "Damaging " + character.get("name") + " for ";
		
		var isMagical = damage.magical ? damage.magical : false,
			isSilvered = damage.silvered ? damage.silvered : false,
			isAdamantine = damage.adamantine ? damage.adamantine : false,
			damageType = damage.type,
			value = damage.amount;
		var mod = DamageTypes.getDamageMod(character.id, damageType, isMagical, isSilvered, isAdamantine);
		value = value * mod;
		switch(mod) {
			case 2:
				output = output + value + " hit points, vulnerable to " + damageType + " damage";
				break;
			case 0.5: 
				output = output + Math.floor(value) + " hit points, resisted " + Math.ceil(value) + " " + damageType + " damage";
				value = Math.floor(value);
				break;
			case 0:
				output = character.get("name") + " is immune to " + damageType + " damage";
				break;
			case 1:
			default:
				output = output + value + " " + damageType + " damage";
				break;
		}
		if(!isNPC(character.id)) { General.sendChat("GM", "/w \"" + character.get("name") + "\" " + output); }
		sendChat(scriptName, "/w gm " + output);
		log(output);
		
		if(isTokenConcentrating(token)) { concentrationCheck(character, value); }
		
		if(!isNPC(character.id) && value > 0 && getAttrByName(character.id, SpecificAttributes.TEMP_HP) > 0) {
			// Remove temporary hit points first
			var tempHp = General.findAttr(character.id, SpecificAttributes.TEMP_HP);
			if(parseInt(tempHp.get("current")) > value) {
				// The PC still has temporary hit points left over, subtract the damage and return
				tempHp.set({current:parseInt(tempHp.get("current"))-value});
				return;
			} else {
				value = value - parseInt(tempHp.get("current"));
				tempHp.set({current:0});
			}
		}
		
		// Subtract any remaining hit points from the token and update token status
		token.set(TokenSpecifics.HP_BAR+"_value",parseInt(token.get(TokenSpecifics.HP_BAR+"_value"))-value);
		updateHealthStatus(token);
	},
	
	/**
	 * Damages the character for the value and then updates all tokens for the character using updateHealthStatus
	 */
	damageCharacter = function(charId, damage) {
		// This does not work for NPCs
		if(isNPC(charId)) { General.whisperError(scriptName, "Cannot use damageCharacter for NPCs"); return; }
		damageToken(General.getTokensForCharacter()[0], damage);
	},
	
	/**
	 * Sets the temporary hit points for the character based on the given value
	 * NOTE: Does not work for NPCs, only PCs
	 * NOTE: If the character already has temporary hit points, thie method will keep the greater of the two values.
	 *       If the new value is less than the previous, the GM is information of the situation and it will be their
	 *       job to manually update the value.
	 */
	giveTempHpToCharacter = function(charId, value) {
		// This does not work for NPCs
		if(isNPC(charId)) { General.whisperError(scriptName, "Cannot use giveTempHpToCharacter for NPCs"); return; }
		var charname = General.getCharacter(charId).get("name");
		var tempHp = General.findOrCreateAttr(charId, SpecificAttributes.TEMP_HP);
		
		var output;
		if(parseInt(tempHp.get("current")||0) >= parseInt(value)) {
			output = charname + " already has more temporary hit points than " + value + ". If this is what the player "
				+ "wants, you will need to change this value manually.";
		} else {
			output = charname + " now has " + value + " temporary hit points.";
			tempHp.set({current:value});
			General.sendChat("GM", "/w \"" + charname + "\" " + output);
		}
		General.whisperGM(scriptName, output);
		log(output);
	},
	
	/**
	 * Sets the temporary hit points for the token based on the given value.
	 * NOTE: Simply gets the character for the token id and passes the information to giveTempHpToCharacter.
	 */
	giveTempHpToToken = function(tokenId, value) {
		giveTempHpToCharacter(General.getCharacterForToken(tokenId).id, value);
	},
	
	/**
	 * Updates the status markers for the token. WIll also ensure that the token's hp will not ho over its
	 * maximum hit points not under 0.
	 * This method requires that tokens submitted have value stored in hp_max.
	 */
	updateHealthStatus = function(token) {
		var hp_curr = TokenSpecifics.HP_BAR + "_value",
			hp_max = TokenSpecifics.HP_BAR + "_max";
		
		var curr = token.get(hp_curr),
			max = token.get(hp_max);
		
		// Check to see if the token's health has gone out of bounds. Over the maximum or under 0 if negatives are not allowed.
		if(curr > max) { token.set(hp_curr, max); }
		else if (!TokenSpecifics.ALLOW_NEGATIVE && curr < 0) { token.set(hp_curr, 0); }
		
		// Check to see if the token should show the blooded status to all players.
		var character = General.getCharacterForToken(token.id);
		var showWoundsAttr = General.findAttr(character.id, SpecificAttributes.SHOW_WORUNDS);
		var showWounds = true;
		if(showWoundsAttr) {
			if(["0", "off", "false"].indexOf(showWoundsAttr.get("current")) !== -1) {
				showWounds = false;
			}
		}
		// If bloodied can be applied to the token, do it if the current health is at the proper ratio between 0 and max health
		if(showWounds && curr <= (max * TokenSpecifics.BLOODIED_RATIO)) { token.set(StatusMarkers.BLOODIED, true); }
		else { token.set(StatusMarkers.BLOODIED, false); }
		
		// If the token is under the death ratio set above, set the dead status and prone status to on.
		if(curr <= (max * TokenSpecifics.DEAD_RATIO)) { token.set(StatusMarkers.DEAD,true); token.set(StatusMarkers.PRONE,true); }
		else { token.set(StatusMarkers.DEAD, false); }
	},
	
	/**
	 * This method parses through the modHealthCommand and returns the options from it.
	 *
	 * Options:
	 *	--help					- Denotes that the help option should be displayed to the sender.
	 *	--sel					- Denotes that the options should be applied to the selected tokens
	 *	--charids|id1|id2		- Denotes that the options should be applied to the given character ids.
	 *	--damage|amount|type	- Determines that the amount given should be dealt to the creature's health based
	 *							  based on the type of damage specified
	 *	--heal|amount			- Determines that the amount given should be added to the health of the creature.
	 *	--temphp|amount			- Determines that the amount given should be given towards temporary hit points.
	 *	--magical				- Denotes that the damage is magical in nature with regards to damage modifiers.
	 *	--silvered				- Denotes that the damage is silver in nature with regards to damage modifiers.
	 *	--adamantine			- Denotes that the damage is adamantine in nature with regards to damage modifiers.
	 *
	 * Returns an object with the following values. Returns NULL if the command was incorrect or the help option was given.
	 *	damage		- object containing the following information
	 *		amount		- amount of damage
	 *		type		- base type of damage
	 *		magical		- true if the magical option was found
	 *		silvered	- true if the silvered option was found
	 *		adamantine	- true if the adamantine option was found
	 *	}
	 *	heal		- amount of healing to be applied
	 *	temphp		- amount of temporary hit points to be applied
	 *	tokenids	- the tokens for the options to be applied when the sel option was found
	 *	charids		- the character ids for the options to be applied when the charids option was found.
	 */
	getModHealthCommands = function(msg) {
		if(msg.content.indexOf("!modHealth") == -1 || msg.content.indexOf("--help") !== -1) { return null; }
		
		var options = {};
			options.damage = {};
		var content = General.processInlinerolls(msg);
		var error = "";
		
		_.each(content.split("--"), function(op) {
			if(op.indexOf("sel") !== -1) {
				// Get the token IDs of the selected tokens
				options.tokenids = [];
				_.each(msg.selected, function(sel) { options.tokenids.push(sel._id)});
				if(!msg.selected) { error =  error + "You must have selected tokens to use --sel. "; }
			}
			else if(op.indexOf("charids") !== -1) {
				// Get the provided character IDs
				var split = op.split("|");
				options.charids = split.slice(1,slice.length);
				if(options.charids.length == 0) { error = error + "No character ids were provided with --charids|id1|id2... "; }
			}
			else if(op.indexOf("damage") !== -1) {
				// Get the damage amount and type
				var split = op.split("|");
				options.damage.amount = parseInt(split[1]||0)||0;
				options.damage.type = split[2].trim();
				if(options.damage.amount == 0) { error = error + "Damage amount was 0. "; }
				if(!options.damage.type || options.damage.type == "") { error = error + "Invalid damage type '" + options.damage.type + "'. "; }
			}
			else if(op.indexOf("heal") !== -1) {
				// Get the healing amount
				options.heal = parseInt(op.split("|")[1]||0)||0; 
				if(options.heal == 0) { error = error + "Heal amount was 0. "; }
			}
			else if(op.indexOf("temphp") !== -1) {
				// Get the temp hp amount
				options.temphp = parseInt(op.split("|")[1]||0)||0;
				if(options.temphp == 0) { error = error + "Temphp amount was 0. "; }
			}
			// Check to see if the user specified any additional damage modifiers
			else if(op.indexOf("magical") !== -1) { options.damage.magical = true; }
			else if(op.indexOf("silvered") !== -1) { options.damage.silvered = true; }
			else if(op.indexOf("adamantine") !== -1) { options.damage.adamantine = true; }
		});
		if(!options.charids && !options.tokenids) { error = error + "No character ids nor token ids were given. "}
		if(!options.damage.amount && !options.heal && !options.temphp) { error = error + "No damage, healing, or temphp was specified."; }
			
		if(error !== "") { General.whisperError(scriptName, error); return null; }
		return options;
	},
	
	/**
	 * The main method that performs the modHealth commands. Used to call the individual damage, heal and giveTempHp methods.
	 */
	modHealth = function(id, isCharId, damage, heal, temphp) {
		if(isCharId) {
			if(damage.amount) { damageCharacter(id, damage); }
			if(heal) { healCharacter(id, heal); }
			if(temphp) { giveTempHpToCharacter(id, temphp); }
		} else {
			if(damage.amount) { damageToken(id, damage); }
			if(heal) { healToken(id, heal); }
			if(temphp) { giveTempHpToToken(id, temphp); }
		}
	},
	
	/**
	 * Handles the modHealth command by passing the message to getModHealthCommands so that the proper commands can be executed.
	 * If there was a problem with the command, outputs the help message to the screen
	 */
	handleModHealth = function(msg) {
		if(msg.type == "api" && msg.content.indexOf("!modHealth") !== -1) {
			var commands = getModHealthCommands(msg);
			log(commands);
			if(commands) {
				_.each(commands.tokenids, function(id) { modHealth(id.trim(), false, commands.damage, commands.heal, commands.temphp); });
				_.each(commands.charids, function(id) { modHealth(id.trim(), true, commands.damage, commands.heal, commands.temphp); });
			} else { modHealthHelp(); }
		}
	},
	
	/**
	 * Prints the help message for the modHealth command.
	 */
	modHealthHelp = function() {
		var output = "<p><b>!modHeath</b> Allows you to damage, heal, or give temporary hit points to creatures using the following options.</p>"
			+ "<p><b>--sel</b> will apply to each selected token</p>"
			+ "<p><b>--charids|id1|id2</b> will apply to each of the given character ids. Should only be used on PCs or NPCs with PC character sheets.</p>"
			+ "<p><b>--damage|amount|type</b> will apply the given amount of the specified type to the targets. "
			+ "This will account for any resistance/vulnerabilities/immunities that the PC or NPC has specified. PC modifiers are found using the"
			+ " respective attribute names (<b>" + SpecificAttributes.INNATE_RESISTANCES + ", " + SpecificAttributes.INNATE_VULNERABILITIES + ", " + SpecificAttributes.INNATE_IMMUNITIES + "</b>)."
			+ "NPCs modifiers are found using the respective attribute names (<b>" + SpecificAttributes.NPC_RESISTANCES + ", " + SpecificAttributes.NPC_VULNERABILITIES + ", " + SpecificAttributes.NPC_IMMUNITIES + "</b>).</p>"
			+ "<p><b>--adamantine</b> specifies that the damage type is adamantine with regards to the resistance/vulnerability/immunity of the creature.</p>"
			+ "<p><b>--magical</b> specifies that the damage type is magical with regards to the resistance/vulnerability/immunity of the creature.</p>"
			+ "<p><b>--silvered</b> specifies that the damage type is silvered with regards to the resistance/vulnerability/immunity of the creature.</p>"
			+ "<p><b>--heal|amount</b> will apply the given amount of healing to the targets.</p>"
			+ "<p><b>--temphp|amount</b> will apply the given amount of temporary hit points to the targets. Should only be used on PCs or NPCs with PC character sheets.</p>";
			General.sendChat(scriptName, output);
	},
	
	/**
	 * Clears the deat saving throws for the character when it detects that the character's health raises from
	 * 0 or less to above 0.
	 */
	clearDeathSavingThrows = function(obj, prev) {
		// Clear the death saving throws from the character if they just came back from 0 hp.
		if(obj.get("name") == SpecificAttributes.HP && prev.current <= 0 && obj.get("current") > 0) {
			clearDeathSavesForCharacter(obj.get("characterid"));
			General.whisperGM(scriptName, "Clearing death saving throws for " + General.getCharacter(obj.get("characterid")).get("name"));
		}
	},
	
	/**
	 * Determines if the character for the given id has the 'is_raging' attribute set to '1'.
	 */
	isCharacterRaging = function(charId) {
		var attr = General.findAttr(charId, SpecificAttributes.IS_RAGING);
		if(attr) { return attr.get("current") == "1"; }
		return false;
	},
	
	/**
	 * Determine if the given token has the rage status selected
	 */
	isTokenRaging = function(token) { return token.get(StatusMarkers.RAGE); },
	
	/**
	 * Toggles the rage status on the given token and if the token belongs to a PC,
	 * updates the 'is_raging' attribute for the character.
	 */
	toggleTokenRage = function(token) {
		log("toggleTokenRage");
		token.set(StatusMarkers.RAGE, !isTokenRaging(token));
		var character = General.getCharacterForToken(token.id);
		if(!isNPC(character.id)) {
			var result = isTokenRaging(token);
			_.each(General.getTokensForCharacter(character), function(obj){
				obj.set(StatusMarkers.RAGE, result);
			});
			var rage = General.findOrCreateAttr(character.id, SpecificAttributes.IS_RAGING);
			rage.set({current:(result ? 1: 0)});
		}
	},
	
	/**
	 * Toggles the rage for a PC will also decrement the number of rages that the character has and prints
	 * an error to the GM if they misuse the function
	 */
	toggleCharacterRage = function(charId) {
		log("toggleCharacterRage");
		if(isNPC(charId)) { return; }
		var token = General.getTokensForCharacter(charId)[0];
		toggleTokenRage(token);
		if(isCharacterRaging(charId)) {
			// Remove a use of Rage from the character's rage resource
			var rage = Resource.getForName("Rage", charId);
			if(!rage) { return; }
			else if( rage.current < 1) {
				// The PC did not have any rages left.
				// Inform the GM of what happened and reset the rage status for the character.
				var charname = General.getCharacter(charId).get("name");
				General.whisperError(scriptName, charname + " tried to rage but it was not available.");
				toggleTokenRage(token);
			} else {
				// The PC had uses of rage left. Decrement that number
				rage.set("current", parseInt(rage.current) - 1);
			}
		}
	},
	
	/**
	 * This method handles the !toggleRage API command and toggles the rage status on each of the selected tokens.
	 * If no tokens are selected, this method looks for a character ID to have been included in the command.
	 */
	handleToggleRage = function(msg) {
		if(msg.type == "api" && msg.content.indexOf("!toggleRage") !== -1) {
			if(!msg.selected || msg.content.split(" ").length > 1) {
				var split = msg.content.split(" ");
				if(split.length <= 1) { General.sendChat(scriptName, "/w \"" + msg.who + "\" You must have a token selected to use !toggleRage"); }
				else { toggleCharacterRage(split[1]); }
				return;
			}
			_.each(msg.selected, function(sel) {
				toggleTokenRage(General.getToken(sel._id));
			});
		}
	},
	
	/**
	 * Determines if the token has the concentration status set.
	 */
	isTokenConcentrating = function (token) { return token.get(StatusMarkers.CONCENTRATION); },
	
	toggleTokenConcentration = function(token) {
		token.set(StatusMarkers.CONCENTRATION, !isTokenConcentrating(token));
	},
	
	handleToggleConcentration = function(msg) {
		if(msg.type == "api" && msg.content.indexOf("!toggleConcentration") !== -1) {
			if(!msg.selected) {
				General.sendChat(scriptName, "/w \"" + msg.who + "\" You must have a token selected to use !toggleConcentration");
				return;
			}
			_.each(msg.selected, function(msg) {
				toggleTokenConcentration(General.getToken(sel_.id));
			});
		}
	},
	
	/**
	 * Performs the concentration check for an NPC or informs the PC that they need to make a concentration saving throw.
	 * Will account for the situation where the PC has the War Caster Feat as defined above.
	 */
	concentrationCheck = function(charId, damage) {
		var saveDC = "[[{10,floor("+damage+"/2)}kh1]]";
		if(!isNPC(charId)) {
			var war_caster_feat = General.findAttr(charId, SpecificAttributes.WAR_CASTER_FEAT);
			var output = General.getCharacter(charId).get("name") + " needs to make a Concentration (Constitution) saving throw for taking damage while concentrating"
				+ (war_caster_feat ? " with advantage for having the War Caster feat." : ".")
				+ "Save DC " + saveDC;
			General.sendChat(scriptName, output);
			return;
		}
		
		var mod = "[[@{npcd_con_mod}*{1@{npc_con_save}0,0}=10+0@{npc_con_save}]]";
		var output = charId + " [[1d20+" + mod + "]] " + saveDC;
		sendChat(scriptName, output, function(ops){
			var content = General.processInlinerolls(ops[0]),
				values = content.split(" "),
				charId = values[0],
				charname = General.getCharacter(charId).get("name"),
				roll = parseInt(values[1]),
				saveDC = parseInt(values[2]),
				result = "Maintained";
			if(roll < saveDC) { result = "Broken"; }
			var output = "@{" + charname + "|wtype} {{name=Concentration Check for " + charname + "}}"
				+ " {{Save DC=" + saveDC + "}}"
				+ " {{Roll=" + roll + "}}"
				+ " {{Concentration=" + result + "}}";
			General.sendChat("character|"+charId,output);
		});
	},
	
	healingPotionEventHandler = function(msg) {
		if(msg.rolltemplate && msg.rolltemplate === RollTemplates.TEMPLATES.SIMPLE.type
			&& msg.content.indexOf("POTION OF ") !== -1 && msg.content.indexOf("HEALING")) {
			var simple = RollTemplates.parse(msg);
			log(simple);
			if(simple && simple.rname.indexOf("POTION OF") !== -1 && simple.rname.indexOf("HEALING") !== -1 && simple.charname !== "") {
				var itemname = "Potion of Healing";
				if(simple.rname.indexOf("GREATER") !== -1) { itemname = itemname.replace("of", "of Greater"); }
				else if(simple.rname.indexOf("SUPERIOR") !== -1) { itemname = itemname.replace("of", "of Superior"); }
				else if(simple.rname.indexOf("SUPREME") !== -1) { itemname = itemname.replace("of", "of Supreme"); }
				log(itemname);
				
				// Now we need to get the character for the charname output
				var character = General.getCharacterForName(simple.charname);
				//Check to see if the Character has the potion in their inventory
				var potion = Item.getForName(itemname, character.id);
				log(potion);
				var error = null;
				if(!potion) { return; }
				else if (parseInt(potion.count||0) < 1) { error = simple.charname + " tried to use a " + itemname + " but did not have any available"; }
				
				if(error) { General.whisperError(scriptName,error); return; }
				
				// Remove the potion from the character's inventory.
				potion.set("count", parseInt(potion.count) - 1);
				
				var output = "[Heal " + simple.r1.total + "](!modHealth --sel --heal " + simple.r1.total + ")";
				General.whisperGM(scriptName, RollTemplates.formatOutput({type: RollTemplates.TEMPLATES.DESC.type, desc:output}));
			}
		}
	},
	
	damageEventHandler = function(msg) {
		log(msg);
		var tpl = RollTemplates.parse(msg);
		log(tpl);
		
		var isMagicWeapon = function() {
			// Is it a spell?
			if(tpl.spelllevel) { return true; }
			// Does the name of the weapon contain magic
			if(tpl.rname.toLowerCase().indexOf("magic") !== -1) { return true; }
			// Is one of the damage types magical
			if((tpl.dmg1flag && DamageTypes.isMagicalDamage(tpl.dmg1type)) || (tpl.dmg2flag && DamageTypes.isMagicalDamage(tpl.dmg2type))){ return true; }
			// Does one of the damage rolls contain a label for magic
			var hasMagicLabel = function(dmg) {
				if(!dmg || !dmg.inlinerolls || !dmg.inlinerolls.results || !dmg.inlinerolls.results.rolls) { return false; }
				var result = false;
				_.each(dmg.inlinerolls.results.rolls, function(roll) { if(roll.text && roll.text.toLowerCase().indexOf("magic") !== -1) { result = true; } });
				return result;
			};
			if(hasMagicLabel(tpl.dmg1) || hasMagicLabel(tpl.dmg2)) { return true; }
			// Does the item for the weapon have a property that says it is magical
			var item = Item.getForName(tpl.rname, General.getCharacterForName(tpl.charname));
			if(item && item.properties.toLowerCase().indexOf("magic") !== -1) { return true; }
		};
		
		var saveForHalf = (tpl.save && tpl.savedesc && tpl.savedesc.toLowerCase().indexOf("half") !== -1) ? true : false,
			adamantine = (tpl.rname.toLowerCase().indexOf("adamantine") !== -1) ? true : false,
			magical = isMagicWeapon(),
			silvered = (tpl.rname.toLowerCase().indexOf("silver") !== -1) ? true : false;
		
		var createButton = function(str, name, amount) { return str.replace("name",name).replace(/amount/g, amount); };
		
		var dmg = "[Apply name amount](!modHealth --sel --damage|amount|type" + (adamantine ? " --adamantine" : "") + (magical ? " --magical" : "") + (silvered ? " --silvered" : "") + ")";
		var heal = "[Heal name amount](!modHealth --sel --heal|amount)";
		
		var btns = [];
		if(tpl.dmg1type) {
			var str = tpl.dmg1type.toLowerCase().indexOf("heal") !== -1 ? heal : dmg.replace("type",tpl.dmg1type);
			
			if(tpl.dmg1flag) { btns.push(createButton(str, "dmg1", tpl.dmg1.total)); }
			if(saveForHalf) { btns.push(createButton(str, "save1", Math.floor(tpl.dmg1.total * 0.5))); }
			
			if(tpl.crit1 && tpl.hldmg) { btns.push(createButton(str, "hlcrit", tpl.dmg1.total + tpl.hldmg.total + tpl.crit1.total)); }
			else if(tpl.crit1) { btns.push(createButton(str, "crit1", tpl.dmg1.total + tpl.crit1.total));}
			else if(tpl.hldmg) { btns.push(createButton(str, "hldmg", tpl.dmg1.total + tpl.hldmg.total));  }
			
			if(saveForHalf && tpl.crit1 && tpl.hldmg) { btns.push(createButton(str, "save1hlcrit", Math.floor((tpl.dmg1.total + tpl.hldmg.total + tpl.crit1.total) * 0.5))); }
			else if(saveForHalf && tpl.crit1) { btns.push(createButton(str, "save1crit", Math.floor((tpl.dmg1.total + tpl.crit1.total) * 0.5))); }
			else if(saveForHalf && tpl.hldmg) { btns.push(createButton(str, "save1hl", Math.floor((tpl.dmg1.total + tpl.hldmg.total) * 0.5))); }
		}
		if(tpl.dmg2type) {
			var str = tpl.dmg2type.toLowerCase().indexOf("heal") !== -1 ? heal : dmg.replace("type",tpl.dmg2type);
			
			if(tpl.dmg2flag) { btns.push(createButton(str, "dmg2", tpl.dmg1.total)); }
			if(saveForHalf) { btns.push(createButton(str, "save2", Math.floor(tpl.dmg1.total * 0.5))); }
			
			if(tpl.crit2) { btns.push(createButton(str, "crit2", tpl.dmg2.total + tpl.crit2.total));}
			if(saveForHalf && tpl.crit2) { btns.push(createButton(str, "save2crit", Math.floor((tpl.dmg2.total + tpl.crit2.total) * 0.5))); }
		}
		
		var output = "";
		_.each(btns, function(btn) { output = output + btn; });
		
		if(output != "") { General.whisperGM(scriptName, RollTemplates.formatOutput({type: RollTemplates.TEMPLATES.DESC.type, desc:output})); }
	},
	
	handleInput = function(msg) {
		/**
		 * Handle API commands
		 */
		if(msg.type == "api") {
			if(msg.content.indexOf("!longrest") !== -1) { handleLongRest(msg); }
			if(msg.content.indexOf("!shortrest") !== -1) { handleShortRest(msg); }
			if(msg.content.indexOf("!divinePortent") !== -1 ) { handleDivinePortent(msg); }
			if(msg.content.indexOf("!inspire") !== -1) { handleBardInspiration(msg); }
			if(msg.content.indexOf("!useInspiration") !== -1) { handleUseInspiration(msg); }
			if(msg.content.indexOf("!toggleRage") !== -1) { handleToggleRage(msg); }
			if(msg.content.indexOf("!toggleConcentration") !== -1) { handleToggleConcentration(msg); }
			if(msg.content.indexOf("!modHealth") !== -1) { handleModHealth(msg); }
			if(msg.content.indexOf("!updateDefaultToken") !== -1) { handleUpdateDefaultToken(msg); }
		}
		/**
		 * Roll event listeners
		 */
		else {
			if(msg.content.indexOf("ammo=") !== -1) { handleAmmo(msg); }
			if([RollTemplates.TEMPLATES.SPELL.type, RollTemplates.TEMPLATES.ATKDMG.type, RollTemplates.TEMPLATES.DMG.type].indexOf(msg.rolltemplate) !== -1) { handleSpellSlot(msg); }
			if([RollTemplates.TEMPLATES.ATKDMG.type,RollTemplates.TEMPLATES.DMG.type, RollTemplates.TEMPLATES.NPCACTION.type, RollTemplates.TEMPLATES.NPCDMG.type].indexOf(msg.rolltemplate) !== -1) { damageEventHandler(msg); }
			if(msg.rolltemplate === RollTemplates.TEMPLATES.SIMPLE.type && msg.content.indexOf("^{death-save-u}") !== -1) { deathSaveEventHandler(msg); }
			if(msg.rolltemplate === RollTemplates.TEMPLATES.SIMPLE.type && msg.content.indexOf("^{hit-dice-u}") !== -1) { hitDiceEventHandler(msg); }
			if(msg.rolltemplate === RollTemplates.TEMPLATES.SIMPLE.type && msg.content.indexOf("POTION OF ") !== -1 && msg.content.indexOf("HEALING") !== -1) { healingPotionEventHandler(msg); }
			
		}
	},
	
	updatePotionMacro = function() {
		var macro = findObjs({
			_type: "macro",
			name: "Take-Potion"
		})[0];
		if(!macro) {return;}
		var action = "@{selected|wtype} &{template:simple} {{normal=1}} {{rname=POTION OF ?{Potion"
			+ "|Basic,HEALING&"+"#125;&"+"#125; {{r1=[[2d4cs0cf0+2]]"
			+ "|Greater,GREATER HEALING&"+"#125;&"+"#125; {{r1=[[4d4cs0cf0+4]]"
			+ "|Superior,SUPERIOR HEALING&"+"#125;&"+"#125; {{r1=[[8d4cs0cf0+8]]"
			+ "|Supreme,SUPREME HEALING&"+"#125;&"+"#125; {{r1=[[10d4cs0cf0+20]]"
			+ "}}} {{mod=}} @{selected|charname_output}";
		macro.set("action",action);
	},
	
	registerEventHandlers = function() {
		on("change:token:"+TokenSpecifics.HP_BAR+"_value", updateHealthStatus);
		on("change:attribute:current", clearDeathSavingThrows);
		on("chat:message", handleInput);
	},
	
	checkInstall = function() {
		log(scriptName + " v" + version + " Ready");
		updatePotionMacro();
	};

	return {
		CheckInstall: checkInstall,
		RegisterEventHandlers: registerEventHandlers,
		IsNPC: isNPC,
		ParseRollTemplate: RollTemplates.parse,
		GetResourceWithName: Resource.getForName,
		GetItemWithName: Item.getForName,
		FormatOutput: RollTemplates.formatOutput,
		ClearDeathSavesForCharacter:clearDeathSavesForCharacter,
	};
}());

on('ready', function(){
	'use strict'
	Kyle5eOglCompanion.CheckInstall();
	Kyle5eOglCompanion.RegisterEventHandlers();
});