const mongoose = require('mongoose');

const baptismSchema = new mongoose.Schema({

  baptismDate: {
    type: Date,
    required: true
  },

  baptized: {
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Users', 
    required: true,
    unique: true
  },

  placeBirth: {
    type: String,
    required: true
  },

  fatherName: {
    type: String,
    required: true
  },

  motherName: {
    type: String,
    required: true
  },

  godfather1: {
    type: String,
    required: true
  },

  godfather2: {
    type: String,
    required: false
  }
});

const Baptism = mongoose.model('Baptism', baptismSchema);

module.exports = Baptism;
