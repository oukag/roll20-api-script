var Kyle5eOglCompanion = Kyle5eOglCompanion || (function(){
	'use strict';
	
	var version = 2.0,
		scriptName = "5e OGL Companion",
		
	Resource = Resource || (function(){
		var obj = {};
			obj.resource = "";
			obj.name = "";
			obj.current = "";
			obj.max = "";
			obj.characterid = "";
			
			var name_suffix = "_name";
		
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
			log("getForName");
			var error = null;
			// See if the resource with the name exists
			var resourceNameAttr = findObjs({_type:"attribute",characterid:charId,current:resourceName})[0];
			if(!resourceNameAttr) {
				error = "Could not find resource with name '" + resourceName + "' for character with id '" + charId + "'";
			} else {
				log(resourceNameAttr);
				var resourceAttr = GeneralScripts.FindAttrForCharacterId(charId, resourceNameAttr.get("name").replace(name_suffix,""));
				log(resourceAttr);
				if(!resourceAttr) {
					error = "Could not find resource values for resource with name '" + resourceNameAttr.get("name").replace(name_suffix,"") + "' for the character with id '" + charId + "'";
				} else {
					obj.resource = resourceAttr.get("name");
					obj.name = resourceName;
					obj.characterid = charId;
					obj.current = resourceAttr.get("current");
					obj.max = resourceAttr.get("max");
				}
			}
			if(error) {
				GeneralScripts.WhisperError(scriptName,error);
				return null;
			}
			return obj;
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
			type_suffix = "_itemtype",
			weight_suffix = "_itemweight",
		
		/*
		 * Should only be called after the characterid is set for the object.
		 */
		getAttrNotNull = function(n) {
			var attr = GeneralScripts.FindAttrForCharacterId(obj.characterid, n);
			return (attr != null) ? attr.get("current") : "";
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
			log("Item.getForName");
			var error = null;
			// See if the item with the given name exists
			var itemNameAttr = findObjs({_type:"attribute",characterid:charId,current:itemName})[0];
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
				
			return obj;
		};
		
		return obj;
	}()),
	
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
			
			obj.rname = (content.match(/({{rname=(.*?)}} )/g) != null) ? content.match(/({{rname=(.*?)}} )/g)[0].replace("{{rname=", "").replace("}} ","") : "";
			
			var modIndex = (content.match(/({{mod=\$\[\[\d+\]\]}})/g) !== null) ? parseInt(content.match(/({{mod=\$\[\[\d+\]\]}})/g)[0].split("[[")[1].split("]]")[0]) : "";
			if(modIndex === "") {
				obj.mod = (processedContent.match(/({{mod=(.*?)}} )/g) != null) ? processedContent.match(/({{mod=(.*?)}} )/g)[0].replace("{{mod=", "").replace("}} ","") : "";
			} else {
				// Mod was an inline roll
				obj.mod = (msg.inlinerolls[modIndex].results.rolls[0].dice != 0) ? parseInt(msg.inlinerolls[modIndex].results.total) : "";
			}
			
			obj.normal =       (content.match(/({{normal=)\d/g) != null) ? 1 : 0;
			obj.advantage =    (content.match(/({{advantage=)\d/g) != null) ? 1 : 0;
			obj.disadvantage = (content.match(/({{disadvantage=)\d/g) != null) ? 1 : 0;
			obj.always =       (content.match(/({{always=)\d/g) != null) ? 1 : 0;
			
			var parseRoll = function(roll) {
				var regex;
				if(roll == 1) { regex = /({{r1=\$\[\[\d+\]\]}})/g; }
				else { regex = /({{r2=\$\[\[\d+\]\]}})/g; }
				
				var r = null;
				if(msg.content.match(regex) != null) {
					r = {};
					r.inlineIndex = parseInt(msg.content.match(regex)[0].split("[[")[1].split("]]")[0]);
					r.total = (msg.inlinerolls[r.inlineIndex].results.rolls[0].dice != 0) ? parseInt(msg.inlinerolls[r.inlineIndex].results.total) : 0;
				}
				return r;
				
			};
			
			obj.r1 = parseRoll(1);
			obj.r2 = parseRoll(2);
			
			obj.charname = (content.match(/({{charname=(.*?)}})/g) != null) ? content.match(/({{charname=(.*?)}})/g)[0].replace("{{charname=", "").replace("}}","") : "";
			
			return obj;
		};
		
		return obj;
	}()),
	
	checkInstall = function() {
		log(scriptName + " v" + version + " Ready");
	};

	return {
		CheckInstall: checkInstall,
		Parse5eOglRollTemplateSimple: RollTemplate_Simple.parse,
		GetResourceWithName: Resource.getForName,
		GetItemWithName: Item.getForName,
	};
}());

on('ready', function(){
	'use strict'
	Kyle5eOglCompanion.CheckInstall();
});