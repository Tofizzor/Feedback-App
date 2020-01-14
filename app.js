//jshint esversion:6
require("dotenv").config();
const express = require("express"),
  bodyParser = require("body-parser"),
  ejs = require("ejs"),
  mongoose = require("mongoose"),
  passport = require("passport"),
  passportLocalMongoose = require("passport-local-mongoose"),
  session = require("express-session"),
  _ = require("lodash");


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

const surveySchema = {
  name: String,
  company: String,
  survey: []
};

const Survey = mongoose.model("Survey", surveySchema);

const reviewSchema = {
  page: String,
  contents: [feedbackSchema],
  ratings: [surveySchema]
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

//Create user that can access the feedback
function userCreation(username, password) {
User.findOne({
  username: username
}, function(err, foundUser) {
  if (!foundUser) {
    User.register({
      username: username
    }, password, function(err, user) {
      if (err) {
        console.log(err);
      }
    });
  }
});
};

//Create page that contains posted feedback
function feedbackPageCreation(page) {
  Review.findOne({
    page: page
  }, function(err, foundPage) {
    if (!foundPage) {
      const viewPage = new Review({
        page: page,
        contents: []
      });
      viewPage.save();
    }
  });
}

feedbackPageCreation("View");
userCreation(process.env.ADMIN_USERNAME, process.env.ADMIN_PASSWORD);

// Application routes.

app.get("/", function(req, res) {
  res.render("home");
});

app.route("/login")
  .get(function(req, res) {
    if(req.isAuthenticated()){
      res.redirect("/view");
    } else {
        res.render("login");
    }
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
    if (req.isAuthenticated()) {
      Review.findOne({
        page: "View"
      }, function(err, foundPage) {
        res.render("view", {
          contents: foundPage.contents
        });
      })
    } else {
      res.redirect("/login");
    }
  })
  .post(function(req, res) {
    const feedbackId = req.body.delete;
    Review.findOne({
      page: "View"
    }, function(err, foundPage) {
      foundPage.contents.forEach(function(item, index, feedback) {
        if (item._id == feedbackId) {
          feedback.splice(index, 1);
          foundPage.save();
        }
      });
    });
    res.redirect("/view");
  });

app.route("/feedback")
  .get(function(req, res) {
    res.render("feedback");
  })
  .post(function(req, res) {
    const feedback = new Feedback({
      name: req.body.name,
      company: req.body.company,
      feedback: req.body.feedback
    });
    Review.findOne({
      page: "View"
    }, function(err, foundPage) {
      foundPage.contents.push(feedback);
      foundPage.save();
      res.redirect("/");
    });
  });

app.post("/survey", function(req, res){
console.log(req.body);
});

app.get("/view/:feedbackId", function(req, res) {
if(req.isAuthenticated()){
const requestedFeedbackId = req.params.feedbackId;
Review.findOne({page: "View"}, function(err, pageFound){
  if(!pageFound){
    console.log("No page was found named View");
    res.redirect("/view");
  } else {
    pageFound.contents.forEach(function(feedback){
      if(feedback._id == requestedFeedbackId){
        res.render("singleFeedback", {
          feedback: feedback
        });
      }
    })
  }
});
} else {
  res.redirect("/login");
}
});

app.get("/logout", function(req, res) {
  req.logout();
  res.redirect("/");
});

app.listen("3000", function(req, res) {
  console.log("Running on port 3000");
});
