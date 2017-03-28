
var GeneralScripts = GeneralScripts || (function(){
	'use strict';

	var version =0.1,
		scriptName = "General Scripts",
	
	formatTemplateSimple = function(rname, mod, r1, r2, charname){
		return "&{template:simple}"
				+ " {{rname=" + rname + "}}"
				+ " {{mod=" + mod + "}}"
				+ " {{r1=" + r1 + "}}"
				+ " {{always=1}}"
				+ " {{r2=" + r2 + "}}"
				+ " {{charname="+charname+"}}";
	},
	
	formatTemplateDescription = function(desc) {
		return "&{template:desc} {{desc=" + desc + "}}";
	},
	
	formatTemplateAttack = function(mod,rname,r1,r2,range,desc,charname) {
		return "&{template:atk}"
				+ " {{mod=" + mod + "}}"
				+ " {{rname=" + rname + "}}"
				+ " {{rnamec=" + rname + "}}"
				+ " {{r1=" + r1 + "}}"
				+ " {{always=1}}"
				+ " {{r2=" + r2 + "}}"
				+ " {{range=" + range + "}}"
				+ " {{desc=" + desc + "}}"
				+ " {{charname=" + charname + "}}";
	},
	
	formatTemplateNpc = function(charname,rname,r1,r2, description) {
		return "&{template:npcatk}"
				+ " {{name=" + charname + "}}"
				+ " {{rname=" + rname + "}}"
				+ " {{r1=" + r1 + "}}"
				+ " {{always=1}}"
				+ " {{r2=" + r2 + "}}"
				+ " {{description=" + description + "}}";
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
	
	findAttrForCharacterId = function(characterId, attrName) {
		return findObjs({
			_type: "attribute",
			characterid: characterId,
			name: attrName
		},{caseInsensitive: true})[0];
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
	
	whisperError = function(speakingAs, error) {
		myWhisperGM(speakingAs, "<b style='color:red'>ERROR</b> -> " + error);
	},

	/**
	 * Basic method that returns token for the given id
	 */
	getTokenForId = function(id) { return getObj("graphic", id); },

	/**
	 * Basic function that returns the character for the given id
	 */
	getCharacterForId = function(id) { return getObj("character", id); },
	
	getCharacterForName = function(name) {
		return findObjs({
			_type: "character",
			name: name
		})[0];
	},

	/**
	 * This method returns the character object for the given token id.
	 */
	getCharacterForTokenId = function(id) {
		var token = getTokenForId(id);
		return getCharacterForId(token.get("represents"));
	},
	
	getTokensForCharacter = function(character) {
		return findObjs({
			_type: "graphic",
			_subtype: "token",
			represents: character.id
		});
	},
	
	checkInstall = function() {
		log(scriptName + " v" + version + " Ready");
	};
	
	return {
		CheckInstall: checkInstall,
		ProcessInlineRolls: processInlinerolls,
		SendChat: mySendChat,
		WhisperGM: myWhisperGM,
		WhisperError: whisperError,
		GetTokenForId: getTokenForId,
		GetCharacterForId: getCharacterForId,
		GetCharacterForName: getCharacterForName,
		GetCharacterForTokenId: getCharacterForTokenId,
		FindAttrForCharacter: findAttrForCharacter,
		FindAttrForCharacterId: findAttrForCharacterId,
	};
})();

on('ready', function(){
	'use strict'
	GeneralScripts.CheckInstall();
});

on("chat:message", function(msg) {
	if(msg.type == "api" && msg.content.indexOf("!printattrs") !== -1) {
		var charid = msg.content.split(" ")[1];
		log(findObjs({_type:"attribute",characterid:charid}));
	}
});