const mongoose = require('mongoose');

const marriageSchema = new mongoose.Schema({

  marriageDate: {
    type: Date,
    required: true
  },

  husband: {
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Users',
    required: true,
    unique: true
  },

  wife: {
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Users', 
    required: true,
    unique: true
  },

  father_husband: {
    type: String,
    required: false
  },

  mother_husband: {
    type: String,
    required: false
  },

  father_wife: {
    type: String,
    required: false
  },

  mother_wife: {
    type: String,
    required: false
  },
  godfather1: {
    type: String,
    required: true
  },

  godfather2: {
    type: String,
    required: true
  },

  witness1: {
    type: String,
    required: true
  },

  witness2: {
    type: String,
    required: true
  }

});

const marriage = mongoose.model('Marriage', marriageSchema);

module.exports = marriage;
