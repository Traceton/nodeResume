require("dotenv").config();
const express = require("express");
const session = require("express-session");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { urlencoded } = require("express");
const server = express();
const database = mongoose.connection;
const MongoStore = require("connect-mongo")(session);
const User = require("./models/user");
const ONE_HOUR = 1000 * 60 * 60;
const CURRENT_ENV = process.env.ENVIROMENT === "production";
const SALT = 10;
mongoose.connect(process.env.DATABASE_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

database.on("error", (error) => {
  console.log(error);
});
database.once("open", () => {
  console.log("connected to mongoDB database");
});

server.use(express.json());
server.use(express.urlencoded({ extended: true }));
server.use("/public", express.static("public"));
server.set("view engine", "ejs");
server.use("/", (req, res, next) => {
  res.set("credentials", "include");
  res.set("Access-Control-Allow-Credentials", true);
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE");
  res.set(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With,x-api-key,X-HTTP-Method-Override, Content-Type, Accept"
  );
  next();
});

server.use(
  session({
    store: new MongoStore({ mongooseConnection: database }),
    name: process.env.SESSION_NAME,
    resave: false,
    saveUninitialized: false,
    secret: process.env.SESSION_SECRET,
    cookie: {
      httpOnly: true,
      maxAge: ONE_HOUR,
      sameSite: "none",
      secure: CURRENT_ENV,
    },
  })
);

let findUsers = async (req, res, next) => {
  try {
    const users = await User.find();
    req.session.users = users;
  } catch (error) {
    return console.log(`could not find users -> ${error}`);
  }
  next();
};

let checkIfExists = async (req, res, next) => {
  const users = req.session.users;
  for (const user in users) {
    if (users[user].username == req.body.username) {
      req.session.exists = true;
      return next();
    } else {
      req.session.exists = false;
    }
  }
  console.log("user doesnt not exist yet");
  next();
};

// Get resume home page.
server.get("/", async (req, res) => {
  const userId = await req.session.userId;
  try {
    if (userId) {
      console.log(`${userId} logged in`);
      res.render("home", {
        data: {
          username: userId,
        },
      });
    } else if (!userId) {
      res.render("home", {
        data: {
          username: "",
        },
      });
    }
  } catch (error) {
    res.status(500).send(`<h1>Under maintenance</h1>`);
  }
});

// get about this page info
server.get("/about", async (req, res) => {
  const userId = await req.session.userId;
  try {
    if (userId) {
      res.render("about", { data: { username: userId } });
    } else if (!userId) {
      res.render("about", { data: { username: "" } });
    }
  } catch (error) {
    res.status(500).send(`<h1>under maintenance</h1>`);
  }
});

// get user login page.
server.get("/login", async (req, res) => {
  const userId = await req.session.userId;
  try {
    if (!userId) {
      res.render("login");
    } else {
      res.redirect("/");
    }
  } catch (error) {
    res.status(500).send(`<h1>under maintenance</h1>`);
  }
});

// get user create Account page.
server.get("/createAccount", async (req, res) => {
  const userId = await req.session.userId;
  try {
    if (!userId) {
      res.render("createAccount");
    } else {
      res.redirect("/");
    }
  } catch (error) {
    res.status(500).send(`<h1>under maintenance</h1>`);
  }
});

// post user login.
server.post("/login", findUsers, checkIfExists, (req, res) => {
  const users = req.session.users;
  if (req.session.exists) {
    for (const user in users) {
      bcrypt.compare(req.body.password, users[user].password, (err, result) => {
        if (result == true && req.body.username == users[user].username) {
          req.session.userId = req.body.username;
          req.session.save();
          res.redirect("/");
        } else if (err) {
          console.log(err);
        } else {
          console.log(`login attempts -> passwords dont match`);
        }
      });
    }
  } else {
    console.log("username already exists");
    res.redirect("/login");
  }
});

// post user create account.
server.post("/createAccount", findUsers, checkIfExists, (req, res) => {
  bcrypt.hash(req.body.password, SALT, (err, hash) => {
    if (err) {
      console.log(`password could not be hashed -> ${err}`);
      res.redirect("/createAccount");
    } else if (hash) {
      const user = new User({
        username: req.body.username,
        password: hash,
      });
      try {
        if (!req.session.exists) {
          req.session.userId = user.username;
          user.save();
          req.session.save();
          console.log(`${user.username} created a account`);
          res.redirect("/");
        } else {
          console.log("username already exists");
          res.redirect("/login");
        }
      } catch (error) {
        console.log(`user could not be saved -> ${error}`);
        res.redirect("/createAccount");
      }
    }
  });
});

// post user logout.
server.post("/logout", async (req, res) => {
  try {
    console.log(`${req.session.userId} Logged out`);
    await req.session.destroy();
    res.redirect("/");
  } catch (error) {
    res.status(500).send(`<h1>under maintenance</h1>`);
  }
});

server.listen(process.env.PORT, () => {
  console.log(`server running on http://localhost:${process.env.PORT}`);
});
