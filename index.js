// Initializes server connections with appropriate login credentials
var mysql = require('mysql');
const Discord = require('discord.js');
const client = new Discord.Client();
var con = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "password",
    database: "dbtracker"
});

// Gets the current date
var now = new Date();

// Allows for easy change to what the command prefix is
const PREFIX = "!";
// Gets IDs of the owner of the server and the server itself
const OWNERID = "ownerid";
const SERVERID = "serverid";

// Gets the current time
function getCurrentTime() {
    setTimeout( getCurrentTime, 1 * 1000 );
    now = new Date();
}
getCurrentTime();

// Creates a new MySQL Table for a given user, with the format:
// GAME NAME | TOTAL TIME | DAILY TIME | WEEKLY TIME | PREV WEEKLY TIME | LAST PLAYED
function createNewTable( user ) {

    var sqlcmd = "CREATE TABLE `" + user.toString() + "` (game VARCHAR(255), totalTime INT DEFAULT 0, dailyTime INT DEFAULT 0, weeklyTime INT DEFAULT 0, prevweeklyTime INT DEFAULT 0, lastPlayed INT DEFAULT 0, PRIMARY KEY(game))";
    con.query( sqlcmd, function (err, result, fields) {
        if (err) throw err;
        console.log("Table created for " + user.username + ": " + user.toString() );
    });

    return;
}

// Accesses the MySQL database to add corresponding times to a user's table
function addPlayerTime( user, game, totVal, dailVal, weekVal ) {

    var sqlcmd = "INSERT INTO `" + user.toString() + "` (game, totalTime, dailyTime, weeklyTime) VALUES(\"" + game + "\", " +  totVal + ", " + dailVal +", " + weekVal +") ON DUPLICATE KEY UPDATE totalTime = totalTime + " + totVal + ", dailyTime = dailyTime + " + dailVal + ", weeklyTime = weeklyTime + " + weekVal;

	// Logs the error or success of updating a user's game times
    con.query( sqlcmd, function(err, result, fields) {
        if (err) {
            console.log("WARNING: <" + user.username + "'s time for " + game + " could not be added>");
            return;
        }
        console.log("---" + user.username + " ("+ user.toString() + ")'s Time for " + game + " Has Been Updated---");
    });
    return;
}

// Adds the appropriate values to 
function addPlayerTimes( user, totVal, dailVal, weekVal ) {

    if ( user === undefined || user === null ) return;
    if ( user.presence.game === null ) return;

    var sqlcmd = "SELECT 1 FROM `" + user.toString() + "` LIMIT 1";

	// Tests if a user exists in the table with a test query
    con.query( sqlcmd, function( err, result, fields ) {
        if ( err ) createNewTable( user );
        addPlayerTime( user, user.presence.game, totVal , dailVal, weekVal );
    });

    return;
}

// Will add a minute to all online player's times
function serverPlayersTimeUpdate() {

    var users = Array.from(client.users.values());

    for (i=0; i < users.length; i++) {

        if (users[i] === undefined) continue;
        if (users[i].presence.game === null ) continue;
        if (users[i].presence.status !== "online") continue;

        addPlayerTimes( users[i], 1, 1, 1 );
    }

    return;
}

// Performs a daily reset on the database
function playTimeDailyReset() {

    var users = Array.from(client.users.values());

    users.forEach( function(user) {

        var sqlcmd = "UPDATE `" + user.toString() + "` SET dailyTime = 0";
        con.query( sqlcmd, function(err, result, fields) {
            if (err) return;
            console.log("---" + user.username + " ("+ user.toString() + ")'s Daily Time(s) Have Been Reset---");
        });

    });
}

// Performs a weekly reset on the database
function playTimeWeeklyReset() {

    var users = Array.from(client.users.values());

    users.forEach( function(user) {

        var sqlcmd = "UPDATE `" + user.toString() + "` SET prevweeklyTime = weeklyTime";
        con.query( sqlcmd, function(err, result, fields) {
            if (err) return;
            console.log("---" + user.username + " ("+ user.toString() + ")'s Pevious Weekly Time(s) Have Been Set---");
        });
        sqlcmd = "UPDATE `" + user.toString() + "` SET weeklyTime = 0";
        con.query( sqlcmd, function(err, result, fields) {
            if (err) return;
            console.log("---" + user.username + " ("+ user.toString() + ")'s Weekly Time(s) Have Been Reset---");
        });
    });
}

