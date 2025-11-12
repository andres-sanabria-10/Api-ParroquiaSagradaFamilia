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
      },
      // Campo opcional para indicar quién reservó temporalmente este slot (RequestMass._id)
      reservedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'RequestMass',
        default: null,
      },
      // Fecha hasta la cual la reserva es válida (se libera si expira)
      reservedUntil: {
        type: Date,
        default: null,
      }
    }
  ]
});

const massSchedule = mongoose.model('MassSchedule', massScheduleSchema);

module.exports = massSchedule;
