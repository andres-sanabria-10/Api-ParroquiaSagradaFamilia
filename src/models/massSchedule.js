const mongoose = require('mongoose');

const massScheduleSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true
  },

  timeSlots: [
    {
      time: {
        type: String,  // Puedes cambiar esto a Date si prefieres almacenar la hora completa
        required: true
      },
      available: {
        type: Boolean,
        default: true
      },
      status: {
        type: String,
        default: "Libre"
      }
    }
  ]
});

const massSchedule = mongoose.model('MassSchedule', massScheduleSchema);

module.exports = massSchedule;
