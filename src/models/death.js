const mongoose = require('mongoose');

const deathSchema = new mongoose.Schema({

  deathDate: {
    type: Date,
    required: true
  },

  dead: {
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Users', 
    required: true, 
    unique: true
  },

  fatherName: {
    type: String,
    required: true
  },

  motherName: {
    type: String,
    required: true
  },

  civilStatus: {
    type: String,
    required: true
  },

  cemeteryName: {
    type: String,
    required: true
  },

  funeralDate: {
    type: Date,
    required: false
  }

});

const death = mongoose.model('Death', deathSchema);

module.exports = death;
