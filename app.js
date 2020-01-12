//jshint esversion:6
require("dotenv").config();
const express = require("express"),
  bodyParser = require("body-parser"),
  ejs = require("ejs"),
  mongoose = require("mongoose"),
  passport = require("passport"),
  passportLocalMongoose = require("passport-local-mongoose"),
  session = require("express-session");


// Configure connection to MongoDB
mongoose.connect('mongodb://localhost:27017/feedbackDB', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});
const db = mongoose.connection;
db.on("error", console.error.bind(console, "connections error:"));
db.once("open", function() {
  console.log("Succesfully connected to mongoDB");
});
// Mongoose deprication settings
mongoose.set("useCreateIndex", true);
mongoose.set('useNewUrlParser', true);
mongoose.set('useFindAndModify', false);
mongoose.set('useUnifiedTopology', true);

// Creating schemas and models

const feedbackSchema = {
  name: String,
  company: String,
  feedback: String
};

const Feedback = mongoose.model("Feedback", feedbackSchema);

const reviewSchema = {
  page: String,
  feedbacks: [feedbackSchema]
};

const Review = mongoose.model("Review", reviewSchema);

const userSchema = new mongoose.Schema({
  username: String,
  password: String
});

userSchema.plugin(passportLocalMongoose);

const User = mongoose.model("User", userSchema);

const admin = new User({
  username: process.env.ADMIN_USERNAME,
  password: process.env.ADMIN_PASSWORD
});

passport.use(User.createStrategy());

// Passport authenticated session persistence.
passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

// Application setup
const app = express();

// Configure engine to render EJS templates
app.set("view engine", "ejs");

// Use application-level middleware for common functionality, including
// public directory access, parsing and session handling.
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(express.static("public"));
app.use(session({
  secret: "our little secret.",
  resave: false,
  saveUninitialized: false
}));

// Initialize Passport and restore authentication state, if any,
// from the session.
app.use(passport.initialize());
app.use(passport.session());

function userCreation(){
User.register({
      username: process.env.ADMIN_USERNAME
    }, process.env.ADMIN_PASSWORD, function(err, user) {
      if (err) {
        console.log(err);
      }
    });
};

User.findOne({username:"admin"}, function(err, foundUser){
  if(!foundUser){
    userCreation();
  }
});
// Application routes.

app.get("/", function(req, res) {
  res.render("home");
});

app.route("/login")
  .get(function(req, res) {
    res.render("login");
  })
  .post(function(req, res) {
      const user = new User({
        username: req.body.username,
        password: req.body.password
      });
      req.login(user, function(err) {
        if (err) {
          console.log(err);
        } else {
          passport.authenticate("local")(req, res, function() {
            res.redirect("/view");
          });
        }
      });
  });

app.route("/view")
.get(function(req, res) {
const page = "View";
if(req.isAuthenticated()) {
  Review.findOne({page:page}, function(err, foundPage){
    if(!foundPage){
      const viewPage = new Review({
        page: page,
        feedbacks: []
      });
      viewPage.save();
      res.redirect("/view");
    } else {
      res.render("view", {
        feedbacks: foundPage.feedbacks
      });
    }
  });
} else {
  res.redirect("/login");
}
})
.post(function(req, res){
  const feedbackId = req.body.delete;
  Review.findOne({page: "View"}, function(err, foundPage){
    foundPage.feedbacks.forEach(function(item, index ,feedback){
      if(item._id == feedbackId){
        feedback.splice(index, 1);
        foundPage.save();
      }
    });
  });
  res.redirect("/view");
});

app.route("/feedback")
.get(function(req, res){
  res.render("feedback");
})
.post(function(req, res){
  const feedback = new Feedback({
    name: req.body.name,
    company: req.body.company,
    feedback: req.body.feedback
  });
  Review.findOne({page:"View"}, function(err, foundPage){
    foundPage.feedbacks.push(feedback);
    foundPage.save();
    res.redirect("/");
  });
});

app.get("/logout", function(req,res){
  req.logout();
  res.redirect("/");
});

app.listen("3000", function(req, res) {
  console.log("Running on port 3000");
});
