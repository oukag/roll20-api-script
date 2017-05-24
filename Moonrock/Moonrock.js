//======================================================================================================================
//
// Github:   https://github.com/oukag/roll20-api-script/blob/master/Moonrock/Moonrock.js
// By:       Kyle G.
// Contact:  https://app.roll20.net/users/1419660/kyle-g
//
// Moonrock script
// Commands
// !advanceDay <num>    - Advances the lunar calendar by <num> days and displays the result. Defaults to 1 if no num is provided.
// !getDay              - Displays the current day according to the lunar calendar.
// !reloadCalendar date - Reloads the Calender for set the current date the the one provided.
//                        Expects a date given in the D/M/Y format. For example, 15 The Overgrowth, 801 is 15/7/801.
//======================================================================================================================

var Moonrock = Moonrock || (function(){
        'use strict';

        var scriptName = 'Moon Cycles',
            version = '0.1.0',

            moon_cycle_imgsrc = "http://donjon.bin.sh/fantasy/calendar/ma_moonsprite32_32c1r.png",

            lunar_css = "<div style='float:left;width:32px;height:32px;background-image: url(" + moon_cycle_imgsrc + "); text-indent:-1000px;overflow:hidden; background-position:POSpx 0'>DESC</div>",
            lunarPhase =  [
                lunar_css.replace('POS','0').replace('DESC','New Moon'),
                lunar_css.replace('POS','-128').replace('DESC','Waxing Crescent'),
                lunar_css.replace('POS','-256').replace('DESC','First Quarter'),
                lunar_css.replace('POS','-384').replace('DESC','Waxing Gibbous'),
                lunar_css.replace('POS','-512').replace('DESC','Full Moon'),
                lunar_css.replace('POS','-640').replace('DESC','Waning Gibbous'),
                lunar_css.replace('POS','-768').replace('DESC','Third Quarter'),
                lunar_css.replace('POS','-896').replace('DESC','Waning Crescent')
            ],

            Moons = [
                {   name:"The Opal Eye",     lunar_cyc: 7, lunar_shf:0,
					eclipse:  "The Opal Eye flares at midnight, healing all injuries by 50% and dispelling hostile magic for 2 hours as a 5th level Caster"
                },
                {   name:"The White Lady",   lunar_cyc: 9, lunar_shf:0,
                    eclipse:  "The White Lady pulses with light and hostile intentions are not possible to undertake for 8 hours after a long rest."
                },
                {   name:"Darkness' Folly", lunar_cyc:15, lunar_shf:0,
                    eclipse:  "Darkness' Folly seems to briefly fade and divine casters can sense the planar boundries weakening. All prayers are heard much, much clearer."
                },
                {   name:"Red Tear",         lunar_cyc:19, lunar_shf:0,
                    eclipse:  "Red Tear drips blood; all damage for the next 12 hours after a long rest is increased by 30%."
                },
                {   name:"Aether's Gaze",   lunar_cyc:27, lunar_shf:0,
                    eclipse:  "Aether's Gaze supercharges Arcane Magic, and all arcane spells cast have a 30% not to be forgotten."
                }
            ],
			OPAL       = Moons[0],
			WHITE_LADY = Moons[1],
			DARKNESS   = Moons[2],
			RED_TEAR   = Moons[3],
			AETHER     = Moons[4],

            LunarEvents = [
                /**
                 * To add a new event copy the format below.
                 *
                 * name    - Will be bolded and displayed when triggered.
                 * trigger - The sequence of moons that will trigger the event. It is better to specify moons that are
                 *           neither new or full so that the event calculation will be able to show if a specific event
                 *           did not occur.
                 *
                 *           For example when I was creating the single new/full moon events, I was getting incorrect
                 *           results when Red Tear was new and Aether's Gaze was new. The output was only showing Aether's
                 *           Gaze being new and not Red Tear as well.
                 *
                 *              - isNewMoon(MOON)  -> true when it is a new moon
                 *              - isFullMoon(MOON) -> true when it is a full moon
                 *              - isNeither(MOON)  -> true when it is neither a new moon or a full moon
                 *
                 * event   = The description for the event the will be displayed when triggered.
                 */
                {   name:"The Opal Eye full moon", // Opal full
                    trigger: function() { return isFullMoon(OPAL) && isNeither(WHITE_LADY) && isNeither(DARKNESS) && isNeither(RED_TEAR) && isNeither(AETHER)},
                    event: "The Opal Eye heals wounds. A long rest taken during a full moon doubles HP recovery."
                },
                {   name:"The Opal Eye new moon", // Opal new
                    trigger: function() { return isNewMoon(OPAL) && isNeither(WHITE_LADY) && isNeither(DARKNESS) && isNeither(RED_TEAR) && isNeither(AETHER)},
                    event: "The Opal Eye shuts, and all damage dealt that night is increased by 3."
                },
                {   name:"The White Lady full moon", // White Lady full
                    trigger: function() { return isFullMoon(WHITE_LADY) && isNeither(OPAL) && isNeither(DARKNESS) && isNeither(RED_TEAR) && isNeither(AETHER)},
                    event: "The White Lady ensures there will be no encounters in the wilderness, allowing mortal enemies to go their separate ways."
                },
                {   name:"The White Lady new moon", // White Lady full
                    trigger: function() { return isNewMoon(WHITE_LADY) && isNeither(OPAL) && isNeither(DARKNESS) && isNeither(RED_TEAR) && isNeither(AETHER)},
                    event: "The White Lady's luck runs out and dangerous animal encounter chances are increased by 30%."
                },
                {   name:"Darkness' Folly full moon", // Darkness full
                    trigger: function() { return isFullMoon(DARKNESS) && isNeither(WHITE_LADY) && isNeither(OPAL) && isNeither(RED_TEAR) && isNeither(AETHER)},
                    event: "Darkness' Folly strengthens Divine Magic, boosting saving throws for allies and hindering foes."
                },
                {   name:"Darkness' Folly new moon", // Darkness new
                    trigger: function() { return isNewMoon(DARKNESS) && isNeither(WHITE_LADY) && isNeither(OPAL) && isNeither(RED_TEAR) && isNeither(AETHER)},
                    event: "Darkness' Folly closes, giving dark magic a 20% boost to effects and a -2 to all saving throws for the heroes."
                },
                {   name:"Red Tear Eye full moon", // Red Tear full
                    trigger: function() { return isFullMoon(RED_TEAR) && isNeither(WHITE_LADY) && isNeither(DARKNESS) && isNeither(OPAL) && isNeither(AETHER)},
                    event: "Red Tear increases the encounter chance to sate the bloodlust of competing forces."
                },
                {   name:"Red Tear new moon", // Red Tear new
                    trigger: function() { return isNewMoon(RED_TEAR) && isNeither(WHITE_LADY) && isNeither(DARKNESS) && isNeither(OPAL) && isNeither(AETHER)},
                    event: "Red Tear reduces damage output by 3."
                },
                {   name:"Aether's Gaze full moon", // Aether full
                    trigger: function() { return isFullMoon(AETHER) && isNeither(WHITE_LADY) && isNeither(DARKNESS) && isNeither(RED_TEAR) && isNeither(OPAL)},
                    event: "Aether's Gaze empowers Arcane Magic, and all arcane spells cast are treated as if they were both Extended and Maximized (as the feats)."
                },
                {   name:"Aether's Gaze new moon", // Aether new
                    trigger: function() { return isNewMoon(AETHER) && isNeither(WHITE_LADY) && isNeither(DARKNESS) && isNeither(RED_TEAR) && isNeither(OPAL)},
                    event: "Aether's Gaze weakens Arcane Magic cast, granting a +3 to the saving throw and all targets are assumed to have Evasion."
                },
                {   name:"Night of Peace", // Opal New, Red Tear new
                    trigger: function() { return isNewMoon(OPAL) && isNewMoon(RED_TEAR) && isNeither(WHITE_LADY) && isNeither(DARKNESS) && isNeither(AETHER)},
                    event: "All Damage set to zero, meaning only self-inflicted damage takes effect."
                },
                {   name:"Blood Moon", // Opal New, Red Tear full
                    trigger: function() { return isNewMoon(OPAL) && isFullMoon(RED_TEAR) && isNeither(WHITE_LADY) && isNeither(DARKNESS) && isNeither(AETHER)},
                    event: "Tonight's going to be a Terrible Night..."
                },
                {   name:"Night of the Darkened Hex", // Opal New, Darkness new
                    trigger: function() { return isNewMoon(OPAL) && isNewMoon(DARKNESS) && isNeither(WHITE_LADY) && isNeither(RED_TEAR) && isNeither(AETHER)},
                    event: "Evil or hostile magic is at +150% potency"
                },
                {   name:"Night of the Angelic Hope", // Darkness full, Aether new
                    trigger: function() { return isFullMoon(DARKNESS) && isNewMoon(AETHER) && isNeither(WHITE_LADY) && isNeither(OPAL) && isNeither(RED_TEAR)},
                    event: "No Arcane Magic allowed from Midnight to Noon the next day"
                },
                {   name:"Night of Magic Purity", // Darkness full, Aether full
                    trigger: function() { return  isFullMoon(DARKNESS) && isFullMoon(AETHER) && isNeither(WHITE_LADY) && isNeither(OPAL) && isNeither(RED_TEAR)},
                    event: "All Sylterium Revealed to the naked eye"
                },
                {   name:"Night of the Rot", // Darkness new, Red Tear full
                    trigger: function() { return  isNewMoon(DARKNESS) && isFullMoon(RED_TEAR) && isNeither(WHITE_LADY) && isNeither(OPAL) && isNeither(AETHER)},
                    event: "Evil Deities Empowered and the barrier between worlds is weakened"
                },
                {   name:"Night of Wild Magic", // Darkness new, Aether new
                    trigger: function() { return isNewMoon(DARKNESS) && isNewMoon(AETHER) && isNeither(WHITE_LADY) && isNeither(OPAL) && isNeither(RED_TEAR)},
                    event: "All Spells, both Divine and Arcane, are WILD!"
                },
                {   name:"The Crying Lady", // White Lady full, Red Tear full
                    trigger: function() { return  isFullMoon(WHITE_LADY) && isFullMoon(RED_TEAR) && isNeither(OPAL) && isNeither(DARKNESS) && isNeither(AETHER)},
                    event: "All hits are Critical Hits, and Magic Damage is increased by 25%."
                },
                {   name:"Night of the Maddened Animals", // White Lady new, Red Tear full
                    trigger: function() { return isNewMoon(WHITE_LADY) && isFullMoon(RED_TEAR) && isNeither(OPAL) && isNeither(DARKNESS) && isNeither(AETHER)},
                    event: "Lycanthropy runs wild on a night like this..."
                },
                {   name:"Night of Open Omens", // Darkness full, Red Tear new,
                    trigger: function() { return isFullMoon(DARKNESS) && isNewMoon(RED_TEAR) && isNeither(WHITE_LADY) && isNeither(OPAL) && isNeither(AETHER)},
                    event: "Divinations are much stronger."
                },
                {   name:"Night of Invulnerable Life", // White Lady full, Opal full, Darkness full
                    trigger: function() { return isFullMoon(WHITE_LADY) && isFullMoon(OPAL) && isFullMoon(DARKNESS) && isNeither(RED_TEAR) && isNeither(AETHER)},
                    event: "No life may be taken this night."
                },
                {   name:"Night of Illusion", // White Lady full, Opal new, Aether full
                    trigger: function() { return isFullMoon(WHITE_LADY) && isNewMoon(OPAL) && isFullMoon(AETHER) && isNeither(DARKNESS) && isNeither(RED_TEAR)},
                    event: "Nothing is as it seems..."
                },
                {   name:"Night of the Living Dead", // Red Tear full, Darkness new, Aether full
                    trigger: function() { return isFullMoon(RED_TEAR) && isNewMoon(DARKNESS) && isFullMoon(AETHER) && isNeither(OPAL) && isNeither(WHITE_LADY)},
                    event: "Braaaaaaaaains..."
                },
                {   name:"Night of Resurrection", // Opal full, Darkness full, Red Tear new, Aether full
                    trigger: function() { return isFullMoon(OPAL) && isFullMoon(DARKNESS) && isNewMoon(RED_TEAR) && isFullMoon(AETHER) && isNeither(WHITE_LADY)},
                    event: "Raise Dead spells succeed 100% of the time."
                },
                {   name:"Glory of the Night", // All full
                    trigger: function() { return  isFullMoon(OPAL) && isFullMoon(WHITE_LADY) && isFullMoon(DARKNESS) && isFullMoon(RED_TEAR) && isFullMoon(AETHER)},
                    event: "A night of all five moons being full is known as the Glory of the Light, with all that is Good receiving significant bonuses."
                },
                {   name:"Midnight's Moon", // All new
                    trigger: function() { return isNewMoon(OPAL) && isNewMoon(WHITE_LADY) && isNewMoon(DARKNESS) && isNewMoon(RED_TEAR) && isNewMoon(AETHER)},
                    event: "all moons being new is known as Midnight's Moon in which fiends spawn, vile unspeakable things happen, and the world falls to pieces... only for Evil to vanish at dawn... supposedly."
                }
			],

			CelestialEvents = [
				{ event:'Aurora',           weight:  1},
				{ event:'Shooting star',    weight: 10},
				{ event:'Fireball',         weight:  2},
				{ event:'Meteor shower',    weight:  2},
				{ event:'Lunar Eclipse',    weight:  2},
				{ event:'Solar Eclipse',    weight:  1},
				{ event:'Morning star',     weight:  5},
				{ event:'Evening star',     weight:  5},
				{ event:'Wanderers gather', weight:  1},
				{ event:'Comet appears',    weight:  1},
				{ event:'',                 weight: 70}
			],

            Months = [
                {name:"Diamond",        days:44},
                {name:"The Dreary",     days:34},
                {name:"The Awakening",  days:34},
                {name:"Creation",       days:34},
                {name:"Seedling",       days:34},
                {name:"The Tree",       days:44},
                {name:"The Overgrowth", days:34},
                {name:"The Culling",    days:34},
                {name:"The Harvesting", days:34},
                {name:"The Sunder",     days:34},
                {name:"The Chaos",      days:34},
                {name:"Withering",      days:34},
                {name:"The Roaming",    days:34},
                {name:"The Retreat",    days:34},
                {name:"Icefire",        days:44}
            ],

            Days = [
                'Maldor',
                'Torday',
                'Irah',
                'Peniel',
                'Asdel',
                'Randel',
                'Elvoss',
                'Illyrie'
            ],

            firstDay = Days[4], // Asdel

            handleInput = function(msg) {
                if(msg.type == 'api') {
                    if(msg.content.indexOf('!getDay') !== -1) { output(); }
                    if(msg.content.indexOf('!advanceDay') !== -1) { handleAdvanceDay(msg); }
                    if(msg.content.indexOf('!reloadCalendar') !== -1) { handleResetCalendar(msg); }
                }
            },

            handleAdvanceDay = function(msg){
                var cmds = msg.content.split(' ');
                var num = (cmds.length > 1 && parseInt(cmds[1])) ? parseInt(cmds[1]) : 1;
                if(num > 1) { sendChat(scriptName, '/w gm advancing days by ' + num); }
                progressDays(num);
                output();
            },

            handleResetCalendar = function(msg){
                var cmds = msg.content.split(' ');
                if(cmds.length < 2) { sendChat(scriptName, '/w gm No date found to reset calendar. Expected format D/M/Y.'); return;}
                var date = cmds[1].split('/');
                if(date.length < 3) { sendChat(scriptName, '/w gm Illegal date format given. Expected format D/M/Y.'); return; }
                resetCalendar(parseInt(date[0]), parseInt(date[1]), parseInt(date[2]));
            },

            progressDays = function(num) {
                if(typeof num != 'number') { log('progressDays -> provided num was not of type number'); return; }
                if(num <= 0) { log('progressDays -> provided number was zero or negative.'); return; }
                // Update the Date
                incrementDate(num);
                // Update the day of the week
                var currDay = getDayForName(state.Moonrock.day) + num;
                state.Moonrock.day = Days[currDay % Days.length];
                // Update the Lunar Calendar
                var moonStr = '';
                _.each(Moons, function(moon){
                    if(!moon.curr && moon.curr != 0) { log(moon.name + ' did not have set value. This could mean that the state value was not read properly.'); return; }
                    moon.curr = (moon.curr + num);
                    moon.curr = (moon.curr > moon.lunar_cyc) ? (moon.curr % moon.lunar_cyc) - 1 : moon.curr;
                    moonStr = moonStr + moon.curr + ',';
                });
                //log(moonStr);
                // Remove the last comma before updating the state.
                state.Moonrock.moons = moonStr.slice(0,moonStr.length-1);
                // Update celestial events
                state.Moonrock.celestial = celestial_event();
            },

            output = function(){
                //var output = "/w gm &{template:default} {{name=Moons}} {{=<div>";
                var output = "/w gm <div style='background-color:#FFFFFF; padding:5px; border:1px solid black;'>";
                // Get the Date
                var date = getCurrentDate();
                output = output + "<div><p><b>" + date.day + " " + Months[date.month - 1].name + ", " + date.year + "</b></p></div>";
                // Get the day of the week
                output = output + "<div><p><b>" + state.Moonrock.day + "</b></p></div>";
                // Get the moons
                _.each(Moons, function(moon) {
                    var phase = lunar_phase(moon);
                    // Remove the float:left from the last moon to prevent causing future divs from being misaligned
					if(Moons[Moons.length-1].name === moon.name) { phase = phase.replace("float:left;", ""); }
					//log(phase);
                    output = output + phase;
                });
                // Check for Celestial Events (Random or Lunar)
				if(state.Moonrock.celestial) { output = output + "<div><p><b>" + state.Moonrock.celestial + "</b></p></div>"; }
				var lunar = lunar_event();
				if(lunar) { output = output + "<div>" + lunar + "</div>"; }
                // Check for encounter
                output = output + encounter();
                // Close the main div
                output = output + "</div>";
                log(output);
                sendChat(scriptName, output);
            },

            encounter = function(){
                var d8 = randomInteger(8), d12 = randomInteger(12);
                return "<div><p>Encounter roll (d8): <b>" + d8 + (d8 >= 7 ? " Encounter" : " No encounter") + "</b></p>" +
                    "<p>Danger level (d12): <b>" + d12 + "</b></p></div>";
            },

            lunar_event = function() {
                var result = '';
                // Goes through each event in the LunarEvents to see if it is triggered. If multiple events are triggered,
                // the result is the event that is further down in the list.
                _.each(LunarEvents, function(event){
                    if(event.trigger()) { log(event.name); result = "<p><b>" + event.name + "</b></p><p>" + event.event + "</p>"; }
                });
                if(!result && (!isNeither(OPAL) || !isNeither(WHITE_LADY) || !isNeither(DARKNESS) || !isNeither(RED_TEAR) || !isNeither(AETHER))) {
                    var getMoon = function(moon){return (isFullMoon(moon) ? (moon.name + " - FULL\n") : (isNewMoon(moon) ? (moon.name + " - NEW<br>") : "")); };
                    result = "<p>No event found for:<br><b>" + getMoon(OPAL) + getMoon(WHITE_LADY) + getMoon(DARKNESS) + getMoon(RED_TEAR) + getMoon(AETHER) + "</b></p>";
                }
                log(result);
                return result;
            },

            celestial_event = function() {
                var total = 0;
                _.each(CelestialEvents, function(event){total = total + event.weight;});
                var idx = randomInteger(total);
                var result = '';
                for(var i = 0, j = CelestialEvents.length; i < j && idx > 0; i++) {
                    idx = idx - CelestialEvents[i].weight;
                    if(idx <= 0) { result = CelestialEvents[i].event;}
                }
                if(result == 'Lunar Eclipse' && Moons.length) { result = eclipse(); }
                return result;
            },

            lunar_phase = function(moon) {
                var x = (moon.curr / moon.lunar_cyc);
                var f = (x - Math.floor(x));
                return lunarPhase[Math.floor(f * 8)];
            },

            eclipse = function() {
            	var moon = random_moon();
            	return 'Eclipse of ' + moon.name + '. ' + moon.eclipse;
            },

            random_moon = function() {
                var idx = randomInteger(Moons.length);
                return Moons[idx];
            },

			isNewMoon = function(moon)  { return lunar_phase(moon) === lunarPhase[0];},
			isFullMoon = function(moon) { return lunar_phase(moon) === lunarPhase[4];},
            isNeither = function(moon) { return !isNewMoon(moon) && !isFullMoon(moon); },

            resetCalendar = function(day, month, year){
                if(typeof day != 'number' || typeof month != 'number' || typeof year != 'number'){ log('resetCalendar -> provided day, month, or year was not a number.'); return; }
                // Reset Date
                state.Moonrock.date = "1/1/1";
                // Reset the day of the week
                state.Moonrock.day = firstDay;
                // Reset Moons
                var stateStr = '';
                _.each(Moons, function(moon){ stateStr = stateStr + moon.lunar_shf +','; });
                var moons = state.Moonrock.moons.split(',');
                for(var i = 0, j = Moons.length; i < j; i++) { Moons[i].curr = parseInt(moons[i]); }
                // Remove the last comma before updating the state.
                state.Moonrock.moons = stateStr.slice(0,stateStr.length-1);
                progressDays(daysSinceBeginning(day, month, year));
                output();
            },

            daysSinceBeginning = function(day, month, year) {
                if(typeof day != 'number' || typeof month != 'number' || typeof year != 'number'){ log('daysSinceBeginning -> provided day, month, or year was not a number.'); return 0; }
                var numDays = 0;
                var daysPerYear = 0;
                _.each(Months, function(m){ daysPerYear = daysPerYear + m.days; });
                // Add the number of days from year 1
                numDays = numDays + (daysPerYear * (year-1));
                // Add the number of days for each month starting from month 1.
                for(var i = 0, j = Months.length; i < j && i + 1 < month; i++) {
                    numDays = numDays + Months[i].days;
                }
                // Add the days from the beginning of the month to now;
                numDays = numDays + day - 1;
                log('Days since 1/1/1: ' + numDays);
                return numDays;
            },

            getDayForName = function(day) {
                var idx = -1;
                for(var i = 0, j = Days.length; i < j; i++) {
                    if(Days[i].toLowerCase() === day.toLowerCase()) { idx = i; }
                }
                return idx;
            },

            incrementDate = function(num) {
                if(typeof num != 'number') { log('incrementDate -> provided num was not of type number'); return; }
                if(num <= 0) { log('incrementDate -> provided number was zero or negative.'); return; }
                var date = getCurrentDate();
                while(num > 0) {
                    date.day = date.day + 1;
                    if(date.day > Months[date.month-1].days) {
                        date.day = 1;
                        date.month = date.month + 1;
                        if(date.month > Months.length) {
                            date.month = 1;
                            date.year = date.year + 1;
                        }
                    }
                    num = num - 1;
                }
                setCurrentDate(date.day, date.month, date.year);
            },

            getCurrentDate = function() {
                var date = state.Moonrock.date.split('/');
                return {
                    day:   parseInt(date[0]),
                    month: parseInt(date[1]),
                    year:  parseInt(date[2])
                };
            },

            setCurrentDate = function(d, m, y) {
                if(typeof d != 'number' || typeof m != 'number' || typeof y != 'number'){ log('setCurrentDate -> provided day, month, or year was not a number.'); return; }
                state.Moonrock.date = d + '/' + m + '/' + y;
                log('New date: ' + state.Moonrock.date);
            },

            checkInstall = function(){
                log(scriptName + ' v' + version + ' ready');
            },

            registerEventHandlers = function(){
                on('chat:message', handleInput);
            },

            loadState = function(){
                state.Moonrock = state.Moonrock || {};
                state.Moonrock.date = state.Moonrock.date || '1/1/1'; // Day/Month/Year
                state.Moonrock.day = state.Moonrock.day || firstDay;
                if(!state.Moonrock.moons) {
                    var stateStr = '';
                    _.each(Moons, function(moon){ stateStr = stateStr + moon.lunar_shf +','; });
                    // Remove the last comma before updating the state.
                    state.Moonrock.moons = stateStr.slice(0,stateStr.length-1);
                }
                state.Moonrock.celestial = state.Moonrock.celestial || "";
                var moons = state.Moonrock.moons.split(',');
                for(var i = 0, j = Moons.length; i < j; i++) { Moons[i].curr = parseInt(moons[i]); }
                log(moons);
            };

        return {
            CheckInstall: checkInstall,
            RegisterEventHandlers: registerEventHandlers,
            LoadState: loadState
        };
    }());

on('ready', function(){
    'use strict';
    Moonrock.CheckInstall();
    Moonrock.RegisterEventHandlers();
    Moonrock.LoadState();
});