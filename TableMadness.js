var MadnessTable = MadnessTable || (function() {
	'use strict';
	
	var version = 1.1,
		rangeMax = 100,
		scriptName = "Madness Tables",
		apiCommand = "!madness",
		msgTemplate = "&{template:default} {{name=!name (Lasts !lasts)}} {{roll=!roll}} {{result=!result}}",
	
	TABLES = {
		SHORT_TERM:	1,
		LONG_TERM:	2,
		INDEFINITE:	3,
		size: 3,
		
		properties: {
			1:	{
					name:		"Short-Term Madness",
					keywords:	["--shortterm", "--short", "--s"],
					lasts:		function() { return randomInteger(10) + " minutes"; },
					table:		[
						{range: _.range(1,20), result: "The character retreats into his or her mind and becomes Paralyzed. The effect ends if the character takes any damage."},
						{range: _.range(21,30), result: "The character becomes Incapacitated and spends the Duration screaming, laughing, or weeping."},
						{range: _.range(31,40), result: "The character becomes Frightened and must use his or her action and Movement each round to flee from the source of the fear."},
						{range: _.range(41,50), result: "The character begins babbling and is incapable of normal Speech or spellcasting."},
						{range: _.range(51,60), result: "The character must use his or her action each round to Attack the nearest creature."},
						{range: _.range(61,70), result: "The character experiences vivid hallucinations and has disadvantage on Ability Checks."},
						{range: _.range(71,75), result: "The character does whatever anyone tells him or her to do that isn’t obviously self-destructive." },
						{range: _.range(76,80), result: "The character experiences an overpowering urge to eat something strange such as dirt, slime, or offal." },
						{range: _.range(81,90), result: "The character is Stunned." },
						{range: _.range(91,100), result: "The character falls Unconscious." },
					]
				},
			2:	{
					name:		"Long-Term Madness",
					keywords:	["--longterm", "--long", "--l"],
					lasts:		function() { return randomInteger(100) + " hours"; },
					table:		[
						{range: _.range(1,10), result: "The character feels compelled to repeat a specific activity over and over, such as washing hands, touching things, praying, or counting coins."},
						{range: _.range(11,20), result: "The character experiences vivid hallucinations and has disadvantage on Ability Checks."},
						{range: _.range(21,30), result: "The character suffers extreme paranoia. The character has disadvantage on Wisdom and Charisma Checks."},
						{range: _.range(31,40), result: "The character regards something (usually the source of madness) with intense revulsion, as if affected by the antipathy effect of the Antipathy/Sympathy spell."},
						{range: _.range(41,45), result: "The character experiences a powerful delusion. Choose a potion. The character imagines that he or she is under its effects."},
						{range: _.range(46,55), result: "The character becomes attached to a “lucky charm,” such as a person or an object, and has disadvantage on Attack rolls, Ability Checks, and saving throws while more than 30 feet from it."},
						{range: _.range(56,65), result: "The character is Blinded (25%) or Deafened (75%)." },
						{range: _.range(66,75), result: "The character experiences uncontrollable tremors or tics, which impose disadvantage on Attack rolls, Ability Checks, and saving throws that involve Strength or Dexterity." },
						{range: _.range(76,85), result: "The character suffers from partial amnesia. The character knows who he or she is and retains racial traits and Class Features, but doesn’t recognize other people or remember anything that happened before the madness took effect." },
						{range: _.range(86,90), result: "Whenever the character takes damage, he or she must succeed on a DC 15 Wisdom saving throw or be affected as though he or she failed a saving throw against the Confusion spell. The Confusion effect lasts for 1 minute." },
						{range: _.range(91,95), result: "The character loses the ability to speak." },
						{range: _.range(96,100), result: "The character falls Unconscious. No amount of jostling or damage can wake the character." },
					]
				},
			3:	{
					name:		"Indefinite Madness",
					keywords:	["--indefinite", "--i"],
					lasts:		"Lasts until cured",
					table:		[
						{range: _.range(1,15), result: "“Being drunk keeps me sane.”"},
						{range: _.range(16,25), result: "“I keep whatever I find.“"},
						{range: _.range(26,30), result: "“I try to become more like someone else I know—adopting his or her style of dress, mannerisms, and name.”"},
						{range: _.range(31,35), result: "“I must bend the truth, exaggerate, or outright lie to be interesting to other people.”"},
						{range: _.range(36,45), result: "“Achieving my goal is the only thing of interest to me, and I’ll ignore everything else to pursue it.”"},
						{range: _.range(46,50), result: "“I find it hard to care about anything that goes on around me.”"},
						{range: _.range(51,55), result: "“I don’t like the way people judge me all the time.”" },
						{range: _.range(56,70), result: "“I am the smartest, wisest, strongest, fastest, and most beautiful person I know.”" },
						{range: _.range(71,80), result: "“I am convinced that powerful enemies are hunting me, and their agents are everywhere I go. I am sure they’re watching me all the time.”" },
						{range: _.range(81,85), result: "“There’s only one person I can trust. And only I can see this Special friend.”" },
						{range: _.range(86,95), result: "“I can’t take anything seriously. The more serious the situation, the funnier I find it.”" },
						{range: _.range(96,100), result: "“I’ve discovered that I really like killing people.”" },
					],
				}
		}
	},
	
	helpMsg = function() {
		var message = "Usage - <br><b>!madness [table_option] [--help|--h] [--private|--w]</b><br>, rolls on the specified table (see below list for table keywords),<br>optionally whispers result to roller and GM if --private is used. '--help will return this message.";
		sendChat(scriptName, message);
		message = "&{template:default} {{name=Possible tables}} ";
		for(var i = 1; i <= TABLES.size; i++) {
			var keywords = TABLES.properties[i].keywords;
			var keywordOptions = "";
			for(var j = 0; j < keywords.length; j++) {
				keywordOptions = keywordOptions + keywords[j];
				if(j < keywords.length - 1) {
					keywordOptions = keywordOptions + "|";
				}
			}
			message = message + "{{" + TABLES.properties[i].name + "=[" + keywordOptions + "]}}";
		}
		sendChat(scriptName, message);
	},
	
	writeResult = function (msg, rollResult, isPrivate) {
		var message = msgTemplate.replace('!name', rollResult.tableName).replace('!lasts', rollResult.lasts).replace('!roll',rollResult.roll).replace('!result',rollResult.result);
		var speakingAs = msg.who || scriptName;
		if(isPrivate) {
			sendChat(speakingAs, "/w gm " + message);
			// I prefer msg.who.split(" ")[0] because if you have a player/character named John Doe 
			// it will send the message to /w John. Whispers do not function properly with sending 
			// messages to someone with spaces in their name.
			message = "/w " + msg.who.split(" ")[0] + message;
			speakingAs = scriptName;
		}
		sendChat(speakingAs, message);
	},
	
	rollOnTable = function(table) {
		var roll = randomInteger(rangeMax);
		var checkRange = function(entry) { return entry.range.indexOf(roll) !== -1 };
		var tableEntry = _.find(TABLES.properties[table].table, checkRange);
		return {
			tableName: TABLES.properties[table].name,
			lasts: TABLES.properties[table].lasts,
			roll: roll,
			result: tableEntry.result
		};
	},
	
	handleInput = function(msg) {
		var args,
			isPrivate = false;
		
		if(msg.type !== "api") {
			return;
		}
		args = msg.content.split(" ");
		if(args.length > 0 && args[0] == apiCommand) {
			if(args[1] == "--help" || args[1] == "--h"){
				helpMsg();
				return;
			}
			
			if(msg.content.indexOf("--private") !== -1 || msg.content.indexOf("--w") !== -1) {
				isPrivate = true;
			}
			
			// Here is where the original functions changed.
			// Instead of only checking the single the option and assuming a table, we want to go through
			// each table in our stored list of tables.
			for(var i = 1; i <= TABLES.size; i++) {
				var keywords = TABLES.properties[i].keywords;
				var selected = false;
				_.each(args, function(arg){
					_.each(keywords, function(keyword) {
						if(keyword == arg) {
							selected = true;
						}
					});
				});
				if(selected) {
					writeResult(msg, rollOnTable(i), isPrivate);
				}
			}
		}
	},
	
	gmMacroName = "Madness-Tables",	// Change this value based on the name of the macro you created.
									// If no macro by by this name exists, no changes will be made.
	/*
	 * This method dynamically update the gmMacroName macro with the list of tables added above in TABLES.
	 * This method is run each time the API is reloaded. If this is not desired, change autoUpdate to false.
	 */
	autoUpdate = true,
	updateMacro = function() {
		if(!autoUpdate) { return; }
		var macro = findObjs({
			_type: "macro",
			name: gmMacroName
		})[0];
		
		if(macro) {		
			var tableQuery;
			if(TABLES.size == 1) {
				tableQuery = TABLES.properties[0].keyword[0];
			} else {
				tableQuery = "?{Table"
				for(var i = 1; i <= TABLES.size; i++) {
					tableQuery = tableQuery + "|" + TABLES.properties[i].name + "," + TABLES.properties[i].keywords[0];
				}
				tableQuery = tableQuery + "} ";
			}
			var privateQuery = "?{Output|Public,|Private,--private}";
			var newAction = apiCommand + " " + tableQuery + privateQuery;
		
			if(macro.get("action") != newAction) {
				macro.set("action", newAction);
				log("Updating macro " +  gmMacroName);
			}
		} else {
			log("No macro with name " + gmMacroName + " found");
		}
	},
	
	checkInstall = function() {
		log(scriptName + ' v' + version + ' Ready');
		updateMacro();
	},
		registerEventHandlers = function() {
		on("chat:message", handleInput);
	};
		return {
		CheckInstall: checkInstall,
		RegisterEventHandlers: registerEventHandlers
	};
}());

on('ready', function() {
	'use strict';
	MadnessTable.CheckInstall();
	MadnessTable.RegisterEventHandlers();
});