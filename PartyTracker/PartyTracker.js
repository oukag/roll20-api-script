/**
 *	!xp <amount> <each|--each|--e>
 *		<amount>	-	amount of xp to be distributed to the selected characters
 *		<each>		-	Optional. Signifies that each character receives the amount
 */

var PartyTracker = PartyTracker || (function(){
	var version = '2.0',
		scriptName = "Party Tracker",
		xpAPICommand = "!xp",
		coinAPICommand = "!coin",
        spendAPICommand = "!spend",
		xpAttrName = "experience",
		parcelHandoutName = 'Party Parcel',

	LEVELS = {
		table:	[
			{level:  1, range: _.range(0,         299)},
			{level:  2, range: _.range(300,       899)},
			{level:  3, range: _.range(900,      2699)},
			{level:  4, range: _.range(2700,     6499)},
			{level:  5, range: _.range(6500,    13999)},
			{level:  6, range: _.range(14000,   22999)},
			{level:  7, range: _.range(23000,   33999)},
			{level:  8, range: _.range(34000,   47999)},
			{level:  9, range: _.range(48000,   63999)},
			{level: 10, range: _.range(64000,   84999)},
			{level: 11, range: _.range(85000,   99999)},
			{level: 12, range: _.range(100000, 119999)},
			{level: 13, range: _.range(120000, 139999)},
			{level: 14, range: _.range(140000, 164999)},
			{level: 15, range: _.range(165000, 194999)},
			{level: 16, range: _.range(195000, 224999)},
			{level: 17, range: _.range(225000, 264999)},
			{level: 18, range: _.range(265000, 304999)},
			{level: 19, range: _.range(305000, 354999)},
			{level: 20, range: _.range(355000, 999999)},
		],

		getEntryForLevel: function(lvl) {
			var entry;
			_.each(this.table, function(e){
				if (e.level == lvl) {
					entry = e;
				}
			});
			return entry;
		},

		getXpDiffForLevel: function(lvl) {
			var level = this.getEntryForLevel(lvl);
			return _.last(level.range) + 1 - _.first(level.range);
		},

		getForXP: function(xp) {
			log("getForXP("+xp+")");
			var checkRange = function(entry) { return entry.range.indexOf(parseInt(xp||0)) !== -1 };
			var tableEntry = _.find(this.table, checkRange);
			log(tableEntry);
			return tableEntry.level;
		}
	},

    COINS = {
	    CP: {name:'cp', fName:'Copper Pieces',   attr:'cp', fromCp: 1,    fromSp: 0.1, fromEp: 0.02, fromGp: 0.01, fromPp: 0.001},
	    SP: {name:'sp', fName:'Silver Pieces',   attr:'sp', fromCp: 10,   fromSp: 1,   fromEp: 0.2,  fromGp: 0.1,  fromPp: 0.01},
	    EP: {name:'ep', fName:'Electrum Pieces', attr:'ep', fromCp: 50,   fromSp: 5,   fromEp: 1,    fromGp: 0.5,  fromPp: 0.05},
	    GP: {name:'gp', fName:'Gold Pieces',     attr:'gp', fromCp: 100,  fromSp: 10,  fromEp: 2,    fromGp: 1,    fromPp: 0.1},
	    PP: {name:'pp', fName:'Platinum Pieces', attr:'pp', fromCp: 1000, fromSp: 100, fromEp: 20,   fromGp: 10,   fromPp: 1}
    },

    getCoinForName = function(name) {
	    var result = null;
	    _.each(COINS, function(coin){
	        if(coin.name === name) {
	            result = coin;
            }
        });
	    return result;
    },

	increaseAttrByAmount = function(charId, attrName, amount) {
		var attr =  GeneralScripts.FindOrCreateAttr(charId, attrName);
		attr.set({
			current: parseInt(attr.get("current")||0) + parseInt(amount)
		});
		return attr;
	},

    decreaseAttrByAmount = function(charId, attrName, amount) {
	  var attr = GeneralScripts.FindAttr(charId, attrName);
	  if(attr && parseInt(attr.get("current")) >= parseInt(amount)) {
	      attr.set({
              current: parseInt(attr.get("current")) - parseInt(amount)
          });
	      return attr;
      } else {
	      return null;
      }
    },

	handleXp = function(msg) {
		if(msg.type == "api" && msg.content.indexOf(xpAPICommand) !== -1 && msg.who.indexOf("(GM)") !== -1) {
			if(!msg.selected) {
				GeneralScripts.WhisperGM(scriptName, "You must have tokens selected to use " + xpAPICommand);
			}
			var contents = GeneralScripts.ProcessInlineRolls(msg);
			var each = (contents.indexOf("--each") !== -1 || contents.indexOf("--e") !== -1);
			var amount = parseInt(contents.split(" ")[1]);
			var percent = contents.split(" ")[1].indexOf('%') !== -1;
			if(!each) {
				amount = amount/msg.selected.length;
				amount = (percent) ? amount : Math.ceil(amount);
			}
			_.each(msg.selected, function(sel){
				var token = getObj("graphic", sel._id);
				if(token.get("represents") != "") {
					var character = getObj("character", token.get("represents"));
					var xp = GeneralScripts.FindOrCreateAttr(character.id,xpAttrName);
					var prevLevel = LEVELS.getForXP((xp.get("current") === "" ? 0 :xp.get("current")));
					if(percent) {
						var percentAmount = amount;
						amount = Math.round(amount/100 * LEVELS.getXpDiffForLevel(prevLevel));
						log(percentAmount + '% of level ' + prevLevel + ' to level ' + (prevLevel + 1) + ' -> ' + amount);
					}
					xp.set("current", parseInt(xp.get("current")) + amount);
					GeneralScripts.WhisperGM(scriptName, character.get("name") + " new xp : " + xp.get("current"));
					var newLevel = LEVELS.getForXP(xp.get("current"));
					if(prevLevel !== newLevel) {
						var output = "/desc " + character.get("name") + " has gained enough experience to reach level " + newLevel;
						sendChat("", output);
					}
				} else {
					GeneralScripts.WhisperGM(scriptName, "Tried to give xp to an invalid token.");
				}
			});
		}
	},


	handleCoin = function(msg) {
		if(msg.type == "api" && msg.content.indexOf(coinAPICommand) !== -1 && msg.who.indexOf("(GM)") !== -1 ) {
			if(!msg.selected) {
				GeneralScripts.WhisperGM(scriptName, "You must have tokens selected to use " + coinAPICommand);
			}
			var contents = GeneralScripts.ProcessInlineRolls(msg);
			var options = parseCoinsFromCommand(contents);
			var spend = (contents.indexOf('--spend') !== -1 || contents.indexOf('--s ') !== -1);
			var each = (contents.indexOf('--each') !== -1 || contents.indexOf('--e ') !== -1);
			if(!spend && !each) {
				log("Splitting coins");
				_.each(options, function(value,key){
				    options[key] = Math.ceil(value / msg.selected.length);
                });
			}
			if(!spend && msg.who.indexOf("(GM)") === -1) {
			    GeneralScripts.WhisperError(scriptName, msg.who + ' tried to give money, but that is reserved for GMs only. ' + contents);
			    return;
            }
            var characters = [];
			_.each(msg.selected, function(sel){
                var token = getObj("graphic", sel._id);
                if(token.get("represents") !== '') {
                	characters.push(getObj("character", token.get("represents")));
                }
			});

			distributeCoins(characters, options, spend);
		}
	},

	parseCoinsFromCommand = function(contents) {
		var obj = {};

		_.each(contents.split('--'), function(cmd){
		    var args = cmd.split(' '),
                coin = getCoinForName(args[0]),
                amount = parseInt(args[1]||0) || 0;
            if(coin) {
		        obj[coin.name] = (obj[coin.name] || 0) + amount;
            }
		});

		return obj;
	},

	distributeCoins = function(characters, coins, spend) {
        _.each(characters, function(character){
            var output = "&{template:default} {{name=" + character.get("name") + " found}}";
            _.each(coins, function(value, key){
                // We only want to bother adding the amount if the amount is greater than 0.
                var coin = (value > 0 ? getCoinForName(key) : null);
                if(coin) {
                    if(!spend) {
                        increaseAttrByAmount(character.id, coin.attr, value);
                    } else {
                        decreaseAttrByAmount(character.id, coin.attr, value);
                    }
                    output = output + '{{' + coin.fName + '=' + value + '}} ';
                }
            });
            GeneralScripts.SendChat("GM", "/w " + character.get("name").split(" ")[0] + " " + output);
            GeneralScripts.WhisperGM(scriptName, output);
        });
	},

	INDIVIDUAL_TREASURE = {
		table: [
			{
				cr: _.range(0,4),
				table: [
					{ roll: _.range( 1, 30), cp: "5d6"},
					{ roll: _.range(31, 60), sp: "4d6"},
					{ roll: _.range(61, 70), ep: "3d6"},
					{ roll: _.range(71, 95), gp: "3d6"},
					{ roll: _.range(96,100), pp: "1d6"}
				]
			},
			{
				cr: _.range(5,10),
				table: [
					{ roll: _.range( 1, 30), cp: "(4d6)*100", ep: "(1d6)*10"},
					{ roll: _.range(31, 60), sp: "(6d6)*10",  gp: "(2d6)*10"},
					{ roll: _.range(61, 70), ep: "(3d6)*10",  gp: "(2d6)*10"},
					{ roll: _.range(71, 95), gp: "(4d6)*10"},
					{ roll: _.range(96,100), gp: "(2d6)*10",  pp: "3d6"}
				]
			},
			{
				cr: _.range(11,16),
				table: [
					{ roll: _.range( 1, 20), sp: "(4d6)*100", gp: "(1d6)*100"},
					{ roll: _.range(21, 35), ep: "(1d6)*100", gp: "(1d6)*100"},
					{ roll: _.range(36, 75), gp: "(2d6)*100", pp: "(1d6)*10"},
					{ roll: _.range(76,100), gp: "(2d6)*100", pp: "(2d6)*10"}
				]
			},
			{
				cr: _.range(17,30),
				table: [
					{ roll: _.range( 1, 15), ep: "(2d6)*1000", gp: "(8d6)*100"},
					{ roll: _.range(16, 55), gp: "(1d6)*1000", pp: "(1d6)*100"},
					{ roll: _.range(56,100), gp: "(1d6)*1000", pp: "(2d6)*100"}
				]
			}
		],

		roll: function(cr) {

		}
	},

	lootCorpse = function(msg) {},

	PartyParcel = (function(){
		'use strict';
		var obj = {};
		var pcTableRegex = new RegExp("<table><thead><tr><td(?:.*?)>Characters</td></tr></thead><tbody>(.*?)</tbody></table>"),
            coinTableRegex = new RegExp("<table><thead><tr><td>Amount</td><td>Type</td></tr></thead><tbody>(.*?)</tbody></table>");

        // This function courtesy of The Aaron to generate a universally unique ID that can be used to generate a row ID for
        // a repeating section of a character sheet.
		var generateUUID = (function() {
                "use strict";

                var a = 0, b = [];
                return function() {
                    var c = (new Date()).getTime() + 0, d = c === a;
                    a = c;
                    for (var e = new Array(8), f = 7; 0 <= f; f--) {
                        e[f] = "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz".charAt(c % 64);
                        c = Math.floor(c / 64);
                    }
                    c = e.join("");
                    if (d) {
                        for (f = 11; 0 <= f && 63 === b[f]; f--) {
                            b[f] = 0;
                        }
                        b[f]++;
                    } else {
                        for (f = 0; 12 > f; f++) {
                            b[f] = Math.floor(64 * Math.random());
                        }
                    }
                    for (f = 0; 12 > f; f++){
                        c += "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz".charAt(b[f]);
                    }
                    return c;
                };
            }()),

            // This is another function courtesy of The Aaron to generate a Row ID of a repeating section
            generateRowID = function () {
                "use strict";
                return generateUUID().replace(/_/g, "Z");
            },

			/*
			 Adds a new variable to a coins object containing the coins that are not evenly distributed to the given characters.
			 Also updates the coins to be the amount of coins that each person would receive
			 */
            updateExcessCoins = function(coins, numCharacters) {
                coins.excess = {};
                if(numCharacters > 1) {
                    _.each(COINS, function(c){
                        coins.excess[c.name] = coins[c.name] % numCharacters;
                        coins[c.name] = (coins[c.name] - coins.excess[c.name]) / numCharacters;
                    });
                } else {
                    _.each(COINS, function(c){ coins.excess[c.name] = 0; });
                }
            },

            parsePCsFromParcel = function(notes) {
                var characters = [];
                var rowRegex = new RegExp("<tr><td>(.+?)<\/td><\/tr>", 'g');
                var rowMatch;
                while((rowMatch = rowRegex.exec(notes))) {
                    var cName = rowMatch[1];
                    log(cName);
                    var character = findObjs({ _type: 'character', name: cName })[0];
                    if(character) {
                        characters.push(character);
                    } else {
                        log('No character found with name \'' + cName + '\'');
                        sendChat(scriptName, '/w gm No character found with name \'' + cName +'\'', null, {noarchive:true});
                    }
                }
                return characters;
            },

            parseCoinsFromParcel = function(notes) {
                var coins = {};
                _.each(COINS, function(c){
                    var regex = new RegExp("<tr><td>(.*?)<\/td><td>" + c.name + "<\/td><\/tr>");
                    var match = regex.exec(notes)[1];
                    var value = (match) ? match.split('<td>')[match.split('<td>').length - 1] : '0';
                    //log(match + ' -> ' + value);
                    coins[c.name] = parseInt(value);
                });
                return coins;
            },

            createNewParcel = function() {
                var notes = createParcelTableForCoins(null);
                return createObj('handout', {name: parcelHandoutName, notes: notes});
            },

            createParcelTableForCoins = function(coins) {
                if(!coins) {
                    coins = {};
                    _.each(COINS, function(c){ coins[c.name] = 0; });
                }

                var table = '<table><thead><tr><td>Amount</td><td>Type</td></tr></thead><tbody>';
                _.each(COINS, function(c){
                    table = table + '<tr><td>'+ coins[c.name] +'</td><td>'+ c.name +'</td></tr>';
                });
                table = table +'</tbody></table><br>';

                return table;
            };

        obj.findOrCreateParcel = function() {
            var existing = findObjs({
                _type: 'handout',
                name: parcelHandoutName
            })[0];
            return (existing) ? existing : createNewParcel();
        };

        obj.distribute = function(msg) {
            if(msg.type === 'api' && msg.content.indexOf('!distributeParcel') !== -1 && msg.who.indexOf('(GM)') !== -1) {
                log('distribute parcel');
                var parcel = obj.findOrCreateParcel();
                parcel.get('notes', function(notes){
                    log(notes);
                    log('get pcs');
                    var pcTableStr = pcTableRegex.exec(notes) ? pcTableRegex.exec(notes)[0] : null;
                    if(!pcTableStr) { log('No table with header - Characters found in the parcel.'); return; }
                    var characters = parsePCsFromParcel(pcTableStr);
                    log('get coins');
                    var coinTableStr = coinTableRegex.exec(notes) ? coinTableRegex.exec(notes)[0] : null;
                    log(coinTableStr);
                    if(!coinTableStr) { log('No table for coins found.'); return; }
                    var coins = parseCoinsFromParcel(coinTableStr);
                    log(coins);
                    updateExcessCoins(coins, characters.length);
                    // distribute the coins and update the coin table with the excess coins.
                    distributeCoins(characters, coins, false);
                    var newCoinTableStr = createParcelTableForCoins(coins.excess);
                    notes = notes.replace(coinTableStr, newCoinTableStr);
                    log(notes);

                    // defer setting until 100 milliseconds later.  This might help get
                    // out of whatever race condition you are in...
                    setTimeout(function(){
                        parcel.set('notes', notes);
                    },100);
                });
            }
        };

		return obj;
	}()),

    handleInput = function(msg) {
        handleXp(msg);
        handleCoin(msg);
        PartyParcel.distribute(msg);
    },

	checkInstall = function() {
		PartyParcel.findOrCreateParcel();
		log(scriptName + " v" + version + " Ready");
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
	PartyTracker.CheckInstall();
	PartyTracker.RegisterEventHandlers();
});