const mongoose = require('mongoose');

const requestDepartureSchema = new mongoose.Schema({

    requestDate: {
        type: Date,
        default: Date.now, 
        required: true
    },
    departureType: {
        type: String,
        enum: ['Baptism', 'Confirmation', 'Death', 'Marriage'], 
        required: true
    },
    applicant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users', 
        required: true
    },
    departureId: { 
        type: mongoose.Schema.Types.ObjectId, 
        refPath: 'departureType', 
        required: true 
    },

    status: {
        type: String,
        default: 'Pendiente',  // Valor predeterminado
        required: true,
    }
});

const requestDeparture = mongoose.model('RequestDeparture', requestDepartureSchema);

module.exports = requestDeparture;
