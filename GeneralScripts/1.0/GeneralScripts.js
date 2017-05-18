
var GeneralScripts = GeneralScripts || (function(){
	'use strict';

	var version =1.0,
		scriptName = "General Scripts",

	/**
	 * Converts any inline rolls that are contained in a message sent by the chat log and returns the converted string.
	 */
	processInlinerolls = function(msg) {
		if (_.has(msg, 'inlinerolls')) {
			return _.chain(msg.inlinerolls)
				.reduce(function(previous, current, index) { previous['$[[' + index + ']]'] = current.results.total || 0; return previous; },{})
				.reduce(function(previous, current, index) { return previous.replace(index, current); }, msg.content)
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
	findAttr = function(character, attrName) {
		var charId = character.id ? character.id : character;
		return findObjs({_type:"attribute",characterid:charId,name:attrName},{caseInsensitive:true})[0];
	},
	
	findOrCreateAttr = function(character, attrName) {
		var charId = character.id ? character.id : character;
		var attr = findAttr(charId, attrName);
		if(attr) { return attr; }
		return createObj("attribute", {characterid:charId,name:attrName,current:""});
	},

	/**
	 * Allows a message to be sent to the chat log but will not be stored in the archive.
	 * Useful for display an error message to a specific user.
	 */
	mySendChat = function(speakingAs, message) {sendChat(speakingAs, message, null, {noarchive: true}); },

	/**
	 * Allows a message to be seen by the GM in the chat log that will not be stored in the chat archive.
	 * Useful for displaying a message directly to the GM.
	 */
	myWhisperGM = function(speakingAs, message) { mySendChat(speakingAs, "/w gm " + message); },
	
	whisperError = function(speakingAs, error) { myWhisperGM(speakingAs, "<b style='color:red'>ERROR</b> -> " + error); },

	/**
	 * Basic method that returns token for the given id
	 */
	getTokenForId = function(id) { return getObj("graphic", id); },

	/**
	 * Basic function that returns the character for the given id
	 */
	getCharacterForId = function(id) { return getObj("character", id); },
	
	getCharacterForName = function(name) { return findObjs({_type: "character",name:name})[0]; },

	/**
	 * This method returns the character object for the given token id.
	 */
	getCharacterForTokenId = function(id) {
		var token = getTokenForId(id);
		return getCharacterForId(token.get("represents"));
	},
	
	getTokensForCharacter = function(character) { 
		var charId = (character.id ? character.id : character);
		return findObjs({_type: "graphic",_subtype: "token",represents:charId}); 
	},
	
	parseTemplate = function(content) {
		var matches = content.match(/({{(.*?)=(.*?)}})/g);
		var result = [];
		_.each(matches, function(match){
			var matchStr = match.replace("{{", "").replace("}}","");
			result.push(matchStr.split("="));
		});
		return result;
	},
	
	getSenderForName = function(name) {		
		var character = getCharacterForName(name),
			player = findObjs({
				type: 'player',
				displayname: name.lastIndexOf(' (GM)') === name.length - 5 ? name.substring(0, name.length - 5) : name
			})[0];
		
		if(player) { return 'player|' + player.id; }
		if(character) { return 'character|' + character.id; }
		return name;
	},
	
	handleInput = function(msg) {
		if(msg.type == "api" && msg.content.indexOf("!groupWhisper") !== -1) {
			var content =  processInlinerolls(msg);
			var message = content.replace("!groupWhisper", "").trim();
			var charnames = [];
			_.each(msg.selected, function (sel) {
				var charname = getCharacterForTokenId(sel._id).get("name");
				mySendChat("GM", "/w \"" + charname + "\" " + message);
				charnames.push("<br>" + charname);
			});
			myWhisperGM(scriptName, "Message sent to " + charnames + "<br><br><b>" + message + "</b>");
		}
	},
	
	checkInstall = function() {
		log(scriptName + " v" + version + " Ready");
	},
	
	registerEventHandlers = function() {
		on("chat:message", handleInput);
	};
	
	return {
		CheckInstall: checkInstall,
		RegisterEventHandles: registerEventHandlers,
		ProcessInlineRolls: processInlinerolls,
		SendChat: mySendChat,
		WhisperGM: myWhisperGM,
		WhisperError: whisperError,
		GetTokenForId: getTokenForId,
		GetCharacterForId: getCharacterForId,
		GetCharacterForName: getCharacterForName,
		GetCharacterForTokenId: getCharacterForTokenId,
		GetTokensForCharacter: getTokensForCharacter,
		GetSenderForName: getSenderForName,
		FindAttr: findAttr,
		FindOrCreateAttr: findOrCreateAttr,
		ParseTemplate: parseTemplate,
	};
})();

on('ready', function(){
	'use strict'
	GeneralScripts.CheckInstall();
	GeneralScripts.RegisterEventHandles();
});

on("chat:message", function(msg) {
	if(msg.type == "api" && msg.content.indexOf("!printattrs") !== -1) {
		var charid = msg.content.split(" ")[1];
		log(findObjs({_type:"attribute",characterid:charid}));
	}
});