var Kyle5eOglCompanion = Kyle5eOglCompanion || (function(){
	'use strict';
	
	var version = 0.1,
		scriptName = "5e OGL Companion",
	
	getResourceWithName = function(resourceName, characterId) {
		var error = null;
		// See if the 
		var resourceNameAttr = findObjs({_type:"attribute",characterid:characterId,current:resourceName})[0];
		var resource;
		if(!resourceNameAttr) {
			error = "Could not find resource with name '" + resourceName + "' for character with id '" + characterId + "'";
		}
		
		if(error){
			GeneralScripts.WhisperError(scriptName, error);
			return null;
		}
		
		var resource = GeneralScripts.FindAttrForCharacterId(characterId, resourceNameAttr.get("name").replace("_name",""));
		if(!resource) {
			error = "Could not find resource values for resource with name '" + resourceNameAttr.get("name").replace("_name","") + "' for the character";
		}
		
		if(error){
			GeneralScripts.WhisperError(scriptName, error);
			return null;
		}
		
		return {
			"resource": resource.get("name"),
			"name": resourceName,
			"current": resource.get("current"),
			"max": resource.get("max"),
			"characterid": characterId,
			set: function(n, v) {
				if(n === "name") {
					var attribute = GeneralScripts.FindAttrForCharacterId(this.characterid, this.resource + "_name");
					attribute.set("current", v);
				} else if (n === "current" || n === "max") {
					var attribute = GeneralScripts.FindAttrForCharacterId(this.characterid, this.resource);
					attribute.set(n,v);
				} else {
					log("Could not find attribute '" + n + "' for resource");
				}
			}
		}
	},
		
		repeating_inventory_prefix = "repeating_inventory_",
		itemname_suffix = "_itemname",
		itemweight_suffix = "_itemweight",
		itemcontent_suffix = "_itemcontent",
		itemtype_suffix = "_itemtype",
		equippedflag_suffix = "_equippedflag",
		itemdamage_suffix = "_itemdamage",
		itemdamagetype_suffix = "_itemdamagetype",
		itemattackid_suffix = "_itemattackid",
		itemac_suffix = "_itemac",
		itemcount_suffix = "_itemcount",
	getItemWithName = function(itemName, characterId) {
		var error = null;
		// See if the item with the given name exists
		var itemNameAttr = findObjs({_type:"attribute",characterid:characterId,current:itemName})[0];
		log(itemNameAttr)
		if(!itemNameAttr) {
			error = "Could not find item with name '" + itemName + "' for character with id '" + characterId + "'";
			GeneralScripts.WhisperError(scriptName, error);
			return null;
		}
		// Get each of the attributes that contain the individual values of the item.
		var prefix = itemNameAttr.get("name").replace(itemname_suffix, ""),
			rowid = prefix.replace(repeating_inventory_prefix,""),
			weight = GeneralScripts.FindAttrForCharacterId(characterId,prefix + itemweight_suffix),
			content = GeneralScripts.FindAttrForCharacterId(characterId,prefix + itemcontent_suffix),
			type = GeneralScripts.FindAttrForCharacterId(characterId,prefix + itemtype_suffix),
			equippedflag = GeneralScripts.FindAttrForCharacterId(characterId,prefix + equippedflag_suffix),
			damage = GeneralScripts.FindAttrForCharacterId(characterId,prefix + itemdamage_suffix),
			damagetype = GeneralScripts.FindAttrForCharacterId(characterId,prefix + itemdamagetype_suffix),
			attackid = GeneralScripts.FindAttrForCharacterId(characterId,prefix + itemattackid_suffix),
			ac = GeneralScripts.FindAttrForCharacterId(characterId,prefix + itemac_suffix),
			count =  GeneralScripts.FindAttrForCharacterId(characterId, prefix + itemcount_suffix);
		
		// Return the values packaged as a nice object.
		return {
			"rowid": rowid,
			"prefix": prefix,
			"name": itemName,
			"characterid": characterId,
			"weight": (weight != null) ? weight.get("current") : "",
			"content": (content != null) ? content.get("current") : "",
			"type": (type != null) ? type.get("current") : "",
			"equippedflag": (equippedflag != null) ? type.get("current") : "",
			"damage": (damage != null) ? damage.get("current") : "",
			"damagetype": (damagetype != null) ? damagetype.get("current") : "",
			"attackid": (attackid != null) ? attackid.get("current") : "",
			"ac": (ac != null) ? ac.get("current") : "",
			"count": (count != null) ? count.get("current") : "",
			set: function(n, v) {
				var suffix;
				if(n === "name") { suffix = itemname_suffix; this.name = v; } 
				else if (n === "weight") { suffix = itemweight_suffix; this.weight = v; }
				else if (n === "content") { suffix = itemcontent_suffix; this.content = v; }
				else if (n === "type") { suffix = itemtype_suffix; this.type = v; }
				else if (n === "equippedflag") { suffix = equippedflag_suffix; this.equippedflag = v; }
				else if (n === "damage") { suffix = itemdamage_suffix; this.damage = v; }
				else if (n === "damagetype") { suffix = itemdamagetype_suffix; this.damagetype = v; }
				else if (n === "attackid") { suffix = itemattackid_suffix; this.attackid = v; }
				else if (n === "ac") { suffix = itemac_suffix; this.ac = v; }
				else if (n === "count") { suffix = itemcount_suffix; this.count = v; }
				else {
					log("Could not find attribute '" + n + "' for resource");
					return;
				}
				var attribute = GeneralScripts.FindAttrForCharacterId(this.characterid, this.prefix + suffix);
				if(!attribute) {
					attribute = createObj("attribute",{
						name: this.prefix + suffix,
						characterid: this.characterid,
						current: ""
					});
				}
				attribute.set("current", v);
			}
		}
	},
	
		repeating_spell_prefix = "repeating_spell-",
		spellname_base_suffix = "_spellname_base",
		spellname_suffix = "_spellname",
		spellschool_suffix = "_spellschool",
		spellcastingtime_suffix = "_spellcastingtime",
		spellrange_suffix = "_spellrange",
		spellcomp_suffix = "_spellcomp",
		spellcomp_materials_suffix = "_spellcomp_materials",
		spellconcentrationflag_suffix = "_spellconcentrationflag",
		spellconcentration_suffix = "_spellconcentration",
		spellduration_suffix = "_spellduration",
		spellattack_suffix = "_spellattack",
		spelldamage_suffix = "_spelldamage",
		spelldamagetype_suffix = "_spelldamagetype",
		spellcontent_suffix = "_spellcontent",
		spelllevel_suffix = "_spelllevel",
		spell_damage_progression_suffix = "_spell_damage_progression",
		spellprep_suffix = "_prep",
		spellattackinfoflag_suffix = "_spellattackinfoflag",
		spellcomp_v_suffix = "_spellcomp_v",
		spellcomp_s_suffix = "_spellcomp_s",
		spellcomp_m_suffix = "_spellcomp_m",
		spelloutput_suffix = "_spelloutput",
		spelldescription_suffix = "_spelldescription",
		spellathigherlevels_suffix = "_spellathigherlevels",
		spellattackid_suffix = "_spellattackid",
		spellrollcontent_suffix = "_rollcontent",
		spell_options_flag = "_options-flag",
	getSpellForRowId = function(spelllevel, rowId, characterId) {
		
		var prefix = repeating_spell_prefix + ((spelllevel == "0") ? "cantrip" : spelllevel) + " ";
		// See if the spell for the given rowId, and spelllevel exists
		var spellname_base = GeneralScripts.FindAttrForCharacterId(characterId, prefix + spellname_base_suffix);
		if(!spellname_base) {
			GeneralScripts.WhisperError(scriptName, "Could not find spell with spell level '" + spelllevel + "' and row id '" + rowId + "'");
			return null;
		}
		
		// Get the remaining attributes that contain information for the spell
		var spellname = GeneralScripts.FindAttrForCharacterId(characterId, prefix + spellname_suffix),
			spellschool = GeneralScripts.FindAttrForCharacterId(characterId, prefix + spellschool_suffix),
			spellcastingtime = GeneralScripts.FindAttrForCharacterId(characterId, prefix + spellcastingtime_suffix),
			spellrange = GeneralScripts.FindAttrForCharacterId(characterId, prefix + spellrange_suffix),
			spellcomp = GeneralScripts.FindAttrForCharacterId(characterId, prefix + spellcomp_suffix),
			spellcomp_materials = GeneralScripts.FindAttrForCharacterId(characterId, prefix + spellcomp_materials_suffix),
			spellconcentrationflag = GeneralScripts.FindAttrForCharacterId(characterId, prefix + spellconcentrationflag_suffix),
			spellconcentration = GeneralScripts.FindAttrForCharacterId(characterId, prefix + spellconcentration_suffix),
			spellduration = GeneralScripts.FindAttrForCharacterId(characterId, prefix + spellduration_suffix),
			spellattack = GeneralScripts.FindAttrForCharacterId(characterId, prefix + spellattack_suffix),
			spelldamage = GeneralScripts.FindAttrForCharacterId(characterId, prefix + spelldamage_suffix),
			spelldamagetype = GeneralScripts.FindAttrForCharacterId(characterId, prefix + spelldamagetype_suffix),
			spellcontent = GeneralScripts.FindAttrForCharacterId(characterId, prefix + spellcontent_suffix),
			spell_damage_progression = GeneralScripts.FindAttrForCharacterId(characterId, prefix + spell_damage_progression_suffix),
			spellprep = GeneralScripts.FindAttrForCharacterId(characterId, prefix + spellprep_suffix),
			spellattackinfoflag = GeneralScripts.FindAttrForCharacterId(characterId, prefix + spellattackinfoflag_suffix),
			spellcomp_v = GeneralScripts.FindAttrForCharacterId(characterId, prefix + spellcomp_v_suffix),
			spellcomp_s = GeneralScripts.FindAttrForCharacterId(characterId, prefix + spellcomp_s_suffix),
			spellcomp_m = GeneralScripts.FindAttrForCharacterId(characterId, prefix + spellcomp_m_suffix),
			spelloutput = GeneralScripts.FindAttrForCharacterId(characterId, prefix + spelloutput_suffix),
			spelldescription = GeneralScripts.FindAttrForCharacterId(characterId, prefix + spelldescription_suffix),
			spellathigherlevels = GeneralScripts.FindAttrForCharacterId(characterId, prefix + spellathigherlevels_suffix),
			spellattackid = GeneralScripts.FindAttrForCharacterId(characterId, prefix + spellattackid_suffix),
			spellrollcontent = GeneralScripts.FindAttrForCharacterId(characterId, prefix + spellrollcontent_suffix);
		
		// Return the values as a packaged object
		return {
			"prefix": prefix,
			"rowid": rowId,
			"level": spelllevel,
			"characterid": characterId,
			"name_base": (spellname_base != null) ? spellname_base.get("current") : "",
			"name": (spellname != null) ? spellname.get("current") : "",
			"school": (spellschool != null) ? spellschool.get("current") : "",
			"castingtime": (spellcastingtime != null) ? spellcastingtime.get("current") : "",
			"comp": (spellcomp != null) ? spellcomp.get("current") : "",
			"comp_materials": (spellcomp_materials != null) ? spellcomp_materials.get("current") : "",
			"concentrationflag": (spellcontrationflag != null) ? spellcontrationflag.get("current") : "",
			"concentration": (spellcontration != null) ? spellcontration.get("current") : "",
			"duration": (spellduration != null) ? spellduration.get("current") : "",
			"attack": (spellattack != null) ? spellattack.get("current") : "",
			"damage": (spelldamage != null) ? spelldamage.get("current") : "",
			"damagetype": (spelldamagetype != null) ? spelldamagetype.get("current") : "",
			"content": (spellcontent != null) ? spellcontent.get("current") : "",
			"damage_progression": (spell_damage_progression != null) ? spell_damage_progression.get("current") : "",
			"prep": (spellprep != null) ? spellprep.get("current") : "",
			"attackinfoflag": (spellattackinfoflag != null) ? spellattackinfoflag.get("current") : "",
			"comp_v": (spellcomp_v != null) ? spellcomp_v.get("current") : "",
			"comp_s": (spellcomp_s != null) ? spellcomp_s.get("current") : "",
			"comp_m": (spellcomp_m != null) ? spellcomp_m.get("current") : "",
			"output": (spelloutput != null) ? spelloutput.get("current") : "",
			"description": (spelldescription != null) ? spelldescription.get("current") : "",
			"athigherlevels": (spellathigherlevels != null) ? spellathigherlevels.get("current") : "",
			"attackid": (spellattackid != null) ? spellattackid.get("current") : "",
			"rollcontent": (spellrollcontent != null) ? spellrollcontent.get("current") : "",
			set: function(n,v) {
				var suffix;
				if (n === "level") { this.level = v; suffix = spelllevel_suffix; }
				else if (n === "name_base") { this.name_base = v; suffix = spellname_base_suffix; }
				else if (n === "name") { this.name = v; suffix = spellname_suffix; }
				else if (n === "school") { this.school = v; suffix = spellschool_suffix; }
				else if (n === "castingtime") { this.castingtime = v; suffix = spellcastingtime_suffix; }
				else if (n === "comp") { this.comp = v; suffix = spellcomp_suffix; }
				else if (n === "comp_materials") { this.comp_materials = v; suffix = spellcomp_materials_suffix; }
				else if (n === "concentration") { this.concentration = v; suffix = spellconcentration_suffix; }
				else if (n === "concentrationflag") { this.concentrationflag = v; suffix = spellconcentrationflag_suffix; }
				else if (n === "duration") { this.duration = v; suffix = spellduration_suffix; }
				else if (n === "attack") { this.attack = v; suffix = spellattack_suffix; }
				else if (n === "damage") { this.damage = v; suffix = spelldamage_suffix; }
				else if (n === "damagetype") { this.damage = v; suffix = spelldamagetype_suffix; }
				else if (n === "content") { this.content = v; suffix = spellcontent_suffix; }
				else if (n === "damage_progression") { this.damage_progression; suffix = spell_damage_progression_suffix; }
				else if (n === "prep") { this.prep = v; suffix = spellprep_suffix; }
				else if (n === "attackinfoflag") { this.attackinfoflag = v; suffix = spellattackinfoflag_suffix; }
				else if (n === "comp_v") { this.comp_v = v; suffix = spellcomp_v_suffix; }
				else if (n === "comp_s") { this.comp_s = v; suffix = spellcomp_s_suffix; }
				else if (n === "comp_m") { this.comp_m = v; suffix = spellcomp_m_suffix; }
				else if (n === "output") { this.output = v; suffix = spelloutput_suffix; }
				else if (n === "description") { this.description = v; suffix = spelldescription_suffix; }
				else if (n === "athigherlevels") { this.athigherlevels = v; suffix = spellathigherlevels_suffix; }
				else if (n === "attackid") { this.attackid = v; suffix = spellattackid_suffix; }
				else if (n === "rollcontent") { this.rollcontent = v; suffix = spellrollcontent_suffix; }
				else {
					log("Could not find attribute '" + n + "' for resource");
					return;
				}
				var attribute = GeneralScripts.FindAttrForCharacterId(this.characterid, this.prefix + suffix);
				if(!attribute) {
					attribute = createObj("attribute",{
						name: this.prefix + suffix,
						characterid: this.characterid,
						current: ""
					});
				}
				attribute.set("current", v);
			},
		}
	},
	
	parse5eOglRollTemplateSimple = function(msg) {
		if(msg.rolltemplate !== "simple" || msg.content.indexOf("--silent") !== -1) {return null;}
		log(msg);
		
		var rname = (msg.content.match(/({{rname=(.*?)}} )/g) != null) ? msg.content.match(/({{rname=(.*?)}} )/g)[0].replace("{{rname=", "").replace("}} ","") : "";
		log("rname: " + rname);
		
		var modIndex = (msg.content.match(/({{mod=\$\[\[\d+\]\]}})/g) !== null) ? parseInt(msg.content.match(/({{mod=\$\[\[\d+\]\]}})/g)[0].split("[[")[1].split("]]")[0]) : "";
		var mod;
		if(modIndex === "") {
			mod = (msg.content.match(/({{mod=(.*?)}} )/g) != null) ? msg.content.match(/({{mod=(.*?)}} )/g)[0].replace("{{mod=", "").replace("}} ","") : "";
		} else {
			// Mod was an inline roll
			var mod = (msg.inlinerolls[r1_inlineIndex].results.rolls[0].dice != 0) ? parseInt(msg.inlinerolls[r1_inlineIndex].results.total) : "";
		}
		log("mod : " + mod);
		
		var advantage =		(msg.content.match(/({{advantage=)\d/g) != null) ? 1 : 0;
		var normal =		(msg.content.match(/({{normal=)\d/g) != null) ? 1 : 0;
		var disadvantage =	(msg.content.match(/({{disadvantage=)\d/g) != null) ? 1 : 0;
		var always = 		(msg.content.match(/({{always=)\d/g) != null) ? 1 : 0;
		
		var r1_inlineIndex = parseInt(msg.content.match(/({{r1=\$\[\[\d+\]\]}})/g)[0].split("[[")[1].split("]]")[0]);
		var r1_total = (msg.inlinerolls[r1_inlineIndex].results.rolls[0].dice != 0) ? parseInt(msg.inlinerolls[r1_inlineIndex].results.total) : 0;
		var r1 = {inlineIndex: r1_inlineIndex, total: r1_total};
		log(r1);
		
		// First we need to check if r2 was rolled
		var r2;
		if(msg.content.match(/({{r2=\$\[\[\d+\]\]}})/g) != null) {
			var r2_inlineIndex = parseInt(msg.content.match(/({{r2=\$\[\[\d+\]\]}})/g)[0].split("[[")[1].split("]]")[0]);
			var r2_total = (msg.inlinerolls[r2_inlineIndex].results.rolls[0].dice != 0) ? parseInt(msg.inlinerolls[r2_inlineIndex].results.total) : 0;
			r2 = {inlineIndex: r2_inlineIndex, total: r2_total};
		}
		log(r2);
		
		var charname = (msg.content.match(/({{charname=(.*?)}})/g) != null) ? msg.content.match(/({{charname=(.*?)}})/g)[0].replace("{{charname=", "").replace("}}","") : "";
		log("charname : " + charname);
		
		return {
			"rname" : rname,
			"mod" : mod,
			"advantage" : advantage,
			"normal" : normal,
			"disadvantage" : disadvantage,
			"always" : always,
			"r1" : r1,
			"r2" : r2,
			"charname" : charname
		};
	},
	
	checkInstall = function() {
		log(scriptName + " v" + version + " Ready");
	};

	return {
		CheckInstall: checkInstall,
		Parse5eOglRollTemplateSimple: parse5eOglRollTemplateSimple,
		GetResourceWithName: getResourceWithName,
		GetItemWithName: getItemWithName,
	};
}());

on('ready', function(){
	'use strict'
	Kyle5eOglCompanion.CheckInstall();
});