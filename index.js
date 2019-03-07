const Discord = require("discord.js");
const config = require("./config.json");
const client = new Discord.Client();

var guildsWithLastTimestamp = {};
var activityChannels = [];
var timeOffset = 0;
var activityChannelsNames = []

var fs = require('fs');
var data = fs.readFileSync('data.json', 'utf8');
if (data) {
  data = JSON.parse(data);
  guildsWithLastTimestamp = data.g;
  activityChannelsNames = data.a;
  timeOffset = data.t;
}

client.on("ready", () => {
  client.user.setPresence({
    game: {
      name: "" + client.guilds.size + " servers for inactivity",
      type: 'WATCHING'
    },
    status: 'idle'
  })
  //client.user.setActivity("my code", { type: "STREAMING", url: "https://www.twitch.tv/something" })

  for (var i = 0; i < activityChannelsNames.length; i++) {
    activityChannels[i] = client.channels.get(activityChannelsNames[i]);
  }
  console.log(`Bot has started, with ${client.users.size} users, in ${client.channels.size} channels of ${client.guilds.size} guilds.`);
  console.log(`I am ` + client.user.username + `.`);
  console.log("I am part of these guilds:");
  client.guilds.forEach(guil => console.log(guil.name));

  async function fMessage(channel) {
    if (channel.type === 'text') {
      let messages = await channel.fetchMessages({ limit: 10 });
      messages.array().forEach(message => {
        if (!(message.bot) && (message.content.indexOf(config.prefix) === 0)){
          guildsWithLastTimestamp[message.channel.guild.id] = message.createdTimestamp;
          console.log("found Message with timestamp "+message.createdTimestamp+" in guild"+message.channel.guild.id);
        }
      });
      return true;
    }
    return false;
  }
  let ar = [];
  client.channels.forEach(channel => {
    ar.push(fMessage(channel));
  });
  Promise.all(ar).then(res => {
    res = res.filter(item => item);
    console.log("OK, "+res.length+" text-channel.");
  }).catch(err => {
    console.log(err);
  });
});

client.on("guildCreate", guild => {
  console.log(`New guild joined: ${guild.name} (id: ${guild.id}). This guild has ${guild.memberCount} members!`);
  //client.user.setActivity(`with ${client.guilds.size} servers`);
  client.user.setPresence({
    game: {
      name: "" + client.guilds.size + " servers for inactivity",
      type: 'WATCHING'
    },
    status: 'idle'
  })
  
  async function fMessage(channel) {
    if (channel.type === 'text') {
      let messages = await channel.fetchMessages({ limit: 10 });
      messages.array().forEach(message => {
        if (!(message.bot) && (message.content.indexOf(config.prefix) === 0)){
          guildsWithLastTimestamp[message.channel.guild.id] = message.createdTimestamp;
          console.log("found Message with timestamp "+message.createdTimestamp+" in guild"+message.channel.guild.id);
        }
      });
      return true;
    }
    return false;
  }
  let ar = [];
  client.channels.forEach(channel => {
    ar.push(fMessage(channel));
  });
  Promise.all(ar).then(res => {
    res = res.filter(item => item);
    console.log("OK, "+res.length+" text-channel.");
  }).catch(err => {
    console.log(err);
  });
});

client.on("guildDelete", guild => {
  console.log(`I have been removed from: ${guild.name} (id: ${guild.id})`);
  client.user.setActivity(`with ${client.guilds.size} servers`);
});

