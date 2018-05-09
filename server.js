// server.js
// where your node app starts

// init project
const express = require('express');
const app = express();
const fs = require("fs");
const path = require("path");

if(!fs.existsSync("user")) {
  fs.mkdirSync("user");
}

// we've started you off with Express, 
// but feel free to use whatever libs or frameworks you'd like through `package.json`.

// http://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));

// http://expressjs.com/en/starter/basic-routing.html
app.get('*', (req, res) => {
  var username = req.ip;
  
  if(!fs.existsSync("user/" + username)) {
    fs.mkdirSync("user/" + username);
  }
  
  res.sendFile(__dirname + "/views/index.html");
  
  if(!fs.existsSync(__dirname + "/user/" + username + req.path)) {
    res.redirect('/');
  }
  //res.send(req.path);
});
/*
app.post('*', (req, res) => {
  var [command, ...args] = req.body.split(' ')[0]
  var args = args.join(' ')
  var valid_cmds = [
    "cd", "rm", "mkdir", "
  ]
});

app.delete('*', (req, res) => {
  fs.unlinkSync(__dirname + "/user/" + req.ip + req.url);
  
});
*/
// listen for requests :)
var listener = app.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});