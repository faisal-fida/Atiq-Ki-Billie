const fs = require("fs");
var ltmJSON = fs.readFileSync("LongTermMemory.json");
var questionsJSON = fs.readFileSync("Questions.json");
const Filter = require("bad-words"),
filter = new Filter();

// Filter blacklist:
filter.addWords("murder","kill","assassinate");

// Express stuff starts here

const bodyParser = require("body-parser");
const express = require("express");
const app = express();
var lastQuestion;

app.use(bodyParser.urlencoded({ extended: false }));
app.set('views', __dirname + '/public');
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');

app.get('/', (req, res) => {
  lastQuestion = generateQuestion();
	res.render(__dirname + '/public/index.html', {response: "Hello!", question: lastQuestion, instructions: true});
});

app.listen(process.env.PORT);

app.post("/prompt", (req, res) => {
  if(!req.body.inputOne){
    return;
  }
	console.log("New prompt: " + req.body.inputOne);
  lastQuestion = generateQuestion();
	res.render(__dirname + '/public/index.html', {response: evaluatePrompt(req.body.inputOne.toLowerCase()), question: lastQuestion, instructions: false});
});

app.post("/answer", (req, res) => {
  if(!req.body.answer){
    return;
  }
  console.log(`Answer: ${req.body.answer}`)
  //analyzeConversationAndWriteToLTM(lastQuestion, req.body.inputTwo);
  // Disabled until fixed
  lastQuestion = generateQuestion();
	res.render(__dirname + '/public/index.html', {response: "Hello!", question: lastQuestion, instructions: false});
});

app.post("/regenerate", (req, res) => {
  lastQuestion = generateQuestion();
	res.render(__dirname + '/public/index.html', {response: "Hello!", question: lastQuestion, instructions: false});
});

// Don't put anything after this, put it before
app.use(function (err, req, res, next) {
  console.error(err.stack)
  res.render(__dirname + '/public/error.html', {error: err.message});
})
// Don't put anything after this

//...and ends here.
//Discord stuff starts here

const discord = require("discord.js");
const client = new discord.Client();

client.on("ready", () => {
  console.log("Bot is online!");
  client.user.setActivity("to your conversations for the Casa AI chat bot", {
  type: "LISTENING",
  url: "https://conversation-analyzing-socially-adapting-ai-casaai.catr3kd.repl.co/"
  });
});

client.login(process.env.BOT_TOKEN);

client.on('guildCreate', guild => {
  guild.member(client.user).setNickname("Casa AI");
  guild.channels.create("teach-casaai", { reason: "Channel where CASAAI learns from spectating conversations" })
  .then(newChannel => 
  newChannel.setTopic("Converse normally, and use correct grammar! \(It\'s to teach an AI!\)")).then(newChannel =>
    newChannel.send("Thanks for inviting me to **" + newChannel.guild.name + "**! My purpose is to watch conversations for CASAAI to learn in this channel and **only this channel**, <#" + newChannel.id + ">. You can change the channel name, but __make sure not to delete it__! You can find the rest of the CASAAI project here: https://Conversation-Analyzing-Socially-Adapting-AI-CASAAI.catr3kd.repl.co Thanks again!\n- The CASAAI Team"));
});

client.on('message', msg => {
  if(msg.channel.name == "teach-casaai" && !msg.author.bot){
    console.log("Message caught: " + msg.content);
    var interrogatives = ["who", "what", "when", "where", "why", "how"];
    if(msg.content.slice(-1) == "?" && interrogatives.includes(msg.content.toLowerCase().split(" ")[0]) && !filter.isProfane(msg.content)){
      writeQuestionToJSON(msg.content.toLowerCase());
      msg.reply(evaluatePrompt(msg.content.toLowerCase()));
    }
  }
});

//...and ends here.

var prompts = [];
var responses = [];
var questions = [];

var punctuation = /[!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~]/g;

function writeStatementToLTM(promptStr, responseStr){
  ltmJSON = fs.readFileSync("LongTermMemory.json");
  let statement = {prompt: promptStr, response: responseStr};
  let memory = JSON.parse(ltmJSON);
  memory.push(statement);
  newMemoryJSON = JSON.stringify(memory);
  fs.writeFileSync("LongTermMemory.json",newMemoryJSON);
}

function updateLTMArrays(){
  prompts = [];
  responses = [];
  ltmJSON = fs.readFileSync("LongTermMemory.json");
  let memory = JSON.parse(ltmJSON);
  let memoryLength = Object.keys(memory).length;
  for (let step = 0; step < memoryLength; step++) {
    prompts.push(memory[step].prompt);
    responses.push(memory[step].response);
  }
}

function writeQuestionToJSON(questionStr){
  //Check if it starts with an interrogative and ends with a question mark
  var interrogatives = ["who", "what", "when", "where", "why", "how"];
  if(questionStr.slice(-1) == "?" && interrogatives.includes(questionStr.split(" ")[0])){
    questionsJSON = fs.readFileSync("Questions.json");
    let statement = {question: questionStr};
    let questionsList = JSON.parse(questionsJSON);
    questionsList.push(statement);
    newQuestionJSON = JSON.stringify(questionsList);
    fs.writeFileSync("Questions.json",newQuestionJSON);
  }
}

