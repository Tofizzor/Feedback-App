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

// Message Model
const feedbackSchema = {
  name: String,
  company: String,
  feedback: String
};

const Feedback = mongoose.model("Feedback", feedbackSchema);

// Survey Models
const ratingSchema = {
  question: String,
  rating: String,
  comment: String
}

const Rating = mongoose.model("Rating", ratingSchema);

const surveySchema = {
  name: String,
  company: String,
  surveys: [ratingSchema],
  extra: String
};

const Survey = mongoose.model("Survey", surveySchema);


//Page Model
const pageSchema = {
  page: String,
  contents: [feedbackSchema],
  ratings: [surveySchema]
};

const Page = mongoose.model("Page", pageSchema);

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
  Page.findOne({
    page: page
  }, function(err, foundPage) {
    if (!foundPage) {
      const viewPage = new Page({
        page: page,
        contents: [],
        ratings: []
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
    if (req.isAuthenticated()) {
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

app.get("/view", function(req, res) {
  if (req.isAuthenticated()) {
    Page.findOne({
      page: "View"
    }, function(err, foundPage) {
      res.render("view", {
        contents: foundPage.contents,
        ratings: foundPage.ratings
      });
    })
  } else {
    res.redirect("/login");
  }
});

app.post("/delete", function(req, res) {
  const feedbackId = req.body.delete;
  const surveyId = req.body.surveyDelete;
  Page.findOne({
    page: "View"
  }, function(err, foundPage) {
    if(feedbackId != null){
    foundPage.contents.forEach(function(item, index, feedback) {
        if (item._id == feedbackId) {
          feedback.splice(index, 1);
          foundPage.save();
        }
    });
  } else if (surveyId != null){
    foundPage.ratings.forEach(function(item, index, rating){
      if(item._id== surveyId) {
        rating.splice(index, 1);
        foundPage.save();
      }
    });
  } else {
    console.log("Error handling delete request");
  }
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
    Page.findOne({
      page: "View"
    }, function(err, foundPage) {
      foundPage.contents.push(feedback);
      foundPage.save();
      res.redirect("/");
    });
  });

app.post("/survey", function(req, res) {
  let ratings = [req.body.socialSkills, req.body.techSkills];
  ratings.forEach(function(item, index, rating) {
    switch (item) {
      case "vGood":
        rating[index] = "Very Good";
        break;
      case "good":
        rating[index] = _.capitalize(item);
        break;
      case "norm":
        rating[index] = "Normal";
        break;
      case "poor":
        rating[index] = _.capitalize(item);
        break;
      case "vPoor":
        rating[index] = "Very Poor";
        break;
    }
  });
  const survey = new Survey({
    name: req.body.name,
    company: req.body.company,
    surveys: [],
    extra: req.body.extra
  });
  let rating = new Rating({
    question: "Social Skills",
    rating: ratings[0],
    comment: req.body.socialExtra
  });
  survey.surveys.push(rating);
  rating = {
    question: "Technical Skills",
    rating: ratings[1],
    comment: req.body.techExtra
  }
  survey.surveys.push(rating);
  Page.findOne({
    page: "View"
  }, function(err, foundPage) {
    foundPage.ratings.push(survey);
    foundPage.save();
    res.redirect("/");
  });
});

app.get("/view/:feedbackId", function(req, res) {
  if (req.isAuthenticated()) {
    const requestedFeedbackId = req.params.feedbackId;
    Page.findOne({
      page: "View"
    }, function(err, pageFound) {
      if (!pageFound) {
        console.log("No page was found named View");
        res.redirect("/view");
      } else {
        pageFound.contents.forEach(function(feedback) {
          if (feedback._id == requestedFeedbackId) {
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
