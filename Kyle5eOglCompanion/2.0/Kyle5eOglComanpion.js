var Kyle5eOglCompanion = Kyle5eOglCompanion || (function(){
	'use strict';
	
	var version = 2.0,
		scriptName = "5e OGL Companion",
		
	Resource = Resource || (function(){
		var obj = {};
			obj.resource = "";
			obj.id = "";
			obj.name = "";
			obj.current = "";
			obj.max = "";
			obj.itemid = "";
			obj.characterid = "";
			
		var name_suffix = "_name",
			itemid_suffix = "_itemid",
		
		/*
		 * Should only be called after the characterid is set for the object.
		 */
		getAttrNotNull = function(n, v) {
			log("Resource.getAttrNotNull(" + n + "," + v + ")");
			var attr = GeneralScripts.FindAttrForCharacterId(obj.characterid, n);
			if(v == null) { v = "current"; }
			return (attr != null) ? attr.get(v) : "";
		},
		
		update = function(res,charId) {
			log("Resource.update(" + res + "," + charId + ")");
			obj.resource = res;
			obj.characterid = charId;
			
			obj.name = getAttrNotNull(res + name_suffix);
			obj.itemid = getAttrNotNull(res + itemid_suffix);
			
			var attr = GeneralScripts.FindAttrForCharacterId(obj.characterid, res);
			obj.current = attr ? attr.get("current") : "";
			obj.max = attr ? attr.get("max") : "";
			obj.id = attr ? attr.id : "";
			// log(obj);
			return obj;
		};
		
		obj.set = function(n,v) {
			var attr;
			switch (n) {
				case "name":
					obj.name = v;
					attr = GeneralScripts.FindAttrForCharacterId(characterid, obj.resource + name_prefix);
					attr.set("current", v);
					break;
				case "current":
				case "max":
					if(n === "current") { obj.current = v; }
					else { obj.max = v; }
					attr = GeneralScripts.FindAttrForCharacterId(obj.characterid, obj.resource);
					attr.set(n, v);
					break;
				default:
					log("Could not find attribute '" + n + "' for resource. It may be 'private' or not exist");
			}
			return obj;
		};
		
		obj.getForName = function(resourceName, charId) {
			log("Resource.getForName(" + resourceName + "," + charId + ")");
			var res = null, error = null;
			// See if the resource with the name exists
			var resourceNameAttr = null;
			_.each(findObjs({_type:"attribute",characterid:charId,current:resourceName}), function(attr){
				if(attr.get("name").indexOf(name_suffix) !== -1){
					resourceNameAttr = attr;
				}
			});
			if(!resourceNameAttr) {
				error = "Could not find resource with name '" + resourceName + "' for character with id '" + charId + "'";
			} else {
				var resourceAttr = GeneralScripts.FindAttrForCharacterId(charId, resourceNameAttr.get("name").replace(name_suffix,""));
				if(!resourceAttr) {
					error = "Could not find resource values for resource with name '" + resourceNameAttr.get("name").replace(name_suffix,"") + "' for the character with id '" + charId + "'";
				} else {
					res = resourceAttr.get("name");
				}
			}
			if(error) {
				GeneralScripts.WhisperError(scriptName,error);
				return null;
			}
			return update(res,charId);
		};
		
		obj.getForId = function(resId) {
			//log("getForId");
			var error = null;
			var resourceAttr = getObj("attribute", resId);
			if(!resourceAttr) {
				GeneralScripts.WhisperError(scriptName,"Could not find resource with id '" + resId + "'");
				return null; 
			}
			return update(resourceAttr.get("name"), resourceAttr.get("characterid"));
		};
		
		return obj;
	}()),
	
	Item = Item || (function(){
		var obj = {};
			obj.rowid = "";
			obj.characterid = "";
			obj.name = "";
			obj.count = "";
			obj.weight = "";
			obj.ac = "";
			obj.attackid = "";
			obj.content = "";
			obj.damage = "";
			obj.damagetype = "";
			obj.equippedflag = "";
			obj.modifiers = "";
			obj.properties = "";
			obj.resourceid = "";
			obj.type = "";
			
		var repeating_inventory_prefix = "repeating_inventory_",
			ac_suffix = "_itemac",
			attackid_suffix = "_itemattackid",
			content_suffix = "_itemcontent",
			count_suffix = "_itemcount",
			damage_suffix = "_itemdamage",
			damagetype_suffix = "_itemdamagetype",
			equippedflag_suffix = "_equippedflag",
			modifiers_suffix = "_itemmodifiers",
			name_suffix = "_itemname",
			properties_suffix = "_itemproperties",
			resourceid_suffix = "_itemresourceid",
			type_suffix = "_itemtype",
			weight_suffix = "_itemweight",
		
		/*
		 * Should only be called after the characterid is set for the object.
		 */
		getAttrNotNull = function(n, v) {
			var attr = GeneralScripts.FindAttrForCharacterId(obj.characterid, n);
			if(v == null) { v = "current"; }
			return (attr != null) ? attr.get(v) : "";
		};
		
		obj.set = function(n,v) {
			var suffix = null;
			switch(n){
				case "ac":           obj.ac = v;           suffix = ac_suffix;           break;
				case "attackid":     obj.attackid = v;     suffix = attackid_suffix;     break;
				case "content":      obj.content = v;      suffix = content_suffix;      break;
				case "count":        obj.count = v;        suffix = count_suffix;        break;
				case "damage":       obj.damage = v;       suffix = damage_suffix;       break;
				case "damagetype":   obj.damagetype = v;   suffix = damagetype_suffix;   break;
				case "equippedflag": obj.equippedflag = v; suffix = equippedflag_suffix; break;
				case "modifiers":    obj.modifiers = v;    suffix = modifiers_suffix;    break;
				case "name":         obj.name = v;         suffix = name_suffix;         break;
				case "properties":   obj.properties = v;   suffix = properties_suffix;   break;
				case "type":         obj.type = v;         suffix = type_suffix;         break;
				case "weight":       obj.weight = v;       suffix = weight_suffix;       break;
				default:
					log("Could not find attribute '" + n + "' for item. It may be 'private' or not exist");
					break;
			}
			if(suffix) {
				var attr = GeneralScripts.FindAttrForCharacterId(obj.characterid, repeating_inventory_prefix + obj.rowid + suffix);
				if(!attr) {
					attr = createObj("attribute",{
						name: repeating_inventory_prefix + obj.rowid + suffix,
						characterid: obj.characterid,
						current: ""
					});
				}
				attr.set("current",v);
			}
			return obj;
		};
		
		obj.getForName = function(itemName, charId) {
			log("Item.getForName " + itemName + ", " + charId);
			var error = null;
			// See if the item with the given name exists
			var itemNameAttr = null; 
			_.each(findObjs({_type:"attribute",characterid:charId,current:itemName}),function(attr){
				if(attr.get("name").indexOf(name_suffix) !== -1 && attr.get("name").indexOf(repeating_inventory_prefix) !== -1) {
					itemNameAttr = attr;
				}
			});
			log(itemNameAttr);
			if(!itemNameAttr) {
				error = "Could not find item with name '" + itemName + "' in inventory for character with id '" + charId + "'";
			}
			if(error) { 
				GeneralScripts.WhisperError(scriptName, error); 
				return null;
			}
			// Get each of the attributes that contain the individual values of the item.
			var prefix = itemNameAttr.get("name").replace(name_suffix, "");
							
			obj.rowid =        prefix.replace(repeating_inventory_prefix,"");
			obj.name =         itemName;
			obj.characterid =  charId;
			obj.weight =       getAttrNotNull(prefix + weight_suffix);
			obj.content =      getAttrNotNull(prefix + content_suffix);
			obj.type =         getAttrNotNull(prefix + type_suffix);
			obj.equippedflag = getAttrNotNull(prefix + equippedflag_suffix);
			obj.damage =       getAttrNotNull(prefix + damage_suffix);
			obj.damagetype =   getAttrNotNull(prefix + damagetype_suffix);
			obj.attackid =     getAttrNotNull(prefix + attackid_suffix);
			obj.ac =           getAttrNotNull(prefix + ac_suffix);
			obj.count =        getAttrNotNull(prefix + count_suffix);
			obj.modifiers =    getAttrNotNull(prefix + modifiers_suffix);
			obj.properties =   getAttrNotNull(prefix + properties_suffix);
			obj.resourceid =   getAttrNotNull(prefix + resourceid_suffix);
				
			return obj;
		};
		
		return obj;
	}()),
	
	Spell = Spell || (function(){
		var obj = {};
			obj.name = "";
			obj.level = "";
			obj.school = "";
			obj.castingtime = "";
			obj.range = "";
			obj.comp = "";
			obj.comp_v = "";
			obj.comp_s = "";
			obj.comp_m = "";
			obj.comp_materials = "";
			obj.concentrationflag = "";
			obj.concentration = "";
			obj.duration = "";
			obj.content = "";
			obj.attack = ""
			obj.damage = "";
			obj.damagetype = "";
			obj.damage_progression = "";
			obj.prep = "";
			obj.attackinfoflag = "";
			obj.output = "";
			obj.description = "";
			obj.athigherlevels = "";
			obj.attackid = "";
			obj.rollcontent = "";
			obj.options_flag = "";
			obj.name_base = "";
			obj.characterid = "";
			obj.rowid = "";
		
		var repeating_spell_prefix = "repeating_spell-",
		
			athigherlevels_suffix = "_spellathigherlevels",
			attackid_suffix = "_spellattackid",
			attackinfoflag_suffix = "_spellattackinfoflag",
			attack_suffix = "_spellattack",
			castingtime_suffix = "_spellcastingtime",
			comp_suffix = "_spellcomp",
			comp_v_suffix = "_spellcomp_v",
			comp_s_suffix = "_spellcomp_s",
			comp_m_suffix = "_spellcomp_m",
			comp_materials_suffix = "_spellcomp_materials",
			concentrationflag_suffix = "_spellconcentrationflag",
			concentration_suffix = "_spellconcentration",
			content_suffix = "_spellcontent",
			damage_progression_suffix = "_spell_damage_progression",
			damage_suffix = "_spelldamage",
			damagetype_suffix = "_spelldamagetype",
			description_suffix = "_spelldescription",
			duration_suffix = "_spellduration",
			level_suffix = "_spelllevel",
			name_base_suffix = "_spellname_base",
			name_suffix = "_spellname",
			options_flag_suffix = "_options-flag",
			output_suffix = "_spelloutput",
			prep_suffix = "_prep",
			range_suffix = "_spellrange",
			rollcontent_suffix = "_rollcontent",
			school_suffix = "_spellschool",
		
		/*
		 * Should only be called after the characterid is set for the object.
		 */
		getAttrNotNull = function(n, v) {
			var attr = GeneralScripts.FindAttrForCharacterId(obj.characterid, n);
			if(v == null) { v = "current"; }
			return (attr != null) ? attr.get(v) : "";
		},
		
		
		update = function(spellevel,rowId, charId) {
			var prefix = repeating_spell_prefix + ((spelllevel == "0") ? "cantrip" : spelllevel);
			
			obj.characterid = charId;
			obj.rowId = rowId;
			obj.level = spelllevel;
			
			obj.athigherlevels =     getAttrNotNull(prefix + athigherlevels_suffix);
			obj.attackid =           getAttrNotNull(prefix + attackid_suffix);
			obj.attackinfoflag =     getAttrNotNull(prefix + attackinfoflag_suffix);
			obj.attack =             getAttrNotNull(prefix + attack_suffix);
			obj.castingtime =        getAttrNotNull(prefix + castingtime_suffix);
			obj.comp =               getAttrNotNull(prefix + comp_suffix);
			obj.comp_v =             getAttrNotNull(prefix + comp_v_suffix);
			obj.comp_s =             getAttrNotNull(prefix + comp_s_suffix);
			obj.comp_m =             getAttrNotNull(prefix + comp_m_suffix);
			obj.comp_materials =     getAttrNotNull(prefix + comp_materials_suffix);
			obj.concentrationflag =  getAttrNotNull(prefix + concentrationflag_suffix);
			obj.concentration =      getAttrNotNull(prefix + concentration_suffix);
			obj.content =            getAttrNotNull(prefix + content_suffix);
			obj.damage_progression = getAttrNotNull(prefix + damage_progression_suffix);
			obj.damage =             getAttrNotNull(prefix + damage_suffix);
			obj.damagetype =         getAttrNotNull(prefix + damagetype_suffix);
			obj.description =        getAttrNotNull(prefix + description_suffix);
			obj.duration =           getAttrNotNull(prefix + duration_suffix);
			obj.name_base =          getAttrNotNull(prefix + name_base_suffix);
			obj.name =               getAttrNotNull(prefix + name_suffix);
			obj.options_flag =       getAttrNotNull(prefix + options_flag_suffix);
			obj.output =             getAttrNotNull(prefix + output_suffix);
			obj.prep =               getAttrNotNull(prefix + prep_suffix);
			obj.range =              getAttrNotNull(prefix + range_suffix);
			obj.rollcontent =        getAttrNotNull(prefix + rollcontent_suffix);
			obj.school =             getAttrNotNull(prefix + school_suffix);
			return obj;
		};
		
		obj.set =function(n,v) {
			var suffix = null;
			switch (n) {
				case "athigherlevels":     obj.athigherlevels = v;     suffix = athigherlevels_suffix;     break;
				case "attackid":           obj.attackid = v;           suffix = attackid_suffix;           break;
				case "attackinfoflag":     obj.attackinfoflag = v;     suffix = attackinfoflag_suffix;     break;
				case "attack":             obj.attack = v;             suffix = attack_suffix;             break;
				case "castingtime":        obj.castingtime = v;        suffix = castingtime_suffix;        break;
				case "comp_v":             obj.comp_v = v;             suffix = comp_v_suffix;             break;
				case "comp_s":             obj.comp_s = v;             suffix = comp_s_suffix;             break;
				case "comp_m":             obj.comp_m = v;             suffix = comp_m_suffix;             break;
				case "comp_materials":     obj.comp_materials = v;     suffix = comp_materials_suffix;     break;
				case "concentrationflag":  obj.concentrationflag = v;  suffix = concentrationflag_suffix;  break;
				case "concentration":      obj.concentration = v;      suffix = concentration_suffix;      break;
				case "content":            obj.content = v;            suffix = content_suffix;            break;
				case "damage_progression": obj.damage_progression = v; suffix = damage_progression_suffix; break;
				case "damage":             obj.damage = v;             suffix = damage_suffix;             break;
				case "damagetype":         obj.damagetype = v;         suffix = damagetype_suffix;         break;
				case "description":        obj.description = v;        suffix = description_suffix;        break;
				case "duration":           obj.duration = v;           suffix = duration_suffix;           break;
				case "level":              obj.level = v;              suffix = level_suffix;              break;
				case "name_base":          obj.name_base = v;          suffix = name_base;                 break;
				case "name":               obj.name = v;               suffix = name;                      break;
				case "options_flag":       obj.options_flag = v;       suffix = options_flag_suffix;       break;
				case "output":             obj.output = v;             suffix = output_suffix;             break;
				case "prep":               obj.prep = v;               suffix = prep_suffix;               break;
				case "range":              obj.range = v;              suffix = range_suffix;              break;
				case "rollcontent":        obj.rollcontent = v;        suffix = rollcontent_suffix;        break;
				case "school":             obj.school = v;             suffix = school_suffix;             break;
				default:
					log("Could not find attribute '" + n + "' for spell. It may be 'private' or not exist");
					break;
			}
			if(suffix) {
				var attr = GeneralScripts.FindAttrForCharacterId(obj.characterid, repeating_spell_prefix + obj.spelllevel + suffix);
				if(!attr) {
					attr = createObj ("attribute", {
						name: repeating_spell_prefix + obj.spelllevel + suffix,
						characterid: obj.characterid,
						current: ""
					});
				}
				attr.set("current", v);
			}
			return obj;
		};
		
		obj.getForSpelllevelAndRowId = function(spelllevel, rowId, charId){
			var error = null;
			var prefix = repeating_spell_prefix + ((spelllevel == "0") ? "cantrip" : spelllevel);
			// See if the spell for the given row id and spell level exists
			var spellname_baseAttr = GeneralScripts.FindAttrForCharacterId(charId, prefix + name_base_suffix);
			if(!spellname_baseAttr) {
				error = "Could not find spell for level '" + spelllevel + "' and row id '" + rowId + "' for character with id '" + charId + "'";
				GeneralScripts.WhisperError(scriptName, error);
				return null;
			}
			
			return update(spelllevel,rowId,charId);
		};
		
		return obj;
	}()),
			
	getRollForIndex = function(msg,index) {
		var iRolls = msg.inlinerolls[index];
		return {
			inlineIndex: index,
			inlinerolls: (iRolls != null) ? iRolls : null,
			total: (iRolls.results.rolls[0].dice != 0) ? parseInt(iRolls.results.total) : 0
		};
	},
	
	RollTemplate_Simple = RollTemplate_Simple || (function(){
		var obj = {};
			obj.rname = null;
			obj.mod = null;
			obj.normal = 0;
			obj.advantage = 0;
			obj.disadvantage = 0;
			obj.always = 0;
			obj.r1 = null;
			obj.r2 = null;
			obj.charname = null;
			
		obj.parse = function(msg) {
			if(msg.rolltemplate !== "simple") { return null; }
			var processedContent = GeneralScripts.ProcessInlineRolls(msg);
			var content = msg.content;
			log(msg);
			log(GeneralScripts.ParseTemplate(content));
			
			_.each(GeneralScripts.ParseTemplate(processedContent), function(field){
				var v = (field[1] != null) ? field[1] : "";
				switch (field[0]) {
					case "rname":        obj.rname = v;                  break;
					case "mod":          obj.mod = v;                    break;
					case "normal":       obj.normal = parseInt(v);       break;
					case "advantage":    obj.advantage = parseInt(v);    break;
					case "disadvantage": obj.disadvantage = parseInt(v); break;
					case "always":       obj.always = parseInt(v);       break;
					case "charname":     obj.charname = v;               break;
				}
			});
			
			_.each(GeneralScripts.ParseTemplate(content), function(field){
				var v = (field[1] != null) ? parseInt(field[1].replace("$[[","").replace("]]","")) : null;
				switch (field[0]) {
					case "r1": obj.r1 = getRollForIndex(msg,v); break;
					case "r1": obj.r2 = getRollForIndex(msg,v); break;
				}
			});
			
			return obj;
		};
		
		return obj;
	}()),
	
	RollTemplate_Description = RollTemplate_Description || (function(){
		var obj = {};
			obj.desc = null;
		
		obj.parse = function(msg) {
			if(msg.rolltemplate !== "desc") { return null; }
			var processedContent = GeneralScripts.ProcessInlineRolls(msg);
			_.each(GeneralScripts.ParseTemplate(processedContent), function(field){
				var v = (field[1] != null) ? field[1] : "";
				switch (field[0]) {
					case "desc": obj.desc = v; break;
				}
			});
			
			return obj;
		};
	
		obj.formatOutput = function(desc) {
			return "&{template:desc} {{desc=" + desc + "}}";
		};
		
		return obj;
	}()),
	
	RollTemplate_Atk = RollTemplate_Atk || (function(){
		var obj = {};
			obj.rname = null;
			obj.mod = null;
			obj.normal = 0;
			obj.advantage = 0;
			obj.disadvantage = 0;
			obj.always = 0;
			obj.r1 = null;
			obj.r2 = null;
			obj.range = null;
			obj.desc = null;
			obj.charname = null;
			obj.ammo = "";
		
		obj.parse = function(msg){
			if(msg.rolltemplate !== "atk") { return null; }
			var processedContent = GeneralScripts.ProcessInlineRolls(msg);
			var content = msg.content;
			_.each(GeneralScripts.ParseTemplate(processedContent), function(field){
				var v = (field[1] != null) ? field[1] : "";
				switch (field[0]) {
					case "rname":        obj.rname = v;                  break;
					case "mod":          obj.mod = v;                    break;
					case "normal":       obj.normal = parseInt(v);       break;
					case "advantage":    obj.advantage = parseInt(v);    break;
					case "disadvantage": obj.disadvantage = parseInt(v); break;
					case "always":       obj.always = parseInt(v);       break;
					case "range":        obj.range = parseInt(v);        break;
					case "desc":         obj.desc = parseInt(v);         break;
					case "charname":     obj.charname = v;               break;
				}
			});
			
			_.each(GeneralScripts.ParseTemplate(content), function(field){
				var v = (field[1] != null) ? parseInt(field[1].replace("$[[","").replace("]]","")) : null;
				switch (field[0]) {
					case "r1": obj.r1 = getRollForIndex(msg,v); break;
					case "r1": obj.r2 = getRollForIndex(msgv); break;
				}
			});
			obj.ammo = (msg.content.split("ammo=")[1]||'').split(" {{charname=")[0];
			
			return obj;
		};
		
		return obj;
	}()),
	
	handleammo = function(msg) {
		if(msg.content.indexOf("ammo=") === -1) {
			// UNABLE TO FIND AMMO
			return;
		}
		var template = RollTemplate_Atk.parse(msg);
		log(template);
		if(!template || template.ammo === "") { return; }
		
		var character = GeneralScripts.GetCharacterForName(template.charname);
		var ammofull = template.ammo;
		var ammoresource = null;
		if(ammofull.substring(0,1) === "-") {
			ammoresource = Resource.getForId(ammofull);
		}
		else if(ammofull.indexOf("|") > -1) {
			ammoresource = Resource.getForId(ammofull.split("|")[1]);
			log(ammoresource);
		}
		else {
			ammoresource = Resource.getForName(ammofull, character.id);
		}
		//ammoresource = findObjs({type: 'attribute', characterid: character.id, id: ammoid}, {caseInsensitive: true})[0];
		if(ammoresource && ammoresource.name !== "") {
			//log("handleammo - resource exists");
			ammoresource.set("current", parseInt(ammoresource.current) - 1);
			log(ammoresource);
			//var ammoitemid = getAttrByName(character.id, ammoresource.resource + "_itemid");
			var ammoitem = Item.getForName(ammoresource.name,character.id);
			//log("ammoitem");
			log(ammoitem);
			if(ammoitem) {
				ammoitem.set("count", parseInt(ammoitem.count) - 1);
				var totalweight = findObjs({type: 'attribute', characterid: character.id, name: "weighttotal"}, {caseInsensitive: true})[0];
				if(ammoitem.weight && totalweight) {
					totalweight.set({current: parseInt(totalweight.get("current")) - parseInt(ammoitem.weight)});
				}
			}
			var output = RollTemplate_Description.formatOutput(ammoresource.name + ": " + (ammoresource.current > 0) ? ammoresource.current  + " LEFT" : "OUT OF AMMO");
			sendChat(GeneralScripts.GetSenderForName(msg.who),output)
		}
	},
	
	registerEventHandlers = function() {
		on("chat:message", handleammo);
	},
	
	checkInstall = function() {
		log(scriptName + " v" + version + " Ready");
	};

	return {
		CheckInstall: checkInstall,
		RegisterEventHandlers: registerEventHandlers,
		Parse5eOglRollTemplateSimple: RollTemplate_Simple.parse,
		GetResourceWithName: Resource.getForName,
		GetItemWithName: Item.getForName,
		Format5eOglRollTemplateDecription: RollTemplate_Description.formatOutput,
	};
}());

on('ready', function(){
	'use strict'
	Kyle5eOglCompanion.CheckInstall();
	Kyle5eOglCompanion.RegisterEventHandlers();
});