function updateQuestionsArray(){
  questions = [];
  questionsJSON = fs.readFileSync("Questions.json");
  let questionsList = JSON.parse(questionsJSON);
  let questionsLength = Object.keys(questionsList).length;
  for (let step = 0; step < questionsLength; step++) {
    questions.push(questionsList[step].question);
  }
}

function findPromptResponse(saidPrompt){
  let prompt = saidPrompt.toString().toLowerCase().replace(punctuation,"");
  updateLTMArrays();
  if (prompts.includes(prompt)){
    let promptLocation = prompts.indexOf(prompt);
    if (responses.length < promptLocation){
      console.log("Error: Prompt location larger than response list.\nPrompts and Responses are most likely out of sync. Amount of prompts: " + prompts.length + "\nAmount of responses: " + responses.length);
    } else {
      return(responses[promptLocation]);
    }
  } else {
    console.log("Error: Prompt not found.\nRequested prompt: " + prompt);
  }
}

function evaluatePrompt(saidPrompt){
  let prompt = saidPrompt.replace(punctuation,"");
  updateLTMArrays();
  if (filter.isProfane(prompt)){
    return("Rude!");
  } else {
    if (prompts.includes(prompt)){
      return("Responded: " + findPromptResponse(prompt));
    } else {
      if(!filter.isProfane(saidPrompt)){
        writeQuestionToJSON(saidPrompt);
      }
      return("Sorry! I don't know that one!");
    }
  }
}

function capitalizeFirstLetter(toCap){
  return toCap.charAt(0).toUpperCase() + toCap.slice(1);
}

function analyzeConversationAndWriteToLTM(unrefinedFirstStatement, unrefinedSecondStatement){
  updateLTMArrays();
  var firstStatement = unrefinedFirstStatement.toLowerCase().replace(punctuation,"");
  var secondStatement = unrefinedSecondStatement.toLowerCase().replace(punctuation,"");
  if(prompts.includes(firstStatement) || secondStatement == "new question" || secondStatement == "newquestion" || secondStatement == "" || secondStatement == " " || firstStatement == "" || firstStatement == " "){
    return;
  } else {
    if(!filter.isProfane(firstStatement) && !filter.isProfane(secondStatement)){
      var finalFirstStatement = firstStatement;
      var finalSecondStatement = capitalizeFirstLetter(unrefinedSecondStatement);
      writeStatementToLTM(finalFirstStatement, finalSecondStatement);
      updateLTMArrays();
      console.clear();
    } else {
      console.log("Rude!");
    }
  }
}

function generateQuestion(){
  var question;
  updateQuestionsArray();
  if(questions && questions.length >= 5){
    if(questions.length >= 75 && Math.random() * 10 >= 7.5){
      question = questions[Math.floor(Math.random() * questions.length)];
      if(question.slice(-1) !== "?"){
        question = question + "?"
      }
      return(question);
    } else if (questions.length >= Math.floor(Math.random() * 100)) {
      question = questions[Math.floor(Math.random() * questions.length)];
      if(question.slice(-1) !== "?"){
        question = question + "?"
      }
      return(question.charAt(0).toUpperCase() + question.slice(1));
    }
  }
  var interrogatives = ["who", "what", "when", "where", "why", "how"];
  var adjectives = ["favorite ", "best ", "awesome ", "great ", "nice ", "cool ", "", "", "", "", "", "", "", "", "", "", "", "", "", ""];
  var nouns = ["place", "person", "friend", "food", "cousin", "aunt", "uncle", "grandparent", "family member", "sibling", "dessert", "vegetable", "plant", "flower", "park", "pet"];
  var verbs = ["leaving", "going", "coming", "eating", "waking up", "going to bed", "going home", "going to eat", "coming home", "leaving home", "stopping", "starting",];
  var interrogative = interrogatives[Math.floor(Math.random() * interrogatives.length)];
  if(Math.random() < 0.3){
    if(interrogative == "why" || interrogative == "when"){
      question = interrogative + " are you " + verbs[Math.floor(Math.random() * verbs.length)] + "?"
    } else {
      question = interrogative + " are you?"
    }
  } else {
    if(interrogative == "why" || interrogative == "when"){
      if(Math.random() < 0.5){
        question = interrogative + " is your " + adjectives[Math.floor(Math.random() * adjectives.length)] + nouns[Math.floor(Math.random() * nouns.length)] + " " + verbs[Math.floor(Math.random() * verbs.length)] + "?";
      } else {
        question = interrogative + " are your " + adjectives[Math.floor(Math.random() * adjectives.length)] + nouns[Math.floor(Math.random() * nouns.length)] + "s " + verbs[Math.floor(Math.random() * verbs.length)] + "?";
      }
    } else{
      if(Math.random() < 0.5){
        question = interrogative + " is your " + adjectives[Math.floor(Math.random() * adjectives.length)] + nouns[Math.floor(Math.random() * nouns.length)] + "?";
      } else {
        question = interrogative + " are your " + adjectives[Math.floor(Math.random() * adjectives.length)] + nouns[Math.floor(Math.random() * nouns.length)] + "s?";
      }
    }
  }
  if(Math.random() < 0.2){
    if(Math.random() < 0.8){
      question = "Hey, ".concat(question);
    } else {
      if(Math.random() < 0.4){
        question = "If you don't mind me asking, " + question;
      } else {
        question = "May I ask, " + question;
      }
    }
  }
  return(question.charAt(0).toUpperCase() + question.slice(1));
}