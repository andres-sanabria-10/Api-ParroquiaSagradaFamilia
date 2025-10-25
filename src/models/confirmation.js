const mongoose = require('mongoose');

const confirmationSchema = new mongoose.Schema({

  confirmationDate: {
    type: Date,
    required: true
  },

  confirmed: {
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

  godfather: {
    type: String,
    required: true
  },

  buatizedParish: {
    type: String,
    required: false
  }

});


const confirmation = mongoose.model('Confirmation', confirmationSchema);

module.exports = confirmation;
