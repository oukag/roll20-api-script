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
            var output = "&{template:default} {{name=" + character.get("name") + (spend ? " spent" : " found") + "}}";
            // Used to determine if we should even bother outputing to the player. We don't want to output if there
			// weren't any coins given.
            var displayOutput = false;
            _.each(coins, function(value, key){
                // We only want to bother adding the amount if the amount is greater than 0.
                var coin = (value > 0 ? getCoinForName(key) : null);
                if(coin) {
                	displayOutput = true;
                    if(!spend) {
                        increaseAttrByAmount(character.id, coin.attr, value);
                    } else {
                        decreaseAttrByAmount(character.id, coin.attr, value);
                    }
                    output = output + '{{' + coin.fName + '=' + value + '}} ';
                }
            });
            if(displayOutput) {
                GeneralScripts.SendChat("GM", "/w " + character.get("name").split(" ")[0] + " " + output);
                GeneralScripts.WhisperGM(scriptName, output);
            }
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

		var REGEX = {
			PC_TABLE: new RegExp("<table><thead><tr><td(?:.*?)>Characters</td></tr></thead><tbody>(.*?)</tbody></table>"),
			PC_ROW: new RegExp("<tr><td>(.+?)<\/td><\/tr>", 'g'),

			COIN_TABLE: new RegExp("<table><thead><tr><td>Amount</td><td>Type</td></tr></thead><tbody>(.*?)</tbody></table>"),
			COIN_ROW: function(coin_name) {
				return new RegExp("<tr><td>(.*?)<\/td><td>" + coin_name + "<\/td><\/tr>");
				},

			ITEM_TABLE: new RegExp("<table><thead><tr><td>Item</td><td>Amount</td><td>Character</td></tr></thead><tbody>(.*?)</tbody></table>"),
			ITEM_ROW: new RegExp('<tr><td><a.+handout\/(.+?)\\">(.+?)<\/a><\/td><td><strong>(.+?)<\/strong><\/td><td>(.+?)<\/td><\/tr>', 'g')
		};

			/*
			 Adds a new variable to a coins object containing the coins that are not evenly distributed to the given characters.
			 Also updates the coins to be the amount of coins that each person would receive
			 */
        var updateExcessCoins = function(coins, numCharacters) {
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

			getDistributedItems = function(items) {
            	// Distribute will contain the character ID's and an array of items per character that will be given.
            	items.distribute = {};
            	_.each(items, function(item, id){
            		if(id != 'distribute') {
                        // If we are missing information in the row information, or were given incorrect information,
                        // we will just set the row as an excess item row rather than determining what the actual
                        // problem was. The user can look to the log to figure out why it failed.
            			if(item.name && item.amount && parseInt(item.amount) > 0 && item.characterStr) {
							var amountDistributed = 0;
                            // Get the character(s) who will get the item.
							_.each(item.characterStr.split(','), function(str) {
                                var split = str.split('|');
								var aDis = split.length > 1 ? parseInt(split[1]) : 1;

                                var character = findObjs({ _type: 'character', name: split[0] })[0];
                                if(character) {
                                	// update the amount to distribute
                                    amountDistributed = amountDistributed + aDis;
                                	if(!items.distribute[character.id]) {
                                		items.distribute[character.id] = [];
									}
									// Get the item
                                    items.distribute[character.id].push({
                                        handoutid: id,
                                        amount: aDis,
                                        name: item.name,
										originalrow: item.originalrow,
                                        notes: item.notes
                                    });
                                } else {
                                    sendChat(scriptName, '/w gm No character found with name \'' + split[0] +'\'', null, {noarchive:true});
								}
							});
							if(amountDistributed > item.amount) {
                                sendChat(scriptName, '/w gm Cannot distribute more ' + item.name + 'than there are in the parcel', null, {noarchive:true});
							} else if(amountDistributed < item.amount) {
								// There are remaining items that would need to be distributed at another time
								item.amount = item.amount - amountDistributed;
							} else {
								// There will be no excess item of this type, so we will reset the row information.
								item = null;
							}

						} else {
                            var problemStr = 'problem with item: id:' + id;
                            if(!item.name) { problemStr = problemStr + "\tNo name attribute found\n"; }
							if(!item.amount) { problemStr = problemStr + "\tNo amount attribute found\n"; }
							if(item.amount && parseInt(item.amount) <= 0) { problemStr = problemStr + "\tIncorrect amount found\n"; }
							if(!item.characterStr) { problemStr = problemStr + "\tNo characters were given"; }
							log(problemStr);
                        }
						// Update the item in the list.
                        items[id] = item;
					}
				});
            	return items;
			},

			distributeItems = function(items) {
            	items = getDistributedItems(items);
            	log('distribute items');
            	log(items);

			},

            parsePCsFromParcel = function(notes) {
                var characters = [];
                var rowMatch;
                while((rowMatch = REGEX.PC_ROW.exec(notes))) {
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
                    var match = REGEX.COIN_ROW(c.name).exec(notes)[1];
                    var value = (match) ? match.split('<td>')[match.split('<td>').length - 1] : '0';
                    //log(match + ' -> ' + value);
                    coins[c.name] = parseInt(value);
                });
                return coins;
            },

			parseItemsFromParcelAsync = function(notes) {
            	var items = {};
            	var rowMatch;
            	// We want to go through each of the rows in the item table and get the individual information filtered
				// from the HTML code.
            	while(rowMatch = REGEX.ITEM_ROW.exec(notes)) {
            		// expected rowMatch should be as follows.
					// index 0 would be the entire row string including the html
					var handoutid = rowMatch[1];
            		items[handoutid] = {
                        name: rowMatch[2],
                        amount: rowMatch[3],
                        characterStr: rowMatch[4],
                        originalrow: rowMatch[0] // We keep this to update the table after distributing the items
                    };
				}
				log(items);

            	// This next variable method is a way to get around the asynchronous calls we are about to make.
				// By utilizing _.after we wait until this method is call the number of times equal to the items rows
				// we just parsed before actually entering into the method and performing the next calculations.
				//
				// In essence this is how you can turn a number of asynchronous calls into a sequential method.
            	var finallyUseItems = _.after(_.size(items), function(){
            		distributeItems(items);
                });

            	// Before we finally use the items that we have parsed, we want to get the notes from the handouts
				// attached in the item. These handout notes will contain the attribute information for the item if we
				// need to create a new repeating inventory item for the character(s).
            	_.each(items, function(r,id){
            		var handout = getObj('handout', id);
            		//log(handout);
                    handout.get('notes', function (notes) {
                        items[id].notes = notes;
                        // Each time we call this we are getting closer to actually entering into the method.
                        finallyUseItems();
                    });
				});
			},

            createNewParcel = function() {
                var notes = createParcelTableForCharacters() + '<br>' + createParcelTableForCoins(null) + '<br>' + createParcelTableForItems();
                var handout = createObj('handout', {name: parcelHandoutName});
                // We have to set the notes using this method rather than in the createObj method because there is a
				// chance that the notes will not be set using the createObj method due to the nature of the notes/gmnotes attributes.
				// This is similar to the reason that we set a delay when setting these attributes.
                handout.set('notes', notes);
                return handout;
            },

			createParcelTableForCharacters = function() {
            	return '<table><thead><tr><td style="text-align: center">Characters</td></tr></thead><tbody><tr><td></td></tr><tr><td></td></tr><tr><td></td></tr><tr><td></td></tr></tbody></table>';
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
                table = table +'</tbody></table>';

                return table;
            },

			createParcelTableForItems = function() {
            	return '';
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
                    var pcTableStr = REGEX.PC_TABLE.exec(notes) ? REGEX.PC_TABLE.exec(notes)[0] : null;
                    if(!pcTableStr) { log('No table with header - Characters found in the parcel.'); return; }
                    var characters = parsePCsFromParcel(pcTableStr);
                    log('get coins');
                    var coinTableStr = REGEX.COIN_TABLE.exec(notes) ? REGEX.COIN_TABLE.exec(notes)[0] : null;
                    log(coinTableStr);
                    if(!coinTableStr) { log('No table for coins found.'); return; }
                    var coins = parseCoinsFromParcel(coinTableStr);
                    log(coins);
                    updateExcessCoins(coins, characters.length);
                    // distribute the coins and update the coin table with the excess coins.
                    distributeCoins(characters, coins, false);
                    var newCoinTableStr = createParcelTableForCoins(coins.excess);
                    notes = notes.replace(coinTableStr, newCoinTableStr);
					// Update the notes of the handout again
                    // defer setting until 100 milliseconds later.  This is to help get out the race condition between
					// the callback function and setting the notes attribute.
                    setTimeout(function(){
                        parcel.set('notes', notes);
                    },100);

                    var itemTableStr = REGEX.ITEM_TABLE.exec(notes) ? REGEX.ITEM_TABLE.exec(notes)[0] : null;
                    // At this point we will be dealing with multiple asyncronous functions. If we want to perform any
					// other updates on the parcel notes, it will have to be passed into this method and done there.
                    parseItemsFromParcelAsync(itemTableStr);
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