client.on('ready', () => {

    //con.connect(function(err) {
       // if (err) throw err;
        //console.log("Connected to database!");
    //});

	// Logs sucessful login
    console.log('Logged in as ' + client.user.tag + '!');

    const bot_channel = client.channels.find(ch => ch.name === 'bot-test');
    if ( bot_channel === null ) {
        return;
    }
    const general_channel = client.channels.find(ch => ch.name === 'general');
    if ( general_channel === null ) {
        return;
    }

	// Begins a cycle on when server resets occur
    var interval = setInterval (function() {
        serverPlayersTimeUpdate();
        if ( now.getHours() === 2 && now.getMinutes() === 0 ) playTimeDailyReset();
        if ( now.getDay() === 0 && now.getHours() === 2 && now.getMinutes() === 5 ) playTimeWeeklyReset();
    }, 60 * 1000);

});

// Create an event listener for new server members
client.on('guildMemberAdd', member => {
    // Send the message to a designated channel on a server:
    const channel = member.guild.channels.find(ch => ch.name === 'general');
    // Do nothing if the channel wasn't found on this server
    if (!channel) return;
    // Send the message, mentioning the member
    channel.send(`Welcome, ${member}!`);
  });

// Listens for command messages and acts upon those commands
client.on('message', msg => {

    if ( msg.content.startsWith( PREFIX ) ) {

        var args = msg.content.substring( PREFIX.length ).split(" ");

        switch ( args[0] ) {
			
            case "show":
                if ( args[1] === null || args[1] === "" || args[1] === undefined ) {
                    msg.reply("No argument given for command \"show\".");
                    break;
                }
                // Regex that removes all non-numeric characters
                var tmpuser = client.users.get( args[1].replace(/\D/g,'') );
                if ( tmpuser === undefined ) {
                    msg.reply("No user given for command \"show\".");
                    break;
                }
                var sqlcmd = "SELECT * FROM `" + tmpuser.toString() + "`";

                switch ( args[2] ) {

                    case "daily":
                        con.query( sqlcmd, function(err, result, fields) {
                            if (err) {
                                msg.reply("User not found in the database.");
                            }
                            else {
                                var tmpmessage = "";
                                Object.keys(result).forEach(function(key) {
                                    var row = result[key];
                                    var s = row.dailyTime !== 1 ? "s" : "";
                                    tmpmessage += row.game + ": " + row.dailyTime + " min" + s + "\n";
                                }); 
                                msg.reply("Here is the daily times for " + tmpuser.toString() + ":\n\n" + tmpmessage);
                            }
                        });
                        break;
                    case "weekly":
                        con.query( sqlcmd, function(err, result, fields) {
                            if (err) {
                                msg.reply("User not found in the database.");
                            }
                            else {
                                var tmpmessage = "";
                                Object.keys(result).forEach(function(key) {
                                    var row = result[key];
                                    var s = row.weeklyTime !== 1 ? "s" : "";
                                    tmpmessage += row.game + ": " + row.weeklyTime + " min" + s + "\n";
                                }); 
                                msg.reply("Here is the weekly times for " + tmpuser.toString() + ":\n\n" + tmpmessage);
                            }
                        });
                        break;
                    case "previous_weekly":
                        con.query( sqlcmd, function(err, result, fields) {
                            if (err) {
                                msg.reply("User not found in the database.");
                            }
                            else {
                                var tmpmessage = "";
                                Object.keys(result).forEach(function(key) {
                                    var row = result[key];
                                    var s = row.prevweeklyTime !== 1 ? "s" : "";
                                    tmpmessage += row.game + ": " + row.prevweeklyTime + " min" + s + "\n";
                                }); 
                                msg.reply("Here is the previous weekly times for " + tmpuser.toString() + ":\n\n" + tmpmessage);
                            }
                        });
                        break;

                    default:
                    case "total":
                        con.query( sqlcmd, function(err, result, fields) {
                            if (err) {
                                msg.reply("User not found in the database.");
                            }
                            else {
                                var tmpmessage = "";
                                Object.keys(result).forEach(function(key) {
                                    var row = result[key];
                                    var s = row.totalTime !== 1 ? "s" : "";
                                    tmpmessage += row.game + ": " + row.totalTime + " min" + s + "\n";
                                }); 
                                msg.reply("Here is the total times for " + tmpuser.toString() + ":\n\n" + tmpmessage);
                            }
                        });
                        break;

                }
                break;
            
            case "tell":
                if ( args[1] === null || args[1] === "" || args[1] === undefined ) {
                    msg.reply("No argument given for command \"tell\".");
                    break;
                }
                // Regex that removes all non-numeric characters
                var tmpuser = client.users.get( args[1].replace(/\D/g,'') );
                if ( tmpuser === undefined ) {
                    msg.reply("No user given for command \"tell\".");
                    break;
                }
                var message = msg.content.substring( PREFIX.length + args[0].length + 1 + args[1].length + 1 )
                if ( message.length === 0 ) msg.reply( "Cannot send empty message" );
                else tmpuser.send( message );
                break;

            case "":
                msg.reply("No argument given.");
                break;

            default:
                msg.reply("Incorrect argument given.");
                break;

        }
    }
});

client.login('loginstring');