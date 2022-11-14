const express = require('express');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const passport = require('passport');
const User = mongoose.model('User');
const router = express.Router();
const { loginUser, restoreUser } = require('../../config/passport');
const { isProduction } = require('../../config/keys');
const validateRegisterInput = require('../../validations/register');
const validateLoginInput = require('../../validations/login');

// GET users listing
router.get('/', async function(req, res, next) {
  try {
    const users = await User.find().populate('firstName', 'age', 'location', 'gender', 'matches');
    return res.json(users);
  } catch (error) {
    return res.json([]);
  }
});

// POST /api/users/register
router.post('/register', validateRegisterInput, async (req, res, next) => {
  const user = await User.findOne({
    $or: [{ email: req.body.email }]
  });

  if (user) {
    const err = new Error("Validation Error");
    err.statusCode = 400;
    const errors = {};
    if (user.email === req.body.email) {
      errors.email = "A user has already registered with this email";
    }
    err.errors = errors;
    return next(err);
  }

  const newUser = new User({
    email: req.body.email
  });

  bcrypt.genSalt(10, (err, salt) => {
    if (err) throw err;
    bcrypt.hash(req.body.password, salt, async (err, hashedPassword) => {
      if (err) throw err;
      try {
        newUser.hashedPassword = hashedPassword;
        const user = await newUser.save();
        return res.json(await loginUser(user));
      }
      catch (err) {
        next(err);
      }
    })
  });
});

// POST /api/users/login
router.post('/login', validateLoginInput, async (req, res, next) => {
  passport.authenticate('local', async function (err, user) {
    if (err) return next(err);
    if (!user) {
      const err = new Error('Invalid credentials');
      err.statusCode = 400;
      err.errors = { email: "Invalid credentials" };
      return next(err);
    }
    return res.json(await loginUser(user));;
  })(req, res, next);
});

// GET /api/users/current
router.get('/current', restoreUser, (req, res) => {
  if (!isProduction) {
    const csrfToken = req.csrfToken();
    res.cookie("CSRF-TOKEN", csrfToken);
  }
  if (!req.user) return res.json(null);
  res.json({
    _id: req.user._id,
    email: req.user.email
  });
});

// PATCH /api/users/:userId
router.patch('/:userId', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId);

    if (user) {
      user.email = req.body.email || user.email;
      user.firstName = req.body.firstName || user.firstName;
      user.age = req.body.age || user.age;
      user.location = req.body.location || user.location;
      user.gender = req.body.gender || user.gender;
      user.genderPreference = req.body.genderPreference || user.genderPreference;
      user.prompt1 = req.body.prompt1 || user.prompt1;
      user.prompt2 = req.body.prompt2 || user.prompt2;
      user.prompt3 = req.body.prompt3 || user.prompt3;
      user.prompt4 = req.body.prompt4 || user.prompt4;
      if (req.body.likedUserId) user.likes.set(req.body.likedUserId, true);
      if (req.body.matchedUserId) user.matches.set(req.body.matchedUserId, true);
    }

    if (req.body.password) {
      bcrypt.genSalt(10, (err, salt) => {
        if (err) throw err;
        bcrypt.hash(req.body.password, salt, async (err, hashedPassword) => {
          if (err) throw err;
          try {
            user.hashedPassword = hashedPassword;
            const updatedUser = await user.save();
          }
          catch (err) {
            next(err);
          }
        })
      });
    }

    return res.json(user);

  } catch (error) {
    next(error)
  }
})

module.exports = router;