client.on("message", async message => {
  timeOffset = Date.now() - message.createdTimestamp;
  //console.log(message.channel.guild.id);

  if (message.author.bot) return;

  if (["hi!", "hello!", "hey!"].some(word => message.content.toLowerCase().includes(word)) ||
    config.greetings.includes(message.content)) {
    message.reply(config.greetings[Math.floor(Math.random() * config.greetings.length)]);
  }

  if (message.content.indexOf(config.prefix) !== 0) { if(message.guild !== null) guildsWithLastTimestamp[message.channel.guild.id] = message.createdTimestamp; return; }

  const args = message.content.slice(config.prefix.length).trim().split(/ +/g);
  const command = args.shift().toLowerCase();

  if (command === "help") {
    message.channel.send("Hello, my name is Activity Bot and I am responsible for keeping this server active... or at least making everyone conscious about how inactive it really is.");
    message.channel.send("My prefix is ${config.prefix}. So you can call me with ${config.prefix} [command].");
    message.channel.send("The available commands are:");
    message.channel.send("time: Tells you (and all the others on this server that are even looking at it) how long ago the last message that wasn't a bot or a bot-command was send.");
    message.channel.send("send: Will write a message every 6 hours, about how badly inactive this server has gotten.");
  }

  if (command === "save") {
    if (message.author.id === config.ownerID) {
      message.reply("saving...");
      save();
    }
    else message.reply("You can't force me to do anything!");
    return;
  }

  if (message.author.id === config.ownerID) {//ADMIN Area
    if (command === "eval") {
      try {
        const code = args.join(" ");
        let evaled = eval(code);
   
        if (typeof evaled !== "string")
          evaled = require("util").inspect(evaled);
   
        message.channel.send(clean(evaled), {code:"xl"});
      } catch (err) {
        message.channel.send(`\`ERROR\` \`\`\`xl\n${clean(err)}\n\`\`\``).catch(err => message.channel.send("F"));
      }
      return;
    }
  }

  if (message.guild === null) {//If DM
    message.channel.send("I cant DM, sorry.");
    return message.reply(`But in a server you can call me with ${config.prefix} [command]`)
  }

  if (command === "time") {
    sendUptime(guildsWithLastTimestamp[message.channel.guild.id], message.channel)
  }

  if (command === "send") {
    function containsObject(obj, list) {
      var i;
      for (i = 0; i < list.length; i++) {
        if (list[i].id === obj.id) {
          return true;
        }
      }
      return false;
    }
    if (containsObject(message.channel, activityChannels)) {
      console.log("rem")
      message.channel.send("Ill not send any more notifications here.");
      activityChannels = activityChannels.filter(function (value, index, arr) { return value !== message.channel; });
      return;
    }
    console.log("add")
    activityChannels[0] = message.channel;
    activityChannels[0].send("Ill send a notification here every 6 hours.");
  }
});

function sendUptime(timeStamp, channel) {
  var secondsSinceLastMessage = ((Date.now() - timeOffset) - parseInt(timeStamp)) / 1000;
  var time = {};
  time.days = Math.floor(secondsSinceLastMessage / (3600 * 24));
  time.hours = Math.floor((secondsSinceLastMessage - (time.days * 3600 * 24)) / 3600);
  time.minutes = Math.floor((secondsSinceLastMessage - (time.days * 3600 * 24) - (time.hours * 3600)) / 60);
  time.seconds = parseInt(secondsSinceLastMessage - (time.days * 3600 * 24) - (time.hours * 3600) - (time.minutes * 60));

  channel.send("The last Message on this Server was send "
    + time.days + " days, " + time.hours + " hours, " + time.minutes + " minutes, and " + time.seconds + " seconds ago.").catch(console.error);
}

var interval = setInterval(function () {
  for (var i = 0; i < activityChannels.length; i++) {
    sendUptime(guildsWithLastTimestamp[activityChannels[i].guild.id], activityChannels[i])
  }
}, 3600 * 6 * 1000);//send a message every 6 hours

function save() {
  console.log("saving");
  var activityChannelsNames = [];
  for (var i = 0; i < activityChannels.length; i++) {
    activityChannelsNames.push(activityChannels[i].id);
  }
  data = { g: guildsWithLastTimestamp, a: activityChannelsNames, t: timeOffset };
  console.log(data)
  fs.writeFile('data.json', JSON.stringify(data), 'utf8', err => { });
}

var saving = setInterval(function () {
  save();
}, 1800 * 1000);//save every 30 minutes

const clean = text => {
  if (typeof(text) === "string")
    return text.replace(/`/g, "`" + String.fromCharCode(8203)).replace(/@/g, "@" + String.fromCharCode(8203));
  else
      return text;
}


client.login(config.token);
